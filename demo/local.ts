import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { allowedOrigin, demoApi, initialState, type DemoState } from './api';

export function localApi(folder: string, log: (error: string) => void = console.error) {
  // Local preview uses one shared platform store, just like the production Durable Object.
  // Authenticated accounts can therefore discover and match with each other across browsers.
  let lock: Promise<unknown> = Promise.resolve();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next();
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (typeof value === 'string') headers.set(key, value);
      const bodyParts: Uint8Array[] = [];
      let length = 0;
      for await (const part of req) {
        length += part.length;
        if (length > 65536) { res.writeHead(413).end(); return; }
        bodyParts.push(part);
      }
      const request = new Request('http://' + req.headers.host + req.url, {
        method: req.method, headers, body: bodyParts.length ? Buffer.concat(bodyParts) : undefined,
      });
      if (!allowedOrigin(request)) { res.writeHead(403).end(); return; }
      const path = resolve(folder, 'shikshak-platform.json');
      const work = lock.catch(() => {}).then(async () => {
        let state: DemoState;
        try { state = JSON.parse(await readFile(path, 'utf8')) as DemoState; }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          state = initialState();
        }
        const response = await demoApi(request, state, {
          adminBootstrapToken: process.env.SHIKSHAK_ADMIN_BOOTSTRAP_TOKEN,
        });
        // Failed login attempts and initial classroom creation are also state transitions.
        if (request.method !== 'GET' || request.url.includes('/classrooms')) {
          await mkdir(folder, { recursive: true });
          await writeFile(path + '.tmp', JSON.stringify(state));
          await rename(path + '.tmp', path);
        }
        return response;
      });
      lock = work;
      const response = await work;
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      log(String(error));
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'The local API could not complete this request.' }));
    }
  };
}
