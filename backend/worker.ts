import { catalog } from '../demo/seed';
// Keep the legacy class export so existing Cloudflare bindings remain valid.
export { DemoSession } from '../demo/worker';

interface Environment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}
type Json = Record<string, any>;
class HttpError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const MAX_PDF = 10 * 1024 * 1024;
const MAX_JSON = 40_000;
const json = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
function cookieName(request: Request, type: string) {
  return (new URL(request.url).protocol === 'https:' ? '__Host-' : '') + 'shikshak_' + type;
}
function cookie(request: Request, type: string, value: string, age: number) {
  return cookieName(request, type) + '=' + encodeURIComponent(value) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + age +
    (new URL(request.url).protocol === 'https:' ? '; Secure' : '');
}
function readCookie(request: Request, type: string) {
  const name = cookieName(request, type) + '=';
  const part = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(name));
  try { return part ? decodeURIComponent(part.slice(name.length)) : ''; } catch { return ''; }
}
async function limitedBytes(request: Request, max: number) {
  if (Number(request.headers.get('content-length')) > max) throw new HttpError('This upload is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) { await reader.cancel(); throw new HttpError('This upload is too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function bodyJson(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new HttpError('Send a JSON request.');
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(await limitedBytes(request, MAX_JSON)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Json;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Invalid JSON request.');
  }
}
function setup(env: Environment) {
  if (!env.SUPABASE_URL?.startsWith('https://') || !env.SUPABASE_PUBLISHABLE_KEY)
    throw new HttpError('The backend is not configured.', 503);
  return env.SUPABASE_URL.replace(/\/$/, '');
}
async function upstream(env: Environment, path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);
  headers.set('apikey', env.SUPABASE_PUBLISHABLE_KEY);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch(setup(env) + path, { ...options, headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as Json;
    const message = typeof data.msg === 'string' ? data.msg : typeof data.message === 'string' ? data.message :
      typeof data.error_description === 'string' ? data.error_description : 'The backend could not complete this request.';
    throw new HttpError(response.status >= 500 ? 'The backend is temporarily unavailable. Please retry.' : message, response.status);
  }
  return response;
}
async function auth(env: Environment, path: string, input: Json) {
  return (await upstream(env, '/auth/v1/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })).json() as Promise<Json>;
}
async function database(env: Environment, token: string, path: string, method: string, input: Json = {}) {
  return (await upstream(env, '/rest/v1/rpc/shikshak_api', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, method, input }),
  }, token)).json() as Promise<any>;
}
function setSession(request: Request, headers: Headers, session: Json) {
  headers.append('Set-Cookie', cookie(request, 'access', session.access_token, session.expires_in || 3600));
  headers.append('Set-Cookie', cookie(request, 'refresh', session.refresh_token, 30 * 86400));
}
function clearSession(request: Request, headers: Headers) {
  headers.append('Set-Cookie', cookie(request, 'access', '', 0));
  headers.append('Set-Cookie', cookie(request, 'refresh', '', 0));
}
export async function handleApi(request: Request, env: Environment): Promise<Response> {
  const headers = new Headers();
  let response: Response;
  try {
    const url = new URL(request.url);
    const method = request.method;
    // Reject cross-site requests even when a browser omits Origin.
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site')
      throw new HttpError('Cross-origin requests are not permitted.', 403);
    const path = decodeURIComponent(url.pathname.replace(/^\/api\/v1\/?/, '')).replace(/\/$/, '');
    if (!url.pathname.startsWith('/api/v1/')) throw new HttpError('Endpoint not found.', 404);
    if (method === 'GET' && path === 'catalog') return json({ ...catalog, demo: false, workspaces: {
      student: { ...catalog.workspaces.student, id: 'student', name: 'Student', initials: 'ST' },
      teacher: { ...catalog.workspaces.teacher, id: 'teacher', name: 'Teacher', initials: 'TE' },
    } });
    setup(env);
    if (method === 'GET' && path === 'health') {
      const result = await (await upstream(env, '/rest/v1/rpc/shikshak_health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
      return json({ ...result as Json, service: 'shikshak', backend: 'supabase', project: new URL(env.SUPABASE_URL).hostname.split('.')[0] });
    }
    let token = readCookie(request, 'access');
    const refresh = async () => {
      const refreshToken = readCookie(request, 'refresh');
      if (!refreshToken) throw new HttpError('Sign in to continue.', 401);
      const session = await auth(env, 'token?grant_type=refresh_token', { refresh_token: refreshToken });
      if (!session.access_token || !session.refresh_token) throw new HttpError('Sign in again.', 401);
      token = session.access_token;
      setSession(request, headers, session);
    };
    const rpc = async (route: string, verb = 'GET', input: Json = {}) => {
      if (!token) await refresh();
      try { return await database(env, token, route, verb, input); }
      catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401) throw error;
        await refresh();
        return database(env, token, route, verb, input);
      }
    };
    if (method === 'POST' && (path === 'auth/login' || path === 'auth/signup')) {
      const input = await bodyJson(request);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 128 || !password)
        throw new HttpError('Enter a valid email and password.');
      let session: Json;
      if (path === 'auth/signup') {
        if (!['student', 'teacher'].includes(input.role) || password.length < 10 ||
          typeof input.name !== 'string' || !input.name.trim() || !input.homeArea ||
          !Number.isFinite(input.homeArea.lat) || !Number.isFinite(input.homeArea.lng) ||
          Math.abs(input.homeArea.lat) > 90 || Math.abs(input.homeArea.lng) > 180 ||
          typeof input.homeArea.city !== 'string' || !input.homeArea.city.trim() ||
          typeof input.homeArea.locality !== 'string' || !input.homeArea.locality.trim())
          throw new HttpError('Enter your name, neighbourhood and a password of 10–128 characters.');
        session = await auth(env, 'signup', { email, password, data: {
          name: input.name.trim().slice(0, 60), role: input.role, localityId: input.localityId,
          homeArea: { lat: Math.round(input.homeArea.lat * 100) / 100, lng: Math.round(input.homeArea.lng * 100) / 100,
            city: input.homeArea.city.trim().slice(0, 90), locality: input.homeArea.locality.trim().slice(0, 100) },
        } });
        if (!session.access_token) return json({ confirmationRequired: true,
          message: 'Account created. Check your email for the confirmation link, then log in.' }, 202);
      } else session = await auth(env, 'token?grant_type=password', { email, password });
      if (!session.access_token || !session.refresh_token) throw new HttpError('Sign in could not be completed.', 401);
      token = session.access_token;
      // Fetch role and status from the database, not editable auth metadata.
      const account = await database(env, token, 'auth/me', 'GET');
      setSession(request, headers, session);
      response = json(account, path === 'auth/signup' ? 201 : 200);
    } else if (method === 'POST' && path === 'auth/logout') {
      try {
        if (!token && readCookie(request, 'refresh')) await refresh();
        if (token) await upstream(env, '/auth/v1/logout?scope=local', { method: 'POST' }, token);
      } catch (error) {
        if (!(error instanceof HttpError) || ![401,403].includes(error.status)) throw error;
      } finally { clearSession(request, headers); }
      response = json({ ok: true });
    } else if (method === 'POST' && path === 'admin/bootstrap') {
      // A current confirmed account and one-time database setup key are both required.
      const input = await bodyJson(request);
      const session = await auth(env, 'token?grant_type=password', { email: input.email, password: input.password });
      token = session.access_token;
      if (!token) throw new HttpError('Create and confirm your account first.', 401);
      const account = await rpc('admin/bootstrap', 'POST', { setupToken: input.setupToken });
      setSession(request, headers, session);
      response = json(account);
    } else {
      const fileRoute = path.match(/^workspaces\/(student|teacher)\/connections\/([a-f0-9-]{36})\/files(?:\/([a-f0-9-]{36}))?$/i);
      if (fileRoute && method === 'POST' && !fileRoute[3]) {
        const me = await rpc('auth/me');
        if (me.role !== fileRoute[1]) throw new HttpError('Workspace access denied.', 403);
        const room = await rpc(path.replace(/\/files$/, '/classroom'));
        const bytes = await limitedBytes(request, MAX_PDF + 64_000);
        const form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
        const file = form.get('file');
        const kind = String(form.get('kind') ?? '');
        if (!(file instanceof File) || file.size < 1 || file.size > MAX_PDF ||
          !file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf' ||
          !['note','assignment','submission'].includes(kind) ||
          (kind === 'submission' ? me.role !== 'student' : me.role !== 'teacher'))
          throw new HttpError('Choose a PDF under 10 MB for this classroom.');
        const raw = await file.arrayBuffer();
        if (new TextDecoder().decode(raw.slice(0, 5)) !== '%PDF-') throw new HttpError('This file is not a valid PDF.');
        const id = crypto.randomUUID();
        const objectPath = [room.studentId, room.teacherId, me.id, kind, id + '.pdf'].join('/');
        await upstream(env, '/storage/v1/object/classroom-pdfs/' + objectPath, {
          method: 'POST', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: raw,
        }, token);
        response = json(await rpc(path, 'POST', { id, name: file.name, sizeBytes: file.size, kind }), 201);
      } else if (fileRoute && method === 'GET' && fileRoute[3]) {
        const data = await rpc(path);
        if (!data) throw new HttpError('PDF not found.', 404);
        const stored = await upstream(env, '/storage/v1/object/authenticated/classroom-pdfs/' + data.path, {}, token);
        response = new Response(stored.body, { headers: {
          'Content-Type': 'application/pdf', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(data.pdf.name),
          'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        } });
      } else {
        const input = method === 'GET' ? Object.fromEntries(url.searchParams) : await bodyJson(request);
        if (method === 'GET' && path.endsWith('/discovery')) {
          const area = catalog.localities.find(x => x.id === input.locality);
          if (area) input.origin = { lat: area.lat, lng: area.lng };
        }
        response = json(await rpc(path, method, input));
      }
    }
  } catch (error) {
    const known = error instanceof HttpError;
    if (known && error.status === 401) clearSession(request, headers);
    response = json({ message: known ? error.message : 'The backend is temporarily unavailable. Please retry.' }, known ? error.status : 503);
  }
  for (const [key, value] of headers) {
    if (key.toLowerCase() !== 'set-cookie') response.headers.set(key, value);
  }
  for (const value of headers.getSetCookie()) response.headers.append('Set-Cookie', value);
  return response;
}
export default {
  async fetch(request: Request, env: Environment) {
    if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
