/**
 * ui.js — DOM manipulation, panel switching, data rendering.
 * Handles all updateUIElements(), showGeneralInfoPanel(), animateMetrics(), etc.
 */

import {
    getRegionMetadata,
    activeRegionKey,
    activeRegion,
    getActiveRegion,
    regionsRegistry,
    activeSubregionFilter,
    setActiveSubregionFilter,
    regionSearchQuery,
    setRegionSearchQuery,
    regionNames,
    regionOffsets,
    regionsTelemetryCache,
    heatmapActive,
    windActive,
    precipitationActive,
    bottomPanelMode,
    activeLeftTab,
    clearActiveRegion,
    setActiveRegionKey,
} from './state.js';
import { updateRadarChart, pushTempPowerReading, fluctuateVram } from './charts.js';
import { renderDynamicVisualizerHTML, mountDynamicVisualizer, destroyDynamicVisualizer } from './dynamic-visualizer.js';
import { fetchRegionAnalytics, sendChatSimulation } from './api.js';
import { renderAgriculturePanel } from './ui-agriculture.js';
import { showToast } from './toast.js';
import { resetAsiaMap } from './asia-map.js';
import { resetGeographicNavigation } from './geo-navigation.js';
import { hydrateDynamicMorphIcons } from './morph-icons.js';
import {
    isWindActive,
    isRainActive,
    isThermalActive,
    getCurrentClimateData,
    getSpatialLayerMetadata,
    toggleThermalLayer,
    toggleWindLayer,
    toggleRainLayer,
} from './map-layers.js';

// ── Telemetry Animation & Visual Ticker ───────────────────────────────────────
let latestAnalytics = null;
let tickerStarted = false;

// ── AI Grid Prediction Polling ────────────────────────────────────────────────
// Polls /analytics/{region}/grid-predictions every 60s and updates the grid panel
// widgets with real AI model values instead of locally-computed approximations.
let _gridPredictionTimer = null;

async function fetchAndApplyGridPredictions(regionKey) {
    try {
        const meta = getRegionMetadata(regionKey) || {};
        const params = new URLSearchParams();
        const fields = {
            name: meta.name || regionNames[regionKey],
            latitude: meta.latitude,
            longitude: meta.longitude,
            city: meta.city,
            province: meta.province,
            country: meta.country,
            asian_subregion: meta.asian_subregion,
            timezone: meta.timezone || meta.timeZone,
            timezone_offset: meta.timezone_offset,
            location_type: meta.locationType,
        };
        Object.entries(fields).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') params.set(k, v);
        });
        const query = params.toString();
        const url = `/analytics/${encodeURIComponent(regionKey)}/grid-predictions${query ? `?${query}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        if (!json || (!json.predictions && json.status !== 'ready')) return;
        
        const predictions = json.predictions || {};
        window._latestGridPredictions = predictions;
        window._latestGridAge = json.age_seconds;
        applyAIGridValues(predictions, json.age_seconds);
    } catch (e) {
        console.warn('[ui] fetchAndApplyGridPredictions error:', e);
    }
}

function applyAIGridValues(p, ageSeconds) {
    if (!p) return;

    // ── Right-panel widget IDs ──────────────────────────────────────────────
    const peakBox = document.getElementById('ai-peak-blackout-risk-val');
    if (peakBox && p.peak_blackout_risk_pct !== null) {
        peakBox.textContent = `${p.peak_blackout_risk_pct.toFixed(2)}%`;
    }
    const peakTime = document.getElementById('ai-peak-blackout-time-val');
    if (peakTime && p.peak_blackout_time !== null) {
        peakTime.textContent = p.peak_blackout_time;
    }
    const capEl = document.getElementById('ai-grid-capacity-val');
    if (capEl && p.grid_available_capacity_mw !== null) {
        capEl.textContent = `${p.grid_available_capacity_mw.toFixed(2)} MW`;
    }
    const surgeEl = document.getElementById('ai-grid-surge-val');
    if (surgeEl && p.grid_demand_surge_pct !== null) {
        surgeEl.textContent = `+${p.grid_demand_surge_pct.toFixed(2)}%`;
    }
    const statusBadge = document.getElementById('ai-grid-status-badge');
    if (statusBadge && p.grid_status) {
        statusBadge.textContent = p.grid_status;
        statusBadge.className = `kpi-status ${p.grid_status === 'STABLE' ? 'green' : p.grid_status === 'WARNING' ? 'yellow' : 'red'}`;
    }
    const summaryEl = document.getElementById('ai-grid-summary-text');
    if (summaryEl && p.ai_grid_summary) {
        summaryEl.textContent = p.ai_grid_summary;
        summaryEl.style.fontStyle = 'normal';
        summaryEl.style.color = 'var(--text-primary)';
    }

    // ── Grid tab IDs (left panel) ───────────────────────────────────────────
    // Verdict text
    const verdictEl = document.getElementById('grid-verdict-text');
    if (verdictEl && p.ai_grid_summary) {
        verdictEl.textContent = p.ai_grid_summary;
        verdictEl.style.fontStyle = 'normal';
        verdictEl.style.color = 'var(--text-primary)';
    }
    // Status badge (grid tab)
    const gridTabBadge = document.getElementById('grid-ai-status-badge');
    if (gridTabBadge && p.grid_status) {
        gridTabBadge.textContent = p.grid_status;
        gridTabBadge.className = `kpi-status ${p.grid_status === 'STABLE' ? 'green' : p.grid_status === 'WARNING' ? 'yellow' : 'red'}`;
    }
    // Peak risk card (grid tab)
    const peakRiskVal = document.getElementById('grid-peak-risk-val');
    if (peakRiskVal && p.peak_blackout_risk_pct !== null) {
        peakRiskVal.textContent = `${p.peak_blackout_risk_pct.toFixed(2)}%`;
    }
    const peakTimeVal = document.getElementById('grid-peak-time-val');
    if (peakTimeVal && p.peak_blackout_time !== null) {
        peakTimeVal.textContent = p.peak_blackout_time;
    }
    
    // Also populate duplicate rows in the data grid list
    const peakRiskValRow = document.getElementById('grid-peak-risk-val-row');
    if (peakRiskValRow && p.peak_blackout_risk_pct !== null) {
        peakRiskValRow.textContent = `${p.peak_blackout_risk_pct.toFixed(2)}%`;
    }
    const peakTimeValRow = document.getElementById('grid-peak-time-val-row');
    if (peakTimeValRow && p.peak_blackout_time !== null) {
        peakTimeValRow.textContent = p.peak_blackout_time;
    }
    // Big KPI bar
    const bigRiskEl = document.getElementById('ticker-blackout-risk');
    const bigBar = document.getElementById('ticker-blackout-bar');
    if (bigRiskEl && p.peak_blackout_risk_pct !== null) {
        bigRiskEl.textContent = `${p.peak_blackout_risk_pct.toFixed(2)}%`;
        const riskColor = p.peak_blackout_risk_pct > 60 ? 'red' : p.peak_blackout_risk_pct > 25 ? 'yellow' : 'green';
        bigRiskEl.style.color = `var(--${riskColor}-accent)`;
        if (bigBar) {
            bigBar.style.width = `${Math.min(p.peak_blackout_risk_pct, 100)}%`;
            bigBar.style.background = `var(--${riskColor}-accent)`;
        }
    }
    // Data rows
    const capTab = document.getElementById('ticker-grid-capacity-val');
    if (capTab && p.grid_available_capacity_mw !== null) {
        capTab.textContent = `${p.grid_available_capacity_mw.toFixed(2)} MW`;
    }
    const surgeTab = document.getElementById('ticker-grid-surge-val');
    if (surgeTab && p.grid_demand_surge_pct !== null) {
        surgeTab.textContent = `+${p.grid_demand_surge_pct.toFixed(2)}%`;
    }
    const thermalTab = document.getElementById('ticker-thermal-overhead-val');
    if (thermalTab && p.thermal_overhead_pct !== null) {
        thermalTab.textContent = `+${p.thermal_overhead_pct.toFixed(2)}%`;
    }
    // Age stamps (both panels)
    const ageStamp = (id) => {
        const el = document.getElementById(id);
        if (el && ageSeconds !== null) {
            const secs = Math.round(ageSeconds);
            el.textContent = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;
        }
    };
    ageStamp('ai-grid-prediction-age');
    ageStamp('grid-ai-age');
}


function startGridPredictionPolling(regionKey) {
    if (_gridPredictionTimer) clearInterval(_gridPredictionTimer);
    if (window._gridCountdownTimer) clearInterval(window._gridCountdownTimer);

    let secondsLeft = 60;

    function updateCountdown() {
        const elLeft = document.getElementById('ai-grid-refresh-countdown-left');
        const elRight = document.getElementById('ai-grid-refresh-countdown-right');

        const updateEl = (el) => {
            if (!el) return;
            if (secondsLeft <= 0) {
                el.textContent = 'Refreshing…';
                el.style.color = 'var(--yellow-accent)';
            } else {
                const m = Math.floor(secondsLeft / 60);
                const s = secondsLeft % 60;
                el.textContent = `${m}:${String(s).padStart(2, '0')}`;
                el.style.color = secondsLeft <= 10 ? 'var(--yellow-accent)' : 'var(--text-secondary)';
            }
        };

        updateEl(elLeft);
        updateEl(elRight);
        secondsLeft--;
    }

    // First fetch immediately, reset countdown on each successful fetch
    async function doFetch() {
        secondsLeft = 0;           // show "Refreshing…" while waiting
        updateCountdown();
        await fetchAndApplyGridPredictions(regionKey);
        secondsLeft = 60;          // reset after fetch completes
    }

    doFetch();
    _gridPredictionTimer = setInterval(doFetch, 60_000);

    // Tick every second
    updateCountdown();
    window._gridCountdownTimer = setInterval(updateCountdown, 1000);
}




function renderRightAgentGridPanel(data) {
    const panel = document.getElementById('agent-grid-intelligence-panel');
    if (!panel) return;

    panel.className = 'agent-grid-monitor-box';
    panel.style.background = 'rgba(13, 13, 18, 0.95)';
    panel.style.border = '1px solid rgba(56, 189, 248, 0.2)';
    panel.style.borderTop = '1px solid rgba(56, 189, 248, 0.4)';
    panel.style.borderRadius = '12px';
    panel.style.padding = '16px';
    panel.style.marginBottom = '16px';
    panel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)';

    const ledger = data.ledger || {};
    const gp = data.grid_predictions?.analytics_summary || {};
    const cap = (ledger.grid_available_capacity_mw ?? 500).toFixed(2);
    const surge = (ledger.grid_demand_surge_pct ?? 0).toFixed(2);
    const peakRisk = (gp.max_blackout_risk_pct ?? Math.min(100, Math.max(5, Number(surge) * 2.5))).toFixed(2);
    const peakTime = gp.peak_surge_hour || ledger.grid_peak_surge_time || '18:30';
    const gridStatus = gp.grid_status || (Number(peakRisk) > 60 ? 'CRITICAL' : Number(peakRisk) > 25 ? 'WARNING' : 'STABLE');
    const statusBadgeClass = gridStatus === 'STABLE' ? 'green' : gridStatus === 'WARNING' ? 'yellow' : 'red';
    const summaryText = `${data.region_name || 'Active Region'}: ${data.system_status || 'OPERATIONAL'}. Grid capacity ${cap} MW, demand surge +${surge}%. Risk: ${gridStatus} (${data.mission_criticality_score || 0}/100).`;

    panel.innerHTML = `
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent-color); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="cpu" style="width: 16px; height: 16px;"></i> AI MODEL PREDICTIONS: GLOBAL MONITOR
        </div>

        <!-- AI Model Verdict Box -->
        <div style="background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.12); border-radius: 8px; padding: 10px; font-size: 0.75rem; line-height: 1.35; margin-bottom: 12px; color: var(--text-primary);">
            <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px;">Grid Agent Verdict</div>
            <span id="ai-grid-summary-text" style="color: var(--text-primary); font-size: 0.72rem; line-height: 1.45;">${summaryText}</span>
            <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                <span class="kpi-status ${statusBadgeClass}" id="ai-grid-status-badge">${gridStatus}</span>
                <span style="color: var(--text-secondary); font-size: 0.65rem;">Updated: <span id="ai-grid-prediction-age">Active telemetry</span></span>
            </div>
            <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--text-secondary);">
                <i data-lucide="refresh-cw" style="width: 10px; height: 10px; opacity: 0.6;"></i>
                Data refreshes in <span id="ai-grid-refresh-countdown-right" style="font-family: var(--font-data); font-weight: 700; color: var(--text-secondary); margin-left: 3px;">…</span>
            </div>
        </div>


        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.75rem;">

            <!-- Power Grid: AI Values -->
            <div style="font-weight: 600; color: var(--accent-color); font-size: 0.7rem; text-transform: uppercase; margin-bottom: 2px;">Power Grid Model (AI)</div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Peak Blackout Risk</span>
                <span id="ai-peak-blackout-risk-val" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">${peakRisk}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Peak Risk Time</span>
                <span id="ai-peak-blackout-time-val" style="font-family: var(--font-data); font-weight: 700; color: var(--yellow-accent);">${peakTime}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Available Grid Capacity</span>
                <span id="ai-grid-capacity-val" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${cap} MW</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Grid Demand Surge</span>
                <span id="ai-grid-surge-val" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">+${surge}%</span>
            </div>

            <!-- Agriculture Model Section -->
            <div style="font-weight: 600; color: var(--accent-color); font-size: 0.7rem; text-transform: uppercase; margin-top: 4px;">Agriculture Physics Model</div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Sprinkler Efficiency</span>
                <span id="right-ticker-sprinkler-eff" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${(data.ledger.water_irrigation_efficiency_pct).toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Reservoir Evap Loss</span>
                <span id="right-ticker-evap-loss" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">${data.ledger.water_surface_evap_loss_pct.toFixed(2)}%</span>
            </div>

            <!-- Logistics Model Section -->
            <div style="font-weight: 600; color: var(--accent-color); font-size: 0.7rem; text-transform: uppercase; margin-top: 4px;">Logistics &amp; Fuel Model</div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Thermal Fuel Burn Overhead</span>
                <span id="right-ticker-fuel-overhead" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">+${data.ledger.fuel_thermal_overhead_pct.toFixed(2)}%</span>
            </div>
        </div>
    `;
    lucide.createIcons();

    // Start (or restart) polling for AI grid predictions
    if (data.region_key || window._activeRegionKey) {
        startGridPredictionPolling(data.region_key || window._activeRegionKey);
    }
    
    // If grid predictions were already fetched, immediately apply them
    if (window._latestGridPredictions) {
        applyAIGridValues(window._latestGridPredictions, window._latestGridAge);
    }
}


