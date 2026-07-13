const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 8000;
const staticDir = path.join(__dirname, 'backend', 'static');

// ─── Thermodynamic & Physics Constants ─────────────────────────────────────
const PHYSICS = {
    tetens_a: 0.6108,
    tetens_b: 17.27,
    tetens_c: 237.3,
    irrigation_loss_fraction_per_kpa_vpd: 0.08,
    irrigation_wind_loss_sensitivity: 0.02,
    wet_bulb_survivability_celsius: 35.0
};

const ANOMALY_THRESHOLDS = {
    critical_deviation_celsius: 6.0,
    warning_deviation_celsius: 3.0,
    wet_bulb_critical_celsius: 33.0,
    wet_bulb_warning_celsius: 28.0
};

const DEGRADATION = {
    water_surface_evap_fraction_per_kpa_vpd: 0.018,
    grid_demand_rate_per_degree_celsius: 0.028,
    fuel_burn_rate_per_degree_celsius: 0.012
};

// ─── Default Region Definitions ─────────────────────────────────────────────
const REGIONS = {
    "togo_maritime": {
        "name":                  "Maritime Region, Togo (Coastal West Africa)",
        "latitude":              6.1375,
        "longitude":             1.2223,
        "expected_max_baseline": 34.0,
        "timezone":              "GMT+0 (Togo Time)",
        "resource_baselines": {
            "water_reservoir_m3":  1250000,
            "grid_capacity_mw":    320,
            "fuel_reserve_liters": 95000,
        },
    },
    "pakistan_punjab": {
        "name":                  "Punjab Region, Pakistan (Arid/Semi-Arid Zone)",
        "latitude":              31.1704,
        "longitude":             72.7097,
        "expected_max_baseline": 47.0,
        "timezone":              "GMT+5 (Pakistan Standard Time)",
        "resource_baselines": {
            "water_reservoir_m3":  3800000,
            "grid_capacity_mw":    850,
            "fuel_reserve_liters": 210000,
        },
    },
    "france_paris": {
        "name":                  "Paris Île-de-France, France (Temperate Zone)",
        "latitude":              48.8566,
        "longitude":             2.3522,
        "expected_max_baseline": 35.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2100000,
            "grid_capacity_mw":    600,
            "fuel_reserve_liters": 120000,
        },
    },
    "spain_andalusia": {
        "name":                  "Andalusia, Spain (Mediterranean Hot Arid Zone)",
        "latitude":              37.3891,
        "longitude":             -5.9845,
        "expected_max_baseline": 42.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  950000,
            "grid_capacity_mw":    450,
            "fuel_reserve_liters": 80000,
        },
    },
    "germany_bavaria": {
        "name":                  "Bavaria, Germany (Continental Zone)",
        "latitude":              48.1351,
        "longitude":             11.5820,
        "expected_max_baseline": 33.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2800000,
            "grid_capacity_mw":    750,
            "fuel_reserve_liters": 150000,
        },
    },
    "uk_london": {
        "name":                  "Greater London, United Kingdom (Maritime Temperate)",
        "latitude":              51.5074,
        "longitude":             -0.1278,
        "expected_max_baseline": 31.0,
        "timezone":              "GMT+1 (British Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  1500000,
            "grid_capacity_mw":    500,
            "fuel_reserve_liters": 90000,
        },
    },
    "italy_sicily": {
        "name":                  "Sicily, Italy (Subtropical Mediterranean Zone)",
        "latitude":              37.5990,
        "longitude":             14.0154,
        "expected_max_baseline": 44.0,
        "timezone":              "GMT+2 (Central European Summer Time)",
        "resource_baselines": {
            "water_reservoir_m3":  800000,
            "grid_capacity_mw":    400,
            "fuel_reserve_liters": 75000,
        },
    },
    "usa_california_central_valley": {
        "name":                  "Central Valley, California, USA (Semi-Arid Agri Hub)",
        "latitude":              36.7783,
        "longitude":             -119.4179,
        "expected_max_baseline": 41.0,
        "timezone":              "GMT-7 (Pacific Daylight Time)",
        "resource_baselines": {
            "water_reservoir_m3":  4500000,
            "grid_capacity_mw":    900,
            "fuel_reserve_liters": 250000,
        },
    },
    "usa_texas_houston": {
        "name":                  "Houston, Texas, USA (Humid Subtropical Grid Edge)",
        "latitude":              29.7604,
        "longitude":             -95.3698,
        "expected_max_baseline": 38.0,
        "timezone":              "GMT-5 (Central Daylight Time)",
        "resource_baselines": {
            "water_reservoir_m3":  3200000,
            "grid_capacity_mw":    1200,
            "fuel_reserve_liters": 300000,
        },
    },
    "brazil_cerrado": {
        "name":                  "Cerrado Savannah, Brazil (Tropical Agro Ecosystem)",
        "latitude":              -14.2350,
        "longitude":             -51.9253,
        "expected_max_baseline": 36.0,
        "timezone":              "GMT-3 (Brasilia Time)",
        "resource_baselines": {
            "water_reservoir_m3":  5000000,
            "grid_capacity_mw":    800,
            "fuel_reserve_liters": 180000,
        },
    },
    "canada_alberta": {
        "name":                  "Alberta Plains, Canada (Boreal Subarctic)",
        "latitude":              53.9333,
        "longitude":             -116.5765,
        "expected_max_baseline": 30.0,
        "timezone":              "GMT-6 (Mountain Daylight Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2000000,
            "grid_capacity_mw":    550,
            "fuel_reserve_liters": 140000,
        },
    },
    "argentina_pampas": {
        "name":                  "The Pampas, Argentina (Humid Pampas Plain)",
        "latitude":              -34.6037,
        "longitude":             -58.3816,
        "expected_max_baseline": 37.0,
        "timezone":              "GMT-3 (Argentina Time)",
        "resource_baselines": {
            "water_reservoir_m3":  2200000,
            "grid_capacity_mw":    480,
            "fuel_reserve_liters": 110000,
        },
    }
};

