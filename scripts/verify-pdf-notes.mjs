import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Small asynchronous IndexedDB test double: enough to exercise the browser
// binary-storage contract without adding a runtime dependency.
const documents = new Map();
const db = {
  objectStoreNames: { contains: () => false },
  createObjectStore() {},
  close() {},
  transaction() {
    const tx = {
      oncomplete: null, onabort: null, onerror: null,
      objectStore() {
        return {
          put(value) {
            documents.set(value.id, value);
            queueMicrotask(() => tx.oncomplete?.());
          },
          get(id) {
            const req = { result: null, onsuccess: null };
            queueMicrotask(() => {
              req.result = documents.get(id);
              req.onsuccess?.();
              queueMicrotask(() => tx.oncomplete?.());
            });
            return req;
          },
          delete(id) {
            documents.delete(id);
            queueMicrotask(() => tx.oncomplete?.());
          },
        };
      },
    };
    return tx;
  },
};
globalThis.indexedDB = {
  open() {
    const request = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  },
  deleteDatabase() {
    const request = { onsuccess: null, onerror: null };
    queueMicrotask(() => {
      documents.clear();
      request.onsuccess?.();
    });
    return request;
  },
};
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.fetch = () => { throw new Error('The local demo may not call the network.'); };

async function load(entry) {
  const output = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    write: false,
    logLevel: 'silent',
  });
  const url = 'data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].contents).toString('base64');
  return import(url);
}

const { api, isBrowserDemo } = await load('src/api.ts');
const { clearBrowserPdfNotes, validatePdfFile } = await load('src/services/pdfNotes.ts');
assert.equal(isBrowserDemo, true);
const password = 'ShikshakDemo2026!';
const catalog = await api.catalog();
assert.ok(catalog.subjects.includes('Mathematics'));

const teacher = await api.login('teacher@shikshak.demo', password);
const studentEmail = 'student@shikshak.demo';
const classrooms = await api.classrooms('teacher');
assert.equal(classrooms.length, 1);
const studentId = classrooms[0].classroom.studentId;
const teacherId = teacher.id;
const pdfBytes = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';
const validFile = new File([pdfBytes], 'Algebra handout.pdf', { type: 'application/pdf' });

await validatePdfFile(validFile);
await assert.rejects(() => validatePdfFile(new File(['hi'], 'not-a-pdf.pdf', { type: 'application/pdf' })), /valid PDF/);
await assert.rejects(() => validatePdfFile(new File([pdfBytes], 'document.txt', { type: 'text/plain' })), /Choose a PDF/);
await assert.rejects(() => validatePdfFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })), /10 MB/);

const note = await api.sharePdfNote('teacher', studentId, 'Algebra handout', '', validFile);
assert.ok(note.id && note.pdf?.id);
assert.equal(note.pdf.name, 'Algebra handout.pdf');
assert.equal(note.pdf.sizeBytes, validFile.size);
assert.equal(documents.size, 1, 'PDF bytes should be saved in IndexedDB');
const rawState = storage.get('shikshak.browser-pilot.v1');
assert.ok(rawState.includes('Algebra handout.pdf'), 'Note metadata should be in local JSON state');
assert.ok(!rawState.includes(pdfBytes), 'Binary PDF contents must not be written to localStorage');

const teacherBlob = await api.getNotePdf('teacher', studentId, note.id);
assert.equal(await teacherBlob.text(), pdfBytes);

await api.logout();
const student = await api.login(studentEmail, password);
assert.equal(student.role, 'student');
const room = await api.classroom('student', teacherId);
assert.ok(room.notes.some(x => x.id === note.id && x.pdf?.name === 'Algebra handout.pdf'), 'Student sees PDF note metadata');
const studentBlob = await api.getNotePdf('student', teacherId, note.id);
assert.equal(await studentBlob.text(), pdfBytes, 'Student can open the same PDF bytes');
await assert.rejects(() => api.sharePdfNote('student', teacherId, 'Blocked', '', validFile), /Only teachers/);

await api.logout();
await api.login('rohan@shikshak.demo', password);
await assert.rejects(() => api.getNotePdf('student', teacherId, note.id), /classroom|match|permission|feature|not found|403/i, 'Unmatched student cannot view notes');

await api.logout();
await api.login('teacher@shikshak.demo', password);
const textOnly = await api.note('teacher', studentId, 'Ordinary text notes', 'No PDF attached');
assert.equal(textOnly.content, 'No PDF attached');
assert.equal(textOnly.pdf, undefined, 'Existing text notes remain compatible');

await clearBrowserPdfNotes();
assert.equal(documents.size, 0, 'Reset clears PDF bytes');
await assert.rejects(() => api.getNotePdf('teacher', studentId, note.id), /not found in this browser/i, 'Cleared PDFs show an actionable error');
console.log('PDF notes verified: file validation, IndexedDB blob persistence, matched teacher/student access, blocked unpaired access, text-note compatibility and cleanup.');
