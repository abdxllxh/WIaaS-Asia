/**
 * ui.js — DOM manipulation, panel switching, data rendering.
 * Handles all updateUIElements(), showGeneralInfoPanel(), animateMetrics(), etc.
 */

import {
    activeRegionKey,
    regionNames,
    regionOffsets,
    regionsTelemetryCache,
    heatmapActive,
    windActive,
    precipitationActive,
    bottomPanelMode,
    activeLeftTab,
} from './state.js';
import { updateRadarChart, pushTempPowerReading, fluctuateVram } from './charts.js';
import { toggleHeatmap, toggleWind, togglePrecipitation } from './globe.js';
import { fetchRegionAnalytics, sendChatSimulation } from './api.js';

// ── Telemetry Animation & Visual Ticker ───────────────────────────────────────
let latestAnalytics = null;
let tickerStarted = false;

// ── AI Grid Prediction Polling ────────────────────────────────────────────────
// Polls /analytics/{region}/grid-predictions every 60s and updates the grid panel
// widgets with real AI model values instead of locally-computed approximations.
let _gridPredictionTimer = null;

async function fetchAndApplyGridPredictions(regionKey) {
    try {
        const res = await fetch(`/analytics/${regionKey}/grid-predictions`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.status !== 'ready') return;
        
        window._latestGridPredictions = json.predictions;
        window._latestGridAge = json.age_seconds;
        
        applyAIGridValues(json.predictions, json.age_seconds);
    } catch (e) {
        // silently ignore — backend may not be ready yet
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

    const agriBid = (data.ledger.grid_available_capacity_mw * 0.15).toFixed(2);
    const logisticsBid = (data.ledger.grid_available_capacity_mw * 0.05).toFixed(2);
    const civilBid = (data.ledger.grid_available_capacity_mw * 0.65).toFixed(2);

    panel.innerHTML = `
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent-color); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="cpu" style="width: 16px; height: 16px;"></i> AI MODEL PREDICTIONS: GLOBAL MONITOR
        </div>

        <!-- AI Model Verdict Box -->
        <div style="background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.12); border-radius: 8px; padding: 10px; font-size: 0.75rem; line-height: 1.35; margin-bottom: 12px; color: var(--text-primary);">
            <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px;">Grid Agent Verdict</div>
            <span id="ai-grid-summary-text" style="color: var(--text-secondary); font-style: italic;">Fetching from n8n AI Agent…</span>
            <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                <span class="kpi-status green" id="ai-grid-status-badge">PENDING</span>
                <span style="color: var(--text-secondary); font-size: 0.65rem;">Updated: <span id="ai-grid-prediction-age">—</span></span>
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
                <span id="ai-peak-blackout-risk-val" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">—</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Peak Risk Time</span>
                <span id="ai-peak-blackout-time-val" style="font-family: var(--font-data); font-weight: 700; color: var(--yellow-accent);">—</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Available Grid Capacity</span>
                <span id="ai-grid-capacity-val" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">—</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Grid Demand Surge</span>
                <span id="ai-grid-surge-val" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">—</span>
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
                cropHealthEl.innerText = (healthIndex + healthJitter).toFixed(6);
            }

            // 2. Soil Moisture
            const soilEl = document.getElementById('soil-moisture-val');
            if (soilEl) {
                const baseMoisture = latestAnalytics.soil_moisture_pct;
                const moistureJitter = Math.sin(seed * 1.8) * 0.02 + (Math.random() - 0.5) * 0.002;
                const soilVal = baseMoisture + moistureJitter;
                const soilStatus = soilVal > 35 ? 'Optimal' : (soilVal > 20 ? 'Adequate' : 'Critical Low');
                soilEl.innerText = `${soilVal.toFixed(5)}% (${soilStatus})`;
            }

            // 3. Irrigation Demand
            const irrigationEl = document.getElementById('irrigation-demand-val');
            if (irrigationEl) {
                const baseDemand = latestAnalytics.ledger.water_deliverable_m3 / 10000;
                const demandJitter = Math.cos(seed * 1.5) * 0.01 + (Math.random() - 0.5) * 0.0005;
                irrigationEl.innerText = `${(baseDemand + demandJitter).toFixed(5)} m³/hectare`;
            }

            // 4. Water Stress & Physical Water Ledger
            const stressEl = document.getElementById('water-stress-val');
            if (stressEl) {
                const baseStress = latestAnalytics.water_stress_index;
                const stressJitter = Math.sin(seed * 3.1) * 0.001 + (Math.random() - 0.5) * 0.0001;
                const stressVal = Math.max(0, baseStress + stressJitter);
                const stressStatus = stressVal > 0.6 ? 'Severe' : (stressVal > 0.3 ? 'Moderate' : 'Nominal');
                stressEl.innerText = `${stressVal.toFixed(6)} (${stressStatus})`;
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
                tickerTemp.innerText = `${temp.toFixed(6)}°C`;
            }
            const tickerWind = document.getElementById('ticker-wind-val');
            if (tickerWind) {
                const windSpd = Math.max(0, latestAnalytics.telemetry.wind_speed_kmh + windJitter);
                const windDir = (latestAnalytics.telemetry.wind_direction_degrees + (seed * 10) % 360) % 360;
                tickerWind.innerText = `${windSpd.toFixed(5)} km/h @ ${windDir.toFixed(3)}°`;
            }
            const tickerHumidity = document.getElementById('ticker-humidity-val');
            if (tickerHumidity) {
                const humid = Math.max(0, Math.min(100, latestAnalytics.telemetry.humidity_percentage + humidJitter));
                tickerHumidity.innerText = `${humid.toFixed(5)}%`;
            }

            // 6. Physics Tab
            const tickerVpd = document.getElementById('ticker-vpd-val');
            if (tickerVpd) {
                const vpd = Math.max(0, latestAnalytics.climate_matrix.vapor_pressure_deficit_kpa + vpdJitter);
                tickerVpd.innerText = vpd.toFixed(6);
            }
            const tickerHeatIndex = document.getElementById('ticker-heat-index-val');
            if (tickerHeatIndex) {
                const hi = latestAnalytics.climate_matrix.heat_index_celsius + tempJitter;
                tickerHeatIndex.innerText = `${hi.toFixed(6)}°C`;
            }
            const tickerWetBulb = document.getElementById('ticker-wet-bulb-val');
            if (tickerWetBulb) {
                const wb = latestAnalytics.climate_matrix.wet_bulb_celsius + tempJitter;
                tickerWetBulb.innerText = `${wb.toFixed(6)}°C`;
            }
            const tickerDeviation = document.getElementById('ticker-deviation-val');
            if (tickerDeviation) {
                const dev = latestAnalytics.climate_matrix.deviation_from_baseline_celsius + tempJitter;
                tickerDeviation.innerText = `${dev > 0 ? '+' : ''}${dev.toFixed(6)}°C`;
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
                tickerFuel.innerText = fuel.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4});
            }
            const tickerFuelOverhead = document.getElementById('ticker-fuel-overhead-val');
            if (tickerFuelOverhead) {
                const overhead = latestAnalytics.ledger.fuel_thermal_overhead_pct + capacityJitter * 0.02;
                tickerFuelOverhead.innerText = `+${overhead.toFixed(5)}%`;
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
    if (!tickerStarted) {
        tickerStarted = true;
        startVisualTicker();
    }

    // Region name with coordinates, diurnal cycle badge, and risk metrics
    const regionNameEl = document.getElementById('current-region-name');
    if (regionNameEl) {
        regionNameEl.innerText = `${apiData.region_name} (${apiData.latitude.toFixed(2)}°, ${apiData.longitude.toFixed(2)}°) [${apiData.diurnal_cycle}] | Risk: ${apiData.risk_level} (Score: ${apiData.mission_criticality_score})`;
    }

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
    document.getElementById('ai-recommendation-text').innerText = recommendation;

    // Chat system notification
    document.getElementById('system-notification-text').innerText =
        `Weather models processed for ${apiData.region_name}. System status matches ${apiData.system_status} with current temperature at ${telemetry.temperature_celsius}°C. Risk Level: ${apiData.risk_level} (Criticality Score: ${apiData.mission_criticality_score}/100). Adjusting domain policies accordingly.`;

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

// ── renderPanelContent() — shared by cache-hit and post-fetch paths ──────────
function renderPanelContent(tabName, data) {
    const titleEl   = document.getElementById('general-panel-title');
    const contentEl = document.getElementById('general-panel-content');
    const iconEl    = document.getElementById('general-panel-icon');
    if (!titleEl || !contentEl || !iconEl) return;

    let content = '';

    if (tabName === 'globe-analysis') {
        titleEl.innerText = 'Globe Analysis Layers';
        iconEl.setAttribute('data-lucide', 'layers');
        content = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-left: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Thermographic Heatmap</h4>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Continental surface anomalies</p>
                    </div>
                    <input type="checkbox" id="heatmap-toggle" ${heatmapActive ? 'checked' : ''} onchange="window.__wiaas.toggleHeatmap()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-left: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Real-time Wind Flow</h4>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Wind direction and speed vectors</p>
                    </div>
                    <input type="checkbox" id="wind-toggle" ${windActive ? 'checked' : ''} onchange="window.__wiaas.toggleWind()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-left: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Precipitation &amp; Rain</h4>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Relative humidity pulse indicators</p>
                    </div>
                    <input type="checkbox" id="rain-toggle" ${precipitationActive ? 'checked' : ''} onchange="window.__wiaas.togglePrecipitation()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                </div>
                <div style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Zone Signals</h4>
                    <ul class="data-grid">
                        <li class="data-row" style="padding: 10px 0;">
                            <span class="data-label" style="font-size: 0.8rem;">Current Temperature</span>
                            <span class="data-value" id="ticker-temp-val" style="font-size: 0.8rem;">${data.telemetry.temperature_celsius}°C</span>
                        </li>
                        <li class="data-row" style="padding: 10px 0;">
                            <span class="data-label" style="font-size: 0.8rem;">Wind Velocity</span>
                            <span class="data-value" id="ticker-wind-val" style="font-size: 0.8rem;">${data.telemetry.wind_speed_kmh} km/h @ ${data.telemetry.wind_direction_degrees}°</span>
                        </li>
                        <li class="data-row" style="padding: 10px 0;">
                            <span class="data-label" style="font-size: 0.8rem;">Relative Humidity</span>
                            <span class="data-value" id="ticker-humidity-val" style="font-size: 0.8rem;">${data.telemetry.humidity_percentage}%</span>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    } else if (tabName === 'region') {
        titleEl.innerText = 'Select Monitoring Region';
        iconEl.setAttribute('data-lucide', 'globe');
        content = `
            <div class="region-select-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                ${Object.entries(regionNames).map(([key, name]) => `
                    <button class="region-select-btn ${key === activeRegionKey ? 'active' : ''}"
                            onclick="window.__wiaas.selectActiveRegion('${key}')"
                            style="background: ${key === activeRegionKey ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)'};
                                   border: 1px solid ${key === activeRegionKey ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
                                   border-top: 1px solid ${key === activeRegionKey ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.12)'};
                                   border-left: 1px solid ${key === activeRegionKey ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'};
                                   color: ${key === activeRegionKey ? 'var(--text-primary)' : 'var(--text-secondary)'};
                                   text-align: left; padding: 12px 16px; border-radius: 8px; cursor: pointer;
                                   font-family: var(--font-ui); font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
                                   backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                                   box-shadow: ${key === activeRegionKey ? 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px rgba(56, 189, 248, 0.05)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 4px 12px rgba(0, 0, 0, 0.15)'};">
                         ${name}
                    </button>
                `).join('')}
            </div>
        `;
    } else if (tabName === 'physics') {
        titleEl.innerText = 'Physics Intelligence';
        iconEl.setAttribute('data-lucide', 'thermometer');
        content = `
            <div class="kpi-section">
                <div class="kpi-header">Vapor Pressure Deficit</div>
                <div class="kpi-value-row">
                    <span class="kpi-value" id="ticker-vpd-val">${data.climate_matrix.vapor_pressure_deficit_kpa}</span>
                    <span class="kpi-unit">kPa</span>
                </div>
            </div>
            <ul class="data-grid" style="margin-top: 15px;">
                <li class="data-row">
                    <span class="data-label">Heat Index</span>
                    <span class="data-value" id="ticker-heat-index-val">${data.climate_matrix.heat_index_celsius}°C</span>
                </li>
                <li class="data-row">
                    <span class="data-label">Wet-Bulb Temperature</span>
                    <span class="data-value" id="ticker-wet-bulb-val">${data.climate_matrix.wet_bulb_celsius}°C</span>
                </li>
                <li class="data-row">
                    <span class="data-label">Deviation from Baseline</span>
                    <span class="data-value ${data.climate_matrix.deviation_from_baseline_celsius > 0 ? 'red' : 'green'}" id="ticker-deviation-val">
                        +${data.climate_matrix.deviation_from_baseline_celsius}°C
                    </span>
                </li>
            </ul>
        `;
    } else if (tabName === 'grid') {
        titleEl.innerText = 'Power Grid Status';
        iconEl.setAttribute('data-lucide', 'zap');

        // Use physics values only as fallback labels; real values come from AI prediction cache
        const physicsCapacity = data.ledger.grid_available_capacity_mw.toFixed(2);

        content = `
            <div style="display: flex; flex-direction: column; gap: 16px;">

                <!-- AI Verdict Box -->
                <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 8px; padding: 12px; font-size: 0.75rem; color: var(--text-primary); line-height: 1.4;">
                    <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="cpu" style="width: 14px; height: 14px;"></i> AI GRID AGENT VERDICT
                    </div>
                    <span id="grid-verdict-text" style="color: var(--text-secondary); font-style: italic;">Fetching from n8n AI Agent…</span>
                    <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                        <span class="kpi-status green" id="grid-ai-status-badge">PENDING</span>
                        <span style="color: var(--text-secondary); font-size: 0.65rem;">Updated: <span id="grid-ai-age">—</span></span>
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
                    <span>Predicted Peak Risk: <strong id="grid-peak-risk-val" style="color: var(--red-accent);">—</strong> at <strong id="grid-peak-time-val">—</strong> local runtime.</span>
                </div>

                <!-- GNN Blackout Risk KPI (AI) -->
                <div class="kpi-section" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.01);">
                    <div class="kpi-header" style="font-size: 0.75rem; color: var(--text-secondary);">GNN Blackout Risk Probability (AI)</div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                        <span id="ticker-blackout-risk" style="font-family: var(--font-data); font-size: 1.25rem; font-weight: 700; color: var(--red-accent);">—</span>
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                            <div id="ticker-blackout-bar" style="width: 0%; height: 100%; background: var(--red-accent); transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                </div>

                <!-- Tickers (AI values) -->
                <ul class="data-grid">
                    <li class="data-row">
                        <span class="data-label">Peak Blackout Risk</span>
                        <span class="data-value red" id="grid-peak-risk-val-row">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Peak Risk Time</span>
                        <span class="data-value" id="grid-peak-time-val-row" style="color: var(--yellow-accent);">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Available Grid Capacity</span>
                        <span class="data-value green" id="ticker-grid-capacity-val">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Grid Demand Surge</span>
                        <span class="data-value red" id="ticker-grid-surge-val">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Thermal Overhead (AI)</span>
                        <span class="data-value red" id="ticker-thermal-overhead-val">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Physics Baseline Capacity</span>
                        <span class="data-value" style="opacity:0.5;">${physicsCapacity} MW</span>
                    </li>
                </ul>

            </div>
        `;

    } else if (tabName === 'logistics') {
        titleEl.innerText = 'Logistics Reserves';
        iconEl.setAttribute('data-lucide', 'truck');
        content = `
            <div class="kpi-section">
                <div class="kpi-header">Available Fuel Reserves</div>
                <div class="kpi-value-row">
                    <span class="kpi-value" id="ticker-fuel-val">${data.ledger.fuel_available_liters.toLocaleString()}</span>
                    <span class="kpi-unit">Liters</span>
                </div>
            </div>
            <ul class="data-grid" style="margin-top: 15px;">
                <li class="data-row">
                    <span class="data-label">Thermal Fuel Overhead</span>
                    <span class="data-value red" id="ticker-fuel-overhead-val">+${data.ledger.fuel_thermal_overhead_pct}%</span>
                </li>
            </ul>
        `;



    } else if (tabName === 'research') {
        titleEl.innerText = 'State Vector & Research';
        iconEl.setAttribute('data-lucide', 'microscope');
        content = `
            <div style="max-height: 650px; overflow-y: auto; padding-right: 5px;">
                ${renderStateVectorHTML(data.llm_state_vector)}
            </div>
        `;
    }

    contentEl.innerHTML = content;
    lucide.createIcons();

    // If grid predictions were already fetched, immediately apply them to the placeholders
    if (tabName === 'grid' && window._latestGridPredictions) {
        applyAIGridValues(window._latestGridPredictions, window._latestGridAge);
    }
}

// Tracks which tab triggered the most recent showGeneralInfoPanel call.
// The background fetch checks this before re-rendering — if the user has
// switched to a different tab by the time the response arrives the stale
// result is silently discarded instead of overwriting the current content.
let _currentPanelTab = null;

// ── showGeneralInfoPanel() ───────────────────────────────────────────────────
/**
 * Renders a side panel instantly from the telemetry cache, then silently
 * refreshes in the background so data stays up-to-date without blocking the UI.
 * @param {string} tabName - one of: globe-analysis | region | physics | grid | logistics | research
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

        const cached = regionsTelemetryCache[activeRegionKey];

        if (cached) {
            // Render instantly from cache
            renderPanelContent(tabName, cached);
        } else {
            // First ever load for this region — show a skeleton while we fetch
            const contentEl = document.getElementById('general-panel-content');
            if (contentEl) contentEl.innerHTML = '<p style="color:var(--text-secondary);font-size:0.8rem;">Loading data…</p>';
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
        if (!fresh) return;

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

// ── updateRegionTime() ───────────────────────────────────────────────────────
export function updateRegionTime() {
    const offset   = regionOffsets[activeRegionKey] ?? 0;
    const utc      = Date.now() + new Date().getTimezoneOffset() * 60000;
    const localTime = new Date(utc + 3600000 * offset);
    const timeStr  = localTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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

        document.getElementById('cpu-util-val').innerText   = `${cpuVal}%`;
        document.getElementById('vram-usage-val').innerText = `${vramVal} / 192 GB`;
        document.getElementById('inf-speed-val').innerText  = `${speedVal} T/s`;
        document.getElementById('latency-val').innerText    = `${latVal} ms`;
        document.getElementById('power-draw-val').innerText = `${powerVal} W`;

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
        titleEl.innerText = 'ROCm Multi-Agent Inference Details';
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
    const availableVal = latestAnalytics.ledger.grid_available_capacity_mw.toFixed(5);
    const surgeVal = latestAnalytics.ledger.grid_demand_surge_pct.toFixed(5);

    container.innerHTML = `
        <div style="display: flex; gap: 24px; padding: 10px 0; width: 100%;">
            <!-- Verdict Box -->
            <div style="flex: 1.2; background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; height: 130px;">
                <div>
                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent-color); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="info" style="width: 16px; height: 16px;"></i> ACTIVE AGENT STATUS &amp; VERDICT
                    </div>
                    <p style="font-size: 0.75rem; line-height: 1.4; color: var(--text-primary);" id="bottom-agent-verdict">${verdict}</p>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">
                    GNN Blackout Risk Probability: <span id="bottom-agent-blackout-prob" style="font-family: var(--font-data); font-weight: 700; color: var(--${riskColor}-accent);">${blackoutRisk.toFixed(4)}%</span>
                </div>
            </div>

            <!-- Agent Allocations -->
            <div style="flex: 1; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px; height: 130px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Multi-Agent Bandwidth Allocation
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Agri-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600;">${agriBid} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Logistics-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600;">${logisticsBid} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Regulator-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600;">${civilBid} MW</span>
                    </div>
                </div>
            </div>

            <!-- Telemetry Constraints -->
            <div style="flex: 1; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px; height: 130px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Telemetry Constraints
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Available Grid Capacity</span>
                        <span id="bottom-agent-capacity" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${availableVal} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Active Demand Surge</span>
                        <span id="bottom-agent-surge" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">+${surgeVal}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Sprinkler Irrigation Efficiency</span>
                        <span id="bottom-agent-efficiency" style="font-family: var(--font-data); font-weight: 600; color: var(--green-accent);">${(latestAnalytics.ledger.water_irrigation_efficiency_pct).toFixed(2)}%</span>
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

