(function () {
  "use strict";
  const Core = globalThis.ChanlumeCore;
  const STORAGE_KEY = "chanlumeState";
  const API_KEY_STORAGE = "chanlumeYouTubeApiKey";
  const PROFILE_VERSION = 5;
  const COLORS = ["#7c5cff", "#ff6b8a", "#2dbd9b", "#f0a44b", "#4a91ff", "#bc6fe8"];
  let state = Core.defaultState();
  const initialDashboardView = new URLSearchParams(location.search).get("view") === "settings" ? "settings" : "library";
  let dashboardView = initialDashboardView;
  let selectedGroupId = "all";
  let managingMembers = false;
  let memberDraft = new Map();
  let memberSaving = false;
  const draftMember = (group, id) => memberDraft.has(id) ? memberDraft.get(id) : group.channelIds.includes(id);
  let query = "";
  let autoController = null;
  let profileController = null;
  let autoCommitting = false;
  let workspaceLayoutFrame = 0;
  let onboardingStep = -1;
  let onboardingWaitingForScan = false;
  let onboardingWaitingForAuto = false;
  let youtubeApiKey = "";

  const api = location.protocol === "chrome-extension:" && globalThis.chrome?.storage?.local
    ? {
        load: async () => (await Core.readStoredValues(chrome.storage.local, STORAGE_KEY))[STORAGE_KEY],
        mutate: (operation) => chrome.runtime.sendMessage({ type: "CHANLUME_MUTATE", operation }),
        loadSecret: async () => String((await Core.readStoredValues(chrome.storage.local, API_KEY_STORAGE))[API_KEY_STORAGE] || ""),
        saveSecret: (value) => chrome.runtime.sendMessage({ type: "CHANLUME_SET_API_KEY", value: String(value || "") }),
        open: (url) => chrome.tabs.create({ url }),
        onChange: (callback) => chrome.storage.onChanged.addListener(callback)
      }
    : {
        load: async () => {
          const previewLanguage = new URLSearchParams(location.search).get("lang");
          const defaults = Core.defaultState();
          return ({
          ...defaults,
          channels: {
            "/@kurzgesagt": { id: "/@kurzgesagt", name: "Kurzgesagt – In a Nutshell", url: "https://www.youtube.com/@kurzgesagt" },
            "/@veritasium": { id: "/@veritasium", name: "Veritasium", url: "https://www.youtube.com/@veritasium" },
            "/@lofigirl": { id: "/@lofigirl", name: "Lofi Girl", url: "https://www.youtube.com/@lofigirl", recentTitles: ["lofi music for studying", "relaxing piano music", "jazz and lofi playlist"], profileVersion: PROFILE_VERSION, profiledAt: Date.now() },
            "/@gamemakers": { id: "/@gamemakers", name: "Game Maker's Toolkit", url: "https://www.youtube.com/@gamemakers", recentTitles: ["Game design tutorial", "How indie game development works", "Level design explained"], profileVersion: PROFILE_VERSION, profiledAt: Date.now() },
            "/@twreporter": { id: "/@twreporter", name: "報導者 The Reporter", url: "https://www.youtube.com/@twreporter", recentTitles: ["國際新聞調查報導", "今日政治時事", "深度新聞專題"], profileVersion: PROFILE_VERSION, profiledAt: Date.now() }
          },
          groups: [
            { id: "learning", name: "學習", icon: "book", color: "#7c5cff", channelIds: ["/@kurzgesagt", "/@veritasium"] },
            { id: "relax", name: "放鬆", icon: "music", color: "#ff6b8a", channelIds: [] }
          ],
          settings: { ...defaults.settings, language: previewLanguage ? Core.languageCode(previewLanguage) : defaults.settings.language, onboardingComplete: new URLSearchParams(location.search).get("tour") !== "1" }
        }); },
        mutate: async (operation) => {
          const next = Core.applyStateOperation(state, operation);
          next.revision = state.revision + 1;
          return { ok: true, state: Core.normalizeState(next) };
        },
        loadSecret: async () => "", saveSecret: async () => ({ ok: true }), open: (url) => window.open(url, "_blank"), onChange: () => {}
      };

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const currentLanguage = () => Core.languageCode(state.settings?.language);
  const t = (value) => Core.translateUiText(value, currentLanguage());
  function localize(root = document) {
    document.documentElement.lang = currentLanguage() === "en" ? "en" : "zh-Hant";
    document.title = Core.translateUiText("Chanlume 管理中心", currentLanguage());
    Core.localizeDom(root, currentLanguage());
  }

  function acceptState(next, force = false) {
    if (!force && Number.isSafeInteger(next?.revision) && next.revision <= state.revision) return false;
    const incoming = Core.normalizeState(next);
    if (!force && incoming.revision <= state.revision) return false;
    state = incoming;
    if (!["all", "unfiled"].includes(selectedGroupId) && !state.groups.some((group) => group.id === selectedGroupId)) {
      selectedGroupId = "all";
      managingMembers = false;
    }
    return true;
  }

  async function commit(operation, message) {
    const result = await api.mutate(operation);
    if (!result?.ok) throw Object.assign(new Error(result?.error || "State update failed"), { code: result?.code });
    if (acceptState(result.state)) render();
    if (message) toast(message);
    return state;
  }

  function render() {
    const channels = Object.values(state.channels);
    const filed = new Set(state.groups.flatMap((group) => group.channelIds)).size;
    const progress = channels.length ? Math.round((filed / channels.length) * 100) : 0;
    $("stat-channels").textContent = channels.length;
    $("stat-groups").textContent = state.groups.length;
    $("stat-progress").textContent = `${progress}%`;
    $("stat-unfiled").textContent = channels.length ? `${channels.length - filed} 個頻道尚未分類` : "尚無待分類頻道";
    renderGroups();
    renderChannels();
    document.querySelectorAll("[data-setting]").forEach((input) => { input.checked = Boolean(state.settings[input.dataset.setting]); });
    $("language-select").value = currentLanguage();
    $("open-home").hidden = Boolean(state.settings.blockHome);
    renderApiStatus();
    localize();
    const detailDialog = $("channel-dialog");
    if (detailDialog?.open) {
      const channelId = $("detail-open").dataset.channelId;
      if (state.channels[channelId]) openChannelDetail(channelId);
      else detailDialog.close();
    }
    const groupDialog = $("group-dialog");
    if (groupDialog?.open && $("group-id").value && !state.groups.some((group) => group.id === $("group-id").value)) groupDialog.close();
  }

  function renderApiStatus() {
    const status = $("youtube-api-status");
    const clear = $("clear-youtube-api-key");
    if (!status || !clear) return;
    status.textContent = youtubeApiKey ? `已在本機設定（末四碼 ${youtubeApiKey.slice(-4)}）；更新資料或自動整理時會加入官方分類。` : "尚未設定，仍會使用完整的本機字典。";
    clear.disabled = !youtubeApiKey;
    $("youtube-api-key").placeholder = youtubeApiKey ? `已儲存：••••${youtubeApiKey.slice(-4)}` : "貼上 API Key";
    localize(status.closest(".api-card"));
  }

  function scheduleWorkspaceLayout() {
    cancelAnimationFrame(workspaceLayoutFrame);
    workspaceLayoutFrame = requestAnimationFrame(() => {
      const groupPane = document.querySelector(".group-pane");
      const channelPane = document.querySelector(".channel-pane");
      const channelList = $("channel-list");
      const toolbar = channelPane?.querySelector(".channel-toolbar");
      const manager = $("member-manager");
      if (!groupPane || !channelPane || !channelList || !toolbar) return;
      if (matchMedia("(max-width: 680px)").matches) {
        channelPane.style.height = "";
        channelList.style.maxHeight = "";
        return;
      }
      channelPane.style.height = "auto";
      channelList.style.maxHeight = "none";
      const fixedHeight = toolbar.offsetHeight + (manager.hidden ? 0 : manager.offsetHeight) + 2;
      const naturalHeight = fixedHeight + channelList.scrollHeight;
      const paneTop = Math.max(0, channelPane.getBoundingClientRect().top);
      const viewportCapacity = Math.max(360, window.innerHeight - paneTop - 24);
      const availableHeight = Math.max(groupPane.offsetHeight, viewportCapacity);
      const targetHeight = Math.min(naturalHeight, availableHeight);
      channelPane.style.height = `${Math.ceil(targetHeight)}px`;
      channelList.style.maxHeight = `${Math.max(180, Math.floor(targetHeight - fixedHeight))}px`;
    });
  }

  function renderGroups() {
    const items = [
      { id: "all", name: "全部頻道", icon: "star", color: "#8c8497", channelIds: Object.keys(state.channels), systemLabel: "所有已收集頻道" },
      { id: "unfiled", name: "未分類", icon: "sparkles", color: "#f0a44b", channelIds: Core.unfiledChannelIds(state), systemLabel: "等待手動或自動整理" },
      ...state.groups
    ];
    $("group-list").innerHTML = items.map((group) => `<button class="group-item ${selectedGroupId === group.id ? "active" : ""}" data-group="${escapeHtml(group.id)}" type="button">
      <span class="group-icon" style="color:${group.color};background:${group.color}1b">${Core.iconSvg(group.icon, "currentColor", 17)}</span>
      <span class="group-copy"><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.systemLabel || "自訂群組")}</small></span>
      <span class="group-number">${group.channelIds.length}</span>
    </button>`).join("");
  }

  function renderChannels() {
    const isUnfiled = selectedGroupId === "unfiled";
    const selected = state.groups.find((group) => group.id === selectedGroupId);
    const unfiled = new Set(Core.unfiledChannelIds(state));
    const selectedIds = selected && !managingMembers ? new Set(selected.channelIds) : null;
    const membershipsByChannel = new Map();
    for (const group of state.groups) {
      for (const channelId of group.channelIds) {
        if (!membershipsByChannel.has(channelId)) membershipsByChannel.set(channelId, []);
        membershipsByChannel.get(channelId).push(group);
      }
    }
    $("selected-title").textContent = managingMembers && selected ? `管理「${selected.name}」成員` : isUnfiled ? "未分類" : selected?.name || "全部頻道";
    $("selected-subtitle").textContent = managingMembers && selected ? "勾選頻道後按儲存；取消不會修改群組。" : "點擊頻道可在 YouTube 開啟；使用詳細資料調整分類。";
    $("group-actions").hidden = !selected;
    $("manage-members").hidden = managingMembers;
    $("edit-selected-group").disabled = managingMembers;
    document.querySelectorAll("[data-group], .nav-item, #new-group, #mini-add, #auto-organize").forEach((button) => { button.disabled = managingMembers; });
    $("save-members").disabled = memberSaving || !memberDraft.size;
    $("channel-list").classList.toggle("is-editing", managingMembers);
    $("member-manager").hidden = !managingMembers || !selected;
    $("member-count").textContent = selected ? `${Object.keys(state.channels).filter((id) => draftMember(selected, id)).length} / ${Object.keys(state.channels).length}` : "0 / 0";
    $("search").placeholder = managingMembers ? "搜尋全部頻道" : "搜尋這個群組";
    if (!profileController) $("refresh-profiles").textContent = selected ? "更新此群組資料" : isUnfiled ? "更新未分類資料" : "更新全部頻道資料";
    const channels = Object.values(state.channels)
      .filter((channel) => !isUnfiled || unfiled.has(channel.id))
      .filter((channel) => !selectedIds || selectedIds.has(channel.id))
      .filter((channel) => !query || channel.name.toLowerCase().includes(query) || channel.id.includes(query))
      .sort((a, b) => {
        if (managingMembers && selected) {
          const membershipOrder = Number(selected.channelIds.includes(b.id)) - Number(selected.channelIds.includes(a.id));
          if (membershipOrder) return membershipOrder;
        }
        return a.name.localeCompare(b.name, "zh-Hant");
      });
    if (managingMembers && selected) {
      const visibleMemberCount = channels.filter((channel) => draftMember(selected, channel.id)).length;
      const visibleMissingCount = channels.length - visibleMemberCount;
      $("add-filtered").textContent = `加入目前結果（${visibleMissingCount}）`;
      $("remove-filtered").textContent = `移出目前結果（${visibleMemberCount}）`;
      $("add-filtered").disabled = visibleMissingCount === 0;
      $("remove-filtered").disabled = visibleMemberCount === 0;
    }
    if (!channels.length) {
      const emptyGroup = selected || isUnfiled;
      $("channel-list").innerHTML = `<div class="empty-state"><div class="empty-icon">${Core.iconSvg(query ? "star" : "book", "currentColor", 25)}</div><strong>${query ? "找不到符合的頻道" : emptyGroup ? "這裡目前沒有頻道" : "書架還是空的"}</strong><p>${query ? "換個關鍵字再試一次。" : emptyGroup ? "可從頻道詳細資料調整群組，或執行本機自動整理。" : "按「更新訂閱內容」，Chanlume 就會自動載入全部 YouTube 訂閱頻道。"}</p></div>`;
      localize($("channel-list").closest(".channel-pane"));
      scheduleWorkspaceLayout();
      return;
    }
    $("channel-list").innerHTML = channels.map((channel) => {
      const memberships = membershipsByChannel.get(channel.id) || [];
      const avatar = channel.avatar ? `<img src="${escapeHtml(channel.avatar)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : escapeHtml(channel.name.slice(0, 1).toUpperCase());
      const chips = memberships.length ? `${memberships.slice(0, 1).map((group) => `<span class="chip" style="color:${group.color};background:${group.color}17">${escapeHtml(group.name)}</span>`).join("")}${memberships.length > 1 ? `<span class="chip">+${memberships.length - 1}</span>` : ""}` : '<span class="unfiled">尚未分類</span>';
      if (managingMembers && selected) return `<label class="member-row"><input type="checkbox" data-member="${escapeHtml(channel.id)}" ${draftMember(selected, channel.id) ? "checked" : ""} ${memberSaving ? "disabled" : ""}><span class="avatar">${avatar}</span><span class="member-copy"><strong>${escapeHtml(channel.name)}</strong><small>${escapeHtml(channel.id)}</small></span><span class="chips">${chips}</span></label>`;
      return `<article class="channel-card" data-channel-row="${escapeHtml(channel.id)}" tabindex="0" role="link" aria-label="${escapeHtml(t("在 YouTube 開啟") + " " + channel.name)}"><div class="channel-main"><span class="avatar">${avatar}</span><span class="channel-name">${escapeHtml(channel.name)}</span><span class="channel-url">${escapeHtml(channel.id)}</span></div><div class="chips">${chips}</div><button class="channel-detail button ghost compact" data-detail="${escapeHtml(channel.id)}">詳細資料</button></article>`;
    }).join("");
    localize($("channel-list").closest(".channel-pane"));
    scheduleWorkspaceLayout();
  }

  function openChannelDetail(channelId) {
    const channel = state.channels[channelId];
    if (!channel) return;
    const memberships = Core.groupForChannel(state, channel.id);
    const suggestion = Core.classifyChannel(channel, state);
    const avatar = channel.avatar ? `<img src="${escapeHtml(channel.avatar)}" alt="" referrerpolicy="no-referrer" />` : escapeHtml(channel.name.slice(0, 1).toUpperCase());
    $("detail-avatar").innerHTML = avatar;
    $("detail-name").textContent = channel.name;
    $("detail-id").textContent = channel.id;
    $("detail-open").dataset.url = channel.url;
    $("detail-open").dataset.channelId = channel.id;
    $("detail-groups").innerHTML = state.groups.length
      ? state.groups.map((group) => `<label class="detail-group-option"><input type="checkbox" data-detail-group="${escapeHtml(group.id)}" data-detail-channel="${escapeHtml(channel.id)}" ${group.channelIds.includes(channel.id) ? "checked" : ""}><span>${escapeHtml(group.name)}</span></label>`).join("")
      : '<span class="detail-empty">尚未建立群組</span>';
    const confidenceNames = { high: "高信心", medium: "中等信心", low: "低信心" };
    $("detail-suggestion").innerHTML = suggestion
      ? `<strong>${escapeHtml(suggestion.name)}</strong><span class="confidence">${confidenceNames[suggestion.confidence] || "建議"}</span>`
      : '<span class="detail-empty">目前沒有明確建議</span>';
    $("detail-reasons").textContent = suggestion?.reasons?.length ? `依據：${suggestion.reasons.join("、")}` : "沒有足夠且唯一的主題訊號";
    $("detail-tags").innerHTML = suggestion?.tags?.length ? suggestion.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") : "";
    const matchesCurrent = suggestion && memberships.some((group) => group.name === suggestion.name);
    $("detail-suggestion-card").classList.toggle("detail-mismatch", Boolean(suggestion && memberships.length && !matchesCurrent));
    $("detail-description").textContent = channel.description || "尚未取得頻道簡介；執行自動整理後會補齊公開資料。";
    $("detail-titles").innerHTML = channel.recentTitles?.length
      ? channel.recentTitles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")
      : '<li class="detail-empty">尚未取得近期影片標題</li>';
    localize($("channel-dialog"));
    if (!$("channel-dialog").open) $("channel-dialog").showModal();
  }

  function openDialog(group) {
    $("dialog-title").textContent = group ? "編輯群組" : "新增群組";
    $("group-id").value = group?.id || "";
    $("group-name").value = group?.name || "";
    $("icon-options").innerHTML = Object.keys(Core.ICONS).map((icon, index) => `<label class="option-radio"><input type="radio" name="icon" value="${icon}" ${(group?.icon || "book") === icon || (!group && index === 0) ? "checked" : ""}><span>${Core.iconSvg(icon, "currentColor", 17)}</span></label>`).join("");
    $("color-options").innerHTML = COLORS.map((color, index) => `<label class="option-radio"><input type="radio" name="color" value="${color}" ${(group?.color || COLORS[0]) === color || (!group && index === 0) ? "checked" : ""}><span style="background:${color}"></span></label>`).join("");
    $("delete-group").hidden = !group;
    const mergeTargets = group ? state.groups.filter((item) => item.id !== group.id) : [];
    $("merge-group-section").hidden = !group;
    $("merge-group-target").innerHTML = mergeTargets.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    $("merge-group-target").hidden = !mergeTargets.length;
    $("merge-group").hidden = !mergeTargets.length;
    $("merge-group-empty").hidden = Boolean(mergeTargets.length);
    localize($("group-dialog"));
    $("group-dialog").showModal();
    setTimeout(() => $("group-name").focus(), 30);
  }

  function toast(message) {
    const node = $("toast");
    node.textContent = Core.translateUiText(message, currentLanguage());
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  }

  function extractJsonObject(source, start) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === "{") depth += 1;
      if (char === "}" && --depth === 0) return source.slice(start, index + 1);
    }
    return "";
  }

  function parseInitialData(documentNode) {
    const markers = ["var ytInitialData =", 'window["ytInitialData"] =', "ytInitialData ="];
    for (const script of documentNode.scripts) {
      const source = script.textContent || "";
      for (const marker of markers) {
        const markerIndex = source.indexOf(marker);
        if (markerIndex < 0) continue;
        const start = source.indexOf("{", markerIndex + marker.length);
        if (start < 0) continue;
        try { return JSON.parse(extractJsonObject(source, start)); }
        catch (_error) {}
      }
    }
    return null;
  }

  function collectVideoTitles(initialData) {
    return Core.collectRecentVideoTitles(initialData);
  }

  function collectChannelMetadata(initialData) {
    let metadata = null;
    function visit(node) {
      if (!node || metadata) return;
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (typeof node !== "object") return;
      if (node.channelMetadataRenderer) { metadata = node.channelMetadataRenderer; return; }
      Object.values(node).forEach(visit);
    }
    visit(initialData);
    return {
      description: String(metadata?.description || "").trim(),
      keywords: String(metadata?.keywords || "").trim(),
      channelId: String(metadata?.externalId || "").trim()
    };
  }

  function extractChannelId(source, page, metadataId) {
    if (metadataId) return metadataId;
    const metaId = page.querySelector('meta[itemprop="channelId"]')?.content?.trim();
    if (metaId) return metaId;
    return source.match(/"(?:externalId|channelId)":"(UC[\w-]+)"/)?.[1] || "";
  }

  async function fetchChannelProfile(channel, signal) {
    const response = await fetch(`${channel.url.replace(/\/$/, "")}/videos`, { credentials: "include", cache: "no-store", signal });
    if (!response.ok) throw new Error(`YouTube ${response.status}`);
    const source = await response.text();
    const page = new DOMParser().parseFromString(source, "text/html");
    const initialData = parseInitialData(page);
    const metadata = collectChannelMetadata(initialData);
    const channelId = extractChannelId(source, page, metadata.channelId);
    const description = metadata.description || page.querySelector('meta[name="description"], meta[property="og:description"]')?.content?.trim() || "";
    const keywords = Core.sanitizeChannelKeywords(metadata.keywords);
    let recentVideos = Core.collectRecentVideos(initialData);
    let recentTitles = recentVideos.map((video) => video.title);
    let recentVideoIds = recentVideos.map((video) => video.id).filter(Boolean);
    if (!recentTitles.length && channelId) {
      try {
        const feedResponse = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, { cache: "no-store", signal });
        if (feedResponse.ok) {
          const feed = new DOMParser().parseFromString(await feedResponse.text(), "application/xml");
          recentVideos = [...feed.getElementsByTagName("entry")].map((entry) => ({ id: entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim() || "", title: entry.getElementsByTagName("title")[0]?.textContent?.trim() || "" })).filter((video) => video.title).slice(0, 20);
          recentTitles = recentVideos.map((video) => video.title);
          recentVideoIds = recentVideos.map((video) => video.id).filter(Boolean);
        }
      } catch (error) {
        if (error.name === "AbortError") throw error;
      }
    }
    return { description: Core.sanitizeDescription(description), keywords, channelId, recentTitles, recentVideoIds, profiledAt: Date.now(), profileVersion: PROFILE_VERSION };
  }

  function chunks(values, size) {
    const result = [];
    for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
    return result;
  }

  async function fetchYouTubeApi(path, params, signal) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    Object.entries({ ...params, key: youtubeApiKey }).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { cache: "no-store", signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `YouTube API ${response.status}`);
    return data;
  }

  async function enrichOfficialMetadata(channels, signal, onProgress) {
    if (!youtubeApiKey) return { channelCount: 0, videoCount: 0 };
    const eligible = channels.filter((channel) => channel.channelId);
    const byOfficialId = new Map(eligible.map((channel) => [channel.channelId, channel]));
    let completed = 0;
    const channelBatches = chunks([...byOfficialId.keys()], 50);
    for (const ids of channelBatches) {
      const data = await fetchYouTubeApi("channels", { part: "topicDetails", id: ids.join(","), maxResults: "50" }, signal);
      for (const item of data.items || []) {
        const channel = byOfficialId.get(item.id);
        if (!channel) continue;
        channel.topicCategories = item.topicDetails?.topicCategories || [];
        channel.topicIds = item.topicDetails?.topicIds || [];
      }
      completed += ids.length;
      onProgress?.(completed, eligible.length, "正在讀取 YouTube 官方頻道主題");
    }
    const videoIds = [...new Set(eligible.flatMap((channel) => (channel.recentVideoIds || []).slice(0, 10)))];
    const categoryCounts = new Map(eligible.map((channel) => [channel.channelId, {}]));
    const officialTags = new Map(eligible.map((channel) => [channel.channelId, new Set()]));
    let videoDone = 0;
    for (const ids of chunks(videoIds, 50)) {
      const data = await fetchYouTubeApi("videos", { part: "snippet", id: ids.join(","), maxResults: "50" }, signal);
      for (const item of data.items || []) {
        const ownerId = item.snippet?.channelId;
        const categoryId = String(item.snippet?.categoryId || "");
        if (categoryCounts.has(ownerId) && categoryId) {
          const counts = categoryCounts.get(ownerId);
          counts[categoryId] = (counts[categoryId] || 0) + 1;
        }
        const tags = officialTags.get(ownerId);
        (item.snippet?.tags || []).slice(0, 12).forEach((tag) => { if (tags.size < 40) tags.add(String(tag)); });
      }
      videoDone += ids.length;
      onProgress?.(videoDone, videoIds.length, "正在統計近期影片官方類別");
    }
    for (const channel of eligible) {
      channel.videoCategoryCounts = categoryCounts.get(channel.channelId) || {};
      channel.officialTags = [...(officialTags.get(channel.channelId) || [])];
      channel.officialProfiledAt = Date.now();
    }
    return { channelCount: eligible.length, videoCount: videoIds.length };
  }

  function profileScopeChannels() {
    const selected = state.groups.find((group) => group.id === selectedGroupId);
    if (selected) return selected.channelIds.map((id) => state.channels[id]).filter(Boolean);
    if (selectedGroupId === "unfiled") {
      const ids = new Set(Core.unfiledChannelIds(state));
      return Object.values(state.channels).filter((channel) => ids.has(channel.id));
    }
    return Object.values(state.channels);
  }

  async function refreshProfiles() {
    if (profileController) { profileController.abort(); return; }
    const targets = profileScopeChannels().map((channel) => structuredClone(channel));
    if (!targets.length) { toast("目前沒有頻道可更新"); return; }
    if (targets.length >= 50 && !confirm(t(`要更新 ${targets.length} 個頻道的公開資料嗎？可以隨時按「停止更新」。`))) return;
    profileController = new AbortController();
    let cursor = 0;
    let done = 0;
    let failed = 0;
    let withTitles = 0;
    const button = $("refresh-profiles");
    button.classList.add("danger");
    button.textContent = `停止更新 0 / ${targets.length}`;
    const controller = profileController;
    try {
      const workers = Array.from({ length: Math.min(3, targets.length) }, async () => {
        while (cursor < targets.length && !controller.signal.aborted) {
          const channel = targets[cursor++];
          try {
            Object.assign(channel, await fetchChannelProfile(channel, controller.signal));
            if (channel.recentTitles?.length) withTitles += 1;
          } catch (error) {
            if (error.name !== "AbortError") failed += 1;
          }
          done += 1;
          button.textContent = `停止更新 ${done} / ${targets.length}`;
        }
      });
      await Promise.all(workers);
      let officialError = "";
      if (youtubeApiKey && !controller.signal.aborted) {
        button.textContent = "正在讀取 YouTube 官方分類…";
        try { await enrichOfficialMetadata(targets, controller.signal); }
        catch (error) { if (error.name !== "AbortError") officialError = error.message || "官方分類讀取失敗"; }
      }
      await commit({ type: "patch-channels", payload: { updates: targets.map((channel) => ({ id: channel.id, patch: channel })) } });
      toast(controller.signal.aborted ? `已停止；保留 ${done} 個更新結果` : officialError ? `本機資料已更新；官方分類失敗：${officialError}` : `更新完成：${withTitles} 個取得影片標題${failed ? `，${failed} 個讀取失敗` : ""}`);
    } finally {
      if (profileController === controller) profileController = null;
      button.classList.remove("danger");
      renderChannels();
    }
  }

  function updateAutoProgress(done, total, channelName) {
    const percent = total ? Math.round((done / total) * 100) : 100;
    $("auto-percent").textContent = `${percent}%`;
    $("auto-progress-bar").style.width = `${percent}%`;
    $("auto-progress-title").textContent = done < total ? "正在取得頻道分類線索" : "正在本機產生分類建議";
    $("auto-progress-copy").textContent = done < total ? `${done} / ${total}　${channelName || ""}` : "所有文字只在這台裝置上分析。";
    localize($("auto-progress"));
  }

  async function startAutoOrganize() {
    if (autoController) return;
    const unfiledIds = new Set(Core.unfiledChannelIds(state));
    const unfiled = Object.values(state.channels).filter((channel) => unfiledIds.has(channel.id)).map((channel) => structuredClone(channel));
    if (!unfiled.length) { closeAutoDialog(); toast(Object.keys(state.channels).length ? "目前沒有尚未分類的頻道" : "請先更新訂閱內容"); return; }
    autoController = new AbortController();
    const controller = autoController;
    $("auto-organize").disabled = true;
    $("auto-progress").hidden = false;
    $("auto-retry").hidden = true;
    $("auto-save-error").textContent = "";
    const staleBefore = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const targets = unfiled.filter((channel) => channel.profileVersion !== PROFILE_VERSION || !channel.profiledAt || channel.profiledAt < staleBefore);
    let cursor = 0;
    let done = 0;
    let failed = 0;
    updateAutoProgress(0, targets.length, "");
    try {
      const workers = Array.from({ length: Math.min(3, targets.length) }, async () => {
        while (cursor < targets.length && !controller.signal.aborted) {
          const channel = targets[cursor++];
          try { Object.assign(channel, await fetchChannelProfile(channel, controller.signal)); }
          catch (error) { if (error.name !== "AbortError") failed += 1; }
          done += 1;
          updateAutoProgress(done, targets.length, channel.name);
        }
      });
      await Promise.all(workers);
      if (controller.signal.aborted) {
        await commit({ type: "patch-channels", payload: { updates: unfiled.map((channel) => ({ id: channel.id, patch: channel })) } });
        return;
      }
      let officialError = "";
      const officialTargets = unfiled.filter((channel) => !channel.officialProfiledAt || channel.officialProfiledAt < staleBefore);
      if (youtubeApiKey && officialTargets.length) {
        try {
          await enrichOfficialMetadata(officialTargets, controller.signal, (current, total, label) => {
            const percent = total ? Math.round((current / total) * 100) : 100;
            $("auto-percent").textContent = `${percent}%`;
            $("auto-progress-bar").style.width = `${percent}%`;
            $("auto-progress-title").textContent = label;
            $("auto-progress-copy").textContent = `${current} / ${total}　只傳送公開的頻道與影片 ID。`;
            localize($("auto-progress"));
          });
        } catch (error) {
          if (error.name !== "AbortError") officialError = error.message || "官方分類讀取失敗";
        }
      }
      await commit({ type: "patch-channels", payload: { updates: unfiled.map((channel) => ({ id: channel.id, patch: channel })) } });
      if (controller.signal.aborted) return;
      updateAutoProgress(targets.length, targets.length, "");
      autoCommitting = true;
      $("auto-cancel").disabled = true;
      $("auto-close").disabled = true;
      $("auto-progress-title").textContent = t("正在儲存分類…");
      const beforeIds = new Set(Core.unfiledChannelIds(state));
      await commit({ type: "auto-classify", payload: { channelIds: unfiled.map((channel) => channel.id) } });
      const afterIds = new Set(Core.unfiledChannelIds(state));
      toast(`已整理 ${[...beforeIds].filter((id) => !afterIds.has(id)).length} 個頻道`);
      $("auto-dialog").close();
      if (officialError) toast(`已用本機資料完成；YouTube 官方分類失敗：${officialError}`);
      else if (failed) toast(`${failed} 個頻道暫時無法讀取，已用現有資料分析`);
    } catch (_) {
      if (!controller.signal.aborted) {
        $("auto-save-error").textContent = t("自動分類失敗，請重試。");
        $("auto-progress").hidden = true;
        $("auto-retry").hidden = false;
      }
    } finally {
      autoController = null;
      autoCommitting = false;
      $("auto-organize").disabled = false;
      $("auto-cancel").disabled = false;
      $("auto-close").disabled = false;
    }
  }

  function closeAutoDialog() {
    if (autoCommitting) return;
    autoController?.abort();
    $("auto-dialog").close();
  }

  function setDashboardView(view) {
    dashboardView = view === "settings" ? "settings" : "library";
    const settings = view === "settings";
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    $("library-view").hidden = settings;
    $("settings-view").hidden = !settings;
    document.querySelector(".page-header h1").textContent = settings ? "偏好設定" : "訂閱書架";
    document.querySelector(".page-header > div > p:last-child").textContent = settings ? "控制 YouTube 頁面上的顯示方式與本機資料。" : "把頻道放進不同群組，回到 YouTube 就能一鍵篩選。";
    localize(document.querySelector(".page-header"));
    if (!settings) scheduleWorkspaceLayout();
  }

  async function requestSubscriptionUpdate() {
    if (!globalThis.chrome?.runtime?.sendMessage) { toast("預覽模式無法啟動掃描"); return false; }
    const button = $("update-subscriptions");
    button.disabled = true;
    button.textContent = "更新中…";
    try {
      const result = await chrome.runtime.sendMessage({ type: "START_SUBSCRIPTION_UPDATE" });
      if (!result?.ok) throw new Error("start failed");
      toast(result.existing ? "訂閱內容正在更新" : "正在更新全部訂閱內容");
      return true;
    } catch (_error) {
      button.disabled = false;
      button.textContent = "更新訂閱內容";
      toast("無法啟動訂閱更新");
      return false;
    }
  }

  const ONBOARDING_STEPS = [
    { icon: "✦", title: "歡迎使用 Chanlume", copy: "這份教學會陪你完成第一次更新、第一次本機自動整理，以及日後手動管理群組的方法。所有資料只留在這台裝置。", action: "開始教學" },
    { icon: "↻", title: "先建立你的訂閱書架", copy: "按下「更新訂閱內容」後，Chanlume 會開啟 YouTube 的所有訂閱頁並自動載入完整清單。完成後這個頁面會立即顯示頻道。", target: "#update-subscriptions", action: "更新訂閱內容" },
    { icon: "✦", title: "第一次自動整理", copy: "自動分類會直接整理所有待分類頻道；資訊不足的放入「其他」，之後都能編輯。", target: "#auto-organize", action: "開啟自動整理" },
    { icon: "▦", title: "檢查並手動調整", copy: "選擇左側群組即可查看真正成員。點頻道卡片可看詳細資料；使用「管理成員」可批次加入或移出，也能用「新增群組」建立自己的分類。", target: ".group-pane", action: "下一步" },
    { icon: "⌁", title: "依喜好整理 YouTube", copy: "偏好設定可以封鎖首頁、關閉 Shorts、隱藏影片右欄、關閉自動播放與隱藏已觀看影片；下方也能匯出或匯入備份。", target: ".settings-grid", action: "下一步" },
    { icon: "✓", title: "準備完成", copy: "回到 YouTube 訂閱內容後，可從左側 Chanlume 群組或頁面上方快速切換。齒輪會直接開啟完整面板。", action: "完成" }
  ];

  function clearOnboardingTarget() {
    document.querySelectorAll(".onboarding-target").forEach((node) => node.classList.remove("onboarding-target"));
  }

  function renderOnboarding() {
    const host = $("onboarding");
    const step = ONBOARDING_STEPS[onboardingStep];
    clearOnboardingTarget();
    if (!step) { host.hidden = true; return; }
    setDashboardView(onboardingStep === 0 ? initialDashboardView : onboardingStep === 4 ? "settings" : "library");
    host.hidden = false;
    $("onboarding-icon").textContent = step.icon;
    $("onboarding-title").textContent = step.title;
    $("onboarding-copy").textContent = step.copy;
    $("onboarding-progress").textContent = `${onboardingStep + 1} / ${ONBOARDING_STEPS.length}`;
    $("onboarding-dots").innerHTML = ONBOARDING_STEPS.map((_item, index) => `<span class="${index === onboardingStep ? "active" : ""}"></span>`).join("");
    $("onboarding-back").hidden = onboardingStep === 0;
    host.querySelector('[data-open-templates]').hidden = onboardingStep !== 0 && onboardingStep !== 4;
    const next = $("onboarding-next");
    next.textContent = step.action;
    next.disabled = onboardingStep === 1 && onboardingWaitingForScan;
    const status = $("onboarding-status");
    status.hidden = true;
    if (onboardingStep === 1 && onboardingWaitingForScan) {
      status.hidden = false;
      status.textContent = "更新正在另一個 YouTube 分頁進行；完成後書架會自動更新並帶你到下一步。";
      next.textContent = "等待更新完成…";
    } else if (onboardingStep === 1 && Object.keys(state.channels).length) {
      status.hidden = false;
      status.textContent = `目前書架已有 ${Object.keys(state.channels).length} 個頻道，可以直接前往下一步。`;
      next.textContent = "下一步";
    } else if (onboardingStep === 2) {
      const unfiled = Core.unfiledChannelIds(state).length;
      status.hidden = false;
      status.textContent = `${unfiled} 個頻道尚未分類；自動整理完成後仍可逐一修正。`;
    }
    if (step.target) {
      requestAnimationFrame(() => {
        const target = document.querySelector(step.target);
        if (!target || host.hidden || ONBOARDING_STEPS[onboardingStep] !== step) return;
        target.classList.add("onboarding-target");
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    localize(host);
  }

  function startOnboarding() {
    onboardingStep = 0;
    onboardingWaitingForScan = false;
    onboardingWaitingForAuto = false;
    renderOnboarding();
  }

  async function finishOnboarding(message, returnView = "library") {
    onboardingStep = -1;
    onboardingWaitingForScan = false;
    onboardingWaitingForAuto = false;
    clearOnboardingTarget();
    $("onboarding").hidden = true;
    await commit({ type: "set-onboarding-complete", payload: { complete: true } });
    setDashboardView(returnView);
    toast(message);
  }

  function openAutoOrganizer() {
    if (autoController) return;
    if (onboardingStep === 2) {
      onboardingWaitingForAuto = true;
      clearOnboardingTarget();
      $("onboarding").hidden = true;
    }
    $("auto-dialog").showModal();
    startAutoOrganize();
  }

  async function advanceOnboarding() {
    if (onboardingStep === 0 || onboardingStep === 3 || onboardingStep === 4) {
      onboardingStep += 1;
      renderOnboarding();
      return;
    }
    if (onboardingStep === 1) {
      if (Object.keys(state.channels).length) {
        onboardingStep = 2;
        renderOnboarding();
        return;
      }
      onboardingWaitingForScan = await requestSubscriptionUpdate();
      renderOnboarding();
      return;
    }
    if (onboardingStep === 2) {
      openAutoOrganizer();
      return;
    }
    if (onboardingStep === ONBOARDING_STEPS.length - 1) await finishOnboarding("新手教學已完成");
  }

  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
    if (!managingMembers) setDashboardView(button.dataset.view);
  }));
  $("group-list").addEventListener("click", (event) => { const id = event.target.closest("[data-group]")?.dataset.group; if (id && !managingMembers && !memberSaving) { selectedGroupId = id; managingMembers = false; query = ""; $("search").value = ""; render(); } });
  $("channel-list").addEventListener("click", async (event) => {
    const detail = event.target.closest("[data-detail]")?.dataset.detail;
    if (detail) { openChannelDetail(detail); return; }
    if (event.target.closest("a, button, input, select")) return;
    const rowId = event.target.closest("[data-channel-row]")?.dataset.channelRow;
    if (rowId) api.open(state.channels[rowId].url);
  });
  $("channel-list").addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const row = event.target.closest("[data-channel-row]");
    if (event.target !== row) return;
    const rowId = row?.dataset.channelRow;
    if (!rowId) return;
    event.preventDefault();
    api.open(state.channels[rowId].url);
  });
  $("search").addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); renderChannels(); });
  $("refresh-profiles").addEventListener("click", refreshProfiles);
  $("edit-selected-group").addEventListener("click", () => {
    const group = state.groups.find((item) => item.id === selectedGroupId);
    if (group) openDialog(group);
  });
  $("manage-members").addEventListener("click", () => { managingMembers = true; memberDraft.clear(); query = ""; $("search").value = ""; renderChannels(); });
  $("cancel-members").addEventListener("click", () => { if (memberSaving) return; managingMembers = false; memberDraft.clear(); query = ""; $("search").value = ""; renderChannels(); });
  $("channel-list").addEventListener("change", (event) => {
    const id = event.target.dataset.member;
    if (!id || memberSaving) return;
    memberDraft.set(id, event.target.checked);
    renderChannels();
    [...document.querySelectorAll("[data-member]")].find((input) => input.dataset.member === id)?.focus();
  });
  $("save-members").addEventListener("click", async () => {
    if (memberSaving) return;
    memberSaving = true;
    renderChannels();
    try {
      await commit({ type: "edit-memberships", payload: { groupId: selectedGroupId, changes: [...memberDraft].map(([channelId, enabled]) => ({ channelId, enabled })) } }, "已儲存變更");
      memberDraft.clear();
      managingMembers = false;
      query = "";
      $("search").value = "";
    } catch (_) { toast("儲存失敗，請重試。"); }
    finally { memberSaving = false; renderChannels(); }
  });
  function updateFilteredMembership(add) {
    if (!managingMembers || memberSaving) return;
    Object.values(state.channels).filter((channel) => !query || channel.name.toLowerCase().includes(query) || channel.id.includes(query)).forEach((channel) => memberDraft.set(channel.id, add));
    renderChannels();
  }
  $("add-filtered").addEventListener("click", () => updateFilteredMembership(true));
  $("remove-filtered").addEventListener("click", () => updateFilteredMembership(false));
  window.addEventListener("beforeunload", (event) => { if (managingMembers && memberDraft.size) { event.preventDefault(); event.returnValue = ""; } });
  $("detail-close").addEventListener("click", () => $("channel-dialog").close());
  $("detail-refresh").addEventListener("click", async () => {
    const channelId = $("detail-open").dataset.channelId;
    const channel = state.channels[channelId] ? structuredClone(state.channels[channelId]) : null;
    if (!channel) return;
    const button = $("detail-refresh");
    button.disabled = true;
    button.textContent = "更新中…";
    try {
      Object.assign(channel, await fetchChannelProfile(channel));
      let officialError = "";
      if (youtubeApiKey) {
        try { await enrichOfficialMetadata([channel]); }
        catch (error) { officialError = error.message || "官方分類讀取失敗"; }
      }
      await commit({ type: "patch-channels", payload: { updates: [{ id: channel.id, patch: channel }] } });
      openChannelDetail(channelId);
      toast(officialError ? `本機資料已更新；${officialError}` : channel.recentTitles?.length ? `已取得 ${channel.recentTitles.length} 部近期影片` : "已更新資料，但頻道沒有可讀取的近期影片");
    } catch (_error) {
      toast("暫時無法更新這個頻道");
    } finally {
      button.disabled = false;
      button.textContent = "更新資料";
    }
  });
  $("detail-open").addEventListener("click", (event) => api.open(event.currentTarget.dataset.url));
  $("detail-groups").addEventListener("change", async (event) => {
    const input = event.target.closest("[data-detail-group]");
    if (!input) return;
    const group = state.groups.find((item) => item.id === input.dataset.detailGroup);
    const channelId = input.dataset.detailChannel;
    if (!group || !state.channels[channelId]) return;
    await commit({ type: "toggle-membership", payload: { channelId, groupId: group.id, enabled: input.checked } }, input.checked ? `已加入「${group.name}」，並記住這次修正` : `已移出「${group.name}」`);
    openChannelDetail(channelId);
  });
  [$("new-group"), $("mini-add")].forEach((button) => button.addEventListener("click", () => openDialog()));
  document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document.querySelectorAll("[data-open-templates]").forEach((button) => button.addEventListener("click", () => {
    $("template-options").innerHTML = Core.AUTO_GROUPS.map((group) => `<label><input type="checkbox" value="${escapeHtml(group.id)}"><span>${escapeHtml(t(group.name))}</span></label>`).join("");
    $("template-status").textContent = "";
    $("template-dialog").showModal();
    localize($("template-dialog"));
  }));
  $("template-apply").addEventListener("click", async () => {
    const groupIds = [...$("template-options").querySelectorAll("input:checked")].map((input) => input.value);
    if (!groupIds.length) { $("template-status").textContent = t("請先勾選群組"); return; }
    $("template-apply").disabled = true;
    try {
      await commit({ type: "add-group-templates", payload: { groupIds } });
      $("template-dialog").close();
      toast("群組已新增");
    } catch (_) { $("template-status").textContent = t("儲存失敗，請重試。"); }
    finally { $("template-apply").disabled = false; }
  });
  $("group-list").addEventListener("dblclick", (event) => { const id = event.target.closest("[data-group]")?.dataset.group; const group = state.groups.find((item) => item.id === id); if (group) openDialog(group); });
  $("group-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("group-name").value.trim();
    if (!name) return;
    const id = $("group-id").value;
    const icon = new FormData(event.currentTarget).get("icon") || "star";
    const color = new FormData(event.currentTarget).get("color") || COLORS[0];
    $("group-dialog").close();
    await commit({ type: "save-group", payload: { id, name, icon, color } }, id ? "群組已更新" : "群組已建立");
  });
  $("merge-group").addEventListener("click", async () => {
    const sourceId = $("group-id").value;
    const targetId = $("merge-group-target").value;
    const source = state.groups.find((item) => item.id === sourceId);
    const target = state.groups.find((item) => item.id === targetId);
    if (!source || !target || source.id === target.id) return;
    const prompt = `要將「${source.name}」的 ${source.channelIds.length} 個頻道合併到「${target.name}」嗎？來源群組會被刪除。`;
    if (!confirm(t(prompt))) return;
    selectedGroupId = target.id;
    managingMembers = false;
    $("group-dialog").close();
    await commit({ type: "merge-groups", payload: { sourceGroupId: source.id, targetGroupId: target.id } }, "群組已合併");
  });
  $("delete-group").addEventListener("click", async () => {
    const id = $("group-id").value;
    const group = state.groups.find((item) => item.id === id);
    if (!group || !confirm(t(`要刪除「${group.name}」嗎？其中 ${group.channelIds.length} 個頻道只會回到未分類，不會取消訂閱。`))) return;
    selectedGroupId = "all";
    managingMembers = false;
    $("group-dialog").close();
    await commit({ type: "delete-group", payload: { groupId: id } }, "群組已刪除；頻道資料仍保留");
  });
  $("open-home").addEventListener("click", () => api.open("https://www.youtube.com/"));
  $("open-youtube").addEventListener("click", () => api.open("https://www.youtube.com/feed/subscriptions"));
  $("update-subscriptions").addEventListener("click", async () => {
    const started = await requestSubscriptionUpdate();
    if (started && onboardingStep === 1) {
      onboardingWaitingForScan = true;
      renderOnboarding();
    }
  });
  $("auto-organize").addEventListener("click", openAutoOrganizer);
  $("auto-retry").addEventListener("click", startAutoOrganize);
  $("auto-cancel").addEventListener("click", closeAutoDialog);
  $("auto-close").addEventListener("click", closeAutoDialog);
  $("auto-dialog").addEventListener("cancel", (event) => { if (autoCommitting) event.preventDefault(); else autoController?.abort(); });
  $("auto-dialog").addEventListener("close", () => {
    if (!onboardingWaitingForAuto) return;
    onboardingWaitingForAuto = false;
    onboardingStep = 3;
    renderOnboarding();
  });
  document.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("change", async () => {
    await commit({ type: "set-setting", payload: { setting: input.dataset.setting, enabled: input.checked } }, input.dataset.setting === "hideSecondary" && input.checked ? "已隱藏影片右側欄，並關閉自動播放" : "設定已儲存");
  }));
  $("language-select").addEventListener("change", async (event) => {
    const language = Core.languageCode(event.target.value);
    await commit({ type: "set-language", payload: { language } }, language === "en" ? "Language changed to English" : "介面語言已切換為繁體中文");
  });
  $("save-youtube-api-key").addEventListener("click", async () => {
    const value = $("youtube-api-key").value.trim();
    if (value.length < 20) { toast("請輸入有效的 YouTube Data API Key"); return; }
    youtubeApiKey = value;
    const result = await api.saveSecret(value);
    if (!result?.ok) throw new Error(result?.error || "Could not save API key");
    $("youtube-api-key").value = "";
    renderApiStatus();
    toast("API Key 已儲存在本機，且不會匯出到備份");
  });
  $("clear-youtube-api-key").addEventListener("click", async () => {
    youtubeApiKey = "";
    const result = await api.saveSecret("");
    if (!result?.ok) throw new Error(result?.error || "Could not clear API key");
    $("youtube-api-key").value = "";
    renderApiStatus();
    toast("YouTube API Key 已清除");
  });
  $("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `chanlume-backup-${new Date().toISOString().slice(0, 10)}.json` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast("備份已匯出");
  });
  $("import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await commit({ type: "replace-state", payload: { state: JSON.parse(await file.text()) } }, "備份已匯入"); }
    catch (_error) { toast("這不是有效的 Chanlume 備份"); }
    event.target.value = "";
  });
  $("reset").addEventListener("click", async () => {
    if (!confirm(t("要清除 Chanlume 的本機群組與已收集頻道嗎？這不會取消 YouTube 訂閱。"))) return;
    selectedGroupId = "all";
    managingMembers = false;
    await commit({ type: "reset-state" }, "本機資料已清除");
    startOnboarding();
  });

  $("onboarding-next").addEventListener("click", advanceOnboarding);
  $("onboarding-back").addEventListener("click", () => {
    if (onboardingStep <= 0) return;
    onboardingWaitingForScan = false;
    onboardingStep -= 1;
    renderOnboarding();
  });
  $("onboarding-skip").addEventListener("click", () => finishOnboarding("已跳過新手教學，可直接開始使用", dashboardView));

  api.onChange((changes, area) => {
    if (area !== "local") return;
    if (changes[API_KEY_STORAGE]) {
      youtubeApiKey = String(changes[API_KEY_STORAGE].newValue || "");
      renderApiStatus();
    }
    if (changes[STORAGE_KEY]?.newValue) {
      if (acceptState(changes[STORAGE_KEY].newValue)) render();
      if (onboardingStep === 1 && onboardingWaitingForScan && Object.keys(state.channels).length) {
        onboardingWaitingForScan = false;
        onboardingStep = 2;
        renderOnboarding();
      } else if (onboardingStep >= 0 && !onboardingWaitingForAuto) {
        renderOnboarding();
      }
    }
    const scan = changes.chanlumeScanStatus?.newValue;
    if (!scan) return;
    if (["complete", "failed"].includes(scan.state)) {
      $("update-subscriptions").disabled = false;
      $("update-subscriptions").textContent = "更新訂閱內容";
    }
    if (scan.state === "complete") {
      api.load().then((latest) => {
        if (acceptState(latest)) render();
        if (onboardingStep === 1 && onboardingWaitingForScan) {
          onboardingWaitingForScan = false;
          onboardingStep = 2;
          renderOnboarding();
        }
      }).catch(() => {});
      toast(`訂閱書架已更新，共 ${Number(scan.count) || 0} 個頻道`);
    }
    if (scan.state === "failed") {
      onboardingWaitingForScan = false;
      if (onboardingStep === 1) renderOnboarding();
      toast("訂閱內容更新未完成，請再試一次");
    }
  });

  window.addEventListener("resize", scheduleWorkspaceLayout);

  (async function init() {
    const [savedState, savedApiKey] = await Promise.all([api.load(), api.loadSecret()]);
    acceptState(savedState, true);
    youtubeApiKey = savedApiKey;
    render();
    setDashboardView(initialDashboardView);
    if (!state.settings.onboardingComplete) setTimeout(startOnboarding, 180);
  })();
})();
