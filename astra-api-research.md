# Astra CRE — Market Intelligence API Research

## Summary

There are strong free and low-cost data sources that can power the AI market intelligence layer of the Deal Score system. The strategy: use free government APIs for structured quantitative data, free research datasets for rent/vacancy trends, and Google Maps for property geocoding. Claude web search fills the qualitative gaps.

---

## Tier 1: Free APIs (Use Immediately)

### FRED (Federal Reserve Economic Data)
- **URL:** https://fred.stlouisfed.org/docs/api/fred/
- **Cost:** Free (requires API key, instant signup)
- **Rate Limit:** 120 requests/minute
- **What it has for CRE:**
  - Employment by MSA (monthly) — "Total Nonfarm Payroll" series for every metro
  - Unemployment rate by metro (monthly)
  - Population by MSA (annual)
  - CPI/Inflation data (monthly)
  - Interest rates (daily) — 10-year Treasury, Fed Funds Rate
  - Housing starts (monthly, national/regional)
- **How to use:** Query by MSA series ID. Example: `HOUSA175MFRBDAL` = Houston employment.
  Given a property address, map the city/state to an MSA code, then pull employment + population trends.
- **CRE relevance:** Employment growth is the #1 leading indicator for apartment demand. Population growth = tenant demand. Interest rates affect cap rates and financing.
- **Integration effort:** Low — simple REST API, JSON responses, well-documented.

### Census Bureau Building Permits Survey
- **URL:** https://www.census.gov/construction/bps/msamonthly.html
- **Cost:** Free, no API key needed
- **What it has:** Monthly building permits by MSA, broken down by unit type (1-unit, 2-unit, 3-4 unit, 5+ unit)
- **CRE relevance:** 5+ unit permits = direct measure of multifamily supply pipeline. High permit activity in a submarket = future supply pressure = downward rent pressure. This is THE leading supply indicator.
- **Format:** Downloadable CSV/Excel files. Can be scraped or batch-downloaded monthly.
- **Integration effort:** Medium — no REST API, need to download and parse CSV files. Could automate with a monthly cron job.

### HUD SOCDS Building Permits Database
- **URL:** https://socds.huduser.gov/permits/
- **Cost:** Free
- **What it has:** Same Census permit data but with a nicer query interface. Historical data back to 1980 by metro, county, and place. Can filter by structure type (5+ units for multifamily).
- **CRE relevance:** Same as above, slightly easier to query historically.
- **Integration effort:** Medium — web-based query tool, would need scraping or manual download.

### HUD Fair Market Rents (FMR)
- **URL:** https://www.huduser.gov/portal/datasets/fmr.html
- **Cost:** Free API
- **What it has:** Annual Fair Market Rents by ZIP code, county, and metro. Broken down by bedroom count (0BR-4BR).
- **CRE relevance:** Government benchmark for "what rent should be" in a market. Useful as a baseline to compare against in-place rents from OMs.
- **Integration effort:** Low — REST API available.

### HUD USPS Vacancy Data
- **URL:** https://www.huduser.gov/portal/datasets/usps.html
- **Cost:** Free
- **What it has:** Quarterly vacancy rates by Census tract, aggregated from USPS mail delivery data. Breaks down residential vs. commercial vacancies.
- **CRE relevance:** Hyperlocal vacancy data — better than metro-level. Can identify specific neighborhoods with rising/falling vacancy. This is a hidden gem most CRE platforms don't use.
- **Integration effort:** Medium — bulk download, need to map property address to Census tract.

---

## Tier 2: Free Datasets (Download, No API)

### Apartment List Rent Estimates
- **URL:** https://www.apartmentlist.com/research/category/data-rent-estimates
- **Cost:** Free (downloadable CSV)
- **What it has:**
  - Monthly median rent estimates at national, state, metro, county, and city levels (back to 2017)
  - Month-over-month and year-over-year rent growth rates
  - Vacancy index by metro (monthly)
  - Time-on-market data (monthly)
- **CRE relevance:** Excellent rent trend data. Year-over-year rent growth by metro directly feeds into market sentiment scoring. Vacancy index is a demand signal. Time-on-market shows absorption speed.
- **Key insight from latest report:** National median rent $1,353 (Jan 2026), down 1.4% YoY. National vacancy at 7.3% (record high). Austin down 6.3% YoY — supply-impacted markets clearly visible.
- **Integration effort:** Low — CSV download, could automate monthly fetch. No API but stable URL pattern.

