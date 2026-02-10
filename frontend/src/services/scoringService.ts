/**
 * Scoring Service — API calls for Deal Score v2 three-layer scoring system
 * NO LLM — Pure database operations
 */
import { api } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricBreakdown {
  value: number | null;
  raw_score: number | null;
  weight: number;
  weighted_score: number | null;
  context: string | null;
}

export interface LayerResult {
  score: number | null;
  weight: number;
  weighted_contribution: number | null;
  metrics: Record<string, MetricBreakdown>;
  comps_used?: CompUsed[];
}

export interface CompUsed {
  id: number;
  property_name: string | null;
  submarket: string | null;
  cap_rate: number | null;
  price_per_unit: number | null;
  sale_price: number | null;
  year_built: number | null;
  units: number | null;
  relevance: number;
}

export interface DealScoreResult {
  total_score: number | null;
  layer_scores: {
    property_fundamentals?: LayerResult;
    market_intelligence?: LayerResult;
    deal_comp_analysis?: LayerResult;
  };
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface ScoringWeights {
  economic_occupancy_weight: number;
  opex_ratio_weight: number;
  supply_pipeline_weight: number;
  layer1_weight: number;
  layer2_weight: number;
  layer3_weight: number;
  preset_name: string | null;
}

export interface ScoringPresets {
  [presetName: string]: Omit<ScoringWeights, 'preset_name'>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const scoringService = {
  /** Get current user's scoring weights (creates defaults if none exist) */
  async getWeights(): Promise<ScoringWeights> {
    const response = await api.get<ScoringWeights>('/scoring/weights');
    return response.data;
  },

  /** Update user's scoring weights (partial update) */
  async updateWeights(weights: Partial<ScoringWeights>): Promise<ScoringWeights> {
    const response = await api.put<ScoringWeights>('/scoring/weights', weights);
    return response.data;
  },

  /** List all available scoring presets */
  async getPresets(): Promise<ScoringPresets> {
    const response = await api.get<ScoringPresets>('/scoring/presets');
    return response.data;
  },

  /** Apply a scoring preset by name */
  async applyPreset(presetName: string): Promise<ScoringWeights> {
    const response = await api.put<ScoringWeights>('/scoring/weights/preset', {
      preset_name: presetName,
    });
    return response.data;
  },

  /** Get deal score for a single property */
  async getScore(propertyId: number): Promise<DealScoreResult> {
    const response = await api.get<DealScoreResult>(`/scoring/score/${propertyId}`);
    return response.data;
  },

  /** Batch score multiple properties */
  async getScores(propertyIds: number[]): Promise<Record<number, DealScoreResult>> {
    const response = await api.post<{ scores: Record<number, DealScoreResult> }>(
      '/scoring/scores',
      { property_ids: propertyIds },
    );
    return response.data.scores;
  },
};
