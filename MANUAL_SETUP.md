# Manual setup

No secrets, account changes, DNS updates or deployment have been performed by the implementation.

## 1. Private repository and branches

1. Create a **private** GitHub repository and push this source, including `package-lock.json`. Exclude `.env.local`, `.npm-cache`, `.local`, `.next` and `test-results`.
2. Keep `main` as the protected deployment branch. Require pull-request review and the validation workflow; prevent force pushes and branch deletion. Enable appropriate branch rules in your GitHub plan.
3. Create `cms-content` from main. Use this branch for the preview CMS until launch approval. Changes to content on main need a reviewed pull request. The application never auto-merges one.
4. Create an expiring fine-grained token limited to this repository with Contents read/write. Do not grant administrator or branch-protection bypass permissions. Store it as `GITHUB_TOKEN` in preview hosting settings. Never expose it as a `NEXT_PUBLIC_` variable.
5. Set `GITHUB_REPOSITORY=owner/repository` and `GITHUB_BRANCH=cms-content` for preview. For production, use `GITHUB_BRANCH=main` with read permissions unless you intentionally design a separately reviewed publication branch workflow. A protected read-only production configuration will reject CMS writes, as intended.

## 2. Authentication

1. Copy `.env.example` to `.env.local` for development. In a terminal run `npm run admin:hash` and enter a unique password of at least 16 characters. The prompt hides input. Put the emitted scrypt hash in `ADMIN_PASSWORD_HASH`.
2. Generate a session secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Store it only in `SESSION_SECRET`.
3. Set `ADMIN_USERNAME` to your chosen administrator name. Set `APP_URL` to the exact origin in use, such as `http://localhost:3000` locally or your HTTPS preview hostname. Login and mutation origin checks use this value.
4. Configure all values in the hosting environment and restart/redeploy. Production sessions use Secure, HTTP-only, SameSite=Strict `__Host-` cookies. Use HTTPS outside local development.
5. Open `/admin/login`, sign in and open the private preview. The global login limiter permits five attempts per 15-minute window, stored in GitHub with SHA conflicts enforcing concurrency. It intentionally fails closed if storage is unavailable. Wait for the window after a lockout; do not weaken the limiter.
6. Rotate the session secret or password hash to invalidate existing sessions. Sessions otherwise expire after eight hours. GitHub login-counter commits can trigger builds unless your build policy ignores security-only changes; configure that in your host if needed.

## 3. Google reporting

1. Create or select a Google Cloud project. Enable **Google Search Console API** and **Google Analytics Data API**.
2. Create a service account dedicated to read-only reporting and generate its credential according to your organisation's key policy. Store the email as `GOOGLE_CLIENT_EMAIL` and the PEM key as `GOOGLE_PRIVATE_KEY`. Hosting settings may contain real newlines or literal `\n` escapes. Never commit the JSON key file.
3. Add that service-account email to the verified Search Console property with permission to read performance data. Confirm the property identifier; the default is `sc-domain:spotmagazine.co.uk`. Set `GSC_PROPERTY` to exactly the accessible identifier.
4. Grant the service-account email Viewer access to the GA4 property. Set the numeric property ID as `GA4_PROPERTY_ID`, not a G- measurement ID.
5. In admin, select **Collect real Google data**. Check each source status and the report period. A configured key alone is not proof of successful connection.
6. GA4 Data API reads existing property data. This code does not add a visitor measurement tag or analytics cookies. If tracking is required, separately configure and review GA4 collection and UK consent/privacy requirements before enabling it.

## 4. Gemini

1. Obtain a Google Gemini API key for the intended project and check quotas/billing settings. Store it as `GEMINI_API_KEY` only on the server and in Actions secrets.
2. Set `GEMINI_MODEL` to a currently available model that supports structured JSON output in that project. Choose it from Google's model documentation and your account rather than assuming model names remain available.
3. Run **Generate reviewed suggestions** in the admin. Output is validated with Zod and saved as an approval-required report. It never publishes or edits articles.

## 5. Editorial approval

