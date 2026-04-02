// Popup script for Volux - Domain-based volume control
// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', init);

let licenseStatus = { isPro: false };
let controlledCount = 0;
let freeLimit = 2;

async function init() {
  // Setup header buttons
  setupHeaderButtons();

  // Setup modal
  setupModal();

  // Setup add domain form
  setupAddDomainForm();

  // Load and display domains (sets licenseStatus)
  await loadDomains();

  // Setup affiliate links (after loadDomains so we know if user is Pro)
  setupAffiliateLinks();

  // Refresh periodically
  setInterval(loadDomains, 2000);
}

function setupHeaderButtons() {
  const scanBtn = document.getElementById('scanTabsBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  scanBtn.addEventListener('click', () => scanMediaTabs());
  settingsBtn.addEventListener('click', () => {
    browserAPI.runtime.openOptionsPage();
  });
}

let availableDomains = [];
let selectedAutocompleteIndex = -1;

function setupAddDomainForm() {
  const input = document.getElementById('domainInput');
  const btn = document.getElementById('addDomainBtn');
  const error = document.getElementById('domainError');
  const dropdown = document.getElementById('autocompleteDropdown');

  btn.addEventListener('click', () => addDomain());

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
      updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
      updateAutocompleteSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedAutocompleteIndex >= 0 && items[selectedAutocompleteIndex]) {
        input.value = items[selectedAutocompleteIndex].dataset.domain;
        hideAutocomplete();
      }
      addDomain();
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  input.addEventListener('input', () => {
    error.textContent = '';
    showAutocomplete(input.value);
  });

  input.addEventListener('focus', () => {
    if (input.value) {
      showAutocomplete(input.value);
    } else {
      showAutocomplete('');
    }
  });

  input.addEventListener('blur', () => {
    // Delay to allow click on dropdown item
    setTimeout(() => hideAutocomplete(), 150);
  });

  // Load available domains from open tabs
  loadAvailableDomains();
}

async function loadAvailableDomains() {
  try {
    const tabs = await browserAPI.tabs.query({});
    const domains = new Map();

    for (const tab of tabs) {
      if (!tab.url) continue;
      try {
        const url = new URL(tab.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

        let domain = url.hostname.replace(/^www\./, '');
        if (!domains.has(domain)) {
          domains.set(domain, {
            domain: domain,
            favicon: tab.favIconUrl || '',
            title: tab.title || domain
          });
        }
      } catch {}
    }

    availableDomains = Array.from(domains.values());
  } catch (error) {
    console.error('Failed to load available domains:', error);
  }
}

function showAutocomplete(query) {
  const dropdown = document.getElementById('autocompleteDropdown');
  const input = document.getElementById('domainInput');
  const managedDomains = Array.from(document.querySelectorAll('.tab-item')).map(
    el => el.querySelector('.tab-title')?.textContent
  );

  query = query.toLowerCase().trim();

  // Filter domains that match query and aren't already managed
  let filtered = availableDomains.filter(d =>
    d.domain.toLowerCase().includes(query) &&
    !managedDomains.includes(d.domain)
  );

  // Limit to 5 suggestions
  filtered = filtered.slice(0, 5);

  if (filtered.length === 0) {
    hideAutocomplete();
    return;
  }

  selectedAutocompleteIndex = -1;
  dropdown.innerHTML = filtered.map((d, i) => `
    <div class="autocomplete-item" data-domain="${d.domain}" data-index="${i}">
      ${d.favicon ? `<img src="${d.favicon}" alt="" class="autocomplete-favicon">` : ''}
      <span class="domain-text">${highlightMatch(d.domain, query)}</span>
      <span class="domain-hint">open tab</span>
    </div>
  `).join('');

  // Add click handlers
  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      input.value = item.dataset.domain;
      hideAutocomplete();
      addDomain();
    });
  });

  // Add error handlers for favicon images (CSP-compliant)
  dropdown.querySelectorAll('.autocomplete-favicon').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
  });

  dropdown.classList.add('active');
}

