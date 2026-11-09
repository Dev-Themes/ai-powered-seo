/**
 * Future Google Integration Interfaces for FirstRead.
 * 
 * Prepares clean contracts for Google Search Console API and Google Analytics Data API (GA4)
 * without inventing credentials or claiming unverified data.
 */

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
  topQueries?: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
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

export interface FirstReadGoogleIntegrationsState {
  searchConsole: FirstReadGSCMetrics;
  analytics4: FirstReadGA4Metrics;
  configured: boolean;
  notes: string[];
}

/**
 * Returns the current live status of Google Integrations for FirstRead.
 * Never invents mock metrics or claims live rankings when unconfigured.
 */
export function getFirstReadGoogleStatus(): FirstReadGoogleIntegrationsState {
  const gscProperty = process.env.FIRSTREAD_GSC_PROPERTY;
  const ga4Property = process.env.FIRSTREAD_GA4_PROPERTY_ID;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  const hasCreds = !!(clientEmail && privateKey);

  const searchConsole: FirstReadGSCMetrics = (!hasCreds || !gscProperty)
    ? {
        status: 'unconfigured',
        message: 'Google Search Console property for FirstRead is pending authorized service account access. No live ranking claims are made.',
        property: gscProperty || undefined
      }
    : {
        status: 'unconfigured',
        message: 'Credentials present but property verification pending.',
        property: gscProperty
      };

  const analytics4: FirstReadGA4Metrics = (!hasCreds || !ga4Property)
    ? {
        status: 'unconfigured',
        message: 'Google Analytics 4 property ID for FirstRead is pending configuration.',
        propertyId: ga4Property || undefined
      }
    : {
        status: 'unconfigured',
        message: 'Credentials present but GA4 verification pending.',
        propertyId: ga4Property
      };

  return {
    searchConsole,
    analytics4,
    configured: false,
    notes: [
      'GSC and GA4 connections require explicit site verification in Google Search Console for https://firstread.co.uk.',
      'Average position from Search Console represents aggregated search appearance, not a live keyword ranking.',
      'GA4 sessions and GSC clicks are independent measurements and are reported separately.'
    ]
  };
}
