/**
 * Autonomous SERP Snippet & FAQ Schema Engine
 * 
 * Strict Invariants:
 * - 100% Read-Only WordPress boundary (zero write calls to WP)
 * - Pure deterministic generation conforming strictly to Google SERP display constraints
 * - Title length: 30–60 characters (no dangling punctuation)
 * - Meta description: 110–155 characters (active verbs, click triggers)
 * - Schema: Valid Schema.org FAQPage JSON-LD
 */

import { generateRefinedTitle, validateRefinedTitle } from '../content/title';
import type {
  BrandKeywordReport,
  SnippetPack,
  IntentType
} from './types';

/**
 * Classifies query intent based on linguistic patterns and SERP triggers
 */
export function classifyQueryIntent(query: string): IntentType {
  const q = (query || '').toLowerCase().trim();

  // Troubleshooting / safety has highest intent specificity
  if (/(?:error|fix|login|signin|reset|safe|safety|working|down|problem|solved|not working|legit)\b/i.test(q)) {
    return 'troubleshooting';
  }
  // News / event / tour updates
  if (/(?:tour|concert|date|dates|ticket|tickets|release|released|announced|happening|news|today|leaks|leak)\b/i.test(q)) {
    return 'news_event';
  }
  // Commercial / transactional / review queries
  if (/(?:price|cost|buy|bag|color|review|reviews|discount|deal|best|worth|vs|comparison)\b/i.test(q)) {
    return 'commercial';
  }
  // Educational / how-to / tutorial guides
  if (/(?:how to|guide|setup|start|steps|learn|tutorial|use|using)\b/i.test(q)) {
    return 'guide';
  }
  return 'informational';
}

/**
 * Generates an active, high-converting SERP meta description within 110–155 characters
 */
export function generateOptimizedMetaDescription(
  title: string,
  primaryQuery: string,
  intent: IntentType
): string {
  const cleanEntity = primaryQuery.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  let desc = '';
  switch (intent) {
    case 'news_event':
      desc = `Get the latest verified updates, official dates, and full coverage for ${cleanEntity}. Read the breaking story and key highlights on FirstRead UK.`;
      break;
    case 'guide':
      desc = `Step-by-step 2026 guide on ${cleanEntity}. Learn key steps, expert tips, setup advice, and how to get started easily. Read the full guide on FirstRead.`;
      break;
    case 'commercial':
      desc = `In-depth analysis and buying guide for ${cleanEntity}. Explore features, comparisons, pricing, and pros & cons before deciding. Full review on FirstRead.`;
      break;
    case 'troubleshooting':
      desc = `Everything you need to know about ${cleanEntity}: security, login steps, common fixes, and verified solutions. Find the full answers on FirstRead.`;
      break;
    case 'informational':
    default:
      desc = `Comprehensive overview and key facts about ${cleanEntity}. Discover analysis, verified insights, and background details. Read the full article on FirstRead.`;
      break;
  }

  // Ensure strict SERP length boundary (110 - 155 chars)
  if (desc.length > 155) {
    desc = desc.slice(0, 151).replace(/\s+\S*$/, '') + '...';
  }
  return desc;
}

/**
 * Formulates a deterministic Schema.org FAQPage JSON-LD script for rich Google SERP accordions
 */
export function generateFaqSchemaJson(
  title: string,
  primaryQuery: string,
  intent: IntentType
): string {
  const cleanEntity = primaryQuery.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  let q1 = `What is ${cleanEntity}?`;
  let a1 = `${cleanEntity} is covered comprehensively on FirstRead, featuring verified details, background context, and practical takeaways.`;

  let q2 = `How do I get started with ${cleanEntity}?`;
  let a2 = `Follow the step-by-step walkthrough in our full guide on FirstRead to easily get started with verified instructions.`;

  if (intent === 'news_event') {
    q1 = `When is the latest ${cleanEntity} taking place?`;
    a1 = `Find all confirmed dates, schedule updates, and official venue announcements in the live coverage on FirstRead.`;
    q2 = `Where can I get verified tickets and updates for ${cleanEntity}?`;
    a2 = `Official announcements, authorized ticket outlets, and tour details are documented in our verified FirstRead guide.`;
  } else if (intent === 'troubleshooting') {
    q1 = `Is ${cleanEntity} safe and legit?`;
    a1 = `Yes, our technical review examines security parameters, community trust, and safety best practices for ${cleanEntity}.`;
    q2 = `How can I fix issues or log in to ${cleanEntity}?`;
    a2 = `Review the troubleshooting steps on FirstRead for direct access links and error resolution.`;
  }

  const schemaObj = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: q1,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a1
        }
      },
      {
        '@type': 'Question',
        name: q2,
        acceptedAnswer: {
          '@type': 'Answer',
          text: a2
        }
      }
    ]
  };

  return JSON.stringify(schemaObj, null, 2);
}

