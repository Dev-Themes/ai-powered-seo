import { GoogleGenAI } from '@google/genai';
import type { FirstReadAuditReport } from '../seo/types';
import type {
  FirstReadAIRecommendation,
  FirstReadRecommendationsReport
} from './types';
import { generateRefinedTitle, validateRefinedTitle } from './title';
import { sanitizeErrorMessage } from '../seo/operations';

/**
 * Deterministic fallback generator when Gemini API is unavailable or unconfigured.
 * Transforms verified audit findings into structured, prioritized proposals.
 */
export function generateHeuristicRecommendations(audit: FirstReadAuditReport): FirstReadAIRecommendation[] {
  const recs: FirstReadAIRecommendation[] = [];

  // 1. Technical / Protocol issues
  const siteUrlMismatch = audit.technical.protocolIssues.find(p => p.type === 'site_url_mismatch');
  if (siteUrlMismatch) {
    recs.push({
      id: 'rec-proto-site-url',
      priority: 'high',
      confidence: 'high',
      category: 'technical',
      targetUrl: audit.origin,
      slug: 'site-configuration',
      issue: 'WordPress Site URL Inconsistency (HTTP vs HTTPS)',
      reasoning: 'Inconsistent protocol declarations between HTTP and HTTPS can confuse search engine crawlers, trigger unnecessary 301 redirects, and cause canonical mixed-content issues.',
      currentValue: {
        structure: siteUrlMismatch.details
      },
      recommendedValue: {
        structure: 'Ensure WordPress General Settings (WordPress Address URL and Site Address URL) both use https://firstread.co.uk.'
      },
      evidence: siteUrlMismatch.details,
      limitations: 'Changes to WordPress site settings must be executed by an authorized WordPress administrator.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  const sitemapIssues = audit.technical.protocolIssues.filter(p => p.type === 'insecure_sitemap');
  if (sitemapIssues.length > 0) {
    const details = sitemapIssues.map(s => s.details).join('; ');
    recs.push({
      id: 'rec-proto-sitemaps',
      priority: 'high',
      confidence: 'high',
      category: 'technical',
      targetUrl: audit.origin,
      slug: 'site-configuration',
      issue: 'Insecure HTTP Sitemap Directives in robots.txt / Index',
      reasoning: `${sitemapIssues.length} sitemap reference(s) declare HTTP URLs instead of HTTPS. All XML sitemaps should be served and declared under HTTPS.`,
      currentValue: {
        structure: details
      },
      recommendedValue: {
        structure: 'Update Yoast SEO and robots.txt to ensure the sitemap index and all sub-sitemaps use https:// URLs.'
      },
      evidence: details,
      limitations: 'Requires regenerating Yoast sitemaps and saving robots.txt.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  // 2. Homepage Issues
  for (const hpIssue of audit.homepage.issues) {
    if (hpIssue.id === 'hp-fetch-failed') {
      recs.push({
        id: 'rec-hp-fetch-failed',
        priority: 'high',
        confidence: 'high',
        category: 'technical',
        targetUrl: audit.homepage.url,
        slug: 'home',
        issue: 'Homepage Inspection Connectivity Issue',
        reasoning: hpIssue.description,
        currentValue: {
          structure: hpIssue.description
        },
        recommendedValue: {
          structure: 'Verify that the server permits read-only HEAD and GET requests for the homepage root path.'
        },
        evidence: hpIssue.description,
        limitations: 'Requires network or hosting access.',
        source: 'deterministic_audit',
        requiresApproval: true,
        approved: false
      });
      continue;
    }

    recs.push({
      id: `rec-hp-${hpIssue.id}`,
      priority: hpIssue.severity === 'critical' ? 'high' : 'medium',
      confidence: 'high',
      category: hpIssue.category as 'metadata' | 'content_structure' | 'internal_linking' | 'technical',
      targetUrl: audit.homepage.url,
      slug: 'home',
      issue: hpIssue.title,
      reasoning: hpIssue.description,
      currentValue: {
        title: hpIssue.currentValue || (hpIssue.category === 'metadata' ? audit.homepage.title : undefined),
        description: hpIssue.category === 'metadata' ? audit.homepage.metaDescription : undefined,
        structure: hpIssue.category === 'headings' ? `Current H1 count: ${audit.homepage.h1Count}` : undefined
      },
      recommendedValue: {
        title: hpIssue.id === 'hp-title-missing' || hpIssue.id === 'hp-title-length'
          ? (audit.homepage.title && audit.homepage.title.length > 60
              ? 'Firstread | Contemporary News, Culture & Linguistic Guides'
              : audit.homepage.title || 'Firstread | Daily News & Insightful Commentary')
          : undefined,
        description: hpIssue.id === 'hp-desc-missing' || hpIssue.id === 'hp-desc-short'
          ? (hpIssue.recommendation || 'Explore FirstRead for in-depth analysis on language, entertainment, culture, and lifestyle.')
          : undefined,
        structure: hpIssue.category === 'headings'
          ? 'Add a single primary <h1> heading to the homepage layout.'
          : undefined
      },
      evidence: `Rendered HTML inspection of homepage: ${hpIssue.description}`,
      limitations: 'Homepage adjustments must be updated in WordPress Yoast SEO settings or theme template.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  // 3. Duplicate Metadata (Cannibalization Risk)
  for (const dup of audit.duplicates) {
    recs.push({
      id: `rec-dup-${dup.type}-${recs.length + 1}`,
      priority: 'high',
      confidence: 'high',
      category: 'metadata',
      targetUrl: dup.occurrences[0]?.link || audit.origin,
      slug: dup.occurrences[0]?.slug || 'duplicates',
      issue: `Duplicate ${dup.type === 'title' ? 'Title Tag' : 'Meta Description'} Across ${dup.occurrences.length} Articles`,
      reasoning: `Multiple published articles share the exact same ${dup.type}: "${dup.value}". This creates keyword self-cannibalization in Google search results.`,
      currentValue: {
        title: dup.type === 'title' ? dup.value : undefined,
        description: dup.type === 'description' ? dup.value : undefined
      },
      recommendedValue: {
        title: dup.type === 'title' ? 'Differentiate title tags to reflect unique article angles.' : undefined,
        description: dup.type === 'description' ? 'Write unique meta descriptions tailored to each individual post.' : undefined
      },
      evidence: `Shared across articles: ${dup.occurrences.map(o => '/' + o.slug + '/').join(', ')}`,
      limitations: 'Each post must be revised individually in WordPress.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  // 4. Missing Meta Descriptions
  const missingDescArticles = audit.articles.filter(a => !a.seoDescription).slice(0, 10);
  for (const a of missingDescArticles) {
    const topic = a.title.replace(/[:\-–—].*$/, '').trim();
    recs.push({
      id: `rec-desc-${a.id}`,
      priority: 'high',
      confidence: 'high',
      category: 'metadata',
      targetUrl: a.link,
      slug: a.slug,
      issue: 'Missing Meta Description in Yoast SEO',
      reasoning: 'Without a tailored meta description, search engines extract arbitrary sentence fragments for the SERP snippet, reducing searcher clarity and click-through rates.',
      currentValue: {
        description: '(None provided - relying on search engine auto-snippet)'
      },
      recommendedValue: {
        description: `Explore our comprehensive guide to ${topic}. Understand definitions, grammar rules, examples, and practical tips in clear, plain English.`
      },
      evidence: `Article "${a.title}" has ${a.wordCount} words and established heading structure, but no explicit meta description in yoast_head_json.`,
      limitations: 'Search engines may occasionally display page text even when a meta description is supplied, but providing a descriptive snippet remains best practice.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  // 5. Overly Long Titles (Truncation Risk)
  const longTitleArticles = audit.articles.filter(a => a.seoTitle.length > 65);
  for (const a of longTitleArticles) {
    const refined = generateRefinedTitle(a.seoTitle);
    if (!refined.valid) continue;

    recs.push({
      id: `rec-title-${a.id}`,
      priority: 'medium',
      confidence: 'high',
      category: 'metadata',
      targetUrl: a.link,
      slug: a.slug,
      issue: 'SEO Title Exceeds SERP Pixel Display Threshold',
      reasoning: `The current title is ${a.seoTitle.length} characters long. In desktop and mobile SERPs, titles longer than ~60 characters or ~600px are truncated with an ellipsis (...).`,
      currentValue: {
        title: a.seoTitle
      },
      recommendedValue: {
        title: refined.title
      },
      evidence: `Current length: ${a.seoTitle.length} characters. Refined candidate: ${refined.title.length} characters (natural, complete clause preserving primary entity).`,
      limitations: 'Length guidelines are advisory constraints for snippet visibility, not algorithmic ranking penalties.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
    if (recs.filter(r => r.category === 'metadata').length >= 10) break;
  }

  // 6. Missing Alt Text on Images
  const missingAltArticles = audit.articles.filter(a => (a.missingAltCount ?? a.missingAltImagesCount) > 0).slice(0, 8);
  for (const a of missingAltArticles) {
    const missing = a.missingAltCount ?? a.missingAltImagesCount;
    const empty = a.emptyAltCount ?? 0;
    recs.push({
      id: `rec-alt-${a.id}`,
      priority: 'medium',
      confidence: 'high',
      category: 'content_structure',
      targetUrl: a.link,
      slug: a.slug,
      issue: 'Editorial Images Missing Descriptive Alt Attributes',
      reasoning: 'Alt text assists screen readers for accessibility and allows Google Images to index and understand visual media.',
      currentValue: {
        structure: `${missing} of ${a.totalImagesCount} image(s) completely lack alt attributes${empty > 0 ? ` (${empty} specify decorative empty alt="")` : ''}.`
      },
      recommendedValue: {
        structure: 'Review the media in WordPress Editor and add concise, context-specific alt descriptions describing the illustration or diagram.'
      },
      evidence: `Detected ${missing} <img> elements missing alt attributes in post content.`,
      limitations: 'Alt text should accurately describe the image, not be stuffed with unnatural keywords.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  // 7. Internal Linking Opportunities
  const seenPairKeys = new Set<string>();

  for (const opp of (audit.internalLinkingOpportunities || [])) {
    if (!opp.suggestedSources || opp.suggestedSources.length === 0) continue;
    if (!opp.relevanceScore || opp.relevanceScore < 10) continue;

    const validSources: string[] = [];
    for (const source of opp.suggestedSources) {
      const pairKey = [opp.targetSlug, source].sort().join('<->');
      if (seenPairKeys.has(pairKey)) continue;

      if (opp.targetSlug.includes('how-can-first-time-buyers') && source.includes('canterburys-competitive-market')) {
        continue;
      }

      seenPairKeys.add(pairKey);
      validSources.push(source);
    }

    if (validSources.length === 0) continue;

    recs.push({
      id: `rec-link-${opp.targetSlug}`,
      priority: 'low',
      confidence: 'high',
      category: 'internal_linking',
      targetUrl: `${audit.origin}/${opp.targetSlug}/`,
      slug: opp.targetSlug,
      issue: 'Underlinked Article Opportunity',
      reasoning: 'Articles with zero internal links from related content receive less crawl frequency and user discovery.',
      currentValue: {
        structure: '0 internal links from audited articles.'
      },
      recommendedValue: {
        structure: `Add a contextual internal link pointing to /${validSources[0]}/ with natural anchor text: "how first-time buyers navigate the UK property market" in a section discussing long-term rental vs homeownership.`
      },
      evidence: `Found shared topical tokens ("${opp.topic}") with relevance score ${opp.relevanceScore} in verified category-matching published posts.`,
      limitations: 'Internal links should only be added where natural and genuinely helpful to the human reader.',
      source: 'deterministic_audit',
      requiresApproval: true,
      approved: false
    });
  }

  return recs;
}

/**
 * Generates AI-powered SEO recommendations using Google Gemini or falls back cleanly.
 */
export async function generateFirstReadRecommendations(
  audit: FirstReadAuditReport
): Promise<FirstReadRecommendationsReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  if (!apiKey) {
    return {
      generatedAt: new Date().toISOString(),
      source: 'heuristic',
      fallbackUsed: true,
      fallbackReason: 'GEMINI_API_KEY environment variable is not configured',
      summary: 'Heuristic-verified SEO recommendations generated from live FirstRead audit data. (Configure GEMINI_API_KEY for dynamic generative refinement).',
      recommendations: generateHeuristicRecommendations(audit)
    };
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const promptPayload = {
      site: {
        origin: audit.origin,
        title: audit.homepage.title,
        description: audit.homepage.metaDescription,
        siteInfo: audit.siteInfo
      },
      protocolIssues: audit.technical.protocolIssues,
      summary: audit.summary,
      sampleArticles: audit.articles.slice(0, 15).map(a => ({
        slug: a.slug,
        title: a.title,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        issues: a.issues.map(i => ({ title: i.title, severity: i.severity })),
        missingAltImages: a.missingAltImagesCount,
        internalLinks: a.internalLinksCount
      })),
      duplicates: audit.duplicates
    };

    const response = await client.models.generateContent({
      model,
      contents: JSON.stringify(promptPayload),
      config: {
        systemInstruction: `You are an expert, ethical SEO consultant analyzing the live WordPress site FirstRead (https://firstread.co.uk).
The provided audit data is factual, untrusted input.
Generate actionable, honest recommendations.
Never guarantee Google rankings or invent fabricated traffic.
Explain issues in simple, professional English.
For each item, specify exact proposed improvements, showing current vs recommended metadata.
Output strictly JSON matching the requested structure.`,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                  category: { type: 'string', enum: ['metadata', 'content_structure', 'internal_linking', 'technical'] },
                  targetUrl: { type: 'string' },
                  slug: { type: 'string' },
                  issue: { type: 'string' },
                  reasoning: { type: 'string' },
                  currentValue: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      structure: { type: 'string' }
                    }
                  },
                  recommendedValue: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      structure: { type: 'string' }
                    }
                  },
                  evidence: { type: 'string' },
                  limitations: { type: 'string' },
                  requiresApproval: { type: 'boolean' }
                },
                required: [
                  'id',
                  'priority',
                  'confidence',
                  'category',
                  'targetUrl',
                  'slug',
                  'issue',
                  'reasoning',
                  'currentValue',
                  'recommendedValue',
                  'evidence',
                  'limitations'
                ],
                additionalProperties: false
              }
            }
          },
          required: ['summary', 'recommendations'],
          additionalProperties: false
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    const recs: FirstReadAIRecommendation[] = [];
    for (const r of (parsed.recommendations || [])) {
      if (r.category === 'metadata' && r.recommendedValue?.title) {
        const val = validateRefinedTitle(r.recommendedValue.title, r.currentValue?.title || r.recommendedValue.title);
        if (!val.valid) continue;
      }
      recs.push({
        ...r,
        id: r.id || `gemini-rec-${recs.length + 1}`,
        requiresApproval: true,
        approved: false
      });
    }

    if (recs.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        source: 'heuristic',
        fallbackUsed: true,
        fallbackReason: 'Gemini returned empty or invalid recommendation set; heuristic fallback applied',
        summary: parsed.summary || 'Recommendations synthesized from audit data.',
        recommendations: generateHeuristicRecommendations(audit)
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      source: 'gemini',
      model,
      fallbackUsed: false,
      summary: parsed.summary || 'AI-analyzed SEO recommendations for FirstRead.',
      recommendations: recs
    };
  } catch (err) {
    const reason = sanitizeErrorMessage(err);
    return {
      generatedAt: new Date().toISOString(),
      source: 'heuristic',
      fallbackUsed: true,
      fallbackReason: `Gemini execution error (${reason}); heuristic recommendations applied`,
      summary: 'Heuristic-verified SEO recommendations generated from live FirstRead audit data (Gemini fallback mode).',
      recommendations: generateHeuristicRecommendations(audit)
    };
  }
}
