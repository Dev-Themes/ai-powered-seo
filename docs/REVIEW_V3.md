# Review update: space, collections and working admin access

## What changed

- Added a consistent responsive spacing scale: more separation between sections, roomier article cards, increased paragraph/heading spacing and more comfortable feature/FAQ layouts.
- Added left-to-right colour-fill hover and keyboard-focus transitions to buttons, with semantic colours in both themes and reduced-motion support.
- Rebuilt the brand as an editorial serif wordmark with a restrained circular S/focus emblem. Header, footer, favicon and social artwork use the revised identity.
- Expanded `/articles` into featured, latest, full-library, editor-pick, subject-directory, long-read and FAQ sections. Category filters and pagination operate on the actual article collection.
- Expanded each category into a subject-specific introduction, spotlight, article collection, editorial subject notes, related reading, FAQ and other-section directory.
- Expanded About and Search so navigation leads to a considered destination with useful further paths.

## Articles available for inspection

The local review edition includes all 12 substantial UK lifestyle, entertainment, culture and digital-life drafts, each approximately 1,900–2,050 words with real calculated 9–10 minute reading estimates. They contain metadata, canonical/structured-data handling, clear heading structure, images, a contents list, a practical worksheet and FAQs.

Examples:

- `/articles/a-slower-weekend-close-to-home`
- `/articles/how-to-enjoy-a-museum-without-seeing-everything`
- `/articles/a-more-considered-small-living-room`
- `/articles/how-to-choose-a-theatre-seat`
- `/articles/check-an-online-claim-before-sharing`

The complete library is at `/articles`. Source articles remain unpublished drafts; their visibility in the loopback review edition does not approve production publication.

## Admin access

Use `http://localhost:3001/admin` with username **spotadmin** and password **SpotReview!2026Local** for local testing. The older unconfigured process on port 3000 could not be stopped because Windows denied access. A development-only, loopback-restricted handoff now forwards its magazine/article/admin paths to the configured review instance while preserving the path and query.

The handoff is disabled in production, for configured environments, for the active review instance and for external origins. Its target comes from ignored local runtime state and is validated as a loopback HTTP address. The launcher reuses a healthy existing review instance, rather than replacing its runtime pointer with a port that cannot start.

The existing scrypt/session/CSRF single-admin authentication is sufficient for this CMS; no Clerk service or Neon database was necessary. Real local file operations remain isolated from GitHub and production. Production authentication continues to require environment-managed credentials.

The login form now has a real POST fallback. Native submissions are bounded and validated server-side, set the same signed HTTP-only session and redirect without putting credentials in query parameters. The admin referrer policy preserves same-origin form validation. Invalid native submissions use non-sensitive error codes. JavaScript-disabled browser login was executed successfully.

## Verification

- Production build and strict TypeScript: passed.
- ESLint: passed.
- 13 unit/mocked integration checks: passed.
- 11 focused production browser tests: passed, including metadata/draft isolation, themes, contrast/touch targets, CMS operations, image validation, revision restore, FAQs and JavaScript-disabled login.
- 140 real local page/theme/viewport combinations: passed at 320, 375, 425, 768, 1024, 1440 and 1920px in both themes. This includes the home, article library, all four categories, About, Search, a detailed article and admin overview.
- Category filtering, actual colour-fill transition and main-port forwarding/login: passed.
- Screenshots and structured results are saved in `docs/qa/v3-*`.

No production deployment, domain/DNS change, content publication or database provisioning was performed. Existing external integration and migration release gates remain documented in MANUAL_SETUP.md and TEST_RESULTS.md.
