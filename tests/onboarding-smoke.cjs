const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const locale of ['en-US', 'zh-TW']) {
      const context = await browser.newContext({ locale, viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Exercise the extension API branch on a local page with isolated synthetic storage.
      await page.route('**/extension/dashboard/dashboard.js', route => {
        const source = fs.readFileSync(path.join(__dirname, '../extension/dashboard/dashboard.js'), 'utf8');
        assert.ok(source.includes('location.protocol === "chrome-extension:" &&'));
        return route.fulfill({ contentType: 'text/javascript', body: source.replace('location.protocol === "chrome-extension:" &&', '') });
      });
      await page.addInitScript(() => {
        let listener;
        const getState = () => JSON.parse(localStorage.getItem('onboarding-fixture') || 'null');
        globalThis.chrome = {
          storage: { local: { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, key === 'chanlumeState' ? getState() : undefined])) }, onChanged: { addListener: fn => { listener = fn; } } },
          tabs: { create: async () => ({ id: 1 }) },
          runtime: { sendMessage: async message => {
            if (message.type !== 'CHANLUME_MUTATE') return { ok: true };
            const old = getState();
            const state = ChanlumeCore.applyStateOperation(old, message.operation);
            state.revision = (old?.revision || 0) + 1;
            localStorage.setItem('onboarding-fixture', JSON.stringify(state));
            listener?.({ chanlumeState: { newValue: state } }, 'local');
            return { ok: true, state };
          } }
        };
      });
      const url = 'http://127.0.0.1:18766/extension/dashboard/dashboard.html?view=settings';
      await page.goto(url);
      await page.locator('.onboarding-card').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#settings-view').isVisible(), true);
      assert.equal(await page.locator('#library-view').isVisible(), false);
      assert.equal(await page.locator('.page-header h1').innerText(), locale === 'zh-TW' ? '偏好設定' : 'Preferences');
      assert.equal(await page.locator('#onboarding-title').innerText(), locale === 'zh-TW' ? '歡迎使用 Chanlume' : 'Welcome to Chanlume');
      await page.screenshot({ path: `work/first-install-${locale}.png`, fullPage: true });
      await page.locator('#onboarding [data-open-templates]').click();
      await page.locator('#template-options input[value="science"]').check();
      await page.locator('#template-options input[value="game-development"]').check();
      await page.screenshot({path:`work/group-templates-${locale}.png`,fullPage:true});
      await page.locator('#template-apply').click();
      await page.locator('#template-dialog').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('onboarding-fixture')).groups.length),4);
      assert.equal(await page.locator('#onboarding-progress').innerText(),'1 / 6');
      await page.locator('#onboarding-next').click();
      assert.equal(await page.locator('#library-view').isVisible(), true);
      assert.equal(await page.locator('#onboarding-progress').innerText(), '2 / 6');
      await page.locator('#onboarding-back').click();
      assert.equal(await page.locator('#settings-view').isVisible(), true);
      await page.locator('#onboarding-skip').click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('onboarding-fixture')).settings.onboardingComplete);
      assert.equal(await page.locator('#settings-view').isVisible(), true);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('.onboarding-card').isVisible(), false);
      assert.equal(await page.locator('#settings-view').isVisible(), true);
      // Normal dashboard visits still open the library; saved completion remains authoritative.
      await page.locator('#settings-view [data-open-templates]').click();
      await page.locator('#template-options input[value="science"]').check();
      await page.locator('#template-apply').click();
      await page.locator('#template-dialog').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('onboarding-fixture')).groups.length),4);
      await page.goto(url.split('?')[0], { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#library-view').isVisible(), true);
      assert.equal(await page.locator('.onboarding-card').isVisible(), false);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Onboarding smoke passed: English/Traditional Chinese install landing, welcome, tutorial navigation, skip stays on settings, saved completion survives reload, ordinary dashboard visits stay on library.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
