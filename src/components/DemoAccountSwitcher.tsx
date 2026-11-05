import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronDown, Plus, Search, Users, X } from 'lucide-react';
import type { Catalog, HomeArea, PublicAccount, Role } from '../../shared/domain';
import {
  createBrowserDemoAccount,
  listBrowserDemoAccounts,
  switchBrowserDemoAccount,
  type BrowserDemoAccount,
} from '../services/browserDemo';
import { ErrorNotice } from './Common';
import { HomeAreaPicker } from './HomeAreaPicker';

interface Props {
  catalog: Catalog;
  current: PublicAccount;
  onSwitch: (account: PublicAccount) => void;
}

export function DemoAccountSwitcher({ catalog, current, onSwitch }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [accounts, setAccounts] = useState<BrowserDemoAccount[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const localityId = catalog.defaultLocality;
  const [homeArea, setHomeArea] = useState<HomeArea | null>(null);
  const [subject, setSubject] = useState(catalog.subjects[0] ?? 'Mathematics');
  const [grade, setGrade] = useState(catalog.grades[2] ?? catalog.grades[0] ?? '');

  const filteredAccounts = accounts.filter(account => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    // Debug switcher is visible in browser-demo mode only. Even here, teacher
    // screens should not provide student emails or neighbourhood lookup.
    const privateStudent = current.role === 'teacher' && account.role === 'student';
    const area = account.homeArea ? account.homeArea.city + ', ' + account.homeArea.locality :
      (catalog.localities.find(place => place.id === account.localityId)?.name ?? '');
    return (privateStudent ? [account.name, account.role] :
      [account.name, account.email, account.role, area])
      .some(value => value.toLowerCase().includes(term));
  }).sort((a, b) => (a.id === current.id ? -1 : b.id === current.id ? 1 : 0));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void listBrowserDemoAccounts().then(next => {
      if (!cancelled) setAccounts(next);
    }).catch(cause => {
      if (!cancelled) setError((cause as Error).message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  async function switchTo(id: string) {
    if (busy || current.id === id) return;
    setBusy(id);
    setError('');
    try {
      const selected = await switchBrowserDemoAccount(id);
      setOpen(false);
      setCreating(false);
      onSwitch(selected);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!homeArea?.city.trim() || !homeArea.locality.trim()) {
      setError('Place a marker on the map and confirm its city and locality.');
      return;
    }
    setBusy('create');
    setError('');
    try {
      const account = await createBrowserDemoAccount({ name, role, localityId, homeArea, subject, grade });
      setOpen(false);
      setCreating(false);
      setName('');
      setHomeArea(null);
      onSwitch(account);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy('');
    }
  }

  return <div className="demo-switcher" ref={container}>
    <button type="button" className="demo-switcher-trigger" aria-expanded={open} aria-controls="demo-switcher-panel"
      onClick={() => setOpen(value => !value)}><Users size={16}/> Test accounts <ChevronDown size={15}/></button>
    {open && <section className="demo-switcher-panel" id="demo-switcher-panel" aria-label="Browser demo accounts">
      <div className="demo-switcher-heading">
        <div><strong>Switch test account</strong><p>{accounts.length} local accounts · shared history in this browser</p></div>
        <button type="button" aria-label="Close account switcher" onClick={() => setOpen(false)}><X size={18}/></button>
      </div>
      {error && <ErrorNotice message={error}/>}
      {!loading && <label className="demo-switcher-search"><Search size={16} aria-hidden="true"/>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder="Find a name, role or neighbourhood" aria-label="Search local demo accounts"/>
      </label>}
      {loading && <p role="status" className="demo-switcher-status">Loading local accounts…</p>}
      {!loading && <div className="demo-switcher-accounts" aria-label="Local account list">
        {filteredAccounts.length === 0 && <p className="demo-switcher-status">No matching demo account. Try another name or location.</p>}
        {filteredAccounts.map(account =>
          <button key={account.id} type="button" className={'demo-switcher-account' + (current.id === account.id ? ' is-current' : '')}
            disabled={!!busy || !account.active || current.id === account.id}
            onClick={() => void switchTo(account.id)}>
            <span className="demo-switcher-avatar" aria-hidden="true">{account.name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}</span>
            <span className="demo-switcher-identity"><strong>{account.name}</strong>
              <small>{account.role === 'admin' ? 'Administrator' : account.role === 'teacher' ? 'Teacher' : 'Student'} · {
                current.role === 'teacher' && account.role === 'student' ? 'demo test identity' : account.email
              }</small>
              {account.homeArea && !(current.role === 'teacher' && account.role === 'student') &&
                <small>{account.homeArea.locality}, {account.homeArea.city}</small>}
              {!account.active && <small>Suspended — reactivate from admin</small>}
            </span>
            <span className="demo-switcher-action">
              {current.id === account.id ? <><Check size={15}/> Current</> : !account.active ? 'Inactive' : busy === account.id ? 'Switching…' : <><ArrowRight size={15}/> Switch</>}
            </span>
          </button>,
        )}
      </div>}
      <div className="demo-switcher-creator">
        <button type="button" className="demo-switcher-new" aria-expanded={creating} aria-controls="demo-switcher-form"
          onClick={() => { setCreating(v => !v); setError(''); }}><Plus size={16}/>{creating ? 'Close new account form' : 'Create a test student or teacher'}</button>
        {creating && <form id="demo-switcher-form" onSubmit={event => void create(event)}>
          <label>Display name<input required maxLength={60} value={name} placeholder="e.g. Priya Sharma" onChange={event => setName(event.target.value)}/></label>
          <div className="demo-switcher-form-grid">
            <label>Account type<select value={role} onChange={event => setRole(event.target.value as Role)}>
              <option value="student">Student</option><option value="teacher">Teacher</option>
            </select></label>
            <div className="home-area-group">
              <p className="field-help">Tap the map to set the new test account’s home neighbourhood.</p>
              <HomeAreaPicker value={homeArea} onChange={setHomeArea} center={catalog.center}/>
            </div>
            <label>Subject<select value={subject} onChange={event => setSubject(event.target.value)}>
              {catalog.subjects.map(value => <option value={value} key={value}>{value}</option>)}
            </select></label>
            <label>Class level<select value={grade} onChange={event => setGrade(event.target.value)}>
              {catalog.grades.map(value => <option value={value} key={value}>{value}</option>)}
            </select></label>
          </div>
          <p>Creates a fictional account with a published starter listing, ready for matching. The email and password are generated for testing.</p>
          <button className="primary-button" type="submit" disabled={!!busy || !name.trim() || !homeArea?.city.trim() || !homeArea?.locality.trim()}>
            {busy === 'create' ? 'Creating…' : 'Create and switch to account'} <ArrowRight size={16}/>
          </button>
        </form>}
      </div>
    </section>}
  </div>;
}
