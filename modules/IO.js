let EXPORTED_SYMBOLS = ['FileIO', 'DirIO', 'IO'];

let Ci = Components.interfaces,
    Cc = Components.classes,
    Cu = Components.utils;

Cu.import('resource://lsfbar/app.js');

const IO = {
    get ioService() {
        delete this.ioService;
        return this.ioService = Components.classes['@mozilla.org/network/io-service;1']
            .getService(Components.interfaces.nsIIOService);
    },

    get online() {
        return !this.ioService.offline;
    }
};


/**
 * var fileIn = FileIO.open('/test.txt');
 * if (fileIn.exists()) {
 *      var fileOut = FileIO.open('/copy of test.txt');
 *      var str = FileIO.read(fileIn);
 *      var rv = FileIO.write(fileOut, str);
 *      alert('File write: ' + rv);
 *      rv = FileIO.write(fileOut, str, 'a');
 *      alert('File append: ' + rv);
 *      rv = FileIO.unlink(fileOut);
 *      alert('File unlink: ' + rv);
 * }
 */
var FileIO = {

    /**
     * Открывает локальный файл,
     * указать или полный путь ("C:\\tmp\\test.txt", "//usr//local//test.txt"),
     * или относительно модуля (chrome://lsfbar/content/tools/tools.settings.xml)
     * или "file:///C:/Windows/Desktop/x.xml"
     *
     * .leafName: string имя без директории
     * .lastModifiedTime: integer время последнего изменения файла
     * .fileSize: integer размер в байтах
     * .path: string путь к файлу с названием
     * .parent: nsIFile директория размещения файла/папки
     * .isDirectory() true если директория
     * .exists() true файл/папка существует
     * .isFile() true если файл
     * .isReadable() true если можно читать
     * .isWritable() true если можно писать
     * .remove(recursive: boolean) удаление (recursive - рекурсивное удаление для директории)
     * .copyTo(directory: nsILocalFile, newname: string) копирование с переименованием
     * .moveTo(directory: nsILocalFile, newname: string) перемещение с переименованием
     *
     * https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIFile
     *
     * @param aPath string путь к файлу
     * @param aType string тип "относительности" файла/папки (ProfD и т.д.)
     * @return nsILocalFile
     */
    open: function(aPath, aType) {
        try {
            var path = _path(aPath, aType);
            if (!path) {
                return false;
            }

            var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
            if (!file) {
                return false;
            }

            file.initWithPath(path);
            return file;

        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Копирование файла aFrom в директорию aTo
     *
     * @param aFrom string путь к файлу
     * @param aTo string путь к директории
     * @param aName string новое имя
     * @param aTypeFrom string тип "относительности" файла/папки (ProfD и т.д.)
     * @param aTypeTo string тип "относительности" файла/папки (ProfD и т.д.)
     * @return false
     */
    copy: function(aFrom, aTo, aName, aTypeFrom, aTypeTo) {
        try {
            var from = _path(aFrom, aTypeFrom);
            if (!from) {
                return false;
            }

            var to = _path(aTo, aTypeTo);
            if (!to) {
                return false;
            }

            var aFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
            if (!aFile) {
                return false;
            }

            var aDir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
            if (!aDir) {
                return false;
            }

            var name = aName || null;

            aFile.initWithPath(from);
            aDir.initWithPath(to);

            aFile.copyTo(aDir, name);
            return true;

        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Чтение файла
     *
     * @param aSource nsIFile
     * @param aBinaryMode boolean
     * @return string|bin
     */
    read: function(aSource, aBinaryMode) {
        if (!aSource) {
            return null;
        }

        try {
            if (!aSource.isFile() || !aSource.isReadable()) {
                return null;
            }

            var content,
                inputStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);

            try {
                inputStream.init(aSource, 0x01, 0, inputStream.CLOSE_ON_EOF);

                if (aBinaryMode) {
                    var binaryStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);

                    try {
                        binaryStream.setInputStream(inputStream);
                        content = binaryStream.readBytes(binaryStream.available());
                    } catch(ex) {
                        Cu.reportError(ex);
                    } finally {
                        binaryStream.close();
                    }

                } else {
                    var fileSize = inputStream.available(),
                        cvstream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);

                    try {
                        cvstream.init(
                            inputStream,
                            "UTF-8",
                            fileSize,
                            Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER
                        );
                        var data = {};
                        cvstream.readString(fileSize, data);
                        content = data.value;
                    } catch(ex) {
                        Cu.reportError(ex);
                    } finally {
                        cvstream.close();
                    }

                }
            } catch(ex) {
                Cu.reportError(ex);
            } finally {
                inputStream.close();
            }

            return content;
        } catch(ex) {
            Cu.reportError(ex);
        }

        return null;
    },

    /**
     * Запись в файл
     *
     * @param aFile nsIFile
     * @param aData string
     * @return boolean
     */
    write: function(aFile, aData) {
        if (!aFile) {
            return false;
        }

        try {
            if (!aFile.isFile() || !aFile.isWritable()) {
                return false;
            }

            let stream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);

            try {
                stream.init(aFile, 0x02 | 0x08 | 0x20, 0755, 0);
                let writer = Cc['@mozilla.org/intl/converter-output-stream;1'].createInstance(Ci.nsIConverterOutputStream);

                try {
                    writer.init(stream, "UTF-8", 0, 0x0000);
                    writer.writeString(aData);
                } catch(ex) {
                    Cu.reportError(ex);
                } finally {
                    writer.close();
                }
            } catch(ex) {
                Cu.reportError(ex);
            } finally {
                stream.close();
            }

            return true;
        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Создание файла
     *
     * @param aFile nsIFile
     * @return boolean
     */
    create: function(aFile) {
        try {
            aFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0755);
            return true;

        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Удаление файла
     *
     * @param aFile nsIFile
     * @return boolean
     */
    unlink: function(aFile) {
        try {
            aFile.remove(false);
            return true;

        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Путь к файлу
     *
     * @param aFile nsIFile
     * @return string|boolean
     */
    path: function(aFile) {
        try {
            return 'file:///' + aFile.path
                .replace(/\\/g, '\/')
                .replace(/^\s*\/?/, '')
                .replace(/\ /g, '%20');

        } catch(ex) {
            Cu.reportError(ex);
        }
        return false;
    }
};


// Example use:
// var dir = DirIO.open('/test');
// if (dir.exists()) {
//     alert(DirIO.path(dir));
//     var arr = DirIO.read(dir, true), i;
//     if (arr) {
//         for (i = 0; i < arr.length; ++i) {
//             alert(arr[i].path);
//         }
//     }
// }
// else {
//     var rv = DirIO.create(dir);
//     alert('Directory create: ' + rv);
// }

// ---------------------------------------------
// ----------------- Nota Bene -----------------
// ---------------------------------------------
// Some possible types for get are:
//     'ProfD'                = profile
//     'DefProfRt'            = user (e.g., /root/.mozilla)
//     'UChrm'                = %profile%/chrome
//     'DefRt'                = installation
//     'PrfDef'            = %installation%/defaults/pref
//     'ProfDefNoLoc'                  = %installation%/defaults/profile
//     'APlugns'            = %installation%/plugins
//     'AChrom'            = %installation%/chrome
//     'ComsD'                = %installation%/components
//     'CurProcD'            = installation (usually)
//     'Home'                = OS root (e.g., /root)
//     'TmpD'                = OS tmp (e.g., /tmp)

var DirIO = {
    sep: app.dirsep,

    /**
     * Открыть директорию
     *
     * @param aType string тип "относительности" файла/папки (ProfD и т.д.)
     * @return nsIFile
     */
    get: function(aType) {
        try {
            var dir = Cc['@mozilla.org/file/directory_service;1']
                .createInstance(Ci.nsIProperties)
                .get(aType, Ci.nsIFile);

            return dir;

        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Открыть директорию
     *
     * @param aPath string путь к файлу
     * @param aType string тип "относительности" файла/папки (ProfD и т.д.)
     * @return nsILocalFile
     */
    open: function(aPath, aType) {
        return FileIO.open(aPath, aType);
    },

    /**
     * Создать директорию
     *
     * @param dir nsIFile
     * @return boolean
     */
    create: function(dir) {
        try {
            dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
            return true;

        } catch(ex) {
            Cu.reportError(ex);
        }

        return false;
    },

    /**
     * Читать директорию
     *
     * @param dir nsIFile
     * @param recursive boolean
     * @return array
     */
    read: function(dir, recursive) {
        var list = new Array();
        try {
            if (dir.isDirectory()) {
                if (recursive == null) {
                    recursive = false;
                }
                var files = dir.directoryEntries;
                list = this._read(files, recursive);
            }

        } catch(ex) {
            Cu.reportError(ex);
        }

        return list;
    },

    _read: function(dirEntry, recursive) {
        var list = new Array();
        try {
            while (dirEntry.hasMoreElements()) {
                list.push(dirEntry.getNext().QueryInterface(Ci.nsILocalFile));
            }

            if (recursive) {
                var list2 = new Array();
                for (var i = 0; i < list.length; ++i) {
                    if (list[i].isDirectory()) {
                        files = list[i].directoryEntries;
                        list2 = this._read(files, recursive);
                    }
                }

                for (i = 0; i < list2.length; ++i) {
                    list.push(list2[i]);
                }
            }

        } catch(e) {}

        return list;
    },

    /**
     * Удаление директории
     *
     * @param dir nsIFile
     * @param recursive boolean
     * @return boolean
     */
    unlink: function(dir, recursive) {
        try {
            if (recursive == null) {
                recursive = false;
            }

            dir.remove(recursive);

            return true;

        } catch(e) {
            return false;
        }
    },

    /**
     * Путь к директории
     *
     * @param dir nsIFile
     * @return string|boolean
     */
    path: function (dir) {
        return FileIO.path(dir);
    },

    split: function(str, join) {
        var arr = str.split(/\/|\\/), i;
        str = new String();
        for (i = 0; i < arr.length; ++i) {
            str += arr[i] + ((i != arr.length - 1) ? join : '');
        }
        return str;
    },

    join: function(str, split) {
        var arr = str.split(split), i;
        str = new String();
        for (i = 0; i < arr.length; ++i) {
            str += arr[i] + ((i != arr.length - 1) ? this.sep : '');
        }
        return str;
    }
};
















/**
 * ProfD        profile directory
 * DefProfRt    user (for example /root/.mozilla)
 * Home         OS root (for example /root)
 * TmpD         OS tmp (for example /tmp)
 * ...
 *
 * полный список
 * https://developer.mozilla.org/en/Code_snippets/File_I%2f%2fO
 *
 * @param aPath string относительный путь
 * @param aType string "ProfD" и т.д.
 * @return string
 */
function _rel2path(aPath, aType) {
    if (!aPath || !aType) {
        return false;
    }

    try {
        var file = Cc['@mozilla.org/file/directory_service;1']
            .getService(Ci.nsIProperties)
            .get(aType, Ci.nsIFile);

        if (!file) {
            return false;
        }

        var p = aPath.split('/');

        for (var i = 0, l = p.length; i < l; i++) {
            file.append(p[i]);
        }

        return file.path || false;

    } catch(e) {}

    return false;
}

function _chrome2path(aPath) {
    if (!aPath || !(/^chrome:/.test(aPath))) {
        return false;
    }

    try {
        var uri = IO.ioService.newURI(aPath, 'UTF-8', null),
            cr = Cc['@mozilla.org/chrome/chrome-registry;1'].getService(Ci.nsIChromeRegistry),
            rv = cr.convertChromeURL(uri).spec;

        if (/^file:/.test(rv)) {
            rv = _url2path(rv);

        } else {
            rv = _url2path('file://' + rv);
        }

        return rv;

    } catch(e) {}

    return false;
}

function _url2path(aPath) {
    if (!aPath || !(/^file:/.test(aPath))) {
        return false;
    }

    try {
        var ph = Cc['@mozilla.org/network/protocol;1?name=file'].createInstance(Ci.nsIFileProtocolHandler),
            rv = ph.getFileFromURLSpec(aPath).path;

        return rv;

    } catch(e) {}

    return false;
}

/**
 * Перевод локального пути в относительный
 *
 * @param aPath string локальный путь (с chrome: или file:)
 * @param aType string "ProfD" и т.д.
 * @return string
 */
function _path(aPath, aType) {
    if (!aPath) {
        return false;
    }

    try {
        var path = aPath;
        if (/^chrome:/.test(aPath)) {
            path = _chrome2path(aPath);

        } else if (/^file:/.test(aPath)) {
            path = _url2path(aPath);

        } else if (typeof aType != 'undefined' && aType != null) {
            path = _rel2path(aPath, aType);

        }

        return path;

    } catch(e) {}

    return false;
}