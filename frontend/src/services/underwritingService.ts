/**
 * Underwriting Engine API service.
 */

import { api } from './api';
import type { UWInputs, UWOutputs } from '@/types/underwriting';

export async function computeUnderwriting(inputs: UWInputs): Promise<UWOutputs> {
  const response = await api.post<UWOutputs>('/underwriting/compute', inputs);
  return response.data;
}

export async function saveUnderwriting(
  propertyId: number,
  inputs: UWInputs,
): Promise<{ model_id: number; saved_at: string }> {
  const response = await api.post('/underwriting/save', {
    property_id: propertyId,
    inputs,
  });
  return response.data;
}

export async function loadUnderwriting(
  propertyId: number,
): Promise<{ model_id: number; inputs: UWInputs; outputs: UWOutputs } | null> {
  try {
    const response = await api.get(`/underwriting/${propertyId}`);
    return response.data;
  } catch (err: unknown) {
    const error = err as { response?: { status: number } };
    if (error.response?.status === 404) return null;
    throw err;
  }
}
