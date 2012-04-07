"use strict";

Components.utils.import('resource://lsfbar/StringBundle.js');
Components.utils.import('resource://lsfbar/Sqlite.js');
Components.utils.import('resource://lsfbar/Win.js');

function onLoad() {
    if (!defined(window.arguments[0].inn)) {
        return;
    }

    if (!defined(window.arguments[0].inn.id)) {
        return;
    }

    if (!defined(window.arguments[0].inn.host_id)) {
        return;
    }

    var varId = parseInt(window.arguments[0].inn.id),
        hostId = parseInt(window.arguments[0].inn.host_id);

    e('host_id').value = hostId;

    if (varId > 0) {
        var tbl = null;
        if (hostId > 0) {
            tbl = new tblLSFBarDebugTraces();
        } else {
            tbl = new tblLSFBarDebugDefaultTraces();
        }

        var varRow = tbl.createSelect()
            .where('self.id', varId)
            .execute()
            .fetchRow({
                is_get: SQLiteTypes.BOOL,
                is_cookies: SQLiteTypes.BOOL,
                trc_db: SQLiteTypes.BOOL,
                trc_templ: SQLiteTypes.BOOL,
                trc_err: SQLiteTypes.BOOL,
                trc_other: SQLiteTypes.BOOL
            });

        if (varRow) {
            e('var_id').value = varRow.id;
            e('host_id').value = hostId;
            e('name').value = varRow.name;
            e('value').value = varRow.value;
            e('is_get').checked = varRow.is_get;
            e('is_cookies').checked = varRow.is_cookies;
            e('trc_db').checked = varRow.trc_db;
            e('trc_templ').checked = varRow.trc_templ;
            e('trc_err').checked = varRow.trc_err;
            e('trc_other').checked = varRow.trc_other;
        }
    } 
}

function onOK() {
    var varName = e('name').value,
        varValue = e('value').value,
        hostId = parseInt(e('host_id').value),
        varId = parseInt(e('var_id').value);

    if (!(/^\w+$/.test(varName))) {
        Win.alert(
            'lsfbar:settingstoolsvaredit',
            StringBundle.getString('app.properties', 'debugger_title_var_edit'),
            StringBundle.getString('app.properties', 'err_var_name_check_data')
        );
        return false;
    }

    if (!(/^\w*$/.test(varValue))) {
        Win.alert(
            'lsfbar:settingstoolsvaredit',
            StringBundle.getString('app.properties', 'debugger_title_var_edit'),
            StringBundle.getString('app.properties', 'err_var_value_check_data')
        );
        return false;
    }

    var tbl = null;
    if (hostId > 0) {
        tbl = new tblLSFBarDebugTraces();
    } else {
        tbl = new tblLSFBarDebugDefaultTraces();
    }

    var sel = tbl.createSelect()
        .where('self.name', varName)
        .where('self.value', varValue);

    if (hostId > 0) {
        sel.where('self.host_id', hostId);
    }

    var varRow = sel.execute()
        .fetchRow();

    

    if (varRow) {
        if ((varId > 0 && varId != parseInt(varRow.id)) || varId == 0) {
            Win.alert(
                'lsfbar:settingstoolsvaredit',
                StringBundle.getString('app.properties', 'debugger_title_var_edit'),
                StringBundle.getString('app.properties', 'err_var_notempty')
            );
            return false;
        }
    }

    var data = {
        name: varName,
        value: varValue,
        is_get: e('is_get').checked ? 1 : 0,
        is_cookies: e('is_cookies').checked ? 1 : 0,
        trc_db: e('trc_db').checked ? 1 : 0,
        trc_templ: e('trc_templ').checked ? 1 : 0,
        trc_err: e('trc_err').checked ? 1 : 0,
        trc_other: e('trc_other').checked ? 1 : 0
    };
    
    if (hostId > 0) {
        data.host_id = hostId;
    }

    if (varId > 0) {
        if (tbl.update(data, [{id: varId}])) {
            window.arguments[0].out = {
                ok: true
            };
            return true;
        } else {
            Win.alert(
                'lsfbar:settingstoolsvaredit',
                StringBundle.getString('app.properties', 'debugger_title_var_edit'),
                StringBundle.getString('app.properties', 'err_var_update')
            );
        }
    } else {
        if (tbl.insert(data)) {
            window.arguments[0].out = {
                ok: true
            };
            return true;
        } else {
            Win.alert(
                'lsfbar:settingstoolsvaredit',
                StringBundle.getString('app.properties', 'debugger_title_var_edit'),
                StringBundle.getString('app.properties', 'err_var_insert')
            );
        }
    }

    return false;
}

function defined(aVal) {
    return (typeof aVal != 'undefined' && aVal != null);
}

function e(aId) {
    return document.getElementById(aId);
}