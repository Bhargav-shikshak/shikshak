/**
 * Binary PDF storage for Shikshak's browser-only classroom demo.
 *
 * JSON note metadata remains in localStorage; PDF bytes are separate in
 * IndexedDB, preventing multi-megabyte base64 strings in platform state.
 * IndexedDB is NOT a security boundary. Any script with origin access can read
 * or alter these files. Production must use authenticated server-side storage.
 */
import type { PdfNoteAttachment } from '../../shared/domain';

export const MAX_NOTE_PDF_BYTES = 10 * 1024 * 1024;
const DB_NAME = 'shikshak-browser-note-pdfs-v1';
const STORE_NAME = 'pdfs';

function unavailable(): Error {
  return new Error('PDF storage is not available in this browser. Allow site storage and try again.');
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw unavailable();
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB_NAME, 1); }
    catch { reject(unavailable()); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(unavailable());
    request.onblocked = () => reject(new Error('PDF storage is blocked by another tab. Close other Shikshak tabs and retry.'));
  });
}

function transaction<T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore, accept: (value: T) => void) => void): Promise<T> {
  return openDatabase().then(db => new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(STORE_NAME, mode); }
    catch { db.close(); reject(unavailable()); return; }
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(new Error('Could not save or read the PDF. Browser storage may be full.')); };
    tx.onerror = () => { /* onabort handles transaction failures */ };
    try {
      execute(tx.objectStore(STORE_NAME), value => {
        result = value;
      });
    } catch (error) {
      db.close();
      reject(error);
    }
  }));
}

export async function validatePdfFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.pdf') ||
      (file.type && file.type !== 'application/pdf')) {
    throw new Error('Choose a PDF document (.pdf).');
  }
  if (!file.size || file.size > MAX_NOTE_PDF_BYTES)
    throw new Error('PDF notes must be between 1 byte and 10 MB.');
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...bytes) !== '%PDF-')
    throw new Error('This file does not appear to be a valid PDF.');
}

export async function savePdfNote(file: File): Promise<PdfNoteAttachment> {
  await validatePdfFile(file);
  // Keep the .pdf extension even when the original file name is very long.
  const name = file.name.trim().replace(/[\\/]/g, '').slice(0, -4).slice(0, 136) + '.pdf';
  const pdf: PdfNoteAttachment = {
    id: crypto.randomUUID(),
    name,
    sizeBytes: file.size,
    mimeType: 'application/pdf',
  };
  await transaction<void>('readwrite', (store, accept) => {
    store.put({ id: pdf.id, blob: new Blob([file], { type: 'application/pdf' }) });
    accept(undefined);
  });
  return pdf;
}

export function loadPdfNote(id: string): Promise<Blob | null> {
  return transaction<Blob | null>('readonly', (store, accept) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const blob = req.result?.blob;
      accept(blob instanceof Blob ? blob : null);
    };
  });
}

export function deletePdfNote(id: string): Promise<void> {
  return transaction<void>('readwrite', (store, accept) => {
    store.delete(id);
    accept(undefined);
  });
}

/** Called when all browser-local Shikshak demo state is explicitly reset. */
export async function clearBrowserPdfNotes(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Could not clear local PDF notes.'));
    request.onblocked = () => reject(new Error('Close any other Shikshak tabs before resetting PDF notes.'));
  });
}
