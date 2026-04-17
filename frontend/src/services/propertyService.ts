/**
 * Property service for PDF upload and extraction API calls
 */
import { api } from './api';
import type { UploadResponse, PropertyDetail, PropertyListItem } from '../types/property';
export type { PropertyDetail, PropertyListItem } from '../types/property';

export interface RejectedRentRollRow {
  row_index: number | null;
  reason: string;
  raw: Record<string, unknown>;
}

export interface RentRollIngestionSummary {
  filename: string;
  document_id: number;
  units_ingested: number;
  units_rejected: number;
  rejected_rows: RejectedRentRollRow[];
  unmapped_columns: string[];
  column_mapping: Record<string, string>;
  warnings: string[];
  header_row_detected_at: number;
  total_rows_scanned: number;
  error: string | null;
  future_leases_detected: number;
  sections_detected: Record<string, number>;
}

export interface ExcelAnalysisResponse {
  success: boolean;
  property_id: number;
  deal_folder_id: number;
  documents_processed: Array<{
    filename: string;
    doc_category: string;
    extraction_status: string;
  }>;
  extracted_summary: {
    t12_noi?: number;
    total_units?: number;
    avg_in_place_rent?: number;
    physical_occupancy?: number;
  };
  ingestion_summaries: RentRollIngestionSummary[];
}

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
      sales_comps: ext?.sales_comps ?? [],  // Sales comps from OM/BOV extraction
      raw_pdf_path: pdfPath || '',  // Required by backend — fallback to empty string
      analysis_model: 'claude-sonnet-4-5-20250929',
    };

    const response = await api.post(url, postBody);

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
   * Kick off async re-analysis (EXPLICIT LLM CALL).
   * Returns 202 immediately with { property_id, analysis_status: "processing" }.
   * Poll getAnalysisStatus() until analysis_status is "completed" or "failed".
   */
  async reanalyzeProperty(id: number): Promise<{ property_id: number; analysis_status: string }> {
    const response = await api.post(`/properties/${id}/reanalyze`);
    return response.data;
  },

  /**
   * Poll analysis status (lightweight — no LLM call).
   * Used after reanalyzeProperty() to detect when background extraction finishes.
   */
  async getAnalysisStatus(id: number): Promise<{
    property_id: number;
    analysis_status: string;
    last_analyzed_at: string | null;
    analysis_count: number;
  }> {
    const response = await api.get(`/properties/${id}/analysis-status`);
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
   * Update pipeline notes for a property (NO LLM - just updates database)
   */
  async updateNotes(propertyId: number, notes: string): Promise<PropertyDetail> {
    const response = await api.patch(`/properties/${propertyId}/notes`, null, {
      params: { notes },
    });
    return response.data;
  },

  /**
   * Update pipeline stage for a property (NO LLM - just updates database)
   */
  async updateStage(propertyId: number, stage: string): Promise<void> {
    await api.patch(`/properties/${propertyId}/stage?stage=${encodeURIComponent(stage)}`);
  },

  /** Upload a document (PDF or Excel) to a specific property */
  async uploadPropertyDocument(propertyId: number | string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(
      `/properties/${propertyId}/upload-document`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
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

  // ==================== EXCEL ANALYSIS UPLOAD ====================

  /**
   * Upload Excel files (T12 and/or Rent Roll) to create a new property analysis.
   * Creates property + deal folder in one step.
   */
  async uploadExcelAnalysis(
    files: File[],
    propertyInfo: {
      property_name: string;
      property_address: string;
      total_units?: number;
      submarket?: string;
      metro?: string;
    }
  ): Promise<ExcelAnalysisResponse> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('property_name', propertyInfo.property_name);
    formData.append('property_address', propertyInfo.property_address);
    if (propertyInfo.total_units) formData.append('total_units', String(propertyInfo.total_units));
    if (propertyInfo.submarket) formData.append('submarket', propertyInfo.submarket);
    if (propertyInfo.metro) formData.append('metro', propertyInfo.metro);

    const response = await api.post('/upload/excel-analysis', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
