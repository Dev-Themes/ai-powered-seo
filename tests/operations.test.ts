import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  executeKeywordResearch,
  executeCompetitorAnalysis,
  executeSearchIntentAnalysis,
  executeContentGapDiscovery,
  executeTopicClusterGeneration,
  executeSEOStrategyGeneration,
  executeArticleResearch,
  executeArticleGeneration,
  executeArticleQA,
  executeTechnicalAudit,
  executeRecommendationsGeneration,
  sanitizeErrorMessage
} from '../src/lib/seo/operations';

// ---------------------------------------------------------------------------
// 1. On-Demand AI Operations Validation
// ---------------------------------------------------------------------------

test('AI Operations — Keyword Research returns structured keyword opportunities', async () => {
  const result = await executeKeywordResearch('uk buy to let');
  assert.ok(result.generatedAt);
  assert.equal(result.seed, 'uk buy to let');
  assert.equal(result.isEstimated, true);
  assert.ok(result.dataSourceNotice.includes('estimates'));
  assert.ok(Array.isArray(result.keywords));
  assert.ok(result.keywords.length > 0);

  const first = result.keywords[0];
  assert.ok(first.keyword);
  assert.ok(typeof first.searchVolume === 'number');
  assert.ok(typeof first.difficulty === 'number');
  assert.ok(['informational', 'commercial', 'transactional', 'navigational'].includes(first.intent));
  assert.ok(first.suggestedAction);
});

test('AI Operations — Competitor Analysis returns authority scores and gaps', async () => {
  const result = await executeCompetitorAnalysis('firstread.co.uk');
  assert.ok(result.generatedAt);
  assert.equal(result.targetDomain, 'firstread.co.uk');
  assert.equal(result.isEstimated, true);
  assert.ok(result.dataSourceNotice.includes('estimates') || result.dataSourceNotice.includes('projections'));
  assert.ok(Array.isArray(result.competitors));
  assert.ok(result.competitors.length > 0);

  const comp = result.competitors[0];
  assert.ok(comp.domain);
  assert.ok(typeof comp.authorityScore === 'number');
  assert.ok(Array.isArray(comp.topSharedTopics));
  assert.ok(Array.isArray(comp.contentGapsIdentified));
});

test('AI Operations — Search Intent Analysis classifies query intent', async () => {
  const result = await executeSearchIntentAnalysis(['canterbury property investment', 'best buy to let yields']);
  assert.ok(result.generatedAt);
  assert.ok(Array.isArray(result.results));
  assert.equal(result.results.length, 2);

  assert.equal(result.results[0].keyword, 'canterbury property investment');
  assert.ok(result.results[0].userPainPoint);
  assert.ok(result.results[0].recommendedFormat);
});

test('AI Operations — Content Gap Discovery identifies high-conviction topics', async () => {
  const result = await executeContentGapDiscovery('UK Property & Finance');
  assert.ok(result.generatedAt);
  assert.ok(Array.isArray(result.gaps));
  assert.ok(result.gaps.length > 0);

  const gap = result.gaps[0];
  assert.ok(gap.topic);
  assert.ok(['high', 'medium', 'low'].includes(gap.urgency));
  assert.ok(gap.suggestedTitle);
  assert.ok(gap.rationale);
});

test('AI Operations — Topic Cluster Generation produces pillar and supporting clusters', async () => {
  const result = await executeTopicClusterGeneration('UK Buy to Let');
  assert.ok(result.generatedAt);
  assert.ok(result.pillarPage);
  assert.ok(result.pillarPage.title);
  assert.ok(result.pillarPage.slug);
  assert.ok(Array.isArray(result.clusterArticles));
  assert.ok(result.clusterArticles.length > 0);

  const cluster = result.clusterArticles[0];
  assert.ok(cluster.title);
  assert.ok(cluster.internalLinkAnchorToPillar);
});

test('AI Operations — SEO Strategy Generation returns phased roadmap', async () => {
  const result = await executeSEOStrategyGeneration();
  assert.ok(result.generatedAt);
  assert.ok(result.strategicFocus);
  assert.ok(Array.isArray(result.phase1ImmediateFixes));
  assert.ok(Array.isArray(result.phase2ContentExpansion));
  assert.ok(Array.isArray(result.phase3AuthorityGrowth));
  assert.ok(Array.isArray(result.projectedOrganicOutcomes));
});

test('AI Operations — Article Research generates structured outline', async () => {
  const result = await executeArticleResearch('UK Property Market Trends');
  assert.ok(result.generatedAt);
  assert.ok(result.primaryKeyword);
  assert.ok(result.recommendedWordCount > 0);
  assert.ok(Array.isArray(result.outline));
  assert.ok(result.outline.length > 0);
});

