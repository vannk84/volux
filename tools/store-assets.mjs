// Store + website marketing assets for Volux (v2: one-click add, free scan,
// per-tab Pro, $3.99 pricing).
//
//   node tools/store-assets.mjs            # stills + video frames
//   node tools/store-assets.mjs --stills   # only screenshots / tiles
//   node tools/store-assets.mjs --video    # only video frames (then run tools/build-store-video.sh)
//
// Every popup state is the real popup/popup.html driven by tools/mock-runtime.js
// with a staged scenario, so what you see is what the extension renders.
// Output: marketing/v2/{store,web,frames}
//
// Prices shown are the planned 1.0.10 price ($3.99, pay what you want from
// $2.99, tax included). Don't publish these before that release ships.
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const POPUP_URL = `file://${resolve(ROOT, 'popup/popup.html')}`;
const MOCK_JS = readFileSync(resolve(__dirname, 'mock-runtime.js'), 'utf8');
const OUT = resolve(ROOT, 'marketing', 'v2');
const STORE = resolve(OUT, 'store');
const WEB = resolve(OUT, 'web');
const FRAMES = resolve(OUT, 'frames');
const ICON = 'data:image/png;base64,' + readFileSync(resolve(ROOT, 'icons/icon128.png')).toString('base64');

const ONLY_STILLS = process.argv.includes('--stills');
const ONLY_VIDEO = process.argv.includes('--video');

const PRICE = {
  amount: '$3.99',
  banner: '$3.99, or pay what you want from $2.99',
  checkout: 'Secure checkout, card or PayPal. Tax included.',
};

// Popup is captured at a fixed 380×600 so every frame of a scene has the same
// size (ffmpeg overlays need that) and stills line up across slides.
const POPUP_W = 380;
const POPUP_H = 600;
const DPR = 2;

// ── Scenarios ───────────────────────────────────────────────────────────────
const fav = (d) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
const tab = (id, domain, title, extra = {}) => ({
  id, title, url: `https://${domain}/`, favIconUrl: fav(domain),
  audible: false, hasAudio: true, hasOverride: false, volume: 100, muted: false, ...extra,
});
const site = (domain, volume, tabs, extra = {}) => ({
  origin: `https://${domain}`, domain, volume, muted: false,
  audible: tabs.some(t => t.audible), favIconUrl: fav(domain),
  tabs: tabs.map(t => ({ ...t, volume: t.hasOverride ? t.volume : volume })), ...extra,
});

const SCENARIOS = {
  perSite: (v = { yt: 30, sp: 60, zm: 100 }) => ({
    license: { isPro: true }, freeLimit: 2, activeTabId: 11,
    domains: [
      site('youtube.com', v.yt, [tab(11, 'www.youtube.com', 'Lo-fi beats to study to', { audible: true })]),
      site('spotify.com', v.sp, [tab(12, 'open.spotify.com', 'Daily Mix 1 · Spotify', { audible: true })]),
      site('zoom.us', v.zm, [tab(13, 'app.zoom.us', 'Zoom Meeting')]),
    ],
  }),
  quickAdd: () => ({
    license: { isPro: false }, freeLimit: 2, activeTabId: 31,
    domains: [site('youtube.com', 30, [tab(21, 'www.youtube.com', 'Lo-fi beats to study to')])],
    openTabs: [tab(31, 'www.twitch.tv', 'Live: speedrun marathon', { audible: true })],
  }),
  scan: () => ({
    license: { isPro: true }, freeLimit: 2, activeTabId: 41,
    domains: [site('youtube.com', 30, [tab(41, 'www.youtube.com', 'Lo-fi beats to study to')])],
    openTabs: [
      tab(51, 'www.tiktok.com', 'TikTok', { media: true }),
      tab(52, 'soundcloud.com', 'SoundCloud', { media: true }),
      tab(53, 'docs.google.com', 'Untitled document'),
    ],
  }),
  perTab: (v = [70, 15, 40]) => ({
    license: { isPro: true }, freeLimit: 2, activeTabId: 61,
    domains: [
      site('youtube.com', 40, [
        tab(61, 'www.youtube.com', 'Cinematic western score', { audible: true, hasOverride: v[0] !== 40, volume: v[0] }),
        tab(62, 'www.youtube.com', 'Audiobook: The Old Man and the Sea', { audible: true, hasOverride: v[1] !== 40, volume: v[1] }),
        tab(63, 'www.youtube.com', 'Space documentary', { audible: true, hasOverride: v[2] !== 40, volume: v[2] }),
      ]),
      site('spotify.com', 60, [tab(64, 'open.spotify.com', 'Daily Mix 1 · Spotify')]),
    ],
  }),
  pricing: () => ({
    license: { isPro: false }, freeLimit: 2, activeTabId: 71,
    domains: [
      site('youtube.com', 30, [tab(71, 'www.youtube.com', 'Lo-fi beats to study to', { audible: true })]),
      site('spotify.com', 60, [tab(72, 'open.spotify.com', 'Daily Mix 1 · Spotify')]),
    ],
  }),
};

