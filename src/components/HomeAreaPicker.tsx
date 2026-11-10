import { useEffect, useRef, useState } from 'react';
import '../maplibreSetup';
import * as maplibregl from 'maplibre-gl';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import type { HomeArea, Point } from '../../shared/domain';
import { ATLAS_STYLE_URL, applyAtlasTheme } from '../atlasTheme';
import { searchPlaces, type PlaceResult } from '../services/placeSearch';
import { approximateHomePoint, reverseHomeArea } from '../services/homeArea';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  value: HomeArea | null;
  onChange: (area: HomeArea | null) => void;
  center: Point;
  disabled?: boolean;
}

export function HomeAreaPicker({ value, onChange, center, disabled = false }: Props) {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const initial = useRef(value ?? center);
  // Keep the exact tap/drag location in memory for the visible pin. Only a
  // rounded kilometre-scale coordinate is passed to persisted account state.
  const selectedPoint = useRef<Point | null>(value ? { lat: value.lat, lng: value.lng } : null);
  const [visiblePoint, setVisiblePoint] = useState<Point | null>(selectedPoint.current);
  const onChangeRef = useRef(onChange);
  const requestIndex = useRef(0);
  const [search, setSearch] = useState('');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!mapNode.current || disabled) return;
    const instance = new maplibregl.Map({
      container: mapNode.current,
      style: ATLAS_STYLE_URL,
      center: [initial.current.lng, initial.current.lat],
      zoom: 13, minZoom: 2, maxZoom: 18,
      scrollZoom: false, dragRotate: false, pitchWithRotate: false,
    });
    map.current = instance;
    const canvasNode = mapNode.current;
    canvasNode.dataset.mapStatus = 'loading';
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    instance.on('style.load', () => applyAtlasTheme(instance));
    instance.on('idle', () => {
      canvasNode.dataset.mapStatus = 'ready';
    });
    instance.on('error', (event) => {
      console.warn('Home area basemap failed to load:', event.error);
      canvasNode.dataset.mapStatus = 'error';
      setError('Map is temporarily unavailable. Try searching for a place.');
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(mapNode.current);
    instance.on('click', event => { void place({ lat: event.lngLat.lat, lng: event.lngLat.lng }); });
    return () => {
      requestIndex.current++;
      resize.disconnect();
      marker.current?.remove();
      instance.remove();
      marker.current = null;
      map.current = null;
    };
  }, [disabled]);

  // When a saved area is loaded, show its approximate pin. After the user
  // selects a new location, keep the pin on the actual selected pixel instead
  // of snapping it to the rounded coordinate used for privacy.
  useEffect(() => {
    if (!value) {
      selectedPoint.current = null;
      setVisiblePoint(null);
      return;
    }
    const selected = selectedPoint.current;
    const coarse = selected ? approximateHomePoint(selected) : null;
    if (coarse?.lat === value.lat && coarse.lng === value.lng) return;
    selectedPoint.current = { lat: value.lat, lng: value.lng };
    setVisiblePoint({ lat: value.lat, lng: value.lng });
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!visiblePoint) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) marker.current.setLngLat([visiblePoint.lng, visiblePoint.lat]);
    else {
      const element = document.createElement('div');
      element.className = 'home-area-marker';
      const pin = document.createElement('span');
      pin.setAttribute('aria-hidden', 'true');
      element.appendChild(pin);
      element.title = 'Drag to adjust your home neighbourhood marker';
      const selected = new maplibregl.Marker({ element, anchor: 'bottom', draggable: true })
        .setLngLat([visiblePoint.lng, visiblePoint.lat]).addTo(instance);
      selected.on('dragend', () => {
        const dragged = selected.getLngLat();
        void place({ lat: dragged.lat, lng: dragged.lng });
      });
      marker.current = selected;
    }
  }, [visiblePoint?.lat, visiblePoint?.lng, disabled]);

  async function place(point: Point) {
    if (disabled) return;
    const index = ++requestIndex.current;
    const exact = { lat: point.lat, lng: point.lng };
    const approximate = approximateHomePoint(exact);
    selectedPoint.current = exact;
    setVisiblePoint(exact);
    setError('');
    setPlaces([]);
    setResolving(true);
    onChangeRef.current({ ...approximate, city: '', locality: '' });
    try {
      // Lookup the selected location, not a rounded point up to ~700 m away.
      const found = await reverseHomeArea(exact);
      if (index !== requestIndex.current) return;
      onChangeRef.current({ ...approximate, city: found.city ?? '', locality: found.locality ?? '' });
      if (!found.city || !found.locality)
        setError('The map could not identify both names. Please fill in the missing city or locality below.');
    } catch {
      if (index === requestIndex.current)
        setError('Place lookup unavailable. Please enter the city and locality below.');
    } finally {
      if (index === requestIndex.current) setResolving(false);
    }
  }

  async function find() {
    setError('');
    setSearching(true);
    setPlaces([]);
    try {
      const results = await searchPlaces(search);
      setPlaces(results);
      if (!results.length) setError('No matching place found. Try a nearby city or area.');
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setSearching(false); }
  }

  function select(placeResult: PlaceResult) {
    setSearch(placeResult.label);
    setPlaces([]);
    map.current?.flyTo({ center: [placeResult.point.lng, placeResult.point.lat], zoom: 14, duration: 450 });
    void place(placeResult.point);
  }

  function deviceLocation() {
    if (!navigator.geolocation) { setError('Your browser does not support device location.'); return; }
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.current?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 14 });
        void place({ lat: coords.latitude, lng: coords.longitude });
      },
      () => setError('Location permission denied or unavailable. You can search or tap the map.'),
      { enableHighAccuracy: false, timeout: 9000 },
    );
  }

  if (disabled) return <div className="home-area-locked">
    <MapPin size={20}/><div><strong>{value?.locality || 'Home area not set'}, {value?.city || 'Unknown city'}</strong>
      <p>Your public pin is approximate. Home area changes are temporarily locked.</p></div>
  </div>;

  return <div className="home-area-picker">
    <div className="home-area-search">
      <Search size={16}/>
      <input aria-label="Find a city or neighbourhood" placeholder="Search for a city or neighbourhood" value={search} maxLength={140}
        onChange={event => { setSearch(event.target.value); setPlaces([]); setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (!searching && search.trim().length >= 3) void find(); } }}/>
      <button type="button" onClick={() => void find()} disabled={searching || search.trim().length < 3}>{searching ? 'Finding…' : 'Find'}</button>
    </div>
    {places.length > 0 && <div className="home-area-results" role="list" aria-label="Places found">
      {places.map(placeResult => <button type="button" key={placeResult.id} role="listitem" onClick={() => select(placeResult)}>
        <MapPin size={14}/>{placeResult.label}
      </button>)}
    </div>}
    <div className="home-area-map-wrap">
      <div ref={mapNode} className="home-area-map" aria-label="Tap the map to place a marker or drag an existing marker to adjust it"/>
      <button type="button" className="home-area-locate" onClick={deviceLocation}><LocateFixed size={15}/> Use my location</button>
    </div>
    <p className="field-help home-area-help">
      Tap the map to place the pin, or drag the pin to adjust its location.
      Your saved location is rounded to about 1 km for privacy.
    </p>
    <div className="home-area-fields">
      <label>City<input required maxLength={90} placeholder="Filled from map" value={value?.city ?? ''}
        onChange={event => value && onChange({ ...value, city: event.target.value })}/></label>
      <label>Locality<input required maxLength={100} placeholder="Filled from map" value={value?.locality ?? ''}
        onChange={event => value && onChange({ ...value, locality: event.target.value })}/></label>
    </div>
    {resolving && <p role="status" className="home-area-status">Finding city and locality from the marker…</p>}
    {error && <p role="status" className="home-area-error">{error}</p>}
    {value && !resolving && !!value.city && !!value.locality &&
      <p className="home-area-status">Selected: {value.locality}, {value.city}. Your exact address is not saved.</p>}
  </div>;
}
