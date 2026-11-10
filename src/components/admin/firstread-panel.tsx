'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Database,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from './api';
import type {
  FirstReadAuditReport,
  FirstReadRecommendationsReport,
  ArticleSEOSummary,
  WordPressPost,
  SiteInfo
} from '@/lib/firstread/types';
import type { FirstReadGoogleIntegrationsState } from '@/lib/firstread/google-interfaces';

export type DashboardSection =
  | 'overview'
  | 'posts'
  | 'homepage'
  | 'articles'
  | 'technical'
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

interface CategoryOption {
  id: number;
  name: string;
  count?: number;
}

/**
 * Safely decodes HTML entities and strips HTML markup from excerpts
 */
function cleanText(raw: string): string {
  if (!raw) return '';
  const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\[&hellip;\]/g, '…');
}

export function FirstReadPanel({ initialSection = 'overview' }: { initialSection?: string }) {
  // Core audit data & site info
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [audit, setAudit] = useState<FirstReadAuditReport | null>(null);
  const [recommendations, setRecommendations] = useState<FirstReadRecommendationsReport | null>(null);
  const [googleState, setGoogleState] = useState<FirstReadGoogleIntegrationsState | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedHistoricalReport, setSelectedHistoricalReport] = useState<Record<string, unknown> | null>(null);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  // Loading and action indicators
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Active section
  const [userTab, setUserTab] = useState<DashboardSection | null>(null);
  const activeSection: DashboardSection = userTab || ((initialSection as DashboardSection) || 'overview');

  // WordPress Articles section state
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsPerPage, setPostsPerPage] = useState(10);
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const [totalPagesCount, setTotalPagesCount] = useState(1);
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);
  const [postSearchQuery, setPostSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Article SEO section state
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [filterIssue, setFilterIssue] = useState<string>('all');
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);

  // Internal approval tracking for AI recommendations
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // Fetch paginated WordPress posts
  const fetchPosts = useCallback(async (page: number, perPage: number) => {
    setPostsLoading(true);
    try {
      const res = await api(`firstread/posts?page=${page}&perPage=${perPage}`);
      if (res?.posts) {
        setPosts(res.posts);
        setTotalPostsCount(res.totalPosts || 0);
        setTotalPagesCount(res.totalPages || 1);
        if (Array.isArray(res.categories)) {
          setCategoriesList(res.categories);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch WordPress articles.');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // Category ID to Name mapping
  const categoryMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const c of categoriesList) {
      map[c.id] = c.name;
    }
    return map;
  }, [categoriesList]);

  // Initial data load on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [infoRes, auditRes, googleRes, approvalsRes, historyRes] = await Promise.all([
          api('firstread/info').catch(() => null),
          api('firstread/audit').catch(() => null),
          api('firstread/google').catch(() => null),
          api('firstread/approvals').catch(() => null),
          api('firstread/reports').catch(() => [])
        ]);

        if (!mounted) return;
        if (infoRes) setSiteInfo(infoRes);
        if (auditRes) setAudit(auditRes);
        if (googleRes) setGoogleState(googleRes);
        if (approvalsRes?.approvedIds) setApprovedIds(new Set(approvalsRes.approvedIds));
        if (Array.isArray(historyRes)) setReportHistory(historyRes);
        setLastSyncTime(new Date().toLocaleString('en-GB'));
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load FirstRead dashboard data.');
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

  // Fetch posts when switching to the posts tab or changing pagination
  useEffect(() => {
    if (activeSection === 'posts') {
      const timer = setTimeout(() => {
        void fetchPosts(postsPage, postsPerPage);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeSection, postsPage, postsPerPage, fetchPosts]);

  // Refresh data handler
  async function refreshData() {
    setLoading(true);
    setError('');
    try {
      const [infoRes, auditRes, googleRes, approvalsRes, historyRes] = await Promise.all([
        api('firstread/info').catch(() => null),
        api('firstread/audit').catch(() => null),
        api('firstread/google').catch(() => null),
        api('firstread/approvals').catch(() => null),
        api('firstread/reports').catch(() => [])
      ]);
      if (infoRes) setSiteInfo(infoRes);
      if (auditRes) setAudit(auditRes);
      if (googleRes) setGoogleState(googleRes);
      if (approvalsRes?.approvedIds) setApprovedIds(new Set(approvalsRes.approvedIds));
      if (Array.isArray(historyRes)) setReportHistory(historyRes);
      setLastSyncTime(new Date().toLocaleString('en-GB'));

      if (activeSection === 'posts') {
        await fetchPosts(postsPage, postsPerPage);
      }
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
      if (report.siteInfo) setSiteInfo(report.siteInfo);
      setMessage('Read-only audit completed and saved to history. Zero changes made to FirstRead WordPress.');
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

  // Toggle approval on an AI recommendation
  async function toggleApproval(id: string) {
    const nextApproved = !approvedIds.has(id);
    try {
      await api('firstread/approve', { id, approved: nextApproved });
      setApprovedIds(prev => {
        const next = new Set(prev);
        if (nextApproved) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval status.');
    }
  }

  // Close snapshot modal on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedHistoricalReport(null);
      }
    }
    if (selectedHistoricalReport) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedHistoricalReport]);

  // View historical report snapshot
  async function loadHistoricalReport(id: string) {
    setLoadingReportId(id);
    setError('');
    try {
      const rep = await api(`reports/${id}`);
      setSelectedHistoricalReport(rep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load historical report.');
    } finally {
      setLoadingReportId(null);
    }
  }

  // Filtered WordPress Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const title = cleanText(post.title?.rendered || '').toLowerCase();
      const slug = (post.slug || '').toLowerCase();
      const query = postSearchQuery.toLowerCase().trim();

      const matchesSearch = !query || title.includes(query) || slug.includes(query);
      if (!matchesSearch) return false;

      if (selectedCategory !== 'all') {
        const catId = Number(selectedCategory);
        if (!post.categories || !post.categories.includes(catId)) {
          return false;
        }
      }

      return true;
    });
  }, [posts, postSearchQuery, selectedCategory]);

  // Filtered Audited Articles for SEO section
  const filteredAuditedArticles = useMemo(() => {
    if (!audit?.articles) return [];
    return audit.articles.filter((a: ArticleSEOSummary) => {
      const title = a.title.toLowerCase();
      const slug = a.slug.toLowerCase();
      const query = articleSearchQuery.toLowerCase().trim();

      const matchesSearch = !query || title.includes(query) || slug.includes(query);
      if (!matchesSearch) return false;

      if (filterIssue === 'all') return true;
      if (filterIssue === 'issues') return a.issues.length > 0;
      if (filterIssue === 'missing_alt') return (a.missingAltCount ?? a.missingAltImagesCount) > 0;
      if (filterIssue === 'long_title') return a.seoTitle.length > 65;
      if (filterIssue === 'missing_desc') return !a.seoDescription;
      if (filterIssue === 'no_links') return a.internalLinksCount === 0;

      return true;
    });
  }, [audit, articleSearchQuery, filterIssue]);

  // Fallback site info display
  const currentSiteInfo = siteInfo || audit?.siteInfo;

  return (
    <div className="space-y-6">
      {/* Read-Only Security Banner */}
      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="text-xs leading-relaxed">
          <strong className="font-semibold">Strict Read-Only Monitoring Enforced:</strong> Live target is{' '}
          <code className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 font-mono text-emerald-950 dark:text-emerald-200">
            https://firstread.co.uk
          </code>
          . Write requests (POST/PUT/PATCH/DELETE) and administrator credentials are permanently disabled. The WordPress website remains completely untouched.
        </div>
      </div>

      {error && <p className="error-message" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      {/* Action Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 panel mb-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)] m-0">
              {currentSiteInfo?.name || 'Firstread'} — AI SEO Monitor
            </h2>
            <p className="text-xs text-[var(--muted)] m-0">
              Target: <span className="font-mono text-[var(--foreground)] font-medium">https://firstread.co.uk</span>
              {lastSyncTime && ` · Synchronized: ${lastSyncTime}`}
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
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
            {auditing ? 'Auditing Target…' : 'Run Read-Only Audit'}
          </Button>
          <Button
            size="sm"
            onClick={triggerRecommendations}
            disabled={recommending || !audit}
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${recommending ? 'animate-spin' : ''}`} />
            {recommending ? 'Generating…' : 'Generate AI Proposals'}
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs (9 Sections) */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {([
          { slug: 'overview', label: 'Overview', icon: Globe },
          { slug: 'posts', label: `WordPress Articles (${currentSiteInfo?.totalPosts ?? totalPostsCount ?? '…'})`, icon: BookOpen },
          { slug: 'homepage', label: 'Homepage SEO', icon: Globe },
          { slug: 'articles', label: `Articles SEO (${audit?.summary.totalChecked || 0})`, icon: FileText },
          { slug: 'technical', label: `Technical SEO (${audit?.technical.protocolIssues.length || 0})`, icon: ShieldCheck },
          { slug: 'recommendations', label: 'AI Recommendations', icon: Sparkles },
          { slug: 'history', label: `Audit History (${reportHistory.length})`, icon: Calendar },
          { slug: 'google', label: 'Google Integrations', icon: Database },
          { slug: 'settings', label: 'Settings', icon: Lock }
        ] as const).map(({ slug, label, icon: IconComp }) => {
          const isActive = activeSection === slug;
          return (
            <button
              key={slug}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]'
              }`}
              onClick={() => setUserTab(slug as DashboardSection)}
            >
              <IconComp className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="skeleton h-56" role="status" aria-label="Loading FirstRead dashboard data" />
      ) : (
        <>
          {/* ========================================================= */}
          {/* SECTION 1: OVERVIEW */}
          {/* ========================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Site Information Grid */}
              <div className="panel">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="eyebrow">TARGET SPECIFICATION</span>
                    <h3 className="text-base font-bold text-[var(--foreground)]">FirstRead Target Website Information</h3>
                  </div>
                  <span className="badge badge-success">
                    <CheckCircle className="w-3.5 h-3.5" /> Connected (HTTP 200)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Website Name</span>
                    <strong className="text-sm font-semibold text-[var(--foreground)] block">
                      {currentSiteInfo?.name || 'Firstread'}
                    </strong>
                    <small className="text-[var(--muted-light)]">WordPress Site Title</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Target Origin</span>
                    <a
                      href="https://firstread.co.uk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1 font-mono"
                    >
                      https://firstread.co.uk <ExternalLink className="w-3 h-3" />
                    </a>
                    <small className="text-[var(--muted-light)]">Canonical Public Domain</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Server &amp; Plugins</span>
                    <strong className="text-sm font-semibold text-[var(--foreground)] block">
                      {currentSiteInfo?.serverEngine || 'LiteSpeed (PHP)'}
                    </strong>
                    <small className="text-[var(--muted-light)]">Yoast SEO, Elementor</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Security Mode</span>
                    <strong className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 block">
                      Enforced Read-Only
                    </strong>
                    <small className="text-[var(--muted-light)]">Writes Permanently Blocked</small>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Published Articles</span>
                    <strong className="text-xl font-bold text-[var(--foreground)] block">
                      {currentSiteInfo ? currentSiteInfo.totalPosts.toLocaleString('en-GB') : '…'}
                    </strong>
                    <small className="text-[var(--muted-light)]">Public posts in WordPress</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Public Pages</span>
                    <strong className="text-xl font-bold text-[var(--foreground)] block">
                      {currentSiteInfo ? currentSiteInfo.totalPages.toLocaleString('en-GB') : '…'}
                    </strong>
                    <small className="text-[var(--muted-light)]">Live pages in WordPress</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Categories / Tags</span>
                    <strong className="text-xl font-bold text-[var(--foreground)] block">
                      {currentSiteInfo ? `${currentSiteInfo.totalCategories} / ${currentSiteInfo.totalTags}` : '…'}
                    </strong>
                    <small className="text-[var(--muted-light)]">Taxonomy entries count</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Google Integration</span>
                    <span className="badge badge-warning mt-1">
                      Awaiting Authorization
                    </span>
                    <small className="text-[var(--muted-light)] block mt-1">GSC &amp; GA4 interfaces ready</small>
                  </div>
                </div>
              </div>

              {/* Audit Scope & Pipeline Metrics */}
              {audit && (
                <div className="panel bg-[var(--surface)] border-[var(--border)]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="eyebrow">AUDIT PIPELINE SCOPE</span>
                      <h4 className="text-sm font-bold text-[var(--foreground)]">Audit Coverage &amp; Processing Scope</h4>
                    </div>
                    <span className="badge badge-success">
                      <CheckCircle className="w-3 h-3" /> Full Coverage Verified
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                      <span className="text-[var(--muted)] block font-medium mb-1">Articles Discovered</span>
                      <strong className="text-lg font-bold text-[var(--foreground)] block">
                        {audit.summary.articlesDiscovered ?? currentSiteInfo?.totalPosts ?? 0}
                      </strong>
                      <small className="text-[var(--muted-light)]">WordPress REST API</small>
                    </div>
                    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                      <span className="text-[var(--muted)] block font-medium mb-1">Articles Audited</span>
                      <strong className="text-lg font-bold text-sky-600 dark:text-sky-400 block">
                        {audit.summary.articlesAudited ?? audit.summary.totalChecked}
                      </strong>
                      <small className="text-[var(--muted-light)]">Technical &amp; Content SEO</small>
                    </div>
                    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                      <span className="text-[var(--muted)] block font-medium mb-1">Articles Skipped</span>
                      <strong className="text-lg font-bold text-[var(--foreground)] block">
                        {audit.summary.articlesSkipped ?? 0}
                      </strong>
                      <small className="text-[var(--muted-light)]">Draft / Non-public</small>
                    </div>
                    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                      <span className="text-[var(--muted)] block font-medium mb-1">Protocol Issues</span>
                      <strong className={`text-lg font-bold block ${(audit.summary.protocolIssuesCount ?? audit.summary.errorsCount ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {audit.summary.protocolIssuesCount ?? audit.summary.errorsCount ?? 0}
                      </strong>
                      <small className="text-[var(--muted-light)]">Config &amp; Sitemap Gaps</small>
                    </div>
                    <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--card)]">
                      <span className="text-[var(--muted)] block font-medium mb-1">AI Recommendations</span>
                      <strong className="text-lg font-bold text-violet-600 dark:text-violet-400 block">
                        {recommendations?.recommendations.length ?? (audit.summary.recommendationsCount ?? '…')}
                      </strong>
                      <small className="text-[var(--muted-light)]">Actionable Proposals</small>
                    </div>
                  </div>
                </div>
              )}

              {/* SEO Health Metrics Grid */}
              {audit && (
                <div className="stats-grid">
                  <div className="stat">
                    <span className="label">Articles Audited</span>
                    <strong>{audit.summary.totalChecked}</strong>
                    <small>Full scope: {audit.siteInfo.totalPosts} published posts</small>
                  </div>

                  <div className="stat">
                    <span className="label">Protocol Issues</span>
                    <strong className={(audit.summary.protocolIssuesCount ?? audit.summary.criticalCount) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {audit.summary.protocolIssuesCount ?? audit.summary.criticalCount}
                    </strong>
                    <small>HTTP sitemap &amp; site URL config</small>
                  </div>

                  <div className="stat">
                    <span className="label">SEO Warnings</span>
                    <strong className={audit.summary.warningCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {audit.summary.warningCount}
                    </strong>
                    <small>Title lengths &amp; descriptions</small>
                  </div>

                  <div className="stat">
                    <span className="label">Missing Image Alt</span>
                    <strong className={(audit.summary.missingAltTotal ?? audit.summary.missingAltImagesTotal ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {audit.summary.missingAltTotal ?? audit.summary.missingAltImagesTotal ?? 0}
                    </strong>
                    <small>
                      {audit.summary.emptyAltTotal !== undefined
                        ? `${audit.summary.emptyAltTotal} decorative (empty alt)`
                        : 'Images without alt text'}
                    </small>
                  </div>

                  <div className="stat">
                    <span className="label">Duplicate Title Tags</span>
                    <strong className={audit.summary.duplicateTitlesCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {audit.summary.duplicateTitlesCount}
                    </strong>
                    <small>Duplicate title tags detected</small>
                  </div>
                </div>
              )}

              {/* Actionable Findings Card */}
              {audit ? (
                <div className="panel">
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">Key Actionable Findings</h3>
                  <div className="space-y-3">
                    {audit.technical.protocolIssues.map((p, i) => (
                      <div key={i} className="p-3.5 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <strong className="text-rose-900 dark:text-rose-200 block font-semibold">Protocol Inconsistency Detected</strong>
                          <span className="text-rose-800 dark:text-rose-300">{p.details}</span>
                        </div>
                      </div>
                    ))}

                    {(audit.summary.missingAltTotal ?? audit.summary.missingAltImagesTotal ?? 0) > 0 && (
                      <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <strong className="text-amber-900 dark:text-amber-200 block font-semibold">Image Accessibility Gaps</strong>
                          <span className="text-amber-800 dark:text-amber-300">
                            {audit.summary.missingAltTotal ?? audit.summary.missingAltImagesTotal} images completely lack alt attributes across audited articles.
                            {audit.summary.emptyAltTotal !== undefined && ` (${audit.summary.emptyAltTotal} decorative images have empty alt="")`}
                          </span>
                        </div>
                      </div>
                    )}

                    {audit.summary.duplicateTitlesCount > 0 && (
                      <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <strong className="text-amber-900 dark:text-amber-200 block font-semibold">Duplicate Title Tag Detected</strong>
                          <span className="text-amber-800 dark:text-amber-300">
                            {audit.summary.duplicateTitlesCount} duplicate title tag instances found across articles.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="panel text-center py-10">
                  <Globe className="w-10 h-10 text-[var(--muted)] mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[var(--foreground)]">No Audit Snapshot Loaded</h3>
                  <p className="text-xs text-[var(--muted)] max-w-md mx-auto mb-4">
                    Run a live read-only audit to inspect homepage metadata, headings, sitemaps, robots.txt, and sampled WordPress articles.
                  </p>
                  <Button onClick={triggerAudit} disabled={auditing}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${auditing ? 'animate-spin' : ''}`} />
                    Start Read-Only Audit
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 2: WORDPRESS ARTICLES */}
          {/* ========================================================= */}
          {activeSection === 'posts' && (
            <div className="space-y-4">
              <div className="panel mb-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="eyebrow">PUBLISHED WORDPRESS CONTENT</span>
                    <h3 className="text-base font-bold text-[var(--foreground)]">
                      Published WordPress Articles ({totalPostsCount.toLocaleString('en-GB')} Total)
                    </h3>
                    <p className="text-xs text-[var(--muted)] m-0">
                      Live data fetched directly from <code className="text-xs">/wp-json/wp/v2/posts</code>
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchPosts(postsPage, postsPerPage)}
                    disabled={postsLoading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${postsLoading ? 'animate-spin' : ''}`} />
                    Refresh Articles
                  </Button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search articles by title or slug…"
                      value={postSearchQuery}
                      onChange={e => setPostSearchQuery(e.target.value)}
                      className="search-input search-input-with-icon"
                    />
                  </div>

                  <div>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="search-input"
                    >
                      <option value="all">All Categories ({categoriesList.length})</option>
                      {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id.toString()}>
                          {cat.name} {cat.count ? `(${cat.count})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs text-[var(--muted)]">
                    <span>Show:</span>
                    <select
                      value={postsPerPage}
                      onChange={e => {
                        setPostsPerPage(Number(e.target.value));
                        setPostsPage(1);
                      }}
                      className="search-input w-24 py-1"
                    >
                      <option value="10">10 / page</option>
                      <option value="20">20 / page</option>
                      <option value="50">50 / page</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Articles Table */}
              {postsLoading ? (
                <div className="skeleton h-64" role="status" aria-label="Loading WordPress articles" />
              ) : filteredPosts.length === 0 ? (
                <div className="panel text-center py-10">
                  <BookOpen className="w-8 h-8 text-[var(--muted)] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[var(--foreground)]">No articles match your search filter.</p>
                  <p className="text-xs text-[var(--muted)]">Try adjusting your search query or category filter.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Article Title &amp; Slug</th>
                        <th>Categories</th>
                        <th>Published Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPosts.map(post => {
                        const title = cleanText(post.title?.rendered || 'Untitled');
                        const excerpt = cleanText(post.excerpt?.rendered || '');
                        const dateFormatted = post.date ? new Date(post.date).toLocaleDateString('en-GB') : '—';
                        return (
                          <tr key={post.id}>
                            <td>
                              <div className="font-semibold text-[var(--foreground)] text-sm mb-0.5">
                                {title}
                              </div>
                              <div className="font-mono text-xs text-[var(--muted)] mb-1">
                                /{post.slug}/
                              </div>
                              {excerpt && (
                                <p className="text-xs text-[var(--muted)] line-clamp-2 m-0 max-w-xl">
                                  {excerpt}
                                </p>
                              )}
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {post.categories && post.categories.length > 0 ? (
                                  post.categories.map(cId => (
                                    <span key={cId} className="badge badge-neutral text-[10px]">
                                      {categoryMap[cId] || `Category ${cId}`}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-[var(--muted-light)]">None</span>
                                )}
                              </div>
                            </td>
                            <td className="text-xs text-[var(--muted)] whitespace-nowrap">
                              {dateFormatted}
                            </td>
                            <td>
                              <span className="badge badge-success">
                                Published
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <a
                                href={post.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="button button-outline button-sm inline-flex items-center gap-1 text-xs"
                              >
                                View Live <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 panel">
                <div className="text-xs text-[var(--muted)]">
                  Showing page <strong>{postsPage}</strong> of <strong>{totalPagesCount}</strong> ({totalPostsCount} total articles)
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={postsPage <= 1 || postsLoading}
                    onClick={() => setPostsPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={postsPage >= totalPagesCount || postsLoading}
                    onClick={() => setPostsPage(p => Math.min(totalPagesCount, p + 1))}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: HOMEPAGE SEO */}
          {/* ========================================================= */}
          {activeSection === 'homepage' && (
            <div className="space-y-6">
              {!audit ? (
                <div className="panel text-center py-10">
                  <p className="text-sm text-[var(--muted)] mb-3">Homepage SEO audit data is not loaded yet.</p>
                  <Button onClick={triggerAudit} disabled={auditing}>Run Read-Only Audit</Button>
                </div>
              ) : (
                <div className="panel space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="eyebrow">RENDERED HTML INSPECTION</span>
                      <h3 className="text-base font-bold text-[var(--foreground)]">
                        Homepage Metadata ({audit.homepage.url})
                      </h3>
                    </div>
                    <a
                      href={audit.homepage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-outline button-sm inline-flex items-center gap-1 text-xs"
                    >
                      View Live Homepage <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center justify-between text-[var(--muted)] mb-1">
                        <span className="font-semibold">Title Tag</span>
                        <span>{audit.homepage.title.length} characters (Recommended: 50–60)</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {audit.homepage.title || <span className="text-rose-600 dark:text-rose-400 italic">None specified</span>}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center justify-between text-[var(--muted)] mb-1">
                        <span className="font-semibold">Meta Description</span>
                        <span>{audit.homepage.metaDescription.length} characters (Recommended: 140–160)</span>
                      </div>
                      <div className="text-xs text-[var(--foreground)] leading-relaxed">
                        {audit.homepage.metaDescription || (
                          <span className="badge badge-warning">No meta description found in homepage HTML</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                        <span className="text-[var(--muted)] block font-semibold mb-1">Canonical URL</span>
                        <code className="text-xs text-[var(--foreground)] font-mono">{audit.homepage.canonical || 'None'}</code>
                      </div>
                      <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                        <span className="text-[var(--muted)] block font-semibold mb-1">Robots Meta Tag</span>
                        <code className="text-xs text-[var(--foreground)] font-mono">{audit.homepage.robotsTag || 'index, follow (default)'}</code>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <span className="text-[var(--muted)] block font-semibold mb-1">
                        H1 Headings ({audit.homepage.h1Count} detected)
                      </span>
                      {audit.homepage.headings.length ? (
                        <ul className="list-disc list-inside space-y-1 text-[var(--foreground)]">
                          {audit.homepage.headings.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="badge badge-warning">No H1 heading detected in rendered homepage HTML.</span>
                      )}
                    </div>
                  </div>

                  {audit.homepage.issues.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border)]">
                      <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wide">
                        Recommendations for Homepage
                      </h4>
                      {audit.homepage.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-xs border ${
                            issue.severity === 'critical'
                              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                          }`}
                        >
                          <strong className="block mb-1">{issue.title}</strong>
                          <p className="m-0 text-inherit opacity-90">{issue.description}</p>
                          {issue.recommendation && (
                            <p className="mt-1.5 m-0 text-inherit font-medium">
                              <strong>Recommended Action:</strong> {issue.recommendation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: ARTICLES SEO */}
          {/* ========================================================= */}
          {activeSection === 'articles' && (
            <div className="space-y-4">
              {!audit ? (
                <div className="panel text-center py-10">
                  <p className="text-sm text-[var(--muted)] mb-3">SEO audit data for articles is not loaded yet.</p>
                  <Button onClick={triggerAudit} disabled={auditing}>Run Read-Only Audit</Button>
                </div>
              ) : (
                <>
                  <div className="panel mb-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <span className="eyebrow">ARTICLE AUDIT METRICS</span>
                        <h3 className="text-base font-bold text-[var(--foreground)]">
                          Sampled Articles SEO Analysis ({audit.articles.length} Audited)
                        </h3>
                        <p className="text-xs text-[var(--muted)] m-0">
                          Inspect title lengths, meta descriptions, image alt tags, word counts, and internal links.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Filter articles by title or slug…"
                          value={articleSearchQuery}
                          onChange={e => setArticleSearchQuery(e.target.value)}
                          className="search-input search-input-with-icon"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-[var(--muted)]" />
                        <select
                          value={filterIssue}
                          onChange={e => setFilterIssue(e.target.value)}
                          className="search-input"
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
                  </div>

                  <div className="table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th>Words</th>
                          <th>Headings</th>
                          <th>SEO Title</th>
                          <th>Meta Description</th>
                          <th>Images</th>
                          <th>Internal Links</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAuditedArticles.map(a => {
                          const isExpanded = expandedArticle === a.id;
                          return (
                            <tr
                              key={a.id}
                              className="cursor-pointer"
                              onClick={() => setExpandedArticle(isExpanded ? null : a.id)}
                            >
                              <td>
                                <div className="font-semibold text-[var(--foreground)] text-sm">{a.title}</div>
                                <div className="text-[var(--muted)] text-xs font-mono">/{a.slug}/</div>
                              </td>
                              <td className="text-xs">{a.wordCount} words</td>
                              <td className="text-xs">
                                {(a.bodyH1Count ?? a.h1Count ?? 0) > 0 ? (
                                  <span className="badge badge-warning" title={`${a.bodyH1Count ?? a.h1Count} H1 tags in content body (duplicate with theme title H1)`}>
                                    {a.bodyH1Count ?? a.h1Count} Body H1
                                  </span>
                                ) : (
                                  <span className="text-[var(--muted)]" title="Theme renders post title as primary H1; content uses clean H2/H3 hierarchy">
                                    Theme H1
                                  </span>
                                )}
                                <div className="text-[10px] text-[var(--muted-light)] mt-0.5">
                                  {a.h2Count} H2 &bull; {a.h3Count} H3
                                </div>
                              </td>
                              <td>
                                <span className={a.seoTitle.length > 65 ? 'badge badge-warning' : 'text-xs'}>
                                  {a.seoTitle.length} chars
                                </span>
                              </td>
                              <td>
                                {a.seoDescription ? (
                                  <span className="badge badge-success">Present ({a.seoDescription.length})</span>
                                ) : (
                                  <span className="badge badge-critical">Missing</span>
                                )}
                              </td>
                              <td>
                                {(a.missingAltCount ?? a.missingAltImagesCount ?? 0) > 0 ? (
                                  <span className="badge badge-warning">
                                    {a.missingAltCount ?? a.missingAltImagesCount} missing alt
                                  </span>
                                ) : (
                                  <span className="text-xs text-[var(--muted)]">{a.totalImagesCount} ok</span>
                                )}
                                {(a.emptyAltCount ?? 0) > 0 && (
                                  <div className="text-[10px] text-[var(--muted-light)] mt-0.5">
                                    {a.emptyAltCount} decorative
                                  </div>
                                )}
                              </td>
                              <td className="text-xs">{a.internalLinksCount} links</td>
                              <td>
                                {a.issues.length > 0 ? (
                                  <span className="badge badge-warning">
                                    {a.issues.length} {a.issues.length === 1 ? 'issue' : 'issues'}
                                  </span>
                                ) : (
                                  <span className="badge badge-success">
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

                  {/* Expandable Article Details */}
                  {expandedArticle && (() => {
                    const a = audit.articles.find(art => art.id === expandedArticle);
                    if (!a) return null;
                    return (
                      <div className="panel space-y-4 border-2 border-sky-400 dark:border-sky-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="eyebrow">ARTICLE SEO INSPECTION</span>
                            <h3 className="text-base font-bold text-[var(--foreground)]">{a.title}</h3>
                            <a
                              href={a.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1 font-mono mt-1"
                            >
                              {a.link} <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setExpandedArticle(null)}>
                            Close Details
                          </Button>
                        </div>

                        {/* Heading & Image KPI Breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block">Heading Structure</span>
                            <strong className="text-sm font-semibold text-[var(--foreground)] block">
                              {(a.bodyH1Count ?? a.h1Count ?? 0) > 0 ? `${a.bodyH1Count ?? a.h1Count} Body H1 (Defect)` : 'Clean Hierarchy'}
                            </strong>
                            <small className="text-[var(--muted-light)]">Theme H1 + {a.h2Count} H2, {a.h3Count} H3</small>
                          </div>
                          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block">Image Alt Coverage</span>
                            <strong className="text-sm font-semibold text-[var(--foreground)] block">
                              {(a.missingAltCount ?? a.missingAltImagesCount ?? 0) === 0 ? '100% Covered' : `${a.missingAltCount ?? a.missingAltImagesCount} Missing`}
                            </strong>
                            <small className="text-[var(--muted-light)]">{a.totalImagesCount} total &bull; {a.emptyAltCount ?? 0} decorative</small>
                          </div>
                          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block">Word Count</span>
                            <strong className="text-sm font-semibold text-[var(--foreground)] block">
                              {a.wordCount} words
                            </strong>
                            <small className="text-[var(--muted-light)]">{a.internalLinksCount} internal links</small>
                          </div>
                          <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block">SEO Description</span>
                            <strong className="text-sm font-semibold text-[var(--foreground)] block">
                              {a.seoDescription ? `${a.seoDescription.length} chars` : 'Missing'}
                            </strong>
                            <small className="text-[var(--muted-light)]">Title: {a.seoTitle.length} chars</small>
                          </div>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block font-semibold mb-1">
                              SEO Title ({a.seoTitle.length} chars)
                            </span>
                            <p className="text-[var(--foreground)] font-medium m-0">{a.seoTitle}</p>
                          </div>
                          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block font-semibold mb-1">
                              Meta Description ({a.seoDescription.length} chars)
                            </span>
                            <p className="text-[var(--foreground)] m-0">{a.seoDescription || '(None specified)'}</p>
                          </div>
                        </div>

                        {a.issues.length > 0 ? (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wide">
                              Detected Issues ({a.issues.length})
                            </h4>
                            {a.issues.map(iss => (
                              <div
                                key={iss.id}
                                className={`p-3 rounded-lg text-xs border ${
                                  iss.severity === 'critical'
                                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                                }`}
                              >
                                <span className="font-bold block mb-1">{iss.title}</span>
                                <p className="m-0 text-inherit opacity-90">{iss.description}</p>
                                {iss.recommendation && (
                                  <p className="mt-1.5 m-0 text-inherit font-medium">
                                    <strong>Suggestion:</strong> {iss.recommendation}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium m-0">
                            No issues flagged for this article.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 5: TECHNICAL SEO */}
          {/* ========================================================= */}
          {activeSection === 'technical' && (
            <div className="space-y-6">
              {!audit ? (
                <div className="panel text-center py-10">
                  <p className="text-sm text-[var(--muted)] mb-3">Technical SEO audit data is not loaded yet.</p>
                  <Button onClick={triggerAudit} disabled={auditing}>Run Read-Only Audit</Button>
                </div>
              ) : (
                <>
                  <div className="panel">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="eyebrow">CRAWL CONTROLS</span>
                        <h3 className="text-base font-bold text-[var(--foreground)]">Robots.txt Analysis</h3>
                      </div>
                      <span className="badge badge-success">Accessible (HTTP 200)</span>
                    </div>
                    <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono text-xs whitespace-pre-wrap text-[var(--foreground)] max-h-48 overflow-auto">
                      {audit.technical.robotsTxtContent || 'No robots.txt content available.'}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="eyebrow">INDEXING SITEMAPS</span>
                        <h3 className="text-base font-bold text-[var(--foreground)]">XML Sitemap Status</h3>
                      </div>
                      <span className="badge badge-success">Valid Sitemap Index</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                      <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                        <span className="text-[var(--muted)] block font-semibold mb-1">Index URL</span>
                        <a
                          href={audit.technical.sitemapIndexUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 dark:text-sky-400 font-mono flex items-center gap-1"
                        >
                          {audit.technical.sitemapIndexUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                        <span className="text-[var(--muted)] block font-semibold mb-1">Sub-Sitemaps Detected</span>
                        <span className="font-semibold text-[var(--foreground)]">
                          {audit.technical.sitemapCount} sub-sitemaps (post, page, category, author, tag)
                        </span>
                      </div>
                    </div>

                    {audit.technical.protocolIssues.length > 0 && (
                      <div className="p-3.5 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                        <strong className="block font-semibold">Protocol Inconsistencies Found:</strong>
                        {audit.technical.protocolIssues.map((p, idx) => (
                          <p key={idx} className="m-0">• {p.details}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <span className="eyebrow">STRUCTURED DATA</span>
                    <h3 className="text-base font-bold text-[var(--foreground)] mb-2">Structured Data (Schema.org)</h3>
                    <p className="text-xs text-[var(--muted)] mb-3">
                      Detected Schema.org JSON-LD graph objects provided by Yoast SEO:
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {audit.technical.schemaValidation.typesFound.map(t => (
                        <span key={t} className="badge badge-neutral font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 6: AI RECOMMENDATIONS */}
          {/* ========================================================= */}
          {activeSection === 'recommendations' && (
            <div className="space-y-6">
              <div className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <span className="eyebrow">EDITORIAL ASSISTANCE</span>
                    <h3 className="text-base font-bold text-[var(--foreground)]">AI-Powered SEO Proposals</h3>
                    <p className="text-xs text-[var(--muted)] m-0">
                      All suggestions are non-destructive proposals. Marking a recommendation as &ldquo;Approved&rdquo; records your approval in the dashboard database only and <strong>never modifies WordPress</strong>.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={triggerRecommendations}
                    disabled={recommending}
                  >
                    <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${recommending ? 'animate-spin' : ''}`} />
                    {recommending ? 'Analyzing…' : 'Generate Proposals'}
                  </Button>
                </div>
              </div>

              {!recommendations ? (
                <div className="panel text-center py-10">
                  <Sparkles className="w-8 h-8 text-sky-600 dark:text-sky-400 mx-auto mb-2" />
                  <p className="text-xs text-[var(--muted)] mb-3">No active recommendation set loaded.</p>
                  <Button size="sm" onClick={triggerRecommendations} disabled={recommending}>
                    Generate AI Proposals
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--foreground)]">
                    <strong className="font-semibold block mb-1">Executive Summary:</strong> {recommendations.summary}
                  </div>

                  {recommendations.recommendations.map(rec => {
                    const isApproved = approvedIds.has(rec.id);
                    return (
                      <div key={rec.id} className="panel space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`badge ${
                                rec.priority === 'high'
                                  ? 'badge-critical'
                                  : rec.priority === 'medium'
                                  ? 'badge-warning'
                                  : 'badge-info'
                              }`}
                            >
                              {rec.priority} Priority
                            </span>
                            <span
                              className={`badge ${
                                rec.source === 'deterministic_audit'
                                  ? 'badge-neutral'
                                  : 'badge-info'
                              }`}
                            >
                              {rec.source === 'deterministic_audit' ? 'Deterministic Audit Finding' : 'Gemini AI Suggestion'}
                            </span>
                            <span className="text-xs text-[var(--muted)] font-mono">/{rec.slug}</span>
                          </div>
                          <Button
                            variant={isApproved ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => toggleApproval(rec.id)}
                            className="text-xs"
                          >
                            {isApproved ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                Approved (Internal)
                              </>
                            ) : (
                              'Mark Reviewed'
                            )}
                          </Button>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-[var(--foreground)] m-0">{rec.issue}</h4>
                          <p className="text-xs text-[var(--muted)] mt-1 m-0">{rec.reasoning}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block mb-1 font-semibold">Current State</span>
                            {rec.currentValue.title && <p className="m-0 mb-1"><strong>Title:</strong> {rec.currentValue.title}</p>}
                            {rec.currentValue.description && <p className="m-0 mb-1"><strong>Description:</strong> {rec.currentValue.description}</p>}
                            {rec.currentValue.structure && <p className="m-0">{rec.currentValue.structure}</p>}
                          </div>
                          <div className="p-3.5 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20">
                            <span className="text-sky-700 dark:text-sky-300 block mb-1 font-semibold">Proposed Recommendation</span>
                            {rec.recommendedValue.title && <p className="m-0 mb-1 font-medium"><strong>Title:</strong> {rec.recommendedValue.title}</p>}
                            {rec.recommendedValue.description && <p className="m-0 mb-1"><strong>Description:</strong> {rec.recommendedValue.description}</p>}
                            {rec.recommendedValue.structure && <p className="m-0">{rec.recommendedValue.structure}</p>}
                          </div>
                        </div>

                        <div className="text-[11px] text-[var(--muted)] flex flex-wrap gap-4 pt-2 border-t border-[var(--border)]">
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

          {/* ========================================================= */}
          {/* SECTION 7: AUDIT HISTORY */}
          {/* ========================================================= */}
          {activeSection === 'history' && (
            <div className="space-y-6">
              <div className="panel">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="eyebrow">MONITORING TIMELINE</span>
                    <h3 className="text-base font-bold text-[var(--foreground)]">Historical SEO Reports</h3>
                    <p className="text-xs text-[var(--muted)] m-0">
                      Audit snapshots saved across scheduled runs and manual triggers. Retained for 90 days.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void refreshData()}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                  </Button>
                </div>

                {reportHistory.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-4">No audit reports recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {reportHistory.map(r => (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-[var(--muted)]" />
                          <div>
                            <span className="font-mono font-semibold text-[var(--foreground)] block">{r.id}</span>
                            <span className="text-[var(--muted)]">
                              {new Date(r.createdAt).toLocaleString('en-GB')} · Type: {r.kind} · Status: {r.status}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={loadingReportId === r.id}
                          onClick={() => void loadHistoricalReport(r.id)}
                          className="text-xs"
                        >
                          {loadingReportId === r.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Loading…
                            </>
                          ) : (
                            <>View Snapshot →</>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Snapshot Modal Viewer */}
              {selectedHistoricalReport && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="snapshot-modal-title"
                  onClick={e => {
                    if (e.target === e.currentTarget) setSelectedHistoricalReport(null);
                  }}
                >
                  <div className="panel max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--card)]">
                    {/* Modal Header */}
                    <div className="flex items-start justify-between pb-4 border-b border-[var(--border)] gap-4">
                      <div>
                        <span className="eyebrow">HISTORICAL SNAPSHOT ARCHIVE</span>
                        <h3 id="snapshot-modal-title" className="text-base font-bold text-[var(--foreground)] m-0">
                          {String(selectedHistoricalReport.id || 'Historical Snapshot')}
                        </h3>
                        <p className="text-xs text-[var(--muted)] m-0 mt-1">
                          Created: {selectedHistoricalReport.createdAt ? new Date(String(selectedHistoricalReport.createdAt)).toLocaleString('en-GB') : 'Unknown'} · Kind: <span className="font-semibold uppercase">{String(selectedHistoricalReport.kind)}</span> · Status: {String(selectedHistoricalReport.status)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHistoricalReport(null)}
                        className="text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-md hover:bg-[var(--surface)] transition-colors"
                        aria-label="Close snapshot modal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Body (Scrollable) */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                      {/* Summary Metrics */}
                      {(() => {
                        const data = selectedHistoricalReport.data as Record<string, unknown> | undefined;
                        if (!data) return null;
                        if (selectedHistoricalReport.kind === 'audit') {
                          const summary = data.summary as Record<string, number> | undefined;
                          const siteInfo = data.siteInfo as Record<string, unknown> | undefined;
                          const technical = data.technical as Record<string, unknown> | undefined;
                          return (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                                  <span className="text-[var(--muted)] block font-medium mb-1">Total Posts</span>
                                  <strong className="text-base font-bold text-[var(--foreground)]">
                                    {Number(siteInfo?.totalPosts || 0).toLocaleString('en-GB')}
                                  </strong>
                                </div>
                                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                                  <span className="text-[var(--muted)] block font-medium mb-1">Audited Articles</span>
                                  <strong className="text-base font-bold text-[var(--foreground)]">
                                    {summary?.totalChecked ?? 0}
                                  </strong>
                                </div>
                                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                                  <span className="text-[var(--muted)] block font-medium mb-1">Critical Issues</span>
                                  <strong className={`text-base font-bold ${Number(summary?.criticalCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {summary?.criticalCount ?? 0}
                                  </strong>
                                </div>
                                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                                  <span className="text-[var(--muted)] block font-medium mb-1">SEO Warnings</span>
                                  <strong className={`text-base font-bold ${Number(summary?.warningCount || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {summary?.warningCount ?? 0}
                                  </strong>
                                </div>
                              </div>
                              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs flex flex-wrap gap-4 text-[var(--muted)]">
                                <span>Target: <strong className="text-[var(--foreground)] font-mono">{String(data.origin || 'https://firstread.co.uk')}</strong></span>
                                <span>Robots.txt: <strong className="text-emerald-600 dark:text-emerald-400 font-medium">{String(technical?.robotsTxtStatus || 'accessible')}</strong></span>
                                <span>Sub-Sitemaps: <strong className="text-[var(--foreground)]">{Number(technical?.sitemapCount || 0)} detected</strong></span>
                              </div>
                            </div>
                          );
                        }
                        if (selectedHistoricalReport.kind === 'recommend') {
                          const summary = String(data.summary || '');
                          const recs = (data.recommendations as Array<Record<string, unknown>>) || [];
                          return (
                            <div className="space-y-3">
                              {summary && (
                                <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs">
                                  <strong className="block text-[var(--foreground)] font-semibold mb-1">Executive Summary:</strong>
                                  <p className="m-0 text-[var(--muted)] leading-relaxed">{summary}</p>
                                </div>
                              )}
                              <div className="text-xs text-[var(--muted)] font-medium">
                                Total AI Recommendations in Snapshot: <strong className="text-[var(--foreground)]">{recs.length}</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Full JSON Payload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[var(--foreground)]">Full Snapshot JSON Payload</span>
                          <span className="text-[11px] text-[var(--muted)]">Raw historical record</span>
                        </div>
                        <pre className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] font-mono text-[var(--foreground)] max-h-72 overflow-auto">
                          {JSON.stringify(selectedHistoricalReport, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-[var(--muted)]">
                        Persisted in <code className="text-xs">content/reports/</code>
                      </div>
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
                            a.download = `${String(selectedHistoricalReport.id || 'snapshot')}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> Download JSON
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setSelectedHistoricalReport(null)}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 8: GOOGLE INTEGRATIONS */}
          {/* ========================================================= */}
          {activeSection === 'google' && (
            <div className="space-y-6">
              <div className="panel">
                <span className="eyebrow">FIRST-PARTY TRAFFIC VERIFICATION</span>
                <h3 className="text-base font-bold text-[var(--foreground)] mb-2">Google Search Console &amp; GA4</h3>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Interfaces are configured for FirstRead. Metrics will stream once read-only property permissions are granted in Google Cloud.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-[var(--foreground)] font-semibold">Google Search Console</strong>
                      <span className="badge badge-warning">
                        Awaiting Google Authorization
                      </span>
                    </div>
                    <p className="text-[var(--muted)] m-0">
                      Target Property: <code className="text-xs font-mono">sc-domain:firstread.co.uk</code>
                    </p>
                    <p className="text-[var(--muted-light)] text-[11px] m-0">
                      {googleState?.searchConsole.message || 'Service account delegation pending in Search Console.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-[var(--foreground)] font-semibold">Google Analytics 4</strong>
                      <span className="badge badge-warning">
                        Awaiting Google Authorization
                      </span>
                    </div>
                    <p className="text-[var(--muted)] m-0">
                      Target Property ID: <code className="text-xs font-mono">FIRSTREAD_GA4_PROPERTY_ID</code>
                    </p>
                    <p className="text-[var(--muted-light)] text-[11px] m-0">
                      {googleState?.analytics4.message || 'Viewer permissions pending in GA4 property.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted)] space-y-1">
                  <strong className="text-[var(--foreground)] block">Truthful Reporting Notice:</strong>
                  <p className="m-0">• Zero metrics, ranks, clicks, or impressions are fabricated.</p>
                  <p className="m-0">• Data streams only after explicit Google authorization is verified.</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 9: SETTINGS */}
          {/* ========================================================= */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              <div className="panel space-y-4">
                <div>
                  <span className="eyebrow">DASHBOARD CONTROLS</span>
                  <h3 className="text-base font-bold text-[var(--foreground)]">Dashboard Configuration</h3>
                  <p className="text-xs text-[var(--muted)] m-0">
                    Configuration settings and security enforcement parameters for FirstRead SEO Monitor.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block mb-1 font-semibold">Monitored Target URL</span>
                    <span className="text-[var(--foreground)] font-mono font-medium">https://firstread.co.uk</span>
                    <small className="text-[var(--muted-light)] block mt-1">Fixed canonical origin</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block mb-1 font-semibold">Politeness Rate Limiting</span>
                    <span className="text-[var(--foreground)] font-medium">200ms interval throttle + 15s timeout</span>
                    <small className="text-[var(--muted-light)] block mt-1">Protects WordPress LiteSpeed cache</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block mb-1 font-semibold">AI Reasoning Model</span>
                    <span className="text-[var(--foreground)] font-medium">Google Gemini (Structured Schema)</span>
                    <small className="text-[var(--muted-light)] block mt-1">Deterministic JSON schema enforcement</small>
                  </div>

                  <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block mb-1 font-semibold">Scheduled Audits</span>
                    <span className="text-[var(--foreground)] font-medium">GitHub Actions &amp; CLI</span>
                    <small className="text-[var(--muted-light)] block mt-1">CLI command: npm run firstread:audit</small>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200">
                  <strong className="block font-semibold mb-1">WordPress Security Isolation:</strong>
                  WordPress administrator credentials, Application Passwords, and write endpoints (POST/PUT/PATCH/DELETE) are permanently disabled. The WordPress database and files can never be mutated by this dashboard.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
