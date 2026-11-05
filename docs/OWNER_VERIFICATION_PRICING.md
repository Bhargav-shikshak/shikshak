# Shikshak: teacher pricing, teacher verification and owner hierarchy

This change set is staged on `dev/pricing-verification-roles`. **Production main and the production Supabase database are not modified by these commits.** Do not merge or deploy onto production until completing the staging tests below.

## Product and authorization rules

- A tutor sets their own hourly base rate on **My listing**. The old platform base rate and custom-rate-approval flow are no longer used in the new database gateway.
- A student's hourly quote uses `tutor base rate + capped travel supplement`. The distance is calculated from the coarse teacher and student neighbourhood coordinates. Configurable travel policy: included radius, distance step, fee per step and cap. Example: ₹500/hour, 6 km apart, 2 km included, ₹50 per extra 2 km, ₹300 cap → ₹600/hour quoted.
- New tutors are unverified. A tutor can prepare a listing but does not appear in student discovery and cannot receive new booking requests until an administrator or owner verifies the account. A blue check-shaped **Verified by Shikshak** badge appears after approval. Revocation hides new discovery immediately but does not cancel existing classrooms.
- Any number of owners and admins can exist. Owners can promote another *confirmed, active* registered member to owner or admin, and can revoke staff permissions. Original student/teacher role is restored on revocation. Last active owner and self-demotion are protected. Admins can verify tutors and moderate student/teacher accounts and listings, but cannot grant/revoke staff access or change travel policy.
- Staff role changes and travel-policy changes require an **AAL2 Supabase session with TOTP**. Owners enroll an authenticator in the Owner console and must enter a six-digit code after each ordinary password login. The SQL gateway enforces AAL2, even if a caller bypasses the Cloudflare Worker and calls the database RPC directly. Privileged role/verification transitions are recorded in private `staff_audit`.
- First-time setup creates **the first owner**, not an admin. The existing hashed one-time bootstrap key is checked against a confirmed Supabase Auth user. Later owners are appointed by existing owners.

## Upgrade instructions

1. Make a separate staging Supabase project with the Shikshak base backend schema, auth settings, RLS and storage bucket; do **not** run the upgrade against an empty database.
2. Apply `supabase/pricing-verification-owner-upgrade.sql` to **staging** in the Supabase SQL editor. It modifies the role check, adds `teacher_verified` and an RLS-protected audit table, updates listing/quote functions, and replaces the private RPC dispatcher.
3. Point **only the preview deployment** at the staging Supabase URL and publishable key. Avoid reusing production database bindings in the test branch. `VITE_SERVICE_MODE=api` remains the production-build frontend setting.
4. Sign up and confirm an account on staging. Configure a random 24+ character hashed bootstrap key as documented in `docs/BACKEND.md`. Open `#admin` → First-time setup. That account becomes the first owner.
5. In Owner console, enroll TOTP using an authenticator application, verify the six-digit code and confirm that owner actions are blocked before MFA and enabled after AAL2.
6. Register two teachers and one student. Confirm neither teacher is discoverable before verification. As admin/owner, verify one teacher, then publish their listing with a self-chosen rate. Check badge, discovery, distance-adjusted price and booking. Revoke verification and confirm new discovery/booking is blocked.
7. Create a second owner and an admin from confirmed existing accounts. Check admin cannot assign/revoke staff or edit travel fees. Check owner cannot demote self or the last owner. Verify role changes are captured by `staff_audit`.
8. Confirm existing chats/classrooms, notes, PDF storage, booking permissions, tests and mobile UI work. Then review a migration/rollback plan and explicitly approve production deployment.

## Security notes

Production use with minors requires independent security and privacy review, identity/qualification checks for tutors, guardian consent and abuse/safeguarding/reporting workflows. The badge signifies an administrator's review, **not** a government identity verification or Meta verification. Admins must not mark someone verified without reviewing evidence.

Owner MFA recovery needs a documented operational procedure (Supabase project owner intervention if a device is lost). Consider mandatory MFA for admins as well before launch. Never put service-role keys, TOTP enrollment secrets, or bootstrap keys in the frontend or GitHub.

Run:
```bash
npm ci
npm run build
npm run test:backend
npm run test:platform
npm run test:browser-demo
npm run test:pdf-notes
npm run test:home-area
npx wrangler deploy --dry-run
```
