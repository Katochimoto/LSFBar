"use strict";

var optionsMantis = app.plugin({
    // текущий набор
    _curTasksStr: '',

    // выполняется при загрузке панели, а не окна
    init: function() {
        let control = e('mantis-reloadinterval-control');
        if (control) {
            control.value = Preferences.get(Mantis.PREF.RELOAD_INTERVAL, 1);
            control.disabled = !Preferences.get(Mantis.PREF.RELOAD, false);
        }

        e('mantis-reload-control').checked = Preferences.get(Mantis.PREF.RELOAD, false);
        e('mantis-tasks-showcount').checked = Preferences.get(Mantis.PREF.SHOW_COUNT, false);
        e('mantis-tasks-show').value = Preferences.get(Mantis.PREF.TASKS_SHOW, 0);

        let box = e('mantis-tasks-box');
        if (box) {
            box.addEventListener('dragover', this.onboxdragover, false);
            box.addEventListener('dragdrop', this.onboxdragdrop, false);
        }

        let current = e('mantis-tasks-current');
        if (current) {
            current.addEventListener('dragover', this.oncurrentdragover, false);
            current.addEventListener('dragdrop', this.oncurrentdragdrop, false);
        }

        e('mantis-tasks-append').addEventListener('command', this.onappend, false);
        e('mantis-tasks-delete').addEventListener('command', this.onremove, false);
        e('mantis-reloadinterval-control').addEventListener('command', this.onchangeinterval, false);
        e('mantis-reload-control').addEventListener('command', this.onchangereload, false);
        e('mantis-tasks-show').addEventListener('command', this.onchangetasksshow, false);
        e('mantis-tasks-showcount').addEventListener('command', this.onchangeshowcount, false);

        Observers.add(Mantis.EV.TASKS_RESET, this.ontasksreset, this);

        this.ontasksreset();
    },

    _destroy: function() {
        let box = e('mantis-tasks-box');
        if (box) {
            box.removeEventListener('dragover', this.onboxdragover, false);
            box.removeEventListener('dragdrop', this.onboxdragdrop, false);
        }

        let current = e('mantis-tasks-current');
        if (current) {
            current.removeEventListener('dragover', this.oncurrentdragover, false);
            current.removeEventListener('dragdrop', this.oncurrentdragdrop, false);
        }

        e('mantis-tasks-append').removeEventListener('command', this.onappend, false);
        e('mantis-tasks-delete').removeEventListener('command', this.onremove, false);
        e('mantis-reloadinterval-control').removeEventListener('command', this.onchangeinterval, false);
        e('mantis-reload-control').removeEventListener('command', this.onchangereload, false);
        e('mantis-tasks-show').removeEventListener('command', this.onchangetasksshow, false);
        e('mantis-tasks-showcount').removeEventListener('command', this.onchangeshowcount, false);

        Observers.remove(Mantis.EV.TASKS_RESET, this.ontasksreset, this);
    },




    _makeEl: function(aEl) {
        let newEl = {};

        if (aEl instanceof XULElement) {

            switch (aEl.nodeName) {
                case 'listitem':
                    newEl['value'] = aEl.getAttribute('value');
                    newEl['label'] = aEl.getAttribute('label');
                    newEl['style'] = aEl.getAttribute('style');
                    break;
                default:
                    return false;
            }

        } else if (typeof aEl == 'object') {

            if (!defined(aEl.nick) || !defined(aEl.name)) {
                return false;
            }

            newEl = {
                value: aEl.nick,
                label: aEl.name,
                style: 'color: ' + (aEl.color || 'inherit')
            };

        } else {
            return false;
        }

        return newEl;
    },


    _appendTask: function(aBox, aEl, aIndex) {
        if (!(aBox instanceof XULElement) || aBox.nodeName != 'listbox') {
            return false;
        }

        let newEl = this._makeEl(aEl);

        if (!newEl) {
            return false;
        }

        aIndex = defined(aIndex) ? aIndex : -1;

        let item = aBox.insertItemAt(aIndex, newEl.label, newEl.value);
        item.setAttribute('style', newEl.style);
        item.setAttribute('ondraggesture', 'nsDragAndDrop.startDrag(event, optionsMantis.dragPalette)');

        return true;
    },


    _fillBaseTasks: function() {
        let tasks = Mantis.notSelectedTasks,
            box = e('mantis-tasks-box');

        if (!tasks) {
            return;
        }

        while (box.itemCount) {
            box.removeItemAt(0);
        }

        for (var nick in tasks) {
            this._appendTask(box, tasks[nick]);
        }
    },


    _fillCustomTasks: function() {
        let tasks = Mantis.selectedTasks,
            current = [],
            box = e('mantis-tasks-current');

        if (!tasks) {
            return;
        }

        while (box.itemCount) {
            box.removeItemAt(0);
        }

        for (var nick in tasks) {
            this._appendTask(box, tasks[nick]);
            current.push(nick);
        }

        this._curTasksStr = current.join(',');
    },


    dropPalette: function(evt, dropdata, session) {
        if (dropdata.data != '') {

            var data = dropdata.data.split(","),
                parent = evt.target.parentNode,
                toPalette,
                toIdx = -1,
                fromPalette = e(data[1]),
                fromIdx = parseInt(data[0]),
                append = false;

            switch (parent.id) {
                case 'mantis-tasks-box':
                    toIdx = parent.getIndexOfItem(evt.target);
                case 'mantis-tasks-box-base':
                    toPalette = e('mantis-tasks-box');
                    break;

                case 'mantis-tasks-current':
                    toIdx = parent.getIndexOfItem(evt.target);
                case 'mantis-tasks-current-base':
                    toPalette = e('mantis-tasks-current');
                    append = true;
                    break;
            }

            if (toPalette && fromPalette) {
                var item = fromPalette.getItemAtIndex(fromIdx),
                    value = item.value;

                if (append) {
                    fromPalette.removeItemAt(fromIdx);
                    this._appendTask(toPalette, item, toIdx);
                } else {
                    fromPalette.removeItemAt(fromIdx);
                    this._appendTask(toPalette, item, toIdx);
                }

                this.rebuild();
            }
        }
    },


    dragPalette: {
        onDragStart: function(evt, transferData, action) {
            var data = "";
            try {
                data = String(evt.target.parentNode.selectedIndex + ',' + evt.target.parentNode.getAttribute('id'));
            } catch(ex) {}
            transferData.data = new TransferData();
            transferData.data.addDataForFlavour('text/unicode', data);
        },

        getSupportedFlavours: function() {
            var flavours = new FlavourSet();
            flavours.appendFlavour('text/unicode');
            return flavours;
        },

        onDragOver: function(evt, flavour, session) {},

        onDrop: function(evt, dropdata, session) {
            optionsMantis.dropPalette(evt, dropdata, session);
        }
    },

    rebuild: function() {
        var tasks = [],
            current = e('mantis-tasks-current');

        for (var i = 0, l = current.itemCount; i < l; i++) {
            tasks.push(current.getItemAtIndex(i).getAttribute('value'));
        }

        var setTasks = tasks.join(',');

        if (this._curTasksStr != setTasks) {
            this._curTasksStr = setTasks;
            Preferences.set(Mantis.PREF.DEFAULT_STATUS, setTasks);
        }

        return true;
    },






    onappend: function() {
        let base = e('mantis-tasks-box'),
            current = e('mantis-tasks-current'),
            item = base.selectedItem;

        if (item instanceof XULElement) {
            optionsMantis._appendTask(current, item);
            base.removeItemAt(base.getIndexOfItem(item));
            optionsMantis.rebuild();
        }
    },

    onremove: function() {
        var base = e('mantis-tasks-box'),
            current = e('mantis-tasks-current'),
            item = current.selectedItem;

        if (item instanceof XULElement) {
            optionsMantis._appendTask(base, item);
            current.removeItemAt(current.getIndexOfItem(item));
            optionsMantis.rebuild();
        }
    },

    // интервал обновления
    onchangeinterval: function(aEvent) {
        Preferences.set(Mantis.PREF.RELOAD_INTERVAL, parseInt(aEvent.target.value));
    },

    // обновление списка задач
    onchangereload: function(aEvent) {
        Preferences.set(Mantis.PREF.RELOAD, aEvent.target.checked);
        e('mantis-reloadinterval-control').disabled = !aEvent.target.checked;
    },

    // изменение способа вывода
    onchangetasksshow: function() {
        Preferences.set(Mantis.PREF.TASKS_SHOW, Number(this.value));
    },

    // показывать количество задач
    onchangeshowcount: function(aEvent) {
        Preferences.set(Mantis.PREF.SHOW_COUNT, aEvent.target.checked);
    },

    ontasksreset: function() {
        optionsMantis._fillBaseTasks();
        optionsMantis._fillCustomTasks();
    },

    onboxdragover: function(aEvt) {
        nsDragAndDrop.dragOver(aEvt, optionsMantis.dragPalette);
    },

    onboxdragdrop: function(aEvt) {
        nsDragAndDrop.drop(aEvt, optionsMantis.dragPalette);
    },

    oncurrentdragover: function(aEvt) {
        nsDragAndDrop.dragOver(aEvt, optionsMantis.dragPalette);
    },

    oncurrentdragdrop: function(aEvt) {
        nsDragAndDrop.drop(aEvt, optionsMantis.dragPalette);
    }

}, null, 'lsfbar:options');