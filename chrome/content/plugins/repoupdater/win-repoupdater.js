"use strict";

Components.utils.import('resource://lsfbar/Observers.js');
Components.utils.import('resource://lsfbar/Preferences.js');
Components.utils.import('resource://lsfbar/StringBundle.js');
Components.utils.import('resource://lsfbar/Win.js');
Components.utils.import('resource://lsfbar/Console.js');
Components.utils.import('resource://lsfbar/Sqlite.js');
Components.utils.import('resource://lsfbar/Dom.js');

Components.utils.import('resource://lsfbar/app.js');
Components.utils.import('resource://lsfbar/plugins/Repoupdater.js');

let foreach = Array.prototype.forEach,
    filter = Array.prototype.filter,
    __queue,
    __workers = 5,
    __action;

var winRepoupdater = app.plugin({
    _init: function() {
        setTimeout(function() {
            renderGroup();
            renderProject();
        }, 200);

        e('rep-project-group').value = Preferences.get(Repoupdater.PREF.PROJ_GROUP, false) ? '1' : '';

        e('lsfbar-repoupdater-window').addEventListener('click', onaction, false);
        e('rep-project-group').addEventListener('command', onprojgroup, false);

        Observers.add(Repoupdater.EV.LOCK, onlock);
        Observers.add(Repoupdater.EV.UNLOCK, onunlock);
        Observers.add(Repoupdater.EV.PROJ_REF_BEGIN, onprojrefreshbegin);
        Observers.add(Repoupdater.EV.PROJ_REF_END, onprojrefreshend);
        Observers.add(Repoupdater.EV.ACTION, onactionproject);
        Observers.add(Repoupdater.EV.ACTION_DONE, onactionprojectdone);
        Observers.add(Repoupdater.EV.ACTION_DONE_ALL, onactionprojectdoneall);
    },

    _destroy: function() {
        e('lsfbar-repoupdater-window').removeEventListener('click', onaction, false);
        e('rep-project-group').removeEventListener('command', onprojgroup, false);

        Observers.remove(Repoupdater.EV.LOCK, onlock);
        Observers.remove(Repoupdater.EV.UNLOCK, onunlock);
        Observers.remove(Repoupdater.EV.PROJ_REF_BEGIN, onprojrefreshbegin);
        Observers.remove(Repoupdater.EV.PROJ_REF_END, onprojrefreshend);
        Observers.remove(Repoupdater.EV.ACTION, onactionproject);
        Observers.remove(Repoupdater.EV.ACTION_DONE, onactionprojectdone);
        Observers.remove(Repoupdater.EV.ACTION_DONE_ALL, onactionprojectdoneall);
    }
}, null, 'lsfbar:repoupdater');


const repActions = {
    update: {
        action: 'update',
        data: function() {
            for (let i in __queue) {
                __queue[i].data.action = this.action;
            }
            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_update')));
        }
    },
    cleanup: {
        action: 'cleanup',
        data: function() {
            for (let i in __queue) {
                __queue[i].data.action = this.action;
            }
            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_cleanup')));
        }
    },
    revert: {
        action: 'revert',
        data: function() {
            for (let i in __queue) {
                __queue[i].data.action = this.action;
            }
            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_revert')));
        }
    },
    sinfo: {
        action: 'info',
        data: function() {
            for (let i in __queue) {
                __queue[i].data.action = this.action;
            }
            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_sinfo')));
        }
    },
    rlog: {
        action: 'rlog',
        data: function() {
            for (let i in __queue) {
                __queue[i].data.show_log = 1;
            }
            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_rlog')));
        }
    },
    slog: {
        action: 'log',
        data: function() {
            var limit = {value: '10'},
                result = Win.prompt(
                    'lsfbar:repoupdater',
                    StringBundle.getString('app.properties', 'repoupdater_title'),
                    StringBundle.getString('app.properties', 'repoupdater_set_limit'),
                    limit
                );

            if (!result) {
                return false;
            }

            if (!/^\d{1,3}$/.test(limit.value)) {
                Win.alert(
                    'lsfbar:repoupdater',
                    StringBundle.getString('app.properties', 'repoupdater_title'),
                    StringBundle.getString('app.properties', 'repoupdater_err_limit')
                );
                return false;
            }

            for (let i in __queue) {
                __queue[i].data.action = this.action;
                __queue[i].data.limit = limit.value;
            }

            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_slog')));
        }
    },
    updaterevision: {
        action: 'update',
        data: function() {
            var revision = {value: ''},
                result = Win.prompt(
                    'lsfbar:repoupdater',
                    StringBundle.getString('app.properties', 'repoupdater_title'),
                    StringBundle.getString('app.properties', 'repoupdater_set_revision'),
                    revision
                );

            if (!result) {
                return false;
            }

            if (!/^\d{1,10}$/.test(revision.value)) {
                Win.alert(
                    'lsfbar:repoupdater',
                    StringBundle.getString('app.properties', 'repoupdater_title'),
                    StringBundle.getString('app.properties', 'repoupdater_err_revision')
                );
                return false;
            }

            for (let i in __queue) {
                __queue[i].data.action = this.action;
                __queue[i].data.revision = revision.value;
            }
            return true;
        },
        confirm: function() {
            return (this.data() && confirmDialog(StringBundle.getString('app.properties', 'repoupdater_title_update')));
        }
    }
};

