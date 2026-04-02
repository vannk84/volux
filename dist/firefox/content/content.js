// Content script for Volux
// Controls audio/video elements volume directly

(function() {
  'use strict';

  // Cross-browser compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Avoid running multiple times
  if (window.__voluxControllerLoaded) return;
  window.__voluxControllerLoaded = true;

  let globalVolume = 1; // 0-1 range
  let globalMuted = false;
  const controlledElements = new Set();

  // Apply volume to a single media element
  function applyVolumeToElement(element) {
    try {
      if (globalMuted) {
        element.volume = 0;
      } else {
        element.volume = globalVolume;
      }
      controlledElements.add(element);
    } catch (e) {
      // Some elements may not support volume control
      console.log('Volux: Could not set volume on element:', e.message);
    }
  }

  // Apply volume to all media elements on the page
  function applyVolumeToAll() {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach(element => {
      applyVolumeToElement(element);
    });
    console.log('Volux: Applied volume', globalVolume, 'muted:', globalMuted, 'to', mediaElements.length, 'elements');
  }

  // Setup a media element for volume control
  function setupMediaElement(element) {
    if (controlledElements.has(element)) return;

    // Apply current volume
    applyVolumeToElement(element);

    // Override volume changes by the page (optional - prevents sites from resetting volume)
    const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');

    // Watch for volume changes and re-apply our volume
    element.addEventListener('volumechange', () => {
      const expectedVolume = globalMuted ? 0 : globalVolume;
      // Only re-apply if significantly different (avoid infinite loops)
      if (Math.abs(element.volume - expectedVolume) > 0.01) {
        element.volume = expectedVolume;
      }
    });

    // Notify background script
    browserAPI.runtime.sendMessage({ type: 'AUDIO_DETECTED' }).catch(() => {});
  }

  // Find and setup all media elements
  function findAndSetupMediaElements() {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach(element => {
      setupMediaElement(element);
    });
  }

  // Observe for new media elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
            setupMediaElement(node);
          }
          // Check for nested media elements
          const nested = node.querySelectorAll?.('audio, video');
          nested?.forEach(el => setupMediaElement(el));
        }
      }
    }
  });

  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Setup existing elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findAndSetupMediaElements);
  } else {
    findAndSetupMediaElements();
  }

  // Listen for play events to catch dynamically created media
  document.addEventListener('play', (event) => {
    const target = event.target;
    if (target.tagName === 'AUDIO' || target.tagName === 'VIDEO') {
      setupMediaElement(target);
    }
  }, true);

  // Periodically re-apply volume (handles dynamic content like YouTube)
  setInterval(() => {
    applyVolumeToAll();
  }, 1000);

  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SET_VOLUME':
        globalVolume = message.volume;
        applyVolumeToAll();
        sendResponse({ success: true, mediaCount: controlledElements.size });
        break;

      case 'SET_MUTED':
        globalMuted = message.muted;
        applyVolumeToAll();
        sendResponse({ success: true, mediaCount: controlledElements.size });
        break;

      case 'GET_STATUS':
        sendResponse({
          volume: globalVolume,
          muted: globalMuted,
          mediaCount: controlledElements.size
        });
        break;

      default:
        sendResponse({ success: false });
    }
    return true;
  });

  // Get initial state from background
  browserAPI.runtime.sendMessage({ type: 'GET_TAB_STATE' }).then(state => {
    if (state) {
      globalVolume = state.volume / 100;
      globalMuted = state.muted;
      applyVolumeToAll();
    }
  }).catch(() => {});

  console.log('Volux content script loaded');
})();
