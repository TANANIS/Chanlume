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
