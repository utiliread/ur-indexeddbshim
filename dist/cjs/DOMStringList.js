"use strict";
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var _a;
var cleanInterface = false;
var testObject = { test: true };
// Test whether Object.defineProperty really works.
if (Object.defineProperty) {
    try {
        Object.defineProperty(testObject, 'test', { enumerable: false });
        if (testObject.test) {
            cleanInterface = true;
        }
    }
    catch (e) {
        // Object.defineProperty does not work as intended.
    }
}
/**
 * Shim the DOMStringList object.
 *
 */
var DOMStringList = function () {
    throw new TypeError('Illegal constructor');
};
DOMStringList.prototype = (_a = {
        constructor: DOMStringList,
        // Interface.
        contains: function (str) {
            if (!arguments.length) {
                throw new TypeError('DOMStringList.contains must be supplied a value');
            }
            return this._items.includes(str);
        },
        item: function (key) {
            if (!arguments.length) {
                throw new TypeError('DOMStringList.item must be supplied a value');
            }
            if (key < 0 || key >= this.length || !Number.isInteger(key)) {
                return null;
            }
            return this._items[key];
        },
        // Helpers. Should only be used internally.
        clone: function () {
            var stringList = DOMStringList.__createInstance();
            stringList._items = this._items.slice();
            stringList._length = this.length;
            stringList.addIndexes();
            return stringList;
        },
        addIndexes: function () {
            for (var i = 0; i < this._items.length; i++) {
                this[i] = this._items[i];
            }
        },
        sortList: function () {
            // http://w3c.github.io/IndexedDB/#sorted-list
            // https://tc39.github.io/ecma262/#sec-abstract-relational-comparison
            this._items.sort();
            this.addIndexes();
            return this._items;
        },
        forEach: function (cb, thisArg) {
            this._items.forEach(cb, thisArg);
        },
        map: function (cb, thisArg) {
            return this._items.map(cb, thisArg);
        },
        indexOf: function (str) {
            return this._items.indexOf(str);
        },
        push: function (item) {
            this._items.push(item);
            this._length++;
            this.sortList();
        },
        splice: function () {
            var args = []; /* index, howmany, item1, ..., itemX */
            for (var _i = 0 /* index, howmany, item1, ..., itemX */; _i < arguments.length /* index, howmany, item1, ..., itemX */; _i++ /* index, howmany, item1, ..., itemX */) {
                args[_i] = arguments[_i]; /* index, howmany, item1, ..., itemX */
            }
            var _a;
            (_a = this._items).splice.apply(_a, args);
            this._length = this._items.length;
            for (var i in this) {
                if (i === String(parseInt(i, 10))) {
                    delete this[i];
                }
            }
            this.sortList();
        }
    },
    _a[Symbol.toStringTag] = 'DOMStringListPrototype',
    // At least because `DOMStringList`, as a [list](https://infra.spec.whatwg.org/#list)
    //    can be converted to a sequence per https://infra.spec.whatwg.org/#list-iterate
    //    and particularly as some methods, e.g., `IDBDatabase.transaction`
    //    expect such sequence<DOMString> (or DOMString), we need an iterator (some of
    //    the Mocha tests rely on these)
    _a[Symbol.iterator] = function () {
        var i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < this._items.length)) return [3 /*break*/, 3];
                    return [4 /*yield*/, this._items[i++]];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    },
    _a);
Object.defineProperty(DOMStringList, Symbol.hasInstance, {
    value: function (obj) {
        return ({}.toString.call(obj) === 'DOMStringListPrototype');
    }
});
var DOMStringListAlias = DOMStringList;
Object.defineProperty(DOMStringList, '__createInstance', {
    value: function () {
        var DOMStringList = function DOMStringList() {
            this.toString = function () {
                return '[object DOMStringList]';
            };
            // Internal functions on the prototype have been made non-enumerable below.
            Object.defineProperty(this, 'length', {
                enumerable: true,
                get: function () {
                    return this._length;
                }
            });
            this._items = [];
            this._length = 0;
        };
        DOMStringList.prototype = DOMStringListAlias.prototype;
        return new DOMStringList();
    }
});
if (cleanInterface) {
    Object.defineProperty(DOMStringList, 'prototype', {
        writable: false
    });
    var nonenumerableReadonly = ['addIndexes', 'sortList', 'forEach', 'map', 'indexOf', 'push', 'splice', 'constructor', '__createInstance'];
    nonenumerableReadonly.forEach(function (nonenumerableReadonly) {
        Object.defineProperty(DOMStringList.prototype, nonenumerableReadonly, {
            enumerable: false
        });
    });
    // Illegal invocations
    Object.defineProperty(DOMStringList.prototype, 'length', {
        configurable: true,
        enumerable: true,
        get: function () {
            throw new TypeError('Illegal invocation');
        }
    });
    var nonenumerableWritable = ['_items', '_length'];
    nonenumerableWritable.forEach(function (nonenumerableWritable) {
        Object.defineProperty(DOMStringList.prototype, nonenumerableWritable, {
            enumerable: false,
            writable: true
        });
    });
}
exports.default = DOMStringList;
