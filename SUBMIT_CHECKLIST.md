# Chrome Web Store Submission - Quick Checklist

**Date:** 2026-04-10
**Status:** ✅ **APPROVED & LIVE!**
**Chrome Store URL:** https://chromewebstore.google.com/detail/cnagfimhcaplopdllnmkhalkeagmeapm

---

## 🎉 APPROVAL ACHIEVED!

After 3 rejections, Volux was successfully approved and is now live on Chrome Web Store!

**Submission Timeline:**
- Rejection #1: Permissions not explained
- Rejection #2: Affiliate code issues
- Rejection #3: Affiliate code (incomplete removal)
- **Submission #4: ✅ APPROVED!**

---

---

## 🚨 CRITICAL: Do These First

### 1. Privacy Policy Updated ✅
- [x] Clarified extension vs website analytics
- [x] Live at: https://volux.devlifeeasy.com/privacy.html
- [ ] Test link works before submitting

### 2. Rebuild Extension
```bash
# Run this command
make build-chrome
# OR
./build.sh

# Verify output
cd dist/chrome
ls -la  # Should see manifest.json, icons/, popup/, background/, content/, options/
```

### 3. Verify Clean Build
```bash
# Check for affiliate code (should return nothing)
cd dist/chrome
grep -r "affiliate" . && echo "❌ FOUND AFFILIATE CODE" || echo "✅ Clean"
grep -r "utm_" . && echo "⚠️  Found UTM" || echo "✅ Clean"
grep -r "ref=" . && echo "⚠️  Found ref" || echo "✅ Clean"
```

### 4. Test Extension Locally
1. Open Chrome
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist/chrome/` folder
6. Test:
   - [ ] Add domain (e.g., youtube.com)
   - [ ] Adjust volume
   - [ ] Open YouTube tab
   - [ ] Verify volume is applied
   - [ ] Reload page
   - [ ] Verify volume persists
   - [ ] Check console for errors (F12)

---

## 📦 Create Submission Package

```bash
cd dist
zip -r ../volux-chrome-1.0.1.zip chrome/

# Verify ZIP contents
unzip -l ../volux-chrome-1.0.1.zip

# Should see:
# chrome/manifest.json
# chrome/background/background.js
# chrome/content/content.js
# chrome/popup/popup.html, popup.js, popup.css
# chrome/options/options.html, options.js, options.css
# chrome/icons/*.png
```

---

## 🌐 Chrome Web Store Submission

Go to: https://chrome.google.com/webstore/devconsole

### Step 1: Upload Package
- [ ] Click "New Item"
- [ ] Upload `volux-chrome-1.0.1.zip`
- [ ] Wait for processing

### Step 2: Store Listing

**Product Details:**
- [ ] **Name:** `Volux - Per-Tab Volume & Auto Save`
- [ ] **Summary:** `Automatically remember volume for each website & tab. Set it once, never adjust again.`

**Detailed Description:**
- [ ] Copy from `CHROME_STORE_SUBMISSION.md` - "Full Description" section
- [ ] Verify "PERMISSIONS EXPLAINED" section is included

**Category:**
- [ ] Primary: `Productivity`

**Language:**
- [ ] `English`

### Step 3: Privacy

**Privacy Policy:**
- [ ] URL: `https://volux.devlifeeasy.com/privacy.html`
- [ ] Test link before saving

**Single Purpose:**
- [ ] Description: `Control and automatically save volume levels per website and browser tab.`

**Permissions Justification (CRITICAL):**
- [ ] Copy ENTIRE "Permissions Justification" section from `CHROME_STORE_SUBMISSION.md`
- [ ] This is the most important field - don't skip or abbreviate

**Data Usage:**
- [ ] Does extension handle user data? `No`
- [ ] Does extension collect user data? `No`

### Step 4: Screenshots & Media

**Screenshots (minimum 1, recommended 3-5):**
- [ ] Upload `marketing/screenshot-clean-1280x800.png`
  - Caption: `Control volume for each website - settings save automatically`
- [ ] Upload `marketing/screenshot-options-1280x800.png`
  - Caption: `Manage all your domains in one place`
- [ ] Upload `marketing/screenshot-upgrade-1280x800.png`
  - Caption: `Auto-save, per-tab control, unlimited domains with Pro`

**Promotional Images:**
- [ ] Small tile (440x280): `marketing/promo-tile-440x280.png`

**Icon:**
- [ ] Should auto-pull from manifest (128x128)

### Step 5: Distribution

**Visibility:**
- [ ] `Public`

**Regions:**
- [ ] `All regions` (or select specific)

**Pricing:**
- [ ] `Free` (Pro is in-app purchase)

### Step 6: Final Review

**Links to verify:**
- [ ] Privacy Policy: https://volux.devlifeeasy.com/privacy.html
- [ ] Website: https://volux.devlifeeasy.com
- [ ] Support: https://github.com/vannk84/volux/issues

