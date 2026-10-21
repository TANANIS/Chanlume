const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const packaged = path.join(root, "outputs", "extension");
const source = path.join(root, "extension");

test("production 1.24.1 background matches the audited historical bytes", () => {
  const background = fs.readFileSync(path.join(packaged, "background.js"));
  const fingerprint = crypto.createHash("sha256").update(background).digest("hex");
  assert.equal(fingerprint, "a38b9f76cdb2382f02b07232700965d6ac62a2cde3a8d7807b436f7bf2ccbdcd");
});

test("production release omits all development hot-reload machinery", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(packaged, "manifest.json"), "utf8"));
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
  const script = fs.readFileSync(path.join(packaged, "background.js"), "utf8");
  assert.equal(manifest.version, "1.24.1");
  assert.equal(manifest.version, sourceManifest.version);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, [
    "https://www.youtube.com/*",
    "https://www.googleapis.com/youtube/v3/*"
  ]);
  assert.ok(!fs.existsSync(path.join(packaged, "dev-reload.json")));
  assert.ok(!fs.existsSync(path.join(packaged, "content", "dev-reload.js")));
  assert.ok(manifest.content_scripts.every(entry =>
    !entry.js?.includes("content/dev-reload.js")));
  assert.doesNotMatch(script, /CHANLUME_DEV_|dev.reload|refreshDevTabsAfterReload/i);
});
