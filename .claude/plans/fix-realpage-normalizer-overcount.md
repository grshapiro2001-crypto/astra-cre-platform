# Phase 0 — RealPage Normalizer Overcount Diagnostic

## Context

Sixty 11th RealPage rent roll re-upload produces `inserted=332` instead of the
authoritative `320` physical units (306 current + 2 non-rev + 12 vacant), and
every row is tagged as occupied (100% occupancy vs. true 95.62%). The
Summary Groups block at rows 1678-1685 of the source file is the authoritative
RealPage summary and is currently not consulted by the normalizer.

Git branch: `claude/fix-realpage-normalizer-overcount-H84mn` (already on disk).

---

## Findings

### Call graph (the important one)

`upload.py:365` calls `rent_roll_normalizer.normalize_units(raw_units, column_mapping)` — **NOT** `normalize_rows()`.

- `normalize_rows()` (line 472) has a robust row-level banner state machine.
- `normalize_units()` (line 622) was added later to wrap the pre-existing
  `excel_extraction_service.extract_rent_roll()` pipeline. It receives
  already-parsed unit dicts, so banner detection is reduced to inspecting
  `unit_number` / `resident_name` text plus a `_is_banner_shaped_dict()`
  guard that checks `market_rent`, `in_place_rent`, and `sqft` are all blank.

### BANNER STATE MACHINE

- `Current/Notice/Vacant Residents` at row 7 → `CURRENT_NOTICE_VACANT` (matches
  `_BANNER_MATCHERS` rule 4 at line 66).
- `Future Residents/Applicants` at row 1644 → `FUTURE_APPLICANTS` (matches rule
  1 at line 58).
- State carries across rows via `current_section` at normalizer line 639, but
  **only if a row is successfully classified as a banner**.

**Why 332 instead of 320 — root cause #1:**
`excel_extraction_service._parse_unit_row()` at line 731 initializes
`"in_place_rent": 0` on every emitted dict. `_is_banner_shaped_dict()` at
line 664 checks `_is_blank(raw.get("in_place_rent"))`. `_is_blank(0)` returns
**False** (line 240-244: only None / empty / `n/a` / `na` / `-` / `--` /
`none` / `null` count as blank). So the Future Residents banner row never
satisfies `_is_banner_shaped_dict`, banner detection silently fails,
`current_section` stays `UNKNOWN`, and all 10 future-resident rows flow into
`_dispatch_row()` as UNKNOWN → pass `is_junk_row()` → appended to
`result.units`. **+10.**

### JUNK FILTER (`is_junk_row`, line 448)

Logic:
1. blank `unit_number` → reject
2. `unit_number` contains any `SECTION_HEADER_PATTERNS` substring → reject
3. `resident_name` has `/` AND contains a section pattern → reject
4. all of {unit_number, resident_name, market_rent, in_place_rent} blank →
   reject
5. otherwise pass

`SECTION_HEADER_PATTERNS` (line 166) includes: `current, notice, vacant,
resident, future, applicant, model, down, admin, employee, total, subtotal,
summary, average, avg, count, grand total, report, property, building`.

**Why charge-code rows pass — root cause #2:**
Charge codes in Sixty 11th block 1691-1699: `aprk, atra, arnt, astg, rrins,
con, mtm, prnt, emp, Total`.

- `emp` → substring of `employee` → REJECTED ✓
- `Total` → substring of `total` → REJECTED ✓
- `aprk, atra, arnt, astg, rrins, con, mtm, prnt` → match nothing → PASS ✗

Up to 8 could leak. In practice only 2 do because the Excel-side break at
`excel_extraction_service.py:593` (stop on unit_val containing
`total/summary/grand total/property`) fires partway through the summary
blocks. Precise count of leaks depends on which summary rows have their
label text in the Unit column vs. other columns.

### STATUS COLUMN

- Column discovered in `_map_rent_roll_columns` at line 676 only when a header
  contains the substring `status`. The Sixty 11th layout
  `[Unit, Unit Type, Sq Ft, Resident, Name, Market Rent, Charge Code, Amount,
  Resident Deposit, Other Deposit, Move In, Lease Expiration, Move Out,
  Balance]` has **no Status column**.
