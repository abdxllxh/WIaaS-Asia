import { showToast } from './toast.js';
/**
 * ui-agriculture.js
 * Comprehensive Smart Agriculture UI module for WIaaS.
 * Renders:
 * 1. Diagnostics View (Agro-Zones, Spray Window, Soil Stratification, NDVI, Radar Chart)
 * 2. What-If Scenario Decision Simulator (Interactive Physics Sliders)
 * 3. On-device Plant Disease Scanner (MobileNetV2 / PlantVillage)
 * 4. Spoken Voice Advisory (Urdu/English Web Speech Synthesis)
 * 5. 2G Low-Bandwidth GSM SMS Dispatch Modal
 * 6. WhatsApp / Printable Advisory Card Modal
 * 7. Language Switcher (English / Urdu dual support)
 */

import {
    AGRO_ZONES_PAKISTAN,
    URDU_TRANSLATIONS,
    calculateSpraySafety,
    runWhatIfScenario,
    getSpokenAdvisoryText,
    getSmsPayload
} from './agro-intelligence.js';
import { updateChatLanguage } from './chat.js';
import { updateRadarChart } from './charts.js';
import { getActiveRegion, regionsRegistry, activeRegionKey } from './state.js';
import { hydrateDynamicMorphIcons } from './morph-icons.js';
import { renderPlantScanner } from './plant-scanner.js';

let currentSubView = 'diagnostics'; // 'diagnostics' | 'simulator' | 'scanner'
let currentLanguage = 'en'; // 'en' | 'ur'
let isVoicePlaying = false;
let currentSpeechUtterance = null;
let currentSimParams = {
    tempDeltaC: 0,
    irrigationDelayHours: 0,
    canalCutoffPct: 0
};

export function getLanguage() {
    return currentLanguage;
}

export function setLanguage(lang) {
    currentLanguage = lang;
    document.documentElement.setAttribute('lang', lang);
    if (lang === 'ur') {
        document.body.classList.add('urdu-mode');
        document.getElementById('lang-tag-en')?.classList.remove('active');
        document.getElementById('lang-tag-ur')?.classList.add('active');
    } else {
        document.body.classList.remove('urdu-mode');
        document.getElementById('lang-tag-en')?.classList.add('active');
        document.getElementById('lang-tag-ur')?.classList.remove('active');
    }

    // Translate all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang === 'ur' && URDU_TRANSLATIONS[key]) {
            el.innerText = URDU_TRANSLATIONS[key];
        } else if (lang === 'en') {
            el.innerText = key;
        }
    });

    // Re-render agriculture content
    if (window._latestAnalytics && window._selectedLocation) {
        renderAgriculturePanel(window._selectedLocation, window._latestAnalytics);
    }

    // Instantly synchronize chatbox language and messages
    updateChatLanguage(lang);
}

