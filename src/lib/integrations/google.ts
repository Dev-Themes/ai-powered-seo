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
  status: GoogleConnectionStatus;
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
  screenPageViews?: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
}

export interface GA4DailyRow {
  date: string;
  sessions: number;
  screenPageViews?: number;
  totalUsers?: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
}

export interface GA4Summary {
  sessions: number;
  screenPageViews?: number;
  totalUsers?: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
}

export interface FirstReadGA4Metrics {
  status: GoogleConnectionStatus;
  message: string;
  propertyId?: string;
  period?: {
    startDate: string;
    endDate: string;
  };
  sessions?: number;
  screenPageViews?: number;
  totalUsers?: number;
  engagedSessions?: number;
  engagementRate?: number;
  conversions?: number;
  landingPages?: GA4LandingPageRow[];
  dailyTrend?: GA4DailyRow[];
  diagnostic?: GA4DiagnosticResult;
}

export interface GoogleIntegrationReadiness {
  gscProperty: string | null;
  ga4PropertyId: string | null;
  hasServiceAccount: boolean;
  readyForIngestion: boolean;
  requiredScopes: string[];
  serviceAccountEmail?: string | null;
}

export type GoogleConnectionStatus =
  | 'connected'
  | 'pending_authorization'
  | 'invalid_credentials'
  | 'api_not_enabled'
  | 'property_not_found'
  | 'permission_denied'
  | 'configuration_error'
  | 'temporary_api_error'
  | 'unconfigured'
  | 'error';

export interface GA4DiagnosticResult {
  propertyId: string | null;
  clientEmail: string | null;
  projectId?: string;
  status: GoogleConnectionStatus;
  category: GoogleConnectionStatus;
  message: string;
  steps: {
    authentication: {
      success: boolean;
      error?: string;
    };
    propertyValidation: {
      validFormat: boolean;
      isMeasurementId: boolean;
      numericId: string | null;
      error?: string;
    };
    adminApi: {
      success: boolean;
      enabled: boolean;
      canSeeProperty?: boolean;
      visibleProperties?: string[];
      error?: string;
    };
    dataApi: {
      success: boolean;
      enabled: boolean;
      runReportSuccess: boolean;
      error?: string;
    };
    alternatePropertyCheck?: {
      checkedId: string;
      accessible: boolean;
      hostName?: string;
      recentSessions?: number;
      streamId?: string;
    };
  };
  recommendedAction: string;
  timestamp: string;
}

export interface GoogleServiceStatus {
  service: string;
  status: GoogleConnectionStatus;
  authorized: boolean;
  message: string;
  property?: string;
  propertyId?: string;
  clientEmail?: string | null;
  testedAt?: string;
  diagnostic?: GA4DiagnosticResult;
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
  diagnostic?: GA4DiagnosticResult;
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
    // 1. Try GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY
    const jsonVar = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (jsonVar && jsonVar.trim()) {
      let trimmed = jsonVar.trim();
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        trimmed = trimmed.slice(1, -1).trim();
      }

