# Shikshak

Shikshak is a neighbourhood-based home tutoring platform. Students find nearby teachers on a map or list; teachers discover learners who want support. After a mutual match, both have a private classroom for lessons, notes, homework submissions and feedback.

**Stage: browser-only interactive prototype by default. Not approved for a public launch involving real children or payments.** Without a connected backend, signup/login and classroom actions work entirely in local browser storage, not across devices. Do not use real student personal information or personal passwords. Email verification, account recovery, safeguarding, independent security review and payments are not implemented.

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

There is no public teacher/student role switch. Browser-demo permissions are **simulated, not secure**; when VITE_SERVICE_MODE=api, the API validates the signed-in account's role server-side. Public pins show **approximate neighbourhood locations**, never exact home addresses.

The Shikshak visual system uses Signika headings, DM Sans text and paper-inspired surfaces.

## Local development

Node.js 22.12 or later and npm are required:

~~~sh
npm ci
npm run dev
~~~

Open http://127.0.0.1:5173. **Without setting any variables, Shikshak runs entirely in browser-demo mode.** All logins, listings, matches, classrooms and sample data are saved in that browser's localStorage for the current site origin. They persist across reloads, but separate browsers/devices **do not share data**. Switching site origin or clearing browser site data starts a different demo. The local HTTP server/Cloudflare Worker is not needed by the browser-demo API.

Run the production build and comprehensive API checks:

~~~sh
npm run build
npm run test:platform
npm run test:browser-demo
npm run preview
~~~

The server integration test covers registration, session isolation, forbidden cross-role actions, listing publication, nearby rate quotes, teacher rate requests, admin approvals, matching, class scheduling, notes, homework submission/review, account suspension and logout. The browser-demo test checks local-only seeded accounts, login, signup, discovery, role separation, classrooms, approvals, persistence and reset without network calls. GitHub Actions runs both tests on main.

## Browser-only demo (default)

No external database, authentication service, Cloudflare Durable Object or API endpoint is required for this mode.

Demo login shortcuts are shown on the sign-in screen. Click one and then select **Log in**. The fixtures are fictional, and all three accounts share the test password `ShikshakDemo2026!`:

| Demo role | Email |
| --- | --- |
| Student (Aditi) | `student@shikshak.demo` |
| Teacher (Arjun) | `teacher@shikshak.demo` |
| Administrator | `admin@shikshak.demo` |

Additional demo profiles **Meghna** (teacher) and **Rohan** (student) are discoverable. Aditi and Arjun are already mutually matched and have upcoming algebra/physics classes, two lesson notes and homework including one submitted assignment waiting for tutor feedback. Meghna has a pending custom-rate request for the administrator to approve or reject. Fictional **Preview** map listings are still available but cannot be messaged or matched; the seeded accounts can.

To create another account, use **Sign up** with invented details and a test-only password. Use **Log out** to switch between student, teacher and administrator in the **same browser**. The **Reset local demo accounts and data** control on the login screen removes this site's Shikshak browser-demo state and recreates the sample data on the next visit.

LocalStorage is **not secure authentication**, and its contents can be modified by the browser user. This mode is strictly for interface and workflow testing. No signup data or classroom changes are sent to Shikshak's remote backend; there is no cross-browser sync and no migration of demo data into a future production database.

**When the backend is ready:** set the public build variable `VITE_SERVICE_MODE=api` and redeploy. This switches the centralized `src/api.ts` client back to `/api/v1` (or `VITE_API_BASE_URL`). The existing Worker and authentication checks remain in place for API mode. Do not switch without verifying the deployed API and database. Browser-demo data stays in the browser and is not uploaded to the backend.

### Try a real two-account flow

1. Sign in using the fictional demo student account, or sign up as a student and publish your listing.
2. Log out, then sign in as the fictional demo teacher in the **same browser**. You can also create another teacher account and publish its listing.
3. Browse **Explore** and send interest to the other person's listing. That person can match back in **Matches**.
4. Use **Classes** or the new **Classroom** action in Matches. Teachers schedule lessons, post notes and assign homework; students submit written work; teachers leave reviews.
5. As a teacher, request a personal base rate in Profile. An administrator can approve or reject it.

The Guwahati catalogue also contains fictional **Preview** profiles for visual discovery. They cannot be matched with or messaged. Use one of the seeded demo accounts or create a new browser-local listing to test mutual matching.

## Pricing policy

Student hourly quote = approved tutor base or platform base + capped distance supplement.

By default, the base rate is **₹400/hour**, the first **2 km** are included, each started additional **2 km** costs **₹50**, and the travel fee is capped at **₹300**. Distance is measured in a straight line between the approximate centres of the student's saved home neighbourhood and the tutor's neighbourhood. It is not a road-route estimate or an invoice.

Teachers cannot bypass platform rates by submitting a price through the listing endpoint. They may propose a ₹100–₹10,000 base from Profile; their approved rate replaces only the base component after administrator approval. The admin console can update the default base, included distance, distance step, step fee and cap.

## Administrator

In **browser-demo mode**, sign in as `admin@shikshak.demo` with the fictional test password shown above; no server secret is required. This grants simulated local admin access only.

In **API mode**, an admin account **cannot** be created through public signup. One-time setup requires a high-entropy server-side bootstrap secret of at least 24 characters.

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
| Browser-only local demo, seeded sample accounts, reset | src/services/browserDemo.ts and src/demoAccounts.ts |
| Optional local HTTP pilot backend | demo/local.ts and vite.config.ts |
| Cloudflare Workers + SQLite-backed Durable Object pilot storage | demo/worker.ts and wrangler.jsonc |
| API workflow integration checks | scripts/verify-platform.mjs |

In browser-demo mode, the shared API contract runs entirely inside each browser with localStorage. The existing Durable Object class name and binding are retained for optional Cloudflare API mode, but server state then lives in **one shared platform object**, not per browser. Neither store is suitable for large-scale production.

API root: /api/v1. Main access-controlled routes include /auth/signup, /auth/login, /auth/me, /profile, /profile/request-rate, /workspaces/{role}/discovery, /workspaces/{role}/listing, /workspaces/{role}/connections, /workspaces/{role}/classrooms, per-match messages and classroom actions, and the admin endpoints.

In **API mode**, sessions are tracked server-side with HttpOnly SameSite cookies. Passwords use salted PBKDF2-SHA256 derivation. Login attempts are throttled by account email. Classroom actions verify mutual-match membership and role permissions. In **browser-demo mode**, the same domain logic runs locally, but the browser user controls the data and simulated session, so there is no real security boundary.

## Deployment

The existing deployment configuration still targets Cloudflare Workers with assets on production main. The frontend defaults to **browser-demo mode** even when hosted on Cloudflare; until `VITE_SERVICE_MODE=api` is explicitly configured, authentication does not contact the Worker API.

~~~sh
npm run build
npx --yes wrangler@4 deploy
~~~

The Wrangler Worker identifier remains **studylane** for backward-compatible deployment. The application name, UI and npm package name are **Shikshak**. Check the intended Worker before a manual deploy.

## Remaining launch work

This implementation is a working pilot and is **not security-reviewed for public release**. Before inviting real students (especially minors), address guardian consent, safeguarding, teacher identity verification, abuse/reporting controls, privacy and data retention requirements. The pilot also needs verified/recoverable identities, notifications, scalable relational storage and backups, secure file uploads for classwork, calendar integration, accessibility/mobile QA, and payments or billing only when the required controls are ready.

The current notes and homework submissions are text-based; external work links may be pasted. No file attachments, live video calling, calendar invitations or money transfers are implemented yet.
