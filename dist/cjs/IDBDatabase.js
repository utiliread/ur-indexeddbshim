"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var eventtargeter_1 = require("eventtargeter");
var DOMException_1 = require("./DOMException");
var Event_1 = require("./Event");
var util = require("./util");
var DOMStringList_1 = require("./DOMStringList");
var IDBObjectStore_1 = require("./IDBObjectStore");
var IDBTransaction_1 = require("./IDBTransaction");
var listeners = ['onabort', 'onclose', 'onerror', 'onversionchange'];
var readonlyProperties = ['name', 'version', 'objectStoreNames'];
/**
 * IDB Database Object
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#database-interface
 * @class
 */
function IDBDatabase() {
    throw new TypeError('Illegal constructor');
}
var IDBDatabaseAlias = IDBDatabase;
IDBDatabase.__createInstance = function (db, name, oldVersion, version, storeProperties) {
    function IDBDatabase() {
        this[Symbol.toStringTag] = 'IDBDatabase';
        util.defineReadonlyProperties(this, readonlyProperties);
        this.__db = db;
        this.__closed = false;
        this.__oldVersion = oldVersion;
        this.__version = version;
        this.__name = name;
        this.__upgradeTransaction = null;
        util.defineListenerProperties(this, listeners);
        this.__setOptions({
            legacyOutputDidListenersThrowFlag: true // Event hook for IndexedB
        });
        this.__transactions = [];
        this.__objectStores = {};
        this.__objectStoreNames = DOMStringList_1.default.__createInstance();
        var itemCopy = {};
        var _loop_1 = function (i) {
            var item = storeProperties.rows.item(i);
            // Safari implements `item` getter return object's properties
            //  as readonly, so we copy all its properties (except our
            //  custom `currNum` which we don't need) onto a new object
            itemCopy.name = item.name;
            itemCopy.keyPath = JSON.parse(item.keyPath);
            ['autoInc', 'indexList'].forEach(function (prop) {
                itemCopy[prop] = JSON.parse(item[prop]);
            });
            itemCopy.idbdb = this_1;
            var store = IDBObjectStore_1.default.__createInstance(itemCopy);
            this_1.__objectStores[store.name] = store;
            this_1.objectStoreNames.push(store.name);
        };
        var this_1 = this;
        for (var i = 0; i < storeProperties.rows.length; i++) {
            _loop_1(i);
        }
        this.__oldObjectStoreNames = this.objectStoreNames.clone();
    }
    IDBDatabase.prototype = IDBDatabaseAlias.prototype;
    return new IDBDatabase();
};
IDBDatabase.prototype = eventtargeter_1.EventTargetFactory.createInstance();
IDBDatabase.prototype[Symbol.toStringTag] = 'IDBDatabasePrototype';
/**
 * Creates a new object store.
 * @param {string} storeName
 * @param {object} [createOptions]
 * @returns {IDBObjectStore}
 */
IDBDatabase.prototype.createObjectStore = function (storeName /* , createOptions */) {
    var createOptions = arguments[1];
    storeName = String(storeName); // W3C test within IDBObjectStore.js seems to accept string conversion
    if (!(this instanceof IDBDatabase)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No object store name was specified');
    }
    IDBTransaction_1.default.__assertVersionChange(this.__versionTransaction); // this.__versionTransaction may not exist if called mistakenly by user in onsuccess
    this.throwIfUpgradeTransactionNull();
    IDBTransaction_1.default.__assertActive(this.__versionTransaction);
    createOptions = __assign({}, createOptions);
    var keyPath = createOptions.keyPath;
    keyPath = keyPath === undefined ? null : util.convertToSequenceDOMString(keyPath);
    if (keyPath !== null && !util.isValidKeyPath(keyPath)) {
        throw DOMException_1.createDOMException('SyntaxError', 'The keyPath argument contains an invalid key path.');
    }
    if (this.__objectStores[storeName] && !this.__objectStores[storeName].__pendingDelete) {
        throw DOMException_1.createDOMException('ConstraintError', 'Object store "' + storeName + '" already exists in ' + this.name);
    }
    var autoInc = createOptions.autoIncrement;
    if (autoInc && (keyPath === '' || Array.isArray(keyPath))) {
        throw DOMException_1.createDOMException('InvalidAccessError', 'With autoIncrement set, the keyPath argument must not be an array or empty string.');
    }
    /** @name IDBObjectStoreProperties **/
    var storeProperties = {
        name: storeName,
        keyPath: keyPath,
        autoInc: autoInc,
        indexList: {},
        idbdb: this
    };
    var store = IDBObjectStore_1.default.__createInstance(storeProperties, this.__versionTransaction);
    return IDBObjectStore_1.default.__createObjectStore(this, store);
};
/**
 * Deletes an object store.
 * @param {string} storeName
 */
