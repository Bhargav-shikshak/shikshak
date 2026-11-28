# Public SEO rollout

Cloudflare renders public discovery pages as HTML. Two public guides are indexable. Subject, locality and grade pages are noindex until real public inventory exists. Production sitemap contains indexable routes only. No fake reviews or listings. Existing authenticated workspace is unchanged.

## Search Console
After deployment inspect /tutors/guwahati and /tuition-jobs/guwahati and resubmit /sitemap.xml. In Performance > Search results compare clicks, impressions, CTR and average position over 28 days. Filter pages by /tutors/ or /tuition-jobs/ and branded versus nonbranded queries. API integration is not configured.

## Remaining privacy work
Existing listing publication is not consent to external indexing. Add explicit revocable public opt-in and separately approved display name, subject, academic level and teaching area. Never expose account identifiers, email, phone, coordinates, student records or unreviewed free text. Require active teacher, published listing and opt-in at every read. Only then enable profile routes and inventory-driven index eligibility; return 404 and remove sitemap entries on withdrawal.

## Release checks
Run npm run build, npm run test:seo, npm run test:backend and Wrangler dry-run. Verify production responses and Google live inspection after deployment.
