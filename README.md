# Shikshak

Shikshak is a map-first home tuition marketplace. Tutors and learners can publish neighbourhood-level listings, discover each other, save profiles, express interest and message after a mutual match. The first demo covers Guwahati, Assam.

## Run locally

Use Node.js 22.12 or newer.

The release ZIP includes a prebuilt demo. Extract it, double-click the Windows launcher or run `npm start`, then open http://127.0.0.1:4173. The prebuilt demo needs Node.js and does not require an npm install.

For source development, install dependencies and start Vite.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The local server also serves the demo HTTP API. It stores demo changes in the ignored `.demo-data/` folder, isolated per browser session. This keeps listings, saves, matches and messages available after a page refresh.

```sh
npm run build
npm run preview
```

Run `npm run build:demo` to regenerate the standalone launcher bundle. The preview command serves the built frontend and the same demo API. The Leaflet basemap uses OpenStreetMap tiles, with Photon-compatible place search, and needs network access. Tile and geocoder providers can be configured with Vite environment variables. Approximate listing pins remain available if tiles fail. Global map search changes the viewport, not the Guwahati-only demo listings.

## Try both sides

1. Explore nearby tutors from the learner workspace. Try the subject, class, neighbourhood, distance and price controls.
2. Open Riya Sharma’s profile and select **Match back**. Riya’s fictional profile has incoming interest preloaded. Open the conversation and send a demo message.
3. To test two-way discovery, go to **My listing** and publish a learner listing. Switch to the tutor workspace, publish a tutor listing, and send interest to the learner listing.
4. Switch back to the learner workspace. Open **Matches → Received** and match back. The conversation is shared across the two demo roles. Switch roles to test replies.
5. Hide a listing from **My listing**. It leaves discovery while existing matches can still open their conversation.

The workspace picker and seed profiles exist for frontend review. The two workspaces share the same browser demo session. Fictional seed profiles do not send automated chat replies.

## Architecture

| Layer | Location |
| --- | --- |
| React + TypeScript screens, Leaflet map, responsive layouts | `src/` |
| Typed HTTP client with centralized error handling | `src/api.ts` |
| Shared domain models | `shared/domain.ts` |
| Demo data, discovery, matching and messaging rules | `demo/seed.ts`, `demo/api.ts` |
| Local HTTP adapter and per-session storage | `vite.config.ts` |
| Cloudflare HTTP adapter and per-session storage | `demo/worker.ts`, `wrangler.jsonc` |

Browser components consume HTTP responses. The fictional listings and session state stay on the server side. Map markers use neighbourhood centres, and distance is straight-line distance from the selected search area.

## Connect the production backend

The default API root is `/api/v1`. For a different endpoint, copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL` and rebuild. For a same-origin production API, keep the default and route `/api/v1/*` to the production handler. A cross-origin API must configure credentials and CORS for the frontend origin.

All operations use JSON. Errors return `{ "message": "…" }`. `GET /catalog` returns the supported subjects, levels, localities, workspace metadata and the demo flag. Workspace routes are relative to `/workspaces/{student|teacher}`.

| Method | Route | Contract |
| --- | --- | --- |
| GET | `/discovery` | `Discovery` with listings, approximate distance, saved status and connection state |
| GET | `/listing` | Own `Listing` or `null` |
| PUT | `/listing` | Accepts `ListingDraft`, returns `Listing` |
| PUT | `/listings/{id}/save` | Accepts and returns `{ saved: boolean }` |
| PUT | `/listings/{id}/interest` | Returns `{ status: ConnectionStatus }` |
| GET | `/connections` | `Connection[]` with incoming, sent or matched status |
| GET | `/connections/{id}/messages` | `Message[]` for a mutual match |
| POST | `/connections/{id}/messages` | Accepts `{ id, body }`, returns `Message`. Retries use the same client message ID. |

Discovery accepts `query`, `subject`, `grade`, `locality`, `radius` (km), `maxRate` (INR/hour), `sort` (`distance` or `rate`) and `saved` (`true`). The UI treats the selected neighbourhood as the distance origin.

For production, resolve workspace membership from the authenticated session and enforce listing ownership, visibility and match membership server-side. The demo role selector assumes access to both personas. Wire production sign-in and role authorization before using real profiles.

## Deploy the demo on Cloudflare Workers

The Wrangler config serves the Vite build as static assets and routes API requests to the demo Worker. A SQLite-backed Durable Object keeps each demo browser session separate. It expires demo changes after seven days without a write.

For a GitHub-connected Workers project, point Cloudflare at the repository and set the build command to `npm run build` and the deploy command to `npx --yes wrangler@4 deploy`. To deploy from a logged-in local Wrangler session, run `npm run deploy`.



## Map architecture (shared approach with CivicWatch)

The discovery map uses **Leaflet** and an always-light **OpenStreetMap raster basemap**, independent of the surrounding interface theme. It supports pan/zoom, mobile map mode, an expanded view, selected-listing price pins, and browser geolocation on request. A device-location marker is shown separately from the search-area marker. Listings remain approximate neighbourhood-centre pins, not tutors' or learners' home addresses.

Place lookup uses a replaceable **Photon-compatible geocoder**. Searches run only when a user submits a place, with request pacing, a small in-memory cache, and a timeout. Map tile errors offer a retry control. The default public tile and geocoding endpoints have rate and fair-use restrictions; use a suitable hosted provider before substantial production traffic.

The current **demo catalogue contains Guwahati listings only**. Searching another city changes the map viewport but does not create or fetch listings there. Discovery filters and matching continue to operate on the catalogue supplied by the API. For nationwide availability, extend the listing/geography backend and implement server-side viewport or radius queries.

Map settings can be set using the example environment file:

| Variable | Default | Purpose |
| --- | --- | --- |
| VITE_TILE_URL | OpenStreetMap raster URL | Replaceable map tiles |
| VITE_TILE_ATTRIBUTION | OpenStreetMap contributors | Tile-provider credits |
| VITE_TILE_MAX_ZOOM | 19 | Maximum map zoom |
| VITE_GEOCODER_BASE_URL | Photon public demo | Replaceable place search provider |

These variables are public build-time configuration, not secret credentials. Keep any private provider keys server-side.
