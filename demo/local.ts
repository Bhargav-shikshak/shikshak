import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { allowedOrigin, demoApi, initialState, sessionFor, withCookie, type DemoState } from './api';

export function localApi(folder: string, log: (error: string) => void = console.error) {
  const locks = new Map<string, Promise<unknown>>();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next();
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
      const bodyParts: Uint8Array[] = [];
      let length = 0;
      for await (const part of req) {
        length += part.length;
        if (length > 16384) { res.writeHead(413).end(); return; }
        bodyParts.push(part);
      }
      const request = new Request('http://' + req.headers.host + req.url, {
        method: req.method, headers, body: bodyParts.length ? Buffer.concat(bodyParts) : undefined,
      });
      if (!allowedOrigin(request)) { res.writeHead(403).end(); return; }
      const session = sessionFor(request);
      const path = resolve(folder, session.id + '.json');
      const work = (locks.get(session.id) ?? Promise.resolve()).catch(() => {}).then(async () => {
        let state: DemoState;
        try { state = JSON.parse(await readFile(path, 'utf8')); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          state = initialState();
        }
        const response = await demoApi(request, state);
        if (request.method !== 'GET' && response.ok) {
          await mkdir(folder, { recursive: true });
          await writeFile(path + '.tmp', JSON.stringify(state));
          await rename(path + '.tmp', path);
        }
        return withCookie(response, session.cookie);
      });
      locks.set(session.id, work);
      let result: Response;
      try { result = await work; }
      finally { if (locks.get(session.id) === work) locks.delete(session.id); }
      res.writeHead(result.status, Object.fromEntries(result.headers.entries()));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      log(String(error));
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'The demo API could not complete this request.' }));
    }
  };
}
