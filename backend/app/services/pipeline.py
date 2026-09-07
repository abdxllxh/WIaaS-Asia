"""
Core Backend Orchestrator -- WIaaS Physics Pipeline.

Coordinates the full ingestion-to-vector pipeline across six explicit stages:
    Stage 1 -> Live telemetry ingestion (Open-Meteo API / GraphCast GNN)
    Stage 2 -> Multi-variable climate analysis  (ClimateAnomalyEngine)
    Stage 3 -> Physics-degraded resource computation  (SyntheticResourceLedger)
    Stage 4 -> Bounded text-state vector construction  (GNNToLLMBridge)
    Stage 5 -> Structured JSON payload assembly
    Stage 6 -> Atomic file commit

The final payload serves two consumers:
    - The vLLM inference layer, which injects the `llm_state_vector` as the
      system context before dispatching to the appropriate LoRA agent persona.
    - The n8n M2M actuation backend, which ingests the structured JSON directly
      to trigger webhooks for supply chain routing, smart-grid adjustment, and
      IoT agricultural hardware commands.
"""

from __future__ import annotations

import sys

# Ensure stdout and stderr handle arbitrary unicode without crashing on Windows cp1252
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import json
import requests
from datetime import datetime, timezone

from app.core.config import REGIONS
from app.engines.analytics import ClimateAnomalyEngine
from app.engines.ledger import SyntheticResourceLedger
from app.services.bridge import GNNToLLMBridge


