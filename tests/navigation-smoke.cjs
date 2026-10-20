const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const fixture='http://127.0.0.1:18766/tests/shelf-harness.html';
  try {
    await page.route('https://i.ytimg.com/**', route=>route.abort());
    await page.goto(fixture); await page.locator('#chanlume-guide-section').waitFor();
    const guide=page.locator('#chanlume-guide-section');
    assert.equal(await page.locator('#native-nav').isVisible(),false);
    assert.equal(await page.locator('ytd-guide-renderer #footer').isVisible(),false);
    assert.equal(await guide.locator('a[href="/playlist?list=WL"]').count(),1);
    assert.equal(await guide.locator('a[href="/"]').count(),1);
    assert.equal(await guide.locator('a[href="/shorts/"]').count(),0);
    assert.equal(await guide.locator('[data-cl-action=subscriptions]').getAttribute('aria-current'),'page');
    await guide.locator('.cl-nav-settings > summary').click();
    await guide.locator('.cl-nav-distractions > summary').click();
    const switches=guide.locator('.cl-nav-switch');
    assert.equal(await switches.count(),5);
    assert.equal(await switches.evaluateAll(items=>items.every(button=>button.getAttribute('role')==='switch'&&button.getAttribute('aria-label'))),true);
    const support=guide.locator('.cl-nav-support');
    assert.equal(await support.getAttribute('href'),'https://buymeacoffee.com/tananis');
    assert.equal(await support.getAttribute('target'),'_blank');
    assert.equal(await support.getAttribute('rel'),'noopener noreferrer');
    assert.equal(await page.locator('#chanlume-launcher, #chanlume-panel, #chanlume-backdrop').count(),0);
    assert.deepEqual(await guide.evaluate(el=>[
      getComputedStyle(el.querySelector('[data-cl-action="manage"]')).fontSize,
      getComputedStyle(el.querySelector('.cl-nav-distractions > summary')).fontSize,
      getComputedStyle(el.querySelector('.cl-nav-support')).fontSize,
      getComputedStyle(el.querySelector('.cl-nav-setting-label')).fontSize
    ]),['14px','14px','14px','13px']);
    const watched=guide.locator('[data-cl-setting=hideWatched]');
    const initialWatched=await watched.getAttribute('aria-checked');
    await watched.click();
    await page.waitForFunction(initial=>document.querySelector('[data-cl-setting=hideWatched]')?.getAttribute('aria-checked')!==initial,initialWatched);
    assert.equal(await guide.locator('.cl-nav-settings').getAttribute('open'),'');
    assert.equal(await guide.locator('.cl-nav-distractions').getAttribute('open'),'');
    assert.equal(await page.evaluate(()=>__operations.at(-1)?.type),'set-setting');
    assert.equal(await page.evaluate(()=>__operations.at(-1)?.payload.setting),'hideWatched');
    await watched.click();
    await page.waitForFunction(initial=>document.querySelector('[data-cl-setting=hideWatched]')?.getAttribute('aria-checked')===initial,initialWatched);
    await page.evaluate(()=>window.__failSave=true);
    await watched.click();
    await page.locator('#cl-toast').getByText('Could not save changes. Please retry.').waitFor();
    assert.equal(await watched.getAttribute('aria-checked'),initialWatched);
    assert.equal(await page.evaluate(()=>__state().settings.hideWatched),initialWatched==='true');
    await page.evaluate(()=>window.__failSave=false);
    fs.mkdirSync('work/subscriptions-ui-20261020/navigation-distractions',{recursive:true});
    await page.screenshot({path:'work/subscriptions-ui-20261020/navigation-distractions/sidebar-dark.png'});
    await page.evaluate(()=>{
      const send=chrome.runtime.sendMessage;
      window.__dashboardOpenRequests=0;
      chrome.runtime.sendMessage=async message=>{
        if(message?.type==='OPEN_DASHBOARD'){window.__dashboardOpenRequests++;return {ok:true};}
        return send(message);
      };
    });
    await guide.locator('[data-cl-action=manage]').click();
    assert.equal(await page.evaluate(()=>window.__dashboardOpenRequests),1);
    await page.evaluate(()=>document.documentElement.removeAttribute('dark'));
    await page.screenshot({path:'work/subscriptions-ui-20261020/navigation-distractions/sidebar-light.png'});
    await page.evaluate(()=>document.documentElement.setAttribute('dark',''));
    await guide.locator('[data-cl-action=toggle-explore]').click();
    assert.equal(await guide.locator('a[href="/feed/hype"]').isVisible(),true);
    await guide.locator('[data-cl-action=toggle-guide]').click();
    await guide.locator('[data-cl-group=design]').click();
    await page.waitForFunction(()=>location.hash==='#chanlume-group=design');
    assert.equal(await guide.locator('[data-cl-group=design]').evaluate(el=>el.classList.contains('cl-active')),true);
    assert.equal(await guide.locator('[data-cl-action=subscriptions]').getAttribute('aria-current'),null);
    await guide.locator('[data-cl-action=subscriptions]').click();
    await page.waitForFunction(()=>location.hash==='#chanlume-group=all');
    // The browser-action popup's former "open panel/group" message now selects a real subscription scope.
    assert.deepEqual(await page.evaluate(()=>__sendRuntimeMessage({type:'OPEN_CHANLUME',groupId:'code'})),{ok:true,navigating:false});
    await page.waitForFunction(()=>location.hash==='#chanlume-group=code');
    assert.equal(await page.locator('.cl-category-chip[data-id=code]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await page.evaluate(()=>__sendRuntimeMessage({type:'OPEN_CHANLUME'})),{ok:true});
    assert.deepEqual(await page.evaluate(()=>__sendRuntimeMessage({type:'OPEN_CHANLUME',groupId:'all'})),{ok:true,navigating:false});
    await page.waitForFunction(()=>location.hash==='#chanlume-group=all');
    // Real modern cards put duration links before their h3 title link.
    await page.evaluate(()=>{
      const first=document.querySelector('#native-feed ytd-rich-item-renderer');
      first.querySelector('#thumbnail').append('44:42');
      first.querySelector('#video-title').removeAttribute('id');
      const section=document.createElement('ytd-rich-section-renderer'); section.id='relevant-section';
      section.innerHTML='<ytd-rich-shelf-renderer><h2 id="title">Most relevant</h2></ytd-rich-shelf-renderer>';
      const card=__addVideo(35,'Recommendation to exclude');
      section.querySelector('ytd-rich-shelf-renderer').append(card); document.querySelector('#native-feed').before(section);
      const mini=document.createElement('ytd-mini-guide-renderer');mini.innerHTML='<div id="items"><a id="native-mini" href="/">Home</a></div>';mini.style.display='none'; document.body.append(mini);
    });
    await page.waitForFunction(()=>document.querySelector('#relevant-section')?.classList.contains('chanlume-relevant-hidden'));
    assert.equal(await page.locator('#relevant-section').isVisible(),false);
    await page.locator('[data-shelf-action=list]').first().click();
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===12);
    assert.equal(await page.locator('.cl-shelf-video strong').first().innerText(),'Designing a quieter digital space');
    assert.equal(await page.getByText('Recommendation to exclude',{exact:true}).filter({visible:true}).count(),0);
    // Late title assignment and node reuse must be reversible and localized.
    await page.evaluate(()=>document.querySelector('#relevant-section #title').textContent='Latest uploads');
    await page.waitForFunction(()=>!document.querySelector('#relevant-section').classList.contains('chanlume-relevant-hidden'));
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===13);
    await page.evaluate(()=>document.querySelector('#relevant-section #title').textContent='最相關');
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===12);
    await page.evaluate(()=>{document.querySelector('ytd-guide-renderer').style.display='none';document.querySelector('ytd-mini-guide-renderer').style.display='block';});
    const mini=page.locator('#chanlume-mini-guide');await mini.waitFor();
    assert.equal(await page.locator('#native-mini').isVisible(),false);
    await mini.locator('[data-cl-action=collections]').click(); await page.locator('.cl-collection').first().waitFor();
    await page.waitForFunction(()=>document.querySelector('#chanlume-mini-guide [data-cl-action=collections]')?.getAttribute('aria-current')==='page');
    assert.equal(await mini.locator('[data-cl-action=collections]').getAttribute('aria-current'),'page');
    await mini.locator('[data-cl-action=subscriptions]').click();await page.locator('#chanlume-subscriptions-page h1').getByText('All subscriptions').waitFor();
    await page.evaluate(()=>{const next=structuredClone(__state());next.settings.blockHome=true;next.settings.language='zh-TW';next.revision++;__change(next);});
    assert.equal(await guide.locator('a[href="/"]').count(),0);
    assert.equal(await mini.locator('a[href="/"]').count(),0);
    assert.equal(await mini.locator('[data-cl-action=subscriptions]').innerText(),'訂閱內容');
    await page.evaluate(()=>{const next=structuredClone(__state());next.settings.enabled=false;next.revision++;__change(next);});
    await guide.waitFor({state:'detached'});assert.equal(await mini.count(),0);
    assert.equal(await page.locator('#native-mini').isVisible(),true);
    assert.equal(await page.locator('#relevant-section').evaluate(el=>el.classList.contains('chanlume-relevant-hidden')),false);
    assert.equal(await page.locator('#native-nav').evaluate(el=>getComputedStyle(el).display!=='none'),true);
    await page.evaluate(()=>{const next=structuredClone(__state());next.settings.enabled=true;next.revision++;__change(next);});
    await guide.waitFor({state:'attached'});await mini.waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS navigation: sidebar distraction switches, persisted semantic settings, expanded disclosure, support link moved from panel, expanded/mini routes, selected state, native restore, Home/Shorts rules, modern titles, relevant shelf exclusion/reuse/localization.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
