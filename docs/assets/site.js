// Volux — shared site behavior
// Loaded with `defer` on every page; all handlers gate on element presence.
(function () {
  'use strict';

  // ---- Reveal-on-scroll (homepage uses; no-op on pages without .reveal) ----
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (rm.matches) {
      reveals.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  // ---- Mobile nav dropdown ----
  var navToggle = document.querySelector('[data-nav-toggle]');
  var navMenu = document.querySelector('[data-nav-menu]');
  var navOpenIcon = document.querySelector('[data-nav-icon-open]');
  var navCloseIcon = document.querySelector('[data-nav-icon-close]');
  if (navToggle && navMenu) {
    var closeNav = function () {
      navMenu.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      if (navOpenIcon) navOpenIcon.style.display = '';
      if (navCloseIcon) navCloseIcon.style.display = 'none';
    };
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (navOpenIcon) navOpenIcon.style.display = open ? 'none' : '';
      if (navCloseIcon) navCloseIcon.style.display = open ? '' : 'none';
    });
    navMenu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeNav();
    });
    document.addEventListener('click', function (e) {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
  }

  // ---- Language-picker dropdown ----
  var btn = document.querySelector('[data-lang-btn]');
  var menu = document.querySelector('[data-lang-menu]');
  if (btn && menu) {
    var closeLang = function () {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    };
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!btn.contains(e.target) && !menu.contains(e.target)) closeLang();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLang();
    });
  }

  // ---- Language-suggestion banner (English root only) ----
  (function () {
    var path = window.location.pathname;
    if (path !== '/' && path !== '/index.html') return;

    try { if (localStorage.getItem('volux-lang-dismissed') === '1') return; } catch (e) {}

    var SUGG = {
      vi: { path: '/vi/', msg: 'Trang này cũng có bằng tiếng Việt.',               view: 'Xem tiếng Việt',    close: 'Đóng' },
      zh: { path: '/zh/', msg: '本页面提供简体中文版本。',                           view: '查看中文',            close: '关闭' },
      es: { path: '/es/', msg: 'Esta página también está disponible en español.',  view: 'Ver en español',    close: 'Cerrar' },
      pt: { path: '/pt/', msg: 'Esta página também está disponível em português.', view: 'Ver em português',  close: 'Fechar' },
      ja: { path: '/ja/', msg: 'このページは日本語でもご覧いただけます。',             view: '日本語で見る',       close: '閉じる' }
    };

    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ''];

    var match = null;
    for (var i = 0; i < langs.length; i++) {
      var primary = (langs[i] || '').toLowerCase().split('-')[0];
      if (primary === 'en') return;
      if (SUGG[primary]) { match = SUGG[primary]; break; }
    }
    if (!match) return;

    var el = document.createElement('aside');
    el.className = 'lang-suggest';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="msg"></span>' +
      '<a class="view" href="' + match.path + '"></a>' +
      '<button class="close" type="button" aria-label=""></button>';
    el.querySelector('.msg').textContent = match.msg;
    el.querySelector('.view').textContent = match.view;
    var closeBtn = el.querySelector('.close');
    closeBtn.textContent = '\u2715';
    closeBtn.setAttribute('aria-label', match.close);

    closeBtn.addEventListener('click', function () {
      try { localStorage.setItem('volux-lang-dismissed', '1'); } catch (e) {}
      el.remove();
    });
    el.querySelector('.view').addEventListener('click', function () {
      try { localStorage.setItem('volux-lang-dismissed', '1'); } catch (e) {}
    });

    document.body.appendChild(el);
  })();
})();
