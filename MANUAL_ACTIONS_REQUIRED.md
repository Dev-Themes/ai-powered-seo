# Spot Magazine — Manual Actions Required

**Date:** 8 November 2026  
**Project:** Spot Magazine (`https://spotmagazine.co.uk`)  

This document lists exclusively the manual administrative and configuration actions that you must personally perform to activate live external services, API credentials, and production deployments.

---

## 1. Google Cloud Platform Setup

### Step 1.1: Create a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Project Name: `spot-magazine-seo` (or your preferred name).
4. Click **Create**.

### Step 1.2: Enable Required APIs
In your project, navigate to **APIs & Services -> Library** and enable each of these APIs:
1. **Google Search Console API** (`searchconsole.googleapis.com` or Google Search Console API).
2. **Google Analytics Data API** (`analyticsdata.googleapis.com`).

---

## 2. Google Service Account & Credentials

### Step 2.1: Create Service Account
1. In Google Cloud Console, navigate to **IAM & Admin -> Service Accounts**.
2. Click **Create Service Account**.
3. Name: `spot-seo-collector`.
4. ID: `spot-seo-collector@spot-magazine-seo.iam.gserviceaccount.com`.
5. Description: `Read-only Search Console and GA4 metrics collector for Spot Magazine`.
6. Click **Create and Continue**.
7. Role: No project-level role is required (permissions are granted directly inside Search Console and GA4).
8. Click **Done**.

### Step 2.2: Generate and Download Private Key
1. Click on the newly created Service Account (`spot-seo-collector`).
2. Go to the **Keys** tab.
3. Click **Add Key -> Create new key**.
4. Key type: **JSON**.
5. Click **Create**. A `.json` file will download to your computer.
6. Open the JSON file in a text editor:
   - Extract `client_email` -> This is your `GOOGLE_CLIENT_EMAIL`.
   - Extract `private_key` -> This is your `GOOGLE_PRIVATE_KEY` (begins with `-----BEGIN PRIVATE KEY-----`).

---

## 3. Search Console Verification & Permissions

### Step 3.1: Add Service Account to Google Search Console
1. Open [Google Search Console](https://search.google.com/search-console).
2. Select property: `sc-domain:spotmagazine.co.uk` (or the URL prefix property).
3. In the left navigation, click **Settings** (gear icon).
4. Click **Users and permissions**.
5. Click **Add user** (top right).
6. Email address: Paste the `client_email` from your Service Account (e.g., `spot-seo-collector@spot-magazine-seo.iam.gserviceaccount.com`).
7. Permission: **Restricted** (or **Full**; Restricted is sufficient for read-only query access).
8. Click **Add**.

**Relevant Config Variable:** `GSC_PROPERTY=sc-domain:spotmagazine.co.uk`

---

## 4. Google Analytics 4 Setup & Permissions

### Step 4.1: Retrieve GA4 Property ID
1. Open [Google Analytics](https://analytics.google.com/).
2. Select your Spot Magazine account and GA4 property.
3. Click **Admin** (gear icon in lower left).
4. Under **Property settings**, click **Property details**.
5. Note the numeric **Property ID** (e.g. `123456789`).

**Relevant Config Variable:** `GA4_PROPERTY_ID=<your-numeric-property-id>`

### Step 4.2: Add Service Account to GA4
1. In GA4 **Admin**, under **Property settings**, click **Property access management**.
2. Click the blue **+** button in the top right -> **Add users**.
3. Email address: Paste the `client_email` from your Service Account.
4. Role: **Viewer**.
5. Click **Add**.

---

## 5. Google Gemini API Setup

### Step 5.1: Create Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** (or **Create API key**).
4. Select your Google Cloud project or create a key in a new project.
5. Copy the generated API key.

**Relevant Config Variables:**
- `GEMINI_API_KEY=<your-copied-gemini-key>`
- `GEMINI_MODEL=gemini-2.5-flash` (or `gemini-1.5-pro`)

---

## 6. GitHub Repository Setup

### Step 6.1: Create Personal Access Token (PAT) for CMS
1. On GitHub, navigate to **Settings -> Developer Settings -> Personal access tokens -> Tokens (classic)** or **Fine-grained tokens**.
2. Generate a token with:
   - Scope: `repo` (Contents: Read & write, Pull requests: Read & write).
3. Copy the token.

**Relevant Config Variable:** `GITHUB_TOKEN`

### Step 6.2: Add GitHub Repository Secrets
In your Spot Magazine GitHub repository, go to **Settings -> Secrets and variables -> Actions -> New repository secret**:

| Secret Name | Source / Value |
| :--- | :--- |
| `GOOGLE_CLIENT_EMAIL` | Service Account `client_email` |
| `GOOGLE_PRIVATE_KEY` | Service Account `private_key` (including `-----BEGIN PRIVATE KEY-----`) |
| `GEMINI_API_KEY` | Google AI Studio API key |

### Step 6.3: Add GitHub Repository Variables
In the same settings page, switch to the **Variables** tab -> **New repository variable**:

| Variable Name | Recommended Value |
| :--- | :--- |
| `GSC_PROPERTY` | `sc-domain:spotmagazine.co.uk` |
| `GA4_PROPERTY_ID` | Your numeric GA4 Property ID |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `APPROVED_SCHEDULES` | `false` (set to `true` only when ready to automate scheduled publications) |

---

## 7. Generate Admin Password & Session Secret

Run these commands in your terminal:

```powershell
# In the project directory:
npm run admin:hash
```
Type your secret password (minimum 16 characters).
Save the output (e.g., `scrypt:a9f8b...:d82c...`) as `ADMIN_PASSWORD_HASH`.

```powershell
# Generate 48-byte cryptographic session secret:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Save the output as `SESSION_SECRET`.

---

## 8. Vercel Deployment Setup

In the Vercel Dashboard, go to your project **Settings -> Environment Variables** and add:

```env
APP_URL=https://spotmagazine.co.uk
ADMIN_USERNAME=<your-chosen-admin-username>
ADMIN_PASSWORD_HASH=<scrypt-hash-from-step-7>
SESSION_SECRET=<session-secret-from-step-7>
GITHUB_REPOSITORY=<your-github-org-or-user>/<repo-name>
GITHUB_BRANCH=cms-content
GITHUB_TOKEN=<github-pat-from-step-6.1>
GOOGLE_CLIENT_EMAIL=<service-account-email>
GOOGLE_PRIVATE_KEY=<service-account-private-key>
GSC_PROPERTY=sc-domain:spotmagazine.co.uk
GA4_PROPERTY_ID=<numeric-ga4-id>
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
APPROVED_SCHEDULES=false
ALLOW_INDEXING=true
```

> [!IMPORTANT]
> Keep `ALLOW_INDEXING=false` on preview deployments and local development. Set `ALLOW_INDEXING=true` strictly on the production domain environment to allow search engines to crawl `https://spotmagazine.co.uk`.

---

## 9. Editorial Review of Draft Articles

Before making the website public:
1. Log in to the admin panel at `/admin`.
2. Go to **Approvals** (`/admin/approvals`).
3. For each of the 12 draft articles:
   - Review the text, factual sources, and headings.
   - Enter a **Review Note**.
   - Check **Reviewed**.
   - Set a **Publication Date** or check **Explicit Publication Approval**.
   - In `/admin/settings`, ensure **Enable reviewed publishing** is toggled on.
