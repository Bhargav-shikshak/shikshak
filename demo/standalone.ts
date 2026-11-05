import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localApi } from './local';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const project = fileURLToPath(new URL('..', import.meta.url));
const publicDir = resolve(project, 'dist');
const api = localApi(resolve(project, '.demo-data'));

async function staticResponse(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const requested = resolve(publicDir, '.' + pathname);
  if (requested !== publicDir && !requested.startsWith(publicDir + sep)) { res.writeHead(403).end(); return; }
  const file = extname(requested) ? requested : resolve(publicDir, 'index.html');
  try {
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {
    res.writeHead(404).end('File not found. Run npm run build to regenerate the demo.');
  }
}

const port = Number(process.env.PORT ?? 4173);
const server = createServer((req, res) => {
  const host = req.headers.host?.split(':')[0];
  if (host !== '127.0.0.1' && host !== 'localhost') { res.writeHead(403).end(); return; }
  void api(req, res, () => { void staticResponse(req, res); });
});
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') console.log('Shikshak demo: http://127.0.0.1:' + address.port + '/');
});
