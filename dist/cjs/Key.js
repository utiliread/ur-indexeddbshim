"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DOMException_1 = require("./DOMException");
var util = require("./util");
var cmp_1 = require("./cmp");
var CFG_1 = require("./CFG");
/**
 * Encodes the keys based on their types. This is required to maintain collations
 * We leave space for future keys
 */
var keyTypeToEncodedChar = {
    invalid: 100,
    number: 200,
    date: 300,
    string: 400,
    binary: 500,
    array: 600
};
var keyTypes = Object.keys(keyTypeToEncodedChar);
keyTypes.forEach(function (k) {
    keyTypeToEncodedChar[k] = String.fromCharCode(keyTypeToEncodedChar[k]);
});
var encodedCharToKeyType = keyTypes.reduce(function (o, k) {
    o[keyTypeToEncodedChar[k]] = k;
    return o;
}, {});
/**
 * The sign values for numbers, ordered from least to greatest.
 *  - "negativeInfinity": Sorts below all other values.
 *  - "bigNegative": Negative values less than or equal to negative one.
 *  - "smallNegative": Negative values between negative one and zero, noninclusive.
 *  - "smallPositive": Positive values between zero and one, including zero but not one.
 *  - "largePositive": Positive values greater than or equal to one.
 *  - "positiveInfinity": Sorts above all other values.
 */