function defined(aVal) {
    return (typeof aVal != 'undefined' && aVal != null);
}

function e(aId) {
    return document.getElementById(aId);
}

function emptyObj(aObj) {
    if (!aObj instanceof Object) {
        return true;
    }

    for (let i in aObj) {
        if (aObj.hasOwnProperty(i)) {
            return false;
        }
    }

    return true;
}

function confirmDialog(aText) {
    var params = {
        inn: {text: aText, queue: __queue || {}},
        out: {ok: false}
    };

    Win.dialog(
        'lsfbar:repoupdater',
        'chrome://lsfbar/content/plugins/repoupdater/win-confirm.xul',
        'repoupdater-confirm',
        'lsfbar:repoupdaterconfirm',
        'chrome,titlebar,toolbar,centerscreen,modal',
        params
    );

    return params.out.ok;
}

function getQueue(aQueue) {
    foreach.call(filter.call(document.getElementsByClassName('proj-action'), function(aEl) {
        return (aEl.firstChild.getAttribute('checked') == 'true');
    }), function(aEl) {
        let s = aEl.getAttribute('data-serv'),
            p = aEl.getAttribute('data-proj'),
            key = s + '-' + p;

        if (defined(aQueue[key])) {
            aQueue[key].confirm = true;
        } else {
            aQueue[key] = {
                confirm: false,
                responceText: null,
                data: {
                    action: null,
                    server: s,
                    project: p
                }
            };
        }

        aEl.firstChild.classList.add('waittime');
    });
}

function renderGroup() {
    let target = e('rep-group-list'),
        cacheDoc = document.implementation.createDocument('', 'groups-list', null),
        tblGroups = new tblLSFBarRepGroups(),
        groups = tblGroups.createSelect()
            .order('self.name ASC')
            .execute()
            .fetchAll({id: SQLiteTypes.INTEGER});

    groups = groups || [];

    groups = '<vbox class="table-items-box">' + groups.map(function(aGroup) {
        return '<box class="table-item" data-id="' + aGroup.id + '">' +
            '<button class="table-item content button concealed" data-action="group-select" label="' + aGroup.name + '" />' +
            '</box>';
    }).join('') + '<separator class="table-items-empty"/></vbox>';

    groups = Dom.xml2xul(Dom.parseFromString(groups), cacheDoc, true);

    while (target.hasChildNodes()) {target.removeChild(target.firstChild);}
    target.appendChild(groups);
}

