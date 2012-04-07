"use strict";

let EXPORTED_SYMBOLS = [
    'SQLiteTypes',
    'SQLiteRegex',
    'SQLiteFn',
    'SQLiteDb',
    
    'nsSqlite',

    'tblLSFBarDebugHosts',
    'tblLSFBarDebugTraces',
    'tblLSFBarDebugDefaultTraces',
    
    'tblLSFBarRepGroups',
    'tblLSFBarRepGroupsRel',
    'tblLSFBarRepProjects',
    'tblLSFBarRepRelations',
    'tblLSFBarRepServers'
];

var Ci = Components.interfaces,
    Cc = Components.classes,
    Cr = Components.results,
    Cu = Components.utils;

Cu.import('resource://lsfbar/Console.js');
Cu.import('resource://lsfbar/IO.js');

const SQLiteTypes = {
    NULL: 0,
    INTEGER: 1,
    REAL: 2,
    TEXT: 3,
    BLOB: 4,
    BOOL: 5
};

var SQLiteRegex = {
    mNull: '^[nN][uU][lL][lL]$',
    mInteger: '^[-+]?[1-9][0-9]*$',
    mReal: '^[-+]?[0-9]*[\.]?[0-9]+([eE][-+]?[0-9]+)?$',
    mBlob: '^[xX]\'([0-9a-fA-F][0-9a-fA-F])*\'$'
};

const SQLiteConsts = {
    EVENT_AFTER_FETCH_ROW: 'afterFetchRow',
    EVENT_AFTER_FETCH_ONE: 'afterFetchRowOne',
    EVENT_AFTER_FETCH_ALL: 'afterFetchAll',
    EVENT_AFTER_FETCH_ALL_ASSOC: 'afterFetchAllAssoc'
};

var SQLiteFn = {
    msQuoteChar: '""',

    maTypes: ['null', 'integer', 'real', 'text', 'blob'],

    getTypeDescription: function(iType) {
        return this.maTypes[iType];
    },

    setQuoteChar: function(sQuoteChar) {
        this.msQuoteChar = sQuoteChar;
    },

    quoteIdentifier: function(str) {
        var p = str.split('.');
        for (var i = 0; i < p.length; i++) {
            p[i] = this.msQuoteChar[0] + p[i] + this.msQuoteChar[1];
        }
        
        return p.join('.');
    },

    quote: function(str) {
        if (typeof str == 'string') {
            str = str.replace("'", "''", "g");
        }
        
        return "'" + str + "'";
    },

    isSpecialLiteral: function(str) {
        var sUp = str.toUpperCase();
        if (sUp == 'CURRENT_DATE' || sUp == 'CURRENT_TIME' || sUp == 'CURRENT_TIMESTAMP') {
            return true;
        }

        return false;
    },

    makeSqlValue: function(str) {
        if (typeof str == 'object' && defined(str.length)) {
            for (var i = 0, l = str.length; i < l; i++) {
                str[i] = this.makeSqlValue(str[i]);
            }
            
            return str;
        } else {
            var reNull = new RegExp(SQLiteRegex.mNull);
            if (reNull.test(str)) {
                return 'NULL';
            }

            var reReal = new RegExp(SQLiteRegex.mReal);
            if (reReal.test(str)) {
                return Number(str);
            }

            if (SQLiteFn.isSpecialLiteral(str)) {
                return str.toUpperCase();
            }

            if (str.length == 0) {
                return 'NULL';
            }

            return this.quote(str);
        }
    },

    blobToHex: function(aData) {
        var hex_tab = '0123456789ABCDEF',
            str = '';
            
        for (var i = 0, l = aData.length; i < l; i++) {
            str += hex_tab.charAt(aData[i] >> 4 & 0xF) + hex_tab.charAt(aData[i] & 0xF);
        }
        
        return "X'" + str + "'";
    },

    hexToBlob: function(sHex) {
        var aRet = [];
        for (var i = 0, l = sHex.length; i < l; i = i + 2) {
            aRet.push(Number("0x" + sHex.substr(i,2)));
        }
        
        return aRet;
    },

    and: function(aWhere) {
        return {
            _type: 'AND',
            _data: aWhere
        };
    },

    or: function(aWhere) {
        return {
            _type: 'OR',
            _data: aWhere
        };
    },
    
    expr: function(pExpr) {
        return {
            getSql: function() {
                return pExpr;
            }
        };
    },

    /**
     * !=
     */
    ne: function(aField, aValue) {
        return this.expr(SQLiteFn.quoteIdentifier(aField) + ' != ' + SQLiteFn.makeSqlValue(aValue));
    },

    /**
     * >=
     */
    ge: function(aField, aValue) {
        return this.expr(SQLiteFn.quoteIdentifier(aField) + ' >= ' + SQLiteFn.makeSqlValue(aValue));
    },

    /**
     * >
     */
    gt: function(aField, aValue) {
        return this.expr(SQLiteFn.quoteIdentifier(aField) + ' > ' + SQLiteFn.makeSqlValue(aValue));
    },


    /**
     * <=
     */
    le: function(aField, aValue) {
        return this.expr(SQLiteFn.quoteIdentifier(aField) + ' <= ' + SQLiteFn.makeSqlValue(aValue));
    },

    /**
     * <
     */
    lt: function(aField, aValue) {
        return this.expr(SQLiteFn.quoteIdentifier(aField) + ' < ' + SQLiteFn.makeSqlValue(aValue));
    },

    /**
     * like
     */
    like: function(aField, aValue) {
        return this.expr(SQLiteFn.quoteIdentifier(aField) + ' like ' + SQLiteFn.makeSqlValue(aValue));
    }
};


