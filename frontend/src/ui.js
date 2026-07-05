/**
 * ui.js — DOM manipulation, panel switching, data rendering.
 * Handles all updateUIElements(), showGeneralInfoPanel(), animateMetrics(), etc.
 */

import {
    activeRegionKey,
    regionNames,
    regionOffsets,
    heatmapActive,
    windActive,
    precipitationActive,
} from './state.js';
import { updateRadarChart, pushTempPowerReading } from './charts.js';
import { toggleHeatmap, toggleWind, togglePrecipitation } from './globe.js';
import { fetchRegionAnalytics } from './api.js';

// ── updateUIElements() ───────────────────────────────────────────────────────
/**
 * Populates all DOM elements from a fresh API payload.
 * @param {Object} apiData - response from /analytics/{regionKey}
 */
export function updateUIElements(apiData) {
    // Region name
    const regionNameEl = document.getElementById('current-region-name');
    if (regionNameEl) regionNameEl.innerText = apiData.region_name;

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
    const penalty      = Math.max(0, climate.deviation_from_baseline_celsius * 0.05)
                       + Math.max(0, (climate.wet_bulb_celsius - 25) * 0.02);
    const healthIndex  = Math.max(0.12, 0.85 - penalty);
    document.getElementById('crop-health-value').innerText = healthIndex.toFixed(2);

    // Radar data
    const radarData = [
        Math.max(0.1, 0.85 - (climate.vapor_pressure_deficit_kpa * 0.15)),
        parseFloat(healthIndex.toFixed(2)),
        Math.max(0.1, 0.75 - (climate.vapor_pressure_deficit_kpa * 0.12)),
        Math.max(0.2, 0.80 - (penalty * 0.5)),
        Math.max(0.3, 0.90 - (climate.deviation_from_baseline_celsius * 0.03)),
    ];
    updateRadarChart(radarData, healthIndex);

    // Soil moisture
    const soilMoisturePct = (radarData[2] * 50).toFixed(1);
    const soilStatus      = soilMoisturePct > 35 ? 'Optimal' : (soilMoisturePct > 20 ? 'Adequate' : 'Critical Low');
    const soilEl = document.getElementById('soil-moisture-val');
    soilEl.innerText  = `${soilMoisturePct}% (${soilStatus})`;
    soilEl.className  = `data-value ${soilMoisturePct < 20 ? 'red' : (soilMoisturePct < 35 ? 'yellow' : 'green')}`;

    // Irrigation demand
    const demandVolume = Math.round(ledger.water_deliverable_m3 / 10000);
    document.getElementById('irrigation-demand-val').innerText = `${demandVolume} m³/hectare`;

    // Disease risk
    const diseaseRisk  = Math.round(telemetry.humidity_percentage * 0.4);
    const riskStatus   = diseaseRisk > 30 ? 'High' : (diseaseRisk > 15 ? 'Medium' : 'Low');
    const riskEl = document.getElementById('disease-risk-val');
    riskEl.innerText  = `${riskStatus} (${diseaseRisk}%)`;
    riskEl.className  = `data-value ${diseaseRisk > 30 ? 'red' : (diseaseRisk > 15 ? 'yellow' : 'green')}`;

    // Water stress
    const waterStressVal = (1.0 - ledger.water_irrigation_efficiency_pct / 100).toFixed(2);
    const stressStatus   = waterStressVal > 0.6 ? 'Severe' : (waterStressVal > 0.3 ? 'Moderate' : 'Nominal');
    const stressEl = document.getElementById('water-stress-val');
    stressEl.innerText  = `${waterStressVal} (${stressStatus})`;
    stressEl.className  = `data-value ${waterStressVal > 0.6 ? 'red' : (waterStressVal > 0.3 ? 'yellow' : 'green')}`;

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
        `Weather models processed for ${apiData.region_name}. System status matches ${apiData.system_status} with current temperature at ${telemetry.temperature_celsius}°C. Adjusting domain policies accordingly.`;
}

// ── showGeneralInfoPanel() ───────────────────────────────────────────────────
/**
 * Fetches current region data and renders one of the dynamic side panels.
 * @param {string} tabName - one of: globe-analysis | region | physics | grid | logistics | research
 */