// ── Browser helpers ─────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function openPopup(state) {
  const page = await browser.newPage();
  await page.setViewport({ width: POPUP_W, height: POPUP_H, deviceScaleFactor: DPR });
  await page.evaluateOnNewDocument(`window.__VOLUX_MOCK_STATE__ = ${JSON.stringify(state)};`);
  await page.evaluateOnNewDocument(MOCK_JS);
  await page.goto(POPUP_URL, { waitUntil: 'networkidle0' });
  await sleep(400);
  // Stop the popup's 2s auto-refresh: scripted interactions re-render explicitly.
  await page.evaluate(() => { for (let i = 0; i < 9999; i++) clearInterval(i); });
  await applyPricing(page);
  return page;
}

// Show the planned 1.0.10 price/checkout copy instead of today's $2 text.
async function applyPricing(page) {
  await page.evaluate((P) => {
    const banner = document.querySelector('.upgrade-banner .upgrade-note');
    if (banner) banner.textContent = P.banner;
    const desc = document.querySelector('.modal-desc');
    if (desc) desc.innerHTML = `Unlock unlimited domains and per-tab volume control for <strong>${P.amount}</strong>, or pay what you want from $2.99.`;
    const buy = document.getElementById('buyBtn');
    if (buy) buy.textContent = `Get Pro - ${P.amount}`;
    const note = document.querySelector('.modal .upgrade-note');
    if (note) note.textContent = P.checkout;
  }, PRICE);
}

const popupShot = (page, path, height = POPUP_H) =>
  page.screenshot({ path, clip: { x: 0, y: 0, width: POPUP_W, height } });

// Real rendered height of the popup (stills are cropped to it, no dead space).
const popupHeight = (page) => page.evaluate((max) => {
  const modal = document.querySelector('.modal-overlay.active');
  if (modal) return max;
  const r = document.getElementById('container').getBoundingClientRect();
  return Math.min(max, Math.ceil(r.bottom));
}, POPUP_H);

// Bounding box of a popup element, in popup CSS px (for the annotation arrow).
const boxOf = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}, selector);

async function dragSlider(page, selector, to, snap, frames) {
  const from = await page.evaluate((s) => parseInt(document.querySelector(s).value, 10), selector);
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const eased = 1 - Math.pow(1 - t, 3);
    const v = Math.round(from + (to - from) * eased);
    await page.evaluate((s, val) => {
      const el = document.querySelector(s);
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, selector, v);
    if (snap) await snap();
  }
}

const sliderOf = (domain) => `.tab-item[data-origin="https://${domain}"] .volume-slider`;
const perTabSlider = (id) => `.per-tab-slider[data-tab-id="${id}"]`;

// ── Stage (slide) rendering ─────────────────────────────────────────────────
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">`;
const TOKENS = `--paper:#F3EEE5;--paper-2:#EBE2D0;--ink:#141210;--ink-2:#3A342C;--ink-3:#6E675C;--amber:#D9A441;--vermilion:#E03C1A;`;

const b64 = (path) => 'data:image/png;base64,' + readFileSync(path).toString('base64');

