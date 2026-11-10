import type { Map as MapLibreMap } from 'maplibre-gl';
import theme from './maps/atlas-theme-v1.json';

// Atlas theme v1 is a portable styling recipe, NOT a MapLibre style document.
// The provider must match Atlas Lab's Positron base for its layer IDs to align.
export const ATLAS_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

type ThemeGroup = { color: string; opacity?: number };
const groups = theme.document.groups as Record<string, ThemeGroup>;
const bindings = theme.document.bindings as Record<string, string[]>;

export function applyAtlasTheme(map: MapLibreMap): void {
  for (const [group, ids] of Object.entries(bindings)) {
    const settings = groups[group];
    if (!settings) continue;
    for (const id of ids) {
      const layer = map.getLayer(id);
      if (!layer) continue; // Provider may change its layer inventory.
      try {
        switch (layer.type) {
          case 'background':
            map.setPaintProperty(id, 'background-color', settings.color);
            break;
          case 'fill':
            map.setPaintProperty(id, 'fill-color', settings.color);
            if (settings.opacity !== undefined) map.setPaintProperty(id, 'fill-opacity', settings.opacity);
            break;
          case 'fill-extrusion':
            map.setPaintProperty(id, 'fill-extrusion-color', settings.color);
            if (settings.opacity !== undefined) map.setPaintProperty(id, 'fill-extrusion-opacity', settings.opacity);
            break;
          case 'line':
            map.setPaintProperty(id, 'line-color', settings.color);
            break;
          case 'circle':
            map.setPaintProperty(id, 'circle-color', settings.color);
            break;
          case 'symbol':
            if (group === 'labels' || group === 'poi') map.setPaintProperty(id, 'text-color', settings.color);
            else map.setPaintProperty(id, 'icon-color', settings.color);
            break;
        }
      } catch (error) {
        // Keep the base map usable if a provider layer changes its paint schema.
        console.warn('Atlas theme layer could not be styled:', id, error);
      }
    }
  }
}
