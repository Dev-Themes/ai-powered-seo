## Latest review update

See [REVIEW_V3.md](docs/REVIEW_V3.md) for the roomier layouts, richer article/category landing pages and fixed admin access. Verification: 13 unit checks, 11 production browser checks and 140 real local responsive combinations passed.

## Local review edition

Run `npm run dev` (or `npm run review`) and open http://localhost:3000. The content-filled review edition exposes all 12 unpublished long-form drafts through `/articles` and the full local CMS through `/admin`. Testing credentials: **spotadmin / SpotReview!2026Local**. These credentials are local-only and never accepted by a production build. Local edits and revision history live in ignored `.local/review-store/`; they never commit to GitHub or change production. `npm run dev:connected` starts standard development with your configured GitHub integration.

The homepage has an expanded set of editorial sections. Articles contain approximately 1,900–2,050 words, actual 9–10 minute reading estimates, two inline images, a cover image, five native accordion FAQs, a contents navigation and an author card. Random contributor profiles are explicitly fictional and used for draft previews. Publication timestamps remain unset until approval; draft preparation dates are shown honestly. Seven generated scenes contain no people and are stored as optimised WebP images. See `docs/IMAGE_ASSETS.json` for prompts, origins and sizes.

﻿# Spot Magazine

A portable Next.js App Router magazine with a GitHub-backed single-administrator CMS, reviewed editorial publishing, real Google reporting and Gemini recommendations.

**Status:** implemented for local and preview review; not deployed or approved for replacing the existing website. Twelve original articles are drafts. The public site intentionally shows no unpublished articles. Read `docs/TEST_RESULTS.md` for executed checks and remaining limitations.

## Run locally

Requires Node.js 24 LTS and npm. The lockfile pins the tested packages; the installed Next.js version is 16.4.5.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without secrets the magazine renders from the checked-in content and admin access remains disabled. To use the authenticated CMS, follow [MANUAL_SETUP.md](MANUAL_SETUP.md). There is no default password and no authentication bypass in the application.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

`npm run test:e2e` runs Playwright against a production server on port 3100. First install its matching Chromium with `npx playwright install chromium`. If using an already installed compatible browser, set `PLAYWRIGHT_EXECUTABLE_PATH` to its executable. Browser tests use an isolated transport in `tests/e2e/mock-github.mjs`; it runs only in the test server and never changes GitHub or the checked-in content. See the testing document for what the mocks can and cannot establish.

## What is implemented

- Editorial homepage, paginated article/category pages, search, author page, informational pages and genuine 404 responses.
- Semantic light/dark/system themes, mobile navigation, local vector illustrations and generated PNG Open Graph artwork.
- Metadata, production-domain canonicals, Organization/WebSite/Article/Breadcrumb JSON-LD, sitemap and robots.
- Single-admin scrypt authentication, signed HTTP-only sessions, same-origin and CSRF verification, shared GitHub-backed login throttling.
- Markdown CRUD, formatting tools, preview, review notes, explicit publication approvals, scheduled status, image uploads, featured selections, archive/delete and GitHub revisions/rollback.
- Search Console reporting for branded queries, homepage, queries/pages, devices, countries, adjacent periods and daily trends.
- GA4 organic-session and engagement reporting, separately labelled from Search Console clicks.
- Deterministic editorial/metadata audits and structured, Zod-validated Gemini recommendations requiring human review.
- GitHub Actions for daily, weekly, monthly and approved scheduled-publication proposals, plus validation CI.

## Structure

| Path | Purpose |
| --- | --- |
| `src/app` | App Router pages, metadata and server API routes |
| `src/components` | Editorial UI, shadcn-style button primitive, admin editor and reports |
| `src/lib` | Schemas, content, storage, authentication, Google and Gemini |
| `content/articles/*.md` | Frontmatter and safe Markdown article bodies |
| `content/config` | Site settings and reviewed redirect configuration |
| `content/reports` | JSON reports, once generated; never invented seed metrics |
| `public/images` | Original vector art and approved uploaded raster images |
| `scripts` | CLI runner, password hashing, monitoring and bounded migration crawl |
| `tests` | Unit, mocked storage/API integration and browser checks |
| `docs/migration` | Observed live URLs, crawl outcomes and proposed redirect decisions |

Markdown is rendered as content, not executable MDX. Raw HTML is skipped, script URLs are rejected by the renderer, and no arbitrary JavaScript from an article is evaluated. This is the supported Markdown/MDX-storage choice for an untrusted editor surface.

## Content lifecycle

Draft → factual/source/image review → review note → explicit approval → published or scheduled. Publishing must also be enabled in website settings. New articles must first be saved as drafts. Draft, archived and future articles are excluded from public listings, search, sitemap and article routes. An authenticated preview is under `/admin/preview`.

GitHub mutations use file SHAs. Stale updates fail with a conflict rather than overwriting another version. Draft slugs may be renamed; published/archived URL changes require a redirect and content pull request. Restoring a revision creates an unreviewed draft. Permanent file deletion requires an archived version and exact-slug confirmation; Git history remains.

Production should read the protected production branch. Preview should read `cms-content`, where the CMS token can write. Merge reviewed changes into production through GitHub; do not grant the runtime token branch-protection bypass. Runtime revalidation refreshes metadata/content caches on the same instance; Git integration rebuilds deploy new image assets after the approved merge. The 60-second public-content cache limits repeated GitHub calls. No article, login state, media or report is persistently written to the application server filesystem.

The CLI uses `.local/` for temporary bundled tooling. That directory is ignored and is not application storage.

## Automation

```powershell
npm run automation -- daily
npm run automation -- weekly
npm run automation -- monthly
npm run automation -- publish
npm run audit:site
```

CLI commands use environment variables supplied by the shell or GitHub Actions; they do not automatically load `.env.local`. Use `node --env-file=.env.local scripts/run-tool.mjs automation daily` when running with a local environment file.

Monitoring does not edit public content. Workflow output is prepared in review pull requests. The hourly workflow only proposes publication of schedules already reviewed in content, with both the configuration and `APPROVED_SCHEDULES` enabled. It never merges a PR or deploys. Scheduled timing is therefore subject to Actions availability, review and deployment; it is not a guaranteed exact-minute release.

Reports distinguish complete, partial and failed integrations. Search Console final data uses a four-day lag and adjacent 28-day windows. Top-row reports may be incomplete or anonymised; GA4 reports are capped at 10,000 rows. Average search position is not a live rank. There are no traffic or ranking guarantees.

## Storage and operating limits

Use a **private repository**: drafts, queries and editorial reports are not public assets. The admin permits up to 200 articles and 200 image-directory entries. Uploads are limited to 2 MB, 25 million input pixels, resized to 2400px and re-encoded as WebP without original metadata. Raster magic bytes and decoding are checked; SVG uploads are not accepted. Images supplied in the source repository are trusted, reviewed assets.

Report retention keeps at most 180 files / 90 days in the active tree. Reports and deleted content remain in Git history. GitHub history removal and personal-data deletion require a separate reviewed repository procedure. For larger collections, replace directory-wide fetching with a generated content index and reassess API quotas. A free tier is not an unlimited throughput guarantee.

## Deployment and migration

See [MANUAL_SETUP.md](MANUAL_SETUP.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/MIGRATION.md](docs/MIGRATION.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md).

Do not connect or change production DNS, deploy this edition over the live site, activate unreviewed redirects, or publish article drafts until the corresponding approvals are complete. Existing articles have not been imported. The partial URL inventory is not a complete migration clearance.
