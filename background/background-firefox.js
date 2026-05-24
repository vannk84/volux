// Background script for Volux (Firefox version)
// Manages volume states by domain and communication between popup and content scripts

const STORAGE_KEY = 'volux_saved_states';
const LICENSE_KEY = 'volux_license';
const MANAGED_DOMAINS_KEY = 'volux_managed_domains';
const TAB_OVERRIDES_KEY = 'volux_tab_overrides';
const FREE_DOMAIN_LIMIT = 2;

// SHA-256 hashes of developer/owner license keys that bypass API validation.
// The plaintext keys are never stored in the shipped source so they can't be
// lifted from the extension bundle. To rotate or add a key, hash it with
// SHA-256 (lowercase hex) and add the digest here.
const DEV_LICENSE_KEY_HASHES = [
  '6f00dbabaeaf7302a1104113cbf3e1addf5e33929db958aa83e5b316cc0054d0'
];

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function isDevLicenseKey(key) {
  try {
    const hash = await sha256Hex(key);
    return DEV_LICENSE_KEY_HASHES.includes(hash);
  } catch {
    return false;
  }
}

// In-memory cache of per-tab volume overrides (PRO feature).
// Shape: { [tabId]: { volume: 0-100, muted: boolean, domain: string } }
// Persisted to browser.storage.session so it survives background-page
// restarts but clears on browser close (tab IDs are invalid after that).
let tabOverrides = {};

async function loadTabOverrides() {
  try {
    const result = await browser.storage.session.get(TAB_OVERRIDES_KEY);
    tabOverrides = result[TAB_OVERRIDES_KEY] || {};
  } catch {
    tabOverrides = {};
  }
}

async function persistTabOverrides() {
  try {
    await browser.storage.session.set({ [TAB_OVERRIDES_KEY]: tabOverrides });
  } catch {}
}

const tabOverridesReady = loadTabOverrides();

// Known audio/video domains to auto-add on Pro activation
const MEDIA_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'spotify.com',
  'netflix.com',
  'twitch.tv',
  'soundcloud.com',
  'vimeo.com',
  'dailymotion.com',
  'hulu.com',
  'disneyplus.com',
  'primevideo.com',
  'hbomax.com',
  'peacocktv.com',
  'pandora.com',
  'deezer.com',
  'tidal.com',
  'music.apple.com',
  'music.amazon.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'discord.com',
  'slack.com',
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  'bandcamp.com',
  'mixcloud.com',
  'audiomack.com',
  'bilibili.com',
  'crunchyroll.com',
  'funimation.com',
  'plex.tv',
  'pluto.tv',
  'vudu.com',
  'podcasts.apple.com',
  'podcasts.google.com',
  'anchor.fm',
  'castbox.fm'
];

// Track which tabs have audio detected
const tabsWithAudio = new Set();

// Get origin from URL
function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Get domain (hostname) from URL for display
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Extract domain from origin (https://youtube.com -> youtube.com)
function getDomainFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

// Load saved states from storage
async function loadSavedStates() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || {};
  } catch {
    return {};
  }
}

// Save state for an origin
async function saveStateForOrigin(origin, volume, muted) {
  if (!origin) return;
  const saved = await loadSavedStates();
  saved[origin] = { volume, muted };
  await browser.storage.local.set({ [STORAGE_KEY]: saved });
}

// Get saved state for an origin
async function getSavedStateForOrigin(origin) {
  if (!origin) return null;
  const saved = await loadSavedStates();
  return saved[origin] || null;
}

// License validation
async function getLicenseStatus() {
  try {
    const result = await browser.storage.local.get(LICENSE_KEY);
    const license = result[LICENSE_KEY];
    if (license && license.key && license.activated) {
      return { isPro: true, licenseKey: license.key };
    }
    return { isPro: false };
  } catch {
    return { isPro: false };
  }
}

