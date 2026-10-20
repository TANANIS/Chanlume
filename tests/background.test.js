const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../extension/shared.js");

function loadBackground(initialState, fetchImpl, rawStore) {
  const store = rawStore || { chanlumeState: Core.normalizeState(initialState) };
  let messageListener = null;
  let installListener = null;
  const openedTabs = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    URL,
    fetch: fetchImpl,
    chrome: {
      storage: {
        local: {
          get: async (key) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return typeof key === "string" ? { [key]: store[key] } : { ...store };
          },
          set: async (values) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            Object.assign(store, values);
          }
        }
      },
      runtime: {
        onInstalled: { addListener: (listener) => { installListener = listener; } },
        getURL: (relative) => `chrome-extension://test-id/${relative}`,
        onMessage: { addListener: (listener) => { messageListener = listener; } },
        openOptionsPage: async () => {}
      },
      tabs: { update: async () => ({}), create: async (options) => { openedTabs.push({ ...options, storedState: store.chanlumeState }); return { id: 1 }; }, remove: async () => {} },
      action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} },
      i18n: { getUILanguage: () => "en" }
    }
  };
  context.globalThis = context;
  context.importScripts = () => { context.ChanlumeCore = Core; };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../extension/background.js"), "utf8"), context, { filename: "background.js" });
  return {
    store,
    openedTabs,
    install: (reason) => installListener({ reason }),
    send(message) {
      return new Promise((resolve, reject) => {
        const keepAlive = messageListener(message, { tab: { id: 1, url: "https://www.youtube.com/" } }, resolve);
        if (keepAlive !== true) reject(new Error("Background listener did not keep the response channel open"));
      });
    }
  };
}

test("recent channel feeds work for non-favorites, verify owner, exclude Shorts and join exact Atom dates without writes", async () => {
  const owner='UCabcdefghijklmnopqrstuv';
  const data={metadata:{channelMetadataRenderer:{externalId:owner}},contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,endpoint:{commandMetadata:{webCommandMetadata:{url:'/@one/videos'}}},content:{richGridRenderer:{contents:[{richItemRenderer:{content:{videoRenderer:{videoId:'normal00001',title:{simpleText:'Normal upload'},publishedTimeText:{simpleText:'1 day ago'}}}}}]}}}}]}}};
  const xml=`<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>${owner}</yt:channelId><entry><yt:videoId>normal00001</yt:videoId><title>Normal &amp; upload</title><published>2026-10-20T10:00:00Z</published></entry><entry><yt:videoId>shorts00001</yt:videoId><title>A Short</title><published>2026-10-20T11:00:00Z</published></entry></feed>`;
  const urls=[];
  const background=loadBackground({channels:{'/@one':{name:'One'}},settings:{hideShorts:true}},async url=>{urls.push(url);return{ok:true,text:async()=>url.includes('/feeds/')?xml:`<script id="yt-initial-data" type="application/json">${JSON.stringify(data)}</script>`};});
  const before=JSON.stringify(background.store);
  const result=await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one'});
  assert.equal(result.ok,true);assert.equal(result.videos.length,1);assert.equal(result.videos[0].published,'2026-10-20T10:00:00Z');
  assert.equal(result.videos[0].image,'https://i.ytimg.com/vi/normal00001/mqdefault.jpg');assert.equal(JSON.stringify(background.store),before);
  await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one'});assert.equal(urls.length,2);
  const rejected=await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@unknown'});assert.equal(rejected.ok,false);assert.equal(urls.length,2);
  background.store.chanlumeState.settings.enabled=false;
  assert.equal((await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one'})).ok,false);
});

test("Atom feed parser rejects owner mismatch and invalid dates, decodes titles once", () => {
  const xml='<feed><yt:channelId>UCowner</yt:channelId><entry><yt:videoId>normal00001</yt:videoId><title>A &amp; B &#x1f600; &amp;lt;</title><published>2026-10-20T10:00:00Z</published></entry></feed>';
  assert.equal(Core.parseYouTubeAtomFeed(xml,'UCowner')[0].title,'A & B 😀 &lt;');
  assert.throws(()=>Core.parseYouTubeAtomFeed(xml,'UCother'));
  assert.throws(()=>Core.parseYouTubeAtomFeed(xml.replace('2026-10-20','2026-02-31'),'UCowner'));
  assert.throws(()=>Core.parseYouTubeAtomFeed('<!DOCTYPE feed>'+xml,'UCowner'));
  assert.deepEqual(Core.parseYouTubeAtomFeed('<feed><yt:channelId>UCowner</yt:channelId></feed>','UCowner'),[]);
});

