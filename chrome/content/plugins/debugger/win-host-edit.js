"use strict";

Components.utils.import('resource://lsfbar/StringBundle.js');
Components.utils.import('resource://lsfbar/Sqlite.js');
Components.utils.import('resource://lsfbar/Http.js');
Components.utils.import('resource://lsfbar/Win.js');

function onLoad() {
    if (!defined(window.arguments[0].inn)) {
        return;
    }

    if (!defined(window.arguments[0].inn.id)) {
        return;
    }

    let hostId = parseInt(window.arguments[0].inn.id);
    if (hostId > 0) {
        let tblToolsDebugHosts = new tblLSFBarDebugHosts(),
            host = tblToolsDebugHosts.createSelect()
                .where('self.id', hostId)
                .execute()
                .fetchRow({
                    trc_db: SQLiteTypes.BOOL,
                    trc_templ: SQLiteTypes.BOOL,
                    trc_err: SQLiteTypes.BOOL,
                    trc_other: SQLiteTypes.BOOL
                });

        if (host) {
            e('hostId').value = host.id;
            e('name').value = host.name;
            e('trc_db').checked = host.trc_db;
            e('trc_templ').checked = host.trc_templ;
            e('trc_err').checked = host.trc_err;
            e('trc_other').checked = host.trc_other;
        }
    }
}

function onOK() {
    let name = e('name').value;
    name = name.replace(/^www\./, '');

    if (!Http.checkHost(name)) {
        Win.alert(
            'lsfbar:settingstoolshostedit',
            StringBundle.getString('app.properties', 'debugger_title_group_edit'),
            StringBundle.getString('app.properties', 'err_host_check_url')
        );

        return false;
    }

    let hostId = parseInt(e('hostId').value),
        data = {
            'name': name,
            'trc_db': e('trc_db').checked ? 1 : 0,
            'trc_templ': e('trc_templ').checked ? 1 : 0,
            'trc_err': e('trc_err').checked ? 1 : 0,
            'trc_other': e('trc_other').checked ? 1 : 0
        },
        tblToolsDebugHosts = new tblLSFBarDebugHosts(),
        host = tblToolsDebugHosts.createSelect()
            .where('self.name', data['name'])
            .execute()
            .fetchRow();

    if (host) {
        if ((hostId > 0 && hostId != parseInt(host.id)) || hostId == 0) {
            Win.alert(
                'lsfbar:settingstoolshostedit',
                StringBundle.getString('app.properties', 'debugger_title_group_edit'),
                StringBundle.getString('app.properties', 'err_host_notempty')
            );
            return false;
        }
    }


    if (hostId > 0) {
        if (tblToolsDebugHosts.update(data, [{id: hostId}])) {
            window.arguments[0].out = {
                ok: true,
                hostId: hostId
            };
            return true;

        } else {
            Win.alert(
                'lsfbar:settingstoolshostedit',
                StringBundle.getString('app.properties', 'debugger_title_group_edit'),
                StringBundle.getString('app.properties', 'err_host_update')
            );
        }

    } else {
        data['id'] = tblToolsDebugHosts.insert(data);
        if (data['id']) {
            window.arguments[0].out = {
                ok: true,
                hostId: data['id']
            };
            return true;

        } else {
            Win.alert(
                'lsfbar:settingstoolshostedit',
                StringBundle.getString('app.properties', 'debugger_title_group_edit'),
                StringBundle.getString('app.properties', 'err_host_insert')
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