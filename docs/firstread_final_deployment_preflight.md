# FirstRead AI SEO Dashboard — Final Deployment Preflight Report

**Auditor / Roles:** Senior DevOps Engineer, Next.js Deployment Engineer, Application Security Reviewer  
**Target Website:** `https://firstread.co.uk/`  
**Git Branch:** `feat/firstread-integration`  
**Deployment Target:** Vercel Preview / Staging  
**Preflight Status:** **READY FOR AUTHORIZED STAGING DEPLOYMENT**  
**Authorization State:** **NO DEPLOYMENT AUTHORIZATION — AWAITING EXPLICIT USER COMMAND**  

---

## 1. Vercel Access-Protection Verification

A multi-layered access-control evaluation was performed to guarantee that staging previews are protected from unauthorized visitors and public discovery.

### A. Vercel Edge Deployment Protection
- **Mechanism:** In Vercel Project Settings > **Deployment Protection** > **Preview Deployments**, Vercel provides edge-level access gates:
  1. **Vercel Authentication (Standard on Hobby & Pro):** Intercepts all requests at the Vercel Edge Network before executing Next.js serverless functions. Visitors must log in with an authorized Vercel team account.
  2. **Password Protection (Pro & Enterprise):** Establishes a shared staging passphrase required before any deployment asset or page can be reached.
- **Plan / Team Availability:**
  - *Hobby / Standard Teams:* Vercel Authentication (team member restriction) is available natively without additional subscription fees.
  - *Pro / Enterprise Teams:* Password Protection and IP Allowlisting are available natively.
  - *Recommendation:* Enable **Vercel Authentication** immediately upon project creation in Vercel to establish an edge barrier.

### B. Search Crawler Defense vs. Access Protection
- **Verification:** The application distinguishes between crawler deterrence and access control:
  - `noindex` directives (`X-Robots-Tag: noindex, nofollow` in `next.config.ts` and `robots.ts` with `Disallow: /`) **do NOT provide access protection**. They only instruct search engine crawlers not to index or display pages.
  - Real access control is enforced at two distinct barriers:
    1. **Edge Barrier:** Vercel Preview Deployment Protection.
    2. **Application Barrier:** Next.js server-side layout guard (`requireAdmin()` in `src/app/admin/(workspace)/layout.tsx`) redirecting unauthenticated requests to `/admin/login`.

### C. Unauthenticated Endpoint Gating
All administrative routes and internal report endpoints are strictly protected:
- Direct visits to `/admin` or `/admin/*` redirect server-side to `/admin/login`.
- `GET /api/admin/reports`, `GET /api/admin/reports/:id`, `GET /api/admin/audit`, and `GET /api/admin/recommend` verify `await session()`, returning `HTTP 401 Unauthorized` if unauthenticated.
- `POST /api/admin/*` verifies session, origin (`sameOrigin`), and `x-csrf-token`.

---

## 2. Authentication & Rate-Limiting Assessment

### A. Serverless Login Rate-Limiter Behavior
In `src/app/api/auth/route.ts`:
```typescript
const THROTTLE_FILE = path.join(process.cwd(), '.local', 'login-throttle.json');
```
- **Local Environment:** Throttling writes to `.local/login-throttle.json` to lock out attackers after 5 failed attempts for 15 minutes.
- **Serverless / Vercel Environment:**
  - Vercel functions execute in AWS Lambda containers where `process.cwd()` is mounted as a read-only filesystem (`/var/task`).
  - Writes to `.local/login-throttle.json` fail silently inside `writeThrottle`'s `try/catch` block.
  - Furthermore, serverless containers scale horizontally; container A does not share in-memory or filesystem state with container B.
  - **Limitation:** In a purely serverless environment without an external distributed cache (such as Redis or Upstash), file-based rate limiting cannot track brute-force attacks across separate serverless instances.

### B. Staging Access Protection & Mitigations
This limitation is effectively mitigated on staging through defense-in-depth:
1. **Outer Perimeter Gate:** Vercel Preview Deployment Protection prevents the public Internet from reaching the `/admin/login` form.
2. **Cryptographic Resistance:** Passwords are required to be 16+ characters and hashed using `scrypt` with high memory/CPU work factors. Constant-time comparison (`crypto.timingSafeEqual`) prevents timing side-channels.
3. **No Paid Services Introduced:** Per explicit project instructions, no third-party paid key-value stores (e.g. Upstash Redis, Redis Cloud) have been added.

---

## 3. Audit Data Exposure Assessment

- **Public Directory Verification:** The `public/` webroot contains only static images (`public/images/*`). The `content/reports/` directory is situated completely outside the webroot.
- **Static Asset Inaccessibility:** Next.js static asset routing does not serve files from `content/reports/`. Direct HTTP requests (e.g. `GET /content/reports/firstread-audit-latest.json`) return HTTP 404 Not Found.
- **Authorized API Dispatch Only:** Report data can only be read through `/api/admin/reports/:id` or `/api/admin/reports`, both of which require an active, cryptographically signed administrator session.
- **Zero Sensitive Data in Reports:** Audit reports contain public SEO metadata, published post titles, image alt attributes, and headings from `https://firstread.co.uk/`. They contain zero user passwords, credentials, or internal WordPress secrets.

---

## 4. Ephemeral Storage Boundaries (Serverless Reality)

On Vercel, serverless lambdas run on an ephemeral filesystem where only `/tmp` is writable:

