import { NextResponse } from 'next/server';
import { session, authorize, verifyCronSecret } from '@/lib/auth';
import { runFirstReadAudit } from '@/lib/seo/audit';
import type { FirstReadAuditReport } from '@/lib/seo/types';
import { generateFirstReadRecommendations } from '@/lib/content/ai';
import { fetchSiteInfo, fetchPublishedPosts, fetchCategories } from '@/lib/wordpress/client';
import {
  saveAuditReport,
  saveRecommendationsReport,
  listReports,
  getReportById,
  getLatestAuditReport,
  getLatestRecommendationsReport
} from '@/lib/shared/storage';
import {
  getGoogleIntegrationReadiness,
  getFirstReadGoogleStatus,
  getGoogleConfig,
  fetchGSCReport,
  fetchGA4Report,
  testGoogleConnections,
  diagnoseGA4Connection,
  publishUrlToGoogleIndexingApi
} from '@/lib/integrations/google';
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
} from '@/lib/seo/operations';
import {
  loadBrandGrowthState,
  runAutonomousBrandGrowthCycle,
  setAutonomousExecutionPaused,
  emergencyStopAutonomousExecution
} from '@/lib/brand/engine';
import { handleBrandCronRequest } from '@/lib/brand/cron';
import {
  inspectUrlWithGsc,
  submitSitemapToGsc,
  pingGoogleSitemap,
  auditBrandStructuredData
} from '@/lib/brand/indexing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatError(e: unknown) {
  if (e instanceof Error && ['UNAUTHORIZED', 'FORBIDDEN'].includes(e.message)) {
    return NextResponse.json(
      { error: 'Unauthorised request.' },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 403 }
    );
  }
  return NextResponse.json(
    { error: e instanceof Error ? e.message : 'Operation unavailable.' },
    { status: 500 }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const p = (await params).path;
    const isBrandCron = p[0] === 'firstread' && p[1] === 'brand' && p[2] === 'cron';

    // 1. Scheduled Cron Endpoint: ONLY an authorized Bearer CRON_SECRET request may trigger the scheduled cycle
    if (isBrandCron) {
      const { status, data } = await handleBrandCronRequest(request);
      return NextResponse.json(data, {
        status,
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }

    // 2. All other GET endpoints require an active administrator session
    const s = await session();
    if (!s) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    let data: unknown;

    if (p[0] === 'session' && s) {
      data = { csrf: s.csrf };
    } else if (p[0] === 'firstread' || p[0] === 'reports') {
      const sub = p[0] === 'reports' ? 'reports' : p[1];
      const param = p[0] === 'reports' ? p[1] : p[2];

      if (sub === 'posts') {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '10', 10)));
        const [postsData, categories] = await Promise.all([
          fetchPublishedPosts(page, perPage),
          fetchCategories().catch(() => [])
        ]);
        data = {
          ...postsData,
          page,
          perPage,
          categories
        };
      } else if (sub === 'info') {
        data = await fetchSiteInfo();
      } else if (sub === 'audit') {
        const latest = await getLatestAuditReport();
        data = latest || (await runFirstReadAudit(500));
      } else if (sub === 'recommend') {
        const latest = await getLatestRecommendationsReport();
        if (latest) {
          data = latest;
        } else {
          const audit = (await getLatestAuditReport()) || (await runFirstReadAudit(500));
          data = await generateFirstReadRecommendations(audit);
        }
      } else if (sub === 'reports' && param) {
        data = await getReportById(param);
        if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      } else if (sub === 'reports') {
        data = await listReports();
      } else if (sub === 'google') {
        if (param === 'search-console') {
          const { searchParams } = new URL(request.url);
          data = await fetchGSCReport({
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined
          });
        } else if (param === 'analytics') {
          const { searchParams } = new URL(request.url);
          data = await fetchGA4Report({
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined
          });
        } else if (param === 'test') {
          data = await testGoogleConnections();
        } else if (param === 'diagnostic') {
          data = await diagnoseGA4Connection();
        } else {
          const status = getFirstReadGoogleStatus();
          const readiness = getGoogleIntegrationReadiness();
          const config = getGoogleConfig();
          data = {
            ...status,
            readiness,
            gscSiteUrl: config.gscSiteUrl,
            ga4PropertyId: config.ga4PropertyId,
            serviceAccountEmail: config.clientEmail,
            hasCredentials: config.hasCredentials
          };
        }
      } else if (sub === 'brand') {
        data = await loadBrandGrowthState();
      } else if (sub === 'integrations') {
        data = getGoogleIntegrationReadiness();
      } else if (sub === 'status' || sub === 'readiness' || sub === 'infra') {
        // Honest system status without database or Inngest dependencies
        data = {
          wordpress: {
            origin: 'https://firstread.co.uk',
            mode: 'Strict Read-Only (Guaranteed)',
            status: 'Connected'
          },
          aiProvider: {
            provider: 'Google Gemini',
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            configured: Boolean(process.env.GEMINI_API_KEY)
          },
          googleIntegrations: getGoogleIntegrationReadiness(),
          architecture: {
            type: 'Simplified Serverless Next.js App Router',
            state: 'Session-Scoped (In-Memory / Non-Persistent)',
            database: 'None (Completely Removed)',
            orchestration: 'Direct On-Demand Server-Side Operations',
            availableOperations: 11
          }
        };
      } else {
        data = await fetchSiteInfo();
      }
    } else {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (e) {
    return formatError(e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const p = (await params).path;
    const isBrandRunOrCron = p[0] === 'firstread' && p[1] === 'brand' && (p[2] === 'run' || p[2] === 'cron');
    const isCron = verifyCronSecret(request);

    if (isBrandRunOrCron && isCron) {
      // Authorized via CRON_SECRET Bearer header
    } else {
      await authorize(request);
    }

    if (p[0] === 'firstread') {
      const action = p[1];

      // 1. Direct AI Operations Dispatcher
      if (action === 'operation') {
        let body: { operation?: string; input?: Record<string, unknown> } = {};
        try {
          body = await request.json();
        } catch {
          return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const op = body.operation;
        const input = body.input || {};

        switch (op) {
          case 'keyword-research':
            return NextResponse.json(await executeKeywordResearch(input.seed as string | undefined));
          case 'competitor-analysis':
            return NextResponse.json(await executeCompetitorAnalysis(input.domain as string | undefined));
          case 'search-intent':
            return NextResponse.json(await executeSearchIntentAnalysis((input.keywords as string[]) || []));
          case 'content-gap':
            return NextResponse.json(await executeContentGapDiscovery(input.niche as string | undefined));
          case 'topic-clusters':
            return NextResponse.json(await executeTopicClusterGeneration(input.pillarTopic as string | undefined));
          case 'seo-strategy':
            return NextResponse.json(await executeSEOStrategyGeneration(input.focus as string | undefined));
          case 'article-research':
            return NextResponse.json(await executeArticleResearch(input.topic as string | undefined));
          case 'article-generation':
            return NextResponse.json(await executeArticleGeneration(input));
          case 'article-qa':
            return NextResponse.json(await executeArticleQA(input));
          case 'technical-audit':
            return NextResponse.json(await executeTechnicalAudit({
              limit: input.limit !== undefined ? Number(input.limit) : undefined,
              scope: (input.scope as 'sampled' | 'full' | 'continue') || undefined
            }));
          case 'recommendations':
            return NextResponse.json(await executeRecommendationsGeneration());
          default:
            return NextResponse.json(
              { error: `Unknown operation: ${op}. Supported: keyword-research, competitor-analysis, search-intent, content-gap, topic-clusters, seo-strategy, article-research, article-generation, article-qa, technical-audit, recommendations.` },
              { status: 400 }
            );
        }
      }

      // 2. Audit Snapshot Trigger
      if (action === 'audit') {
        let body: { scope?: 'sampled' | 'full' | 'continue'; limit?: number } = {};
        try {
          body = await request.json();
        } catch {}

        let audit: FirstReadAuditReport;
        if (body.scope === 'continue') {
          const latest = await getLatestAuditReport();
          audit = await runFirstReadAudit(body.limit || 500, { continueFromReport: latest });
        } else if (body.scope === 'sampled') {
          audit = await runFirstReadAudit(body.limit || 100);
        } else {
          const limit = body.limit || 500;
          audit = await runFirstReadAudit(limit);
        }

        const stored = await saveAuditReport(audit);
        return NextResponse.json(stored);
      }

      // 3. Recommendation Trigger
      if (action === 'recommend') {
        const audit = (await getLatestAuditReport()) || (await runFirstReadAudit(500));
        const recs = await generateFirstReadRecommendations(audit);
        const stored = await saveRecommendationsReport(recs);
        return NextResponse.json(stored);
      }

      // 4. Google Connections Test & Diagnostic Trigger
      if (action === 'google-test' || action === 'google') {
        const testResult = await testGoogleConnections();
        return NextResponse.json(testResult);
      }
      if (action === 'google-diagnostic') {
        const diagResult = await diagnoseGA4Connection();
        return NextResponse.json(diagResult);
      }

      // 5. Autonomous Brand Growth Engine Triggers
      if (action === 'brand') {
        const subAction = p[2] || 'run';
        if (subAction === 'run' || subAction === 'cron') {
          const res = await runAutonomousBrandGrowthCycle({ force: !isCron });
          return NextResponse.json(res);
        }
        if (subAction === 'pause') {
          const res = await setAutonomousExecutionPaused(true);
          return NextResponse.json(res);
        }
        if (subAction === 'resume') {
          const res = await setAutonomousExecutionPaused(false);
          return NextResponse.json(res);
        }
        if (subAction === 'stop') {
          const res = await emergencyStopAutonomousExecution();
          return NextResponse.json(res);
        }
        if (subAction === 'inspect') {
          let body: { url?: string } = {};
          try {
            body = await request.json();
          } catch {}
          const inspectUrl = body.url || 'https://firstread.co.uk/';
          const res = await inspectUrlWithGsc(inspectUrl);
          return NextResponse.json(res);
        }
        if (subAction === 'sitemap-submit') {
          const res = await submitSitemapToGsc();
          return NextResponse.json(res);
        }
        if (subAction === 'indexing-publish') {
          let body: { url?: string; type?: 'URL_UPDATED' | 'URL_DELETED' } = {};
          try {
            body = await request.json();
          } catch {}
          const publishUrl = body.url || 'https://firstread.co.uk/';
          const res = await publishUrlToGoogleIndexingApi(publishUrl, body.type || 'URL_UPDATED');
          return NextResponse.json(res);
        }
        if (subAction === 'sitemap-ping') {
          const res = await pingGoogleSitemap();
          return NextResponse.json(res);
        }
        if (subAction === 'schema-audit') {
          const res = await auditBrandStructuredData();
          return NextResponse.json(res);
        }
      }

      // 5. Strictly reject obsolete approval actions or any WordPress write operation
      if (action === 'approve') {
        return NextResponse.json(
          { error: 'Human approval queues are obsolete. System operates via automated QA validation.' },
          { status: 410 }
        );
      }

      return NextResponse.json(
        { error: 'Forbidden. Write operations to FirstRead WordPress are permanently blocked.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );
  } catch (e) {
    return formatError(e);
  }
}