IDBDatabase.prototype.deleteObjectStore = function (storeName) {
    if (!(this instanceof IDBDatabase)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No object store name was specified');
    }
    IDBTransaction_1.default.__assertVersionChange(this.__versionTransaction);
    this.throwIfUpgradeTransactionNull();
    IDBTransaction_1.default.__assertActive(this.__versionTransaction);
    var store = this.__objectStores[storeName];
    if (!store) {
        throw DOMException_1.createDOMException('NotFoundError', 'Object store "' + storeName + '" does not exist in ' + this.name);
    }
    IDBObjectStore_1.default.__deleteObjectStore(this, store);
};
IDBDatabase.prototype.close = function () {
    if (!(this instanceof IDBDatabase)) {
        throw new TypeError('Illegal invocation');
    }
    this.__closed = true;
    if (this.__unblocking) {
        this.__unblocking.check();
    }
};
/**
 * Starts a new transaction.
 * @param {string|string[]} storeNames
 * @param {string} mode
 * @returns {IDBTransaction}
 */
IDBDatabase.prototype.transaction = function (storeNames /* , mode */) {
    var _this = this;
    if (arguments.length === 0) {
        throw new TypeError('You must supply a valid `storeNames` to `IDBDatabase.transaction`');
    }
    var mode = arguments[1];
    storeNames = util.isIterable(storeNames)
        // Creating new array also ensures sequence is passed by value: https://heycam.github.io/webidl/#idl-sequence
        ? new Set(// to be unique
        util.convertToSequenceDOMString(storeNames) // iterables have `ToString` applied (and we convert to array for convenience)
        ).slice().sort() // must be sorted
        : [util.convertToDOMString(storeNames)];
    /* (function () {
        throw new TypeError('You must supply a valid `storeNames` to `IDBDatabase.transaction`');
    }())); */
    // Since SQLite (at least node-websql and definitely WebSQL) requires
    //   locking of the whole database, to allow simultaneous readwrite
    //   operations on transactions without overlapping stores, we'd probably
    //   need to save the stores in separate databases (we could also consider
    //   prioritizing readonly but not starving readwrite).
    // Even for readonly transactions, due to [issue 17](https://github.com/nolanlawson/node-websql/issues/17),
    //   we're not currently actually running the SQL requests in parallel.
    mode = mode || 'readonly';
    IDBTransaction_1.default.__assertNotVersionChange(this.__versionTransaction);
    if (this.__closed) {
        throw DOMException_1.createDOMException('InvalidStateError', 'An attempt was made to start a new transaction on a database connection that is not open');
    }
    var objectStoreNames = DOMStringList_1.default.__createInstance();
    storeNames.forEach(function (storeName) {
        if (!_this.objectStoreNames.contains(storeName)) {
            throw DOMException_1.createDOMException('NotFoundError', 'The "' + storeName + '" object store does not exist');
        }
        objectStoreNames.push(storeName);
    });
    if (storeNames.length === 0) {
        throw DOMException_1.createDOMException('InvalidAccessError', 'No valid object store names were specified');
    }
    if (mode !== 'readonly' && mode !== 'readwrite') {
        throw new TypeError('Invalid transaction mode: ' + mode);
    }
    // Do not set __active flag to false yet: https://github.com/w3c/IndexedDB/issues/87
    var trans = IDBTransaction_1.default.__createInstance(this, objectStoreNames, mode);
    this.__transactions.push(trans);
    return trans;
};
// See https://github.com/w3c/IndexedDB/issues/192
IDBDatabase.prototype.throwIfUpgradeTransactionNull = function () {
    if (this.__upgradeTransaction === null) {
        throw DOMException_1.createDOMException('InvalidStateError', 'No upgrade transaction associated with database.');
    }
};
// Todo __forceClose: Add tests for `__forceClose`
IDBDatabase.prototype.__forceClose = function (msg) {
    var me = this;
    me.close();
    var ct = 0;
    me.__transactions.forEach(function (trans) {
        trans.on__abort = function () {
            ct++;
            if (ct === me.__transactions.length) {
                // Todo __forceClose: unblock any pending `upgradeneeded` or `deleteDatabase` calls
                var evt_1 = Event_1.createEvent('close');
                setTimeout(function () {
                    me.dispatchEvent(evt_1);
                });
            }
        };
        trans.__abortTransaction(DOMException_1.createDOMException('AbortError', 'The connection was force-closed: ' + (msg || '')));
    });
};
util.defineOuterInterface(IDBDatabase.prototype, listeners);
util.defineReadonlyOuterInterface(IDBDatabase.prototype, readonlyProperties);
Object.defineProperty(IDBDatabase.prototype, 'constructor', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: IDBDatabase
});
Object.defineProperty(IDBDatabase, 'prototype', {
    writable: false
});
exports.default = IDBDatabase;
