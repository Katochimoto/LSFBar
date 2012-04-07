"use strict";

let EXPORTED_SYMBOLS = ['Cookie'];

const Cookie = {
    get cookieService() {
        delete this.cookieService;
        return this.cookieService = Components.classes['@mozilla.org/cookieService;1']
            .getService(Components.interfaces.nsICookieService);
    },

    get cookieManager() {
        delete this.cookieManager;
        return this.cookieManager = Components.classes['@mozilla.org/cookiemanager;1']
            .getService(Components.interfaces.nsICookieManager2);
    },


    getCookiesFromHost: function(aHost) {
        let cookies = [];
        for (let e = this.cookieManager.getCookiesFromHost(aHost); e.hasMoreElements();) {
            let cookie = e.getNext().QueryInterface(Components.interfaces.nsICookie2);
            cookies.push(cookie);
        }
        return cookies;
    }
};