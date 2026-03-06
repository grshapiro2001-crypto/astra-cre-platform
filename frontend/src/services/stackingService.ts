/**
 * Stacking service — save/retrieve 3D building layout, rent roll units,
 * and satellite-based layout extraction.
 */
import { api } from './api';
import type { StackingLayout, RentRollUnit, UnitPositionMap } from '../types/property';

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

export interface FloorPlanExtractionResponse {
  property_id: number;
  unit_position_map: UnitPositionMap;
  layout: {
    buildings: StackingLayout['buildings'];
    amenities: StackingLayout['amenities'];
    total_units: number;
  };
}

export const stackingService = {
  /**
   * Save or update the stacking layout for a property.
   * Optionally saves the unit_position_map alongside the layout.
   */
  async saveLayout(
    propertyId: number,
    layout: StackingLayout,
    unitPositionMap?: UnitPositionMap | null,
  ): Promise<{ property_id: number; stacking_layout_json: string }> {
    const body: { layout: StackingLayout; unit_position_map?: UnitPositionMap } = { layout };
    if (unitPositionMap) {
      body.unit_position_map = unitPositionMap;
    }
    const response = await api.patch(`/properties/${propertyId}/stacking-layout`, body);
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

  /**
   * Extract unit positions from uploaded floor plan screenshots via Claude Vision.
   * Returns a unit_position_map and generated layout for user review — does NOT save it.
   */
  async extractFromFloorPlan(propertyId: number, images: File[]): Promise<FloorPlanExtractionResponse> {
    const formData = new FormData();
    images.forEach((img) => formData.append('floor_images', img));
    const response = await api.post(
      `/properties/${propertyId}/extract-floor-plan`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
    );
    return response.data;
  },
};
