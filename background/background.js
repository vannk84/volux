// Background service worker for Volux
// Manages volume states by domain and communication between popup and content scripts

const STORAGE_KEY = 'volux_saved_states';
const LICENSE_KEY = 'volux_license';
const MANAGED_DOMAINS_KEY = 'volux_managed_domains';
const FREE_DOMAIN_LIMIT = 2;

// Developer/Owner license keys (bypass API validation)
const DEV_LICENSE_KEYS = [
  'VOLUX-OWNER-DEV00-KEY01',
  'VOLUX-ADMIN-DEV00-KEY02'
];

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

// Auto-add media domains from open tabs after Pro activation
async function autoAddMediaDomains() {
  try {
    const tabs = await chrome.tabs.query({});
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

// License validation
async function getLicenseStatus() {
  try {
    const result = await chrome.storage.local.get(LICENSE_KEY);
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
  if (DEV_LICENSE_KEYS.includes(upperKey)) {
    try {
      await chrome.storage.local.set({
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
      await chrome.storage.local.set({
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
    const result = await chrome.storage.local.get(LICENSE_KEY);
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

    await chrome.storage.local.remove(LICENSE_KEY);
    return { success: true };
  } catch {
    return { success: false };
  }
}

// Get count of domains with custom volume settings (not default 100% unmuted)
async function getControlledDomainsCount() {
  const managed = await getManagedDomains();
  return managed.length;
}

// Load managed domains list
async function getManagedDomains() {
  try {
    const result = await chrome.storage.local.get(MANAGED_DOMAINS_KEY);
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
  await chrome.storage.local.set({ [MANAGED_DOMAINS_KEY]: managed });

  // Initialize volume state for this domain
  await saveStateForOrigin(`https://${domain}`, 100, false);

  return { success: true };
}

// Remove a domain from managed list
async function removeManagedDomain(domain) {
  let managed = await getManagedDomains();
  managed = managed.filter(d => d !== domain);
  await chrome.storage.local.set({ [MANAGED_DOMAINS_KEY]: managed });

  // Remove saved state
  const saved = await loadSavedStates();
  delete saved[`https://${domain}`];
  delete saved[`http://${domain}`];
  await chrome.storage.local.set({ [STORAGE_KEY]: saved });

  return { success: true };
}

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

// Load saved states from storage
async function loadSavedStates() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
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
  await chrome.storage.local.set({ [STORAGE_KEY]: saved });
}

// Get saved state for an origin
async function getSavedStateForOrigin(origin) {
  if (!origin) return null;
  const saved = await loadSavedStates();
  return saved[origin] || null;
}

// Get all managed domains with their tabs grouped
async function getDomains() {
  const tabs = await chrome.tabs.query({});
  const savedStates = await loadSavedStates();
  const managedDomains = await getManagedDomains();
  const domainMap = new Map();

  // Initialize all managed domains
  for (const domain of managedDomains) {
    const origin = `https://${domain}`;
    const saved = savedStates[origin] || savedStates[`http://${domain}`] || { volume: 100, muted: false };
    domainMap.set(domain, {
      origin,
      domain,
      volume: saved.volume,
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
      domainEntry.tabs.push({
        id: tab.id,
        title: tab.title || 'Untitled',
        audible: tab.audible || false,
        hasAudio: tabsWithAudio.has(tab.id)
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

// Check if a tab URL matches a managed domain
function tabMatchesDomain(tabUrl, managedDomain) {
  const tabDomain = getDomain(tabUrl);
  if (!tabDomain) return false;
  // Match exact domain or subdomain (e.g., www.youtube.com matches youtube.com)
  return tabDomain === managedDomain || tabDomain.endsWith('.' + managedDomain);
}

// Extract domain from origin (https://youtube.com -> youtube.com)
function getDomainFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

// Set volume for all tabs of a domain
async function setDomainVolume(origin, volume) {
  await saveStateForOrigin(origin, volume, false);

  const managedDomain = getDomainFromOrigin(origin);
  if (!managedDomain) return [];

  const tabs = await chrome.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    if (tabMatchesDomain(tab.url, managedDomain)) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
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

// Mute/unmute all tabs of a domain
async function setDomainMuted(origin, muted) {
  const saved = await getSavedStateForOrigin(origin);
  const volume = saved?.volume ?? 100;
  await saveStateForOrigin(origin, volume, muted);

  const managedDomain = getDomainFromOrigin(origin);
  if (!managedDomain) return [];

  const tabs = await chrome.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    if (tabMatchesDomain(tab.url, managedDomain)) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
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

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleAsync = async () => {
    switch (message.type) {
      case 'GET_DOMAINS':
        const domains = await getDomains();
        const license = await getLicenseStatus();
        const controlledCount = await getControlledDomainsCount();
        return {
          domains,
          license,
          controlledCount,
          freeLimit: FREE_DOMAIN_LIMIT
        };

      case 'SET_VOLUME':
        return await setDomainVolume(message.origin, message.volume);

      case 'SET_MUTED':
        return await setDomainMuted(message.origin, message.muted);

      case 'AUDIO_DETECTED':
        if (sender.tab) {
          tabsWithAudio.add(sender.tab.id);
        }
        return true;

      case 'GET_TAB_STATE':
        if (sender.tab) {
          const tabDomain = getDomain(sender.tab.url);
          if (tabDomain) {
            const managedDomains = await getManagedDomains();
            const matchedDomain = managedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d));
            if (matchedDomain) {
              const origin = `https://${matchedDomain}`;
              const saved = await getSavedStateForOrigin(origin);
              return saved || { volume: 100, muted: false };
            }
          }
          return { volume: 100, muted: false };
        }
        return null;

      case 'GET_LICENSE':
        return await getLicenseStatus();

      case 'ACTIVATE_LICENSE':
        return await activateLicense(message.licenseKey);

      case 'DEACTIVATE_LICENSE':
        return await deactivateLicense();

      case 'VALIDATE_LICENSE':
        // Triggered by popup to check if license is still valid
        return await validateStoredLicense();

      case 'ADD_DOMAIN':
        return await addManagedDomain(message.domain);

      case 'REMOVE_DOMAIN':
        return await removeManagedDomain(message.domain);

      case 'GET_MANAGED_DOMAINS':
        return await getManagedDomains();

      case 'GET_FREE_LIMIT':
        return FREE_DOMAIN_LIMIT;

      case 'SCAN_MEDIA_TABS':
        const addedDomains = await autoAddMediaDomains();
        return { success: true, addedDomains };

      default:
        return null;
    }
  };

  handleAsync().then(sendResponse);
  return true; // Keep message channel open for async response
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithAudio.delete(tabId);
});

// Apply saved state when navigating to a new origin
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const tabDomain = getDomain(changeInfo.url);
    if (!tabDomain) return;

    // Find if this tab's domain matches any managed domain
    const managedDomains = await getManagedDomains();
    const matchedDomain = managedDomains.find(d => tabDomain === d || tabDomain.endsWith('.' + d));

    if (matchedDomain) {
      const origin = `https://${matchedDomain}`;
      const saved = await getSavedStateForOrigin(origin);
      if (saved) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            type: 'SET_VOLUME',
            volume: saved.volume / 100
          });
          await chrome.tabs.sendMessage(tabId, {
            type: 'SET_MUTED',
            muted: saved.muted
          });
        } catch {
          // Content script not ready yet, it will request state on load
        }
      }
    }
  }
});

// Validate license on startup (check if still valid)
async function validateStoredLicense() {
  try {
    const result = await chrome.storage.local.get(LICENSE_KEY);
    const license = result[LICENSE_KEY];

    if (!license || !license.key || !license.activated) {
      return { valid: false, reason: 'no_license' };
    }

    // Skip validation for dev keys
    if (license.isDev || DEV_LICENSE_KEYS.includes(license.key)) {
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
      await chrome.storage.local.remove(LICENSE_KEY);
      return { valid: false, reason: 'license_invalid', status: data.license_key?.status };
    }

    return { valid: true, reason: 'api_validated' };
  } catch (error) {
    // Don't remove license on network errors - user might be offline
    console.error('License validation check failed:', error);
    return { valid: true, reason: 'network_error_skipped' };
  }
}

// Run validation on startup
validateStoredLicense();

console.log('Volux background script loaded');
