const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, "playwright"));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(6000);

  try {
    await page.goto("http://127.0.0.1:18766/tests/content-harness.html");
    await page.waitForFunction(() => !document.documentElement.classList.contains("chanlume-disabled"));
    await page.evaluate(() => {
      const styles = document.createElement("style");
      styles.textContent = `
        ytd-watch-flexy { display: block; max-width: 1200px; width: 100%; }
        ytd-watch-flexy #player { display: block; width: 700px; height: 420px; }
        ytd-live-chat-frame { display: block; }
        #secondary-inner > #panels { display: flex; }
        #panels > ytd-engagement-panel-section-list-renderer { display: block; width: 100%; }
        #panels > ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"] { display: none; }
        ytd-watch-metadata, ytd-watch-info-text { display: block; }
        ytd-watch-metadata #title-row { font-size: 22px; margin-bottom: 16px; }
        ytd-watch-metadata #top-row { display: flex; min-width: 0; }
        ytd-watch-metadata #owner, ytd-watch-metadata #actions { display: flex; align-items: center; gap: 8px; }
        ytd-watch-metadata #description { margin-top: 16px; padding: 16px; }
      `;
      document.head.append(styles);
      document.body.insertAdjacentHTML("beforeend", `
        <ytd-watch-flexy>
          <div id="player" data-native-player>Native video player</div>
          <div id="columns"><div id="primary">
            <ytd-watch-metadata class="watch-active-metadata">
              <div id="title-row"><div id="title"><h1>Native video title</h1></div></div>
              <div id="top-row">
                <div id="owner"><a href="/@native">Native channel</a><button id="subscribe">Subscribe</button></div>
                <div id="actions"><button id="native-like">Like</button></div>
              </div>
              <div id="bottom-row"><div id="description">
                <ytd-watch-info-text><div id="info-container">
                  <div id="view-count" aria-label="1,234 views">0123456789 animated view digits</div>
                  <div id="date-text" aria-label="6 hours ago">9876543210 animated date digits</div>
                  <div id="info">Native tags and description</div>
                </div></ytd-watch-info-text>
              </div></div>
            </ytd-watch-metadata>
          </div>
          <div id="secondary"><div id="secondary-inner"><div id="related">Native suggestions</div></div></div>
          </div>
          <ytd-video-description-transcript-section-renderer><button id="native-transcript" aria-label="Show transcript (auto-generated captions)">Show transcript</button></ytd-video-description-transcript-section-renderer>
          <ytd-engagement-panel-section-list-renderer target-id="PAmodern_transcript_view" visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"></ytd-engagement-panel-section-list-renderer>
          <ytd-engagement-panel-section-list-renderer id="native-transcript-panel" target-id="engagement-panel-searchable-transcript" visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"><ytd-transcript-search-panel-renderer><ytd-transcript-search-box-renderer><button id="search-button" aria-label="Search transcript">Search transcript</button></ytd-transcript-search-box-renderer><div id="transcript-segments"><a id="native-transcript-timestamp" href="#t=15">0:15</a><span>Native subtitle content</span></div></ytd-transcript-search-panel-renderer><button id="close-native-transcript" aria-label="Close">Close</button></ytd-engagement-panel-section-list-renderer>
          <ytd-live-chat-frame collapsed><div id="show-hide-button"><button id="native-chat">Show chat</button></div><div id="chatframe"></div></ytd-live-chat-frame>
        </ytd-watch-flexy>
      `);
      // YouTube mounts transcript panels and native chat in secondary-inner,
      // not as unrelated page siblings. Reproduce that geometry for sizing.
      const secondary = document.querySelector('#secondary-inner');
      const panels = document.createElement('div');
      panels.id = 'panels';
      secondary.prepend(panels);
      document.querySelectorAll('ytd-engagement-panel-section-list-renderer').forEach(el => panels.append(el));
      const chatContainer = document.createElement('div');
      chatContainer.id = 'chat-container';
      secondary.insertBefore(chatContainer, secondary.querySelector('#related'));
      chatContainer.append(document.querySelector('ytd-live-chat-frame'));
      window.__likeCount = 0;
      window.__seekCount = 0;
      window.__nativeLike = document.querySelector("#native-like");
      window.__nativeLike.addEventListener("click", () => __likeCount++);
      document.querySelector("#native-transcript-timestamp").addEventListener("click", event => { event.preventDefault(); __seekCount++; });
      document.querySelector("#native-transcript").addEventListener("click", () =>
        document.querySelector('#native-transcript-panel').setAttribute("visibility", "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"));
      document.querySelector("#close-native-transcript").addEventListener("click", () =>
        document.querySelector('#native-transcript-panel').setAttribute("visibility", "ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"));
      document.querySelector("#native-chat").addEventListener("click", () =>
        document.querySelector("ytd-live-chat-frame").toggleAttribute("collapsed"));
      history.pushState({}, "", "/watch?v=native-video");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });

    await page.locator("#chanlume-watch-facts").waitFor();
    assert.deepEqual(await page.locator("#chanlume-watch-facts > span").allInnerTexts(), ["1,234 views", "6 hours ago"]);
    assert.deepEqual(await page.locator("#chanlume-watch-side-tabs button").allInnerTexts(), ["Suggestions", "Transcripts", "Live Chat"]);
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="transcripts"]').click();
    await page.waitForFunction(() => document.querySelector('#native-transcript-panel').getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
    await page.waitForFunction(() => document.querySelector('#chanlume-watch-side-tabs [data-cl-watch-panel="transcripts"]').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#related').evaluate(el => getComputedStyle(el).display), 'none', 'recommendations must not appear underneath transcripts');
    assert.equal(await page.locator('#search-button').evaluate(el => getComputedStyle(el).display), 'none', 'only transcript search should be hidden');
    assert.notEqual(await page.locator('ytd-transcript-search-panel-renderer').first().evaluate(el => getComputedStyle(el).display), 'none', 'native transcript segment container must stay visible');
    await page.waitForFunction(() => document.querySelector('ytd-watch-flexy')?.style.getPropertyValue('--cl-watch-side-height').endsWith('px'));
    assert.equal(await page.evaluate(() => {
      const panel = document.querySelector('#native-transcript-panel');
      const region = document.querySelector('#secondary-inner > #panels');
      const desired = parseFloat(document.querySelector('ytd-watch-flexy').style.getPropertyValue('--cl-watch-side-height'));
      return Math.abs(region.getBoundingClientRect().height - desired) <= 1 &&
        Math.abs(panel.getBoundingClientRect().height - desired + 16) <= 1;
    }), true, 'native transcript is bounded to the player-aligned right column');
    assert.equal(await page.locator('#transcript-segments').innerText(), '0:15Native subtitle content');
    await page.locator('#native-transcript-timestamp').click();
    assert.equal(await page.evaluate(() => __seekCount), 1, 'native subtitle timestamps remain interactive');
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="chat"]').click();
    await page.waitForFunction(() => document.querySelector('#native-transcript-panel').getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
    await page.waitForFunction(() => !document.querySelector('ytd-live-chat-frame').hasAttribute('collapsed'));
    assert.equal(await page.locator('#related').evaluate(el => getComputedStyle(el).display), 'none', 'recommendations must not appear underneath chat');
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="transcripts"]').click();
    await page.waitForFunction(() => document.querySelector('ytd-live-chat-frame').hasAttribute('collapsed'));
    await page.waitForFunction(() => document.querySelector('#native-transcript-panel').getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="suggestions"]').click();
    await page.waitForFunction(() => document.querySelector('#native-transcript-panel').getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
    await page.waitForFunction(() => document.querySelector('ytd-watch-flexy')?.dataset.chanlumeWatchPanel === 'suggestions');
    assert.notEqual(await page.locator('#related').evaluate(el => getComputedStyle(el).display), 'none', 'native recommendations return unchanged');
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="chat"]').click();
    await page.waitForFunction(() => !document.querySelector('ytd-live-chat-frame').hasAttribute('collapsed'));
    await page.waitForFunction(() => document.querySelector('ytd-live-chat-frame')?.style.getPropertyValue('--cl-watch-chat-height').endsWith('px'));
    assert.equal(await page.evaluate(() => {
      const player = document.querySelector('#player');
      const tabs = document.querySelector('#chanlume-watch-side-tabs');
      const chat = document.querySelector('ytd-live-chat-frame');
      const margin = getComputedStyle(tabs);
      const desired = parseFloat(chat.style.getPropertyValue('--cl-watch-chat-height'));
      return Math.abs(parseFloat(getComputedStyle(chat).height) - desired) <= 1 &&
        Math.abs(desired - (
        player.getBoundingClientRect().height - tabs.getBoundingClientRect().height -
        parseFloat(margin.marginTop) - parseFloat(margin.marginBottom)
      )) <= 1;
    }), true, 'expanded native chat and tabs fit the actual video player height');
    const originalChatHeight = await page.locator('ytd-live-chat-frame').evaluate(el =>
      parseFloat(el.style.getPropertyValue('--cl-watch-chat-height')));
    await page.locator('#player').evaluate(el => { el.style.height = '520px'; });
    await page.waitForFunction(previous => Math.abs(
      parseFloat(document.querySelector('ytd-live-chat-frame').style.getPropertyValue('--cl-watch-chat-height')) - previous - 100
    ) <= 1, originalChatHeight);
    await page.locator('ytd-watch-flexy').evaluate(el => { el.setAttribute('theater', ''); el.querySelector('#player').style.height = '620px'; });
    await page.waitForFunction(() => !document.querySelector('ytd-live-chat-frame').style.getPropertyValue('--cl-watch-chat-height'));
    await page.locator('ytd-watch-flexy').evaluate(el => { el.removeAttribute('theater'); el.querySelector('#player').style.height = '420px'; });
    await page.waitForFunction(() => document.querySelector('ytd-live-chat-frame').style.getPropertyValue('--cl-watch-chat-height').endsWith('px'));
    await page.locator('ytd-live-chat-frame').evaluate(el => el.remove());
    await page.waitForFunction(() => !document.querySelector('#chanlume-watch-side-tabs [data-cl-watch-panel="chat"]'));
    assert.deepEqual(await page.locator('#chanlume-watch-side-tabs button').allInnerTexts(), ['Suggestions', 'Transcripts']);
    assert.equal(await page.locator('#chanlume-watch-side-tabs').evaluate(el => el.style.getPropertyValue('--cl-watch-tab-count')), '2');
    await page.evaluate(() => {
      document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend', '<ytd-live-chat-frame collapsed><div id="show-hide-button"><button id="native-chat-return">Show chat</button></div></ytd-live-chat-frame>');
      document.querySelector('#native-chat-return').addEventListener('click', () => document.querySelector('ytd-live-chat-frame').toggleAttribute('collapsed'));
    });
    await page.locator('#chanlume-watch-side-tabs [data-cl-watch-panel="chat"]').waitFor();
    assert.equal(await page.locator('#chanlume-watch-side-tabs').evaluate(el => el.style.getPropertyValue('--cl-watch-tab-count')), '3');

    // A video without either manual or automatic YouTube captions must not
    // show an inert transcript tab. Auto-captions arriving late restore it.
    await page.evaluate(() => {
      document.querySelector('ytd-video-description-transcript-section-renderer').remove();
      document.querySelectorAll('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]').forEach(el => el.remove());
    });
    await page.waitForFunction(() => !document.querySelector('#chanlume-watch-side-tabs [data-cl-watch-panel="transcripts"]'));
    assert.deepEqual(await page.locator('#chanlume-watch-side-tabs button').allInnerTexts(), ['Suggestions', 'Live Chat']);
    await page.evaluate(() => {
      document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend', `
        <ytd-video-description-transcript-section-renderer><button id="native-auto-transcript" aria-label="Show transcript · auto-generated captions">Show transcript</button></ytd-video-description-transcript-section-renderer>
      `);
    });
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="transcripts"]').waitFor();
    assert.deepEqual(await page.locator('#chanlume-watch-side-tabs button').allInnerTexts(), ['Suggestions', 'Transcripts', 'Live Chat']);
    await page.evaluate(() => {
      document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend', `
        <ytd-engagement-panel-section-list-renderer id="native-transcript-panel" target-id="engagement-panel-searchable-transcript" visibility="ENGAGEMENT_PANEL_VISIBILITY_HIDDEN"><ytd-transcript-search-panel-renderer><ytd-transcript-search-box-renderer><button id="search-button" aria-label="Search transcript">Search transcript</button></ytd-transcript-search-box-renderer><div id="transcript-segments"><span>Native automatic subtitle content</span></div></ytd-transcript-search-panel-renderer></ytd-engagement-panel-section-list-renderer>
      `);
      document.querySelector('#native-auto-transcript').addEventListener('click', () =>
        document.querySelector('#native-transcript-panel').setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED'));
    });
    await page.locator('#chanlume-watch-side-tabs button[data-cl-watch-panel="transcripts"]').click();
    await page.waitForFunction(() => document.querySelector('#native-transcript-panel').getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
    assert.equal(await page.locator('#transcript-segments').innerText(), 'Native automatic subtitle content');
    assert.equal(await page.locator('#search-button').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator("#chanlume-watch-facts").getAttribute("aria-label"), "Video information");
    assert.equal(await page.locator("#title h1").innerText(), "Native video title");
    assert.equal(await page.locator("#owner a").innerText(), "Native channel");
    assert.equal(await page.locator("#info").innerText(), "Native tags and description");
    assert.equal(await page.locator("[data-native-player]").count(), 1);
    assert.equal(await page.locator("#view-count").evaluate(el => getComputedStyle(el).display), "none");
    assert.equal(await page.locator("#date-text").evaluate(el => getComputedStyle(el).display), "none");
    await page.locator("#native-like").click();
    assert.equal(await page.evaluate(() => __likeCount === 1 && __nativeLike === document.querySelector("#native-like")), true);

    // Labels can arrive after the renderer, and can change without a route event.
    await page.locator("#view-count").evaluate(el => el.setAttribute("aria-label", "2,345 views"));
    await page.locator(".cl-watch-views").getByText("2,345 views").waitFor();
    await page.locator("#date-text").evaluate(el => el.removeAttribute("aria-label"));
    await page.waitForFunction(() => !document.querySelector("#chanlume-watch-facts"));
    assert.notEqual(await page.locator("#view-count").evaluate(el => getComputedStyle(el).display), "none");
    await page.locator("#date-text").evaluate(el => el.setAttribute("aria-label", "7 hours ago"));
    await page.locator(".cl-watch-date").getByText("7 hours ago").waitFor();

    // Real YouTube sometimes renders empty aria-labels but has structured
    // native #info spans for the two facts. Never read rolling digits.
    await page.evaluate(() => {
      document.querySelector("#info").innerHTML = '<span>觀看次數：167萬次</span><span>  </span><span>1 年前</span><a href="/hashtag/design">#design</a>';
      document.querySelector("#view-count").setAttribute("aria-label", "");
      document.querySelector("#date-text").setAttribute("aria-label", "");
    });
    await page.locator(".cl-watch-views").getByText("觀看次數：167萬次").waitFor();
    await page.locator(".cl-watch-date").getByText("1 年前").waitFor();
    assert.equal(await page.locator("#info > span.cl-watch-native-fact").count(), 2);
    assert.equal(await page.locator("#info a").innerText(), "#design");
    await page.evaluate(() => {
      document.querySelector("#view-count").setAttribute("aria-label", "2,345 views");
      document.querySelector("#date-text").setAttribute("aria-label", "7 hours ago");
    });

    const changesBefore = await page.evaluate(() => __getStoredState());
    await page.evaluate(() => {
      const next = __getStoredState();
      next.revision += 1;
      next.settings.language = "zh-TW";
      __setStoredState(next);
    });
    await page.waitForFunction(() => document.querySelector("#chanlume-watch-facts")?.getAttribute("aria-label") === "影片資訊");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('ytd-live-chat-frame')?.style.getPropertyValue('--cl-watch-chat-height'));
    assert.equal(await page.evaluate(() => {
      const row = document.querySelector("ytd-watch-metadata #top-row");
      const facts = document.querySelector("#chanlume-watch-facts");
      return facts.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1
        && facts.getBoundingClientRect().left >= row.getBoundingClientRect().left - 1;
    }), true);

    // Disabling or navigating away restores the original page exactly.
    await page.evaluate(() => {
      history.pushState({}, "", "/feed/history");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await page.waitForFunction(() => !document.documentElement.classList.contains("chanlume-watch-layout"));
    assert.equal(await page.locator("#chanlume-watch-facts").count(), 0);
    assert.equal(await page.locator("#chanlume-watch-side-tabs").count(), 0);
    assert.notEqual(await page.locator("#view-count").evaluate(el => getComputedStyle(el).display), "none");
    await page.evaluate(() => {
      history.pushState({}, "", "/watch?v=second-video");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await page.locator("#chanlume-watch-facts").waitFor();
    await page.evaluate(() => {
      const next = __getStoredState();
      next.revision += 1;
      next.settings.enabled = false;
      __setStoredState(next);
    });
    await page.waitForFunction(() => !document.querySelector("#chanlume-watch-facts"));
    assert.equal(await page.locator("#native-like").count(), 1);
    assert.notEqual(await page.locator("#view-count").evaluate(el => getComputedStyle(el).display), "none");
    assert.notEqual(await page.locator('#search-button').evaluate(el => getComputedStyle(el).display), 'none', 'power-off restores YouTube search');
    assert.notEqual(await page.locator('#related').evaluate(el => getComputedStyle(el).display), 'none', 'power-off restores native recommendations');
    const changesAfter = await page.evaluate(() => __getStoredState());
    assert.deepEqual(changesAfter.channels, changesBefore.channels);
    assert.deepEqual(changesAfter.groups, changesBefore.groups);
    assert.deepEqual(errors, []);
    console.log("PASS watch: native auto-caption transcript, caption-free tab hiding, player-sized live chat, accessible facts, async updates, original player/actions, responsive modes, SPA cleanup, power-off, no library writes.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