function renderProject(aSort) {
    aSort = (defined(aSort) ? (aSort ? 'ASC' : 'DESC') : 'ASC');
    let projGroup = Preferences.get(Repoupdater.PREF.PROJ_GROUP, false),
        selectTitle = StringBundle.getString('app.properties', 'select'),
        clearTitle = StringBundle.getString('app.properties', 'clearselect'),
        target = e('rep-proj-list'),
        cacheDoc = document.implementation.createDocument('', 'projects-list', null),
        tblRelations = new tblLSFBarRepRelations(),
        projects = tblRelations.createSelect()
            .infoRepProjects()
            .infoRepServers()
            .order(projGroup ? ['LOWER(rep_projects.name) ' + aSort, 'LOWER(rep_servers.name) ' + aSort] : ['LOWER(rep_servers.name) ' + aSort, 'LOWER(rep_projects.name) ' + aSort])
            .where(SQLiteFn.expr('LENGTH(rep_projects.name) > 0'))
            .where(SQLiteFn.expr('LENGTH(rep_servers.name) > 0'))
            .execute()
            .fetchAll();

    projects = projects || [];

    projects = '<vbox class="table-items-box">' + projects.map(function(aVal, aIdx, aList) {
        let title = '',
            itemId, itemName,
            isChange,
            groupId, groupName,
            groupAttr, itemAttr,
            prev = aList[aIdx - 1];

        // группировка по проектам
        if (projGroup) {
            itemId = aVal.server_id;
            itemName = aVal.server_name;
            isChange = (prev && prev.project_id != aVal.project_id);
            groupId = aVal.project_id;
            groupName = aVal.project_name;
            groupAttr = 'data-proj="' + groupId + '"';
            itemAttr = 'data-serv="' + itemId + '"';

            // группировка по серверам
        } else {
            itemId = aVal.project_id;
            itemName = aVal.project_name;
            isChange = (prev && prev.server_id != aVal.server_id);
            groupId = aVal.server_id;
            groupName = aVal.server_name;
            groupAttr = 'data-serv="' + groupId + '"';
            itemAttr = 'data-proj="' + itemId + '"';
        }

        if (!prev || isChange) {
            title = '<box class="table-item" data-group="' + groupId + '">' +
                '<label class="table-item content head" data-action="proj-toggle" value="' + groupName + '"/>' +
                '<button class="table-item button selectall concealed" data-action="proj-selectall" tooltiptext="' + selectTitle + '" />' +
                '<button class="table-item button clear concealed" data-action="proj-clearall" tooltiptext="' + clearTitle + '" />' +
                '</box>';
        }

        return title + '<box class="table-item hide proj-action" data-group="' + groupId + '" ' + groupAttr + ' ' + itemAttr + '>' +
            '<checkbox data-action="select" checked="false" class="table-item content concealed" label="' + itemName + '"/>' +
            '</box>';

    }).join('') + '<separator class="table-items-empty"/></vbox>';

    projects = Dom.xml2xul(Dom.parseFromString(projects), cacheDoc, true);

    while (target.hasChildNodes()) {target.removeChild(target.firstChild);}
    target.appendChild(projects);
}

function clearLastAction() {
    __queue = {};
    __action = null;
    __workers = 5;
    foreach.call(document.getElementsByClassName('proj-action'), function(aEl) {
        let firstClass = aEl.firstChild.classList;
        firstClass.remove('waittime');
        firstClass.remove('wait');
        firstClass.remove('success');
        firstClass.remove('error');
    });

    let box = document.getElementById('rep-log-items-box');
    while (box.firstChild.tagName == 'label') {box.removeChild(box.firstChild);}
    document.getElementById('rep-log-resp').setAttribute('value', '');

    let progress = document.getElementById('repoupdater-action-progress');
    progress.max = 0;
    progress.value = 0;
}

function setStatus(aStatus, aServ, aProj) {
    aServ = parseInt(aServ);
    aProj = parseInt(aProj);
    foreach.call(document.getElementsByClassName('proj-action'), function(aEl) {
        if (parseInt(aEl.getAttribute('data-serv')) == aServ
            && parseInt(aEl.getAttribute('data-proj')) == aProj) {

            let firstClassList = aEl.firstChild.classList;
            ['waittime', 'wait', 'success', 'error'].forEach(function(aSt) {
                firstClassList.remove(aSt);
            });
            firstClassList.add(aStatus);
        }
    });
}


