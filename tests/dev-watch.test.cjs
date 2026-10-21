"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { activeMarker, watchExtension, sourceSnapshot, sourcesChanged } = require("../scripts/dev-watch.cjs");

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test("development watcher detects changes, ignores heartbeat, and stops cleanly", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chanlume-dev-watch-"));
  const markerPath = path.join(root, "dev-reload.json");
  const sourcePath = path.join(root, "test.js");
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
    content_scripts: [{ js: ["content/dev-reload.js"] }]
  }));
  let watcher;
  try {
    watcher = watchExtension(root);
    const initial = activeMarker(markerPath);
    assert.equal(initial?.chanlumeDevWatch, true);
    assert.equal(initial?.pid, process.pid);
    await wait(250);
    assert.equal(activeMarker(markerPath)?.revision, initial.revision, "marker updates do not recursively reload");
    fs.writeFileSync(sourcePath, "change");
    await wait(1200);
    const changed = activeMarker(markerPath);
    assert.notEqual(changed?.revision, initial.revision, "source changes bump the reload token");
    await wait(250);
    assert.equal(activeMarker(markerPath)?.revision, changed.revision, "does not loop on its own marker");
    watcher.finish();
    watcher = null;
    assert.equal(JSON.parse(fs.readFileSync(markerPath, "utf8")).chanlumeDevWatch, false);
  } finally {
    watcher?.finish();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("development marker rejects expired, malformed, or stopped signals", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chanlume-dev-marker-"));
  const file = path.join(root, "marker.json");
  try {
    fs.writeFileSync(file, JSON.stringify({ chanlumeDevWatch: true, revision: "test", updatedAt: 5 }));
    assert.equal(activeMarker(file, 50000), null);
    fs.writeFileSync(file, "{");
    assert.equal(activeMarker(file), null);
    fs.writeFileSync(file, JSON.stringify({ chanlumeDevWatch: false, updatedAt: Date.now() }));
    assert.equal(activeMarker(file), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("read-only file observations and marker heartbeats do not constitute source edits", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chanlume-dev-snapshot-"));
  try {
    const source = path.join(root, "source.js");
    fs.writeFileSync(source, "const value = 1;");
    const initial = sourceSnapshot(root);
    fs.readFileSync(source, "utf8");
    fs.writeFileSync(path.join(root, "dev-reload.json"), JSON.stringify({ updatedAt: Date.now() }));
    assert.equal(sourcesChanged(initial, sourceSnapshot(root)), false);
    fs.writeFileSync(source, "const value = 2;");
    assert.equal(sourcesChanged(initial, sourceSnapshot(root)), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
