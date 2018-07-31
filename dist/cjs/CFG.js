"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var map = {};
var CFG = {};
[
    // Boolean for verbose reporting
    'DEBUG',
    'cacheDatabaseInstances',
    // Boolean on whether to auto-name databases (based on an auto-increment) when
    //   the empty string is supplied; useful with `memoryDatabase`; defaults to `false`
    //   which means the empty string will be used as the (valid) database name
    'autoName',
    // Determines whether the slow-performing `Object.setPrototypeOf` calls required
    //    for full WebIDL compliance will be used. Probably only needed for testing
    //    or environments where full introspection on class relationships is required;
    //    see http://stackoverflow.com/questions/41927589/rationales-consequences-of-webidl-class-inheritance-requirements
    'fullIDLSupport',
    // Boolean on whether to perform origin checks in `IDBFactory` methods
    'checkOrigin',
    // Used by `IDBCursor` continue methods for number of records to cache;
    'cursorPreloadPackSize',
    // See optional API (`shimIndexedDB.__setUnicodeIdentifiers`);
    //    or just use the Unicode builds which invoke this method
    //    automatically using the large, fully spec-compliant, regular
    //    expression strings of `src/UnicodeIdentifiers.js`)
    'UnicodeIDStart',
    'UnicodeIDContinue',
    // BROWSER-SPECIFIC CONFIG
    'avoidAutoShim',
    //    missing or poor support is known (non-Chrome Android or
    //    non-Safari iOS9), the shim will be auto-applied without
    //   `shimIndexedDB.__useShim()`. Set this to `true` to avoid forcing
    //    the shim for such cases.
    // -----------SQL CONFIG----------
    // Object (`window` in the browser) on which there may be an
    //  `openDatabase` method (if any) for WebSQL. (The browser
    //  throws if attempting to call `openDatabase` without the window
    //  so this is why the config doesn't just allow the function.)
    // Defaults to `window` or `self` in browser builds or
    //  a singleton object with the `openDatabase` method set to
    //  the "websql" package in Node.
    'win',
    // For internal `openDatabase` calls made by `IDBFactory` methods;
    //  per the WebSQL spec, "User agents are expected to use the display name
    //  and the estimated database size to optimize the user experience.
    //  For example, a user agent could use the estimated size to suggest an
    //  initial quota to the user. This allows a site that is aware that it
    //  will try to use hundreds of megabytes to declare this upfront, instead
    //  of the user agent prompting the user for permission to increase the
    //  quota every five megabytes."
    'DEFAULT_DB_SIZE',
    // Whether to create indexes on SQLite tables (and also whether to try dropping)
    'useSQLiteIndexes',
    // NODE-IMPINGING SETTINGS (created for sake of limitations in Node or desktop file
    //    system implementation but applied by default in browser for parity)
    // Used when setting global shims to determine whether to try to add
    //   other globals shimmed by the library (`ShimDOMException`, `ShimDOMStringList`,
    //   `ShimEvent`, `ShimCustomEvent`, `ShimEventTarget`)
    'addNonIDBGlobals',
    // Used when setting global shims to determine whether to try to overwrite
    //   other globals shimmed by the library (`DOMException`, `DOMStringList`,
    //   `Event`, `CustomEvent`, `EventTarget`)
    'replaceNonIDBGlobals',
    // Overcoming limitations with node-sqlite3/storing database name on file systems
    // https://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words
    // Defaults to prefixing database with `D_`, escaping
    //   `databaseCharacterEscapeList`, escaping NUL, and
    //   escaping upper case letters, as well as enforcing
    //   `databaseNameLengthLimit`
    'escapeDatabaseName',
    'unescapeDatabaseName',
    // Defaults to global regex representing the following
    //   (characters nevertheless commonly reserved in modern, Unicode-supporting
    //   systems): 0x00-0x1F 0x7F " * / : < > ? \ |
    'databaseCharacterEscapeList',
    'databaseNameLengthLimit',
    // Boolean defaulting to true on whether to escape NFD-escaping
    //   characters to avoid clashes on MacOS which performs NFD on files
    'escapeNFDForDatabaseNames',
    // Boolean on whether to add the `.sqlite` extension to file names;
    //   defaults to `true`
    'addSQLiteExtension',
    ['memoryDatabase', function (val) {
            if (!(/^(?::memory:|file::memory:(\?[^#]*)?(#.*)?)?$/).test(val)) {
                throw new TypeError('`memoryDatabase` must be the empty string, ":memory:", or a "file::memory:[?queryString][#hash] URL".');
            }
        }],
    // NODE-SPECIFIC CONFIG
    // Boolean on whether to delete the database file itself after `deleteDatabase`;
    //   defaults to `true` as the database will be empty
    'deleteDatabaseFiles',
    'databaseBasePath',
    'sysDatabaseBasePath',
    // NODE-SPECIFIC WEBSQL CONFIG
    'sqlBusyTimeout',
    'sqlTrace',
    'sqlProfile' // Callback not used by default
].forEach(function (prop) {
    var validator;
    if (Array.isArray(prop)) {
        validator = prop[1];
        prop = prop[0];
    }
    Object.defineProperty(CFG, prop, {
        get: function () {
            return map[prop];
        },
        set: function (val) {
            if (validator) {
                validator(val);
            }
            map[prop] = val;
        }
    });
});
exports.default = CFG;
