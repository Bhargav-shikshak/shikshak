import type {
  AdminSnapshot, BookingRequest, BookingStatus, ClassSession, Classroom, ClassroomSummary, ConnectionStatus,
  DiscoveryListing, HomeArea, Homework, LessonNote, Listing, ListingDraft, Message, Point,
  PdfNoteAttachment, PriceSettings, PublicAccount, Role,
} from '../shared/domain';
import { catalog } from './seed';

interface Account extends PublicAccount { salt: string; passwordHash: string }
interface Session { userId: string; expiresAt: number }
export interface DemoState {
  accounts: Record<string, Account>;
  sessions: Record<string, Session>;
  own: Record<string, Listing>;
  saves: Record<string, string[]>;
  interests: Record<string, string[]>;
  bookings?: Record<string, BookingRequest>;
  bookingVersion?: number;
  messages: Record<string, Message[]>;
  classrooms: Record<string, Classroom>;
  pricing: PriceSettings;
  attempts: Record<string, { count: number; until: number }>;
}
export const initialPricing: PriceSettings = {
  baseRate: 400, freeRadiusKm: 2, distanceStepKm: 2, stepFee: 50, maxTravelFee: 300,
};
export function initialState(): DemoState {
  return {
    accounts: {}, sessions: {}, own: {}, saves: {}, interests: {}, messages: {},
    bookings: {}, bookingVersion: 1,
    classrooms: {}, pricing: { ...initialPricing }, attempts: {},
  };
}
// Trusted in-process override used only by the browser-local demo adapter.
// The deployed HTTP worker never derives this value from client request headers.
type Options = { adminBootstrapToken?: string; browserSessionToken?: string };
const opposite = (role: Role): Role => role === 'student' ? 'teacher' : 'student';
const json = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (message: string, status = 400) => json({ message }, status);
const pairKey = (a: string, b: string) => [a, b].sort().join(':');
const cleanText = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const validValues = (value: unknown, allowed: string[]) =>
  Array.isArray(value) ? allowed.filter((item) => value.includes(item)) : [];