function nsISqlite() {
    var f = FileIO.open('lightsoft/lsfbar2.sqlite', 'ProfD');
    if (!f.exists() || !f.isFile() || !f.isReadable() || !f.isWritable()) {
        if (f.exists()) {
            FileIO.unlink(f);
        }

        var dir = DirIO.get('ProfD');
        dir.append('lightsoft');
        if (!dir.exists()) {
            DirIO.create(dir);
        }

        if (dir.exists()) {
            FileIO.copy('chrome://lsfbar/content/defaults/lsfbar.sqlite', 'lightsoft', 'lsfbar2.sqlite', null, 'ProfD');
        }
        
        this._fileDb = FileIO.open('lightsoft/lsfbar2.sqlite', 'ProfD');
    } else {
        this._fileDb = f;
    }
}


nsISqlite.prototype = {
    storageService: Cc['@mozilla.org/storage/service;1'].getService(Ci.mozIStorageService),
    
    _fileDb: null,
    _trace: false,
    _mLogicalDbName: 'main',

    _traceSql: function(aSql, aData) {
        if (!this._trace) {
            return;
        }

        Console.log(aSql);
    },

    _renderWhere: function(aWhere, aSep) {
        var sql = '',
            first = true,
            sep = aSep || 'AND';

        for (var i = 0, l = aWhere.length; i < l; i++) {
            if (!first) {
                sql += ' ' + sep + ' ';
            } else {
                first = false;
            }

            if (defined(aWhere[i]._type) && defined(aWhere[i]._data)) {
                sql += '(' + this._renderWhere(aWhere[i]._data, aWhere[i]._type) + ')';
                
            } else if (defined(aWhere[i].getSql)) {
                sql += '(' + aWhere[i].getSql() + ')';
                
            } else if (typeof aWhere[i] == 'string') {
                sql += '(' + aWhere[i] + ')';
                
            } else {
                var f = true;
                for (var v in aWhere[i]) {
                    if (!f) {
                        sql += ' ' + sep + ' ';
                    } else {
                        f = false;
                    }
                    
                    if (typeof aWhere[i][v] == 'object' && defined(aWhere[i][v].join)) {
                        sql += '(' + SQLiteFn.quoteIdentifier(v.toString()) + ' IN (' + (SQLiteFn.makeSqlValue(aWhere[i][v])).join(', ') + '))';
                    } else {
                        sql += '(' + SQLiteFn.quoteIdentifier(v.toString()) + ' = ' + SQLiteFn.makeSqlValue(aWhere[i][v].toString()) + ')';
                    }
                }
            }
        }

        return sql;
    },

    _getPrefixedName: function(objName, sDbName) {
        if (!defined(sDbName)) {
            sDbName = this._mLogicalDbName;
        }
        
        return SQLiteFn.quoteIdentifier(sDbName) + '.' + SQLiteFn.quoteIdentifier(objName);
    },

    _textToBlob: function(aData) {
        var sHex = '';

        if (aData != null && aData != '') {
            var sQuery = 'SELECT hex(' + aData + ') AS outhex';
            try {
                var conn = this.openConnection();
                var stmt = conn.createStatement(sQuery);
                while (stmt.executeStep()) {
                    sHex = stmt.row.outhex;
                }
            } catch (ex) {
                Cu.reportError(ex);
                stmt.finalize();
                conn.close();
                return this._textToBlob(SQLiteFn.quote(aData));
            } finally {
                stmt.finalize();
                conn.close();
            }
        }

        return SQLiteFn.hexToBlob(sHex);
    },

    _blobToHex: function(aData) {
        var sHex = '';
        var sQuery = 'SELECT quote(' + aData + ') AS outstr';
        try {
            var conn = this.openConnection();
            var stmt = conn.createStatement(sQuery);
            while (stmt.executeStep()) {
                sHex = stmt.row.outstr;
            }
        } catch (ex) {
            Cu.reportError(ex);
        } finally {
            stmt.finalize();
            conn.close();
        }

        return sHex;
    },

    _bindParam: function(stmt, num, value, type) {
        switch (type) {
            case SQLiteTypes.NULL:
                stmt.bindNullParameter(num);
                break;
            case SQLiteTypes.INTEGER:
                stmt.bindInt64Parameter(num, Number(value));
                break;
            case SQLiteTypes.REAL:
                stmt.bindDoubleParameter(num, Number(value));
                break;
            case SQLiteTypes.TEXT:
                stmt.bindUTF8StringParameter(num, String(value));
                break;
            case SQLiteTypes.BLOB:
                if (typeof value == 'string') {
                    value = this._textToBlob(value);
                }
                stmt.bindBlobParameter(num, value, value.length);
                break;
            default:
                stmt.bindUTF8StringParameter(num, value);
                break;
        }
    },

    // https://developer.mozilla.org/en/mozIStorageConnection
    // @return mozIStorageConnection
    openConnection: function() {
        return this.storageService.openDatabase(this._fileDb);
    },
    
    vacuum: function() {
        try {
            var conn = this.openConnection();
            conn.executeSimpleSQL('VACUUM');
            conn.close();
            
            return true;
        } catch (ex) {
            Cu.reportError(ex);
        }
        
        return false;
    },

    executeSql: function(aSql, aData, aType, aReturn) {
        this._traceSql(aSql, aData);

        try {
            var conn = this.openConnection();
        } catch (ex) {
            Cu.reportError(ex);
            return false;
        }

        try {
            var stmt = conn.createStatement(aSql);
        } catch (ex) {
            conn.close();
            Cu.reportError(ex);
            return false;
        }
        
        if (defined(aData)) {
            try {
                var i = 0;
                for (var v in aData) {
                    var param = aData[v];
                    var type = defined(aType[v]) ? aType[v] : SQLiteTypes.TEXT;
                    this._bindParam(stmt, i, param, type);
                    i++;
                }
            } catch (ex) {
                stmt.finalize();
                conn.close();
                Cu.reportError(ex);
                return false;
            }
        }

        if (aReturn) {

            var iCols = 0,
                rows = new Array(),
                cell = null,
                aColumns = new Array();

            try {
                iCols = stmt.columnCount;
                for (var i = 0; i < iCols; i++) {
                    aColumns.push(stmt.getColumnName(i));
                }
            } catch (ex) {
                stmt.finalize();
                conn.close();
                Cu.reportError(ex);
                return false;
            }

            try {
                while (stmt.executeStep()) {
                    var row = {};
                    for (i = 0; i < iCols; i++) {
                        switch (stmt.getTypeOfIndex(i)) {
                            case stmt.VALUE_TYPE_NULL:
                                cell = null;
                                break;
                            case stmt.VALUE_TYPE_INTEGER:
                                cell = stmt.getInt64(i);
                                break;
                            case stmt.VALUE_TYPE_FLOAT:
                                cell = stmt.getDouble(i);
                                break;
                            case stmt.VALUE_TYPE_TEXT:
                                cell = stmt.getString(i);
                                break;
                            case stmt.VALUE_TYPE_BLOB:
                                var iDataSize = {value: 0};
                                var iData = {value: null};
                                stmt.getBlob(i, iDataSize, iData);
                                cell = SQLiteFn.blobToHex(iData.value);
                                break;
                            default:
                                cell = stmt.getString(i);
                        }

                        row[aColumns[i]] = cell;
                    }
                    rows.push(row);
                }

                stmt.finalize();
                conn.close();
                return rows;
            } catch (ex) {
                stmt.finalize();
                conn.close();
                Cu.reportError(ex);
                return false;
            }

        } else {

            try {
                stmt.execute();
                stmt.finalize();
                conn.close();
                return true;
            } catch (ex) {
                stmt.finalize();
                conn.close();
                Cu.reportError(ex);
                return false;
            }
        }

        return false;
    },

    tableInsert: function(aTableName, aData, aType, aLastId) {
        var p = [], n = [];

        for (var v in aData) {
            n.push(SQLiteFn.quoteIdentifier(v));
            p.push('?');
        }

        var sQuery = 'INSERT OR IGNORE INTO ' + this._getPrefixedName(aTableName) + ' (' + n.join(', ') + ') VALUES (' + p.join(', ') + ')';

        this._traceSql(sQuery, aData);

        try {
            var conn = this.openConnection();
        } catch (ex) {
            Cu.reportError(ex);
            return false;
        }

        conn.beginTransaction();

        try {
            var stmt = conn.createStatement(sQuery);
        } catch (ex) {
            conn.rollbackTransaction();
            conn.close();
            Cu.reportError(ex);
            return false;
        }

        try {
            var i = 0,
                pType = aType || {};

            for (var v in aData) {
                var param = aData[v];
                var type = defined(pType[v]) ? pType[v] : SQLiteTypes.TEXT;
                this._bindParam(stmt, i, param, type);
                i++;
            }
        } catch (ex) {
            stmt.finalize();
            conn.rollbackTransaction();
            conn.close();
            Cu.reportError(ex);
            return false;
        }


        try {
            stmt.execute();
            stmt.finalize();
        } catch (ex) {
            stmt.finalize();
            conn.rollbackTransaction();
            conn.close();
            Cu.reportError(ex);
            return false;
        }


        if (aLastId) {
            var lastId;
            try {
                stmt = conn.createStatement('SELECT last_insert_rowid() AS lastid');
                while (stmt.executeStep()) {
                    lastId = stmt.row.lastid;
                }
                stmt.finalize();
                conn.commitTransaction();
                conn.close();
                return lastId;
            } catch (ex) {
                stmt.finalize();
                conn.rollbackTransaction();
                conn.close();
                Cu.reportError(ex);
                return false;
            }
        } else {
            conn.commitTransaction();
            conn.close();
            return true;
        }

        return false;
    },


    tableUpdate: function(aTableName, aData, aType, aWhere) {
        var n = [];

        for (var v in aData) {
            n.push(SQLiteFn.quoteIdentifier(v) + ' = ?');
        }

        var sQuery = 'UPDATE\n\t' + this._getPrefixedName(aTableName) + '\nSET\n\t' + n.join(',\n\t');

        if (aWhere.length > 0) {
            sQuery += '\nWHERE\n\t' + this._renderWhere(aWhere);
        }

        this._traceSql(sQuery, aData);
        
        try {
            var conn = this.openConnection();
        } catch (ex) {
            Cu.reportError(ex);
            return false;
        }

        try {
            var stmt = conn.createStatement(sQuery);
        } catch (ex) {
            conn.close();
            Cu.reportError(ex);
            return false;
        }

        try {
            var i = 0,
                pType = aType || {};

            for (var v in aData) {
                var param = aData[v];
                var type = defined(pType[v]) ? pType[v] : SQLiteTypes.TEXT;
                this._bindParam(stmt, i, param, type);
                i++;
            }
        } catch (ex) {
            stmt.finalize();
            conn.close();
            Cu.reportError(ex);
            return false;
        }


        try {
            stmt.execute();
            stmt.finalize();
            conn.close();
            return true;
        } catch (ex) {
            stmt.finalize();
            conn.close();
            Cu.reportError(ex);
            return false;
        }
    },

    tableDelete: function(aTableName, aWhere) {
        var sQuery = 'DELETE FROM\n\t' + this._getPrefixedName(aTableName);
        if (aWhere.length > 0) {
            sQuery += '\nWHERE\n\t' + this._renderWhere(aWhere);
        }

        this._traceSql(sQuery);

        try {
            var conn = this.openConnection();
        } catch (ex) {
            Cu.reportError(ex);
            return false;
        }

        try {
            var stmt = conn.createStatement(sQuery);
        } catch (ex) {
            conn.close();
            Cu.reportError(ex);
            return false;
        }

        try {
            stmt.execute();
            stmt.finalize();
            conn.close();
            return true;
        } catch (ex) {
            stmt.finalize();
            conn.close();
            Cu.reportError(ex);
            return false;
        }
    }
};


