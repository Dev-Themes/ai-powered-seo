# Local testing edition

Run `npm run dev` or `npm run review`, then open the local URL printed in the terminal.

- Magazine: `/`
- All articles: `/articles`
- Article example: `/articles/a-slower-weekend-close-to-home`
- Administrator: `/admin`
- Username: **spotadmin**
- Password: **SpotReview!2026Local**

The credentials are deliberately for local testing. They are set only by `scripts/review.mjs`; a production build does not enable the local mode. The server binds to 127.0.0.1. The normal production authentication remains environment-managed, with no built-in production password.

The existing development process on port 3000 was left untouched. The revised review edition was started on **http://localhost:3001** for verification. To use that port yourself in PowerShell:

```powershell
$env:SPOT_REVIEW_PORT = '3001'
npm run review
```

If the previous server is stopped and you prefer port 3000, clear that variable or set it to 3000, then run `npm run dev` again. Use the exact localhost origin printed by the launcher so the CSRF Origin check matches.

## What the local mode does

All 12 real editorial draft files are readable through the magazine's normal routes in this local-only, noindex review edition. They are approximately 1,900–2,050 words, with calculated 9–10 minute reading estimates. They remain drafts in the source repository. Draft dates are honestly labelled as preparation dates; actual publication dates appear when an article is reviewed and published.

The first local request copies content and image records into ignored `.local/review-store/`. The CMS performs actual local file operations, SHA conflict checks and revision recording there. Local create, edit, media upload, archive/delete, settings and reports do not commit to GitHub or alter the source articles. Uploaded local images can be served by the local-only image route.

Changes in this store persist between local review runs. It is not a production datastore and is excluded from deployment tracing. For a fresh local review, stop the review server and archive the review-store directory after verifying its absolute path. Do not remove it if you want to keep local edits. There is no automatic destructive reset.

Run `npm run dev:connected` for the standard GitHub-connected development workflow described in MANUAL_SETUP.md. Production always uses the protected GitHub configuration, reviewed content and production authentication.

## Images and author profiles

Seven final image-generation assets are compressed WebP files in `public/images`: neighbourhood, reading-room, theatre, quiet-desk, museum, herb-garden and film-night. The scenes were visually checked for no people or nudity. They depict imagined places and are labelled as AI-generated illustrations rather than documentary photographs. `docs/IMAGE_ASSETS.json` records the prompts, output paths and file sizes. The unused desk image with unwanted lettering was not added to the public assets.

The requested random contributor data is explicitly labelled as fictional sample profiles in draft previews. These profiles have text initials, not invented human photographs or professional credentials. Published articles retain the organisational editorial-desk attribution.
