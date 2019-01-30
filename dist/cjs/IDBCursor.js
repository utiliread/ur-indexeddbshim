"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var IDBRequest_1 = require("./IDBRequest");
var IDBObjectStore_1 = require("./IDBObjectStore");
var DOMException_1 = require("./DOMException");
var IDBKeyRange_1 = require("./IDBKeyRange");
var IDBFactory_1 = require("./IDBFactory");
var util = require("./util");
var IDBTransaction_1 = require("./IDBTransaction");
var Key = require("./Key");
var Sca = require("./Sca");
var IDBIndex_1 = require("./IDBIndex"); // eslint-disable-line import/no-named-as-default
var CFG_1 = require("./CFG");
function IDBCursor() {
    throw new TypeError('Illegal constructor');
}
exports.IDBCursor = IDBCursor;
var IDBCursorAlias = IDBCursor;
/**
 * The IndexedDB Cursor Object
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBCursor
 * @param {IDBKeyRange} query
 * @param {string} direction
 * @param {IDBObjectStore} store
 * @param {IDBObjectStore|IDBIndex} source
 * @param {string} keyColumnName
 * @param {string} valueColumnName
 * @param {boolean} count
 */
IDBCursor.__super = function IDBCursor(query, direction, store, source, keyColumnName, valueColumnName, count) {
    this[Symbol.toStringTag] = 'IDBCursor';
    util.defineReadonlyProperties(this, ['key', 'primaryKey']);
    IDBObjectStore_1.default.__invalidStateIfDeleted(store);
    this.__indexSource = util.instanceOf(source, IDBIndex_1.default);
    if (this.__indexSource)
        IDBIndex_1.default.__invalidStateIfDeleted(source);
    IDBTransaction_1.default.__assertActive(store.transaction);
    var range = IDBKeyRange_1.convertValueToKeyRange(query);
    if (direction !== undefined && !(['next', 'prev', 'nextunique', 'prevunique'].includes(direction))) {
        throw new TypeError(direction + 'is not a valid cursor direction');
    }
    Object.defineProperties(this, {
        // Babel is not respecting default writable false here, so make explicit
        source: { writable: false, value: source },
        direction: { writable: false, value: direction || 'next' }
    });
    this.__key = undefined;
    this.__primaryKey = undefined;
    this.__store = store;
    this.__range = range;
    this.__req = IDBRequest_1.IDBRequest.__createInstance();
    this.__req.__source = source;
    this.__req.__transaction = this.__store.transaction;
    this.__keyColumnName = keyColumnName;
    this.__valueColumnName = valueColumnName;
    this.__keyOnly = valueColumnName === 'key';
    this.__valueDecoder = this.__keyOnly ? Key : Sca;
    this.__count = count;
    this.__prefetchedIndex = -1;
    this.__multiEntryIndex = this.__indexSource ? source.multiEntry : false;
    this.__unique = this.direction.includes('unique');
    this.__sqlDirection = ['prev', 'prevunique'].includes(this.direction) ? 'DESC' : 'ASC';
    if (range !== undefined) {
        // Encode the key range and cache the encoded values, so we don't have to re-encode them over and over
        range.__lowerCached = range.lower !== undefined && Key.encode(range.lower, this.__multiEntryIndex);
        range.__upperCached = range.upper !== undefined && Key.encode(range.upper, this.__multiEntryIndex);
    }
    this.__gotValue = true;
    this.continue();
};
IDBCursor.__createInstance = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var IDBCursor = IDBCursorAlias.__super;
    IDBCursor.prototype = IDBCursorAlias.prototype;
    return new (IDBCursor.bind.apply(IDBCursor, [void 0].concat(args)))();
};
IDBCursor.prototype.__find = function () {
    var args = []; /* key, tx, success, error, recordsToLoad */
    for (var _i = 0 /* key, tx, success, error, recordsToLoad */; _i < arguments.length /* key, tx, success, error, recordsToLoad */; _i++ /* key, tx, success, error, recordsToLoad */) {
        args[_i] = arguments[_i]; /* key, tx, success, error, recordsToLoad */
    }
    if (this.__multiEntryIndex) {
        this.__findMultiEntry.apply(this, args);
    }
    else {
        this.__findBasic.apply(this, args);
    }
};
IDBCursor.prototype.__findBasic = function (key, primaryKey, tx, success, error, recordsToLoad) {
    var continueCall = recordsToLoad !== undefined;
    recordsToLoad = recordsToLoad || 1;
    var me = this;
    var quotedKeyColumnName = util.sqlQuote(me.__keyColumnName);
    var quotedKey = util.sqlQuote('key');
    var sql = ['SELECT * FROM', util.escapeStoreNameForSQL(me.__store.__currentName)];
    var sqlValues = [];
    sql.push('WHERE', quotedKeyColumnName, 'NOT NULL');
    IDBKeyRange_1.setSQLForKeyRange(me.__range, quotedKeyColumnName, sql, sqlValues, true, true);
    // Determine the ORDER BY direction based on the cursor.
    var direction = me.__sqlDirection;
    var op = direction === 'ASC' ? '>' : '<';
    if (primaryKey !== undefined) {
        sql.push('AND', quotedKey, op + '= ?');
        // Key.convertValueToKey(primaryKey); // Already checked by `continuePrimaryKey`
        sqlValues.push(Key.encode(primaryKey));
    }
    if (key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + '= ?');
        // Key.convertValueToKey(key); // Already checked by `continue` or `continuePrimaryKey`
        sqlValues.push(Key.encode(key));
    }
    else if (continueCall && me.__key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + ' ?');
        // Key.convertValueToKey(me.__key); // Already checked when stored
        sqlValues.push(Key.encode(me.__key));
    }
    if (!me.__count) {
        // 1. Sort by key
        sql.push('ORDER BY', quotedKeyColumnName, direction);
        if (me.__keyColumnName !== 'key') { // Avoid adding 'key' twice
            if (!me.__unique) {
                // 2. Sort by primaryKey (if defined and not unique)
                // 3. Sort by position (if defined)
                sql.push(',', quotedKey, direction);
            }
            else if (me.direction === 'prevunique') {
                // Sort by first record with key matching
                sql.push(',', quotedKey, 'ASC');
            }
        }
        if (!me.__unique && me.__indexSource) {
            // 4. Sort by object store position (if defined and not unique)
            sql.push(',', util.sqlQuote(me.__valueColumnName), direction);
        }
        sql.push('LIMIT', recordsToLoad);
    }
    sql = sql.join(' ');
    CFG_1.default.DEBUG && console.log(sql, sqlValues);
    tx.executeSql(sql, sqlValues, function (tx, data) {
        if (me.__count) {
            success(undefined, data.rows.length, undefined);
        }
        else if (data.rows.length > 1) {
            me.__prefetchedIndex = 0;
            me.__prefetchedData = data.rows;
            CFG_1.default.DEBUG && console.log('Preloaded ' + me.__prefetchedData.length + ' records for cursor');
            me.__decode(data.rows.item(0), success);
        }
        else if (data.rows.length === 1) {
            me.__decode(data.rows.item(0), success);
        }
        else {
            CFG_1.default.DEBUG && console.log('Reached end of cursors');
            success(undefined, undefined, undefined);
        }
    }, function (tx, err) {
        CFG_1.default.DEBUG && console.log('Could not execute Cursor.continue', sql, sqlValues);
        error(err);
    });
};
var leftBracketRegex = /\[/gu;
IDBCursor.prototype.__findMultiEntry = function (key, primaryKey, tx, success, error) {
    var me = this;
    if (me.__prefetchedData && me.__prefetchedData.length === me.__prefetchedIndex) {
        CFG_1.default.DEBUG && console.log('Reached end of multiEntry cursor');
        success(undefined, undefined, undefined);
        return;
    }
    var quotedKeyColumnName = util.sqlQuote(me.__keyColumnName);
    var sql = ['SELECT * FROM', util.escapeStoreNameForSQL(me.__store.__currentName)];
    var sqlValues = [];
    sql.push('WHERE', quotedKeyColumnName, 'NOT NULL');
    if (me.__range && (me.__range.lower !== undefined && Array.isArray(me.__range.upper))) {
        if (me.__range.upper.indexOf(me.__range.lower) === 0) {
            sql.push('AND', quotedKeyColumnName, "LIKE ? ESCAPE '^'");
            sqlValues.push('%' + util.sqlLIKEEscape(me.__range.__lowerCached.slice(0, -1)) + '%');
        }
    }
    // Determine the ORDER BY direction based on the cursor.
    var direction = me.__sqlDirection;
    var op = direction === 'ASC' ? '>' : '<';
    var quotedKey = util.sqlQuote('key');
    if (primaryKey !== undefined) {
        sql.push('AND', quotedKey, op + '= ?');
        // Key.convertValueToKey(primaryKey); // Already checked by `continuePrimaryKey`
        sqlValues.push(Key.encode(primaryKey));
    }
    if (key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + '= ?');
        // Key.convertValueToKey(key); // Already checked by `continue` or `continuePrimaryKey`
        sqlValues.push(Key.encode(key));
    }
    else if (me.__key !== undefined) {
        sql.push('AND', quotedKeyColumnName, op + ' ?');
        // Key.convertValueToKey(me.__key); // Already checked when entered
        sqlValues.push(Key.encode(me.__key));
    }
    if (!me.__count) {
        // 1. Sort by key
        sql.push('ORDER BY', quotedKeyColumnName, direction);
        // 2. Sort by primaryKey (if defined and not unique)
        if (!me.__unique && me.__keyColumnName !== 'key') { // Avoid adding 'key' twice
            sql.push(',', util.sqlQuote('key'), direction);
        }
        // 3. Sort by position (if defined)
        if (!me.__unique && me.__indexSource) {
            // 4. Sort by object store position (if defined and not unique)
            sql.push(',', util.sqlQuote(me.__valueColumnName), direction);
        }
    }
    sql = sql.join(' ');
    CFG_1.default.DEBUG && console.log(sql, sqlValues);
    tx.executeSql(sql, sqlValues, function (tx, data) {
        if (data.rows.length > 0) {
            if (me.__count) { // Avoid caching and other processing below
                var ct = 0;
                for (var i = 0; i < data.rows.length; i++) {
                    var rowItem = data.rows.item(i);
                    var rowKey = Key.decode(rowItem[me.__keyColumnName], true);
                    var matches = Key.findMultiEntryMatches(rowKey, me.__range);
                    ct += matches.length;
                }
                success(undefined, ct, undefined);
                return;
            }
            var rows = [];
            for (var i = 0; i < data.rows.length; i++) {
                var rowItem = data.rows.item(i);
                var rowKey = Key.decode(rowItem[me.__keyColumnName], true);
                var matches = Key.findMultiEntryMatches(rowKey, me.__range);
                for (var j = 0; j < matches.length; j++) {
                    var matchingKey = matches[j];
                    var clone = {
                        matchingKey: Key.encode(matchingKey, true),
                        key: rowItem.key
                    };
                    clone[me.__keyColumnName] = rowItem[me.__keyColumnName];
                    clone[me.__valueColumnName] = rowItem[me.__valueColumnName];
                    rows.push(clone);
                }
            }
            var reverse_1 = me.direction.indexOf('prev') === 0;
            rows.sort(function (a, b) {
                if (a.matchingKey.replace(leftBracketRegex, 'z') < b.matchingKey.replace(leftBracketRegex, 'z')) {
                    return reverse_1 ? 1 : -1;
                }
                if (a.matchingKey.replace(leftBracketRegex, 'z') > b.matchingKey.replace(leftBracketRegex, 'z')) {
                    return reverse_1 ? -1 : 1;
                }
                if (a.key < b.key) {
                    return me.direction === 'prev' ? 1 : -1;
                }
                if (a.key > b.key) {
                    return me.direction === 'prev' ? -1 : 1;
                }
                return 0;
            });
            if (rows.length > 1) {
                me.__prefetchedIndex = 0;
                me.__prefetchedData = {
                    data: rows,
                    length: rows.length,
                    item: function (index) {
                        return this.data[index];
                    }
                };
                CFG_1.default.DEBUG && console.log('Preloaded ' + me.__prefetchedData.length + ' records for multiEntry cursor');
                me.__decode(rows[0], success);
            }
            else if (rows.length === 1) {
                CFG_1.default.DEBUG && console.log('Reached end of multiEntry cursor');
                me.__decode(rows[0], success);
            }
            else {
                CFG_1.default.DEBUG && console.log('Reached end of multiEntry cursor');
                success(undefined, undefined, undefined);
            }
        }
        else {
            CFG_1.default.DEBUG && console.log('Reached end of multiEntry cursor');
            success(undefined, undefined, undefined);
        }
    }, function (tx, err) {
        CFG_1.default.DEBUG && console.log('Could not execute Cursor.continue', sql, sqlValues);
        error(err);
    });
};
/**
 * Creates an "onsuccess" callback
 * @private
 */
