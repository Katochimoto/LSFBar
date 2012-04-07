"use strict";

let EXPORTED_SYMBOLS = ['Console'];

const Console = {
    get consoleService() {
        delete this.consoleService;
        return this.consoleService = Components.classes['@mozilla.org/consoleservice;1']
            .getService(Components.interfaces.nsIConsoleService);
    },

    get converterService() {
        delete this.converterService;
        return this.converterService = Components.classes['@mozilla.org/intl/utf8converterservice;1']
            .getService(Components.interfaces.nsIUTF8ConverterService);
    },

    log: function(aData) {
        this.consoleService.logStringMessage(this.converterService.convertURISpecToUTF8(toString(aData), 'UTF-8'));
    }
};

function isString(aData) {
    return (Object.prototype.toString.call(aData) == '[object String]');
}

function toString(aData, aShift, aLoop) {
    aShift = typeof aShift == 'undefined' ? '' : aShift + toString.stepShift;
    aLoop = typeof aLoop == 'undefined' ? 5 : aLoop;

    aLoop--;
    if (aLoop < 0) {
        return aShift + '...';
    }

    switch (Object.prototype.toString.call(aData)) {
        case '[object Number]':
        case '[object Boolean]':
        case '[object Function]':
            return String(aData);
            break;
        case '[object Null]':
            return 'Null';
            break;
        case '[object Undefined]':
            return 'Undefined';
            break;
        case '[object Array]':
            var str = [];
            for (var i = 0, l = aData.length; i < l; i++) {
                let v = aData[i];
                if (isString(v)) {
                    str.push(aShift + toString.stepShift + v);
                } else {
                    str.push(aShift + toString.stepShift + arguments.callee.call(this, v, aShift, aLoop));
                }
            }
            return '[\n' + str.join(',\n') + '\n' + aShift + ']';
            break;
        case '[object Object]':
        case '[object Event]':
        case '[object ChromeWindow]':
        case '[object XULDocument]':
            var str = [];
            for (var i in aData) {
                let v = aData[i];
                if (isString(v)) {
                    str.push(aShift + toString.stepShift + String(i) + ': ' + v);
                } else {
                    str.push(aShift + toString.stepShift + String(i) + ': ' + arguments.callee.call(this, v, aShift, aLoop));
                }
            }
            return '{\n' + str.join(',\n') + '\n' + aShift + '}';
            break;
        case '[object String]':
        default:
            return aData;
    }
}
toString.stepShift = '  ';