import { useCallback, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock3, ClipboardList, FileUp, MessageCircle, NotebookPen, Send, X } from 'lucide-react';
import type { Homework, Role } from '../../shared/domain';
import { api, isBrowserDemo } from '../api';
import { PdfNoteLinks } from './PdfNoteLinks';
import { useResource } from '../useResource';
import { ErrorNotice } from './Common';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const futureLocal = () => {
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Date(next.getTime() - next.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function Classroom({ role, partnerId, back, message }: {
  role: Role; partnerId: string; back: () => void; message: (id: string) => void;
}) {
  const load = useCallback((signal: AbortSignal) => api.classroom(role, partnerId, signal), [role, partnerId]);
  const { data, error, refresh } = useResource(load);
  const peers = useResource(useCallback((signal: AbortSignal) => api.connections(role, signal), [role]));
  const peer = peers.data?.find(connection => connection.listing.id === partnerId)?.listing;
  const [section, setSection] = useState<'classes' | 'notes' | 'homework'>('classes');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [classTitle, setClassTitle] = useState('');
  const [classDate, setClassDate] = useState(futureLocal);
  const [duration, setDuration] = useState(60);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [notePdf, setNotePdf] = useState<File | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState(futureLocal);
  const [responses, setResponses] = useState<Record<string, string>>({});

  async function mutate(key: string, action: () => Promise<unknown>, description: string) {
    if (busy) return;
    setBusy(key); setActionError(''); setSuccess('');
    try {
      await action();
      setSuccess(description);
      refresh();
    } catch (cause) { setActionError((cause as Error).message); }
    finally { setBusy(''); }
  }
  function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classTitle.trim() || !classDate) return;
    void mutate('class', async () => {
      await api.schedule(role, partnerId, { title: classTitle, startsAt: new Date(classDate).toISOString(), durationMinutes: duration });
      setClassTitle('');
    }, 'Class scheduled.');
  }
  function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteTitle.trim() || (!noteBody.trim() && !notePdf)) return;
    void mutate('note', async () => {
      if (notePdf) await api.sharePdfNote(role, partnerId, noteTitle, noteBody, notePdf);
      else await api.note(role, partnerId, noteTitle, noteBody);
      setNoteTitle(''); setNoteBody(''); setNotePdf(null);
      if (pdfInput.current) pdfInput.current.value = '';
    }, notePdf ? 'PDF and study notes shared.' : 'Study notes shared.');
  }
  function createHomework(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!homeworkTitle.trim() || !instructions.trim() || !dueAt) return;
    void mutate('homework', async () => {
      await api.assign(role, partnerId, homeworkTitle, instructions, new Date(dueAt).toISOString());
      setHomeworkTitle(''); setInstructions('');
    }, 'Homework assigned.');
  }
  function homeworkAction(homework: Homework) {
    const content = (responses[homework.id] ?? '').trim();
    if (!content) { setActionError('Enter your submission or feedback first.'); return; }
    if (role === 'teacher')
      void mutate(homework.id, () => api.reviewHomework(role, partnerId, homework.id, content), 'Feedback shared with the student.');
    else
      void mutate(homework.id, () => api.submitHomework(role, partnerId, homework.id, content), 'Homework submitted for review.');
  }
  const sortedSessions = [...(data?.sessions ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const sortedHomework = [...(data?.homework ?? [])].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return <main id="main" className="workspace-page classroom-page">
    <div className="classroom-topbar">
      <button type="button" className="secondary-button" onClick={back}><ArrowLeft size={17}/> Back to matches</button>
      <button type="button" className="secondary-button" onClick={() => message(partnerId)}><MessageCircle size={17}/> Messages</button>
    </div>
    <div className="workspace-heading">
      <p className="eyebrow hero-eyebrow"><span/> SHARED LEARNING SPACE</p>
      <h1>{peer ? peer.name : 'Your classroom'}.</h1>
      <p>{role === 'teacher' ? 'Schedule classes, share notes and review your student’s homework.' : 'See your timetable, read notes and turn in homework for feedback.'} Only matched accounts can access this classroom.</p>
    </div>
    {error && <ErrorNotice message={error} retry={refresh}/>}
    {peers.error && <ErrorNotice message={peers.error} retry={peers.refresh}/>}
    {actionError && <ErrorNotice message={actionError}/>}
    {success && <p className="form-success" role="status">{success}</p>}
    {!data && !error && <p role="status">Opening classroom…</p>}
    {data && <>
      <div className="classroom-summary">
        <div><CalendarDays size={19}/><strong>{data.sessions.filter(x => x.status === 'scheduled').length}</strong><span>Scheduled classes</span></div>
        <div><NotebookPen size={19}/><strong>{data.notes.length}</strong><span>Shared notes</span></div>
        <div><ClipboardList size={19}/><strong>{data.homework.length}</strong><span>Assignments</span></div>
      </div>
      <div className="classroom-tabs" aria-label="Classroom sections">
        <button type="button" aria-pressed={section === 'classes'} onClick={() => setSection('classes')}><CalendarDays size={18}/> Classes</button>
        <button type="button" aria-pressed={section === 'notes'} onClick={() => setSection('notes')}><BookOpen size={18}/> Notes</button>
        <button type="button" aria-pressed={section === 'homework'} onClick={() => setSection('homework')}><ClipboardList size={18}/> Homework</button>
      </div>
      <div className="classroom-columns">
        {section === 'classes' && <>
          <section className="workspace-panel">
            <h2>Class schedule</h2>
            {sortedSessions.length === 0 && <p className="classroom-empty">Nothing scheduled yet. The teacher can add the first lesson.</p>}
            {sortedSessions.map(session => <article key={session.id} className="classroom-item">
              <div className="classroom-item-heading"><h3>{session.title}</h3><span className={'lesson-status ' + session.status}>{session.status}</span></div>
              <p><CalendarDays size={16}/>{when(session.startsAt)} · {session.durationMinutes} minutes</p>
              {role === 'teacher' && session.status === 'scheduled' && <div className="classroom-actions">
                <button type="button" className="secondary-button" disabled={!!busy} onClick={() => void mutate(session.id, () => api.sessionStatus(role, partnerId, session.id, 'completed'), 'Class marked complete.')}><CheckCircle2 size={16}/> Mark complete</button>
                <button type="button" className="text-button" disabled={!!busy} onClick={() => void mutate(session.id, () => api.sessionStatus(role, partnerId, session.id, 'cancelled'), 'Class cancelled.')}>Cancel class</button>
              </div>}
            </article>)}
          </section>
          <aside className="workspace-panel">
            {role === 'teacher' ? <>
              <h2>Schedule a class</h2>
              <form className="editor-form classroom-form" onSubmit={createClass}>
                <label>Lesson title<input required maxLength={90} value={classTitle} onChange={event => setClassTitle(event.target.value)} placeholder="e.g. Algebra revision"/></label>
                <label>Date and time<input required type="datetime-local" value={classDate} onChange={event => setClassDate(event.target.value)}/></label>
                <label>Duration<select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option><option value={120}>120 minutes</option></select></label>
                <button type="submit" className="primary-button" disabled={!!busy}>Schedule lesson</button>
              </form>
            </> : <><h2>Plan ahead</h2><p className="admin-intro">Your tutor schedules classes here. Use Messages if you need a different day or time.</p><button type="button" className="secondary-button" onClick={() => message(partnerId)}>Message your tutor</button></>}
          </aside>
        </>}
        {section === 'notes' && <>
          <section className="workspace-panel">
            <h2>Shared lesson notes</h2>
            {!data.notes.length && <p className="classroom-empty">Notes shared by your tutor will appear here.</p>}
            {[...data.notes].reverse().map(note => <article key={note.id} className="classroom-item">
              <h3>{note.title}</h3><small>{when(note.createdAt)}</small>
              {note.content && <p className="classroom-longtext">{note.content}</p>}
              {note.pdf && <PdfNoteLinks role={role} partnerId={partnerId} note={note}/>}
            </article>)}
          </section>
          <aside className="workspace-panel">
            {role === 'teacher' ? <><h2>Add lesson notes</h2>
              <form className="editor-form classroom-form" onSubmit={createNote}>
                <label>Note title<input required maxLength={100} value={noteTitle} onChange={event => setNoteTitle(event.target.value)} placeholder="e.g. Quadratic equations"/></label>
                <label>Notes (optional if uploading a PDF)<textarea rows={6} maxLength={8000} value={noteBody} onChange={event => setNoteBody(event.target.value)} placeholder="Write your lesson summary, links or revision guidance."/></label>
                {isBrowserDemo ? <div className="classroom-file-picker">
                  <label htmlFor="teacher-note-pdf"><FileUp size={17}/> Attach a PDF (maximum 10 MB)</label>
                  <input id="teacher-note-pdf" ref={pdfInput} type="file" accept=".pdf,application/pdf"
                    onChange={event => setNotePdf(event.target.files?.[0] ?? null)}/>
                  {notePdf && <div className="classroom-selected-pdf"><span>{notePdf.name} · {(notePdf.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <button type="button" aria-label="Remove selected PDF" onClick={() => { setNotePdf(null); if (pdfInput.current) pdfInput.current.value = ''; }}><X size={16}/></button>
                  </div>}
                  <small>PDFs are stored on this browser only. They will be available when you switch between matched demo accounts here.</small>
                </div> : <p className="classroom-file-warning">PDF uploads will be enabled after backend file storage is connected. Text notes still work.</p>}
                <button type="submit" className="primary-button" disabled={!!busy || (!noteBody.trim() && !notePdf)}>Share note{notePdf ? ' and PDF' : ''}</button>
              </form>
            </> : <><h2>Your study library</h2><p className="admin-intro">Your tutor's notes stay in this classroom for you to revisit after each lesson.</p></>}
          </aside>
        </>}
        {section === 'homework' && <>
          <section className="workspace-panel">
            <h2>{role === 'teacher' ? 'Homework and feedback' : 'Your assignments'}</h2>
            {!sortedHomework.length && <p className="classroom-empty">No assignments yet.</p>}
            {sortedHomework.map(homework => <article key={homework.id} className="classroom-item">
              <div className="classroom-item-heading"><h3>{homework.title}</h3><span className={'lesson-status ' + (homework.reviewedAt ? 'completed' : homework.submittedAt ? 'submitted' : 'scheduled')}>
                {homework.reviewedAt ? 'Reviewed' : homework.submittedAt ? 'Submitted' : 'Assigned'}</span></div>
              <p><Clock3 size={15}/> Due {when(homework.dueAt)}</p>
              <p className="classroom-longtext">{homework.instructions}</p>
              {homework.submission && <div className="classroom-response"><strong>Student submission</strong><p>{homework.submission}</p></div>}
              {homework.review && <div className="classroom-response"><strong>Teacher feedback</strong><p>{homework.review}</p></div>}
              {role === 'student' && !homework.reviewedAt && <div className="classroom-reply">
                <label>Submit homework<textarea rows={3} maxLength={8000} value={responses[homework.id] ?? ''} placeholder="Your answer, progress or a link to your completed work" onChange={event => setResponses(v => ({ ...v, [homework.id]: event.target.value }))}/></label>
                <button type="button" disabled={!!busy} className="secondary-button" onClick={() => homeworkAction(homework)}><Send size={16}/>{homework.submittedAt ? 'Update submission' : 'Submit work'}</button>
              </div>}
              {role === 'teacher' && homework.submittedAt && !homework.reviewedAt && <div className="classroom-reply">
                <label>Review homework<textarea rows={3} maxLength={4000} value={responses[homework.id] ?? ''} placeholder="What went well, what to practise next" onChange={event => setResponses(v => ({ ...v, [homework.id]: event.target.value }))}/></label>
                <button type="button" disabled={!!busy} className="secondary-button" onClick={() => homeworkAction(homework)}><Send size={16}/> Send feedback</button>
              </div>}
            </article>)}
          </section>
          <aside className="workspace-panel">
            {role === 'teacher' ? <><h2>Assign homework</h2>
              <form className="editor-form classroom-form" onSubmit={createHomework}>
                <label>Assignment title<input required maxLength={100} value={homeworkTitle} onChange={event => setHomeworkTitle(event.target.value)} placeholder="e.g. Chapter 3 exercises"/></label>
                <label>Instructions<textarea rows={5} required maxLength={3000} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Explain what to complete and how to submit."/></label>
                <label>Due date<input type="datetime-local" required value={dueAt} onChange={event => setDueAt(event.target.value)}/></label>
                <button className="primary-button" type="submit" disabled={!!busy}>Assign homework</button>
              </form>
            </> : <><h2>Turn it in</h2><p className="admin-intro">Write your answers here, or include a link to your work. Your tutor can review it and leave feedback.</p></>}
          </aside>
        </>}
      </div>
    </>}
  </main>;
}
