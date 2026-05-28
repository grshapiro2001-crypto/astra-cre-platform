"""Pydantic schemas for the equity Waterfall (distribution) calculation.

A deal-level (European) promote waterfall: a single combined LP+GP equity
contribution at year 0 is distributed back through the standard tier
sequence — Return of Capital, Preferred Return, GP Catch-Up, then two
IRR-hurdle promote splits. All percentages are stored as decimals
(0.08 = 8%); all monetary values are floats.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WaterfallTerms(BaseModel):
    """Promote terms governing the LP/GP split.

    Attributes:
        lp_equity_pct: LP share of the year-0 equity contribution (decimal).
        gp_equity_pct: GP share of the year-0 equity contribution (decimal).
            ``lp_equity_pct + gp_equity_pct`` must equal 1.0.
        pref_rate: Annual preferred return owed to LP (decimal).
        pref_base: ``"original"`` accrues pref on the original LP capital;
            ``"remaining"`` accrues on outstanding (unreturned) LP capital.
        pref_compounds: When True, unpaid accrued pref compounds.
        catch_up_enabled: Whether the GP catch-up tier runs.
        catch_up_pct: GP share of profit during catch-up (decimal, < 1.0 to
            keep the closed form ``pref/(1-pct)*pct`` well defined).
        hurdle_1_irr: LP IRR at which Tier 1 promote split ends.
        split_1_lp / split_1_gp: LP/GP split below ``hurdle_1_irr``.
        hurdle_2_irr: LP IRR at which Tier 2 promote split ends.
        split_2_lp / split_2_gp: LP/GP split above ``hurdle_1_irr``.
    """

    model_config = ConfigDict(frozen=True)

    lp_equity_pct: float = Field(ge=0.0, le=1.0)
    gp_equity_pct: float = Field(ge=0.0, le=1.0)
    pref_rate: float = Field(ge=0.0, le=1.0)
    pref_base: Literal["original", "remaining"] = "original"
    pref_compounds: bool = False
    catch_up_enabled: bool = True
    catch_up_pct: float = Field(default=0.0, ge=0.0, lt=1.0)
    hurdle_1_irr: float = Field(ge=0.0, le=1.0)
    split_1_lp: float = Field(ge=0.0, le=1.0)
    split_1_gp: float = Field(ge=0.0, le=1.0)
    hurdle_2_irr: float = Field(ge=0.0, le=1.0)
    split_2_lp: float = Field(ge=0.0, le=1.0)
    split_2_gp: float = Field(ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _check_consistency(self) -> "WaterfallTerms":
        if abs((self.lp_equity_pct + self.gp_equity_pct) - 1.0) > 1e-9:
            raise ValueError("lp_equity_pct + gp_equity_pct must equal 1.0")
        if abs((self.split_1_lp + self.split_1_gp) - 1.0) > 1e-9:
            raise ValueError("split_1_lp + split_1_gp must equal 1.0")
        if abs((self.split_2_lp + self.split_2_gp) - 1.0) > 1e-9:
            raise ValueError("split_2_lp + split_2_gp must equal 1.0")
        if self.hurdle_2_irr < self.hurdle_1_irr:
            raise ValueError("hurdle_2_irr must be >= hurdle_1_irr")
        return self


class WaterfallTier(BaseModel):
    """One (period x tier) row of the distribution audit trail.

    The first six fields are always present; the remaining tier-specific
    context fields are populated only for the rows they apply to.

    Attributes:
        year: 1-indexed distribution period.
        tier: One of ``return_of_capital``, ``preferred_return``,
            ``gp_catch_up``, ``tier_1_split``, ``tier_2_split``.
        cash_in: Cash entering this tier in this period.
        lp_amount: Amount paid to LP in this tier this period.
        gp_amount: Amount paid to GP in this tier this period.
        cash_out: Cash remaining after this tier.
        pref_balance_after: Unpaid accrued pref after this tier (pref rows).
        lp_capital_returned_to_date: Cumulative LP capital returned (ROC rows).
        catch_up_target: Closed-form GP catch-up target (catch-up rows).
        lp_irr_after: LP IRR achieved after this tier (split rows).
    """

    year: int
    tier: str
    cash_in: float
    lp_amount: float
    gp_amount: float
    cash_out: float
    pref_balance_after: float | None = None
    lp_capital_returned_to_date: float | None = None
    catch_up_target: float | None = None
    lp_irr_after: float | None = None


class WaterfallResult(BaseModel):
    """Top-level waterfall output.

    Attributes:
        lp_cash_flows: LP cash flows by year (index 0 = -LP contribution).
        gp_cash_flows: GP cash flows by year (index 0 = -GP contribution).
        lp_irr: LP IRR over the hold (``-inf`` if undefined).
        lp_equity_multiple: Total LP distributions / LP contributed capital.
        gp_irr: GP IRR over the hold (``-inf`` if undefined).
        total_promote: GP economics above its pro-rata equity share
            (catch-up plus the GP's excess share in the promote tiers).
        tier_schedule: Per (period x tier) audit rows.
    """

    lp_cash_flows: list[float]
    gp_cash_flows: list[float]
    lp_irr: float
    lp_equity_multiple: float
    gp_irr: float
    total_promote: float
    tier_schedule: list[WaterfallTier]
