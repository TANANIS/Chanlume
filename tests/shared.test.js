const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../extension/shared.js");

test("legacy bookmarks map to Chanlume without changing group values or unrelated parameters", () => {
  assert.equal(Core.canonicalHash('#tubeshelf-group=my-tubeshelf-group&other=1'), '#chanlume-group=my-tubeshelf-group&other=1');
  assert.equal(Core.canonicalHash('#tubeshelf-view=favorites'), '#chanlume-view=favorites');
  assert.equal(Core.canonicalHash('#tubeshelf-update-subscriptions'), '#chanlume-update-subscriptions');
  assert.equal(Core.canonicalHash('#chanlume-group=all'), '#chanlume-group=all');
});

test("read-only storage fallback preserves a library while the background migration is pending", async () => {
  const legacy = { revision: 7 };
  const values = await Core.readStoredValues({ get: async () => ({ tubeShelfState: legacy }) }, 'chanlumeState');
  assert.equal(values.chanlumeState, legacy);
  const explicit = await Core.readStoredValues({ get: async () => ({ chanlumeYouTubeApiKey: '', tubeShelfYouTubeApiKey: 'old' }) }, 'chanlumeYouTubeApiKey');
  assert.equal(explicit.chanlumeYouTubeApiKey, '');
});

test("direct classification files every requested channel once and preserves manual choices", () => {
  const state = Core.normalizeState({settings:{language:'en'}, channels:{'/@weak':{name:'Creator',description:'Music'},'/@mixed':{name:'Mixed',description:'Music piano cooking recipe'},'/@unknown':{name:'Unknown'},'/@filed':{name:'Filed',description:'Cooking'},'/@new':{name:'New'}}, groups:[{id:'custom',name:'Personal',channelIds:['/@filed']},{id:'misc',name:'其他',channelIds:[]}],manualLabels:{'/@filed':['custom']}});
  const operation = {type:'auto-classify',payload:{channelIds:['/@weak','/@mixed','/@unknown','/@filed','/@gone']}};
  const next = Core.applyStateOperation(state,operation);
  for (const id of ['/@weak','/@mixed','/@unknown']) assert.equal(next.groups.filter(group=>group.channelIds.includes(id)).length,1);
  assert.deepEqual(next.groups.find(group=>group.id==='misc').channelIds,['/@unknown']);
  assert.deepEqual(next.groups.find(group=>group.id==='custom').channelIds,['/@filed']);
  assert.deepEqual(next.manualLabels,state.manualLabels);
  assert.deepEqual(Core.unfiledChannelIds(next),['/@new']);
  assert.deepEqual(Core.applyStateOperation(next,operation),next);
});

test("direct classification resolves aliases and creates a localized fallback without hijacking IDs", () => {
  const state = Core.normalizeState({settings:{language:'zh-TW'},channels:{'/@one':{name:'Unknown',channelId:'UCabcdefghijklmnopqrstuv'}},groups:[{id:'other',name:'My special group',channelIds:[]}]});
  const next=Core.applyStateOperation(state,{type:'auto-classify',payload:{channelIds:['/channel/UCabcdefghijklmnopqrstuv']}});
  assert.deepEqual(next.groups.find(group=>group.id==='other').channelIds,[]);
  assert.deepEqual(next.groups.find(group=>group.name==='其他').channelIds,['/@one']);
});

test("favorite migration is idempotent, resolves aliases and drops missing records", () => {
  const old = { version: 14, channels: { "/@one": { name: "One", channelId: "UCabcdefghijklmnopqrstuv" } } };
  assert.deepEqual(Core.normalizeState(old).favoriteChannelIds, []);
  const next = Core.normalizeState({ ...old, favoriteChannelIds: ["/@one", "/channel/UCabcdefghijklmnopqrstuv", "/@gone", null] });
  assert.deepEqual(next.favoriteChannelIds, ["/@one"]);
  assert.deepEqual(Core.normalizeState(next), next);
  assert.deepEqual(Core.removeChannel(next, "/@one").favoriteChannelIds, []);
});

test("saved selection deltas retain concurrent edits and do not resurrect deleted channels", () => {
  let state = Core.normalizeState({ channels: { "/@one": { name: "One" }, "/@two": { name: "Two" }, "/@three": { name: "Three" } }, groups: [{ id: "g", name: "Group", channelIds: ["/@one"] }] });
  state = Core.applyStateOperation(state, { type: "toggle-membership", payload: { channelId: "/@three", groupId: "g", enabled: true } });
  state = Core.applyStateOperation(state, { type: "edit-memberships", payload: { groupId: "g", changes: [{ channelId: "/@one", enabled: false }, { channelId: "/@two", enabled: true }] } });
  assert.deepEqual(new Set(state.groups[0].channelIds), new Set(["/@two", "/@three"]));
  state = Core.applyStateOperation(state, { type: "edit-favorites", payload: { changes: [{ channelId: "/@two", enabled: true }] } });
  state = Core.applyStateOperation(state, { type: "edit-favorites", payload: { changes: [{ channelId: "/@one", enabled: true }, { channelId: "/@gone", enabled: true }] } });
  assert.deepEqual(state.favoriteChannelIds, ["/@two", "/@one"]);
  assert.deepEqual(new Set(state.groups[0].channelIds), new Set(["/@two", "/@three"]));
  assert.throws(() => Core.applyStateOperation(state, { type: "edit-memberships", payload: { groupId: "gone", changes: [] } }), /Unknown group/);
});

