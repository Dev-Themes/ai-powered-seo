import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BrandGrowthEngineState,
  AutonomousExecutionRecord
} from './types';

export const MONITORING_BRANCH = 'monitoring-history';
export const STORAGE_PATH = 'content/brand-growth/state.json';
export const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export interface GitHubConfig {
  repository: string | null;
  token: string | null;
  branch: string;
}

export interface CachedMeta {
  cachedAt: number;
  sha?: string;
  durable: boolean;
}

/**
 * Returns GitHub storage configuration strictly enforcing the dedicated monitoring-history branch
 */
export function getGitHubConfig(): GitHubConfig {
  const repoCandidate = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO;
  const repository = repoCandidate ? repoCandidate.trim() : 'Dev-Themes/ai-powered-seo';
  const tokenCandidate = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const token = tokenCandidate ? tokenCandidate.trim() : null;

  // Requirement: NEVER commit directly to main. Strictly enforce monitoring-history.
  let branch = process.env.GITHUB_MONITORING_BRANCH ? process.env.GITHUB_MONITORING_BRANCH.trim() : MONITORING_BRANCH;
  if (!branch || branch === 'main' || branch === 'master') {
    branch = MONITORING_BRANCH;
  }

  return {
    repository,
    token,
    branch
  };
}

/**
 * Sanitizes error messages to prevent leaking GitHub tokens or Bearer headers into logs or UI
 */
export function sanitizeStorageError(err: unknown): string {
  if (!err) return 'Unknown storage error.';
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/ghp_[0-9A-Za-z]{20,}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/github_pat_[0-9A-Za-z_]{30,}/g, '[REDACTED_FINE_GRAINED_TOKEN]')
    .trim();
}

/**
 * Resolves local temporary cache directory (/tmp on serverless, .local locally)
 */
export function getBrandCacheDir(): string {
  if (process.env.BRAND_STATE_DIR) return process.env.BRAND_STATE_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return join('/tmp', 'brand-growth');
  }
  return join(process.cwd(), '.local', 'brand-growth');
}

export function getBrandCacheFile(): string {
  return join(getBrandCacheDir(), 'state.json');
}

export function getBrandCacheMetaFile(): string {
  return join(getBrandCacheDir(), 'cache-meta.json');
}

export function getBundledFallbackFile(): string {
  return join(process.cwd(), 'content', 'brand-growth', 'state.json');
}

/**
 * Merges two arrays of execution history records safely:
 * - Deduplicates by record ID
 * - Sorts newest first by startedAt
 * - Retains maximum 50 records
 */
export function mergeExecutionHistories(
  local: AutonomousExecutionRecord[],
  remote: AutonomousExecutionRecord[],
  limit = 50
): AutonomousExecutionRecord[] {
  const seen = new Set<string>();
  const merged: AutonomousExecutionRecord[] = [];

  for (const rec of [...local, ...remote]) {
    if (rec && rec.id && !seen.has(rec.id)) {
      seen.add(rec.id);
      merged.push(rec);
    }
  }

  merged.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  return merged.slice(0, limit);
}

/**
 * Reads state from GitHub Contents API on the dedicated monitoring-history branch
 */
export async function fetchRemoteStateFromGitHub(
  customFetch = globalThis.fetch
): Promise<{ state: BrandGrowthEngineState; sha: string } | null> {
  const config = getGitHubConfig();
  if (!config.repository || !config.token) return null;

  const url = `https://api.github.com/repos/${config.repository}/contents/${STORAGE_PATH}?ref=${encodeURIComponent(config.branch)}`;

  try {
    const res = await customFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'User-Agent': 'FirstRead-SEO-Monitoring',
        Accept: 'application/vnd.github.v3+json'
      },
      cache: 'no-store'
    });

    if (res.status === 404) {
      // Branch or file does not exist yet on GitHub
      return null;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`GitHub API read failed HTTP ${res.status}: ${errText}`);
    }

    const body = (await res.json()) as { content?: string; encoding?: string; sha: string };
    if (!body.content || !body.sha) return null;

    const raw = Buffer.from(body.content, 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as BrandGrowthEngineState;

    return {
      state: parsed,
      sha: body.sha
    };
  } catch (err) {
    console.warn('[Brand Storage] GitHub remote fetch error:', sanitizeStorageError(err));
    throw err;
  }
}

/**
 * Ensures the dedicated monitoring-history branch exists in GitHub
 */
