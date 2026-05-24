// Content script for Volux
// Controls audio/video elements volume directly

(function() {
  'use strict';

  // Cross-browser compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Avoid running multiple times
  if (window.__voluxControllerLoaded) return;
  window.__voluxControllerLoaded = true;

  // Volume multiplier. 0–1 is plain attenuation; >1 is a boost that the
  // native element.volume can't reach (browsers clamp it to [0,1]), so we
  // route through a Web Audio GainNode for anything above 1.
  let globalVolume = 1;
  let globalMuted = false;
  // WeakSet so detached media elements can be GC'd (SPA sites like TikTok
  // churn through <video> nodes; a strong Set would pin them forever).
  const controlledElements = new WeakSet();
  // Cooldown per element to break fight loops where a site keeps
  // re-asserting its own volume after we set ours.
  const reapplyCooldown = new WeakMap();

  // ── Web Audio boost ──────────────────────────────────────────────────────
  // A single shared AudioContext, plus a per-element source→gain chain. A
  // MediaElementAudioSourceNode can only be created ONCE per element (a second
  // call throws), so the chain is cached in a WeakMap. We only build it when a
  // boost (>100%) is actually requested: routing through Web Audio can silence
  // cross-origin-tainted media, so at ≤100% we never touch it and just use the
  // native element.volume — zero risk for ordinary use.
  let audioContext = null;
  const boostNodes = new WeakMap(); // element -> { source, gain }

  function ensureAudioContext() {
    if (!audioContext) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioContext = new Ctx();
      } catch (e) {
        return null;
      }
    }
    // Autoplay policy may start the context suspended; resume is best-effort
    // and succeeds once the page has seen a user gesture (audio is typically
    // already playing by the time someone reaches for a boost).
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  // Build (or fetch the cached) gain chain for an element. Returns null if Web
  // Audio is unavailable or the element can't be routed (source already taken,
  // or CORS-tainted media that createMediaElementSource refuses).
  function getBoostNodes(element) {
    const existing = boostNodes.get(element);
    if (existing) return existing;
    const ctx = ensureAudioContext();
    if (!ctx) return null;
    try {
      const source = ctx.createMediaElementSource(element);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      const nodes = { source, gain };
      boostNodes.set(element, nodes);
      return nodes;
    } catch (e) {
      return null;
    }
  }

  // The element.volume value we expect to be holding. When an element is routed
  // through the gain chain it stays at full volume (1) and the GainNode does
  // all the scaling; otherwise element.volume carries the level directly.
  function expectedElementVolume(element) {
    if (globalMuted) return 0;
    const routed = boostNodes.has(element) || globalVolume > 1;
    return routed ? 1 : globalVolume;
  }

  function countMediaElements() {
    return document.querySelectorAll('audio, video').length;
  }

  // Apply the current volume/mute state to a single media element.
  function applyVolumeToElement(element) {
    try {
      const multiplier = globalMuted ? 0 : globalVolume;
      // Once an element has been routed through Web Audio we keep using it,
      // even back at ≤100%, since the source node can't be detached cleanly.
      const routed = boostNodes.has(element) || multiplier > 1;

      if (routed) {
        const nodes = getBoostNodes(element);
        if (nodes) {
          nodes.gain.gain.value = multiplier; // mute → 0, boost → up to MAX
          const elemTarget = globalMuted ? 0 : 1;
          if (Math.abs(element.volume - elemTarget) > 0.01) {
            element.volume = elemTarget;
          }
          controlledElements.add(element);
          return;
        }
        // Routing unavailable (CORS/no Web Audio) — do the best the bare
        // element can: full volume, capped at 100%.
        const fallback = Math.min(multiplier, 1);
        if (Math.abs(element.volume - fallback) > 0.01) element.volume = fallback;
        controlledElements.add(element);
        return;
      }

      // Plain path: ≤100% and never routed.
      if (Math.abs(element.volume - multiplier) > 0.01) element.volume = multiplier;
      controlledElements.add(element);
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

    // Watch for volume changes and re-apply our volume. When the element is
    // boosted the expected native volume is 1 (the GainNode holds the level),
    // so a site dragging element.volume down still gets corrected.
    element.addEventListener('volumechange', () => {
      const expectedVolume = expectedElementVolume(element);
      if (Math.abs(element.volume - expectedVolume) <= 0.01) return;
      // Rate-limit re-applies so a site that keeps re-asserting its own
      // volume can't pull us into a tight loop.
      const now = Date.now();
      const last = reapplyCooldown.get(element) || 0;
      if (now - last < 250) return;
      reapplyCooldown.set(element, now);
      element.volume = expectedVolume;
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

  // A suspended AudioContext can only resume after a user gesture in the page.
  // Volume changes are driven from the popup (a different context), so nudge it
  // back to life on any in-page interaction once a context exists.
  ['pointerdown', 'keydown', 'play'].forEach((evt) => {
    document.addEventListener(evt, () => {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
    }, { capture: true, passive: true });
  });

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
  });

  // Get initial state from background
  browserAPI.runtime.sendMessage({ type: 'GET_TAB_STATE' }).then(state => {
    if (state) {
      globalVolume = state.volume / 100;
      globalMuted = state.muted;
      applyVolumeToAll();
    }
  }).catch(() => {});

})();
