const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, "playwright"));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(7000);
  try {
    await page.goto("http://127.0.0.1:18766/tests/content-harness.html");
    await page.waitForFunction(() => !document.documentElement.classList.contains("chanlume-disabled"));
    const originalState = await page.evaluate(() => __getStoredState());
    await page.evaluate(() => {
      const native = document.createElement("ytd-browse");
      native.innerHTML = '<ytd-rich-grid-renderer><div id="contents" style="display:flex;flex-wrap:wrap;gap:12px;width:900px"></div></ytd-rich-grid-renderer>';
      const contents = native.querySelector("#contents");
      for (let index = 0; index < 6; index++) {
        const card = document.createElement("ytd-rich-item-renderer");
        card.dataset.nativeIndex = String(index);
        card.style.width = "270px";
        card.innerHTML = `<a href="/watch?v=native-${index}">Native video ${index}</a>`;
        contents.append(card);
      }
      const continuation = document.createElement("ytd-continuation-item-renderer");
      continuation.id = "original-continuation";
      contents.append(continuation);
      document.body.append(native);
      window.__homeNative = [...contents.querySelectorAll("ytd-rich-item-renderer")];
      history.pushState({}, "", "/");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await page.waitForFunction(() => document.documentElement.classList.contains("chanlume-home-layout"));
    assert.equal(await page.locator("#chanlume-home-featured").count(), 0);
    assert.equal(await page.locator(".cl-home-featured-card").count(), 0);
    assert.equal(await page.locator("ytd-browse ytd-rich-item-renderer").count(), 6);
    assert.equal(await page.locator("#original-continuation").count(), 1);
    assert.equal(await page.evaluate(() => __homeNative.every(card => card.isConnected && card.querySelector("a"))), true);

    await page.evaluate(() => {
      const grid = document.querySelector('ytd-browse #contents');
      const stale = document.createElement('div'); stale.id = 'chanlume-home-featured'; grid.prepend(stale);
      grid.querySelector('ytd-rich-item-renderer').classList.add('cl-home-featured-card');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.waitForFunction(() => !document.getElementById('chanlume-home-featured'));
    assert.equal(await page.locator(".cl-home-featured-card").count(), 0, "stale featured styling is removed");
    assert.equal(await page.locator("ytd-browse ytd-rich-item-renderer").count(), 6);
    await page.evaluate(() => {
      const card = document.createElement("ytd-rich-item-renderer");
      card.textContent = "Native continuation item";
      document.querySelector("ytd-browse #contents").append(card);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    assert.equal(await page.locator("ytd-browse ytd-rich-item-renderer").count(), 7);
    assert.equal(await page.locator("#chanlume-home-featured").count(), 0, "no fabricated recommendations after continuation");
    await page.evaluate(() => {
      history.pushState({}, "", "/watch?v=another-video");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await page.waitForFunction(() => !document.documentElement.classList.contains("chanlume-home-layout"));
    assert.deepEqual((await page.evaluate(() => __getStoredState())).groups, originalState.groups);
    assert.deepEqual(errors, []);
    console.log("PASS home: no fabricated featured/missed shelf, original recommendations and continuation preserved, SPA cleanup, no library writes.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