### Zillow Research Data
- **URL:** https://www.zillow.com/research/data/
- **Cost:** Free (downloadable CSV)
- **What it has:**
  - Zillow Observed Rent Index (ZORI) — smoothed rent time series by metro, county, ZIP
  - Zillow Home Value Index (ZHVI) — for context on buy vs. rent dynamics
  - Inventory and sale data
  - Multifamily-specific rent data (buildings with 5+ units)
- **CRE relevance:** ZORI is one of the most widely-cited rent indices. Complements Apartment List data.
- **Integration effort:** Low — CSV download.

---

## Tier 3: Paid APIs (Future Consideration)

### Google Maps Platform
- **Geocoding:** $5 per 1,000 requests (10,000 free/month under Essentials)
- **Places API:** Varies by tier ($0-$32 per 1,000 depending on fields requested)
- **What it provides for Astra:**
  - Convert property addresses to lat/lng coordinates
  - Validate and standardize addresses
  - Get neighborhood context (nearby amenities, transit, etc.)
  - Map display for property locations
- **CRE relevance:** Every property needs geocoding. Neighborhood amenity data could feed into a "location quality" sub-score.
- **Cost estimate for Astra:** At 100-500 properties/month, you'd stay well within the free tier. Even at scale, ~$5-25/month.
- **Integration effort:** Low — well-documented REST API, Python client libraries available.

### RentCast API
- **URL:** https://www.rentcast.io/api
- **Cost:** ~$50-200/month depending on tier
- **What it has:** Property-level rent estimates, comparable rentals, market statistics by ZIP code
- **CRE relevance:** Would give you comp-level rent data for specific properties, not just metro averages
- **Worth it?** Not yet — Apartment List + Zillow free data is sufficient for market-level intelligence. Revisit when you need property-level comps.

### CoStar / RealPage / Yardi Matrix
- **Cost:** $10,000-50,000+/year (institutional pricing)
- **What they have:** Everything — property-level rents, unit mixes, concession data, supply pipeline, transaction history
- **Worth it?** Not for MVP. These are the gold standard but priced for institutional shops. Maybe when Astra has paying customers.

---

## Recommended Integration Plan

### Phase 4a: MVP Market Intelligence (build now)
1. **FRED API** — Pull employment growth + population growth for the property's MSA
2. **Apartment List CSV** — Download latest rent growth + vacancy data by metro
3. **Census Permits** — Download 5+ unit permit data by MSA
4. Feed all three into the Claude market analysis prompt alongside web search results

### Phase 4b: Enhanced Intelligence (build later)
4. **HUD USPS Vacancy** — Add tract-level vacancy data for hyperlocal signal
5. **Google Maps Geocoding** — Standardize addresses, enable map display
6. **HUD FMR** — Add government rent benchmarks as comparison point

### Phase 4c: Premium Intelligence (when Astra has revenue)
7. **RentCast** — Property-level rent comps
8. **CoStar/RealPage** — Institutional-grade data (requires partnership or enterprise license)

---

## API Keys Needed

| Service | Key Required | Where to Sign Up | Free? |
|---------|-------------|-----------------|-------|
| FRED | Yes | https://fred.stlouisfed.org/docs/api/api_key.html | Yes |
| Census | Optional | https://api.census.gov/data/key_signup.html | Yes |
| Google Maps | Yes | https://console.cloud.google.com | 10K free/month |
| HUD | No | Direct download | Yes |
| Apartment List | No | Direct CSV download | Yes |
| Zillow | No | Direct CSV download | Yes |

---

## What This Means for the Deal Score

When a user uploads an OM for a property in Atlanta, GA (Buckhead submarket), the AI market intelligence layer would:

1. **FRED:** Pull Atlanta MSA employment (+2.8% YoY) and population (+1.2% YoY) → positive signal
2. **Apartment List:** Atlanta metro rent growth (-0.5% YoY), vacancy (6.8%) → slightly negative
3. **Census Permits:** Atlanta MSA issued 12,400 multifamily permits last 12 months → high supply signal
4. **Claude Web Search:** Search "Buckhead Atlanta apartment market 2026" for qualitative color — concession trends, new deliveries, major employer news
5. **Synthesize:** Employment strong but supply elevated and rents softening → market adjustment: +1 (slightly positive, employment strength offsets supply concerns)
6. **Rationale:** "Atlanta MSA shows healthy employment growth of 2.8% YoY, but elevated multifamily permitting and metro-wide rent decline of 0.5% suggest supply pressure. Buckhead specifically benefits from strong corporate tenant demand. Net adjustment: +1."

This is the kind of analysis that would take a junior analyst 30 minutes. Astra does it in 15 seconds.
