const {selectScope}=require('./navigation-actions.cjs');
// Opt-in public network check. Uses an isolated fixture, never the user's browser profile.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../extension/shared.js');
const {chromium}=require(path.join(process.env.CHANLUME_NODE_MODULES,'playwright'));
(async()=>{
 const state=Core.normalizeState({channels:{'/@ted':{name:'TED',url:'https://www.youtube.com/@TED'}},groups:[{id:'public-ted',name:'TED 公開資料驗證',channelIds:['/@ted']}],settings:{enabled:true,hideShorts:true,language:'zh-TW',onboardingComplete:true}});
 let listener;const requests=[];
 const context={console,URL,AbortController,setTimeout,clearTimeout,fetch:async(address,options)=>{const response=await fetch(address,options);requests.push({address,status:response.status});return response;},chrome:{storage:{local:{get:async()=>({chanlumeState:state})}},runtime:{onMessage:{addListener:fn=>listener=fn},onInstalled:{addListener(){}}}},importScripts(){context.ChanlumeCore=Core;}};
 vm.runInNewContext(fs.readFileSync('extension/background.js','utf8'),context);
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const output='work/subscriptions-ui-20261020/recent';fs.mkdirSync(output,{recursive:true});
 try {
  await page.exposeFunction('__publicFeed',message=>new Promise(resolve=>listener(message,{},resolve)));
  await page.goto('http://127.0.0.1:18766/tests/shelf-harness.html');await page.locator('[data-shelf-input=view]').waitFor();
  await page.evaluate(next=>{
   document.querySelector('#native-feed').replaceChildren();const original=chrome.runtime.sendMessage;
   chrome.runtime.sendMessage=message=>message.type==='CHANLUME_CHANNEL_FEED'?__publicFeed(message):original(message);
   next.revision=__state().revision+1;__change(next);
  },state);
  await selectScope(page,'public-ted');
  await page.locator('[data-shelf-input=view]').selectOption('timeline');
  await page.waitForFunction(()=>document.querySelector('.cl-recent-status')?.textContent.includes('1 / 1'),{timeout:30000});
  assert.equal(await page.locator('.cl-recent-errors').count(),0);
  assert.ok(await page.locator('.cl-shelf-video').count()>0);
  await page.waitForFunction(()=>[...document.querySelectorAll('.cl-shelf-video img')].some(img=>img.complete&&img.naturalWidth>0),{timeout:15000});
  const report={kind:'isolated fixture with actual public YouTube data',requests,videos:await page.locator('.cl-shelf-video').count(),datedGroups:await page.locator('.cl-timeline-day h2').allInnerTexts(),loadedImages:await page.locator('.cl-shelf-video img').evaluateAll(imgs=>imgs.filter(img=>img.complete&&img.naturalWidth>0).length)};
  fs.writeFileSync(`${output}/public-group-live.json`,JSON.stringify(report,null,2));
  await page.locator('.cl-shelf-video img').evaluateAll(imgs=>Promise.all(imgs.filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{}))));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  report.visibleImages=await page.locator('.cl-shelf-video img').evaluateAll(imgs=>imgs.filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>({src:i.src,natural:[i.naturalWidth,i.naturalHeight],rendered:[i.getBoundingClientRect().width,i.getBoundingClientRect().height]})));
  fs.writeFileSync(`${output}/public-group-live.json`,JSON.stringify(report,null,2));
  await page.screenshot({path:`${output}/public-ted-timeline.png`});
  console.log('PASS public channel integration:',JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
