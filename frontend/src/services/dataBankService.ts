/**
 * Data Bank Service — API calls for document uploads, sales comps, pipeline, and inventory
 * NO LLM — Pure database operations
 */
import { api } from './api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataBankDocument {
  id: number;
  filename: string;
  document_type: string;
  extraction_status: string;
  extraction_data: string | null;
  record_count: number | null;
  created_at: string;
}

export interface DataBankUploadResponse {
  document_id: number;
  document_type: string;
  extraction_status: string;
  record_count: number;
  warnings: string[];
  filename: string;
}

export interface SalesComp {
  id: number;
  property_name: string | null;
  market: string | null;
  metro: string | null;
  submarket: string | null;
  county: string | null;
  state: string | null;
  address: string | null;
  property_type: string | null;
  sale_date: string | null;
  year_built: number | null;
  year_renovated: number | null;
  units: number | null;
  avg_unit_sf: number | null;
  avg_eff_rent: number | null;
  sale_price: number | null;
  price_per_unit: number | null;
  price_per_sf: number | null;
  cap_rate: number | null;
  cap_rate_qualifier: string | null;
  occupancy: number | null;
  buyer: string | null;
  seller: string | null;
  notes: string | null;
}

export interface PipelineProject {
  id: number;
  project_name: string | null;
  address: string | null;
  county: string | null;
  metro: string | null;
  submarket: string | null;
  units: number | null;
  status: string | null;
  developer: string | null;
  delivery_quarter: string | null;
  start_quarter: string | null;
  property_type: string | null;
}

export interface SubmarketInventory {
  id: number;
  user_id: string;
  metro: string;
  submarket: string;
  total_units: number;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const dataBankService = {
  /** Upload a spreadsheet file (.xlsx, .xlsm, .csv) to the Data Bank */
  async uploadDocument(file: File): Promise<DataBankUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<DataBankUploadResponse>('/data-bank/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  /** List all uploaded documents */
  async getDocuments(): Promise<{ documents: DataBankDocument[]; total: number }> {
    const response = await api.get<{ documents: DataBankDocument[]; total: number }>(
      '/data-bank/documents',
    );
    return response.data;
  },

  /** Get a single document with full extraction data */
  async getDocument(id: number): Promise<DataBankDocument> {
    const response = await api.get<DataBankDocument>(`/data-bank/document/${id}`);
    return response.data;
  },

  /** Delete a document and all associated extracted records */
  async deleteDocument(id: number): Promise<void> {
    await api.delete(`/data-bank/document/${id}`);
  },

  /** Query sales comps with optional filters */
  async getComps(filters?: {
    metro?: string;
    submarket?: string;
    property_type?: string;
    min_units?: number;
  }): Promise<SalesComp[]> {
    const response = await api.get<SalesComp[]>('/data-bank/comps', { params: filters });
    return response.data;
  },

  /** Query pipeline projects with optional filters */
  async getPipeline(filters?: {
    submarket?: string;
    status?: string;
  }): Promise<PipelineProject[]> {
    const response = await api.get<PipelineProject[]>('/data-bank/pipeline', { params: filters });
    return response.data;
  },

  /** Set submarket inventory (upsert) */
  async setInventory(metro: string, submarket: string, total_units: number): Promise<SubmarketInventory> {
    const response = await api.post<SubmarketInventory>('/data-bank/inventory', {
      metro,
      submarket,
      total_units,
    });
    return response.data;
  },

  /** List all submarket inventories */
  async getInventories(): Promise<SubmarketInventory[]> {
    const response = await api.get<SubmarketInventory[]>('/data-bank/inventory');
    return response.data;
  },
};