async function activateLicense(licenseKey) {
  // Validate license key format (LemonSqueezy format: XXXXX-XXXXX-XXXXX-XXXXX)
  const keyPattern = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i;
  if (!keyPattern.test(licenseKey)) {
    return { success: false, error: 'Invalid license key format' };
  }

  const upperKey = licenseKey.toUpperCase();

  // Check if it's a developer/owner key (bypass API validation)
  if (await isDevLicenseKey(upperKey)) {
    try {
      await browser.storage.local.set({
        [LICENSE_KEY]: {
          key: upperKey,
          activated: true,
          activatedAt: Date.now(),
          isDev: true
        }
      });
      // Auto-add media domains from open tabs
      const addedDomains = await autoAddMediaDomains();
      return { success: true, addedDomains };
    } catch (error) {
      return { success: false, error: 'Failed to save license' };
    }
  }

  // Validate against LemonSqueezy API
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        license_key: upperKey,
        instance_name: 'Volux Browser Extension'
      })
    });

    const data = await response.json();

    if (data.activated || data.valid || (data.license_key && data.license_key.status === 'active')) {
      // License is valid, store it
      await browser.storage.local.set({
        [LICENSE_KEY]: {
          key: upperKey,
          activated: true,
          activatedAt: Date.now(),
          instanceId: data.instance?.id || null,
          customerEmail: data.meta?.customer_email || null
        }
      });
      // Auto-add media domains from open tabs
      const addedDomains = await autoAddMediaDomains();
      return { success: true, addedDomains };
    } else {
      // License validation failed
      const errorMsg = data.error || data.message || 'Invalid or inactive license key';
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('License validation error:', error);
    return { success: false, error: 'Failed to validate license. Please check your internet connection.' };
  }
}

async function deactivateLicense() {
  try {
    // Get current license to check if we need to deactivate via API
    const result = await browser.storage.local.get(LICENSE_KEY);
    const license = result[LICENSE_KEY];

    // If it's an API-activated license (not dev key), deactivate via LemonSqueezy
    if (license && license.instanceId && !license.isDev) {
      try {
        await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            license_key: license.key,
            instance_id: license.instanceId
          })
        });
      } catch (apiError) {
        console.error('Failed to deactivate via API:', apiError);
        // Continue with local removal even if API call fails
      }
    }

    await browser.storage.local.remove(LICENSE_KEY);
    return { success: true };
  } catch {
    return { success: false };
  }
}

// Validate license on startup (check if still valid)
async function validateStoredLicense() {
  try {
    const result = await browser.storage.local.get(LICENSE_KEY);
    const license = result[LICENSE_KEY];

    if (!license || !license.key || !license.activated) {
      return { valid: false, reason: 'no_license' };
    }

    // Skip validation for dev keys
    if (license.isDev || await isDevLicenseKey(license.key)) {
      return { valid: true, reason: 'dev_key' };
    }

    // Validate against LemonSqueezy API
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        license_key: license.key
      })
    });

    const data = await response.json();

    // If license is no longer valid (refunded, expired, etc.), remove it
    if (!data.valid || data.license_key?.status !== 'active') {
      console.log('License is no longer valid (possibly refunded), removing...');
      await browser.storage.local.remove(LICENSE_KEY);
      return { valid: false, reason: 'license_invalid', status: data.license_key?.status };
    }

    return { valid: true, reason: 'api_validated' };
  } catch (error) {
    // Don't remove license on network errors - user might be offline
    console.error('License validation check failed:', error);
    return { valid: true, reason: 'network_error_skipped' };
  }
}

// Load managed domains list
async function getManagedDomains() {
  try {
    const result = await browser.storage.local.get(MANAGED_DOMAINS_KEY);
    return result[MANAGED_DOMAINS_KEY] || [];
  } catch {
    return [];
  }
}

