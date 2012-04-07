"use strict";

var optionsToolbarset = app.plugin({

    // текущий набор палитры
    _curPaletteStr: '',

    get mainWindow() {
        delete this.mainWindow;
        return this.mainWindow = Win.windowInternal();
    },

    get constPalette() {
        delete this.constPalette;

        return this.constPalette = {
            separator: {
                value: 'separator',
                label: StringBundle.getString('app.properties', 'separator_label'),
                image: 'chrome://lsfbar/skin/images/separator-24x24.png'
            },
            spacer: {
                value: 'spacer',
                label: StringBundle.getString('app.properties', 'spacer_label'),
                image: 'chrome://lsfbar/skin/images/spacer-24x24.png'
            },
            spring: {
                value: 'spring',
                label: StringBundle.getString('app.properties', 'spring_label'),
                image: 'chrome://lsfbar/skin/images/spring-24x24.png'
            }
        };
    },

    get toolbar() {
        return this.mainWindow.document.getElementById('lsfbar-toolbar');
    },
    
    
    // выполняется при загрузке панели, а не окна
    init: function() {
        let box = e('toolbarset-palette-box');
        box.addEventListener('dragover', this.onboxdragover, false);
        box.addEventListener('dragdrop', this.onboxdragdrop, false);

        let current = e('toolbarset-palette-current');
        current.addEventListener('dragover', this.oncurrentdragover, false);
        current.addEventListener('dragdrop', this.oncurrentdragdrop, false);

        e('toolbarset-palette-append').addEventListener('command', this.onappend, false);
        e('toolbarset-palette-delete').addEventListener('command', this.onremove, false);

        this.fillBasePalette();
        this.fillCustomPalette();
    },

    _destroy: function() {
        let box = e('toolbarset-palette-box');
        box.removeEventListener('dragover', this.onboxdragover, false);
        box.removeEventListener('dragdrop', this.onboxdragdrop, false);

        let current = e('toolbarset-palette-current');
        current.removeEventListener('dragover', this.oncurrentdragover, false);
        current.removeEventListener('dragdrop', this.oncurrentdragdrop, false);

        e('toolbarset-palette-append').removeEventListener('command', this.onappend, false);
        e('toolbarset-palette-delete').removeEventListener('command', this.onremove, false);
    },



    makeEl: function(aEl) {
        var newEl = {};

        if (aEl instanceof XULElement) {

            switch (aEl.nodeName) {
                case 'toolbarbutton':
                case 'toolbaritem':
                    var elValue = aEl.getAttribute('id');
                    if (!elValue) {
                        return false;
                    }

                    newEl['value'] = elValue;
                    newEl['label'] = aEl.getAttribute('label') || StringBundle.getString('app.properties', 'undefined_label');
                    newEl['image'] = aEl.getAttribute('toolbarsetimg') || 'chrome://lsfbar/skin/images/no-24x24.png';
                    break;

                case 'listitem':
                    var elValue = aEl.getAttribute('value');
                    if (!elValue) {
                        return false;
                    }

                    newEl['value'] = elValue;
                    newEl['label'] = aEl.getAttribute('label') || StringBundle.getString('app.properties', 'undefined_label');
                    newEl['image'] = aEl.getAttribute('image') || 'chrome://lsfbar/skin/images/no-24x24.png';
                    break;

                default:
                    return false;
            }

        } else if (aEl instanceof Object) {

            if (!defined(aEl.value) || !defined(aEl.label) || !defined(aEl.image)) {
                return false;
            }

            newEl = aEl;

        } else {
            return false;
        }

        return newEl;
    },


    appendPalete: function(aBox, aEl, aIndex) {
        if (!(aBox instanceof XULElement) || aBox.nodeName != 'listbox') {
            return false;
        }

        let newEl = this.makeEl(aEl);

        if (!newEl) {
            return false;
        }

        aIndex = defined(aIndex) ? aIndex : -1;

        let item = aBox.insertItemAt(aIndex, newEl.label, newEl.value);
        item.setAttribute('class', 'listitem-iconic');
        item.setAttribute('image', newEl.image);
        item.setAttribute('ondraggesture', 'nsDragAndDrop.startDrag(event, optionsToolbarset.dragPalette)');

        return true;
    },

    fillBasePalette: function() {
        let base = e('toolbarset-palette-box'),
            palette = this.mainWindow.gNavToolbox.palette,
            lsreg = new RegExp('^lsfbar\-');

        for (let i = 0, l = palette.childNodes.length; i < l; ++i) {
            let child = palette.childNodes[i];
            if (lsreg.test(child.id)) {
                this.appendPalete(base, child);
            }
        }

        for (let i in this.constPalette) {
            this.appendPalete(base, this.constPalette[i]);
        }
    },

    fillCustomPalette: function() {
        let currentSet = this.toolbar.getAttribute('currentset') || this.toolbar.currentSet,
            current = e('toolbarset-palette-current');

        if (currentSet == '__empty') {
            return false;
        }

        this._curPaletteStr = currentSet;

        currentSet.split(',').forEach(function(id) {
            if (this.isConst(id)) {
                this.appendPalete(current, this.constPalette[id]);

            } else {
                let paletteEl = this.mainWindow.document.getElementById(id);
                if (paletteEl) {
                    this.appendPalete(current, paletteEl);
                }
            }
        }, this);
    },

    isConst: function(aValue) {
        return defined(this.constPalette[aValue]);
    },

    rebuild: function() {
        let palette = [],
            toolbar = this.toolbar,
            current = e('toolbarset-palette-current');

        if (!toolbar) {
            return false;
        }

        for (var i = 0, l = current.itemCount; i < l; i++) {
            palette.push(current.getItemAtIndex(i).getAttribute('value'));
        }

        let setPalette = palette.join(',');

        if (this._curPaletteStr != setPalette) {
            this._curPaletteStr = setPalette;
            Palette.bind('hide');

            setTimeout(function(){
                toolbar.setAttribute('currentset', setPalette);
                toolbar.currentSet = setPalette;
                optionsToolbarset.mainWindow.document.persist('lsfbar-toolbar', 'currentset');

                try {
                    BrowserToolboxCustomizeDone(true);
                } catch (e) {}

                optionsToolbarset.mainWindow.lsfbar.palette.current = palette;
                Palette.bind('show');
            }, 0);
        }

        return true;
    },
    
    
    



    onboxdragover: function(aEvt) {
        nsDragAndDrop.dragOver(aEvt, optionsToolbarset.dragPalette);
    },

    onboxdragdrop: function(aEvt) {
        nsDragAndDrop.drop(aEvt, optionsToolbarset.dragPalette);
    },

    oncurrentdragover: function(aEvt) {
        nsDragAndDrop.dragOver(aEvt, optionsToolbarset.dragPalette);
    },

    oncurrentdragdrop: function(aEvt) {
        nsDragAndDrop.drop(aEvt, optionsToolbarset.dragPalette)
    },

    onappend: function() {
        let base = e('toolbarset-palette-box'),
            current = e('toolbarset-palette-current'),
            item = base.selectedItem;

        if (item instanceof XULElement) {
            optionsToolbarset.appendPalete(current, item);

            if (!optionsToolbarset.isConst(item.value)) {
                base.removeItemAt(base.getIndexOfItem(item));
            }

            optionsToolbarset.rebuild();
        }
    },

    onremove: function() {
        let base = e('toolbarset-palette-box'),
            current = e('toolbarset-palette-current'),
            item = current.selectedItem;

        if (item instanceof XULElement) {
            if (!optionsToolbarset.isConst(item.value)) {
                optionsToolbarset.appendPalete(base, item);
            }

            current.removeItemAt(current.getIndexOfItem(item));

            optionsToolbarset.rebuild();
        }
    },



    dropPalette: function(evt, dropdata, session) {
        if (dropdata.data != '') {

            let data = dropdata.data.split(','),
                parent = evt.target.parentNode,
                toPalette,
                toIdx = -1,
                fromPalette = e(data[1]),
                fromIdx = parseInt(data[0]),
                append = false;

            switch (parent.id) {
                case 'toolbarset-palette-box':
                    toIdx = parent.getIndexOfItem(evt.target);
                    
                case 'toolbarset-palette-box-base':
                    toPalette = e('toolbarset-palette-box');
                    break;

                case 'toolbarset-palette-current':
                    toIdx = parent.getIndexOfItem(evt.target);
                    
                case 'toolbarset-palette-current-base':
                    toPalette = e('toolbarset-palette-current');
                    append = true;
                    break;
            }

            if (toPalette && fromPalette) {
                let item = fromPalette.getItemAtIndex(fromIdx),
                    value = item.value,
                    constEl = this.isConst(value);

                if (append) {
                    if (!constEl || (constEl && fromPalette.id == toPalette.id)) {
                        fromPalette.removeItemAt(fromIdx);
                    }

                    this.appendPalete(toPalette, item, toIdx);
                } else {
                    fromPalette.removeItemAt(fromIdx);

                    if (!constEl || (constEl && fromPalette.id == toPalette.id)) {
                        this.appendPalete(toPalette, item, toIdx);
                    }
                }

                this.rebuild();
            }
        }
    },


    dragPalette: {
        onDragStart: function(evt, transferData, action) {
            let data = '';
            try {
                data = String(evt.target.parentNode.selectedIndex + ',' + evt.target.parentNode.getAttribute('id'));
            } catch(ex) {}
            transferData.data = new TransferData();
            transferData.data.addDataForFlavour('text/unicode', data);
        },

        getSupportedFlavours: function() {
            let flavours = new FlavourSet();
            flavours.appendFlavour('text/unicode');
            return flavours;
        },

        onDragOver: function(evt, flavour, session) {},

        onDrop: function(evt, dropdata, session) {
            optionsToolbarset.dropPalette(evt, dropdata, session);
        }
    }

}, null, 'lsfbar:options');