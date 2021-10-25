"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var sync_promise_1 = require("sync-promise");
var DOMException_js_1 = require("./DOMException.js");
var IDBCursor_js_1 = require("./IDBCursor.js");
var IDBKeyRange_js_1 = require("./IDBKeyRange.js");
var DOMStringList_js_1 = require("./DOMStringList.js");
var util = require("./util.js");
var Key = require("./Key.js");
var IDBIndex_js_1 = require("./IDBIndex.js");
var IDBTransaction_js_1 = require("./IDBTransaction.js");
var Sca = require("./Sca.js");
var CFG_js_1 = require("./CFG.js");
var readonlyProperties = ['keyPath', 'indexNames', 'transaction', 'autoIncrement'];
/* eslint-disable jsdoc/check-param-names */
/**
 * IndexedDB Object Store.
 * @see http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBObjectStore
 * @param {IDBObjectStoreProperties} storeProperties
 * @param {IDBTransaction} transaction
 * @class
 */
function IDBObjectStore() {
    /* eslint-enable jsdoc/check-param-names */
    throw new TypeError('Illegal constructor');
}
var IDBObjectStoreAlias = IDBObjectStore;
IDBObjectStore.__createInstance = function (storeProperties, transaction) {
    function IDBObjectStore() {
        var me = this;
        me[Symbol.toStringTag] = 'IDBObjectStore';
        util.defineReadonlyProperties(this, readonlyProperties);
        me.__name = me.__originalName = storeProperties.name;
        me.__keyPath = Array.isArray(storeProperties.keyPath) ? storeProperties.keyPath.slice() : storeProperties.keyPath;
        me.__transaction = transaction;
        me.__idbdb = storeProperties.idbdb;
        me.__cursors = storeProperties.cursors || [];
        // autoInc is numeric (0/1) on WinPhone
        me.__autoIncrement = Boolean(storeProperties.autoInc);
        me.__indexes = {};
        me.__indexHandles = {};
        me.__indexNames = DOMStringList_js_1.default.__createInstance();
        var indexList = storeProperties.indexList;
        for (var indexName in indexList) {
            if (util.hasOwn(indexList, indexName)) {
                var index = IDBIndex_js_1.IDBIndex.__createInstance(me, indexList[indexName]);
                me.__indexes[index.name] = index;
                if (!index.__deleted) {
                    me.indexNames.push(index.name);
                }
            }
        }
        me.__oldIndexNames = me.indexNames.clone();
        Object.defineProperty(this, '__currentName', {
            get: function () {
                return '__pendingName' in this ? this.__pendingName : this.name;
            }
        });
        Object.defineProperty(this, 'name', {
            enumerable: false,
            configurable: false,
            get: function () {
                return this.__name;
            },
            set: function (name) {
                var me = this;
                name = util.convertToDOMString(name);
                var oldName = me.name;
                IDBObjectStoreAlias.__invalidStateIfDeleted(me);
                IDBTransaction_js_1.default.__assertVersionChange(me.transaction);
                IDBTransaction_js_1.default.__assertActive(me.transaction);
                if (oldName === name) {
                    return;
                }
                if (me.__idbdb.__objectStores[name] && !me.__idbdb.__objectStores[name].__pendingDelete) {
                    throw (0, DOMException_js_1.createDOMException)('ConstraintError', 'Object store "' + name + '" already exists in ' + me.__idbdb.name);
                }
                me.__name = name;
                var oldStore = me.__idbdb.__objectStores[oldName];
                oldStore.__name = name; // Fix old references
                me.__idbdb.__objectStores[name] = oldStore; // Ensure new reference accessible
                delete me.__idbdb.__objectStores[oldName]; // Ensure won't be found
                me.__idbdb.objectStoreNames.splice(me.__idbdb.objectStoreNames.indexOf(oldName), 1, name);
                var oldHandle = me.transaction.__storeHandles[oldName];
                oldHandle.__name = name; // Fix old references
                me.transaction.__storeHandles[name] = oldHandle; // Ensure new reference accessible
                me.__pendingName = oldName;
                var sql = 'UPDATE __sys__ SET "name" = ? WHERE "name" = ?';
                var sqlValues = [util.escapeSQLiteStatement(name), util.escapeSQLiteStatement(oldName)];
                CFG_js_1.default.DEBUG && console.log(sql, sqlValues);
                me.transaction.__addNonRequestToTransactionQueue(function objectStoreClear(tx, args, success, error) {
                    tx.executeSql(sql, sqlValues, function (tx, data) {
                        // This SQL preserves indexes per https://www.sqlite.org/lang_altertable.html
                        var sql = 'ALTER TABLE ' + util.escapeStoreNameForSQL(oldName) + ' RENAME TO ' + util.escapeStoreNameForSQL(name);
                        CFG_js_1.default.DEBUG && console.log(sql);
                        tx.executeSql(sql, [], function (tx, data) {
                            delete me.__pendingName;
                            success();
                        });
                    }, function (tx, err) {
                        error(err);
                    });
                });
            }
        });
    }
    IDBObjectStore.prototype = IDBObjectStoreAlias.prototype;
    return new IDBObjectStore();
};
/**
 * Clones an IDBObjectStore instance for a different IDBTransaction instance.
 * @param {IDBObjectStore} store
 * @param {IDBTransaction} transaction
 * @protected
 * @returns {IDBObjectStore}
 */
