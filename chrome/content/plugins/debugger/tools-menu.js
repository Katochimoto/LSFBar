"use strict";

var toolsDebug =  app.plugin({
    _init: function() {
        Observers.add(Debug.EV.SETTINGS_CHANGE, function(aSubject, aSettings) {
            let items = document.getElementsByClassName('lsfbar-toolbar-tools-debugger-trace-item'),
                runel = e('lsfbar-toolbar-tools-debugger-run'),
                nextrunel = e('lsfbar-toolbar-tools-debugger-nextrun');

            if (aSettings === null) {
                runel.setAttribute('disabled', true);
                nextrunel.setAttribute('disabled', true);
                nextrunel.setAttribute('checked', false);

                Array.prototype.forEach.call(items, function(item) {
                    item.setAttribute('disabled', true);
                    item.setAttribute('checked', false);
                });
            } else {
                runel.setAttribute('disabled', false);
                nextrunel.setAttribute('disabled', false);
                nextrunel.setAttribute('checked', false);

                Array.prototype.forEach.call(items, function(item) {
                    let trc = item.getAttribute('trc');
                    item.setAttribute('disabled', false);
                    if (typeof aSettings[trc] != 'undefined') {
                        item.setAttribute('checked', !!aSettings[trc]);
                    }
                });
            }
        });

        Palette.onshow(PALETTE_TOOLS, function() {
            Debug.settings();
            let el = e('lsfbar-toolbar-tools-debugger');
            if (el) {
                el.addEventListener('command', this.onaction, false);
            }
        }, this);

        Palette.onhide(PALETTE_TOOLS, function() {
            let el = e('lsfbar-toolbar-tools-debugger');
            if (el) {
                el.removeEventListener('command', this.onaction, false);
            }
        }, this);
    },

    onaction: function(aEvt) {
        let target = aEvt.target,
            action = target.getAttribute('data-action');

        switch (action) {
            case 'settingchange':
                Observers.notify(Debug.EV.SETTING_CHANGE, null, [
                    target.getAttribute('trc'),
                    target.hasAttribute('checked')
                ]);
                break;

            case 'nextrun':
                if (target.hasAttribute('checked')) {
                    Observers.notify(Debug.EV.LRUN);
                } else {
                    Observers.notify(Debug.EV.CANCEL);
                }
                break;

            case 'run':
                Observers.notify(Debug.EV.RUN);
                break;
        }
    }
});