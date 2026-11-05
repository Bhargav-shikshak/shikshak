import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Clock, Inbox, MessageCircle, Send, X } from 'lucide-react';
import type { BookingRequest, BookingStatus, Role } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice, Modal, money } from './Common';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
const labels: Record<BookingStatus, string> = {
  pending: 'Pending', accepted: 'Accepted', rejected: 'Declined',
};
function Conversation({ role, booking, userId, close }: {
  role: Role; booking: BookingRequest; userId: string; close: () => void;
}) {
  const peerId = role === 'teacher' ? booking.studentId : booking.teacherId;
  const peerName = role === 'teacher' ? booking.studentName : booking.teacherName;
  const load = useCallback((signal: AbortSignal) => api.messages(role, peerId, signal), [role, peerId]);
  const { data, error, refresh } = useResource(load);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const pendingId = useRef<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [data]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    const id = pendingId.current ?? crypto.randomUUID();
    pendingId.current = id;
    setSending(true);
    setSendError('');
    try {
      await api.send(role, peerId, text.trim(), id);
      pendingId.current = null;
      setText('');
      refresh();
    } catch (cause) { setSendError((cause as Error).message); }
    finally { setSending(false); }
  }
  return <Modal title={'Chat with ' + peerName} onClose={close} wide>
    <div className="detail-identity">
      <span className="profile-monogram">{peerName.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}</span>
      <div><p className="eyebrow">ACCEPTED CLASS BOOKING</p><h2>{peerName}</h2><p>{booking.subject} · {booking.grade}</p></div>
    </div>
    <div className="message-list" ref={scroll} aria-live="polite">
      {error ? <ErrorNotice message={error} retry={refresh}/> : !data ? <p>Loading conversation…</p> :
        !data.length ? <div className="chat-empty"><MessageCircle size={24}/>
          <p>Your class booking is accepted. Discuss the lesson and share any preparation details.</p></div> :
        data.map(message => <div className={'message' + (message.authorId === userId ? ' mine' : '')}
          key={message.authorId + ':' + message.id}>
          <p>{message.body}</p><time dateTime={message.sentAt}>{formatDate(message.sentAt)}</time>
        </div>)}
    </div>
    {sendError && <ErrorNotice message={sendError}/>}
    <form className="message-form" onSubmit={send}>
      <input aria-label="Message" value={text} maxLength={500} disabled={sending}
        placeholder="Write a message…" onChange={event => { pendingId.current = null; setText(event.target.value); }}/>
      <button className="primary-button" aria-label="Send message" disabled={sending || !text.trim()}><Send size={17}/></button>
    </form>
  </Modal>;
}

