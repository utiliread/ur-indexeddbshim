"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var typeson_1 = require("typeson");
var structured_cloning_throwing_1 = require("typeson-registry/dist/presets/structured-cloning-throwing");
// import Blob from 'w3c-blob'; // Needed by Node; uses native if available (browser)
var DOMException_1 = require("./DOMException");
// Todo: Register `ImageBitmap` and add `Blob`/`File`/`FileList`
// Todo: add a proper polyfill for `ImageData` using node-canvas
// See also: http://stackoverflow.com/questions/42170826/categories-for-rejection-by-the-structured-cloning-algorithm
function traverseMapToRevertToLegacyTypeNames(obj) {
    if (Array.isArray(obj)) {
        return obj.forEach(traverseMapToRevertToLegacyTypeNames);
    }
    if (obj && typeof obj === 'object') { // Should be all
        Object.entries(obj).forEach(function (_a) {
            var prop = _a[0], val = _a[1];
            if (prop in newTypeNamesToLegacy) {
                var legacyProp = newTypeNamesToLegacy[prop];
                delete obj[prop];
                obj[legacyProp] = val;
            }
        });
    }
}
var structuredCloning = structured_cloning_throwing_1.default;
var newTypeNamesToLegacy = {
    IntlCollator: 'Intl.Collator',
    IntlDateTimeFormat: 'Intl.DateTimeFormat',
    IntlNumberFormat: 'Intl.NumberFormat',
    userObject: 'userObjects',
    undef: 'undefined',
    negativeInfinity: 'NegativeInfinity',
    nonbuiltinIgnore: 'nonBuiltInIgnore',
    arraybuffer: 'ArrayBuffer',
    blob: 'Blob',
    dataview: 'DataView',
    date: 'Date',
    error: 'Error',
    file: 'File',
    filelist: 'FileList',
    imagebitmap: 'ImageBitmap',
    imagedata: 'ImageData',
    infinity: 'Infinity',
    map: 'Map',
    nan: 'NaN',
    regexp: 'RegExp',
    set: 'Set',
    int8array: 'Int8Array',
    uint8array: 'Uint8Array',
    uint8clampedarray: 'Uint8ClampedArray',
    int16array: 'Int16Array',
    uint16array: 'Uint16Array',
    int32array: 'Int32Array',
    uint32array: 'Uint32Array',
    float32array: 'Float32Array',
    float64array: 'Float64Array'
};
// Todo: We should make this conditional on CONFIG and deprecate the legacy
//   names, but for compatibility with data created under this major version,
//   we need the legacy now
// console.log('StructuredCloning1', JSON.stringify(structuredCloning));
traverseMapToRevertToLegacyTypeNames(structuredCloning);
// console.log('StructuredCloning2', JSON.stringify(structuredCloning));
var typeson = new typeson_1.default().register(structuredCloning);
// We are keeping the callback approach for now in case we wish to reexpose Blob, File, FileList
function encode(obj, cb) {
    var ret;
    try {
        ret = typeson.stringifySync(obj);
    }
    catch (err) {
        // SCA in typeson-registry using `DOMException` which is not defined (e.g., in Node)
        if (typeson_1.default.hasConstructorOf(err, ReferenceError) ||
            // SCA in typeson-registry threw a cloning error and we are in a
            //   supporting environment (e.g., the browser) where `ShimDOMException` is
            //   an alias for `DOMException`; if typeson-registry ever uses our shim
            //   to throw, we can use this condition alone.
            typeson_1.default.hasConstructorOf(err, DOMException_1.ShimDOMException)) {
            throw DOMException_1.createDOMException('DataCloneError', 'The object cannot be cloned.');
        }
        // We should rethrow non-cloning exceptions like from
        //  throwing getters (as in the W3C test, key-conversion-exceptions.htm)
        throw err;
    }
    if (cb)
        cb(ret);
    return ret;
}
exports.encode = encode;
function decode(obj) {
    return typeson.parse(obj);
}
exports.decode = decode;
function clone(val) {
    // We don't return the intermediate `encode` as we'll need to reencode the clone as it may differ
    return decode(encode(val));
}
exports.clone = clone;
