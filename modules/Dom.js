"use strict";

let EXPORTED_SYMBOLS = ['Dom'];

let Ci = Components.interfaces,
    Cc = Components.classes,
    Cu = Components.utils;

const Dom = {
    kXULNS: 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
    kHTMLNS: 'http://www.w3.org/1999/xhtml',

    get xmlSerializer() {
        delete this.XMLSerializer;
        return this.XMLSerializer = Cc['@mozilla.org/xmlextras/xmlserializer;1'].getService(Ci.nsIDOMSerializer);
    },

    get xpathEvaluator() {
        delete this.xpathEvaluator;
        return this.xpathEvaluator = Cc['@mozilla.org/dom/xpath-evaluator;1'].getService(Ci.nsIDOMXPathEvaluator);
    },

    get xsltProcessor() {
        delete this.xsltProcessor;
        return this.xsltProcessor = Cc['@mozilla.org/document-transformer;1?type=xslt'].createInstance(Ci.nsIXSLTProcessor);
    },

    get domParser() {
        delete this.domParser;
        return this.domParser = Cc['@mozilla.org/xmlextras/domparser;1'].createInstance(Ci.nsIDOMParser);
    },

    /**
     * пересоздание xml документа
     *
     * @srcNode nsIDOMNode исходный xml
     * @toDocument nsIDOMDocument корневой документ
     * @deep boolean рекурсивно
     * @namespace string неймспейс
     */
    recreateXML: function(srcNode, toDocument, deep, namespace) {
        if (!(srcNode instanceof Ci.nsIDOMNode)) {
            Cu.reportError('scrNode not instanceof nsIDOMNode');
            return false;
        }

        if (!(toDocument instanceof Ci.nsIDOMDocument)) {
            Cu.reportError('toDocument not instanceof nsIDOMDocument');
            return false;
        }

        namespace = namespace || srcNode.namespaceURI;
        let clone = null;

        switch (srcNode.nodeType) {
            case srcNode.DOCUMENT_NODE:
                clone = this.recreateXML(srcNode.documentElement, toDocument, deep, namespace);
                break;

            case srcNode.ELEMENT_NODE:
                clone = toDocument.createElementNS(namespace, srcNode.nodeName);
                let attributes = srcNode.attributes;
                for (let i = 0, len = attributes.length; i < len; i++) {
                    let source = attributes[i];
                    clone.setAttribute(source.nodeName, source.value);
                }
                if (deep) {
                    let child = srcNode.firstChild;
                    while (child) {
                        clone.appendChild(this.recreateXML(child, toDocument, deep, namespace));
                        child = child.nextSibling;
                    }
                }
                break;

            case srcNode.TEXT_NODE:
                clone = toDocument.createTextNode(srcNode.value);
                break;

            case srcNode.CDATA_SECTION_NODE:
                clone = toDocument.createCDATASection(srcNode.value);
                break;

            case srcNode.COMMENT_NODE:
                clone = toDocument.createComment(srcNode.value);
                break;
        }

        return clone;
    },

    /**
     * создание xul документа из xml
     *
     * @srcNode nsIDOMNode исходный xml
     * @toDocument nsIDOMDocument корневой документ
     * @deep boolean рекурсивно
     */
    xml2xul: function(srcNode, toDocument, deep, aNS) {
        aNS = aNS || this.kXULNS;
        return this.recreateXML(srcNode, toDocument, deep, aNS);
    },

    /**
     * применение xslt трансформации для xml документа
     * с возвратом нового документа
     */
    xsltTransformToDocument: function(xmlDocument, stylesheet) {
        let processor = this.xsltProcessor;
        processor.reset();
        processor.importStylesheet(stylesheet);
        return processor.transformToDocument(xmlDocument);
    },

    /**
     * применение xslt трансформации для xml документа
     * с возвратом фрагмента доукмента
     */
    xsltTransformToFragment: function(xmlDocument, stylesheet, destDoc) {
        let processor = this.xsltProcessor;
        processor.reset();
        processor.importStylesheet(stylesheet);
        return processor.transformToFragment(xmlDocument, destDoc);
    },

    /**
     * сериализация xml документа
     */
    serializeToString: function(xmlDocument) {
        let serializer = this.xmlSerializer;
        return serializer.serializeToString(xmlDocument)
    },

    /**
     * формирование xml документа из строки
     */
    parseFromString: function(xmlString) {
        let parser = this.domParser;
        return parser.parseFromString(xmlString, 'text/xml');
    },

    /**
     * @param string xmlString строка XML
     * @return XMLDocument
     */
    string2xml: function(xmlString) {
        xmlString = xmlString.replace(/<\?xml .+\?>[\r\n]*/, "") .replace(/(<!DOCTYPE ((.|\r|\n)*?)\]>)[\r\n]*/, "");
        xmlString = this.parseFromString(xmlString);
        return xmlString;
    },

    /**
     * @param string xmlString строка XML
     * @return object объект JXON
     */
    string2jxon: function(xmlString) {
        xmlString = xmlString.replace(/<\?xml .+\?>[\r\n]*/, "") .replace(/(<!DOCTYPE ((.|\r|\n)*?)\]>)[\r\n]*/, "");
        xmlString = this.parseFromString(xmlString);
        return getJXONTree(xmlString);
    }
};


function parseText(sValue) {
    if (/^\s*$/.test(sValue)) {
        return null;
    }

    if (/^(?:true|false)$/i.test(sValue)) {
        return sValue.toLowerCase() === "true";
    }

    if (isFinite(sValue)) {
        return parseFloat(sValue);
    }

    if (isFinite(Date.parse(sValue))) {
        return new Date(sValue);
    }

    return sValue;
}

function getJXONTree(oXMLParent) {
    var vResult = null, // значение по умолчанию для пустово узла
        nLength = 0,
        sCollectedTxt = "";

    if (oXMLParent.hasAttributes()) {
        vResult = {};
        for (nLength; nLength < oXMLParent.attributes.length; nLength++) {
            var oAttrib = oXMLParent.attributes.item(nLength);
            vResult["@" + oAttrib.name.toLowerCase()] = parseText(oAttrib.value.trim());
        }
    }

    if (oXMLParent.hasChildNodes()) {
        for (var oNode, sProp, vContent, nItem = 0; nItem < oXMLParent.childNodes.length; nItem++) {
            oNode = oXMLParent.childNodes.item(nItem);

            if (oNode.nodeType === 4) {
                sCollectedTxt += oNode.nodeValue;

            } else if (oNode.nodeType === 3) {
                sCollectedTxt += oNode.nodeValue.trim();

            } else if (oNode.nodeType === 1 && !oNode.prefix) {
                if (nLength === 0) {
                    vResult = {};
                }

                sProp = oNode.nodeName.toLowerCase();
                vContent = getJXONTree(oNode);
                if (vResult.hasOwnProperty(sProp)) {
                    if (vResult[sProp].constructor !== Array) {
                        vResult[sProp] = [vResult[sProp]];
                    }

                    vResult[sProp].push(vContent);

                } else {
                    vResult[sProp] = vContent;
                    nLength++;
                }
            }
        }
    }

    if (sCollectedTxt) {
        nLength > 0 ? vResult.keyValue = parseText(sCollectedTxt) : vResult = parseText(sCollectedTxt);
    }

    return vResult;
}