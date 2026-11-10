import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre GL JS 6 has an ES module worker. Vite must emit its bundled URL;
// without this, the controls/DOM markers show but no vector tiles are drawn.
// Execute this module once before constructing either MapLibre map component.
setWorkerUrl(workerUrl);
