(function () {
  "use strict";
  globalThis.createChanlumeFavorites = ({ getState, commit, openGroup }) => {
    const Core = globalThis.ChanlumeCore;
    const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const t = (text) => Core.translateUiText(text, getState().settings.language);
    const active = () => getState().settings.enabled && location.pathname === "/feed/subscriptions" && new URLSearchParams(Core.canonicalHash(location.hash).slice(1)).get("chanlume-view") === "favorites";
    const cache = new Map();
    const attempted = new Set();
    const pending = new Set();
    const forced = new Set();
    let root = null;
    let epoch = 0;
    const saving = new Set();
    let shortsMode = getState().settings.hideShorts;
    let signature = "";

    function clear() {
      if (!root) return;
      epoch++;
      root.querySelector("dialog")?.close();
      root.parentElement?.classList.remove("chanlume-favorites-primary");
      root.remove();
      root = null;
      signature = "";
      attempted.clear();
      forced.clear();
    }

    function renderVideos() {
      if (!root) return;
      const state = getState();
      const area = root.querySelector(".cl-favorite-feed");
      if (!state.favoriteChannelIds.length) {
        area.innerHTML = `<div class="cl-favorite-empty"><span aria-hidden="true">☆</span><h2>${escape(t("尚未加入關注頻道"))}</h2><p>${escape(t("挑選你最想關注的頻道，集中查看最新影片。"))}</p><button class="cl-button cl-primary" data-favorite-action="manage">${escape(t("新增頻道"))}</button></div>`;
        return;
      }
      area.innerHTML = state.favoriteChannelIds.map((id) => {
        const channel = state.channels[id];
        const data = cache.get(id);
        const videos = (data?.videos || []).slice(0, 6).map((video) => `<a class="cl-favorite-video" href="https://www.youtube.com/watch?v=${escape(video.id)}"><img src="https://i.ytimg.com/vi/${escape(video.id)}/mqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><strong>${escape(video.title)}</strong><time datetime="${escape(video.published)}">${escape(video.published ? new Date(video.published).toLocaleDateString(state.settings.language) : video.publishedLabel || "")}</time></a>`).join("");
        const status = data?.error ? `<p role="status">${escape(t("影片讀取失敗，請重試。"))} ${escape(t(data.errorMessage || ""))} <button class="cl-button" data-favorite-retry="${escape(id)}">${escape(t("重試"))}</button></p>` : "";
        return `<section class="cl-favorite-channel"><header><div><a href="${escape(channel.url)}">${escape(channel.name)}</a><small>${escape(t(data?.fetchedAt ? "上次更新" : "尚未更新"))}${data?.fetchedAt ? ` · ${escape(new Date(data.fetchedAt).toLocaleString(state.settings.language))}` : ""}</small></div><button class="cl-button" data-favorite-remove="${escape(id)}" aria-label="${escape(t("移除關注") + " " + channel.name)}">${escape(t("移除關注"))}</button></header>${status}${pending.has(id) || !attempted.has(id) ? `<p role="status">${escape(t("讀取最新影片中…"))}</p>` : ""}<div class="cl-favorite-videos">${videos}</div>${data && !data.error && !pending.has(id) && !videos ? `<p>${escape(t("目前沒有公開影片"))}</p>` : ""}</section>`;
      }).join("");
      root.querySelector('[data-favorite-action="refresh"]').disabled = pending.size > 0;
    }

    function parseFeed(xml) {
      const document = new DOMParser().parseFromString(xml, "application/xml");
      if (document.querySelector("parsererror") || document.documentElement.localName !== "feed") throw new Error("Invalid video feed");
      const videos = [...document.getElementsByTagName("entry")].map((entry) => ({
        id: entry.getElementsByTagName("yt:videoId")[0]?.textContent?.trim() || "",
        title: entry.getElementsByTagName("title")[0]?.textContent?.trim() || "",
        published: entry.getElementsByTagName("published")[0]?.textContent?.trim() || ""
      })).filter((video) => /^[\w-]{11}$/.test(video.id) && video.title && Number.isFinite(Date.parse(video.published)));
      return [...new Map(videos.map((video) => [video.id, video])).values()].sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, 15);
    }

    async function load(id, force) {
      const generation = epoch;
      attempted.add(id);
      pending.add(id);
      renderVideos();
      try {
        const response = await chrome.runtime.sendMessage({ type: "CHANLUME_FAVORITE_FEED", channelId: id, force });
        if (!response?.ok) throw Object.assign(new Error(response?.error || "Feed unavailable"), { code: response?.code });
        if (generation !== epoch) return;
        if (Boolean(response.hideShorts) !== getState().settings.hideShorts) { attempted.delete(id); return; }
        const videos = response.hideShorts ? (response.videos || []).filter((video) => video.format === "video" && /^[\w-]{11}$/.test(video.id)) : parseFeed(response.xml);
        cache.set(id, { videos, hideShorts: Boolean(response.hideShorts), fetchedAt: response.fetchedAt });
      } catch (error) {
        const errorMessage = error.code === "NETWORK" ? "連線失敗或逾時，請稍後重試。" : error.code === "HTTP" ? "YouTube 暫時拒絕讀取，請稍後重試。" : error.code === "PARSE" ? "無法辨識頻道影片資料，請重試或更新 Chanlume。" : "";
        if (generation === epoch) cache.set(id, { ...cache.get(id), error: true, errorMessage });
      } finally {
        pending.delete(id);
        if (root) { renderVideos(); pump(false); }
      }
    }

    function pump(force) {
      if (!root || !active() || document.hidden) return;
      if (force) { attempted.clear(); getState().favoriteChannelIds.forEach((id) => forced.add(id)); }
      for (const id of getState().favoriteChannelIds) {
        if (pending.size >= 3) break;
        if (pending.has(id) || attempted.has(id)) continue;
        const refresh = forced.delete(id);
        load(id, refresh);
      }
    }

    function renderPicker() {
      const dialog = root?.querySelector("dialog");
      if (!dialog?.open) return;
      const state = getState();
      const list = dialog.querySelector(".cl-favorite-picker-list");
      const scroll = list.scrollTop;
      const focused = document.activeElement?.dataset.favoriteToggle;
      const query = dialog.querySelector("input[type=search]").value.trim().toLowerCase();
      const filter = dialog.querySelector("select");
      filter.setAttribute("aria-label", t("依群組篩選"));
      const selected = filter.value;
      filter.innerHTML = `<option value="">${escape(t("全部頻道"))}</option><option value="favorites">${escape(t("已關注"))}</option>${state.groups.map((group) => `<option value="group:${escape(group.id)}">${escape(group.name)}</option>`).join("")}`;
      filter.value = selected;
      const group = state.groups.find((group) => `group:${group.id}` === filter.value);
      const channels = Object.values(state.channels).filter((channel) => (!query || `${channel.name} ${channel.id}`.toLowerCase().includes(query)) && (!group || group.channelIds.includes(channel.id)) && (filter.value !== "favorites" || state.favoriteChannelIds.includes(channel.id))).sort((a, b) => a.name.localeCompare(b.name, state.settings.language));
      list.innerHTML = channels.length ? channels.map((channel) => {
        const selected = state.favoriteChannelIds.includes(channel.id);
        const avatar = channel.avatar ? `<img src="${escape(channel.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : escape(channel.name.slice(0, 1));
        return `<div class="cl-favorite-picker-row"><span class="cl-favorite-avatar">${avatar}</span><span class="cl-favorite-picker-copy"><strong>${escape(channel.name)}</strong><small>${escape(channel.id)}</small></span><button class="cl-button" data-favorite-toggle="${escape(channel.id)}" aria-pressed="${selected}" aria-label="${escape(t(selected ? "取消關注" : "關注頻道") + " " + channel.name)}" ${saving.has(channel.id) ? "disabled" : ""}>${escape(t(selected ? "已關注" : "＋ 關注"))}</button></div>`;
      }).join("") : `<p>${escape(t(Object.keys(state.channels).length ? "找不到符合的頻道" : "先更新訂閱內容，再回來挑選頻道。"))}</p>`;
      list.scrollTop = scroll;
      if (focused) [...list.querySelectorAll("[data-favorite-toggle]")].find((button) => button.dataset.favoriteToggle === focused)?.focus({ preventScroll: true });
    }

    async function onClick(event) {
      const action = event.target.closest("[data-favorite-action]")?.dataset.favoriteAction;
      const retry = event.target.closest("[data-favorite-retry]")?.dataset.favoriteRetry;
      const remove = event.target.closest("[data-favorite-remove]")?.dataset.favoriteRemove;
      const toggle = event.target.closest("[data-favorite-toggle]")?.dataset.favoriteToggle;
      const dialog = root?.querySelector("dialog");
      if (action === "back") { openGroup("all"); return; }
      if (action === "manage") { dialog.querySelector("input[type=search]").value = ""; dialog.showModal(); renderPicker(); return; }
      if (action === "close") { dialog.close(); return; }
      if (action === "refresh" && !pending.size) { pump(true); return; }
      if (retry && !pending.has(retry) && pending.size < 3) { load(retry, true); return; }
      const id = remove || toggle;
      if (!id || saving.has(id)) return;
      const enabled = !remove && !getState().favoriteChannelIds.includes(id);
      saving.add(id);
      renderPicker();
      try {
        await commit({ type: "edit-favorites", payload: { changes: [{ channelId: id, enabled }] } });
        if (root) { root.querySelector(".cl-favorite-picker-error").textContent = ""; root.querySelector(".cl-favorite-message").textContent = ""; }
      } catch (_) {
        const message = t("儲存失敗，請重試。");
        if (dialog?.open) dialog.querySelector(".cl-favorite-picker-error").textContent = message;
        else if (root) root.querySelector(".cl-favorite-message").textContent = message;
      } finally { saving.delete(id); renderPicker(); }
    }

    function render() {
      const primary = document.querySelector('ytd-browse[page-subtype="subscriptions"]:not([hidden]) #primary');
      if (!active() || !primary) { clear(); return; }
      if (shortsMode !== getState().settings.hideShorts) {
        shortsMode = getState().settings.hideShorts;
        epoch++;
        cache.clear();
        attempted.clear();
        signature = "";
      }
      if (root && root.parentElement !== primary) clear();
      if (!root) {
        root = document.createElement("section");
        root.id = "chanlume-favorites-page";
        root.innerHTML = `<header class="cl-favorite-heading"><div><span class="cl-favorite-kicker">CHANLUME</span><h1>${escape(t("最關注頻道"))}</h1><p>${escape(t("挑選你最想關注的頻道，集中查看最新影片。"))}</p></div><div class="cl-favorite-actions"><button class="cl-button" data-favorite-action="back">${escape(t("全部訂閱"))}</button><button class="cl-button" data-favorite-action="refresh">${escape(t("更新影片"))}</button><button class="cl-button cl-primary" data-favorite-action="manage">${escape(t("新增頻道"))}</button></div></header><p class="cl-favorite-message" role="status"></p><div class="cl-favorite-feed"></div><dialog aria-labelledby="cl-favorite-picker-title"><h2 id="cl-favorite-picker-title">${escape(t("管理關注頻道"))}</h2><p>${escape(t("搜尋或選擇群組，按一下即可加入或取消關注。"))}</p><input type="search" placeholder="${escape(t("搜尋全部頻道"))}" aria-label="${escape(t("搜尋全部頻道"))}"><select aria-label="${escape(t("依群組篩選"))}"><option value="">${escape(t("全部頻道"))}</option></select><div class="cl-favorite-picker-list"></div><p class="cl-favorite-picker-error" role="status"></p><footer><button class="cl-button cl-primary" data-favorite-action="close">${escape(t("完成"))}</button></footer></dialog>`;
        root.addEventListener("click", onClick);
        root.querySelector("input[type=search]").addEventListener("input", renderPicker);
        root.querySelector("select").addEventListener("change", renderPicker);
        primary.prepend(root);
      }
      primary.classList.add("chanlume-favorites-primary");
      const nextSignature = `${getState().revision}:${getState().settings.language}`;
      if (signature !== nextSignature) {
        signature = nextSignature;
        root.querySelectorAll(".cl-favorite-heading, dialog > h2, dialog > p, dialog > input, dialog > footer").forEach((node) => Core.localizeDom(node, getState().settings.language));
        for (const id of cache.keys()) if (!getState().favoriteChannelIds.includes(id)) { cache.delete(id); attempted.delete(id); }
        renderVideos();
        renderPicker();
      }
      pump(false);
    }
    return { active, render, clear, parseFeed };
  };
})();
