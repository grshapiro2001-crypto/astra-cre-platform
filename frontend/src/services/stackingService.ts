/**
 * Stacking service — save/retrieve 3D building layout and rent roll units.
 * Phase 1: Manual layout entry only.
 */
import { api } from './api';
import type { StackingLayout, RentRollUnit } from '../types/property';

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
};
