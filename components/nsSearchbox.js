var Cc = Components.classes,
    Ci = Components.interfaces,
    Cr = Components.results,
    Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function nsSearchbox() {
    Cu.import('resource://lsfbar/Dom.js');
    Cu.import('resource://lsfbar/IO.js');
    Cu.import('resource://lsfbar/Preferences.js');
    
    this.wrappedJSObject = this;
    this._currentSearchEngine = null;
}

nsSearchbox.prototype = {
    classDescription: 'LSFBar search box',
    classID: Components.ID('{93935c0d-bb55-435b-82f0-b0cfe4dd8980}'),
    contractID: '@lightsoft.ru/searchbox;1',

    QueryInterface: XPCOMUtils.generateQI([
        Ci.nsISupports
    ]),
    
    // получение объекта поисковиков
    get searchService() {
        if (!this._searchService) {
            this._searchService = Cc['@mozilla.org/browser/search-service;1'].getService(Ci.nsIBrowserSearchService);
        }
        
        return this._searchService;
    },
    
    get ioService() {
        return Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    },
    
    get searcherWidth() {
        return Preferences.get('lsfbar.searcher.width', 200);
    },
    
    set searcherWidth(val) {
        return Preferences.set('lsfbar.searcher.width', parseInt(val));
    },
    
    get xmlSearchServiceLs() {
        if (!defined(this._xmlSearchServiceLs)) {
            var fileServices = FileIO.open('chrome://lsfbar/content/plugins/searcher/services.xml');
            if (fileServices.exists() 
                && fileServices.isFile() 
                && fileServices.isReadable()) {
                
                this._xmlSearchServiceLs = Dom.parseFromString(FileIO.read(fileServices));
            } else {
                this._xmlSearchServiceLs = false;
            }
        }
        
        return this._xmlSearchServiceLs;
    },
    
    get searchServiceLs() {
        if (!this.xmlSearchServiceLs) {
            return [];
        }
        
        if (this._searchServiceLs) {
            return this._searchServiceLs.slice(0);
        }
        
        function YS_getServiceById_nsResolver() 'urn:data';
        
        this._searchServiceLs = [];
        
        var services = Dom.xpathEvaluator.evaluate(
                "//xmlns:group[@id='searchengine']/xmlns:service",
                this.xmlSearchServiceLs.documentElement,
                YS_getServiceById_nsResolver,
                Ci.nsIDOMXPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

        for (var i = 0, l = services.snapshotLength; i < l; i++) {
            var service = services.snapshotItem(i);
            this._searchServiceLs.push({
                id: service.getAttribute('id'),
                name: service.getAttribute('name'),
                url: service.getAttribute('search-url'),
                richpopup: !!service.getAttribute('richpopup'),
                autocomplete: {
                    url: service.getAttribute('autocomplete-url')
                },
                iconURI: {
                    spec: 'chrome://lsfbar/skin/images/' + service.getAttribute('icon')
                },
                tooltiptext: service.getAttribute('tooltiptext')
            });
        }
        
        return this._searchServiceLs.slice(0);
    },
    
    get defaultSearchengine() {
        var defSetting = Preferences.get('lsfbar.searcher.searchengine'),
            engines = this.searchServiceLs;

        (this.searchService.getVisibleEngines({}) || []).forEach(function(engine) {
            engines.push({id: '__' + (engine.id || engine.name)});
        });
        
        var l = engines.length,
            find = false;
            
        if (l > 0) {
            while (l--) {
                if (defSetting == engines[l].id) {
                    find = true;
                    break;
                }
            }
                
            if (!find) {
                defSetting = engines[0].id;
            }
        }
        
        return defSetting;
    },
    
    getServiceById: function(eId) {
        function YS_getServiceById_nsResolver() 'urn:data';
        
        var elem = Dom.xpathEvaluator.evaluate(
            "//xmlns:group[@id='searchengine']/xmlns:service[@id='" + eId + "']",
            this.xmlSearchServiceLs.documentElement,
            YS_getServiceById_nsResolver,
            Ci.nsIDOMXPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        return elem && elem.snapshotLength ? elem.snapshotItem(0) : null;
    },
    
    setCurrentSearchEngine: function(eId) {
        var elem,
            result = {};
        
        this._currentSearchEngine = {
            isLs: false,
            name: eId,
            autocompleteUrl: '',
            searchUrl: ''
        };

        if (/^__/.test(eId)) {
            var id = eId.replace(/^__/, '');

            this._currentSearchEngine.name = id;

            elem = this.searchService.getEngineByName(id);
            if (elem) {
                result.label = id;
                result.image = elem.iconURI ? elem.iconURI.spec : '';
                result.searchUrl = elem.uri;
                result.richpopup = false;
                result.autocomplete = true;
            }
        } else {
            this._currentSearchEngine.isLs = true;

            elem = this.getServiceById(eId);

            if (elem) {
                result.label = elem.getAttribute('name');
                result.image = 'chrome://lsfbar/skin/images/' + elem.getAttribute('icon');
                result.searchUrl = elem.getAttribute('search-url');
                result.richpopup = !!elem.getAttribute('richpopup');
                result.autocomplete = (elem.getAttribute('autocomplete-url').length > 0);
                
                this._currentSearchEngine.searchUrl = elem.getAttribute('search-url');
                this._currentSearchEngine.autocompleteUrl = elem.getAttribute('autocomplete-url');
            }
        }
        
        Preferences.set('lsfbar.searcher.searchengine', eId);

        return result.label ? result : null;
    },
    
    getSearchEngineUrl: function(eId, aText) {
        var engine,
            result = { isLs: false };

        if (/^__/.test(eId)) {
            var id = eId.replace(/^__/, '');
            engine = this.searchService.getEngineByName(id);

            if (engine) {
                var submission = engine.getSubmission(aText, null);

                if (submission) {
                    result.url = submission.uri.spec;
                    result.statData = {action: '4300'};
                    result.postData = submission.postData;
                }
            }
        } else {
            result.isLs = true;

            engine = this.getServiceById(eId);

            if (engine) {
                let searchURL,
                    action;
                    
                try {
                    if (engine.hasAttribute('filter')) {
                        aText = Function('aText', engine.getAttribute('filter'))(aText);
                    }
                
                    searchURL = engine.getAttribute('search-url') + (encodeURIComponent(aText).replace(/%20/g, '+'));
                    action = engine.hasAttribute('search-action') ? engine.getAttribute('search-action') : null;
                } catch (e) {}
                
                result.url = searchURL;
                result.statData = action ? {action: action} : null;
                result.postData = null;
            }
        }

        return result.url ? result : null;
    },
    
    get currentSearchEngine() {
        if (!this._currentSearchEngine.isLs) {
            return this.searchService.getEngineByName(this._currentSearchEngine.name);
        }

        return {
            _self: this,

            _currentEngine: this._currentSearchEngine,

            name: '___ls___' + this._currentSearchEngine.name,

            supportsResponseType: function(aType) {
                return aType == 'application/x-suggestions+json';
            },

            autocompleteEnabled: function() {
                return this._self._currentSearchEngine.autocompleteUrl.length == 0 ? false : true;
            },

            getSubmission: function(aData, aResponseType) {
                var uri = null;
                
                try {
                    uri = this._self.ioService.newURI(this._self._currentSearchEngine.autocompleteUrl + encodeURIComponent(aData), 'UTF-8', null);
                } catch (e) {}
                
                return {
                    postData: null,
                    uri: uri
                }
            }
        };
    }
};

if (XPCOMUtils.generateNSGetFactory) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsSearchbox]);
} else {
    var NSGetModule = XPCOMUtils.generateNSGetModule([nsSearchbox]);
}

function defined(val) {
    return (typeof val != 'undefined' && val != null);
}