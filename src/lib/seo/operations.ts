import { GoogleGenAI } from '@google/genai';
import { runFirstReadAudit } from './audit';
import { generateFirstReadRecommendations } from '../content/ai';
import type { FirstReadAuditReport } from './types';
import type { FirstReadRecommendationsReport } from '../content/types';

// =============================================================================
// OPERATION RESULT INTERFACES
// =============================================================================

export interface KeywordResearchResult {
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

export interface CompetitorAnalysisResult {
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

export interface SearchIntentResult {
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

export interface ContentGapResult {
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

export interface TopicClusterResult {
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

export interface SEOStrategyResult {
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

export interface ArticleResearchResult {
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
}

export interface ArticleGenerationResult {
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

export interface ArticleQAResult {
  generatedAt: string;
  source: 'gemini' | 'heuristic';
  overallScore: number;
  passed: boolean;
  intentMatchScore: number;
  readabilityScore: number;
  originalityScore: number;
  headingAudit: {
    hasSingleH1: boolean;
    h2Count: number;
    h3Count: number;
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

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// =============================================================================
// 1. KEYWORD RESEARCH
// =============================================================================

export async function executeKeywordResearch(seed = 'uk property investment'): Promise<KeywordResearchResult> {
  const gemini = getGeminiClient();

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
          seed,
          isEstimated: true,
          dataSourceNotice: 'Search volumes and difficulty scores are AI-generated market estimates. Connect Google Keyword Planner or DataForSEO API for verified third-party search volumes.',
          keywords: parsed.keywords
        };
      }
    } catch {
      // Fallback below
    }
  }

  // Deterministic fallback
  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
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
      if (parsed.competitors) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          targetDomain: domain,
          isEstimated: true,
          dataSourceNotice: 'Competitor authority scores and shared topic models are AI-generated competitive projections. Connect a live backlink API (e.g. Ahrefs, SEMrush) for verified third-party authority metrics.',
          competitors: parsed.competitors,
          summary: parsed.summary || 'Competitor gap analysis successfully compiled.'
        };
      }
    } catch {
      // Fallback below
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
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
      if (Array.isArray(parsed.results)) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          results: parsed.results
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
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
      if (Array.isArray(parsed.gaps)) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          gaps: parsed.gaps
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
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
      if (parsed.pillarPage && Array.isArray(parsed.clusterArticles)) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          pillarTopic,
          pillarPage: parsed.pillarPage,
          clusterArticles: parsed.clusterArticles,
          linkingArchitecture: parsed.linkingArchitecture || 'Hub-and-spoke internal linking architecture'
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
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
          strategicFocus: parsed.strategicFocus || focus,
          phase1ImmediateFixes: parsed.phase1ImmediateFixes,
          phase2ContentExpansion: parsed.phase2ContentExpansion || [],
          phase3AuthorityGrowth: parsed.phase3AuthorityGrowth || [],
          projectedOrganicOutcomes: parsed.projectedOrganicOutcomes || []
        };
      }
    } catch {
      // Fallback below
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
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

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `Conduct editorial SEO research for an article about "${topic}" for FirstRead (https://firstread.co.uk).
Provide primary keyword, secondary keywords, search intent, target word count, and an H2/H3 outline with key points.
Return JSON:
{
  "topic": "${topic}",
  "primaryKeyword": string,
  "secondaryKeywords": string[],
  "searchIntent": string,
  "recommendedWordCount": number,
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
      if (parsed.outline) {
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          topic,
          primaryKeyword: parsed.primaryKeyword || topic,
          secondaryKeywords: parsed.secondaryKeywords || [],
          searchIntent: parsed.searchIntent || 'Informational',
          recommendedWordCount: parsed.recommendedWordCount || 1200,
          outline: parsed.outline,
          internalLinkTargets: parsed.internalLinkTargets || []
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    topic,
    primaryKeyword: `${topic.toLowerCase()}`,
    secondaryKeywords: ['uk housing market forecast', 'interest rates property impact', 'regional house price growth'],
    searchIntent: 'Informational & Commercial Research',
    recommendedWordCount: 1400,
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

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: DEFAULT_MODEL,
        contents: `You are an expert editorial writer for FirstRead (https://firstread.co.uk).
Write a high quality, fact-checked, SEO-optimized article on topic: "${topic}" with primary keyword: "${primaryKeyword}".
Include an engaging title (under 60 chars), meta description (under 155 chars), clean HTML content with H2/H3 tags and paragraphs, and image prompts with descriptive alt text.
Return JSON:
{
  "title": string,
  "slug": string,
  "metaDescription": string,
  "excerpt": string,
  "primaryKeyword": "${primaryKeyword}",
  "secondaryKeywords": string[],
  "estimatedReadTimeMinutes": number,
  "wordCount": number,
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
        return {
          generatedAt: new Date().toISOString(),
          source: 'gemini',
          title: parsed.title,
          slug: parsed.slug,
          metaDescription: parsed.metaDescription,
          excerpt: parsed.excerpt,
          primaryKeyword,
          secondaryKeywords: parsed.secondaryKeywords || [],
          estimatedReadTimeMinutes: parsed.estimatedReadTimeMinutes || 5,
          wordCount: parsed.wordCount || 1100,
          htmlContent: parsed.htmlContent,
          imageBriefs: parsed.imageBriefs || []
        };
      }
    } catch {
      // Fallback
    }
  }

