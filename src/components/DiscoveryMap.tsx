import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ArrowRight, Crosshair, Layers3, LocateFixed, MapPin, Maximize2, Minus, Plus, Search, X } from 'lucide-react';
import type { Catalog, DiscoveryListing, Point } from '../../shared/domain';
import { mapConfig } from '../mapConfig';
import { searchPlaces, type PlaceResult } from '../services/placeSearch';
import { Avatar, money } from './Common';
import 'leaflet/dist/leaflet.css';

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
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const locationLayer = useRef<L.LayerGroup | null>(null);
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
    const instance = L.map(node.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 2,
      maxZoom: mapConfig.tileMaxZoom,
      attributionControl: true,
    }).setView([centerLat, centerLng], 13);

    // Consistent light OpenStreetMap basemap, independent of Shikshak's UI theme.
    L.tileLayer(mapConfig.tileUrl, {
      maxZoom: mapConfig.tileMaxZoom,
      attribution: mapConfig.tileAttribution,
      updateWhenIdle: true,
      keepBuffer: 1,
      subdomains: 'abcd',
    }).on('tileerror', () => setTiles('offline'))
      .on('load', () => setTiles('ready'))
      .addTo(instance);
    instance.attributionControl.setPrefix(false);
    map.current = instance;
    locationLayer.current = L.layerGroup().addTo(instance);
    layer.current = L.layerGroup().addTo(instance);

    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(node.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      layer.current = null;
      locationLayer.current = null;
    };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (expanded) map.current?.scrollWheelZoom.enable();
    else map.current?.scrollWheelZoom.disable();
    map.current?.invalidateSize({ pan: false });
  }, [expanded, mobileVisible]);

  useEffect(() => {
    if (!locationLayer.current || !map.current) return;
    locationLayer.current.clearLayers();
    if (originLat !== undefined && originLng !== undefined) {
      L.circleMarker([originLat, originLng], {
        radius: 7, color: '#ffffff', weight: 3, fillColor: '#44877b', fillOpacity: 1,
      }).bindTooltip('Search area').addTo(locationLayer.current);
    }
    if (located) {
      L.circleMarker([located.lat, located.lng], {
        radius: 9, color: '#ffffff', weight: 3, fillColor: '#3f76ed', fillOpacity: 1,
      }).bindTooltip('Your device location').addTo(locationLayer.current);
    }
  }, [originLat, originLng, located]);

  useEffect(() => {
    if (originLat === undefined || originLng === undefined) return;
    map.current?.panTo([originLat - 0.007, originLng + 0.005], { animate: false });
  }, [originLat, originLng]);

  useEffect(() => {
    if (!layer.current) return;
    const markers = layer.current;
    markers.clearLayers();
    const seen = new Map<string, number>();
    for (const listing of listings) {
      // Listings intentionally point to neighbourhood centres, not household addresses.
      // Group only truly co-located coarse pins, not every account with the
      // old Guwahati fallback localityId (new signups may live in any city).
      const locationKey = listing.location.lat.toFixed(2) + ',' + listing.location.lng.toFixed(2);
      const count = seen.get(locationKey) ?? 0;
      seen.set(locationKey, count + 1);
      const angle = count * 2.399963;
      const offset = Math.min(0.003, 0.00065 * Math.sqrt(count));
      const label = document.createElement('span');
      label.textContent = money(listing.rate);
      const pin = L.marker([
        listing.location.lat + Math.cos(angle) * offset,
        listing.location.lng + Math.sin(angle) * offset,
      ], {
        title: listing.name,
        alt: listing.name,
        riseOnHover: true,
        zIndexOffset: listing.id === active?.id ? 500 : 0,
        icon: L.divIcon({
          className: 'price-pin' + (listing.id === active?.id ? ' price-pin-active' : ''),
          html: label,
          iconSize: [62, 32],
          iconAnchor: [31, 35],
        }),
      });
      pin.on('click', () => selection.current(listing.id)).addTo(markers);
      pin.bindTooltip(listing.name + ' · ' + listing.locality, { direction: 'top', offset: [0, -24] });
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
    const points = listings.map(({ location }) => L.latLng(location.lat, location.lng));
    if (points.length > 1) {
      map.current?.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [42, 105],
        paddingBottomRight: [68, 125],
        maxZoom: 14,
      });
    } else if (points.length === 1) {
      map.current?.setView(points[0], 14);
    } else {
      map.current?.setView([originLat ?? centerLat, originLng ?? centerLng], 13);
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
    map.current?.flyTo([place.point.lat, place.point.lng], 14, { duration: 0.6 });
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
        instance.flyTo([point.lat, point.lng], 15, { duration: 0.6 });
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
    map.current?.eachLayer((item) => {
      if (item instanceof L.TileLayer) item.redraw();
    });
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
