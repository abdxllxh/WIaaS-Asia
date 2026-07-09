"""Routes REST pour l'analyse climatique et le chat multi-agents."""

from __future__ import annotations
import os

import json

import requests
from fastapi import APIRouter, HTTPException

from app.core.config import REGIONS
from app.engines.analytics import ClimateAnomalyEngine
from app.engines.ledger import SyntheticResourceLedger
from app.schemas.analytics import (
    AnalyticsResponse,
    ChatRequest,
    ChatResponse,
    ClimateTelemetry,
    ResourceLedger,
)
from app.services.pipeline import WeatherIntelligencePipeline

router = APIRouter(prefix="/analytics", tags=["analytics"])

N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "http://n8n:5678/webhook/wias-crisis-simulation"
)


def _extract_webhook_reply(resp_json: object) -> str:
    """Extrait le texte de réponse depuis les formats JSON renvoyés par n8n."""
    if isinstance(resp_json, list) and resp_json:
        first_item = resp_json[0]
        if isinstance(first_item, dict):
            return first_item.get(
                "output",
                first_item.get("message", first_item.get("text", str(first_item))),
            )
        return str(first_item)

    if isinstance(resp_json, dict):
        return resp_json.get(
            "output",
            resp_json.get("message", resp_json.get("text", str(resp_json))),
        )

    return str(resp_json)


def _build_telemetry(region: dict, live: dict | None) -> ClimateTelemetry:
    """Construit la télémétrie à partir de l'API live ou du baseline régional."""
    if live:
        return ClimateTelemetry(
            temperature_celsius=live.get("temperature_2m", region["expected_max_baseline"]),
            humidity_percentage=live.get("relative_humidity_2m", 50.0),
            wind_speed_kmh=live.get("wind_speed_10m", 10.0),
            wind_direction_degrees=live.get("wind_direction_10m", 180),
        )
    return ClimateTelemetry(
        temperature_celsius=region["expected_max_baseline"],
        humidity_percentage=50.0,
        wind_speed_kmh=10.0,
        wind_direction_degrees=180,
    )


@router.get("/", response_model=dict)
def get_all_regions() -> dict:
    """Liste les clés de région disponibles et leurs noms lisibles."""
    available_regions = {key: data.get("name", key) for key, data in REGIONS.items()}
    return {
        "status": "success",
        "count": len(available_regions),
        "regions": available_regions,
    }


@router.get("/{region_key}", response_model=AnalyticsResponse)
def analyze_region(region_key: str) -> AnalyticsResponse:
    if region_key not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    region = REGIONS[region_key]
    pipeline = WeatherIntelligencePipeline()
    telemetry = _build_telemetry(region, pipeline.fetch_api_telemetry(region["latitude"], region["longitude"]))

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

    pipeline = WeatherIntelligencePipeline()
    payload = pipeline.execute(region_key)

    if not payload:
        return ChatResponse(
            reply=(
                "[System] Could not generate region telemetry payload. "
                "Live weather API may be temporarily unavailable. Please try again in a moment."
            ),
            raw_data=None,
        )

    payload["user_query"] = request.query

    try:
        response = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=(10, 60))
        response.raise_for_status()

        try:
            resp_json = response.json()
            reply_text = _extract_webhook_reply(resp_json)
            if not reply_text:
                reply_text = json.dumps(resp_json)

            raw_data = resp_json if isinstance(resp_json, dict) else {"data": resp_json}
            return ChatResponse(reply=reply_text, raw_data=raw_data)

        except ValueError:
            return ChatResponse(reply=response.text, raw_data=None)

    except requests.exceptions.Timeout:
        print(f"Webhook timeout for region: {region_key}")
        return ChatResponse(
            reply=(
                "[System] The AI Swarm is processing a complex analysis and took too long to respond. "
                "Please try again — it may respond faster on retry."
            ),
            raw_data=None,
        )
    except requests.exceptions.RequestException as e:
        print(f"Webhook error: {e}")
        return ChatResponse(
            reply="[System] Unable to reach the AI Swarm at this time. Please check the n8n workflow is active and retry.",
            raw_data=None,
        )
