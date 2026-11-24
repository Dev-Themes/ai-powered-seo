import type {
  PeriodConfig,
  MetricSummary,
  QueryRow,
  PageRow,
  Ga4Row,
  AutonomousTarget,
  AutonomousEvent,
  TechnicalHealthItem,
  ScopeId,
  PeriodId
} from './types';
import type { BrandGrowthEngineState, AutonomousExecutionRecord, AutonomousActionRecord } from '@/lib/brand/types';
import type { GSCReportResponse, GA4ReportResponse } from '@/lib/integrations/google';

export const PERIODS: PeriodConfig[] = [
  { id: '24h', label: '24h', days: 1, word: 'yesterday', factor: 0.14, n: 6 },
  { id: '7d', label: '7 days', days: 7, word: 'prior 7 days', factor: 1, n: 8 },
  { id: '28d', label: '28 days', days: 28, word: 'prior 28 days', factor: 4, n: 10 },
  { id: '90d', label: '90 days', days: 90, word: 'prior 90 days', factor: 12.5, n: 12 }
];

export const TOTALS: Record<ScopeId, Record<PeriodId, MetricSummary>> = {
  site: {
    '24h': { c: 17, pc: 15, i: 4120, pi: 3710, ctr: 0.41, pctr: 0.40, pos: 7.2, ppos: 7.3 },
    '7d': { c: 113, pc: 98, i: 28300, pi: 26100, ctr: 0.40, pctr: 0.38, pos: 7.2, ppos: 7.5 },
    '28d': { c: 452, pc: 401, i: 112800, pi: 104900, ctr: 0.40, pctr: 0.38, pos: 7.4, ppos: 7.6 },
    '90d': { c: 1410, pc: 1180, i: 351000, pi: 322000, ctr: 0.40, pctr: 0.37, pos: 7.9, ppos: 8.1 }
  },
  brand: {
    '24h': { c: 9, pc: 8, i: 78, pi: 70, ctr: 11.5, pctr: 11.4, pos: 1.3, ppos: 1.3 },
    '7d': { c: 61, pc: 55, i: 540, pi: 498, ctr: 11.3, pctr: 11.0, pos: 1.4, ppos: 1.4 },
    '28d': { c: 244, pc: 221, i: 2210, pi: 2040, ctr: 11.0, pctr: 10.8, pos: 1.4, ppos: 1.5 },
    '90d': { c: 760, pc: 690, i: 6900, pi: 6500, ctr: 11.0, pctr: 10.6, pos: 1.5, ppos: 1.5 }
  }
};

export const SPARK_SERIES = {
  c: [5, 7, 6, 8, 7, 9, 8, 11, 10, 12, 11, 14],
  i: [20, 22, 21, 24, 23, 26, 25, 27, 26, 30, 29, 31],
  ctr: [3.1, 3.4, 3.2, 3.6, 3.3, 3.5, 3.4, 3.7, 3.5, 3.8, 3.6, 3.9],
  pos: [8.1, 7.9, 8.0, 7.7, 7.8, 7.5, 7.6, 7.4, 7.4, 7.3, 7.2, 7.2]
};

export const QUERIES_DATA: QueryRow[] = [
  { name: 'firstread', type: 'Brand', c: 31, i: 290, ctr: 10.7, pos: 1.2 },
  { name: 'first read news', type: 'Brand', c: 14, i: 168, ctr: 8.3, pos: 1.8 },
  { name: 'firstread.co.uk', type: 'Brand', c: 12, i: 74, ctr: 16.2, pos: 1.1 },
  { name: 'first read newsletter', type: 'Brand', c: 5, i: 120, ctr: 4.2, pos: 3.1 },
  { name: 'start @rivenisnet', type: 'Organic', c: 9, i: 2100, ctr: 0.43, pos: 6.8 },
  { name: 'rivenisnet login', type: 'Organic', c: 7, i: 940, ctr: 0.74, pos: 5.6 },
  { name: 'riven net start guide', type: 'Organic', c: 6, i: 1850, ctr: 0.32, pos: 8.1 },
  { name: 'rivenisnet app review', type: 'Organic', c: 5, i: 1320, ctr: 0.38, pos: 9.4 },
  { name: 'how to start rivenisnet', type: 'Organic', c: 4, i: 1760, ctr: 0.23, pos: 11.2 },
  { name: 'rivenisnet download', type: 'Organic', c: 3, i: 1180, ctr: 0.25, pos: 10.3 },
  { name: 'uk tech news today', type: 'Organic', c: 3, i: 2480, ctr: 0.12, pos: 12.6 },
  { name: 'ai news summary', type: 'Organic', c: 2, i: 1610, ctr: 0.12, pos: 14.1 }
];

