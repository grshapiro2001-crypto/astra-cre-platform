import { api } from './api';

export interface Organization {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
  member_count: number;
  your_role: 'owner' | 'member';
}

export interface OrgMember {
  id: number;
  user_id: string;
  user_email: string;
  user_name?: string;
  role: 'owner' | 'member';
  status: 'pending' | 'approved';
  joined_at: string;
}

const organizationService = {
  getMyOrg: () => api.get<Organization>('/organizations/me').then((r) => r.data),

  getMembers: () => api.get<OrgMember[]>('/organizations/me/members').then((r) => r.data),

  getPending: () => api.get<OrgMember[]>('/organizations/me/pending').then((r) => r.data),

  create: (name: string) =>
    api.post<Organization>('/organizations/', { name }).then((r) => r.data),

  join: (invite_code: string) =>
    api.post<{ message: string; organization_name: string }>('/organizations/join', { invite_code }).then((r) => r.data),

  approve: (member_id: number, approve: boolean) =>
    api.post<{ message: string }>('/organizations/approve', { member_id, approve }).then((r) => r.data),

  leave: () => api.delete<{ message: string }>('/organizations/leave').then((r) => r.data),

  disband: () => api.delete<{ message: string }>('/organizations/').then((r) => r.data),

  migrateDeals: (property_ids: number[]) =>
    api.post<{ message: string }>('/organizations/migrate-deals', { property_ids }).then((r) => r.data),

  regenerateCode: () =>
    api.post<Organization>('/organizations/regenerate-code').then((r) => r.data),
};

export default organizationService;
