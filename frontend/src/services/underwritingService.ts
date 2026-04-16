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

export async function downloadUnderwritingExport(
  propertyId: number,
  scenario: 'premium' | 'market',
): Promise<void> {
  const response = await api.get(`/underwriting/${propertyId}/export`, {
    params: { scenario },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'];
  let filename = `Underwriting_${scenario}_${propertyId}.xlsx`;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) filename = match[1];
  }
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
