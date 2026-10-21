(function () {
  "use strict";

  // YouTube remains the source of all watch-page facts and actions. This
  // module only surfaces the same accessible facts beside the owner/actions;
  // it never guesses a publication date or replaces an interactive renderer.
  globalThis.createChanlumeWatch = ({ Core, getState }) => {
    let facts = null;
    let watchedMetadata = null;
    let sideTabs = null;
    let chatSizeObserver = null;
    let observedPlayer = null;
    let observedTabs = null;
    let observedWatch = null;
    let sizedChatFrame = null;
    let sizedWatch = null;
    const labelObserver = new MutationObserver(() => render());
    const label = node => node?.getAttribute("aria-label")?.replace(/\s+/g, " ").trim() || "";

    // YouTube can retain multiple transcript renderers (including hidden
    // legacy panels). Prefer the one the user is actually viewing.
    const transcriptPanel = () => {
      const panels = [...document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]')];
      return panels.find(panel => panel.getAttribute("visibility") === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED") || panels[0] || null;
    };
    const transcriptButton = () => [...document.querySelectorAll('ytd-video-description-transcript-section-renderer button')]
      .find(button => !button.disabled && button.getAttribute("aria-disabled") !== "true" &&
        /transcript|轉錄稿|文字記錄|文字稿|逐字稿|字幕紀錄|字幕記錄/i.test(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`));
    const chatFrame = () => document.querySelector('ytd-watch-flexy:not([hidden]) ytd-live-chat-frame');
    const chatButton = () => chatFrame()?.querySelector('#show-hide-button button');
    const panelIsOpen = panel => panel?.getAttribute("visibility") === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED";
    const closeNativeTranscript = () => {
      const panel = transcriptPanel();
      if (!panelIsOpen(panel)) return;
      panel.querySelector('button[aria-label*="Close" i], button[aria-label*="關閉"], #close-button button')?.click();
    };
    const collapseNativeChat = () => {
      const frame = chatFrame();
      if (frame && !frame.hasAttribute("collapsed")) chatButton()?.click();
    };

    // YouTube may publish manually provided or automatically generated
    // captions. Its own "Show transcript" action is our source of truth;
    // never request a separate caption track or invent missing subtitles.
    const hasNativeTranscript = () => Boolean(transcriptButton() || panelIsOpen(transcriptPanel()));

    function clearChatHeight() {
      sizedChatFrame?.style.removeProperty("--cl-watch-chat-height");
      sizedChatFrame = null;
    }

    function clearSideHeight() {
      sizedWatch?.style.removeProperty("--cl-watch-side-height");
      sizedWatch = null;
    }

    function stopChatSizing() {
      chatSizeObserver?.disconnect();
      observedPlayer = null;
      observedTabs = null;
      observedWatch = null;
      clearChatHeight();
      clearSideHeight();
    }

    function updateChatHeight() {
      const watch = document.querySelector('ytd-watch-flexy:not([hidden])');
      const frame = chatFrame();
      const theaterOrFullScreen = watch?.hasAttribute("theater") || watch?.hasAttribute("fullscreen") || Boolean(document.fullscreenElement);
      const stacked = window.matchMedia?.("(max-width: 1015px)")?.matches;
      if (!watch || !sideTabs?.isConnected || theaterOrFullScreen || stacked || !getState().settings.enabled) {
        clearChatHeight();
        clearSideHeight();
        return;
      }
      const player = observedPlayer;
      const playerHeight = player?.getBoundingClientRect().height || 0;
      if (playerHeight < 150) { clearChatHeight(); clearSideHeight(); return; }
      const tabStyle = getComputedStyle(sideTabs);
      const tabHeight = sideTabs.getBoundingClientRect().height +
        (parseFloat(tabStyle.marginTop) || 0) + (parseFloat(tabStyle.marginBottom) || 0);
      // The complete tabs + chat region fits the currently displayed player.
      const height = Math.max(120, Math.round(playerHeight - tabHeight));
      if (sizedWatch !== watch) clearSideHeight();
      sizedWatch = watch;
      if (watch.style.getPropertyValue("--cl-watch-side-height") !== `${height}px`) {
        watch.style.setProperty("--cl-watch-side-height", `${height}px`);
      }
      if (!frame || frame.hasAttribute("collapsed")) { clearChatHeight(); return; }
      if (sizedChatFrame !== frame) clearChatHeight();
      sizedChatFrame = frame;
      const value = `${height}px`;
      if (frame.style.getPropertyValue("--cl-watch-chat-height") !== value) frame.style.setProperty("--cl-watch-chat-height", value);
    }

    function syncChatSizing() {
      const watch = document.querySelector('ytd-watch-flexy:not([hidden])');
      const player = watch?.querySelector('#player-container-outer, #player, ytd-player, #movie_player');
      if (!watch || !player || !sideTabs?.isConnected || getState().settings.hideSecondary) {
        stopChatSizing();
        return;
      }
      if (typeof ResizeObserver === "function" && (!chatSizeObserver || player !== observedPlayer || sideTabs !== observedTabs || watch !== observedWatch)) {
        if (!chatSizeObserver) chatSizeObserver = new ResizeObserver(updateChatHeight);
        chatSizeObserver.disconnect();
        chatSizeObserver.observe(player);
        chatSizeObserver.observe(sideTabs);
        chatSizeObserver.observe(watch);
      }
      observedPlayer = player;
      observedTabs = sideTabs;
      observedWatch = watch;
      updateChatHeight();
    }

    function renderSidebar() {
      const container = document.querySelector('ytd-watch-flexy:not([hidden]) #secondary #secondary-inner');
      if (!container || getState().settings.hideSecondary) {
        stopChatSizing();
        sideTabs?.remove();
        sideTabs = null;
        document.querySelectorAll('ytd-watch-flexy[data-chanlume-watch-panel]').forEach(node => delete node.dataset.chanlumeWatchPanel);
        return;
      }
      if (!sideTabs) {
        sideTabs = document.createElement("div");
        sideTabs.id = "chanlume-watch-side-tabs";
        sideTabs.setAttribute("role", "group");
        sideTabs.addEventListener("click", event => {
          const button = event.target.closest("button[data-cl-watch-panel]");
          if (!button || button.disabled) return;
          if (button.dataset.clWatchPanel === "transcripts") {
            collapseNativeChat();
            if (!panelIsOpen(transcriptPanel())) transcriptButton()?.click();
          } else if (button.dataset.clWatchPanel === "chat") {
            closeNativeTranscript();
            if (chatFrame()?.hasAttribute("collapsed")) chatButton()?.click();
          }
          else {
            closeNativeTranscript();
            collapseNativeChat();
          }
          setTimeout(renderSidebar, 100);
        });
      }
      const isChinese = String(getState().settings.language || "").toLowerCase().startsWith("zh");
      // Some ordinary Watch pages do not have YouTube chat at all. Do not
      // reserve an inert third tab in that case; chat remains native-owned.
      const nativeChatButton = chatButton();
      const hasNativeChat = Boolean(nativeChatButton && !nativeChatButton.disabled && nativeChatButton.getAttribute("aria-disabled") !== "true");
      // An existing tab can contain both panels from a previous injected
      // version. Transcript takes precedence so the right column never
      // stacks a second full-height chat beneath it.
      if (panelIsOpen(transcriptPanel()) && !chatFrame()?.hasAttribute("collapsed")) collapseNativeChat();
      const options = [
        ["suggestions", isChinese ? "推薦" : "Suggestions", true],
        ...(hasNativeTranscript() ? [["transcripts", isChinese ? "逐字稿" : "Transcripts", true]] : []),
        ...(hasNativeChat ? [["chat", isChinese ? "聊天室" : "Live Chat", true]] : [])
      ];
      const visiblePanels = new Set(options.map(([id]) => id));
      sideTabs.querySelectorAll("button[data-cl-watch-panel]").forEach(button => {
        if (!visiblePanels.has(button.dataset.clWatchPanel)) button.remove();
      });
      sideTabs.style.setProperty("--cl-watch-tab-count", String(options.length));
      const actualCurrent = panelIsOpen(transcriptPanel()) ? "transcripts"
        : hasNativeChat && !chatFrame().hasAttribute("collapsed") ? "chat" : "suggestions";
      const current = visiblePanels.has(actualCurrent) ? actualCurrent : "suggestions";
      const watch = container.closest('ytd-watch-flexy');
      if (watch?.dataset.chanlumeWatchPanel !== current) watch.dataset.chanlumeWatchPanel = current;
      let previousButton = null;
      for (const [id, title, available] of options) {
        let button = sideTabs.querySelector(`button[data-cl-watch-panel="${id}"]`);
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.dataset.clWatchPanel = id;
          sideTabs.append(button);
        }
        // The set can change asynchronously when YouTube reveals captions or
        // chat. Restore visual/keyboard order without moving every DOM node
        // on each render (which would provoke the page mutation scheduler).
        const next = previousButton ? previousButton.nextElementSibling : sideTabs.firstElementChild;
        if (next !== button) sideTabs.insertBefore(button, next);
        previousButton = button;
        button.textContent = title;
        button.disabled = !available;
        button.setAttribute("aria-pressed", String(id === current));
        button.title = available ? title : isChinese ? "目前沒有可用的原生內容" : "No native content available";
      }
      sideTabs.setAttribute("aria-label", isChinese ? "影片側邊面板" : "Video side panels");
      if (sideTabs.parentElement !== container || sideTabs !== container.firstElementChild) container.prepend(sideTabs);
      syncChatSizing();
    }

    function clear() {
      labelObserver.disconnect();
      watchedMetadata = null;
      stopChatSizing();
      facts?.remove();
      facts = null;
      sideTabs?.remove();
      sideTabs = null;
      document.querySelectorAll('ytd-watch-flexy[data-chanlume-watch-panel]').forEach(node => delete node.dataset.chanlumeWatchPanel);
      document.querySelectorAll(".cl-watch-native-fact").forEach(node => node.classList.remove("cl-watch-native-fact"));
      document.querySelectorAll("ytd-watch-metadata.chanlume-watch-meta").forEach(node => node.classList.remove("chanlume-watch-meta"));
      document.documentElement.classList.remove("chanlume-watch-layout", "chanlume-watch-enhanced");
    }

    function render() {
      if (!getState().settings.enabled || location.pathname !== "/watch") { clear(); return; }
      const metadata = document.querySelector("ytd-watch-flexy:not([hidden]) ytd-watch-metadata.watch-active-metadata")
        || document.querySelector("ytd-watch-flexy:not([hidden]) ytd-watch-metadata");
      if (!metadata) { clear(); return; }
      document.documentElement.classList.add("chanlume-watch-enhanced");
      renderSidebar();
      // YouTube mounts metadata and then fills its facts asynchronously. Watch
      // its native subtree even when the first render has no numbers yet.
      if (watchedMetadata !== metadata) {
        labelObserver.disconnect();
        watchedMetadata = metadata;
        labelObserver.observe(metadata, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label"] });
      }
      const row = metadata?.querySelector("#top-row");
      const info = metadata?.querySelector("ytd-watch-info-text");
      // Newer YouTube builds can leave the two aria-labels blank while rendering
      // verified facts as the first two native #info spans. Never parse rolling
      // digits or infer publication dates from the player's internal payload.
      const nativeFacts = [...(info?.querySelectorAll("#info > span") || [])]
        .filter(node => node.textContent.trim());
      const nativeViews = nativeFacts.length >= 2 ? nativeFacts[0] : null;
      const nativeDate = nativeFacts.length >= 2 ? nativeFacts[1] : null;
      const views = label(info?.querySelector("#view-count")) || nativeViews?.textContent.trim() || "";
      const date = label(info?.querySelector("#date-text")) || nativeDate?.textContent.trim() || "";
      if (!row || !info || !views || !date) {
        facts?.remove();
        facts = null;
        document.querySelectorAll(".cl-watch-native-fact").forEach(node => node.classList.remove("cl-watch-native-fact"));
        metadata.classList.remove("chanlume-watch-meta");
        document.documentElement.classList.remove("chanlume-watch-layout");
        return;
      }

      if (facts && facts.parentElement !== row) { facts.remove(); facts = null; }
      if (!facts) {
        facts = document.createElement("div");
        facts.id = "chanlume-watch-facts";
        facts.setAttribute("role", "group");
        facts.setAttribute("aria-label", Core.translateUiText("影片資訊", getState().settings.language));
        facts.innerHTML = `
          <span class="cl-watch-views">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <span class="cl-watch-value"></span>
          </span>
          <span class="cl-watch-date">
            <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path></svg>
            <span class="cl-watch-value"></span>
          </span>
        `;
        row.insertBefore(facts, row.querySelector("#actions"));
      }
      const viewLabel = facts.querySelector(".cl-watch-views .cl-watch-value");
      const dateLabel = facts.querySelector(".cl-watch-date .cl-watch-value");
      const groupLabel = Core.translateUiText("影片資訊", getState().settings.language);
      if (facts.getAttribute("aria-label") !== groupLabel) facts.setAttribute("aria-label", groupLabel);
      if (viewLabel.textContent !== views) viewLabel.textContent = views;
      if (dateLabel.textContent !== date) dateLabel.textContent = date;
      document.querySelectorAll(".cl-watch-native-fact").forEach(node => node.classList.remove("cl-watch-native-fact"));
      if (!label(info?.querySelector("#view-count"))) nativeViews?.classList.add("cl-watch-native-fact");
      if (!label(info?.querySelector("#date-text"))) nativeDate?.classList.add("cl-watch-native-fact");

      document.querySelectorAll("ytd-watch-metadata.chanlume-watch-meta").forEach(node => {
        if (node !== metadata) node.classList.remove("chanlume-watch-meta");
      });
      metadata.classList.add("chanlume-watch-meta");
      document.documentElement.classList.add("chanlume-watch-layout");
    }

    return { render, clear };
  };
})();