var signValues = ['negativeInfinity', 'bigNegative', 'smallNegative', 'smallPositive', 'bigPositive', 'positiveInfinity'];
var types = {
    invalid: {
        encode: function (key) {
            return keyTypeToEncodedChar.invalid + '-';
        },
        decode: function (key) {
            return undefined;
        }
    },
    // Numbers are represented in a lexically sortable base-32 sign-exponent-mantissa
    // notation.
    //
    // sign: takes a value between zero and five, inclusive. Represents infinite cases
    //     and the signs of both the exponent and the fractional part of the number.
    // exponent: padded to two base-32 digits, represented by the 32's compliment in the
    //     "smallPositive" and "bigNegative" cases to ensure proper lexical sorting.
    // mantissa: also called the fractional part. Normed 11-digit base-32 representation.
    //     Represented by the 32's compliment in the "smallNegative" and "bigNegative"
    //     cases to ensure proper lexical sorting.
    number: {
        // The encode step checks for six numeric cases and generates 14-digit encoded
        // sign-exponent-mantissa strings.
        encode: function (key) {
            var key32 = key === Number.MIN_VALUE
                // Mocha test `IDBFactory/cmp-spec.js` exposed problem for some
                //   Node (and Chrome) versions with `Number.MIN_VALUE` being treated
                //   as 0
                // https://stackoverflow.com/questions/43305403/number-min-value-and-tostring
                ? '0.' + '0'.repeat(214) + '2'
                : Math.abs(key).toString(32);
            // Get the index of the decimal.
            var decimalIndex = key32.indexOf('.');
            // Remove the decimal.
            key32 = (decimalIndex !== -1) ? key32.replace('.', '') : key32;
            // Get the index of the first significant digit.
            var significantDigitIndex = key32.search(/[^0]/u);
            // Truncate leading zeros.
            key32 = key32.slice(significantDigitIndex);
            var sign, exponent, mantissa;
            // Finite cases:
            if (isFinite(key)) {
                // Negative cases:
                if (key < 0) {
                    // Negative exponent case:
                    if (key > -1) {
                        sign = signValues.indexOf('smallNegative');
                        exponent = padBase32Exponent(significantDigitIndex);
                        mantissa = flipBase32(padBase32Mantissa(key32));
                        // Non-negative exponent case:
                    }
                    else {
                        sign = signValues.indexOf('bigNegative');
                        exponent = flipBase32(padBase32Exponent((decimalIndex !== -1) ? decimalIndex : key32.length));
                        mantissa = flipBase32(padBase32Mantissa(key32));
                    }
                    // Non-negative cases:
                    // Negative exponent case:
                }
                else if (key < 1) {
                    sign = signValues.indexOf('smallPositive');
                    exponent = flipBase32(padBase32Exponent(significantDigitIndex));
                    mantissa = padBase32Mantissa(key32);
                    // Non-negative exponent case:
                }
                else {
                    sign = signValues.indexOf('bigPositive');
                    exponent = padBase32Exponent((decimalIndex !== -1) ? decimalIndex : key32.length);
                    mantissa = padBase32Mantissa(key32);
                }
                // Infinite cases:
            }
            else {
                exponent = zeros(2);
                mantissa = zeros(11);
                sign = signValues.indexOf(key > 0 ? 'positiveInfinity' : 'negativeInfinity');
            }
            return keyTypeToEncodedChar.number + '-' + sign + exponent + mantissa;
        },
        // The decode step must interpret the sign, reflip values encoded as the 32's complements,
        // apply signs to the exponent and mantissa, do the base-32 power operation, and return
        // the original JavaScript number values.
        decode: function (key) {
            var sign = Number(key.substr(2, 1));
            var exponent = key.substr(3, 2);
            var mantissa = key.substr(5, 11);
            switch (signValues[sign]) {
                case 'negativeInfinity':
                    return -Infinity;
                case 'positiveInfinity':
                    return Infinity;
                case 'bigPositive':
                    return pow32(mantissa, exponent);
                case 'smallPositive':
                    exponent = negate(flipBase32(exponent));
                    return pow32(mantissa, exponent);
                case 'smallNegative':
                    exponent = negate(exponent);
                    mantissa = flipBase32(mantissa);
                    return -pow32(mantissa, exponent);
                case 'bigNegative':
                    exponent = flipBase32(exponent);
                    mantissa = flipBase32(mantissa);
                    return -pow32(mantissa, exponent);
                default:
                    throw new Error('Invalid number.');
            }
        }
    },
    // Strings are encoded as JSON strings (with quotes and unicode characters escaped).
    //
    // If the strings are in an array, then some extra encoding is done to make sorting work correctly:
    // Since we can't force all strings to be the same length, we need to ensure that characters line-up properly
    // for sorting, while also accounting for the extra characters that are added when the array itself is encoded as JSON.
    // To do this, each character of the string is prepended with a dash ("-"), and a space is added to the end of the string.
    // This effectively doubles the size of every string, but it ensures that when two arrays of strings are compared,
    // the indexes of each string's characters line up with each other.
    string: {
        encode: function (key, inArray) {
            if (inArray) {
                // prepend each character with a dash, and append a space to the end
                key = key.replace(/(.)/gu, '-$1') + ' ';
            }
            return keyTypeToEncodedChar.string + '-' + key;
        },
        decode: function (key, inArray) {
            key = key.slice(2);
            if (inArray) {
                // remove the space at the end, and the dash before each character
                key = key.substr(0, key.length - 1).replace(/-(.)/gu, '$1');
            }
            return key;
        }
    },
    // Arrays are encoded as JSON strings.
    // An extra, value is added to each array during encoding to make empty arrays sort correctly.
    array: {
        encode: function (key) {
            var encoded = [];
            for (var i = 0; i < key.length; i++) {
                var item = key[i];
                var encodedItem = encode(item, true); // encode the array item
                encoded[i] = encodedItem;
            }
            encoded.push(keyTypeToEncodedChar.invalid + '-'); // append an extra item, so empty arrays sort correctly
            return keyTypeToEncodedChar.array + '-' + JSON.stringify(encoded);
        },
        decode: function (key) {
            var decoded = JSON.parse(key.slice(2));
            decoded.pop(); // remove the extra item
            for (var i = 0; i < decoded.length; i++) {
                var item = decoded[i];
                var decodedItem = decode(item, true); // decode the item
                decoded[i] = decodedItem;
            }
            return decoded;
        }
    },
    // Dates are encoded as ISO 8601 strings, in UTC time zone.
    date: {
        encode: function (key) {
            return keyTypeToEncodedChar.date + '-' + key.toJSON();
        },
        decode: function (key) {
            return new Date(key.slice(2));
        }
    },
    binary: {
        encode: function (key) {
            return keyTypeToEncodedChar.binary + '-' + (key.byteLength
                ? getCopyBytesHeldByBufferSource(key).slice().map(function (b) { return util.padStart(b, 3, '0'); }) // e.g., '255,005,254,000,001,033'
                : '');
        },
        decode: function (key) {
            // Set the entries in buffer's [[ArrayBufferData]] to those in `value`
            var k = key.slice(2);
            var arr = k.length ? k.split(',').map(function (s) { return parseInt(s); }) : [];
            var buffer = new ArrayBuffer(arr.length);
            var uint8 = new Uint8Array(buffer);
            uint8.set(arr);
            return buffer;
        }
    }
};
/**
 * Return a padded base-32 exponent value.
 * @param {number} n
 * @returns {string}
 */
