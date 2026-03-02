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

EXTRACTION_PROMPT = """You are analyzing a satellite/aerial image of a multifamily residential property for a commercial real estate investment platform.

Return ONLY a JSON object — no explanation, no markdown fences:

{
  "property_name": "string or Unknown",
  "buildings": [
    {
      "id": "A",
      "label": "Building A",
      "shape": "linear|L|U|courtyard|tower|wrap",
      "num_floors": 3,
      "units_per_floor": 8,
      "wings": [
        {
          "name": "north",
          "units_per_floor": 8,
          "num_floors": 3,
          "relative_position": "north side of courtyard"
        }
      ],
      "total_units_this_building": 24
    }
  ],
  "amenities": [
    { "type": "pool|clubhouse|parking|gym|other",
      "relative_position": "south of building A" }
  ],
  "total_units": 96,
  "confidence": "high|medium|low",
  "confidence_reason": "why"
}

Rules:
- units_per_floor = number of units on ONE floor of that wing
- Infer floors from building shadow length, roof patterns, or typical construction (most garden-style = 3 floors, mid-rise = 4-5)
- For linear buildings with no visible wings, use a single wing entry
- Multiple buildings = separate entries in buildings array
- Garden-style scattered buildings = one entry per building
- If you cannot determine exact unit count, estimate based on building footprint and typical unit sizes (800-1000 sqft per unit)
- Never hallucinate — estimate and note in confidence_reason
- For L-shaped buildings, use 2 wings. For U-shaped, use 3 wings. For courtyard/wrap, use 4 wings."""


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


async def extract_layout_from_image(image_base64: str) -> dict:
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
                        "text": EXTRACTION_PROMPT,
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


async def extract_stacking_layout(address: str) -> dict:
    """Full pipeline: address → satellite image → Claude Vision → layout JSON."""
    # Step 1: Fetch satellite image
    image_base64 = await fetch_satellite_image(address)

    # Step 2: Extract layout via Claude Vision
    layout = await extract_layout_from_image(image_base64)

    # Step 3: Add metadata
    layout["source"] = "satellite"

    return layout