test("favorite selection follows strongly coalesced channel identities", () => {
  const state = Core.normalizeState({ channels: { "/@one": { name: "One" }, "/channel/ucabc": { name: "One" } }, favoriteChannelIds: ["/channel/ucabc"] });
  const next = Core.coalesceChannelIdentities(state, { id: "/@one", url: "https://www.youtube.com/@one" }, ["/channel/ucabc"]);
  assert.deepEqual(next.favoriteChannelIds, ["/@one"]);
  assert.equal(Object.keys(next.channels).length, 1);
});

test("global power defaults on and preserves library and preferences across toggles", () => {
  const original = Core.normalizeState({ channels: { '/@one': { id: '/@one', name: 'One' } }, groups: [{ id: 'g', name: 'Group', channelIds: ['/@one'] }], settings: { hideShorts: true, blockHome: true } });
  assert.equal(original.settings.enabled, true);
  const off = Core.applyStateOperation(original, { type: 'set-setting', payload: { setting: 'enabled', enabled: false } });
  assert.deepEqual(off.channels, original.channels);
  assert.deepEqual(off.groups, original.groups);
  assert.equal(off.settings.hideShorts, true);
  assert.equal(Core.blockedPageRedirect(off.settings, 'https://www.youtube.com/'), '');
  assert.equal(Core.blockedPageRedirect(off.settings, 'https://www.youtube.com/shorts/test'), '');
  assert.equal(Core.normalizeState(off).settings.enabled, false);
  const on = Core.applyStateOperation(off, { type: 'set-setting', payload: { setting: 'enabled', enabled: true } });
  assert.deepEqual(on, original);
});

test("disabled integration rejects late automatic subscription and scan commits", () => {
  const off = Core.normalizeState({settings:{enabled:false}});
  for (const type of ['set-subscription', 'coalesce-channel-identities', 'reconcile-subscription-scan']) {
    assert.throws(() => Core.applyStateOperation(off, {type, payload:{channels:[]}}), {code:'CHANLUME_DISABLED'});
  }
});

test("channelKey normalizes supported YouTube channel URLs", () => {
  assert.equal(Core.channelKey("https://www.youtube.com/@Veritasium/videos?view=0"), "/@veritasium");
  assert.equal(Core.channelKey("/channel/UC123/"), "/channel/uc123");
  assert.equal(Core.channelKey("https://www.youtube.com/watch?v=123"), "");
});

test("YouTube page kinds keep recommendations separate from subscriptions", () => {
  assert.equal(Core.youtubePageKind("https://www.youtube.com/"), "home");
  assert.equal(Core.youtubePageKind("/feed/subscriptions?flow=2"), "subscriptions");
  assert.equal(Core.youtubePageKind("https://www.youtube.com/watch?v=123"), "other");
  assert.equal(Core.subscriptionGroupUrl("學習"), "https://www.youtube.com/feed/subscriptions#chanlume-group=%E5%AD%B8%E7%BF%92");
});

test("new distraction controls default off and migrate into saved state", () => {
  const defaults = Core.defaultState();
  assert.equal(Core.VERSION, 15);
  assert.equal(defaults.revision, 0);
  assert.deepEqual(defaults.manualLabels, {});
  assert.equal(defaults.settings.blockHome, false);
  assert.equal(defaults.settings.hideShorts, false);
  assert.equal(defaults.settings.hideSecondary, false);
  assert.equal(defaults.settings.disableAutoplay, false);
  assert.equal(defaults.settings.onboardingComplete, false);
  assert.equal(defaults.settings.language, Core.detectDefaultLanguage());

  const migrated = Core.normalizeState({ settings: { hideWatched: true } });
  assert.equal(migrated.settings.blockHome, false);
  assert.equal(migrated.settings.hideShorts, false);
  assert.equal(migrated.settings.hideSecondary, false);
  assert.equal(migrated.settings.disableAutoplay, false);
  assert.equal(migrated.settings.hideWatched, true);
  assert.equal(migrated.settings.onboardingComplete, false);
  assert.equal(migrated.settings.language, Core.detectDefaultLanguage());
});

