# Existing-site migration report

Audit date: 8 November 2026. Scope: read-only retrieval. No live content, redirects, DNS or hosting were changed.

## Evidence and limits

The [current homepage](https://spotmagazine.co.uk/) and its navigation exposed article and information-page URLs. `migration/observed-urls.json` records 19 observed URLs with titles and discovery context. Browser-readable retrieval did not expose raw HTTP headers or canonical tags, so those fields are null. A cached retrieval must not be treated as proof of a current 200 response.

The local bounded crawler was executed and could not fetch any of the five initial endpoints from this execution environment. `migration/crawl.json` records these failures without invented status codes. Sitemaps at sitemap.xml, sitemap_index.xml and wp-sitemap.xml and robots.txt were not available through the accessible web retrieval path. No complete site export or Search Console credentials were supplied.

Consequently this inventory is **partial**. It does not establish organic value, the complete article count, index status or a safe go-live redirect map. Existing articles have not been imported into the new draft collection.

## Proposed URL decisions

- Keep `/` as the branded homepage, only after replacement approval.
- `/about-us/` → `/about` and `/contact-us/` → `/contact` are proposed semantic equivalents. `migration/redirect-proposals.json` records them as unapproved 301 proposals.
- Preserve `/privacy-policy/` as the corresponding policy path; legal/operator details and policy wording need review before replacement.
- Preserve/import existing article URLs after content/factual/rights review. The new evergreen draft collection is not a substitute destination for unrelated celebrity, travel, business or other old articles.
- Do not redirect unrelated old articles to `/`, a category listing or an unrelated new guide. Decide individual keep, relevant replacement, 404 or 410 outcomes after reviewing content and real search performance.

The active `content/config/redirects.json` is intentionally empty. No redirect proposal was activated. Approved entries should use `statusCode: 301`; Next.js `permanent: true` uses 308 and is not the requested 301. Also account for the framework's trailing-slash normalisation when testing exact legacy URLs. Match old and new slash conventions to avoid an avoidable extra hop.

## Required completion before launch

1. Export the full WordPress/site content, database and media and retain a restorable backup. Verify authorship, permissions and accuracy rather than copying unsupported claims blindly.
2. Run `npm run audit:site` from an authorised network. It reads robots, common sitemap endpoints and same-origin navigation, limits requests and records title, status, canonical and internal links. CRAWL_LIMIT defaults to 150 and can be increased up to 500. Expand the inventory from the site export for pages beyond that bound.
3. Reconcile crawl URLs with Search Console page-level performance over an appropriate historical window. The implemented 28-day dashboard is not a full migration valuation export. Include seasonal/older pages and backlinks where data is available.
4. Build a complete per-URL map with a reviewed decision, target, rationale, organic signals and content owner. An inaccessible URL is not evidence it should be deleted.
5. Import approved valuable articles, retaining original URLs where practical, or create relevant reviewed replacements. Test originals and targets on staging. Redirects must resolve in one hop to an actual indexed 200 page, with no loops or irrelevant destinations.
6. Review rollback access, privacy/terms, canonical/robots behaviour, sitemap and original-site backups with the owner. Obtain explicit replacement approval before production DNS or site changes.

## Validation commands

`npm test` checks the active redirect map for duplicates, cycles and unrelated homepage destinations. After adding approved redirects, test raw response headers with `curl.exe -I https://your-preview-host/old-path` and `curl.exe -I https://your-preview-host/new-path`. Repeat with both slash variants; record response chains. A preview noindex directive is expected. Production indexing is enabled only at the approved launch.
