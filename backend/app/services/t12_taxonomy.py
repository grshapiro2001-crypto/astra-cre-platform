"""
T12 Canonical Line Item Taxonomy

Maps every known CRE financial line item variation to a canonical field name.
Used by the fuzzy matching engine in excel_extraction_service.py.
"""

T12_TAXONOMY = {
    "gsr": {
        "canonical": "gross_scheduled_rent",
        "keywords": [
            "gross potential rent", "gross scheduled rent", "potential rental income",
            "scheduled rent revenue", "gross rent potential", "rental revenue",
            "apt rent revenue", "residential rent", "net rental income",
            "gross rent", "total rent revenue", "rent revenue",
            "gross potential revenue", "gross rental income",
            "residential income", "apartment income", "rental income",
            "gross potential", "gross scheduled",
        ],
        "abbreviations": ["gpr", "gsr", "gpi"],
        "patterns": [r"gross\s+\w*\s*rent", r"potential\s+\w*\s*rent", r"scheduled\s+\w*\s*rent"],
    },
    "loss_to_lease": {
        "canonical": "loss_to_lease",
        "keywords": [
            "loss to lease", "gain loss to lease", "gain/loss to lease",
            "gain / loss to lease", "gain(loss) to lease",
        ],
        "abbreviations": ["ltl"],
        "patterns": [r"loss\s+to\s+lease", r"gain.*loss.*lease"],
    },
    "vacancy": {
        "canonical": "vacancy_loss",
        "keywords": [
            "vacancy loss", "vacancy & credit loss", "vacancy and credit loss",
            "loss to lease/vacancy", "economic vacancy", "physical vacancy",
            "vacancy/credit loss", "vacancy allowance", "vacancy factor",
            "less: vacancy", "less vacancy",
        ],
        "abbreviations": ["vac", "vcl"],
        "patterns": [r"vacanc\w+", r"less[\s:]*vacanc"],
    },
    "concessions": {
        "canonical": "concessions",
        "keywords": [
            "concessions", "rent concessions", "leasing concessions",
            "lease concessions", "rental concessions", "move-in concessions",
            "specials", "rent free",
        ],
        "abbreviations": [],
        "patterns": [r"concess\w+"],
    },
    "bad_debt": {
        "canonical": "bad_debt",
        "keywords": [
            "bad debt", "bad debt expense", "credit loss", "uncollectible",
            "write-offs", "write offs", "collection loss", "delinquency",
        ],
        "abbreviations": [],
        "patterns": [r"bad\s+debt", r"credit\s+loss", r"write[\s-]*off"],
    },
    "non_revenue_units": {
        "canonical": "non_revenue_units",
        "keywords": [
            "non revenue units", "non-revenue units", "non revenue",
            "non-rev units", "model/employee",
        ],
        "abbreviations": [],
        "patterns": [r"non[\s-]*rev\w*\s*unit"],
    },
    "net_rental_income": {
        "canonical": "net_rental_income",
        "keywords": [
            "net rental income", "net rent income",
        ],
        "abbreviations": ["nri"],
        "patterns": [r"net\s+rent\w*\s+income"],
    },
    "other_income": {
        "canonical": "other_income",
        "keywords": [
            "other income", "other revenue", "ancillary income", "misc income",
            "miscellaneous income", "non-rental income", "utility reimbursement",
            "utility income", "laundry income", "parking income", "pet income",
            "application fee income", "late fee income", "fee income",
            "rubs", "ratio utility billing",
        ],
        "abbreviations": [],
        "patterns": [r"other\s+\w*\s*income", r"other\s+\w*\s*revenue"],
    },
    "egi": {
        "canonical": "effective_gross_income",
        "keywords": [
            "effective gross income", "egi", "total income", "total revenue",
            "gross operating income", "total operating revenue",
            "total collected revenue", "effective gross revenue",
            "gross revenue",
        ],
        "abbreviations": ["egi", "goi"],
        "patterns": [r"effective\s+gross", r"total\s+\w*\s*income", r"total\s+\w*\s*revenue"],
    },
    "payroll": {
        "canonical": "payroll",
        "keywords": [
            "payroll", "salaries", "wages", "payroll expense",
            "salary expense", "employee expense", "personnel",
            "on-site payroll", "total payroll", "salaries & wages",
        ],
        "abbreviations": [],
        "patterns": [r"payroll", r"salar\w+", r"wage"],
    },
    "utilities": {
        "canonical": "utilities",
        "keywords": [
            "utilities", "utility expense", "total utilities",
            "water/sewer", "electric", "gas", "trash removal", "utility",
        ],
        "abbreviations": ["util"],
        "patterns": [r"utilit\w+"],
    },
    "repairs_maintenance": {
        "canonical": "repairs_and_maintenance",
        "keywords": [
            "repairs & maintenance", "repairs and maintenance", "r&m",
            "maintenance", "repairs", "maintenance & repairs",
            "building maintenance", "general maintenance",
        ],
        "abbreviations": ["r&m", "r and m"],
        "patterns": [r"repair", r"maint\w+"],
    },
    "turnover": {
        "canonical": "turnover",
        "keywords": [
            "turnover", "make ready", "turn cost",
        ],
        "abbreviations": [],
        "patterns": [r"turnover", r"make\s+ready"],
    },
    "contract_services": {
        "canonical": "contract_services",
        "keywords": [
            "contract services", "contracts", "contracted services",
        ],
        "abbreviations": [],
        "patterns": [r"contract\w*\s+service"],
    },
    "marketing": {
        "canonical": "marketing",
        "keywords": [
            "marketing", "advertising", "leasing cost",
        ],
        "abbreviations": [],
        "patterns": [r"market\w+", r"advertis\w+"],
    },
    "administrative": {
        "canonical": "administrative",
        "keywords": [
            "administrative", "general & administrative", "g&a",
            "admin", "office expense",
        ],
        "abbreviations": ["g&a"],
        "patterns": [r"admin\w+", r"g\s*&\s*a"],
    },
    "management_fee": {
        "canonical": "management_fee",
        "keywords": [
            "management fee", "management fees", "property management",
            "mgmt fee", "management expense",
        ],
        "abbreviations": ["mgmt"],
        "patterns": [r"manag\w+\s*(fee|exp)", r"mgmt"],
    },
    "controllable_expenses": {
        "canonical": "controllable_expenses",
        "keywords": [
            "controllable expenses", "controllable",
            "total controllable",
        ],
        "abbreviations": [],
        "patterns": [r"controllable"],
    },
    "taxes": {
        "canonical": "real_estate_taxes",
        "keywords": [
            "real estate taxes", "property taxes", "re taxes", "tax expense",
            "ad valorem taxes", "real property tax", "real estate tax",
            "property tax", "taxes",
        ],
        "abbreviations": ["ret"],
        "patterns": [r"r\.?e\.?\s*tax", r"propert\w+\s+tax"],
    },
    "insurance": {
        "canonical": "insurance",
        "keywords": [
            "insurance", "property insurance", "hazard insurance",
            "liability insurance", "insurance expense",
        ],
        "abbreviations": ["ins"],
        "patterns": [r"insur\w+"],
    },
    "non_controllable_expenses": {
        "canonical": "non_controllable_expenses",
        "keywords": [
            "non controllable expenses", "non-controllable expenses",
            "non controllable", "non-controllable",
        ],
        "abbreviations": [],
        "patterns": [r"non[\s-]*controllable"],
    },
    "total_opex": {
        "canonical": "total_operating_expenses",
        "keywords": [
            "total operating expenses", "total expenses", "operating expenses",
            "total opex", "total operating exp", "controllable + non-controllable",
            "total property expenses", "total expense",
        ],
        "abbreviations": ["opex"],
        "patterns": [r"total\s+\w*\s*operat\w+\s*exp", r"total\s+exp"],
    },
    "noi": {
        "canonical": "net_operating_income",
        "keywords": [
            "net operating income", "noi", "net income before debt",
            "net cash flow from operations", "net income",
            "income before debt service", "cash flow before debt",
            "net operating profit",
        ],
        "abbreviations": ["noi"],
        "patterns": [r"net\s+operat\w+\s*income", r"\bnoi\b"],
    },
}

# Mapping from taxonomy key to the summary field name used by _extract_t12_summary
TAXONOMY_TO_SUMMARY_FIELD = {
    "gsr": "gross_potential_rent",
    "loss_to_lease": "loss_to_lease",
    "vacancy": "vacancy_loss",
    "concessions": "concessions",
    "bad_debt": "bad_debt",
    "non_revenue_units": "non_revenue_units",
    "net_rental_income": "net_rental_income",
    "other_income": "other_income",
    "egi": "total_revenue",
    "payroll": "payroll",
    "utilities": "utilities",
    "repairs_maintenance": "repairs_maintenance",
    "turnover": "turnover",
    "contract_services": "contract_services",
    "marketing": "marketing",
    "administrative": "administrative",
    "management_fee": "management_fee",
    "controllable_expenses": "controllable_expenses",
    "taxes": "real_estate_taxes",
    "insurance": "insurance",
    "non_controllable_expenses": "non_controllable_expenses",
    "total_opex": "total_operating_expenses",
    "noi": "net_operating_income",
}
