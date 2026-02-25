// Content script for Volux
// Captures audio/video elements and controls their volume using Web Audio API

(function() {
  'use strict';

  // Cross-browser compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Avoid running multiple times
  if (window.__tabVolumeControllerLoaded) return;
  window.__tabVolumeControllerLoaded = true;

  const audioContexts = new Map();
  const gainNodes = new Map();
  let globalVolume = 1;
  let globalMuted = false;

  // Create audio context and gain node for an element
  function setupAudioControl(element) {
    if (audioContexts.has(element)) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(element);
      const gainNode = audioContext.createGain();

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      audioContexts.set(element, audioContext);
      gainNodes.set(element, gainNode);

      // Apply current volume settings
      gainNode.gain.value = globalMuted ? 0 : globalVolume;

      // Notify background script that audio was detected
      browserAPI.runtime.sendMessage({ type: 'AUDIO_DETECTED' }).catch(() => {});

    } catch (error) {
      // Element might already be connected to an AudioContext
      console.log('Volux: Could not setup audio control:', error.message);
    }
  }

  // Apply volume to all controlled elements
  function applyVolume(volume, muted) {
    globalVolume = volume;
    globalMuted = muted;

    const effectiveVolume = muted ? 0 : volume;

    gainNodes.forEach((gainNode, element) => {
      try {
        gainNode.gain.setValueAtTime(effectiveVolume, gainNode.context.currentTime);
      } catch (error) {
        console.log('Volux: Could not set volume:', error.message);
      }
    });
  }

  // Find and setup all audio/video elements
  function findMediaElements() {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach(element => {
      // Only setup when the element starts playing
      if (!element.paused && !audioContexts.has(element)) {
        setupAudioControl(element);
      }
    });
  }

  // Observe for new media elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
            node.addEventListener('play', () => setupAudioControl(node), { once: true });
          }
          // Check for nested media elements
          const nested = node.querySelectorAll?.('audio, video');
          nested?.forEach(el => {
            el.addEventListener('play', () => setupAudioControl(el), { once: true });
          });
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
  document.addEventListener('DOMContentLoaded', findMediaElements);
  if (document.readyState !== 'loading') {
    findMediaElements();
  }

  // Listen for play events on all media elements
  document.addEventListener('play', (event) => {
    if (event.target.tagName === 'AUDIO' || event.target.tagName === 'VIDEO') {
      setupAudioControl(event.target);
    }
  }, true);

  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SET_VOLUME':
        applyVolume(message.volume, globalMuted);
        sendResponse({ success: true });
        break;

      case 'SET_MUTED':
        applyVolume(globalVolume, message.muted);
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          volume: globalVolume,
          muted: globalMuted,
          mediaCount: audioContexts.size
        });
        break;
    }
    return true;
  });

  // Get initial state from background
  browserAPI.runtime.sendMessage({ type: 'GET_TAB_STATE' }).then(state => {
    if (state) {
      globalVolume = state.volume / 100;
      globalMuted = state.muted;
      applyVolume(globalVolume, globalMuted);
    }
  }).catch(() => {});

  console.log('Volux content script loaded');
})();
