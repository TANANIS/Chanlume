import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharedPath = path.join(root, "extension", "shared.js");
const contentPath = path.join(root, "extension", "content", "content.js");
const cssPath = path.join(root, "extension", "content", "content.css");
const browser = await chromium.launch({ headless: true });
console.log("V1140_START");

const youtubeHtml = `<!doctype html><html><body>
  <button id="guide-button">menu</button>
  <ytd-app guide-persistent-and-visible>
    <tp-yt-app-drawer></tp-yt-app-drawer>
    <ytd-guide-renderer><div id="sections"><div><ytd-guide-entry-renderer id="home-guide"><a href="/">Home</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="shorts-guide"><a title="Shorts">Shorts</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="shorts-aria-guide"><a aria-label="Shorts">Shorts</a></ytd-guide-entry-renderer></div></div></ytd-guide-renderer>
    <ytd-page-manager>
      <ytd-browse page-subtype="subscriptions"><div id="primary"><div id="contents">
        <ytd-rich-item-renderer id="normal-card"><a href="/@normal">Normal</a></ytd-rich-item-renderer>
        <ytd-rich-item-renderer id="watched-card"><a href="/@watched">Watched</a><yt-thumbnail-overlay-progress-bar-view-model></yt-thumbnail-overlay-progress-bar-view-model></ytd-rich-item-renderer>
        <ytd-rich-item-renderer id="short-card"><a href="/shorts/abc">Short</a></ytd-rich-item-renderer>
      </div></div></ytd-browse>
    </ytd-page-manager>
  </ytd-app>
  <button class="ytp-autonav-toggle-button" aria-checked="true" onclick="this.setAttribute('aria-checked','false')">autoplay</button>
  <ytd-watch-flexy><div id="columns"><div id="primary">video</div><div id="secondary">recommendations</div></div></ytd-watch-flexy>
</body></html>`;

const channelWatchHtml = `<!doctype html><html><body>
  <ytd-app><ytd-page-manager><ytd-watch-flexy><div id="columns"><div id="primary">
    <ytd-watch-metadata><div id="owner"><a href="/@testcreator">Test Creator</a><div id="subscribe-button"><ytd-subscribe-button-renderer><button aria-label="Subscribe to Test Creator"><span>Subscribe</span></button></ytd-subscribe-button-renderer></div></div></ytd-watch-metadata>
  </div><div id="secondary">recommendations</div></div></ytd-watch-flexy></ytd-page-manager></ytd-app>
</body></html>`;

const channelPageHtml = `<!doctype html><html><body><ytd-app><yt-page-header-renderer><h1>Channel Home Creator</h1><div class="ytFlexibleActionsViewModelAction"><yt-subscribe-button-view-model><div><button><span>Subscribed</span></button></div></yt-subscribe-button-view-model></div></yt-page-header-renderer></ytd-app></body></html>`;

