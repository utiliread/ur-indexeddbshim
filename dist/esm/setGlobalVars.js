/* globals self */
import { setPrototypeOfCustomEvent } from 'eventtargeter';
import shimIDBVersionChangeEvent from './IDBVersionChangeEvent';
import { IDBCursor as shimIDBCursor, IDBCursorWithValue as shimIDBCursorWithValue } from './IDBCursor';
import { IDBRequest as shimIDBRequest, IDBOpenDBRequest as shimIDBOpenDBRequest } from './IDBRequest';
import { createDOMException, ShimDOMException } from './DOMException';
import { shimIndexedDB, IDBFactory } from './IDBFactory';
import DOMStringList from './DOMStringList';
import { ShimEvent, ShimCustomEvent, ShimEventTarget } from './Event';
import { register } from './Sca';
import shimIDBKeyRange from './IDBKeyRange';
import shimIDBObjectStore from './IDBObjectStore';
import shimIDBIndex from './IDBIndex';
import shimIDBTransaction from './IDBTransaction';
import shimIDBDatabase from './IDBDatabase';
import CFG from './CFG';
import { isNullish } from './util';
function setConfig(prop, val) {
    if (prop && typeof prop === 'object') {
        Object.entries(prop).forEach(function (_a) {
            var p = _a[0], val = _a[1];
            setConfig(p, val);
        });
        return;
    }
    if (!(prop in CFG)) {
        throw new Error(prop + ' is not a valid configuration property');
    }
    CFG[prop] = val;
    if (prop === 'registerSCA' && typeof val === 'function') {
        register(val);
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
    if (CFG.win.openDatabase !== undefined) {
        shim('shimIndexedDB', shimIndexedDB, {
            enumerable: false,
            configurable: true
        });
    }
    if (IDB.shimIndexedDB) {
        IDB.shimIndexedDB.__useShim = function () {
            function setNonIDBGlobals(prefix) {
                if (prefix === void 0) { prefix = ''; }
                shim(prefix + 'DOMException', ShimDOMException);
                shim(prefix + 'DOMStringList', DOMStringList, {
                    enumerable: false,
                    configurable: true,
                    writable: true,
                    value: DOMStringList
                });
                shim(prefix + 'Event', ShimEvent, {
                    configurable: true,
                    writable: true,
                    value: ShimEvent,
                    enumerable: false
                });
                shim(prefix + 'CustomEvent', ShimCustomEvent, {
                    configurable: true,
                    writable: true,
                    value: ShimCustomEvent,
                    enumerable: false
                });
                shim(prefix + 'EventTarget', ShimEventTarget, {
                    configurable: true,
                    writable: true,
                    value: ShimEventTarget,
                    enumerable: false
                });
            }
            var shimIDBFactory = IDBFactory;
            if (CFG.win.openDatabase !== undefined) {
                shimIndexedDB.__openDatabase = CFG.win.openDatabase.bind(CFG.win); // We cache here in case the function is overwritten later as by the IndexedDB support promises tests
                // Polyfill ALL of IndexedDB, using WebSQL
                shim('indexedDB', shimIndexedDB, {
                    enumerable: true,
                    configurable: true,
                    get: function () {
                        if (this !== IDB && !isNullish(this) && !this.shimNS) { // Latter is hack for test environment
                            throw new TypeError('Illegal invocation');
                        }
                        return shimIndexedDB;
                    }
                });
                [
                    ['IDBFactory', shimIDBFactory],
                    ['IDBDatabase', shimIDBDatabase],
                    ['IDBObjectStore', shimIDBObjectStore],
                    ['IDBIndex', shimIDBIndex],
                    ['IDBTransaction', shimIDBTransaction],
                    ['IDBCursor', shimIDBCursor],
                    ['IDBCursorWithValue', shimIDBCursorWithValue],
                    ['IDBKeyRange', shimIDBKeyRange],
                    ['IDBRequest', shimIDBRequest],
                    ['IDBOpenDBRequest', shimIDBOpenDBRequest],
                    ['IDBVersionChangeEvent', shimIDBVersionChangeEvent]
                ].forEach(function (_a) {
                    var prop = _a[0], obj = _a[1];
                    shim(prop, obj, {
                        enumerable: false,
                        configurable: true
                    });
                });
                if (CFG.fullIDLSupport) {
                    // Slow per MDN so off by default! Though apparently needed for WebIDL: http://stackoverflow.com/questions/41927589/rationales-consequences-of-webidl-class-inheritance-requirements
                    Object.setPrototypeOf(IDB.IDBOpenDBRequest, IDB.IDBRequest);
                    Object.setPrototypeOf(IDB.IDBCursorWithValue, IDB.IDBCursor);
                    Object.setPrototypeOf(shimIDBDatabase, ShimEventTarget);
                    Object.setPrototypeOf(shimIDBRequest, ShimEventTarget);
                    Object.setPrototypeOf(shimIDBTransaction, ShimEventTarget);
                    Object.setPrototypeOf(shimIDBVersionChangeEvent, ShimEvent);
                    Object.setPrototypeOf(ShimDOMException, Error);
                    Object.setPrototypeOf(ShimDOMException.prototype, Error.prototype);
                    setPrototypeOfCustomEvent();
                }
                if (IDB.indexedDB && !IDB.indexedDB.toString().includes('[native code]')) {
                    if (CFG.addNonIDBGlobals) {
                        // As `DOMStringList` exists per IDL (and Chrome) in the global
                        //   thread (but not in workers), we prefix the name to avoid
                        //   shadowing or conflicts
                        setNonIDBGlobals('Shim');
                    }
                    if (CFG.replaceNonIDBGlobals) {
                        setNonIDBGlobals();
                    }
                }
                IDB.shimIndexedDB.__setConnectionQueueOrigin();
            }
        };
        IDB.shimIndexedDB.__debug = function (val) {
            CFG.DEBUG = val;
        };
        IDB.shimIndexedDB.__setConfig = setConfig;
        IDB.shimIndexedDB.__getConfig = function (prop) {
            if (!(prop in CFG)) {
                throw new Error(prop + ' is not a valid configuration property');
            }
            return CFG[prop];
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
    if (!CFG.DEFAULT_DB_SIZE) {
        CFG.DEFAULT_DB_SIZE = (( // Safari currently requires larger size: (We don't need a larger size for Node as node-websql doesn't use this info)
        // https://github.com/axemclion/IndexedDBShim/issues/41
        // https://github.com/axemclion/IndexedDBShim/issues/115
        typeof navigator !== 'undefined' &&
            navigator.userAgent.includes('Safari') &&
            !navigator.userAgent.includes('Chrome')) ? 25 : 4) * 1024 * 1024;
    }
    if (!CFG.avoidAutoShim &&
        (!IDB.indexedDB || poorIndexedDbSupport) &&
        CFG.win.openDatabase !== undefined) {
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
// Expose for ease in simulating such exceptions during testing
export { createDOMException };
export default setGlobalVars;
