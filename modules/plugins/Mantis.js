"use strict";

let EXPORTED_SYMBOLS = ['Mantis'];

let Cu = Components.utils;

Cu.import('resource://lsfbar/Preferences.js');
Cu.import('resource://lsfbar/Observers.js');
Cu.import('resource://lsfbar/Console.js');
Cu.import('resource://lsfbar/Cookie.js');
Cu.import('resource://lsfbar/IO.js');
Cu.import('resource://lsfbar/Dom.js');
Cu.import('resource://lsfbar/StringBundle.js');

let reloadWorker,   // объект Worker
    responceFile = 'lightsoft/task-status-responce.json';

const Mantis = {
    get EV() {
        return {
            CHECK_START: 'mantis-check-start',      // запуск проверки
            CHECK_STOP: 'mantis-check-stop',        // остановка проверки
            CHECK_RESTART: 'mantis-check-restart',  // перезапуск проверки
            TASKS_RESET: 'mantis-tasks-reset'       // обновление списка задач
        };
    },

    get PREF() {
        return {
            RELOAD_INTERVAL: 'lsfbar.mantis.reloadinterval',
            RELOAD: 'lsfbar.mantis.reload',
            SHOW_COUNT: 'lsfbar.mantis.showcount',
            TASKS_SHOW: 'lsfbar.mantis.tasksshow',
            DEFAULT_STATUS: 'lsfbar.mantis.defaultstatus'
        };
    },

    get tasks() {
        let file = FileIO.open(responceFile, 'ProfD');

        if (!file) {
            return null;
        }

        if (!file.exists()) {
            return null;
        }

        if (!file.isReadable()) {
            return null;
        }

        let str = FileIO.read(file, false);

        return (str.length > 0 ? JSON.parse(str) : null);
    },

    get selectedTasks() {
        let tasks = this.tasks,
            prefSelectTasks = (Preferences.get(Mantis.PREF.DEFAULT_STATUS, '')).split(','),
            result = {},
            empty = true;

        if (!tasks || prefSelectTasks.length == 0) {
            return null;
        }

        prefSelectTasks.forEach(function(nick) {
            if (typeof tasks[nick] != 'undefined') {
                result[nick] = tasks[nick];
                empty = false;
            }
        });

        return (empty ? null : result);
    },

    get notSelectedTasks() {
        let tasks = this.tasks,
            prefSelectTasks = (Preferences.get(Mantis.PREF.DEFAULT_STATUS, '')).split(','),
            result = {},
            empty = true;

        if (!tasks) {
            return null;
        }

        if (prefSelectTasks.length == 0) {
            return tasks;
        }

        for (var i in tasks) {
            if (prefSelectTasks.indexOf(i) == -1) {
                result[i] = tasks[i];
                empty = false;
            }
        }

        return (empty ? null : result);
    }
};

Observers.add(Mantis.EV.CHECK_START, function() {
    if (!reload() || reloadInterval() <= 0) {
        return;
    }

    if (reloadWorker) {
        reloadWorker.terminate();
    }

    reloadWorker = new Worker('chrome://lsfbar/content/plugins/mantis/w-reload.js');
    reloadWorker.addEventListener('message', function(aEvt) {
        var data = aEvt.data;

        switch (data.cmd) {
            // запрос воркером сессии авторизации и времени последнего запроса
            case 'preload':
                reloadWorker.postMessage({
                    cmd: 'preload',
                    sid: getSid(),
                    lastTimeRequest: getLastTimeRequest()
                });
                break;

            // ответ сервиса
            case 'load':
                saveResponce(data.responce);
                break;

            case 'trace':
                Console.log(data.message);
                break;
        }

    }, false);

    reloadWorker.postMessage({
        cmd: 'start',
        interval: reloadInterval()
    });
});

Observers.add(Mantis.EV.CHECK_STOP, function() {
    if (reloadWorker) {
        reloadWorker.terminate();
        reloadWorker = null;
    }
});

Observers.add(Mantis.EV.CHECK_RESTART, function() {
    Observers.notify(Mantis.EV.CHECK_STOP);
    Observers.notify(Mantis.EV.CHECK_START);
});

Preferences.observe(Mantis.PREF.RELOAD_INTERVAL, function() {
    Observers.notify(Mantis.EV.CHECK_RESTART);
});

