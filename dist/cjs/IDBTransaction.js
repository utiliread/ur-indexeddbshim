"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var eventtargeter_1 = require("eventtargeter");
var sync_promise_1 = require("sync-promise");
var Event_js_1 = require("./Event.js");
var DOMException_js_1 = require("./DOMException.js");
var IDBRequest_js_1 = require("./IDBRequest.js");
var util = require("./util.js");
var IDBObjectStore_js_1 = require("./IDBObjectStore.js");
var CFG_js_1 = require("./CFG.js");
var uniqueID = 0;
var listeners = ['onabort', 'oncomplete', 'onerror'];
var readonlyProperties = ['objectStoreNames', 'mode', 'db', 'error'];
/* eslint-disable jsdoc/check-param-names */
/**
 * The IndexedDB Transaction.
 * @see http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBTransaction
 * @param {IDBDatabase} db
 * @param {string[]} storeNames
 * @param {string} mode
 * @class
 */
function IDBTransaction() {
    /* eslint-enable jsdoc/check-param-names */
    throw new TypeError('Illegal constructor');
}
var IDBTransactionAlias = IDBTransaction;
IDBTransaction.__createInstance = function (db, storeNames, mode) {
    function IDBTransaction() {
        var _this = this;
        var me = this;
        me[Symbol.toStringTag] = 'IDBTransaction';
        util.defineReadonlyProperties(me, readonlyProperties);
        me.__id = ++uniqueID; // for debugging simultaneous transactions
        me.__active = true;
        me.__running = false;
        me.__errored = false;
        me.__requests = [];
        me.__objectStoreNames = storeNames;
        me.__mode = mode;
        me.__db = db;
        me.__error = null;
        me.__setOptions({
            legacyOutputDidListenersThrowFlag: true // Event hook for IndexedB
        });
        readonlyProperties.forEach(function (readonlyProp) {
            Object.defineProperty(_this, readonlyProp, {
                configurable: true
            });
        });
        util.defineListenerProperties(this, listeners);
        me.__storeHandles = {};
        // Kick off the transaction as soon as all synchronous code is done
        setTimeout(function () { me.__executeRequests(); }, 0);
    }
    IDBTransaction.prototype = IDBTransactionAlias.prototype;
    return new IDBTransaction();
};
IDBTransaction.prototype = eventtargeter_1.EventTargetFactory.createInstance({
    defaultSync: true,
    // Ensure EventTarget preserves our properties
    extraProperties: ['complete']
});
IDBTransaction.prototype.__transFinishedCb = function (err, cb) {
    cb(Boolean(err));
};
IDBTransaction.prototype.__executeRequests = function () {
    var me = this;
    if (me.__running) {
        CFG_js_1.default.DEBUG && console.log('Looks like the request set is already running', me.mode);
        return;
    }
    me.__running = true;
    me.db.__db[me.mode === 'readonly' ? 'readTransaction' : 'transaction'](// `readTransaction` is optimized, at least in `node-websql`
    function executeRequests(tx) {
        me.__tx = tx;
        var q = null, i = -1;
        function success(result, req) {
            if (me.__errored || me.__requestsFinished) {
                // We've already called "onerror", "onabort", or thrown within the transaction, so don't do it again.
                return;
            }
            if (req) {
                q.req = req; // Need to do this in case of cursors
            }
            if (q.req.__done) { // Avoid continuing with aborted requests
                return;
            }
            q.req.__done = true;
            q.req.__result = result;
            q.req.__error = null;
            me.__active = true;
            var e = (0, Event_js_1.createEvent)('success');
            q.req.dispatchEvent(e);
            // Do not set __active flag to false yet: https://github.com/w3c/IndexedDB/issues/87
            if (e.__legacyOutputDidListenersThrowError) {
                (0, DOMException_js_1.logError)('Error', 'An error occurred in a success handler attached to request chain', e.__legacyOutputDidListenersThrowError); // We do nothing else with this error as per spec
                me.__abortTransaction((0, DOMException_js_1.createDOMException)('AbortError', 'A request was aborted (in user handler after success).'));
                return;
            }
            executeNextRequest();
        }
        function error() {
            var args = []; /* tx, err */
            for (var _i = 0 /* tx, err */; _i < arguments.length /* tx, err */; _i++ /* tx, err */) {
                args[_i] = arguments[_i]; /* tx, err */
            }
            if (me.__errored || me.__requestsFinished) {
                // We've already called "onerror", "onabort", or thrown within
                //  the transaction, so don't do it again.
                return;
            }
            if (q.req && q.req.__done) { // Avoid continuing with aborted requests
                return;
            }
            var err = (0, DOMException_js_1.findError)(args);
            if (!q.req) {
                me.__abortTransaction(err);
                return;
            }
            // Fire an error event for the current IDBRequest
            q.req.__done = true;
            q.req.__error = err;
            q.req.__result = undefined; // Must be undefined if an error per `result` getter
            q.req.addLateEventListener('error', function (e) {
                if (e.cancelable && e.defaultPrevented && !e.__legacyOutputDidListenersThrowError) {
                    executeNextRequest();
                }
            });
            q.req.addDefaultEventListener('error', function () {
                me.__abortTransaction(q.req.__error);
            });
            me.__active = true;
            var e = (0, Event_js_1.createEvent)('error', err, { bubbles: true, cancelable: true });
            q.req.dispatchEvent(e);
            // Do not set __active flag to false yet: https://github.com/w3c/IndexedDB/issues/87
            if (e.__legacyOutputDidListenersThrowError) {
                (0, DOMException_js_1.logError)('Error', 'An error occurred in an error handler attached to request chain', e.__legacyOutputDidListenersThrowError); // We do nothing else with this error as per spec
                e.preventDefault(); // Prevent 'error' default as steps indicate we should abort with `AbortError` even without cancellation
                me.__abortTransaction((0, DOMException_js_1.createDOMException)('AbortError', 'A request was aborted (in user handler after error).'));
            }
        }
        function executeNextRequest() {
            if (me.__errored || me.__requestsFinished) {
                // We've already called "onerror", "onabort", or thrown within the transaction, so don't do it again.
                return;
            }
            i++;
            if (i >= me.__requests.length) {
                // All requests in the transaction are done
                me.__requests = [];
                if (me.__active) {
                    requestsFinished();
                }
            }
            else {
                try {
                    q = me.__requests[i];
                    if (!q.req) {
                        q.op(tx, q.args, executeNextRequest, error);
                        return;
                    }
                    if (q.req.__done) { // Avoid continuing with aborted requests
                        return;
                    }
                    q.op(tx, q.args, success, error, executeNextRequest);
                }
                catch (e) {
                    error(e);
                }
            }
        }
        executeNextRequest();
    }, function webSQLError(webSQLErr) {
        if (webSQLErr === true) { // Not a genuine SQL error
            return;
        }
        var err = (0, DOMException_js_1.webSQLErrback)(webSQLErr);
        me.__abortTransaction(err);
    }, function () {
        // For Node, we don't need to try running here as we can keep
        //   the transaction running long enough to rollback (in the
        //   next (non-standard) callback for this transaction call)
        if (me.__transFinishedCb !== IDBTransaction.prototype.__transFinishedCb) { // Node
            return;
        }
        if (!me.__transactionEndCallback && !me.__requestsFinished) {
            me.__transactionFinished = true;
            return;
        }
        if (me.__transactionEndCallback && !me.__completed) {
            me.__transFinishedCb(me.__errored, me.__transactionEndCallback);
        }
    }, function (currentTask, err, done, rollback, commit) {
        if (currentTask.readOnly || err) {
            return true;
        }
        me.__transFinishedCb = function (err, cb) {
            if (err) {
                rollback(err, cb);
            }
            else {
                commit(cb);
            }
        };
        if (me.__transactionEndCallback && !me.__completed) {
            me.__transFinishedCb(me.__errored, me.__transactionEndCallback);
        }
        return false;
    });
    function requestsFinished() {
        me.__active = false;
        me.__requestsFinished = true;
        function complete() {
            me.__completed = true;
            CFG_js_1.default.DEBUG && console.log('Transaction completed');
            var evt = (0, Event_js_1.createEvent)('complete');
            try {
                me.__internal = true;
                me.dispatchEvent(evt);
                me.__internal = false;
                me.dispatchEvent((0, Event_js_1.createEvent)('__complete'));
            }
            catch (e) {
                me.__internal = false;
                // An error occurred in the "oncomplete" handler.
                // It's too late to call "onerror" or "onabort". Throw a global error instead.
                // (this may seem odd/bad, but it's how all native IndexedDB implementations work)
                me.__errored = true;
                throw e;
            }
            finally {
                me.__storeHandles = {};
            }
        }
        if (me.mode === 'readwrite') {
            if (me.__transactionFinished) {
                complete();
                return;
            }
            me.__transactionEndCallback = complete;
            return;
        }
        if (me.mode === 'readonly') {
            complete();
            return;
        }
        var ev = (0, Event_js_1.createEvent)('__beforecomplete');
        ev.complete = complete;
        me.dispatchEvent(ev);
    }
};
/**
 * Creates a new IDBRequest for the transaction.
 * NOTE: The transaction is not queued until you call {@link IDBTransaction#__pushToQueue}.
 * @param {IDBDatabase} source
 * @returns {IDBRequest}
 * @protected
 */
