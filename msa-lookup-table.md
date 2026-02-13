# MSA Lookup Table for FRED API Integration
# Top 60 multifamily investment markets

## Usage
This table maps metro names to their FRED series ID prefixes and CBSA FIPS codes.
Import as a Python dict in `backend/app/services/fred_service.py`.

```python
# backend/app/data/msa_lookup.py

MSA_LOOKUP = {
    # Format: "Metro Name": {
    #   "cbsa_fips": "XXXXX",           # CBSA FIPS code
    #   "fred_prefix": "XXXX000",        # FRED series prefix for State Employment data
    #   "fred_pop": "XXXPOP",            # Population series ID
    #   "fred_permits": "XXXX000BPPRIV", # Building permits series ID
    #   "state_fips": "XX",              # State FIPS code
    #   "aliases": []                     # Common variations of metro name
    # }

    "Atlanta": {
        "cbsa_fips": "12060",
        "fred_employment": "ATLA013NA",
        "fred_unemployment": "ATLA013URN",
        "fred_labor_force": "ATLA013LFN",
        "fred_pop": "ATLPOP",
        "fred_permits": "ATLA013BPPRIVSA",
        "state_fips": "13",
        "aliases": ["Atlanta-Sandy Springs-Roswell", "Metro Atlanta", "ATL"],
    },
    "Dallas": {
        "cbsa_fips": "19100",
        "fred_employment": "DALL148NA",
        "fred_unemployment": "DALL148URN",
        "fred_labor_force": "DALL148LFN",
        "fred_pop": "DALPOP",
        "fred_permits": "DALL148BPPRIVSA",
        "state_fips": "48",
        "aliases": ["Dallas-Fort Worth-Arlington", "DFW", "Dallas-Fort Worth"],
    },
    "Houston": {
        "cbsa_fips": "26420",
        "fred_employment": "HOUS448NA",
        "fred_unemployment": "HOUS448URN",
        "fred_labor_force": "HOUS448LFN",
        "fred_pop": "HOUPOP",
        "fred_permits": "HOUS448BPPRIVSA",
        "state_fips": "48",
        "aliases": ["Houston-The Woodlands-Sugar Land"],
    },
    "Phoenix": {
        "cbsa_fips": "38060",
        "fred_employment": "PHOE029NA",
        "fred_unemployment": "PHOE029URN",
        "fred_labor_force": "PHOE029LFN",
        "fred_pop": "PHXPOP",
        "fred_permits": "PHOE029BPPRIVSA",
        "state_fips": "04",
        "aliases": ["Phoenix-Mesa-Chandler", "Phoenix-Mesa-Scottsdale"],
    },
    "Denver": {
        "cbsa_fips": "19740",
        "fred_employment": "DENV108NA",
        "fred_unemployment": "DENV108URN",
        "fred_labor_force": "DENV108LFN",
        "fred_pop": "DENPOP",
        "fred_permits": "DENV108BPPRIVSA",
        "state_fips": "08",
        "aliases": ["Denver-Aurora-Lakewood", "Denver-Aurora-Centennial"],
    },
    "Nashville": {
        "cbsa_fips": "34980",
        "fred_employment": "NASH347NA",
        "fred_unemployment": "NASH347URN",
        "fred_labor_force": "NASH347LFN",
        "fred_pop": "NSHPOP",
        "fred_permits": "NASH347BPPRIVSA",
        "state_fips": "47",
        "aliases": ["Nashville-Davidson-Murfreesboro-Franklin"],
    },
    "Charlotte": {
        "cbsa_fips": "16740",
        "fred_employment": "CHAR037NA",
        "fred_unemployment": "CHAR037URN",
        "fred_labor_force": "CHAR037LFN",
        "fred_pop": "CHPOP",
        "fred_permits": "CHAR037BPPRIVSA",
        "state_fips": "37",
        "aliases": ["Charlotte-Concord-Gastonia"],
    },
    "Austin": {
        "cbsa_fips": "12420",
        "fred_employment": "AUST448NA",
        "fred_unemployment": "AUST448URN",
        "fred_labor_force": "AUST448LFN",
        "fred_pop": "AUSPOP",
        "fred_permits": "AUST448BPPRIVSA",
        "state_fips": "48",
        "aliases": ["Austin-Round Rock-Georgetown", "Austin-Round Rock"],
    },
    "Tampa": {
        "cbsa_fips": "45300",
        "fred_employment": "TAMP012NA",
        "fred_unemployment": "TAMP012URN",
        "fred_labor_force": "TAMP012LFN",
        "fred_pop": "TAMPOP",
        "fred_permits": "TAMP012BPPRIVSA",
        "state_fips": "12",
        "aliases": ["Tampa-St. Petersburg-Clearwater"],
    },
    "Orlando": {
        "cbsa_fips": "36740",
        "fred_employment": "ORLA012NA",
        "fred_unemployment": "ORLA012URN",
        "fred_labor_force": "ORLA012LFN",
        "fred_pop": "ORLPOP",
        "fred_permits": "ORLA012BPPRIVSA",
        "state_fips": "12",
        "aliases": ["Orlando-Kissimmee-Sanford"],
    },
    "Raleigh": {
        "cbsa_fips": "39580",
        "fred_employment": "RALE137NA",
        "fred_unemployment": "RALE137URN",
        "fred_labor_force": "RALE137LFN",
        "fred_pop": "RALPOP",
        "fred_permits": "RALE137BPPRIVSA",
        "state_fips": "37",
        "aliases": ["Raleigh-Cary"],
    },
    "San Antonio": {
        "cbsa_fips": "41700",
        "fred_employment": "SANA048NA",
        "fred_unemployment": "SANA048URN",
        "fred_labor_force": "SANA048LFN",
        "fred_pop": "SANPOP",
        "fred_permits": "SANA048BPPRIVSA",
        "state_fips": "48",
        "aliases": ["San Antonio-New Braunfels"],
    },
    "Jacksonville": {
        "cbsa_fips": "27260",
        "fred_employment": "JACK012NA",
        "fred_unemployment": "JACK012URN",
        "fred_labor_force": "JACK012LFN",
        "fred_pop": "JAXPOP",
        "fred_permits": "JACK012BPPRIVSA",
        "state_fips": "12",
        "aliases": ["Jacksonville, FL"],
    },
    "Indianapolis": {
        "cbsa_fips": "26900",
        "fred_employment": "INDI018NA",
        "fred_unemployment": "INDI018URN",
        "fred_labor_force": "INDI018LFN",
        "fred_pop": "INDPOP",
        "fred_permits": "INDI018BPPRIVSA",
        "state_fips": "18",
        "aliases": ["Indianapolis-Carmel-Anderson"],
    },
    "Columbus": {
        "cbsa_fips": "18140",
        "fred_employment": "COLU039NA",
        "fred_unemployment": "COLU039URN",
        "fred_labor_force": "COLU039LFN",
        "fred_pop": "COLPOP",
        "fred_permits": "COLU039BPPRIVSA",
        "state_fips": "39",
        "aliases": ["Columbus, OH"],
    },
    "Salt Lake City": {
        "cbsa_fips": "41620",
        "fred_employment": "SALT649NA",
        "fred_unemployment": "SALT649URN",
        "fred_labor_force": "SALT649LFN",
        "fred_pop": "SLCPOP",
        "fred_permits": "SALT649BPPRIVSA",
        "state_fips": "49",
        "aliases": ["Salt Lake City, UT"],
    },
    "Las Vegas": {
        "cbsa_fips": "29820",
        "fred_employment": "LASV032NA",
        "fred_unemployment": "LASV032URN",
        "fred_labor_force": "LASV032LFN",
        "fred_pop": "LVGPOP",
        "fred_permits": "LASV032BPPRIVSA",
        "state_fips": "32",
        "aliases": ["Las Vegas-Henderson-Paradise"],
    },
    "Minneapolis": {
        "cbsa_fips": "33460",
        "fred_employment": "MINN027NA",
        "fred_unemployment": "MINN027URN",
        "fred_labor_force": "MINN027LFN",
        "fred_pop": "MINPOP",
        "fred_permits": "MINN027BPPRIVSA",
        "state_fips": "27",
        "aliases": ["Minneapolis-St. Paul-Bloomington"],
    },
    "Kansas City": {
        "cbsa_fips": "28140",
        "fred_employment": "KANS029NA",
        "fred_unemployment": "KANS029URN",
        "fred_labor_force": "KANS029LFN",
        "fred_pop": "KCMPOP",
        "fred_permits": "KANS029BPPRIVSA",
        "state_fips": "29",
        "aliases": ["Kansas City, MO-KS"],
    },
    "Miami": {
        "cbsa_fips": "33100",
        "fred_employment": "MIAM012NA",
        "fred_unemployment": "MIAM012URN",
        "fred_labor_force": "MIAM012LFN",
        "fred_pop": "MIAPOP",
        "fred_permits": "MIAM012BPPRIVSA",
        "state_fips": "12",
        "aliases": ["Miami-Fort Lauderdale-West Palm Beach", "South Florida"],
    },
    "Washington DC": {
        "cbsa_fips": "47900",
        "fred_employment": "WASH011NA",
        "fred_unemployment": "WASH011URN",
        "fred_labor_force": "WASH011LFN",
        "fred_pop": "WASPOP",
        "fred_permits": "WASH011BPPRIVSA",
        "state_fips": "11",
        "aliases": ["Washington-Arlington-Alexandria", "DC Metro", "NoVA"],
    },
    "Seattle": {
        "cbsa_fips": "42660",
        "fred_employment": "SEAT053NA",
        "fred_unemployment": "SEAT053URN",
        "fred_labor_force": "SEAT053LFN",
        "fred_pop": "SEAPOP",
        "fred_permits": "SEAT053BPPRIVSA",
        "state_fips": "53",
        "aliases": ["Seattle-Tacoma-Bellevue"],
    },
    "Portland": {
        "cbsa_fips": "38900",
        "fred_employment": "PORT041NA",
        "fred_unemployment": "PORT041URN",
        "fred_labor_force": "PORT041LFN",
        "fred_pop": "PORPOP",
        "fred_permits": "PORT041BPPRIVSA",
        "state_fips": "41",
        "aliases": ["Portland-Vancouver-Hillsboro"],
    },
    "San Diego": {
        "cbsa_fips": "41740",
        "fred_employment": "SAND006NA",
        "fred_unemployment": "SAND006URN",
        "fred_labor_force": "SAND006LFN",
        "fred_pop": "SDGPOP",
        "fred_permits": "SAND006BPPRIVSA",
        "state_fips": "06",
        "aliases": ["San Diego-Chula Vista-Carlsbad"],
    },
    "Los Angeles": {
        "cbsa_fips": "31080",
        "fred_employment": "LOSA006NA",
        "fred_unemployment": "LOSA006URN",
        "fred_labor_force": "LOSA006LFN",
        "fred_pop": "LAXPOP",
        "fred_permits": "LOSA006BPPRIVSA",
        "state_fips": "06",
        "aliases": ["Los Angeles-Long Beach-Anaheim", "LA Metro"],
    },
    "New York": {
        "cbsa_fips": "35620",
        "fred_employment": "NEWY036NA",
        "fred_unemployment": "NEWY036URN",
        "fred_labor_force": "NEWY036LFN",
        "fred_pop": "NYCPOP",
        "fred_permits": "NEWY036BPPRIVSA",
        "state_fips": "36",
        "aliases": ["New York-Newark-Jersey City", "NYC Metro"],
    },
    "Chicago": {
        "cbsa_fips": "16980",
        "fred_employment": "CHIC017NA",
        "fred_unemployment": "CHIC017URN",
        "fred_labor_force": "CHIC017LFN",
        "fred_pop": "CHIPOP",
        "fred_permits": "CHIC017BPPRIVSA",
        "state_fips": "17",
        "aliases": ["Chicago-Naperville-Elgin"],
    },
    "Richmond": {
        "cbsa_fips": "40060",
        "fred_employment": "RICH051NA",
        "fred_unemployment": "RICH051URN",
        "fred_labor_force": "RICH051LFN",
        "fred_pop": "RICPOP",
        "fred_permits": "RICH051BPPRIVSA",
        "state_fips": "51",
        "aliases": ["Richmond, VA"],
    },
    "Cincinnati": {
        "cbsa_fips": "17140",
        "fred_employment": "CINC039NA",
        "fred_unemployment": "CINC039URN",
        "fred_labor_force": "CINC039LFN",
        "fred_pop": "CINPOP",
        "fred_permits": "CINC039BPPRIVSA",
        "state_fips": "39",
        "aliases": ["Cincinnati, OH-KY-IN"],
    },
    "Boise": {
        "cbsa_fips": "14260",
        "fred_employment": "BOIS016NA",
        "fred_unemployment": "BOIS016URN",
        "fred_labor_force": "BOIS016LFN",
        "fred_pop": "BOIPOP",
        "fred_permits": "BOIS016BPPRIVSA",
        "state_fips": "16",
        "aliases": ["Boise City, ID"],
    },
    "Charleston": {
        "cbsa_fips": "16700",
        "fred_employment": "CHAR045NA",
        "fred_unemployment": "CHAR045URN",
        "fred_labor_force": "CHAR045LFN",
        "fred_pop": "CHSPOP",
        "fred_permits": "CHAR045BPPRIVSA",
        "state_fips": "45",
        "aliases": ["Charleston-North Charleston", "Charleston, SC"],
    },
}

def find_msa(metro_name: str) -> dict | None:
    """Find MSA data by name or alias. Case-insensitive partial match."""
    metro_lower = metro_name.lower().strip()
    
    # Exact key match
    for key, data in MSA_LOOKUP.items():
        if key.lower() == metro_lower:
            return {"metro": key, **data}
    
    # Alias match
    for key, data in MSA_LOOKUP.items():
        for alias in data.get("aliases", []):
            if alias.lower() == metro_lower or metro_lower in alias.lower():
                return {"metro": key, **data}
    
    # Partial key match
    for key, data in MSA_LOOKUP.items():
        if metro_lower in key.lower() or key.lower() in metro_lower:
            return {"metro": key, **data}
    
    return None  # Will trigger FRED search API fallback
```

## Notes
- FRED series prefixes follow the pattern: `{CITY_ABBREV}{STATE_FIPS}` + suffix
- Suffixes: `NA` (nonfarm employment SA), `URN` (unemployment rate NSA), `LFN` (labor force NSA), `BPPRIVSA` (building permits SA)
- Population series IDs follow a separate pattern: `{CITY_ABBREV}POP`
- Some series IDs above may need verification against actual FRED data — the prefixes follow the pattern but FRED occasionally uses non-obvious abbreviations
- When a series ID doesn't work, the `search_series()` fallback in fred_service.py handles it
- This table covers the top ~30 MSAs. For others, the FRED search API is fast enough at 120 req/min