function hideAutocomplete() {
  const dropdown = document.getElementById('autocompleteDropdown');
  dropdown.classList.remove('active');
  selectedAutocompleteIndex = -1;
}

function updateAutocompleteSelection(items) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === selectedAutocompleteIndex);
  });
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<strong style="color: var(--gold-400)">$1</strong>');
}

async function addDomain() {
  const input = document.getElementById('domainInput');
  const error = document.getElementById('domainError');
  let domain = input.value.trim().toLowerCase();

  // Remove protocol if present
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  // Remove path
  domain = domain.split('/')[0];

  if (!domain) {
    error.textContent = 'Please enter a domain';
    return;
  }

  // Basic validation
  if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
    error.textContent = 'Invalid domain format';
    return;
  }

  const result = await browserAPI.runtime.sendMessage({
    type: 'ADD_DOMAIN',
    domain: domain
  });

  if (result.success) {
    input.value = '';
    error.textContent = '';
    await loadDomains();
  } else if (result.error === 'FREE_LIMIT_REACHED') {
    error.textContent = `Free limit reached (${result.limit} domains). Upgrade to Pro!`;
    openModal();
  } else if (result.error === 'DOMAIN_EXISTS') {
    error.textContent = 'Domain already added';
  } else {
    error.textContent = 'Failed to add domain';
  }
}

async function removeDomain(domain) {
  await browserAPI.runtime.sendMessage({
    type: 'REMOVE_DOMAIN',
    domain: domain
  });
  await loadDomains();
}

function setupModal() {
  const modal = document.getElementById('upgradeModal');
  const proBadge = document.getElementById('proBadge');
  const modalClose = document.getElementById('modalClose');
  const activateBtn = document.getElementById('activateBtn');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const licenseBtn = document.getElementById('licenseBtn');
  const upgradeBannerBtn = document.getElementById('upgradeBannerBtn');

  proBadge.addEventListener('click', () => {
    if (!licenseStatus.isPro) {
      // Free users: open modal to enter license key
      openModal();
    } else {
      // Pro users: show status info
      showProStatus();
    }
  });
  modalClose.addEventListener('click', () => closeModal());
  upgradeBtn?.addEventListener('click', () => openModal());
  licenseBtn?.addEventListener('click', () => openModal());
  upgradeBannerBtn?.addEventListener('click', () => openModal());

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  activateBtn.addEventListener('click', async () => {
    const input = document.getElementById('licenseInput');
    const error = document.getElementById('licenseError');
    const key = input.value.trim();

    if (!key) {
      error.textContent = 'Please enter a license key';
      error.className = 'license-error';
      return;
    }

    const result = await browserAPI.runtime.sendMessage({
      type: 'ACTIVATE_LICENSE',
      licenseKey: key
    });

    if (result.success) {
      const addedCount = result.addedDomains?.length || 0;
      if (addedCount > 0) {
        error.textContent = `License activated! Auto-added ${addedCount} media domain${addedCount > 1 ? 's' : ''}.`;
      } else {
        error.textContent = 'License activated! Enjoy Pro features.';
      }
      error.className = 'license-error license-success';
      licenseStatus = { isPro: true };
      updateProBadge();
      // Refresh available domains for autocomplete
      loadAvailableDomains();
      setTimeout(() => {
        closeModal();
        loadDomains();
      }, 2000);
    } else {
      error.textContent = result.error || 'Invalid license key';
      error.className = 'license-error';
    }
  });
}

function openModal() {
  document.getElementById('upgradeModal').classList.add('active');
}

function closeModal() {
  document.getElementById('upgradeModal').classList.remove('active');
  document.getElementById('licenseError').textContent = '';
  document.getElementById('licenseInput').value = '';
}

function showProStatus() {
  const error = document.getElementById('domainError');
  error.textContent = '✓ Pro License Active - Unlimited domains';
  error.style.color = '#2ecc71';

  // Clear message after 3 seconds
  setTimeout(() => {
    error.textContent = '';
    error.style.color = '';
  }, 3000);
}

