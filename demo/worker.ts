import { allowedOrigin, demoApi, initialState, sessionFor, withCookie, type DemoState } from './api';

interface Environment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DEMO_SESSIONS: { getByName(name: string): { fetch(request: Request): Promise<Response> } };
}
interface SessionContext {
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  storage: { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void>; setAlarm(time: number): Promise<void>; deleteAll(): Promise<void> };
}

export class DemoSession {
  constructor(private readonly context: SessionContext) {}

  async fetch(request: Request) {
    return this.context.blockConcurrencyWhile(async () => {
      const state = await this.context.storage.get<DemoState>('state') ?? initialState();
      const response = await demoApi(request, state);
      if (request.method !== 'GET' && response.ok) {
        await this.context.storage.put('state', state);
        await this.context.storage.setAlarm(Date.now() + 7 * 86400000);
      }
      return response;
    });
  }

  async alarm() { await this.context.storage.deleteAll(); }
}

export default {
  async fetch(request: Request, env: Environment) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!allowedOrigin(request)) return new Response('Cross-origin demo request rejected.', { status: 403 });
    const session = sessionFor(request);
    const response = pathname === '/api/v1/catalog'
      ? await demoApi(request, initialState())
      : await env.DEMO_SESSIONS.getByName(session.id).fetch(request);
    return withCookie(response, session.cookie);
  },
};
