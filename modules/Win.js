"use strict";

let EXPORTED_SYMBOLS = ['Win'];

let Ci = Components.interfaces,
    Cc = Components.classes,
    Cu = Components.utils;

Cu.import('resource://lsfbar/Observers.js');
Cu.import('resource://lsfbar/Console.js');

const Win = {
    get windowMediator() {
        delete this.windowMediator;
        return this.windowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
    },

    get promptService() {
        delete this.promptService;
        return this.promptService = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService);
    },

    /**
     * @return nsIDOMWindowInternal
     */
    windowInternal: function(aType) {
        aType = aType || 'navigator:browser';
        let win = this.windowMediator.getMostRecentWindow(aType);
        windowInit(win);
        return win;
    },

    onload: function(aType, aCallback, aThisObj) {
        let win = this.windowInternal(aType);
        aThisObj = aThisObj || null;

        if (win.lsfbar.loaded) {
            try {
                aCallback.call(aThisObj, win);
            } catch (e) {
                Components.utils.reportError(e);
            }

        } else {
            win.lsfbar.onload.push([aCallback, aThisObj]);
        }
    },

    onunload: function(aType, aCallback, aThisObj) {
        let win = this.windowInternal(aType);
        aThisObj = aThisObj || null;

        win.lsfbar.onunload.push([aCallback, aThisObj]);
    },

    /**
     * Диалоговое окно
     *
     * @param string aParent тип окна предка
     * @param string aXul путь к xul окна
     * @param string aName название окна
     * @param string aType тип окна
     * @param string aFeatures параметры открытия
     * @param object aParams переменные, передаваемые и возвращаемые окном ({inn: {...}, out: {...}})
     */
    dialog: function(aParent, aXul, aName, aType, aFeatures, aParams) {
        let win = null;

        if (aType) {
            win = this.windowInternal(aType);
        }

        if (!win) {
            let parent = this.windowInternal(aParent);
            parent.setTimeout(function() {
                windowInit(win);
            }, 50);
            win = parent.openDialog(aXul, aName, aFeatures, aParams);
        }

        win.focus();
        return win;
    },

    /**
     * Окно
     *
     * @param string aParent тип окна предка
     * @param string aXul путь к xul окна
     * @param string aName название окна
     * @param string aType тип окна
     * @param string aFeatures параметры открытия
     * @param object aParams переменные, передаваемые и возвращаемые окном ({inn: {...}, out: {...}})
     */
    window: function(aParent, aXul, aName, aType, aFeatures) {
        let win = null;

        if (aType) {
            win = this.windowInternal(aType);
        }

        if (!win) {
            let parent = this.windowInternal(aParent);
            parent.setTimeout(function() {
                windowInit(win);
            }, 50);
            win = parent.open(aXul, aName, aFeatures);
        }

        win.focus();
        return win;
    },

    /**
     * Ввод значения
     *
     * @param string aParent тип окна предка
     * @param string aDialogTitle заголовок
     * @param string aText текст для строки ввода
     * @param string aValue значение ввода {value: ""}
     * @param string aCheckMsg текст для чекбокса, если null, то не выведет
     * @param boolean aCheckState значение чекбокса {value: false}
     */
    prompt: function(aParent, aDialogTitle, aText, aValue, aCheckMsg, aCheckState) {
        aValue = aValue || {value: ""};
        aCheckState = aCheckState || {value: false};

        return this.promptService.prompt(
            this.windowInternal(aParent),
            aDialogTitle,
            aText,
            aValue,
            aCheckMsg,
            aCheckState
        );
    },

    /**
     * Вывод сообщения
     *
     * @param string aParent тип окна предка
     * @param string aDialogTitle заголовок
     * @param string aText текст
     */
    alert: function(aParent, aDialogTitle, aText) {
        return this.promptService.alert(
            this.windowInternal(aParent),
            aDialogTitle,
            aText
        );
    }
};

let weblistener = {
    QueryInterface: function(aIID) {
        if (aIID.equals(Ci.nsIWebProgressListener) ||
            aIID.equals(Ci.nsISupportsWeakReference) ||
            aIID.equals(Ci.nsISupports)) {

            return this;
        }

        throw Components.results.NS_NOINTERFACE;
    },

    onLocationChange: function(aProgress, aRequest, aURI) {
        let uri = {};
        try { uri.spec = aURI.spec; } catch (e) {}
        try { uri.host = aURI.host; } catch (e) {}
        try { uri.hostPort = aURI.hostPort; } catch (e) {}
        try { uri.password = aURI.password; } catch (e) {}
        try { uri.path = aURI.path; } catch (e) {}
        try { uri.port = aURI.port; } catch (e) {}
        try { uri.prePath = aURI.prePath; } catch (e) {}
        try { uri.scheme = aURI.scheme; } catch (e) {}
        try { uri.username = aURI.username; } catch (e) {}
        try { uri.userPass = aURI.userPass; } catch (e) {}

        Observers.notify('location-change', null, uri);
    },

    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
        if (!aRequest || !(aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK)) {
            return;
        }

        if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
            //Observers.notify("location-load-start", null, [aWebProgress, aRequest]);
        }

        if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
            //Observers.notify("location-load-stop", null, [aWebProgress, aRequest]);
        }
    },

    onProgressChange: function(a, b, c, d, e, f) {},
    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
    onSecurityChange: function(a, b ,c) {},
    onLinkIconAvailable: function(a) {}
};


function windowInit(aWin) {
    if (aWin && typeof aWin.lsfbar == 'undefined') {
        aWin.lsfbar = {
            loaded: false,
            onload: [],
            onunload: [],
            palette: {
                current: [],
                onshow: [],
                onhide: [],
                init: {}
            }
        };

        windowLoadEvent(aWin);
    }
}


function windowLoadEvent(aWin) {
    aWin.addEventListener('load', function load(aEvtLoad) {
        let win = aEvtLoad.currentTarget;
        win.removeEventListener('load', load, false);

        if ('gBrowser' in win) {
            win.gBrowser.addProgressListener(weblistener);
        }

        win.addEventListener('unload', function unload(aEvtUnload) {
            let win = aEvtUnload.currentTarget;
            win.removeEventListener('unload', unload, false);

            if ('gBrowser' in win) {
                win.gBrowser.removeProgressListener(weblistener);
            }

            while(win.lsfbar.onunload.length) {
                try {
                    let callback = win.lsfbar.onunload.shift();
                    callback[0].call(callback[1], win);
                } catch (e) {
                    Components.utils.reportError(e);
                }
            }

            delete win.lsfbar;
        }, false);

        win.lsfbar.loaded = true;
        while(win.lsfbar.onload.length) {
            try {
                let callback = win.lsfbar.onload.shift();
                callback[0].call(callback[1], win);
            } catch (e) {
                Components.utils.reportError(e);
            }
        }
    }, false);
}