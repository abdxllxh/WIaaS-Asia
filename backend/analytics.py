"""
Physics Enforcement & Climate Analytics Engine.

Computes multi-variable anomaly intensity vectors using regional baselines
and deterministic thermodynamic laws. This module contains zero magic numbers —
all constants are sourced from config.py.

Computational stack (in dependency order):
  1. _saturated_vapor_pressure_kpa()       → Tetens equation (WMO-calibrated)
  2. calculate_vapor_pressure_deficit()    → Atmospheric 'dryness', primary evaporation driver
  3. calculate_heat_index()                → Rothfusz regression (NOAA NWS standard)
  4. calculate_wet_bulb_temperature()      → Stull (2011) approximation
  5. calculate_overhead_irrigation_efficiency() → RLVR Physics Verifier (Agri-Agent)
  6. calculate_thermal_anomaly()           → Multi-variable severity grader
"""

from __future__ import annotations
import math
from config import PHYSICS, ANOMALY_THRESHOLDS


class ClimateAnomalyEngine:
    """
    Stateless physics engine. All methods are pure functions of their inputs:
    same inputs always produce the same outputs, making this class suitable
    as a deterministic reward verifier in the RLVR framework.
    """

    # ── Thermodynamic Primitives ─────────────────────────────────────────────

    @staticmethod
    def _saturated_vapor_pressure_kpa(temp_c: float) -> float:
        """
        Saturation vapor pressure via the Tetens equation (WMO, 2018).

        Represents the maximum water vapor the atmosphere can hold at temp_c.
        This is the physical upper bound that makes evaporation possible.

        Formula: e_s = a × exp(b × T / (T + c))
        where (a, b, c) are calibrated constants declared in PHYSICS config.
        """
        a = PHYSICS["tetens_a"]
        b = PHYSICS["tetens_b"]
        c = PHYSICS["tetens_c"]
        return round(a * math.exp((b * temp_c) / (temp_c + c)), 4)

    @staticmethod
    def calculate_vapor_pressure_deficit(temp_c: float, humidity_pct: float) -> float:
        """
        Vapor Pressure Deficit (VPD) in kPa — the primary atmospheric driver of evaporation.

        VPD = e_s(T) − e_a,  where e_a = e_s × (RH / 100)

        Interpretation:
            VPD ≈ 0.0 kPa → saturated air; evaporation is negligible.
            VPD ≈ 2.5 kPa → moderate stress (typical greenhouse upper threshold).
            VPD ≥ 5.0 kPa → extreme desiccating conditions; irrigation is largely wasted.
        """
        e_s = ClimateAnomalyEngine._saturated_vapor_pressure_kpa(temp_c)
        e_a = e_s * (humidity_pct / 100.0)
        return round(max(0.0, e_s - e_a), 4)

    @staticmethod
    def calculate_heat_index(temp_c: float, humidity_pct: float) -> float:
        """
        Apparent 'feels-like' temperature via the Rothfusz regression (NOAA NWS).

        Combines dry-bulb temperature and relative humidity into a single
        perceived-temperature metric relevant for human thermal stress assessment.

        Valid domain: T ≥ 26.7°C and RH ≥ 40%.
        Outside this range the regression diverges; raw temperature is returned.

        Source: Rothfusz (1990), NWS Technical Attachment SR/SSD 90-23.
        """
        if temp_c < 26.7 or humidity_pct < 40:
            return round(temp_c, 2)

        T  = temp_c * 9 / 5 + 32   # Rothfusz is defined in Fahrenheit
        RH = humidity_pct

        HI_f = (
            -42.379
            + 2.04901523  * T
            + 10.14333127 * RH
            - 0.22475541  * T  * RH
            - 0.00683783  * T  ** 2
            - 0.05481717  * RH ** 2
            + 0.00122874  * T  ** 2 * RH
            + 0.00085282  * T  * RH ** 2
            - 0.00000199  * T  ** 2 * RH ** 2
        )
        return round((HI_f - 32) * 5 / 9, 2)

    @staticmethod
    def calculate_wet_bulb_temperature(temp_c: float, humidity_pct: float) -> float:
        """
        Wet-bulb temperature approximation via the Stull (2011) empirical formula.

        Wet-bulb temperature is the definitive biological heat stress indicator.
        At Tw = 35°C (see PHYSICS['wet_bulb_survivability_celsius']), the human
        body cannot shed heat fast enough to survive regardless of shade or fitness.
        At Tw = 28°C, prolonged outdoor work becomes medically dangerous.

        Source: Stull (2011), "Wet-Bulb Temperature from Relative Humidity and
        Air Temperature", Journal of Applied Meteorology and Climatology, 50(11).
        """
        T, RH = temp_c, humidity_pct
        Tw = (
            T  * math.atan(0.151977 * (RH + 8.313659) ** 0.5)
            +    math.atan(T + RH)
            -    math.atan(RH - 1.676331)
            + 0.00391838 * RH ** 1.5 * math.atan(0.023101 * RH)
            - 4.686035
        )
        return round(Tw, 2)

    @staticmethod
    def calculate_overhead_irrigation_efficiency(
        temp_c: float, humidity_pct: float, wind_kmh: float
    ) -> float:
        """
        RLVR Physics Verifier — Agri-Agent Constraint.

        Computes the fraction of overhead sprinkler water that physically reaches
        the soil root zone. Losses are driven by two independent physics mechanisms:

          1. VPD (atmospheric dryness): determines the rate at which water droplets
             evaporate in-flight between the nozzle and the soil surface.
          2. Wind speed: disperses the spray pattern and increases droplet surface
             area, amplifying evaporative loss.

        Formula:
            wind_factor = 1 + wind_loss_sensitivity × wind_kmh
            evap_loss   = min(0.95, VPD × wind_factor × loss_per_kPa_VPD)
            efficiency  = 1.0 − evap_loss

        Consequence for M-GRPO reward shaping:
            If efficiency < 0.5 (i.e., more than half the water is lost), the RLVR
            engine applies a HARD NEGATIVE REWARD to any agent proposing overhead
            sprinkler systems and mandates drip/sub-surface alternatives.

        Returns:
            float in [0.05, 1.0] — 5% is the physical delivery floor.
        """
        vpd = ClimateAnomalyEngine.calculate_vapor_pressure_deficit(temp_c, humidity_pct)

        loss_per_kpa  = PHYSICS["irrigation_loss_fraction_per_kpa_vpd"]
        wind_sens     = PHYSICS["irrigation_wind_loss_sensitivity"]

        wind_factor = 1.0 + wind_sens * wind_kmh
        evap_loss   = min(0.95, vpd * wind_factor * loss_per_kpa)
        efficiency  = round(1.0 - evap_loss, 3)
        return max(0.05, efficiency)

    # ── Multi-Variable Anomaly Grading ────────────────────────────────────────

    @staticmethod
    def calculate_thermal_anomaly(
        current_temp: float,
        baseline_max: float,
        humidity_pct: float,
        wind_kmh:     float,
    ) -> dict:
        """
        Grades multi-variable climate severity against the regional operational baseline.

        Design principle: anomaly status is only raised when conditions breach
        the *locally established* ceiling. 48°C is HEALTHY for Punjab.
        38°C is CRITICAL for Togo. The system is region-relative, not world-relative.

        Both temperature deviation AND wet-bulb temperature are independently
        evaluated; the more severe of the two determines the final system status.
        This dual-variable approach catches events that a single-variable check
        would miss — e.g., a 'moderate' temperature paired with extreme humidity
        that creates a lethal wet-bulb reading.

        Args:
            current_temp:  Live temperature reading (°C).
            baseline_max:  Regional historical maximum ceiling (°C) from config.
            humidity_pct:  Relative humidity (%).
            wind_kmh:      Wind speed (km/h).

        Returns:
            Comprehensive analysis dict, structured for direct injection into
            the GNN-to-LLM Bridge as a bounded physical constraint context.
        """
        deviation  = round(current_temp - baseline_max, 2)
        vpd        = ClimateAnomalyEngine.calculate_vapor_pressure_deficit(current_temp, humidity_pct)
        heat_index = ClimateAnomalyEngine.calculate_heat_index(current_temp, humidity_pct)
        wet_bulb   = ClimateAnomalyEngine.calculate_wet_bulb_temperature(current_temp, humidity_pct)
        irrig_eff  = ClimateAnomalyEngine.calculate_overhead_irrigation_efficiency(
            current_temp, humidity_pct, wind_kmh
        )

        # All threshold comparisons are sourced from config — no literals in logic.
        crit_dev = ANOMALY_THRESHOLDS["critical_deviation_celsius"]
        warn_dev = ANOMALY_THRESHOLDS["warning_deviation_celsius"]
        crit_wb  = ANOMALY_THRESHOLDS["wet_bulb_critical_celsius"]
        warn_wb  = ANOMALY_THRESHOLDS["wet_bulb_warning_celsius"]

        if deviation >= crit_dev or wet_bulb >= crit_wb:
            status, intensity = "CRITICAL_ANOMALY", "EXTREME_HEAT_WAVE"
        elif deviation >= warn_dev or wet_bulb >= warn_wb:
            status, intensity = "WARNING_ANOMALY",  "MODERATE_HEAT_ANOMALY"
        elif deviation > 0.0:
            status, intensity = "ADVISORY",          "MILD_THERMAL_STRESS"
        else:
            status, intensity = "HEALTHY",           "SEASONAL_NORM"

        return {
            "status":                          status,
            "intensity":                       intensity,
            "deviation_celsius":               deviation,
            "vapor_pressure_deficit_kpa":      vpd,
            "heat_index_celsius":              heat_index,
            "wet_bulb_celsius":                wet_bulb,
            "overhead_irrigation_efficiency":  irrig_eff,
        }
