import { GoogleGenAI } from '@google/genai';
import { runFirstReadAudit } from './audit';
import { generateFirstReadRecommendations } from '../content/ai';
import type { FirstReadAuditReport } from './types';
import type { FirstReadRecommendationsReport } from '../content/types';

// =============================================================================
// OPERATION RESULT INTERFACES
// =============================================================================

export interface OperationMetadata {
  model?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  warnings?: string[];
}

export interface KeywordResearchResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  seed: string;
  isEstimated: boolean;
  dataSourceNotice: string;
  keywords: Array<{
    keyword: string;
    searchVolume: number;
    difficulty: number;
    intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
    cpc: string;
    relevance: 'high' | 'medium' | 'low';
    suggestedAction: string;
  }>;
}

export interface CompetitorAnalysisResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  targetDomain: string;
  isEstimated: boolean;
  dataSourceNotice: string;
  competitors: Array<{
    domain: string;
    authorityScore: number;
    topSharedTopics: string[];
    contentGapsIdentified: string[];
    competitiveEdge: string;
  }>;
  summary: string;
}

export interface SearchIntentResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  results: Array<{
    keyword: string;
    primaryIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
    secondaryIntent?: string;
    userPainPoint: string;
    recommendedFormat: 'comprehensive_guide' | 'checklist' | 'comparison' | 'news_analysis';
    serpFeatureOpportunity: string;
  }>;
}

export interface ContentGapResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  gaps: Array<{
    topic: string;
    urgency: 'high' | 'medium' | 'low';
    targetAudience: string;
    suggestedTitle: string;
    projectedImpact: string;
    rationale: string;
  }>;
}

export interface TopicClusterResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  pillarTopic: string;
  pillarPage: {
    title: string;
    slug: string;
    targetKeyword: string;
    coreAngle: string;
  };
  clusterArticles: Array<{
    title: string;
    slug: string;
    focusKeyword: string;
    clusterRole: 'subtopic_deep_dive' | 'case_study' | 'faq_support' | 'practical_guide';
    internalLinkAnchorToPillar: string;
  }>;
  linkingArchitecture: string;
}

export interface SEOStrategyResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  strategicFocus: string;
  phase1ImmediateFixes: string[];
  phase2ContentExpansion: string[];
  phase3AuthorityGrowth: string[];
  projectedOrganicOutcomes: {
    timeframe: string;
    keyMetric: string;
    actionRequired: string;
  }[];
}

export interface ResearchEvidenceItem {
  claim: string;
  sourceTitle: string;
  sourceUrl: string;
  publisher: string;
  publicationDate?: string;
  retrievalDate: string;
  supportingEvidence: string;
  verificationStatus: 'verified' | 'unverified' | 'unavailable';
}

export interface ArticleResearchResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  recommendedWordCount: number;
  outline: Array<{
    headingLevel: 'H2' | 'H3';
    title: string;
    keyPoints: string[];
  }>;
  internalLinkTargets: string[];
  researchFindings?: string[];
  evidenceFindings: ResearchEvidenceItem[];
  supportingSources?: string[];
  dataLimitationsNotice: string;
}

export interface ArticleGenerationResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  title: string;
  slug: string;
  metaDescription: string;
  excerpt: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  estimatedReadTimeMinutes: number;
  wordCount: number;
  htmlContent: string;
  imageBriefs: Array<{
    placement: string;
    suggestedAltText: string;
    visualPrompt: string;
  }>;
}

export interface ArticleQAResult extends OperationMetadata {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  overallScore: number;
  passed: boolean;
  mandatoryChecks: {
    noBodyH1: boolean;
    minH2Count: boolean;
    noEmptyHeadings: boolean;
    noKeywordStuffing: boolean;
    minWordCount: boolean;
    metadataComplete: boolean;
  };
  failedMandatoryChecks: string[];
  intentMatchScore: number;
  readabilityScore: number;
  originalityScore: number;
  originalityVerification: 'unavailable' | 'verified';
  originalityNotice: string;
  actualWordCount: number;
  headingAudit: {
    hasSingleH1: boolean;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    emptyHeadingCount: number;
    logicalStructure: boolean;
  };
  metadataAudit: {
    titleLength: number;
    titleValid: boolean;
    metaDescriptionLength: number;
    metaDescriptionValid: boolean;
  };
  keywordIntegration: {
    densityPercentage: string;
    rawDensity: number;
    status: 'optimal' | 'under_represented' | 'stuffed';
  };
  remediationSuggestions: string[];
}

// =============================================================================
// GEMINI CLIENT HELPER
// =============================================================================

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

/**
 * Sanitizes error messages to prevent leakage of API keys, tokens, auth headers,
 * or sensitive internal URLs in responses or exports.
 */