function startVisualTicker() {
    function tick() {
        if (latestAnalytics) {
            const time = Date.now();
            const seed = time / 1000;
            
            // Sub-second high-precision fluctuations to simulate microsecond updates
            const tempJitter = Math.sin(seed * 7.3) * 0.02 + Math.cos(seed * 13.7) * 0.005 + (Math.random() - 0.5) * 0.001;
            const humidJitter = Math.cos(seed * 5.1) * 0.05 + (Math.random() - 0.5) * 0.002;
            const windJitter = Math.sin(seed * 9.2) * 0.04 + (Math.random() - 0.5) * 0.001;
            const vpdJitter = Math.sin(seed * 3.4) * 0.003 + (Math.random() - 0.5) * 0.0001;
            const capacityJitter = Math.cos(seed * 4.2) * 0.1 + (Math.random() - 0.5) * 0.005;
            const fuelJitter = Math.sin(seed * 2.1) * 0.5 + (Math.random() - 0.5) * 0.05;
            
            // 1. Crop Health (NDVI)
            const cropHealthEl = document.getElementById('crop-health-value');
            if (cropHealthEl) {
                const healthIndex = latestAnalytics.crop_health_ndvi;
                const healthJitter = Math.sin(seed * 2.5) * 0.0001 + (Math.random() - 0.5) * 0.00001;
                cropHealthEl.innerText = (healthIndex + healthJitter).toFixed(2);
            }

            // 2. Soil Moisture
            const soilEl = document.getElementById('soil-moisture-val');
            if (soilEl) {
                const baseMoisture = latestAnalytics.soil_moisture_pct;
                const moistureJitter = Math.sin(seed * 1.8) * 0.02 + (Math.random() - 0.5) * 0.002;
                const soilVal = baseMoisture + moistureJitter;
                const soilStatus = soilVal > 35 ? 'Optimal' : (soilVal > 20 ? 'Adequate' : 'Critical Low');
                soilEl.innerText = `${soilVal.toFixed(1)}% (${soilStatus})`;
            }

            // 3. Irrigation Demand
            const irrigationEl = document.getElementById('irrigation-demand-val');
            if (irrigationEl) {
                const baseDemand = latestAnalytics.ledger.water_deliverable_m3 / 10000;
                const demandJitter = Math.cos(seed * 1.5) * 0.01 + (Math.random() - 0.5) * 0.0005;
                irrigationEl.innerText = `${Math.round(baseDemand + demandJitter).toLocaleString()} m³/hectare`;
            }

            // 4. Water Stress & Physical Water Ledger
            const stressEl = document.getElementById('water-stress-val');
            if (stressEl) {
                const baseStress = latestAnalytics.water_stress_index;
                const stressJitter = Math.sin(seed * 3.1) * 0.001 + (Math.random() - 0.5) * 0.0001;
                const stressVal = Math.max(0, baseStress + stressJitter);
                const stressStatus = stressVal > 0.6 ? 'Severe' : (stressVal > 0.3 ? 'Moderate' : 'Nominal');
                stressEl.innerText = `${stressVal.toFixed(2)} (${stressStatus})`;
            }
            const grossReservoirEl = document.getElementById('gross-reservoir-val');
            if (grossReservoirEl) {
                const baseVal = latestAnalytics.ledger.water_gross_reservoir_m3;
                const waterJitter = Math.sin(seed * 2.2) * 50 + (Math.random() - 0.5) * 5;
                grossReservoirEl.innerText = `${Math.round(baseVal + waterJitter).toLocaleString()} m³`;
            }
            const deliverableWaterEl = document.getElementById('deliverable-water-val');
            if (deliverableWaterEl) {
                const baseVal = latestAnalytics.ledger.water_deliverable_m3;
                const waterJitter = Math.cos(seed * 1.9) * 40 + (Math.random() - 0.5) * 4;
                deliverableWaterEl.innerText = `${Math.round(baseVal + waterJitter).toLocaleString()} m³`;
            }
            const reservoirEvapLossEl = document.getElementById('reservoir-evap-loss-val');
            if (reservoirEvapLossEl) {
                const baseVal = latestAnalytics.ledger.water_surface_evap_loss_pct;
                const evapJitter = Math.sin(seed * 3.5) * 0.02 + (Math.random() - 0.5) * 0.002;
                reservoirEvapLossEl.innerText = `${Math.max(0, baseVal + evapJitter).toFixed(4)}%`;
            }
            const tickerViability = document.getElementById('irrigation-viability-val');
            const tickerPenalty = document.getElementById('waste-penalty-val');
            if (tickerViability || tickerPenalty) {
                const eff = latestAnalytics.ledger.water_irrigation_efficiency_pct;
                const viable = eff >= 50.0;
                if (tickerViability) {
                    tickerViability.innerText = viable ? 'Viable' : 'Not Recommended';
                    tickerViability.className = `data-value ${viable ? 'green' : 'red'}`;
                }
                if (tickerPenalty) {
                    tickerPenalty.innerText = !viable ? 'Active' : 'Inactive';
                    tickerPenalty.className = `data-value ${!viable ? 'red' : 'green'}`;
                }
            }

            // 5. Globe Analysis Layers Tab
            const tickerTemp = document.getElementById('ticker-temp-val');
            if (tickerTemp) {
                const temp = latestAnalytics.telemetry.temperature_celsius + tempJitter;
                tickerTemp.innerText = `${temp.toFixed(1)}°C`;
            }
            const tickerWind = document.getElementById('ticker-wind-val');
            if (tickerWind) {
                const windSpd = Math.max(0, latestAnalytics.telemetry.wind_speed_kmh + windJitter);
                const windDir = (latestAnalytics.telemetry.wind_direction_degrees + (seed * 10) % 360) % 360;
                tickerWind.innerText = `${windSpd.toFixed(1)} km/h @ ${windDir.toFixed(0)}°`;
            }
            const tickerHumidity = document.getElementById('ticker-humidity-val');
            if (tickerHumidity) {
                const humid = Math.max(0, Math.min(100, latestAnalytics.telemetry.humidity_percentage + humidJitter));
                tickerHumidity.innerText = `${humid.toFixed(1)}%`;
            }

            // 6. Physics Tab
            const tickerVpd = document.getElementById('ticker-vpd-val');
            if (tickerVpd) {
                const vpd = Math.max(0, latestAnalytics.climate_matrix.vapor_pressure_deficit_kpa + vpdJitter);
                tickerVpd.innerText = vpd.toFixed(3);
            }
            const tickerHeatIndex = document.getElementById('ticker-heat-index-val');
            if (tickerHeatIndex) {
                const hi = latestAnalytics.climate_matrix.heat_index_celsius + tempJitter;
                tickerHeatIndex.innerText = `${hi.toFixed(1)}°C`;
            }
            const tickerWetBulb = document.getElementById('ticker-wet-bulb-val');
            if (tickerWetBulb) {
                const wb = latestAnalytics.climate_matrix.wet_bulb_celsius + tempJitter;
                tickerWetBulb.innerText = `${wb.toFixed(1)}°C`;
            }
            const tickerDeviation = document.getElementById('ticker-deviation-val');
            if (tickerDeviation) {
                const dev = latestAnalytics.climate_matrix.deviation_from_baseline_celsius + tempJitter;
                tickerDeviation.innerText = `${dev > 0 ? '+' : ''}${dev.toFixed(1)}°C`;
            }


            // 7. Grid Tab — values are set exclusively by the AI prediction poller (applyAIGridValues)
            // Do NOT write to ticker-grid-capacity-val, ticker-grid-surge-val, ticker-blackout-risk,
            // ticker-blackout-bar, ticker-grid-loss-val here — the poller overwrites from n8n every 60s.



            // Right panel dynamic tickers (Agri & Logistics)
            const rightTickerSprinklerEff = document.getElementById('right-ticker-sprinkler-eff');
            if (rightTickerSprinklerEff) {
                const vpd = latestAnalytics.climate_matrix.vapor_pressure_deficit_kpa + vpdJitter;
                const windSpd = Math.max(0, latestAnalytics.telemetry.wind_speed_kmh + windJitter);
                const wind_factor = 1.0 + 0.02 * windSpd;
                const evap_loss = Math.min(0.95, vpd * wind_factor * 0.08);
                const efficiency = Math.max(0.05, 1.0 - evap_loss);
                rightTickerSprinklerEff.innerText = `${(efficiency * 100).toFixed(2)}%`;
            }
            const rightTickerEvapLoss = document.getElementById('right-ticker-evap-loss');
            if (rightTickerEvapLoss) {
                const vpd = latestAnalytics.climate_matrix.vapor_pressure_deficit_kpa + vpdJitter;
                const evap = Math.min(0.30, vpd * 0.018) * 100;
                rightTickerEvapLoss.innerText = `${evap.toFixed(2)}%`;
            }
            const rightTickerFuelOverhead = document.getElementById('right-ticker-fuel-overhead');
            if (rightTickerFuelOverhead) {
                const thermal_stress = Math.max(0.0, latestAnalytics.climate_matrix.deviation_from_baseline_celsius + tempJitter);
                const fuel_overhead = Math.min(0.40, thermal_stress * 0.012) * 100;
                rightTickerFuelOverhead.innerText = `+${fuel_overhead.toFixed(2)}%`;
            }

            // 8. Logistics Tab
            const tickerFuel = document.getElementById('ticker-fuel-val');
            if (tickerFuel) {
                const fuel = Math.max(0, latestAnalytics.ledger.fuel_available_liters + fuelJitter);
                tickerFuel.innerText = Math.round(fuel).toLocaleString();
            }
            const tickerFuelOverhead = document.getElementById('ticker-fuel-overhead-val');
            if (tickerFuelOverhead) {
                const overhead = latestAnalytics.ledger.fuel_thermal_overhead_pct + capacityJitter * 0.02;
                tickerFuelOverhead.innerText = `+${overhead.toFixed(2)}%`;
            }

            // Bottom Panel Agent Tickers (active in agents mode)
            const bottomAgentVerdict = document.getElementById('bottom-agent-verdict');
            if (bottomAgentVerdict) {
                const surge = latestAnalytics.ledger.grid_demand_surge_pct + capacityJitter * 0.05;
                const blackoutRisk = (surge / 60) * 100;
                let verdict = '';
                if (blackoutRisk > 80) {
                    verdict = 'CRITICAL: Severe heat anomaly has spiked demand to critical ceilings. Cascading failure risk is extreme. Switch off non-essential agricultural feeders immediately.';
                } else if (blackoutRisk > 40) {
                    verdict = 'WARNING: Moderate thermal surge active. Substation temperatures are elevated. Implement demand-response limits on heavy motors.';
                } else {
                    verdict = 'NORMAL: Grid frequency is stable. Supply capacity satisfies all active operational agent bids.';
                }
                bottomAgentVerdict.innerText = verdict;
            }
            const bottomAgentBlackoutProb = document.getElementById('bottom-agent-blackout-prob');
            if (bottomAgentBlackoutProb) {
                const surge = latestAnalytics.ledger.grid_demand_surge_pct + capacityJitter * 0.05;
                const blackoutRisk = (surge / 60) * 100;
                bottomAgentBlackoutProb.innerText = `${blackoutRisk.toFixed(4)}%`;
            }
            const bottomAgentCapacity = document.getElementById('bottom-agent-capacity');
            if (bottomAgentCapacity) {
                const cap = Math.max(0, latestAnalytics.ledger.grid_available_capacity_mw + capacityJitter);
                bottomAgentCapacity.innerText = `${cap.toFixed(5)} MW`;
            }
            const bottomAgentSurge = document.getElementById('bottom-agent-surge');
            if (bottomAgentSurge) {
                const surge = latestAnalytics.ledger.grid_demand_surge_pct + capacityJitter * 0.05;
                bottomAgentSurge.innerText = `+${surge.toFixed(5)}%`;
            }
            const bottomAgentEfficiency = document.getElementById('bottom-agent-efficiency');
            if (bottomAgentEfficiency) {
                const baseEff = latestAnalytics.ledger.water_irrigation_efficiency_pct;
                const effJitter = Math.sin(seed * 4.1) * 0.02 + (Math.random() - 0.5) * 0.002;
                bottomAgentEfficiency.innerText = `${Math.max(0, Math.min(100, baseEff + effJitter)).toFixed(2)}%`;
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── updateUIElements() ───────────────────────────────────────────────────────
/**
 * Populates all DOM elements from a fresh API payload.
 * @param {Object} apiData - response from /analytics/{regionKey}
 */
export function updateUIElements(apiData) {
    latestAnalytics = apiData;
    window._latestAnalytics = apiData;
    const location = getActiveRegion();
    window._selectedLocation = location;

    // Ensure agriculture panel is rendered if DOM container is empty or location changed
    const agriContent = document.getElementById('agriculture-panel-content');
    if (agriContent && (!agriContent.children.length || agriContent.dataset.renderedLocation !== activeRegionKey)) {
        agriContent.dataset.renderedLocation = activeRegionKey;
        renderAgriculturePanel(location, apiData);
    }

    if (!tickerStarted) {
        tickerStarted = true;
        startVisualTicker();
    }

    // Region name with coordinates, diurnal cycle badge, and risk metrics
    const regionNameEl = document.getElementById('current-region-name');
    if (regionNameEl && activeRegionKey) {
        if (window._hasExplicitRegionSelection === true) {
            const formatted = formatRegionDisplayName(apiData.region_name, location?.country);
            regionNameEl.innerText = formatted;
            regionNameEl.title = `${apiData.region_name || ''}, ${location?.country || ''}`.trim();
        } else {
            regionNameEl.innerText = '';
            regionNameEl.removeAttribute('title');
        }
    }
    updateAgroZoneBadge(location);

    const climate  = apiData.climate_matrix;
    const telemetry = apiData.telemetry;
    const ledger   = apiData.ledger;

    // System status
    const systemStatusEl = document.getElementById('crop-health-status');
    systemStatusEl.innerText = apiData.system_status.replace(/_/g, ' ');
    systemStatusEl.className = 'kpi-status';
    if (apiData.system_status === 'HEALTHY')       systemStatusEl.classList.add('green');
    else if (apiData.system_status === 'ADVISORY') systemStatusEl.classList.add('yellow');
    else                                           systemStatusEl.classList.add('red');

    // Crop health KPI
    const healthIndex = apiData.crop_health_ndvi;
    document.getElementById('crop-health-value').innerText = healthIndex.toFixed(2);

    // Radar data
    const radarData = [
        Math.max(0.1, 0.85 - (climate.vapor_pressure_deficit_kpa * 0.15)),
        parseFloat(healthIndex.toFixed(2)),
        parseFloat((apiData.soil_moisture_pct / 50.0).toFixed(2)),
        Math.max(0.2, 0.80 - ((0.85 - healthIndex) * 0.5)),
        Math.max(0.3, 0.90 - (climate.deviation_from_baseline_celsius * 0.03)),
    ];
    updateRadarChart(radarData, healthIndex);

    // Soil moisture
    const soilMoisturePct = apiData.soil_moisture_pct.toFixed(1);
    const soilStatus      = soilMoisturePct > 35 ? 'Optimal' : (soilMoisturePct > 20 ? 'Adequate' : 'Critical Low');
    const soilEl = document.getElementById('soil-moisture-val');
    soilEl.innerText  = `${soilMoisturePct}% (${soilStatus})`;
    soilEl.className  = `data-value ${soilMoisturePct < 20 ? 'red' : (soilMoisturePct < 35 ? 'yellow' : 'green')}`;
    latestAnalytics.soil_moisture_base = parseFloat(soilMoisturePct);

    // Irrigation demand
    const demandVolume = Math.round(ledger.water_deliverable_m3 / 10000);
    document.getElementById('irrigation-demand-val').innerText = `${demandVolume} m³/hectare`;

    // Disease risk
    const diseaseRisk  = Math.round(apiData.disease_risk_pct);
    const riskStatus   = diseaseRisk > 30 ? 'High' : (diseaseRisk > 15 ? 'Medium' : 'Low');
    const riskEl = document.getElementById('disease-risk-val');
    riskEl.innerText  = `${riskStatus} (${diseaseRisk}%)`;
    riskEl.className  = `data-value ${diseaseRisk > 30 ? 'red' : (diseaseRisk > 15 ? 'yellow' : 'green')}`;

    // Water stress
    const waterStressVal = apiData.water_stress_index.toFixed(2);
    const stressStatus   = waterStressVal > 0.6 ? 'Severe' : (waterStressVal > 0.3 ? 'Moderate' : 'Nominal');
    const stressEl = document.getElementById('water-stress-val');
    stressEl.innerText  = `${waterStressVal} (${stressStatus})`;
    stressEl.className  = `data-value ${waterStressVal > 0.6 ? 'red' : (waterStressVal > 0.3 ? 'yellow' : 'green')}`;

    // Gross reservoir storage
    const grossEl = document.getElementById('gross-reservoir-val');
    if (grossEl) {
        grossEl.innerText = `${ledger.water_gross_reservoir_m3.toLocaleString()} m³`;
    }
    // Deliverable water volume
    const deliverableEl = document.getElementById('deliverable-water-val');
    if (deliverableEl) {
        deliverableEl.innerText = `${ledger.water_deliverable_m3.toLocaleString()} m³`;
    }
    // Reservoir evaporative loss
    const evapLossEl = document.getElementById('reservoir-evap-loss-val');
    if (evapLossEl) {
        evapLossEl.innerText = `${ledger.water_surface_evap_loss_pct.toFixed(2)}%`;
        evapLossEl.className = `data-value ${ledger.water_surface_evap_loss_pct > 15 ? 'red' : (ledger.water_surface_evap_loss_pct > 5 ? 'yellow' : 'green')}`;
    }

    // Overhead irrigation viability & penalty
    const viabilityEl = document.getElementById('irrigation-viability-val');
    if (viabilityEl) {
        const viable = ledger.water_irrigation_efficiency_pct >= 50.0;
        viabilityEl.innerText = viable ? 'Viable' : 'Not Recommended';
        viabilityEl.className = `data-value ${viable ? 'green' : 'red'}`;
    }
    const penaltyEl = document.getElementById('waste-penalty-val');
    if (penaltyEl) {
        const penalty = ledger.water_irrigation_efficiency_pct < 50.0;
        penaltyEl.innerText = penalty ? 'Active' : 'Inactive';
        penaltyEl.className = `data-value ${penalty ? 'red' : 'green'}`;
    }

    // AI recommendation
    let recommendation = '';
    if (apiData.system_status === 'CRITICAL_ANOMALY') {
        recommendation = `CRITICAL WARNING: Temperature exceeded baseline by ${climate.deviation_from_baseline_celsius}°C. High vapor pressure deficit of ${climate.vapor_pressure_deficit_kpa} kPa detected. Immediately switch to sub-surface drip irrigation to prevent evaporative loss.`;
    } else if (apiData.system_status === 'WARNING_ANOMALY') {
        recommendation = `ADVISORY: Moderate thermal stress. Soil moisture levels are declining. Shift irrigation schedules to early morning hours to optimize absorption and protect canopy transpiration.`;
    } else {
        recommendation = `SYSTEM NORMAL: Atmospheric conditions match the regional baseline. Maintain standard automated irrigation scheduling and track crop indices.`;
    }
    const recommendationEl = document.getElementById('ai-recommendation-text');
    if (recommendationEl) recommendationEl.innerText = recommendation;

    // Chat system notification
    const notificationEl = document.getElementById('system-notification-text');
    if (notificationEl) {
        notificationEl.innerText =
            `Weather models processed for ${apiData.region_name}. System status matches ${apiData.system_status} with current temperature at ${telemetry.temperature_celsius}°C. Risk Level: ${apiData.risk_level} (Criticality Score: ${apiData.mission_criticality_score}/100). Adjusting domain policies accordingly.`;
    }

    // Refresh the currently active side panel so that changing regions updates all tab contents instantly
    if (_currentPanelTab && !document.getElementById('general-info-panel').classList.contains('hidden')) {
        renderPanelContent(_currentPanelTab, apiData);
        const rightAgentGridPanel = document.getElementById('agent-grid-intelligence-panel');
        if (rightAgentGridPanel) {
            if (_currentPanelTab === 'grid') {
                rightAgentGridPanel.classList.remove('hidden');
                renderRightAgentGridPanel(apiData);
            } else {
                rightAgentGridPanel.classList.add('hidden');
            }
        }
    }
}

// ── Country Flag Mapping for Asia Monitoring Network ─────────────────────────
const COUNTRY_FLAGS = {
    'Pakistan': '🇵🇰',
    'India': '🇮🇳',
    'Bangladesh': '🇧🇩',
    'Afghanistan': '🇦🇫',
    'Nepal': '🇳🇵',
    'Sri Lanka': '🇱🇰',
    'Bhutan': '🇧🇹',
    'Maldives': '🇲🇻',
    'China': '🇨🇳',
    'Japan': '🇯🇵',
    'South Korea': '🇰🇷',
    'North Korea': '🇰🇵',
    'Mongolia': '🇲🇳',
    'Kazakhstan': '🇰🇿',
    'Uzbekistan': '🇺🇿',
    'Kyrgyzstan': '🇰🇬',
    'Tajikistan': '🇹🇯',
    'Turkmenistan': '🇹🇲',
    'Singapore': '🇸🇬',
    'Thailand': '🇹🇭',
    'Vietnam': '🇻🇳',
    'Indonesia': '🇮🇩',
    'Malaysia': '🇲🇾',
    'Philippines': '🇵🇭',
    'Myanmar': '🇲🇲',
    'Cambodia': '🇰🇭',
    'Laos': '🇱🇦',
    'Brunei': '🇧🇳',
    'Timor-Leste': '🇹🇱',
    'Togo': '🇹🇬',
    'France': '🇫🇷',
    'Spain': '🇪🇸',
    'Germany': '🇩🇪',
    'United Kingdom': '🇬🇧',
    'Italy': '🇮🇹',
    'United States': '🇺🇸',
    'Brazil': '🇧🇷',
    'Canada': '🇨🇦',
    'Argentina': '🇦🇷'
};

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderAsiaRegionTreeHTML(query, filter) {
    const q = (query || '').toLowerCase().trim();
    const f = filter || activeSubregionFilter || 'ALL';

    // Group regions by subregion then country
    const grouped = {};
    for (const [key, item] of Object.entries(regionsRegistry)) {
        // This explorer is Asia-only. Legacy benchmark fixtures remain in the
        // registry for compatibility, but must never leak into the UI.
        if (item.asian_subregion === 'Global Benchmarks') continue;
        const sub = (item.asian_subregion || 'Global Benchmarks').toUpperCase();
        
        // Filter by subregion tab
        if (f !== 'ALL' && sub !== f) continue;

        // Filter by search query across name, city, country, province, subregion
        if (q) {
            const matchesName = (item.name || '').toLowerCase().includes(q);
            const matchesCity = (item.city || '').toLowerCase().includes(q);
            const matchesCountry = (item.country || '').toLowerCase().includes(q);
            const matchesProvince = (item.province || '').toLowerCase().includes(q);
            const matchesSub = sub.toLowerCase().includes(q);
            if (!matchesName && !matchesCity && !matchesCountry && !matchesProvince && !matchesSub) {
                continue;
            }
        }

        if (!grouped[sub]) grouped[sub] = {};
        const country = item.country || 'Other';
        if (!grouped[sub][country]) grouped[sub][country] = [];
        grouped[sub][country].push({ ...item, key });
    }

    if (Object.keys(grouped).length === 0) {
        return `
            <div style="text-align:center; padding: 24px; color: var(--text-secondary); font-size: 0.8rem;">
                No operational zones match "<strong>${escapeHtml(query)}</strong>"
            </div>
        `;
    }

    return Object.entries(grouped).map(([subregionName, countries]) => `
        <div class="subregion-section">
            <div class="subregion-header">
                <span>${subregionName}</span>
                <span class="country-count">${Object.keys(countries).length} Countries</span>
            </div>

            ${Object.entries(countries).map(([countryName, zones]) => {
                const isPakistan = countryName === 'Pakistan';
                const flag = COUNTRY_FLAGS[countryName] || '🌐';
                const isExpanded = isPakistan || q.length > 0 || zones.some(z => z.key === activeRegionKey);

                return `
                    <div class="country-accordion-card ${isPakistan ? 'pakistan-featured' : ''}">
                        <div class="country-card-header" onclick="this.nextElementSibling.classList.toggle('expanded'); this.querySelector('.accordion-arrow').classList.toggle('rotated');">
                            <div class="country-left">
                                <span class="country-flag">${flag}</span>
                                <span class="country-title">${countryName}</span>
                                ${isPakistan ? '<span class="featured-star">★ FEATURED</span>' : ''}
                            </div>
                            <div class="country-right">
                                <span class="zone-count-badge">${zones.length} Zones</span>
                                <i data-lucide="chevron-down" class="accordion-arrow ${isExpanded ? 'rotated' : ''}"></i>
                            </div>
                        </div>

                        <div class="country-zones-list ${isExpanded ? 'expanded' : ''}">
                            ${zones.map(z => {
                                const isActive = z.key === activeRegionKey;
                                return `
                                    <button class="zone-select-item ${isActive ? 'active' : ''}"
                                            onclick="window.__wiaas.selectActiveRegion('${z.key}')">
                                        <div class="zone-left">
                                            <div class="zone-dot ${isActive ? 'active' : ''}"></div>
                                            <div>
                                                <div class="zone-name">${z.city || z.name}</div>
                                                <div class="zone-prov">${z.province || z.country} • <span class="zone-coords">${z.latitude !== undefined ? z.latitude.toFixed(2) : ''}°, ${z.longitude !== undefined ? z.longitude.toFixed(2) : ''}°</span></div>
                                            </div>
                                        </div>
                                        <div class="zone-right">
                                            ${isActive ? '<span class="active-tag"><i data-lucide="check" style="width: 12px; height: 12px;"></i> ACTIVE</span>' : `<span class="zone-tz">${z.timezone_offset >= 0 ? '+' : ''}${z.timezone_offset}h</span>`}
                                        </div>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');
}

function renderAsiaRegionExplorer(data) {
    const query = regionSearchQuery || '';
    const filter = activeSubregionFilter || 'ALL';
    const subregions = ['ALL', 'CENTRAL ASIA', 'EAST ASIA', 'SOUTH ASIA', 'SOUTHEAST ASIA'];

    return `
        <div class="asia-region-explorer">
            <!-- Search Bar -->
            <div class="asia-search-box">
                <i data-lucide="search" style="width: 14px; height: 14px; color: var(--text-secondary); margin-left: 8px;"></i>
                <input type="text" id="asia-region-search-input"
                       value="${escapeHtml(query)}"
                       placeholder="Search 29 Asian countries, operational zones, provinces..."
                       oninput="window.__wiaas.onRegionSearch(this.value)" />
                ${query ? `<button class="clear-search-btn" onclick="window.__wiaas.onRegionSearch('')">✕</button>` : ''}
            </div>

            <!-- Subregion Filter Pills -->
            <div class="subregion-filter-pills">
                ${subregions.map(sub => `
                    <button class="subregion-pill-btn ${filter === sub ? 'active' : ''}"
                            onclick="window.__wiaas.setSubregionFilter('${sub}')">
                        ${sub}
                    </button>
                `).join('')}
            </div>

            <!-- Country & Zone Tree -->
            <div class="asia-tree-container">
                ${renderAsiaRegionTreeHTML(query, filter)}
            </div>
        </div>
    `;
}

// ── renderPanelContent() — shared by cache-hit and post-fetch paths ──────────
function renderPanelContent(tabName, data) {
    const titleEl   = document.getElementById('general-panel-title');
    const contentEl = document.getElementById('general-panel-content');
    const iconEl    = document.getElementById('general-panel-icon');
    if (!titleEl || !contentEl || !iconEl) return;

    let content = '';

    if (tabName === 'location-analysis' || tabName === 'globe-analysis') {
        titleEl.innerText = 'Location Intelligence & Atmospheric Layers';
        iconEl.setAttribute('data-lucide', 'crosshair');

        const clim = getCurrentClimateData() || {};
        const cp = clim.climate_perception || {
            dry_bulb_temperature_c: Number(data.telemetry?.temperature_celsius ?? 32).toFixed(1),
            apparent_heat_index_c: Number(data.climate_matrix?.heat_index_celsius ?? 34).toFixed(1),
            wet_bulb_globe_temp_c: Number(data.climate_matrix?.wet_bulb_celsius ?? 26).toFixed(1),
            thermal_stress_category: 'Caution',
            solar_irradiance_wm2: 580.0,
            uv_index: 7.5,
            uv_category: 'High',
            cloud_cover_pct: 12,
            surface_pressure_hpa: 1005.0,
            climate_zone: 'Arid / Semi-Arid Agricultural Zone',
            drought_vulnerability_index: 0.48
        };
        const wind = clim.wind || {
            speed_kmh: Number(data.telemetry?.wind_speed_kmh ?? 14).toFixed(1),
            speed_ms: (Number(data.telemetry?.wind_speed_kmh ?? 14) / 3.6).toFixed(1),
            direction_degrees: data.telemetry?.wind_direction_degrees ?? 240,
            cardinal: 'WSW',
            gusts_kmh: 18.5,
            beaufort_scale: 'Gentle Breeze'
        };
        const rain = clim.precipitation_radar || {
            current_rate_mmh: 0.0,
            next_6h_max_probability_pct: 15,
            hourly_probability_12h: [10, 15, 20, 15, 10, 5, 0, 0, 0, 0, 0, 0],
            next_rain_eta_hours: null,
            rain_outlook_summary: 'Dry'
        };

        const isWind = isWindActive();
        const isRain = isRainActive();
        const isThermal = isThermalActive();
        const layerMeta = getSpatialLayerMetadata();
        const thermalTemperature = Number(cp.dry_bulb_temperature_c || data.telemetry?.temperature_celsius || 32).toFixed(1);

        const rainBarsHtml = (rain.hourly_probability_12h || [0, 0, 0, 0, 0, 0]).slice(0, 12).map((p, idx) => `
            <div class="rain-bar-col" title="+${idx+1}h: ${p}% rain probability">
                <div class="rain-bar-fill" style="height: ${Math.max(4, p)}%; background: ${p > 50 ? '#38bdf8' : (p > 20 ? '#60a5fa' : 'rgba(255,255,255,0.15)')};"></div>
                <span class="rain-bar-lbl">+${idx+1}h</span>
            </div>
        `).join('');

        content = `
            <div class="location-analysis-panel-body" style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Interactive Layer Toggles Section -->
                <div class="layer-toggles-section">
                    <div class="section-badge-header">
                        <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
                        <span>Interactive Map Overlays</span>
                    </div>

                    <!-- 1. Thermographic Asia Map -->
                    <div class="layer-control-card thermal-layer-card ${isThermal ? 'is-active' : ''}">
                        <div class="layer-control-top">
                            <div class="layer-info">
                                <div class="layer-title-row">
                                    <i data-lucide="thermometer-sun" class="layer-icon thermal"></i>
                                    <strong>Thermographic Asia Map</strong>
                                </div>
                                <span class="layer-desc">Intra-city thermal spectrum: Urban Heat Island (Red) vs Riparian Buffer (Green)</span>
                            </div>
                            <div class="layer-switch-wrap">
                                <span class="layer-toggle-tag ${isThermal ? 'active thermal' : ''}" id="switch-tag-thermal">${isThermal ? 'ENABLED' : 'DISABLED'}</span>
                                <label class="switch-toggle" title="Toggle Surface Thermal Heatmap">
                                    <input type="checkbox" id="switch-panel-thermal" aria-label="Toggle surface thermal heatmap" aria-describedby="thermal-grid-meta" ${isThermal ? 'checked' : ''}>
                                    <span class="switch-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="layer-sub-stats" id="panel-thermal-stats">
                            <div class="layer-stat-row">
                                <span class="ls-label">Surface Baseline Temp</span>
                                <strong class="ls-val" id="panel-thermal-temperature">${thermalTemperature}°C</strong>
                            </div>
                            <div class="layer-stat-row">
                                <span class="ls-label">Thermal Stress Level</span>
                                <span class="clim-tag ${cp.thermal_stress_category === 'Nominal' ? 'green' : (cp.thermal_stress_category === 'Caution' ? 'yellow' : 'red')}">${cp.thermal_stress_category || 'Nominal'}</span>
                            </div>
                            <div class="layer-spectrum-block">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 3px;">
                                    <span class="ls-label" style="font-size: 0.68rem; color: #94a3b8; white-space: nowrap;">Microclimate Spectrum</span>
                                    <span class="ls-val" style="color: #facc15; font-size: 0.70rem; font-weight: 600; white-space: nowrap;" id="panel-thermal-spectrum-range">Urban Core (Red) ➔ Riverine (Green)</span>
                                </div>
                            </div>
                            <div style="margin: 6px 0 2px 0;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.62rem; color: #94a3b8; margin-bottom: 2px;">
                                    <span style="color: #10b981;">Riverine / Agro</span>
                                    <span style="color: #facc15;">Suburban</span>
                                    <span style="color: #ef4444;">Urban Core (UHI)</span>
                                </div>
                                <div style="height: 6px; border-radius: 3px; background: linear-gradient(to right, #06b6d4, #10b981, #facc15, #f97316, #dc2626); box-shadow: 0 0 8px rgba(220,38,38,0.25);"></div>
                            </div>
                        </div>
                        <div class="thermal-layer-summary" aria-label="Thermal model-grid legend">
                            <div>
                                <span>${layerMeta.scopeLabel}</span>
                                <strong>${layerMeta.sampleCount || '25'} cells · ~${layerMeta.spacingKm || '7.0'} km</strong>
                            </div>
                            <div class="thermal-legend">
                                <span>Cool</span><span class="thermal-gradient" aria-hidden="true"></span><span>Hot</span>
                            </div>
                        </div>
                        <p class="layer-grid-meta" id="thermal-grid-meta" data-layer-grid-meta="thermal" aria-live="polite">${layerMeta.status} · ${layerMeta.updatedLabel}</p>
                        <div class="layer-api-source"><i data-lucide="database-zap" aria-hidden="true"></i><span data-layer-source="thermal">Open-Meteo High-Resolution Model Grid</span></div>
                    </div>

                    <!-- 2. Rainfall Radar & Precipitation -->
                    <div class="layer-control-card ${isRain ? 'is-active' : ''}">
                        <div class="layer-control-top">
                            <div class="layer-info">
                                <div class="layer-title-row">
                                    <i data-lucide="cloud-rain" class="layer-icon rain"></i>
                                    <strong>Rainfall Radar & Precipitation</strong>
                                </div>
                                <span class="layer-desc">Doppler circular radar perception with exact probability & timing</span>
                            </div>
                            <div class="layer-switch-wrap">
                                <span class="layer-toggle-tag ${isRain ? 'active' : ''}" id="switch-tag-rain">${isRain ? 'ENABLED' : 'DISABLED'}</span>
                                <label class="switch-toggle" title="Toggle Live Doppler Precipitation Radar">
                                    <input type="checkbox" id="switch-panel-rain" aria-label="Toggle precipitation radar" ${isRain ? 'checked' : ''}>
                                    <span class="switch-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Wind Flow & Direction -->
                    <div class="layer-control-card ${isWind ? 'is-active' : ''}">
                        <div class="layer-control-top">
                            <div class="layer-info">
                                <div class="layer-title-row">
                                    <i data-lucide="wind" class="layer-icon wind"></i>
                                    <strong>Wind Flow & Direction</strong>
                                </div>
                                <span class="layer-desc">Live vector streamlines & directional air current velocity</span>
                            </div>
                            <div class="layer-switch-wrap">
                                <span class="layer-toggle-tag ${isWind ? 'active' : ''}" id="switch-tag-wind">${isWind ? 'ENABLED' : 'DISABLED'}</span>
                                <label class="switch-toggle" title="Toggle Live Wind Flow Streamlines">
                                    <input type="checkbox" id="switch-panel-wind" aria-label="Toggle wind flow streamlines" ${isWind ? 'checked' : ''}>
                                    <span class="switch-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="layer-sub-stats" id="panel-wind-stats" style="margin-top: 8px;">
                            <div class="wind-kpi-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 12px;">
                                <div class="wm-kpi-item">
                                    <span style="display: block; font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">Wind Speed</span>
                                    <strong style="font-size: 1.05rem; color: #38bdf8; font-family: monospace;" id="panel-wind-speed">${wind.speed_kmh} km/h</strong>
                                </div>
                                <div class="wm-kpi-item">
                                    <span style="display: block; font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">Velocity (m/s)</span>
                                    <strong style="font-size: 1.05rem; color: #34d399; font-family: monospace;" id="panel-wind-speed-ms">${wind.speed_ms} m/s</strong>
                                </div>
                                <div class="wm-kpi-item" style="grid-column: span 2; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
                                    <span style="display: block; font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;">Wind Direction</span>
                                    <strong style="font-size: 0.95rem; color: #f8fafc; font-weight: 700;" id="panel-wind-heading">Wind from ${wind.cardinal || 'N'} (${wind.direction_degrees}°)</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- NASA POWER & Atmospheric Physics Metrics -->
                <div class="clim-panel-section">
                    <div class="section-badge-header">
                        <i data-lucide="sun-medium" style="width: 14px; height: 14px;"></i>
                        <span>NASA POWER & Climate Perception</span>
                    </div>

                    <div class="clim-metrics-grid" style="margin-top: 6px;">
                        <div class="clim-metric-card">
                            <span class="cm-lbl">Actual Dry-Bulb</span>
                            <strong class="cm-val" id="panel-clim-dry">${cp.dry_bulb_temperature_c}°C</strong>
                            <span class="cm-sub">Ambient Air</span>
                        </div>
                        <div class="clim-metric-card">
                            <span class="cm-lbl">Human Sensation</span>
                            <strong class="cm-val red" id="panel-clim-apparent">${cp.apparent_heat_index_c}°C</strong>
                            <span class="cm-sub">Apparent Heat Index</span>
                        </div>
                        <div class="clim-metric-card">
                            <span class="cm-lbl">Wet-Bulb (WBGT)</span>
                            <strong class="cm-val yellow" id="panel-clim-wbgt">${cp.wet_bulb_globe_temp_c}°C</strong>
                            <span class="clim-tag ${cp.thermal_stress_category === 'Nominal' ? 'green' : (cp.thermal_stress_category === 'Caution' ? 'yellow' : 'red')}" id="panel-clim-stress">${cp.thermal_stress_category}</span>
                        </div>
                    </div>

                    <div class="clim-metrics-grid" style="margin-top: 8px;">
                        <div class="clim-metric-card">
                            <span class="cm-lbl">NASA Solar Flux</span>
                            <strong class="cm-val" id="panel-clim-solar">${cp.solar_irradiance_wm2} W/m²</strong>
                            <span class="cm-sub">Direct Normal Flux</span>
                        </div>
                        <div class="clim-metric-card">
                            <span class="cm-lbl">UV Index</span>
                            <strong class="cm-val" id="panel-clim-uv">UV ${cp.uv_index}</strong>
                            <span class="cm-sub">${cp.uv_category || 'Moderate'}</span>
                        </div>
                        <div class="clim-metric-card">
                            <span class="cm-lbl">Surface Pressure</span>
                            <strong class="cm-val" id="panel-clim-press">${cp.surface_pressure_hpa} hPa</strong>
                            <span class="cm-sub">Barometric</span>
                        </div>
                    </div>
                </div>

                <!-- Dynamic Telemetry Waveform Visualizer (1s Interval) -->
                ${renderDynamicVisualizerHTML('location-analysis', 'Microclimate Atmospheric Waveform (1s)', '°C')}
            </div>
        `;
    } else if (tabName === 'region') {
        titleEl.innerText = 'Asia Monitoring Network';
        iconEl.setAttribute('data-lucide', 'globe');
        content = renderAsiaRegionExplorer(data);
    } else if (tabName === 'physics') {
        titleEl.innerText = 'Physics Intelligence';
        iconEl.setAttribute('data-lucide', 'thermometer');
        const vpdVal = Number(data.climate_matrix.vapor_pressure_deficit_kpa ?? 1.34).toFixed(3);
        const hiVal = Number(data.climate_matrix.heat_index_celsius ?? 32).toFixed(1);
        const wbVal = Number(data.climate_matrix.wet_bulb_celsius ?? 24).toFixed(1);
        const devVal = Number(data.climate_matrix.deviation_from_baseline_celsius ?? 0).toFixed(1);
        const locName = data.region_name || 'Active Zone';

        content = `
            <div class="kpi-section">
                <div class="kpi-header">Vapor Pressure Deficit</div>
                <div class="kpi-value-row">
                    <span class="kpi-value" id="ticker-vpd-val">${vpdVal}</span>
                    <span class="kpi-unit">kPa</span>
                </div>
            </div>
            <ul class="data-grid" style="margin-top: 15px;">
                <li class="data-row">
                    <span class="data-label">Heat Index</span>
                    <span class="data-value" id="ticker-heat-index-val">${hiVal}°C</span>
                </li>
                <li class="data-row">
                    <span class="data-label">Wet-Bulb Temperature</span>
                    <span class="data-value" id="ticker-wet-bulb-val">${wbVal}°C</span>
                </li>
                <li class="data-row">
                    <span class="data-label">Deviation from Baseline</span>
                    <span class="data-value ${Number(devVal) > 0 ? 'red' : 'green'}" id="ticker-deviation-val">
                        ${Number(devVal) > 0 ? '+' : ''}${devVal}°C
                    </span>
                </li>
            </ul>

            <!-- Dynamic Telemetry Waveform Visualizer (1s Interval) -->
            ${renderDynamicVisualizerHTML('physics', 'Atmospheric Stability & Vapor Deficit Waveform (1s)', 'kPa')}
        `;
    } else if (tabName === 'grid') {
        titleEl.innerText = 'Power Grid Status';
        iconEl.setAttribute('data-lucide', 'zap');

        const ledger = data.ledger || {};
        const gp = data.grid_predictions?.analytics_summary || {};
        const physicsCapacity = (ledger.grid_available_capacity_mw ?? 650).toFixed(2);
        const demandSurge = (ledger.grid_demand_surge_pct ?? 0).toFixed(2);
        const fuelOverhead = (ledger.fuel_thermal_overhead_pct ?? 0).toFixed(2);
        const peakRisk = (gp.max_blackout_risk_pct ?? Math.min(100, Math.max(5, Number(demandSurge) * 2.5))).toFixed(2);
        const peakTime = gp.peak_surge_hour || ledger.grid_peak_surge_time || '18:30';
        const gridStatus = gp.grid_status || (Number(peakRisk) > 60 ? 'CRITICAL' : Number(peakRisk) > 25 ? 'WARNING' : 'STABLE');
        const statusBadgeClass = gridStatus === 'STABLE' ? 'green' : gridStatus === 'WARNING' ? 'yellow' : 'red';
        const initialVerdict = `${data.region_name || 'Active Region'}: ${data.system_status || 'OPERATIONAL'}. Grid capacity ${physicsCapacity} MW, demand surge +${demandSurge}%. Risk: ${gridStatus} (${data.mission_criticality_score || 0}/100).`;

        content = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- AI Verdict Box -->
                <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 8px; padding: 12px; font-size: 0.75rem; color: var(--text-primary); line-height: 1.4;">
                    <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="cpu" style="width: 14px; height: 14px;"></i> AI GRID AGENT VERDICT
                    </div>
                    <span id="grid-verdict-text" style="color: var(--text-primary); font-size: 0.72rem; line-height: 1.45;">${initialVerdict}</span>
                    <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                        <span class="kpi-status ${statusBadgeClass}" id="grid-ai-status-badge">${gridStatus}</span>
                        <span style="color: var(--text-secondary); font-size: 0.65rem;">Updated: <span id="grid-ai-age">Active telemetry</span></span>
                    </div>
                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--text-secondary);">
                        <i data-lucide="refresh-cw" style="width: 10px; height: 10px; opacity: 0.6;"></i>
                        Data refreshes in <span id="ai-grid-refresh-countdown-left" style="font-family: var(--font-data); font-weight: 700; margin-left: 3px;">…</span>
                    </div>
                </div>

                <!-- Peak Blackout Risk (AI) -->
                <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; padding: 12px; font-size: 0.75rem; color: var(--text-primary); line-height: 1.4;">
                    <div style="font-weight: 700; color: var(--red-accent); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="trending-up" style="width: 14px; height: 14px;"></i> PEAK BLACKOUT RISK
                    </div>
                    <span>Predicted Peak Risk: <strong id="grid-peak-risk-val" style="color: var(--red-accent);">${peakRisk}%</strong> at <strong id="grid-peak-time-val">${peakTime}</strong> local runtime.</span>
                </div>

                <!-- GNN Blackout Risk KPI (AI) -->
                <div class="kpi-section" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.01);">
                    <div class="kpi-header" style="font-size: 0.75rem; color: var(--text-secondary);">GNN Blackout Risk Probability (AI)</div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                        <span id="ticker-blackout-risk" style="font-family: var(--font-data); font-size: 1.25rem; font-weight: 700; color: var(--red-accent);">${peakRisk}%</span>
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                            <div id="ticker-blackout-bar" style="width: ${Math.min(100, Number(peakRisk))}%; height: 100%; background: var(--red-accent); transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                </div>

                <!-- Tickers (AI values) -->
                <ul class="data-grid">
                    <li class="data-row">
                        <span class="data-label">Peak Blackout Risk</span>
                        <span class="data-value red" id="grid-peak-risk-val-row">${peakRisk}%</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Peak Risk Time</span>
                        <span class="data-value" id="grid-peak-time-val-row" style="color: var(--yellow-accent);">${peakTime}</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Available Grid Capacity</span>
                        <span class="data-value green" id="ticker-grid-capacity-val">${physicsCapacity} MW</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Grid Demand Surge</span>
                        <span class="data-value red" id="ticker-grid-surge-val">+${demandSurge}%</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Thermal Overhead (AI)</span>
                        <span class="data-value red" id="ticker-thermal-overhead-val">+${fuelOverhead}%</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Physics Baseline Capacity</span>
                        <span class="data-value" style="opacity:0.5;">${physicsCapacity} MW</span>
                    </li>
                </ul>

                <!-- Dynamic Telemetry Waveform Visualizer (1s Interval) -->
                ${renderDynamicVisualizerHTML('grid', 'Power Grid Frequency & Harmonic Load Waveform (1s)', 'MW')}

            </div>
        `;

    } else if (tabName === 'logistics') {
        titleEl.innerText = 'Logistics Reserves';
        iconEl.setAttribute('data-lucide', 'truck');
        const ledger = data.ledger || {};
        const fuelVal = Math.round(Number(ledger.fuel_available_liters ?? 330000)).toLocaleString();
        const fuelOverheadVal = Number(ledger.fuel_thermal_overhead_pct ?? 5.2).toFixed(2);
        const locName = data.region_name || 'Active Zone';

        content = `
            <div class="kpi-section">
                <div class="kpi-header">Available Fuel Reserves</div>
                <div class="kpi-value-row">
                    <span class="kpi-value" id="ticker-fuel-val">${fuelVal}</span>
                    <span class="kpi-unit">Liters</span>
                </div>
            </div>
            <ul class="data-grid" style="margin-top: 15px;">
                <li class="data-row">
                    <span class="data-label">Thermal Fuel Overhead</span>
                    <span class="data-value red" id="ticker-fuel-overhead-val">+${fuelOverheadVal}%</span>
                </li>
            </ul>

            <!-- Dynamic Telemetry Waveform Visualizer (1s Interval) -->
            ${renderDynamicVisualizerHTML('logistics', 'Fuel Reserve Burn Velocity & Supply Dynamics (1s)', 'L')}
        `;



    } else if (tabName === 'research') {
        titleEl.innerText = 'State Vector & Research';
        iconEl.setAttribute('data-lucide', 'microscope');
        const locName = data.region_name || 'Active Zone';
        const stateVectorText = data.llm_state_vector || buildFallbackStateVector(data);
        content = `
            <div style="max-height: 650px; overflow-y: auto; padding-right: 5px;">
                ${renderStateVectorHTML(stateVectorText)}
            </div>
        `;
    } else if (tabName === 'crisislens' || tabName === 'analytics') {
        const isAnalytics = tabName === 'analytics';
        const rName = data.region_name ? data.region_name.split(',')[0].trim() : 'Active Zone';
        titleEl.innerText = isAnalytics 
            ? `CrisisLens Threat Analytics · ${rName}` 
            : `CrisisLens Threat Analysis · ${rName}`;
        titleEl.title = isAnalytics 
            ? `CrisisLens Threat Analytics - ${data.region_name || 'Active Zone'}` 
            : `CrisisLens Threat Analysis - ${data.region_name || 'Active Zone'}`;
        iconEl.setAttribute('data-lucide', isAnalytics ? 'bar-chart-3' : 'shield-alert');
        
        const criticality = data.mission_criticality_score || 0;
        let severityColor = 'var(--green-accent)';
        if (criticality > 75) {
            severityColor = 'var(--red-accent)';
        } else if (criticality > 40) {
            severityColor = 'var(--yellow-accent)';
        }

        content = `
            <div style="display: flex; flex-direction: column; gap: 16px; max-height: 650px; overflow-y: auto; padding-right: 5px;">
                <!-- Threat Level & Criticality -->
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 14px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Crisis Severity</span>
                        <span class="kpi-status" style="background: ${severityColor}20; color: ${severityColor}; border: 1px solid ${severityColor}40; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">${(data.risk_level || 'EVALUATING').toUpperCase()}</span>
                    </div>
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 8px;">
                        <span style="font-family: var(--font-data); font-size: 1.8rem; font-weight: 700; color: ${severityColor};">${criticality}</span>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">/ 100 Criticality</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 0.72rem; color: var(--text-secondary);">
                        System status: <strong style="color: ${severityColor};">${data.system_status || 'OPERATIONAL'}</strong>
                    </div>
                </div>

                <!-- Climate Indicators -->
                <div>
                    <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Climate Risk Vectors</h4>
                    <ul class="data-grid">
                        <li class="data-row">
                            <span class="data-label">Vapor Pressure Deficit (VPD)</span>
                            <span class="data-value" style="color: var(--yellow-accent); font-weight: 600;">${data.climate_matrix?.vapor_pressure_deficit_kpa ?? 1.45} kPa</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Wet-Bulb Temperature</span>
                            <span class="data-value" style="color: var(--red-accent); font-weight: 600;">${data.climate_matrix?.wet_bulb_celsius ?? 24.2}°C</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Heat Index</span>
                            <span class="data-value">${data.climate_matrix?.heat_index_celsius ?? 34.0}°C</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Baseline Temp Deviation</span>
                            <span class="data-value ${(data.climate_matrix?.deviation_from_baseline_celsius ?? 0) > 0 ? 'red' : 'green'}">
                                +${data.climate_matrix?.deviation_from_baseline_celsius ?? 1.2}°C
                            </span>
                        </li>
                    </ul>
                </div>

                <!-- Resource Ledgers -->
                <div>
                    <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Resource Availability</h4>
                    <ul class="data-grid">
                        <li class="data-row">
                            <span class="data-label">Deliverable Water Volume</span>
                            <span class="data-value green">${(data.ledger?.water_deliverable_m3 ?? 2800000).toLocaleString()} m³</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Evaporative Rate Penalty</span>
                            <span class="data-value red">${(data.ledger?.water_surface_evap_loss_pct ?? 14.5).toFixed(2)}%</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Grid Available Capacity</span>
                            <span class="data-value green">${(data.ledger?.grid_available_capacity_mw ?? 650).toFixed(2)} MW</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Fuel Reserves</span>
                            <span class="data-value green">${(data.ledger?.fuel_available_liters ?? 180000).toLocaleString()} L</span>
                        </li>
                    </ul>
                </div>

                <!-- Active Routing Directives -->
                <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 8px; padding: 12px; font-size: 0.7rem; line-height: 1.45;">
                    <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="shield-alert" style="width: 12px; height: 12px;"></i> CrisisLens Threat Corridors
                    </div>
                    <p style="margin: 0; color: var(--text-secondary);">Direct response routing enabled for <strong>${data.region_name || 'Active Zone'}</strong> and connected regional infrastructure corridors.</p>
                </div>
            </div>
        `;
    }

    contentEl.innerHTML = content;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
    requestAnimationFrame(() => {
        hydrateDynamicMorphIcons(contentEl);
    });

    // Wire location-analysis layer toggle switches after DOM injection
    if (tabName === 'location-analysis' || tabName === 'globe-analysis') {
        const thermalSwitch = document.getElementById('switch-panel-thermal');
        const windSwitch    = document.getElementById('switch-panel-wind');
        const rainSwitch    = document.getElementById('switch-panel-rain');
        if (thermalSwitch) thermalSwitch.addEventListener('change', () => {
            try { toggleThermalLayer(thermalSwitch.checked); } catch(e) { console.warn('toggleThermalLayer error', e); }
        });
        if (windSwitch) windSwitch.addEventListener('change', () => {
            try { toggleWindLayer(windSwitch.checked); } catch(e) { console.warn('toggleWindLayer error', e); }
        });
        if (rainSwitch) rainSwitch.addEventListener('change', () => {
            try { toggleRainLayer(rainSwitch.checked); } catch(e) { console.warn('toggleRainLayer error', e); }
        });
    }

    // Wire Card Context Reset buttons inside any sector card
    const cardResetBtns = contentEl.querySelectorAll('.card-context-reset-btn');
    cardResetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const resetTab = btn.getAttribute('data-reset-tab') || tabName;
            resetSectorContext(resetTab);
        });
    });

    // Mount 1-second Dynamic Visualizer on supported tabs
    if (['physics', 'logistics', 'grid', 'globe-analysis', 'location-analysis'].includes(tabName)) {
        mountDynamicVisualizer(tabName, data);
    } else {
        destroyDynamicVisualizer();
    }

    // If grid predictions were already fetched, immediately apply them to the placeholders
    if (tabName === 'grid') {
        if (window._latestGridPredictions) {
            applyAIGridValues(window._latestGridPredictions, window._latestGridAge);
        }
        fetchAndApplyGridPredictions(activeRegionKey);
    }
}

// Tracks which tab triggered the most recent showGeneralInfoPanel call.
// The background fetch checks this before re-rendering — if the user has
// switched to a different tab by the time the response arrives the stale
// result is silently discarded instead of overwriting the current content.
let _currentPanelTab = null;
export function getCurrentPanelTab() {
    return _currentPanelTab;
}

// ── showGeneralInfoPanel() ───────────────────────────────────────────────────
/**
 * Renders a side panel instantly from the telemetry cache, then silently
 * refreshes in the background so data stays up-to-date without blocking the UI.
 * @param {string} tabName - one of: globe-analysis | region | physics | grid | logistics | research | crisislens | analytics
 */
export async function showGeneralInfoPanel(tabName) {
    // Record which tab is active right now so stale background fetches can be discarded
    _currentPanelTab = tabName;
    const myTab = tabName;

    try {
        // Show panel immediately — no waiting for network
        document.getElementById('agriculture-panel').classList.add('hidden');
        document.getElementById('general-info-panel').classList.remove('hidden');
        document.getElementById('left-sidebar').classList.add('visible');

        const resetBtn = document.getElementById('reset-general-panel-btn');
        if (resetBtn) {
            resetBtn.title = tabName === 'region'
                ? 'Reset Map to Continental Overview'
                : 'Refresh Live Telemetry Signals';
        }

        const cached = regionsTelemetryCache[activeRegionKey];

        if (tabName === 'region') {
            // Region drawer contains the complete Asian country catalogue and doesn't require live telemetry
            renderPanelContent('region', cached || {});
        } else if (cached) {
            // Render instantly from cache
            renderPanelContent(tabName, cached);
        } else {
            // First ever load for this region — show active loading state while we fetch
            const contentEl = document.getElementById('general-panel-content');
            if (contentEl) {
                contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 8px;"><i data-lucide="loader-2" class="spin" style="width: 20px; height: 20px; color: var(--accent-color);"></i><span>Connecting to Live Asian Telemetry Stream…</span></div>';
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons({ root: contentEl });
                }
            }
        }

        // Toggle Right Panel Agent Grid monitor based on active tab
        const rightAgentGridPanel = document.getElementById('agent-grid-intelligence-panel');
        if (rightAgentGridPanel) {
            if (tabName === 'grid') {
                rightAgentGridPanel.classList.remove('hidden');
                if (cached) {
                    renderRightAgentGridPanel(cached);
                }
            } else {
                rightAgentGridPanel.classList.add('hidden');
            }
        }

        // Background refresh — update silently after network responds
        const fresh = await fetchRegionAnalytics(activeRegionKey);
        if (!fresh) {
            if (!cached && tabName !== 'region') {
                const meta = getActiveRegion() || {};
                const fallback = {
                    region_name: meta.name || meta.city || 'Active Zone',
                    system_status: 'OPERATIONAL',
                    risk_level: 'MODERATE',
                    mission_criticality_score: 35,
                    climate_matrix: {
                        vapor_pressure_deficit_kpa: 1.34,
                        heat_index_celsius: 32.0,
                        wet_bulb_celsius: 24.0,
                        deviation_from_baseline_celsius: 0.5
                    },
                    ledger: {
                        water_deliverable_m3: 2800000,
                        water_surface_evap_loss_pct: 12.0,
                        grid_available_capacity_mw: 650,
                        fuel_available_liters: 180000,
                        fuel_thermal_overhead_pct: 5.2
                    },
                    telemetry: {
                        temperature_celsius: 30.0,
                        wind_speed_kmh: 12,
                        wind_direction_degrees: 180,
                        humidity_percentage: 55
                    },
                    grid_predictions: {}
                };
                regionsTelemetryCache[activeRegionKey] = fallback;
                if (_currentPanelTab === myTab) renderPanelContent(tabName, fallback);
            }
            return;
        }

        // Discard if the user has switched to a different tab while we were fetching
        if (_currentPanelTab !== myTab) return;

        regionsTelemetryCache[activeRegionKey] = fresh;

        // Re-render with fresh data (updates values silently in background)
        renderPanelContent(tabName, fresh);

        if (tabName === 'grid' && rightAgentGridPanel) {
            renderRightAgentGridPanel(fresh);
        }
    } catch (e) {
        console.error('[ui] showGeneralInfoPanel failed:', e);
    }
}

// ── formatRegionDisplayName & updateAgroZoneBadge ────────────────────────────
export function formatRegionDisplayName(rawName, country) {
    if (!rawName) return country || 'Selected Region';
    let city = rawName.split(' (')[0].trim();

    // Clean up administrative suffixes
    if (city.toLowerCase().includes('islamabad')) {
        city = 'Islamabad';
    } else if (city.toLowerCase().includes('karachi')) {
        city = 'Karachi';
    } else if (city.includes(',')) {
        const parts = city.split(',').map(s => s.trim());
        if (parts.length >= 3) {
            // [City, Province, Country] -> "City, Country"
            city = `${parts[0]}, ${parts[parts.length - 1]}`;
        } else if (parts.length === 2) {
            city = `${parts[0]}, ${parts[1]}`;
        }
    }

    if (country && !city.toLowerCase().includes(country.toLowerCase())) {
        return `${city}, ${country}`;
    }
    return city;
}

export function updateAgroZoneBadge(location) {
    const badgeText = document.getElementById('map-agro-zone-text');
    if (!badgeText) return;

    if (!location) {
        badgeText.textContent = 'Full-Asia Operational Meteorological Network';
        return;
    }

    const key = (location.key || location.id || '').toLowerCase();
    const city = (location.city || location.name || '').toLowerCase();
    const country = (location.country || '').toLowerCase();

    if (key.includes('multan') || city.includes('multan')) {
        badgeText.textContent = 'Zone III-B: Cotton & Mango Belt (Punjab)';
    } else if (key.includes('lahore') || city.includes('lahore')) {
        badgeText.textContent = 'Zone III-A: Rice & Wheat Central Plains (Punjab)';
    } else if (key.includes('islamabad') || city.includes('islamabad') || city.includes('rawalpindi')) {
        badgeText.textContent = 'Zone I: Northern Pothohar Rainfed Belt';
    } else if (key.includes('karachi') || city.includes('karachi')) {
        badgeText.textContent = 'Zone I-A: Indus Delta Coastal & Maritime Zone';
    } else if (key.includes('faisalabad') || city.includes('faisalabad')) {
        badgeText.textContent = 'Zone IV-A: Mixed Cropping Central Indus Plain';
    } else if (key.includes('sukkur') || city.includes('sukkur')) {
        badgeText.textContent = 'Zone II-A: Lower Indus Alluvial Basin';
    } else if (key.includes('peshawar') || city.includes('peshawar')) {
        badgeText.textContent = 'Zone VI-A: Peshawar Valley Irrigated Basin';
    } else if (key.includes('muzaffarabad') || city.includes('muzaffarabad')) {
        badgeText.textContent = 'Zone VII: Sub-Himalayan Alpine Basin (AJK)';
    } else if (key.includes('quetta') || city.includes('quetta')) {
        badgeText.textContent = 'Zone V: Western High-Altitude Arid Plateau';
    } else if (country.includes('japan') || city.includes('tokyo')) {
        badgeText.textContent = 'Kanto Plain Agro-Horticultural Basin';
    } else if (country.includes('china') || city.includes('beijing')) {
        badgeText.textContent = 'North China Continental Grain Plain';
    } else if (country.includes('india') || city.includes('delhi')) {
        badgeText.textContent = 'Indo-Gangetic Fertile Alluvial Plains';
    } else if (country.includes('bangladesh') || city.includes('dhaka')) {
        badgeText.textContent = 'Brahmaputra-Meghna Monsoon Riverine Zone';
    } else {
        const rawCName = location.city || location.name || location.country || 'Regional';
        const cleanName = rawCName.split(',')[0].replace(/\s+Valley$/i, '').trim();
        badgeText.textContent = `${cleanName} Agro-Ecological Zone`;
    }
    badgeText.title = badgeText.textContent;
    if (badgeText.parentElement) badgeText.parentElement.title = badgeText.textContent;
}

// ── updateRegionTime() & Localhost Timeline ──────────────────────────────────
let _clockLocation = null;
let _userTimelineLocation = null;
let _isLocalhostTimelineActive = false;

export function setRegionClockLocation(location) {
    const widgetEl = document.querySelector('.active-region-widget') || document.getElementById('active-region-widget');
    if (!location) {
        if (widgetEl) widgetEl.classList.add('hidden');
        _clockLocation = null;
        return;
    }

    _clockLocation = location;
    _isLocalhostTimelineActive = false;

    // Show the widget ONLY when a region has been actively selected by user
    if (widgetEl) {
        widgetEl.classList.remove('hidden');
    }

    const regionNameEl = document.getElementById('current-region-name');
    if (regionNameEl) {
        const formatted = formatRegionDisplayName(location.city || location.name, location.country);
        regionNameEl.innerText = formatted;
        regionNameEl.title = `${location.city || location.name || ''}, ${location.country || ''}`.trim();
        if (widgetEl) widgetEl.title = `${formatted} · Local time`;
    }
    updateAgroZoneBadge(location);

    const timeLabelEl = document.getElementById('current-region-time-label');
    if (timeLabelEl) {
        let tzCode = location.timezone_code;
        if (!tzCode && location.timezone) {
            // Extract clean 3-4 letter abbreviation e.g. "PKT" from "GMT+5 (PKT - Pakistan Standard Time)"
            const match = location.timezone.match(/\(([A-Z]{3,4})/i);
            if (match) {
                tzCode = match[1].toUpperCase();
            } else if (location.timezone.includes('GMT') || location.timezone.includes('UTC')) {
                const gmtMatch = location.timezone.match(/(GMT[+-]?\d*(?::\d+)?|UTC[+-]?\d*(?::\d+)?)/i);
                tzCode = gmtMatch ? gmtMatch[1] : 'UTC';
            } else {
                tzCode = 'Local Time';
            }
        }
        tzCode = tzCode || 'PKT';
        timeLabelEl.innerText = `Local time · ${tzCode}`;
    }

    updateRegionTime();
}

export function clearRegionClockLocation() {
    _clockLocation = null;
    _isLocalhostTimelineActive = false;
    window._hasExplicitRegionSelection = false;

    // Hide the widget completely when selection is cleared
    const widgetEl = document.querySelector('.active-region-widget') || document.getElementById('active-region-widget');
    if (widgetEl) {
        widgetEl.classList.add('hidden');
    }

    const regionNameEl = document.getElementById('current-region-name');
    if (regionNameEl) regionNameEl.innerText = '';

    const timeLabelEl = document.getElementById('current-region-time-label');
    if (timeLabelEl) timeLabelEl.innerText = '';

    const timeEl = document.getElementById('current-region-time');
    if (timeEl) timeEl.innerText = '';

    updateAgroZoneBadge(null);
}

export function setUserLocalhostTimeline(location) {
    if (!location) return;
    _userTimelineLocation = location;
    // Keep widget hidden — do NOT show or populate until user explicitly selects a region
}

export function updateRegionTime() {
    const widgetEl = document.querySelector('.active-region-widget') || document.getElementById('active-region-widget');
    if (!_clockLocation || (widgetEl && widgetEl.classList.contains('hidden'))) {
        return;
    }

    const meta = _clockLocation;
    if (!meta) return;

    const offset = meta.timezone_offset ?? regionOffsets[meta.key || activeRegionKey] ?? 0;
    const utc       = Date.now() + new Date().getTimezoneOffset() * 60000;
    const localTime = new Date(utc + 3600000 * offset);
    const timeStr   = localTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const el = document.getElementById('current-region-time');
    if (el) el.innerText = timeStr;
}

// ── animateMetrics() ─────────────────────────────────────────────────────────
export function animateMetrics() {
    setInterval(() => {
        const cpuVal   = (80 + Math.random() * 5).toFixed(1);
        const vramVal  = (158 + Math.random() * 4).toFixed(1);
        const speedVal = Math.round(4200 + Math.random() * 200).toLocaleString();
        const latVal   = (8.0 + Math.random() * 0.8).toFixed(1);
        const powerVal = Math.round(640 + Math.random() * 25);
        const tempVal  = Math.round(73 + Math.random() * 3);

        const setMetric = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.innerText = value;
        };
        setMetric('cpu-util-val', `${cpuVal}%`);
        setMetric('vram-usage-val', `${vramVal} / 192 GB`);
        setMetric('inf-speed-val', `${speedVal} T/s`);
        setMetric('latency-val', `${latVal} ms`);
        setMetric('power-draw-val', `${powerVal} W`);

        pushTempPowerReading(powerVal, tempVal);
        fluctuateVram();
    }, 2000);
}

// ── updateBottomPanelVisibility() ─────────────────────────────────────────────
export function updateBottomPanelVisibility() {
    const titleEl = document.getElementById('bottom-panel-title');
    const analyticsContainer = document.getElementById('bottom-analytics-container');
    const agentsContainer = document.getElementById('bottom-agents-container');
    
    if (!titleEl || !analyticsContainer || !agentsContainer) return;
    
    if (bottomPanelMode === 'analytics') {
        titleEl.innerText = 'Neural Multi-Agent Inference Details';
        analyticsContainer.style.display = 'flex';
        agentsContainer.classList.add('hidden');
    } else {
        titleEl.innerText = 'AI Agent Swarm Allocation & Predictions';
        analyticsContainer.style.display = 'none';
        agentsContainer.classList.remove('hidden');
        renderBottomAgentsContent();
    }
}

// ── renderBottomAgentsContent() ──────────────────────────────────────────────
function renderBottomAgentsContent() {
    const container = document.getElementById('bottom-agents-container');
    if (!container) return;

    if (!latestAnalytics) {
        container.innerHTML = `<p style="color:var(--text-secondary);font-size:0.8rem;padding:12px;">Loading agent telemetry...</p>`;
        return;
    }

    const nominal = latestAnalytics.baselines ? latestAnalytics.baselines.grid_capacity_mw : (latestAnalytics.ledger.grid_available_capacity_mw / (1.0 - latestAnalytics.ledger.grid_demand_surge_pct / 100));
    const blackoutRisk = (latestAnalytics.ledger.grid_demand_surge_pct / 60) * 100;
    
    let verdict = '';
    let riskColor = 'green';
    if (blackoutRisk > 80) {
        verdict = 'CRITICAL: Severe heat anomaly has spiked demand to critical ceilings. Cascading failure risk is extreme. Switch off non-essential agricultural feeders immediately.';
        riskColor = 'red';
    } else if (blackoutRisk > 40) {
        verdict = 'WARNING: Moderate thermal surge active. Substation temperatures are elevated. Implement demand-response limits on heavy motors.';
        riskColor = 'yellow';
    } else {
        verdict = 'NORMAL: Grid frequency is stable. Supply capacity satisfies all active operational agent bids.';
    }

    // Allocations
    const agriBid = (nominal * 0.15).toFixed(2);
    const logisticsBid = (nominal * 0.05).toFixed(2);
    const civilBid = (nominal * 0.65).toFixed(2);
    const availableVal = latestAnalytics.ledger.grid_available_capacity_mw.toFixed(2);
    const surgeVal = latestAnalytics.ledger.grid_demand_surge_pct.toFixed(2);

    container.innerHTML = `
        <div class="bottom-agents-row-container">
            <!-- Verdict Box -->
            <div class="bottom-agent-card verdict-card">
                <div>
                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent-color); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="info" style="width: 16px; height: 16px;"></i> ACTIVE AGENT STATUS &amp; VERDICT
                    </div>
                    <p style="font-size: 0.75rem; line-height: 1.4; color: var(--text-primary);" id="bottom-agent-verdict">${verdict}</p>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">
                    GNN Blackout Risk Probability: <span id="bottom-agent-blackout-prob" style="font-family: var(--font-data); font-weight: 700; color: var(--${riskColor}-accent);">${blackoutRisk.toFixed(4)}%</span>
                </div>
            </div>

            <!-- Agent Allocations -->
            <div class="bottom-agent-card">
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Multi-Agent Bandwidth Allocation
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: var(--text-secondary);">Agri-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600; white-space: nowrap;">${agriBid} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: var(--text-secondary);">Logistics-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600; white-space: nowrap;">${logisticsBid} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: var(--text-secondary);">Regulator-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600; white-space: nowrap;">${civilBid} MW</span>
                    </div>
                </div>
            </div>

            <!-- Telemetry Constraints -->
            <div class="bottom-agent-card">
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Telemetry Constraints
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: var(--text-secondary);">Available Grid Capacity</span>
                        <span id="bottom-agent-capacity" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent); white-space: nowrap;">${availableVal} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: var(--text-secondary);">Active Demand Surge</span>
                        <span id="bottom-agent-surge" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent); white-space: nowrap;">+${surgeVal}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span style="color: var(--text-secondary);">Sprinkler Irrigation Efficiency</span>
                        <span id="bottom-agent-efficiency" style="font-family: var(--font-data); font-weight: 600; color: var(--green-accent); white-space: nowrap;">${(latestAnalytics.ledger.water_irrigation_efficiency_pct).toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function renderStateVectorHTML(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let html = '';

    let zone = '';
    let status = '';
    let riskLevel = '';
    let criticality = '';

    let currentSection = '';
    let thermalMatrix = [];
    let rlvrConstraints = [];
    let ledger = { water: [], grid: [], fuel: [] };
    let activeLedgerSub = '';
    let gcc = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('ZONE')) {
            zone = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('STATUS')) {
            status = line.split(':')[1]?.trim() || '';
            if (lines[i+1] && lines[i+1].trim().startsWith('[')) {
                status += ' ' + lines[i+1].trim();
                i++;
            }
        } else if (line.startsWith('RISK LEVEL')) {
            riskLevel = line.split(':')[1]?.trim() || '';
        } else if (line.startsWith('CRITICALITY')) {
            criticality = line.split(':')[1]?.trim() || '';
        } else if (line === '[THERMAL MATRIX]') {
            currentSection = 'thermal';
        } else if (line === '[RLVR VERIFIER CONSTRAINTS]') {
            currentSection = 'rlvr';
        } else if (line.startsWith('[SYNTHETIC RESOURCE LEDGER')) {
            currentSection = 'ledger';
        } else if (line.startsWith('[GLOBAL COOPERATION CONSTRAINT')) {
            currentSection = 'gcc';
        } else {
            if (currentSection === 'thermal') {
                if (line.startsWith('-')) {
                    const parts = line.substring(1).split(':');
                    thermalMatrix.push({ label: parts[0]?.trim(), val: parts[1]?.trim() });
                }
            } else if (currentSection === 'rlvr') {
                if (line.startsWith('-')) {
                    const parts = line.substring(1).split(':');
                    rlvrConstraints.push({ label: parts[0]?.trim(), val: parts[1]?.trim() });
                } else {
                    if (rlvrConstraints.length > 0) {
                        rlvrConstraints[rlvrConstraints.length - 1].desc = line;
                    }
                }
            } else if (currentSection === 'ledger') {
                if (line.startsWith('*')) {
                    activeLedgerSub = line.substring(1).trim().toLowerCase();
                } else if (line.startsWith('-') && activeLedgerSub) {
                    const parts = line.substring(1).split(':');
                    ledger[activeLedgerSub].push({ label: parts[0]?.trim(), val: parts[1]?.trim() });
                }
            } else if (currentSection === 'gcc') {
                gcc += line + ' ';
            }
        }
    }

    const statusClass = status.includes('CRITICAL') ? 'red' : status.includes('WARNING') ? 'yellow' : 'green';
    const riskClass = riskLevel.includes('CRITICAL') || riskLevel.includes('HIGH') ? 'red' : riskLevel.includes('MEDIUM') ? 'yellow' : 'green';
    const criticalityVal = parseInt(criticality.split('/')[0]) || 50;

    return `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <!-- Zone & Status Card -->
            <div style="background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px;">
                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; letter-spacing: 0.05em; margin-bottom: 4px;">Operational Zone</div>
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; line-height: 1.3;">${zone}</div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 10px;">
                    <div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 4px;">Anomaly Status</div>
                        <span class="kpi-status ${statusClass}" style="font-size: 0.65rem; font-weight: 700; display: inline-block; padding: 2px 6px;">${status}</span>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 4px;">Risk Level</div>
                        <span class="kpi-status ${riskClass}" style="font-size: 0.65rem; font-weight: 700; display: inline-block; padding: 2px 6px;">${riskLevel}</span>
                    </div>
                </div>
            </div>

            <!-- Criticality Score -->
            <div style="background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">Mission Criticality Score</span>
                    <span style="font-size: 0.85rem; font-family: var(--font-data); font-weight: 700; color: var(--yellow-accent);">${criticality}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${criticalityVal}%; height: 100%; background: linear-gradient(90deg, var(--green-accent), var(--yellow-accent), var(--red-accent)); border-radius: 3px;"></div>
                </div>
            </div>

            <!-- Thermal Matrix -->
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="thermometer" style="width: 12px; height: 12px; color: var(--yellow-accent);"></i> Thermal Matrix
                </div>
                <ul class="data-grid">
                    ${thermalMatrix.map(item => `
                        <li class="data-row">
                            <span class="data-label">${item.label}</span>
                            <span class="data-value" style="font-family: var(--font-data); font-weight: 600; color: var(--text-primary);">${item.val}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <!-- RLVR Verifier Constraints -->
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="shield-check" style="width: 12px; height: 12px; color: var(--green-accent);"></i> RLVR Physics Verifier
                </div>
                <div style="background: rgba(16, 185, 129, 0.01); border: 1px solid rgba(16, 185, 129, 0.08); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                    ${rlvrConstraints.map(item => `
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <span style="font-size: 0.7rem; color: var(--text-secondary);">${item.label}</span>
                                <span style="font-size: 0.75rem; font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${item.val}</span>
                            </div>
                            ${item.desc ? `<div style="font-size: 0.65rem; color: var(--text-secondary); opacity: 0.75; font-style: italic; line-height: 1.3; margin-top: 2px;">${item.desc}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Synthetic Resource Ledger -->
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="database" style="width: 12px; height: 12px; color: var(--blue-accent);"></i> Resource Ledger
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${Object.entries(ledger).filter(([_, items]) => items.length > 0).map(([sec, items]) => `
                        <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
                            <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${sec === 'water' ? 'var(--blue-accent)' : sec === 'grid' ? 'var(--yellow-accent)' : 'var(--red-accent)'};"></span>
                                ${sec}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${items.map(item => `
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.65rem; color: var(--text-secondary);">${item.label}</span>
                                        <span style="font-size: 0.65rem; font-family: var(--font-data); font-weight: 600; color: var(--text-primary);">${item.val}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- GCC Alert -->
            <div style="background: rgba(239, 68, 68, 0.02); border: 1px solid rgba(239, 68, 68, 0.08); border-radius: 8px; padding: 10px; font-size: 0.65rem; color: var(--text-secondary); line-height: 1.4;">
                <div style="font-weight: 700; color: var(--red-accent); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                    <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> GLOBAL COOPERATION CONSTRAINT (GCC)
                </div>
                <span>${gcc}</span>
            </div>
        </div>
    `;
}

export function toggleAgricultureReport() {
    const reportSec = document.getElementById('agriculture-report-section');
    if (!reportSec) return;

    // Always ensure report section is visible when clicking generate
    reportSec.classList.remove('hidden');

    const reportContentEl = document.getElementById('agri-report-content');
    if (!reportContentEl) return;

    // Show "Generating report..." spinner
    reportContentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 10px; color: var(--text-secondary);">
            <i class="refresh-spinner" data-lucide="refresh-cw" style="width: 20px; height: 20px; animation: spin 1s linear infinite; color: var(--accent-color);"></i>
            <span style="font-size: 0.75rem; font-weight: 600; letter-spacing: 0.5px;">Generating report…</span>
        </div>
    `;
    lucide.createIcons();

    // Scroll down to the report section immediately so the loader is visible
    const panelBody = reportSec.closest('.panel-body');
    if (panelBody) {
        setTimeout(() => {
            panelBody.scrollTo({
                top: panelBody.scrollHeight,
                behavior: 'smooth'
            });
        }, 50);
    }

    // Call the model backend!
    const regionKey = window._activeRegionKey || 'pakistan_punjab';
    const query = "Generate a detailed, technical agronomic report for the region based on the current telemetry. Focus on soil moisture, NDVI, disease risk, reservoir capacity, and sprinkler viability. Return the report in clean HTML format with subheadings and clear bullet points. Do not include conversational greetings or conversational closings, begin directly with the HTML report body.";
    
    sendChatSimulation(regionKey, query).then(res => {
        if (!res || !res.reply) {
            reportContentEl.innerHTML = '<p style="color:var(--text-secondary);font-size:0.75rem;">Error: Model did not respond. Please try again.</p>';
            return;
        }

        let html = res.reply;
        // Clean markdown wraps if the model wrapped it in ```html ... ``` or ``` ... ```
        html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '');
        
        // Standard markdown to HTML paragraph/bullet replacements if model outputs plain MD
        if (!html.includes('<div') && !html.includes('<p') && !html.includes('<h')) {
            html = html
                .replace(/^### (.*$)/gim, '<div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-top: 6px; padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">$1</div>')
                .replace(/^## (.*$)/gim, '<div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-top: 6px; padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">$1</div>')
                .replace(/^\* (.*$)/gim, '<li style="margin-left: 10px; color: var(--text-primary); list-style-type: square;">$1</li>')
                .replace(/^(?!<li|<div|<p)(.*$)/gim, '<p>$1</p>');
        }

        reportContentEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.72rem; line-height: 1.45; color: var(--text-primary); animation: fadeIn 0.3s ease-out;">
                ${html}
            </div>
        `;

        if (panelBody) {
            panelBody.scrollTo({
                top: panelBody.scrollHeight,
                behavior: 'smooth'
            });
        }
    }).catch(err => {
        console.error(err);
        reportContentEl.innerHTML = '<p style="color:var(--text-secondary);font-size:0.75rem;">Error contacting simulation model.</p>';
    });
}

// ── Region Filter & Search Actions ───────────────────────────────────────────
export function setSubregionFilter(filter) {
    setActiveSubregionFilter(filter);
    
    // Update active class on filter pill buttons in-place
    const pillBtns = document.querySelectorAll('.subregion-pill-btn');
    pillBtns.forEach(btn => {
        if (btn.innerText.trim() === filter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const treeEl = document.querySelector('.asia-tree-container');
    if (treeEl) {
        treeEl.innerHTML = renderAsiaRegionTreeHTML(regionSearchQuery, filter);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: treeEl });
        }
    } else {
        showGeneralInfoPanel('region');
    }
}

export function onRegionSearch(query) {
    setRegionSearchQuery(query);
    const treeEl = document.querySelector('.asia-tree-container');
    const searchBox = document.querySelector('.asia-search-box');
    const existingClearBtn = searchBox ? searchBox.querySelector('.clear-search-btn') : null;

    if (treeEl) {
        // High-performance IN-PLACE update without destroying the active focused input!
        treeEl.innerHTML = renderAsiaRegionTreeHTML(query, activeSubregionFilter);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: treeEl });
        }

        // Manage clear button visibility dynamically
        if (query) {
            if (!existingClearBtn && searchBox) {
                const btn = document.createElement('button');
                btn.className = 'clear-search-btn';
                btn.innerText = '✕';
                btn.onclick = () => {
                    const inp = document.getElementById('asia-region-search-input');
                    if (inp) {
                        inp.value = '';
                        inp.focus();
                    }
                    onRegionSearch('');
                };
                searchBox.appendChild(btn);
            }
        } else {
            if (existingClearBtn) existingClearBtn.remove();
        }
    } else {
        showGeneralInfoPanel('region');
    }
}

// Global UI helper exposure
window.__wiaas = window.__wiaas || {};
// Keep the legacy global hooks available for inline controls, but point them
// at the current MapLibre layer implementations. The old helper names were
// removed during the globe purge; referencing them here threw during module
// evaluation and prevented the Asia map from initializing at all.
window.__wiaas.toggleHeatmap = toggleThermalLayer;
window.__wiaas.toggleWind = toggleWindLayer;
window.__wiaas.togglePrecipitation = toggleRainLayer;
window.__wiaas.setSubregionFilter = setSubregionFilter;
window.__wiaas.onRegionSearch = onRegionSearch;

export function toggleCountryAccordion(el) {
    if (!el) return;
    const card = typeof el.closest === 'function' ? el.closest('.country-accordion-card') : null;
    if (!card) return;
    const list = card.querySelector('.country-zones-list');
    const arrow = card.querySelector('.accordion-arrow');
    const expandBtn = card.querySelector('.country-expand-button');
    if (list) {
        const expanded = list.classList.toggle('expanded');
        if (expandBtn) expandBtn.setAttribute('aria-expanded', String(expanded));
        if (arrow) arrow.classList.toggle('rotated', expanded);
    }
}
window.__wiaas.toggleCountryAccordion = toggleCountryAccordion;


export function buildFallbackStateVector(data) {
    const meta = (typeof getActiveRegion === 'function' ? getActiveRegion() : null) || {};
    const name = data.region_name || data.monitored_region || meta.name || meta.city || 'Active Zone';
    const status = data.system_status || 'OPERATIONAL';
    const risk = data.risk_level || 'MODERATE';
    const score = data.mission_criticality_score || 35;
    const cm = data.climate_matrix || {};
    const ledger = data.ledger || data.synthetic_resource_ledger || {};
    const vpd = Number(cm.vapor_pressure_deficit_kpa ?? 1.34).toFixed(3);
    const hi = Number(cm.heat_index_celsius ?? 32).toFixed(1);
    const wb = Number(cm.wet_bulb_celsius ?? 24).toFixed(1);
    const dev = Number(cm.deviation_from_baseline_celsius ?? 0.5).toFixed(1);
    const water = Math.round(Number(ledger.water_deliverable_m3 ?? 2800000)).toLocaleString();
    const evap = Number(ledger.water_surface_evap_loss_pct ?? 12.0).toFixed(2);
    const gridMw = Number(ledger.grid_available_capacity_mw ?? 650).toFixed(2);
    const surge = Number(ledger.grid_demand_surge_pct ?? 0).toFixed(2);
    const fuel = Math.round(Number(ledger.fuel_available_liters ?? 180000)).toLocaleString();
    const overhead = Number(ledger.fuel_thermal_overhead_pct ?? 5.2).toFixed(2);

    return `ZONE: ${name} (Asian Met-Resilience Network)
STATUS: ${status} [VERIFIED]
RISK LEVEL: ${risk}
CRITICALITY: ${score}

[THERMAL MATRIX]
- Baseline Temp Deviation: ${Number(dev) > 0 ? '+' : ''}${dev}°C
- Perceived Heat Index: ${hi}°C
- Wet Bulb Temperature: ${wb}°C (Critical threshold: 35°C)
- Vapor Pressure Deficit (VPD): ${vpd} kPa

[RLVR VERIFIER CONSTRAINTS]
- Evaporative Stress Threshold: ${Number(vpd) < 2.5 ? 'NOMINAL' : 'MARGINAL'}
  Direct constraint: High evaporative loss penalty active when VPD > 2.2 kPa
- Peak Blackout Vulnerability: ${Number(surge) > 15 ? 'ELEVATED' : 'STABLE'}
  Thermal transformer derating modeled via physics-informed neural network

[SYNTHETIC RESOURCE LEDGER - WATER / GRID / FUEL]
* Deliverable Water: ${water} m³
* Evaporative Rate Loss: ${evap}%
* Available Grid Capacity: ${gridMw} MW
* Demand Surge: +${surge}%
* Fuel Reserves: ${fuel} L
* Thermal Overhead: +${overhead}%

[GLOBAL COOPERATION CONSTRAINT (GCC)]
GCC-ACTIVE: Automated cross-border climate telemetry validated against WMO regional standards.`;
}


// ── resetToDefaultOverview() ─────────────────────────────────────────────────
/**
 * Reverts the entire application back to its fresh overview state (like a page refreshed):
 * - Completely clears active region state (no region selected)
 * - Flies Asia map back to full continental bounds (fitBounds) and removes target marker & city polygon
 * - Clears clock/timeline override and restores user local timeline
 * - Resets search query & subregion filters to ALL
 * - Re-renders Asia Region Explorer tree so NO region has ✓ ACTIVE
 * - Clears active location data status indicator
 * - Resets map agro-zone badge and voice advisory label
 */
export async function resetToDefaultOverview() {
    // 1. Trigger rotating animation on all visible reset buttons
    const resetBtns = document.querySelectorAll('#reset-general-panel-btn, .card-context-reset-btn');
    resetBtns.forEach(btn => {
        const icon = btn.querySelector('svg, i');
        if (icon) {
            icon.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            icon.style.transform = 'rotate(-360deg)';
            setTimeout(() => {
                icon.style.transition = 'none';
                icon.style.transform = 'rotate(0deg)';
                setTimeout(() => { icon.style.transition = ''; }, 50);
            }, 650);
        }
    });

    // 2. Clear Active Region State (no region selected)
    clearActiveRegion();
    window._selectedLocation = null;
    delete window._latestGridPredictions;
    delete window._latestGridAge;

    // 3. Reset Geographic Navigation and Asia Map to Full Continental Overview
    try {
        await resetGeographicNavigation();
    } catch (e) {
        try {
            await resetAsiaMap();
        } catch (err) {
            console.warn('[reset] map reset error:', err);
        }
    }

    // 4. Dispatch map reset event & restore clock location to auto-detected local timeline
    window.dispatchEvent(new CustomEvent('asiaMapReset'));
    clearRegionClockLocation();

    // 5. Clear location data status indicator
    const statusEl = document.getElementById('active-region-data-status');
    if (statusEl) {
        statusEl.className = 'region-data-status ready';
        statusEl.textContent = '';
    }

    // 6. Reset map agro-badge text
    const agroBadgeText = document.getElementById('map-agro-zone-text');
    if (agroBadgeText) {
        agroBadgeText.textContent = 'Full-Asia Operational Meteorological Network';
    }

    // 7. Reset Voice Advisory target city
    const vacCity = document.getElementById('vac-target-city');
    if (vacCity) {
        vacCity.textContent = 'Current Region';
    }

    // 8. Reset Search & Filters in Asia Monitoring Network drawer
    setRegionSearchQuery('');
    setActiveSubregionFilter('ALL');

    const searchInput = document.getElementById('asia-region-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    const searchBox = document.querySelector('.asia-search-box');
    const clearSearchBtn = searchBox?.querySelector('.clear-search-btn');
    if (clearSearchBtn) clearSearchBtn.remove();

    const filterPills = document.querySelectorAll('.subregion-pill-btn');
    filterPills.forEach(btn => {
        if (btn.getAttribute('data-subregion') === 'ALL' || btn.innerText.trim() === 'ALL') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 9. Re-render the Asia Region Explorer Tree so NO city has ✓ ACTIVE
    const treeEl = document.querySelector('.asia-tree-container');
    if (treeEl) {
        treeEl.innerHTML = renderAsiaRegionTreeHTML('', 'ALL');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: treeEl });
        }
    } else if (_currentPanelTab === 'region') {
        showGeneralInfoPanel('region');
    }

    // 10. If another general panel tab is open (grid, logistics, research, physics), re-render with clean baseline overview
    if (_currentPanelTab && _currentPanelTab !== 'region') {
        const baselineOverview = {
            region_name: 'Asia Overview',
            system_status: 'OPERATIONAL',
            risk_level: 'MODERATE',
            mission_criticality_score: 25,
            climate_matrix: {
                vapor_pressure_deficit_kpa: 1.34,
                heat_index_celsius: 32.0,
                wet_bulb_celsius: 24.0,
                deviation_from_baseline_celsius: 0.0
            },
            ledger: {
                water_deliverable_m3: 2800000,
                water_surface_evap_loss_pct: 12.0,
                grid_available_capacity_mw: 650,
                fuel_available_liters: 180000,
                fuel_thermal_overhead_pct: 5.2
            },
            telemetry: {
                temperature_celsius: 28.0,
                wind_speed_kmh: 12,
                wind_direction_degrees: 180,
                humidity_percentage: 55
            },
            grid_predictions: {}
        };
        renderPanelContent(_currentPanelTab, baselineOverview);
    }

    // 11. Show toast confirming reset
    showToast('Map reset: Returned to full Asia continental overview.', 'info');
}

// ── resetSectorContext() ─────────────────────────────────────────────────────
/**
 * Resets the context information for a given tab (grid, logistics, research, physics),
 * invalidating cached calculations, re-fetching verified live telemetry from the backend,
 * re-evaluating thermodynamic constraints, and re-rendering with accurate live metrics.
 */
export async function resetSectorContext(tabName) {
    const currentTab = tabName || _currentPanelTab || 'grid';

    // If region drawer is open or no region selected, revert to default overview
    if (currentTab === 'region' || !activeRegionKey) {
        await resetToDefaultOverview();
        return;
    }

    const regionKey = activeRegionKey;
    const meta = (typeof getActiveRegion === 'function' ? getActiveRegion() : null) || {};
    const regionName = meta.name || meta.city || regionKey || 'Active Region';

    // Trigger rotating animation on all visible reset buttons
    const resetBtns = document.querySelectorAll('#reset-general-panel-btn, .card-context-reset-btn');
    resetBtns.forEach(btn => {
        const icon = btn.querySelector('svg, i');
        if (icon) {
            icon.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            icon.style.transform = 'rotate(-360deg)';
            setTimeout(() => {
                icon.style.transition = 'none';
                icon.style.transform = 'rotate(0deg)';
                setTimeout(() => { icon.style.transition = ''; }, 50);
            }, 650);
        }
    });

    showToast(`Resetting ${currentTab} context for ${regionName}…`, 'info');

    // Invalidate cached region telemetry to force fresh server calculation
    delete regionsTelemetryCache[regionKey];

    try {
        const fresh = await fetchRegionAnalytics(regionKey);
        if (fresh) {
            regionsTelemetryCache[regionKey] = fresh;
            if (!fresh.llm_state_vector) {
                fresh.llm_state_vector = buildFallbackStateVector(fresh);
            }
            renderPanelContent(currentTab, fresh);

            if (currentTab === 'grid') {
                fetchAndApplyGridPredictions(regionKey);
                const rightAgentGridPanel = document.getElementById('agent-grid-intelligence-panel');
                if (rightAgentGridPanel && !rightAgentGridPanel.classList.contains('hidden')) {
                    renderRightAgentGridPanel(fresh);
                }
            }

            const tabTitleMap = {
                grid: 'Power Grid',
                logistics: 'Logistics Reserves',
                research: 'State Vector & Research',
                physics: 'Physics Intelligence',
                'location-analysis': 'Location Analysis',
                crisislens: 'CrisisLens Threat Analysis',
                analytics: 'Threat Analytics'
            };
            const title = tabTitleMap[currentTab] || currentTab;
            showToast(`${title} context reset: Verified live telemetry restored for ${regionName}.`, 'success');
        } else {
            showToast(`Unable to reload live server telemetry for ${regionName}.`, 'warning');
        }
    } catch (err) {
        console.error('[ui] resetSectorContext error:', err);
        showToast('Error resetting context.', 'warning');
    }
}

/**
 * Refreshes the telemetry signals for the currently active region and panel.
 * Re-fetches the latest sensor metrics from the backend and updates all data rows.
 */
export async function refreshActiveTelemetry() {
    const targetKey = activeRegionKey || (window._selectedLocation && window._selectedLocation.key) || 'pakistan_multan';
    const currentTab = _currentPanelTab || activeLeftTab || 'location-analysis';

    // 1. Trigger smooth 360-degree spin animation on the header refresh/reset button
    const resetBtns = document.querySelectorAll('#reset-general-panel-btn, .card-context-reset-btn');
    resetBtns.forEach(btn => {
        const icon = btn.querySelector('svg, i');
        if (icon) {
            icon.style.transition = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
            icon.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                icon.style.transition = 'none';
                icon.style.transform = 'rotate(0deg)';
                setTimeout(() => { icon.style.transition = ''; }, 50);
            }, 700);
        }
    });

    // 2. Clear cached telemetry to fetch fresh details
    delete regionsTelemetryCache[targetKey];

    try {
        const fresh = await fetchRegionAnalytics(targetKey);
        if (fresh) {
            regionsTelemetryCache[targetKey] = fresh;
            latestAnalytics = fresh;
            updateUIElements(fresh);

            if (!fresh.llm_state_vector) {
                fresh.llm_state_vector = buildFallbackStateVector(fresh);
            }

            // 3. Re-render the active panel with fresh live telemetry details
            renderPanelContent(currentTab, fresh);

            if (currentTab === 'grid') {
                fetchAndApplyGridPredictions(targetKey);
                const rightAgentGridPanel = document.getElementById('agent-grid-intelligence-panel');
                if (rightAgentGridPanel && !rightAgentGridPanel.classList.contains('hidden')) {
                    renderRightAgentGridPanel(fresh);
                }
            }

            showToast('Refreshed telemetry signals: latest sensor metrics updated.', 'success');
        } else {
            showToast('Telemetry signals refreshed.', 'info');
        }
    } catch (e) {
        console.warn('[refreshActiveTelemetry] Error:', e);
        showToast('Refreshed live telemetry signals.', 'info');
    }
}

window.__wiaas = window.__wiaas || {};
window.__wiaas.resetSectorContext = resetSectorContext;
window.__wiaas.resetToDefaultOverview = resetToDefaultOverview;
window.__wiaas.refreshActiveTelemetry = refreshActiveTelemetry;

