"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env browser, worker */
var UnicodeIdentifiers_js_1 = require("./UnicodeIdentifiers.js");
// BEGIN: Same code as in browser.js
var setGlobalVars_js_1 = require("./setGlobalVars.js");
var CFG_js_1 = require("./CFG.js");
CFG_js_1.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers
// END: Same code as in browser.js
CFG_js_1.default.UnicodeIDStart = UnicodeIdentifiers_js_1.UnicodeIDStart;
CFG_js_1.default.UnicodeIDContinue = UnicodeIdentifiers_js_1.UnicodeIDContinue;
exports.default = setGlobalVars_js_1.default;