IDBObjectStore.__clone = function (store, transaction) {
    var newStore = IDBObjectStore.__createInstance({
        name: store.__currentName,
        keyPath: Array.isArray(store.keyPath) ? store.keyPath.slice() : store.keyPath,
        autoInc: store.autoIncrement,
        indexList: {},
        idbdb: store.__idbdb,
        cursors: store.__cursors
    }, transaction);
    ['__indexes', '__indexNames', '__oldIndexNames', '__deleted', '__pendingDelete', '__pendingCreate', '__originalName'].forEach(function (p) {
        newStore[p] = store[p];
    });
    return newStore;
};
IDBObjectStore.__invalidStateIfDeleted = function (store, msg) {
    if (store.__deleted || store.__pendingDelete || (store.__pendingCreate && (store.transaction && store.transaction.__errored))) {
        throw (0, DOMException_js_1.createDOMException)('InvalidStateError', msg || 'This store has been deleted');
    }
};
/**
 * Creates a new object store in the database.
 * @param {IDBDatabase} db
 * @param {IDBObjectStore} store
 * @protected
 * @returns {IDBObjectStore}
 */
IDBObjectStore.__createObjectStore = function (db, store) {
    // Add the object store to the IDBDatabase
    var storeName = store.__currentName;
    store.__pendingCreate = true;
    db.__objectStores[storeName] = store;
    db.objectStoreNames.push(storeName);
    // Add the object store to WebSQL
    var transaction = db.__versionTransaction;
    var storeHandles = transaction.__storeHandles;
    if (!storeHandles[storeName] ||
        // These latter conditions are to allow store
        //   recreation to create new clone object
        storeHandles[storeName].__pendingDelete ||
        storeHandles[storeName].__deleted) {
        storeHandles[storeName] = IDBObjectStore.__clone(store, transaction);
    }
    transaction.__addNonRequestToTransactionQueue(function createObjectStore(tx, args, success, failure) {
        function error(tx, err) {
            CFG_js_1.default.DEBUG && console.log(err);
            failure((0, DOMException_js_1.createDOMException)('UnknownError', 'Could not create object store "' + storeName + '"', err));
        }
        var escapedStoreNameSQL = util.escapeStoreNameForSQL(storeName);
        // key INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE
        var sql = ['CREATE TABLE', escapedStoreNameSQL, '(key BLOB', store.autoIncrement ? 'UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY', ', value BLOB)'].join(' ');
        CFG_js_1.default.DEBUG && console.log(sql);
        tx.executeSql(sql, [], function (tx, data) {
            function insertStoreInfo() {
                var encodedKeyPath = JSON.stringify(store.keyPath);
                tx.executeSql('INSERT INTO __sys__ VALUES (?,?,?,?,?)', [
                    util.escapeSQLiteStatement(storeName),
                    encodedKeyPath,
                    // For why converting here, see comment and following
                    //  discussion at:
                    //  https://github.com/axemclion/IndexedDBShim/issues/313#issuecomment-590086778
                    Number(store.autoIncrement),
                    '{}',
                    1
                ], function () {
                    delete store.__pendingCreate;
                    delete store.__deleted;
                    success(store);
                }, error);
            }
            if (!CFG_js_1.default.useSQLiteIndexes) {
                insertStoreInfo();
                return;
            }
            tx.executeSql('CREATE INDEX IF NOT EXISTS ' + (util.sqlQuote('sk_' + escapedStoreNameSQL.slice(1, -1))) + ' ON ' + escapedStoreNameSQL + '("key")', [], insertStoreInfo, error);
        }, error);
    });
    return storeHandles[storeName];
};
/**
 * Deletes an object store from the database.
 * @param {IDBDatabase} db
 * @param {IDBObjectStore} store
 * @protected
 * @returns {void}
 */
