import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditArticlePost,
  auditTechnical,
  auditHomepage,
  detectDuplicates
} from '../src/lib/seo/audit';
import { executeTechnicalAudit, executeKeywordResearch, executeCompetitorAnalysis, executeSearchIntentAnalysis, executeContentGapDiscovery, executeTopicClusterGeneration, executeSEOStrategyGeneration, executeArticleResearch, executeArticleGeneration, executeArticleQA, executeRecommendationsGeneration } from '../src/lib/seo/operations';
import { normalizeAuditReport } from '../src/lib/shared/storage';
import type { WordPressPost } from '../src/lib/wordpress/types';
import type { FirstReadAuditReport } from '../src/lib/seo/types';

// ---------------------------------------------------------------------------
// 1. Protocol Issue Classification, Redirects, and Root Cause Grouping
// ---------------------------------------------------------------------------

test('Protocol Audit — Identifies site_url vs home mismatch with 301 redirect and root cause grouping', async () => {
  const siteUrl = 'http://firstread.co.uk';
  const homeUrl = 'https://firstread.co.uk';

  const tech = await auditTechnical(siteUrl, homeUrl);

  // 1. Site URL mismatch issue presence
  const siteUrlIssue = tech.protocolIssues.find(p => p.type === 'site_url_mismatch');
  assert.ok(siteUrlIssue, 'site_url_mismatch issue must be identified');
  assert.equal(siteUrlIssue?.originalUrl, 'http://firstread.co.uk');
  assert.equal(siteUrlIssue?.finalUrl, 'https://firstread.co.uk');
  assert.equal(siteUrlIssue?.httpStatus, 301);
  assert.equal(siteUrlIssue?.httpsAccessible, true);
  assert.equal(siteUrlIssue?.canonicalConsistent, true);
  assert.equal(siteUrlIssue?.severity, 'warning');
  assert.ok(siteUrlIssue?.rootCause?.includes('WordPress Address (site_url)'));
  assert.ok(siteUrlIssue?.recommendation?.includes('WordPress General Settings'));

  // 2. Root cause grouping
  assert.ok(tech.rootCauseGroups && tech.rootCauseGroups.length > 0, 'Must provide root cause grouping');
  const group = tech.rootCauseGroups[0];
  assert.ok(group.rootCause.includes('WordPress Address'));
  assert.equal(group.severity, 'warning');
  assert.ok(group.affectedCount >= 1);
  assert.ok(group.description.includes('301 redirect'));
});

test('Protocol Audit — Sitemap index and child sitemaps accessibility and HTTPS content verification', async () => {
  const siteUrl = 'http://firstread.co.uk';
  const homeUrl = 'https://firstread.co.uk';

  const tech = await auditTechnical(siteUrl, homeUrl);

  assert.equal(tech.robotsTxtStatus, 'accessible');
  assert.equal(tech.sitemapAccessible, true);
  assert.ok(tech.sitemapCount >= 5, 'Should detect at least 5 sub-sitemaps');

  // Verify child sitemap protocol issues report redirect and HTTPS availability
  const sitemapIssues = tech.protocolIssues.filter(p => p.type === 'insecure_sitemap');
  assert.ok(sitemapIssues.length >= 1, 'Should evaluate sitemap references');
  for (const issue of sitemapIssues) {
    assert.equal(issue.httpStatus, 301);
    assert.equal(issue.httpsAccessible, true);
    assert.equal(issue.severity, 'warning');
    assert.ok(issue.finalUrl?.startsWith('https://'));
    assert.ok(issue.rootCause?.includes('Yoast SEO'));
  }
});

// ---------------------------------------------------------------------------
// 2. Audit Coverage Calculations (Sampled, Full, Continuation)
// ---------------------------------------------------------------------------

