# Publishing Volux Extension

## Overview

Volux is a freemium browser extension for per-domain volume control.

- **Free tier:** 2 domains
- **Pro tier:** Unlimited domains ($2 or pay what you want)
- **Payment:** LemonSqueezy (store: vannk, product ID: 1440614)
- **License validation:** LemonSqueezy API + developer keys
- **Website:** https://volux.devlifeeasy.com
- **Support:** support@devlifeeasy.com

---

## Chrome Web Store

### Prerequisites
- Google account
- One-time $5 developer registration fee
- Extension ZIP file (`volux.zip`)

### Steps

1. **Register as Developer**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 registration fee (one-time)

2. **Create ZIP Package**
   ```bash
   cd /home/vannk/projects/vannk/volux
   ./build.sh
   # Creates volux.zip in the project root
   ```

3. **Upload Extension**
   - Click "New Item" in Developer Dashboard
   - Upload `volux.zip`

4. **Fill Store Listing**

   | Field | Value |
   |-------|-------|
   | Name | Volux - Premium Volume Control |
   | Summary | Control audio volume individually for each website. Set unique levels for YouTube, Spotify, Netflix & more. |
   | Description | (See below) |
   | Category | Productivity |
   | Language | English |

   **Description:**
   ```
   Take complete control of your browser audio with Volux - the premium volume controller.

   🎚️ FEATURES:
   • Per-Domain Volume Control - Set unique volume levels for each website
   • Smart Domain Grouping - All tabs from the same site share one slider
   • Instant Mute - One-click mute without losing your volume setting
   • Live Audio Detection - See which tabs are playing audio
   • Persistent Settings - Your preferences are saved automatically
   • Manual Domain Management - Add and remove domains as needed
   • Auto-detect Media Sites - Scan open tabs for streaming services

   💡 USE CASES:
   • Keep background music quiet while video calls stay loud
   • Mute auto-play videos without touching system volume
   • Balance audio across multiple streaming services
   • Different volume for YouTube vs Spotify vs Netflix

   ⭐ PRO FEATURES ($2 or pay what you want):
   • Unlimited domain control
   • Auto-detect media sites from open tabs
   • Priority support
   • Lifetime access

   🔒 PRIVACY:
   Volux does not collect any personal data. All settings stored locally on your device.

   📧 SUPPORT:
   support@devlifeeasy.com

   🌐 WEBSITE:
   https://volux.devlifeeasy.com
   ```

5. **Upload Graphics**

   | Asset | File | Size |
   |-------|------|------|
   | Icon | `icons/icon128.png` | 128x128 |
   | Screenshot 1 | `marketing/screenshot-clean-1280x800.png` | 1280x800 |
   | Screenshot 2 | `marketing/screenshot-options-1280x800.png` | 1280x800 |
   | Screenshot 3 | `marketing/screenshot-upgrade-1280x800.png` | 1280x800 |
   | Marquee Tile | `marketing/store-marquee-1400x560.png` | 1400x560 |
   | Small Tile | `marketing/promo-tile-440x280.png` | 440x280 |

6. **Privacy Practices** (Copy-paste ready)

   **Single purpose description:**
   ```
   Control audio volume for individual websites independently. Users can adjust, mute, and save volume levels for each domain through a simple popup interface.
   ```

   **tabs justification:**
   ```
   Required to identify browser tabs that contain audio content and retrieve the domain name of each tab to display in the volume control popup. This allows users to see which websites they can control.
   ```

   **storage justification:**
   ```
   Required to save user volume preferences for each website domain and license activation status. This ensures volume settings persist across browser sessions so users don't need to re-adjust their preferred levels each time.
   ```

   **scripting justification:**
   ```
   Required to inject the volume control script into web pages. This script intercepts HTML5 audio and video elements to apply the user's chosen volume level without modifying the actual media content.
   ```

   **Host permission justification:**
   ```
   Required to inject content scripts into any website the user visits. Since users may want to control audio on any website (YouTube, Spotify, Netflix, news sites, etc.), broad host access is necessary. The extension only activates when audio elements are present.
   ```

   **Remote code:**
   - Select: **"No, I am not using Remote code"**

   **Data usage checkboxes:**
   - Leave ALL checkboxes UNCHECKED (the extension collects no user data)

   **Certifications:**
   - ✅ Check: "I do not sell or transfer user data to third parties..."
   - ✅ Check: "I do not use or transfer user data for purposes unrelated..."
   - ✅ Check: "I do not use or transfer user data to determine creditworthiness..."

   **Privacy policy URL:**
   ```
   https://volux.devlifeeasy.com/privacy.html
   ```

