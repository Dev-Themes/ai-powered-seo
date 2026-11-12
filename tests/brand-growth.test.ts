import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TARGET_DOMAIN,
  PRIMARY_BRAND_KEYWORD,
  BRAND_VARIATIONS,
  normalizeQuery,
  isBrandQuery,
  computePeriodComparison,
  evaluateBrandAlerts
} from '../src/lib/brand/tracker';
import {
  executePermittedIndexingActions
} from '../src/lib/brand/indexing';
import {
  loadBrandGrowthState,
  saveBrandGrowthState,
  setAutonomousExecutionPaused,
  emergencyStopAutonomousExecution,
  runAutonomousBrandGrowthCycle,
  getBrandStateDir
} from '../src/lib/brand/engine';
import { verifyCronSecret } from '../src/lib/auth-core';
import { handleBrandCronRequest } from '../src/lib/brand/cron';
import { validateReadOnlyRequest, FirstReadSecurityError } from '../src/lib/firstread/security';
import type { BrandPerformanceSummary, AutonomousExecutionRecord } from '../src/lib/brand/types';

test('Brand Query Filter: correctly isolates FirstRead brand queries and rejects unrelated keywords', () => {
  // Allowed exact & variations
  assert.equal(isBrandQuery('firstread'), true);
  assert.equal(isBrandQuery('FirstRead'), true);
  assert.equal(isBrandQuery('first read'), true);
  assert.equal(isBrandQuery('FIRST READ'), true);
  assert.equal(isBrandQuery('firstread.co.uk'), true);
  assert.equal(isBrandQuery('https://firstread.co.uk'), true);
  assert.equal(isBrandQuery('firstread uk'), true);
  assert.equal(isBrandQuery('firstread news'), true);
  assert.equal(isBrandQuery('first read news'), true);

  // Unrelated keywords must be rejected
  assert.equal(isBrandQuery('google news'), false);
  assert.equal(isBrandQuery('seo tools 2026'), false);
  assert.equal(isBrandQuery('tech news today'), false);
  assert.equal(isBrandQuery('best reading app'), false);
  assert.equal(isBrandQuery('wordpress tutorials'), false);
  assert.equal(isBrandQuery('monkey app leaks'), false);
});

test('Brand Query Normalization: handles spacing, punctuation, and casing', () => {
  assert.equal(normalizeQuery('  FirstRead  '), 'firstread');
  assert.equal(normalizeQuery('First   Read'), 'first read');
  assert.equal(normalizeQuery('FIRSTREAD.CO.UK'), 'firstread.co.uk');
  assert.equal(normalizeQuery('  '), '');
});

test('Period Comparison: computes accurate percentage changes and directional polarities', () => {
  // Clicks: higher is improving
  const clicksComp = computePeriodComparison(120, 100, 'clicks');
  assert.equal(clicksComp.current, 120);
  assert.equal(clicksComp.previous, 100);
  assert.equal(clicksComp.absoluteChange, 20);
  assert.equal(clicksComp.percentageChange, 20);
  assert.equal(clicksComp.trend, 'improving');

  // Impressions: drop is declining
  const impComp = computePeriodComparison(800, 1000, 'impressions');
  assert.equal(impComp.current, 800);
  assert.equal(impComp.previous, 1000);
  assert.equal(impComp.absoluteChange, -200);
  assert.equal(impComp.percentageChange, -20);
  assert.equal(impComp.trend, 'declining');

  // Position: lower is improving (e.g. from 2.5 to 1.1)
  const posComp = computePeriodComparison(1.1, 2.5, 'position');
  assert.equal(posComp.current, 1.1);
  assert.equal(posComp.previous, 2.5);
  assert.equal(posComp.absoluteChange, -1.4);
  assert.equal(posComp.trend, 'improving');

  // Position: higher is declining (e.g. from 1.2 to 4.5)
  const posDeclining = computePeriodComparison(4.5, 1.2, 'position');
  assert.equal(posDeclining.current, 4.5);
  assert.equal(posDeclining.previous, 1.2);
  assert.equal(posDeclining.absoluteChange, 3.3);
  assert.equal(posDeclining.trend, 'declining');
});

