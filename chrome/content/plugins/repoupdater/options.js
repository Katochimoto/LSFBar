"use strict";

let foreach = Array.prototype.forEach,
    filter = Array.prototype.filter;

var optionsRepoupdater = app.plugin({

    // выполняется при загрузке панели, а не окна
    init: function() {
        this.renderGroup();
        this.renderProject();

        e('rep-project-group').value = Preferences.get(Repoupdater.PREF.PROJ_GROUP, false) ? '1' : '';

        e('rep-project-update').addEventListener('command', this.onrefresh, false);
        e('rep-group-add').addEventListener('click', this.ongroupaction, false);
        e('rep-group-list').addEventListener('click', this.ongroupaction, false);
        e('rep-proj-list').addEventListener('click', this.onprojectaction, false);
        e('rep-project-group').addEventListener('command', this.onshowgroup, false);

        Observers.add(Repoupdater.EV.LOCK, this.onlock, this);
        Observers.add(Repoupdater.EV.UNLOCK, this.onunlock, this);
        Observers.add(Repoupdater.EV.PROJ_REF_BEGIN, this.onrefreshstart, this);
        Observers.add(Repoupdater.EV.PROJ_REF_END, this.onrefreshend, this);
    },

    _destroy: function() {
        e('rep-project-update').removeEventListener('command', this.onrefresh, false);
        e('rep-group-add').removeEventListener('click', this.ongroupaction, false);
        e('rep-group-list').removeEventListener('click', this.ongroupaction, false);
        e('rep-proj-list').removeEventListener('click', this.onprojectaction, false);
        e('rep-project-group').removeEventListener('command', this.onshowgroup, false);

        Observers.remove(Repoupdater.EV.LOCK, this.onlock, this);
        Observers.remove(Repoupdater.EV.UNLOCK, this.onunlock, this);
        Observers.remove(Repoupdater.EV.PROJ_REF_BEGIN, this.onrefreshstart, this);
        Observers.remove(Repoupdater.EV.PROJ_REF_END, this.onrefreshend, this);
    },

    renderGroup: function() {
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
                '<label data-action="select" class="table-item content button concealed" data-id="' + aGroup.id + '" value="' + aGroup.name + '" />' +
                '<button data-action="edit" class="table-item button edit concealed"/>' +
                '<button data-action="del" class="table-item button del concealed"/>' +
                '</box>';
        }).join('') + '<separator class="table-items-empty"/></vbox>';

        groups = Dom.xml2xul(Dom.parseFromString(groups), cacheDoc, true);

        while (target.hasChildNodes()) {target.removeChild(target.firstChild);}
        target.appendChild(groups);
    },

    renderProject: function() {
        let projGroup = Preferences.get(Repoupdater.PREF.PROJ_GROUP, false),
            target = e('rep-proj-list'),
            cacheDoc = document.implementation.createDocument('', 'projects-list', null),
            tblRelations = new tblLSFBarRepRelations(),
            projects = tblRelations.createSelect()
                .infoRepProjects()
                .infoRepServers()
                .order(projGroup ? ['LOWER(rep_projects.name) ASC', 'LOWER(rep_servers.name) ASC'] : ['LOWER(rep_servers.name) ASC', 'LOWER(rep_projects.name) ASC'])
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
                    '<label class="table-item content head" data-action="list" value="' + groupName + '"/>' +
                    '</box>';
            }

            return title + '<box class="table-item hide project" data-group="' + groupId + '" ' + groupAttr + ' ' + itemAttr + '>' +
                '<checkbox data-action="select" checked="false" class="table-item content concealed" label="' + itemName + '"/>' +
                '</box>';
        }).join('') + '<separator class="table-items-empty"/></vbox>';

        projects = Dom.xml2xul(Dom.parseFromString(projects), cacheDoc, true);

        while (target.hasChildNodes()) {target.removeChild(target.firstChild);}
        target.appendChild(projects);
    },

    openProjectsGroup: function(aGroup) {
        let list = e('rep-proj-list').getElementsByClassName('project');

        foreach.call(list, function(aEl) {
            aEl.classList.add('hide');
            aEl.firstChild.removeAttribute('checked');
        });

        if (!aGroup) {return;}

        let groupRelList = [],
            tblRepGroupsRel = new tblLSFBarRepGroupsRel(),
            groupRel = tblRepGroupsRel.createSelect()
                .where('group_id', aGroup)
                .execute()
                .fetchAll({group_id: SQLiteTypes.INTEGER, server_id: SQLiteTypes.INTEGER, project_id: SQLiteTypes.INTEGER});

        groupRel.forEach(function(aItem) {
            groupRelList.push(aItem.server_id + '-' + aItem.project_id);
        });

        foreach.call(list, function(aEl) {
            if (groupRelList.indexOf(aEl.getAttribute('data-serv') + '-' + aEl.getAttribute('data-proj')) > -1) {
                let group = aEl.getAttribute('data-group');
                foreach.call(filter.call(list, function(aEl) {
                    return (aEl.getAttribute('data-group') == group);
                }), function(aEl) {
                    if (aEl.classList.contains('hide')) {aEl.classList.remove('hide');}
                })
                aEl.firstChild.setAttribute('checked', 'true');
            }
        });
    },

    get currentGroup() {
        try {
            return parseInt(e('rep-group-list').getElementsByClassName('table-item press')[0].getAttribute('data-id'));
        } catch (e) {
            return 0;
        }
    },


    onprojectaction: function(aEvt) {
        if (Repoupdater.lock) {
            return;
        }

        let target = e('rep-proj-list'),
            el = aEvt.originalTarget,
            action = el.getAttribute('data-action'),
            groupId = parseInt(el.parentNode.getAttribute('data-group')),
            groupFilter = function(aEl) {
                return (aEl.getAttribute('data-group') == groupId);
            };

        switch (action) {
            case 'list':
                foreach.call(filter.call(target.getElementsByClassName('project'), groupFilter), function(aEl) {
                    aEl.classList.toggle('hide');
                });
                break;

            case 'select':
                let currentGroup = optionsRepoupdater.currentGroup;
                if (!currentGroup) {
                    let title = StringBundle.getString('app.properties', 'repoupdater_err_current_group');
                    Win.alert('lsfbar:options', title, title);

                } else {
                    let tblRepGroupsRel = new tblLSFBarRepGroupsRel(),
                        projId = parseInt(el.parentNode.getAttribute('data-proj')),
                        servId = parseInt(el.parentNode.getAttribute('data-serv'));

                    if (el.checked) {
                        tblRepGroupsRel.insert({group_id: currentGroup, server_id: servId, project_id: projId});
                    } else {
                        tblRepGroupsRel.del([{group_id: currentGroup, server_id: servId, project_id: projId}]);
                    }
                }
                break;
        }
    },


    ongroupaction: function(aEvt) {
        if (Repoupdater.lock) {
            return;
        }

        let el = aEvt.originalTarget,
            action = el.getAttribute('data-action'),
            groupId = 0,
            params = {};

        switch (action) {
            case 'del':
                groupId = parseInt(el.parentNode.getAttribute('data-id'));
                (new tblLSFBarRepGroups()).del([{id: groupId}]);
                (new tblLSFBarRepGroupsRel()).del([{group_id: groupId}]);
                optionsRepoupdater.renderGroup();
                optionsRepoupdater.openProjectsGroup();
                break;

            case 'edit':
                groupId = parseInt(el.parentNode.getAttribute('data-id'));
                params = {inn: {id: groupId}, out: null};
                document.documentElement.openSubDialog(
                    'chrome://lsfbar/content/plugins/repoupdater/win-group-edit.xul',
                    'chrome,dialog=yes,modal=yes,centerscreen,resizable=no,dependent=yes',
                    params
                );
                optionsRepoupdater.renderGroup();
                optionsRepoupdater.openProjectsGroup();
                break;

            case 'add':
                params = {inn: {id: 0}, out: null};
                document.documentElement.openSubDialog(
                    'chrome://lsfbar/content/plugins/repoupdater/win-group-edit.xul',
                    'chrome,dialog=yes,modal=yes,centerscreen,resizable=no,dependent=yes',
                    params
                );
                optionsRepoupdater.renderGroup();
                optionsRepoupdater.openProjectsGroup();
                break;

            case 'select':
                foreach.call(e('rep-group-list').getElementsByClassName('table-item press'), function(aEl) {
                    aEl.classList.remove('press');
                });
                el.classList.add('press');
                optionsRepoupdater.openProjectsGroup(parseInt(el.parentNode.getAttribute('data-id')));
                break;
        }
    },

    onrefresh: function() {
        if (Repoupdater.lock) {
            return;
        }

        Observers.notify(Repoupdater.EV.PROJ_REF_START);
    },

    onrefreshstart: function() {
        document.getElementById('rep-project-update').firstChild.style.display = 'block';
    },

    onrefreshend: function(aSubject, aData) {
        try {
            if (!aData) {
                setTimeout(function() {
                    let str = StringBundle.getString('app.properties', 'repoupdater_err_update_project');
                    Win.alert('lsfbar:repoupdater', str, str);
                }, 1);
            }

            document.getElementById('rep-project-update').firstChild.style.display = 'none';
            this.renderGroup();
            this.renderProject();
        } catch (e) {}
    },

    onlock: function() {
        try {
            Array.prototype.forEach.call(document.getElementsByClassName('concealed'), function(aEl) {
                aEl.disabled = true;
                aEl.classList.add('disabled');
            });
        } catch (e) {}
    },

    onunlock: function() {
        try {
            Array.prototype.forEach.call(document.getElementsByClassName('concealed'), function(aEl) {
                aEl.disabled = false;
                aEl.classList.remove('disabled');
            });
        } catch (e) {}
    },


    onshowgroup: function() {
        Preferences.set(Repoupdater.PREF.PROJ_GROUP, !!this.value);
        optionsRepoupdater.renderProject();
        optionsRepoupdater.openProjectsGroup(optionsRepoupdater.currentGroup);
    }

}, null, 'lsfbar:options');