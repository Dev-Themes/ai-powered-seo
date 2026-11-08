# Deployment and rollback

## Approval boundary

This source is not a replacement approval. The existing production website, DNS and hosting remain unchanged. Local validation does not authorise publication of editorial drafts or activation of migration redirects.

## Vercel

Import the private GitHub repository and use Node.js 24, `npm ci`, `npm run build`, and the standard Next.js output. Configure environment variables separately for preview and production. Preview CMS writes to cms-content; production reads protected main. Restrict preview access at the hosting layer and keep ALLOW_INDEXING=false. APP_URL must exactly match the origin used for admin requests. Canonicals and structured-data identifiers are always https://spotmagazine.co.uk, irrespective of APP_URL.

The checked-in vercel.json has no proprietary persistence or cron service. GitHub remains the content store and Actions remains the scheduler. New images enter public/images in Git and become available after the approved build.

## Other Node hosts

Use a host that supports Next.js 16 App Router, Node.js 24, server-side route handlers, image optimisation and standard next start. Build once with npm ci and npm run build, set the same server environment variables, then run npm run start behind HTTPS. Pass PORT or use next start --port as appropriate. Preserve the canonical domain, Origin setting and secure cookie behaviour.

Do not serve this project as a static export: admin authentication, GitHub mutations and API integrations require a Node server. No Docker is required. Ephemeral runtime files are unnecessary for persistent application data. Next.js's disposable framework cache is not the content store.

## Release gates

1. Review the test-results document and run CI on the exact release commit.
2. Review all content selected for publication, operator/contact/policy details, images and source references.
3. Complete the existing-site export and URL inventory. Import valuable articles or explicitly approve relevant URL decisions. Validate all proposed 301 targets and avoid chains.
4. Verify Google and Gemini with real credentials on a protected preview. Record actual Lighthouse results and review search/indexing controls.
5. Back up the original database/media/site configuration and record the old hosting target. Verify restoration access.
6. Obtain explicit production, content and migration approval. Deploy the approved commit, verify its URLs and only then make the separately approved domain change.
7. Enable ALLOW_INDEXING=true only for the approved production edition. Confirm sitemap/canonicals and submit the sitemap in Search Console as an owner action.

## Rollback

Keep the old hosting target and complete original-site backup intact. Record the pre-launch domain/hosting configuration and DNS TTL before any approved changes. For a code regression, redeploy the previous verified commit. For content regressions, revert the approved content commit through a reviewed pull request; the admin revision tool intentionally restores as an unpublished draft. For a failed migration, restore the previous hosting target/configuration and original application from backup. Recheck important old URLs and search directives after rollback.

Do not delete the prior host or backups until the owner has reviewed post-launch performance and agreed the retention period. Git revision history is useful but does not replace an old WordPress database/media backup.
