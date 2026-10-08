importScripts("shared.js");

const Core = globalThis.ChanlumeCore;
const STORAGE_KEY = "chanlumeState";
const API_KEY_STORAGE = "chanlumeYouTubeApiKey";
let stateWriteQueue = Promise.resolve();
const favoriteFeedCache = new Map();
const favoriteFeedPending = new Map();

async function readFavoriteFeed(identity, force = false) {
  const current = Core.normalizeState((await Core.readStoredValues(chrome.storage.local, STORAGE_KEY))[STORAGE_KEY]);
  const id = Core.resolveChannelRecordId(current, identity);
  if (!current.settings.enabled || !id || !current.favoriteChannelIds.includes(id)) throw new Error("Channel is not an active favorite");
  const channel = current.channels[id];
  const hideShorts = current.settings.hideShorts;
  const key = `${id}:${hideShorts ? "videos" : "all"}`;
  const cached = favoriteFeedCache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < 300000) return cached;
  if (favoriteFeedPending.has(key)) return favoriteFeedPending.get(key);
  if (favoriteFeedPending.size >= 3) throw new Error("Feed requests busy; retry shortly");
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const get = async (url, maxLength) => {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error(`YouTube ${response.status}`), { code: "HTTP" });
      const text = await response.text();
      if (text.length > maxLength) throw new Error("Feed response too large");
      return text;
    };
    try {
      if (hideShorts) {
        const source = await get(`${channel.url}/videos`, 10000000);
        const videos = Core.collectChannelUploads(Core.parseYouTubeInitialData(source));
        const result = { videos, hideShorts: true, fetchedAt: Date.now() };
        if (favoriteFeedCache.size >= 100) favoriteFeedCache.delete(favoriteFeedCache.keys().next().value);
        favoriteFeedCache.set(key, result);
        return result;
      }
      let channelId = /^UC[\w-]{22}$/.test(channel.channelId) ? channel.channelId : "";
      if (!channelId) {
        const source = await get(`${channel.url}/videos`, 10000000);
        // Channel metadata identifies the page owner; unrelated video owners are not identity evidence.
        let metadata;
        try { metadata = Core.parseYouTubeInitialData(source).metadata?.channelMetadataRenderer; } catch (_) {}
        channelId = /^UC[\w-]{22}$/.test(metadata?.externalId || "") ? metadata.externalId : source.match(/"channelMetadataRenderer"\s*:\s*\{[^}]*"externalId"\s*:\s*"(UC[\w-]{22})"/)?.[1]
          || source.match(/<meta\s+itemprop="channelId"\s+content="(UC[\w-]{22})"/)?.[1] || "";
      }
      if (!channelId) throw new Error("Could not identify channel");
      const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, 1000000);
      const result = { xml, hideShorts: false, fetchedAt: Date.now() };
      if (favoriteFeedCache.size >= 100) favoriteFeedCache.delete(favoriteFeedCache.keys().next().value);
      favoriteFeedCache.set(key, result);
      return result;
    } finally { clearTimeout(timeout); }
  })();
  favoriteFeedPending.set(key, request);
  try { return await request; } finally { favoriteFeedPending.delete(key); }
}

function enqueueStateTask(task) {
  const transaction = stateWriteQueue.then(async () => {
    await migrateLegacyStorage();
    return task();
  });
  stateWriteQueue = transaction.catch(() => {});
  return transaction;
}

async function migrateLegacyStorage() {
  const keys = Object.keys(Core.LEGACY_STORAGE_KEYS);
  const values = await chrome.storage.local.get([...keys, ...Object.values(Core.LEGACY_STORAGE_KEYS)]);
  const migrated = {};
  for (const key of keys) {
    const legacy = values[Core.LEGACY_STORAGE_KEYS[key]];
    if (values[key] === undefined && legacy !== undefined) migrated[key] = legacy;
  }
  if (Object.keys(migrated).length) await chrome.storage.local.set(migrated);
}

