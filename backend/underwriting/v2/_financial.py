"""Shared financial primitives for the underwriting v2 engine.

Centralizes calculations that must match Excel semantics (discounting,
IRR, amortization) so every module in the engine — Tax Abatement,
Retail, Renovation, Ground-Lease, and beyond — can call a single
audited entry point rather than hand-rolling its own version.
"""

from __future__ import annotations

import math
from collections.abc import Iterable

import numpy_financial as npf


def irr(cashflows: Iterable[float]) -> float | None:
    """Internal rate of return of an annual cash-flow stream.

    Solves for the rate ``r`` such that ``sum(cf_t / (1+r)**t) == 0``,
    with ``cashflows[0]`` at ``t=0``. Because equity LP/GP streams have a
    single sign change (negative year-0 contribution, non-negative
    distributions after), the IRR is unique and well defined.

    Cash flows are annual (period ``t`` occurs at time ``t``), so this is
    equivalently the XIRR for equally spaced yearly dates.

    Returns:
        The IRR as a decimal, or ``None`` when it is undefined — fewer
        than two flows, no sign change, or a non-finite solver result.
    """
    cfs = list(cashflows)
    if len(cfs) < 2:
        return None
    if not (any(cf > 0 for cf in cfs) and any(cf < 0 for cf in cfs)):
        return None

    result = npf.irr(cfs)
    rate = float(result)
    if not math.isfinite(rate):
        return None
    return rate


def excel_npv(rate: float, cashflows: Iterable[float]) -> float:
    """Net Present Value with Excel ``NPV()`` semantics.

    Excel's ``=NPV(rate, cf1, cf2, ...)`` discounts the first cash flow
    at ``t=1``, the second at ``t=2``, and so on — there is no ``t=0``
    position. ``numpy_financial.npv``, by contrast, treats ``cashflows[0]``
    as ``t=0`` (undiscounted). We align to Excel by prefixing a zero.

    The Walker & Dunlop institutional proforma
    (``Prose_Gainesville_Proforma_1_30_26_RH.xlsm``) uses Excel
    ``=NPV()`` throughout (e.g. 'Tax Abatement'!C19,
    Retail!C47). Every module in this engine that ports a W&D NPV
    formula MUST call this helper to preserve parity.

    Args:
        rate: Per-period discount rate as a decimal (e.g. ``0.065``).
        cashflows: Iterable of per-period cash flows, first entry = period 1.

    Returns:
        Sum of ``cf[i] / (1 + rate) ** (i + 1)`` for all cash flows.
        Returns ``0.0`` for an empty iterable.
    """
    cfs = list(cashflows)
    if not cfs:
        return 0.0
    return float(npf.npv(rate, [0.0, *cfs]))
