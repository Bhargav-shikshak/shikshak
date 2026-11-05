import type { HomeArea, Point } from '../../shared/domain';
import { mapConfig } from '../mapConfig';

/**
 * Adapted from CivicWatch's explicit pin reverse-geocoding flow.
 * Photon is consulted first. If it cannot identify both settlement and
 * locality, Nominatim supplies missing fields; only then use county as city.
 * Public endpoints must be replaced with a paid/self-hosted service at scale.
 */
interface Feature { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }
interface NominatimResult { address?: Record<string, unknown>; error?: string }
const cache = new Map<string, Partial<HomeArea>>();
let queue: Promise<void> = Promise.resolve();
let lastRequest = 0;
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const first = (...vs: unknown[]) => vs.map(text).find(Boolean) || '';

async function paced<T>(work: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  const previous = queue;
  queue = next;
  await previous;
  try {
    const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (delay) await new Promise<void>(resolve => setTimeout(resolve, delay));
    lastRequest = Date.now();
    return await work();
  } finally { release(); }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' }, signal: controller.signal,
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    if (!response.ok) throw new Error('Geocoding provider unavailable.');
    return await response.json();
  } finally { clearTimeout(timeout); }
}

function photon(features: Feature[]): { city: string; county: string; locality: string } {
  const candidates = features.map(feature => feature.properties ?? {});
  // Avoid mistaking a cafe/building name for a city.
  const city = first(...candidates.map(p => first(p.city, p.town, p.municipality, p.village, p.hamlet)));
  const county = first(...candidates.map(p => p.county));
  const locality = first(...candidates.map(p =>
    first(p.suburb, p.neighbourhood, p.quarter, p.locality, p.city_district,
      p.district, p.street)));
  return { city, county, locality };
}
function nominatim(address: Record<string, unknown> | undefined) {
  const a = address ?? {};
  return {
    city: first(a.city, a.town, a.municipality, a.village, a.hamlet),
    county: text(a.county),
    locality: first(a.suburb, a.neighbourhood, a.quarter, a.city_district,
      a.residential, a.borough, a.road, a.pedestrian),
  };
}
export function approximateHomePoint(point: Point): Point {
  // Roughly kilometre-scale pin to avoid retaining an exact residential coordinate.
  return { lat: Math.round(point.lat * 100) / 100, lng: Math.round(point.lng * 100) / 100 };
}

export async function reverseHomeArea(point: Point): Promise<Partial<HomeArea>> {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) throw new Error('Invalid map position.');
  const coarse = approximateHomePoint(point);
  const key = coarse.lat.toFixed(2) + ',' + coarse.lng.toFixed(2);
  const existing = cache.get(key);
  if (existing) return existing;
  let p = { city: '', locality: '', county: '' };
  try {
    const result = await paced(() => fetchJson(mapConfig.geocoderBaseUrl + '/reverse?' +
      new URLSearchParams({ lat: coarse.lat.toFixed(5), lon: coarse.lng.toFixed(5), limit: '8' })));
    const features = (result as { features?: Feature[] })?.features;
    p = photon(Array.isArray(features) ? features : []);
  } catch { /* Try the CivicWatch fallback. */ }

  let n = { city: '', locality: '', county: '' };
  if (!p.city || !p.locality) {
    try {
      const result = await paced(() => fetchJson('https://nominatim.openstreetmap.org/reverse?' +
        new URLSearchParams({ format: 'jsonv2', lat: coarse.lat.toFixed(5),
          lon: coarse.lng.toFixed(5), zoom: '18', addressdetails: '1', 'accept-language': 'en' })));
      n = nominatim((result as NominatimResult)?.address);
    } catch { /* User may supply missing city/locality; don't fake a location. */ }
  }
  const city = first(n.city, p.city, n.county, p.county);
  const locality = first(n.locality, p.locality);
  const area = { ...coarse, city, locality };
  cache.set(key, area);
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return area;
}