function updateProBadge() {
  const badge = document.getElementById('proBadge');
  const text = badge.querySelector('.pro-text');
  const upgradeBanner = document.getElementById('upgradeBanner');
  const licenseBtn = document.getElementById('licenseBtn');
  const scanBtn = document.getElementById('scanTabsBtn');

  if (licenseStatus.isPro) {
    badge.classList.add('is-pro');
    text.textContent = 'PRO';
    upgradeBanner?.classList.add('hidden');
    licenseBtn?.classList.add('hidden');
    scanBtn?.classList.remove('hidden');
  } else {
    badge.classList.remove('is-pro');
    text.textContent = 'FREE';
    upgradeBanner?.classList.remove('hidden');
    licenseBtn?.classList.remove('hidden');
    scanBtn?.classList.add('hidden');
  }
}

async function scanMediaTabs() {
  const scanBtn = document.getElementById('scanTabsBtn');
  const error = document.getElementById('domainError');

  // Show scanning animation
  scanBtn.classList.add('scanning');
  scanBtn.disabled = true;
  error.textContent = 'Scanning open tabs...';
  error.style.color = 'var(--text-secondary)';

  try {
    const result = await browserAPI.runtime.sendMessage({ type: 'SCAN_MEDIA_TABS' });

    if (result.addedDomains && result.addedDomains.length > 0) {
      error.textContent = `Added ${result.addedDomains.length} media domain${result.addedDomains.length > 1 ? 's' : ''}!`;
      error.style.color = '#2ecc71';
      await loadDomains();
      loadAvailableDomains();
    } else {
      error.textContent = 'No new media domains found in open tabs.';
      error.style.color = 'var(--text-muted)';
    }
  } catch (err) {
    error.textContent = 'Failed to scan tabs.';
    error.style.color = '#e74c3c';
  }

  // Remove scanning animation
  scanBtn.classList.remove('scanning');
  scanBtn.disabled = false;

  // Clear message after 3 seconds
  setTimeout(() => {
    error.textContent = '';
  }, 3000);
}


async function loadDomains() {
  try {
    // Validate license on each popup open (catches refunds quickly)
    await browserAPI.runtime.sendMessage({ type: 'VALIDATE_LICENSE' });

    const response = await browserAPI.runtime.sendMessage({ type: 'GET_DOMAINS' });
    licenseStatus = response.license || { isPro: false };
    controlledCount = response.controlledCount || 0;
    freeLimit = response.freeLimit || 2;

    // Auto-add domains from all open tabs only on first ever load
    if (response.domains.length === 0) {
      const initialized = await browserAPI.storage.local.get('volux_initialized');
      if (!initialized.volux_initialized) {
        await autoAddCurrentDomains();
        await browserAPI.storage.local.set({ volux_initialized: true });
        // Reload after adding
        const newResponse = await browserAPI.runtime.sendMessage({ type: 'GET_DOMAINS' });
        controlledCount = newResponse.controlledCount || 0;
        updateProBadge();
        renderDomains(newResponse.domains);
        return;
      }
    }

    updateProBadge();
    renderDomains(response.domains);
  } catch (error) {
    console.error('Failed to load domains:', error);
  }
}