test("interface language is normalized and English UI text supports dynamic counts", () => {
  assert.deepEqual(Core.LANGUAGES, ["zh-TW", "en"]);
  assert.equal(Core.detectDefaultLanguage("zh-CN"), "zh-TW");
  assert.equal(Core.detectDefaultLanguage("zh-Hant-TW"), "zh-TW");
  assert.equal(Core.detectDefaultLanguage("en-US"), "en");
  assert.equal(Core.detectDefaultLanguage("ja-JP"), "en");
  assert.equal(Core.normalizeState({ settings: { language: "en" } }).settings.language, "en");
  assert.equal(Core.normalizeState({ settings: { language: "fr" } }).settings.language, "en");
  assert.equal(Core.translateUiText("偏好設定", "en"), "Preferences");
  assert.equal(Core.translateUiText("18 個頻道尚未分類", "en"), "18 channels unclassified");
  assert.equal(Core.translateUiText("要將「Learning」的 2 個頻道合併到「Relaxation」嗎？來源群組會被刪除。", "en"), "Merge 2 channels from “Learning” into “Relaxation”? The source group will be deleted.");
  assert.equal(Core.translateUiText("更新完成：12 個取得影片標題，3 個讀取失敗", "en"), "Refresh complete: 12 with recent titles, 3 failed");
});

test("mergeGroups moves unique memberships, remaps learning labels, and removes only the source group", () => {
  const state = Core.normalizeState({
    channels: {
      "/@one": { id: "/@one", name: "One" },
      "/@two": { id: "/@two", name: "Two" },
      "/@three": { id: "/@three", name: "Three" }
    },
    groups: [
      { id: "source", name: "Source", icon: "book", color: "#7c5cff", channelIds: ["/@one", "/@two"] },
      { id: "target", name: "Target", icon: "star", color: "#ff6b8a", channelIds: ["/@two", "/@three"] }
    ],
    manualLabels: { "/@one": ["source"], "/@two": ["source", "target"] },
    settings: { language: "en" }
  });
  const merged = Core.mergeGroups(state, "source", "target");
  assert.deepEqual(merged.groups.map((group) => group.id), ["target"]);
  assert.deepEqual(merged.groups[0].channelIds, ["/@two", "/@three", "/@one"]);
  assert.deepEqual(merged.manualLabels["/@one"], ["target"]);
  assert.deepEqual(merged.manualLabels["/@two"], ["target"]);
  assert.deepEqual(Object.keys(merged.channels).sort(), ["/@one", "/@three", "/@two"]);
});

test("English classification localizes system topic labels without rewriting channel data", () => {
  const state = Core.defaultState();
  state.settings.language = "en";
  const result = Core.classifyChannel({ name: "料理研究所", description: "料理 食譜 cooking recipe" }, state);
  assert.equal(result.groupId, "food");
  assert.ok(result.tags.includes("Cooking and recipes"));
  assert.equal(result.reasons.some((reason) => reason.startsWith("Cooking and recipes:")), true);
});

test("hiding the watch-page secondary column defaults autoplay to off without coupling homepage blocking", () => {
  const secondaryHidden = Core.settingsAfterToggle(Core.defaultState().settings, "hideSecondary", true);
  assert.equal(secondaryHidden.hideSecondary, true);
  assert.equal(secondaryHidden.disableAutoplay, true);

  const homeBlocked = Core.settingsAfterToggle(Core.defaultState().settings, "blockHome", true);
  assert.equal(homeBlocked.blockHome, true);
  assert.equal(homeBlocked.disableAutoplay, false);

  const autoplayRestored = Core.settingsAfterToggle(secondaryHidden, "disableAutoplay", false);
  assert.equal(autoplayRestored.hideSecondary, true);
  assert.equal(autoplayRestored.disableAutoplay, false);
});

test("blocked homepage and Shorts redirect directly to subscriptions", () => {
  const target = "https://www.youtube.com/feed/subscriptions#chanlume-group=all";
  assert.equal(Core.blockedPageRedirect({ blockHome: true }, "https://www.youtube.com/"), target);
  assert.equal(Core.blockedPageRedirect({ blockHome: true }, "https://www.youtube.com/watch?v=1"), "");
  assert.equal(Core.blockedPageRedirect({ hideShorts: true }, "https://www.youtube.com/shorts/abc"), target);
  assert.equal(Core.blockedPageRedirect({ hideShorts: false }, "https://www.youtube.com/shorts/abc"), "");
});

test("normalizeState removes invalid and duplicate memberships", () => {
  const state = Core.normalizeState({
    channels: { "/@one": { id: "/@one", name: "One" } },
    groups: [{ id: "a", name: " A ", color: "bad", icon: "bad", channelIds: ["/@one", "/@one", "/@missing"] }]
  });
  assert.deepEqual(state.groups[0].channelIds, ["/@one"]);
  assert.equal(state.groups[0].name, "A");
  assert.equal(state.groups[0].icon, "star");
  assert.equal(state.groups[0].color, "#7c5cff");
});

test("normalizeState cleans duplicated channel names and YouTube boilerplate metadata", () => {
  const state = Core.normalizeState({
    channels: {
      "/@one": {
        id: "/@one",
        name: "測試頻道\n\n  測試頻道",
        description: "與好友、家人及全世界分享你的影片",
        keywords: "影片, 分享, 可拍照的手機, 影像電話, 免費, 上傳"
      }
    },
    groups: []
  });
  assert.equal(state.channels["/@one"].name, "測試頻道");
  assert.equal(state.channels["/@one"].description, "");
  assert.equal(state.channels["/@one"].keywords, "");
});

