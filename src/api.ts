import type {
  AdminSnapshot, Catalog, ClassSession, Classroom, ClassroomSummary, Connection,
  ConnectionStatus, Discovery, Filters, Homework, LessonNote, Listing, ListingDraft,
  Message, PdfNoteAttachment, PriceSettings, PublicAccount, Role,
} from '../shared/domain';

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const root = (env?.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
// Local browser demonstration is the default until a real backend is connected.
// Set VITE_SERVICE_MODE=api to use the existing Cloudflare/HTTP API instead.
export const isBrowserDemo = env?.VITE_SERVICE_MODE !== 'api';
const workspace = (role: Role) => '/workspaces/' + role;
const roomPath = (role: Role, partnerId: string) =>
  workspace(role) + '/connections/' + encodeURIComponent(partnerId) + '/classroom';

async function request<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = isBrowserDemo
      ? await (await import('./services/browserDemo')).browserDemoRequest(path, options)
      : await fetch(root + path, {
          method: options.method,
          signal: options.signal,
          credentials: 'include',
          headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('Could not reach Shikshak. Check your connection and try again.');
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok || data === undefined)
    throw new Error(data?.message ?? 'The Shikshak API could not complete this request.');
  return data as T;
}
export interface Registration {
  name: string; email: string; password: string; role: Role;
  localityId: string;
}
export interface ProfileInput {
  name: string; localityId: string; bio: string;
  strongSubjects: string[]; weakSubjects: string[];
  qualifications: string; experience: string;
}
export const api = {
  catalog: (signal?: AbortSignal) => request<Catalog>('/catalog', { signal }),
  me: (signal?: AbortSignal) => request<PublicAccount>('/auth/me', { signal }),
  signup: (data: Registration) => request<PublicAccount>('/auth/signup', { method: 'POST', body: data }),
  login: (email: string, password: string) =>
    request<PublicAccount>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  bootstrapAdmin: (data: Omit<Registration, 'role'> & { setupToken: string }) =>
    request<PublicAccount>('/admin/bootstrap', { method: 'POST', body: data }),
  profile: (data: ProfileInput) => request<PublicAccount>('/profile', { method: 'PUT', body: data }),
  requestRate: (rate: number) => request<PublicAccount>('/profile/request-rate', { method: 'POST', body: { rate } }),

  discover: (role: Role, filters: Filters, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
    return request<Discovery>(workspace(role) + '/discovery?' + params, { signal });
  },
  listing: (role: Role, signal?: AbortSignal) => request<Listing | null>(workspace(role) + '/listing', { signal }),
  saveListing: (role: Role, listing: ListingDraft) =>
    request<Listing>(workspace(role) + '/listing', { method: 'PUT', body: listing }),
  save: (role: Role, id: string, saved: boolean) =>
    request<{ saved: boolean }>(workspace(role) + '/listings/' + encodeURIComponent(id) + '/save', { method: 'PUT', body: { saved } }),
  interest: (role: Role, id: string) =>
    request<{ status: ConnectionStatus }>(workspace(role) + '/listings/' + encodeURIComponent(id) + '/interest', { method: 'PUT' }),
  connections: (role: Role, signal?: AbortSignal) =>
    request<Connection[]>(workspace(role) + '/connections', { signal }),
  messages: (role: Role, id: string, signal?: AbortSignal) =>
    request<Message[]>(workspace(role) + '/connections/' + encodeURIComponent(id) + '/messages', { signal }),
  send: (role: Role, id: string, body: string, messageId: string) =>
    request<Message>(workspace(role) + '/connections/' + encodeURIComponent(id) + '/messages', { method: 'POST', body: { body, id: messageId } }),
  classrooms: (role: Role, signal?: AbortSignal) =>
    request<ClassroomSummary[]>(workspace(role) + '/classrooms', { signal }),
  classroom: (role: Role, partnerId: string, signal?: AbortSignal) =>
    request<Classroom>(roomPath(role, partnerId), { signal }),
  schedule: (role: Role, partnerId: string, data: { title: string; startsAt: string; durationMinutes: number }) =>
    request<ClassSession>(roomPath(role, partnerId) + '/sessions', { method: 'POST', body: data }),
  sessionStatus: (role: Role, partnerId: string, id: string, status: 'completed' | 'cancelled') =>
    request<ClassSession>(roomPath(role, partnerId) + '/sessions/' + encodeURIComponent(id) + '/status', { method: 'PUT', body: { status } }),
  note: (role: Role, partnerId: string, title: string, content: string, pdf?: PdfNoteAttachment) =>
    request<LessonNote>(roomPath(role, partnerId) + '/notes', {
      method: 'POST', body: { title, content, ...(pdf ? { pdf } : {}) },
    }),
  sharePdfNote: async (role: Role, partnerId: string, title: string, content: string, file: File): Promise<LessonNote> => {
    if (!isBrowserDemo) throw new Error('PDF uploads will be available in API mode after secure file storage is connected.');
    if (role !== 'teacher') throw new Error('Only teachers can share PDF notes.');
    // Verify an active teacher/student match before writing binary data.
    await api.classroom(role, partnerId);
    const storage = await import('./services/pdfNotes');
    const pdf = await storage.savePdfNote(file);
    try {
      return await api.note(role, partnerId, title, content, pdf);
    } catch (error) {
      await storage.deletePdfNote(pdf.id).catch(() => undefined);
      throw error;
    }
  },
  getNotePdf: async (role: Role, partnerId: string, noteId: string): Promise<Blob> => {
    if (!isBrowserDemo) throw new Error('PDF viewing requires integrated backend file storage.');
    // Authorize the current account against the actual matched classroom.
    const room = await api.classroom(role, partnerId);
    const pdf = room.notes.find(note => note.id === noteId)?.pdf;
    if (!pdf) throw new Error('This classroom note has no PDF attached.');
    const { loadPdfNote } = await import('./services/pdfNotes');
    const blob = await loadPdfNote(pdf.id);
    if (!blob) throw new Error('PDF not found in this browser. It may have been cleared from site storage.');
    return blob;
  },
  assign: (role: Role, partnerId: string, title: string, instructions: string, dueAt: string) =>
    request<Homework>(roomPath(role, partnerId) + '/homework', { method: 'POST', body: { title, instructions, dueAt } }),
  submitHomework: (role: Role, partnerId: string, id: string, submission: string) =>
    request<Homework>(roomPath(role, partnerId) + '/homework/' + encodeURIComponent(id) + '/submit', { method: 'PUT', body: { submission } }),
  reviewHomework: (role: Role, partnerId: string, id: string, review: string) =>
    request<Homework>(roomPath(role, partnerId) + '/homework/' + encodeURIComponent(id) + '/review', { method: 'PUT', body: { review } }),

  admin: (signal?: AbortSignal) => request<AdminSnapshot>('/admin', { signal }),
  setPricing: (data: PriceSettings) => request<PriceSettings>('/admin/pricing', { method: 'PUT', body: data }),
  adminAction: (userId: string, action: 'approve' | 'reject' | 'suspend' | 'activate' | 'hide') => {
    const suffix = action === 'approve' || action === 'reject' ? 'rate' : action === 'hide' ? 'listing' : 'status';
    return request<PublicAccount>('/admin/accounts/' + encodeURIComponent(userId) + '/' + suffix, { method: 'PUT', body: { action } });
  },
};
