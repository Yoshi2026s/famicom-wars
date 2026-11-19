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
});
