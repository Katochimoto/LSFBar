"use strict";

Components.utils.import('resource://lsfbar/app.js');
Components.utils.import('resource://lsfbar/Http.js');

var LSFAbout = {
    onOpenDialog: function() {
        var barVersionSpan = document.getElementById('bar-version').lastChild;
        barVersionSpan.textContent = app.version;
    },

    openBarSite: function(aLinkElement) {
        var href = aLinkElement.getAttribute('href');

        Http.openURL(href, 'tab');

        setTimeout(function() {
            document.documentElement.cancelDialog();
        }, 2);

        return false;
    }
};