function padBase32Exponent(n) {
    n = n.toString(32);
    return (n.length === 1) ? '0' + n : n;
}
/**
 * Return a padded base-32 mantissa.
 * @param {string} s
 * @returns {string}
 */
function padBase32Mantissa(s) {
    return (s + zeros(11)).slice(0, 11);
}
/**
 * Flips each digit of a base-32 encoded string.
 * @param {string} encoded
 */
function flipBase32(encoded) {
    var flipped = '';
    for (var i = 0; i < encoded.length; i++) {
        flipped += (31 - parseInt(encoded[i], 32)).toString(32);
    }
    return flipped;
}
/**
 * Base-32 power function.
 * RESEARCH: This function does not precisely decode floats because it performs
 * floating point arithmetic to recover values. But can the original values be
 * recovered exactly?
 * Someone may have already figured out a good way to store JavaScript floats as
 * binary strings and convert back. Barring a better method, however, one route
 * may be to generate decimal strings that `parseFloat` decodes predictably.
 * @param {string} mantissa
 * @param {string} exponent
 * @returns {number}
 */
function pow32(mantissa, exponent) {
    exponent = parseInt(exponent, 32);
    if (exponent < 0) {
        return roundToPrecision(parseInt(mantissa, 32) * (Math.pow(32, (exponent - 10))));
    }
    if (exponent < 11) {
        var whole = mantissa.slice(0, exponent);
        whole = parseInt(whole, 32);
        var fraction = mantissa.slice(exponent);
        fraction = parseInt(fraction, 32) * (Math.pow(32, (exponent - 11)));
        return roundToPrecision(whole + fraction);
    }
    var expansion = mantissa + zeros(exponent - 11);
    return parseInt(expansion, 32);
}
/**
 *
 */
function roundToPrecision(num, precision) {
    precision = precision || 16;
    return parseFloat(num.toPrecision(precision));
}
/**
 * Returns a string of n zeros.
 * @param {number} n
 * @returns {string}
 */
function zeros(n) {
    return '0'.repeat(n);
}
/**
 * Negates numeric strings.
 * @param {string} s
 * @returns {string}
 */
function negate(s) {
    return '-' + s;
}
/**
 * Returns the string "number", "date", "string", "binary", or "array"
 */
function getKeyType(key) {
    if (Array.isArray(key))
        return 'array';
    if (util.isDate(key))
        return 'date';
    if (util.isBinary(key))
        return 'binary';
    var keyType = typeof key;
    return ['string', 'number'].includes(keyType) ? keyType : 'invalid';
}
/**
 * Keys must be strings, numbers (besides NaN), Dates (if value is not NaN),
 *   binary objects or Arrays
 * @param input The key input
 * @param seen An array of already seen keys
 */
