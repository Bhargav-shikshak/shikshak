import { useCallback, useState, type FormEvent } from 'react';
import { BarChart3, Check, CircleDollarSign, ShieldAlert, ShieldCheck, Users, X } from 'lucide-react';
import type { AdminSnapshot, PriceSettings, PublicAccount } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice, money } from './Common';

export function Admin() {
  const { data, error, refresh } = useResource(useCallback((signal: AbortSignal) => api.admin(signal), []));
  const [pricing, setPricing] = useState<PriceSettings | null>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'teacher' | 'student'>('all');
  const values = pricing ?? data?.settings ?? null;
  const members = data?.accounts.filter(member =>
    member.role !== 'admin' &&
    (filter === 'all' || (filter === 'pending' ? member.rateStatus === 'pending' : member.role === filter))) ?? [];

  async function changePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || busy) return;
    setBusy('settings'); setFailure(''); setNotice('');
    try { await api.setPricing(values); setPricing(null); setNotice('Platform pricing updated. Student quotes now use the new rules.'); refresh(); }
    catch (cause) { setFailure((cause as Error).message); }
    finally { setBusy(''); }
  }
  async function action(member: PublicAccount, operation: 'approve' | 'reject' | 'suspend' | 'activate' | 'hide') {
    const key = member.id + ':' + operation;
    if (busy) return;
    setBusy(key); setNotice(''); setFailure('');
    try {
      await api.adminAction(member.id, operation);
      setNotice(member.name + ': ' + (operation === 'approve' ? 'custom rate approved' : operation === 'reject' ? 'rate request declined' : operation === 'hide' ? 'listing hidden' : operation === 'activate' ? 'account reactivated' : 'account suspended') + '.');
      refresh();
    } catch (cause) { setFailure((cause as Error).message); }
    finally { setBusy(''); }
  }
  return <main id="main" className="workspace-page admin-page">
    <div className="workspace-heading"><p className="eyebrow hero-eyebrow"><span/> RESTRICTED PLATFORM CONTROL</p><h1>Admin console.</h1><p>Manage members, tutor-rate approvals and platform pricing. All actions are checked on the server.</p></div>
    {error && <ErrorNotice message={error} retry={refresh}/>}
    {failure && <ErrorNotice message={failure}/>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {!data && !error && <p role="status">Loading administration…</p>}
    {data && <div className="admin-stats">
      <div><Users size={19}/><strong>{data.accounts.filter(x => x.role !== 'admin').length}</strong><span>Members</span></div>
      <div><ShieldCheck size={19}/><strong>{data.publishedListings}</strong><span>Published listings</span></div>
      <div><BarChart3 size={19}/><strong>{data.matchedPairs}</strong><span>Mutual matches</span></div>
      <div><ShieldAlert size={19}/><strong>{data.pendingRates}</strong><span>Rates to review</span></div>
    </div>}
    <div className="admin-columns">
      <section className="workspace-panel">
        <div className="admin-section-title"><h2>Members and approvals</h2><span>{members.length} shown</span></div>
        <div className="admin-filter" aria-label="Filter members">{(['all', 'pending', 'teacher', 'student'] as const).map(value =>
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'pending' ? 'Price requests' : value === 'all' ? 'All' : value === 'teacher' ? 'Teachers' : 'Students'}</button>
        )}</div>
        <div className="admin-people">
          {members.length === 0 && <p className="admin-empty">No members in this view.</p>}
          {members.map(member => <article key={member.id} className="admin-person">
            <div className="admin-person-head"><div><strong>{member.name}</strong><small>{member.email}</small></div><span className={member.active ? 'admin-active' : 'admin-inactive'}>{member.active ? 'Active' : 'Suspended'}</span></div>
            <p>{member.role === 'teacher' ? 'Teacher' : 'Student'} · {member.localityId} · Joined {new Date(member.createdAt).toLocaleDateString('en-IN')}</p>
            {member.role === 'teacher' && <p>Approved base: {member.approvedRate === null ? 'Platform rate' : money(member.approvedRate)} · Request: {member.rateStatus}</p>}
            {member.rateStatus === 'pending' && member.requestedRate !== null && <div className="admin-rate-request"><span>Requested: <strong>{money(member.requestedRate)} / hr</strong></span>
              <button type="button" disabled={!!busy} onClick={() => void action(member, 'approve')}><Check size={14}/> Approve</button>
              <button type="button" disabled={!!busy} onClick={() => void action(member, 'reject')}><X size={14}/> Decline</button>
            </div>}
            <div className="admin-member-actions">
              <button type="button" disabled={!!busy} onClick={() => void action(member, member.active ? 'suspend' : 'activate')}>{member.active ? 'Suspend account' : 'Reactivate account'}</button>
              <button type="button" disabled={!!busy} onClick={() => void action(member, 'hide')}>Hide listing</button>
            </div>
          </article>)}
        </div>
      </section>
      <aside className="workspace-panel">
        <div className="admin-section-title"><h2>Platform pricing</h2><CircleDollarSign size={21}/></div>
        <p className="admin-intro">Student quotes combine an hourly base with capped travel fees, calculated from the student's saved home neighbourhood to the tutor's neighbourhood. A teacher's approved rate replaces the base only.</p>
        {values && <form className="admin-pricing-form" onSubmit={changePricing}>
          {([
            ['baseRate', 'Platform base (₹/hour)'],
            ['freeRadiusKm', 'Travel included within (km)'],
            ['distanceStepKm', 'Additional distance step (km)'],
            ['stepFee', 'Charge per extra step (₹)'],
            ['maxTravelFee', 'Maximum travel supplement (₹)'],
          ] as const).map(([key, label]) => <label key={key}>{label}
            <input type="number" required min={key === 'baseRate' ? 100 : key === 'distanceStepKm' ? .1 : 0} max={key === 'baseRate' ? 10000 : key === 'stepFee' ? 2000 : key === 'maxTravelFee' ? 5000 : 30} step={key.includes('Km') ? .1 : 1} value={values[key]} onChange={event => setPricing(current => ({ ...(current ?? data!.settings), [key]: Number(event.target.value) }))}/>
          </label>)}
          <button type="submit" className="primary-button" disabled={!!busy}>Save pricing policy</button>
        </form>}
        <p className="aside-note">Pricing is an indicative hourly quote, not a payment or completed booking. Student and tutor addresses are not published.</p>
      </aside>
    </div>
  </main>;
}
