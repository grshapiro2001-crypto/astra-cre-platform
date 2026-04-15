/**
 * UWProformaPage — Interactive year-by-year proforma grid.
 *
 * Replaces the static operating statement table with an Excel-like grid
 * supporting inline editing, cell overrides, and keyboard navigation.
 */

import { useState } from 'react';
import { GLASS_CARD } from '../tabUtils';
import { cn } from '@/lib/utils';
import { ProformaGrid } from './ProformaGrid';
import type { UWSubPageProps } from './types';

// ---------------------------------------------------------------------------
// Scenario toggle (shared pattern)
// ---------------------------------------------------------------------------

function ScenarioToggle({
  active,
  onChange,
}: {
  active: 'premium' | 'market';
  onChange: (s: 'premium' | 'market') => void;
}) {
  return (
    <div className="flex items-center rounded-lg p-1 bg-white/[0.04]">
      {(['premium', 'market'] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            active === s
              ? 'bg-white/[0.08] text-white'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {s === 'premium' ? 'Premium' : 'Market'}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UWProformaPage
// ---------------------------------------------------------------------------

export function UWProformaPage({ inputs, outputs, dispatch, isComputing }: UWSubPageProps) {
  const [scenario, setScenario] = useState<'premium' | 'market'>('premium');

  const hasData = !!(outputs?.scenarios?.[scenario]?.dcf?.years?.length);

  if (!hasData) {
    return (
      <div className={cn(GLASS_CARD, 'text-center py-12')}>
        <p className="text-sm text-muted-foreground">
          {isComputing ? 'Computing proforma...' : 'No proforma data available. Adjust assumptions to compute.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ScenarioToggle active={scenario} onChange={setScenario} />
        {isComputing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Updating...
          </div>
        )}
      </div>

      <div className={cn(GLASS_CARD, 'overflow-hidden')}>
        <ProformaGrid
          inputs={inputs}
          outputs={outputs}
          dispatch={dispatch}
          isComputing={isComputing}
          scenario={scenario}
        />
      </div>
    </div>
  );
}
