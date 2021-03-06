"use strict";

let EXPORTED_SYMBOLS = ['Preferences', 'PrefTypes'];

let Cc = Components.classes,
    Ci = Components.interfaces,
    Cr = Components.results;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://lsfbar/JSON.jsm');

const MAX_INT = Math.pow(2, 31) - 1;
const MIN_INT = -MAX_INT;

const PrefTypes = {
    JSON: 0
};

function Preferences(args) {
    if (isObject(args)) {
        if (args.branch) {
            this._prefBranch = args.branch;
        }
        if (args.site) {
            this._site = args.site;
        }
    } else if (args) {
        this._prefBranch = args;
    }
}

Preferences.prototype = {
    get: function(aPrefName, aDefaultValue, aType) {
        if (isArray(aPrefName)) {
            var self = this,
                mapFunc = function(v) {
                    return self.get(v, aDefaultValue);
                };
            return aPrefName.map(mapFunc, this);
        }

        if (this._site)
            return this._siteGet(aPrefName, aDefaultValue, aType);
        else
            return this._get(aPrefName, aDefaultValue, aType);
    },


    _get: function(aPrefName, aDefaultValue, aType) {
        switch (this._prefSvc.getPrefType(aPrefName)) {
            case Ci.nsIPrefBranch.PREF_STRING:
                let data = this._prefSvc.getComplexValue(aPrefName, Ci.nsISupportsString).data;
                switch (aType) {
                    case PrefTypes.JSON:
                        return JSON.parse(data);
                }
                return data;

            case Ci.nsIPrefBranch.PREF_INT:
                return this._prefSvc.getIntPref(aPrefName);

            case Ci.nsIPrefBranch.PREF_BOOL:
                return this._prefSvc.getBoolPref(aPrefName);

            case Ci.nsIPrefBranch.PREF_INVALID:
                return aDefaultValue;

            default:
                throw "Error getting pref " + aPrefName + "; its value's type is " +
                    this._prefSvc.getPrefType(aPrefName) + ", which I don't know " +
                    "how to handle.";
        }
    },

    _siteGet: function(prefName, defaultValue) {
        let value = this._contentPrefSvc.getPref(this._site, this._prefBranch + prefName);
        return typeof value != "undefined" ? value : defaultValue;
    },


   set: function(prefName, prefValue) {
        if (isObject(prefName)) {
            for (let [name, value] in Iterator(prefName)) {
                this.set(name, value);
            }
            
            return;
        }

        if (this._site) {
            this._siteSet(prefName, prefValue);
        } else {
            this._set(prefName, prefValue);
        }
    },

    _set: function(prefName, prefValue) {
        let prefType;
        if (typeof prefValue != "undefined" && prefValue != null)
            prefType = prefValue.constructor.name;

        switch (prefType) {
            case "String":
                {
                    let string = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                    string.data = prefValue;
                    this._prefSvc.setComplexValue(prefName, Ci.nsISupportsString, string);
                }
                break;

            case "Number":
                if (prefValue > MAX_INT || prefValue < MIN_INT)
                    throw("you cannot set the " + prefName + " pref to the number " +
                        prefValue + ", as number pref values must be in the signed " +
                        "32-bit integer range -(2^31-1) to 2^31-1.  To store numbers " +
                        "outside that range, store them as strings.");

                this._prefSvc.setIntPref(prefName, prefValue);
                if (prefValue % 1 != 0)
                    Components.utils.reportError("Warning: setting the " + prefName + " pref to the " +
                    "non-integer number " + prefValue + " converted it " +
                    "to the integer number " + this.get(prefName) +
                    "; to retain fractional precision, store non-integer " +
                    "numbers as strings.");
                break;

            case "Boolean":
                this._prefSvc.setBoolPref(prefName, prefValue);
                break;

            default:
                throw "can't set pref " + prefName + " to value '" + prefValue +
                    "'; it isn't a String, Number, or Boolean";
        }
    },

    _siteSet: function(prefName, prefValue) {
        this._contentPrefSvc.setPref(this._site, this._prefBranch + prefName, prefValue);
    },

    has: function(prefName) {
        if (isArray(prefName))
            return prefName.map(this.has, this);

        if (this._site)
            return this._siteHas(prefName);
        else
            return this._has(prefName);
    },
   
    _has: function(prefName) {
        return (this._prefSvc.getPrefType(prefName) != Ci.nsIPrefBranch.PREF_INVALID);
    },

    _siteHas: function(prefName) {
        return this._contentPrefSvc.hasPref(this._site, this._prefBranch + prefName);
    },
   
    isSet: function(prefName) {
        if (isArray(prefName))
            return prefName.map(this.isSet, this);
        return (this.has(prefName) && this._prefSvc.prefHasUserValue(prefName));
    },

    modified: function(prefName) {
        return this.isSet(prefName)
    },
   
   
    reset: function(prefName) {
        if (isArray(prefName)) {
            var self = this,
                mapFunc = function(v) {
                    return self.reset(v);
                };
            prefName.map(mapFunc, this);
            return;
        }

        if (this._site)
            this._siteReset(prefName);
        else
            this._reset(prefName);
    },


    _reset: function(prefName) {
        try {
            this._prefSvc.clearUserPref(prefName);
        } catch(ex) {
            if (ex.result != Cr.NS_ERROR_UNEXPECTED)
            throw ex;
        }
    },
   
    _siteReset: function(prefName) {
        return this._contentPrefSvc.removePref(this._site, this._prefBranch + prefName);
    },
   
    lock: function(prefName) {
        if (isArray(prefName))
            prefName.map(this.lock, this);
        this._prefSvc.lockPref(prefName);
    },
   
   
    unlock: function(prefName) {
        if (isArray(prefName))
            prefName.map(this.unlock, this);
        this._prefSvc.unlockPref(prefName);
    },
   
    locked: function(prefName) {
        if (isArray(prefName))
            return prefName.map(this.locked, this);
        return this._prefSvc.prefIsLocked(prefName);
    },
   
    observe: function(prefName, callback, thisObject) {
        let fullPrefName = this._prefBranch + (prefName || "");
        let observer = new PrefObserver(fullPrefName, callback, thisObject);
        Preferences._prefSvc.addObserver(fullPrefName, observer, true);
        observers.push(observer);
        return observer;
    },
   
    ignore: function(prefName, callback, thisObject) {
        let fullPrefName = this._prefBranch + (prefName || "");
        let filterFunc = function(v) {
            return v.prefName == fullPrefName && v.callback == callback && v.thisObject == thisObject;
        };
        let [observer] = observers.filter(filterFunc);
        if (observer) {
            Preferences._prefSvc.removeObserver(fullPrefName, observer);
            observers.splice(observers.indexOf(observer), 1);
        }
    },

    allIgnore: function(prefName) {
        var fullPrefName = this._prefBranch + (prefName || "");
        let filterFunc = function(v) {
            return v.prefName == fullPrefName;
        };
        let forEachFunc = function(observer) {
            Preferences._prefSvc.removeObserver(fullPrefName, observer);
            observers.splice(observers.indexOf(observer), 1);
        };
        observers.filter(filterFunc)
                 .forEach(forEachFunc);
    },
    
    clearAll: function() {
        let forEachFunc = function(observer) {
            Preferences._prefSvc.removeObserver(observer.prefName, observer);
        };
        observers.forEach(forEachFunc);
        observers = [];
    },
   
    resetBranch: function(prefBranch) {
        try {
            this._prefSvc.resetBranch(prefBranch);
        } catch(ex) {
            if (ex.result == Cr.NS_ERROR_NOT_IMPLEMENTED)
                this.reset(this._prefSvc.getChildList(prefBranch, []));
            else
                throw ex;
        }
    },
   
    _prefBranch: "",

    site: function(site) {
        if (!(site instanceof Ci.nsIURI))
            site = this._ioSvc.newURI("http://" + site, null, null);
        return new Preferences({ branch: this._prefBranch, site: site });
    },
   
    get _prefSvc() {
        let prefSvc = Cc["@mozilla.org/preferences-service;1"]
            .getService(Ci.nsIPrefService)
            .getBranch(this._prefBranch)
            .QueryInterface(Ci.nsIPrefBranch2);
        let getterFunc = function() {
            return prefSvc;
        };

        this.__defineGetter__("_prefSvc", getterFunc);
        return this._prefSvc;
    },
   
    get _ioSvc() {
        let ioSvc = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        let getterFunc = function() {
            return ioSvc;
        };

        this.__defineGetter__("_ioSvc", getterFunc);
        return this._ioSvc;
    },
   
    get _contentPrefSvc() {
        let contentPrefSvc = Cc["@mozilla.org/content-pref/service;1"]
            .getService(Ci.nsIContentPrefService);

        this.__defineGetter__("_contentPrefSvc", function() contentPrefSvc);
        return this._contentPrefSvc;
    }
};

Preferences.__proto__ = Preferences.prototype;

let observers = [];

function PrefObserver(prefName, callback, thisObject) {
    this.prefName = prefName;
    this.callback = callback;
    this.thisObject = thisObject;
}

PrefObserver.prototype = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

    observe: function(subject, topic, data) {
        if (data != this.prefName)
            return;

        if (typeof this.callback == "function") {
            let prefValue = Preferences.get(this.prefName);
            if (this.thisObject)
                this.callback.call(this.thisObject, prefValue);
            else
                this.callback(prefValue);
        } else
            this.callback.observe(subject, topic, data);
    }
};

function isArray(aObject)
    Object.prototype.toString.call(aObject) === "[object Array]";

function isObject(aObject)
    Object.prototype.toString.call(aObject) === "[object Object]";