/**
 * api.js — All HTTP requests to the WIaaS backend.
 * Single API service managing region catalogue, telemetry, and regional AI chat context.
 */

import {
    regionNames,
    regionsTelemetryCache,
    setRegionsRegistry,
    getActiveRegion,
    getRegionMetadata,
    activeRegionKey,
    regionsRegistry,
} from './state.js';
import { ASIA_COUNTRIES } from './asia-map-data.js';

const WIAAS_ASIA_WEBHOOK_URL = 'https://abdxllxh2002.app.n8n.cloud/webhook/wiaas-asia-agents';

export function detectMessageLanguage(message) {
    return /[\u0600-\u06ff]/.test(String(message || '')) ? 'ur' : 'en';
}

function buildRoutingQuery(message) {
    const text = String(message || '');
    if (detectMessageLanguage(text) !== 'ur') return text;
    const hints = [];
    if (/موسم|درجہ\s*حرارت|گرمی|سردی|ٹھنڈ|نمی|ہوا/.test(text)) hints.push('weather current conditions temperature');
    if (/بارش|سیلاب|طوفان/.test(text)) hints.push('rain flood storm risk');
    if (/زراعت|فصل|کاشت|آبپاشی|کسان/.test(text)) hints.push('agriculture crops irrigation');
    if (/بجلی|گرڈ|لوڈشیڈنگ|توانائی/.test(text)) hints.push('grid electricity demand');
    if (/سفر|ٹرانسپورٹ|راستہ|لاجسٹک/.test(text)) hints.push('logistics transport route');
    if (/خطرہ|بحران|آفت|آگ/.test(text)) hints.push('threat crisis disaster fire');
    if (/رپورٹ|تفصیلی|مکمل/.test(text)) hints.push('detailed comprehensive report');
    return hints.length ? hints.join(' ') : 'regional weather intelligence question';
}

function buildAvailableRegions() {
    return Object.entries(regionsRegistry || {})
        .filter(([, meta]) => meta && meta.asian_subregion !== 'Global Benchmarks')
        .map(([key, meta]) => ({
            key,
            name: meta.name || meta.city || key,
            city: meta.city || '',
            province: meta.province || '',
            country: meta.country || '',
            country_code: meta.country_code || meta.countryCode || '',
            asian_subregion: meta.asian_subregion || 'Asia',
            latitude: meta.latitude,
            longitude: meta.longitude,
            timezone: meta.timezone || meta.timeZone || '',
            location_type: meta.locationType || meta.location_type || 'city',
        }));
}

