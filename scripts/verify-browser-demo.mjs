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
const { browserDemoRequest, resetBrowserDemo } = await import(moduleUrl);

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
assert.ok(teacher, 'Real seeded tutor must appear alongside fictional previews');
assert.ok(teacher.rate >= 400, 'Server-grade rate policy is reused');
assert.ok(teacher.connection === 'matched', 'Real demo tutor is pre-matched');
assert.ok(studentsTeachers.data.listings.some(x => x.fictional), 'Fictional previews still appear');

const rooms = await call('/workspaces/student/classrooms');
assert.equal(rooms.status, 200);
assert.equal(rooms.data.length, 1);
assert.equal(rooms.data[0].classroom.sessions.length, 2, 'Sample classes exist');
assert.equal(rooms.data[0].classroom.notes.length, 2, 'Sample notes exist');
assert.equal(rooms.data[0].classroom.homework.length, 2, 'Sample homework exists');
assert.ok(rooms.data[0].classroom.homework.some(x => x.submittedAt && !x.reviewedAt), 'Sample pending teacher review exists');

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

resetBrowserDemo();
assert.equal(data.size, 0, 'Reset removes only browser-demo keys in an otherwise empty store');
result = await call('/auth/me');
assert.equal(result.status, 401, 'Reset re-seeds without an active session');

console.log('Browser-local demo verified: seed data, login, signup, classrooms, matching, pricing, admin, permissions, logout, reset.');
console.log('API calls exercised: ' + assertions);
