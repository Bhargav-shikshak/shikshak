/// <reference types="vite/client" />

// Keep geocoding configuration independent from the Atlas/MapLibre basemap.
export const mapConfig = {
  geocoderBaseUrl: (import.meta.env.VITE_GEOCODER_BASE_URL?.trim() || 'https://photon.komoot.io').replace(/\/$/, ''),
} as const;
