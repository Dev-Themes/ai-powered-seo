/**
 * Google Integrations Interface Contracts & Server-Side Clients for FirstRead Autonomous SEO.
 * 
 * Provides authenticated, read-only clients for Google Search Console API and Google Analytics Data API (GA4)
 * utilizing server-side Google Cloud Service Account credentials.
 * 
 * Security & Data Integrity Principles:
 * 1. Zero credentials or private keys are ever returned to client or logged.
 * 2. Zero metrics, ranks, clicks, or impressions are fabricated.
 * 3. Gracefully reports "Awaiting client authorization" when access is pending.
 */

import { JWT } from 'google-auth-library';

export interface GSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCDailyRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface FirstReadGSCMetrics {
  status: 'connected' | 'pending_authorization' | 'unconfigured' | 'error';
  message: string;
  property?: string;
  period?: {
    startDate: string;
    endDate: string;
  };
  metrics?: GSCSummary;
  topQueries?: GSCQueryRow[];
  topPages?: GSCPageRow[];
  dailyTrend?: GSCDailyRow[];
}

export interface GA4LandingPageRow {
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
}

export interface GA4DailyRow {
  date: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
}

export interface GA4Summary {
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
}

export interface FirstReadGA4Metrics {
  status: 'connected' | 'pending_authorization' | 'unconfigured' | 'error';
  message: string;
  propertyId?: string;
  period?: {
    startDate: string;
    endDate: string;
  };
  sessions?: number;
  engagedSessions?: number;
  engagementRate?: number;
  conversions?: number;
  landingPages?: GA4LandingPageRow[];
  dailyTrend?: GA4DailyRow[];
}

export interface GoogleIntegrationReadiness {
  gscProperty: string | null;
  ga4PropertyId: string | null;
  hasServiceAccount: boolean;
  readyForIngestion: boolean;
  requiredScopes: string[];
  serviceAccountEmail?: string | null;
}

export type GoogleConnectionStatus = 'connected' | 'pending_authorization' | 'unconfigured' | 'error';

export interface GoogleServiceStatus {
  service: string;
  status: GoogleConnectionStatus;
  authorized: boolean;
  message: string;
  property?: string;
  propertyId?: string;
  clientEmail?: string | null;
  testedAt?: string;
}

export interface GoogleConnectionsTestResult {
  searchConsole: GoogleServiceStatus;
  analytics4: GoogleServiceStatus;
  timestamp: string;
}

export interface GSCReportResponse {
  service: 'Google Search Console';
  status: GoogleConnectionStatus;
  authorized: boolean;
  message: string;
  property: string;
  period: { startDate: string; endDate: string };
  data: {
    summary: GSCSummary;
    dailyTrend: GSCDailyRow[];
    topQueries: GSCQueryRow[];
    topPages: GSCPageRow[];
  } | null;
}

export interface GA4ReportResponse {
  service: 'Google Analytics 4';
  status: GoogleConnectionStatus;
  authorized: boolean;
  message: string;
  propertyId: string | null;
  period: { startDate: string; endDate: string };
  data: {
    summary: GA4Summary;
    dailyTrend: GA4DailyRow[];
    landingPages: GA4LandingPageRow[];
  } | null;
}

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
}

/**
 * Strips secret tokens, keys, and private keys from error messages before exposure.
 */
export function sanitizeGoogleError(err: unknown): string {
  if (!err) return 'Unknown error occurred.';
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/AIza[0-9A-Za-z-_]{30,}/g, '[REDACTED_API_KEY]')
    .replace(/ya29\.[0-9A-Za-z-_]+/g, '[REDACTED_BEARER_TOKEN]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/key=[^&\s]+/g, 'key=[REDACTED]')
    .trim();
}

/**
 * Securely resolves service account credentials from environment variables.
 * Never throws uncaught exceptions and never exposes private keys.
 */
