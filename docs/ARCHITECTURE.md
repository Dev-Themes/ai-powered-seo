# Architecture and operating decisions

## Boundaries

Next.js App Router serves the public magazine and authenticated editor. React Server Components handle public data and article rendering. Client code is limited to navigation/theme controls and interactive admin screens. Tailwind semantic tokens support the CSS layouts; the repository-owned shadcn-style Button uses Radix Slot, CVA and shared utilities. No Motion library is included because the interface does not need it.

The only authoritative mutable store is a private GitHub repository. Markdown frontmatter holds article metadata, including reviewed status and approved scheduling time. JSON holds website settings, redirects, login throttling and generated reports. Runtime code never persists articles or reports to a host filesystem. Local `.local/` files are temporary CLI/test build outputs only.

## Trust and authentication

A single administrator authenticates against an environment-managed scrypt hash. Sessions carry expiry, a random CSRF token and a password-hash epoch, protected with HMAC-SHA256. Cookies are HTTP-only, Secure in production, same-site strict and scoped to `/`. Changing the hash or signing secret revokes sessions. There is no publicly registered account or recovery endpoint; environment access is the recovery path.

The login limiter uses one repository file and SHA compare-and-swap. Five attempts are allowed in a 15-minute global window. It survives serverless restarts and is shared across instances without storing IP addresses. The tradeoff is that repeated hostile attempts can temporarily lock out the owner, and storage outages deliberately prevent sign-in. Successful logins also count toward the small window. There is no blanket claim of per-IP distributed rate limiting for all API routes; authenticated endpoints rely on one administrator, bounded inputs and provider quotas. Add a host-level request limit if operating under sustained abuse.

Every admin mutation checks both the signed session and exact configured Origin plus CSRF header. The API accepts bounded JSON bodies. Media is bounded before multipart parsing, signature-checked, decoded with a pixel limit, resized and re-encoded to WebP. Metadata is discarded. Untrusted raw HTML and executable MDX are not supported. Markdown links use the renderer's safe URL transformation and CSP prevents external frames and arbitrary image hosts.

## Editing and publication

GitHub Contents API SHAs prevent silent overwrites. A conflict asks the editor to reload. A draft rename creates the replacement then deletes the original with its SHA; this is deliberately restricted to drafts. If the second operation fails, both draft files may remain and must be reconciled; no published URL is silently changed. Multi-file atomic operations would need Git trees/commits rather than the Contents API.

A reviewer must record source/image checks and explicitly approve published or scheduled status. Publishing must be enabled separately in settings. Production uses a protected branch; the preview CMS edits a review branch. The application does not bypass GitHub branch rules. Publication in the review branch is an editorial state; the production merge/deploy approval is separate. Rollback restores content as an unreviewed draft. Archive and delete are distinct, deliberate operations.

Public data is cached for 60 seconds and invalidated on successful local mutations. Uploaded images require a build because assets are packaged with deployment. Host Git integration rebuilds on approved branch changes. No provider-specific database, object store or background runtime is required.

## Google and AI

Search Console and GA4 use service-account OAuth with read-only scopes. Reports preserve missing sources separately. Search Console uses final data and a four-day safety lag; adjacent 28-day totals provide a comparison period. Query and GA4 row limits are explicit. GA4 organic sessions remain distinct from clicks, and weighted engagement uses engaged sessions divided by sessions.

Gemini receives real article content, homepage metadata/context and the latest available metric report. Content is declared untrusted input in the system instruction. Responses must pass the Zod schema with approval required for every recommendation. The application has no automatic article-rewrite or self-publishing tool. A recommendation report is a reviewable proposal, not a promised ranking gain.

## Automation and cost

GitHub Actions runs daily collection, weekly audit/recommendations, monthly summaries and hourly approved-schedule checks. It retries transient analysis failures and serialises jobs through concurrency protection. Generated content/report changes become pull requests; nothing is automatically merged or deployed. Reports can be viewed in the PR immediately and in the dashboard after merging to its configured branch. Failures use GitHub's native workflow annotations and subscribed notifications.

GitHub API requests, Actions minutes and Gemini quotas remain real limits. The application caps active article/media collections and report retention to stay manageable for a small magazine. A high-traffic or multi-editor deployment requires further indexing, queueing and authentication design rather than assuming this architecture scales without change.

## Revised design and long-read edition

The homepage now contains eleven content sections, including the cover/radar layout, latest stories, visual categories, four topical story collections, editor selections, the weekend notebook and an about feature. Native details/summary elements provide the article FAQ accordions with no additional client-side animation library. The theme control is a single light/dark toggle, initially respecting system preference.

The initial stories were expanded to approximately 1,900–2,050 words, with two inline generated images, a cover, a contents navigation, a decision worksheet, five FAQs and a brief author card. All remain unreviewed source drafts. Fictional contributor profiles are labelled as such and are confined to draft preview contexts. The actual publication timestamp is still assigned only through the reviewed publishing flow.
