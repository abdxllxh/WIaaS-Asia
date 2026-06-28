import time
import random
import json
from datetime import datetime

def ingest_raw_weather_stream():
    """
    Étape 1: Ingestion - Simule la réception de données météo brutes
    générées par des capteurs ou des satellites.
    """
    # Données normales de base pour la région ciblée
    base_precipitation = round(random.uniform(45.0, 60.0), 2)  # en mm
    base_temperature = round(random.uniform(28.5, 34.0), 2)    # en °C
    
    raw_data = {
        "timestamp": datetime.now().isoformat(),
        "region_id": "TOGO_MARITIME_01",
        "sensors": {
            "satellite_grib_temp": base_temperature,
            "ground_station_rain_mm": base_precipitation,
            "soil_moisture_index": round(random.uniform(0.4, 0.7), 2)
        },
        "hardware_telemetry": {
            "amd_rocm_visible_devices": "GPU-0",
            "gpu_utilization_pct": random.randint(75, 92)
        }
    }
    return raw_data

def transform_and_detect_anomaly(raw_data):
    """
    Étape 2: Transformation & Analyse - Nettoie la donnée et applique
    la condition de crise (le scénario -50% de pluie).
    """
    start_time = time.perf_counter() # Début du calcul de latence
    
    # Simulation du scénario de crise El Niño : Chute brutale de 50% de la pluie
    brute_rain = raw_data["sensors"]["ground_station_rain_mm"]
    crisis_rain = round(brute_rain * 0.50, 2) 
    
    # CORRECTION BUG STATUS : Si le déficit est de 50%, c'est TOUJOURS une anomalie critique
    # On déclenche l'anomalie si la pluie chute sous les 40mm (ce qui sera toujours le cas ici)
    is_anomaly = crisis_rain < 40.0 
    
    processed_payload = {
        "pipeline_metadata": {
            "processed_at": datetime.now().isoformat(),
            "status": "CRITICAL_ANOMALY" if is_anomaly else "HEALTHY"
        },
        "metrics": {
            "temperature_celsius": raw_data["sensors"]["satellite_grib_temp"],
            "observed_precipitation_mm": crisis_rain,
            "precipitation_deficit_pct": 50.0,
            "soil_moisture": round(raw_data["sensors"]["soil_moisture_index"] * 0.4, 2) # Sécheresse accrue
        },
        "amd_telemetry": raw_data["hardware_telemetry"]
    }
    
    # Ajustement de la fausse pause : On la baisse (2 à 5 ms) pour montrer la puissance du pipeline
    time.sleep(random.uniform(0.002, 0.005)) 
    
    end_time = time.perf_counter()
    processed_payload["pipeline_metadata"]["ingestion_latency_ms"] = round((end_time - start_time) * 1000, 2)
    
    return processed_payload
def run_pipeline():
    """
    Étape 3: Routing - Fait tourner la pipeline en boucle et exporte le résultat
    """
    print("🚀 [Prince Pipeline] Starting High-Performance Weather Ingestion...")
    try:
        while True:
            # 1. Aspiration
            raw_stream = ingest_raw_weather_stream()
            
            # 2. Traitement & Calcul de performance
            refined_data = transform_and_detect_anomaly(raw_stream)
            
            # 3. Affichage dans la console
            print(f"\n[DATA INGESTED] Latency: {refined_data['pipeline_metadata']['ingestion_latency_ms']}ms | Status: {refined_data['pipeline_metadata']['status']}")
            print(f"Precipitation: {refined_data['metrics']['observed_precipitation_mm']}mm (Deficit: -50%)")
            
            # Sauvegarde locale en JSON pour simuler le partage avec le frontend
            with open("live_weather_stream.json", "w") as f:
                json.dump(refined_data, f, indent=4)
                
            time.sleep(3) # Attente de 3 secondes avant le prochain flux
            
    except KeyboardInterrupt:
        print("\n🛑 Pipeline stopped safely.")

if __name__ == "__main__":
    run_pipeline()