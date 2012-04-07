"use strict";

Components.utils.import('resource://lsfbar/Sqlite.js');
Components.utils.import('resource://lsfbar/app.js');

const kXULNS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

var winConfirm = app.plugin({
    _init: function() {
        let inn = window.arguments[0].inn,
            queue = inn.queue,
            listProj = document.getElementById('confirm-proj'),
            listDisProj = document.getElementById('confirm-proj-dis'),
            servers = [],
            projects = [];

        for (var i in queue) {
            servers.push(queue[i].data.server);
            projects.push(queue[i].data.project);
        }

        document.getElementById('confirm-text').textContent = inn.text;

        projects = (new tblLSFBarRepProjects()).createSelect()
            .where('id', projects)
            .execute()
            .fetchAllAssoc('id');

        servers = (new tblLSFBarRepServers()).createSelect()
            .where('id', servers)
            .execute()
            .fetchAllAssoc('id');

        for (let i in queue) {
            let q = queue[i],
                row = document.createElementNS(kXULNS, 'listitem'),
                cell = document.createElementNS(kXULNS, 'listcell');

            cell.setAttribute('label', defined(projects[q.data.project]) ? projects[q.data.project].name : '--');
            row.appendChild(cell);

            cell = document.createElementNS(kXULNS, 'listcell');
            cell.setAttribute('label', defined(servers[q.data.server]) ? servers[q.data.server].name : '--');
            row.appendChild(cell);

            (q.confirm ? listProj : listDisProj).appendChild(row);
        }

        if (listDisProj.rows > 0) {
            document.getElementById('confirm-proj-dis-box').collapsed = false;
        }
    },

    _destroy: function() {

    },

    accept: function() {
        window.arguments[0].out = {ok: true};
        return true;
    }

}, null, 'lsfbar:repoupdaterconfirm');

function defined(aVal) {
    return (typeof aVal != 'undefined' && aVal != null);
}