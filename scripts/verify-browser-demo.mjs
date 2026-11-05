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
assert.equal(teacher.connection, 'accepted', 'Existing seeded tutoring is an accepted booking');
assert.ok(studentsTeachers.data.listings.every(x => !x.fictional), 'No unmatchable preview cards are injected');
const rahul = studentsTeachers.data.listings.find(x => x.name === 'Rahul Kalita');
assert.ok(rahul && rahul.id === 't-rahul', 'Legacy Rahul listing becomes a persistent account with stable ID');
assert.ok(rahul.subjects.includes('Computer Science'), 'Fixture subject and listing details are retained');
let rahulBooking = await call('/workspaces/student/bookings', {
  method: 'POST', body: {
    teacherId: rahul.id, subject: 'Computer Science', grade: 'Classes 9–10',
    startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60,
    note: 'Can you help me with programming?',
  },
});
assert.equal(rahulBooking.status, 201, 'Student can request a class with former preview tutor');
assert.equal(rahulBooking.data.status, 'pending');

const previewAccounts = await listBrowserDemoAccounts();
const rahulAccount = previewAccounts.find(x => x.id === 't-rahul');
assert.ok(rahulAccount && rahulAccount.role === 'teacher' && rahulAccount.published, 'Rahul is switchable and has a live listing');
assert.ok(previewAccounts.length >= 69, 'Months of fictional members plus the original test accounts are present');
assert.equal(previewAccounts.filter(x => x.email.startsWith('months-teacher-')).length, 22, 'History adds 22 tutors');
assert.equal(previewAccounts.filter(x => x.email.startsWith('months-student-')).length, 28, 'History adds 28 family-managed learners');
assert.equal(previewAccounts.filter(x => x.role === 'admin').length, 1, 'History never creates extra administrators');

const seeded = JSON.parse(data.get('shikshak.browser-pilot.v1'));
const populatedRooms = Object.values(seeded.classrooms);
const classes = populatedRooms.flatMap(room => room.sessions);
const notes = populatedRooms.flatMap(room => room.notes);
const assignments = populatedRooms.flatMap(room => room.homework);
const chats = Object.values(seeded.messages).flat();
assert.equal(seeded.historyVersion, 1, 'History migration applied once');
assert.ok(populatedRooms.length >= 40, 'Large set of matched classrooms is available');
assert.ok(classes.length >= 160 && classes.some(x => x.status === 'completed') && classes.some(x => x.status === 'scheduled'),
  'Both historical and upcoming classes populate dashboards');
assert.ok(notes.length >= 100, 'Realistic note libraries are populated');
assert.ok(assignments.length >= 100 && assignments.some(x => x.reviewedAt) && assignments.some(x => x.submittedAt && !x.reviewedAt),
  'Homework history includes reviewed and waiting assignments');
assert.ok(chats.length >= 250, 'Months of conversations populate chat histories');
assert.ok(classes.some(x => new Date(x.startsAt).getTime() < Date.now() - 90 * 86400000),
  'Completed classes date back more than three months');
assert.ok(Object.values(seeded.bookings).filter(x => x.status === 'accepted').length >= 35,
  'Existing historical teaching pairs were migrated to accepted bookings');
assert.ok(Object.values(seeded.bookings).some(x => x.status === 'pending'), 'Pending booking requests exist');
assert.ok(Object.values(seeded.bookings).some(x => x.status === 'rejected'), 'Declined booking requests exist');

const rooms = await call('/workspaces/student/classrooms');
assert.equal(rooms.status, 200);
assert.ok(rooms.data.length >= 1, 'Aditi retains an established tutor relationship');
const originalRoom = rooms.data.find(x => x.partner.name === 'Arjun Bora')?.classroom;
assert.ok(originalRoom, 'Original Arjun/Aditi classroom remains accessible');
assert.ok(originalRoom.sessions.length >= 5, 'Existing classroom receives completed and upcoming lessons');
assert.ok(originalRoom.notes.length >= 3, 'Sample notes are preserved alongside historical notes');
assert.ok(originalRoom.homework.length >= 3, 'Sample homework is preserved alongside historical work');
assert.ok(originalRoom.homework.some(x => x.submittedAt && !x.reviewedAt), 'Original pending teacher review remains visible');

