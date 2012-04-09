"use strict";

const PALETTE_REPOUPDATER = 'lsfbar-toolbar-repoupdater';

var toolbarRepoupdater = app.plugin({
    _init: function() {
        Palette.onshow(PALETTE_REPOUPDATER, function() {
            let el = e('lsfbar-toolbar-repoupdater');
            if (el) {
                el.addEventListener('command', this.onaction, false);
            }
        }, this);

        Palette.onhide(PALETTE_MANTIS, function() {
            let el = e('lsfbar-toolbar-repoupdater');
            if (el) {
                el.removeEventListener('command', this.onaction, false);
            }
        }, this);
    },

    _destroy: function() {
        let win = Win.windowInternal('lsfbar:repoupdater');
        if (win) {
            win.close();
        }
    },

    onaction: function(aEvt) {
        switch (aEvt.target.tagName) {
            case 'toolbarbutton':
                Win.window(
                    null,
                    'chrome://lsfbar/content/plugins/repoupdater/win-repoupdater.xul',
                    'repoupdater',
                    'lsfbar:repoupdater',
                    'chrome,titlebar,toolbar,centerscreen,resizable,dependent'
                );
                break;

            case 'menuitem':
                Http.openURL(aEvt.target.getAttribute('href'), 'new tab');
                break;
        }
    }
});