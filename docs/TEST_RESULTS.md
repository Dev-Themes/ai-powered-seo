## Latest review update

See [REVIEW_V3.md](REVIEW_V3.md) for the roomier layouts, richer article/category landing pages and fixed admin access. Verification: 13 unit checks, 11 production browser checks and 140 real local responsive combinations passed.

# Revised edition verification

The revised edition passes the production build, strict TypeScript and lint. Eleven unit/integration tests pass. Twenty-three production functional/responsive browser checks passed; the performance probe passed separately after its logo selector was scoped to the header. The real local review edition also passed 70 rendered page/theme/viewport checks, actual local file CRUD, login and FAQ interaction, with zero captured browser errors.

The matrix includes 320, 375, 425, 768, 1024, 1440 and 1920px in both themes. The production run covers the public pages and authenticated long-read previews; the additional local matrix verifies normal article routes and the real local CMS store. Evidence: `docs/qa/v2-summary.json`, `docs/qa/local-review-v2-results.json` and the revised screenshots. The final desktop screenshot was captured only after all 27 images decoded.

The revised local mobile performance observation recorded LCP **588 ms** and CLS **0**, without throttling. This remains a local observation, not a Lighthouse score or field measurement.

Seven generated scenes were selected and compressed to WebP. The twelve articles contain 1,917–2,026 words and calculated 9–10 minute reading estimates. Source publication status is unchanged: all remain editorial drafts. Sample author details are explicitly fictional.

The local test account is development-only, loopback-bound and disabled in production. See `docs/LOCAL_REVIEW.md` for credentials, routes, storage behaviour and startup. Production credentials, real Google/Gemini calls, full migration clearance, Lighthouse scores and the reported dependency-advisory review remain the same outstanding release checks described below.

---

## Earlier baseline and operating limits

﻿# Verification results and release limits

This document records executed checks, not promises. Final browser evidence is stored in `docs/qa/browser-results.json`: 23 passed, 0 failed. Ten unit/mocked integration tests also passed. The final local 375px observation recorded LCP 220 ms and CLS 0; this is not a Lighthouse score or field result.

## Executed development checks

- Production build on Next.js 16.4.5 / React 19.3.1: successful. All requested public routes and private CMS/API routes compile.
- Strict TypeScript: passed.
- ESLint: passed without warnings after temporary implementation generators were removed.
- Ten unit/mocked integration tests: passed. They cover all 12 draft schemas, substantive bodies and internal references, publication gates, invalid paths, password/session checks, structured AI approval, deterministic audits, redirect validation, GitHub SHA conflicts and approved scheduled publishing.
- Lockfile: direct dependency versions match package.json. `npm ci --dry-run --offline --ignore-scripts` completed successfully; this was not a clean online install or a new advisory audit.
- GitHub Actions YAML: both workflow files parsed successfully. The actual hosted Actions workflows have not been executed in a connected repository.

## Browser verification

Playwright uses the production build and an isolated, in-memory GitHub REST transport. The transport is loaded only by `tests/e2e/server.mjs`; production source never imports it. Authentication still runs through the real login handler, scrypt verification, HTTP-only cookies, Origin checks, CSRF checks and GitHub-backed throttle logic. It does not contact a real repository or expose a production test account.

The responsive matrix covers 320, 375, 425, 768, 1024, 1440 and 1920px in light and dark themes. Each matrix case navigates 15 public/login/404 pages and 14 authenticated dashboard/editor/preview pages and checks the settled heading and document width. Screenshot review supplements the overflow assertions; those assertions alone are not a proof that every possible future content shape can never overlap.

Additional browser checks cover persisted themes/mobile navigation, semantic colour contrast, 44px mobile header targets, metadata/structured data, genuine draft and missing-page 404s, sitemap draft exclusion, unauthorised API access, noindex admin pages, missing-CSRF rejection, full article CRUD/publishing approval, SHA conflict handling, public URL-change prevention, archive/delete confirmation, revision rollback, image decoding and logout.

An actual HTTP defect was found and fixed: the root streaming loading boundary caused a draft article's notFound() to arrive after an HTTP 200 response began. Removing that boundary restores genuine 404 status. Admin panels retain working loading skeletons. Earlier selector failures caused by transient navigation and Next.js's separate route-announcer alert were corrected in the tests, not concealed as passes.

## Performance limits

The local browser observation records LCP, CLS, navigation timing and resource transfer size for the unpopulated public homepage at 375px. It runs without network/CPU throttling. See `docs/qa/local-performance.json` for the measured values and timestamp. It is **not** a Lighthouse score or field Core Web Vitals measurement, and no INP result is claimed.

Lighthouse has not been run. The requested 90+ scores remain an unverified release target. Measure representative public/article pages on the credentialed preview and again in production; article imagery and real hosting latency can change results materially.

## Unverified external operations

- Real GitHub token permissions, branch protection, content commits, deployment integration and GitHub-hosted Actions need credentialed testing. Mocked CRUD does not prove those external permissions are configured correctly.
- Search Console, GA4 and Gemini have no supplied credentials. The local automation commands were executed: collection/monthly reports are partial, Gemini recommendations report failed/unavailable, deterministic audit completed, and scheduled publishing remained disabled. No analytics values or AI results were fabricated.
- The migration crawl attempted all five seed URLs and failed to fetch them in this environment. A separate read-only web inventory observed 19 URLs; HTTP status/canonical fields remain unknown. The current site has not been fully inventoried or imported.
- The first installation reported eight moderate vulnerabilities. The online npm audit endpoint was unreachable here. The offline audit's empty advisory response is not evidence of a clean dependency tree. Registry advisory review and any necessary upgrades remain a release gate.
- esbuild and Sharp were executed successfully. The user's install warning about protobufjs postinstall requires review under their npm script policy; live Google calls remain unverified.

## Known operating constraints

- No production deployment, domain/DNS change, content release or redirect activation was performed.
- The 12 initial stories remain unreviewed drafts. Internal links between drafts must be reviewed together at publication. Public pages correctly do not present those articles as published.
- Legal/controller identity, a monitored contact address and hosting-specific privacy/retention details must be completed by the owner.
- Categories are the four JSON-configured initial editorial sections. The CMS assigns categories and edits tags; changing the category taxonomy/URL structure requires a reviewed source/configuration change.
- Scheduled releases are proposed through a PR and require the configured review/deployment flow. They are not guaranteed minute-accurate autonomous production releases.
- Monitoring reports become dashboard-visible after their PR is merged into the configured content branch, or after a manual admin collection. The app does not auto-merge production code or apply AI rewrites.
- Draft slug renames use two Contents API mutations; a failure between them can leave two drafts requiring reconciliation. SHAs protect each file, but this is not a multi-file transaction.
- Deleted files/reports remain in Git history. Limits are designed for a small single-editor magazine, not an unlimited multi-editor CMS.
