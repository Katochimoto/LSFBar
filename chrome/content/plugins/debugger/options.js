"use strict";

var optionsDebugger = app.plugin({
    // выполняется при загрузке панели, а не окна
    init: function() {
        let tblToolsDebugHosts = new tblLSFBarDebugHosts(),
            hosts = tblToolsDebugHosts.createSelect()
                .order('self.name ASC')
                .execute()
                .fetchAll();

        let hostlist = e('lsfbar-dbg-settings-hostslist');
        hosts.forEach(function(aHost) {
            this.appendItem(aHost.name, aHost.id);
        }, hostlist);

        // выбор текущего хота
        hostlist.addEventListener('command', this.onhostselect, false);
        e('lsfbar-dbg-settings-trcdb').addEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-trctempl').addEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-trcerr').addEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-trcother').addEventListener('command', this.onchangehostparams, false);

        // редактирование/добавление/удаление хоста
        e('lsfbar-dbg-settings-hostedit').addEventListener('command', this.onedithost, false);
        e('lsfbar-dbg-settings-hostadd').addEventListener('command', this.onedithost, false);
        e('lsfbar-dbg-settings-hostdel').addEventListener('command', this.onedithost, false);

        // добавление переменной
        e('lsfbar-dbg-settings-varadd').addEventListener('command', this.oneditvarparams, false);

        // настройки по умолчанию
        e('lsfbar-dbg-settings-defvaradd').addEventListener('command', this.oneditdefvarparams, false);

        this.createVarList(null, true);
        this.setTrcParams();

        e('debugger-trcdb').checked = Preferences.get('lsfbar.debugger.trc_db', false);
        e('debugger-trctempl').checked = Preferences.get('lsfbar.debugger.trc_templ', false);
        e('debugger-trcerr').checked = Preferences.get('lsfbar.debugger.trc_err', false);
        e('debugger-trcother').checked = Preferences.get('lsfbar.debugger.trc_other', false);
        e('debugger-checkhost').checked = Preferences.get('lsfbar.debugger.checkhost', false);

        e('debugger-trcdb').addEventListener('command', this.ondbgtrcdb, false);
        e('debugger-trctempl').addEventListener('command', this.ondbgtrctempl, false);
        e('debugger-trcerr').addEventListener('command', this.ondbgtrcerr, false);
        e('debugger-trcother').addEventListener('command', this.ondbgtrcother, false);
        e('debugger-checkhost').addEventListener('command', this.ondbgcheckhost, false);
    },

    _destroy: function() {
        e('lsfbar-dbg-settings-hostslist').removeEventListener('command', this.onhostselect, false);
        e('lsfbar-dbg-settings-trcdb').removeEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-trctempl').removeEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-trcerr').removeEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-trcother').removeEventListener('command', this.onchangehostparams, false);
        e('lsfbar-dbg-settings-hostedit').removeEventListener('command', this.onedithost, false);
        e('lsfbar-dbg-settings-hostadd').removeEventListener('command', this.onedithost, false);
        e('lsfbar-dbg-settings-hostdel').removeEventListener('command', this.onedithost, false);
        e('lsfbar-dbg-settings-varadd').removeEventListener('command', this.oneditvarparams, false);
        e('lsfbar-dbg-settings-defvaradd').removeEventListener('command', this.oneditdefvarparams, false);
        e('debugger-trcdb').removeEventListener('command', this.ondbgtrcdb, false);
        e('debugger-trctempl').removeEventListener('command', this.ondbgtrctempl, false);
        e('debugger-trcerr').removeEventListener('command', this.ondbgtrcerr, false);
        e('debugger-trcother').removeEventListener('command', this.ondbgtrcother, false);
        e('debugger-checkhost').removeEventListener('command', this.ondbgcheckhost, false);

        this.clearVarList();
        this.clearVarList(true);
    },


    hostSelect: function(aHostId) {
        let tblToolsDebugHosts = new tblLSFBarDebugHosts(),
            host = tblToolsDebugHosts.createSelect()
                .where('self.id', aHostId)
                .execute()
                .fetchRow();

        if (host) {
            this.createVarList(host.id);
            this.setTrcParams(host);

            e('lsfbar-dbg-settings-hostedit').disabled = false;
            e('lsfbar-dbg-settings-hostdel').disabled = false;
            e('lsfbar-dbg-settings-varadd').disabled = false;
            e('lsfbar-dbg-settings-trcdb').disabled = false;
            e('lsfbar-dbg-settings-trctempl').disabled = false;
            e('lsfbar-dbg-settings-trcerr').disabled = false;
            e('lsfbar-dbg-settings-trcother').disabled = false;
        }
    },

    setTrcParams: function(aHost) {
        if (defined(aHost)) {
            e('lsfbar-dbg-settings-trcdb').checked = (parseInt(aHost.trc_db) > 0);
            e('lsfbar-dbg-settings-trctempl').checked = (parseInt(aHost.trc_templ) > 0);
            e('lsfbar-dbg-settings-trcerr').checked = (parseInt(aHost.trc_err) > 0);
            e('lsfbar-dbg-settings-trcother').checked = (parseInt(aHost.trc_other) > 0);
        }
    },

    createVarCheckBox: function(aId, aChecked) {
        let cell = document.createElementNS(XULNS, 'listcell');
        cell.setAttribute('id', aId);
        cell.setAttribute('orient', 'vertical');
        cell.setAttribute('class', 'listcell-iconic pointer');
        cell.setAttribute('image', 'chrome://lsfbar/skin/images/' + (aChecked ? 'yes' : 'no') + '-16x16.png');
        cell.addEventListener('click', this.onchangevarparams, false);
        return cell;
    },

    clearVarList: function(aDefault) {
        let el = e(defined(aDefault) ? 'lsfbar-dbg-settings-defvarlist' : 'lsfbar-dbg-settings-varlist'),
            l = el.childNodes.length - 1;

        for (var i = l; i > 0; i--) {
            let varNode = el.childNodes.item(i);
            if (varNode.nodeName == "listitem") {
                el.removeChild(varNode);
            }
        }
    },

    createVarList: function(aHostId, aDefault) {
        this.clearVarList(aDefault);

        let el = e(defined(aDefault) ? 'lsfbar-dbg-settings-defvarlist' : 'lsfbar-dbg-settings-varlist'),
            traces = null,
            pref = null,
            editEvent = null,
            delEvent = null;

        if (defined(aDefault)) {
            pref = 'Def';
            editEvent = this.oneditdefvarparams;
            delEvent = this.ondeldefvarparams;

            let tblToolsDebugDefTraces = new tblLSFBarDebugDefaultTraces();
            traces = tblToolsDebugDefTraces.createSelect()
                .execute()
                .fetchAll({
                    is_get: SQLiteTypes.BOOL,
                    is_cookies: SQLiteTypes.BOOL,
                    trc_db: SQLiteTypes.BOOL,
                    trc_templ: SQLiteTypes.BOOL,
                    trc_err: SQLiteTypes.BOOL,
                    trc_other: SQLiteTypes.BOOL
                });

        } else {
            pref = '';
            editEvent = this.oneditvarparams;
            delEvent = this.ondelvarparams;

            let tblToolsDebugTraces = new tblLSFBarDebugTraces();
            traces = tblToolsDebugTraces.createSelect()
                .where('self.host_id', aHostId)
                .execute()
                .fetchAll({
                    is_get: SQLiteTypes.BOOL,
                    is_cookies: SQLiteTypes.BOOL,
                    trc_db: SQLiteTypes.BOOL,
                    trc_templ: SQLiteTypes.BOOL,
                    trc_err: SQLiteTypes.BOOL,
                    trc_other: SQLiteTypes.BOOL
                });
        }

        if (!traces) {
            return;
        }

        let fragment = document.createDocumentFragment();
        traces.forEach(function(trc) {
            let row = document.createElementNS(XULNS, 'listitem'),
                cell = document.createElementNS(XULNS, 'listcell');

            row.setAttribute('allowevents', 'true');

            cell.setAttribute('label', trc.name);
            row.appendChild(cell);

            cell = document.createElementNS(XULNS, 'listcell');
            cell.setAttribute('label', trc.value);
            row.appendChild(cell);

            row.appendChild(this.createVarCheckBox('__value' + pref + 'IsGet-' + trc.id, trc.is_get));
            row.appendChild(this.createVarCheckBox('__value' + pref + 'IsCookies-' + trc.id, trc.is_cookies));
            row.appendChild(this.createVarCheckBox('__value' + pref + 'Db-' + trc.id, trc.trc_db));
            row.appendChild(this.createVarCheckBox('__value' + pref + 'Templ-' + trc.id, trc.trc_templ));
            row.appendChild(this.createVarCheckBox('__value' + pref + 'Err-' + trc.id, trc.trc_err));
            row.appendChild(this.createVarCheckBox('__value' + pref + 'Other-' + trc.id, trc.trc_other));

            cell = document.createElementNS(XULNS, 'listcell');
            cell.setAttribute('id', '__value' + pref + 'Edit-' + trc.id);
            cell.setAttribute('orient', 'vertical');
            cell.setAttribute('class', 'listcell-iconic pointer');
            cell.setAttribute('image', 'chrome://lsfbar/skin/images/pencil-16x16.png');
            cell.addEventListener('click', editEvent, false);
            row.appendChild(cell);

            cell = document.createElementNS(XULNS, 'listcell');
            cell.setAttribute('id', '__value' + pref + 'Del-' + trc.id);
            cell.setAttribute('orient', 'vertical');
            cell.setAttribute('class', 'listcell-iconic pointer');
            cell.setAttribute('image', 'chrome://lsfbar/skin/images/edittrash-16x16.png');
            cell.addEventListener('click', delEvent, false);
            row.appendChild(cell);

            cell = document.createElementNS(XULNS, 'listcell');
            cell.setAttribute('label', '    ');
            row.appendChild(cell);

            fragment.appendChild(row);
        }, this);

        el.appendChild(fragment);
    },

    reload: function() {
        let hostlist = e('lsfbar-dbg-settings-hostslist'),
            hostId = parseInt(hostlist.value),
            selectHostId = 0,
            tblToolsDebugHosts = new tblLSFBarDebugHosts();

        let hosts = tblToolsDebugHosts.createSelect()
            .order('self.name ASC')
            .execute()
            .fetchAll();

        hostlist.removeAllItems();
        this.clearVarList();

        e('lsfbar-dbg-settings-hostedit').disabled = true;
        e('lsfbar-dbg-settings-hostdel').disabled = true;
        e('lsfbar-dbg-settings-varadd').disabled = true;
        e('lsfbar-dbg-settings-trcdb').disabled = true;
        e('lsfbar-dbg-settings-trctempl').disabled = true;
        e('lsfbar-dbg-settings-trcerr').disabled = true;
        e('lsfbar-dbg-settings-trcother').disabled = true;

        e('lsfbar-dbg-settings-trcdb').checked = false;
        e('lsfbar-dbg-settings-trctempl').checked = false;
        e('lsfbar-dbg-settings-trcerr').checked = false;
        e('lsfbar-dbg-settings-trcother').checked = false;

        if (hosts) {
            for (let i = 0, l = hosts.length; i < l; i++) {
                let item = hostlist.appendItem(hosts[i].name, hosts[i].id);
                if (hostId == parseInt(hosts[i].id)) {
                    item.setAttribute('selected', true);
                    hostlist.value = hosts[i].id;
                    selectHostId = hostId;
                }
            }
        }

        if (selectHostId > 0) {
            this.hostSelect(selectHostId);
        }
    },








    // функция, вызываемая при выборе хоста
    onhostselect: function(aEvt) {
        optionsDebugger.hostSelect(aEvt.target.getAttribute('value'))
        return false;
    },


    // выбор параметров трассировки
    onchangehostparams: function(aEvt) {
        let hostId = e('lsfbar-dbg-settings-hostslist').value;

        if (parseInt(hostId) > 0) {
            let updData = {};
            switch (aEvt.target.getAttribute('id')) {
                case 'lsfbar-dbg-settings-trcdb':
                    updData['trc_db'] = aEvt.target.checked ? 1 : 0;
                    break;

                case 'lsfbar-dbg-settings-trctempl':
                    updData['trc_templ'] = aEvt.target.checked ? 1 : 0;
                    break;

                case 'lsfbar-dbg-settings-trcerr':
                    updData['trc_err'] = aEvt.target.checked ? 1 : 0;
                    break;

                case 'lsfbar-dbg-settings-trcother':
                    updData['trc_other'] = aEvt.target.checked ? 1 : 0;
                    break;
            }

            let tblToolsDebugHosts = new tblLSFBarDebugHosts();
            tblToolsDebugHosts.update(updData, [{id: hostId}]);

            Observers.notify(Debug.EV.SETTINGS_RESET);
        }

        return false;
    },

    // удаление/добавление/редактирование хоста
    onedithost: function(aEvt) {
        let hostId = 0;
        switch (aEvt.target.getAttribute('id')) {
            case 'lsfbar-dbg-settings-hostdel':
                hostId = parseInt(e('lsfbar-dbg-settings-hostslist').value);
                if (hostId > 0) {
                    let tblToolsDebugHosts = new tblLSFBarDebugHosts();

                    if (tblToolsDebugHosts.del([{id: hostId}])) {
                        let tblToolsDebugTraces = new tblLSFBarDebugTraces();
                        tblToolsDebugTraces.del([{host_id: hostId}]);

                        optionsDebugger.reload();
                        Observers.notify(Debug.EV.SETTINGS_RESET);
                    }
                }
                break;

            case 'lsfbar-dbg-settings-hostedit':
                hostId = e('lsfbar-dbg-settings-hostslist').value;

            case 'lsfbar-dbg-settings-hostadd':
                let params = {
                    inn: {
                        id: hostId
                    },
                    out: null
                };

                document.documentElement.openSubDialog(
                    'chrome://lsfbar/content/plugins/debugger/win-host-edit.xul',
                    'chrome,dialog=yes,modal=yes,centerscreen,resizable=no,dependent=yes',
                    params
                );

                if (defined(params.out)) {
                    if (defined(params.out.ok)) {
                        e('lsfbar-dbg-settings-hostslist').value = params.out.hostId;
                        optionsDebugger.reload();
                        Observers.notify(Debug.EV.SETTINGS_RESET);
                    }
                }
                break;
        }
    },


    // редактирование/добавление переменной
    oneditvarparams: function(aEvt) {
        let hostId = parseInt(e('lsfbar-dbg-settings-hostslist').value);
        if (!hostId) {
            return false;
        }

        let elId = aEvt.target.getAttribute('id'),
            params = {
                inn: {
                    id: 0,
                    host_id: hostId
                },
                out: null
            };

        switch (elId) {
            case 'lsfbar-dbg-settings-varadd':
                break;

            default:
                params.inn.id = parseInt((elId.split('-'))[1]);
        }

        document.documentElement.openSubDialog(
            'chrome://lsfbar/content/plugins/debugger/win-var-edit.xul',
            'chrome,dialog=yes,modal=yes,centerscreen,resizable=no,dependent=yes',
            params
        );

        if (defined(params.out)) {
            if (defined(params.out.ok)) {
                optionsDebugger.reload();
                Observers.notify(Debug.EV.SETTINGS_RESET);
            }
        }
    },


    // ред/доб переменной по умолчанию
    oneditdefvarparams: function(aEvt) {
        let elId = aEvt.target.getAttribute('id'),
            params = {
                inn: {
                    id: 0,
                    host_id: 0
                },
                out: null
            };

        switch (elId) {
            case 'lsfbar-dbg-settings-defvaradd':
                break;

            default:
                params.inn.id = parseInt((elId.split('-'))[1]);
        }

        document.documentElement.openSubDialog(
            'chrome://lsfbar/content/plugins/debugger/win-var-edit.xul',
            'chrome,dialog=yes,modal=yes,centerscreen,resizable=no,dependent=yes',
            params
        );

        if (defined(params.out)) {
            if (defined(params.out.ok)) {
                optionsDebugger.createVarList(null, true);
                Observers.notify(Debug.EV.SETTINGS_RESET);
            }
        }
    },


    // удаление переменной по умолчанию
    ondeldefvarparams: function(aEvt) {
        let elId = aEvt.target.getAttribute('id'),
            varId = parseInt((elId.split('-'))[1]);

        if (!varId) {
            return false;
        }

        let tblToolsDebugDefTraces = new tblLSFBarDebugDefaultTraces();
        if (tblToolsDebugDefTraces.del([{id: varId}])) {
            optionsDebugger.createVarList(null, true);
            Observers.notify(Debug.EV.SETTINGS_RESET);
        }

        return true;
    },


    // удаление переменной
    ondelvarparams: function(aEvt) {
        let hostId = parseInt(e('lsfbar-dbg-settings-hostslist').value);
        if (!hostId) {
            return false;
        }

        let elId = aEvt.target.getAttribute('id'),
            varId = parseInt((elId.split('-'))[1]);

        if (!varId) {
            return false;
        }

        let tblToolsDebugTraces = new tblLSFBarDebugTraces();
        if (tblToolsDebugTraces.del([{id: varId, host_id: hostId}])) {
            optionsDebugger.reload();
            Observers.notify(Debug.EV.SETTINGS_RESET);
        }

        return true;
    },


    onchangevarparams: function(aEvt) {
        let elId = aEvt.target.getAttribute('id').split('-'),
            elImage = aEvt.target.getAttribute('image'),
            paramId = parseInt(elId[1]),
            paramType = elId[0],
            checked = (elImage == 'chrome://lsfbar/skin/images/yes-16x16.png') ? true : false;

        if (paramId > 0) {
            let def = false,
                tbl = null,
                updData = {};

            switch (paramType) {
                case '__valueDefIsGet':
                    def = true;

                case '__valueIsGet':
                    updData['is_get'] = checked ? 0 : 1;
                    break;

                case '__valueDefIsCookies':
                    def = true;

                case '__valueIsCookies':
                    updData['is_cookies'] = checked ? 0 : 1;
                    break;

                case '__valueDefDb':
                    def = true;

                case '__valueDb':
                    updData['trc_db'] = checked ? 0 : 1;
                    break;

                case '__valueDefTempl':
                    def = true;

                case '__valueTempl':
                    updData['trc_templ'] = checked ? 0 : 1;
                    break;

                case '__valueDefErr':
                    def = true;

                case '__valueErr':
                    updData['trc_err'] = checked ? 0 : 1;
                    break;

                case '__valueDefOther':
                    def = true;

                case '__valueOther':
                    updData['trc_other'] = checked ? 0 : 1;
                    break;
            }

            if (def) {
                tbl = new tblLSFBarDebugDefaultTraces();
            } else {
                tbl = new tblLSFBarDebugTraces();
            }

            if (tbl.update(updData, [{id: paramId}])) {
                aEvt.target.setAttribute('image', 'chrome://lsfbar/skin/images/' + (checked ? 'no' : 'yes') + '-16x16.png');

                Observers.notify(Debug.EV.SETTINGS_RESET);
            }
        }

        return false;
    },

    ondbgtrcdb: function(aEvt) {
        Preferences.set('lsfbar.debugger.trc_db', aEvt.target.checked);
        Observers.notify(Debug.EV.SETTINGS_RESET);
    },

    ondbgtrctempl: function(aEvt) {
        Preferences.set('lsfbar.debugger.trc_templ', aEvt.target.checked);
        Observers.notify(Debug.EV.SETTINGS_RESET);
    },

    ondbgtrcerr: function(aEvt) {
        Preferences.set('lsfbar.debugger.trc_err', aEvt.target.checked);
        Observers.notify(Debug.EV.SETTINGS_RESET);
    },

    ondbgtrcother: function(aEvt) {
        Preferences.set('lsfbar.debugger.trc_other', aEvt.target.checked);
        Observers.notify(Debug.EV.SETTINGS_RESET);
    },

    ondbgcheckhost: function(aEvt) {
        Preferences.set('lsfbar.debugger.checkhost', aEvt.target.checked);
        Observers.notify(Debug.EV.SETTINGS_RESET);
    }

}, null, 'lsfbar:options');