test("current YouTube Atom headers without UC require canonical-owner corroboration", () => {
  const owner='UCAuUUnT6oDeKwE6v1NGQxug';
  const xml=`<feed><yt:channelId>${owner.slice(2)}</yt:channelId><author><uri>https://www.youtube.com/channel/${owner}</uri></author><entry><yt:channelId>${owner}</yt:channelId><yt:videoId>normal00001</yt:videoId><title>Upload</title><published>2026-10-19T17:00:08+00:00</published></entry></feed>`;
  assert.equal(Core.parseYouTubeAtomFeed(xml,owner).length,1);
  assert.throws(()=>Core.parseYouTubeAtomFeed(xml.replace('<author>','<authorX>').replace('</author>','</authorX>').replace('<uri>','<uriX>').replace('</uri>','</uriX>'),owner));
  assert.throws(()=>Core.parseYouTubeAtomFeed(xml.replace(`<entry><yt:channelId>${owner}`,`<entry><yt:channelId>UCother`),owner));
});

test("recent feed concurrency is bounded and disabled in-flight results cannot publish", async () => {
  const channels=Object.fromEntries([0,1,2,3].map(n=>['/@one'+n,{name:'Channel '+n,channelId:'UC'+String(n).padStart(22,'a')}]));
  const release=[];
  const background=loadBackground({channels,settings:{hideShorts:false}},async address=>{await new Promise(resolve=>release.push(resolve));const owner=new URL(address).searchParams.get('channel_id');return{ok:true,text:async()=>`<feed><yt:channelId>${owner}</yt:channelId></feed>`};});
  const first=[0,1,2].map(n=>background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one'+n}));
  while(release.length<3)await new Promise(resolve=>setTimeout(resolve,2));
  const fourth=await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one3'});assert.equal(fourth.code,'BUSY');
  background.store.chanlumeState.settings.enabled=false;release.forEach(resolve=>resolve());
  const results=await Promise.all(first);assert.ok(results.every(result=>!result.ok&&result.code==='STALE'));
});

test("date-source failure retains verified normal uploads and force retry repairs dates", async () => {
  const owner='UCabcdefghijklmnopqrstuv';
  const data={metadata:{channelMetadataRenderer:{externalId:owner}},contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,endpoint:{commandMetadata:{webCommandMetadata:{url:'/@one/videos'}}},content:{richGridRenderer:{contents:[{richItemRenderer:{content:{videoRenderer:{videoId:'normal00001',title:{simpleText:'Upload'}}}}}]}}}}]}}};
  let failure=true;
  const background=loadBackground({channels:{'/@one':{name:'One'}},settings:{hideShorts:true}},async address=>({ok:!address.includes('/feeds/')||!failure,status:503,text:async()=>address.includes('/feeds/')?`<feed><yt:channelId>${owner}</yt:channelId><entry><yt:videoId>normal00001</yt:videoId><title>Upload</title><published>2026-10-20T10:00:00Z</published></entry></feed>`:`<script id="yt-initial-data">${JSON.stringify(data)}</script>`}));
  const partial=await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one'});assert.equal(partial.ok,true);assert.equal(partial.videos.length,1);assert.equal(partial.dateWarning,'HTTP');assert.equal(partial.videos[0].published,'');
  failure=false;
  const repaired=await background.send({type:'CHANLUME_CHANNEL_FEED',channelId:'/@one',force:true});assert.equal(repaired.videos[0].published,'2026-10-20T10:00:00Z');assert.equal(repaired.dateWarning,'');
});

test("Chanlume update migrates the legacy library, credentials and scan status without resetting data", async () => {
  const legacy = Core.normalizeState({ channels: { '/@one': { name: 'One' } }, favoriteChannelIds: ['/@one'], settings: { onboardingComplete: true, enabled: false } });
  legacy.revision = 12;
  const background = loadBackground(undefined, undefined, { tubeShelfState: legacy, tubeShelfYouTubeApiKey: 'test-key', tubeShelfScanStatus: { state: 'complete', count: 1 } });
  await background.install('update');
  assert.equal(background.openedTabs.length, 0);
  assert.deepEqual(background.store.chanlumeState.favoriteChannelIds, ['/@one']);
  assert.equal(background.store.chanlumeState.settings.onboardingComplete, true);
  assert.equal(background.store.chanlumeState.settings.enabled, false);
  assert.equal(background.store.chanlumeState.revision, 13);
  assert.equal(background.store.chanlumeYouTubeApiKey, 'test-key');
  assert.equal(background.store.chanlumeScanStatus.count, 1);
  assert.deepEqual(background.store.tubeShelfState, legacy);
});

