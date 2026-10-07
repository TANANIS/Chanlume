const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, "playwright"));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ locale: "en-US" });
  try {
    await page.goto("http://127.0.0.1:18766/extension/dashboard/dashboard.html?lang=en", { waitUntil: "networkidle" });
    assert.equal(await page.locator("#language-select").inputValue(), "en");
    assert.equal(await page.locator(".page-header h1").textContent(), "Subscription shelf");
    assert.match(await page.locator("body").innerText(), /Auto-organize groups \(local\)/);
    assert.doesNotMatch(await page.locator(".sidebar, .page-header, .stats, .channel-toolbar").allInnerTexts().then((parts) => parts.join(" ")), /[\u3400-\u9fff]/);

    await page.locator('[data-group="learning"]').click();
    await page.locator("#edit-selected-group").click();
    await page.locator("#merge-group-section").waitFor({ state: "visible" });
    assert.match(await page.locator("#merge-group-section").innerText(), /Merge into another group/);
    assert.doesNotMatch(await page.locator("#group-dialog").innerText(), /[\u3400-\u9fff]/);
    await page.locator("#merge-group-target").selectOption("relax");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#merge-group").click();
    await page.locator('[data-group="learning"]').waitFor({ state: "detached" });
    assert.equal(await page.locator('[data-group="relax"] .group-number').textContent(), "2");

    await page.goto("http://127.0.0.1:18766/extension/dashboard/dashboard.html?tour=1&lang=en&smoke=1", { waitUntil: "networkidle" });
    await page.locator("#onboarding-title").waitFor({ state: "visible" });
    assert.equal(await page.locator("#onboarding").getAttribute("hidden"), null);
    assert.equal(await page.locator("#onboarding-title").textContent(), "Welcome to Chanlume");
    assert.equal(await page.locator("#onboarding-skip").textContent(), "Skip tutorial");
    assert.doesNotMatch(await page.locator("#onboarding").innerText(), /[\u3400-\u9fff]/);

    await page.locator("#onboarding-skip").click();
    await page.locator("#auto-organize").click();
    await page.locator("#auto-dialog").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#auto-apply").count(), 0);
    assert.equal(await page.locator("#stat-progress").innerText(), "100%");
    assert.match(await page.locator("#toast").innerText(), /3 channels/);

    await page.goto("http://127.0.0.1:18766/extension/popup/popup.html?lang=en", { waitUntil: "networkidle" });
    assert.match(await page.locator("body").innerText(), /Your subscriptions, organized your way/);
    assert.equal(await page.locator(".support-link span:last-child").innerText(), "Support & feedback ↗");
    assert.equal(await page.locator(".support-link").getAttribute("href"), "https://buymeacoffee.com/tananis");
    assert.doesNotMatch(await page.locator("body").innerText(), /[\u3400-\u9fff]/);

    const content = page;
    await content.goto("http://127.0.0.1:18766/tests/content-harness.html", { waitUntil: "networkidle" });
    const control = content.locator("#chanlume-channel-control");
    await control.waitFor({ state: "visible" });
    await content.waitForFunction(() => document.querySelector('[data-cl-current-group="gaming"]')?.checked === true);
    assert.equal(await control.getAttribute("data-channel-id"), "/@mattsgamenight");
    const repairedIdentity = await content.evaluate(() => globalThis.__getStoredState());
    assert.deepEqual(Object.keys(repairedIdentity.channels), ["/@mattsgamenight"]);
    assert.deepEqual(repairedIdentity.groups.find((group) => group.id === "gaming").channelIds, ["/@mattsgamenight"]);
    const classification = content.locator("#chanlume-channel-classification");
    await classification.waitFor({ state: "visible" });
    assert.equal(await classification.evaluate((node) => node.previousElementSibling?.classList.contains("ytContentMetadataViewModelMetadataRow")), true);
    assert.equal(await classification.evaluate((node) => node.closest("yt-page-header-view-model") !== null), true);
    assert.equal(await classification.locator(".cl-channel-classification-label").innerText(), "Groups");
    assert.equal(await classification.locator(".cl-channel-classification-group").innerText(), "Gaming");
    assert.equal(await control.locator(".cl-current-trigger").innerText(), "Groups");
    await control.locator('.cl-current-favorite').click();
    await content.waitForFunction(()=>document.querySelector('.cl-current-favorite')?.getAttribute('aria-pressed')==='true');
    assert.deepEqual(await content.evaluate(()=>__getStoredState().favoriteChannelIds),['/@mattsgamenight']);
    assert.deepEqual(await content.evaluate(()=>__getStoredState().groups.map(g=>g.channelIds)),[['/@mattsgamenight'],[]]);
    await control.locator('.cl-current-favorite').click();
    await content.waitForFunction(()=>document.querySelector('.cl-current-favorite')?.getAttribute('aria-pressed')==='false');
    assert.equal(await control.evaluate((node) => node.previousElementSibling?.classList.contains("ytFlexibleActionsViewModelAction")), true);
    assert.equal(await control.evaluate((node) => node.parentElement?.tagName), "YT-FLEXIBLE-ACTIONS-VIEW-MODEL");
    await control.locator(".cl-current-trigger").click();
    assert.match(await control.locator(".cl-current-menu").innerText(), /Choose groups/);
    assert.doesNotMatch(await control.innerText(), /[\u3400-\u9fff]/);
    const learningMembership = control.locator('[data-cl-current-group="learning"]');
    assert.equal(await learningMembership.isChecked(), false);
    await learningMembership.click();
    assert.equal(await control.locator('[data-cl-current-group="learning"]').isChecked(), true);
    await content.evaluate(()=>{
      document.querySelector('yt-page-header-view-model').hidden=true;
      document.body.insertAdjacentHTML('beforeend','<ytd-watch-metadata><div id="owner"><a href="/@mattsgamenight">Matt\'s Game Night</a><yt-subscribe-button-view-model subscribed><button>Subscribed</button></yt-subscribe-button-view-model></div></ytd-watch-metadata>');
      history.replaceState({},'', '/watch?v=normal00001');
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await content.waitForFunction(()=>document.querySelector('#chanlume-channel-control')?.closest('ytd-watch-metadata'));
    await control.locator('.cl-current-favorite').click();
    await content.waitForFunction(()=>document.querySelector('.cl-current-favorite')?.getAttribute('aria-pressed')==='true');
    assert.deepEqual(await content.evaluate(()=>__getStoredState().favoriteChannelIds),['/@mattsgamenight']);
    await content.screenshot({path:'work/watch-favorite-en.png',fullPage:true});
    await content.evaluate(()=>document.querySelector('ytd-watch-metadata').remove());

    await content.evaluate(() => {
      const next = globalThis.__getStoredState();
      next.revision += 1;
      next.channels = {};
      next.channelAliases = {};
      next.groups = next.groups.map((group) => ({ ...group, channelIds: [] }));
      globalThis.__setStoredState(next);
      history.replaceState({}, "", "/@not-subscribed");
      document.querySelector('link[rel="canonical"]').href = "https://www.youtube.com/@not-subscribed";
      document.querySelector("yt-page-header-view-model > a").href = "/@not-subscribed";
      document.querySelector("yt-page-header-view-model h1").textContent = "Not Subscribed";
      const subscribe = document.querySelector("yt-subscribe-button-view-model");
      subscribe.removeAttribute("subscribed");
      const button = subscribe.querySelector("button");
      button.textContent = "Subscribe";
      button.setAttribute("aria-label", "Subscribe to Not Subscribed");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await content.waitForFunction(() => !document.querySelector("#chanlume-channel-control") && !document.querySelector("#chanlume-channel-classification"));

    await content.setViewportSize({ width: 700, height: 800 });
    await content.goto("http://127.0.0.1:18766/tests/subscriptions-harness.html", { waitUntil: "networkidle" });
    const guide = content.locator("#chanlume-guide-section");
    const guideToggle = guide.locator(".cl-guide-toggle");
    await guide.waitFor({ state: "visible" });
    assert.equal(await guideToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await guide.locator(".cl-guide-list").isVisible(), false);
    await guideToggle.click();
    assert.equal(await guide.locator(".cl-guide-list").isVisible(), true);
    assert.equal(await guideToggle.getAttribute("aria-expanded"), "true");
    await guideToggle.click();
    assert.equal(await guide.locator(".cl-guide-list").isVisible(), false);
    const toolbarGroups = content.locator("#chanlume-toolbar .cl-toolbar-groups");
    assert.equal(await content.locator("#chanlume-toolbar .cl-toolbar-brand").count(), 0);
    assert.equal(await toolbarGroups.evaluate((node) => getComputedStyle(node).flexWrap), "wrap");
    assert.equal(await toolbarGroups.locator(".cl-toolbar-chip").evaluateAll((chips) => chips.at(-1).offsetTop > chips[0].offsetTop), true);
    assert.equal(await content.locator("#chanlume-toolbar").evaluate((node) => getComputedStyle(node).boxSizing), "border-box");
    assert.equal(await content.locator("#chanlume-toolbar").evaluate((node) => getComputedStyle(node).minHeight), "52px");
    const lightTheme = await content.evaluate(() => ({
      toolbarBackground: getComputedStyle(document.querySelector("#chanlume-toolbar")).backgroundColor,
      toolbarText: getComputedStyle(document.querySelector("#chanlume-toolbar")).color,
      panelBackground: getComputedStyle(document.querySelector("#chanlume-panel")).backgroundColor,
      panelText: getComputedStyle(document.querySelector("#chanlume-panel")).color
    }));
    await content.evaluate(() => document.documentElement.setAttribute("dark", ""));
    const darkTheme = await content.evaluate(() => ({
      toolbarBackground: getComputedStyle(document.querySelector("#chanlume-toolbar")).backgroundColor,
      toolbarText: getComputedStyle(document.querySelector("#chanlume-toolbar")).color,
      panelBackground: getComputedStyle(document.querySelector("#chanlume-panel")).backgroundColor,
      panelText: getComputedStyle(document.querySelector("#chanlume-panel")).color
    }));
    assert.equal(lightTheme.toolbarBackground, "rgb(242, 242, 242)");
    assert.equal(lightTheme.toolbarText, "rgb(15, 15, 15)");
    assert.equal(lightTheme.panelText, "rgb(15, 15, 15)");
    assert.equal(darkTheme.toolbarBackground, "rgb(33, 33, 33)");
    assert.equal(darkTheme.toolbarText, "rgb(241, 241, 241)");
    assert.notEqual(lightTheme.panelBackground, darkTheme.panelBackground);
    await content.evaluate(() => document.documentElement.removeAttribute("dark"));
    const categorizedPreview = content.locator("#categorized-card .chanlume-card-classification");
    const unfiledPreview = content.locator("#unfiled-card .chanlume-card-classification");
    await categorizedPreview.waitFor({ state: "visible" });
    assert.equal(await categorizedPreview.evaluate((node) => node.previousElementSibling?.classList.contains("ytContentMetadataViewModelMetadataRow")), true);
    assert.match(await categorizedPreview.innerText(), /Groups\s+Lifestyle/);
    assert.match(await unfiledPreview.innerText(), /Groups\s+Unclassified/);
    assert.equal(await content.locator("#unknown-card .chanlume-card-classification").count(), 0);
    const shortsShelf = content.locator("#shorts-shelf");
    await shortsShelf.waitFor({ state: "attached" });
    assert.equal(await shortsShelf.evaluate((node) => getComputedStyle(node).display), "none");
    assert.equal(await content.locator("#regular-shelf").isVisible(), true);
    await content.locator('#chanlume-toolbar [data-cl-group="unfiled"]').click();
    assert.match(content.url(), /#chanlume-group=unfiled$/);
    assert.equal(await content.locator("#categorized-card").isVisible(), false);
    assert.equal(await content.locator("#unfiled-card").isVisible(), true);

    await content.goto("http://127.0.0.1:18766/tests/identity-scan-harness.html", { waitUntil: "networkidle" });
    await content.waitForFunction(() => globalThis.__capturedIdentities.length > 0);
    const scannedIdentity = await content.evaluate(() => globalThis.__capturedIdentities[0]);
    assert.equal(scannedIdentity.channelId, "UCNqVXfC231oVcZEcUKrW0DQ");
    assert.equal(scannedIdentity.alias, "/@TenaciousTrilobite");
    console.log("UI smoke checks passed: English UI, group merge, channel header and preview-card classification metadata, unsubscribed control removal, guide collapse, brand-free wrapped toolbar groups, html[dark] YouTube theme following, scan identity extraction, unfiled filtering, synchronized group URL, and dynamic Shorts hiding.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