test("normalizeState enforces the persisted schema and setting types", () => {
  const state = Core.normalizeState({
    channels: { "/@One": { id: "/@One", name: "One", unexpected: { large: true } }, invalid: { name: "Invalid" } },
    groups: [
      { id: "same", name: "First", channelIds: ["/@One"] },
      { id: "same", name: "Duplicate", channelIds: ["/@One"] }
    ],
    settings: { hideShorts: "false", blockHome: true, unexpected: true }
  });
  assert.deepEqual(Object.keys(state.channels), ["/@one"]);
  assert.equal("unexpected" in state.channels["/@one"], false);
  assert.equal(state.groups.length, 1);
  assert.deepEqual(state.groups[0].channelIds, ["/@one"]);
  assert.equal(state.settings.hideShorts, false);
  assert.equal(state.settings.blockHome, true);
  assert.equal("unexpected" in state.settings, false);
});

test("upsertChannels merges new channels without losing groups", () => {
  const state = Core.defaultState();
  state.channels["/@old"] = { id: "/@old", name: "Old", url: "https://www.youtube.com/@old" };
  state.groups[0].channelIds.push("/@old");
  const next = Core.upsertChannels(state, [
    { url: "https://www.youtube.com/@NewChannel", name: "New channel", avatar: "https://example.com/avatar.png" }
  ]);
  assert.equal(next.channels["/@newchannel"].name, "New channel");
  assert.equal(next.groups[0].id, "learning");
  assert.deepEqual(next.groups[0].channelIds, ["/@old"]);
});

test("createId resolves duplicate names", () => {
  assert.equal(Core.createId("遊戲 設計", ["遊戲-設計"]), "遊戲-設計-2");
});

test("replaceChannels removes unsubscribed channels and stale memberships", () => {
  const state = Core.defaultState();
  state.channels = {
    "/@keep": { id: "/@keep", name: "Keep" },
    "/@gone": { id: "/@gone", name: "Gone" }
  };
  state.groups[0].channelIds = ["/@keep", "/@gone"];
  const next = Core.replaceChannels(state, [{ url: "https://www.youtube.com/@keep", name: "Keep updated" }]);
  assert.deepEqual(Object.keys(next.channels), ["/@keep"]);
  assert.deepEqual(next.groups[0].channelIds, ["/@keep"]);
  assert.equal(next.channels["/@keep"].name, "Keep updated");
});

test("replaceChannels preserves locally cached classification metadata", () => {
  const state = Core.defaultState();
  state.channels["/@keep"] = {
    id: "/@keep",
    name: "Keep",
    description: "game development tutorials",
    recentTitles: ["Building a game in Godot"],
    profiledAt: 123,
    profileVersion: 2
  };
  const next = Core.replaceChannels(state, [{ url: "https://www.youtube.com/@keep", name: "Keep updated" }]);
  assert.equal(next.channels["/@keep"].description, "game development tutorials");
  assert.deepEqual(next.channels["/@keep"].recentTitles, ["Building a game in Godot"]);
  assert.equal(next.channels["/@keep"].profiledAt, 123);
  assert.equal(next.channels["/@keep"].profileVersion, 2);
});

test("removeChannel clears the channel, every group membership, and learned correction", () => {
  let state = Core.defaultState();
  state.channels["/@gone"] = { id: "/@gone", name: "Gone" };
  state.groups[0].channelIds = ["/@gone"];
  state.manualLabels["/@gone"] = [state.groups[0].id];
  state = Core.removeChannel(state, "/@gone");
  assert.equal(state.channels["/@gone"], undefined);
  assert.deepEqual(state.groups[0].channelIds, []);
  assert.equal(state.manualLabels["/@gone"], undefined);
});

test("local classifier uses channel metadata and leaves ambiguous channels uncertain", () => {
  const game = Core.classifyChannel({ name: "Maker", description: "Godot game development", recentTitles: ["Unity tutorial"] });
  assert.equal(game.groupId, "game-development");
  assert.equal(Core.classifyChannel({ name: "My Channel", description: "", recentTitles: [] }), null);
});

