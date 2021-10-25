var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import SyncPromise from 'sync-promise';
import { createDOMException } from './DOMException';
import { IDBCursor, IDBCursorWithValue } from './IDBCursor';
import * as util from './util';
import * as Key from './Key';
import { setSQLForKeyRange, IDBKeyRange, convertValueToKeyRange } from './IDBKeyRange';
import IDBTransaction from './IDBTransaction';
import * as Sca from './Sca';
import CFG from './CFG';
import IDBObjectStore from './IDBObjectStore';
var readonlyProperties = ['objectStore', 'keyPath', 'multiEntry', 'unique'];
/**
 * IDB Index
 * http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
 * @param {IDBObjectStore} store
 * @param {IDBIndexProperties} indexProperties
 * @class
 */
function IDBIndex() {
    throw new TypeError('Illegal constructor');
}
var IDBIndexAlias = IDBIndex;
IDBIndex.__createInstance = function (store, indexProperties) {
    function IDBIndex() {
        var me = this;
        me[Symbol.toStringTag] = 'IDBIndex';
        util.defineReadonlyProperties(me, readonlyProperties);
        me.__objectStore = store;
        me.__name = me.__originalName = indexProperties.columnName;
        me.__keyPath = Array.isArray(indexProperties.keyPath) ? indexProperties.keyPath.slice() : indexProperties.keyPath;
        var optionalParams = indexProperties.optionalParams;
        me.__multiEntry = Boolean(optionalParams && optionalParams.multiEntry);
        me.__unique = Boolean(optionalParams && optionalParams.unique);
        me.__deleted = Boolean(indexProperties.__deleted);
        me.__objectStore.__cursors = indexProperties.cursors || [];
        Object.defineProperty(me, '__currentName', {
            get: function () {
                return '__pendingName' in me ? me.__pendingName : me.name;
            }
        });
        Object.defineProperty(me, 'name', {
            enumerable: false,
            configurable: false,
            get: function () {
                return this.__name;
            },
            set: function (newName) {
                var me = this;
                newName = util.convertToDOMString(newName);
                var oldName = me.name;
                IDBTransaction.__assertVersionChange(me.objectStore.transaction);
                IDBTransaction.__assertActive(me.objectStore.transaction);
                IDBIndexAlias.__invalidStateIfDeleted(me);
                IDBObjectStore.__invalidStateIfDeleted(me);
                if (newName === oldName) {
                    return;
                }
                if (me.objectStore.__indexes[newName] && !me.objectStore.__indexes[newName].__deleted &&
                    !me.objectStore.__indexes[newName].__pendingDelete) {
                    throw createDOMException('ConstraintError', 'Index "' + newName + '" already exists on ' + me.objectStore.__currentName);
                }
                me.__name = newName;
                var objectStore = me.objectStore;
                delete objectStore.__indexes[oldName];
                objectStore.__indexes[newName] = me;
                objectStore.indexNames.splice(objectStore.indexNames.indexOf(oldName), 1, newName);
                var storeHandle = objectStore.transaction.__storeHandles[objectStore.name];
                var oldIndexHandle = storeHandle.__indexHandles[oldName];
                oldIndexHandle.__name = newName; // Fix old references
                storeHandle.__indexHandles[newName] = oldIndexHandle; // Ensure new reference accessible
                me.__pendingName = oldName;
                var colInfoToPreserveArr = [
                    ['key', 'BLOB ' + (objectStore.autoIncrement ? 'UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY')],
                    ['value', 'BLOB']
                ].concat(__spreadArray([], objectStore.indexNames, true).filter(function (indexName) { return indexName !== newName; })
                    .map(function (indexName) { return [util.escapeIndexNameForSQL(indexName), 'BLOB']; }));
                me.__renameIndex(objectStore, oldName, newName, colInfoToPreserveArr, function (tx, success) {
                    IDBIndexAlias.__updateIndexList(store, tx, function (store) {
                        delete storeHandle.__pendingName;
                        success(store);
                    });
                });
            }
        });
    }
    IDBIndex.prototype = IDBIndexAlias.prototype;
    return new IDBIndex();
};
IDBIndex.__invalidStateIfDeleted = function (index, msg) {
    if (index.__deleted || index.__pendingDelete || (index.__pendingCreate && index.objectStore.transaction && index.objectStore.transaction.__errored)) {
        throw createDOMException('InvalidStateError', msg || 'This index has been deleted');
    }
};
/**
 * Clones an IDBIndex instance for a different IDBObjectStore instance.
 * @param {IDBIndex} index
 * @param {IDBObjectStore} store
 * @protected
 */
