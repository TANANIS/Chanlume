const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.env.CHANLUME_NODE_MODULES,'playwright'));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const scripts=['startup.js','dom.js'].map(name=>fs.readFileSync(`extension/content/${name}`,'utf8')).join('\n')+'\n'+fs.readFileSync('extension/shared.js','utf8')+'\n'+['favorites.js','recent.js','subscriptions.js','navigation.js','content.js'].map(name=>fs.readFileSync(`extension/content/${name}`,'utf8')).join('\n');
 const css=fs.readFileSync('extension/content/content.css','utf8')+'\n'+fs.readFileSync('extension/content/subscriptions.css','utf8');
 const html=`<!doctype html><html dark><head><style>${css}</style></head><body><div id="unrelated">Unrelated page content</div><ytd-guide-renderer><div id="sections"><div id="native-nav">Native guide</div></div></ytd-guide-renderer><ytd-browse page-subtype="subscriptions"><div id="primary"><div id="native-feed">Native feed</div></div></ytd-browse></body></html>`;
 const output='work/subscriptions-ui-20261020/startup';fs.mkdirSync(output,{recursive:true});
 try {
  for(const scenario of ['enabled','disabled','timeout']) {
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://127.0.0.1:18766/feed/subscriptions**',route=>route.fulfill({contentType:'text/html',body:html}));
   await page.addInitScript(({scenario})=>{
    window.__samples=[];window.__reads=0;
    const state={revision:1,settings:{enabled:scenario!=='disabled',language:'en',hideShorts:true,onboardingComplete:true},channels:{'/@demo0':{name:'Studio North',url:'https://www.youtube.com/@demo0'}},groups:[{id:'design',name:'Design',color:'#7c5cff',icon:'book',channelIds:['/@demo0']}]};
    window.__change=()=>{state.revision++;state.groups[0].name='Design renamed';window.__storageListener?.({chanlumeState:{newValue:structuredClone(state)}},'local');};
    window.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async()=>({ok:true})},storage:{local:{get:()=>{__reads++;return new Promise(resolve=>{if(scenario!=='timeout')setTimeout(()=>resolve({chanlumeState:structuredClone(state)}),500);});}},onChanged:{addListener:fn=>window.__storageListener=fn}}};
    function sample(){const raw=document.querySelector('#native-nav'),primary=document.querySelector('#native-feed'),other=document.querySelector('#unrelated');const visible=el=>!!el&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).opacity!=='0'&&getComputedStyle(el).display!=='none'&&!!el.getClientRects().length;__samples.push({raw:visible(raw),feed:visible(primary),nativeDisplay:primary?getComputedStyle(primary).display:'',other:visible(other),own:!!document.querySelector('#chanlume-guide-section')});if(__samples.length<180)requestAnimationFrame(sample);}
    requestAnimationFrame(sample);
   },{scenario});
   await page.addInitScript({content:scripts});
   await page.goto('http://127.0.0.1:18766/feed/subscriptions#chanlume-view=channels');
   if(scenario==='enabled') {
    await page.locator('#chanlume-guide-section').waitFor();await page.locator('[data-shelf-input=channels]').waitFor();
    await page.waitForFunction(()=>__samples.length>=12);
    const samples=await page.evaluate(()=>__samples);assert.equal(samples.some(s=>s.raw||s.feed),false);assert.equal(samples.some(s=>s.nativeDisplay==='none'),false,'native first-load layout must never be display:none');assert.ok(samples.some(s=>s.other));assert.ok(samples.some(s=>s.other&&!s.own), "must sample the visible page while storage is still pending");
    assert.equal(await page.evaluate(()=>__reads),1);
    await page.locator('[data-shelf-input=channels]').fill('Studio');
    await page.evaluate(()=>{window.__held={guide:document.querySelector('[data-cl-action=collections]'),input:document.querySelector('[data-shelf-input=channels]'),channel:document.querySelector('.cl-shelf-channel')};__held.input.focus();__change();});
    await page.waitForFunction(()=>document.querySelector('#chanlume-guide-section').textContent.includes('renamed'));
    assert.equal(await page.evaluate(()=>__held.guide===document.querySelector('[data-cl-action=collections]')&&__held.input===document.querySelector('[data-shelf-input=channels]')&&__held.channel===document.querySelector('.cl-shelf-channel')&&document.activeElement===__held.input),true);
    await page.evaluate(()=>document.body.insertAdjacentHTML('beforeend','<ytd-mini-guide-renderer><div id="items"><a id="native-mini">Native mini</a></div></ytd-mini-guide-renderer>'));
    await page.locator('#chanlume-mini-guide').waitFor();
    assert.equal(await page.locator('#native-mini').isVisible(),false);
    fs.writeFileSync(`${output}/frames.json`,JSON.stringify(samples,null,2));
   } else {
    await page.waitForFunction(()=>{const el=document.querySelector('#native-nav');return el && getComputedStyle(el).visibility==='visible'&&el.getClientRects().length;},{timeout:6000});
    assert.equal(await page.locator('#unrelated').isVisible(),true);
    assert.equal(await page.locator('#chanlume-guide-section').count(),0);
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  // Reproduce a fresh Timeline URL before YouTube has mounted any cards. The
  // native source must retain its original layout until YouTube supplies data.
  const cold=await browser.newPage(),coldErrors=[];cold.on('pageerror',e=>coldErrors.push(e.message));
  await cold.route('http://127.0.0.1:18766/feed/subscriptions**',route=>route.fulfill({contentType:'text/html',body:html}));
  await cold.addInitScript(()=>{
    const state={revision:1,settings:{enabled:true,language:'en',hideShorts:true,onboardingComplete:true},channels:{'/@demo0':{name:'Studio North',url:'https://www.youtube.com/@demo0'}},groups:[{id:'design',name:'Design',color:'#7c5cff',icon:'book',channelIds:['/@demo0']}]};
    window.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async()=>({ok:true})},storage:{local:{get:async()=>({chanlumeState:state})},onChanged:{addListener(){}}}};
  });
  await cold.addInitScript({content:scripts});
  await cold.goto('http://127.0.0.1:18766/feed/subscriptions#chanlume-group=design&chanlume-view=timeline');
  await cold.locator('[data-shelf-input=view]').waitFor();
  await cold.waitForFunction(()=>document.querySelector('#primary')?.classList.contains('chanlume-shelf-awaiting-native'));
  const before=await cold.evaluate(()=>{const primary=document.querySelector('#primary'),native=document.querySelector('#native-feed');return {hiddenDisplay:getComputedStyle(native).display,opacity:getComputedStyle(native).opacity,custom:primary.classList.contains('chanlume-shelf-custom'),early:document.documentElement.classList.contains('chanlume-early-custom')};});
  assert.equal(before.custom,false,'custom mode must wait for the first native source card');
  assert.notEqual(before.hiddenDisplay,'none','cold native renderer must be allowed to mount');
  assert.equal(before.opacity,'0','hide raw native visuals without collapsing layout');
  assert.equal(before.early,false,'document-start custom suppression must be released after initialization');
  await cold.evaluate(()=>{
    const card=document.createElement('ytd-rich-item-renderer');
    card.innerHTML='<yt-lockup-view-model><a id="thumbnail" href="/watch?v=demo0000000"><img src="https://i.ytimg.com/vi/demo0000000/mqdefault.jpg"></a><yt-lockup-metadata-view-model><h3><a id="video-title" href="/watch?v=demo0000000">Loaded after cold Timeline entry</a></h3><yt-content-metadata-view-model><div class="ytContentMetadataViewModelMetadataRow"><a id="channel-name" href="/@demo0">Studio North</a></div><div class="ytContentMetadataViewModelMetadataRow">1 day ago</div></yt-content-metadata-view-model></yt-lockup-metadata-view-model></yt-lockup-view-model>';
    document.querySelector('#native-feed').append(card);
  });
  await cold.waitForFunction(()=>document.querySelectorAll('a.cl-shelf-video').length===1);
  assert.equal(await cold.locator('.cl-shelf-video strong').innerText(),'Loaded after cold Timeline entry');
  assert.equal(await cold.locator('#primary').evaluate(el=>el.classList.contains('chanlume-shelf-custom')),true,'custom Timeline takes over only after YouTube data arrives');
  assert.deepEqual(coldErrors,[]);await cold.close();
  // Verify retained image identity and keyed reordering, including focus and open details.
  const page=await browser.newPage();await page.goto('http://127.0.0.1:18766/tests/shelf-harness.html');await page.locator('[data-shelf-input=view]').waitFor();
  await page.locator('[data-shelf-input=view]').selectOption('channels');
  const stable=await page.evaluate(()=>{
   const host=document.createElement('div');document.body.append(host);
   ChanlumeDom.patch(host,'<a href="/a"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></a><a href="/b">B</a><details><summary>Dates</summary><input value="one"></details>');
   const a=host.querySelector('a'),img=host.querySelector('img'),details=host.querySelector('details');details.open=true;
   ChanlumeDom.patch(host,'<a href="/b">B updated</a><a href="/a"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></a><details><summary>Dates</summary><input value="two"></details>');
   return a===host.querySelectorAll('a')[1]&&img===host.querySelector('img')&&details===host.querySelector('details')&&details.open&&details.querySelector('input').value==='two';
  });assert.equal(stable,true);await page.close();
  console.log('PASS startup: document-start pre-paint region gating, unrelated content visible, one state read, disabled restore, bounded failure restore, late hosts before paint, stable guide/input/channel/image identity, focus, keyed reorder and open details.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
