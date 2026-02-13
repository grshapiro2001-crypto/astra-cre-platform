# Market Intelligence API Integration Spec
# Layer 2 Data Sources for Astra CRE Deal Score

## Overview
Layer 2 (Market Intelligence) produces a -10 to +10 adjustment based on macro market conditions. It combines structured API data with Claude's web search for qualitative context. This spec maps the exact API endpoints, series ID patterns, and implementation details.

---

## 1. FRED API (Federal Reserve Economic Data)

### Access
- **Base URL:** `https://api.stlouisfed.org/fred/`
- **Auth:** Free API key (register at https://fred.stlouisfed.org/docs/api/api_key.html)
- **Rate Limit:** 120 requests/minute
- **Cost:** FREE
- **Format:** JSON or XML

### Key Endpoint
```
GET /fred/series/observations
?series_id={SERIES_ID}
&api_key={KEY}
&file_type=json
&observation_start={YYYY-MM-DD}
&sort_order=desc
&limit=24
```

### Series ID Patterns for MSA-Level Data

FRED uses predictable series ID patterns. For Atlanta MSA (FIPS: 12060):

| Data Point | Series ID | Frequency | Unit |
|------------|-----------|-----------|------|
| Total Nonfarm Employment | `ATLA013NA` | Monthly, SA | Thousands |
| Unemployment Rate | `ATLA013URN` | Monthly, NSA | Percent |
| Civilian Labor Force | `ATLA013LFN` | Monthly, NSA | Persons |
| Resident Population | `ATLPOP` | Annual | Thousands |
| Building Permits (All) | `ATLA013BPPRIVSA` | Monthly, SA | Units |
| GDP (Metro) | `NGMP12060` | Annual | Millions $ |

**Pattern for other MSAs:**
The series ID prefix is derived from the metro name. Some examples:
- Dallas: `DALL148...`
- Nashville: `NASH347...`  
- Denver: `DENV108...`
- Phoenix: `PHOE029...`

**Programmatic discovery:**
```
GET /fred/series/search
?search_text=employment+{metro_name}+MSA
&api_key={KEY}
&file_type=json
&order_by=popularity
&sort_order=desc
&limit=10
```

This returns the most popular series matching that metro, which almost always includes Total Nonfarm Employment first.

### What We Extract for Scoring

For any MSA, pull the last 24 months of:

1. **Employment Growth (YoY):** Compare current month to 12 months prior
   - Series: `{PREFIX}NA` (Total Nonfarm)
   - Calculation: `(current - prior_year) / prior_year * 100`
   - Signal: >2% = strong, 0-2% = moderate, <0% = contracting

2. **Unemployment Rate Trend:** Direction over last 6 months
   - Series: `{PREFIX}URN`
   - Signal: Falling = positive, Rising = negative

3. **Building Permits (Supply Proxy):** YoY change
   - Series: `{PREFIX}BPPRIVSA` or `{PREFIX}BPPRIV`
   - Signal: Rising permits = future supply pressure = slightly negative for existing owners

4. **Population Growth:** YoY from annual data
   - Series: `{PREFIX}POP`
   - Signal: >1.5% = strong demand driver

### Implementation

```python
# backend/app/services/fred_service.py

import httpx
from datetime import datetime, timedelta

FRED_BASE = "https://api.stlouisfed.org/fred"

class FREDService:
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def get_series(self, series_id: str, months: int = 24) -> list:
        """Fetch observations for a FRED series."""
        start = (datetime.now() - timedelta(days=months * 31)).strftime("%Y-%m-%d")
        params = {
            "series_id": series_id,
            "api_key": self.api_key,
            "file_type": "json",
            "observation_start": start,
            "sort_order": "desc",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{FRED_BASE}/series/observations", params=params)
            data = resp.json()
            return data.get("observations", [])
    
    async def search_series(self, metro_name: str, data_type: str) -> str:
        """Find the right series ID for a metro."""
        params = {
            "search_text": f"{data_type} {metro_name} MSA",
            "api_key": self.api_key,
            "file_type": "json",
            "order_by": "popularity",
            "sort_order": "desc",
            "limit": 5,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{FRED_BASE}/series/search", params=params)
            data = resp.json()
            series = data.get("seriess", [])
            return series[0]["id"] if series else None
    
    async def get_metro_snapshot(self, metro_name: str) -> dict:
        """Get all key economic indicators for a metro."""
        # Find series IDs
        employment_id = await self.search_series(metro_name, "total nonfarm employment")
        unemployment_id = await self.search_series(metro_name, "unemployment rate")
        permits_id = await self.search_series(metro_name, "building permits")
        population_id = await self.search_series(metro_name, "resident population")
        
        result = {}
        
        if employment_id:
            obs = await self.get_series(employment_id, 24)
            if len(obs) >= 13:
                current = float(obs[0]["value"])
                prior = float(obs[12]["value"])
                result["employment_growth_yoy"] = round((current - prior) / prior * 100, 2)
                result["employment_current"] = current
                result["employment_series"] = employment_id
        
        if unemployment_id:
            obs = await self.get_series(unemployment_id, 12)
            if len(obs) >= 2:
                result["unemployment_rate"] = float(obs[0]["value"])
                result["unemployment_6mo_ago"] = float(obs[min(5, len(obs)-1)]["value"])
                result["unemployment_trend"] = "falling" if result["unemployment_rate"] < result["unemployment_6mo_ago"] else "rising"
        
        if permits_id:
            obs = await self.get_series(permits_id, 24)
            if len(obs) >= 13:
                # Sum last 12 months vs prior 12
                recent_12 = sum(float(o["value"]) for o in obs[:12] if o["value"] != ".")
                prior_12 = sum(float(o["value"]) for o in obs[12:24] if o["value"] != ".")
                if prior_12 > 0:
                    result["permit_growth_yoy"] = round((recent_12 - prior_12) / prior_12 * 100, 2)
                result["permits_12mo"] = round(recent_12)
        
        if population_id:
            obs = await self.get_series(population_id, 36)
            if len(obs) >= 2:
                current_pop = float(obs[0]["value"])
                prior_pop = float(obs[1]["value"])
                result["population_growth"] = round((current_pop - prior_pop) / prior_pop * 100, 2)
                result["population"] = current_pop
        
        return result
```

---

## 2. Apartment List Rent Data

### Access
- **No API** — Apartment List publishes free CSV downloads
- **URL:** `https://www.apartmentlist.com/research/category/data-rent-estimates`
- **Files available:**
  - Rent estimates by city/metro/state (monthly, back to 2017)
  - Rent growth rates
  - Vacancy index
  - Time on market
- **Update frequency:** Monthly (last week of each month)
- **Cost:** FREE

### Implementation Approach

Two options:

**Option A: Pre-download and cache (recommended for MVP)**
- Download the national rent estimates CSV monthly
- Store in database: metro, month, median_1br, median_2br, yoy_growth, mom_growth
- Query locally when scoring

**Option B: Scrape on demand**
- Fetch the CSV URL programmatically
- Parse for the relevant metro
- Cache results for 30 days

```python
# backend/app/services/rent_data_service.py

import pandas as pd
import httpx

# Apartment List publishes CSVs at predictable URLs
RENT_ESTIMATES_URL = "https://www.apartmentlist.com/rentonomics/wp-content/uploads/rent_estimates_all_geographies.csv"

class RentDataService:
    
    async def fetch_rent_data(self, metro_name: str) -> dict:
        """Fetch Apartment List rent data for a metro."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(RENT_ESTIMATES_URL)
            
        # Parse CSV
        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))
        
        # Filter to metro
        metro_data = df[
            (df['geo_type'] == 'Metro') & 
            (df['geo_name'].str.contains(metro_name, case=False, na=False))
        ]
        
        if metro_data.empty:
            return None
        
        # Get most recent data
        latest = metro_data.iloc[-1]
        
        return {
            "metro": latest.get("geo_name"),
            "median_rent_1br": latest.get("median_rent_1br"),
            "median_rent_2br": latest.get("median_rent_2br"),
            "yoy_growth": latest.get("rent_yoy"),
            "mom_growth": latest.get("rent_mom"),
            "source": "Apartment List",
            "as_of": latest.get("date"),
        }
```

**Note:** The exact CSV column names may vary. On first integration, inspect the actual file headers and adjust field names accordingly.

### Alternative: HUD Fair Market Rents API
- **Base URL:** `https://www.huduser.gov/hudapi/public/fmr/data/`
- **Auth:** Free token (register at huduser.gov)
- **Endpoint:** `GET /fmr/data/{FIPS_CODE}`
- **Returns:** Fair Market Rent by bedroom count for any county/MSA
- **Limitation:** Annual data only, reflects all renters not just new leases
- **Use case:** Baseline reference, not trend data

---

## 3. Census Bureau — American Community Survey

### Access
- **Base URL:** `https://api.census.gov/data/`
- **Auth:** Free API key (https://api.census.gov/data/key_signup.html)
- **Cost:** FREE
- **Rate Limit:** 500 requests/day

### Useful Endpoints

**Housing units by county (for inventory estimates):**
```
GET /2022/acs/acs5
?get=B25024_001E,B25024_008E,B25024_009E
&for=county:{FIPS}
&in=state:{STATE_FIPS}
&key={KEY}

# B25024_001E = Total housing units
# B25024_008E = Units in structures with 20-49 units
# B25024_009E = Units in structures with 50+ units
```

**Median gross rent by county:**
```
GET /2022/acs/acs5
?get=B25031_001E,B25031_003E,B25031_004E
&for=county:{FIPS}
&in=state:{STATE_FIPS}
&key={KEY}

# B25031_001E = Median gross rent (all)
# B25031_003E = Median gross rent (1 bedroom)
# B25031_004E = Median gross rent (2 bedrooms)
```

**Use case:** Fallback for submarket inventory when user doesn't input it. Sum multifamily units in relevant counties to estimate existing stock.

---

## 4. Google Maps / Places API

### Access
- **Base URL:** `https://maps.googleapis.com/maps/api/`
- **Auth:** API key with Places and Geocoding enabled
- **Cost:** $0.005/autocomplete, $0.007/place details, $0.005/geocode
- **Budget estimate:** ~$5-15/month at moderate usage

### Use Cases for Astra

1. **Address geocoding** — Convert property address to lat/lng for distance calculations in comp matching
2. **Submarket proximity** — Calculate distances between properties for geographic comp relevance
3. **Place autocomplete** — Help users enter addresses correctly during data entry

### Implementation

```python
# backend/app/services/geocoding_service.py

import httpx

GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

class GeocodingService:
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def geocode(self, address: str) -> dict:
        """Convert address to lat/lng."""
        params = {
            "address": address,
            "key": self.api_key,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(GOOGLE_GEOCODE_URL, params=params)
            data = resp.json()
            
            if data["status"] == "OK" and data["results"]:
                loc = data["results"][0]["geometry"]["location"]
                components = data["results"][0]["address_components"]
                
                county = None
                state = None
                for comp in components:
                    if "administrative_area_level_2" in comp["types"]:
                        county = comp["long_name"]
                    if "administrative_area_level_1" in comp["types"]:
                        state = comp["short_name"]
                
                return {
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "county": county,
                    "state": state,
                    "formatted_address": data["results"][0]["formatted_address"],
                }
            return None
    
    @staticmethod
    def haversine_distance(lat1, lng1, lat2, lng2) -> float:
        """Calculate distance in miles between two coordinates."""
        from math import radians, cos, sin, asin, sqrt
        lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        return 2 * 3956 * asin(sqrt(a))  # 3956 = Earth radius in miles
```

---

## 5. Market Intelligence Prompt (Claude API)

All the structured data above feeds into a Claude prompt that produces the final Layer 2 adjustment.

```python
MARKET_INTEL_PROMPT = """
You are a commercial real estate market analyst. Analyze the following market data and provide an investment sentiment assessment.

## Property
- Name: {deal_name}
- Address: {address}
- Metro: {metro}
- Submarket: {submarket}
- Property Type: {property_type}
- Units: {units}

## FRED Economic Data (MSA Level)
- Employment Growth (YoY): {employment_growth}%
- Unemployment Rate: {unemployment_rate}% (trend: {unemployment_trend})
- Building Permits (12mo): {permits_12mo} (YoY change: {permit_growth}%)
- Population Growth: {population_growth}%

## Rent Trends
- Median 1BR Rent: ${median_1br}
- Median 2BR Rent: ${median_2br}
- Rent Growth (YoY): {rent_yoy}%
- Rent Growth (MoM): {rent_mom}%

## Data Bank Context
- Comps available in submarket: {comp_count}
- Pipeline projects in submarket: {pipeline_count} ({pipeline_units} total units)
- Submarket inventory: {inventory_units} units

Based on this data AND your knowledge of this market, provide:

1. A numeric adjustment from -10 to +10:
   - Positive = favorable conditions for this investment
   - Negative = unfavorable conditions
   - 0 = neutral
   
2. A 2-3 sentence rationale that a CRE acquisitions professional would find credible. Reference specific data points. Be direct and actionable — don't hedge excessively.

Respond in JSON:
{
    "market_adjustment": <integer -10 to 10>,
    "rationale": "<2-3 sentences>",
    "key_factors": {
        "employment": "<positive/neutral/negative>",
        "rent_trend": "<positive/neutral/negative>",
        "supply_pressure": "<positive/neutral/negative>",
        "population": "<positive/neutral/negative>"
    }
}
"""
```

### Prompt Implementation

```python
# In backend/app/services/market_intel_service.py

async def generate_market_intelligence(
    property_data: dict,
    fred_data: dict,
    rent_data: dict,
    pipeline_data: dict,
) -> dict:
    """Generate AI market intelligence using structured data + Claude."""
    
    prompt = MARKET_INTEL_PROMPT.format(
        deal_name=property_data.get("name", "Unknown"),
        address=property_data.get("address", ""),
        metro=property_data.get("metro", ""),
        submarket=property_data.get("submarket", ""),
        property_type=property_data.get("property_type", "Multifamily"),
        units=property_data.get("units", ""),
        employment_growth=fred_data.get("employment_growth_yoy", "N/A"),
        unemployment_rate=fred_data.get("unemployment_rate", "N/A"),
        unemployment_trend=fred_data.get("unemployment_trend", "N/A"),
        permits_12mo=fred_data.get("permits_12mo", "N/A"),
        permit_growth=fred_data.get("permit_growth_yoy", "N/A"),
        population_growth=fred_data.get("population_growth", "N/A"),
        median_1br=rent_data.get("median_rent_1br", "N/A") if rent_data else "N/A",
        median_2br=rent_data.get("median_rent_2br", "N/A") if rent_data else "N/A",
        rent_yoy=rent_data.get("yoy_growth", "N/A") if rent_data else "N/A",
        rent_mom=rent_data.get("mom_growth", "N/A") if rent_data else "N/A",
        comp_count=pipeline_data.get("comp_count", 0),
        pipeline_count=pipeline_data.get("project_count", 0),
        pipeline_units=pipeline_data.get("total_units", 0),
        inventory_units=pipeline_data.get("inventory", "N/A"),
    )
    
    # Call Claude Sonnet with web search for additional context
    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
    )
    
    # Parse JSON response
    import json
    text = "".join(b.text for b in response.content if hasattr(b, "text"))
    result = json.loads(text.strip().replace("```json", "").replace("```", ""))
    
    return result
```

---

## Cost Summary

| Provider | Cost | Data | Update Frequency |
|----------|------|------|-----------------|
| FRED API | FREE | Employment, unemployment, permits, population, GDP | Monthly |
| Apartment List | FREE | Rent estimates, vacancy, time on market | Monthly |
| Census / ACS | FREE | Housing units, demographics, income | Annual |
| HUD FMR | FREE | Fair market rents by county | Annual |
| Google Maps | ~$5-15/mo | Geocoding, distances | On demand |
| Claude API (Sonnet) | ~$0.02-0.05/call | Market synthesis + web search | Per property |

**Total estimated cost per property scored: ~$0.05-0.10**
(One FRED call, one rent lookup, one Claude call, one geocode)

---

## MSA → FRED Series ID Mapping

For MVP, maintain a lookup table of the top 50 MSAs and their FRED series prefixes. Fall back to search API for unlisted metros.

```python
MSA_FRED_PREFIXES = {
    "Atlanta": "ATLA013",
    "Dallas": "DALL148",
    "Houston": "HOUS448",
    "Nashville": "NASH347",
    "Denver": "DENV108",
    "Phoenix": "PHOE029",
    "Charlotte": "CHAR037",
    "Tampa": "TAMP012",
    "Austin": "AUST448",
    "Raleigh": "RALE137",
    "Orlando": "ORLA012",
    "San Antonio": "SANA048",
    "Jacksonville": "JACK012",
    "Indianapolis": "INDI018",
    "Columbus": "COLU039",
    "Salt Lake City": "SALT649",
    "Las Vegas": "LASV032",
    "Minneapolis": "MINN027",
    "Kansas City": "KANS029",
    "Richmond": "RICH051",
    # Add more as needed — or use search_series() fallback
}

def get_fred_series_id(metro: str, data_type: str) -> str:
    """Get FRED series ID for a metro and data type."""
    prefix = MSA_FRED_PREFIXES.get(metro)
    if not prefix:
        return None  # Will use search API
    
    SUFFIXES = {
        "employment": "NA",          # Total Nonfarm, SA
        "unemployment": "URN",       # Unemployment Rate, NSA
        "labor_force": "LFN",        # Civilian Labor Force, NSA
        "permits": "BPPRIVSA",       # Building Permits, SA
    }
    
    suffix = SUFFIXES.get(data_type)
    if suffix:
        return f"{prefix}{suffix}"
    return None
```

---

## Implementation Priority

1. **FRED service** — Highest value, free, most data. Build first.
2. **Apartment List CSV ingest** — Free rent trend data. Build second.
3. **Market intel prompt** — Synthesizes everything. Build third.
4. **Google Maps geocoding** — Enables distance-based comp matching. Build fourth.
5. **Census fallback** — Only needed if users don't provide inventory. Build last.