test("new Chanlume values take precedence over retained legacy values, including an empty API key", async () => {
  const current = Core.normalizeState({ settings: { enabled: false } });
  const background = loadBackground(undefined, undefined, { chanlumeState: current, tubeShelfState: Core.defaultState(), chanlumeYouTubeApiKey: '', tubeShelfYouTubeApiKey: 'old-key' });
  await background.install('update');
  assert.equal(background.store.chanlumeState.settings.enabled, false);
  assert.equal(background.store.chanlumeYouTubeApiKey, '');
});

test("legacy messages can mutate a migrated library and a later reset cannot resurrect it", async () => {
  const legacy = Core.normalizeState({ channels: { '/@one': { name: 'One' } } });
  const background = loadBackground(undefined, undefined, { tubeShelfState: legacy });
  const result = await background.send({ type: 'TUBESHELF_MUTATE', operation: { type: 'edit-favorites', payload: { changes: [{ channelId: '/@one', enabled: true }] } } });
  assert.equal(result.ok, true);
  assert.deepEqual(background.store.chanlumeState.favoriteChannelIds, ['/@one']);
  await background.send({ type: 'CHANLUME_MUTATE', operation: { type: 'reset-state' } });
  await background.install('update');
  assert.deepEqual(background.store.chanlumeState.channels, {});
});

test("direct classification uses the queued current state and preserves an earlier manual edit", async () => {
  const background=loadBackground({channels:{'/@one':{name:'One',description:'Music'},'/@two':{name:'Unknown'}},groups:[{id:'mine',name:'Mine',channelIds:[]}]});
  const manual=background.send({type:'CHANLUME_MUTATE',operation:{type:'toggle-membership',payload:{groupId:'mine',channelId:'/@one',enabled:true}}});
  const auto=background.send({type:'CHANLUME_MUTATE',operation:{type:'auto-classify',payload:{channelIds:['/@one','/@two']}}});
  const results=await Promise.all([manual,auto]);
  assert.ok(results.every(result=>result.ok));
  assert.deepEqual(background.store.chanlumeState.groups.find(group=>group.id==='mine').channelIds,['/@one']);
  assert.deepEqual(Core.unfiledChannelIds(background.store.chanlumeState),[]);
  assert.deepEqual(background.store.chanlumeState.manualLabels,{'/@one':['mine']});
});