IDBIndex.__clone = function (index, store) {
    var idx = IDBIndex.__createInstance(store, {
        columnName: index.name,
        keyPath: index.keyPath,
        optionalParams: {
            multiEntry: index.multiEntry,
            unique: index.unique
        }
    });
    ['__pendingCreate', '__pendingDelete', '__deleted', '__originalName', '__recreated'].forEach(function (p) {
        idx[p] = index[p];
    });
    return idx;
};
/**
 * Creates a new index on an object store.
 * @param {IDBObjectStore} store
 * @param {IDBIndex} index
 * @returns {IDBIndex}
 * @protected
 */
IDBIndex.__createIndex = function (store, index) {
    var indexName = index.name;
    var storeName = store.__currentName;
    var idx = store.__indexes[indexName];
    index.__pendingCreate = true;
    // Add the index to the IDBObjectStore
    store.indexNames.push(indexName);
    store.__indexes[indexName] = index; // We add to indexes as needs to be available, e.g., if there is a subsequent deleteIndex call
    var indexHandle = store.__indexHandles[indexName];
    if (!indexHandle ||
        index.__pendingDelete ||
        index.__deleted ||
        indexHandle.__pendingDelete ||
        indexHandle.__deleted) {
        indexHandle = store.__indexHandles[indexName] = IDBIndex.__clone(index, store);
    }
    // Create the index in WebSQL
    var transaction = store.transaction;
    transaction.__addNonRequestToTransactionQueue(function createIndex(tx, args, success, failure) {
        var columnExists = idx && (idx.__deleted || idx.__recreated); // This check must occur here rather than earlier as properties may not have been set yet otherwise
        var indexValues = {};
        function error(tx, err) {
            failure(createDOMException('UnknownError', 'Could not create index "' + indexName + '"' + err.code + '::' + err.message, err));
        }
        function applyIndex(tx) {
            // Update the object store's index list
            IDBIndex.__updateIndexList(store, tx, function () {
                // Add index entries for all existing records
                tx.executeSql('SELECT "key", "value" FROM ' + util.escapeStoreNameForSQL(storeName), [], function (tx, data) {
                    CFG.DEBUG && console.log('Adding existing ' + storeName + ' records to the ' + indexName + ' index');
                    addIndexEntry(0);
                    function addIndexEntry(i) {
                        if (i < data.rows.length) {
                            try {
                                var value = Sca.decode(util.unescapeSQLiteResponse(data.rows.item(i).value));
                                var indexKey = Key.extractKeyValueDecodedFromValueUsingKeyPath(value, index.keyPath, index.multiEntry); // Todo: Do we need this stricter error checking?
                                if (indexKey.invalid || indexKey.failure) { // Todo: Do we need invalid checks and should we instead treat these as being duplicates?
                                    throw new Error('Go to catch; ignore bad indexKey');
                                }
                                indexKey = Key.encode(indexKey.value, index.multiEntry);
                                if (index.unique) {
                                    if (indexValues[indexKey]) {
                                        indexValues = {};
                                        failure(createDOMException('ConstraintError', 'Duplicate values already exist within the store'));
                                        return;
                                    }
                                    indexValues[indexKey] = true;
                                }
                                tx.executeSql('UPDATE ' + util.escapeStoreNameForSQL(storeName) + ' SET ' +
                                    util.escapeIndexNameForSQL(indexName) + ' = ? WHERE "key" = ?', [util.escapeSQLiteStatement(indexKey), data.rows.item(i).key], function (tx, data) {
                                    addIndexEntry(i + 1);
                                }, error);
                            }
                            catch (e) {
                                // Not a valid value to insert into index, so just continue
                                addIndexEntry(i + 1);
                            }
                        }
                        else {
                            delete index.__pendingCreate;
                            delete indexHandle.__pendingCreate;
                            if (index.__deleted) {
                                delete index.__deleted;
                                delete indexHandle.__deleted;
                                index.__recreated = true;
                                indexHandle.__recreated = true;
                            }
                            indexValues = {};
                            success(store);
                        }
                    }
                }, error);
            }, error);
        }
        var escapedStoreNameSQL = util.escapeStoreNameForSQL(storeName);
        var escapedIndexNameSQL = util.escapeIndexNameForSQL(index.name);
        function addIndexSQL(tx) {
            if (!CFG.useSQLiteIndexes) {
                applyIndex(tx);
                return;
            }
            tx.executeSql('CREATE INDEX IF NOT EXISTS "' +
                // The escaped index name must be unique among indexes in the whole database;
                //    so we prefix with store name; as prefixed, will also not conflict with
                //    index on `key`
                // Avoid quotes and separate with special escape sequence
                escapedStoreNameSQL.slice(1, -1) + '^5' + escapedIndexNameSQL.slice(1, -1) +
                '" ON ' + escapedStoreNameSQL + '(' + escapedIndexNameSQL + ')', [], applyIndex, error);
        }
        if (columnExists) {
            // For a previously existing index, just update the index entries in the existing column;
            //   no need to add SQLite index to it either as should already exist
            applyIndex(tx);
        }
        else {
            // For a new index, add a new column to the object store, then apply the index
            var sql = ['ALTER TABLE', escapedStoreNameSQL, 'ADD', escapedIndexNameSQL, 'BLOB'].join(' ');
            CFG.DEBUG && console.log(sql);
            tx.executeSql(sql, [], addIndexSQL, error);
        }
    }, undefined, store);
};
/**
 * Deletes an index from an object store.
 * @param {IDBObjectStore} store
 * @param {IDBIndex} index
 * @protected
 */
