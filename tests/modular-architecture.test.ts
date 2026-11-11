import test from 'node:test';
import assert from 'node:assert/strict';

// 1. WordPress module
import { validateReadOnlyRequest, FirstReadSecurityError, FIRSTREAD_ORIGIN } from '../src/lib/wordpress/security';
import { fetchSiteInfo } from '../src/lib/wordpress/client';

// 2. SEO module
import { detectDuplicates } from '../src/lib/seo/audit';
import { extractMeaningfulTokens, LINKING_STOP_WORDS } from '../src/lib/seo/linking';
import type { ArticleSEOSummary } from '../src/lib/seo/types';

// 3. Content module
import { validateRefinedTitle } from '../src/lib/content/title';

// 4. Integrations module
import { getGoogleIntegrationReadiness } from '../src/lib/integrations/google';

test('Modular Architecture — WordPress module enforces strict read-only boundary', () => {
  assert.equal(typeof validateReadOnlyRequest, 'function');
  assert.equal(typeof fetchSiteInfo, 'function');

  assert.throws(
    () => validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', { method: 'POST' }),
    (err: unknown) => err instanceof FirstReadSecurityError
  );

  const valid = validateReadOnlyRequest('https://firstread.co.uk/wp-json/wp/v2/posts', { method: 'GET' });
  assert.equal(valid.origin, FIRSTREAD_ORIGIN);
});

test('Modular Architecture — SEO module correctly extracts meaningful tokens and filters stop words', () => {
  assert.ok(LINKING_STOP_WORDS.has('the'));
  assert.ok(LINKING_STOP_WORDS.has('about'));

  const tokens = extractMeaningfulTokens('the ultimate guide to canterbury property investments 2026');
  assert.ok(tokens.includes('canterbury'));
  assert.ok(tokens.includes('property'));
  assert.ok(tokens.includes('investments'));
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('guide'));
  assert.ok(!tokens.includes('2026'));
});

test('Modular Architecture — SEO module detects duplicate metadata to prevent cannibalisation', () => {
  const sampleArticles: ArticleSEOSummary[] = [
    { id: 10, slug: 'post-a', link: 'https://firstread.co.uk/post-a', title: 'A', seoTitle: 'Shared SEO Title', seoDescription: 'Unique 1', canonical: '', h1Count: 0, h2Count: 1, h3Count: 0, missingAltImagesCount: 0, totalImagesCount: 1, internalLinksCount: 1, wordCount: 100, hasYoastSchema: true, issues: [] },
    { id: 20, slug: 'post-b', link: 'https://firstread.co.uk/post-b', title: 'B', seoTitle: 'Shared SEO Title', seoDescription: 'Unique 2', canonical: '', h1Count: 0, h2Count: 1, h3Count: 0, missingAltImagesCount: 0, totalImagesCount: 1, internalLinksCount: 1, wordCount: 100, hasYoastSchema: true, issues: [] }
  ];

  const duplicates = detectDuplicates(sampleArticles);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].type, 'title');
  assert.equal(duplicates[0].occurrences.length, 2);
});

test('Modular Architecture — Content module validates headline SERP character bounds', () => {
  const valid = validateRefinedTitle('Grammar Guide: Who or Whom Explained - Firstread', 'Grammar Guide: Who or Whom Explained - Firstread');
  assert.equal(valid.valid, true);

  const invalidDangling = validateRefinedTitle('The Complete Editorial Guide To - Firstread', 'The Complete Editorial Guide To Life');
  assert.equal(invalidDangling.valid, false);
  assert.ok(invalidDangling.reason?.includes('dangling'));

  const invalidShort = validateRefinedTitle('Short - Firstread', 'Short');
  assert.equal(invalidShort.valid, false);
});

test('Modular Architecture — Integrations module reports Google integration readiness contract', () => {
  const readiness = getGoogleIntegrationReadiness();
  assert.ok('gscProperty' in readiness);
  assert.ok('ga4PropertyId' in readiness);
  assert.ok('hasServiceAccount' in readiness);
  assert.ok('readyForIngestion' in readiness);
  assert.ok(Array.isArray(readiness.requiredScopes));
  assert.equal(readiness.requiredScopes.length, 2);
});