function convertValueToKey(input, seen) {
    return convertValueToKeyValueDecoded(input, seen, false, true);
}
exports.convertValueToKey = convertValueToKey;
/**
* Currently not in use
*/
function convertValueToMultiEntryKey(input) {
    return convertValueToKeyValueDecoded(input, null, true, true);
}
exports.convertValueToMultiEntryKey = convertValueToMultiEntryKey;
// https://heycam.github.io/webidl/#ref-for-dfn-get-buffer-source-copy-2
function getCopyBytesHeldByBufferSource(O) {
    var offset = 0;
    var length = 0;
    if (ArrayBuffer.isView(O)) { // Has [[ViewedArrayBuffer]] internal slot
        var arrayBuffer = O.buffer;
        if (arrayBuffer === undefined) {
            throw new TypeError('Could not copy the bytes held by a buffer source as the buffer was undefined.');
        }
        offset = O.byteOffset; // [[ByteOffset]] (will also throw as desired if detached)
        length = O.byteLength; // [[ByteLength]] (will also throw as desired if detached)
    }
    else {
        length = O.byteLength; // [[ArrayBufferByteLength]] on ArrayBuffer (will also throw as desired if detached)
    }
    // const octets = new Uint8Array(input);
    // const octets = types.binary.decode(types.binary.encode(input));
    return new Uint8Array(O.buffer || O, offset, length);
}
/**
* Shortcut utility to avoid returning full keys from `convertValueToKey`
*   and subsequent need to process in calling code unless `fullKeys` is
*   set; may throw
*/
function convertValueToKeyValueDecoded(input, seen, multiEntry, fullKeys) {
    seen = seen || [];
    if (seen.includes(input))
        return { type: 'array', invalid: true, message: 'An array key cannot be circular' };
    var type = getKeyType(input);
    var ret = { type: type, value: input };
    switch (type) {
        case 'number': {
            if (Number.isNaN(input)) {
                return { type: 'NaN', invalid: true }; // List as 'NaN' type for convenience of consumers in reporting errors
            }
            return ret;
        }
        case 'string': {
            return ret;
        }
        case 'binary': { // May throw (if detached)
            // Get a copy of the bytes held by the buffer source
            // https://heycam.github.io/webidl/#ref-for-dfn-get-buffer-source-copy-2
            var octets = getCopyBytesHeldByBufferSource(input);
            return { type: 'binary', value: octets };
        }
        case 'array': { // May throw (from binary)
            var len = input.length;
            seen.push(input);
            var keys = [];
            var _loop_1 = function (i) {
                if (!multiEntry && !Object.prototype.hasOwnProperty.call(input, i)) {
                    return { value: { type: type, invalid: true, message: 'Does not have own index property' } };
                }
                try {
                    var entry = input[i];
                    var key_1 = convertValueToKeyValueDecoded(entry, seen, false, fullKeys); // Though steps do not list rethrowing, the next is returnifabrupt when not multiEntry
                    if (key_1.invalid) {
                        if (multiEntry) {
                            return "continue";
                        }
                        return { value: { type: type, invalid: true, message: 'Bad array entry value-to-key conversion' } };
                    }
                    if (!multiEntry ||
                        (!fullKeys && keys.every(function (k) { return cmp_1.default(k, key_1.value) !== 0; })) ||
                        (fullKeys && keys.every(function (k) { return cmp_1.default(k, key_1) !== 0; }))) {
                        keys.push(fullKeys ? key_1 : key_1.value);
                    }
                }
                catch (err) {
                    if (!multiEntry) {
                        throw err;
                    }
                }
            };
            for (var i = 0; i < len; i++) {
                var state_1 = _loop_1(i);
                if (typeof state_1 === "object")
                    return state_1.value;
            }
            return { type: type, value: keys };
        }
        case 'date': {
            if (!Number.isNaN(input.getTime())) {
                return fullKeys ? { type: type, value: input.getTime() } : { type: type, value: new Date(input.getTime()) };
            }
            return { type: type, invalid: true, message: 'Not a valid date' };
            // Falls through
        }
        case 'invalid':
        default: {
            // Other `typeof` types which are not valid keys:
            //    'undefined', 'boolean', 'object' (including `null`), 'symbol', 'function
            var type_1 = input === null ? 'null' : typeof input; // Convert `null` for convenience of consumers in reporting errors
            return { type: type_1, invalid: true, message: 'Not a valid key; type ' + type_1 };
        }
    }
}
exports.convertValueToKeyValueDecoded = convertValueToKeyValueDecoded;
function convertValueToMultiEntryKeyDecoded(key, fullKeys) {
    return convertValueToKeyValueDecoded(key, null, true, fullKeys);
}
exports.convertValueToMultiEntryKeyDecoded = convertValueToMultiEntryKeyDecoded;
/**
* An internal utility
*/
function convertValueToKeyRethrowingAndIfInvalid(input, seen) {
    var key = convertValueToKey(input, seen);
    if (key.invalid) {
        throw DOMException_1.createDOMException('DataError', key.message || 'Not a valid key; type: ' + key.type);
    }
    return key;
}
exports.convertValueToKeyRethrowingAndIfInvalid = convertValueToKeyRethrowingAndIfInvalid;
function extractKeyFromValueUsingKeyPath(value, keyPath, multiEntry) {
    return extractKeyValueDecodedFromValueUsingKeyPath(value, keyPath, multiEntry, true);
}
exports.extractKeyFromValueUsingKeyPath = extractKeyFromValueUsingKeyPath;
/**
* Not currently in use
*/
function evaluateKeyPathOnValue(value, keyPath, multiEntry) {
    return evaluateKeyPathOnValueToDecodedValue(value, keyPath, multiEntry, true);
}
exports.evaluateKeyPathOnValue = evaluateKeyPathOnValue;
/**
* May throw, return `{failure: true}` (e.g., non-object on keyPath resolution)
*    or `{invalid: true}` (e.g., `NaN`)
*/
function extractKeyValueDecodedFromValueUsingKeyPath(value, keyPath, multiEntry, fullKeys) {
    var r = evaluateKeyPathOnValueToDecodedValue(value, keyPath, multiEntry, fullKeys);
    if (r.failure) {
        return r;
    }
    if (!multiEntry) {
        return convertValueToKeyValueDecoded(r.value, null, false, fullKeys);
    }
    return convertValueToMultiEntryKeyDecoded(r.value, fullKeys);
}
exports.extractKeyValueDecodedFromValueUsingKeyPath = extractKeyValueDecodedFromValueUsingKeyPath;
/**
 * Returns the value of an inline key based on a key path (wrapped in an object with key `value`)
 *   or `{failure: true}`
 * @param {object} value
 * @param {string|array} keyPath
 * @param {boolean} multiEntry
 * @returns {undefined|array|string}
 */