IDBIndex.__deleteIndex = function (store, index) {
    // Remove the index from the IDBObjectStore
    index.__pendingDelete = true;
    var indexHandle = store.__indexHandles[index.name];
    if (indexHandle) {
        indexHandle.__pendingDelete = true;
    }
    store.indexNames.splice(store.indexNames.indexOf(index.name), 1);
    // Remove the index in WebSQL
    var transaction = store.transaction;
    transaction.__addNonRequestToTransactionQueue(function deleteIndex(tx, args, success, failure) {
        function error(tx, err) {
            failure(createDOMException('UnknownError', 'Could not delete index "' + index.name + '"', err));
        }
        function finishDeleteIndex() {
            // Update the object store's index list
            IDBIndex.__updateIndexList(store, tx, function (store) {
                delete index.__pendingDelete;
                delete index.__recreated;
                index.__deleted = true;
                if (indexHandle) {
                    indexHandle.__deleted = true;
                    delete indexHandle.__pendingDelete;
                }
                success(store);
            }, error);
        }
        if (!CFG.useSQLiteIndexes) {
            finishDeleteIndex();
            return;
        }
        tx.executeSql('DROP INDEX IF EXISTS ' +
            util.sqlQuote(util.escapeStoreNameForSQL(store.name).slice(1, -1) + '^5' +
                util.escapeIndexNameForSQL(index.name).slice(1, -1)), [], finishDeleteIndex, error);
    }, undefined, store);
};
/**
 * Updates index list for the given object store.
 * @param {IDBObjectStore} store
 * @param {object} tx
 * @param {function} success
 * @param {function} failure
 */
IDBIndex.__updateIndexList = function (store, tx, success, failure) {
    var indexList = {};
    for (var i = 0; i < store.indexNames.length; i++) {
        var idx = store.__indexes[store.indexNames[i]];
        /** @type {IDBIndexProperties} **/
        indexList[idx.name] = {
            columnName: idx.name,
            keyPath: idx.keyPath,
            optionalParams: {
                unique: idx.unique,
                multiEntry: idx.multiEntry
            },
            deleted: Boolean(idx.deleted)
        };
    }
    CFG.DEBUG && console.log('Updating the index list for ' + store.__currentName, indexList);
    tx.executeSql('UPDATE __sys__ SET "indexList" = ? WHERE "name" = ?', [JSON.stringify(indexList), util.escapeSQLiteStatement(store.__currentName)], function () {
        success(store);
    }, failure);
};
/**
 * Retrieves index data for the given key
 * @param {*|IDBKeyRange} range
 * @param {string} opType
 * @param {boolean} nullDisallowed
 * @param {number} count
 * @returns {IDBRequest}
 * @private
 */