// Inject extended registry if available
const registryPath = path.join(__dirname, 'backend', 'app', 'core', 'regions_registry.json');
if (fs.existsSync(registryPath)) {
    try {
        const extendedData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        Object.assign(REGIONS, extendedData);
        console.log(`[WIaaS Server] Injected ${Object.keys(extendedData).length} regions from registry.`);
    } catch (e) {
        console.error(`[WIaaS Server] Failed to parse regions_registry.json:`, e);
    }
}

// Memory cache for payloads
const payloadCache = {};

function cachePayload(regionKey, payload) {
    payloadCache[regionKey] = {
        time: Date.now(),
        payload: payload
    };
}

function getCachedPayload(regionKey) {
    const cached = payloadCache[regionKey];
    if (cached) return cached.payload;
    return null;
}

// ─── Thermodynamic Calculations (Javascript Implementation) ─────────────────

function getSaturatedVaporPressureKpa(tempC) {
    const a = PHYSICS.tetens_a;
    const b = PHYSICS.tetens_b;
    const c = PHYSICS.tetens_c;
    return parseFloat((a * Math.exp((b * tempC) / (tempC + c))).toFixed(4));
}

function calculateVaporPressureDeficit(tempC, humidityPct) {
    const e_s = getSaturatedVaporPressureKpa(tempC);
    const e_a = e_s * (humidityPct / 100.0);
    return parseFloat(Math.max(0.0, e_s - e_a).toFixed(4));
}

function calculateHeatIndex(tempC, humidityPct) {
    if (tempC < 26.7 || humidityPct < 40) {
        return parseFloat(tempC.toFixed(2));
    }
    const T = tempC * 1.8 + 32.0;
    const RH = humidityPct;
    const T_sq = T * T;
    const RH_sq = RH * RH;

    const HI_f = (
        -42.379
        + 2.04901523 * T
        + 10.14333127 * RH
        - 0.22475541 * T * RH
        - 0.00683783 * T_sq
        - 0.05481717 * RH_sq
        + 0.00122874 * T_sq * RH
        + 0.00085282 * T * RH_sq
        - 0.00000199 * T_sq * RH_sq
    );
    return parseFloat(((HI_f - 32.0) * 0.5555555555555556).toFixed(2));
}

function calculateWetBulbTemperature(tempC, humidityPct) {
    const T = tempC;
    const RH = humidityPct;
    const rh_sqrt_bound = Math.sqrt(RH + 8.313659);
    const rh_pow_1_5 = RH * Math.sqrt(RH);

    const Tw = (
        T * Math.atan(0.151977 * rh_sqrt_bound)
        + Math.atan(T + RH)
        - Math.atan(RH - 1.676331)
        + 0.00391838 * rh_pow_1_5 * Math.atan(0.023101 * RH)
        - 4.686035
    );
    return parseFloat(Tw.toFixed(2));
}

function calculateOverheadIrrigationEfficiency(tempC, humidityPct, windKmh) {
    const vpd = calculateVaporPressureDeficit(tempC, humidityPct);
    const loss_per_kpa = PHYSICS.irrigation_loss_fraction_per_kpa_vpd;
    const wind_sens = PHYSICS.irrigation_wind_loss_sensitivity;

    const wind_factor = 1.0 + wind_sens * windKmh;
    const evap_loss = Math.min(0.95, vpd * wind_factor * loss_per_kpa);
    const efficiency = parseFloat((1.0 - evap_loss).toFixed(3));
    return Math.max(0.05, efficiency);
}

function calculateThermalAnomaly(currentTemp, baselineMax, humidityPct, windKmh) {
    const deviation = parseFloat((currentTemp - baselineMax).toFixed(2));
    const vpd = calculateVaporPressureDeficit(currentTemp, humidityPct);
    const heatIndex = calculateHeatIndex(currentTemp, humidityPct);
    const wetBulb = calculateWetBulbTemperature(currentTemp, humidityPct);
    const irrigEff = calculateOverheadIrrigationEfficiency(currentTemp, humidityPct, windKmh);

    const crit_dev = ANOMALY_THRESHOLDS.critical_deviation_celsius;
    const warn_dev = ANOMALY_THRESHOLDS.warning_deviation_celsius;
    const crit_wb = ANOMALY_THRESHOLDS.wet_bulb_critical_celsius;
    const warn_wb = ANOMALY_THRESHOLDS.wet_bulb_warning_celsius;

    let status = "HEALTHY";
    let intensity = "SEASONAL_NORM";

    if (deviation >= crit_dev || wetBulb >= crit_wb) {
        status = "CRITICAL_ANOMALY";
        intensity = "EXTREME_HEAT_WAVE";
    } else if (deviation >= warn_dev || wetBulb >= warn_wb) {
        status = "WARNING_ANOMALY";
        intensity = "MODERATE_HEAT_ANOMALY";
    } else if (deviation > 0.0) {
        status = "ADVISORY";
        intensity = "MILD_THERMAL_STRESS";
    }

    const wb_contrib = Math.max(0.0, (wetBulb - 10.0) / (PHYSICS.wet_bulb_survivability_celsius - 10.0)) * 30.0;
    const dev_contrib = Math.max(0.0, deviation / crit_dev) * 20.0;
    const vpd_contrib = Math.min(15.0, vpd * 5.0);
    const irrig_loss_contrib = (1.0 - irrigEff) * 15.0;

    const score = 45.0 + wb_contrib + dev_contrib + vpd_contrib + irrig_loss_contrib;
    const missionCriticalityScore = Math.min(100, Math.max(10, Math.floor(score)));

    let riskLevel = "LOW";
    if (missionCriticalityScore >= 90) {
        riskLevel = "CRITICAL";
    } else if (missionCriticalityScore >= 80) {
        riskLevel = "HIGH";
    } else if (missionCriticalityScore >= 50) {
        riskLevel = "MEDIUM";
    }

    return {
        status,
        intensity,
        deviation_celsius: deviation,
        vapor_pressure_deficit_kpa: vpd,
        heat_index_celsius: heatIndex,
        wet_bulb_celsius: wetBulb,
        overhead_irrigation_efficiency: irrigEff,
        risk_level: riskLevel,
        mission_criticality_score: missionCriticalityScore
    };
}

