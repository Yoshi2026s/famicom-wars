import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createDevServer } from '../dev-server.mjs';

test('トップページを配信し、公開範囲外のファイルを返さない', async (context) => {
  const server = createDevServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /ファミコンウォーズ/);

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