// A slide: headline + one line of copy on the left, the popup on an ink slab
// on the right, and (optionally) one amber callout that points at the exact UI
// element the slide is about. `popup` may be null (video backgrounds).
function slideHTML({ w, h, title, body, popup, callout, scale, foot = true, popupH = POPUP_H, titleSize = 0.08 }) {
  const slabW = Math.round(POPUP_W * scale + 72);
  const slabH = Math.round(Math.min(h - 96, popupH * scale + 72));
  const slabX = w - slabW - Math.round(w * 0.075);
  const slabY = Math.round((h - slabH) / 2);
  const popX = slabX + Math.round((slabW - POPUP_W * scale) / 2);
  const popY = slabY + 36;
  // Leave room for the callout pill between the copy and the slab.
  const colW = slabX - Math.round(w * 0.075) - (callout ? 230 : 56);
  let calloutHTML = '';
  if (callout && popup) {
    // Amber outline around the exact element; the leader stops at its edge so
    // it never crosses the UI it's pointing at.
    const pad = 6;
    const rx = popX + callout.box.x * scale - pad;
    const ry = popY + callout.box.y * scale - pad;
    const rw = callout.box.w * scale + pad * 2;
    const rh = callout.box.h * scale + pad * 2;
    const ty = ry + rh / 2;
    const lx = slabX - 28;
    calloutHTML = `
      <div class="callout" style="right:${w - lx}px;top:${ty - 22}px">${callout.label}</div>
      <svg class="leader" width="${w}" height="${h}">
        <path d="M ${lx} ${ty} L ${rx} ${ty}" />
        <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="12" /></svg>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  :root{${TOKENS}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${w}px;height:${h}px;background:var(--paper);color:var(--ink);font-family:'IBM Plex Sans',sans-serif;position:relative;overflow:hidden}
  .copy{position:absolute;left:${Math.round(w * 0.075)}px;top:0;bottom:0;width:${colW}px;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(h * 0.03)}px}
  h1{font-family:'Fraunces',serif;font-weight:600;font-size:${Math.round(h * titleSize)}px;line-height:1.04;letter-spacing:-0.015em;font-variation-settings:'opsz' 144;text-wrap:balance}
  p{font-size:${Math.round(h * 0.028)}px;line-height:1.5;color:var(--ink-2);max-width:30ch;text-wrap:pretty}
  .foot{position:absolute;left:${Math.round(w * 0.075)}px;bottom:${Math.round(h * 0.07)}px;display:flex;align-items:center;gap:12px;font-weight:600;font-size:${Math.round(h * 0.022)}px;color:var(--ink-2)}
  .foot img{width:${Math.round(h * 0.04)}px;height:${Math.round(h * 0.04)}px;border-radius:8px}
  .foot span{font-weight:400;color:var(--ink-3)}
  .slab{position:absolute;left:${slabX}px;top:${slabY}px;width:${slabW}px;height:${slabH}px;background:var(--ink);border-radius:28px;box-shadow:0 2px 0 rgba(20,18,16,.18),0 40px 60px -24px rgba(20,18,16,.45);overflow:hidden}
  .pop{position:absolute;left:${popX}px;top:${popY}px;width:${POPUP_W * scale}px;border-radius:14px;overflow:hidden;clip-path:inset(0 0 ${Math.max(0, popupH * scale - (slabH - 36))}px 0 round 14px)}
  .pop img{display:block;width:100%}
  .callout{position:absolute;background:var(--amber);color:var(--ink);font-weight:600;font-size:${Math.round(h * 0.024)}px;padding:10px 18px;border-radius:999px;white-space:nowrap}
  .leader{position:absolute;inset:0;pointer-events:none}
  .leader path{stroke:var(--amber);stroke-width:3;fill:none}
  .leader rect{fill:none;stroke:var(--amber);stroke-width:3}
  </style></head><body>
  <div class="copy"><h1>${title}</h1>${body ? `<p>${body}</p>` : ''}</div>
  ${foot ? `<div class="foot"><img src="${ICON}" alt="">Volux <span>for Chrome &amp; Firefox</span></div>` : ''}
  <div class="slab"></div>
  ${popup ? `<div class="pop"><img src="${popup}"></div>` : ''}
  ${calloutHTML}
  </body></html>`;
}

async function renderHTML(html, w, h, path) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path });
  await page.close();
}

// Where the popup lands on a slide (video overlay needs the same math).
function popupPlacement(w, h, scale) {
  const slabW = Math.round(POPUP_W * scale + 72);
  const slabH = Math.round(Math.min(h - 96, POPUP_H * scale + 72));
  const slabX = w - slabW - Math.round(w * 0.075);
  const slabY = Math.round((h - slabH) / 2);
  return {
    x: slabX + Math.round((slabW - POPUP_W * scale) / 2),
    y: slabY + 36,
    w: Math.round(POPUP_W * scale),
    visibleH: Math.min(Math.round(POPUP_H * scale), slabH - 36),
  };
}

