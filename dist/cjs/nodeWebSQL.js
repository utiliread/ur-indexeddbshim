"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var custom_1 = require("websql/custom");
var SQLiteDatabase_1 = require("websql/lib/sqlite/SQLiteDatabase");
var CFG_1 = require("./CFG");
function wrappedSQLiteDatabase(name) {
    var db = new SQLiteDatabase_1.default(name);
    if (CFG_1.default.sqlBusyTimeout) {
        db._db.configure('busyTimeout', CFG_1.default.sqlBusyTimeout); // Default is 1000
    }
    if (CFG_1.default.sqlTrace) {
        db._db.configure('trace', CFG_1.default.sqlTrace);
    }
    if (CFG_1.default.sqlProfile) {
        db._db.configure('profile', CFG_1.default.sqlProfile);
    }
    return db;
}
var nodeWebSQL = custom_1.default(wrappedSQLiteDatabase);
exports.default = nodeWebSQL;
