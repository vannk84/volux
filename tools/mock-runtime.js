// Runs in the target page BEFORE any other script, injected via
// puppeteer's evaluateOnNewDocument. Installs a chrome/browser shim
// that returns data shaped like the real background service worker,
// so popup.html + popup.js render exactly as they would for a real
// user — without needing a loaded extension.
(() => {
  const defaultState = {
    license: { isPro: true },
    controlledCount: 2,
    freeLimit: 2,
    domains: [
      {
        origin: 'https://youtube.com',
        domain: 'youtube.com',
        volume: 40,
        muted: false,
        audible: true,
        favIconUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
        tabs: [
          {
            id: 101,
            title: 'RIDE WEST: Cinematic Western Music',
            url: 'https://www.youtube.com/watch?v=pWvHtwFawx4&list=RDpWvHtwFawx4&start_radio=1',
            favIconUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
            audible: true,
            hasAudio: true,
            hasOverride: false,
            volume: 40,
            muted: false
          },
          {
            id: 102,
            title: 'The Old Man and The Sea — Learn English Through Stories',
            url: 'https://www.youtube.com/watch?v=qZZpD03mW7E',
            favIconUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
            audible: true,
            hasAudio: true,
            hasOverride: false,
            volume: 40,
            muted: false
          },
          {
            id: 103,
            title: 'Mysteries of the Universe — Space Documentary',
            url: 'https://www.youtube.com/watch?v=egDIqKLt2L4',
            favIconUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
            audible: true,
            hasAudio: true,
            hasOverride: false,
            volume: 40,
            muted: false
          }
        ]
      },
      {
        origin: 'https://spotify.com',
        domain: 'spotify.com',
        volume: 65,
        muted: false,
        audible: false,
        favIconUrl: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64',
        tabs: [
          {
            id: 201,
            title: 'Daily Mix 1 — Spotify',
            url: 'https://open.spotify.com/playlist/xyz',
            favIconUrl: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64',
            audible: false,
            hasAudio: true,
            hasOverride: false,
            volume: 65,
            muted: false
          }
        ]
      }
    ]
  };

  // Expose the mutable state so the puppeteer driver can flip modes
  // between shots (free↔pro, toggle overrides, etc.).
  // A capture script can stage a scenario by setting window.__VOLUX_MOCK_STATE__
  // (same shape as defaultState, plus optional openTabs / activeTabId) before
  // this file runs. openTabs are tabs on sites that are NOT managed yet; they
  // feed the popup's quick-add row and the Scan button.
  const state = window.__VOLUX_MOCK_STATE__
    ? JSON.parse(JSON.stringify(window.__VOLUX_MOCK_STATE__))
    : defaultState;
  state.openTabs = state.openTabs || [];

  const managedTabs = () => state.domains.flatMap(d => d.tabs);
  const allTabs = () => [...managedTabs(), ...state.openTabs].map(t => ({
    id: t.id, url: t.url, title: t.title, favIconUrl: t.favIconUrl, audible: !!t.audible
  }));
  const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '');
  const atLimit = () => !state.license.isPro && state.domains.length >= state.freeLimit;

  // Promote an open tab's site to a managed domain (ADD_DOMAIN / scan).
  function manage(domain) {
    const tabs = state.openTabs.filter(t => hostOf(t.url) === domain || hostOf(t.url).endsWith('.' + domain));
    state.openTabs = state.openTabs.filter(t => !tabs.includes(t));
    state.domains.push({
      origin: `https://${domain}`, domain, volume: 100, muted: false,
      audible: tabs.some(t => t.audible),
      favIconUrl: tabs[0]?.favIconUrl || '',
      tabs: tabs.map(t => ({ ...t, hasAudio: true, hasOverride: false, volume: 100, muted: false }))
    });
  }

  window.__voluxMock = {
    state,
    setLicense(isPro) { state.license = { isPro }; },
    setTabVolume(tabId, volume) {
      for (const d of state.domains) {
        const t = d.tabs.find(x => x.id === tabId);
        if (t) { t.volume = volume; t.hasOverride = true; return; }
      }
    },
    setTabMuted(tabId, muted) {
      for (const d of state.domains) {
        const t = d.tabs.find(x => x.id === tabId);
        if (t) { t.muted = muted; t.hasOverride = true; return; }
      }
    },
    clearTabOverride(tabId) {
      for (const d of state.domains) {
        const t = d.tabs.find(x => x.id === tabId);
        if (t) {
          t.hasOverride = false;
          t.volume = d.volume;
          t.muted = d.muted;
          return;
        }
      }
    }
  };

  const respond = async (message) => {
    switch (message.type) {
      case 'GET_DOMAINS':
        // Deep-clone so popup can't mutate state directly.
        return {
          domains: JSON.parse(JSON.stringify(state.domains)),
          license: { ...state.license },
          controlledCount: state.domains.length,
          freeLimit: state.freeLimit
        };
      case 'VALIDATE_LICENSE':
        return { valid: true, reason: 'mock' };
      case 'GET_LICENSE':
        return { ...state.license };
      case 'SET_VOLUME':
        if (typeof message.tabId === 'number') {
          window.__voluxMock.setTabVolume(message.tabId, message.volume);
          return { success: true, tabId: message.tabId };
        }
        // Domain-level: update the domain volume, cascade to non-override tabs.
        for (const d of state.domains) {
          if (d.origin === message.origin) {
            d.volume = message.volume;
            d.muted = false;
            for (const t of d.tabs) if (!t.hasOverride) t.volume = message.volume;
            break;
          }
        }
        return [];
      case 'SET_MUTED':
        if (typeof message.tabId === 'number') {
          window.__voluxMock.setTabMuted(message.tabId, message.muted);
          return { success: true, tabId: message.tabId };
        }
        for (const d of state.domains) {
          if (d.origin === message.origin) {
            d.muted = message.muted;
            for (const t of d.tabs) if (!t.hasOverride) t.muted = message.muted;
            break;
          }
        }
        return [];
      case 'CLEAR_TAB_OVERRIDE':
        window.__voluxMock.clearTabOverride(message.tabId);
        return { success: true };
      case 'GET_FREE_LIMIT':
        return state.freeLimit;
      case 'ADD_DOMAIN': {
        if (atLimit()) return { success: false, error: 'FREE_LIMIT_REACHED', limit: state.freeLimit };
        if (state.domains.some(d => d.domain === message.domain)) return { success: false, error: 'DOMAIN_EXISTS' };
        manage(message.domain);
        return { success: true };
      }
      case 'SCAN_MEDIA_TABS': {
        const addedDomains = [];
        let limitReached = false;
        const media = [...new Set(state.openTabs.filter(t => t.media || t.audible).map(t => hostOf(t.url)))];
        for (const domain of media) {
          if (atLimit()) { limitReached = true; break; }
          manage(domain); addedDomains.push(domain);
        }
        return { success: true, addedDomains, limitReached };
      }
      default:
        return null;
    }
  };

  const mockRuntime = {
    sendMessage: (msg) => Promise.resolve(respond(msg)),
    openOptionsPage: () => {}
  };

  const mockTabs = {
    query: (filter = {}) => Promise.resolve(allTabs().filter(t =>
      (!filter.active || t.id === state.activeTabId) &&
      (!filter.audible || t.audible)
    ))
  };

  const mockStorage = {
    local: {
      get: (key) => Promise.resolve(key === 'volux_initialized' ? { volux_initialized: true } : {}),
      set: () => Promise.resolve()
    },
    session: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve()
    }
  };

  const api = { runtime: mockRuntime, tabs: mockTabs, storage: mockStorage };
  window.chrome = api;
  window.browser = api;
})();
