import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, CalendarDays, Compass, FilePenLine, FlaskConical, House, LogOut, ShieldCheck, UserRound, X } from 'lucide-react';
import type { Catalog, Listing, PublicAccount, Role } from '../shared/domain';
import { api, isBrowserDemo } from './api';
import { useResource } from './useResource';
import { ErrorNotice } from './components/Common';
import { Auth } from './components/Auth';
import { Landing } from './components/Landing';
import { DemoAccountSwitcher } from './components/DemoAccountSwitcher';
import { Admin } from './components/Admin';
import { Classroom } from './components/Classroom';
import { ClassroomsIndex } from './components/ClassroomsIndex';
import { Dashboard } from './components/Dashboard';
import { Explore } from './components/Explore';
import { ListingEditor } from './components/ListingEditor';
import { Bookings } from './components/Bookings';
import { Profile } from './components/Profile';
import { LegalPage, SiteFooter, type LegalKind } from './components/Legal';
import './workspace.css';
import './portal.css';

type View = 'home' | 'explore' | 'bookings' | 'classrooms' | 'classroom' | 'listing' | 'profile';
const views = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'bookings', label: 'Bookings', icon: BookOpen },
  { id: 'classrooms', label: 'Classes', icon: CalendarDays },
  { id: 'listing', label: 'My listing', icon: FilePenLine },
  { id: 'profile', label: 'Profile', icon: UserRound },
] as const;

const link = (role: Role, view: View, id?: string) =>
  '#' + role + '/' + view + (id ? '/' + encodeURIComponent(id) : '');
const hash = () => window.location.hash;
function subscribe(update: () => void) {
  window.addEventListener('hashchange', update);
  return () => window.removeEventListener('hashchange', update);
}
function OwnListing({ catalog, role, account, onSaved }: {
  catalog: Catalog; role: Role; account: PublicAccount; onSaved: (listing: Listing) => void;
}) {
  const load = useCallback((signal: AbortSignal) => api.listing(role, signal), [role]);
  const { data, error, refresh } = useResource(load);
  return <main id="main" className="workspace-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> {role === 'teacher' ? 'TUTOR WORKSPACE' : 'LEARNER WORKSPACE'}</p>
      <h1>My listing.</h1><p>{role === 'teacher' ? 'Tell nearby learners what you teach and when you’re available.' : 'Your learner profile stays private; tutors see only requests you send to them.'}</p></div>
    <div className="workspace-split">
      <section className="workspace-panel editor-panel">
        <h2>{role === 'teacher' ? 'Tutor listing' : 'Learner listing'}</h2>
        {error && <ErrorNotice message={error} retry={refresh}/>}
        {data === undefined && !error && <p role="status">Loading your listing…</p>}
        {data !== undefined && <ListingEditor initial={data} catalog={catalog} role={role} account={account} onSaved={onSaved}/>}
      </section>
      <aside className="workspace-aside"><span className="aside-icon"><ShieldCheck size={22}/></span><h2>What others can see</h2>
        <p>Published tutor listings appear in student discovery. Student accounts and home locations are never browseable by teachers.</p>
        <p>Change your name, qualifications or learning strengths in <a href={link(role, 'profile')}>Profile</a>. You can hide your listing at any time.</p>
        <p className="aside-note">Your account is a {role === 'teacher' ? 'teacher' : 'student'} account and cannot switch roles.</p>
      </aside>
    </div>
  </main>;
}