test("background serializes concurrent state mutations without losing either intent", async () => {
  const initial = Core.defaultState();
  initial.channels = {
    "/@one": { id: "/@one", name: "One", url: "https://www.youtube.com/@one" },
    "/@two": { id: "/@two", name: "Two", url: "https://www.youtube.com/@two" }
  };
  const background = loadBackground(initial);
  const [first, second] = await Promise.all([
    background.send({ type: "CHANLUME_MUTATE", operation: { type: "toggle-membership", payload: { channelId: "/@one", groupId: "learning", enabled: true } } }),
    background.send({ type: "CHANLUME_MUTATE", operation: { type: "toggle-membership", payload: { channelId: "/@two", groupId: "relax", enabled: true } } })
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(background.store.chanlumeState.revision, 2);
  assert.deepEqual(background.store.chanlumeState.groups.find((group) => group.id === "learning").channelIds, ["/@one"]);
  assert.deepEqual(background.store.chanlumeState.groups.find((group) => group.id === "relax").channelIds, ["/@two"]);
});

test("favorites and group selections share the serialized commit queue", async () => {
  const background = loadBackground({ channels: { '/@one': { name: 'One' } } });
  const results = await Promise.all([
    background.send({ type: 'CHANLUME_MUTATE', operation: { type: 'edit-favorites', payload: { changes: [{ channelId: '/@one', enabled: true }] } } }),
    background.send({ type: 'CHANLUME_MUTATE', operation: { type: 'edit-memberships', payload: { groupId: 'learning', changes: [{ channelId: '/@one', enabled: true }] } } })
  ]);
  assert.ok(results.every(result => result.ok));
  assert.equal(background.store.chanlumeState.revision, 2);
  assert.deepEqual(background.store.chanlumeState.favoriteChannelIds, ['/@one']);
  assert.deepEqual(background.store.chanlumeState.groups[0].channelIds, ['/@one']);
});

test("favorite feed requests resolve the page owner, deduplicate, cache and reject nonfavorites", async () => {
  const calls = [];
  const background = loadBackground({ channels: { '/@one': { name: 'One' } }, favoriteChannelIds: ['/@one'] }, async (url) => {
    calls.push(url);
    return { ok: true, text: async () => url.endsWith('/videos') ? '{"channelMetadataRenderer":{"title":"One","externalId":"UCabcdefghijklmnopqrstuv"}}' : '<feed></feed>' };
  });
  const message = { type: 'CHANLUME_FAVORITE_FEED', channelId: '/@one' };
  const [first, duplicate] = await Promise.all([background.send(message), background.send(message)]);
  assert.equal(first.ok, true);
  assert.equal(duplicate.xml, '<feed></feed>');
  assert.equal(calls.length, 2);
  await background.send(message);
  assert.equal(calls.length, 2);
  await background.send({ ...message, force: true });
  assert.equal(calls.length, 4);
  assert.match(calls[1], /channel_id=UCabcdefghijklmnopqrstuv$/);
  assert.equal((await background.send({ ...message, channelId: 'https://example.com/@one' })).ok, true); // Identity resolves only to a stored YouTube record.
  assert.ok(calls.every(url => url.startsWith('https://www.youtube.com/')));
  await background.send({ type: 'CHANLUME_MUTATE', operation: { type: 'edit-favorites', payload: { changes: [{ channelId: '/@one', enabled: false }] } } });
  assert.equal((await background.send(message)).ok, false);
  assert.equal(calls.length, 4);
});

test('first install commits initial state before opening preferences with onboarding pending', async () => {
  const background = loadBackground();
  await background.install('install');
  assert.equal(background.openedTabs.length, 1);
  const tab = background.openedTabs[0];
  assert.equal(tab.url, 'chrome-extension://test-id/dashboard/dashboard.html?view=settings');
  assert.equal(tab.active, true);
  assert.equal(tab.storedState.revision, 1);
  assert.equal(tab.storedState.settings.onboardingComplete, false);
});

test('hide Shorts uses the Videos tab, separates cache modes and never falls back to RSS on failure', async () => {
  const calls=[]; let fail=false;
  const data={contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,tabIdentifier:'videos',content:{videoRenderer:{videoId:'normal00001',title:{simpleText:'Normal'}}}}}]}}};
  const background=loadBackground({channels:{'/@one':{name:'One',channelId:'UCabcdefghijklmnopqrstuv'}},favoriteChannelIds:['/@one']},async url=>{
    calls.push(url);
    return {ok:true,text:async()=>url.endsWith('/videos') ? fail ? 'Consent required' : 'var ytInitialData = '+JSON.stringify(data)+';' : '<feed></feed>'};
  });
  const message={type:'CHANLUME_FAVORITE_FEED',channelId:'/@one'};
  assert.equal((await background.send(message)).hideShorts,false);
  await background.send({type:'CHANLUME_MUTATE',operation:{type:'set-setting',payload:{setting:'hideShorts',enabled:true}}});
  const normal=await background.send(message);
  assert.equal(normal.hideShorts,true);
  assert.equal(normal.videos[0].id,'normal00001');
  assert.equal(calls.length,2);
  await background.send(message);
  assert.equal(calls.length,2);
  fail=true;
  assert.equal((await background.send({...message,force:true})).ok,false);
  assert.equal(calls.length,3);
  assert.ok(calls.at(-1).endsWith('/videos'));
});

test('extension and browser updates preserve onboarding and data without opening dashboard', async () => {
  const initial = Core.normalizeState({ channels: { '/@one': { name: 'One' } }, favoriteChannelIds: ['/@one'], settings: { onboardingComplete: true, hideShorts: true } });
  const background = loadBackground(initial);
  for (const reason of ['update', 'chrome_update', 'shared_module_update']) await background.install(reason);
  assert.equal(background.openedTabs.length, 0);
  assert.deepEqual(background.store.chanlumeState, { ...initial, revision: initial.revision + 3 });
});


test('favorite feeds accept inert JSON and preserve diagnostic categories', async () => {
  const data = {contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,tabIdentifier:'videos',content:{videoRenderer:{videoId:'normal00001',title:{simpleText:'Normal'}}}}}]}}};
  let mode = 'ok';
  const background = loadBackground({channels:{'/@one':{name:'One'}},favoriteChannelIds:['/@one'],settings:{hideShorts:true}}, async () => {
    if (mode === 'network') throw new TypeError('Failed to fetch');
    return {ok:mode !== 'http',status:429,text:async()=>mode === 'parse' ? 'Consent required' : '<script id="yt-initial-data" type="application/json">'+JSON.stringify(data)+'</script>'};
  });
  const message = {type:'CHANLUME_FAVORITE_FEED',channelId:'/@one',force:true};
  assert.equal((await background.send(message)).videos[0].id,'normal00001');
  for (const [kind, code] of [['network','NETWORK'],['http','HTTP'],['parse','PARSE']]) {
    mode = kind; const result = await background.send(message);
    assert.equal(result.ok,false); assert.equal(result.code,code); assert.ok(result.error);
  }
});
