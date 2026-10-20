const {selectScope}=require('./navigation-actions.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.env.CHANLUME_NODE_MODULES,'playwright'));

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:18766/tests/shelf-harness.html');
    await page.locator('[data-shelf-input=view]').waitFor();
    await selectScope(page,'design');
    // A group in Feed mode remains a native YouTube feed, with classification-only hiding.
    await page.waitForFunction(()=>document.querySelector('#native-feed')?.classList.contains('cl-native-feed-source')===false);
    assert.equal(await page.locator('#native-feed ytd-rich-item-renderer:not(.chanlume-hidden)').count(),5);
    assert.equal(await page.locator('.cl-shelf-video').count(),0);
    // Reproduce Helium's native stylesheet overriding the feed grid in custom mode.
    await page.addStyleTag({content:'#primary.chanlume-shelf-custom > #native-feed {display:none !important;}'});
    await page.locator('[data-shelf-input=view]').selectOption('timeline');
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===5);
    assert.equal(await page.locator('#native-feed').evaluate(el=>getComputedStyle(el).display!=='none'),true);
    assert.equal(await page.locator('#native-feed').evaluate(el=>el.style.getPropertyPriority('display')),'important');
    assert.equal(await page.locator('.cl-shelf-video strong').first().innerText(),'Designing a quieter digital space');
    assert.equal(await page.evaluate(()=>(window.__recentCalls||[]).length),0);
    assert.deepEqual(await page.locator('.cl-timeline-day h2').allInnerTexts(),['1 days ago','2 days ago','3 days ago','5 days ago','6 days ago']);

    // A native aria-label takes precedence over a fallback metadata row.
    await page.evaluate(()=>{
      const card=document.querySelector('#native-feed ytd-rich-item-renderer');
      const label=document.createElement('span');label.className='ytContentMetadataViewModelMetadataTextLastPart';
      label.setAttribute('aria-label','10 天前');
      [...card.querySelectorAll('.ytContentMetadataViewModelMetadataRow')].at(-1).append(label);
    });
    await page.waitForFunction(()=>document.querySelector('.cl-timeline-day:last-child h2')?.textContent==='10 天前');
    assert.equal(await page.locator('.cl-shelf-video strong').last().innerText(),'Designing a quieter digital space');

    // New YouTube cards flow into Timeline without Chanlume making channel requests.
    await page.evaluate(()=>__addVideo(12,'Older source item, design'));
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===6);
    assert.equal(await page.locator('.cl-shelf-video strong').last().innerText(),'Older source item, design');
    await page.evaluate(()=>{
      const original=[...document.querySelectorAll('#native-feed ytd-rich-item-renderer')].at(-1);
      const duplicate=original.cloneNode(true);
      duplicate.querySelectorAll('a[href*="watch?v="]').forEach(a=>a.setAttribute('href',a.getAttribute('href')+'&pp=duplicate'));
      document.querySelector('#native-feed').append(duplicate);
    });
    assert.equal(await page.locator('.cl-shelf-video').count(),6,'duplicate video IDs with URL parameters are not repeated');
    assert.equal(await page.evaluate(()=>(window.__recentCalls||[]).length),0);

    // The continuation stays laid out below the custom content and can be intersected.
    await page.setViewportSize({width:390,height:700});
    await page.evaluate(()=>{
      const sentinel=document.createElement('ytd-continuation-item-renderer');
      sentinel.style.cssText='display:block;height:80px';
      document.querySelector('#native-feed').append(sentinel);
      window.__loadedOlder=false;
      const observer=new IntersectionObserver(entries=>{
        if(!window.__loadedOlder && entries.some(e=>e.isIntersecting)){
          window.__loadedOlder=true;
          __addVideo(24,'Older page, same channel');
          observer.disconnect();sentinel.remove();
        }
      });
      observer.observe(sentinel);
    });
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await page.waitForFunction(()=>window.__loadedOlder===true);
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===7);
    assert.equal(await page.locator('.cl-shelf-video strong').last().innerText(),'Older page, same channel');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-shelf-input=view]').selectOption('feed');
    assert.equal(await page.locator('#native-feed').evaluate(el=>el.style.getPropertyValue('display')),'','native grid inline state must be restored in Feed');
    assert.equal(await page.locator('#native-feed').evaluate(el=>getComputedStyle(el).display!=='none'),true);

    // Channel mode is the complete library, not merely channels found in feed cards.
    await selectScope(page,'all');
    await page.locator('[data-shelf-input=view]').selectOption('channels');
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-channel').length===12);
    await page.evaluate(()=>document.querySelector('#native-feed').replaceChildren());
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===0);
    assert.equal(await page.locator('.cl-shelf-channel').count(),12);
    assert.equal(await page.locator('.cl-channel-unloaded').count(),12);
    await page.evaluate(()=>__addVideo(0,'A newly loaded first channel video'));
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===1);
    assert.equal(await page.locator('.cl-shelf-video strong').innerText(),'A newly loaded first channel video');
    // An empty YouTube rich grid on first entry must not be hidden while
    // waiting for YouTube to mount its first cards or continuation marker.
    await page.evaluate(()=>{
      const empty=document.createElement('ytd-rich-grid-renderer');
      empty.id='native-feed';
      document.querySelector('#native-feed').replaceWith(empty);
    });
    await page.waitForFunction(()=>document.querySelector('#primary')?.classList.contains('chanlume-shelf-awaiting-native'));
    assert.equal(await page.locator('#native-feed').evaluate(el=>getComputedStyle(el).display!=='none'),true,'empty native grid must keep its native layout');
    assert.equal(await page.locator('#native-feed').evaluate(el=>el.style.getPropertyValue('display')),'','do not override an empty native grid');
    assert.equal(await page.locator('#native-feed').evaluate(el=>getComputedStyle(el).opacity),'0','conceal an awaiting native grid without collapsing it');
    await page.evaluate(()=>__addVideo(1,'Video arriving after initially empty native grid'));
    await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===1);
    assert.equal(await page.locator('#native-feed').evaluate(el=>el.classList.contains('cl-native-feed-source')),true);
    assert.equal(await page.locator('#native-feed').evaluate(el=>el.style.getPropertyPriority('display')),'important');
    assert.equal(await page.locator('.cl-shelf-video strong').innerText(),'Video arriving after initially empty native grid');
    assert.equal(await page.evaluate(()=>(window.__recentCalls||[]).length),0);
    assert.equal(await page.evaluate(()=>__operations.length),0);
    assert.deepEqual(errors,[]);
    console.log('PASS native subscription source: scoped Feed, Timeline, native continuation, DOM append, complete Channels directory, no per-channel reads or writes.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
