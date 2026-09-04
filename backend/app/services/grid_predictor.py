from __future__ import annotations

import threading
import time
from typing import Any


REFRESH_INTERVAL_SECONDS = 30   # refresh model data every 30s


def _extract_from_payload(payload: dict, region_key: str) -> dict:
    """
    Extract grid predictions directly from the pipeline payload (physics model output).
    This is the actual model data — no n8n roundtrip needed.
    """
    result: dict = {
        'grid_available_capacity_mw': None,
        'grid_demand_surge_pct': None,
        'thermal_overhead_pct': None,
        'peak_blackout_risk_pct': None,
        'peak_blackout_time': None,
        'grid_status': None,
        'ai_grid_summary': None,
    }

    # --- Resource ledger values (direct model output) ---
    ledger = payload.get('synthetic_resource_ledger', {})
    if not ledger:
        ledger = payload.get('ledger', {})

    grid = ledger.get('grid', {}) if isinstance(ledger.get('grid'), dict) else {}
    fuel = ledger.get('fuel', {}) if isinstance(ledger.get('fuel'), dict) else {}

    cap = grid.get('available_capacity_mw') or ledger.get('grid_available_capacity_mw')
    surge = grid.get('demand_surge_pct') or ledger.get('grid_demand_surge_pct')
    thermal = fuel.get('thermal_overhead_pct') or ledger.get('fuel_thermal_overhead_pct')
    peak_surge_pct = ledger.get('grid_peak_surge_pct', surge)
    peak_surge_time = ledger.get('grid_peak_surge_time', '19:00')

    if cap is not None:
        result['grid_available_capacity_mw'] = float(cap)
    if surge is not None:
        result['grid_demand_surge_pct'] = float(surge)
    if thermal is not None:
        result['thermal_overhead_pct'] = float(thermal)

    # --- Peak blackout risk: derived from peak surge (model-computed) ---
    if peak_surge_pct is not None:
        result['peak_blackout_risk_pct'] = round(min(100.0, float(peak_surge_pct) / 60.0 * 100.0), 2)
    result['peak_blackout_time'] = str(peak_surge_time) if peak_surge_time else '—'

    # --- Risk level -> grid status ---
    risk_level = payload.get('risk_level', '').upper()
    criticality = payload.get('mission_criticality_score', 0)
    if risk_level in ('HIGH', 'CRITICAL') or criticality >= 80:
        result['grid_status'] = 'CRITICAL'
    elif risk_level == 'MEDIUM' or criticality >= 50:
        result['grid_status'] = 'WARNING'
    else:
        result['grid_status'] = 'STABLE'

    # --- Build a real summary from model fields ---
    zone = (
        payload.get('monitored_region')
        or payload.get('region_name')
        or payload.get('_meta', {}).get('region_name')
        or region_key
    )
    sys_status = payload.get('system_status', 'OPERATIONAL')
    
    # Safely get temperature
    temp_val = (
        payload.get('climate_matrix', {}).get('telemetry', {}).get('temperature_celsius') or 
        payload.get('telemetry', {}).get('temperature_celsius')
    )
    if temp_val is not None:
        try:
            temp_str = f"{float(temp_val):.1f}°C"
        except (ValueError, TypeError):
            temp_str = f"{temp_val}°C"
    else:
        temp_str = "—°C"

    deviation = payload.get('climate_matrix', {}).get('deviation_from_baseline_celsius', 0)
    try:
        dev_str = f"+{float(deviation):.1f}°C above baseline" if deviation and float(deviation) > 0 else f"{float(deviation):.1f}°C from baseline"
    except (ValueError, TypeError):
        dev_str = f"{deviation}°C from baseline"

    cap_str = f"{result['grid_available_capacity_mw']:.0f} MW" if result['grid_available_capacity_mw'] is not None else '—'
    surge_str = f"{result['grid_demand_surge_pct']:.1f}%" if result['grid_demand_surge_pct'] is not None else '—'
    
    result['ai_grid_summary'] = (
        f"{zone}: {sys_status}. Temp {temp_str} ({dev_str}). "
        f"Grid capacity {cap_str}, demand surge {surge_str}. "
        f"Risk: {result['grid_status']} (score {criticality}/100)."
    )

    return result


class GridPredictionCache:
    def __init__(self):
        self._lock = threading.Lock()
        self._cache = {}
        self._last_refresh = {}
        self._pending = set()

    def get(self, region_key):
        with self._lock:
            return self._cache.get(region_key)

    def get_age_seconds(self, region_key):
        with self._lock:
            ts = self._last_refresh.get(region_key)
            if ts is None:
                return None
            return time.time() - ts

    def request_refresh(self, region_key, payload):
        """Store predictions immediately from the payload (no async needed)."""
        with self._lock:
            age = time.time() - self._last_refresh.get(region_key, 0)
            if age < REFRESH_INTERVAL_SECONDS:
                return  # still fresh, skip
        self._store(region_key, payload)

    def _store(self, region_key, payload):
        try:
            predictions = _extract_from_payload(payload, region_key)
            with self._lock:
                self._cache[region_key] = predictions
                self._last_refresh[region_key] = time.time()
                cap = predictions.get('grid_available_capacity_mw')
                risk = predictions.get('peak_blackout_risk_pct')
                peak = predictions.get('peak_blackout_time')
                status = predictions.get('grid_status')
                print(f'[grid_predictor] Stored {region_key}: {cap} MW | surge risk {risk}% at {peak} | {status}')
        except Exception as e:
            print(f'[grid_predictor] Failed for {region_key}: {e}')


grid_predictor = GridPredictionCache()
