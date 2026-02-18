"""
Geocoding service — uses Google Geocoding API to convert addresses to lat/lng.
"""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def geocode_address(address: str) -> tuple[float, float] | None:
    """Geocode an address using Google Geocoding API. Returns (lat, lng) or None."""
    api_key = GOOGLE_MAPS_API_KEY or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key or not address:
        return None
    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": api_key},
            timeout=10,
        )
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return (loc["lat"], loc["lng"])
    except Exception as e:
        logger.warning(f"Geocoding failed for '{address}': {e}")
    return None
