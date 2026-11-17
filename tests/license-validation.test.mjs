// License validation regression tests.
//   node tests/license-validation.test.mjs                 # both builds
//   node tests/license-validation.test.mjs <file> <api>    # one build
// Loads the real background script in a VM with stubbed extension APIs and
// fetch, then exercises validateStoredLicense() / activateLicense().
//
// Guards the 2026-11 bug where ANY non-"active" API answer (e.g. a JSON error
// once Lemon Squeezy shuts down on 2027-03-31) wiped every customer's Pro.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.length > 3
  ? [[process.argv[2], process.argv[3]]]
  : [[join(ROOT, 'background/background.js'), 'chrome'],
     [join(ROOT, 'background/background-firefox.js'), 'browser']];
const LICENSE = { key: '458E7F71-5DB3-4915-88D0-7DBEB060CA80', activated: true, activatedAt: 1 };
let failures = 0;

// Any property chain resolves to a no-op function returning a resolved promise.
const anyApi = () => new Proxy(function () {}, {
  get: (_t, p) => (p === 'then' ? undefined : anyApi()),
  apply: () => Promise.resolve({}),
});

let src, apiName;

function makeContext({ fetchImpl, now }) {
  const store = { volux_license: { ...LICENSE } };
  const fetchCalls = [];
  const storageLocal = {
    get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
    set: async (o) => Object.assign(store, o),
    remove: async (k) => { delete store[k]; },
  };
  const ext = new Proxy({}, {
    get: (_t, p) => p === 'storage'
      ? { local: storageLocal, session: { get: async () => ({}), set: async () => {} } }
      : anyApi(),
  });
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [now])); }
    static now() { return now; }
  }
  const ctx = {
    console: { log() {}, error() {} }, setTimeout, clearTimeout, URL, TextEncoder,
    crypto: globalThis.crypto, Set, Map, Promise, JSON, Object, Array, Math,
    Date: FakeDate,
    fetch: async (url, opts) => { fetchCalls.push(url); return fetchImpl(url, opts); },
  };
  ctx[apiName] = ext;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, store, fetchCalls };
}

const json = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const html = (status) => async () => ({ ok: status < 300, status, json: async () => { throw new SyntaxError('Unexpected token <'); } });
const BEFORE = Date.UTC(2026, 10, 17);
const AFTER = Date.UTC(2027, 3, 2);

async function check(name, { fetchImpl, now = BEFORE, expectKept, expectFetch = true, run = 'validate' }) {
  const { ctx, store, fetchCalls } = makeContext({ fetchImpl, now });
  await new Promise(r => setTimeout(r, 20));           // let the load-time validate settle
  store.volux_license = { ...LICENSE }; fetchCalls.length = 0;
  const res = run === 'validate'
    ? await ctx.validateStoredLicense()
    : await ctx.activateLicense(LICENSE.key);
  const kept = !!store.volux_license;
  const fetched = fetchCalls.length > 0;
  const ok = (expectKept === undefined || kept === expectKept) && fetched === expectFetch;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} -> kept=${kept} fetched=${fetched} ${JSON.stringify(res)}`);
}

for (const [file, api] of targets) {
  src = readFileSync(file, 'utf8'); apiName = api;
  console.log(`== ${file}`);
  await check('active license stays Pro', { fetchImpl: json(200, { valid: true, license_key: { status: 'active' } }), expectKept: true });
  await check('refunded (disabled) is removed', { fetchImpl: json(200, { valid: false, license_key: { status: 'disabled' } }), expectKept: false });
  await check('expired is removed', { fetchImpl: json(200, { valid: false, license_key: { status: 'expired' } }), expectKept: false });
  await check('JSON error 404 (shutdown-style) keeps Pro', { fetchImpl: json(404, { error: 'Not found' }), expectKept: true });
  await check('JSON error with HTTP 200 and no status keeps Pro', { fetchImpl: json(200, { error: 'license_key not found' }), expectKept: true });
  await check('HTML 503 page keeps Pro', { fetchImpl: html(503), expectKept: true });
  await check('network failure keeps Pro', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, expectKept: true });
  await check('unknown status "inactive" keeps Pro', { fetchImpl: json(200, { valid: false, license_key: { status: 'inactive' } }), expectKept: true });
  await check('after 2027-04-01: no LS call, keeps Pro', { fetchImpl: json(200, { license_key: { status: 'disabled' } }), now: AFTER, expectKept: true, expectFetch: false });
  await check('after 2027-04-01: activation does not call LS', { fetchImpl: json(200, {}), now: AFTER, expectFetch: false, run: 'activate' });
}

console.log(failures ? `${failures} FAILED` : 'ALL PASS');
process.exit(failures ? 1 : 0);