var nsSqlite = new nsISqlite();


function SQLiteDb(tableName) {
    this.tableName = tableName;
    this.getlastId = true;
    this.select = null;
}

SQLiteDb.prototype = {
    /*_event: {},
    
    _processEvent: function(aEvent, aArguments) {

    },

    registerEvent: function(aEvent, aFunction) {

    },

    unregisterEvent: function(aEvent, aFunction) {

    },*/

    insert: function(aData, aType, aTableName) {
        return nsSqlite.tableInsert(aTableName || this.tableName, aData, aType, this.getlastId);
    },

    update: function(aData, aWhere, aType, aTableName) {
        return nsSqlite.tableUpdate(aTableName || this.tableName, aData, aType, aWhere);
    },

    del: function(aWhere, aTableName) {
        return nsSqlite.tableDelete(aTableName || this.tableName, aWhere || []);
    },

    getCount: function(aWhere) {

    },
    
    tableCreate: function() {
        return true;
    },
    
    getSelect: function() {
        if (!this.select) {
            this.select = this.createSelect();
        }
        
        return this.select;
    },

    createSelect: function() {
        if (this.select) {
            return this.select;
        }
        
        var fromSelf = this.tableName,
            _parts = {
                distinct: false,
                columns: ['self.*'],
                from: {
                    self: fromSelf
                },
                joins: {},
                where: [],
                group: [], // массив строк
                having: [],
                order: [], // массив строк
                limit: null,
                offset: null
            };
            
            function _renderDistinct() {
                return _parts.distinct ? ' DISTINCT\n' : '\n';
            }

            function _renderColumns() {
                var sql = '\t',
                    first = true;

                for (var i = 0, l = _parts.columns.length; i < l; i++) {
                    if (!first) {
                        sql += ',\n\t';
                    } else {
                        first = false;
                    }

                    var field = _parts.columns[i];
                    if (typeof field == 'string') {
                        sql += field;
                        
                    } else if (typeof field == 'object') {
                        if (defined(field.getSql)) {
                            sql += field.getSql();
                        } else {
                            for (var v in field) {
                                if (defined(field[v].getSql)) {
                                    sql += '(' + field[v].getSql() + ') AS ' + SQLiteFn.quoteIdentifier(v);
                                } else {
                                    sql += SQLiteFn.quoteIdentifier(field[v]) + ' AS ' + SQLiteFn.quoteIdentifier(v);
                                }
                            }
                        }
                    }
                }

                return sql + '\n';
            }

            function _renderFrom() {
                var sql = 'FROM\n\t',
                    first = true;

                for (var v in _parts.from) {
                    if (!first) {
                        sql += ',\n\t';
                    } else {
                        first = false;
                    }
                    
                    var f = _parts.from[v];
                    
                    if (defined(f.getSql)) {
                        sql += '(' + f.getSql() + ') AS ' + SQLiteFn.quoteIdentifier(v);
                    } else if (typeof f == 'string') {
                        sql += nsSqlite._getPrefixedName(f) + ' AS ' + SQLiteFn.quoteIdentifier(v);
                    }
                }

                for (var v in _parts.joins) {
                    var j = _parts.joins[v];
                    sql += '\n\t' + j.type + ' ';
                    if (defined(j.table.getSql)) {
                        sql += '(' + j.table.getSql() + ') AS ' + SQLiteFn.quoteIdentifier(v);
                    } else if (typeof j.table == 'string') {
                        sql += nsSqlite._getPrefixedName(j.table) + ' AS ' + SQLiteFn.quoteIdentifier(v);
                    }

                    if (defined(j.where)) {
                        sql += ' ON ' + nsSqlite._renderWhere(j.where);
                    }
                }

                return sql + '\n';
            }

            function _renderWhere() {
                if (!defined(_parts.where.length)) {
                    return '';
                }

                if (_parts.where.length == 0) {
                    return '';
                }

                return 'WHERE\n\t' + nsSqlite._renderWhere(_parts.where) + '\n';
            }

            function _renderGroup() {
                if (_parts.group.length > 0) {
                    return 'GROUP BY\n\t' + _parts.group.join(',\n\t') + '\n';
                }

                return '';
            }

            function _renderHaving() {
                if (_parts.having.length > 0) {
                    return 'HAVING\n\t' + nsSqlite._renderWhere(_parts.having) + '\n';
                }

                return '';
            }

            function _renderOrder() {
                if (_parts.order.length > 0) {
                    return 'ORDER BY\n\t' + _parts.order.join(',\n\t') + '\n';
                }

                return '';
            }

            function _renderLimitOffset() {
                var sql = '';
                if (defined(_parts.limit)) {
                    sql += 'LIMIT ' + Number(_parts.limit) + '\n';
                }

                if (defined(_parts.offset)) {
                    sql += 'OFFSET ' + Number(_parts.offset) + '\n';
                }

                return sql;
            }

            function _renderSQL() {
                return 'SELECT'
                    + _renderDistinct()
                    + _renderColumns()
                    + _renderFrom()
                    + _renderWhere()
                    + _renderGroup()
                    + _renderHaving()
                    + _renderOrder()
                    + _renderLimitOffset();
            }


        return {
            clearFields: function() {
                _parts.columns = [];
                return this;
            },

            clearOrder: function() {
                _parts.order = [];
                return this;
            },
            
            columns: function(aColumns) {
                if (typeof aColumns == 'object' && defined(aColumns.length)) {
                    for (var i = 0, l = aColumns.length; i < l; i++) {
                        _parts.columns.push(aColumns[i]);
                    }
                } else {
                    _parts.columns.push(aColumns);
                }

                return this;
            },

            where: function(aField, aValue) {
                if (typeof aField == 'object' && defined(aField.length)) {
                    for (var i = 0, l = aField.length; i < l; i++) {
                        _parts.where.push(aField[i]);
                    }
                } else if (typeof aField == 'object') {
                    _parts.where.push(aField);
                } else {
                    var w = {};
                    w[aField] = aValue;
                    _parts.where.push(w);
                }

                return this;
            },

            having: function(aField, aValue) {
                if (typeof aField == 'object' && defined(aField.length)) {
                    for (var i = 0, l = aField.length; i < l; i++) {
                        _parts.having.push(aField[i]);
                    }
                } else if (typeof aField == 'object') {
                    _parts.having.push(aField);
                } else {
                    var w = {};
                    w[aField] = aValue;
                    _parts.having.push(w);
                }

                return this;
            },

            from: function(aTable, aAlias, aFields) {
                _parts.from[aAlias] = aTable;
                this.columns(aFields);
                return this;
            },

            join: function(aTable, aAlias, aWhere, aFields) {
                _parts.joins[aAlias] = {
                    type: 'JOIN',
                    table: aTable,
                    where: aWhere
                }
                this.columns(aFields);
                return this;
            },

            joinLeft: function(aTable, aAlias, aWhere, aFields) {
                _parts.joins[aAlias] = {
                    type: 'LEFT JOIN',
                    table: aTable,
                    where: aWhere
                }
                this.columns(aFields);
                return this;
            },

            limit: function(aLimit) {
                _parts.limit = Number(aLimit);
                return this;
            },

            offset: function(aOffser) {
                _parts.offset = Number(aOffser);
                return this;
            },

            order: function(aOrder) {
                if (typeof aOrder == 'object' && defined(aOrder.length)) {
                    for (var i = 0, l = aOrder.length; i < l; i++) {
                        if (typeof aOrder[i] == 'string') {
                            _parts.order.push(aOrder[i]);
                        }
                    }
                } else if (typeof aOrder == 'string') {
                    _parts.order.push(aOrder);
                }

                return this;
            },

            group: function(aGroup) {
                if (typeof aOrder == 'object' && defined(aGroup.length)) {
                    for (var i = 0, l = aGroup.length; i < l; i++) {
                        if (typeof aGroup[i] == 'string') {
                            _parts.group.push(aGroup[i]);
                        }
                    }
                } else if (typeof aOrder == 'string') {
                    _parts.group.push(aGroup);
                }

                return this;
            },

            distinct: function(aDistinct) {
                _parts.distinct = aDistinct;
                return this;
            },

            execute: function() {
                var sql = _renderSQL(),
                    rows = nsSqlite.executeSql(sql, null, null, true);
                    
                return (new SQLiteDbStmt(rows));
            },

            getSql: function() {
                return _renderSQL();
            }
        }
    }
};


