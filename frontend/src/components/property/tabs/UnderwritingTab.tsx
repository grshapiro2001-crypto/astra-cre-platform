/**
 * UnderwritingTab V2 — Orchestrator with sub-page architecture.
 *
 * Manages all underwriting state via useReducer.
 * On mount: loads saved model or seeds from property data.
 * On input change: debounced 500ms compute via POST /underwriting/compute.
 * Renders 5 sub-pages: Summary, Assumptions, Proforma, Cash Flows, Detail Schedules.
 */

import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '@/types/property';
import type { UWInputs } from '@/types/underwriting';
import { createDefaultInputs } from '@/types/underwriting';
import {
  loadUnderwriting,
  computeUnderwriting,
  saveUnderwriting,
} from '@/services/underwritingService';
import { GLASS_CARD } from './tabUtils';

import type { UWState, UWAction } from './underwriting/types';
import { UWSummaryPage } from './underwriting/UWSummaryPage';
import { UWAssumptionsPage } from './underwriting/UWAssumptionsPage';
import { UWProformaPage } from './underwriting/UWProformaPage';
import { UWCashFlowsPage } from './underwriting/UWCashFlowsPage';
import { UWDetailSchedulesPage } from './underwriting/UWDetailSchedulesPage';
import { UWT12MappingPage } from './underwriting/UWT12MappingPage';

// ---------------------------------------------------------------------------
// Sub-tab definitions
// ---------------------------------------------------------------------------

const UW_SUB_TABS_BASE: { key: string; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'assumptions', label: 'Assumptions' },
  { key: 'proforma', label: 'Proforma' },
  { key: 'cashflows', label: 'Cash Flows' },
  { key: 'details', label: 'Detail Schedules' },
];

