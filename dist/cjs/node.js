"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var setGlobalVars_js_1 = require("./setGlobalVars.js");
var nodeWebSQL_js_1 = require("./nodeWebSQL.js"); // Importing "websql" would not gain us SQLite config ability
var CFG_js_1 = require("./CFG.js");
// eslint-disable-next-line import/no-commonjs
var fs = require('fs');
CFG_js_1.default.win = { openDatabase: nodeWebSQL_js_1.default };
var __setGlobalVars = function (idb, initialConfig) {
    if (initialConfig === void 0) { initialConfig = {}; }
    return (0, setGlobalVars_js_1.default)(idb, __assign({ fs: fs }, initialConfig));
};
exports.default = __setGlobalVars;