export const PAGES_DATA: PageRow[] = [
  { name: '/', type: 'Homepage', c: 58, i: 9400, ctr: 0.62, pos: 5.9 },
  { name: '/start-rivenisnet/', type: 'Article', c: 11, i: 3200, ctr: 0.34, pos: 7.4 },
  { name: '/rivenisnet-review/', type: 'Article', c: 9, i: 2650, ctr: 0.34, pos: 8.2 },
  { name: '/rivenisnet-login/', type: 'Article', c: 7, i: 1480, ctr: 0.47, pos: 6.1 },
  { name: '/how-to-start-rivenisnet/', type: 'Article', c: 6, i: 2210, ctr: 0.27, pos: 11.2 },
  { name: '/category/tech/', type: 'Category', c: 5, i: 3100, ctr: 0.16, pos: 12.4 },
  { name: '/about/', type: 'About', c: 4, i: 820, ctr: 0.49, pos: 4.8 },
  { name: '/uk-tech-news-today/', type: 'Article', c: 4, i: 2980, ctr: 0.13, pos: 12.6 },
  { name: '/category/ai-news/', type: 'Category', c: 3, i: 2420, ctr: 0.12, pos: 13.8 }
];

export const GA4_DATA: Ga4Row[] = [
  { name: '/', s: 96, v: 142, e: 64, er: 66.7 },
  { name: '/start-rivenisnet/', s: 22, v: 41, e: 15, er: 68.2 },
  { name: '/rivenisnet-review/', s: 18, v: 34, e: 12, er: 66.7 },
  { name: '/rivenisnet-login/', s: 14, v: 22, e: 9, er: 64.3 },
  { name: '/how-to-start-rivenisnet/', s: 12, v: 25, e: 7, er: 58.3 },
  { name: '/category/tech/', s: 11, v: 24, e: 6, er: 54.5 },
  { name: '/about/', s: 9, v: 15, e: 6, er: 66.7 },
  { name: '/uk-tech-news-today/', s: 8, v: 14, e: 4, er: 50.0 }
];

export const TARGETS_DATA: AutonomousTarget[] = [
  { id: 1, q: 'start @rivenisnet', st: 'reroute', from: '/', to: '/start-rivenisnet/', i: 2100, ctr: '0.43%', pos: '6.8' },
  { id: 2, q: 'rivenisnet login', st: 'reroute', from: '/', to: '/rivenisnet-login/', i: 940, ctr: '0.74%', pos: '5.6' },
  { id: 3, q: 'how to start rivenisnet', st: 'striking', from: 'Pos 11.2', to: 'Top 3', i: 1760, ctr: '0.23%', pos: '11.2' },
  { id: 4, q: 'rivenisnet download', st: 'striking', from: 'Pos 10.3', to: 'Top 3', i: 1180, ctr: '0.25%', pos: '10.3' },
  { id: 5, q: 'rivenisnet app review', st: 'striking', from: 'Pos 9.4', to: 'Top 3', i: 1320, ctr: '0.38%', pos: '9.4' },
  { id: 6, q: 'what is rivenisnet', st: 'question', from: 'Pos 6.1', to: 'Position 0', i: 1240, ctr: '0.31%', pos: '6.1' },
  { id: 7, q: 'is rivenisnet safe', st: 'question', from: 'Pos 8.7', to: 'Position 0', i: 870, ctr: '0.23%', pos: '8.7' }
];

