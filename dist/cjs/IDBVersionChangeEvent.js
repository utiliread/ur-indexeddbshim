"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Event_js_1 = require("./Event.js");
var util = require("./util.js");
var readonlyProperties = ['oldVersion', 'newVersion'];
// Babel apparently having a problem adding `hasInstance` to a class, so we are redefining as a function
function IDBVersionChangeEvent(type /* , eventInitDict */) {
    Event_js_1.ShimEvent.call(this, type);
    this[Symbol.toStringTag] = 'IDBVersionChangeEvent';
    this.toString = function () {
        return '[object IDBVersionChangeEvent]';
    };
    // eslint-disable-next-line prefer-rest-params
    this.__eventInitDict = arguments[1] || {};
}
IDBVersionChangeEvent.prototype = Object.create(Event_js_1.ShimEvent.prototype);
IDBVersionChangeEvent.prototype[Symbol.toStringTag] = 'IDBVersionChangeEventPrototype';
readonlyProperties.forEach(function (prop) {
    var _a;
    // Ensure for proper interface testing that "get <name>" is the function name
    var o = (_a = {},
        Object.defineProperty(_a, prop, {
            get: function () {
                if (!(this instanceof IDBVersionChangeEvent)) {
                    throw new TypeError('Illegal invocation');
                }
                return (this.__eventInitDict && this.__eventInitDict[prop]) || (prop === 'oldVersion' ? 0 : null);
            },
            enumerable: false,
            configurable: true
        }),
        _a);
    var desc = Object.getOwnPropertyDescriptor(o, prop);
    // desc.enumerable = true; // Default
    // desc.configurable = true; // Default
    Object.defineProperty(IDBVersionChangeEvent.prototype, prop, desc);
});
Object.defineProperty(IDBVersionChangeEvent, Symbol.hasInstance, {
    value: function (obj) { return util.isObj(obj) && 'oldVersion' in obj && typeof obj.defaultPrevented === 'boolean'; }
});
Object.defineProperty(IDBVersionChangeEvent.prototype, 'constructor', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: IDBVersionChangeEvent
});
Object.defineProperty(IDBVersionChangeEvent, 'prototype', {
    writable: false
});
exports.default = IDBVersionChangeEvent;
