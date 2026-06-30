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
        "expected_max_baseline": 34.0,
        "timezone":              "GMT+0 (Togo Time)",
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
        "expected_max_baseline": 47.0,
        "timezone":              "GMT+5 (Pakistan Standard Time)",
        "resource_baselines": {
            "water_reservoir_m3":  3_800_000,
            "grid_capacity_mw":    850,
            "fuel_reserve_liters": 210_000,
        },
    },
    # ── Europe ─────────────────────────────────────────────────────────────
    "france_paris": {
        "name":                  "Paris Île-de-France, France (Temperate Zone)",
        "latitude":              48.8566,
        "longitude":             2.3522,
        "expected_max_baseline": 35.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2_100_000,
            "grid_capacity_mw":    600,
            "fuel_reserve_liters": 120_000,
        },
    },
    "spain_andalusia": {
        "name":                  "Andalusia, Spain (Mediterranean Hot Arid Zone)",
        "latitude":              37.3891,
        "longitude":             -5.9845,
        "expected_max_baseline": 42.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  950_000,
            "grid_capacity_mw":    450,
            "fuel_reserve_liters": 80_000,
        },
    },
    "germany_bavaria": {
        "name":                  "Bavaria, Germany (Continental Zone)",
        "latitude":              48.1351,
        "longitude":             11.5820,
        "expected_max_baseline": 33.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2_800_000,
            "grid_capacity_mw":    750,
            "fuel_reserve_liters": 150_000,
        },
    },
    "uk_london": {
        "name":                  "Greater London, United Kingdom (Maritime Temperate)",
        "latitude":              51.5074,
        "longitude":             -0.1278,
        "expected_max_baseline": 31.0,
        "timezone":              "GMT+1 (British Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  1_500_000,
            "grid_capacity_mw":    500,
            "fuel_reserve_liters": 90_000,
        },
    },
    "italy_sicily": {
        "name":                  "Sicily, Italy (Subtropical Mediterranean Zone)",
        "latitude":              37.5990,
        "longitude":             14.0154,
        "expected_max_baseline": 44.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  800_000,
            "grid_capacity_mw":    400,
            "fuel_reserve_liters": 75_000,
        },
    },
    # ── Americas ───────────────────────────────────────────────────────────
    "usa_california_central_valley": {
        "name":                  "Central Valley, California, USA (Semi-Arid Agri Hub)",
        "latitude":              36.7783,
        "longitude":             -119.4179,
        "expected_max_baseline": 41.0,
        "timezone":              "GMT-7 (Pacific Daylight Time)",
        "resource_baselines": {
            "water_reservoir_m3":  4_500_000,
            "grid_capacity_mw":    900,
            "fuel_reserve_liters": 250_000,
        },
    },
    "usa_texas_houston": {
        "name":                  "Houston, Texas, USA (Humid Subtropical Grid Edge)",
        "latitude":              29.7604,
        "longitude":             -95.3698,
        "expected_max_baseline": 38.0,
        "timezone":              "GMT-5 (Central Daylight Time)",
        "resource_baselines": {
            "water_reservoir_m3":  3_200_000,
            "grid_capacity_mw":    1_200,
            "fuel_reserve_liters": 300_000,
        },
    },
    "brazil_cerrado": {
        "name":                  "Cerrado Savannah, Brazil (Tropical Agro Ecosystem)",
        "latitude":              -14.2350,
        "longitude":             -51.9253,
        "expected_max_baseline": 36.0,
        "timezone":              "GMT-3 (Brasilia Time)",
        "resource_baselines": {
            "water_reservoir_m3":  5_000_000,
            "grid_capacity_mw":    800,
            "fuel_reserve_liters": 180_000,
        },
    },
    "canada_alberta": {
        "name":                  "Alberta Plains, Canada (Boreal Subarctic)",
        "latitude":              53.9333,
        "longitude":             -116.5765,
        "expected_max_baseline": 30.0,
        "timezone":              "GMT-6 (Mountain Daylight Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2_000_000,
            "grid_capacity_mw":    550,
            "fuel_reserve_liters": 140_000,
        },
    },
    "argentina_pampas": {
        "name":                  "The Pampas, Argentina (Humid Pampas Plain)",
        "latitude":              -34.6037,
        "longitude":             -58.3816,
        "expected_max_baseline": 37.0,
        "timezone":              "GMT-3 (Argentina Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2_200_000,
            "grid_capacity_mw":    480,
            "fuel_reserve_liters": 110_000,
        },
    },
}
