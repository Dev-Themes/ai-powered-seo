export type ScopeId = 'brand' | 'site';
export type PeriodId = '24h' | '7d' | '28d' | '90d';
export type TabId = 'overview' | 'history' | 'queries' | 'pages' | 'ga4';
export type TargetFilterId = 'all' | 'reroute' | 'striking' | 'question';

export type { AutonomousExecutionRecord, StorageSyncStatus } from '@/lib/brand/types';

export interface PeriodConfig {
  id: PeriodId;
  label: string;
  days: number;
  word: string;
  factor: number;
  n: number;
}

export interface MetricSummary {
  c: number;
  pc: number;
  i: number;
  pi: number;
  ctr: number;
  pctr: number;
  pos: number;
  ppos: number;
}

export interface SparklineData {
  points: string;
  cx: string;
  cy: string;
}

export interface KpiCardData {
  label: string;
  dot: string;
  sp: string;
  dt: string;
  value: string;
  delta: string;
  good: boolean;
  foot: string;
  spark: string;
  cx: string;
  cy: string;
}

export interface QueryRow {
  name: string;
  type: 'Brand' | 'Organic';
  c: number;
  i: number;
  ctr: number;
  pos: number;
}

export interface PageRow {
  name: string;
  type: 'Homepage' | 'Article' | 'Category' | 'About';
  c: number;
  i: number;
  ctr: number;
  pos: number;
}

export interface Ga4Row {
  name: string;
  s: number;
  v: number;
  e: number;
  er: number;
}

export interface AutonomousTarget {
  id: number;
  q: string;
  st: 'reroute' | 'striking' | 'question';
  from: string;
  to: string;
  i: number;
  ctr: string;
  pos: string;
}

export interface AutonomousEvent {
  time: string;
  text: string;
  dot: string;
}

export interface TechnicalHealthItem {
  label: string;
  value: string;
}

export type TableRowItem = 
  | { name: string; type: 'Brand' | 'Organic'; c: number; i: number; ctr: number; pos: number; s?: never; v?: never; e?: never; er?: never }
  | { name: string; type: 'Homepage' | 'Article' | 'Category' | 'About'; c: number; i: number; ctr: number; pos: number; s?: never; v?: never; e?: never; er?: never }
  | { name: string; type?: never; c?: never; i?: never; ctr?: never; pos?: never; s: number; v: number; e: number; er: number };

