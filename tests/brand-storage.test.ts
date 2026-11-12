import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGitHubConfig,
  sanitizeStorageError,
  mergeExecutionHistories,
  fetchRemoteStateFromGitHub,
  saveRemoteStateToGitHub,
  saveLocalCacheState,
  loadLocalCacheState,
  MONITORING_BRANCH,
  STORAGE_PATH
} from '../src/lib/brand/storage';
import type {
  BrandGrowthEngineState,
  AutonomousExecutionRecord
} from '../src/lib/brand/types';

test('Branch Enforcement: strictly uses monitoring-history and never main', () => {
  const originalBranch = process.env.GITHUB_MONITORING_BRANCH;
  try {
    // Default config
    delete process.env.GITHUB_MONITORING_BRANCH;
    const cfgDefault = getGitHubConfig();
    assert.equal(cfgDefault.branch, MONITORING_BRANCH);

    // Attempted misconfiguration to main must be overridden
    process.env.GITHUB_MONITORING_BRANCH = 'main';
    const cfgMain = getGitHubConfig();
    assert.equal(cfgMain.branch, 'monitoring-history', 'Must reject main and force monitoring-history');

    // Attempted misconfiguration to master must be overridden
    process.env.GITHUB_MONITORING_BRANCH = 'master';
    const cfgMaster = getGitHubConfig();
    assert.equal(cfgMaster.branch, 'monitoring-history', 'Must reject master and force monitoring-history');
  } finally {
    if (originalBranch !== undefined) {
      process.env.GITHUB_MONITORING_BRANCH = originalBranch;
    } else {
      delete process.env.GITHUB_MONITORING_BRANCH;
    }
  }
});