IDBObjectStore.__deleteObjectStore = function (db, store) {
    // Remove the object store from the IDBDatabase
    store.__pendingDelete = true;
    // We don't delete the other index holders in case need reversion
    store.__indexNames = DOMStringList_js_1.default.__createInstance();
    db.objectStoreNames.splice(db.objectStoreNames.indexOf(store.__currentName), 1);
    var storeHandle = db.__versionTransaction.__storeHandles[store.__currentName];
    if (storeHandle) {
        storeHandle.__indexNames = DOMStringList_js_1.default.__createInstance();
        storeHandle.__pendingDelete = true;
    }
    // Remove the object store from WebSQL
    var transaction = db.__versionTransaction;
    transaction.__addNonRequestToTransactionQueue(function deleteObjectStore(tx, args, success, failure) {
        function error(tx, err) {
            CFG_js_1.default.DEBUG && console.log(err);
            failure((0, DOMException_js_1.createDOMException)('UnknownError', 'Could not delete ObjectStore', err));
        }
        tx.executeSql('SELECT "name" FROM __sys__ WHERE "name" = ?', [util.escapeSQLiteStatement(store.__currentName)], function (tx, data) {
            if (data.rows.length > 0) {
                tx.executeSql('DROP TABLE ' + util.escapeStoreNameForSQL(store.__currentName), [], function () {
                    tx.executeSql('DELETE FROM __sys__ WHERE "name" = ?', [util.escapeSQLiteStatement(store.__currentName)], function () {
                        delete store.__pendingDelete;
                        store.__deleted = true;
                        if (storeHandle) {
                            delete storeHandle.__pendingDelete;
                            storeHandle.__deleted = true;
                        }
                        success();
                    }, error);
                }, error);
            }
        });
    });
};
/**
* @typedef {GenericArray} KeyValueArray
* @property {module:Key.Key} 0
* @property {*} 1
*/
// Todo: Although we may end up needing to do cloning genuinely asynchronously (for Blobs and FileLists),
//   and we'll want to ensure the queue starts up synchronously, we nevertheless do the cloning
//   before entering the queue and its callback since the encoding we do is preceded by validation
//   which we must do synchronously anyways. If we reimplement Blobs and FileLists asynchronously,
//   we can detect these types (though validating synchronously as possible) and once entering the
//   queue callback, ensure they load before triggering success or failure (perhaps by returning and
//   a `SyncPromise` from the `Sca.clone` operation and later detecting and ensuring it is resolved
//   before continuing).
/**
 * Determines whether the given inline or out-of-line key is valid,
 *   according to the object store's schema.
 * @param {*} value Used for inline keys
 * @param {*} key Used for out-of-line keys
 * @param {boolean} cursorUpdate
 * @throws {DOMException}
 * @returns {KeyValueArray}
 * @private
 */
