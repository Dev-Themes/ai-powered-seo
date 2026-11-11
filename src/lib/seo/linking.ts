import type { ArticleSEOSummary } from './types';

export const LINKING_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'age', 'all', 'am', 'an', 'and', 'any', 'are',
  'aren', 'arent', 'article', 'as', 'assist', 'at', 'background', 'bad', 'be', 'because', 'been',
  'before', 'being', 'below', 'best', 'between', 'big', 'bio', 'biography', 'birthday', 'born',
  'both', 'breakdown', 'business', 'but', 'by', 'can', 'cannot', 'capitalized', 'career', 'company',
  'could', 'dates', 'daughter', 'day', 'dead', 'death', 'definition', 'did', 'digital', 'do',
  'does', 'doing', 'down', 'due', 'during', 'each', 'earnings', 'education', 'end', 'estate',
  'even', 'every', 'everything', 'explained', 'facts', 'family', 'far', 'few', 'fit', 'for',
  'from', 'further', 'get', 'good', 'got', 'guide', 'had', 'has', 'have', 'having', 'he',
  'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'husband', 'i', 'if',
  'in', 'income', 'integration', 'into', 'is', 'it', 'its', 'itself', 'just', 'know', 'latest',
  'let', 'life', 'lifestyle', 'lot', 'low', 'man', 'management', 'many', 'may', 'me', 'meaning',
  'men', 'met', 'money', 'more', 'most', 'much', 'my', 'myself', 'need', 'net', 'news', 'new',
  'no', 'non', 'nor', 'not', 'now', 'of', 'off', 'office', 'old', 'on', 'once', 'one', 'online',
  'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'overview', 'over', 'own',
  'parents', 'per', 'prefer', 'preservation', 'put', 'questions', 'ran', 'reasons', 'reliable',
  'review', 'reviews', 'run', 'salary', 'same', 'say', 'see', 'services', 'set', 'she', 'should',
  'smart', 'so', 'software', 'solutions', 'some', 'son', 'such', 'supplier', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'things',
  'this', 'those', 'through', 'tickets', 'tips', 'to', 'today', 'too', 'tools', 'top', 'tour',
  'try', 'two', 'under', 'until', 'up', 'update', 'updates', 'use', 'very', 'via', 'was',
  'way', 'we', 'wealth', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'wife', 'with', 'won', 'workspaces', 'worth', 'would', 'yes', 'yet', 'you', 'your',
  'yours', 'yourself', 'yourselves', '2024', '2025', '2026'
]);

export function extractMeaningfulTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length >= 3 && !LINKING_STOP_WORDS.has(w));
}

function countWordMatches(targetTokens: string[], candidateText: string): number {
  const lower = candidateText.toLowerCase();
  let count = 0;
  for (const token of targetTokens) {
    const regex = new RegExp(`\\b${token}\\b`, 'i');
    if (regex.test(lower)) {
      count++;
    }
  }
  return count;
}

/**
 * Identifies genuine internal linking opportunities between articles using strict stop-word filtering,
 * whole-word matching, category alignment, and conservative relevance thresholds.
 * Returns an empty array if no genuinely relevant sources meet the quality threshold.
 */
export function findInternalLinkingOpportunities(
  articles: ArticleSEOSummary[]
): { targetSlug: string; topic: string; suggestedSources: string[]; relevanceScore?: number }[] {
  const opportunities: { targetSlug: string; topic: string; suggestedSources: string[]; relevanceScore?: number }[] = [];

  // Articles with 0 internal links are primary targets
  const underlinked = articles.filter(a => a.internalLinksCount === 0).slice(0, 10);

  for (const target of underlinked) {
    const tokens = extractMeaningfulTokens(`${target.slug} ${target.title}`);
    if (!tokens.length) continue;

    const scoredCandidates: { slug: string; score: number }[] = [];

    for (const candidate of articles) {
      if (candidate.slug === target.slug) continue;

      let score = 0;

      // 1. Strict Category Alignment
      const hasCategories = (target.categories && target.categories.length > 0) &&
                            (candidate.categories && candidate.categories.length > 0);
      const sharesCategory = hasCategories && target.categories!.some(c => candidate.categories!.includes(c));

      if (sharesCategory) {
        score += 4;
      } else if (hasCategories) {
        score -= 10;
      }

      // 2. Exact whole-word boundary keyword matching on specific entity tokens
      const titleMatches = countWordMatches(tokens, candidate.title);
      const slugMatches = countWordMatches(tokens, candidate.slug);
      const totalMatches = titleMatches + slugMatches;

      if (totalMatches > 0) {
        score += totalMatches * 4;
      }

      // 3. Conservative relevance threshold
      if (score >= 10 && totalMatches >= 2 && sharesCategory) {
        scoredCandidates.push({ slug: candidate.slug, score });
      }
    }

    scoredCandidates.sort((a, b) => b.score - a.score);
    const topSources = scoredCandidates.slice(0, 3).map(c => c.slug);

    if (topSources.length > 0) {
      opportunities.push({
        targetSlug: target.slug,
        topic: tokens.slice(0, 3).join(' '),
        suggestedSources: topSources,
        relevanceScore: scoredCandidates[0].score
      });
    }
  }

  return opportunities;
}