function SQLiteDbStmt(aData) {
    this.rows = aData;
}

SQLiteDbStmt.prototype = {
    _bringType: function(aRow, aTypes) {
        if (!defined(aTypes)) {
            return aRow;
        }
        
        for (var v in aRow) {
            if (typeof aTypes[v] == 'undefined' || aTypes[v] == null) {
                continue;
            }
            
            switch (aTypes[v]) {
                case SQLiteTypes.NULL:
                    break;
                case SQLiteTypes.INTEGER:
                    aRow[v] = parseInt(aRow[v]);
                    break;
                case SQLiteTypes.REAL:
                    aRow[v] = parseFloat(aRow[v]);
                    break;
                case SQLiteTypes.TEXT:
                    break;
                case SQLiteTypes.BLOB:
                    break;
                case SQLiteTypes.BOOL:
                    aRow[v] = !!aRow[v];
                    break;
                default:
                    break;
            }
        }
        
        return aRow;
    },
    
    fetchAll: function(aFieldTypes) {
        if (!this.rows.length) {
            return false;
        }
        
        if (defined(aFieldTypes)) {
            for (var i = 0, l = this.rows.length; i < l; i++) {
                this.rows[i] = this._bringType(this.rows[i], aFieldTypes);
            }
        }
        
        return this.rows;
    },

    fetchRow: function(aFieldTypes) {
        return defined(this.rows[0]) ? this._bringType(this.rows[0], aFieldTypes) : false;
    },

    fetchOne: function(aField) {
        var row = this.fetchRow();
        return defined(row[aField]) ? row[aField] : null;
    },

    fetchAllAssoc: function(aField) {
        var rows = this.fetchAll(),
            l = rows.length,
            row = this.fetchRow(),
            newRows = {};

        if (defined(row[aField])) {
            for (var i = 0; i < l; i++) {
                newRows[rows[i][aField]] = rows[i];
            }
            return newRows;
        } else {
            Cu.reportError('Not find column `'+aField+'`');
            return false;
        }
    }
};





