import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Heart, Inbox, MapPin, MessageCircle, Send, Sparkles, Users } from 'lucide-react';
import type { Catalog, Connection, ConnectionStatus, Listing, Role } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { Avatar, ErrorNotice, ListingDetails, Modal } from './Common';

const statuses: { id: ConnectionStatus; label: string; empty: string }[] = [
  { id: 'matched', label: 'Matches', empty: 'When you both express interest, your match will appear here.' },
  { id: 'incoming', label: 'Received', empty: 'New interest in your listing will appear here.' },
  { id: 'sent', label: 'Sent', empty: 'Find a listing you like in Explore and send interest.' },
];

function Conversation({ listing, catalog, role, currentUserId, close }: { listing: Listing; catalog: Catalog; role: Role; currentUserId: string; close: () => void }) {
  const load = useCallback((signal: AbortSignal) => api.messages(role, listing.id, signal), [role, listing.id]);
  const { data, error, refresh } = useResource(load);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const messageId = useRef<string | null>(null);
  const messageList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [data]);
  const currentUser = currentUserId;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    const id = messageId.current ?? crypto.randomUUID();
    messageId.current = id;
    setSending(true);
    setSendError('');
    try {
      await api.send(role, listing.id, text.trim(), id);
      messageId.current = null;
      setText('');
      refresh();
    } catch (error) { setSendError((error as Error).message); }
    finally { setSending(false); }
  }

  return <Modal title={'Conversation with ' + listing.name} onClose={close} wide>
    <div className="detail-identity"><Avatar listing={listing}/><div><p className="eyebrow">MUTUAL MATCH</p><h2>{listing.name}</h2></div></div>
    <div className="message-list" ref={messageList} aria-live="polite">
      {error ? <ErrorNotice message={error} retry={refresh}/> : !data ? <p>Loading conversation…</p> : data.length === 0
        ? <div className="chat-empty"><MessageCircle size={24}/><p>Say hello and ask about subjects, timing, or how a first lesson could work.</p></div>
        : data.map((message) => <div className={'message' + (message.authorId === currentUser ? ' mine' : '')} key={message.authorId + ':' + message.id}>
          <p>{message.body}</p><time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time>
        </div>)}
    </div>
    {sendError && <ErrorNotice message={sendError}/>}
    <form className="message-form" onSubmit={send}><input aria-label="Message" placeholder="Write a message…" maxLength={500} value={text} disabled={sending} onChange={(event) => { messageId.current = null; setText(event.target.value); }}/><button className="primary-button" aria-label="Send message" disabled={sending || !text.trim()}><Send size={17}/></button></form>
  </Modal>;
}

export function Matches({ catalog, role, currentUserId, chatId, clearChat, openChat, openClassroom, explore, notify }: {
  catalog: Catalog; role: Role; currentUserId: string; chatId: string | null; clearChat: () => void; openChat: (id: string) => void; openClassroom: (id: string) => void; explore: () => void; notify: (message: string) => void;
}) {
  const load = useCallback((signal: AbortSignal) => api.connections(role, signal), [role]);
  const { data, error, refresh } = useResource(load);
  const [tab, setTab] = useState<ConnectionStatus>('matched');
  const [detail, setDetail] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const connections = data?.filter((item) => item.status === tab) ?? [];
  const chat = data?.find((item) => item.listing.id === chatId && item.status === 'matched');

  async function match(connection: Connection) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const { status } = await api.interest(role, connection.listing.id);
      setDetail(null);
      setTab('matched');
      refresh();
      notify(status === 'matched' ? 'It’s a match! You can now start a conversation.' : 'Interest sent.');
      if (status === 'matched') openChat(connection.listing.id);
    } catch (error) { setActionError((error as Error).message); }
    finally { setBusy(false); }
  }

  return <main id="main" className="workspace-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> YOUR CONNECTIONS</p><h1>Matches.</h1><p>Keep track of interest and start a conversation when you both match.</p></div>
    <div className="workspace-split">
      <section className="workspace-panel">
        <div className="connection-tabs" aria-label="Connection status">{statuses.map(({ id, label }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setActionError(''); }}>{label}<span>{data?.filter((item) => item.status === id).length ?? 0}</span></button>)}</div>
        {error && <ErrorNotice message={error} retry={refresh}/>}
        {actionError && !detail && <ErrorNotice message={actionError}/>}
        {!data && !error && <p className="workspace-loading" role="status">Loading connections…</p>}
        {data && connections.length === 0 && <div className="empty-state match-empty"><Inbox size={28}/><h3>{tab === 'matched' ? 'No matches yet' : tab === 'incoming' ? 'No interest received' : 'No interest sent'}</h3><p>{statuses.find((item) => item.id === tab)?.empty}</p><button className="secondary-button" onClick={explore}>Explore nearby <ArrowRight size={16}/></button></div>}
        <div className="connection-list">{connections.map((connection) => <article className="connection-row" key={connection.listing.id}>
          <Avatar listing={connection.listing}/><div className="connection-id"><h3>{connection.listing.name}</h3><p>{connection.listing.headline}</p><small><MapPin size={13}/>{connection.listing.locality}</small></div>
          {connection.status === 'matched' ? <div className="match-actions"><button type="button" className="secondary-button" onClick={() => openClassroom(connection.listing.id)}><Users size={16}/> Classroom</button><button type="button" className="secondary-button" onClick={() => openChat(connection.listing.id)}><MessageCircle size={16}/> Message</button></div>
            : <button type="button" className="secondary-button" onClick={() => { setDetail(connection); setActionError(''); }}>{connection.status === 'incoming' ? 'Review interest' : 'View profile'} <ArrowRight size={16}/></button>}
        </article>)}</div>
      </section>
      <aside className="workspace-aside"><span className="aside-icon"><Sparkles size={22}/></span><h2>How matching works</h2><ol><li><Heart size={16}/><span>Send interest to a tutor or learner you’d like to meet.</span></li><li><Users size={16}/><span>When they express interest too, you match.</span></li><li><MessageCircle size={16}/><span>Open your shared classroom to schedule lessons, exchange notes and review homework.</span></li></ol>{catalog.demo && <p className="aside-note">Every demo profile is switchable. Try matching with a sample tutor or student, then switch accounts to reply.</p>}</aside>
    </div>
    {detail && <Modal title={detail.listing.name} onClose={() => { setDetail(null); setActionError(''); }}><ListingDetails listing={detail.listing} status={detail.status} busy={busy} onInterest={() => void match(detail)} onChat={() => { setDetail(null); openChat(detail.listing.id); }}/>{actionError && <ErrorNotice message={actionError}/>}</Modal>}
    {chat && <Conversation listing={chat.listing} catalog={catalog} role={role} currentUserId={currentUserId} close={clearChat}/>}
  </main>;
}