export function sanitizeErrorMessage(rawMessage: unknown): string {
  if (!rawMessage) return 'An unexpected error occurred during AI processing.';
  let msg = typeof rawMessage === 'string' ? rawMessage : (rawMessage instanceof Error ? rawMessage.message : String(rawMessage));

  // Redact API keys matching common patterns (e.g. AIza..., Bearer tokens, or ?key= query params)
  msg = msg.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]');
  msg = msg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');
  msg = msg.replace(/(?:api[-_]?key|secret|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]+['"]?/gi, 'apiKey=[REDACTED]');

  // Strip query parameters from URLs
  msg = msg.replace(/https?:\/\/[^\s\?]+(\?[^\s]+)/gi, (match, query) => match.replace(query, '?[REDACTED_PARAMS]'));

  // Normalize common error codes into clear, secure messages
  if (msg.includes('404') && (msg.includes('NOT_FOUND') || msg.includes('models/'))) {
    return 'The requested Gemini model is unavailable or discontinued for this API key tier.';
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return 'Gemini API authentication failed: invalid credentials or insufficient permissions.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Gemini API rate limit or quota exceeded; operation reverted to safe heuristic fallback.';
  }
  if (msg.includes('500') || msg.includes('503') || msg.includes('INTERNAL')) {
    return 'Google Gemini service temporarily unavailable; operation reverted to safe heuristic fallback.';
  }

  // Cap maximum length to avoid payload bloat
  if (msg.length > 200) {
    msg = msg.slice(0, 197) + '...';
  }

  return msg;
}

/**
 * Safely extracts human-readable text from HTML markup and counts words
 */
function countHtmlWords(html: string): number {
  if (!html) return 0;
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped ? stripped.split(/\s+/).filter(Boolean).length : 0;
}

// =============================================================================
// 1. KEYWORD RESEARCH
// =============================================================================

export async function executeKeywordResearch(seed = 'uk property investment'): Promise<KeywordResearchResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `You are an SEO keyword research specialist for FirstRead (https://firstread.co.uk), a UK news and insights publication covering property, business, finance, and lifestyle.
Discover 8 high-opportunity keywords related to "${seed}" for the UK market.
Return JSON with format:
{
  "keywords": [
    {
      "keyword": string,
      "searchVolume": number (realistic UK monthly volume),
      "difficulty": number (1-100),
      "intent": "informational" | "commercial" | "transactional" | "navigational",
      "cpc": string (e.g. "£1.20"),
      "relevance": "high" | "medium" | "low",
      "suggestedAction": string
    }
  ]
}`,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          seed,
          isEstimated: true,
          dataSourceNotice: 'Search volumes and difficulty scores are AI-generated market estimates. Connect Google Keyword Planner or DataForSEO API for verified third-party search volumes.',
          keywords: parsed.keywords
        };
      } else {
        fallbackReason = 'Gemini returned empty keyword list; falling back to curated heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini keyword research error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  // Deterministic fallback
  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    seed,
    isEstimated: true,
    dataSourceNotice: 'Search volumes and difficulty scores are heuristic market estimates. Connect Google Keyword Planner or DataForSEO API for verified third-party search volumes.',
    keywords: [
      {
        keyword: `${seed} 2026 forecast`,
        searchVolume: 3200,
        difficulty: 42,
        intent: 'informational',
        cpc: '£1.45',
        relevance: 'high',
        suggestedAction: 'Create comprehensive UK property market outlook guide'
      },
      {
        keyword: `best places for ${seed}`,
        searchVolume: 4400,
        difficulty: 48,
        intent: 'commercial',
        cpc: '£2.10',
        relevance: 'high',
        suggestedAction: 'Produce regional breakdown ranking high-yield UK postcodes'
      },
      {
        keyword: `${seed} stamp duty changes`,
        searchVolume: 2900,
        difficulty: 35,
        intent: 'informational',
        cpc: '£1.85',
        relevance: 'high',
        suggestedAction: 'Publish explainer on latest UK HMRC stamp duty thresholds'
      },
      {
        keyword: `first time buyer ${seed}`,
        searchVolume: 5100,
        difficulty: 52,
        intent: 'commercial',
        cpc: '£2.30',
        relevance: 'high',
        suggestedAction: 'Develop step-by-step buyer roadmap with loan-to-value tips'
      },
      {
        keyword: `${seed} tax relief uk`,
        searchVolume: 1800,
        difficulty: 38,
        intent: 'informational',
        cpc: '£3.15',
        relevance: 'medium',
        suggestedAction: 'Provide Section 24 and limited company landlord guidance'
      },
      {
        keyword: `commercial vs residential ${seed}`,
        searchVolume: 1200,
        difficulty: 29,
        intent: 'commercial',
        cpc: '£2.75',
        relevance: 'medium',
        suggestedAction: 'Write comparative ROI and risk assessment analysis'
      }
    ]
  };
}

// =============================================================================
// 2. COMPETITOR ANALYSIS
// =============================================================================

export async function executeCompetitorAnalysis(domain = 'firstread.co.uk'): Promise<CompetitorAnalysisResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `You are an SEO competitive intelligence analyst analyzing UK publication "${domain}".
Evaluate competitor landscape against leading UK property and lifestyle news magazines (e.g., Property Week, Estate Agent Today, The Negotiator).
Return JSON:
{
  "summary": string,
  "competitors": [
    {
      "domain": string,
      "authorityScore": number (1-100),
      "topSharedTopics": string[],
      "contentGapsIdentified": string[],
      "competitiveEdge": string
    }
  ]
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed.competitors && Array.isArray(parsed.competitors)) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          targetDomain: domain,
          isEstimated: true,
          dataSourceNotice: 'Competitor authority scores and shared topic models are AI-generated competitive projections. Connect a live backlink API (e.g. Ahrefs, SEMrush) for verified third-party authority metrics.',
          competitors: parsed.competitors,
          summary: parsed.summary || 'Competitor gap analysis successfully compiled.'
        };
      } else {
        fallbackReason = 'Gemini returned invalid competitor analysis data; falling back to curated heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini competitor analysis error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    targetDomain: domain,
    isEstimated: true,
    dataSourceNotice: 'Competitor authority scores and shared topic models are heuristic competitive projections. Connect a live backlink API (e.g. Ahrefs, SEMrush) for verified third-party authority metrics.',
    summary: 'Heuristic competitive analysis of UK real estate and lifestyle publication space.',
    competitors: [
      {
        domain: 'propertyweek.com',
        authorityScore: 78,
        topSharedTopics: ['Commercial real estate', 'UK interest rates', 'London development projects'],
        contentGapsIdentified: ['First-time landlord practical guides', 'Local high street regeneration profiles'],
        competitiveEdge: 'B2B industry insider readership and commercial lease deep dives'
      },
      {
        domain: 'estateagenttoday.co.uk',
        authorityScore: 66,
        topSharedTopics: ['Mortgage lending criteria', 'Rightmove market indices', 'Estate agency trends'],
        contentGapsIdentified: ['Long-term tenant rights breakdowns', 'Regional commuter belt property comparisons'],
        competitiveEdge: 'Fast industry breaking news distribution'
      },
      {
        domain: 'buyassociationgroup.com',
        authorityScore: 59,
        topSharedTopics: ['Off-plan property', 'Northern Powerhouse investments', 'Build to Rent'],
        contentGapsIdentified: ['Sustainable retrofit guides', 'EPC regulations and landlord legal requirements'],
        competitiveEdge: 'Investor-focused localized yield breakdowns'
      }
    ]
  };
}

// =============================================================================
// 3. SEARCH INTENT ANALYSIS
// =============================================================================

export async function executeSearchIntentAnalysis(keywords: string[]): Promise<SearchIntentResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini && keywords.length > 0) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Classify search intent and SERP targeting for these search queries: ${JSON.stringify(keywords)}.
Return JSON:
{
  "results": [
    {
      "keyword": string,
      "primaryIntent": "informational" | "commercial" | "transactional" | "navigational",
      "secondaryIntent": string,
      "userPainPoint": string,
      "recommendedFormat": "comprehensive_guide" | "checklist" | "comparison" | "news_analysis",
      "serpFeatureOpportunity": string
    }
  ]
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.results) && parsed.results.length > 0) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          results: parsed.results
        };
      } else {
        fallbackReason = 'Gemini returned empty intent results; falling back to rule-based heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini search intent analysis error: ${sanitizeErrorMessage(err)}`;
    }
  } else if (!gemini) {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  } else {
    fallbackReason = 'No keywords provided for intent classification';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    results: (keywords.length > 0 ? keywords : ['canterbury property investment', 'uk mortgage rates 2026']).map(k => {
      const lower = k.toLowerCase();
      let intent: 'informational' | 'commercial' | 'transactional' | 'navigational' = 'informational';
      if (lower.includes('buy') || lower.includes('cost') || lower.includes('best') || lower.includes('vs')) {
        intent = 'commercial';
      }
      return {
        keyword: k,
        primaryIntent: intent,
        secondaryIntent: intent === 'commercial' ? 'informational' : 'commercial',
        userPainPoint: `Searching for authoritative, up-to-date UK perspective regarding ${k}.`,
        recommendedFormat: intent === 'commercial' ? 'comparison' : 'comprehensive_guide',
        serpFeatureOpportunity: 'Featured Snippet & People Also Ask (PAA) blocks'
      };
    })
  };
}

