import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  getDate,
  differenceInDays,
  parseISO,
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CalendarEvent, EventCategory } from '@/components/dashboard/calendarTypes';
import { CATEGORY_LABELS } from '@/components/dashboard/calendarTypes';
import type { DashboardDeal } from '@/components/dashboard/DealCard';

/* ─── Scrollbar Hide ─── */
const ScrollbarHide = () => (
  <style>{`.scrollbar-hide::-webkit-scrollbar{display:none}.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}`}</style>
);

/* ─── Urgency Badge ─── */
function UrgencyBadge({ date }: { date: string }) {
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return <span className="text-[9px] font-mono text-zinc-700">Past</span>;
  if (days <= 3)
    return (
      <span className="flex items-center gap-1 text-[9px] font-mono text-white font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        {days === 0 ? 'Today' : `${days}d`}
      </span>
    );
  if (days <= 7)
    return <span className="text-[9px] font-mono text-zinc-400">{days}d</span>;
  return <span className="text-[9px] font-mono text-zinc-600">{days}d</span>;
}

/* ─── Event Card ─── */
function EventCard({
  event,
  onRemove,
}: {
  event: CalendarEvent;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="group flex items-stretch gap-3 rounded-xl p-3 border border-white/[0.04] bg-white/[0.02] hover:border-white/10 transition-all">
      <div
        className={cn(
          'w-[2px] rounded-full shrink-0',
          event.type === 'milestone' ? 'bg-white' : 'bg-zinc-600'
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
        {event.dealName && (
          <p className="text-[10px] font-mono text-zinc-600 mt-0.5 truncate">{event.dealName}</p>
        )}
        {event.category && event.category !== 'deal_added' && event.category !== 'custom' && (
          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[7px] font-mono uppercase tracking-widest bg-white/[0.04] text-zinc-500 border border-white/[0.04]">
            {CATEGORY_LABELS[event.category]}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end justify-between shrink-0">
        <UrgencyBadge date={event.date} />
        {event.type === 'manual' && onRemove && (
          <button
            onClick={() => onRemove(event.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-700 hover:text-zinc-400"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Inline Event Form ─── */
function EventForm({
  selectedDate,
  deals,
  onSubmit,
  onCancel,
}: {
  selectedDate: Date;
  deals?: DashboardDeal[];
  onSubmit: (data: { title: string; date: string; dealId?: number; category: EventCategory }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(format(selectedDate, 'yyyy-MM-dd'));
  const [dealId, setDealId] = React.useState<number | undefined>();
  const [category, setCategory] = React.useState<EventCategory>('custom');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), date, dealId, category });
    setTitle('');
  };

  const inputClass =
    'w-full rounded-lg border border-white/[0.06] bg-surface-raised/80 text-foreground px-3 py-2 text-sm placeholder:text-zinc-700 focus:border-white/15 focus:ring-1 focus:ring-white/10 outline-none transition-all';

  return (
    <motion.form
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2.5 pt-3">
        <input
          type="text"
          placeholder="e.g. PSA signing due"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className={inputClass}
          >
            <option value="psa_signing">PSA Signing</option>
            <option value="dd_deadline">DD Deadline</option>
            <option value="closing">Closing Date</option>
            <option value="follow_up">Follow-up</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {deals && deals.length > 0 && (
          <select
            value={dealId ?? ''}
            onChange={(e) => setDealId(e.target.value ? Number(e.target.value) : undefined)}
            className={inputClass}
          >
            <option value="">Link to deal (optional)</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-1.5 bg-white text-[#060608] font-bold px-4 py-2 rounded-lg text-xs transition-all hover:bg-zinc-200"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  );
}

/* ═══════════════════════════════════════════════
   Glass Calendar Component
   ═══════════════════════════════════════════════ */

export interface GlassCalendarProps {
  events: CalendarEvent[];
  onAddEvent?: (data: { title: string; date: string; dealId?: number; category: EventCategory }) => void;
  onRemoveEvent?: (id: string) => void;
  deals?: DashboardDeal[];
  className?: string;
}

export function GlassCalendar({
  events,
  onAddEvent,
  onRemoveEvent,
  deals,
  className,
}: GlassCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [view, setView] = React.useState<'weekly' | 'monthly'>('weekly');
  const [formOpen, setFormOpen] = React.useState(false);
  const stripRef = React.useRef<HTMLDivElement>(null);

  // Weekly days
  const weekDays = React.useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  // Monthly grid (includes leading/trailing days)
  const monthGrid = React.useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Events for selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayEvents = React.useMemo(
    () =>
      events
        .filter((e) => e.date === selectedDateStr)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'milestone' ? -1 : 1;
          return a.title.localeCompare(b.title);
        }),
    [events, selectedDateStr]
  );

  // Dates that have events (for dot indicators)
  const eventDates = React.useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.date));
    return set;
  }, [events]);

  // Count events for a date
  const countEvents = React.useCallback((day: Date) => {
    const ds = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.date === ds).length;
  }, [events]);

  // Scroll selected date into view
  React.useEffect(() => {
    if (stripRef.current && view === 'monthly') {
      const el = stripRef.current.querySelector('[data-selected="true"]');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate, view]);

  const handleSubmit = (data: { title: string; date: string; dealId?: number; category: EventCategory }) => {
    onAddEvent?.(data);
    setFormOpen(false);
  };

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden h-full flex flex-col',
        'liquid-glass',
        className
      )}
    >
      <ScrollbarHide />

      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 rounded-lg bg-white/[0.04] p-0.5">
            <button
              onClick={() => setView('weekly')}
              className={cn(
                'rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
                view === 'weekly'
                  ? 'bg-white text-[#060608] shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              Weekly
            </button>
            <button
              onClick={() => setView('monthly')}
              className={cn(
                'rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
                view === 'monthly'
                  ? 'bg-white text-[#060608] shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              Monthly
            </button>
          </div>
          <CalendarIcon className="w-4 h-4 text-zinc-600" />
        </div>

        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            <motion.p
              key={format(currentMonth, 'MMMM-yyyy')}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="text-3xl font-extrabold tracking-tight text-foreground"
            >
              {format(currentMonth, 'MMMM')}
              <span className="text-zinc-600 ml-2 text-lg font-normal">{format(currentMonth, 'yyyy')}</span>
            </motion.p>
          </AnimatePresence>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar Body ── */}
      {view === 'weekly' ? (
        <>
          {/* Weekly strip */}
          <div className="px-5 pb-4">
            <div ref={stripRef} className="overflow-x-auto scrollbar-hide -mx-1 px-1">
              <div className="flex gap-1">
                {weekDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const selected = isSameDay(day, selectedDate);
                  const today = isToday(day);
                  const hasEvents = eventDates.has(dateStr);
                  return (
                    <button
                      key={dateStr}
                      data-selected={selected}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        'flex flex-col items-center justify-center w-10 h-14 rounded-xl shrink-0 transition-all duration-200',
                        selected
                          ? 'bg-white text-[#060608]'
                          : today
                            ? 'ring-1 ring-white/20 text-foreground hover:bg-white/[0.04]'
                            : 'text-zinc-500 hover:bg-white/[0.04]'
                      )}
                    >
                      <span className="text-[9px] font-bold uppercase">{format(day, 'EEE').charAt(0)}</span>
                      <span className={cn('text-sm font-semibold', selected && 'font-bold')}>{getDate(day)}</span>
                      {hasEvents && !selected && <span className="w-1 h-1 rounded-full bg-zinc-400 mt-0.5" />}
                      {hasEvents && selected && <span className="w-1 h-1 rounded-full bg-[#060608] mt-0.5" />}
                      {!hasEvents && <span className="w-1 h-1 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="h-px bg-white/[0.04] mx-5" />
          {/* Weekly event cards */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 scrollbar-hide">
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Clock className="w-6 h-6 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-600">No events on {format(selectedDate, 'MMM d')}</p>
                <button onClick={() => setFormOpen(true)} className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">+ Add an event</button>
              </div>
            ) : (
              dayEvents.map((event) => (
                <EventCard key={event.id} event={event} onRemove={onRemoveEvent} />
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Monthly grid */}
          <div className="px-5 pb-3">
            <div className="grid grid-cols-7 gap-px">
              {/* Day headers */}
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[9px] font-bold text-zinc-600 uppercase py-1">{d}</div>
              ))}
              {/* Date cells */}
              {monthGrid.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const selected = isSameDay(day, selectedDate);
                const today = isToday(day);
                const outside = !isSameMonth(day, currentMonth);
                const evCount = countEvents(day);
                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDate(day); setCurrentMonth(day); }}
                    className={cn(
                      'flex flex-col items-center justify-center py-1.5 rounded-lg transition-all duration-150 min-h-[38px]',
                      selected ? 'bg-white' : 'hover:bg-white/[0.04]',
                      today && !selected && 'ring-1 ring-white/15',
                      outside && 'opacity-25',
                    )}
                  >
                    <span className={cn(
                      'text-[12px] font-semibold leading-none',
                      selected ? 'text-[#060608] font-bold' : today ? 'text-foreground' : 'text-zinc-400',
                    )}>
                      {getDate(day)}
                    </span>
                    <div className="flex gap-0.5 mt-1 min-h-[5px]">
                      {Array.from({ length: Math.min(evCount, 3) }).map((_, i) => (
                        <span key={i} className={cn('w-1 h-1 rounded-full', selected ? 'bg-[#060608]' : 'bg-zinc-500')} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="h-px bg-white/[0.04] mx-5" />
          {/* Monthly compact event list */}
          <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-hide" style={{ maxHeight: 160 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-zinc-500">{format(selectedDate, 'EEE, MMM d')}</span>
              <span className="text-[10px] text-zinc-600">{dayEvents.length > 0 ? `${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : 'No events'}</span>
            </div>
            {dayEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-white/[0.03] transition-all">
                <div className={cn('w-[3px] h-[3px] rounded-full shrink-0', ev.type === 'milestone' ? 'bg-white' : 'bg-zinc-600')} />
                <span className="text-[11px] text-foreground font-medium truncate flex-1">{ev.title}</span>
                {ev.category && ev.category !== 'custom' && ev.category !== 'deal_added' && (
                  <span className="text-[7px] font-mono uppercase tracking-widest text-zinc-600 shrink-0">{CATEGORY_LABELS[ev.category]}</span>
                )}
                <UrgencyBadge date={ev.date} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Footer ── */}
      <div className="px-5 pb-4 pt-2 border-t border-white/[0.04]">
        <AnimatePresence>
          {formOpen && (
            <EventForm
              selectedDate={selectedDate}
              deals={deals}
              onSubmit={handleSubmit}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </AnimatePresence>
        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 w-full justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.04] px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Event
          </button>
        )}
      </div>
    </div>
  );
}
