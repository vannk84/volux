# Chrome Web Store - Final Submission Copy

## Short Description (132 chars max)
```
Automatically remember volume for each website & tab. Set it once, never adjust again.
```
**Character count:** 92 ✅

---

## Full Description (Paste this into Chrome Web Store)

```
Tired of adjusting volume every time you open a tab?

Volux - Smart Volume Control automatically remembers your preferred volume for each website and tab.

No more annoying volume resets. No more sudden loud videos.
Set it once - Volux handles the rest.


KEY FEATURES

Remember volume for every website
Set volume for YouTube, Facebook, Zoom, or any site - Volux saves it automatically.

Per-tab volume control
Each tab can have its own volume level. Perfect for multitasking.

No more volume reset
Your settings stay even after refresh or reopening the browser.

Smart and automatic
No complex setup. Just adjust volume like normal - Volux remembers it.


PERFECT FOR

- Watching YouTube without sudden loud audio
- Keeping Zoom/Meet calls at stable volume
- Listening to music while browsing
- Managing multiple tabs with different sound levels


WHY VOLUX?

Most volume extensions only control sound.
Volux remembers it.

That means:
- Less friction
- Better focus
- A smoother browsing experience


HOW IT WORKS

1. Open any website
2. Adjust volume
3. Done - Volux saves it automatically


PERMISSIONS EXPLAINED

Volux needs certain permissions to work:

• Storage - Save your volume preferences locally on your device. All data stays on your device, never sent anywhere.

• Tabs - Detect which tabs have audio and get website names to manage volume per domain.

• Access to websites - Control audio/video elements on sites you choose to add. Volux only affects domains you explicitly add.

All data stays on your device. No data is sent to any server. No tracking. No analytics.


LIGHTWEIGHT & PRIVACY-FRIENDLY

- No data collection
- No tracking or analytics
- No cookies
- All settings stored locally
- No accounts required
- Fast and minimal

Full privacy policy: https://volux.devlifeeasy.com/privacy.html


FREE VERSION
- Control 2 websites
- All core features included

PRO VERSION ($2 one-time)
- Unlimited websites
- Auto-detect media sites
- Lifetime access

Note: Pro upgrade is an optional direct purchase (not affiliate marketing). No recurring fees.


SUPPORT

Questions or issues?
- Email: support@devlifeeasy.com
- GitHub: https://github.com/vannk84/volux/issues


Made with care for people who value their time and privacy.
```

---

## Single Purpose Statement
```
Control and automatically save volume levels per website and browser tab.
```

---

## Permissions Justification (CRITICAL - Paste into Developer Dashboard)

```
PERMISSIONS JUSTIFICATION:

1. "storage" permission
   Required to save user volume preferences locally on their device.
   All data stays on the device, never transmitted.

2. "tabs" permission
   Required to identify which browser tabs contain audio/video content
   and get their domain names for per-domain volume management.

3. "host_permissions: <all_urls>"
   Required to inject content scripts that control HTML5 audio/video
   element volumes on websites the user explicitly chooses to manage.
   Users add domains manually through the extension popup.
   The extension only affects user-selected domains.

4. "all_frames: true" in content_scripts
   Required because many media sites (YouTube, Spotify, Netflix, etc.)
   use iframes for their video/audio players. Without this, embedded
   media cannot be controlled.

PRIVACY:
- No data collection of any kind
- No external servers
- All settings stored locally using chrome.storage.local
- No tracking or analytics in the extension
- Full privacy policy: https://volux.devlifeeasy.com/privacy.html

MONETIZATION:
- Optional Pro upgrade ($2 one-time) is a direct sale of our own product
- No affiliate marketing in the extension
- No third-party promotions in the extension
- No recurring fees or subscriptions

PREVIOUS REJECTIONS ADDRESSED:
1. All affiliate code completely removed from extension (verified in dist/chrome/)
2. All permissions are actively used (see background.js and content.js)
3. Permissions clearly explained in store description
4. Privacy policy updated with detailed explanations

CODE TRANSPARENCY:
- All code is readable (no obfuscation)
- No remote code execution
- No dynamic script loading
- Source available: https://github.com/vannk84/volux

The extension has a single, clear purpose: per-domain volume control with
automatic saving. All functionality directly supports this purpose.
```

---

## Category
Primary: **Productivity**
Secondary: **Accessibility** (alternative option)

---

## Language
English

---

## Website
https://volux.devlifeeasy.com

---

## Privacy Policy URL
https://volux.devlifeeasy.com/privacy.html

---

## Support URL
https://github.com/vannk84/volux/issues

---

## Screenshots (Upload in this order)

1. **Screenshot 1 - Main UI** (Primary)
   File: `marketing/screenshot-clean-1280x800.png`
   Caption: "Control volume for each website - settings save automatically"

2. **Screenshot 2 - Settings Page**
   File: `marketing/screenshot-options-1280x800.png`
   Caption: "Manage all your domains in one place - clean and intuitive"

3. **Screenshot 3 - Features**
   File: `marketing/screenshot-upgrade-1280x800.png`
   Caption: "Auto-save, per-tab control, unlimited domains with Pro"

**Recommended:** Add text overlays to screenshots highlighting:
- "Auto-saves volume"
- "100% private - no tracking"
- "Works on any website"

---

## Promotional Images

**Small Tile (440x280):**
File: `marketing/promo-tile-440x280.png`

