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
    // Edge hover must delegate to YouTube's native drawer, then close only
    // the drawer that Chanlume opened. It must not hijack a manually opened one.
    await page.evaluate(()=>{
      const app=document.createElement('ytd-app');app.id='hover-fixture-app';
      app.innerHTML='<div id="guide" style="visibility:hidden"><div id="guide-wrapper" style="position:fixed;left:0;top:56px;width:240px;height:500px"></div></div>';
      document.body.append(app);
      const mast=document.createElement('ytd-masthead');mast.id='hover-fixture-mast';
      mast.innerHTML='<div id="guide-button"><button aria-label="Guide">Guide</button></div>';
      document.body.append(mast);
      window.__drawerToggles=0;
      mast.querySelector('button').addEventListener('click',()=>{
        const drawer=app.querySelector('#guide');
        drawer.style.visibility=drawer.style.visibility==='visible'?'hidden':'visible';
        window.__drawerToggles++;
      });
    });
    await page.mouse.move(30,120);
    await page.waitForFunction(()=>window.__drawerToggles===1);
    assert.equal(await page.locator('#hover-fixture-app #guide').evaluate(e=>getComputedStyle(e).visibility),'visible');
    await page.mouse.move(400,120);
    await page.waitForFunction(()=>window.__drawerToggles===2);
    // The stub button is behind the fixed fixture guide; invoke the stub's
    // native-click handler without introducing a forced pointer click.
    await page.evaluate(()=>document.querySelector('#hover-fixture-mast button').click());
    await page.mouse.move(400,150);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(()=>window.__drawerToggles),3,'manually opened drawers must not auto-close');
    await page.evaluate(()=>{document.querySelector('#hover-fixture-app')?.remove();document.querySelector('#hover-fixture-mast')?.remove();});
    await page.mouse.move(500,150);
    await guide.locator('.cl-nav-settings > summary').click();
    await guide.locator('.cl-nav-distractions > summary').click();
    const geometry=await guide.evaluate(root=>{
      const box=selector=>root.querySelector(selector).getBoundingClientRect();
      const rects=[
        box('.cl-guide-heading'),box('.cl-nav-heading'),
        box('.cl-nav-settings > summary'),box('.cl-nav-distractions > summary')
      ];
      const arrows=[
        root.querySelector('.cl-guide-toggle .cl-nav-chevron'),
        root.querySelector('.cl-nav-disclosure .cl-nav-chevron'),
        root.querySelector('.cl-nav-settings > summary > .cl-nav-chevron'),
        root.querySelector('.cl-nav-distractions > summary > .cl-nav-chevron')
      ];
      const paths=arrows.map(svg=>svg.querySelector('path').getBoundingClientRect().width);
      return {rows:rects.map(r=>r.height),paths,
        main:root.querySelector('.cl-nav-main').getBoundingClientRect().toJSON(),
        footer:root.querySelector('.cl-nav-footer').getBoundingClientRect().toJSON(),
        summary:box('.cl-nav-settings > summary').toJSON(),height:innerHeight,
        scroll:getComputedStyle(root.querySelector('.cl-nav-main')).overflowY};
    });
    assert.equal(geometry.rows.every(height=>Math.abs(height-46)<1),true, 'disclosure rows must share a 46px track');
    assert.equal(geometry.paths.every(width=>Math.abs(width-geometry.paths[0])<1),true,'four arrows share the same rendered path size');
    assert.equal(geometry.scroll,'auto','only the main navigation scrolls');
    assert.equal(geometry.main.bottom<=geometry.footer.top+1,true,'docked settings cannot overlap the main navigation');
    assert.equal(Math.abs(geometry.summary.bottom-geometry.footer.bottom)<12,true,'Chanlume summary stays at the bottom when expanded');
    assert.equal(geometry.footer.bottom<=geometry.height+1,true,'docked summary must stay inside the viewport');
    const switches=guide.locator('.cl-nav-switch');
    assert.equal(await switches.count(),6);
    assert.equal(await switches.evaluateAll(items=>items.every(button=>button.getAttribute('role')==='switch'&&button.getAttribute('aria-label'))),true);
    const hoverSwitch=guide.locator('[data-cl-setting=sidebarAutoExpandOnHover]');
    assert.equal(await hoverSwitch.getAttribute('aria-checked'),'true','auto-open remains on by default');
    assert.equal(await hoverSwitch.getAttribute('aria-label'),'Auto-expand sidebar on hover');
    await hoverSwitch.click();
    await page.waitForFunction(()=>document.querySelector('[data-cl-setting=sidebarAutoExpandOnHover]')?.getAttribute('aria-checked')==='false');
    assert.equal(await page.evaluate(()=>__state().settings.sidebarAutoExpandOnHover),false);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('shelf-fixture')).settings.sidebarAutoExpandOnHover),false,'off state is persisted');
    // When the setting is disabled, approaching the same native guide hotspot
    // must never synthesize a click. The real manual guide button still works.
    await page.evaluate(()=>{
      const app=document.createElement('ytd-app');app.id='hover-disabled-app';
      app.innerHTML='<div id="guide" style="visibility:hidden"><div id="guide-wrapper" style="position:fixed;left:0;top:56px;width:240px;height:500px"></div></div>';
      document.body.append(app);
      const mast=document.createElement('ytd-masthead');mast.id='hover-disabled-mast';
      mast.innerHTML='<div id="guide-button"><button aria-label="Guide">Guide</button></div>';
      document.body.append(mast);
      window.__offDrawerToggles=0;
      mast.querySelector('button').addEventListener('click',()=>{
        const drawer=app.querySelector('#guide');
        drawer.style.visibility=drawer.style.visibility==='visible'?'hidden':'visible';
        window.__offDrawerToggles++;
      });
    });
    await page.mouse.move(500,120);
    await page.mouse.move(30,120);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>window.__offDrawerToggles),0,'hover is disabled');
    await page.evaluate(()=>document.querySelector('#hover-disabled-mast button').click());
    assert.equal(await page.evaluate(()=>window.__offDrawerToggles),1,'manual native guide click still works');
    await page.mouse.move(450,120);
    await page.waitForTimeout(520);
    assert.equal(await page.evaluate(()=>window.__offDrawerToggles),1,'manually opened guide is not auto-closed');
    await page.evaluate(()=>document.querySelector('#hover-disabled-mast button').click());
    await hoverSwitch.click();
    await page.waitForFunction(()=>document.querySelector('[data-cl-setting=sidebarAutoExpandOnHover]')?.getAttribute('aria-checked')==='true');
    await page.mouse.move(500,120);
    await page.mouse.move(30,120);
    await page.waitForFunction(()=>window.__offDrawerToggles===3);
    await page.mouse.move(460,120);
    await page.waitForFunction(()=>window.__offDrawerToggles===4);
    await page.evaluate(()=>{document.querySelector('#hover-disabled-app')?.remove();document.querySelector('#hover-disabled-mast')?.remove();});
    // Restore the prior disabled choice to prove it survives a full reload.
    await hoverSwitch.click();
    await page.waitForFunction(()=>document.querySelector('[data-cl-setting=sidebarAutoExpandOnHover]')?.getAttribute('aria-checked')==='false');
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
    await page.reload();
    await page.locator('#chanlume-guide-section').waitFor();
    await page.locator('.cl-nav-settings > summary').click();
    await page.locator('.cl-nav-distractions > summary').click();
    assert.equal(await page.locator('[data-cl-setting=sidebarAutoExpandOnHover]').getAttribute('aria-checked'),'false','reloaded UI reflects persisted off state');
    assert.deepEqual(errors,[]);
    console.log('PASS navigation: six sidebar switches, manual native click vs hover on/off, persisted hover choice through reload, expanded disclosure, support link, routes, Home/Shorts, modern titles and localization.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
