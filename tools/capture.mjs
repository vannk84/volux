import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const POPUP_URL = `file://${resolve(ROOT, 'popup/popup.html')}`;
const MOCK_JS = readFileSync(resolve(__dirname, 'mock-runtime.js'), 'utf8');
const OUT = resolve(ROOT, 'marketing', 'generated');
const FRAMES = resolve(__dirname, 'frames');

const SHOT_MODE = process.argv.includes('--screenshots');
const VIDEO_MODE = process.argv.includes('--video-frames');

if (!SHOT_MODE && !VIDEO_MODE) {
  console.log('Usage: capture.mjs --screenshots | --video-frames');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
if (VIDEO_MODE) {
  if (existsSync(FRAMES)) rmSync(FRAMES, { recursive: true });
  mkdirSync(FRAMES, { recursive: true });
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=2']
});

async function openPopup() {
  const page = await browser.newPage();
  // Viewport matches popup max dimensions; deviceScaleFactor=2 for crisp output.
  await page.setViewport({ width: 380, height: 550, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(MOCK_JS);
  await page.goto(POPUP_URL, { waitUntil: 'networkidle0' });
  // Give popup.js a beat to finish the initial loadDomains().
  await new Promise(r => setTimeout(r, 300));
  return page;
}

async function expandFirstDomain(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('.tab-count-btn');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));
}

async function openUpgradeModal(page) {
  // For the modal shot, flip to free so the modal has the real upgrade look.
  await page.evaluate(() => window.__voluxMock.setLicense(false));
  await new Promise(r => setTimeout(r, 2100)); // let 2s refresh cycle pick it up
  await page.evaluate(() => {
    document.getElementById('upgradeBtn')?.click();
  });
  await new Promise(r => setTimeout(r, 300));
}

async function clipPopup(page, filename) {
  // Capture only the popup chrome (container) with 1px border space.
  const box = await page.evaluate(() => {
    const el = document.getElementById('container');
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  await page.screenshot({
    path: resolve(OUT, filename),
    clip: box,
    omitBackground: false
  });
}

async function screenshots() {
  // 1) PRO collapsed — hero view with "3 TABS" badge clickable
  {
    const page = await openPopup();
    await clipPopup(page, 'popup-pro-collapsed.png');
    await page.close();
  }

  // 2) PRO expanded — THE hero shot for the new feature
  {
    const page = await openPopup();
    await expandFirstDomain(page);
    await clipPopup(page, 'popup-pro-expanded.png');
    await page.close();
  }

  // 3) Free user collapsed — baseline / "before Pro"
  {
    const page = await openPopup();
    await page.evaluate(() => window.__voluxMock.setLicense(false));
    await new Promise(r => setTimeout(r, 2100));
    await clipPopup(page, 'popup-free.png');
    await page.close();
  }

  // 4) Upgrade modal — new Pro features list
  {
    const page = await openPopup();
    await openUpgradeModal(page);
    // Modal covers the popup; capture full viewport
    await page.screenshot({ path: resolve(OUT, 'popup-upgrade-modal.png'), fullPage: false });
    await page.close();
  }

  console.log('Screenshots written to', OUT);
}

async function videoFrames() {
  const page = await openPopup();
  // Disable the popup's 2s auto-refresh so our scripted interactions are smooth.
  await page.evaluate(() => {
    for (let i = 0; i < 9999; i++) clearInterval(i);
  });

  let frame = 0;
  const snap = async () => {
    const n = String(frame++).padStart(4, '0');
    const box = await page.evaluate(() => {
      const el = document.getElementById('container');
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    await page.screenshot({ path: resolve(FRAMES, `${n}.png`), clip: box });
  };

  // Hold on the collapsed view for ~1s (24fps → 24 frames)
  for (let i = 0; i < 24; i++) await snap();

  // Expand
  await page.evaluate(() => document.querySelector('.tab-count-btn')?.click());
  for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 30)); await snap(); }

  // Animate sliders on each per-tab row sequentially
  const tabIds = [101, 102, 103];
  const targets = [85, 35, 55];
  for (let i = 0; i < tabIds.length; i++) {
    const tid = tabIds[i], target = targets[i];
    const steps = 18;
    const start = await page.evaluate((id) => {
      const s = document.querySelector(`.per-tab-slider[data-tab-id="${id}"]`);
      return s ? parseInt(s.value, 10) : 0;
    }, tid);
    for (let k = 1; k <= steps; k++) {
      const v = Math.round(start + (target - start) * (k / steps));
      await page.evaluate((id, val) => {
        window.__voluxMock.setTabVolume(id, val);
        const slider = document.querySelector(`.per-tab-slider[data-tab-id="${id}"]`);
        if (slider) {
          slider.value = val;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, tid, v);
      await snap();
    }
    // brief hold
    for (let k = 0; k < 6; k++) await snap();
  }

  // Mute first tab
  await page.evaluate(() => {
    const btn = document.querySelector('.per-tab-mute[data-tab-id="101"]');
    btn?.click();
  });
  for (let i = 0; i < 18; i++) await snap();

  // Reset override on first tab
  await page.evaluate(() => {
    const btn = document.querySelector('.per-tab-reset[data-tab-id="101"]');
    btn?.click();
  });
  for (let i = 0; i < 24; i++) { await new Promise(r => setTimeout(r, 30)); await snap(); }

  console.log(`Wrote ${frame} frames to ${FRAMES}`);
  await page.close();
}

if (SHOT_MODE) await screenshots();
if (VIDEO_MODE) await videoFrames();
await browser.close();
