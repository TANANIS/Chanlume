"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("watching a revision does not reload initially, then one changed revision triggers once", async () => {
  let revision = "dfe9e5bd-0c3e-4492-a384-d2fc9edcf164";
  let active = false;
  const timers = [];
  const sent = [];
  const context = {
    window: {},
    chrome: { runtime: {
      sendMessage: async message => {
        if (message.type === "CHANLUME_DEV_MARKER") return { ok: true, marker: active ? {
          chanlumeDevWatch: true, revision, updatedAt: Date.now()
        } : null };
        sent.push(message);
        return { ok: true };
      }
    } },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); }
  };
  context.window.top = context.window;
  context.globalThis = context;
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../extension/content/dev-reload.js"), "utf8"),
    context
  );
  await new Promise(resolve => setImmediate(resolve));
  const first = timers.shift();
  assert.equal(first?.delay, 10000, "inactive watcher causes only a slow local check");
  active = true;
  await first.callback();
  assert.equal(sent.length, 0, "starting the watcher establishes a baseline");
  const second = timers.shift();
  assert.equal(second?.delay, 1500);
  revision = "c451ea5b-46a1-4374-a714-19b6bd11ab70";
  await second.callback();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "CHANLUME_DEV_RELOAD");
  assert.equal(sent[0].revision, revision);
  assert.equal(timers.length, 0, "content script waits for runtime reload rather than looping");
});

test("a rejected dev reload keeps the prior revision and retries after a transient read failure", async () => {
  let revision = "dfe9e5bd-0c3e-4492-a384-d2fc9edcf164";
  let responseOk = true;
  const timers = [];
  const sent = [];
  const context = {
    window: {},
    chrome: { runtime: {
      sendMessage: async message => {
        if (message.type === "CHANLUME_DEV_MARKER") {
          if (!responseOk) throw new Error("transient marker read");
          return { ok: true, marker: { chanlumeDevWatch: true, revision, updatedAt: Date.now() } };
        }
        sent.push(message);
        return { ok: sent.length > 1 };
      }
    } },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); }
  };
  context.window.top = context.window;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../extension/content/dev-reload.js"), "utf8"), context);
  await new Promise(resolve => setImmediate(resolve));
  await timers.shift().callback(); // establish baseline
  revision = "c451ea5b-46a1-4374-a714-19b6bd11ab70";
  await timers.shift().callback(); // background rejects once
  assert.equal(sent.length, 1);
  responseOk = false;
  await timers.shift().callback(); // transient read failure must not discard baseline
  responseOk = true;
  await timers.shift().callback(); // same pending revision retries and is accepted
  assert.equal(sent.length, 2);
  assert.equal(sent[1].revision, revision);
  assert.equal(timers.length, 0);
});
