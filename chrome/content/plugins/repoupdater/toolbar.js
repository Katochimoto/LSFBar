"use strict";

const PALETTE_REPOUPDATER = 'lsfbar-toolbar-repoupdater';

var toolbarRepoupdater = app.plugin({
    _init: function() {
        Palette.onshow(PALETTE_REPOUPDATER, function() {
            try {
                e('lsfbar-toolbar-repoupdater').addEventListener('command', this.onaction, false);
            } catch (e) {}
        }, this);

        Palette.onhide(PALETTE_MANTIS, function() {
            try {
                e('lsfbar-toolbar-repoupdater').removeEventListener('command', this.onaction, false);
            } catch (e) {}
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