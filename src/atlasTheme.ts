import type { Map as MapLibreMap } from 'maplibre-gl';
import theme from './maps/atlas-theme-v1.json';
import { parseAtlasThemeBundle, resolveAtlasThemeBundle } from './atlas/style-core';
import { applyAtlasStyleDocument, editableLayerInventory } from './atlas/styleRuntime';

// The theme file is an Atlas authoring recipe, not a MapLibre style.
// Use the same provider style and the same Atlas style compiler as Atlas Lab.
export const ATLAS_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const bundle = parseAtlasThemeBundle(JSON.stringify(theme));

export interface AtlasApplySummary {
  propertyChanges: number;
  changedLayerIds: number;
  diagnostics: number;
}

export function applyAtlasTheme(map: MapLibreMap): AtlasApplySummary {
  // Capture the provider style before any app-specific markers or modifications.
  const baseStyle = map.getStyle();
  if (!baseStyle?.layers?.length) throw new Error('Positron base style has no layers.');

  // Atlas Lab's exact theme export pipeline:
  // 1. Inspect actual provider layers.
  // 2. Resolve the recipe's preset detail, advanced road/label and semantic defaults.
  // 3. Apply the compiled property diffs without reloading tiles or moving the map.
  const inventory = editableLayerInventory(baseStyle);
  const document = resolveAtlasThemeBundle(bundle, inventory, baseStyle);
  const resolved = applyAtlasStyleDocument(map, baseStyle, document);
  const changedLayerIds = new Set(Object.keys(document.layers)).size;

  const errors = resolved.diagnostics.filter(item => item.severity === 'error');
  if (errors.length) console.warn('Atlas theme diagnostics:', errors);
  return {
    propertyChanges: resolved.propertyChanges,
    changedLayerIds,
    diagnostics: resolved.diagnostics.length,
  };
}
