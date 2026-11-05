import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, ChevronDown, Compass, FilePenLine, FlaskConical, HeartHandshake, ShieldCheck, X } from 'lucide-react';
import type { Catalog, Listing, Role } from '../shared/domain';
import { api } from './api';
import { useResource } from './useResource';
import { ErrorNotice } from './components/Common';
import { Explore } from './components/Explore';
import { ListingEditor } from './components/ListingEditor';
import { Matches } from './components/Matches';
import './workspace.css';

type View = 'explore' | 'matches' | 'listing';
const views = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'matches', label: 'Matches', icon: HeartHandshake },
  { id: 'listing', label: 'My listing', icon: FilePenLine },
] as const;
const link = (role: Role, view: View) => '#' + role + '/' + view;
const hash = () => window.location.hash;
function subscribe(update: () => void) {
  window.addEventListener('hashchange', update);
  return () => window.removeEventListener('hashchange', update);
}

function OwnListing({ catalog, role, onSaved }: { catalog: Catalog; role: Role; onSaved: (listing: Listing) => void }) {
  const load = useCallback((signal: AbortSignal) => api.listing(role, signal), [role]);
  const { data, error, refresh } = useResource(load);
  return <main id="main" className="workspace-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> {role === 'teacher' ? 'TUTOR WORKSPACE' : 'LEARNER WORKSPACE'}</p><h1>My listing.</h1><p>{role === 'teacher' ? 'Tell nearby learners what you teach and when you’re available.' : 'Tell nearby tutors what you’d like to learn and when you’re available.'}</p></div>
    <div className="workspace-split">
      <section className="workspace-panel editor-panel">
        <h2>{role === 'teacher' ? 'Tutor listing' : 'Learner listing'}</h2>
        {error && <ErrorNotice message={error} retry={refresh}/>}
        {data === undefined && !error && <p role="status">Loading your listing…</p>}
        {data !== undefined && <ListingEditor initial={data} catalog={catalog} role={role} onSaved={onSaved}/>}
      </section>
      <aside className="workspace-aside"><span className="aside-icon"><ShieldCheck size={22}/></span><h2>What others can see</h2><p>Your listing appears to {role === 'teacher' ? 'learners' : 'tutors'} after you publish it. Map pins show your neighbourhood.</p><p>You can edit or hide your listing at any time. Existing matches keep their conversation.</p>{catalog.demo && <p className="aside-note">Switch workspaces to see your published listing from the other side.</p>}</aside>
    </div>
  </main>;
}

function App() {
  const route = useSyncExternalStore(subscribe, hash);
  const [routeRole, routeView] = route.slice(1).split('/');
  const role: Role = routeRole === 'teacher' ? 'teacher' : 'student';
  const view: View = routeView === 'matches' || routeView === 'listing' ? routeView : 'explore';
  const { data: catalog, error, refresh } = useResource(api.catalog);
  const [chat, setChat] = useState<{ role: Role; id: string } | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [role, view]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast({ message });
  const switchRole = (next: Role, nextView: View = 'explore') => {
    if (next !== role || nextView !== view) { setChat(null); window.location.hash = link(next, nextView); }
  };
  const openChat = (id: string) => { setChat({ role, id }); window.location.hash = link(role, 'matches'); };
  const workspace = catalog?.workspaces[role];

  return <>
    <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); const main = document.getElementById("main"); main?.setAttribute("tabindex", "-1"); main?.focus(); }}>Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href={link(role, 'explore')} aria-label="Shikshak home" onClick={() => setChat(null)}><img src="/shikshak.svg" width="40" height="40" alt=""/><span>Shik<span>shak</span><b>.</b></span></a>
      <nav className="site-nav" aria-label="Main navigation">
        {views.map(({ id, label, icon: Icon }) => <a key={id} href={link(role, id)} aria-current={view === id ? 'page' : undefined} onClick={() => setChat(null)}><Icon size={17}/><span>{label}</span></a>)}
      </nav>
      <div className="header-right">
        {catalog?.demo && <span className="demo-pill"><FlaskConical size={14}/> Demo mode</span>}
        {workspace && <details className="workspace-picker"><summary aria-label={'Switch workspace, currently ' + (role === 'student' ? 'learner' : 'tutor')}><span className="workspace-avatar">{workspace.initials}</span><span className="workspace-name">{workspace.name}<small>{role === 'student' ? 'Learner' : 'Tutor'}</small></span><ChevronDown size={14}/></summary>
          <div className="workspace-menu"><p>Switch workspace</p>{(['student', 'teacher'] as const).map((option) => <button key={option} type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); switchRole(option, view); }} aria-pressed={role === option}><BookOpen size={15}/>{option === 'student' ? 'Learner workspace' : 'Tutor workspace'}</button>)}</div>
        </details>}
      </div>
    </div></header>
    {error && <main id="main" className="workspace-page"><ErrorNotice message={error} retry={refresh}/></main>}
    {!catalog && !error && <main id="main" className="workspace-page" role="status">Loading Shikshak…</main>}
    {catalog && view === 'explore' && <Explore key={role} catalog={catalog} role={role} onRole={switchRole} onChat={openChat} notify={notify}/>}
    {catalog && view === 'matches' && <Matches key={role} catalog={catalog} role={role} chatId={chat?.role === role ? chat.id : null} clearChat={() => setChat(null)} openChat={openChat} explore={() => switchRole(role)} notify={notify}/>}
    {catalog && view === 'listing' && <OwnListing key={role} catalog={catalog} role={role} onSaved={(listing) => notify(listing.published ? 'Your listing is visible in discovery.' : 'Your listing was saved privately.')}/>}
    {toast && <div className="toast" role="status"><HeartHandshake size={20}/><span>{toast.message}</span><button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17}/></button></div>}
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);
