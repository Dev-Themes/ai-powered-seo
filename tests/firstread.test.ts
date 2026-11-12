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
  decodeHtmlEntities,
  extractMeaningfulTokens,
  findInternalLinkingOpportunities,
  auditHomepage
} from '../src/lib/firstread/audit';
import {
  generateFirstReadRecommendations,
  generateRefinedTitle,
  validateRefinedTitle
} from '../src/lib/firstread/ai';
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
  const origJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const origKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const origEmail = process.env.GOOGLE_CLIENT_EMAIL;
  try {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete process.env.GOOGLE_CLIENT_EMAIL;
    const status = getFirstReadGoogleStatus();
    assert.equal(status.configured, false);
    assert.equal(status.searchConsole.status, 'unconfigured');
    assert.equal(status.analytics4.status, 'unconfigured');
    assert.ok(!('metrics' in status.searchConsole) || status.searchConsole.metrics === undefined);
    assert.ok(status.notes.some(n => n.includes('aggregated search appearance')));
  } finally {
    if (origJson !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = origJson;
    if (origKey !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_KEY = origKey;
    if (origEmail !== undefined) process.env.GOOGLE_CLIENT_EMAIL = origEmail;
  }
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

test('Security allowlist permits root homepage URL and article slugs while blocking non-allowlisted routes', () => {
  // Root URL paths should be permitted
  const rootTrailing = validateReadOnlyRequest('https://firstread.co.uk/', { method: 'GET' });
  assert.equal(rootTrailing.pathname, '/');

  const rootBare = validateReadOnlyRequest('https://firstread.co.uk', { method: 'GET' });
  assert.equal(rootBare.pathname, '/');

  // Slug paths should be permitted
  const articlePath = validateReadOnlyRequest('https://firstread.co.uk/sample-article-slug/', { method: 'GET' });
  assert.equal(articlePath.pathname, '/sample-article-slug/');

  // Disallowed admin / internal paths should be blocked
  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-admin/options-general.php'),
    (err: unknown) => err instanceof FirstReadSecurityError
  );
  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/xmlrpc.php'),
    (err: unknown) => err instanceof FirstReadSecurityError
  );
});

test('Image alt reporting accurately separates missing alt, decorative empty alt, and descriptive alt', () => {
  const post: WordPressPost = {
    id: 201,
    date: '2026-10-10T10:00:00',
    date_gmt: '2026-10-10T10:00:00',
    modified: '2026-10-10T10:00:00',
    modified_gmt: '2026-10-10T10:00:00',
    slug: 'image-alt-test',
    status: 'publish',
    type: 'post',
    link: 'https://firstread.co.uk/image-alt-test/',
    title: { rendered: 'Image Alt Test Post' },
    content: {
      rendered: `
        <p>Introductory paragraph.</p>
        <img src="/img-missing.jpg" />
        <img src="/img-empty.jpg" alt="" />
        <img src="/img-decorative.jpg" alt="   " />
        <img src="/img-descriptive.jpg" alt="Chart showing Q3 financial performance" />
        <p>Concluding paragraph.</p>
      `,
      protected: false
    },
    excerpt: { rendered: '<p>Excerpt</p>', protected: false },
    author: 1,
    featured_media: 0,
    categories: [1],
    tags: [],
    yoast_head_json: {
      title: 'Image Alt Test Post - Firstread',
      description: 'A test post for image alt attributes.',
      canonical: 'https://firstread.co.uk/image-alt-test/'
    }
  };

  const audit = auditArticlePost(post);
  assert.equal(audit.totalImagesCount, 4);
  assert.equal(audit.missingAltCount, 1, 'Only the image with no alt attribute is counted as missing');
  assert.equal(audit.emptyAltCount, 2, 'Images with empty or whitespace-only alt="" are decorative');
  assert.equal(audit.descriptiveAltCount, 1, 'Image with descriptive alt text is recognized');
  assert.equal(audit.missingAltImagesCount, 3, 'Backward compatible total includes missing + decorative');

  // Verify issue severity: missing alt gets warning, decorative empty alt gets info
  const missingAltIssue = audit.issues.find(i => i.id.startsWith('art-alt-missing'));
  assert.ok(missingAltIssue, 'Should flag missing alt issue');
  assert.equal(missingAltIssue?.severity, 'warning');

  const emptyAltIssue = audit.issues.find(i => i.id.startsWith('art-alt-empty'));
  assert.ok(emptyAltIssue, 'Should flag decorative alt note');
  assert.equal(emptyAltIssue?.severity, 'info');
});