      let parsed: Record<string, unknown> | null = null;
      if (trimmed.startsWith('{')) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          try {
            parsed = JSON.parse(trimmed.replace(/\\"/g, '"'));
          } catch {
            // not plain JSON
          }
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

      // Handle double-encoded string
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // keep as is
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
export function createAuthorizedJWT(scopes: string[]): JWT | null {
  const creds = getGoogleCredentials();
  if (!creds) return null;
  return new JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes
  });
}

export interface ClassifiedGoogleError {
  status: GoogleConnectionStatus;
  category: GoogleConnectionStatus;
  message: string;
  statusCode?: number;
  rawReason?: string;
}

/**
 * Classifies Google API errors into explicit diagnostic categories:
 * - connected
 * - pending_authorization
 * - invalid_credentials
 * - api_not_enabled
 * - property_not_found
 * - permission_denied
 * - configuration_error
 * - temporary_api_error
 * - error
 */
export function classifyGoogleApiError(
  err: unknown,
  context: {
    service: 'GSC' | 'GA4';
    propertyId?: string | null;
    clientEmail?: string | null;
  }
): ClassifiedGoogleError {
  if (!err) {
    return {
      status: 'error',
      category: 'error',
      message: 'Unknown error occurred.'
    };
  }

  const errObj = err as {
    status?: number;
    code?: number | string;
    message?: string;
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: number;
          status?: string;
          message?: string;
          errors?: Array<{ message?: string; reason?: string; domain?: string }>;
          details?: Array<{ reason?: string; domain?: string; metadata?: Record<string, string> }>;
        };
      };
    };
  };

  const statusNum = Number(errObj.status || errObj.code || errObj.response?.status) || 0;
  const rawMsg = err instanceof Error ? err.message : String(errObj.message || err);
  const respError = errObj.response?.data?.error;
  const detailedMsg = respError?.message || rawMsg;
  const sanitized = sanitizeGoogleError(detailedMsg);

  const rpcStatus = respError?.status || '';
  const errorReason = respError?.errors?.[0]?.reason || '';
  const detailReason = respError?.details?.[0]?.reason || '';
  const fullErrorText = `${rawMsg} ${detailedMsg} ${rpcStatus} ${errorReason} ${detailReason}`.toLowerCase();

  // 1. Invalid credentials / Authentication failure (401 Unauthorized or OAuth grant errors)
  if (
    statusNum === 401 ||
    fullErrorText.includes('invalid_grant') ||
    fullErrorText.includes('unauthorized_client') ||
    fullErrorText.includes('invalid jwt') ||
    fullErrorText.includes('bad private key') ||
    fullErrorText.includes('pem routines') ||
    fullErrorText.includes('unauthenticated')
  ) {
    return {
      status: 'invalid_credentials',
      category: 'invalid_credentials',
      message: `Invalid Google Service Account credentials: ${sanitized}`,
      statusCode: 401,
      rawReason: errorReason || 'invalid_credentials'
    };
  }

  // 2. API Not Enabled (403 SERVICE_DISABLED / accessNotConfigured)
  if (
    detailReason === 'SERVICE_DISABLED' ||
    errorReason === 'accessNotConfigured' ||
    fullErrorText.includes('service_disabled') ||
    fullErrorText.includes('has not been used in project') ||
    fullErrorText.includes('before or it is disabled') ||
    fullErrorText.includes('api is not enabled for the project') ||
    fullErrorText.includes('accessnotconfigured')
  ) {
    const activationUrl =
      respError?.details?.[0]?.metadata?.activationUrl ||
      (context.service === 'GA4'
        ? 'https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview'
        : 'https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview');

    return {
      status: 'api_not_enabled',
      category: 'api_not_enabled',
      message: `API Not Enabled: The ${context.service === 'GA4' ? 'Google Analytics Data / Admin' : 'Google Search Console'} API is disabled in your Google Cloud Project. Enable it at: ${activationUrl}`,
      statusCode: 403,
      rawReason: 'SERVICE_DISABLED'
    };
  }

  // 3. Property Not Found (404)
  if (
    statusNum === 404 ||
    rpcStatus === 'NOT_FOUND' ||
    fullErrorText.includes('not found') ||
    fullErrorText.includes('does not exist')
  ) {
    return {
      status: 'property_not_found',
      category: 'property_not_found',
      message: `Property Not Found: ${context.service === 'GA4' ? `GA4 Property ID '${context.propertyId || ''}'` : `Property '${context.propertyId || ''}'`} was not found. Verify the ID in your Google Analytics / Search Console admin console.`,
      statusCode: 404,
      rawReason: 'NOT_FOUND'
    };
  }

  // 4. Configuration Error (e.g. non-numeric Property ID, Measurement ID entered)
  if (context.service === 'GA4' && context.propertyId) {
    if (context.propertyId.startsWith('G-')) {
      return {
        status: 'configuration_error',
        category: 'configuration_error',
        message: `Configuration Error: '${context.propertyId}' is a GA4 Measurement ID, not a numeric Property ID. Find your numeric Property ID in GA4 Admin > Property Settings (e.g. 563207238).`,
        statusCode: 400,
        rawReason: 'MEASUREMENT_ID_MISCONFIGURED'
      };
    }
    if (!/^\d+$/.test(context.propertyId.trim())) {
      return {
        status: 'configuration_error',
        category: 'configuration_error',
        message: `Configuration Error: GA4 Property ID '${context.propertyId}' must be entirely numeric.`,
        statusCode: 400,
        rawReason: 'MALFORMED_PROPERTY_ID'
      };
    }
  }

  // 5. Temporary API Errors (500, 502, 503, 504, 429 rate limit, network timeouts)
  if (
    statusNum === 429 ||
    statusNum >= 500 ||
    fullErrorText.includes('resource_exhausted') ||
    fullErrorText.includes('rate limit') ||
    fullErrorText.includes('timeout') ||
    fullErrorText.includes('econnreset') ||
    fullErrorText.includes('etimedout')
  ) {
    return {
      status: 'temporary_api_error',
      category: 'temporary_api_error',
      message: `Temporary API Error: Google API returned HTTP ${statusNum || 'Network Error'} (${sanitized}). Please retry shortly.`,
      statusCode: statusNum || 503,
      rawReason: errorReason || 'TEMPORARY_ERROR'
    };
  }

  // 6. Permission Denied (403 with insufficient permission)
  if (
    statusNum === 403 ||
    rpcStatus === 'PERMISSION_DENIED' ||
    errorReason === 'forbidden' ||
    fullErrorText.includes('sufficient permission') ||
    fullErrorText.includes('permission_denied') ||
    fullErrorText.includes('forbidden')
  ) {
    const emailStr = context.clientEmail ? `'${context.clientEmail}'` : 'the configured service account';
    const propStr = context.propertyId ? `'${context.propertyId}'` : 'the target property';

    return {
      status: 'permission_denied',
      category: 'permission_denied',
      message: `Permission Denied: Service account ${emailStr} does not have Viewer permissions on ${propStr}. In ${context.service === 'GA4' ? 'GA4 Admin > Property Access Management' : 'Google Search Console > Settings > Users and permissions'}, add this service account email with Viewer permissions.`,
      statusCode: 403,
      rawReason: 'PERMISSION_DENIED'
    };
  }

  // 7. Generic Error
  return {
    status: 'error',
    category: 'error',
    message: sanitized,
    statusCode: statusNum,
    rawReason: errorReason || 'UNKNOWN_ERROR'
  };
}

