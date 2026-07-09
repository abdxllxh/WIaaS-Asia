"""Schémas Pydantic pour l'optimisation de chargement aérien."""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field

from app.services.cargo_optimizer import AircraftSpec, CargoItem

__all__ = [
    "CargoItem",
    "AircraftSpec",
    "CargoOptimizationRequest",
    "CargoOptimizationResult",
    "DEFAULT_FLEET",
]


class CargoOptimizationResult(BaseModel):
    region_name: str
    aircraft_model: str
    selected_item_ids: List[str]
    rejected_item_ids: List[str]
    total_weight_kg: float
    total_volume_m3: float
    space_utilization_pct: float
    weight_utilization_pct: float
    center_of_gravity_pct: float
    is_cog_safe: bool
    density_altitude_penalty_applied: bool
    safety_margin_status: str


DEFAULT_FLEET: dict[str, AircraftSpec] = {
    "regional_cargo_spec": AircraftSpec(
        model_name="WIaaS-Aero-ATR72F",
        max_weight=8500.0,
        max_volume=75.0,
        length_meters=27.17,
        allowed_cog_range=(22.0, 38.0),
    ),
}


class CargoOptimizationRequest(BaseModel):
    aircraft_profile_key: str = "regional_cargo_spec"
    manifest_payload: List[CargoItem]