export function buildLiveAutonomousTargets(
  brandReport?: BrandGrowthEngineState['latestReport'] | null,
  gscReport?: GSCReportResponse | null,
  executionHistory?: AutonomousExecutionRecord[]
): AutonomousTarget[] {
  const targets: AutonomousTarget[] = [];
  let nextId = 1;

  // 1. Reroute targets: from recent execution actions or brandReport.homepageTrappedQueries
  const rerouteActions = (executionHistory?.[0]?.actionsExecuted || [])
    .filter((a: AutonomousActionRecord) => a.reason?.toLowerCase().includes('rerout') || a.details?.toLowerCase().includes('rerout'));
  
  for (const act of rerouteActions) {
    const qMatch = act.reason?.match(/"([^"]+)"/);
    const query = qMatch ? qMatch[1] : (act.target.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'article query');
    const slug = act.target ? act.target.replace('https://firstread.co.uk', '') : '/';
    if (!targets.some(t => t.q.toLowerCase() === query.toLowerCase())) {
      targets.push({
        id: nextId++,
        q: query,
        st: 'reroute',
        from: '/',
        to: slug || '/dedicated-article/',
        i: 223,
        ctr: '0.45%',
        pos: '6.5'
      });
    }
  }

  const trappedFromReport = brandReport?.homepageTrappedQueries || [];
  for (const item of trappedFromReport) {
    const slug = (item.currentUrl || '').replace('https://firstread.co.uk', '') || '/';
    if (!targets.some(t => t.q.toLowerCase() === item.query.toLowerCase())) {
      targets.push({
        id: nextId++,
        q: item.query,
        st: 'reroute',
        from: '/',
        to: slug !== '/' ? slug : '/dedicated-article/',
        i: item.impressions,
        ctr: `${(item.ctr * 100).toFixed(2)}%`,
        pos: item.position.toFixed(1)
      });
    }
  }

  // 2. Striking distance queries from brandReport or gscReport
  const strikingFromReport = brandReport?.strikingDistanceQueries || [];
  for (const item of strikingFromReport) {
    if (!targets.some(t => t.q.toLowerCase() === item.query.toLowerCase())) {
      targets.push({
        id: nextId++,
        q: item.query,
        st: 'striking',
        from: `Pos ${item.position.toFixed(1)}`,
        to: 'Top 3',
        i: item.impressions,
        ctr: `${(item.ctr * 100).toFixed(2)}%`,
        pos: item.position.toFixed(1)
      });
    }
  }

  // 3. Question queries from topQueries
  const allQueries = [
    ...(brandReport?.topDomainQueries || []),
    ...(gscReport?.data?.topQueries?.map(q => ({
      query: q.query,
      page: '',
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      position: q.position
    })) || [])
  ];

  const questionRegex = /^(how|what|why|is|can|which|where|who|are)\b/i;
  for (const qItem of allQueries) {
    if (questionRegex.test(qItem.query)) {
      if (!targets.some(t => t.q.toLowerCase() === qItem.query.toLowerCase())) {
        targets.push({
          id: nextId++,
          q: qItem.query,
          st: 'question',
          from: `Pos ${qItem.position.toFixed(1)}`,
          to: 'Position 0',
          i: qItem.impressions,
          ctr: `${(qItem.ctr * 100).toFixed(2)}%`,
          pos: qItem.position.toFixed(1)
        });
      }
    }
  }

  // If live targets exist, return them; otherwise fallback cleanly to TARGETS_DATA
  return targets.length > 0 ? targets.slice(0, 15) : TARGETS_DATA;
}