- `_parse_unit_row` line 725 hardcodes `"is_occupied": True` as default.
  Line 736-738 only flips to False if status text contains `vacant / unrented
  / model / employee`. With no Status column, status is None → default
  `is_occupied=True` sticks.
- Normalizer `_coerce_unit` at line 700 prefers the extractor's explicit
  `is_occupied` over `derive_is_occupied(status_val)` — so the normalizer's
  derivation path is dead code for anything coming out of
  `extract_rent_roll()`.

**Why 100% occupancy — root cause #3:**
No Status column → every row keeps default `is_occupied=True`. Move Out /
Lease Expiration are never consulted for occupancy. The "status='current'"
label seen in the UI is almost certainly a derived display of
`is_occupied=True`, not a literal stored value (the stored `status` column
is None).

### SUMMARY GROUPS BLOCK

Normalizer does NOT parse rows 1678-1685. The banner matcher rule 3 at line
62 would classify "Summary Groups" / "Totals:" as SUMMARY, but
`_is_banner_shaped_dict` again fails (in_place_rent=0) so the rows leak into
`is_junk_row` where substring matches on `total / summary` correctly reject
them. The numeric values (303,721 sqft, 320 units, 95.62% occ) are NEVER
READ — losing the authoritative RealPage aggregates.

Feasibility of using Summary Groups as cross-check: high. The block has
stable row labels (`Current/Notice/Vacant Residents`, `Future Residents/
Applicants`, `Occupied Units`, `Total Non Rev Units`, `Total Vacant Units`,
`Totals:`). Column positions: sqft, market rent, lease charges, unit count,
occupancy %. A small raw-sheet scan in `extract_rent_roll` can surface these
into the returned dict.

---

## Recommended fix — Option C (row-level + Summary Groups cross-check)

### Critical files

- `backend/app/services/extraction/rent_roll_normalizer.py`
- `backend/app/services/excel_extraction_service.py`
- `backend/app/api/routes/upload.py`
- `backend/tests/test_rent_roll_normalizer.py`

### Fix 1 — banner detection robust to `in_place_rent=0` default

`rent_roll_normalizer.py:664` — change `_is_banner_shaped_dict` from
`_is_blank(raw.get(f))` to "blank or zero" semantics for numeric fields,
so a row with the extractor's hardcoded `in_place_rent=0` still qualifies
as banner-shaped when its text fields look like a banner.

```python
def _is_banner_shaped_dict(raw):
    def _blank_or_zero(v):
        return _is_blank(v) or (isinstance(v, (int, float)) and v == 0)
    return all(_blank_or_zero(raw.get(f))
               for f in ("market_rent", "in_place_rent", "sqft"))
```

Outcome: Future Residents banner now detected → `current_section` flips to
`FUTURE_APPLICANTS` → all 10 future-resident rows routed to
`result.future_leases` (via `_dispatch_row` lines 559-581), never into
`result.units`. **-10 from the count.**

### Fix 2 — reject short-alphanumeric charge-code leaks

Two complementary changes:

A. `rent_roll_normalizer.is_junk_row` (line 448): add a shape check — when
`unit_number` is a short lowercase-alphanumeric token (≤5 chars, all lower,
no digits typical of real unit numbers like `101`, `A-2`) **and**
`market_rent` / `sqft` / `resident_name` are all blank, reject as
`charge_code_shaped`. Covers `aprk, atra, arnt, astg, rrins, con, mtm,
prnt`.

B. `excel_extraction_service._parse_rent_roll_units` line 593: extend the
break keywords to also stop on `charge code` (catches
`Summary of Charges by Charge Code` at row 1691, preventing the block from
being scanned at all).

Outcome: **-2 from the count.**

### Fix 3 — status / occupancy derivation from Move Out + Lease Expiration

`rent_roll_normalizer._coerce_unit` line 700: when the extractor's
`is_occupied` is its hardcoded default `True` AND the source has no real
Status signal, re-derive from the date columns:

- Move Out date populated and ≤ today → `vacant`, `is_occupied=False`
- Move Out populated and > today → `notice`, `is_occupied=True`
- Move Out blank AND Lease Expiration populated → `current`,
  `is_occupied=True`
- Move Out blank AND Lease Expiration blank AND resident blank → `vacant`,
  `is_occupied=False`
