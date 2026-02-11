/**
 * Screening details modal — shows full checks array in a table
 */
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { criteriaService } from '@/services/criteriaService';
import { ScreeningBadge } from './ScreeningBadge';
import type { ScreeningResult, ScreeningCheck } from '@/types/property';

interface ScreeningModalProps {
  open: boolean;
  onClose: () => void;
  propertyId: number | null;
  propertyName?: string;
  /** If screening data is already available (from JSON), pass it directly */
  existingData?: {
    verdict: string;
    score: number;
    checks: ScreeningCheck[];
    summary: string;
  } | null;
}

const RESULT_CONFIG: Record<string, { icon: typeof CheckCircle; className: string }> = {
  PASS: { icon: CheckCircle, className: 'text-emerald-600 dark:text-emerald-400' },
  FAIL: { icon: XCircle, className: 'text-rose-600 dark:text-rose-400' },
  SKIP: { icon: MinusCircle, className: 'text-muted-foreground' },
};

export const ScreeningModal = ({
  open,
  onClose,
  propertyId,
  propertyName,
  existingData,
}: ScreeningModalProps) => {
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !propertyId) return;

    if (existingData) {
      setResult({
        property_id: propertyId,
        property_name: propertyName ?? '',
        verdict: existingData.verdict as 'PASS' | 'FAIL' | 'REVIEW',
        score: existingData.score,
        checks: existingData.checks,
        summary: existingData.summary,
      });
      return;
    }

    const fetchResult = async () => {
      setIsLoading(true);
      try {
        const data = await criteriaService.screenProperty(propertyId);
        setResult(data);
      } catch {
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResult();
  }, [open, propertyId, existingData, propertyName]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Screening Results</span>
            {result && <ScreeningBadge verdict={result.verdict} size="md" />}
          </DialogTitle>
          {propertyName && (
            <p className="text-sm text-muted-foreground">{propertyName}</p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* Score bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    result.score >= 80 ? 'bg-emerald-500' :
                    result.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${result.score}%` }}
                />
              </div>
              <span className="text-sm font-mono font-semibold text-foreground">
                {result.score}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{result.summary}</p>

            {/* Checks table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_60px] items-center gap-2 px-3 py-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <div>Criterion</div>
                <div className="text-right">Actual</div>
                <div className="text-center">Result</div>
              </div>
              {result.checks.map((check, idx) => {
                const cfg = RESULT_CONFIG[check.result] ?? RESULT_CONFIG.SKIP;
                const Icon = cfg.icon;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'grid grid-cols-[1fr_80px_60px] items-center gap-2 px-3 py-2.5 text-sm border-b border-border last:border-b-0',
                      idx % 2 === 1 && 'bg-muted/20'
                    )}
                  >
                    <div className="text-foreground truncate">
                      {check.criterion}
                    </div>
                    <div className="text-right font-mono text-muted-foreground">
                      {check.value != null ? check.value.toLocaleString() : '\u2014'}
                    </div>
                    <div className="flex justify-center">
                      <Icon className={cn('w-4 h-4', cfg.className)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No screening criteria configured.
            <br />
            Set your criteria in Settings.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