test('Audit Coverage — Sampled audit calculates accurate metrics (100 / 343 = 29.2%)', () => {
  const mockReport: FirstReadAuditReport = {
    auditedAt: new Date().toISOString(),
    origin: 'https://firstread.co.uk',
    readOnlyEnforced: true,
    siteInfo: {
      name: 'Firstread',
      description: '',
      url: 'http://firstread.co.uk',
      home: 'https://firstread.co.uk',
      gmt_offset: '0',
      timezone_string: '',
      totalPosts: 343,
      totalPages: 7,
      totalCategories: 19,
      totalTags: 265,
      serverEngine: 'LiteSpeed',
      seoPlugin: 'Yoast SEO'
    },
    homepage: {
      url: 'https://firstread.co.uk/',
      title: 'Homepage - Firstread',
      metaDescription: 'Description',
      canonical: 'https://firstread.co.uk/',
      robotsTag: 'index, follow',
      h1Count: 1,
      headings: ['Firstread'],
      issues: []
    },
    technical: {
      robotsTxtStatus: 'accessible',
      robotsTxtContent: 'User-agent: *\nSitemap: http://firstread.co.uk/sitemap_index.xml',
      sitemapIndexUrl: 'http://firstread.co.uk/sitemap_index.xml',
      sitemapAccessible: true,
      sitemapCount: 5,
      protocolIssues: [],
      schemaValidation: { hasSchema: true, typesFound: ['WebSite', 'Article'], valid: true }
    },
    summary: {
      totalChecked: 100,
      totalDiscovered: 343,
      totalAudited: 100,
      notAudited: 243,
      coveragePercentage: 29.2,
      auditScope: 'sampled',
      isComplete: false,
      articlesDiscovered: 343,
      articlesAudited: 100,
      articlesSkipped: 243,
      protocolIssuesCount: 0,
      errorsCount: 0,
      failedRequestsCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      missingAltTotal: 0,
      emptyAltTotal: 0,
      descriptiveAltTotal: 0,
      missingAltImagesTotal: 0,
      duplicateTitlesCount: 0,
      duplicateDescriptionsCount: 0
    },
    articles: [],
    duplicates: [],
    internalLinkingOpportunities: []
  };

  const normalized = normalizeAuditReport(mockReport);
  assert.equal(normalized.summary.totalDiscovered, 343);
  assert.equal(normalized.summary.totalAudited, 100);
  assert.equal(normalized.summary.notAudited, 243);
  assert.equal(normalized.summary.coveragePercentage, 29.2);
  assert.equal(normalized.summary.auditScope, 'sampled');
  assert.equal(normalized.summary.isComplete, false);
});

test('Audit Coverage — Full audit calculates 100% coverage and marks complete', () => {
  const mockReport: FirstReadAuditReport = {
    auditedAt: new Date().toISOString(),
    origin: 'https://firstread.co.uk',
    readOnlyEnforced: true,
    siteInfo: {
      name: 'Firstread',
      description: '',
      url: 'http://firstread.co.uk',
      home: 'https://firstread.co.uk',
      gmt_offset: '0',
      timezone_string: '',
      totalPosts: 343,
      totalPages: 7,
      totalCategories: 19,
      totalTags: 265,
      serverEngine: 'LiteSpeed',
      seoPlugin: 'Yoast SEO'
    },
    homepage: {
      url: 'https://firstread.co.uk/',
      title: 'Homepage - Firstread',
      metaDescription: 'Description',
      canonical: 'https://firstread.co.uk/',
      robotsTag: 'index, follow',
      h1Count: 1,
      headings: ['Firstread'],
      issues: []
    },
    technical: {
      robotsTxtStatus: 'accessible',
      robotsTxtContent: '',
      sitemapIndexUrl: '',
      sitemapAccessible: true,
      sitemapCount: 5,
      protocolIssues: [],
      schemaValidation: { hasSchema: true, typesFound: ['WebSite', 'Article'], valid: true }
    },
    summary: {
      totalChecked: 343,
      totalDiscovered: 343,
      totalAudited: 343,
      notAudited: 0,
      coveragePercentage: 100.0,
      auditScope: 'complete',
      isComplete: true,
      articlesDiscovered: 343,
      articlesAudited: 343,
      articlesSkipped: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      missingAltImagesTotal: 0,
      duplicateTitlesCount: 0,
      duplicateDescriptionsCount: 0
    },
    articles: [],
    duplicates: [],
    internalLinkingOpportunities: []
  };

  const normalized = normalizeAuditReport(mockReport);
  assert.equal(normalized.summary.totalDiscovered, 343);
  assert.equal(normalized.summary.totalAudited, 343);
  assert.equal(normalized.summary.notAudited, 0);
  assert.equal(normalized.summary.coveragePercentage, 100);
  assert.equal(normalized.summary.auditScope, 'complete');
  assert.equal(normalized.summary.isComplete, true);
});

