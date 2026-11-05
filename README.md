# Shikshak

Shikshak is a neighbourhood-based tutoring platform. Students browse nearby tutors on a map or list and request their first class. The tutor accepts or declines the request. Only **accepted bookings** unlock shared classrooms, messaging, lesson notes, PDF homework and feedback. Teacher accounts cannot browse student profiles or locations.

**Stage: browser-only interactive prototype by default. Not approved for a public launch involving real children or payments.** Without a connected backend, signup/login and classroom actions work entirely in local browser storage, not across devices. Do not use real student personal information or personal passwords. Email verification, account recovery, safeguarding, independent security review and payments are not implemented.

## Features

| Product area | Students | Teachers |
| --- | --- | --- |
| Accounts | Individual student signup, login and profile | Individual teacher signup, login and profile |
| Profile | Name, neighbourhood, bio, stronger and weaker subjects | Name, neighbourhood, bio, qualifications, experience |
| Discovery | Nearby tutor map and searchable list, with distance-aware prices | **No student Explore, student map or student profile browsing** |
| Bookings | Request a first class with a tutor, preferred subject, level and time; see status | Receive and accept or decline student-initiated requests |
| Access | Classroom and chat open after teacher acceptance | Booking details disclose the student's name and requested class details, not their home location |
| Classroom | View/download PDF worksheets and lesson notes, submit written/PDF homework, read feedback | Schedule classes, share written/PDF notes, attach PDF worksheets, review PDF answers |
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
npm run test:pdf-notes
npm run preview
~~~

The server integration test covers role-based access, student-only class requests, teacher approval and decline, classroom/chat access gating, teacher student-location privacy, registration, account sessions, pricing, admin controls, 30-day home-location change limits, classes, homework and logout. The browser-demo test checks previous-match migration to accepted bookings, historical accounts and sessions, pending/declined sample requests, test-account switching, classroom access, homework and session isolation without network calls. The PDF test checks file validation, teacher notes and worksheets, student PDF homework submissions, replacement uploads, tutor reviews, IndexedDB storage, matched access, unrelated-account rejection and file cleanup. GitHub Actions runs both tests on main.

## Browser-only demo (default)

No external database, authentication service, Cloudflare Durable Object or API endpoint is required for this mode.

Demo login shortcuts are shown on the sign-in screen. Click one and then select **Log in**. The fixtures are fictional, and all three accounts share the test password `ShikshakDemo2026!`:

| Demo role | Email |
| --- | --- |
| Student (Aditi) | `student@shikshak.demo` |
| Teacher (Arjun) | `teacher@shikshak.demo` |
| Administrator | `admin@shikshak.demo` |

The five-month demo dataset includes **50 new profiles (22 teachers and 28 family-managed student profiles)** in addition to the original 18 fictional teacher/student profiles and the administrator, for **at least 69 seeded accounts**. Every sample account is backed by persisted, editable browser-local state, not hardcoded listing cards. The dataset covers 11 Guwahati neighbourhoods, different subjects and class levels, established accepted bookings, unanswered class requests, months of chats and classroom activity, cancelled/completed/upcoming classes, lesson notes, homework awaiting submission, submitted work awaiting review, tutor feedback, and pending/approved/rejected rate requests.

Aditi and Arjun retain their original classroom and homework history, now represented by an accepted booking. Rahul and other former preview profiles remain switchable local demo accounts that can receive class requests. The additional sample teachers/students use addresses such as `months-teacher-1@shikshak.demo` and `months-student-1@shikshak.demo` with the same test password shown above.

To create a personal test account, use **Sign up** with invented details and a test-only password. Alternatively, while signed in, open **Test accounts** in the demo bar and choose **Create a test student or teacher**. You only need to provide a name, account type, neighbourhood, subject and class level. Shikshak generates a unique fictional email and test password and publishes a starter listing automatically, so the account is discoverable immediately.

The **Test accounts** switcher displays **all** browser-local registrations (not just the preloaded demo users) alongside the demo administrator. Use the new **search field** to filter by name, email, role or neighbourhood; the active account remains at the top. Clicking **Switch** changes the signed-in identity without entering credentials again. Teacher/student dashboards, bookings, chat, classroom, and admin data are reloaded for the newly selected account, including switches between two accounts of the same role. Quick-created accounts use the shared demo password `ShikshakDemo2026!` if you later use the normal login form.

