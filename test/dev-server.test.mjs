import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDevServer } from '../dev-server.mjs';

const serverScript = fileURLToPath(new URL('../dev-server.mjs', import.meta.url));

test('プレビュー用に割り当てられたポートで起動し、実際のURLを表示する', {timeout: 10000}, async () => {
  const child = spawn(process.execPath, [serverScript], {
    env: {...process.env, PORT: '0'},
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const closed = once(child, 'close');
  const lines = createInterface({input: child.stdout});
  try {
    const {value: url} = await lines[Symbol.asyncIterator]().next();
    assert.match(url, /^http:\/\/127\.0\.0\.1:[1-9]\d*\/$/);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>スマホウォーズ/);
  } finally {
    lines.close();
    child.kill();
    await closed;
  }
});

test('不正なポート指定を起動時に報告する', () => {
  for (const port of ['invalid', '65536']) {
    const result = spawnSync(process.execPath, [serverScript], {
      env: {...process.env, PORT: port}, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PORT には/);
  }
});

test('トップページを配信し、公開範囲外のファイルを返さない', async (context) => {
  const server = createDevServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<title>スマホウォーズ｜湾岸の攻防<\/title>/);
  assert.match(html, /name="apple-mobile-web-app-title" content="スマホウォーズ"/);
  assert.match(html, /id="mission-title" tabindex="-1">湾岸の攻防/);
  assert.match(html, /coastal-scenario\.js[^>]*><\/script>\s*<script defer src="\.\/map-generator\.js[^>]*><\/script>\s*<script defer src="\.\/rules\.js/);
  assert.doesNotMatch(html, /歩兵訓練|歩兵戦|水辺の攻防|href="#(?:training|battle|crossing)"/);
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\.\/assets\/home-icon-180\.png"/);

  const manifestResponse = await fetch(base + '/manifest.webmanifest');
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get('content-type'), /^application\/manifest\+json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, 'スマホウォーズ');
  assert.equal(manifest.short_name, 'スマホウォーズ');
  assert.equal(new URL(manifest.start_url, manifestResponse.url).href, base + '/');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  for (const {src, sizes} of [...manifest.icons, {src: './assets/home-icon-180.png', sizes: '180x180'}]) {
    const response = await fetch(new URL(src, manifestResponse.url));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, sizes);
  }

  const outside = await fetch(base + '/..%2fREADME.md');
  assert.equal(outside.status, 404);

  const preview = await fetch(base + '/assets/bgm-map.mp3', {headers: {Range: 'bytes=0-3'}});
  assert.equal(preview.status, 206);
  assert.equal(preview.headers.get('Content-Type'), 'audio/mpeg');
  assert.match(preview.headers.get('Content-Range'), /^bytes 0-3\/\d+$/);
  const frame = new Uint8Array(await preview.arrayBuffer());
  assert.equal(frame.length, 4);
  assert.equal(frame[0], 0xff);
  assert.equal(frame[1] & 0xe0, 0xe0);

  const invalidRange = await fetch(base + '/assets/bgm-map.mp3', {headers: {Range: 'bytes=-0'}});
  assert.equal(invalidRange.status, 416);
});
