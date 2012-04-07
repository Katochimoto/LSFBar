"use strict";

const PALETTE_MENU = 'lsfbar-toolbar-menu';

var toolbarMenu = app.plugin({
    _init: function() {
        this.option('menu', 'lightsoft/menu.xml');
        this.option('default', 'chrome://lsfbar/content/plugins/menu/default.xml');
        this.option('transform', 'chrome://lsfbar/content/plugins/menu/transform.xsl');

        Palette.onshow(PALETTE_MENU, function() {
            let menu = document.getElementsByClassName('lsfbar-toolbar-menu')[0];
            if (menu) {
                menu.addEventListener('command', this.onclick, false);
                let popup = menu.getElementsByClassName('lsfbar-toolbar-menu-popup')[0]
                if (popup) {
                    popup.addEventListener('popupshown', this.onrebuid, false);
                }
            }
        }, this);

        Palette.onhide(PALETTE_MENU, function() {
            let menu = document.getElementsByClassName('lsfbar-toolbar-menu')[0];
            if (menu) {
                menu.removeEventListener('command', this.onclick, false);
                let popup = menu.getElementsByClassName('lsfbar-toolbar-menu-popup')[0]
                if (popup) {
                    popup.removeEventListener('popupshown', this.onrebuid, false);
                }
            }
        }, this);
    },

    get items() {
        var fileXML = FileIO.open(this.option('menu'), 'ProfD'),
            fileXSL = FileIO.open(this.option('transform')),
            cacheDoc = document.implementation.createDocument('', 'toolbar-menu', null),
            xmlDocument,
            xslDocument,
            xulNode;

        if (fileXSL.exists() && fileXSL.isFile() && fileXSL.isReadable()) {
            xslDocument = FileIO.read(fileXSL);

            if (fileXML.exists() && fileXML.isFile() && fileXML.isReadable() && fileXML.isWritable()) {
                xmlDocument = FileIO.read(fileXML);

            } else {
                fileXML = FileIO.open(this.option('default'));
                if (fileXML.exists() && fileXML.isFile() && fileXML.isReadable()) {
                    xmlDocument = FileIO.read(fileXML);
                }
            }
        }

        if (typeof xmlDocument != 'undefined'
            && typeof xslDocument != 'undefined'
            && xmlDocument != null
            && xslDocument != null) {

            xmlDocument = Dom.parseFromString(xmlDocument);
            xslDocument = Dom.parseFromString(xslDocument);

            // проверка даты и запуск онлайн обновления меню

            xulNode = Dom.xml2xul(Dom.xsltTransformToDocument(xmlDocument, xslDocument), cacheDoc, true);
        }

        return xulNode;
    },

    onclick: function(aEvt) {
        if (aEvt.originalTarget.localName == 'toolbarbutton') {
            Http.openURL(aEvt.target.getAttribute('href'), aEvt);
            aEvt.stopPropagation();
            return false;

        } else {
            Http.openURL(aEvt.originalTarget.getAttribute('href'), aEvt);
        }
    },

    onrebuid: function(aEvt) {
        let menu = toolbarMenu.items;
        if (menu instanceof XULElement) {
            let parent = aEvt.target.parentNode;

            while (parent.hasChildNodes()) {
                parent.removeChild(parent.firstChild);
            }

            parent.appendChild(menu);
            parent.firstElementChild.openPopup(parent, 'after_start', 0, 0, false, false);
        }
    }
});