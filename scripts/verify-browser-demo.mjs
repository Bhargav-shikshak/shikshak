import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the real browser adapter and API handlers without a Worker or network.
// Browser storage and globals are deliberately mocked, while Web Crypto is real.
const data = new Map();
globalThis.localStorage = {
  getItem: key => data.has(key) ? data.get(key) : null,
  setItem: (key, value) => { data.set(key, String(value)); },
  removeItem: key => { data.delete(key); },
};
globalThis.fetch = () => { throw new Error('Browser demo must not contact a remote API.'); };

const bundle = await build({
  entryPoints: ['src/services/browserDemo.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
  logLevel: 'silent',
});
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64');
const {
  browserDemoRequest, resetBrowserDemo,
  listBrowserDemoAccounts, switchBrowserDemoAccount, createBrowserDemoAccount,
} = await import(moduleUrl);

let assertions = 0;
async function call(path, { method = 'GET', body } = {}) {
  const response = await browserDemoRequest(path, { method, body });
  assertions++;
  return { status: response.status, data: await response.json() };
}

const catalog = await call('/catalog');
assert.equal(catalog.status, 200);
assert.ok(catalog.data.subjects.includes('Mathematics'));
let result = await call('/auth/me');
assert.equal(result.status, 401, 'First visit must not auto-login');

result = await call('/auth/login', { method: 'POST', body: {
  email: 'student@shikshak.demo', password: 'ShikshakDemo2026!',
} });
assert.equal(result.status, 200);
assert.equal(result.data.role, 'student');
const studentId = result.data.id;

const studentsTeachers = await call('/workspaces/student/discovery');
assert.equal(studentsTeachers.status, 200);
const teacher = studentsTeachers.data.listings.find(x => x.name === 'Arjun Bora');
assert.ok(teacher, 'Seeded tutor appears as a regular account');
assert.ok(teacher.rate >= 400, 'Server-grade rate policy is reused');
assert.ok(teacher.connection === 'matched', 'Real demo tutor is pre-matched');
assert.ok(studentsTeachers.data.listings.every(x => !x.fictional), 'No unmatchable preview cards are injected');
const rahul = studentsTeachers.data.listings.find(x => x.name === 'Rahul Kalita');
assert.ok(rahul && rahul.id === 't-rahul', 'Legacy Rahul listing becomes a persistent account with stable ID');
assert.ok(rahul.subjects.includes('Computer Science'), 'Fixture subject and listing details are retained');
let rahulInterest = await call('/workspaces/student/listings/' + rahul.id + '/interest', { method: 'PUT' });
assert.equal(rahulInterest.status, 200, 'Student can now send interest to former preview tutor');
assert.equal(rahulInterest.data.status, 'sent');

const previewAccounts = await listBrowserDemoAccounts();
const rahulAccount = previewAccounts.find(x => x.id === 't-rahul');
assert.ok(rahulAccount && rahulAccount.role === 'teacher' && rahulAccount.published, 'Rahul is switchable and has a live listing');
assert.ok(previewAccounts.length >= 19, 'All original example tutors and students are persisted as accounts');

const rooms = await call('/workspaces/student/classrooms');
assert.equal(rooms.status, 200);
assert.equal(rooms.data.length, 1);
assert.equal(rooms.data[0].classroom.sessions.length, 2, 'Sample classes exist');
assert.equal(rooms.data[0].classroom.notes.length, 2, 'Sample notes exist');
assert.equal(rooms.data[0].classroom.homework.length, 2, 'Sample homework exists');
assert.ok(rooms.data[0].classroom.homework.some(x => x.submittedAt && !x.reviewedAt), 'Sample pending teacher review exists');

// Reply from the formerly unmatchable sample account and exercise messaging.
await switchBrowserDemoAccount(rahulAccount.id);
let rahulDetails = await call('/workspaces/teacher/connections');
assert.ok(rahulDetails.data.some(x => x.listing.id === studentId && x.status === 'incoming'), 'Former preview receives interest');
let rahulMatch = await call('/workspaces/teacher/listings/' + studentId + '/interest', { method: 'PUT' });
assert.equal(rahulMatch.data.status, 'matched', 'Former preview teacher can match back');
const rahulMessage = await call('/workspaces/teacher/connections/' + studentId + '/messages', {
  method: 'POST', body: { id: crypto.randomUUID(), body: 'I can help with coding and maths.' },
});
assert.equal(rahulMessage.status, 201, 'Former preview can send a message');
await switchBrowserDemoAccount(studentId);
const fromRahul = await call('/workspaces/student/connections/' + rahulAccount.id + '/messages');
assert.ok(fromRahul.data.some(x => x.body.includes('coding and maths')), 'Student sees former preview teacher message');
await switchBrowserDemoAccount(rahulAccount.id);
const rahulClass = await call('/workspaces/teacher/connections/' + studentId + '/classroom/sessions', {
  method: 'POST', body: { title: 'Python practice', startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60 },
});
assert.equal(rahulClass.status, 201, 'Former preview teacher can schedule a class');
await switchBrowserDemoAccount(studentId);
const studentRahulRoom = await call('/workspaces/student/connections/' + rahulAccount.id + '/classroom');
assert.ok(studentRahulRoom.data.sessions.some(x => x.title === 'Python practice'), 'Student sees class from former preview');
await call('/auth/logout', { method: 'POST' });
result = await call('/auth/me');
assert.equal(result.status, 401);

result = await call('/auth/login', { method: 'POST', body: {
  email: 'teacher@shikshak.demo', password: 'ShikshakDemo2026!',
} });
assert.equal(result.status, 200);
assert.equal(result.data.role, 'teacher');
result = await call('/workspaces/teacher/discovery');
assert.equal(result.status, 200);
assert.ok(result.data.listings.some(x => x.id === studentId), 'Teacher can find real students');
result = await call('/workspaces/student/discovery');
assert.equal(result.status, 403, 'Local mode must preserve role permissions');

await call('/auth/logout', { method: 'POST' });
result = await call('/auth/login', { method: 'POST', body: {
  email: 'admin@shikshak.demo', password: 'ShikshakDemo2026!',
} });
assert.equal(result.status, 200);
assert.equal(result.data.role, 'admin');
result = await call('/admin');
assert.equal(result.status, 200);
assert.ok(result.data.pendingRates >= 1, 'Admin has a pending rate request to approve');

await call('/auth/logout', { method: 'POST' });
result = await call('/auth/signup', { method: 'POST', body: {
  name: 'A New Student', email: 'newstudent@example.test',
  password: 'demo-test-pass-123', localityId: 'rajgarh', role: 'student',
} });
assert.equal(result.status, 201, 'Browser-local signup must work');
result = await call('/auth/me');
assert.equal(result.data.email, 'newstudent@example.test', 'Signup must start a local session');
assert.ok(!Array.from(data.values()).join('\n').includes('demo-test-pass-123'), 'Saved data must not contain new plaintext password');
await call('/auth/logout', { method: 'POST' });
result = await call('/auth/login', { method: 'POST', body: {
  email: 'newstudent@example.test', password: 'demo-test-pass-123',
} });
assert.equal(result.status, 200, 'Created account persists and can log in again');

// Test the in-app account manager, including a newly created, discoverable profile.
let profiles = await listBrowserDemoAccounts();
assert.ok(profiles.some(x => x.email === 'newstudent@example.test'), 'Regular signup also appears in demo switcher');
assert.ok(profiles.some(x => x.role === 'admin'), 'Demo admin appears in user picker');
assert.ok(profiles.some(x => x.email === 'teacher@shikshak.demo' && x.published), 'Published tutor appears in picker');

const quickStudent = await createBrowserDemoAccount({
  name: 'Priya Sharma', role: 'student', localityId: 'ulubari',
  subject: 'Mathematics', grade: 'Classes 9–10',
});
assert.equal(quickStudent.role, 'student');
result = await call('/auth/me');
assert.equal(result.data.id, quickStudent.id, 'Quick-create switches to the new user');
result = await call('/workspaces/student/listing');
assert.equal(result.data.published, true, 'Quick-created account has a discoverable listing');
assert.ok(result.data.weakSubjects.includes('Mathematics'), 'Student topic is reflected in profile');
profiles = await listBrowserDemoAccounts();
assert.ok(profiles.some(x => x.id === quickStudent.id && x.published), 'New quick profile appears in picker');

const teacherAccount = profiles.find(x => x.email === 'teacher@shikshak.demo');
const adminAccount = profiles.find(x => x.role === 'admin');
const originalNewStudent = profiles.find(x => x.email === 'newstudent@example.test');
assert.ok(teacherAccount && adminAccount && originalNewStudent);

let switched = await switchBrowserDemoAccount(teacherAccount.id);
assert.equal(switched.role, 'teacher');
result = await call('/workspaces/teacher/discovery');
assert.ok(result.data.listings.some(x => x.id === quickStudent.id), 'Teacher can discover new local student');
result = await call('/workspaces/teacher/listings/' + quickStudent.id + '/interest', { method: 'PUT' });
assert.equal(result.status, 200, 'Teacher can send interest to new local student');

switched = await switchBrowserDemoAccount(quickStudent.id);
assert.equal(switched.id, quickStudent.id);
result = await call('/workspaces/student/connections');
assert.ok(result.data.some(x => x.listing.id === teacherAccount.id && x.status === 'incoming'), 'Student receives the interest');
result = await call('/workspaces/student/listings/' + teacherAccount.id + '/interest', { method: 'PUT' });
assert.equal(result.data.status, 'matched', 'Student matches the tutor back');
result = await call('/workspaces/student/connections/' + teacherAccount.id + '/messages', {
  method: 'POST',
  body: { id: crypto.randomUUID(), body: 'Can we schedule our maths class?' },
});
assert.equal(result.status, 201, 'Student can send a real matching conversation message');

await switchBrowserDemoAccount(teacherAccount.id);
result = await call('/workspaces/teacher/connections/' + quickStudent.id + '/messages');
assert.ok(result.data.some(x => x.body.includes('maths class')), 'Tutor sees message after account switch');
const teacherRoom = '/workspaces/teacher/connections/' + quickStudent.id + '/classroom';
const studentRoom = '/workspaces/student/connections/' + teacherAccount.id + '/classroom';
result = await call(teacherRoom + '/sessions', {
  method: 'POST', body: {
    title: 'First maths class',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    durationMinutes: 60,
  },
});
assert.equal(result.status, 201, 'Tutor can schedule a class for new match');
result = await call(teacherRoom + '/notes', {
  method: 'POST', body: { title: 'Welcome notes', content: 'Bring your latest maths homework.' },
});
assert.equal(result.status, 201, 'Tutor can share class notes');
result = await call(teacherRoom + '/homework', {
  method: 'POST', body: {
    title: 'Fractions practice', instructions: 'Complete exercises 1 to 5.',
    dueAt: new Date(Date.now() + 172800000).toISOString(),
  },
});
assert.equal(result.status, 201, 'Tutor can assign homework');
const homeworkId = result.data.id;
await switchBrowserDemoAccount(quickStudent.id);
result = await call(studentRoom);
assert.equal(result.data.sessions.length, 1, 'Student sees scheduled class');
assert.equal(result.data.notes.length, 1, 'Student sees shared notes');
result = await call(studentRoom + '/homework/' + homeworkId + '/submit', {
  method: 'PUT', body: { submission: 'I finished exercises 1 to 5.' },
});
assert.equal(result.status, 200, 'Student can submit homework');
await switchBrowserDemoAccount(teacherAccount.id);
result = await call(teacherRoom + '/homework/' + homeworkId + '/review', {
  method: 'PUT', body: { review: 'Good work — review question 3.' },
});
assert.equal(result.status, 200, 'Tutor can review student submission');
await switchBrowserDemoAccount(quickStudent.id);
result = await call(studentRoom);
assert.equal(result.data.homework[0].review, 'Good work — review question 3.', 'Review persists across switches');

// Switching between two student identities must not leak authorization.
await switchBrowserDemoAccount(originalNewStudent.id);
result = await call('/auth/me');
assert.equal(result.data.id, originalNewStudent.id, 'Same-role account switch changes identity');
result = await call(studentRoom);
assert.equal(result.status, 403, 'Other student must not access first student classroom');
await switchBrowserDemoAccount(adminAccount.id);
result = await call('/admin');
assert.equal(result.status, 200, 'Demo switcher can enter simulated admin console');

resetBrowserDemo();
assert.equal(data.size, 0, 'Reset removes only browser-demo keys in an otherwise empty store');
result = await call('/auth/me');
assert.equal(result.status, 401, 'Reset re-seeds without an active session');

console.log('Browser-local demo verified: seed data, signup, quick account creation, same-role and cross-role switching, bidirectional chat, scheduling, notes, homework review, pricing, admin, permission isolation, logout, reset.');
console.log('API calls exercised: ' + assertions);
