'use client';

import React from 'react';
import type { BrandGrowthEngineState } from '@/lib/brand/types';
import type { GSCReportResponse, GA4ReportResponse } from '@/lib/integrations/google';
import DashboardV2 from '@/dashboard-v2/dashboard-view';

export interface BrandGrowthViewProps {
  brandState: BrandGrowthEngineState | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onRunCycle: () => Promise<void>;
  onTogglePause?: (pause: boolean) => Promise<void>;
  onEmergencyStop?: () => Promise<void>;
  onInspectUrl: (url: string) => Promise<void>;
  gscReport?: GSCReportResponse | null;
  ga4Report?: GA4ReportResponse | null;
  dateRangePreset?: '1d' | '7d' | '28d' | '90d' | 'custom';
  onDatePresetChange?: (preset: '1d' | '7d' | '28d' | '90d') => void;
}

export function BrandGrowthView({
  brandState,
  loading,
  onRefresh,
  onRunCycle,
  onTogglePause,
  onEmergencyStop,
  onInspectUrl,
  gscReport,
  ga4Report,
  dateRangePreset = '28d',
  onDatePresetChange
}: BrandGrowthViewProps) {
  return (
    <DashboardV2
      brandState={brandState}
      loading={loading}
      onRefresh={onRefresh}
      onRunCycle={onRunCycle}
      onTogglePause={onTogglePause}
      onEmergencyStop={onEmergencyStop}
      onInspectUrl={onInspectUrl}
      gscReport={gscReport}
      ga4Report={ga4Report}
      dateRangePreset={dateRangePreset}
      onDatePresetChange={onDatePresetChange}
    />
  );
}