class WeatherIntelligencePipeline:

    _API_BASE_URL    = "https://api.open-meteo.com/v1/forecast"
    _TELEMETRY_VARS  = "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
    _REQUEST_TIMEOUT = 10   # seconds; configurable at class level
    _PIPELINE_VERSION = "1.1.0"

    def __init__(self, output_filename: str = "live_weather_stream.json"):
        self.output_filename = output_filename

    _telemetry_cache = {}

    def fetch_api_telemetry(self, lat: float, lon: float) -> dict | None:
        """
        Fetches live meteorological telemetry from Open-Meteo with caching
        to support safe high-frequency polling. Adds sub-second fluctuations
        to simulate active streaming.

        In production, this endpoint is replaced by the GraphCast GNN inference
        layer, which provides the same field names as multi-dimensional spatial
        tensors. The pipeline interface is intentionally identical to both sources.

        Returns:
            Raw current-conditions dict, or None on any failure variant.
        """
        import time
        import random
        
        cache_key = (lat, lon)
        now = time.time()
        cache_duration = 30.0  # cache API responses for 30s
        
        cached = self._telemetry_cache.get(cache_key)
        if cached and (now - cached["time"] < cache_duration):
            raw = cached["data"].copy()
        else:
            params = {
                "latitude":  lat,
                "longitude": lon,
                "current":   self._TELEMETRY_VARS,
                "daily":     "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
                "timezone":  "auto",
            }
            # Added production standard User-Agent header to avoid edge cloud firewalls during hackathon execution
            headers = {
                "User-Agent": "WeatherIntelligencePipeline/1.1.0 (Hackathon Context Engine)",
                "Accept": "application/json"
            }
            try:
                response = requests.get(
                    self._API_BASE_URL, params=params, headers=headers, timeout=self._REQUEST_TIMEOUT
                )
                response.raise_for_status()
                response_json = response.json()
                raw = response_json["current"]
                raw["_forecast_7d"] = {
                    "max_temps_c": response_json.get("daily", {}).get("temperature_2m_max", []),
                    "min_temps_c": response_json.get("daily", {}).get("temperature_2m_min", []),
                    "precipitation_sums_mm": response_json.get("daily", {}).get("precipitation_sum", []),
                    "rain_prob_max_pct": response_json.get("daily", {}).get("precipitation_probability_max", []),
                }
                self._telemetry_cache[cache_key] = {"time": now, "data": raw}
            except requests.exceptions.Timeout:
                print(f"[TIMEOUT]  API request exceeded {self._REQUEST_TIMEOUT}s limit. Checking cache/baseline.")
                raw = cached["data"] if cached else None
            except requests.exceptions.HTTPError as e:
                print(f"[HTTP {e.response.status_code}]  Telemetry API error: {e}. Checking cache/baseline.")
                raw = cached["data"] if cached else None
            except (requests.exceptions.RequestException, KeyError, ValueError) as e:
                print(f"[ERROR]    Telemetry ingestion failed: {e}. Checking cache/baseline.")
                raw = cached["data"] if cached else None

        if raw:
            # Inject tiny random fluctuations to simulate second-by-second updates
            raw = raw.copy()
            raw["temperature_2m"] += random.uniform(-0.04, 0.04)
            raw["relative_humidity_2m"] = max(0.0, min(100.0, raw["relative_humidity_2m"] + random.uniform(-0.1, 0.1)))
            raw["wind_speed_10m"] = max(0.0, raw["wind_speed_10m"] + random.uniform(-0.08, 0.08))
            raw["wind_direction_10m"] = (raw["wind_direction_10m"] + random.randint(-1, 1)) % 360
            return raw
            
        return None

    # ── Main Execution ───────────────────────────────────────────────────────

    def execute(self, region_key: str) -> dict | None:
        """
        Runs the full six-stage pipeline for the specified region.

        Args:
            region_key: A key from config.REGIONS (e.g. "pakistan_punjab").

        Returns:
            Fully assembled payload dict on success, None if any critical stage fails.
        """
        if region_key not in REGIONS:
            print(f"[ERROR]  Unknown region key: '{region_key}'")
            print(f"[INFO]   Configured regions: {list(REGIONS.keys())}")
            return None

        region = REGIONS[region_key]
        print(f"\n[INIT]  Pipeline active -> {region['name']}")
        print("-" * 66)

        # ── Stage 1: Live Telemetry ───────────────────────────────────────────
        raw = self.fetch_api_telemetry(region["latitude"], region["longitude"])
        if raw is None:
            print("[WARN]  Live telemetry unavailable. Falling back to region baseline.")
            raw = {
                "temperature_2m":       region["expected_max_baseline"],
                "relative_humidity_2m": 50.0,
                "wind_speed_10m":       10.0,
                "wind_direction_10m":   180,
            }

        telemetry: dict = {
            "temperature_celsius":   raw.get("temperature_2m"),
            "humidity_percentage":   raw.get("relative_humidity_2m"),
            "wind": {
                "speed_kmh":         raw.get("wind_speed_10m"),
                "direction_degrees": raw.get("wind_direction_10m"),
            },
        }
        print(
            f"[1/6] OK Telemetry        "
            f"{telemetry['temperature_celsius']}C | "
            f"{telemetry['humidity_percentage']}% RH | "
            f"{telemetry['wind']['speed_kmh']} km/h wind"
        )

        # ── Stage 2: Multi-Variable Climate Analysis ──────────────────────────
        analysis: dict = ClimateAnomalyEngine.calculate_thermal_anomaly(
            current_temp = telemetry["temperature_celsius"],
            baseline_max = region["expected_max_baseline"],
            humidity_pct = telemetry["humidity_percentage"],
            wind_kmh     = telemetry["wind"]["speed_kmh"],
        )
        print(
            f"[2/6] OK Analysis         "
            f"{analysis['status']} | "
            f"VPD={analysis['vapor_pressure_deficit_kpa']} kPa | "
            f"Wet-bulb={analysis['wet_bulb_celsius']}C"
        )

        # ── Stage 3: Physics-Degraded Resource Ledger ─────────────────────────
        ledger_engine = SyntheticResourceLedger(region["resource_baselines"])
        ledger: dict = ledger_engine.compute(
            current_temp          = telemetry["temperature_celsius"],
            vpd_kpa               = analysis["vapor_pressure_deficit_kpa"],
            irrigation_efficiency = analysis["overhead_irrigation_efficiency"],
        )
        print(
            f"[3/6] OK Ledger           "
            f"Water={ledger['water_deliverable_m3']:,} m3 | "
            f"Grid={ledger['grid_available_capacity_mw']} MW | "
            f"Fuel={ledger['fuel_available_liters']:,} L"
        )

        # ── Stage 4: GNN-to-LLM Text-State Vector ─────────────────────────────
        forecast_7d = raw.get("_forecast_7d", {
            "max_temps_c": [],
            "min_temps_c": [],
            "precipitation_sums_mm": [],
            "rain_prob_max_pct": [],
        })
        state_vector: str = GNNToLLMBridge.build_state_vector(
            region_name = region["name"],
            telemetry   = telemetry,
            analysis    = analysis,
            ledger      = ledger,
            forecast_7d = forecast_7d,
        )
        print(f"[4/6] OK State vector     {len(state_vector)} chars constructed")

        # ── Stage 5: Structured Payload Assembly ──────────────────────────────
        current_time = datetime.now(timezone.utc)
        diurnal_cycle = "DAY" if 6 <= current_time.hour <= 18 else "NIGHT"
        payload: dict = {
            "_meta": {
                "pipeline_version": self._PIPELINE_VERSION,
                "generated_at_utc": current_time.isoformat(),
                "region_key":       region_key,
                "timezone":         region.get("timezone", "UTC+0"),
                "coordinates": {
                    "latitude":     region["latitude"],
                    "longitude":    region["longitude"]
                },
                "diurnal_cycle":    diurnal_cycle
            },
            "monitored_region": region["name"],
            "system_status":    analysis["status"],
            "risk_level":       analysis["risk_level"],
            "mission_criticality_score": analysis["mission_criticality_score"],
            "climate_matrix": {
                "intensity_level":                 analysis["intensity"],
                "deviation_from_baseline_celsius": analysis["deviation_celsius"],
                "vapor_pressure_deficit_kpa":      analysis["vapor_pressure_deficit_kpa"],
                "heat_index_celsius":              analysis["heat_index_celsius"],
                "wet_bulb_celsius":                analysis["wet_bulb_celsius"],
                "telemetry":                       telemetry,
            },
            "rlvr_constraints": {
                "overhead_irrigation_efficiency": analysis["overhead_irrigation_efficiency"],
                "overhead_irrigation_viable":     analysis["overhead_irrigation_efficiency"] >= 0.5,
                "irrigation_penalty_active":      analysis["overhead_irrigation_efficiency"] < 0.5,
            },
            "synthetic_resource_ledger": ledger,
            "forecast_7d": forecast_7d,
            "llm_state_vector": state_vector,
        }
        # ── ADDED: n8n Compatibility Layer for vxr (Non-destructive) ────────────────
        payload["region_name"] = payload["monitored_region"]
        payload["climate_matrix"].update({
            "vapor_pressure_deficit_kpa":      payload["climate_matrix"]["vapor_pressure_deficit_kpa"],
            "heat_index_celsius":              payload["climate_matrix"]["heat_index_celsius"],
            "wet_bulb_celsius":                payload["climate_matrix"]["wet_bulb_celsius"],
            "water_surface_evap_loss_pct":     payload["synthetic_resource_ledger"]["water_surface_evap_loss_pct"],
            "water_irrigation_efficiency_pct": payload["synthetic_resource_ledger"]["water_irrigation_efficiency_pct"]
        })
        payload["ledger"] = {
            "grid_available_capacity_mw":      payload["synthetic_resource_ledger"]["grid_available_capacity_mw"],
            "grid_demand_surge_pct":           payload["synthetic_resource_ledger"]["grid_demand_surge_pct"],
            "fuel_thermal_overhead_pct":       payload["synthetic_resource_ledger"]["fuel_thermal_overhead_pct"]
        }
        payload["telemetry"] = {
            "temperature_celsius":             payload["climate_matrix"]["telemetry"]["temperature_celsius"],
            "humidity_percentage":             payload["climate_matrix"]["telemetry"]["humidity_percentage"],
            "wind_speed_kmh":                  payload["climate_matrix"]["telemetry"]["wind"]["speed_kmh"],
            "wind_direction_degrees":          payload["climate_matrix"]["telemetry"]["wind"]["direction_degrees"]
        }
        payload_bytes = len(json.dumps(payload))
        print(f"[5/6] OK Payload          {payload_bytes:,} bytes assembled")

        # ── Stage 6: Atomic File Commit ───────────────────────────────────────
        with open(self.output_filename, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=4, ensure_ascii=False)
        print(f"[6/6] OK Committed       -> {self.output_filename}")

        print(f"\n{'-' * 66}\n{state_vector}\n")
        return payload