7. **Submit for Review**
   - Click "Submit for Review"
   - Review takes 1-3 business days

---

## Firefox Add-ons

### Prerequisites
- Firefox account
- Extension ZIP file

### Steps

1. **Create ZIP Package**
   ```bash
   cd /home/vannk/projects/vannk/volux
   ./build.sh
   cd dist && zip -r firefox.zip firefox/
   ```

2. **Submit Extension**
   - Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
   - Click "Submit a New Add-on"
   - Upload `dist/firefox.zip`

3. **Choose Distribution**
   - Select "On this site" for public listing on Firefox Add-ons

4. **Fill Listing Details**

   | Field | Value |
   |-------|-------|
   | Name | Volux - Premium Volume Control |
   | Add-on URL | `volux-premium-volume-control` |
   | Summary | Premium per-domain volume control for Firefox |
   | Categories | Privacy & Security, Other |

5. **Upload Screenshots**
   - Upload `marketing/screenshot-clean-1280x800.png`
   - Upload `marketing/screenshot-options-1280x800.png`

6. **Submit for Review**
   - Review typically takes 1-5 days

---

## LemonSqueezy Setup

### Current Configuration
- **Store:** vannk
- **Product ID:** 1440614
- **Checkout URL:** https://vannk.lemonsqueezy.com/checkout
- **Pricing:** $2 minimum, pay what you want

### License Key Format
```
XXXXX-XXXXX-XXXXX-XXXXX
```

### Developer/Owner Keys (bypass API validation)
These keys work offline and never expire:
```
VOLUX-OWNER-DEV00-KEY01
VOLUX-ADMIN-DEV00-KEY02
```

To add more developer keys, edit `background/background.js`:
```javascript
const DEV_LICENSE_KEYS = [
  'VOLUX-OWNER-DEV00-KEY01',
  'VOLUX-ADMIN-DEV00-KEY02',
  // Add more keys here
];
```

### License Validation Flow
1. User enters license key in popup/options page
2. Extension checks if it's a developer key (bypass)
3. If not, validates against LemonSqueezy API:
   - POST `https://api.lemonsqueezy.com/v1/licenses/activate`
4. On success: stores license locally, auto-adds media domains
5. On startup: validates stored license is still active

### Auto-Add Media Domains
When Pro license is activated, the extension automatically:
1. Scans all open tabs
2. Finds tabs on known media sites (40+ domains) or playing audio
3. Adds those domains to the managed list

Known media domains include:
- youtube.com, spotify.com, netflix.com, twitch.tv
- facebook.com, twitter.com, instagram.com, tiktok.com
- zoom.us, meet.google.com, discord.com, slack.com
- And 30+ more streaming/media sites

### Popup Header Buttons
The popup header contains two action buttons:

| Button | Icon | Availability | Function |
|--------|------|--------------|----------|
| Scan Tabs | 🔍 Magnifying glass | Pro only | Scans open tabs for media sites and adds them |
| Settings | ⚙️ Gear | All users | Opens the options/settings page |

### Scan Tabs Feature (Pro Only)
Pro users can manually scan and add media domains at any time by clicking the magnifying glass icon in the header. This scans all open tabs and adds any media domains found.

---

## Post-Publishing Checklist