// Add a domain to managed list
async function addManagedDomain(domain) {
  const managed = await getManagedDomains();
  const license = await getLicenseStatus();

  // Check free limit
  if (!license.isPro && managed.length >= FREE_DOMAIN_LIMIT) {
    return { success: false, error: 'FREE_LIMIT_REACHED', limit: FREE_DOMAIN_LIMIT };
  }

  // Check if already exists
  if (managed.includes(domain)) {
    return { success: false, error: 'DOMAIN_EXISTS' };
  }

  managed.push(domain);
  await browser.storage.local.set({ [MANAGED_DOMAINS_KEY]: managed });

  // Initialize volume state for this domain
  await saveStateForOrigin(`https://${domain}`, 100, false);

  return { success: true };
}

// Remove a domain from managed list
async function removeManagedDomain(domain) {
  let managed = await getManagedDomains();
  managed = managed.filter(d => d !== domain);
  await browser.storage.local.set({ [MANAGED_DOMAINS_KEY]: managed });

  // Remove saved state
  const saved = await loadSavedStates();
  delete saved[`https://${domain}`];
  delete saved[`http://${domain}`];
  await browser.storage.local.set({ [STORAGE_KEY]: saved });

  // Clear any per-tab overrides tied to this managed domain.
  let overridesChanged = false;
  for (const tabId of Object.keys(tabOverrides)) {
    if (tabOverrides[tabId].domain === domain) {
      delete tabOverrides[tabId];
      overridesChanged = true;
    }
  }
  if (overridesChanged) await persistTabOverrides();

  return { success: true };
}

// Get count of domains with custom volume settings
async function getControlledDomainsCount() {
  const managed = await getManagedDomains();
  return managed.length;
}

// Auto-add media domains from open tabs after Pro activation
async function autoAddMediaDomains() {
  try {
    const tabs = await browser.tabs.query({});
    const managedDomains = await getManagedDomains();
    const domainsToAdd = new Set();

    for (const tab of tabs) {
      if (!tab.url) continue;

      try {
        const url = new URL(tab.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

        let domain = url.hostname.replace(/^www\./, '');

        // Skip if already managed
        if (managedDomains.includes(domain)) continue;

        // Add if it's a known media domain
        const isMediaDomain = MEDIA_DOMAINS.some(md => domain === md || domain.endsWith('.' + md));

        // Or if the tab is currently playing audio
        if (isMediaDomain || tab.audible) {
          domainsToAdd.add(domain);
        }
      } catch {
        // Invalid URL, skip
      }
    }

    // Add all found media domains
    const addedDomains = [];
    for (const domain of domainsToAdd) {
      const result = await addManagedDomain(domain);
      if (result.success) {
        addedDomains.push(domain);
      }
    }

    console.log('Auto-added media domains:', addedDomains);
    return addedDomains;
  } catch (error) {
    console.error('Failed to auto-add media domains:', error);
    return [];
  }
}

// Check if a tab URL matches a managed domain
function tabMatchesDomain(tabUrl, managedDomain) {
  const tabDomain = getDomain(tabUrl);
  if (!tabDomain) return false;
  // Match exact domain or subdomain (e.g., www.youtube.com matches youtube.com)
  return tabDomain === managedDomain || tabDomain.endsWith('.' + managedDomain);
}

// Get all managed domains with their tabs grouped
async function getDomains() {
  const tabs = await browser.tabs.query({});
  const savedStates = await loadSavedStates();
  const managedDomains = await getManagedDomains();
  const license = await getLicenseStatus();
  const ceiling = license.isPro ? MAX_BOOST_VOLUME : 100;
  const domainMap = new Map();

  // Initialize all managed domains
  for (const domain of managedDomains) {
    const origin = `https://${domain}`;
    const saved = savedStates[origin] || savedStates[`http://${domain}`] || { volume: 100, muted: false };
    domainMap.set(domain, {
      origin,
      domain,
      // Clamp display to the license ceiling so a former-Pro boost doesn't
      // linger in the UI after a downgrade.
      volume: Math.min(saved.volume, ceiling),
      muted: saved.muted,
      tabs: [],
      audible: false,
      favIconUrl: ''
    });
  }

  // Match open tabs to managed domains
  for (const tab of tabs) {
    const tabDomain = getDomain(tab.url);
    if (!tabDomain) continue;

    // Check if this tab's domain is managed
    const matchedDomain = managedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d));

    if (matchedDomain && domainMap.has(matchedDomain)) {
      const domainEntry = domainMap.get(matchedDomain);
      const override = tabOverrides[tab.id] || null;
      domainEntry.tabs.push({
        id: tab.id,
        title: tab.title || 'Untitled',
        url: tab.url,
        favIconUrl: tab.favIconUrl || '',
        audible: tab.audible || false,
        hasAudio: tabsWithAudio.has(tab.id),
        hasOverride: !!override,
        volume: override?.volume ?? domainEntry.volume,
        muted: override?.muted ?? domainEntry.muted
      });

      if (tab.audible) {
        domainEntry.audible = true;
      }

      if (!domainEntry.favIconUrl && tab.favIconUrl) {
        domainEntry.favIconUrl = tab.favIconUrl;
      }
    }
  }

  return Array.from(domainMap.values());
}

