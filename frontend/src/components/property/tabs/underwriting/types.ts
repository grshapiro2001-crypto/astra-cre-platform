/**
 * Shared types for UW sub-page components.
 */

import type { UWInputs, UWOutputs } from '@/types/underwriting';
import type { PropertyDetail } from '@/types/property';
import type {
  RenovationInput,
  RetailInput,
  RetailTenant,
  TaxAbatementInput,
} from '@/types/underwritingV2';

// Field-set union of every scalar/array field for each v2 module (excluding
// sub-lists that have dedicated actions).
export type RenovationFieldKey = Exclude<keyof RenovationInput, 'unit_types'>;
export type RetailFieldKey = Exclude<keyof RetailInput, 'tenants' | 'premium' | 'market'>;
export type TaxAbatementFieldKey = keyof TaxAbatementInput;

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
  | { type: 'SET_UNIT_MIX'; payload: UWInputs['unit_mix'] }
  // Override actions
  | { type: 'SET_OVERRIDE'; scenario: string; key: string; value: number }
  | { type: 'REMOVE_OVERRIDE'; scenario: string; key: string }
  | { type: 'CLEAR_OVERRIDES'; scenario: string }
  // V2 module actions (Renovation / Retail / Tax Abatement)
  | { type: 'SET_RENOVATION_FIELD'; field: RenovationFieldKey; value: RenovationInput[RenovationFieldKey] }
  | { type: 'SET_RENOVATION_UNIT_TYPE'; index: number; patch: Partial<RenovationInput['unit_types'][number]> }
  | { type: 'SET_RETAIL_FIELD'; field: RetailFieldKey; value: RetailInput[RetailFieldKey] }
  | { type: 'SET_RETAIL_SCENARIO'; scenario: 'premium' | 'market'; patch: Partial<RetailInput['premium']> }
  | { type: 'ADD_RETAIL_TENANT' }
  | { type: 'REMOVE_RETAIL_TENANT'; index: number }
  | { type: 'SET_RETAIL_TENANT'; index: number; patch: Partial<RetailTenant> }
  | { type: 'SET_TAX_ABATEMENT_FIELD'; field: TaxAbatementFieldKey; value: TaxAbatementInput[TaxAbatementFieldKey] };

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
  property?: PropertyDetail;
}