export function getGoogleCredentials(): ServiceAccountCredentials | null {
  try {
    // 1. Try GOOGLE_SERVICE_ACCOUNT_JSON
    const jsonVar = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (jsonVar && jsonVar.trim()) {
      const trimmed = jsonVar.trim();
      let parsed: Record<string, unknown> | null = null;
      if (trimmed.startsWith('{')) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          // not plain JSON
        }
      }
      if (!parsed) {
        // Try Base64 decode
        try {
          const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
          if (decoded.trim().startsWith('{')) {
            parsed = JSON.parse(decoded);
          }
        } catch {
          // not base64 json
        }
      }

      if (parsed && typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string') {
        const privateKey = parsed.private_key.replace(/\\n/g, '\n');
        if (privateKey.includes('BEGIN') && privateKey.includes('PRIVATE KEY')) {
          return {
            clientEmail: parsed.client_email,
            privateKey,
            projectId: typeof parsed.project_id === 'string' ? parsed.project_id : undefined
          };
        }
      }
    }

    // 2. Try GOOGLE_CLIENT_EMAIL & GOOGLE_PRIVATE_KEY
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    if (email && rawKey) {
      let privateKey = rawKey.trim();
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
      if (privateKey.includes('BEGIN') && privateKey.includes('PRIVATE KEY')) {
        return {
          clientEmail: email.trim(),
          privateKey,
          projectId: process.env.GOOGLE_PROJECT_ID
        };
      }
    }
  } catch {
    // Return null on parsing failure without crashing
  }
  return null;
}

function stripQuotes(val: string | null | undefined): string {
  if (!val) return '';
  let str = val.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

/**
 * Returns configuration settings and resolved property identifiers.
 */
export function getGoogleConfig() {
  const rawGsc =
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ||
    process.env.FIRSTREAD_GSC_PROPERTY ||
    process.env.GSC_PROPERTY ||
    'sc-domain:firstread.co.uk';
  const gscSiteUrl = stripQuotes(rawGsc) || 'sc-domain:firstread.co.uk';

  const rawGa4 =
    process.env.GA4_PROPERTY_ID ||
    process.env.FIRSTREAD_GA4_PROPERTY_ID ||
    null;
  const ga4PropertyId = rawGa4 ? stripQuotes(rawGa4) || null : null;

  const creds = getGoogleCredentials();

  return {
    gscSiteUrl,
    ga4PropertyId,
    clientEmail: creds?.clientEmail || null,
    hasCredentials: !!creds
  };
}

/**
 * Checks whether environment variables required for Google APIs are provisioned
 */
export function getGoogleIntegrationReadiness(): GoogleIntegrationReadiness {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  const hasServiceAccount = !!creds;

  return {
    gscProperty: config.gscSiteUrl,
    ga4PropertyId: config.ga4PropertyId,
    hasServiceAccount,
    readyForIngestion: hasServiceAccount && !!(config.gscSiteUrl || config.ga4PropertyId),
    serviceAccountEmail: creds?.clientEmail || null,
    requiredScopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/analytics.readonly'
    ]
  };
}

/**
 * Backward compatibility stub for existing callers
 */
export function getFirstReadGoogleStatus() {
  const readiness = getGoogleIntegrationReadiness();
  return {
    searchConsole: {
      status: readiness.readyForIngestion ? 'connected' : 'unconfigured',
      message: readiness.readyForIngestion
        ? 'Credentials configured. Ready for Phase 3 ingestion.'
        : 'Google Search Console property pending service account authorization.',
      property: readiness.gscProperty || undefined
    } as FirstReadGSCMetrics,
    analytics4: {
      status: readiness.readyForIngestion ? 'connected' : 'unconfigured',
      message: readiness.readyForIngestion
        ? 'Credentials configured. Ready for Phase 3 ingestion.'
        : 'Google Analytics 4 property ID pending configuration.',
      propertyId: readiness.ga4PropertyId || undefined
    } as FirstReadGA4Metrics,
    configured: readiness.readyForIngestion,
    notes: [
      'GSC and GA4 connections require explicit site verification in Google Search Console for https://firstread.co.uk.',
      'Average position from Search Console represents aggregated search appearance, not a live keyword ranking.',
      'GA4 sessions and GSC clicks are independent measurements and are reported separately.'
    ]
  };
}