test('Brand Alert Rules: detects declining metrics, ranking deterioration, and homepage visibility issues', () => {
  const currentSummary: BrandPerformanceSummary = {
    clicks: 40,
    impressions: 500,
    ctr: 0.08, // Low CTR (< 15%)
    averagePosition: 4.5 // Ranking deterioration (> 3.0)
  };

  const prev28dSummary: BrandPerformanceSummary = {
    clicks: 100, // 60% drop
    impressions: 1000, // 50% drop
    ctr: 0.10,
    averagePosition: 1.2
  };

  const homepagePerf = {
    clicks: 35,
    impressions: 480,
    position: 4.2,
    isRankingNumberOne: false // Homepage not #1
  };

  const alerts = evaluateBrandAlerts(currentSummary, null, prev28dSummary, homepagePerf);

  assert.ok(alerts.length >= 4, `Expected at least 4 alerts, got ${alerts.length}`);
  assert.ok(alerts.some(a => a.type === 'declining_impressions'), 'Should alert on declining impressions');
  assert.ok(alerts.some(a => a.type === 'declining_clicks'), 'Should alert on declining clicks');
  assert.ok(alerts.some(a => a.type === 'ranking_deterioration'), 'Should alert on ranking deterioration');
  assert.ok(alerts.some(a => a.type === 'low_ctr'), 'Should alert on low CTR');
  assert.ok(alerts.some(a => a.type === 'homepage_visibility'), 'Should alert on homepage not ranking first');
});

test('Engine Controls: pause, resume, and emergency stop operate correctly', async () => {
  // State initialization
  const initial = await loadBrandGrowthState();
  assert.ok(initial);
  assert.equal(typeof initial.paused, 'boolean');

  // Pause
  const pausedState = await setAutonomousExecutionPaused(true);
  assert.equal(pausedState.paused, true);
  assert.equal(pausedState.status, 'paused');

  // Running cycle while paused gracefully skips execution without crashing
  const skippedCycle = await runAutonomousBrandGrowthCycle();
  assert.equal(skippedCycle.state.paused, true);
  assert.equal(skippedCycle.execution.summary, 'Cycle skipped: Autonomous engine is paused.');
  assert.ok(skippedCycle.execution.actionsExecuted.some(a => a.status === 'skipped'));

  // Resume
  const resumedState = await setAutonomousExecutionPaused(false);
  assert.equal(resumedState.paused, false);

  // Emergency stop
  const stoppedState = await emergencyStopAutonomousExecution();
  assert.equal(stoppedState.status, 'stopped');
  assert.equal(stoppedState.paused, true);

  // Reset to unpaused for clean state
  await setAutonomousExecutionPaused(false);
});

test('Permitted Action Deduplication: handles sitemap submission actions safely', async () => {
  const result = await executePermittedIndexingActions(
    {
      sitemapIndexUrl: 'https://firstread.co.uk/sitemap_index.xml',
      accessibleOnWeb: true,
      httpStatus: 200,
      detectedChildSitemaps: [],
      gscSubmittedSitemaps: [{ path: 'https://firstread.co.uk/sitemap_index.xml' }],
      isSubmittedToGsc: true,
      needsSubmission: false // Already submitted!
    },
    []
  );

  // Since needsSubmission is false, sitemap submission must be skipped
  assert.ok(result.actions.length > 0);
  assert.ok(result.actions.some(a => a.actionType === 'sitemap_submit' && a.status === 'skipped'));
});

test('Sitemap 403 Permission Denial Suppression: skips repeated submission if prior attempt returned permission_denied', async () => {
  const result = await executePermittedIndexingActions(
    {
      sitemapIndexUrl: 'https://firstread.co.uk/sitemap_index.xml',
      accessibleOnWeb: true,
      httpStatus: 200,
      detectedChildSitemaps: [],
      gscSubmittedSitemaps: [],
      isSubmittedToGsc: false,
      needsSubmission: true,
      lastSubmissionResult: 'permission_denied' // Previous attempt identified 403 Forbidden!
    },
    []
  );

  assert.ok(result.actions.length > 0);
  const sitemapAction = result.actions.find(a => a.actionType === 'sitemap_submit');
  assert.ok(sitemapAction);
  assert.equal(sitemapAction.status, 'skipped');
  assert.ok(sitemapAction.details.includes('Viewer/Restricted permissions'));
});

