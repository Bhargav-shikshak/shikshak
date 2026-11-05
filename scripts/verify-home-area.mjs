import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Verify CivicWatch-compatible city/locality fallback without network access.
const calls = [];
globalThis.fetch = async input => {
  const url = new URL(String(input));
  calls.push(url);
  const lat = Number(url.searchParams.get('lat'));
  if (url.hostname === 'photon.komoot.io' && url.pathname === '/reverse') {
    if (lat === 26.18) return Response.json({ features: [
      { properties: { name: 'Unnamed cafe', city: 'Guwahati', suburb: 'Zoo Road', county: 'Dispur' } },
      { properties: { name: 'Zoo Road Tiniali', city: 'Guwahati', locality: 'Zoo Road' } },
    ] });
    return Response.json({ features: [
      { properties: { name: 'Shop', county: 'Morigaon', suburb: 'Station Road' } },
    ] });
  }
  if (url.hostname === 'nominatim.openstreetmap.org' && url.pathname === '/reverse') {
    return Response.json({ address: lat === 26.5
      ? { town: 'Jagiroad', county: 'Morigaon', neighbourhood: 'Station Road' }
      : { county: 'Morigaon', neighbourhood: 'Station Road' },
    });
  }
  throw new Error('Unexpected outbound geocoding call: ' + url);
};
const compiled = await build({
  entryPoints: ['src/services/homeArea.ts'],
  bundle: true, format: 'esm', platform: 'node', target: 'node24',
  write: false, logLevel: 'silent',
  define: { 'import.meta.env': JSON.stringify({
    VITE_GEOCODER_BASE_URL: 'https://photon.komoot.io',
    VITE_TILE_MAX_ZOOM: '19',
  }) },
});
const url = 'data:text/javascript;base64,' +
  Buffer.from(compiled.outputFiles[0].contents).toString('base64');
const { approximateHomePoint, reverseHomeArea } = await import(url);

assert.deepEqual(approximateHomePoint({ lat: 26.18332, lng: 91.77491 }),
  { lat: 26.18, lng: 91.77 }, 'Exact residential GPS is coarsened');
const guwahati = await reverseHomeArea({ lat: 26.1833, lng: 91.7749 });
assert.equal(guwahati.city, 'Guwahati', 'Administrative city outranks county Dispur');
assert.equal(guwahati.locality, 'Zoo Road', 'Nearby locality is filled from Photon');
assert.equal(calls.length, 1, 'Nominatim is not called when Photon has complete address');
await reverseHomeArea({ lat: 26.18, lng: 91.77 });
assert.equal(calls.length, 1, 'Repeated reverse lookup of same area is cached');
const jagiroad = await reverseHomeArea({ lat: 26.5, lng: 92.5 });
assert.equal(jagiroad.city, 'Jagiroad', 'Nominatim town takes precedence over Photon county');
assert.equal(jagiroad.locality, 'Station Road');
const morigaon = await reverseHomeArea({ lat: 26.4, lng: 92.4 });
assert.equal(morigaon.city, 'Morigaon', 'County is used only when neither provider has city or town');
assert.equal(morigaon.locality, 'Station Road');
await assert.rejects(() => reverseHomeArea({ lat: 120, lng: 25 }), /Invalid map position/);
console.log('Home-area geocoding verified: approximate pins, Photon city/locality, Nominatim settlement fallback, county fallback, cache and coordinate validation.');
