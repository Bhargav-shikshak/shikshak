import type { Point } from '../../shared/domain';
import { mapConfig } from '../mapConfig';

export interface PlaceResult {
  id: string;
  label: string;
  point: Point;
}

interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
}

const cache = new Map<string, PlaceResult[]>();
let queue: Promise<void> = Promise.resolve();
let lastRequest = 0;
const safeText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function parseFeature(feature: PhotonFeature): PlaceResult | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const properties = feature.properties ?? {};
  const parts = [
    safeText(properties.name),
    safeText(properties.city) || safeText(properties.town) || safeText(properties.village) || safeText(properties.county),
    safeText(properties.state),
    safeText(properties.country),
  ];
  const label = [...new Set(parts.filter(Boolean))].join(', ') || lat.toFixed(4) + ', ' + lng.toFixed(4);
  return {
    id: String(properties.osm_type ?? '') + ':' + String(properties.osm_id ?? '') + ':' + lat + ':' + lng,
    label,
    point: { lat, lng },
  };
}

// Public demo geocoders must not be hammered: explicit searches only, serialized and spaced.
async function scheduled<T>(task: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const previous = queue;
  queue = pending;
  await previous;
  try {
    const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (delay) await new Promise<void>((resolve) => setTimeout(resolve, delay));
    lastRequest = Date.now();
    return await task();
  } finally {
    release();
  }
}

export async function searchPlaces(term: string): Promise<PlaceResult[]> {
  const query = term.trim();
  if (query.length < 3 || query.length > 140) throw new Error('Enter at least three characters to find a place.');
  const key = query.toLocaleLowerCase();
  const stored = cache.get(key);
  if (stored) return stored;

  return scheduled(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const url = mapConfig.geocoderBaseUrl + '/api?' + new URLSearchParams({ q: query, limit: '6' });
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      if (!response.ok) throw new Error(response.status === 429
        ? 'Place search is busy. Try again shortly.'
        : 'Place search is temporarily unavailable.');
      const payload = await response.json() as { features?: PhotonFeature[] };
      const results = (Array.isArray(payload.features) ? payload.features : [])
        .map(parseFeature)
        .filter((place): place is PlaceResult => place !== null)
        .slice(0, 6);
      cache.set(key, results);
      if (cache.size > 80) cache.delete(cache.keys().next().value!);
      return results;
    } catch (error) {
      if (error instanceof Error && error.message.includes('busy')) throw error;
      throw new Error('Place search is unavailable. You can still pan and zoom the map.');
    } finally {
      clearTimeout(timeout);
    }
  });
}
