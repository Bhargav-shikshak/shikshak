import { useCallback } from 'react';
import { ArrowRight, BookOpenCheck, CalendarDays, ClipboardList, GraduationCap, MessageCircle, NotebookPen } from 'lucide-react';
import type { ClassroomSummary, PublicAccount, Role } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice } from './Common';

const formatDate = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export function Dashboard({ account, openExplore, openProfile, openClassroom }: {
  account: PublicAccount;
  openExplore: () => void;
  openProfile: () => void;
  openClassroom: (id: string) => void;
}) {
  const role = account.role as Role;
  const { data, error, refresh } = useResource(useCallback((signal: AbortSignal) => api.classrooms(role, signal), [role]));
  const classrooms = data ?? [];
  const now = Date.now();
  const upcoming = classrooms.flatMap(room => room.classroom.sessions
    .filter(session => session.status === 'scheduled' && new Date(session.startsAt).getTime() >= now)
    .map(session => ({ ...session, partner: room.partner })))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pending = classrooms.flatMap(room => room.classroom.homework
    .filter(homework => role === 'teacher'
      ? homework.submittedAt && !homework.reviewedAt
      : !homework.submittedAt)
    .map(homework => ({ ...homework, partner: room.partner })));
  const notes = classrooms.flatMap(room => room.classroom.notes.map(note => ({ ...note, partner: room.partner })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <main id="main" className="workspace-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> {role === 'teacher' ? 'TEACHING OVERVIEW' : 'LEARNING OVERVIEW'}</p>
      <h1>Hello, {account.name.split(' ')[0]}.</h1>
      <p>{role === 'teacher' ? 'Your students, class schedule and reviews — in one place.' : 'Your classes, homework and study notes — together at a glance.'}</p>
    </div>
    {error && <ErrorNotice message={error} retry={refresh}/>}
    {!data && !error && <p role="status">Loading your learning workspace…</p>}
    <div className="dashboard-stats">
      <div><GraduationCap size={20}/><strong>{classrooms.length}</strong><span>{role === 'teacher' ? 'Active students' : 'Active tutors'}</span></div>
      <div><CalendarDays size={20}/><strong>{upcoming.length}</strong><span>Upcoming classes</span></div>
      <div><ClipboardList size={20}/><strong>{pending.length}</strong><span>{role === 'teacher' ? 'Pending reviews' : 'Homework to submit'}</span></div>
      <div><NotebookPen size={20}/><strong>{notes.length}</strong><span>Shared notes</span></div>
    </div>
    <div className="dashboard-columns">
      <section className="workspace-panel">
        <div className="dashboard-heading"><h2><CalendarDays size={20}/> Upcoming classes</h2><button type="button" onClick={openExplore}>Explore nearby <ArrowRight size={15}/></button></div>
        {upcoming.length === 0 && <div className="dashboard-empty"><CalendarDays size={24}/><strong>No upcoming classes yet</strong><p>Once you match, your teacher can schedule classes in your shared classroom.</p><button className="secondary-button" onClick={openExplore}>Find {role === 'teacher' ? 'students' : 'tutors'}</button></div>}
        {upcoming.slice(0, 8).map(session => <button className="dashboard-row" key={session.id} onClick={() => openClassroom(session.partner.id)} type="button">
          <span className="dashboard-date"><CalendarDays size={17}/></span><span><strong>{session.title}</strong><small>{session.partner.name} · {formatDate(session.startsAt)}</small></span><ArrowRight size={16}/>
        </button>)}
      </section>
      <section className="workspace-panel">
        <div className="dashboard-heading"><h2><ClipboardList size={20}/>{role === 'teacher' ? 'Waiting for your review' : 'Your homework'}</h2></div>
        {pending.length === 0 && <div className="dashboard-empty"><BookOpenCheck size={24}/><strong>All caught up</strong><p>{role === 'teacher' ? 'Submitted homework waiting for feedback will appear here.' : 'New homework from your teachers will appear here.'}</p></div>}
        {pending.slice(0, 8).map(task => <button className="dashboard-row" type="button" key={task.id} onClick={() => openClassroom(task.partner.id)}>
          <span className="dashboard-date"><ClipboardList size={17}/></span><span><strong>{task.title}</strong><small>{task.partner.name} · Due {formatDate(task.dueAt)}</small></span><ArrowRight size={16}/>
        </button>)}
      </section>
    </div>
    <div className="dashboard-columns dashboard-secondary">
      <section className="workspace-panel">
        <div className="dashboard-heading"><h2><MessageCircle size={20}/>{role === 'teacher' ? 'Your students' : 'Your tutors'}</h2></div>
        {classrooms.length === 0 && <p className="admin-intro">No active teaching relationships yet. Publish your listing and match to begin.</p>}
        {classrooms.map(({ partner }) => <button key={partner.id} className="dashboard-row" type="button" onClick={() => openClassroom(partner.id)}>
          <span className="profile-monogram mini">{partner.name.slice(0, 2).toUpperCase()}</span><span><strong>{partner.name}</strong><small>{partner.locality} · {partner.subjects.join(', ')}</small></span><ArrowRight size={16}/>
        </button>)}
      </section>
      <section className="workspace-panel">
        <div className="dashboard-heading"><h2><NotebookPen size={20}/> Recent study notes</h2></div>
        {notes.length === 0 && <p className="admin-intro">Notes your teacher shares will appear here.</p>}
        {notes.slice(0, 6).map(note => <button key={note.id} className="dashboard-row" type="button" onClick={() => openClassroom(note.partner.id)}>
          <span className="dashboard-date"><NotebookPen size={17}/></span><span><strong>{note.title}</strong><small>{note.partner.name} · {formatDate(note.createdAt)}</small></span><ArrowRight size={16}/>
        </button>)}
        <button type="button" className="secondary-button" onClick={openProfile}>Edit my profile</button>
      </section>
    </div>
  </main>;
}