// =============================================================================
// 4. CONTENT GAP DISCOVERY
// =============================================================================

export async function executeContentGapDiscovery(niche = 'UK Regional Property & Finance'): Promise<ContentGapResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Identify 5 distinct editorial content gaps in the ${niche} publishing market for FirstRead.
Return JSON:
{
  "gaps": [
    {
      "topic": string,
      "urgency": "high" | "medium" | "low",
      "targetAudience": string,
      "suggestedTitle": string,
      "projectedImpact": string,
      "rationale": string
    }
  ]
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.gaps) && parsed.gaps.length > 0) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          gaps: parsed.gaps
        };
      } else {
        fallbackReason = 'Gemini returned empty content gap list; falling back to curated heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini content gap discovery error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    gaps: [
      {
        topic: 'UK EPC Regulations Landlord 2026 Compliance',
        urgency: 'high',
        targetAudience: 'Private landlords and property managers',
        suggestedTitle: 'UK EPC Regulations Explained: What Landlords Must Upgrade',
        projectedImpact: 'High organic search volume and long-tail evergreen queries',
        rationale: 'Substantial regulatory shifts with high search intent from confused property owners.'
      },
      {
        topic: 'Commuter Belt ROI vs London Centric Living',
        urgency: 'high',
        targetAudience: 'Young professionals and property investors',
        suggestedTitle: 'Commuter Towns with the Best Rail Links and Property Yields',
        projectedImpact: 'Strong social sharing and commercial buyer intent',
        rationale: 'Hybrid working models continue to direct attention towards Kent, Surrey, and Essex.'
      },
      {
        topic: 'Limited Company Buy-to-Let Mortgage Comparison',
        urgency: 'medium',
        targetAudience: 'Portfolio landlords and high-net-worth investors',
        suggestedTitle: 'Setting Up an SPV for Buy-to-Let: Tax Advantages and Mortgage Rates',
        projectedImpact: 'High commercial CPC value and commercial intent',
        rationale: 'Increasing trend of landlords moving personal portfolios into corporate structures.'
      }
    ]
  };
}

// =============================================================================
// 5. TOPIC CLUSTER GENERATION
// =============================================================================

export async function executeTopicClusterGeneration(pillarTopic = 'UK Buy to Let'): Promise<TopicClusterResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Generate an SEO topic cluster for pillar topic "${pillarTopic}" for FirstRead.
Include a central pillar page and 4 supporting cluster subtopic articles with clear internal linking directives.
Return JSON:
{
  "pillarTopic": "${pillarTopic}",
  "pillarPage": {
    "title": string,
    "slug": string,
    "targetKeyword": string,
    "coreAngle": string
  },
  "clusterArticles": [
    {
      "title": string,
      "slug": string,
      "focusKeyword": string,
      "clusterRole": "subtopic_deep_dive" | "case_study" | "faq_support" | "practical_guide",
      "internalLinkAnchorToPillar": string
    }
  ],
  "linkingArchitecture": string
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed.pillarPage && Array.isArray(parsed.clusterArticles) && parsed.clusterArticles.length > 0) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          pillarTopic,
          pillarPage: parsed.pillarPage,
          clusterArticles: parsed.clusterArticles,
          linkingArchitecture: parsed.linkingArchitecture || 'Hub-and-spoke internal linking architecture'
        };
      } else {
        fallbackReason = 'Gemini returned incomplete cluster architecture; falling back to curated heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini topic cluster error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    pillarTopic,
    pillarPage: {
      title: 'The Complete UK Buy-to-Let Guide: Investment, Regulations, and Yields',
      slug: 'uk-buy-to-let-guide',
      targetKeyword: 'uk buy to let guide',
      coreAngle: 'Authoritative, comprehensive overview of the modern UK rental market for landlords.'
    },
    clusterArticles: [
      {
        title: 'Buy-to-Let Tax Rules: Section 24 and Mortgage Interest Explained',
        slug: 'buy-to-let-tax-rules-section-24',
        focusKeyword: 'buy to let tax rules',
        clusterRole: 'subtopic_deep_dive',
        internalLinkAnchorToPillar: 'comprehensive UK buy-to-let investment guide'
      },
      {
        title: 'How to Calculate Rental Yield: Gross vs Net Formula',
        slug: 'how-to-calculate-rental-yield',
        focusKeyword: 'calculate rental yield',
        clusterRole: 'practical_guide',
        internalLinkAnchorToPillar: 'UK buy-to-let strategy'
      },
      {
        title: 'Top 10 Highest Yielding Property Locations Across the UK',
        slug: 'highest-yielding-uk-property-locations',
        focusKeyword: 'highest rental yields uk',
        clusterRole: 'subtopic_deep_dive',
        internalLinkAnchorToPillar: 'complete buy-to-let landlord manual'
      },
      {
        title: 'Landlord Legal Obligations Checklist for 2026',
        slug: 'uk-landlord-legal-obligations-checklist',
        focusKeyword: 'landlord legal checklist uk',
        clusterRole: 'faq_support',
        internalLinkAnchorToPillar: 'firstread buy-to-let resource hub'
      }
    ],
    linkingArchitecture: 'Hub-and-spoke: Every cluster article links upward to the pillar using exact anchor variation. The pillar page links downward to cluster articles within relevant sections.'
  };
}

