import { useEffect, useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { ErrorNotice } from './Common';

type MFAStatus = Awaited<ReturnType<typeof api.ownerMfaStatus>>;
type Enrollment = Awaited<ReturnType<typeof api.ownerMfaEnroll>>;

/** TOTP setup and step-up for owners; enrollment secrets are never persisted client-side. */
export function OwnerSecurity() {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api.ownerMfaStatus().then(value => { if (active) setStatus(value); })
      .catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, []);

  async function enroll() {
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await api.ownerMfaEnroll();
      setEnrollment(value);
      setNotice('Add this factor to your authenticator app, then enter its six-digit code.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const factorId = enrollment?.factorId ?? status?.factors.find(f => f.status === 'verified')?.id;
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.ownerMfaVerify(factorId, code);
      setStatus(await api.ownerMfaStatus());
      setEnrollment(null);
      setCode('');
      setNotice('Two-factor authentication completed for this session.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  const activeFactor = status?.factors.find(f => f.status === 'verified');
  const secure = status?.aal === 'aal2';
  return <section className="workspace-panel" aria-label="Owner two-factor authentication">
    <div className="admin-section-title"><h2><LockKeyhole size={20}/> Owner account security</h2><ShieldCheck size={20}/></div>
    {status === null && !error && <p role="status">Checking your security status…</p>}
    {secure ? <p className="form-success" role="status">Two-factor authentication verified. Owner-level changes are unlocked for this session.</p>
      : <p className="admin-intro">Changing owner/admin roles or travel pricing requires a verified authenticator code (AAL2). Password-only sessions cannot make these changes.</p>}
    {error && <ErrorNotice message={error}/>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {!secure && status && !activeFactor && !enrollment && <button className="secondary-button" type="button" disabled={busy} onClick={() => void enroll()}>Set up authenticator app</button>}
    {enrollment && <div className="editor-form">
      <p>Scan this QR code in your authenticator app, or enter the secret manually. Keep the secret private.</p>
      {enrollment.qrCode && <img width="180" height="180" alt="TOTP setup QR code" src={enrollment.qrCode}/>}
      <label>Authenticator setup secret<input readOnly value={enrollment.secret} autoComplete="off"/></label>
    </div>}
    {!secure && (activeFactor || enrollment) && <form className="editor-form" onSubmit={verify}>
      <label>Six-digit authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
        autoComplete="one-time-code" placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/></label>
      <button className="primary-button" type="submit" disabled={busy || code.length !== 6}>Verify two-factor code</button>
    </form>}
    <p className="aside-note">Losing your authenticator may require recovery by the Supabase project owner. Enroll a second factor before relying on this for a public launch.</p>
  </section>;
}
