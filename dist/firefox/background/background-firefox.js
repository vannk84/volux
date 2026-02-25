// Background script for Volux (Firefox version)
// Manages volume states by domain and communication between popup and content scripts

const STORAGE_KEY = 'volux_saved_states';
const AFFILIATE_CONFIG_URL = 'https://volux.devlifeeasy.com/affiliate-config.json';
const AFFILIATE_CACHE_KEY = 'volux_affiliate_config';
const AFFILIATE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

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

// Get all domains with their tabs grouped
async function getDomains() {
  const tabs = await browser.tabs.query({});
  const savedStates = await loadSavedStates();
  const domainMap = new Map();

  for (const tab of tabs) {
    const origin = getOrigin(tab.url);
    const domain = getDomain(tab.url);

    if (!origin || !domain) continue;

    // Skip browser internal pages
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('moz-extension://')) {
      continue;
    }

    if (!domainMap.has(origin)) {
      const saved = savedStates[origin] || { volume: 100, muted: false };
      domainMap.set(origin, {
        origin,
        domain,
        volume: saved.volume,
        muted: saved.muted,
        tabs: [],
        audible: false,
        favIconUrl: tab.favIconUrl || ''
      });
    }

    const domainEntry = domainMap.get(origin);
    domainEntry.tabs.push({
      id: tab.id,
      title: tab.title || 'Untitled',
      audible: tab.audible || false,
      hasAudio: tabsWithAudio.has(tab.id)
    });

    // Domain is audible if any tab is audible
    if (tab.audible) {
      domainEntry.audible = true;
    }

    // Use first available favicon
    if (!domainEntry.favIconUrl && tab.favIconUrl) {
      domainEntry.favIconUrl = tab.favIconUrl;
    }
  }

  return Array.from(domainMap.values());
}

// Set volume for all tabs of a domain
async function setDomainVolume(origin, volume) {
  await saveStateForOrigin(origin, volume, false);

  const tabs = await browser.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    if (getOrigin(tab.url) === origin) {
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

// Mute/unmute all tabs of a domain
async function setDomainMuted(origin, muted) {
  const saved = await getSavedStateForOrigin(origin);
  const volume = saved?.volume ?? 100;
  await saveStateForOrigin(origin, volume, muted);

  const tabs = await browser.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    if (getOrigin(tab.url) === origin) {
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

// Listen for messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender) => {
  return new Promise(async (resolve) => {
    switch (message.type) {
      case 'GET_DOMAINS':
        resolve(await getDomains());
        break;

      case 'SET_VOLUME':
        resolve(await setDomainVolume(message.origin, message.volume));
        break;

      case 'SET_MUTED':
        resolve(await setDomainMuted(message.origin, message.muted));
        break;

      case 'AUDIO_DETECTED':
        if (sender.tab) {
          tabsWithAudio.add(sender.tab.id);
        }
        resolve(true);
        break;

      case 'GET_TAB_STATE':
        if (sender.tab) {
          const origin = getOrigin(sender.tab.url);
          const saved = await getSavedStateForOrigin(origin);
          resolve(saved || { volume: 100, muted: false });
        } else {
          resolve(null);
        }
        break;

      case 'GET_AFFILIATE_CONFIG':
        resolve(await fetchAffiliateConfig());
        break;

      default:
        resolve(null);
    }
  });
});

// Fetch affiliate config (background script bypasses CORS)
async function fetchAffiliateConfig() {
  try {
    // Check cache first
    const result = await browser.storage.local.get(AFFILIATE_CACHE_KEY);
    const cached = result[AFFILIATE_CACHE_KEY];
    if (cached && cached.config && Date.now() - cached.timestamp < AFFILIATE_CACHE_DURATION) {
      return { success: true, config: cached.config, source: 'cache' };
    }

    // Fetch from remote
    const response = await fetch(AFFILIATE_CONFIG_URL, {
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const config = await response.json();

    // Cache the config
    await browser.storage.local.set({
      [AFFILIATE_CACHE_KEY]: { config, timestamp: Date.now() }
    });

    return { success: true, config, source: 'remote' };
  } catch (error) {
    console.warn('Failed to fetch affiliate config:', error.message);
    return { success: false, error: error.message };
  }
}

// Clean up when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  tabsWithAudio.delete(tabId);
});

// Apply saved state when navigating to a new origin
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const origin = getOrigin(changeInfo.url);
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

console.log('Volux background script loaded (Firefox)');
