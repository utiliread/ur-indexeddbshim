"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CFG_1 = require("./CFG");
var unicode_regex_1 = require("./unicode-regex");
function escapeUnmatchedSurrogates(arg) {
    // http://stackoverflow.com/a/6701665/271577
    return arg.replace(/([\uD800-\uDBFF])(?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, function (_, unmatchedHighSurrogate, precedingLow, unmatchedLowSurrogate) {
        // Could add a corresponding surrogate for compatibility with `node-sqlite3`: http://bugs.python.org/issue12569 and http://stackoverflow.com/a/6701665/271577
        //   but Chrome having problems
        if (unmatchedHighSurrogate) {
            return '^2' + padStart(unmatchedHighSurrogate.charCodeAt().toString(16), 4, '0');
        }
        return (precedingLow || '') + '^3' + padStart(unmatchedLowSurrogate.charCodeAt().toString(16), 4, '0');
    });
}
function escapeNameForSQLiteIdentifier(arg) {
    // http://stackoverflow.com/a/6701665/271577
    return '_' + // Prevent empty string
        escapeUnmatchedSurrogates(arg.replace(/\^/g, '^^') // Escape our escape
            // http://www.sqlite.org/src/tktview?name=57c971fc74
            .replace(/\0/g, '^0')
            // We need to avoid identifiers being treated as duplicates based on SQLite's ASCII-only case-insensitive table and column names
            // (For SQL in general, however, see http://stackoverflow.com/a/17215009/271577
            // See also https://www.sqlite.org/faq.html#q18 re: Unicode (non-ASCII) case-insensitive not working
            .replace(/([A-Z])/g, '^$1'));
}
// The escaping of unmatched surrogates was needed by Chrome but not Node
function escapeSQLiteStatement(arg) {
    return escapeUnmatchedSurrogates(arg.replace(/\^/g, '^^').replace(/\0/g, '^0'));
}
exports.escapeSQLiteStatement = escapeSQLiteStatement;
function unescapeSQLiteResponse(arg) {
    return unescapeUnmatchedSurrogates(arg).replace(/\^0/g, '\0').replace(/\^\^/g, '^');
}
exports.unescapeSQLiteResponse = unescapeSQLiteResponse;
function sqlEscape(arg) {
    // https://www.sqlite.org/lang_keywords.html
    // http://stackoverflow.com/a/6701665/271577
    // There is no need to escape ', `, or [], as
    //   we should always be within double quotes
    // NUL should have already been stripped
    return arg.replace(/"/g, '""');
}
function sqlQuote(arg) {
    return '"' + sqlEscape(arg) + '"';
}
exports.sqlQuote = sqlQuote;
function escapeDatabaseNameForSQLAndFiles(db) {
    if (CFG_1.default.escapeDatabaseName) {
        // We at least ensure NUL is escaped by default, but we need to still
        //   handle empty string and possibly also length (potentially
        //   throwing if too long), escaping casing (including Unicode?),
        //   and escaping special characters depending on file system
        return CFG_1.default.escapeDatabaseName(escapeSQLiteStatement(db));
    }
    db = 'D' + escapeNameForSQLiteIdentifier(db);
    if (CFG_1.default.escapeNFDForDatabaseNames !== false) {
        // ES6 copying of regex with different flags
        // Todo: Remove `.source` when
        //   https://github.com/babel/babel/issues/5978 completed (see also
        //   https://github.com/axemclion/IndexedDBShim/issues/311#issuecomment-316090147 )
        db = db.replace(new RegExp(unicode_regex_1.default.source, 'g'), function (expandable) {
            return '^4' + padStart(expandable.codePointAt().toString(16), 6, '0');
        });
    }
    if (CFG_1.default.databaseCharacterEscapeList !== false) {
        db = db.replace((CFG_1.default.databaseCharacterEscapeList
            ? new RegExp(CFG_1.default.databaseCharacterEscapeList, 'g')
            : /[\u0000-\u001F\u007F"*/:<>?\\|]/g), // eslint-disable-line no-control-regex
        function (n0) {
            return '^1' + padStart(n0.charCodeAt().toString(16), 2, '0');
        });
    }
    if (CFG_1.default.databaseNameLengthLimit !== false &&
        db.length >= ((CFG_1.default.databaseNameLengthLimit || 254) - (CFG_1.default.addSQLiteExtension !== false ? 7 /* '.sqlite'.length */ : 0))) {
        throw new Error('Unexpectedly long database name supplied; length limit required for Node compatibility; passed length: ' +
            db.length + '; length limit setting: ' + (CFG_1.default.databaseNameLengthLimit || 254) + '.');
    }
    return db + (CFG_1.default.addSQLiteExtension !== false ? '.sqlite' : ''); // Shouldn't have quoting (do we even need NUL/case escaping here?)
}
exports.escapeDatabaseNameForSQLAndFiles = escapeDatabaseNameForSQLAndFiles;
function unescapeUnmatchedSurrogates(arg) {
    return arg
        .replace(/(\^+)3(d[0-9a-f]{3})/g, function (_, esc, lowSurr) {
        return esc.length % 2
            ? esc.slice(1) + String.fromCharCode(parseInt(lowSurr, 16))
            : _;
    })
        .replace(/(\^+)2(d[0-9a-f]{3})/g, function (_, esc, highSurr) {
        return esc.length % 2
            ? esc.slice(1) + String.fromCharCode(parseInt(highSurr, 16))
            : _;
    });
}
// Not in use internally but supplied for convenience
function unescapeDatabaseNameForSQLAndFiles(db) {
    if (CFG_1.default.unescapeDatabaseName) {
        // We at least ensure NUL is unescaped by default, but we need to still
        //   handle empty string and possibly also length (potentially
        //   throwing if too long), unescaping casing (including Unicode?),
        //   and unescaping special characters depending on file system
        return CFG_1.default.unescapeDatabaseName(unescapeSQLiteResponse(db));
    }
    return unescapeUnmatchedSurrogates(db.slice(2) // D_
        // CFG.databaseCharacterEscapeList
        .replace(/(\^+)1([0-9a-f]{2})/g, function (_, esc, hex) {
        return esc.length % 2
            ? esc.slice(1) + String.fromCharCode(parseInt(hex, 16))
            : _;
    })
        // CFG.escapeNFDForDatabaseNames
        .replace(/(\^+)4([0-9a-f]{6})/g, function (_, esc, hex) {
        return esc.length % 2
            ? esc.slice(1) + String.fromCodePoint(parseInt(hex, 16))
            : _;
    }))
        // escapeNameForSQLiteIdentifier (including unescapeUnmatchedSurrogates() above)
        .replace(/(\^+)([A-Z])/g, function (_, esc, upperCase) {
        return esc.length % 2
            ? esc.slice(1) + upperCase
            : _;
    })
        .replace(/(\^+)0/g, function (_, esc) {
        return esc.length % 2
            ? esc.slice(1) + '\0'
            : _;
    })
        .replace(/\^\^/g, '^');
}
exports.unescapeDatabaseNameForSQLAndFiles = unescapeDatabaseNameForSQLAndFiles;
function escapeStoreNameForSQL(store) {
    return sqlQuote('S' + escapeNameForSQLiteIdentifier(store));
}
exports.escapeStoreNameForSQL = escapeStoreNameForSQL;
function escapeIndexNameForSQL(index) {
    return sqlQuote('I' + escapeNameForSQLiteIdentifier(index));
}
exports.escapeIndexNameForSQL = escapeIndexNameForSQL;
function escapeIndexNameForSQLKeyColumn(index) {
    return 'I' + escapeNameForSQLiteIdentifier(index);
}
exports.escapeIndexNameForSQLKeyColumn = escapeIndexNameForSQLKeyColumn;
function sqlLIKEEscape(str) {
    // https://www.sqlite.org/lang_expr.html#like
    return sqlEscape(str).replace(/\^/g, '^^');
}
exports.sqlLIKEEscape = sqlLIKEEscape;
// Babel doesn't seem to provide a means of using the `instanceof` operator with Symbol.hasInstance (yet?)
function instanceOf(obj, Clss) {
    return Clss[Symbol.hasInstance](obj);
}
exports.instanceOf = instanceOf;
function isObj(obj) {
    return obj && typeof obj === 'object';
}
exports.isObj = isObj;
function isDate(obj) {
    return isObj(obj) && typeof obj.getDate === 'function';
}
exports.isDate = isDate;
function isBlob(obj) {
    return isObj(obj) && typeof obj.size === 'number' && typeof obj.slice === 'function' && !('lastModified' in obj);
}
exports.isBlob = isBlob;
function isRegExp(obj) {
    return isObj(obj) && typeof obj.flags === 'string' && typeof obj.exec === 'function';
}
exports.isRegExp = isRegExp;
function isFile(obj) {
    return isObj(obj) && typeof obj.name === 'string' && typeof obj.slice === 'function' && 'lastModified' in obj;
}
exports.isFile = isFile;
function isBinary(obj) {
    return isObj(obj) && typeof obj.byteLength === 'number' && (typeof obj.slice === 'function' || // `TypedArray` (view on buffer) or `ArrayBuffer`
        typeof obj.getFloat64 === 'function' // `DataView` (view on buffer)
    );
}
exports.isBinary = isBinary;
function isIterable(obj) {
    return isObj(obj) && typeof obj[Symbol.iterator] === 'function';
}
exports.isIterable = isIterable;
function defineReadonlyProperties(obj, props) {
    props = typeof props === 'string' ? [props] : props;
    props.forEach(function (prop) {
        Object.defineProperty(obj, '__' + prop, {
            enumerable: false,
            configurable: false,
            writable: true
        });
        Object.defineProperty(obj, prop, {
            enumerable: true,
            configurable: true,
            get: function () {
                return this['__' + prop];
            }
        });
    });
}
exports.defineReadonlyProperties = defineReadonlyProperties;
function isIdentifier(item) {
    // For load-time and run-time performance, we don't provide the complete regular
    //   expression for identifiers, but these can be passed in, using the expressions
    //   found at https://gist.github.com/brettz9/b4cd6821d990daa023b2e604de371407
    // ID_Start (includes Other_ID_Start)
    var UnicodeIDStart = CFG_1.default.UnicodeIDStart || '[$A-Z_a-z]';
    // ID_Continue (includes Other_ID_Continue)
    var UnicodeIDContinue = CFG_1.default.UnicodeIDContinue || '[$0-9A-Z_a-z]';
    var IdentifierStart = '(?:' + UnicodeIDStart + '|[$_])';
    var IdentifierPart = '(?:' + UnicodeIDContinue + '|[$_\u200C\u200D])';
    return (new RegExp('^' + IdentifierStart + IdentifierPart + '*$')).test(item);
}
function isValidKeyPathString(keyPathString) {
    return typeof keyPathString === 'string' &&
        (keyPathString === '' || isIdentifier(keyPathString) || keyPathString.split('.').every(isIdentifier));
}
function isValidKeyPath(keyPath) {
    return isValidKeyPathString(keyPath) || (Array.isArray(keyPath) && keyPath.length &&
        // Convert array from sparse to dense http://www.2ality.com/2012/06/dense-arrays.html
        Array.apply(null, keyPath).every(function (kpp) {
            // See also https://heycam.github.io/webidl/#idl-DOMString
            return isValidKeyPathString(kpp); // Should already be converted to string by here
        }));
}
exports.isValidKeyPath = isValidKeyPath;
function enforceRange(number, type) {
    number = Math.floor(Number(number));
    var max, min;
    switch (type) {
        case 'unsigned long long': {
            max = 0x1FFFFFFFFFFFFF; // 2^53 - 1
            min = 0;
            break;
        }
        case 'unsigned long': {
            max = 0xFFFFFFFF; // 2^32 - 1
            min = 0;
            break;
        }
        default:
            throw new Error('Unrecognized type supplied to enforceRange');
    }
    if (isNaN(number) || !isFinite(number) ||
        number > max ||
        number < min) {
        throw new TypeError('Invalid range: ' + number);
    }
    return number;
}
exports.enforceRange = enforceRange;
function convertToDOMString(v, treatNullAs) {
    return v === null && treatNullAs ? '' : ToString(v);
}
exports.convertToDOMString = convertToDOMString;
function ToString(o) {
    return '' + o; // `String()` will not throw with Symbols
}
function convertToSequenceDOMString(val) {
    // Per <https://heycam.github.io/webidl/#idl-sequence>, converting to a sequence works with iterables
    if (isIterable(val)) { // We don't want conversion to array to convert primitives
        // Per <https://heycam.github.io/webidl/#es-DOMString>, converting to a `DOMString` to be via `ToString`: https://tc39.github.io/ecma262/#sec-tostring
        return val.slice().map(ToString);
    }
    return ToString(val);
}
exports.convertToSequenceDOMString = convertToSequenceDOMString;
// Todo: Replace with `String.prototype.padStart` when targeting supporting Node version
function padStart(str, ct, fill) {
    return new Array(ct - (String(str)).length + 1).join(fill) + str;
}
exports.padStart = padStart;
