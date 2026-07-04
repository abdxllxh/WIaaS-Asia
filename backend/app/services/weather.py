"""
weather.py — Open-Meteo live weather fetcher (no API key needed).
Uses the free Open-Meteo API to fetch current conditions for any lat/lon.
"""
from __future__ import annotations
import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

async def fetch_current_weather(latitude: float, longitude: float) -> dict:
    """
    Fetch current temperature, humidity, wind speed, and wind direction
    from the Open-Meteo free API.

    Returns a dict with keys:
        temperature_celsius, humidity_percentage,
        wind_speed_kmh, wind_direction_degrees
    """
    params = {
        "latitude":          latitude,
        "longitude":         longitude,
        "current":           "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
        "wind_speed_unit":   "kmh",
        "timezone":          "auto",
        "forecast_days":     1,
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = client.get(OPEN_METEO_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    current = data.get("current", {})
    return {
        "temperature_celsius":   float(current.get("temperature_2m",          20.0)),
        "humidity_percentage":   float(current.get("relative_humidity_2m",    50.0)),
        "wind_speed_kmh":        float(current.get("wind_speed_10m",          10.0)),
        "wind_direction_degrees":float(current.get("wind_direction_10m",     180.0)),
    }
