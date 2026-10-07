const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../extension/shared.js');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext({viewport:{width:460,height:600}});
    let saved = Core.normalizeState({revision:1, channels:{
      '/@tenacioustrilobite':{id:'/@tenacioustrilobite',name:'Tenacious Trilobite'},
      '/@waiting':{id:'/@waiting',name:'Waiting'},
      ...Object.fromEntries(Array.from({length:414},(_,i)=>['/@channel'+i,{id:'/@channel'+i,name:'Channel '+i}]))
    }, groups:Array.from({length:10},(_,i)=>({id:'g'+i,name:['學習與成長','遊戲','音樂','科技與開發','生活與興趣'][i%5],color:'#7c5cff',channelIds:i===0?['/@tenacioustrilobite']:[]})),
    settings:{enabled:true,language:'zh-TW',blockHome:true,hideShorts:true,hideSecondary:true,disableAutoplay:true}});
    const original = structuredClone(saved);
    const errors=[];
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    await context.exposeFunction('__readState',()=>structuredClone(saved));
    await context.exposeFunction('__sendRuntime',async message=>{
      if(message.type!=='CHANLUME_MUTATE') return {ok:true};
      saved={...Core.applyStateOperation(saved,message.operation),revision:saved.revision+1};
      for(const page of context.pages()) await page.evaluate(next=>globalThis.__storageListener?.({chanlumeState:{newValue:next}},'local'),saved);
      return {ok:true,state:structuredClone(saved)};
    });
    await context.addInitScript(()=>{
      globalThis.chrome={storage:{local:{get:async()=>({chanlumeState:await __readState()})},onChanged:{addListener:fn=>globalThis.__storageListener=fn}},
        runtime:{sendMessage:message=>__sendRuntime(message),onMessage:{addListener(){}},openOptionsPage(){}},
        tabs:{query:async()=>[{id:1,url:'https://www.youtube.com/feed/subscriptions'}]}};
    });
    const subscriptionsRoute = route=>{
      const source=fs.readFileSync(path.join(__dirname,'subscriptions-harness.html'),'utf8').replace(/<script>[\s\S]*?<\/script>/,'<script>history.replaceState({}, "", "/feed/subscriptions#chanlume-group=unfiled");</script>')
        .replace('<script src="/extension/shared.js">','<button class="ytp-autonav-toggle-button" aria-checked="true" onclick="this.setAttribute(\'aria-checked\',String(this.getAttribute(\'aria-checked\')!==\'true\'))">Autoplay</button><script src="/extension/shared.js">');
      return route.fulfill({contentType:'text/html; charset=utf-8',body:source});
    };
    await context.route('**/tests/subscriptions-harness.html',subscriptionsRoute);
    await context.route('**/feed/subscriptions',subscriptionsRoute);
    const youtube=await context.newPage();
    await youtube.goto('http://127.0.0.1:18766/tests/subscriptions-harness.html');
    await youtube.waitForFunction(()=>document.querySelector('#categorized-card')?.classList.contains('chanlume-hidden'));
    assert.equal(await youtube.locator('#chanlume-toolbar .cl-support-link').count(),0);
    assert.equal(await youtube.locator('.ytp-autonav-toggle-button').getAttribute('aria-checked'),'false');
    const popup=await context.newPage();
    await popup.goto('http://127.0.0.1:18766/extension/popup/popup.html');
    await popup.waitForFunction(()=>document.querySelector('#groups').children.length===10);
    assert.equal(await popup.locator('#channel-count').innerText(),'416');
    assert.equal(await popup.locator('#open-home').isVisible(),false);
    const layout=await popup.evaluate(()=>({width:document.body.scrollWidth,height:document.body.scrollHeight,groups:document.querySelector('#groups').getBoundingClientRect().height,supportBottom:document.querySelector('.support-card').getBoundingClientRect().bottom}));
    assert.equal(layout.width,460);
    assert.ok(layout.height<=600,JSON.stringify(layout));
    assert.ok(layout.groups>=200,JSON.stringify(layout));
    assert.ok(layout.supportBottom<=600,JSON.stringify(layout));
    await popup.screenshot({path:path.join(__dirname,'../work/popup-1.19.3-on.png')});
    await popup.locator('#power-toggle').click();
    await youtube.waitForFunction(()=>document.documentElement.classList.contains('chanlume-disabled'));
    assert.equal(await youtube.locator('#chanlume-toolbar, #chanlume-guide-section, .chanlume-hidden, .chanlume-shorts-hidden, .chanlume-card-classification').count(),0);
    assert.equal(await youtube.locator('.ytp-autonav-toggle-button').getAttribute('aria-checked'),'true');
    assert.equal(await youtube.locator('#shorts-shelf').evaluate(el=>getComputedStyle(el).display!=='none'),true);
    assert.equal(await popup.locator('#power-toggle').getAttribute('aria-pressed'),'false');
    assert.equal(await popup.locator('#open-home').isVisible(),true);
    assert.equal(await popup.locator('#groups button:disabled').count(),10);
    assert.deepEqual(saved.channels,original.channels);
    assert.deepEqual(saved.groups,original.groups);
    await popup.screenshot({path:path.join(__dirname,'../work/popup-1.19.3-off.png')});
    await youtube.reload();
    await youtube.locator('#categorized-card').waitFor();
    await youtube.waitForTimeout(350);
    assert.equal(await youtube.locator('#chanlume-toolbar, .chanlume-hidden').count(),0);
    await popup.reload();
    await popup.waitForFunction(()=>document.querySelector('#power-toggle').getAttribute('aria-pressed')==='false');
    await popup.locator('#power-toggle').click();
    await youtube.waitForFunction(()=>document.querySelector('#chanlume-toolbar') && document.querySelector('#categorized-card').classList.contains('chanlume-hidden'));
    assert.deepEqual(saved.groups,original.groups);
    assert.equal(saved.settings.hideShorts,true);
    // MAIN bridge also stops inspecting and resumes after a power transition.
    const identity=await context.newPage();
    await identity.goto('http://127.0.0.1:18766/tests/identity-scan-harness.html');
    await identity.waitForFunction(()=>__capturedIdentities.length>0);
    await identity.evaluate(()=>window.postMessage({source:'chanlume-identity-bridge',type:'SET_ENABLED',enabled:false},location.origin));
    await identity.waitForTimeout(50);
    await identity.evaluate(()=>{__capturedIdentities.length=0; const card=document.querySelector('ytd-channel-renderer').cloneNode(true);card.data={browseEndpoint:{browseId:'UCaaaaaaaaaaaaaaaaaaaaaa',canonicalBaseUrl:'/@power-test'}};document.body.append(card);});
    await identity.waitForTimeout(350);
    assert.equal(await identity.evaluate(()=>__capturedIdentities.length),0);
    await identity.evaluate(()=>window.postMessage({source:'chanlume-identity-bridge',type:'SET_ENABLED',enabled:true},location.origin));
    await identity.waitForFunction(()=>__capturedIdentities.some(item=>item.alias==='/@power-test'));
    assert.deepEqual(errors,[]);
    console.log('Power smoke passed: popup layout, semantic toggle, live native-YouTube cleanup, autoplay restore, retained data, disabled reload, resume filtering, bridge suspension. Layout:',layout);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
