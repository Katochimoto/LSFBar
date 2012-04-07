var httpRequest = new XMLHttpRequest();

self.addEventListener('message', function(aEvt) {
    var data = aEvt.data,
        qs = [];

    data.out_xml = '1';

    for (var i in data) {
        qs.push(i + '=' + data[i]);
    }

    httpRequest.open('GET', 'http://ls-server.ls1.ru/repoupdater/?' + qs.join('&'), true);
    httpRequest.overrideMimeType('application/xml; charset=UTF-8');
    httpRequest.setRequestHeader('Content-Type', 'text/plain; charset=UTF-8');
    httpRequest.setRequestHeader('Connection', 'close');
    httpRequest.timeout = 1000 * 60 * 5;
    httpRequest.onload = onloadAction;
    httpRequest.onabort = onerrorAction;
    httpRequest.onerror = onerrorAction;
    httpRequest.ontimeout = onerrorAction;
    httpRequest.send(null);
}, false);

function onloadAction() {
    if (httpRequest.status == 200 && httpRequest.readyState == 4) {
        self.postMessage((httpRequest.responseText || '').trim());

    } else {
        onerrorAction();
    }
}

function onerrorAction() {
    throw new Error(httpRequest.statusText);
}