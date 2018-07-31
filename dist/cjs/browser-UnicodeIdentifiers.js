"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env browser, worker */
/* global shimIndexedDB */
var UnicodeIdentifiers = require("./UnicodeIdentifiers");
// BEGIN: Same code as in browser.js
var setGlobalVars_1 = require("./setGlobalVars");
var CFG_1 = require("./CFG");
CFG_1.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers
setGlobalVars_1.default();
// END: Same code as in browser.js
var __setUnicodeIdentifiers = shimIndexedDB.__setUnicodeIdentifiers.bind(shimIndexedDB);
shimIndexedDB.__setUnicodeIdentifiers = function () {
    __setUnicodeIdentifiers(UnicodeIdentifiers);
};
shimIndexedDB.__setUnicodeIdentifiers();
