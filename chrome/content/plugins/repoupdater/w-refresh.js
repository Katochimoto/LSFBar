var httpRequest = new XMLHttpRequest();
httpRequest.open('GET', 'http://ls-server.ls1.ru/repoupdater/services/access/', true);
httpRequest.overrideMimeType('application/xml; charset=UTF-8');
httpRequest.setRequestHeader('Content-Type', 'text/plain; charset=UTF-8');
httpRequest.setRequestHeader('Connection', 'close');
httpRequest.timeout = 1000 * 60;
httpRequest.onload = onloadAction;
httpRequest.onabort = onerrorAction;
httpRequest.onerror = onerrorAction;
httpRequest.ontimeout = onerrorAction;
httpRequest.send(null);

function onloadAction () {
    if (httpRequest.status == 200 && httpRequest.readyState == 4) {
        self.postMessage({
            cmd: 'done',
            responce: (httpRequest.responseText || '').trim()
        });

    } else {
        onerrorAction();
    }
}

function onerrorAction () {
    self.postMessage({cmd: 'error'});
}