"use strict";

let EXPORTED_SYMBOLS = ['app'];

Components.utils.import('resource://gre/modules/AddonManager.jsm');
Components.utils.import('resource://lsfbar/Observers.js');
Components.utils.import('resource://lsfbar/Preferences.js');
Components.utils.import('resource://lsfbar/Win.js');

Win.onload('navigator:browser', init);
Win.onunload('navigator:browser', destroy);

Object.prototype.extend = function(object) {
    var property, getter, setter, target;
    for (property in object) {
        getter = object.__lookupGetter__(property);
        setter = object.__lookupSetter__(property);
        target = object.hasOwnProperty(property) ? this : this.__proto__;
        if (getter) {
            target.__defineGetter__(property, getter);
        } else if (setter) {
            target.__defineSetter__(property, setter);
        } else {
            target[property] = object[property];
        }
    }
};

Object.prototype.clone = function() {
    var p = Object.getPrototypeOf(this);
    return Object.create(p);
};

Object.prototype.copy = function() {
    return eval(uneval(this));
};

let addon = null,
    Plugin = function() {};

Plugin.prototype = {
    options: {},
    option: function(aKey, aValue) {
        return ((typeof aValue == 'undefined') ?
            this.options[aKey] :
            (this.options[aKey] = aValue));
    }
};

const app = {
    get id() {
        return 'lsfbar@lightsoft.ru';
    },

    get addon() {
        return addon;
    },

    get version() {
        return this.addon.version;
    },

    get os() {
        delete this.os;
        return this.os = Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULRuntime).OS;
    },

    get isWin() {
        return (this.os == 'WINNT');
    },

    get dirsep() {
        return (this.isWin ? "\\" : "/");
    },

    plugin: function(aProto, aParent, aWinType) {
        let plugin = function() {
                this.options = {};
            },
            _init = null,
            _destroy = null;

        plugin.prototype = Object.create(new Plugin());
        plugin.prototype.extend(aParent || {});

        if ('_destroy' in aProto) {
            _destroy = aProto['_destroy'];
            delete aProto['_destroy'];
        }

        if ('_init' in aProto) {
            _init = aProto['_init'];
            delete aProto['_init'];
        }

        plugin = new plugin();
        plugin.extend(aProto);

        if (typeof _init == 'function') {
            Win.onload(aWinType, _init, plugin);
        }

        if (typeof _destroy == 'function') {
            Win.onunload(aWinType, _destroy, plugin);
        }

        return plugin;
    }
};










function init() {
    function initAddon(aAddon) {

        if (aAddon.version != Preferences.get('lsfbar.version', '')) {
            Preferences.set('lsfbar.version', aAddon.version);

            Components.utils.import('resource://lsfbar/Sqlite.js');
            (new tblLSFBarRepGroups()).tableCreate();
            (new tblLSFBarRepGroupsRel()).tableCreate();
            (new tblLSFBarRepProjects()).tableCreate();
            (new tblLSFBarRepRelations()).tableCreate();
            (new tblLSFBarRepServers()).tableCreate();
        }

        addon = aAddon;

        Observers.notify('app-init');
    }
    /*
     function firstRun(extensions) {
     var extension = extensions.get(app.id);
     if (extension.firstRun) {

     }
     }

     if (Application.extensions) {
     firstRun(extensions);
     } else {
     Application.getExtensions(firstRun);
     }
     */

    AddonManager.getAddonByID(app.id, initAddon);
}

function destroy() {
    Observers.notify('app-destroy');
    Observers.clearAll();
    Preferences.clearAll();
}