"""
GNN-to-LLM Translation Bridge — Bounded Text-State Vector Constructor.

This module implements the architectural layer that prevents LLM agents from
hallucinating physical realities. Instead of prompting agents with open-ended
weather descriptions, the bridge translates multi-dimensional climate tensors
(as produced by the GraphCast GNN) into deterministic, constraint-bearing
text-state vectors.

The agents do not "guess" the weather — they are fed the mathematics.

Architecture note:
    This vector is injected as the system-level context into the vLLM inference
    layer *before* any LoRA agent persona (Agri, Grid, Logistics, Regulator) is
    dynamically mounted. All four agents share the same physical ground truth;
    only their optimization objectives differ across LoRA weight sets.
"""

from __future__ import annotations


class GNNToLLMBridge:
    """
    Translates structured pipeline analytics into the Bounded Text-State Vector
    format consumed by the M-GRPO multi-agent engine.

    The output uses clearly delimited semantic blocks, making it machine-parseable
    by the RLVR reward verifier while remaining human-readable for audit.
    """

    @staticmethod
    def build_state_vector(
        region_name: str,
        telemetry:   dict,
        analysis:    dict,
        ledger:      dict,
    ) -> str:
        """
        Constructs the complete Bounded Text-State Vector from pipeline stage outputs.

        The vector is structured in four semantic blocks:
            [THERMAL MATRIX]     — Raw sensor data plus derived thermodynamic metrics.
            [RLVR CONSTRAINTS]   — Hard physics limits that bound Agri-Agent proposals.
            [RESOURCE LEDGER]    — Finite asset ceilings for all agent bidding rounds.
            [GCC MANDATE]        — Global Cooperation Constraint declaration for M-GRPO.

        Args:
            region_name:  Human-readable zone identifier.
            telemetry:    Raw sensor readings (temperature, humidity, wind).
            analysis:     ClimateAnomalyEngine output dict.
            ledger:       SyntheticResourceLedger output dict.

        Returns:
            Formatted multi-line string for vLLM system-prompt injection.
        """
        irrig_eff_pct  = round(analysis["overhead_irrigation_efficiency"] * 100, 1)
        irrig_loss_pct = round((1.0 - analysis["overhead_irrigation_efficiency"]) * 100, 1)

        # Irrigation directive block varies based on whether the penalty threshold is breached.
        if analysis["overhead_irrigation_efficiency"] < 0.5:
            irrigation_block = (
                f"  Overhead Sprinkler Efficiency : {irrig_eff_pct}%\n"
                f"  ⚠  HARD PENALTY ACTIVE\n"
                f"     {irrig_loss_pct}% of deployed water is lost before reaching soil.\n"
                f"     The RLVR engine will apply a NEGATIVE REWARD to any agent\n"
                f"     proposing standard overhead systems.\n"
                f"     MANDATE: Drip or sub-surface irrigation ONLY."
            )
        else:
            irrigation_block = (
                f"  Overhead Sprinkler Efficiency : {irrig_eff_pct}%\n"
                f"  Standard overhead irrigation is viable under current conditions."
            )

        vector = f"""
╔══════════════════════════════════════════════════════════════════╗
║       PHYSICS-CONSTRAINED STATE VECTOR  //  WIaaS RUNTIME       ║
╚══════════════════════════════════════════════════════════════════╝
ZONE     : {region_name}
STATUS   : {analysis['status']}  [{analysis['intensity']}]

┌─ [THERMAL MATRIX] ──────────────────────────────────────────────┐
  Temperature            : {telemetry['temperature_celsius']}°C  (raw sensor)
  Baseline Excess        : +{analysis['deviation_celsius']}°C  above regional ceiling
  Heat Index             : {analysis['heat_index_celsius']}°C  (perceived thermal load)
  Wet-Bulb Temperature   : {analysis['wet_bulb_celsius']}°C  (biological stress indicator)
  Vapor Pressure Deficit : {analysis['vapor_pressure_deficit_kpa']} kPa  (evaporation driver)
  Relative Humidity      : {telemetry['humidity_percentage']}%
  Wind Speed             : {telemetry['wind']['speed_kmh']} km/h @ {telemetry['wind']['direction_degrees']}°
└─────────────────────────────────────────────────────────────────┘

┌─ [RLVR VERIFIER CONSTRAINTS] ───────────────────────────────────┐
  These are physical laws. Non-compliance earns a hard negative
  reward regardless of strategic reasoning quality.

{irrigation_block}
└─────────────────────────────────────────────────────────────────┘

┌─ [SYNTHETIC RESOURCE LEDGER — AGENT BID CEILING] ───────────────┐
  WATER
    Gross Reservoir      : {ledger['water_gross_reservoir_m3']:>14,} m³
    Surface Evap Loss    : {ledger['water_surface_evap_loss_pct']:>8.2f}%    (VPD-driven)
    Deliverable Volume   : {ledger['water_deliverable_m3']:>14,} m³  ← bid ceiling

  GRID
    Available Capacity   : {ledger['grid_available_capacity_mw']:>8} MW
    Demand Surge         : +{ledger['grid_demand_surge_pct']:>7.2f}%    (heat-driven AC load)

  FUEL
    Available Reserve    : {ledger['fuel_available_liters']:>14,} L
    Thermal Overhead     : +{ledger['fuel_thermal_overhead_pct']:>7.2f}%    (logistics cooling)
└─────────────────────────────────────────────────────────────────┘

┌─ [GLOBAL COOPERATION CONSTRAINT (GCC)] ─────────────────────────┐
  Agent bids MUST NOT collectively exceed any ledger ceiling.
  A resource collapse in ANY single sector triggers a systemic
  penalty: ALL agent rewards reset to ZERO.
  Sacrifice a local optimum to preserve the global survival baseline.
└─────────────────────────────────────────────────────────────────┘
""".strip()

        return vector
