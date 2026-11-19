import { createServer } from 'node:http';
import { realpath, readFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDirectory = await realpath(fileURLToPath(new URL('./public/', import.meta.url)));
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
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
      response.writeHead(200, {
        'Content-Type': contentTypes.get(extname(file)) ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      }).end(body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createDevServer().listen(8080, '127.0.0.1', () => {
    console.log('http://127.0.0.1:8080/');
  });
}
