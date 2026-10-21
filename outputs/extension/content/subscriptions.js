(function () {
  "use strict";

  globalThis.chanlumeDesignIcon = (name) => {
    const path = `content/design-icons/${name}.svg`;
    const url = globalThis.chrome?.runtime?.getURL ? chrome.runtime.getURL(path) : `/extension/${path}`;
    return `<img class="cl-design-icon" src="${url}" width="24" height="24" alt="" aria-hidden="true">`;
  };
  globalThis.createChanlumeSubscriptions = ({ Core, getState, getActiveGroup, getCards, findChannel, isWatched, openGroup, commit, escape: esc }) => {
    let root = null, signature = "", bodySignature = "";
    const nativeSourceDisplays = new WeakMap();
    let navResizeObserver = null, navResizeHandler = null, categoryScrollHandler = null;
    const wiredCategoryRails = new WeakSet();
    let view = "feed", layout = "grid", query = "", collectionQuery = "", categoriesExpanded = true;
    const seenChannels = new Set();
    let collapsed = new Set(), collectionCollapsed = new Set(), channelQuery = "", sort = "source", editor = null, saving = false;
    const closeViewOnOutside = event => {
      const picker = root?.querySelector(".cl-view-picker[open]");
      if (picker && !picker.contains(event.target)) picker.open = false;
    };
    const t = (text) => Core.translateUiText(text, getState().settings.language);
    const params = () => new URLSearchParams(Core.canonicalHash(location.hash).slice(1));
    const active = () => getState().settings.enabled && location.pathname === "/feed/subscriptions" && params().get("chanlume-view") !== "favorites";
    const collections = () => params().get("chanlume-view") === "collections";
    const collectionFeed = () => params().get("chanlume-view") === "collection" && getState().groups.some(group=>group.id===getActiveGroup());
    const safeUrl = (value, image = false) => {
      try {
        const url = new URL(value, "https://www.youtube.com");
        if (url.protocol !== "https:") return "";
        if (image) return /(^|\.)(ytimg\.com|ggpht\.com|googleusercontent\.com)$/.test(url.hostname) ? url.href : "";
        return url.hostname === "www.youtube.com" ? url.href : "";
      } catch (_) { return ""; }
    };
    const button = (action, label, extra = "") => `<button type="button" class="cl-button" data-shelf-action="${action}" ${extra}>${action === "new" ? globalThis.chanlumeDesignIcon("add") : ""}${esc(t(label))}</button>`;
    const avatar = (channel) => {
      const url = safeUrl(channel.avatar, true);
      return `<span class="cl-shelf-avatar">${url ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc(channel.name?.slice(0, 1) || "?")}</span>`;
    };

    const scopeIdsForUnfiled = state => {const assigned=new Set(state.groups.flatMap(g=>g.channelIds));return Object.keys(state.channels).filter(id=>!assigned.has(id));};
    function scopeIds() {
      const state=getState(), group=state.groups.find(g=>g.id===getActiveGroup());
      if(group)return group.channelIds.filter(id=>state.channels[id]);
      if(getActiveGroup()==="unfiled")return scopeIdsForUnfiled(state);
      return Object.keys(state.channels);
    }
    function prepareChannels() {
      if (view !== "channels") return;
      for (const id of scopeIds()) if (!seenChannels.has(id)) {
        if (seenChannels.size) collapsed.add(id);
        seenChannels.add(id);
      }
    }

    // Native cards can arrive *after* Chanlume's first render. In particular,
    // don't switch the YouTube grid to a custom/hidden layout before YouTube
    // has mounted its first contents or continuation. That can deadlock the
    // initial native feed on a direct Timeline/Channels reload.
    function nativeFeedReady(primary) {
      for (const child of primary.children) {
        if (child === root || child.id === "chanlume-shelf-slot" || child.id === "chanlume-toolbar") continue;
        if (child.querySelector('ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-continuation-item-renderer')) return true;
        if (child.matches('ytd-rich-grid-renderer, ytd-section-list-renderer') && child.querySelector('#contents')?.children.length) return true;
      }
      return false;
    }

    // YouTube owns paging. A real page can override the grid's CSS display rule,
    // which collapses its continuation sentinel. Preserve and restore inline state.
    function restoreNativeSourceDisplay(node) {
      const original = nativeSourceDisplays.get(node);
      if (!original) return;
      if (original.value) node.style.setProperty("display", original.value, original.priority);
      else node.style.removeProperty("display");
      nativeSourceDisplays.delete(node);
    }
    function keepNativePaging(primary, custom) {
      const enabled = custom && !collections();
      primary.classList.toggle("chanlume-shelf-native", enabled);
      for (const child of primary.children) {
        if (child === root || child.id === "chanlume-shelf-slot") continue;
        // An initial YouTube rich grid may be empty until it receives its first
        // response. Keep that grid visible now: hiding it can prevent YouTube
        // from ever mounting its cards/continuation in a restored custom view.
        const source = enabled && (child.matches('ytd-rich-grid-renderer, ytd-section-list-renderer') || Boolean(child.querySelector('ytd-continuation-item-renderer, ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model')));
        if (source) {
          if (!nativeSourceDisplays.has(child)) nativeSourceDisplays.set(child, { value: child.style.getPropertyValue("display"), priority: child.style.getPropertyPriority("display") });
          child.style.setProperty("display", "block", "important");
        } else restoreNativeSourceDisplay(child);
        child.classList.toggle("cl-native-feed-source", source);
      }
    }

    function clear() {
      document.removeEventListener("pointerdown", closeViewOnOutside);
      navResizeObserver?.disconnect(); navResizeObserver = null;
      if (navResizeHandler) window.removeEventListener("resize", navResizeHandler);
      navResizeHandler = null;
      if (categoryScrollHandler) window.removeEventListener("scroll", categoryScrollHandler);
      categoryScrollHandler = null;
      document.querySelector('body > .cl-category-rail[data-pinned="true"]')?.remove();
      if (root) { root.querySelector("dialog")?.close(); root.parentElement?.classList.remove("chanlume-shelf-custom", "chanlume-shelf-native", "chanlume-shelf-awaiting-native"); root.parentElement?.querySelectorAll(":scope > .cl-native-feed-source").forEach(node => { restoreNativeSourceDisplay(node); node.classList.remove("cl-native-feed-source"); }); root.remove(); }
      document.getElementById("chanlume-shelf-sticky")?.remove();
      document.getElementById("chanlume-shelf-slot")?.remove();
      root = null; signature = bodySignature = ""; editor = null; saving = false;
      document.documentElement.classList.remove("chanlume-shelf-feed");
      document.querySelectorAll(".cl-shelf-search-hidden").forEach((card) => card.classList.remove("cl-shelf-search-hidden"));
      document.querySelectorAll(".chanlume-relevant-hidden").forEach((shelf) => shelf.classList.remove("chanlume-relevant-hidden"));
    }

    function restoreCategoryRail() {
      const rail = document.querySelector('body > .cl-category-rail[data-pinned="true"]');
      const slot = root?.querySelector("#chanlume-category-slot");
      if (!rail) return;
      if (!slot) { rail.remove(); return; }
      slot.appendChild(rail);
      delete rail.dataset.pinned;
      rail.style.removeProperty("top");
      rail.style.removeProperty("left");
      rail.style.removeProperty("width");
    }

    function syncCategoryRail() {
      const slot = root?.querySelector("#chanlume-category-slot");
      const nav = document.getElementById("chanlume-shelf-sticky");
      const rail = slot?.querySelector(".cl-category-rail") || document.querySelector('body > .cl-category-rail[data-pinned="true"]');
      if (!slot || !nav || !rail || nav.hidden || !active()) { restoreCategoryRail(); return; }
      const bounds = slot.getBoundingClientRect(), navBottom = nav.getBoundingClientRect().bottom;
      if (bounds.top <= navBottom) {
        if (rail.parentElement !== document.body) {
          document.body.appendChild(rail);
          rail.dataset.pinned = "true";
        }
        rail.style.top = `${navBottom}px`;
        rail.style.left = `${bounds.left}px`;
        rail.style.width = `${bounds.width}px`;
      } else restoreCategoryRail();
    }

    function route(changes, replace = false) {
      const url = new URL(location.href), next = new URLSearchParams(url.hash.slice(1));
      for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
      url.hash = next.toString();
      if (location.pathname !== "/feed/subscriptions") { location.assign(`https://www.youtube.com/feed/subscriptions${url.hash}`); return; }
      if (url.href !== location.href) history[replace ? "replaceState" : "pushState"](history.state, "", url);
      window.dispatchEvent(new Event("hashchange"));
      render();
    }
    function navigateCollections() { route({"chanlume-view":"collections"}); }
    function navigateNewGroup() {
      if (location.pathname !== "/feed/subscriptions") {
        // The sidebar is also present on channel and Watch pages. Carry only
        // an ephemeral UI intent in the route, never in the saved library.
        location.assign("https://www.youtube.com/feed/subscriptions#chanlume-view=collections&chanlume-create-group=1");
        return;
      }
      navigateCollections();
      openEditor(null, "group");
    }
    function navigateChannels() { route({"chanlume-view":"channels", "chanlume-group":"all"}); }
    function readRoute() {
      const p = params(), requested = p.get("chanlume-view");
      view = ["channels", "timeline"].includes(requested) ? requested : "feed";
      layout = p.get("layout") === "list" || (view === "channels" && p.get("layout") !== "grid") ? "list" : "grid";
      // Video order is automatic. The only remaining manual sort is the
      // channel/group directory name order.
      sort = p.get("sort") === "name" && (view === "channels" || collections()) ? "name" : "source";
      query = p.get("q") || ""; channelQuery = p.get("channel-q") || "";
      // Remove retired date/sort parameters from previously saved page links.
      const url = new URL(location.href), clean = new URLSearchParams(url.hash.slice(1));
      const before = clean.toString();
      clean.delete("from"); clean.delete("to");
      if (sort !== "name") clean.delete("sort");
      if (clean.toString() !== before) {
        url.hash = clean.toString();
        history.replaceState(history.state, "", url);
      }
      if (collectionFeed()) {
        view="feed"; layout="grid"; query=""; channelQuery=""; sort="source";
      }
    }
    const exactDate = (card) => {
      const raw = card.querySelector('time[datetime], meta[itemprop="datePublished"]')?.getAttribute('datetime') || card.querySelector('meta[itemprop="datePublished"]')?.getAttribute('content') || "";
      if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw)) return "";
      const d = new Date(raw); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== raw.slice(0,10)) return "";
      return raw.slice(0,10);
    };

    // Native cards often have a relative label instead of a calendar date.
    // It is suitable for approximate ordering, not for inventing an exact date.
    function nativeRelativeAge(card) {
      const metadata = card.querySelector('yt-content-metadata-view-model, #metadata-line');
      if (!metadata) return null;
      const lastPart = metadata.querySelector('.ytContentMetadataViewModelMetadataTextLastPart');
      const rows = metadata.querySelectorAll('.ytContentMetadataViewModelMetadataRow');
      const candidates = [lastPart?.getAttribute('aria-label'), lastPart?.textContent, rows[rows.length - 1]?.textContent, metadata.getAttribute('aria-label')].filter(Boolean);
      for (const value of candidates) {
        const label = value.trim();
        if (/正在觀看|正在收看|watching now/i.test(label)) return { label: t("直播中"), seconds: -1 };
        const match = label.match(/(\d+(?:[.,]\d+)?)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|秒鐘?|分鐘?|小時|小时|天|日|週|周|個月|个月|月|年)\s*(ago|前)\s*$/i);
        if (!match) continue;
        const amount = Number(match[1].replace(',', '.'));
        const unit = match[2].toLowerCase();
        const seconds = /^(?:seconds?|秒)/.test(unit) ? 1
          : /^(?:minutes?|分)/.test(unit) ? 60
          : /^(?:hours?|小時|小时)/.test(unit) ? 3600
          : /^(?:days?|天|日)/.test(unit) ? 86400
          : /^(?:weeks?|週|周)/.test(unit) ? 604800
          : /^(?:months?|個月|个月|月)/.test(unit) ? 2592000
          : 31536000;
        if (Number.isFinite(amount) && amount >= 0) return { label: match[0].trim(), seconds: amount * seconds };
      }
      return null;
    }

    function snapshot() {
      const state = getState(), groupId = getActiveGroup();
      const group = state.groups.find((item) => item.id === groupId);
      const grouped = new Set(state.groups.flatMap((item) => item.channelIds));
      const videos = [], seen = new Set();
      const nowDaySeconds = Math.floor(Date.now() / 86400000) * 86400;
      const primary = root?.parentElement;
      const nativeSections = new Map();
      let sectionLabel = t("近期影片");
      for (const child of primary?.querySelectorAll('ytd-rich-grid-renderer > #contents > ytd-rich-section-renderer, ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer') || []) {
        if (child.matches("ytd-rich-section-renderer")) {
          const label = child.querySelector('ytd-shelf-renderer #title')?.textContent.trim();
          if (label && label.length <= 60) sectionLabel = label;
        } else nativeSections.set(child, sectionLabel);
      }
      for (const card of getCards()) {
        if (!primary?.contains(card) || card.closest("#chanlume-subscriptions-page, #chanlume-favorites-page")) continue;
        if (card.closest(".chanlume-relevant-hidden")) continue;
        if (card.matches('ytd-channel-renderer') || card.classList.contains("chanlume-shorts-hidden")) continue;
        if (state.settings.hideWatched && isWatched(card)) continue;
        const channel = findChannel(card);
        const recordId = channel ? Core.resolveChannelRecordId(state, channel.id) : "";
        const id = recordId || channel?.id || "";
        if (group && !group.channelIds.includes(id)) continue;
        if (groupId === "unfiled" && (!state.channels[id] || grouped.has(id))) continue;
        const link = card.querySelector('a#video-title, a#video-title-link') || card.querySelector('h3 a[href*="/watch?"], a.ytLockupMetadataViewModelTitle') || card.querySelector('a[href*="/watch?"], a[href^="/shorts/"]');
        const url = safeUrl(link?.getAttribute("href") || "");
        const videoId = url ? new URL(url).searchParams.get("v") : "";
        const videoKey = /^[\w-]{11}$/.test(videoId || "") ? `video:${videoId}` : url;
        if (!link || !url || seen.has(videoKey) || (state.settings.hideShorts && new URL(url).pathname === "/shorts")) continue;
        if (state.settings.hideShorts && new URL(url).pathname.startsWith("/shorts/")) continue;
        const title = link.getAttribute("title") || link.textContent.trim() || card.querySelector("h3")?.textContent.trim();
        if (!title) continue;
        const name = state.channels[id]?.name || channel?.name || t("其他頻道");
        const imageNode=card.querySelector("img");
        const image = safeUrl(imageNode?.currentSrc || imageNode?.getAttribute("src") || imageNode?.getAttribute("data-src") || "", true) || (/^[\w-]{11}$/.test(videoId||"") ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "");
        const metadataNode = card.querySelector("#metadata-line, yt-content-metadata-view-model");
        const metadataRows = metadataNode?.querySelectorAll(":scope > .ytContentMetadataViewModelMetadataRow");
        let metadata = (metadataRows?.length ? metadataRows[metadataRows.length - 1] : metadataNode)?.textContent.trim() || "";
        if (metadata.startsWith(name)) metadata=metadata.slice(name.length).trim().replace(/^[·•\s]+/, "");
        if (view !== "channels" && query && !`${title} ${name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
        const date = exactDate(card), relative = nativeRelativeAge(card);
        const ageSeconds = date ? Math.max(0, nowDaySeconds - Date.parse(`${date}T00:00:00Z`) / 1000) : relative?.seconds ?? null;
        seen.add(videoKey); videos.push({ url, title, id, name, image, metadata, date, relativeLabel: relative?.label || "", ageSeconds, section: nativeSections.get(card) || t("近期影片") });
      }
      return videos;
    }

    function channelHandle(channel) {
      try {
        const path = new URL(channel.url).pathname;
        return path.startsWith("/@") ? decodeURIComponent(path.slice(1)) : t("訂閱頻道");
      } catch (_) { return t("訂閱頻道"); }
    }

    function videoCard(video) {
      const channel = getState().channels[video.id] || {name:video.name};
      return `<a class="cl-shelf-video" href="${esc(video.url)}"><span class="cl-shelf-thumb">${video.image ? `<img src="${esc(video.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : Core.iconSvg("video", "currentColor", 28)}${video.duration?`<span class="cl-video-duration">${esc(video.duration)}</span>`:""}</span><span class="cl-shelf-video-info">${avatar(channel)}<span class="cl-shelf-video-copy"><strong title="${esc(video.title)}">${esc(video.title)}</strong><small>${esc(video.name)}</small><small title="${esc(video.published || video.metadata)}">${esc(video.metadata)}</small></span></span></a>`;
    }

    function channelBody(videos) {
      const state = getState(), groupId = getActiveGroup(), group = state.groups.find(g => g.id === groupId);
      const grouped = new Set(state.groups.flatMap(g => g.channelIds)), allowed = group ? new Set(group.channelIds) : null, byChannel = new Map();
      for (const video of videos) { if (!byChannel.has(video.id)) byChannel.set(video.id, []); byChannel.get(video.id).push(video); }
      let channels = Object.values(state.channels).filter(c => (!allowed || allowed.has(c.id)) && (groupId !== "unfiled" || !grouped.has(c.id)) && `${c.name} ${c.url}`.toLocaleLowerCase().includes(channelQuery.toLocaleLowerCase()));
      if (sort === "name") channels.sort((a,b) => a.name.localeCompare(b.name, state.settings.language));
      if (!channels.length) return `<div class="cl-shelf-empty"><h2>${esc(t(channelQuery ? "找不到符合的頻道" : "此範圍尚無頻道"))}</h2><p>${esc(t("可更新訂閱名冊，或調整搜尋及群組範圍。"))}</p></div>`;
      for (const channel of channels) { if (!seenChannels.has(channel.id)) { if (seenChannels.size) collapsed.add(channel.id); seenChannels.add(channel.id); } }
      return `<p class="cl-shelf-result" role="status">${channels.length} ${esc(t("個頻道"))}</p><div class="cl-channel-directory ${layout === "grid" ? "cl-directory-grid" : "cl-directory-list"}">${channels.map(channel => {
        const items = byChannel.get(channel.id) || [], expanded = !collapsed.has(channel.id), href = safeUrl(channel.url);
        return `<section class="cl-shelf-channel" data-channel-id="${esc(channel.id)}"><header><a class="cl-channel-identity" href="${esc(href)}">${avatar(channel)}<span><h2 translate="no" title="${esc(channel.name)}">${esc(channel.name)}</h2><small title="${esc(channelHandle(channel))}">${esc(channelHandle(channel))}</small></span></a><span class="cl-channel-subscribed">${esc(t("已訂閱"))}</span>${button("collapse", expanded ? "收合" : "展開", `data-id="${esc(channel.id)}" aria-expanded="${expanded}" aria-controls="cl-channel-${encodeURIComponent(channel.id)}"`)}</header><div class="cl-channel-content" id="cl-channel-${encodeURIComponent(channel.id)}" ${expanded ? "" : "hidden"}>${items.length ? `<div class="cl-shelf-videos">${items.map(videoCard).join("")}</div>` : `<p class="cl-channel-unloaded">${esc(t("此頻道尚未出現在已載入的訂閱動態中，往下捲動可繼續尋找較舊的影片。"))}</p>`}</div></section>`;
      }).join("")}</div>`;
    }
    function collectionBody() {
      const state = getState();
      let groups = state.groups.filter(g => `${g.name} ${g.channelIds.map(id => state.channels[id]?.name || "").join(" ")}`.toLocaleLowerCase().includes(collectionQuery.toLocaleLowerCase()));
      if (sort === "name") groups.sort((a,b)=>a.name.localeCompare(b.name,state.settings.language));
      if (!groups.length) return `<div class="cl-shelf-empty"><h2>${esc(t(state.groups.length ? "找不到符合的群組" : "建立你的第一個群組"))}</h2>${button("new", "新增群組")}</div>`;
      return groups.map(group => {
        const members = group.channelIds.map(id => state.channels[id]).filter(Boolean), expanded = !collectionCollapsed.has(group.id);
        return `<section class="cl-collection" data-dom-key="collection-${esc(group.id)}"><header><div class="cl-collection-title"><h2 translate="no">${esc(group.name)}</h2>${`<button class="cl-button cl-rename-icon" type="button" data-shelf-action="rename" data-id="${esc(group.id)}" aria-label="${esc(t("編輯群組"))}" title="${esc(t("編輯群組"))}">${globalThis.chanlumeDesignIcon("edit")}</button>`}<span>${members.length} ${esc(t("個頻道"))}</span></div><div class="cl-collection-actions">${button("members", "新增頻道", `data-id="${esc(group.id)}"`)}${button("open", "瀏覽群組", `data-id="${esc(group.id)}"`)}${button("collapse-collection", expanded ? "收合" : "展開", `data-id="${esc(group.id)}" aria-expanded="${expanded}"`)}</div></header><div class="cl-collection-members ${layout === "list" ? "cl-members-list" : ""}" ${expanded ? "" : "hidden"}>${members.map(channel => `<a class="cl-collection-member" href="${esc(safeUrl(channel.url))}" translate="no">${avatar(channel)}<strong title="${esc(channel.name)}">${esc(channel.name)}</strong><small>${esc(channelHandle(channel))}</small><span class="cl-membership-status">${esc(t("已訂閱"))}</span></a>`).join("")}${!members.length ? `<p>${esc(t("尚未加入頻道，選擇管理成員開始整理。"))}</p>` : ""}</div></section>`;
      }).join("");
    }
    function update() {
      if (!root || !active()) return;
      for (const shelf of root.parentElement.querySelectorAll("ytd-rich-shelf-renderer")) {
        const title = shelf.querySelector("#title")?.textContent.trim() || "";
        (shelf.closest("ytd-rich-section-renderer") || shelf).classList.toggle("chanlume-relevant-hidden", /^(最相關|最相关|Most relevant)$/i.test(title));
      }
      prepareChannels();
      const custom = collections() || collectionFeed() || view !== "feed" || layout === "list";
      const nativeReady = !custom || collections() || nativeFeedReady(root.parentElement);
      const showCustom = custom && nativeReady;
      root.parentElement.classList.toggle("chanlume-shelf-custom", showCustom);
      root.parentElement.classList.toggle("chanlume-shelf-awaiting-native", custom && !nativeReady);
      keepNativePaging(root.parentElement, showCustom);
      document.documentElement.classList.toggle("chanlume-shelf-feed", !showCustom);
      if (!custom) for (const card of getCards()) {
        if (!root.parentElement.contains(card) || card.closest("#chanlume-subscriptions-page")) continue;
        card.classList.toggle("cl-shelf-search-hidden", Boolean(query) && !card.textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      }
      const source = custom && !collections() ? snapshot() : [];
      const videos = source;
      if (view === "timeline") {
        // Relative ages are approximate; keep native order for ties and leave
        // unknown ages last in both directions.
        videos.sort((a, b) => {
          if (a.ageSeconds == null) return b.ageSeconds == null ? 0 : 1;
          if (b.ageSeconds == null) return -1;
          return a.ageSeconds - b.ageSeconds;
        });
      }
      const next = JSON.stringify([collections(), nativeReady, getState().revision, getState().settings.language, getActiveGroup(), source, query, channelQuery, collectionQuery, [...collapsed], [...collectionCollapsed], layout, view, sort]);
      if (next === bodySignature) return; bodySignature = next;
      const area = root.querySelector(".cl-shelf-body");
      const patchBody = markup => globalThis.ChanlumeDom.patch(area, markup);
      area.setAttribute("aria-busy", String(!nativeReady));
      if (collections()) patchBody(collectionBody());
      else if (view === "channels") patchBody(channelBody(videos));
      else if (getActiveGroup() !== "all" && !scopeIds().length) {
        const group=getState().groups.find(g=>g.id===getActiveGroup());
        patchBody(`<div class="cl-shelf-empty"><h2>${esc(t("此範圍尚無頻道"))}</h2>${group?button("members","管理成員",`data-id="${esc(group.id)}"`):""}</div>`);
      } else if (custom && !nativeReady && view !== "channels") {
        patchBody(`<div class="cl-shelf-empty" role="status"><h2>${esc(t("正在載入 YouTube 訂閱影片…"))}</h2></div>`);
      } else if (custom) {
        
        if (view === "timeline") {
          const days = new Map(); for (const video of videos) { const day = video.date || video.relativeLabel || video.section; if (!days.has(day)) days.set(day, []); days.get(day).push(video); }
          patchBody([...days].map(([day,items]) => `<section class="cl-timeline-day" data-dom-key="day-${esc(day)}"><h2>${esc(day)}</h2><div class="cl-shelf-videos ${layout === "list" ? "cl-list" : ""}">${items.map(videoCard).join("")}</div></section>`).join(""));
        } else patchBody(`<div class="cl-shelf-videos ${layout === "list" ? "cl-list" : ""}">${videos.map(videoCard).join("")}</div>`);
        if (!videos.length) area.insertAdjacentHTML("beforeend", `<div class="cl-shelf-empty"><h2>${esc(t("目前載入的影片中沒有符合的內容"))}</h2><p>${esc(t("往下捲動，YouTube 會繼續載入更舊的訂閱影片。"))}</p></div>`);
      } else area.replaceChildren();
    }

    function render() {
      readRoute();
      const primary = document.querySelector('ytd-browse[page-subtype="subscriptions"]:not([hidden]) #primary');
      if (!active() || !primary) { clear(); return; }
      if (root && root.parentElement !== primary) clear();
      if (!root) {
        root = document.createElement("section"); root.id = "chanlume-subscriptions-page";
        root.innerHTML = '<div class="cl-shelf-header"></div><div class="cl-shelf-body"></div><dialog class="cl-collection-editor" aria-labelledby="cl-collection-editor-title"></dialog>';
        root.addEventListener("click", onClick);
        root.addEventListener("keydown", event => {
          if (event.key === "Escape") {
            const picker = root.querySelector(".cl-view-picker[open]");
            if (picker) { picker.open = false; picker.querySelector("summary")?.focus(); event.preventDefault(); }
          }
        });
        root.addEventListener("input", onInput);
        root.addEventListener("change", onChange);
        root.addEventListener("submit", saveEditor);
        root.querySelector("dialog").addEventListener("cancel", (event) => { if (saving) event.preventDefault(); else editor = null; });
        primary.prepend(root);
        document.addEventListener("pointerdown", closeViewOnOutside);
        categoryScrollHandler = () => syncCategoryRail();
        window.addEventListener("scroll", categoryScrollHandler, { passive: true });
      }
      let tabsHost = document.getElementById("chanlume-shelf-sticky");
      if (!tabsHost) {
        const navSlot = document.createElement("div");
        navSlot.id = "chanlume-shelf-slot";
        navSlot.setAttribute("aria-hidden", "true");
        primary.insertBefore(navSlot, root);
        tabsHost = document.createElement("nav");
        tabsHost.id = "chanlume-shelf-sticky";
        tabsHost.className = "cl-shelf-nav";
        tabsHost.addEventListener("click", onClick);
        document.body.appendChild(tabsHost);
        navResizeHandler = () => {
          const bounds = navSlot.getBoundingClientRect();
          tabsHost.style.left = `${bounds.left}px`;
          tabsHost.style.width = `${bounds.width}px`;
          syncCategoryRail();
        };
        window.addEventListener("resize", navResizeHandler);
        if (typeof ResizeObserver !== "undefined") {
          navResizeObserver = new ResizeObserver(navResizeHandler);
          navResizeObserver.observe(navSlot);
        }
      }
      prepareChannels();
      const state = getState(), group = state.groups.find((item) => item.id === getActiveGroup());
      const feedMenuMarkup = "";
      root.dataset.page = collectionFeed() ? "collection-feed" : collections() ? "collections" : view === "channels" ? "channels" : "subscriptions";
      const next = JSON.stringify([state.revision, state.settings.language, getActiveGroup(), collections(), collectionFeed(), categoriesExpanded, view, layout, sort, query, channelQuery, collectionQuery]);
      if (next !== signature) {
        signature = next;
        restoreCategoryRail();
        const header = root.querySelector(".cl-shelf-header");
        const icon = globalThis.chanlumeDesignIcon;
        const option = (value, text, selected) => `<option value="${esc(value)}" ${selected === value ? "selected" : ""}>${esc(t(text))}</option>`;
        const layoutControl = `<div class="cl-layout-switch" data-dom-key="layout" role="group" aria-label="${esc(t("版面配置"))}">${["grid","list"].map(mode=>`<button class="cl-button" data-shelf-action="${mode}" type="button" aria-label="${esc(t(mode==="grid"?"網格":"清單"))}" aria-pressed="${layout===mode}">${icon(mode)}</button>`).join("")}</div>`;
        const searchLabel = collections() ? "搜尋群組與成員" : view === "channels" ? "搜尋訂閱頻道" : "搜尋已載入的影片";
        const search = `<label class="cl-shelf-search" data-dom-key="search">${icon("search")}<input type="search" data-shelf-input="${collections()?"collections":view==="channels"?"channels":"videos"}" value="${esc(collections()?collectionQuery:view==="channels"?channelQuery:query)}" placeholder="${esc(t(searchLabel))}" aria-label="${esc(t(searchLabel))}"></label>`;
        const sortSelect = `<label class="cl-control-select" data-dom-key="sort"><span>${esc(t("排序"))}</span><select data-shelf-input="sort" aria-label="${esc(t("排序"))}">${collections()?option("source","自訂順序",sort)+option("name","群組名稱",sort):option("source","名冊順序",sort)+option("name","頻道名稱",sort)}</select></label>`;
        const tools = `<div class="cl-feed-tools-slot" data-dom-key="feed-tools">${feedMenuMarkup}</div>`;
        if (collectionFeed()) {
          tabsHost.hidden = true;
          document.getElementById("chanlume-shelf-slot").hidden = true;
          globalThis.ChanlumeDom.patch(tabsHost, "");
          globalThis.ChanlumeDom.patch(header, `<div class="cl-collection-context" data-dom-key="collection-context"><h1><span>${esc(t("群組內容"))}：</span><span translate="no">${esc(group.name)}</span></h1>${button("members","管理此群組",`data-id="${esc(group.id)}"`)}</div>`);
        } else {
          const tabs = `<div class="cl-shelf-tabs" data-dom-key="shelf-tabs" role="group" aria-label="${esc(t("訂閱頁面"))}">${button("subscriptions","訂閱內容",`aria-pressed="${!collections()}"`)}<button class="cl-shelf-count" data-shelf-action="directory" title="${esc(t("所有訂閱頻道"))}" aria-label="${esc(t("所有訂閱頻道"))}">${Object.keys(state.channels).length}</button><span class="cl-tab-divider"></span>${button("collections","群組收藏",`aria-pressed="${collections()}"`)}<span>${state.groups.length}</span></div>`;
          tabsHost.hidden = false;
          document.getElementById("chanlume-shelf-slot").hidden = false;
          globalThis.ChanlumeDom.patch(tabsHost, tabs);
          const categories = [{id:"all",name:t("全部訂閱"),color:"#f50057",count:Object.keys(state.channels).length},{id:"unfiled",name:t("未分類"),color:"#8b8b8b",count:scopeIdsForUnfiled(state).length},...state.groups.map(g=>({id:g.id,name:g.name,color:g.color,count:g.channelIds.length}))];
          const categoryRail = collections()?"":`<div class="cl-category-rail" data-dom-key="category-rail" role="group" aria-label="${esc(t("訂閱分類"))}"><button class="cl-category-toggle" data-shelf-action="toggle-categories" aria-expanded="${categoriesExpanded}" aria-controls="cl-category-items" title="${esc(t(categoriesExpanded?"收合分類列":"展開分類列"))}" aria-label="${esc(t(categoriesExpanded?"收合分類列":"展開分類列"))}"><span aria-hidden="true">${categoriesExpanded?"‹":"›"}</span></button>${categoriesExpanded?`<button class="cl-category-scroll" data-shelf-action="category-left" title="${esc(t("向左捲動群組"))}" aria-label="${esc(t("向左捲動群組"))}">‹</button><div class="cl-category-items" id="cl-category-items" role="group" aria-label="${esc(t("訂閱分類"))}">${categories.map(item=>`<button class="cl-category-chip" type="button" data-shelf-action="scope" data-id="${esc(item.id)}" aria-pressed="${getActiveGroup()===item.id}" title="${esc(item.name)} · ${item.count}"><span class="cl-category-dot" style="background:${esc(item.color)}"></span><span class="cl-category-label" translate="no">${esc(item.name)}</span></button>`).join("")}</div><button class="cl-category-scroll" data-shelf-action="category-right" title="${esc(t("向右捲動群組"))}" aria-label="${esc(t("向右捲動群組"))}">›</button>`:`<span class="cl-category-current" translate="no">${esc(categories.find(item=>item.id===getActiveGroup())?.name||t("全部訂閱"))}</span>`}</div>`;
          const viewNames = { timeline: t("時間軸"), channels: t("依頻道"), feed: t("動態") };
          // Keep the route-driven native select for compatibility with existing
          // keyboard/programmatic clients, but replace its OS-styled popup with
          // an accessible, consistent disclosure for sighted interaction.
          const viewControl = `<div class="cl-view-control" data-dom-key="view"><label class="cl-visually-hidden" for="cl-view-native">${esc(t("檢視方式"))}</label><select id="cl-view-native" class="cl-visually-hidden cl-native-view-select" data-shelf-input="view" aria-hidden="true" tabindex="-1">${option("timeline","時間軸",view)}${option("channels","依頻道",view)}${option("feed","動態",view)}</select><details class="cl-view-picker"><summary aria-label="${esc(t("檢視方式"))}：${esc(viewNames[view])}"><span class="cl-view-picker-title">${esc(t("檢視方式"))}</span><strong>${esc(viewNames[view])}</strong><span class="cl-view-caret" aria-hidden="true">⌄</span></summary><div class="cl-view-options" role="group" aria-label="${esc(t("檢視方式"))}">${["timeline","channels","feed"].map(mode => `<button type="button" data-shelf-action="select-view" data-view="${mode}" aria-pressed="${mode===view}"><span>${esc(viewNames[mode])}</span><span class="cl-view-check" aria-hidden="true">${mode===view?"✓":""}</span></button>`).join("")}</div></details></div>`;
          const videoType = `<span class="cl-content-kind" title="${esc(t("目前提供影片內容"))}">${esc(t("影片"))}</span>`;
          const oldStrip = header.querySelector(".cl-category-items");
          const scrollLeft = oldStrip?.scrollLeft || 0;
          globalThis.ChanlumeDom.patch(header, `<h1 class="cl-visually-hidden">${esc(t(collections()?"群組收藏":getActiveGroup()==="unfiled"?"未分類":group?.name||"全部訂閱"))}</h1><div class="cl-shelf-controls" data-dom-key="shelf-controls">${collections()?sortSelect+layoutControl+`<div class="cl-create-collection">${button("new","新增群組")}</div>`:viewControl+videoType+(view==="channels"?sortSelect:"")+layoutControl+tools}${search}</div>${categoryRail?`<div id="chanlume-category-slot" data-dom-key="category-slot">${categoryRail}</div>`:""}`);
          const rail = header.querySelector(".cl-category-rail");
          if (rail && !wiredCategoryRails.has(rail)) {
            rail.addEventListener("click", (event) => { event.stopPropagation(); onClick(event); });
            wiredCategoryRails.add(rail);
          }
          const strip = header.querySelector(".cl-category-items");
          if(strip){strip.scrollLeft=scrollLeft;const selected=strip.querySelector('[aria-pressed="true"]');if(selected){const item=selected.getBoundingClientRect(),frame=strip.getBoundingClientRect();if(item.left<frame.left)strip.scrollLeft+=item.left-frame.left;else if(item.right>frame.right)strip.scrollLeft+=item.right-frame.right;}}
        }
      }
      const toolsSlot = root.querySelector(".cl-feed-tools-slot");
      if (toolsSlot) globalThis.ChanlumeDom.patch(toolsSlot, feedMenuMarkup);
      navResizeHandler?.();
      syncCategoryRail();
      update();
      if (collections() && params().get("chanlume-create-group") === "1") {
        const url = new URL(location.href), clean = new URLSearchParams(url.hash.slice(1));
        clean.delete("chanlume-create-group");
        url.hash = clean.toString();
        history.replaceState(history.state, "", url);
        openEditor(null, "group");
      }
    }

    function openEditor(id, kind) {
      const state = getState(), group = state.groups.find((item) => item.id === id);
      if (id && !group) return;
      editor = { id: id || "", kind, changes: new Map() };
      const dialog = root.querySelector("dialog");
      dialog.innerHTML = `<form><header><h2 id="cl-collection-editor-title">${esc(t(kind === "members" ? "管理成員" : id ? "編輯群組" : "新增群組"))}</h2>${button("cancel", "取消")}</header>${kind === "members" ? `<p translate="no">${esc(group.name)}</p><input type="search" data-shelf-input="members" placeholder="${esc(t("搜尋全部頻道"))}" aria-label="${esc(t("搜尋全部頻道"))}"><div class="cl-collection-member-picker">${Object.values(state.channels).sort((a, b) => a.name.localeCompare(b.name)).map((channel) => `<label translate="no"><input type="checkbox" data-shelf-member="${esc(channel.id)}" ${group.channelIds.includes(channel.id) ? "checked" : ""}>${avatar(channel)}<span>${esc(channel.name)}</span></label>`).join("") || `<p>${esc(t("先更新訂閱內容，再回來挑選頻道。"))}</p>`}</div>` : `<label>${esc(t("群組名稱"))}<input name="name" required maxlength="40" value="${esc(group?.name || "")}" autocomplete="off"></label><label>${esc(t("群組顏色"))}<input name="color" type="color" value="${group?.color || "#7c5cff"}"></label>`}<p role="status" class="cl-collection-error"></p><footer><p>${esc(t("勾選頻道後按儲存；取消不會修改群組。"))}</p><button class="cl-button cl-primary" type="submit">${esc(t("儲存變更"))}</button></footer></form>`;
      dialog.showModal();
      dialog.querySelector(kind === "members" ? "input[type=search]" : "input[name=name]")?.focus();
    }

    async function saveEditor(event) {
      if (event.target.tagName !== "FORM") return;
      event.preventDefault();
      if (!editor || saving) return;
      const dialog = root.querySelector("dialog"), draft = editor;
      const group = getState().groups.find((item) => item.id === draft.id);
      const operation = draft.kind === "members" ? { type: "edit-memberships", payload: { groupId: draft.id, changes: [...draft.changes].map(([channelId, enabled]) => ({ channelId, enabled })) } } : { type: "save-group", payload: { id: draft.id, name: dialog.querySelector("[name=name]").value.trim(), color: dialog.querySelector("[name=color]").value, icon: group?.icon || "star" } };
      saving = true;
      dialog.querySelectorAll("input,button").forEach((node) => { node.disabled = true; });
      try {
        await commit(operation);
        if (editor !== draft) return;
        dialog.close(); editor = null; signature = bodySignature = ""; render();
      } catch (_) { dialog.querySelector(".cl-collection-error").textContent = t("儲存失敗，請重試。"); }
      finally { saving = false; dialog.querySelectorAll("input,button").forEach((node) => { node.disabled = false; }); }
    }

    function onInput(event) {
      const type = event.target.dataset.shelfInput;
      if (type === "members") {
        const text = event.target.value.toLocaleLowerCase();
        root.querySelectorAll(".cl-collection-member-picker label").forEach((label) => { label.hidden = !label.textContent.toLocaleLowerCase().includes(text); });
      } else if (["collections", "channels", "videos"].includes(type)) { if (type === "collections") collectionQuery = event.target.value; else if (type === "channels") channelQuery = event.target.value; else query = event.target.value; update();
        if (type !== "collections") { const url = new URL(location.href), p = new URLSearchParams(url.hash.slice(1)); const key = type === "channels" ? "channel-q" : "q"; if (event.target.value) p.set(key,event.target.value); else p.delete(key); url.hash = p.toString(); history.replaceState(history.state,"",url); } }
    }
    function onChange(event) {
      const type = event.target.dataset.shelfInput;
      if (type === "scope") { openGroup(event.target.value); return; }
      if (type === "view") { route({"chanlume-view": event.target.value === "feed" ? "" : event.target.value, sort:""}); return; }
      if (type === "sort") { route({sort:event.target.value},true); return; }
      if (editor && event.target.dataset.shelfMember) editor.changes.set(event.target.dataset.shelfMember, event.target.checked);
    }
    function onClick(event) {
      const target = event.target.closest("[data-shelf-action]");
      if (!target) return;
      const action = target.dataset.shelfAction, id = target.dataset.id;
      if (action === "select-view") {
        const chosen = target.dataset.view;
        if (["timeline", "channels", "feed"].includes(chosen)) {
          root.querySelector(".cl-view-picker")?.removeAttribute("open");
          route({"chanlume-view": chosen === "feed" ? "" : chosen, sort:""});
        }
        return;
      }
      if(action === "toggle-categories") {categoriesExpanded=!categoriesExpanded;signature="";render();return;}
      if(action === "category-left" || action === "category-right") {const strip=document.querySelector('.cl-category-items');strip?.scrollBy({left:(action==="category-left"?-1:1)*Math.max(180,strip.clientWidth*.7),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
      if(action === "scope") {openGroup(id);return;}
      if (action === "cancel" && !saving) { root.querySelector("dialog").close(); editor = null; }
      if (action === "collections") navigateCollections();
      if (action === "subscriptions") openGroup("all");
      if (action === "directory") navigateChannels();
      if (action === "open") { openGroup(id); route({"chanlume-view":"collection", q:"", "channel-q":""}, true); }
      if (action === "feed" || action === "channels") route({"chanlume-view":action === "feed" ? "" : action, ...(action === "feed" ? {layout:"", sort:"", q:""} : {})});
      if (action === "grid" || action === "list") route({layout:action === "grid" ? (view === "channels" ? "grid" : "") : action});
      if (action === "collapse-collection") { if (collectionCollapsed.has(id)) collectionCollapsed.delete(id); else collectionCollapsed.add(id); update(); }
      if (action === "new" || action === "rename" || action === "members") openEditor(id, action === "members" ? "members" : "group");
      if (action === "collapse") { if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id); update(); }
    }
    return { render, update, clear, navigateCollections, navigateNewGroup, navigateChannels, isCollections: collections };
  };
})();