test('normal upload parser accepts only a selected Videos tab and excludes Shorts and related shelves', () => {
  const video = {videoRenderer:{videoId:'normal00001',title:{simpleText:'Normal {"upload"}'},publishedTimeText:{simpleText:'2 days ago'}}};
  const data = {contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{selected:true,endpoint:{commandMetadata:{webCommandMetadata:{url:'/@one/videos'}}},content:{items:[video,video,
    {videoRenderer:{videoId:'shorts00001',title:{simpleText:'Short'},navigationEndpoint:{reelWatchEndpoint:{videoId:'shorts00001'}}}},
    {richSectionRenderer:{content:{videoRenderer:{videoId:'related0001',title:{simpleText:'Related'}}}}},
    {lockupViewModel:{contentType:'LOCKUP_CONTENT_TYPE_VIDEO',contentId:'normal00002',metadata:{lockupMetadataViewModel:{title:{content:'New card'}}}}}
  ]}}}]}}};
  assert.deepEqual(Core.collectChannelUploads(Core.parseYouTubeInitialData('<script>var ytInitialData = '+JSON.stringify(data)+';</script>')).map(v=>v.id),['normal00001','normal00002']);
  data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.selected=false;
  assert.throws(()=>Core.collectChannelUploads(data),/not loaded/);
  assert.throws(()=>Core.collectChannelUploads({}),/unavailable/);
  assert.throws(()=>Core.parseYouTubeInitialData('<html>Consent required</html>'),/unavailable/);
  assert.deepEqual(Core.collectChannelUploads({metadata:{channelMetadataRenderer:{}},contents:{twoColumnBrowseResultsRenderer:{tabs:[{tabRenderer:{endpoint:{commandMetadata:{webCommandMetadata:{url:'/@one/shorts'}}}}}]}}}),[]);
});

test("generic YouTube page keywords do not cause a technology classification", () => {
  const result = Core.classifyChannel({ name: "Creator", description: "", keywords: "影片, 分享, 可拍照的手機, 影像電話, 免費, 上傳", recentTitles: [] });
  assert.equal(result, null);
});

