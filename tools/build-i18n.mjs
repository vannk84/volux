#!/usr/bin/env node
// Zero-dependency i18n build for the Volux marketing site.
// Reads docs/_template.html + docs/_i18n/{code}.json and emits
// docs/index.html (default locale) + docs/{code}/index.html (others).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOCS = join(ROOT, 'docs');
const I18N = join(DOCS, '_i18n');
const TEMPLATE = join(DOCS, '_template.html');

const OG_LOCALE_MAP = { en: 'en_US', vi: 'vi_VN', zh: 'zh_CN', ja: 'ja_JP', es: 'es_ES', pt: 'pt_BR', fr: 'fr_FR', de: 'de_DE', ko: 'ko_KR' };

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Resolve dotted path: "hero.eyebrow" → obj.hero.eyebrow
function resolve_path(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Build repeating-section HTML fragments
function renderFragments(data) {
  const frags = {};

  // Features (6 items, 3-column grid of <article class="feat">)
  const featIcons = [
    '<svg class="feat-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 26V10l12 6-12 10z"/><path d="M6 6h20" stroke-dasharray="2 3"/></svg>',
    '<svg class="feat-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="6" width="8" height="20"/><rect x="14" y="10" width="8" height="16"/><rect x="24" y="14" width="4" height="12"/></svg>',
    '<svg class="feat-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 16h4l4-10 8 20 4-10h4"/></svg>',
    '<svg class="feat-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12v8h5l8 6V6l-8 6H4z"/><path d="M24 10l6 12M30 10L24 22" /></svg>',
    '<svg class="feat-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M16 8v8l6 3"/></svg>',
    '<svg class="feat-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M18 4l-10 16h8l-2 8 10-16h-8z"/></svg>',
  ];
  frags.features_items_html = data.features.items.map((it, i) => {
    const num = String(i + 1).padStart(2, '0');
    const d = (i % 5) + 1;
    return `          <article class="feat reveal" data-d="${d}">
            <div class="feat-num">/ ${num}</div>
            ${featIcons[i] || featIcons[0]}
            <h3>${it.title}</h3>
            <p>${it.body}</p>
          </article>`;
  }).join('\n');

  // Per-tab list
  frags.pertab_list_html = data.pertab.list.map(it =>
`            <li>
              <span class="k">${it.k}</span>
              <span class="v">${it.v_html}</span>
            </li>`).join('\n');

  // Use cases
  frags.usecases_items_html = data.usecases.items.map((it, i) => {
    const d = (i % 3) + 1;
    return `          <article class="uc reveal" data-d="${d}">
            <span class="tag">${it.tag}</span>
            <h3>${it.title}</h3>
            <p>${it.body}</p>
          </article>`;
  }).join('\n');

  // How it works (3 steps)
  frags.steps_html = data.how.steps.map((it, i) =>
`          <article class="step reveal" data-d="${i + 1}">
            <span class="step-num">${i + 1}</span>
            <h3>${it.title}</h3>
            <p>${it.body}</p>
          </article>`).join('\n');

  // Gallery (3 images — fixed URLs)
  const galleryImgs = [
    'https://raw.githubusercontent.com/vannk84/volux/main/marketing/generated/popup-pro-expanded.png',
    'https://raw.githubusercontent.com/vannk84/volux/main/marketing/generated/popup-pro-collapsed.png',
    'https://raw.githubusercontent.com/vannk84/volux/main/marketing/generated/popup-upgrade-modal.png',
  ];
  frags.gallery_items_html = data.gallery.items.map((it, i) =>
`          <article class="gcard reveal" data-d="${i + 1}">
            <div class="gcard-img">
              <img src="${galleryImgs[i]}" alt="${it.alt}" width="600" height="450" loading="lazy" decoding="async">
            </div>
            <div class="gcard-body">
              <h3>${it.title}</h3>
              <p>${it.body}</p>
            </div>
          </article>`).join('\n');

  // Pricing bullet lists
  frags.pricing_free_list_html = data.pricing.free.list.map(li =>
    `              <li>${li}</li>`).join('\n');
  frags.pricing_pro_list_html = data.pricing.pro.list.map(li =>
    `              <li>${li}</li>`).join('\n');

  // FAQ accordion items
  frags.faq_items_html = data.faq.items.map(it =>
`          <details class="qa reveal">
            <summary>${it.q}</summary>
            <div class="qa-body">${it.a}</div>
          </details>`).join('\n');

  return frags;
}

function renderSchema(data) {
  return {
    schema_app_description_json:     JSON.stringify(data.schema.app_description),
    schema_webapp_description_json:  JSON.stringify(data.schema.webapp_description),
    schema_video_description_json:   JSON.stringify(data.schema.video_description),
    schema_feature_list_json:        JSON.stringify(data.schema.feature_list, null, 2).replace(/\n/g, '\n    '),
    schema_faq_json: JSON.stringify(
      data.schema.faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
      null, 2
    ).replace(/\n/g, '\n    '),
  };
}

function renderHreflang(locales, siteUrl) {
  const defaultLoc = locales.find(l => l.default) || locales[0];
  const lines = locales.map(l =>
    `  <link rel="alternate" hreflang="${l.hreflang}" href="${siteUrl}${l.path}">`
  );
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${siteUrl}${defaultLoc.path}">`);
  return lines.join('\n');
}

function renderTopLangMenu(locales, activeCode) {
  return locales.map(l => {
    const label = l.native;
    const hl = l.hreflang;
    if (l.code === activeCode) {
      return `            <span class="active" role="option" aria-selected="true" aria-current="page" lang="${hl}"><span>${label}</span><span class="hreflang">${hl}</span></span>`;
    }
    return `            <a href="${l.path}" role="option" lang="${hl}" hreflang="${hl}"><span>${label}</span><span class="hreflang">${hl}</span></a>`;
  }).join('\n');
}

const LANG_ARIA_TEXT = {
  en: 'Choose language',
  vi: 'Chọn ngôn ngữ',
  zh: '选择语言',
  es: 'Elegir idioma',
  pt: 'Escolher idioma',
  ja: '言語を選択',
  fr: 'Choisir la langue',
  de: 'Sprache wählen',
  ko: '언어 선택',
};

// Apply {{path}} substitutions. Leaves unknown placeholders intact and warns.
function applyTemplate(tpl, ctx) {
  return tpl.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => {
    const val = resolve_path(ctx, key);
    if (val == null) {
      console.warn(`  ! unresolved placeholder: {{${key}}}`);
      return `{{${key}}}`;
    }
    return String(val);
  });
}

