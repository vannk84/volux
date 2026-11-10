// Content script for Volux
// Controls audio/video elements volume directly

(function() {
  'use strict';

  // Cross-browser compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // An instance is "alive" while its extension context is valid. After the
  // extension is updated/reloaded, the old instance keeps running in open tabs
  // but its runtime is gone (runtime.id becomes undefined): it can no longer
  // receive messages, yet its timers and listeners would keep forcing the OLD
  // volume and fight the new instance — the "can't control until reload" bug.
  function isContextAlive() {
    try {
      return !!(browserAPI.runtime && browserAPI.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Avoid running twice in the same live context (manifest injection plus an
  // on-demand executeScript), but replace an orphaned predecessor.
  const previous = window.__voluxController;
  if (previous && previous.isAlive()) return;
  if (previous) previous.teardown();

  // Every listener this instance installs is bound to this signal so teardown
  // can remove them all at once.
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const TAKEOVER_EVENT = 'volux:takeover';

  let globalVolume = 1; // 0-1 range
  let globalMuted = false;
  // WeakSet so detached media elements can be GC'd (SPA sites like TikTok
  // churn through <video> nodes; a strong Set would pin them forever).
  const controlledElements = new WeakSet();
  // Cooldown per element to break fight loops where a site keeps
  // re-asserting its own volume after we set ours.
  const reapplyCooldown = new WeakMap();

  function countMediaElements() {
    return document.querySelectorAll('audio, video').length;
  }

  // Apply volume to a single media element.
  // NOTE: must not mark the element as set up — only setupMediaElement does,
  // otherwise an element first touched here never gets its volumechange guard.
  function applyVolumeToElement(element) {
    try {
      const target = globalMuted ? 0 : globalVolume;
      if (Math.abs(element.volume - target) <= 0.01) return;
      element.volume = target;
    } catch (e) {
      // Some elements may not support volume control
    }
  }

  // Apply volume to all media elements on the page
  function applyVolumeToAll() {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach(applyVolumeToElement);
  }

  // Setup a media element for volume control. The value-equality check
  // in the listener inherently ignores our own writes (since we write
  // the expected value), so no self-write flag is needed — and trying
  // to use one is unreliable because volumechange is dispatched via a
  // task, after microtasks, so a microtask-cleared flag is always false
  // by the time the listener runs.
  function setupMediaElement(element) {
    if (controlledElements.has(element)) return;
    controlledElements.add(element);

    // Apply current volume
    applyVolumeToElement(element);

    // Watch for volume changes and re-apply our volume
    element.addEventListener('volumechange', () => {
      const expectedVolume = globalMuted ? 0 : globalVolume;
      if (Math.abs(element.volume - expectedVolume) <= 0.01) return;
      // Rate-limit re-applies so a site that keeps re-asserting its own
      // volume can't pull us into a tight loop.
      const now = Date.now();
      const last = reapplyCooldown.get(element) || 0;
      if (now - last < 250) return;
      reapplyCooldown.set(element, now);
      element.volume = expectedVolume;
    }, { signal });

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

  signal.addEventListener('abort', () => observer.disconnect());

  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // Setup existing elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findAndSetupMediaElements, { signal });
  } else {
    findAndSetupMediaElements();
  }

  // Listen for play events to catch dynamically created media
  document.addEventListener('play', (event) => {
    const target = event.target;
    if (target.tagName === 'AUDIO' || target.tagName === 'VIDEO') {
      setupMediaElement(target);
    }
  }, { capture: true, signal });

  // Periodically re-apply volume (handles dynamic content like YouTube). The
  // tick doubles as the orphan check: once our extension context is gone we
  // stand down instead of fighting the replacement instance.
  const tick = setInterval(() => {
    if (!isContextAlive()) {
      teardown();
      return;
    }
    applyVolumeToAll();
  }, 1000);
  signal.addEventListener('abort', () => clearInterval(tick));

  // Listen for messages from background script
  function onRuntimeMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'SET_VOLUME':
        globalVolume = message.volume;
        applyVolumeToAll();
        sendResponse({ success: true, mediaCount: countMediaElements() });
        break;

      case 'SET_MUTED':
        globalMuted = message.muted;
        applyVolumeToAll();
        sendResponse({ success: true, mediaCount: countMediaElements() });
        break;

      case 'GET_STATUS':
        sendResponse({
          volume: globalVolume,
          muted: globalMuted,
          mediaCount: countMediaElements()
        });
        break;

      default:
        sendResponse({ success: false });
    }
    return true;
  }
  browserAPI.runtime.onMessage.addListener(onRuntimeMessage);

  function teardown() {
    if (signal.aborted) return;
    lifetime.abort();
    try {
      browserAPI.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch (e) {}
    if (window.__voluxController === controller) {
      delete window.__voluxController;
    }
  }

  const controller = { isAlive: isContextAlive, teardown };
  window.__voluxController = controller;

  // Content scripts of different extension instances may live in separate
  // isolated worlds (so the window handle above isn't shared), but DOM events
  // are. Announce ourselves; any orphaned predecessor that hears it stands down.
  document.addEventListener(TAKEOVER_EVENT, () => {
    if (!isContextAlive()) teardown();
  }, { signal });
  document.dispatchEvent(new CustomEvent(TAKEOVER_EVENT));

  // Get initial state from background
  browserAPI.runtime.sendMessage({ type: 'GET_TAB_STATE' }).then(state => {
    if (state) {
      globalVolume = state.volume / 100;
      globalMuted = state.muted;
      applyVolumeToAll();
    }
  }).catch(() => {});

})();