Preferences.observe(Mantis.PREF.RELOAD, function(aVal) {
    if (aVal) {
        Observers.notify(Mantis.EV.CHECK_START);
    } else {
        Observers.notify(Mantis.EV.CHECK_STOP);
    }
});


function reload() {
    return Preferences.get(Mantis.PREF.RELOAD, false);
}

function reloadInterval() {
    return Preferences.get(Mantis.PREF.RELOAD_INTERVAL, 0) * 60 * 1000;
}


function getSid() {
    let session;

    ['ls1.ru', 'www.ls1.ru', 'tracker.imarket.ru'].forEach(function(aHost) {
        let cookies = Cookie.getCookiesFromHost(aHost).filter(function(aCookie) {
            return (aCookie.name == 'MANTIS_STRING_COOKIE' && typeof aCookie.value != 'undefined' && aCookie.value != null);
        });

        if (cookies.length > 0) {
            session = cookies[0].value;
            return false;
        }
    });

    return session;
}



function getLastTimeRequest() {
    let d = new Date(),
        responce = FileIO.open(responceFile, 'ProfD');

    if (responce && responce.exists()) {
        d.setTime(responce.lastModifiedTime);
        responce = null;
    }

    return d.toLocaleFormat('%Y-%m-%d %H:%M:%S');
}



function saveResponce(aResponce) {
    if (!aResponce) {
        return false;
    }

    aResponce = Dom.string2jxon(aResponce);

    if (typeof aResponce.result.state == 'undefined') {
        return false;
    }

    if (aResponce.result.state != 'ok') {
        return false;
    }

    let file = FileIO.open(responceFile, 'ProfD');

    if (!file) {
        return false;
    }

    if (file.exists()) {
        if (!file.isReadable() || !file.isWritable()) {
            FileIO.unlink(file);
            FileIO.create(file);
        }

    } else if (!FileIO.create(file)) {
        return false;
    }

    if (!file.exists()) {
        return false;
    }

    // количество задач предыдущего ответа переписываем в текущий
    var lastTasks = Mantis.tasks;
    if (defined(lastTasks)) {
        var l = aResponce.result.task_status.status.length;
        for (var nick in lastTasks) {
            for (var i = 0; i < l; i++) {
                if (aResponce.result.task_status.status[i].nick == nick) {
                    aResponce.result.task_status.status[i]['lastCnt'] = lastTasks[nick].count;
                }
            }
        }

        aResponce.result.online['lastCnt'] = lastTasks['online'].count;
    }

    var tasks = {},
        l = aResponce.result.task_status.status.length,
        count, lastCount, inc, text, countText, name, url, s;

    for (var i = 0; i < l; i++) {
        s = aResponce.result.task_status.status[i];

        if (!defined(s.nick)) {
            continue;
        }

        name = (defined(s.name)) ? s.name.toString() : '';

        if (!name.length) {
            continue;
        }

        url = (defined(s.url)) ? s.url.toString() : '';

        if (!url.length) {
            continue;
        }

        count = parseInt(s.cnt);
        lastCount = parseInt(s.lastCnt);
        inc = (count > lastCount) ? count - lastCount : 0;
        countText = (count > 0) ? '(' + count + (inc > 0 ? '+' + inc : '') + ')' : '';
        text = name + ' ' + countText;

        tasks[s.nick.toString()] = {
            name: name,
            nick: s.nick.toString(),
            tooltiptext: text,
            text: text,
            countText: countText,
            color: (defined(s.color)) ? s.color.toString() : '',
            count: count,
            lastCount: lastCount,
            url: url
        };
    }

    if (defined(aResponce.result.online)) {
        name = StringBundle.getString('app.properties', 'mantis_online');
        count = parseInt(aResponce.result.online.cnt);
        lastCount = parseInt(aResponce.result.online.lastCnt);
        inc = (count > lastCount) ? count - lastCount : 0;
        countText = (count > 0) ? '(' + count + (inc > 0 ? '+' + inc : '') + ')' : '';
        text = name + ' ' + countText;

        tasks['online'] = {
            name: name,
            nick: 'online',
            tooltiptext: text,
            text: text,
            countText: countText,
            color: null,
            count: count,
            lastCount: lastCount,
            url: aResponce.result.online.url
        };
    }

    if (!FileIO.write(file, JSON.stringify(tasks))) {
        return false;
    }

    Observers.notify(Mantis.EV.TASKS_RESET);
    return true;
}

function defined(val) {
    return (typeof val != 'undefined' && val != null);
}