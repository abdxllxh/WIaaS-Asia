from __future__ import annotations

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
from app.services.grid_predictor import grid_predictor
import requests
import json

router = APIRouter(prefix="/analytics", tags=["analytics"])

N8N_WEBHOOK_URL = "https://abdxllxh2002.app.n8n.cloud/webhook/wias-crisis-simulation"


def check_and_register_dynamic_region(region_key: str, name: str | None = None) -> None:
    if region_key in REGIONS:
        return
    try:
        parts = region_key.split('_')
        if len(parts) == 2:
            lat = float(parts[0])
            lon = float(parts[1])
            REGIONS[region_key] = {
                "name": name or f"Custom City ({lat:.4f}, {lon:.4f})",
                "latitude": lat,
                "longitude": lon,
                "expected_max_baseline": 35.0,
                "timezone": "GMT+0 (UTC)",
                "resource_baselines": {
                    "water_reservoir_m3":  1_500_000,
                    "grid_capacity_mw":    450,
                    "fuel_reserve_liters": 120_000,
                },
            }
    except (ValueError, TypeError):
        pass


@router.get("/{region_key}", response_model=AnalyticsResponse)
def analyze_region(region_key: str, name: str | None = None) -> AnalyticsResponse:
    check_and_register_dynamic_region(region_key, name)

    if region_key not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    pipeline = WeatherIntelligencePipeline()
    payload = pipeline.execute(region_key)

    if not payload:
        raise HTTPException(status_code=500, detail="Failed to run pipeline")

    t_data = payload["climate_matrix"]["telemetry"]
    telemetry = ClimateTelemetry(
        temperature_celsius=t_data["temperature_celsius"],
        humidity_percentage=t_data["humidity_percentage"],
        wind_speed_kmh=t_data["wind"]["speed_kmh"],
        wind_direction_degrees=t_data["wind"]["direction_degrees"]
    )

    deviation = payload["climate_matrix"]["deviation_from_baseline_celsius"]
    wet_bulb = payload["climate_matrix"]["wet_bulb_celsius"]
    vpd = payload["climate_matrix"]["vapor_pressure_deficit_kpa"]

    penalty = max(0.0, deviation * 0.05) + max(0.0, (wet_bulb - 25.0) * 0.02)
    crop_health_ndvi = max(0.12, 0.85 - penalty)
    radar_val = max(0.1, 0.75 - (vpd * 0.12))
    soil_moisture_pct = radar_val * 50.0
    disease_risk_pct = telemetry.humidity_percentage * 0.4
    water_stress_index = 1.0 - (payload["synthetic_resource_ledger"]["water_irrigation_efficiency_pct"] / 100.0)

    # Store grid predictions synchronously from this payload
    grid_predictor.request_refresh(region_key, payload)

    return AnalyticsResponse(
        region_name=payload["monitored_region"],
        system_status=payload["system_status"],
        climate_matrix={
            "intensity_level": payload["climate_matrix"]["intensity_level"],
            "deviation_from_baseline_celsius": deviation,
            "vapor_pressure_deficit_kpa": vpd,
            "heat_index_celsius": payload["climate_matrix"]["heat_index_celsius"],
            "wet_bulb_celsius": wet_bulb,
        },
        ledger=ResourceLedger(**payload["synthetic_resource_ledger"]),
        telemetry=telemetry,
        crop_health_ndvi=round(crop_health_ndvi, 2),
        soil_moisture_pct=round(soil_moisture_pct, 1),
        disease_risk_pct=round(disease_risk_pct, 1),
        water_stress_index=round(water_stress_index, 2),
        diurnal_cycle=payload["_meta"]["diurnal_cycle"],
        timezone=payload["_meta"]["timezone"],
        latitude=payload["_meta"]["coordinates"]["latitude"],
        longitude=payload["_meta"]["coordinates"]["longitude"],
        llm_state_vector=payload["llm_state_vector"],
        risk_level=payload["risk_level"],
        mission_criticality_score=payload["mission_criticality_score"]
    )


