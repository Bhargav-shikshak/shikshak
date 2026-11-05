# Shikshak

Shikshak is a neighbourhood-based home tutoring platform. Students find nearby teachers on a map or list; teachers discover learners who want support. After a mutual match, both have a private classroom for lessons, notes, homework submissions and feedback.

**Stage: functional pilot. Not approved for a public launch involving real children or payments.** The app has separate persistent email/password accounts, but no email verification, password recovery, safeguarding programme, independent security audit or payment service.

## Features

| Product area | Students | Teachers |
| --- | --- | --- |
| Accounts | Individual student signup, login and profile | Individual teacher signup, login and profile |
| Profile | Name, neighbourhood, bio, stronger and weaker subjects | Name, neighbourhood, bio, qualifications, experience |
| Discovery | Nearby tutor map and searchable list, with distance-aware prices | Nearby student map/list with their strong and weak subjects |
| Matching | Save tutors; mutual interest unlocks messaging | Save students; mutual interest unlocks messaging |
| Classroom | View classes/notes, submit homework, read feedback | Schedule/complete/cancel lessons, share notes, assign/review homework |
| Dashboard | Classes, homework, tutors and notes | Classes, review queue, students and notes |
| Rates | Indicative price quote based on neighbourhood distance | Request a custom base rate, subject to admin approval |
| Admin | No access | Separate administrator console: accounts, moderation and pricing policy |

There is no public teacher/student role switch: the server grants only the workspace corresponding to the signed-in account. Public pins show **approximate neighbourhood locations**, never exact home addresses.

The Shikshak visual system uses Signika headings, DM Sans text and paper-inspired surfaces.

## Local development

Node.js 22.12 or later and npm are required:

~~~sh
npm ci
npm run dev
~~~

Open http://127.0.0.1:5173. The local API stores platform state in the ignored .demo-data/shikshak-platform.json file. Signups, matches and classrooms persist across browser refreshes and can be used from different browsers on the same local server.

Run the production build and comprehensive API checks:

~~~sh
npm run build
npm run test:platform
npm run preview
~~~

The integration test covers registration, session isolation, forbidden cross-role actions, listing publication, nearby rate quotes, teacher rate requests, admin approvals, matching, class scheduling, notes, homework submission/review, account suspension and logout. GitHub Actions runs these checks when main receives commits.

### Try a real two-account flow

1. Sign up as a student, choose your neighbourhood, edit Profile and publish My listing.
2. Sign up as a teacher in another browser or browser profile. Complete Profile and publish My listing.
3. Browse **Explore** and send interest to the other person's listing. That person can match back in **Matches**.
4. Use **Classes** or the new **Classroom** action in Matches. Teachers schedule lessons, post notes and assign homework; students submit written work; teachers leave reviews.
5. As a teacher, request a personal base rate in Profile. An administrator can approve or reject it.

The Guwahati catalogue contains fictional **Preview** profiles for visual discovery. They cannot be matched with, messaged or assigned homework; real users need to publish their own listings first.

## Pricing policy

Student hourly quote = approved tutor base or platform base + capped distance supplement.

By default, the base rate is **₹400/hour**, the first **2 km** are included, each started additional **2 km** costs **₹50**, and the travel fee is capped at **₹300**. Distance is measured in a straight line between the approximate centres of the student's saved home neighbourhood and the tutor's neighbourhood. It is not a road-route estimate or an invoice.

Teachers cannot bypass platform rates by submitting a price through the listing endpoint. They may propose a ₹100–₹10,000 base from Profile; their approved rate replaces only the base component after administrator approval. The admin console can update the default base, included distance, distance step, step fee and cap.

## Administrator

An admin account **cannot** be created through public signup. One-time setup requires a high-entropy server-side bootstrap secret of at least 24 characters.

For Cloudflare Workers, configure a secret named **ADMIN_BOOTSTRAP_TOKEN** in the Worker runtime environment (never in a public VITE_ variable). With an authenticated Wrangler CLI, this is also possible:

~~~sh
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN
~~~

For local development, set the server environment variable **SHIKSHAK_ADMIN_BOOTSTRAP_TOKEN** before running npm run dev. Do not commit the token.

Open **Admin access → First-time setup**, enter your token and create the first administrator. Once any admin exists, further bootstrapping is blocked. The administrator can log in from Admin access and approve or reject tutor rate requests, update pricing rules, suspend/reactivate member accounts and hide listings. Removing the setup secret after initial setup is recommended.

All of these permissions are checked in the API and cannot be gained by changing URL routes.

## Maps

Shikshak uses Leaflet and a replaceable OpenStreetMap raster tile provider, with Photon-compatible place search, optional browser geolocation, mobile list/map switching and tile retry handling. The default area is Guwahati, Assam. Searching another city changes the map viewport but does **not** create tutors or listings in that city.

Map settings: VITE_TILE_URL, VITE_TILE_ATTRIBUTION, VITE_TILE_MAX_ZOOM, VITE_GEOCODER_BASE_URL. Defaults appear in .env.example and src/mapConfig.ts. The public OSM and Photon endpoints have usage limits and are not guaranteed for large-scale production traffic.

## Architecture

| Layer | Source |
| --- | --- |
| React/TypeScript account, listing, map, dashboards, classroom and admin screens | src/ |
| Centralized typed API client | src/api.ts |
| Shared domain types | shared/domain.ts |
| Auth, sessions, role permissions, pricing, matching and classroom logic | demo/api.ts |
| Guwahati catalogue and fictional preview profiles | demo/seed.ts |
| Shared local pilot storage | demo/local.ts and vite.config.ts |
| Cloudflare Workers + SQLite-backed Durable Object pilot storage | demo/worker.ts and wrangler.jsonc |
| API workflow integration checks | scripts/verify-platform.mjs |

The existing Durable Object class name and binding are retained for Cloudflare compatibility, but state now lives in **one shared platform object**, not one per browser session. Old per-browser demo data is not migrated. This shared single-object JSON datastore is only suitable for a controlled pilot, not high-scale production.

API root: /api/v1. Main access-controlled routes include /auth/signup, /auth/login, /auth/me, /profile, /profile/request-rate, /workspaces/{role}/discovery, /workspaces/{role}/listing, /workspaces/{role}/connections, /workspaces/{role}/classrooms, per-match messages and classroom actions, and the admin endpoints.

Sessions are tracked server-side with HttpOnly SameSite cookies. Passwords use salted PBKDF2-SHA256 derivation. Login attempts are throttled by account email. Classroom actions verify both mutual-match membership and teacher/student permissions.

## Deployment

The existing deployment configuration still targets Cloudflare Workers with assets on the production main branch.

~~~sh
npm run build
npx --yes wrangler@4 deploy
~~~

The Wrangler Worker identifier remains **studylane** for backward-compatible deployment. The application name, UI and npm package name are **Shikshak**. Check the intended Worker before a manual deploy.

## Remaining launch work

This implementation is a working pilot and is **not security-reviewed for public release**. Before inviting real students (especially minors), address guardian consent, safeguarding, teacher identity verification, abuse/reporting controls, privacy and data retention requirements. The pilot also needs verified/recoverable identities, notifications, scalable relational storage and backups, secure file uploads for classwork, calendar integration, accessibility/mobile QA, and payments or billing only when the required controls are ready.

The current notes and homework submissions are text-based; external work links may be pasted. No file attachments, live video calling, calendar invitations or money transfers are implemented yet.
