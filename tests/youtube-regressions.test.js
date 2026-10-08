const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../extension/shared.js');

const data = { contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: {
  selected: true, endpoint: { commandMetadata: { webCommandMetadata: { url: '/@example/videos' } } },
  content: { richGridRenderer: { contents: [{ richItemRenderer: { content: { videoRenderer: {
    videoId: 'normal00001', title: { runs: [{ text: 'Title with {braces} & quotes "' }] }
  } } } }] } }
} }] } } };

test('October YouTube inert JSON and legacy assignments return identical normal uploads', () => {
  for (const html of [
    `<script nonce="x" type="application/json" id="yt-initial-data">${JSON.stringify(data)}</script>`,
    `<script id='yt-initial-data' type='application/json'>${JSON.stringify(data)}</script>`,
    `var ytInitialData = ${JSON.stringify(data)};`,
    `window['ytInitialData'] = ${JSON.stringify(data)};`
  ]) {
    assert.deepEqual(Core.parseYouTubeInitialData(html), data);
    assert.equal(Core.collectChannelUploads(Core.parseYouTubeInitialData(html))[0].id, 'normal00001');
  }
});

test('malformed or consent HTML is rejected without evaluating scripts', () => {
  for (const html of ['Consent required', '<script id="yt-initial-data">{bad}</script>', '<script>throw new Error("never execute")</script>']) {
    assert.throws(() => Core.parseYouTubeInitialData(html), /unavailable/);
  }
});
