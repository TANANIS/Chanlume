(function () {
  "use strict";
  if (window.top !== window || globalThis.ChanlumeStartup) return;
  let finished = false, expired = false, enabled = false;
  const root = () => document.documentElement;
  function route() {
    if (!root()) return;
    root().dataset.chanlumePage = location.pathname === "/feed/subscriptions" ? "subscriptions" : "other";
    const view = new URLSearchParams(location.hash.slice(1)).get("chanlume-view");
    root().classList.toggle("chanlume-early-custom", !finished && enabled && ["channels", "timeline", "collections", "favorites"].includes(view));
  }
  function release() {
    root()?.classList.remove("chanlume-startup-pending", "chanlume-content-pending", "chanlume-early-enabled", "chanlume-early-custom");
  }
  function prepare() {
    if (finished || expired || !root()) return;
    root().classList.add("chanlume-startup-pending", "chanlume-content-pending"); route();
  }
  prepare();
  const observer = new MutationObserver(() => { if (root()) { prepare(); observer.disconnect(); } });
  if (!root()) observer.observe(document, {childList:true,subtree:true});
  const watchdog = setTimeout(() => { expired = true; release(); observer.disconnect(); }, 4000);
  const state = chrome.storage.local.get(["chanlumeState", "tubeShelfState"]).then(values => {
    const stored = values.chanlumeState === undefined ? values.tubeShelfState : values.chanlumeState;
    enabled = stored?.settings?.enabled !== false;
    if (!enabled) release();
    else if (!expired) { root()?.classList.add("chanlume-early-enabled"); route(); }
    return stored;
  }).catch(() => { expired = true; release(); return undefined; });
  globalThis.ChanlumeStartup = {
    state,
    sync(value) {
      enabled = value;
      if (!value) release();
      else if (!expired && !finished) { root()?.classList.add("chanlume-early-enabled"); route(); }
      else if (finished) {
        // Later state/DOM refreshes must not reactivate the startup mask.
        root()?.classList.remove("chanlume-early-enabled", "chanlume-early-custom");
        route();
      }
    },
    finish() {
      finished = true;
      clearTimeout(watchdog);
      observer.disconnect();
      // The early guide mask is only for bootstrapping. Keeping it after
      // initialization hides native entries when YouTube mounts its guide late.
      root()?.classList.remove("chanlume-startup-pending", "chanlume-content-pending", "chanlume-early-enabled", "chanlume-early-custom");
    },
    release
  };
  document.addEventListener("yt-navigate-start", route);
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", route);
})();
