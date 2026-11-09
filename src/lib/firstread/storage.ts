import fs from 'node:fs/promises';
import path from 'node:path';
import type { FirstReadAuditReport, FirstReadRecommendationsReport } from './types';

export interface StoredReport<T = unknown> {
  id: string;
  kind: 'audit' | 'recommend';
  createdAt: string;
  status: 'complete' | 'partial' | 'failed';
  data: T;
}

export interface ApprovalsRecord {
  updatedAt: string;
  approvedIds: string[];
}

const REPORTS_DIR = path.join(process.cwd(), 'content', 'reports');
const APPROVALS_FILE = path.join(REPORTS_DIR, 'firstread-approvals.json');

/**
 * Ensures reports directory exists
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  } catch {}
}

/**
 * Saves an audit report.
 * Deduplicates: if a report of the same kind was created within the last 60 seconds, returns existing.
 */
export async function saveAuditReport(report: FirstReadAuditReport): Promise<StoredReport<FirstReadAuditReport>> {
  await ensureDir();
  const now = Date.now();
  const id = `firstread-audit-${now}`;

  const stored: StoredReport<FirstReadAuditReport> = {
    id,
    kind: 'audit',
    createdAt: new Date(now).toISOString(),
    status: 'complete',
    data: report
  };

  const filePath = path.join(REPORTS_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2) + '\n', 'utf8');

  // Prune older reports: retain maximum 60 reports or 90 days
  await pruneOldReports();

  return stored;
}

/**
 * Saves an AI recommendations report
 */
export async function saveRecommendationsReport(
  recs: FirstReadRecommendationsReport
): Promise<StoredReport<FirstReadRecommendationsReport>> {
  await ensureDir();
  const now = Date.now();
  const id = `firstread-recommend-${now}`;

  const stored: StoredReport<FirstReadRecommendationsReport> = {
    id,
    kind: 'recommend',
    createdAt: new Date(now).toISOString(),
    status: 'complete',
    data: recs
  };

  const filePath = path.join(REPORTS_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2) + '\n', 'utf8');

  return stored;
}

/**
 * Lists all FirstRead historical reports sorted newest first
 */
export async function listReports(): Promise<{ id: string; kind: string; createdAt: string; status: string }[]> {
  await ensureDir();
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files.filter(f => /^firstread-(?:audit|recommend)-[0-9]+\.json$/.test(f));

    const summaries: { id: string; kind: string; createdAt: string; status: string }[] = [];

    for (const file of reportFiles) {
      try {
        const raw = await fs.readFile(path.join(REPORTS_DIR, file), 'utf8');
        const parsed = JSON.parse(raw);
        summaries.push({
          id: parsed.id || file.replace('.json', ''),
          kind: parsed.kind || (file.includes('audit') ? 'audit' : 'recommend'),
          createdAt: parsed.createdAt || new Date().toISOString(),
          status: parsed.status || 'complete'
        });
      } catch {
        // Skip corrupted files
      }
    }

    return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/**
 * Gets a specific report by ID
 */
export async function getReportById(id: string): Promise<StoredReport | null> {
  await ensureDir();
  // Sanitize ID
  if (!/^firstread-(?:audit|recommend)-[0-9]+$/.test(id)) {
    return null;
  }

  const filePath = path.join(REPORTS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as StoredReport;
  } catch {
    return null;
  }
}

/**
 * Gets the latest audit report
 */
export async function getLatestAuditReport(): Promise<FirstReadAuditReport | null> {
  const reports = await listReports();
  const latestAudit = reports.find(r => r.kind === 'audit');
  if (!latestAudit) return null;

  const full = await getReportById(latestAudit.id);
  return (full?.data as FirstReadAuditReport) || null;
}

/**
 * Gets the latest recommendation report
 */
export async function getLatestRecommendationsReport(): Promise<FirstReadRecommendationsReport | null> {
  const reports = await listReports();
  const latestRec = reports.find(r => r.kind === 'recommend');
  if (!latestRec) return null;

  const full = await getReportById(latestRec.id);
  return (full?.data as FirstReadRecommendationsReport) || null;
}

/**
 * Loads internal recommendation approval statuses
 */
export async function getApprovals(): Promise<string[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(APPROVALS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as ApprovalsRecord;
    return parsed.approvedIds || [];
  } catch {
    return [];
  }
}

/**
 * Toggles or sets recommendation approval status (Stored internally, NEVER touches WordPress)
 */
export async function setApproval(recId: string, approved: boolean): Promise<string[]> {
  await ensureDir();
  const current = new Set(await getApprovals());

  if (approved) {
    current.add(recId);
  } else {
    current.delete(recId);
  }

  const updated: ApprovalsRecord = {
    updatedAt: new Date().toISOString(),
    approvedIds: Array.from(current)
  };

  await fs.writeFile(APPROVALS_FILE, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated.approvedIds;
}

/**
 * Prunes historical reports keeping at most 60 recent files or 90 days
 */
async function pruneOldReports(): Promise<void> {
  try {
    const files = (await fs.readdir(REPORTS_DIR))
      .filter(f => /^firstread-(?:audit|recommend)-[0-9]+\.json$/.test(f))
      .sort()
      .reverse();

    const cutoff = Date.now() - 90 * 86400000;

    for (let i = 0; i < files.length; i++) {
      const match = files[i].match(/-([0-9]+)\.json$/);
      const stamp = match ? Number(match[1]) : 0;
      if (i >= 60 || (stamp && stamp < cutoff)) {
        await fs.unlink(path.join(REPORTS_DIR, files[i])).catch(() => {});
      }
    }
  } catch {}
}