test('Heading audit distinguishes body H1 from theme template H1 and detects duplicate H1 defect', () => {
  // Case A: Clean post with zero body H1s (theme renders title as H1)
  const cleanPost: WordPressPost = {
    id: 301,
    date: '2026-10-10T10:00:00',
    date_gmt: '2026-10-10T10:00:00',
    modified: '2026-10-10T10:00:00',
    modified_gmt: '2026-10-10T10:00:00',
    slug: 'clean-post',
    status: 'publish',
    type: 'post',
    link: 'https://firstread.co.uk/clean-post/',
    title: { rendered: 'Clean Post With Semantic Structure' },
    content: {
      rendered: `
        <p>Post intro paragraph.</p>
        <h2>First Subheading</h2>
        <p>Paragraph under H2.</p>
        <h3>Detail Subsection</h3>
        <p>Paragraph under H3.</p>
      `,
      protected: false
    },
    excerpt: { rendered: '', protected: false },
    author: 1,
    featured_media: 0,
    categories: [],
    tags: [],
    yoast_head_json: {
      title: 'Clean Post - Firstread',
      description: 'Clean post description.',
      canonical: 'https://firstread.co.uk/clean-post/'
    }
  };

  const cleanAudit = auditArticlePost(cleanPost);
  assert.equal(cleanAudit.bodyH1Count, 0, 'Clean post has 0 body H1s');
  assert.equal(cleanAudit.h1Count, 0);
  assert.equal(cleanAudit.h2Count, 1);
  assert.equal(cleanAudit.h3Count, 1);
  // Zero body H1 should NOT flag an art-h1-body issue
  assert.ok(!cleanAudit.issues.some(i => i.id.startsWith('art-h1-body')));

  // Case B: Post with author-inserted body H1 (defect)
  const defectPost: WordPressPost = {
    ...cleanPost,
    id: 302,
    slug: 'defect-post',
    content: {
      rendered: `
        <h1>Extra Body Heading</h1>
        <p>Paragraph.</p>
      `,
      protected: false
    }
  };

  const defectAudit = auditArticlePost(defectPost);
  assert.equal(defectAudit.bodyH1Count, 1);
  assert.equal(defectAudit.h1Count, 1);
  const h1Issue = defectAudit.issues.find(i => i.id.startsWith('art-h1-body'));
  assert.ok(h1Issue, 'Should flag duplicate body H1 issue');
  assert.equal(h1Issue?.severity, 'warning');
});

test('Internal linking algorithm filters stop-words and rejects naive substring matches', () => {
  // Test token extraction
  const tokens = extractMeaningfulTokens('everything-you-need-to-know-about-cpa-and-finance');
  assert.ok(tokens.includes('finance'));
  assert.ok(tokens.includes('cpa'));
  // Stop words must be filtered
  assert.ok(!tokens.includes('everything'));
  assert.ok(!tokens.includes('about'));
  assert.ok(!tokens.includes('you'));
  assert.ok(!tokens.includes('need'));

  // Test linking opportunities algorithm with mock articles
  const mockArticles = [
    {
      id: 401,
      slug: 'everything-you-need-to-know-about-cpa-accountant-qualifications',
      link: 'https://firstread.co.uk/cpa-qualifications/',
      title: 'Everything You Need to Know About CPA Accountant Qualifications',
      seoTitle: 'CPA Qualifications Guide',
      seoDescription: 'Guide to CPA accounting.',
      canonical: 'https://firstread.co.uk/cpa-qualifications/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 0,
      wordCount: 800,
      hasYoastSchema: true,
      categories: [10], // Category: Finance/Business
      issues: []
    },
    {
      id: 402,
      slug: 'zoe-kravitz-biography-career-and-lifestyle',
      link: 'https://firstread.co.uk/zoe-kravitz-biography/',
      title: 'Zoë Kravitz Biography, Career, and Lifestyle',
      seoTitle: 'Zoë Kravitz Biography',
      seoDescription: 'Biography of Zoë Kravitz.',
      canonical: 'https://firstread.co.uk/zoe-kravitz-biography/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 1,
      wordCount: 750,
      hasYoastSchema: true,
      categories: [20], // Category: Biography/Entertainment
      issues: []
    },
    {
      id: 403,
      slug: 'chartered-accountant-salary-and-career-path-in-uk',
      link: 'https://firstread.co.uk/accountant-salary-uk/',
      title: 'Chartered Accountant Salary and Career Path in UK',
      seoTitle: 'Accountant Salary UK',
      seoDescription: 'Salaries for UK accountants.',
      canonical: 'https://firstread.co.uk/accountant-salary-uk/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 2,
      wordCount: 900,
      hasYoastSchema: true,
      categories: [10], // Category: Finance/Business (same as CPA article)
      issues: []
    }
  ];

  const opportunities = findInternalLinkingOpportunities(mockArticles);
  const cpaOpportunity = opportunities.find(o => o.targetSlug.includes('cpa'));

  if (cpaOpportunity) {
    // Biography should NEVER be suggested for CPA/Finance article
    assert.ok(
      !cpaOpportunity.suggestedSources.some(s => s.includes('zoe-kravitz')),
      'Unrelated biography article must not be suggested for CPA finance topic'
    );
    // Relevant accounting article should be suggested if threshold met
    if (cpaOpportunity.suggestedSources.length > 0) {
      assert.ok(
        cpaOpportunity.suggestedSources.some(s => s.includes('accountant')),
        'Related accounting article should match topic'
      );
    }
  }
});