IDBCursor.prototype.__onsuccess = function (success) {
    var me = this;
    return function (key, value, primaryKey) {
        if (me.__count) {
            success(value, me.__req);
        }
        else {
            if (key !== undefined) {
                me.__gotValue = true;
            }
            me.__key = key === undefined ? null : key;
            me.__primaryKey = primaryKey === undefined ? null : primaryKey;
            me.__value = value === undefined ? null : value;
            var result = key === undefined ? null : me;
            success(result, me.__req);
        }
    };
};
IDBCursor.prototype.__decode = function (rowItem, callback) {
    var me = this;
    if (me.__multiEntryIndex && me.__unique) {
        if (!me.__matchedKeys) {
            me.__matchedKeys = {};
        }
        if (me.__matchedKeys[rowItem.matchingKey]) {
            callback(undefined, undefined, undefined); // eslint-disable-line standard/no-callback-literal
            return;
        }
        me.__matchedKeys[rowItem.matchingKey] = true;
    }
    var encKey = util.unescapeSQLiteResponse(me.__multiEntryIndex
        ? rowItem.matchingKey
        : rowItem[me.__keyColumnName]);
    var encVal = util.unescapeSQLiteResponse(rowItem[me.__valueColumnName]);
    var encPrimaryKey = util.unescapeSQLiteResponse(rowItem.key);
    var key = Key.decode(encKey, me.__multiEntryIndex);
    var val = me.__valueDecoder.decode(encVal);
    var primaryKey = Key.decode(encPrimaryKey);
    callback(key, val, primaryKey, encKey /*, encVal, encPrimaryKey */);
};
IDBCursor.prototype.__sourceOrEffectiveObjStoreDeleted = function () {
    IDBObjectStore_1.default.__invalidStateIfDeleted(this.__store, "The cursor's effective object store has been deleted");
    if (this.__indexSource)
        IDBIndex_1.default.__invalidStateIfDeleted(this.source, "The cursor's index source has been deleted");
};
IDBCursor.prototype.__invalidateCache = function () {
    this.__prefetchedData = null;
};
IDBCursor.prototype.__continue = function (key, advanceContinue) {
    var me = this;
    var advanceState = me.__advanceCount !== undefined;
    IDBTransaction_1.default.__assertActive(me.__store.transaction);
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__gotValue && !advanceContinue) {
        throw DOMException_1.createDOMException('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    if (key !== undefined) {
        Key.convertValueToKeyRethrowingAndIfInvalid(key);
        var cmpResult = IDBFactory_1.cmp(key, me.key);
        if (cmpResult === 0 ||
            (me.direction.includes('next') && cmpResult === -1) ||
            (me.direction.includes('prev') && cmpResult === 1)) {
            throw DOMException_1.createDOMException('DataError', 'Cannot ' + (advanceState ? 'advance' : 'continue') + ' the cursor in an unexpected direction');
        }
    }
    this.__continueFinish(key, undefined, advanceState);
};
IDBCursor.prototype.__continueFinish = function (key, primaryKey, advanceState) {
    var me = this;
    var recordsToPreloadOnContinue = me.__advanceCount || CFG_1.default.cursorPreloadPackSize || 100;
    me.__gotValue = false;
    me.__req.__readyState = 'pending'; // Unset done flag
    me.__store.transaction.__pushToQueue(me.__req, function cursorContinue(tx, args, success, error, executeNextRequest) {
        function triggerSuccess(k, val, primKey) {
            if (advanceState) {
                if (me.__advanceCount >= 2 && k !== undefined) {
                    me.__advanceCount--;
                    me.__key = k;
                    me.__continue(undefined, true);
                    executeNextRequest(); // We don't call success yet but do need to advance the transaction queue
                    return;
                }
                me.__advanceCount = undefined;
            }
            me.__onsuccess(success)(k, val, primKey);
        }
        if (me.__prefetchedData) {
            // We have pre-loaded data for the cursor
            me.__prefetchedIndex++;
            if (me.__prefetchedIndex < me.__prefetchedData.length) {
                me.__decode(me.__prefetchedData.item(me.__prefetchedIndex), function (k, val, primKey, encKey) {
                    function checkKey() {
                        var cmpResult = key === undefined || IDBFactory_1.cmp(k, key);
                        if (cmpResult > 0 || (cmpResult === 0 && (me.__unique || primaryKey === undefined || IDBFactory_1.cmp(primKey, primaryKey) >= 0))) {
                            triggerSuccess(k, val, primKey);
                            return;
                        }
                        cursorContinue(tx, args, success, error);
                    }
                    if (me.__unique && !me.__multiEntryIndex &&
                        encKey === Key.encode(me.key, me.__multiEntryIndex)) {
                        cursorContinue(tx, args, success, error);
                        return;
                    }
                    checkKey();
                });
                return;
            }
        }
        // No (or not enough) pre-fetched data, do query
        me.__find(key, primaryKey, tx, triggerSuccess, function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            me.__advanceCount = undefined;
            error.apply(void 0, args);
        }, recordsToPreloadOnContinue);
    });
};
IDBCursor.prototype.continue = function ( /* key */) {
    this.__continue(arguments[0]);
};
IDBCursor.prototype.continuePrimaryKey = function (key, primaryKey) {
    var me = this;
    IDBTransaction_1.default.__assertActive(me.__store.transaction);
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__indexSource) {
        throw DOMException_1.createDOMException('InvalidAccessError', '`continuePrimaryKey` may only be called on an index source.');
    }
    if (!['next', 'prev'].includes(me.direction)) {
        throw DOMException_1.createDOMException('InvalidAccessError', '`continuePrimaryKey` may not be called with unique cursors.');
    }
    if (!me.__gotValue) {
        throw DOMException_1.createDOMException('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    Key.convertValueToKeyRethrowingAndIfInvalid(key);
    Key.convertValueToKeyRethrowingAndIfInvalid(primaryKey);
    var cmpResult = IDBFactory_1.cmp(key, me.key);
    if ((me.direction === 'next' && cmpResult === -1) ||
        (me.direction === 'prev' && cmpResult === 1)) {
        throw DOMException_1.createDOMException('DataError', 'Cannot continue the cursor in an unexpected direction');
    }
    function noErrors() {
        me.__continueFinish(key, primaryKey, false);
    }
    if (cmpResult === 0) {
        Sca.encode(primaryKey, function (encPrimaryKey) {
            Sca.encode(me.primaryKey, function (encObjectStorePos) {
                if (encPrimaryKey === encObjectStorePos ||
                    (me.direction === 'next' && encPrimaryKey < encObjectStorePos) ||
                    (me.direction === 'prev' && encPrimaryKey > encObjectStorePos)) {
                    throw DOMException_1.createDOMException('DataError', 'Cannot continue the cursor in an unexpected direction');
                }
                noErrors();
            });
        });
    }
    else {
        noErrors();
    }
};
IDBCursor.prototype.advance = function (count) {
    var me = this;
    count = util.enforceRange(count, 'unsigned long');
    if (count === 0) {
        throw new TypeError('Calling advance() with count argument 0');
    }
    if (me.__gotValue) { // Only set the count if not running in error (otherwise will override earlier good advance calls)
        me.__advanceCount = count;
    }
    me.__continue();
};
IDBCursor.prototype.update = function (valueToUpdate) {
    var me = this;
    if (!arguments.length)
        throw new TypeError('A value must be passed to update()');
    IDBTransaction_1.default.__assertActive(me.__store.transaction);
    me.__store.transaction.__assertWritable();
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__gotValue) {
        throw DOMException_1.createDOMException('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    if (me.__keyOnly) {
        throw DOMException_1.createDOMException('InvalidStateError', 'This cursor method cannot be called when the key only flag has been set.');
    }
    var request = me.__store.transaction.__createRequest(me);
    var key = me.primaryKey;
    function addToQueue(clonedValue) {
        // We set the `invalidateCache` argument to `false` since the old value shouldn't be accessed
        IDBObjectStore_1.default.__storingRecordObjectStore(request, me.__store, false, clonedValue, false, key);
    }
    if (me.__store.keyPath !== null) {
        var _a = me.__store.__validateKeyAndValueAndCloneValue(valueToUpdate, undefined, true), evaluatedKey = _a[0], clonedValue = _a[1];
        if (IDBFactory_1.cmp(me.primaryKey, evaluatedKey) !== 0) {
            throw DOMException_1.createDOMException('DataError', 'The key of the supplied value to `update` is not equal to the cursor\'s effective key');
        }
        addToQueue(clonedValue);
    }
    else {
        var clonedValue = Sca.clone(valueToUpdate);
        addToQueue(clonedValue);
    }
    return request;
};
IDBCursor.prototype.delete = function () {
    var me = this;
    IDBTransaction_1.default.__assertActive(me.__store.transaction);
    me.__store.transaction.__assertWritable();
    me.__sourceOrEffectiveObjStoreDeleted();
    if (!me.__gotValue) {
        throw DOMException_1.createDOMException('InvalidStateError', 'The cursor is being iterated or has iterated past its end.');
    }
    if (me.__keyOnly) {
        throw DOMException_1.createDOMException('InvalidStateError', 'This cursor method cannot be called when the key only flag has been set.');
    }
    return this.__store.transaction.__addToTransactionQueue(function cursorDelete(tx, args, success, error) {
        me.__find(undefined, undefined, tx, function (key, value, primaryKey) {
            var sql = 'DELETE FROM  ' + util.escapeStoreNameForSQL(me.__store.__currentName) + ' WHERE "key" = ?';
            CFG_1.default.DEBUG && console.log(sql, key, primaryKey);
            // Key.convertValueToKey(primaryKey); // Already checked when entered
            tx.executeSql(sql, [util.escapeSQLiteStatement(Key.encode(primaryKey))], function (tx, data) {
                if (data.rowsAffected === 1) {
                    // We don't invalidate the cache (as we don't access it anymore
                    //    and it will set the index off)
                    success(undefined);
                }
                else {
                    error('No rows with key found' + key);
                }
            }, function (tx, data) {
                error(data);
            });
        }, error);
    }, undefined, me);
};
IDBCursor.prototype[Symbol.toStringTag] = 'IDBCursorPrototype';
util.defineReadonlyOuterInterface(IDBCursor.prototype, ['source', 'direction', 'key', 'primaryKey']);
Object.defineProperty(IDBCursor, 'prototype', {
    writable: false
});
function IDBCursorWithValue() {
    throw new TypeError('Illegal constructor');
}
exports.IDBCursorWithValue = IDBCursorWithValue;
IDBCursorWithValue.prototype = Object.create(IDBCursor.prototype);
Object.defineProperty(IDBCursorWithValue.prototype, 'constructor', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: IDBCursorWithValue
});
var IDBCursorWithValueAlias = IDBCursorWithValue;
IDBCursorWithValue.__createInstance = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    function IDBCursorWithValue() {
        var _a;
        (_a = IDBCursor.__super).call.apply(_a, [this].concat(args));
        this[Symbol.toStringTag] = 'IDBCursorWithValue';
        util.defineReadonlyProperties(this, 'value');
    }
    IDBCursorWithValue.prototype = IDBCursorWithValueAlias.prototype;
    return new IDBCursorWithValue();
};
util.defineReadonlyOuterInterface(IDBCursorWithValue.prototype, ['value']);
IDBCursorWithValue.prototype[Symbol.toStringTag] = 'IDBCursorWithValuePrototype';
Object.defineProperty(IDBCursorWithValue, 'prototype', {
    writable: false
});
