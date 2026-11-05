/**
 * Browser-only pilot datastore.
 *
 * Runs the SAME domain/API handlers used by the Worker, but calls them in-process
 * and saves the resulting JSON state in localStorage. It NEVER contacts /api/v1.
 *
 * This is deliberately not production authentication: browser storage and demo
 * credentials are controlled by the local user, and separate devices do not sync.
 * Switching VITE_SERVICE_MODE=api restores the existing remote API path.
 */
import type { DemoState } from '../../demo/api';
import { demoApi, initialState } from '../../demo/api';
import { catalog } from '../../demo/seed';
import { seedListings } from '../../demo/fixtures';
import { addHistoricalActivity, historyProfiles } from '../../demo/history';
import type { HomeArea, PublicAccount, Role } from '../../shared/domain';
import { demoAccounts, DEMO_PASSWORD } from '../demoAccounts';

const STATE_KEY = 'shikshak.browser-pilot.v1';
const SESSION_KEY = 'shikshak.browser-pilot.session.v1';
const ADMIN_SEED_KEY = 'shikshak-local-demo-bootstrap-for-testing-only';
const FIXTURE_VERSION = 2;
const HISTORY_VERSION = 1;

type DemoInput = {
  name: string;
  email: string;
  role: Role;
  localityId: string;
  headline: string;
  subjects: string[];
  grades: string[];
  description: string;
  availability: string;
  rate: number;
  bio: string;
  strongSubjects?: string[];
  weakSubjects?: string[];
  qualifications?: string;
  experience?: string;
};

const sampleAccounts: DemoInput[] = [
  {
    ...demoAccounts.student, role: 'student', localityId: 'rajgarh',
    headline: 'Class 10 maths and science support',
    subjects: ['Mathematics', 'Physics'], grades: ['Classes 9–10'],
    description: 'Preparing for board examinations. Looking for clear explanations and consistent maths practice.',
    availability: 'After school, Monday to Thursday', rate: 650,
    bio: 'I enjoy reading and science projects. I am working on algebra and physics fundamentals.',
    strongSubjects: ['English', 'Biology'], weakSubjects: ['Mathematics', 'Physics'],
  },
  {
    ...demoAccounts.teacher, role: 'teacher', localityId: 'chandmari',
    headline: 'Mathematics and Physics for secondary school',
    subjects: ['Mathematics', 'Physics'], grades: ['Classes 9–10', 'Classes 11–12'],
    description: 'Structured maths and physics tuition with worked examples, weekly revision and individual feedback.',
    availability: 'Evenings and weekends', rate: 400,
    bio: 'I help learners feel comfortable with challenging concepts and build practical problem-solving skills.',
    qualifications: 'BSc Physics', experience: '4 years of tutoring',
  },
  {
    name: 'Meghna Hazarika', email: 'meghna@shikshak.demo', role: 'teacher', localityId: 'beltola',
    headline: 'Biology, Chemistry and Science tutor',
    subjects: ['Biology', 'Chemistry', 'Science'], grades: ['Classes 6–8', 'Classes 9–10', 'Classes 11–12'],
    description: 'Visual biology lessons, revision notes and targeted science homework.',
    availability: 'Weekday evenings', rate: 400,
    bio: 'I enjoy making science understandable through diagrams and short exercises.',
    qualifications: 'MSc Zoology', experience: '2 years of private teaching',
  },
  {
    name: 'Rohan Saikia', email: 'rohan@shikshak.demo', role: 'student', localityId: 'dispur',
    headline: 'Science and Chemistry support',
    subjects: ['Science', 'Chemistry'], grades: ['Classes 9–10'],
    description: 'Looking for help with chemistry equations and structured science revision.',
    availability: 'Weekends', rate: 550,
    bio: 'Interested in technology and geography.',
    strongSubjects: ['Computer Science', 'English'], weakSubjects: ['Science', 'Chemistry'],
  },
];

// Synthetic HTTPS URL only. No network request takes place.
function url(path: string) {
  return 'https://shikshak.local.invalid/api/v1' + path;
}

