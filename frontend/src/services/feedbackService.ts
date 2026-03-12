import { api } from './api';

export interface FeedbackReply {
  id: string;
  report_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  message: string;
  created_at: string;
}

export interface FeedbackReport {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  category: 'bug' | 'feature' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  title: string;
  description: string | null;
  screenshot_url: string | null;
  current_url: string | null;
  active_property_id: string | null;
  active_tab: string | null;
  active_filters_json: string | null;
  browser_info: string | null;
  viewport_size: string | null;
  created_at: string;
  updated_at: string;
  replies: FeedbackReply[];
}

export interface FeedbackCreatePayload {
  category: 'bug' | 'feature' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  screenshot_url?: string;
  current_url?: string;
  active_property_id?: string;
  active_tab?: string;
  active_filters_json?: string;
  browser_info?: string;
  viewport_size?: string;
}

interface FeedbackListResponse {
  reports: FeedbackReport[];
  total: number;
}

export const feedbackService = {
  async createReport(payload: FeedbackCreatePayload): Promise<{ id: string }> {
    const response = await api.post<{ message: string; id: string }>('/feedback/reports', payload);
    return response.data;
  },

  async listReports(): Promise<FeedbackListResponse> {
    const response = await api.get<FeedbackListResponse>('/feedback/reports');
    return response.data;
  },

  async addReply(reportId: string, message: string): Promise<void> {
    await api.post(`/feedback/reports/${reportId}/replies`, { message });
  },

  async updateStatus(reportId: string, status: string): Promise<void> {
    await api.patch(`/feedback/reports/${reportId}/status`, { status });
  },
};