const isRole = (role: string): role is Role => role === 'student' || role === 'teacher';
const cookieName = 'shikshak_auth';
const cookieSecure = (request: Request) => new URL(request.url).protocol === 'https:' ? '; Secure' : '';
function authCookie(request: Request, token: string) {
  return cookieName + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' + cookieSecure(request);
}
function expiredCookie(request: Request) {
  return cookieName + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + cookieSecure(request);
}
function readToken(request: Request, trustedBrowserToken?: string) {
  return trustedBrowserToken ?? request.headers.get('cookie')?.match(/(?:^|;\s*)shikshak_auth=([a-f0-9-]{36})(?:;|$)/i)?.[1] ?? '';
}
function sessionUser(request: Request, state: DemoState, trustedBrowserToken?: string): Account | null {
  const token = readToken(request, trustedBrowserToken);
  const session = state.sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  const account = state.accounts[session.userId];
  return account?.active ? account : null;
}
function safeAccount(account: Account): PublicAccount {
  const { salt: _salt, passwordHash: _hash, ...rest } = account;
  return rest;
}
function id() { return crypto.randomUUID(); }
const encoder = new TextEncoder();
async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', iterations: 210000, salt: encoder.encode(salt),
  }, key, 256);
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function constantTimeEqual(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}
function distanceKm(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const dLat = (a.lat - b.lat) * rad, dLng = (a.lng - b.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
function quote(state: DemoState, teacher: Listing, studentPoint: Point) {
  const distance = distanceKm(teacher.location, studentPoint);
  const baseRate = teacher.rate;
  const steps = Math.ceil(Math.max(0, distance - state.pricing.freeRadiusKm) / state.pricing.distanceStepKm);
  const travelFee = Math.min(state.pricing.maxTravelFee, steps * state.pricing.stepFee);
  return { rate: baseRate + travelFee, baseRate, travelFee, distance };
}
function statusFor(state: DemoState, me: string, other: string): ConnectionStatus | null {
  const outgoing = state.interests[me]?.includes(other);
  const incoming = state.interests[other]?.includes(me);
  if (outgoing && incoming) return 'matched';
  if (incoming) return 'incoming';
  return outgoing ? 'sent' : null;
}

/** Migrate old demo mutual interests without deleting existing classroom or chat history.
 * Existing reciprocal pairs become accepted bookings. One-way teacher-originated
 * interest is discarded; only student-originated requests remain pending.
 */
function ensureBookingState(state: DemoState): Record<string, BookingRequest> {
  const bookings = state.bookings ??= {};
  if (state.bookingVersion === 1) return bookings;
  const oldInterests = state.interests ?? {};
  for (const student of Object.values(state.accounts).filter(a => a.role === 'student')) {
    for (const teacher of Object.values(state.accounts).filter(a => a.role === 'teacher')) {
      const outgoing = oldInterests[student.id]?.includes(teacher.id);
      const incoming = oldInterests[teacher.id]?.includes(student.id);
      const key = pairKey(student.id, teacher.id);
      if (!outgoing || Object.values(bookings).some(b => pairKey(b.studentId, b.teacherId) === key)) continue;
      const teacherListing = state.own[teacher.id];
      const studentListing = state.own[student.id];
      if (!teacherListing) continue;
      const session = state.classrooms[key]?.sessions.find(s => s.status === 'scheduled');
      const startsAt = session?.startsAt ?? new Date(Date.now() + 7 * 86400000).toISOString();
      const subject = teacherListing.subjects.find(s => studentListing?.subjects.includes(s)) ??
        teacherListing.subjects[0] ?? 'Mathematics';
      const grade = teacherListing.grades.find(g => studentListing?.grades.includes(g)) ??
        teacherListing.grades[0] ?? 'Classes 9–10';
      const booked: BookingRequest = {
        id: 'legacy-booking-' + student.id + '-' + teacher.id,
        studentId: student.id, teacherId: teacher.id,
        studentName: student.name, teacherName: teacher.name,
        subject, grade, startsAt, durationMinutes: session?.durationMinutes ?? 60,
        note: incoming ? 'Existing tutoring relationship migrated from an earlier demo.' :
          'Earlier student request migrated from the demo.',
        quotedRate: quote(state, teacherListing, userArea(student)).rate,
        status: incoming ? 'accepted' : 'pending',
        createdAt: student.createdAt, respondedAt: incoming ? teacher.createdAt : null,
      };
      bookings[booked.id] = booked;
    }
  }
  state.bookingVersion = 1;
  return bookings;
}
function bookingFor(state: DemoState, studentId: string, teacherId: string): BookingRequest | null {
  const matching = Object.values(ensureBookingState(state))
    .filter(b => b.studentId === studentId && b.teacherId === teacherId);
  return matching.find(b => b.status === 'accepted') ??
    matching.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}
function bookingStatusFor(state: DemoState, studentId: string, teacherId: string): BookingStatus | null {
  return bookingFor(state, studentId, teacherId)?.status ?? null;
}
/** Never expose the student's map location, neighbourhood, home coordinates,
 * public discovery details, or academic profile to the teacher.
 * A short booking-specific identity is sufficient for classroom navigation.
 */
function privateStudentPartner(student: Account): Listing {
  return {
    id: student.id, role: 'student', name: student.name,
    headline: 'Student · active class booking',
    localityId: '', locality: '', location: { lat: 0, lng: 0 },
    subjects: [], grades: [], rate: 0, availability: '',
    description: '', published: false, avatar: 0, color: 'sage',
  };
}

/** Accept only small, plausible PDF metadata in the in-browser pilot.
 * Actual bytes are verified/stored separately in IndexedDB. */
function parseBrowserPdfMetadata(input: unknown): PdfNoteAttachment | null {
  if (!input || typeof input !== 'object') return null;
  const data = input as Record<string, unknown>;
  const id = cleanText(data.id, 40);
  const name = cleanText(data.name, 140);
  const sizeBytes = Number(data.sizeBytes);
  if (!/^[a-f0-9-]{36}$/i.test(id) || !name.toLowerCase().endsWith('.pdf') ||
      !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10 * 1024 * 1024 ||
      data.mimeType !== 'application/pdf') return null;
  return { id, name, sizeBytes, mimeType: 'application/pdf' };
}


const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const roundNeighbourhood = (coordinate: number) => Math.round(coordinate * 100) / 100;
function validHomeArea(value: unknown): HomeArea | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const city = cleanText(input.city, 90);
  const locality = cleanText(input.locality, 100);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 || !city || !locality) return null;
  return { lat: roundNeighbourhood(lat), lng: roundNeighbourhood(lng), city, locality };
}
function legacyArea(localityId: string): HomeArea {
  const locality = catalog.localities.find(area => area.id === localityId) ??
    catalog.localities.find(area => area.id === catalog.defaultLocality)!;
  return { lat: roundNeighbourhood(locality.lat), lng: roundNeighbourhood(locality.lng),
    city: catalog.city.split(',')[0], locality: locality.name };
}
function userArea(account: Pick<Account, 'homeArea' | 'localityId'>): HomeArea {
  return account.homeArea ?? legacyArea(account.localityId);
}
function sameArea(a: HomeArea, b: HomeArea): boolean {
  return a.lat === b.lat && a.lng === b.lng && a.city === b.city && a.locality === b.locality;
}

