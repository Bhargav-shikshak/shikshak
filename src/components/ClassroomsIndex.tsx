import { useCallback } from 'react';
import { ArrowRight, BookOpen, CalendarDays, GraduationCap } from 'lucide-react';
import type { PublicAccount, Role } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice } from './Common';

export function ClassroomsIndex({ account, openClassroom, openExplore }: {
  account: PublicAccount;
  openClassroom: (id: string) => void;
  openExplore: () => void;
}) {
  const role = account.role as Role;
  const { data, error, refresh } = useResource(useCallback((signal: AbortSignal) => api.classrooms(role, signal), [role]));
  return <main id="main" className="workspace-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> LEARNING TOGETHER</p>
      <h1>My classrooms.</h1><p>Every accepted booking becomes a shared space for lesson plans, notes, homework and feedback.</p></div>
    {error && <ErrorNotice message={error} retry={refresh}/>}
    {!data && !error && <p role="status">Loading your classrooms…</p>}
    {data?.length === 0 && <div className="empty-state match-empty"><BookOpen size={28}/><h3>No classrooms yet</h3><p>{role === 'teacher' ? 'Review your class requests in Bookings to start teaching.' : 'Choose a tutor and request your first class to open a classroom after acceptance.'}</p><button type="button" className="primary-button" onClick={openExplore}>{role === 'teacher' ? 'Review bookings' : 'Find tutors'} <ArrowRight size={17}/></button></div>}
    <div className="classrooms-grid">{data?.map(({ partner, classroom }) => <button type="button" key={partner.id} className="classroom-card" onClick={() => openClassroom(partner.id)}>
      <span className="profile-monogram mini"><GraduationCap size={23}/></span>
      <strong>{partner.name}</strong><small>{partner.headline}</small>
      <div className="classroom-card-tags"><span><CalendarDays size={15}/>{classroom.sessions.filter(x => x.status === 'scheduled').length} classes</span><span><BookOpen size={15}/>{classroom.homework.length} assignments</span></div>
      <span className="classroom-card-open">Open classroom <ArrowRight size={16}/></span>
    </button>)}</div>
  </main>;
}
