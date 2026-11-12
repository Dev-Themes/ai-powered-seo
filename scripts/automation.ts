import { runFirstReadAudit } from '../src/lib/seo/audit';
import { generateFirstReadRecommendations } from '../src/lib/content/ai';
import {
  saveAuditReport,
  saveRecommendationsReport,
  getLatestAuditReport
} from '../src/lib/shared/storage';
import { runAutonomousBrandGrowthCycle } from '../src/lib/brand/engine';

const mode = process.argv[2] || 'audit';

async function retry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

async function run() {
  console.log(`[FirstRead Autonomous SEO] Starting scheduled execution (mode: ${mode})...`);

  if (['audit', 'daily', 'weekly', 'firstread', 'firstread:audit'].includes(mode)) {
    console.log('[FirstRead Autonomous SEO] Running read-only SEO audit for https://firstread.co.uk...');
    const audit = await retry(() => runFirstReadAudit(500));
    const savedAudit = await saveAuditReport(audit);
    console.log(`[FirstRead Autonomous SEO] Audit completed and saved: ${savedAudit.id}`);
    console.log(`  • Posts checked: ${audit.summary.totalChecked}`);
    console.log(`  • Critical issues: ${audit.summary.criticalCount}`);
    console.log(`  • Warnings: ${audit.summary.warningCount}`);
    console.log(`  • Missing alt images: ${audit.summary.missingAltImagesTotal}`);

    try {
      console.log('[FirstRead Autonomous SEO] Generating AI recommendations & opportunities...');
      const recs = await retry(() => generateFirstReadRecommendations(audit));
      const savedRecs = await saveRecommendationsReport(recs);
      console.log(`[FirstRead Autonomous SEO] Recommendations saved: ${savedRecs.id} (${recs.recommendations.length} items)`);
    } catch (err) {
      console.warn('[FirstRead Autonomous SEO] Recommendation step skipped or failed:', err);
    }
  } else if (mode === 'recommend') {
    const latestAudit = await getLatestAuditReport();
    const audit = latestAudit || (await retry(() => runFirstReadAudit(500)));
    const recs = await retry(() => generateFirstReadRecommendations(audit));
    const savedRecs = await saveRecommendationsReport(recs);
    console.log(`[FirstRead Autonomous SEO] Recommendations saved: ${savedRecs.id}`);
  } else if (['brand', 'brand:growth', 'brand-growth'].includes(mode)) {
    console.log('[FirstRead Autonomous SEO] Running Brand Keyword Growth and Indexing cycle...');
    const result = await retry(() => runAutonomousBrandGrowthCycle());
    console.log(`[FirstRead Autonomous SEO] Brand cycle completed: status=${result.execution.status}`);
    console.log(`  • Summary: ${result.execution.summary}`);
    console.log(`  • Actions executed: ${result.execution.actionsExecuted.length}`);
    console.log(`  • Brand clicks: ${result.execution.brandClicks} (${result.execution.brandImpressions} impressions)`);
    console.log(`  • Homepage indexed: ${result.execution.homepageIndexed}`);
  } else {
    console.error(`[FirstRead Autonomous SEO] Unknown mode: "${mode}". Valid modes: audit, recommend, brand, daily, weekly.`);
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('[FirstRead Autonomous SEO] Fatal error:', err);
  process.exitCode = 1;
});
