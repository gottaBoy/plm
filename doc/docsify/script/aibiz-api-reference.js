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
    return location.hash.match(/^#\/api-reference\/(en|zh-CN)\/(ServiceAPI|entities\/[a-zA-Z_][a-zA-Z0-9_-]*)(?:\.md)?(\?id=(?:op|dto|fields)-[a-f0-9]{16})?$/);
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
      typeof entry.keywords === 'string' && entry.keywords.length <= 65536 &&
      typeof entry.body === 'string' && entry.body.length <= 524288 &&
      typeof entry.path === 'string' &&
      new RegExp('^#/api-reference/' + language +
        '/(?:ServiceAPI|entities/[a-zA-Z_][a-zA-Z0-9_-]*)(?:\\?id=(?:op|dto|fields)-[a-f0-9]{16})?$').test(entry.path);
  };
  var normalize = function (value) { return value.normalize('NFKC').toLowerCase(); };
  var snippetSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  var searchSnippet = function (body, term) {
    if (!snippetSegmenter) return body.length <= 180 ? body : '';
    var segments = Array.from(snippetSegmenter.segment(body), function (part) { return part.segment; });
    var matchOffset = normalize(body).indexOf(term);
    var normalizedOffset = 0;
    var match = 0;
    while (match < segments.length) {
      var width = normalize(segments[match]).length;
      if (normalizedOffset + width > matchOffset) break;
      normalizedOffset += width;
      match += 1;
    }
    var start = Math.max(0, match - 50);
    var end = start + 180;
    return (start ? '…' : '') + segments.slice(start, end).join('') + (segments.length > end ? '…' : '');
  };
  var queryKey = 'aibiz.api-reference.search:' + location.pathname;
  var readQuery = function () {
    try { return (sessionStorage.getItem(queryKey) || '').slice(0, 512); } catch (_) { return ''; }
  };
  var saveQuery = function (value) {
    try { sessionStorage.setItem(queryKey, value); } catch (_) {}
  };
  var indexCache = Object.create(null);
  var loadIndex = function (language) {
    if (!indexCache[language]) {
      indexCache[language] = fetch('api-reference/' + language + '/search.json', {
        credentials: 'same-origin', redirect: 'error'
      }).then(function (response) {
        if (!response.ok) throw new Error('API search index unavailable');
        return response.json();
      }).then(function (data) {
        if (data.schemaVersion !== 2 || data.language !== language ||
            !/^[a-f0-9]{64}$/.test(data.contractSha256 || '') || !Array.isArray(data.entries) ||
            data.entries.length > 100000 ||
            !data.entries.every(function (entry) { return safeEntry(entry, language); })) {
          throw new Error('Invalid API search index');
        }
        return data.entries.map(function (entry) {
          return Object.assign({}, entry, {
            normalizedLabel: normalize(entry.label + ' ' + entry.code),
            normalizedKeywords: normalize(entry.keywords),
            normalizedBody: normalize(entry.body)
          });
        });
      }).catch(function (error) { delete indexCache[language]; throw error; });
    }
    return indexCache[language];
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
      input.maxLength = 512;
      input.value = readQuery();
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
      results.id = 'aibiz-api-search-results';
      input.setAttribute('aria-controls', results.id);
      results.style.cssText = 'margin:0;padding-left:16px;';
      panel.appendChild(results);
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.hidden = true;
      retry.setAttribute('data-aibiz-api-retry', 'true');
      safeText(retry, english ? 'Retry' : '重试');
      panel.appendChild(retry);
      root.insertBefore(panel, root.firstChild);
      var load = function () {
        retry.hidden = true;
        input.disabled = true;
        status.setAttribute('role', 'status');
        panel.setAttribute('aria-busy', 'true');
        safeText(status, english ? 'Loading API index' : '正在加载接口索引');
        loadIndex(current).then(function (entries) {
          if (generation !== active || !panel.isConnected) return;
          panel.setAttribute('aria-busy', 'false');
          input.disabled = false;
          var filter = function () {
            saveQuery(input.value);
            var term = normalize(input.value.trim());
            var terms = term.split(/\s+/);
            results.replaceChildren();
            if (!term) {
              safeText(status, entries.length + (english ? ' reference entries' : ' 条参考条目'));
              return;
            }
            var matches = entries.map(function (entry, order) {
              var combined = entry.normalizedLabel + ' ' + entry.normalizedKeywords + ' ' + entry.normalizedBody;
              if (!terms.every(function (word) { return combined.includes(word); })) return null;
              var score = terms.reduce(function (sum, word) {
                return sum + (entry.normalizedLabel.includes(word) ? 20 : 0) +
                  (entry.normalizedKeywords.includes(word) ? 5 : 0);
              }, 0) + (normalize(entry.code) === term ? 100 : 0);
              return { entry: entry, score: score, order: order };
            }).filter(Boolean).sort(function (a, b) {
              return b.score - a.score || a.order - b.order;
            });
            safeText(status, !matches.length ? (english ? 'No results' : '未找到结果') :
              matches.length + (english ? ' results' : ' 条结果') +
                (matches.length > 50 ? (english ? ' (showing 50)' : '（显示前 50 条）') : ''));
            matches.slice(0, 50).forEach(function (match) {
              var entry = match.entry;
              var item = document.createElement('li');
              var link = document.createElement('a');
              link.href = entry.path;
              safeText(link, entry.label + ' [' + entry.code + ']');
              item.appendChild(link);
              var snippet = document.createElement('p');
              snippet.className = 'aibiz-api-search-snippet';
              var body = entry.body.replace(/:id=(?:op|dto|fields)-[a-f0-9]{16}/g, '')
                .replace(/\[([^\]\n]+)\]\([^)]+\)/g, '$1')
                .replace(/[`#|]/g, ' ').replace(/-{3,}/g, ' ').replace(/\s+/g, ' ').trim();
              var preview = searchSnippet(body, terms[0]);
              if (preview) {
                safeText(snippet, preview);
                item.appendChild(snippet);
              }
              results.appendChild(item);
            });
          };
          input.oninput = filter;
          var composing = false;
          input.addEventListener('compositionstart', function () { composing = true; });
          input.addEventListener('compositionend', function () { composing = false; filter(); });
          input.onkeydown = function (event) {
            if (composing || event.isComposing || event.keyCode === 229) return;
            if ((event.key === 'Enter' || event.key === 'ArrowDown') && results.querySelector('a')) {
              event.preventDefault();
              if (event.key === 'Enter') results.querySelector('a').click();
              else results.querySelector('a').focus();
            }
          };
          filter();
        }).catch(function () {
          if (generation !== active || !panel.isConnected) return;
          safeText(status, english ? 'API search index unavailable' : '接口搜索索引不可用');
          status.setAttribute('role', 'alert');
          panel.setAttribute('aria-busy', 'false');
          retry.hidden = false;
        });
      };
      retry.addEventListener('click', load);
      load();
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
