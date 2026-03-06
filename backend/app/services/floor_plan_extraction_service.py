"""
Floor plan extraction service — user-uploaded floor plan screenshots → Claude Vision → unit position map.

Accepts one image per floor (e.g., from Engrain SightMap), sends each to Claude Vision
to extract unit numbers and their spatial positions (wing, position within wing).
Returns a structured unit_position_map plus a generated StackingLayout.
"""
import json
import logging
import base64
from datetime import datetime, timezone

import anthropic
from app.config import settings

logger = logging.getLogger(__name__)

FLOOR_PLAN_EXTRACTION_PROMPT = """You are analyzing a floor plan screenshot from a multifamily apartment property's website.

Extract ALL visible unit numbers and organize them by their spatial wing/section of the building.

Return ONLY a JSON object — no explanation, no markdown fences:

{
    "floor": <number — the floor number shown in the image, or infer from unit number prefixes>,
    "total_units_on_floor": <count of all unit numbers you found>,
    "wings": [
        {
            "name": "<descriptive name like 'north_wing', 'east_corridor', 'southwest_wing'>",
            "direction": "<north|east|south|west — the primary compass direction this wing faces>",
            "unit_numbers": ["<unit numbers in order as they appear along the wing, from one end to the other>"]
        }
    ]
}

Guidelines:
- Read EVERY unit number visible in the image. Do not skip any.
- Group units by their physical wing/corridor of the building. Units along the same wall or corridor belong to the same wing.
- The "direction" should reflect which side of the building the wing faces (north, east, south, west).
- Order unit_numbers within each wing sequentially as they appear spatially (left-to-right or top-to-bottom).
- If the floor number is shown in the image header (e.g., "FLOOR 2"), use that. Otherwise infer from unit number prefixes (2xx = floor 2).
- Include ALL units — residential, not commercial/amenity spaces. Skip labels like "FITNESS", "POOL", "PARKING".
- If units wrap around a corner, split them into separate wings at the corner point.
"""


async def extract_units_from_floor_plan(
    image_bytes: bytes,
    floor_hint: int | None = None,
) -> dict:
    """
    Send a floor plan screenshot to Claude Vision and extract unit positions.

    Returns dict with floor number, total units, and wings with unit numbers.
    """
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-api-key-here":
        raise ValueError("ANTHROPIC_API_KEY not configured")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = FLOOR_PLAN_EXTRACTION_PROMPT
    if floor_hint is not None:
        prompt += f"\n\nHint: This image should be Floor {floor_hint}. Use this if the floor number is not visible in the image."

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
                        "text": prompt,
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


async def extract_floor_plan_batch(
    images: list[tuple[bytes, str]],
) -> dict:
    """
    Extract unit positions from multiple floor plan images.

    Args:
        images: list of (image_bytes, filename) tuples

    Returns dict with:
        - unit_position_map: the raw extraction data
        - layout: a generated StackingLayout matching the extraction
    """
    floors_data = []

    for image_bytes, filename in images:
        logger.info("Extracting floor plan from %s", filename)
        try:
            floor_data = await extract_units_from_floor_plan(image_bytes)
            floors_data.append(floor_data)
        except Exception as e:
            logger.error("Failed to extract from %s: %s", filename, e)
            raise ValueError(f"Failed to analyze {filename}: {e}")

    # Sort by floor number
    floors_data.sort(key=lambda f: f.get("floor", 0))

    unit_position_map = {
        "source": "floor_plan_screenshots",
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "floors": floors_data,
    }

    layout = build_stacking_layout_from_extraction(unit_position_map)

    return {
        "unit_position_map": unit_position_map,
        "layout": layout,
    }


def build_stacking_layout_from_extraction(unit_position_map: dict) -> dict:
    """
    Convert extracted floor plan data into a StackingLayout.

    Uses the max unit count per wing across all floors (floors with fewer
    units will simply have empty positions in the 3D model).
    """
    floors = unit_position_map.get("floors", [])
    if not floors:
        return {"buildings": [], "amenities": [], "total_units": 0}

    num_floors = len(floors)

    # Collect all wing names and their max unit counts
    wing_max_counts: dict[str, int] = {}
    wing_directions: dict[str, str] = {}

    for floor_data in floors:
        for wing in floor_data.get("wings", []):
            name = wing["name"]
            count = len(wing.get("unit_numbers", []))
            wing_max_counts[name] = max(wing_max_counts.get(name, 0), count)
            wing_directions[name] = wing.get("direction", "north")

    # Determine building shape from wing count
    num_wings = len(wing_max_counts)
    if num_wings <= 1:
        shape = "linear"
    elif num_wings == 2:
        shape = "L"
    elif num_wings == 3:
        shape = "U"
    else:
        shape = "courtyard"

    # Build wings list
    direction_to_position = {
        "north": "north side",
        "east": "east side",
        "south": "south side",
        "west": "west side",
    }

    wings = []
    total_units_per_floor = 0
    for name, max_count in wing_max_counts.items():
        direction = wing_directions.get(name, "north")
        wings.append({
            "name": name,
            "units_per_floor": max_count,
            "num_floors": num_floors,
            "relative_position": direction_to_position.get(direction, f"{direction} side"),
        })
        total_units_per_floor += max_count

    # Count actual total units from all floors
    actual_total = sum(
        floor_data.get("total_units_on_floor", 0)
        for floor_data in floors
    )

    building = {
        "id": "A",
        "label": "Building A",
        "shape": shape,
        "num_floors": num_floors,
        "units_per_floor": total_units_per_floor,
        "wings": wings,
        "total_units_this_building": actual_total or total_units_per_floor * num_floors,
    }

    return {
        "buildings": [building],
        "amenities": [],
        "total_units": building["total_units_this_building"],
    }
