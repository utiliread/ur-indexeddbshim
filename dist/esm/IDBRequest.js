import { EventTargetFactory } from 'eventtargeter';
import { createDOMException } from './DOMException';
import * as util from './util';
var listeners = ['onsuccess', 'onerror'];
var readonlyProperties = ['source', 'transaction', 'readyState'];
var doneFlagGetters = ['result', 'error'];
/**
 * The IDBRequest Object that is returns for all async calls
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#request-api
 */
function IDBRequest() {
    throw new TypeError('Illegal constructor');
}
IDBRequest.__super = function IDBRequest() {
    this[Symbol.toStringTag] = 'IDBRequest';
    this.__setOptions({
        legacyOutputDidListenersThrowFlag: true // Event hook for IndexedB
    });
    doneFlagGetters.forEach(function (prop) {
        Object.defineProperty(this, '__' + prop, {
            enumerable: false,
            configurable: false,
            writable: true
        });
        Object.defineProperty(this, prop, {
            enumerable: true,
            configurable: true,
            get: function () {
                if (this.__readyState !== 'done') {
                    throw createDOMException('InvalidStateError', "Can't get " + prop + '; the request is still pending.');
                }
                return this['__' + prop];
            }
        });
    }, this);
    util.defineReadonlyProperties(this, readonlyProperties);
    util.defineListenerProperties(this, listeners);
    this.__result = undefined;
    this.__error = this.__source = this.__transaction = null;
    this.__readyState = 'pending';
};
IDBRequest.__createInstance = function () {
    return new IDBRequest.__super();
};
IDBRequest.prototype = EventTargetFactory.createInstance({ extraProperties: ['debug'] });
IDBRequest.prototype[Symbol.toStringTag] = 'IDBRequestPrototype';
IDBRequest.prototype.__getParent = function () {
    if (this.toString() === '[object IDBOpenDBRequest]') {
        return null;
    }
    return this.__transaction;
};
// Illegal invocations
util.defineReadonlyOuterInterface(IDBRequest.prototype, readonlyProperties);
util.defineReadonlyOuterInterface(IDBRequest.prototype, doneFlagGetters);
util.defineOuterInterface(IDBRequest.prototype, listeners);
Object.defineProperty(IDBRequest.prototype, 'constructor', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: IDBRequest
});
IDBRequest.__super.prototype = IDBRequest.prototype;
Object.defineProperty(IDBRequest, 'prototype', {
    writable: false
});
var openListeners = ['onblocked', 'onupgradeneeded'];
/**
 * The IDBOpenDBRequest called when a database is opened
 */
function IDBOpenDBRequest() {
    throw new TypeError('Illegal constructor');
}
IDBOpenDBRequest.prototype = Object.create(IDBRequest.prototype);
Object.defineProperty(IDBOpenDBRequest.prototype, 'constructor', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: IDBOpenDBRequest
});
var IDBOpenDBRequestAlias = IDBOpenDBRequest;
IDBOpenDBRequest.__createInstance = function () {
    function IDBOpenDBRequest() {
        IDBRequest.__super.call(this);
        this[Symbol.toStringTag] = 'IDBOpenDBRequest';
        this.__setOptions({
            legacyOutputDidListenersThrowFlag: true,
            extraProperties: ['oldVersion', 'newVersion', 'debug']
        }); // Ensure EventTarget preserves our properties
        util.defineListenerProperties(this, openListeners);
    }
    IDBOpenDBRequest.prototype = IDBOpenDBRequestAlias.prototype;
    return new IDBOpenDBRequest();
};
util.defineOuterInterface(IDBOpenDBRequest.prototype, openListeners);
IDBOpenDBRequest.prototype[Symbol.toStringTag] = 'IDBOpenDBRequestPrototype';
Object.defineProperty(IDBOpenDBRequest, 'prototype', {
    writable: false
});
export { IDBRequest, IDBOpenDBRequest };
