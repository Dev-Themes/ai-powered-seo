import {
  createAuthorizedJWT,
  getGoogleConfig,
  getGoogleCredentials,
  sanitizeGoogleError,
  publishUrlToGoogleIndexingApi
} from '../integrations/google';
import { assertNoContentModification } from '../wordpress/security';
import type {
  UrlInspectionResult,
  SitemapAuditStatus,
  GscSitemapEntry,
  TechnicalDiscoveryIssue,
  AutonomousActionRecord
} from './types';

const TARGET_SITE = 'https://firstread.co.uk/';
const SITEMAP_INDEX_URL = 'https://firstread.co.uk/sitemap_index.xml';
const ROBOTS_TXT_URL = 'https://firstread.co.uk/robots.txt';

interface GscInspectionApiResponse {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      verdict?: 'PASS' | 'NEUTRAL' | 'FAIL' | 'UNSPECIFIED';
      coverageState?: string;
      robotsTxtState?: 'ALLOWED' | 'DISALLOWED' | 'UNSPECIFIED';
      indexingState?: 'INDEXING_ALLOWED' | 'BLOCKED_BY_META_TAG' | 'UNSPECIFIED';
      lastCrawlTime?: string;
      pageFetchState?: string;
      googleCanonical?: string;
      userCanonical?: string;
      crawledAs?: string;
    };
  };
}

interface GscSitemapsListResponse {
  sitemap?: Array<{
    path?: string;
    lastSubmitted?: string;
    isPending?: boolean;
    isSitemapsIndex?: boolean;
    lastDownloaded?: string;
    warnings?: string;
    errors?: string;
    contents?: Array<{
      type?: string;
      submitted?: string;
      indexed?: string;
    }>;
  }>;
}

/**
 * Inspects a specific URL using the Google Search Console URL Inspection API
 */
export async function inspectUrlWithGsc(url: string): Promise<UrlInspectionResult> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  const timestamp = new Date().toISOString();

  if (!creds || !config.gscSiteUrl) {
    return {
      url,
      inspectedAt: timestamp,
      verdict: 'UNSPECIFIED',
      coverageState: 'Inspection unavailable: Google credentials not configured',
      robotsTxtState: 'UNSPECIFIED',
      indexingState: 'UNSPECIFIED',
      canonicalMatches: false,
      isDiscoveredNotIndexed: false,
      isCrawledNotIndexed: false,
      issues: ['Google Cloud Service Account credentials not configured.']
    };
  }

  const jwt = createAuthorizedJWT([
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters'
  ]);

  if (!jwt) {
    return {
      url,
      inspectedAt: timestamp,
      verdict: 'UNSPECIFIED',
      coverageState: 'Inspection unavailable: JWT instantiation failed',
      robotsTxtState: 'UNSPECIFIED',
      indexingState: 'UNSPECIFIED',
      canonicalMatches: false,
      isDiscoveredNotIndexed: false,
      isCrawledNotIndexed: false,
      issues: ['Failed to create authorized JWT client.']
    };
  }

  const endpoint = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

  try {
    const res = await jwt.request<GscInspectionApiResponse>({
      url: endpoint,
      method: 'POST',
      data: {
        inspectionUrl: url,
        siteUrl: config.gscSiteUrl
      }
    });

    const indexRes = res.data?.inspectionResult?.indexStatusResult;
    const verdict = indexRes?.verdict || 'UNSPECIFIED';
    const coverage = indexRes?.coverageState || 'Unknown indexing state';
    const robotsTxtState = indexRes?.robotsTxtState || 'UNSPECIFIED';
    const indexingState = indexRes?.indexingState || 'UNSPECIFIED';
    const googleCanonical = indexRes?.googleCanonical;
    const userCanonical = indexRes?.userCanonical;

    const canonicalMatches = Boolean(
      googleCanonical && userCanonical && googleCanonical.replace(/\/$/, '') === userCanonical.replace(/\/$/, '')
    );

    const isDiscoveredNotIndexed = coverage.toLowerCase().includes('discovered') && coverage.toLowerCase().includes('not indexed');
    const isCrawledNotIndexed = coverage.toLowerCase().includes('crawled') && coverage.toLowerCase().includes('not indexed');

    const issues: string[] = [];
    if (verdict === 'FAIL') {
      issues.push(`Google URL Inspection failed with verdict: ${verdict} (${coverage})`);
    }
    if (robotsTxtState === 'DISALLOWED') {
      issues.push('Blocked by robots.txt directive.');
    }
    if (indexingState === 'BLOCKED_BY_META_TAG') {
      issues.push('Blocked by "noindex" robots meta tag or X-Robots-Tag.');
    }
    if (userCanonical && googleCanonical && !canonicalMatches) {
      issues.push(`Canonical mismatch: declared "${userCanonical}", Google selected "${googleCanonical}".`);
    }
    if (isDiscoveredNotIndexed) {
      issues.push('Google discovered URL but has not yet crawled/indexed it (backlog/budget).');
    }
    if (isCrawledNotIndexed) {
      issues.push('Crawled by Google but not indexed (content quality or duplicate evaluation).');
    }

    return {
      url,
      inspectedAt: timestamp,
      verdict,
      coverageState: coverage,
      robotsTxtState,
      indexingState,
      lastCrawlTime: indexRes?.lastCrawlTime,
      pageFetchState: indexRes?.pageFetchState,
      googleCanonical,
      userCanonical,
      canonicalMatches,
      crawledAs: indexRes?.crawledAs,
      isDiscoveredNotIndexed,
      isCrawledNotIndexed,
      issues
    };
  } catch (err) {
    const errMsg = sanitizeGoogleError(err);
    return {
      url,
      inspectedAt: timestamp,
      verdict: 'UNSPECIFIED',
      coverageState: `Inspection error: ${errMsg}`,
      robotsTxtState: 'UNSPECIFIED',
      indexingState: 'UNSPECIFIED',
      canonicalMatches: false,
      isDiscoveredNotIndexed: false,
      isCrawledNotIndexed: false,
      issues: [errMsg]
    };
  }
}

