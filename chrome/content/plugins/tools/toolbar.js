"use strict";

const PALETTE_TOOLS = 'lsfbar-toolbar-tools';

app.plugin({
    _init: function() {
        Palette.onshow(PALETTE_TOOLS, function() {
            let options = document.getElementsByClassName('lsfbar-toolbar-tools-options')[0];
            if (options) {
                options.addEventListener('command', this.openOptions, false);
            }
        }, this);

        Palette.onhide(PALETTE_TOOLS, function() {
            let options = document.getElementsByClassName('lsfbar-toolbar-tools-options')[0];
            if (options) {
                options.removeEventListener('command', this.openOptions, false);
            }
        }, this);
    },

    openOptions: function() {
        return Win.dialog(
            null,
            app.addon.optionsURL,
            'options',
            'lsfbar:options',
            'chrome,titlebar,toolbar,centerscreen,modal'
        );
    }
});