"use strict";

var toolsRepoupdater =  app.plugin({
    _init: function() {
        Palette.onshow(PALETTE_TOOLS, function() {
            e('lsfbar-toolbar-tools-repoupdater').addEventListener('command', this.onaction, false);
        }, this);

        Palette.onhide(PALETTE_TOOLS, function() {
            e('lsfbar-toolbar-tools-repoupdater').removeEventListener('command', this.onaction, false);
        }, this);
    },

    onaction: function() {
        Win.window(
            null,
            'chrome://lsfbar/content/plugins/repoupdater/win-repoupdater.xul',
            'repoupdater',
            'lsfbar:repoupdater',
            'chrome,titlebar,toolbar,centerscreen,resizable,dependent'
        );
    }
});