function computeResourceLedger(baselines, currentTemp, vpdKpa, irrigationEfficiency) {
    const thermalStress = Math.max(0.0, currentTemp - 25.0);

    const surfaceEvapFrac = Math.min(
        0.30,
        vpdKpa * DEGRADATION.water_surface_evap_fraction_per_kpa_vpd
    );
    const grossReservoir = Math.round(
        baselines.water_reservoir_m3 * (1.0 - surfaceEvapFrac)
    );
    const deliverableWater = Math.round(grossReservoir * irrigationEfficiency);

    const gridDemandSurgeFrac = Math.min(
        0.60,
        thermalStress * DEGRADATION.grid_demand_rate_per_degree_celsius
    );
    const availableGridMw = parseFloat(
        (baselines.grid_capacity_mw * (1.0 - gridDemandSurgeFrac)).toFixed(1)
    );

    const fuelOverheadFrac = Math.min(
        0.40,
        thermalStress * DEGRADATION.fuel_burn_rate_per_degree_celsius
    );
    const availableFuel = Math.round(
        baselines.fuel_reserve_liters * (1.0 - fuelOverheadFrac)
    );

    const basePeakHour = 19.0;
    const shift = Math.min(3.0, Math.max(0.0, thermalStress * 0.25));
    const peakHourVal = basePeakHour - shift;
    const hour = Math.floor(peakHourVal);
    const minute = Math.floor((peakHourVal - hour) * 60);
    const dynamicPeakTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    return {
        water_gross_reservoir_m3: grossReservoir,
        water_deliverable_m3: deliverableWater,
        water_surface_evap_loss_pct: parseFloat((surfaceEvapFrac * 100).toFixed(2)),
        water_irrigation_efficiency_pct: parseFloat((irrigationEfficiency * 100).toFixed(1)),
        grid_available_capacity_mw: availableGridMw,
        grid_demand_surge_pct: parseFloat((gridDemandSurgeFrac * 100).toFixed(2)),
        grid_peak_surge_pct: parseFloat((Math.min(0.60, gridDemandSurgeFrac * 1.5) * 100).toFixed(2)),
        grid_peak_surge_time: dynamicPeakTime,
        fuel_available_liters: availableFuel,
        fuel_thermal_overhead_pct: parseFloat((fuelOverheadFrac * 100).toFixed(2))
    };
}

function compute24hPredictions(baselines, deviationCelsius, vpdKpa) {
    const tempDeviation = Math.max(0.0, deviationCelsius);
    const humidityPenalty = Math.max(1.0, 1.2 * (1.5 / Math.max(0.1, vpdKpa)));
    
    const hourlyPredictions = [];
    let maxBlackoutRisk = 0.0;
    let criticalSurgeHour = "00:00";

    for (let hour = 0; hour < 24; hour++) {
        let timeFactor = 0.9;
        if (hour >= 0 && hour <= 6) {
            timeFactor = 0.4;
        } else if (hour >= 7 && hour <= 11) {
            timeFactor = 0.75;
        } else if (hour >= 12 && hour <= 13) {
            timeFactor = 0.85;
        } else if (hour >= 14 && hour <= 18) {
            timeFactor = 1.35;
        }

        let baseRisk = 0.0;
        if (tempDeviation > 0) {
            baseRisk = Math.pow(tempDeviation, 1.4) * 8.5 * timeFactor * humidityPenalty;
        } else {
            baseRisk = (hour === 19 || hour === 20) ? 15.0 : 0.0;
        }

        const blackoutProbability = parseFloat(Math.min(100.0, Math.max(0.0, baseRisk)).toFixed(1));
        const nominalCapacity = baselines.grid_capacity_mw;
        const currentCapacityMw = parseFloat(Math.max(0.0, nominalCapacity * (1 - (blackoutProbability / 100))).toFixed(1));

        hourlyPredictions.push({
            time: `${String(hour).padStart(2, '0')}:00`,
            blackout_risk_pct: blackoutProbability,
            available_capacity_mw: currentCapacityMw
        });

        if (blackoutProbability > maxBlackoutRisk) {
            maxBlackoutRisk = blackoutProbability;
            criticalSurgeHour = `${String(hour).padStart(2, '0')}:00`;
        }
    }

    const actionRequired = maxBlackoutRisk > 75.0;

    return {
        timeline_24h: hourlyPredictions,
        analytics_summary: {
            max_blackout_risk_pct: maxBlackoutRisk,
            peak_surge_hour: criticalSurgeHour,
            grid_status: maxBlackoutRisk > 80 ? "CRITICAL_OVERLOAD" : maxBlackoutRisk > 50 ? "WARNING" : "STABLE",
            m2m_trigger: {
                action_required: actionRequired,
                recommended_mitigation: actionRequired ? "DISPATCH_CARGO_TO_SAILORS_PORT_BLACKOUT" : "NONE"
            }
        }
    };
}