/**
 * Checks GSC for submitted sitemaps
 */
export async function fetchGscSubmittedSitemaps(): Promise<GscSitemapEntry[]> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  if (!creds || !config.gscSiteUrl) return [];

  const jwt = createAuthorizedJWT([
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters'
  ]);
  if (!jwt) return [];

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl)}/sitemaps`;

  try {
    const res = await jwt.request<GscSitemapsListResponse>({ url, method: 'GET' });
    const list = res.data?.sitemap || [];
    return list.map(item => ({
      path: item.path || '',
      lastSubmitted: item.lastSubmitted,
      isPending: item.isPending,
      isSitemapsIndex: item.isSitemapsIndex,
      lastDownloaded: item.lastDownloaded,
      warnings: Number(item.warnings || 0),
      errors: Number(item.errors || 0),
      contents: (item.contents || []).map(c => ({
        type: c.type,
        submitted: Number(c.submitted || 0),
        indexed: Number(c.indexed || 0)
      }))
    }));
  } catch (err) {
    console.warn('[Indexing Engine] Sitemaps list error:', sanitizeGoogleError(err));
    return [];
  }
}

/**
 * Submits a valid sitemap to Google Search Console
 */
export async function submitSitemapToGsc(sitemapUrl = SITEMAP_INDEX_URL): Promise<{ success: boolean; message: string }> {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();
  if (!creds || !config.gscSiteUrl) {
    return { success: false, message: 'Google credentials not configured.' };
  }

  const jwt = createAuthorizedJWT([
    'https://www.googleapis.com/auth/webmasters'
  ]);
  if (!jwt) {
    return { success: false, message: 'Failed to create JWT client with webmasters scope.' };
  }

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;

  try {
    const res = await jwt.request({
      url,
      method: 'PUT'
    });
    return {
      success: res.status >= 200 && res.status < 300,
      message: `Successfully submitted sitemap '${sitemapUrl}' to Google Search Console (HTTP ${res.status}).`
    };
  } catch (err) {
    const errMsg = sanitizeGoogleError(err);
    const isPermissionError = errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('forbidden') || errMsg.includes('403');
    const actionableMsg = isPermissionError
      ? `Permission Restricted: Service account '${creds.clientEmail}' has Viewer/Restricted permissions in GSC. Autonomous sitemap submission requires 'Full' permission in Search Console > Settings > Users & permissions. Alternatively, submit '${sitemapUrl}' once in Search Console.`
      : `Failed to submit sitemap to GSC: ${errMsg}`;

    return {
      success: false,
      message: actionableMsg
    };
  }
}

/**
 * Audits sitemap accessibility on the live web and evaluates GSC submission status
 */
export async function auditSitemapStatus(previousStatus?: SitemapAuditStatus | null): Promise<SitemapAuditStatus> {
  let accessibleOnWeb = false;
  let httpStatus = 0;
  const detectedChildSitemaps: string[] = [];

  try {
    const res = await fetch(SITEMAP_INDEX_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'FirstRead-Brand-Engine/1.0' },
      cache: 'no-store'
    });
    httpStatus = res.status;
    if (res.ok) {
      accessibleOnWeb = true;
      const text = await res.text();
      const locMatches = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)];
      for (const m of locMatches) {
        detectedChildSitemaps.push(m[1].trim());
      }
    }
  } catch {
    accessibleOnWeb = false;
  }

  const gscSitemaps = await fetchGscSubmittedSitemaps();
  const matchingGscEntry = gscSitemaps.find(
    s => s.path === SITEMAP_INDEX_URL || s.path.endsWith('/sitemap_index.xml')
  );

  const isSubmittedToGsc = Boolean(matchingGscEntry);
  let needsSubmission = false;
  let justification: string | undefined;

  if (accessibleOnWeb && !isSubmittedToGsc) {
    needsSubmission = true;
    justification = 'Primary sitemap_index.xml is accessible on web but has not been submitted to Google Search Console.';
  } else if (matchingGscEntry && (matchingGscEntry.errors ?? 0) > 0) {
    needsSubmission = true;
    justification = `Submitted sitemap has ${matchingGscEntry.errors} error(s) reported in GSC. Resubmission justified.`;
  }

  return {
    sitemapIndexUrl: SITEMAP_INDEX_URL,
    accessibleOnWeb,
    httpStatus,
    detectedChildSitemaps,
    gscSubmittedSitemaps: gscSitemaps,
    isSubmittedToGsc,
    needsSubmission,
    submissionJustification: justification,
    lastSubmissionAttempt: previousStatus?.lastSubmissionAttempt,
    lastSubmissionResult: previousStatus?.lastSubmissionResult
  };
}

/**
 * Audits robots.txt, canonical consistency, and protocol redirect on live site
 */
export async function auditTechnicalDiscovery(): Promise<TechnicalDiscoveryIssue[]> {
  const issues: TechnicalDiscoveryIssue[] = [];
  const timestamp = new Date().toISOString();

  // 1. Robots.txt audit
  try {
    const robotsRes = await fetch(ROBOTS_TXT_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'FirstRead-Brand-Engine/1.0' },
      cache: 'no-store'
    });

    if (!robotsRes.ok) {
      issues.push({
        id: `issue-robots-${Date.now()}`,
        category: 'robots',
        severity: 'critical',
        targetUrl: ROBOTS_TXT_URL,
        title: 'robots.txt Inaccessible',
        description: `Robots.txt returned HTTP ${robotsRes.status}. Googlebot requires robots.txt to crawl permitted brand assets.`,
        recommendation: 'Verify web server configuration to serve robots.txt with HTTP 200.',
        detectedAt: timestamp
      });
    } else {
      const robotsText = await robotsRes.text();
      if (/disallow:\s*\/\s*$/im.test(robotsText)) {
        issues.push({
          id: `issue-robots-block-${Date.now()}`,
          category: 'robots',
          severity: 'critical',
          targetUrl: ROBOTS_TXT_URL,
          title: 'Entire Site Disallowed in robots.txt',
          description: 'Directive "Disallow: /" detected in robots.txt, blocking Googlebot from discovering and indexing brand pages.',
          recommendation: 'Remove "Disallow: /" directive from WordPress Search Engine Visibility settings.',
          detectedAt: timestamp
        });
      }
      if (!/sitemap:/i.test(robotsText)) {
        issues.push({
          id: `issue-robots-no-sitemap-${Date.now()}`,
          category: 'robots',
          severity: 'info',
          targetUrl: ROBOTS_TXT_URL,
          title: 'Sitemap Directive Not Declared in robots.txt',
          description: 'robots.txt does not link to sitemap_index.xml for search bot discovery.',
          recommendation: `Add "Sitemap: ${SITEMAP_INDEX_URL}" to robots.txt.`,
          detectedAt: timestamp
        });
      }
    }
  } catch (err) {
    issues.push({
      id: `issue-robots-err-${Date.now()}`,
      category: 'robots',
      severity: 'warning',
      targetUrl: ROBOTS_TXT_URL,
      title: 'robots.txt Fetch Failed',
      description: `Failed to connect to robots.txt: ${err instanceof Error ? err.message : String(err)}`,
      recommendation: 'Check host DNS and firewall settings.',
      detectedAt: timestamp
    });
  }

  // 2. Protocol redirect check (HTTP to HTTPS)
  try {
    const httpRes = await fetch('http://firstread.co.uk/', {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store'
    });

    const location = httpRes.headers.get('location') || '';
    if (httpRes.status !== 301 || !location.startsWith('https://firstread.co.uk')) {
      issues.push({
        id: `issue-protocol-${Date.now()}`,
        category: 'protocol',
        severity: 'warning',
        targetUrl: 'http://firstread.co.uk/',
        title: 'HTTP to HTTPS Redirect Incomplete',
        description: `HTTP root returned status ${httpRes.status} (expected 301 Permanent Redirect to https://firstread.co.uk/).`,
        recommendation: 'Ensure web server enforces 301 redirect from HTTP to HTTPS for all brand URLs.',
        detectedAt: timestamp
      });
    }
  } catch {
    // Non-fatal if local testing environment lacks direct HTTP reachability
  }

  // 3. Homepage canonical audit
  try {
    const hpRes = await fetch(TARGET_SITE, {
      method: 'GET',
      headers: { 'User-Agent': 'FirstRead-Brand-Engine/1.0' },
      cache: 'no-store'
    });

    if (hpRes.ok) {
      const html = await hpRes.text();
      const canonicalMatch = html.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']*)["']/i);
      const canonicalHref = canonicalMatch ? canonicalMatch[1].trim() : '';

      if (!canonicalHref) {
        issues.push({
          id: `issue-canonical-missing-${Date.now()}`,
          category: 'canonical',
          severity: 'warning',
          targetUrl: TARGET_SITE,
          title: 'Homepage Canonical Tag Missing',
          description: 'Homepage HTML does not declare an explicit canonical link tag.',
          recommendation: `Add <link rel="canonical" href="${TARGET_SITE}" /> to homepage <head>.`,
          detectedAt: timestamp
        });
      } else if (canonicalHref !== TARGET_SITE && canonicalHref !== TARGET_SITE.replace(/\/$/, '')) {
        issues.push({
          id: `issue-canonical-mismatch-${Date.now()}`,
          category: 'canonical',
          severity: 'critical',
          targetUrl: TARGET_SITE,
          title: 'Homepage Canonical Target Mismatch',
          description: `Homepage declares canonical "${canonicalHref}", which differs from root domain "${TARGET_SITE}".`,
          recommendation: `Update homepage canonical to point directly to "${TARGET_SITE}".`,
          detectedAt: timestamp
        });
      }
    }
  } catch {
    // Handled gracefully
  }

  return issues;
}

