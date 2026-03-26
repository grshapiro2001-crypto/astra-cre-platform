/**
 * T12 Mapping API service.
 */

import { api } from './api';
import type { T12LineItemsResponse, ApplyMappingResponse } from '@/types/t12Mapping';

export async function getT12LineItems(propertyId: number): Promise<T12LineItemsResponse> {
  const response = await api.get<T12LineItemsResponse>(
    `/t12-mapping/properties/${propertyId}/t12-line-items`,
  );
  return response.data;
}

export async function updateCategory(
  propertyId: number,
  itemId: number,
  mappedCategory: string,
): Promise<void> {
  await api.put(`/t12-mapping/properties/${propertyId}/t12-line-items/${itemId}/category`, {
    mapped_category: mappedCategory,
  });
}

export async function bulkUpdateCategories(
  propertyId: number,
  updates: { id: number; mapped_category: string }[],
): Promise<void> {
  await api.post(`/t12-mapping/properties/${propertyId}/t12-line-items/bulk-update`, {
    updates,
  });
}

export async function applyMapping(propertyId: number): Promise<ApplyMappingResponse> {
  const response = await api.post<ApplyMappingResponse>(
    `/t12-mapping/properties/${propertyId}/t12-line-items/apply-mapping`,
  );
  return response.data;
}
