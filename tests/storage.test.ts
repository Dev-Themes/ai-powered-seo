import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  saveAuditReport,
  saveRecommendationsReport,
  listReports,
  getReportById,
  getLatestAuditReport,
  getLatestRecommendationsReport,
  normalizeAuditReport
} from '../src/lib/shared/storage';
import type {
  FirstReadAuditReport,
  HomepageSEOSummary,
  TechnicalSEOSummary
} from '../src/lib/seo/types';
import type { SiteInfo } from '../src/lib/wordpress/types';
import type { FirstReadRecommendationsReport } from '../src/lib/content/types';

test('report storage saves, lists, and retrieves FirstRead audit reports', async () => {
  const dummyAudit: FirstReadAuditReport = {
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
      title: 'Firstread',
      metaDescription: '',
      canonical: 'https://firstread.co.uk/',
      robotsTag: 'index, follow',
      h1Count: 1,
      headings: ['Firstread'],
      issues: []
    },
    technical: {
      robotsTxtStatus: 'accessible',
      robotsTxtContent: 'User-agent: *',
      sitemapIndexUrl: 'https://firstread.co.uk/sitemap_index.xml',
      sitemapAccessible: true,
      sitemapCount: 2,
      protocolIssues: [],
      schemaValidation: {
        hasSchema: true,
        typesFound: ['WebSite'],
        valid: true
      }
    },
    summary: {
      totalChecked: 1,
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

  const saved = await saveAuditReport(dummyAudit);
  try {
    assert.ok(saved.id.startsWith('firstread-audit-'));
    assert.equal(saved.status, 'complete');

    const retrieved = await getReportById(saved.id);
    assert.ok(retrieved !== null);
    assert.equal(retrieved?.id, saved.id);

    const reports = await listReports();
    assert.ok(reports.some(r => r.id === saved.id));

    const latest = await getLatestAuditReport();
    assert.ok(latest !== null);
    assert.equal(latest?.origin, 'https://firstread.co.uk');
  } finally {
    const filePath = path.join(process.cwd(), 'content', 'reports', `${saved.id}.json`);
    await fs.unlink(filePath).catch(() => {});
  }
});

test('recommendations storage saves and retrieves recommendation reports', async () => {
  const dummyRecs: FirstReadRecommendationsReport = {
    generatedAt: new Date().toISOString(),
    summary: 'Test synthesis summary',
    recommendations: [
      {
        id: 'rec-unit-test-1',
        priority: 'high',
        confidence: 'high',
        category: 'metadata',
        targetUrl: 'https://firstread.co.uk/sample',
        slug: 'sample',
        issue: 'Missing Meta Description',
        reasoning: 'Reduces snippet clarity in SERP',
        currentValue: {},
        recommendedValue: { description: 'Proposed snippet' },
        evidence: 'Empty description',
        limitations: 'Advisory only'
      }
    ]
  };

  const saved = await saveRecommendationsReport(dummyRecs);
  try {
    assert.ok(saved.id.startsWith('firstread-recommend-'));
    assert.equal(saved.status, 'complete');

    const retrieved = await getReportById(saved.id);
    assert.ok(retrieved !== null);
    assert.equal(retrieved?.id, saved.id);

    const latestRec = await getLatestRecommendationsReport();
    assert.ok(latestRec !== null);
  } finally {
    const filePath = path.join(process.cwd(), 'content', 'reports', `${saved.id}.json`);
    await fs.unlink(filePath).catch(() => {});
  }
});

test('normalizeAuditReport preserves backward compatibility for legacy field names', () => {
  const legacyReport = {
    auditedAt: new Date().toISOString(),
    origin: 'https://firstread.co.uk',
    readOnlyEnforced: true as const,
    siteInfo: {} as unknown as SiteInfo,
    homepage: {} as unknown as HomepageSEOSummary,
    technical: {} as unknown as TechnicalSEOSummary,
    summary: {
      totalChecked: 10,
      errorsCount: 3,
      missingAltImagesTotal: 5,
      criticalCount: 3,
      warningCount: 2,
      infoCount: 1,
      duplicateTitlesCount: 0,
      duplicateDescriptionsCount: 0
    },
    articles: [
      {
        id: 1,
        slug: 'test',
        link: 'https://firstread.co.uk/test',
        title: 'Test',
        seoTitle: 'Test',
        seoDescription: '',
        canonical: 'https://firstread.co.uk/test',
        h1Count: 2,
        h2Count: 1,
        h3Count: 0,
        missingAltImagesCount: 4,
        totalImagesCount: 5,
        internalLinksCount: 1,
        wordCount: 500,
        hasYoastSchema: true,
        issues: []
      }
    ],
    duplicates: [],
    internalLinkingOpportunities: []
  };

  const normalized = normalizeAuditReport(legacyReport as unknown as FirstReadAuditReport);
  assert.equal(normalized.summary.protocolIssuesCount, 3);
  assert.equal(normalized.summary.missingAltTotal, 5);
  assert.equal(normalized.articles[0].bodyH1Count, 2);
  assert.equal(normalized.articles[0].missingAltCount, 4);
});
