"use strict";

let EXPORTED_SYMBOLS = ['StringBundle'];

let bundles = {};

const StringBundle = {

    get stringBundle() {
        delete this.stringBundle;
        return this.stringBundle = Components.classes['@mozilla.org/intl/stringbundle;1']
            .createInstance(Components.interfaces.nsIStringBundleService);
    },

    getStringBundle: function(aLocaleFilePath) {
        if (typeof(bundles[aLocaleFilePath]) == 'undefined') {
            bundles[aLocaleFilePath] = this.stringBundle.createBundle('chrome://lsfbar/locale/' + aLocaleFilePath);
        }

        return bundles[aLocaleFilePath];
    },

    getString: function(aLocaleFilePath, aName) {
        return this.getStringBundle(aLocaleFilePath).GetStringFromName(aName);
    }
};