// =============================================================================
// 6. SEO STRATEGY GENERATION
// =============================================================================

export async function executeSEOStrategyGeneration(focus = 'FirstRead 90-Day Organic Growth'): Promise<SEOStrategyResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `You are an executive SEO growth strategist for FirstRead (https://firstread.co.uk), a UK news and lifestyle digital magazine covering property, business, finance, and culture.
Develop a high-conviction 90-day organic search growth strategy focused on: "${focus}".
Include Phase 1 immediate technical/content fixes (4 items), Phase 2 content expansion (3 items), Phase 3 authority building (3 items), and 3 projected organic outcomes across Month 1, Month 2, and Month 3.
Return JSON:
{
  "strategicFocus": "${focus}",
  "phase1ImmediateFixes": string[],
  "phase2ContentExpansion": string[],
  "phase3AuthorityGrowth": string[],
  "projectedOrganicOutcomes": [
    {
      "timeframe": string,
      "keyMetric": string,
      "actionRequired": string
    }
  ]
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.phase1ImmediateFixes) && parsed.phase1ImmediateFixes.length > 0) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          strategicFocus: parsed.strategicFocus || focus,
          phase1ImmediateFixes: parsed.phase1ImmediateFixes,
          phase2ContentExpansion: parsed.phase2ContentExpansion || [],
          phase3AuthorityGrowth: parsed.phase3AuthorityGrowth || [],
          projectedOrganicOutcomes: parsed.projectedOrganicOutcomes || []
        };
      } else {
        fallbackReason = 'Gemini returned incomplete strategy roadmap; falling back to curated heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini strategy generation error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    strategicFocus: focus,
    phase1ImmediateFixes: [
      'Resolve HTTP vs HTTPS site URL inconsistency in WordPress general settings',
      'Remediate 22 articles with duplicate title tags causing internal SERP cannibalisation',
      'Add descriptive alt attributes to high-traffic editorial images currently missing alt text',
      'Clean dangling punctuation and site title repetition in long headlines'
    ],
    phase2ContentExpansion: [
      'Publish 4 high-authority pillar articles covering UK Property, Business, Tech, and Lifestyle',
      'Create 16 supporting cluster articles interlinked to build topical authority',
      'Deploy 3 interactive calculators (e.g. stamp duty, rental yield) to drive natural backlinks'
    ],
    phase3AuthorityGrowth: [
      'Implement structured NewsArticle and FAQPage schema across editorial content',
      'Establish internal contextual linking mesh between existing archived articles',
      'Monitor and re-optimize underperforming articles older than 6 months'
    ],
    projectedOrganicOutcomes: [
      {
        timeframe: 'Month 1',
        keyMetric: 'Zero technical crawl warnings',
        actionRequired: 'Technical SEO cleanup and canonical consistency'
      },
      {
        timeframe: 'Month 2',
        keyMetric: '+30% indexation of long-tail search queries',
        actionRequired: 'Pillar and cluster content publication'
      },
      {
        timeframe: 'Month 3',
        keyMetric: '+45% organic click growth on target keywords',
        actionRequired: 'Internal linking mesh and SERP snippet optimization'
      }
    ]
  };
}

// =============================================================================
// 7. ARTICLE RESEARCH
// =============================================================================

export async function executeArticleResearch(topic = 'UK Property Market Trends'): Promise<ArticleResearchResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  const defaultLimitationsNotice = 'Research data comprises AI market synthesis and published statistical benchmarks. External live retrieval was not executed for this run; citations reference published statistical benchmarks and remain unverified against real-time feeds.';
  const defaultSources = [
    'Index of Private Housing Rental Prices, UK: August 2024 (ONS)',
    'Monetary Policy Report - August 2024 (Bank of England)',
    'UK House Price Index: August 2024 (HM Land Registry & ONS)'
  ];

  const curatedEvidenceFindings: ResearchEvidenceItem[] = [
    {
      claim: 'Private rental prices in the UK increased by 8.4% in the 12 months to August 2024 (provisional estimate).',
      sourceTitle: 'Index of Private Housing Rental Prices, UK: August 2024',
      sourceUrl: 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/indexofprivatehousingrentalprices/august2024',
      publisher: 'Office for National Statistics (ONS)',
      publicationDate: '2024-09-18',
      retrievalDate: new Date().toISOString().split('T')[0],
      supportingEvidence: 'Official statistical bulletin measuring change in the price that tenants face when renting residential property from private landlords in the UK.',
      verificationStatus: 'unverified'
    },
    {
      claim: 'The Bank of England Monetary Policy Committee set the Bank Rate at 5.00% in August 2024, altering interest coverage stress testing for buy-to-let refinancing.',
      sourceTitle: 'Monetary Policy Report - August 2024',
      sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy-report/2024/august-2024',
      publisher: 'Bank of England',
      publicationDate: '2024-08-01',
      retrievalDate: new Date().toISOString().split('T')[0],
      supportingEvidence: 'Policy decision documentation setting the official UK base rate governing borrowing costs and mortgage lender stress test benchmarks.',
      verificationStatus: 'unverified'
    },
    {
      claim: 'Average UK house price was estimated at £293,000 in August 2024, with northern English regions demonstrating higher gross rental yields than London.',
      sourceTitle: 'UK House Price Index: August 2024',
      sourceUrl: 'https://www.gov.uk/government/statistics/uk-house-price-index-for-august-2024',
      publisher: 'HM Land Registry & ONS',
      publicationDate: '2024-10-16',
      retrievalDate: new Date().toISOString().split('T')[0],
      supportingEvidence: 'National statistics series tracking completed residential property sales registered with HM Land Registry across England, Wales, Scotland and Northern Ireland.',
      verificationStatus: 'unverified'
    }
  ];

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Conduct editorial SEO research for an article about "${topic}" for FirstRead (https://firstread.co.uk).
Provide primary keyword, secondary keywords, search intent, target word count, and an H2/H3 outline with key points.
Also provide 3 specific source-backed evidence findings. Do NOT use generic root homepages. Reference specific published reports. Mark verificationStatus as "unverified" as real-time web crawling is not attached.
Return JSON:
{
  "topic": "${topic}",
  "primaryKeyword": string,
  "secondaryKeywords": string[],
  "searchIntent": string,
  "recommendedWordCount": number,
  "evidenceFindings": [
    {
      "claim": string,
      "sourceTitle": string,
      "sourceUrl": string,
      "publisher": string,
      "publicationDate": string,
      "retrievalDate": string,
      "supportingEvidence": string,
      "verificationStatus": "unverified"
    }
  ],
  "outline": [
    {
      "headingLevel": "H2" | "H3",
      "title": string,
      "keyPoints": string[]
    }
  ],
  "internalLinkTargets": string[]
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed.outline && Array.isArray(parsed.outline)) {
        const evidenceFindings: ResearchEvidenceItem[] = Array.isArray(parsed.evidenceFindings) && parsed.evidenceFindings.length > 0
          ? parsed.evidenceFindings.map((item: Partial<ResearchEvidenceItem>) => ({
              claim: item.claim || 'UK property market yield analysis',
              sourceTitle: item.sourceTitle || 'Public UK Statistical Release',
              sourceUrl: item.sourceUrl && !item.sourceUrl.endsWith('.co.uk/') && !item.sourceUrl.endsWith('.gov.uk/')
                ? item.sourceUrl
                : 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/indexofprivatehousingrentalprices/august2024',
              publisher: item.publisher || 'Public Source',
              publicationDate: item.publicationDate || '2024',
              retrievalDate: item.retrievalDate || new Date().toISOString().split('T')[0],
              supportingEvidence: item.supportingEvidence || 'Referenced in editorial research brief.',
              verificationStatus: 'unverified' as const
            }))
          : curatedEvidenceFindings;

        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          topic,
          primaryKeyword: parsed.primaryKeyword || topic,
          secondaryKeywords: parsed.secondaryKeywords || [],
          searchIntent: parsed.searchIntent || 'Informational',
          recommendedWordCount: parsed.recommendedWordCount || 1200,
          researchFindings: evidenceFindings.map(e => e.claim),
          evidenceFindings,
          supportingSources: evidenceFindings.map(e => `${e.sourceTitle} (${e.publisher})`),
          dataLimitationsNotice: defaultLimitationsNotice,
          outline: parsed.outline,
          internalLinkTargets: parsed.internalLinkTargets || []
        };
      } else {
        fallbackReason = 'Gemini returned invalid research structure; falling back to curated heuristics';
      }
    } catch (err) {
      fallbackReason = `Gemini article research error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    topic,
    primaryKeyword: `${topic.toLowerCase()}`,
    secondaryKeywords: ['uk housing market forecast', 'interest rates property impact', 'regional house price growth'],
    searchIntent: 'Informational & Commercial Research',
    recommendedWordCount: 1400,
    researchFindings: curatedEvidenceFindings.map(e => e.claim),
    evidenceFindings: curatedEvidenceFindings,
    supportingSources: defaultSources,
    dataLimitationsNotice: defaultLimitationsNotice,
    outline: [
      {
        headingLevel: 'H2',
        title: 'Current State of the UK Housing Market',
        keyPoints: ['Overview of recent mortgage rate adjustments', 'Bank of England monetary policy summary']
      },
      {
        headingLevel: 'H2',
        title: 'Regional Disparities: North vs South Performance',
        keyPoints: ['Capital appreciation in the North West and Midlands', 'London market stabilization']
      },
      {
        headingLevel: 'H3',
        title: 'Rental Yields Across Key Commuter Hubs',
        keyPoints: ['Kent and Canterbury rental yields', 'Commuter belt tenant demand']
      },
      {
        headingLevel: 'H2',
        title: 'Key Considerations for Prospective Investors',
        keyPoints: ['Regulatory compliance and EPC changes', 'Long-term capital gains expectations']
      }
    ],
    internalLinkTargets: ['how-can-first-time-buyers-navigate', 'canterburys-competitive-market']
  };
}

