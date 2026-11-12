import type { SiteInfo } from '../wordpress/types';

export interface SEOIssue {
  id: string;
  category: 'metadata' | 'headings' | 'images' | 'links' | 'technical' | 'protocol';
  severity: 'critical' | 'warning' | 'info';
  target: string;
  title: string;
  description: string;
  currentValue?: string;
  recommendation?: string;
}

export interface ProtocolIssue {
  type: 'mixed_content' | 'insecure_sitemap' | 'site_url_mismatch' | 'insecure_link';
  details: string;
  originalUrl?: string;
  finalUrl?: string;
  httpStatus?: number;
  redirectChain?: string[];
  httpsAccessible?: boolean;
  canonicalConsistent?: boolean;
  severity?: 'critical' | 'warning' | 'info';
  rootCause?: string;
  recommendation?: string;
}

export interface ImageAuditItem {
  src: string;
  alt?: string;
  classification: 'missing_alt' | 'empty_alt' | 'generic_alt' | 'descriptive_alt';
  isDecorative?: boolean;
  issue?: string;
  recommendation?: string;
}

export interface ArticleSEOSummary {
  id: number;
  slug: string;
  link: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  bodyH1Count?: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  missingAltCount?: number;
  emptyAltCount?: number;
  genericAltCount?: number;
  descriptiveAltCount?: number;
  missingAltImagesCount: number;
  totalImagesCount: number;
  internalLinksCount: number;
  wordCount: number;
  hasYoastSchema: boolean;
  categories?: number[];
  issues: SEOIssue[];
  imageAudits?: ImageAuditItem[];
}

export interface HomepageSEOSummary {
  url: string;
  title: string;
  metaDescription: string;
  canonical: string;
  robotsTag: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageInsecure?: boolean;
  h1Count: number;
  headings: string[];
  issues: SEOIssue[];
  fetchError?: string;
  schemaSummary?: {
    detectedTypes: string[];
    isValidJsonLd: boolean;
    hasDuplicateSchema: boolean;
    richResultsNotice: string;
  };
}

export interface TechnicalSEOSummary {
  robotsTxtStatus: 'accessible' | 'error' | 'unavailable';
  robotsTxtContent: string;
  sitemapIndexUrl: string;
  sitemapAccessible: boolean;
  sitemapCount: number;
  protocolIssues: ProtocolIssue[];
  rootCauseGroups?: Array<{
    rootCause: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
    affectedCount: number;
    issues: ProtocolIssue[];
    recommendation: string;
  }>;
  schemaValidation: {
    hasSchema: boolean;
    typesFound: string[];
    valid: boolean;
    syntaxValid?: boolean;
    details?: string;
    richResultsNotice?: string;
  };
}

export interface DuplicateMetadataGroup {
  type: 'title' | 'description';
  value: string;
  occurrences: { id: number; slug: string; link: string }[];
}

export interface FirstReadAuditReport {
  auditedAt: string;
  origin: string;
  readOnlyEnforced: true;
  siteInfo: SiteInfo;
  homepage: HomepageSEOSummary;
  technical: TechnicalSEOSummary;
  summary: {
    totalChecked: number;
    totalDiscovered?: number;
    totalAudited?: number;
    notAudited?: number;
    coveragePercentage?: number;
    auditScope?: 'complete' | 'sampled';
    isComplete?: boolean;
    articlesDiscovered?: number;
    articlesAudited?: number;
    articlesSkipped?: number;
    skippedReasons?: Record<string, number>;
    protocolIssuesCount?: number;
    errorsCount?: number;
    failedRequestsCount?: number;
    recommendationsCount?: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    missingAltTotal?: number;
    emptyAltTotal?: number;
    genericAltTotal?: number;
    descriptiveAltTotal?: number;
    missingAltImagesTotal: number;
    featuredImagesNotice?: string;
    duplicateTitlesCount: number;
    duplicateDescriptionsCount: number;
  };
  articles: ArticleSEOSummary[];
  duplicates: DuplicateMetadataGroup[];
  internalLinkingOpportunities: {
    targetSlug: string;
    topic: string;
    suggestedSources: string[];
    relevanceScore?: number;
  }[];
}