export function setAgricultureSubView(viewName) {
    currentSubView = viewName;
    document.querySelectorAll('.agri-subtab').forEach(tab => {
        if (tab.dataset.subview === viewName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (window._latestAnalytics && window._selectedLocation) {
        renderAgriculturePanel(window._selectedLocation, window._latestAnalytics);
    }
}

export function renderAgriculturePanel(location, analytics) {
    window._selectedLocation = location;
    window._latestAnalytics = analytics;

    const container = document.getElementById('agriculture-panel-content');
    if (!container) return;

    if (currentSubView === 'diagnostics') {
        renderDiagnosticsView(container, location, analytics);
    } else if (currentSubView === 'simulator') {
        renderSimulatorView(container, location, analytics);
    } else if (currentSubView === 'scanner') {
        renderPlantScanner(container, location, analytics, currentLanguage === 'ur');
    }

    const targetCityEl = document.getElementById('vac-target-city');
    if (targetCityEl) {
        targetCityEl.textContent = location?.city || location?.name || 'Active Region';
    }

    // Update Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderDiagnosticsView(container, location, analytics) {
    const isUrdu = currentLanguage === 'ur';
    const locKey = location?.id || 'pakistan_multan';
    const zoneInfo = AGRO_ZONES_PAKISTAN[locKey] || AGRO_ZONES_PAKISTAN['pakistan_multan'];
    const locName = location?.city || location?.name || 'Multan, Pakistan';

    const temp = analytics?.telemetry?.temperature_celsius ?? 36.5;
    const wind = analytics?.telemetry?.wind_speed_kmh ?? 12.4;
    const vpd = analytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 2.1;
    const ndvi = analytics?.crop_health_ndvi ?? 0.82;
    const soil = analytics?.soil_moisture_pct ?? 34.2;

    const sprayInfo = calculateSpraySafety(temp, wind, vpd);
    const sprayBadgeText = isUrdu ? sprayInfo.badgeUr : sprayInfo.badgeEn;
    const sprayReasonText = isUrdu ? sprayInfo.reasonUr : sprayInfo.reasonEn;

    // AI recommendation text
    const recText = isUrdu
        ? `زمین کی نمی اگلے 18 گھنٹوں میں 34 فیصد تک پہنچ جائے گی۔ سیکٹر 4B میں اسپرے اور آبپاشی روک دیں تاکہ پانی کا ضیاع نہ ہو۔`
        : `Soil saturation will reach maximum capacity in 18 hours due to micro front accumulation. Suspend automated irrigation in Sector 4B to minimize runoff.`;

    container.innerHTML = `
        <!-- Agro-Ecological Zone Card -->
        <div class="agro-zone-card">
            <div class="zone-card-head">
                <span class="zone-tag">AGRO-ECOLOGICAL ZONE</span>
                <span class="zone-status-badge">ZONE III-B</span>
            </div>
            <h4>${isUrdu ? zoneInfo.zoneNameUr : zoneInfo.zoneNameEn}</h4>
            <div class="zone-meta-row">
                <span class="zone-meta-lbl">${isUrdu ? 'اہم فصلیں:' : 'Major Crops:'}</span>
                <span class="zone-meta-val">${isUrdu ? zoneInfo.primaryCropsUr : zoneInfo.primaryCropsEn}</span>
            </div>
            <div class="zone-meta-row">
                <span class="zone-meta-lbl">${isUrdu ? 'زمین کی قسم:' : 'Soil Type:'}</span>
                <span class="zone-meta-val">${isUrdu ? zoneInfo.soilTypeUr : zoneInfo.soilTypeEn}</span>
            </div>
        </div>

        <!-- AI Recommendation Box -->
        <div class="ai-recommendation">
            <div class="rec-header">
                <div class="rec-title-group">
                    <i data-lucide="bot" class="rec-icon"></i>
                    <span>${isUrdu ? 'مصنوعی ذہانت کی سفارش' : 'AI RECOMMENDATION'}</span>
                </div>
                <button class="rec-share-btn" id="quick-share-advisory-btn" title="Export WhatsApp Advisory">
                    <i data-lucide="share-2"></i>
                    <span>${isUrdu ? 'ایکسپورٹ' : 'Export'}</span>
                </button>
            </div>
            <p class="rec-text" id="ai-recommendation-text">${recText}</p>
        </div>

        <!-- Spray Safety Window Card -->
        <div class="spray-safety-card">
            <div class="spray-header">
                <div class="spray-title-wrap">
                    <i data-lucide="wind" class="spray-icon"></i>
                    <span class="spray-title">${isUrdu ? 'زرعی اسپرے کی حفاظت' : 'Spray Safety Window'}</span>
                </div>
                <span class="spray-badge ${sprayInfo.status}">${sprayBadgeText}</span>
            </div>
            <div class="spray-bar-wrap">
                <div class="spray-bar-fill ${sprayInfo.status}" style="width: ${sprayInfo.score}%;"></div>
            </div>
            <p class="spray-reason">${sprayReasonText}</p>
        </div>

        <!-- KPI Section -->
        <div class="kpi-section">
            <div class="kpi-header">
                <span>${isUrdu ? 'اوسط فصل صحت انڈیکس' : 'Mean Crop Health Index'}</span>
                <i data-lucide="sparkles" class="kpi-spark"></i>
            </div>
            <div class="kpi-value-row">
                <span class="kpi-value" id="crop-health-value">${ndvi.toFixed(2)}</span>
                <span class="kpi-unit">NDVI</span>
            </div>
            <div class="kpi-status ${ndvi >= 0.7 ? 'green' : ndvi >= 0.4 ? 'yellow' : 'red'}" id="crop-health-status">
                ${isUrdu ? (ndvi >= 0.7 ? 'انتہائی زرخیز / صحت مند' : 'معتدل تناؤ') : (ndvi >= 0.7 ? 'Highly Productive' : 'Moderate Stress')}
            </div>
        </div>

        <!-- Soil Moisture Depth Stratification -->
        <div class="soil-depth-widget">
            <div class="soil-depth-header">
                <span class="soil-widget-title">${isUrdu ? 'زمین کی نمی کی تہیں' : 'Soil Moisture Stratification'}</span>
                <span class="soil-val-badge green">${soil.toFixed(1)}%</span>
            </div>
            <div class="soil-layers">
                <div class="soil-layer-row">
                    <span class="layer-name">${isUrdu ? 'اوپری مٹی (0-10cm)' : 'Topsoil (0-10cm)'}</span>
                    <div class="layer-bar-track"><div class="layer-bar-fill" style="width: ${Math.min(100, soil * 1.15)}%;"></div></div>
                    <span class="layer-pct">${Math.round(soil * 1.15)}%</span>
                </div>
                <div class="soil-layer-row">
                    <span class="layer-name">${isUrdu ? 'جڑ کا احاطہ (10-40cm)' : 'Root Zone (10-40cm)'}</span>
                    <div class="layer-bar-track"><div class="layer-bar-fill green" style="width: ${Math.min(100, soil * 0.95)}%;"></div></div>
                    <span class="layer-pct">${Math.round(soil * 0.95)}%</span>
                </div>
            </div>
        </div>

        <div class="chart-container">
            <canvas id="radarChart"></canvas>
        </div>

        <ul class="data-grid">
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'زمین کی نمی (0-30cm)' : 'Soil Moisture (0-30cm)'}</span>
                <span class="data-value green" id="soil-moisture-val">${soil.toFixed(1)}% (${isUrdu ? 'بہترین' : 'Optimal'})</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'پانی کی ضرورت' : 'Irrigation Demand'}</span>
                <span class="data-value" id="irrigation-demand-val">120 m³/hectare</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'بیماری و کیڑوں کا خطرہ' : 'Disease Risk Index'}</span>
                <span class="data-value green" id="disease-risk-val">${isUrdu ? 'کم (8%)' : 'Low (8%)'}</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'پانی کی قلت کا تناؤ' : 'Water Stress Index'}</span>
                <span class="data-value" id="water-stress-val">0.18 (${isUrdu ? 'معمول' : 'Nominal'})</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'کل ذخیرہ آب' : 'Gross Reservoir Storage'}</span>
                <span class="data-value green" id="gross-reservoir-val">3,800,000 m³</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'فراہمی کے قابل پانی' : 'Deliverable Water Volume'}</span>
                <span class="data-value green" id="deliverable-water-val">3,650,000 m³</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'بخاراتی اخراج کا نقصان' : 'Reservoir Evaporative Loss'}</span>
                <span class="data-value red" id="reservoir-evap-loss-val">3.4%</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'اسپرے آبپاشی کی موزونیت' : 'Overhead Irrigation Viability'}</span>
                <span class="data-value green" id="irrigation-viability-val">${isUrdu ? 'موزوں' : 'Viable'}</span>
            </li>
            <li class="data-row">
                <span class="data-label">${isUrdu ? 'پانی ضیاع کا جرمانہ' : 'Evaporative Waste Penalty'}</span>
                <span class="data-value green" id="waste-penalty-val">${isUrdu ? 'غیر فعال' : 'Inactive'}</span>
            </li>
        </ul>
    `;

    // Bind quick share button
    document.getElementById('quick-share-advisory-btn')?.addEventListener('click', openAdvisoryModal);

    // Render Crop Health Radar Chart immediately on the newly injected canvas
    const radarData = [
        Math.max(0.1, 0.85 - (vpd * 0.15)),
        parseFloat(ndvi.toFixed(2)),
        parseFloat((soil / 50.0).toFixed(2)),
        Math.max(0.2, 0.80 - ((0.85 - ndvi) * 0.5)),
        Math.max(0.3, 0.90 - (Math.abs(temp - 30) * 0.03)),
    ];
    requestAnimationFrame(() => {
        updateRadarChart(radarData, ndvi);
        hydrateDynamicMorphIcons(container);
    });
}

function renderSimulatorView(container, location, analytics) {
    const isUrdu = currentLanguage === 'ur';
    const res = runWhatIfScenario({
        tempDeltaC: currentSimParams.tempDeltaC,
        irrigationDelayHours: currentSimParams.irrigationDelayHours,
        canalCutoffPct: currentSimParams.canalCutoffPct,
        baseAnalytics: analytics
    });

    const riskClass = res.yieldRisk >= 50 ? 'red' : res.yieldRisk >= 25 ? 'yellow' : 'green';
    const riskLabel = isUrdu
        ? (res.yieldRisk >= 50 ? 'شدید خطرہ' : res.yieldRisk >= 25 ? 'درمیانہ خطرہ' : 'معمول کا خطرہ')
        : (res.yieldRisk >= 50 ? 'Severe Yield Loss' : res.yieldRisk >= 25 ? 'Moderate Stress' : 'Nominal Risk');

    container.innerHTML = `
        <div class="sim-intro-box">
            <i data-lucide="zap" class="sim-intro-icon"></i>
            <div>
                <h4 class="sim-intro-title">${isUrdu ? 'کسان فیصلہ سازی و موسمی سمیلیٹر' : 'Farmer Decision & Climate Simulator'}</h4>
                <p class="sim-intro-desc">${isUrdu ? 'شدید گرمی، نہری بندش اور تاخیر کے اثرات کا فوری جائزہ لیں۔' : 'Test crop resilience against heatwaves, water shortages, and irrigation shifts in real time.'}</p>
            </div>
        </div>

        <div class="sim-sliders-card">
            <div class="sim-slider-group">
                <div class="sim-slider-label-row">
                    <span>🌡️ ${isUrdu ? 'درجہ حرارت میں اضافہ' : 'Heatwave Temperature Spike'}</span>
                    <strong class="sim-val-pill" id="sim-temp-display">+${currentSimParams.tempDeltaC.toFixed(1)}°C</strong>
                </div>
                <input type="range" class="sim-slider" id="sim-temp-slider" min="0" max="6" step="0.5" value="${currentSimParams.tempDeltaC}">
            </div>

            <div class="sim-slider-group">
                <div class="sim-slider-label-row">
                    <span>⏱️ ${isUrdu ? 'آبپاشی میں تاخیر' : 'Irrigation Schedule Delay'}</span>
                    <strong class="sim-val-pill" id="sim-delay-display">${currentSimParams.irrigationDelayHours} ${isUrdu ? 'گھنٹے' : 'Hours'}</strong>
                </div>
                <input type="range" class="sim-slider" id="sim-delay-slider" min="0" max="48" step="6" value="${currentSimParams.irrigationDelayHours}">
            </div>

            <div class="sim-slider-group">
                <div class="sim-slider-label-row">
                    <span>💧 ${isUrdu ? 'نہری پانی کی کمی' : 'Canal Shortage / Cutoff'}</span>
                    <strong class="sim-val-pill" id="sim-canal-display">${currentSimParams.canalCutoffPct}%</strong>
                </div>
                <input type="range" class="sim-slider" id="sim-canal-slider" min="0" max="80" step="10" value="${currentSimParams.canalCutoffPct}">
            </div>
        </div>

        <div class="sim-results-grid">
            <div class="sim-result-card">
                <span class="sim-res-label">${isUrdu ? 'پیداوار نقصان کا خطرہ' : 'PROJECTED YIELD RISK'}</span>
                <span class="sim-res-value ${riskClass}" id="sim-yield-risk-val">${res.yieldRisk}%</span>
                <span class="sim-res-sub">${riskLabel}</span>
            </div>
            <div class="sim-result-card">
                <span class="sim-res-label">${isUrdu ? 'بخاراتی نقصان' : 'EVAPORATION LOSS'}</span>
                <span class="sim-res-value" id="sim-evap-loss-val">${res.evapLossPct}%</span>
                <span class="sim-res-sub">VPD: ${res.simVpd} kPa</span>
            </div>
            <div class="sim-result-card">
                <span class="sim-res-label">${isUrdu ? 'زمین کی نمی' : 'SIMULATED SOIL'}</span>
                <span class="sim-res-value ${res.simSoilMoisture < 20 ? 'red' : 'green'}" id="sim-soil-val">${res.simSoilMoisture}%</span>
                <span class="sim-res-sub">${isUrdu ? 'جڑ کا احاطہ' : 'Root Zone'}</span>
            </div>
            <div class="sim-result-card">
                <span class="sim-res-label">${isUrdu ? 'فصل انڈیکس' : 'PROJECTED NDVI'}</span>
                <span class="sim-res-value ${res.simNdvi < 0.5 ? 'red' : 'green'}" id="sim-ndvi-val">${res.simNdvi}</span>
                <span class="sim-res-sub">${isUrdu ? 'صحت انڈیکس' : 'Health Score'}</span>
            </div>
        </div>

        <div class="sim-mitigation-box">
            <div class="mit-header">
                <i data-lucide="shield-check"></i>
                <span>${isUrdu ? 'مجوزہ احتیاطی و حفاظتی حکمت عملی' : 'AI RECOMMENDED ACTION PLAN'}</span>
            </div>
            <p class="mit-text" id="sim-mitigation-text">${isUrdu ? res.mitigationUr : res.mitigationEn}</p>
        </div>

        <div class="sim-actions-row">
            <button class="sim-btn secondary" id="reset-sim-btn"><i data-lucide="rotate-ccw"></i> <span>${isUrdu ? 'ری سیٹ کریں' : 'Reset Scenario'}</span></button>
            <button class="sim-btn primary" id="apply-sim-plan-btn"><i data-lucide="check"></i> <span>${isUrdu ? 'حکمت عملی اپنائیں' : 'Adopt Mitigation Plan'}</span></button>
        </div>
    `;

    function updateSimCalculations() {
        const simRes = runWhatIfScenario({
            tempDeltaC: currentSimParams.tempDeltaC,
            irrigationDelayHours: currentSimParams.irrigationDelayHours,
            canalCutoffPct: currentSimParams.canalCutoffPct,
            baseAnalytics: analytics
        });

        const rClass = simRes.yieldRisk >= 50 ? 'red' : simRes.yieldRisk >= 25 ? 'yellow' : 'green';
        const rLabel = isUrdu
            ? (simRes.yieldRisk >= 50 ? '???? ????' : simRes.yieldRisk >= 25 ? '??????? ????' : '????? ?? ????')
            : (simRes.yieldRisk >= 50 ? 'Severe Yield Loss' : simRes.yieldRisk >= 25 ? 'Moderate Stress' : 'Nominal Risk');

        const tempDisplay = document.getElementById('sim-temp-display');
        if (tempDisplay) tempDisplay.textContent = `+${currentSimParams.tempDeltaC.toFixed(1)}?C`;

        const delayDisplay = document.getElementById('sim-delay-display');
        if (delayDisplay) delayDisplay.textContent = `${currentSimParams.irrigationDelayHours} ${isUrdu ? '?????' : 'Hours'}`;

        const canalDisplay = document.getElementById('sim-canal-display');
        if (canalDisplay) canalDisplay.textContent = `${currentSimParams.canalCutoffPct}%`;

        const yieldRiskVal = document.getElementById('sim-yield-risk-val');
        if (yieldRiskVal) {
            yieldRiskVal.textContent = `${simRes.yieldRisk}%`;
            yieldRiskVal.className = `sim-res-value ${rClass}`;
            if (yieldRiskVal.nextElementSibling) yieldRiskVal.nextElementSibling.textContent = rLabel;
        }

        const evapLossVal = document.getElementById('sim-evap-loss-val');
        if (evapLossVal) {
            evapLossVal.textContent = `${simRes.evapLossPct}%`;
            if (evapLossVal.nextElementSibling) evapLossVal.nextElementSibling.textContent = `VPD: ${simRes.simVpd} kPa`;
        }

        const soilVal = document.getElementById('sim-soil-val');
        if (soilVal) {
            soilVal.textContent = `${simRes.simSoilMoisture}%`;
            soilVal.className = `sim-res-value ${simRes.simSoilMoisture < 20 ? 'red' : 'green'}`;
        }

        const ndviVal = document.getElementById('sim-ndvi-val');
        if (ndviVal) {
            ndviVal.textContent = `${simRes.simNdvi}`;
            ndviVal.className = `sim-res-value ${simRes.simNdvi < 0.5 ? 'red' : 'green'}`;
        }

        const mitText = document.getElementById('sim-mitigation-text');
        if (mitText) mitText.textContent = isUrdu ? simRes.mitigationUr : simRes.mitigationEn;
    }

    // Bind slider events
    const tempSlider = document.getElementById('sim-temp-slider');
    const delaySlider = document.getElementById('sim-delay-slider');
    const canalSlider = document.getElementById('sim-canal-slider');

    tempSlider?.addEventListener('input', (e) => {
        currentSimParams.tempDeltaC = parseFloat(e.target.value);
        updateSimCalculations();
    });
    delaySlider?.addEventListener('input', (e) => {
        currentSimParams.irrigationDelayHours = parseInt(e.target.value);
        updateSimCalculations();
    });
    canalSlider?.addEventListener('input', (e) => {
        currentSimParams.canalCutoffPct = parseInt(e.target.value);
        updateSimCalculations();
    });

    document.getElementById('reset-sim-btn')?.addEventListener('click', () => {
        currentSimParams = { tempDeltaC: 0, irrigationDelayHours: 0, canalCutoffPct: 0 };
        renderSimulatorView(container, location, analytics);
    });

    document.getElementById('apply-sim-plan-btn')?.addEventListener('click', () => {
        showToast(isUrdu ? 'سفارشات کو کسان ایڈوائزری میں لاگو کر دیا گیا ہے۔' : 'Simulation mitigations adopted into Farmer Advisory queue.', 'success');
    });

    requestAnimationFrame(() => {
        hydrateDynamicMorphIcons(container);
    });
}

let _preloadedVoices = [];

export function initVoiceEngine() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        _preloadedVoices = window.speechSynthesis.getVoices() || [];
        window.speechSynthesis.onvoiceschanged = () => {
            _preloadedVoices = window.speechSynthesis.getVoices() || [];
        };
    }
}

// Auto-initialize voice engine
initVoiceEngine();

export async function getAvailableVoices() {
    if (!('speechSynthesis' in window)) return [];
    if (_preloadedVoices.length > 0) return _preloadedVoices;
    let voices = window.speechSynthesis.getVoices() || [];
    if (voices.length > 0) {
        _preloadedVoices = voices;
        return voices;
    }

    return new Promise((resolve) => {
        const handler = () => {
            const v = window.speechSynthesis.getVoices() || [];
            _preloadedVoices = v;
            resolve(v);
        };
        if ('onvoiceschanged' in window.speechSynthesis) {
            window.speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
        }
        setTimeout(() => {
            const v = window.speechSynthesis.getVoices() || [];
            _preloadedVoices = v;
            resolve(v);
        }, 250);
    });
}

export async function findBestHumanVoice(lang = 'en') {
    const voices = await getAvailableVoices();
    if (!voices.length) return null;

    if (lang === 'ur') {
        // Priority 1: Direct Urdu speech synthesis voice
        const urVoice = voices.find(v => (v.lang && v.lang.toLowerCase().startsWith('ur')) || (v.name && v.name.toLowerCase().includes('urdu')));
        if (urVoice) return urVoice;
        // Priority 2: High-grade Hindi/South Asian voice (which reads Urdu phonetically with natural human intonation)
        const hiVoice = voices.find(v => (v.lang && v.lang.toLowerCase().startsWith('hi')) || (v.name && (v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('kalpana') || v.name.toLowerCase().includes('neerja') || v.name.toLowerCase().includes('swara'))));
        if (hiVoice) return hiVoice;
        // Priority 3: Arabic / Persian voices (natural cadence for RTL/Perso-Arabic script)
        const arVoice = voices.find(v => v.lang && (v.lang.toLowerCase().startsWith('ar') || v.lang.toLowerCase().startsWith('fa')));
        if (arVoice) return arVoice;
        return voices[0];
    }

    // High quality English female / natural announcer voice (Zira, Jenny, Aria, Samantha, Google US English, etc.)
    const femaleNaturalVoice = voices.find(v => 
        (v.lang && v.lang.startsWith('en')) && (
            v.name.includes('Jenny') || 
            v.name.includes('Aria') || 
            v.name.includes('Samantha') || 
            v.name.includes('Zira') ||
            v.name.includes('Google US English') ||
            v.name.includes('Google UK English Female') ||
            v.name.includes('Victoria') ||
            v.name.includes('Karen') ||
            v.name.includes('Moira') ||
            v.name.includes('Natural') ||
            v.name.includes('Neural') ||
            v.name.includes('Online')
        )
    );
    if (femaleNaturalVoice) return femaleNaturalVoice;

    const anyEnFemale = voices.find(v => (v.lang && v.lang.startsWith('en')) && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman')));
    if (anyEnFemale) return anyEnFemale;

    const enVoice = voices.find(v => v.lang && v.lang.startsWith('en'));
    return enVoice || voices[0];
}

import { morphIconTo } from './morph-icons.js';

let currentAudioInstance = null;

function updateAdvisoryPlaybackUi(playing, lang = getLanguage() || 'en') {
    const audioWaves = document.getElementById('audio-waves');
    const voiceBtn = document.getElementById('voice-advisory-btn');
    const label = document.getElementById('voice-btn-label');
    isVoicePlaying = playing;
    audioWaves?.classList.toggle('active', playing);
    voiceBtn?.classList.toggle('playing', playing);
    voiceBtn?.setAttribute('aria-pressed', String(playing));
    voiceBtn?.setAttribute('aria-label', playing
        ? (lang === 'ur' ? 'صوتی مشورہ روکیں' : 'Stop Voice Advisory')
        : (lang === 'ur' ? 'صوتی مشورہ سنیں' : 'Play Voice Advisory'));
    if (label) label.textContent = playing ? (lang === 'ur' ? 'روکیں' : 'Stop') : (lang === 'ur' ? 'صوتی مشورہ' : 'Voice Advisory');
    morphIconTo(voiceBtn, playing ? 'volumeActive' : 'volume', playing ? 'bouncy' : 'snappy');
}

/**
 * Spoken Audio Advisory (Ultra-Realistic Neural Human Voice in Urdu & English)
 */
export async function toggleVoiceAdvisory() {
    const voiceBtn = document.getElementById('voice-advisory-btn');
    const activeLang = getLanguage() || currentLanguage || 'en';

    // Stop current speech/audio if already playing
    if (isVoicePlaying) {
        if (currentAudioInstance) {
            currentAudioInstance.pause();
            currentAudioInstance.currentTime = 0;
            currentAudioInstance = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        updateAdvisoryPlaybackUi(false, activeLang);
        return;
    }

    const text = getSpokenAdvisoryText(window._selectedLocation, window._latestAnalytics, activeLang);

    // Provide immediate UI feedback with morphing animated icon
    updateAdvisoryPlaybackUi(true, activeLang);

    try {
        // Fetch ultra-realistic Neural Studio Human Voice from backend
        const response = await fetch('/api/v1/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang: activeLang })
        });

        if (response.ok) {
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            currentAudioInstance = new Audio(audioUrl);

            currentAudioInstance.onended = () => {
                updateAdvisoryPlaybackUi(false, activeLang);
                URL.revokeObjectURL(audioUrl);
                currentAudioInstance = null;
            };

            currentAudioInstance.onerror = () => {
                updateAdvisoryPlaybackUi(false, activeLang);
                URL.revokeObjectURL(audioUrl);
                currentAudioInstance = null;
            };

            await currentAudioInstance.play();
            return;
        }
    } catch (err) {
        console.warn('[Neural TTS] Server speech unavailable, using browser synthesis fallback:', err);
    }

    // Graceful fallback to client SpeechSynthesis if server endpoint is unreachable
    if (!('speechSynthesis' in window)) {
        updateAdvisoryPlaybackUi(false, activeLang);
        showToast('Speech Synthesis API is not supported in this browser.', 'warning');
        return;
    }

    window.speechSynthesis.cancel();
    currentSpeechUtterance = new SpeechSynthesisUtterance(text);
    
    const voice = await findBestHumanVoice(activeLang);
    if (voice) {
        currentSpeechUtterance.voice = voice;
    }

    currentSpeechUtterance.rate = activeLang === 'ur' ? 0.88 : 0.92;
    currentSpeechUtterance.pitch = activeLang === 'ur' ? 1.05 : 1.02;
    currentSpeechUtterance.lang = activeLang === 'ur' ? 'ur-PK' : 'en-US';

    currentSpeechUtterance.onstart = () => {
        updateAdvisoryPlaybackUi(true, activeLang);
    };

    currentSpeechUtterance.onend = () => {
        updateAdvisoryPlaybackUi(false, activeLang);
    };

    currentSpeechUtterance.onerror = () => {
        updateAdvisoryPlaybackUi(false, activeLang);
    };

    window.speechSynthesis.speak(currentSpeechUtterance);
}

/**
 * SMS Modal Simulator
 */
export function openSmsModal() {
    const modal = document.getElementById('sms-modal');
    if (!modal) return;

    const payload = getSmsPayload(window._selectedLocation, window._latestAnalytics);
    const smsUr = document.getElementById('sms-text-ur');
    const smsEn = document.getElementById('sms-text-en');
    const timeEl = document.getElementById('sms-timestamp');

    if (smsUr) smsUr.innerHTML = payload.textUr.replace(/\n/g, '<br>');
    if (smsEn) smsEn.innerHTML = payload.textEn.replace(/\n/g, '<br>');
    if (timeEl) timeEl.innerText = `${payload.timestamp} · 2G Priority Broadcast`;

    modal.classList.remove('hidden');
}

export function closeSmsModal() {
    document.getElementById('sms-modal')?.classList.add('hidden');
}

/**
 * Generates rich, highly-detailed, mandatory agricultural and resilience directives
 * calibrated to the exact city, provincial microclimate, and physical sensor telemetry.
 */
export function generateCityActionDirectives(city, country, province, analytics) {
    const cityName = String(city || '').toLowerCase();
    const countryName = String(country || '').toLowerCase();
    const temp = Number(analytics?.telemetry?.temperature_celsius ?? 35);
    const humidity = Number(analytics?.telemetry?.humidity_percentage ?? 55);
    const vpd = Number(analytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 1.4);
    const wind = Number(analytics?.telemetry?.wind_speed_kmh ?? 12);
    const soil = Number(analytics?.soil_moisture_pct ?? 30);
    const ndvi = Number(analytics?.crop_health_ndvi ?? 0.75);

    // 1. Karachi / Coastal Sindh
    if (cityName.includes('karachi') || (countryName.includes('pakistan') && (cityName.includes('thatta') || cityName.includes('badin')))) {
        return [
            { iconName: 'waves', theme: 'cyan', title: 'Coastal Maritime Humidity & Fungal Blight Control', text: `Ambient humidity is elevated at ${humidity}%. High relative humidity combined with sea-breezes (${wind} km/h) creates critical downy mildew infection pressure. Delay systemic fungicide spraying until early morning window (06:00–08:30) when leaf surface moisture dries.` },
            { iconName: 'droplets', theme: 'blue', title: 'Saline-Resistant Sub-Irrigation & Tidal Drainage', text: `Soil moisture saturation is ${soil.toFixed(1)}%. Tidal estuary backflow increases rhizosphere salinity. Restrict surface canal flood cycles and utilize deep furrow flushing during outgoing tidal window to flush root-zone salts.` },
            { iconName: 'zap', theme: 'amber', title: 'Urban Coastal Grid & Cold-Storage Protection', text: `Urban heat island and cooling demand surges will stress regional feeders. Run auxiliary diesel generators for commercial poultry sheds and horticultural cold storage between 18:00 and 22:00 peak grid stress hours.` },
            { iconName: 'shield-alert', theme: 'red', title: 'Mandatory Municipal & Farm Flood Gate Protocol', text: `Inspect Malir, Lyari, and Hub agricultural catchment flood-gates. Secure greenhouse polyethylene covers against gusty southwesterly wind gusts exceeding ${Math.round(wind * 1.3)} km/h.` }
        ];
    }

    // 2. Multan & Southern Punjab (Cotton, Mango, Citrus)
    if (cityName.includes('multan') || cityName.includes('bahawalpur') || cityName.includes('khanewal') || cityName.includes('lodhran')) {
        return [
            { iconName: 'droplets', theme: 'blue', title: 'Anti-Evaporative Furrow Irrigation Schedule', text: `Vapor Pressure Deficit is extreme at ${vpd.toFixed(3)} kPa with daytime temperature peaking at ${temp.toFixed(1)}°C. Daytime overhead sprinkler or flood irrigation will suffer over 28% instantaneous evaporative loss. Mandatory shift: Run tube-wells exclusively during the night window (21:30–05:30) to maximize root percolation.` },
            { iconName: 'shield-alert', theme: 'amber', title: 'Cotton Whitefly & Mango Hopper Perimeter Defense', text: `High cumulative degree-days accelerate whitefly nymph reproduction cycles in Kharif cotton. Conduct perimeter field scouting at dawn. Apply targeted neem-derived bio-pesticide only if wind velocity is below 12 km/h; suspend all aerial spraying if midday thermal updrafts develop.` },
            { iconName: 'sun', theme: 'orange', title: 'Foliar Anti-Transpirant & Canopy Heat-Shield', text: `Canopy transpiration stress index is high. Apply 2% potassium nitrate or calcium silicate foliar mist to prevent premature fruit shedding in citrus orchards and square-dropping in cotton belts.` },
            { iconName: 'zap', theme: 'amber', title: 'Grid Load-Shedding & Pumping Energy Rationing', text: `Stagger agricultural tube-well start sequences across three-phase distribution lines to prevent transformer thermal tripouts during 17:00–21:00 peak grid demand.` }
        ];
    }

    // 3. Lahore, Gujranwala, Faisalabad, Sialkot (Central Punjab Canal & Rice/Wheat Basin)
    if (cityName.includes('lahore') || cityName.includes('faisalabad') || cityName.includes('gujranwala') || cityName.includes('sialkot') || cityName.includes('sheikhupura')) {
        return [
            { iconName: 'sprout', theme: 'green', title: 'Basmati Paddy Standing Water Regulation', text: `Maintain exactly 5–7 cm standing water layer in basmati rice nurseries. Do not drain fields during midday heat spikes to buffer soil root temperatures against thermal shock.` },
            { iconName: 'wind', theme: 'purple', title: 'Atmospheric Inversion & Agro-Smog Precursor Mitigation', text: `Inversion layer ceiling is projected below 450m tonight. Strict zero-burning protocol for crop residue; implement zero-tillage seed drills or shredding to avoid heavy particulate accumulation and local air quality degradation.` },
            { iconName: 'shield-check', theme: 'cyan', title: 'Stem Borer & Leaf Folder Targeted Intervention', text: `Scout for yellow stem borer egg masses on paddy leaves. Spray safe window is active from 06:00 to 09:00 AM before surface wind velocity exceeds ${wind} km/h.` },
            { iconName: 'zap', theme: 'amber', title: 'Canal Lift Pumping & Off-Peak Power Scheduling', text: `Schedule electric lift pumps during off-peak night tariff window (22:00 to 06:00) to reduce irrigation expenditure by 34% while relieving grid overload.` }
        ];
    }

    // 4. Rawalpindi / Islamabad / Potohar (Rainfed Pothohar Plateau)
    if (cityName.includes('rawalpindi') || cityName.includes('islamabad') || cityName.includes('chakwal') || cityName.includes('attock') || cityName.includes('potohar')) {
        return [
            { iconName: 'cloud-rain', theme: 'blue', title: 'Rainwater Harvesting & Check-Dam Conservation', text: `Barani rainfed soils require immediate soil moisture retention. Clear silt traps in small farm dams and contour bunds to capture incoming precipitation runoff without sheet erosion.` },
            { iconName: 'sprout', theme: 'green', title: 'Groundnut & Pulses Moisture Deficit Monitoring', text: `Soil moisture is at ${soil.toFixed(1)}%. Apply organic straw mulching on inter-row crops to reduce direct solar soil desiccation under current ${temp.toFixed(1)}°C conditions.` },
            { iconName: 'sun', theme: 'amber', title: 'Solar Pumping Inverter Thermal Cutoff Check', text: `Ensure solar inverter cooling fans and dust filters are cleared; excessive ambient temperatures will derate photovoltaic pumping yield by up to 18%.` },
            { iconName: 'shield-alert', theme: 'red', title: 'Erosion Control on Sloped Terraces', text: `Reinforce terrace stone risers on hillside plots to buffer against flash storm runoff gusts exceeding ${wind} km/h.` }
        ];
    }

    // 5. Tokyo, Osaka, Kyoto, Yokohama (Japan Maritime & Precision Agri)
    if (countryName.includes('japan') || cityName.includes('tokyo') || cityName.includes('osaka') || cityName.includes('kyoto')) {
        return [
            { iconName: 'wind', theme: 'blue', title: 'Typhoon Wind Shear & Greenhouse Anchoring', text: `Maritime low-pressure front generates localized wind vectors up to ${wind} km/h. Inspect automated polycarbonate roof panels, tighten bracing cables, and test emergency generator backup for hydro-cooling systems.` },
            { iconName: 'droplets', theme: 'cyan', title: 'Hydroponic Nutrient EC & Solution Temperature', text: `High solar radiation index increases plant transpirational uptake. Dilute nutrient solution electrical conductivity (EC) by 15% and maintain root bath temperature below 22°C to prevent root rot (pythium).` },
            { iconName: 'zap', theme: 'amber', title: 'Peak Smart-Grid Demand Response & BTM Batteries', text: `Activate behind-the-meter battery storage to offset automated greenhouse cooling during Tokyo metropolitan grid peak hours (13:00–16:00).` },
            { iconName: 'shield-alert', theme: 'red', title: 'Terraced Field Drainage & Debris Clearing', text: `Clear hillside catchment channels and concrete diversion weirs to prevent mud accumulation in suburban organic vegetable plots.` }
        ];
    }

    // 6. Beijing, Hebei, Shandong, Henan (China North Plain Breadbasket)
    if (countryName.includes('china') || cityName.includes('beijing') || cityName.includes('shanghai') || cityName.includes('zhengzhou')) {
        return [
            { iconName: 'droplets', theme: 'blue', title: 'Capillary Soil Moisture Preservation & Drip Regimes', text: `Vapor Pressure Deficit is ${vpd.toFixed(2)} kPa across continental plain soils. Run variable-rate center pivot drip systems during night hours to conserve ground moisture and stop crusting.` },
            { iconName: 'wind', theme: 'cyan', title: 'Windbreak Shelterbelt & Evaporation Buffer', text: `Northwesterly continental air currents at ${wind} km/h increase desiccation rate. Deploy windbreak shade nettings and maintain ground cover crops to prevent topsoil loss.` },
            { iconName: 'cpu', theme: 'amber', title: 'Automated Grain Storage Silo Aeration', text: `Activate grain elevator dehumidifiers and monitor thermal cables across bulk storage bins; keep interior temperature below 20°C to prevent pest infestation.` },
            { iconName: 'activity', theme: 'green', title: 'Smart Sensor Node Network Calibration', text: `Re-zero LoRaWAN soil moisture probes and verify telemetry ping intervals to match 1-second autonomous monitoring cycle.` }
        ];
    }

    // 7. Sylhet, Dhaka, Chittagong (Bangladesh Delta & Monsoon Tea Basin)
    if (countryName.includes('bangladesh') || cityName.includes('sylhet') || cityName.includes('dhaka') || cityName.includes('chittagong')) {
        return [
            { iconName: 'waves', theme: 'blue', title: 'Monsoon Flash-Flood & River Basin Alert', text: `Surma-Kushiyara river basin telemetry indicates elevated flood surge risk. Immediately elevate chemical fertilizers, seed reserves, and mobile machinery onto raised earthen platforms (killas).` },
            { iconName: 'sprout', theme: 'green', title: 'Tea Estate Contour Drainage & Trench Clearing', text: `Heavy seasonal runoff saturation (${soil.toFixed(1)}%). Open perimeter contour trenches across tea garden slopes to prevent standing waterlogging and root rot.` },
            { iconName: 'shield', theme: 'amber', title: 'Fungicide Suspension during Precipitation Bands', text: `Suspend contact foliar sprays; active rainbands will wash off agrochemicals within 30 minutes. Reschedule to post-precipitation calm windows.` },
            { iconName: 'zap', theme: 'cyan', title: 'Solar Mini-Grid Waterproofing & Inverter Protection', text: `Verify elevated battery housings and waterproof seals on all rural mini-grid installations against monsoon inundation.` }
        ];
    }

    // 8. Delhi, Punjab (India), Haryana, Uttar Pradesh
    if (countryName.includes('india') || cityName.includes('delhi') || cityName.includes('mumbai') || cityName.includes('chandigarh')) {
        return [
            { iconName: 'sun', theme: 'orange', title: 'Heat Dome Thermal Mitigation & Micro-Sprinkler Pulsing', text: `Extreme heat index (${temp.toFixed(1)}°C) creates critical transpiration deficit. Pulse micro-sprinklers for 10 minutes every 2 hours between 11:00 and 15:00 to reduce canopy ambient temperature by up to 4°C.` },
            { iconName: 'zap', theme: 'amber', title: 'Discom Feeder Balancing & Solar Pumping', text: `Agricultural feeder voltage fluctuations expected. Utilize automatic voltage regulators on tube-well motors and shift irrigation to early morning (04:00–08:00).` },
            { iconName: 'sprout', theme: 'green', title: 'Kharif Crop Pest Scouting & Protective Spray', text: `Scout for fall armyworm in maize and whitefly in cotton. Maintain spray safe window before 09:30 AM when surface winds remain below ${wind} km/h.` },
            { iconName: 'droplets', theme: 'blue', title: 'Groundwater Aquifer Depletion Protocol', text: `Regulate deep submersible borewell extraction; prioritize laser-leveled flood basins to maximize water use efficiency.` }
        ];
    }

    // 9. Generic Physics-Driven Dynamic Resilience Directives (for any other Asian city)
    const directives = [];
    if (vpd > 1.8 || temp > 36) {
        directives.push({ iconName: 'droplets', theme: 'blue', title: 'High Vapor Pressure Deficit (VPD) Mitigation', text: `Atmospheric VPD is elevated at ${vpd.toFixed(2)} kPa with temperature at ${temp.toFixed(1)}°C. Daytime water applications will evaporate rapidly. Restrict all irrigation to night or twilight hours (20:30–06:00) to guarantee deep root absorption.` });
    } else if (temp < 15) {
        directives.push({ iconName: 'thermometer', theme: 'cyan', title: 'Low-Temperature Crop Protection', text: `Ambient temperature is cold (${temp.toFixed(1)}°C). Deploy protective row covers or smoke blankets during night hours to insulate sensitive vegetative growth against ground frost.` });
    } else {
        directives.push({ iconName: 'sprout', theme: 'green', title: 'Optimal Transpiration Assimilation Window', text: `Vapor Pressure Deficit (${vpd.toFixed(2)} kPa) and temperature (${temp.toFixed(1)}°C) are within prime photosynthetic assimilation range. Continue standard scheduled irrigation cycles.` });
    }

    if (wind > 18) {
        directives.push({ iconName: 'wind', theme: 'amber', title: 'High-Wind Spraying Suspension', text: `Current wind velocity (${wind} km/h) exceeds the critical 15 km/h spray drift threshold. Suspend all pesticide and herbicide spraying immediately to prevent chemical drift and chemical waste.` });
    } else {
        directives.push({ iconName: 'shield-check', theme: 'cyan', title: 'Safe Chemical Spray Window Active', text: `Wind speeds are calm (${wind} km/h) and temperature allows stable chemical application. Prime window: next 4 hours.` });
    }

    if (soil < 25) {
        directives.push({ iconName: 'droplets', theme: 'red', title: 'Soil Moisture Deficit Warning', text: `Soil moisture is depleted to ${soil.toFixed(1)}%. Initiate supplementary root-zone irrigation to prevent irreversible crop wilting and vegetative stress.` });
    } else if (soil > 55) {
        directives.push({ iconName: 'waves', theme: 'blue', title: 'Root Asphyxiation & Waterlogging Alert', text: `Soil saturation is high (${soil.toFixed(1)}%). Cease additional watering and open perimeter drainage ditches to ensure aeration around root crowns.` });
    } else {
        directives.push({ iconName: 'check-circle', theme: 'green', title: 'Soil Water Saturation Balanced', text: `Soil moisture is at a healthy ${soil.toFixed(1)}% saturation level. Maintain regular rotational interval.` });
    }

    directives.push({ iconName: 'zap', theme: 'amber', title: 'Power Grid Resilience & Equipment Duty Cycle', text: `Schedule high-amperage pumping and industrial cold-storage machinery outside peak municipal demand hours to ensure electrical stability.` });

    return directives;
}

/**
 * WhatsApp Shareable Advisory Card Modal
 */
export function openAdvisoryModal() {
    const modal = document.getElementById('advisory-modal');
    if (!modal) return;

    const loc = window._selectedLocation || getActiveRegion() || (regionsRegistry && regionsRegistry[activeRegionKey]) || {};
    const analytics = window._latestAnalytics || {};

    const city = loc.city || loc.name || 'Active Zone';
    const country = loc.country || 'Pakistan';
    const province = loc.province || '';
    const locKey = loc.key || loc.id || activeRegionKey;

    const regionEl = document.getElementById('adv-card-region');
    const zoneEl = document.getElementById('adv-card-zone');
    const sealEl = document.getElementById('adv-card-seal');
    const tempEl = document.getElementById('adv-card-temp');
    const soilEl = document.getElementById('adv-card-soil');
    const ndviEl = document.getElementById('adv-card-ndvi');
    const sprayEl = document.getElementById('adv-card-spray');
    const checklistEl = document.getElementById('adv-card-checklist');
    const poweredEl = document.getElementById('adv-card-powered');

    // 1. Dynamic Seal by Country (Professional Vector Shield Badge, Zero Flags)
    if (sealEl) {
        let sealTitle = 'NATIONAL CLIMATE RESILIENCE DIRECTIVE';
        if (country.toLowerCase().includes('pakistan')) sealTitle = 'PAKISTAN METEOROLOGICAL & SMART AGRI ADVISORY';
        else if (country.toLowerCase().includes('india')) sealTitle = 'NATIONAL AGROMET & DISASTER MITIGATION DIRECTIVE';
        else if (country.toLowerCase().includes('bangladesh')) sealTitle = 'BANGLADESH CLIMATE RESILIENCE & DELTA DIRECTIVE';
        else if (country.toLowerCase().includes('china')) sealTitle = 'CHINA METEOROLOGICAL AGRI-RESILIENCE BULLETIN';
        else if (country.toLowerCase().includes('japan')) sealTitle = 'JAPAN JMA METEOROLOGICAL DISASTER DIRECTIVE';
        else if (country.toLowerCase().includes('emirates') || country.toLowerCase().includes('saudi')) sealTitle = 'ARID CLIMATE & DESERT AGRO-COUNCIL';

        sealEl.innerHTML = `<i data-lucide="shield-check" style="width: 14px; height: 14px; margin-right: 5px;"></i><span>${sealTitle}</span>`;
    }

    // 2. Dynamic Region & Zone Hero
    if (regionEl) {
        regionEl.innerText = province ? `${city}, ${province} · ${country}` : `${city}, ${country}`;
    }

    if (zoneEl) {
        if (loc.climate_zone) {
            zoneEl.innerText = loc.climate_zone;
        } else {
            const pZone = AGRO_ZONES_PAKISTAN[locKey];
            zoneEl.innerText = pZone ? pZone.zoneNameEn : `${loc.asian_subregion || 'Asia'} Agro-Climatic Zone`;
        }
    }

    // 3. Telemetry Indicators
    const temp = Number(analytics?.telemetry?.temperature_celsius ?? 36.5);
    const soil = Number(analytics?.soil_moisture_pct ?? 32.4);
    const ndvi = Number(analytics?.crop_health_ndvi ?? 0.78);
    const wind = Number(analytics?.telemetry?.wind_speed_kmh ?? 14);
    const vpd = Number(analytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 1.85);

    if (tempEl) tempEl.innerText = `${temp.toFixed(1)}°C`;
    if (soilEl) soilEl.innerText = `${soil.toFixed(1)}%`;
    if (ndviEl) ndviEl.innerText = `${ndvi.toFixed(2)}`;

    const spray = calculateSpraySafety(temp, wind, vpd);
    if (sprayEl) {
        sprayEl.innerText = spray.badgeEn;
        sprayEl.className = `adv-m-val ${spray.status === 'safe' ? 'green' : spray.status === 'moderate' ? 'yellow' : 'red'}`;
    }

    // 4. City-Specific Mandatory Action Directives with High-Precision Vector Icons
    const directives = generateCityActionDirectives(city, country, province, analytics);
    window._currentDirectives = directives; // cached for WhatsApp copy

    if (checklistEl) {
        checklistEl.innerHTML = directives.map((d) => `
            <li class="adv-directive-item theme-${d.theme || 'cyan'}">
                <div class="adv-directive-icon">
                    <i data-lucide="${d.iconName || 'shield'}"></i>
                </div>
                <div class="adv-directive-content">
                    <strong class="adv-directive-title">${d.title}</strong>
                    <p class="adv-directive-text">${d.text}</p>
                </div>
            </li>
        `).join('');
    }

    if (poweredEl) {
        poweredEl.innerText = 'WIaaS Autonomous Climate Intelligence · National Met-Resilience Network';
    }

    modal.classList.remove('hidden');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: modal });
    }
    requestAnimationFrame(() => {
        hydrateDynamicMorphIcons(modal);
    });
}

export function closeAdvisoryModal() {
    document.getElementById('advisory-modal')?.classList.add('hidden');
}