function evaluateKeyPathOnValueToDecodedValue(value, keyPath, multiEntry, fullKeys) {
    if (Array.isArray(keyPath)) {
        var result_1 = [];
        return keyPath.some(function (item) {
            var key = evaluateKeyPathOnValueToDecodedValue(value, item, multiEntry, fullKeys);
            if (key.failure) {
                return true;
            }
            result_1.push(key.value);
            return false;
        }, []) ? { failure: true } : { value: result_1 };
    }
    if (keyPath === '') {
        return { value: value };
    }
    var identifiers = keyPath.split('.');
    return identifiers.some(function (idntfr, i) {
        if (idntfr === 'length' && (typeof value === 'string' || Array.isArray(value))) {
            value = value.length;
        }
        else if (util.isBlob(value)) {
            switch (idntfr) {
                case 'size':
                case 'type':
                    value = value[idntfr];
                    break;
            }
        }
        else if (util.isFile(value)) {
            switch (idntfr) {
                case 'name':
                case 'lastModified':
                    value = value[idntfr];
                    break;
                case 'lastModifiedDate':
                    value = new Date(value.lastModified);
                    break;
            }
        }
        else if (!util.isObj(value) || !Object.prototype.hasOwnProperty.call(value, idntfr)) {
            return true;
        }
        else {
            value = value[idntfr];
            return value === undefined;
        }
        return false;
    }) ? { failure: true } : { value: value };
}
/**
 * Sets the inline key value
 * @param {object} value
 * @param {*} key
 * @param {string} keyPath
 */
