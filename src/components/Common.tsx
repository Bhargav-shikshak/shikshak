import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, BookOpen, Clock3, GraduationCap, Heart, MapPin, X } from 'lucide-react';
import type { ConnectionStatus, DiscoveryListing, Listing } from '../../shared/domain';

export const money = (rate: number) => '₹' + rate.toLocaleString('en-IN');

export function Avatar({ listing, large = false }: { listing: Listing; large?: boolean }) {
  const initials = listing.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const palette: Record<string, string> = { lilac: '#ddd6ed', peach: '#f2d8c8', sage: '#d8e5d1', blue: '#d6e6ee' };
  const n = listing.avatar;
  return <span className={'avatar' + (large ? ' avatar-large' : '')} style={{ background: palette[listing.color] ?? palette.sage }} aria-hidden="true">
    {listing.role === 'student' || !n ? initials : <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="31" r="22" fill="#fff" opacity=".24"/>
      <path d="M8 65c1-13 11-20 24-20s22 7 24 20" fill={['#3f6960', '#59649a', '#b56c50', '#3a626f'][n % 4]}/>
      <path d={n % 2 ? 'M17 37c-3-18 2-26 15-26s19 9 16 28l2 11-12 3H21z' : 'M17 29c-1-13 6-19 15-19 10 0 17 6 16 19l-5 12H22z'} fill={n % 3 ? '#302b2c' : '#483129'}/>
      <path d="M27 40h10v10l-5 4-5-4z" fill={n % 3 ? '#ba7e5c' : '#a16345'}/>
      <path d="M21 28c4 0 12-3 17-8 2 5 4 7 6 8v7c0 8-6 13-12 13s-11-5-11-13z" fill={n % 3 ? '#dba280' : '#bb815d'}/>
      <path d="M25 33h.2m13 0h.2" stroke="#2e2526" strokeWidth="2.5" strokeLinecap="round"/>
      {n % 2 === 0 && <path d="M22 31h8v5h-7zm12 0h8l-1 5h-7zm-4 1h4" stroke="#393435" strokeWidth="1.1" strokeLinejoin="round"/>}
      <path d="M29 40q3 3 6 0" stroke="#75453a" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>}
  </span>;
}

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="notice error" role="alert"><AlertCircle size={18}/><span>{message}</span>{retry && <button type="button" onClick={retry}>Retry</button>}</div>;
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} aria-label={title} className={wide ? 'dialog dialog-wide' : 'dialog'}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog-content"><button type="button" className="icon-button close-dialog" aria-label="Close dialog" onClick={onClose}><X size={20}/></button>{children}</section>
  </dialog>;
}

export function ListingCard({ item, selected, busy, onOpen, onSave }: {
  item: DiscoveryListing; selected: boolean; busy: boolean; onOpen: () => void; onSave: () => void;
}) {
  return <article className={'listing-card' + (selected ? ' selected-card' : '')} id={'card-' + item.id}>
    <div className="card-top"><Avatar listing={item}/><button className={'icon-button save-button' + (item.saved ? ' is-saved' : '')} type="button" aria-label={(item.saved ? 'Unsave ' : 'Save ') + item.name} aria-pressed={item.saved} disabled={busy} onClick={onSave}><Heart size={18}/></button></div>
    <h3>{item.name}{item.fictional && <small className="fictional-pill">Preview</small>}</h3><p className="card-headline">{item.headline}</p>
    <div className="card-location"><MapPin size={14}/>{item.locality}<span>·</span>{item.distance < .15 ? 'Nearby' : item.distance.toFixed(1) + ' km'}</div>
    <div className="subject-tags">{item.subjects.slice(0, 2).map((subject) => <span key={subject}>{subject}</span>)}
      {item.subjects.length > 2 && <span aria-label={(item.subjects.length - 2) + ' more subjects'}>+{item.subjects.length - 2}</span>}</div>
    <div className="card-bottom"><div><strong>{money(item.rate)}</strong><span> / hr</span>{item.role === 'teacher' && <small className="price-explanation">{item.travelFee ? money(item.travelFee) + ' travel included' : 'Platform quote'}</small>}</div>
      <button className="text-button" type="button" onClick={onOpen} aria-label={'View profile for ' + item.name}>View profile <ArrowUpRight size={15}/></button></div>
  </article>;
}

export function ListingDetails({ listing, status, busy, onInterest, onChat }: {
  listing: Listing; status: ConnectionStatus | null; busy: boolean; onInterest: () => void; onChat: () => void;
}) {
  return <>
    <div className="detail-identity"><Avatar listing={listing} large/><div><p className="eyebrow">{listing.role === 'teacher' ? 'TUTOR PROFILE' : 'LEARNER LISTING'}</p><h2>{listing.name}</h2><p>{listing.headline}</p></div></div>
    {listing.fictional && <p className="preview-notice">This fictional demonstration profile is for browsing only. Real accounts can match and use classrooms.</p>}
    <div className="detail-meta"><span><MapPin size={16}/>{listing.locality}</span><span><Clock3 size={16}/>{listing.availability}</span><span><GraduationCap size={17}/>{listing.grades.join(', ')}</span></div>
    <h3>About</h3><p className="detail-about">{listing.description}</p>
    {listing.role === 'student' && (listing.weakSubjects?.length ?? 0) > 0 && <><h3>Needs help with</h3><div className="subject-tags detail-tags">{listing.weakSubjects?.map(subject => <span key={subject}>{subject}</span>)}</div></>}
    {listing.role === 'student' && (listing.strongSubjects?.length ?? 0) > 0 && <><h3>Stronger subjects</h3><div className="subject-tags detail-tags">{listing.strongSubjects?.map(subject => <span key={subject}>{subject}</span>)}</div></>}
    {listing.role === 'teacher' && (listing.qualifications || listing.experience) && <><h3>Teacher background</h3><p className="detail-about">{[listing.qualifications, listing.experience].filter(Boolean).join(' · ')}</p></>}
    <h3>Subjects</h3><div className="subject-tags detail-tags">{listing.subjects.map((subject) => <span key={subject}><BookOpen size={13}/>{subject}</span>)}</div>
    <div className="detail-footer"><div><strong>{money(listing.rate)}</strong><span> / hr{listing.role === 'student' ? ' budget' : ''}</span>{listing.role === 'teacher' && 'baseRate' in listing && <small className="price-explanation">Base {money((listing as DiscoveryListing).baseRate ?? listing.rate)} + travel {money((listing as DiscoveryListing).travelFee ?? 0)}</small>}</div>
      {status === 'matched' ? <button className="primary-button" onClick={onChat}>Open conversation <ArrowUpRight size={17}/></button>
        : <button className="primary-button" disabled={busy || status === 'sent' || !!listing.fictional} onClick={onInterest}><Heart size={17}/>{listing.fictional ? 'Preview only' : status === 'sent' ? 'Interest sent' : status === 'incoming' ? 'Match back' : 'Send interest'}</button>}</div>
    <p className="detail-privacy">{status === 'matched' ? 'You both expressed interest.' : 'Messaging opens when you both express interest.'} Map pins show neighbourhoods.</p>
  </>;
}
