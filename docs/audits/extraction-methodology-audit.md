# Extraction Methodology Audit (Stub)

> **Stub status.** This document was created as part of Sprint 1 of the
> extraction-methodology pivot. It captures the contract that Sprint 1
> enforces and the items that have shipped. A full audit refresh — covering
> the structural cleanup items deferred to Sprints 2 and 3 — is still
> outstanding.

## The contract (post-Sprint-1)

Trailing financials (T12, T3) come from the **T12 Excel upload only**.

OM and BOV PDFs may contain trailing financial tables, but the OM/BOV
extractors **must not** write them. OM/BOV ownership is limited to:

- Property basics (name, address, units, year built, SF)
- **Y1 / Pro Forma / Stabilized financials only** (forward-looking broker guidance)
- Unit mix
- Rent comps
- Sales comps
- Renovation assumptions
- BOV-only: pricing tiers, cap rate qualifiers, return metrics, terminal & debt assumptions

Any future PR that introduces a `t12_*` or `t3_*` write path from
non-Excel sources must justify the change against this contract.

## Section 9 items shipped in Sprint 1

| Item | Description | Where |
|---|---|---|
| 1 | Strip T12/T3 directives & schema from OM Claude prompt | `backend/app/services/claude_extraction_service.py` (`OM_EXTRACTION_PROMPT`) |
| 1 | Strip T12/T3 directives & schema from BOV Claude prompt | `backend/app/services/claude_extraction_service.py` (`BOV_EXTRACTION_PROMPT`) |
| 2 | Remove t12 and t3 write branches in `update_property_from_extraction` | `backend/app/api/routes/properties.py` |
| 5 | Tag `financial_data_source` = `om`/`bov` on OM/BOV writes | `backend/app/api/routes/properties.py` |
| 6 | Defense-in-depth: log when OM/BOV runs against a t12_excel-tagged property | `backend/app/api/routes/properties.py` |
| 14 | T3 from OM dies as a side effect of items 1+2 | (verified by regression test) |

## Items deferred from Sprint 1

- **3.X — `_has_numeric_data` guard tightening**: deferred until Gate 1
  production read-only check completes. Sprint 1 deleted the helper along
  with its callers (t12/t3 branches); a tightened version may return in a
  future sprint if a new caller appears.
- **Generic-prompt strip**: `GENERIC_EXTRACTION_PROMPT` still extracts T12/T3.
  Out of Sprint 1 scope (decision: OM + BOV only).

## Items deferred to Sprint 2

- Production backfill SQL for properties with T12/T3 ghost columns from
  pre-Sprint-1 OM/BOV extractions.
- Frontend empty states for the Financials tab when only OM/BOV data exists
  (no T12 Excel uploaded yet).

## Items deferred to Sprint 3

- `total_units` / `average_*_rent` precedence between OM and rent roll.
- `property_unit_mix` ownership (rent roll vs. OM).
- T12 Excel temporal guard (don't let an older Excel overwrite newer one).
- Per-field provenance JSONB.
- `asking_price` column.
- Ghost-column drop migration.
- PDF-to-existing-property bug.

## TODO: full audit refresh

This stub is intentionally narrow. A complete audit document — with
historical context, a full Section-9 list, and detailed reasoning for each
item — is still TODO. The Sprint 1 PR description should be the primary
reference until that refresh ships.
