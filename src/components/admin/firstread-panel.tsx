'use client';

import { useState, useEffect, useMemo, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
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
  X,
  TrendingUp,
  BarChart3,
  Copy,
  Check,
  MousePointer,
  Eye,
  Percent,
  Activity,
  Zap,
  Play,
  History,
  GitBranch
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
import type {
  FirstReadGoogleIntegrationsState,
  GSCReportResponse,
  GA4ReportResponse,
  GoogleConnectionsTestResult
} from '@/lib/integrations/google';
import { BrandGrowthView } from './brand-growth-view';
import type { BrandGrowthEngineState, AutonomousExecutionRecord } from '@/lib/brand/types';

export type DashboardSection =
  | 'overview'
  | 'brand'
  | 'history'
  | 'google'
  | 'posts'
  | 'homepage'
  | 'articles'
  | 'technical'
  | 'recommendations'
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

interface TrendChartPoint {
  date: string;
  val1: number;
  val2?: number;
}

interface SectionErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): SectionErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Section rendering error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel space-y-3 p-6 border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{this.props.fallbackTitle || 'Section Unavailable'}</span>
          </div>
          <p className="text-[var(--muted)] m-0 leading-relaxed">
            {this.state.errorMessage || 'A temporary rendering interruption occurred in this view. Other dashboard sections remain fully operational.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              this.setState({ hasError: false, errorMessage: '' });
              this.props.onRetry?.();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reload Section
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GoogleTrendChart({
  points,
  label1,
  label2,
  color1 = '#0284c7',
  color2 = '#8b5cf6'
}: {
  points: TrendChartPoint[];
  label1: string;
  label2?: string;
  color1?: string;
  color2?: string;
}) {
  const safePoints = Array.isArray(points)
    ? points.filter(p => p && typeof p.date === 'string')
    : [];

  if (safePoints.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-[var(--muted)]">
        No daily trend records available for selected period.
      </div>
    );
  }

  const width = 640;
  const height = 150;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 25;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal1 = Math.max(1, ...safePoints.map(p => (Number.isFinite(p.val1) ? Number(p.val1) : 0)));
  const maxVal2 = label2 ? Math.max(1, ...safePoints.map(p => (Number.isFinite(p.val2) ? Number(p.val2) : 0))) : 1;

  const getX = (idx: number) => padL + (safePoints.length <= 1 ? innerW / 2 : (idx / (safePoints.length - 1)) * innerW);
  const getY1 = (val: number) => padT + innerH - ((Number.isFinite(val) ? Number(val) : 0) / maxVal1) * innerH;
  const getY2 = (val: number) => padT + innerH - ((Number.isFinite(val) ? Number(val) : 0) / maxVal2) * innerH;

  const poly1 = safePoints.map((p, i) => `${getX(i).toFixed(1)},${getY1(p.val1).toFixed(1)}`).join(' ');
  const poly2 = label2 ? safePoints.map((p, i) => `${getX(i).toFixed(1)},${getY2(p.val2 || 0).toFixed(1)}`).join(' ') : '';

  const area1 = safePoints.length > 1
    ? `${getX(0)},${padT + innerH} ${poly1} ${getX(safePoints.length - 1)},${padT + innerH}`
    : '';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] mb-2 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color1 }} />
            {label1} (Max: {maxVal1.toLocaleString('en-GB')})
          </span>
          {label2 && (
            <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color2 }} />
              {label2} (Max: {maxVal2.toLocaleString('en-GB')})
            </span>
          )}
        </div>
        <span className="text-[var(--muted-light)]">Daily Aggregate</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 font-mono text-[10px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label1.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color1} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <line x1={padL} y1={padT} x2={width - padR} y2={padT} stroke="currentColor" className="text-[var(--border)] opacity-60" strokeDasharray="3 3" />
        <line x1={padL} y1={padT + innerH / 2} x2={width - padR} y2={padT + innerH / 2} stroke="currentColor" className="text-[var(--border)] opacity-60" strokeDasharray="3 3" />
        <line x1={padL} y1={padT + innerH} x2={width - padR} y2={padT + innerH} stroke="currentColor" className="text-[var(--border)]" />

        {area1 && <polygon points={area1} fill={`url(#grad-${label1.replace(/\s+/g, '')})`} />}
        {poly2 && <polyline points={poly2} fill="none" stroke={color2} strokeWidth="2" strokeDasharray="4 2" />}
        <polyline points={poly1} fill="none" stroke={color1} strokeWidth="2.5" />

        {safePoints.length > 0 && (
          <>
            <text x={padL} y={height - 6} fill="currentColor" className="text-[var(--muted)]">
              {safePoints[0].date}
            </text>
            {safePoints.length > 2 && (
              <text x={padL + innerW / 2} y={height - 6} textAnchor="middle" fill="currentColor" className="text-[var(--muted)]">
                {safePoints[Math.floor(safePoints.length / 2)].date}
              </text>
            )}
            {safePoints.length > 1 && (
              <text x={width - padR} y={height - 6} textAnchor="end" fill="currentColor" className="text-[var(--muted)]">
                {safePoints[safePoints.length - 1].date}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

function computeGoogleDateRange(days: number) {
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

const DEFAULT_GOOGLE_DATES = computeGoogleDateRange(28);

export function FirstReadPanel({ initialSection = 'overview' }: { initialSection?: string }) {
  // Core audit data & site info
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [audit, setAudit] = useState<FirstReadAuditReport | null>(null);
  const [recommendations, setRecommendations] = useState<FirstReadRecommendationsReport | null>(null);
  const [googleState, setGoogleState] = useState<(FirstReadGoogleIntegrationsState & {
    serviceAccountEmail?: string | null;
    gscSiteUrl?: string;
    ga4PropertyId?: string | null;
    hasCredentials?: boolean;
  }) | null>(null);
  const [gscReport, setGscReport] = useState<GSCReportResponse | null>(null);
  const [ga4Report, setGa4Report] = useState<GA4ReportResponse | null>(null);
  const [loadingGoogleReports, setLoadingGoogleReports] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testResult, setTestResult] = useState<GoogleConnectionsTestResult | null>(null);
  const [dateRangePreset, setDateRangePreset] = useState<'7d' | '28d' | '90d' | 'custom'>('28d');
  const [googleStartDate, setGoogleStartDate] = useState<string>(DEFAULT_GOOGLE_DATES.start);
  const [googleEndDate, setGoogleEndDate] = useState<string>(DEFAULT_GOOGLE_DATES.end);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [gscActiveTab, setGscActiveTab] = useState<'queries' | 'pages'>('queries');
  const [googleSearchFilter, setGoogleSearchFilter] = useState('');
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

  // FirstRead Brand Growth & Autonomous Indexing Engine state
  const [brandState, setBrandState] = useState<BrandGrowthEngineState | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [selectedCronExecution, setSelectedCronExecution] = useState<AutonomousExecutionRecord | null>(null);

  const fetchBrandState = useCallback(async () => {
    setBrandLoading(true);
    try {
      const res = await api('firstread/brand/state');
      if (res) setBrandState(res);
    } catch (err) {
      console.warn('Failed to fetch brand state:', err);
    } finally {
      setBrandLoading(false);
    }
  }, []);

  const handleRunBrandCycle = useCallback(async () => {
    setBrandLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await api('firstread/brand/run', {});
      if (res?.state) {
        setBrandState(res.state);
      } else {
        await fetchBrandState();
      }
      setMessage(res?.execution?.summary || 'Autonomous cycle completed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autonomous cycle failed.');
    } finally {
      setBrandLoading(false);
    }
  }, [fetchBrandState]);

  const handleToggleBrandPause = useCallback(async (pause: boolean) => {
    setBrandLoading(true);
    setMessage('');
    try {
      const endpoint = pause ? 'firstread/brand/pause' : 'firstread/brand/resume';
      const res = await api(endpoint, {});
      if (res) setBrandState(res);
      setMessage(pause ? 'Brand engine paused.' : 'Brand engine resumed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pause state.');
    } finally {
      setBrandLoading(false);
    }
  }, []);

  const handleEmergencyStop = useCallback(async () => {
    setBrandLoading(true);
    setMessage('');
    try {
      const res = await api('firstread/brand/stop', {});
      if (res) setBrandState(res);
      setMessage('Emergency stop executed: all autonomous actions halted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Emergency stop failed.');
    } finally {
      setBrandLoading(false);
    }
  }, []);

  const handleInspectUrl = useCallback(async (url: string) => {
    setBrandLoading(true);
    setMessage('');
    try {
      const res = await api('firstread/brand/inspect', { url });
      if (res) {
        setBrandState(prev => (prev ? {
          ...prev,
          recentInspections: [res, ...(prev.recentInspections || [])].slice(0, 10)
        } : null));
        setMessage(`Inspection complete for ${url}: ${res.verdict} (${res.coverageState})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'URL inspection failed.');
    } finally {
      setBrandLoading(false);
    }
  }, []);

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
        const [infoRes, auditRes, googleRes, approvalsRes, historyRes, gscRes, ga4Res, brandRes] = await Promise.all([
          api('firstread/info').catch(() => null),
          api('firstread/audit').catch(() => null),
          api('firstread/google').catch(() => null),
          api('firstread/approvals').catch(() => null),
          api('firstread/reports').catch(() => []),
          api(`firstread/google/search-console?startDate=${DEFAULT_GOOGLE_DATES.start}&endDate=${DEFAULT_GOOGLE_DATES.end}`).catch(() => null),
          api(`firstread/google/analytics?startDate=${DEFAULT_GOOGLE_DATES.start}&endDate=${DEFAULT_GOOGLE_DATES.end}`).catch(() => null),
          api('firstread/brand/state').catch(() => null)
        ]);

        if (!mounted) return;
        if (infoRes) setSiteInfo(infoRes);
        if (auditRes) setAudit(auditRes);
        if (googleRes) setGoogleState(googleRes);
        if (gscRes) setGscReport(gscRes);
        if (ga4Res) setGa4Report(ga4Res);
        if (brandRes) setBrandState(brandRes);
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
  async function triggerAudit(scopeOrEvent?: 'sampled' | 'full' | 'continue' | React.MouseEvent) {
    const scope: 'sampled' | 'full' | 'continue' = typeof scopeOrEvent === 'string' ? scopeOrEvent : 'full';
    setAuditing(true);
    setError('');
    setMessage('');
    try {
      const res = await api('firstread/audit', { scope, limit: scope === 'sampled' ? 100 : 500 });
      const report = res.data || res;
      setAudit(report);
      if (report.siteInfo) setSiteInfo(report.siteInfo);
      const scopeLabel = scope === 'continue' ? 'Audit continuation' : scope === 'sampled' ? 'Sampled audit (100 URLs)' : 'Full audit';
      setMessage(`${scopeLabel} completed and saved to history. Zero changes made to FirstRead WordPress.`);
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

  // Toggle reviewed status on an AI recommendation (In-memory session state)
  function toggleApproval(id: string) {
    setApprovedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // On-Demand AI Operations state (Simplified Architecture)
  const [selectedOperation, setSelectedOperation] = useState<string>('keyword-research');
  const [opInput, setOpInput] = useState<string>('uk property investment');
  const [opResult, setOpResult] = useState<unknown | null>(null);
  const [runningOp, setRunningOp] = useState<boolean>(false);

  const runOperation = async (opName: string) => {
    setRunningOp(true);
    setError('');
    setMessage('');
    try {
      let input: Record<string, unknown> = {};
      if (opName === 'keyword-research') input = { seed: opInput };
      else if (opName === 'competitor-analysis') input = { domain: 'firstread.co.uk' };
      else if (opName === 'search-intent') input = { keywords: [opInput, 'best buy to let areas uk', 'canterbury property yields'] };
      else if (opName === 'content-gap') input = { niche: 'UK Regional Property & Finance' };
      else if (opName === 'topic-clusters') input = { pillarTopic: opInput };
      else if (opName === 'seo-strategy') input = { focus: 'FirstRead 90-Day Organic Growth' };
      else if (opName === 'article-research') input = { topic: opInput };
      else if (opName === 'article-generation') input = { topic: opInput, primaryKeyword: opInput.toLowerCase() };
      else if (opName === 'article-qa') input = {
        title: `${opInput}: Strategic Guide for UK Investors`,
        metaDescription: `Comprehensive guide covering ${opInput} with actionable insights, regional yields, and regulatory updates across the UK.`,
        content: `<h2>Introduction to ${opInput}</h2><p>Overview of the current UK landscape regarding ${opInput}.</p><h2>Strategic Considerations</h2><p>Critical regional analysis.</p>`,
        primaryKeyword: opInput.toLowerCase()
      };
      else if (opName === 'technical-audit') input = { limit: 100 };
      else if (opName === 'recommendations') input = {};

      const res = await api('firstread/operation', {
        operation: opName,
        input
      });
      setOpResult(res);
      setMessage(`Operation "${opName}" executed successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to execute operation "${opName}"`);
    } finally {
      setRunningOp(false);
    }
  };

  const downloadJson = (data: unknown, filename: string) => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Google API Data Fetching & Testing
  const fetchGoogleReports = useCallback(async (start?: string, end?: string) => {
    const s = start || googleStartDate;
    const e = end || googleEndDate;
    setLoadingGoogleReports(true);
    try {
      const [gscRes, ga4Res] = await Promise.all([
        api(`firstread/google/search-console?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}`).catch(err => ({
          service: 'Google Search Console' as const,
          status: 'error' as const,
          authorized: false,
          message: err.message,
          property: '',
          period: { startDate: s, endDate: e },
          data: null
        })),
        api(`firstread/google/analytics?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}`).catch(err => ({
          service: 'Google Analytics 4' as const,
          status: 'error' as const,
          authorized: false,
          message: err.message,
          propertyId: null,
          period: { startDate: s, endDate: e },
          data: null
        }))
      ]);
      setGscReport(gscRes);
      setGa4Report(ga4Res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve Google reports.');
    } finally {
      setLoadingGoogleReports(false);
    }
  }, [googleStartDate, googleEndDate]);

  const handleDatePresetChange = (preset: '7d' | '28d' | '90d') => {
    setDateRangePreset(preset);
    const days = preset === '7d' ? 7 : preset === '28d' ? 28 : 90;
    const range = computeGoogleDateRange(days);
    setGoogleStartDate(range.start);
    setGoogleEndDate(range.end);
    void fetchGoogleReports(range.start, range.end);
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateRangePreset('custom');
    void fetchGoogleReports(googleStartDate, googleEndDate);
  };

  const handleTestGoogleConnection = async () => {
    setTestingGoogle(true);
    setError('');
    setMessage('');
    try {
      const res = await api('firstread/google/test', {});
      setTestResult(res);
      const latestGoogle = await api('firstread/google').catch(() => null);
      if (latestGoogle) setGoogleState(latestGoogle);
      await fetchGoogleReports();
      setMessage('Google connection test completed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google connection test failed.');
    } finally {
      setTestingGoogle(false);
    }
  };

  const handleCopyEmail = (email: string) => {
    if (!email) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(email);
    }
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleRunBrandCycle}
            disabled={brandLoading || brandState?.status === 'running'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 shadow-xs"
          >
            <Play className={`w-3.5 h-3.5 mr-1.5 ${brandLoading || brandState?.status === 'running' ? 'animate-spin' : ''}`} />
            {brandLoading || brandState?.status === 'running' ? 'Running Cycle…' : 'Run Autonomous Cycle Now'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchBrandState()}
            disabled={brandLoading}
            className="text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${brandLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Autonomous Engine, Cron Job History, Google Integrations */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {([
          { slug: 'brand', label: 'Autonomous Engine', icon: Zap },
          { slug: 'history', label: `Cron Job History (${brandState?.executionHistory?.length || 0})`, icon: History },
          { slug: 'google', label: 'Google Integrations', icon: SlidersHorizontal }
        ] as const).map(({ slug, label, icon: IconComp }) => {
          const isBrandActive = (activeSection === 'overview' || activeSection === 'brand' || !activeSection) && slug === 'brand';
          const isActive = activeSection === slug || isBrandActive;
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
          {/* SECTION: FIRSTREAD BRAND KEYWORD GROWTH & INDEXING */}
          {/* ========================================================= */}
          {(activeSection === 'brand' || activeSection === 'overview' || !activeSection) && (
            <BrandGrowthView
              brandState={brandState}
              loading={brandLoading}
              onRefresh={async () => {
                await Promise.all([fetchBrandState(), fetchGoogleReports()]);
              }}
              onRunCycle={handleRunBrandCycle}
              onTogglePause={handleToggleBrandPause}
              onEmergencyStop={handleEmergencyStop}
              onInspectUrl={handleInspectUrl}
              gscReport={gscReport}
              ga4Report={ga4Report}
              dateRangePreset={dateRangePreset}
              onDatePresetChange={handleDatePresetChange}
            />
          )}
{/* ========================================================= */}
          {/* ========================================================= */}
          {/* SECTION: AUTONOMOUS CRON JOB & EXECUTION HISTORY */}
          {/* ========================================================= */}
          {activeSection === 'history' && (
            <div className="space-y-6">
              {/* Header Panel */}
              <div className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="eyebrow">AUTONOMOUS RUN ARCHIVE</span>
                    <h3 className="text-base font-bold text-[var(--foreground)] m-0">
                      Autonomous Cron Job History &amp; Execution Snapshots
                    </h3>
                    <p className="text-xs text-[var(--muted)] m-0 mt-1">
                      Verifiable scheduled daily cron runs and manual autonomous cycles. Every cycle produces an immutable snapshot detailing indexing submissions, sitemap pings, schema verification, brand query telemetry, and commit receipts to the dedicated <code className="font-semibold text-xs text-sky-700 dark:text-sky-300">monitoring-history</code> branch.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleRunBrandCycle}
                      disabled={brandLoading || brandState?.status === 'running'}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                    >
                      <Play className={`w-3.5 h-3.5 mr-1.5 ${brandLoading || brandState?.status === 'running' ? 'animate-spin' : ''}`} />
                      {brandLoading || brandState?.status === 'running' ? 'Running Cycle…' : 'Run Autonomous Cycle Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void fetchBrandState()}
                      disabled={brandLoading}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${brandLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Storage & Schedule Status Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-3 border-t border-[var(--border)]">
                  <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Vercel Daily Cron Schedule</span>
                    <strong className="text-sm font-mono text-[var(--foreground)] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      0 6 * * * (06:00 UTC)
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Total Recorded Runs</span>
                    <strong className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {(brandState?.executionHistory || []).length} Executions
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Permanent Git Store</span>
                    <span className="text-xs font-mono text-sky-700 dark:text-sky-300 flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5" />
                      {brandState?.storageStatus?.branch || 'monitoring-history'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <span className="text-[var(--muted)] block font-medium mb-1">Last Storage Commit</span>
                    <span className="text-xs font-mono text-[var(--foreground)] truncate block" title={brandState?.storageStatus?.sha || 'None'}>
                      {brandState?.storageStatus?.sha ? brandState.storageStatus.sha.slice(0, 10) : 'Pending initial push'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executions List */}
              <div className="panel">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--foreground)] m-0">
                      Recorded Cron &amp; Autonomous Executions
                    </h4>
                    <p className="text-xs text-[var(--muted)] m-0">
                      Click any run to view its full execution snapshot, indexing actions, and telemetry breakdown.
                    </p>
                  </div>
                  {brandState?.executionHistory && brandState.executionHistory.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(brandState.executionHistory, null, 2)], {
                          type: 'application/json'
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `firstread-cron-history-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Export All Runs
                    </Button>
                  )}
                </div>

                {(!brandState?.executionHistory || brandState.executionHistory.length === 0) ? (
                  <div className="p-8 text-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] space-y-3">
                    <History className="w-8 h-8 text-[var(--muted)] mx-auto" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)] m-0">No Autonomous Cron Executions Recorded Yet</p>
                      <p className="text-xs text-[var(--muted)] m-0 mt-1 max-w-md mx-auto">
                        Trigger a run right now with &quot;Run Autonomous Cycle Now&quot; or wait for the automated Vercel Cron job at 06:00 UTC. Every run writes an immutable report to the <code className="text-xs font-mono">monitoring-history</code> branch.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleRunBrandCycle}
                      disabled={brandLoading || brandState?.status === 'running'}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs mt-2"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Run First Autonomous Cycle
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {brandState.executionHistory.map((exec) => {
                      const isComplete = exec.status === 'success';
                      const isFailed = exec.status === 'failed';
                      const actionsCount = exec.actionsExecuted?.length || 0;
                      return (
                        <div
                          key={exec.id}
                          className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-sky-500/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[var(--foreground)]">
                                {exec.id}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                                  isComplete
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                    : isFailed
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                }`}
                              >
                                {exec.status}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                duration: {(exec.durationMs / 1000).toFixed(1)}s
                              </span>
                            </div>

                            <p className="text-xs text-[var(--muted)] m-0">
                              {new Date(exec.startedAt).toLocaleString('en-GB')} · {exec.summary || 'Autonomous cycle completed.'}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[var(--muted)]">
                              <span>Actions Executed: <strong className="text-[var(--foreground)]">{actionsCount}</strong></span>
                              <span>•</span>
                              <span>Brand Clicks: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{exec.brandClicks ?? 0}</strong></span>
                              <span>•</span>
                              <span>Impressions: <strong className="text-sky-600 dark:text-sky-400 font-bold">{exec.brandImpressions ?? 0}</strong></span>
                              <span>•</span>
                              <span>Homepage Indexed: <strong className={exec.homepageIndexed ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>{exec.homepageIndexed ? 'Yes' : 'No'}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const blob = new Blob([JSON.stringify(exec, null, 2)], {
                                  type: 'application/json'
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${exec.id}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="text-xs"
                              title="Download JSON Report"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setSelectedCronExecution(exec)}
                              className="text-xs bg-[var(--primary)] text-[var(--primary-foreground)]"
                            >
                              View Snapshot Report →
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Execution Snapshot Report Modal */}
              {selectedCronExecution && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="cron-snapshot-title"
                  onClick={e => {
                    if (e.target === e.currentTarget) setSelectedCronExecution(null);
                  }}
                >
                  <div className="panel max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--card)]">
                    {/* Modal Header */}
                    <div className="flex items-start justify-between pb-4 border-b border-[var(--border)] gap-4">
                      <div>
                        <span className="eyebrow">AUTONOMOUS RUN SNAPSHOT</span>
                        <h3 id="cron-snapshot-title" className="text-base font-bold text-[var(--foreground)] m-0 font-mono">
                          {selectedCronExecution.id}
                        </h3>
                        <p className="text-xs text-[var(--muted)] m-0 mt-1">
                          Started: {new Date(selectedCronExecution.startedAt).toLocaleString('en-GB')} · Duration: <span className="font-semibold font-mono">{(selectedCronExecution.durationMs / 1000).toFixed(1)}s</span> · Status: <span className="font-semibold uppercase">{selectedCronExecution.status}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCronExecution(null)}
                        className="text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-md hover:bg-[var(--surface)] transition-colors"
                        aria-label="Close snapshot modal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                      {/* Executive Summary */}
                      {selectedCronExecution.summary && (
                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs">
                          <strong className="block text-[var(--foreground)] font-semibold mb-1">Execution Summary:</strong>
                          <p className="m-0 text-[var(--muted)] leading-relaxed">{selectedCronExecution.summary}</p>
                        </div>
                      )}

                      {/* Brand Metrics Snapshot Grid */}
                      <div>
                        <h5 className="text-xs font-bold text-[var(--foreground)] mb-2">FirstRead Brand Performance Snapshot</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block font-medium mb-1">Brand Clicks</span>
                            <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                              {Number(selectedCronExecution.brandClicks || 0).toLocaleString('en-GB')}
                            </strong>
                          </div>
                          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block font-medium mb-1">Impressions</span>
                            <strong className="text-base font-bold text-sky-600 dark:text-sky-400">
                              {Number(selectedCronExecution.brandImpressions || 0).toLocaleString('en-GB')}
                            </strong>
                          </div>
                          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block font-medium mb-1">Discovery Issues</span>
                            <strong className="text-base font-bold text-[var(--foreground)]">
                              {selectedCronExecution.discoveryIssuesCount ?? 0}
                            </strong>
                          </div>
                          <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[var(--muted)] block font-medium mb-1">Homepage Indexed</span>
                            <strong className={`text-base font-bold ${selectedCronExecution.homepageIndexed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {selectedCronExecution.homepageIndexed ? 'Yes' : 'No'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Actions Executed Table */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-bold text-[var(--foreground)] m-0">
                            Executed Actions Receipt ({selectedCronExecution.actionsExecuted?.length || 0})
                          </h5>
                          <span className="text-[11px] text-[var(--muted)]">Zero content modifications strictly guaranteed</span>
                        </div>

                        {(!selectedCronExecution.actionsExecuted || selectedCronExecution.actionsExecuted.length === 0) ? (
                          <p className="text-xs text-[var(--muted)] p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] m-0">
                            No autonomous actions were dispatched during this cycle.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] font-semibold">
                                <tr>
                                  <th className="py-2 px-3">Action Type</th>
                                  <th className="py-2 px-3">Target</th>
                                  <th className="py-2 px-3">Status</th>
                                  <th className="py-2 px-3">Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {selectedCronExecution.actionsExecuted.map((act) => (
                                  <tr key={act.id} className="hover:bg-[var(--surface)] transition-colors">
                                    <td className="py-2 px-3 font-mono font-medium text-[var(--foreground)] whitespace-nowrap">
                                      {act.actionType}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[11px] text-[var(--muted)] max-w-xs truncate" title={act.target}>
                                      {act.target}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                          act.status === 'success'
                                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                            : act.status === 'failed'
                                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                        }`}
                                      >
                                        {act.status}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-[11px] text-[var(--muted)]">
                                      {act.details || act.error || act.reason || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Full Snapshot JSON Payload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[var(--foreground)]">Full Execution Snapshot JSON Payload</span>
                          <span className="text-[11px] text-[var(--muted)]">Raw immutable record</span>
                        </div>
                        <pre className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] font-mono text-[var(--foreground)] max-h-56 overflow-auto">
                          {JSON.stringify(selectedCronExecution, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-[var(--muted)] flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        Persisted on branch <code className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-300">monitoring-history</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(selectedCronExecution, null, 2)], {
                              type: 'application/json'
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${selectedCronExecution.id}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> Download JSON
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setSelectedCronExecution(null)}
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

          {/* SECTION 8: GOOGLE INTEGRATIONS */}
          {/* ========================================================= */}
          {activeSection === 'google' && (
            <SectionErrorBoundary
              fallbackTitle="Google Integrations Interrupted"
              onRetry={() => void fetchGoogleReports()}
            >
            <div className="space-y-6">
              {/* Header Panel */}
              <div className="panel">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="eyebrow">FIRST-PARTY TRAFFIC &amp; SEARCH INTELLIGENCE</span>
                    <h3 className="text-base font-bold text-[var(--foreground)] m-0">
                      Google Search Console &amp; Google Analytics 4
                    </h3>
                    <p className="text-xs text-[var(--muted)] m-0 mt-1">
                      Read-only server-side telemetry for impressions, clicks, CTR, keyword queries, user sessions, and landing page performance.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestGoogleConnection}
                      disabled={testingGoogle}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testingGoogle ? 'animate-spin' : ''}`} />
                      {testingGoogle ? 'Testing Access…' : 'Test Connections'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void fetchGoogleReports()}
                      disabled={loadingGoogleReports}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingGoogleReports ? 'animate-spin' : ''}`} />
                      Refresh Data
                    </Button>
                  </div>
                </div>

                {/* Date-Range Selector Bar */}
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 text-xs mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[var(--muted)]" />
                    <span className="font-semibold text-[var(--foreground)]">Reporting Period:</span>
                    <div className="flex items-center gap-1">
                      {(['7d', '28d', '90d'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            dateRangePreset === p
                              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                              : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                          }`}
                          onClick={() => handleDatePresetChange(p)}
                        >
                          {p === '7d' ? 'Last 7 Days' : p === '28d' ? 'Last 28 Days' : 'Last 90 Days'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2">
                    <label className="text-[11px] text-[var(--muted)]">Custom:</label>
                    <input
                      type="date"
                      value={googleStartDate}
                      onChange={e => setGoogleStartDate(e.target.value)}
                      className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] font-mono"
                    />
                    <span className="text-[var(--muted)]">to</span>
                    <input
                      type="date"
                      value={googleEndDate}
                      onChange={e => setGoogleEndDate(e.target.value)}
                      className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--foreground)] font-mono"
                    />
                    <Button type="submit" size="sm" variant="outline" className="h-7 text-xs">
                      Apply
                    </Button>
                  </form>
                </div>

                {/* Connection Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Search Console Card */}
                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-[var(--foreground)] font-semibold flex items-center gap-2">
                        <Globe className="w-4 h-4 text-sky-500" /> Google Search Console
                      </strong>
                      {(() => {
                        const s = gscReport?.status || testResult?.searchConsole?.status || googleState?.searchConsole?.status;
                        switch (s) {
                          case 'connected':
                            return <span className="badge badge-success">Connected</span>;
                          case 'pending_authorization':
                            return <span className="badge badge-warning">Awaiting Authorization</span>;
                          case 'permission_denied':
                            return <span className="badge badge-danger">Permission Denied</span>;
                          case 'api_not_enabled':
                            return <span className="badge badge-danger">API Not Enabled</span>;
                          case 'property_not_found':
                            return <span className="badge badge-danger">Property Not Found</span>;
                          case 'invalid_credentials':
                            return <span className="badge badge-danger">Invalid Credentials</span>;
                          case 'configuration_error':
                            return <span className="badge badge-warning">Configuration Error</span>;
                          case 'temporary_api_error':
                            return <span className="badge badge-warning">Temporary API Error</span>;
                          case 'unconfigured':
                            return <span className="badge badge-secondary">Unconfigured</span>;
                          default:
                            return <span className="badge badge-secondary">{s || 'Unconfigured'}</span>;
                        }
                      })()}
                    </div>

                    <div className="text-[var(--muted)] space-y-1">
                      <p className="m-0">
                        Property: <code className="text-xs font-mono">{googleState?.gscSiteUrl || 'sc-domain:firstread.co.uk'}</code>
                      </p>
                      <p className="text-[11px] text-[var(--muted-light)] m-0">
                        {testResult?.searchConsole?.message || gscReport?.message || googleState?.searchConsole?.message || 'Pending authorization check.'}
                      </p>
                    </div>
                  </div>

                  {/* GA4 Card */}
                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-[var(--foreground)] font-semibold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" /> Google Analytics 4
                      </strong>
                      {(() => {
                        const s = ga4Report?.status || testResult?.analytics4?.status || googleState?.analytics4?.status;
                        switch (s) {
                          case 'connected':
                            return <span className="badge badge-success">Connected</span>;
                          case 'pending_authorization':
                            return <span className="badge badge-warning">Awaiting Authorization</span>;
                          case 'permission_denied':
                            return <span className="badge badge-danger">Permission Denied</span>;
                          case 'api_not_enabled':
                            return <span className="badge badge-danger">API Not Enabled</span>;
                          case 'property_not_found':
                            return <span className="badge badge-danger">Property Not Found</span>;
                          case 'invalid_credentials':
                            return <span className="badge badge-danger">Invalid Credentials</span>;
                          case 'configuration_error':
                            return <span className="badge badge-warning">Configuration Error</span>;
                          case 'temporary_api_error':
                            return <span className="badge badge-warning">Temporary API Error</span>;
                          case 'unconfigured':
                            return <span className="badge badge-secondary">Unconfigured</span>;
                          default:
                            return <span className="badge badge-danger">{s || 'Connection Error'}</span>;
                        }
                      })()}
                    </div>

                    <div className="text-[var(--muted)] space-y-1">
                      <p className="m-0">
                        Property ID: <code className="text-xs font-mono">{googleState?.ga4PropertyId || 'Pending configuration'}</code>
                      </p>
                      <p className="text-[11px] text-[var(--muted-light)] m-0">
                        {testResult?.analytics4?.message || ga4Report?.message || googleState?.analytics4?.message || 'Pending authorization check.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connection Test Banner (if recently tested) */}
                {testResult && (testResult.searchConsole || testResult.analytics4) && (
                  <div className="mt-4 p-3.5 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20 text-xs text-sky-900 dark:text-sky-200">
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span>
                        Connection Test Result (
                        {testResult.timestamp
                          ? (() => {
                              try {
                                const d = new Date(testResult.timestamp);
                                return isNaN(d.getTime()) ? 'Just now' : d.toLocaleTimeString('en-GB');
                              } catch {
                                return 'Just now';
                              }
                            })()
                          : 'Just now'}
                        )
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 m-0 text-[11px]">
                      {testResult.searchConsole?.message && (
                        <li>
                          <strong>Search Console:</strong> {testResult.searchConsole.message}
                        </li>
                      )}
                      {testResult.analytics4?.message && (
                        <li>
                          <strong>Analytics 4:</strong> {testResult.analytics4.message}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* GA4 Diagnostic Details Card */}
                {testResult?.analytics4?.diagnostic && (
                  <div className="mt-4 p-4 rounded-lg border border-sky-300 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 text-xs text-sky-950 dark:text-sky-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>GA4 Connection Diagnostic Results</span>
                      </div>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 border border-sky-300 dark:border-sky-700">
                        {testResult.analytics4.diagnostic.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                      <div className="p-2.5 rounded bg-white dark:bg-black/30 border border-sky-200 dark:border-sky-800 space-y-1">
                        <span className="font-medium text-[var(--muted)] block">1. Authentication</span>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {testResult.analytics4.diagnostic.steps.authentication.success ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Authenticated
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-white dark:bg-black/30 border border-sky-200 dark:border-sky-800 space-y-1">
                        <span className="font-medium text-[var(--muted)] block">2. Property ID Format</span>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {testResult.analytics4.diagnostic.steps.propertyValidation.validFormat ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Numeric ID
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Invalid Format
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-white dark:bg-black/30 border border-sky-200 dark:border-sky-800 space-y-1">
                        <span className="font-medium text-[var(--muted)] block">3. Admin API</span>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {testResult.analytics4.diagnostic.steps.adminApi.enabled ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Enabled
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Disabled in Project
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-white dark:bg-black/30 border border-sky-200 dark:border-sky-800 space-y-1">
                        <span className="font-medium text-[var(--muted)] block">4. Data API runReport</span>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {testResult.analytics4.diagnostic.steps.dataApi.runReportSuccess ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> 200 OK
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> {testResult.analytics4.diagnostic.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {testResult.analytics4.diagnostic.steps.alternatePropertyCheck?.accessible && (
                      <div className="p-3 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 text-[11px] space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>Active FirstRead GA4 Property Verified: <code>{testResult.analytics4.diagnostic.steps.alternatePropertyCheck.checkedId}</code></span>
                        </div>
                        <p className="m-0 leading-relaxed">
                          The service account is already authorized on Property ID <code className="font-bold">{testResult.analytics4.diagnostic.steps.alternatePropertyCheck.checkedId}</code> with active production traffic for <strong>{testResult.analytics4.diagnostic.steps.alternatePropertyCheck.hostName}</strong> ({testResult.analytics4.diagnostic.steps.alternatePropertyCheck.recentSessions} recent sessions).
                        </p>
                      </div>
                    )}

                    {testResult.analytics4.diagnostic.recommendedAction && (
                      <div className="p-3 rounded bg-white/80 dark:bg-black/40 border border-sky-200 dark:border-sky-800 text-[11px] space-y-1">
                        <strong className="block text-[var(--foreground)] font-semibold">Actionable Resolution:</strong>
                        <p className="m-0 leading-relaxed text-[var(--muted)]">{testResult.analytics4.diagnostic.recommendedAction}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Client Authorization Step-by-Step Box (when pending authorization, permission denied, or unconfigured) */}
                {(gscReport?.status === 'pending_authorization' ||
                  ga4Report?.status === 'pending_authorization' ||
                  ga4Report?.status === 'permission_denied' ||
                  ga4Report?.status === 'api_not_enabled' ||
                  testResult?.analytics4?.status === 'permission_denied' ||
                  testResult?.analytics4?.status === 'api_not_enabled' ||
                  !googleState?.configured) && (
                  <div className="mt-4 p-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-950 dark:text-amber-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <strong className="text-sm font-semibold">Awaiting Client Authorization</strong>
                    </div>

                    <p className="m-0 leading-relaxed">
                      The server-side service account is authenticated, but viewer permissions have not yet been granted to FirstRead&apos;s properties in Google Search Console and GA4.
                    </p>

                    {googleState?.serviceAccountEmail && (
                      <div className="flex flex-wrap items-center gap-2 p-2 rounded bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700">
                        <span className="font-medium text-[11px]">Service Account to Authorize:</span>
                        <code className="px-2 py-0.5 rounded bg-white dark:bg-black font-mono text-[11px] font-bold select-all">
                          {googleState.serviceAccountEmail}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 ml-auto"
                          onClick={() => handleCopyEmail(googleState.serviceAccountEmail || '')}
                        >
                          {copiedEmail ? <Check className="w-3 h-3 mr-1 text-emerald-600" /> : <Copy className="w-3 h-3 mr-1" />}
                          {copiedEmail ? 'Copied!' : 'Copy Email'}
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-3 rounded border border-amber-200 dark:border-amber-800/60 bg-white/50 dark:bg-black/20 space-y-1">
                        <strong className="block text-[var(--foreground)] font-semibold">1. Search Console Setup:</strong>
                        <p className="m-0">1. Go to Google Search Console for <code className="font-mono">{googleState?.gscSiteUrl || 'sc-domain:firstread.co.uk'}</code>.</p>
                        <p className="m-0">2. Navigate to <strong>Settings</strong> &rarr; <strong>Users and permissions</strong>.</p>
                        <p className="m-0">3. Click <strong>Add User</strong>, paste the service account email, and set Permission to <strong>Restricted</strong> or <strong>Full</strong>.</p>
                      </div>

                      <div className="p-3 rounded border border-amber-200 dark:border-amber-800/60 bg-white/50 dark:bg-black/20 space-y-1">
                        <strong className="block text-[var(--foreground)] font-semibold">2. GA4 Setup:</strong>
                        <p className="m-0">1. Go to Google Analytics &rarr; <strong>Admin</strong>.</p>
                        <p className="m-0">2. Select Property ID <code className="font-mono">{googleState?.ga4PropertyId || 'FIRSTREAD_GA4_PROPERTY_ID'}</code> &rarr; <strong>Property Access Management</strong>.</p>
                        <p className="m-0">3. Click <strong>+</strong> &rarr; <strong>Add users</strong>, paste service account email, and select role <strong>Viewer</strong>.</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-amber-800 dark:text-amber-300 font-medium">
                        Once added, click &ldquo;Test Connections&rdquo; above to immediately start streaming live data.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Section Loading Indicator */}
              {loadingGoogleReports && (
                <div className="panel space-y-4">
                  <div className="skeleton h-8 w-48" />
                  <div className="skeleton h-32 w-full" />
                </div>
              )}

              {/* SECTION: Google Search Console Reports */}
              {!loadingGoogleReports && (
                <div className="panel space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="eyebrow">ORGANIC SEARCH METRICS</span>
                      <h4 className="text-sm font-bold text-[var(--foreground)] m-0">Google Search Console Performance</h4>
                    </div>
                    {gscReport?.data && (
                      <span className="badge badge-success">
                        <CheckCircle className="w-3 h-3 mr-1" /> Real Google Telemetry
                      </span>
                    )}
                  </div>

                  {gscReport?.status === 'connected' && gscReport.data ? (
                    <div className="space-y-4">
                      {/* KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <MousePointer className="w-3.5 h-3.5 text-sky-500" /> Total Clicks
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(gscReport.data.summary?.clicks ?? 0).toLocaleString('en-GB')}
                          </strong>
                          <small className="text-[var(--muted-light)]">Organic Google search clicks</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <Eye className="w-3.5 h-3.5 text-indigo-500" /> Impressions
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(gscReport.data.summary?.impressions ?? 0).toLocaleString('en-GB')}
                          </strong>
                          <small className="text-[var(--muted-light)]">Total search appearances</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <Percent className="w-3.5 h-3.5 text-emerald-500" /> Average CTR
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {((gscReport.data.summary?.ctr ?? 0) * 100).toFixed(2)}%
                          </strong>
                          <small className="text-[var(--muted-light)]">Click-through rate</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Avg Position
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(gscReport.data.summary?.position ?? 0).toFixed(1)}
                          </strong>
                          <small className="text-[var(--muted-light)]">Average ranking across queries</small>
                        </div>
                      </div>

                      {/* Daily Trend Chart */}
                      {Array.isArray(gscReport.data.dailyTrend) && gscReport.data.dailyTrend.length > 0 && (
                        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <GoogleTrendChart
                            points={gscReport.data.dailyTrend.map(d => ({
                              date: d.date || '',
                              val1: Number(d.clicks) || 0,
                              val2: Number(d.impressions) || 0
                            }))}
                            label1="Clicks"
                            label2="Impressions"
                            color1="#0284c7"
                            color2="#8b5cf6"
                          />
                        </div>
                      )}

                      {/* Tables Sub-Navigation */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                gscActiveTab === 'queries'
                                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                              }`}
                              onClick={() => setGscActiveTab('queries')}
                            >
                              Top Search Queries ({(gscReport.data.topQueries || []).length})
                            </button>
                            <button
                              type="button"
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                gscActiveTab === 'pages'
                                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                              }`}
                              onClick={() => setGscActiveTab('pages')}
                            >
                              Top Pages ({(gscReport.data.topPages || []).length})
                            </button>
                          </div>

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={googleSearchFilter}
                              onChange={e => setGoogleSearchFilter(e.target.value)}
                              placeholder="Filter rows…"
                              className="pl-8 pr-3 py-1 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] w-48"
                            />
                          </div>
                        </div>

                        {/* Top Queries Table */}
                        {gscActiveTab === 'queries' && (
                          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] font-semibold">
                                <tr>
                                  <th className="py-2.5 px-3 w-10">#</th>
                                  <th className="py-2.5 px-3">Search Query</th>
                                  <th className="py-2.5 px-3 text-right">Clicks</th>
                                  <th className="py-2.5 px-3 text-right">Impressions</th>
                                  <th className="py-2.5 px-3 text-right">CTR</th>
                                  <th className="py-2.5 px-3 text-right">Avg Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {(gscReport.data.topQueries || [])
                                  .filter(q => !googleSearchFilter || (q.query || '').toLowerCase().includes(googleSearchFilter.toLowerCase()))
                                  .map((row, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--surface)] transition-colors">
                                      <td className="py-2 px-3 text-[var(--muted)]">{idx + 1}</td>
                                      <td className="py-2 px-3 font-medium text-[var(--foreground)]">{row.query}</td>
                                      <td className="py-2 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                                        {Number(row.clicks || 0).toLocaleString('en-GB')}
                                      </td>
                                      <td className="py-2 px-3 text-right text-[var(--muted)]">
                                        {Number(row.impressions || 0).toLocaleString('en-GB')}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono">
                                        {(Number(row.ctr || 0) * 100).toFixed(2)}%
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <span
                                          className={`badge ${
                                            Number(row.position || 0) <= 3
                                              ? 'badge-success'
                                              : Number(row.position || 0) <= 10
                                              ? 'badge-secondary'
                                              : 'badge-warning'
                                          }`}
                                        >
                                          {Number(row.position || 0).toFixed(1)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                {(gscReport.data.topQueries || []).length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="py-6 text-center text-[var(--muted)]">
                                      No query records available for selected period.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Top Pages Table */}
                        {gscActiveTab === 'pages' && (
                          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] font-semibold">
                                <tr>
                                  <th className="py-2.5 px-3 w-10">#</th>
                                  <th className="py-2.5 px-3">Indexed Page URL</th>
                                  <th className="py-2.5 px-3 text-right">Clicks</th>
                                  <th className="py-2.5 px-3 text-right">Impressions</th>
                                  <th className="py-2.5 px-3 text-right">CTR</th>
                                  <th className="py-2.5 px-3 text-right">Avg Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {(gscReport.data.topPages || [])
                                  .filter(p => !googleSearchFilter || (p.page || '').toLowerCase().includes(googleSearchFilter.toLowerCase()))
                                  .map((row, idx) => (
                                    <tr key={idx} className="hover:bg-[var(--surface)] transition-colors">
                                      <td className="py-2 px-3 text-[var(--muted)]">{idx + 1}</td>
                                      <td className="py-2 px-3 font-mono text-sky-600 dark:text-sky-400 break-all">
                                        <a href={row.page} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                          {row.page} <ExternalLink className="w-3 h-3 shrink-0" />
                                        </a>
                                      </td>
                                      <td className="py-2 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                                        {Number(row.clicks || 0).toLocaleString('en-GB')}
                                      </td>
                                      <td className="py-2 px-3 text-right text-[var(--muted)]">
                                        {Number(row.impressions || 0).toLocaleString('en-GB')}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono">
                                        {(Number(row.ctr || 0) * 100).toFixed(2)}%
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <span
                                          className={`badge ${
                                            Number(row.position || 0) <= 3
                                              ? 'badge-success'
                                              : Number(row.position || 0) <= 10
                                              ? 'badge-secondary'
                                              : 'badge-warning'
                                          }`}
                                        >
                                          {Number(row.position || 0).toFixed(1)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                {(gscReport.data.topPages || []).length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="py-6 text-center text-[var(--muted)]">
                                      No page records available for selected period.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] text-center space-y-2">
                      <Globe className="w-8 h-8 text-[var(--muted)] mx-auto" />
                      <h5 className="text-sm font-semibold text-[var(--foreground)] m-0">
                        Search Console Data Unavailable
                      </h5>
                      <p className="text-xs text-[var(--muted)] max-w-md mx-auto m-0">
                        {gscReport?.message || 'Awaiting client authorization. Zero metrics are fabricated until viewer access is granted in Google Search Console.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: Google Analytics 4 Reports */}
              {!loadingGoogleReports && (
                <div className="panel space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="eyebrow">AUDIENCE ENGAGEMENT TELEMETRY</span>
                      <h4 className="text-sm font-bold text-[var(--foreground)] m-0">Google Analytics 4 Performance</h4>
                    </div>
                    {ga4Report?.data && (
                      <span className="badge badge-success">
                        <CheckCircle className="w-3 h-3 mr-1" /> Real GA4 Telemetry
                      </span>
                    )}
                  </div>

                  {ga4Report?.status === 'connected' && ga4Report.data ? (
                    <div className="space-y-4">
                      {/* KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <Globe className="w-3.5 h-3.5 text-emerald-500" /> Total Sessions
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(ga4Report.data.summary?.sessions ?? 0).toLocaleString('en-GB')}
                          </strong>
                          <small className="text-[var(--muted-light)]">Total user sessions</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <Eye className="w-3.5 h-3.5 text-sky-500" /> Pageviews
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(ga4Report.data.summary?.screenPageViews ?? 0).toLocaleString('en-GB')}
                          </strong>
                          <small className="text-[var(--muted-light)]">Total page views</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> Engaged Sessions
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(ga4Report.data.summary?.engagedSessions ?? 0).toLocaleString('en-GB')}
                          </strong>
                          <small className="text-[var(--muted-light)]">&gt;10s duration or 2+ views</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <Percent className="w-3.5 h-3.5 text-indigo-500" /> Engagement Rate
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {((ga4Report.data.summary?.engagementRate ?? 0) * 100).toFixed(1)}%
                          </strong>
                          <small className="text-[var(--muted-light)]">Engaged session ratio</small>
                        </div>

                        <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <span className="text-[var(--muted)] flex items-center gap-1.5 mb-1 font-medium">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Conversions
                          </span>
                          <strong className="text-xl font-bold text-[var(--foreground)] block">
                            {Number(ga4Report.data.summary?.conversions ?? 0).toLocaleString('en-GB')}
                          </strong>
                          <small className="text-[var(--muted-light)]">Key events / conversions</small>
                        </div>
                      </div>

                      {/* Daily Sessions Chart */}
                      {Array.isArray(ga4Report.data.dailyTrend) && ga4Report.data.dailyTrend.length > 0 && (
                        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                          <GoogleTrendChart
                            points={ga4Report.data.dailyTrend.map(d => ({
                              date: d.date || '',
                              val1: Number(d.sessions) || 0,
                              val2: Number(d.engagedSessions) || 0
                            }))}
                            label1="Sessions"
                            label2="Engaged Sessions"
                            color1="#10b981"
                            color2="#3b82f6"
                          />
                        </div>
                      )}

                      {/* Top Landing Pages Table */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-[var(--foreground)] m-0">
                            Top Landing Pages ({(ga4Report.data.landingPages || []).length})
                          </h5>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-[var(--surface)] border-b border-[var(--border)] text-[var(--muted)] font-semibold">
                              <tr>
                                <th className="py-2.5 px-3 w-10">#</th>
                                <th className="py-2.5 px-3">Landing Page</th>
                                <th className="py-2.5 px-3 text-right">Sessions</th>
                                <th className="py-2.5 px-3 text-right">Pageviews</th>
                                <th className="py-2.5 px-3 text-right">Engaged Sessions</th>
                                <th className="py-2.5 px-3 text-right">Engagement Rate</th>
                                <th className="py-2.5 px-3 text-right">Conversions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {(ga4Report.data.landingPages || []).map((row, idx) => (
                                <tr key={idx} className="hover:bg-[var(--surface)] transition-colors">
                                  <td className="py-2 px-3 text-[var(--muted)]">{idx + 1}</td>
                                  <td className="py-2 px-3 font-mono text-[var(--foreground)]">{row.landingPage}</td>
                                  <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                    {Number(row.sessions || 0).toLocaleString('en-GB')}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium text-[var(--foreground)]">
                                    {Number(row.screenPageViews || 0).toLocaleString('en-GB')}
                                  </td>
                                  <td className="py-2 px-3 text-right text-[var(--muted)]">
                                    {Number(row.engagedSessions || 0).toLocaleString('en-GB')}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {(Number(row.engagementRate || 0) * 100).toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {Number(row.conversions || 0).toLocaleString('en-GB')}
                                  </td>
                                </tr>
                              ))}
                              {(ga4Report.data.landingPages || []).length === 0 && (
                                <tr>
                                  <td colSpan={7} className="py-6 text-center text-[var(--muted)]">
                                    No landing page records recorded for selected period.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] text-center space-y-2">
                      <BarChart3 className="w-8 h-8 text-[var(--muted)] mx-auto" />
                      <h5 className="text-sm font-semibold text-[var(--foreground)] m-0">
                        GA4 Analytics Data Unavailable
                      </h5>
                      <p className="text-xs text-[var(--muted)] max-w-md mx-auto m-0">
                        {ga4Report?.message || 'Awaiting client authorization. Zero metrics are fabricated until viewer access is granted in Google Analytics 4.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Truthful Reporting Integrity Card */}
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted)] space-y-1">
                <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Truthful First-Party Telemetry Guarantee
                </div>
                <p className="m-0">• Zero metrics, ranks, clicks, or impressions are fabricated or simulated.</p>
                <p className="m-0">• FirstRead connects exclusively via official Google Search Console and GA4 Data APIs.</p>
                <p className="m-0">• Credentials are stored strictly server-side and never exposed in client bundles or network logs.</p>
              </div>
            </div>
            </SectionErrorBoundary>
          )}
        </>
      )}
    </div>
  );
}
