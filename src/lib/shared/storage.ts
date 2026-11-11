import fs from 'node:fs/promises';
import path from 'node:path';
import type { FirstReadAuditReport } from '../seo/types';
import type { FirstReadRecommendationsReport } from '../content/types';

export interface StoredReport<T = unknown> {
  id: string;
  kind: 'audit' | 'recommend';
  createdAt: string;
  status: 'complete' | 'partial' | 'failed';
  data: T;
}

export function getReportsDir(): string {
  if (process.env.REPORTS_DIR) return process.env.REPORTS_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'content', 'reports');
  }
  return path.join(process.cwd(), 'content', 'reports');
}

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
  if (report.summary.totalDiscovered === undefined) {
    report.summary.totalDiscovered = report.summary.articlesDiscovered ?? report.siteInfo?.totalPosts ?? report.summary.totalChecked;
  }
  if (report.summary.totalAudited === undefined) {
    report.summary.totalAudited = report.summary.articlesAudited ?? report.summary.totalChecked;
  }
  if (report.summary.notAudited === undefined) {
    report.summary.notAudited = report.summary.articlesSkipped ?? Math.max(0, (report.summary.totalDiscovered || 0) - (report.summary.totalAudited || 0));
  }
  if (report.summary.coveragePercentage === undefined) {
    const total = report.summary.totalDiscovered || 0;
    const audited = report.summary.totalAudited || 0;
    report.summary.coveragePercentage = total > 0 ? Number(((audited / total) * 100).toFixed(1)) : 100;
  }
  if (report.summary.auditScope === undefined) {
    report.summary.auditScope = (report.summary.totalAudited || 0) >= (report.summary.totalDiscovered || 0) ? 'complete' : 'sampled';
  }
  if (report.summary.isComplete === undefined) {
    report.summary.isComplete = report.summary.auditScope === 'complete';
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

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(getReportsDir(), { recursive: true });
  } catch {}
}

/**
 * Saves an audit report to disk
 */
export async function saveAuditReport(report: FirstReadAuditReport): Promise<StoredReport<FirstReadAuditReport>> {
  await ensureDir();
  const dir = getReportsDir();
  const now = Date.now();
  const id = `firstread-audit-${now}`;

  const stored: StoredReport<FirstReadAuditReport> = {
    id,
    kind: 'audit',
    createdAt: new Date(now).toISOString(),
    status: 'complete',
    data: report
  };

  const filePath = path.join(dir, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2) + '\n', 'utf8');

  await pruneOldReports();
  return stored;
}

/**
 * Saves an AI recommendations report to disk
 */
export async function saveRecommendationsReport(
  recs: FirstReadRecommendationsReport
): Promise<StoredReport<FirstReadRecommendationsReport>> {
  await ensureDir();
  const dir = getReportsDir();
  const now = Date.now();
  const id = `firstread-recommend-${now}`;

  const stored: StoredReport<FirstReadRecommendationsReport> = {
    id,
    kind: 'recommend',
    createdAt: new Date(now).toISOString(),
    status: 'complete',
    data: recs
  };

  const filePath = path.join(dir, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(stored, null, 2) + '\n', 'utf8');

  return stored;
}

/**
 * Lists all FirstRead historical reports sorted newest first
 */
export async function listReports(): Promise<{ id: string; kind: string; createdAt: string; status: string }[]> {
  await ensureDir();
  const primaryDir = getReportsDir();
  const fallbackDir = path.join(process.cwd(), 'content', 'reports');
  const dirsToScan = primaryDir === fallbackDir ? [primaryDir] : [primaryDir, fallbackDir];

  const seenIds = new Set<string>();
  const summaries: { id: string; kind: string; createdAt: string; status: string }[] = [];

  for (const dir of dirsToScan) {
    try {
      const files = await fs.readdir(/*turbopackIgnore: true*/ dir);
      const reportFiles = files.filter(f => /^firstread-(?:audit|recommend)-[0-9]+\.json$/.test(f));

      for (const file of reportFiles) {
        try {
          const raw = await fs.readFile(path.join(/*turbopackIgnore: true*/ dir, file), 'utf8');
          const parsed = JSON.parse(raw);
          const id = parsed.id || file.replace('.json', '');
          if (!seenIds.has(id)) {
            seenIds.add(id);
            summaries.push({
              id,
              kind: parsed.kind || (file.includes('audit') ? 'audit' : 'recommend'),
              createdAt: parsed.createdAt || new Date().toISOString(),
              status: parsed.status || 'complete'
            });
          }
        } catch {
          // Skip corrupted files
        }
      }
    } catch {
      // Skip missing directories
    }
  }

  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Gets a specific report by ID
 */
export async function getReportById(id: string): Promise<StoredReport | null> {
  await ensureDir();
  if (!/^firstread-(?:audit|recommend)-[0-9]+$/.test(id)) {
    return null;
  }

  const primaryDir = getReportsDir();
  const fallbackDir = path.join(process.cwd(), 'content', 'reports');
  const dirsToSearch = primaryDir === fallbackDir ? [primaryDir] : [primaryDir, fallbackDir];

  for (const dir of dirsToSearch) {
    const filePath = path.join(/*turbopackIgnore: true*/ dir, `${id}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoredReport;
      if (parsed.kind === 'audit' && parsed.data) {
        parsed.data = normalizeAuditReport(parsed.data as FirstReadAuditReport);
      }
      return parsed;
    } catch {
      // Try next
    }
  }

  return null;
}

/**
 * Gets the latest audit report
 */
export async function getLatestAuditReport(): Promise<FirstReadAuditReport | null> {
  const reports = await listReports();
  const auditSummaries = reports.filter(r => r.kind === 'audit');
  if (auditSummaries.length === 0) return null;

  for (const sum of auditSummaries) {
    const full = await getReportById(sum.id);
    const report = full?.data as FirstReadAuditReport | undefined;
    if (report?.articles && report.articles.length > 0) {
      return report;
    }
  }

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
 * Prunes historical reports keeping at most 60 recent files or 90 days
 */
async function pruneOldReports(): Promise<void> {
  try {
    const dir = getReportsDir();
    const files = (await fs.readdir(/*turbopackIgnore: true*/ dir))
      .filter(f => /^firstread-(?:audit|recommend)-[0-9]+\.json$/.test(f))
      .sort()
      .reverse();

    const cutoff = Date.now() - 90 * 86400000;

    for (let i = 0; i < files.length; i++) {
      const match = files[i].match(/-([0-9]+)\.json$/);
      const stamp = match ? Number(match[1]) : 0;
      if (i >= 60 || (stamp && stamp < cutoff)) {
        await fs.unlink(path.join(/*turbopackIgnore: true*/ dir, files[i])).catch(() => {});
      }
    }
  } catch {}
}
