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

const REPORTS_DIR = process.env.REPORTS_DIR || path.join(process.cwd(), 'content', 'reports');
const APPROVALS_FILE = path.join(REPORTS_DIR, 'firstread-approvals.json');

/**
 * Normalizes an audit report to guarantee backward-compatibility for renamed fields
 */
export function normalizeAuditReport(report: FirstReadAuditReport): FirstReadAuditReport {
  if (!report || !report.summary) return report;
  if (report.summary.protocolIssuesCount === undefined) {
    report.summary.protocolIssuesCount = report.summary.errorsCount ?? report.technical?.protocolIssues?.length ?? 0;
  }
  if (report.summary.errorsCount === undefined) {
    report.summary.errorsCount = report.summary.protocolIssuesCount;
  }
  if (report.summary.failedRequestsCount === undefined) {
    report.summary.failedRequestsCount = 0;
  }
  if (report.summary.missingAltTotal === undefined) {
    report.summary.missingAltTotal = report.summary.missingAltImagesTotal ?? 0;
  }
  if (report.summary.emptyAltTotal === undefined) {
    report.summary.emptyAltTotal = 0;
  }
  if (report.summary.descriptiveAltTotal === undefined) {
    report.summary.descriptiveAltTotal = 0;
  }
  if (Array.isArray(report.articles)) {
    for (const a of report.articles) {
      if (a.bodyH1Count === undefined) {
        a.bodyH1Count = a.h1Count ?? 0;
      }
      if (a.h1Count === undefined) {
        a.h1Count = a.bodyH1Count;
      }
      if (a.missingAltCount === undefined) {
        a.missingAltCount = a.missingAltImagesCount ?? 0;
      }
      if (a.emptyAltCount === undefined) {
        a.emptyAltCount = 0;
      }
      if (a.descriptiveAltCount === undefined) {
        a.descriptiveAltCount = Math.max(0, (a.totalImagesCount || 0) - (a.missingAltCount || 0));
      }
    }
  }
  return report;
}

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
    const parsed = JSON.parse(raw) as StoredReport;
    if (parsed.kind === 'audit' && parsed.data) {
      parsed.data = normalizeAuditReport(parsed.data as FirstReadAuditReport);
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Gets the latest audit report
 */
export async function getLatestAuditReport(): Promise<FirstReadAuditReport | null> {
  const reports = await listReports();
  const auditSummaries = reports.filter(r => r.kind === 'audit');
  if (auditSummaries.length === 0) return null;

  // Prefer the latest audit report that contains audited articles
  for (const sum of auditSummaries) {
    const full = await getReportById(sum.id);
    const report = full?.data as FirstReadAuditReport | undefined;
    if (report?.articles && report.articles.length > 0) {
      return report;
    }
  }

  // Fallback to absolute latest if none have articles
  const fallback = await getReportById(auditSummaries[0].id);
  return (fallback?.data as FirstReadAuditReport) || null;
}

/**
 * Gets the latest recommendation report
 */
export async function getLatestRecommendationsReport(): Promise<FirstReadRecommendationsReport | null> {
  const reports = await listReports();
  const recSummaries = reports.filter(r => r.kind === 'recommend');
  if (recSummaries.length === 0) return null;

  for (const sum of recSummaries) {
    const full = await getReportById(sum.id);
    const report = full?.data as FirstReadRecommendationsReport | undefined;
    if (report?.recommendations && report.recommendations.length > 0 && !report.recommendations.some(r => r.id.includes('unit-test'))) {
      return report;
    }
  }

  const fallback = await getReportById(recSummaries[0].id);
  return (fallback?.data as FirstReadRecommendationsReport) || null;
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