- [ ] Extension approved on Chrome Web Store
- [ ] Extension approved on Firefox Add-ons
- [ ] Test installation from store
- [ ] Test license activation with real purchase
- [ ] Test developer key works
- [ ] Verify auto-add media domains works
- [ ] Share store links on social media
- [ ] Add store links to README.md
- [ ] Update landing page with store links

---

## Updating the Extension

### Chrome
1. Increment version in `manifest.json`
2. Run `./build.sh`
3. Go to Developer Dashboard → Your extension → Package → Upload new package

### Firefox
1. Increment version in `manifest.firefox.json`
2. Run `./build.sh`
3. Create new ZIP: `cd dist && zip -r firefox.zip firefox/`
4. Go to Developer Hub → Your extension → Upload New Version

---

## Store Links (Update after publishing)

- **Chrome:** `https://chrome.google.com/webstore/detail/volux/[EXTENSION_ID]`
- **Firefox:** `https://addons.mozilla.org/en-US/firefox/addon/volux-premium-volume-control/`
- **Website:** https://volux.devlifeeasy.com
- **Buy Pro:** https://vannk.lemonsqueezy.com/checkout

---

## Support

- **Email:** support@devlifeeasy.com
- **GitHub Issues:** https://github.com/vannk84/volux/issues
- **Website:** https://volux.devlifeeasy.com

---

## Marketing Assets

| File | Size | Purpose |
|------|------|---------|
| `screenshot-clean.png` | 380px | Raw popup screenshot |
| `screenshot-clean-1280x800.png` | 1280x800 | Store screenshot (main) |
| `screenshot-clean-640x400.png` | 640x400 | Store screenshot (alt) |
| `screenshot-options.png` | 700px | Options page raw |
| `screenshot-options-1280x800.png` | 1280x800 | Store screenshot (settings) |
| `screenshot-upgrade.png` | 450px | Upgrade modal raw |
| `screenshot-upgrade-1280x800.png` | 1280x800 | Store screenshot (upgrade) |
| `store-marquee-1400x560.png` | 1400x560 | Chrome marquee promo |
| `promo-tile-440x280.png` | 440x280 | Small promo tile |
| `hero-banner.png` | - | Hero banner for website |

---

## Architecture

```
volux/
├── manifest.json          # Chrome manifest
├── manifest.firefox.json  # Firefox manifest
├── background/
│   └── background.js      # Service worker (license validation, domain management)
├── content/
│   └── content.js         # Volume control via Web Audio API
├── popup/
│   ├── popup.html         # Main popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styles
├── options/
│   ├── options.html       # Settings page
│   ├── options.js         # Settings logic
│   └── options.css        # Settings styles
├── icons/                 # Extension icons
├── docs/
│   └── index.html         # Landing page (GitHub Pages)
└── marketing/             # Store screenshots and mockups
```

### Popup UI Layout

```
┌─────────────────────────────────────┐
│ [🔊 VOLUX]           [🔍] [⚙️]     │  ← Header (scan: Pro only, settings: all)
├─────────────────────────────────────┤
│ [Enter domain...        ] [+]       │  ← Add domain form
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🌐 youtube.com          2 tabs  │ │  ← Domain cards
│ │ [🔇] ────────●────────── 75%    │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🌐 spotify.com          1 tab   │ │
│ │ [🔊] ──────────────●──── 100%   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ⭐ Unlock unlimited domains [Upgrade]│  ← Upgrade banner (free users only)
├─────────────────────────────────────┤
│ Precision Audio Control    [🔑][PRO]│  ← Footer
└─────────────────────────────────────┘
```

---

## Key Features Summary

| Feature | Free | Pro |
|---------|------|-----|
| Per-domain volume control | ✅ | ✅ |
| Smart domain grouping | ✅ | ✅ |
| Instant mute | ✅ | ✅ |
| Persistent settings | ✅ | ✅ |
| Quick settings access (gear icon) | ✅ | ✅ |
| Domain limit | 2 | Unlimited |
| Auto-detect media sites on activation | ❌ | ✅ |
| Scan tabs button (header) | ❌ | ✅ |
| Priority support | ❌ | ✅ |
