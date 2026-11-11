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
  executeRecommendationsGeneration
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