IDBIndex.prototype.__fetchIndexData = function (range, opType, nullDisallowed, count) {
    var me = this;
    if (count !== undefined) {
        count = util.enforceRange(count, 'unsigned long');
    }
    IDBIndex.__invalidStateIfDeleted(me);
    IDBObjectStore.__invalidStateIfDeleted(me.objectStore);
    if (me.objectStore.__deleted) {
        throw createDOMException('InvalidStateError', "This index's object store has been deleted");
    }
    IDBTransaction.__assertActive(me.objectStore.transaction);
    if (nullDisallowed && util.isNullish(range)) {
        throw createDOMException('DataError', 'No key or range was specified');
    }
    var fetchArgs = buildFetchIndexDataSQL(nullDisallowed, me, range, opType, false);
    return me.objectStore.transaction.__addToTransactionQueue(function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        executeFetchIndexData.apply(void 0, __spreadArray(__spreadArray([count], fetchArgs, false), args, false));
    }, undefined, me);
};
/**
 * Opens a cursor over the given key range.
 * @param {*|IDBKeyRange} query
 * @param {string} direction
 * @returns {IDBRequest}
 */
IDBIndex.prototype.openCursor = function ( /* query, direction */) {
    var me = this;
    var query = arguments[0], direction = arguments[1];
    var cursor = IDBCursorWithValue.__createInstance(query, direction, me.objectStore, me, util.escapeIndexNameForSQLKeyColumn(me.name), 'value');
    me.__objectStore.__cursors.push(cursor);
    return cursor.__req;
};
/**
 * Opens a cursor over the given key range.  The cursor only includes key values, not data.
 * @param {*|IDBKeyRange} query
 * @param {string} direction
 * @returns {IDBRequest}
 */
