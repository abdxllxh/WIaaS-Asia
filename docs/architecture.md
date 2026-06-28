# Backend Architecture & Data Flow

This repository houses the data ingestion pipeline for the Weather Intelligence Service.

## Data Pipeline Stages
1. **Ingestion**: Fetching real-time parameters (Temperature, Precipitation, Soil Moisture).
2. **Processing & Triage**: Calculating anomalies and matching them against biological crop thresholds.
3. **Routing**: Exposing the refined payload via a local API for the Frontend and LLM agents.

## Expected JSON Payload Format
The pipeline updates `live_weather_stream.json` every cycle with the following structure:
- `current`: Real-time weather station metrics.
- `forecast_7d`: AI-predicted shifts (e.g., El Niño -50% rainfall drop).
- `system`: Status flags (`HEALTHY` or `CRITICAL_ANOMALY`) based on agricultural limits.