import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGoogleApiError,
  diagnoseGA4Connection,
  testGoogleConnections,
  getGoogleCredentials,
  getGoogleConfig
} from '../src/lib/integrations/google';

test('GA4 Error Classification — Distinguishes all explicit error categories accurately', () => {
  // 1. API Not Enabled (403 SERVICE_DISABLED)
  const apiNotEnabledErr = {
    status: 403,
    message: 'Google Analytics Admin API has not been used in project 385262980558 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/analyticsadmin.googleapis.com/overview?project=385262980558 then retry.',
    response: {
      status: 403,
      data: {
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          details: [{ reason: 'SERVICE_DISABLED' }]
        }
      }
    }
  };
  const classified1 = classifyGoogleApiError(apiNotEnabledErr, {
    service: 'GA4',
    propertyId: '563207238'
  });
  assert.equal(classified1.status, 'api_not_enabled');
  assert.equal(classified1.category, 'api_not_enabled');
  assert.ok(classified1.message.includes('API Not Enabled'));
  assert.ok(classified1.message.includes('analyticsdata.googleapis.com') || classified1.message.includes('console.developers.google.com'));

  // 2. Permission Denied (403 with insufficient permissions)
  const permDeniedErr = {
    status: 403,
    message: 'User does not have sufficient permissions for this property. To learn more about Property ID, see https://developers.google.com/analytics/devguides/reporting/data/v1/property-id.',
    response: {
      status: 403,
      data: {
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          errors: [{ reason: 'forbidden' }]
        }
      }
    }
  };
  const classified2 = classifyGoogleApiError(permDeniedErr, {
    service: 'GA4',
    propertyId: '563207238',
    clientEmail: 'firstread-seo-reader@firstread-seo-integration.iam.gserviceaccount.com'
  });
  assert.equal(classified2.status, 'permission_denied');
  assert.equal(classified2.category, 'permission_denied');
  assert.ok(classified2.message.includes('firstread-seo-reader'));
  assert.ok(classified2.message.includes('Property Access Management'));

  // 3. Invalid Credentials (401 Unauthorized / invalid_grant)
  const invalidCredsErr = {
    status: 401,
    message: 'invalid_grant: Invalid JWT Signature.'
  };
  const classified3 = classifyGoogleApiError(invalidCredsErr, {
    service: 'GA4',
    propertyId: '563207238'
  });
  assert.equal(classified3.status, 'invalid_credentials');
  assert.equal(classified3.category, 'invalid_credentials');

  // 4. Property Not Found (404 NOT_FOUND)
  const notFoundErr = {
    status: 404,
    message: 'Property 999999999 was not found.'
  };
  const classified4 = classifyGoogleApiError(notFoundErr, {
    service: 'GA4',
    propertyId: '999999999'
  });
  assert.equal(classified4.status, 'property_not_found');
  assert.equal(classified4.category, 'property_not_found');

  // 5. Configuration Error — Measurement ID entered instead of numeric Property ID
  const measurementIdErr = new Error('Invalid format');
  const classified5 = classifyGoogleApiError(measurementIdErr, {
    service: 'GA4',
    propertyId: 'G-3XJX04N51F'
  });
  assert.equal(classified5.status, 'configuration_error');
  assert.equal(classified5.category, 'configuration_error');
  assert.ok(classified5.message.includes('Measurement ID'));

  // 6. Configuration Error — Non-numeric Property ID
  const nonNumericErr = new Error('Invalid format');
  const classified6 = classifyGoogleApiError(nonNumericErr, {
    service: 'GA4',
    propertyId: 'abc-xyz'
  });
  assert.equal(classified6.status, 'configuration_error');
  assert.equal(classified6.category, 'configuration_error');

  // 7. Temporary API Error (503 / 429)
  const tempErr = {
    status: 503,
    message: 'The service is temporarily unavailable.'
  };
  const classified7 = classifyGoogleApiError(tempErr, {
    service: 'GA4',
    propertyId: '563207238'
  });
  assert.equal(classified7.status, 'temporary_api_error');
  assert.equal(classified7.category, 'temporary_api_error');
});

test('GA4 Diagnostic Engine — Property ID validation detects missing and invalid values', async () => {
  // Test missing property ID
  const resultMissing = await diagnoseGA4Connection('');
  assert.equal(resultMissing.status, 'configuration_error');
  assert.equal(resultMissing.steps.propertyValidation.validFormat, false);

  // Test measurement ID
  const resultMeasurement = await diagnoseGA4Connection('G-3XJX04N51F');
  assert.equal(resultMeasurement.status, 'configuration_error');
  assert.equal(resultMeasurement.steps.propertyValidation.isMeasurementId, true);
  assert.equal(resultMeasurement.steps.propertyValidation.validFormat, false);

  // Test valid numeric format
  const resultNumeric = await diagnoseGA4Connection('563207238');
  assert.equal(resultNumeric.steps.propertyValidation.validFormat, true);
  assert.equal(resultNumeric.steps.propertyValidation.numericId, '563207238');
});

test('GA4 Diagnostic Engine — End-to-end diagnosis produces structured diagnostic report', async () => {
  const creds = getGoogleCredentials();
  const config = getGoogleConfig();

  if (creds && config.ga4PropertyId) {
    const diag = await diagnoseGA4Connection();
    assert.ok(diag.timestamp);
    assert.ok(typeof diag.status === 'string');
    assert.ok(typeof diag.message === 'string');
    assert.ok(typeof diag.recommendedAction === 'string');

    // Authentication must succeed with valid credentials
    assert.equal(diag.steps.authentication.success, true);
    assert.equal(diag.steps.propertyValidation.validFormat, true);

    // If property 563207238 has permission denied, verify classification
    if (diag.propertyId === '563207238') {
      assert.equal(diag.status, 'permission_denied');
      assert.equal(diag.category, 'permission_denied');
      assert.equal(diag.steps.dataApi.runReportSuccess, false);
      // Admin API must be recognized as disabled
      assert.equal(diag.steps.adminApi.enabled, false);
      // Alternate property check should discover 557864063
      if (diag.steps.alternatePropertyCheck) {
        assert.equal(diag.steps.alternatePropertyCheck.checkedId, '557864063');
        assert.equal(diag.steps.alternatePropertyCheck.accessible, true);
        assert.equal(diag.steps.alternatePropertyCheck.hostName, 'firstread.co.uk');
        assert.ok(diag.recommendedAction.includes('557864063'));
      }
    }
  }
});

test('Google Connections Test — Returns rich diagnostic information on analytics4 service', async () => {
  const creds = getGoogleCredentials();
  if (creds) {
    const testResult = await testGoogleConnections();
    assert.ok(testResult.searchConsole);
    assert.ok(testResult.analytics4);
    assert.ok(testResult.analytics4.diagnostic);
    assert.equal(typeof testResult.analytics4.status, 'string');
    assert.notEqual(testResult.analytics4.status, 'error'); // Must be specific classification
  }
});
