import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck } from 'lucide-react';
import type { Catalog, Listing, ListingDraft, PublicAccount, Role } from '../../shared/domain';
import { api } from '../api';
import { ErrorNotice } from './Common';

function blankListing(catalog: Catalog, role: Role, account: PublicAccount): ListingDraft {
  return {
    name: account.name, headline: '', localityId: account.localityId,
    subjects: [], grades: [], rate: 500,
    availability: '', description: '', published: false,
  };
}
export function ListingEditor({ catalog, role, account, initial, onSaved }: {
  catalog: Catalog; role: Role; account: PublicAccount; initial: Listing | null; onSaved: (listing: Listing) => void;
}) {
  const [draft, setDraft] = useState<ListingDraft>(() => initial ?? blankListing(catalog, role, account));
  const [published, setPublished] = useState(initial?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof ListingDraft>(field: K, value: ListingDraft[K]) => setDraft(previous => ({ ...previous, [field]: value }));
  const toggle = (field: 'subjects' | 'grades', value: string) =>
    update(field, draft[field].includes(value) ? draft[field].filter(item => item !== value) : [...draft[field], value]);
  const isTutor = role === 'teacher';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const visible = action === 'publish';
    if (!draft.subjects.length || !draft.grades.length) { setError('Choose at least one subject and class level.'); return; }
    setBusy(true); setError('');
    try {
      const listing = await api.saveListing(role, { ...draft, published: visible });
      setDraft(listing);
      setPublished(listing.published);
      onSaved(listing);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <form className="editor-form" onSubmit={submit}>
    <div className="editor-status"><span className={published ? 'visibility visible' : 'visibility'}>
      {published ? <Eye size={16}/> : <EyeOff size={16}/>} {published ? (isTutor && !account.teacherVerified ? 'Awaiting teacher verification' : 'Visible in discovery') : 'Unpublished listing'}
    </span></div>
    <div className="form-grid">
      <label>Display name<input disabled value={account.name} title="Change your name in Profile"/></label>
      <label>Listing title<input required maxLength={90} value={draft.headline} onChange={event => update('headline', event.target.value)}
        placeholder={isTutor ? 'e.g. Maths & Physics tutor' : 'e.g. Looking for a Class 10 Maths tutor'}/></label>
      <label>Home neighbourhood<input disabled value={account.homeArea ? account.homeArea.locality + ', ' + account.homeArea.city : (catalog.localities.find(area => area.id === account.localityId)?.name ?? account.localityId)} title="Change your area in Profile"/></label>
      {isTutor ? <label>Your hourly teaching rate (₹)<input type="number" required min={100} max={10000} step={1} value={draft.rate || ''} onChange={event => update('rate', Number(event.target.value))}/>
        <small className="field-help">You set your own base rate. Students see distance-adjusted quotes. Your listing will be discoverable after an administrator verifies your teacher account.</small></label>
        : <label>Your hourly budget (₹)<input type="number" min={50} max={10000} step={1} required value={draft.rate || ''}
          onChange={event => update('rate', Number(event.target.value))}/></label>}
    </div>
    <fieldset><legend>{isTutor ? 'Subjects you teach' : 'Subjects you need help with'}</legend>
      <div className="pick-tags">{catalog.subjects.map(subject => <button key={subject} type="button" aria-pressed={draft.subjects.includes(subject)} onClick={() => toggle('subjects', subject)}>{subject}</button>)}</div>
    </fieldset>
    <fieldset><legend>Class levels</legend>
      <div className="pick-tags">{catalog.grades.map(grade => <button key={grade} type="button" aria-pressed={draft.grades.includes(grade)} onClick={() => toggle('grades', grade)}>{grade}</button>)}</div>
    </fieldset>
    <label>Availability<input required maxLength={100} value={draft.availability} onChange={event => update('availability', event.target.value)} placeholder="e.g. Weekday evenings"/></label>
    <label>{isTutor ? 'About your teaching' : 'What kind of help do you need?'}<textarea required maxLength={700} rows={4} value={draft.description}
      onChange={event => update('description', event.target.value)} placeholder={isTutor ? 'Describe your approach and what you teach.' : 'Share your goals and the schedule you have in mind.'}/></label>
    {!isTutor && <p className="field-help">You can also record your stronger and weaker subjects in Profile. Only you can see your learning profile until you request a class.</p>}
    <div className="notice privacy-note"><ShieldCheck size={20}/><span>Only your neighbourhood is shown on the map. Do not include your address, phone or private contact details.</span><MapPin size={18}/></div>
    {error && <ErrorNotice message={error}/>}
    <div className="form-actions">
      <button className="primary-button" type="submit" value="publish" disabled={busy}>{busy ? 'Saving…' : published ? 'Save changes' : 'Submit listing'}<ArrowRight size={17}/></button>
      <button className="secondary-button" type="submit" value="hide" disabled={busy}>{published ? 'Save and hide listing' : 'Save as draft'}</button>
    </div>
  </form>;
}
