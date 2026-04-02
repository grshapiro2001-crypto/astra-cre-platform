import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import type { DashboardDeal } from './DealCard';
import type { CalendarEvent, ManualEvent } from './calendarTypes';

const STORAGE_KEY = 'talisman-calendar-events';

function loadEvents(): ManualEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: ManualEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch { /* silently fail */ }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function useCalendarEvents() {
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>(loadEvents);

  const addEvent = useCallback(
    (event: Omit<ManualEvent, 'id' | 'createdAt'>) => {
      setManualEvents((prev) => {
        const next = [...prev, { ...event, id: genId(), createdAt: new Date().toISOString() }];
        saveEvents(next);
        return next;
      });
    },
    []
  );

  const removeEvent = useCallback((id: string) => {
    setManualEvents((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEvents(next);
      return next;
    });
  }, []);

  return { manualEvents, addEvent, removeEvent };
}

export function deriveMilestoneEvents(deals: DashboardDeal[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const deal of deals) {
    if (deal.uploadDate) {
      try {
        const d = new Date(deal.uploadDate);
        events.push({
          id: `milestone-added-${deal.id}`,
          date: format(d, 'yyyy-MM-dd'),
          title: `Deal Added`,
          dealId: deal.id,
          dealName: deal.name,
          type: 'milestone',
          category: 'deal_added',
        });
      } catch { /* skip invalid dates */ }
    }
  }

  return events;
}

export function manualToCalendarEvent(m: ManualEvent, deals: DashboardDeal[]): CalendarEvent {
  const deal = m.dealId ? deals.find((d) => d.id === m.dealId) : undefined;
  return {
    id: m.id,
    date: m.date,
    title: m.title,
    description: m.description,
    dealId: m.dealId,
    dealName: deal?.name,
    type: 'manual',
    category: m.category,
  };
}
