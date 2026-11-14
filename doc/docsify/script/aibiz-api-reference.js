(function () {
  'use strict';
  var preferredLanguage = function () {
    var params = new URLSearchParams(location.search);
    var query = params.get('language') || params.get('lang');
    if (query === 'en' || query === 'en-US') return 'en';
    if (query === 'zh-CN' || query === 'zh') return 'zh-CN';
    var stored = '';
    try { stored = localStorage.getItem('language') || localStorage.getItem('lang'); } catch (_) {}
    return /^en(?:[-_]|$)/i.test(stored || '') ? 'en' : 'zh-CN';
  };
  var currentRoute = function () {
    return location.hash.match(/^#\/api-reference\/(en|zh-CN)\/(ServiceAPI|entities\/[a-zA-Z_][a-zA-Z0-9_-]*)(?:\.md)?(\?id=(?:op|dto)-[a-f0-9]{16})?$/);
  };
  var redirect = function () {
    var overview = /^#\/api\/ServiceAPI(?:\/ServiceAPI)?(?:\.md)?\/?$/.test(location.hash);
    var entity = location.hash.match(/^#\/api\/ServiceAPI\/(?:deapi\/)?([a-zA-Z_][a-zA-Z0-9_-]*)(?:\.md)?(?:(?:\?id=|#)([^#]*))?$/);
    if (!overview && !entity) return;
    location.replace(location.pathname + location.search +
      '#/api-reference/' + preferredLanguage() + '/' +
      (overview ? 'ServiceAPI' : 'entities/' + entity[1] +
        (/^(?:op|dto)-[a-f0-9]{16}$/.test(entity[2] || '') ? '?id=' + entity[2] : '')));
  };
  var safeText = function (element, value) {
    element.textContent = String(value == null ? '' : value);
  };
  var safeEntry = function (entry, language) {
    return entry && typeof entry.label === 'string' && entry.label.length <= 2048 &&
      typeof entry.code === 'string' && entry.code.length <= 512 &&
      typeof entry.keywords === 'string' && entry.keywords.length <= 16384 &&
      typeof entry.path === 'string' &&
      new RegExp('^#/api-reference/' + language +
        '/(?:ServiceAPI|entities/[a-zA-Z_][a-zA-Z0-9_-]*)(?:\\?id=(?:op|dto)-[a-f0-9]{16})?$').test(entry.path);
  };
  var generation = 0;
  var originalTitle = document.title;
  var originalName = window.$docsify && window.$docsify.name;
  var attach = function (hook) {
    hook.doneEach(function () {
      generation += 1;
      var active = generation;
      document.querySelectorAll('[data-aibiz-api-panel]').forEach(function (node) { node.remove(); });
      var route = currentRoute();
      var root = document.querySelector('.sidebar');
      var brand = document.querySelector('.app-name-link');
      var name = route ? (route[1] === 'en' ? 'Service API Reference' : '服务接口参考') : originalName;
      document.title = route ? name : originalTitle;
      if (brand && name) safeText(brand, name);
      if (!root || !route) return;
      var current = route[1];
      var english = current === 'en';
      var panel = document.createElement('section');
      panel.setAttribute('data-aibiz-api-panel', 'true');
      panel.style.cssText = 'padding:8px 12px;overflow-wrap:anywhere;';
      var languages = document.createElement('nav');
      languages.setAttribute('aria-label', english ? 'Reference language' : '参考语言');
      [['zh-CN', '中文'], ['en', 'English']].forEach(function (item) {
        var link = document.createElement('a');
        link.href = '#/api-reference/' + item[0] + '/' + route[2] + (route[3] || '');
        if (item[0] === current) link.setAttribute('aria-current', 'page');
        link.style.marginRight = '12px';
        safeText(link, item[1]);
        languages.appendChild(link);
      });
      panel.appendChild(languages);
      var input = document.createElement('input');
      input.type = 'search';
      input.placeholder = english ? 'Search API reference' : '搜索接口参考';
      input.setAttribute('aria-label', input.placeholder);
      input.setAttribute('data-aibiz-api-search', 'true');
      input.style.cssText = 'box-sizing:border-box;width:100%;margin:8px 0;padding:6px;';
      input.disabled = true;
      panel.appendChild(input);
      var status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.style.cssText = 'font-size:12px;margin:4px 0;';
      safeText(status, english ? 'Loading API index' : '正在加载接口索引');
      panel.appendChild(status);
      var results = document.createElement('ul');
      results.setAttribute('data-aibiz-api-results', 'true');
      results.style.cssText = 'margin:0;padding-left:16px;';
      panel.appendChild(results);
      root.insertBefore(panel, root.firstChild);
      fetch('api-reference/' + current + '/search.json', { credentials: 'same-origin', redirect: 'error' })
        .then(function (response) {
          if (!response.ok) throw new Error('API search index unavailable');
          return response.json();
        })
        .then(function (data) {
          if (generation !== active || !panel.isConnected) return;
          if (data.language !== current || !Array.isArray(data.entries) ||
              data.entries.length > 100000 || !data.entries.every(function (entry) { return safeEntry(entry, current); })) {
            throw new Error('Invalid API search index');
          }
          var entries = data.entries;
          input.disabled = false;
          var filter = function () {
            var term = input.value.trim().toLowerCase();
            results.replaceChildren();
            if (!term) {
              safeText(status, entries.length + (english ? ' reference entries' : ' 条参考条目'));
              return;
            }
            var matches = entries.filter(function (entry) {
              return [entry.label, entry.code, entry.keywords].join(' ').toLowerCase().includes(term);
            });
            safeText(status, matches.length + (english ? ' results' : ' 条结果'));
            matches.slice(0, 50).forEach(function (entry) {
              var item = document.createElement('li');
              var link = document.createElement('a');
              link.href = entry.path;
              safeText(link, entry.label + ' [' + entry.code + ']');
              item.appendChild(link);
              results.appendChild(item);
            });
          };
          input.addEventListener('input', filter);
          filter();
        }).catch(function () {
          if (generation !== active || !panel.isConnected) return;
          safeText(status, english ? 'API search index unavailable' : '接口搜索索引不可用');
          status.setAttribute('role', 'alert');
        });
    });
  };
  redirect();
  window.addEventListener('hashchange', redirect);
  window.$docsify = window.$docsify || {};
  window.$docsify.alias = Object.assign({}, window.$docsify.alias, {
    '/api-reference/(en|zh-CN)/entities/_sidebar.md': '/api-reference/$1/_sidebar.md'
  });
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(attach);
}());
