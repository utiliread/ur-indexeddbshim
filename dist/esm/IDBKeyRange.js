import { createDOMException } from './DOMException';
import * as Key from './Key';
import * as util from './util';
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
var IDBKeyRangeAlias = IDBKeyRange;
IDBKeyRange.__createInstance = function (lower, upper, lowerOpen, upperOpen) {
    function IDBKeyRange() {
        this[Symbol.toStringTag] = 'IDBKeyRange';
        if (lower === undefined && upper === undefined) {
            throw createDOMException('DataError', 'Both arguments to the key range method cannot be undefined');
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
                throw createDOMException('DataError', '`lower` must not be greater than `upper` argument in `bound()` call.');
            }
        }
        this.__lower = lowerConverted;
        this.__upper = upperConverted;
        this.__lowerOpen = !!lowerOpen;
        this.__upperOpen = !!upperOpen;
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
    Object.defineProperty(IDBKeyRange.prototype, '__' + prop, {
        enumerable: false,
        configurable: false,
        writable: true
    });
    Object.defineProperty(IDBKeyRange.prototype, prop, {
        enumerable: true,
        configurable: true,
        get: function () {
            // We can't do a regular instanceof check as it will create a loop given our hasInstance implementation
            if (!util.isObj(this) || typeof this.__lowerOpen !== 'boolean') {
                throw new TypeError('Illegal invocation');
            }
            return this['__' + prop];
        }
    });
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
function convertValueToKeyRange(value, nullDisallowed) {
    if (util.instanceOf(value, IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on loose duck-typing)
        if (!value.toString() !== '[object IDBKeyRange]') {
            return IDBKeyRange.__createInstance(value.lower, value.upper, value.lowerOpen, value.upperOpen);
        }
        return value;
    }
    if (value == null) {
        if (nullDisallowed) {
            throw createDOMException('DataError', 'No key or range was specified');
        }
        return undefined; // Represents unbounded
    }
    Key.convertValueToKeyRethrowingAndIfInvalid(value);
    return IDBKeyRange.only(value);
}
export { setSQLForKeyRange, IDBKeyRange, convertValueToKeyRange, IDBKeyRange as default };