export function Bookings({ role, currentUserId, chatId, clearChat, openChat, openClassroom, explore, notify }: {
  role: Role;
  currentUserId: string;
  chatId: string | null;
  clearChat: () => void;
  openChat: (id: string) => void;
  openClassroom: (id: string) => void;
  explore: () => void;
  notify: (message: string) => void;
}) {
  const load = useCallback((signal: AbortSignal) => api.bookings(role, signal), [role]);
  const { data, error, refresh } = useResource(load);
  const [tab, setTab] = useState<BookingStatus>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const filtered = (data ?? []).filter(booking => booking.status === tab);
  const activeChat = data?.find(booking => booking.status === 'accepted' &&
    (role === 'teacher' ? booking.studentId : booking.teacherId) === chatId);

  async function decide(id: string, decision: 'accept' | 'reject') {
    if (role !== 'teacher' || busy) return;
    setBusy(id);
    setActionError('');
    try {
      const updated = await api.decideBooking(id, decision);
      setTab(decision === 'accept' ? 'accepted' : 'rejected');
      refresh();
      notify(decision === 'accept'
        ? 'Booking accepted. The classroom is ready, and the first class is scheduled.'
        : 'Booking declined. The student can see your decision.');
      if (decision === 'accept') openClassroom(updated.studentId);
    } catch (cause) { setActionError((cause as Error).message); }
    finally { setBusy(null); }
  }

  return <main id="main" className="workspace-page">
    <div className="workspace-heading">
      <p className="eyebrow hero-eyebrow"><span/> CLASS BOOKING REQUESTS</p>
      <h1>Bookings.</h1>
      <p>{role === 'teacher'
        ? 'Review class requests sent directly to you. Accept or decline each request before any chat or classroom opens.'
        : 'Track class requests you sent to tutors. Once a teacher accepts, your chat and classroom are ready.'}</p>
    </div>
    <div className="workspace-split">
      <section className="workspace-panel">
        <div className="connection-tabs" aria-label="Booking status">
          {(['pending', 'accepted', 'rejected'] as const).map(status =>
            <button key={status} type="button" aria-pressed={tab === status} onClick={() => setTab(status)}>
              {labels[status]} <span>{data?.filter(b => b.status === status).length ?? 0}</span>
            </button>)}
        </div>
        {error && <ErrorNotice message={error} retry={refresh}/>}
        {actionError && <ErrorNotice message={actionError}/>}
        {!data && !error && <p role="status">Loading bookings…</p>}
        {data && !filtered.length && <div className="empty-state match-empty">
          <Inbox size={28}/><h3>No {labels[tab].toLowerCase()} bookings</h3>
          <p>{role === 'teacher'
            ? tab === 'pending' ? 'New student requests will appear here. Students initiate every booking.'
              : 'Requests you have processed will be listed here.'
            : tab === 'pending' ? 'Find a tutor in Explore and request a first class.'
              : 'Your tutor booking decisions will appear here.'}</p>
          {role === 'student' && <button type="button" className="secondary-button" onClick={explore}>
            Browse tutors <ArrowRight size={16}/>
          </button>}
        </div>}
        <div className="booking-list">
          {filtered.map(booking => {
            const peerId = role === 'teacher' ? booking.studentId : booking.teacherId;
            const peerName = role === 'teacher' ? booking.studentName : booking.teacherName;
            return <article className="booking-card" key={booking.id}>
              <div className="booking-card-head">
                <span className="profile-monogram mini" aria-hidden="true">
                  {peerName.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}
                </span>
                <div className="booking-card-name"><h3>{peerName}</h3>
                  <small>{booking.subject} · {booking.grade}</small></div>
                <span className={'booking-status is-' + booking.status}>{labels[booking.status]}</span>
              </div>
              <div className="booking-details">
                <span><CalendarDays size={15}/> {formatDate(booking.startsAt)}</span>
                <span><Clock size={15}/> {booking.durationMinutes} minutes</span>
                <span>{money(booking.quotedRate)} / hr quoted</span>
              </div>
              {booking.note && <p className="booking-note">{booking.note}</p>}
              {role === 'teacher' && <p className="booking-privacy-note">
                This request includes lesson details only. Student addresses and discovery locations are private.
              </p>}
              {booking.status === 'pending' && role === 'teacher' && <div className="booking-actions">
                <button type="button" className="primary-button" disabled={!!busy} onClick={() => void decide(booking.id, 'accept')}>
                  <Check size={16}/> {busy === booking.id ? 'Processing…' : 'Accept booking'}
                </button>
                <button type="button" className="secondary-button" disabled={!!busy} onClick={() => void decide(booking.id, 'reject')}>
                  <X size={16}/> Decline
                </button>
              </div>}
              {booking.status === 'pending' && role === 'student' &&
                <p className="booking-support-note">Waiting for the tutor to accept or decline your request.</p>}
              {booking.status === 'rejected' &&
                <p className="booking-support-note">{role === 'student'
                  ? 'The tutor declined this request. You can request another class from Explore.'
                  : 'You declined this booking; no classroom or chat was opened.'}</p>}
              {booking.status === 'accepted' && <div className="booking-actions">
                <button type="button" className="secondary-button" onClick={() => openClassroom(peerId)}>
                  <BookOpen size={16}/> Classroom
                </button>
                <button type="button" className="secondary-button" onClick={() => openChat(peerId)}>
                  <MessageCircle size={16}/> Message
                </button>
              </div>}
            </article>;
          })}
        </div>
      </section>
      <aside className="workspace-aside">
        <span className="aside-icon"><BookOpen size={22}/></span>
        <h2>How bookings work</h2>
        <ol>
          <li><CalendarDays size={16}/><span>Students choose a tutor, subject and proposed first class time.</span></li>
          <li><Check size={16}/><span>The tutor decides whether to accept or decline.</span></li>
          <li><MessageCircle size={16}/><span>Accepted bookings unlock a shared classroom, notes, messages and homework.</span></li>
        </ol>
        {role === 'teacher' && <p className="aside-note">
          Student search and location maps are not available in teacher accounts.
        </p>}
      </aside>
    </div>
    {activeChat && <Conversation role={role} booking={activeChat} userId={currentUserId} close={clearChat}/>}
  </main>;
}