// --- Main ---
function main() {
  const config = loadJSON(join(I18N, '_config.json'));
  const template = readFileSync(TEMPLATE, 'utf8');
  const hreflangHtml = renderHreflang(config.locales, config.site_url);

  console.log(`Building ${config.locales.length} locale(s)…`);

  for (const loc of config.locales) {
    const data = loadJSON(join(I18N, `${loc.code}.json`));
    const frags = renderFragments(data);
    const schema = renderSchema(data);
    const ctx = {
      ...data,
      ...frags,
      ...schema,
      canonical_url:     config.site_url + loc.path,
      lang_root:         loc.path,
      og_locale:         OG_LOCALE_MAP[loc.code] || `${loc.code}_${loc.code.toUpperCase()}`,
      hreflang_html:         hreflangHtml,
      top_lang_switch_html:  renderTopLangMenu(config.locales, loc.code),
      lang_active_code:      loc.code.toUpperCase(),
      lang_aria:             LANG_ARIA_TEXT[loc.code] || 'Choose language',
    };

    const html = applyTemplate(template, ctx);

    const outPath = loc.default
      ? join(DOCS, 'index.html')
      : join(DOCS, loc.code, 'index.html');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');

    const size = (html.length / 1024).toFixed(1);
    console.log(`  ✓ ${loc.code.padEnd(3)} → ${outPath.replace(ROOT + '/', '')}  (${size} KB)`);
  }

  console.log('Done.');
}

main();
