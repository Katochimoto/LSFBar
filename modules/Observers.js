"use strict";

let EXPORTED_SYMBOLS = ['Observers'];

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://lsfbar/JSON.jsm');

let cache = [];

let Observers = {

    get _service() {
        delete this._service;
        return this._service = Components.classes['@mozilla.org/observer-service;1']
            .getService(Components.interfaces.nsIObserverService);
    },

    add: function(aTopic, aCallback, aThisObject) {
        let observer = new Observer(aTopic, aCallback, aThisObject);
        this._service.addObserver(observer, aTopic, true);
        cache.push(observer);
        return observer;
    },

    remove: function(aTopic, aCallback, aThisObject) {
        let filterFunc = function(v) {
            return v.topic == aTopic && v.callback == aCallback && v.thisObject == aThisObject;
        };
        let [observer] = cache.filter(filterFunc);
        if (observer) {
            this._service.removeObserver(observer, aTopic);
            cache.splice(cache.indexOf(observer), 1);
        }
    },

    clear: function(aTopic) {
        let filterFunc = function(v) {
            return v.topic == aTopic;
        };
        let forEachFunc = function(observer) {
            Observers._service.removeObserver(observer, aTopic);
            cache.splice(cache.indexOf(observer), 1);
        };
        cache.filter(filterFunc)
             .forEach(forEachFunc);
    },

    clearAll: function() {
        let forEachFunc = function(observer) {
            Observers._service.removeObserver(observer, observer.topic);
        };
        cache.forEach(forEachFunc);
        cache = [];
    },

    notify: function(aTopic, aSubject, aData) {
        let subject = defined(aSubject) ? new Subject(aSubject) : null,
            data = defined(aData) ? JSON.stringify(aData) : null;
        this._service.notifyObservers(subject, aTopic, data);
    }
};

function Observer(aTopic, aCallback, aThisObject) {
    this.topic = aTopic;
    this.callback = aCallback;
    this.thisObject = aThisObject;
}

Observer.prototype = {
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver, Components.interfaces.nsISupportsWeakReference]),
    observe: function(aSubject, aTopic, aData) {
        if (aSubject
            && typeof aSubject == 'object'
            && ('wrappedJSObject' in aSubject)
            && ('observersModuleSubjectWrapper' in aSubject.wrappedJSObject)) {
            
            aSubject = aSubject.wrappedJSObject.object;
        }

        aData = defined(aData) ? JSON.parse(aData) : null;

        if (typeof this.callback == 'function') {
            if (this.thisObject) {
                this.callback.call(this.thisObject, aSubject, aData);
            } else {
                this.callback(aSubject, aData);
            }

        } else {
            this.callback.observe(aSubject, aTopic, aData);
        }
    }
};

function Subject(object) {
    this.wrappedJSObject = {
        observersModuleSubjectWrapper: true,
        object: object
    };
}

Subject.prototype = {
    QueryInterface: XPCOMUtils.generateQI([]),
    getHelperForLanguage: function(){},
    getInterfaces: function(){}
};

function defined(val) {
    return (typeof val != 'undefined' && val != null);
}