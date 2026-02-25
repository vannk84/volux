// Affiliate Links Configuration for Volux
// Fetches config from background script (which handles remote fetch to bypass CORS)

// Default/fallback config (used if remote fetch fails)
const DEFAULT_CONFIG = {
  enabled: true,
  geo: {
    enabled: true,
    vietnam: ['shopee', 'tiktok'],
    global: ['binance']
  },
  platforms: [
    {
      id: 'binance',
      name: 'Binance',
      icon: 'B',
      color: '#F0B90B',
      region: 'global',
      active: true,
      links: [
        {
          id: 'binance-signup',
          title: 'Sign Up Bonus',
          description: 'Get up to $100 USDC',
          url: 'https://www.binance.com/referral/earn-together/refer2earn-usdc/claim?hl=en&ref=GRO_28502_7U3V8'
        }
      ]
    }
  ]
};

// Live config (populated from remote or cache)
let AFFILIATE_CONFIG = { ...DEFAULT_CONFIG };
let configLoaded = false;

// Browser API compatibility (avoid redeclaring if already defined by popup.js)
const affiliateBrowserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Fetch remote config via background script (bypasses CORS)
async function fetchRemoteConfig() {
  try {
    const result = await affiliateBrowserAPI.runtime.sendMessage({ type: 'GET_AFFILIATE_CONFIG' });

    if (result && result.success && result.config) {
      AFFILIATE_CONFIG = { ...DEFAULT_CONFIG, ...result.config };
      configLoaded = true;
      console.log('Affiliate config loaded from', result.source);
      return AFFILIATE_CONFIG;
    }

    // Fallback to default
    AFFILIATE_CONFIG = DEFAULT_CONFIG;
    configLoaded = true;
    return AFFILIATE_CONFIG;
  } catch (error) {
    console.warn('Failed to fetch remote config:', error.message);
    AFFILIATE_CONFIG = DEFAULT_CONFIG;
    configLoaded = true;
    return AFFILIATE_CONFIG;
  }
}

// Initialize config on load
fetchRemoteConfig();

// Carousel settings (local, not remote)
const CAROUSEL_CONFIG = {
  autoRotate: true,
  interval: 5000,
  showDots: true,
  showArrows: false
};

// Display settings
const DISPLAY_CONFIG = {
  maxPlatforms: 3,
  showInPopup: true,
  showInOptions: true
};

// Geo detection - cached result
let detectedRegion = null;

// Detect user's region (Vietnam or Global)
async function detectRegion() {
  if (detectedRegion) return detectedRegion;

  // Method 1: Check browser language
  const lang = navigator.language || navigator.userLanguage || '';
  if (lang.toLowerCase().includes('vi')) {
    detectedRegion = 'vietnam';
    return detectedRegion;
  }

  // Method 2: Check timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (timezone.includes('Ho_Chi_Minh') || timezone.includes('Saigon')) {
    detectedRegion = 'vietnam';
    return detectedRegion;
  }

  // Method 3: IP Geolocation API
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    detectedRegion = data.country_code === 'VN' ? 'vietnam' : 'global';
  } catch (e) {
    detectedRegion = 'global';
  }

  return detectedRegion;
}

// Sync version using cached result
function getRegionSync() {
  if (detectedRegion) return detectedRegion;

  const lang = navigator.language || navigator.userLanguage || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

  if (lang.toLowerCase().includes('vi') ||
      timezone.includes('Ho_Chi_Minh') ||
      timezone.includes('Saigon')) {
    return 'vietnam';
  }
  return 'global';
}

// Get active platforms based on region
function getActivePlatforms(region = null) {
  const userRegion = region || getRegionSync();
  const platforms = AFFILIATE_CONFIG.platforms || [];

  let filtered = platforms.filter(p => {
    if (!p.active || !p.links || !p.links.length) return false;
    if (!AFFILIATE_CONFIG.geo?.enabled) return true;
    return p.region === userRegion;
  });

  // Fallback to global (crypto) if no platforms found
  if (filtered.length === 0) {
    filtered = platforms.filter(p =>
      p.active && p.links && p.links.length > 0 && p.region === 'global'
    );
  }

  return filtered;
}

// Get config (ensures remote config is loaded)
async function getConfig() {
  if (!configLoaded) {
    await fetchRemoteConfig();
  }
  return AFFILIATE_CONFIG;
}

// Check if affiliate links should be displayed
function shouldShowAffiliateLinks() {
  return AFFILIATE_CONFIG.enabled && getActivePlatforms().length > 0;
}

// Carousel state management
const carouselState = {};

function initCarousel(platformId, totalLinks) {
  if (!carouselState[platformId]) {
    carouselState[platformId] = { currentIndex: 0, totalLinks };
  }
  return carouselState[platformId];
}

function nextSlide(platformId) {
  const state = carouselState[platformId];
  if (state) {
    state.currentIndex = (state.currentIndex + 1) % state.totalLinks;
    return state.currentIndex;
  }
  return 0;
}

function prevSlide(platformId) {
  const state = carouselState[platformId];
  if (state) {
    state.currentIndex = (state.currentIndex - 1 + state.totalLinks) % state.totalLinks;
    return state.currentIndex;
  }
  return 0;
}

function goToSlide(platformId, index) {
  const state = carouselState[platformId];
  if (state && index >= 0 && index < state.totalLinks) {
    state.currentIndex = index;
    return state.currentIndex;
  }
  return 0;
}

function getCurrentIndex(platformId) {
  return carouselState[platformId]?.currentIndex || 0;
}

// Get carousel config
function getCarouselConfig() {
  return CAROUSEL_CONFIG;
}

// Get display config
function getDisplayConfig() {
  return DISPLAY_CONFIG;
}