const T12_MAPPING_TAB = { key: 't12mapping', label: 'T12 Mapping' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function uwReducer(state: UWState, action: UWAction): UWState {
  switch (action.type) {
    case 'SET_INPUTS':
      return {
        ...state,
        inputs: { ...state.inputs, ...action.payload },
        hasUnsavedChanges: true,
      };

    case 'SET_SCENARIO_INPUT': {
      const prev = state.inputs[action.scenario];
      return {
        ...state,
        inputs: {
          ...state.inputs,
          [action.scenario]: { ...prev, ...action.payload },
        },
        hasUnsavedChanges: true,
      };
    }

    case 'SET_INFLATION_CURVE':
      return {
        ...state,
        inputs: { ...state.inputs, [action.curve]: action.values },
        hasUnsavedChanges: true,
      };

    case 'SET_OTHER_INCOME_ITEMS':
      return {
        ...state,
        inputs: { ...state.inputs, other_income_items: action.payload },
        hasUnsavedChanges: true,
      };

    case 'SET_PAYROLL_ITEMS':
      return {
        ...state,
        inputs: { ...state.inputs, payroll_items: action.payload },
        hasUnsavedChanges: true,
      };

    case 'SET_CONTRACT_SERVICES_ITEMS':
      return {
        ...state,
        inputs: { ...state.inputs, contract_services_items: action.payload },
        hasUnsavedChanges: true,
      };

    case 'SET_UNIT_MIX':
      return {
        ...state,
        inputs: { ...state.inputs, unit_mix: action.payload },
        hasUnsavedChanges: true,
      };

    case 'SET_OUTPUTS':
      return { ...state, outputs: action.payload, isComputing: false };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_COMPUTING':
      return { ...state, isComputing: action.payload };

    case 'SET_ACTIVE_SUB_TAB':
      return { ...state, activeSubTab: action.payload };

    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.payload };

    case 'SEED_FROM_PROPERTY':
      return {
        ...state,
        inputs: action.inputs,
        isLoading: false,
        hasUnsavedChanges: false,
      };

    case 'LOAD_SAVED':
      return {
        ...state,
        inputs: action.inputs,
        outputs: action.outputs,
        isLoading: false,
        hasUnsavedChanges: false,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Seed inputs from property data
// ---------------------------------------------------------------------------

function seedInputsFromProperty(property: PropertyDetail): UWInputs {
  const defaults = createDefaultInputs();
  const units = property.total_units ?? 0;
  const sf = property.total_residential_sf ?? 0;

  // Unit mix mapping
  const unitMix = (property.unit_mix ?? []).map((um) => ({
    floorplan: um.floorplan_name ?? '',
    units: um.num_units ?? 0,
    sf: um.unit_sf ?? 0,
    market_rent: um.proforma_rent ?? 0,
    inplace_rent: um.in_place_rent ?? 0,
  }));

  // T12 financials for expense seeding
  const t12 = property.t12_financials;
  const t3 = property.t3_financials;

  const perUnit = (val: number | null | undefined): number => {
    if (val == null || !units) return 0;
    return Math.round(val / units);
  };

  return {
    ...defaults,
    total_units: units,
    total_sf: sf,
    unit_mix: unitMix,
    trailing_t12: t12 ? (t12 as unknown as Record<string, unknown>) : null,
    trailing_t3: t3 ? (t3 as unknown as Record<string, unknown>) : null,

    // Revenue defaults
    utility_reimb_per_unit: perUnit(t12?.utility_reimbursements),
    parking_income_per_unit: perUnit(t12?.parking_storage_income),

    // Expense defaults from T12
    utilities_per_unit: perUnit(t12?.utilities),
    repairs_per_unit: perUnit(t12?.repairs_maintenance),
    make_ready_per_unit: perUnit(t12?.turnover),
    contract_services_per_unit: perUnit(t12?.contract_services),
    marketing_per_unit: perUnit(t12?.marketing),
    ga_per_unit: perUnit(t12?.administrative),
    insurance_per_unit: perUnit(t12?.insurance_amount),

    // Tax — seed from T12 if available
    current_tax_amount: t12?.real_estate_taxes ?? 0,

    // Management fee from T12
    mgmt_fee_pct: t12?.management_fee_pct != null ? t12.management_fee_pct / 100 : 0.0275,

    // Reserves from T12
    reserves_per_unit: perUnit(t12?.replacement_reserves) || 200,

    // Default other income presets
    other_income_items: [
      { line_item: 'Application Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'Administrative Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'Pet Fee (one-time)', description: 'One-time fees annualized', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'Pet Rent', description: 'Monthly recurring', amount_per_unit: 0, input_mode: 'per_unit_month' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'Late Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_month' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'NSF Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'Early Termination Fees', description: '', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
      { line_item: 'Miscellaneous', description: 'Catch-all', amount_per_unit: 0, input_mode: 'per_unit_year' as const, fee_amount: 0, annual_income: 0 },
    ],

    // Default payroll positions
    payroll_items: [
      { position: 'Property Manager', salary: 65000, bonus: 5000, payroll_load_pct: 0.30 },
      { position: 'Assistant Manager', salary: 45000, bonus: 3000, payroll_load_pct: 0.30 },
      { position: 'Leasing Associate', salary: 38000, bonus: 2000, payroll_load_pct: 0.30 },
      { position: 'Maintenance Director', salary: 55000, bonus: 3000, payroll_load_pct: 0.30 },
      { position: 'Maintenance Tech', salary: 42000, bonus: 0, payroll_load_pct: 0.30 },
      { position: 'Groundskeeper', salary: 32000, bonus: 0, payroll_load_pct: 0.30 },
    ],

    // Default pricing modes
    premium: {
      ...defaults.premium,
      pricing_mode: 'target_irr',
      target_unlevered_irr: 0.10,
    },
    market: {
      ...defaults.market,
      pricing_mode: 'target_irr',
      target_unlevered_irr: 0.105,
    },
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function createInitialState(): UWState {
  return {
    inputs: createDefaultInputs(),
    outputs: null,
    isLoading: true,
    isComputing: false,
    activeSubTab: 'summary',
    hasUnsavedChanges: false,
    saveStatus: null,
  };
}

// ---------------------------------------------------------------------------
// UnderwritingTab Component
// ---------------------------------------------------------------------------

interface UnderwritingTabProps {
  property: PropertyDetail;
}

export function UnderwritingTab({ property }: UnderwritingTabProps) {
  const [state, dispatch] = useReducer(uwReducer, undefined, createInitialState);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputVersionRef = useRef(0);
  const initialLoadDone = useRef(false);

  // Build sub-tabs dynamically — include T12 Mapping if property has line items
  const hasT12LineItems = property.financial_data_source === 't12_excel';
  const uwSubTabs = useMemo(() => {
    if (!hasT12LineItems) return UW_SUB_TABS_BASE;
    // Insert T12 Mapping between Assumptions and Proforma
    const tabs = [...UW_SUB_TABS_BASE];
    const proformaIdx = tabs.findIndex((t) => t.key === 'proforma');
    const insertIdx = proformaIdx >= 0 ? proformaIdx : 2;
    tabs.splice(insertIdx, 0, T12_MAPPING_TAB);
    return tabs;
  }, [hasT12LineItems]);

  // ── Load saved model or seed from property ──
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    async function init() {
      try {
        const saved = await loadUnderwriting(property.id);
        if (saved) {
          dispatch({ type: 'LOAD_SAVED', inputs: saved.inputs, outputs: saved.outputs });
        } else {
          const seeded = seedInputsFromProperty(property);
          dispatch({ type: 'SEED_FROM_PROPERTY', inputs: seeded });
        }
      } catch {
        const seeded = seedInputsFromProperty(property);
        dispatch({ type: 'SEED_FROM_PROPERTY', inputs: seeded });
      }
    }
    init();
  }, [property]);

  // ── Debounced compute on input changes ──
  useEffect(() => {
    if (state.isLoading) return;

    inputVersionRef.current += 1;
    const currentVersion = inputVersionRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_COMPUTING', payload: true });
      try {
        const outputs = await computeUnderwriting(state.inputs);
        // Only apply if still the latest version
        if (inputVersionRef.current === currentVersion) {
          dispatch({ type: 'SET_OUTPUTS', payload: outputs });
        }
      } catch (err) {
        console.error('Compute failed:', err);
        dispatch({ type: 'SET_COMPUTING', payload: false });
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state.inputs, state.isLoading]);

  // ── Save handler ──
  const handleSave = useCallback(async () => {
    dispatch({ type: 'SET_SAVE_STATUS', payload: 'Saving...' });
    try {
      await saveUnderwriting(property.id, state.inputs);
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'Saved' });
      setTimeout(() => dispatch({ type: 'SET_SAVE_STATUS', payload: null }), 2000);
    } catch {
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'Save failed' });
      setTimeout(() => dispatch({ type: 'SET_SAVE_STATUS', payload: null }), 3000);
    }
  }, [property.id, state.inputs]);

  // ── Loading state ──
  if (state.isLoading) {
    return (
      <div className={cn(GLASS_CARD, 'text-center py-16')}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading underwriting model...</p>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center rounded-lg p-1 bg-muted/50">
          {uwSubTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => dispatch({ type: 'SET_ACTIVE_SUB_TAB', payload: tab.key })}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                state.activeSubTab === tab.key
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {state.saveStatus && (
            <span
              className={cn(
                'text-xs',
                state.saveStatus === 'Saved'
                  ? 'text-emerald-500'
                  : state.saveStatus === 'Save failed'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
              )}
            >
              {state.saveStatus}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!state.hasUnsavedChanges}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              state.hasUnsavedChanges
                ? 'border-primary text-primary hover:bg-primary/10'
                : 'border-border text-muted-foreground cursor-not-allowed',
            )}
          >
            Save
          </button>
        </div>
      </div>

      {/* Active sub-page */}
      {state.activeSubTab === 'summary' && (
        <UWSummaryPage
          inputs={state.inputs}
          outputs={state.outputs}
          dispatch={dispatch}
          isComputing={state.isComputing}
        />
      )}
      {state.activeSubTab === 'assumptions' && (
        <UWAssumptionsPage
          inputs={state.inputs}
          outputs={state.outputs}
          dispatch={dispatch}
          isComputing={state.isComputing}
        />
      )}
      {state.activeSubTab === 't12mapping' && hasT12LineItems && (
        <UWT12MappingPage
          inputs={state.inputs}
          outputs={state.outputs}
          dispatch={dispatch}
          isComputing={state.isComputing}
          property={property}
        />
      )}
      {state.activeSubTab === 'proforma' && (
        <UWProformaPage
          inputs={state.inputs}
          outputs={state.outputs}
          dispatch={dispatch}
          isComputing={state.isComputing}
        />
      )}
      {state.activeSubTab === 'cashflows' && (
        <UWCashFlowsPage
          inputs={state.inputs}
          outputs={state.outputs}
          dispatch={dispatch}
          isComputing={state.isComputing}
        />
      )}
      {state.activeSubTab === 'details' && (
        <UWDetailSchedulesPage
          inputs={state.inputs}
          outputs={state.outputs}
          dispatch={dispatch}
          isComputing={state.isComputing}
        />
      )}
    </div>
  );
}
