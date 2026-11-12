import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  runBrandKeywordTracking,
  correlateGA4OrganicSearch,
  TARGET_DOMAIN
} from './tracker';
import {
  auditSitemapStatus,
  auditTechnicalDiscovery,
  executePermittedIndexingActions
} from './indexing';
import {
  fetchRemoteStateFromGitHub,
  saveRemoteStateToGitHub,
  saveLocalCacheState,
  loadLocalCacheState,
  getBrandCacheDir,
  getBrandCacheFile,
  getBundledFallbackFile,
  mergeExecutionHistories,
  CACHE_TTL_MS,
  MONITORING_BRANCH
} from './storage';
import type {
  BrandGrowthEngineState,
  AutonomousExecutionRecord,
  AutonomousActionRecord
} from './types';

export { getBrandCacheDir, getBrandCacheFile, getBundledFallbackFile };

// Backwards-compatible aliases
export const getBrandStateDir = getBrandCacheDir;
export const getBrandStateFile = getBrandCacheFile;
export const getFallbackBrandStateFile = getBundledFallbackFile;

const DEFAULT_STATE: BrandGrowthEngineState = {
  status: 'idle',
  paused: false,
  lastRunAt: null,
  runningSince: null,
  nextScheduledRunAt: null,
  safeRetryCount: 0,
  safeRetryLimit: 3,
  latestReport: null,
  latestGa4Correlation: null,
  homepageInspection: null,
  recentInspections: [],
  sitemapStatus: null,
  discoveryIssues: [],
  executionHistory: [],
  storageStatus: {
    durable: false,
    provider: 'local_tmp'
  }
};

let lastKnownGitSha: string | undefined;

/**
 * Loads engine state with dual-layer caching:
 * 1. Warm local cache check (/tmp or .local) if within TTL
 * 2. On cold start or expired cache, fetches latest state from GitHub monitoring-history branch
 * 3. Fallback to local /tmp or bundled content/brand-growth/state.json if GitHub is unavailable
 */
export async function loadBrandGrowthState(options?: { forceFresh?: boolean }): Promise<BrandGrowthEngineState> {
  // 1. Check warm local cache if within TTL (fast path, zero network latency)
  try {
    const { state: localCached, meta } = await loadLocalCacheState();
    const isCacheFresh = meta && meta.cachedAt && (Date.now() - meta.cachedAt < CACHE_TTL_MS);

    if (!options?.forceFresh && localCached && isCacheFresh) {
      if (meta?.sha) lastKnownGitSha = meta.sha;
      return {
        ...DEFAULT_STATE,
        ...localCached,
        executionHistory: Array.isArray(localCached.executionHistory) ? localCached.executionHistory : []
      };
    }
  } catch {}

  // 2. Cold start or stale cache: Attempt remote fetch from GitHub on monitoring-history branch
  try {
    const remote = await fetchRemoteStateFromGitHub();
    if (remote && remote.state && typeof remote.state === 'object') {
      lastKnownGitSha = remote.sha;

      const loadedState: BrandGrowthEngineState = {
        ...DEFAULT_STATE,
        ...remote.state,
        executionHistory: Array.isArray(remote.state.executionHistory) ? remote.state.executionHistory : [],
        storageStatus: {
          durable: true,
          provider: 'github',
          branch: MONITORING_BRANCH,
          sha: remote.sha,
          lastSyncAt: new Date().toISOString()
        }
      };

      // Populate local cache
      await saveLocalCacheState(loadedState, {
        cachedAt: Date.now(),
        sha: remote.sha,
        durable: true
      });

      return loadedState;
    }
  } catch (err) {
    console.warn('[Brand Engine] Remote GitHub read failed, falling back to local storage:', err instanceof Error ? err.message : String(err));
  }

  // 3. Fallback to existing local cache (even if stale)
  try {
    const { state: localCached, meta } = await loadLocalCacheState();
    if (localCached) {
      if (meta?.sha) lastKnownGitSha = meta.sha;
      return {
        ...DEFAULT_STATE,
        ...localCached,
        executionHistory: Array.isArray(localCached.executionHistory) ? localCached.executionHistory : [],
        storageStatus: {
          durable: false,
          provider: 'local_tmp',
          error: 'GitHub remote read unavailable; using local container cache.'
        }
      };
    }
  } catch {}

  // 4. Fallback to bundled repository snapshot if available
  const bundledPath = getBundledFallbackFile();
  try {
    if (existsSync(bundledPath)) {
      const data = await readFile(bundledPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_STATE,
          ...parsed,
          executionHistory: Array.isArray(parsed.executionHistory) ? parsed.executionHistory : [],
          storageStatus: {
            durable: false,
            provider: 'fallback'
          }
        };
      }
    }
  } catch {}

  return { ...DEFAULT_STATE };
}

/**
 * Persists engine state to disk safely:
 * 1. Atomically updates local cache in /tmp to guarantee immediate consistency
 * 2. Syncs to GitHub Contents API on monitoring-history with optimistic concurrency and retry
 */
