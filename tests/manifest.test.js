const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const extensionRoot = path.resolve(__dirname, "../extension");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));

test("manifest is MV3 and requests only the intended permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "1.24.0");
  assert.equal(manifest.version_name, "1.24.0");
  assert.deepEqual(manifest.permissions.sort(), ["storage"]);
  assert.deepEqual(manifest.host_permissions.sort(), ["https://www.googleapis.com/youtube/v3/*", "https://www.youtube.com/*"]);
});

test("manifest and store-facing metadata ship Traditional Chinese and English locales", () => {
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_appName__");
  assert.equal(manifest.description, "__MSG_appDescription__");
  for (const locale of ["zh_TW", "en"]) {
    const messages = JSON.parse(fs.readFileSync(path.join(extensionRoot, "_locales", locale, "messages.json"), "utf8"));
    assert.ok(messages.appName.message);
    assert.ok(messages.appDescription.message);
    assert.ok(messages.actionTitle.message);
  }
});

test("every manifest entrypoint exists", () => {
  const files = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    manifest.options_page,
    ...manifest.content_scripts.flatMap((entry) => [...(entry.js || []), ...(entry.css || [])]),
    ...Object.values(manifest.icons)
  ];
  files.forEach((file) => assert.ok(fs.existsSync(path.join(extensionRoot, file)), `Missing ${file}`));
});

test("extension ships no remote executable scripts", () => {
  const htmlFiles = [manifest.action.default_popup, manifest.options_page];
  htmlFiles.forEach((file) => {
    const html = fs.readFileSync(path.join(extensionRoot, file), "utf8");
    assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  });
});

test("popup donation link is transparent and opens safely in a new tab", () => {
  const popupHtml = fs.readFileSync(path.join(extensionRoot, manifest.action.default_popup), "utf8");
  assert.match(popupHtml, /href="https:\/\/buymeacoffee\.com\/tananis"/);
  assert.match(popupHtml, /target="_blank"/);
  assert.match(popupHtml, /rel="noopener noreferrer"/);
});

test("Shorts navigation and one-time onboarding fixes are included", () => {
  const contentCss = fs.readFileSync(path.join(extensionRoot, "content/content.css"), "utf8");
  const contentJs = fs.readFileSync(path.join(extensionRoot, "content/content.js"), "utf8");
  const dashboardHtml = fs.readFileSync(path.join(extensionRoot, "dashboard/dashboard.html"), "utf8");
  const dashboardJs = fs.readFileSync(path.join(extensionRoot, "dashboard/dashboard.js"), "utf8");
  assert.match(contentCss, /ytd-guide-entry-renderer:has\(\[title="Shorts"\]\)/);
  assert.match(contentCss, /ytd-guide-entry-renderer:has\(\[aria-label="Shorts"\]\)/);
  assert.match(contentCss, /html\.chanlume-hide-shorts ytd-rich-shelf-renderer:has\(a\[href\^="\/shorts\/"\]/);
  assert.match(contentJs, /await commit\(\{ type: "reconcile-subscription-scan"/);
  assert.match(contentJs, /yt-page-header-view-model yt-subscribe-button-view-model/);
  assert.match(dashboardHtml, /id="onboarding"/);
  assert.match(dashboardHtml, /id="onboarding-skip"/);
  assert.match(dashboardHtml, /id="youtube-api-key"/);
  assert.match(dashboardHtml, /id="language-select"/);
  assert.match(dashboardHtml, /id="merge-group-section"/);
  assert.match(dashboardJs, /type: "merge-groups"/);
  assert.match(dashboardJs, /chrome\.storage\.onChanged\.addListener/);
  assert.match(dashboardJs, /chanlumeScanStatus/);
  const identityBridge = manifest.content_scripts.find((entry) => entry.world === "MAIN");
  assert.ok(identityBridge?.js.includes("content/identity-bridge.js"));
});

test("the background service worker is the only chanlumeState writer", () => {
  const backgroundJs = fs.readFileSync(path.join(extensionRoot, "background.js"), "utf8");
  const contentJs = fs.readFileSync(path.join(extensionRoot, "content/content.js"), "utf8");
  const dashboardJs = fs.readFileSync(path.join(extensionRoot, "dashboard/dashboard.js"), "utf8");
  assert.match(backgroundJs, /stateWriteQueue/);
  assert.match(backgroundJs, /CHANLUME_MUTATE/);
  assert.match(backgroundJs, /Core\.applyStateOperation/);
  assert.doesNotMatch(contentJs, /chrome\.storage\.local\.set/);
  assert.doesNotMatch(dashboardJs, /chrome\.storage\.local\.set/);
});

test("YouTube surfaces bootstrap before the native page's first render", () => {
  const isolated = manifest.content_scripts.find(entry => entry.world !== "MAIN");
  assert.equal(isolated.run_at, "document_start");
  assert.deepEqual(isolated.js.slice(0,2), ["content/startup.js", "content/dom.js"]);
  assert.ok(isolated.css.includes("content/content.css"));
  assert.ok(isolated.js.includes("content/subscriptions.js"));
  assert.ok(isolated.js.includes("content/home.js"));
  assert.ok(isolated.js.indexOf("content/home.js") < isolated.js.indexOf("content/content.js"));
  assert.ok(isolated.css.includes("content/home.css"));
  assert.ok(isolated.js.indexOf("content/watch.js") > isolated.js.indexOf("content/subscriptions.js"));
  assert.ok(isolated.js.indexOf("content/watch.js") < isolated.js.indexOf("content/content.js"));
  assert.ok(isolated.css.includes("content/watch.css"));
  assert.ok(!isolated.js.includes("content/recent.js"), "native subscriptions must not inject the per-channel reader");
});

test("optional local development reload uses no extra extension permissions", () => {
  const isolated = manifest.content_scripts.find(entry => entry.world !== "MAIN");
  assert.equal(isolated.js.at(-1), "content/dev-reload.js");
  const resources = manifest.web_accessible_resources.flatMap(group => group.resources);
  assert.ok(!resources.includes("dev-reload.json"), "developer marker must be read only by the extension worker");
  const marker = JSON.parse(fs.readFileSync(path.join(extensionRoot, "dev-reload.json"), "utf8"));
  assert.equal(typeof marker.chanlumeDevWatch, "boolean");
  assert.equal(manifest.permissions.length, 1);
});
