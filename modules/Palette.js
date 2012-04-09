"use strict";

let EXPORTED_SYMBOLS = ['Palette'];

Components.utils.import('resource://lsfbar/Win.js');
Components.utils.import('resource://lsfbar/Console.js');

let win = Win.windowInternal(),
    _toolbarClass = 'lsfbar-toolbar';

const Palette = {
    onshow: function(aPalette, aCallback, aThisObj) {
        let palette = win.lsfbar.palette;
        palette.onshow.push([aPalette, aCallback, aThisObj]);

        if (palette.current.indexOf(aPalette) > -1 && !defined(palette.init[aPalette])) {
            try {
                aCallback.call(aThisObj);
                palette.init[aPalette] = true;
            } catch (e) {
                Components.utils.reportError(e);
            }
        }
    },

    onhide: function(aPalette, aCallback, aThisObj) {
        let palette = win.lsfbar.palette;
        palette.onhide.push([aPalette, aCallback, aThisObj]);

        if (palette.current.indexOf(aPalette) == -1 && defined(palette.init[aPalette])) {
            try {
                aCallback.call(aThisObj);
                delete palette.init[aPalette];
            } catch (e) {
                Components.utils.reportError(e);
            }
        }
    },

    bind: function(aEvent, aPalette) {
        if (aPalette && win.lsfbar.palette.current.indexOf(aPalette) > -1) {

            win.lsfbar.palette['on' + aEvent].filter(function(aCallback) {
                return (aCallback[0] == aPalette);
            }).forEach(function(aCallback) {
                try {
                    aCallback[1].call(aCallback[2]);
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });

        } else {
            win.lsfbar.palette['on' + aEvent].filter(function(aCallback) {
                return (win.lsfbar.palette.current.indexOf(aCallback[0]) > -1);
            }).forEach(function(aCallback) {
                try {
                    aCallback[1].call(aCallback[2]);
                } catch (e) {
                    Components.utils.reportError(e);
                }
            });
        }
    }
};

Win.onload(null, function(aWin) {
    var document = aWin.document,
        toolbar = document.getElementsByClassName(_toolbarClass)[0];

    if (!toolbar) {
        return false;
    }

    aWin.addEventListener('beforecustomization', customizeStart, false);
    aWin.addEventListener('aftercustomization', customizeEnd, false);
    //aWin.addEventListener('customizationchange', customizeChange, false);

    win.lsfbar.palette.current = (toolbar.getAttribute('currentset') || toolbar.currentSet || '').split(',');

    evtChange(win.lsfbar.palette.current, true);
});


function customizeStart(aEvt) {
    let toolbox = aEvt.target,
        toolbar = toolbox.getElementsByClassName(_toolbarClass)[0];

    win.lsfbar.palette.current = (toolbar.getAttribute('currentset') || toolbar.currentSet || '').split(',');
}

function customizeEnd(aEvt) {
    let toolbox = aEvt.target,
        toolbar = toolbox.getElementsByClassName(_toolbarClass)[0],
        currentPalette = (toolbar.getAttribute('currentset') || toolbar.currentSet || '').split(','),
        palette = win.lsfbar.palette.current,
        add = [],
        remove = [];

    for (var i = 0; i < currentPalette.length; i++) {
        if (palette.indexOf(currentPalette[i]) == -1) {
            add.push(currentPalette[i]);
        }
    }

    for (var i = 0; i < palette.length; i++) {
        if (currentPalette.indexOf(palette[i]) == -1) {
            remove.push(palette[i]);
        }
    }

    win.lsfbar.palette.current = currentPalette;

    evtChange(add, true);
    evtChange(remove, false);

    Palette.bind('show', 'lsfbar-toolbar-mantis');
}

//function customizeChange(aEvt) {
//    let toolbox = aEvt.target;
//}


function evtChange(aPallets, aShow) {
    let events = aShow ? win.lsfbar.palette.onshow : win.lsfbar.palette.onhide;
    aPallets.forEach(function(aName) {
        events.forEach(function(aCallback) {
            if (aCallback[0] == aName) {
                try {
                    aCallback[1].call(aCallback[2]);
                } catch (e) {
                    Components.utils.reportError(e);
                }
            }
        });
    });
}

function defined(aVal) {
    return (typeof aVal != 'undefined' && aVal != null);
}