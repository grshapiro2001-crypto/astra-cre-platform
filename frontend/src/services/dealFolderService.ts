/**
 * Deal Folder service for folder management API calls
 * NO LLM CALLS - Pure database operations
 */
import { api } from './api';

export interface DealFolder {
  id: number;
  user_id: string;  // Fixed: UUID string
  folder_name: string;
  property_type?: string;
  property_address?: string;
  submarket?: string;
  total_units?: number;
  total_sf?: number;
  created_date: string;
  last_updated: string;
  document_count: number;
  status?: string;
  notes?: string;
}

export interface CreateDealFolderRequest {
  folder_name: string;
  property_type?: string;
  property_address?: string;
  submarket?: string;
  total_units?: number;
  total_sf?: number;
  status?: string;
  notes?: string;
}

export interface UpdateDealFolderRequest {
  folder_name?: string;
  property_type?: string;
  property_address?: string;
  submarket?: string;
  total_units?: number;
  total_sf?: number;
  status?: string;
  notes?: string;
}

export interface FolderProperty {
  id: number;
  deal_name: string;
  document_type: string;
  document_subtype?: string;
  property_type?: string;
  property_address?: string;
  upload_date: string;
  t12_noi?: number;
  y1_noi?: number;
}

export const dealFolderService = {
  /**
   * Create a new deal folder
   * NO LLM - Pure database insert
   */
  async createFolder(data: CreateDealFolderRequest): Promise<DealFolder> {
    const response = await api.post('/deal-folders', data);
    return response.data;
  },

  /**
   * List all deal folders for current user
   * NO LLM - Pure database query
   */
  async listFolders(statusFilter?: string): Promise<DealFolder[]> {
    const params = statusFilter ? { status_filter: statusFilter } : {};
    const response = await api.get('/deal-folders', { params });
    return response.data;
  },

  /**
   * Get deal folder by ID
   * NO LLM - Pure database query
   */
  async getFolder(folderId: number): Promise<DealFolder> {
    const response = await api.get(`/deal-folders/${folderId}`);
    return response.data;
  },

  /**
   * Update deal folder
   * NO LLM - Pure database update
   */
  async updateFolder(folderId: number, data: UpdateDealFolderRequest): Promise<DealFolder> {
    const response = await api.patch(`/deal-folders/${folderId}`, data);
    return response.data;
  },

  /**
   * Delete deal folder
   * NO LLM - Pure database delete
   * @param folderId - ID of folder to delete
   * @param deleteContents - If true, deletes all documents in folder. If false, orphans them.
   */
  async deleteFolder(folderId: number, deleteContents: boolean = false): Promise<void> {
    const params = deleteContents ? { delete_contents: 'true' } : {};
    await api.delete(`/deal-folders/${folderId}`, { params });
  },

  /**
   * Get all properties in a folder
   * NO LLM - Pure database query
   */
  async getFolderProperties(folderId: number): Promise<FolderProperty[]> {
    const response = await api.get(`/deal-folders/${folderId}/properties`);
    return response.data;
  },
};
