// Local synthetic diagnostics; does not modify the extension or user profiles.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
const shared = read('work/performance-baseline/shared.js');
const content = read('work/performance-baseline/content.js');
const bridge = read('work/performance-baseline/identity-bridge.js');
const result = { date: new Date().toISOString(), baselineVersion: '1.18.4', version: JSON.parse(read('extension/manifest.json')).version, synthetic: true,
  sourceHashes: Object.fromEntries(['extension/shared.js', 'extension/content/content.js', 'extension/content/identity-bridge.js'].map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')])), runs: [] };
const instrument = source => source.replace('function findChannelInCard(card) {', 'function findChannelInCard(card) { globalThis.__cardVisits = (globalThis.__cardVisits || 0) + 1;').replace('  init();', `
  globalThis.__audit = { applyFilters, acceptState, refreshFromState };
  init();`);
const setup = `
  history.replaceState({}, '', '/feed/subscriptions');
  const channels = Object.fromEntries(Array.from({length: 500}, (_, i) => {
    const id = '/@channel' + i;
    return [id, {id, name: 'Channel ' + i, url: 'https://www.youtube.com' + id,
      description: 'Public channel description. '.repeat(30),
      recentTitles: Array.from({length:20}, (_, j) => 'Recent video title ' + j)}];
  }));
  const groups = Array.from({length:10}, (_, i) => ({id: 'group'+i, name:'Group '+i, color:'#7c5cff',
    channelIds:Object.keys(channels).filter((_, j) => j%10 === i)}));
  globalThis.__state = {version:14, revision:1, channels, groups, settings:{language:'en', hideShorts:false, blockHome:false, disableAutoplay:false}};
  globalThis.chrome = {storage:{local:{get:async()=>({chanlumeState:__state})},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}},sendMessage:async()=>({ok:true})}};
  document.querySelector('#feed').innerHTML = Array.from({length:200}, (_, i) =>
    '<ytd-rich-item-renderer><yt-content-metadata-view-model><div class="ytContentMetadataViewModelMetadataRow"><a href="/@channel'+i+'">Channel '+i+'</a></div></yt-content-metadata-view-model></ytd-rich-item-renderer>').join('');
  globalThis.__calls = 0;
  const original = ChanlumeCore.groupForChannel;
  ChanlumeCore.groupForChannel = (...args) => { __calls++; return original(...args); };
`;
const server = http.createServer((req, res) => {
  const mode = req.url.includes('candidate') ? 'candidate' : 'baseline';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<body><ytd-guide-renderer><div id="sections"></div></ytd-guide-renderer><ytd-browse page-subtype="subscriptions"><div id="primary"><main id="feed"></main></div></ytd-browse><script>${mode === 'candidate' ? read('extension/shared.js') : shared}</script><script>${setup}</script><script>${instrument(mode === 'candidate' ? read('extension/content/content.js') : content)}</script></body>`);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel:'msedge', headless:true});
  result.browser = browser.version();
  try {
    for (const mode of ['baseline', 'candidate', 'baseline', 'candidate']) {
      const page = await browser.newPage();
      page.on('pageerror', error => console.error('PAGE ERROR', error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode}`);
      console.log(mode, await page.evaluate(() => ({url:location.href, cards:document.querySelectorAll('ytd-rich-item-renderer').length, badges:document.querySelectorAll('.chanlume-card-classification').length, core:!!globalThis.ChanlumeCore, audit:!!globalThis.__audit})));
      await page.waitForFunction(() => document.querySelectorAll('.chanlume-card-classification').length === 200);
      await page.waitForTimeout(400);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      const before = await cdp.send('Runtime.getHeapUsage');
      const timings = await page.evaluate(() => {
        const runs = [];
        for(let i=0;i<3;i++) { const start=performance.now(); __audit.applyFilters(); runs.push(performance.now()-start); }
        return runs;
      });
      const after = await cdp.send('Runtime.getHeapUsage');
      await page.evaluate(() => { __calls=0; __cardVisits=0; const card=document.createElement('ytd-rich-item-renderer'); card.innerHTML='<yt-content-metadata-view-model><div class="ytContentMetadataViewModelMetadataRow"><a href="/@channel0">Channel 0</a></div></yt-content-metadata-view-model>'; document.querySelector('#feed').append(card); });
      await page.waitForTimeout(700);
      const incrementalCalls = await page.evaluate(() => __cardVisits);
      const currentCalls = incrementalCalls;
      await page.waitForTimeout(500);
      const idleExtraCalls = await page.evaluate(() => __cardVisits) - currentCalls;
      result.runs.push({mode, channels:500, cards:200, filterMs:timings, transientHeapDeltaBytes:after.usedSize-before.usedSize, incrementalCalls, idleExtraCalls});
      await page.close();
    }
    for(const mode of ['baseline','candidate']) {
      const page=await browser.newPage();
      await page.route('**/*', route => route.fulfill({contentType:'text/html',body:'<body></body>'}));
      await page.goto('http://127.0.0.1/feed/channels');
      await page.evaluate(() => { window.ytInitialData={contents:Array.from({length:10000}, (_, i)=>({title:'Synthetic payload '+i, text:'x'.repeat(100)}))}; window.__payloadRef=new WeakRef(window.ytInitialData); });
      let source=bridge;
      if(mode==='candidate') source=read('extension/content/identity-bridge.js');
      if(mode==='candidate') assert.notEqual(source,bridge);
      await page.addScriptTag({content:source});
      if(mode==='candidate') {
        await page.evaluate(() => window.postMessage({source:'chanlume-identity-bridge',type:'SET_ENABLED',enabled:true},location.origin));
        await page.waitForTimeout(50);
      }
      await page.evaluate(() => { history.replaceState({}, '', '/watch?v=synthetic'); window.ytInitialData={}; document.dispatchEvent(new Event('yt-navigate-finish')); });
      await page.waitForTimeout(350);
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('HeapProfiler.collectGarbage');
      result.runs.push({mode, oldInitialPayloadRetained:await page.evaluate(()=>Boolean(__payloadRef.deref()))});
      await page.close();
    }
    fs.writeFileSync(path.join(__dirname,'performance-audit-results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally { await browser.close(); server.close(); }
})().catch(error=>{ console.error(error); server.close(); process.exitCode=1; });
