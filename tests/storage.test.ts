import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveAuditReport,
  saveRecommendationsReport,
  listReports,
  getReportById,
  getLatestAuditReport,
  getApprovals,
  setApproval
} from '../src/lib/firstread/storage';
import type { FirstReadAuditReport, FirstReadRecommendationsReport } from '../src/lib/firstread/types';

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
});

test('recommendations storage saves and persists approval status internally', async () => {
  const dummyRecs: FirstReadRecommendationsReport = {
    generatedAt: new Date().toISOString(),
    summary: 'Test summary',
    recommendations: [
      {
        id: 'rec-unit-test-1',
        priority: 'high',
        confidence: 'high',
        category: 'metadata',
        targetUrl: 'https://firstread.co.uk/sample',
        slug: 'sample',
        issue: 'Missing Meta Description',
        reasoning: 'Reduces snippet clarity',
        currentValue: {},
        recommendedValue: { description: 'Proposed snippet' },
        evidence: 'Empty description',
        limitations: 'Advisory only',
        requiresApproval: true,
        approved: false
      }
    ]
  };

  const saved = await saveRecommendationsReport(dummyRecs);
  assert.ok(saved.id.startsWith('firstread-recommend-'));

  // Toggle approval
  const approvedIds = await setApproval('rec-unit-test-1', true);
  assert.ok(approvedIds.includes('rec-unit-test-1'));

  const check = await getApprovals();
  assert.ok(check.includes('rec-unit-test-1'));

  // Untoggle approval
  const unapproved = await setApproval('rec-unit-test-1', false);
  assert.ok(!unapproved.includes('rec-unit-test-1'));
});
