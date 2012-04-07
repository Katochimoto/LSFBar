"use strict";

let EXPORTED_SYMBOLS = ['Repoupdater'];

let Cu = Components.utils;

Cu.import('resource://lsfbar/Console.js');
Cu.import('resource://lsfbar/Sqlite.js');
Cu.import('resource://lsfbar/Dom.js');
Cu.import('resource://lsfbar/Preferences.js');
Cu.import('resource://lsfbar/Observers.js');

let lock = false;

const Repoupdater = {
    get EV() {
        return {
            PROJ_REF_START: 'repoupdater-projects-refresh-start',
            PROJ_REF_BEGIN: 'repoupdater-projects-refresh-begin',
            PROJ_REF_END: 'repoupdater-projects-refresh-end',
            LOCK: 'repoupdater-lock',
            UNLOCK: 'repoupdater-unlock',
            ACTION: 'rep-projects-action',
            ACTION_DONE: 'rep-projects-action-done',
            ACTION_DONE_ALL: 'rep-projects-action-doneall'
        };
    },

    get PREF() {
        return {
            PROJ_GROUP: 'lsfbar.repoupdater.projectgroup'
        };
    },

    get lock() {
        return lock;
    }
};

Observers.add(Repoupdater.EV.LOCK, function() {
    lock = true;
});

Observers.add(Repoupdater.EV.UNLOCK, function() {
    lock = false;
});

Observers.add(Repoupdater.EV.PROJ_REF_START, function() {
    if (lock) {
        return false;
    }

    Observers.notify(Repoupdater.EV.LOCK);
    Observers.notify(Repoupdater.EV.PROJ_REF_BEGIN);

    var refreshWorker = new Worker('chrome://lsfbar/content/plugins/repoupdater/w-refresh.js'),
        closeWorker = function () {
            // если закрыть воркет, не выгружается процесс браузера после закрытия
            /*
             if (refreshWorker) {
             refreshWorker.terminate();
             refreshWorker = null;
             }
             */
        };

    refreshWorker.addEventListener('message', function(aEvt) {
        var data = aEvt.data,
            success = false;

        switch (data.cmd) {
            case 'done':
                if (saveProjects(data.responce)) {
                    success = true;
                }
                break;

            case 'error':
                break;
        }

        Observers.notify(Repoupdater.EV.PROJ_REF_END, null, success);
        Observers.notify(Repoupdater.EV.UNLOCK);
        closeWorker();
    }, false);

    refreshWorker.addEventListener('error', function() {
        Observers.notify(Repoupdater.EV.PROJ_REF_END, null, false);
        Observers.notify(Repoupdater.EV.UNLOCK);
        closeWorker();
    }, false);

    refreshWorker.postMessage(null);
    return true;
});


function defined(val) {
    return (typeof val != 'undefined' && val != null);
}


function saveProjects(aResp) {
    try {
        var xml = Dom.string2xml(aResp);
        if (defined(xml.state) && xml.state == 'ok') {
            var serverLen = xml.servers.server.length(),
                projLen = xml.projects.project.length(),
                relLen = xml.relations.relation.length();

            try {
                var conn = nsSqlite.openConnection(),
                    stmt;

                try {
                    conn.beginTransaction();

                    stmt = conn.createStatement('DELETE FROM lsfbar_rep_servers');
                    stmt.execute();
                    stmt.finalize();

                    stmt = conn.createStatement('DELETE FROM lsfbar_rep_projects');
                    stmt.execute();
                    stmt.finalize();

                    stmt = conn.createStatement('DELETE FROM lsfbar_rep_relations');
                    stmt.execute();
                    stmt.finalize();

                    for (var i = 0; i < serverLen; i++) {
                        var server = xml.servers.server[i];
                        stmt = conn.createStatement('INSERT OR IGNORE INTO lsfbar_rep_servers (id, name) VALUES (?, ?)');
                        stmt.bindInt64Parameter(0, Number(server.id));
                        stmt.bindUTF8StringParameter(1, String(server.name));
                        stmt.execute();
                        stmt.finalize();
                    }

                    for (var i = 0; i < projLen; i++) {
                        var project = xml.projects.project[i];
                        stmt = conn.createStatement('INSERT OR IGNORE INTO lsfbar_rep_projects (id, name) VALUES (?, ?)');
                        stmt.bindInt64Parameter(0, Number(project.id));
                        stmt.bindUTF8StringParameter(1, String(project.name));
                        stmt.execute();
                        stmt.finalize();
                    }

                    for (var i = 0; i < relLen; i++) {
                        var relation = xml.relations.relation[i];
                        stmt = conn.createStatement('INSERT OR IGNORE INTO lsfbar_rep_relations (server_id, project_id) VALUES (?, ?)');
                        stmt.bindInt64Parameter(0, Number(relation.server));
                        stmt.bindInt64Parameter(1, Number(relation.project));
                        stmt.execute();
                        stmt.finalize();
                    }

                    conn.commitTransaction();
                } catch (e) {
                    conn.rollbackTransaction();
                }

                conn.executeSimpleSQL('VACUUM');

                return true;

            } catch (e) {
                if (stmt) { stmt.finalize(); }
            } finally {
                if (conn) { conn.close(); }
            }
        }
    } catch (e) {}

    return false;
}