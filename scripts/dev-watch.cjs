"use strict";

// Local-only, dependency-free development watcher for Helium's existing
// unpacked Chanlume installation. It never touches browser profiles/storage.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const extensionRoot = path.resolve(__dirname, "..", "extension");
const markerPath = path.join(extensionRoot, "dev-reload.json");
const WATCH_MARKER = "dev-reload.json";
const OFF = JSON.stringify({ chanlumeDevWatch: false, revision: "", updatedAt: 0 }) + "\n";
const HEARTBEAT_MS = 5000;
const CHANGE_DEBOUNCE_MS = 450;
const STALE_MS = 20000;

// fs.watch on Windows can report directory/metadata notifications without any
// source change. Compare file signatures before asking Helium to reload.
function sourceSnapshot(root) {
  const files = new Map();
  const visit = (directory, prefix = "") => {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name.startsWith(".") || /\.(?:swp|tmp|bak)$/i.test(entry.name) || relative.toLowerCase() === WATCH_MARKER) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target, relative);
      else if (entry.isFile()) {
        try {
          const stat = fs.statSync(target);
          files.set(relative, `${stat.size}:${stat.mtimeMs}`);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  };
  visit(root);
  return files;
}

function sourcesChanged(previous, next) {
  return previous.size !== next.size || [...next].some(([file, signature]) => previous.get(file) !== signature);
}

function activeMarker(file = markerPath, now = Date.now()) {
  try {
    const marker = JSON.parse(fs.readFileSync(file, "utf8"));
    return marker.chanlumeDevWatch === true && Number.isFinite(marker.updatedAt) &&
      Math.abs(now - marker.updatedAt) < STALE_MS ? marker : null;
  } catch (_) {
    return null;
  }
}

function watchExtension(root = extensionRoot) {
  const markerFile = path.join(root, WATCH_MARKER);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  if (!manifest.content_scripts?.some(script => script.js?.includes("content/dev-reload.js"))) {
    throw new Error("Development reload script is not registered in the Chanlume manifest");
  }
  const existing = activeMarker(markerFile);
  if (existing && existing.pid !== process.pid) {
    throw new Error(`Another Chanlume watcher is active (PID ${existing.pid}). Stop it first.`);
  }
  let revision = crypto.randomUUID();
  let stopped = false;
  let changeTimer = null;
  let lastChange = "watcher started";
  let priorSources = sourceSnapshot(root);
  function writeMarker() {
    const marker = { chanlumeDevWatch: true, revision, updatedAt: Date.now(), pid: process.pid };
    fs.writeFileSync(markerFile, JSON.stringify(marker) + "\n", "utf8");
  }
  function finish() {
    if (stopped) return;
    stopped = true;
    if (changeTimer) clearTimeout(changeTimer);
    clearInterval(heartbeat);
    watcher.close();
    // Do not undo another watcher started in the meantime.
    if (activeMarker(markerFile)?.pid === process.pid) fs.writeFileSync(markerFile, OFF, "utf8");
    process.stdout.write("Chanlume dev watcher stopped.\n");
  }
  const watcher = fs.watch(root, { recursive: true }, (_event, file) => {
    const relative = String(file || "").replace(/\\/g, "/");
    if (relative.toLowerCase() === WATCH_MARKER) return;
    if (/\.(?:swp|tmp|bak)$/i.test(relative) || relative.split("/").some(part => part.startsWith("."))) return;
    lastChange = relative;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      const latestSources = sourceSnapshot(root);
      if (!sourcesChanged(priorSources, latestSources)) return;
      priorSources = latestSources;
      revision = crypto.randomUUID();
      writeMarker();
      process.stdout.write(`[${new Date().toLocaleTimeString()}] Changed: ${lastChange}; requested extension reload.\n`);
    }, CHANGE_DEBOUNCE_MS);
  });
  const heartbeat = setInterval(writeMarker, HEARTBEAT_MS);
  writeMarker();
  process.on("SIGINT", () => { finish(); process.exit(0); });
  process.on("SIGTERM", () => { finish(); process.exit(0); });
  process.on("exit", () => { if (!stopped) finish(); });
  process.stdout.write("Chanlume dev watcher running. Watches extension/; Ctrl+C to stop.\n");
  process.stdout.write(`Existing Helium extension path: ${root}\n`);
  process.stdout.write("Changes auto-reload Chanlume and refresh active YouTube / subscription pages.\n");
  return { finish };
}

if (require.main === module) {
  try { watchExtension(); }
  catch (error) { process.stderr.write(`Chanlume watcher: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { activeMarker, watchExtension, sourceSnapshot, sourcesChanged, extensionRoot, markerPath };
