import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck } from 'lucide-react';
import type { Catalog, Listing, ListingDraft, Role } from '../../shared/domain';
import { api } from '../api';
import { ErrorNotice } from './Common';

function blankListing(catalog: Catalog, role: Role): ListingDraft {
  return { name: catalog.workspaces[role].name, headline: '', localityId: catalog.defaultLocality, subjects: [], grades: [],
    rate: 500, availability: '', description: '', published: false };
}

export function ListingEditor({ catalog, role, initial, onSaved }: { catalog: Catalog; role: Role; initial: Listing | null; onSaved: (listing: Listing) => void }) {
  const [draft, setDraft] = useState<ListingDraft>(() => initial ?? blankListing(catalog, role));
  const [published, setPublished] = useState(initial?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof ListingDraft>(field: K, value: ListingDraft[K]) => setDraft((previous) => ({ ...previous, [field]: value }));
  const toggle = (field: 'subjects' | 'grades', value: string) =>
    update(field, draft[field].includes(value) ? draft[field].filter((item) => item !== value) : [...draft[field], value]);
  const isTutor = role === 'teacher';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const visible = action === 'publish';
    if (!draft.subjects.length || !draft.grades.length) { setError('Choose at least one subject and class level.'); return; }
    setBusy(true);
    setError('');
    try {
      const listing = await api.saveListing(role, { ...draft, published: visible });
      setDraft((previous) => previous === draft ? listing : { ...previous, published: listing.published });
      setPublished(listing.published);
      onSaved(listing);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <form className="editor-form" onSubmit={submit}>
    <div className="editor-status"><span className={published ? 'visibility visible' : 'visibility'}>{published ? <Eye size={16}/> : <EyeOff size={16}/>} {published ? 'Visible in discovery' : 'Unpublished listing'}</span></div>
    <div className="form-grid">
      <label>Display name<input required maxLength={60} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder={isTutor ? 'Your name' : 'Your name or family name'}/></label>
      <label>Listing title<input required maxLength={90} value={draft.headline} onChange={(event) => update('headline', event.target.value)} placeholder={isTutor ? 'e.g. Maths & Physics tutor' : 'e.g. Looking for a Class 10 Maths tutor'}/></label>
      <label>Neighbourhood<select required value={draft.localityId} onChange={(event) => update('localityId', event.target.value)}>{catalog.localities.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
      <label>{isTutor ? 'Hourly rate (₹)' : 'Hourly budget (₹)'}<input type="number" min={50} max={10000} step={1} required value={draft.rate || ''} onChange={(event) => update('rate', Number(event.target.value))}/></label>
    </div>
    <fieldset><legend>Subjects</legend><div className="pick-tags">{catalog.subjects.map((subject) => <button key={subject} type="button" aria-pressed={draft.subjects.includes(subject)} onClick={() => toggle('subjects', subject)}>{subject}</button>)}</div></fieldset>
    <fieldset><legend>Class levels</legend><div className="pick-tags">{catalog.grades.map((grade) => <button key={grade} type="button" aria-pressed={draft.grades.includes(grade)} onClick={() => toggle('grades', grade)}>{grade}</button>)}</div></fieldset>
    <label>Availability<input required maxLength={100} value={draft.availability} onChange={(event) => update('availability', event.target.value)} placeholder="e.g. Weekday evenings"/></label>
    <label>{isTutor ? 'About your teaching' : 'What kind of help do you need?'}<textarea required maxLength={700} rows={4} value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder={isTutor ? 'Tell learners about your approach and what you teach.' : 'Share the topics, goals, and schedule you have in mind.'}/></label>
    <div className="notice privacy-note"><ShieldCheck size={20}/><span>Only your neighbourhood is shown on the map. Keep addresses and contact details out of your listing.</span><MapPin size={18}/></div>
    {error && <ErrorNotice message={error}/>}
    <div className="form-actions">
      <button className="primary-button" value="publish" disabled={busy}>{busy ? 'Saving…' : published ? 'Save changes' : 'Publish listing'}<ArrowRight size={17}/></button>
      <button className="secondary-button" value="hide" disabled={busy}>{published ? 'Save and hide listing' : 'Save as draft'}</button>
    </div>
  </form>;
}
