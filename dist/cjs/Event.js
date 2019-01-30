"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var eventtargeter_1 = require("eventtargeter");
exports.ShimEventTarget = eventtargeter_1.ShimEventTarget;
exports.ShimEvent = eventtargeter_1.ShimEvent;
exports.ShimCustomEvent = eventtargeter_1.ShimCustomEvent;
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