export type FirstReadGoogleIntegrationsState = ReturnType<typeof getFirstReadGoogleStatus>;

/**
 * Creates an authorized JWT client for Google Cloud API calls.
 */
function createAuthorizedJWT(scopes: string[]): JWT | null {
  const creds = getGoogleCredentials();
  if (!creds) return null;
  return new JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes
  });
}

function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number; code?: number | string }).status || (err as { status?: number; code?: number | string }).code;
  if (status === 403 || status === '403') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /sufficient permission|permission_denied|not have permission|forbidden/i.test(msg);
}

/**
 * Tests live connectivity to Google Search Console and Google Analytics 4.
 * Never raises uncaught exceptions. Detects missing authorization gracefully.
 */
export async function testGoogleConnections(): Promise<GoogleConnectionsTestResult> {
  const timestamp = new Date().toISOString();
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();

  let gscStatus: GoogleServiceStatus = {
    service: 'Google Search Console',
    status: 'unconfigured',
    authorized: false,
    message: 'Google Cloud service account credentials not configured.',
    property: config.gscSiteUrl,
    clientEmail: creds?.clientEmail || null,
    testedAt: timestamp
  };

  let ga4Status: GoogleServiceStatus = {
    service: 'Google Analytics 4',
    status: 'unconfigured',
    authorized: false,
    message: 'Google Cloud service account credentials not configured.',
    propertyId: config.ga4PropertyId || undefined,
    clientEmail: creds?.clientEmail || null,
    testedAt: timestamp
  };

  if (!creds) {
    return { searchConsole: gscStatus, analytics4: ga4Status, timestamp };
  }

  // 1. Test GSC
  try {
    const jwt = createAuthorizedJWT(['https://www.googleapis.com/auth/webmasters.readonly']);
    if (jwt) {
      const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl)}/searchAnalytics/query`;
      const yesterday = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
      await jwt.request({
        url,
        method: 'POST',
        data: {
          startDate: yesterday,
          endDate: yesterday,
          rowLimit: 1
        }
      });
      gscStatus = {
        service: 'Google Search Console',
        status: 'connected',
        authorized: true,
        message: `Successfully connected to Google Search Console for '${config.gscSiteUrl}'.`,
        property: config.gscSiteUrl,
        clientEmail: creds.clientEmail,
        testedAt: timestamp
      };
    }
  } catch (err: unknown) {
    if (isPermissionDeniedError(err)) {
      gscStatus = {
        service: 'Google Search Console',
        status: 'pending_authorization',
        authorized: false,
        message: `Awaiting client authorization. Add service account '${creds.clientEmail}' with Restricted/Full permissions to '${config.gscSiteUrl}' in Google Search Console.`,
        property: config.gscSiteUrl,
        clientEmail: creds.clientEmail,
        testedAt: timestamp
      };
    } else {
      gscStatus = {
        service: 'Google Search Console',
        status: 'error',
        authorized: false,
        message: sanitizeGoogleError(err),
        property: config.gscSiteUrl,
        clientEmail: creds.clientEmail,
        testedAt: timestamp
      };
    }
  }

  // 2. Test GA4
  if (!config.ga4PropertyId) {
    ga4Status = {
      service: 'Google Analytics 4',
      status: 'unconfigured',
      authorized: false,
      message: 'GA4 Property ID pending configuration (set GA4_PROPERTY_ID in .env.local).',
      clientEmail: creds.clientEmail,
      testedAt: timestamp
    };
  } else {
    try {
      const jwt = createAuthorizedJWT(['https://www.googleapis.com/auth/analytics.readonly']);
      if (jwt) {
        const url = `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        await jwt.request({
          url,
          method: 'POST',
          data: {
            dateRanges: [{ startDate: yesterday, endDate: yesterday }],
            metrics: [{ name: 'sessions' }],
            limit: 1
          }
        });
        ga4Status = {
          service: 'Google Analytics 4',
          status: 'connected',
          authorized: true,
          message: `Successfully connected to GA4 property '${config.ga4PropertyId}'.`,
          propertyId: config.ga4PropertyId,
          clientEmail: creds.clientEmail,
          testedAt: timestamp
        };
      }
    } catch (err: unknown) {
      if (isPermissionDeniedError(err)) {
        ga4Status = {
          service: 'Google Analytics 4',
          status: 'pending_authorization',
          authorized: false,
          message: `Awaiting client authorization. Add service account '${creds.clientEmail}' with Viewer role to Property ID '${config.ga4PropertyId}' in GA4 Property Access Management.`,
          propertyId: config.ga4PropertyId,
          clientEmail: creds.clientEmail,
          testedAt: timestamp
        };
      } else {
        ga4Status = {
          service: 'Google Analytics 4',
          status: 'error',
          authorized: false,
          message: sanitizeGoogleError(err),
          propertyId: config.ga4PropertyId,
          clientEmail: creds.clientEmail,
          testedAt: timestamp
        };
      }
    }
  }

  return { searchConsole: gscStatus, analytics4: ga4Status, timestamp };
}

