const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(path.join(process.env.CHANLUME_NODE_MODULES,'playwright'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const language of ['en','zh-TW']) {
      const page=await browser.newPage({viewport:{width:1280,height:850}});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/extension/dashboard/dashboard.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../extension/dashboard/dashboard.js'),'utf8').replace('location.protocol === "chrome-extension:" &&','')}));
      await page.addInitScript(language=>{
        let listener;
        let state=JSON.parse(localStorage.getItem('classification-fixture')||'null')||{
          settings:{language,onboardingComplete:true},
          groups:[{id:'music-custom',name:'音樂',color:'#ff6b8a',icon:'music',channelIds:['/@filed']}],
          channels:{
            '/@filed':{name:'Existing choice',description:'Cooking'},
            '/@strong':{name:'Music Studio',description:'Music piano',recentTitles:['Music lesson one','Music lesson two','Music lesson three']},
            '/@weak':{name:'Quiet creator',description:'Music'},
            '/@mixed':{name:'Mixed creator',description:'Music piano cooking recipe'},
            '/@unknown':{name:'Unknown creator',description:''}
          },manualLabels:{'/@filed':['music-custom']}
        };
        Object.values(state.channels).forEach(channel=>{channel.profileVersion=5;channel.profiledAt=Date.now();});
        globalThis.__state=()=>state;
        globalThis.__operations=[];
        globalThis.__change=next=>{state=ChanlumeCore.normalizeState(next);localStorage.setItem('classification-fixture',JSON.stringify(state));listener?.({chanlumeState:{newValue:state}},'local');};
        globalThis.chrome={storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,key==='chanlumeState'?state:undefined]))},onChanged:{addListener:fn=>listener=fn}},runtime:{sendMessage:async message=>{
          if(message.type!=='CHANLUME_MUTATE')return{ok:true};
          __operations.push(message.operation.type);
          if(globalThis.__failSave && message.operation.type==='auto-classify')return{ok:false,error:'Fixture save failure'};
          const next=ChanlumeCore.applyStateOperation(state,message.operation);next.revision=state.revision+1;__change(next);return{ok:true,state};
        }},tabs:{create:async()=>({id:1})}};
      },language);
      await page.goto('http://127.0.0.1:18766/extension/dashboard/dashboard.html');
      await page.evaluate(()=>{__failSave=true;});
      await page.locator('#auto-organize').click();
      await page.locator('#auto-retry').waitFor({state:'visible'});
      assert.equal(await page.locator('#auto-apply, #auto-results, #auto-start').count(),0);
      assert.ok((await page.locator('#auto-save-error').innerText()).length>0);
      assert.equal(await page.evaluate(()=>__state().groups.length),1);
      assert.equal(await page.evaluate(()=>ChanlumeCore.unfiledChannelIds(__state()).length),4);
      // Another tab manually files one channel before retry. It must win.
      await page.evaluate(()=>{const next=ChanlumeCore.applyStateOperation(__state(),{type:'toggle-membership',payload:{groupId:'music-custom',channelId:'/@mixed',enabled:true}});next.revision++;__change(next);__failSave=false;});
      await page.locator('#auto-retry').click();
      await page.locator('#auto-dialog').waitFor({state:'hidden'});
      const state=await page.evaluate(()=>__state());
      assert.equal(await page.locator('#stat-progress').innerText(),'100%');
      for(const id of Object.keys(state.channels)) assert.equal(state.groups.filter(group=>group.channelIds.includes(id)).length,1);
      assert.ok(state.groups.find(group=>group.id==='music-custom').channelIds.includes('/@weak'));
      assert.ok(state.groups.find(group=>group.name===(language==='en'?'Other':'其他')).channelIds.includes('/@unknown'));
      assert.deepEqual(state.manualLabels,{'/@filed':['music-custom'],'/@mixed':['music-custom']});
      await page.screenshot({path:`work/classification-direct-${language}.png`,fullPage:true});
      await page.reload();
      assert.equal(await page.locator('#stat-progress').innerText(),'100%');
      await page.locator('#auto-organize').click();
      await page.locator('#auto-dialog').waitFor({state:'hidden'});
      assert.deepEqual((await page.evaluate(()=>__state())).groups,state.groups);
      // Cancellation while fetching public metadata never commits classification.
      await page.evaluate(()=>{const next=structuredClone(__state());next.channels['/@cancel']={id:'/@cancel',name:'Cancel fixture',url:'https://www.youtube.com/@cancel',profileVersion:0};next.revision++;__change(next);});
      let requested;
      const requestSeen=new Promise(resolve=>requested=resolve);
      let release;
      const requestGate=new Promise(resolve=>release=resolve);
      await page.route('https://www.youtube.com/@cancel/videos',async route=>{requested();await requestGate;await route.fulfill({body:'<html></html>'}).catch(()=>{});});
      const before=await page.evaluate(()=>__operations.filter(type=>type==='auto-classify').length);
      await page.locator('#auto-organize').click();
      await requestSeen;
      await page.locator('#auto-cancel').click();
      release();
      await page.waitForFunction(()=>!document.getElementById('auto-organize').disabled);
      assert.equal(await page.evaluate(()=>__operations.filter(type=>type==='auto-classify').length),before);
      assert.deepEqual(await page.evaluate(()=>ChanlumeCore.unfiledChannelIds(__state())),['/@cancel']);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('Direct classification smoke passed: one-click save, all channels assigned, weak signals, Other fallback, existing/manual choices, retry, cross-tab edit, cancellation and reload persistence in both languages.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});