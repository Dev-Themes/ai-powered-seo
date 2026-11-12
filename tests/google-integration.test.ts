import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGoogleCredentials,
  getGoogleConfig,
  getGoogleIntegrationReadiness,
  getFirstReadGoogleStatus,
  testGoogleConnections,
  fetchGSCReport,
  fetchGA4Report,
  sanitizeGoogleError
} from '../src/lib/integrations/google';

test('Google Integration — Handles unconfigured environment safely without throwing exceptions', async () => {
  const origJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const origEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const origKey = process.env.GOOGLE_PRIVATE_KEY;
  const origGsc = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
  const origGa4 = process.env.GA4_PROPERTY_ID;

  try {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    delete process.env.FIRSTREAD_GSC_PROPERTY;
    delete process.env.GSC_PROPERTY;
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.FIRSTREAD_GA4_PROPERTY_ID;

    // Credentials should be null
    const creds = getGoogleCredentials();
    assert.equal(creds, null);

    // Readiness should indicate not ready
    const readiness = getGoogleIntegrationReadiness();
    assert.equal(readiness.hasServiceAccount, false);
    assert.equal(readiness.readyForIngestion, false);

    // Backward compatibility status
    const legacyStatus = getFirstReadGoogleStatus();
    assert.equal(legacyStatus.configured, false);
    assert.equal(legacyStatus.searchConsole.status, 'unconfigured');
    assert.equal(legacyStatus.analytics4.status, 'unconfigured');

    // Connection testing returns unconfigured safely
    const testResult = await testGoogleConnections();
    assert.equal(testResult.searchConsole.status, 'unconfigured');
    assert.equal(testResult.analytics4.status, 'unconfigured');
    assert.equal(testResult.searchConsole.authorized, false);
    assert.equal(testResult.analytics4.authorized, false);

    // Reports return null data with unconfigured status
    const gscReport = await fetchGSCReport();
    assert.equal(gscReport.status, 'unconfigured');
    assert.equal(gscReport.authorized, false);
    assert.equal(gscReport.data, null);

    const ga4Report = await fetchGA4Report();
    assert.equal(ga4Report.status, 'unconfigured');
    assert.equal(ga4Report.authorized, false);
    assert.equal(ga4Report.data, null);
  } finally {
    if (origJson !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = origJson;
    if (origEmail !== undefined) process.env.GOOGLE_CLIENT_EMAIL = origEmail;
    if (origKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = origKey;
    if (origGsc !== undefined) process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = origGsc;
    if (origGa4 !== undefined) process.env.GA4_PROPERTY_ID = origGa4;
  }
});

test('Google Integration — Correctly parses GOOGLE_SERVICE_ACCOUNT_JSON (JSON string and Base64)', () => {
  const dummyKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7\n-----END PRIVATE KEY-----';
  const dummyCreds = {
    type: 'service_account',
    project_id: 'test-project-123',
    client_email: 'service-account@test-project-123.iam.gserviceaccount.com',
    private_key: dummyKey
  };

  const origJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  try {
    // 1. Plain JSON string
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(dummyCreds);
    const parsed1 = getGoogleCredentials();
    assert.ok(parsed1);
    assert.equal(parsed1?.clientEmail, dummyCreds.client_email);
    assert.equal(parsed1?.projectId, 'test-project-123');
    assert.ok(parsed1?.privateKey.includes('BEGIN PRIVATE KEY'));

    // 2. Base64 encoded JSON string
    const b64 = Buffer.from(JSON.stringify(dummyCreds)).toString('base64');
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = b64;
    const parsed2 = getGoogleCredentials();
    assert.ok(parsed2);
    assert.equal(parsed2?.clientEmail, dummyCreds.client_email);
    assert.equal(parsed2?.projectId, 'test-project-123');

    // 3. Config resolution
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = 'sc-domain:firstread.co.uk';
    process.env.GA4_PROPERTY_ID = '123456789';
    const config = getGoogleConfig();
    assert.equal(config.gscSiteUrl, 'sc-domain:firstread.co.uk');
    assert.equal(config.ga4PropertyId, '123456789');
    assert.equal(config.clientEmail, dummyCreds.client_email);
    assert.equal(config.hasCredentials, true);
  } finally {
    if (origJson !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = origJson;
    else delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  }
});

test('Google Integration — Handles permission denied / client authorization pending gracefully', async () => {
  // Use dummy key that will fail Google OAuth / permission check without leaking secrets
  const origEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const origKey = process.env.GOOGLE_PRIVATE_KEY;
  const origGsc = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
  const origGa4 = process.env.GA4_PROPERTY_ID;

  try {
    // Set a mock service account email and key
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.GOOGLE_CLIENT_EMAIL = 'delegated-sa@firstread-seo.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7\n-----END PRIVATE KEY-----';
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = 'sc-domain:firstread.co.uk';
    process.env.GA4_PROPERTY_ID = '987654321';

    // Reports must handle error gracefully without throwing, and data must be null
    const gsc = await fetchGSCReport();
    assert.equal(gsc.data, null);
    assert.equal(gsc.authorized, false);
    assert.ok(gsc.status === 'pending_authorization' || gsc.status === 'error');
    // Ensure no private key is leaked in message
    assert.equal(gsc.message.includes('BEGIN PRIVATE KEY'), false);

    const ga4 = await fetchGA4Report();
    assert.equal(ga4.data, null);
    assert.equal(ga4.authorized, false);
    assert.ok(ga4.status === 'pending_authorization' || ga4.status === 'error');
    assert.equal(ga4.message.includes('BEGIN PRIVATE KEY'), false);
  } finally {
    if (origEmail !== undefined) process.env.GOOGLE_CLIENT_EMAIL = origEmail;
    else delete process.env.GOOGLE_CLIENT_EMAIL;
    if (origKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = origKey;
    else delete process.env.GOOGLE_PRIVATE_KEY;
    if (origGsc !== undefined) process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = origGsc;
    else delete process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    if (origGa4 !== undefined) process.env.GA4_PROPERTY_ID = origGa4;
    else delete process.env.GA4_PROPERTY_ID;
  }
});

test('Google Integration — Error sanitization scrubs private keys, API keys, and bearer tokens', () => {
  const dummyPrivateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAwXYZ...\n-----END RSA PRIVATE KEY-----';
  const dummyApiKey = 'AIzaSyD-1234567890abcdef1234567890abc';
  const dummyToken = 'ya29.a0AfH6SMD_random_secret_token_data';

  const rawError = new Error(`Authentication failure with key ${dummyApiKey} and token ${dummyToken} and private key:\n${dummyPrivateKey}\nURL: https://analyticsdata.googleapis.com?key=${dummyApiKey}`);

  const sanitized = sanitizeGoogleError(rawError);

  assert.equal(sanitized.includes('BEGIN RSA PRIVATE KEY'), false);
  assert.equal(sanitized.includes(dummyApiKey), false);
  assert.equal(sanitized.includes(dummyToken), false);
  assert.ok(sanitized.includes('[REDACTED_PRIVATE_KEY]'));
  assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
  assert.ok(sanitized.includes('[REDACTED_BEARER_TOKEN]'));
});

test('Google Integration — GSC & GA4 Reports enforce strict data integrity contract', async () => {
  // Verify structure of unconfigured/pending report payloads
  const gsc = await fetchGSCReport({ startDate: '2026-10-01', endDate: '2026-10-28' });
  assert.equal(gsc.service, 'Google Search Console');
  assert.equal(typeof gsc.status, 'string');
  assert.equal(typeof gsc.message, 'string');
  assert.equal(gsc.period.startDate, '2026-10-01');
  assert.equal(gsc.period.endDate, '2026-10-28');
  if (!gsc.authorized) {
    assert.equal(gsc.data, null);
  }

  const ga4 = await fetchGA4Report({ startDate: '2026-10-01', endDate: '2026-10-28' });
  assert.equal(ga4.service, 'Google Analytics 4');
  assert.equal(typeof ga4.status, 'string');
  assert.equal(typeof ga4.message, 'string');
  assert.equal(ga4.period.startDate, '2026-10-01');
  assert.equal(ga4.period.endDate, '2026-10-28');
  if (!ga4.authorized) {
    assert.equal(ga4.data, null);
  }
});

