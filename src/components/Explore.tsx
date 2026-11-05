import { useCallback, useState } from 'react';
import { ArrowDownWideNarrow, BookOpen, ChevronDown, GraduationCap, Heart, List, Map, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { defaultFilters, type Catalog, type DiscoveryListing, type Filters, type Role } from '../../shared/domain';
import { api } from '../api';
import { useResource } from '../useResource';
import { ErrorNotice, ListingCard, ListingDetails, Modal } from './Common';
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

  async function interest(item: DiscoveryListing) {
    if (busy) return;
    setBusy(item.id);
    setMutationError('');
    try {
      const { status } = await api.interest(role, item.id);
      setPatches((previous) => ({ ...previous, [item.id]: { connection: status } }));
      refresh();
      notify(status === 'matched' ? 'It’s a match! You can now start a conversation.' : 'Interest sent.');
    } catch (error) { setMutationError((error as Error).message); }
    finally { setBusy(null); }
  }

  return <main id="main" className="explore-shell">
    <section className="explore-list" aria-label="Explore nearby listings">
      <div className="hero">
        <p className="eyebrow hero-eyebrow"><span/> THE NEIGHBOURHOOD TUTOR NETWORK</p>
        <h1>{role === 'student' ? 'Good tutors.' : 'Good learners.'}<br/><em>Close to home.</em></h1>
        <p className="hero-copy">{role === 'student' ? 'Find a home tutor nearby, see what they teach, and connect when the interest is mutual.' : 'Find learners near you, see what they need help with, and connect when the interest is mutual.'}</p>
        <p className="explore-role-note">{role === 'student' ? 'Showing tutors near your saved home neighbourhood. Quotes include distance-based travel fees.' : 'Showing nearby students. Their learning strengths and support needs appear on their profiles.'}</p>
      </div>
      <div className="search-panel">
        <div className="search-bar">
          <Search size={20}/>
          <input aria-label="Search listings" placeholder={role === 'student' ? 'Search by subject, tutor or area' : 'Search by subject, learner or area'} value={filters.query} onChange={(event) => update('query', event.target.value)}/>
          {filters.query && <button type="button" className="icon-button clear-search" onClick={() => update('query', '')} aria-label="Clear search"><X size={17}/></button>}
          <label className="area-select"><MapPin size={17}/><select aria-label="Search from neighbourhood" value={filters.locality} onChange={(event) => update('locality', event.target.value)}>
            <option value="">My area</option>{catalog.localities.map((area) => <option value={area.id} key={area.id}>{area.name}</option>)}
          </select><ChevronDown size={13}/></label>
        </div>
        <div className="filter-row">
          <label className="filter-pill"><BookOpen size={15}/><select aria-label="Subject" value={filters.subject} onChange={(event) => update('subject', event.target.value)}><option value="">Subject</option>{catalog.subjects.map((subject) => <option key={subject}>{subject}</option>)}</select><ChevronDown size={12}/></label>
          <label className="filter-pill"><GraduationCap size={16}/><select aria-label="Class level" value={filters.grade} onChange={(event) => update('grade', event.target.value)}><option value="">Class level</option>{catalog.grades.map((grade) => <option key={grade}>{grade}</option>)}</select><ChevronDown size={12}/></label>
          <button type="button" className="filter-pill" aria-expanded={moreFilters} aria-controls="advanced-filters" onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal size={15}/> Filters{(filters.radius || filters.maxRate) && <i/>}</button>
          <button type="button" className="filter-pill saved-filter" aria-pressed={filters.saved} onClick={() => update('saved', !filters.saved)}><Heart size={16}/> Saved</button>
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
      <p className="explore-foot">{catalog.demo ? 'Shikshak pilot · Fictional profiles are marked' : 'Shikshak'}<span>Map pins are approximate. Your exact address stays private.</span></p>
    </section>
    <DiscoveryMap catalog={catalog} listings={listings} origin={data?.origin} active={active} onSelect={select} onOpen={open} mobileVisible={mobileMap}/>
    {currentDetail && <Modal title={currentDetail.name} onClose={() => { setDetail(null); setMutationError(''); }}>
      <ListingDetails listing={currentDetail} status={currentDetail.connection} busy={busy !== null} onInterest={() => void interest(currentDetail)} onChat={() => onChat(currentDetail.id)}/>
      {mutationError && <ErrorNotice message={mutationError}/>}
    </Modal>}
  </main>;
}
