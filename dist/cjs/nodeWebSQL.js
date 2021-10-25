"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_js_1 = require("websql/custom/index.js");
var SQLiteDatabase_js_1 = require("websql/lib/sqlite/SQLiteDatabase.js");
var CFG_js_1 = require("./CFG.js");
function wrappedSQLiteDatabase(name) {
    var db = new SQLiteDatabase_js_1.default(name);
    if (CFG_js_1.default.sqlBusyTimeout) {
        db._db.configure('busyTimeout', CFG_js_1.default.sqlBusyTimeout); // Default is 1000
    }
    if (CFG_js_1.default.sqlTrace) {
        db._db.configure('trace', CFG_js_1.default.sqlTrace);
    }
    if (CFG_js_1.default.sqlProfile) {
        db._db.configure('profile', CFG_js_1.default.sqlProfile);
    }
    return db;
}
var nodeWebSQL = (0, index_js_1.default)(wrappedSQLiteDatabase);
exports.default = nodeWebSQL;