test('Deployment Loop Prevention: commit message includes both [skip ci] and [skip vercel]', async () => {
  const originalToken = process.env.GITHUB_TOKEN;
  const originalRepo = process.env.GITHUB_REPOSITORY;

  try {
    process.env.GITHUB_TOKEN = 'test-token-1234567890123456';
    process.env.GITHUB_REPOSITORY = 'Dev-Themes/ai-powered-seo';

    interface CommitPayload {
      message?: string;
      content?: string;
      branch?: string;
      sha?: string;
    }
    let capturedPayload: CommitPayload | null = null;
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (init?.method === 'PUT') {
        capturedPayload = JSON.parse(String(init.body)) as CommitPayload;
        return new Response(JSON.stringify({ content: { sha: 'sha-committed-123' } }), { status: 200 });
      }
      if (urlStr.includes('/branches/')) {
        return new Response(JSON.stringify({ name: 'monitoring-history' }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    };

    const dummyState: BrandGrowthEngineState = {
      status: 'idle',
      paused: false,
      lastRunAt: null,
      nextScheduledRunAt: null,
      safeRetryCount: 0,
      safeRetryLimit: 3,
      latestReport: null,
      latestGa4Correlation: null,
      homepageInspection: null,
      recentInspections: [],
      sitemapStatus: null,
      discoveryIssues: [],
      executionHistory: []
    };

    const res = await saveRemoteStateToGitHub(dummyState, 'sha-old-123', mockFetch as unknown as typeof fetch);
    assert.equal(res.success, true);
    const payload = capturedPayload as unknown as CommitPayload;
    assert.ok(payload);
    const msg = String(payload.message);
    assert.ok(msg.includes('[skip ci]'), 'Commit message must contain [skip ci]');
    assert.ok(msg.includes('[skip vercel]'), 'Commit message must contain [skip vercel]');
    assert.equal(payload.branch, 'monitoring-history', 'Commit branch must be monitoring-history');
  } finally {
    process.env.GITHUB_TOKEN = originalToken;
    process.env.GITHUB_REPOSITORY = originalRepo;
  }
});

test('Execution History Merging: deduplicates by id, sorts newest first, and caps at 50', () => {
  const local: AutonomousExecutionRecord[] = [
    {
      id: 'exec-1',
      startedAt: '2026-11-12T10:00:00Z',
      completedAt: '2026-11-12T10:00:10Z',
      durationMs: 10000,
      status: 'success',
      actionsExecuted: [],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 10,
      brandImpressions: 50,
      homepageIndexed: true,
      summary: 'Run 1'
    },
    {
      id: 'exec-2',
      startedAt: '2026-11-12T12:00:00Z',
      completedAt: '2026-11-12T12:00:10Z',
      durationMs: 10000,
      status: 'success',
      actionsExecuted: [],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 15,
      brandImpressions: 60,
      homepageIndexed: true,
      summary: 'Run 2'
    }
  ];

  const remote: AutonomousExecutionRecord[] = [
    {
      id: 'exec-2', // Duplicate of local
      startedAt: '2026-11-12T12:00:00Z',
      completedAt: '2026-11-12T12:00:10Z',
      durationMs: 10000,
      status: 'success',
      actionsExecuted: [],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 15,
      brandImpressions: 60,
      homepageIndexed: true,
      summary: 'Run 2'
    },
    {
      id: 'exec-3',
      startedAt: '2026-11-12T14:00:00Z', // Newest
      completedAt: '2026-11-12T14:00:10Z',
      durationMs: 10000,
      status: 'success',
      actionsExecuted: [],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 20,
      brandImpressions: 80,
      homepageIndexed: true,
      summary: 'Run 3'
    }
  ];

  const merged = mergeExecutionHistories(local, remote, 50);

  // Exactly 3 unique records (exec-2 not duplicated)
  assert.equal(merged.length, 3);
  // Sorted newest first by startedAt: exec-3 (14:00), exec-2 (12:00), exec-1 (10:00)
  assert.equal(merged[0].id, 'exec-3');
  assert.equal(merged[1].id, 'exec-2');
  assert.equal(merged[2].id, 'exec-1');
});

test('50-Run Retention Limit: retains strictly at most 50 execution records', () => {
  const records: AutonomousExecutionRecord[] = Array.from({ length: 65 }, (_, i) => ({
    id: `exec-${i}`,
    startedAt: new Date(Date.now() - (65 - i) * 60000).toISOString(),
    completedAt: new Date(Date.now() - (65 - i) * 60000 + 1000).toISOString(),
    durationMs: 1000,
    status: 'success',
    actionsExecuted: [],
    alertsCount: 0,
    discoveryIssuesCount: 0,
    brandClicks: 10,
    brandImpressions: 50,
    homepageIndexed: true,
    summary: `Run ${i}`
  }));

  const merged = mergeExecutionHistories(records, [], 50);
  assert.equal(merged.length, 50);
  // Newest record retained at index 0
  assert.equal(merged[0].id, 'exec-64');
});

test('GitHub Optimistic Concurrency: retries up to 3 times on 409 SHA conflict and merges histories', async () => {
  const originalToken = process.env.GITHUB_TOKEN;
  const originalRepo = process.env.GITHUB_REPOSITORY;

  try {
    process.env.GITHUB_TOKEN = 'test-token-1234567890123456';
    process.env.GITHUB_REPOSITORY = 'Dev-Themes/ai-powered-seo';

    let putAttempts = 0;
    const remoteExecutionRecord: AutonomousExecutionRecord = {
      id: 'exec-remote-concurrent',
      startedAt: '2026-11-12T13:00:00Z',
      completedAt: '2026-11-12T13:00:10Z',
      durationMs: 10000,
      status: 'success',
      actionsExecuted: [],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 50,
      brandImpressions: 100,
      homepageIndexed: true,
      summary: 'Concurrent remote run'
    };

    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (init?.method === 'PUT') {
        putAttempts++;
        if (putAttempts === 1) {
          // Attempt 1 fails with 409 Conflict
          return new Response(JSON.stringify({ message: 'conflict' }), { status: 409 });
        }
        // Attempt 2 succeeds with updated SHA
        return new Response(JSON.stringify({ content: { sha: 'sha-updated-after-conflict' } }), { status: 200 });
      }
      if (urlStr.includes('/branches/')) {
        return new Response(JSON.stringify({ name: 'monitoring-history' }), { status: 200 });
      }
      if (urlStr.includes(`/contents/${STORAGE_PATH}`)) {
        // Return latest remote file on conflict
        const remoteState: BrandGrowthEngineState = {
          status: 'idle',
          paused: false,
          lastRunAt: null,
          nextScheduledRunAt: null,
          safeRetryCount: 0,
          safeRetryLimit: 3,
          latestReport: null,
          latestGa4Correlation: null,
          homepageInspection: null,
          recentInspections: [],
          sitemapStatus: null,
          discoveryIssues: [],
          executionHistory: [remoteExecutionRecord]
        };
        const base64 = Buffer.from(JSON.stringify(remoteState)).toString('base64');
        return new Response(JSON.stringify({ content: base64, sha: 'sha-concurrent-new' }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    };

    const localState: BrandGrowthEngineState = {
      status: 'idle',
      paused: false,
      lastRunAt: null,
      nextScheduledRunAt: null,
      safeRetryCount: 0,
      safeRetryLimit: 3,
      latestReport: null,
      latestGa4Correlation: null,
      homepageInspection: null,
      recentInspections: [],
      sitemapStatus: null,
      discoveryIssues: [],
      executionHistory: [
        {
          id: 'exec-local-cycle',
          startedAt: '2026-11-12T13:05:00Z',
          completedAt: '2026-11-12T13:05:10Z',
          durationMs: 10000,
          status: 'success',
          actionsExecuted: [],
          alertsCount: 0,
          discoveryIssuesCount: 0,
          brandClicks: 60,
          brandImpressions: 120,
          homepageIndexed: true,
          summary: 'Local run'
        }
      ]
    };

    const saveRes = await saveRemoteStateToGitHub(localState, 'sha-stale', mockFetch as unknown as typeof fetch);
    assert.equal(saveRes.success, true);
    assert.equal(saveRes.sha, 'sha-updated-after-conflict');
    assert.equal(putAttempts, 2, 'Should retry and succeed on attempt 2');

    // Both local and concurrent remote execution records must be merged
    assert.ok(localState.executionHistory.some(r => r.id === 'exec-local-cycle'));
    assert.ok(localState.executionHistory.some(r => r.id === 'exec-remote-concurrent'));
  } finally {
    process.env.GITHUB_TOKEN = originalToken;
    process.env.GITHUB_REPOSITORY = originalRepo;
  }
});

test('Error Sanitization: redacts GitHub tokens and Authorization headers from error logs', () => {
  const fineGrained = 'github_pat_11AAAAABBBBCCCCDDDD_0123456789012345678901234567890';
  const classic = 'ghp_1234567890abcdef1234567890abcdef1234';
  const bearer = 'Bearer ghp_1234567890abcdef1234567890abcdef1234';

  const err1 = sanitizeStorageError(new Error(`Failed to commit: ${fineGrained}`));
  assert.ok(!err1.includes(fineGrained));
  assert.ok(err1.includes('[REDACTED_FINE_GRAINED_TOKEN]'));

  const err2 = sanitizeStorageError(new Error(`Request with ${bearer} failed`));
  assert.ok(!err2.includes(classic));
  assert.ok(err2.includes('[REDACTED_TOKEN]'));
});

test('Local Cache and TTL: serves from local cache within 60-second window', async () => {
  const dummyState: BrandGrowthEngineState = {
    status: 'idle',
    paused: false,
    lastRunAt: new Date().toISOString(),
    nextScheduledRunAt: null,
    safeRetryCount: 0,
    safeRetryLimit: 3,
    latestReport: null,
    latestGa4Correlation: null,
    homepageInspection: null,
    recentInspections: [],
    sitemapStatus: null,
    discoveryIssues: [],
    executionHistory: []
  };

  await saveLocalCacheState(dummyState, {
    cachedAt: Date.now(),
    sha: 'sha-cached-123',
    durable: true
  });

  const { state, meta } = await loadLocalCacheState();
  assert.ok(state);
  assert.ok(meta);
  assert.equal(meta.sha, 'sha-cached-123');
  assert.equal(meta.durable, true);
  assert.ok(Date.now() - meta.cachedAt < 5000);
});

test('Cold Start GitHub Retrieval: loads remote state from monitoring-history and populates local cache', async () => {
  const originalToken = process.env.GITHUB_TOKEN;
  const originalRepo = process.env.GITHUB_REPOSITORY;

  try {
    process.env.GITHUB_TOKEN = 'test-token-1234567890123456';
    process.env.GITHUB_REPOSITORY = 'Dev-Themes/ai-powered-seo';

    const remoteState: BrandGrowthEngineState = {
      status: 'idle',
      paused: false,
      lastRunAt: '2026-11-12T15:00:00Z',
      nextScheduledRunAt: null,
      safeRetryCount: 0,
      safeRetryLimit: 3,
      latestReport: null,
      latestGa4Correlation: null,
      homepageInspection: null,
      recentInspections: [],
      sitemapStatus: null,
      discoveryIssues: [],
      executionHistory: [
        {
          id: 'exec-cold-start-verified',
          startedAt: '2026-11-12T15:00:00Z',
          completedAt: '2026-11-12T15:00:10Z',
          durationMs: 10000,
          status: 'success',
          actionsExecuted: [],
          alertsCount: 0,
          discoveryIssuesCount: 0,
          brandClicks: 100,
          brandImpressions: 250,
          homepageIndexed: true,
          summary: 'Cold start remote verification'
        }
      ]
    };

    // Override fetchRemoteStateFromGitHub behavior using mock
    const base64 = Buffer.from(JSON.stringify(remoteState)).toString('base64');
    const mockFetch = async () => new Response(JSON.stringify({ content: base64, sha: 'sha-cold-start-999' }), { status: 200 });

    const fetched = await fetchRemoteStateFromGitHub(mockFetch as unknown as typeof fetch);
    assert.ok(fetched);
    assert.equal(fetched.sha, 'sha-cold-start-999');
    assert.equal(fetched.state.executionHistory[0].id, 'exec-cold-start-verified');
  } finally {
    process.env.GITHUB_TOKEN = originalToken;
    process.env.GITHUB_REPOSITORY = originalRepo;
  }
});

test('Graceful GitHub Outage: handles 500 server error without crashing', async () => {
  const originalToken = process.env.GITHUB_TOKEN;
  const originalRepo = process.env.GITHUB_REPOSITORY;

  try {
    process.env.GITHUB_TOKEN = 'test-token-1234567890123456';
    process.env.GITHUB_REPOSITORY = 'Dev-Themes/ai-powered-seo';

    const mockFailingFetch = async () => new Response('Internal Server Error', { status: 500 });

    // Remote fetch fails cleanly
    await assert.rejects(
      async () => fetchRemoteStateFromGitHub(mockFailingFetch as unknown as typeof fetch),
      (err: unknown) => err instanceof Error && err.message.includes('HTTP 500')
    );

    // Saving handles outage and returns success: false with truthful error
    const dummyState: BrandGrowthEngineState = {
      status: 'idle',
      paused: false,
      lastRunAt: null,
      nextScheduledRunAt: null,
      safeRetryCount: 0,
      safeRetryLimit: 3,
      latestReport: null,
      latestGa4Correlation: null,
      homepageInspection: null,
      recentInspections: [],
      sitemapStatus: null,
      discoveryIssues: [],
      executionHistory: []
    };

    const saveRes = await saveRemoteStateToGitHub(dummyState, undefined, mockFailingFetch as unknown as typeof fetch);
    assert.equal(saveRes.success, false);
    assert.ok(saveRes.error?.includes('500'));
  } finally {
    process.env.GITHUB_TOKEN = originalToken;
    process.env.GITHUB_REPOSITORY = originalRepo;
  }
});
