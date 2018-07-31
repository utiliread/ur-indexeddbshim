"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CFG_1 = require("./CFG");
var Key_1 = require("./Key");
/**
 * Compares two keys
 * @param key1
 * @param key2
 * @returns {number}
 */
function cmp(first, second) {
    var encodedKey1 = Key_1.encode(first);
    var encodedKey2 = Key_1.encode(second);
    var result = encodedKey1 > encodedKey2 ? 1 : encodedKey1 === encodedKey2 ? 0 : -1;
    if (CFG_1.default.DEBUG) {
        // verify that the keys encoded correctly
        var decodedKey1 = Key_1.decode(encodedKey1);
        var decodedKey2 = Key_1.decode(encodedKey2);
        if (typeof first === 'object') {
            first = JSON.stringify(first);
            decodedKey1 = JSON.stringify(decodedKey1);
        }
        if (typeof second === 'object') {
            second = JSON.stringify(second);
            decodedKey2 = JSON.stringify(decodedKey2);
        }
        // encoding/decoding mismatches are usually due to a loss of floating-point precision
        if (decodedKey1 !== first) {
            console.warn(first + ' was incorrectly encoded as ' + decodedKey1);
        }
        if (decodedKey2 !== second) {
            console.warn(second + ' was incorrectly encoded as ' + decodedKey2);
        }
    }
    return result;
}
exports.default = cmp;