async function autoAddCurrentDomains() {
  try {
    const tabs = await browserAPI.tabs.query({});
    const preferredDomains = ['youtube.com', 'google.com', 'spotify.com', 'facebook.com'];
    const foundDomains = new Set();
    const preferredFound = [];
    const otherFound = [];

    // Collect all unique domains from open tabs
    for (const tab of tabs) {
      if (!tab.url) continue;

      try {
        const url = new URL(tab.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

        let domain = url.hostname.replace(/^www\./, '');

        if (foundDomains.has(domain)) continue;
        foundDomains.add(domain);

        // Check if it's a preferred domain
        if (preferredDomains.includes(domain)) {
          preferredFound.push(domain);
        } else {
          otherFound.push(domain);
        }
      } catch {
        // Invalid URL, skip
      }
    }

    // Prioritize preferred domains, then fill with others
    const domainsToAdd = [...preferredFound, ...otherFound].slice(0, freeLimit);

    // Add domains
    for (const domain of domainsToAdd) {
      const result = await browserAPI.runtime.sendMessage({
        type: 'ADD_DOMAIN',
        domain: domain
      });

      if (result.error === 'FREE_LIMIT_REACHED') {
        break;
      }
    }
  } catch (error) {
    console.error('Failed to auto-add domains:', error);
  }
}

function renderDomains(domains) {
  const tabsList = document.getElementById('tabsList');
  const noTabs = document.getElementById('noTabs');
  const addDomainBtn = document.getElementById('addDomainBtn');

  // Disable add button if at free limit
  if (!licenseStatus.isPro && controlledCount >= freeLimit) {
    addDomainBtn.disabled = true;
    addDomainBtn.title = 'Upgrade to Pro to add more domains';
  } else {
    addDomainBtn.disabled = false;
    addDomainBtn.title = 'Add Domain';
  }

  if (domains.length === 0) {
    tabsList.innerHTML = '';
    noTabs.style.display = 'block';
    return;
  }

  noTabs.style.display = 'none';

  // Sort: audible domains first, then by domain name
  domains.sort((a, b) => {
    if (a.audible && !b.audible) return -1;
    if (!a.audible && b.audible) return 1;
    return a.domain.localeCompare(b.domain);
  });

  // No locking needed - limit is enforced when adding
  domains.forEach(domain => {
    domain.isLocked = false;
  });

  tabsList.innerHTML = domains.map(domain => createDomainHTML(domain)).join('');

  // Attach event listeners
  domains.forEach(domain => {
    if (domain.isLocked) return; // Skip locked domains

    const originKey = encodeOriginKey(domain.origin);
    const slider = document.getElementById(`slider-${originKey}`);
    const muteBtn = document.getElementById(`mute-${originKey}`);

    if (slider) {
      slider.addEventListener('input', (e) => handleVolumeChange(domain.origin, e.target.value, originKey));
      updateSliderBackground(slider);
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => handleMuteToggle(domain.origin, !domain.muted));
    }
  });

  // Attach remove button listeners
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const domain = btn.dataset.domain;
      if (domain) {
        removeDomain(domain);
      }
    });
  });

  // Add error handlers for favicon images (CSP-compliant)
  document.querySelectorAll('.tab-favicon').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
  });
}

// Encode origin to be safe for use as element ID
function encodeOriginKey(origin) {
  return btoa(origin).replace(/[+/=]/g, '_');
}

function createDomainHTML(domain) {
  const originKey = encodeOriginKey(domain.origin);
  const tabCount = domain.tabs.length;

  const faviconHTML = domain.favIconUrl
    ? `<img class="tab-favicon" src="${escapeHTML(domain.favIconUrl)}" alt="">`
    : `<div class="tab-favicon-placeholder">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
       </div>`;

  const audibleHTML = domain.audible
    ? `<span class="audible-indicator" title="Playing audio">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
       </span>`
    : '';

  const muteIconHTML = domain.muted
    ? `<svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
       </svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
       </svg>`;

  const tabCountHTML = tabCount > 1 ? `<span class="tab-count">${tabCount} tabs</span>` : '';

  const removeBtn = `
    <button class="remove-btn" data-domain="${escapeHTML(domain.domain)}" title="Remove domain">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `;

  const lockedClass = domain.isLocked ? 'locked' : '';
  const isDisabled = domain.muted || domain.isLocked;

  return `
    <div class="tab-item ${domain.audible ? 'audible' : ''} ${lockedClass}" data-origin="${escapeHTML(domain.origin)}">
      <div class="tab-header">
        ${faviconHTML}
        <span class="tab-title" title="${escapeHTML(domain.domain)}">${escapeHTML(domain.domain)}</span>
        ${tabCountHTML}
        ${audibleHTML}
        ${removeBtn}
      </div>
      <div class="tab-controls">
        <button class="mute-btn ${domain.muted ? 'muted' : ''}" id="mute-${originKey}" title="${domain.muted ? 'Unmute' : 'Mute'}" ${domain.isLocked ? 'disabled' : ''}>
          ${muteIconHTML}
        </button>
        <div class="volume-slider-container">
          <input
            type="range"
            class="volume-slider"
            id="slider-${originKey}"
            min="0"
            max="100"
            value="${domain.volume}"
            ${isDisabled ? 'disabled' : ''}
          >
          <span class="volume-value" id="value-${originKey}">${domain.volume}%</span>
        </div>
      </div>
    </div>
  `;
}

