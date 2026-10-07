import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, "playwright"));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "outputs", "store-assets");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });

const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:18766/extension/dashboard/dashboard.html?lang=en", { waitUntil: "networkidle" });
await page.locator(".sidebar strong").filter({ hasText: "Chanlume" }).waitFor();
await page.screenshot({ path: path.join(output, "screenshot-library-1280x800.png") });
await page.locator('[data-view="settings"]').click();
await page.locator("#language-select").selectOption("en");
await page.screenshot({ path: path.join(output, "screenshot-settings-en-1280x800.png") });
await page.close();

const promo = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
await promo.goto("http://127.0.0.1:18766/work/store-promo.html");
await promo.screenshot({ path: path.join(output, "small-promo-440x280.png") });
await promo.close();

await browser.close();
console.log(output);