function buildStateVector(regionName, telemetry, analysis, ledger) {
    const irrigEffPct = parseFloat((analysis.overhead_irrigation_efficiency * 100).toFixed(1));
    const irrigLossPct = parseFloat(((1.0 - analysis.overhead_irrigation_efficiency) * 100).toFixed(1));

    let irrigation_block = "";
    if (analysis.overhead_irrigation_efficiency < 0.5) {
        irrigation_block = 
            `- Overhead Sprinkler Efficiency: ${irrigEffPct}%\n` +
            `  [⚠ HARD PENALTY ACTIVE]\n` +
            `  ${irrigLossPct}% of deployed water is lost before reaching soil.\n` +
            `  The RLVR engine will apply a NEGATIVE REWARD to any agent proposing standard overhead systems.\n` +
            `  MANDATE: Drip or sub-surface irrigation ONLY.`;
    } else {
        irrigation_block = 
            `- Overhead Sprinkler Efficiency: ${irrigEffPct}%\n` +
            `  Standard overhead irrigation is viable under current conditions.`;
    }

    return `
=== WIaaS PHYSICS-CONSTRAINED STATE VECTOR ===
ZONE       : ${regionName}
STATUS     : ${analysis.status} [${analysis.intensity}]
RISK LEVEL : ${analysis.risk_level || 'NOMINAL'}
CRITICALITY: ${analysis.mission_criticality_score || 50}/100

[THERMAL MATRIX]
- Temperature            : ${telemetry.temperature_celsius.toFixed(2)}°C
- Baseline Excess        : ${analysis.deviation_celsius.toFixed(2)}°C
- Heat Index             : ${analysis.heat_index_celsius.toFixed(2)}°C
- Wet-Bulb Temperature   : ${analysis.wet_bulb_celsius.toFixed(2)}°C
- Vapor Pressure Deficit : ${analysis.vapor_pressure_deficit_kpa.toFixed(2)} kPa
- Relative Humidity      : ${telemetry.humidity_percentage.toFixed(1)}%
- Wind Speed             : ${telemetry.wind.speed_kmh.toFixed(1)} km/h @ ${telemetry.wind.direction_degrees}°

[RLVR VERIFIER CONSTRAINTS]
${irrigation_block}

[SYNTHETIC RESOURCE LEDGER — AGENT BID CEILINGS]
* WATER
  - Gross Reservoir      : ${ledger.water_gross_reservoir_m3.toLocaleString()} m³
  - Surface Evap Loss    : ${ledger.water_surface_evap_loss_pct.toFixed(2)}%
  - Deliverable Volume   : ${ledger.water_deliverable_m3.toLocaleString()} m³ (bid ceiling)
* GRID
  - Available Capacity   : ${ledger.grid_available_capacity_mw} MW
  - Demand Surge         : +${ledger.grid_demand_surge_pct.toFixed(2)}%
* FUEL
  - Available Reserve    : ${ledger.fuel_available_liters.toLocaleString()} L
  - Thermal Overhead     : +${ledger.fuel_thermal_overhead_pct.toFixed(2)}%

[GLOBAL COOPERATION CONSTRAINT (GCC)]
Agent bids must not collectively exceed ledger ceilings. A resource collapse in any single sector triggers a systemic penalty: all agent rewards reset to zero.
`.trim();
}

function extractGridPredictions(regionKey, payload) {
    const ledger = payload.synthetic_resource_ledger || {};
    const cap = ledger.grid_available_capacity_mw;
    const surge = ledger.grid_demand_surge_pct;
    const thermal = ledger.fuel_thermal_overhead_pct;
    const peak_surge_pct = ledger.grid_peak_surge_pct || surge;
    const peak_surge_time = ledger.grid_peak_surge_time || '19:00';

    const peak_blackout_risk_pct = peak_surge_pct !== undefined ? parseFloat(Math.min(100.0, (peak_surge_pct / 60.0) * 100.0).toFixed(2)) : 0.0;
    
    const risk_level = (payload.risk_level || '').toUpperCase();
    const criticality = payload.mission_criticality_score || 0;
    let grid_status = 'STABLE';
    if (risk_level === 'HIGH' || risk_level === 'CRITICAL' || criticality >= 80) {
        grid_status = 'CRITICAL';
    } else if (risk_level === 'MEDIUM' || criticality >= 50) {
        grid_status = 'WARNING';
    }

    const zone = payload.region_name || regionKey;
    const sys_status = payload.system_status || 'OPERATIONAL';
    const temp_val = payload.telemetry.temperature_celsius;
    const temp_str = temp_val !== undefined ? `${temp_val.toFixed(1)}°C` : '—°C';
    const deviation = payload.climate_matrix.deviation_from_baseline_celsius;
    const dev_str = deviation > 0 ? `+${deviation.toFixed(1)}°C above baseline` : `${deviation.toFixed(1)}°C from baseline`;

    const cap_str = cap !== undefined ? `${cap.toFixed(0)} MW` : '—';
    const surge_str = surge !== undefined ? `${surge.toFixed(1)}%` : '—';

    const ai_grid_summary = `${zone}: ${sys_status}. Temp ${temp_str} (${dev_str}). Grid capacity ${cap_str}, demand surge ${surge_str}. Risk: ${grid_status} (score ${criticality}/100).`;

    return {
        grid_available_capacity_mw: cap,
        grid_demand_surge_pct: surge,
        thermal_overhead_pct: thermal,
        peak_blackout_risk_pct: peak_blackout_risk_pct,
        peak_blackout_time: peak_surge_time,
        grid_status: grid_status,
        ai_grid_summary: ai_grid_summary
    };
}