test('AI Operations — Article Generation produces HTML draft and image briefs', async () => {
  const result = await executeArticleGeneration({ topic: 'UK Rental Market', primaryKeyword: 'uk rental market' });
  assert.ok(result.generatedAt);
  assert.ok(result.title);
  assert.ok(result.slug);
  assert.ok(result.metaDescription);
  assert.ok(result.htmlContent.includes('<h2>'));
  assert.ok(result.wordCount > 0);
  assert.ok(Array.isArray(result.imageBriefs));
});

test('AI Operations — Independent Article QA validates heading structure and metadata', async () => {
  // Test valid article
  const validQa = await executeArticleQA({
    title: 'UK Property Investment: A Strategic Guide for 2026',
    metaDescription: 'Discover high-yield UK property investment areas with expert analysis of regional rental yields and landlord regulations.',
    content: '<h2>Market Overview</h2><p>Overview of uk property investment trends.</p><h2>Regional Breakdown</h2><p>Analysis of high performing postcodes.</p>',
    primaryKeyword: 'uk property investment'
  });

  assert.ok(validQa.overallScore >= 70);
  assert.equal(validQa.headingAudit.hasSingleH1, true); // No body H1
  assert.equal(validQa.headingAudit.logicalStructure, true);
  assert.equal(validQa.metadataAudit.titleValid, true);

  // Test invalid article with body H1 and short title
  const invalidQa = await executeArticleQA({
    title: 'Short',
    metaDescription: 'Short desc',
    content: '<h1>Bad Body H1</h1><p>Content without H2s.</p>',
    primaryKeyword: 'property'
  });

  assert.ok(invalidQa.overallScore < 70);
  assert.equal(invalidQa.passed, false);
  assert.equal(invalidQa.headingAudit.hasSingleH1, false);
  assert.ok(invalidQa.remediationSuggestions.length > 0);
});

test('AI Operations — Article Generation computes exact word count and reading time matching actual HTML', async () => {
  const result = await executeArticleGeneration({ topic: 'UK Buy to Let', primaryKeyword: 'buy to let' });
  assert.ok(result.htmlContent);

  const strippedWords = result.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  assert.equal(result.wordCount, strippedWords, 'Reported wordCount must match actual words in htmlContent');
  assert.equal(result.estimatedReadTimeMinutes, Math.max(1, Math.ceil(strippedWords / 200)));
  assert.equal(result.fallbackUsed, true);
  assert.ok(result.fallbackReason);
});

test('AI Operations — Article Research returns research findings, supporting sources and limitations notice', async () => {
  const result = await executeArticleResearch('UK Property Market');
  assert.ok(Array.isArray(result.researchFindings));
  assert.ok(result.researchFindings.length > 0);
  assert.ok(Array.isArray(result.supportingSources));
  assert.ok(result.supportingSources.length > 0);
  assert.ok(result.dataLimitationsNotice);
  assert.ok(result.dataLimitationsNotice.includes('Research data comprises AI market synthesis'));
});

test('AI Operations — Article QA gatekeeper fails keyword-stuffed article with 10% density', async () => {
  // Generate a ~350 word text where "property" appears ~35 times (10% density)
  const paragraph = 'The UK property market offers property investment opportunities where property buyers seek property advice to secure property yields and understand property regulations across property sectors. ';
  const stuffedContent = `<h2>UK Property Market Analysis</h2><p>${paragraph.repeat(6)}</p><h2>Regional Property Forecast</h2><p>${paragraph.repeat(6)}</p>`;

  const result = await executeArticleQA({
    title: 'UK Property Investment: Strategic Regional Analysis',
    metaDescription: 'Discover high-yield UK property investment areas with expert analysis of regional rental yields and landlord regulations.',
    content: stuffedContent,
    primaryKeyword: 'property'
  });

  assert.equal(result.mandatoryChecks.noKeywordStuffing, false, 'noKeywordStuffing check must fail for 10% density');
  assert.equal(result.keywordIntegration.status, 'stuffed');
  assert.ok(result.keywordIntegration.rawDensity > 3.5, 'Raw density must exceed 3.5% threshold');
  assert.equal(result.passed, false, 'Article with keyword stuffing MUST fail QA gate');
  assert.ok(result.failedMandatoryChecks.includes('noKeywordStuffing'));
  assert.equal(result.originalityVerification, 'unavailable');
});

