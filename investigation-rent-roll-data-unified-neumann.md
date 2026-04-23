# Investigation: Rent Roll Data Not Flowing to Underwriting Engine

**Property:** #10 "Sixty 11th"
**Symptom:** Y1 cap rate = -45.53%, revenue ≈ $0
**Branch:** `claude/fix-rent-roll-flow-Z2DAA`

---

## Root Cause (confirmed)

Two independent data paths never meet:

- **WRITE (rent roll):** normalizer writes `property.rr_*` aggregates + `total_units` + per-row `RentRollUnit` rows.
- **READ (engine):** underwriting engine reads `property.unit_mix[]` (the `PropertyUnitMix` table) and `property.total_residential_sf`.
- `PropertyUnitMix` is seeded **only** from OM/BOV Claude extraction. Rent roll data never lands there.
- Sixty 11th has rent roll data but no OM unit mix → engine iterates an empty `unit_mix[]` → GSR = 0 → Y1 NOI ≈ -OpEx → cap rate deeply negative.

### Key call sites

**Write path (rent roll → `rr_*`):**
- `backend/app/api/routes/upload.py:435-452` — `_update_aggregates` inline during chunk insert
- `backend/app/api/routes/upload.py:459-484` — `RentRollUnit` inserts (chunked savepoint fallback)
- `backend/app/api/routes/upload.py:525-562` — applies summary to `property.rr_*`
- `backend/app/api/routes/properties.py:1943-1997` — admin recompute endpoint
- `backend/app/services/rent_roll_aggregates.py:13-84` — `compute_aggregates_from_rows()` (pure)
- `backend/app/api/routes/properties.py:131-180` — `_apply_rent_roll_summary_to_property()` (null-safe writer)

**Write path (OM/BOV → `PropertyUnitMix`):**
- `backend/app/api/routes/properties.py:1235-1250` — delete-and-replace from Claude extraction
- `backend/app/services/property_service.py:212-231` — alternate save path

**Read path (engine):**
- `backend/app/services/underwriting_engine.py:44-45` — `_total_sf` from `total_residential_sf`
- `backend/app/services/underwriting_engine.py:48-56` — weighted avg rents from `inputs.unit_mix`
- `backend/app/services/underwriting_engine.py:75-76` — **GSR = Σ `um.market_rent * um.units * 12`** (the bleeding edge)
- `backend/app/services/underwriting_engine.py:91-93` — gain/loss to lease
- `backend/app/services/underwriting_engine.py:843-847` — Y1 cap rate
- `backend/app/services/underwriting_engine.py:862-865` — price per SF

**Schemas:**
- `backend/app/models/property.py:147-156` — `rr_*` columns (all `Float` / `Integer`)
- `backend/app/models/property.py:190-209` — `PropertyUnitMix` (floorplan_name, unit_type, bedroom_count, bathroom_count, num_units, unit_sf, in_place_rent, proforma_rent, proforma_rent_psf, renovation_premium)
- `backend/app/models/property.py:293-322` — `RentRollUnit` (unit_number, unit_type, sqft, status, is_occupied, market_rent, in_place_rent, …)
- `backend/app/schemas/underwriting.py:16-21` — `UnitMixInput` (floorplan, units, sf, market_rent, inplace_rent)

**Gap:** no rent-roll → unit-mix conversion helper exists anywhere in the tree.

---

## FINAL PLAN — Ranked Fix Approaches

Three approaches answer the design question. I rank them by **fit to the bug**, then by **blast radius / risk**, then by **durability**.

### ✅ Approach 1 (RECOMMENDED — immediate fix): Engine-side fallback to `rr_*`

**What:** In `underwriting_engine.py`, when `inputs.unit_mix` is empty (or all `units == 0`), synthesize a single aggregate row from `property.rr_*` before revenue math runs.

**Where:**
- `backend/app/services/underwriting_engine.py:48-56` — build a fallback `UnitMixInput(floorplan="rent_roll", units=rr_total_units, sf=rr_avg_sqft, market_rent=rr_avg_market_rent, inplace_rent=rr_avg_in_place_rent)` and use it if `inputs.unit_mix` is empty.
- Same place: fall back `_total_sf` to `rr_total_units * rr_avg_sqft` when `total_residential_sf` is null/zero.
- Keep the fallback confined to the engine input builder (likely the caller that constructs `UnderwritingInputs`) rather than mutating the property model.

**Pros:**
- Smallest diff — one place, reversible, testable in isolation.
- Preserves existing OM-extracted `unit_mix` semantics untouched (no merge conflict to resolve).
- Directly fixes Sixty 11th and every other rent-roll-only property in one PR.
- GSR, loss-to-lease, and price/SF all start working because they read the same aggregate inputs.