// Reply from the formerly unmatchable sample account and exercise messaging.
await switchBrowserDemoAccount(rahulAccount.id);
let rahulDetails = await call('/workspaces/teacher/bookings');
assert.ok(rahulDetails.data.some(x => x.studentId === studentId && x.status === 'pending'), 'Former preview tutor receives student booking request');
assert.ok(!JSON.stringify(rahulDetails.data).includes('"homeArea"'), 'Teacher booking feed never exposes student home location');
let rahulDecision = await call('/workspaces/teacher/bookings/' + rahulBooking.data.id, {
  method: 'PUT', body: { decision: 'accept' },
});
assert.equal(rahulDecision.data.status, 'accepted', 'Former preview tutor can accept booking');
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
assert.equal(result.status, 403, 'Teachers cannot browse student locations or discovery details');
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
// Existing browsers with only a legacy locality get one initial map setup.
const homeOne = { lat: 26.7614, lng: 94.2031, city: 'Jorhat', locality: 'Tarajan' };
const baseProfile = {
  name: 'A New Student', localityId: 'rajgarh', bio: 'Reading for exams',
  strongSubjects: [], weakSubjects: ['Mathematics'], qualifications: '', experience: '',
};
let pinned = await call('/profile', { method: 'PUT',
  body: { ...baseProfile, homeArea: homeOne } });
assert.equal(pinned.status, 200, 'Legacy account can set its first home marker');
assert.equal(pinned.data.homeArea.lat, 26.76, 'Private exact latitude is rounded to neighbourhood scale');
assert.equal(pinned.data.homeArea.lng, 94.2, 'Private exact longitude is rounded to neighbourhood scale');
assert.ok(pinned.data.homeChangedAt, 'Home location records when the pin was saved');
pinned = await call('/profile', { method: 'PUT', body: {
  ...baseProfile, homeArea: { ...homeOne, lat: 26.62, lng: 92.8, city: 'Tezpur' },
} });
assert.equal(pinned.status, 429, 'Changing the home location twice in 30 days is blocked by the API');
assert.ok(pinned.data.message.includes('30 days'), 'Rate-limit response explains the cooldown');
pinned = await call('/profile', { method: 'PUT', body: { ...baseProfile, bio: 'Updated bio' } });
assert.equal(pinned.status, 200, 'Editing unrelated profile details remains allowed during cooldown');
let savedState = JSON.parse(data.get('shikshak.browser-pilot.v1'));
savedState.accounts[pinned.data.id].homeChangedAt = new Date(Date.now() - 31 * 86400000).toISOString();
data.set('shikshak.browser-pilot.v1', JSON.stringify(savedState));
pinned = await call('/profile', { method: 'PUT', body: {
  ...baseProfile, homeArea: { ...homeOne, lat: 26.62, lng: 92.8, city: 'Tezpur' },
} });
assert.equal(pinned.status, 200, 'After 30 days a different map pin is accepted');
assert.equal(pinned.data.homeArea.city, 'Tezpur');

// Test the in-app account manager, including a newly created, discoverable profile.
let profiles = await listBrowserDemoAccounts();
assert.ok(profiles.some(x => x.email === 'newstudent@example.test'), 'Regular signup also appears in demo switcher');
assert.ok(profiles.some(x => x.role === 'admin'), 'Demo admin appears in user picker');
assert.ok(profiles.some(x => x.email === 'teacher@shikshak.demo' && x.published), 'Published tutor appears in picker');

