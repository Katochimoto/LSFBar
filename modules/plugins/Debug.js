"use strict";

let EXPORTED_SYMBOLS = ['Debug'];

let Cc = Components.classes,
    Ci = Components.interfaces,
    Cu = Components.utils;

Cu.import('resource://lsfbar/Observers.js');
Cu.import('resource://lsfbar/Preferences.js');
Cu.import('resource://lsfbar/Sqlite.js');
Cu.import('resource://lsfbar/Http.js');
Cu.import('resource://lsfbar/Win.js');
Cu.import('resource://lsfbar/Console.js');

let settings = null,
    currentUri = null;

const Debug = {
    get ios() {
        delete this.ios;
        return this.ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    },

    get cookies() {
        delete this.cookies;
        return this.cookies = Cc['@mozilla.org/cookieService;1'].getService(Ci.nsICookieService);
    },

    get cookiem() {
        delete this.cookiem;
        return this.cookiem = Cc['@mozilla.org/cookiemanager;1'].getService(Ci.nsICookieManager);
    },

    get EV() {
        return {
            RUN: 'debugger-run',                        // трассировка
            LRUN: 'debugger-lastrun',                   // трассировка при следующем открытии
            CANCEL: 'debugger-cancel',                  // отмена трассировки при следующем открытии
            SETTING_CHANGE: 'debugger-setting-change',  // изменение 1й настройки при редактировании
            SETTINGS_CHANGE: 'debugger-settings-change',// изменение общего объекта настроек при редактировании или изменении хоста
            SETTINGS_RESET: 'debugger-settings-reset'
        };
    },

    get host() {
        let host = '';

        try {
            let win = Win.windowInternal(),
                curUri = win.gBrowser.mCurrentTab.linkedBrowser.currentURI;

            host = curUri.host;
        } catch (e) {};

        return (host.length == 0) ? null : host;
    },

    get spec() {
        let spec = '';

        try {
            let win = Win.windowInternal(),
                curUri = win.gBrowser.mCurrentTab.linkedBrowser.currentURI;

            spec = curUri.spec;
        } catch (e) {}

        return (spec.length == 0) ? null : spec;
    },

    get cookieHost() {
        let host = this.host;
        return host ? '.' + host : null;
    },

    // изменение/получение способа трассировки
    setting: function(aName, aValue) {
        if (!settings) {
            return null;
        }

        if (typeof aValue == 'undefined') {
            return settings[aName] || null;
        }

        if (defined(settings.id)) {
            let tblToolsDebugHosts = new tblLSFBarDebugHosts(),
                data = {};

            data[aName] = parseInt(aValue);

            if (!tblToolsDebugHosts.update(data, [{id: settings.id}])) {
                return false;
            }

        } else {
            Preferences.set('lsfbar.debugger.' + aName, aValue);
        }

        settings[aName] = aValue;
        Observers.notify(this.EV.SETTINGS_CHANGE, null, settings);
        return true;
    },

    // получение текущих настроек или настроек для хоста
    settings: function(aURI) {
        aURI = aURI || {};

        if (!defined(aURI.host)) {
            let host = this.host;

            if (host) {
                Observers.notify(this.EV.SETTINGS_CHANGE, null, settings);
                return settings;

            } else {
                Observers.notify(this.EV.SETTINGS_CHANGE, null, null);
                return null;
            }
        }

        settings = null;

        try {
            let host = aURI.host.replace(/^www\./, '');

            if (host.length > 0) {
                if (Preferences.get('lsfbar.debugger.checkhost')) {
                    let tblToolsDebugHosts = new tblLSFBarDebugHosts();
                    settings = tblToolsDebugHosts.createSelect()
                        .where('self.name', host)
                        .execute()
                        .fetchRow({
                            trc_db: SQLiteTypes.BOOL,
                            trc_templ: SQLiteTypes.BOOL,
                            trc_err: SQLiteTypes.BOOL,
                            trc_other: SQLiteTypes.BOOL
                        });
                }

                if (!settings) {
                    settings = {
                        name: host,
                        trc_db: Preferences.get('lsfbar.debugger.trc_db', false),
                        trc_templ: Preferences.get('lsfbar.debugger.trc_templ', false),
                        trc_err: Preferences.get('lsfbar.debugger.trc_err', false),
                        trc_other: Preferences.get('lsfbar.debugger.trc_other', false)
                    };
                }
            }

            Observers.notify(this.EV.SETTINGS_CHANGE, null, settings);
            return settings;

        } catch(e) {
            Observers.notify(this.EV.SETTINGS_CHANGE, null, settings);
            return false;
        }
    },

    // сброс параметров трассировки для предыдущего хоста
    reset: function() {
        if (!settings) {
            return false;
        }

        var traces = [];

        if (defined(settings.id)) {
            let tblToolsDebugTraces = new tblLSFBarDebugTraces();
            traces = tblToolsDebugTraces.createSelect()
                .where('self.host_id', settings.id)
                .where('self.is_cookies', 1)
                .execute()
                .fetchAll();

        } else {
            let tblDebugDefaultTraces = new tblLSFBarDebugDefaultTraces();
            traces = tblDebugDefaultTraces.createSelect()
                .where('self.is_cookies', 1)
                .execute()
                .fetchAll();
        }

        var cookieHost = this.cookieHost;

        traces.forEach(function(trace) {
            this.cookiem.remove(cookieHost, trace.name, '/', false);
        }, this);

        return true;
    },


    run: function(byCookie) {
        if (!settings) {
            return false;
        }

        let spec = this.spec;

        if (!spec) {
            return false;
        }

        var traces = null,
            types = {
                is_get: SQLiteTypes.BOOL,
                is_cookies: SQLiteTypes.BOOL,
                trc_db: SQLiteTypes.BOOL,
                trc_templ: SQLiteTypes.BOOL,
                trc_err: SQLiteTypes.BOOL,
                trc_other: SQLiteTypes.BOOL
            };

        if (defined(settings.id)) {
            let tblToolsDebugTraces = new tblLSFBarDebugTraces();
            traces = tblToolsDebugTraces.createSelect()
                .where('self.host_id', settings.id)
                .execute()
                .fetchAll(types);

        } else {
            let tblDebugDefaultTraces = new tblLSFBarDebugDefaultTraces();
            traces = tblDebugDefaultTraces.createSelect()
                .execute()
                .fetchAll(types);
        }

        if (!traces) {
            return false;
        }

        var trcGet = {},
            trcCookies = {},
            find = false,
            remove = [];

        traces.forEach(function(curTrc) {
            remove.push(curTrc.name);

            let tdb = (settings.trc_db && curTrc.trc_db),
                ttmpl = (settings.trc_templ && curTrc.trc_templ),
                terr = (settings.trc_err && curTrc.trc_err),
                tother = (settings.trc_other && curTrc.trc_other);

            if (tdb || ttmpl || terr || tother) {
                if (curTrc.is_get) {
                    if (!defined(trcGet[curTrc.name])) {
                        trcGet[curTrc.name] = [];
                    }

                    trcGet[curTrc.name].push(curTrc.value);
                    find = true;
                }

                if (curTrc.is_cookies) {
                    if (!defined(trcCookies[curTrc.name])) {
                        trcCookies[curTrc.name] = [];
                    }

                    trcCookies[curTrc.name].push(curTrc.value);
                    find = true;
                }
            }
        });

        if (!find) {
            return false;
        }

        for (var i in trcGet) {
            trcGet[i] = trcGet[i].join(',')
        }

        for (var i in trcCookies) {
            trcCookies[i] = trcCookies[i].join(',')
        }

        var cookieHost = this.cookieHost,
            cookiesUri = this.ios.newURI('http://' + cookieHost, null, null),
            onlyCookie = byCookie || false;

        for (var i in trcCookies) {
            let cookieString = i + '=' + trcCookies[i] + ';domain=' + cookieHost + ';';
            this.cookies.setCookieString(cookiesUri, null, cookieString, null);
        }

        if (!onlyCookie) {
            Http.openURL(Http.qs(spec, trcGet, remove), 'current tab');
        }

        return true;
    }
};


Observers.add('location-change', function(aSubject, aURI) {
    currentUri = aURI;
    Debug.reset();
    Debug.settings(aURI);
});

Observers.add(Debug.EV.SETTING_CHANGE, function(aSubject, aSetting) {
    let name = aSetting[0],
        value = aSetting[1];

    Debug.setting(name, value);
});

Observers.add(Debug.EV.SETTINGS_RESET, function() {
    Debug.reset();
    Debug.settings(currentUri);
});

Observers.add(Debug.EV.RUN, function() {
    Debug.run();
});

Observers.add(Debug.EV.LRUN, function() {
    Debug.run(true);
});

Observers.add(Debug.EV.CANCEL, function() {
    Debug.reset();
});

function defined(val) {
    return (typeof val != 'undefined' && val != null);
}