IDBObjectStore.prototype.__validateKeyAndValueAndCloneValue = function (value, key, cursorUpdate) {
    var me = this;
    if (me.keyPath !== null) {
        if (key !== undefined) {
            throw (0, DOMException_js_1.createDOMException)('DataError', 'The object store uses in-line keys and the key parameter was provided', me);
        }
        // Todo Binary: Avoid blobs loading async to ensure cloning (and errors therein)
        //   occurs sync; then can make cloning and this method without callbacks (except where ok
        //   to be async)
        var clonedValue_1 = Sca.clone(value);
        key = Key.extractKeyValueDecodedFromValueUsingKeyPath(clonedValue_1, me.keyPath); // May throw so "rethrow"
        if (key.invalid) {
            throw (0, DOMException_js_1.createDOMException)('DataError', 'KeyPath was specified, but key was invalid.');
        }
        if (key.failure) {
            if (!cursorUpdate) {
                if (!me.autoIncrement) {
                    throw (0, DOMException_js_1.createDOMException)('DataError', 'Could not evaluate a key from keyPath and there is no key generator');
                }
                if (!Key.checkKeyCouldBeInjectedIntoValue(clonedValue_1, me.keyPath)) {
                    throw (0, DOMException_js_1.createDOMException)('DataError', 'A key could not be injected into a value');
                }
                // A key will be generated
                return [undefined, clonedValue_1];
            }
            throw (0, DOMException_js_1.createDOMException)('DataError', 'Could not evaluate a key from keyPath');
        }
        // An `IDBCursor.update` call will also throw if not equal to the cursor’s effective key
        return [key.value, clonedValue_1];
    }
    if (key === undefined) {
        if (!me.autoIncrement) {
            throw (0, DOMException_js_1.createDOMException)('DataError', 'The object store uses out-of-line keys and has no key generator and the key parameter was not provided.', me);
        }
        // A key will be generated
        key = undefined;
    }
    else {
        Key.convertValueToKeyRethrowingAndIfInvalid(key);
    }
    var clonedValue = Sca.clone(value);
    return [key, clonedValue];
};
/**
 * From the store properties and object, extracts the value for the key in
 *   the object store
 * If the table has auto increment, get the current number (unless it has
 *   a keyPath leading to a valid but non-numeric or < 1 key).
 * @param {Object} tx
 * @param {Object} value
 * @param {Object} key
 * @param {function} success
 * @param {function} failCb
 * @returns {void}
 */