// Boosting above 100% is a Pro feature. Free users are capped at 100% so a
// crafted message or a stale saved state can't slip an un-paid boost through.
const MAX_BOOST_VOLUME = 300;
async function clampVolumeForLicense(volume) {
  const license = await getLicenseStatus();
  const ceiling = license.isPro ? MAX_BOOST_VOLUME : 100;
  return Math.max(0, Math.min(volume, ceiling));
}

// Set volume for all tabs of a domain.
// Tabs with their own per-tab override are skipped so the override persists.
async function setDomainVolume(origin, volume) {
  volume = await clampVolumeForLicense(volume);
  await saveStateForOrigin(origin, volume, false);

  const managedDomain = getDomainFromOrigin(origin);
  if (!managedDomain) return [];

  const tabs = await browser.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    if (tabMatchesDomain(tab.url, managedDomain)) {
      if (tabOverrides[tab.id]) {
        results.push({ tabId: tab.id, skipped: 'override' });
        continue;
      }
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'SET_VOLUME',
          volume: volume / 100
        });
        results.push({ tabId: tab.id, success: true });
      } catch (error) {
        results.push({ tabId: tab.id, success: false });
      }
    }
  }

  return results;
}

// Mute/unmute all tabs of a domain.
// Tabs with their own per-tab override are skipped so the override persists.
async function setDomainMuted(origin, muted) {
  const saved = await getSavedStateForOrigin(origin);
  const volume = saved?.volume ?? 100;
  await saveStateForOrigin(origin, volume, muted);

  const managedDomain = getDomainFromOrigin(origin);
  if (!managedDomain) return [];

  const tabs = await browser.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    if (tabMatchesDomain(tab.url, managedDomain)) {
      if (tabOverrides[tab.id]) {
        results.push({ tabId: tab.id, skipped: 'override' });
        continue;
      }
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'SET_MUTED',
          muted: muted
        });
        results.push({ tabId: tab.id, success: true });
      } catch (error) {
        results.push({ tabId: tab.id, success: false });
      }
    }
  }

  return results;
}

// Resolve the managed-domain entry (e.g. "youtube.com") that a tab URL belongs to.
// We key overrides by this rather than the raw hostname so a tab navigating
// between www./m./shopping. subdomains of the same managed site keeps its
// override instead of getting wiped on every URL change.
async function resolveManagedDomainForTab(tabUrl) {
  const tabDomain = getDomain(tabUrl);
  if (!tabDomain) return null;
  const managedDomains = await getManagedDomains();
  return managedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d)) || null;
}

