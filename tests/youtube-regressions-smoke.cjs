const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:18766/tests/content-harness.html');
    await page.locator('#chanlume-channel-control').waitFor();
    // Modern YouTube keeps the inactive subscribe button in a visibility:hidden subtree.
    // No subscribed attribute is present; a single failed commit must recover.
    await page.evaluate(() => {
      const next = __getStoredState(); next.channels = {}; next.channelAliases = {}; next.revision++;
      next.groups.forEach(g => g.channelIds = []); __setStoredState(next);
      history.replaceState({}, '', '/@newchannel');
      document.querySelector('link[rel=canonical]').href = 'https://www.youtube.com/@newchannel';
      document.querySelector('yt-page-header-view-model > a').href = '/@newchannel';
      const root = document.querySelector('yt-subscribe-button-view-model');
      root.removeAttribute('subscribed');
      root.innerHTML = '<div style="visibility:visible"><button>Subscribe</button></div><div style="visibility:hidden"><button>Subscribed</button></div>';
      const original = chrome.runtime.sendMessage;
      window.__failed = false;
      chrome.runtime.sendMessage = async message => {
        if (message.operation?.type === 'set-subscription' && !window.__failed) { window.__failed = true; return { ok: false, error: 'Temporary failure' }; }
        return original(message);
      };
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.locator('#chanlume-channel-control').waitFor({ state: 'detached' });
    await page.evaluate(() => {
      const root = document.querySelector('yt-subscribe-button-view-model');
      root.children[0].style.visibility = 'hidden'; root.children[1].style.visibility = 'visible';
    });
    await page.waitForFunction(() => __getStoredState().channels['/@newchannel'], null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => __failed), true);
    await page.evaluate(() => { document.querySelector('yt-flexible-actions-view-model').style.overflow = 'hidden'; });
    await page.locator('.cl-current-trigger').click();
    assert.equal(await page.locator('.cl-current-menu').evaluate(n => n.matches(':popover-open')), true);
    await page.locator('[data-cl-current-group=learning]').check();
    await page.locator('.cl-current-favorite').click();
    await page.waitForFunction(() => __getStoredState().favoriteChannelIds.includes('/@newchannel'));
    assert.ok((await page.evaluate(() => __getStoredState())).groups.find(g => g.id === 'learning').channelIds.includes('/@newchannel'));
    // Ensure the stale first button cannot remove a real subscription on the next refresh.
    await page.evaluate(() => document.dispatchEvent(new Event('yt-navigate-finish')));
    await page.locator('#chanlume-channel-control').waitFor();
    await page.goto('http://127.0.0.1:18766/tests/content-harness.html');
    await page.evaluate(() => {
      const next = __getStoredState(); next.revision++;
      next.groups = Array.from({ length: 24 }, (_, i) => ({ id: 'group' + i, name: 'Topic ' + i, icon: 'book', color: '#7c5cff', channelIds: [] }));
      __setStoredState(next);
      document.body.insertAdjacentHTML('beforeend', '<ytd-guide-renderer><div id="sections"></div></ytd-guide-renderer><ytd-browse page-subtype="subscriptions"><div id="primary"></div></ytd-browse>');
      history.replaceState({}, '', '/feed/subscriptions'); document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.locator('#chanlume-toolbar').waitFor();
    assert.equal(await page.locator('#chanlume-launcher').isVisible(), true);
    await page.locator('[data-cl-action=find-group]').click();
    await page.locator('.cl-group-search').fill('Topic 23');
    assert.equal(await page.locator('[data-cl-pick-group]:visible').count(), 1);
    await page.locator('[data-cl-pick-group=group23]').click();
    assert.match(page.url(), /chanlume-group=group23/);
    await page.locator('#chanlume-launcher').click();
    await page.evaluate(() => document.documentElement.requestFullscreen());
    await page.waitForFunction(() => document.documentElement.classList.contains('chanlume-fullscreen'));
    assert.equal(await page.locator('#chanlume-launcher').isVisible(), false);
    assert.equal(await page.locator('#chanlume-panel').evaluate(n => n.classList.contains('cl-open')), false);
    await page.evaluate(() => document.exitFullscreen());
    await page.locator('#chanlume-launcher').waitFor({ state: 'visible' });
    await page.screenshot({ path: 'work/toolbar-modern-dark.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.body.style.margin = '8px'; document.documentElement.removeAttribute('dark'); });
    assert.ok(await page.locator('#chanlume-toolbar').evaluate(n => n.getBoundingClientRect().right <= innerWidth));
    assert.ok(await page.locator('.cl-toolbar-groups').evaluate(n => n.scrollWidth > n.clientWidth));
    await page.screenshot({ path: 'work/toolbar-modern-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('YouTube regression smoke passed: dual-button subscription, failed-save recovery, groups/favorites, searchable overflow, fullscreen and narrow viewport.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
