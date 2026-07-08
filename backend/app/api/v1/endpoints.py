from __future__ import annotations
import os

from fastapi import APIRouter, HTTPException

from app.core.config import REGIONS
from app.engines.analytics import ClimateAnomalyEngine
from app.engines.ledger import SyntheticResourceLedger
from app.schemas.analytics import (
    AnalyticsResponse,
    ClimateTelemetry,
    ResourceLedger,
    ChatRequest,
    ChatResponse,
)
from app.services.pipeline import WeatherIntelligencePipeline
import requests
import json
import os

router = APIRouter(prefix="/analytics", tags=["analytics"])

N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "http://n8n:5678/webhook/wias-crisis-simulation"
)


@router.get("/{region_key}", response_model=AnalyticsResponse)
def analyze_region(region_key: str) -> AnalyticsResponse:
    if region_key not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    region = REGIONS[region_key]
    pipeline = WeatherIntelligencePipeline()
    live = pipeline.fetch_api_telemetry(region["latitude"], region["longitude"])

    if live:
        telemetry = ClimateTelemetry(
            temperature_celsius=live.get("temperature_2m", region["expected_max_baseline"]),
            humidity_percentage=live.get("relative_humidity_2m", 50.0),
            wind_speed_kmh=live.get("wind_speed_10m", 10.0),
            wind_direction_degrees=live.get("wind_direction_10m", 180),
        )
    else:
        telemetry = ClimateTelemetry(
            temperature_celsius=region["expected_max_baseline"],
            humidity_percentage=50.0,
            wind_speed_kmh=10.0,
            wind_direction_degrees=180,
        )

    analysis = ClimateAnomalyEngine.calculate_thermal_anomaly(
        current_temp=telemetry.temperature_celsius,
        baseline_max=region["expected_max_baseline"],
        humidity_pct=telemetry.humidity_percentage,
        wind_kmh=telemetry.wind_speed_kmh,
    )

    ledger = SyntheticResourceLedger(region["resource_baselines"]).compute(
        deviation_celsius=analysis["deviation_celsius"],
        vpd_kpa=analysis["vapor_pressure_deficit_kpa"],
        irrigation_efficiency=analysis["overhead_irrigation_efficiency"],
    )

    return AnalyticsResponse(
        region_name=region["name"],
        system_status=analysis["status"],
        climate_matrix={
            "intensity_level": analysis["intensity"],
            "deviation_from_baseline_celsius": analysis["deviation_celsius"],
            "vapor_pressure_deficit_kpa": analysis["vapor_pressure_deficit_kpa"],
            "heat_index_celsius": analysis["heat_index_celsius"],
            "wet_bulb_celsius": analysis["wet_bulb_celsius"],
        },
        ledger=ResourceLedger(**ledger),
        telemetry=telemetry,
    )


@router.post("/{region_key}/chat", response_model=ChatResponse)
def simulate_chat(region_key: str, request: ChatRequest) -> ChatResponse:
    if region_key not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    # Generate full payload including the text-state vector
    pipeline = WeatherIntelligencePipeline()
    payload = pipeline.execute(region_key)

    if not payload:
        return ChatResponse(
            reply="[System] Could not generate region telemetry payload. Live weather API may be temporarily unavailable. Please try again in a moment.",
            raw_data=None
        )

    # Attach the user's query to the payload for n8n
    payload["user_query"] = request.query

    try:
        response = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=(10, 60))
        response.raise_for_status()
        
        # Try to parse the response format from n8n
        # n8n might return a JSON with a specific field, or just text
        try:
            resp_json = response.json()
            # If n8n returns standard array of objects or object
            # We attempt to extract a logical message field
            reply_text = ""
            if isinstance(resp_json, list) and len(resp_json) > 0:
                first_item = resp_json[0]
                if isinstance(first_item, dict):
                    reply_text = first_item.get("output", first_item.get("message", first_item.get("text", str(first_item))))
                else:
                    reply_text = str(first_item)
            elif isinstance(resp_json, dict):
                reply_text = resp_json.get("output", resp_json.get("message", resp_json.get("text", str(resp_json))))
            else:
                reply_text = str(resp_json)

            if not reply_text:
                reply_text = json.dumps(resp_json)

            return ChatResponse(reply=reply_text, raw_data=resp_json if isinstance(resp_json, dict) else {"data": resp_json})
        
        except ValueError:
            # If it's not JSON, return as plain text
            return ChatResponse(reply=response.text, raw_data=None)

    except requests.exceptions.Timeout:
        print(f"Webhook timeout for region: {region_key}")
        return ChatResponse(
            reply="[System] The AI Swarm is processing a complex analysis and took too long to respond. Please try again — it may respond faster on retry.",
            raw_data=None
        )
    except requests.exceptions.RequestException as e:
        print(f"Webhook error: {e}")
        return ChatResponse(
            reply=f"[System] Unable to reach the AI Swarm at this time. Please check the n8n workflow is active and retry.",
            raw_data=None
        )
