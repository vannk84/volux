# Volux Resubmission — Chrome 1.0.2 / Firefox 1.0.5

Date: 2026-04-15

## What changed

Single-issue patch release. No new features, no new permissions, no UI changes,
no changes to data handling.

### Bug fix: memory leak in content script

The content script maintained a strong-reference `Set` of every `<audio>` and
`<video>` element it had ever observed (`controlledElements = new Set()`).
Entries were never removed. On Single-Page-App sites that create and destroy
media elements as the user scrolls (TikTok, Instagram Reels, YouTube Shorts,
Twitter/X feed autoplay, Facebook feed autoplay), this pinned detached media
nodes in memory for the lifetime of the tab. Tab memory grew continuously over
long sessions.

**Fix:** switched to `WeakSet` so detached media elements are eligible for
garbage collection. `mediaCount` status reporting switched to a live
`querySelectorAll('audio, video').length` query (since `WeakSet` has no
`.size`). No behavioral change for users; purely internal.

### Bug fix: volume-fight loop guard

Added a 250 ms per-element cooldown on the `volumechange` listener so that
sites which actively re-assert their own internal volume state can no longer
cause a tight tug-of-war with Volux's re-apply. This is defensive — no user
reports of this loop — but the previous logic had no rate limit.

### Polish: removed debug console logging

Removed three `console.log` calls from the content script that were firing
every 1 second from an internal reconciliation timer, polluting DevTools on
every page. No functional impact.

## Files changed

- `content/content.js`
- `manifest.json` (version 1.0.1 → 1.0.2)
- `manifest.firefox.json` (version 1.0.4 → 1.0.5)

No changes to background scripts, popup, options page, permissions, host
permissions, content security policy, or data collection.

## Permissions diff

None. Same `tabs`, `storage`, `<all_urls>` host permissions as prior release.

## Privacy / data handling diff

None. No new network calls, no new storage keys, no new data collected.

## Build artifacts

- `dist/volux-chrome-1.0.2.zip`  (Chrome Web Store upload)
- `dist/volux-firefox-1.0.5.zip` (AMO upload)

## Chrome Web Store — submission steps

The Chrome Web Store has **no per-version changelog / "What's new" field**.
A new version ships silently once the uploaded package is approved. The
only places end users might see a note about the update are the Store
listing Description or a linked Website, neither of which needs updating
for this bugfix release.

Steps in the Developer Dashboard (https://chrome.google.com/webstore/devconsole):

1. Left sidebar → **Package** → **Upload new package**.
2. Select `dist/volux-chrome-1.0.2.zip`. The dashboard auto-reads the
   manifest and shows `Version: 1.0.2`.
3. No other fields need to change — Store listing, Privacy, Distribution,
   and Permissions are identical to 1.0.1.
4. Top right → **Submit for review**.

### If a reviewer asks "what changed?" (via email)

Paste this reply:

> v1.0.2 is a bugfix-only release. Fixed a memory leak in the content
> script: `controlledElements` was a strong-reference `Set` accumulating
> every `<audio>`/`<video>` element observed, preventing garbage
> collection of detached media nodes on single-page-app sites such as
> TikTok, Instagram Reels, YouTube Shorts, and Twitter/X and Facebook
> feeds. Changed to `WeakSet` so detached elements are eligible for GC.
> Also removed three `console.log` calls that fired every second from an
> internal reconciliation timer. No new permissions, no new capabilities,
> no new remote code, no changes to data handling. Diff is limited to
> `content/content.js` and the two manifest files.

## Firefox (AMO) — submission steps

Unlike Chrome, AMO **does** have a per-version release-notes field. It
appears during the upload flow at
https://addons.mozilla.org/developers/addon/volux/versions/submit/.

1. Upload `dist/volux-firefox-1.0.5.zip`.
2. When prompted for "Release notes for this version", paste:

   > Fixes a memory leak in the content script on single-page-app sites
   > that dynamically create and destroy audio/video elements (social
   > feeds, short-video apps). Detached media elements are now eligible
   > for garbage collection, preventing gradual tab memory growth during
   > long sessions. Also removes periodic debug logging from the
   > developer console.

3. Source code: AMO requires source when a submission contains minified
   or compiled code. Volux ships as plain hand-written JavaScript, so
   the uploaded zip *is* the source. If the submission form asks whether
   source is needed, answer "No, my add-on does not contain minified,
   concatenated, or otherwise machine-generated code."

4. Submit for review.

## Verification checklist (run before upload)

- [x] `manifest.json` version is `1.0.2`
- [x] `manifest.firefox.json` version is `1.0.5`
- [x] `content/content.js` contains `new WeakSet()` (not `new Set()`) for
      `controlledElements`
- [x] No `console.log` calls remain in `content/content.js`
- [x] `dist/volux-chrome-1.0.2.zip` unpacks cleanly with version `1.0.2`
- [x] `dist/volux-firefox-1.0.5.zip` unpacks cleanly with version `1.0.5`
- [ ] Load `dist/chrome/` unpacked in Chrome, confirm popup opens and
      volume control works on youtube.com
- [ ] Load `dist/firefox/` as temporary add-on in Firefox, same check
- [ ] Scroll TikTok / Reels for 2 minutes with DevTools Memory tab open,
      confirm detached-node count stays flat (not climbing)

## Rollback plan

If a regression is reported post-publish: the change is isolated to
`content/content.js`. Revert the single file to the 1.0.1 version, bump to
1.0.3, resubmit. The memory leak it reintroduces is slow and non-fatal, so
rollback is low-risk.
