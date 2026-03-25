"""
IRR Solver — standalone Newton-Raphson + bisection fallback.

Used by the V2 underwriting engine. Accepts a list of cash flows
(CF₀, CF₁, …, CFₙ) and returns the discount rate r such that
Σ CFₜ / (1+r)^t = 0.
"""

from __future__ import annotations

from typing import Optional


def solve_irr(
    cash_flows: list[float],
    guess: float = 0.10,
    max_iter: int = 100,
    tol: float = 1e-7,
) -> Optional[float]:
    """Solve IRR via Newton-Raphson with bisection fallback.

    Returns None when the solver cannot find a root (e.g. all-positive CFs).
    """
    if not cash_flows or len(cash_flows) < 2:
        return None

    r = guess

    for _ in range(max_iter):
        npv = 0.0
        dnpv = 0.0
        for t, cf in enumerate(cash_flows):
            denom = (1 + r) ** t
            if denom == 0:
                return _bisection_fallback(cash_flows)
            npv += cf / denom
            if t > 0:
                dnpv -= t * cf / ((1 + r) ** (t + 1))

        if abs(dnpv) < 1e-14:
            return _bisection_fallback(cash_flows)

        r_new = r - npv / dnpv

        if abs(r_new - r) < tol:
            return r_new

        r = r_new

        if abs(r) > 10:
            return _bisection_fallback(cash_flows)

    return _bisection_fallback(cash_flows)


def _bisection_fallback(
    cash_flows: list[float],
    lo: float = -0.5,
    hi: float = 5.0,
    max_iter: int = 200,
    tol: float = 1e-7,
) -> Optional[float]:
    """Bisection solver used when Newton diverges."""

    def npv_at(r: float) -> float:
        return sum(cf / (1 + r) ** t for t, cf in enumerate(cash_flows))

    npv_lo = npv_at(lo)
    npv_hi = npv_at(hi)

    if npv_lo * npv_hi > 0:
        return None

    for _ in range(max_iter):
        mid = (lo + hi) / 2
        npv_mid = npv_at(mid)

        if abs(npv_mid) < tol or (hi - lo) / 2 < tol:
            return mid

        if npv_mid * npv_lo < 0:
            hi = mid
        else:
            lo = mid
            npv_lo = npv_mid

    return (lo + hi) / 2