export async function showGeneralInfoPanel(tabName) {
    try {
        const data = await fetchRegionAnalytics(activeRegionKey);
        if (!data) return;

        const titleEl   = document.getElementById('general-panel-title');
        const contentEl = document.getElementById('general-panel-content');
        const iconEl    = document.getElementById('general-panel-icon');

        document.getElementById('agriculture-panel').classList.add('hidden');
        document.getElementById('general-info-panel').classList.remove('hidden');
        document.getElementById('left-sidebar').classList.add('visible');

        let content = '';

        if (tabName === 'globe-analysis') {
            titleEl.innerText = 'Globe Analysis Layers';
            iconEl.setAttribute('data-lucide', 'layers');
            content = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Thermographic Heatmap</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Continental surface anomalies</p>
                        </div>
                        <input type="checkbox" id="heatmap-toggle" ${heatmapActive ? 'checked' : ''} onchange="window.__wiaas.toggleHeatmap()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Real-time Wind Flow</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Wind direction and speed vectors</p>
                        </div>
                        <input type="checkbox" id="wind-toggle" ${windActive ? 'checked' : ''} onchange="window.__wiaas.toggleWind()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Precipitation & Rain</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Relative humidity pulse indicators</p>
                        </div>
                        <input type="checkbox" id="rain-toggle" ${precipitationActive ? 'checked' : ''} onchange="window.__wiaas.togglePrecipitation()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Zone Signals</h4>
                        <ul class="data-grid">
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Current Temperature</span>
                                <span class="data-value" style="font-size: 0.8rem;">${data.telemetry.temperature_celsius}°C</span>
                            </li>
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Wind Velocity</span>
                                <span class="data-value" style="font-size: 0.8rem;">${data.telemetry.wind_speed_kmh} km/h @ ${data.telemetry.wind_direction_degrees}°</span>
                            </li>
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Relative Humidity</span>
                                <span class="data-value" style="font-size: 0.8rem;">${data.telemetry.humidity_percentage}%</span>
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
                                style="background: ${key === activeRegionKey ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)'};
                                       border: 1px solid ${key === activeRegionKey ? '#38bdf8' : 'var(--border-color)'};
                                       color: ${key === activeRegionKey ? 'var(--text-primary)' : 'var(--text-secondary)'};
                                       text-align: left; padding: 12px 16px; border-radius: 8px; cursor: pointer;
                                       font-family: var(--font-ui); font-size: 0.85rem; font-weight: 500; transition: all 0.2s;">
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
                        <span class="kpi-value">${data.climate_matrix.vapor_pressure_deficit_kpa}</span>
                        <span class="kpi-unit">kPa</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Heat Index</span>
                        <span class="data-value">${data.climate_matrix.heat_index_celsius}°C</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Wet-Bulb Temperature</span>
                        <span class="data-value">${data.climate_matrix.wet_bulb_celsius}°C</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Deviation from Baseline</span>
                        <span class="data-value ${data.climate_matrix.deviation_from_baseline_celsius > 0 ? 'red' : 'green'}">
                            +${data.climate_matrix.deviation_from_baseline_celsius}°C
                        </span>
                    </li>
                </ul>
            `;
        } else if (tabName === 'grid') {
            titleEl.innerText = 'Power Grid Status';
            iconEl.setAttribute('data-lucide', 'zap');
            content = `
                <div class="kpi-section">
                    <div class="kpi-header">Available Capacity</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${data.ledger.grid_available_capacity_mw}</span>
                        <span class="kpi-unit">MW</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Grid Demand Surge</span>
                        <span class="data-value red">+${data.ledger.grid_demand_surge_pct}%</span>
                    </li>
                </ul>
            `;
        } else if (tabName === 'logistics') {
            titleEl.innerText = 'Logistics Reserves';
            iconEl.setAttribute('data-lucide', 'truck');
            content = `
                <div class="kpi-section">
                    <div class="kpi-header">Available Fuel Reserves</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${data.ledger.fuel_available_liters.toLocaleString()}</span>
                        <span class="kpi-unit">Liters</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Thermal Fuel Overhead</span>
                        <span class="data-value red">+${data.ledger.fuel_thermal_overhead_pct}%</span>
                    </li>
                </ul>
            `;
        } else if (tabName === 'research') {
            titleEl.innerText = 'State Vector & Research';
            iconEl.setAttribute('data-lucide', 'microscope');
            content = `
                <div style="font-family: 'JetBrains Mono'; font-size: 0.7rem; white-space: pre-wrap;
                            background: rgba(0,0,0,0.4); border: 1px solid var(--border-color);
                            border-radius: 8px; padding: 10px; max-height: 250px; overflow-y: auto; color: #a5f3fc;">
${data.llm_state_vector}
                </div>
            `;
        }

        contentEl.innerHTML = content;
        lucide.createIcons();
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
    }, 2000);
}