**Cons / caveats:**
- Loses floorplan granularity — the synthesized row is one aggregate bucket. Acceptable because the engine already reduces `unit_mix` to Σ and weighted averages; nothing downstream uses per-floorplan breakdowns for revenue.
- Renovation premium and bed/bath splits can't come from a rent roll alone; those stay absent (which is correct — we don't have that data).
- Doesn't help non-engine consumers (UI unit mix table) — they still see empty `PropertyUnitMix`. Out of scope for this bug; handled by Approach 2 as a follow-up.

**Test hook:** add a case in `backend/tests/` that builds `UnderwritingInputs` with empty `unit_mix` but populated `rr_*` and asserts GSR > 0, Y1 cap rate sane.

**Effort:** ~1 hour. Single file touched (plus test).

---

### ⏳ Approach 2 (RECOMMENDED follow-up, separate PR): Write-side — normalizer seeds `PropertyUnitMix` with a `source` tag

**What:** Extend the rent roll aggregation pipeline so it also produces `PropertyUnitMix` rows grouped by `(unit_type, bedroom_count, bathroom_count, sqft bucket)`. Add a `source` column (`'om' | 'rent_roll' | 'manual'`) to `PropertyUnitMix` so OM and rent-roll rows coexist without delete-and-replace collisions.

**Where:**
- New helper in `backend/app/services/rent_roll_aggregates.py`: `build_unit_mix_from_rows(rows) -> list[PropertyUnitMix]`.
- Call from `backend/app/api/routes/upload.py:525-562` and `backend/app/api/routes/properties.py:1977-1979` (admin recompute), gated to only replace rows where `source='rent_roll'`.
- Update the OM write sites (`properties.py:1235-1250`, `property_service.py:212-231`) to set `source='om'` and only delete OM-sourced rows.
- Alembic migration: add `source VARCHAR(16) NOT NULL DEFAULT 'om'` to `property_unit_mix`.
- Engine stays unchanged; it just sees richer `unit_mix[]` for rent-roll-only properties.

**Pros:**
- Rent roll becomes a first-class unit-mix source — UI, reports, and future consumers all benefit.
- Source tagging means reuploading an OM doesn't clobber rent roll mix and vice versa.
- Synthesized rows from rent roll preserve bed/bath/SF distributions (not just aggregates).

**Cons:**
- Schema migration. Larger blast radius across 4+ write sites.
- Rent roll `unit_type` strings ("A6", "1x1", "Studio") need a classifier to extract bedroom/bathroom counts. That classifier is its own source of bugs.
- Merge policy question when both sources populate the same floorplan — need an explicit precedence rule documented.
- If we ship this without Approach 1 first, Sixty 11th stays broken until Approach 2 lands.

**Effort:** ~1–2 days including migration, classifier, backfill script, tests.

**Recommendation:** land Approach 1 now to unbreak production; ship Approach 2 as a planned follow-up if/when UI or reporting starts needing rent-roll-sourced unit mix.

---

### ❌ Approach 3 (NOT recommended standalone): Dedicated reconciliation layer

**What:** A new service sitting between the models and the engine that merges `rr_*` aggregates + `PropertyUnitMix` + any other sources into a canonical `unit_mix[]`.

**Why ranked last:**
- The underwriting engine's input builder is already effectively this layer — adding a separate service is indirection without a second consumer.
- Solves the bug only once it *also* does what Approach 1 does (synthesize rows when unit_mix is empty), so it's strictly a superset of Approach 1 with more scaffolding.
- Worth revisiting **only** if ≥2 independent consumers end up needing reconciled unit mix (e.g., UI + engine + export). Otherwise it's premature abstraction.

**Verdict:** skip unless/until a second consumer materializes.

---

## Recommendation Summary

1. **Ship Approach 1 first** on `claude/fix-rent-roll-flow-Z2DAA` — engine-side fallback, single file, regression test on Sixty 11th-shaped inputs.
2. **Open a follow-up issue** for Approach 2 (source-tagged write-side seeding) if the product roadmap wants rent-roll unit mix visible outside the engine.
3. **Do not build Approach 3** until there's a concrete second consumer.

## Open questions for approval

- **Q1:** Confirm Approach 1 is the right scope for this PR (fix the bug, defer the write-side work).
- **Q2:** Where should the fallback live — inside `UnderwritingEngine.__init__` (closest to the bug), or in whatever caller builds `UnderwritingInputs` from the `Property` ORM object (cleaner separation)? Need to locate that caller to decide; it's likely in an engine-runner or underwriting route that I haven't mapped yet.
- **Q3:** When `rr_avg_sqft` is null but `rr_total_units` is populated (e.g., a rent roll without unit SF columns), should the fallback still produce a usable `unit_mix` row with `sf=None` (engine currently tolerates this for GSR but breaks price/SF), or skip and log?
