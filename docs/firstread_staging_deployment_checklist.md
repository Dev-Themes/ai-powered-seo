# FirstRead AI SEO Dashboard — Staging Deployment Checklist

**Version:** 1.0.0  
**Target Domain:** `https://firstread.co.uk/`  
**Deployment Platform:** Vercel (Next.js 16.4.5 Turbopack)  
**Git Feature Branch:** `feat/firstread-integration`  
**Purpose:** Comprehensive pre-deployment and operational checklist for staging environments.

---

## 1. Deployment Prerequisites

Before initiating any staging deployment in Vercel:

- [ ] **Working Tree State:** Confirm `git status` contains only approved staging preparation files; no untracked secrets, `.env` files, or local artifacts.
- [ ] **Automated Verification:**
  - [ ] `npm test` passes 21/21 tests.
  - [ ] `npm run typecheck` passes with zero errors.
  - [ ] `npm run lint` passes with zero warnings.
  - [ ] `npm run build` generates optimized production artifacts with exit code 0.
- [ ] **Read-Only Protection Verified:** Confirm that `validateReadOnlyRequest` in `src/lib/firstread/security.ts` blocks all mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and prevents write attempts to `https://firstread.co.uk/`.
- [ ] **No Auto-Deploy on Staging:** Staging deployments must require manual trigger or preview branch targeting (`feat/firstread-integration`); do not connect production branch (`main`) to staging.

---

## 2. Environment Variable Requirements

Set the following variables in the **Vercel Project Settings > Environment Variables** (scoping specifically to **Preview / Staging**):

### A. Mandatory Variables

| Variable Name | Staging Value / Description | Sensitivity |
|---|---|---|
| `APP_URL` | Canonical staging URL (e.g. `https://firstread-seo-staging.vercel.app`). Required for CSRF `sameOrigin` verification. | Standard |
| `ADMIN_USERNAME` | Staging dashboard administrator username (e.g. `staging-admin`). | Restricted |
| `ADMIN_PASSWORD_HASH` | Scrypt password hash generated locally via `npm run admin:hash` (minimum 16 chars). Format: `scrypt:salt:hash`. | **Secret** |
| `SESSION_SECRET` | 32+ character cryptographic secret for signing session cookies. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. | **Secret** |
| `NODE_ENV` | `production` (Automatically set by Vercel for both Preview and Production builds). | Standard |

### B. Optional Variables (Integrations)

| Variable Name | Purpose | Behavior When Missing |
|---|---|---|
| `REPORTS_DIR` | Directory path for runtime reports. Set to `/tmp` on serverless if running audits in lambda. | Defaults to `process.cwd()/content/reports`. |
| `GEMINI_API_KEY` | Google Gemini API key for advanced natural language title/link generation. | Falls back to deterministic heuristic mode (all 21 tests pass in this mode). |
| `GEMINI_MODEL` | Structured output model selection. | Defaults to `gemini-2.5-flash`. |
| `FIRSTREAD_GSC_PROPERTY` | Target GSC property (e.g. `sc-domain:firstread.co.uk`). | Reports `unconfigured` status truthfully without fabricating rankings. |
| `FIRSTREAD_GA4_PROPERTY_ID` | GA4 property ID. | Reports `unconfigured` status truthfully without fabricating traffic. |
| `GOOGLE_CLIENT_EMAIL` | Service account email for GSC/GA4 reporting. | GSC/GA4 disabled. |
| `GOOGLE_PRIVATE_KEY` | PEM private key for Google Cloud service account. | GSC/GA4 disabled. |

---

## 3. Vercel Configuration Requirements

- [ ] **`vercel.json` Inspection:**
  ```json
  {
    "framework": "nextjs",
    "buildCommand": "npm run build",
    "installCommand": "npm ci"
  }
  ```
  Verified: Correctly specifies standard Next.js framework, strict `npm ci` clean install, and production build command.
- [ ] **Preview Protection:** Enable **Vercel Deployment Protection** (Vercel Authentication or Password Protection) on the staging project to prevent public discovery.
- [ ] **Search Engine Disallow:** Verified that `src/app/robots.ts` returns `Disallow: /` for all user agents, and `next.config.ts` injects `X-Robots-Tag: noindex, nofollow` on all responses.

---

## 4. Serverless Storage Limitations & Architecture

> [!WARNING] Critical Storage Architecture Reality
> Vercel executes Next.js API routes on AWS Lambda serverless containers with an **ephemeral and read-only root filesystem** (`/var/task`). Only `/tmp` is writable (512MB limit), and `/tmp` is wiped whenever the container recycles.

### Data Persistence Matrix in Staging:

| Data Type | Staging Behavior on Vercel Serverless | Risk / Limitation | Recommendation |
|---|---|---|---|
| **Bundled Reports** (`firstread-*-latest.json`) | **Persistent** (packaged with build artifact) | Read-only; cannot be updated in-place on Vercel without a new git deployment. | Ideal for reviewing existing audit data. |
| **New Audits Created via UI** | **Ephemeral** (written to runtime filesystem) | If written to `/tmp`, reports disappear when serverless container spins down. | Use CLI script `npm run automation audit` to generate persistent snapshots committed to git. |
| **Recommendation Approvals** | **Ephemeral** (written to `firstread-approvals.json`) | Approval status stored in `/tmp` resets upon container recycling. | For staging verification, approvals demonstrate internal UI state changes. For production, integrate persistent storage (Vercel KV/Blob). |

---

## 5. Authentication & Access Protection

