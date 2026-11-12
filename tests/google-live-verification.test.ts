import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGoogleConfig,
  getGoogleCredentials,
  testGoogleConnections,
  fetchGSCReport,
  fetchGA4Report,
  createAuthorizedJWT
} from '../src/lib/integrations/google';

test('Live Google Integrations Verification — Production GSC and GA4 Contracts', async () => {
  const config = getGoogleConfig();
  const creds = getGoogleCredentials();

  // If running in an environment without Google Cloud credentials, skip live API assertions safely
  if (!creds || !config.ga4PropertyId) {
    console.log('[Live Google Verification] Skipped: Google Cloud credentials not configured in this test environment.');
    return;
  }

  // 1. Verify GSC Configuration
  assert.equal(config.gscSiteUrl, 'https://firstread.co.uk/', 'Configured GSC property must be https://firstread.co.uk/');
  assert.equal(config.ga4PropertyId, '557864063', 'Configured GA4 Property ID must be 557864063');
  assert.ok(creds.clientEmail.includes('@'), 'Service account email must be valid');

  // 2. Test Connection Status
  const connResult = await testGoogleConnections();
  assert.equal(connResult.searchConsole.status, 'connected', `GSC connection failed: ${connResult.searchConsole.message}`);
  assert.equal(connResult.analytics4.status, 'connected', `GA4 connection failed: ${connResult.analytics4.message}`);

  // 3. Verify Live GSC Production Requests
  const gscReport = await fetchGSCReport();
  assert.equal(gscReport.status, 'connected');
  assert.ok(gscReport.data !== null, 'GSC Report data must be present');
  assert.ok(typeof gscReport.data.summary.clicks === 'number', 'GSC clicks must be numeric');
  assert.ok(typeof gscReport.data.summary.impressions === 'number', 'GSC impressions must be numeric');
  assert.ok(gscReport.data.topQueries.length > 0, 'GSC topQueries should contain actual queries');
  assert.ok(gscReport.data.topPages.length > 0, 'GSC topPages should contain actual pages');

  // 4. Verify Live GA4 Production Data & Hostname
  const ga4Report = await fetchGA4Report();
  assert.equal(ga4Report.status, 'connected');
  assert.ok(ga4Report.data !== null, 'GA4 Report data must be present');
  assert.ok(typeof ga4Report.data.summary.sessions === 'number', 'GA4 sessions must be numeric');
  assert.ok(typeof ga4Report.data.summary.screenPageViews === 'number', 'GA4 pageviews must be numeric');
  assert.ok(typeof ga4Report.data.summary.engagementRate === 'number', 'GA4 engagement rate must be numeric');
  assert.ok(ga4Report.data.landingPages.length > 0, 'GA4 landingPages must contain real landing pages');
  assert.ok(ga4Report.data.dailyTrend.length > 0, 'GA4 dailyTrend must contain real date records');

  // 5. Verify Hostname matches firstread.co.uk
  const jwt = createAuthorizedJWT(['https://www.googleapis.com/auth/analytics.readonly']);
  assert.ok(jwt);
  const hostRes = await jwt.request<{
    rows?: Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>;
  }>({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`,
    method: 'POST',
    data: {
      dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'hostName' }],
      metrics: [{ name: 'sessions' }]
    }
  });

  const hostnames = (hostRes.data.rows || []).map(r => r.dimensionValues[0]?.value);
  assert.ok(
    hostnames.some(h => h === 'firstread.co.uk' || h === 'www.firstread.co.uk'),
    `Verified GA4 hostname must match firstread.co.uk. Received: ${JSON.stringify(hostnames)}`
  );
});
