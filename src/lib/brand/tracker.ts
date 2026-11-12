import {
  createAuthorizedJWT,
  getGoogleConfig,
  getGoogleCredentials,
  sanitizeGoogleError
} from '../integrations/google';
import type {
  BrandKeywordReport,
  BrandQueryMetric,
  BrandPerformanceSummary,
  PeriodComparison,
  BrandAlert,
  GA4BrandOrganicCorrelation
} from './types';

export const TARGET_DOMAIN = 'https://firstread.co.uk/';
export const PRIMARY_BRAND_KEYWORD = 'firstread';

export const BRAND_VARIATIONS: string[] = [
  'firstread',
  'first read',
  'firstread.co.uk',
  'firstread uk',
  'firstread news'
];

interface GscApiRow {
  keys: string[]; // [query, page] or [query]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscApiResponse {
  rows?: GscApiRow[];
}

interface GA4ApiResponse {
  rows?: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
}

/**
 * Normalizes query string for brand matching
 */
export function normalizeQuery(query: string): string {
  return (query || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Checks if a query is an exact or variation match for FirstRead brand
 */
export function isBrandQuery(query: string): boolean {
  const norm = normalizeQuery(query);
  if (!norm) return false;
  if (norm === 'firstread' || norm === 'first read') return true;
  if (norm.includes('firstread') || norm.includes('first read')) return true;
  return false;
}

/**
 * Computes comparative period metrics (current vs previous)
 */
export function computePeriodComparison(
  current: number,
  previous: number,
  metricType: 'clicks' | 'impressions' | 'ctr' | 'position'
): PeriodComparison<number> {
  const absoluteChange = Number((current - previous).toFixed(4));
  let percentageChange: number | null = null;
  if (previous > 0) {
    percentageChange = Number((((current - previous) / previous) * 100).toFixed(2));
  }

  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (metricType === 'position') {
    // For position, a lower number is better
    if (absoluteChange < -0.1) trend = 'improving';
    else if (absoluteChange > 0.1) trend = 'declining';
  } else {
    // For clicks, impressions, CTR, a higher number is better
    if (absoluteChange > 0.001) trend = 'improving';
    else if (absoluteChange < -0.001) trend = 'declining';
  }

  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
    trend
  };
}

/**
 * Fetches GSC query and page data for a specific date window
 */
async function fetchGscWindowData(
  startDate: string,
  endDate: string
): Promise<GscApiRow[]> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  if (!creds || !config.gscSiteUrl) return [];

  const jwt = createAuthorizedJWT([
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters'
  ]);
  if (!jwt) return [];

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl)}/searchAnalytics/query`;

  try {
    const res = await jwt.request<GscApiResponse>({
      url,
      method: 'POST',
      data: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: 500
      }
    });
    return res.data?.rows || [];
  } catch (err) {
    console.warn('[Brand Tracker] GSC window query error:', sanitizeGoogleError(err));
    return [];
  }
}

/**
 * Builds aggregated query metrics from GSC raw rows
 */
function aggregateBrandQueries(rows: GscApiRow[]): {
  exactBrand: BrandQueryMetric | null;
  variations: BrandQueryMetric[];
  otherBrandedQueries: BrandQueryMetric[];
  totalBrandedSummary: BrandPerformanceSummary;
  homepagePerformance: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    isRankingNumberOne: boolean;
  };
} {
  const queryMap = new Map<string, {
    clicks: number;
    impressions: number;
    weightedPos: number;
    pages: Map<string, { clicks: number; impressions: number; weightedPos: number }>;
  }>();

  let homepageClicks = 0;
  let homepageImpressions = 0;
  let homepageWeightedPos = 0;

  for (const row of rows) {
    const rawQuery = row.keys[0] || '';
    const page = row.keys[1] || '';
    const norm = normalizeQuery(rawQuery);

    if (!isBrandQuery(norm)) continue;

    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const pos = row.position || 0;

    if (!queryMap.has(norm)) {
      queryMap.set(norm, {
        clicks: 0,
        impressions: 0,
        weightedPos: 0,
        pages: new Map()
      });
    }

    const qEntry = queryMap.get(norm)!;
    qEntry.clicks += clicks;
    qEntry.impressions += impressions;
    qEntry.weightedPos += pos * impressions;

    if (page) {
      if (!qEntry.pages.has(page)) {
        qEntry.pages.set(page, { clicks: 0, impressions: 0, weightedPos: 0 });
      }
      const pEntry = qEntry.pages.get(page)!;
      pEntry.clicks += clicks;
      pEntry.impressions += impressions;
      pEntry.weightedPos += pos * impressions;
    }

    // Track homepage performance for branded queries
    if (page === 'https://firstread.co.uk/' || page === 'https://firstread.co.uk') {
      homepageClicks += clicks;
      homepageImpressions += impressions;
      homepageWeightedPos += pos * impressions;
    }
  }

  const allBrandMetrics: BrandQueryMetric[] = [];
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalWeightedPos = 0;

  for (const [normQuery, data] of queryMap.entries()) {
    const avgPos = data.impressions > 0 ? Number((data.weightedPos / data.impressions).toFixed(2)) : 0;
    const ctr = data.impressions > 0 ? Number((data.clicks / data.impressions).toFixed(4)) : 0;

    totalClicks += data.clicks;
    totalImpressions += data.impressions;
    totalWeightedPos += data.weightedPos;

    const landingPages: Array<{
      page: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }> = [];

    for (const [pUrl, pData] of data.pages.entries()) {
      const pAvgPos = pData.impressions > 0 ? Number((pData.weightedPos / pData.impressions).toFixed(2)) : 0;
      const pCtr = pData.impressions > 0 ? Number((pData.clicks / pData.impressions).toFixed(4)) : 0;
      landingPages.push({
        page: pUrl,
        clicks: pData.clicks,
        impressions: pData.impressions,
        ctr: pCtr,
        position: pAvgPos
      });
    }

    landingPages.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

    allBrandMetrics.push({
      query: normQuery,
      isExactBrand: normQuery === 'firstread',
      clicks: data.clicks,
      impressions: data.impressions,
      ctr,
      position: avgPos,
      landingPages
    });
  }

  // Separate exact brand from recognized variations and other matches
  const exactBrand = allBrandMetrics.find(m => m.query === 'firstread') || null;
  const variationTargets = new Set(BRAND_VARIATIONS.filter(v => v !== 'firstread'));
  const variations: BrandQueryMetric[] = [];
  const otherBrandedQueries: BrandQueryMetric[] = [];

  for (const m of allBrandMetrics) {
    if (m.query === 'firstread') continue;
    if (variationTargets.has(m.query)) {
      variations.push(m);
    } else {
      otherBrandedQueries.push(m);
    }
  }

  // Ensure all configured variations exist in report even if 0 data
  for (const v of variationTargets) {
    if (!variations.some(m => m.query === v)) {
      variations.push({
        query: v,
        isExactBrand: false,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        landingPages: []
      });
    }
  }

  const overallAvgPos = totalImpressions > 0 ? Number((totalWeightedPos / totalImpressions).toFixed(2)) : 0;
  const overallCtr = totalImpressions > 0 ? Number((totalClicks / totalImpressions).toFixed(4)) : 0;

  const hpAvgPos = homepageImpressions > 0 ? Number((homepageWeightedPos / homepageImpressions).toFixed(2)) : 0;
  const hpCtr = homepageImpressions > 0 ? Number((homepageClicks / homepageImpressions).toFixed(4)) : 0;

  return {
    exactBrand,
    variations,
    otherBrandedQueries,
    totalBrandedSummary: {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: overallCtr,
      averagePosition: overallAvgPos
    },
    homepagePerformance: {
      clicks: homepageClicks,
      impressions: homepageImpressions,
      ctr: hpCtr,
      position: hpAvgPos,
      isRankingNumberOne: hpAvgPos > 0 && hpAvgPos <= 1.5
    }
  };
}

/**
 * Analyzes metrics and triggers brand alerts
 */
export function evaluateBrandAlerts(
  currentSummary: BrandPerformanceSummary,
  prev7dSummary: BrandPerformanceSummary | null,
  prev28dSummary: BrandPerformanceSummary | null,
  homepagePerf: {
    clicks: number;
    impressions: number;
    position: number;
    isRankingNumberOne: boolean;
  }
): BrandAlert[] {
  const alerts: BrandAlert[] = [];
  const timestamp = new Date().toISOString();

  // 1. Declining impressions check (28d)
  if (prev28dSummary && prev28dSummary.impressions > 0) {
    const impChangePct = ((currentSummary.impressions - prev28dSummary.impressions) / prev28dSummary.impressions) * 100;
    if (impChangePct < -10) {
      alerts.push({
        id: `alert-imp-decline-${Date.now()}`,
        severity: impChangePct < -25 ? 'critical' : 'warning',
        type: 'declining_impressions',
        title: 'Declining Brand Impressions',
        description: `Branded search impressions dropped ${Math.abs(impChangePct).toFixed(1)}% compared to the prior 28-day window (${currentSummary.impressions} vs ${prev28dSummary.impressions}).`,
        metric: 'impressions',
        currentValue: currentSummary.impressions,
        previousValue: prev28dSummary.impressions,
        recommendation: 'Verify homepage indexing status, sitemap freshness, and schema markup to restore brand search appearance.',
        detectedAt: timestamp
      });
    }
  }

  // 2. Declining clicks check (28d)
  if (prev28dSummary && prev28dSummary.clicks > 0) {
    const clickChangePct = ((currentSummary.clicks - prev28dSummary.clicks) / prev28dSummary.clicks) * 100;
    if (clickChangePct < -10) {
      alerts.push({
        id: `alert-clicks-decline-${Date.now()}`,
        severity: clickChangePct < -25 ? 'critical' : 'warning',
        type: 'declining_clicks',
        title: 'Declining Brand Clicks',
        description: `Branded search clicks declined ${Math.abs(clickChangePct).toFixed(1)}% (${currentSummary.clicks} vs ${prev28dSummary.clicks}).`,
        metric: 'clicks',
        currentValue: currentSummary.clicks,
        previousValue: prev28dSummary.clicks,
        recommendation: 'Check whether third-party or sub-page results are cannibalising clicks away from the homepage.',
        detectedAt: timestamp
      });
    }
  }

  // 3. Ranking deterioration
  if (currentSummary.averagePosition > 3.0 && currentSummary.impressions > 0) {
    alerts.push({
      id: `alert-pos-deterioration-${Date.now()}`,
      severity: currentSummary.averagePosition > 5.0 ? 'critical' : 'warning',
      type: 'ranking_deterioration',
      title: 'Brand Ranking Deterioration',
      description: `Average branded search position is ${currentSummary.averagePosition.toFixed(1)} (expected top position 1.0 - 2.0).`,
      metric: 'position',
      currentValue: currentSummary.averagePosition,
      previousValue: prev28dSummary?.averagePosition,
      recommendation: 'Inspect brand entity signals, homepage canonical declaration, and robots.txt accessibility.',
      detectedAt: timestamp
    });
  }

  // 4. Low CTR on brand search
  if (currentSummary.impressions >= 20 && currentSummary.ctr < 0.15) {
    alerts.push({
      id: `alert-low-ctr-${Date.now()}`,
      severity: 'warning',
      type: 'low_ctr',
      title: 'Low Branded CTR',
      description: `Branded search CTR is ${(currentSummary.ctr * 100).toFixed(1)}%, which is below the expected benchmark of 25%+ for navigational brand queries.`,
      metric: 'ctr',
      currentValue: `${(currentSummary.ctr * 100).toFixed(1)}%`,
      recommendation: 'Review SERP snippet appearance in Google Search Console to confirm title and description relevance.',
      detectedAt: timestamp
    });
  }

  // 5. Homepage visibility problems
  if (homepagePerf.impressions > 0 && !homepagePerf.isRankingNumberOne) {
    alerts.push({
      id: `alert-hp-visibility-${Date.now()}`,
      severity: 'warning',
      type: 'homepage_visibility',
      title: 'Homepage Not Ranking #1 for Brand',
      description: `FirstRead homepage average position for brand queries is ${homepagePerf.position.toFixed(1)}. The root domain should hold position 1.0.`,
      metric: 'homepage_position',
      currentValue: homepagePerf.position,
      recommendation: 'Ensure homepage has an unambiguous canonical tag and is verified via GSC URL Inspection.',
      detectedAt: timestamp
    });
  }

  return alerts;
}

/**
 * Executes full FirstRead Brand Keyword tracking analysis
 */
export async function runBrandKeywordTracking(): Promise<BrandKeywordReport> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  // Define date windows:
  // Last 28 days
  const end28d = yesterday.toISOString().split('T')[0];
  const start28d = new Date(yesterday.getTime() - 27 * 86400000).toISOString().split('T')[0];

  // Previous 28 days (before last 28d)
  const prevEnd28d = new Date(yesterday.getTime() - 28 * 86400000).toISOString().split('T')[0];
  const prevStart28d = new Date(yesterday.getTime() - 55 * 86400000).toISOString().split('T')[0];

  // Last 7 days
  const end7d = end28d;
  const start7d = new Date(yesterday.getTime() - 6 * 86400000).toISOString().split('T')[0];

  // Previous 7 days
  const prevEnd7d = new Date(yesterday.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const prevStart7d = new Date(yesterday.getTime() - 13 * 86400000).toISOString().split('T')[0];

  // Parallel fetch for windows
  const [rows28d, prevRows28d, rows7d, prevRows7d] = await Promise.all([
    fetchGscWindowData(start28d, end28d),
    fetchGscWindowData(prevStart28d, prevEnd28d),
    fetchGscWindowData(start7d, end7d),
    fetchGscWindowData(prevStart7d, prevEnd7d)
  ]);

  const current28d = aggregateBrandQueries(rows28d);
  const previous28d = aggregateBrandQueries(prevRows28d);
  const current7d = aggregateBrandQueries(rows7d);
  const previous7d = aggregateBrandQueries(prevRows7d);

  // 7-day comparison
  const comparison7d = {
    clicks: computePeriodComparison(current7d.totalBrandedSummary.clicks, previous7d.totalBrandedSummary.clicks, 'clicks'),
    impressions: computePeriodComparison(current7d.totalBrandedSummary.impressions, previous7d.totalBrandedSummary.impressions, 'impressions'),
    ctr: computePeriodComparison(current7d.totalBrandedSummary.ctr, previous7d.totalBrandedSummary.ctr, 'ctr'),
    position: computePeriodComparison(current7d.totalBrandedSummary.averagePosition, previous7d.totalBrandedSummary.averagePosition, 'position')
  };

  // 28-day comparison
  const comparison28d = {
    clicks: computePeriodComparison(current28d.totalBrandedSummary.clicks, previous28d.totalBrandedSummary.clicks, 'clicks'),
    impressions: computePeriodComparison(current28d.totalBrandedSummary.impressions, previous28d.totalBrandedSummary.impressions, 'impressions'),
    ctr: computePeriodComparison(current28d.totalBrandedSummary.ctr, previous28d.totalBrandedSummary.ctr, 'ctr'),
    position: computePeriodComparison(current28d.totalBrandedSummary.averagePosition, previous28d.totalBrandedSummary.averagePosition, 'position')
  };

  const alerts = evaluateBrandAlerts(
    current28d.totalBrandedSummary,
    previous7d.totalBrandedSummary,
    previous28d.totalBrandedSummary,
    current28d.homepagePerformance
  );

  return {
    targetDomain: TARGET_DOMAIN,
    primaryBrandKeyword: PRIMARY_BRAND_KEYWORD,
    generatedAt: now.toISOString(),
    dateRange: {
      startDate: start28d,
      endDate: end28d
    },
    exactBrand: current28d.exactBrand,
    variations: current28d.variations,
    otherBrandedQueries: current28d.otherBrandedQueries,
    totalBrandedSummary: current28d.totalBrandedSummary,
    comparison7d,
    comparison28d,
    homepagePerformance: current28d.homepagePerformance,
    alerts
  };
}

/**
 * Correlates GSC Brand Performance with GA4 Organic Search traffic
 */
export async function correlateGA4OrganicSearch(gscBrandClicks = 0): Promise<GA4BrandOrganicCorrelation | null> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  if (!creds || !config.ga4PropertyId) return null;

  const jwt = createAuthorizedJWT(['https://www.googleapis.com/auth/analytics.readonly']);
  if (!jwt) return null;

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`;
  const defaultEnd = new Date(Date.now() - 86400000);
  const defaultStart = new Date(defaultEnd.getTime() - 27 * 86400000);

  const startDate = defaultStart.toISOString().split('T')[0];
  const endDate = defaultEnd.toISOString().split('T')[0];

  try {
    const res = await jwt.request<GA4ApiResponse>({
      url,
      method: 'POST',
      data: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'landingPage' }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'engagementRate' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionDefaultChannelGroup',
            stringFilter: {
              matchType: 'EXACT',
              value: 'Organic Search'
            }
          }
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50
      }
    });

    let totalSessions = 0;
    let totalUsers = 0;
    let totalPageviews = 0;
    let homepageSessions = 0;
    let weightedEngagement = 0;

    const landingPages: Array<{
      landingPage: string;
      sessions: number;
      pageviews: number;
      users: number;
      engagementRate: number;
      isHomepage: boolean;
    }> = [];

    for (const row of res.data?.rows || []) {
      const page = row.dimensionValues?.[1]?.value || '/';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const pageviews = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const users = parseInt(row.metricValues?.[2]?.value || '0', 10);
      const engagementRate = parseFloat(row.metricValues?.[3]?.value || '0');

      totalSessions += sessions;
      totalUsers += users;
      totalPageviews += pageviews;
      weightedEngagement += engagementRate * sessions;

      const isHomepage = page === '/' || page === '';
      if (isHomepage) {
        homepageSessions += sessions;
      }

      landingPages.push({
        landingPage: page,
        sessions,
        pageviews,
        users,
        engagementRate: Number(engagementRate.toFixed(4)),
        isHomepage
      });
    }

    const avgEngagement = totalSessions > 0 ? Number((weightedEngagement / totalSessions).toFixed(4)) : 0;
    const hpShare = totalSessions > 0 ? Number(((homepageSessions / totalSessions) * 100).toFixed(1)) : 0;
    const nonHomepageSessions = Math.max(0, totalSessions - homepageSessions);

    // Compute Brand-to-Organic Homepage Ratio
    // When users search for "firstread", they land predominantly on the homepage "/"
    const ratio = homepageSessions > 0 && gscBrandClicks > 0
      ? Number((gscBrandClicks / homepageSessions).toFixed(2))
      : null;

    return {
      period: { startDate, endDate },
      totalOrganicSessions: totalSessions,
      totalOrganicUsers: totalUsers,
      totalOrganicPageviews: totalPageviews,
      averageEngagementRate: avgEngagement,
      homepageOrganicSessions: homepageSessions,
      homepageShareOfOrganic: hpShare,
      nonHomepageOrganicSessions: nonHomepageSessions,
      correlatedGscBrandClicks: gscBrandClicks,
      brandToOrganicHomepageRatio: ratio,
      landingPages
    };
  } catch (err) {
    console.warn('[Brand Tracker] GA4 Organic Search query error:', sanitizeGoogleError(err));
    return null;
  }
}