// ── Slides ──────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1-per-site', state: SCENARIOS.perSite(),
    title: 'Every website keeps its own volume.',
    body: 'YouTube at 30%, Spotify at 60%, Zoom at 100%. Set it once and Volux re-applies it on every visit.',
    callout: { selector: '.tab-item .volume-slider', label: 'Saved per site' },
  },
  {
    id: '2-one-click', state: SCENARIOS.quickAdd(),
    title: 'Add the site you’re on in one click.',
    body: 'No typing web addresses. Open Volux on any tab and press “Control this site”.',
    callout: { selector: '.quick-add-btn', label: 'One click' },
  },
  {
    id: '3-scan', state: SCENARIOS.scan(),
    title: 'Scan your tabs, add every media site.',
    body: 'One button finds YouTube, TikTok, SoundCloud and more in your open tabs.',
    callout: { selector: '#scanTabsBtn', label: 'Scan open tabs' },
    after: async (page) => { await page.click('#scanTabsBtn'); await sleep(500); },
  },
  {
    id: '4-per-tab', state: SCENARIOS.perTab(),
    title: 'Pro: give every tab its own volume.',
    body: 'Three YouTube tabs, three levels. Music loud, audiobook quiet, documentary in between.',
    callout: { selector: '.per-tab-row', label: 'Per tab' },
    after: async (page) => { await page.click('.tab-count-btn'); await sleep(500); },
  },
  {
    id: '5-pricing', state: SCENARIOS.pricing(),
    title: `Free for 2 sites. Pro is ${PRICE.amount}, once.`,
    body: 'No subscription and tax included. Volux collects no data, and it is open source.',
    callout: { selector: '#buyBtn', label: 'Pay once' },
    after: async (page) => { await page.click('#upgradeBtn'); await sleep(400); await applyPricing(page); },
  },
];

async function stills() {
  for (const dir of [STORE, WEB]) mkdirSync(dir, { recursive: true });
  for (const s of SLIDES) {
    const page = await openPopup(s.state);
    if (s.after) await s.after(page);
    const raw = resolve(WEB, `popup-${s.id}.png`);
    const popupH = await popupHeight(page);
    await popupShot(page, raw, popupH);
    const box = s.callout ? await boxOf(page, s.callout.selector) : null;
    await page.close();
    const popup = b64(raw);
    const callout = box ? { box, label: s.callout.label } : null;
    await renderHTML(slideHTML({ w: 1280, h: 800, title: s.title, body: s.body, popup, callout, scale: 1.12, popupH }),
      1280, 800, resolve(STORE, `screenshot-${s.id}-1280x800.png`));
    console.log('slide', s.id);
  }

  // Marquee 1400×560 and small tile 440×280 for the Chrome Web Store.
  const hero = b64(resolve(WEB, 'popup-4-per-tab.png'));
  await renderHTML(slideHTML({ w: 1400, h: 560, title: 'Volume, remembered for every site and every tab.',
    body: null, popup: hero, callout: null, scale: 0.78, titleSize: 0.12 }), 1400, 560, resolve(STORE, 'marquee-1400x560.png'));
  await renderHTML(tileHTML(), 440, 280, resolve(STORE, 'promo-tile-440x280.png'));
  console.log('marquee + tile');
}

