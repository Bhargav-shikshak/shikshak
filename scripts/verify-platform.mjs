import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Bundle the same API modules used by Cloudflare and the local preview.
// This test uses no external service, browser or hardcoded administrator account.
const bundle = await build({
  entryPoints: ['demo/api.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
  logLevel: 'silent',
});
const moduleUrl = 'data:text/javascript;base64,' +
  Buffer.from(bundle.outputFiles[0].contents).toString('base64');
const { demoApi, initialState } = await import(moduleUrl);
const state = initialState();
const adminBootstrapToken = 'test-only-setup-token-very-long-and-random';
let assertions = 0;
const ok = (condition, message) => { assert.ok(condition, message); assertions++; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
async function call(path, { method = 'GET', body, cookie = '' } = {}) {
  const req = new Request('https://shikshak.example.test/api/v1/' + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Origin: 'https://shikshak.example.test',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await demoApi(req, state, { adminBootstrapToken });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}
function member(name, email, password, role, localityId) {
  return { name, email, password, role, localityId };
}
const teacher = await call('auth/signup', { method: 'POST',
  body: member('Tutor One', 'tutor@example.test', 'long-unique-password-111', 'teacher', 'chandmari') });
equal(teacher.status, 201, 'Teacher registration succeeds');
equal(teacher.data.role, 'teacher');
ok(teacher.cookie.startsWith('shikshak_auth='), 'Teacher receives an HttpOnly session cookie');

const student = await call('auth/signup', { method: 'POST',
  body: member('Student One', 'student@example.test', 'long-unique-password-222', 'student', 'rajgarh') });
equal(student.status, 201, 'Student registration succeeds');
equal(student.data.role, 'student');
ok(student.data.id !== teacher.data.id, 'Accounts have different identities');

let result = await call('auth/signup', { method: 'POST', body: member('Duplicate', 'tutor@example.test', 'another-password-333', 'teacher', 'rajgarh') });
equal(result.status, 409, 'Duplicate email is rejected');
result = await call('auth/signup', { method: 'POST', body: member('Illegal Admin', 'new@example.test', 'another-password-333', 'admin', 'rajgarh') });
equal(result.status, 400, 'Public admin registration is prohibited');
result = await call('workspaces/student/discovery', { cookie: teacher.cookie });
equal(result.status, 403, 'Teacher cannot use student API by changing a route');

const draft = (name, headline, localityId, rate) => ({
  name, headline, localityId, subjects: ['Mathematics'], grades: ['Classes 9–10'],
  rate, availability: 'Weekday evenings', description: 'Personalized help and guided practice.',
  published: true,
});
result = await call('workspaces/teacher/listing', {
  method: 'PUT', cookie: teacher.cookie,
  body: draft('Tutor One', 'Math tutoring', 'chandmari', 9999),
});
equal(result.status, 200, 'Tutor listing published');
equal(result.data.rate, 400, 'Teacher cannot set own unapproved price through listing API');

result = await call('workspaces/student/listing', {
  method: 'PUT', cookie: student.cookie,
  body: draft('Student One', 'Need Maths tutor', 'rajgarh', 700),
});
equal(result.status, 200, 'Student listing published');

result = await call('workspaces/student/discovery', { cookie: student.cookie });
equal(result.status, 200, 'Student can discover tutors');
const foundTeacher = result.data.listings.find(x => x.id === teacher.data.id);
ok(foundTeacher, 'Registered tutor appears in student discovery');
ok(foundTeacher.rate >= 400, 'Student sees platform distance-based rate');
equal(foundTeacher.baseRate, 400, 'Price quote uses platform base');
equal(foundTeacher.travelFee, foundTeacher.rate - foundTeacher.baseRate, 'Quote shows travel component');
ok(result.data.listings.every(x => !x.fictional), 'Discovery only contains persisted listings');
equal(result.data.listings.length, 1, 'Server does not inject fictional previews into discovery');
result = await call('workspaces/student/listings/' + teacher.data.id + '/interest', {
  method: 'PUT', cookie: student.cookie,
});
equal(result.status, 410, 'Old mutual interest endpoint is retired');
result = await call('workspaces/teacher/discovery', { cookie: teacher.cookie });
equal(result.status, 403, 'Teachers cannot browse student discovery or map locations');
result = await call('workspaces/teacher/listings/' + student.data.id + '/save', {
  method: 'PUT', cookie: teacher.cookie, body: { saved: true },
});
equal(result.status, 403, 'Teachers cannot search or save student listings');

result = await call('profile', { method: 'PUT', cookie: student.cookie,
  body: { name: 'Student One', localityId: 'rajgarh', bio: 'Preparing for exams',
    strongSubjects: ['English'], weakSubjects: ['Mathematics'], qualifications: '', experience: '' } });
equal(result.status, 200, 'Student can update profile');
equal(result.data.weakSubjects[0], 'Mathematics', 'Weak subject is saved');
result = await call('workspaces/teacher/discovery', { cookie: teacher.cookie });
equal(result.status, 403, 'Editing a student profile never makes it browseable by teachers');

result = await call('profile/request-rate', { method: 'POST', cookie: teacher.cookie, body: { rate: 850 } });
equal(result.status, 200, 'Teacher submits price request');
equal(result.data.rateStatus, 'pending');
result = await call('workspaces/student/discovery', { cookie: student.cookie });
equal(result.data.listings.find(x => x.id === teacher.data.id).baseRate, 400, 'Pending rate not applied without approval');

result = await call('admin/bootstrap', { method: 'POST',
  body: { name: 'Platform Admin', email: 'admin@example.test',
    password: 'long-admin-password-444', localityId: 'rajgarh', setupToken: 'wrong-key' } });
equal(result.status, 403, 'Incorrect admin setup key rejected');

const admin = await call('admin/bootstrap', { method: 'POST',
  body: { name: 'Platform Admin', email: 'admin@example.test',
    password: 'long-admin-password-444', localityId: 'rajgarh', setupToken: adminBootstrapToken } });
equal(admin.status, 201, 'First admin can be securely bootstrapped');
equal(admin.data.role, 'admin');
result = await call('admin/bootstrap', { method: 'POST',
  body: { name: 'Second Admin', email: 'admin2@example.test',
    password: 'long-admin-password-555', localityId: 'rajgarh', setupToken: adminBootstrapToken } });
equal(result.status, 409, 'Admin bootstrap only works once');
result = await call('admin', { cookie: student.cookie });
equal(result.status, 403, 'Students cannot access admin console');

result = await call('admin', { cookie: admin.cookie });
equal(result.status, 200, 'Admin console loads');
equal(result.data.pendingRates, 1, 'Admin sees pending custom rates');
result = await call('admin/accounts/' + teacher.data.id + '/rate', {
  method: 'PUT', cookie: admin.cookie, body: { action: 'approve' } });
equal(result.status, 200, 'Admin can approve teacher rate');
equal(result.data.approvedRate, 850);

result = await call('workspaces/student/discovery', { cookie: student.cookie });
equal(result.data.listings.find(x => x.id === teacher.data.id).baseRate, 850, 'Approved teacher base rate used in student quote');

result = await call('admin/pricing', { method: 'PUT', cookie: admin.cookie, body: {
  baseRate: 500, freeRadiusKm: 0, distanceStepKm: 1, stepFee: 75, maxTravelFee: 450,
} });
equal(result.status, 200, 'Admin can update platform pricing');
result = await call('workspaces/student/discovery', { cookie: student.cookie });
const newQuote = result.data.listings.find(x => x.id === teacher.data.id);
equal(newQuote.baseRate, 850, 'Approved custom teacher base survives policy update');
ok(newQuote.travelFee >= 75, 'Updated travel policy applies');

const requested = await call('workspaces/student/bookings', { method: 'POST', cookie: student.cookie,
  body: {
    teacherId: teacher.data.id, subject: 'Mathematics', grade: 'Classes 9–10',
    startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60,
    note: 'Please help me with algebra.',
  },
});
equal(requested.status, 201, 'Students initiate class bookings');
equal(requested.data.status, 'pending', 'Booking awaits tutor approval');
equal(requested.data.studentName, 'Student One', 'Booking shares the student name');
ok(!('location' in requested.data) && !('homeArea' in requested.data),
  'Booking never discloses student location');
result = await call('workspaces/teacher/bookings', { cookie: teacher.cookie });
equal(result.status, 200, 'Tutor receives only direct booking requests');
ok(result.data.some(x => x.id === requested.data.id), 'Tutor sees student request');
ok(!JSON.stringify(result.data).includes('rajgarh') && !JSON.stringify(result.data).includes('26.'),
  'Tutor booking response contains no student location coordinates');
result = await call('workspaces/teacher/connections/' + student.data.id + '/classroom', { cookie: teacher.cookie });
equal(result.status, 404, 'Tutor cannot enumerate or enter a classroom before approving the booking');
result = await call('workspaces/student/bookings', { method: 'POST', cookie: student.cookie,
  body: {
    teacherId: teacher.data.id, subject: 'Mathematics', grade: 'Classes 9–10',
    startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60,
  },
});
equal(result.status, 409, 'Duplicate pending booking is rejected');
result = await call('workspaces/student/bookings/' + requested.data.id, { method: 'PUT', cookie: student.cookie,
  body: { decision: 'accept' },
});
equal(result.status, 403, 'Student cannot accept own request');
result = await call('workspaces/teacher/bookings/' + requested.data.id, { method: 'PUT', cookie: teacher.cookie,
  body: { decision: 'accept' },
});
equal(result.status, 200, 'Teacher can accept request');
equal(result.data.status, 'accepted');
result = await call('workspaces/teacher/bookings/' + requested.data.id, { method: 'PUT', cookie: teacher.cookie,
  body: { decision: 'reject' },
});
equal(result.status, 409, 'Decision is final for an accepted booking');
result = await call('workspaces/student/bookings', { cookie: student.cookie });
ok(result.data.some(x => x.id === requested.data.id && x.status === 'accepted'),
  'Student sees accepted booking');

result = await call('workspaces/teacher/classrooms', { cookie: teacher.cookie });
equal(result.status, 200, 'Teacher lists only accepted classrooms');
const tutorSummary = result.data.find(x => x.partner.id === student.data.id);
ok(tutorSummary, 'Accepted student appears in tutor classroom list');
equal(tutorSummary.partner.locality, '', 'Classroom response hides student locality');
equal(tutorSummary.partner.location.lat, 0, 'Classroom response does not reveal student coordinates');
equal(tutorSummary.partner.description, '', 'Classroom response hides student discovery description');

const route = 'workspaces/teacher/connections/' + student.data.id + '/classroom';
result = await call(route + '/sessions', { method: 'POST', cookie: teacher.cookie,
  body: { title: 'Quadratic equations', startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60 } });
equal(result.status, 201, 'Teacher schedules class');
const classId = result.data.id;
result = await call('workspaces/student/connections/' + teacher.data.id + '/classroom/sessions', { method: 'POST', cookie: student.cookie,
  body: { title: 'Invalid student session', startsAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 60 } });
equal(result.status, 404, 'Student cannot schedule teacher-only classes');
result = await call(route + '/notes', { method: 'POST', cookie: teacher.cookie,
  body: { title: 'Algebra notes', content: 'Solve for roots using factoring.' } });
equal(result.status, 201, 'Tutor posts notes');
result = await call(route + '/homework', { method: 'POST', cookie: teacher.cookie,
  body: { title: 'Practice questions', instructions: 'Solve exercises one to five.',
    dueAt: new Date(Date.now() + 2 * 86400000).toISOString() } });
equal(result.status, 201, 'Teacher assigns homework');
const homeworkId = result.data.id;
result = await call('workspaces/student/connections/' + teacher.data.id + '/classroom', { cookie: student.cookie });
equal(result.status, 200, 'Student has access to matching classroom');
equal(result.data.homework.length, 1, 'Student sees homework');
result = await call('workspaces/student/connections/' + teacher.data.id + '/classroom/homework/' + homeworkId + '/submit', {
  method: 'PUT', cookie: student.cookie, body: { submission: 'Completed steps one to five.' } });
equal(result.status, 200, 'Student submits homework');
result = await call(route + '/homework/' + homeworkId + '/review', {
  method: 'PUT', cookie: teacher.cookie, body: { review: 'Good effort; review question three.' } });
equal(result.status, 200, 'Tutor reviews homework');
result = await call(route + '/sessions/' + classId + '/status', {
  method: 'PUT', cookie: teacher.cookie, body: { status: 'completed' } });
equal(result.status, 200, 'Tutor marks a class complete');

result = await call('workspaces/student/classrooms', { cookie: student.cookie });
ok(result.data.some(x => x.partner.id === teacher.data.id && x.classroom.homework[0].review), 'Student dashboard receives feedback');

result = await call('admin/accounts/' + teacher.data.id + '/status', { method: 'PUT', cookie: admin.cookie, body: { action: 'suspend' } });
equal(result.status, 200, 'Admin can suspend teacher');
result = await call('auth/me', { cookie: teacher.cookie });
equal(result.status, 401, 'Suspended account cannot access authenticated endpoints');
result = await call('workspaces/student/discovery', { cookie: student.cookie });
ok(!result.data.listings.some(x => x.id === teacher.data.id), 'Suspended tutor disappears from discovery');
result = await call('auth/logout', { method: 'POST', cookie: student.cookie });
equal(result.status, 200, 'Logout succeeds');
result = await call('auth/me', { cookie: student.cookie });
equal(result.status, 401, 'Logged-out session is invalid');

// Home selection is a persisted approximate point; HTTP API (not UI state)
// enforces a rolling 30-day cooldown for subsequent moves.
const tutorPin = { lat: 26.7533, lng: 94.2079, city: 'Jorhat', locality: 'Tarajan' };
const learnerPin = { lat: 26.7619, lng: 94.1997, city: 'Jorhat', locality: 'Tarajan' };
const pinnedTeacher = await call('auth/signup', { method: 'POST', body: {
  ...member('Jorhat Tutor', 'jorhat-tutor@example.test', 'local-teacher-pass-123', 'teacher', 'rajgarh'),
  homeArea: tutorPin,
} });
equal(pinnedTeacher.status, 201, 'Signup accepts a selected home marker outside Guwahati');
equal(pinnedTeacher.data.homeArea.lat, 26.75, 'Stored teacher coordinates are rounded');
ok(pinnedTeacher.data.homeChangedAt, 'Account records first map selection time');
const pinnedStudent = await call('auth/signup', { method: 'POST', body: {
  ...member('Jorhat Student', 'jorhat-student@example.test', 'local-student-pass-123', 'student', 'rajgarh'),
  homeArea: learnerPin,
} });
equal(pinnedStudent.status, 201, 'Student can select a home pin in another city');
result = await call('workspaces/teacher/listing', {
  method: 'PUT', cookie: pinnedTeacher.cookie,
  body: draft('Jorhat Tutor', 'Math tuition in Jorhat', 'rajgarh', 400),
});
equal(result.status, 200, 'Teacher listing is published at the selected pin');
equal(result.data.location.lng, 94.21, 'Listing uses coarse map coordinates, not legacy locality ID');
result = await call('workspaces/student/discovery', { cookie: pinnedStudent.cookie });
let jorhatQuote = result.data.listings.find(x => x.id === pinnedTeacher.data.id);
ok(jorhatQuote, 'Jorhat teacher is discoverable beyond the initial city catalogue');
ok(jorhatQuote.distance < 3, 'Distance uses the two selected nearby map points');
const movedArea = { lat: 26.63, lng: 92.8, city: 'Tezpur', locality: 'Mission Chariali' };
const pinnedProfile = {
  name: 'Jorhat Student', localityId: 'rajgarh', bio: 'Ready for lessons',
  strongSubjects: [], weakSubjects: ['Mathematics'], qualifications: '', experience: '',
};
result = await call('profile', { method: 'PUT', cookie: pinnedStudent.cookie,
  body: { ...pinnedProfile, homeArea: movedArea } });
equal(result.status, 429, 'API prevents another map move within 30 days');
result = await call('profile', { method: 'PUT', cookie: pinnedStudent.cookie,
  body: { ...pinnedProfile, bio: 'Still learning' } });
equal(result.status, 200, 'Normal profile edits remain available while location is locked');
state.accounts[pinnedStudent.data.id].homeChangedAt =
  new Date(Date.now() - 31 * 86400000).toISOString();
result = await call('profile', { method: 'PUT', cookie: pinnedStudent.cookie,
  body: { ...pinnedProfile, homeArea: movedArea } });
equal(result.status, 200, 'Moving a pin becomes available after rolling 30-day cooldown');
result = await call('workspaces/student/discovery', { cookie: pinnedStudent.cookie });
jorhatQuote = result.data.listings.find(x => x.id === pinnedTeacher.data.id);
equal(jorhatQuote.travelFee, state.pricing.maxTravelFee, 'Distance pricing is recomputed from new city using the current capped travel fee');
equal(result.data.origin.lat, 26.63, 'Discovery origin follows the new home map marker');

console.log('Shikshak platform API checks passed (' + assertions + ' assertions).');
