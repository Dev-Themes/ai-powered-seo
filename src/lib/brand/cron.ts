import { verifyCronSecret } from '../auth-core';
import { runAutonomousBrandGrowthCycle } from './engine';

export interface BrandCronResponse {
  status: number;
  data: unknown;
}

/**
 * Handles incoming scheduled cron execution requests.
 * Enforces that ONLY a valid Authorization: Bearer CRON_SECRET request can trigger the cycle.
 * Ordinary browser GET requests and unauthorized callers are strictly rejected with HTTP 401.
 */
export async function handleBrandCronRequest(request: Request): Promise<BrandCronResponse> {
  // 1. Verify Authorization: Bearer CRON_SECRET
  if (!verifyCronSecret(request)) {
    return {
      status: 401,
      data: { error: 'Unauthorised' }
    };
  }

  // 2. Execute scheduled autonomous brand monitoring cycle
  const result = await runAutonomousBrandGrowthCycle();
  return {
    status: 200,
    data: result
  };
}