function App() {
  const route = useSyncExternalStore(subscribe, hash);
  const { data: catalog, error: catalogError, refresh } = useResource(api.catalog);
  const [session, setSession] = useState<PublicAccount | null | undefined>(undefined);
  const [chatId, setChatId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const routeParts = route.slice(1).split('/');
  const isAdminRoute = routeParts[0] === 'admin';
  const legalKind: LegalKind | null = routeParts[0] === 'terms' || routeParts[0] === 'privacy' ? routeParts[0] : null;
  const role: Role | null = session?.role === 'student' || session?.role === 'teacher' ? session.role : null;
  const selected = routeParts[1];
  const view: View =
    selected === 'home' || selected === 'bookings' || selected === 'classrooms' ||
    selected === 'classroom' || selected === 'listing' || selected === 'profile'
      ? selected : (selected === 'explore' ? 'explore' : 'home');
  const partnerId = routeParts[2] ? decodeURIComponent(routeParts[2]) : '';
  const go = (next: View, id?: string) => { if (role) window.location.hash = link(role, next, id); };
  const openChat = (id: string) => { setChatId(id); go('bookings'); };
  const openClassroom = (id: string) => { setChatId(null); go('classroom', id); };
  const notify = (value: string) => setToast(value);

  useEffect(() => {
    const controller = new AbortController();
    api.me(controller.signal).then(setSession).catch(() => {
      if (!controller.signal.aborted) setSession(null);
    });
    return () => controller.abort();
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4400);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (legalKind) {
      document.title = (legalKind === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions') + ' · Shikshak';
      return;
    }
    if (!session || routeParts[0] === 'welcome') {
      document.title = routeParts[0] === 'login' ? 'Log in · Shikshak' :
        routeParts[0] === 'signup' ? 'Sign up · Shikshak' :
        'Shikshak · Home tuition, closer to home';
      return;
    }
    document.title = ((session.role === 'admin' || session.role === 'owner') ? 'Admin' : view === 'explore' ? 'Explore' : view === 'home' ? 'Home' : view === 'classroom' ? 'Classroom' : view === 'classrooms' ? 'Classes' : view === 'profile' ? 'Profile' : view === 'listing' ? 'My listing' : 'Bookings') + ' · Shikshak';
  }, [session, view, legalKind, route]);

  function loggedIn(account: PublicAccount) {
    setSession(account);
    setChatId(null);
    window.location.hash = (account.role === 'admin' || account.role === 'owner') ? '#admin' : link(account.role, account.role === 'teacher' ? 'home' : 'explore');
  }
  async function logout(toAdmin = false) {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.logout();
      setSession(null);
      setChatId(null);
      window.location.hash = toAdmin ? '#admin' : '#login';
    } catch (cause) { notify((cause as Error).message); }
    finally { setSigningOut(false); }
  }

  if (legalKind) return <LegalPage kind={legalKind}
    backHref={session?.role === 'admin' || session?.role === 'owner' ? '#admin' : role ? link(role, 'home') : '#welcome'}/>;

  if (session === undefined) return <main id="main" className="workspace-page" role="status">Checking your session…</main>;

  // Keep the marketing site independent of catalog data and the logged-in workspace.
  const publicRoute = routeParts[0] === 'welcome' ||
    (!session && routeParts[0] !== 'login' && routeParts[0] !== 'signup' && !isAdminRoute);
  if (publicRoute) return <>
    <Landing memberHref={role ? link(role, 'home') : session ? '#admin' : undefined}/>
    <SiteFooter variant="member"/>
  </>;

  if (!catalog) return <main id="main" className="workspace-page">
    {catalogError ? <ErrorNotice message={catalogError} retry={refresh}/> : <p role="status">Loading Shikshak…</p>}
  </main>;
  if (!session) return <>
    <Auth key={isAdminRoute ? 'admin' : routeParts[0] + '/' + (routeParts[1] || '')}
      catalog={catalog} onSuccess={loggedIn} admin={isAdminRoute}/>
    <SiteFooter variant="auth"/>
  </>;

  if ((session.role === 'admin' || session.role === 'owner')) return <>
    <header className="site-header"><div className="header-inner portal-header">
      <a className="brand" href="#admin" aria-label="Shikshak admin"><img src="/shikshak-logo.png" width="60" height="60" alt=""/><span>Shik<span>shak</span><b>.</b></span></a>
      <span className="admin-header-label"><ShieldCheck size={17}/> Admin access</span>
      <button type="button" className="secondary-button" disabled={signingOut} onClick={() => void logout()}><LogOut size={16}/> Log out</button>
    </div></header>
    {isBrowserDemo && <div className="browser-demo-bar" role="note">
      <span>Browser demo · accounts stay on this device; admin permissions are simulated.</span>
      <DemoAccountSwitcher catalog={catalog} current={session} onSwitch={loggedIn}/>
    </div>}
    <Admin/>
    <SiteFooter variant="admin"/>
    {toast && <div className="toast" role="status"><span>{toast}</span><button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setToast(null)}><X size={16}/></button></div>}
  </>;

  // Student and teacher sessions cannot enter the admin console.
  // Explicit sign-out is required before using a separate administrator identity.
  if (isAdminRoute) return <main id="main" className="workspace-page admin-access-gate">
    <a className="brand" href={link(session.role, 'home')} aria-label="Return to Shikshak"><img src="/shikshak-logo.png" width="60" height="60" alt=""/><span>Shik<span>shak</span><b>.</b></span></a>
    <div className="workspace-panel">
      <p className="eyebrow">RESTRICTED ACCESS</p><h1>Admin sign in.</h1>
      <p>You are signed in as a {session.role}. Admin accounts use separate credentials and cannot share student or teacher sessions.</p>
      <div className="form-actions"><button type="button" className="primary-button" disabled={signingOut} onClick={() => void logout(true)}>Log out and open admin access</button><a className="secondary-button" href={link(session.role, 'home')}>Return to my dashboard</a></div>
    </div>
  </main>;

  // The role comes from the server-authenticated session, never from the hash.
  if (!role) return <p role="alert">Your account role is not supported.</p>;
  return <>
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
    <header className="site-header"><div className="header-inner portal-header">
      <a className="brand" href={link(role, 'home')} aria-label="Shikshak home" onClick={() => setChatId(null)}><img src="/shikshak-logo.png" width="60" height="60" alt=""/><span>Shik<span>shak</span><b>.</b></span></a>
      <nav className="site-nav" aria-label="Main navigation">
        {views.filter(({ id }) => (role === 'student' || id !== 'explore') &&
          (role === 'teacher' || id !== 'listing')).map(({ id, label, icon: Icon }) =>
          <a key={id} href={link(role, id)} aria-current={view === id ? 'page' : undefined}
            onClick={() => setChatId(null)}><Icon size={16}/><span>{label}</span></a>)}
      </nav>
      <div className="header-right">
        {(isBrowserDemo || catalog.demo) && <span className="demo-pill"><FlaskConical size={14}/>{isBrowserDemo ? 'Local demo' : 'Pilot'}</span>}
        <a className="portal-user" href={link(role, 'profile')} title={session.email}><span className="workspace-avatar">{session.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span><span className="workspace-name">{session.name}<small>{role === 'teacher' ? 'Teacher' : 'Student'}</small></span></a>
        <button className="portal-logout icon-button" type="button" disabled={signingOut} aria-label="Log out" title="Log out" onClick={() => void logout()}><LogOut size={18}/></button>
      </div>
    </div></header>
    {isBrowserDemo && <div className="browser-demo-bar" role="note">
      <span>Browser demo · test bookings, approval, chat and classes. Avoid real personal information.</span>
      <DemoAccountSwitcher catalog={catalog} current={session} onSwitch={loggedIn}/>
    </div>}
    {(view === 'home' || (role === 'teacher' && view === 'explore')) &&
      <Dashboard key={session.id} account={session}
        openExplore={() => go(role === 'teacher' ? 'bookings' : 'explore')}
        openProfile={() => go('profile')} openClassroom={openClassroom}/>}
    {view === 'explore' && role === 'student' &&
      <Explore key={session.id} catalog={catalog} role="student" onChat={openChat} notify={notify}/>}
    {view === 'bookings' && <Bookings key={session.id} role={role} currentUserId={session.id}
      chatId={chatId} clearChat={() => setChatId(null)} openChat={openChat}
      openClassroom={openClassroom} explore={() => go('explore')} notify={notify}/>}
    {view === 'classrooms' && <ClassroomsIndex key={session.id} account={session} openClassroom={openClassroom} openExplore={() => go(role === 'teacher' ? 'bookings' : 'explore')}/>}
    {view === 'classroom' && (partnerId ? <Classroom key={session.id + ':' + partnerId} role={role} partnerId={partnerId} back={() => go('classrooms')} message={openChat}/> : <ClassroomsIndex account={session} openClassroom={openClassroom} openExplore={() => go('explore')}/>)}
    {view === 'listing' && role === 'teacher' &&
      <OwnListing key={session.id + ':' + session.localityId} catalog={catalog} role={role} account={session}
        onSaved={listing => notify(listing.published ? 'Your tutor listing is visible to students.' : 'Your listing was saved privately.')}/>}
    {view === 'profile' && <Profile key={session.id} account={session} catalog={catalog} onUpdated={setSession} openListing={() => go('listing')} openClassroom={openClassroom}/>}
    <SiteFooter/>
    {toast && <div className="toast" role="status"><BookOpen size={20}/><span>{toast}</span><button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17}/></button></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