**Text to review:**
- [ ] Description mentions "PERMISSIONS EXPLAINED"
- [ ] No typos in description
- [ ] Justification field filled completely
- [ ] All screenshots have captions

### Step 7: Resubmission Note (Important!)

If this is a resubmission, add this in "Reason for Update":

```
This is a resubmission after addressing all previous rejection reasons.

CHANGES MADE:
1. All affiliate code removed from extension (verified in dist/chrome/)
2. Permissions explained in detail in store description
3. Privacy policy updated with permission explanations
4. All permissions actively used (storage: background.js:302, tabs: background.js:328, host_permissions: content.js)

Extension purpose: Per-domain volume control with auto-save.
No data collection. No tracking. 100% private.

Previous issues thoroughly addressed. Ready for review.
```

### Step 8: Submit

- [ ] Review everything one more time
- [ ] Click "Submit for Review"
- [ ] Note submission time
- [ ] Save confirmation email

---

## ⏱️ After Submission

### Immediate (First Hour)
- [ ] Save submission confirmation email
- [ ] Screenshot submission dashboard for reference
- [ ] Add calendar reminder to check in 3 days

### Daily Monitoring
- [ ] Check email (including spam folder)
- [ ] Check Chrome Web Store Developer Dashboard
- [ ] DO NOT resubmit while "In Review"

### If Approved (usually 1-5 days)
- [ ] Test live installation
- [ ] Update website with Chrome Store badge
- [ ] Announce on social media
- [ ] Monitor reviews (respond within 24h)

### If Rejected
- [ ] Read rejection reason carefully
- [ ] Check which policy was violated
- [ ] Fix specific issue
- [ ] Update this checklist
- [ ] Resubmit (don't wait too long)

---

## 🆘 Emergency Contacts

**If rejected and unclear why:**
- Chrome Web Store Developer Support: https://support.google.com/chrome_webstore/contact/developer_support
- Include: Extension ID, rejection reason, what you've fixed

**Community help:**
- r/chrome (Reddit)
- Chrome Extensions Google Group
- Stack Overflow (tag: google-chrome-extension)

---

## 📊 Success Criteria

**Approval = Success if:**
- Extension goes live within 7 days
- No critical bugs reported in first week
- Average rating > 4.0 stars
- Uninstall rate < 30%

**Then focus on:**
- SEO optimization (Chrome Store ranking)
- User acquisition (Reddit, Product Hunt)
- Conversion optimization (Free → Pro)

---

## ✅ Final Pre-Submit Checklist

**Before clicking "Submit for Review":**

- [ ] Extension rebuilt (`make build-chrome`)
- [ ] Tested locally (all features work)
- [ ] ZIP created (`volux-chrome-1.0.1.zip`)
- [ ] Privacy policy updated and live
- [ ] Description includes permissions explanation
- [ ] Justification field filled (don't leave blank!)
- [ ] Screenshots uploaded (minimum 3)
- [ ] All links verified (click each one)
- [ ] No affiliate code in extension (verified)
- [ ] Resubmission note added (if applicable)

**Confidence check:**
- [ ] All 3 previous rejection reasons addressed
- [ ] Extension purpose is clear
- [ ] Privacy policy is transparent
- [ ] Code is readable (no obfuscation)
- [ ] Permissions are justified

**Final question:**
"Would I approve this if I were the reviewer?"
- [ ] Yes → Submit
- [ ] No → Fix remaining issues first

---

## 🎯 Expected Timeline

| Event | Time | What to Do |
|-------|------|------------|
| Submit | Day 0 | Upload, fill forms, click submit |
| Review starts | Day 1-2 | Wait, don't resubmit |
| Possible rejection | Day 2-5 | Read carefully, fix, resubmit |
| Approval | Day 3-7 | Test install, announce |
| Goes live | Day 4-8 | Monitor reviews, support users |

---

## 💰 Revenue Expectations (Realistic)

**Month 1:**
- Installs: 100-500 (organic)
- Pro conversions: 2-5% → 2-25 sales
- Revenue: $4-50

**Month 3:**
- Installs: 500-2,000 (with marketing)
- Pro conversions: 3-5% → 15-100 sales
- Revenue: $30-200

**Month 6:**
- Installs: 2,000-10,000 (if SEO works)
- Pro conversions: 5-8% → 100-800 sales
- Revenue: $200-1,600

**Key:** Focus on quality users, not quantity. Better to have 1,000 engaged users than 10,000 who uninstall.

---

**Last check before submitting:**

1. ✅ Privacy policy live?
2. ✅ Extension rebuilt?
3. ✅ Tested locally?
4. ✅ Permissions explained in description?
5. ✅ Justification field filled?
6. ✅ Screenshots uploaded?
7. ✅ No affiliate code?

**If all yes → Submit now! 🚀**

Don't overthink it. You've addressed all issues. The extension is solid.

---

**Remember:** Even if rejected again, it's not the end. Firefox is working, Edge is an option, and direct distribution exists. But this should pass.

Good luck! 🍀