test("recent title collector supports YouTube legacy and lockup view models", () => {
  const data = {
    contents: [
      { videoRenderer: { videoId: "old123", title: { runs: [{ text: "舊格式影片" }] } } },
      { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: "new456", metadata: { lockupMetadataViewModel: { title: { content: "新版影片卡" } } } } },
      { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_VIDEO", contentId: "new456", metadata: { lockupMetadataViewModel: { title: { content: "新版影片卡" } } } } },
      { lockupViewModel: { contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST", metadata: { lockupMetadataViewModel: { title: { content: "不要收錄播放清單" } } } } }
    ]
  };
  const titles = Core.collectRecentVideoTitles(data);
  assert.deepEqual(titles, ["舊格式影片", "新版影片卡"]);
  assert.deepEqual(Core.collectRecentVideos(data), [{ id: "old123", title: "舊格式影片" }, { id: "new456", title: "新版影片卡" }]);
});

test("official YouTube topics and recent video categories are strong signals", () => {
  assert.equal(Core.classifyChannel({ name: "頻道", topicCategories: ["https://en.wikipedia.org/wiki/Technology"] })?.groupId, "technology");
  const gaming = Core.classifyChannel({ name: "頻道", videoCategoryCounts: { "20": 8, "24": 2 } });
  assert.equal(gaming.groupId, "games");
  assert.ok(gaming.sources.includes("official"));
});

test("specific phrases and exclusions prevent obvious cross-topic mistakes", () => {
  const cover = Core.classifyChannel({ name: "Singer", description: "AI cover song and music performance" });
  assert.equal(cover.groupId, "music");
  assert.ok(!cover.tags.includes("人工智慧"));
});

test("manual corrections build a private per-group vocabulary", () => {
  let state = Core.normalizeState({
    channels: {
      "/@one": { id: "/@one", name: "One", description: "homelab proxmox cluster" },
      "/@two": { id: "/@two", name: "Two", description: "homelab proxmox storage" },
      "/@new": { id: "/@new", name: "New", description: "homelab proxmox guide" }
    },
    groups: [{ id: "self-hosted", name: "自架服務", icon: "code", color: "#4a91ff", channelIds: [] }]
  });
  state = Core.recordManualMembership(state, "/@one", "self-hosted", true);
  state = Core.recordManualMembership(state, "/@two", "self-hosted", true);
  assert.deepEqual(state.manualLabels["/@one"], ["self-hosted"]);
  const result = Core.classifyChannel(state.channels["/@new"], state);
  assert.equal(result.groupId, "self-hosted");
  assert.ok(result.sources.includes("personal"));
});

test("low confidence guesses are included in reviewable suggestions", () => {
  const state = Core.normalizeState({ channels: { "/@weak": { id: "/@weak", name: "Creator", description: "Python" } }, groups: [] });
  const suggestions = Core.buildAutoGroupSuggestions(state);
  assert.deepEqual(suggestions.groups.flatMap((group) => group.channelIds), ["/@weak"]);
  assert.equal(suggestions.groups[0].channels[0].confidence, "low");
  assert.deepEqual(suggestions.uncertain, []);
  assert.equal(suggestions.stats.low, 1);
});

test('classifier excludes contact noise, generic guides and English substring collisions', () => {
  for (const description of ['Business E-mail: creator@example.com', '商業合作：請寄到 creator@example.com', 'cartoon market showcase']) {
    assert.equal(Core.classifyChannel({name:'Creator',description}),null,description);
  }
  assert.equal(Core.classifyChannel({name:'Creator',recentTitles:['攻略 1','攻略 2','攻略 3']}),null);
  assert.equal(Core.classifyChannel({name:'Creator',description:'Business inquiries: hi@example.com',recentTitles:['CPU comparison','GPU review','PC build tutorial']}).groupId,'technology');
});

test('matching folds common simplified text and handles drawing workout context per upload', () => {
  assert.equal(Core.classifyChannel({name:'Creator',description:'软件 计算机 人工智能',recentTitles:['Claude 工具攻略','Codex 使用指南']}).groupId,'technology');
  const drawing = Core.classifyChannel({name:'Creator',recentTitles:['绘画健身操 1 Drawing workout','绘画健身操 2 Drawing workout','绘画健身操 3 Drawing workout']});
  assert.equal(drawing.groupId,'art');
  assert.equal(drawing.alternatives.some(item=>item.groupId==='sports'),false);
  assert.equal(Core.classifyChannel({name:'Creator',recentTitles:['Workout legs','Workout arms','Workout back']}).groupId,'sports');
});

test('repeated titles and duplicated official topic identifiers cannot inflate confidence', () => {
  const once = Core.classifyChannel({name:'Creator',recentTitles:['Cooking recipe']});
  assert.equal(Core.classifyChannel({name:'Creator',recentTitles:Array(15).fill('Cooking recipe')}),once);
  const single = Core.classifyChannel({name:'Creator',topicCategories:['https://en.wikipedia.org/wiki/Music']});
  const duplicate = Core.classifyChannel({name:'Creator',topicCategories:['https://en.wikipedia.org/wiki/Music'],topicIds:['/m/04rlf','/m/04rlf']});
  assert.equal(duplicate.score,single.score);
  assert.equal(duplicate.confidence,'medium');
});

test('specific subjects reuse existing custom groups and preserve their names', () => {
  const state=Core.normalizeState({settings:{language:'en'},groups:[{id:'custom-dev',name:'遊戲開發',channelIds:[]},{id:'learning',name:'學習與成長',channelIds:[]}]});
  const result=Core.classifyChannel({name:'Creator',description:'Godot game development and gaming'},state);
  assert.equal(result.groupId,'custom-dev');
  assert.equal(result.name,'遊戲開發');
  assert.equal(Core.classifyChannel({name:'Creator',description:'心理學 哲學'},state).name,'學習與成長');
  assert.equal(Core.classifyChannel({name:'Creator',description:'露營 camping bushcraft'}).groupId,'outdoors');
  assert.equal(Core.classifyChannel({name:'Creator',description:'科學 物理 science'}).groupId,'science');
});

test('conflicting subjects stay unchecked candidates and can be applied to multiple groups', () => {
  let state=Core.normalizeState({channels:{'/@mixed':{name:'Creator',description:'Music cooking'}},groups:[]});
  const suggestions=Core.buildAutoGroupSuggestions(state);
  assert.equal(suggestions.groups.length,2);
  assert.ok(suggestions.groups.every(group=>group.channels[0].confidence==='low'));
  state=Core.applyStateOperation(state,{type:'apply-auto-suggestions',payload:{groups:suggestions.groups}});
  assert.equal(state.groups.filter(group=>group.channelIds.includes('/@mixed')).length,2);
});

test('starter groups are optional, idempotent and preserve imported group identities and memberships', () => {
  const initial=Core.normalizeState({groups:[{id:'my-science',name:'科普知識',icon:'star',color:'#112233',channelIds:['/@one']}],channels:{'/@one':{name:'One'}},manualLabels:{'/@one':['my-science']},favoriteChannelIds:['/@one']});
  const operation={type:'add-group-templates',payload:{groupIds:['science','game-development','game-development','invalid']}};
  const next=Core.applyStateOperation(initial,operation);
  assert.equal(next.groups.length,2);
  assert.deepEqual(next.groups[0],initial.groups[0]);
  assert.deepEqual(next.manualLabels,initial.manualLabels);
  assert.deepEqual(next.favoriteChannelIds,initial.favoriteChannelIds);
  assert.deepEqual(Core.applyStateOperation(next,operation),next);
});

test("repeated recent-video signals improve local classification coverage", () => {
  const result = Core.classifyChannel({
    name: "Creator Channel",
    description: "",
    recentTitles: ["今天來做料理", "簡單料理教學", "週末料理紀錄"]
  });
  assert.equal(result.groupId, "food");
  assert.equal(result.confidence, "medium");
});

test("expanded local taxonomy recognizes common channel topics", () => {
  const cases = [
    ["finance", "本週股票投資市場分析"],
    ["entertainment", "電影與戲劇訪談 Podcast"],
    ["sports", "NBA 籃球賽事精華"],
    ["vehicles", "新車試駕與汽車評測"],
    ["animals", "貓咪與狗狗寵物日常"],
    ["technology", "Python 程式開發教學"],
    ["art", "插畫與動畫創作過程"],
    ["news", "國際新聞與政治時事報導"]
  ];
  for (const [groupId, description] of cases) {
    assert.equal(Core.classifyChannel({ name: "頻道", description, recentTitles: [] })?.groupId, groupId, description);
  }
});

test("unfiledChannelIds returns channels with no group membership", () => {
  const state = Core.defaultState();
  state.channels = {
    "/@filed": { id: "/@filed", name: "Filed" },
    "/@waiting": { id: "/@waiting", name: "Waiting" }
  };
  state.groups[0].channelIds = ["/@filed"];
  assert.deepEqual(Core.unfiledChannelIds(state), ["/@waiting"]);
});

test("auto group suggestions only include unfiled channels", () => {
  const state = Core.defaultState();
  state.channels = {
    "/@filed": { id: "/@filed", name: "Lofi Music" },
    "/@new": { id: "/@new", name: "Pro Gaming" },
    "/@unknown": { id: "/@unknown", name: "Someone" }
  };
  state.groups[0].channelIds = ["/@filed"];
  const result = Core.buildAutoGroupSuggestions(state);
  assert.deepEqual(result.groups.flatMap((group) => group.channelIds), ["/@new"]);
  assert.deepEqual(result.uncertain, ["/@unknown"]);
});

test("applying suggestions adds memberships without overwriting manual groups", () => {
  const state = Core.defaultState();
  state.channels = {
    "/@manual": { id: "/@manual", name: "Manual" },
    "/@game": { id: "/@game", name: "Game" }
  };
  state.groups[0].channelIds = ["/@manual"];
  const next = Core.applyAutoGroupSuggestions(state, [{ groupId: "games", name: "遊戲", icon: "game", color: "#2dbd9b", channelIds: ["/@game"] }]);
  assert.deepEqual(next.groups.find((group) => group.id === "learning").channelIds, ["/@manual"]);
  assert.deepEqual(next.groups.find((group) => group.name === "遊戲").channelIds, ["/@game"]);
});

test("state operations apply independent intents to the latest state", () => {
  let state = Core.defaultState();
  state.channels = {
    "/@one": { id: "/@one", name: "One", url: "https://www.youtube.com/@one" },
    "/@two": { id: "/@two", name: "Two", url: "https://www.youtube.com/@two" }
  };
  state = Core.applyStateOperation(state, { type: "toggle-membership", payload: { channelId: "/@one", groupId: "learning", enabled: true } });
  state = Core.applyStateOperation(state, { type: "toggle-membership", payload: { channelId: "/@two", groupId: "relax", enabled: true } });
  state = Core.applyStateOperation(state, { type: "set-setting", payload: { setting: "hideShorts", enabled: true } });
  assert.deepEqual(state.groups.find((group) => group.id === "learning").channelIds, ["/@one"]);
  assert.deepEqual(state.groups.find((group) => group.id === "relax").channelIds, ["/@two"]);
  assert.equal(state.settings.hideShorts, true);
});

test("channel identity coalescing moves canonical memberships onto the handle", () => {
  let state = Core.normalizeState({
    channels: {
      "/@tenacioustrilobite": { id: "/@tenacioustrilobite", name: "Tenacious Trilobite", url: "https://www.youtube.com/@TenaciousTrilobite", seenAt: 100 },
      "/channel/ucnqvxfc231ovczecukrw0dq": { id: "/channel/ucnqvxfc231ovczecukrw0dq", name: "Tenacious Trilobite", url: "https://www.youtube.com/channel/UCNqVXfC231oVcZEcUKrW0DQ", description: "Old firearms", profiledAt: 200 }
    },
    groups: [{ id: "relax", name: "Lifestyle", icon: "sparkles", color: "#2dbd9b", channelIds: ["/channel/ucnqvxfc231ovczecukrw0dq"] }],
    manualLabels: { "/channel/ucnqvxfc231ovczecukrw0dq": ["relax"] }
  });
  state = Core.applyStateOperation(state, {
    type: "coalesce-channel-identities",
    payload: {
      primaryChannel: { id: "/@tenacioustrilobite", url: "https://www.youtube.com/@TenaciousTrilobite", name: "Tenacious Trilobite", channelId: "UCNqVXfC231oVcZEcUKrW0DQ" },
      aliasIds: ["/channel/ucnqvxfc231ovczecukrw0dq"]
    }
  });
  assert.deepEqual(Object.keys(state.channels), ["/@tenacioustrilobite"]);
  assert.deepEqual(state.groups[0].channelIds, ["/@tenacioustrilobite"]);
  assert.deepEqual(state.manualLabels["/@tenacioustrilobite"], ["relax"]);
  assert.equal(state.channels["/@tenacioustrilobite"].description, "Old firearms");
  assert.equal(state.channels["/@tenacioustrilobite"].channelId, "UCNqVXfC231oVcZEcUKrW0DQ");
  assert.deepEqual(Core.unfiledChannelIds(state), []);
});

test("auto suggestions are revalidated against current unclassified channels", () => {
  let state = Core.defaultState();
  state.channels = {
    "/@already": { id: "/@already", name: "Already", url: "https://www.youtube.com/@already" },
    "/@waiting": { id: "/@waiting", name: "Waiting", url: "https://www.youtube.com/@waiting" }
  };
  state.groups.find((group) => group.id === "learning").channelIds = ["/@already"];
  state = Core.applyStateOperation(state, { type: "apply-auto-suggestions", payload: { groups: [{ groupId: "relax", name: "放鬆", icon: "sparkles", color: "#ff6b8a", channelIds: ["/@already", "/@waiting"] }] } });
  assert.deepEqual(state.groups.find((group) => group.id === "relax").channelIds, ["/@waiting"]);
});

test("full subscription reconciliation rejects an abnormal destructive shrink", () => {
  const state = Core.defaultState();
  state.channels = Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
    const id = `/@channel${index}`;
    return [id, { id, name: `Channel ${index}`, url: `https://www.youtube.com${id}` }];
  }));
  const incoming = Array.from({ length: 40 }, (_, index) => ({ id: `/@channel${index}`, name: `Channel ${index}`, url: `https://www.youtube.com/@channel${index}` }));
  assert.throws(() => Core.applyStateOperation(state, { type: "reconcile-subscription-scan", payload: { channels: incoming } }), (error) => error.code === "SCAN_SHRINK_GUARD");
  const accepted = Core.applyStateOperation(state, { type: "reconcile-subscription-scan", payload: { channels: incoming, allowLargeRemoval: true } });
  assert.equal(Object.keys(accepted.channels).length, 40);
});