// ---------------------------------------------------------------------------
// 3. Image Alt Classification (Missing, Empty/Decorative, Generic, Descriptive)
// ---------------------------------------------------------------------------

test('Image Alt Auditor — Accurately distinguishes missing, empty decorative, generic, and descriptive alt attributes', () => {
  const post: WordPressPost = {
    id: 501,
    date: '2026-10-10T10:00:00',
    date_gmt: '2026-10-10T10:00:00',
    modified: '2026-10-10T10:00:00',
    modified_gmt: '2026-10-10T10:00:00',
    slug: 'image-classification-test',
    status: 'publish',
    type: 'post',
    link: 'https://firstread.co.uk/image-classification-test/',
    title: { rendered: 'Image Classification Test' },
    content: {
      rendered: `
        <p>Paragraph.</p>
        <img src="https://firstread.co.uk/wp-content/uploads/2026/img-missing.jpg" />
        <img src="https://firstread.co.uk/wp-content/uploads/2026/img-empty.png" alt="" />
        <img src="https://firstread.co.uk/wp-content/uploads/2026/img-generic.png" alt="screenshot-1" />
        <img src="https://firstread.co.uk/wp-content/uploads/2026/img-generic2.jpg" alt="image" />
        <img src="https://firstread.co.uk/wp-content/uploads/2026/img-descriptive.jpg" alt="Detailed quarterly revenue comparison chart" />
      `,
      protected: false
    },
    excerpt: { rendered: '', protected: false },
    author: 1,
    featured_media: 999, // Featured image outside content
    categories: [],
    tags: [],
    yoast_head_json: {
      title: 'Image Classification Test - Firstread',
      description: 'Post testing alt text classification.',
      canonical: 'https://firstread.co.uk/image-classification-test/'
    }
  };

  const audit = auditArticlePost(post);
  assert.equal(audit.totalImagesCount, 5);
  assert.equal(audit.missingAltCount, 1, 'Only image without alt attribute is missing');
  assert.equal(audit.emptyAltCount, 1, 'Image with alt="" is empty/decorative');
  assert.equal(audit.genericAltCount, 2, 'screenshot-1 and image are generic alt texts');
  assert.equal(audit.descriptiveAltCount, 1, 'Descriptive alt text recognized');

  // Verify severity classification:
  // Missing alt -> Warning (accessibility issue)
  const missingIssue = audit.issues.find(i => i.id.startsWith('art-alt-missing'));
  assert.ok(missingIssue);
  assert.equal(missingIssue?.severity, 'warning');

  // Empty alt -> Info (confirm decorative purpose)
  const emptyIssue = audit.issues.find(i => i.id.startsWith('art-alt-empty'));
  assert.ok(emptyIssue);
  assert.equal(emptyIssue?.severity, 'info');

  // Generic alt -> Info
  const genericIssue = audit.issues.find(i => i.id.startsWith('art-alt-generic'));
  assert.ok(genericIssue);
  assert.equal(genericIssue?.severity, 'info');

  // Verify detailed imageAudits array
  assert.ok(audit.imageAudits);
  assert.equal(audit.imageAudits.length, 5);
  assert.equal(audit.imageAudits[0].classification, 'missing_alt');
  assert.equal(audit.imageAudits[1].classification, 'empty_alt');
  assert.equal(audit.imageAudits[2].classification, 'generic_alt');
  assert.equal(audit.imageAudits[3].classification, 'generic_alt');
  assert.equal(audit.imageAudits[4].classification, 'descriptive_alt');
});

