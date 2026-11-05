import { useCallback, useState, type FormEvent } from 'react';
import { BadgeCheck, BarChart3, CircleDollarSign, ShieldCheck, ShieldAlert, Users } from 'lucide-react';
import type { PriceSettings, PublicAccount } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice } from './Common';
import { isBrowserDemo } from '../api';
import { OwnerSecurity } from './OwnerSecurity';

type MemberAction = 'verify' | 'unverify' | 'suspend' | 'activate' | 'hide';
type StaffAction = 'make-admin' | 'make-owner' | 'revoke-staff';

export function Admin() {
  const { data, error, refresh } = useResource(useCallback((signal: AbortSignal) => api.admin(signal), []));
  const [pricing, setPricing] = useState<PriceSettings | null>(null);
  const [filter, setFilter] = useState<'all' | 'review' | 'teacher' | 'student' | 'staff'>('all');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const isOwner = data?.viewerRole === 'owner';
  const values = pricing ?? data?.settings ?? null;
  const members = data?.accounts.filter(member =>
    filter === 'all' ||
    (filter === 'review' && member.role === 'teacher' && !member.teacherVerified) ||
    (filter === 'staff' && (member.role === 'owner' || member.role === 'admin')) ||
    member.role === filter
  ) ?? [];

  async function run(member: PublicAccount, action: MemberAction | StaffAction) {
    if (busy) return;
    const staff = action === 'make-owner' || action === 'make-admin' || action === 'revoke-staff';
    if (staff && !window.confirm(
      'Change platform access for ' + member.name + '? This changes their server-enforced permissions.'
    )) return;
    if ((action === 'verify' || action === 'unverify') && !window.confirm(
      (action === 'verify' ? 'Verify ' : 'Revoke verification for ') + member.name + '?'
    )) return;
    setBusy(member.id + ':' + action); setNotice(''); setFailure('');
    try {
      if (staff) await api.staffRole(member.id, action as StaffAction);
      else await api.adminAction(member.id, action as MemberAction);
      setNotice(member.name + ': ' + action.replaceAll('-', ' ') + ' completed.');
      refresh();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally { setBusy(''); }
  }

  async function updateTravel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || busy) return;
    setBusy('pricing'); setNotice(''); setFailure('');
    try {
      await api.setPricing(values);
      setPricing(null);
      setNotice('Distance supplement rules updated; each teacher still sets their own base hourly price.');
      refresh();
    } catch (cause) { setFailure((cause as Error).message); }
    finally { setBusy(''); }
  }

  return <main id="main" className="workspace-page admin-page">
    <div className="workspace-heading">
      <p className="eyebrow hero-eyebrow"><span/> {isOwner ? 'OWNER ACCESS' : 'PLATFORM OPERATIONS'}</p>
      <h1>{isOwner ? 'Owner console.' : 'Admin console.'}</h1>
      <p>Verify teachers and moderate listings. Owners additionally manage staff access and distance pricing.</p>
    </div>
    {error && <ErrorNotice message={error} retry={refresh}/>}
    {failure && <ErrorNotice message={failure}/>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {!data && !error && <p role="status">Loading administration…</p>}
    {isOwner && !isBrowserDemo && <OwnerSecurity/>}
    {data && <div className="admin-stats">
      <div><Users size={19}/><strong>{data.accounts.filter(x => x.role === 'teacher' || x.role === 'student').length}</strong><span>Members</span></div>
      <div><BadgeCheck size={19}/><strong>{data.accounts.filter(x => x.role === 'teacher' && x.teacherVerified).length}</strong><span>Verified teachers</span></div>
      <div><BarChart3 size={19}/><strong>{data.matchedPairs}</strong><span>Accepted bookings</span></div>
      <div><ShieldAlert size={19}/><strong>{data.pendingVerifications ?? 0}</strong><span>Teachers awaiting review</span></div>
    </div>}
    <div className="admin-columns">
      <section className="workspace-panel">
        <div className="admin-section-title"><h2>Accounts and verification</h2><span>{members.length} shown</span></div>
        <div className="admin-filter" aria-label="Filter members">
          {(['all', 'review', 'teacher', 'student', 'staff'] as const).map(value =>
            <button key={value} type="button" aria-pressed={filter === value}
              onClick={() => setFilter(value)}>
              {value === 'review' ? 'Needs review' : value === 'all' ? 'All' : value === 'staff' ? 'Staff' : value === 'teacher' ? 'Teachers' : 'Students'}
            </button>)}
        </div>
        <div className="admin-people">
          {members.length === 0 && <p className="admin-empty">No members in this view.</p>}
          {members.map(member => <article key={member.id} className="admin-person">
            <div className="admin-person-head">
              <div><strong>{member.name}</strong><small>{member.email}</small></div>
              <span className={member.active ? 'admin-active' : 'admin-inactive'}>
                {member.active ? 'Active' : 'Suspended'}
              </span>
            </div>
            <p>{member.role.toUpperCase()} · Joined {new Date(member.createdAt).toLocaleDateString('en-IN')}</p>
            {member.role === 'teacher' && <p>
              {member.teacherVerified ? 'Verified teacher' : 'Verification pending'} · Public badge {member.teacherVerified ? 'enabled' : 'disabled'}
            </p>}
            <div className="admin-member-actions">
              {member.role === 'teacher' && <button type="button" disabled={!!busy}
                onClick={() => void run(member, member.teacherVerified ? 'unverify' : 'verify')}>
                <BadgeCheck size={15}/>{member.teacherVerified ? 'Revoke verification' : 'Verify teacher'}
              </button>}
              {member.role !== 'owner' && member.role !== 'admin' && <>
                <button type="button" disabled={!!busy} onClick={() => void run(member, member.active ? 'suspend' : 'activate')}>
                  {member.active ? 'Suspend account' : 'Reactivate'}
                </button>
                <button type="button" disabled={!!busy} onClick={() => void run(member, 'hide')}>Hide listing</button>
              </>}
              {isOwner && <>
                {member.role !== 'owner' && <button type="button" disabled={!!busy} onClick={() => void run(member, 'make-owner')}>Make owner</button>}
                {member.role !== 'admin' && <button type="button" disabled={!!busy} onClick={() => void run(member, 'make-admin')}>Make admin</button>}
                {(member.role === 'admin' || member.role === 'owner') && <button type="button" disabled={!!busy} onClick={() => void run(member, 'revoke-staff')}>Revoke staff access</button>}
              </>}
            </div>
          </article>)}
        </div>
      </section>
      <aside className="workspace-panel">
        <div className="admin-section-title"><h2>Travel pricing policy</h2><CircleDollarSign size={21}/></div>
        <p className="admin-intro">Teachers set their own hourly rate. Students see the teacher's rate plus a distance supplement, measured between approximate neighbourhood locations.</p>
        {isOwner ? values && <form className="admin-pricing-form" onSubmit={updateTravel}>
          {([
            ['freeRadiusKm', 'Distance included (km)'],
            ['distanceStepKm', 'Additional distance step (km)'],
            ['stepFee', 'Fee per extra step (₹)'],
            ['maxTravelFee', 'Maximum distance supplement (₹)'],
          ] as const).map(([key, label]) => <label key={key}>{label}
            <input type="number" required min={key === 'distanceStepKm' ? .1 : 0}
              max={key === 'stepFee' ? 5000 : key === 'maxTravelFee' ? 10000 : 100}
              step={key.includes('Km') ? .1 : 1} value={values[key]}
              onChange={event => setPricing(current => ({ ...(current ?? data!.settings), [key]: Number(event.target.value) }))}/>
          </label>)}
          <button type="submit" className="primary-button" disabled={!!busy}>Save travel rules</button>
        </form> : <p className="aside-note">Only owners can edit distance pricing rules.</p>}
        <p className="aside-note">Prices are indicative hourly quotes. Students' and teachers' precise home addresses are not exposed.</p>
        {isOwner && <section>
          <div className="admin-section-title"><h2><ShieldCheck size={18}/> Ownership</h2></div>
          <p className="aside-note">Any owner can grant another registered account owner/admin status and revoke staff access. The last active owner cannot be removed.</p>
        </section>}
      </aside>
    </div>
  </main>;
}