test('Cron Authentication: verifyCronSecret validates Bearer token with constant-time equality', () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'production-cron-secret-32-chars-long';

    // Valid header
    const validReq = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      headers: { Authorization: 'Bearer production-cron-secret-32-chars-long' }
    });
    assert.equal(verifyCronSecret(validReq), true);

    // Invalid header value
    const invalidReq = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      headers: { Authorization: 'Bearer wrong-secret-value-32-chars-long' }
    });
    assert.equal(verifyCronSecret(invalidReq), false);

    // Missing Bearer prefix
    const noBearerReq = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      headers: { Authorization: 'production-cron-secret-32-chars-long' }
    });
    assert.equal(verifyCronSecret(noBearerReq), false);

    // Missing header entirely
    const emptyReq = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron');
    assert.equal(verifyCronSecret(emptyReq), false);

    // Short secret (< 16 chars) must fail closed
    process.env.CRON_SECRET = 'short';
    const shortReq = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      headers: { Authorization: 'Bearer short' }
    });
    assert.equal(verifyCronSecret(shortReq), false);
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

test('Engine Concurrency Lock: prevents overlapping runs while a cycle is active', async () => {
  const state = await loadBrandGrowthState();
  const originalStatus = state.status;
  const originalRunningSince = state.runningSince;

  try {
    // Simulate active running cycle
    state.status = 'running';
    state.runningSince = new Date().toISOString();
    await saveBrandGrowthState(state);

    const overlapRes = await runAutonomousBrandGrowthCycle();
    assert.equal(overlapRes.execution.status, 'warning');
    assert.ok(overlapRes.execution.summary.includes('Overlapping execution prevented'));
    assert.ok(overlapRes.execution.actionsExecuted.some(a => a.status === 'skipped'));
  } finally {
    // Restore state
    state.status = originalStatus;
    state.runningSince = originalRunningSince;
    await saveBrandGrowthState(state);
  }
});

test('Engine Deduplication: suppresses duplicate executions within minimum 5-minute spacing window', async () => {
  const state = await loadBrandGrowthState();
  const originalLastRun = state.lastRunAt;
  const originalStatus = state.status;

  try {
    // Simulate recent run 30 seconds ago
    state.status = 'idle';
    state.lastRunAt = new Date(Date.now() - 30 * 1000).toISOString();
    await saveBrandGrowthState(state);

    // Run without force should be suppressed
    const dupRes = await runAutonomousBrandGrowthCycle({ force: false });
    assert.equal(dupRes.execution.status, 'warning');
    assert.ok(dupRes.execution.summary.includes('Duplicate execution suppressed'));
  } finally {
    state.lastRunAt = originalLastRun;
    state.status = originalStatus;
    await saveBrandGrowthState(state);
  }
});

test('Engine State Persistence: preserves 50-run limit in execution history', async () => {
  const state = await loadBrandGrowthState();
  const originalHistory = [...state.executionHistory];

  try {
    // Populate with 55 dummy records
    const dummyRecords: AutonomousExecutionRecord[] = Array.from({ length: 55 }, (_, i) => ({
      id: `exec-dummy-${i}`,
      startedAt: new Date(Date.now() - i * 60000).toISOString(),
      completedAt: new Date(Date.now() - i * 60000 + 1000).toISOString(),
      durationMs: 1000,
      status: 'success',
      actionsExecuted: [],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 10,
      brandImpressions: 100,
      homepageIndexed: true,
      summary: `Dummy execution ${i}`
    }));

    state.executionHistory = dummyRecords.slice(0, 50);
    await saveBrandGrowthState(state);

    const reloaded = await loadBrandGrowthState();
    assert.equal(reloaded.executionHistory.length, 50);
    assert.equal(reloaded.executionHistory[0].id, 'exec-dummy-0');
  } finally {
    state.executionHistory = originalHistory;
    await saveBrandGrowthState(state);
  }
});