test("subscription reconciliation merges handle and canonical records from scan evidence", () => {
  const state = Core.normalizeState({
    channels: {
      "/@tenacioustrilobite": { id: "/@tenacioustrilobite", name: "Tenacious Trilobite", url: "https://www.youtube.com/@TenaciousTrilobite" },
      "/channel/ucnqvxfc231ovczecukrw0dq": { id: "/channel/ucnqvxfc231ovczecukrw0dq", name: "Tenacious Trilobite", url: "https://www.youtube.com/channel/UCNqVXfC231oVcZEcUKrW0DQ" }
    },
    groups: [{ id: "lifestyle", name: "Lifestyle", icon: "sparkles", color: "#2dbd9b", channelIds: ["/channel/ucnqvxfc231ovczecukrw0dq"] }]
  });
  const next = Core.applyStateOperation(state, {
    type: "reconcile-subscription-scan",
    payload: { channels: [{ id: "/@tenacioustrilobite", url: "https://www.youtube.com/@TenaciousTrilobite", name: "Tenacious Trilobite", channelId: "UCNqVXfC231oVcZEcUKrW0DQ", aliases: ["/channel/UCNqVXfC231oVcZEcUKrW0DQ"] }] }
  });
  assert.deepEqual(Object.keys(next.channels), ["/@tenacioustrilobite"]);
  assert.equal(next.channelAliases["/channel/ucnqvxfc231ovczecukrw0dq"], "/@tenacioustrilobite");
  assert.deepEqual(next.groups[0].channelIds, ["/@tenacioustrilobite"]);
  assert.deepEqual(Core.unfiledChannelIds(next), []);
});