function generateDynamicAgriReport(payload) {
    const regionName = payload.region_name;
    const telemetry = payload.telemetry;
    const temp = telemetry.temperature_celsius;
    const humidity = telemetry.humidity_percentage;
    const vpd = payload.climate_matrix.vapor_pressure_deficit_kpa;
    const ledger = payload.synthetic_resource_ledger;
    const gross = ledger.water_gross_reservoir_m3;
    const deliverable = ledger.water_deliverable_m3;
    const evap_loss = ledger.water_surface_evap_loss_pct;
    const efficiency = ledger.water_irrigation_efficiency_pct;
    
    const deviation = payload.climate_matrix.deviation_from_baseline_celsius;
    const wet_bulb = payload.climate_matrix.wet_bulb_celsius;
    const penalty = Math.max(0.0, deviation * 0.05) + Math.max(0.0, (wet_bulb - 25.0) * 0.02);
    const ndvi = Math.max(0.12, 0.85 - penalty);
    const soil_moisture = Math.max(0.1, 0.75 - (vpd * 0.12)) * 50.0;
    const disease_risk = humidity * 0.4;
    
    const moisture_status = soil_moisture < 20 ? "CRITICAL LOW" : (soil_moisture < 35 ? "LOW" : "OPTIMAL");
    const disease_level = disease_risk > 40 ? "HIGH" : (disease_risk > 20 ? "MEDIUM" : "LOW");
    const viability = efficiency >= 50 ? "VIABLE" : "UNVIABLE";
    const penalty_active = evap_loss > 10.0 ? "ACTIVE (CRITICAL LOSS)" : "INACTIVE";
    
    return `
<div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.72rem; line-height: 1.45; color: var(--text-primary);">
    <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">
        [AGRONOMIC INTELLIGENCE MODEL DEPLOYED] - ANALYSIS FOR ${regionName.toUpperCase()}
    </div>
    
    <p><strong>1. Soil Hydration Status:</strong> Root-zone saturation is currently measured at <strong>${soil_moisture.toFixed(2)}%</strong> (${moisture_status}). The localized vapor pressure deficit of <strong>${vpd.toFixed(4)} kPa</strong> indicates high transpiration stress. ${soil_moisture < 35 ? "Urgent: Deploy moisture preservation protocols immediately." : "Maintain standard scheduling; moisture depletion is nominal."}</p>
    
    <p><strong>2. Crop Stress & Canopy (NDVI):</strong> Vegetation index is currently calculated at <strong>${ndvi.toFixed(3)} NDVI</strong>. Under a current ambient temperature of <strong>${temp.toFixed(2)}°C</strong>, this indicates a ${ndvi < 0.8 ? "compromised vegetative canopy showing signs of heat stress and degradation." : "fully productive, stress-free canopy index."}</p>
    
    <p><strong>3. Pathological Vector Forecast:</strong> Calculated disease sprawl risk is <strong>${disease_risk.toFixed(1)}% (${disease_level})</strong> under current humidity conditions (${humidity.toFixed(1)}%). ${disease_risk > 30 ? "Fungal and pest replication risks are elevated. Deploy preventative crop protection." : "Pathogen replication is suppressed under current atmospheric humidity."}</p>

    <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-top: 6px; padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">
        RESOURCE LEDGER & SCHEDULING CONSTRAINTS
    </div>
    
    <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 6px;">
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Gross Reservoir Capacity:</span>
            <span>${gross.toLocaleString()} m³</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Deliverable Water Volume:</span>
            <span>${deliverable.toLocaleString()} m³</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Evaporative Rate:</span>
            <span>${evap_loss.toFixed(4)}%</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Overhead Sprinkler Viability:</span>
            <span style="color: ${viability === 'VIABLE' ? 'var(--green-accent)' : 'var(--red-accent)'}">${viability} (${efficiency.toFixed(2)}% efficiency)</span>
        </li>
        <li style="display: flex; justify-content: space-between;">
            <span style="color: ${penalty_active.includes('ACTIVE') ? 'var(--red-accent)' : 'var(--green-accent)'}">${penalty_active}</span>
        </li>
    </ul>

    <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 6px; padding: 8px; font-size: 0.65rem; color: var(--text-secondary); margin-top: 5px;">
        <strong>Agronomic Agent Guidance:</strong> Irrigation delivery has been calibrated against local wind speed (${telemetry.wind_speed_kmh.toFixed(2)} km/h) to minimize in-flight losses. Bids must remain below the deliverable ceiling of ${deliverable.toLocaleString()} m³.
    </div>
</div>
`.trim();
}

function generateMockChatReply(regionKey, regionName, query, payload) {
    const q = query.toLowerCase();
    const temp = payload.telemetry.temperature_celsius;
    const humidity = payload.telemetry.humidity_percentage;
    const gridAvailable = payload.synthetic_resource_ledger.grid_available_capacity_mw;
    const waterAvailable = payload.synthetic_resource_ledger.water_deliverable_m3;
    const riskLevel = payload.risk_level;

    if (q.includes("water") || q.includes("agri") || q.includes("farm") || q.includes("irrigation") || q.includes("crop")) {
        let reply = `### 🌾 Agronomic Agent Analysis for ${regionName}\n\n`;
        if (payload.synthetic_resource_ledger.water_irrigation_efficiency_pct < 50) {
            reply += `⚠️ **Critical Evaporation Alert:** The overhead irrigation efficiency is extremely low (**${payload.synthetic_resource_ledger.water_irrigation_efficiency_pct}%**) due to high VPD (**${payload.climate_matrix.vapor_pressure_deficit_kpa} kPa**). Overhead sprinklers will suffer a hard penalty.\n\n` +
                     `**Recommendation:** Transition all active grids immediately to sub-surface drip irrigation to conserve the remaining **${waterAvailable.toLocaleString()} m³** of deliverable reservoir water.`;
        } else {
            reply += `✅ **Irrigation Status:** Atmospheric conditions are stable. Standard overhead sprinkler systems are running at **${payload.synthetic_resource_ledger.water_irrigation_efficiency_pct}%** efficiency.\n\n` +
                     `**Recommendation:** Scheduled water release of up to **${Math.round(waterAvailable * 0.15).toLocaleString()} m³** is authorized for overnight root-zone replenishment.`;
        }
        return reply;
    }

    if (q.includes("power") || q.includes("grid") || q.includes("energy") || q.includes("electricity") || q.includes("blackout")) {
        const peakTime = payload.synthetic_resource_ledger.grid_peak_surge_time;
        const peakSurge = payload.synthetic_resource_ledger.grid_peak_surge_pct;
        const status = payload.grid_predictions.analytics_summary.grid_status;
        
        let reply = `### ⚡ Grid Dispatcher Report for ${regionName}\n\n` +
                    `*   **Available Grid Capacity:** ${gridAvailable} MW\n` +
                    `*   **Grid Status:** ${status}\n` +
                    `*   **Peak Surge Forecast:** +${peakSurge}% at ${peakTime}\n\n`;
        
        if (payload.grid_predictions.analytics_summary.max_blackout_risk_pct > 75.0) {
            reply += `🚨 **Blackout Warning:** Peak demand surge is projected to exceed capacity safety thresholds. M2M mitigation triggers are **ACTIVE**.\n\n` +
                     `**Action Plan:** Triggering automated industrial load-shedding. Requesting emergency fuel allocation for auxiliary logistics generators.`;
        } else {
            reply += `💚 **Stability Outlook:** Load parameters are normal. The local grid remains stable with a peak blackout risk of **${payload.grid_predictions.analytics_summary.max_blackout_risk_pct}%**.\n\n` +
                     `**Action Plan:** Monitoring diurnal air-conditioning load. Normal operating parameters maintained.`;
        }
        return reply;
    }

    if (q.includes("logistics") || q.includes("transport") || q.includes("fuel") || q.includes("cargo") || q.includes("supply")) {
        const fuel = payload.synthetic_resource_ledger.fuel_available_liters;
        const overhead = payload.synthetic_resource_ledger.fuel_thermal_overhead_pct;
        
        let reply = `### 🚛 Logistics Agent Routing Directives\n\n` +
                    `*   **Available Reserves:** ${fuel.toLocaleString()} Liters\n` +
                    `*   **Thermal Overhead Penalty:** +${overhead}%\n\n`;
        
        if (overhead > 15.0) {
            reply += `⚠️ **High Temperature Overhead:** Logistics engines are incurring substantial thermal cooling stress (+${overhead}%), which accelerates fuel depletion.\n\n` +
                     `**Routing Directive:** Restrict heavy freight operations to cooler twilight hours (20:00 - 05:00). Prioritize refrigerated cargo lanes for perishable agronomic yield.`;
        } else {
            reply += `✅ **Transit Operations Normal:** Thermal overhead remains manageable. Fuel reserves are adequate for scheduled regional distribution.\n\n` +
                     `**Routing Directive:** Standard daylight delivery routes remain active. Maintain normal dispatch frequency.`;
        }
        return reply;
    }

    return `### 🏛️ Regional Regulator Swarm Synthesis [${regionName}]\n\n` +
           `Atmospheric sensors report temperature of **${temp.toFixed(1)}°C** against a baseline of **${payload.expected_max_baseline}°C** (deviation: **${payload.climate_matrix.deviation_from_baseline_celsius.toFixed(1)}°C**).\n\n` +
           `*   **System Risk State:** \`${riskLevel}\` (Criticality Score: \`${payload.mission_criticality_score}/100\`)\n` +
           `*   **Water Inventory:** ${waterAvailable.toLocaleString()} m³ deliverable\n` +
           `*   **Power Capacity:** ${gridAvailable} MW available\n\n` +
           `The multi-agent optimization loop is active. Agronomic drip-directives, grid load-shedding schedules, and nocturnal logistics routing are being co-validated under the Global Cooperation Constraint (GCC).`;
}

