"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-env browser, worker */
var setGlobalVars_1 = require("./setGlobalVars");
var CFG_1 = require("./CFG");
CFG_1.default.win = typeof window !== 'undefined' ? window : self; // For Web Workers
(0, setGlobalVars_1.default)();
