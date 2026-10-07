const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/extension/content/content.js', route => {
      const source = fs.readFileSync(path.join(__dirname, '../extension/content/content.js'), 'utf8')
        .replace('function applyFilters(cards = null) {', 'function applyFilters(cards = null) { globalThis.__filterRuns = (globalThis.__filterRuns || 0) + 1;')
        .replace('  init();', '  globalThis.__test = { acceptState, refreshFromState }; init();');
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: source });
    });
    await page.goto('http://127.0.0.1:18766/tests/subscriptions-harness.html');
    await page.waitForFunction(() => document.querySelector('#categorized-card .chanlume-card-classification'));
    await page.waitForTimeout(300);
    // A busy feed must apply work while mutations are still arriving.
    await page.evaluate(() => {
      __filterRuns = 0;
      globalThis.__busyTicks = 0;
      globalThis.__busyTimer = setInterval(() => {
        const row = document.querySelector('#categorized-card .ytContentMetadataViewModelMetadataRow');
        row.querySelector('.tick')?.remove();
        const tick = document.createElement('span'); tick.className = 'tick'; row.append(tick);
        __busyTicks++;
      }, 60);
    });
    await page.waitForFunction(() => __busyTicks >= 5 && __filterRuns >= 2);
    await page.evaluate(() => clearInterval(__busyTimer));
    await page.waitForTimeout(150);
    // Extension badge mutations must settle, without scheduling another render.
    const settled = await page.evaluate(() => __filterRuns);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __filterRuns), settled);
    await page.evaluate(() => { __filterRuns = 0; const card = document.querySelector('#categorized-card').cloneNode(true); card.id = 'new-card'; card.querySelector('.chanlume-card-classification').remove(); document.querySelector('#feed').append(card); });
    await page.waitForFunction(() => document.querySelector('#new-card .chanlume-card-classification'));
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => __filterRuns), 1, 'one appended card should cause one filter pass');

    // YouTube can reuse a card and only change its channel link.
    await page.locator('#chanlume-toolbar [data-cl-group="unfiled"]').click();
    await page.evaluate(() => document.querySelector('#new-card a[href^="/@"]').setAttribute('href', '/@waiting'));
    await page.waitForFunction(() => !document.querySelector('#new-card').classList.contains('chanlume-hidden') && document.querySelector('#new-card .chanlume-card-classification').textContent.includes('Unclassified'));

    // Hidden tabs accept newer state but defer rendering until foregrounded.
    const state = await page.evaluate(async () => (await chrome.storage.local.get()).chanlumeState);
    await page.evaluate(next => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      __filterRuns = 0;
      next.revision = 2;
      next.groups[0].channelIds.push('/@waiting');
      __test.acceptState(next); __test.refreshFromState();
    }, state);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => __filterRuns), 0);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => document.querySelector('#new-card').classList.contains('chanlume-hidden'));
    // Duplicate revisions never enter the costly normalization path.
    assert.equal(await page.evaluate(() => {
      const original = ChanlumeCore.normalizeState;
      let calls = 0;
      ChanlumeCore.normalizeState = (...args) => { calls++; return original(...args); };
      __test.acceptState({ revision: 2 }); __test.acceptState({ revision: 1 });
      ChanlumeCore.normalizeState = original;
      return calls;
    }), 0);

    await page.evaluate(next => { next.revision = 3; next.settings.hideWatched = true; __test.acceptState(next); __test.refreshFromState(); }, state);
    await page.locator('#chanlume-toolbar [data-cl-group="all"]').click();
    await page.evaluate(() => { const progress = document.createElement('div'); progress.id = 'progress'; progress.style.width = '0%'; document.querySelector('#new-card').append(progress); });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#new-card').evaluate(card => card.classList.contains('chanlume-hidden')), false);
    await page.evaluate(() => { document.querySelector('#new-card #progress').style.width = '30%'; });
    await page.waitForFunction(() => document.querySelector('#new-card').classList.contains('chanlume-hidden'));
    // Recommendation-card updates on watch pages have no filtering work when Shorts hiding is off.
    await page.evaluate(next => { next.revision = 4; next.settings.hideShorts = false; __test.acceptState(next); __test.refreshFromState(); history.replaceState({}, '', '/watch?v=test'); document.dispatchEvent(new Event('yt-navigate-finish')); }, state);
    await page.waitForTimeout(200);
    await page.evaluate(() => { __filterRuns = 0; const card = document.createElement('ytd-compact-video-renderer'); card.innerHTML = '<a href="/watch?v=next">Next video</a>'; document.body.append(card); });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => __filterRuns), 0);

    await page.goto('http://127.0.0.1:18766/tests/identity-scan-harness.html');
    await page.waitForFunction(() => __capturedIdentities.length > 0);
    // Returning to a cached renderer must replay identities after route cleanup.
    await page.evaluate(() => { history.replaceState({}, '', '/watch?v=test'); document.dispatchEvent(new Event('yt-navigate-finish')); __capturedIdentities.length = 0; history.replaceState({}, '', '/feed/channels'); document.dispatchEvent(new Event('yt-navigate-finish')); });
    await page.waitForFunction(() => __capturedIdentities.length > 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      const card = document.createElement('ytd-channel-renderer');
      card.innerHTML = '<a href="/@hidden">Hidden</a>';
      card.data = { navigationEndpoint: { browseEndpoint: { browseId: 'UCaaaaaaaaaaaaaaaaaaaaaa', canonicalBaseUrl: '/@hidden' } } };
      document.body.append(card);
    });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __capturedIdentities.some(item => item.alias === '/@hidden')), false);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => __capturedIdentities.some(item => item.alias === '/@hidden'));
    assert.deepEqual(errors, []);
    console.log('Performance smoke passed: continuous mutations, no self-refresh, reused card href, hidden revision catch-up, revision deduplication, watched progress, idle watch-page cards, identity navigation and visibility.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