function generateCrisisLensReply(query) {
    const q = query.toLowerCase();
    
    let reply_text = 
        "### ⚠️ CrisisLens Local Fallback Active\n\n" +
        "The remote n8n CrisisLens workflow is currently unreachable (Connection Timeout). " +
        "Deploying local rule-based safety directives:\n\n";
    
    if (q.includes("sylhet")) {
        reply_text += 
            "**Location:** Sylhet Region\n\n" +
            "*   **Farmers:** Implement flash flood drainage procedures. Move harvested crops to elevated storage.\n" +
            "*   **Public:** Avoid low-lying riverbanks near the Surma/Kushiyara rivers. Store clean drinking water.\n" +
            "*   **Grid Teams:** Monitor substations in flood-prone zones; prepare for load-shedding if water levels breach safety limits.\n" +
            "*   **Logistics:** Reroute transport away from national highway N2; expect localized road inundation.";
    } else if (q.includes("punjab")) {
        reply_text += 
            "**Location:** Punjab Region\n\n" +
            "*   **Farmers:** Suspend overhead sprinkler irrigation to avoid high-temperature evaporation loss. Rely on root-zone drip feeds.\n" +
            "*   **Public:** Minimize direct sun exposure between 11 AM and 4 PM. Stay hydrated.\n" +
            "*   **Grid Teams:** Anticipate high demand surge from agricultural tube-well pumps; activate peak-load sharing protocols.\n" +
            "*   **Logistics:** Ensure air-conditioned cargo compartments are active for heat-sensitive goods.";
    } else if (q.includes("paris")) {
        reply_text += 
            "**Location:** Paris Region\n\n" +
            "*   **Farmers:** Adjust vineyard irrigation grids to compensate for unexpected vapor pressure deficit (VPD) surges.\n" +
            "*   **Public:** Monitor local municipal ozone levels and heat advisory feeds.\n" +
            "*   **Grid Teams:** Run thermal overhead capacity assessments on urban underground transmission lines.\n" +
            "*   **Logistics:** Expect cargo scheduling adjustments due to high temperature restrictions on rail lines.";
    } else {
        reply_text = 
            "Greetings! The CrisisLens Agent is running in offline fallback mode. Please specify a region (e.g., **Sylhet**, **Punjab**, or **Paris**) or ask a specific question about climate telemetry, grid load, or emergency protocols, and I will generate local safety directives for you.";
    }
    
    return { reply: reply_text, offline_fallback: true };
}

// Helper to call external n8n webhooks
function callWebhook(urlStr, payload) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(urlStr);
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'WeatherIntelligencePipeline/1.1.0'
            },
            timeout: 90000 // 90 seconds timeout
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`HTTP status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

// Helper to extract reply text from n8n response structures
function extractWebhookReply(data) {
    if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (first && typeof first === 'object') {
            return first.output || first.message || first.text || first.chat_message || first.regional_summary || first.reply || JSON.stringify(first);
        }
        return String(first);
    }
    if (data && typeof data === 'object') {
        return data.output || data.message || data.text || data.chat_message || data.regional_summary || data.reply || JSON.stringify(data);
    }
    return String(data);
}

// ─── Open-Meteo Integration ──────────────────────────────────────────────

function fetchTelemetry(lat, lon) {
    return new Promise((resolve) => {
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
        
        const options = {
            headers: {
                'User-Agent': 'WeatherIntelligencePipeline/1.1.0 (Hackathon Context Engine)',
                'Accept': 'application/json'
            },
            timeout: 5000
        };

        https.get(apiUrl, options, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.current) {
                        resolve(parsed.current);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            resolve(null);
        });
    });
}

function checkAndRegisterDynamicRegion(regionKey, name) {
    if (REGIONS[regionKey]) return;
    const parts = regionKey.split('_');
    if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
            REGIONS[regionKey] = {
                name: name || `Custom City (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
                latitude: lat,
                longitude: lon,
                expected_max_baseline: 35.0,
                timezone: "GMT+0 (UTC)",
                resource_baselines: {
                    water_reservoir_m3:  1500000,
                    grid_capacity_mw:    450,
                    fuel_reserve_liters: 120000,
                }
            };
            console.log(`[WIaaS Server] Registered dynamic region: ${regionKey} -> ${REGIONS[regionKey].name}`);
        }
    }
}

