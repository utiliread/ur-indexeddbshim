"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* globals location, Event */
var Event_1 = require("./Event");
var IDBVersionChangeEvent_1 = require("./IDBVersionChangeEvent");
var DOMException_1 = require("./DOMException");
var IDBRequest_1 = require("./IDBRequest");
var cmp_1 = require("./cmp");
exports.cmp = cmp_1.default;
var DOMStringList_1 = require("./DOMStringList");
var util = require("./util");
var Key = require("./Key");
var IDBTransaction_1 = require("./IDBTransaction");
var IDBDatabase_1 = require("./IDBDatabase");
var CFG_1 = require("./CFG");
var sync_promise_1 = require("sync-promise");
var path_1 = require("path");
var getOrigin = function () { return (typeof location !== 'object' || !location) ? 'null' : location.origin; };
var hasNullOrigin = function () { return CFG_1.default.checkOrigin !== false && (getOrigin() === 'null'); };
// Todo: This really should be process and tab-independent so the
//  origin could vary; in the browser, this might be through a
//  `SharedWorker`
var connectionQueue = {};
function processNextInConnectionQueue(name, origin) {
    if (origin === void 0) { origin = getOrigin(); }
    var queueItems = connectionQueue[origin][name];
    if (!queueItems[0]) { // Nothing left to process
        return;
    }
    var _a = queueItems[0], req = _a.req, cb = _a.cb; // Keep in queue to prevent continuation
    function removeFromQueue() {
        queueItems.shift();
        processNextInConnectionQueue(name, origin);
    }
    req.addEventListener('success', removeFromQueue);
    req.addEventListener('error', removeFromQueue);
    cb(req);
}
function addRequestToConnectionQueue(req, name, origin, cb) {
    if (origin === void 0) { origin = getOrigin(); }
    if (!connectionQueue[origin][name]) {
        connectionQueue[origin][name] = [];
    }
    connectionQueue[origin][name].push({ req: req, cb: cb });
    if (connectionQueue[origin][name].length === 1) { // If there are no items in the queue, we have to start it
        processNextInConnectionQueue(name, origin);
    }
}
function triggerAnyVersionChangeAndBlockedEvents(openConnections, req, oldVersion, newVersion) {
    // Todo: For Node (and in browser using service workers if available?) the
    //    connections ought to involve those in any process; should also
    //    auto-close if unloading
    var connectionIsClosed = function (connection) { return connection.__closed; };
    var connectionsClosed = function () { return openConnections.every(connectionIsClosed); };
    return openConnections.reduce(function (promises, entry) {
        if (connectionIsClosed(entry)) {
            return promises;
        }
        return promises.then(function () {
            if (connectionIsClosed(entry)) {
                // Prior onversionchange must have caused this connection to be closed
                return;
            }
            var e = new IDBVersionChangeEvent_1.default('versionchange', { oldVersion: oldVersion, newVersion: newVersion });
            return new sync_promise_1.default(function (resolve) {
                setTimeout(function () {
                    entry.dispatchEvent(e); // No need to catch errors
                    resolve();
                });
            });
        });
    }, sync_promise_1.default.resolve()).then(function () {
        if (!connectionsClosed()) {
            return new sync_promise_1.default(function (resolve) {
                var unblocking = {
                    check: function () {
                        if (connectionsClosed()) {
                            resolve();
                        }
                    }
                };
                var e = new IDBVersionChangeEvent_1.default('blocked', { oldVersion: oldVersion, newVersion: newVersion });
                setTimeout(function () {
                    req.dispatchEvent(e); // No need to catch errors
                    if (!connectionsClosed()) {
                        openConnections.forEach(function (connection) {
                            if (!connectionIsClosed(connection)) {
                                connection.__unblocking = unblocking;
                            }
                        });
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
    });
}
var websqlDBCache = {};
var sysdb;
var nameCounter = 0;
function getLatestCachedWebSQLVersion(name) {
    return Object.keys(websqlDBCache[name]).map(Number).reduce(function (prev, curr) { return curr > prev ? curr : prev; }, 0);
}
function getLatestCachedWebSQLDB(name) {
    return websqlDBCache[name] && websqlDBCache[name][ // eslint-disable-line standard/computed-property-even-spacing
    getLatestCachedWebSQLVersion(name)];
}
function cleanupDatabaseResources(__openDatabase, name, escapedDatabaseName, databaseDeleted, dbError) {
    var useMemoryDatabase = typeof CFG_1.default.memoryDatabase === 'string';
    if (useMemoryDatabase) {
        var latestSQLiteDBCached = websqlDBCache[name] ? getLatestCachedWebSQLDB(name) : null;
        if (!latestSQLiteDBCached) {
            console.warn('Could not find a memory database instance to delete.');
            databaseDeleted();
            return;
        }
        var sqliteDB_1 = latestSQLiteDBCached._db && latestSQLiteDBCached._db._db;
        if (!sqliteDB_1 || !sqliteDB_1.close) {
            console.error('The `openDatabase` implementation does not have the expected `._db._db.close` method for closing the database');
            return;
        }
        sqliteDB_1.close(function (err) {
            if (err) {
                console.warn('Error closing (destroying) memory database');
                return;
            }
            databaseDeleted();
        });
        return;
    }
    if (CFG_1.default.deleteDatabaseFiles !== false && ({}.toString.call(process) === '[object process]')) {
        require('fs').unlink(path_1.default.join(CFG_1.default.databaseBasePath || '', escapedDatabaseName), function (err) {
            if (err && err.code !== 'ENOENT') { // Ignore if file is already deleted
                dbError({ code: 0, message: 'Error removing database file: ' + escapedDatabaseName + ' ' + err });
                return;
            }
            databaseDeleted();
        });
        return;
    }
    var sqliteDB = __openDatabase(path_1.default.join(CFG_1.default.databaseBasePath || '', escapedDatabaseName), 1, name, CFG_1.default.DEFAULT_DB_SIZE);
    sqliteDB.transaction(function (tx) {
        tx.executeSql('SELECT "name" FROM __sys__', [], function (tx, data) {
            var tables = data.rows;
            (function deleteTables(i) {
                if (i >= tables.length) {
                    // If all tables are deleted, delete the housekeeping tables
                    tx.executeSql('DROP TABLE IF EXISTS __sys__', [], function () {
                        databaseDeleted();
                    }, dbError);
                }
                else {
                    // Delete all tables in this database, maintained in the sys table
                    tx.executeSql('DROP TABLE ' + util.escapeStoreNameForSQL(util.unescapeSQLiteResponse(// Avoid double-escaping
                    tables.item(i).name)), [], function () {
                        deleteTables(i + 1);
                    }, function () {
                        deleteTables(i + 1);
                    });
                }
            }(0));
        }, function (e) {
            // __sys__ table does not exist, but that does not mean delete did not happen
            databaseDeleted();
        });
    });
}
/**
 * Creates the sysDB to keep track of version numbers for databases
 **/
function createSysDB(__openDatabase, success, failure) {
    function sysDbCreateError(tx, err) {
        err = DOMException_1.webSQLErrback(err || tx);
        CFG_1.default.DEBUG && console.log('Error in sysdb transaction - when creating dbVersions', err);
        failure(err);
    }
    if (sysdb) {
        success();
    }
    else {
        sysdb = __openDatabase(typeof CFG_1.default.memoryDatabase === 'string'
            ? CFG_1.default.memoryDatabase
            : path_1.default.join((typeof CFG_1.default.sysDatabaseBasePath === 'string'
                ? CFG_1.default.sysDatabaseBasePath
                : (CFG_1.default.databaseBasePath || '')), '__sysdb__' + (CFG_1.default.addSQLiteExtension !== false ? '.sqlite' : '')), 1, 'System Database', CFG_1.default.DEFAULT_DB_SIZE);
        sysdb.transaction(function (systx) {
            systx.executeSql('CREATE TABLE IF NOT EXISTS dbVersions (name BLOB, version INT);', [], function (systx) {
                if (!CFG_1.default.useSQLiteIndexes) {
                    success();
                    return;
                }
                systx.executeSql('CREATE INDEX IF NOT EXISTS dbvname ON dbVersions(name)', [], success, sysDbCreateError);
            }, sysDbCreateError);
        }, sysDbCreateError);
    }
}
/**
 * IDBFactory Class
 * https://w3c.github.io/IndexedDB/#idl-def-IDBFactory
 * @constructor
 */
function IDBFactory() {
    throw new TypeError('Illegal constructor');
}
exports.IDBFactory = IDBFactory;
var IDBFactoryAlias = IDBFactory;
IDBFactory.__createInstance = function () {
    function IDBFactory() {
        this[Symbol.toStringTag] = 'IDBFactory';
        this.modules = {
            Event: typeof Event !== 'undefined' ? Event : Event_1.ShimEvent,
            Error: Error,
            ShimEvent: Event_1.ShimEvent,
            ShimCustomEvent: Event_1.ShimCustomEvent,
            ShimEventTarget: Event_1.ShimEventTarget,
            ShimDOMException: DOMException_1.ShimDOMException,
            ShimDOMStringList: DOMStringList_1.default,
            IDBFactory: IDBFactoryAlias
        };
        this.utils = { createDOMException: DOMException_1.createDOMException }; // Expose for ease in simulating such exceptions during testing
        this.__connections = {};
    }
    IDBFactory.prototype = IDBFactoryAlias.prototype;
    return new IDBFactory();
};
/**
 * The IndexedDB Method to create a new database and return the DB
 * @param {string} name
 * @param {number} version
 */
IDBFactory.prototype.open = function (name /* , version */) {
    var me = this;
    if (!(me instanceof IDBFactory)) {
        throw new TypeError('Illegal invocation');
    }
    var version = arguments[1];
    if (arguments.length === 0) {
        throw new TypeError('Database name is required');
    }
    if (version !== undefined) {
        version = util.enforceRange(version, 'unsigned long long');
        if (version === 0) {
            throw new TypeError('Version cannot be 0');
        }
    }
    if (hasNullOrigin()) {
        throw DOMException_1.createDOMException('SecurityError', 'Cannot open an IndexedDB database from an opaque origin.');
    }
    var req = IDBRequest_1.IDBOpenDBRequest.__createInstance();
    var calledDbCreateError = false;
    if (CFG_1.default.autoName && name === '') {
        name = 'autoNamedDatabase_' + nameCounter++;
    }
    name = String(name); // cast to a string
    var sqlSafeName = util.escapeSQLiteStatement(name);
    var useMemoryDatabase = typeof CFG_1.default.memoryDatabase === 'string';
    var useDatabaseCache = CFG_1.default.cacheDatabaseInstances !== false || useMemoryDatabase;
    var escapedDatabaseName;
    try {
        escapedDatabaseName = util.escapeDatabaseNameForSQLAndFiles(name);
    }
    catch (err) {
        throw err; // new TypeError('You have supplied a database name which does not match the currently supported configuration, possibly due to a length limit enforced for Node compatibility.');
    }
    function dbCreateError(tx, err) {
        if (calledDbCreateError) {
            return;
        }
        err = err ? DOMException_1.webSQLErrback(err) : tx;
        calledDbCreateError = true;
        // Re: why bubbling here (and how cancelable is only really relevant for `window.onerror`) see: https://github.com/w3c/IndexedDB/issues/86
        var evt = Event_1.createEvent('error', err, { bubbles: true, cancelable: true });
        req.__readyState = 'done';
        req.__error = err;
        req.__result = undefined; // Must be undefined if an error per `result` getter
        req.dispatchEvent(evt);
    }
    function setupDatabase(tx, db, oldVersion) {
        tx.executeSql('SELECT "name", "keyPath", "autoInc", "indexList" FROM __sys__', [], function (tx, data) {
            function finishRequest() {
                req.__result = connection;
                req.__readyState = 'done'; // https://github.com/w3c/IndexedDB/pull/202
            }
            var connection = IDBDatabase_1.default.__createInstance(db, name, oldVersion, version, data);
            if (!me.__connections[name]) {
                me.__connections[name] = [];
            }
            me.__connections[name].push(connection);
            if (oldVersion < version) {
                var openConnections = me.__connections[name].slice(0, -1);
                triggerAnyVersionChangeAndBlockedEvents(openConnections, req, oldVersion, version).then(function () {
                    // DB Upgrade in progress
                    var sysdbFinishedCb = function (systx, err, cb) {
                        if (err) {
                            try {
                                systx.executeSql('ROLLBACK', [], cb, cb);
                            }
                            catch (er) {
                                // Browser may fail with expired transaction above so
                                //     no choice but to manually revert
                                sysdb.transaction(function (systx) {
                                    function reportError(msg) {
                                        throw new Error('Unable to roll back upgrade transaction!' + (msg || ''));
                                    }
                                    // Attempt to revert
                                    if (oldVersion === 0) {
                                        systx.executeSql('DELETE FROM dbVersions WHERE "name" = ?', [sqlSafeName], function () {
                                            cb(reportError);
                                        }, reportError);
                                    }
                                    else {
                                        systx.executeSql('UPDATE dbVersions SET "version" = ? WHERE "name" = ?', [oldVersion, sqlSafeName], cb, reportError);
                                    }
                                });
                            }
                            return;
                        }
                        cb(); // In browser, should auto-commit
                    };
                    sysdb.transaction(function (systx) {
                        function versionSet() {
                            var e = new IDBVersionChangeEvent_1.default('upgradeneeded', { oldVersion: oldVersion, newVersion: version });
                            req.__result = connection;
                            connection.__upgradeTransaction = req.__transaction = req.__result.__versionTransaction = IDBTransaction_1.default.__createInstance(req.__result, req.__result.objectStoreNames, 'versionchange');
                            req.__readyState = 'done';
                            req.transaction.__addNonRequestToTransactionQueue(function onupgradeneeded(tx, args, finished, error) {
                                req.dispatchEvent(e);
                                if (e.__legacyOutputDidListenersThrowError) {
                                    DOMException_1.logError('Error', 'An error occurred in an upgradeneeded handler attached to request chain', e.__legacyOutputDidListenersThrowError); // We do nothing else with this error as per spec
                                    req.transaction.__abortTransaction(DOMException_1.createDOMException('AbortError', 'A request was aborted.'));
                                    return;
                                }
                                finished();
                            });
                            req.transaction.on__beforecomplete = function (ev) {
                                connection.__upgradeTransaction = null;
                                req.__result.__versionTransaction = null;
                                sysdbFinishedCb(systx, false, function () {
                                    req.transaction.__transFinishedCb(false, function () {
                                        ev.complete();
                                        req.__transaction = null;
                                    });
                                });
                            };
                            req.transaction.on__preabort = function () {
                                connection.__upgradeTransaction = null;
                                // We ensure any cache is deleted before any request error events fire and try to reopen
                                if (useDatabaseCache) {
                                    if (name in websqlDBCache) {
                                        delete websqlDBCache[name][version];
                                    }
                                }
                            };
                            req.transaction.on__abort = function () {
                                req.__transaction = null;
                                // `readyState` and `result` will be reset anyways by `dbCreateError` but we follow spec:
                                //    see https://github.com/w3c/IndexedDB/issues/161 and
                                //    https://github.com/w3c/IndexedDB/pull/202
                                req.__result = undefined;
                                req.__readyState = 'pending';
                                connection.close();
                                setTimeout(function () {
                                    var err = DOMException_1.createDOMException('AbortError', 'The upgrade transaction was aborted.');
                                    sysdbFinishedCb(systx, err, function (reportError) {
                                        if (oldVersion === 0) {
                                            cleanupDatabaseResources(me.__openDatabase, name, escapedDatabaseName, dbCreateError.bind(null, err), reportError || dbCreateError);
                                            return;
                                        }
                                        dbCreateError(err);
                                    });
                                });
                            };
                            req.transaction.on__complete = function () {
                                if (req.__result.__closed) {
                                    req.__transaction = null;
                                    var err = DOMException_1.createDOMException('AbortError', 'The connection has been closed.');
                                    dbCreateError(err);
                                    return;
                                }
                                // Since this is running directly after `IDBTransaction.complete`,
                                //   there should be a new task. However, while increasing the
                                //   timeout 1ms in `IDBTransaction.__executeRequests` can allow
                                //   `IDBOpenDBRequest.onsuccess` to trigger faster than a new
                                //   transaction as required by "transaction-create_in_versionchange" in
                                //   w3c/Transaction.js (though still on a timeout separate from this
                                //   preceding `IDBTransaction.oncomplete`), this causes a race condition
                                //   somehow with old transactions (e.g., for the Mocha test,
                                //   in `IDBObjectStore.deleteIndex`, "should delete an index that was
                                //   created in a previous transaction").
                                // setTimeout(() => {
                                finishRequest();
                                req.__transaction = null;
                                var e = Event_1.createEvent('success');
                                req.dispatchEvent(e);
                                // });
                            };
                        }
                        if (oldVersion === 0) {
                            systx.executeSql('INSERT INTO dbVersions VALUES (?,?)', [sqlSafeName, version], versionSet, dbCreateError);
                        }
                        else {
                            systx.executeSql('UPDATE dbVersions SET "version" = ? WHERE "name" = ?', [version, sqlSafeName], versionSet, dbCreateError);
                        }
                    }, dbCreateError, null, function (currentTask, err, done, rollback, commit) {
                        if (currentTask.readOnly || err) {
                            return true;
                        }
                        sysdbFinishedCb = function (systx, err, cb) {
                            if (err) {
                                rollback(err, cb);
                            }
                            else {
                                commit(cb);
                            }
                        };
                        return false;
                    });
                });
            }
            else {
                finishRequest();
                var e = Event_1.createEvent('success');
                req.dispatchEvent(e);
            }
        }, dbCreateError);
    }
    function openDB(oldVersion) {
        var db;
        if ((useMemoryDatabase || useDatabaseCache) && name in websqlDBCache && websqlDBCache[name][version]) {
            db = websqlDBCache[name][version];
        }
        else {
            db = me.__openDatabase(useMemoryDatabase ? CFG_1.default.memoryDatabase : path_1.default.join(CFG_1.default.databaseBasePath || '', escapedDatabaseName), 1, name, CFG_1.default.DEFAULT_DB_SIZE);
            if (useDatabaseCache) {
                websqlDBCache[name][version] = db;
            }
        }
        if (version === undefined) {
            version = oldVersion || 1;
        }
        if (oldVersion > version) {
            var err_1 = DOMException_1.createDOMException('VersionError', 'An attempt was made to open a database using a lower version than the existing version.', version);
            if (useDatabaseCache) {
                setTimeout(function () {
                    dbCreateError(err_1);
                });
            }
            else {
                dbCreateError(err_1);
            }
            return;
        }
        db.transaction(function (tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS __sys__ (name BLOB, keyPath BLOB, autoInc BOOLEAN, indexList BLOB, currNum INTEGER)', [], function () {
                function setup() {
                    setupDatabase(tx, db, oldVersion);
                }
                if (!CFG_1.default.createIndexes) {
                    setup();
                    return;
                }
                tx.executeSql('CREATE INDEX IF NOT EXISTS sysname ON __sys__(name)', [], setup, dbCreateError);
            }, dbCreateError);
        }, dbCreateError);
    }
    addRequestToConnectionQueue(req, name, /* origin */ undefined, function (req) {
        var latestCachedVersion;
        if (useDatabaseCache) {
            if (!(name in websqlDBCache)) {
                websqlDBCache[name] = {};
            }
            latestCachedVersion = getLatestCachedWebSQLVersion(name);
        }
        if (latestCachedVersion) {
            openDB(latestCachedVersion);
        }
        else {
            createSysDB(me.__openDatabase, function () {
                sysdb.readTransaction(function (sysReadTx) {
                    sysReadTx.executeSql('SELECT "version" FROM dbVersions WHERE "name" = ?', [sqlSafeName], function (sysReadTx, data) {
                        if (data.rows.length === 0) {
                            // Database with this name does not exist
                            openDB(0);
                        }
                        else {
                            openDB(data.rows.item(0).version);
                        }
                    }, dbCreateError);
                }, dbCreateError);
            }, dbCreateError);
        }
    });
    return req;
};
/**
 * Deletes a database
 * @param {string} name
 * @returns {IDBOpenDBRequest}
 */
IDBFactory.prototype.deleteDatabase = function (name) {
    var me = this;
    if (!(me instanceof IDBFactory)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length === 0) {
        throw new TypeError('Database name is required');
    }
    if (hasNullOrigin()) {
        throw DOMException_1.createDOMException('SecurityError', 'Cannot delete an IndexedDB database from an opaque origin.');
    }
    name = String(name); // cast to a string
    var sqlSafeName = util.escapeSQLiteStatement(name);
    var escapedDatabaseName;
    try {
        escapedDatabaseName = util.escapeDatabaseNameForSQLAndFiles(name);
    }
    catch (err) {
        throw err; // throw new TypeError('You have supplied a database name which does not match the currently supported configuration, possibly due to a length limit enforced for Node compatibility.');
    }
    var useMemoryDatabase = typeof CFG_1.default.memoryDatabase === 'string';
    var useDatabaseCache = CFG_1.default.cacheDatabaseInstances !== false || useMemoryDatabase;
    var req = IDBRequest_1.IDBOpenDBRequest.__createInstance();
    var calledDBError = false;
    var version = 0;
    var sysdbFinishedCbDelete = function (err, cb) {
        cb(err);
    };
    // Although the spec has no specific conditions where an error
    //  may occur in `deleteDatabase`, it does provide for
    //  `UnknownError` as we may require upon a SQL deletion error
    function dbError(tx, err) {
        if (calledDBError || err === true) {
            return;
        }
        err = DOMException_1.webSQLErrback(err || tx);
        sysdbFinishedCbDelete(true, function () {
            req.__readyState = 'done';
            req.__error = err;
            req.__result = undefined; // Must be undefined if an error per `result` getter
            // Re: why bubbling here (and how cancelable is only really relevant for `window.onerror`) see: https://github.com/w3c/IndexedDB/issues/86
            var e = Event_1.createEvent('error', err, { bubbles: true, cancelable: true });
            req.dispatchEvent(e);
            calledDBError = true;
        });
    }
    addRequestToConnectionQueue(req, name, /* origin */ undefined, function (req) {
        createSysDB(me.__openDatabase, function () {
            // function callback (cb) { cb(); }
            // callback(function () {
            function completeDatabaseDelete() {
                req.__result = undefined;
                req.__readyState = 'done'; // https://github.com/w3c/IndexedDB/pull/202
                var e = new IDBVersionChangeEvent_1.default('success', { oldVersion: version, newVersion: null });
                req.dispatchEvent(e);
            }
            function databaseDeleted() {
                sysdbFinishedCbDelete(false, function () {
                    if (useDatabaseCache && name in websqlDBCache) {
                        delete websqlDBCache[name]; // New calls will treat as though never existed
                    }
                    delete me.__connections[name];
                    completeDatabaseDelete();
                });
            }
            sysdb.readTransaction(function (sysReadTx) {
                sysReadTx.executeSql('SELECT "version" FROM dbVersions WHERE "name" = ?', [sqlSafeName], function (sysReadTx, data) {
                    if (data.rows.length === 0) {
                        completeDatabaseDelete();
                        return;
                    }
                    version = data.rows.item(0).version;
                    var openConnections = me.__connections[name] || [];
                    triggerAnyVersionChangeAndBlockedEvents(openConnections, req, version, null).then(function () {
                        // Since we need two databases which can't be in a single transaction, we
                        //  do this deleting from `dbVersions` first since the `__sys__` deleting
                        //  only impacts file memory whereas this one is critical for avoiding it
                        //  being found via `open` or `webkitGetDatabaseNames`; however, we will
                        //  avoid committing anyways until all deletions are made and rollback the
                        //  `dbVersions` change if they fail
                        sysdb.transaction(function (systx) {
                            systx.executeSql('DELETE FROM dbVersions WHERE "name" = ? ', [sqlSafeName], function () {
                                // Todo: We should also check whether `dbVersions` is empty and if so, delete upon
                                //    `deleteDatabaseFiles` config. We also ought to do this when aborting (see
                                //    above code with `DELETE FROM dbVersions`)
                                cleanupDatabaseResources(me.__openDatabase, name, escapedDatabaseName, databaseDeleted, dbError);
                            }, dbError);
                        }, dbError, null, function (currentTask, err, done, rollback, commit) {
                            if (currentTask.readOnly || err) {
                                return true;
                            }
                            sysdbFinishedCbDelete = function (err, cb) {
                                if (err) {
                                    rollback(err, cb);
                                }
                                else {
                                    commit(cb);
                                }
                            };
                            return false;
                        });
                    }, dbError);
                }, dbError);
            });
        }, dbError);
    });
    return req;
};
IDBFactory.prototype.cmp = function (key1, key2) {
    if (!(this instanceof IDBFactory)) {
        throw new TypeError('Illegal invocation');
    }
    if (arguments.length < 2) {
        throw new TypeError('You must provide two keys to be compared');
    }
    // We use encoding facilities already built for proper sorting;
    //   the following "conversions" are for validation only
    Key.convertValueToKeyRethrowingAndIfInvalid(key1);
    Key.convertValueToKeyRethrowingAndIfInvalid(key2);
    return cmp_1.default(key1, key2);
};
/**
* NON-STANDARD!! (Also may return outdated information if a database has since been deleted)
* @link https://www.w3.org/Bugs/Public/show_bug.cgi?id=16137
* @link http://lists.w3.org/Archives/Public/public-webapps/2011JulSep/1537.html
*/
IDBFactory.prototype.webkitGetDatabaseNames = function () {
    var me = this;
    if (!(me instanceof IDBFactory)) {
        throw new TypeError('Illegal invocation');
    }
    if (hasNullOrigin()) {
        throw DOMException_1.createDOMException('SecurityError', 'Cannot get IndexedDB database names from an opaque origin.');
    }
    var calledDbCreateError = false;
    function dbGetDatabaseNamesError(tx, err) {
        if (calledDbCreateError) {
            return;
        }
        err = err ? DOMException_1.webSQLErrback(err) : tx;
        calledDbCreateError = true;
        // Re: why bubbling here (and how cancelable is only really relevant for `window.onerror`) see: https://github.com/w3c/IndexedDB/issues/86
        var evt = Event_1.createEvent('error', err, { bubbles: true, cancelable: true }); // http://stackoverflow.com/questions/40165909/to-where-do-idbopendbrequest-error-events-bubble-up/40181108#40181108
        req.__readyState = 'done';
        req.__error = err;
        req.__result = undefined; // Must be undefined if an error per `result` getter
        req.dispatchEvent(evt);
    }
    var req = IDBRequest_1.IDBRequest.__createInstance();
    createSysDB(me.__openDatabase, function () {
        sysdb.readTransaction(function (sysReadTx) {
            sysReadTx.executeSql('SELECT "name" FROM dbVersions', [], function (sysReadTx, data) {
                var dbNames = DOMStringList_1.default.__createInstance();
                for (var i = 0; i < data.rows.length; i++) {
                    dbNames.push(util.unescapeSQLiteResponse(data.rows.item(i).name));
                }
                req.__result = dbNames;
                req.__readyState = 'done'; // https://github.com/w3c/IndexedDB/pull/202
                var e = Event_1.createEvent('success'); // http://stackoverflow.com/questions/40165909/to-where-do-idbopendbrequest-error-events-bubble-up/40181108#40181108
                req.dispatchEvent(e);
            }, dbGetDatabaseNamesError);
        }, dbGetDatabaseNamesError);
    }, dbGetDatabaseNamesError);
    return req;
};
/**
* @Todo __forceClose: Test
* This is provided to facilitate unit-testing of the
*  closing of a database connection with a forced flag:
* <http://w3c.github.io/IndexedDB/#steps-for-closing-a-database-connection>
*/
IDBFactory.prototype.__forceClose = function (dbName, connIdx, msg) {
    var me = this;
    function forceClose(conn) {
        conn.__forceClose(msg);
    }
    if (dbName == null) {
        Object.values(me.__connections).forEach(function (conn) { return conn.forEach(forceClose); });
    }
    else if (!me.__connections[dbName]) {
        console.log('No database connections with that name to force close');
    }
    else if (connIdx == null) {
        me.__connections[dbName].forEach(forceClose);
    }
    else if (!Number.isInteger(connIdx) || connIdx < 0 || connIdx > me.__connections[dbName].length - 1) {
        throw new TypeError('If providing an argument, __forceClose must be called with a ' +
            'numeric index to indicate a specific connection to lose');
    }
    else {
        forceClose(me.__connections[dbName][connIdx]);
    }
};
IDBFactory.prototype.__setConnectionQueueOrigin = function (origin) {
    if (origin === void 0) { origin = getOrigin(); }
    connectionQueue[origin] = {};
};
IDBFactory.prototype[Symbol.toStringTag] = 'IDBFactoryPrototype';
Object.defineProperty(IDBFactory, 'prototype', {
    writable: false
});
var shimIndexedDB = IDBFactory.__createInstance();
exports.shimIndexedDB = shimIndexedDB;
