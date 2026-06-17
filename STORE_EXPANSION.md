# Browser Store Expansion Guide

## 1. Microsoft Edge Add-ons

### Prerequisites
- Microsoft account (personal or work)
- Chrome build ZIP (from `make package`)

### Steps
1. Go to [Edge Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)
2. Sign in with your Microsoft account
3. Click **Create new extension**
4. Upload the Chrome ZIP from `dist/chrome/`
5. Fill in the store listing:
   - **Extension name:** Volux – Per-Tab Volume & Auto Save
   - **Description:** Reuse the Chrome Web Store description from `CHROME_STORE_DESCRIPTION_NEW.md`
   - **Screenshots:** Reuse the same screenshots from Chrome submission
   - **Category:** Accessibility (or Productivity)
   - **Privacy policy URL:** Same as Chrome listing
6. Submit for review
7. Wait for approval (typically 1–3 business days)

### Post-Approval
- Edge Add-ons listing URL will be provided after approval
- Update `README.md` and website with the Edge store link
- Add Edge badge/button to landing page if applicable

---

## 2. Opera Addons

### Prerequisites
- Opera account
- Chrome build ZIP (from `make package`)

### Steps
1. Go to [Opera Addons Developer Portal](https://addons.opera.com/developer)
2. Create a developer account or sign in
3. Click **Add new extension**
4. Upload the Chrome ZIP from `dist/chrome/`
5. Fill in the store listing:
   - **Extension name:** Volux – Per-Tab Volume & Auto Save
   - **Description:** Reuse the Chrome Web Store description
   - **Screenshots:** Reuse the same screenshots
   - **Category:** Accessibility
6. Submit for moderation
7. Wait for approval (typically a few days)

### Post-Approval
- Update `README.md` and website with the Opera store link
- Add Opera to the list of supported browsers in marketing materials

---

## 3. Safari (Apple App Store) — Future / Low Priority

### Why Low Priority
- Requires rewriting as a Safari Web Extension
- Needs Xcode project with Swift/Objective-C wrapper
- Must be distributed through the Mac App Store
- Requires Apple Developer Program membership ($99/year)

### Steps (if pursuing later)
1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Open Xcode → File → New → Project → Safari Extension App
3. Port extension code to Safari Web Extension format:
   - Convert Manifest V3 to Safari-compatible format
   - Replace Chrome-specific APIs with browser-neutral equivalents
   - Handle Safari's permission model differences
4. Test in Safari
5. Archive and submit through App Store Connect
6. Wait for Apple review

---

## Notes
- Edge and Opera use the **same Chrome build** — no code changes needed
- Run `make package` to generate the submission ZIP
- Run `make submit-check` before uploading to verify the build is clean
