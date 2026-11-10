export interface WordPressPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  yoast_head?: string;
  yoast_head_json?: {
    title?: string;
    description?: string;
    robots?: Record<string, string>;
    canonical?: string;
    og_locale?: string;
    og_type?: string;
    og_title?: string;
    og_description?: string;
    og_url?: string;
    og_site_name?: string;
    article_published_time?: string;
    article_modified_time?: string;
    schema?: Record<string, unknown>;
  };
}

export interface WordPressPage {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    protected: boolean;
  };
  yoast_head_json?: {
    title?: string;
    description?: string;
    canonical?: string;
  };
}

export interface WordPressCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
}

export interface WordPressTag {
  id: number;
  count: number;
  name: string;
  slug: string;
}

export interface SiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
  gmt_offset: string;
  timezone_string: string;
  totalPosts: number;
  totalPages: number;
  totalCategories: number;
  totalTags: number;
  serverEngine: string;
  seoPlugin: string;
}

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
  bodyH1Count?: number; // H1 tags found inside post body content
  h1Count: number; // Preserved for backward compatibility (= bodyH1Count)
  h2Count: number;
  h3Count: number;
  missingAltCount?: number; // Images with no alt attribute at all
  emptyAltCount?: number; // Images with explicitly empty alt="" (decorative)
  descriptiveAltCount?: number; // Images with descriptive alt text
  missingAltImagesCount: number; // Preserved for backward compatibility (= missingAltCount + emptyAltCount)
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
    articlesDiscovered?: number;
    articlesAudited?: number;
    articlesSkipped?: number;
    protocolIssuesCount?: number; // Discovered technical protocol gaps
    errorsCount?: number; // Preserved for backward compatibility (= protocolIssuesCount)
    failedRequestsCount?: number; // Actual failed network/HTTP requests (0 in healthy state)
    recommendationsCount?: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    missingAltTotal?: number;
    emptyAltTotal?: number;
    descriptiveAltTotal?: number;
    missingAltImagesTotal: number; // Preserved for backward compatibility
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

export interface FirstReadAIRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  category: 'metadata' | 'content_structure' | 'internal_linking' | 'technical';
  targetUrl: string;
  slug: string;
  issue: string;
  reasoning: string;
  currentValue: {
    title?: string;
    description?: string;
    structure?: string;
  };
  recommendedValue: {
    title?: string;
    description?: string;
    structure?: string;
  };
  evidence: string;
  limitations: string;
  source?: 'deterministic_audit' | 'gemini_ai' | 'heuristic_engine';
  requiresApproval: true;
  approved: boolean;
}

export interface FirstReadRecommendationsReport {
  generatedAt: string;
  summary: string;
  recommendationsCount?: number;
  recommendations: FirstReadAIRecommendation[];
}