function injectKeyIntoValueUsingKeyPath(value, key, keyPath) {
    var identifiers = keyPath.split('.');
    var last = identifiers.pop();
    identifiers.forEach(function (identifier) {
        var hop = Object.prototype.hasOwnProperty.call(value, identifier);
        if (!hop) {
            value[identifier] = {};
        }
        value = value[identifier];
    });
    value[last] = key; // key is already a `keyValue` in our processing so no need to convert
}
exports.injectKeyIntoValueUsingKeyPath = injectKeyIntoValueUsingKeyPath;
// See https://github.com/w3c/IndexedDB/pull/146
function checkKeyCouldBeInjectedIntoValue(value, keyPath) {
    var identifiers = keyPath.split('.');
    identifiers.pop();
    for (var i = 0; i < identifiers.length; i++) {
        if (!util.isObj(value)) {
            return false;
        }
        var identifier = identifiers[i];
        var hop = Object.prototype.hasOwnProperty.call(value, identifier);
        if (!hop) {
            return true;
        }
        value = value[identifier];
    }
    return util.isObj(value);
}
exports.checkKeyCouldBeInjectedIntoValue = checkKeyCouldBeInjectedIntoValue;
function isKeyInRange(key, range, checkCached) {
    var lowerMatch = range.lower === undefined;
    var upperMatch = range.upper === undefined;
    var encodedKey = encode(key, true);
    var lower = checkCached ? range.__lowerCached : encode(range.lower, true);
    var upper = checkCached ? range.__upperCached : encode(range.upper, true);
    if (range.lower !== undefined) {
        if (range.lowerOpen && encodedKey > lower) {
            lowerMatch = true;
        }
        if (!range.lowerOpen && encodedKey >= lower) {
            lowerMatch = true;
        }
    }
    if (range.upper !== undefined) {
        if (range.upperOpen && encodedKey < upper) {
            upperMatch = true;
        }
        if (!range.upperOpen && encodedKey <= upper) {
            upperMatch = true;
        }
    }
    return lowerMatch && upperMatch;
}
exports.isKeyInRange = isKeyInRange;
/**
 * Determines whether an index entry matches a multi-entry key value.
 * @param {string} encodedEntry     The entry value (already encoded)
 * @param {string} encodedKey       The full index key (already encoded)
 * @returns {boolean}
 */
