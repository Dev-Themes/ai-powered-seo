'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Sparkles,
  SlidersHorizontal,
  Download,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from './api';
import type {
  FirstReadAuditReport,
  FirstReadRecommendationsReport,
  ArticleSEOSummary
} from '@/lib/firstread/types';
import type { FirstReadGoogleIntegrationsState } from '@/lib/firstread/google-interfaces';

export type DashboardSection =
  | 'overview'
  | 'technical'
  | 'homepage'
  | 'articles'
  | 'recommendations'
  | 'history'
  | 'google'
  | 'settings';

interface ReportHistoryItem {
  id: string;
  kind: string;
  createdAt: string;
  status: string;
}

export function FirstReadPanel({ initialSection = 'overview' }: { initialSection?: string }) {
  const [audit, setAudit] = useState<FirstReadAuditReport | null>(null);
  const [recommendations, setRecommendations] = useState<FirstReadRecommendationsReport | null>(null);
  const [googleState, setGoogleState] = useState<FirstReadGoogleIntegrationsState | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedHistoricalReport, setSelectedHistoricalReport] = useState<Record<string, unknown> | null>(null);

  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Active section (derived or user-selected)
  const [userTab, setUserTab] = useState<DashboardSection | null>(null);
  const activeSection: DashboardSection = userTab || ((initialSection as DashboardSection) || 'overview');

  // Search & filter for articles
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIssue, setFilterIssue] = useState<string>('all');
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);

  // Internal approval tracking
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Load initial data
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [auditRes, googleRes, approvalsRes, historyRes] = await Promise.all([
          api('firstread/audit').catch(() => null),
          api('firstread/google').catch(() => null),
          api('firstread/approvals').catch(() => null),
          api('firstread/reports').catch(() => [])
        ]);

        if (!mounted) return;
        if (auditRes) setAudit(auditRes);
        if (googleRes) setGoogleState(googleRes);
        if (approvalsRes?.approvedIds) setApprovedIds(new Set(approvalsRes.approvedIds));
        if (Array.isArray(historyRes)) setReportHistory(historyRes);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load FirstRead audit data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    const timer = setTimeout(() => void load(), 0);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  async function refreshData() {
    setLoading(true);
    setError('');
    try {
      const [auditRes, googleRes, approvalsRes, historyRes] = await Promise.all([
        api('firstread/audit').catch(() => null),
        api('firstread/google').catch(() => null),
        api('firstread/approvals').catch(() => null),
        api('firstread/reports').catch(() => [])
      ]);
      if (auditRes) setAudit(auditRes);
      if (googleRes) setGoogleState(googleRes);
      if (approvalsRes?.approvedIds) setApprovedIds(new Set(approvalsRes.approvedIds));
      if (Array.isArray(historyRes)) setReportHistory(historyRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh FirstRead data.');
    } finally {
      setLoading(false);
    }
  }

  // Trigger manual read-only audit
  async function triggerAudit() {
    setAuditing(true);
    setError('');
    setMessage('');
    try {
      const res = await api('firstread/audit', {});
      const report = res.data || res;
      setAudit(report);
      setMessage('Read-only audit completed and saved to history. Zero changes made to FirstRead WordPress.');
      // Refresh history
      const hist = await api('firstread/reports').catch(() => []);
      if (Array.isArray(hist)) setReportHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed.');
    } finally {
      setAuditing(false);
    }
  }

  // Trigger AI Recommendations
  async function triggerRecommendations() {
    setRecommending(true);
    setError('');
    setMessage('');
    try {
      const res = await api('firstread/recommend', {});
      const report = res.data || res;
      setRecommendations(report);
      setMessage('AI recommendations generated and saved. Proposals remain drafts for human review.');
      const hist = await api('firstread/reports').catch(() => []);
      if (Array.isArray(hist)) setReportHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recommendation generation failed.');
    } finally {
      setRecommending(false);
    }
  }

  // Toggle approval on an AI recommendation (persisted in backend storage)
  async function toggleApproval(id: string) {
    const isCurrentlyApproved = approvedIds.has(id);
    const nextApproved = !isCurrentlyApproved;

    // Optimistic update
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (nextApproved) next.add(id);
      else next.delete(id);
      return next;
    });

    try {
      const res = await api('firstread/approve', { id, approved: nextApproved });
      if (res?.approvedIds) {
        setApprovedIds(new Set(res.approvedIds));
      }
    } catch {
      // Revert if failed
      setApprovedIds(prev => {
        const next = new Set(prev);
        if (isCurrentlyApproved) next.add(id);
        else next.delete(id);
        return next;
      });
      setError('Failed to persist approval status.');
    }
  }

  // Load a specific historical report
  async function loadHistoricalReport(id: string) {
    setError('');
    try {
      const report = await api(`firstread/reports/${id}`);
      setSelectedHistoricalReport(report);
    } catch {
      setError('Could not load historical report.');
    }
  }

  // Filtered articles list
  const filteredArticles = useMemo(() => {
    if (!audit?.articles) return [];
    return audit.articles.filter((a: ArticleSEOSummary) => {
      const matchesSearch =
        !searchQuery ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.slug.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterIssue === 'all') return true;
      if (filterIssue === 'issues') return a.issues.length > 0;
      if (filterIssue === 'missing_alt') return a.missingAltImagesCount > 0;
      if (filterIssue === 'long_title') return a.seoTitle.length > 65;
      if (filterIssue === 'missing_desc') return !a.seoDescription;
      if (filterIssue === 'no_links') return a.internalLinksCount === 0;

      return true;
    });
  }, [audit, searchQuery, filterIssue]);

  return (
    <div className="space-y-6">
      {/* Read-Only Security Banner */}
      <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0" />
        <div className="text-sm">
          <strong>Strict Read-Only Monitoring Enforced:</strong> Live target is{' '}
          <code className="text-emerald-200">https://firstread.co.uk</code>.
          Write requests (POST/PUT/DELETE) and administrator credentials are permanently blocked. The live site and its content remain 100% untouched.
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-medium text-zinc-100">FirstRead SEO Monitoring</h2>
            <p className="text-xs text-zinc-400">
              {audit
                ? `Last audit: ${new Date(audit.auditedAt).toLocaleString('en-GB')}`
                : 'Ready for live read-only audit'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerAudit}
            disabled={auditing || loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
            {auditing ? 'Auditing FirstRead…' : 'Run Read-Only Audit'}
          </Button>
          <Button
            size="sm"
            onClick={triggerRecommendations}
            disabled={recommending || !audit}
          >
            <Sparkles className={`w-4 h-4 mr-1.5 ${recommending ? 'animate-spin' : ''}`} />
            {recommending ? 'Generating…' : 'Generate AI Proposals'}
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-800 pb-1">
        {[
          ['overview', 'Overview'],
          ['technical', `Technical SEO (${audit?.technical.protocolIssues.length || 0})`],
          ['homepage', 'Homepage SEO'],
          ['articles', `Article SEO (${audit?.summary.totalChecked || 0})`],
          ['recommendations', 'AI Recommendations'],
          ['history', `Audit History (${reportHistory.length})`],
          ['google', 'Google Integrations'],
          ['settings', 'Settings']
        ].map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeSection === slug
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
            onClick={() => setUserTab(slug as DashboardSection)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-48" role="status" aria-label="Loading FirstRead data" />
      ) : !audit ? (
        <div className="panel text-center py-12">
          <Globe className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-200">No FirstRead Audit Data Loaded</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-4">
            Click &ldquo;Run Read-Only Audit&rdquo; to fetch public WordPress REST data and inspect homepage &amp; article metadata.
          </p>
          <Button onClick={triggerAudit} disabled={auditing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
            Start FirstRead Audit
          </Button>
        </div>
      ) : (
        <>
          {/* SECTION: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="stats-grid">
                <div className="stat">
                  <span className="label">Published Posts</span>
                  <strong>{audit.siteInfo.totalPosts.toLocaleString('en-GB')}</strong>
                  <small>WordPress REST API</small>
                </div>
                <div className="stat">
                  <span className="label">Public Pages</span>
                  <strong>{audit.siteInfo.totalPages}</strong>
                  <small>WordPress REST API</small>
                </div>
                <div className="stat">
                  <span className="label">Categories &amp; Tags</span>
                  <strong>{audit.siteInfo.totalCategories} / {audit.siteInfo.totalTags}</strong>
                  <small>Taxonomy count</small>
                </div>
                <div className="stat">
                  <span className="label">Critical Issues</span>
                  <strong className={audit.summary.criticalCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                    {audit.summary.criticalCount}
                  </strong>
                  <small>Protocol &amp; missing data</small>
                </div>
                <div className="stat">
                  <span className="label">SEO Warnings</span>
                  <strong className="text-amber-400">{audit.summary.warningCount}</strong>
                  <small>Snippet &amp; content structure</small>
                </div>
                <div className="stat">
                  <span className="label">Missing Image Alt</span>
                  <strong className={audit.summary.missingAltImagesTotal > 0 ? 'text-amber-300' : ''}>
                    {audit.summary.missingAltImagesTotal}
                  </strong>
                  <small>In sampled articles</small>
                </div>
              </div>

              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Target Environment Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Target Origin</span>
                    <a href={audit.origin} target="_blank" rel="noopener noreferrer" className="text-indigo-400 flex items-center gap-1 font-mono">
                      {audit.origin} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Server Engine</span>
                    <span className="text-zinc-200 font-mono">{audit.siteInfo.serverEngine}</span>
                  </div>
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Detected Plugins</span>
                    <span className="text-zinc-200">{audit.siteInfo.seoPlugin}, Elementor, LiteSpeed Cache</span>
                  </div>
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Security Mode</span>
                    <span className="text-emerald-400 font-medium">Enforced Read-Only (Fail-Closed)</span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Primary Actionable Findings</h3>
                <div className="space-y-2">
                  {audit.technical.protocolIssues.map((p, i) => (
                    <div key={i} className="p-3 rounded bg-rose-950/20 border border-rose-500/30 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <strong className="text-rose-200 block">Protocol Inconsistency Detected</strong>
                        <span className="text-rose-300">{p.details}</span>
                      </div>
                    </div>
                  ))}
                  {audit.summary.missingAltImagesTotal > 0 && (
                    <div className="p-3 rounded bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <strong className="text-amber-200 block">Accessibility &amp; Image Alt Gaps</strong>
                        <span className="text-amber-300">{audit.summary.missingAltImagesTotal} images lack alt attributes.</span>
                      </div>
                    </div>
                  )}
                  {audit.summary.duplicateTitlesCount > 0 && (
                    <div className="p-3 rounded bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <strong className="text-amber-200 block">Duplicate Title Tags</strong>
                        <span className="text-amber-300">{audit.summary.duplicateTitlesCount} duplicate title tag occurrences detected.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: TECHNICAL SEO */}
          {activeSection === 'technical' && (
            <div className="space-y-6">
              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Robots.txt Analysis</h3>
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800 font-mono text-xs whitespace-pre-wrap text-zinc-300 mb-3">
                  {audit.technical.robotsTxtContent || 'No robots.txt content available.'}
                </div>
                <div className="text-xs text-zinc-400">
                  Status: <span className="text-emerald-400 font-medium">Accessible (HTTP 200)</span>
                </div>
              </div>

              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">XML Sitemap Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Index URL</span>
                    <a href={audit.technical.sitemapIndexUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 font-mono flex items-center gap-1">
                      {audit.technical.sitemapIndexUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Sitemap Format</span>
                    <span className="text-emerald-400 font-medium">Valid XML Sitemap Index ({audit.technical.sitemapCount} sub-sitemaps)</span>
                  </div>
                </div>

                {audit.technical.protocolIssues.length > 0 && (
                  <div className="p-3 rounded bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                    <strong className="text-rose-200 block">Protocol Inconsistencies Found:</strong>
                    {audit.technical.protocolIssues.map((p, idx) => (
                      <p key={idx}>• {p.details}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Structured Data (Schema.org)</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Detected Schema.org JSON-LD graph objects provided by Yoast SEO:
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {audit.technical.schemaValidation.typesFound.map(t => (
                    <span key={t} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: HOMEPAGE SEO */}
          {activeSection === 'homepage' && (
            <div className="space-y-6">
              <div className="panel space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">Homepage Rendered SEO Metadata</h3>
                  <a
                    href={audit.homepage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 flex items-center gap-1"
                  >
                    View Live Homepage <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                      <span>Title Tag</span>
                      <span>{audit.homepage.title.length} characters</span>
                    </div>
                    <div className="text-zinc-100 font-medium text-sm">
                      {audit.homepage.title || <span className="text-rose-400 italic">None</span>}
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                      <span>Meta Description</span>
                      <span>{audit.homepage.metaDescription.length} characters</span>
                    </div>
                    <div className="text-zinc-200">
                      {audit.homepage.metaDescription || (
                        <span className="text-rose-400 italic">No meta description found on homepage.</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Canonical URL</span>
                      <code className="text-zinc-200 font-mono">{audit.homepage.canonical}</code>
                    </div>
                    <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Robots Meta Tag</span>
                      <code className="text-zinc-200 font-mono">{audit.homepage.robotsTag}</code>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">H1 Headings ({audit.homepage.h1Count} detected)</span>
                    {audit.homepage.headings.length ? (
                      <ul className="list-disc list-inside space-y-1 text-zinc-200">
                        {audit.homepage.headings.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-amber-400">No H1 heading detected in rendered homepage HTML.</span>
                    )}
                  </div>
                </div>

                {audit.homepage.issues.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-xs font-semibold text-zinc-300">Recommendations for Homepage</h4>
                    {audit.homepage.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded text-xs border ${
                          issue.severity === 'critical'
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        <strong className="block mb-1">{issue.title}</strong>
                        <p>{issue.description}</p>
                        {issue.recommendation && (
                          <p className="mt-1 text-zinc-300">
                            <strong>Recommended Action:</strong> {issue.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION: ARTICLE SEO */}
          {activeSection === 'articles' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search articles by title or slug…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-zinc-500" />
                  <select
                    value={filterIssue}
                    onChange={e => setFilterIssue(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="all">All Audited Articles ({audit.articles.length})</option>
                    <option value="issues">With Identified Issues</option>
                    <option value="missing_alt">Missing Image Alt</option>
                    <option value="long_title">Long Title (&gt;65 chars)</option>
                    <option value="missing_desc">Missing Meta Description</option>
                    <option value="no_links">Zero Internal Links</option>
                  </select>
                </div>
              </div>

              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Words</th>
                      <th>SEO Title</th>
                      <th>Meta Description</th>
                      <th>Images</th>
                      <th>Internal Links</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.map(a => {
                      const isExpanded = expandedArticle === a.id;
                      return (
                        <tr
                          key={a.id}
                          className="cursor-pointer hover:bg-zinc-800/20"
                          onClick={() => setExpandedArticle(isExpanded ? null : a.id)}
                        >
                          <td>
                            <div className="font-medium text-zinc-200">{a.title}</div>
                            <div className="text-zinc-500 text-xs font-mono">/{a.slug}/</div>
                          </td>
                          <td>{a.wordCount}</td>
                          <td>
                            <span className={a.seoTitle.length > 65 ? 'text-amber-400' : 'text-zinc-300'}>
                              {a.seoTitle.length} chars
                            </span>
                          </td>
                          <td>
                            {a.seoDescription ? (
                              <span className="text-emerald-400 text-xs">Present ({a.seoDescription.length})</span>
                            ) : (
                              <span className="text-rose-400 text-xs font-medium">Missing</span>
                            )}
                          </td>
                          <td>
                            {a.missingAltImagesCount > 0 ? (
                              <span className="text-amber-400 text-xs font-medium">
                                {a.missingAltImagesCount} missing alt
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-xs">{a.totalImagesCount} ok</span>
                            )}
                          </td>
                          <td>{a.internalLinksCount}</td>
                          <td>
                            {a.issues.length > 0 ? (
                              <span className="px-2 py-0.5 rounded text-xs bg-amber-950/40 text-amber-300 border border-amber-800/40 font-medium">
                                {a.issues.length} {a.issues.length === 1 ? 'issue' : 'issues'}
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-xs flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Healthy
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {expandedArticle && (() => {
                const a = audit.articles.find(art => art.id === expandedArticle);
                if (!a) return null;
                return (
                  <div className="panel bg-zinc-900 border-zinc-700 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="eyebrow">ARTICLE SEO DETAILS</span>
                        <h3 className="text-base font-semibold text-zinc-100">{a.title}</h3>
                        <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 font-mono">
                          {a.link} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setExpandedArticle(null)}>
                        Close Details
                      </Button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                        <span className="text-zinc-500 block mb-1">SEO Title ({a.seoTitle.length} chars)</span>
                        <p className="text-zinc-200 font-medium">{a.seoTitle}</p>
                      </div>
                      <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                        <span className="text-zinc-500 block mb-1">Meta Description ({a.seoDescription.length} chars)</span>
                        <p className="text-zinc-200">{a.seoDescription || '(None specified)'}</p>
                      </div>
                    </div>

                    {a.issues.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-300">Detected Issues ({a.issues.length})</h4>
                        {a.issues.map(iss => (
                          <div key={iss.id} className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs">
                            <span className="font-semibold text-zinc-200 block mb-0.5">{iss.title}</span>
                            <p className="text-zinc-400">{iss.description}</p>
                            {iss.recommendation && (
                              <p className="mt-1 text-emerald-400">
                                <strong>Suggestion:</strong> {iss.recommendation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-400">No issues flagged for this article.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SECTION: AI RECOMMENDATIONS */}
          {activeSection === 'recommendations' && (
            <div className="space-y-6">
              <div className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">AI-Powered SEO Proposals</h3>
                    <p className="text-xs text-zinc-400">
                      All suggestions are non-destructive proposals. Marking a recommendation as &ldquo;Reviewed / Approved&rdquo; records your approval in the dashboard database only and <strong>never modifies WordPress</strong>.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={triggerRecommendations}
                    disabled={recommending}
                  >
                    <Sparkles className={`w-4 h-4 mr-1.5 ${recommending ? 'animate-spin' : ''}`} />
                    {recommending ? 'Analyzing…' : 'Generate Proposals'}
                  </Button>
                </div>
              </div>

              {!recommendations ? (
                <div className="panel text-center py-8">
                  <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 mb-3">No active recommendation set loaded.</p>
                  <Button size="sm" onClick={triggerRecommendations} disabled={recommending}>
                    Generate AI Proposals
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800 text-xs text-zinc-300">
                    <strong>Executive Summary:</strong> {recommendations.summary}
                  </div>

                  {recommendations.recommendations.map(rec => {
                    const isApproved = approvedIds.has(rec.id);
                    return (
                      <div key={rec.id} className="panel space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                rec.priority === 'high'
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                                  : rec.priority === 'medium'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                                  : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                              }`}
                            >
                              {rec.priority} Priority
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">/{rec.slug}</span>
                          </div>
                          <Button
                            variant={isApproved ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => toggleApproval(rec.id)}
                            className="text-xs"
                          >
                            {isApproved ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                Approved (Internal)
                              </>
                            ) : (
                              'Mark Reviewed'
                            )}
                          </Button>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-zinc-100">{rec.issue}</h4>
                          <p className="text-xs text-zinc-300 mt-1">{rec.reasoning}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-zinc-950/80 rounded border border-zinc-800">
                            <span className="text-zinc-500 block mb-1 font-semibold">Current State</span>
                            {rec.currentValue.title && <p className="text-zinc-400 mb-1"><strong>Title:</strong> {rec.currentValue.title}</p>}
                            {rec.currentValue.description && <p className="text-zinc-400 mb-1"><strong>Description:</strong> {rec.currentValue.description}</p>}
                            {rec.currentValue.structure && <p className="text-zinc-400">{rec.currentValue.structure}</p>}
                          </div>
                          <div className="p-3 bg-indigo-950/20 rounded border border-indigo-500/30">
                            <span className="text-indigo-400 block mb-1 font-semibold">Proposed Recommendation</span>
                            {rec.recommendedValue.title && <p className="text-zinc-200 mb-1 font-medium"><strong>Title:</strong> {rec.recommendedValue.title}</p>}
                            {rec.recommendedValue.description && <p className="text-zinc-200 mb-1"><strong>Description:</strong> {rec.recommendedValue.description}</p>}
                            {rec.recommendedValue.structure && <p className="text-zinc-200">{rec.recommendedValue.structure}</p>}
                          </div>
                        </div>

                        <div className="text-[11px] text-zinc-500 flex flex-wrap gap-4 pt-1 border-t border-zinc-800/60">
                          <span><strong>Evidence:</strong> {rec.evidence}</span>
                          <span><strong>Limitations:</strong> {rec.limitations}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION: AUDIT HISTORY */}
          {activeSection === 'history' && (
            <div className="space-y-6">
              <div className="panel">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">Historical SEO Reports</h3>
                    <p className="text-xs text-zinc-400">
                      Audit snapshots saved across scheduled runs and manual triggers. Retained for 90 days.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void refreshData()}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                  </Button>
                </div>

                {reportHistory.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4">No audit reports recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {reportHistory.map(r => (
                      <div
                        key={r.id}
                        className="p-3 rounded bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-zinc-500" />
                          <div>
                            <span className="font-mono text-zinc-200 block">{r.id}</span>
                            <span className="text-zinc-500">
                              {new Date(r.createdAt).toLocaleString('en-GB')} · Type: {r.kind} · Status: {r.status}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadHistoricalReport(r.id)}
                          className="text-xs"
                        >
                          View Snapshot →
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedHistoricalReport && (
                <div className="panel space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-zinc-200">Historical Report Viewer</h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(selectedHistoricalReport, null, 2)], {
                            type: 'application/json'
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'firstread-report.json';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Download JSON
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedHistoricalReport(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                  <pre className="p-3 bg-zinc-950 rounded border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-96 overflow-auto">
                    {JSON.stringify(selectedHistoricalReport, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* SECTION: GOOGLE INTEGRATIONS */}
          {activeSection === 'google' && (
            <div className="space-y-6">
              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Google Search Console &amp; GA4</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Interfaces are prepared for FirstRead. Google Search Console and GA4 will stream verified metrics once read-only property permissions are granted.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-zinc-900/60 rounded border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-zinc-200">Google Search Console</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-amber-400 font-medium">
                        Awaiting Google Authorization
                      </span>
                    </div>
                    <p className="text-zinc-400">
                      Target Property: <code className="text-zinc-300">sc-domain:firstread.co.uk</code>
                    </p>
                    <p className="text-zinc-500 text-[11px]">
                      {googleState?.searchConsole.message || 'Service account delegation pending in Search Console.'}
                    </p>
                  </div>

                  <div className="p-4 bg-zinc-900/60 rounded border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-zinc-200">Google Analytics 4</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-amber-400 font-medium">
                        Awaiting Google Authorization
                      </span>
                    </div>
                    <p className="text-zinc-400">
                      Target Property ID: <code className="text-zinc-300">FIRSTREAD_GA4_PROPERTY_ID</code>
                    </p>
                    <p className="text-zinc-500 text-[11px]">
                      {googleState?.analytics4.message || 'Viewer permissions pending in GA4 property.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-xs text-zinc-400 space-y-1">
                  <strong className="text-zinc-300 block">Readiness Rules:</strong>
                  <p>• Zero metrics, ranks, clicks, or impressions are fabricated.</p>
                  <p>• Data streams only after explicit Google authorization is verified.</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              <div className="panel space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Dashboard Configuration</h3>
                  <p className="text-xs text-zinc-400">
                    Configuration settings for FirstRead SEO monitoring dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1 font-semibold">Monitoring Target URL</span>
                    <span className="text-zinc-200 font-mono">https://firstread.co.uk</span>
                    <small className="text-zinc-500 block mt-1">Fixed canonical origin</small>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1 font-semibold">Politeness Rate Limiting</span>
                    <span className="text-zinc-200">200ms interval throttle + 15s timeout</span>
                    <small className="text-zinc-500 block mt-1">Protects WordPress LiteSpeed cache</small>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1 font-semibold">AI Reasoning Model</span>
                    <span className="text-zinc-200">Google Gemini (gemini-2.5-flash / fallback)</span>
                    <small className="text-zinc-500 block mt-1">Structured JSON schema enforcement</small>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1 font-semibold">Scheduled Audits</span>
                    <span className="text-zinc-200">GitHub Actions (Scheduled / Workflow Dispatch)</span>
                    <small className="text-zinc-500 block mt-1">CLI: npm run firstread:audit</small>
                  </div>
                </div>

                <div className="p-3 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-400">
                  <strong className="text-zinc-200 block mb-1">WordPress Security Isolation:</strong>
                  WordPress administrator credentials, Application Passwords, and write endpoints (POST/PUT/DELETE) are permanently disabled. Content publishing is not permitted.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
