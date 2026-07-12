"""Endpoints for the v1 API."""
from __future__ import annotations
import os
import json
import asyncio
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
from app.services.grid_predictor import grid_predictor
import requests
import json

router = APIRouter(prefix="/analytics", tags=["analytics"])


N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "https://abdxllxh2002.app.n8n.cloud/webhook/wias-crisis-simulation"
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

    region = REGIONS[region_key]
    ledger_engine = SyntheticResourceLedger(region["resource_baselines"])
    analysis = {
        "deviation_celsius": deviation,
        "vapor_pressure_deficit_kpa": vpd,
    }

    # 3. Calculation of the 24h predictions
    grid_predictions = ledger_engine.compute_24h_predictions(
        deviation_celsius=analysis["deviation_celsius"],
        vpd_kpa=analysis["vapor_pressure_deficit_kpa"]
    )

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
        mission_criticality_score=payload["mission_criticality_score"],
        grid_predictions=grid_predictions,
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


@router.post("/crisislens/chat")
async def proxy_crisislens_chat(payload: dict) -> dict:
    """Proxy requests to the CrisisLens n8n webhook to prevent CORS issues in the frontend.
    
    Runs the blocking HTTP call in a thread executor so uvicorn's event loop
    is not blocked during the 25-120 second n8n AI workflow execution.
    """
    url = "https://abdxllxh2002.app.n8n.cloud/webhook/wias-crisislens"

    def _call_n8n() -> requests.Response:
        print(f"[crisislens] → POST {url}  payload keys={list(payload.keys())}")
        return requests.post(url, json=payload, timeout=(15.0, 120.0))

    def _extract(d: dict) -> str:
        """Pick the reply text from whichever field n8n uses."""
        return (
            d.get("chat_message")
            or d.get("regional_summary")
            or d.get("output")
            or d.get("message")
            or d.get("text")
            or d.get("reply")
            or str(d)
        )

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _call_n8n)
        response.raise_for_status()
        print(f"[crisislens] ← {response.status_code}  ({len(response.content)} bytes)")
        print(f"[crisislens] raw body: {response.text[:300]}")
        try:
            data = response.json()
            if isinstance(data, list) and data:
                first = data[0]
                reply = _extract(first) if isinstance(first, dict) else str(first)
            elif isinstance(data, dict):
                reply = _extract(data)
            else:
                reply = str(data)
            print(f"[crisislens] extracted reply ({len(reply)} chars): {reply[:120]}")
            return {"reply": reply}
        except ValueError:
            return {"reply": response.text}
    except requests.exceptions.RequestException as e:
        print(f"[endpoints] CrisisLens Proxy error: {type(e).__name__}: {e}")
        # Generate a high-quality offline fallback response
        q = payload.get("message", "").lower()
        
        reply_text = (
            "### ⚠️ CrisisLens Local Fallback Active\n\n"
            "The remote n8n CrisisLens workflow is currently unreachable (Connection Timeout). "
            "Deploying local rule-based safety directives:\n\n"
        )
        
        if "sylhet" in q:
            reply_text += (
                "**Location:** Sylhet Region\n\n"
                "*   **Farmers:** Implement flash flood drainage procedures. Move harvested crops to elevated storage.\n"
                "*   **Public:** Avoid low-lying riverbanks near the Surma/Kushiyara rivers. Store clean drinking water.\n"
                "*   **Grid Teams:** Monitor substations in flood-prone zones; prepare for load-shedding if water levels breach safety limits.\n"
                "*   **Logistics:** Reroute transport away from national highway N2; expect localized road inundation."
            )
        elif "punjab" in q:
            reply_text += (
                "**Location:** Punjab Region\n\n"
                "*   **Farmers:** Suspend overhead sprinkler irrigation to avoid high-temperature evaporation loss. Rely on root-zone drip feeds.\n"
                "*   **Public:** Minimize direct sun exposure between 11 AM and 4 PM. Stay hydrated.\n"
                "*   **Grid Teams:** Anticipate high demand surge from agricultural tube-well pumps; activate peak-load sharing protocols.\n"
                "*   **Logistics:** Ensure air-conditioned cargo compartments are active for heat-sensitive goods."
            )
        elif "paris" in q:
            reply_text += (
                "**Location:** Paris Region\n\n"
                "*   **Farmers:** Adjust vineyard irrigation grids to compensate for unexpected vapor pressure deficit (VPD) surges.\n"
                "*   **Public:** Monitor local municipal ozone levels and heat advisory feeds.\n"
                "*   **Grid Teams:** Run thermal overhead capacity assessments on urban underground transmission lines.\n"
                "*   **Logistics:** Expect cargo scheduling adjustments due to high temperature restrictions on rail lines."
            )
        else:
            reply_text += (
                "Greetings! The CrisisLens Agent is running in offline fallback mode. Please specify a region (e.g., **Sylhet**, **Punjab**, or **Paris**) or ask a specific question about climate telemetry, grid load, or emergency protocols, and I will generate local safety directives for you."
            )
            
        return {"reply": reply_text, "offline_fallback": True}


@router.post("/{region_key}/chat", response_model=ChatResponse)
def simulate_chat(region_key: str, request: ChatRequest, name: str | None = None) -> ChatResponse:
    check_and_register_dynamic_region(region_key, name)

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

    # Intercept agronomic report requests to generate local model output
    q_lower = request.query.lower()
    if "agronomic report" in q_lower or "agricultural report" in q_lower or "agri-report" in q_lower:
        report_text = generate_dynamic_agri_report(payload)
        return ChatResponse(reply=report_text, raw_data={"source": "local_agri_model", "output": report_text})

    payload["user_query"] = request.query
    payload["chatInput"] = request.query

    try:
        print(f"Sending payload to n8n: {N8N_WEBHOOK_URL}")
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
        print(f"Webhook error detail: {e}")
        return ChatResponse(
            reply=f"[System] Unable to reach the AI Swarm. Error details: {e}",
            raw_data=None,
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