function isMultiEntryMatch(encodedEntry, encodedKey) {
    var keyType = encodedCharToKeyType[encodedKey.slice(0, 1)];
    if (keyType === 'array') {
        return encodedKey.indexOf(encodedEntry) > 1;
    }
    return encodedKey === encodedEntry;
}
exports.isMultiEntryMatch = isMultiEntryMatch;
function findMultiEntryMatches(keyEntry, range) {
    var matches = [];
    if (Array.isArray(keyEntry)) {
        for (var i = 0; i < keyEntry.length; i++) {
            var key = keyEntry[i];
            if (Array.isArray(key)) {
                if (range && range.lower === range.upper) {
                    continue;
                }
                if (key.length === 1) {
                    key = key[0];
                }
                else {
                    var nested = findMultiEntryMatches(key, range);
                    if (nested.length > 0) {
                        matches.push(key);
                    }
                    continue;
                }
            }
            if (util.isNullish(range) || isKeyInRange(key, range, true)) {
                matches.push(key);
            }
        }
    }
    else if (util.isNullish(range) || isKeyInRange(keyEntry, range, true)) {
        matches.push(keyEntry);
    }
    return matches;
}
exports.findMultiEntryMatches = findMultiEntryMatches;
/**
* Not currently in use but keeping for spec parity
*/
function convertKeyToValue(key) {
    var type = key.type, value = key.value;
    switch (type) {
        case 'number':
        case 'string': {
            return value;
        }
        case 'array': {
            var array = [];
            var len = value.length;
            var index = 0;
            while (index < len) {
                var entry = convertKeyToValue(value[index]);
                array[index] = entry;
                index++;
            }
            return array;
        }
        case 'date': {
            return new Date(value);
        }
        case 'binary': {
            var len = value.length;
            var buffer = new ArrayBuffer(len);
            // Set the entries in buffer's [[ArrayBufferData]] to those in `value`
            var uint8 = new Uint8Array(buffer, value.byteOffset || 0, value.byteLength);
            uint8.set(value);
            return buffer;
        }
        case 'invalid':
        default:
            throw new Error('Bad key');
    }
}
exports.convertKeyToValue = convertKeyToValue;
function encode(key, inArray) {
    // Bad keys like `null`, `object`, `boolean`, 'function', 'symbol' should not be passed here due to prior validation
    if (key === undefined) {
        return null;
    }
    // array, date, number, string, binary (should already have detected "invalid")
    return types[getKeyType(key)].encode(key, inArray);
}
exports.encode = encode;
function decode(key, inArray) {
    if (typeof key !== 'string') {
        return undefined;
    }
    return types[encodedCharToKeyType[key.slice(0, 1)]].decode(key, inArray);
}
exports.decode = decode;
function roundTrip(key, inArray) {
    return decode(encode(key, inArray), inArray);
}
exports.roundTrip = roundTrip;
var MAX_ALLOWED_CURRENT_NUMBER = 9007199254740992; // 2 ^ 53 (Also equal to `Number.MAX_SAFE_INTEGER + 1`)
function getCurrentNumber(tx, store, func, sqlFailCb) {
    tx.executeSql('SELECT "currNum" FROM __sys__ WHERE "name" = ?', [util.escapeSQLiteStatement(store.__currentName)], function (tx, data) {
        if (data.rows.length !== 1) {
            func(1);
        }
        else {
            func(data.rows.item(0).currNum);
        }
    }, function (tx, error) {
        sqlFailCb(DOMException_1.createDOMException('DataError', 'Could not get the auto increment value for key', error));
    });
}
function assignCurrentNumber(tx, store, num, successCb, failCb) {
    var sql = 'UPDATE __sys__ SET "currNum" = ? WHERE "name" = ?';
    var sqlValues = [num, util.escapeSQLiteStatement(store.__currentName)];
    CFG_1.default.DEBUG && console.log(sql, sqlValues);
    tx.executeSql(sql, sqlValues, function (tx, data) {
        successCb(num);
    }, function (tx, err) {
        failCb(DOMException_1.createDOMException('UnknownError', 'Could not set the auto increment value for key', err));
    });
}
exports.assignCurrentNumber = assignCurrentNumber;
// Bump up the auto-inc counter if the key path-resolved value is valid (greater than old value and >=1) OR
//  if a manually passed in key is valid (numeric and >= 1) and >= any primaryKey
function setCurrentNumber(tx, store, num, successCb, failCb) {
    num = num === MAX_ALLOWED_CURRENT_NUMBER
        ? num + 2 // Since incrementing by one will have no effect in JavaScript on this unsafe max, we represent the max as a number incremented by two. The getting of the current number is never returned to the user and is only used in safe comparisons, so it is safe for us to represent it in this manner
        : num + 1;
    return assignCurrentNumber(tx, store, num, successCb, failCb);
}
function generateKeyForStore(tx, store, cb, sqlFailCb) {
    getCurrentNumber(tx, store, function (key) {
        if (key > MAX_ALLOWED_CURRENT_NUMBER) { // 2 ^ 53 (See <https://github.com/w3c/IndexedDB/issues/147>)
            cb('failure'); // eslint-disable-line standard/no-callback-literal
            return;
        }
        // Increment current number by 1 (we cannot leverage SQLite's
        //  autoincrement (and decrement when not needed), as decrementing
        //  will be overwritten/ignored upon the next insert)
        setCurrentNumber(tx, store, key, function () {
            cb(null, key, key);
        }, sqlFailCb);
    }, sqlFailCb);
}
exports.generateKeyForStore = generateKeyForStore;
// Fractional or numbers exceeding the max do not get changed in the result
//     per https://github.com/w3c/IndexedDB/issues/147
//     so we do not return a key
function possiblyUpdateKeyGenerator(tx, store, key, successCb, sqlFailCb) {
    // Per https://github.com/w3c/IndexedDB/issues/147 , non-finite numbers
    //   (or numbers larger than the max) are now to have the explicit effect of
    //   setting the current number (up to the max), so we do not optimize them
    //   out here
    if (typeof key !== 'number' || key < 1) { // Optimize with no need to get the current number
        // Auto-increment attempted with a bad key;
        //   we are not to change the current number, but the steps don't call for failure
        // Numbers < 1 are optimized out as they will never be greater than the current number which must be at least 1
        successCb();
    }
    else {
        // If auto-increment and the keyPath item is a valid numeric key, get the old auto-increment to compare if the new is higher
        //  to determine which to use and whether to update the current number
        getCurrentNumber(tx, store, function (cn) {
            var value = Math.floor(Math.min(key, MAX_ALLOWED_CURRENT_NUMBER));
            var useNewKeyForAutoInc = value >= cn;
            if (useNewKeyForAutoInc) {
                setCurrentNumber(tx, store, value, function () {
                    successCb(cn); // Supply old current number in case needs to be reverted
                }, sqlFailCb);
            }
            else { // Not updated
                successCb();
            }
        }, sqlFailCb);
    }
}
exports.possiblyUpdateKeyGenerator = possiblyUpdateKeyGenerator;
