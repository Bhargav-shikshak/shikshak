import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { ArrowRight, Crosshair, Layers3, LocateFixed, MapPin, Maximize2, Minus, Plus, Search, X } from 'lucide-react';
import type { Catalog, DiscoveryListing, Point } from '../../shared/domain';
import { applyAtlasTheme, ATLAS_STYLE_URL } from '../atlasTheme';
import { searchPlaces, type PlaceResult } from '../services/placeSearch';
import { Avatar, money } from './Common';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  catalog: Catalog;
  listings: DiscoveryListing[];
  origin?: Point;
  active: DiscoveryListing | null;
  onSelect: (id: string) => void;
  onOpen: (item: DiscoveryListing) => void;
  mobileVisible: boolean;
}

export function DiscoveryMap({ catalog, listings, origin, active, onSelect, onOpen, mobileVisible }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const layer = useRef<maplibregl.Marker[]>([]);
  const locationLayer = useRef<maplibregl.Marker[]>([]);
  const selection = useRef(onSelect);
  const searchSequence = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [tiles, setTiles] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mapLabel, setMapLabel] = useState(catalog.city);
  const [located, setLocated] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const centerLat = catalog.center.lat;
  const centerLng = catalog.center.lng;

  useEffect(() => { selection.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!node.current) return;
    const instance = new maplibregl.Map({
      container: node.current,
      style: ATLAS_STYLE_URL,
      center: [centerLng, centerLat],
      zoom: 13, minZoom: 2, maxZoom: 19,
      scrollZoom: false, dragRotate: false, pitchWithRotate: false,
      attributionControl: true,
    });
    map.current = instance;
    instance.on('style.load', () => {
      applyAtlasTheme(instance);
      setTiles('ready');
    });
    instance.on('error', () => setTiles('offline'));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(node.current);
    return () => {
      observer.disconnect();
      layer.current.forEach(marker => marker.remove());
      locationLayer.current.forEach(marker => marker.remove());
      layer.current = [];
      locationLayer.current = [];
      instance.remove();
      map.current = null;
    };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (expanded) map.current?.scrollZoom.enable();
    else map.current?.scrollZoom.disable();
    map.current?.resize();
  }, [expanded, mobileVisible]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    locationLayer.current.forEach(marker => marker.remove());
    locationLayer.current = [];
    const addSpot = (point: Point, color: string, title: string) => {
      const element = document.createElement('span');
      element.className = 'map-location-dot';
      element.style.backgroundColor = color;
      element.title = title;
      element.setAttribute('aria-label', title);
      locationLayer.current.push(
        new maplibregl.Marker({ element })
          .setLngLat([point.lng, point.lat]).addTo(instance),
      );
    };
    if (originLat !== undefined && originLng !== undefined)
      addSpot({ lat: originLat, lng: originLng }, '#44877b', 'Search area');
    if (located) addSpot(located, '#3f76ed', 'Your device location');
  }, [originLat, originLng, located]);

  useEffect(() => {
    if (originLat === undefined || originLng === undefined) return;
    map.current?.jumpTo({ center: [originLng + 0.005, originLat - 0.007] });
  }, [originLat, originLng]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    layer.current.forEach(marker => marker.remove());
    layer.current = [];
    const seen = new Map<string, number>();
    for (const listing of listings) {
      // Preserve coarse public locations; offset only genuinely co-located markers.
      const locationKey = listing.location.lat.toFixed(2) + ',' + listing.location.lng.toFixed(2);
      const count = seen.get(locationKey) ?? 0;
      seen.set(locationKey, count + 1);
      const angle = count * 2.399963;
      const offset = Math.min(0.003, 0.00065 * Math.sqrt(count));
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'price-pin' + (listing.id === active?.id ? ' price-pin-active' : '');
      pin.textContent = money(listing.rate);
      pin.title = listing.name + ' · ' + listing.locality;
      pin.setAttribute('aria-label', 'View ' + listing.name + ', ' + money(listing.rate));
      pin.addEventListener('click', () => selection.current(listing.id));
      const marker = new maplibregl.Marker({ element: pin, anchor: 'bottom' })
        .setLngLat([
          listing.location.lng + Math.sin(angle) * offset,
          listing.location.lat + Math.cos(angle) * offset,
        ]).addTo(instance);
      layer.current.push(marker);
    }
  }, [listings, active?.id]);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);

  function reset() {
    const points = listings.map(({ location }) => [location.lng, location.lat] as [number, number]);
    if (points.length > 1) {
      const lngs = points.map(p => p[0]);
      const lats = points.map(p => p[1]);
      map.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 105, bottom: 125, left: 42, right: 68 }, maxZoom: 14 },
      );
    } else if (points.length === 1) {
      map.current?.jumpTo({ center: points[0], zoom: 14 });
    } else {
      map.current?.jumpTo({ center: [originLng ?? centerLng, originLat ?? centerLat], zoom: 13 });
    }
    setMapLabel(catalog.city);
    setPlaces([]);
    setSearchError('');
  }

  async function findPlace() {
    const current = ++searchSequence.current;
    setSearching(true);
    setSearchError('');
    setPlaces([]);
    try {
      const results = await searchPlaces(query);
      if (current !== searchSequence.current) return;
      setPlaces(results);
      if (!results.length) setSearchError('No place found. Try a nearby city or area.');
    } catch (error) {
      if (current !== searchSequence.current) return;
      setSearchError((error as Error).message);
    } finally {
      if (current === searchSequence.current) setSearching(false);
    }
  }

  function focusPlace(place: PlaceResult) {
    map.current?.flyTo({ center: [place.point.lng, place.point.lat], zoom: 14, duration: 600 });
    setMapLabel(place.label);
    setQuery(place.label);
    setPlaces([]);
    setSearchError('');
  }

  function locate() {
    if (locating) return;
    if (!navigator.geolocation) {
      setSearchError('Your browser does not support location. You can search for a place instead.');
      return;
    }
    const instance = map.current;
    setLocating(true);
    setSearchError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!instance || map.current !== instance) return;
        setLocating(false);
        const point = { lat: coords.latitude, lng: coords.longitude };
        setLocated(point);
        instance.flyTo({ center: [point.lng, point.lat], zoom: 15, duration: 600 });
        setMapLabel('Your location');
      },
      () => {
        if (!instance || map.current !== instance) return;
        setLocating(false);
        setSearchError('Location unavailable or permission denied. Search for a place instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function retryTiles() {
    setTiles('loading');
    map.current?.setStyle(ATLAS_STYLE_URL);
  }

  return <aside className={'map-shell' + (mobileVisible ? ' map-mobile-visible' : '') + (expanded ? ' map-expanded' : '')} aria-label="Map of nearby listings">
    <div className="map-canvas" ref={node} aria-label="Interactive map of approximate tutor and learner locations"/>
    <div className="map-place"><span className="map-place-icon"><MapPin size={19}/></span><div><strong title={mapLabel}>{mapLabel}</strong><small>{catalog.demo ? 'Demo listings in ' + catalog.city : 'Neighbourhood discovery'}</small></div></div>
    <button type="button" className="icon-button map-expand" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Exit expanded map' : 'Expand map'}>{expanded ? <X size={19}/> : <Maximize2 size={18}/>}</button>
    <div className="map-search-area">
      <form className="map-find" role="search" aria-label="Find a place on the map" onSubmit={(event) => { event.preventDefault(); void findPlace(); }}>
        <Search size={17} aria-hidden="true"/>
        <input aria-label="Search places" placeholder="Find a city or neighbourhood" value={query} maxLength={140} onChange={(event) => { searchSequence.current += 1; setQuery(event.target.value); setPlaces([]); setSearchError(''); setSearching(false); }}/>
        {query && <button className="map-clear-search" type="button" aria-label="Clear place search" onClick={() => { searchSequence.current += 1; setQuery(''); setPlaces([]); setSearchError(''); setSearching(false); }}><X size={14}/></button>}
        <button className="map-submit-search" type="submit" disabled={searching || query.trim().length < 3} aria-label="Find place">{searching ? '…' : <ArrowRight size={17}/>}</button>
      </form>
      {places.length > 0 && <div className="map-search-results" role="list" aria-label="Matching places">{places.map((place) =>
        <button key={place.id} type="button" role="listitem" onClick={() => focusPlace(place)}><MapPin size={14}/><span>{place.label}</span></button>
      )}</div>}
      {searchError && <p className="map-search-error" role="status">{searchError}</p>}
    </div>
    <div className="map-tools">
      <div className="map-zoom">
        <button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={19}/></button>
        <button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={19}/></button>
      </div>
      <button type="button" title="Use my location" aria-label="Use my location" aria-busy={locating} disabled={locating} onClick={locate}><LocateFixed size={19}/></button>
      <button className="map-reset" type="button" aria-label="Fit visible listings" title="Fit visible listings" onClick={reset}><Crosshair size={19}/></button>
    </div>
    {tiles === 'offline' && <button className="map-offline" type="button" onClick={retryTiles}>Map tiles unavailable. Retry map</button>}
    {active && <button className="map-profile" type="button" onClick={() => onOpen(active)}>
      <Avatar listing={active}/><span className="map-profile-name"><strong>{active.name}</strong><small>{active.locality} · View profile</small></span><span className="map-profile-rate">{money(active.rate)}<small> / hr</small></span>
    </button>}
    <div className="map-note"><Layers3 size={13}/> Approximate locations</div>
  </aside>;
}
