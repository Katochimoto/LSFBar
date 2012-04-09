"use strict";

const PALETTE_MANTIS = 'lsfbar-toolbar-mantis';

var toolbarMantis = app.plugin({
    _init: function() {
        Palette.onshow(PALETTE_MANTIS, function() {
            Observers.notify(Mantis.EV.CHECK_START);

            let grouptasks = e('lsfbar-mantis-grouptasks');
            if (grouptasks) {
                grouptasks.addEventListener('command', this.ongototasks, false);
            }

            let tasksbox = e('lsfbar-mantis-tasksbox');
            if (tasksbox) {
                tasksbox.addEventListener('command', this.ongototasks, false);
            }

            let m = document.getElementsByTagName('mantis')[0];
            if (m) {
                Observers.add(Mantis.EV.TASKS_RESET, this.ontasksreset, m);
                Preferences.observe(Mantis.PREF.DEFAULT_STATUS, this.onchangedefaultstatus, m);
                Preferences.observe(Mantis.PREF.TASKS_SHOW, this.onchangetasksshow, m);
                Preferences.observe(Mantis.PREF.SHOW_COUNT, this.onchangeshowcount, m);
            }
        }, this);

        Palette.onhide(PALETTE_MANTIS, function() {
            Observers.notify(Mantis.EV.CHECK_STOP);

            let grouptasks = e('lsfbar-mantis-grouptasks');
            if (grouptasks) {
                grouptasks.removeEventListener('command', this.ongototasks, false);
            }

            let tasksbox = e('lsfbar-mantis-tasksbox');
            if (tasksbox) {
                tasksbox.removeEventListener('command', this.ongototasks, false);
            }

            let m = document.getElementsByTagName('mantis')[0];
            if (m) {
                Observers.remove(Mantis.EV.TASKS_RESET, this.ontasksreset, m);
                Preferences.ignore(Mantis.PREF.DEFAULT_STATUS, this.onchangedefaultstatus, m);
                Preferences.ignore(Mantis.PREF.TASKS_SHOW, this.onchangetasksshow, m);
                Preferences.ignore(Mantis.PREF.SHOW_COUNT, this.onchangeshowcount, m);
            }
        }, this);
    },

    ongototasks: function(aEvt) {
        if (aEvt.originalTarget.localName == 'toolbarbutton') {
            Http.openURL(aEvt.target.getAttribute('href'), aEvt);
            aEvt.stopPropagation();
            return false;

        } else {
            Http.openURL(aEvt.originalTarget.getAttribute('href'), aEvt);
        }
    },

    ontasksreset: function() {
        this.rebuildTasksPopup(Mantis.tasks);
        this.rebuildTasksBox(Mantis.selectedTasks);
    },

    onchangedefaultstatus: function() {
        this.rebuildTasksBox(Mantis.selectedTasks);
    },

    onchangetasksshow: function() {
        this.rebuildTasksBox(Mantis.selectedTasks);
    },

    onchangeshowcount: function() {
        this.rebuildTasksBox(Mantis.selectedTasks);
    }
});