function onaction(aEvt) {
    if (aEvt.originalTarget.hasAttribute('disabled')) {aEvt.stopPropagation(); return false;}

    var el = aEvt.originalTarget,
        action = el.getAttribute('data-action');

    switch (action) {
        case 'win-close':
            window.close();
            break;

        case 'log-toggle':
            el.classList.toggle('open');
            var isopen = el.classList.contains('open');
            foreach.call(document.getElementsByClassName('log-toggle-action'), function(aEl) {aEl.collapsed = !isopen;});
            break;

        case 'proj-toggle':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            var groupId = el.parentNode.getAttribute('data-group');
            foreach.call(filter.call(document.getElementsByClassName('proj-action'), function(aEl) {
                return (aEl.getAttribute('data-group') == groupId);
            }), function(aEl) {
                aEl.classList.toggle('hide');
            });
            break;

        case 'proj-selectall':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            var groupId = el.parentNode.getAttribute('data-group');
            foreach.call(filter.call(document.getElementsByClassName('proj-action'), function(aEl) {
                return (aEl.getAttribute('data-group') == groupId);
            }), function(aEl) {
                if (aEl.classList.contains('hide')) {aEl.classList.remove('hide');}
                aEl.firstChild.setAttribute('checked', 'true');
            });
            break;

        case 'proj-clearall':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            var groupId = el.parentNode.getAttribute('data-group');
            foreach.call(filter.call(document.getElementsByClassName('proj-action'), function(aEl) {
                return (aEl.getAttribute('data-group') == groupId);
            }), function(aEl) {
                aEl.firstChild.setAttribute('checked', 'false');
                let firstClassList = aEl.firstChild.classList;
                ['waittime', 'wait', 'success', 'error'].forEach(function(aSt) {
                    firstClassList.remove(aSt);
                });
            });
            break;

        case 'projs-clearall':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            foreach.call(document.getElementsByClassName('proj-action'), function(aEl) {
                aEl.firstChild.setAttribute('checked', 'false');
                let firstClassList = aEl.firstChild.classList;
                ['waittime', 'wait', 'success', 'error'].forEach(function(aSt) {
                    firstClassList.remove(aSt);
                });
            });
            break;

        case 'projs-sort':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            el.classList.toggle('asc');
            renderProject(!el.classList.contains('asc'));
            break;

        case 'group-select':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            var groupId = el.parentNode.getAttribute('data-id'),
                list = document.getElementsByClassName('proj-action'),
                groupRelList = [],
                tblRepGroupsRel = new tblLSFBarRepGroupsRel(),
                groupRel = tblRepGroupsRel.createSelect()
                    .where('group_id', groupId)
                    .execute()
                    .fetchAll({group_id: SQLiteTypes.INTEGER, server_id: SQLiteTypes.INTEGER, project_id: SQLiteTypes.INTEGER});

            (groupRel || []).forEach(function(aItem) {
                groupRelList.push(aItem.server_id + '-' + aItem.project_id);
            });

            foreach.call(list, function(aEl) {
                if (groupRelList.indexOf(aEl.getAttribute('data-serv') + '-' + aEl.getAttribute('data-proj')) > -1) {
                    let group = aEl.getAttribute('data-group');
                    foreach.call(filter.call(list, function(aEl) {
                        return (aEl.getAttribute('data-group') == group);
                    }), function(aEl) {
                        aEl.classList.remove('hide');
                    });
                    aEl.firstChild.setAttribute('checked', 'true');
                }
            });
            break;

        case 'proj-update':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            Observers.notify(Repoupdater.EV.PROJ_REF_START);
            break;

        case 'rep-action':
            if (Repoupdater.lock) {aEvt.stopPropagation(); return false;}
            clearLastAction();
            getQueue(__queue);

            if (emptyObj(__queue)) {
                Win.alert('lsfbar:repoupdater', StringBundle.getString('app.properties', 'repoupdater_title'), StringBundle.getString('app.properties', 'repoupdater_err_noselect'));
                return;
            }

            __action = repActions[el.getAttribute('value')];

            Observers.add('repoupdater-projects-render', onrenderproject);
            Observers.notify(Repoupdater.EV.PROJ_REF_START);
            break;

        case 'showlog':
            foreach.call(document.getElementsByClassName('rep-log-item'), function(aEl) {
                aEl.classList.remove('press');
            });
            el.classList.add('press');
            document.getElementById('rep-log-resp').setAttribute('value', el.repLogText);
            break;
    }
}

function onprojgroup() {
    Preferences.set(Repoupdater.PREF.PROJ_GROUP, !!this.value);
    renderProject();
}



function onlock() {
    foreach.call(document.getElementsByClassName('concealed'), function(aEl) {
        aEl.setAttribute('disabled', 'true');
    });
}

function onunlock() {
    foreach.call(document.getElementsByClassName('concealed'), function(aEl) {
        aEl.removeAttribute('disabled');
    });
}


function onprojrefreshbegin() {
    e('rep-project-update').firstChild.style.display = 'block';
}

function onprojrefreshend(aSubject, aData) {
    e('rep-project-update').firstChild.style.display = 'none';

    if (!aData) {
        setTimeout(function() {
            let str = StringBundle.getString('app.properties', 'repoupdater_err_update_project');
            Win.alert('lsfbar:repoupdater', str, str);
        }, 1);
        return;
    }

    renderProject();
    Observers.notify('repoupdater-projects-render');
}

