"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env browser, worker */
var setGlobalVars_js_1 = require("./setGlobalVars.js");
var CFG_js_1 = require("./CFG.js");
CFG_js_1.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers
(0, setGlobalVars_js_1.default)();
