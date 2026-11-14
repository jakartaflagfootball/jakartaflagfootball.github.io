// i18n.js — English / Bahasa Indonesia switch for the JFF site.
//
// English stays in the HTML as written. When Indonesian is chosen, this script swaps
// every piece of text it finds in lang/id.js (exact English text → Indonesian), including
// text that pages add later with JavaScript. Text with no translation stays in English.
//
// Include in <head>, after lang/id.js:
//   <script src="lang/id.js"></script>
//   <script src="i18n.js"></script>
//
// Mark anything that must never be translated with translate="no".
// A link can force a language with ?lang=id or ?lang=en.
(function () {
  var STORE = 'jff-lang';
  var src = window.JFF_ID || {};
  var dict = src.text || {};
  var patterns = src.patterns || [];
  var has = Object.prototype.hasOwnProperty;

  function read() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(STORE, v); } catch (e) {} }

  var param = null;
  try { param = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (param !== 'id' && param !== 'en') param = null;
  if (param) write(param);
  var lang = param || read() || (/^(id|in)\b/i.test(navigator.language || '') ? 'id' : 'en');
  document.documentElement.lang = lang;

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  // Translate one string. Returns null when there's no translation.
  function lookup(s) {
    var k = norm(s);
    if (!k) return null;
    if (has.call(dict, k)) return dict[k];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (p[0].test(k)) return k.replace(p[0], p[1]);
    }
    return null;
  }
  // For page scripts: t('English') → Indonesian when ID is on, otherwise unchanged.
  function t(s) {
    if (lang !== 'id') return s;
    var out = lookup(s);
    return out == null ? s : out;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, SVG: 1, svg: 1, CANVAS: 1, IFRAME: 1 };
  var INLINE = { B: 1, STRONG: 1, EM: 1, I: 1, A: 1, SPAN: 1, BR: 1, CODE: 1, SMALL: 1 };
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];

  // An element whose children are only text and inline tags (<b>, <a>, <br> …) is
  // translated as a whole, so a sentence with a link in the middle reads naturally.
  function isRich(el) {
    var kids = el.children;
    if (!kids.length) return false;
    for (var i = 0; i < kids.length; i++) if (!INLINE[kids[i].tagName]) return false;
    return true;
  }

  function translateText(node) {
    var v = node.nodeValue;
    var out = lookup(v);
    if (out == null) return;
    node.nodeValue = v.match(/^\s*/)[0] + out + v.match(/\s*$/)[0];
  }

  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a) { var out = lookup(a); if (out != null) el.setAttribute(ATTRS[i], out); }
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { translateText(node); return; }
    if (node.nodeType !== 1 || SKIP[node.tagName] || node.getAttribute('translate') === 'no') return;
    translateAttrs(node);
    if (isRich(node)) {
      var html = node.innerHTML;
      if (html.length < 4000) {
        var out = lookup(html);
        if (out != null) { node.innerHTML = out; return; }
      }
    }
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function translateHead() {
    var title = lookup(document.title);
    if (title != null) document.title = title;
    var metas = document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"]');
    for (var i = 0; i < metas.length; i++) {
      var out = lookup(metas[i].getAttribute('content') || '');
      if (out != null) metas[i].setAttribute('content', out);
    }
  }

  // ─── Language switch in the nav bar ───
  function addToggle() {
    var nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.lang-toggle')) return;
    var box = document.createElement('div');
    box.className = 'lang-toggle';
    box.setAttribute('translate', 'no');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language / Bahasa');
    ['en', 'id'].forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = code.toUpperCase();
      b.setAttribute('aria-pressed', String(code === lang));
      b.title = code === 'en' ? 'English' : 'Bahasa Indonesia';
      if (code === lang) b.className = 'on';
      b.addEventListener('click', function () { setLang(code); });
      box.appendChild(b);
    });
    var burger = nav.querySelector('.nav-burger');
    if (burger) nav.insertBefore(box, burger); else nav.appendChild(box);
  }

  function setLang(code) {
    if (code === lang) return;
    write(code);
    try { if (window.gtag) gtag('event', 'language_switch', { language: code }); } catch (e) {}
    var url = new URL(location.href);
    url.searchParams.delete('lang');
    location.replace(url.toString());
  }

  var css = document.createElement('style');
  css.textContent =
    'html.i18n-wait body{visibility:hidden}' +
    '.nav .nav-links{margin-left:auto}' +
    '.lang-toggle{display:flex;border:1px solid #2e2e2e;border-radius:4px;overflow:hidden;flex-shrink:0;margin-left:1.25rem}' +
    '.lang-toggle button{background:none;border:0;color:#888;font:600 .7rem/1 "DM Sans",sans-serif;letter-spacing:.1em;padding:.45rem .55rem;cursor:pointer}' +
    '.lang-toggle button:hover{color:#f2f2f2}' +
    '.lang-toggle button.on{background:#c0392b;color:#fff}' +
    '@media (max-width:1240px){.nav .lang-toggle{margin-left:auto;margin-right:.75rem}}';
  document.head.appendChild(css);

  if (lang === 'id') {
    document.documentElement.classList.add('i18n-wait');
    // Never leave the page hidden, even if something below throws.
    setTimeout(function () { document.documentElement.classList.remove('i18n-wait'); }, 2500);
  }

  document.addEventListener('DOMContentLoaded', function () {
    addToggle();
    if (lang === 'id') {
      try {
        translateHead();
        walk(document.body);
        new MutationObserver(function (list) {
          for (var i = 0; i < list.length; i++) {
            var added = list[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
              var n = added[j];
              // Skip text inside an element we already handle as a whole.
              if (n.nodeType === 3 && n.parentNode && isRich(n.parentNode)) { walk(n.parentNode); continue; }
              walk(n);
            }
          }
        }).observe(document.body, { childList: true, subtree: true });
      } finally {
        document.documentElement.classList.remove('i18n-wait');
      }
    }
  });

  window.JFFI18N = { lang: lang, t: t, setLang: setLang, lookup: lookup, norm: norm };
})();