test("subscription reconciliation preserves unresolved canonical-only records", () => {
  const state = Core.normalizeState({
    channels: {
      "/@visible": { id: "/@visible", name: "Visible", url: "https://www.youtube.com/@visible" },
      "/channel/ucunknownidentity000000": { id: "/channel/ucunknownidentity000000", name: "Unresolved", url: "https://www.youtube.com/channel/UCUnknownIdentity000000" }
    },
    groups: [{ id: "archive", name: "Archive", icon: "star", color: "#7c5cff", channelIds: ["/channel/ucunknownidentity000000"] }]
  });
  const next = Core.applyStateOperation(state, { type: "reconcile-subscription-scan", payload: { channels: [{ id: "/@visible", name: "Visible", url: "https://www.youtube.com/@visible" }] } });
  assert.ok(next.channels["/channel/ucunknownidentity000000"]);
  assert.deepEqual(next.groups[0].channelIds, ["/channel/ucunknownidentity000000"]);
});

test("channel metadata patches preserve newer membership changes", () => {
  let state = Core.defaultState();
  state.channels = { "/@one": { id: "/@one", name: "One", url: "https://www.youtube.com/@one" } };
  state = Core.applyStateOperation(state, { type: "toggle-membership", payload: { channelId: "/@one", groupId: "learning", enabled: true } });
  state = Core.applyStateOperation(state, { type: "patch-channels", payload: { updates: [{ id: "/@one", patch: { description: "Updated", recentTitles: ["New video"], profiledAt: 100, profileVersion: 5 } }] } });
  assert.deepEqual(state.groups.find((group) => group.id === "learning").channelIds, ["/@one"]);
  assert.equal(state.channels["/@one"].description, "Updated");
});

test("older asynchronous metadata patches cannot overwrite newer metadata", () => {
  let state = Core.defaultState();
  state.channels = { "/@one": { id: "/@one", name: "One", url: "https://www.youtube.com/@one", description: "Newest", profiledAt: 200 } };
  state = Core.applyStateOperation(state, { type: "patch-channels", payload: { updates: [{ id: "/@one", patch: { description: "Stale", profiledAt: 100 } }] } });
  assert.equal(state.channels["/@one"].description, "Newest");
  assert.equal(state.channels["/@one"].profiledAt, 200);
});
