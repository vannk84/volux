// Volux Options Page
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadLicenseStatus();
  await loadStats();
  await loadAffiliatePreference();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('activateBtn').addEventListener('click', activateLicense);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
  document.getElementById('scanTabsBtn').addEventListener('click', scanMediaTabs);

  // Affiliate toggle
  const affiliateToggle = document.getElementById('showAffiliateToggle');
  if (affiliateToggle) {
    affiliateToggle.addEventListener('change', saveAffiliatePreference);
  }

  // Format license key as user types
  document.getElementById('licenseInput').addEventListener('input', formatLicenseKey);

  // Email support - click anywhere to copy email
  const emailSupport = document.getElementById('emailSupport');
  if (emailSupport) {
    emailSupport.addEventListener('click', async () => {
      const email = 'support@devlifeeasy.com';
      const copyBtn = document.getElementById('copyEmailBtn');
      try {
        await navigator.clipboard.writeText(email);
        copyBtn.textContent = '✓';
        emailSupport.classList.add('copied');

        setTimeout(() => {
          copyBtn.textContent = '📋';
          emailSupport.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  }
}

function formatLicenseKey(e) {
  let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let formatted = '';
  for (let i = 0; i < value.length && i < 20; i++) {
    if (i > 0 && i % 5 === 0) {
      formatted += '-';
    }
    formatted += value[i];
  }
  e.target.value = formatted;
}

let freeLimit = 2;

async function loadLicenseStatus() {
  // Get free limit from background
  freeLimit = await browserAPI.runtime.sendMessage({ type: 'GET_FREE_LIMIT' }) || 2;

  const response = await browserAPI.runtime.sendMessage({ type: 'GET_LICENSE' });
  updateLicenseUI(response);
}

function updateLicenseUI(license) {
  const statusBadge = document.getElementById('statusBadge');
  const statusDesc = document.getElementById('statusDesc');
  const licenseForm = document.getElementById('licenseForm');
  const licenseInfo = document.getElementById('licenseInfo');
  const domainLimit = document.getElementById('domainLimit');
  const scanTabsBtn = document.getElementById('scanTabsBtn');

  if (license && license.isPro) {
    // Show scan tabs button for Pro users
    scanTabsBtn.classList.remove('hidden');
    // Pro user
    statusBadge.className = 'status-badge pro';
    statusBadge.innerHTML = '<span class="status-icon">✓</span><span class="status-text">Pro License</span>';
    statusDesc.textContent = 'You have unlimited domain control.';

    licenseForm.classList.add('hidden');
    licenseInfo.classList.remove('hidden');

    // Show license key (masked)
    if (license.licenseKey) {
      const masked = license.licenseKey.substring(0, 5) + '-••••-••••-' + license.licenseKey.substring(18);
      document.getElementById('licenseKey').textContent = masked;
    }

    // Show activated date
    if (license.activatedAt) {
      const date = new Date(license.activatedAt);
      document.getElementById('activatedDate').textContent = date.toLocaleDateString();
    }

    domainLimit.textContent = '∞';
  } else {
    // Free user
    statusBadge.className = 'status-badge free';
    statusBadge.innerHTML = '<span class="status-icon">○</span><span class="status-text">Free Plan</span>';
    statusDesc.textContent = `Limited to ${freeLimit} domains. Upgrade to Pro for unlimited access.`;

    licenseForm.classList.remove('hidden');
    licenseInfo.classList.add('hidden');
    domainLimit.textContent = freeLimit;
    // Hide scan tabs button for free users
    scanTabsBtn.classList.add('hidden');
  }
}

async function loadStats() {
  const response = await browserAPI.runtime.sendMessage({ type: 'GET_DOMAINS' });
  document.getElementById('domainCount').textContent = response.controlledCount || 0;
}

async function activateLicense() {
  const input = document.getElementById('licenseInput');
  const message = document.getElementById('message');
  const key = input.value.trim();

  if (!key) {
    message.textContent = 'Please enter a license key';
    message.className = 'message error';
    return;
  }

  const result = await browserAPI.runtime.sendMessage({
    type: 'ACTIVATE_LICENSE',
    licenseKey: key
  });

  if (result.success) {
    message.textContent = 'License activated successfully!';
    message.className = 'message success';
    input.value = '';
    setTimeout(() => {
      loadLicenseStatus();
      message.textContent = '';
    }, 1500);
  } else {
    message.textContent = result.error || 'Invalid license key';
    message.className = 'message error';
  }
}

async function deactivateLicense() {
  if (!confirm('Are you sure you want to deactivate your license?')) {
    return;
  }

  await browserAPI.runtime.sendMessage({ type: 'DEACTIVATE_LICENSE' });
  loadLicenseStatus();
}

async function resetSettings() {
  if (!confirm('This will reset all volume settings for all websites. Continue?')) {
    return;
  }

  await browserAPI.storage.local.remove('volux_saved_states');
  loadStats();
  alert('All volume settings have been reset.');
}

async function scanMediaTabs() {
  const scanBtn = document.getElementById('scanTabsBtn');
  const scanResult = document.getElementById('scanResult');

  // Show scanning state
  scanBtn.classList.add('scanning');
  scanBtn.innerHTML = '<span class="btn-icon">⏳</span> Scanning...';
  scanResult.textContent = '';
  scanResult.className = 'scan-result';

  try {
    const result = await browserAPI.runtime.sendMessage({ type: 'SCAN_MEDIA_TABS' });

    if (result.addedDomains && result.addedDomains.length > 0) {
      scanResult.textContent = `Added ${result.addedDomains.length} media domain${result.addedDomains.length > 1 ? 's' : ''}: ${result.addedDomains.join(', ')}`;
      scanResult.className = 'scan-result success';
      // Refresh stats
      loadStats();
    } else {
      scanResult.textContent = 'No new media domains found in open tabs.';
      scanResult.className = 'scan-result';
    }
  } catch (err) {
    scanResult.textContent = 'Failed to scan tabs.';
    scanResult.className = 'scan-result error';
  }

  // Reset button
  scanBtn.classList.remove('scanning');
  scanBtn.innerHTML = '<span class="btn-icon">🔍</span> Scan Open Tabs for Media Sites';

  // Clear result after 5 seconds
  setTimeout(() => {
    scanResult.textContent = '';
  }, 5000);
}

// Affiliate Preference Functions
async function loadAffiliatePreference() {
  const license = await browserAPI.runtime.sendMessage({ type: 'GET_LICENSE' });
  const isPro = license && license.isPro;

  const data = await browserAPI.storage.local.get('volux_show_affiliate');

  // Pro users: default OFF (but can opt-in)
  // Free users: default ON (can opt-out)
  let showAffiliate;
  if (data.volux_show_affiliate === undefined) {
    showAffiliate = !isPro; // Default based on license status
  } else {
    showAffiliate = data.volux_show_affiliate;
  }

  const toggle = document.getElementById('showAffiliateToggle');
  const affiliateCard = document.getElementById('affiliateCard');

  if (toggle) {
    toggle.checked = showAffiliate;
  }

  if (affiliateCard) {
    affiliateCard.style.display = showAffiliate ? 'block' : 'none';
  }
}

async function saveAffiliatePreference() {
  const toggle = document.getElementById('showAffiliateToggle');
  const showAffiliate = toggle.checked;

  await browserAPI.storage.local.set({ volux_show_affiliate: showAffiliate });

  const affiliateCard = document.getElementById('affiliateCard');
  if (affiliateCard) {
    affiliateCard.style.display = showAffiliate ? 'block' : 'none';
  }
}

// Geo detection & affiliate display (moved from inline script)
function initAffiliateCarousels() {
  function detectRegion() {
    const lang = (navigator.language || '').toLowerCase();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (lang.includes('vi') || tz.includes('Ho_Chi_Minh') || tz.includes('Saigon')) {
      return 'vietnam';
    }
    return 'global';
  }

  function showRegion(region) {
    document.querySelectorAll('.affiliate-carousel').forEach(el => {
      el.style.display = el.dataset.region === region ? 'block' : 'none';
    });
  }

  // Quick detection first
  showRegion(detectRegion());

  // Verify with IP API
  fetch('https://ipapi.co/json/')
    .then(r => r.json())
    .then(data => {
      showRegion(data.country_code === 'VN' ? 'vietnam' : 'global');
    })
    .catch(() => {});

  // Carousel auto-rotation
  document.querySelectorAll('.affiliate-carousel').forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const dots = carousel.querySelectorAll('.carousel-dot');
    if (!track || !dots.length) return;

    const slideCount = track.children.length;
    let currentIndex = 0;
    let interval;

    function goTo(index) {
      currentIndex = index;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    }

    function next() { goTo((currentIndex + 1) % slideCount); }

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(parseInt(dot.dataset.index));
        clearInterval(interval);
        interval = setInterval(next, 5000);
      });
    });

    carousel.addEventListener('mouseenter', () => clearInterval(interval));
    carousel.addEventListener('mouseleave', () => { interval = setInterval(next, 5000); });

    interval = setInterval(next, 5000);
  });
}

// Initialize carousels when DOM is ready
document.addEventListener('DOMContentLoaded', initAffiliateCarousels);
