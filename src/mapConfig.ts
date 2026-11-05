/// <reference types="vite/client" />

// Map providers are replaceable, as in CivicWatch. No provider secrets belong in VITE_ variables.
const env = import.meta.env;
const zoom = Number(env.VITE_TILE_MAX_ZOOM);

export const mapConfig = {
  tileUrl: env.VITE_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: env.VITE_TILE_ATTRIBUTION?.trim() ||
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  tileMaxZoom: Number.isFinite(zoom) && zoom >= 2 && zoom <= 19 ? zoom : 19,
  geocoderBaseUrl: (env.VITE_GEOCODER_BASE_URL?.trim() || 'https://photon.komoot.io').replace(/\/$/, ''),
} as const;