function normalizeLocationText(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function findMentionedRegion(message) {
    const query = ` ${normalizeLocationText(message)} `;
    if (!query.trim()) return null;
    let best = null;
    for (const [key, meta] of Object.entries(regionsRegistry || {})) {
        if (!meta || meta.asian_subregion === 'Global Benchmarks') continue;
        const labels = [meta.city, meta.name, meta.province, meta.country]
            .map(normalizeLocationText)
            .filter((label) => label.length >= 3);
        for (const label of labels) {
            if (!query.includes(` ${label} `) && !query.includes(` ${label},`) && !query.includes(`${label} `)) continue;
            const specificity = label.split(' ').length * 100 + label.length;
            const typeBoost = normalizeLocationText(meta.city) === label ? 1000 : normalizeLocationText(meta.name) === label ? 500 : 0;
            const score = specificity + typeBoost;
            if (!best || score > best.score) best = { key, meta, score };
        }
    }
    return best;
}

function metric(value, unit = '') {
    if (value === null || value === undefined || value === '') return 'دستیاب نہیں';
    const clean = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
    return `${clean}${unit}`;
}

function buildLocalUrduWiaas(data, regionContext, query) {
    const telemetry = data?.telemetry || data?.climate_matrix?.telemetry || {};
    const climate = data?.climate_matrix || {};
    const ledger = data?.ledger || data?.synthetic_resource_ledger || {};
    const place = regionContext.name || regionContext.city || regionContext.country || 'منتخب علاقہ';
    const risk = data?.risk_level || 'دستیاب نہیں';
    const lower = String(query || '');
    if (/زراعت|فصل|کاشت|آبپاشی|کسان/.test(lower)) {
        return [
            `میں نے ${place} کی تازہ زرعی معلومات دیکھ لی ہیں۔`, '',
            '**زرعی صورتحال**',
            `- وی پی ڈی: ${metric(climate.vapor_pressure_deficit_kpa, ' kPa')}`,
            `- بخاراتی نقصان: ${metric(ledger.water_surface_evap_loss_pct ?? climate.water_surface_evap_loss_pct, '%')}`,
            `- آبپاشی کی کارکردگی: ${metric(ledger.water_irrigation_efficiency_pct ?? climate.water_irrigation_efficiency_pct, '%')}`,
            `- علاقائی خطرہ: ${risk}`, '',
            '**اگلے اقدامات**',
            '1. آبپاشی بدلنے سے پہلے مٹی کی نمی چیک کریں۔',
            '2. سخت موسم میں کارکنوں اور مویشیوں کو محفوظ رکھیں۔',
            '3. بڑے فیصلے سے پہلے تفصیلی زرعی رپورٹ مانگیں۔', '',
            'کیا آپ فصل، آبپاشی یا اگلے موسمی دور کی مزید تفصیل چاہتے ہیں؟',
        ].join('\n');
    }
    return [
        `میں نے ${place} کی تازہ موسمی معلومات دیکھ لی ہیں۔`, '',
        '**موجودہ حالات**',
        `- درجہ حرارت: ${metric(telemetry.temperature_celsius, '°C')}`,
        `- نمی: ${metric(telemetry.humidity_percentage, '%')}`,
        `- ہیٹ انڈیکس: ${metric(climate.heat_index_celsius, '°C')}`,
        `- ہوا کی رفتار: ${metric(telemetry.wind_speed_kmh ?? telemetry.wind?.speed_kmh, ' km/h')}`,
        `- وی پی ڈی: ${metric(climate.vapor_pressure_deficit_kpa, ' kPa')}`,
        `- علاقائی خطرہ: ${risk}`, '',
        '**اس کا مطلب**',
        String(risk).toUpperCase() === 'LOW'
            ? 'دستیاب اشارے مجموعی طور پر مستحکم ہیں، تاہم آپ کے فوری مقام کی حالت مختلف ہو سکتی ہے۔'
            : 'موجودہ اشاروں کی وجہ سے مقامی حالات اور اگلی تازہ کاری پر نظر رکھنا ضروری ہے۔', '',
        '**اگلے مفید اقدامات**',
        '1. اپنے درست شہر کا انتخاب برقرار رکھیں۔',
        '2. مقامی سرکاری موسم اور حفاظتی ہدایات دیکھیں۔',
        '3. بتائیں کہ آپ کو ذاتی آرام، زراعت، بجلی یا سفر میں سے کس پہلو کی معلومات چاہیے۔',
    ].join('\n');
}

function buildLocalUrduCrisis(result, regionContext) {
    const raw = Array.isArray(result?.raw_data) ? result.raw_data[0] || {} : result?.raw_data || {};
    const severity = raw.overall_threat_level || result?.overall_threat_level || 'UNKNOWN';
    const correlation = raw.correlation_status || result?.correlation_status || 'UNKNOWN';
    const sources = raw.source_status?.successful || result?.source_status?.successful || [];
    const place = raw.region || result?.region || regionContext.name || regionContext.city || 'منتخب علاقہ';
    return [
        `میں نے ${place} کے تازہ علاقائی خطرات کا جائزہ لیا ہے۔`, '',
        '**خطرے کی سطح**',
        `- شدت: ${severity}`,
        `- شواہد کا باہمی تعلق: ${correlation}`, '',
        '**اس کا مطلب**',
        String(severity).toUpperCase() === 'LOW'
            ? 'دستیاب شواہد اس وقت کم خطرے کی نشاندہی کرتے ہیں، لیکن حالات بدل سکتے ہیں۔'
            : 'موجودہ خطرے کی سطح کی وجہ سے مقامی سرکاری ہدایات اور تازہ معلومات پر قریب سے نظر رکھیں۔', '',
        '**عملی اقدامات**',
        '1. مقامی سرکاری انتباہات دیکھتے رہیں۔',
        '2. غیر مصدقہ خبروں پر فوری عمل نہ کریں۔',
        '3. صورتحال بدلے تو دوبارہ خطرے کی جانچ کریں۔', '',
        `**شواہد کے ذرائع**\n${sources.length ? sources.join(', ') : 'کوئی تصدیق شدہ بیرونی ذریعہ دستیاب نہیں'}`, '',
        'کیا آپ عوامی حفاظت، کسانوں، بجلی، لاجسٹکس یا مکمل رپورٹ کے بارے میں جاننا چاہتے ہیں؟',
    ].join('\n');
}

function buildLocalSpecificWiaas(data, regionContext, query) {
    const q = String(query || '').toLowerCase();
    const telemetry = data?.telemetry || data?.climate_matrix?.telemetry || {};
    const climate = data?.climate_matrix || {};
    const ledger = data?.ledger || data?.synthetic_resource_ledger || {};
    const place = regionContext.name || regionContext.city || regionContext.country || 'selected region';
    const temp = metric(telemetry.temperature_celsius, '°C');
    const humidity = metric(telemetry.humidity_percentage, '%');
    const vpd = metric(climate.vapor_pressure_deficit_kpa, ' kPa');
    const heat = metric(climate.heat_index_celsius, '°C');
    const wind = metric(telemetry.wind_speed_kmh ?? telemetry.wind?.speed_kmh, ' km/h');
    const surge = metric(ledger.grid_demand_surge_pct, '%');
    const evaporation = metric(ledger.water_surface_evap_loss_pct ?? climate.water_surface_evap_loss_pct, '%');
    const comparisonTarget = findMentionedRegion(query.replace(/\b(karachi|lahore|multan|delhi|tokyo|beijing|shanghai|mumbai|dhaka|sylhet|dubai|riyadh)\b/gi, (match, offset, full) => offset === full.toLowerCase().indexOf(match.toLowerCase()) ? '' : match));
    const selectedCity = String(regionContext.city || '').toLowerCase();
    const selectedProfile = ['karachi', 'mumbai', 'dhaka', 'sylhet', 'tokyo', 'shanghai'].some((city) => selectedCity.includes(city))
        ? 'humid or maritime, so drainage, leaf-wetness, and fungal pressure deserve attention'
        : 'drier or continental, so VPD, irrigation demand, and heat exposure deserve attention';
    if ((q.includes('what region') || q.includes('which region') || q.includes('region access') || q.includes('regions do you have')) && (q.includes('access') || q.includes('support') || q.includes('available') || q.includes('have'))) {
        return `**WIaaS coverage**\n\nI can analyze Asian cities and countries including Karachi, Lahore, Islamabad, Multan, Delhi, Mumbai, Dhaka, Sylhet, Beijing, Shanghai, Tokyo, Dubai, Riyadh, and other registered Asian locations. Select a region on the map or name a city, and I’ll use that location’s telemetry for the answer.`;
    }
    if (q.includes('vpd') || q.includes('vapor pressure deficit')) {
        const vpdValue = Number(climate.vapor_pressure_deficit_kpa);
        const interpretation = Number.isFinite(vpdValue) && vpdValue >= 2 ? 'high atmospheric drying demand' : Number.isFinite(vpdValue) && vpdValue >= 1.2 ? 'moderate drying demand' : 'low atmospheric drying demand';
        return `**VPD for ${place}**\n\n• Current VPD: **${vpd}**.\n• Meaning: VPD is the drying-pressure difference between the air and a fully wet leaf. At this reading, ${interpretation}; plants are under less moisture pull than they would be in a hot, dry afternoon.\n• Crop action: check root-zone moisture before watering, keep irrigation in the cooler window, and watch shaded leaves for fungal or leaf-wetness symptoms because humidity is ${humidity}.`;
    }
    if ((q.includes('which crops') || q.includes('what crops') || q.includes('crops are under')) && (q.includes('heat') || q.includes('drought') || q.includes('humidity') || q.includes('stress'))) {
        return `**Crop Stress Map for ${place}**\n\n• Current signals: temperature ${temp}, humidity ${humidity}, VPD ${vpd}.\n• Prioritize vegetables and tomatoes in shaded or poorly ventilated plots for humidity stress; maize, cotton, and young fruit trees for heat or high VPD stress.\n• Scout 20 plants at dawn for leaf curl, wilting, yellowing, lesions, and pest counts before treating.\n• Keep irrigation in cooler hours when VPD is high, improve drainage and airflow when humidity is high, and avoid midday spraying.`;
    }
    if (q.includes('compare') || q.includes('karachi and lahore') || q.includes('karachi vs lahore') || q.includes('lahore and karachi')) {
        const target = comparisonTarget?.meta?.city || (q.match(/\b(beijing|lahore|tokyo|delhi|multan|shanghai|mumbai|dhaka|sylhet|dubai|riyadh)\b/i)?.[1] || 'the comparison region');
        const targetLower = target.toLowerCase();
        const targetProfile = targetLower.includes('beijing') || targetLower.includes('lahore') || targetLower.includes('delhi') ? 'generally hotter and drier, with higher VPD, irrigation demand, crop heat stress, and cooling load' : 'a different climate profile that should be checked against its registered telemetry';
        return `**${regionContext.city || 'Selected region'}–${target} Conditions Compared**\n\n• ${regionContext.city || 'Selected region'}: the selected telemetry is ${selectedProfile}; current humidity is ${humidity} and drying demand is ${vpd}.\n• ${target}: its registered baseline is ${targetProfile}.\n• Operational difference: compare irrigation timing, crop stress, grid load, and route exposure using each location’s own telemetry. Switch the map to ${target} for a live refresh.`;
    }
    if (q.includes('research') || q.includes('weather pattern') || q.includes('what does the data say')) {
        return `**Research Interpretation for ${place}**\n\nThe available telemetry shows ${temp} temperature, ${humidity} humidity, VPD ${vpd}, and wind ${wind}. The dominant signal is ${Number(telemetry.humidity_percentage) >= 70 ? 'moisture retention and leaf-wetness pressure' : 'atmospheric drying and irrigation demand'}. Grid demand is ${surge} above baseline. This is an operational interpretation of regional telemetry, not a peer-reviewed causal study.`;
    }
    if (q.includes('weather risk') || q.includes('current risk in') || q.includes('risk in')) {
        const risk = data?.risk_level || 'MEDIUM';
        return `**Current Weather Risk in ${place}**\n\n• Risk level: **${risk}**.\n• Evidence: temperature ${temp}, heat index ${heat}, humidity ${humidity}, VPD ${vpd}, and wind ${wind}.\n• Action: protect outdoor workers during peak heat, use cooler irrigation windows when VPD is elevated, and monitor the grid surge (${surge}).`;
    }
    if (q.includes('grid') && (q.includes('risk') || q.includes('cooling demand'))) {
        return `**Cooling-Demand Grid Risk in ${place}**\n\n• Current cooling-load surge: ${surge} above baseline.\n• Thermal conditions: ${temp} with heat index ${heat}; available capacity and thermal overhead should be watched through the evening peak.\n• Operator action: maintain reserve margin, monitor overloaded feeders, and shift discretionary pumping outside the peak window.`;
    }
    if (q.includes('soil moisture') || q.includes('water demand')) {
        return `**Soil Moisture and Water Demand for ${place}**\n\n• VPD is ${vpd} and evaporation loss is ${evaporation}.\n• These readings indicate ${Number(climate.vapor_pressure_deficit_kpa) >= 2 ? 'elevated atmospheric water demand' : 'low to moderate atmospheric water demand'}.\n• Check root-zone moisture before irrigating; use a cooler application window and avoid watering by schedule alone.`;
    }
    if (q.includes('logistic') || q.includes('route') || q.includes('road')) {
        return `**Logistics Route Risk for ${place}**\n\n• Heat exposure is represented by ${temp} temperature and ${heat} heat index; wind is ${wind}.\n• Keep heat-sensitive cargo in active cold chain, avoid unshaded staging during the hottest hours, and check flood-prone low crossings before dispatch.\n• Recheck the route when rainfall or hazard alerts change.`;
    }
    return '';
}

function buildHumanCrisisFallback(message, regionContext, data, isUrdu = false) {
    const place = regionContext.name || regionContext.city || regionContext.country || 'the selected region';
    const q = String(message || '').trim().toLowerCase();
    const risk = data?.risk_level || 'currently unavailable';
    if (/^(hi|hello|hey|salam|assalam|good morning|good evening)\b/.test(q)) {
        return isUrdu
            ? `وعلیکم السلام۔ میں ${place} کے خطرات سمجھنے میں مدد کر سکتا ہوں۔ آپ موسم، سیلاب، گرمی، آگ، عوامی حفاظت، کسانوں، گرڈ یا راستوں کے بارے میں پوچھ سکتے ہیں۔`
            : `Hello. I’m CrisisLens for ${place}. Ask me about weather threats, flooding, heat, fires, public safety, farmers, grid pressure, or route risks.`;
    }
    return isUrdu
        ? `میں نے آپ کا سوال ${place} کے تناظر میں سمجھا ہے۔ اس وقت مجموعی خطرے کی سطح ${risk} ہے۔ اگر آپ سوال کو تھوڑا مخصوص کریں—مثلاً “کراچی میں سیلاب کا خطرہ کیا ہے؟” یا “لوگوں کو ابھی کیا کرنا چاہیے؟”—تو میں متعلقہ شواہد اور عملی قدم دوں گا۔`
        : `I understand your question in the context of ${place}. The current overall risk is ${risk}. If you make the concern a little more specific—such as “Is Karachi at risk of flooding?” or “What should people do now?”—I’ll give the relevant evidence and practical next steps.`;
}

function buildComplexCrisisFallback(message, regionContext, data) {
    const q = String(message || '').toLowerCase();
    const place = regionContext.name || regionContext.city || regionContext.country || 'the selected region';
    const isNepal = /nepal|kathmandu|rasuwa|bhote koshi|trishuli/.test(q);
    const historical = /past|historical|what happened|august|cause|caused|losses|damage|affected|reported/.test(q);
    const forecast = /next|future|seven days|7 days|forecast|warning signals|upcoming|could affect/.test(q);
    const comparison = /compare|versus|vs\.?|difference between/.test(q);
    const multiHazard = /flood|heatwave|storm|earthquake|wildfire|hazard|threats?/.test(q) && /flood|heatwave|storm|earthquake|wildfire|hazard|threats?/.test(q.replace(/flood/, ''));
    if (!(isNepal && (historical || forecast || multiHazard))) return '';
    if (historical) return `**Historical event review — ${isNepal ? 'Nepal' : place}**\n\nThis is a past-event question, so a current Kathmandu weather snapshot is not a valid answer. CrisisLens must verify the event date, affected districts, causes, losses, and infrastructure impacts from dated official bulletins and reliable reporting. Until those records are returned, casualty and damage figures remain **unverified**.\n\nFor safety, follow Nepal authority instructions, avoid floodwater and unstable bridges, move to higher ground when warned, and use verified shelters and emergency channels.`;
    if (comparison) return `**Comparison requested**\n\nKarachi is a present assessment while Kathmandu is a seven-day forecast, so they are different time windows. Compare them only after showing Karachi’s current rainfall, drainage, and alerts alongside Kathmandu’s dated forecast probabilities. Until then, treat Kathmandu as forecast uncertainty and follow local alerts in both places.`;
    if (forecast && /confiden|probability|likely|certainty/.test(q)) return `**Forecast confidence — ${isNepal ? 'Nepal' : place}**\n\nConfidence falls as the forecast window lengthens and depends on agreement between rainfall models, river gauges, and official warnings. Use the issue time and confidence published by Nepal DHM/NDRRMA, and recheck after each update.`;
    if (forecast && /prepare|preparation|residents|household|should people/.test(q)) return `**Resident preparation — ${isNepal ? 'Nepal' : place}**\n\nFor the next seven days, keep medicines, documents, water, lights, and phone power ready; identify higher ground and two routes; avoid river crossings and unstable slopes; and follow DHM, NDRRMA, and municipal alerts.`;
    if (forecast) return `**Seven-day hazard outlook — ${isNepal ? 'Nepal' : place}**\n\nList each hazard separately with probability, issue time, confidence, and affected areas. Check official DHM and NDRRMA updates for rainfall, river, landslide, wind, heat, and seismic signals rather than relying on one generic risk score.`;
    return `**Multi-hazard assessment — ${isNepal ? 'Nepal' : place}**\n\nThe question covers several hazards, so a flood-only report is incomplete. CrisisLens should evaluate flood and river rise, landslides, heat, severe wind, wildfire, and earthquake alerts separately, then combine them into one severity view with source timestamps.\n\nNo single LOW flood reading can clear all hazards. Residents should monitor official alerts, avoid rivers and unstable slopes, keep communications and medicines ready, and follow evacuation instructions if authorities issue them.`;
}

function buildRegionContext(regionKey, meta = {}) {
    return {
        key: regionKey,
        name: meta.name || regionNames[regionKey] || regionKey,
        location_type: meta.locationType || meta.location_type || 'city',
        city: meta.city || meta.name || '',
        province: meta.province || '',
        country: meta.country || '',
        country_code: meta.country_code || meta.countryCode || '',
        asian_subregion: meta.asian_subregion || 'Asia',
        latitude: meta.latitude,
        longitude: meta.longitude,
        timezone: meta.timezone || meta.timeZone || '',
        timezone_offset: meta.timezone_offset ?? meta.utcOffset ?? null,
    };
}

function buildResponseProfile(message, agentMode) {
    const query = String(message || '').toLowerCase();
    // People often ask conversationally for a full brief without saying
    // “report”, such as “I need detailed all of it”.
    const wantsAllDetails =
        /\b(detailed|complete|full|comprehensive)\b[\s\S]{0,24}\b(all|everything|it)\b/.test(query) ||
        /\b(all|everything)\b[\s\S]{0,18}\b(detail|details|information|analysis)\b/.test(query) ||
        /\b(tell|show|give)\b[\s\S]{0,24}\b(all|everything)\b/.test(query);
    const comprehensive = wantsAllDetails || /\b(full|comprehensive|detailed|complete|technical|multi[- ]agent)\b[\s\S]{0,32}\b(report|assessment|analysis|briefing)\b|\b(generate|create|prepare)\b[\s\S]{0,32}\breport\b/.test(query);
    return comprehensive
        ? {
            request_kind: 'comprehensive_report',
            execution_mode: agentMode === 'wiaas' ? 'specialist_swarm' : 'evidence_and_actions',
            response_style: 'detailed',
            max_response_words: agentMode === 'wiaas' ? 650 : 450,
            token_strategy: 'specialists_only_for_report',
        }
        : {
            request_kind: 'standard_query',
            execution_mode: 'efficient',
            response_style: 'structured',
            max_response_words: agentMode === 'wiaas' ? 260 : 300,
            token_strategy: 'deterministic_and_cached_first',
        };
}

function normalizeQuestion(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getConversationContext(agentMode, message) {
    const storageKey = `wiaas_${agentMode}_conversation`;
    let state = {};
    try {
        state = JSON.parse(sessionStorage.getItem(storageKey) || '{}') || {};
    } catch (error) {
        console.warn('[api] Conversation state was reset:', error);
    }

    if (!state.session_id) {
        state.session_id = `${agentMode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }
    const turns = Array.isArray(state.turns) ? state.turns : [];
    const normalized = normalizeQuestion(message);
    const repeatedQuestionCount = turns.filter((turn) => turn.normalized === normalized).length;
    const turnIndex = turns.length + 1;
    const context = {
        session_id: state.session_id,
        turn_index: turnIndex,
        repeated_question_count: repeatedQuestionCount,
        response_variant: (turnIndex + repeatedQuestionCount) % 4,
        recent_user_messages: turns.slice(-5).map((turn) => turn.text),
    };

    turns.push({ text: String(message || '').slice(0, 500), normalized });
    state.turns = turns.slice(-8);
    try {
        sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
        console.warn('[api] Conversation state could not be saved:', error);
    }
    return context;
}

export function clearConversationContext(agentMode) {
    if (agentMode) {
        sessionStorage.removeItem(`wiaas_${agentMode}_conversation`);
        return;
    }
    sessionStorage.removeItem('wiaas_wiaas_conversation');
    sessionStorage.removeItem('wiaas_crisislens_conversation');
}

/**
 * Fetch the complete region catalogue from backend and update global registry.
 * @returns {Promise<Object>}
 */
export async function fetchRegionCatalogue() {
    try {
        const response = await fetch('/analytics/');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.regions) {
            setRegionsRegistry(data.regions);
            return data.regions;
        }
        return {};
    } catch (error) {
        console.error('[api] fetchRegionCatalogue failed:', error);
        return {};
    }
}

/**
 * Fetch analytics payload for a given region key.
 * @param {string} regionKey
 * @returns {Promise<Object|null>} API response or null on failure
 */
export async function fetchRegionAnalytics(regionKey) {
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
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') params.set(key, value);
        });

        const query = params.toString();
        const url = `/analytics/${encodeURIComponent(regionKey)}${query ? `?${query}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`[api] fetchRegionAnalytics(${regionKey}) failed:`, error);
        return null;
    }
}

/**
 * Fetch analytics for all regions in parallel.
 * Returns a Map<regionKey, data>.
 * @param {string[]} regionsList
 * @returns {Promise<Map<string, Object>>}
 */
export async function fetchAllRegions(regionsList) {
    const results = new Map();
    await Promise.all(
        regionsList.map(async (key) => {
            const data = await fetchRegionAnalytics(key);
            if (data) results.set(key, data);
        })
    );
    return results;
}

/**
 * Send a chat message to the n8n simulation webhook via the backend with full regional context.
 * @param {string} regionKey 
 * @param {string} query 
 * @returns {Promise<Object|null>} 
 */
export async function sendChatSimulation(regionKey, query) {
    try {
        if (/^(hi|hello|hey| salam|assalamualaikum|good morning|good afternoon|good evening)[!,.\s]*$/i.test(String(query || '').trim())) {
            const greeting = 'Hello! I’m your WIaaS weather-intelligence partner. I can help with current weather, crop stress, irrigation, power-grid pressure, logistics, and regional comparisons. What would you like to check?';
            return { reply: greeting, speech_en: greeting, speech_ur: greeting, response_language: 'en', response_kind: 'GREETING' };
        }
        if (/^(what can you do|what do you do|how can you help|what are your capabilities|help|can you do comparisons?|do you support comparisons?|can you compare|what comparisons can you do)[?!.,\s]*$/i.test(String(query || '').trim())) {
            const capability = 'I can explain current weather and climate signals, crop stress, irrigation, power-grid pressure, logistics risk, and regional comparisons. Ask about a place and a topic, and I’ll give the relevant evidence and practical next step.';
            return { reply: capability, speech_en: capability, speech_ur: capability, response_language: 'en', response_kind: 'CAPABILITIES' };
        }
        if (/\b(i am|i'm|im|i feel|feeling)\s+(very\s+)?hot\b|heat\s+exhaustion|heatstroke/i.test(String(query || '').trim())) {
            const care = 'I’m sorry you’re feeling overheated. Move into shade or a cool room now, loosen extra clothing, sip cool water or oral rehydration solution, and stop strenuous activity. If you feel confused, faint, severely weak, have a seizure, or cannot drink, seek emergency medical help immediately. If you can, tell me your city and whether you have dizziness, headache, nausea, or confusion so I can tailor the guidance.';
            return { reply: care, speech_en: care, speech_ur: care, response_language: 'en', response_kind: 'PERSONAL_HEAT_SAFETY' };
        }
        if (!regionKey) {
            const prompt = 'Please select a country or city first so I can guide you using the correct local weather, agriculture, grid, and logistics context.';
            return { reply: prompt, speech_en: prompt, speech_ur: prompt, response_language: 'en', response_kind: 'REGION_REQUIRED' };
        }
        const cachedData = regionsTelemetryCache[regionKey] || {};
        const activeMeta = getActiveRegion() || {};
        const regionContext = buildRegionContext(regionKey, activeMeta);
        const responseProfile = buildResponseProfile(query, 'wiaas');
        const conversationContext = getConversationContext('wiaas', query);
        const responseLanguage = detectMessageLanguage(query);
        const routingQuery = buildRoutingQuery(query);
        
        // Assemble the full context payload exactly like backend does
        const payload = {
            ...cachedData,
            schema_version: 'wiaas.asia.chat.v1',
            agent_mode: 'wiaas',
            ...responseProfile,
            ...conversationContext,
            response_language: responseLanguage,
            // The workflow router needs a human-readable location token as well
            // as the structured region object. This keeps short follow-ups such
            // as “detailed all of it” anchored to the selected city.
            routing_query: `${routingQuery} for ${regionContext.name}`,
            region_key: regionKey,
            region_name: regionContext.name,
            location_type: regionContext.location_type,
            city: regionContext.city,
            province: regionContext.province,
            country: regionContext.country,
            country_code: regionContext.country_code,
            asian_subregion: regionContext.asian_subregion,
            latitude: regionContext.latitude,
            longitude: regionContext.longitude,
            timezone: regionContext.timezone,
            timezone_offset: regionContext.timezone_offset,
            region_context: regionContext,
            supported_countries: Object.keys(ASIA_COUNTRIES),
            available_regions: buildAvailableRegions(),
            user_query: query,
            // Match Region reads chatInput in the workflow. Add the selected
            // region to terse follow-up requests without changing the message
            // shown in the chat transcript.
            chatInput: `${responseLanguage === 'ur' ? routingQuery : query} for ${regionContext.name}`,
            original_message: query,
        };
        
        const response = await fetch(WIAAS_ASIA_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const n8nData = await response.json();
        
        let extractedReply = "";
        let responseObject = null;
        if (Array.isArray(n8nData) && n8nData.length > 0) {
            const first = n8nData[0];
            if (first && typeof first === 'object') {
                responseObject = first;
                extractedReply = first.output || first.message || first.text || first.chat_message || first.regional_summary || first.reply || JSON.stringify(first);
            } else {
                extractedReply = String(first);
            }
        } else if (n8nData && typeof n8nData === 'object') {
            responseObject = n8nData;
            extractedReply = n8nData.output || n8nData.message || n8nData.text || n8nData.chat_message || n8nData.regional_summary || n8nData.reply || JSON.stringify(n8nData);
        } else {
            extractedReply = String(n8nData);
        }

        // Inspect if remote n8n cloud returned an un-updated canned template or "Not available" for a specific query
        const qLower = (query || '').toLowerCase();
        const isSpecificQuery = [
            'heat index', 'feels like', 'apparent temperature', 'heat stress', 'thermal', 'wet bulb', 'wet-bulb', 'vpd',
            'grid risk', 'power risk', 'blackout', 'electricity', 'demand surge', 'grid capacity', 'power grid', 'transformer', 'grid load', 'power', 'grid',
            'evaporation', 'water loss', 'water could be lost', 'evaporation loss', 'reservoir', 'storage', 'water',
            'farmer', 'farmers', 'crop', 'crops', 'corps', 'agriculture', 'irrigation', 'pest', 'whitefly', 'scouting', 'yield',
            'comprehensive', 'full report', 'wiaas report', 'crisis report', 'all details', 'complete report', 'report'
        ].some(k => qLower.includes(k));

        const replyLower = (extractedReply || '').toLowerCase();
        const isGenericCanned = [
            'do not cross the configured threat thresholds',
            'does not cross the configured threat thresholds',
            'severity: unknown',
            'correlation: unknown',
            'tell me which stakeholder',
            'calculated heat index: not available',
            'no threshold-crossing active threat was detected',
            'conditions appear stable, but continue monitoring',
            'let’s walk through what the evidence means',
            'let\'s walk through what the evidence means',
            'here’s the practical risk picture right now',
            'here\'s the practical risk picture right now',
            'evidence-led interpretation',
            'do you want the supporting evidence'
        ].some(phrase => replyLower.includes(phrase));

        if (isSpecificQuery && isGenericCanned) {
            console.warn(`[api] sendChatSimulation: detected generic/un-updated remote n8n response for "${query}". Falling back to local backend proxy...`);
            throw new Error('Detected generic/un-updated canned response from remote n8n webhook');
        }

        // A stale live workflow may return a clean-looking summary while
        // silently dropping the requested 7-day farming plan. Route that
        // narrow request through the backend, which has the forecast arrays.
        const isWeeklyFarmPlan = /(?:7[- ]day|seven[- ]day|next\s+(?:7|seven)|next week)/i.test(query)
            && /(?:farmer|farmers|farm|crop|agriculture|irrigation|spray|harvest)/i.test(query);
        if (isWeeklyFarmPlan && !/(?:day\s*1|7[- ]day|seven[- ]day)/i.test(extractedReply || '')) {
            throw new Error('Remote response did not include the requested forecast-driven farm plan');
        }

        const isCropImprovement = /(?:better crops|improve crops|improving crops|crop yield|increase yield|healthy crops|grow better)/i.test(query);
        if (isCropImprovement && !/(?:soil|root-zone|nutrition|fungal|pest|spray|harvest)/i.test(extractedReply || '')) {
            throw new Error('Remote response did not include a crop-improvement plan');
        }

        const needsRegionalNextSteps = !/(?:what can|capabilities|who are you|unsupported|unavailable)/i.test(query)
            && /(?:weather|happening|risk|assessment|report|farmer|farm|crop|agriculture|irrigation|grid|logistics|research)/i.test(query)
            && !/next\s+steps/i.test(extractedReply || '');
        if (needsRegionalNextSteps) {
            throw new Error('Remote regional assessment is missing its Next Steps section');
        }
        
        const speechEnglish = responseObject?.speech_en || extractedReply;
        const speechUrdu = responseObject?.speech_ur || extractedReply;
        return {
            reply: responseLanguage === 'ur' ? speechUrdu : extractedReply,
            speech_en: speechEnglish,
            speech_ur: speechUrdu,
            response_language: responseObject?.response_language || responseLanguage,
            raw_data: n8nData,
        };
    } catch (error) {
        console.error(`[api] sendChatSimulation(${regionKey}) direct n8n call failed, falling back to local proxy:`, error);
        try {
            const response = await fetch(`/analytics/${encodeURIComponent(regionKey)}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const fallbackResult = await response.json();
            const fallbackMeta = getActiveRegion() || {};
            const fallbackContext = buildRegionContext(regionKey, fallbackMeta);
            const localUrdu = buildLocalUrduWiaas(
                regionsTelemetryCache[regionKey] || fallbackResult?.raw_data || {},
                fallbackContext,
                query,
            );
            const responseLanguage = detectMessageLanguage(query);
            const english = fallbackResult.speech_en || fallbackResult.reply || '';
            return {
                ...fallbackResult,
                reply: responseLanguage === 'ur' ? (fallbackResult.speech_ur || localUrdu) : english,
                speech_en: english,
                speech_ur: fallbackResult.speech_ur || localUrdu,
                response_language: responseLanguage,
            };
        } catch (backendError) {
            console.error(`[api] sendChatSimulation(${regionKey}) local proxy fallback failed:`, backendError);
            return null;
        }
    }
}

/**
 * Send a chat message to the CrisisLens webhook with active region context.
 * @param {string} message 
 * @returns {Promise<Object|null>} 
 */
export async function sendCrisisLensChat(message) {
    try {
        if (/^(hi|hello|hey| salam|assalamualaikum|good morning|good afternoon|good evening)[!,.\s]*$/i.test(String(message || '').trim())) {
            const greeting = 'Hello! I’m CrisisLens. I can help you understand current and past disasters, future hazards, verified evidence, and practical safety steps across Asia. Which place or concern should we look at?';
            return { reply: greeting, speech_en: greeting, speech_ur: greeting, response_language: 'en', response_kind: 'GREETING' };
        }
        if (/^(what can you do|what do you do|how can you help|what are your capabilities|help)$/i.test(String(message || '').trim())) {
            const capability = 'I can check current and past hazards, explain verified evidence, compare events, and give practical safety guidance for residents, farms, roads, power, and logistics across Asia. Tell me a place and your concern.';
            return { reply: capability, speech_en: capability, speech_ur: capability, response_language: 'en', response_kind: 'CAPABILITIES' };
        }
        if (/\b(i am|i'm|im|i feel|feeling)\s+(very\s+)?hot\b|heat\s+exhaustion|heatstroke/i.test(String(message || '').trim())) {
            const care = 'I’m sorry you’re feeling overheated. Move into shade or a cool room now, loosen extra clothing, sip cool water or oral rehydration solution, and stop strenuous activity. If you feel confused, faint, severely weak, have a seizure, or cannot drink, seek emergency medical help immediately. Tell me your city and whether you have dizziness, headache, nausea, or confusion if you want more tailored guidance.';
            return { reply: care, speech_en: care, speech_ur: care, response_language: 'en', response_kind: 'PERSONAL_HEAT_SAFETY' };
        }
        if (!activeRegionKey && !findMentionedRegion(message)) {
            const prompt = 'Please select a country or city first so I can guide you with the right local hazard, weather, and safety context.';
            return { reply: prompt, speech_en: prompt, speech_ur: prompt, response_language: 'en', response_kind: 'REGION_REQUIRED' };
        }
        const mentionedRegion = findMentionedRegion(message);
        const resolvedRegionKey = mentionedRegion?.key || activeRegionKey;
        const activeMeta = mentionedRegion?.meta || getActiveRegion() || {};
        const cachedData = regionsTelemetryCache[resolvedRegionKey] || {};
        const regionContext = buildRegionContext(resolvedRegionKey, activeMeta);
        const responseProfile = buildResponseProfile(message, 'crisislens');
        const conversationContext = getConversationContext('crisislens', message);
        const responseLanguage = detectMessageLanguage(message);
        
        const regionName = regionContext.name || regionContext.city || resolvedRegionKey;
        const msgText = responseLanguage === 'ur' ? buildRoutingQuery(message) : message;
        const anchoredMessage = String(msgText || '').toLowerCase().includes(String(regionName || '').toLowerCase())
            ? msgText
            : `${msgText} for ${regionName}`;

        const payload = {
            schema_version: 'wiaas.asia.chat.v1',
            agent_mode: 'crisislens',
            response_style: 'direct_answer',
            response_rules: 'Answer the exact question first in 2-5 short paragraphs or bullets. Include only relevant evidence, uncertainty, and practical actions. Do not produce a full report unless requested. Never substitute current weather for a historical or future question. Do not invent facts, losses, or causes.',
            ...responseProfile,
            ...conversationContext,
            response_language: responseLanguage,
            routing_query: anchoredMessage,
            message: anchoredMessage,
            chatInput: anchoredMessage,
            original_message: message,
            user_id: 'user-123',
            region_key: resolvedRegionKey,
            region_name: regionContext.name,
            location_type: regionContext.location_type,
            city: regionContext.city,
            province: regionContext.province,
            country: regionContext.country,
            country_code: regionContext.country_code,
            asian_subregion: regionContext.asian_subregion,
            latitude: regionContext.latitude,
            longitude: regionContext.longitude,
            timezone: regionContext.timezone,
            timezone_offset: regionContext.timezone_offset,
            region_context: regionContext,
            supported_countries: Object.keys(ASIA_COUNTRIES),
            available_regions: buildAvailableRegions(),
            telemetry: cachedData.telemetry || null,
            climate_matrix: cachedData.climate_matrix || null,
            ledger: cachedData.ledger || cachedData.synthetic_resource_ledger || null,
            risk_level: cachedData.risk_level || null,
            mission_criticality_score: cachedData.mission_criticality_score ?? null,
        };
        
        const response = await fetch('/analytics/crisislens/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        const english = result.speech_en || result.reply || '';
        const urdu = result.speech_ur || buildLocalUrduCrisis(result, regionContext);
        const rawReply = String(result.reply || result.output || '').trim();
        const historicalEvent = /\b(recent|recently|past|historical|what happened|cause|caused|losses|damage|killed|missing|affected|displaced|recovery|lessons|after the)\b/i.test(message) && /\b(flood|flooding|earthquake|cyclone|typhoon|storm|landslide|wildfire|fire|disaster|river)\b/i.test(message);
        return {
            ...result,
            reply: responseLanguage === 'ur' ? urdu : result.reply,
            speech_en: english,
            speech_ur: urdu,
            response_language: responseLanguage,
        };
    } catch (error) {
        console.error('[api] sendCrisisLensChat failed:', error);
        return null;
    }
}


