/**
 * Property service for PDF upload and extraction API calls
 */
import { api } from './api';
import type { UploadResponse, PropertyDetail, PropertyListItem } from '../types/property';
export type { PropertyDetail, PropertyListItem } from '../types/property';

export const propertyService = {
  /**
   * Upload a PDF file for analysis
   */
  async uploadPDF(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  /**
   * Check upload service health
   */
  async checkHealth(): Promise<{ status: string; service: string }> {
    const response = await api.get('/upload/health');
    return response.data;
  },

  // ==================== LIBRARY FEATURE (NO LLM - database only) ====================

  /**
   * Save analyzed property to library (NO LLM - just saves to database)
   * Phase 3A: Now requires deal_folder_id and document_subtype
   * @param force - If true, skips duplicate check (for "Keep Both" scenario)
   */
  async saveToLibrary(
    extractionResult: UploadResponse,
    filename: string,
    pdfPath: string,
    dealFolderId: number,
    documentSubtype?: string,
    force?: boolean
  ): Promise<PropertyDetail> {
    // Defensive: guard against malformed extraction responses
    const ext = extractionResult?.extraction_result;
    const pInfo = ext?.property_info;
    const financials = ext?.financials_by_period;

    // Debug: log what the extraction result contains before building POST body
    console.log('[saveToLibrary] ext keys:', ext ? Object.keys(ext) : 'ext is nullish');
    console.log('[saveToLibrary] unit_mix:', Array.isArray(ext?.unit_mix) ? `${ext.unit_mix.length} items` : String(ext?.unit_mix));
    console.log('[saveToLibrary] rent_comps:', Array.isArray(ext?.rent_comps) ? `${ext.rent_comps.length} items` : String(ext?.rent_comps));
    console.log('[saveToLibrary] renovation:', ext?.renovation ? JSON.stringify(ext.renovation) : 'undefined/null');

    const url = force ? '/properties?force=true' : '/properties';

    // Build POST body — use explicit variables so we can log the exact payload
    const unitMixPayload = ext?.unit_mix ?? [];
    const rentCompsPayload = ext?.rent_comps ?? [];

    const postBody = {
      deal_name: pInfo?.deal_name || filename.replace('.pdf', ''),
      uploaded_filename: filename,
      document_type: ext?.document_type || 'Unknown',  // Required by backend — fallback to avoid Pydantic error
      deal_folder_id: dealFolderId,  // Phase 3A - REQUIRED
      document_subtype: documentSubtype,  // Phase 3A - "OM", "BOV", "Rent Roll", etc.
      property_address: pInfo?.property_address,
      property_type: pInfo?.property_type,
      submarket: pInfo?.submarket,
      metro: ext?.property_info?.metro,  // Pass metro from extraction
      year_built: pInfo?.year_built,
      total_units: pInfo?.total_units,
      total_residential_sf: pInfo?.total_sf,
      average_market_rent: ext?.average_rents?.market_rent,
      average_inplace_rent: ext?.average_rents?.in_place_rent,
      renovation_cost_per_unit: ext?.renovation?.renovation_cost_per_unit,
      renovation_total_cost: ext?.renovation?.renovation_total_cost,
      renovation_rent_premium: ext?.renovation?.renovation_rent_premium,
      renovation_roi_pct: ext?.renovation?.renovation_roi_pct,
      renovation_duration_years: ext?.renovation?.renovation_duration_years,
      renovation_stabilized_revenue: ext?.renovation?.renovation_stabilized_revenue,
      // Financial periods require `period_label` (Pydantic required field).
      // The Claude extraction doesn't include it, so inject it here.
      // Only send the period if data exists; undefined values are dropped by Axios.
      t12_financials: financials?.t12 ? { ...financials.t12, period_label: 'T12' } : undefined,
      t3_financials: financials?.t3 ? { ...financials.t3, period_label: 'T3' } : undefined,
      y1_financials: financials?.y1 ? { ...financials.y1, period_label: 'Y1' } : undefined,
      bov_pricing_tiers: ext?.bov_pricing_tiers,  // Phase 3A - BOV pricing tiers
      unit_mix: unitMixPayload,  // Always send array (never undefined)
      rent_comps: rentCompsPayload,  // Always send array (never undefined)
      raw_pdf_path: pdfPath || '',  // Required by backend — fallback to empty string
      analysis_model: 'claude-sonnet-4-5-20250929',
    };

    console.log('[saveToLibrary] POST body unit_mix:', unitMixPayload.length, 'items, rent_comps:', rentCompsPayload.length, 'items');

    const response = await api.post(url, postBody);

    console.log('[saveToLibrary] Response unit_mix:', response.data?.unit_mix?.length ?? 0, 'rent_comps:', response.data?.rent_comps?.length ?? 0);
    return response.data;
  },

  /**
   * List properties from library (NO LLM - just reads from database)
   */
  async listProperties(params?: {
    search?: string;
    property_type?: string;
    sort_by?: string;
    sort_direction?: string;
  }): Promise<{ properties: PropertyListItem[]; total: number }> {
    const response = await api.get('/properties', { params });
    return response.data;
  },

  /**
   * Get property detail by ID (NO LLM - just reads from database)
   */
  async getProperty(id: number): Promise<PropertyDetail> {
    const response = await api.get(`/properties/${id}`);
    return response.data;
  },

  /**
   * Delete property (NO LLM - just deletes from database)
   */
  async deleteProperty(id: number): Promise<void> {
    await api.delete(`/properties/${id}`);
  },

  /**
   * Re-analyze property (EXPLICIT LLM CALL - only when user explicitly requests)
   */
  async reanalyzeProperty(id: number): Promise<PropertyDetail> {
    const response = await api.post(`/properties/${id}/reanalyze`);
    return response.data;
  },

  /**
   * Update guidance price for a property (NO LLM - just updates database)
   */
  async updateGuidancePrice(propertyId: number, guidancePrice: number | null): Promise<PropertyDetail> {
    const response = await api.patch(`/properties/${propertyId}/guidance-price`, {
      guidance_price: guidancePrice,
    });
    return response.data;
  },

  /**
   * Download a professional PDF summary for a property (NO LLM - server-side PDF generation)
   */
  async downloadSummaryPdf(propertyId: number): Promise<void> {
    const response = await api.get(`/properties/${propertyId}/summary-pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    // Extract filename from Content-Disposition header if available
    const disposition = response.headers['content-disposition'];
    let filename = `Property_Summary_${propertyId}.pdf`;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match?.[1]) {
        filename = match[1];
      }
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