test('Homepage audit extracts live metadata without false-positive missing title or description', async () => {
  const hp = await auditHomepage();
  assert.equal(hp.url, FIRSTREAD_ORIGIN + '/');
  if (!hp.fetchError) {
    assert.ok(hp.title.length > 0, 'Homepage title should be present');
    assert.ok(!hp.issues.some(i => i.id === 'hp-title-missing'), 'Should not flag missing title');
    assert.ok(hp.metaDescription.length > 0, 'Homepage meta description should be present');
    assert.ok(!hp.issues.some(i => i.id === 'hp-desc-missing'), 'Should not flag missing description');
    assert.ok(hp.h1Count >= 1, 'Homepage should have at least 1 H1');
  } else {
    assert.ok(hp.issues.some(i => i.id === 'hp-fetch-failed'));
    assert.ok(!hp.issues.some(i => i.id === 'hp-title-missing'));
    assert.ok(!hp.issues.some(i => i.id === 'hp-desc-missing'));
  }
});

test('Internal linking engine specifically rejects CPA/Salesforce and Estate/Hailey Bieber mismatches', () => {
  const articles = [
    {
      id: 1319,
      slug: '3-questions-every-business-owner-should-ask-their-cpa',
      link: 'https://firstread.co.uk/3-questions-every-business-owner-should-ask-their-cpa/',
      title: '3 Questions Every Business Owner Should Ask Their Cpa',
      seoTitle: '3 Questions Every Business Owner Should Ask Their Cpa - Firstread',
      seoDescription: 'CPA guide.',
      canonical: 'https://firstread.co.uk/3-questions-every-business-owner-should-ask-their-cpa/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 0,
      wordCount: 800,
      hasYoastSchema: true,
      categories: [148], // Category: Business
      issues: []
    },
    {
      id: 9999,
      slug: 'nothing2hide-net-salesforce',
      link: 'https://firstread.co.uk/nothing2hide-net-salesforce/',
      title: 'Nothing2hide.net Salesforce Smart CRM Integration for Business',
      seoTitle: 'Nothing2hide.net Salesforce Smart CRM Integration for Business - Firstread',
      seoDescription: 'Salesforce CRM guide.',
      canonical: 'https://firstread.co.uk/nothing2hide-net-salesforce/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 2,
      wordCount: 850,
      hasYoastSchema: true,
      categories: [148], // Category: Business (Same category, but different topic)
      issues: []
    },
    {
      id: 1316,
      slug: 'how-cp-as-assist-with-estate-and-wealth-preservation',
      link: 'https://firstread.co.uk/how-cp-as-assist-with-estate-and-wealth-preservation/',
      title: 'How Cp As Assist With Estate And Wealth Preservation',
      seoTitle: 'How Cp As Assist With Estate And Wealth Preservation - Firstread',
      seoDescription: 'Estate wealth planning.',
      canonical: 'https://firstread.co.uk/how-cp-as-assist-with-estate-and-wealth-preservation/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 1,
      internalLinksCount: 0,
      wordCount: 900,
      hasYoastSchema: true,
      categories: [148], // Category: Business
      issues: []
    },
    {
      id: 1457,
      slug: 'hailey-bieber-net-worth-2026-income-wealth-breakdown',
      link: 'https://firstread.co.uk/hailey-bieber-net-worth-2026-income-wealth-breakdown/',
      title: 'Hailey Bieber Net Worth 2026: Income & Wealth Explained',
      seoTitle: 'Hailey Bieber Net Worth 2026: Income & Wealth Explained - Firstread',
      seoDescription: 'Hailey Bieber celebrity net worth.',
      canonical: 'https://firstread.co.uk/hailey-bieber-net-worth-2026-income-wealth-breakdown/',
      bodyH1Count: 0,
      h1Count: 0,
      h2Count: 2,
      h3Count: 0,
      missingAltImagesCount: 0,
      totalImagesCount: 2,
      internalLinksCount: 3,
      wordCount: 950,
      hasYoastSchema: true,
      categories: [5], // Category: Celebrity Net Worth (Disparate category)
      issues: []
    }
  ];

  const opportunities = findInternalLinkingOpportunities(articles);

  // 1. CPA article must NEVER be matched with Nothing2Hide / Salesforce
  const cpaOpp = opportunities.find(o => o.targetSlug === '3-questions-every-business-owner-should-ask-their-cpa');
  if (cpaOpp) {
    assert.ok(
      !cpaOpp.suggestedSources.includes('nothing2hide-net-salesforce'),
      'Salesforce CRM article must not be suggested for CPA financial advice article'
    );
  }

  // 2. Estate preservation article must NEVER be matched with Hailey Bieber celebrity net worth
  const estateOpp = opportunities.find(o => o.targetSlug === 'how-cp-as-assist-with-estate-and-wealth-preservation');
  if (estateOpp) {
    assert.ok(
      !estateOpp.suggestedSources.includes('hailey-bieber-net-worth-2026-income-wealth-breakdown'),
      'Hailey Bieber celebrity gossip must not be suggested for legal estate preservation article'
    );
  }
});