IDBTransaction.prototype.__createRequest = function (source) {
    var me = this;
    var request = IDBRequest_js_1.IDBRequest.__createInstance();
    request.__source = source !== undefined ? source : me.db;
    request.__transaction = me;
    return request;
};
/**
 * Adds a callback function to the transaction queue.
 * @param {function} callback
 * @param {*} args
 * @param {IDBDatabase} source
 * @returns {IDBRequest}
 * @protected
 */
IDBTransaction.prototype.__addToTransactionQueue = function (callback, args, source) {
    var request = this.__createRequest(source);
    this.__pushToQueue(request, callback, args);
    return request;
};
/**
 * Adds a callback function to the transaction queue without generating a
 *   request.
 * @param {function} callback
 * @param {*} args
 * @param {IDBDatabase} source
 * @returns {void}
 * @protected
 */
IDBTransaction.prototype.__addNonRequestToTransactionQueue = function (callback, args, source) {
    this.__pushToQueue(null, callback, args);
};
/**
 * Adds an IDBRequest to the transaction queue.
 * @param {IDBRequest} request
 * @param {function} callback
 * @param {*} args
 * @protected
 * @returns {void}
 */
IDBTransaction.prototype.__pushToQueue = function (request, callback, args) {
    this.__assertActive();
    this.__requests.push({
        op: callback,
        args: args,
        req: request
    });
};
IDBTransaction.prototype.__assertActive = function () {
    if (!this.__active) {
        throw (0, DOMException_js_1.createDOMException)('TransactionInactiveError', 'A request was placed against a transaction which is currently not active, or which is finished');
    }
};
IDBTransaction.prototype.__assertWritable = function () {
    if (this.mode === 'readonly') {
        throw (0, DOMException_js_1.createDOMException)('ReadOnlyError', 'The transaction is read only');
    }
};
IDBTransaction.prototype.__assertVersionChange = function () {
    IDBTransaction.__assertVersionChange(this);
};
/**
 * Returns the specified object store.
 * @param {string} objectStoreName
 * @returns {IDBObjectStore}
 */
