import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReadOnlyRequest,
  FirstReadSecurityError,
  FIRSTREAD_ORIGIN
} from '../src/lib/firstread/security';
import {
  auditArticlePost,
  auditTechnical,
  detectDuplicates,
  decodeHtmlEntities
} from '../src/lib/firstread/audit';
import { generateFirstReadRecommendations } from '../src/lib/firstread/ai';
import { getFirstReadGoogleStatus } from '../src/lib/firstread/google-interfaces';
import { fetchPublishedPosts, fetchSiteInfo } from '../src/lib/firstread/client';
import type { WordPressPost, FirstReadAuditReport } from '../src/lib/firstread/types';

test('FirstRead security policy strictly enforces read-only GET requests and fails closed on write methods', () => {
  // Disallowed mutating methods must immediately throw FirstReadSecurityError
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.throws(
      () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', { method }),
      (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Forbidden HTTP method')
    );
  }

  // Allowed GET requests to permitted endpoints succeed
  const valid = validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts?per_page=10', { method: 'GET' });
  assert.equal(valid.origin, FIRSTREAD_ORIGIN);
  assert.equal(valid.pathname, '/wp-json/wp/v2/posts');
});

test('FirstRead security policy rejects credentials, authorization headers, and WP nonces', () => {
  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' }
    }),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Credentials, authorization headers')
  );

  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', {
      headers: { Cookie: 'wordpress_logged_in=123' }
    }),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Credentials, authorization headers')
  );

  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', {
      headers: { 'X-WP-Nonce': 'secretnonce' }
    }),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Credentials, authorization headers')
  );
});

test('FirstRead security policy rejects external origins and non-allowlisted paths', () => {
  assert.throws(
    () => validateReadOnlyRequest('https://malicious-site.com/steal-data'),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Invalid target origin')
  );

  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-admin/admin-ajax.php'),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('not on the FirstRead read-only allowlist')
  );

  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-login.php'),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('not on the FirstRead read-only allowlist')
  );
});

test('HTML entity decoding handles common entities and typographic quotes', () => {
  assert.equal(decodeHtmlEntities('Simpler or More Simple &#038; Examples'), 'Simpler or More Simple & Examples');
  assert.equal(decodeHtmlEntities('It&#8217;s a &#8220;test&#8221;'), 'It’s a “test”');
  assert.equal(decodeHtmlEntities('&lt;div&gt;Hello&lt;/div&gt;'), '<div>Hello</div>');
});

test('Article SEO auditor flags missing alt text, long titles, missing descriptions, and body H1s', () => {
  const samplePost: WordPressPost = {
    id: 101,
    date: '2026-10-10T10:00:00',
    date_gmt: '2026-10-10T10:00:00',
    modified: '2026-10-10T10:00:00',
    modified_gmt: '2026-10-10T10:00:00',
    slug: 'grammar-guide-test',
    status: 'publish',
    type: 'post',
    link: 'https://firstread.co.uk/grammar-guide-test/',
    title: { rendered: 'An Extremely Long Article Title That Clearly Exceeds The Optimal Length For Search Snippets' },
    content: {
      rendered: `
        <h1>Duplicate H1 in body</h1>
        <p>This is an introductory paragraph discussing grammar rules in modern English.</p>
        <img src="/image-1.jpg" alt="" />
        <img src="/image-2.jpg" />
        <img src="/image-3.jpg" alt="Valid descriptive illustration" />
        <h2>First Subheading</h2>
        <p>Further discussion on vocabulary and usage without any internal links. This paragraph contains additional explanatory text about proper sentence structure, formal idioms, dialect variations, syntax rules, linguistic history, and academic writing standards so that the sample article has sufficient word count for editorial analysis. Writers should always aim for clarity and conciseness when preparing published materials.</p>
        <p>Another section discussing semantic nuances and comparative analysis between traditional British idioms and contemporary expressions. Ensuring consistent style and authoritative citations strengthens the article validity across all publication channels.</p>
        <p>Detailed breakdown of grammatical voice, passive constructions, dangling modifiers, split infinitives, subject-verb agreement, and subjunctive moods in professional publishing contexts.</p>
      `,
      protected: false
    },
    excerpt: { rendered: '<p>Excerpt</p>', protected: false },
    author: 1,
    featured_media: 0,
    categories: [1],
    tags: [2],
    yoast_head_json: {
      title: 'An Extremely Long Article Title That Clearly Exceeds The Optimal Length For Search Snippets - Firstread',
      description: '', // Missing meta description
      canonical: 'https://firstread.co.uk/grammar-guide-test/'
    }
  };

  const audit = auditArticlePost(samplePost);
  assert.equal(audit.id, 101);
  assert.equal(audit.totalImagesCount, 3);
  assert.equal(audit.missingAltImagesCount, 2);
  assert.equal(audit.h1Count, 1);
  assert.equal(audit.internalLinksCount, 0);

  // Issues should include long title, missing meta description, body H1, and missing alt
  const issueIds = audit.issues.map(i => i.id);
  assert.ok(issueIds.some(id => id.startsWith('art-title-long')));
  assert.ok(issueIds.some(id => id.startsWith('art-desc-missing')));
  assert.ok(issueIds.some(id => id.startsWith('art-h1-body')));
  assert.ok(issueIds.some(id => id.startsWith('art-alt-missing')));
  assert.ok(issueIds.some(id => id.startsWith('art-links-zero')));
});

