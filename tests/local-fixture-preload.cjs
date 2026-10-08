// Optional offline fixture transport for Windows hosts that block loopback HTTP.
// Usage: node --require ./tests/local-fixture-preload.cjs tests/ui-smoke.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(path.join(process.env.CHANLUME_NODE_MODULES, 'playwright'));
const root = path.resolve(__dirname, '..');
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const route = async page => {
    await page.route('http://127.0.0.1:18766/**', async request => {
      const file = path.resolve(root, '.' + decodeURIComponent(new URL(request.request().url()).pathname));
      if (!file.startsWith(root + path.sep)) return request.fulfill({ status: 403, body: '' });
      try {
        const body = await fs.readFile(file);
        const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
        await request.fulfill({ body, contentType: type + (type.startsWith('text/') || type.includes('javascript') ? '; charset=utf-8' : '') });
      } catch (_) { await request.fulfill({ status: 404, body: '' }); }
    });
    return page;
  };
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => route(await newPage(...args));
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    return route(context);
  };
  return browser;
};
