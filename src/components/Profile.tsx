import { useCallback, useState, type FormEvent } from 'react';
import { BookOpen, GraduationCap, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import type { Catalog, PublicAccount, Role } from '../../shared/domain';
import { useResource } from '../useResource';
import { api, type ProfileInput } from '../api';
import { ErrorNotice, money } from './Common';

export function Profile({ catalog, account, onUpdated, openListing, openClassroom }: {
  catalog: Catalog;
  account: PublicAccount;
  onUpdated: (account: PublicAccount) => void;
  openListing: () => void;
  openClassroom: (id: string) => void;
}) {
  const isTeacher = account.role === 'teacher';
  const role: Role = isTeacher ? 'teacher' : 'student';
  const activity = useResource(useCallback((signal: AbortSignal) => api.classrooms(role, signal), [role]));
  const classrooms = activity.data ?? [];
  const upcoming = classrooms.flatMap(room => room.classroom.sessions.filter(lesson => lesson.status === 'scheduled' && Date.parse(lesson.startsAt) >= Date.now()).map(lesson => ({ ...lesson, partner: room.partner }))).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const homework = classrooms.flatMap(room => room.classroom.homework.map(task => ({ ...task, partner: room.partner })));
  const pending = homework.filter(task => isTeacher ? !!task.submittedAt && !task.reviewedAt : !task.submittedAt);
  const studentUpdates = [...homework].filter(task => !!task.submittedAt).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const sharedNotes = classrooms.reduce((count, room) => count + room.classroom.notes.length, 0);
  const [draft, setDraft] = useState<ProfileInput>({
    name: account.name, localityId: account.localityId, bio: account.bio,
    strongSubjects: account.strongSubjects, weakSubjects: account.weakSubjects,
    qualifications: account.qualifications, experience: account.experience,
  });
  const [price, setPrice] = useState(String(account.requestedRate ?? account.approvedRate ?? 500));
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(key: 'strongSubjects' | 'weakSubjects', subject: string) {
    const other = key === 'strongSubjects' ? 'weakSubjects' : 'strongSubjects';
    setDraft(previous => ({
      ...previous,
      [key]: previous[key].includes(subject)
        ? previous[key].filter(x => x !== subject)
        : [...previous[key], subject],
      [other]: previous[other].filter(x => x !== subject),
    }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    setError('');
    try { onUpdated(await api.profile(draft)); setStatus('Your profile has been updated.'); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function requestPrice() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await api.requestRate(Number(price));
      onUpdated(result);
      setStatus('Your requested rate was sent for admin review. Your current approved/platform rate remains in effect.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <main id="main" className="workspace-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> YOUR SHIKSHAK IDENTITY</p>
      <h1>My profile.</h1><p>Manage what your future {isTeacher ? 'students' : 'tutors'} know about you.</p></div>
    <div className="profile-layout">
      <section className="workspace-panel">
        <div className="profile-identity"><div className="profile-monogram">{account.name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}</div><div><h2>{account.name}</h2><p>{isTeacher ? 'Teacher' : 'Student'} · {account.email}</p></div></div>
        <form className="editor-form" onSubmit={save}>
          <div className="form-grid">
            <label>Display name<input required maxLength={60} value={draft.name} onChange={event => setDraft(v => ({ ...v, name: event.target.value }))}/></label>
            <label>Home neighbourhood<select value={draft.localityId} onChange={event => setDraft(v => ({ ...v, localityId: event.target.value }))}>{catalog.localities.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          </div>
          <label>About me<textarea rows={4} maxLength={700} value={draft.bio} placeholder={isTeacher ? 'Your teaching approach and interests' : 'Your learning interests and goals'} onChange={event => setDraft(v => ({ ...v, bio: event.target.value }))}/></label>
          {isTeacher ? <>
            <label>Qualifications<input maxLength={180} value={draft.qualifications} placeholder="e.g. BSc Mathematics" onChange={event => setDraft(v => ({ ...v, qualifications: event.target.value }))}/></label>
            <label>Teaching experience<input maxLength={180} value={draft.experience} placeholder="e.g. 3 years of tutoring" onChange={event => setDraft(v => ({ ...v, experience: event.target.value }))}/></label>
          </> : <>
            <fieldset><legend>My stronger subjects</legend><p className="field-help">Show teachers what you feel confident about.</p>
              <div className="pick-tags">{catalog.subjects.map(subject => <button key={subject} type="button" aria-pressed={draft.strongSubjects.includes(subject)} onClick={() => toggle('strongSubjects', subject)}>{subject}</button>)}</div>
            </fieldset>
            <fieldset><legend>Subjects I want help with</legend><p className="field-help">Teachers can use these to decide whether they're a good fit.</p>
              <div className="pick-tags">{catalog.subjects.map(subject => <button key={subject} type="button" aria-pressed={draft.weakSubjects.includes(subject)} onClick={() => toggle('weakSubjects', subject)}>{subject}</button>)}</div>
            </fieldset>
          </>}
          <div className="notice privacy-note"><MapPin size={18}/><span>Only an approximate neighbourhood is shown publicly. Do not enter a street address.</span></div>
          {error && <ErrorNotice message={error}/>}
          {status && <p className="form-success" role="status">{status}</p>}
          <div className="form-actions"><button type="submit" disabled={busy} className="primary-button">{busy ? 'Saving…' : 'Save profile'}</button><button type="button" className="secondary-button" onClick={openListing}>Manage my listing</button></div>
        </form>
      </section>
      <aside className="profile-aside-stack">
        <section className="workspace-aside profile-activity">
          <span className="aside-icon"><BookOpen size={22}/></span><h2>{isTeacher ? 'Teaching activity' : 'Learning activity'}</h2>
          {activity.error && <ErrorNotice message={activity.error} retry={activity.refresh}/>}
          {!activity.data && !activity.error && <p>Loading your latest activity…</p>}
          <div className="profile-activity-metrics">
            <div><strong>{classrooms.length}</strong><span>{isTeacher ? 'Students' : 'Tutors'}</span></div>
            <div><strong>{upcoming.length}</strong><span>Classes ahead</span></div>
            <div><strong>{pending.length}</strong><span>{isTeacher ? 'To review' : 'To submit'}</span></div>
            <div><strong>{sharedNotes}</strong><span>Shared notes</span></div>
          </div>
          <h3>Next class</h3>
          {upcoming.length ? <button type="button" className="profile-activity-link" onClick={() => openClassroom(upcoming[0].partner.id)}>
            <strong>{upcoming[0].title}</strong><small>{upcoming[0].partner.name} · {new Date(upcoming[0].startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          </button> : <p>No upcoming classes scheduled.</p>}
          {isTeacher ? <>
            <h3>Recent student updates</h3>
            {studentUpdates.length ? studentUpdates.slice(0, 3).map(task => <button key={task.id} type="button" className="profile-activity-link" onClick={() => openClassroom(task.partner.id)}>
              <strong>{task.partner.name}: {task.title}</strong><small>{task.reviewedAt ? 'Feedback shared' : 'Needs your review'}</small>
            </button>) : <p>New student submissions will appear here.</p>}
          </> : <>
            <h3>Your next action</h3>
            {pending.length ? pending.slice(0, 3).map(task => <button key={task.id} type="button" className="profile-activity-link" onClick={() => openClassroom(task.partner.id)}>
              <strong>{task.title}</strong><small>Due {new Date(task.dueAt).toLocaleDateString('en-IN')} · {task.partner.name}</small>
            </button>) : <p>No pending homework.</p>}
          </>}
        </section>
        <section className="workspace-aside"><span className="aside-icon"><UserRound size={22}/></span><h2>Your account</h2><p><strong>Role:</strong> {isTeacher ? 'Teacher' : 'Student'}</p><p><strong>Area:</strong> {catalog.localities.find(x => x.id === account.localityId)?.name ?? catalog.city}</p><p>Your dashboard shows upcoming classes and tasks after matching.</p></section>
        {isTeacher && <section className="workspace-aside">
          <span className="aside-icon"><GraduationCap size={22}/></span><h2>Hourly teaching rate</h2>
          <p>Platform pricing applies by default, with a distance-based travel supplement for students.</p>
          <p><strong>Approved base:</strong> {account.approvedRate === null ? 'Platform rate' : money(account.approvedRate) + ' / hr'}</p>
          <p><strong>Request status:</strong> {account.rateStatus === 'none' ? 'No request' : account.rateStatus}</p>
          <label className="rate-request">Propose your own base rate (₹/hr)<input type="number" min={100} max={10000} step={1} value={price} onChange={event => setPrice(event.target.value)}/></label>
          <button type="button" disabled={busy} className="secondary-button" onClick={() => void requestPrice()}>Request admin approval</button>
          <p className="aside-note"><ShieldCheck size={14}/> Requested rates do not become public until approved by an administrator.</p>
        </section>}
        {!isTeacher && <section className="workspace-aside"><span className="aside-icon"><BookOpen size={22}/></span><h2>Learning at your pace</h2><p>Set stronger and weaker subjects so nearby tutors can understand your needs before matching.</p></section>}
      </aside>
    </div>
  </main>;
}
