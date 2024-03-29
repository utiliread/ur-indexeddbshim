import CFG from './CFG.js';
import { encode as keyEncode, decode as keyDecode } from './Key.js';
/**
 * Compares two keys.
 * @param first
 * @param second
 * @returns {number}
 */
function cmp(first, second) {
    var encodedKey1 = keyEncode(first);
    var encodedKey2 = keyEncode(second);
    var result = encodedKey1 > encodedKey2
        ? 1
        : encodedKey1 === encodedKey2 ? 0 : -1;
    if (CFG.DEBUG) {
        // verify that the keys encoded correctly
        var decodedKey1 = keyDecode(encodedKey1);
        var decodedKey2 = keyDecode(encodedKey2);
        if (typeof first === 'object') {
            first = JSON.stringify(first);
            decodedKey1 = JSON.stringify(decodedKey1);
        }
        if (typeof second === 'object') {
            second = JSON.stringify(second);
            decodedKey2 = JSON.stringify(decodedKey2);
        }
        // Encoding/decoding mismatches are usually due to a loss of
        //   floating-point precision
        if (decodedKey1 !== first) {
            console.warn(first + ' was incorrectly encoded as ' + decodedKey1);
        }
        if (decodedKey2 !== second) {
            console.warn(second + ' was incorrectly encoded as ' + decodedKey2);
        }
    }
    return result;
}
export default cmp;