function enqueueStateOperation(operation) {
  return enqueueStateTask(async () => {
    const saved = await Core.readStoredValues(chrome.storage.local, STORAGE_KEY);
    const current = Core.normalizeState(saved[STORAGE_KEY]);
    const next = Core.applyStateOperation(current, operation);
    next.revision = current.revision + 1;
    const normalized = Core.normalizeState(next);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  });
}

chrome.runtime.onInstalled.addListener((details) => enqueueStateTask(async () => {
  const saved = await Core.readStoredValues(chrome.storage.local, STORAGE_KEY);
  const current = Core.normalizeState(saved[STORAGE_KEY]);
  const normalized = Core.normalizeState({ ...current, revision: current.revision + 1 });
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
}).then(async () => {
  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html?view=settings"), active: true });
  }
}).catch((error) => console.error("Chanlume installation setup failed", error)));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Already-open older frontends may finish a request during an extension update.
  if (typeof message?.type === "string" && message.type.startsWith("TUBESHELF_")) {
    message = { ...message, type: message.type.replace(/^TUBESHELF_/, "CHANLUME_") };
  }
  if (message?.type === "CHANLUME_FAVORITE_FEED") {
    readFavoriteFeed(message.channelId, message.force === true)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error), code: error.code || (["AbortError", "TimeoutError", "TypeError"].includes(error.name) ? "NETWORK" : /YouTube.*(?:data|tab)|identify channel/.test(error.message) ? "PARSE" : "UNAVAILABLE") }));
    return true;
  }
  if (message?.type === "OPEN_DASHBOARD") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  if (message?.type === "CHANLUME_MUTATE") {
    enqueueStateOperation(message.operation)
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, code: error?.code || "STATE_MUTATION_FAILED", error: String(error?.message || error) }));
    return true;
  }
  if (message?.type === "CHANLUME_SET_API_KEY") {
    enqueueStateTask(() => chrome.storage.local.set({ [API_KEY_STORAGE]: String(message.value || "") }))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "START_SUBSCRIPTION_UPDATE") {
    (async () => {
      const state = await Core.readStoredValues(chrome.storage.local, STORAGE_KEY);
      if (state[STORAGE_KEY]?.settings?.enabled === false) {
        sendResponse({ ok: false, error: "CHANLUME_DISABLED" });
        return;
      }
      const saved = await Core.readStoredValues(chrome.storage.local, "chanlumeScanStatus");
      const current = saved.chanlumeScanStatus;
      if (["starting", "running"].includes(current?.state) && current.tabId && Date.now() - current.startedAt < 300000) {
        try {
          await chrome.tabs.update(current.tabId, { active: true });
          sendResponse({ ok: true, tabId: current.tabId, existing: true });
          return;
        } catch (_error) {}
      }
      const tab = await chrome.tabs.create({ url: "https://www.youtube.com/feed/channels#chanlume-update-subscriptions", active: true });
      await chrome.storage.local.set({ chanlumeScanStatus: { state: "starting", count: 0, startedAt: Date.now(), tabId: tab.id } });
      sendResponse({ ok: true, tabId: tab.id });
    })().catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_PROGRESS") {
    chrome.storage.local.set({ chanlumeScanStatus: { state: "running", count: Number(message.count) || 0, startedAt: Number(message.startedAt) || Date.now(), tabId: _sender.tab?.id } })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_COMPLETE") {
    const count = Number(message.count) || 0;
    (async () => {
      await chrome.storage.local.set({ chanlumeScanStatus: { state: "complete", count, completedAt: Date.now() } });
      await chrome.action.setBadgeBackgroundColor({ color: "#2dbd9b" });
      await chrome.action.setBadgeText({ text: "✓" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
      if (_sender.tab?.id && _sender.tab.url?.includes("#chanlume-update-subscriptions")) setTimeout(() => chrome.tabs.remove(_sender.tab.id).catch(() => {}), 900);
      sendResponse({ ok: true });
    })().catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message?.type === "SUBSCRIPTION_UPDATE_FAILED") {
    chrome.storage.local.set({ chanlumeScanStatus: { state: "failed", count: Number(message.count) || 0, completedAt: Date.now(), error: String(message.error || "") } })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});