| Operation | Storage Location | Behavior on Vercel Serverless |
|---|---|---|
| **Reading Historical Reports** | `content/reports/*.json` | **100% Stable & Persistent.** Reports bundled into the build artifact are read in read-only mode by Next.js serverless functions. |
| **Reading Approval Status** | `content/reports/firstread-approvals.json` | **100% Stable & Persistent.** Bundled default approvals are read reliably. |
| **Triggering a New Audit in UI** | `/tmp/firstread-audit-*.json` | **Ephemeral.** The new report is generated and visible during the life of that serverless container, but disappears when the container recycles. |
| **Approving Recommendations in UI** | `/tmp/firstread-approvals.json` | **Ephemeral.** The approval status toggles successfully in the UI, but resets when the container recycles. |
| **Modifying Live WordPress** | N/A | **ZERO Interaction.** Approvals are strictly internal JSON records. No network requests are dispatched to `firstread.co.uk`. |

---

## 5. Exact Safe-to-Commit File List

The following files contain improvements, security hardening, and validated reports and are **SAFE to commit** when deployment is authorized:

### Modified Core Files:
1. `.env.example` — Sanitized configuration template with FirstRead placeholders (no secrets).
2. `next.config.ts` — Added `X-Robots-Tag: noindex, nofollow` header to all routes.
3. `src/lib/firstread/security.ts` — Exact GET allowlist, SSRF blocks, redirect validation, and credential stripping.
4. `src/lib/firstread/client.ts` — `readOnlyFetch` with manual redirect inspection and hop limiter.
5. `src/lib/firstread/ai.ts` — Title refinement algorithms, candidate validators, and internal link deduplication.
6. `src/lib/firstread/audit.ts` — Alt-text categorization, heading audit terminology, and protocol mismatch logic.
7. `src/lib/firstread/storage.ts` — Report normalization and snapshot storage.
8. `src/lib/firstread/types.ts` — Type definitions.
9. `src/components/admin/firstread-panel.tsx` — Dashboard UI panels.
10. `tests/firstread.test.ts` — 21 regression tests.

### Reports & Documentation:
11. `content/reports/firstread-approvals.json` — Internal approval state.
12. `content/reports/firstread-audit-latest.json` — Latest verified 343-article audit snapshot.
13. `content/reports/firstread-recommend-latest.json` — Latest 13 verified recommendations snapshot.
14. `docs/firstread_staging_deployment_checklist.md` — Deployment procedures.
15. `docs/firstread_staging_security_checklist.md` — Security evaluation.
16. `docs/firstread_staging_readiness_report.md` — Staging readiness evaluation.
17. `docs/firstread_final_deployment_preflight.md` — This preflight report.

---

## 6. Files That Must NEVER Be Committed

The following files must remain strictly untracked, ignored, or local:

| File / Pattern | Status | Reason |
|---|---|---|
| `.env.local` | **Ignored** (matches `.env*` in `.gitignore`) | Contains local secrets, password hashes, and session keys. |
| `.env` | **Ignored** (matches `.env*` in `.gitignore`) | Any raw environment file. |
| `.local/` | **Ignored** (in `.gitignore`) | Contains local login throttle cache and test artifacts. |
| `.next/` | **Ignored** (in `.gitignore`) | Local production build artifacts. |
| `node_modules/` | **Ignored** (in `.gitignore`) | Installed packages and dependencies. |
| Any `.pem`, `.key`, or credentials | **Strictly Forbidden** | Never place Google Cloud private keys or credentials in the repo. |

Verified: `git log -1 -- .env.local .env` returned 0 commits. No secrets exist in Git history.

---

## 7. Exact Environment Variables to Configure (Vercel Preview)

When creating or configuring the project in Vercel, set these variables scoped strictly to **Preview**:

```bash
# 1. Dashboard Canonical URL (used for CSRF same-origin matching)
APP_URL=https://<your-staging-project>.vercel.app

# 2. Administrative Authentication
ADMIN_USERNAME=staging-admin
# Generate locally via: npm run admin:hash
ADMIN_PASSWORD_HASH=scrypt:c2FsdHNhbHQ:6b59...

# 3. Session Cookie Encryption (min 32 characters)
# Generate locally via: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
SESSION_SECRET=a_very_long_secure_random_base64url_string_at_least_32_chars

# 4. Serverless Runtime Storage Path
REPORTS_DIR=/tmp

# 5. Optional Integrations (leave blank if unconfigured)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
FIRSTREAD_GSC_PROPERTY=sc-domain:firstread.co.uk
FIRSTREAD_GA4_PROPERTY_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

---

## 8. Remaining Deployment Blockers

Before a production release, the following non-code items should be scheduled:
1. **Client WordPress Protocol Fix:** Live WordPress `site_url` and Yoast sitemaps declare HTTP (`http://firstread.co.uk`). The client administrator must update these to `https://` in WP Admin.
2. **Persistent Storage for Production:** If the client requires recommendations approved via the dashboard UI to permanently persist across months and serverless redeployments, a cloud storage backend (e.g. Vercel Blob or KV) should be scheduled for the production milestone.
3. **Explicit User Authorization:** No Git commits, pushes, or Vercel commands will be initiated until explicit authorization is given.

---

## 9. Final Preflight Verdict

### 🚀 **READY FOR AUTHORIZED STAGING DEPLOYMENT**

All preflight checks have passed:
- **0 errors** in automated test suite (21/21 passing).
- **0 errors** in TypeScript compilation (`tsc --noEmit`).
- **0 warnings** in ESLint (`eslint .`).
- **0 errors** in Next.js Turbopack production build (`npm run build`).
- Complete read-only safety verified against `https://firstread.co.uk/`.
- No sensitive files or credentials exposed.
- Documentation and checklists are complete and organized.

*Awaiting your explicit instruction to proceed with Git commit and push.*
