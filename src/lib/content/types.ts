export interface TitleValidationResult {
  title: string;
  valid: boolean;
  reason?: string;
}

export interface FirstReadAIRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  category: 'metadata' | 'content_structure' | 'internal_linking' | 'technical';
  targetUrl: string;
  slug: string;
  issue: string;
  reasoning: string;
  currentValue: {
    title?: string;
    description?: string;
    structure?: string;
  };
  recommendedValue: {
    title?: string;
    description?: string;
    structure?: string;
  };
  evidence: string;
  limitations: string;
  source?: 'deterministic_audit' | 'gemini_ai' | 'heuristic_engine';
  requiresApproval?: boolean;
  approved?: boolean;
}

export interface FirstReadRecommendationsReport {
  generatedAt: string;
  source?: 'gemini' | 'heuristic';
  model?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  summary: string;
  recommendationsCount?: number;
  recommendations: FirstReadAIRecommendation[];
}
