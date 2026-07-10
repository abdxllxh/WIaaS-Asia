from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class ClimateTelemetry(BaseModel):
    temperature_celsius: float = Field(..., description="Live temperature reading in °C")
    humidity_percentage: float = Field(..., description="Relative humidity percentage")
    wind_speed_kmh: float = Field(..., description="Wind speed in km/h")
    wind_direction_degrees: float = Field(..., description="Wind direction in degrees")


class ResourceLedger(BaseModel):
    water_gross_reservoir_m3: int
    water_deliverable_m3: int
    water_surface_evap_loss_pct: float
    water_irrigation_efficiency_pct: float
    grid_available_capacity_mw: float
    grid_demand_surge_pct: float
    fuel_available_liters: int
    fuel_thermal_overhead_pct: float
    grid_peak_surge_pct: float
    grid_peak_surge_time: str




class HourlyPrediction(BaseModel):
    time: str
    blackout_risk_pct: float
    available_capacity_mw: float


class M2MTrigger(BaseModel):
    action_required: bool
    recommended_mitigation: str


class AnalyticsSummary(BaseModel):
    max_blackout_risk_pct: float
    peak_surge_hour: str
    grid_status: str
    m2m_trigger: M2MTrigger


class GridPredictionMatrix(BaseModel):
    timeline_24h: list[HourlyPrediction]
    analytics_summary: AnalyticsSummary



class AnalyticsResponse(BaseModel):
    region_name: str
    system_status: str
    climate_matrix: dict[str, float | str]
    ledger: ResourceLedger
    telemetry: ClimateTelemetry
    crop_health_ndvi: float
    soil_moisture_pct: float
    disease_risk_pct: float
    water_stress_index: float
    diurnal_cycle: str
    timezone: str
    latitude: float
    longitude: float
    llm_state_vector: str
    risk_level: str
    mission_criticality_score: int
    grid_predictions: GridPredictionMatrix


class ChatRequest(BaseModel):
    query: str = Field(..., description="User query for the AI Swarm")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="Response from the n8n webhook")
    raw_data: dict[str, Any] | None = Field(None, description="Raw JSON from n8n")