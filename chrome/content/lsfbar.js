"use strict";

Components.utils.import('resource://lsfbar/JSON.jsm');
Components.utils.import('resource://lsfbar/Observers.js');
Components.utils.import('resource://lsfbar/Preferences.js');
Components.utils.import('resource://lsfbar/StringBundle.js');
Components.utils.import('resource://lsfbar/Win.js');
Components.utils.import('resource://lsfbar/Palette.js');
Components.utils.import('resource://lsfbar/Http.js');
Components.utils.import('resource://lsfbar/Dom.js');
Components.utils.import('resource://lsfbar/IO.js');
Components.utils.import('resource://lsfbar/Console.js');

Components.utils.import('resource://lsfbar/app.js');

Components.utils.import('resource://lsfbar/plugins/Debug.js');
Components.utils.import("resource://lsfbar/plugins/Mantis.js");
Components.utils.import("resource://lsfbar/plugins/Repoupdater.js");

function defined(aVal) {
    return (typeof aVal != 'undefined' && aVal != null);
}

function e(aId) {
    return document.getElementById(aId);
}