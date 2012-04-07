var Ci = Components.interfaces,
    Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function nsCore() {
    this.wrappedJSObject = this;
}

nsCore.prototype = {
    classDescription: 'LSFBar core',
    classID: Components.ID('{e55bb0bc-8224-475b-93ac-054b725071cf}'),
    contractID: '@lightsoft.ru/lsfbar;1',

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsISupports
    ]),
    
    test: function() {
        return '123';
    }
};


/*
var components = [nsCore];

function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}
*/

if (XPCOMUtils.generateNSGetFactory) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsCore]);
} else {
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsCore]);
}