# Rent roll test fixtures

Synthetic fixtures (in-code) live inside
`backend/tests/test_rent_roll_normalizer.py`. They mimic the row shape of
the three most common PMS exports we ingest — RealPage, Yardi, Entrata —
plus the pathological banner-row case from the production incident that
triggered `StringDataRightTruncation` on `unit_number`.

Real-world uploads (redact PII before adding any) should land here as
`.xlsx` files. Read them via `openpyxl.load_workbook(...)` and feed the
cell rows through `rent_roll_normalizer.normalize_rows`.
