#!/usr/bin/env node
// Ad-hoc Google Search Console reporting for volux.devlifeeasy.com.
//
// Auth: service-account JSON at ../../tmp/gsc-credentials.json (gitignored),
// or GOOGLE_APPLICATION_CREDENTIALS. The service account must be a verified
// user on the Search Console property.
//
// Usage:
//   node query.mjs sites                       # list properties the SA can see
//   node query.mjs report [days] [property]    # summary + breakdowns (default 28 days)
import { google } from 'googleapis';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || resolve(__dirname, '../../tmp/gsc-credentials.json');
// The Search Console property is a Domain property, not a URL-prefix property.
const DEFAULT_SITE = 'sc-domain:volux.devlifeeasy.com';

if (!existsSync(KEY)) {
  console.error(`Missing credentials: ${KEY}`);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY,
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});
const webmasters = google.webmasters({ version: 'v3', auth });

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function listSites() {
  const { data } = await webmasters.sites.list();
  return data.siteEntry || [];
}

async function query(site, body) {
  const { data } = await webmasters.searchanalytics.query({
    siteUrl: site,
    requestBody: body,
  });
  return data.rows || [];
}

async function report(days, site) {
  const startDate = fmtDate(daysAgo(days + 2)); // GSC data lags ~2 days
  const endDate = fmtDate(daysAgo(2));
  const range = { startDate, endDate, dataState: 'all' };
  console.log(`\nProperty: ${site}`);
  console.log(`Window:   ${startDate} -> ${endDate} (${days} days)\n`);

  const totalRows = await query(site, { ...range, dimensions: [] });
  const t = totalRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  console.log('=== TOTALS ===');
  console.log(`clicks=${t.clicks}  impressions=${t.impressions}  ctr=${(t.ctr * 100).toFixed(2)}%  avgPos=${t.position?.toFixed(1)}`);

  const sections = [
    ['TOP QUERIES', ['query'], 25],
    ['TOP PAGES', ['page'], 25],
    ['COUNTRIES', ['country'], 12],
    ['DEVICES', ['device'], 5],
  ];
  for (const [title, dims, rowLimit] of sections) {
    const rows = await query(site, { ...range, dimensions: dims, rowLimit });
    console.log(`\n=== ${title} (${rows.length}) ===`);
    for (const r of rows) {
      const key = r.keys.join(' | ');
      console.log(
        `${String(r.clicks).padStart(5)} clk  ${String(r.impressions).padStart(6)} imp  ` +
        `${(r.ctr * 100).toFixed(1).padStart(5)}% ctr  pos ${r.position.toFixed(1).padStart(5)}  ${key}`
      );
    }
  }

  // Daily trend for sparkline-style view.
  const daily = await query(site, { ...range, dimensions: ['date'], rowLimit: 100 });
  console.log(`\n=== DAILY (${daily.length}) ===`);
  for (const r of daily) {
    console.log(`${r.keys[0]}  clk=${String(r.clicks).padStart(4)}  imp=${String(r.impressions).padStart(5)}  ctr=${(r.ctr*100).toFixed(1)}%  pos=${r.position.toFixed(1)}`);
  }
}

const [cmd = 'report', arg1, arg2] = process.argv.slice(2);
try {
  if (cmd === 'sites') {
    const sites = await listSites();
    console.log('Properties visible to the service account:');
    if (!sites.length) console.log('  (none — add the SA as a user on the GSC property)');
    for (const s of sites) console.log(`  ${s.permissionLevel.padEnd(20)} ${s.siteUrl}`);
  } else if (cmd === 'report') {
    const days = Number(arg1) > 0 ? Number(arg1) : 28;
    const site = arg2 || DEFAULT_SITE;
    await report(days, site);
  } else {
    console.error(`Unknown command: ${cmd}. Use "sites" or "report [days] [property]".`);
    process.exit(1);
  }
} catch (e) {
  console.error('ERROR:', e.errors?.[0]?.message || e.message);
  if (e.code === 403) {
    console.error('\nThe service account lacks access. In Search Console -> Settings ->');
    console.error('Users and permissions, add: volux-718@my-project-1473230869100.iam.gserviceaccount.com');
  }
  process.exit(1);
}