If you don't have larger sizes, Chrome will auto-scale this.

---

## Visibility
**Public** - Available to all users

---

## Regions
**All regions** (unless you have specific restrictions)

---

## Version Number
1.0.1 (matches manifest.json)

---

## What's New (Version History)
```
Version 1.0.1
- Initial Chrome Web Store release
- Per-domain volume control
- Automatic volume saving
- Free: 2 domains, Pro: unlimited
- 100% private - no data collection
```

---

## Reason for Submission (If Resubmitting)

```
This is a resubmission after addressing all previous rejection reasons.

CHANGES MADE:

1. AFFILIATE CODE REMOVED
   - All affiliate code completely removed from extension files
   - Build scripts actively strip any affiliate references
   - Only direct checkout link remains (selling our own product, not affiliate)
   - Verified clean: dist/chrome/popup/popup.html, background.js, options.html

2. PERMISSIONS FULLY JUSTIFIED
   - Added detailed "PERMISSIONS EXPLAINED" section to store description
   - All permissions actively used in code
   - storage: saves volume preferences locally (background.js:302-323)
   - tabs: gets domain names and audio status (background.js:328-376)
   - host_permissions: content script controls audio elements (content/content.js)

3. PRIVACY POLICY ENHANCED
   - Updated to clarify extension vs website tracking
   - Clearly explains all permissions
   - Accessible at https://volux.devlifeeasy.com/privacy.html

4. CODE TRANSPARENCY
   - All code readable, no obfuscation
   - No remote code execution
   - Source: https://github.com/vannk84/volux

EXTENSION PURPOSE:
Per-domain volume control with automatic saving. Users add domains,
adjust volume, and Volux remembers settings across sessions.

All core functionality directly supports this single purpose.
No data collection, no tracking, completely private.

Previous rejection reasons have been thoroughly addressed.
Ready for review. Thank you for your consideration.
```

---

## Developer Response to Reviews Template (for later)

**Positive Review:**
```
Thank you! We're glad Volux is helping you manage volume better. If you have any feature requests, let us know on GitHub!
```

**Negative Review - Bug:**
```
Sorry you're experiencing issues! Please email support@devlifeeasy.com or open an issue at github.com/vannk84/volux/issues with details. We'll help you fix it ASAP.
```

**Negative Review - Feature Request:**
```
Thank you for the feedback! We're considering this for a future update. Feel free to upvote it on our GitHub issues page so we can prioritize it.
```

---

## Pre-Submission Testing Checklist

Before uploading the ZIP:

```bash
# 1. Clean rebuild
make build-chrome

# 2. Navigate to extension folder
cd dist/chrome

# 3. Verify files
ls -la
# Should see: manifest.json, icons/, popup/, background/, content/, options/

# 4. Grep for affiliate code (should return nothing from extension files)
grep -r "affiliate" . || echo "Clean ✅"
grep -r "ref=" . || echo "Clean ✅"

# 5. Load as unpacked in Chrome
# chrome://extensions -> Developer mode ON -> Load unpacked -> select dist/chrome/

# 6. Test all features
# - Add a domain
# - Adjust volume
# - Reload page - volume should persist
# - Remove domain
# - Activate Pro (use dev key if needed)

# 7. Check console for errors
# F12 -> Console -> should be clean

# 8. Create ZIP
cd ..
zip -r volux-chrome-1.0.1.zip chrome/
```

---

## Submission Timeline Expectations

**After submission:**
- ⏱️ Initial review: 1-3 business days
- ⏱️ If rejected: Fix and resubmit (1 day turnaround)
- ⏱️ If approved: Live within 24-48 hours

**Given 3 previous rejections:**
- Expect more thorough review (3-5 days)
- Reviewers may test more features
- May request additional clarification

**What to do while waiting:**
- Monitor email (check spam folder)
- Prepare marketing materials (Reddit post, Product Hunt)
- Don't start heavy promotion until approved

---

## Success Metrics to Track (Post-Approval)

**Week 1:**
- Total installs
- Active users
- Reviews (respond to all!)
- Uninstall rate

**Week 2-4:**
- Conversion rate (free → pro)
- User retention (DAU/MAU)
- Bug reports

**Tools:**
- Chrome Web Store Developer Dashboard (built-in analytics)
- Optional: Google Analytics for website (not extension)

---

## Post-Approval Launch Plan

**Day 1 (Approval Day):**
1. Test live installation from store
2. Update website with Chrome Store badge
3. Announce on Twitter/X

**Day 2-3:**
- Post to Reddit:
  - r/chrome
  - r/productivity
  - r/chromeos (if relevant)
- Format: "I built this because..." (storytelling works better than ads)

**Day 4-7:**
- Submit to Product Hunt
- Share on Hacker News (Show HN)
- Email newsletter (if you have one)

**Week 2:**
- Monitor reviews daily
- Respond to all reviews (builds trust)
- Fix any critical bugs immediately

---

## Contact Support If Needed

If rejected again or need clarification:

**Chrome Web Store Developer Support:**
https://support.google.com/chrome_webstore/contact/developer_support

**What to include:**
- Extension ID (after first submission)
- Specific rejection reason
- What you've done to address it
- Ask for specific guidance

---

**You're ready to submit! 🚀**

All critical issues addressed. Extension is clean, privacy-focused, and policy-compliant.
Confidence level: 85-90% approval on this submission.