async function installContent(page, settings) {
  await page.addInitScript((savedSettings) => {
    const base = { version: 9, groups: [], channels: {}, manualLabels: {}, settings: savedSettings };
    window.__savedState = base;
    window.chrome = {
      storage: {
        local: {
          get: async () => ({ chanlumeState: window.__savedState }),
          set: async (value) => { window.__savedState = value.chanlumeState; }
        },
        onChanged: { addListener: () => {} }
      },
      runtime: { sendMessage: async () => ({ ok: true }), onMessage: { addListener: () => {} } }
    };
  }, settings);
  await page.route("https://www.youtube.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: youtubeHtml }));
}

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(5000);
  await installContent(page, { blockHome: true, hideShorts: true, hideSecondary: true, disableAutoplay: true, hideWatched: true, compactMode: false, language: "en" });
  await page.goto("https://www.youtube.com/feed/subscriptions");
  await page.addStyleTag({ path: cssPath });
  await page.addScriptTag({ path: sharedPath });
  await page.addScriptTag({ path: contentPath });
  await page.waitForSelector("#chanlume-panel");
  await page.waitForTimeout(350);
  assert.equal(await page.locator("html").evaluate((node) => node.classList.contains("chanlume-hide-secondary")), true);
  assert.equal(await page.locator("#short-card").evaluate((node) => node.classList.contains("chanlume-shorts-hidden")), true);
  assert.equal(await page.locator("#watched-card").evaluate((node) => node.classList.contains("chanlume-hidden")), true);
  assert.notEqual(await page.locator("#normal-card").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator("#home-guide").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator("#shorts-guide").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator("#shorts-aria-guide").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator(".ytp-autonav-toggle-button").getAttribute("aria-checked"), "false");
  assert.notEqual(await page.locator("ytd-guide-renderer").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator("ytd-watch-flexy #secondary").evaluate((node) => getComputedStyle(node).display), "none");
  assert.equal(await page.locator('#chanlume-toolbar > .cl-toolbar-tools > button').count(), 1);
  assert.equal(await page.locator('#chanlume-toolbar [data-cl-setting]').count(), 0);
  assert.equal(await page.locator('#chanlume-toolbar [data-cl-action="update-subscriptions"]').count(), 0);
  await page.screenshot({ path: path.join(root, "work", "v1111-one-gear.png"), fullPage: true });
  await page.evaluate(() => {
    const card = document.createElement("ytd-rich-item-renderer");
    card.id = "dynamic-watched-card";
    card.innerHTML = '<a href="/@dynamic">Dynamic watched</a><yt-thumbnail-overlay-progress-bar-view-model><div class="ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment" style="width: 42%"></div></yt-thumbnail-overlay-progress-bar-view-model>';
    document.querySelector("ytd-browse #contents").append(card);
  });
  await page.waitForTimeout(260);
  assert.equal(await page.locator("#dynamic-watched-card").evaluate((node) => node.classList.contains("chanlume-hidden")), true);
  await page.locator('#chanlume-toolbar [data-cl-action="manage"]').click();
  assert.equal(await page.locator('#chanlume-panel [data-action="home"]').isHidden(), true);
  assert.equal(await page.locator("#chanlume-panel").getByText("Subscription groups", { exact: true }).count(), 1);
  assert.equal(await page.locator("#chanlume-panel").getByText("Block Shorts", { exact: true }).count(), 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(root, "work", "v1140-panel-en.png"), fullPage: true });
  await page.close();
  console.log("V1130_CONTENT_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  await page.addInitScript(() => {
    window.__savedState = {
      version: 10,
      groups: [{ id: "learning", name: "Learning", icon: "book", color: "#7c5cff", channelIds: [] }],
      channels: {}, manualLabels: {},
      settings: { blockHome: false, hideShorts: false, hideSecondary: false, disableAutoplay: false, hideWatched: false, compactMode: false, onboardingComplete: true, language: "en" }
    };
    window.chrome = {
      storage: { local: { get: async () => ({ chanlumeState: window.__savedState }), set: async (value) => { window.__savedState = value.chanlumeState; } }, onChanged: { addListener: () => {} } },
      runtime: { sendMessage: async () => ({ ok: true }), onMessage: { addListener: () => {} } }
    };
  });
  await page.route("https://www.youtube.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: channelWatchHtml }));
  await page.goto("https://www.youtube.com/watch?v=chanlume-test");
  await page.addStyleTag({ path: cssPath });
  await page.addScriptTag({ path: sharedPath });
  await page.addScriptTag({ path: contentPath });
  await page.waitForSelector("#chanlume-channel-control");
  assert.equal(await page.locator(".cl-current-trigger").textContent().then((text) => text.trim()), "Groups");
  assert.equal(await page.locator("[data-cl-current-group]").isDisabled(), true);
  await page.evaluate(() => {
    const renderer = document.querySelector("ytd-subscribe-button-renderer");
    renderer.setAttribute("subscribed", "");
    renderer.innerHTML = '<button aria-label="Unsubscribe from Test Creator"><span>Subscribed</span></button>';
  });
  await page.waitForFunction(() => Boolean(window.__savedState.channels["/@testcreator"]));
  await page.locator(".cl-current-trigger").click();
  await page.locator("[data-cl-current-group]").check();
  await page.waitForFunction(() => window.__savedState.groups[0].channelIds.includes("/@testcreator"));
  await page.screenshot({ path: path.join(root, "work", "v1140-channel-groups-en.png"), fullPage: true });
  await page.evaluate(() => {
    const renderer = document.querySelector("ytd-subscribe-button-renderer");
    renderer.removeAttribute("subscribed");
    renderer.innerHTML = '<button aria-label="Subscribe to Test Creator"><span>Subscribe</span></button>';
  });
  await page.waitForFunction(() => !window.__savedState.channels["/@testcreator"]);
  assert.deepEqual(await page.evaluate(() => window.__savedState.groups[0].channelIds), []);
  await page.close();
  console.log("V1140_CHANNEL_SYNC_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    window.__savedState = { version: 10, groups: [{ id: "news", name: "News", icon: "star", color: "#f0a44b", channelIds: [] }], channels: {}, manualLabels: {}, settings: { language: "en", onboardingComplete: true } };
    window.chrome = { storage: { local: { get: async () => ({ chanlumeState: window.__savedState }), set: async (value) => { window.__savedState = value.chanlumeState; } }, onChanged: { addListener: () => {} } }, runtime: { sendMessage: async () => ({ ok: true }), onMessage: { addListener: () => {} } } };
  });
  await page.route("https://www.youtube.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: channelPageHtml }));
  await page.goto("https://www.youtube.com/@channelhome");
  await page.addStyleTag({ path: cssPath });
  await page.addScriptTag({ path: sharedPath });
  await page.addScriptTag({ path: contentPath });
  await page.waitForSelector("#chanlume-channel-control");
  assert.equal(await page.locator("[data-cl-current-group]").isEnabled(), true);
  await page.locator(".cl-current-trigger").click();
  await page.locator("[data-cl-current-group]").check();
  await page.waitForFunction(() => window.__savedState.groups[0].channelIds.includes("/@channelhome"));
  assert.equal(await page.evaluate(() => window.__savedState.channels["/@channelhome"].name), "Channel Home Creator");
  await page.close();
  console.log("V1140_CHANNEL_HOME_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://127.0.0.1:8765/extension/dashboard/dashboard.html");
  await page.locator('[data-view="settings"]').click();
  await page.locator("#language-select").selectOption("en");
  await page.waitForTimeout(100);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.locator(".page-header h1").textContent(), "Preferences");
  assert.equal(await page.locator(".language-card h2").textContent(), "Interface language");
  assert.equal(await page.locator("#save-youtube-api-key").textContent(), "Save key");
  await page.screenshot({ path: path.join(root, "work", "v1140-settings-en.png"), fullPage: true });
  await page.close();
  console.log("V1140_EN_DASHBOARD_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 620 } });
  await page.goto("http://127.0.0.1:8765/extension/popup/popup.html?lang=en");
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.locator("#open-subscriptions strong").textContent(), "Subscriptions");
  assert.equal(await page.locator("#add-group").textContent(), "+ New group");
  await page.screenshot({ path: path.join(root, "work", "v1140-popup-en.png"), fullPage: true });
  await page.close();
  console.log("V1140_EN_POPUP_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://127.0.0.1:8765/extension/dashboard/dashboard.html");
  console.log("V1130_DASHBOARD_LOADED");
  await page.locator('[data-view="settings"]').click();
  console.log("V1130_SETTINGS_OPEN");
  await page.locator('[data-setting="hideSecondary"]').click({ force: true });
  await page.locator('[data-setting="blockHome"]').click({ force: true });
  await page.waitForTimeout(100);
  console.log("V1130_SIDEBAR_CHECKED");
  assert.equal(await page.locator('[data-setting="disableAutoplay"]').isChecked(), true);
  assert.equal(await page.locator("#open-home").isHidden(), true);
  assert.equal(await page.locator("#youtube-api-key").isVisible(), true);
  assert.match(await page.locator("#youtube-api-status").textContent(), /本機字典/);
  assert.equal(await page.locator(".setting-row strong").first().evaluate((node) => getComputedStyle(node).fontSize), "15px");
  assert.equal(await page.locator(".setting-row small").first().evaluate((node) => getComputedStyle(node).fontSize), "13px");
  await page.screenshot({ path: path.join(root, "work", "v1130-settings.png"), fullPage: true });
  await page.close();
  console.log("V1130_DASHBOARD_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://127.0.0.1:8765/extension/dashboard/dashboard.html?tour=1");
  await page.waitForFunction(() => !document.getElementById("onboarding")?.hidden);
  assert.equal(await page.locator("#onboarding-title").textContent(), "歡迎使用 Chanlume");
  assert.equal(await page.locator("#onboarding-dots span").count(), 6);
  await page.locator("#onboarding-next").click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator("#onboarding-title").textContent(), "先建立你的訂閱書架");
  assert.equal(await page.locator("#update-subscriptions").evaluate((node) => node.classList.contains("onboarding-target")), true);
  await page.screenshot({ path: path.join(root, "work", "v1120-onboarding-update.png"), fullPage: true });
  await page.locator("#onboarding-next").click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator("#onboarding-title").textContent(), "第一次自動整理");
  assert.equal(await page.locator("#auto-organize").evaluate((node) => node.classList.contains("onboarding-target")), true);
  await page.screenshot({ path: path.join(root, "work", "v1120-onboarding-auto.png"), fullPage: true });
  await page.locator("#onboarding-next").click();
  assert.equal(await page.locator("#auto-dialog").getAttribute("open"), "");
  await page.locator("#auto-close").click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#onboarding-title").textContent(), "檢查並手動調整");
  await page.locator("#onboarding-skip").click();
  assert.equal(await page.locator("#onboarding").isHidden(), true);
  await page.close();
  console.log("V1130_ONBOARDING_OK");
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route("https://www.youtube.com/**", (route) => {
    const url = route.request().url();
    const description = url.includes("lofigirl") ? "lofi music performance and playlist" : url.includes("gamemakers") ? "game development and game design" : "journalism news reporter";
    const channelId = url.includes("lofigirl") ? "UCLOFI" : url.includes("gamemakers") ? "UCGAME" : "UCREPORT";
    route.fulfill({ status: 200, contentType: "text/html", headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:8765", "Access-Control-Allow-Credentials": "true" }, body: `<!doctype html><meta name="description" content="${description}"><script>var ytInitialData={"metadata":{"channelMetadataRenderer":{"description":"${description}","externalId":"${channelId}"}}};</script>` });
  });
  await page.route("https://www.googleapis.com/youtube/v3/**", (route) => {
    const url = new URL(route.request().url());
    const ids = (url.searchParams.get("id") || "").split(",").filter(Boolean);
    const topic = { UCLOFI: "Music", UCGAME: "Gaming", UCREPORT: "Politics" };
    const items = ids.map((id) => ({ id, topicDetails: { topicCategories: [`https://en.wikipedia.org/wiki/${topic[id] || "Knowledge"}`] } }));
    route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ items }) });
  });
  await page.goto("http://127.0.0.1:8765/extension/dashboard/dashboard.html");
  await page.locator('[data-view="settings"]').click();
  await page.locator("#youtube-api-key").fill("AIzaMockChanlumeKey123456789");
  await page.locator("#save-youtube-api-key").click();
  assert.match(await page.locator("#youtube-api-status").textContent(), /已在本機設定/);
  await page.locator('[data-view="library"]').click();
  await page.locator("#auto-organize").click();
  await page.locator("#auto-start").click();
  await page.waitForFunction(() => !document.getElementById("auto-results")?.hidden);
  assert.match(await page.locator("#auto-confidence-summary").textContent(), /高信心|中信心/);
  assert.match(await page.locator("#auto-confidence-summary").textContent(), /YouTube 官方訊號 3/);
  assert.ok(await page.locator("#auto-suggestion-list .suggestion-card").count() >= 2);
  await page.screenshot({ path: path.join(root, "work", "v1130-auto-results.png"), fullPage: true });
  await page.close();
  console.log("V1130_AUTO_RESULTS_OK");
}

await browser.close();
console.log("V1140_OK bilingual=true localeMetadata=true layouts=true");
