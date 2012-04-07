"use strict";

Components.utils.import('resource://lsfbar/Sqlite.js');
Components.utils.import('resource://lsfbar/Win.js');
Components.utils.import('resource://lsfbar/StringBundle.js');

var tblGroups = new tblLSFBarRepGroups();

function onLoad() {
    if (!defined(window.arguments[0].inn)) {return;}
    if (!defined(window.arguments[0].inn.id)) {return;}

    let groupId = parseInt(window.arguments[0].inn.id);
    if (groupId > 0) {
        let group = tblGroups.createSelect()
            .where('self.id', groupId)
            .execute()
            .fetchRow();

        if (group) {
            e('groupId').value = group.id;
            e('name').value = group.name;
        }
    }
}

function onOK() {
    let name = e('name').value,
        groupId = parseInt(e('groupId').value);

    
    if (!name.length) {
        Win.alert(
            'lsfbar:repoupdatersettingsgroupedit',
            StringBundle.getString('app.properties', 'repoupdater_title_group_edit'),
            StringBundle.getString('app.properties', 'err_name_exists')
        );
        return false;
    }
    
    let group = tblGroups.createSelect()
        .where(SQLiteFn.expr('UPPER(self.name) = ' + SQLiteFn.makeSqlValue(name.toUpperCase())))
        .execute()
        .fetchRow();
    
    if (group) {
        if ((groupId > 0 && groupId != parseInt(group.id)) || groupId == 0) {
            Win.alert(
                'lsfbar:repoupdatersettingsgroupedit',
                StringBundle.getString('app.properties', 'repoupdater_title_group_edit'),
                StringBundle.getString('app.properties', 'err_name_notempty')
            );
            return false;
        }
    }
    
    if (groupId > 0) {
        if (tblGroups.update({'name': name}, [{id: groupId}])) {
            
            window.arguments[0].out = {
                ok: true,
                groupId: groupId
            };
            return true;
                
        } else {
            Win.alert(
                'lsfbar:repoupdatersettingsgroupedit',
                StringBundle.getString('app.properties', 'repoupdater_title_group_edit'),
                StringBundle.getString('app.properties', 'err_group_update')
            );
        }
            
    } else {
        groupId = tblGroups.insert({'name': name});
        if (groupId) {
            window.arguments[0].out = {
                ok: true,
                groupId: groupId
            };
            return true;
                
        } else {
            Win.alert(
                'lsfbar:repoupdatersettingsgroupedit',
                StringBundle.getString('app.properties', 'repoupdater_title_group_edit'),
                StringBundle.getString('app.properties', 'err_group_insert')
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