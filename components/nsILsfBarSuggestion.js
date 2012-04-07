var Ci = Components.interfaces,
    Cc = Components.classes,
    Cr = Components.results,
    Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

const XPCOM_SHUTDOWN_TOPIC = 'xpcom-shutdown';
const SEARCH_RESPONSE_SUGGESTION_JSON = 'application/x-suggestions+json';

// Implements nsIAutoCompleteResult
function LSFAutoCompleteResult(
    searchString,
    searchResult,
    defaultIndex,
    errorDescription,
    results, 
    comments
) {
    this._searchString = searchString;
    this._searchResult = searchResult;
    this._defaultIndex = defaultIndex;
    this._errorDescription = errorDescription;
    this._results = results;
    this._comments = comments;
}

LSFAutoCompleteResult.prototype = {
    _searchString: '',
    _searchResult: 0,
    _defaultIndex: 0,
    _errorDescription: '',
    _results: [],
    _comments: [],

    /**
     * The original search string
     */
    get searchString() {
        return this._searchString;
    },

    /**
     * The result code of this result object, either:
     *         RESULT_IGNORED   (invalid searchString)
     *         RESULT_FAILURE   (failure)
     *         RESULT_NOMATCH   (no matches found)
     *         RESULT_SUCCESS   (matches found)
     */
    get searchResult() {
        return this._searchResult;
    },

    /**
     * Index of the default item that should be entered if none is selected
     */
    get defaultIndex() {
        return this._defaultIndex;
    },

    /**
     * A string describing the cause of a search failure
     */
    get errorDescription() {
        return this._errorDescription;
    },

    /**
     * The number of matches
     */
    get matchCount() {
        return this._results.length;
    },

    /**
     * Get the value of the result at the given index
     */
    getValueAt: function(index) {
        return this._results[index];
    },

    /**
     * Get the comment of the result at the given index
     */
    getCommentAt: function(index) {
        return this._comments[index];
    },
    
    getLabelAt: function(index) {
        return this._results[index];
    },

    /**
     * Get the style hint for the result at the given index
     */
    getStyleAt: function(index) {
        if (!this._comments[index]) {
            return null;  // not a category label, so no special styling
        }

        if (index == 0) {
            return 'suggestfirst';  // category label on first line of results
        }

        return 'suggesthint';   // category label on any other line of results
    },

    /**
     * Get the image for the result at the given index
     * The return value is expected to be an URI to the image to display
     */
    getImageAt : function (index) {
        return '';
    },

    /**
     * Remove the value at the given index from the autocomplete results.
     * If removeFromDb is set to true, the value should be removed from
     * persistent storage as well.
     */
    removeValueAt: function(index, removeFromDb) {
        // дописать удаление из истории
        this._results.splice(index, 1);
        this._comments.splice(index, 1);
    },
    
    QueryInterface: function(aIID) {
        if (!aIID.equals(Ci.nsIAutoCompleteResult) && !aIID.equals(Ci.nsISupports)) {
            throw Cr.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
};



// Implements nsIAutoCompleteSearch
function LSFAutoCompleteSearch() {
    this._init();
}

LSFAutoCompleteSearch.prototype = {
    classDescription: 'LightSoft AutoComplete',
    classID: Components.ID('{51b57672-5deb-47eb-853a-c9fd6097d455}'),
    contractID: '@mozilla.org/autocomplete/search;1?name=lsfsearch-autocomplete',

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsIAutoCompleteSearch,
        Ci.nsIAutoCompleteObserver,
        Ci.nsISupports
    ]),
    
    /**
     * Объект XMLHttpRequest
     */
    _request: null,

    /**
     * Объект слушатель, который принимает ответ сервера
     */
    _listener: null,

    /**
     * Время, с момента которого можно выполнить следующий запрос
     */
    _nextRequestTime: 0,

    /**
     * Массив ошибок ответов сервера
     * содержит врема фиксирования ошибки
     */
    _serverErrorLog: [],

    /**
     * Число ошибок ответов с сервера до прекращения повторных запросов
     */
    _maxErrorsBeforeBackoff: 3,

    /**
     * Время ожидания успешного ответа с сервера
     */
    _serverErrorPeriod: 600000,

    /**
     * Приращение интервала между попытками отправки запросов на сервер
     */
    _serverErrorTimeoutIncrement: 600000,

    /**
     * Интервал между попытками отправки запросов на сервер
     * (выполняется группа запросов -> ответ с ошибкой -> ждем это время -> выполняем следующую группу запросов)
     */
    _serverErrorTimeout: 0,
    
    _init: function() {
        // установка ленивого слушателя на закрытие xpcom
        this._addObservers();
    },
    
    /**
     * Определение возможности выполнения следующего запроса
     */
    _okToRequest: function SAC__okToRequest() {
        return Date.now() > this._nextRequestTime;
    },
    
    /**
     * Проверка статусного кода ответа сервера
     * @return boolean true - ошибка ответа
     */
    _isBackoffError: function SAC__isBackoffError(status) {
        return ((status == 500) || (status == 502) || (status == 503));
    },
    
    /**
     * Обработка ошибки при ответе сервера
     * Вызывается если статус ответа не прошел проверку в this._isBackoffError()
     */
    _noteServerError: function SAC__noteServeError() {
        var currentTime = Date.now();

        this._serverErrorLog.push(currentTime);
        if (this._serverErrorLog.length > this._maxErrorsBeforeBackoff) {
            this._serverErrorLog.shift();
        }

        // если число ошибок достигло макс. допустимого
        // и время, прошедшее с момента первого запроса, меньше времени ожидания успешного ответа сервера
        if ((this._serverErrorLog.length == this._maxErrorsBeforeBackoff) &&
            ((currentTime - this._serverErrorLog[0]) < this._serverErrorPeriod)
        ) {
            this._serverErrorTimeout = (this._serverErrorTimeout * 2) + this._serverErrorTimeoutIncrement;
            this._nextRequestTime = currentTime + this._serverErrorTimeout;
        }
    },

    /**
     * Удаление лога ошибок ответов сервера
     * Обнуление времени ожидания
     */
    _clearServerErrors: function SAC__clearServerErrors() {
        this._serverErrorLog = [];
        this._serverErrorTimeout = 0;
        this._nextRequestTime = 0;
    },
    
    _reset: function SAC_reset() {
        this._listener = null;
        this._request = null;
    },
    
    /**
     * Установка ленивых слушателей
     */
    _addObservers: function SAC_addObservers() {
        var os = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
        os.addObserver(this, XPCOM_SHUTDOWN_TOPIC, false);
    },

    /**
     * Удаление ленивых слушателей
     */
    _removeObservers: function SAC_removeObservers() {
        var os = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
        os.removeObserver(this, XPCOM_SHUTDOWN_TOPIC);
    },

    /**
     * Реакция расширения на изменение настроек
     */
    observe: function SAC_observe(aSubject, aTopic, aData) {
        switch (aTopic) {
            // закрытие xpcom
            case XPCOM_SHUTDOWN_TOPIC:
                this._removeObservers();
                break;
        }
    },
    
    /**
     * Обработка ответа сервера
     */
    onReadyStateChange: function() {
        // если нет объекта запроса или состояние запроса не указывает на конец выполнения (=4)
        if (!this._request || this._request.readyState != 4) {
            return;
        }

        // получение статусного кода ответа сервера
        try {
            var status = this._request.status;
        } catch (e) {
            return;
        }

        // если ответ содержит ошибку
        if (this._isBackoffError(status)) {
            this._noteServerError();
            return;
        }

        // полный текст ответа сервера (полный, потому что ждем статуса 4)
        var responseText = this._request.responseText;

        if (status != 200 || responseText == '') {
            return;
        }

        this._clearServerErrors();

        var nativeJSON = Components.classes['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON),
            serverResults = nativeJSON.decode(responseText),
            searchString = serverResults[0] || '',
            results = serverResults[1] || [];

        // тут где-то получение результата из истории и мерж с ответом

        var commentsResult = serverResults[2] || [],
            comments = [];
        
        for (var i = 0, l = results.length; i < l; i++) {
            comments.push(commentsResult[i] || '');
        }
        
        // отправка слушателю готового ответа
        this.onResultsReady(searchString, results, comments);

        this._reset();
    },
    
    /**
     * Передача ответа слушателю
     *
     * @params searchString Строка запроса
     * @params results Ответ сервера, массив строк
     * @params comments Комментарии к каждой строке овета, массив
     */
    onResultsReady: function(searchString, results, comments) {
        if (!this._listener) {
            return;
        }
        
        var result = new LSFAutoCompleteResult(
            searchString,
            Ci.nsIAutoCompleteResult.RESULT_SUCCESS,
            0,
            '',
            results,
            comments
        );

        this._listener.onSearchResult(this, result);
        this._listener = null;
    },
    
    /**
     * Выполняет поиск и сообщяет результат слушателю
     *
     * @param searchString Строка запроса
     * @param searchParam Дополнительные параметры запроса (содержимое textbox[autocompletesearchparam])
     * @param previousResult Результат, который покажется сразу из истории
     * @param listener Слушатель, которому сообщим о выполнении запроса
     */
    startSearch: function(searchString, searchParam, previousResult, listener) {
        this.stopSearch();
        
        if (!searchString || !this._okToRequest()) {
            return;
        }
        
        this._listener = listener;
        
        var engine = Cc['@lightsoft.ru/searchbox;1'].getService()
            .wrappedJSObject
            .currentSearchEngine;
        
        if (!engine.supportsResponseType(SEARCH_RESPONSE_SUGGESTION_JSON)) {
            return;
        }
        
        if (typeof(engine.autocompleteEnabled) != 'undefined') {
            if (!engine.autocompleteEnabled()) {
                return;
            }
        }
        
        this._request = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].
            createInstance(Ci.nsIXMLHttpRequest);
        
        var submission = engine.getSubmission(searchString, SEARCH_RESPONSE_SUGGESTION_JSON);
        
        this._suggestURI = submission.uri;
        this._request.open(submission.postData ? 'POST' : 'GET', this._suggestURI.spec, true);
        
        this._request.setRequestHeader('Content-Type', SEARCH_RESPONSE_SUGGESTION_JSON + '; charset=UTF-8');
        this._request.setRequestHeader('Connection', 'close');
        
        var self = this;
        function onReadyStateChange() {
            self.onReadyStateChange();
        }

        this._request.onreadystatechange = onReadyStateChange;
        this._request.send(null);
    },
    
    /**
     * Остановка асинхронного запроса,
     * удаление объекта запроса
     */
    stopSearch: function() {
        if (this._request) {
            this._request.abort();
            this._reset();
        }
    }
};



if (XPCOMUtils.generateNSGetFactory) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([LSFAutoCompleteSearch]);
} else {
    var NSGetModule = XPCOMUtils.generateNSGetModule([LSFAutoCompleteSearch]);
}

