import { useCallback, useState, type FormEvent } from 'react';
import { ArrowDownWideNarrow, BookOpen, ChevronDown, GraduationCap, Heart, List, Map, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { defaultFilters, type Catalog, type DiscoveryListing, type Filters, type Role } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice, ListingCard, ListingDetails, Modal, money } from './Common';
import { DiscoveryMap } from './DiscoveryMap';

interface ExploreProps {
  catalog: Catalog;
  role: Role;
  onChat: (id: string) => void;
  notify: (message: string) => void;
}
const emptyListings: DiscoveryListing[] = [];

export function Explore({ catalog, role, onChat, notify }: ExploreProps) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DiscoveryListing | null>(null);
  const [bookingTarget, setBookingTarget] = useState<DiscoveryListing | null>(null);
  const [mobileMap, setMobileMap] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState('');
  const [patches, setPatches] = useState<Record<string, Partial<DiscoveryListing>>>({});
  const load = useCallback((signal: AbortSignal) => api.discover(role, filters, signal), [role, filters]);
  const { data, error, refresh } = useResource(load, 140);
  const listings = data?.listings ?? emptyListings;
  const active = listings.find((item) => item.id === selected) ?? listings[0] ?? null;
  const currentDetail = detail && { ...detail, ...patches[detail.id] };
  const people = role === 'student' ? 'tutors' : 'learners';
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== defaultFilters[key as keyof Filters]);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((previous) => ({ ...previous, [key]: value }));

  function open(item: DiscoveryListing) {
    setMutationError('');
    setSelected(item.id);
    setDetail(item);
  }

  function select(id: string) {
    setSelected(id);
    document.getElementById('card-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function save(item: DiscoveryListing) {
    if (busy) return;
    setBusy(item.id);
    setMutationError('');
    try {
      await api.save(role, item.id, !item.saved);
      refresh();
      notify(item.saved ? 'Removed from saved listings.' : 'Listing saved.');
    } catch (error) { setMutationError((error as Error).message); }
    finally { setBusy(null); }
  }

  async function book(item: DiscoveryListing, details: {
    subject: string; grade: string; startsAt: string; durationMinutes: number; note: string;
  }) {
    if (busy) return;
    setBusy(item.id);
    setMutationError('');
    try {
      await api.bookClass(item.id, details);
      setPatches(previous => ({ ...previous, [item.id]: { connection: 'pending' } }));
      setBookingTarget(null);
      refresh();
      notify('Class request sent. The tutor can accept or decline it in Bookings.');
    } catch (error) { setMutationError((error as Error).message); }
    finally { setBusy(null); }
  }

  return <main id="main" className="explore-shell">
    <section className="explore-list" aria-label="Explore nearby listings">
      <div className="hero">
        <p className="eyebrow hero-eyebrow"><span/> THE NEIGHBOURHOOD TUTOR NETWORK</p>
        <h1>{role === 'student' ? 'Good tutors.' : 'Good learners.'}<br/><em>Close to home.</em></h1>
        <p className="hero-copy">{role === 'student' ? 'Find a home tutor nearby, compare rates and request your first class. The tutor will confirm availability.' : 'Find learners near you, see what they need help with, and connect when the interest is mutual.'}</p>
        <p className="explore-role-note">{role === 'student' ? 'Showing tutors near your saved home neighbourhood. Quotes include distance-based travel fees.' : 'Showing nearby students. Their learning strengths and support needs appear on their profiles.'}</p>
      </div>
      <div className="search-panel">
        <label className="dibya-search-label" htmlFor="explore-search">Who or what are you looking for?</label>
        <div className="search-bar">
          <Search size={20}/>
          <input id="explore-search" aria-label="Search listings" placeholder={role === 'student' ? 'Tutor name, subject or neighbourhood' : 'Learner name, subject or area'} value={filters.query} onChange={(event) => update('query', event.target.value)}/>
          {filters.query && <button type="button" className="icon-button clear-search" onClick={() => update('query', '')} aria-label="Clear search"><X size={17}/></button>}
          <span className="area-select" title="Distances are calculated from your saved map marker"><MapPin size={17}/> My saved area</span>
        </div>
        <div className="filter-row">
          <label className="filter-pill"><BookOpen size={15}/><select aria-label="Subject" value={filters.subject} onChange={(event) => update('subject', event.target.value)}><option value="">Subject</option>{catalog.subjects.map((subject) => <option key={subject}>{subject}</option>)}</select><ChevronDown size={12}/></label>
          <label className="filter-pill"><GraduationCap size={16}/><select aria-label="Class level" value={filters.grade} onChange={(event) => update('grade', event.target.value)}><option value="">Class level</option>{catalog.grades.map((grade) => <option key={grade}>{grade}</option>)}</select><ChevronDown size={12}/></label>
          <button type="button" className="filter-pill" aria-expanded={moreFilters} aria-controls="advanced-filters" onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal size={15}/> More filters{(filters.radius || filters.maxRate) && <i/>}</button>
          <button type="button" className="filter-pill saved-filter" aria-pressed={filters.saved} onClick={() => update('saved', !filters.saved)}><Heart size={16}/> Saved tutors</button>
        </div>
        {moreFilters && <div className="advanced-filters" id="advanced-filters">
          <label>Distance from area<select value={filters.radius} onChange={(event) => update('radius', event.target.value)}><option value="">Any distance</option><option value="2">Within 2 km</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option></select></label>
          <label>Maximum hourly {role === 'student' ? 'rate' : 'budget'}<select value={filters.maxRate} onChange={(event) => update('maxRate', event.target.value)}><option value="">Any amount</option><option value="400">₹400 per hour</option><option value="500">₹500 per hour</option><option value="650">₹650 per hour</option><option value="800">₹800 per hour</option></select></label>
        </div>}
      </div>
      <div className="results-bar">
        <div aria-live="polite"><h2>{filters.saved ? 'Saved ' + people : 'Nearby ' + people}</h2><p>{data ? listings.length + ' ' + (listings.length === 1 ? people.slice(0, -1) : people) + ' found' : 'Loading listings…'}</p></div>
        <label className="sort-select"><ArrowDownWideNarrow size={16}/><select aria-label="Sort listings" value={filters.sort} onChange={(event) => update('sort', event.target.value)}><option value="distance">Nearest first</option><option value="rate">Lowest price</option></select><ChevronDown size={12}/></label>
      </div>
      <div className="mobile-switch" aria-label="Results view"><button type="button" aria-pressed={!mobileMap} onClick={() => setMobileMap(false)}><List size={17}/> List</button><button type="button" aria-pressed={mobileMap} onClick={() => setMobileMap(true)}><Map size={17}/> Map</button></div>
      {error && <ErrorNotice message={error} retry={refresh}/>}
      {mutationError && !detail && <ErrorNotice message={mutationError}/>}
      {!mobileMap && <span className="sr-only">Listings are shown below.</span>}
      <div className={'listing-grid' + (mobileMap ? ' mobile-list-hidden' : '')}>
        {!data && !error && Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index} aria-hidden="true"/>)}
        {listings.map((item) => <ListingCard key={item.id} item={item} selected={active?.id === item.id} busy={busy !== null} onOpen={() => open(item)} onSave={() => void save(item)}/>)}
        {data && !listings.length && <div className="empty-state"><Search size={24}/><h3>{filters.saved ? 'No saved listings here' : 'No matching listings'}</h3><p>{filters.saved ? 'Use the heart on a profile card to save it for later.' : 'Try another subject or widen your search area.'}</p>{hasFilters && <button type="button" className="secondary-button" onClick={() => setFilters(defaultFilters)}>Clear filters</button>}</div>}
      </div>
      <p className="explore-foot">{catalog.demo ? 'Shikshak pilot · Demo profiles are interactive' : 'Shikshak'}<span>Map pins are approximate. Your exact address stays private.</span></p>
    </section>
    <DiscoveryMap catalog={catalog} listings={listings} origin={data?.origin} active={active} onSelect={select} onOpen={open} mobileVisible={mobileMap}/>
    {currentDetail && <Modal title={currentDetail.name} onClose={() => { setDetail(null); setMutationError(''); }}>
      <ListingDetails listing={currentDetail} status={currentDetail.connection} busy={busy !== null}
        onBook={() => { setBookingTarget(currentDetail); setDetail(null); }} onChat={() => onChat(currentDetail.id)}/>
      {mutationError && <ErrorNotice message={mutationError}/>}
    </Modal>}
    {bookingTarget && <BookingForm teacher={bookingTarget} busy={busy !== null}
      error={mutationError} close={() => { setBookingTarget(null); setMutationError(''); }}
      submit={details => void book(bookingTarget, details)}/>}
  </main>;
}