For a two-sided test: switch to a student, open **Explore** and select **Book a class** on a tutor profile. Choose the subject, class level, preferred start time and duration. Switch to the teacher and open **Bookings → Pending**, then select **Accept booking** or **Decline**. Accepted requests unlock chat and a shared classroom; declined requests do not. Both demo accounts use the same local data.

The expanded dataset is added **once** to existing browser-demo storage; it does not wipe user-created accounts, matches, messages, uploads, homework or preferences. You do **not** need to reset to see the richer history. The **Reset local demo accounts and data** control on the login screen deliberately removes this site's browser-demo state (including PDF blobs) and recreates the full expanded sample data on the next visit. Other tabs for the same website share browser storage and the active local demo identity, so do sequential account tests in one tab rather than expecting independent simultaneous logins.

LocalStorage is **not secure authentication**, and its contents can be modified by the browser user. This mode is strictly for interface and workflow testing. No signup data or classroom changes are sent to Shikshak's remote backend; there is no cross-browser sync and no migration of demo data into a future production database.

**When the backend is ready:** set the public build variable `VITE_SERVICE_MODE=api` and redeploy. This switches the centralized `src/api.ts` client back to `/api/v1` (or `VITE_API_BASE_URL`). The existing Worker and authentication checks remain in place for API mode. Do not switch without verifying the deployed API and database. Browser-demo data stays in the browser and is not uploaded to the backend.

### Try a real two-account flow

1. Sign in as the demo student Aditi (or create a new student test account).
2. Browse **Explore**, choose a tutor and request a class.
3. Switch into the tutor's account and open **Bookings → Pending** to accept or decline.
4. After acceptance, open **Classes** or **Message**. Teachers schedule lessons, share PDF notes and assign homework; students submit work for feedback.
5. As a teacher, request a custom rate in Profile. An administrator can approve or reject it.

Former preview identities are persisted browser-local demo accounts. Teachers remain discoverable by students, but student profiles are no longer returned to teachers. Old mutual matches are migrated into **accepted bookings** without deleting existing classes, messages, notes, homework or PDFs.

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

Shikshak uses Leaflet and a replaceable OpenStreetMap raster tile provider, with Photon-compatible place search, optional browser geolocation, mobile list/map switching and tile retry handling. Existing demo profiles are concentrated around Guwahati, but **new teacher/student accounts can choose a location in any city**. New listings are placed and distance-based prices are calculated from the map-selected area, not a preset Guwahati locality.

### Map-based home neighbourhood and change limit

During signup, choose your neighbourhood by searching for a city, tapping the map, or selecting **Use my location**. A marker is placed and the app uses **CivicWatch-style Photon reverse geocoding with a Nominatim fallback** to fill City and Locality. If providers cannot determine either value, you can enter the missing name yourself. The backend stores coordinates rounded to **two decimals (approximately 1 km)**, never the precise browser GPS point or home address. Public pins should be interpreted as approximate neighbourhood centres.

The initial home location is set at signup. From then on, a user can change their home area **once every rolling 30 days** (not once per calendar month). The next allowed date appears in Profile, and the shared API enforces the cooldown; ordinary bio/subject edits remain available. Older demo accounts without a saved map pin are allowed to choose their first marker once, without waiting. The original locality ID remains in legacy data for compatibility but cannot be used to bypass the limit.

Map settings: VITE_TILE_URL, VITE_TILE_ATTRIBUTION, VITE_TILE_MAX_ZOOM, VITE_GEOCODER_BASE_URL. Defaults appear in .env.example and src/mapConfig.ts. The public OSM, Photon and Nominatim endpoints have usage limits and are not guaranteed for large-scale production traffic.

## Architecture