test('Technical SEO auditor identifies protocol mismatches (HTTP vs HTTPS)', async () => {
  const siteUrl = 'http://firstread.co.uk';
  const homeUrl = 'https://firstread.co.uk';

  const tech = await auditTechnical(siteUrl, homeUrl);
  assert.ok(tech.protocolIssues.some(p => p.type === 'site_url_mismatch'));
  assert.ok(tech.schemaValidation.typesFound.includes('Article'));
});

test('Duplicate detector flags duplicate title tags and descriptions across posts', () => {
  const mockArticles = [
    {
      id: 1,
      slug: 'post-1',
      link: 'https://firstread.co.uk/post-1/',
      title: 'Common English Mistakes',
      seoTitle: 'Common English Mistakes - Firstread',
      seoDescription: 'Learn about common English grammar mistakes and how to avoid them.',
      canonical: 'https://firstread.co.uk/post-1/',
      h1Count: 0,
      h2Count: 2,
      h3Count: 1,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 2,
      wordCount: 800,
      hasYoastSchema: true,
      issues: []
    },
    {
      id: 2,
      slug: 'post-2',
      link: 'https://firstread.co.uk/post-2/',
      title: 'Duplicate Title Post',
      seoTitle: 'Common English Mistakes - Firstread', // Duplicate
      seoDescription: 'Different description.',
      canonical: 'https://firstread.co.uk/post-2/',
      h1Count: 0,
      h2Count: 2,
      h3Count: 1,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 2,
      wordCount: 750,
      hasYoastSchema: true,
      issues: []
    }
  ];

  const duplicates = detectDuplicates(mockArticles);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].type, 'title');
  assert.equal(duplicates[0].occurrences.length, 2);
});

test('AI recommendation engine requires human approval for all proposals and does not mutate WordPress', async () => {
  const mockAudit: FirstReadAuditReport = {
    auditedAt: new Date().toISOString(),
    origin: FIRSTREAD_ORIGIN,
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
      url: FIRSTREAD_ORIGIN + '/',
      title: 'Firstread',
      metaDescription: '',
      canonical: FIRSTREAD_ORIGIN + '/',
      robotsTag: 'index, follow',
      h1Count: 0,
      headings: [],
      issues: []
    },
    technical: {
      robotsTxtStatus: 'accessible',
      robotsTxtContent: 'User-agent: *\nSitemap: http://firstread.co.uk/sitemap_index.xml',
      sitemapIndexUrl: 'http://firstread.co.uk/sitemap_index.xml',
      sitemapAccessible: true,
      sitemapCount: 2,
      protocolIssues: [
        { type: 'site_url_mismatch', details: 'WordPress Address is HTTP while Site Address is HTTPS' }
      ],
      schemaValidation: {
        hasSchema: true,
        typesFound: ['WebSite', 'Article'],
        valid: true
      }
    },
    summary: {
      totalChecked: 2,
      criticalCount: 1,
      warningCount: 2,
      infoCount: 1,
      missingAltImagesTotal: 1,
      duplicateTitlesCount: 0,
      duplicateDescriptionsCount: 0
    },
    articles: [
      {
        id: 1,
        slug: 'test-article',
        link: 'https://firstread.co.uk/test-article/',
        title: 'Test Article With Very Long Title Exceeding Snippet Length For Testing Purposes',
        seoTitle: 'Test Article With Very Long Title Exceeding Snippet Length For Testing Purposes - Firstread',
        seoDescription: '',
        canonical: 'https://firstread.co.uk/test-article/',
        h1Count: 0,
        h2Count: 2,
        h3Count: 0,
        missingAltImagesCount: 1,
        totalImagesCount: 2,
        internalLinksCount: 0,
        wordCount: 600,
        hasYoastSchema: true,
        issues: []
      }
    ],
    duplicates: [],
    internalLinkingOpportunities: [
      { targetSlug: 'test-article', topic: 'grammar testing', suggestedSources: ['other-article'] }
    ]
  };

  const report = await generateFirstReadRecommendations(mockAudit);
  assert.ok(report.recommendations.length > 0);
  for (const rec of report.recommendations) {
    // Every single recommendation MUST mandate approval
    assert.equal(rec.requiresApproval, true);
    assert.equal(rec.approved, false);
    assert.ok(rec.reasoning.length > 0);
    assert.ok(rec.evidence.length > 0);
  }
});

test('Google integrations interface reports unconfigured status truthfully without fabricating ranks or traffic', () => {
  const status = getFirstReadGoogleStatus();
  assert.equal(status.configured, false);
  assert.equal(status.searchConsole.status, 'unconfigured');
  assert.equal(status.analytics4.status, 'unconfigured');
  assert.ok(!('metrics' in status.searchConsole) || status.searchConsole.metrics === undefined);
  assert.ok(status.notes.some(n => n.includes('aggregated search appearance')));
});

test('Live WordPress client fetches real site information and published posts with pagination', async () => {
  const siteInfo = await fetchSiteInfo();
  assert.ok(siteInfo.name.length > 0, 'Site name should not be empty');
  assert.ok(siteInfo.totalPosts > 0, 'Total posts should be greater than 0');
  assert.ok(siteInfo.totalCategories > 0, 'Total categories should be greater than 0');

  const { posts, totalPosts, totalPages } = await fetchPublishedPosts(1, 2);
  assert.ok(posts.length > 0, 'Should fetch at least one published post');
  assert.ok(totalPosts > 0, 'Total posts header should be greater than 0');
  assert.ok(totalPages >= 1, 'Total pages should be at least 1');
  assert.ok(posts[0].id > 0, 'Post ID should be positive integer');
  assert.ok(posts[0].title.rendered.length > 0, 'Post title should be non-empty');
  assert.ok(posts[0].link.startsWith('https://firstread.co.uk/'), 'Post link should target FirstRead');
});
