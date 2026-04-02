export type EventCategory =
  | 'deal_added'
  | 'psa_signing'
  | 'dd_deadline'
  | 'closing'
  | 'follow_up'
  | 'custom';

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  dealId?: number;
  dealName?: string;
  type: 'milestone' | 'manual';
  category?: EventCategory;
}

export interface ManualEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  dealId?: number;
  category: EventCategory;
  createdAt: string; // ISO timestamp
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  deal_added: 'Deal Added',
  psa_signing: 'PSA Signing',
  dd_deadline: 'DD Deadline',
  closing: 'Closing Date',
  follow_up: 'Follow-up',
  custom: 'Custom',
};
