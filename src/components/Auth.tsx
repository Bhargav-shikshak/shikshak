import { useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, GraduationCap, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Catalog, PublicAccount, Role } from '../../shared/domain';
import { api } from '../api';
import { ErrorNotice } from './Common';

export function Auth({ catalog, onSuccess, admin = false }: {
  catalog: Catalog;
  onSuccess: (account: PublicAccount) => void;
  admin?: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'bootstrap'>('login');
  const [role, setRole] = useState<Role>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localityId, setLocalityId] = useState(catalog.defaultLocality);
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const account = mode === 'bootstrap'
        ? await api.bootstrapAdmin({ name, email, password, localityId, setupToken })
        : mode === 'signup'
          ? await api.signup({ name, email, password, role, localityId })
          : await api.login(email, password);
      if (admin && account.role !== 'admin') {
        await api.logout();
        throw new Error('This account is not an administrator.');
      }
      onSuccess(account);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <main id="main" className="auth-shell">
    <section className="auth-intro">
      <p className="eyebrow hero-eyebrow"><span/> {admin ? 'PLATFORM OPERATIONS' : 'THE NEIGHBOURHOOD TUTOR NETWORK'}</p>
      <h1>{admin ? 'Shikshak operations.' : <>Learn closer.<br/><em>Grow together.</em></>}</h1>
      <p>{admin
        ? 'Restricted site management, member moderation and pricing approvals.'
        : 'A place for students and home tutors to find each other, agree on lessons, and keep learning in one workspace.'}</p>
      <div className="auth-highlights">
        <span><BookOpen size={18}/> Find people nearby</span>
        <span><GraduationCap size={18}/> Plan lessons together</span>
        <span><ShieldCheck size={18}/> Neighbourhood-level locations</span>
      </div>
    </section>
    <section className="auth-panel" aria-label={admin ? 'Administrator authentication' : 'Account authentication'}>
      <h2>{mode === 'login' ? (admin ? 'Admin sign in' : 'Welcome back') : mode === 'bootstrap' ? 'Set up the first admin' : 'Create an account'}</h2>
      <p className="auth-subtext">{mode === 'login' ? 'Sign in with your registered email and password.' : 'Use your own details to get started.'}</p>
      {!admin && <div className="auth-tabs">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
      </div>}
      {admin && <div className="auth-tabs">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Admin log in</button>
        <button type="button" aria-pressed={mode === 'bootstrap'} onClick={() => { setMode('bootstrap'); setError(''); }}>First-time setup</button>
      </div>}
      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && <div className="auth-role-picker" aria-label="Choose account type">
          <button type="button" aria-pressed={role === 'student'} onClick={() => setRole('student')}><BookOpen size={18}/><span>I'm a student<small>Find tutors and manage learning</small></span></button>
          <button type="button" aria-pressed={role === 'teacher'} onClick={() => setRole('teacher')}><GraduationCap size={18}/><span>I'm a teacher<small>Find students and teach</small></span></button>
        </div>}
        {mode !== 'login' && <label>Your name<input required autoComplete="name" maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Full name"/></label>}
        <label>Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <label>Password<input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Your password' : 'At least 10 characters'}/></label>
        {mode !== 'login' && <label>Your neighbourhood<select value={localityId} onChange={event => setLocalityId(event.target.value)}>{catalog.localities.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>}
        {mode === 'bootstrap' && <label>Server setup key<input required type="password" autoComplete="off" value={setupToken} onChange={event => setSetupToken(event.target.value)} placeholder="ADMIN_BOOTSTRAP_TOKEN"/></label>}
        {error && <ErrorNotice message={error}/>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'bootstrap' ? 'Create administrator' : 'Create my account'}<ArrowRight size={17}/></button>
      </form>
      {mode === 'signup' && <p className="auth-footnote"><LockKeyhole size={15}/> Your role is tied to your account. You can edit your profile after signing up.</p>}
      {admin && <p className="auth-footnote">The first administrator requires a server-configured setup key. No public admin account is provided.</p>}
      <a className="auth-back" href={admin ? '#login' : '#admin'}>{admin ? 'Back to Shikshak' : 'Administrator access'}</a>
    </section>
  </main>;
}
