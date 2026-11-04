export type Role = 'student' | 'teacher';
export type ConnectionStatus = 'incoming' | 'sent' | 'matched';
export interface Point { lat: number; lng: number }
export interface Locality extends Point { id: string; name: string }
export interface Workspace { id: string; role: Role; name: string; initials: string }
export interface ListingDraft {
  name: string;
  headline: string;
  localityId: string;
  subjects: string[];
  grades: string[];
  rate: number;
  availability: string;
  description: string;
  published: boolean;
}
export interface Listing extends ListingDraft {
  id: string;
  role: Role;
  avatar: number;
  color: string;
  locality: string;
  location: Point;
}
export interface DiscoveryListing extends Listing {
  distance: number;
  saved: boolean;
  connection: ConnectionStatus | null;
}
export interface Catalog {
  city: string;
  center: Point;
  defaultLocality: string;
  localities: Locality[];
  subjects: string[];
  grades: string[];
  workspaces: Record<Role, Workspace>;
  demo: boolean;
}
export interface Filters {
  query: string;
  subject: string;
  grade: string;
  locality: string;
  radius: string;
  maxRate: string;
  sort: string;
  saved: boolean;
}
export interface Discovery { listings: DiscoveryListing[]; origin: Point; total: number }
export interface Connection { listing: Listing; status: ConnectionStatus }
export interface Message { id: string; authorId: string; body: string; sentAt: string }
export const defaultFilters: Filters = { query: '', subject: '', grade: '', locality: '', radius: '', maxRate: '', sort: 'distance', saved: false };
