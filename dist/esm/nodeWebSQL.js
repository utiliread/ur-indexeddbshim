import customOpenDatabase from 'websql/custom';
import SQLiteDatabase from 'websql/lib/sqlite/SQLiteDatabase';
import CFG from './CFG';
function wrappedSQLiteDatabase(name) {
    var db = new SQLiteDatabase(name);
    if (CFG.sqlBusyTimeout) {
        db._db.configure('busyTimeout', CFG.sqlBusyTimeout); // Default is 1000
    }
    if (CFG.sqlTrace) {
        db._db.configure('trace', CFG.sqlTrace);
    }
    if (CFG.sqlProfile) {
        db._db.configure('profile', CFG.sqlProfile);
    }
    return db;
}
var nodeWebSQL = customOpenDatabase(wrappedSQLiteDatabase);
export default nodeWebSQL;
