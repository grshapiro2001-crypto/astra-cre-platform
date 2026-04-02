import { useMemo } from 'react';
import { GlassCalendar } from '@/components/ui/glass-calendar';
import { useCalendarEvents, deriveMilestoneEvents, manualToCalendarEvent } from './useCalendarEvents';
import type { DashboardDeal } from './DealCard';
import type { CalendarEvent } from './calendarTypes';

interface DashboardCalendarProps {
  deals: DashboardDeal[];
}

export function DashboardCalendar({ deals }: DashboardCalendarProps) {
  const { manualEvents, addEvent, removeEvent } = useCalendarEvents();

  const allEvents = useMemo((): CalendarEvent[] => {
    const milestones = deriveMilestoneEvents(deals);
    const manual = manualEvents.map((m) => manualToCalendarEvent(m, deals));
    return [...milestones, ...manual].sort((a, b) => a.date.localeCompare(b.date));
  }, [deals, manualEvents]);

  return (
    <GlassCalendar
      events={allEvents}
      onAddEvent={addEvent}
      onRemoveEvent={removeEvent}
      deals={deals}
      className="h-full"
    />
  );
}
