/**
 * Types for T12 line item mapping.
 */

export interface T12LineItem {
  id: number;
  property_id: number;
  raw_label: string;
  gl_code: string | null;
  section: 'revenue' | 'expense';
  subsection: string | null;
  row_index: number;
  is_subtotal: boolean;
  is_section_header: boolean;
  monthly_values: Record<string, number> | null;
  annual_total: number | null;
  t1_value: number | null;
  t2_value: number | null;
  t3_value: number | null;
  mapped_category: string | null;
  auto_confidence: number | null;
  user_confirmed: boolean;
}

export interface T12LineItemsResponse {
  items: T12LineItem[];
  categories: {
    revenue: string[];
    expense: string[];
  };
}

export interface CategoryTotal {
  annual: number;
  t3: number;
  item_count: number;
  per_unit: number | null;
}

export interface ApplyMappingResponse {
  category_totals: Record<string, CategoryTotal>;
  total_revenue: number;
  total_expenses: number;
  noi: number;
  updated_uw_fields: Record<string, number> | null;
}