const quickStudent = await createBrowserDemoAccount({
  name: 'Priya Sharma', role: 'student', localityId: 'ulubari',
  homeArea: { lat: 26.76, lng: 94.2, city: 'Jorhat', locality: 'Tarajan' },
  subject: 'Mathematics', grade: 'Classes 9–10',
});
assert.equal(quickStudent.role, 'student');
result = await call('/auth/me');
assert.equal(result.data.id, quickStudent.id, 'Quick-create switches to the new user');
result = await call('/workspaces/student/listing');
assert.equal(result.data.published, true, 'Quick-created account has a discoverable listing');
assert.equal(result.data.location.lat, 26.76, 'Quick demo signup uses the map location for its listing');
assert.ok(result.data.locality.includes('Jorhat'), 'Geocoded city is displayed publicly');
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
assert.equal(result.status, 403, 'Teacher has no student Explore or map');
result = await call('/workspaces/teacher/listings/' + quickStudent.id + '/save', { method: 'PUT', body: { saved: true } });
assert.equal(result.status, 403, 'Teacher cannot save or browse student listing');

switched = await switchBrowserDemoAccount(quickStudent.id);
assert.equal(switched.id, quickStudent.id);
const newBooking = await call('/workspaces/student/bookings', { method: 'POST',
  body: { teacherId: teacherAccount.id, subject: 'Mathematics', grade: 'Classes 9–10',
    startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60,
    note: 'I would like to study algebra.' },
});
assert.equal(newBooking.status, 201, 'Student requests a class without teacher interest');
assert.equal(newBooking.data.status, 'pending');
result = await call('/workspaces/student/connections/' + teacherAccount.id + '/messages');
assert.equal(result.status, 403, 'Student cannot message before tutor accepts');
await switchBrowserDemoAccount(teacherAccount.id);
result = await call('/workspaces/teacher/bookings/' + newBooking.data.id, {
  method: 'PUT', body: { decision: 'accept' },
});
assert.equal(result.status, 200, 'Tutor accepts the class');
assert.equal(result.data.status, 'accepted');
await switchBrowserDemoAccount(quickStudent.id);
result = await call('/workspaces/student/connections/' + teacherAccount.id + '/messages', {
  method: 'POST',
  body: { id: crypto.randomUUID(), body: 'Can we schedule our maths class?' },
});
assert.equal(result.status, 201, 'Student can message after approved booking');

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
assert.equal(result.status, 201, 'Tutor can schedule additional classes for accepted booking');
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
assert.equal(result.data.sessions.length, 2, 'Student sees accepted first booking and additional scheduled class');
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

// Simulate upgrading an existing browser with old preview-only listings.
// The migration must reconstruct profiles and keep account/classroom data.
const storedKey = 'shikshak.browser-pilot.v1';
const oldLocal = JSON.parse(data.get(storedKey));
delete oldLocal.fixtureVersion;
delete oldLocal.historyVersion;
delete oldLocal.accounts['t-rahul'];
delete oldLocal.own['t-rahul'];
oldLocal.saves[originalNewStudent.id] = ['t-rahul'];
const oldClassroomCount = Object.keys(oldLocal.classrooms).length;
data.set(storedKey, JSON.stringify(oldLocal));
const upgraded = await listBrowserDemoAccounts();
assert.ok(upgraded.some(x => x.id === 't-rahul' && x.published), 'Old preview migrates to a real account');
assert.ok(upgraded.some(x => x.id === originalNewStudent.id), 'Previously created local student is preserved');
const migratedState = JSON.parse(data.get(storedKey));
assert.equal(migratedState.saves[originalNewStudent.id][0], 't-rahul', 'Saved profile references remain valid');
assert.ok(Object.keys(migratedState.classrooms).length >= oldClassroomCount, 'Existing classroom history survives migration');
assert.equal(migratedState.historyVersion, 1, 'History migration is idempotent on old stored data');
assert.ok(migratedState.accounts[originalNewStudent.id], 'User-created account is not replaced during migration');
result = await call('/auth/me');
assert.equal(result.data.role, 'admin', 'Existing active local session survives migration');

await resetBrowserDemo();
assert.equal(data.size, 0, 'Reset removes only browser-demo keys in an otherwise empty store');
result = await call('/auth/me');
assert.equal(result.status, 401, 'Reset re-seeds without an active session');

console.log('Browser demo verified: booking migration, teacher privacy, requests, approvals, chats, classrooms, 50 new profiles, five-month history, roles and homework.');
console.log('API calls exercised: ' + assertions);