- [ ] **Server-Side Redirection:** All requests to `/admin` or `/admin/*` without a valid cookie are redirected server-side to `/admin/login` via `requireAdmin()` in `src/app/admin/(workspace)/layout.tsx`.
- [ ] **Cookie Security:** In production mode (`NODE_ENV=production`), session cookies use the `__Host-` prefix (`__Host-spot-session`), `httpOnly: true`, `secure: true`, `sameSite: 'strict'`, and `path: '/'`.
- [ ] **CSRF Protection:** State-changing requests (`POST /api/admin/*`) require `x-csrf-token` header matching the authenticated user's session token, validated alongside `sameOrigin(request)`.
- [ ] **Brute-Force Rate Limiting:** The login handler (`/api/auth`) enforces a 5-attempt limit per 15-minute window.
- [ ] **No Static Asset Exposure:** Reports in `content/reports/` are outside the `public/` directory and cannot be fetched directly via HTTP GET without session authorization.

---

## 6. Staging & Production Isolation

- [ ] **Separate Environments:** Staging environment variables must be managed in a distinct Vercel project or scoped strictly to `Preview` environments.
- [ ] **No Remote Mutation:** The FirstRead client (`src/lib/firstread/client.ts`) exclusively issues read-only `GET` requests to `https://firstread.co.uk/`. Under no circumstances can staging alter live WordPress content, settings, or plugins.
- [ ] **Isolated Approval State:** Approvals only write to the internal `firstread-approvals.json` file. No webhook or API call is sent to WordPress.
- [ ] **Scheduled Jobs Isolated:** GitHub Actions cron schedules (`.github/workflows/seo.yml`) run independently on GitHub runners and push snapshots to dedicated branches (`monitoring/firstread-audit-*`), never modifying the staging runtime directly.

---

## 7. Staging Manual Smoke-Test Plan

Execute the following sequential test procedure once staging is live:

### Test Suite A: Dashboard & Navigation
1. Navigate to `https://<staging-app>.vercel.app/`.
2. Confirm automatic redirect to `https://<staging-app>.vercel.app/admin`.
3. Confirm unauthenticated redirect to `https://<staging-app>.vercel.app/admin/login`.
4. Attempt login with invalid credentials; verify error message: *"Invalid credentials."*.
5. Log in with staging `ADMIN_USERNAME` and password.
6. Verify successful redirect to the Overview dashboard (`/admin`).
7. Verify dashboard loads with responsive layout across desktop and mobile viewport widths.
8. Click "Log out" in the navigation bar; verify session termination and redirect to `/admin/login`.

### Test Suite B: WordPress Integration (Read-Only)
1. Log back in to `/admin`.
2. Navigate to **FirstRead SEO** panel.
3. Verify connection indicator shows green ("Connected: https://firstread.co.uk").
4. Inspect the **Live Articles** table:
   - Confirm pagination controls (Page 1, 2, 3, 4) function smoothly.
   - Verify 343 articles are retrievable across pages.
   - Verify category badges display correctly.
5. Click an article slug to verify preview drawer opens without errors.
6. Verify live robots.txt and sitemap index status cards display active data.

### Test Suite C: SEO Auditing
1. Navigate to the **Audits** tab.
2. Verify latest audit report loads:
   - Total Articles Checked: **343**
   - Critical Issues: **7**
   - Warnings: **152**
   - Missing Alt Images: **116** (Empty Decorative: 0, Descriptive: 227)
   - Protocol Issues: **2** (HTTP site_url + HTTP sitemaps)
   - Body H1 Findings: **15**
3. Inspect issue breakdown tables; verify filtering by severity (Critical, Warning, Info) works.
4. Verify click-through on article links leads to the appropriate audit drawer.

### Test Suite D: AI Recommendations
1. Navigate to the **Recommendations** tab.
2. Confirm exactly **13 recommendations** are presented:
   - 2 Technical Protocol items.
   - 10 Metadata Title items (all 40–60 characters with `- Firstread`).
   - 1 Internal Linking item (Canterbury Rentals → First-Time Buyers).
3. Verify all items show status: `requiresApproval: true` and `approved: false`.
4. Click **Approve** on Recommendation `rec-meta-title-simpler-or-more-simple`.
5. Verify button updates immediately to "Approved".
6. Open browser DevTools Network tab; verify the request was sent to internal endpoint `POST /api/admin/firstread/approve`.
7. **Crucial Security Check:** Confirm **zero outbound network requests** were made to `firstread.co.uk`.

### Test Suite E: Security & Allowlist Enforcement
1. In a private/incognito window without cookies, attempt direct `GET /api/admin/firstread/audit`.
   - Expected Result: HTTP 401 Unauthorized (`{"error":"Unauthorised"}`).
2. In browser console or curl, attempt `POST /api/admin/firstread/audit` without CSRF token:
   - Expected Result: HTTP 403 Forbidden (`{"error":"Unauthorised request."}`).
3. Verify via server logs that no requests to `/wp-admin`, `/wp-login`, or `/wp-json/wp/v2/users` were generated.

---

## 8. Rollback and Recovery Plan

If unexpected behavior or regression occurs on staging:

1. **Vercel Instant Rollback:**
   - In Vercel Dashboard > Deployments, locate the previous stable staging deployment.
   - Click the three dots `...` and select **Promote to Staging / Assign Domain**.
   - Traffic instantly routes to the previous build within 5 seconds.
2. **Environment Variable Reset:**
   - If rollback was triggered by a configuration mistake, revert the modified environment variables in Vercel Project Settings and trigger a redeploy.
3. **Application Storage Recovery:**
   - Because the repository contains versioned snapshots in `content/reports/`, redeploying restores the known-good audit state.
4. **Live FirstRead Website Verification:**
   - Because all requests to `https://firstread.co.uk/` are strictly read-only GET requests, staging deployments **cannot** modify the live WordPress site.
   - Run verification curl to confirm live site integrity:
     ```bash
     curl -I https://firstread.co.uk/
     ```
     Confirm HTTP 200 OK.
