/**
 * Brand Keyword Growth & Autonomous Indexing Types
 * Focus: "firstread" on https://firstread.co.uk/
 */

export type TargetBrandQuery =
  | 'firstread'
  | 'first read'
  | 'firstread.co.uk'
  | 'firstread uk'
  | 'firstread news';

export interface BrandQueryMetric {
  query: string;
  isExactBrand: boolean;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  landingPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export interface PeriodComparison<T> {
  current: T;
  previous: T;
  absoluteChange: number;
  percentageChange: number | null;
  trend: 'improving' | 'declining' | 'stable';
}

export interface BrandPerformanceSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

export interface BrandAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type:
    | 'declining_impressions'
    | 'declining_clicks'
    | 'ranking_deterioration'
    | 'low_ctr'
    | 'homepage_visibility'
    | 'query_shift'
    | 'indexing_issue'
    | 'sitemap_issue';
  title: string;
  description: string;
  metric?: string;
  currentValue?: number | string;
  previousValue?: number | string;
  recommendation: string;
  detectedAt: string;
}

export interface BrandKeywordReport {
  targetDomain: 'https://firstread.co.uk/';
  primaryBrandKeyword: 'firstread';
  generatedAt: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  exactBrand: BrandQueryMetric | null;
  variations: BrandQueryMetric[];
  otherBrandedQueries: BrandQueryMetric[];
  totalBrandedSummary: BrandPerformanceSummary;
  comparison7d: {
    clicks: PeriodComparison<number>;
    impressions: PeriodComparison<number>;
    ctr: PeriodComparison<number>;
    position: PeriodComparison<number>;
  } | null;
  comparison28d: {
    clicks: PeriodComparison<number>;
    impressions: PeriodComparison<number>;
    ctr: PeriodComparison<number>;
    position: PeriodComparison<number>;
  } | null;
  homepagePerformance: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    isRankingNumberOne: boolean;
  };
  alerts: BrandAlert[];
}

export interface GA4BrandOrganicCorrelation {
  period: { startDate: string; endDate: string };
  totalOrganicSessions: number;
  totalOrganicUsers: number;
  totalOrganicPageviews: number;
  averageEngagementRate: number;
  homepageOrganicSessions: number;
  homepageShareOfOrganic: number;
  nonHomepageOrganicSessions: number;
  correlatedGscBrandClicks: number;
  brandToOrganicHomepageRatio: number | null;
  landingPages: Array<{
    landingPage: string;
    sessions: number;
    pageviews: number;
    users: number;
    engagementRate: number;
    isHomepage: boolean;
  }>;
}

export interface UrlInspectionResult {
  url: string;
  inspectedAt: string;
  verdict: 'PASS' | 'NEUTRAL' | 'FAIL' | 'UNSPECIFIED';
  coverageState: string;
  robotsTxtState: 'ALLOWED' | 'DISALLOWED' | 'UNSPECIFIED';
  indexingState: 'INDEXING_ALLOWED' | 'BLOCKED_BY_META_TAG' | 'UNSPECIFIED';
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  canonicalMatches: boolean;
  crawledAs?: string;
  isDiscoveredNotIndexed: boolean;
  isCrawledNotIndexed: boolean;
  issues: string[];
}

export interface GscSitemapEntry {
  path: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  lastDownloaded?: string;
  warnings?: number;
  errors?: number;
  contents?: Array<{
    type?: string;
    submitted?: number;
    indexed?: number;
  }>;
}

export interface SitemapAuditStatus {
  sitemapIndexUrl: string;
  accessibleOnWeb: boolean;
  httpStatus: number;
  detectedChildSitemaps: string[];
  gscSubmittedSitemaps: GscSitemapEntry[];
  isSubmittedToGsc: boolean;
  needsSubmission: boolean;
  submissionJustification?: string;
  lastSubmissionAttempt?: string;
  lastSubmissionResult?: 'success' | 'failed' | 'not_needed' | 'permission_denied';
}

export interface TechnicalDiscoveryIssue {
  id: string;
  category: 'protocol' | 'robots' | 'canonical' | 'sitemap' | 'indexing';
  severity: 'critical' | 'warning' | 'info';
  targetUrl: string;
  title: string;
  description: string;
  recommendation: string;
  detectedAt: string;
}

export interface AutonomousActionRecord {
  id: string;
  timestamp: string;
  actionType:
    | 'sitemap_submit'
    | 'sitemap_ping'
    | 'google_indexing_publish'
    | 'inspect_homepage'
    | 'inspect_url'
    | 'verify_robots'
    | 'verify_canonical'
    | 'audit_schema'
    | 'recheck_indexing';
  target: string;
  status: 'success' | 'failed' | 'skipped';
  details: string;
  reason: string;
  error?: string;
}

export interface StorageSyncStatus {
  durable: boolean;
  provider: 'github' | 'local_tmp' | 'fallback';
  branch?: string;
  sha?: string;
  lastSyncAt?: string;
  error?: string;
}

export interface AutonomousExecutionRecord {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: 'success' | 'warning' | 'failed';
  actionsExecuted: AutonomousActionRecord[];
  alertsCount: number;
  discoveryIssuesCount: number;
  brandClicks: number;
  brandImpressions: number;
  homepageIndexed: boolean;
  summary: string;
  storageStatus?: StorageSyncStatus;
}

export interface BrandGrowthEngineState {
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error';
  paused: boolean;
  lastRunAt: string | null;
  runningSince?: string | null;
  nextScheduledRunAt: string | null;
  safeRetryCount: number;
  safeRetryLimit: number;
  latestReport: BrandKeywordReport | null;
  latestGa4Correlation: GA4BrandOrganicCorrelation | null;
  homepageInspection: UrlInspectionResult | null;
  recentInspections: UrlInspectionResult[];
  sitemapStatus: SitemapAuditStatus | null;
  discoveryIssues: TechnicalDiscoveryIssue[];
  executionHistory: AutonomousExecutionRecord[];
  storageStatus?: StorageSyncStatus;
}
