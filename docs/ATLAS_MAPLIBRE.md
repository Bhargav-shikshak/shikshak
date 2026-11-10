# Atlas Pastel City integration in Shikshak

This feature branch replaces **Leaflet** with **MapLibre GL JS** in both `DiscoveryMap` and `HomeAreaPicker`. It does not modify the backend, Supabase data, location permissions, or the booking process.

## Theme format and provider

The committed `src/maps/atlas-theme-v1.json` is the original exported **Atlas theme recipe**, not a standalone MapLibre style JSON. It describes the `pastel-city` preset, theme colors, and provider layer bindings. It must be applied on top of Atlas's matching Positron base:

`https://tiles.openfreemap.org/styles/positron`

`src/atlasTheme.ts` now runs Atlas's real `parseAtlasThemeBundle`, `resolveAtlasThemeBundle` and `applyAtlasStyleDocument` pipeline on the loaded Positron style. This restores the Pastel City preset's derived detail settings, road-class contrast/widths/outlines, advanced text sizing, and semantic feature styling, not just the top-level palette. The pure styling compiler is a pinned MIT-licensed snapshot of Atlas in `src/atlas/style-core/`; provenance and revision are in `src/atlas/README.md`. Missing provider layer IDs are reported as diagnostics without crashing the map. The same base provider and version are needed for exact layer-level parity.

Map provider availability, attribution, and allowed usage must be reviewed before production rollout; exporting a theme does not license map tiles.

## Functional acceptance checklist

1. In student Explore, see approximately located teacher markers with the correct per-hour prices; selecting a marker highlights the listing and opens the normal detail flow.
2. Search and reset map view, use device location and zoom controls; expand/collapse the desktop map and use the mobile map switch.
3. In the home-area profile editor, search locations, tap to place a marker, drag the selected marker, use device location, and confirm city/locality reverse geocoding.
4. Verify that the exact clicked point is kept only for the visible interaction and saved as a rounded kilometre-scale point; verify the 30-day edit restriction remains enforced elsewhere.
5. Verify teacher booking, accepting/declining, chat and classroom workflows remain unchanged.
6. Confirm the map loads on mobile, provider attribution remains visible, and error/retry behavior is usable.

Automated checks: `npm ci && npm run build && npm run test:platform && npm run test:home-area`. The feature-branch GitHub Actions job additionally runs Chromium with a mocked GeoJSON provider style to assert WebGL rendering, active worker and nonzero Atlas style patches; actual provider coverage and device-specific cartography still require visual comparison with Atlas Lab.