/**
 * Debugger
 */
function tblLSFBarDebugHosts() {
    return new SQLiteDb('lsfbar_debugger_hosts');
}

function tblLSFBarDebugTraces() {
    return new SQLiteDb('lsfbar_debugger_traces');
}

function tblLSFBarDebugDefaultTraces() {
    return new SQLiteDb('lsfbar_debugger_default_traces');
}


/**
 * Repoupdater
 */
function tblLSFBarRepGroups() {
    var groups = new SQLiteDb('lsfbar_rep_groups');
    
    groups.tableCreate = function() {
        try {
            var conn = nsSqlite.openConnection(),
                stmt;
                
            if (!conn.tableExists('lsfbar_rep_groups')) {
                stmt = conn.createStatement("CREATE TABLE \"lsfbar_rep_groups\" (\"id\" INTEGER PRIMARY KEY AUTOINCREMENT  NOT NULL, \"name\" TEXT NOT NULL, \"host\" TEXT)");
                stmt.execute();
                stmt.finalize();
            }
            
            conn.close();
            
            return true;
            
        } catch (e) {
            if (stmt) {stmt.finalize();}
            if (conn) {conn.close();}
            Cu.reportError(e);
        }
        
        return false;
    };
    
    return groups;
}

function tblLSFBarRepGroupsRel() {
    var relations = new SQLiteDb('lsfbar_rep_groups_rel');
    
    relations.getSelect().infoRepProjects = function() {
        return this.join('lsfbar_rep_projects', 'rep_projects', ['rep_projects.id = self.project_id'], ['rep_projects.name AS project_name']);
    };
    
    relations.getSelect().infoRepServers = function() {
        return this.join('lsfbar_rep_servers', 'rep_servers', ['rep_servers.id = self.server_id'], ['rep_servers.name AS server_name']);
    };
    
    relations.getSelect().infoRepGroups = function() {
        return this.join('lsfbar_rep_groups', 'rep_groups', ['rep_groups.id = self.group_id'], ['rep_groups.name AS group_name']);
    };
    
    relations.tableCreate = function() {
        try {
            var conn = nsSqlite.openConnection(),
                stmt;
                
            if (!conn.tableExists('lsfbar_rep_groups_rel')) {
                stmt = conn.createStatement("CREATE TABLE \"lsfbar_rep_groups_rel\" (\"group_id\" INTEGER NOT NULL, \"server_id\" INTEGER NOT NULL, \"project_id\" INTEGER NOT NULL)");
                stmt.execute();
                stmt.finalize();
            }
            
            if (!conn.indexExists('idx_lsfbar_rep_group_rel')) {
                stmt = conn.createStatement("CREATE UNIQUE INDEX \"idx_lsfbar_rep_group_rel\" on \"lsfbar_rep_groups_rel\" (group_id ASC, server_id ASC, project_id ASC)");
                stmt.execute();
                stmt.finalize();
            }
            
            conn.close();
            
            return true;
            
        } catch (e) {
            if (stmt) {stmt.finalize();}
            if (conn) {conn.close();}
            Cu.reportError(e);
        }
        
        return false;
    };
    
    return relations;
}