test('Serverless State Directory Resolution: resolves /tmp in serverless and .local locally', () => {
  const originalVercel = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    delete process.env.BRAND_STATE_DIR;
    const localDir = getBrandStateDir();
    assert.ok(localDir.includes('.local'), `Expected .local in ${localDir}`);

    process.env.VERCEL = '1';
    const vercelDir = getBrandStateDir();
    assert.ok(vercelDir.startsWith('/tmp') || vercelDir.startsWith('\\tmp'), `Expected /tmp in ${vercelDir}`);
  } finally {
    if (originalVercel !== undefined) {
      process.env.VERCEL = originalVercel;
    } else {
      delete process.env.VERCEL;
    }
  }
});

test('Strict Read-Only Enforcement: WordPress security barrier blocks all write operations', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    assert.throws(
      () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', { method }),
      (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Forbidden HTTP method')
    );
  }
});

test('Constants and Configuration: correct properties configured', () => {
  assert.equal(TARGET_DOMAIN, 'https://firstread.co.uk/');
  assert.equal(PRIMARY_BRAND_KEYWORD, 'firstread');
  assert.ok(BRAND_VARIATIONS.includes('firstread'));
  assert.ok(BRAND_VARIATIONS.includes('first read'));
  assert.ok(BRAND_VARIATIONS.includes('firstread.co.uk'));
  assert.ok(BRAND_VARIATIONS.includes('firstread uk'));
  assert.ok(BRAND_VARIATIONS.includes('firstread news'));
});

test('Scheduled Cron Execution: authorized GET with CRON_SECRET triggers exactly one monitoring cycle', async () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'production-cron-secret-32-chars-long';

    // Reset state to ensure clean run
    const state = await loadBrandGrowthState();
    state.status = 'idle';
    state.paused = false;
    state.lastRunAt = null;
    await saveBrandGrowthState(state);

    const req = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer production-cron-secret-32-chars-long'
      }
    });

    const res = await handleBrandCronRequest(req);

    assert.equal(res.status, 200);
    const body = res.data as { state?: { status: string }; execution?: { id: string; status: string } };
    assert.ok(body.state, 'Response must contain engine state');
    assert.ok(body.execution, 'Response must contain execution record');
    assert.ok(['success', 'warning'].includes(body.execution.status), `Execution status must be success or warning, got: ${body.execution.status}`);

    // Verify exactly one cycle was recorded in history
    const updatedState = await loadBrandGrowthState();
    assert.ok(updatedState.executionHistory.length > 0);
    assert.equal(updatedState.executionHistory[0].id, body.execution.id);
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

test('Scheduled Cron Execution: unauthorized GET with invalid token is rejected with 401 and does NOT run cycle', async () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'production-cron-secret-32-chars-long';

    const stateBefore = await loadBrandGrowthState();
    const historyCountBefore = stateBefore.executionHistory.length;

    const req = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer wrong-secret-32-chars-long-00000'
      }
    });

    const res = await handleBrandCronRequest(req);

    assert.equal(res.status, 401);
    const body = res.data as { error?: string };
    assert.equal(body.error, 'Unauthorised');

    // Verify NO cycle was executed
    const stateAfter = await loadBrandGrowthState();
    assert.equal(stateAfter.executionHistory.length, historyCountBefore);
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

test('Scheduled Cron Execution: ordinary browser GET request without Bearer token does NOT trigger cycle', async () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'production-cron-secret-32-chars-long';

    const stateBefore = await loadBrandGrowthState();
    const historyCountBefore = stateBefore.executionHistory.length;

    // Standard browser request (no Authorization header, even with cookie headers)
    const browserReq = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: 'firstread-session=dummy-session-cookie'
      }
    });

    const res = await handleBrandCronRequest(browserReq);

    assert.equal(res.status, 401);
    const body = res.data as { error?: string };
    assert.equal(body.error, 'Unauthorised');

    // Verify NO cycle was triggered
    const stateAfter = await loadBrandGrowthState();
    assert.equal(stateAfter.executionHistory.length, historyCountBefore);
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

test('Scheduled Cron Execution: request when CRON_SECRET is unconfigured fails closed with 401', async () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;

    const req = new Request('https://firstread-ai-seo-dashboard.vercel.app/api/admin/firstread/brand/cron', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer some-arbitrary-token'
      }
    });

    const res = await handleBrandCronRequest(req);
    assert.equal(res.status, 401);
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