function allListings(state: DemoState) {
  // All visible profiles are backed by persisted accounts/listings, never render-time fixtures.
  return Object.values(state.own);
}
function enrich(state: DemoState, listing: Listing): Listing {
  const account = state.accounts[listing.id];
  return account ? {
    ...listing, name: account.name, localityId: account.localityId,
    ...(account.homeArea ? {
      locality: account.homeArea.locality + ', ' + account.homeArea.city,
      location: { lat: account.homeArea.lat, lng: account.homeArea.lng },
    } : {}),
    strongSubjects: account.strongSubjects, weakSubjects: account.weakSubjects,
    qualifications: account.qualifications, experience: account.experience,
    teacherVerified: account.role === 'teacher' ? account.teacherVerified !== false : false,
  } : listing;
}
function listingFrom(input: unknown, role: Role, user: Account, state: DemoState): Listing | null {
  if (!input || typeof input !== 'object') return null;
  const data = input as Partial<ListingDraft>;
  const headline = cleanText(data.headline, 90);
  const availability = cleanText(data.availability, 100);
  const description = cleanText(data.description, 700);
  const locality = userArea(user);
  const subjects = validValues(data.subjects, catalog.subjects);
  const grades = validValues(data.grades, catalog.grades);
  const budget = Number(data.rate);
  if (!headline || !availability || !description || !subjects.length || !grades.length ||
    (!Number.isInteger(budget) || budget < (role === 'teacher' ? 100 : 50) || budget > 10000)) return null;
  return {
    id: user.id, role, name: user.name, headline, availability, description,
    localityId: user.localityId, locality: locality.locality + ', ' + locality.city, location: { lat: locality.lat, lng: locality.lng },
    subjects, grades, rate: budget,
    published: data.published === true, avatar: 0, color: role === 'student' ? 'sage' : 'peach',
    strongSubjects: user.strongSubjects, weakSubjects: user.weakSubjects,
    qualifications: user.qualifications, experience: user.experience,
  };
}
function createAccount(input: Record<string, unknown>, role: Role | 'admin') {
  const name = cleanText(input.name, 60);
  const email = cleanText(input.email, 254).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const localityId = cleanText(input.localityId, 60) || catalog.defaultLocality;
  // Legacy seeded accounts may still use one of the old locality IDs.
  const homeArea = input.homeArea === undefined ? undefined : validHomeArea(input.homeArea);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128 ||
      !catalog.localities.some(x => x.id === localityId) || (input.homeArea !== undefined && !homeArea)) return null;
  return { name, email, password, localityId, homeArea, role };
}
function newSession(request: Request, state: DemoState, userId: string) {
  const token = id();
  state.sessions[token] = { userId, expiresAt: Date.now() + 30 * 86400000 };
  return authCookie(request, token);
}
function onlyMatchedRoom(state: DemoState, me: Account, otherId: string) {
  if (!otherId) return null;
  const peer = state.accounts[otherId];
  if (!peer || !peer.active || peer.role === 'admin' || peer.role === me.role) return null;
  if (bookingStatusFor(state,
    me.role === 'student' ? me.id : peer.id,
    me.role === 'teacher' ? me.id : peer.id) !== 'accepted') return null;
  const studentId = me.role === 'student' ? me.id : peer.id;
  const teacherId = me.role === 'teacher' ? me.id : peer.id;
  const key = pairKey(me.id, otherId);
  state.classrooms[key] ??= { studentId, teacherId, sessions: [], notes: [], homework: [] };
  return state.classrooms[key];
}
function publicPartner(state: DemoState, partnerId: string, viewerRole: Role) {
  const member = state.accounts[partnerId];
  if (viewerRole === 'teacher' && member?.role === 'student') return privateStudentPartner(member);
  const listing = state.own[partnerId];
  return listing ? enrich(state, listing) : null;
}
function validDate(value: unknown) {
  const t = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function demoApi(request: Request, state: DemoState, opts: Options = {}): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = request.method;
  if (parts[0] !== 'api' || parts[1] !== 'v1') return fail('Endpoint not found.', 404);
  if (parts.length === 3 && parts[2] === 'catalog' && method === 'GET') return json(catalog);
  ensureBookingState(state);

  if (parts[2] === 'auth' && parts.length === 4) {
    if (parts[3] === 'me' && method === 'GET') {
      const me = sessionUser(request, state, opts.browserSessionToken);
      return me ? json(safeAccount(me)) : fail('Sign in to continue.', 401);
    }
    if (parts[3] === 'signup' && method === 'POST') {
      const data = await request.json().catch(() => null) as Record<string, unknown> | null;
      const role = cleanText(data?.role, 16);
      if (!isRole(role)) return fail('Choose a student or teacher account.');
      const entry = createAccount(data ?? {}, role);
      if (!entry) return fail('Enter your name, valid email, neighbourhood and a password of 10–128 characters.');
      if (Object.values(state.accounts).some(account => account.email === entry.email)) return fail('An account with this email already exists.', 409);
      const salt = id();
      const account: Account = {
        id: id(), email: entry.email, name: entry.name, role, localityId: entry.localityId,
        ...(entry.homeArea ? { homeArea: entry.homeArea, homeChangedAt: new Date().toISOString() } : {}),
        bio: '', strongSubjects: [], weakSubjects: [], qualifications: '', experience: '',
        requestedRate: null, approvedRate: null, rateStatus: 'none', active: true,
        teacherVerified: false,
        createdAt: new Date().toISOString(), salt, passwordHash: await hashPassword(entry.password, salt),
      };
      state.accounts[account.id] = account;
      return json(safeAccount(account), 201, { 'Set-Cookie': newSession(request, state, account.id) });
    }
    if (parts[3] === 'login' && method === 'POST') {
      const data = await request.json().catch(() => null) as { email?: string; password?: string } | null;
      const email = cleanText(data?.email, 254).toLowerCase();
      const password = typeof data?.password === 'string' ? data.password : '';
      const attempts = state.attempts[email];
      if (attempts && attempts.until > Date.now() && attempts.count >= 7) return fail('Too many attempts. Try again in 15 minutes.', 429);
      const account = Object.values(state.accounts).find(x => x.email === email);
      const computed = account ? await hashPassword(password, account.salt) : '';
      if (!account || !account.active || !constantTimeEqual(computed, account.passwordHash)) {
        const count = attempts && attempts.until > Date.now() ? attempts.count + 1 : 1;
        state.attempts[email] = { count, until: Date.now() + 15 * 60_000 };
        return fail('Invalid email or password.', 401);
      }
      delete state.attempts[email];
      return json(safeAccount(account), 200, { 'Set-Cookie': newSession(request, state, account.id) });
    }
    if (parts[3] === 'logout' && method === 'POST') {
      delete state.sessions[readToken(request, opts.browserSessionToken)];
      return json({ ok: true }, 200, { 'Set-Cookie': expiredCookie(request) });
    }
  }

  if (parts[2] === 'admin' && parts[3] === 'bootstrap' && method === 'POST') {
    if (!opts.adminBootstrapToken || opts.adminBootstrapToken.length < 24) return fail('Admin setup is not configured on the server.', 503);
    if (Object.values(state.accounts).some(account => account.role === 'admin')) return fail('An administrator already exists.', 409);
    const data = await request.json().catch(() => null) as Record<string, unknown> | null;
    const token = cleanText(data?.setupToken, 300);
    if (!constantTimeEqual(token, opts.adminBootstrapToken)) return fail('Incorrect setup key.', 403);
    const entry = createAccount(data ?? {}, 'admin');
    if (!entry) return fail('Enter an admin name, email, location and a password of at least 10 characters.');
    if (Object.values(state.accounts).some(account => account.email === entry.email)) return fail('Email already registered.', 409);
    const salt = id();
    const account: Account = {
      id: id(), email: entry.email, name: entry.name, role: 'admin', localityId: entry.localityId,
      bio: '', strongSubjects: [], weakSubjects: [], qualifications: '', experience: '',
      requestedRate: null, approvedRate: null, rateStatus: 'none', active: true,
      createdAt: new Date().toISOString(), salt, passwordHash: await hashPassword(entry.password, salt),
    };
    state.accounts[account.id] = account;
    return json(safeAccount(account), 201, { 'Set-Cookie': newSession(request, state, account.id) });
  }

  const me = sessionUser(request, state, opts.browserSessionToken);
  if (!me) return fail('Sign in to continue.', 401);

  if (parts[2] === 'admin') {
    if (me.role !== 'admin' && me.role !== 'owner') return fail('Administrator access only.', 403);
    if (parts.length === 3 && method === 'GET') {
      const matches = new Set(Object.values(ensureBookingState(state))
        .filter(b => b.status === 'accepted').map(b => pairKey(b.studentId, b.teacherId)));
      const response: AdminSnapshot = {
        accounts: Object.values(state.accounts).map(safeAccount),
        settings: state.pricing,
        publishedListings: Object.values(state.own).filter(x => x.published).length,
        matchedPairs: matches.size,
        pendingRates: Object.values(state.accounts).filter(x => x.rateStatus === 'pending').length,
        pendingVerifications: Object.values(state.accounts).filter(x => x.role === 'teacher' && x.teacherVerified === false).length,
        viewerRole: me.role === 'owner' ? 'owner' : 'admin',
      };
      return json(response);
    }
    if (parts[3] === 'pricing' && parts.length === 4 && method === 'PUT') {
      const data = await request.json().catch(() => null) as Partial<PriceSettings> | null;
      if (!data || !Object.keys(initialPricing).every(key => Object.prototype.hasOwnProperty.call(data, key))) return fail('Enter all pricing rules.');
      const next = data as PriceSettings;
      if (!Number.isInteger(next.baseRate) || next.baseRate < 100 || next.baseRate > 10000 ||
        !Number.isFinite(next.freeRadiusKm) || next.freeRadiusKm < 0 || next.freeRadiusKm > 30 ||
        !Number.isFinite(next.distanceStepKm) || next.distanceStepKm <= 0 || next.distanceStepKm > 25 ||
        !Number.isInteger(next.stepFee) || next.stepFee < 0 || next.stepFee > 2000 ||
        !Number.isInteger(next.maxTravelFee) || next.maxTravelFee < 0 || next.maxTravelFee > 5000) return fail('Check the pricing values.');
      state.pricing = { ...next };
      return json(state.pricing);
    }
    if (parts[3] === 'accounts' && parts[4] && parts.length === 6 && method === 'PUT') {
      const target = state.accounts[parts[4]];
      const data = await request.json().catch(() => null) as { action?: string } | null;
      if (!target || target.role === 'admin' || target.role === 'owner') return fail('You cannot change a staff member or unknown account.', 403);
      if (parts[5] === 'status' && (data?.action === 'suspend' || data?.action === 'activate')) {
        target.active = data.action === 'activate';
        if (!target.active) for (const [token, session] of Object.entries(state.sessions))
          if (session.userId === target.id) delete state.sessions[token];
        return json(safeAccount(target));
      }
      if (parts[5] === 'listing' && data?.action === 'hide') {
        if (!state.own[target.id]) return fail('This account has no listing.', 404);
        state.own[target.id].published = false;
        return json(safeAccount(target));
      }
      if (parts[5] === 'verification' && target.role === 'teacher' && (data?.action === 'verify' || data?.action === 'unverify')) {
        target.teacherVerified = data.action === 'verify';
        return json(safeAccount(target));
      }
      if (parts[5] === 'rate' && target.role === 'teacher' && (data?.action === 'approve' || data?.action === 'reject')) {
        if (target.rateStatus !== 'pending' || target.requestedRate === null) return fail('No pending price request.', 409);
        if (data.action === 'approve') target.approvedRate = target.requestedRate;
        target.rateStatus = data.action === 'approve' ? 'approved' : 'rejected';
        if (state.own[target.id]) state.own[target.id].rate = target.approvedRate ?? state.pricing.baseRate;
        return json(safeAccount(target));
      }
      return fail('Unsupported admin action.');
    }
    return fail('Admin endpoint not found.', 404);
  }

  if (parts[2] === 'profile' && parts.length === 3 && method === 'PUT') {
    const data = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!data || typeof data !== 'object') return fail('Invalid profile.');
    const name = cleanText(data.name, 60);
    const localityId = cleanText(data.localityId, 60) || me.localityId;
    if (!name || !catalog.localities.some(x => x.id === localityId)) return fail('Choose a name and home location.');
    if (localityId !== me.localityId)
      return fail('Home location must be updated using the map marker, not the old neighbourhood selector.');
    const wantsNewArea = data.homeArea !== undefined;
    const newArea = wantsNewArea ? validHomeArea(data.homeArea) : null;
    if (wantsNewArea && !newArea) return fail('Place a marker and provide a valid city and locality.');
    if (newArea && !sameArea(newArea, userArea(me))) {
      const last = me.homeChangedAt ? Date.parse(me.homeChangedAt) : NaN;
      if (Number.isFinite(last) && Date.now() - last < THIRTY_DAYS_MS) {
        const next = new Date(last + THIRTY_DAYS_MS).toISOString().slice(0, 10);
        return fail('You can change your home area once every 30 days. Next change: ' + next + '.', 429);
      }
      me.homeArea = newArea;
      me.homeChangedAt = new Date().toISOString();
    } else if (newArea && !me.homeArea) {
      me.homeArea = newArea;
      me.homeChangedAt = new Date().toISOString();
    }
    me.name = name;
    // A legacy locality key remains for compatibility with older demo metadata.
    me.localityId = localityId;
    me.bio = cleanText(data.bio, 700);
    me.qualifications = me.role === 'teacher' ? cleanText(data.qualifications, 180) : '';
    me.experience = me.role === 'teacher' ? cleanText(data.experience, 180) : '';
    me.strongSubjects = me.role === 'student' ? validValues(data.strongSubjects, catalog.subjects) : [];
    me.weakSubjects = me.role === 'student' ? validValues(data.weakSubjects, catalog.subjects) : [];
    if (state.own[me.id]) {
      const location = userArea(me);
      Object.assign(state.own[me.id], { name: me.name, localityId,
        locality: location.locality + ', ' + location.city,
        location: { lat: location.lat, lng: location.lng } });
    }
    return json(safeAccount(me));
  }
  if (parts[2] === 'profile' && parts[3] === 'request-rate' && parts.length === 4 && method === 'POST') {
    if (me.role !== 'teacher') return fail('Only tutors can request a rate change.', 403);
    const body = await request.json().catch(() => null) as { rate?: number } | null;
    const rate = body?.rate;
    if (!Number.isInteger(rate) || rate! < 100 || rate! > 10000) return fail('Enter a proposed rate between ₹100 and ₹10,000.');
    me.requestedRate = rate!;
    me.rateStatus = 'pending';
    return json(safeAccount(me));
  }

  const role = parts[3];
  if (parts[2] !== 'workspaces' || !isRole(role) || me.role !== role) return fail('Access to this workspace is not permitted.', 403);
  const [, , , , resource, targetId, action, resourceId] = parts;
  const otherRole = opposite(role);
  const others = allListings(state).filter(listing =>
    listing.role === otherRole && (!state.accounts[listing.id] || state.accounts[listing.id].active));
  const myId = me.id;
  const userLocality = userArea(me);

  if (parts.length === 5 && resource === 'listing') {
    if (method === 'GET') return json(state.own[myId] ? enrich(state, state.own[myId]) : null);
    if (method === 'PUT') {
      const listing = listingFrom(await request.json().catch(() => null), role, me, state);
      if (!listing) return fail('Complete your title, subjects, class levels, availability and description.');
      state.own[myId] = listing;
      return json(enrich(state, listing));
    }
  }
  if (parts.length === 5 && resource === 'discovery' && method === 'GET') {
    if (role === 'teacher') return fail('Student discovery is not available to teachers.', 403);
    const params = url.searchParams;
    const origin = catalog.localities.find(area => area.id === params.get('locality')) ?? userLocality;
    const query = (params.get('query') ?? '').toLowerCase().trim().slice(0, 140);
    const radius = Number(params.get('radius')) || Infinity;
    const maxRate = Number(params.get('maxRate')) || Infinity;
    const subject = params.get('subject');
    const grade = params.get('grade');
    const published = others.filter(item => item.published && state.accounts[item.id]?.teacherVerified !== false);
    const listings: DiscoveryListing[] = published.map(item => {
      const distance = distanceKm(origin, item.location);
      const pricing = role === 'student' ? quote(state, item, userLocality) : null;
      return {
        ...enrich(state, item),
        distance, saved: state.saves[myId]?.includes(item.id) ?? false,
        connection: bookingStatusFor(state, myId, item.id),
        ...(pricing ? { rate: pricing.rate, baseRate: pricing.baseRate, travelFee: pricing.travelFee } : {}),
      };
    }).filter(item =>
      (!subject || item.subjects.includes(subject)) && (!grade || item.grades.includes(grade)) &&
      item.rate <= maxRate && item.distance <= radius && (params.get('saved') !== 'true' || item.saved) &&
      (!query || [item.name, item.headline, item.locality, ...item.subjects, ...(item.weakSubjects ?? [])]
        .some(value => value.toLowerCase().includes(query)))
    );
    listings.sort((a, b) => params.get('sort') === 'rate'
      ? a.rate - b.rate || a.distance - b.distance : a.distance - b.distance);
    return json({ listings, origin: { lat: origin.lat, lng: origin.lng }, total: published.length });
  }
  if (parts.length === 5 && resource === 'bookings' && method === 'GET') {
    const own = Object.values(ensureBookingState(state)).filter(booking =>
      role === 'teacher' ? booking.teacherId === myId : booking.studentId === myId);
    return json(own.map(booking => ({
      ...booking,
      studentName: state.accounts[booking.studentId]?.name ?? booking.studentName,
      teacherName: state.accounts[booking.teacherId]?.name ?? booking.teacherName,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  if (parts.length === 5 && resource === 'bookings' && method === 'POST') {
    if (role !== 'student') return fail('Only students can request classes.', 403);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const teacherId = cleanText(body?.teacherId, 80);
    const teacher = state.accounts[teacherId];
    const listing = state.own[teacherId];
    if (!teacher || !teacher.active || teacher.role !== 'teacher' || teacher.teacherVerified === false || !listing?.published)
      return fail('This tutor is not available for booking.', 404);
    const subject = cleanText(body?.subject, 80);
    const grade = cleanText(body?.grade, 80);
    const note = cleanText(body?.note, 600);
    const startsAt = validDate(body?.startsAt);
    const durationMinutes = Number(body?.durationMinutes);
    if (!listing.subjects.includes(subject) || !listing.grades.includes(grade) ||
      !startsAt || Date.parse(startsAt) < Date.now() + 15 * 60000 ||
      !Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 180)
      return fail('Choose a subject, class level, future time and duration (30–180 minutes).');
    if (Object.values(ensureBookingState(state)).some(b => b.studentId === myId &&
      b.teacherId === teacherId && (b.status === 'pending' || b.status === 'accepted')))
      return fail('You already have a pending or accepted booking with this tutor.', 409);
    const booking: BookingRequest = {
      id: id(), teacherId, studentId: myId,
      teacherName: teacher.name, studentName: me.name,
      subject, grade, startsAt, durationMinutes, note,
      quotedRate: quote(state, listing, userLocality).rate,
      status: 'pending', createdAt: new Date().toISOString(), respondedAt: null,
    };
    ensureBookingState(state)[booking.id] = booking;
    return json(booking, 201);
  }
  if (parts.length === 6 && resource === 'bookings' && method === 'PUT') {
    if (role !== 'teacher') return fail('Only teachers can respond to booking requests.', 403);
    const booking = ensureBookingState(state)[targetId];
    if (!booking || booking.teacherId !== myId) return fail('Booking request not found.', 404);
    const body = await request.json().catch(() => null) as { decision?: string } | null;
    if (body?.decision !== 'accept' && body?.decision !== 'reject')
      return fail('Choose accept or reject.');
    if (booking.status !== 'pending') return fail('This booking has already been decided.', 409);
    if (!state.accounts[booking.studentId]?.active) return fail('Student account is unavailable.', 409);
    if (body.decision === 'accept') {
      booking.status = 'accepted';
      const key = pairKey(booking.studentId, booking.teacherId);
      const room = state.classrooms[key] ??= {
        studentId: booking.studentId, teacherId: booking.teacherId,
        sessions: [], notes: [], homework: [],
      };
      room.sessions.push({
        id: id(), title: booking.subject + ' · First class',
        startsAt: booking.startsAt, durationMinutes: booking.durationMinutes,
        status: 'scheduled', createdAt: new Date().toISOString(),
      });
    } else booking.status = 'rejected';
    booking.respondedAt = new Date().toISOString();
    return json(booking);
  }
  if (parts.length === 5 && resource === 'connections' && method === 'GET')
    return fail('Mutual interest has been replaced by class bookings.', 410);
  if (parts.length === 5 && resource === 'classrooms' && method === 'GET') {
    const summaries: ClassroomSummary[] = Object.values(ensureBookingState(state))
      .filter(b => b.status === 'accepted' &&
        (role === 'teacher' ? b.teacherId === myId : b.studentId === myId))
      .map(booking => {
        const partnerId = role === 'teacher' ? booking.studentId : booking.teacherId;
        const room = onlyMatchedRoom(state, me, partnerId);
        const partner = publicPartner(state, partnerId, role);
        return room && partner ? { partner, classroom: room } : null;
      }).filter((value): value is ClassroomSummary => !!value);
    return json(summaries);
  }

  const target = role === 'teacher' && resource === 'connections'
    ? (bookingStatusFor(state, targetId ?? '', myId) === 'accepted'
        ? state.own[targetId] ?? privateStudentPartner(state.accounts[targetId]) : undefined)
    : others.find(item => item.id === targetId);
  if (parts.length === 7 && resource === 'listings' && target?.published) {
    if (role === 'teacher') return fail('Teachers cannot browse or save student profiles.', 403);
    if (action === 'save' && method === 'PUT') {
      const data = await request.json().catch(() => null) as { saved?: boolean } | null;
      if (typeof data?.saved !== 'boolean') return fail('Choose whether to save this profile.');
      const saved = new Set(state.saves[myId] ?? []);
      if (data.saved) saved.add(target.id);
      else saved.delete(target.id);
      state.saves[myId] = [...saved];
      return json({ saved: data.saved });
    }
    if (action === 'interest' && method === 'PUT')
      return fail('Mutual interest is no longer available. Request a class instead.', 410);
  }
  if (resource === 'connections' && target) {
    const room = onlyMatchedRoom(state, me, target.id);
    if (!room) return fail('Classes and messaging open after a teacher accepts the booking.', 403);
    if (parts.length === 7 && action === 'messages') {
      const key = pairKey(myId, target.id);
      const messages = state.messages[key] ?? [];
      if (method === 'GET') return json(messages);
      if (method === 'POST') {
        const data = await request.json().catch(() => null) as { body?: string; id?: string } | null;
        const body = cleanText(data?.body, 500);
        const messageId = cleanText(data?.id, 60);
        if (!body || !messageId) return fail('Enter a message.');
        const duplicate = messages.find(message => message.id === messageId && message.authorId === myId);
        if (duplicate) return json(duplicate);
        const message: Message = { id: messageId, body, authorId: myId, sentAt: new Date().toISOString() };
        state.messages[key] = [...messages.slice(-199), message];
        return json(message, 201);
      }
    }
    if (parts.length === 7 && action === 'classroom' && method === 'GET') return json(room);
    if (parts.length === 8 && action === 'classroom' && method === 'POST' && role === 'teacher') {
      const data = await request.json().catch(() => null) as Record<string, unknown> | null;
      if (resourceId === 'sessions') {
        const title = cleanText(data?.title, 90);
        const startsAt = validDate(data?.startsAt);
        const durationMinutes = Number(data?.durationMinutes);
        if (!title || !startsAt || Date.parse(startsAt) < Date.now() - 5 * 60000 ||
          !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) return fail('Enter a future class time and a duration from 15 to 240 minutes.');
        const session: ClassSession = { id: id(), title, startsAt, durationMinutes, status: 'scheduled', createdAt: new Date().toISOString() };
        room.sessions.push(session);
        return json(session, 201);
      }
      if (resourceId === 'notes') {
        const title = cleanText(data?.title, 100);
        const content = cleanText(data?.content, 8000);
        let pdf: PdfNoteAttachment | undefined;
        if (data?.pdf !== undefined) {
          // Never accept a blob identifier from a remote client in API mode.
          // The browser demo stores the actual bytes in same-origin IndexedDB.
          if (!opts.browserSessionToken) return fail('PDF notes require an integrated file storage service.', 501);
          pdf = parseBrowserPdfMetadata(data.pdf) ?? undefined;
          if (!pdf) return fail('Choose a valid PDF document under 10 MB.');
        }
        if (!title || (!content && !pdf)) return fail('Add a title and note content or PDF.');
        const note: LessonNote = { id: id(), title, content, createdAt: new Date().toISOString(), ...(pdf ? { pdf } : {}) };
        room.notes.push(note);
        return json(note, 201);
      }
      if (resourceId === 'homework') {
        const title = cleanText(data?.title, 100);
        const instructions = cleanText(data?.instructions, 3000);
        const dueAt = validDate(data?.dueAt);
        let assignmentPdf: PdfNoteAttachment | undefined;
        if (data?.pdf !== undefined) {
          if (!opts.browserSessionToken) return fail('PDF homework requires an integrated file storage service.', 501);
          assignmentPdf = parseBrowserPdfMetadata(data.pdf) ?? undefined;
          if (!assignmentPdf) return fail('Choose a valid PDF document under 10 MB.');
        }
        if (!title || (!instructions && !assignmentPdf) || !dueAt)
          return fail('Add a homework title, instructions or a PDF worksheet, and a valid deadline.');
        const homework: Homework = {
          id: id(), title, instructions, dueAt, createdAt: new Date().toISOString(),
          ...(assignmentPdf ? { assignmentPdf } : {}),
          submission: '', submittedAt: null, review: '', reviewedAt: null,
        };
        room.homework.push(homework);
        return json(homework, 201);
      }
    }
    if (parts.length === 9 && action === 'classroom' && method === 'PUT') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      const subject = room.homework.find(item => item.id === parts[8]);
      if (resourceId === 'homework' && subject && parts[9] === undefined) return fail('Specify a homework action.', 400);
    }
    if (parts.length === 10 && action === 'classroom' && method === 'PUT') {
      const itemId = parts[8], verb = parts[9];
      const data = await request.json().catch(() => null) as Record<string, unknown> | null;
      if (resourceId === 'sessions' && verb === 'status' && role === 'teacher') {
        const session = room.sessions.find(item => item.id === itemId);
        if (!session || (data?.status !== 'completed' && data?.status !== 'cancelled')) return fail('Select a scheduled class and a valid status.');
        session.status = data.status;
        return json(session);
      }
      if (resourceId === 'homework') {
        const homework = room.homework.find(item => item.id === itemId);
        if (!homework) return fail('Homework not found.', 404);
        if (verb === 'submit' && role === 'student') {
          if (homework.reviewedAt) return fail('Reviewed homework cannot be changed.', 409);
          const submission = cleanText(data?.submission, 8000);
          let submissionPdf = homework.submissionPdf;
          if (data?.pdf !== undefined) {
            if (!opts.browserSessionToken) return fail('PDF homework requires an integrated file storage service.', 501);
            submissionPdf = parseBrowserPdfMetadata(data.pdf) ?? undefined;
            if (!submissionPdf) return fail('Choose a valid PDF document under 10 MB.');
          }
          if (data?.removePdf === true) submissionPdf = undefined;
          if (!submission && !submissionPdf) return fail('Write a response or upload a PDF answer sheet.');
          homework.submission = submission;
          if (submissionPdf) homework.submissionPdf = submissionPdf;
          else delete homework.submissionPdf;
          homework.submittedAt = new Date().toISOString();
          homework.review = '';
          homework.reviewedAt = null;
          return json(homework);
        }
        if (verb === 'review' && role === 'teacher' && homework.submittedAt) {
          const review = cleanText(data?.review, 4000);
          if (!review) return fail('Write feedback before submitting your review.');
          homework.review = review;
          homework.reviewedAt = new Date().toISOString();
          return json(homework);
        }
      }
    }
  }
  return fail('This endpoint or profile could not be found.', 404);
}

export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
