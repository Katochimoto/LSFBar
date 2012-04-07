// версия плагина
pref('lsfbar.version', '');

// Mantis options
pref('lsfbar.mantis.reload', true);                 // обновлять список обращений
pref('lsfbar.mantis.reloadinterval', 5);            // интервал обновления списка обращений в мин
pref('lsfbar.mantis.defaultstatus', '');            // выводимая по умолчанию группа обращений
pref('lsfbar.mantis.tasksshow', 0);                 // способ вывода кнопок быстрого перехода: 0 - Только значки; 1 - Значки и текст; 2 - Только текст
pref('lsfbar.mantis.showcount', false);             // показывать количество задач

// Debugger options
pref('lsfbar.debugger.checkhost', false);           // проверять хост
pref('lsfbar.debugger.trc_db', true);
pref('lsfbar.debugger.trc_templ', true);
pref('lsfbar.debugger.trc_err', true);
pref('lsfbar.debugger.trc_other', true);

// Searcher options
pref('lsfbar.searcher.searchengine', 'tophotels');  // поисковик по умолчанию, если не найден, выберет первый из списка
pref('lsfbar.searcher.width', 400);                 // длина строки поиска


// Repoupdater options
pref('lsfbar.repoupdater.projectgroup', true);      // группировка проектов, true - по проектам, false - по серверам