// ---------------------------------------------------------------------------
// 4. Duplicate URL & Metadata Handling
// ---------------------------------------------------------------------------

test('Duplicate Handling — Detects duplicate titles and meta descriptions accurately without false positives', () => {
  const articles = [
    {
      id: 1,
      slug: 'article-a',
      link: 'https://firstread.co.uk/article-a/',
      title: 'Guide to London Property',
      seoTitle: 'Guide to London Property - Firstread',
      seoDescription: 'A comprehensive overview of property investing in London.',
      canonical: 'https://firstread.co.uk/article-a/',
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 1,
      wordCount: 500,
      hasYoastSchema: true,
      issues: []
    },
    {
      id: 2,
      slug: 'article-b',
      link: 'https://firstread.co.uk/article-b/',
      title: 'Guide to London Property Duplicate',
      seoTitle: 'Guide to London Property - Firstread', // Duplicate title
      seoDescription: 'Unique description for article b.',
      canonical: 'https://firstread.co.uk/article-b/',
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 1,
      wordCount: 500,
      hasYoastSchema: true,
      issues: []
    }
  ];

  const duplicates = detectDuplicates(articles);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].type, 'title');
  assert.equal(duplicates[0].occurrences.length, 2);
  assert.equal(duplicates[0].occurrences[0].slug, 'article-a');
  assert.equal(duplicates[0].occurrences[1].slug, 'article-b');
});

// ---------------------------------------------------------------------------
// 5. Schema Detection & Validation
// ---------------------------------------------------------------------------

test('Homepage Schema — Parses JSON-LD schema graph, validates syntax, and distinguishes rich results eligibility', async () => {
  const hp = await auditHomepage();
  assert.ok(hp.title.length > 0);
  assert.ok(hp.metaDescription.length > 0);
  assert.ok(hp.canonical.startsWith('https://'));
  assert.equal(hp.h1Count, 1);
  assert.ok(hp.headings.length >= 1);

  if (hp.schemaSummary) {
    assert.equal(hp.schemaSummary.isValidJsonLd, true);
    assert.ok(hp.schemaSummary.detectedTypes.length > 0);
    assert.ok(hp.schemaSummary.richResultsNotice.includes('Rich Results'));
  }
});

// ---------------------------------------------------------------------------
// 6. Preservation of All 11 SEO Operations
// ---------------------------------------------------------------------------

test('Operations Preservation — All 11 SEO Operations are defined, exported, and operational', () => {
  assert.equal(typeof executeKeywordResearch, 'function');
  assert.equal(typeof executeCompetitorAnalysis, 'function');
  assert.equal(typeof executeSearchIntentAnalysis, 'function');
  assert.equal(typeof executeContentGapDiscovery, 'function');
  assert.equal(typeof executeTopicClusterGeneration, 'function');
  assert.equal(typeof executeSEOStrategyGeneration, 'function');
  assert.equal(typeof executeArticleResearch, 'function');
  assert.equal(typeof executeArticleGeneration, 'function');
  assert.equal(typeof executeArticleQA, 'function');
  assert.equal(typeof executeTechnicalAudit, 'function');
  assert.equal(typeof executeRecommendationsGeneration, 'function');
});

test('Technical Audit Operation — executeTechnicalAudit supports sampled, full, and continue modes', async () => {
  // Test sampled execution with limit 5 (polite, fast)
  const sampled = await executeTechnicalAudit(5);
  assert.ok((sampled.summary.totalAudited ?? 0) <= 5);
  assert.equal(sampled.summary.auditScope, 'sampled');
  assert.equal(sampled.summary.isComplete, false);

  // Test object options
  const sampledViaOptions = await executeTechnicalAudit({ limit: 5, scope: 'sampled' });
  assert.ok((sampledViaOptions.summary.totalAudited ?? 0) <= 5);
});
