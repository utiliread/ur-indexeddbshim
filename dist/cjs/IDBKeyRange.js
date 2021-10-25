"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.convertValueToKeyRange = exports.IDBKeyRange = exports.setSQLForKeyRange = void 0;
var DOMException_1 = require("./DOMException");
var Key = require("./Key");
var util = require("./util");
var readonlyProperties = ['lower', 'upper', 'lowerOpen', 'upperOpen'];
/**
 * The IndexedDB KeyRange object
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#dfn-key-range
 * @param {Object} lower
 * @param {Object} upper
 * @param {Object} lowerOpen
 * @param {Object} upperOpen
 */
function IDBKeyRange() {
    throw new TypeError('Illegal constructor');
}
exports.IDBKeyRange = IDBKeyRange;
exports.default = IDBKeyRange;
var IDBKeyRangeAlias = IDBKeyRange;
IDBKeyRange.__createInstance = function (lower, upper, lowerOpen, upperOpen) {
    function IDBKeyRange() {
        this[Symbol.toStringTag] = 'IDBKeyRange';
        if (lower === undefined && upper === undefined) {
            throw (0, DOMException_1.createDOMException)('DataError', 'Both arguments to the key range method cannot be undefined');
        }
        var lowerConverted, upperConverted;
        if (lower !== undefined) {
            lowerConverted = Key.roundTrip(lower); // Todo: does this make the "conversions" redundant
            Key.convertValueToKeyRethrowingAndIfInvalid(lower);
        }
        if (upper !== undefined) {
            upperConverted = Key.roundTrip(upper); // Todo: does this make the "conversions" redundant
            Key.convertValueToKeyRethrowingAndIfInvalid(upper);
        }
        if (lower !== undefined && upper !== undefined && lower !== upper) {
            if (Key.encode(lower) > Key.encode(upper)) {
                throw (0, DOMException_1.createDOMException)('DataError', '`lower` must not be greater than `upper` argument in `bound()` call.');
            }
        }
        this.__lower = lowerConverted;
        this.__upper = upperConverted;
        this.__lowerOpen = Boolean(lowerOpen);
        this.__upperOpen = Boolean(upperOpen);
    }
    IDBKeyRange.prototype = IDBKeyRangeAlias.prototype;
    return new IDBKeyRange();
};
IDBKeyRange.prototype.includes = function (key) {
    // We can't do a regular instanceof check as it will create a loop given our hasInstance implementation
    if (!util.isObj(this) || typeof this.__lowerOpen !== 'boolean') {
        throw new TypeError('Illegal invocation');
    }
    if (!arguments.length) {
        throw new TypeError('IDBKeyRange.includes requires a key argument');
    }
    Key.convertValueToKeyRethrowingAndIfInvalid(key);
    return Key.isKeyInRange(key, this);
};
IDBKeyRange.only = function (value) {
    if (!arguments.length) {
        throw new TypeError('IDBKeyRange.only requires a value argument');
    }
    return IDBKeyRange.__createInstance(value, value, false, false);
};
IDBKeyRange.lowerBound = function (value /*, open */) {
    if (!arguments.length) {
        throw new TypeError('IDBKeyRange.lowerBound requires a value argument');
    }
    return IDBKeyRange.__createInstance(value, undefined, arguments[1], true);
};
IDBKeyRange.upperBound = function (value /*, open */) {
    if (!arguments.length) {
        throw new TypeError('IDBKeyRange.upperBound requires a value argument');
    }
    return IDBKeyRange.__createInstance(undefined, value, true, arguments[1]);
};
IDBKeyRange.bound = function (lower, upper /* , lowerOpen, upperOpen */) {
    if (arguments.length <= 1) {
        throw new TypeError('IDBKeyRange.bound requires lower and upper arguments');
    }
    return IDBKeyRange.__createInstance(lower, upper, arguments[2], arguments[3]);
};
IDBKeyRange.prototype[Symbol.toStringTag] = 'IDBKeyRangePrototype';
readonlyProperties.forEach(function (prop) {
    var _a;
    Object.defineProperty(IDBKeyRange.prototype, '__' + prop, {
        enumerable: false,
        configurable: false,
        writable: true
    });
    // Ensure for proper interface testing that "get <name>" is the function name
    var o = (_a = {},
        Object.defineProperty(_a, prop, {
            get: function () {
                // We can't do a regular instanceof check as it will create a loop given our hasInstance implementation
                if (!util.isObj(this) || typeof this.__lowerOpen !== 'boolean') {
                    throw new TypeError('Illegal invocation');
                }
                return this['__' + prop];
            },
            enumerable: false,
            configurable: true
        }),
        _a);
    var desc = Object.getOwnPropertyDescriptor(o, prop);
    // desc.enumerable = true; // Default
    // desc.configurable = true; // Default
    Object.defineProperty(IDBKeyRange.prototype, prop, desc);
});
Object.defineProperty(IDBKeyRange, Symbol.hasInstance, {
    value: function (obj) { return util.isObj(obj) && 'upper' in obj && typeof obj.lowerOpen === 'boolean'; }
});
Object.defineProperty(IDBKeyRange, 'prototype', {
    writable: false
});
function setSQLForKeyRange(range, quotedKeyColumnName, sql, sqlValues, addAnd, checkCached) {
    if (range && (range.lower !== undefined || range.upper !== undefined)) {
        if (addAnd)
            sql.push('AND');
        var encodedLowerKey = void 0, encodedUpperKey = void 0;
        var hasLower = range.lower !== undefined;
        var hasUpper = range.upper !== undefined;
        if (hasLower) {
            encodedLowerKey = checkCached ? range.__lowerCached : Key.encode(range.lower);
        }
        if (hasUpper) {
            encodedUpperKey = checkCached ? range.__upperCached : Key.encode(range.upper);
        }
        if (hasLower) {
            sqlValues.push(util.escapeSQLiteStatement(encodedLowerKey));
            if (hasUpper && encodedLowerKey === encodedUpperKey && !range.lowerOpen && !range.upperOpen) {
                sql.push(quotedKeyColumnName, '=', '?');
                return;
            }
            sql.push(quotedKeyColumnName, (range.lowerOpen ? '>' : '>='), '?');
        }
        (hasLower && hasUpper) && sql.push('AND');
        if (hasUpper) {
            sql.push(quotedKeyColumnName, (range.upperOpen ? '<' : '<='), '?');
            sqlValues.push(util.escapeSQLiteStatement(encodedUpperKey));
        }
    }
}
exports.setSQLForKeyRange = setSQLForKeyRange;
function convertValueToKeyRange(value, nullDisallowed) {
    if (util.instanceOf(value, IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on loose duck-typing)
        if (value.toString() !== '[object IDBKeyRange]') {
            return IDBKeyRange.__createInstance(value.lower, value.upper, value.lowerOpen, value.upperOpen);
        }
        return value;
    }
    if (util.isNullish(value)) {
        if (nullDisallowed) {
            throw (0, DOMException_1.createDOMException)('DataError', 'No key or range was specified');
        }
        return undefined; // Represents unbounded
    }
    Key.convertValueToKeyRethrowingAndIfInvalid(value);
    return IDBKeyRange.only(value);
}
exports.convertValueToKeyRange = convertValueToKeyRange;
