# Spot Magazine — SEO Execution & Operational Guide

**Date:** 8 November 2026  
**Auditor:** Senior Full-Stack Engineer & AI Automation Architect  
**Project:** Spot Magazine (`https://spotmagazine.co.uk`)  
**Root Path:** `D:\Muhammad Shariq\Internship\Israin Solutions - Ongoing\ai-powered-seo`  

---

## 1. Local Setup & Execution

### Prerequisites
- **Node.js:** Node.js v20+ or v24 LTS.
- **Package Manager:** npm (bundled with Node).
- **Git:** Git 2.30+.
- **Chrome / Chromium:** Required for Playwright end-to-end tests.

### Step 1: Install Dependencies
```powershell
cd "D:\Muhammad Shariq\Internship\Israin Solutions - Ongoing\ai-powered-seo"
npm ci
```

### Step 2: Configure Local Environment
Create `.env.local` based on `.env.example`:
```powershell
Copy-Item .env.example .env.local
```

Configure your local secrets:
```env
APP_URL=http://localhost:3000
ADMIN_USERNAME=spotadmin
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
GITHUB_REPOSITORY=your-org/spot-magazine
GITHUB_BRANCH=cms-content
GITHUB_TOKEN=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GSC_PROPERTY=sc-domain:spotmagazine.co.uk
GA4_PROPERTY_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
APPROVED_SCHEDULES=false
ALLOW_INDEXING=false
```

### Step 3: Generate Local Passwords & Secrets
1. **Hash your admin password:**
   ```powershell
   npm run admin:hash
   ```
   Type a secure password (minimum 16 characters). Copy the resulting string (`scrypt:salt:hash`) into `ADMIN_PASSWORD_HASH`.

2. **Generate Session Secret:**
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
   Paste the generated string into `SESSION_SECRET`.

### Step 4: Run Development & Review Servers

#### Option A: Isolated Local Review Edition (No Secrets Required)
```powershell
npm run dev
# or
npm run review
```
- Starts at `http://localhost:3000`.
- All 12 unpublished drafts are visible at `/articles`.
- Local CMS is available at `/admin`.
- Default credentials generated automatically:
  - **Username:** `spotadmin`
  - **Password:** `SpotReview!2026Local`
- Storage lives in `.local/review-store/`. Nothing modifies production or commits to GitHub.

#### Option B: Connected Development (With Live GitHub)
```powershell
npm run dev:connected
```
- Reads configurations and credentials from `.env.local`.

---

## 2. Running Quality & Verification Checks

Execute the verified automated testing suite:

```powershell
# 1. Typecheck the entire TypeScript codebase
npm run typecheck

# 2. Run ESLint static analysis
npm run lint

# 3. Run Unit and Integration tests (13 tests)
npm test

# 4. Run Playwright E2E browser tests across 7 viewports (25 tests)
$env:PLAYWRIGHT_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e

# 5. Compile full production Next.js build
npm run build

# 6. Test the production server
npm start
```

---

## 3. Running AI-Based SEO Monitoring

### Step 1: Connecting Google Search Console & GA4
1. Put your Google Service Account email in `GOOGLE_CLIENT_EMAIL`.
2. Put the private key PEM string in `GOOGLE_PRIVATE_KEY` (with newlines formatted or literal `\n`).
3. Set `GSC_PROPERTY=sc-domain:spotmagazine.co.uk`.
4. Set `GA4_PROPERTY_ID=<your-property-numeric-id>`.

### Step 2: Configuring Gemini AI
1. Obtain an API key from Google AI Studio.
2. Set `GEMINI_API_KEY=<your-gemini-key>`.
3. Set `GEMINI_MODEL=gemini-2.5-flash` (or `gemini-1.5-pro`).

### Step 3: Triggering SEO Monitoring Runs Locally
Using your local `.env.local`:

```powershell
# Collect real Google Search Console & GA4 data
node --env-file=.env.local scripts/run-tool.mjs automation daily

# Run content audit and generate Gemini recommendations
node --env-file=.env.local scripts/run-tool.mjs automation weekly

# Run monthly 28-day period comparative analysis
node --env-file=.env.local scripts/run-tool.mjs automation monthly

# Run scheduled article release CLI
node --env-file=.env.local scripts/run-tool.mjs automation publish
```

### Step 4: Viewing Results in the Admin Dashboard
1. Open `http://localhost:3000/admin`.
2. Log in with your admin credentials.
3. Navigate to:
   - **Overview (`/admin`):** Review Total Clicks, Impressions, Average CTR, Average Search Position, Daily Click Trend chart, and GA4 Organic Sessions.
   - **Keywords (`/admin/keywords`):** Track performance for branded queries: `Spot Magazine` and `spotmagazine.co.uk`. Inspect Homepage clicks, Query/Page breakdowns, and Country/Device distributions.
   - **Audits (`/admin/audits`):** Inspect title length, description quality, citation links, and pending editorial reviews.
   - **Recommendations (`/admin/recommendations`):** View Gemini suggestions with priority, affected article slug, recommended action, supporting evidence, limitations, and approval requirement.
   - **Reports (`/admin/reports`):** Download or inspect raw JSON outputs from every automated run.

---

## 4. Reviewing & Approving SEO Recommendations

1. In `/admin/recommendations`, select an AI suggestion.
2. Examine the **Evidence** and **Limitations**.
3. Navigate to `/admin/articles/[slug]` for the relevant article.
4. Apply the recommended modifications in the Markdown editor:
   - Update SEO title or description.
   - Insert relevant internal links (`/articles/[slug]`).
   - Add factual citations.
