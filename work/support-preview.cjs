const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:460,height:600}});
    for (const lang of ['en','zh-TW']) {
      await page.goto(`http://127.0.0.1:18766/extension/popup/popup.html?lang=${lang}`);
      await page.locator('.support-link').waitFor();
      const bounds = await page.locator('.support-card').boundingBox();
      assert.ok(bounds.y + bounds.height <= 600, 'support card must fit in the popup viewport');
      console.log(lang, 'popup support', bounds, 'body height', await page.locator('body').evaluate(el=>el.scrollHeight));
      await page.screenshot({path:path.join(__dirname,`support-popup-${lang}.png`),fullPage:true});
    }
    await page.setViewportSize({width:1280,height:800});
    await page.goto('http://127.0.0.1:18766/extension/dashboard/dashboard.html?lang=zh-TW');
    await page.locator('.support-link').waitFor();
    assert.equal(await page.locator('.support-link').getAttribute('href'),'https://buymeacoffee.com/tananis');
    await page.screenshot({path:path.join(__dirname,'support-dashboard.png')});
    await page.setViewportSize({width:700,height:800});
    await page.goto('http://127.0.0.1:18766/tests/subscriptions-harness.html');
    await page.locator('#chanlume-toolbar').waitFor();
    assert.equal(await page.locator('#chanlume-toolbar .cl-support-link').count(),0);
    await page.screenshot({path:path.join(__dirname,'support-youtube.png')});
    await page.context().route('https://buymeacoffee.com/**', route=>route.fulfill({body:'Local link destination check'}));
    const opened = page.waitForEvent('popup');
    await page.locator('#chanlume-toolbar [data-cl-action="manage"]').click();
    await page.locator('#chanlume-panel .cl-support-link').click();
    const destination = await opened;
    await destination.waitForLoadState();
    assert.equal(destination.url(),'https://buymeacoffee.com/tananis');
    await destination.close();
    console.log('Support link opens the expected destination. Remote page replaced with a local test response.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
