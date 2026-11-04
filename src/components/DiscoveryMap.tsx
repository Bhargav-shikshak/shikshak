import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Layers3, MapPin, Maximize2, Minus, Plus, X } from 'lucide-react';
import type { Catalog, DiscoveryListing, Point } from '../../shared/domain';
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
const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
const tileUrl = env?.VITE_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const tileCredit = env?.VITE_TILE_ATTRIBUTION?.trim() ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

export function DiscoveryMap({ catalog, listings, origin, active, onSelect, onOpen, mobileVisible }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const locationLayer = useRef<L.LayerGroup | null>(null);
  const selection = useRef(onSelect);
  const [expanded, setExpanded] = useState(false);
  const [tiles, setTiles] = useState<'loading' | 'ready' | 'offline'>('loading');
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const centerLat = catalog.center.lat;
  const centerLng = catalog.center.lng;

  useEffect(() => { selection.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!node.current) return;
    const instance = L.map(node.current, { zoomControl: false, scrollWheelZoom: false, minZoom: 10, maxZoom: 18, attributionControl: true })
      .setView([centerLat, centerLng], 13);
    const basemap = L.tileLayer(tileUrl, {
      maxZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 1,
      attribution: tileCredit,
    });
    basemap.on('tileerror', () => setTiles((value) => value === 'ready' ? value : 'offline'));
    basemap.on('tileload', () => setTiles('ready')).addTo(instance);
    instance.attributionControl.setPrefix(false);
    map.current = instance;
    locationLayer.current = L.layerGroup().addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(node.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (originLat === undefined || originLng === undefined || !locationLayer.current || !map.current) return;
    locationLayer.current.clearLayers();
    L.circleMarker([originLat, originLng], { radius: 7, color: '#fff', weight: 3, fillColor: '#44877b', fillOpacity: 1 })
      .bindTooltip('Search area').addTo(locationLayer.current);
    map.current.panTo([originLat - .007, originLng + .005], { animate: false });
  }, [originLat, originLng]);

  useEffect(() => {
    if (!layer.current) return;
    const markers = layer.current;
    markers.clearLayers();
    const seen = new Map<string, number>();
    for (const listing of listings) {
      const key = listing.localityId;
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      const label = document.createElement('span');
      label.textContent = money(listing.rate);
      const pin = L.marker([listing.location.lat + count * .0018, listing.location.lng + count * .002], {
        title: listing.name, alt: listing.name, riseOnHover: true, zIndexOffset: listing.id === active?.id ? 500 : 0,
        icon: L.divIcon({ className: 'price-pin' + (listing.id === active?.id ? ' price-pin-active' : ''), html: label, iconSize: [62, 32], iconAnchor: [31, 35] }),
      });
      pin.on('click', () => selection.current(listing.id)).addTo(markers);
    }
  }, [listings, active?.id]);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);

  const reset = () => {
    const points = listings.map(({ location }) => L.latLng(location.lat, location.lng));
    if (points.length > 1) map.current?.fitBounds(L.latLngBounds(points), { paddingTopLeft: [42, 105], paddingBottomRight: [68, 125], maxZoom: 14 });
    else if (points.length === 1) map.current?.setView(points[0], 14);
    else map.current?.setView([originLat ?? centerLat, originLng ?? centerLng], 13);
  };

  return <aside className={'map-shell' + (mobileVisible ? ' map-mobile-visible' : '') + (expanded ? ' map-expanded' : '')} aria-label="Map of nearby listings">
    <div className="map-canvas" ref={node}/>
    <div className="map-place"><span className="map-place-icon"><MapPin size={19}/></span><div><strong>{catalog.city}</strong><small>Neighbourhood discovery</small></div></div>
    <button type="button" className="icon-button map-expand" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Exit expanded map' : 'Expand map'}>{expanded ? <X size={19}/> : <Maximize2 size={18}/>}</button>
    <div className="map-tools">
      <div className="map-zoom"><button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}><Plus size={19}/></button><button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}><Minus size={19}/></button></div>
      <button className="map-reset" type="button" aria-label="Fit visible listings" title="Fit visible listings" onClick={reset}><Crosshair size={19}/></button>
    </div>
    {tiles === 'offline' && <p className="map-offline" role="status">Map tiles unavailable. Listing pins still work.</p>}
    {active && <button className="map-profile" type="button" onClick={() => onOpen(active)}>
      <Avatar listing={active}/><span className="map-profile-name"><strong>{active.name}</strong><small>{active.locality} · View profile</small></span><span className="map-profile-rate">{money(active.rate)}<small> / hr</small></span>
    </button>}
    <div className="map-note"><Layers3 size={13}/> Approximate locations</div>
  </aside>;
}