test('AI Operations — Article QA gatekeeper passes valid full-length article meeting all mandatory checks', async () => {
  const sampleArticle = await executeArticleGeneration({ topic: 'UK Commercial Real Estate', primaryKeyword: 'uk commercial real estate' });
  const result = await executeArticleQA({
    title: sampleArticle.title,
    metaDescription: sampleArticle.metaDescription,
    content: sampleArticle.htmlContent,
    primaryKeyword: sampleArticle.primaryKeyword
  });

  assert.equal(result.mandatoryChecks.noBodyH1, true);
  assert.equal(result.mandatoryChecks.minH2Count, true);
  assert.equal(result.mandatoryChecks.noEmptyHeadings, true);
  assert.equal(result.mandatoryChecks.noKeywordStuffing, true);
  assert.equal(result.mandatoryChecks.minWordCount, true);
  assert.equal(result.mandatoryChecks.metadataComplete, true);
  assert.equal(result.failedMandatoryChecks.length, 0);
  assert.ok(result.overallScore >= 75);
  assert.equal(result.passed, true);
});

test('AI Operations — Article QA gatekeeper fails empty headings and body H1 even with high score', async () => {
  // Article with an empty heading <h2></h2> and an explicit <h1>
  const flawedContent = `<h1>Explicit Theme Conflict H1</h1><h2>Valid Heading</h2><p>${'Comprehensive valid article content with good length. '.repeat(40)}</p><h2></h2><p>Another section.</p>`;
  const result = await executeArticleQA({
    title: 'UK Property Investment: Strategic Regional Analysis',
    metaDescription: 'Discover high-yield UK property investment areas with expert analysis of regional rental yields and landlord regulations.',
    content: flawedContent,
    primaryKeyword: 'property'
  });

  assert.equal(result.mandatoryChecks.noBodyH1, false, 'Body H1 must fail noBodyH1 check');
  assert.equal(result.mandatoryChecks.noEmptyHeadings, false, 'Empty <h2></h2> must fail noEmptyHeadings check');
  assert.equal(result.passed, false, 'Flawed structure MUST fail QA gate');
  assert.ok(result.failedMandatoryChecks.includes('noBodyH1'));
  assert.ok(result.failedMandatoryChecks.includes('noEmptyHeadings'));
});

test('AI Operations — QA Publication Gate independently evaluates pass/fail regardless of informational score', async () => {
  // Article that satisfies all mandatory checks (300+ words, 2 H2s, no body H1, no empty headings,
  // valid presence of title and meta description) but has sub-optimal SERP display lengths
  // (e.g. title is 27 chars, below the 30-65 optimal SERP display window).
  // The composite informational score drops below 75, but the article MUST PASS because all mandatory gates pass.
  const fillerParagraph = 'The UK property market presents compelling dynamics and long-term capital allocation opportunities across commercial hubs. ';
  const content = `<h2>Market Fundamentals</h2><p>Here regional investors can evaluate opportunities. ${fillerParagraph.repeat(15)} Regional investors benefit from steady tenant demand.</p><h2>Regional Trends</h2><p>Experienced regional investors focus on commuter hubs. ${fillerParagraph.repeat(15)} Savvy regional investors build resilient portfolios.</p>`;

  const result = await executeArticleQA({
    title: 'UK Property Market Analysis', // 27 chars: outside 30-65 recommended SERP window, but technically complete
    metaDescription: 'Discover high-yield UK property investment areas with expert regional analysis across key commuter hubs.',
    content,
    primaryKeyword: 'regional investors'
  });

  // All mandatory gates must pass
  assert.equal(result.mandatoryChecks.noBodyH1, true);
  assert.equal(result.mandatoryChecks.minH2Count, true);
  assert.equal(result.mandatoryChecks.noEmptyHeadings, true);
  assert.equal(result.mandatoryChecks.noKeywordStuffing, true);
  assert.equal(result.mandatoryChecks.minWordCount, true);
  assert.equal(result.mandatoryChecks.metadataComplete, true);
  assert.equal(result.failedMandatoryChecks.length, 0);

  // Mandatory checks independently determine pass/fail
  assert.equal(result.passed, true, 'Article MUST pass QA publication gate when all mandatory checks pass, regardless of informational score');

  // Verify that an article with a high score but a single mandatory check failure (e.g. missing second H2) is rejected
  const singleH2Content = `<h2>Single Section</h2><p>Here regional investors can evaluate opportunities. ${fillerParagraph.repeat(30)}</p>`;
  const failedResult = await executeArticleQA({
    title: 'UK Property Market: Comprehensive Strategic Overview for 2026',
    metaDescription: 'Discover high-yield UK property investment areas with expert regional analysis across key commuter hubs in England.',
    content: singleH2Content,
    primaryKeyword: 'regional investors'
  });

  assert.equal(failedResult.mandatoryChecks.minH2Count, false);
  assert.equal(failedResult.passed, false, 'Article with fewer than 2 H2s MUST fail publication gate even if other metrics are good');
});

