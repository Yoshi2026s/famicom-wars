import { createServer } from 'node:http';
import { realpath, readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDirectory = await realpath(fileURLToPath(new URL('./public/', import.meta.url)));
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.mp3', 'audio/mpeg'],
  ['.webp', 'image/webp'],
]);

export function createDevServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      const file = await realpath(resolve(publicDirectory, pathname === '/' ? 'index.html' : pathname.slice(1)));
      const location = relative(publicDirectory, file);
      if (isAbsolute(location) || location === '..' || location.startsWith('..' + sep)) {
        response.writeHead(404).end();
        return;
      }

      const body = await readFile(file);
      const headers = {
        'Content-Type': contentTypes.get(extname(file)) ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Length': body.length,
      };
      if (extname(file) === '.mp3') {
        headers['Accept-Ranges'] = 'bytes';
        if (request.headers.range) {
          const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
          const start = range?.[1] ? Number(range[1]) : Math.max(0, body.length - Number(range?.[2]));
          const end = range?.[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
          if (!range || start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
            response.writeHead(416, {'Content-Range': `bytes */${body.length}`}).end();
            return;
          }
          const part = body.subarray(start, end + 1);
          headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`;
          headers['Content-Length'] = part.length;
          response.writeHead(206, headers).end(part);
          return;
        }
      }
      response.writeHead(200, headers).end(body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = process.env.PORT ?? '8080';
  if (!/^\d+$/.test(requestedPort) || Number(requestedPort) > 65535) {
    throw new Error('PORT には 0〜65535 の整数を指定してください。');
  }
  const server = createDevServer();
  server.listen(Number(requestedPort), '127.0.0.1', () => {
    console.log(`http://127.0.0.1:${server.address().port}/`);
  });
}