IDBTransaction.prototype.objectStore = function (objectStoreName) {
    var me = this;
    if (!(me instanceof IDBTransaction)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('No object store name was specified');
    }
    IDBTransaction.__assertNotFinished(me);
    if (me.__objectStoreNames.indexOf(objectStoreName) === -1) { // eslint-disable-line unicorn/prefer-includes
        throw (0, DOMException_js_1.createDOMException)('NotFoundError', objectStoreName + ' is not participating in this transaction');
    }
    var store = me.db.__objectStores[objectStoreName];
    if (!store) {
        throw (0, DOMException_js_1.createDOMException)('NotFoundError', objectStoreName + ' does not exist in ' + me.db.name);
    }
    if (!me.__storeHandles[objectStoreName] ||
        // These latter conditions are to allow store
        //   recreation to create new clone object
        me.__storeHandles[objectStoreName].__pendingDelete ||
        me.__storeHandles[objectStoreName].__deleted) {
        me.__storeHandles[objectStoreName] = IDBObjectStore_js_1.default.__clone(store, me);
    }
    return me.__storeHandles[objectStoreName];
};
IDBTransaction.prototype.__abortTransaction = function (err) {
    var me = this;
    (0, DOMException_js_1.logError)('Error', 'An error occurred in a transaction', err);
    if (me.__errored) {
        // We've already called "onerror", "onabort", or thrown, so don't do it again.
        return;
    }
    me.__errored = true;
    if (me.mode === 'versionchange') { // Steps for aborting an upgrade transaction
        me.db.__version = me.db.__oldVersion;
        me.db.__objectStoreNames = me.db.__oldObjectStoreNames;
        me.__objectStoreNames = me.db.__oldObjectStoreNames;
        Object.values(me.db.__objectStores).concat(Object.values(me.__storeHandles)).forEach(function (store) {
            // Store was already created so we restore to name before the rename
            if ('__pendingName' in store &&
                me.db.__oldObjectStoreNames.indexOf(store.__pendingName) > -1 // eslint-disable-line unicorn/prefer-includes
            ) {
                store.__name = store.__originalName;
            }
            store.__indexNames = store.__oldIndexNames;
            delete store.__pendingDelete;
            Object.values(store.__indexes).concat(Object.values(store.__indexHandles)).forEach(function (index) {
                // Index was already created so we restore to name before the rename
                if ('__pendingName' in index &&
                    store.__oldIndexNames.indexOf(index.__pendingName) > -1 // eslint-disable-line unicorn/prefer-includes
                ) {
                    index.__name = index.__originalName;
                }
                delete index.__pendingDelete;
            });
        });
    }
    me.__active = false; // Setting here and in requestsFinished for https://github.com/w3c/IndexedDB/issues/87
    if (err !== null) {
        me.__error = err;
    }
    if (me.__requestsFinished) {
        // The transaction has already completed, so we can't call "onerror" or "onabort".
        // So throw the error instead.
        setTimeout(function () {
            throw err;
        }, 0);
    }
    function abort(tx, errOrResult) {
        if (!tx) {
            CFG_js_1.default.DEBUG && console.log('Rollback not possible due to missing transaction', me);
        }
        else if (errOrResult && typeof errOrResult.code === 'number') {
            CFG_js_1.default.DEBUG && console.log('Rollback erred; feature is probably not supported as per WebSQL', me);
        }
        else {
            CFG_js_1.default.DEBUG && console.log('Rollback succeeded', me);
        }
        me.dispatchEvent((0, Event_js_1.createEvent)('__preabort'));
        me.__requests.filter(function (q, i, arr) {
            return q.req && !q.req.__done && [i, -1].includes(arr.map(function (q) { return q.req; }).lastIndexOf(q.req));
        }).reduce(function (promises, q) {
            // We reduce to a chain of promises to be queued in order, so we cannot
            //  use `Promise.all`, and I'm unsure whether `setTimeout` currently
            //  behaves first-in-first-out with the same timeout so we could
            //  just use a `forEach`.
            return promises.then(function () {
                q.req.__done = true;
                q.req.__result = undefined;
                q.req.__error = (0, DOMException_js_1.createDOMException)('AbortError', 'A request was aborted (an unfinished request).');
                var reqEvt = (0, Event_js_1.createEvent)('error', q.req.__error, { bubbles: true, cancelable: true });
                return new sync_promise_1.default(function (resolve) {
                    setTimeout(function () {
                        q.req.dispatchEvent(reqEvt); // No need to catch errors
                        resolve();
                    });
                });
            });
        }, sync_promise_1.default.resolve()).then(function () {
            var evt = (0, Event_js_1.createEvent)('abort', err, { bubbles: true, cancelable: false });
            setTimeout(function () {
                me.__abortFinished = true;
                me.dispatchEvent(evt);
                me.__storeHandles = {};
                me.dispatchEvent((0, Event_js_1.createEvent)('__abort'));
            });
            return undefined;
        }).catch(function (err) {
            console.log('Abort error');
            throw err;
        });
    }
    me.__transFinishedCb(true, function (rollback) {
        if (rollback && me.__tx) { // Not supported in standard SQL (and WebSQL errors should
            //   rollback automatically), but for Node.js, etc., we give chance for
            //   manual aborts which would otherwise not work.
            if (me.mode === 'readwrite') {
                if (me.__transactionFinished) {
                    abort();
                    return;
                }
                me.__transactionEndCallback = abort;
                return;
            }
            try {
                me.__tx.executeSql('ROLLBACK', [], abort, abort); // Not working in some circumstances, even in Node
            }
            catch (err) {
                // Browser errs when transaction has ended and since it most likely already erred here,
                //   we call to abort
                abort();
            }
        }
        else {
            abort(null, { code: 0 });
        }
    });
};
IDBTransaction.prototype.abort = function () {
    var me = this;
    if (!(me instanceof IDBTransaction)) {
        throw new TypeError('Illegal invocation');
    }
    CFG_js_1.default.DEBUG && console.log('The transaction was aborted', me);
    IDBTransaction.__assertNotFinished(me);
    me.__abortTransaction(null);
};
IDBTransaction.prototype[Symbol.toStringTag] = 'IDBTransactionPrototype';
IDBTransaction.__assertVersionChange = function (tx) {
    if (!tx || tx.mode !== 'versionchange') {
        throw (0, DOMException_js_1.createDOMException)('InvalidStateError', 'Not a version transaction');
    }
};
IDBTransaction.__assertNotVersionChange = function (tx) {
    if (tx && tx.mode === 'versionchange') {
        throw (0, DOMException_js_1.createDOMException)('InvalidStateError', 'Cannot be called during a version transaction');
    }
};
IDBTransaction.__assertNotFinished = function (tx) {
    if (!tx || tx.__completed || tx.__abortFinished || tx.__errored) {
        throw (0, DOMException_js_1.createDOMException)('InvalidStateError', 'Transaction finished by commit or abort');
    }
};
// object store methods behave differently: see https://github.com/w3c/IndexedDB/issues/192
IDBTransaction.__assertNotFinishedObjectStoreMethod = function (tx) {
    try {
        IDBTransaction.__assertNotFinished(tx);
    }
    catch (err) {
        if (tx && !tx.__completed && !tx.__abortFinished) {
            throw (0, DOMException_js_1.createDOMException)('TransactionInactiveError', 'A request was placed against a transaction which is currently not active, or which is finished');
        }
        throw err;
    }
};
IDBTransaction.__assertActive = function (tx) {
    if (!tx || !tx.__active) {
        throw (0, DOMException_js_1.createDOMException)('TransactionInactiveError', 'A request was placed against a transaction which is currently not active, or which is finished');
    }
};
/**
* Used by our `EventTarget.prototype` library to implement bubbling/capturing.
* @returns {IDBDatabase}
*/
IDBTransaction.prototype.__getParent = function () {
    return this.db;
};
util.defineOuterInterface(IDBTransaction.prototype, listeners);
util.defineReadonlyOuterInterface(IDBTransaction.prototype, readonlyProperties);
Object.defineProperty(IDBTransaction.prototype, 'constructor', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: IDBTransaction
});
Object.defineProperty(IDBTransaction, 'prototype', {
    writable: false
});
exports.default = IDBTransaction;