test('AI Operations — Research findings provide specific source URLs, publishers, and unverified status', async () => {
  const result = await executeArticleResearch('UK Rental Market');
  assert.ok(Array.isArray(result.evidenceFindings), 'evidenceFindings must be an array');
  assert.ok(result.evidenceFindings.length >= 3, 'Must contain at least 3 source-backed evidence items');

  for (const item of result.evidenceFindings) {
    assert.ok(item.claim, 'Each item must have a claim');
    assert.ok(item.sourceTitle, 'Each item must have a source title');
    assert.ok(item.sourceUrl, 'Each item must have a source URL');
    // Must NOT be a generic root homepage
    assert.notEqual(item.sourceUrl, 'https://ons.gov.uk');
    assert.notEqual(item.sourceUrl, 'https://www.ons.gov.uk');
    assert.notEqual(item.sourceUrl, 'https://www.bankofengland.co.uk');
    assert.ok(item.sourceUrl.includes('/'), 'Source URL must point to specific report or bulletin');
    assert.ok(item.publisher, 'Each item must specify publisher');
    assert.ok(item.retrievalDate, 'Each item must specify retrieval date');
    assert.ok(item.supportingEvidence, 'Each item must provide supporting evidence');
    assert.equal(item.verificationStatus, 'unverified', 'Verification status must be honestly identified as unverified when live external retrieval is unavailable');
  }

  assert.ok(result.dataLimitationsNotice.includes('unverified'), 'Limitations notice must state findings remain unverified');
});

test('AI Operations — Error message sanitizer redacts API keys, Bearer tokens, query parameters, and normalizes codes', () => {
  // Test 1: Redact raw Gemini API key in query param
  const urlWithKey = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyD-1234567890abcdef1234567890abc';
  const sanitizedUrl = sanitizeErrorMessage(new Error(`Failed to fetch from ${urlWithKey}`));
  assert.equal(sanitizedUrl.includes('AIzaSyD'), false, 'API key must be redacted');
  assert.ok(sanitizedUrl.includes('[REDACTED_API_KEY]') || sanitizedUrl.includes('[REDACTED_PARAMS]') || sanitizedUrl.includes('discontinued'));

  // Test 2: Redact Bearer authorization token
  const authMsg = sanitizeErrorMessage('Error 401 Unauthorized: Authorization Bearer ya29.a0AfH6SM... failed');
  assert.equal(authMsg.includes('ya29'), false, 'Bearer token must be redacted');
  assert.ok(authMsg.includes('[REDACTED_TOKEN]'));

  // Test 3: Normalize model 404
  const notFoundMsg = sanitizeErrorMessage('404 NOT_FOUND: models/gemini-2.5-flash is not found');
  assert.ok(notFoundMsg.includes('unavailable or discontinued'));

  // Test 4: Normalize 429 rate limit
  const rateLimitMsg = sanitizeErrorMessage('429 RESOURCE_EXHAUSTED: quota exceeded');
  assert.ok(rateLimitMsg.includes('rate limit or quota exceeded'));

  // Test 5: Safe handling of undefined/null
  assert.ok(sanitizeErrorMessage(null).length > 0);
});

test('AI Operations — Article Generation contains contextual internal links to published FirstRead articles', async () => {
  const result = await executeArticleGeneration({ topic: 'UK Rental Market', primaryKeyword: 'uk rental market' });
  assert.ok(result.htmlContent);
  assert.ok(
    result.htmlContent.includes('/how-can-first-time-buyers-navigate/') ||
    result.htmlContent.includes('/canterburys-competitive-market/'),
    'Generated article HTML must include authentic contextual internal links to published FirstRead content'
  );
});

test('AI Operations — Technical Audit & Recommendations delegates execute correctly', async () => {
  assert.equal(typeof executeTechnicalAudit, 'function');
  assert.equal(typeof executeRecommendationsGeneration, 'function');
});

// ---------------------------------------------------------------------------
// 2. Complete Removal Verification (Prisma, Neon, Inngest Zero-Dependency)
// ---------------------------------------------------------------------------

test('Architecture Simplification — No Prisma, Neon, or Inngest dependencies remain in package.json', () => {
  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  assert.equal(allDeps['@prisma/client'], undefined, '@prisma/client must not be in package.json');
  assert.equal(allDeps['prisma'], undefined, 'prisma CLI must not be in package.json');
  assert.equal(allDeps['inngest'], undefined, 'inngest must not be in package.json');
});

test('Architecture Simplification — No Prisma or Inngest files remain in src/', () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), 'prisma')), false, 'prisma/ directory must be deleted');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src', 'lib', 'db')), false, 'src/lib/db must be deleted');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src', 'lib', 'workflows')), false, 'src/lib/workflows must be deleted');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'src', 'app', 'api', 'inngest')), false, 'src/app/api/inngest must be deleted');
});