/**
 * Autonomous ping notification for Google crawler to refresh sitemaps.
 */
export async function pingGoogleSitemap(sitemapUrl = SITEMAP_INDEX_URL): Promise<{ success: boolean; message: string }> {
  try {
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(pingUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeoutId);

    return {
      success: res.status >= 200 && res.status < 400,
      message: `Google Sitemap Ping returned HTTP ${res.status}.`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Google Sitemap Ping unavailable: ${msg}`
    };
  }
}

export interface BrandSchemaAuditResult {
  hasOrganizationSchema: boolean;
  hasWebSiteSchema: boolean;
  hasSearchAction: boolean;
  brandNameDetected?: string;
  issues: string[];
}

/**
 * Audits homepage JSON-LD for Organization and WebSite SearchAction schema
 * to ensure Google can award brand sitelinks and knowledge graph for 'firstread'.
 */
export async function auditBrandStructuredData(targetUrl = TARGET_SITE): Promise<BrandSchemaAuditResult> {
  const result: BrandSchemaAuditResult = {
    hasOrganizationSchema: false,
    hasWebSiteSchema: false,
    hasSearchAction: false,
    issues: []
  };

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'FirstRead-Brand-Engine/1.0' },
      cache: 'no-store'
    });

    if (!res.ok) {
      result.issues.push(`Unable to fetch ${targetUrl} for schema audit (HTTP ${res.status}).`);
      return result;
    }

    const html = await res.text();
    const schemaMatches = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));

    for (const match of schemaMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const graphs = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);

        for (const node of graphs) {
          const type = node['@type'];
          const types = Array.isArray(type) ? type : [type];

          if (types.includes('Organization') || types.includes('NewsMediaOrganization')) {
            result.hasOrganizationSchema = true;
            if (node.name) result.brandNameDetected = String(node.name);
          }
          if (types.includes('WebSite')) {
            result.hasWebSiteSchema = true;
            const potentialAction = node.potentialAction;
            if (potentialAction) {
              const actions = Array.isArray(potentialAction) ? potentialAction : [potentialAction];
              for (const act of actions) {
                if (act['@type'] === 'SearchAction' || act.target) {
                  result.hasSearchAction = true;
                }
              }
            }
          }
        }
      } catch {}
    }

    if (!result.hasOrganizationSchema) {
      result.issues.push('Organization JSON-LD schema not declared on brand homepage.');
    }
    if (!result.hasWebSiteSchema) {
      result.issues.push('WebSite JSON-LD schema not declared on brand homepage.');
    }
    if (!result.hasSearchAction) {
      result.issues.push('WebSite SearchAction schema missing (recommended for Google Sitelinks Search Box for "firstread").');
    }
  } catch (err) {
    result.issues.push(`Brand schema audit error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * Executes permitted autonomous Google actions without human approval:
 * - Submits sitemap if needed and valid
 * - Notifies Google Indexing API v3 for priority brand URLs
 * - Pings Google sitemap service
 * - Audits brand structured data
 * - Inspects homepage and key brand URLs via URL Inspection API
 * - Re-indexes any crawled/discovered unindexed brand URLs
 */
export async function executePermittedIndexingActions(
  sitemapStatus: SitemapAuditStatus,
  targetUrls: string[] = [TARGET_SITE]
): Promise<{
  actions: AutonomousActionRecord[];
  inspections: UrlInspectionResult[];
}> {
  // Hard Invariant: Verify zero content modification
  assertNoContentModification('executePermittedIndexingActions');

  const actions: AutonomousActionRecord[] = [];
  const inspections: UrlInspectionResult[] = [];
  const timestamp = new Date().toISOString();

  // 1. Autonomous Google Indexing API Push for Primary Brand Domain (https://firstread.co.uk/)
  const indexingPushRes = await publishUrlToGoogleIndexingApi(TARGET_SITE, 'URL_UPDATED');
  const isOwnershipDenied =
    !indexingPushRes.success &&
    (indexingPushRes.message.includes('Failed to verify the URL ownership') ||
      indexingPushRes.message.includes('Permission denied') ||
      indexingPushRes.status === 403);
  const isSkipped = !indexingPushRes.success && (indexingPushRes.status === 401 || isOwnershipDenied);

  actions.push({
    id: `act-index-pub-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actionType: 'google_indexing_publish',
    target: TARGET_SITE,
    status: indexingPushRes.success ? 'success' : isSkipped ? 'skipped' : 'failed',
    details: isOwnershipDenied
      ? 'Google Indexing API requires Owner verification; operating in Search Console Full-user mode via autonomous sitemap submissions.'
      : indexingPushRes.message,
    reason: 'Autonomous Google Indexing API notification to accelerate brand visibility for "firstread".',
    error: indexingPushRes.success || isSkipped ? undefined : indexingPushRes.message
  });

  // 2. Autonomous Sitemap Submission when justified
  if (sitemapStatus.needsSubmission && sitemapStatus.accessibleOnWeb) {
    if (sitemapStatus.lastSubmissionResult === 'permission_denied') {
      actions.push({
        id: `act-sitemap-skip-${Date.now()}`,
        timestamp,
        actionType: 'sitemap_submit',
        target: sitemapStatus.sitemapIndexUrl,
        status: 'skipped',
        details: 'Autonomous sitemap submission paused: Service account has Viewer/Restricted permissions in GSC. Autonomous submission requires Full permission in Search Console > Settings > Users & permissions.',
        reason: 'Service account lacks GSC Full write permission. Awaiting client authorization.'
      });
    } else {
      const submitResult = await submitSitemapToGsc(sitemapStatus.sitemapIndexUrl);
      const isPermDenied = !submitResult.success && submitResult.message.includes('Permission Restricted');
      sitemapStatus.lastSubmissionAttempt = timestamp;
      sitemapStatus.lastSubmissionResult = submitResult.success
        ? 'success'
        : isPermDenied
        ? 'permission_denied'
        : 'failed';

      actions.push({
        id: `act-sitemap-${Date.now()}`,
        timestamp,
        actionType: 'sitemap_submit',
        target: sitemapStatus.sitemapIndexUrl,
        status: submitResult.success ? 'success' : 'failed',
        details: submitResult.message,
        reason: sitemapStatus.submissionJustification || 'Autonomous sitemap submission triggered.',
        error: submitResult.success ? undefined : submitResult.message
      });
    }
  } else {
    actions.push({
      id: `act-sitemap-skip-${Date.now()}`,
      timestamp,
      actionType: 'sitemap_submit',
      target: sitemapStatus.sitemapIndexUrl,
      status: 'skipped',
      details: 'Sitemap already submitted and active in GSC with no reported errors; repeated submission omitted to prevent API spam.',
      reason: 'No sitemap changes detected.'
    });
  }

  // 3. Autonomous Sitemap Ping
  const pingRes = await pingGoogleSitemap(sitemapStatus.sitemapIndexUrl);
  actions.push({
    id: `act-ping-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actionType: 'sitemap_ping',
    target: sitemapStatus.sitemapIndexUrl,
    status: pingRes.success ? 'success' : 'skipped',
    details: pingRes.message,
    reason: 'Autonomous crawler ping for updated sitemap.'
  });

  // 4. Autonomous Brand Schema & Sitelinks Verification
  const schemaRes = await auditBrandStructuredData(TARGET_SITE);
  actions.push({
    id: `act-schema-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actionType: 'audit_schema',
    target: TARGET_SITE,
    status: schemaRes.issues.length === 0 ? 'success' : 'skipped',
    details: schemaRes.issues.length === 0
      ? `Brand schema verified: Organization (${schemaRes.brandNameDetected || 'FirstRead'}), WebSite, and SearchAction intact.`
      : `Brand schema audit noticed: ${schemaRes.issues.join('; ')}`,
    reason: 'Autonomous verification of brand knowledge graph schema for "firstread".'
  });

  // 5. Autonomous Indexing Status Inspection for Priority URLs
  const uniqueUrls = Array.from(new Set(targetUrls)).slice(0, 5); // Safe batch of top priority URLs

  for (const url of uniqueUrls) {
    const inspectResult = await inspectUrlWithGsc(url);
    inspections.push(inspectResult);

    actions.push({
      id: `act-inspect-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actionType: url === TARGET_SITE ? 'inspect_homepage' : 'inspect_url',
      target: url,
      status: inspectResult.verdict === 'FAIL' ? 'failed' : 'success',
      details: `Google Inspection: verdict=${inspectResult.verdict}, state="${inspectResult.coverageState}", robots=${inspectResult.robotsTxtState}`,
      reason: 'Autonomous URL indexing inspection.'
    });

    // Reactive Indexing: If Google has discovered/crawled the brand URL but hasn't indexed it, trigger Indexing API
    if (inspectResult.isDiscoveredNotIndexed || inspectResult.isCrawledNotIndexed) {
      const reactivePub = await publishUrlToGoogleIndexingApi(url, 'URL_UPDATED');
      actions.push({
        id: `act-recheck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        actionType: 'google_indexing_publish',
        target: url,
        status: reactivePub.success ? 'success' : 'skipped',
        details: `Reactive indexing requested because status was "${inspectResult.coverageState}". Response: ${reactivePub.message}`,
        reason: 'Autonomous re-indexing request for unindexed brand URL.'
      });
    }
  }

  return { actions, inspections };
}
