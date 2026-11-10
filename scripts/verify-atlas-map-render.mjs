import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = 4179;
const base = `http://127.0.0.1:${port}`;
const preview = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', 'preview',
  '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
preview.stdout.on('data', chunk => { output += String(chunk); });
preview.stderr.on('data', chunk => { output += String(chunk); });

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (preview.exitCode !== null) throw new Error('Preview exited: ' + output);
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Preview did not start: ' + output);
}

const featureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: {
      type: 'LineString',
      coordinates: [[91.71, 26.11], [91.83, 26.21]],
    }, properties: { kind: 'road' } },
  ],
};
const localBaseStyle = {
  version: 8,
  sources: { streets: { type: 'geojson', data: featureCollection } },
  layers: [
    { id: 'background', type: 'background',
      paint: { 'background-color': '#f1f1f1' } },
    { id: 'highway_minor', type: 'line', source: 'streets',
      paint: { 'line-color': '#111111', 'line-width': 5 } },
  ],
};

let browser;
try {
  await waitForPreview();
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('https://tiles.openfreemap.org/styles/positron*', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(localBaseStyle),
    }));
  await page.goto(base + '/#signup', { waitUntil: 'domcontentloaded' });
  const map = page.locator('.home-area-map');
  await map.waitFor({ timeout: 25000 });
  await page.locator('.home-area-map .maplibregl-canvas').waitFor({ timeout: 25000 });
  try {
    await page.locator('.home-area-map[data-map-status="ready"]').waitFor({ timeout: 25000 });
  } catch (error) {
    await page.screenshot({ path: '/tmp/shikshak-map-worker-failure.png', fullPage: true });
    throw new Error('MapLibre did not finish processing GeoJSON tiles with its worker. ' +
      'Browser errors: ' + errors.join(' | ') + '. ' + error);
  }
  const atlasPropertyChanges = Number(await map.getAttribute('data-atlas-property-changes'));
  const atlasChangedLayers = Number(await map.getAttribute('data-atlas-changed-layers'));
  assert(atlasPropertyChanges >= 2,
    'Atlas preset compiler should patch the test map, not only load base colors: ' + atlasPropertyChanges);
  assert(atlasChangedLayers >= 1,
    'Atlas preset compiler should resolve its advanced layer settings: ' + atlasChangedLayers);
  const workerURLs = page.workers().map(worker => worker.url());
  assert(workerURLs.some(url => url.includes('maplibre-gl-worker')),
    'MapLibre worker was not created; workers: ' + workerURLs.join(', '));
  const size = await map.boundingBox();
  assert(size && size.width >= 250 && size.height >= 150,
    'Map container must be visible and nonzero in the signup form');
  assert(!errors.some(error => /worker failed|webgl.*not supported|failed to construct.*worker/i.test(error)),
    'MapLibre worker/WebGL console error: ' + errors.join(' | '));
  console.log('MapLibre signup map browser check passed: bundled worker running, GeoJSON features processed, map idle and visible. Atlas applied ' + atlasPropertyChanges + ' paint/layout patches across ' + atlasChangedLayers + ' resolved layers.');
} finally {
  await browser?.close();
  preview.kill('SIGTERM');
}