// Set volume for a single tab (creates/updates a per-tab override — PRO only).
async function setTabVolume(tabId, volume) {
  const license = await getLicenseStatus();
  if (!license.isPro) {
    return { success: false, error: 'PRO_REQUIRED' };
  }

  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab) return { success: false, error: 'TAB_NOT_FOUND' };

  const managedDomain = await resolveManagedDomainForTab(tab.url);
  if (!managedDomain) return { success: false, error: 'DOMAIN_NOT_MANAGED' };

  volume = Math.max(0, Math.min(volume, MAX_BOOST_VOLUME));
  const existing = tabOverrides[tabId];
  const muted = existing?.muted ?? false;

  tabOverrides[tabId] = { volume, muted, domain: managedDomain };
  await persistTabOverrides();

  try {
    await browser.tabs.sendMessage(tabId, {
      type: 'SET_VOLUME',
      volume: volume / 100
    });
    return { success: true, tabId };
  } catch {
    return { success: false, tabId };
  }
}

// Mute/unmute a single tab (creates/updates a per-tab override — PRO only).
async function setTabMuted(tabId, muted) {
  const license = await getLicenseStatus();
  if (!license.isPro) {
    return { success: false, error: 'PRO_REQUIRED' };
  }

  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab) return { success: false, error: 'TAB_NOT_FOUND' };

  const managedDomain = await resolveManagedDomainForTab(tab.url);
  if (!managedDomain) return { success: false, error: 'DOMAIN_NOT_MANAGED' };

  let volume;
  const existing = tabOverrides[tabId];
  if (existing) {
    volume = existing.volume;
  } else {
    const saved = await getSavedStateForOrigin(`https://${managedDomain}`);
    volume = saved?.volume ?? 100;
  }

  tabOverrides[tabId] = { volume, muted, domain: managedDomain };
  await persistTabOverrides();

  try {
    await browser.tabs.sendMessage(tabId, {
      type: 'SET_MUTED',
      muted: muted
    });
    return { success: true, tabId };
  } catch {
    return { success: false, tabId };
  }
}

// Clear a tab's override — tab falls back to its domain's default state.
async function clearTabOverride(tabId) {
  if (!tabOverrides[tabId]) return { success: true };
  delete tabOverrides[tabId];
  await persistTabOverrides();

  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab) return { success: true };

  const domain = getDomain(tab.url);
  const managedDomains = await getManagedDomains();
  const matched = managedDomains.find(d => domain === d || domain.endsWith('.' + d));
  if (!matched) return { success: true };

  const saved = await getSavedStateForOrigin(`https://${matched}`);
  if (!saved) return { success: true };

  try {
    await browser.tabs.sendMessage(tabId, { type: 'SET_VOLUME', volume: saved.volume / 100 });
    await browser.tabs.sendMessage(tabId, { type: 'SET_MUTED', muted: saved.muted });
  } catch {}
  return { success: true };
}

