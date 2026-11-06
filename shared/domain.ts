export type Role = 'student' | 'teacher';
export type AccountRole = Role | 'admin' | 'owner';
export type BookingStatus = 'pending' | 'accepted' | 'rejected';
/** Legacy mutual-interest statuses are retained only for old local data migrations. */
export type ConnectionStatus = 'incoming' | 'sent' | 'matched';
export interface Point { lat: number; lng: number }
/** Only a coarse neighbourhood-level point is kept. Never store household coordinates. */
export interface HomeArea extends Point {
  city: string;
  locality: string;
}
export interface Locality extends Point { id: string; name: string }
export interface Workspace { id: string; role: Role; name: string; initials: string }
export interface PublicAccount {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
  localityId: string;
  homeArea?: HomeArea;
  homeChangedAt?: string | null;
  bio: string;
  strongSubjects: string[];
  weakSubjects: string[];
  qualifications: string;
  experience: string;
  active: boolean;
  teacherVerified?: boolean;
  createdAt: string;
}
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
  strongSubjects?: string[];
  weakSubjects?: string[];
  qualifications?: string;
  experience?: string;
  teacherVerified?: boolean;
  fictional?: boolean;
}
export interface DiscoveryListing extends Listing {
  distance: number;
  saved: boolean;
  connection: BookingStatus | null;
  baseRate?: number;
  travelFee?: number;
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
/** Only these booking details are disclosed to the receiving tutor. */
export interface BookingRequest {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  teacherName: string;
  subject: string;
  grade: string;
  startsAt: string;
  durationMinutes: number;
  note: string;
  quotedRate: number;
  status: BookingStatus;
  createdAt: string;
  respondedAt: string | null;
}
export interface Connection { listing: Listing; status: ConnectionStatus }
export interface Message { id: string; authorId: string; body: string; sentAt: string }
export interface PriceSettings {
  freeRadiusKm: number;
  distanceStepKm: number;
  stepFee: number;
  maxTravelFee: number;
}
export interface ClassSession {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}
export interface PdfNoteAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: 'application/pdf';
}
export interface LessonNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  /** Browser demo: PDF bytes live in IndexedDB, separately from JSON metadata. */
  pdf?: PdfNoteAttachment;
}
export interface Homework {
  id: string;
  title: string;
  instructions: string;
  dueAt: string;
  createdAt: string;
  /** Optional PDF worksheet attached by the teacher. */
  assignmentPdf?: PdfNoteAttachment;
  submission: string;
  /** Optional PDF answer sheet attached by the student. */
  submissionPdf?: PdfNoteAttachment;
  submittedAt: string | null;
  review: string;
  reviewedAt: string | null;
}
export interface Classroom {
  studentId: string;
  teacherId: string;
  sessions: ClassSession[];
  notes: LessonNote[];
  homework: Homework[];
}
export interface ClassroomSummary {
  partner: Listing;
  classroom: Classroom;
}
export interface AdminSnapshot {
  accounts: PublicAccount[];
  settings: PriceSettings;
  publishedListings: number;
  matchedPairs: number;
  pendingVerifications?: number;
  viewerRole?: 'owner' | 'admin';
}
export const defaultFilters: Filters = { query: '', subject: '', grade: '', locality: '', radius: '', maxRate: '', sort: 'distance', saved: false };