function tileHTML() {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  :root{${TOKENS}}*{margin:0;padding:0;box-sizing:border-box}
  body{width:440px;height:280px;background:var(--ink);color:var(--paper);font-family:'IBM Plex Sans',sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 36px;gap:14px}
  .brand{display:flex;align-items:center;gap:12px;font-family:'Fraunces',serif;font-weight:600;font-size:34px}
  .brand img{width:44px;height:44px;border-radius:10px}
  h1{font-family:'Fraunces',serif;font-weight:500;font-size:25px;line-height:1.15;color:var(--paper);text-wrap:balance}
  .bar{height:6px;border-radius:3px;background:rgba(243,238,229,.14);position:relative;width:100%}
  .bar i{position:absolute;inset:0 70% 0 0;background:var(--amber);border-radius:3px}
  </style></head><body>
  <div class="brand"><img src="${ICON}" alt="">Volux</div>
  <h1>Every website keeps its own&nbsp;volume.</h1>
  <div class="bar"><i></i></div>
  </body></html>`;
}

// ── Video frames ────────────────────────────────────────────────────────────
// 1280×720 slides; each scene = one background PNG + a numbered popup frame
// sequence overlaid by tools/build-store-video.sh. FPS must match that script.
const FPS = 24;
const VW = 1280, VH = 720, VSCALE = 0.98;

async function videoFrames() {
  if (existsSync(FRAMES)) rmSync(FRAMES, { recursive: true });
  mkdirSync(FRAMES, { recursive: true });
  const scenes = [];

  async function scene(id, title, body, state, script) {
    const dir = resolve(FRAMES, id);
    mkdirSync(dir, { recursive: true });
    await renderHTML(slideHTML({ w: VW, h: VH, title, body, popup: null, callout: null, scale: VSCALE }),
      VW, VH, resolve(dir, 'bg.png'));
    const page = await openPopup(state);
    let n = 0;
    const events = [];
    const snap = async () => popupShot(page, resolve(dir, `${String(n++).padStart(4, '0')}.png`));
    const hold = async (sec) => { for (let i = 0; i < Math.round(sec * FPS); i++) await snap(); };
    // Stamp the current scene time so the audio can follow the picture:
    // clicks get a click sound, slider drags drive a track's volume.
    const mark = (event) => events.push({ t: +(n / FPS).toFixed(3), ...event });
    const drag = async (selector, to, seconds, track, from) => {
      const start = n / FPS;
      await dragSlider(page, selector, to, snap, Math.max(1, Math.round(seconds * FPS)));
      if (track) events.push({ type: 'ramp', track, from: from / 100, to: to / 100, t: +start.toFixed(3), end: +(n / FPS).toFixed(3) });
    };
    await script(page, snap, hold, mark, drag);
    await page.close();
    scenes.push({ id, frames: n, seconds: +(n / FPS).toFixed(3), events });
    console.log('scene', id, n, 'frames');
  }

  await scene('1-per-site', 'Every website keeps its own volume.', 'Set it once. Volux re-applies it on every visit.',
    SCENARIOS.perSite({ yt: 100, sp: 100, zm: 100 }), async (page, snap, hold, mark, drag) => {
      await hold(0.8);
      await drag(sliderOf('youtube.com'), 30, 0.8, 'music', 100);
      await hold(0.3);
      await drag(sliderOf('spotify.com'), 60, 0.8);
      await hold(1.3);
    });

  await scene('2-one-click', 'Add the site you’re on in one click.', 'No typing web addresses.',
    SCENARIOS.quickAdd(), async (page, snap, hold, mark) => {
      await hold(1.4);
      mark({ type: 'click' });
      await page.click('.quick-add-btn');
      await sleep(250); await applyPricing(page);
      await hold(1.8);
    });

  await scene('3-scan', 'Scan your tabs.', 'Media sites in your open tabs get added for you.',
    SCENARIOS.scan(), async (page, snap, hold, mark) => {
      await hold(1.2);
      mark({ type: 'click' });
      await page.click('#scanTabsBtn');
      await sleep(250);
      await hold(2.0);
    });

  await scene('4-per-tab', 'Pro: every tab its own volume.', 'Music loud, audiobook quiet.',
    SCENARIOS.perTab([40, 40, 40]), async (page, snap, hold, mark, drag) => {
      mark({ type: 'tabs' }); // three YouTube tabs start playing at 40%
      await hold(0.8);
      mark({ type: 'click' });
      await page.click('.tab-count-btn');
      await sleep(250);
      await hold(0.5);
      await drag(perTabSlider(61), 70, 0.7, 'music', 40);
      await drag(perTabSlider(62), 15, 0.7, 'narration', 40);
      await hold(1.4);
    });

  await scene('5-pricing', `Free for 2 sites. Pro is ${PRICE.amount}, once.`, 'No subscription. Tax included.',
    SCENARIOS.pricing(), async (page, snap, hold, mark) => {
      await hold(0.5);
      mark({ type: 'click' });
      await page.click('#upgradeBtn');
      await sleep(300); await applyPricing(page);
      await hold(2.2);
    });

  // End card (static, rendered full-frame).
  await renderHTML(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    :root{${TOKENS}}*{margin:0;padding:0;box-sizing:border-box}
    body{width:${VW}px;height:${VH}px;background:var(--ink);color:var(--paper);font-family:'IBM Plex Sans',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
    .brand{display:flex;align-items:center;gap:18px;font-family:'Fraunces',serif;font-weight:600;font-size:76px}
    .brand img{width:84px;height:84px;border-radius:18px}
    p{font-size:26px;color:rgba(243,238,229,.75)}
    </style></head><body><div class="brand"><img src="${ICON}" alt="">Volux</div>
    <p>Free on Chrome &amp; Firefox · volux.devlifeeasy.com</p></body></html>`, VW, VH, resolve(FRAMES, 'end.png'));

  const place = popupPlacement(VW, VH, VSCALE);
  writeFileSync(resolve(FRAMES, 'manifest.json'), JSON.stringify({ fps: FPS, width: VW, height: VH, popup: place, popupSource: { w: POPUP_W * DPR, h: POPUP_H * DPR }, scenes }, null, 2));
  console.log('video frames ->', FRAMES);
}

try {
  if (!ONLY_VIDEO) await stills();
  if (!ONLY_STILLS) await videoFrames();
} finally {
  await browser.close();
}
