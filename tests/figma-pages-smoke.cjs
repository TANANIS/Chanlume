const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(path.join(process.env.CHANLUME_NODE_MODULES,'playwright'));
const {selectScope}=require('./navigation-actions.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 const output='work/subscriptions-ui-20261020/figma-pages';fs.mkdirSync(output,{recursive:true});
 const root=page.locator('#chanlume-subscriptions-page');
 const snap=async name=>{await page.locator('img').evaluateAll(es=>Promise.all(es.filter(e=>e.getBoundingClientRect().top<innerHeight&&e.getBoundingClientRect().bottom>0).map(e=>e.decode().catch(()=>{}))));await page.screenshot({path:`${output}/${name}.png`});};
 try{
  await page.route('https://i.ytimg.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#373246"/><circle cx="210" cy="175" r="130" fill="#8f729b"/><rect x="380" y="40" width="180" height="280" rx="40" fill="#b9a0aa"/></svg>'}));
  await page.goto('http://127.0.0.1:18766/tests/shelf-harness.html');await root.waitFor();
  await page.addStyleTag({content:'@media(min-width:801px){ytd-browse{margin-left:240px;margin-right:0}}'});
  assert.equal(await root.locator('[data-shelf-input=scope]').count(),0);
  assert.equal(await root.locator('.cl-category-chip').count(),5);
  assert.equal(await root.locator('.cl-category-chip[data-id=all]').getAttribute('aria-pressed'),'true');
  const initialPositions=await page.evaluate(()=>{
    const nav=document.querySelector('#chanlume-shelf-sticky').getBoundingClientRect();
    const category=document.querySelector('.cl-category-rail').getBoundingClientRect();
    const primary=document.querySelector('#primary').getBoundingClientRect();
    const controls=document.querySelector('.cl-shelf-controls').getBoundingClientRect();
    return {navBottom:nav.bottom,categoryTop:category.top,controlsBottom:controls.bottom,navLeft:nav.left,primaryLeft:primary.left,navWidth:nav.width,primaryWidth:primary.width};
  });
  assert.ok(initialPositions.categoryTop>=initialPositions.navBottom+4,'Category rail must not be covered by the fixed tabs');
  assert.ok(initialPositions.categoryTop>=initialPositions.controlsBottom+4,'Category rail must sit below view/sort controls');
  assert.ok(Math.abs(initialPositions.navLeft-initialPositions.primaryLeft)<2);
  assert.ok(Math.abs(initialPositions.navWidth-initialPositions.primaryWidth)<2);
  // The native YouTube subscription feed lives outside the Chanlume page wrapper.
  // Its sticky tabs must survive that case, not only the custom timeline.
  await page.evaluate(()=>{document.querySelector('#native-feed').style.minHeight='2500px';window.scrollTo(0,500);});
  await page.waitForFunction(()=>window.scrollY>=200);
  assert.ok(Math.abs(await page.locator('#chanlume-shelf-sticky').evaluate(el=>el.getBoundingClientRect().top)-56)<3);
  const nativePinned=await page.locator('body > .cl-category-rail[data-pinned=true]').evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,navBottom:document.querySelector('#chanlume-shelf-sticky').getBoundingClientRect().bottom}));
  assert.ok(Math.abs(nativePinned.top-nativePinned.navBottom)<3,'Category rail must pin immediately below subscription tabs on native feed');
  assert.ok(nativePinned.bottom>nativePinned.top);
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('#native-feed').style.minHeight='';});
  await page.waitForFunction(()=>document.querySelector('#chanlume-category-slot .cl-category-rail')!==null);
  await root.locator('[data-shelf-input=view]').selectOption('timeline');
  await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===12);
  assert.equal(await root.locator('.cl-time-sort button').count(),2);
  assert.equal(await root.locator('.cl-shelf-source-note,.cl-shelf-date-note').count(),0);
  assert.equal(await root.locator('.cl-shelf-body .cl-recent-status').count(),0);
  assert.equal(await root.locator('.cl-video-duration').count(),0);
  // The new inline category rail changes retrieval scope, not page mode.
  await root.locator('.cl-category-chip[data-id=design]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===5);
  assert.equal(await root.getAttribute('data-page'),'subscriptions');
  assert.equal(await page.locator('#chanlume-shelf-sticky .cl-shelf-tabs').isVisible(),true);
  assert.equal(await root.locator('[data-shelf-input=view]').inputValue(),'timeline');
  assert.equal(await root.locator('.cl-shelf-video').count(),5);
  assert.equal(await root.locator('.cl-category-chip[data-id=design]').getAttribute('aria-pressed'),'true');
  await snap('subscriptions-scoped-dark');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await root.locator('.cl-category-items').isVisible(),true);
  await snap('subscriptions-scoped-mobile');
  await page.setViewportSize({width:1920,height:1080});
  await root.locator('[data-shelf-action=toggle-categories]').click();
  assert.equal(await root.locator('.cl-category-items').count(),0);
  assert.equal(await root.locator('.cl-category-current').innerText(),'Design & craft');
  await root.locator('[data-shelf-action=toggle-categories]').click();
  await root.locator('.cl-category-chip[data-id=code]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===3);
  assert.equal(await root.locator('.cl-shelf-video').count(),3);
  assert.equal(await root.locator('[data-shelf-input=view]').inputValue(),'timeline');
  await root.locator('.cl-category-chip[data-id=all]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===12);
  await snap('subscriptions-timeline-dark');
  // The tabs must remain under YouTube's masthead even when the feed itself scrolls.
  await page.evaluate(()=>{
    document.querySelector('.cl-shelf-body').style.minHeight='2600px';
    window.scrollTo(0,650);
  });
  await page.waitForFunction(()=>window.scrollY>=200);
  const sticky=await page.locator('#chanlume-shelf-sticky').evaluate(el=>({
    top:el.getBoundingClientRect().top,
    position:getComputedStyle(el).position,
    left:el.getBoundingClientRect().left
  }));
  assert.equal(sticky.position,'fixed');
  assert.ok(Math.abs(sticky.top-56)<3,`Subscription tabs must stay below the masthead, got ${sticky.top}`);
  const tabsHit=await page.locator('#chanlume-shelf-sticky [data-shelf-action=subscriptions]').evaluate(el=>{
    const r=el.getBoundingClientRect(), topmost=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {top:r.top,bottom:r.bottom,visible:getComputedStyle(el).visibility,hit:topmost===el||el.contains(topmost)};
  });
  assert.ok(tabsHit.top>=56 && tabsHit.bottom<=112 && tabsHit.visible==='visible' && tabsHit.hit,'Pinned subscriptions button must remain unobstructed and clickable');
  const categorySticky=await page.locator('body > .cl-category-rail[data-pinned=true]').evaluate(el=>({
    top:el.getBoundingClientRect().top,
    navBottom:document.querySelector('#chanlume-shelf-sticky').getBoundingClientRect().bottom,
    controlBottom:document.querySelector('.cl-shelf-controls').getBoundingClientRect().bottom
  }));
  assert.ok(Math.abs(categorySticky.top-categorySticky.navBottom)<3,'Category rail must remain pinned below the tabs on a custom feed');
  assert.ok(categorySticky.controlBottom<categorySticky.navBottom,'View controls must scroll away instead of sticking');
  await snap('subscriptions-category-pinned-dark');
  await page.locator('body > .cl-category-rail[data-pinned=true] .cl-category-chip[data-id=design]').click();
  await page.waitForFunction(()=>document.querySelector('.cl-category-chip[data-id=design][aria-pressed=true]')!==null);
  assert.equal(await root.locator('.cl-shelf-video').count(),5,'Pinned category chips still filter the underlying videos');
  await page.locator('body > .cl-category-rail[data-pinned=true] .cl-category-chip[data-id=all]').click();
  await page.waitForFunction(()=>document.querySelector('.cl-category-chip[data-id=all][aria-pressed=true]')!==null);
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.cl-shelf-body').style.minHeight='';});
  await page.waitForFunction(()=>document.querySelector('#chanlume-category-slot .cl-category-rail')!==null);
  await root.locator('[data-shelf-input=view]').selectOption('channels');
  assert.equal(await root.locator('.cl-directory-list .cl-shelf-channel').count(),12);
  await snap('channels-list-dark');
  await page.locator('#chanlume-shelf-sticky [data-shelf-action=collections]').click();
  assert.equal(await root.locator('.cl-collection').count(),3);
  assert.equal(await root.locator('[data-shelf-input=sort]').isVisible(),true);
  await root.locator('[data-shelf-input=sort]').selectOption('name');
  assert.equal(await root.locator('.cl-collection h2').first().innerText(),'A slower afternoon');
  await root.locator('[data-shelf-action=grid]').click();
  await snap('collections-dark');
  await root.locator('[data-shelf-action=open][data-id=design]').click();
  assert.equal(await root.getAttribute('data-page'),'collection-feed');
  assert.equal(await root.locator('.cl-shelf-header .cl-shelf-tabs,.cl-shelf-header .cl-shelf-controls,.cl-shelf-header input,.cl-shelf-header select').count(),0);
  assert.equal(await page.locator('#chanlume-shelf-sticky').isVisible(),false);
  assert.equal(await root.locator('.cl-shelf-header button').count(),1);
  assert.ok(Math.abs((await root.locator('.cl-collection-context').boundingBox()).x-(await root.boundingBox()).x-32)<2);
  assert.equal(await root.locator('.cl-collection-context h1 span:last-child').innerText(),'Design & craft');
  assert.equal(await root.locator('.cl-shelf-video').count(),5);
  await snap('collection-feed-dark');
  const before=await page.evaluate(()=>__operations.length);
  await root.locator('[data-shelf-action=members]').click();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>__operations.length),before);
  await page.goBack();assert.equal(await root.getAttribute('data-page'),'collections');
  assert.equal(await root.locator('[data-shelf-input=sort]').inputValue(),'name');
  await selectScope(page,'design');
  assert.equal(await root.getAttribute('data-page'),'subscriptions');
  assert.equal(await root.locator('.cl-category-chip[data-id=design]').getAttribute('aria-pressed'),'true');
  await page.locator('#chanlume-shelf-sticky [data-shelf-action=collections]').click();
  await root.locator('[data-shelf-action=open][data-id=design]').click();
  assert.equal(await root.getAttribute('data-page'),'collection-feed');
  await page.evaluate(()=>document.documentElement.removeAttribute('dark'));
  await snap('collection-feed-light');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await snap('collection-feed-mobile');
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('#chanlume-guide-section [data-cl-action=collections]').click();
  assert.equal(await root.locator('.cl-design-icon[src$="edit.svg"]').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth===24&&e.getBoundingClientRect().width===24)),true);
  // A cold direct link filters already loaded native YouTube cards without a channel fetch.
  await page.goto('http://127.0.0.1:18766/tests/shelf-harness.html#chanlume-group=design&chanlume-view=timeline');
  await page.waitForFunction(()=>document.querySelectorAll('.cl-shelf-video').length===5);
  assert.equal(await root.locator('.cl-category-chip[data-id=design]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>(globalThis.__recentCalls||[]).length),0);
  assert.deepEqual(errors,[]);
  console.log('PASS Figma pages: expandable category scope, native-feed classification and preserved view, mobile width, quiet collection feed, controls, directory, sorting, edit SVG, back, no data writes or per-channel reads.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
