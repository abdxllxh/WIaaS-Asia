from __future__ import annotations

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


class AnalyticsResponse(BaseModel):
    region_name: str
    system_status: str
    climate_matrix: dict[str, float | str]
    ledger: ResourceLedger
    telemetry: ClimateTelemetry