IDBIndex.prototype.openKeyCursor = function ( /* query, direction */) {
    var me = this;
    var query = arguments[0], direction = arguments[1];
    var cursor = IDBCursor.__createInstance(query, direction, me.objectStore, me, util.escapeIndexNameForSQLKeyColumn(me.name), 'key');
    me.__objectStore.__cursors.push(cursor);
    return cursor.__req;
};
IDBIndex.prototype.get = function (query) {
    if (!arguments.length) { // Per https://heycam.github.io/webidl/
        throw new TypeError('A parameter was missing for `IDBIndex.get`.');
    }
    return this.__fetchIndexData(query, 'value', true);
};
IDBIndex.prototype.getKey = function (query) {
    if (!arguments.length) { // Per https://heycam.github.io/webidl/
        throw new TypeError('A parameter was missing for `IDBIndex.getKey`.');
    }
    return this.__fetchIndexData(query, 'key', true);
};
IDBIndex.prototype.getAll = function ( /* query, count */) {
    var query = arguments[0], count = arguments[1];
    return this.__fetchIndexData(query, 'value', false, count);
};
IDBIndex.prototype.getAllKeys = function ( /* query, count */) {
    var query = arguments[0], count = arguments[1];
    return this.__fetchIndexData(query, 'key', false, count);
};
IDBIndex.prototype.count = function ( /* query */) {
    var me = this;
    var query = arguments[0];
    // With the exception of needing to check whether the index has been
    //  deleted, we could, for greater spec parity (if not accuracy),
    //  just call:
    //  `return me.__objectStore.count(query);`
    if (util.instanceOf(query, IDBKeyRange)) { // Todo: Do we need this block?
        // We don't need to add to cursors array since has the count parameter which won't cache
        return IDBCursorWithValue.__createInstance(query, 'next', me.objectStore, me, util.escapeIndexNameForSQLKeyColumn(me.name), 'value', true).__req;
    }
    return me.__fetchIndexData(query, 'count', false);
};
IDBIndex.prototype.__renameIndex = function (store, oldName, newName, colInfoToPreserveArr, cb) {
    if (colInfoToPreserveArr === void 0) { colInfoToPreserveArr = []; }
    if (cb === void 0) { cb = null; }
    var newNameType = 'BLOB';
    var storeName = store.__currentName;
    var escapedStoreNameSQL = util.escapeStoreNameForSQL(storeName);
    var escapedNewIndexNameSQL = util.escapeIndexNameForSQL(newName);
    var escapedTmpStoreNameSQL = util.sqlQuote('tmp_' + util.escapeStoreNameForSQL(storeName).slice(1, -1));
    var colNamesToPreserve = colInfoToPreserveArr.map(function (colInfo) { return colInfo[0]; });
    var colInfoToPreserve = colInfoToPreserveArr.map(function (colInfo) { return colInfo.join(' '); });
    var listColInfoToPreserve = (colInfoToPreserve.length ? (colInfoToPreserve.join(', ') + ', ') : '');
    var listColsToPreserve = (colNamesToPreserve.length ? (colNamesToPreserve.join(', ') + ', ') : '');
    // We could adapt the approach at http://stackoverflow.com/a/8430746/271577
    //    to make the approach reusable without passing column names, but it is a bit fragile
    store.transaction.__addNonRequestToTransactionQueue(function renameIndex(tx, args, success, error) {
        function sqlError(tx, err) {
            error(err);
        }
        function finish() {
            if (cb) {
                cb(tx, success);
                return;
            }
            success();
        }
        // See https://www.sqlite.org/lang_altertable.html#otheralter
        // We don't query for indexes as we already have the info
        // This approach has the advantage of auto-deleting indexes via the DROP TABLE
        var sql = 'CREATE TABLE ' + escapedTmpStoreNameSQL +
            '(' + listColInfoToPreserve + escapedNewIndexNameSQL + ' ' + newNameType + ')';
        CFG.DEBUG && console.log(sql);
        tx.executeSql(sql, [], function () {
            var sql = 'INSERT INTO ' + escapedTmpStoreNameSQL + '(' +
                listColsToPreserve + escapedNewIndexNameSQL +
                ') SELECT ' + listColsToPreserve + util.escapeIndexNameForSQL(oldName) + ' FROM ' + escapedStoreNameSQL;
            CFG.DEBUG && console.log(sql);
            tx.executeSql(sql, [], function () {
                var sql = 'DROP TABLE ' + escapedStoreNameSQL;
                CFG.DEBUG && console.log(sql);
                tx.executeSql(sql, [], function () {
                    var sql = 'ALTER TABLE ' + escapedTmpStoreNameSQL + ' RENAME TO ' + escapedStoreNameSQL;
                    CFG.DEBUG && console.log(sql);
                    tx.executeSql(sql, [], function (tx, data) {
                        if (!CFG.useSQLiteIndexes) {
                            finish();
                            return;
                        }
                        var indexCreations = colNamesToPreserve
                            .slice(2) // Doing `key` separately and no need for index on `value`
                            .map(function (escapedIndexNameSQL) { return new SyncPromise(function (resolve, reject) {
                            var escapedIndexToRecreate = util.sqlQuote(escapedStoreNameSQL.slice(1, -1) + '^5' + escapedIndexNameSQL.slice(1, -1));
                            // const sql = 'DROP INDEX IF EXISTS ' + escapedIndexToRecreate;
                            // CFG.DEBUG && console.log(sql);
                            // tx.executeSql(sql, [], function () {
                            var sql = 'CREATE INDEX ' +
                                escapedIndexToRecreate + ' ON ' + escapedStoreNameSQL + '(' + escapedIndexNameSQL + ')';
                            CFG.DEBUG && console.log(sql);
                            tx.executeSql(sql, [], resolve, function (tx, err) {
                                reject(err);
                            });
                            // }, function (tx, err) {
                            //    reject(err);
                            // });
                        }); });
                        indexCreations.push(new SyncPromise(function (resolve, reject) {
                            var escapedIndexToRecreate = util.sqlQuote('sk_' + escapedStoreNameSQL.slice(1, -1));
                            // Chrome erring here if not dropped first; Node does not
                            var sql = 'DROP INDEX IF EXISTS ' + escapedIndexToRecreate;
                            CFG.DEBUG && console.log(sql);
                            tx.executeSql(sql, [], function () {
                                var sql = 'CREATE INDEX ' + escapedIndexToRecreate +
                                    ' ON ' + escapedStoreNameSQL + '("key")';
                                CFG.DEBUG && console.log(sql);
                                tx.executeSql(sql, [], resolve, function (tx, err) {
                                    reject(err);
                                });
                            }, function (tx, err) {
                                reject(err);
                            });
                        }));
                        SyncPromise.all(indexCreations).then(finish, error).catch(function (err) {
                            console.log('Index rename error');
                            throw err;
                        });
                    }, sqlError);
                }, sqlError);
            }, sqlError);
        }, sqlError);
    });
};
Object.defineProperty(IDBIndex, Symbol.hasInstance, {
    value: function (obj) { return util.isObj(obj) && typeof obj.openCursor === 'function' && typeof obj.multiEntry === 'boolean'; }
});
util.defineReadonlyOuterInterface(IDBIndex.prototype, readonlyProperties);
util.defineOuterInterface(IDBIndex.prototype, ['name']);
IDBIndex.prototype[Symbol.toStringTag] = 'IDBIndexPrototype';
Object.defineProperty(IDBIndex, 'prototype', {
    writable: false
});
function executeFetchIndexData(count, unboundedDisallowed, index, hasKey, range, opType, multiChecks, sql, sqlValues, tx, args, success, error) {
    if (unboundedDisallowed) {
        count = 1;
    }
    if (count) {
        sql.push('LIMIT', count);
    }
    var isCount = opType === 'count';
    CFG.DEBUG && console.log('Trying to fetch data for Index', sql.join(' '), sqlValues);
    tx.executeSql(sql.join(' '), sqlValues, function (tx, data) {
        var records = [];
        var recordCount = 0;
        var decode = isCount ? function () { } : (opType === 'key' ? function (record) {
            // Key.convertValueToKey(record.key); // Already validated before storage
            return Key.decode(util.unescapeSQLiteResponse(record.key));
        } : function (record) {
            return Sca.decode(util.unescapeSQLiteResponse(record.value));
        });
        if (index.multiEntry) {
            var escapedIndexNameForKeyCol = util.escapeIndexNameForSQLKeyColumn(index.name);
            var encodedKey = Key.encode(range, index.multiEntry);
            var _loop_1 = function (i) {
                var row = data.rows.item(i);
                var rowKey = Key.decode(row[escapedIndexNameForKeyCol]);
                var record = void 0;
                if (hasKey && ((multiChecks && range.some(function (check) { return rowKey.includes(check); })) || // More precise than our SQL
                    Key.isMultiEntryMatch(encodedKey, row[escapedIndexNameForKeyCol]))) {
                    recordCount++;
                    record = row;
                }
                else if (!hasKey && !multiChecks) {
                    if (rowKey !== undefined) {
                        recordCount += (Array.isArray(rowKey) ? rowKey.length : 1);
                        record = row;
                    }
                }
                if (record) {
                    records.push(decode(record));
                    if (unboundedDisallowed) {
                        return "break";
                    }
                }
            };
            for (var i = 0; i < data.rows.length; i++) {
                var state_1 = _loop_1(i);
                if (state_1 === "break")
                    break;
            }
        }
        else {
            for (var i = 0; i < data.rows.length; i++) {
                var record = data.rows.item(i);
                if (record) {
                    records.push(decode(record));
                }
            }
            recordCount = records.length;
        }
        if (isCount) {
            success(recordCount);
        }
        else if (recordCount === 0) {
            success(unboundedDisallowed ? undefined : []);
        }
        else {
            success(unboundedDisallowed ? records[0] : records);
        }
    }, error);
}
function buildFetchIndexDataSQL(nullDisallowed, index, range, opType, multiChecks) {
    var hasRange = nullDisallowed || !util.isNullish(range);
    var col = opType === 'count' ? 'key' : opType; // It doesn't matter which column we use for 'count' as long as it is valid
    var sql = [
        'SELECT', util.sqlQuote(col) + (index.multiEntry ? ', ' + util.escapeIndexNameForSQL(index.name) : ''),
        'FROM', util.escapeStoreNameForSQL(index.objectStore.__currentName),
        'WHERE', util.escapeIndexNameForSQL(index.name), 'NOT NULL'
    ];
    var sqlValues = [];
    if (hasRange) {
        if (multiChecks) {
            sql.push('AND (');
            range.forEach(function (innerKey, i) {
                if (i > 0)
                    sql.push('OR');
                sql.push(util.escapeIndexNameForSQL(index.name), "LIKE ? ESCAPE '^' ");
                sqlValues.push('%' + util.sqlLIKEEscape(Key.encode(innerKey, index.multiEntry)) + '%');
            });
            sql.push(')');
        }
        else if (index.multiEntry) {
            sql.push('AND', util.escapeIndexNameForSQL(index.name), "LIKE ? ESCAPE '^'");
            sqlValues.push('%' + util.sqlLIKEEscape(Key.encode(range, index.multiEntry)) + '%');
        }
        else {
            var convertedRange = convertValueToKeyRange(range, nullDisallowed);
            setSQLForKeyRange(convertedRange, util.escapeIndexNameForSQL(index.name), sql, sqlValues, true, false);
        }
    }
    return [nullDisallowed, index, hasRange, range, opType, multiChecks, sql, sqlValues];
}
export { buildFetchIndexDataSQL, executeFetchIndexData, IDBIndex, IDBIndex as default };
