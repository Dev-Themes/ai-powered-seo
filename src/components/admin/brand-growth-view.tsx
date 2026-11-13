'use client';

import { useState, Fragment } from 'react';
import {
  TrendingUp,
  Play,
  Pause,
  Square,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
  Download,
  GitBranch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BrandGrowthEngineState } from '@/lib/brand/types';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface BrandGrowthViewProps {
  brandState: BrandGrowthEngineState | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onRunCycle: () => Promise<void>;
  onTogglePause: (pause: boolean) => Promise<void>;
  onEmergencyStop: () => Promise<void>;
  onInspectUrl: (url: string) => Promise<void>;
}

export function BrandGrowthView({
  brandState,
  loading,
  onRefresh,
  onRunCycle,
  onTogglePause,
  onEmergencyStop,
  onInspectUrl
}: BrandGrowthViewProps) {
  const [customInspectUrl, setCustomInspectUrl] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [expandedExecId, setExpandedExecId] = useState<string | null>(null);

  const report = brandState?.latestReport;
  const ga4 = brandState?.latestGa4Correlation;
  const hpInspection = brandState?.homepageInspection;
  const sitemap = brandState?.sitemapStatus;
  const issues = brandState?.discoveryIssues || [];
  const history = brandState?.executionHistory || [];

  const handleCustomInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInspectUrl.trim()) return;
    setInspecting(true);
    try {
      await onInspectUrl(customInspectUrl.trim());
      setCustomInspectUrl('');
    } finally {
      setInspecting(false);
    }
  };

  const executeAction = async (name: string, fn: () => Promise<void>) => {
    setActionInProgress(name);
    try {
      await fn();
    } finally {
      setActionInProgress(null);
    }
  };

  const isPaused = brandState?.paused || brandState?.status === 'paused';
  const isStopped = brandState?.status === 'stopped';
  const isRunning = brandState?.status === 'running';

  return (
    <div className="space-y-6">
      {/* 1. Header & Autonomous Control Bar */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <TrendingUp className="w-3.5 h-3.5" /> AUTONOMOUS ENGINE
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                  isRunning
                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 animate-pulse'
                    : isPaused
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : isStopped
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isRunning
                  ? '● Running Cycle...'
                  : isPaused
                  ? '⏸ Engine Paused'
                  : isStopped
                  ? '⏹ Emergency Stopped'
                  : '● Active (Daily Scheduled)'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-[var(--foreground)] mt-1 mb-0.5">
              FirstRead Brand Growth &amp; Indexing Automation
            </h3>
            <p className="text-xs text-[var(--muted)] m-0">
              Autonomous discovery, indexing management, and brand query performance for keyword{' '}
              <strong className="text-[var(--foreground)] font-mono">&quot;firstread&quot;</strong> on{' '}
              <a
                href="https://firstread.co.uk/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5"
              >
                firstread.co.uk <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={loading || isRunning || actionInProgress !== null}
              onClick={() => executeAction('run', onRunCycle)}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              {isRunning || actionInProgress === 'run' ? 'Running...' : 'Run Cycle Now'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || actionInProgress !== null}
              onClick={() => executeAction('pause', () => onTogglePause(!isPaused))}
              className="text-xs h-8"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Resume Engine
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 mr-1 text-amber-500" /> Pause Engine
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || isStopped || actionInProgress !== null}
              onClick={() => executeAction('stop', onEmergencyStop)}
              className="text-xs h-8 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30"
            >
              <Square className="w-3.5 h-3.5 mr-1 fill-current" /> Stop
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={onRefresh}
              className="text-xs h-8 w-8 p-0"
              title="Refresh State"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Schedule & Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>Last Run:</span>
            <strong className="text-[var(--foreground)] font-medium">
              {brandState?.lastRunAt ? new Date(brandState.lastRunAt).toLocaleString('en-GB') : 'Pending first run'}
            </strong>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>Next Cron:</span>
            <strong className="text-[var(--foreground)] font-medium">
              {isPaused
                ? 'Suspended (Paused)'
                : brandState?.nextScheduledRunAt
                ? new Date(brandState.nextScheduledRunAt).toLocaleString('en-GB')
                : 'Daily 06:00 UTC'}
            </strong>
          </div>

          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Guardrail:</span>
            <span className="badge badge-success text-[10px] py-0">Zero Content Edits</span>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <GitBranch className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span>Branch:</span>
            {brandState?.storageStatus?.durable ? (
              <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-semibold truncate" title={`Committed to ${brandState.storageStatus.branch || 'monitoring-history'} @ ${brandState.storageStatus.sha}`}>
                {brandState.storageStatus.branch || 'monitoring-history'} ({brandState.storageStatus.sha?.slice(0, 7)})
              </span>
            ) : (
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 truncate" title={brandState?.storageStatus?.error || 'Local cache (/tmp)'}>
                {brandState?.storageStatus?.provider === 'local_tmp' ? 'Local (/tmp)' : 'Syncing...'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top 6 Core Brand Metrics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Brand Clicks */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[var(--muted)] flex items-center justify-between mb-1 font-medium">
            <span>FirstRead Clicks</span>
            <span className="badge badge-success text-[10px] py-0">Actual GSC</span>
          </span>
          <strong className="text-xl font-bold text-emerald-600 dark:text-emerald-400 block">
            {report?.totalBrandedSummary?.clicks !== undefined ? report.totalBrandedSummary.clicks : '…'}
          </strong>
          <small className="text-[var(--muted-light)] flex items-center gap-1 mt-0.5">
            {report?.comparison28d?.clicks?.percentageChange !== null && report?.comparison28d?.clicks?.percentageChange !== undefined ? (
              <span
                className={`inline-flex items-center font-semibold ${
                  report.comparison28d.clicks.percentageChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {report.comparison28d.clicks.percentageChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(report.comparison28d.clicks.percentageChange)}% vs prior 28d
              </span>
            ) : (
              '28-day brand clicks'
            )}
          </small>
        </div>

        {/* Brand Impressions */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[var(--muted)] flex items-center justify-between mb-1 font-medium">
            <span>Brand Impressions</span>
            <span className="badge badge-success text-[10px] py-0">Actual GSC</span>
          </span>
          <strong className="text-xl font-bold text-[var(--foreground)] block">
            {report?.totalBrandedSummary?.impressions !== undefined ? report.totalBrandedSummary.impressions : '…'}
          </strong>
          <small className="text-[var(--muted-light)] flex items-center gap-1 mt-0.5">
            {report?.comparison28d?.impressions?.percentageChange !== null && report?.comparison28d?.impressions?.percentageChange !== undefined ? (
              <span
                className={`inline-flex items-center font-semibold ${
                  report.comparison28d.impressions.percentageChange >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {report.comparison28d.impressions.percentageChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(report.comparison28d.impressions.percentageChange)}% vs prior 28d
              </span>
            ) : (
              'Total search exposures'
            )}
          </small>
        </div>

        {/* Average Position */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[var(--muted)] flex items-center justify-between mb-1 font-medium">
            <span>Brand Position</span>
            <span className="badge badge-success text-[10px] py-0">Actual GSC</span>
          </span>
          <strong className="text-xl font-bold text-sky-600 dark:text-sky-400 block font-mono">
            {report?.totalBrandedSummary?.averagePosition !== undefined ? report.totalBrandedSummary.averagePosition.toFixed(1) : '…'}
          </strong>
          <small className="text-[var(--muted-light)] block mt-0.5">
            {report?.homepagePerformance?.isRankingNumberOne ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                <CheckCircle className="w-3 h-3" /> Homepage #1
              </span>
            ) : (
              'Avg query rank'
            )}
          </small>
        </div>

        {/* Brand CTR */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[var(--muted)] flex items-center justify-between mb-1 font-medium">
            <span>Brand CTR</span>
            <span className="badge badge-success text-[10px] py-0">Calculated</span>
          </span>
          <strong className="text-xl font-bold text-indigo-600 dark:text-indigo-400 block font-mono">
            {report?.totalBrandedSummary?.ctr !== undefined ? `${(report.totalBrandedSummary.ctr * 100).toFixed(1)}%` : '…'}
          </strong>
          <small className="text-[var(--muted-light)] block mt-0.5">Clicks / impressions</small>
        </div>

        {/* GA4 Organic Sessions */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[var(--muted)] flex items-center justify-between mb-1 font-medium">
            <span>GA4 Organic Sessions</span>
            <span className="badge badge-success text-[10px] py-0">GA4 557864063</span>
          </span>
          <strong className="text-xl font-bold text-emerald-600 dark:text-emerald-400 block">
            {ga4?.totalOrganicSessions !== undefined ? ga4.totalOrganicSessions : '…'}
          </strong>
          <small className="text-[var(--muted-light)] block mt-0.5">
            {ga4?.homepageOrganicSessions !== undefined ? (
              <span className="text-[var(--foreground)] font-medium">
                {ga4.homepageOrganicSessions} ({ga4.homepageShareOfOrganic}% on /)
              </span>
            ) : (
              'Organic search traffic'
            )}
          </small>
        </div>

        {/* Homepage Indexing Status */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[var(--muted)] flex items-center justify-between mb-1 font-medium">
            <span>Homepage Indexing</span>
            <span className="badge badge-success text-[10px] py-0">GSC Inspect</span>
          </span>
          <strong
            className={`text-xl font-bold block ${
              hpInspection?.verdict === 'PASS'
                ? 'text-emerald-600 dark:text-emerald-400'
                : hpInspection?.verdict === 'FAIL'
                ? 'text-rose-600'
                : 'text-amber-600'
            }`}
          >
            {hpInspection?.verdict || 'PENDING'}
          </strong>
          <small className="text-[var(--muted-light)] block mt-0.5 truncate" title={hpInspection?.coverageState}>
            {hpInspection?.coverageState || 'Awaiting inspection'}
          </small>
        </div>
      </div>

      {/* 3. Brand Keyword Variations Tracker Table */}
      <div className="panel space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="eyebrow text-emerald-600 dark:text-emerald-400">SEARCH CONSOLE QUERY TRACKER</span>
            <h4 className="text-sm font-bold text-[var(--foreground)] m-0">FirstRead Brand Query Variations</h4>
            <p className="text-xs text-[var(--muted)] m-0">
              Isolating exact keyword <code className="text-sky-600">&quot;firstread&quot;</code> from broader brand variations using actual Google Search Console query logs.
            </p>
          </div>
          <span className="text-[11px] text-[var(--muted)] font-mono">
            {report?.dateRange?.startDate} → {report?.dateRange?.endDate}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] font-semibold">
              <tr>
                <th className="py-2.5 px-3">Brand Query</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Clicks</th>
                <th className="py-2.5 px-3 text-right">Impressions</th>
                <th className="py-2.5 px-3 text-right">CTR</th>
                <th className="py-2.5 px-3 text-right">Avg Position</th>
                <th className="py-2.5 px-3">Top Landing Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {/* 1. Exact Brand Query */}
              {report?.exactBrand ? (
                <tr className="bg-sky-50/50 dark:bg-sky-950/20 font-medium">
                  <td className="py-2.5 px-3 font-mono font-bold text-sky-700 dark:text-sky-300">
                    {report.exactBrand.query}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="badge badge-success text-[10px]">Exact Brand</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {report.exactBrand.clicks}
                  </td>
                  <td className="py-2.5 px-3 text-right">{report.exactBrand.impressions}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{(report.exactBrand.ctr * 100).toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-600">
                    {report.exactBrand.position.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[var(--muted)] truncate max-w-[200px]">
                    {report.exactBrand.landingPages[0]?.page || '/'}
                  </td>
                </tr>
              ) : (
                <tr className="bg-sky-50/30 dark:bg-sky-950/10">
                  <td className="py-2.5 px-3 font-mono font-bold text-sky-700 dark:text-sky-300">firstread</td>
                  <td className="py-2.5 px-3">
                    <span className="badge badge-success text-[10px]">Exact Brand</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[var(--muted)]">0</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[var(--muted)]">0</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[var(--muted)]">0.0%</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[var(--muted)]">—</td>
                  <td className="py-2.5 px-3 text-[var(--muted-light)] italic">No impressions in 28d window</td>
                </tr>
              )}

              {/* 2. Recognized Variations */}
              {(report?.variations || []).map((v, idx) => (
                <tr key={idx} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="py-2.5 px-3 font-mono font-semibold text-[var(--foreground)]">{v.query}</td>
                  <td className="py-2.5 px-3">
                    <span className="badge text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                      Brand Variation
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{v.clicks}</td>
                  <td className="py-2.5 px-3 text-right">{v.impressions}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{(v.ctr * 100).toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right font-mono">{v.position > 0 ? v.position.toFixed(1) : '—'}</td>
                  <td className="py-2.5 px-3 font-mono text-[var(--muted)] truncate max-w-[200px]">
                    {v.landingPages[0]?.page ? (
                      <span title={v.landingPages[0].page}>{v.landingPages[0].page}</span>
                    ) : (
                      <span className="text-[var(--muted-light)] italic">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* 3. Other Branded Matches */}
              {(report?.otherBrandedQueries || []).map((v, idx) => (
                <tr key={`other-${idx}`} className="hover:bg-[var(--surface)] transition-colors text-[var(--muted)]">
                  <td className="py-2 px-3 font-mono">{v.query}</td>
                  <td className="py-2 px-3">
                    <span className="badge text-[10px] bg-slate-500/10 text-slate-600 dark:text-slate-400">
                      Related Branded
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-medium">{v.clicks}</td>
                  <td className="py-2 px-3 text-right">{v.impressions}</td>
                  <td className="py-2 px-3 text-right font-mono">{(v.ctr * 100).toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right font-mono">{v.position.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono truncate max-w-[200px]">
                    {v.landingPages[0]?.page || '/'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Period Comparison & GA4 Correlation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Period Comparisons (7d vs 28d) */}
        <div className="panel space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="eyebrow text-sky-600 dark:text-sky-400">TREND COMPARISONS</span>
              <h4 className="text-xs font-bold text-[var(--foreground)] m-0">Branded Search Trajectory</h4>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* 7-Day Comparison */}
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
              <span className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-500" /> 7-Day Velocity
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Clicks (7d):</span>
                  <span className="font-bold text-[var(--foreground)]">
                    {report?.comparison7d?.clicks?.current ?? '…'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Prior 7d:</span>
                  <span>{report?.comparison7d?.clicks?.previous ?? '…'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Impressions:</span>
                  <span>{report?.comparison7d?.impressions?.current ?? '…'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Position (7d):</span>
                  <span className="font-mono">{report?.comparison7d?.position?.current?.toFixed(1) ?? '…'}</span>
                </div>
              </div>
            </div>

            {/* 28-Day Comparison */}
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
              <span className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> 28-Day Horizon
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Clicks (28d):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {report?.comparison28d?.clicks?.current ?? '…'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Prior 28d:</span>
                  <span>{report?.comparison28d?.clicks?.previous ?? '…'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Impressions:</span>
                  <span>{report?.comparison28d?.impressions?.current ?? '…'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Position:</span>
                  <span className="font-mono">{report?.comparison28d?.position?.current?.toFixed(1) ?? '…'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GA4 Organic Correlation */}
        <div className="panel space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="eyebrow text-indigo-600 dark:text-indigo-400">GA4 CORRELATION</span>
              <h4 className="text-xs font-bold text-[var(--foreground)] m-0">Branded Organic Traffic Mapping</h4>
            </div>
            <span className="badge badge-success text-[10px]">Property 557864063</span>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--muted)] block">Total Organic</span>
                <strong className="text-base font-bold text-[var(--foreground)]">
                  {ga4?.totalOrganicSessions ?? '…'}
                </strong>
                <small className="text-[10px] text-[var(--muted-light)] block">All organic sessions</small>
              </div>

              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--muted)] block">Homepage (/)</span>
                <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {ga4?.homepageOrganicSessions ?? '…'}
                </strong>
                <small className="text-[10px] text-[var(--muted-light)] block">
                  {ga4?.homepageShareOfOrganic !== undefined ? `${ga4.homepageShareOfOrganic}% of organic` : 'Branded target'}
                </small>
              </div>

              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border)]">
                <span className="text-[11px] text-[var(--muted)] block">GSC Brand Clicks</span>
                <strong className="text-base font-bold text-sky-600 dark:text-sky-400">
                  {ga4?.correlatedGscBrandClicks ?? '…'}
                </strong>
                <small className="text-[10px] text-[var(--muted-light)] block">
                  Ratio: {ga4?.brandToOrganicHomepageRatio !== null && ga4?.brandToOrganicHomepageRatio !== undefined ? `${ga4.brandToOrganicHomepageRatio}x` : '—'}
                </small>
              </div>
            </div>

            <p className="text-[11px] text-[var(--muted)] m-0 leading-relaxed">
              <span className="font-semibold text-[var(--foreground)]">Correlation Analysis:</span> Navigational searches for FirstRead land almost exclusively on the root homepage (<code className="text-sky-600">/</code>). Remaining non-homepage organic sessions ({ga4?.nonHomepageOrganicSessions ?? 0}) reflect non-branded keyword discovery across individual news/lifestyle articles.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Autonomous Indexing Engine & URL Inspections */}
      <div className="panel space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="eyebrow text-sky-600 dark:text-sky-400">GOOGLE SEARCH CONSOLE URL INSPECTION API</span>
            <h4 className="text-sm font-bold text-[var(--foreground)] m-0">Live Indexing &amp; Technical Discovery Status</h4>
          </div>

          {/* Quick Custom URL Inspection Form */}
          <form onSubmit={handleCustomInspect} className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="url"
              placeholder="https://firstread.co.uk/page-slug/"
              value={customInspectUrl}
              onChange={e => setCustomInspectUrl(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] w-full sm:w-64"
            />
            <Button type="submit" size="sm" variant="outline" disabled={inspecting} className="text-xs h-7">
              <Search className="w-3 h-3 mr-1" />
              {inspecting ? 'Inspecting...' : 'Inspect URL'}
            </Button>
          </form>
        </div>

        {/* Priority URL Inspection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {(brandState?.recentInspections || (hpInspection ? [hpInspection] : [])).map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[var(--foreground)] truncate max-w-[140px]" title={item.url}>
                  {item.url === 'https://firstread.co.uk/' ? 'Homepage (/)' : item.url.replace('https://firstread.co.uk', '')}
                </span>
                <span
                  className={`badge ${
                    item.verdict === 'PASS'
                      ? 'badge-success'
                      : item.verdict === 'FAIL'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}
                >
                  {item.verdict}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-[var(--muted)]">
                <div>
                  Coverage: <strong className="text-[var(--foreground)]">{item.coverageState}</strong>
                </div>
                <div>
                  Robots.txt:{' '}
                  <span className={item.robotsTxtState === 'ALLOWED' ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>
                    {item.robotsTxtState}
                  </span>
                </div>
                <div>
                  Canonical Match:{' '}
                  <span className={item.canonicalMatches ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                    {item.canonicalMatches ? 'Aligned' : 'Mismatch/Custom'}
                  </span>
                </div>
                {item.lastCrawlTime && (
                  <div>
                    Last Crawl: <span>{new Date(item.lastCrawlTime).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sitemap & Robots Discovery Box */}
        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-[var(--foreground)]">Sitemap &amp; robots.txt Status</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted)] font-mono">https://firstread.co.uk/sitemap_index.xml</span>
              <span className={`badge ${sitemap?.accessibleOnWeb ? 'badge-success' : 'badge-error'}`}>
                {sitemap?.accessibleOnWeb ? `Accessible (HTTP ${sitemap.httpStatus})` : 'Inaccessible'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-[var(--muted)] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span>Google Search Console Submitted Status:</span>
              <strong className="text-[var(--foreground)]">
                {sitemap?.isSubmittedToGsc ? 'Active & Submitted in GSC' : 'Pending GSC Submission'}
              </strong>
            </div>

            {sitemap?.needsSubmission && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                <span className="font-semibold block mb-0.5">Automated Action Justification:</span>
                {sitemap.submissionJustification}
              </div>
            )}
          </div>
        </div>

        {/* Discovery Issues (if any) */}
        {issues.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5 m-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Active Technical Discovery Issues ({issues.length})
            </h5>
            <div className="space-y-2">
              {issues.map(iss => (
                <div
                  key={iss.id}
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    iss.severity === 'critical'
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : iss.severity === 'warning'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-sky-500/30 bg-sky-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="font-semibold text-[var(--foreground)]">{iss.title}</strong>
                    <span className="font-mono text-[10px] text-[var(--muted)]">{iss.targetUrl}</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] m-0">{iss.description}</p>
                  <div className="text-[11px] text-sky-700 dark:text-sky-300 font-medium pt-0.5">
                    → Recommendation: {iss.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. Execution History Log */}
      <div className="panel space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="eyebrow text-indigo-600 dark:text-indigo-400">AUDIT TRAIL</span>
            <h4 className="text-xs font-bold text-[var(--foreground)] m-0">
              Autonomous Execution History ({history.length} Cycles)
            </h4>
          </div>
          <span className="text-[11px] text-[var(--muted)]">Automated routine actions executed</span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-lg">
            <Activity className="w-6 h-6 text-[var(--muted)] mx-auto mb-2 animate-pulse" />
            No execution cycles recorded yet. Click &quot;Run Cycle Now&quot; to perform initial autonomous discovery.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] font-semibold">
                <tr>
                  <th className="py-2 px-3">Run Timestamp</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Brand Clicks</th>
                  <th className="py-2 px-3 text-right">Brand Imp.</th>
                  <th className="py-2 px-3">Actions Run</th>
                  <th className="py-2 px-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {history.map(exec => {
                  const isExpanded = expandedExecId === exec.id;
                  return (
                    <Fragment key={exec.id}>
                      <tr className="hover:bg-[var(--surface)] transition-colors">
                        <td className="py-2 px-3 font-mono text-[var(--muted)]">
                          {new Date(exec.startedAt).toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-3 font-mono">{exec.durationMs}ms</td>
                        <td className="py-2 px-3">
                          <span
                            className={`badge text-[10px] ${
                              exec.status === 'success'
                                ? 'badge-success'
                                : exec.status === 'warning'
                                ? 'badge-warning'
                                : 'badge-error'
                            }`}
                          >
                            {exec.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {exec.brandClicks}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{exec.brandImpressions}</td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => setExpandedExecId(isExpanded ? null : exec.id)}
                            className="text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1"
                          >
                            {exec.actionsExecuted.length} action(s) {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-[var(--muted)] truncate max-w-[260px]" title={exec.summary}>
                          {exec.summary}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[var(--surface)]/60">
                          <td colSpan={7} className="p-4 border-t border-b border-[var(--border)]">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h5 className="text-xs font-bold text-[var(--foreground)] m-0">
                                  Actions Executed in this Cycle ({exec.actionsExecuted.length})
                                </h5>
                                <div className="flex items-center gap-2">
                                  {exec.storageStatus && (
                                    <span className="text-[10px] font-mono text-[var(--muted)]">
                                      Storage: {exec.storageStatus.branch || 'monitoring-history'} {exec.storageStatus.sha ? `[SHA: ${exec.storageStatus.sha.slice(0, 7)}]` : ''}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => downloadJson(exec, `firstread-cycle-${exec.id}.json`)}
                                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" /> Export Cycle JSON
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {exec.actionsExecuted.map(act => (
                                  <div key={act.id} className="p-2.5 rounded bg-[var(--card)] border border-[var(--border)] text-xs flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`badge text-[9px] py-0 ${act.status === 'success' ? 'badge-success' : act.status === 'skipped' ? 'badge-warning' : 'badge-error'}`}>
                                          {act.status}
                                        </span>
                                        <strong className="font-mono text-[var(--foreground)]">{act.actionType}</strong>
                                        <span className="text-[var(--muted)] truncate max-w-xs">{act.target}</span>
                                      </div>
                                      <span className="text-[10px] text-[var(--muted)] font-mono">{new Date(act.timestamp).toLocaleTimeString('en-GB')}</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--muted)] m-0">{act.details}</p>
                                    {act.error && (
                                      <p className="text-[11px] text-rose-500 m-0 font-mono">{act.error}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