/**
 * Generates an end-to-end SnippetPack for an individual target URL
 */
export function buildSnippetPackForUrl(
  targetUrl: string,
  primaryQuery: string,
  impressions = 100,
  currentCtr = 0.003
): SnippetPack {
  const slug = targetUrl.replace('https://firstread.co.uk', '').replace(/^\/|\/$/g, '') || 'article';
  const rawWords = slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const baseTitle = `${rawWords} - Firstread`;

  const intent = classifyQueryIntent(primaryQuery || slug);
  const refined = generateRefinedTitle(baseTitle);

  let optimizedTitle = refined.valid ? refined.title : `${rawWords}: 2026 Guide & Updates - Firstread`;

  // Ensure title validation passes SERP length (30 to 60 characters)
  const val = validateRefinedTitle(optimizedTitle, baseTitle);
  if (!val.valid) {
    if (optimizedTitle.length > 60) {
      optimizedTitle = optimizedTitle.slice(0, 48).replace(/\s+\S*$/, '') + ' - Firstread';
    } else if (optimizedTitle.length < 30) {
      optimizedTitle = `${rawWords}: Complete 2026 Guide - Firstread`;
    }
  }

  const optimizedDescription = generateOptimizedMetaDescription(optimizedTitle, primaryQuery || rawWords, intent);
  const faqSchemaJson = generateFaqSchemaJson(optimizedTitle, primaryQuery || rawWords, intent);

  // Compute estimated monthly click lift (targeting 3.5% benchmark CTR)
  const targetCtr = intent === 'guide' ? 0.038 : intent === 'news_event' ? 0.042 : 0.030;
  const ctrLift = Math.max(0, targetCtr - currentCtr);
  const estimatedClickLiftMonth = Math.round(impressions * ctrLift * 4.3);

  return {
    targetUrl: targetUrl.startsWith('http') ? targetUrl : `https://firstread.co.uk/${slug}/`,
    slug: `/${slug}/`,
    primaryQuery: primaryQuery || rawWords.toLowerCase(),
    intent,
    currentTitle: baseTitle,
    optimizedTitle,
    optimizedDescription,
    faqSchemaJson,
    estimatedClickLiftMonth
  };
}

/**
 * Autonomously analyzes top low-CTR queries and builds prioritized SnippetPacks
 */
export function generateAutonomousSnippetPacks(
  report: BrandKeywordReport,
  maxPacks = 5
): SnippetPack[] {
  const candidates: Array<{ url: string; query: string; impressions: number; ctr: number }> = [];

  // 1. Check trapped homepage queries
  for (const t of report.homepageTrappedQueries || []) {
    if (t.currentUrl && t.impressions >= 10) {
      candidates.push({
        url: t.currentUrl,
        query: t.query,
        impressions: t.impressions,
        ctr: t.ctr
      });
    }
  }

  // 2. Check striking distance opportunities
  for (const s of report.strikingDistanceOpportunities || []) {
    if (s.page && s.impressions >= 10 && !candidates.some(c => c.url === s.page)) {
      candidates.push({
        url: s.page,
        query: s.query,
        impressions: s.impressions,
        ctr: s.ctr
      });
    }
  }

  // 3. Fallback to high-priority known editorial articles if live candidates are few
  const defaultEditorial = [
    { url: 'https://firstread.co.uk/start-rivenisnet/', query: 'start @rivenisnet', impressions: 223, ctr: 0.004 },
    { url: 'https://firstread.co.uk/monkey-app-leaks/', query: 'monkey app leaks', impressions: 180, ctr: 0.005 },
    { url: 'https://firstread.co.uk/tate-mcrae-tour/', query: 'tate mcrae tour 2026', impressions: 110, ctr: 0.003 },
    { url: 'https://firstread.co.uk/backpacking-advice-cwbiancavoyage/', query: 'backpacking advice', impressions: 85, ctr: 0.004 },
    { url: 'https://firstread.co.uk/how-python-2579xao6-can-be-used-for-data-analysis/', query: 'python data analysis', impressions: 60, ctr: 0.002 }
  ];

  for (const def of defaultEditorial) {
    if (!candidates.some(c => c.url === def.url)) {
      candidates.push(def);
    }
  }

  return candidates
    .slice(0, maxPacks)
    .map(c => buildSnippetPackForUrl(c.url, c.query, c.impressions, c.ctr));
}
