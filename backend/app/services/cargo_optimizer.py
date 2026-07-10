"""
Moteur d'optimisation de chargement aérien multi-contraintes.

Sélectionne un manifeste cargo sous contraintes de poids, volume, compatibilité
des matières dangereuses et équilibre du centre de gravité (CoG).
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from pydantic import BaseModel, Field


class CargoItem(BaseModel):
    id: str
    weight: float = Field(..., description="Weight in kg")
    volume: float = Field(..., description="Volume in m3")
    priority: int = Field(..., description="Priority score from 1 (Low) to 5 (Critical/Medical)")
    hazard_class: Optional[str] = Field(None, description="Hazard category (e.g., 'Lithium', 'Chemical')")


class AircraftSpec(BaseModel):
    model_name: str
    max_weight: float
    max_volume: float
    length_meters: float
    allowed_cog_range: Tuple[float, float] = Field(
        ..., description="Min and Max allowed Center of Gravity % from nose"
    )


class OptimizationResult(BaseModel):
    selected_item_ids: List[str]
    rejected_item_ids: List[str]
    total_weight: float
    total_volume: float
    space_utilization_rate: float
    weight_utilization_rate: float
    center_of_gravity_percent: float
    is_cog_safe: bool
    safety_margin_status: str


class AviationCargoEngine:
    """Optimisation cargo avec matrice d'incompatibilité et simulation CoG."""

    _INCOMPATIBLE_HAZARD_PAIRS = (
        frozenset({"Lithium", "Chemical"}),
        frozenset({"Flammable", "Oxidizer"}),
    )

    @staticmethod
    def _check_hazard_compatibility(item_a: CargoItem, item_b: CargoItem) -> bool:
        if not (item_a.hazard_class and item_b.hazard_class):
            return True
        current_pair = {item_a.hazard_class, item_b.hazard_class}
        return not any(pair.issubset(current_pair) for pair in AviationCargoEngine._INCOMPATIBLE_HAZARD_PAIRS)

    @classmethod
    def optimize_load(cls, items: List[CargoItem], aircraft: AircraftSpec) -> OptimizationResult:
        # Score = (Priority^2 * densité) pour favoriser les charges critiques et compactes
        sorted_items = sorted(
            items,
            key=lambda x: (x.priority ** 2) * (x.weight / (x.volume + 0.01)),
            reverse=True,
        )

        selected_items: List[CargoItem] = []
        rejected_item_ids: List[str] = []
        current_weight = 0.0
        current_volume = 0.0

        for item in sorted_items:
            if current_weight + item.weight > aircraft.max_weight:
                rejected_item_ids.append(item.id)
                continue
            if current_volume + item.volume > aircraft.max_volume:
                rejected_item_ids.append(item.id)
                continue

            if any(not cls._check_hazard_compatibility(item, loaded) for loaded in selected_items):
                rejected_item_ids.append(item.id)
                continue

            selected_items.append(item)
            current_weight += item.weight
            current_volume += item.volume

        # Simulation du moment de force le long du fuselage
        total_moment = 0.0
        for index, item in enumerate(selected_items):
            estimated_position_meters = (index / max(len(selected_items), 1)) * aircraft.length_meters
            total_moment += item.weight * estimated_position_meters

        if current_weight > 0:
            cog_position_meters = total_moment / current_weight
            cog_percent = (cog_position_meters / aircraft.length_meters) * 100
        else:
            cog_percent = 50.0

        is_cog_safe = aircraft.allowed_cog_range[0] <= cog_percent <= aircraft.allowed_cog_range[1]
        utilization_v = (current_volume / aircraft.max_volume) * 100
        utilization_w = (current_weight / aircraft.max_weight) * 100

        if is_cog_safe and (utilization_v > 85 or utilization_w > 85):
            status = "CRITICAL METRIC OPTIMIZED - FLIGHT SECURE"
        elif not is_cog_safe:
            status = "WARNING: UNBALANCED MOMENTUM - RE-INDEXING REQUIRED BY AGENTS"
        else:
            status = "NOMINAL OPERATIONAL PROFILE"

        return OptimizationResult(
            selected_item_ids=[it.id for it in selected_items],
            rejected_item_ids=rejected_item_ids,
            total_weight=current_weight,
            total_volume=current_volume,
            space_utilization_rate=round(utilization_v, 2),
            weight_utilization_rate=round(utilization_w, 2),
            center_of_gravity_percent=round(cog_percent, 2),
            is_cog_safe=is_cog_safe,
            safety_margin_status=status,
        )