function tblLSFBarRepProjects() {
    var projects = new SQLiteDb('lsfbar_rep_projects');
    
    projects.tableCreate = function() {
        try {
            var conn = nsSqlite.openConnection(),
                stmt;
                
            if (!conn.tableExists('lsfbar_rep_projects')) {
                stmt = conn.createStatement("CREATE TABLE \"lsfbar_rep_projects\" (\"id\" INTEGER PRIMARY KEY NOT NULL, \"name\" TEXT NOT NULL)");
                stmt.execute();
                stmt.finalize();
            }
            
            conn.close();
            
            return true;
            
        } catch (e) {
            if (stmt) {stmt.finalize();}
            if (conn) {conn.close();}
            Cu.reportError(e);
        }
        
        return false;
    };
    
    return projects;
}

function tblLSFBarRepRelations() {
    var relations = new SQLiteDb('lsfbar_rep_relations');
    
    relations.getSelect().infoRepProjects = function() {
        return this.join('lsfbar_rep_projects', 'rep_projects', ['rep_projects.id = self.project_id'], ['rep_projects.name AS project_name']);
    };
    
    relations.getSelect().infoRepServers = function() {
        return this.join('lsfbar_rep_servers', 'rep_servers', ['rep_servers.id = self.server_id'], ['rep_servers.name AS server_name']);
    };
    
    relations.tableCreate = function() {
        try {
            var conn = nsSqlite.openConnection(),
                stmt;
                
            if (!conn.tableExists('lsfbar_rep_relations')) {
                stmt = conn.createStatement("CREATE TABLE \"lsfbar_rep_relations\" (\"server_id\" INTEGER NOT NULL, \"project_id\" INTEGER NOT NULL)");
                stmt.execute();
                stmt.finalize();
            }
            
            if (!conn.indexExists('idx_lsfbar_rep_relations')) {
                stmt = conn.createStatement("CREATE UNIQUE INDEX \"idx_lsfbar_rep_relations\" on \"lsfbar_rep_relations\" (server_id ASC, project_id ASC)");
                stmt.execute();
                stmt.finalize();
            }
            
            conn.close();
            
            return true;
            
        } catch (e) {
            if (stmt) {stmt.finalize();}
            if (conn) {conn.close();}
            Cu.reportError(e);
        }
        
        return false;
    };
    
    return relations;
}

