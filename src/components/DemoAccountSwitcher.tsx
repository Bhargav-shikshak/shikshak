import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronDown, Plus, Users, X } from 'lucide-react';
import type { Catalog, PublicAccount, Role } from '../../shared/domain';
import {
  createBrowserDemoAccount,
  listBrowserDemoAccounts,
  switchBrowserDemoAccount,
  type BrowserDemoAccount,
} from '../services/browserDemo';
import { ErrorNotice } from './Common';

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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [localityId, setLocalityId] = useState(catalog.defaultLocality);
  const [subject, setSubject] = useState(catalog.subjects[0] ?? 'Mathematics');
  const [grade, setGrade] = useState(catalog.grades[2] ?? catalog.grades[0] ?? '');

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
    setBusy('create');
    setError('');
    try {
      const account = await createBrowserDemoAccount({ name, role, localityId, subject, grade });
      setOpen(false);
      setCreating(false);
      setName('');
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
        <div><strong>Switch test account</strong><p>All accounts share this browser's demo data.</p></div>
        <button type="button" aria-label="Close account switcher" onClick={() => setOpen(false)}><X size={18}/></button>
      </div>
      {error && <ErrorNotice message={error}/>}
      {loading && <p role="status" className="demo-switcher-status">Loading local accounts…</p>}
      {!loading && <div className="demo-switcher-accounts" aria-label="Local account list">
        {accounts.map(account =>
          <button key={account.id} type="button" className={'demo-switcher-account' + (current.id === account.id ? ' is-current' : '')}
            disabled={!!busy || !account.active || current.id === account.id}
            onClick={() => void switchTo(account.id)}>
            <span className="demo-switcher-avatar" aria-hidden="true">{account.name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}</span>
            <span className="demo-switcher-identity"><strong>{account.name}</strong>
              <small>{account.role === 'admin' ? 'Administrator' : account.role === 'teacher' ? 'Teacher' : 'Student'} · {account.email}</small>
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
            <label>Neighbourhood<select value={localityId} onChange={event => setLocalityId(event.target.value)}>
              {catalog.localities.map(locality => <option key={locality.id} value={locality.id}>{locality.name}</option>)}
            </select></label>
            <label>Subject<select value={subject} onChange={event => setSubject(event.target.value)}>
              {catalog.subjects.map(value => <option value={value} key={value}>{value}</option>)}
            </select></label>
            <label>Class level<select value={grade} onChange={event => setGrade(event.target.value)}>
              {catalog.grades.map(value => <option value={value} key={value}>{value}</option>)}
            </select></label>
          </div>
          <p>Creates a fictional account with a published starter listing, ready for matching. The email and password are generated for testing.</p>
          <button className="primary-button" type="submit" disabled={!!busy || !name.trim()}>
            {busy === 'create' ? 'Creating…' : 'Create and switch to account'} <ArrowRight size={16}/>
          </button>
        </form>}
      </div>
    </section>}
  </div>;
}