5. In the editorial control panel:
   - Check **Reviewed**.
   - Enter a **Review Note** explaining what changes were made.
   - If publishing, check **Explicit Publication Approval**.
6. Click **Save draft** or **Publish story**.
7. In a GitHub-connected environment, this pushes a commit to your branch with full SHA concurrency validation.

---

## 5. Running Legacy Technical SEO Audits

To crawl and audit the live website at `https://spotmagazine.co.uk`:

```powershell
# Crawl up to 150 pages of the live site
npm run audit:site

# Or customize crawl limits:
$env:CRAWL_LIMIT="50"
npm run audit:site
```

The crawler will fetch the site, map internal links, canonical tags, titles, robots directives, and write a full audit report to:
`docs/migration/crawl.json`

---

## 6. GitHub Actions Automation

The repository contains two workflows in `.github/workflows`:

1. **`ci.yml`**: Validates pull requests and branches.
2. **`seo.yml`**: Automates scheduled monitoring.

### Automation Schedules:
- **Daily at 06:17 UTC (`17 6 * * *`):** Collects Search Console and GA4 data (`daily`).
- **Weekly on Monday at 07:27 UTC (`27 7 * * 1`):** Runs audit and generates Gemini recommendations (`weekly`).
- **Monthly on the 1st at 08:37 UTC (`37 8 1 * *`):** Produces 28-day comparative report (`monthly`).
- **Hourly at :13 UTC (`13 * * * *`):** Evaluates scheduled articles for release (`publish`).

### How to Trigger Manually on GitHub:
1. Go to the **Actions** tab in your repository.
2. Select **SEO monitoring and approved schedules**.
3. Click **Run workflow**.
4. Choose the mode: `daily`, `weekly`, `monthly`, or `publish`.
5. Click **Run workflow**.

When changes or reports are produced, the workflow creates a pull request from branch `automation/seo-review-<run_id>` for team review.

---

## 7. Deploying to Vercel

### Step 1: Connect GitHub Repository
1. In the Vercel Dashboard, click **Add New...** -> **Project**.
2. Select your `spot-magazine` repository.
3. Framework Preset will auto-detect as **Next.js**.

### Step 2: Configure Environment Variables in Vercel
Set the following under **Project Settings -> Environment Variables**:

| Variable | Value | Environment |
| :--- | :--- | :--- |
| `APP_URL` | `https://spotmagazine.co.uk` | Production |
| `ADMIN_USERNAME` | (Your chosen admin username) | Production, Preview |
| `ADMIN_PASSWORD_HASH` | (Output from `npm run admin:hash`) | Production, Preview |
| `SESSION_SECRET` | (48-byte base64url random string) | Production, Preview |
| `GITHUB_REPOSITORY` | `your-org/spot-magazine` | Production, Preview |
| `GITHUB_BRANCH` | `cms-content` (or `main`) | Production, Preview |
| `GITHUB_TOKEN` | (GitHub Personal Access Token with repo scope) | Production, Preview |
| `GOOGLE_CLIENT_EMAIL` | (Google Service Account email) | Production, Preview |
| `GOOGLE_PRIVATE_KEY` | (Service Account PEM private key) | Production, Preview |
| `GSC_PROPERTY` | `sc-domain:spotmagazine.co.uk` | Production, Preview |
| `GA4_PROPERTY_ID` | (Numeric GA4 Property ID) | Production, Preview |
| `GEMINI_API_KEY` | (Google Gemini API Key) | Production, Preview |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Production, Preview |
| `APPROVED_SCHEDULES` | `false` (Vercel runtime only; handled by GitHub Actions) | All |
| `ALLOW_INDEXING` | `true` on Production, `false` on Preview | Production / Preview |

### Step 3: Domain & DNS Configuration
1. In Vercel, go to **Settings -> Domains**.
2. Add `spotmagazine.co.uk` and `www.spotmagazine.co.uk`.
3. Set your DNS records at your registrar:
   - **A Record:** `@` pointing to `76.76.21.21`
   - **CNAME Record:** `www` pointing to `cname.vercel-dns.com`

---

## 8. Troubleshooting Matrix

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Search Console returns `unavailable`** | Missing service account or unverified property. | Add `GOOGLE_CLIENT_EMAIL` as Restricted Viewer in GSC. Verify property domain `sc-domain:spotmagazine.co.uk`. |
| **GA4 returns `unavailable`** | Missing GA4 Property ID or permissions. | Verify `GA4_PROPERTY_ID` is set to the numeric ID. Grant Viewer role in GA4 Admin. |
| **Gemini returns `failed`** | Invalid API key, missing model name, or quota. | Set `GEMINI_MODEL=gemini-2.5-flash` and provide active `GEMINI_API_KEY`. |
| **Admin login fails (401)** | Incorrect username, hash mismatch, or CSRF. | Ensure password matches hash generated by `npm run admin:hash`. Ensure cookies and HTTPS are supported. |
| **GitHub storage fails (409 Conflict)** | Article was edited by another process. | Reload the article in `/admin/articles/[slug]` to fetch the latest SHA before saving. |
| **Scheduled article does not publish** | Either `publishingEnabled` is false or `APPROVED_SCHEDULES` is false. | Enable publishing in `/admin/settings` AND set `APPROVED_SCHEDULES=true` in GitHub Actions variables. |
| **Images 404 in preview** | Image was uploaded via API but build hasn't deployed. | In local review mode, images serve via `/api/admin/media`. In production, images must be committed to `public/images/`. |