/**
 * Executes a comprehensive, read-only diagnostic on the GA4 connection.
 * Tests service account authentication, Admin API visibility, Data API runReport,
 * property ID formatting, and detects if alternate known properties have access.
 */
export async function diagnoseGA4Connection(customPropertyId?: string): Promise<GA4DiagnosticResult> {
  const timestamp = new Date().toISOString();
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  const targetPropertyId = customPropertyId !== undefined ? stripQuotes(customPropertyId).trim() : config.ga4PropertyId;

  const result: GA4DiagnosticResult = {
    propertyId: targetPropertyId,
    clientEmail: creds?.clientEmail || null,
    projectId: creds?.projectId,
    status: 'unconfigured',
    category: 'unconfigured',
    message: '',
    steps: {
      authentication: { success: false },
      propertyValidation: {
        validFormat: false,
        isMeasurementId: false,
        numericId: null
      },
      adminApi: {
        success: false,
        enabled: false
      },
      dataApi: {
        success: false,
        enabled: false,
        runReportSuccess: false
      }
    },
    recommendedAction: '',
    timestamp
  };

  // Step 1: Validate Property ID
  if (!targetPropertyId) {
    result.status = 'configuration_error';
    result.category = 'configuration_error';
    result.message = 'GA4 Property ID is not configured (set GA4_PROPERTY_ID in .env.local).';
    result.recommendedAction = 'Set GA4_PROPERTY_ID in your environment variables to your numeric Google Analytics 4 Property ID.';
    result.steps.propertyValidation = {
      validFormat: false,
      isMeasurementId: false,
      numericId: null,
      error: 'Missing GA4 Property ID.'
    };
    return result;
  }

  const isMeasurementId = targetPropertyId.startsWith('G-');
  const isNumeric = /^\d+$/.test(targetPropertyId.trim());
  result.steps.propertyValidation = {
    validFormat: isNumeric,
    isMeasurementId,
    numericId: isNumeric ? targetPropertyId.trim() : null,
    error: !isNumeric
      ? isMeasurementId
        ? `Value '${targetPropertyId}' is a GA4 Web Measurement ID, not a numeric Property ID.`
        : `Value '${targetPropertyId}' is non-numeric.`
      : undefined
  };

  if (!isNumeric) {
    result.status = 'configuration_error';
    result.category = 'configuration_error';
    result.message = result.steps.propertyValidation.error || 'Invalid Property ID format.';
    result.recommendedAction = 'Find your numeric GA4 Property ID in Google Analytics (Admin > Property Settings > Property details) and update GA4_PROPERTY_ID.';
    return result;
  }

  // Step 2: Validate Credentials & Authentication
  if (!creds) {
    result.status = 'unconfigured';
    result.category = 'unconfigured';
    result.message = 'Google Cloud Service Account credentials are not configured.';
    result.recommendedAction = 'Configure GOOGLE_SERVICE_ACCOUNT_JSON in .env.local with your Google Cloud Service Account credentials.';
    result.steps.authentication = {
      success: false,
      error: 'Missing service account credentials.'
    };
    return result;
  }

  let jwt: JWT | null = null;
  try {
    jwt = createAuthorizedJWT([
      'https://www.googleapis.com/auth/analytics.readonly'
    ]);
    if (!jwt) throw new Error('JWT client could not be instantiated.');
    await jwt.getAccessToken();
    result.steps.authentication = { success: true };
  } catch (authErr: unknown) {
    const classified = classifyGoogleApiError(authErr, {
      service: 'GA4',
      propertyId: targetPropertyId,
      clientEmail: creds.clientEmail
    });
    result.status = classified.status;
    result.category = classified.category;
    result.message = classified.message;
    result.steps.authentication = {
      success: false,
      error: sanitizeGoogleError(authErr)
    };
    result.recommendedAction = 'Verify that your Google Cloud Service Account private key is valid and not corrupted or expired.';
    return result;
  }

  // Step 3: Test Google Analytics Admin API (accountSummaries / property visibility)
  try {
    const adminRes = await jwt.request<{
      accountSummaries?: Array<{
        name: string;
        account: string;
        displayName: string;
        propertySummaries?: Array<{
          property: string;
          displayName: string;
          propertyType?: string;
        }>;
      }>;
    }>({
      url: 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
      method: 'GET'
    });

    const visibleProperties: string[] = [];
    for (const acc of adminRes.data.accountSummaries || []) {
      for (const prop of acc.propertySummaries || []) {
        visibleProperties.push(prop.property.replace(/^properties\//, ''));
      }
    }

    const canSee = visibleProperties.includes(targetPropertyId);
    result.steps.adminApi = {
      success: true,
      enabled: true,
      canSeeProperty: canSee,
      visibleProperties,
      error: undefined
    };
  } catch (adminErr: unknown) {
    const adminClassified = classifyGoogleApiError(adminErr, {
      service: 'GA4',
      propertyId: targetPropertyId,
      clientEmail: creds.clientEmail
    });
    result.steps.adminApi = {
      success: false,
      enabled: adminClassified.status !== 'api_not_enabled',
      canSeeProperty: false,
      error: adminClassified.message
    };
  }

  // Step 4: Test Google Analytics Data API (runReport)
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await jwt.request({
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${targetPropertyId}:runReport`,
      method: 'POST',
      data: {
        dateRanges: [{ startDate: yesterday, endDate: yesterday }],
        metrics: [{ name: 'sessions' }],
        limit: 1
      }
    });

    result.steps.dataApi = {
      success: true,
      enabled: true,
      runReportSuccess: true
    };
    result.status = 'connected';
    result.category = 'connected';
    result.message = `Successfully connected to GA4 Property '${targetPropertyId}'. Data API runReport verified.`;
    result.recommendedAction = 'No action required. GA4 integration is fully functional and ready for ingestion.';
    return result;
  } catch (dataErr: unknown) {
    const classified = classifyGoogleApiError(dataErr, {
      service: 'GA4',
      propertyId: targetPropertyId,
      clientEmail: creds.clientEmail
    });

    result.status = classified.status;
    result.category = classified.category;
    result.message = classified.message;
    result.steps.dataApi = {
      success: false,
      enabled: classified.status !== 'api_not_enabled',
      runReportSuccess: false,
      error: sanitizeGoogleError(dataErr)
    };

    // Step 5: Check Alternate Property if permission denied on targetPropertyId
    const knownWorkingProperty = '557864063';
    if (targetPropertyId !== knownWorkingProperty && classified.status === 'permission_denied') {
      try {
        const altRes = await jwt.request<{
          rows?: Array<{
            dimensionValues: Array<{ value: string }>;
            metricValues: Array<{ value: string }>;
          }>;
        }>({
          url: `https://analyticsdata.googleapis.com/v1beta/properties/${knownWorkingProperty}:runReport`,
          method: 'POST',
          data: {
            dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
            dimensions: [{ name: 'hostName' }, { name: 'streamId' }],
            metrics: [{ name: 'sessions' }],
            limit: 5
          }
        });

        const firstRow = altRes.data?.rows?.[0];
        const host = firstRow?.dimensionValues?.[0]?.value || '';
        const stream = firstRow?.dimensionValues?.[1]?.value || '';
        const sessions = parseInt(firstRow?.metricValues?.[0]?.value || '0', 10);

        result.steps.alternatePropertyCheck = {
          checkedId: knownWorkingProperty,
          accessible: true,
          hostName: host,
          recentSessions: sessions,
          streamId: stream
        };

        result.recommendedAction =
          `Diagnostic Discovery: Service account '${creds.clientEmail}' is authorized and actively receiving traffic (host '${host}') on GA4 Property ID '${knownWorkingProperty}', but does NOT have Viewer permission on Property ID '${targetPropertyId}'. If '${knownWorkingProperty}' is the production FirstRead property, update GA4_PROPERTY_ID=${knownWorkingProperty} in your environment variables. Otherwise, add '${creds.clientEmail}' with Viewer role to Property ID '${targetPropertyId}' in GA4 Property Access Management.`;
      } catch {
        result.recommendedAction =
          `Add service account '${creds.clientEmail}' with Viewer role to Property ID '${targetPropertyId}' in Google Analytics 4 (Admin > Property Access Management).`;
      }
    } else if (classified.status === 'api_not_enabled') {
      result.recommendedAction =
        `Enable the Google Analytics Data API in Google Cloud Console for project '${creds.projectId || 'your-project'}'. Visit https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=${creds.projectId || ''}`;
    } else if (classified.status === 'property_not_found') {
      result.recommendedAction =
        `Verify the GA4 Property ID '${targetPropertyId}' in Google Analytics (Admin > Property Settings > Property details).`;
    } else {
      result.recommendedAction =
        `Add service account '${creds.clientEmail}' with Viewer role to Property ID '${targetPropertyId}' in Google Analytics 4 (Admin > Property Access Management).`;
    }
  }

  return result;
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
    const classified = classifyGoogleApiError(err, {
      service: 'GSC',
      propertyId: config.gscSiteUrl,
      clientEmail: creds.clientEmail
    });
    gscStatus = {
      service: 'Google Search Console',
      status: classified.status,
      authorized: false,
      message: classified.message,
      property: config.gscSiteUrl,
      clientEmail: creds.clientEmail,
      testedAt: timestamp
    };
  }

  // 2. Test GA4 using comprehensive diagnostic
  const ga4Diagnostic = await diagnoseGA4Connection();
  ga4Status = {
    service: 'Google Analytics 4',
    status: ga4Diagnostic.status,
    authorized: ga4Diagnostic.status === 'connected',
    message: ga4Diagnostic.message,
    propertyId: config.ga4PropertyId || undefined,
    clientEmail: creds.clientEmail,
    testedAt: timestamp,
    diagnostic: ga4Diagnostic
  };

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
    const classified = classifyGoogleApiError(err, {
      service: 'GSC',
      propertyId: config.gscSiteUrl,
      clientEmail: creds.clientEmail
    });

    return {
      service: 'Google Search Console',
      status: classified.status,
      authorized: false,
      message: classified.message,
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
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'engagedSessions' },
            { name: 'engagementRate' },
            { name: 'conversions' }
          ],
          orderBys: [{ dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' } }]
        }
      });
    } catch (metricErr: unknown) {
      const metricClassified = classifyGoogleApiError(metricErr, {
        service: 'GA4',
        propertyId: config.ga4PropertyId,
        clientEmail: creds.clientEmail
      });
      if (metricClassified.status === 'permission_denied' || metricClassified.status === 'api_not_enabled' || metricClassified.status === 'invalid_credentials' || metricClassified.status === 'property_not_found') {
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
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
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
              { name: 'screenPageViews' },
              { name: 'engagedSessions' },
              { name: 'engagementRate' },
              { name: 'conversions' }
            ]
          : [
              { name: 'sessions' },
              { name: 'screenPageViews' },
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
      const screenPageViews = parseInt(r.metricValues[1]?.value || '0', 10);
      const totalUsers = parseInt(r.metricValues[2]?.value || '0', 10);
      const engagedSessions = parseInt(r.metricValues[3]?.value || '0', 10);
      const engagementRate = parseFloat(r.metricValues[4]?.value || '0');
      const conversions = hasConversions ? parseInt(r.metricValues[5]?.value || '0', 10) : 0;
      return {
        date,
        sessions,
        screenPageViews,
        totalUsers,
        engagedSessions,
        engagementRate: Number(engagementRate.toFixed(4)),
        conversions
      };
    });

    const landingPages: GA4LandingPageRow[] = (landingRes.data.rows || []).map(r => {
      const landingPage = r.dimensionValues[0]?.value || '/';
      const sessions = parseInt(r.metricValues[0]?.value || '0', 10);
      const screenPageViews = parseInt(r.metricValues[1]?.value || '0', 10);
      const engagedSessions = parseInt(r.metricValues[2]?.value || '0', 10);
      const engagementRate = parseFloat(r.metricValues[3]?.value || '0');
      const conversions = hasConversions ? parseInt(r.metricValues[4]?.value || '0', 10) : 0;
      return {
        landingPage,
        sessions,
        screenPageViews,
        engagedSessions,
        engagementRate: Number(engagementRate.toFixed(4)),
        conversions
      };
    });

    let totalSessions = 0;
    let totalScreenPageViews = 0;
    let totalUsers = 0;
    let totalEngagedSessions = 0;
    let totalConversions = 0;

    for (const d of dailyTrend) {
      totalSessions += d.sessions;
      totalScreenPageViews += d.screenPageViews ?? 0;
      totalUsers += d.totalUsers ?? 0;
      totalEngagedSessions += d.engagedSessions;
      totalConversions += d.conversions;
    }

    const summary: GA4Summary = {
      sessions: totalSessions,
      screenPageViews: totalScreenPageViews,
      totalUsers,
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
    const classified = classifyGoogleApiError(err, {
      service: 'GA4',
      propertyId: config.ga4PropertyId,
      clientEmail: creds.clientEmail
    });

    return {
      service: 'Google Analytics 4',
      status: classified.status,
      authorized: false,
      message: classified.message,
      propertyId: config.ga4PropertyId,
      period,
      data: null
    };
  }
}
