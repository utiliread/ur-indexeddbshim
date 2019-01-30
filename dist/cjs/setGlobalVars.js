"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* globals self */
var eventtargeter_1 = require("eventtargeter");
var IDBVersionChangeEvent_1 = require("./IDBVersionChangeEvent");
var IDBCursor_1 = require("./IDBCursor");
var IDBRequest_1 = require("./IDBRequest");
var DOMException_1 = require("./DOMException");
exports.createDOMException = DOMException_1.createDOMException;
var IDBFactory_1 = require("./IDBFactory");
var DOMStringList_1 = require("./DOMStringList");
var Event_1 = require("./Event");
var Sca_1 = require("./Sca");
var IDBKeyRange_1 = require("./IDBKeyRange");
var IDBObjectStore_1 = require("./IDBObjectStore");
var IDBIndex_1 = require("./IDBIndex");
var IDBTransaction_1 = require("./IDBTransaction");
var IDBDatabase_1 = require("./IDBDatabase");
var CFG_1 = require("./CFG");
var util_1 = require("./util");
function setConfig(prop, val) {
    if (prop && typeof prop === 'object') {
        Object.entries(prop).forEach(function (_a) {
            var p = _a[0], val = _a[1];
            setConfig(p, val);
        });
        return;
    }
    if (!(prop in CFG_1.default)) {
        throw new Error(prop + ' is not a valid configuration property');
    }
    CFG_1.default[prop] = val;
    if (prop === 'registerSCA' && typeof val === 'function') {
        Sca_1.register(val);
    }
}
function setGlobalVars(idb, initialConfig) {
    if (initialConfig) {
        setConfig(initialConfig);
    }
    var IDB = idb || (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {})));
    function shim(name, value, propDesc) {
        var _a;
        if (!propDesc || !Object.defineProperty) {
            try {
                // Try setting the property. This will fail if the property is read-only.
                IDB[name] = value;
            }
            catch (e) {
                console.log(e);
            }
        }
        if (IDB[name] !== value && Object.defineProperty) {
            // Setting a read-only property failed, so try re-defining the property
            try {
                var desc = propDesc || {};
                if (!('get' in desc)) {
                    if (!('value' in desc)) {
                        desc.value = value;
                    }
                    if (!('writable' in desc)) {
                        desc.writable = true;
                    }
                }
                else {
                    var o = (_a = {},
                        Object.defineProperty(_a, name, {
                            get: function () {
                                return propDesc.get.call(this);
                            },
                            enumerable: true,
                            configurable: true
                        }),
                        _a);
                    desc = Object.getOwnPropertyDescriptor(o, name);
                }
                Object.defineProperty(IDB, name, desc);
            }
            catch (e) {
                // With `indexedDB`, PhantomJS fails here and below but
                //  not above, while Chrome is reverse (and Firefox doesn't
                //  get here since no WebSQL to use for shimming)
            }
        }
        if (IDB[name] !== value) {
            typeof console !== 'undefined' && console.warn && console.warn('Unable to shim ' + name);
        }
    }
    if (CFG_1.default.win.openDatabase !== undefined) {
        shim('shimIndexedDB', IDBFactory_1.shimIndexedDB, {
            enumerable: false,
            configurable: true
        });
    }
    if (IDB.shimIndexedDB) {
        IDB.shimIndexedDB.__useShim = function () {
            function setNonIDBGlobals(prefix) {
                if (prefix === void 0) { prefix = ''; }
                shim(prefix + 'DOMException', DOMException_1.ShimDOMException);
                shim(prefix + 'DOMStringList', DOMStringList_1.default, {
                    enumerable: false,
                    configurable: true,
                    writable: true,
                    value: DOMStringList_1.default
                });
                shim(prefix + 'Event', Event_1.ShimEvent, {
                    configurable: true,
                    writable: true,
                    value: Event_1.ShimEvent,
                    enumerable: false
                });
                shim(prefix + 'CustomEvent', Event_1.ShimCustomEvent, {
                    configurable: true,
                    writable: true,
                    value: Event_1.ShimCustomEvent,
                    enumerable: false
                });
                shim(prefix + 'EventTarget', Event_1.ShimEventTarget, {
                    configurable: true,
                    writable: true,
                    value: Event_1.ShimEventTarget,
                    enumerable: false
                });
            }
            var shimIDBFactory = IDBFactory_1.IDBFactory;
            if (CFG_1.default.win.openDatabase !== undefined) {
                IDBFactory_1.shimIndexedDB.__openDatabase = CFG_1.default.win.openDatabase.bind(CFG_1.default.win); // We cache here in case the function is overwritten later as by the IndexedDB support promises tests
                // Polyfill ALL of IndexedDB, using WebSQL
                shim('indexedDB', IDBFactory_1.shimIndexedDB, {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        if (this !== IDB && !util_1.isNullish(this) && !this.shimNS) { // Latter is hack for test environment
                            throw new TypeError('Illegal invocation');
                        }
                        return IDBFactory_1.shimIndexedDB;
                    }
                });
                [
                    ['IDBFactory', shimIDBFactory],
                    ['IDBDatabase', IDBDatabase_1.default],
                    ['IDBObjectStore', IDBObjectStore_1.default],
                    ['IDBIndex', IDBIndex_1.default],
                    ['IDBTransaction', IDBTransaction_1.default],
                    ['IDBCursor', IDBCursor_1.IDBCursor],
                    ['IDBCursorWithValue', IDBCursor_1.IDBCursorWithValue],
                    ['IDBKeyRange', IDBKeyRange_1.default],
                    ['IDBRequest', IDBRequest_1.IDBRequest],
                    ['IDBOpenDBRequest', IDBRequest_1.IDBOpenDBRequest],
                    ['IDBVersionChangeEvent', IDBVersionChangeEvent_1.default]
                ].forEach(function (_a) {
                    var prop = _a[0], obj = _a[1];
                    shim(prop, obj, {
                        enumerable: false,
                        configurable: true
                    });
                });
                if (CFG_1.default.fullIDLSupport) {
                    // Slow per MDN so off by default! Though apparently needed for WebIDL: http://stackoverflow.com/questions/41927589/rationales-consequences-of-webidl-class-inheritance-requirements
                    Object.setPrototypeOf(IDB.IDBOpenDBRequest, IDB.IDBRequest);
                    Object.setPrototypeOf(IDB.IDBCursorWithValue, IDB.IDBCursor);
                    Object.setPrototypeOf(IDBDatabase_1.default, Event_1.ShimEventTarget);
                    Object.setPrototypeOf(IDBRequest_1.IDBRequest, Event_1.ShimEventTarget);
                    Object.setPrototypeOf(IDBTransaction_1.default, Event_1.ShimEventTarget);
                    Object.setPrototypeOf(IDBVersionChangeEvent_1.default, Event_1.ShimEvent);
                    Object.setPrototypeOf(DOMException_1.ShimDOMException, Error);
                    Object.setPrototypeOf(DOMException_1.ShimDOMException.prototype, Error.prototype);
                    eventtargeter_1.setPrototypeOfCustomEvent();
                }
                if (IDB.indexedDB && !IDB.indexedDB.toString().includes('[native code]')) {
                    if (CFG_1.default.addNonIDBGlobals) {
                        // As `DOMStringList` exists per IDL (and Chrome) in the global
                        //   thread (but not in workers), we prefix the name to avoid
                        //   shadowing or conflicts
                        setNonIDBGlobals('Shim');
                    }
                    if (CFG_1.default.replaceNonIDBGlobals) {
                        setNonIDBGlobals();
                    }
                }
                IDB.shimIndexedDB.__setConnectionQueueOrigin();
            }
        };
        IDB.shimIndexedDB.__debug = function (val) {
            CFG_1.default.DEBUG = val;
        };
        IDB.shimIndexedDB.__setConfig = setConfig;
        IDB.shimIndexedDB.__getConfig = function (prop) {
            if (!(prop in CFG_1.default)) {
                throw new Error(prop + ' is not a valid configuration property');
            }
            return CFG_1.default[prop];
        };
        IDB.shimIndexedDB.__setUnicodeIdentifiers = function (_a) {
            var UnicodeIDStart = _a.UnicodeIDStart, UnicodeIDContinue = _a.UnicodeIDContinue;
            setConfig({ UnicodeIDStart: UnicodeIDStart, UnicodeIDContinue: UnicodeIDContinue });
        };
    }
    else {
        // We no-op the harmless set-up properties and methods with a warning; the `IDBFactory` methods,
        //    however (including our non-standard methods), are not stubbed as they ought
        //    to fail earlier rather than potentially having side effects.
        IDB.shimIndexedDB = {};
        ['__useShim', '__debug', '__setConfig', '__getConfig', '__setUnicodeIdentifiers'].forEach(function (prop) {
            IDB.shimIndexedDB[prop] = function () {
                console.warn('This browser does not have WebSQL to shim.');
            };
        });
    }
    // Workaround to prevent an error in Firefox
    if (!('indexedDB' in IDB) && typeof window !== 'undefined') { // 2nd condition avoids problems in Node
        IDB.indexedDB = IDB.indexedDB || IDB.webkitIndexedDB || IDB.mozIndexedDB || IDB.oIndexedDB || IDB.msIndexedDB;
    }
    // Detect browsers with known IndexedDB issues (e.g. Android pre-4.4)
    var poorIndexedDbSupport = false;
    if (typeof navigator !== 'undefined' && ( // Ignore Node or other environments
    (
    // Bad non-Chrome Android support
    (/Android (?:2|3|4\.[0-3])/u).test(navigator.userAgent) &&
        !navigator.userAgent.includes('Chrome')) ||
        (
        // Bad non-Safari iOS9 support (see <https://github.com/axemclion/IndexedDBShim/issues/252>)
        (!navigator.userAgent.includes('Safari') || navigator.userAgent.includes('Chrome')) && // Exclude genuine Safari: http://stackoverflow.com/a/7768006/271577
            // Detect iOS: http://stackoverflow.com/questions/9038625/detect-if-device-is-ios/9039885#9039885
            // and detect version 9: http://stackoverflow.com/a/26363560/271577
            (/(iPad|iPhone|iPod).* os 9_/ui).test(navigator.userAgent) &&
            !window.MSStream // But avoid IE11
        ))) {
        poorIndexedDbSupport = true;
    }
    if (!CFG_1.default.DEFAULT_DB_SIZE) {
        CFG_1.default.DEFAULT_DB_SIZE = (( // Safari currently requires larger size: (We don't need a larger size for Node as node-websql doesn't use this info)
        // https://github.com/axemclion/IndexedDBShim/issues/41
        // https://github.com/axemclion/IndexedDBShim/issues/115
        typeof navigator !== 'undefined' &&
            navigator.userAgent.includes('Safari') &&
            !navigator.userAgent.includes('Chrome')) ? 25 : 4) * 1024 * 1024;
    }
    if (!CFG_1.default.avoidAutoShim &&
        (!IDB.indexedDB || poorIndexedDbSupport) &&
        CFG_1.default.win.openDatabase !== undefined) {
        IDB.shimIndexedDB.__useShim();
    }
    else {
        IDB.IDBDatabase = IDB.IDBDatabase || IDB.webkitIDBDatabase;
        IDB.IDBTransaction = IDB.IDBTransaction || IDB.webkitIDBTransaction || {};
        IDB.IDBCursor = IDB.IDBCursor || IDB.webkitIDBCursor;
        IDB.IDBKeyRange = IDB.IDBKeyRange || IDB.webkitIDBKeyRange;
    }
    return IDB;
}
exports.default = setGlobalVars;
