# FirstRead AI SEO Dashboard — Staging Security Checklist

**Security Classification:** Confidential / Pre-Deployment Audit  
**Target Host:** `https://firstread.co.uk/`  
**Application Architecture:** Next.js 16 (App Router) on Node.js / Vercel Serverless  
**Security Evaluator:** Senior Application Security & DevOps Reviewer  

---

## 1. WordPress Read-Only Restrictions

The FirstRead integration is architecturally isolated to read-only observation. Under no circumstances can the staging dashboard execute mutating operations against the live WordPress site.

### Security Guarantees & Code Enforcement:

- [x] **Strict HTTP Method Whitelist:**  
  Enforced in `validateReadOnlyRequest` ([src/lib/firstread/security.ts](file:///D:/Muhammad%20Shariq/Internship/Israin Solutions - Ongoing/ai-powered-seo/src/lib/firstread/security.ts#L60-L75)):
  ```typescript
  if (method.toUpperCase() !== 'GET') {
    throw new FirstReadSecurityError(
      `Forbidden method "${method}". Only read-only GET requests to FirstRead are permitted.`
    );
  }
  ```
  All other HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`, `CONNECT`, `TRACE`) are rejected with a security exception prior to dispatch.
- [x] **Zero Credential Transmission:**  
  The dashboard does not store, request, or send WordPress application passwords, administrator credentials, or authentication tokens. Requests to FirstRead are strictly unauthenticated public reads.
- [x] **Zero Cookie / Nonce Transmission:**  
  Any request header containing `Cookie`, `Authorization`, or `X-WP-Nonce` is rejected at the perimeter by `validateReadOnlyRequest`.
- [x] **CMS Content Protection:**  
  Zero code paths exist to create, modify, or delete WordPress posts, pages, terms, taxonomies, comments, or media files.
- [x] **Theme & Plugin Protection:**  
  Zero code paths interact with WordPress themes, Elementor templates, Yoast settings, or LiteSpeed cache controls.

---

## 2. Exact Permitted API Endpoints

The security allowlist rejects broad wildcard expressions (such as `/wp-json/wp/v2/`) in favor of anchored, exact regular expression patterns in `PERMITTED_PATH_PATTERNS` ([src/lib/firstread/security.ts](file:///D:/Muhammad%20Shariq/Internship/Israin Solutions - Ongoing/ai-powered-seo/src/lib/firstread/security.ts#L25-L45)).

### Permitted Endpoint Allowlist:

| Path / Endpoint Pattern | Regular Expression | Purpose |
|---|---|---|
| **Root Homepage** | `/^\/?$/` | Reading live rendered HTML for title, meta tags, and OpenGraph audit. |
| **WP REST API Discovery** | `/^\/wp-json\/?$/` | Inspecting public site configuration (`name`, `description`, `url`, `home`). |
| **Published Content** | `/^\/wp-json\/wp\/v2\/(?:posts\|pages\|categories\|tags)$/` | Fetching published articles, pages, categories, and tags. |
| **Robots Exclusion File** | `/^\/robots\.txt$/` | Inspecting crawler directives and sitemap declarations. |
| **Yoast XML Sitemaps** | `/^\/(?:sitemap_index\.xml\|(?:post\|page\|category\|tag\|author)-sitemap(?:[0-9]+)?\.xml)$/` | Auditing sitemap structure and protocol consistency. |
| **Public Post Slugs** | `/^\/[a-z0-9-]+\/?$/` | Reading public rendered HTML of specific articles when DOM analysis is needed. |

### Prohibited Endpoints (Fails Closed):
- Any user enumeration endpoint (`/wp-json/wp/v2/users`) is blocked.
- Any site configuration endpoint (`/wp-json/wp/v2/settings`) is blocked.
- Any plugin or theme REST controller (`/wp-json/wp/v2/plugins`, `/wp-json/wp/v2/themes`) is blocked.
- Any administrative surface (`/wp-admin*`, `/wp-login*`, `/wp-includes*`, `/wp-content*`, `/xmlrpc.php`) is permanently blocked.

---

## 3. Manual Redirect Validation & SSRF Defense

Standard HTTP clients automatically follow HTTP redirects (301, 302, 307, 308). If an attacker induces an open redirect on the target site or server, an uninspected redirect could lead to Server-Side Request Forgery (SSRF) against internal metadata services (e.g. `169.254.169.254`) or unapproved external hosts.

### Security Architecture in `readOnlyFetch` ([src/lib/firstread/client.ts](file:///D:/Muhammad%20Shariq/Internship/Israin Solutions - Ongoing/ai-powered-seo/src/lib/firstread/client.ts#L44-L95)):

- [x] **`redirect: 'manual'` Enforcement:**  
  The native fetch client disables automatic redirects.
- [x] **Per-Hop Destination Re-Validation:**  
  When a redirect response is received, the `Location` header is captured and re-validated through `validateReadOnlyRequest(nextUrl)`.
  If the destination URL fails any of the following checks, the request is immediately terminated:
  - Origin must strictly equal `https://firstread.co.uk`.
  - Port must be standard HTTPS (empty port string; `:8443` or `:80` are rejected).
  - Protocol must be `https:` (automatic downgrade to `http:` is blocked).
  - Path must match the exact permitted allowlist regexes.
  - No embedded credentials (`user:pass@host`) are permitted.
  - No path traversal sequences (`..`, `%2e`, `\\`, `%5c`, `\0`, consecutive slashes `//`) are permitted.
- [x] **Hop Limit Counter:**  
  A strict maximum of 3 redirect hops prevents infinite redirect loops and denial-of-service attempts.

---

## 4. Authentication and Session Protection

The dashboard employs defense-in-depth authentication to ensure that staging previews are inaccessible to unauthorized visitors.

- [x] **Strong Password Hashing:**  
  Authentication uses `scrypt` key derivation (`scrypt:salt:hash`) with high memory and CPU cost parameters via `crypto.scryptSync`. Passwords are verified in constant time (`crypto.timingSafeEqual`) to prevent timing attacks.
- [x] **Signed Session Tokens:**  
  Session tokens are signed with HMAC-SHA256 (`signSession`) using a high-entropy `SESSION_SECRET` (minimum 32 characters). Expired or tampered tokens are rejected.
- [x] **`__Host-` Cookie Security:**  
  In production environments (`NODE_ENV=production`), the session cookie is named `__Host-spot-session` and configured with:
  - `httpOnly: true` (prevents access from JavaScript / XSS).
  - `secure: true` (ensures cookies are only transmitted over TLS/HTTPS).
  - `sameSite: 'strict'` (blocks cross-site request leakage).
  - `path: '/'` (required by RFC 6265 for `__Host-` cookies).
- [x] **CSRF Protection:**  
  Mutating internal API calls (`POST /api/admin/*`) require double validation:
  1. Origin verification: `sameOrigin(request)` verifies that the request origin matches `APP_URL`, `VERCEL_URL`, or local development origins.
  2. Anti-CSRF Token: The request must carry an `x-csrf-token` header that matches the CSRF secret embedded inside the signed session.
- [x] **Brute-Force Rate Limiting:**  
  The login endpoint (`/api/auth`) enforces a rate limit of maximum 5 attempts per 15-minute window, returning HTTP 429 Too Many Requests with a `Retry-After: 900` header.

---

## 5. Storage Isolation & Data Protection

- [x] **Zero Public Asset Exposure:**  
  Report snapshots and approval files reside in `content/reports/`, which is outside the `public/` webroot. Static web servers cannot serve these files directly to unauthenticated visitors.
- [x] **API Authorization Barrier:**  
  All internal report retrieval endpoints (`GET /api/admin/reports/:id` and `GET /api/admin/reports`) require an active, authenticated administrator session. Unauthenticated requests receive HTTP 401 Unauthorized.
- [x] **Report Identifier Sanitization:**  
  The report loader in `getReportById` validates IDs against `/^firstread-(?:audit|recommend)-[0-9]+$/` before attempting file access, eliminating directory traversal vulnerabilities in report lookup.

---

## 6. Approval Workflow Safety

- [x] **Internal State Only:**  
  When an administrator clicks "Approve" in the dashboard, the approval status is persisted strictly inside the internal JSON store (`firstread-approvals.json`).
- [x] **Zero Outbound WordPress Calls:**  
  The approval API route (`POST /api/admin/firstread/approve`) does not issue any network requests to FirstRead. It exists purely as an editorial workflow tool for content teams.
- [x] **Audit Trail Maintained:**  
  Each approval record records `{ approved: boolean, updatedAt: ISOString }` to provide full accountability for editorial decisions.

---

## 7. Residual Risks & Staging Considerations

| Residual Risk | Severity | Impact | Mitigation / Recommended Action |
|---|---|---|---|
| **Ephemeral Storage on Serverless** | Medium | Reports generated at runtime via the UI on Vercel are stored ephemerally in `/tmp` and reset when lambdas recycle. | Use CLI commands (`npm run automation audit`) to generate persistent snapshots committed to the repository, or adopt Vercel KV / Blob before production. |
| **Unconfigured Google APIs** | Low | Google Search Console and GA4 interfaces report unconfigured status. | This is truthful and secure; credentials should only be supplied when Google Cloud service accounts have been verified by the client. |
| **Live WordPress Protocol Inconsistencies** | Low | Live WordPress declares HTTP `site_url` and HTTP sitemaps. | These are client-side configuration defects on `firstread.co.uk` and must be corrected in WP Admin by the site administrator. |
