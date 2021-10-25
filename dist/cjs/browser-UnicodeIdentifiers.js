"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env browser, worker */
/* global shimIndexedDB */
var UnicodeIdentifiers = require("./UnicodeIdentifiers.js");
// BEGIN: Same code as in browser.js
var setGlobalVars_js_1 = require("./setGlobalVars.js");
var CFG_js_1 = require("./CFG.js");
CFG_js_1.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers
(0, setGlobalVars_js_1.default)();
// END: Same code as in browser.js
// eslint-disable-next-line unicorn/prefer-prototype-methods
var __setUnicodeIdentifiers = shimIndexedDB.__setUnicodeIdentifiers.bind(shimIndexedDB);
shimIndexedDB.__setUnicodeIdentifiers = function () {
    __setUnicodeIdentifiers(UnicodeIdentifiers);
};
shimIndexedDB.__setUnicodeIdentifiers();
