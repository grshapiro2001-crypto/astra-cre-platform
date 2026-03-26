"""
Pydantic schemas and category constants for T12 line item mapping.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Category constants (W&D institutional model equivalents)
# ---------------------------------------------------------------------------

REVENUE_CATEGORIES = [
    "Scheduled Market Rent",
    "Loss to Lease",
    "Vacancy",
    "Concessions",
    "Non-Revenue Units",
    "Bad Debt",
    "Utility Reimbursements",
    "Parking Income",
    "Storage Income",
    "Other Income",
]

EXPENSE_CATEGORIES = [
    "Payroll",
    "R&M",
    "Turnover",
    "Contract",
    "Marketing",
    "G&A",
    "Utilities",
    "Property Taxes",
    "Insurance",
    "MGMT",
    "Miscellaneous",
]

SPECIAL_CATEGORIES = [
    "TOTAL",
    "Exclude",
]

ALL_CATEGORIES = REVENUE_CATEGORIES + EXPENSE_CATEGORIES + SPECIAL_CATEGORIES

# Maps taxonomy keys (from t12_taxonomy.py match_line_item) to WDIS categories
TAXONOMY_KEY_TO_CATEGORY = {
    "gsr": "Scheduled Market Rent",
    "loss_to_lease": "Loss to Lease",
    "vacancy": "Vacancy",
    "concessions": "Concessions",
    "bad_debt": "Bad Debt",
    "non_revenue_units": "Non-Revenue Units",
    "net_rental_income": None,       # subtotal — not a category
    "other_income": "Other Income",
    "egi": None,                     # subtotal
    "payroll": "Payroll",
    "utilities": "Utilities",
    "repairs_maintenance": "R&M",
    "turnover": "Turnover",
    "contract_services": "Contract",
    "marketing": "Marketing",
    "administrative": "G&A",
    "management_fee": "MGMT",
    "controllable_expenses": None,   # subtotal
    "taxes": "Property Taxes",
    "insurance": "Insurance",
    "non_controllable_expenses": None,  # subtotal
    "total_opex": None,              # subtotal
    "noi": None,                     # bottom line
}

# Maps WDIS categories to t12_financials_json field names
CATEGORY_TO_FIELD = {
    # Revenue
    "Scheduled Market Rent": "gsr",
    "Loss to Lease": "loss_to_lease",
    "Vacancy": "vacancy",
    "Concessions": "concessions",
    "Non-Revenue Units": "non_revenue_units",
    "Bad Debt": "bad_debt",
    "Utility Reimbursements": "utility_reimbursements",
    "Parking Income": "parking_storage_income",
    "Storage Income": "parking_storage_income",  # combined with parking
    "Other Income": "other_income",
    # Expenses
    "Payroll": "payroll",
    "R&M": "repairs_maintenance",
    "Turnover": "turnover",
    "Contract": "contract_services",
    "Marketing": "marketing",
    "G&A": "administrative",
    "Utilities": "utilities",
    "Property Taxes": "real_estate_taxes",
    "Insurance": "insurance_amount",
    "MGMT": "management_fee",
    "Miscellaneous": None,  # added to total_opex only
}

# Maps WDIS expense categories to UWInputs per-unit field names
CATEGORY_TO_UW_FIELD = {
    "Utilities": "utilities_per_unit",
    "R&M": "repairs_per_unit",
    "Turnover": "make_ready_per_unit",
    "Contract": "contract_services_per_unit",
    "Marketing": "marketing_per_unit",
    "G&A": "ga_per_unit",
    "Insurance": "insurance_per_unit",
}


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class T12LineItemOut(BaseModel):
    id: int
    property_id: int
    raw_label: str
    gl_code: Optional[str] = None
    section: str
    subsection: Optional[str] = None
    row_index: int
    is_subtotal: bool = False
    is_section_header: bool = False
    monthly_values: Optional[Dict[str, Any]] = None
    annual_total: Optional[float] = None
    t1_value: Optional[float] = None
    t2_value: Optional[float] = None
    t3_value: Optional[float] = None
    mapped_category: Optional[str] = None
    auto_confidence: Optional[float] = None
    user_confirmed: bool = False

    class Config:
        from_attributes = True


class T12LineItemsResponse(BaseModel):
    items: List[T12LineItemOut]
    categories: Dict[str, List[str]]  # {"revenue": [...], "expense": [...]}


class CategoryUpdateRequest(BaseModel):
    mapped_category: str


class BulkUpdateItem(BaseModel):
    id: int
    mapped_category: str


class BulkUpdateRequest(BaseModel):
    updates: List[BulkUpdateItem]


class CategoryTotal(BaseModel):
    annual: float = 0
    t3: float = 0
    item_count: int = 0
    per_unit: Optional[float] = None


class ApplyMappingResponse(BaseModel):
    category_totals: Dict[str, CategoryTotal]
    total_revenue: float = 0
    total_expenses: float = 0
    noi: float = 0
    updated_uw_fields: Optional[Dict[str, float]] = None
