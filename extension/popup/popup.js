(function () {
  "use strict";
  const Core = globalThis.ChanlumeCore;
  const STORAGE_KEY = "chanlumeState";
  let state = Core.defaultState();
  let activeTab = null;

  const extensionApi = globalThis.chrome?.storage?.local
    ? {
        getState: async () => (await Core.readStoredValues(chrome.storage.local, STORAGE_KEY))[STORAGE_KEY],
        activeTab: async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0],
        send: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
        navigate: (tab, url) => tab?.id && /^https:\/\/(www\.)?youtube\.com\//.test(tab.url || "") ? chrome.tabs.update(tab.id, { url }) : chrome.tabs.create({ url }),
        openOptions: () => chrome.runtime.openOptionsPage(),
        onChange: (callback) => chrome.storage.onChanged.addListener(callback),
        mutate: (operation) => chrome.runtime.sendMessage({ type: "CHANLUME_MUTATE", operation })
      }
    : {
        getState: async () => ({
          ...Core.defaultState(),
          channels: {
            "/@kurzgesagt": { id: "/@kurzgesagt", name: "Kurzgesagt", url: "https://www.youtube.com/@kurzgesagt" },
            "/@veritasium": { id: "/@veritasium", name: "Veritasium", url: "https://www.youtube.com/@veritasium" },
            "/@lofigirl": { id: "/@lofigirl", name: "Lofi Girl", url: "https://www.youtube.com/@lofigirl" }
          },
          groups: [
            { id: "learning", name: "學習", icon: "book", color: "#7c5cff", channelIds: ["/@kurzgesagt", "/@veritasium"] },
            { id: "relax", name: "放鬆", icon: "music", color: "#ff6b8a", channelIds: ["/@lofigirl"] }
          ],
          settings: { ...Core.defaultState().settings, language: Core.languageCode(new URLSearchParams(location.search).get("lang")) }
        }),
        activeTab: async () => ({ id: 1, url: "https://www.youtube.com/feed/subscriptions" }),
        send: async () => ({ ok: true, count: 3 }),
        navigate: async () => ({}),
        openOptions: () => {},
        onChange: () => {},
        mutate: async (operation) => ({ ok: true, state: { ...Core.applyStateOperation(state, operation), revision: state.revision + 1 } })
      };

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  function acceptState(next, force = false) {
    if (!force && Number.isSafeInteger(next?.revision) && next.revision <= state.revision) return false;
    const incoming = Core.normalizeState(next);
    if (!force && incoming.revision <= state.revision) return false;
    state = incoming;
    return true;
  }
  function localize(root = document) {
    const language = Core.languageCode(state.settings?.language);
    document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
    Core.localizeDom(root, language);
  }

  function render() {
    const enabled = state.settings.enabled;
    document.body.classList.toggle("cl-paused", !enabled);
    const power = document.getElementById("power-toggle");
    power.setAttribute("aria-pressed", String(enabled));
    const label = Core.translateUiText(enabled ? "關閉 Chanlume，恢復原本 YouTube" : "啟用 Chanlume", state.settings.language);
    power.setAttribute("aria-label", label);
    power.title = label;
    ["open-panel", "update-subscriptions"].forEach((id) => { document.getElementById(id).disabled = !enabled; });
    document.getElementById("channel-count").textContent = Object.keys(state.channels).length;
    document.getElementById("open-home").hidden = enabled && Boolean(state.settings.blockHome);
    const host = document.getElementById("groups");
    host.innerHTML = state.groups.length
      ? state.groups.map((group) => `<button class="group" data-group="${escapeHtml(group.id)}" title="${escapeHtml(group.name)}" type="button" ${enabled ? "" : "disabled"}>
          <span class="group-icon" style="color:${group.color};background:${group.color}1c">${Core.iconSvg(group.icon, "currentColor", 17)}</span>
          <span><span class="group-name">${escapeHtml(group.name)}</span><span class="group-meta">YouTube 群組</span></span>
          <span class="group-count">${group.channelIds.length}</span>
        </button>`).join("")
      : '<div class="empty">還沒有群組，先建立第一個書架吧。</div>';
    localize();
  }

  function renderTab() {
    const isYouTube = /^https:\/\/(www\.)?youtube\.com\//.test(activeTab?.url || "");
    const kind = isYouTube ? Core.youtubePageKind(activeTab.url) : "other";
    const card = document.getElementById("page-card");
    card.classList.toggle("ready", isYouTube);
    document.getElementById("page-title").textContent = kind === "home" && state.settings.blockHome ? "首頁已封鎖" : kind === "home" ? "目前是首頁推薦" : kind === "subscriptions" ? "目前是訂閱內容" : isYouTube ? "目前是 YouTube 其他頁面" : "目前不是 YouTube 分頁";
    document.getElementById("page-hint").textContent = kind === "home" && state.settings.blockHome ? "將自動前往訂閱內容" : kind === "home" ? "首頁保留 YouTube 演算法" : kind === "subscriptions" ? "可以使用群組與畫面整理" : "前往訂閱內容即可使用群組";
    document.querySelectorAll("[data-destination]").forEach((button) => button.classList.toggle("active", button.dataset.destination === kind));
    if (!state.settings.enabled) {
      card.classList.remove("ready");
      document.getElementById("page-title").textContent = "Chanlume 已關閉";
      document.getElementById("page-hint").textContent = "正在使用原本 YouTube，群組與設定已保留";
    }
    localize(document.getElementById("page-card"));
  }

  async function send(message) {
    if (!activeTab?.id) return null;
    try { return await extensionApi.send(activeTab.id, message); }
    catch (_error) { return null; }
  }

  document.getElementById("manage-top").addEventListener("click", extensionApi.openOptions);
  document.getElementById("power-toggle").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await extensionApi.mutate({ type: "set-setting", payload: { setting: "enabled", enabled: !state.settings.enabled } });
      if (!result?.ok) throw new Error(result?.error || "Power update failed");
      acceptState(result.state);
      render(); renderTab();
    } catch (_error) {
      document.getElementById("page-hint").textContent = Core.translateUiText("電源切換失敗，請再試一次", state.settings.language);
    } finally { button.disabled = false; }
  });
  document.getElementById("add-group").addEventListener("click", extensionApi.openOptions);
  document.getElementById("open-home").addEventListener("click", async () => { await extensionApi.navigate(activeTab, "https://www.youtube.com/"); window.close(); });
  document.getElementById("open-subscriptions").addEventListener("click", async () => { await extensionApi.navigate(activeTab, Core.subscriptionGroupUrl("all")); window.close(); });
  document.getElementById("open-panel").addEventListener("click", async () => {
    const result = await send({ type: "OPEN_CHANLUME" });
    if (!result) await extensionApi.navigate(activeTab, Core.subscriptionGroupUrl("all"));
    window.close();
  });
  document.getElementById("update-subscriptions").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "準備中…";
    try {
      const result = await chrome.runtime.sendMessage({ type: "START_SUBSCRIPTION_UPDATE" });
      if (!result?.ok) throw new Error("start failed");
      window.close();
    } catch (_error) {
      button.textContent = "請重新載入擴充套件";
      localize(button);
    }
  });
  document.getElementById("groups").addEventListener("click", async (event) => {
    const id = event.target.closest("[data-group]")?.dataset.group;
    if (!id) return;
    const result = await send({ type: "OPEN_CHANLUME", groupId: id });
    if (!result) await extensionApi.navigate(activeTab, Core.subscriptionGroupUrl(id));
    window.close();
  });

  extensionApi.onChange((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      if (acceptState(changes[STORAGE_KEY].newValue)) {
        render();
        renderTab();
      }
    }
  });

  (async function init() {
    acceptState(await extensionApi.getState(), true);
    activeTab = await extensionApi.activeTab();
    render();
    renderTab();
  })();
})();