function tblLSFBarRepServers() {
    var servers = new SQLiteDb('lsfbar_rep_servers');
    
    servers.tableCreate = function() {
        try {
            var conn = nsSqlite.openConnection(),
                stmt;
                
            if (!conn.tableExists('lsfbar_rep_servers')) {
                stmt = conn.createStatement("CREATE TABLE \"lsfbar_rep_servers\" (\"id\" INTEGER PRIMARY KEY NOT NULL, \"name\" TEXT NOT NULL)");
                stmt.execute();
                stmt.finalize();
            }
            
            conn.close();
            
            return true;
            
        } catch (e) {
            if (stmt) {stmt.finalize();}
            if (conn) {conn.close();}
            Cu.reportError(e);
        }
        
        return false;
    };
    
    return servers;
}


/*
function tblLSFBarRepoupdaterTasks() {
    var tasks = new SQLiteDb('lsfbar_repoupdater_tasks');
    
    tasks.getSelect().infoRepoupdaterRel = function() {
        return this.join('lsfbar_repoupdater_rel', 'rel', ['rel.task_id = self.id'], ['rel.position']);
    };
    
    return tasks;
}
*/


/*
function tblLSFBarDebugSettings() {
    var self = new SQLiteDb('lsfbar_tools_debug_settings');
    self.getlastId = false;

    self.set = function(aName, aValue) {
        var s = self.createSelect()
            .where('self.name', aName)
            .execute()
            .fetchRow();

        if (s) {
            return self.update({value: aValue}, [{name: aName}]);
        } else {
            return self.insert({name: aName, value: aValue});
        }
    };

    self.get = function(aName) {
        var s = self.createSelect()
            .where('self.name', aName)
            .execute()
            .fetchRow();

        return s ? s.value : null;
    };

    self.list = function() {
        var list = self.createSelect()
            .execute()
            .fetchAllAssoc('name');

        for (var i in list) {
            list[i] = list[i].value;
        }

        return list;
    };

    return self;
}
*/


function defined(val) {
    return (typeof val != 'undefined' && val != null);
}