function generatePayload(regionKey, rawTelemetry) {
    const region = REGIONS[regionKey];
    let temp, humidity, windSpeed, windDir;
    
    if (rawTelemetry) {
        temp = rawTelemetry.temperature_2m + (Math.random() - 0.5) * 0.08;
        humidity = Math.max(0.0, Math.min(100.0, rawTelemetry.relative_humidity_2m + (Math.random() - 0.5) * 0.2));
        windSpeed = Math.max(0.0, rawTelemetry.wind_speed_10m + (Math.random() - 0.5) * 0.16);
        windDir = Math.round(rawTelemetry.wind_direction_10m + (Math.random() - 0.5) * 2) % 360;
    } else {
        temp = region.expected_max_baseline;
        humidity = 50.0;
        windSpeed = 10.0;
        windDir = 180;
    }

    const telemetry = {
        temperature_celsius: parseFloat(temp.toFixed(2)),
        humidity_percentage: parseFloat(humidity.toFixed(1)),
        wind: {
            speed_kmh: parseFloat(windSpeed.toFixed(1)),
            direction_degrees: Math.round(windDir)
        }
    };

    const analysis = calculateThermalAnomaly(
        telemetry.temperature_celsius,
        region.expected_max_baseline,
        telemetry.humidity_percentage,
        telemetry.wind.speed_kmh
    );

    const ledger = computeResourceLedger(
        region.resource_baselines,
        telemetry.temperature_celsius,
        analysis.vapor_pressure_deficit_kpa,
        analysis.overhead_irrigation_efficiency
    );

    const stateVector = buildStateVector(region.name, telemetry, analysis, ledger);

    const current_time = new Date();
    const current_hour = current_time.getUTCHours();
    const diurnal_cycle = (current_hour >= 6 && current_hour <= 18) ? "DAY" : "NIGHT";

    const gridPredictions = compute24hPredictions(
        region.resource_baselines,
        analysis.deviation_celsius,
        analysis.vapor_pressure_deficit_kpa
    );

    const payload = {
        _meta: {
            pipeline_version: "1.1.0",
            generated_at_utc: current_time.toISOString(),
            region_key: regionKey,
            timezone: region.timezone || "UTC+0",
            coordinates: {
                latitude: region.latitude,
                longitude: region.longitude
            },
            diurnal_cycle: diurnal_cycle
        },
        monitored_region: region.name,
        region_name: region.name,
        system_status: analysis.status,
        risk_level: analysis.risk_level,
        mission_criticality_score: analysis.mission_criticality_score,
        llm_state_vector: stateVector,
        climate_matrix: {
            intensity_level: analysis.intensity,
            deviation_from_baseline_celsius: analysis.deviation_celsius,
            vapor_pressure_deficit_kpa: analysis.vapor_pressure_deficit_kpa,
            heat_index_celsius: analysis.heat_index_celsius,
            wet_bulb_celsius: analysis.wet_bulb_celsius,
            telemetry: telemetry,
            water_surface_evap_loss_pct: ledger.water_surface_evap_loss_pct,
            water_irrigation_efficiency_pct: ledger.water_irrigation_efficiency_pct
        },
        rlvr_constraints: {
            overhead_irrigation_efficiency: analysis.overhead_irrigation_efficiency,
            overhead_irrigation_viable: analysis.overhead_irrigation_efficiency >= 0.5,
            irrigation_penalty_active: analysis.overhead_irrigation_efficiency < 0.5
        },
        synthetic_resource_ledger: ledger,
        ledger: {
            grid_available_capacity_mw: ledger.grid_available_capacity_mw,
            grid_demand_surge_pct: ledger.grid_demand_surge_pct,
            fuel_available_liters: ledger.fuel_available_liters,
            fuel_thermal_overhead_pct: ledger.fuel_thermal_overhead_pct,
            grid_peak_surge_pct: ledger.grid_peak_surge_pct,
            grid_peak_surge_time: ledger.grid_peak_surge_time,
            water_gross_reservoir_m3: ledger.water_gross_reservoir_m3,
            water_deliverable_m3: ledger.water_deliverable_m3,
            water_surface_evap_loss_pct: ledger.water_surface_evap_loss_pct,
            water_irrigation_efficiency_pct: ledger.water_irrigation_efficiency_pct
        },
        telemetry: {
            temperature_celsius: telemetry.temperature_celsius,
            humidity_percentage: telemetry.humidity_percentage,
            wind_speed_kmh: telemetry.wind.speed_kmh,
            wind_direction_degrees: telemetry.wind.direction_degrees
        },
        expected_max_baseline: region.expected_max_baseline,
        crop_health_ndvi: parseFloat((Math.max(0.12, 0.85 - (Math.max(0.0, analysis.deviation_celsius * 0.05) + Math.max(0.0, (analysis.wet_bulb_celsius - 25.0) * 0.02)))).toFixed(2)),
        soil_moisture_pct: parseFloat((Math.max(0.1, 0.75 - (analysis.vapor_pressure_deficit_kpa * 0.12)) * 50.0).toFixed(1)),
        disease_risk_pct: parseFloat((telemetry.humidity_percentage * 0.4).toFixed(1)),
        water_stress_index: parseFloat((1.0 - ledger.water_irrigation_efficiency_pct / 100.0).toFixed(2)),
        diurnal_cycle: diurnal_cycle,
        timezone: region.timezone,
        latitude: region.latitude,
        longitude: region.longitude,
        llm_state_vector: stateVector,
        grid_predictions: gridPredictions
    };

    cachePayload(regionKey, payload);
    return payload;
}

// Helper to parse JSON body
function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

