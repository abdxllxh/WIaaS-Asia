"""
Global Configuration Layer for WIaaS.

This module is the single source of truth for all numerical constants in the
pipeline. Every threshold, coefficient, and baseline is declared here —
no magic numbers exist anywhere else in the codebase.

Sections:
    PHYSICS             — Physical/atmospheric constants and equation parameters
    ANOMALY_THRESHOLDS  — Severity triggers (decoupled from grading logic)
    DEGRADATION         — Asset degradation rate coefficients (empirically calibrated)
    REGIONS             — Monitored zones with historical baselines and resource inventories
"""
from __future__ import annotations

# ─── Fundamental Physics Constants ─────────────────────────────────────────────

PHYSICS: dict[str, float] = {
    # Tetens equation parameters for saturation vapor pressure (kPa).
    # Source: WMO Technical Note No. 8 (2018 revision)
    "tetens_a": 0.6108,   # Leading coefficient
    "tetens_b": 17.27,    # Temperature scaling factor
    "tetens_c": 237.3,    # Temperature offset (°C)

    # Overhead sprinkler evaporation model.
    # Calibrated to FAO-56 Penman-Monteith field data for open-air irrigation.
    "irrigation_loss_fraction_per_kpa_vpd": 0.08,  # 8% canopy-to-soil loss per kPa of VPD
    "irrigation_wind_loss_sensitivity":     0.02,  # Additional 2% loss per km/h of wind

    # Human wet-bulb physiological survivability limit.
    # Source: Sherwood & Huber (2010), "An adaptability limit to climate change due to heat stress"
    "wet_bulb_survivability_celsius": 35.0,
}

# ─── Anomaly Grading Thresholds ─────────────────────────────────────────────────
# Decoupled from analytics.py so operators can tune sensitivity without touching logic.

ANOMALY_THRESHOLDS: dict[str, float] = {
    # Temperature deviation above the regional baseline to trigger each alert level.
    "critical_deviation_celsius": 6.0,
    "warning_deviation_celsius":  3.0,

    # Wet-bulb temperature triggers (independent of any regional baseline).
    # 2°C operational safety margin below the physiological absolute limit.
    "wet_bulb_critical_celsius": 33.0,
    "wet_bulb_warning_celsius":  28.0,
}

# ─── Resource Degradation Coefficients ─────────────────────────────────────────
# Empirically calibrated rates of asset degradation per unit of climate stress.

DEGRADATION: dict[str, float] = {
    # Fraction of reservoir volume lost to surface evaporation per kPa of VPD.
    # (Calibrated to a mid-size open-air reservoir with ~500,000 m² surface area.)
    "water_surface_evap_fraction_per_kpa_vpd": 0.018,

    # Extra power demand fraction per °C above regional baseline (AC/cooling surge).
    "grid_demand_rate_per_degree_celsius": 0.028,

    # Extra fuel burn fraction per °C above baseline (logistics thermal overhead).
    "fuel_burn_rate_per_degree_celsius": 0.012,
}

# ─── Region Definitions ────────────────────────────────────────────────────────

REGIONS: dict[str, dict] = {
    "togo_maritime": {
        "name":                  "Maritime Region, Togo (Coastal West Africa)",
        "latitude":              6.1375,
        "longitude":             1.2223,
        # The historically recorded operational temperature ceiling for this zone.
        # Anything above this is a genuine anomaly — not a hot day in a hotter region.
        "expected_max_baseline": 34.0,
        # Nominal (non-crisis) inventory of finite physical assets.
        # Used as the starting point for physics-based degradation in the Ledger.
        "resource_baselines": {
            "water_reservoir_m3":  1_250_000,
            "grid_capacity_mw":    320,
            "fuel_reserve_liters": 95_000,
        },
    },
    "pakistan_punjab": {
        "name":                  "Punjab Region, Pakistan (Arid/Semi-Arid Zone)",
        "latitude":              31.1704,
        "longitude":             72.7097,
        # 47°C is NOT anomalous for Punjab — it is the regional operational ceiling.
        # The system will only trigger alerts for conditions breaching this threshold.
        "expected_max_baseline": 47.0,
        "resource_baselines": {
            "water_reservoir_m3":  3_800_000,
            "grid_capacity_mw":    850,
            "fuel_reserve_liters": 210_000,
        },
    },
}