| Layer | Source |
| --- | --- |
| React/TypeScript account, listing, map, dashboards, classroom and admin screens | src/ |
| Centralized typed API client | src/api.ts |
| Home-area map picker and reverse geocoding | src/components/HomeAreaPicker.tsx and src/services/homeArea.ts |
| Shared domain types | shared/domain.ts |
| Auth, role permissions, booking decisions, pricing and classroom logic | demo/api.ts |
| Guwahati catalogue of neighbourhoods/subjects | demo/seed.ts |
| One-time fictional account templates (not render-time listing data) | demo/fixtures.ts |
| Five-month historical activity and additional member templates (demo-only) | demo/history.ts |
| Browser-only local demo, seeded sample accounts, reset | src/services/browserDemo.ts and src/demoAccounts.ts |
| Optional local HTTP pilot backend | demo/local.ts and vite.config.ts |
| Cloudflare Workers + SQLite-backed Durable Object pilot storage | demo/worker.ts and wrangler.jsonc |
| API workflow integration checks | scripts/verify-platform.mjs |

In browser-demo mode, the shared API contract runs entirely inside each browser with localStorage. The existing Durable Object class name and binding are retained for optional Cloudflare API mode, but server state then lives in **one shared platform object**, not per browser. Neither store is suitable for large-scale production.

API root: /api/v1. Booking routes include **GET/POST /workspaces/student/bookings** and **GET/PUT /workspaces/teacher/bookings/:bookingId**. Students can GET /workspaces/student/discovery, but teachers cannot access any student discovery endpoint. Accepted bookings authorize /workspaces/{role}/classrooms and per-classroom chat, notes, sessions and homework. The old mutual-interest endpoint is disabled.

In **API mode**, sessions are tracked server-side with HttpOnly SameSite cookies. Passwords use salted PBKDF2-SHA256 derivation. Login attempts are throttled by account email. Classroom actions verify a teacher-accepted booking and role permissions. Teacher-facing responses contain no student map pins, home coordinates, student discovery descriptions or neighbourhood details. In **browser-demo mode**, the same domain logic runs locally, but the browser user controls the data and simulated session, so there is no real security boundary.

## Deployment

The existing deployment configuration still targets Cloudflare Workers with assets on production main. The frontend defaults to **browser-demo mode** even when hosted on Cloudflare; until `VITE_SERVICE_MODE=api` is explicitly configured, authentication does not contact the Worker API.

~~~sh
npm run build
npx --yes wrangler@4 deploy
~~~

The Wrangler Worker identifier remains **studylane** for backward-compatible deployment. The application name, UI and npm package name are **Shikshak**. Check the intended Worker before a manual deploy.

## Remaining launch work

This implementation is a working pilot and is **not security-reviewed for public release**. Before inviting real students (especially minors), address guardian consent, safeguarding, teacher identity verification, abuse/reporting controls, privacy and data retention requirements. The pilot also needs verified/recoverable identities, notifications, scalable relational storage and backups, secure file uploads for classwork, calendar integration, accessibility/mobile QA, and payments or billing only when the required controls are ready.

Teachers can share **PDF lesson notes or homework worksheets** (up to **10 MB per file**) in browser-demo mode. For notes, open **Classes → a matched classroom → Notes**, add a title and written notes, a PDF, or both. For assignments, open **Homework → Assign homework**, add a title and due date, and optionally attach a PDF worksheet alongside or instead of typed instructions.

Students open the same classroom to **View** or **Download** the teacher's PDF worksheet. Under an assignment's **Submit homework**, students can upload a **PDF answer sheet**, submit written answers, or use both. Tutors can view/download the PDF submission and leave written feedback. Students can replace their PDF before the teacher reviews the work; PDF files and typed homework feedback survive account switching in the same browser.

PDF bytes are kept in the browser's **IndexedDB**, separate from localStorage JSON classroom metadata. They persist across page reloads at the same website origin, but **do not synchronize across devices/browsers** and can be lost when browser storage is cleared. Resetting demo data clears the files too. Files are checked for name, MIME type, a PDF header and the 10 MB limit. In browser-demo mode, the account owner controls browser storage, so this is not real file privacy.

**API mode does not support PDF upload yet.** The UI explains this instead of pretending to upload a file. Before production release, connect private, access-controlled object storage, authenticated file-upload/download endpoints, file scanning, retention rules and size quotas. Written notes and text-only homework continue to work in both modes; live video calling, calendar invitations and money transfers are not implemented.
