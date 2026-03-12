import { api } from './api';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  account_status: 'pending' | 'active' | 'suspended';
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
}

export const adminService = {
  async listUsers(): Promise<AdminUserListResponse> {
    const response = await api.get<AdminUserListResponse>('/admin/users');
    return response.data;
  },

  async updateUserStatus(userId: string, accountStatus: 'active' | 'suspended' | 'pending'): Promise<void> {
    await api.patch(`/admin/users/${userId}/status`, { account_status: accountStatus });
  },
};