  const title = `${topic}: Strategic Insights for UK Investors`;
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const metaDescription = `Explore critical ${primaryKeyword} with expert analysis of regional yields, regulatory updates, and investor strategies across the UK.`;

  return {
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    title,
    slug,
    metaDescription,
    excerpt: `A detailed analysis of ${primaryKeyword}, exploring recent shifts in mortgage lending, regional yields, and long-term investor considerations.`,
    primaryKeyword,
    secondaryKeywords: ['uk property yields', 'landlord strategies', 'housing forecast'],
    estimatedReadTimeMinutes: 5,
    wordCount: 1150,
    htmlContent: `<h2>Understanding Current ${topic}</h2>
<p>The UK property sector continues to demonstrate resilience despite fluctuating macroeconomic headwinds and shifting fiscal policies. For investors and homeowners alike, understanding the structural dynamics of ${primaryKeyword} is essential for making sound financial decisions.</p>

<h2>Key Regional Growth Indicators</h2>
<p>While central London has traditionally dominated headlines, regional urban hubs across the Midlands and the North West have steadily produced superior rental yields. Commuter towns across the South East also present attractive combinations of capital appreciation and steady tenant demand.</p>

<h3>Navigating Legislative &amp; Regulatory Changes</h3>
<p>Landlords face an evolving regulatory environment, particularly regarding energy efficiency standards and tenant legislation. Ensuring portfolios are proactively managed will separate high-performing investments from vulnerable assets.</p>

<h2>Conclusion</h2>
<p>By remaining informed and focusing on regional fundamentals, investors can navigate the modern UK landscape with confidence and clarity.</p>`,
    imageBriefs: [
      {
        placement: 'Featured Header',
        suggestedAltText: 'Modern UK residential apartment building with sunny skyline',
        visualPrompt: 'High quality architectural photography of modern residential UK brick apartment complex, natural daylight.'
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
  let score = 100;

  // Title validation
  const titleLen = title.length;
  let titleValid = true;
  if (titleLen < 30 || titleLen > 65) {
    titleValid = false;
    score -= 10;
    remediation.push(`Title length (${titleLen} chars) is outside optimal 30-65 character SERP display window.`);
  }

  // Meta description validation
  const metaLen = metaDescription.length;
  let metaValid = true;
  if (metaLen < 80 || metaLen > 160) {
    metaValid = false;
    score -= 10;
    remediation.push(`Meta description length (${metaLen} chars) is outside optimal 80-160 character snippet window.`);
  }

  // Heading hierarchy
  const h1Matches = content.match(/<h1[^>]*>/gi) || [];
  const h2Matches = content.match(/<h2[^>]*>/gi) || [];
  const h3Matches = content.match(/<h3[^>]*>/gi) || [];

  if (h1Matches.length > 0) {
    score -= 15;
    remediation.push('Article body contains an explicit <h1> tag. Headings in content body should start at <h2> to prevent duplicate H1 conflicts with WordPress theme template.');
  }

  if (h2Matches.length < 2) {
    score -= 10;
    remediation.push('Article contains fewer than 2 <h2> headings. Structure content into logical sections for improved readability and search indexing.');
  }

  // Keyword presence
  let keywordDensity = 'optimal' as 'optimal' | 'under_represented' | 'stuffed';
  let density = 0;
  if (primaryKeyword) {
    const regex = new RegExp(primaryKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const matches = content.match(regex) || [];
    const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    density = wordCount > 0 ? (matches.length / wordCount) * 100 : 0;

    if (density < 0.3) {
      keywordDensity = 'under_represented';
      score -= 10;
      remediation.push(`Primary keyword "${primaryKeyword}" appears only ${matches.length} times (${density.toFixed(2)}% density). Naturally weave it into key headings and opening paragraphs.`);
    } else if (density > 2.5) {
      keywordDensity = 'stuffed';
      score -= 20;
      remediation.push(`Primary keyword density is high (${density.toFixed(2)}%). Reduce repetition to avoid keyword stuffing penalties.`);
    }
  }

  // Attempt Gemini semantic quality validation if API key is present
  const gemini = getGeminiClient();
  let aiIntentScore = score >= 75 ? 90 : 65;
  let aiReadabilityScore = 88;
  let aiOriginalityScore = 92;
  let source: 'gemini' | 'heuristic' = 'heuristic';

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
      }
    } catch {
      // Fallback to heuristic
    }
  }

  const structuralScore = Math.max(10, Math.min(100, score));
  const finalScore = source === 'gemini'
    ? Math.max(10, Math.min(100, Math.round(structuralScore * 0.4 + aiIntentScore * 0.3 + aiReadabilityScore * 0.3)))
    : structuralScore;

  const passed = finalScore >= 75 && titleValid && metaValid && h1Matches.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    source,
    overallScore: finalScore,
    passed,
    intentMatchScore: aiIntentScore,
    readabilityScore: aiReadabilityScore,
    originalityScore: aiOriginalityScore,
    headingAudit: {
      hasSingleH1: h1Matches.length === 0, // In body, 0 is ideal as theme supplies H1
      h2Count: h2Matches.length,
      h3Count: h3Matches.length,
      logicalStructure: h2Matches.length >= 2
    },
    metadataAudit: {
      titleLength: titleLen,
      titleValid,
      metaDescriptionLength: metaLen,
      metaDescriptionValid: metaValid
    },
    keywordIntegration: {
      densityPercentage: `${density.toFixed(2)}%`,
      status: keywordDensity
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