// =============================================================================
// 8. ARTICLE GENERATION
// =============================================================================

export async function executeArticleGeneration({
  topic = 'UK Rental Market Guide',
  primaryKeyword = 'uk rental market trends'
}: {
  topic?: string;
  primaryKeyword?: string;
}): Promise<ArticleGenerationResult> {
  const gemini = getGeminiClient();
  let fallbackReason: string | undefined;

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `You are an expert editorial writer for FirstRead (https://firstread.co.uk).
Write a high quality, comprehensive, fact-checked, SEO-optimized editorial article on topic: "${topic}" with primary keyword: "${primaryKeyword}".
Include an engaging title (30 to 60 chars), meta description (80 to 155 chars), clean HTML content with multiple H2 and H3 tags and detailed paragraphs (target 800+ words), and image prompts with descriptive alt text.
Return JSON:
{
  "title": string,
  "slug": string,
  "metaDescription": string,
  "excerpt": string,
  "primaryKeyword": "${primaryKeyword}",
  "secondaryKeywords": string[],
  "htmlContent": string,
  "imageBriefs": [
    {
      "placement": string,
      "suggestedAltText": string,
      "visualPrompt": string
    }
  ]
}`,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed.htmlContent) {
        const actualWords = countHtmlWords(parsed.htmlContent);
        const actualReadTime = Math.max(1, Math.ceil(actualWords / 200));
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          model: DEFAULT_MODEL,
          fallbackUsed: false,
          title: parsed.title,
          slug: parsed.slug,
          metaDescription: parsed.metaDescription,
          excerpt: parsed.excerpt,
          primaryKeyword,
          secondaryKeywords: parsed.secondaryKeywords || [],
          estimatedReadTimeMinutes: actualReadTime,
          wordCount: actualWords,
          htmlContent: parsed.htmlContent,
          imageBriefs: parsed.imageBriefs || []
        };
      } else {
        fallbackReason = 'Gemini returned empty HTML content; falling back to curated editorial template';
      }
    } catch (err) {
      fallbackReason = `Gemini article generation error: ${sanitizeErrorMessage(err)}`;
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  const title = `${topic}: Strategic Insights for UK Investors`;
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const metaDescription = `Explore critical ${primaryKeyword} with expert analysis of regional yields, regulatory updates, and investor strategies across the UK.`;
  const excerpt = `A detailed analysis of ${primaryKeyword}, exploring recent shifts in mortgage lending, regional yields, and long-term investor considerations.`;

  const fallbackHtml = `<h2>Understanding Current ${topic}</h2>
<p>The UK property sector continues to demonstrate resilience despite fluctuating macroeconomic headwinds and shifting fiscal policies. For investors, homeowners, and financial planners, understanding the structural dynamics of ${primaryKeyword} is essential for making sound capital allocation decisions. Over the past twelve months, the market has undergone notable recalibration, shaped by persistent interest rate adjustments, regional demand migration, and legislative reform.</p>
<p>Private landlords and institutional investors alike have adjusted underwriting standards. While capital appreciation remains an attractive long-term prospect in select growth corridors, cash flow resilience and net yield preservation have taken centre stage. In this strategic overview, FirstRead evaluates the prevailing economic drivers, regional yield disparities, regulatory milestones, and pragmatic asset management strategies necessary to build enduring property wealth.</p>

<h2>Key Regional Growth Indicators and Yield Dynamics</h2>
<p>While central London has historically captured the lion’s share of international media attention, domestic property fundamentals tell a more nuanced story. Regional urban hubs across the North West and the West Midlands—notably Greater Manchester, Liverpool, Birmingham, and Leeds—have steadily outperformed prime southern locations in gross rental yields. Investors targeting regional city centres often achieve yields exceeding 6.5% to 8%, driven by robust student populations, burgeoning technology sectors, and extensive civic regeneration programmes.</p>
<p>Conversely, prime residential areas in London and the immediate commuter fringe present lower immediate gross returns, typically ranging between 3.5% and 5%. However, these assets benefit from deeper liquidity, sustained tenant demand among high-earning professionals, and defensive capital preservation characteristics. Discerning investors must therefore balance immediate income requirements against long-term capital stability.</p>

<h3>The Rise of Regional Commuter Belts</h3>
<p>The enduring adoption of hybrid working models has altered tenant preferences across the UK. Historic market towns and coastal hubs across Kent, Surrey, and Essex—such as Canterbury, Tunbridge Wells, and Chelmsford—continue to experience sustained tenant interest. As highlighted in FirstRead’s analysis of <a href="/canterburys-competitive-market/">Canterbury’s competitive rental market</a>, commuters who require high-speed rail access to London only two or three days each week are increasingly willing to pay a premium for spacious rental accommodation with dedicated home office space and access to green amenities.</p>

<h2>Navigating Legislative &amp; Regulatory Reforms</h2>
<p>The UK regulatory landscape for private rented property is experiencing its most significant transformation in a generation. Landlords face a demanding compliance schedule designed to enhance tenancy security and accelerate environmental sustainability across the housing stock.</p>

<h3>Energy Performance Certificate (EPC) Mandates</h3>
<p>Central to ongoing regulatory discussions are proposed updates to minimum Energy Performance Certificate standards. While government timelines have evolved, forward-looking investors are proactively retrofitting older housing stock. Upgrading insulation, installing smart heating controls, and deploying heat pumps not only mitigates long-term compliance risks but also protects against tenant void periods, as energy-conscious renters increasingly prioritise manageable utility costs.</p>

<h3>Taxation and Structural Efficiency (Section 24)</h3>
<p>The phasing out of mortgage interest tax relief for individual landlords under Section 24 has accelerated the transition towards corporate holding structures. The establishment of Special Purpose Vehicles (SPVs) allows portfolio owners to deduct finance costs in full against corporation tax rates. However, transitioning existing personal portfolios into limited company structures requires meticulous planning regarding Stamp Duty Land Tax (SDLT) and Capital Gains Tax (CGT) liabilities. Prospective buyers should consult our practical <a href="/how-can-first-time-buyers-navigate/">first-time buyers property guide</a> for foundational structural advice.</p>

<h2>Strategic Portfolio Recommendations for UK Landlords</h2>
<p>To navigate the contemporary UK market with authority and resilience, investors should consider adopting the following strategic principles:</p>
<p>First, conduct granular stress testing against higher interest rate environments. Ensure interest cover ratios (ICR) comfortably exceed 140% at realistic stress rates before acquiring leveraged assets.</p>
<p>Second, focus on asset quality over speculative volume. High-specification properties in close proximity to transport infrastructure and top-tier employment hubs consistently maintain higher retention rates and reduced vacancy periods.</p>
<p>Third, collaborate with accredited local property management professionals. As compliance burdens grow, professional letting agents provide indispensable support in navigating tenant rights, safety certifications, and regular deposit administration.</p>

<h2>Conclusion</h2>
<p>The UK property sector presents compelling opportunities for informed, disciplined participants who understand ${primaryKeyword}. By focusing on regional fundamentals, structural tax efficiency, and proactive regulatory compliance, investors can construct enduring portfolios capable of weathering cyclical market fluctuations and delivering sustainable long-term value.</p>`;

  const fallbackWordCount = countHtmlWords(fallbackHtml);
  const fallbackReadTime = Math.max(1, Math.ceil(fallbackWordCount / 200));

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    fallbackUsed: true,
    fallbackReason,
    title,
    slug,
    metaDescription,
    excerpt,
    primaryKeyword,
    secondaryKeywords: ['uk property yields', 'landlord strategies', 'housing forecast'],
    estimatedReadTimeMinutes: fallbackReadTime,
    wordCount: fallbackWordCount,
    htmlContent: fallbackHtml,
    imageBriefs: [
      {
        placement: 'Featured Header',
        suggestedAltText: 'Modern UK residential apartment building with sunny skyline',
        visualPrompt: 'High quality architectural photography of modern residential UK brick apartment complex, natural daylight.'
      },
      {
        placement: 'Regional Analysis Section',
        suggestedAltText: 'Chart showing comparative rental yields across UK commuter hubs',
        visualPrompt: 'Infographic showing UK regional map with rental yields highlighted across regional corridors.'
      }
    ]
  };
}

