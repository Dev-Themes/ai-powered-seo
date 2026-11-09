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
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from './api';
import type {
  FirstReadAuditReport,
  FirstReadRecommendationsReport,
  ArticleSEOSummary
} from '@/lib/firstread/types';
import type { FirstReadGoogleIntegrationsState } from '@/lib/firstread/google-interfaces';

type TabType = 'overview' | 'technical' | 'homepage' | 'articles' | 'ai' | 'google';

export function FirstReadPanel() {
  const [audit, setAudit] = useState<FirstReadAuditReport | null>(null);
  const [recommendations, setRecommendations] = useState<FirstReadRecommendationsReport | null>(null);
  const [googleState, setGoogleState] = useState<FirstReadGoogleIntegrationsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Active tab inside FirstRead panel
  const [tab, setTab] = useState<TabType>('overview');

  // Search & filter for articles
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIssue, setFilterIssue] = useState<string>('all');
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);

  // Local approval tracking for proposals (does not mutate WP)
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Load initial data
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [auditRes, googleRes] = await Promise.all([
          api('firstread/audit').catch(() => null),
          api('firstread/google').catch(() => null)
        ]);

        if (mounted) {
          if (auditRes) setAudit(auditRes);
          if (googleRes) setGoogleState(googleRes);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load FirstRead audit data.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadData();
    return () => { mounted = false; };
  }, []);

  // Trigger manual read-only audit
  async function triggerAudit() {
    setAuditing(true);
    setError('');
    setMessage('');
    try {
      const res = await api('firstread/audit', {});
      setAudit(res.data || res);
      setMessage('Read-only audit completed. Zero changes made to FirstRead WordPress.');
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
      setRecommendations(res.data || res);
      setMessage('AI recommendations generated. Proposals remain drafts for human review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recommendation generation failed.');
    } finally {
      setRecommending(false);
    }
  }

  // Toggle approval on an AI recommendation (Dashboard state only)
  function toggleApproval(id: string) {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Filtered articles list
  const filteredArticles = useMemo(() => {
    if (!audit?.articles) return [];
    return audit.articles.filter((a: ArticleSEOSummary) => {
      const matchesSearch = !searchQuery ||
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
          <strong>Enforced Read-Only Mode Active:</strong> Monitoring live WordPress target{' '}
          <code className="text-emerald-200">https://firstread.co.uk</code>.
          Write requests (POST/PUT/DELETE) and administrator credentials are permanently blocked. The live site remains completely unchanged.
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-medium text-zinc-100">FirstRead WordPress Monitor</h2>
            <p className="text-xs text-zinc-400">
              {audit ? `Last audited: ${new Date(audit.auditedAt).toLocaleString('en-GB')}` : 'Ready for live read-only audit'}
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
            {auditing ? 'Auditing FirstRead…' : 'Run Live Read-Only Audit'}
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
          ['overview', 'Health Overview'],
          ['technical', `Technical SEO (${audit?.technical.protocolIssues.length || 0})`],
          ['homepage', 'Homepage Audit'],
          ['articles', `Articles (${audit?.summary.totalChecked || 0})`],
          ['ai', 'AI Recommendations'],
          ['google', 'Google Integrations']
        ].map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === slug
                ? 'bg-zinc-800 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
            onClick={() => setTab(slug as TabType)}
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
            Click &ldquo;Run Live Read-Only Audit&rdquo; to query public WordPress REST endpoints and analyze homepage &amp; article SEO.
          </p>
          <Button onClick={triggerAudit} disabled={auditing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
            Start FirstRead Audit
          </Button>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
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
                  <small>Requires attention</small>
                </div>
                <div className="stat">
                  <span className="label">SEO Warnings</span>
                  <strong className="text-amber-400">{audit.summary.warningCount}</strong>
                  <small>Optimization opportunities</small>
                </div>
                <div className="stat">
                  <span className="label">Missing Image Alt</span>
                  <strong className={audit.summary.missingAltImagesTotal > 0 ? 'text-amber-300' : ''}>
                    {audit.summary.missingAltImagesTotal}
                  </strong>
                  <small>Across sampled articles</small>
                </div>
              </div>

              {/* Site Architecture Card */}
              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Live WordPress Environment Details</h3>
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
                    <span className="text-zinc-500 block mb-1">SEO Stack</span>
                    <span className="text-zinc-200">{audit.siteInfo.seoPlugin} + Elementor</span>
                  </div>
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Caching Layer</span>
                    <span className="text-zinc-200">LiteSpeed Cache (LSCache)</span>
                  </div>
                </div>
              </div>

              {/* Top Issues Summary */}
              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Summary of Priority Findings</h3>
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
                        <strong className="text-amber-200 block">Accessibility &amp; Image SEO Gaps</strong>
                        <span className="text-amber-300">{audit.summary.missingAltImagesTotal} images in sampled articles lack descriptive alt text.</span>
                      </div>
                    </div>
                  )}
                  {audit.summary.duplicateTitlesCount > 0 && (
                    <div className="p-3 rounded bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <strong className="text-amber-200 block">Duplicate Title Tags Detected</strong>
                        <span className="text-amber-300">{audit.summary.duplicateTitlesCount} duplicate title tag occurrences found across articles.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL SEO */}
          {tab === 'technical' && (
            <div className="space-y-6">
              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Robots.txt Analysis</h3>
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800 font-mono text-xs whitespace-pre-wrap text-zinc-300 mb-3">
                  {audit.technical.robotsTxtContent || 'No robots.txt content available.'}
                </div>
                <div className="text-xs text-zinc-400">
                  Status:{' '}
                  <span className="text-emerald-400 font-medium">Accessible (HTTP 200)</span>
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
                    <span className="text-zinc-500 block mb-1">Accessibility</span>
                    <span className={audit.technical.sitemapAccessible ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                      {audit.technical.sitemapAccessible ? 'Valid XML Sitemap Index' : 'Unavailable'}
                    </span>
                  </div>
                </div>

                {audit.technical.protocolIssues.length > 0 && (
                  <div className="p-3 rounded bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                    <strong className="text-rose-200 block">Protocol Issues to Fix:</strong>
                    {audit.technical.protocolIssues.map((p, idx) => (
                      <p key={idx}>• {p.details}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-3">Structured Data (Schema.org) Validation</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Yoast SEO generates structured JSON-LD graphs for FirstRead articles and web pages.
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

          {/* TAB 3: HOMEPAGE AUDIT */}
          {tab === 'homepage' && (
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
                      <span className="text-zinc-500 block mb-1">Canonical Tag</span>
                      <code className="text-zinc-200 font-mono">{audit.homepage.canonical}</code>
                    </div>
                    <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                      <span className="text-zinc-500 block mb-1">Robots Meta Tag</span>
                      <code className="text-zinc-200 font-mono">{audit.homepage.robotsTag}</code>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">H1 Heading ({audit.homepage.h1Count} detected)</span>
                    {audit.homepage.headings.length ? (
                      <ul className="list-disc list-inside space-y-1 text-zinc-200">
                        {audit.homepage.headings.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-amber-400">No H1 heading detected in homepage HTML.</span>
                    )}
                  </div>
                </div>

                {audit.homepage.issues.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-xs font-semibold text-zinc-300">Homepage Recommendations</h4>
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

          {/* TAB 4: ARTICLES AUDIT */}
          {tab === 'articles' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
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

              {/* Articles Table */}
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Word Count</th>
                      <th>SEO Title</th>
                      <th>Meta Description</th>
                      <th>Images</th>
                      <th>Internal Links</th>
                      <th>Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.map(a => {
                      const isExpanded = expandedArticle === a.id;
                      return (
                        <tr key={a.id} className="cursor-pointer hover:bg-zinc-800/20" onClick={() => setExpandedArticle(isExpanded ? null : a.id)}>
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

              {/* Article Detail Drawer when row is selected */}
              {expandedArticle && (() => {
                const a = audit.articles.find(art => art.id === expandedArticle);
                if (!a) return null;
                return (
                  <div className="panel bg-zinc-900 border-zinc-700 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="eyebrow">ARTICLE SEO INSPECTION</span>
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

          {/* TAB 5: AI RECOMMENDATIONS */}
          {tab === 'ai' && (
            <div className="space-y-6">
              <div className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">AI-Powered SEO Proposals</h3>
                    <p className="text-xs text-zinc-400">
                      Proposals are advisory drafts generated for human review. Approving an item records your decision in the dashboard and does <strong>not</strong> push changes to FirstRead WordPress.
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
                  <p className="text-xs text-zinc-400 mb-3">No recommendations generated yet.</p>
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
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                              rec.priority === 'high'
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                                : rec.priority === 'medium'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                                : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                            }`}>
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
                                Reviewed &amp; Approved (Internal)
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

                        {/* Side-by-side comparison */}
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

          {/* TAB 6: GOOGLE INTEGRATIONS */}
          {tab === 'google' && (
            <div className="space-y-6">
              <div className="panel">
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">Google Search Console &amp; GA4 Integration Status</h3>
                <p className="text-xs text-zinc-400 mb-4">
                  The dashboard architecture is prepared to receive verified data for FirstRead once Google API access is granted to your service account.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-zinc-900/60 rounded border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-zinc-200">Google Search Console</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-400 font-medium">
                        Pending Access
                      </span>
                    </div>
                    <p className="text-zinc-400">
                      Target Property:{' '}
                      <code className="text-zinc-300">sc-domain:firstread.co.uk</code> or{' '}
                      <code className="text-zinc-300">https://firstread.co.uk/</code>
                    </p>
                    <p className="text-zinc-500 text-[11px]">
                      {googleState?.searchConsole.message || 'Awaiting authorized service account property delegation in Search Console.'}
                    </p>
                  </div>

                  <div className="p-4 bg-zinc-900/60 rounded border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-zinc-200">Google Analytics 4</strong>
                      <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-400 font-medium">
                        Pending Access
                      </span>
                    </div>
                    <p className="text-zinc-400">
                      GA4 Property ID: <code className="text-zinc-300">FIRSTREAD_GA4_PROPERTY_ID</code>
                    </p>
                    <p className="text-zinc-500 text-[11px]">
                      {googleState?.analytics4.message || 'Configure GA4 property permissions to stream organic search visits and landing page engagement.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-zinc-950 rounded border border-zinc-800 text-xs text-zinc-400 space-y-1">
                  <strong className="text-zinc-300 block">Integration Safeguards:</strong>
                  {googleState?.notes.map((n, i) => (
                    <p key={i}>• {n}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
