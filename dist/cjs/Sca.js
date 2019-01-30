"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var typeson_registry_1 = require("typeson-registry");
var DOMException_1 = require("./DOMException");
// See: http://stackoverflow.com/questions/42170826/categories-for-rejection-by-the-structured-cloning-algorithm
var typeson = new typeson_registry_1.default().register(typeson_registry_1.default.presets.structuredCloningThrowing);
function register(func) {
    typeson = new typeson_registry_1.default().register(func(typeson_registry_1.default.presets.structuredCloningThrowing));
}
exports.register = register;
// We are keeping the callback approach for now in case we wish to reexpose
//   `Blob`, `File`, `FileList` asynchronously (though in such a case, we
//   should probably refactor as a Promise)
function encode(obj, func) {
    var ret;
    try {
        ret = typeson.stringifySync(obj);
    }
    catch (err) {
        // SCA in typeson-registry using `DOMException` which is not defined (e.g., in Node)
        if (typeson_registry_1.default.hasConstructorOf(err, ReferenceError) ||
            // SCA in typeson-registry threw a cloning error and we are in a
            //   supporting environment (e.g., the browser) where `ShimDOMException` is
            //   an alias for `DOMException`; if typeson-registry ever uses our shim
            //   to throw, we can use this condition alone.
            typeson_registry_1.default.hasConstructorOf(err, DOMException_1.ShimDOMException)) {
            throw DOMException_1.createDOMException('DataCloneError', 'The object cannot be cloned.');
        }
        // We should rethrow non-cloning exceptions like from
        //  throwing getters (as in the W3C test, key-conversion-exceptions.htm)
        throw err;
    }
    if (func)
        func(ret);
    return ret;
}
exports.encode = encode;
function decode(obj) {
    return typeson.parse(obj);
}
exports.decode = decode;
function clone(val) {
    // We don't return the intermediate `encode` as we'll need to reencode
    //   the clone as it may differ
    return decode(encode(val));
}
exports.clone = clone;
