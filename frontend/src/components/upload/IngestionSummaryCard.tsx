import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { RentRollIngestionSummary } from '../../services/propertyService';
import { cn } from '@/lib/utils';

interface Props {
  summaries: RentRollIngestionSummary[];
  onContinue?: () => void;
}

export const IngestionSummaryCard = ({ summaries, onContinue }: Props) => {
  if (summaries.length === 0) return null;
  return (
    <div className="space-y-3">
      {summaries.map((s) => (
        <SingleSummary key={s.document_id} summary={s} />
      ))}
      {onContinue && (
        <button
          onClick={onContinue}
          className="w-full liquid-glass px-4 py-3 text-sm font-medium text-zinc-100 hover:border-zinc-500 transition-colors"
        >
          Continue to analysis
        </button>
      )}
    </div>
  );
};

const SingleSummary = ({ summary }: { summary: RentRollIngestionSummary }) => {
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [unmappedOpen, setUnmappedOpen] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);

  const hasIssue =
    summary.units_rejected > 0 ||
    summary.unmapped_columns.length > 0 ||
    summary.warnings.length > 0 ||
    summary.error !== null;

  return (
    <div className="liquid-glass p-5 font-sans text-zinc-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            {summary.filename}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {summary.units_ingested}
            </span>
            <span className="text-sm text-zinc-400">
              units ingested
            </span>
            {summary.units_rejected > 0 && (
              <span className="text-sm text-zinc-500">
                · {summary.units_rejected} rejected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Header row {summary.header_row_detected_at >= 0 ? `at row ${summary.header_row_detected_at + 1}` : 'not detected'}
            {' · '}
            {summary.total_rows_scanned} rows scanned
          </p>
        </div>
        <div className="shrink-0">
          {hasIssue ? (
            <AlertTriangle className="h-5 w-5 text-zinc-400" aria-hidden />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-zinc-200" aria-hidden />
          )}
        </div>
      </div>

      {summary.error && (
        <div className="mt-4 border border-zinc-700 bg-zinc-900/60 p-3 rounded-lg text-xs text-zinc-300">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-zinc-500 mb-1">
            Error
          </p>
          {summary.error}
        </div>
      )}

      {summary.rejected_rows.length > 0 && (
        <CollapsibleSection
          label={`Rejected rows (${summary.rejected_rows.length})`}
          open={rejectedOpen}
          onToggle={() => setRejectedOpen((v) => !v)}
        >
          <ul className="space-y-2">
            {summary.rejected_rows.slice(0, 20).map((row, i) => (
              <li key={i} className="text-xs text-zinc-400">
                <span className="text-zinc-300">{row.reason}</span>
                <span className="ml-2 text-zinc-600">
                  {row.row_index !== null ? `· row ${row.row_index}` : ''}
                </span>
              </li>
            ))}
            {summary.rejected_rows.length > 20 && (
              <li className="text-xs text-zinc-500">
                … and {summary.rejected_rows.length - 20} more
              </li>
            )}
          </ul>
        </CollapsibleSection>
      )}

      {summary.unmapped_columns.length > 0 && (
        <CollapsibleSection
          label={`Unmapped columns (${summary.unmapped_columns.length})`}
          open={unmappedOpen}
          onToggle={() => setUnmappedOpen((v) => !v)}
        >
          <div className="flex flex-wrap gap-2">
            {summary.unmapped_columns.map((col) => (
              <span
                key={col}
                className="inline-flex text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-900/60 text-zinc-300"
              >
                {col}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {summary.warnings.length > 0 && (
        <CollapsibleSection
          label={`Warnings (${summary.warnings.length})`}
          open={warningsOpen}
          onToggle={() => setWarningsOpen((v) => !v)}
        >
          <ul className="space-y-1">
            {summary.warnings.slice(0, 20).map((w, i) => (
              <li key={i} className="text-xs text-zinc-400">
                {w}
              </li>
            ))}
            {summary.warnings.length > 20 && (
              <li className="text-xs text-zinc-500">
                … and {summary.warnings.length - 20} more
              </li>
            )}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
};

const CollapsibleSection = ({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="mt-4 border-t border-zinc-800 pt-3">
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200 transition-colors',
      )}
    >
      {open ? (
        <ChevronDown className="h-3 w-3" aria-hidden />
      ) : (
        <ChevronRight className="h-3 w-3" aria-hidden />
      )}
      {label}
    </button>
    {open && <div className="mt-3">{children}</div>}
  </div>
);
