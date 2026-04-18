// StageAnnouncer — sr-only aria-live region that narrates stage layout
// changes (promote, open alongside, close second pane) for assistive tech.
import { useEffect, useRef, useState } from 'react';
import { useUnderwritingStageStore } from '@/store/underwritingStageStore';
import type { UWSubPage } from '@/store/underwritingStageStore';

const UW_PAGE_LABELS: Record<UWSubPage, string> = {
  summary: 'Summary',
  assumptions: 'Assumptions',
  proforma: 'Proforma',
  cashflows: 'Cash Flows',
  schedules: 'Schedules',
  t12mapping: 'T12 Mapping',
};

export function StageAnnouncer() {
  const activePane1 = useUnderwritingStageStore((s) => s.activePane1);
  const activePane2 = useUnderwritingStageStore((s) => s.activePane2);
  const [message, setMessage] = useState('');
  const prev = useRef<{ p1: UWSubPage; p2: UWSubPage | null } | null>(null);

  useEffect(() => {
    const last = prev.current;
    prev.current = { p1: activePane1, p2: activePane2 };
    if (!last) return; // skip initial mount

    if (last.p2 !== null && activePane2 === null) {
      setMessage('Closed second pane');
      return;
    }
    if (activePane2 !== null && last.p2 !== activePane2) {
      setMessage(
        `Opened ${UW_PAGE_LABELS[activePane2]} alongside ${UW_PAGE_LABELS[activePane1]}`,
      );
      return;
    }
    if (activePane1 !== last.p1) {
      setMessage(`Opened ${UW_PAGE_LABELS[activePane1]}`);
    }
  }, [activePane1, activePane2]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