export async function saveBrandGrowthState(
  state: BrandGrowthEngineState,
  options?: { skipRemote?: boolean }
): Promise<void> {
  // Always enforce 50-run history limit
  state.executionHistory = (state.executionHistory || []).slice(0, 50);

  // 1. Atomic local write
  await saveLocalCacheState(state, {
    cachedAt: Date.now(),
    sha: lastKnownGitSha,
    durable: Boolean(state.storageStatus?.durable)
  });

  // 2. Synchronize to permanent GitHub storage if not skipped
  if (!options?.skipRemote) {
    try {
      const remoteRes = await saveRemoteStateToGitHub(state, lastKnownGitSha);
      if (remoteRes.success && remoteRes.sha) {
        lastKnownGitSha = remoteRes.sha;
        state.storageStatus = {
          durable: true,
          provider: 'github',
          branch: MONITORING_BRANCH,
          sha: remoteRes.sha,
          lastSyncAt: new Date().toISOString()
        };

        // Update local cache meta with confirmed remote durability
        await saveLocalCacheState(state, {
          cachedAt: Date.now(),
          sha: remoteRes.sha,
          durable: true
        });
      } else {
        state.storageStatus = {
          durable: false,
          provider: 'local_tmp',
          error: remoteRes.error || 'GitHub remote sync failed.'
        };
      }
    } catch (err) {
      state.storageStatus = {
        durable: false,
        provider: 'local_tmp',
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}

/**
 * Sets pause state for autonomous execution
 */
export async function setAutonomousExecutionPaused(paused: boolean): Promise<BrandGrowthEngineState> {
  const state = await loadBrandGrowthState();
  state.paused = paused;
  state.status = paused ? 'paused' : 'idle';
  await saveBrandGrowthState(state);
  return state;
}

/**
 * Emergency stop to immediately halt autonomous actions
 */
export async function emergencyStopAutonomousExecution(): Promise<BrandGrowthEngineState> {
  const state = await loadBrandGrowthState();
  state.paused = true;
  state.status = 'stopped';
  state.runningSince = null;
  await saveBrandGrowthState(state);
  return state;
}

/**
 * Executes a complete autonomous Brand Keyword Growth and Indexing cycle:
 * Collect Data → Analyze Brand Queries → Inspect Indexing → Identify Technical Problems → Execute Permitted Google Actions → Verify → Measure Results
 */
export async function runAutonomousBrandGrowthCycle(options?: {
  force?: boolean;
}): Promise<{
  state: BrandGrowthEngineState;
  execution: AutonomousExecutionRecord;
}> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const state = await loadBrandGrowthState();

  // 1. Check Pause State
  if (state.paused) {
    const skippedExecution: AutonomousExecutionRecord = {
      id: `exec-${startTime}`,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'warning',
      actionsExecuted: [
        {
          id: `act-paused-${startTime}`,
          timestamp: new Date().toISOString(),
          actionType: 'inspect_homepage',
          target: TARGET_DOMAIN,
          status: 'skipped',
          details: 'Autonomous execution skipped because engine is currently paused.',
          reason: 'Engine paused by admin.'
        }
      ],
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 0,
      brandImpressions: 0,
      homepageIndexed: false,
      summary: 'Cycle skipped: Autonomous engine is paused.',
      storageStatus: state.storageStatus
    };
    return { state, execution: skippedExecution };
  }

  // 2. Concurrency Lock: Prevent overlapping executions
  const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  if (state.status === 'running') {
    const runningSinceMs = state.runningSince ? new Date(state.runningSince).getTime() : 0;
    const lockAgeMs = startTime - runningSinceMs;

    if (runningSinceMs > 0 && lockAgeMs < LOCK_TIMEOUT_MS) {
      const skippedExecution: AutonomousExecutionRecord = {
        id: `exec-overlap-${startTime}`,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: 'warning',
        actionsExecuted: [
          {
            id: `act-overlap-${startTime}`,
            timestamp: new Date().toISOString(),
            actionType: 'inspect_homepage',
            target: TARGET_DOMAIN,
            status: 'skipped',
            details: `Autonomous execution skipped: Another cycle is currently in progress (running for ${Math.round(lockAgeMs / 1000)}s since ${state.runningSince}).`,
            reason: 'Prevent overlapping executions.'
          }
        ],
        alertsCount: 0,
        discoveryIssuesCount: 0,
        brandClicks: 0,
        brandImpressions: 0,
        homepageIndexed: false,
        summary: `Cycle skipped: Overlapping execution prevented (prior cycle started at ${state.runningSince}).`,
        storageStatus: state.storageStatus
      };
      return { state, execution: skippedExecution };
    }

    console.warn('[Brand Engine] Previous execution lock expired (>10m); taking over lock.');
  }

  // 3. Deduplication Guard: Prevent duplicate runs within minimum interval unless forced
  const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum between runs
  if (state.lastRunAt && !options?.force) {
    const lastRunMs = new Date(state.lastRunAt).getTime();
    const elapsedMs = startTime - lastRunMs;

    if (elapsedMs < MIN_INTERVAL_MS) {
      const skippedExecution: AutonomousExecutionRecord = {
        id: `exec-dup-${startTime}`,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: 'warning',
        actionsExecuted: [
          {
            id: `act-dup-${startTime}`,
            timestamp: new Date().toISOString(),
            actionType: 'inspect_homepage',
            target: TARGET_DOMAIN,
            status: 'skipped',
            details: `Cycle skipped: Deduplication guard active. Last run completed ${Math.round(elapsedMs / 1000)}s ago (minimum ${Math.round(MIN_INTERVAL_MS / 60000)}m spacing).`,
            reason: 'Deduplication protection.'
          }
        ],
        alertsCount: 0,
        discoveryIssuesCount: 0,
        brandClicks: 0,
        brandImpressions: 0,
        homepageIndexed: false,
        summary: 'Cycle skipped: Duplicate execution suppressed within minimum spacing window.',
        storageStatus: state.storageStatus
      };
      return { state, execution: skippedExecution };
    }
  }

  // Acquire in-memory lock locally (skipping remote sync during lock acquisition to keep fast)
  state.status = 'running';
  state.runningSince = startedAt;
  await saveBrandGrowthState(state, { skipRemote: true });

  const actionsExecuted: AutonomousActionRecord[] = [];

  try {
    // 1. Collect Data & Analyze Brand Queries
    const brandReport = await runBrandKeywordTracking();
    state.latestReport = brandReport;

    // 2. Correlate with GA4 Organic Search traffic
    const ga4Correlation = await correlateGA4OrganicSearch(brandReport.totalBrandedSummary.clicks);
    state.latestGa4Correlation = ga4Correlation;

    // 3. Inspect Indexing and Sitemaps (carrying forward prior submission result)
    const sitemapStatus = await auditSitemapStatus(state.sitemapStatus);
    state.sitemapStatus = sitemapStatus;

    // 4. Identify Technical Discovery Issues
    const discoveryIssues = await auditTechnicalDiscovery();
    state.discoveryIssues = discoveryIssues;

    // 5. Execute Permitted Google Actions (Sitemap submission & URL Inspection)
    const priorityUrls = [
      TARGET_DOMAIN,
      'https://firstread.co.uk/about-us/',
      'https://firstread.co.uk/contact-us/',
      'https://firstread.co.uk/category/news/'
    ];

    const { actions, inspections } = await executePermittedIndexingActions(sitemapStatus, priorityUrls);
    actionsExecuted.push(...actions);

    const hpInspection = inspections.find(i => i.url === TARGET_DOMAIN) || inspections[0] || null;
    state.homepageInspection = hpInspection;
    state.recentInspections = inspections;

    // 6. Verify & Measure Results
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    const isHpIndexed = hpInspection ? hpInspection.verdict === 'PASS' : false;

    // Determine execution status
    const hasFailures = actions.some(a => a.status === 'failed') || brandReport.alerts.some(a => a.severity === 'critical');
    const executionStatus: 'success' | 'warning' | 'failed' = hasFailures ? 'warning' : 'success';

    const summary = `Completed autonomous cycle in ${durationMs}ms: Tracked ${brandReport.totalBrandedSummary.clicks} brand clicks (${brandReport.totalBrandedSummary.impressions} impressions). Homepage indexing verdict: ${hpInspection?.verdict || 'N/A'}. Executed ${actions.length} action(s).`;

    const executionRecord: AutonomousExecutionRecord = {
      id: `exec-${startTime}`,
      startedAt,
      completedAt,
      durationMs,
      status: executionStatus,
      actionsExecuted,
      alertsCount: brandReport.alerts.length,
      discoveryIssuesCount: discoveryIssues.length,
      brandClicks: brandReport.totalBrandedSummary.clicks,
      brandImpressions: brandReport.totalBrandedSummary.impressions,
      homepageIndexed: isHpIndexed,
      summary
    };

    // Update state
    state.lastRunAt = completedAt;
    state.runningSince = null;
    state.nextScheduledRunAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    state.status = 'idle';
    state.safeRetryCount = 0;

    // Maintain history up to 50 records using deduplicated merge
    state.executionHistory = mergeExecutionHistories([executionRecord], state.executionHistory, 50);

    // Save with remote GitHub synchronization
    await saveBrandGrowthState(state);
    executionRecord.storageStatus = state.storageStatus;

    return { state, execution: executionRecord };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    state.safeRetryCount = (state.safeRetryCount || 0) + 1;
    state.status = state.safeRetryCount >= state.safeRetryLimit ? 'error' : 'idle';
    state.runningSince = null;

    const failedExecution: AutonomousExecutionRecord = {
      id: `exec-${startTime}`,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'failed',
      actionsExecuted,
      alertsCount: 0,
      discoveryIssuesCount: 0,
      brandClicks: 0,
      brandImpressions: 0,
      homepageIndexed: false,
      summary: `Autonomous cycle failed: ${errorMsg}`
    };

    state.executionHistory = mergeExecutionHistories([failedExecution], state.executionHistory, 50);
    await saveBrandGrowthState(state);
    failedExecution.storageStatus = state.storageStatus;

    return { state, execution: failedExecution };
  }
}
