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
        
        const localUrdu = buildLocalUrduWiaas(cachedData, regionContext, query);
        const speechEnglish = responseObject?.speech_en || extractedReply;
        const speechUrdu = responseObject?.speech_ur || localUrdu;
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