def generate_dynamic_agri_report(payload: dict) -> str:
    region_name = payload["monitored_region"]
    telemetry = payload["climate_matrix"]["telemetry"]
    temp = telemetry["temperature_celsius"]
    humidity = telemetry["humidity_percentage"]
    vpd = payload["climate_matrix"]["vapor_pressure_deficit_kpa"]
    ledger = payload["synthetic_resource_ledger"]
    gross = ledger["water_gross_reservoir_m3"]
    deliverable = ledger["water_deliverable_m3"]
    evap_loss = ledger["water_surface_evap_loss_pct"]
    efficiency = ledger["water_irrigation_efficiency_pct"]
    
    deviation = payload["climate_matrix"]["deviation_from_baseline_celsius"]
    wet_bulb = payload["climate_matrix"]["wet_bulb_celsius"]
    penalty = max(0.0, deviation * 0.05) + max(0.0, (wet_bulb - 25.0) * 0.02)
    ndvi = max(0.12, 0.85 - penalty)
    soil_moisture = max(0.1, 0.75 - (vpd * 0.12)) * 50.0
    disease_risk = humidity * 0.4
    
    moisture_status = "CRITICAL LOW" if soil_moisture < 20 else ("LOW" if soil_moisture < 35 else "OPTIMAL")
    disease_level = "HIGH" if disease_risk > 40 else ("MEDIUM" if disease_risk > 20 else "LOW")
    viability = "VIABLE" if efficiency >= 50 else "UNVIABLE"
    penalty_active = "ACTIVE (CRITICAL LOSS)" if evap_loss > 10.0 else "INACTIVE"
    
    report = f"""
<div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.72rem; line-height: 1.45; color: var(--text-primary);">
    <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">
        [AGRONOMIC INTELLIGENCE MODEL DEPLOYED] - ANALYSIS FOR {region_name.upper()}
    </div>
    
    <p><strong>1. Soil Hydration Status:</strong> Root-zone saturation is currently measured at <strong>{soil_moisture:.2f}%</strong> ({moisture_status}). The localized vapor pressure deficit of <strong>{vpd:.4f} kPa</strong> indicates high transpiration stress. {"Urgent: Deploy moisture preservation protocols immediately." if soil_moisture < 35 else "Maintain standard scheduling; moisture depletion is nominal."}</p>
    
    <p><strong>2. Crop Stress & Canopy (NDVI):</strong> Vegetation index is currently calculated at <strong>{ndvi:.3f} NDVI</strong>. Under a current ambient temperature of <strong>{temp:.2f}°C</strong>, this indicates a {"compromised vegetative canopy showing signs of heat stress and degradation." if ndvi < 0.8 else "fully productive, stress-free canopy index."}</p>
    
    <p><strong>3. Pathological Vector Forecast:</strong> Calculated disease sprawl risk is <strong>{disease_risk:.1f}% ({disease_level})</strong> under current humidity conditions ({humidity:.1f}%). {"Fungal and pest replication risks are elevated. Deploy preventative crop protection." if disease_risk > 30 else "Pathogen replication is suppressed under current atmospheric humidity."}</p>

    <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-top: 6px; padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">
        RESOURCE LEDGER & SCHEDULING CONSTRAINTS
    </div>
    
    <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 6px;">
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Gross Reservoir Capacity:</span>
            <span>{gross:,.0f} m³</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Deliverable Water Volume:</span>
            <span>{deliverable:,.0f} m³</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Evaporative Rate:</span>
            <span>{evap_loss:.4f}%</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Overhead Sprinkler Viability:</span>
            <span style="color: {'var(--green-accent)' if viability == 'VIABLE' else 'var(--red-accent)'}">{viability} ({efficiency:.2f}% efficiency)</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Evaporative Waste Penalty:</span>
            <span style="color: {'var(--red-accent)' if 'ACTIVE' in penalty_active else 'var(--green-accent)'}">{penalty_active}</span>
        </li>
    </ul>

    <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 6px; padding: 8px; font-size: 0.65rem; color: var(--text-secondary); margin-top: 5px;">
        <strong>Agronomic Agent Guidance:</strong> Irrigation delivery has been calibrated against local wind speed ({telemetry["wind"]["speed_kmh"]:.2f} km/h) to minimize in-flight losses. Bids must remain below the deliverable ceiling of {deliverable:,.0f} m³.
    </div>
</div>
"""
    return report.strip()


@router.post("/{region_key}/chat", response_model=ChatResponse)
def simulate_chat(region_key: str, request: ChatRequest, name: str | None = None) -> ChatResponse:
    check_and_register_dynamic_region(region_key, name)

    if region_key not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    pipeline = WeatherIntelligencePipeline()
    payload = pipeline.execute(region_key)

    if not payload:
        return ChatResponse(
            reply="[System] Could not generate region telemetry payload. Please try again in a moment.",
            raw_data=None
        )



    # Intercept agronomic report requests to generate local model output
    q_lower = request.query.lower()
    if "agronomic report" in q_lower or "agricultural report" in q_lower or "agri-report" in q_lower:
        report_text = generate_dynamic_agri_report(payload)
        return ChatResponse(reply=report_text, raw_data={"source": "local_agri_model", "output": report_text})

    payload["user_query"] = request.query

    try:
        response = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=(10, 60))
        response.raise_for_status()
        try:
            resp_json = response.json()
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
            return ChatResponse(reply=response.text, raw_data=None)
    except requests.exceptions.Timeout:
        print(f"Webhook timeout for region: {region_key}")
        return ChatResponse(
            reply="[System] The AI Swarm is processing a complex analysis and took too long to respond. Please try again.",
            raw_data=None
        )
    except requests.exceptions.RequestException as e:
        print(f"Webhook error: {e}")
        return ChatResponse(
            reply="[System] Unable to reach the AI Swarm at this time. Please check the n8n workflow is active and retry.",
            raw_data=None
        )


@router.get("/{region_key}/grid-predictions")
def get_grid_predictions(region_key: str, name: str | None = None):
    """Return model-derived grid predictions extracted directly from the physics pipeline."""
    check_and_register_dynamic_region(region_key, name)

    cached = grid_predictor.get(region_key)

    if cached is None:
        # Not cached yet — run pipeline synchronously and store immediately
        pipeline = WeatherIntelligencePipeline()
        payload = pipeline.execute(region_key)
        if payload:
            grid_predictor._store(region_key, payload)
            cached = grid_predictor.get(region_key)

    if cached is None:
        return {
            "region_key": region_key,
            "status": "pending",
            "age_seconds": None,
            "predictions": {
                "grid_available_capacity_mw": None,
                "grid_demand_surge_pct": None,
                "thermal_overhead_pct": None,
                "peak_blackout_risk_pct": None,
                "peak_blackout_time": None,
                "grid_status": None,
                "ai_grid_summary": None,
            }
        }

    age = grid_predictor.get_age_seconds(region_key)
    return {
        "region_key": region_key,
        "status": "ready",
        "age_seconds": round(age, 1) if age is not None else None,
        "predictions": cached,
    }
