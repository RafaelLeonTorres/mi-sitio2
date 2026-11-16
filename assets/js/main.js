/* Rafael León — interacciones del sitio (sin dependencias) */
(function () {
  'use strict';

  var root = document.documentElement;
  var lang = root.getAttribute('lang') || 'es';

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* almacenamiento no disponible */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /* Idioma: ?lang=en (enlaces antiguos) lleva a la versión en inglés */
  var params = new URLSearchParams(window.location.search);
  var langSwitch = document.querySelector('.lang-switch');
  if (params.get('lang') === 'en' && lang !== 'en' && langSwitch) {
    window.location.replace(langSwitch.href + window.location.hash);
    return;
  }

  document.querySelectorAll('a[data-lang]').forEach(function (link) {
    link.addEventListener('click', function () { store('idioma', link.getAttribute('data-lang')); });
  });

  /* Aviso discreto para visitantes con el navegador en otro idioma */
  var banner = document.getElementById('lang-banner');
  if (banner && !read('idioma')) {
    var browserLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
    if (!/^es\b/i.test(browserLang)) {
      banner.hidden = false;
      var close = banner.querySelector('.banner-close');
      if (close) {
        close.addEventListener('click', function () {
          banner.hidden = true;
          store('idioma', 'es');
        });
      }
    }
  }

  /* Tema claro / oscuro */
  var themeButton = document.querySelector('.theme-toggle');
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }
  function syncThemeButton() {
    if (!themeButton) return;
    var isDark = currentTheme() === 'dark';
    themeButton.setAttribute('aria-label', isDark ? themeButton.dataset.labelLight : themeButton.dataset.labelDark);
  }
  if (themeButton) {
    syncThemeButton();
    themeButton.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store('tema', next);
      syncThemeButton();
    });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', syncThemeButton);
  }

  /* Menú en pantallas pequeñas */
  var navToggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('menu-principal');
  function setMenu(open) {
    if (!navToggle || !nav) return;
    navToggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        navToggle.focus();
      }
    });
  }

  /* Sección activa en el menú (solo en la página de inicio) */
  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a[data-section]'));
  var sections = sectionLinks
    .map(function (link) { return document.getElementById(link.getAttribute('data-section')); })
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach(function (link) {
          if (link.getAttribute('data-section') === entry.target.id) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* Botón "Copiar" en los bloques de código */
  var copyLabel = lang === 'en' ? 'Copy' : 'Copiar';
  var copiedLabel = lang === 'en' ? 'Copied' : 'Copiado';
  if (navigator.clipboard) {
    document.querySelectorAll('.post-content pre').forEach(function (pre) {
      var holder = pre.parentElement;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-btn';
      button.textContent = copyLabel;
      button.setAttribute('aria-live', 'polite');
      button.addEventListener('click', function () {
        var code = pre.querySelector('code') || pre;
        navigator.clipboard.writeText(code.innerText.replace(/\n$/, '')).then(function () {
          button.textContent = copiedLabel;
          button.classList.add('is-done');
          window.setTimeout(function () {
            button.textContent = copyLabel;
            button.classList.remove('is-done');
          }, 1800);
        });
      });
      holder.appendChild(button);
    });
  }
})();
