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
import type { PublicAccount, Role } from '../../shared/domain';

const STATE_KEY = 'shikshak.browser-pilot.v1';
const SESSION_KEY = 'shikshak.browser-pilot.session.v1';
const ADMIN_SEED_KEY = 'shikshak-local-demo-bootstrap-for-testing-only';
export const DEMO_PASSWORD = 'ShikshakDemo2026!';

export const demoAccounts = {
  student: { name: 'Aditi Das', email: 'student@shikshak.demo' },
  teacher: { name: 'Arjun Bora', email: 'teacher@shikshak.demo' },
  admin: { name: 'Demo Administrator', email: 'admin@shikshak.demo' },
} as const;

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

  // Seed one real mutual relationship, so both roles can explore the classroom.
  await checked(state, '/workspaces/teacher/listings/' + student.account.id + '/interest', 'PUT', undefined, teacher.token);
  await checked(state, '/workspaces/student/listings/' + teacher.account.id + '/interest', 'PUT', undefined, student.token);

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

/**
 * Same signature/Response semantics as fetch, but fully local to this browser.
 * Serializing requests prevents concurrent initial seeding or tab-local writes
 * from overwriting one another. Separate browsers are intentionally isolated.
 */
export function browserDemoRequest(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<Response> {
  const work = queue.catch(() => undefined).then(async () => {
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    let state = readState();
    if (!state) {
      state = await seedBrowserDemo();
      storeState(state);
    }

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
  queue = work.catch(() => undefined);
  return work;
}

/** Clear only Shikshak's browser-pilot keys, not other application data. */
export function resetBrowserDemo(): void {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(SESSION_KEY);
}
