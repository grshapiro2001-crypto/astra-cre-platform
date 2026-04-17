"""Pydantic schemas for the integrated underwriting orchestrator.

Defines the request and response shapes for
``backend.underwriting.v2.integration.run_integrated_underwriting``,
which composes the multifamily proforma / DCF (``UnderwritingEngine``)
with the three v2 modules (renovation, retail, tax abatement) and
resolves the Pro_Forma_Price <-> Tax-Abatement-FMV circular dependency
via a fixed-point loop.

All percentages are stored as decimals (0.05 = 5%); all monetary values
are floats.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.underwriting import (
    OperatingStatement,
    ProformaResult,
    ScenarioResult,
    UWInputs,
)
from backend.underwriting.v2.schemas.renovation import (
    RenovationInput,
    RenovationResult,
)
from backend.underwriting.v2.schemas.retail import (
    RetailInput,
    RetailResult,
)
from backend.underwriting.v2.schemas.tax_abatement import (
    TaxAbatementInput,
    TaxAbatementResult,
)


class IntegratedUnderwritingInput(BaseModel):
    """Top-level request payload for ``POST /v2/integrated``.

    Carries the existing multifamily ``UWInputs`` plus three optional
    module inputs. A module is run only when its input is provided; the
    integrated result still composes cleanly when one or more modules
    are absent (their slot in the response is ``None``).
    """

    model_config = ConfigDict(extra="forbid")

    deal: UWInputs
    renovation: RenovationInput | None = None
    retail: RetailInput | None = None
    tax_abatement: TaxAbatementInput | None = None


class ModuleResultsBundle(BaseModel):
    """Module outputs grouped for the integrated response.

    Each entry is ``None`` when the corresponding module was not enabled
    on the request. When present, the result is the unmodified output
    of the module's calculator (these schemas are frozen and validated
    against W&D's Prose Gainesville xlsm).
    """

    renovation: RenovationResult | None = None
    retail: RetailResult | None = None
    tax_abatement: TaxAbatementResult | None = None


class IntegratedScenarioResult(BaseModel):
    """One scenario (premium or market) after module integration.

    The base ``scenario`` is the engine's ``ScenarioResult`` with the
    renovation rent premium injected into each ``DCFYearResult.gpr``
    (and downstream vacancy / NRI / total_income / mgmt_fee / NOI / NCF
    re-derived). Tax-abatement savings and retail NCF flow through the
    ``combined_*_cf`` arrays — they do NOT modify the base proforma's
    RE-tax line.

    Attributes:
        scenario: Engine output for this scenario, GPR-adjusted if the
            renovation module was enabled.
        pro_forma_price: Final converged Pro_Forma_Price for this
            scenario after the fixed-point loop.
        combined_unlevered_cf: ``hold_period_years`` entries.
            ``base.dcf.years[i].ncf
              + (tax_abatement.annual_abatement_savings[i] if enabled else 0)
              + (retail.<scenario>.annual_cash_flows[i].net_cash_flow
                  if enabled else 0)``.
        combined_levered_cf: same composition layered on
            ``base.dcf.years[i].ncf_after_debt``. Tax-abatement and
            retail debt service are NOT subtracted here today (they are
            not exposed by the module results).
        going_in_cap_rate: standard ``Y1_NOI / pro_forma_price``.
        going_in_cap_rate_adjusted: numerator inflated by the Y1
            renovation premium + Y1 abatement savings + Y1 retail NCF;
            denominator inflated by total renovation cost + abatement
            NPV + retail value. Mirrors W&D Proforma!K46 / L46.
        combined_value: ``pro_forma_price + retail.<scenario>.retail_value``
            (or just ``pro_forma_price`` when retail is disabled).
        ltv_or_ltc: When renovation is loan-financed (``finance_with_loan``
            and the deal is not a pure equity scenario), this is the
            implied LTC = ``loan_amount / (price + total_renovation_cost)``;
            otherwise it is the engine's ``actual_ltv``.
        is_ltc: True iff the value above is LTC (renovation
            loan-financed), else False (LTV).
    """

    scenario: ScenarioResult
    pro_forma_price: float
    combined_unlevered_cf: list[float]
    combined_levered_cf: list[float]
    going_in_cap_rate: float
    going_in_cap_rate_adjusted: float
    combined_value: float
    ltv_or_ltc: float
    is_ltc: bool


class ConvergenceReport(BaseModel):
    """Diagnostic summary of the per-scenario fixed-point loop.

    Attributes:
        iterations: Number of iterations the premium-scenario fixed
            point required (1 when no circular dependency exists, e.g.
            tax_abatement disabled or pricing_mode == "manual").
        converged: True when ``|price_N - price_(N-1)| <
            convergence_threshold`` was met within ``max_iterations``.
        final_price_delta: Absolute price delta of the last iteration,
            in dollars.
    """

    iterations: int = Field(ge=0)
    converged: bool
    final_price_delta: float = Field(ge=0.0)


class IntegratedUnderwritingResult(BaseModel):
    """Top-level response payload for ``POST /v2/integrated``.

    Attributes:
        proforma: Year-1 baseline proforma (unmodified — renovation
            premiums live on the per-year DCF lines, not on this Y1
            summary, to preserve the meaning of "trailing T12 vs Y1
            proforma" in the operating statement).
        scenarios: Premium and market scenario results, fully
            integrated.
        operating_statements: Per-scenario OperatingStatement, mirrors
            ``UWOutputs.operating_statements``.
        module_results: Optional renovation / retail / tax-abatement
            results.
        convergence: Diagnostic for the premium-scenario fixed-point
            loop (the one tied to Pro_Forma_Price).
    """

    proforma: ProformaResult
    scenarios: dict[str, IntegratedScenarioResult] = Field(default_factory=dict)
    operating_statements: dict[str, OperatingStatement] = Field(default_factory=dict)
    module_results: ModuleResultsBundle = Field(default_factory=ModuleResultsBundle)
    convergence: ConvergenceReport
