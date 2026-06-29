from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.config import REGIONS
from app.engines.analytics import ClimateAnomalyEngine
from app.engines.ledger import SyntheticResourceLedger
from app.schemas.analytics import (
    AnalyticsResponse,
    ClimateTelemetry,
    ResourceLedger,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/{region_key}", response_model=AnalyticsResponse)
def analyze_region(region_key: str) -> AnalyticsResponse:
    if region_key not in REGIONS:
        raise HTTPException(status_code=404, detail="Region not found")

    region = REGIONS[region_key]
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