// =============================================================================
// 9. INDEPENDENT ARTICLE QA
// =============================================================================

export async function executeArticleQA({
  title = '',
  metaDescription = '',
  content = '',
  primaryKeyword = ''
}: {
  title?: string;
  metaDescription?: string;
  content?: string;
  primaryKeyword?: string;
}): Promise<ArticleQAResult> {
  const remediation: string[] = [];
  let structuralScore = 100;

  // Metadata evaluation: distinguish genuine technical completeness from editorial snippet advisories
  const titleLen = (title || '').trim().length;
  const metaLen = (metaDescription || '').trim().length;

  // Editorial SERP display recommendations (informational score impact only)
  const titleSerpOptimal = titleLen >= 30 && titleLen <= 65;
  const metaSerpOptimal = metaLen >= 80 && metaLen <= 160;

  if (!titleSerpOptimal) {
    structuralScore -= 10;
    remediation.push(`Title length (${titleLen} chars) is outside the recommended 30-65 character SERP display window.`);
  }

  if (!metaSerpOptimal) {
    structuralScore -= 10;
    remediation.push(`Meta description length (${metaLen} chars) is outside the recommended 80-160 character snippet window.`);
  }

  // Genuine technical metadata requirement: Both title and meta description must be provided
  const titlePresent = titleLen >= 10 && titleLen <= 120;
  const metaPresent = metaLen >= 25 && metaLen <= 320;
  const metadataComplete = titlePresent && metaPresent;
  if (!metadataComplete) {
    structuralScore -= 25;
    remediation.push('Mandatory metadata missing: A functional article title (minimum 10 chars) and meta description (minimum 25 chars) are technically required.');
  }

  // Heading hierarchy
  const h1Matches = content.match(/<h1[^>]*>/gi) || [];
  const h2Matches = content.match(/<h2[^>]*>/gi) || [];
  const h3Matches = content.match(/<h3[^>]*>/gi) || [];

  // Check for empty headings (e.g. <h2></h2>, <h3>   </h3>, <h2>&nbsp;</h2>)
  const emptyHeadingRegex = /<h[1-6][^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/h[1-6]>/gi;
  const emptyHeadings = content.match(emptyHeadingRegex) || [];

  if (h1Matches.length > 0) {
    structuralScore -= 15;
    remediation.push('Article body contains an explicit <h1> tag. Headings in content body should start at <h2> to prevent duplicate H1 conflicts with WordPress theme template.');
  }

  if (h2Matches.length < 2) {
    structuralScore -= 15;
    remediation.push(`Article contains ${h2Matches.length} <h2> headings (minimum 2 required for structured hierarchy).`);
  }

  if (emptyHeadings.length > 0) {
    structuralScore -= 10;
    remediation.push(`Article contains ${emptyHeadings.length} empty heading tag(s) without text content.`);
  }

  // Word count calculation
  const actualWordCount = countHtmlWords(content);
  if (actualWordCount < 300) {
    structuralScore -= 15;
    remediation.push(`Article length (${actualWordCount} words) is below the minimum publication threshold of 300 words.`);
  }

  // Keyword presence & density
  let keywordDensityStatus: 'optimal' | 'under_represented' | 'stuffed' = 'optimal';
  let density = 0;
  let keywordMatchesCount = 0;
  if (primaryKeyword && actualWordCount > 0) {
    const cleanKw = primaryKeyword.trim();
    if (cleanKw) {
      const escaped = cleanKw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const textOnly = content.replace(/<[^>]+>/g, ' ');
      const matches = textOnly.match(new RegExp(escaped, 'gi')) || [];
      keywordMatchesCount = matches.length;
      density = (keywordMatchesCount / actualWordCount) * 100;
    }

    if (actualWordCount >= 300 && density < 0.3) {
      keywordDensityStatus = 'under_represented';
      structuralScore -= 10;
      remediation.push(`Primary keyword "${primaryKeyword}" appears with low frequency (${density.toFixed(2)}% density < 0.3%). Weave it naturally into opening sections.`);
    } else if (density > 3.5 && (keywordMatchesCount >= 3 || actualWordCount >= 50)) {
      keywordDensityStatus = 'stuffed';
      structuralScore -= 25;
      remediation.push(`Primary keyword density is excessively high (${density.toFixed(2)}% > 3.5%). Severe keyword stuffing detected; reduce repetition immediately.`);
    }
  }

  // Mandatory checks evaluation - Genuine technical and baseline publication gates
  const mandatoryChecks = {
    noBodyH1: h1Matches.length === 0,
    minH2Count: h2Matches.length >= 2,
    noEmptyHeadings: emptyHeadings.length === 0,
    noKeywordStuffing: keywordDensityStatus !== 'stuffed',
    minWordCount: actualWordCount >= 300,
    metadataComplete: metadataComplete
  };

  const failedMandatoryChecks: string[] = [];
  if (!mandatoryChecks.noBodyH1) failedMandatoryChecks.push('noBodyH1');
  if (!mandatoryChecks.minH2Count) failedMandatoryChecks.push('minH2Count');
  if (!mandatoryChecks.noEmptyHeadings) failedMandatoryChecks.push('noEmptyHeadings');
  if (!mandatoryChecks.noKeywordStuffing) failedMandatoryChecks.push('noKeywordStuffing');
  if (!mandatoryChecks.minWordCount) failedMandatoryChecks.push('minWordCount');
  if (!mandatoryChecks.metadataComplete) failedMandatoryChecks.push('metadataComplete');

  const allMandatoryPassed = failedMandatoryChecks.length === 0;

  // Gemini semantic evaluation
  const gemini = getGeminiClient();
  let aiIntentScore = structuralScore >= 75 ? 90 : 65;
  let aiReadabilityScore = 88;
  let aiOriginalityScore = 90;
  let source: 'gemini' | 'heuristic' = 'heuristic';
  let fallbackReason: string | undefined;

  if (gemini && content) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `You are an editorial quality assurance reviewer for FirstRead (https://firstread.co.uk).
Review this draft article targeting primary keyword: "${primaryKeyword}".
Title: "${title}"
Meta description: "${metaDescription}"
Body excerpt:
${content.replace(/<[^>]+>/g, ' ').slice(0, 3000)}

Evaluate:
1. Search intent alignment (0-100)
2. Readability and clarity (0-100)
3. Content originality / depth (0-100)
4. List up to 2 specific editorial suggestions or flaws (if any).

Return JSON:
{
  "intentMatchScore": number,
  "readabilityScore": number,
  "originalityScore": number,
  "suggestions": string[]
}`,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text || '{}');
      if (typeof parsed.intentMatchScore === 'number') {
        source = 'gemini';
        aiIntentScore = Math.min(100, Math.max(0, parsed.intentMatchScore));
        aiReadabilityScore = Math.min(100, Math.max(0, parsed.readabilityScore || 85));
        aiOriginalityScore = Math.min(100, Math.max(0, parsed.originalityScore || 90));

        if (Array.isArray(parsed.suggestions)) {
          for (const s of parsed.suggestions) {
            if (typeof s === 'string' && s.trim()) remediation.push(s.trim());
          }
        }
      } else {
        fallbackReason = 'Gemini returned invalid QA response structure';
      }
    } catch (err) {
      fallbackReason = `Gemini QA evaluation error: ${sanitizeErrorMessage(err)}`;
    }
  } else if (!gemini) {
    fallbackReason = 'GEMINI_API_KEY environment variable is not configured';
  }

  const clampedStructuralScore = Math.max(10, Math.min(100, structuralScore));
  const finalScore = source === 'gemini'
    ? Math.max(10, Math.min(100, Math.round(clampedStructuralScore * 0.4 + aiIntentScore * 0.3 + aiReadabilityScore * 0.3)))
    : clampedStructuralScore;

  // INDEPENDENT PUBLICATION GATE:
  // Mandatory checks independently determine pass/fail.
  // The overall score remains informational (editorial quality indicator).
  // A high score cannot override a failed mandatory check.
  // A low composite score alone cannot reject otherwise valid content if every mandatory requirement passes.
  const passed = allMandatoryPassed;

  return {
    generatedAt: new Date().toISOString(),
    source,
    model: source === 'gemini' ? DEFAULT_MODEL : undefined,
    fallbackUsed: source === 'heuristic',
    fallbackReason,
    overallScore: finalScore,
    passed,
    mandatoryChecks,
    failedMandatoryChecks,
    intentMatchScore: aiIntentScore,
    readabilityScore: aiReadabilityScore,
    originalityScore: aiOriginalityScore,
    originalityVerification: 'unavailable',
    originalityNotice: 'External plagiarism and originality indexing API is not configured; AI originality score is an unverified heuristic estimate.',
    actualWordCount,
    headingAudit: {
      hasSingleH1: h1Matches.length === 0,
      h1Count: h1Matches.length,
      h2Count: h2Matches.length,
      h3Count: h3Matches.length,
      emptyHeadingCount: emptyHeadings.length,
      logicalStructure: h2Matches.length >= 2 && emptyHeadings.length === 0
    },
    metadataAudit: {
      titleLength: titleLen,
      titleValid: titleSerpOptimal,
      metaDescriptionLength: metaLen,
      metaDescriptionValid: metaSerpOptimal
    },
    keywordIntegration: {
      densityPercentage: `${density.toFixed(2)}%`,
      rawDensity: Number(density.toFixed(2)),
      status: keywordDensityStatus
    },
    remediationSuggestions: remediation.length > 0 ? remediation : ['Article satisfies all automated SEO and structural quality checks.']
  };
}

// =============================================================================
// 10. TECHNICAL AUDIT & 11. RECOMMENDATIONS DELEGATES
// =============================================================================

export async function executeTechnicalAudit(limit = 100): Promise<FirstReadAuditReport> {
  return await runFirstReadAudit(limit);
}

export async function executeRecommendationsGeneration(audit?: FirstReadAuditReport): Promise<FirstReadRecommendationsReport> {
  const auditReport = audit || (await runFirstReadAudit(100));
  return await generateFirstReadRecommendations(auditReport);
}
