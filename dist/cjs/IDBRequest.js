"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DOMException_1 = require("./DOMException");
var eventtargeter_1 = require("eventtargeter");
var util = require("./util");
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
exports.IDBRequest = IDBRequest;
IDBRequest.__super = function IDBRequest() {
    var _this = this;
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
                    throw DOMException_1.createDOMException('InvalidStateError', "Can't get " + prop + '; the request is still pending.');
                }
                return this['__' + prop];
            }
        });
    }, this);
    util.defineReadonlyProperties(this, readonlyProperties);
    listeners.forEach(function (listener) {
        Object.defineProperty(_this, listener, {
            configurable: true,
            get: function () {
                return this['__' + listener];
            },
            set: function (val) {
                this['__' + listener] = val;
            }
        });
    }, this);
    listeners.forEach(function (l) {
        _this[l] = null;
    });
    this.__result = undefined;
    this.__error = this.__source = this.__transaction = null;
    this.__readyState = 'pending';
};
IDBRequest.__createInstance = function () {
    return new IDBRequest.__super();
};
IDBRequest.prototype = eventtargeter_1.EventTargetFactory.createInstance({ extraProperties: ['debug'] });
IDBRequest.prototype[Symbol.toStringTag] = 'IDBRequestPrototype';
IDBRequest.prototype.__getParent = function () {
    if (this.toString() === '[object IDBOpenDBRequest]') {
        return null;
    }
    return this.__transaction;
};
// Illegal invocations
readonlyProperties.forEach(function (prop) {
    Object.defineProperty(IDBRequest.prototype, prop, {
        enumerable: true,
        configurable: true,
        get: function () {
            throw new TypeError('Illegal invocation');
        }
    });
});
doneFlagGetters.forEach(function (prop) {
    Object.defineProperty(IDBRequest.prototype, prop, {
        enumerable: true,
        configurable: true,
        get: function () {
            throw new TypeError('Illegal invocation');
        }
    });
});
listeners.forEach(function (listener) {
    Object.defineProperty(IDBRequest.prototype, listener, {
        enumerable: true,
        configurable: true,
        get: function () {
            throw new TypeError('Illegal invocation');
        },
        set: function (val) {
            throw new TypeError('Illegal invocation');
        }
    });
});
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
exports.IDBOpenDBRequest = IDBOpenDBRequest;
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
        var _this = this;
        IDBRequest.__super.call(this);
        this[Symbol.toStringTag] = 'IDBOpenDBRequest';
        this.__setOptions({
            legacyOutputDidListenersThrowFlag: true,
            extraProperties: ['oldVersion', 'newVersion', 'debug']
        }); // Ensure EventTarget preserves our properties
        openListeners.forEach(function (listener) {
            Object.defineProperty(_this, listener, {
                configurable: true,
                get: function () {
                    return this['__' + listener];
                },
                set: function (val) {
                    this['__' + listener] = val;
                }
            });
        }, this);
        openListeners.forEach(function (l) {
            _this[l] = null;
        });
    }
    IDBOpenDBRequest.prototype = IDBOpenDBRequestAlias.prototype;
    return new IDBOpenDBRequest();
};
openListeners.forEach(function (listener) {
    Object.defineProperty(IDBOpenDBRequest.prototype, listener, {
        enumerable: true,
        configurable: true,
        get: function () {
            throw new TypeError('Illegal invocation');
        },
        set: function (val) {
            throw new TypeError('Illegal invocation');
        }
    });
});
IDBOpenDBRequest.prototype[Symbol.toStringTag] = 'IDBOpenDBRequestPrototype';
Object.defineProperty(IDBOpenDBRequest, 'prototype', {
    writable: false
});
