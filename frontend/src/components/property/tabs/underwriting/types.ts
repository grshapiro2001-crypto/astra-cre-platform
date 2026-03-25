/**
 * Shared types for UW sub-page components.
 */

import type { UWInputs, UWOutputs } from '@/types/underwriting';

// ---------------------------------------------------------------------------
// Reducer Actions
// ---------------------------------------------------------------------------

export type UWAction =
  | { type: 'SET_INPUTS'; payload: Partial<UWInputs> }
  | { type: 'SET_SCENARIO_INPUT'; scenario: 'premium' | 'market'; payload: Record<string, unknown> }
  | { type: 'SET_INFLATION_CURVE'; curve: keyof Pick<UWInputs, 'rental_inflation' | 'expense_inflation' | 're_tax_inflation' | 'vacancy_pct' | 'concession_pct' | 'bad_debt_pct'>; values: number[] }
  | { type: 'SET_OUTPUTS'; payload: UWOutputs }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_COMPUTING'; payload: boolean }
  | { type: 'SET_ACTIVE_SUB_TAB'; payload: string }
  | { type: 'SET_SAVE_STATUS'; payload: string | null }
  | { type: 'SEED_FROM_PROPERTY'; inputs: UWInputs }
  | { type: 'LOAD_SAVED'; inputs: UWInputs; outputs: UWOutputs }
  | { type: 'SET_OTHER_INCOME_ITEMS'; payload: UWInputs['other_income_items'] }
  | { type: 'SET_PAYROLL_ITEMS'; payload: UWInputs['payroll_items'] }
  | { type: 'SET_CONTRACT_SERVICES_ITEMS'; payload: UWInputs['contract_services_items'] }
  | { type: 'SET_UNIT_MIX'; payload: UWInputs['unit_mix'] };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface UWState {
  inputs: UWInputs;
  outputs: UWOutputs | null;
  isLoading: boolean;
  isComputing: boolean;
  activeSubTab: string;
  hasUnsavedChanges: boolean;
  saveStatus: string | null;
}

// ---------------------------------------------------------------------------
// Sub-page props
// ---------------------------------------------------------------------------

export interface UWSubPageProps {
  inputs: UWInputs;
  outputs: UWOutputs | null;
  dispatch: React.Dispatch<UWAction>;
  isComputing: boolean;
}
