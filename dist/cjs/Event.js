"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShimEventTarget = exports.ShimCustomEvent = exports.ShimEvent = exports.createEvent = void 0;
var eventtargeter_1 = require("eventtargeter");
Object.defineProperty(exports, "ShimEventTarget", { enumerable: true, get: function () { return eventtargeter_1.ShimEventTarget; } });
Object.defineProperty(exports, "ShimEvent", { enumerable: true, get: function () { return eventtargeter_1.ShimEvent; } });
Object.defineProperty(exports, "ShimCustomEvent", { enumerable: true, get: function () { return eventtargeter_1.ShimCustomEvent; } });
var util = require("./util");
/**
 *
 * @param {string} type
 * @param {Any} debug
 * @param {EventInit} evInit
 * @returns {Event}
 */
function createEvent(type, debug, evInit) {
    var ev = new eventtargeter_1.ShimEvent(type, evInit);
    ev.debug = debug;
    return ev;
}
exports.createEvent = createEvent;
// We don't add within polyfill repo as might not always be the desired implementation
Object.defineProperty(eventtargeter_1.ShimEvent, Symbol.hasInstance, {
    value: function (obj) { return util.isObj(obj) && 'target' in obj && typeof obj.bubbles === 'boolean'; }
});
