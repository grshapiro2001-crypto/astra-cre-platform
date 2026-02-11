/**
 * Criteria service for investment criteria and screening API calls
 */
import { api } from './api';
import type {
  InvestmentCriteria,
  ScreeningResult,
  ScreeningSummaryItem,
} from '../types/property';

export const criteriaService = {
  /** Get the user's investment criteria (creates default if none) */
  async getCriteria(): Promise<InvestmentCriteria> {
    const response = await api.get<InvestmentCriteria>('/criteria');
    return response.data;
  },

  /** Update (or create) investment criteria */
  async updateCriteria(
    data: Partial<Omit<InvestmentCriteria, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<InvestmentCriteria> {
    const response = await api.put<InvestmentCriteria>('/criteria', data);
    return response.data;
  },

  /** Screen a specific property against user criteria */
  async screenProperty(propertyId: number): Promise<ScreeningResult> {
    const response = await api.get<ScreeningResult>(
      `/properties/${propertyId}/screening`
    );
    return response.data;
  },

  /** Get screening summary for all properties */
  async getScreeningSummary(): Promise<ScreeningSummaryItem[]> {
    const response = await api.get<ScreeningSummaryItem[]>('/screening/summary');
    return response.data;
  },
};
