# WIAAS Asia — Architecture & Data Pipeline Specification

This document details the backend architecture, deterministic physics simulation engines, and dual-agent decision orchestration for **WIAAS Asia** (Weather Intelligence as a Service — Asia Edition).

---

## 1. System Architecture Overview

WIAAS Asia decouples heavy generative AI reasoning from real-time physical simulation. Deterministic atmospheric physics are computed in sub-millisecond Python routines on the FastAPI backend, producing a compact state vector that feeds into two specialized n8n decision graphs.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION LAYER                            │
│  • Open-Meteo High-Resolution Numerical Forecast & Nowcast             │
│  • GDACS Global Disaster Alert and Coordination System Feed            │
│  • NASA FIRMS Thermal Satellite Active Hotspot Telemetry              │
│  • GDELT Regional OSINT Geopolitical & Emergency Risk Feed            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              DETERMINISTIC PHYSICS & RESOURCE LEDGER                   │
│  • Tetens Equation: Saturation Vapor Pressure e_s(T) & VPD (kPa)       │
│  • NOAA Heat Index & Stull Wet-Bulb Critical Human Limit (35°C)        │
│  • Synthetic Resource Ledger: Evaporation, Thermal Transformer Load    │
│  • Synchronous Grid Predictor: Substation Derating & Blackout Risk     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (< 350-byte normalized state vector)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DUAL-AGENT COGNITIVE ORCHESTRATION                   │
│                                                                        │
│   [ WIaaS Agent Workflow ]              [ CrisisLens Agent Workflow ]  │
│   • Climatological Baselines            • Multi-Hazard Risk Fusion     │
│   • Agricultural VPD & Transpiration    • 4-Source Evidence Grading    │
│   • Power Grid Cooling Surges           • Emergency Action Directives  │
│   • Logistics Thermal Stress            • Evacuation Route Corridors   │
│   • Comprehensive Synthesis Reports     • Public Safety Directives     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION & CLIENT ACTUATION                      │
│  • 60 FPS MapLibre GL Thermographic Asia Map (29 Territories, 67 Zones)│
│  • 1-Second Telemetry Oscilloscope (Catmull-Rom Splines & Rolling HUD) │
│  • Bilingual Neural Voice Copilot (edge-tts: en-US-Jenny & ur-PK-Uzma) │
│  • Responsive Sheet UI & Zero-Latency Fallback Resiliency              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── endpoints.py     # REST endpoints (/analytics, /grid, /chat, /tts)
│   ├── core/
│   │   ├── config.py            # Physics constants, thresholds, baseline configs
│   │   └── regions_registry.json# 67 Asian economic & municipal zones catalogue
│   ├── engines/
│   │   ├── analytics.py         # ClimateAnomalyEngine — Tetens, VPD, WBGT solvers
│   │   └── ledger.py            # SyntheticResourceLedger — water, grid, fuel burn
│   ├── schemas/
│   │   └── analytics.py         # Pydantic request/response models
│   ├── services/
│   │   ├── bridge.py            # GNNToLLMBridge — state vector serialization
│   │   ├── grid_predictor.py    # Zero-latency grid load & blackout estimation
│   │   └── pipeline.py          # WeatherIntelligencePipeline — 6-stage orchestrator
│   └── main.py                  # FastAPI application entry, CORS, SPA static mount
├── live_weather_stream.json     # Atomically updated live telemetry snapshot
└── requirements.txt             # Production Python dependencies
```

---

## 3. The 6-Stage Weather Intelligence Pipeline

When telemetry is requested for an Asian region (e.g. `pakistan_multan`, `japan_tokyo`), `WeatherIntelligencePipeline.execute(region_key)` executes:

| Stage | Module | Operational Responsibility |
|:---|:---|:---|
| **1** | `pipeline.fetch_api_telemetry` | Ingests live Open-Meteo observations (temp, RH, wind, rain, radiation). |
| **2** | `ClimateAnomalyEngine` | Solves Tetens VPD, NOAA Heat Index, Stull wet-bulb, and sprinkler efficiency. |
| **3** | `SyntheticResourceLedger` | Calculates non-linear resource degradation for water, power, and fuel. |
| **4** | `GNNToLLMBridge` | Serializes telemetry into a compressed text/array state vector (`llm_state_vector`). |
| **5** | `pipeline.execute` | Assembles full payload with flattened n8n compatibility attributes. |
| **6** | `pipeline.execute` | Atomically writes cache to `live_weather_stream.json` for zero-latency lookups. |

---

## 4. Key Mathematical Formulas

### 1. Tetens Saturation Vapor Pressure
$$e_s(T) = 0.61078 \times \exp\left(\frac{17.27 \times T}{T + 237.3}\right) \quad (\text{kPa})$$

### 2. Vapor Pressure Deficit (VPD)
$$\text{VPD} = e_s(T) \times \left(1 - \frac{RH}{100}\right)$$

### 3. Critical Wet-Bulb Temperature Threshold
When ambient wet-bulb temperature $T_{wb} \ge 35.0^\circ\text{C}$, the physical limit of human evaporative cooling is breached, triggering immediate autonomous heat-shock emergency directives.

### 4. Grid Demand Surge Rate
$$\Delta P_{\text{grid}} = (\max(0, T_{\text{ambient}} - T_{\text{baseline}})) \times 2.8\% \text{ per }^\circ\text{C}$$

---

## 5. API Endpoints Reference

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/health` | Application health and timestamp probe |
| `GET` | `/analytics/` | Lists all 67 configured Asian territories and metadata |
| `GET` | `/analytics/{region_key}` | Executes pipeline and returns live climate analysis & ledger |
| `POST` | `/analytics/{region_key}/chat` | Orchestrates query through the primary WIaaS n8n agent |
| `POST` | `/api/v1/crisislens/chat` | Orchestrates multi-hazard query through CrisisLens agent |
| `GET` | `/api/v1/grid/predictions` | Real-time synchronous grid capacity, surge MW, and blackout risk |
| `POST` | `/api/v1/tts` | High-definition neural Edge TTS synthesis (English & Urdu) |
| `GET` | `/api/v1/client-location` | Geo-IP user location detection for localhost timeline sync |
| `GET` | `/` | Serves pre-bundled, high-performance Vite SPA with no-cache headers |