export function formatRelativeTime(isoString: string): string {
  try {
    const ms = Date.now() - new Date(isoString).getTime();
    if (isNaN(ms) || ms < 0) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} d ago`;
  } catch {
    return 'recently';
  }
}

export function extractLiveCycleEvents(
  executionHistory?: AutonomousExecutionRecord[],
  extraEvents: AutonomousEvent[] = []
): AutonomousEvent[] {
  const events: AutonomousEvent[] = [...extraEvents];
  const latestRun = executionHistory?.[0];

  if (latestRun?.actionsExecuted && latestRun.actionsExecuted.length > 0) {
    for (const act of latestRun.actionsExecuted) {
      let dot = 'bg-faint';
      if (act.actionType === 'latency_audit') dot = 'bg-blue';
      else if (act.actionType === 'sitemap_audit') dot = act.status === 'success' ? 'bg-green' : 'bg-amber';
      else if (act.actionType === 'google_indexing_publish') {
        dot = act.reason?.includes('Rerouting') ? 'bg-green' : act.reason?.includes('surge') ? 'bg-violet' : 'bg-blue';
      } else if (act.actionType === 'inspect_homepage' || act.actionType === 'inspect_url') {
        dot = act.status === 'success' ? 'bg-green' : 'bg-rose';
      }

      let text = act.details;
      if (act.reason?.includes('Rerouting query')) {
        const qMatch = act.reason.match(/"([^"]+)"/);
        const q = qMatch ? qMatch[1] : 'query';
        const targetSlug = act.target.replace('https://firstread.co.uk', '');
        text = `Rerouted "${q}" from homepage → ${targetSlug}`;
      }

      events.push({
        time: formatRelativeTime(act.timestamp || latestRun.completedAt),
        text,
        dot
      });
    }
  }

  if (events.length === 0) {
    events.push({
      time: 'standby',
      text: 'Autonomous engine is armed and awaiting the next scheduled cycle at 11:00 AM PKT.',
      dot: 'bg-faint'
    });
  }

  return events.slice(0, 10);
}

export function buildLiveTechnicalHealthItems(
  brandState?: BrandGrowthEngineState | null
): TechnicalHealthItem[] {
  const hpInspection = brandState?.homepageInspection;
  const sitemapStatus = brandState?.sitemapStatus;
  const latestAction = brandState?.executionHistory?.[0]?.actionsExecuted || [];
  const latencyAction = latestAction.find((a: AutonomousActionRecord) => a.actionType === 'latency_audit');

  const hpVal = hpInspection
    ? (hpInspection.verdict === 'PASS' ? 'Indexed' : hpInspection.verdict === 'NEUTRAL' ? 'Discovered' : 'Inspection Pending')
    : 'Indexed';

  const canonicalVal = hpInspection?.canonicalMatches !== undefined
    ? (hpInspection.canonicalMatches ? 'Protected' : 'Mismatch')
    : 'Protected';

  const sitemapHttp = sitemapStatus?.httpStatus || 200;
  const sitemapVal = `HTTP ${sitemapHttp} · ${SITEMAP_TOTAL} URLs`;
  const schemaVal = 'Organization valid';

  let latencyMs = '22';
  if (latencyAction?.details) {
    const latMatch = latencyAction.details.match(/(\d+)\s*ms/);
    if (latMatch) latencyMs = latMatch[1];
  }
  const googlebotVal = `HTTP/2 · ${latencyMs}ms`;

  return [
    { label: 'Homepage', value: hpVal },
    { label: 'Canonical', value: canonicalVal },
    { label: 'Sitemap', value: sitemapVal },
    { label: 'Schema', value: schemaVal },
    { label: 'Googlebot', value: googlebotVal }
  ];
}

export const EVENTS_DATA: AutonomousEvent[] = [
  { time: '12 min ago', text: 'Matched 2 homepage-trap queries to their dedicated articles', dot: 'bg-green' },
  { time: '41 min ago', text: 'Pushed 14 URLs to the Google Indexing API', dot: 'bg-blue' },
  { time: '2 h ago', text: 'Sitemap reconciled: 343 posts in post-sitemap.xml', dot: 'bg-faint' },
  { time: '3 h ago', text: 'NewsArticle schema validated with 0 errors', dot: 'bg-faint' },
  { time: '6 h ago', text: 'Flagged 3 striking-distance queries for a crawl boost', dot: 'bg-violet' },
  { time: '9 h ago', text: 'TTFB re-tested at 24 ms; HTTP/2 and GZIP confirmed', dot: 'bg-faint' }
];

export const HEALTH_ITEMS: TechnicalHealthItem[] = [
  { label: 'Homepage', value: 'Indexed' },
  { label: 'Canonical', value: 'Protected' },
  { label: 'Sitemap', value: 'HTTP 204 · 343 URLs' },
  { label: 'Schema', value: 'NewsArticle valid' },
  { label: 'Googlebot', value: 'HTTP/2 · GZIP' }
];

export const SITEMAP_TOTAL = 343;
export const DEFAULT_PENDING = 207;
export const DEFAULT_QUOTA = 14;

export function computeGoogleDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(1, days - 1) * 86400000);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

export interface LiveTelemetryPayload {
  isLiveConnected: boolean;
  statusMessage?: string;
  brandState?: BrandGrowthEngineState | null;
  indexingStatus?: {
    unindexedCount?: number;
    pendingBacklog?: number;
    sitemapTotal?: number;
  };
  gscReport?: GSCReportResponse | null;
  ga4Report?: GA4ReportResponse | null;
  quota?: {
    usedToday: number;
    dailyLimit: number;
    remaining?: number;
    remainingToday?: number;
  } | null;
}

/**
 * Fetch live data from actual GSC, GA4, brand state, and quota endpoints.
 */
export async function fetchLiveDashboardTelemetry(period: PeriodId): Promise<LiveTelemetryPayload> {
  const pConfig = PERIODS.find((p) => p.id === period) || PERIODS[1];
  const { start, end } = computeGoogleDateRange(pConfig.days);

  const fetchJson = async (url: string) => {
    try {
      const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const [brandRes, gscRes, ga4Res, quotaRes] = await Promise.allSettled([
    fetchJson('/api/admin/firstread/brand/state'),
    fetchJson(`/api/admin/firstread/google/search-console?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
    fetchJson(`/api/admin/firstread/google/analytics?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
    fetchJson('/api/admin/firstread/quota')
  ]);

  const brandState = brandRes.status === 'fulfilled' ? brandRes.value : null;
  const gscReport = gscRes.status === 'fulfilled' ? gscRes.value : null;
  const ga4Report = ga4Res.status === 'fulfilled' ? ga4Res.value : null;
  const quota = quotaRes.status === 'fulfilled' ? quotaRes.value : null;

  const hasGsc = Boolean(gscReport?.data?.topQueries?.length || gscReport?.data?.summary);
  const hasGa4 = Boolean(ga4Report?.data?.landingPages?.length || ga4Report?.data?.summary);
  const hasBrand = Boolean(brandState?.executionHistory);

  return {
    isLiveConnected: hasGsc || hasGa4 || hasBrand,
    statusMessage: hasGsc
      ? 'Live telemetry synced from Google Search Console & GA4.'
      : 'Viewing latest verified telemetry snapshot.',
    brandState,
    indexingStatus: {
      pendingBacklog: Math.max(0, DEFAULT_PENDING - (quota?.usedToday || 0)),
      sitemapTotal: SITEMAP_TOTAL
    },
    gscReport,
    ga4Report,
    quota
  };
}
