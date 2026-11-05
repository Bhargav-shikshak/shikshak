import type { Catalog, Connection, ConnectionStatus, Discovery, Filters, Listing, ListingDraft, Message, Role } from '../shared/domain';

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const root = (env?.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
const workspace = (role: Role) => '/workspaces/' + role;

async function request<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(root + path, {
      method: options.method, signal: options.signal, credentials: 'include',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('Could not reach Shikshak. Check your connection and try again.');
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok || data === undefined) throw new Error(data?.message ?? 'The Shikshak API could not complete this request.');
  return data as T;
}

export const api = {
  catalog: (signal?: AbortSignal) => request<Catalog>('/catalog', { signal }),
  discover: (role: Role, filters: Filters, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
    return request<Discovery>(workspace(role) + '/discovery?' + params, { signal });
  },
  listing: (role: Role, signal?: AbortSignal) => request<Listing | null>(workspace(role) + '/listing', { signal }),
  saveListing: (role: Role, listing: ListingDraft) => request<Listing>(workspace(role) + '/listing', { method: 'PUT', body: listing }),
  save: (role: Role, id: string, saved: boolean) =>
    request<{ saved: boolean }>(workspace(role) + '/listings/' + encodeURIComponent(id) + '/save', { method: 'PUT', body: { saved } }),
  interest: (role: Role, id: string) =>
    request<{ status: ConnectionStatus }>(workspace(role) + '/listings/' + encodeURIComponent(id) + '/interest', { method: 'PUT' }),
  connections: (role: Role, signal?: AbortSignal) => request<Connection[]>(workspace(role) + '/connections', { signal }),
  messages: (role: Role, id: string, signal?: AbortSignal) =>
    request<Message[]>(workspace(role) + '/connections/' + encodeURIComponent(id) + '/messages', { signal }),
  send: (role: Role, id: string, body: string, messageId: string) =>
    request<Message>(workspace(role) + '/connections/' + encodeURIComponent(id) + '/messages', { method: 'POST', body: { body, id: messageId } }),
};
