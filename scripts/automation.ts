import { runFirstReadAudit } from '../src/lib/firstread/audit';
import { generateFirstReadRecommendations } from '../src/lib/firstread/ai';
import {
  saveAuditReport,
  saveRecommendationsReport,
  getLatestAuditReport
} from '../src/lib/firstread/storage';

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
  console.log(`[FirstRead Automation] Starting scheduled monitoring (mode: ${mode})...`);

  if (['audit', 'daily', 'weekly', 'firstread', 'firstread:audit'].includes(mode)) {
    // 1. Fetch published WordPress content and run SEO audit
    console.log('[FirstRead Automation] Running read-only SEO audit for https://firstread.co.uk...');
    const audit = await retry(() => runFirstReadAudit(50));
    const savedAudit = await saveAuditReport(audit);
    console.log(`[FirstRead Automation] Audit completed and saved: ${savedAudit.id}`);
    console.log(`  • Posts checked: ${audit.summary.totalChecked}`);
    console.log(`  • Critical issues: ${audit.summary.criticalCount}`);
    console.log(`  • Warnings: ${audit.summary.warningCount}`);
    console.log(`  • Missing alt images: ${audit.summary.missingAltImagesTotal}`);

    // 2. Generate AI recommendations
    try {
      console.log('[FirstRead Automation] Generating AI recommendations...');
      const recs = await retry(() => generateFirstReadRecommendations(audit));
      const savedRecs = await saveRecommendationsReport(recs);
      console.log(`[FirstRead Automation] AI recommendations saved: ${savedRecs.id} (${recs.recommendations.length} items)`);
    } catch (err) {
      console.warn('[FirstRead Automation] AI recommendation step skipped or failed:', err);
    }
  } else if (mode === 'recommend') {
    const latestAudit = await getLatestAuditReport();
    const audit = latestAudit || (await retry(() => runFirstReadAudit(30)));
    const recs = await retry(() => generateFirstReadRecommendations(audit));
    const savedRecs = await saveRecommendationsReport(recs);
    console.log(`[FirstRead Automation] Recommendations saved: ${savedRecs.id}`);
  } else {
    console.error(`[FirstRead Automation] Unknown mode: "${mode}". Valid modes: audit, recommend, daily, weekly.`);
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('[FirstRead Automation] Fatal error:', err);
  process.exitCode = 1;
});
