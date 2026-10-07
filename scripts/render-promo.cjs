'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'outputs', 'promo');
const framesDir = path.join(root, 'work', 'promo', 'frames');
const introPath = path.join(outputDir, 'Chanlume-1.19.3-intro.mp4');
const gifPath = path.join(outputDir, 'Chanlume-1.19.3-preview.gif');
const posterPath = path.join(outputDir, 'Chanlume-1.19.3-poster.png');
const python = process.env.CODEX_PYTHON || 'C:\\Users\\JSrad\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
const port = 8777;

function mime(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.mp4': 'video/mp4' })[path.extname(file)] || 'application/octet-stream';
}

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
      const file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('Not found'); return;
      }
      res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

function readGifMetadata(file) {
  const script = [
    'import json, sys',
    'from PIL import Image',
    'im = Image.open(sys.argv[1])',
    'total = 0',
    'for i in range(im.n_frames):',
    '    im.seek(i)',
    '    total += im.info.get("duration", 0)',
    'print(json.dumps({"frames": im.n_frames, "durationMs": total, "loop": im.info.get("loop", 0)}))'
  ].join('\n');
  return JSON.parse(execFileSync(python, ['-c', script, file], { encoding: 'utf8' }));
}

async function main() {
  const videoOnly = process.argv.includes('--video-only');
  const promoWorkRoot = `${path.join(root, 'work', 'promo')}${path.sep}`;
  if (!framesDir.startsWith(promoWorkRoot)) throw new Error(`Refusing to clear unexpected frames path: ${framesDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, acceptDownloads: true });
    await page.goto(`http://127.0.0.1:${port}/work/promo/chanlume-promo.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ready === true);

    if (!videoOnly) {
      await page.evaluate(() => window.renderPoster());
      await page.locator('canvas').screenshot({ path: posterPath });

      const frameCount = 108;
      for (let i = 0; i < frameCount; i++) {
        const t = i * 9 / frameCount;
        await page.evaluate(time => window.renderGifAt(time), t);
        await page.locator('canvas').screenshot({ path: path.join(framesDir, `frame-${String(i).padStart(3, '0')}.png`) });
      }
      execFileSync(python, [path.join(root, 'scripts', 'build-promo-gif.py'), framesDir, gifPath, '--width', '800', '--duration', '83'], { stdio: 'inherit' });
    }

    page.setDefaultTimeout(180_000);
    const downloadPromise = page.waitForEvent('download', { timeout: 180_000 });
    const recording = await page.evaluate(() => window.encodeMp4());
    const download = await downloadPromise;
    await download.saveAs(introPath);

    const gifMetadata = readGifMetadata(gifPath);
    const manifest = {
      product: 'Chanlume',
      version: '1.19.3',
      generatedAt: new Date().toISOString(),
      source: ['work/promo/chanlume-promo.html', 'work/promo/chanlume-promo.js', 'scripts/render-promo.cjs', 'scripts/build-promo-gif.py'],
      storeUrl: 'https://chromewebstore.google.com/detail/agnnbehkdkdkflknblhkmgciaekngole?utm_source=item-share-cb',
      privacy: 'All channel names, video titles, counts, and thumbnails shown are fictional mock data.',
      outputs: [
        { file: path.basename(introPath), kind: 'video', format: 'MP4', width: 1280, height: 720, durationSeconds: recording.duration, mimeType: recording.mimeType, hasAudio: false, sha256: sha256(introPath), bytes: fs.statSync(introPath).size },
        { file: path.basename(gifPath), kind: 'preview', format: 'GIF', width: 800, height: 450, durationSeconds: gifMetadata.durationMs / 1000, frames: gifMetadata.frames, loop: gifMetadata.loop === 0, sha256: sha256(gifPath), bytes: fs.statSync(gifPath).size },
        { file: path.basename(posterPath), kind: 'poster', format: 'PNG', width: 1280, height: 720, sha256: sha256(posterPath), bytes: fs.statSync(posterPath).size }
      ]
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