// MIME types for static files
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// ─── Main HTTP Server ──────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
    // Add CORS headers for developer convenience
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let reqPath = parsedUrl.pathname;
    
    // Serve frontend source files directly for real-time development
    if (reqPath.startsWith('/src/')) {
        const relativePath = reqPath.slice(5);
        const sourcePath = path.join(__dirname, 'frontend', 'src', relativePath);
        fs.readFile(sourcePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            } else {
                const ext = path.extname(sourcePath).toLowerCase();
                const contentType = mimeTypes[ext] || 'application/javascript; charset=utf-8';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(req.method === 'HEAD' ? '' : content);
            }
        });
        return;
    }
    
    console.log(`[${req.method}] ${reqPath}`);

    // Route: GET /analytics
    if (req.method === 'GET' && (reqPath === '/analytics' || reqPath === '/analytics/')) {
        const available_regions = {};
        for (const key in REGIONS) {
            available_regions[key] = REGIONS[key].name;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            status: "success",
            count: Object.keys(available_regions).length,
            regions: available_regions
        }));
        return;
    }

    // Route: POST /analytics/crisislens/chat
    if (req.method === 'POST' && reqPath === '/analytics/crisislens/chat') {
        parseJsonBody(req).then((body) => {
            const message = body.message;
            if (!message) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ detail: "Missing message field" }));
                return;
            }
            
            const webhookUrl = "https://abdxllxh2002.app.n8n.cloud/webhook/wias-crisislens";
            console.log(`[WIaaS Server] Calling live n8n CrisisLens webhook`);
            
            callWebhook(webhookUrl, body)
                .then((webhookResponse) => {
                    const replyText = extractWebhookReply(webhookResponse);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        reply: replyText,
                        raw_data: typeof webhookResponse === 'object' ? webhookResponse : { data: webhookResponse }
                    }));
                })
                .catch((err) => {
                    console.warn(`[WIaaS Server] CrisisLens Webhook failed: ${err.message}. Falling back to mock directives.`);
                    const responseObj = generateCrisisLensReply(message);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(responseObj));
                });
        }).catch((err) => {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ detail: "Invalid JSON: " + err.message }));
        });
        return;
    }

    // Route: POST /analytics/:region_key/chat
    const chatMatch = reqPath.match(/^\/analytics\/([a-zA-Z0-9_\-\.]+)\/chat$/);
    if (req.method === 'POST' && chatMatch) {
        const regionKey = chatMatch[1];
        parseJsonBody(req).then((body) => {
            const query = body.query;
            if (!query) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ detail: "Missing query field" }));
                return;
            }

            checkAndRegisterDynamicRegion(regionKey, null);
            if (!REGIONS[regionKey]) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ detail: "Region not found" }));
                return;
            }

            let payload = getCachedPayload(regionKey);
            if (!payload) {
                payload = generatePayload(regionKey, null);
            }

            const q_lower = query.toLowerCase();
            if (q_lower.includes("agronomic report") || q_lower.includes("agricultural report") || q_lower.includes("agri-report")) {
                const reportText = generateDynamicAgriReport(payload);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    reply: reportText,
                    raw_data: { source: "local_agri_model", output: reportText }
                }));
            } else {
                // Call live n8n simulation webhook with the full context payload
                const webhookPayload = {
                    ...payload,
                    user_query: query,
                    chatInput: query
                };
                
                const webhookUrl = "https://abdxllxh2002.app.n8n.cloud/webhook/wias-crisis-simulation";
                console.log(`[WIaaS Server] Calling live n8n simulation webhook for ${regionKey}`);
                
                callWebhook(webhookUrl, webhookPayload)
                    .then((webhookResponse) => {
                        const replyText = extractWebhookReply(webhookResponse);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            reply: replyText,
                            raw_data: typeof webhookResponse === 'object' ? webhookResponse : { data: webhookResponse }
                        }));
                    })
                    .catch((err) => {
                        console.warn(`[WIaaS Server] Webhook wias-crisis-simulation failed: ${err.message}. Falling back to mock reply.`);
                        const replyText = generateMockChatReply(regionKey, payload.region_name, query, payload);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            reply: replyText,
                            raw_data: { source: "local_mock_agent_swarm", query: query, error: err.message }
                        }));
                    });
            }
        }).catch((err) => {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ detail: "Invalid JSON: " + err.message }));
        });
        return;
    }

    // Route: GET /analytics/:region_key/grid-predictions
    const gridPredMatch = reqPath.match(/^\/analytics\/([a-zA-Z0-9_\-\.]+)\/grid-predictions$/);
    if (req.method === 'GET' && gridPredMatch) {
        const regionKey = gridPredMatch[1];
        
        checkAndRegisterDynamicRegion(regionKey, null);
        if (!REGIONS[regionKey]) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ detail: "Region not found" }));
            return;
        }

        let payload = getCachedPayload(regionKey);
        if (!payload) {
            payload = generatePayload(regionKey, null);
        }

        const predictions = extractGridPredictions(regionKey, payload);
        const ageSec = payloadCache[regionKey] ? parseFloat(((Date.now() - payloadCache[regionKey].time) / 1000).toFixed(1)) : 0.0;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            region_key: regionKey,
            status: "ready",
            age_seconds: ageSec,
            predictions: predictions
        }));
        return;
    }

    // Route: GET /analytics/:region_key
    const regionKeyMatch = reqPath.match(/^\/analytics\/([a-zA-Z0-9_\-\.]+)$/);
    if (req.method === 'GET' && regionKeyMatch) {
        const regionKey = regionKeyMatch[1];
        const name = parsedUrl.query.name;

        checkAndRegisterDynamicRegion(regionKey, name);
        if (!REGIONS[regionKey]) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ detail: "Region not found" }));
            return;
        }

        const region = REGIONS[regionKey];
        fetchTelemetry(region.latitude, region.longitude).then((raw) => {
            const payload = generatePayload(regionKey, raw);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(payload));
        }).catch((err) => {
            console.error(`[Server Error] Ingest failed:`, err);
            const payload = generatePayload(regionKey, null);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(payload));
        });
        return;
    }

    // Serving static frontend files (SPA fallback)
    if (req.method === 'GET' || req.method === 'HEAD') {
        if (reqPath === '/') {
            reqPath = '/index.html';
        }
        
        const normalizedPath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(staticDir, normalizedPath);

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    fs.readFile(path.join(staticDir, 'index.html'), (errSPA, contentSPA) => {
                        if (errSPA) {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('Not Found');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(req.method === 'HEAD' ? '' : contentSPA);
                        }
                    });
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`Internal Server Error: ${err.code}`);
                }
            } else {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(req.method === 'HEAD' ? '' : content);
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`===========================================================`);
    console.log(`🚀 Weather Intelligence as a Service (WIaaS) Mock Server`);
    console.log(`👉 Running on http://localhost:${PORT}`);
    console.log(`👉 Static root: ${staticDir}`);
    console.log(`===========================================================`);
});
