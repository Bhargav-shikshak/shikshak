import type { Connection, ConnectionStatus, DiscoveryListing, Listing, ListingDraft, Message, Point, Role } from '../shared/domain';
import { catalog, seedListings } from './seed';

export interface DemoState {
  own: Partial<Record<Role, Listing>>;
  saves: Record<string, string[]>;
  interests: Record<string, string[]>;
  messages: Record<string, Message[]>;
}
export function initialState(): DemoState {
  return { own: {}, saves: {}, interests: { 't-riya': ['demo-student'], 's-kashyap': ['demo-teacher'] }, messages: {} };
}
const opposite = (role: Role) => role === 'student' ? 'teacher' : 'student';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message: string, status = 400) => json({ message }, status);
const pairKey = (a: string, b: string) => [a, b].sort().join(':');

function statusFor(state: DemoState, me: string, other: string): ConnectionStatus | null {
  const outgoing = state.interests[me]?.includes(other);
  const incoming = state.interests[other]?.includes(me);
  if (outgoing && incoming) return 'matched';
  if (incoming) return 'incoming';
  return outgoing ? 'sent' : null;
}

function distanceKm(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (a.lat - b.lat) * rad;
  const dLng = (a.lng - b.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function cleanText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function validValues(value: unknown, allowed: string[]) {
  return Array.isArray(value) ? allowed.filter((item) => value.includes(item)) : [];
}

function listingFrom(input: unknown, role: Role): Listing | null {
  if (!input || typeof input !== 'object') return null;
  const data = input as Partial<ListingDraft>;
  const name = cleanText(data.name, 60);
  const headline = cleanText(data.headline, 90);
  const availability = cleanText(data.availability, 100);
  const description = cleanText(data.description, 700);
  const locality = catalog.localities.find((area) => area.id === data.localityId);
  const subjects = validValues(data.subjects, catalog.subjects);
  const grades = validValues(data.grades, catalog.grades);
  const rate = data.rate;
  if (!name || !headline || !availability || !description || !locality || !subjects.length || !grades.length ||
      typeof rate !== 'number' || !Number.isInteger(rate) || rate < 50 || rate > 10000) return null;
  return { id: catalog.workspaces[role].id, role, name, headline, availability, description, localityId: locality.id,
    locality: locality.name, location: { lat: locality.lat, lng: locality.lng }, subjects, grades, rate, published: data.published === true,
    avatar: 0, color: role === 'student' ? 'sage' : 'peach' };
}

export async function demoApi(request: Request, state: DemoState): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = request.method;
  if (parts.join('/') === 'api/v1/catalog' && method === 'GET') return json(catalog);
  const role = parts[3];
  if (parts[0] !== 'api' || parts[1] !== 'v1' || parts[2] !== 'workspaces' || (role !== 'student' && role !== 'teacher')) {
    return fail('This endpoint could not be found.', 404);
  }
  const me = catalog.workspaces[role].id;
  const others = [...seedListings, ...Object.values(state.own)].filter((item) => item.role === opposite(role));
  const [, , , , resource, id, action] = parts;
  if (parts.length === 5 && resource === 'listing') {
    if (method === 'GET') return json(state.own[role] ?? null);
    if (method === 'PUT') {
      const listing = listingFrom(await request.json().catch(() => null), role);
      if (!listing) return fail('Complete all fields and enter a whole hourly rate between ₹50 and ₹10,000.');
      state.own[role] = listing;
      return json(listing);
    }
  }
  if (parts.length === 5 && resource === 'discovery' && method === 'GET') {
    const params = url.searchParams;
    const origin = catalog.localities.find((area) => area.id === params.get('locality')) ??
      catalog.localities.find((area) => area.id === state.own[role]?.localityId) ??
      catalog.localities.find((area) => area.id === catalog.defaultLocality)!;
    const query = (params.get('query') ?? '').toLowerCase().trim();
    const radius = Number(params.get('radius')) || Infinity;
    const maxRate = Number(params.get('maxRate')) || Infinity;
    const subject = params.get('subject');
    const grade = params.get('grade');
    const published = others.filter((item) => item.published);
    const listings: DiscoveryListing[] = published.map((item) => ({
      ...item, distance: distanceKm(origin, item.location), saved: state.saves[me]?.includes(item.id) ?? false,
      connection: statusFor(state, me, item.id),
    })).filter((item) =>
      (!subject || item.subjects.includes(subject)) && (!grade || item.grades.includes(grade)) &&
      item.rate <= maxRate && item.distance <= radius && (params.get('saved') !== 'true' || item.saved) &&
      (!query || [item.name, item.headline, item.locality, ...item.subjects].some((value) => value.toLowerCase().includes(query)))
    );
    listings.sort((a, b) => params.get('sort') === 'rate' ? a.rate - b.rate || a.distance - b.distance : a.distance - b.distance);
    return json({ listings, origin: { lat: origin.lat, lng: origin.lng }, total: published.length });
  }
  if (parts.length === 5 && resource === 'connections' && method === 'GET') {
    const connections: Connection[] = others.flatMap((listing) => {
      const status = statusFor(state, me, listing.id);
      return status && (listing.published || status === 'matched') ? [{ listing, status }] : [];
    });
    return json(connections);
  }
  const target = others.find((item) => item.id === id);
  if (parts.length === 7 && resource === 'listings' && target?.published) {
    if (action === 'save' && method === 'PUT') {
      const data = await request.json().catch(() => null) as { saved?: boolean } | null;
      if (typeof data?.saved !== 'boolean') return fail('Choose whether to save this listing.');
      const saved = new Set(state.saves[me] ?? []);
      if (data.saved) saved.add(target.id);
      else saved.delete(target.id);
      state.saves[me] = [...saved];
      return json({ saved: data.saved });
    }
    if (action === 'interest' && method === 'PUT') {
      state.interests[me] = [...new Set([...(state.interests[me] ?? []), target.id])];
      return json({ status: statusFor(state, me, target.id) });
    }
  }
  if (parts.length === 7 && resource === 'connections' && action === 'messages' && target) {
    if (statusFor(state, me, target.id) !== 'matched') return fail('Messaging opens after a mutual match.', 403);
    const key = pairKey(me, target.id);
    const messages = state.messages[key] ?? [];
    if (method === 'GET') return json(messages);
    if (method === 'POST') {
      const data = await request.json().catch(() => null) as { body?: string; id?: string } | null;
      const body = cleanText(data?.body, 500);
      const id = cleanText(data?.id, 60);
      if (!body || !id) return fail('Enter a message before sending.');
      const previous = messages.find((message) => message.id === id && message.authorId === me);
      if (previous) return json(previous);
      const message: Message = { id, body, authorId: me, sentAt: new Date().toISOString() };
      state.messages[key] = [...messages.slice(-99), message];
      return json(message, 201);
    }
  }
  return fail('This endpoint or listing could not be found.', 404);
}

export function sessionFor(request: Request) {
  const existing = request.headers.get('cookie')?.match(/(?:^|;\s*)studylane_demo=([a-f0-9-]{36})(?:;|$)/i)?.[1];
  const id = existing ?? crypto.randomUUID();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return { id, cookie: existing ? null : 'studylane_demo=' + id + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800' + secure };
}

export function withCookie(response: Response, cookie: string | null) {
  if (!cookie) return response;
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie);
  return new Response(response.body, { status: response.status, headers });
}

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