IDBObjectStore.prototype.__deriveKey = function (tx, value, key, success, failCb) {
    var me = this;
    // Only run if cloning is needed
    function keyCloneThenSuccess(oldCn) {
        Sca.encode(key, function (key) {
            key = Sca.decode(key);
            success(key, oldCn);
        });
    }
    if (me.autoIncrement) {
        // If auto-increment and no valid primaryKey found on the keyPath, get and set the new value, and use
        if (key === undefined) {
            Key.generateKeyForStore(tx, me, function (failure, key, oldCn) {
                if (failure) {
                    failCb((0, DOMException_js_1.createDOMException)('ConstraintError', 'The key generator\'s current number has reached the maximum safe integer limit'));
                    return;
                }
                if (me.keyPath !== null) {
                    // Should not throw now as checked earlier
                    Key.injectKeyIntoValueUsingKeyPath(value, key, me.keyPath);
                }
                success(key, oldCn);
            }, failCb);
        }
        else {
            Key.possiblyUpdateKeyGenerator(tx, me, key, keyCloneThenSuccess, failCb);
        }
        // Not auto-increment
    }
    else {
        keyCloneThenSuccess();
    }
};
IDBObjectStore.prototype.__insertData = function (tx, encoded, value, clonedKeyOrCurrentNumber, oldCn, success, error) {
    var me = this;
    // The `ConstraintError` to occur for `add` upon a duplicate will occur naturally in attempting an insert
    // We process the index information first as it will stored in the same table as the store
    var paramMap = {};
    var indexPromises = Object.keys(
    // We do not iterate `indexNames` as those can be modified synchronously (e.g.,
    //   `deleteIndex` could, by its synchronous removal from `indexNames`, prevent
    //   iteration here of an index though per IndexedDB test
    //   `idbobjectstore_createIndex4-deleteIndex-event_order.js`, `createIndex`
    //   should be allowed to first fail even in such a case).
    me.__indexes).map(function (indexName) {
        // While this may sometimes resolve sync and sometimes async, the
        //   idea is to avoid, where possible, unnecessary delays (and
        //   consuming code ought to only see a difference in the browser
        //   where we can't control the transaction timeout anyways).
        return new sync_promise_1.default(function (resolve, reject) {
            var index = me.__indexes[indexName];
            if (
            // `createIndex` was called synchronously after the current insertion was added to
            //  the transaction queue so although it was added to `__indexes`, it is not yet
            //  ready to be checked here for the insertion as it will be when running the
            //  `createIndex` operation (e.g., if two items with the same key were added and
            //  *then* a unique index was created, it should not continue to err and abort
            //  yet, as we're still handling the insertions which must be processed (e.g., to
            //  add duplicates which then cause a unique index to fail))
            index.__pendingCreate ||
                // If already deleted (and not just slated for deletion (by `__pendingDelete`
                //  after this add), we avoid checks
                index.__deleted) {
                resolve();
                return;
            }
            var indexKey;
            try {
                indexKey = Key.extractKeyValueDecodedFromValueUsingKeyPath(value, index.keyPath, index.multiEntry); // Add as necessary to this and skip past this index if exceptions here)
                if (indexKey.invalid || indexKey.failure) {
                    throw new Error('Go to catch');
                }
            }
            catch (err) {
                resolve();
                return;
            }
            indexKey = indexKey.value;
            function setIndexInfo(index) {
                if (indexKey === undefined) {
                    return;
                }
                paramMap[index.__currentName] = Key.encode(indexKey, index.multiEntry);
            }
            if (index.unique) {
                var multiCheck_1 = index.multiEntry && Array.isArray(indexKey);
                var fetchArgs = (0, IDBIndex_js_1.buildFetchIndexDataSQL)(true, index, indexKey, 'key', multiCheck_1);
                IDBIndex_js_1.executeFetchIndexData.apply(void 0, __spreadArray(__spreadArray([null], fetchArgs, false), [tx, null, function success(key) {
                        if (key === undefined) {
                            setIndexInfo(index);
                            resolve();
                            return;
                        }
                        reject((0, DOMException_js_1.createDOMException)('ConstraintError', 'Index already contains a record equal to ' +
                            (multiCheck_1 ? 'one of the subkeys of' : '') +
                            '`indexKey`'));
                    }, reject], false));
            }
            else {
                setIndexInfo(index);
                resolve();
            }
        });
    });
    return sync_promise_1.default.all(indexPromises).then(function () {
        var sqlStart = ['INSERT INTO', util.escapeStoreNameForSQL(me.__currentName), '('];
        var sqlEnd = [' VALUES ('];
        var insertSqlValues = [];
        if (clonedKeyOrCurrentNumber !== undefined) {
            // Key.convertValueToKey(primaryKey); // Already run
            sqlStart.push(util.sqlQuote('key'), ',');
            sqlEnd.push('?,');
            insertSqlValues.push(util.escapeSQLiteStatement(Key.encode(clonedKeyOrCurrentNumber)));
        }
        Object.entries(paramMap).forEach(function (_a) {
            var key = _a[0], stmt = _a[1];
            sqlStart.push(util.escapeIndexNameForSQL(key) + ',');
            sqlEnd.push('?,');
            insertSqlValues.push(util.escapeSQLiteStatement(stmt));
        });
        // removing the trailing comma
        sqlStart.push(util.sqlQuote('value') + ' )');
        sqlEnd.push('?)');
        insertSqlValues.push(util.escapeSQLiteStatement(encoded));
        var insertSql = sqlStart.join(' ') + sqlEnd.join(' ');
        CFG_js_1.default.DEBUG && console.log('SQL for adding', insertSql, insertSqlValues);
        tx.executeSql(insertSql, insertSqlValues, function (tx, data) {
            success(clonedKeyOrCurrentNumber);
        }, function (tx, err) {
            // Should occur for `add` operation
            error((0, DOMException_js_1.createDOMException)('ConstraintError', err.message, err));
        });
        return undefined;
    }).catch(function (err) {
        function fail() {
            // Todo: Add a different error object here if `assignCurrentNumber`
            //  fails in reverting?
            error(err);
        }
        if (typeof oldCn === 'number') {
            Key.assignCurrentNumber(tx, me, oldCn, fail, fail);
            return;
        }
        fail();
    });
};
IDBObjectStore.prototype.add = function (value /* , key */) {
    var me = this;
    // eslint-disable-next-line prefer-rest-params
    var key = arguments[1];
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No value was specified');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    var request = me.transaction.__createRequest(me);
    var _a = me.__validateKeyAndValueAndCloneValue(value, key, false), ky = _a[0], clonedValue = _a[1];
    IDBObjectStore.__storingRecordObjectStore(request, me, true, clonedValue, true, ky);
    return request;
};
IDBObjectStore.prototype.put = function (value /*, key */) {
    var me = this;
    // eslint-disable-next-line prefer-rest-params
    var key = arguments[1];
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No value was specified');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    var request = me.transaction.__createRequest(me);
    var _a = me.__validateKeyAndValueAndCloneValue(value, key, false), ky = _a[0], clonedValue = _a[1];
    IDBObjectStore.__storingRecordObjectStore(request, me, true, clonedValue, false, ky);
    return request;
};
IDBObjectStore.prototype.__overwrite = function (tx, key, cb, error) {
    var me = this;
    // First try to delete if the record exists
    // Key.convertValueToKey(key); // Already run
    var sql = 'DELETE FROM ' + util.escapeStoreNameForSQL(me.__currentName) + ' WHERE "key" = ?';
    var encodedKey = Key.encode(key);
    tx.executeSql(sql, [util.escapeSQLiteStatement(encodedKey)], function (tx, data) {
        CFG_js_1.default.DEBUG && console.log('Did the row with the', key, 'exist?', data.rowsAffected);
        cb(tx);
    }, function (tx, err) {
        error(err);
    });
};
IDBObjectStore.__storingRecordObjectStore = function (request, store, invalidateCache, value, noOverwrite /* , key */) {
    // eslint-disable-next-line prefer-rest-params
    var key = arguments[5];
    store.transaction.__pushToQueue(request, function (tx, args, success, error) {
        store.__deriveKey(tx, value, key, function (clonedKeyOrCurrentNumber, oldCn) {
            Sca.encode(value, function (encoded) {
                function insert(tx) {
                    store.__insertData(tx, encoded, value, clonedKeyOrCurrentNumber, oldCn, function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        if (invalidateCache) {
                            store.__cursors.forEach(function (cursor) {
                                cursor.__invalidateCache();
                            });
                        }
                        success.apply(void 0, args);
                    }, error);
                }
                if (!noOverwrite) {
                    store.__overwrite(tx, clonedKeyOrCurrentNumber, insert, error);
                    return;
                }
                insert(tx);
            });
        }, error);
    });
};
IDBObjectStore.prototype.__get = function (query, getKey, getAll, count) {
    var me = this;
    if (count !== undefined) {
        count = util.enforceRange(count, 'unsigned long');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    var range = (0, IDBKeyRange_js_1.convertValueToKeyRange)(query, !getAll);
    var col = getKey ? 'key' : 'value';
    var sql = ['SELECT', util.sqlQuote(col), 'FROM', util.escapeStoreNameForSQL(me.__currentName)];
    var sqlValues = [];
    if (range !== undefined) {
        sql.push('WHERE');
        (0, IDBKeyRange_js_1.setSQLForKeyRange)(range, util.sqlQuote('key'), sql, sqlValues);
    }
    if (!getAll) {
        count = 1;
    }
    if (count) {
        if (!Number.isFinite(count)) {
            throw new TypeError('The count parameter must be a finite number');
        }
        sql.push('LIMIT', count);
    }
    sql = sql.join(' ');
    return me.transaction.__addToTransactionQueue(function objectStoreGet(tx, args, success, error) {
        CFG_js_1.default.DEBUG && console.log('Fetching', me.__currentName, sqlValues);
        tx.executeSql(sql, sqlValues, function (tx, data) {
            CFG_js_1.default.DEBUG && console.log('Fetched data', data);
            var ret;
            try {
                // Opera can't deal with the try-catch here.
                if (data.rows.length === 0) {
                    if (getAll) {
                        success([]);
                    }
                    else {
                        success();
                    }
                    return;
                }
                ret = [];
                if (getKey) {
                    for (var i = 0; i < data.rows.length; i++) {
                        // Key.convertValueToKey(data.rows.item(i).key); // Already validated before storage
                        ret.push(Key.decode(util.unescapeSQLiteResponse(data.rows.item(i).key), false));
                    }
                }
                else {
                    for (var i = 0; i < data.rows.length; i++) {
                        ret.push(Sca.decode(util.unescapeSQLiteResponse(data.rows.item(i).value)));
                    }
                }
                if (!getAll) {
                    ret = ret[0];
                }
            }
            catch (e) {
                // If no result is returned, or error occurs when parsing JSON
                CFG_js_1.default.DEBUG && console.log(e);
            }
            success(ret);
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};
IDBObjectStore.prototype.get = function (query) {
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.get`.');
    }
    return this.__get(query);
};
IDBObjectStore.prototype.getKey = function (query) {
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.getKey`.');
    }
    return this.__get(query, true);
};
IDBObjectStore.prototype.getAll = function ( /* query, count */) {
    // eslint-disable-next-line prefer-rest-params
    var query = arguments[0], count = arguments[1];
    return this.__get(query, false, true, count);
};
IDBObjectStore.prototype.getAllKeys = function ( /* query, count */) {
    // eslint-disable-next-line prefer-rest-params
    var query = arguments[0], count = arguments[1];
    return this.__get(query, true, true, count);
};
IDBObjectStore.prototype.delete = function (query) {
    var me = this;
    if (!(this instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.delete`.');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    var range = (0, IDBKeyRange_js_1.convertValueToKeyRange)(query, true);
    var sqlArr = ['DELETE FROM', util.escapeStoreNameForSQL(me.__currentName), 'WHERE'];
    var sqlValues = [];
    (0, IDBKeyRange_js_1.setSQLForKeyRange)(range, util.sqlQuote('key'), sqlArr, sqlValues);
    var sql = sqlArr.join(' ');
    return me.transaction.__addToTransactionQueue(function objectStoreDelete(tx, args, success, error) {
        CFG_js_1.default.DEBUG && console.log('Deleting', me.__currentName, sqlValues);
        tx.executeSql(sql, sqlValues, function (tx, data) {
            CFG_js_1.default.DEBUG && console.log('Deleted from database', data.rowsAffected);
            me.__cursors.forEach(function (cursor) {
                cursor.__invalidateCache(); // Delete
            });
            success();
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};
IDBObjectStore.prototype.clear = function () {
    var me = this;
    if (!(this instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    return me.transaction.__addToTransactionQueue(function objectStoreClear(tx, args, success, error) {
        tx.executeSql('DELETE FROM ' + util.escapeStoreNameForSQL(me.__currentName), [], function (tx, data) {
            CFG_js_1.default.DEBUG && console.log('Cleared all records from database', data.rowsAffected);
            me.__cursors.forEach(function (cursor) {
                cursor.__invalidateCache(); // Clear
            });
            success();
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};
IDBObjectStore.prototype.count = function ( /* query */) {
    var me = this;
    // eslint-disable-next-line prefer-rest-params
    var query = arguments[0];
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    // We don't need to add to cursors array since has the count parameter which won't cache
    return IDBCursor_js_1.IDBCursorWithValue.__createInstance(query, 'next', me, me, 'key', 'value', true).__request;
};
IDBObjectStore.prototype.openCursor = function ( /* query, direction */) {
    var me = this;
    // eslint-disable-next-line prefer-rest-params
    var query = arguments[0], direction = arguments[1];
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    var cursor = IDBCursor_js_1.IDBCursorWithValue.__createInstance(query, direction, me, me, 'key', 'value');
    me.__cursors.push(cursor);
    return cursor.__request;
};
IDBObjectStore.prototype.openKeyCursor = function ( /* query, direction */) {
    var me = this;
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    // eslint-disable-next-line prefer-rest-params
    var query = arguments[0], direction = arguments[1];
    var cursor = IDBCursor_js_1.IDBCursor.__createInstance(query, direction, me, me, 'key', 'key');
    me.__cursors.push(cursor);
    return cursor.__request;
};
IDBObjectStore.prototype.index = function (indexName) {
    var me = this;
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertNotFinished(me.transaction);
    var index = me.__indexes[indexName];
    if (!index || index.__deleted) {
        throw (0, DOMException_js_1.createDOMException)('NotFoundError', 'Index "' + indexName + '" does not exist on ' + me.__currentName);
    }
    if (!me.__indexHandles[indexName] ||
        me.__indexes[indexName].__pendingDelete ||
        me.__indexes[indexName].__deleted) {
        me.__indexHandles[indexName] = IDBIndex_js_1.IDBIndex.__clone(index, me);
    }
    return me.__indexHandles[indexName];
};
/* eslint-disable jsdoc/check-param-names */
/**
 * Creates a new index on the object store.
 * @param {string} indexName
 * @param {string} keyPath
 * @param {object} optionalParameters
 * @returns {IDBIndex}
 */
IDBObjectStore.prototype.createIndex = function (indexName, keyPath /* , optionalParameters */) {
    /* eslint-enable jsdoc/check-param-names */
    var me = this;
    // eslint-disable-next-line prefer-rest-params
    var optionalParameters = arguments[2];
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    indexName = String(indexName); // W3C test within IDBObjectStore.js seems to accept string conversion
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    if (arguments.length === 1) {
        throw new TypeError('No key path was specified');
    }
    IDBTransaction_js_1.default.__assertVersionChange(me.transaction);
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    if (me.__indexes[indexName] && !me.__indexes[indexName].__deleted && !me.__indexes[indexName].__pendingDelete) {
        throw (0, DOMException_js_1.createDOMException)('ConstraintError', 'Index "' + indexName + '" already exists on ' + me.__currentName);
    }
    keyPath = util.convertToSequenceDOMString(keyPath);
    if (!util.isValidKeyPath(keyPath)) {
        throw (0, DOMException_js_1.createDOMException)('SyntaxError', 'A valid keyPath must be supplied');
    }
    if (Array.isArray(keyPath) && optionalParameters && optionalParameters.multiEntry) {
        throw (0, DOMException_js_1.createDOMException)('InvalidAccessError', 'The keyPath argument was an array and the multiEntry option is true.');
    }
    optionalParameters = optionalParameters || {};
    /** @name IDBIndexProperties */
    var indexProperties = {
        columnName: indexName,
        keyPath: keyPath,
        optionalParams: {
            unique: Boolean(optionalParameters.unique),
            multiEntry: Boolean(optionalParameters.multiEntry)
        }
    };
    var index = IDBIndex_js_1.IDBIndex.__createInstance(me, indexProperties);
    IDBIndex_js_1.IDBIndex.__createIndex(me, index);
    return index;
};
IDBObjectStore.prototype.deleteIndex = function (name) {
    var me = this;
    if (!(me instanceof IDBObjectStore)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    IDBTransaction_js_1.default.__assertVersionChange(me.transaction);
    IDBObjectStore.__invalidStateIfDeleted(me);
    IDBTransaction_js_1.default.__assertActive(me.transaction);
    var index = me.__indexes[name];
    if (!index) {
        throw (0, DOMException_js_1.createDOMException)('NotFoundError', 'Index "' + name + '" does not exist on ' + me.__currentName);
    }
    IDBIndex_js_1.IDBIndex.__deleteIndex(me, index);
};
util.defineReadonlyOuterInterface(IDBObjectStore.prototype, readonlyProperties);
util.defineOuterInterface(IDBObjectStore.prototype, ['name']);
IDBObjectStore.prototype[Symbol.toStringTag] = 'IDBObjectStorePrototype';
Object.defineProperty(IDBObjectStore, 'prototype', {
    writable: false
});
exports.default = IDBObjectStore;
