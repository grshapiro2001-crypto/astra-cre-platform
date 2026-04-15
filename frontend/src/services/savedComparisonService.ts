/**
 * Saved Comparison Service — API calls for saving/loading comparisons
 * Fixes BUG-006: Save Comparison actually persists to database
 */
import { api } from './api';

export interface SavedComparisonCreate {
  name: string;
  property_ids: number[];
  subject_property_id?: number | null;
  tags?: string[];
  notes?: string;
  preset_key?: string;
}

export interface SavedComparisonUpdate {
  name?: string;
  property_ids?: number[];
  subject_property_id?: number | null;
  tags?: string[];
  notes?: string;
  preset_key?: string;
}

export interface SavedComparisonResponse {
  id: number;
  user_id: string;
  organization_id: number | null;
  name: string;
  property_ids: number[];
  subject_property_id: number | null;
  tags: string[] | null;
  notes: string | null;
  preset_key: string | null;
  created_at: string;
  updated_at: string;
}

export const savedComparisonService = {
  async create(data: SavedComparisonCreate): Promise<SavedComparisonResponse> {
    const response = await api.post('/saved-comparisons', data);
    return response.data;
  },

  async list(): Promise<SavedComparisonResponse[]> {
    const response = await api.get('/saved-comparisons');
    return response.data;
  },

  async get(id: number): Promise<SavedComparisonResponse> {
    const response = await api.get(`/saved-comparisons/${id}`);
    return response.data;
  },

  async update(id: number, data: SavedComparisonUpdate): Promise<SavedComparisonResponse> {
    const response = await api.patch(`/saved-comparisons/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/saved-comparisons/${id}`);
  },
};
