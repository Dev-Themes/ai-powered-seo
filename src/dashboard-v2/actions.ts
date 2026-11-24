/**
 * Real live server action client for Dashboard V2
 * Directly executes against verified autonomous backend engine routes:
 * - POST /api/admin/firstread/brand/run (runs real autonomous cycle)
 * - POST /api/admin/firstread/brand/recover (submits real unindexed posts)
 * - POST /api/admin/firstread/brand/indexing-publish (pings real Google Indexing API)
 *
 * Strict Invariants:
 * - 100% Read-Only on WordPress
 * - Zero mock or synthetic data
 */

export async function runOptimizationCycle(): Promise<{ success: boolean; message: string; execution?: unknown }> {
  try {
    const res = await fetch('/api/admin/firstread/brand/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error || `Cycle failed with HTTP ${res.status}`
      };
    }
    const data = await res.json();
    return {
      success: true,
      message: data.execution?.summary || 'Autonomous cycle completed successfully.',
      execution: data.execution
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Network error triggering cycle.'
    };
  }
}

export async function recoverBacklogBatch(batchSize: number = 35): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const res = await fetch('/api/admin/firstread/brand/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchSize }),
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        count: 0,
        message: errData.error || `Backlog recovery failed with HTTP ${res.status}`
      };
    }
    const data = await res.json();
    return {
      success: true,
      count: data.count || 0,
      message: data.message || `Submitted ${data.count} posts to Google Indexing API.`
    };
  } catch (err) {
    return {
      success: false,
      count: 0,
      message: err instanceof Error ? err.message : 'Network error during backlog recovery.'
    };
  }
}

export async function reindexTarget(targetId: number, query: string, targetUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const fullUrl = targetUrl.startsWith('http')
      ? targetUrl
      : `https://firstread.co.uk${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

    const res = await fetch('/api/admin/firstread/brand/indexing-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fullUrl, type: 'URL_UPDATED' }),
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error || `Re-index failed with HTTP ${res.status}`
      };
    }
    const data = await res.json();
    return {
      success: data.success ?? true,
      message: data.message || `Google Indexing API accepted notification for "${fullUrl}".`
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Network error submitting URL.'
    };
  }
}

// Backwards-compatible aliases for existing imports
export const runOptimizationCycleStub = runOptimizationCycle;
export const recoverBacklogBatchStub = recoverBacklogBatch;
export const reindexTargetStub = reindexTarget;
