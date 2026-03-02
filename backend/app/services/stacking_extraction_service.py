"""
Stacking extraction service — fetch satellite image → Claude Vision → building layout JSON.

Uses Google Maps Static API for satellite imagery and Claude Vision (Sonnet 4.5)
to extract building layout information for the 3D stacking model.
"""
import json
import logging
import base64

import httpx
import anthropic
from app.config import settings

logger = logging.getLogger(__name__)

def build_extraction_prompt(property_context: dict) -> str:
    """Build a context-aware extraction prompt using known property data."""

    # Base context block
    context_lines = []
    if property_context.get("property_name"):
        context_lines.append(f"Property Name: {property_context['property_name']}")
    if property_context.get("total_units"):
        context_lines.append(
            f"KNOWN Total Units: {property_context['total_units']} "
            "(from rent roll — this is ground truth, DO NOT guess a different number)"
        )
    if property_context.get("total_sf"):
        context_lines.append(f"Total Square Footage: {property_context['total_sf']:,.0f} SF")
    if property_context.get("avg_unit_sf"):
        context_lines.append(f"Average Unit Size: {property_context['avg_unit_sf']:,.0f} SF")
    if property_context.get("year_built"):
        context_lines.append(f"Year Built: {property_context['year_built']}")
    if property_context.get("occupied_units"):
        context_lines.append(f"Occupied Units: {property_context['occupied_units']}")
    if property_context.get("unit_mix"):
        context_lines.append(f"Unit Type Mix: {property_context['unit_mix']}")

    context_block = "\n".join(context_lines) if context_lines else "No property data available — estimate from image only."

    has_unit_count = bool(property_context.get("total_units"))

    if has_unit_count:
        distribution_instruction = f"""
CRITICAL CONSTRAINT: The property has EXACTLY {property_context['total_units']} total units.
Your buildings array MUST sum to exactly {property_context['total_units']} units.
Count every distinct building structure visible in the satellite image.
Distribute the {property_context['total_units']} units across the visible buildings proportionally
based on each building's visible footprint size.
If a building looks twice as long as another, it should have roughly twice the units."""
    else:
        distribution_instruction = """
No unit count is available. Estimate based on building footprints and typical unit sizes
(800-1000 sqft per unit for garden-style, 600-800 for mid-rise)."""

    year_built = property_context.get("year_built", "unknown")

    return f"""You are analyzing a satellite/aerial image of a multifamily residential property for a commercial real estate investment platform.

KNOWN PROPERTY DATA:
{context_block}

{distribution_instruction}

Analyze the satellite image and return ONLY a JSON object — no explanation, no markdown fences:

{{
  "property_name": "string or Unknown",
  "buildings": [
    {{
      "id": "A",
      "label": "Building A",
      "shape": "linear|L|U|courtyard|tower|wrap",
      "num_floors": 3,
      "units_per_floor": 8,
      "wings": [
        {{
          "name": "main",
          "units_per_floor": 8,
          "num_floors": 3,
          "relative_position": "description of position on the property"
        }}
      ],
      "total_units_this_building": 24
    }}
  ],
  "amenities": [
    {{ "type": "pool|clubhouse|parking|gym|other",
      "relative_position": "south of building A" }}
  ],
  "total_units": {property_context.get('total_units', '"estimated_number"')},
  "confidence": "high|medium|low",
  "confidence_reason": "explanation"
}}

RULES:
- Count EVERY distinct building structure in the image. Garden-style complexes often have 6-12 separate buildings.
- Each building = one entry in the buildings array. Do NOT merge multiple buildings into one.
- For linear/rectangular buildings (most common in garden-style): shape = "linear"
- units_per_floor = number of units on ONE floor of that wing/building
- Infer floors from building shadow length, roof patterns, and typical construction:
  - Garden-style apartments: usually 2-3 floors
  - Mid-rise: 4-5 floors
  - Year built {year_built} can help: pre-2000 garden-style = likely 2-3 floors
- For L-shaped buildings use 2 wings, U-shaped use 3 wings, courtyard/wrap use 4 wings
- Simple rectangular buildings should have 1 wing with name "main"
- The sum of all total_units_this_building values MUST equal total_units
- Look for pools (blue rectangles), parking lots (gray areas with lines), clubhouse/leasing office buildings
- Never hallucinate — if uncertain, note in confidence_reason
"""


async def fetch_satellite_image(address: str) -> str:
    """Fetch satellite image from Google Maps Static API. Returns base64-encoded image."""
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        raise ValueError("GOOGLE_MAPS_API_KEY not set")

    params = {
        "center": address,
        "zoom": 19,
        "size": "640x640",
        "maptype": "satellite",
        "key": api_key,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://maps.googleapis.com/maps/api/staticmap",
            params=params,
            timeout=15.0,
        )
        response.raise_for_status()
        return base64.b64encode(response.content).decode("utf-8")


async def extract_layout_from_image(image_base64: str, property_context: dict | None = None) -> dict:
    """Send satellite image to Claude Vision for building layout extraction.

    Uses AsyncAnthropic so the Claude API call is truly non-blocking.
    The sync client blocks the entire uvicorn event loop — see the note in
    claude_extraction_service.py for details.
    """
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-api-key-here":
        raise ValueError("ANTHROPIC_API_KEY not configured")

    client = anthropic.AsyncAnthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        base_url="https://api.anthropic.com",
        timeout=120.0,
    )

    message = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": build_extraction_prompt(property_context or {}),
                    },
                ],
            }
        ],
    )

    response_text = message.content[0].text.strip()

    # Strip markdown fences if Claude adds them despite instructions
    if response_text.startswith("```"):
        first_newline = response_text.index("\n")
        response_text = response_text[first_newline + 1:]
        if response_text.rstrip().endswith("```"):
            response_text = response_text.rstrip()[:-3].rstrip()

    return json.loads(response_text)


async def extract_stacking_layout(address: str, property_context: dict | None = None) -> dict:
    """Full pipeline: address → satellite image → Claude Vision → layout JSON."""
    # Step 1: Fetch satellite image
    image_base64 = await fetch_satellite_image(address)

    # Step 2: Extract layout via Claude Vision (with property context)
    layout = await extract_layout_from_image(image_base64, property_context=property_context)

    # Step 3: Add metadata
    layout["source"] = "satellite"

    return layout
