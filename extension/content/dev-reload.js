// Development-only opt-in. Without a running local watcher, the marker is
// disabled or stale; this script never requests a reload in that state.
(() => {
  "use strict";
  if (window.top !== window || globalThis.ChanlumeDevReload) return;
  globalThis.ChanlumeDevReload = true;
  let previousRevision = null;
  let reloadRequested = false;

  async function poll() {
    let delay = 10000;
    try {
      // The isolated page frame cannot reliably fetch a chrome-extension URL
      // in every Chromium browser. Read the local marker in our own worker.
      const response = await chrome.runtime.sendMessage({ type: "CHANLUME_DEV_MARKER" });
      if (response?.ok === true) {
        const marker = response.marker;
        if (marker?.chanlumeDevWatch === true && typeof marker.revision === "string" &&
            Number.isFinite(marker.updatedAt) &&
            Math.abs(Date.now() - marker.updatedAt) <= 20000) {
          delay = 1500;
          if (previousRevision && previousRevision !== marker.revision && !reloadRequested) {
            reloadRequested = true;
            // The background worker verifies the marker before reloading.
            // A transient marker read race may be rejected. Keep the previous
            // baseline so the next poll retries the same revision.
            try {
              const result = await chrome.runtime.sendMessage({ type: "CHANLUME_DEV_RELOAD", revision: marker.revision });
              if (result?.ok !== true) reloadRequested = false;
            } catch (_) {
              // A valid reload can close the message port; the refreshed tab
              // replaces us. If reload did not begin, polling safely retries.
              reloadRequested = false;
            }
          }
          if (!previousRevision) previousRevision = marker.revision;
        } else {
          previousRevision = null;
        }
      }
    } catch (_) {
      // A temporary failed read must not erase the last known revision.
    }
    if (!reloadRequested) setTimeout(poll, delay);
  }
  poll();
})();
