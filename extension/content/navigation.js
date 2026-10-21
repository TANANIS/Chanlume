(function () {
  "use strict";
  // YouTube navigation shell. State ownership stays in the background worker.
  globalThis.createChanlumeNavigation = (context) => {
    const { Core, favorites, subscriptions, isSubscriptionsPage, pageKind,
      openSubscriptionGroup, escapeHtml, localizeExtensionUi, currentLanguage,
      unfiledChannelIds, changeSetting, startSubscriptionUpdate, toast } = context;
    let state, activeGroupId, guideCollapsed = true, channelsExpanded = false, exploreExpanded = false;
    const label = (text) => escapeHtml(Core.translateUiText(text, currentLanguage()));
    const glyph = name => ({chevron:1,home:1,explore:1,shorts:1,history:1,clock:1,heart:1,playlists:1,collections:1,subscriptions:1,settings:1})[name] ? globalThis.chanlumeDesignIcon(name) : Core.iconSvg(name,"currentColor",24);
    function navLink(name, href, icon, selected = false) {
      return `<a class="cl-guide-item ${selected ? "cl-active" : ""}" href="${escapeHtml(href)}" ${selected ? 'aria-current="page"' : ''}><span class="cl-guide-dot">${glyph(icon)}</span><span class="cl-guide-name">${label(name)}</span></a>`;
    }
    function navAction(name, action, icon, selected = false) {
      return `<button class="cl-guide-item ${selected ? "cl-active" : ""}" data-cl-action="${action}" type="button" ${selected ? 'aria-current="page"' : ''}><span class="cl-guide-dot">${glyph(icon)}</span><span class="cl-guide-name">${label(name)}</span></button>`;
    }
    const distractionSettings = [
      ["封鎖首頁", "blockHome"],
      ["關閉 Shorts", "hideShorts"],
      ["隱藏影片右側欄", "hideSecondary"],
      ["關閉自動播放", "disableAutoplay"],
      ["隱藏已觀看影片", "hideWatched"]
    ];
    function distractionMarkup() {
      const switches = distractionSettings.map(([name, setting]) => `<div class="cl-nav-setting-row"><span class="cl-nav-setting-label">${label(name)}</span><button class="cl-nav-switch" type="button" role="switch" data-cl-setting="${setting}" aria-label="${label(name)}" aria-checked="${Boolean(state.settings[setting])}"><span aria-hidden="true"></span></button></div>`).join("");
      return `<details class="cl-nav-distractions" data-dom-key="nav-distractions"><summary><span>${label("減少干擾")}</span><span class="cl-nav-chevron" aria-hidden="true">⌄</span></summary><div class="cl-nav-distraction-list">${switches}</div></details><a class="cl-nav-support" href="https://buymeacoffee.com/tananis" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">☕</span><span>${label("支持與回饋 ↗")}</span></a>`;
    }
    function nativeExploreLinks() {
      return [...document.querySelectorAll('ytd-guide-renderer #sections a[href]')].filter(a =>
        !a.closest('#chanlume-guide-section') && /^(\/channel\/UC-9-kyTW8ZkZNDHQJ6FgpwQ|\/feed\/(storefront|hype|trending|gaming|sports|news))(\?|$)/.test(a.getAttribute('href'))
      ).slice(0, 8).map(a => [a.textContent.trim(), a.getAttribute('href')]);
    }
    function sidebarMarkup() {
      const path = location.pathname, url = path + location.search;
      const native = (name, href, icon) => navLink(name, href, icon, url === href);
      const explore = nativeExploreLinks().map(([name, href]) => `<a class="cl-guide-item cl-nav-child" href="${escapeHtml(href)}" ${url === href ? 'aria-current="page"' : ''}><span class="cl-guide-name" translate="no">${escapeHtml(name)}</span></a>`).join('');
      const channels = Object.values(state.channels).slice(0, 12).map(channel => {
        let href; try { const u = new URL(channel.url); if (u.hostname !== 'www.youtube.com' || !/^\/(?:@[^/]+|channel\/UC[\w-]+)$/.test(u.pathname)) return ''; href = u.pathname; } catch (_) { return ''; }
        return `<a class="cl-guide-item cl-nav-child" href="${escapeHtml(href)}"><span class="cl-guide-name" translate="no">${escapeHtml(channel.name)}</span></a>`;
      }).join('');
return `<nav aria-label="${label('主要導覽')}"><div class="cl-nav-block">${state.settings.blockHome ? '' : native('首頁', '/', 'home')}${explore ? `<button class="cl-guide-item" data-cl-action="toggle-explore" type="button" aria-expanded="${exploreExpanded}"><span class="cl-guide-dot">${glyph('explore')}</span><span class="cl-guide-name">${label('探索')}</span><span aria-hidden="true">${exploreExpanded ? '⌃' : '⌄'}</span></button><div ${exploreExpanded ? '' : 'hidden'}>${explore}</div>` : ''}${state.settings.hideShorts ? '' : native('Shorts', '/shorts/', 'shorts')}</div><div class="cl-nav-block">${native('觀看記錄', '/feed/history', 'history')}${native('稍後觀看', '/playlist?list=WL', 'clock')}${native('喜歡的影片', '/playlist?list=LL', 'heart')}${native('播放清單', '/feed/playlists', 'playlists')}</div><div class="cl-guide-heading"><button class="cl-nav-collection-link ${subscriptions.isCollections() ? 'cl-active' : ''}" data-cl-action="collections" type="button" ${subscriptions.isCollections() ? 'aria-current="page"' : ''}>${glyph('collections')}<span>${label('群組收藏')}</span></button><button class="cl-guide-toggle" data-cl-action="toggle-guide" type="button"><span aria-hidden="true">${glyph("chevron")}</span></button></div><div class="cl-guide-list">${groupButtons('cl-guide-item')}</div><div class="cl-nav-subscriptions"><div class="cl-nav-heading">${navAction('訂閱內容', 'subscriptions', 'subscriptions', isSubscriptionsPage() && !favorites.active() && !subscriptions.isCollections() && activeGroupId === 'all')}<button class="cl-nav-disclosure" data-cl-action="toggle-channels" type="button" aria-label="${label(channelsExpanded ? '收合訂閱頻道' : '展開訂閱頻道')}" aria-expanded="${channelsExpanded}">${channelsExpanded ? '⌃' : '⌄'}</button></div><div ${channelsExpanded ? '' : 'hidden'}><button class="cl-guide-item cl-nav-child" data-cl-group="unfiled" type="button" ${isSubscriptionsPage() && activeGroupId === 'unfiled' && !favorites.active() && !subscriptions.isCollections() ? 'aria-current="page"' : ''}><span class="cl-guide-name">${label('未分類')}</span><span class="cl-guide-count">${unfiledChannelIds().length}</span></button>${channels}${navAction('所有訂閱頻道', 'directory', 'subscriptions')}<div class="cl-favorite-entry">${navAction('最關注頻道', 'favorites', 'star', favorites.active())}</div></div></div><details class="cl-nav-settings" data-dom-key="nav-settings"><summary>${glyph("settings")}<span>Chanlume</span></summary><div>${navAction('更新訂閱內容', 'update-subscriptions', 'sparkles')}${navAction('群組與設定', 'manage', 'settings')}${distractionMarkup()}</div></details></nav>`;
    }
  function integratedSignature() {
    return JSON.stringify({
      activeGroupId,
      favorites: favorites.active(),
      collections: subscriptions.isCollections(),
      groups: state.groups.map((group) => [group.id, group.name, group.icon, group.color, group.channelIds.length]),
      channels: Object.keys(state.channels).length,
      settings: state.settings,
      page: location.pathname + location.search,
      language: currentLanguage(),
      channelLinks: Object.values(state.channels).slice(0, 12).map(c => [c.name, c.url]),
      explore: nativeExploreLinks(), guideCollapsed, channelsExpanded, exploreExpanded
    });
  }

  function groupButtons(className) {
    const all = { id: "all", name: "全部", icon: "star", color: "#7c5cff", channelIds: Object.keys(state.channels) };
    const unfiled = { id: "unfiled", name: "未分類", icon: "sparkles", color: "#f0a44b", channelIds: unfiledChannelIds() };
    return [all, unfiled, ...state.groups].map((group) => {
      if (className === "cl-guide-item") {
        if (group.id === 'all' || group.id === 'unfiled') return '';
        return `<button class="cl-guide-item ${isSubscriptionsPage() && !favorites.active() && !subscriptions.isCollections() && group.id === activeGroupId ? "cl-active" : ""}" data-cl-group="${escapeHtml(group.id)}" type="button"><span class="cl-guide-dot" style="color:${group.color};background:${group.color}20">${Core.iconSvg(group.icon, "currentColor", 15)}</span><span class="cl-guide-name">${escapeHtml(group.id === "all" ? "全部訂閱" : group.name)}</span><span class="cl-guide-count">${group.channelIds.length}</span></button>`;
      }
      const selected = isSubscriptionsPage() && !favorites.active() && !subscriptions.isCollections() && group.id === activeGroupId;
      const name = ["all", "unfiled"].includes(group.id) ? Core.translateUiText(group.name, currentLanguage()) : group.name;
      return `<button class="cl-toolbar-chip ${selected ? "cl-active" : ""}" data-cl-group="${escapeHtml(group.id)}" type="button" aria-pressed="${selected}" title="${escapeHtml(name)} · ${group.channelIds.length} ${Core.translateUiText("個頻道", currentLanguage())}"><span class="cl-chip-dot" style="background:${group.color}"></span><span translate="no">${escapeHtml(name)}</span><small>${group.channelIds.length}</small></button>`;
    }).join("");
  }

  function mountIntegratedControls() {
    const guideSections = document.querySelector("ytd-guide-renderer #sections");
    if (guideSections && !document.getElementById("chanlume-guide-section")) {
      const section = document.createElement("section");
      section.id = "chanlume-guide-section";
      section.addEventListener("click", onIntegratedClick);
      guideSections.prepend(section);
    }
    guideSections?.classList.add('chanlume-guide-replaced');
    const mini = document.querySelector('ytd-mini-guide-renderer #items') || document.querySelector('ytd-mini-guide-renderer');
    if (mini && !document.getElementById('chanlume-mini-guide')) {
      const section = document.createElement('nav'); section.id = 'chanlume-mini-guide';
      section.addEventListener('click', onIntegratedClick); mini.prepend(section);
    }
    mini?.classList.add('chanlume-mini-replaced');
    document.documentElement.classList.toggle('chanlume-navigation-active', Boolean(guideSections));

    if (!isSubscriptionsPage()) document.getElementById("chanlume-toolbar")?.remove();
    const browse = isSubscriptionsPage() ? document.querySelector('ytd-browse[page-subtype="subscriptions"]') : null;
    const primary = browse?.querySelector("#primary");
    if (primary && !document.getElementById("chanlume-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.id = "chanlume-toolbar";
      toolbar.addEventListener("click", onIntegratedClick);
      primary.insertBefore(toolbar, primary.firstChild);
    }
    const visibleGuide = document.getElementById("chanlume-guide-section");
    document.documentElement.classList.toggle("chanlume-integrated", Boolean(visibleGuide || document.getElementById("chanlume-toolbar")));
  }

  function renderIntegratedControls() {
    if (!state.settings.enabled) return;
    mountIntegratedControls();
    favorites.render();
    subscriptions.render();
    const signature = integratedSignature();
    const guide = document.getElementById("chanlume-guide-section");
    if (guide && guide.dataset.signature !== signature) {
      guide.dataset.signature = signature;
      globalThis.ChanlumeDom.patch(guide, sidebarMarkup());
      localizeExtensionUi(guide);
    }
    const mini = document.getElementById('chanlume-mini-guide');
    if (mini && mini.dataset.signature !== signature) {
      mini.dataset.signature = signature;
      globalThis.ChanlumeDom.patch(mini, `${state.settings.blockHome ? '' : navLink('首頁', '/', 'home', location.pathname === '/')}${state.settings.hideShorts ? '' : navLink('Shorts', '/shorts/', 'shorts', location.pathname.startsWith('/shorts'))}${navAction('群組收藏', 'collections', 'collections', subscriptions.isCollections())}${navAction('訂閱內容', 'subscriptions', 'subscriptions', isSubscriptionsPage() && !favorites.active() && !subscriptions.isCollections() && activeGroupId === 'all')}${navAction('最關注頻道', 'favorites', 'star', favorites.active())}`);
    }
    if (guide) {
      guide.classList.toggle("cl-collapsed", guideCollapsed);
      const toggle = guide.querySelector(".cl-guide-toggle");
      const toggleLabel = Core.translateUiText(guideCollapsed ? "展開 Chanlume 群組" : "收合 Chanlume 群組", currentLanguage());
      toggle?.setAttribute("aria-expanded", String(!guideCollapsed));
      toggle?.setAttribute("title", toggleLabel);
      toggle?.setAttribute("aria-label", toggleLabel);
    }
    const toolbar = document.getElementById("chanlume-toolbar");
    if (toolbar && toolbar.dataset.signature !== signature) {
      toolbar.dataset.signature = signature;
      const scrollLeft = toolbar.querySelector('.cl-toolbar-groups')?.scrollLeft || 0;
      toolbar.querySelector('dialog')?.close();
      globalThis.ChanlumeDom.patch(toolbar, `<button class="cl-toolbar-action" data-cl-action="scroll-left" type="button" aria-label="向左捲動群組">‹</button><div class="cl-toolbar-groups" role="group" aria-label="訂閱群組">${groupButtons("cl-toolbar-chip")}</div><button class="cl-toolbar-action" data-cl-action="scroll-right" type="button" aria-label="向右捲動群組">›</button><div class="cl-toolbar-tools"><button class="cl-toolbar-search" data-cl-action="find-group" type="button">搜尋群組</button><button class="cl-toolbar-action" data-cl-action="manage" type="button" title="管理群組" aria-label="開啟 Chanlume 群組與設定">${Core.iconSvg("book", "currentColor", 18)}</button></div><dialog class="cl-group-picker" aria-labelledby="cl-group-picker-title"><header><h2 id="cl-group-picker-title">訂閱群組</h2><button class="cl-button" data-cl-action="close-picker" type="button">關閉</button></header><input class="cl-group-search" type="search" placeholder="搜尋群組" aria-label="搜尋群組"><div class="cl-group-picker-list">${groupButtons("cl-toolbar-chip").replaceAll('data-cl-group=', 'data-cl-pick-group=')}</div></dialog>`);
      localizeExtensionUi(toolbar);
      const strip = toolbar.querySelector('.cl-toolbar-groups');
      strip.scrollLeft = scrollLeft;
      const activeChip = strip.querySelector('.cl-active');
      if (activeChip) {
        const chipRect = activeChip.getBoundingClientRect(), stripRect = strip.getBoundingClientRect();
        if (chipRect.left < stripRect.left) strip.scrollLeft += chipRect.left - stripRect.left;
        else if (chipRect.right > stripRect.right) strip.scrollLeft += chipRect.right - stripRect.right;
      }
      toolbar.querySelector('.cl-group-search').oninput = (event) => {
        const query = event.target.value.trim().toLocaleLowerCase();
        toolbar.querySelectorAll('[data-cl-pick-group]').forEach((button) => { button.hidden = !button.textContent.toLocaleLowerCase().includes(query); });
      };
    }
  }

  async function onIntegratedClick(event) {
    const picked = event.target.closest('[data-cl-pick-group]')?.dataset.clPickGroup;
    if (picked) { document.querySelector('#chanlume-toolbar dialog')?.close(); openSubscriptionGroup(picked); return; }
    const groupId = event.target.closest("[data-cl-group]")?.dataset.clGroup;
    const action = event.target.closest("[data-cl-action]")?.dataset.clAction;
    if (action === 'directory') { subscriptions.navigateChannels(); return; }
    const setting = event.target.closest("[data-cl-setting]")?.dataset.clSetting;
    if (action === 'subscriptions') { openSubscriptionGroup('all'); return; }
    if (action === 'toggle-channels') { channelsExpanded = !channelsExpanded; renderIntegratedControls(); return; }
    if (action === 'toggle-explore') { exploreExpanded = !exploreExpanded; renderIntegratedControls(); return; }
    if (action === "collections") { subscriptions.navigateCollections(); return; }
    if (action === "find-group") { document.querySelector('#chanlume-toolbar dialog')?.showModal(); return; }
    if (action === "close-picker") { document.querySelector('#chanlume-toolbar dialog')?.close(); return; }
    if (action === "scroll-left" || action === "scroll-right") {
      const strip = document.querySelector('.cl-toolbar-groups');
      strip?.scrollBy({ left: strip.clientWidth * (action === "scroll-left" ? -.7 : .7), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? "instant" : "smooth" });
      return;
    }
    if (groupId) {
      openSubscriptionGroup(groupId);
      return;
    }
    if (setting) {
      const button=event.target.closest('[data-cl-setting]');
      button.disabled=true;
      try { await changeSetting(setting, !state.settings[setting]); }
      catch (_) { toast('儲存失敗，請重試。'); }
      finally { button.disabled=false; }
      return;
    }
    if (action === "favorites") {
      if (!isSubscriptionsPage()) { location.assign("https://www.youtube.com/feed/subscriptions#chanlume-view=favorites"); return; }
      location.hash = "chanlume-view=favorites";
      renderIntegratedControls();
      return;
    }
    if (action === "toggle-guide") {
      guideCollapsed = !guideCollapsed;
      renderIntegratedControls();
      return;
    }
    if (action === "manage") chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    if (action === "update-subscriptions") await startSubscriptionUpdate();
  }

    return {
      clear() {
        document.getElementById('chanlume-guide-section')?.remove();
        document.getElementById('chanlume-mini-guide')?.remove();
        document.querySelectorAll('.chanlume-guide-replaced, .chanlume-mini-replaced').forEach(node => node.classList.remove('chanlume-guide-replaced', 'chanlume-mini-replaced'));
        document.documentElement.classList.remove('chanlume-navigation-active');
      },
      render() {
        state = context.getState();
        activeGroupId = context.getActiveGroup();
        renderIntegratedControls();
      }
    };
  };
})();
