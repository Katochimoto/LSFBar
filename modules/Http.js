"use strict";

let EXPORTED_SYMBOLS = ['Http'];

Components.utils.import('resource://lsfbar/Win.js');

var Http = {};

Http.parseURL = function(str) {
    var o = {
        strictMode: false,
        key: ['source','protocol','authority','userInfo','user','password','host','port','relative','path','directory','file','query','anchor'],
        q: {
            name:   'queryKey',
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/\/?)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };

    var m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str),
        uri = {},
        i = 14;
    while (i--) {
        uri[o.key[i]] = m[i] || '';
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function($0, $1, $2) {
        if ($1) {
            uri[o.q.name][$1] = $2;
        }
    });

    return uri;
};

Http.openURL = function(aUrl, aEvt, aStatData, aPostData, aRespectLoadTabPref) {
    var browser = Win.windowInternal();
    var type = 'none';

    if (aEvt) {
        switch (aEvt) {
            case 'tab':
            case 'new tab':
            case 'current tab':
            case 'new window':
                type = aEvt;
        }

        if (aEvt.shiftKey) {
            type = 'new window';
        }

        if (aEvt.ctrlKey || aEvt.metaKey || (aEvt.type == 'click' && aEvt.button == 1)) {
            type = 'tab';
        }
    }

    if (!/^[A-z]+\:\/\//.test(aUrl)) {
        aUrl = 'http://' + aUrl;
    }

    var currentTab;

    switch (type) {
        case 'new window':
            break;

        case 'new tab':
            currentTab = browser.gBrowser.loadOneTab(aUrl, null, null, aPostData, (aRespectLoadTabPref ? null : false));
            break;

        case 'current tab':
        case 'tab':
            currentTab = browser.gBrowser.mCurrentTab;

            if (
                !(aEvt.ctrlKey || aEvt.metaKey || (aEvt.type == 'click' && aEvt.button == 1)) &&
                    (type == 'current tab' || canLoadURLInCurrentTab(currentTab, aUrl))
                ) {
                currentTab.linkedBrowser.loadURIWithFlags(
                    aUrl,
                    Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE,
                    null,
                    null,
                    aPostData
                );

            } else {
                currentTab = browser.gBrowser.loadOneTab(aUrl, null, null, aPostData, (aRespectLoadTabPref ? null : false));
            }
            break;

        default:
            currentTab = browser.gBrowser.mCurrentTab;
            browser.loadURI(aUrl, null, aPostData);
    }

    return true;
};


Http.qs = function(path, add, remove, isQuery) {
    var isQ = defined(isQuery) ? isQuery : false,
        uri = path.split('?'),
        hasPath = (defined(uri[1]) || !isQ) ? true : false,
        pathQs = hasPath ? uri[0] : '',
        qs = this.parseStr(hasPath ? (uri[1] || '') : (uri[0] || ''));

    if (defined(remove)) {
        for (var i in qs) {
            for (var j=0, l = remove.length; j < l; j++) {
                if (i == remove[j]) {
                    delete qs[i];
                }
            }
        }
    }

    if (defined(add)) {
        for (var i in add) {
            qs[i] = add[i];
        }
    }

    var qsStr = '';
    for (var i in qs) {
        qsStr += i + '=' + qs[i] + '&';
    }

    return pathQs + '?' + qsStr;
};


Http.parseStr = function(str, array) {
    var glue1 = "=",
        glue2 = "&",
        array1 = str.split("?"),
        qStr = (typeof(array1[1]) != "undefined") ? array1[1] : array1[0],
        array2 = qStr.split(glue2),
        array3 = {};

    for (var x = 0, l = array2.length; x < l; x++) {
        var tmp = array2[x].split(glue1);
        if (typeof(tmp[0]) != "undefined" && typeof(tmp[1]) != "undefined") {
            array3[unescape(tmp[0])] = unescape(tmp[1]).replace(/[+]/g, " ");
        }
    }

    if (array) {
        array = array3;
    } else {
        return array3;
    }
};

Http.checkHost = function(url) {
    return /^([a-zA-Z0-9][\w\-_]*\.)+[a-zA-Z0-9]{2,6}$/.test(url);
};








function defined(val) {
    return (typeof val != 'undefined' && val != null);
}

function modifTextareasInWindow(aWin) {
    var doc = aWin.document;

    if (doc && ('body' in doc)) {
        var i = 0,
            textareas = doc.getElementsByTagName('textarea');

        while (textareas[i]) {
            var textarea = textareas[i++];
            if (textarea instanceof Components.interfaces.nsIDOMHTMLTextAreaElement
                && textarea.defaultValue != textarea.value) {

                return true;
            }
        }
    }

    return false;
}

function canLoadURLInCurrentTab(aTab, aURL) {
    var linkedBrowser = (aTab && aTab.linkedBrowser) ? aTab.linkedBrowser : null;

    try {
        var sh = linkedBrowser.sessionHistory;

        if (
            !sh
                || sh.index < 0
                || (sh.count < 2 && (!linkedBrowser.currentURI || linkedBrowser.currentURI.spec == 'about:blank'))
            ) {
            return true;
        }
    } catch(e) {}

    var currentHost = Http.parseURL(linkedBrowser.currentURI.spec).host;

    var lastHost = null;
    try {
        lastHost = Http.parseURL(linkedBrowser.lastURI.spec).host;
    } catch (e) {}

    var host2Load = Http.parseURL(aURL).host;

    if (!((lastHost && lastHost === host2Load) || (currentHost && (currentHost === host2Load)))) {
        return false;
    }

    return !modifTextareasInWindow(linkedBrowser.contentWindow);
}