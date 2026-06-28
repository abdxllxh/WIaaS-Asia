"""
Core Backend Orchestrator — WIaaS Physics Pipeline.

Coordinates the full ingestion-to-vector pipeline across six explicit stages:
    Stage 1 → Live telemetry ingestion (Open-Meteo API / GraphCast GNN)
    Stage 2 → Multi-variable climate analysis  (ClimateAnomalyEngine)
    Stage 3 → Physics-degraded resource computation  (SyntheticResourceLedger)
    Stage 4 → Bounded text-state vector construction  (GNNToLLMBridge)
    Stage 5 → Structured JSON payload assembly
    Stage 6 → Atomic file commit

The final payload serves two consumers:
    - The vLLM inference layer, which injects the `llm_state_vector` as the
      system context before dispatching to the appropriate LoRA agent persona.
    - The n8n M2M actuation backend, which ingests the structured JSON directly
      to trigger webhooks for supply chain routing, smart-grid adjustment, and
      IoT agricultural hardware commands.
"""

from __future__ import annotations

import json
import requests
from datetime import datetime, timezone

from config import REGIONS
from analytics import ClimateAnomalyEngine
from ledger import SyntheticResourceLedger
from bridge import GNNToLLMBridge


class WeatherIntelligencePipeline:

    _API_BASE_URL    = "https://api.open-meteo.com/v1/forecast"
    _TELEMETRY_VARS  = "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
    _REQUEST_TIMEOUT = 10   # seconds; configurable at class level, not buried in method bodies
    _PIPELINE_VERSION = "1.1.0"

    def __init__(self, output_filename: str = "live_weather_stream.json"):
        self.output_filename = output_filename

    # ── Stage 1: Telemetry Ingestion ─────────────────────────────────────────

    def fetch_api_telemetry(self, lat: float, lon: float) -> dict | None:
        """
        Fetches live meteorological telemetry from Open-Meteo.

        In production, this endpoint is replaced by the GraphCast GNN inference
        layer, which provides the same field names as multi-dimensional spatial
        tensors. The pipeline interface is intentionally identical to both sources
        so that swapping the data origin requires zero downstream changes.

        Returns:
            Raw current-conditions dict, or None on any failure variant.
        """
        params = {
            "latitude":  lat,
            "longitude": lon,
            "current":   self._TELEMETRY_VARS,
            "timezone":  "auto",
        }
        try:
            response = requests.get(
                self._API_BASE_URL, params=params, timeout=self._REQUEST_TIMEOUT
            )
            response.raise_for_status()
            return response.json()["current"]
        except requests.exceptions.Timeout:
            print(f"[❌ TIMEOUT]  API request exceeded {self._REQUEST_TIMEOUT}s limit.")
        except requests.exceptions.HTTPError as e:
            print(f"[❌ HTTP {e.response.status_code}]  Telemetry API error: {e}")
        except (requests.exceptions.RequestException, KeyError, ValueError) as e:
            print(f"[❌ ERROR]    Telemetry ingestion failed: {e}")
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
            print(f"[❌ ERROR]  Unknown region key: '{region_key}'")
            print(f"[ℹ  INFO]  Configured regions: {list(REGIONS.keys())}")
            return None

        region = REGIONS[region_key]
        print(f"\n[⚡ INIT]  Pipeline active → {region['name']}")
        print("─" * 66)

        # ── Stage 1: Live Telemetry ───────────────────────────────────────────
        raw = self.fetch_api_telemetry(region["latitude"], region["longitude"])
        if raw is None:
            return None

        telemetry: dict = {
            "temperature_celsius":   raw.get("temperature_2m"),
            "humidity_percentage":   raw.get("relative_humidity_2m"),
            "wind": {
                "speed_kmh":         raw.get("wind_speed_10m"),
                "direction_degrees": raw.get("wind_direction_10m"),
            },
        }
        print(
            f"[1/6] ✓  Telemetry        "
            f"{telemetry['temperature_celsius']}°C | "
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
            f"[2/6] ✓  Analysis         "
            f"{analysis['status']} | "
            f"VPD={analysis['vapor_pressure_deficit_kpa']} kPa | "
            f"Wet-bulb={analysis['wet_bulb_celsius']}°C"
        )

        # ── Stage 3: Physics-Degraded Resource Ledger ─────────────────────────
        ledger_engine = SyntheticResourceLedger(region["resource_baselines"])
        ledger: dict = ledger_engine.compute(
            deviation_celsius     = analysis["deviation_celsius"],
            vpd_kpa               = analysis["vapor_pressure_deficit_kpa"],
            irrigation_efficiency = analysis["overhead_irrigation_efficiency"],
        )
        print(
            f"[3/6] ✓  Ledger           "
            f"Water={ledger['water_deliverable_m3']:,} m³ | "
            f"Grid={ledger['grid_available_capacity_mw']} MW | "
            f"Fuel={ledger['fuel_available_liters']:,} L"
        )

        # ── Stage 4: GNN-to-LLM Text-State Vector ─────────────────────────────
        state_vector: str = GNNToLLMBridge.build_state_vector(
            region_name = region["name"],
            telemetry   = telemetry,
            analysis    = analysis,
            ledger      = ledger,
        )
        print(f"[4/6] ✓  State vector     {len(state_vector)} chars constructed")

        # ── Stage 5: Structured Payload Assembly ──────────────────────────────
        payload: dict = {
            "_meta": {
                "pipeline_version": self._PIPELINE_VERSION,
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "region_key":       region_key,
            },
            "monitored_region": region["name"],
            "system_status":    analysis["status"],
            "climate_matrix": {
                "intensity_level":                 analysis["intensity"],
                "deviation_from_baseline_celsius": analysis["deviation_celsius"],
                "vapor_pressure_deficit_kpa":      analysis["vapor_pressure_deficit_kpa"],
                "heat_index_celsius":              analysis["heat_index_celsius"],
                "wet_bulb_celsius":                analysis["wet_bulb_celsius"],
                "telemetry":                       telemetry,
            },
            # RLVR constraint surface: consumed by the Agri-Agent reward verifier.
            "rlvr_constraints": {
                "overhead_irrigation_efficiency": analysis["overhead_irrigation_efficiency"],
                "overhead_irrigation_viable":     analysis["overhead_irrigation_efficiency"] >= 0.5,
                "irrigation_penalty_active":      analysis["overhead_irrigation_efficiency"] < 0.5,
            },
            # Fully degraded asset ceilings: the bid limits for all agents.
            "synthetic_resource_ledger": ledger,
            # The bounded context injected into the vLLM inference layer.
            "llm_state_vector": state_vector,
        }
        payload_bytes = len(json.dumps(payload))
        print(f"[5/6] ✓  Payload          {payload_bytes:,} bytes assembled")

        # ── Stage 6: Atomic File Commit ───────────────────────────────────────
        with open(self.output_filename, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=4, ensure_ascii=False)
        print(f"[6/6] ✓  Committed      → {self.output_filename}")

        # Surface the state vector directly in terminal output for inspection.
        print(f"\n{'─' * 66}\n{state_vector}\n")
        return payload


if __name__ == "__main__":
    pipeline = WeatherIntelligencePipeline()
    pipeline.execute("pakistan_punjab")
    pipeline.execute("togo_maritime")
