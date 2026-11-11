/**
 * Google Integrations Interface Contracts for FirstRead Autonomous SEO.
 * 
 * Provides clean contracts for Google Search Console API and Google Analytics Data API (GA4)
 * preparing for live Phase 3 data ingestion without inventing credentials or fake metrics.
 */

export interface GSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface FirstReadGSCMetrics {
  status: 'connected' | 'unconfigured' | 'error';
  message: string;
  property?: string;
  period?: {
    startDate: string;
    endDate: string;
  };
  metrics?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries?: GSCQueryRow[];
}

export interface FirstReadGA4Metrics {
  status: 'connected' | 'unconfigured' | 'error';
  message: string;
  propertyId?: string;
  period?: {
    startDate: string;
    endDate: string;
  };
  sessions?: number;
  engagedSessions?: number;
  engagementRate?: number;
}

export interface GoogleIntegrationReadiness {
  gscProperty: string | null;
  ga4PropertyId: string | null;
  hasServiceAccount: boolean;
  readyForIngestion: boolean;
  requiredScopes: string[];
}

/**
 * Checks whether environment variables required for Google APIs are provisioned
 */
export function getGoogleIntegrationReadiness(): GoogleIntegrationReadiness {
  const gscProperty = process.env.FIRSTREAD_GSC_PROPERTY || null;
  const ga4PropertyId = process.env.FIRSTREAD_GA4_PROPERTY_ID || null;
  const hasServiceAccount = !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);

  return {
    gscProperty,
    ga4PropertyId,
    hasServiceAccount,
    readyForIngestion: hasServiceAccount && !!(gscProperty || ga4PropertyId),
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