async function ensureMonitoringBranchExists(
  config: GitHubConfig,
  customFetch = globalThis.fetch
): Promise<void> {
  if (!config.repository || !config.token) return;

  const branchUrl = `https://api.github.com/repos/${config.repository}/branches/${encodeURIComponent(config.branch)}`;
  const checkRes = await customFetch(branchUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'FirstRead-SEO-Monitoring',
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (checkRes.ok) return; // Branch already exists

  // Get default branch name (usually main)
  let defaultBranch = 'main';
  try {
    const repoUrl = `https://api.github.com/repos/${config.repository}`;
    const repoRes = await customFetch(repoUrl, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'User-Agent': 'FirstRead-SEO-Monitoring',
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (repoRes.ok) {
      const repoData = (await repoRes.json()) as { default_branch?: string };
      if (repoData.default_branch) defaultBranch = repoData.default_branch;
    }
  } catch {}

  // Resolve base commit SHA via commits endpoint (most reliable across all GitHub API scopes)
  let baseSha: string | undefined;
  try {
    const commitUrl = `https://api.github.com/repos/${config.repository}/commits/${encodeURIComponent(defaultBranch)}`;
    const commitRes = await customFetch(commitUrl, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'User-Agent': 'FirstRead-SEO-Monitoring',
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (commitRes.ok) {
      const commitData = (await commitRes.json()) as { sha?: string };
      baseSha = commitData.sha;
    }
  } catch {}

  if (!baseSha) {
    try {
      const refUrl = `https://api.github.com/repos/${config.repository}/git/refs/heads/${encodeURIComponent(defaultBranch)}`;
      const refRes = await customFetch(refUrl, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'User-Agent': 'FirstRead-SEO-Monitoring',
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (refRes.ok) {
        const refData = (await refRes.json()) as { object?: { sha?: string } };
        baseSha = refData.object?.sha;
      }
    } catch {}
  }

  if (!baseSha) {
    console.warn(`[Brand Storage] Could not resolve base commit SHA for default branch '${defaultBranch}'.`);
    return;
  }

  // Create refs/heads/monitoring-history
  const createRes = await customFetch(`https://api.github.com/repos/${config.repository}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'FirstRead-SEO-Monitoring',
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: `refs/heads/${config.branch}`,
      sha: baseSha
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    console.warn(`[Brand Storage] Failed to create branch '${config.branch}': HTTP ${createRes.status} ${errText}`);
  }
}

/**
 * Saves state to GitHub Contents API with SHA-based optimistic concurrency and retry on 409 conflict
 */
export async function saveRemoteStateToGitHub(
  state: BrandGrowthEngineState,
  lastKnownSha?: string,
  customFetch = globalThis.fetch
): Promise<{ success: boolean; sha?: string; error?: string }> {
  const config = getGitHubConfig();
  if (!config.repository || !config.token) {
    return {
      success: false,
      error: 'GitHub credentials unconfigured (GITHUB_TOKEN or GITHUB_REPOSITORY missing).'
    };
  }

  // Ensure dedicated branch exists before writing
  try {
    await ensureMonitoringBranchExists(config, customFetch);
  } catch {}

  const url = `https://api.github.com/repos/${config.repository}/contents/${STORAGE_PATH}`;
  let currentSha = lastKnownSha;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // If SHA is unknown on attempt 1, try fetching current file to get latest SHA
    if (!currentSha) {
      try {
        const remote = await fetchRemoteStateFromGitHub(customFetch);
        if (remote) {
          currentSha = remote.sha;
          // Merge history records with remote to prevent losing concurrent executions
          state.executionHistory = mergeExecutionHistories(state.executionHistory, remote.state.executionHistory, 50);
        }
      } catch {}
    }

    const jsonContent = JSON.stringify(state, null, 2);
    const base64Content = Buffer.from(jsonContent, 'utf8').toString('base64');

    const commitPayload: Record<string, unknown> = {
      message: `chore(brand): record autonomous SEO cycle [skip ci] [skip vercel]`,
      content: base64Content,
      branch: config.branch
    };

    if (currentSha) {
      commitPayload.sha = currentSha;
    }

    try {
      const res = await customFetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'User-Agent': 'FirstRead-SEO-Monitoring',
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commitPayload)
      });

      if (res.ok) {
        const resBody = (await res.json()) as { content?: { sha?: string } };
        return {
          success: true,
          sha: resBody.content?.sha
        };
      }

      // Handle 409 Conflict: concurrent run committed first
      if (res.status === 409 && attempt < MAX_RETRIES) {
        console.warn(`[Brand Storage] GitHub SHA conflict on attempt ${attempt}. Fetching latest remote state and merging...`);
        const latestRemote = await fetchRemoteStateFromGitHub(customFetch);
        if (latestRemote) {
          currentSha = latestRemote.sha;
          state.executionHistory = mergeExecutionHistories(state.executionHistory, latestRemote.state.executionHistory, 50);
        }
        await new Promise(r => setTimeout(r, 200 * attempt));
        continue;
      }

      const errText = await res.text().catch(() => '');
      const errMsg = `GitHub API save failed HTTP ${res.status}: ${errText}`;
      return {
        success: false,
        error: sanitizeStorageError(errMsg)
      };
    } catch (err) {
      const sanitized = sanitizeStorageError(err);
      if (attempt === MAX_RETRIES) {
        return { success: false, error: sanitized };
      }
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }

  return {
    success: false,
    error: 'Exceeded maximum retries on GitHub commit conflict.'
  };
}

/**
 * Saves state to local cache atomically
 */
export async function saveLocalCacheState(state: BrandGrowthEngineState, meta?: CachedMeta): Promise<void> {
  const dir = getBrandCacheDir();
  const file = getBrandCacheFile();
  const metaFile = getBrandCacheMetaFile();
  const tmpFile = join(dir, `state.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`);

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmpFile, JSON.stringify(state, null, 2), 'utf8');
    try {
      await rename(tmpFile, file);
    } catch {
      await writeFile(file, JSON.stringify(state, null, 2), 'utf8');
    }

    if (meta) {
      await writeFile(metaFile, JSON.stringify(meta, null, 2), 'utf8').catch(() => {});
    }
  } catch (err) {
    console.warn('[Brand Storage] Local cache write error:', err);
  } finally {
    try {
      if (existsSync(tmpFile)) await unlink(tmpFile);
    } catch {}
  }
}

/**
 * Reads local cached state and cache metadata
 */
export async function loadLocalCacheState(): Promise<{ state: BrandGrowthEngineState | null; meta: CachedMeta | null }> {
  const file = getBrandCacheFile();
  const metaFile = getBrandCacheMetaFile();

  let state: BrandGrowthEngineState | null = null;
  let meta: CachedMeta | null = null;

  try {
    if (existsSync(file)) {
      const raw = await readFile(file, 'utf8');
      state = JSON.parse(raw);
    }
    if (existsSync(metaFile)) {
      const rawMeta = await readFile(metaFile, 'utf8');
      meta = JSON.parse(rawMeta);
    }
  } catch {
    state = null;
    meta = null;
  }

  return { state, meta };
}
