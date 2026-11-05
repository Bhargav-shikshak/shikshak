# Shikshak backend test environment

This branch connects the completed frontend to Supabase project `Shikshak_v1` (`nkvjnawnnkrgpyacojfg`) through a same-origin Cloudflare Worker. Main is not changed or merged.

## Features

- Supabase email/password signup, login, refresh and logout. Supabase's email-confirmation setting is respected; when confirmation is required, signup shows a confirmation notice.
- HTTP-only secure host cookies; browser scripts do not receive auth or refresh tokens.
- Database-owned roles and account status; changing user metadata cannot grant administrator rights.
- Profiles with coarse neighbourhood coordinates and a transactional 30-day location-change restriction.
- Published teacher listings, student-only discovery and saved tutors. Teachers have no student discovery endpoint.
- Student booking requests and teacher accept/reject. A unique active-pair constraint prevents duplicates. Acceptance and the first classroom session commit atomically.
- Accepted-classroom chat, scheduling, notes, homework, PDF worksheets, PDF submissions and reviews.
- Private PDF storage with a 10 MB per-file limit. The Worker checks the PDF signature. Storage policies restrict access to active classroom participants; the recipient can read only documents actually attached to classroom content.
- Administrator pricing approval, publishing moderation and member suspension. Suspension is checked against the live database on every API call.

## Configuration and deployment

`wrangler.jsonc` contains only the project URL and a public/publishable key, including explicit Preview bindings. No service-role key is used by the Worker or browser. Production builds on this branch load `.env.production` and use API mode.

Cloudflare's connected repository builds `dev/backend-test` with `npm run build` and publishes a Preview with `npx wrangler preview`. Do not run a production deploy or merge to main until this environment has been reviewed.

Local checks:

```sh
npm ci
npm run build
npm run test:backend
npm run test:platform
npm run test:browser-demo
npm run test:pdf-notes
npm run test:home-area
npx wrangler deploy --dry-run
```

Use `npx wrangler dev` after building to exercise the real API locally. `npm run dev` retains the browser demo for isolated frontend work.

`GET /api/v1/health` performs a live database RPC and identifies the connected project. Authentication failures return 401; authorization failures return 403.

## Database source and verification

The SQL source is retained in execution order:

1. `supabase/schema.sql`
2. `supabase/backend-security.sql`
3. `supabase/health.sql`

These were applied to the project through migration tooling. They are installation scripts, not scripts to rerun against an existing populated database.

`supabase/verify.sql` checks workflows inside a transaction and rolls back its test records. `supabase/verify-storage.sql` checks document privacy and administrator activation similarly. The HTTP regression suite mocks external calls and checks the actual Worker handler.

Private tables have RLS enabled and no direct browser grants or policies. This is intentional deny-by-default: the only application data entry point is an authenticated RPC. Its public wrapper is SECURITY INVOKER. The private implementation uses SECURITY DEFINER with an empty search path, a verified auth.uid(), database role/status checks, endpoint-specific permissions, and transaction locks.

Supabase advisors may report informational notices for these private tables having RLS enabled without policies, and unused indexes in a new project. These are expected; no public table access is enabled.

## First administrator

Create and confirm a regular account first. Administrator activation additionally requires a one-time setup key configured in the database. There is no public demo administrator.

A project owner can configure their own random key of at least 24 characters from the Supabase SQL editor:

```sql
insert into shikshak_private.bootstrap(id,hash)
values(true,encode(sha256(convert_to('REPLACE_WITH_YOUR_RANDOM_SETUP_KEY','UTF8')),'hex'))
on conflict(id) do update set hash=excluded.hash;
```

Then open `#admin`, choose **First-time setup**, and use the existing account credentials plus that key. Activation requires a confirmed email, is serialized to allow only the first administrator, and consumes the key. Do not commit the key to GitHub. Later administrator provisioning must be performed explicitly by the project owner.

## Test environment limits

Existing browser-demo accounts and IndexedDB PDF files are not copied to Supabase. Register new accounts in the Preview; data is shared across devices and persists in the named project. Supabase Auth provider limits and quotas still apply.

Discovery and classroom payloads currently follow the frontend's aggregate API; messages return the most recent 200. Add cursor pagination to classroom history and discovery as usage grows. Unattached uploads are retained for now and should be pruned by a scheduled maintenance job before a public launch.
