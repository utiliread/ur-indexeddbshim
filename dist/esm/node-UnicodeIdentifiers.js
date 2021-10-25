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
import setGlobalVars from './setGlobalVars.js';
import nodeWebSQL from './nodeWebSQL.js'; // Importing "websql" would not gain us SQLite config ability
import CFG from './CFG.js';
import * as UnicodeIdentifiers from './UnicodeIdentifiers.js';
// eslint-disable-next-line import/no-commonjs
var fs = require('fs');
CFG.win = { openDatabase: nodeWebSQL };
var __setGlobalVars = function (idb, initialConfig) {
    if (initialConfig === void 0) { initialConfig = {}; }
    var obj = setGlobalVars(idb, __assign({ fs: fs }, initialConfig));
    obj.shimIndexedDB.__setUnicodeIdentifiers(UnicodeIdentifiers);
    return obj;
};
export default __setGlobalVars;