async function invoke(
  state: DemoState,
  path: string,
  method: string = 'GET',
  body?: unknown,
  trustedSession?: string,
): Promise<Response> {
  const request = new Request(url(path), {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return demoApi(request, state, {
    browserSessionToken: trustedSession,
    adminBootstrapToken: ADMIN_SEED_KEY,
  });
}

async function checked(
  state: DemoState,
  path: string,
  method: string,
  body: unknown,
  token?: string,
): Promise<unknown> {
  const response = await invoke(state, path, method, body, token);
  const payload = await response.json() as { message?: string };
  if (!response.ok) throw new Error('Demo sample setup failed: ' + path + ' — ' + (payload.message || response.status));
  return payload;
}

function sessionFor(state: DemoState, account: PublicAccount): string {
  const entry = Object.entries(state.sessions)
    .find(([, session]) => session.userId === account.id && session.expiresAt > Date.now());
  if (!entry) throw new Error('Demo session could not be created.');
  return entry[0];
}

function future(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}


/**
 * Convert the former preview cards into complete demo accounts/listings.
 * Uses the legacy listing IDs, so existing saved profiles still refer to the
 * same people. All future edits and interactions operate on browser state.
 * The fixture templates only run once for each browser's existing data.
 */
async function ensureDemoFixtureAccounts(state: DemoState): Promise<boolean> {
  const demo = state as DemoState & { fixtureVersion?: number };
  if (demo.fixtureVersion === FIXTURE_VERSION) return false;
  for (const listing of seedListings) {
    if (state.accounts[listing.id]) continue;
    const email = 'sample-' + listing.id + '@shikshak.demo';
    const existing = Object.values(state.accounts).find(account => account.email === email);
    if (existing) continue;
    const created = await checked(state, '/auth/signup', 'POST', {
      name: listing.name, email, role: listing.role,
      password: DEMO_PASSWORD, localityId: listing.localityId,
    }) as PublicAccount;
    // Keep legacy IDs to preserve any bookmarks created before this migration.
    const account = state.accounts[created.id];
    delete state.accounts[created.id];
    account.id = listing.id;
    state.accounts[listing.id] = account;
    const token = sessionFor(state, created);
    state.sessions[token].userId = listing.id;
    await checked(state, '/profile', 'PUT', {
      name: listing.name, localityId: listing.localityId,
      bio: listing.description.slice(0, 700),
      strongSubjects: listing.role === 'student' ? [] : [],
      weakSubjects: listing.role === 'student' ? listing.subjects : [],
      qualifications: '', experience: '',
    }, token);
    const live = await checked(state, '/workspaces/' + listing.role + '/listing', 'PUT', {
      name: listing.name,
      headline: listing.headline,
      localityId: listing.localityId,
      subjects: listing.subjects,
      grades: listing.grades,
      rate: listing.role === 'student' ? listing.rate : state.pricing.baseRate,
      availability: listing.availability,
      description: listing.description,
      published: true,
    }, token) as { id: string };
    // The server-owned listing can reuse the avatar and colour from the
    // original visual sample while staying fully editable in local state.
    if (live.id === listing.id && state.own[listing.id]) {
      state.own[listing.id].avatar = listing.avatar;
      state.own[listing.id].color = listing.color;
    }
    delete state.sessions[token];
  }
  demo.fixtureVersion = FIXTURE_VERSION;
  return true;
}

/**
 * Upgrade the existing demo in place with five months of richer, fictional
 * activity. This is deliberately separate from the original preview migration
 * so browsers that already have matches/classes receive history without reset.
 */
async function ensureDemoHistory(state: DemoState): Promise<boolean> {
  const demo = state as DemoState & { historyVersion?: number };
  if (demo.historyVersion === HISTORY_VERSION) return false;

  for (const [index, sample] of historyProfiles.entries()) {
    if (state.accounts[sample.id]) continue;
    // Never overwrite user-created accounts, even if somebody happened to use
    // a similar display name or a sample email in their browser.
    if (Object.values(state.accounts).some(account => account.email === sample.email)) continue;

    const created = await checked(state, '/auth/signup', 'POST', {
      name: sample.name, email: sample.email,
      password: DEMO_PASSWORD, role: sample.role, localityId: sample.localityId,
    }) as PublicAccount;
    const token = sessionFor(state, created);
    const account = state.accounts[created.id];
    delete state.accounts[created.id];
    account.id = sample.id;
    // Account age varies from early summer through autumn.
    account.createdAt = new Date(Date.now() - (45 + (index * 17) % 110) * 86400000).toISOString();
    state.accounts[sample.id] = account;
    state.sessions[token].userId = sample.id;

    await checked(state, '/profile', 'PUT', {
      name: sample.name, localityId: sample.localityId, bio: sample.bio,
      strongSubjects: sample.strongSubjects, weakSubjects: sample.weakSubjects,
      qualifications: sample.qualifications, experience: sample.experience,
    }, token);
    await checked(state, '/workspaces/' + sample.role + '/listing', 'PUT', {
      name: sample.name, headline: sample.headline,
      localityId: sample.localityId, subjects: sample.subjects,
      grades: sample.grades, rate: sample.budget,
      availability: sample.availability, description: sample.description, published: true,
    }, token);

    if (state.own[sample.id]) {
      state.own[sample.id].avatar = (index % 8) + 1;
      state.own[sample.id].color = ['sage', 'lilac', 'peach', 'blue'][index % 4];
    }
    delete state.sessions[token];
  }

  // Newly generated activity stays inside the normal account/relationship
  // store and respects existing one-way interests and user-written records.
  addHistoricalActivity(state);

  // Only update ages for official fictional fixtures, never real user-created
  // browser accounts or their profile details.
  for (const [index, listing] of seedListings.entries()) {
    const account = state.accounts[listing.id];
    if (account) {
      account.createdAt = new Date(Date.now() - (60 + (index * 13) % 95) * 86400000).toISOString();
    }
  }

  demo.historyVersion = HISTORY_VERSION;
  return true;
}


/** Existing browser-local accounts and classroom history survive the switch
 * from reciprocal interest to direct requests. Run this after the old history
 * fixture has finished writing any legacy interest records. */
async function prepareDemoBookings(state: DemoState): Promise<boolean> {
  const version = state as DemoState & { bookingSampleVersion?: number };
  if (version.bookingSampleVersion === 1) return false;
  if (state.bookingVersion !== 1) {
    // Any authenticated API call triggers the one-time legacy match migration.
    await invoke(state, '/auth/me', 'GET');
  }
  state.bookings ??= {};
  const teacher = Object.values(state.accounts).find(account => account.email === demoAccounts.teacher.email);
  const students = Object.values(state.accounts).filter(account =>
    account.role === 'student' && account.email.startsWith('months-student-'));
  if (teacher) {
    const existingPairs = new Set(Object.values(state.bookings)
      .filter(booking => booking.status !== 'rejected' && booking.teacherId === teacher.id)
      .map(booking => booking.studentId));
    let made = 0;
    for (const student of students) {
      if (existingPairs.has(student.id)) continue;
      const status = made < 3 ? 'pending' : 'rejected';
      state.bookings['historical-request-' + made + '-' + teacher.id] = {
        id: 'historical-request-' + made + '-' + teacher.id,
        teacherId: teacher.id, studentId: student.id,
        studentName: student.name, teacherName: teacher.name,
        subject: 'Mathematics', grade: 'Classes 9–10',
        startsAt: future(3 + made), durationMinutes: 60,
        note: ['I would like a regular maths lesson after school.',
          'Could you help me prepare for the next test?',
          'Looking for practical help with algebra.',
          'Requesting a weekend maths session.'][made],
        quotedRate: state.pricing.baseRate, status,
        createdAt: new Date(Date.now() - (made + 1) * 86400000).toISOString(),
        respondedAt: status === 'rejected' ? new Date().toISOString() : null,
      };
      made++;
      if (made === 4) break;
    }
  }
  version.bookingSampleVersion = 1;
  return true;
}

async function seedBrowserDemo(): Promise<DemoState> {
  const state = initialState();
  const members: { account: PublicAccount; token: string; role: Role }[] = [];

  for (const sample of sampleAccounts) {
    const account = await checked(state, '/auth/signup', 'POST', {
      name: sample.name, email: sample.email, password: DEMO_PASSWORD,
      localityId: sample.localityId, role: sample.role,
    }) as PublicAccount;
    const token = sessionFor(state, account);
    members.push({ account, token, role: sample.role });

    await checked(state, '/profile', 'PUT', {
      name: sample.name, localityId: sample.localityId,
      bio: sample.bio,
      strongSubjects: sample.strongSubjects ?? [],
      weakSubjects: sample.weakSubjects ?? [],
      qualifications: sample.qualifications ?? '',
      experience: sample.experience ?? '',
    }, token);
    await checked(state, '/workspaces/' + sample.role + '/listing', 'PUT', {
      name: sample.name, headline: sample.headline, localityId: sample.localityId,
      subjects: sample.subjects, grades: sample.grades,
      rate: sample.rate, availability: sample.availability,
      description: sample.description, published: true,
    }, token);
  }

  const admin = await checked(state, '/admin/bootstrap', 'POST', {
    name: demoAccounts.admin.name, email: demoAccounts.admin.email,
    password: DEMO_PASSWORD, localityId: 'rajgarh', setupToken: ADMIN_SEED_KEY,
  }) as PublicAccount;
  const adminToken = sessionFor(state, admin);

  const student = members[0];
  const teacher = members[1];
  const otherTeacher = members[2];

  // One sample tutor has a pending custom base rate for testing approvals.
  await checked(state, '/profile/request-rate', 'POST', { rate: 675 }, otherTeacher.token);

  // Seed an accepted first-class request; subsequent activities share the classroom.
  const initialBooking = await checked(state, '/workspaces/student/bookings', 'POST', {
    teacherId: teacher.account.id, subject: 'Mathematics', grade: 'Classes 9–10',
    startsAt: future(1), durationMinutes: 60,
    note: 'I would like help with algebra and the upcoming assessment.',
  }, student.token) as { id: string };
  await checked(state, '/workspaces/teacher/bookings/' + initialBooking.id, 'PUT', {
    decision: 'accept',
  }, teacher.token);

  const teacherRoom = '/workspaces/teacher/connections/' + student.account.id + '/classroom';
  const studentRoom = '/workspaces/student/connections/' + teacher.account.id + '/classroom';
  await checked(state, teacherRoom + '/sessions', 'POST', {
    title: 'Algebra revision', startsAt: future(1), durationMinutes: 60,
  }, teacher.token);
  await checked(state, teacherRoom + '/sessions', 'POST', {
    title: 'Motion and forces', startsAt: future(3), durationMinutes: 75,
  }, teacher.token);
  await checked(state, teacherRoom + '/notes', 'POST', {
    title: 'Linear equations — quick guide',
    content: 'Collect like terms, isolate the variable, then substitute to check your answer. Try 2x + 5 = 17.',
  }, teacher.token);
  await checked(state, teacherRoom + '/notes', 'POST', {
    title: 'Before the next class',
    content: 'Review your textbook examples and prepare two questions about the previous lesson.',
  }, teacher.token);
  const submitted = await checked(state, teacherRoom + '/homework', 'POST', {
    title: 'Solve three equations',
    instructions: 'Solve x + 9 = 20, 3x = 24, and 2x - 4 = 12. Explain each step.',
    dueAt: future(2),
  }, teacher.token) as { id: string };
  await checked(state, studentRoom + '/homework/' + submitted.id + '/submit', 'PUT', {
    submission: 'x = 11, x = 8, x = 8. I checked the answers by substitution.',
  }, student.token);
  await checked(state, teacherRoom + '/homework', 'POST', {
    title: 'Physics: distance and speed',
    instructions: 'Write the distance-speed-time formula and solve two example questions.',
    dueAt: future(4),
  }, teacher.token);
  await checked(state, teacherRoom.replace('/classroom', '/messages'), 'POST', {
    id: crypto.randomUUID(), body: 'Welcome! Our first algebra session is scheduled for tomorrow.',
  }, teacher.token);

  // Former UI-only profiles are now regular accounts that can match and chat.
  await ensureDemoFixtureAccounts(state);
  await ensureDemoHistory(state);
  // Historical demo generation uses the old interest fixture format; migrate
  // those reciprocal pairs to accepted bookings before the demo is first shown.
  state.bookingVersion = 0;
  await prepareDemoBookings(state);
  // Fixture tokens are not an active login. Visitors choose or create an account.
  state.sessions = {};
  void adminToken;
  return state;
}

function readState(): DemoState | null {
  let value: string | null;
  try {
    value = localStorage.getItem(STATE_KEY);
  } catch {
    throw new Error('Browser storage is unavailable. Enable site storage to use Shikshak demo mode.');
  }
  if (!value) return null;
  try {
    const state = JSON.parse(value) as DemoState;
    if (!state || typeof state !== 'object' || !state.accounts || !state.sessions || !state.own || !state.classrooms) {
      throw new Error('Invalid demo state.');
    }
    return state;
  } catch {
    throw new Error('This browser’s Shikshak demo data cannot be read. Reset the demo data to start fresh.');
  }
}

function storeState(state: DemoState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    throw new Error('Unable to save Shikshak demo changes. Check browser storage settings or available space.');
  }
}

let queue: Promise<unknown> = Promise.resolve();

function queued<T>(task: () => Promise<T>): Promise<T> {
  const work = queue.catch(() => undefined).then(task);
  queue = work.catch(() => undefined);
  return work;
}

async function loadOrSeedState(): Promise<DemoState> {
  let state = readState();
  if (!state) {
    state = await seedBrowserDemo();
    storeState(state);
  } else {
    // Each migration runs once. Existing local accounts, matches, messages and
    // homework are never cleared when a newer demo dataset is installed.
    const fixturesUpdated = await ensureDemoFixtureAccounts(state);
    const historyUpdated = await ensureDemoHistory(state);
    if (historyUpdated) state.bookingVersion = 0;
    const bookingsUpdated = await prepareDemoBookings(state);
    if (fixturesUpdated || historyUpdated || bookingsUpdated) storeState(state);
  }
  return state;
}

/**
 * Same signature/Response semantics as fetch, but fully local to this browser.
 * Serializing requests prevents concurrent initial seeding or tab-local writes
 * from overwriting one another. Separate browsers are intentionally isolated.
 */
export function browserDemoRequest(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<Response> {
  return queued(async () => {
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    const state = await loadOrSeedState();

    const token = localStorage.getItem(SESSION_KEY) ?? undefined;
    const response = await invoke(state, path, options.method ?? 'GET', options.body, token);

    if (response.ok && (path === '/auth/signup' || path === '/auth/login' || path === '/admin/bootstrap')) {
      const account = await response.clone().json() as PublicAccount;
      localStorage.setItem(SESSION_KEY, sessionFor(state, account));
    }
    if (response.ok && path === '/auth/logout') {
      localStorage.removeItem(SESSION_KEY);
    }

    // GET /classrooms may lazily create a classroom; persist every result.
    storeState(state);
    return response;
  });
}

export interface BrowserDemoAccount {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  localityId: string;
  homeArea?: HomeArea;
  active: boolean;
  published: boolean;
}

export interface QuickDemoAccountInput {
  name: string;
  role: Role;
  localityId: string;
  homeArea?: HomeArea;
  subject: string;
  grade: string;
}

export function listBrowserDemoAccounts(): Promise<BrowserDemoAccount[]> {
  return queued(async () => {
    const state = await loadOrSeedState();
    return Object.values(state.accounts)
      .map(account => ({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        localityId: account.localityId,
        ...(account.homeArea ? { homeArea: account.homeArea } : {}),
        active: account.active,
        published: state.own[account.id]?.published ?? false,
      }))
      .sort((a, b) => {
        const order = { student: 0, teacher: 1, admin: 2 };
        return order[a.role] - order[b.role] || a.name.localeCompare(b.name);
      });
  });
}

/**
 * One-click account switching is deliberately available only inside this
 * local demo adapter. It never calls the remote API or bypasses API auth.
 */
export function switchBrowserDemoAccount(accountId: string): Promise<PublicAccount> {
  return queued(async () => {
    const state = await loadOrSeedState();
    const account = state.accounts[accountId];
    if (!account || !account.active) throw new Error('This demo account is unavailable or suspended.');
    const previous = localStorage.getItem(SESSION_KEY);
    if (previous) delete state.sessions[previous];
    const token = crypto.randomUUID();
    state.sessions[token] = { userId: account.id, expiresAt: Date.now() + 30 * 86400000 };
    const response = await invoke(state, '/auth/me', 'GET', undefined, token);
    if (!response.ok) throw new Error('Could not open this demo account.');
    const safe = await response.json() as PublicAccount;
    storeState(state);
    localStorage.setItem(SESSION_KEY, token);
    return safe;
  });
}

/**
 * Quick-create a test-only identity with a unique generated email and a
 * published starter listing. This makes it immediately discoverable for
 * reciprocal interest, chat and classroom testing.
 */
export function createBrowserDemoAccount(input: QuickDemoAccountInput): Promise<PublicAccount> {
  return queued(async () => {
    const state = await loadOrSeedState();
    const name = input.name.trim().slice(0, 60);
    const locality = catalog.localities.find(area => area.id === input.localityId);
    if (!name || !locality) throw new Error('Enter a name and choose a neighbourhood.');
    if (!catalog.subjects.includes(input.subject) || !catalog.grades.includes(input.grade)) {
      throw new Error('Choose a subject and class level.');
    }
    if (input.role !== 'student' && input.role !== 'teacher') {
      throw new Error('Only student and teacher demo accounts can be created.');
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 26) || 'member';
    const email = 'test-' + slug + '-' + crypto.randomUUID().slice(0, 8) + '@shikshak.demo';
    const account = await checked(state, '/auth/signup', 'POST', {
      name, email, role: input.role, localityId: locality.id, password: DEMO_PASSWORD,
      ...(input.homeArea ? { homeArea: input.homeArea } : {}),
    }) as PublicAccount;
    const token = sessionFor(state, account);
    await checked(state, '/profile', 'PUT', {
      name,
      localityId: locality.id,
      ...(input.homeArea ? { homeArea: input.homeArea } : {}),
      bio: input.role === 'teacher'
        ? 'Demo teaching profile for testing Shikshak.'
        : 'Demo student profile for testing Shikshak.',
      qualifications: '', experience: '',
      strongSubjects: [],
      weakSubjects: input.role === 'student' ? [input.subject] : [],
    }, token);
    await checked(state, '/workspaces/' + input.role + '/listing', 'PUT', {
      name,
      headline: input.role === 'teacher' ? input.subject + ' tutor' : 'Looking for help in ' + input.subject,
      localityId: locality.id,
      subjects: [input.subject],
      grades: [input.grade],
      rate: input.role === 'teacher' ? state.pricing.baseRate : 600,
      availability: 'Flexible hours',
      description: input.role === 'teacher'
        ? 'Available for practice lessons, notes, assignments and demo coordination.'
        : 'Looking for tutoring, class scheduling and homework support.',
      published: true,
    }, token);
    const previous = localStorage.getItem(SESSION_KEY);
    if (previous) delete state.sessions[previous];
    storeState(state);
    localStorage.setItem(SESSION_KEY, token);
    return account;
  });
}

/** Clear only Shikshak's browser-pilot keys, not other application data. */
export async function resetBrowserDemo(): Promise<void> {
  // PDF bytes are held separately from the note metadata.
  const { clearBrowserPdfNotes } = await import('./pdfNotes');
  await clearBrowserPdfNotes();
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(SESSION_KEY);
}
