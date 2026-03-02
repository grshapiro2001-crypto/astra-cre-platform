/**
 * Stacking service — save/retrieve 3D building layout, rent roll units,
 * and satellite-based layout extraction.
 */
import { api } from './api';
import type { StackingLayout, RentRollUnit } from '../types/property';

export interface ExtractStackingResponse {
  property_id: number;
  source: 'satellite';
  confidence: 'high' | 'medium' | 'low';
  confidence_reason: string;
  layout: {
    buildings: StackingLayout['buildings'];
    amenities: StackingLayout['amenities'];
    total_units: number;
  };
}

export const stackingService = {
  /**
   * Save or update the stacking layout for a property
   */
  async saveLayout(propertyId: number, layout: StackingLayout): Promise<{ property_id: number; stacking_layout_json: string }> {
    const response = await api.patch(`/properties/${propertyId}/stacking-layout`, { layout });
    return response.data;
  },

  /**
   * Get rent roll units for a property (used by 3D stacking viewer)
   */
  async getRentRollUnits(propertyId: number): Promise<RentRollUnit[]> {
    const response = await api.get(`/properties/${propertyId}/rent-roll-units`);
    return response.data;
  },

  /**
   * Extract building layout from satellite imagery via Claude Vision.
   * Returns layout JSON for the user to review — does NOT save it.
   */
  async extractFromSatellite(propertyId: number): Promise<ExtractStackingResponse> {
    const response = await api.post(`/properties/${propertyId}/extract-stacking`);
    return response.data;
  },
};