function onrenderproject() {
    Observers.remove('repoupdater-projects-render', onrenderproject);

    // повторное выделение после обновления проектов
    let list = document.getElementsByClassName('proj-action');
    foreach.call(list, function(aEl) {
        if (defined(__queue[aEl.getAttribute('data-serv') + '-' + aEl.getAttribute('data-proj')])) {
            let group = aEl.getAttribute('data-group');
            foreach.call(filter.call(list, function(aEl) {
                return (aEl.getAttribute('data-group') == group);
            }), function(aEl) {
                aEl.classList.remove('hide');
            });
            aEl.firstChild.setAttribute('checked', 'true');
        }
    });

    // повторное формирование очереди
    getQueue(__queue);

    setTimeout(function() {
        if (__action.confirm()) {
            document.getElementById('repoupdater-action-progress').max = getQueueLength();
            Observers.notify(Repoupdater.EV.LOCK);
            tryAction();
        }
    }, 1);
}


function getQueueLength() {
    let l = 0;
    for (let i in __queue) {
        if (__queue[i].confirm) {l++};
    }
    return l;
}


function onactionproject() {
    if (emptyObj(__queue)) {
        Observers.notify(Repoupdater.EV.ACTION_DONE_ALL);
        Observers.notify(Repoupdater.EV.UNLOCK);
        return;
    }

    if (__workers < 1) {
        return;
    }

    let q;
    for (let i in __queue) {
        if (!__queue[i].confirm) {
            delete __queue[i];
            continue;
        }

        q = eval(uneval(__queue[i]));
        delete __queue[i];
        break;
    }

    if (q === null) {
        return;
    }

    __workers--;

    setStatus('wait', q.data.server, q.data.project);

    let worker = new Worker('chrome://lsfbar/content/plugins/repoupdater/w-action.js');

    worker.addEventListener('message', function(aEvt) {
        q.responceText = aEvt.data;
        Observers.notify(Repoupdater.EV.ACTION_DONE, 'ok', q);
        setTimeout(function() { worker.terminate(); worker = null; }, 50);
    }, false);

    worker.addEventListener('error', function(aEvt) {
        Console.log(aEvt.code);
        Console.log(aEvt.message);
        q.responceText = aEvt.message;
        Observers.notify(Repoupdater.EV.ACTION_DONE, 'error', q);
        setTimeout(function() { worker.terminate(); worker = null; }, 50);
    }, false);

    worker.postMessage(q.data);

    setTimeout(tryAction, 50);
}


function onactionprojectdone(aSubject, aData) {
    __workers++;

    let s = aData.data.server,
        p = aData.data.project;

    switch (aSubject) {
        case 'ok':
            try {
                let jxon = Dom.string2jxon(aData.responceText);
                if (!defined(jxon.response.state)) { throw new Error('Request failed'); }
                if (jxon.response.state != 'ok') { throw new Error('Request failed'); }
                if (!defined(jxon.response.status)) { throw new Error('Request failed'); }
                if (jxon.response.status != 'ok') { throw new Error(jxon.response.message); }

                setStatus('success', s, p);
                setLog('success', jxon.response.message, s, p);

            } catch (e) {
                Console.log(e.message);
                setStatus('error', s, p);
                setLog('error', e.message, s, p);
            }
            break;

        case 'error':
            setStatus('error', s, p);
            setLog('error', aData.responceText, s, p);
            break;
    }

    let progress = document.getElementById('repoupdater-action-progress');
    progress.setAttribute('value', parseInt(progress.getAttribute('value')) + 1);

    setTimeout(tryAction, 50);
}


function onactionprojectdoneall() {

}


function setLog(aStatus, aLog, aServ, aProj) {
    let serv = (new tblLSFBarRepServers()).createSelect()
            .where('id', aServ)
            .execute()
            .fetchRow();

    let proj = (new tblLSFBarRepProjects()).createSelect()
        .where('id', aProj)
        .execute()
        .fetchRow();

    let box = document.getElementById('rep-log-items-box'),
        bt = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');

    bt.className = 'table-item button rep-log-item ' + aStatus;
    bt.setAttribute('data-action', 'showlog');
    bt.setAttribute('value', serv.name + ': ' + proj.name);
    bt.repLogText = aLog;

    box.insertBefore(bt, box.firstChild);

    serv = null;
    proj = null;
    box = null;
    bt = null;
}


function tryAction() {
    Observers.notify(Repoupdater.EV.ACTION);
}