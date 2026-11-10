# Shikshak

[Shikshak](https://shikshak.co.in/) helps students find nearby tutors and request a first class. Tutors accept or decline the request. Accepted bookings open a classroom with scheduling, chat, lesson notes, PDF worksheets, homework submissions and feedback.

**Stage:** pilot. The hosted build connects to Supabase through a Cloudflare Worker. Local development can run a browser-only demo with fictional Guwahati profiles and classroom history.

## Project timeline

| Phase | What changed |
| --- | --- |
| Early November 2026 · StudyLane | Started as a map-based home-tutor discovery and mutual matching prototype. The first interactive demo added test accounts, profiles and classroom activity. |
| 4–5 November · Shikshak and bookings | Renamed the product and moved to student-initiated requests. Teachers can accept or decline, and accepted requests unlock classroom resources. Legacy demo matches migrate to accepted bookings so existing lessons and messages remain usable. |
| 5 November · [Map and backend](https://github.com/Bhargav-shikshak/shikshak/pull/1) | Replaced CARTO with Leaflet and OpenStreetMap. Connected Supabase accounts, shared bookings and private PDF storage through a same-origin Worker, then merged the backend pilot to `main`. |
| 6 November · [Pricing and staff roles](https://github.com/Bhargav-shikshak/shikshak/pull/6) | Merged teacher-set base rates, a capped travel supplement and distinct owner/admin responsibilities. A [follow-up](https://github.com/Bhargav-shikshak/shikshak/commit/0217db39) made teacher verification a badge for published listings, with booking availability governed separately. The production database upgrade is applied separately from the code merge. |
| 7 November · [Public landing page](https://github.com/Bhargav-shikshak/shikshak/pull/7) | Added an introduction to the tutoring and booking flow, with clearly illustrative reviews. |
| 10 November · [Atlas MapLibre migration](https://github.com/Bhargav-shikshak/shikshak/pull/8) | Merged to `main`. Discovery and home-area maps now use MapLibre and Atlas Pastel City, with existing markers and home-area behaviour preserved. |

**Today:** A hosted tutoring pilot with map discovery, teacher-set rates in the upgraded schema, booking requests and participant-scoped classrooms.

## Engineering challenges and solutions

- **Blank vector basemap.** The initial MapLibre integration did not start its worker correctly under Vite. [Registering the bundled worker URL before map construction](https://github.com/Bhargav-shikshak/shikshak/commit/af915338) fixed the startup path. Chromium coverage checks WebGL rendering and the active worker.
- **Pastel City looked different across apps.** A palette-only mapping skipped the preset’s derived road widths, outlines, label styling and semantic details. [Compiling the complete Atlas recipe](https://github.com/Bhargav-shikshak/shikshak/commit/c4b7e26b) against OpenFreeMap Positron restored those settings. A [Chromium regression](https://github.com/Bhargav-shikshak/shikshak/commit/234812a1) checks that the compiled patches apply.
- **Location privacy.** Students discover teachers on a map. Teacher accounts have no student discovery endpoint, and booking responses omit student home coordinates. Discovery uses approximate neighbourhood pins, with a rolling 30-day limit on changing the saved home area.
- **Booking consistency.** A unique active-pair constraint prevents duplicate active requests. Teacher acceptance and initial classroom creation commit together, and classroom routes check the accepted relationship.
- **Classroom file privacy.** Hosted PDFs use private storage and participant-scoped access. The local demo keeps PDFs in IndexedDB and uses simulated permissions for workflow testing.
- **Teacher control over rates.** The updated flow separates rate editing from identity verification. The quote combines a tutor’s hourly base rate and a capped supplement based on straight-line neighbourhood distance.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the Vite URL, usually http://127.0.0.1:5173. Use the demo student and teacher accounts to request, accept and open a classroom. Demo data stays in the current browser.

```sh
npm run build
npm run test:platform
npm run test:browser-demo
npm run test:pdf-notes
npm run test:home-area
npm run test:backend
```

## Architecture and deployment

| Area | Implementation |
| --- | --- |
| Interface | React and TypeScript with a centralized API client in `src/api.ts` |
| Local demo | `src/services/browserDemo.ts`, browser-local state and IndexedDB PDFs |
| Maps | MapLibre GL JS using Atlas Pastel City over OpenFreeMap Positron; Photon-compatible geocoding with a Nominatim fallback |
| Hosted backend | `backend/worker.ts`, Cloudflare Workers, Supabase Auth, PostgreSQL and private Storage |
| Database setup | `supabase/` schema, policies, storage checks and pricing/role upgrade SQL |

The [Atlas integration notes](docs/ATLAS_MAPLIBRE.md) explain the theme recipe, provider dependency and verification checklist.

Cloudflare builds `main` and serves the app and same-origin API. See [backend setup](docs/BACKEND.md) for the initial pilot architecture and [pricing and verification rollout](docs/OWNER_VERIFICATION_PRICING.md) for database migration and verification steps. Those documents describe the original branch rollout. Check the target environment’s schema before testing the newer pricing, verification and owner flows. Privileged owner actions in the upgraded schema require an MFA-verified session.

The pilot still has release work around safeguarding, account recovery and operational review. The demo uses fictional accounts. Payments are outside the current pilot.
