import { allowedOrigin, demoApi, initialState, type DemoState } from './api';

interface Environment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DEMO_SESSIONS: { getByName(name: string): { fetch(request: Request): Promise<Response> } };
  ADMIN_BOOTSTRAP_TOKEN?: string;
}
interface SessionContext {
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
}

// The existing Durable Object class name remains unchanged to preserve the deployed binding.
// All registered users share ONE platform instance; the previous per-browser demo state is
// not reused or migrated. Authentication and authorisation happen inside this object.
export class DemoSession {
  constructor(
    private readonly context: SessionContext,
    private readonly env: Environment,
  ) {}

  async fetch(request: Request) {
    return this.context.blockConcurrencyWhile(async () => {
      const state = await this.context.storage.get<DemoState>('state') ?? initialState();
      // Prune expired sessions on each write to avoid unbounded accumulation.
      if (request.method !== 'GET') {
        const now = Date.now();
        for (const [token, session] of Object.entries(state.sessions))
          if (session.expiresAt < now) delete state.sessions[token];
      }
      const response = await demoApi(request, state, {
        adminBootstrapToken: this.env.ADMIN_BOOTSTRAP_TOKEN,
      });
      if (request.method !== 'GET' || new URL(request.url).pathname.endsWith('/classrooms'))
        await this.context.storage.put('state', state);
      return response;
    });
  }
}

export default {
  async fetch(request: Request, env: Environment) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!allowedOrigin(request)) return new Response('Cross-origin request rejected.', { status: 403 });
    if (pathname === '/api/v1/catalog') return demoApi(request, initialState());
    return env.DEMO_SESSIONS.getByName('shikshak-platform-v1').fetch(request);
  },
};
