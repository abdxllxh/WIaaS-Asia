# Backend — Architecture et flux de données

Ce document décrit le backend FastAPI du service Weather Intelligence as a Service (WIaaS).

## Structure des modules

```
backend/app/
├── main.py                 # Point d'entrée FastAPI, CORS, montage du frontend statique
├── core/config.py          # Constantes physiques, seuils, régions (REGIONS)
├── engines/
│   ├── analytics.py        # ClimateAnomalyEngine — thermodynamique et grading d'anomalie
│   └── ledger.py           # SyntheticResourceLedger — dégradation des ressources
├── services/
│   ├── pipeline.py         # WeatherIntelligencePipeline — orchestration 6 étapes
│   ├── bridge.py           # GNNToLLMBridge — vecteur d'état textuel pour les agents LLM
│   └── cargo_optimizer.py  # AviationCargoEngine — optimisation de chargement aérien
├── schemas/
│   ├── analytics.py        # Modèles API analytics / chat
│   └── cargo.py            # Modèles API optimisation cargo
└── api/v1/endpoints.py     # Routes REST /analytics
```

## Pipeline en 6 étapes

`WeatherIntelligencePipeline.execute(region_key)` enchaîne :

| Étape | Module | Rôle |
|-------|--------|------|
| 1 | `pipeline.fetch_api_telemetry` | Ingestion Open-Meteo (remplaçable par GraphCast GNN) |
| 2 | `ClimateAnomalyEngine` | VPD, heat index, wet-bulb, efficacité irrigation |
| 3 | `SyntheticResourceLedger` | Eau, réseau électrique, carburant dégradés |
| 4 | `GNNToLLMBridge` | Construction du `llm_state_vector` |
| 5 | `pipeline.execute` | Assemblage JSON + couche compatibilité n8n |
| 6 | `pipeline.execute` | Écriture atomique de `live_weather_stream.json` |

En cas d'échec de l'API météo, le pipeline retombe sur les valeurs baseline de la région.

## Endpoints API

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/analytics/` | Liste des régions configurées |
| `GET` | `/analytics/{region_key}` | Analyse climatique et ledger pour une région |
| `POST` | `/analytics/{region_key}/chat` | Exécute le pipeline complet et appelle le webhook n8n |

## Format du payload JSON

Le fichier `live_weather_stream.json` (et le corps envoyé à n8n) contient :

- `_meta` — version, horodatage UTC, clé région, coordonnées, cycle diurne
- `monitored_region` — nom lisible de la zone
- `system_status` — `HEALTHY`, `ADVISORY`, `WARNING_ANOMALY` ou `CRITICAL_ANOMALY`
- `climate_matrix` — intensité, déviation, VPD, heat index, wet-bulb, télémétrie
- `rlvr_constraints` — efficacité et viabilité de l'irrigation overhead
- `synthetic_resource_ledger` — plafonds eau / réseau / carburant
- `llm_state_vector` — contexte textuel injecté dans vLLM
- Champs aplatis (`region_name`, `ledger`, `telemetry`, …) pour les webhooks n8n

## Configuration des régions

Les régions de base sont définies dans `core/config.py`. Des régions supplémentaires peuvent être injectées depuis `core/regions_registry.json` au démarrage.

## Lancement

```bash
pip install -r requirements.txt
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Le frontend compilé (`backend/static/`) est servi à la racine `/` lorsque le build Vite a été exécuté.

## Optimisation cargo (module interne)

`AviationCargoEngine` dans `services/cargo_optimizer.py` implémente la sélection de manifeste sous contraintes de poids, volume, matières dangereuses et centre de gravité. Les schémas API associés sont dans `schemas/cargo.py` et peuvent être branchés sur une route dédiée.