/**
 * Retrieves Google Search Console performance metrics (clicks, impressions, ctr, position, top queries, top pages).
 * Never fabricates numbers. If authorization is pending, returns status "pending_authorization" with data: null.
 */
export async function fetchGSCReport(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<GSCReportResponse> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();

  // Default to last 28 days ending 3 days ago (GSC data stabilization latency)
  const defaultEnd = new Date(Date.now() - 3 * 86400000);
  const defaultStart = new Date(defaultEnd.getTime() - 27 * 86400000);

  const startDate = options?.startDate || defaultStart.toISOString().split('T')[0];
  const endDate = options?.endDate || defaultEnd.toISOString().split('T')[0];
  const period = { startDate, endDate };

  if (!creds) {
    return {
      service: 'Google Search Console',
      status: 'unconfigured',
      authorized: false,
      message: 'Google Cloud Service Account credentials not configured.',
      property: config.gscSiteUrl,
      period,
      data: null
    };
  }

  try {
    const jwt = createAuthorizedJWT(['https://www.googleapis.com/auth/webmasters.readonly']);
    if (!jwt) throw new Error('Failed to initialize Google JWT client.');

    const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl)}/searchAnalytics/query`;

    // 1. Fetch Daily Trend
    const dailyRes = await jwt.request<{
      rows?: Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    }>({
      url,
      method: 'POST',
      data: {
        startDate,
        endDate,
        dimensions: ['date'],
        rowLimit: 1000
      }
    });

    // 2. Fetch Top Queries
    const queriesRes = await jwt.request<{
      rows?: Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    }>({
      url,
      method: 'POST',
      data: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 25
      }
    });

    // 3. Fetch Top Pages
    const pagesRes = await jwt.request<{
      rows?: Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    }>({
      url,
      method: 'POST',
      data: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 25
      }
    });

    const dailyRows: GSCDailyRow[] = (dailyRes.data.rows || []).map(r => ({
      date: r.keys[0],
      clicks: Math.round(r.clicks || 0),
      impressions: Math.round(r.impressions || 0),
      ctr: Number((r.ctr || 0).toFixed(4)),
      position: Number((r.position || 0).toFixed(1))
    })).sort((a, b) => a.date.localeCompare(b.date));

    const topQueries: GSCQueryRow[] = (queriesRes.data.rows || []).map(r => ({
      query: r.keys[0],
      clicks: Math.round(r.clicks || 0),
      impressions: Math.round(r.impressions || 0),
      ctr: Number((r.ctr || 0).toFixed(4)),
      position: Number((r.position || 0).toFixed(1))
    }));

    const topPages: GSCPageRow[] = (pagesRes.data.rows || []).map(r => ({
      page: r.keys[0],
      clicks: Math.round(r.clicks || 0),
      impressions: Math.round(r.impressions || 0),
      ctr: Number((r.ctr || 0).toFixed(4)),
      position: Number((r.position || 0).toFixed(1))
    }));

    let totalClicks = 0;
    let totalImpressions = 0;
    let weightedPositionSum = 0;

    for (const row of dailyRows) {
      totalClicks += row.clicks;
      totalImpressions += row.impressions;
      weightedPositionSum += row.position * row.impressions;
    }

    const summary: GSCSummary = {
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: totalImpressions > 0 ? Number((totalClicks / totalImpressions).toFixed(4)) : 0,
      position: totalImpressions > 0 ? Number((weightedPositionSum / totalImpressions).toFixed(1)) : 0
    };

    return {
      service: 'Google Search Console',
      status: 'connected',
      authorized: true,
      message: 'Search Console report retrieved successfully.',
      property: config.gscSiteUrl,
      period,
      data: {
        summary,
        dailyTrend: dailyRows,
        topQueries,
        topPages
      }
    };
  } catch (err: unknown) {
    if (isPermissionDeniedError(err)) {
      return {
        service: 'Google Search Console',
        status: 'pending_authorization',
        authorized: false,
        message: `Awaiting client authorization. Add service account '${creds.clientEmail}' with Restricted/Full permissions to '${config.gscSiteUrl}' in Google Search Console.`,
        property: config.gscSiteUrl,
        period,
        data: null
      };
    }

    return {
      service: 'Google Search Console',
      status: 'error',
      authorized: false,
      message: sanitizeGoogleError(err),
      property: config.gscSiteUrl,
      period,
      data: null
    };
  }
}

/**
 * Retrieves Google Analytics 4 report (sessions, engagement, conversions, landing pages).
 * Never fabricates numbers. If authorization is pending, returns status "pending_authorization" with data: null.
 */
export async function fetchGA4Report(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<GA4ReportResponse> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();

  // Default to last 28 days ending yesterday
  const defaultEnd = new Date(Date.now() - 86400000);
  const defaultStart = new Date(defaultEnd.getTime() - 27 * 86400000);

  const startDate = options?.startDate || defaultStart.toISOString().split('T')[0];
  const endDate = options?.endDate || defaultEnd.toISOString().split('T')[0];
  const period = { startDate, endDate };

  if (!creds || !config.ga4PropertyId) {
    return {
      service: 'Google Analytics 4',
      status: 'unconfigured',
      authorized: false,
      message: !creds
        ? 'Google Cloud Service Account credentials not configured.'
        : 'GA4 Property ID pending configuration (set GA4_PROPERTY_ID in .env.local).',
      propertyId: config.ga4PropertyId,
      period,
      data: null
    };
  }

  try {
    const jwt = createAuthorizedJWT(['https://www.googleapis.com/auth/analytics.readonly']);
    if (!jwt) throw new Error('Failed to initialize Google JWT client.');

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`;

    interface GA4APIResponse {
      metricHeaders?: Array<{ name: string }>;
      rows?: Array<{
        dimensionValues: Array<{ value: string }>;
        metricValues: Array<{ value: string }>;
      }>;
      totals?: Array<{
        metricValues: Array<{ value: string }>;
      }>;
    }

    // Try fetching with conversions; fallback if conversions metric is rejected/unconfigured
    let dailyRes: { data: GA4APIResponse };
    let hasConversions = true;

    try {
      dailyRes = await jwt.request<GA4APIResponse>({
        url,
        method: 'POST',
        data: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'engagedSessions' },
            { name: 'engagementRate' },
            { name: 'conversions' }
          ],
          orderBys: [{ dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' } }]
        }
      });
    } catch (metricErr: unknown) {
      if (isPermissionDeniedError(metricErr)) {
        throw metricErr;
      }
      // Retry without conversions metric if property does not have standard conversions defined
      hasConversions = false;
      dailyRes = await jwt.request<GA4APIResponse>({
        url,
        method: 'POST',
        data: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'engagedSessions' },
            { name: 'engagementRate' }
          ],
          orderBys: [{ dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' } }]
        }
      });
    }

    // Fetch Landing Pages
    const landingRes = await jwt.request<GA4APIResponse>({
      url,
      method: 'POST',
      data: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'landingPage' }],
        metrics: hasConversions
          ? [
              { name: 'sessions' },
              { name: 'engagedSessions' },
              { name: 'engagementRate' },
              { name: 'conversions' }
            ]
          : [
              { name: 'sessions' },
              { name: 'engagedSessions' },
              { name: 'engagementRate' }
            ],
        limit: 25,
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
      }
    });

    const dailyTrend: GA4DailyRow[] = (dailyRes.data.rows || []).map(r => {
      const rawDate = r.dimensionValues[0]?.value || '';
      // Format YYYYMMDD to YYYY-MM-DD if needed
      const date = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
      const sessions = parseInt(r.metricValues[0]?.value || '0', 10);
      const engagedSessions = parseInt(r.metricValues[1]?.value || '0', 10);
      const engagementRate = parseFloat(r.metricValues[2]?.value || '0');
      const conversions = hasConversions ? parseInt(r.metricValues[3]?.value || '0', 10) : 0;
      return {
        date,
        sessions,
        engagedSessions,
        engagementRate: Number(engagementRate.toFixed(4)),
        conversions
      };
    });

    const landingPages: GA4LandingPageRow[] = (landingRes.data.rows || []).map(r => {
      const landingPage = r.dimensionValues[0]?.value || '/';
      const sessions = parseInt(r.metricValues[0]?.value || '0', 10);
      const engagedSessions = parseInt(r.metricValues[1]?.value || '0', 10);
      const engagementRate = parseFloat(r.metricValues[2]?.value || '0');
      const conversions = hasConversions ? parseInt(r.metricValues[3]?.value || '0', 10) : 0;
      return {
        landingPage,
        sessions,
        engagedSessions,
        engagementRate: Number(engagementRate.toFixed(4)),
        conversions
      };
    });

    let totalSessions = 0;
    let totalEngagedSessions = 0;
    let totalConversions = 0;

    for (const d of dailyTrend) {
      totalSessions += d.sessions;
      totalEngagedSessions += d.engagedSessions;
      totalConversions += d.conversions;
    }

    const summary: GA4Summary = {
      sessions: totalSessions,
      engagedSessions: totalEngagedSessions,
      engagementRate: totalSessions > 0 ? Number((totalEngagedSessions / totalSessions).toFixed(4)) : 0,
      conversions: totalConversions
    };

    return {
      service: 'Google Analytics 4',
      status: 'connected',
      authorized: true,
      message: 'GA4 report retrieved successfully.',
      propertyId: config.ga4PropertyId,
      period,
      data: {
        summary,
        dailyTrend,
        landingPages
      }
    };
  } catch (err: unknown) {
    if (isPermissionDeniedError(err)) {
      return {
        service: 'Google Analytics 4',
        status: 'pending_authorization',
        authorized: false,
        message: `Awaiting client authorization. Add service account '${creds.clientEmail}' with Viewer role to Property ID '${config.ga4PropertyId}' in GA4 Property Access Management.`,
        propertyId: config.ga4PropertyId,
        period,
        data: null
      };
    }

    return {
      service: 'Google Analytics 4',
      status: 'error',
      authorized: false,
      message: sanitizeGoogleError(err),
      propertyId: config.ga4PropertyId,
      period,
      data: null
    };
  }
}
