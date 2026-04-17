/**
 * TaxAbatementSection — standalone v2 module input form.
 *
 * Fields map 1:1 to backend/underwriting/v2/schemas/tax_abatement.py :: TaxAbatementInput.
 * A single `re_tax_inflation` UI input is expanded behind the scenes to an
 * array of length = hold_period_years.
 */

import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  CurrencyInput,
  NumericInput,
  PercentInput,
  formatCurrency,
} from '../uwFormatters';
import type { UWSubPageProps } from '../types';
import type { TaxAbatementInput } from '@/types/underwritingV2';
import { createDefaultTaxAbatementInput } from '@/types/underwritingV2';
import { EM_DASH, EnableToggle, FieldRow, V2CollapsibleSection, PreviewStat } from './shared';

type Props = Partial<Pick<UWSubPageProps, 'inputs' | 'dispatch'>>;

// Defense-in-depth: if the reducer slice is missing (e.g. loaded state from a
// model saved before PR #155), fall back to defaults so the section renders
// collapsed and disabled instead of crashing the error boundary.
const noopDispatch: UWSubPageProps['dispatch'] = () => undefined;

export function TaxAbatementSection({ inputs, dispatch = noopDispatch }: Props) {
  const ta = inputs?.tax_abatement ?? createDefaultTaxAbatementInput();
  const reTaxInflation = ta.re_tax_inflation ?? [];

  const setField = useCallback(
    <K extends keyof TaxAbatementInput>(field: K, value: TaxAbatementInput[K]) =>
      dispatch({ type: 'SET_TAX_ABATEMENT_FIELD', field, value }),
    [dispatch],
  );

  // Single inflation input — replicate across hold_period_years.
  const reTaxInflationSingle = reTaxInflation[0] ?? 0;
  const setReTaxInflation = useCallback(
    (v: number) => {
      setField('re_tax_inflation', Array(Math.max(ta.hold_period_years, 1)).fill(v));
    },
    [setField, ta.hold_period_years],
  );

  // Implied Y1 savings preview:
  //   fmv × sales_pct × assessment_ratio × millage_rate × abatement_y1_percent
  // Uses tax_abatement.fair_market_value when set; else falls back to the
  // premium scenario purchase_price; else shows an em dash.
  const fmv = ta.fair_market_value || inputs?.premium?.purchase_price || 0;
  const impliedY1Savings = useMemo(() => {
    if (!fmv) return null;
    return (
      fmv *
      ta.sales_percent_pp *
      ta.assessment_ratio *
      ta.millage_rate *
      ta.abatement_y1_percent
    );
  }, [
    fmv,
    ta.sales_percent_pp,
    ta.assessment_ratio,
    ta.millage_rate,
    ta.abatement_y1_percent,
  ]);

  return (
    <V2CollapsibleSection title="Tax Abatement Assumptions">
      <EnableToggle
        id="tax-abatement-enabled"
        enabled={ta.enabled}
        onChange={(next) => setField('enabled', next)}
      />

      <div
        className={cn(
          'space-y-2 transition-opacity',
          !ta.enabled && 'opacity-40 pointer-events-none select-none',
        )}
        aria-hidden={!ta.enabled}
      >
        <FieldRow label="Y1 Abatement %">
          <PercentInput
            value={ta.abatement_y1_percent}
            onChange={(v) => setField('abatement_y1_percent', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Annual Spread %">
          <PercentInput
            value={ta.abatement_spread}
            onChange={(v) => setField('abatement_spread', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>

        <div className="flex items-center gap-3 py-2">
          <span className="text-xs text-muted-foreground w-40 shrink-0">
            Hold Period
          </span>
          <div className="w-36 shrink-0">
            <Slider
              min={5}
              max={15}
              step={1}
              value={[ta.hold_period_years]}
              onValueChange={([v]) => {
                const years = Math.round(v);
                setField('hold_period_years', years);
                // Keep inflation array length in sync with hold period.
                setField('re_tax_inflation', Array(years).fill(reTaxInflationSingle));
              }}
              disabled={!ta.enabled}
            />
          </div>
          <span className="text-xs text-foreground font-mono">
            {ta.hold_period_years} yr
          </span>
        </div>

        <FieldRow label="Assessment Ratio %">
          <PercentInput
            value={ta.assessment_ratio}
            onChange={(v) => setField('assessment_ratio', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Millage Rate">
          <NumericInput
            value={ta.millage_rate}
            onChange={(v) => setField('millage_rate', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Fair Market Value">
          <CurrencyInput
            value={ta.fair_market_value || null}
            onChange={(v) => setField('fair_market_value', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Sales % of Purchase">
          <PercentInput
            value={ta.sales_percent_pp}
            onChange={(v) => setField('sales_percent_pp', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Apartment Allocation">
          <PercentInput
            value={ta.apt_percent}
            onChange={(v) => setField('apt_percent', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Storm/Street Lights Y1">
          <CurrencyInput
            value={ta.storm_street_lights_y1 || null}
            onChange={(v) => setField('storm_street_lights_y1', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="Discount Rate %">
          <PercentInput
            value={ta.discount_rate}
            onChange={(v) => setField('discount_rate', v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>
        <FieldRow label="RE Tax Inflation %">
          <PercentInput
            value={reTaxInflationSingle}
            onChange={(v) => setReTaxInflation(v ?? 0)}
            disabled={!ta.enabled}
          />
        </FieldRow>

        <div className="flex gap-6 pt-3 border-t border-white/10">
          <PreviewStat
            label="Implied Y1 Savings"
            value={impliedY1Savings == null ? EM_DASH : formatCurrency(impliedY1Savings)}
          />
        </div>
      </div>
    </V2CollapsibleSection>
  );
}