1. Review all 12 Markdown files under `content/articles` or use `/admin/preview` after authentication. They contain original practical editorial drafts and reference links, not verified first-hand reporting.
2. Recheck each linked source, wording, internal link, image description and asset rights. Record the reviewer, date and checks in the article review note. The draft timestamps are creation timestamps, not claimed publication dates.
3. Add an actual monitored contact email in website settings. Review and complete the privacy/terms operator details before public launch. Those pages explicitly identify their pre-launch status.
4. Enable reviewed publishing in settings only after the editorial process is agreed. Save an article as draft first, then choose published/scheduled, confirm review and explicitly approve the release. A published article receives its actual publication timestamp. Schedules are stored in UTC; the editor shows local time.
5. Review content changes in a GitHub pull request from cms-content to main. Published URL changes need a relevant redirect plan. Do not redirect unrelated old articles to the homepage or a generic guide.

## 6. GitHub Actions

1. Enable Actions and allow workflow pull-request creation under repository Settings → Actions → General. Grant the workflow its declared limited Contents/Pull requests permissions.
2. Add repository secrets `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GEMINI_API_KEY`. Add variables `GSC_PROPERTY`, `GA4_PROPERTY_ID`, `GEMINI_MODEL`. Add `APPROVED_SCHEDULES=true` only after you approve scheduled release behaviour.
3. Enable Actions notifications for failures in your GitHub notification settings. The workflow fails and emits an error annotation for partial integration collection or Gemini failures; no external email service is configured.
4. Run Validate magazine manually. Then manually run daily, weekly and monthly SEO modes and inspect the generated reports/PRs. Do not interpret an unavailable-source report as zero traffic.
5. Merge report PRs after review so the dashboard's configured content branch can read them. Monitoring itself is automatic; dashboard freshness depends on merging those report files or manually collecting through the preview admin. This workflow deliberately never auto-merges to production.
6. Hourly schedules produce publication proposals for already approved content. Merge and deploy them after required checks; they do not guarantee an exact release minute. GitHub cron schedules run in UTC and may be delayed.

## 7. Vercel preview and launch

1. Import the private repository in Vercel, select Next.js and Node.js 24, and keep the build command `npm run build`. `vercel.json` contains only standard build configuration.
2. Set preview environment variables with the exact preview APP_URL. Use a stable protected preview hostname for the admin; random deployment URLs need matching origins. Enable host-level preview access protection where available, and prevent previews from being indexed.
3. Confirm `npm ci`, build, lint, unit tests and browser tests. Run Lighthouse against representative preview pages and record the actual report. Do not infer field Core Web Vitals from a local browser result.
4. Complete the migration requirements in `docs/MIGRATION.md`, including a complete old-site export, organic-performance assessment, redirect review and rollback rehearsal.
5. Obtain explicit approval for replacement, content release, redirects and production DNS. Only then attach the production domain and deploy the approved main commit. Preserve the existing site's backup and rollback target.

## Dependency warning review

The first user installation reported eight moderate vulnerabilities. A subsequent offline audit cannot confirm or dismiss registry advisories. Run `npm audit` with network access and inspect the dependency paths; use a reviewed non-breaking update where possible. Do not apply `npm audit fix --force` indiscriminately. The esbuild binary was executed successfully during verification. protobufjs's skipped postinstall still needs review in your dependency install policy; real Google API calls require credentialed verification.

## Production indexing switch

Keep `ALLOW_INDEXING=false` for all local and preview environments. Set `ALLOW_INDEXING=true` only on the explicitly approved production deployment. Canonicals always remain on the production domain. Admin/search pages remain noindex even when this switch is enabled.

## Revised local review workflow

For the content-filled testing edition, start with [docs/LOCAL_REVIEW.md](docs/LOCAL_REVIEW.md). `npm run dev` now launches isolated local review mode with the documented testing account. It does not require a GitHub token. The production and connected-development instructions above still apply when using `npm run dev:connected`, `npm run build` and `npm run start`.

The new local mode is explicitly disabled in production and when APP_URL is not a loopback origin. No testing password is injected by a production build. Keep production secrets independent of these testing credentials.

## Current local entry points

The launcher reuses a healthy review server and selects a free loopback port when 3000 is occupied. The current review origin is http://localhost:3001. An older unconfigured local dev instance forwards to it through a development-only proxy; production and configured environments do not use this handoff. No database connection is required for the existing single-admin design. See docs/REVIEW_V3.md for the verified login and POST fallback.