- Otherwise → leave as-is.

Implementation note: the extractor currently always writes
`is_occupied=True` so the "extractor set it explicitly" short-circuit at
line 700 is unreliable. Cleaner fix: have the extractor pass
`is_occupied=None` when no Status column was mapped, then the
normalizer's existing `derive_is_occupied` path (enhanced to consider
`move_out_date` / `lease_end`) takes over.

### Fix 4 — Summary Groups cross-check

`excel_extraction_service.extract_rent_roll`: after parsing units, scan
the raw sheet for rows matching `Totals:` / `Occupied Units` / `Total
Vacant Units` / `Total Non Rev Units` and capture column values into
`extraction["realpage_summary"] = {total_units, occupied, vacant,
non_rev, physical_occupancy_pct, total_sqft, total_market_rent}`.

`upload.py:486-527`: after the row-level aggregates are computed, compare
with `realpage_summary`. If they disagree by >1% on `total_units` or
`physical_occupancy_pct`, log a warning and prefer the RealPage summary
values for the property aggregates (since the PMS is authoritative).

### Invariants after fix

- `inserted == 320`
- `rr_occupied_units == 306`
- `rr_vacancy_count == 12` (non-rev either excluded from occupancy math
  or tagged with a status that excludes them; total_units stays 320)
- `rr_physical_occupancy_pct == 95.62`
- `norm.future_leases` length == 10
- No charge-code rows in `result.units`

---

## Phase 2 — Backfill

After Phase 1 deploys: re-upload the Sixty 11th RR, or call the admin
recompute endpoint (`383ed30 feat(admin): add recompute endpoint for
rent roll aggregates`) for `property_id=10`.

## Phase 3 — Tests

Add to `backend/tests/test_rent_roll_normalizer.py`:

1. `test_future_residents_banner_detected_with_zero_in_place_rent` — feed
   a unit dict with text `"Future Residents/Applicants"` in `unit_number`
   and `in_place_rent=0`, assert banner classification succeeds and
   downstream rows go to `future_leases`.
2. `test_charge_code_short_tokens_rejected` — fixture with `aprk`,
   `atra`, `mtm`, `con`, `arnt`, `astg`, `rrins`, `prnt`, `emp`, `Total`
   in `unit_number`, assert all are rejected by `is_junk_row`.
3. `test_occupancy_derived_from_move_out` — unit with populated
   `move_out_date` in the past → vacant; future → notice; null →
   current.
4. `test_realpage_summary_groups_parsed` — fixture with the Summary Groups
   block, assert `extraction["realpage_summary"]` has correct values.
5. Integration-style: full Sixty 11th-shaped fixture (320 units, 10
   future, 2 charge-code leaks, summary block) → assert
   `len(result.units)==320`, `len(result.future_leases)==10`, 306
   occupied / 12 vacant / 2 non-rev derived from Move Out dates.

---

## Commit plan (per task instructions)

Branch: `claude/fix-realpage-normalizer-overcount-H84mn`

1. `docs(rent-roll): Phase 0 diagnostic for RealPage 332-unit overcount` —
   commit this plan file.
2. `fix(rent-roll): correct RealPage banner state machine for Future Applicants section`
3. `fix(rent-roll): reject charge-code summary rows in is_junk_row`
4. `fix(rent-roll): map status from Move Out / Lease Expiration columns`
5. `feat(rent-roll): parse RealPage Summary Groups block as authoritative cross-check`
6. `test(rent-roll): add regression tests for section state, junk filter, status mapping`

Push after each commit (task instruction: "Commit and push after every
meaningful step").

## Verification

1. `pytest backend/tests/test_rent_roll_normalizer.py -v` all green.
2. Local re-upload of `RentRollwithLeaseCharges04_13_2026.xlsx` shows
   `inserted=320`, `occupied=306`, `vacant=12`, `physical_occupancy_pct=95.62`.
3. `norm.future_leases` has 10 entries with unit_numbers matching the
   pre-lease applicants.
4. After merge + Render deploy, use admin recompute endpoint on
   `property_id=10` and confirm the Overview UI shows the corrected
   aggregates.

## STOP gates

After Phase 0 → await approval (now).
After Phase 1-3 code complete → paste diff, await human review.
After PR open → paste URL, await merge approval.