async function handleVolumeChange(origin, volume, originKey) {
  const volumeValue = document.getElementById(`value-${originKey}`);
  const slider = document.getElementById(`slider-${originKey}`);

  if (volumeValue) {
    volumeValue.textContent = `${volume}%`;
  }

  if (slider) {
    updateSliderBackground(slider);
  }

  const result = await browserAPI.runtime.sendMessage({
    type: 'SET_VOLUME',
    origin: origin,
    volume: parseInt(volume)
  });

  // Handle free limit reached
  if (result && result.error === 'FREE_LIMIT_REACHED') {
    openModal();
    // Reset slider to 100
    if (slider) {
      slider.value = 100;
      updateSliderBackground(slider);
    }
    if (volumeValue) {
      volumeValue.textContent = '100%';
    }
  }
}

async function handleMuteToggle(origin, muted) {
  await browserAPI.runtime.sendMessage({
    type: 'SET_MUTED',
    origin: origin,
    muted: muted
  });

  // Reload to update UI
  await loadDomains();
}

function updateSliderBackground(slider) {
  const value = slider.value;
  // Use CSS custom property for cross-browser compatibility
  // Chrome/Safari use this via background gradient, Firefox uses ::-moz-range-progress
  slider.style.setProperty('--slider-progress', `${value}%`);
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Affiliate Links Functions
const affiliateIntervals = {};

async function setupAffiliateLinks() {
  const affiliateSection = document.getElementById('affiliateSection');
  const affiliateLinksContainer = document.getElementById('affiliateLinks');

  // Check user preference
  // Pro users: default OFF (but can opt-in via options page)
  // Free users: default ON (can opt-out)
  const data = await browserAPI.storage.local.get('volux_show_affiliate');
  let showAffiliate;
  if (data.volux_show_affiliate === undefined) {
    showAffiliate = !licenseStatus.isPro; // Default based on license
  } else {
    showAffiliate = data.volux_show_affiliate;
  }

  if (!showAffiliate) {
    affiliateSection.classList.add('hidden');
    return;
  }

  // Check if affiliate config exists and is enabled
  if (typeof AFFILIATE_CONFIG === 'undefined' ||
      typeof shouldShowAffiliateLinks === 'undefined' ||
      !shouldShowAffiliateLinks()) {
    affiliateSection.classList.add('hidden');
    return;
  }

  // Check display settings
  if (typeof DISPLAY_CONFIG === 'undefined' || !DISPLAY_CONFIG.showInPopup) {
    affiliateSection.classList.add('hidden');
    return;
  }

  // Get platforms for detected region
  const region = getRegionSync();
  const platforms = getActivePlatforms(region);

  if (platforms.length === 0) {
    affiliateSection.classList.add('hidden');
    return;
  }

  // Render platforms with carousels
  affiliateLinksContainer.innerHTML = `<div class="affiliate-platforms">${
    platforms.map(platform => createPlatformCarouselHTML(platform)).join('')
  }</div>`;

  // Initialize carousels
  platforms.forEach(platform => {
    initCarousel(platform.id, platform.links.length);
    setupCarouselEvents(platform);

    // Auto-rotate if enabled
    if (CAROUSEL_CONFIG.autoRotate && platform.links.length > 1) {
      startAutoRotate(platform.id);
    }
  });

  affiliateSection.classList.remove('hidden');

  // Async: verify region with IP API and re-render if different
  if (AFFILIATE_CONFIG.geo.enabled) {
    detectRegion().then(verifiedRegion => {
      if (verifiedRegion !== region) {
        setupAffiliateLinks(); // Re-render with correct region
      }
    });
  }
}

function createPlatformCarouselHTML(platform) {
  const showDots = CAROUSEL_CONFIG.showDots && platform.links.length > 1;
  const showArrows = CAROUSEL_CONFIG.showArrows && platform.links.length > 1;

  return `
    <div class="affiliate-carousel" data-platform="${platform.id}" style="--affiliate-color: ${escapeHTML(platform.color)}">
      <div class="carousel-track" id="track-${platform.id}">
        ${platform.links.map((link, index) => `
          <div class="carousel-slide" data-index="${index}">
            <a href="${escapeHTML(link.url)}"
               target="_blank"
               rel="noopener noreferrer"
               class="affiliate-link">
              <span class="affiliate-link-icon" style="background: ${escapeHTML(platform.color)}">
                ${escapeHTML(platform.icon)}
              </span>
              <span class="affiliate-link-content">
                <span class="affiliate-link-header">
                  <span class="affiliate-link-platform">${escapeHTML(platform.name)}</span>
                </span>
                <span class="affiliate-link-title">${escapeHTML(link.title)}</span>
                <span class="affiliate-link-desc">${escapeHTML(link.description)}</span>
              </span>
            </a>
          </div>
        `).join('')}
      </div>
      ${showArrows ? `
        <div class="carousel-arrows">
          <button class="carousel-arrow prev" data-platform="${platform.id}">‹</button>
          <button class="carousel-arrow next" data-platform="${platform.id}">›</button>
        </div>
      ` : ''}
      ${showDots ? `
        <div class="carousel-dots" id="dots-${platform.id}">
          ${platform.links.map((_, i) => `
            <button class="carousel-dot ${i === 0 ? 'active' : ''}" data-platform="${platform.id}" data-index="${i}"></button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function setupCarouselEvents(platform) {
  const carousel = document.querySelector(`.affiliate-carousel[data-platform="${platform.id}"]`);
  if (!carousel) return;

  // Dot navigation
  carousel.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const index = parseInt(dot.dataset.index);
      goToSlide(platform.id, index);
      updateCarouselUI(platform.id);
      resetAutoRotate(platform.id);
    });
  });

  // Arrow navigation
  carousel.querySelectorAll('.carousel-arrow').forEach(arrow => {
    arrow.addEventListener('click', () => {
      if (arrow.classList.contains('prev')) {
        prevSlide(platform.id);
      } else {
        nextSlide(platform.id);
      }
      updateCarouselUI(platform.id);
      resetAutoRotate(platform.id);
    });
  });

  // Pause on hover
  carousel.addEventListener('mouseenter', () => stopAutoRotate(platform.id));
  carousel.addEventListener('mouseleave', () => {
    if (CAROUSEL_CONFIG.autoRotate && platform.links.length > 1) {
      startAutoRotate(platform.id);
    }
  });
}

function updateCarouselUI(platformId) {
  const index = getCurrentIndex(platformId);
  const track = document.getElementById(`track-${platformId}`);
  const dots = document.getElementById(`dots-${platformId}`);

  if (track) {
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  if (dots) {
    dots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }
}

function startAutoRotate(platformId) {
  stopAutoRotate(platformId);
  affiliateIntervals[platformId] = setInterval(() => {
    nextSlide(platformId);
    updateCarouselUI(platformId);
  }, CAROUSEL_CONFIG.interval);
}

function stopAutoRotate(platformId) {
  if (affiliateIntervals[platformId]) {
    clearInterval(affiliateIntervals[platformId]);
    delete affiliateIntervals[platformId];
  }
}

function resetAutoRotate(platformId) {
  stopAutoRotate(platformId);
  const platform = AFFILIATE_CONFIG.platforms.find(p => p.id === platformId);
  if (CAROUSEL_CONFIG.autoRotate && platform?.links.length > 1) {
    startAutoRotate(platformId);
  }
}
