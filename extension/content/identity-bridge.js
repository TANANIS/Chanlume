(function () {
  "use strict";

  if (window.top !== window || window.__chanlumeIdentityBridge) return;
  window.__chanlumeIdentityBridge = true;
  const SOURCE = "chanlume-identity-bridge";
  const identities = new Map();
  let inspected = new WeakMap();
  let retryCounts = new WeakMap();
  const retryTimers = new Set();
  let observed = false;
  let lastInitialData = null;
  let enabled = false;
  let startupTimer = null;

  function validChannelId(value) {
    const id = String(value || "").trim();
    return /^UC[A-Za-z0-9_-]{20,}$/.test(id) ? id : "";
  }

  function validAlias(value) {
    try {
      const path = new URL(String(value || ""), location.origin).pathname.replace(/\/$/, "");
      return /^\/@[^/]+$/i.test(path) || /^\/channel\/[A-Za-z0-9_-]+$/i.test(path) ? path : "";
    } catch (_error) {
      return "";
    }
  }

  function publish(channelId, alias) {
    const stableId = validChannelId(channelId);
    const channelAlias = validAlias(alias);
    if (!stableId || !channelAlias) return;
    const key = `${stableId}\n${channelAlias.toLowerCase()}`;
    if (identities.has(key)) return;
    const payload = { source: SOURCE, type: "CHANNEL_IDENTITY", channelId: stableId, alias: channelAlias };
    identities.set(key, payload);
    window.postMessage(payload, location.origin);
  }

  function inspectData(root, fallbackAlias = "") {
    const stack = [root];
    const visited = new WeakSet();
    let steps = 0;
    while (stack.length && steps < 12000) {
      const node = stack.pop();
      steps += 1;
      if (!node || typeof node !== "object" || visited.has(node)) continue;
      visited.add(node);
      const endpoint = node.browseEndpoint;
      if (endpoint && typeof endpoint === "object") publish(endpoint.browseId, endpoint.canonicalBaseUrl || fallbackAlias);
      const directId = validChannelId(node.channelId || node.browseId || node.externalId);
      if (directId) publish(directId, node.canonicalBaseUrl || node.vanityChannelUrl || fallbackAlias);
      for (const value of Object.values(node)) if (value && typeof value === "object") stack.push(value);
    }
  }

  function inspectRenderer(renderer) {
    if (!enabled || !(renderer instanceof Element) || location.pathname !== "/feed/channels" || document.hidden) return;
    const alias = renderer.querySelector('a[href^="/@"], a[href^="/channel/"]')?.getAttribute("href") || "";
    const data = renderer.data || renderer.__data?.data || renderer.__data || renderer.__dataHost?.data;
    if (!data) {
      const retries = retryCounts.get(renderer) || 0;
      if (retries < 5) {
        retryCounts.set(renderer, retries + 1);
        const timer = setTimeout(() => {
          retryTimers.delete(timer);
          if (renderer.isConnected) inspectRenderer(renderer);
        }, 80 * (retries + 1));
        retryTimers.add(timer);
      }
      return;
    }
    retryCounts.delete(renderer);
    if (inspected.get(renderer) === data) return;
    inspected.set(renderer, data);
    inspectData(data, alias);
  }

  function scanRenderedChannels(root = document) {
    if (location.pathname !== "/feed/channels") return;
    if (root instanceof Element && root.matches("ytd-channel-renderer")) inspectRenderer(root);
    root.querySelectorAll?.("ytd-channel-renderer").forEach(inspectRenderer);
  }

  const observer = new MutationObserver((mutations) => {
    if (location.pathname !== "/feed/channels") return;
    for (const mutation of mutations) for (const node of mutation.addedNodes) if (node instanceof Element) scanRenderedChannels(node);
  });

  function updateObservation() {
    const shouldObserve = enabled && location.pathname === "/feed/channels" && !document.hidden;
    if (shouldObserve && !observed && document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      observed = true;
    } else if (!shouldObserve && observed) {
      observer.disconnect();
      observed = false;
    }
    if (!shouldObserve) {
      retryTimers.forEach(clearTimeout);
      retryTimers.clear();
      retryCounts = new WeakMap();
    }
  }

  function activate() {
    updateObservation();
    if (!enabled || location.pathname !== "/feed/channels") {
      identities.clear();
      inspected = new WeakMap();
      lastInitialData = null;
      return;
    }
    if (document.hidden) return;
    scanRenderedChannels();
    if (window.ytInitialData && typeof window.ytInitialData === "object" && window.ytInitialData !== lastInitialData?.deref()) {
      lastInitialData = new WeakRef(window.ytInitialData);
      inspectData(window.ytInitialData);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== SOURCE) return;
    if (event.data.type === "SET_ENABLED" && typeof event.data.enabled === "boolean") {
      if (enabled === event.data.enabled) return;
      enabled = event.data.enabled;
      clearInterval(startupTimer);
      activate();
      if (enabled) {
        let attempts = 0;
        startupTimer = setInterval(() => {
          activate();
          if (++attempts >= 40 || location.pathname !== "/feed/channels") clearInterval(startupTimer);
        }, 250);
      }
      return;
    }
    if (!enabled || event.data.type !== "REQUEST_IDENTITIES" || location.pathname !== "/feed/channels") return;
    identities.forEach((payload) => window.postMessage(payload, location.origin));
    activate();
  });
  document.addEventListener("yt-navigate-finish", activate);
  document.addEventListener("visibilitychange", activate);
  activate();
  window.postMessage({ source: SOURCE, type: "BRIDGE_READY" }, location.origin);
})();