// Listen for messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender) => {
  return new Promise(async (resolve) => {
    await tabOverridesReady;
    switch (message.type) {
      case 'GET_DOMAINS':
        const domains = await getDomains();
        const license = await getLicenseStatus();
        const controlledCount = await getControlledDomainsCount();
        resolve({
          domains,
          license,
          controlledCount,
          freeLimit: FREE_DOMAIN_LIMIT
        });
        break;

      case 'SET_VOLUME':
        if (typeof message.tabId === 'number') {
          resolve(await setTabVolume(message.tabId, message.volume));
        } else {
          resolve(await setDomainVolume(message.origin, message.volume));
        }
        break;

      case 'SET_MUTED':
        if (typeof message.tabId === 'number') {
          resolve(await setTabMuted(message.tabId, message.muted));
        } else {
          resolve(await setDomainMuted(message.origin, message.muted));
        }
        break;

      case 'CLEAR_TAB_OVERRIDE':
        resolve(await clearTabOverride(message.tabId));
        break;

      case 'AUDIO_DETECTED':
        if (sender.tab) {
          tabsWithAudio.add(sender.tab.id);
        }
        resolve(true);
        break;

      case 'GET_TAB_STATE':
        if (sender.tab) {
          // Cap what content scripts actually apply at the license ceiling.
          const ceiling = (await getLicenseStatus()).isPro ? MAX_BOOST_VOLUME : 100;
          // Per-tab override takes precedence over the domain default.
          const override = tabOverrides[sender.tab.id];
          if (override) {
            resolve({ volume: Math.min(override.volume, ceiling), muted: override.muted });
            break;
          }
          const tabDomain = getDomain(sender.tab.url);
          if (tabDomain) {
            const managedDomains = await getManagedDomains();
            const matchedDomain = managedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d));
            if (matchedDomain) {
              const origin = `https://${matchedDomain}`;
              const saved = await getSavedStateForOrigin(origin);
              if (saved) {
                resolve({ volume: Math.min(saved.volume, ceiling), muted: saved.muted });
                break;
              }
            }
          }
          resolve({ volume: 100, muted: false });
        } else {
          resolve(null);
        }
        break;

      case 'GET_LICENSE':
        resolve(await getLicenseStatus());
        break;

      case 'ACTIVATE_LICENSE':
        resolve(await activateLicense(message.licenseKey));
        break;

      case 'DEACTIVATE_LICENSE':
        resolve(await deactivateLicense());
        break;

      case 'VALIDATE_LICENSE':
        resolve(await validateStoredLicense());
        break;

      case 'ADD_DOMAIN':
        resolve(await addManagedDomain(message.domain));
        break;

      case 'REMOVE_DOMAIN':
        resolve(await removeManagedDomain(message.domain));
        break;

      case 'GET_MANAGED_DOMAINS':
        resolve(await getManagedDomains());
        break;

      case 'GET_FREE_LIMIT':
        resolve(FREE_DOMAIN_LIMIT);
        break;

      case 'SCAN_MEDIA_TABS':
        const addedDomains = await autoAddMediaDomains();
        resolve({ success: true, addedDomains });
        break;

      default:
        resolve(null);
    }
  });
});

// Clean up when tabs are closed
browser.tabs.onRemoved.addListener(async (tabId) => {
  tabsWithAudio.delete(tabId);
  await tabOverridesReady;
  if (tabOverrides[tabId]) {
    delete tabOverrides[tabId];
    persistTabOverrides();
  }
});

// Apply saved state when navigating to a new URL.
// If the tab has a per-tab override and is still on the same domain, re-apply
// the override. If it has navigated to a different domain, drop the override.
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  const tabDomain = getDomain(changeInfo.url);
  if (!tabDomain) return;

  await tabOverridesReady;
  const override = tabOverrides[tabId];
  if (override) {
    const sameDomain = override.domain &&
      (tabDomain === override.domain || tabDomain.endsWith('.' + override.domain));
    if (sameDomain) {
      try {
        await browser.tabs.sendMessage(tabId, {
          type: 'SET_VOLUME',
          volume: override.volume / 100
        });
        await browser.tabs.sendMessage(tabId, {
          type: 'SET_MUTED',
          muted: override.muted
        });
      } catch {}
      return;
    }
    delete tabOverrides[tabId];
    await persistTabOverrides();
  }

  // Fall back to the domain default.
  const managedDomains = await getManagedDomains();
  const matchedDomain = managedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d));

  if (matchedDomain) {
    const origin = `https://${matchedDomain}`;
    const saved = await getSavedStateForOrigin(origin);
    if (saved) {
      try {
        await browser.tabs.sendMessage(tabId, {
          type: 'SET_VOLUME',
          volume: saved.volume / 100
        });
        await browser.tabs.sendMessage(tabId, {
          type: 'SET_MUTED',
          muted: saved.muted
        });
      } catch {
        // Content script not ready yet, it will request state on load
      }
    }
  }
});

// Run validation on startup
validateStoredLicense();

console.log('Volux background script loaded (Firefox)');
