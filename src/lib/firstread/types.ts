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
  h1Count: number;
  h2Count: number;
  h3Count: number;
  missingAltImagesCount: number;
  totalImagesCount: number;
  internalLinksCount: number;
  wordCount: number;
  hasYoastSchema: boolean;
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
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    missingAltImagesTotal: number;
    duplicateTitlesCount: number;
    duplicateDescriptionsCount: number;
  };
  articles: ArticleSEOSummary[];
  duplicates: DuplicateMetadataGroup[];
  internalLinkingOpportunities: {
    targetSlug: string;
    topic: string;
    suggestedSources: string[];
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
  requiresApproval: true;
  approved: boolean;
}

export interface FirstReadRecommendationsReport {
  generatedAt: string;
  summary: string;
  recommendations: FirstReadAIRecommendation[];
}