test('Title refinement validator strictly rejects dangling punctuation, incomplete phrases, and keyword loss', () => {
  // Test dangling punctuation rejection
  const danglingComma = validateRefinedTitle('Zoey Stark: WWE Career, - Firstread', 'Zoey Stark: WWE Career, Age, Injury');
  assert.equal(danglingComma.valid, false);
  assert.ok(danglingComma.reason?.includes('dangling punctuation'));

  const danglingHyphen = validateRefinedTitle('Tate McRae Tour - - Firstread', 'Tate McRae Tour 2026');
  assert.equal(danglingHyphen.valid, false);

  // Test incomplete phrase rejection
  const incompleteAdjective = validateRefinedTitle('Kitchen Upgrading Tips Mintpalment: Smart - Firstread', 'Kitchen Upgrading Tips Mintpalment: Smart Renovation Guide');
  assert.equal(incompleteAdjective.valid, false);
  assert.ok(incompleteAdjective.reason?.includes('incomplete dangling word'));

  const incompleteWord = validateRefinedTitle('Keyshia Cole: This Is My Story — A Powerful - Firstread', 'Keyshia Cole: This Is My Story — A Powerful Musical Biography');
  assert.equal(incompleteWord.valid, false);
  assert.ok(incompleteWord.reason?.includes('incomplete dangling word'));

  // Test natural, high-quality generation on real FirstRead titles
  const t1 = generateRefinedTitle('Simpler or More Simple: Which One Is Correct? Meaning, Grammar & Examples - Firstread');
  assert.equal(t1.valid, true);
  assert.equal(t1.title, 'Simpler or More Simple: Which One Is Correct? - Firstread');

  const t2 = generateRefinedTitle('Tate McRae Tour 2026 Happening? Latest Dates, Tickets & Updates - Firstread');
  assert.equal(t2.valid, true);
  assert.equal(t2.title, 'Tate McRae Tour 2026: Latest Dates & Tickets - Firstread');

  const t3 = generateRefinedTitle('Keyshia Cole: This Is My Story — A Powerful Musical Biography - Firstread');
  assert.equal(t3.valid, true);
  assert.equal(t3.title, 'Keyshia Cole: This Is My Story - Firstread');

  const t4 = generateRefinedTitle('Alec Baldwin Net Worth 2025–2026: Income, Assets & Career - Firstread');
  assert.equal(t4.valid, true);
  assert.equal(t4.title, 'Alec Baldwin Net Worth 2025–2026 - Firstread');

  const t5 = generateRefinedTitle('Hailey Bieber Net Worth 2026: Income & Wealth Explained - Firstread');
  assert.equal(t5.valid, true);
  assert.equal(t5.title, 'Hailey Bieber Net Worth 2026 - Firstread');

  const t6 = generateRefinedTitle('Jenna Ortega Plastic Surgery: Truth, Rumors, and Reality in 2026 - Firstread');
  assert.equal(t6.valid, true);
  assert.equal(t6.title, 'Jenna Ortega Plastic Surgery: Rumors & Reality - Firstread');

  const t7 = generateRefinedTitle('Sabrina Carpenter New Album Cover: Meaning, Design & Fan Reactions - Firstread');
  assert.equal(t7.valid, true);
  assert.equal(t7.title, 'Sabrina Carpenter New Album Cover - Firstread');

  const t8 = generateRefinedTitle('Aisling Franciosi: Career, Movies, TV Shows, and Personal Life - Firstread');
  assert.equal(t8.valid, true);
  assert.equal(t8.title, 'Aisling Franciosi: Movies, TV Shows & Career - Firstread');

  // Verify rejection of weak recommendation that removes essential editorial context
  const tWeak = generateRefinedTitle('Kitchen Upgrading Tips Mintpalment: Smart Renovation Guide - Firstread');
  assert.equal(tWeak.valid, false, 'Weak recommendation that drops essential editorial context should be rejected');
});

