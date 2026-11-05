import { useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, GraduationCap, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Catalog, HomeArea, PublicAccount, Role } from '../../shared/domain';
import { api, isBrowserDemo } from '../api';
import { demoAccounts, DEMO_PASSWORD } from '../demoAccounts';
import { ErrorNotice } from './Common';
import { HomeAreaPicker } from './HomeAreaPicker';

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
  const localityId = catalog.defaultLocality;
  const [homeArea, setHomeArea] = useState<HomeArea | null>(null);
  const [setupToken, setSetupToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function useDemoAccount(kind: 'student' | 'teacher' | 'admin') {
    const example = demoAccounts[kind];
    setMode('login');
    setEmail(example.email);
    setPassword(DEMO_PASSWORD);
    setError('');
  }
  async function resetDemo() {
    if (!window.confirm('Reset all Shikshak demo accounts, matches, messages and classwork stored in this browser? This cannot be undone.')) return;
    try {
      const { resetBrowserDemo } = await import('../services/browserDemo');
      await resetBrowserDemo();
      window.location.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup' && (!homeArea?.city.trim() || !homeArea?.locality.trim()))
        throw new Error('Place your home neighbourhood marker and confirm the city and locality.');
      const account = mode === 'bootstrap'
        ? await api.bootstrapAdmin({ name, email, password, localityId, setupToken })
        : mode === 'signup'
          ? await api.signup({ name, email, password, role, localityId, homeArea: homeArea! })
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
      {isBrowserDemo && <div className="browser-demo-notice" role="note">
        <strong>Browser demo mode</strong>
        <span>Accounts, messages and classes are stored only in this browser. They do not sync with other devices. Use fictional details and a test password, not real student information.</span>
      </div>}
      {isBrowserDemo && <div className="demo-login-choices" aria-label="Try a sample account">
        <p>Try a demo account <small>Shared test password: {DEMO_PASSWORD}</small></p>
        <div className="demo-login-buttons">
          {admin
            ? <button type="button" onClick={() => useDemoAccount('admin')}>Use demo administrator</button>
            : <>
              <button type="button" onClick={() => useDemoAccount('student')}><BookOpen size={15}/> Use demo student</button>
              <button type="button" onClick={() => useDemoAccount('teacher')}><GraduationCap size={15}/> Use demo teacher</button>
            </>}
        </div>
      </div>}
      {!admin && <div className="auth-tabs">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
      </div>}
      {admin && !isBrowserDemo && <div className="auth-tabs">
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
        {mode === 'signup' && <div className="home-area-group">
          <h3>Choose your home neighbourhood</h3>
          <p className="field-help">Place the marker near your neighbourhood, not your home address. The city and locality will fill automatically.</p>
          <HomeAreaPicker value={homeArea} onChange={setHomeArea} center={catalog.center}/>
          <p className="field-help">After signup, home location can be changed only once every 30 days.</p>
        </div>}
        {mode === 'bootstrap' && <label>Server setup key<input required type="password" autoComplete="off" value={setupToken} onChange={event => setSetupToken(event.target.value)} placeholder="ADMIN_BOOTSTRAP_TOKEN"/></label>}
        {error && <ErrorNotice message={error}/>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'bootstrap' ? 'Create administrator' : 'Create my account'}<ArrowRight size={17}/></button>
      </form>
      {mode === 'signup' && <p className="auth-footnote"><LockKeyhole size={15}/> Your role is tied to your account. You can edit your profile after signing up.</p>}
      {admin && !isBrowserDemo && <p className="auth-footnote">The first administrator requires a server-configured setup key. No public admin account is provided.</p>}
      {admin && isBrowserDemo && <p className="auth-footnote">This is a local testing administrator, not a privileged production account.</p>}
      {isBrowserDemo && <button type="button" className="reset-demo-button" onClick={() => void resetDemo()}>Reset local demo accounts and data</button>}
      <a className="auth-back" href={admin ? '#login' : '#admin'}>{admin ? 'Back to Shikshak' : 'Administrator access'}</a>
    </section>
  </main>;
}
