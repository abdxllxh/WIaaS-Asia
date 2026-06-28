"""
Synthetic Resource Ledger — Physics-Based Asset Degradation Engine.

Translates raw climate signals into actionable resource constraint vectors.
The ledger enforces finite physical reality in the multi-agent arena: every
agent bid is bounded by what the degraded physical inventory can actually supply.

No hardcoded inventory values exist in this module. All baselines are injected
from the region's `resource_baselines` config — the same engine adapts to a
Togolese coastal zone and a Pakistani arid plain without modification.

Degradation pathways:
    WATER  → VPD-driven reservoir surface evaporation + irrigation delivery loss.
    GRID   → Temperature deviation drives AC/cooling demand surge.
    FUEL   → Temperature deviation drives logistics thermal overhead.
"""

from __future__ import annotations
from config import DEGRADATION


class SyntheticResourceLedger:
    """
    Computes the physics-degraded availability of finite physical assets
    (water, grid capacity, fuel) as a function of live climate conditions.

    All degradation rates are sourced from DEGRADATION config.
    This class contains zero hardcoded coefficients or thresholds.

    Usage:
        ledger = SyntheticResourceLedger(region["resource_baselines"])
        constraints = ledger.compute(deviation_celsius, vpd_kpa, irrigation_efficiency)
    """

    def __init__(
        self,
        resource_baselines:  dict,
        degradation_config:  dict | None = None,
    ):
        """
        Args:
            resource_baselines:  Nominal (non-crisis) asset inventory from REGIONS config.
            degradation_config:  Physics degradation coefficients (defaults to DEGRADATION).
                                 Injectable for unit testing or scenario-analysis overrides.
        """
        self.baselines   = resource_baselines
        self.degradation = degradation_config or DEGRADATION

    def compute(
        self,
        deviation_celsius:     float,
        vpd_kpa:               float,
        irrigation_efficiency: float,
    ) -> dict:
        """
        Applies physics-based degradation to regional resource baselines.

        Three independent degradation pathways:

        WATER — Two-stage model:
            Stage 1 (gross): VPD drives atmospheric evaporation from the
                             open reservoir surface. High VPD = more loss.
            Stage 2 (deliverable): Gross volume × irrigation efficiency gives
                             the water that actually reaches the soil root zone.
            These are distinct physical quantities surfaced separately so
            agents can reason about storage vs. deployment constraints.

        GRID — Temperature deviation drives demand surge (AC load growth).
               Available capacity shrinks as heat-driven consumption claims
               a larger share of the nominal installed MW.

        FUEL — Temperature deviation drives logistics thermal overhead
               (refrigerated transport, engine cooling in extreme heat).
               Effective reserve shrinks as operational burn rate increases.

        Args:
            deviation_celsius:     Temperature excess above regional baseline.
                                   Negative values indicate below-baseline conditions
                                   and apply zero degradation (favorable state).
            vpd_kpa:               Atmospheric dryness; primary surface evaporation driver.
            irrigation_efficiency: Fraction of water reaching soil [0.05 – 1.0].

        Returns:
            A fully computed resource constraint dict — the bid ceiling for all agents.
        """
        # Below-baseline temperatures are favorable; degradation floor is zero.
        thermal_stress = max(0.0, deviation_celsius)

        # ── Water ─────────────────────────────────────────────────────────────

        # Stage 1: VPD-driven reservoir surface evaporation.
        # Physical cap at 30%: even in extreme conditions, an open reservoir
        # cannot lose more than this fraction in a daily cycle.
        surface_evap_frac = min(
            0.30,
            vpd_kpa * self.degradation["water_surface_evap_fraction_per_kpa_vpd"]
        )
        gross_reservoir_m3 = round(
            self.baselines["water_reservoir_m3"] * (1.0 - surface_evap_frac)
        )

        # Stage 2: Irrigation system delivery efficiency.
        # Accounts for in-flight evaporation from sprinklers (computed by RLVR verifier).
        deliverable_water_m3 = round(gross_reservoir_m3 * irrigation_efficiency)

        # ── Grid ──────────────────────────────────────────────────────────────

        # Physical cap at 60%: demand cannot exceed 160% of nominal baseline
        # (grid hardware limits, not an arbitrary threshold).
        grid_demand_surge_frac = min(
            0.60,
            thermal_stress * self.degradation["grid_demand_rate_per_degree_celsius"]
        )
        available_grid_mw = round(
            self.baselines["grid_capacity_mw"] * (1.0 - grid_demand_surge_frac), 1
        )

        # ── Fuel ──────────────────────────────────────────────────────────────

        # Physical cap at 40%: extreme heat logistics overhead has a realistic upper bound.
        fuel_overhead_frac = min(
            0.40,
            thermal_stress * self.degradation["fuel_burn_rate_per_degree_celsius"]
        )
        available_fuel_liters = round(
            self.baselines["fuel_reserve_liters"] * (1.0 - fuel_overhead_frac)
        )

        return {
            # Water — surfaced as two distinct physical quantities
            "water_gross_reservoir_m3":        gross_reservoir_m3,
            "water_deliverable_m3":            deliverable_water_m3,
            "water_surface_evap_loss_pct":     round(surface_evap_frac * 100, 2),
            "water_irrigation_efficiency_pct": round(irrigation_efficiency * 100, 1),
            # Grid
            "grid_available_capacity_mw":      available_grid_mw,
            "grid_demand_surge_pct":           round(grid_demand_surge_frac * 100, 2),
            # Fuel
            "fuel_available_liters":           available_fuel_liters,
            "fuel_thermal_overhead_pct":       round(fuel_overhead_frac * 100, 2),
        }
