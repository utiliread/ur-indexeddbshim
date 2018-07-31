"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env browser, worker */
var UnicodeIdentifiers_1 = require("./UnicodeIdentifiers");
// BEGIN: Same code as in browser.js
var setGlobalVars_1 = require("./setGlobalVars");
var CFG_1 = require("./CFG");
CFG_1.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers
// END: Same code as in browser.js
CFG_1.default.UnicodeIDStart = UnicodeIdentifiers_1.UnicodeIDStart;
CFG_1.default.UnicodeIDContinue = UnicodeIdentifiers_1.UnicodeIDContinue;
exports.default = setGlobalVars_1.default;