function firstPossibleClass(): string {
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(17, 0, 0, 0);
  const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function BookingForm({ teacher, busy, error, close, submit }: {
  teacher: DiscoveryListing; busy: boolean; error: string; close: () => void;
  submit: (details: {
    subject: string; grade: string; startsAt: string; durationMinutes: number; note: string;
  }) => void;
}) {
  const [subject, setSubject] = useState(teacher.subjects[0] ?? '');
  const [grade, setGrade] = useState(teacher.grades[0] ?? '');
  const [startsAt, setStartsAt] = useState(firstPossibleClass);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [note, setNote] = useState('');
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject || !grade || !startsAt || new Date(startsAt).getTime() < Date.now() + 15 * 60000) return;
    submit({ subject, grade, startsAt: new Date(startsAt).toISOString(), durationMinutes, note: note.trim() });
  }
  return <Modal title={'Request a class with ' + teacher.name} onClose={close}>
    <div className="booking-form-heading">
      <p className="eyebrow">REQUEST YOUR FIRST CLASS</p>
      <h2>Book a class with {teacher.name}.</h2>
      <p>Choose your preferred time. The tutor will accept or decline before messaging and classroom tools open.</p>
      <strong>{money(teacher.rate)} / hr <small>(includes the current distance-based travel fee)</small></strong>
    </div>
    {error && <ErrorNotice message={error}/>}
    <form className="booking-form" onSubmit={confirm}>
      <div className="booking-form-grid">
        <label>Subject<select value={subject} required onChange={event => setSubject(event.target.value)}>
          {teacher.subjects.map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label>Class level<select value={grade} required onChange={event => setGrade(event.target.value)}>
          {teacher.grades.map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label>Preferred first class<input type="datetime-local" required value={startsAt}
          min={new Date(Date.now() + 15 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
          onChange={event => setStartsAt(event.target.value)}/></label>
        <label>Duration<select value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))}>
          <option value={30}>30 minutes</option><option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option><option value={90}>90 minutes</option>
          <option value={120}>120 minutes</option>
        </select></label>
      </div>
      <label>Message to tutor (optional)<textarea rows={3} maxLength={600} value={note}
        placeholder="What would you like to learn in your first class?"
        onChange={event => setNote(event.target.value)}/></label>
      <p className="booking-form-privacy">Your home location and student Explore profile are not shared with the tutor.</p>
      <button className="primary-button" type="submit" disabled={busy || !subject || !grade || new Date(startsAt).getTime() < Date.now() + 15 * 60000}>
        {busy ? 'Sending request…' : 'Request class'}
      </button>
    </form>
  </Modal>;
}
