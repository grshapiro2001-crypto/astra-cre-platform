/**
 * Property service for PDF upload and extraction API calls
 */
import { api } from './api';
import type { UploadResponse, PropertyDetail, PropertyListItem } from '../types/property';

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
    console.log('💾 Saving property to library...', {
      deal_name: extractionResult.extraction_result.property_info.deal_name || filename.replace('.pdf', ''),
      pdfPath,
      dealFolderId,
      documentSubtype,
    });

    const url = force ? '/properties?force=true' : '/properties';

    const response = await api.post(url, {
      deal_name: extractionResult.extraction_result.property_info.deal_name || filename.replace('.pdf', ''),
      uploaded_filename: filename,
      document_type: extractionResult.extraction_result.document_type,
      deal_folder_id: dealFolderId,  // Phase 3A - REQUIRED
      document_subtype: documentSubtype,  // Phase 3A - "OM", "BOV", "Rent Roll", etc.
      property_address: extractionResult.extraction_result.property_info.property_address,
      property_type: extractionResult.extraction_result.property_info.property_type,
      submarket: extractionResult.extraction_result.property_info.submarket,
      year_built: extractionResult.extraction_result.property_info.year_built,
      total_units: extractionResult.extraction_result.property_info.total_units,
      total_residential_sf: extractionResult.extraction_result.property_info.total_sf,
      average_market_rent: extractionResult.extraction_result.average_rents?.market_rent,
      average_inplace_rent: extractionResult.extraction_result.average_rents?.in_place_rent,
      t12_financials: extractionResult.extraction_result.financials_by_period.t12,
      t3_financials: extractionResult.extraction_result.financials_by_period.t3,
      y1_financials: extractionResult.extraction_result.financials_by_period.y1,
      bov_pricing_tiers: extractionResult.extraction_result.bov_pricing_tiers,  // Phase 3A - BOV pricing tiers
      raw_pdf_path: pdfPath,
      analysis_model: 'claude-sonnet-4-5-20250929',
    });

    console.log('✅ Property saved successfully!', response.data);
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
};
