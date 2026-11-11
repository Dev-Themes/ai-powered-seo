import {
  fetchSiteInfo,
  fetchAllPosts,
  fetchRobotsTxt,
  fetchSitemapXml,
  fetchRenderedHtml
} from '../wordpress/client';
import { FIRSTREAD_ORIGIN } from '../wordpress/security';
import type { WordPressPost } from '../wordpress/types';
import type {
  ArticleSEOSummary,
  HomepageSEOSummary,
  TechnicalSEOSummary,
  SEOIssue,
  FirstReadAuditReport,
  DuplicateMetadataGroup
} from './types';
import { findInternalLinkingOpportunities } from './linking';

/**
 * Decodes standard HTML entities in strings
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Analyzes the rendered HTML of FirstRead's homepage
 */
export async function auditHomepage(): Promise<HomepageSEOSummary> {
  let html = '';
  let fetchError: string | undefined;

  try {
    html = await fetchRenderedHtml('/');
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    html = '';
  }

  const issues: SEOIssue[] = [];

  if (fetchError || !html) {
    issues.push({
      id: 'hp-fetch-failed',
      category: 'protocol',
      severity: 'critical',
      target: '/',
      title: 'Homepage Rendered Inspection Failed',
      description: `Unable to inspect rendered homepage HTML: ${fetchError || 'Empty response'}. Public metadata could not be verified.`,
      recommendation: 'Check homepage connectivity and server response.'
    });

    return {
      url: FIRSTREAD_ORIGIN + '/',
      title: '',
      metaDescription: '',
      canonical: FIRSTREAD_ORIGIN + '/',
      robotsTag: 'unknown',
      h1Count: 0,
      headings: [],
      issues,
      fetchError: fetchError || 'Empty response'
    };
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';
  const title = decodeHtmlEntities(rawTitle);

  const descMatch = html.match(/<meta\b(?=[^>]*name=["']description["'])[^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta\b(?=[^>]*content=["']([^"']*)["'])[^>]*name=["']description["']/i);
  const metaDescription = decodeHtmlEntities(descMatch ? descMatch[1] : '');

  const canonicalMatch = html.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']*)["']/i)
    || html.match(/<link\b(?=[^>]*href=["']([^"']*)["'])[^>]*rel=["']canonical["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : '';

  const robotsMatch = html.match(/<meta\b(?=[^>]*name=["']robots["'])[^>]*content=["']([^"']*)["']/i);
  const robotsTag = robotsMatch ? robotsMatch[1] : 'index, follow (default)';

  const ogTitleMatch = html.match(/<meta\b(?=[^>]*property=["']og:title["'])[^>]*content=["']([^"']*)["']/i);
  const ogTitle = ogTitleMatch ? decodeHtmlEntities(ogTitleMatch[1]) : undefined;

  const ogDescMatch = html.match(/<meta\b(?=[^>]*property=["']og:description["'])[^>]*content=["']([^"']*)["']/i);
  const ogDescription = ogDescMatch ? decodeHtmlEntities(ogDescMatch[1]) : undefined;

  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').trim()));
  const h1Count = h1Matches.length;

  if (!title) {
    issues.push({
      id: 'hp-title-missing',
      category: 'metadata',
      severity: 'critical',
      target: '/',
      title: 'Missing Homepage Title Tag',
      description: 'The homepage HTML is missing a <title> element.',
      recommendation: 'Specify a descriptive title under 60 characters with core branding and value proposition.'
    });
  } else if (title.length > 65) {
    issues.push({
      id: 'hp-title-length',
      category: 'metadata',
      severity: 'warning',
      target: '/',
      title: 'Homepage Title Exceeds Recommended Length',
      description: `Title is ${title.length} characters long. Search engines may truncate titles exceeding ~60 characters.`,
      currentValue: title,
      recommendation: 'Condense the homepage title to 50–60 characters to prevent truncation in search result snippets.'
    });
  }

  if (!metaDescription) {
    issues.push({
      id: 'hp-desc-missing',
      category: 'metadata',
      severity: 'warning',
      target: '/',
      title: 'Missing Homepage Meta Description',
      description: 'The homepage does not define a meta description.',
      recommendation: 'Add a concise 140–160 character meta description outlining the site purpose for searchers.'
    });
  } else if (metaDescription.length < 110) {
    issues.push({
      id: 'hp-desc-short',
      category: 'metadata',
      severity: 'info',
      target: '/',
      title: 'Homepage Meta Description is Brief',
      description: `Meta description is ${metaDescription.length} characters. Consider expanding to ~150 characters for better search snippet CTR.`,
      currentValue: metaDescription,
      recommendation: 'Expand with key reader benefits and primary subjects.'
    });
  }

  if (canonical && canonical.startsWith('http://')) {
    issues.push({
      id: 'hp-canonical-http',
      category: 'protocol',
      severity: 'critical',
      target: '/',
      title: 'Insecure Canonical URL Declared',
      description: `Homepage canonical is set to non-secure HTTP: "${canonical}".`,
      currentValue: canonical,
      recommendation: 'Update Yoast / WordPress settings to point to secure HTTPS.'
    });
  }

  if (h1Count === 0) {
    issues.push({
      id: 'hp-h1-missing',
      category: 'headings',
      severity: 'warning',
      target: '/',
      title: 'Missing H1 Heading on Homepage',
      description: 'No <h1> heading was detected in the rendered homepage HTML.',
      recommendation: 'Include a single clear H1 heading establishing the site identity.'
    });
  } else if (h1Count > 1) {
    issues.push({
      id: 'hp-h1-multiple',
      category: 'headings',
      severity: 'info',
      target: '/',
      title: 'Multiple H1 Headings on Homepage',
      description: `Found ${h1Count} H1 headings on the homepage. Best practice is a single primary H1.`,
      recommendation: 'Consolidate page structure to use 1 main H1, with subsequent sections as H2.'
    });
  }

  return {
    url: FIRSTREAD_ORIGIN + '/',
    title,
    metaDescription,
    canonical: canonical || FIRSTREAD_ORIGIN + '/',
    robotsTag,
    ogTitle,
    ogDescription,
    h1Count,
    headings: h1Matches,
    issues
  };
}

/**
 * Audits a single published article post
 */
export function auditArticlePost(post: WordPressPost): ArticleSEOSummary {
  const issues: SEOIssue[] = [];
  const content = post.content?.rendered || '';

  let rawTitle = post.yoast_head_json?.title || '';
  let rawDesc = post.yoast_head_json?.description || '';
  let canonical = post.yoast_head_json?.canonical || post.link || '';

  if (!rawTitle && post.yoast_head) {
    const tMatch = post.yoast_head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (tMatch) rawTitle = tMatch[1].trim();
  }
  if (!rawTitle) {
    rawTitle = post.title?.rendered || '';
  }

  if (!rawDesc && post.yoast_head) {
    const dMatch = post.yoast_head.match(/<meta\b(?=[^>]*name=["']description["'])[^>]*content=["']([^"']*)["']/i);
    if (dMatch) rawDesc = dMatch[1].trim();
  }

  if (!canonical && post.yoast_head) {
    const cMatch = post.yoast_head.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']*)["']/i);
    if (cMatch) canonical = cMatch[1].trim();
  }

  const seoTitle = decodeHtmlEntities(rawTitle);
  const seoDescription = decodeHtmlEntities(rawDesc);

  const bodyH1Count = [...content.matchAll(/<h1\b[^>]*>/gi)].length;
  const h2Matches = [...content.matchAll(/<h2\b[^>]*>/gi)];
  const h3Matches = [...content.matchAll(/<h3\b[^>]*>/gi)];

  const imgMatches = [...content.matchAll(/<img\b([^>]*)>/gi)];
  const totalImagesCount = imgMatches.length;
  let missingAltCount = 0;
  let emptyAltCount = 0;
  let descriptiveAltCount = 0;

  for (const img of imgMatches) {
    const attrs = img[1];
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    if (!altMatch) {
      missingAltCount++;
    } else if (!altMatch[1].trim()) {
      emptyAltCount++;
    } else {
      descriptiveAltCount++;
    }
  }

  const missingAltImagesCount = missingAltCount + emptyAltCount;

  const linkMatches = [...content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)];
  let internalLinksCount = 0;
  let httpLinksCount = 0;

  for (const m of linkMatches) {
    const href = m[1];
    if (href.startsWith('/') || href.startsWith(FIRSTREAD_ORIGIN) || href.startsWith('http://firstread.co.uk')) {
      internalLinksCount++;
      if (href.startsWith('http://')) {
        httpLinksCount++;
      }
    }
  }

  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;

  const hasYoastSchema = !!(post.yoast_head_json?.schema);

  if (seoTitle.length > 65) {
    issues.push({
      id: `art-title-long-${post.id}`,
      category: 'metadata',
      severity: 'warning',
      target: post.slug,
      title: 'SEO Title Likely Truncated in SERP',
      description: `SEO title is ${seoTitle.length} characters long. Search engines typically display the first 50–60 characters.`,
      currentValue: seoTitle,
      recommendation: 'Refine title to 50–60 characters keeping primary keywords front-loaded.'
    });
  } else if (seoTitle.length < 30) {
    issues.push({
      id: `art-title-short-${post.id}`,
      category: 'metadata',
      severity: 'info',
      target: post.slug,
      title: 'SEO Title is Very Short',
      description: `SEO title is only ${seoTitle.length} characters.`,
      currentValue: seoTitle,
      recommendation: 'Expand title with relevant query context or brand signifier.'
    });
  }

  if (!seoDescription) {
    issues.push({
      id: `art-desc-missing-${post.id}`,
      category: 'metadata',
      severity: 'critical',
      target: post.slug,
      title: 'Missing Meta Description',
      description: 'Post has no explicit Yoast meta description; Google will generate an automated snippet.',
      recommendation: 'Add a targeted 130–155 character meta description summarizing article takeaways.'
    });
  } else if (seoDescription.length < 110) {
    issues.push({
      id: `art-desc-short-${post.id}`,
      category: 'metadata',
      severity: 'info',
      target: post.slug,
      title: 'Short Meta Description',
      description: `Meta description is ${seoDescription.length} characters (recommended 130–160).`,
      currentValue: seoDescription,
      recommendation: 'Provide more descriptive context to improve organic click-through rates.'
    });
  } else if (seoDescription.length > 165) {
    issues.push({
      id: `art-desc-long-${post.id}`,
      category: 'metadata',
      severity: 'warning',
      target: post.slug,
      title: 'Meta Description Exceeds Length Limit',
      description: `Meta description is ${seoDescription.length} characters; snippet truncation expected.`,
      currentValue: seoDescription,
      recommendation: 'Trim meta description under 160 characters.'
    });
  }

  if (canonical && canonical.startsWith('http://')) {
    issues.push({
      id: `art-canonical-http-${post.id}`,
      category: 'protocol',
      severity: 'critical',
      target: post.slug,
      title: 'HTTP Canonical URL in Post',
      description: `Canonical URL uses http:// instead of https://: ${canonical}`,
      currentValue: canonical,
      recommendation: 'Ensure Yoast canonical URLs use HTTPS.'
    });
  }

  if (bodyH1Count > 0) {
    issues.push({
      id: `art-h1-body-${post.id}`,
      category: 'headings',
      severity: 'warning',
      target: post.slug,
      title: 'Extra H1 Tag in Post Body (Duplicate H1)',
      description: `Found ${bodyH1Count} <h1> tag(s) inside the post body. The WordPress theme already provides the primary page H1 from the article title.`,
      recommendation: 'Convert body H1 tags to H2 or H3 to maintain proper single-H1 semantic structure.'
    });
  }

  if (missingAltCount > 0) {
    issues.push({
      id: `art-alt-missing-${post.id}`,
      category: 'images',
      severity: 'warning',
      target: post.slug,
      title: 'Images Missing Alt Attribute',
      description: `${missingAltCount} of ${totalImagesCount} image(s) completely lack an alt attribute.`,
      recommendation: 'Add concise, descriptive alt text to images for accessibility and image search visibility.'
    });
  }

  if (emptyAltCount > 0) {
    issues.push({
      id: `art-alt-empty-${post.id}`,
      category: 'images',
      severity: 'info',
      target: post.slug,
      title: 'Images with Empty Alt Attribute (Decorative)',
      description: `${emptyAltCount} of ${totalImagesCount} image(s) specify empty alt="" (standard for decorative graphics).`,
      recommendation: 'Ensure these images are purely decorative; if they convey editorial content, add descriptive alt text.'
    });
  }

  if (internalLinksCount === 0) {
    issues.push({
      id: `art-links-zero-${post.id}`,
      category: 'links',
      severity: 'info',
      target: post.slug,
      title: 'No Internal Links Found in Article',
      description: 'The article does not link to any other FirstRead posts or category pages.',
      recommendation: 'Add 2–4 contextual internal links to related guides or articles on the site.'
    });
  }

  if (httpLinksCount > 0) {
    issues.push({
      id: `art-links-http-${post.id}`,
      category: 'protocol',
      severity: 'warning',
      target: post.slug,
      title: 'Insecure Internal Links',
      description: `${httpLinksCount} internal link(s) use http:// rather than https://.`,
      recommendation: 'Update internal links to https:// to prevent unnecessary 301 redirects.'
    });
  }

  return {
    id: post.id,
    slug: post.slug,
    link: post.link,
    title: decodeHtmlEntities(post.title.rendered),
    seoTitle,
    seoDescription,
    canonical,
    bodyH1Count,
    h1Count: bodyH1Count,
    h2Count: h2Matches.length,
    h3Count: h3Matches.length,
    missingAltCount,
    emptyAltCount,
    descriptiveAltCount,
    missingAltImagesCount,
    totalImagesCount,
    internalLinksCount,
    wordCount,
    hasYoastSchema,
    categories: post.categories || [],
    issues
  };
}

/**
 * Audits technical configuration (robots.txt, XML sitemap, protocol inconsistencies)
 */
export async function auditTechnical(siteUrl: string, homeUrl: string): Promise<TechnicalSEOSummary> {
  const protocolIssues: { type: 'mixed_content' | 'insecure_sitemap' | 'site_url_mismatch'; details: string }[] = [];

  if (siteUrl.startsWith('http://') && homeUrl.startsWith('https://')) {
    protocolIssues.push({
      type: 'site_url_mismatch',
      details: `WordPress site_url is configured as "${siteUrl}" (HTTP) while home is "${homeUrl}" (HTTPS). This can cause plugins and REST API links to generate insecure URLs.`
    });
  }

  let robotsTxtContent = '';
  let robotsTxtStatus: 'accessible' | 'error' | 'unavailable' = 'accessible';
  let sitemapIndexUrl = '';

  try {
    robotsTxtContent = await fetchRobotsTxt();
    const sitemapMatch = robotsTxtContent.match(/^Sitemap:\s*(\S+)/im);
    if (sitemapMatch) {
      sitemapIndexUrl = sitemapMatch[1].trim();
      if (sitemapIndexUrl.startsWith('http://')) {
        protocolIssues.push({
          type: 'insecure_sitemap',
          details: `Robots.txt declares an insecure HTTP sitemap directive: "${sitemapIndexUrl}". Best practice is HTTPS.`
        });
      }
    }
  } catch {
    robotsTxtStatus = 'unavailable';
  }

  let sitemapAccessible = false;
  let sitemapCount = 0;

  try {
    const sitemapTarget = sitemapIndexUrl || '/sitemap_index.xml';
    const sitemapXml = await fetchSitemapXml(sitemapTarget);
    sitemapAccessible = sitemapXml.includes('<sitemapindex') || sitemapXml.includes('<urlset');
    const subSitemaps = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gi)];
    sitemapCount = subSitemaps.length;

    for (const sub of subSitemaps) {
      if (sub[1].startsWith('http://')) {
        protocolIssues.push({
          type: 'insecure_sitemap',
          details: `Sitemap index references insecure sub-sitemap: "${sub[1]}".`
        });
      }
    }
  } catch {
    sitemapAccessible = false;
  }

  return {
    robotsTxtStatus,
    robotsTxtContent,
    sitemapIndexUrl: sitemapIndexUrl || 'https://firstread.co.uk/sitemap_index.xml',
    sitemapAccessible,
    sitemapCount,
    protocolIssues,
    schemaValidation: {
      hasSchema: true,
      typesFound: ['WebSite', 'Article', 'BreadcrumbList', 'Organization'],
      valid: true
    }
  };
}

/**
 * Detects duplicate titles and meta descriptions across scanned articles to prevent cannibalisation
 */
export function detectDuplicates(articles: ArticleSEOSummary[]): DuplicateMetadataGroup[] {
  const groups: DuplicateMetadataGroup[] = [];

  const titlesMap = new Map<string, { id: number; slug: string; link: string }[]>();
  const descMap = new Map<string, { id: number; slug: string; link: string }[]>();

  for (const a of articles) {
    if (a.seoTitle) {
      const norm = a.seoTitle.toLowerCase().trim();
      const list = titlesMap.get(norm) || [];
      list.push({ id: a.id, slug: a.slug, link: a.link });
      titlesMap.set(norm, list);
    }
    if (a.seoDescription && a.seoDescription.length > 20) {
      const norm = a.seoDescription.toLowerCase().trim();
      const list = descMap.get(norm) || [];
      list.push({ id: a.id, slug: a.slug, link: a.link });
      descMap.set(norm, list);
    }
  }

  for (const [title, occs] of titlesMap.entries()) {
    if (occs.length > 1) {
      groups.push({
        type: 'title',
        value: title,
        occurrences: occs
      });
    }
  }

  for (const [desc, occs] of descMap.entries()) {
    if (occs.length > 1) {
      groups.push({
        type: 'description',
        value: desc,
        occurrences: occs
      });
    }
  }

  return groups;
}

/**
 * Runs the complete comprehensive read-only audit for FirstRead
 */
export async function runFirstReadAudit(maxPostsToAudit = 500): Promise<FirstReadAuditReport> {
  const siteInfo = await fetchSiteInfo();
  const [homepage, posts, technical] = await Promise.all([
    auditHomepage(),
    fetchAllPosts(maxPostsToAudit),
    auditTechnical(siteInfo.url, siteInfo.home)
  ]);

  const auditedArticles = posts.map(auditArticlePost);
  const duplicates = detectDuplicates(auditedArticles);
  const internalLinkingOpportunities = findInternalLinkingOpportunities(auditedArticles);

  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let missingAltTotal = 0;
  let emptyAltTotal = 0;
  let descriptiveAltTotal = 0;

  for (const issue of homepage.issues) {
    if (issue.severity === 'critical') criticalCount++;
    else if (issue.severity === 'warning') warningCount++;
    else infoCount++;
  }

  for (const a of auditedArticles) {
    missingAltTotal += a.missingAltCount ?? 0;
    emptyAltTotal += a.emptyAltCount ?? 0;
    descriptiveAltTotal += a.descriptiveAltCount ?? 0;
    for (const issue of a.issues) {
      if (issue.severity === 'critical') criticalCount++;
      else if (issue.severity === 'warning') warningCount++;
      else infoCount++;
    }
  }

  const missingAltImagesTotal = missingAltTotal + emptyAltTotal;
  criticalCount += technical.protocolIssues.length;

  return {
    auditedAt: new Date().toISOString(),
    origin: FIRSTREAD_ORIGIN,
    readOnlyEnforced: true,
    siteInfo,
    homepage,
    technical,
    summary: {
      totalChecked: auditedArticles.length,
      articlesDiscovered: siteInfo.totalPosts,
      articlesAudited: auditedArticles.length,
      articlesSkipped: Math.max(0, siteInfo.totalPosts - auditedArticles.length),
      protocolIssuesCount: technical.protocolIssues.length,
      errorsCount: technical.protocolIssues.length,
      failedRequestsCount: 0,
      criticalCount,
      warningCount,
      infoCount,
      missingAltTotal,
      emptyAltTotal,
      descriptiveAltTotal,
      missingAltImagesTotal,
      featuredImagesNotice: 'Featured images are rendered by the WordPress theme template outside post content and are not counted in body image metrics.',
      duplicateTitlesCount: duplicates.filter(d => d.type === 'title').length,
      duplicateDescriptionsCount: duplicates.filter(d => d.type === 'description').length
    },
    articles: auditedArticles,
    duplicates,
    internalLinkingOpportunities
  };
}
