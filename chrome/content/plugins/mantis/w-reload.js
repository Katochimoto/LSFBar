var serviceURL = 'http://ls1.ru/ls_xml_server.php',
    sid,
    locale = 'ru',
    interval,
    lastTimeRequest,
    httpRequest,
    timerRequest,
    firstLoad = true,
    request = '<?xml version="1.0" encoding="Windows-1251"?><request><auth><sid>{sid}</sid></auth><action>task_status</action><locale>{locale}</locale><lastTimeRequest>{lastTimeRequest}</lastTimeRequest></request>';

self.addEventListener('message', function(aEvt) {
    var data = aEvt.data;

    switch (data.cmd) {
        case 'start':
            interval = data.interval;
            preloadRequest();
            break;

        case 'preload':
            sid = data.sid;
            lastTimeRequest = data.lastTimeRequest;
            sendRequest();
            break;
    }

}, false);

function trace(aMessage) {
    self.postMessage({cmd: 'trace', message: aMessage});
}

function preloadRequest() {
    httpRequest = null;

    if (timerRequest) {
        clearTimeout(timerRequest);
        timerRequest = null;
    }

    self.postMessage({cmd: 'preload'});
}

function sendRequest() {
    if (firstLoad) {
        firstLoad = false;
        sendRequestAction();

    } else {
        timerRequest = setTimeout(sendRequestAction, interval);
    }
}

function sendRequestAction() {
    var postData = request;

    postData = postData.replace(/\{sid\}/, sid)
        .replace(/\{locale\}/, locale)
        .replace(/\{lastTimeRequest\}/, lastTimeRequest);

    postData = 'xml=' + encodeURIComponent(postData);

    httpRequest = new XMLHttpRequest();
    httpRequest.open('POST', serviceURL, true);
    httpRequest.overrideMimeType('text/plain; charset=UTF-8');
    httpRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=cp1251');
    httpRequest.setRequestHeader('Content-length', postData.length);
    httpRequest.setRequestHeader('Connection', 'close');
    httpRequest.timeout = 5000;
    httpRequest.onload = onloadAction;
    httpRequest.onabort = preloadRequest;
    httpRequest.onerror = preloadRequest;
    httpRequest.ontimeout = preloadRequest;
    httpRequest.send(postData);
}

function onloadAction() {
    if (httpRequest.status == 200 && httpRequest.readyState == 4) {
        self.postMessage({
            cmd: 'load',
            responce: (httpRequest.responseText || '').trim()
        });
    }

    preloadRequest();
}