test('Security allowlist strictly enforces exact endpoints, blocks traversal, malformed URLs, and embedded credentials', () => {
  // 1. Permitted exact endpoints must succeed
  const permitted = [
    'https://firstread.co.uk/',
    'https://firstread.co.uk/wp-json/',
    'https://firstread.co.uk/wp-json/wp/v2/posts',
    'https://firstread.co.uk/wp-json/wp/v2/pages',
    'https://firstread.co.uk/wp-json/wp/v2/categories',
    'https://firstread.co.uk/wp-json/wp/v2/tags',
    'https://firstread.co.uk/robots.txt',
    'https://firstread.co.uk/sitemap_index.xml',
    'https://firstread.co.uk/post-sitemap.xml',
    'https://firstread.co.uk/sample-article-slug/'
  ];
  for (const url of permitted) {
    const valid = validateReadOnlyRequest(url, { method: 'GET' });
    assert.equal(valid.origin, FIRSTREAD_ORIGIN);
  }

  // 2. Traversal and malformed URLs must be rejected
  const malformed = [
    'https://firstread.co.uk/wp-json/wp/v2/posts/../../users',
    'https://firstread.co.uk/%2e%2e/wp-admin',
    'https://firstread.co.uk/wp-json//wp/v2/posts',
    'https://firstread.co.uk/wp-json/wp/v2/posts\\..',
    'https://firstread.co.uk/wp-json/wp/v2/posts%00'
  ];
  for (const url of malformed) {
    assert.throws(
      () => validateReadOnlyRequest(url, { method: 'GET' }),
      (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('traversal or malformed')
    );
  }

  // 3. Embedded credentials must be rejected
  assert.throws(
    () => validateReadOnlyRequest('https://admin:password@firstread.co.uk/wp-json/wp/v2/posts'),
    (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Embedded URL credentials')
  );

  // 4. Subdomains and external ports must be rejected
  assert.throws(
    () => validateReadOnlyRequest('https://api.firstread.co.uk/wp-json/wp/v2/posts'),
    (err: unknown) => err instanceof FirstReadSecurityError
  );
  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk:8443/wp-json/wp/v2/posts'),
    (err: unknown) => err instanceof FirstReadSecurityError
  );

  // 5. Disallowed REST endpoints must be blocked
  const disallowedPaths = [
    '/wp-json/wp/v2/',
    '/wp-json/wp/v2/users',
    '/wp-json/wp/v2/settings',
    '/wp-json/wp/v2/plugins',
    '/wp-json/wp/v2/themes',
    '/wp-json/wp/v2/comments',
    '/wp-json/oembed/1.0/embed',
    '/wp-admin/',
    '/wp-admin/admin-ajax.php',
    '/wp-login.php',
    '/xmlrpc.php'
  ];

  for (const path of disallowedPaths) {
    assert.throws(
      () => validateReadOnlyRequest(`https://firstread.co.uk${path}`, { method: 'GET' }),
      (err: unknown) => err instanceof FirstReadSecurityError,
      `Path "${path}" must be blocked by security policy`
    );
  }

  // 6. Mutating HTTP methods must be blocked
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.throws(
      () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', { method }),
      (err: unknown) => err instanceof FirstReadSecurityError && err.message.includes('Forbidden HTTP method')
    );
  }
});
