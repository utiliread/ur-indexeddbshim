"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var setGlobalVars_1 = require("./setGlobalVars");
var nodeWebSQL_1 = require("./nodeWebSQL"); // Importing "websql" would not gain us SQLite config ability
var CFG_1 = require("./CFG");
var UnicodeIdentifiers = require("./UnicodeIdentifiers");
CFG_1.default.win = { openDatabase: nodeWebSQL_1.default };
var __setGlobalVars = function (idb, initialConfig) {
    var obj = setGlobalVars_1.default(idb, initialConfig);
    obj.shimIndexedDB.__setUnicodeIdentifiers(UnicodeIdentifiers);
    return obj;
};
exports.default = __setGlobalVars;
