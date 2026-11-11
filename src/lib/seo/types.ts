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
  descriptiveAltCount?: number;
  missingAltImagesCount: number;
  totalImagesCount: number;
  internalLinksCount: number;
  wordCount: number;
  hasYoastSchema: boolean;
  categories?: number[];
  issues: SEOIssue[];
}

export interface HomepageSEOSummary {
  url: string;
  title: string;
  metaDescription: string;
  canonical: string;
  robotsTag: string;
  ogTitle?: string;
  ogDescription?: string;
  h1Count: number;
  headings: string[];
  issues: SEOIssue[];
  fetchError?: string;
}

export interface TechnicalSEOSummary {
  robotsTxtStatus: 'accessible' | 'error' | 'unavailable';
  robotsTxtContent: string;
  sitemapIndexUrl: string;
  sitemapAccessible: boolean;
  sitemapCount: number;
  protocolIssues: {
    type: 'mixed_content' | 'insecure_sitemap' | 'site_url_mismatch';
    details: string;
  }[];
  schemaValidation: {
    hasSchema: boolean;
    typesFound: string[];
    valid: boolean;
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
    protocolIssuesCount?: number;
    errorsCount?: number;
    failedRequestsCount?: number;
    recommendationsCount?: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    missingAltTotal?: number;
    emptyAltTotal?: number;
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
