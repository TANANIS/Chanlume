(function () {
  "use strict";

  if (window.top !== window || globalThis.__chanlumeContentInitialized) return;
  globalThis.__chanlumeContentInitialized = true;
  const Core = globalThis.ChanlumeCore;
  const previousHash = location.hash;
  const currentHash = Core.canonicalHash(previousHash);
  if (currentHash !== previousHash) history.replaceState(history.state, "", currentHash);
  const STORAGE_KEY = "chanlumeState";
  let state = Core.defaultState();
  let activeGroupId = "all";
  let scanTimer = null;
  let lastPathname = location.pathname;
  let homeRedirecting = false;
  let shortsRedirecting = false;
  const VIDEO_CARD_SELECTOR = "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-channel-renderer, ytd-compact-video-renderer, yt-lockup-view-model";
  const STRUCTURE_SELECTOR = 'ytd-rich-shelf-renderer, ytd-guide-renderer, ytd-mini-guide-renderer, ytd-browse[page-subtype="subscriptions"], ytd-watch-flexy, ytd-watch-metadata, ytd-watch-info-text, yt-page-header-view-model, yt-page-header-renderer, yt-content-metadata-view-model, .ytContentMetadataViewModelMetadataRow, yt-flexible-actions-view-model, yt-subscribe-button-view-model';
  const pendingCards = new Set();
  let pendingFullRefresh = false;
  let pendingStructureRefresh = false;
  let trackedSubscription = { channelId: "", subscribed: null };
  let subscriptionSyncTimer = null;
  let subscriptionSyncRunning = false;
  let subscriptionSyncFailures = 0;
  const scanIdentityByAlias = new Map();
  const IDENTITY_BRIDGE_SOURCE = "chanlume-identity-bridge";
  const OWN_UI_SELECTOR = '#chanlume-subscriptions-page, #chanlume-shelf-sticky, #chanlume-favorites-page, #chanlume-home-featured, #chanlume-watch-facts, #chanlume-watch-side-tabs, #chanlume-toolbar, #chanlume-guide-section, #chanlume-mini-guide, #chanlume-scan-progress, #chanlume-channel-control, #chanlume-channel-classification, .chanlume-card-classification';
  let membershipsByChannel = new Map();
  let unfiledIds = [];
  let stateLoaded = false;
  let scanGeneration = 0;
  let autoplayRestore = null;
  let startupScanTimer = null;
  const favorites = globalThis.createChanlumeFavorites({ getState: () => state, commit, openGroup: openSubscriptionGroup });
  const home = globalThis.createChanlumeHome({ getState: () => state });
  const watch = globalThis.createChanlumeWatch({ Core, getState: () => state });
  document.documentElement?.classList.add("chanlume-disabled");

  function publishPowerState() {
    window.postMessage({ source: IDENTITY_BRIDGE_SOURCE, type: "SET_ENABLED", enabled: state.settings.enabled }, location.origin);
  }

  function pauseIntegration() {
    favorites.clear();
    home.clear();
    watch.clear();
    subscriptions.clear();
    navigation.clear();
    observer.disconnect();
    subscriptionObserver.disconnect();
    clearTimeout(scanTimer);
    clearTimeout(subscriptionSyncTimer);
    subscriptionSyncTimer = null;
    subscriptionSyncFailures = 0;
    clearTimeout(startupScanTimer);
    clearTimeout(toast.timer);
    scanTimer = null;
    pendingCards.clear();
    pendingFullRefresh = false;
    pendingStructureRefresh = false;
    scanGeneration++;
    scanIdentityByAlias.clear();
    trackedSubscription = { channelId: "", subscribed: null };
    homeRedirecting = shortsRedirecting = false;
    document.documentElement.classList.add("chanlume-disabled");
    document.documentElement.classList.remove("chanlume-block-home", "chanlume-hide-shorts", "chanlume-hide-secondary", "chanlume-integrated");
    $$(".chanlume-hidden, .chanlume-shorts-hidden").forEach((card) => card.classList.remove("chanlume-hidden", "chanlume-shorts-hidden"));
    $$("#chanlume-toolbar, #chanlume-guide-section, #chanlume-channel-control, #chanlume-channel-classification, .chanlume-card-classification, #chanlume-scan-progress").forEach((node) => node.remove());
    const autoplay = autoplayRestore?.deref();
    autoplayRestore = null;
    if (autoplay?.isConnected && autoplay.getAttribute("aria-checked") === "false") autoplay.click();
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pageKind = () => Core.youtubePageKind(location.href);
  const isSubscriptionsPage = () => pageKind() === "subscriptions";
  const currentLanguage = () => Core.languageCode(state.settings?.language);
  function localizeExtensionUi(root) { Core.localizeDom(root, currentLanguage()); }

  const subscriptions = globalThis.createChanlumeSubscriptions({
    Core, getState: () => state, getActiveGroup: () => activeGroupId,
    getCards: allCards, findChannel: findChannelInCard, isWatched: isWatchedCard,
    openGroup: openSubscriptionGroup, commit, escape: escapeHtml
  });
  const navigation = globalThis.createChanlumeNavigation({
    Core, getState: () => state, getActiveGroup: () => activeGroupId,
    favorites, subscriptions, isSubscriptionsPage, pageKind, openSubscriptionGroup,
    escapeHtml, localizeExtensionUi, currentLanguage, unfiledChannelIds,
    changeSetting, startSubscriptionUpdate, toast
  });

  function unfiledChannelIds() {
    return unfiledIds;
  }

  function channelGroups(id) {
    return membershipsByChannel.get(Core.resolveChannelRecordId(state, id) || id) || [];
  }

  function rebuildMembershipIndex() {
    membershipsByChannel = new Map();
    for (const group of state.groups) for (const id of group.channelIds) {
      if (!membershipsByChannel.has(id)) membershipsByChannel.set(id, []);
      membershipsByChannel.get(id).push(group);
    }
    unfiledIds = Object.keys(state.channels).filter((id) => !membershipsByChannel.has(id));
  }

  function registerScanIdentity(channelId, alias) {
    const stableId = String(channelId || "").trim();
    const aliasKey = Core.channelKey(String(alias || ""));
    if (!/^UC[A-Za-z0-9_-]{20,}$/.test(stableId) || !aliasKey) return;
    const canonicalAlias = Core.channelKey(`/channel/${stableId}`);
    const identity = { channelId: stableId, aliases: [...new Set([aliasKey, canonicalAlias].filter(Boolean))] };
    identity.aliases.forEach((key) => scanIdentityByAlias.set(key, identity));
  }

  function enrichChannelIdentity(channel) {
    const identity = scanIdentityByAlias.get(Core.channelKey(channel?.url || channel?.id));
    return identity ? { ...channel, channelId: identity.channelId, aliases: identity.aliases } : channel;
  }

  window.addEventListener("message", (event) => {
    if (event.source === window && event.origin === location.origin && event.data?.source === IDENTITY_BRIDGE_SOURCE && event.data?.type === "BRIDGE_READY") {
      if (stateLoaded) publishPowerState();
      return;
    }
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== IDENTITY_BRIDGE_SOURCE || event.data?.type !== "CHANNEL_IDENTITY") return;
    if (!state.settings.enabled || location.pathname !== "/feed/channels") return;
    registerScanIdentity(event.data.channelId, event.data.alias);
  });

  function canonicalCard(element) {
    let card = element instanceof Element ? element.closest(VIDEO_CARD_SELECTOR) : null;
    if (!card) return null;
    let parent = card.parentElement?.closest(VIDEO_CARD_SELECTOR);
    while (parent) {
      card = parent;
      parent = card.parentElement?.closest(VIDEO_CARD_SELECTOR);
    }
    return card;
  }

  function collectCards(root, target) {
    if (!(root instanceof Element)) return;
    const ownCard = canonicalCard(root);
    if (ownCard) target.add(ownCard);
    root.querySelectorAll(VIDEO_CARD_SELECTOR).forEach((card) => target.add(canonicalCard(card) || card));
  }

  function allCards() {
    const cards = new Set();
    document.querySelectorAll(VIDEO_CARD_SELECTOR).forEach((card) => cards.add(canonicalCard(card) || card));
    return [...cards];
  }

  function openSubscriptionGroup(groupId) {
    if (!isSubscriptionsPage()) {
      location.assign(Core.subscriptionGroupUrl(groupId));
      return false;
    }
    activeGroupId = validGroupId(groupId) ? groupId : "all";
    const url = new URL(location.href);
    const route = new URLSearchParams(url.hash.slice(1));
    // Selecting a category is a scope change within Subscriptions. Keep its
    // current view, layout, dates and search; leave management-only routes.
    if (["collections", "favorites", "collection"].includes(route.get("chanlume-view"))) {
      route.delete("chanlume-view");
      for (const key of ["layout", "sort", "q", "channel-q", "from", "to"]) route.delete(key);
    }
    route.set("chanlume-group", activeGroupId);
    url.hash = route.toString();
    if (url.href !== location.href) history.pushState(history.state, "", url);
    renderIntegratedControls();
    applyFilters();
    return true;
  }

  async function readState() {
    const stored = globalThis.ChanlumeStartup ? await globalThis.ChanlumeStartup.state : (await Core.readStoredValues(chrome.storage.local, STORAGE_KEY))[STORAGE_KEY];
    acceptState(stored, true);
    stateLoaded = true;
    return state;
  }

  function validGroupId(groupId) {
    return ["all", "unfiled"].includes(groupId) || state.groups.some((group) => group.id === groupId);
  }

  function syncActiveGroupFromLocation() {
    if (!isSubscriptionsPage()) return;
    const requested = new URLSearchParams(Core.canonicalHash(location.hash).replace(/^#/, "")).get("chanlume-group") || "all";
    activeGroupId = validGroupId(requested) ? requested : "all";
    if (requested !== activeGroupId) {
      const url = new URL(location.href);
      url.hash = `chanlume-group=${encodeURIComponent(activeGroupId)}`;
      history.replaceState(history.state, "", url);
    }
  }

  function acceptState(next, force = false) {
    if (!force && Number.isSafeInteger(next?.revision) && next.revision <= state.revision) return false;
    const incoming = Core.normalizeState(next);
    if (!force && incoming.revision <= state.revision) return false;
    state = incoming;
    rebuildMembershipIndex();
    if (!validGroupId(activeGroupId)) {
      activeGroupId = "all";
      if (isSubscriptionsPage()) {
        const url = new URL(location.href);
        url.hash = "chanlume-group=all";
        history.replaceState(history.state, "", url);
      }
    }
    return true;
  }

  function refreshFromState() {
    globalThis.ChanlumeStartup?.sync(state.settings.enabled);
    publishPowerState();
    if (!state.settings.enabled) { pauseIntegration(); return; }
    document.documentElement.classList.remove("chanlume-disabled");
    if (document.hidden) { pendingFullRefresh = true; pendingStructureRefresh = true; return; }
    updateObservation();
    renderIntegratedControls();
    renderCurrentChannelControl();
    applyFilters();
    scheduleSubscriptionSync();
  }

  async function commit(operation) {
    const result = await chrome.runtime.sendMessage({ type: "CHANLUME_MUTATE", operation });
    if (!result?.ok) throw Object.assign(new Error(result?.error || "State update failed"), { code: result?.code });
    if (acceptState(result.state)) refreshFromState();
    return state;
  }

  function currentChannelFromPage() {
    const watchOwner = location.pathname === "/watch" ? [...document.querySelectorAll('ytd-watch-metadata #owner a[href^="/@"], ytd-watch-metadata #owner a[href^="/channel/"], #upload-info a[href^="/@"], #upload-info a[href^="/channel/"]')].find(isVisibleControl) : null;
    const pageLink = watchOwner || document.querySelector('yt-page-header-view-model a[href^="/@"], yt-page-header-view-model a[href^="/channel/"], yt-page-header-renderer a[href^="/@"], ytd-c4-tabbed-header-renderer a[href^="/@"], link[rel="canonical"]');
    const locationId = Core.channelKey(location.href);
    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || "";
    const canonicalId = Core.channelKey(canonicalUrl);
    const rawUrl = locationId ? location.href : pageLink?.href || "";
    const id = Core.channelKey(rawUrl);
    if (!id) return null;
    const name = (watchOwner?.textContent || document.querySelector('yt-page-header-view-model h1, yt-page-header-view-model .yt-page-header-view-model__page-header-title, yt-page-header-renderer h1, ytd-c4-tabbed-header-renderer #channel-name')?.textContent || id).trim();
    const avatar = document.querySelector('ytd-watch-metadata #owner #avatar img, yt-page-header-view-model img, yt-page-header-renderer img, ytd-c4-tabbed-header-renderer #avatar img')?.src || "";
    let channelId = "";
    try { channelId = new URL(canonicalUrl).pathname.match(/^\/channel\/([^/]+)/i)?.[1] || ""; } catch (_error) {}
    return {
      id,
      url: new URL(rawUrl, location.origin).href,
      name,
      avatar,
      channelId,
      aliasIds: canonicalId && canonicalId !== id ? [canonicalId] : []
    };
  }

  function currentSubscriptionStatus() {
    const roots = [...document.querySelectorAll('ytd-watch-metadata ytd-subscribe-button-renderer, ytd-watch-metadata yt-subscribe-button-view-model, yt-page-header-view-model yt-subscribe-button-view-model, yt-page-header-view-model ytd-subscribe-button-renderer, yt-page-header-renderer ytd-subscribe-button-renderer, yt-page-header-renderer yt-subscribe-button-view-model, ytd-c4-tabbed-header-renderer ytd-subscribe-button-renderer')];
    const root = roots.find(isVisibleControl) || null;
    if (!root) return null;
    // Smartimation keeps both states mounted; the first button can be hidden.
    const button = [...root.querySelectorAll("button")].find(isVisibleControl);
    const aria = button?.getAttribute("aria-label") || "";
    const text = button?.textContent?.trim() || "";
    if (/unsubscribe|取消訂閱|取消订阅/i.test(`${aria} ${text}`)) return true;
    if (/^(subscribed|已訂閱|已订阅)$/i.test(text)) return true;
    if (/^(subscribe|訂閱|订阅)$/i.test(text) || /subscribe to|訂閱「|订阅“/i.test(aria)) return false;
    if (root.hasAttribute("subscribed") && root.getAttribute("subscribed") !== "false") return true;
    return null;
  }

  function isVisibleControl(node) {
    if (!node?.getClientRects().length || node.closest('[hidden], [aria-hidden="true"]')) return false;
    if (node.checkVisibility && !node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return false;
    const style = getComputedStyle(node);
    return style.visibility === "visible" && style.display !== "none" && style.opacity !== "0";
  }

  function currentControlHost() {
    const selectors = [
      'ytd-watch-metadata #owner #subscribe-button',
      'ytd-watch-metadata yt-subscribe-button-view-model',
      'yt-page-header-view-model yt-subscribe-button-view-model',
      'yt-page-header-view-model ytd-subscribe-button-renderer',
      'yt-page-header-renderer yt-subscribe-button-view-model',
      'yt-page-header-renderer #subscribe-button',
      'ytd-c4-tabbed-header-renderer #subscribe-button',
      '#page-header #subscribe-button'
    ];
    const subscribe = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
      .find((node) => isVisibleControl(node) && !node.closest("#chanlume-channel-control"));
    return subscribe?.closest(".ytFlexibleActionsViewModelAction") || subscribe || null;
  }

  function currentChannelRecordId(channel) {
    const identities = [
      channel?.id,
      channel?.url,
      ...(channel?.aliasIds || []),
      channel?.channelId ? `/channel/${channel.channelId}` : ""
    ];
    return identities.map((identity) => Core.resolveChannelRecordId(state, identity)).find(Boolean) || "";
  }

  function classificationBadges(groups) {
    return groups.length
      ? groups.map((group) => `<span class="cl-channel-classification-group"><span class="cl-channel-classification-dot" style="background:${group.color}"></span>${escapeHtml(group.name)}</span>`).join("")
      : `<span class="cl-channel-classification-group cl-unfiled">${escapeHtml(Core.translateUiText("未分類", currentLanguage()))}</span>`;
  }

  function renderCurrentChannelClassification(channel) {
    const existing = document.getElementById("chanlume-channel-classification");
    const recordId = currentChannelRecordId(channel);
    const pageHeader = document.querySelector("yt-page-header-view-model, yt-page-header-renderer, ytd-c4-tabbed-header-renderer");
    const rows = [...(pageHeader?.querySelectorAll("yt-content-metadata-view-model .ytContentMetadataViewModelMetadataRow, .ytContentMetadataViewModelMetadataRow") || [])]
      .filter((row) => row.getClientRects().length);
    const metadataRow = rows.at(-1) || null;
    if (!recordId || !metadataRow) { existing?.remove(); return; }

    const groups = channelGroups(recordId);
    const signature = JSON.stringify([recordId, currentLanguage(), groups.map((group) => [group.id, group.name, group.color])]);
    const classification = existing || document.createElement("div");
    classification.id = "chanlume-channel-classification";
    if (classification.previousElementSibling !== metadataRow) metadataRow.insertAdjacentElement("afterend", classification);
    if (classification.dataset.signature === signature) return;
    classification.dataset.signature = signature;
    const label = Core.translateUiText("分類", currentLanguage());
    classification.innerHTML = `<span class="cl-channel-classification-label">${escapeHtml(label)}</span><span class="cl-channel-classification-groups">${classificationBadges(groups)}</span>`;
  }

  function renderCurrentChannelControl() {
    if (!state.settings.enabled) return;
    updateSubscriptionObservation();
    if (location.pathname !== "/watch" && !Core.channelKey(location.href)) {
      document.getElementById("chanlume-channel-control")?.remove();
      document.getElementById("chanlume-channel-classification")?.remove();
      return;
    }
    const channel = currentChannelFromPage();
    renderCurrentChannelClassification(channel);
    const host = currentControlHost();
    const recordId = currentChannelRecordId(channel);
    const subscribed = currentSubscriptionStatus();
    if (!channel || !host) { document.getElementById("chanlume-channel-control")?.remove(); return; }
    let control = document.getElementById("chanlume-channel-control");
    if (!control) {
      control = document.createElement("div");
      control.id = "chanlume-channel-control";
      control.addEventListener("click", onCurrentChannelClick);
      control.addEventListener("submit", onCurrentChannelCreateGroup);
      host.insertAdjacentElement("afterend", control);
    } else if (control.previousElementSibling !== host) {
      host.insertAdjacentElement("afterend", control);
    }
    const memberships = new Set(channelGroups(channel.id).map((group) => group.id));
    const favorite = state.favoriteChannelIds.includes(recordId);
    const canFile = Boolean(recordId) && subscribed !== false;
    const signature = JSON.stringify([channel.id, channel.name, subscribed, canFile, favorite, currentLanguage(), [...memberships], state.groups.map((group) => [group.id, group.name, group.color])]);
    if (control.dataset.signature === signature) return;
    const wasOpen = control.classList.contains("cl-current-open");
    control.dataset.signature = signature;
    control.dataset.channelId = channel.id;
    const options = state.groups.length
      ? state.groups.map((group) => `<label class="cl-current-option"><input type="checkbox" data-cl-current-group="${escapeHtml(group.id)}" ${memberships.has(group.id) ? "checked" : ""} ${canFile ? "" : "disabled"}><span class="cl-current-dot" style="background:${group.color}"></span><span>${escapeHtml(group.name)}</span></label>`).join("")
      : '<span class="cl-current-empty">尚未建立群組</span>';
    control.innerHTML = `<button class="cl-current-trigger" type="button" aria-expanded="${wasOpen}" title="更改這個頻道的分類"><span>${Core.iconSvg("book", "currentColor", 15)}</span><span>分類</span></button><div class="cl-current-menu"><strong>${escapeHtml(channel.name)}</strong><small>${canFile ? memberships.size ? "選擇所屬群組" : "目前在未分類" : "訂閱頻道後即可加入分類"}</small><div class="cl-current-options">${options}</div><button data-cl-current-create type="button" aria-expanded="false" ${canFile ? "" : "disabled"}>＋ 新增群組</button><form class="cl-current-new-form" hidden><label>群組名稱<input name="name" maxlength="40" autocomplete="off" required placeholder="輸入分類名稱"></label><label>標記顏色<input name="color" type="color" value="#7c5cff"></label><p class="cl-current-form-error" role="status" aria-live="polite"></p><div class="cl-current-form-actions"><button type="button" data-cl-current-cancel>取消</button><button type="submit" class="cl-current-create-submit">建立並加入</button></div></form><button data-cl-current-manage type="button">管理全部群組 ↗</button></div>`;
    control.classList.toggle("cl-current-open", wasOpen);
    const star = document.createElement("button");
    star.className = "cl-current-favorite";
    star.type = "button";
    star.setAttribute("aria-pressed", String(favorite));
    star.title = Core.translateUiText(favorite ? "取消關注" : "關注頻道", currentLanguage());
    star.textContent = `${favorite ? "★" : "☆"} ${Core.translateUiText(favorite ? "已關注" : "關注頻道", currentLanguage())}`;
    if (canFile) control.append(star);
    localizeExtensionUi(control);
    const menu = control.querySelector('.cl-current-menu');
    menu.setAttribute('popover', 'manual');
    if (wasOpen) setCurrentMenuOpen(control, true);
  }

  function setCurrentMenuOpen(control, open) {
    if (!control) return;
    const menu = control.querySelector('.cl-current-menu');
    control.classList.toggle('cl-current-open', open);
    control.querySelector('.cl-current-trigger')?.setAttribute('aria-expanded', String(open));
    if (!menu) return;
    if (open) {
      menu.showPopover();
      const rect = control.getBoundingClientRect();
      const width = menu.getBoundingClientRect().width;
      menu.style.left = `${Math.max(8, Math.min(rect.right - width, innerWidth - width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - menu.getBoundingClientRect().height - 8))}px`;
    } else if (menu.matches(':popover-open')) menu.hidePopover();
  }

  async function onCurrentChannelClick(event) {
    const star = event.target.closest(".cl-current-favorite");
    if (star) {
      const id = currentChannelRecordId(currentChannelFromPage());
      if (!id || star.disabled || currentSubscriptionStatus() === false) return;
      star.disabled = true;
      try {
        await commit({ type: "edit-favorites", payload: { changes: [{ channelId: id, enabled: !state.favoriteChannelIds.includes(id) }] } });
      } catch (_) { toast("儲存失敗，請重試。"); }
      finally { star.disabled = false; renderCurrentChannelControl(); }
      return;
    }
    const trigger = event.target.closest(".cl-current-trigger");
    if (trigger) {
      const control = event.currentTarget;
      setCurrentMenuOpen(control, !control.classList.contains("cl-current-open"));
      return;
    }
    if (event.target.closest("[data-cl-current-manage]")) {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
      return;
    }
    if (event.target.closest("[data-cl-current-create]")) {
      const control = event.currentTarget, form = control.querySelector(".cl-current-new-form");
      form.hidden = !form.hidden;
      control.querySelector("[data-cl-current-create]").setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) form.querySelector("[name=name]")?.focus();
      setCurrentMenuOpen(control, true);
      return;
    }
    if (event.target.closest("[data-cl-current-cancel]")) {
      const control = event.currentTarget;
      control.querySelector(".cl-current-new-form").hidden = true;
      control.querySelector("[data-cl-current-create]").setAttribute("aria-expanded", "false");
      setCurrentMenuOpen(control, true);
      return;
    }
    const input = event.target.closest("[data-cl-current-group]");
    if (!input) return;
    const channel = currentChannelFromPage();
    if (!channel || !currentChannelRecordId(channel) || currentSubscriptionStatus() === false) { input.checked = false; toast("請先訂閱這個頻道，再加入群組"); return; }
    const group = state.groups.find((item) => item.id === input.dataset.clCurrentGroup);
    const enabled = input.checked;
    try {
      await commit({ type: "toggle-membership", payload: { channel, channelId: channel.id, aliasIds: channel.aliasIds, groupId: input.dataset.clCurrentGroup, enabled } });
      toast(enabled ? `已加入「${group?.name || "群組"}」` : `已移出「${group?.name || "群組"}」`);
    } catch (_) { input.checked = !enabled; toast("儲存失敗，請重試。"); }
  }

  async function onCurrentChannelCreateGroup(event) {
    if (!event.target.matches(".cl-current-new-form")) return;
    event.preventDefault();
    const form = event.target;
    if (form.dataset.saving === "true") return;
    const channel = currentChannelFromPage();
    const channelId = currentChannelRecordId(channel);
    const name = form.elements.namedItem("name")?.value.trim() || "";
    const color = form.elements.namedItem("color")?.value || "#7c5cff";
    const status = form.querySelector(".cl-current-form-error");
    if (!channelId || currentSubscriptionStatus() === false) {
      status.textContent = "請先訂閱這個頻道，再新增分類";
      return;
    }
    if (!name) { status.textContent = "請輸入群組名稱"; return; }
    form.dataset.saving = "true";
    form.querySelectorAll("button,input").forEach(node => { node.disabled = true; });
    try {
      await commit({ type: "create-group-for-channel", payload: { channelId, name, color } });
      toast(`已建立「${name}」並加入頻道`);
      renderCurrentChannelControl();
    } catch (_) {
      if (form.isConnected) {
        status.textContent = "建立失敗，請重試。";
        form.querySelectorAll("button,input").forEach(node => { node.disabled = false; });
      }
    } finally { delete form.dataset.saving; }
  }

  async function syncSubscriptionState() {
    if (!state.settings.enabled) return;
    const channel = currentChannelFromPage();
    const subscribed = currentSubscriptionStatus();
    if (!channel || subscribed === null) return;
    const storedAliases = (channel.aliasIds || []).filter((id) => id !== channel.id && state.channels[id]);
    if (storedAliases.length) {
      await commit({ type: "coalesce-channel-identities", payload: { primaryChannel: channel, aliasIds: storedAliases } });
      if (!state.settings.enabled) return;
    }
    if (trackedSubscription.channelId !== channel.id) {
      if (subscribed && !currentChannelRecordId(channel)) await commit({ type: "set-subscription", payload: { subscribed: true, channel, aliasIds: channel.aliasIds } });
      trackedSubscription = { channelId: channel.id, subscribed };
      renderCurrentChannelControl();
      return;
    }
    if (trackedSubscription.subscribed === subscribed && (!subscribed || currentChannelRecordId(channel))) return;
    const previous = trackedSubscription.subscribed;
    if (subscribed === true) {
      if (!currentChannelRecordId(channel)) {
        await commit({ type: "set-subscription", payload: { subscribed: true, channel, aliasIds: channel.aliasIds } });
      }
      toast("已加入未分類，稍後可以選擇群組");
    } else if (previous === true && subscribed === false && currentChannelRecordId(channel)) {
      await commit({ type: "set-subscription", payload: { subscribed: false, channelId: currentChannelRecordId(channel), aliasIds: channel.aliasIds } });
      toast("已取消訂閱並從 Chanlume 移除");
    }
    trackedSubscription = { channelId: channel.id, subscribed };
    renderCurrentChannelControl();
  }

  function scheduleSubscriptionSync() {
    if (!state.settings.enabled) return;
    if (subscriptionSyncTimer !== null) return;
    subscriptionSyncTimer = setTimeout(async () => {
      subscriptionSyncTimer = null;
      if (subscriptionSyncRunning) { scheduleSubscriptionSync(); return; }
      subscriptionSyncRunning = true;
      try { await syncSubscriptionState(); subscriptionSyncFailures = 0; }
      catch (_) {
        toast("儲存失敗，請重試。");
        if (++subscriptionSyncFailures < 3) scheduleSubscriptionSync();
      } finally { subscriptionSyncRunning = false; }
    }, 700);
  }

  function makeShell() {
    const node = document.createElement("div");
    node.className = "cl-toast";
    node.id = "cl-toast";
    document.documentElement.append(node);
  }
  function syncFullscreen() {
    const active = Boolean(document.fullscreenElement);
    document.documentElement.classList.toggle("chanlume-fullscreen", active);
    if (active) {
      document.querySelector('#chanlume-toolbar dialog[open]')?.close();
      setCurrentMenuOpen(document.getElementById("chanlume-channel-control"), false);
    }
  }

  function toast(message) {
    if (!state.settings.enabled) return;
    const node = $("#cl-toast");
    if (!node) return;
    node.textContent = Core.translateUiText(message, currentLanguage());
    node.classList.add("cl-show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("cl-show"), 2200);
  }

  function renderIntegratedControls() {
    globalThis.ChanlumeStartup?.sync(state.settings.enabled);
    navigation.render();
    home.render();
    watch.render();
  }

  async function changeSetting(setting, enabled) {
    await commit({ type: "set-setting", payload: { setting, enabled } });
    if (setting === "hideSecondary" && enabled) toast("已隱藏影片右側欄，並關閉自動播放");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function findChannelInCard(card) {
    const link = card.querySelector('a[href^="/@"], a[href^="/channel/"], a[href^="/c/"], a[href^="/user/"]');
    if (!link) return null;
    const id = Core.channelKey(link.href || link.getAttribute("href"));
    if (!id) return null;
    const nameNode = card.querySelector("#text, #channel-title, #channel-name, yt-formatted-string.ytd-channel-name");
    const avatar = card.querySelector("#avatar img, yt-img-shadow img")?.src || "";
    return enrichChannelIdentity({ id, url: link.href, name: nameNode?.textContent?.trim() || link.textContent?.trim() || id, avatar });
  }

  function renderCardClassification(card, channel, recordId) {
    const existing = card.querySelector(":scope .chanlume-card-classification");
    const metadata = card.querySelector("yt-lockup-metadata-view-model yt-content-metadata-view-model, yt-content-metadata-view-model");
    const rows = [...(metadata?.querySelectorAll(":scope > .ytContentMetadataViewModelMetadataRow") || [])];
    const metadataRow = rows.at(-1) || null;
    if (!channel || !recordId || !metadataRow) { existing?.remove(); return; }

    const groups = channelGroups(recordId);
    const signature = JSON.stringify([recordId, currentLanguage(), groups.map((group) => [group.id, group.name, group.color])]);
    const classification = existing || document.createElement("div");
    classification.className = "chanlume-card-classification";
    if (classification.previousElementSibling !== metadataRow) metadataRow.insertAdjacentElement("afterend", classification);
    if (classification.dataset.signature === signature) return;
    classification.dataset.signature = signature;
    classification.innerHTML = `<span class="cl-channel-classification-label">${escapeHtml(Core.translateUiText("分類", currentLanguage()))}</span><span class="cl-channel-classification-groups">${classificationBadges(groups)}</span>`;
  }

  function isWatchedCard(card) {
    if (card.querySelector("ytd-thumbnail-overlay-resume-playback-renderer, yt-thumbnail-overlay-progress-bar-view-model")) return true;
    const progress = card.querySelector('#progress[style*="width"], [class*="Progress"][style*="width"], [class*="progress"][style*="width"]');
    if (progress) {
      const width = Number.parseFloat(progress.style.width || "0");
      if (width > 0) return true;
    }
    return Boolean(card.querySelector('[aria-label*="已觀看"], [aria-label*="觀看過"], [aria-label*="Watched" i]'));
  }

  async function startSubscriptionUpdate() {
    toast("即將更新全部訂閱內容…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "START_SUBSCRIPTION_UPDATE" });
      if (!result?.ok) toast("無法啟動訂閱更新");
    } catch (_error) {
      toast("無法更新訂閱內容，請重新載入擴充套件");
    }
  }

  function renderScanProgress(count, done) {
    if (!state.settings.enabled) return;
    let overlay = document.getElementById("chanlume-scan-progress");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "chanlume-scan-progress";
      document.documentElement.append(overlay);
    }
    overlay.innerHTML = `<div class="cl-scan-card"><div class="cl-scan-symbol">${done ? "✓" : "↻"}</div><h2>${done ? "訂閱內容已更新" : "正在更新訂閱內容"}</h2><p>${done ? "這個分頁即將自動關閉。" : "Chanlume 正在自動向下載入所有訂閱頻道，請暫時不要關閉這個分頁。"}</p><strong>${count}</strong><small>個頻道</small></div>`;
    localizeExtensionUi(overlay);
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function runSubscriptionUpdate() {
    if (!state.settings.enabled) return;
    const generation = ++scanGeneration;
    const checkActive = () => {
      if (!state.settings.enabled || generation !== scanGeneration) throw Object.assign(new Error("Chanlume paused"), { code: "CHANLUME_DISABLED" });
    };
    const startedAt = Date.now();
    const found = new Map();
    let stableRounds = 0;
    let lastCount = -1;
    let lastHeight = -1;
    let reachedEnd = false;
    window.postMessage({ source: IDENTITY_BRIDGE_SOURCE, type: "REQUEST_IDENTITIES" }, location.origin);
    renderScanProgress(0, false);
    try {
      for (let readyRound = 0; readyRound < 30; readyRound++) {
        checkActive();
        if (document.querySelector("ytd-channel-renderer")) break;
        await wait(500);
      }
      for (let round = 0; round < 240; round++) {
        checkActive();
        document.querySelectorAll("ytd-channel-renderer").forEach((card) => {
          const channel = findChannelInCard(card);
          if (channel) found.set(channel.id, channel);
        });
        renderScanProgress(found.size, false);
        if (round % 4 === 0) chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_PROGRESS", count: found.size, startedAt }).catch(() => {});
        const height = document.documentElement.scrollHeight;
        const atBottom = window.scrollY + window.innerHeight >= height - 120;
        stableRounds = found.size === lastCount && height === lastHeight && atBottom ? stableRounds + 1 : 0;
        if (stableRounds >= 5) { reachedEnd = true; break; }
        lastCount = found.size;
        lastHeight = height;
        window.scrollTo(0, height);
        await wait(700);
      }
      if (!found.size) throw new Error("No channels found");
      if (!reachedEnd) throw new Error("Subscription list did not reach a stable end");
      const scannedChannels = [...found.values()].map(enrichChannelIdentity);
      checkActive();
      await commit({ type: "reconcile-subscription-scan", payload: { channels: scannedChannels } });
      checkActive();
      renderScanProgress(found.size, true);
      await chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_COMPLETE", count: found.size });
    } catch (error) {
      if (error?.code === "CHANLUME_DISABLED") {
        chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_FAILED", count: found.size, error: "CHANLUME_DISABLED" }).catch(() => {});
        return;
      }
      renderScanProgress(found.size, false);
      const card = document.querySelector("#chanlume-scan-progress .cl-scan-card");
      const guarded = error?.code === "SCAN_SHRINK_GUARD";
      if (card) card.innerHTML = `<div class="cl-scan-symbol">!</div><h2>更新未完成</h2><p>${guarded ? "本次找到的頻道比現有書架少太多，已保留原資料以避免分類遺失。請確認清單完整，或手動確認使用本次結果。" : "請確認 YouTube 的所有訂閱頻道頁能正常顯示，再重新執行。"}</p><strong>${found.size}</strong><small>個已找到頻道</small>${guarded ? '<button id="chanlume-scan-force-apply" class="cl-button" type="button">仍以本次清單更新</button>' : ""}`;
      localizeExtensionUi(card);
      if (guarded) document.getElementById("chanlume-scan-force-apply")?.addEventListener("click", async (event) => {
        if (!confirm(Core.translateUiText(`本次只找到 ${found.size} 個頻道。仍要以這份清單取代目前書架嗎？被移除頻道的分類資料也會刪除。`, currentLanguage()))) return;
        event.currentTarget.disabled = true;
        try {
          const scannedChannels = [...found.values()].map(enrichChannelIdentity);
          await commit({ type: "reconcile-subscription-scan", payload: { channels: scannedChannels, allowLargeRemoval: true } });
          renderScanProgress(found.size, true);
          await chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_COMPLETE", count: found.size });
        } catch (forceError) {
          event.currentTarget.disabled = false;
          toast(String(forceError?.message || forceError));
        }
      });
      chrome.runtime.sendMessage({ type: "SUBSCRIPTION_UPDATE_FAILED", count: found.size, error: error?.code || String(error) }).catch(() => {});
    }
  }

  function applyDistractionControls(cards = null) {
    if (!state.settings.enabled) return;
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      homeRedirecting = false;
      shortsRedirecting = false;
    }
    const root = document.documentElement;
    root.classList.toggle("chanlume-block-home", Boolean(state.settings.blockHome));
    root.classList.toggle("chanlume-hide-shorts", Boolean(state.settings.hideShorts));
    root.classList.toggle("chanlume-hide-secondary", Boolean(state.settings.hideSecondary));

    const redirectUrl = Core.blockedPageRedirect(state.settings, location.href);
    if (redirectUrl && pageKind() === "home" && !homeRedirecting) {
      homeRedirecting = true;
      location.replace(redirectUrl);
      return;
    }

    if (redirectUrl && location.pathname.startsWith("/shorts") && !shortsRedirecting) {
      shortsRedirecting = true;
      location.replace(redirectUrl);
      return;
    }

    if (state.settings.hideShorts) {
      const shortCandidates = cards || allCards();
      for (const card of shortCandidates) {
        const isShorts = card.tagName.toLowerCase().includes("reel") || Boolean(card.querySelector('a[href^="/shorts/"], [is-shorts]'));
        card.classList.toggle("chanlume-shorts-hidden", isShorts);
      }
    } else if (cards) {
      cards.forEach((card) => card.classList.remove("chanlume-shorts-hidden"));
    } else {
      $$(".chanlume-shorts-hidden").forEach((card) => card.classList.remove("chanlume-shorts-hidden"));
    }

    if (state.settings.disableAutoplay) {
      const autoplayToggle = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
      if (autoplayToggle instanceof HTMLElement) { autoplayRestore = new WeakRef(autoplayToggle); autoplayToggle.click(); }
    }
  }

  function applyFilters(cards = null) {
    if (!state.settings.enabled) return;
    applyDistractionControls(cards);
    if (!isSubscriptionsPage()) {
      (cards || $$('.chanlume-hidden')).forEach((card) => card.classList.remove("chanlume-hidden"));
      $$(".chanlume-card-classification").forEach((classification) => classification.remove());
      return;
    }
    const group = ["all", "unfiled"].includes(activeGroupId) ? null : state.groups.find((item) => item.id === activeGroupId);
    const allowed = activeGroupId === "unfiled" ? new Set(unfiledChannelIds()) : group ? new Set(group.channelIds) : null;
    const candidates = cards || allCards();
    for (const card of candidates) {
      let hidden = false;
      const channel = findChannelInCard(card);
      const recordId = channel ? Core.resolveChannelRecordId(state, channel.id) : "";
      const channelId = recordId || channel?.id || "";
      renderCardClassification(card, channel, recordId);
      if (allowed && (!channelId || !allowed.has(channelId))) hidden = true;
      if (state.settings.hideWatched) {
        if (isWatchedCard(card)) hidden = true;
      }
      card.classList.toggle("chanlume-hidden", hidden);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "OPEN_CHANLUME") {
      if (!state.settings.enabled) { sendResponse({ ok: false, disabled: true }); return; }
      if (message.groupId) {
        const navigating = !isSubscriptionsPage();
        openSubscriptionGroup(validGroupId(message.groupId) ? message.groupId : "all");
        sendResponse({ ok: true, navigating });
        return;
      }
      if (!isSubscriptionsPage()) {
        openSubscriptionGroup("all");
        sendResponse({ ok: true, navigating: true });
        return;
      }
      document.getElementById("chanlume-shelf-sticky")?.scrollIntoView({ block: "start" });
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      if (acceptState(changes[STORAGE_KEY].newValue)) refreshFromState();
    }
  });

  function collectMutationWork(mutations) {
    let structure = location.pathname !== lastPathname;
    const cards = new Set();
    const trackCards = isSubscriptionsPage() || state.settings.hideShorts;
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (target?.closest(OWN_UI_SELECTOR)) continue;
      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (changedNodes.length && changedNodes.every((node) => node instanceof Element && node.matches(OWN_UI_SELECTOR))) continue;
      const subscriptionTarget = target?.closest("ytd-subscribe-button-renderer, yt-subscribe-button-view-model");
      if (mutation.type === "attributes" && ["style", "class", "hidden", "aria-label"].includes(mutation.attributeName) && !subscriptionTarget && (!isSubscriptionsPage() || !state.settings.hideWatched || !target?.matches('#progress, [class*="Progress"], [class*="progress"]'))) continue;
      if (subscriptionTarget || target?.closest("ytd-guide-renderer, ytd-mini-guide-renderer, ytd-browse[page-subtype=\"subscriptions\"] #primary")) structure = true;
      if (isSubscriptionsPage() && target?.closest('ytd-rich-shelf-renderer')) structure = true;
      if (trackCards && mutation.target instanceof Element) {
        const targetCard = canonicalCard(mutation.target);
        if (targetCard) cards.add(targetCard);
      }
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.closest(OWN_UI_SELECTOR)) continue;
        if (trackCards) collectCards(node, cards);
        if (!canonicalCard(node) && (node.matches(STRUCTURE_SELECTOR) || node.querySelector(STRUCTURE_SELECTOR) || node.closest("ytd-subscribe-button-renderer, yt-subscribe-button-view-model") || node.querySelector("ytd-subscribe-button-renderer, yt-subscribe-button-view-model"))) structure = true;
      }
    }
    return { cards, structure };
  }

  function scheduleRefresh(delay = 32, options = {}) {
    if (!state.settings.enabled) return;
    if (options.full) pendingFullRefresh = true;
    if (options.structure) pendingStructureRefresh = true;
    options.cards?.forEach((card) => pendingCards.add(card));
    if (document.hidden) { pendingFullRefresh = true; pendingCards.clear(); return; }
    if (scanTimer === -1) return;
    // Keep the first deadline: a busy feed must not postpone filtering indefinitely.
    if (scanTimer !== null && delay !== 0) return;
    if (scanTimer !== null) clearTimeout(scanTimer);
    const flush = () => {
      scanTimer = null;
      if (!state.settings.enabled || document.hidden) return;
      const full = pendingFullRefresh;
      const structure = pendingStructureRefresh;
      const cards = full ? null : [...pendingCards].filter((card) => card.isConnected);
      pendingFullRefresh = false;
      pendingStructureRefresh = false;
      pendingCards.clear();
      if (full || structure) renderIntegratedControls();
      if (full || structure) renderCurrentChannelControl();
      applyFilters(cards);
      subscriptions.update();
      if (structure) scheduleSubscriptionSync();
    };
    if (delay === 0) { scanTimer = -1; queueMicrotask(flush); }
    else scanTimer = setTimeout(flush, delay);
  }

  const observer = new MutationObserver((mutations) => {
    const work = collectMutationWork(mutations);
    if (work.structure || work.cards.size) scheduleRefresh(0, work);
  });

  const subscriptionObserver = new MutationObserver(() => scheduleRefresh(32, { structure: true }));
  function updateSubscriptionObservation() {
    subscriptionObserver.disconnect();
    if (!state.settings.enabled || document.hidden) return;
    document.querySelectorAll('ytd-subscribe-button-renderer, yt-subscribe-button-view-model').forEach((root) => {
      subscriptionObserver.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["subscribed", "aria-label", "aria-pressed", "aria-hidden", "hidden", "class", "style"] });
    });
  }

  function updateObservation() {
    observer.disconnect();
    if (state.settings.enabled && !document.hidden && document.body) {
      const attributeFilter = ["href", "subscribed", "aria-pressed", "aria-checked"];
      if (isSubscriptionsPage() && state.settings.hideWatched) attributeFilter.push("style");
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter });
    }
    updateSubscriptionObservation();
    if (document.hidden) {
      clearTimeout(scanTimer);
      scanTimer = null;
      clearTimeout(subscriptionSyncTimer);
      subscriptionSyncTimer = null;
      pendingCards.clear();
      pendingFullRefresh = true;
      pendingStructureRefresh = true;
    }
  }

  async function init() {
    const reading = readState();
    if (!document.body) await new Promise(resolve => {
      const waiting = new MutationObserver(() => { if (document.body) { waiting.disconnect(); resolve(); } });
      waiting.observe(document, { childList: true, subtree: true });
    });
    makeShell();
    await reading;
    syncActiveGroupFromLocation();
    refreshFromState();
    globalThis.ChanlumeStartup?.finish();
    scheduleSubscriptionSync();
    applyFilters();
    updateObservation();
    document.addEventListener("yt-navigate-finish", () => {
      subscriptionSyncFailures = 0;
      if (location.pathname !== "/feed/channels") scanIdentityByAlias.clear();
      updateObservation();
      pendingCards.clear();
      syncActiveGroupFromLocation();
      scheduleRefresh(0, { full: true, structure: true });
    });
    document.addEventListener("yt-navigate-start", () => { home.clear(); watch.clear(); });
    window.addEventListener("hashchange", () => { syncActiveGroupFromLocation(); scheduleRefresh(0, { full: true }); });
    window.addEventListener("popstate", () => { syncActiveGroupFromLocation(); scheduleRefresh(0, { full: true }); });
    document.addEventListener("click", (event) => {
      if (!state.settings.enabled) return;
      if (event.isTrusted && event.target.closest(".ytp-autonav-toggle-button")) autoplayRestore = null;
      const button = event.target.closest("button");
      if (!button) return;
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`;
      if (/subscribe|unsubscribe|訂閱|订阅/i.test(label) && !button.closest("#chanlume-channel-control")) scheduleSubscriptionSync();
    }, true);
    document.addEventListener("visibilitychange", () => {
      updateObservation();
      if (!document.hidden) scheduleRefresh(0, { full: true, structure: true });
    });
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") setCurrentMenuOpen(document.getElementById("chanlume-channel-control"), false); });
    document.addEventListener("click", (event) => { if (!event.target.closest('#chanlume-channel-control')) setCurrentMenuOpen(document.getElementById("chanlume-channel-control"), false); });
    window.addEventListener("resize", () => setCurrentMenuOpen(document.getElementById("chanlume-channel-control"), false));
    document.addEventListener("scroll", (event) => { if (!(event.target instanceof Element) || !event.target.closest('.cl-current-menu')) setCurrentMenuOpen(document.getElementById("chanlume-channel-control"), false); }, true);
    if (state.settings.enabled && location.pathname === "/feed/channels" && location.hash === "#chanlume-update-subscriptions") startupScanTimer = setTimeout(runSubscriptionUpdate, 900);
  }

  init().catch(error => { navigation.clear(); subscriptions.clear(); favorites.clear(); globalThis.ChanlumeStartup?.release(); console.warn("Chanlume initialization failed", error); });
})();
