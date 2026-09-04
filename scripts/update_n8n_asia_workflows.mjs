import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const downloadRoot = 'C:/Users/DELL/Downloads';
const outputRoot = path.join(projectRoot, 'n8n', 'exports');

const sourcePaths = {
  wiaas: path.join(downloadRoot, 'WIAAS.json'),
  crisis: path.join(downloadRoot, 'WIaaS CrisisLens - API Threat Intelligence.json'),
};

const outputPaths = {
  wiaas: path.join(outputRoot, 'WIAAS-Asia.json'),
  crisis: path.join(outputRoot, 'WIaaS-CrisisLens-Asia.json'),
};

function load(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function node(workflow, name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Missing node: ${name}`);
  return found;
}

function makeCodeNode(target, jsCode) {
  target.type = 'n8n-nodes-base.code';
  target.typeVersion = 2;
  target.parameters = { jsCode };
  delete target.credentials;
  delete target.webhookId;
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Unable to patch ${label}`);
  return source.replace(search, replacement);
}

const registryCode = String.raw`const input = $input.first().json || {};
let router = input;
try { router = $('Intent Router2').first().json || input; } catch (e) {}
const body = router.body && typeof router.body === 'object' ? router.body : {};
const context = router.region_context && typeof router.region_context === 'object'
  ? router.region_context
  : (body.region_context && typeof body.region_context === 'object' ? body.region_context : {});
const explicitKey = String(router.region_key || body.region_key || context.key || '').trim();
const explicitName = String(router.region_name || body.region_name || context.name || context.city || context.country || '').trim();

function normalizeEntries(value) {
  const source = value && value.regions !== undefined ? value.regions : value;
  const entries = [];
  if (Array.isArray(source)) {
    for (const item of source) {
      if (typeof item === 'string') entries.push({ key: item, name: item });
      else if (item && typeof item === 'object') {
        const key = item.key || item.region_key || item.id || '';
        const name = item.name || item.region_name || item.city || item.country || key;
        if (key || name) entries.push({ ...item, key: key || name, name });
      }
    }
  } else if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source)) {
      if (['status', 'count', 'message'].includes(key)) continue;
      entries.push(value && typeof value === 'object'
        ? { ...value, key, name: value.name || value.region_name || value.city || key }
        : { key, name: String(value || key) });
    }
  }
  return entries;
}

const supplied = router.available_regions || body.available_regions || router.asia_regions || body.asia_regions || [];
const entries = normalizeEntries(supplied);
if (explicitKey || explicitName) {
  const exists = entries.some((item) => item.key === explicitKey || item.name === explicitName);
  if (!exists) entries.unshift({
    ...context,
    key: explicitKey || explicitName,
    name: explicitName || explicitKey,
    city: router.city || body.city || context.city || '',
    province: router.province || body.province || context.province || '',
    country: router.country || body.country || context.country || '',
    country_code: router.country_code || body.country_code || context.country_code || '',
    asian_subregion: router.asian_subregion || body.asian_subregion || context.asian_subregion || '',
    latitude: router.latitude ?? body.latitude ?? context.latitude ?? null,
    longitude: router.longitude ?? body.longitude ?? context.longitude ?? null,
    timezone: router.timezone || body.timezone || context.timezone || '',
  });
}

return [{ json: {
  status: 'success',
  scope: 'ASIA',
  count: entries.length,
  regions: entries,
  supported_countries: router.supported_countries || body.supported_countries || [],
  selected_context: context,
} }];`;

const matchRegionCode = String.raw`const registry = $input.first().json || {};
let router = {};
try { router = $('Intent Router2').first().json || {}; } catch (e) {}
const body = router.body && typeof router.body === 'object' ? router.body : {};
const context = router.region_context && typeof router.region_context === 'object'
  ? router.region_context
  : (body.region_context && typeof body.region_context === 'object' ? body.region_context : {});

function norm(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
}
function tokens(value) {
  return norm(value).split(' ').filter((part) => part.length > 1);
}
function entriesFrom(value) {
  const source = value && value.regions !== undefined ? value.regions : value;
  if (Array.isArray(source)) return source.map((item) => typeof item === 'string' ? { key: item, name: item } : item).filter(Boolean);
  if (!source || typeof source !== 'object') return [];
  return Object.entries(source).map(([key, item]) => item && typeof item === 'object' ? { ...item, key } : { key, name: String(item || key) });
}

const entries = entriesFrom(registry);
const explicitKey = String(router.region_key || body.region_key || context.key || '').trim();
const explicitName = String(router.region_name || body.region_name || context.name || context.city || '').trim();
const query = String(explicitName || router.requested_region || router.user_message || '').trim();
let match = null;

if (explicitKey) {
  match = entries.find((item) => String(item.key || item.region_key || '') === explicitKey) || { ...context, key: explicitKey, name: explicitName || explicitKey };
}

if (!match && query) {
  const queryNorm = norm(query);
  const queryTokens = new Set(tokens(query));
  let best = { score: 0, item: null };
  for (const item of entries) {
    const parts = [item.key, item.region_key, item.name, item.region_name, item.city, item.province, item.country].filter(Boolean);
    const joined = norm(parts.join(' '));
    let score = joined === queryNorm ? 100 : (joined.includes(queryNorm) || queryNorm.includes(joined) ? 30 : 0);
    for (const token of queryTokens) if (tokens(joined).includes(token)) score += 3;
    if (score > best.score) best = { score, item };
  }
  if (best.score >= 3) match = best.item;
}

if (!match && explicitName) match = { ...context, key: explicitKey || explicitName, name: explicitName };

const regionKey = String(match && (match.key || match.region_key) || explicitKey || '').trim();
const regionName = String(match && (match.name || match.region_name || match.city) || explicitName || '').trim();
const found = Boolean(regionKey || regionName);
const mode = router.wiaas_mode || 'analysis';

return [{ json: {
  ...router,
  region_context: { ...context, ...(match || {}), key: regionKey, name: regionName },
  matched_region_key: regionKey,
  matched_region_name: regionName,
  region_found: found,
  region_status: found ? 'resolved_from_asia_context' : 'missing',
  available_region_count: entries.length,
  wiaas_mode: mode,
  channel: router.channel || 'webhook',
} }];`;

const contextPayloadCode = String.raw`const match = $input.first().json || {};
const body = match.body && typeof match.body === 'object' ? match.body : {};
const context = match.region_context && typeof match.region_context === 'object' ? match.region_context : {};
const merged = { ...match, ...body };
return [{ json: {
  ...merged,
  region_key: match.matched_region_key || merged.region_key || context.key || '',
  region_name: match.matched_region_name || merged.region_name || context.name || context.city || context.country || '',
  city: merged.city || context.city || '',
  province: merged.province || context.province || '',
  country: merged.country || context.country || '',
  country_code: merged.country_code || context.country_code || '',
  asian_subregion: merged.asian_subregion || context.asian_subregion || '',
  latitude: merged.latitude ?? context.latitude ?? null,
  longitude: merged.longitude ?? context.longitude ?? null,
  timezone: merged.timezone || context.timezone || '',
  system_status: merged.system_status || (merged.telemetry ? 'CONTEXT_READY' : 'CONTEXT_PARTIAL'),
  context_source: 'wiaas_asia_selected_region',
} }];`;

const prepareStateExpression = String.raw`={{ (() => {
  const raw = $json.body && typeof $json.body === 'object' ? { ...$json, ...$json.body } : $json;
  const context = raw.region_context && typeof raw.region_context === 'object' ? raw.region_context : {};
  const climate = raw.climate_matrix || {};
  const ledger = raw.ledger || raw.synthetic_resource_ledger || {};
  const telemetry = raw.telemetry || climate.telemetry || {};
  const region = raw.region_name || raw.monitored_region || context.name || context.city || context.country || 'Selected Asian region';
  const country = raw.country || context.country || '';

  const heatIndex = climate.heat_index_celsius ?? null;
  const vpd = climate.vapor_pressure_deficit_kpa ?? null;
  const gridSurge = ledger.grid_demand_surge_pct ?? null;
  const thermalOverhead = ledger.fuel_thermal_overhead_pct ?? null;
  const evaporationLoss = ledger.water_surface_evap_loss_pct ?? climate.water_surface_evap_loss_pct ?? null;
  const irrigationEfficiency = ledger.water_irrigation_efficiency_pct ?? climate.water_irrigation_efficiency_pct ?? null;
  const windSpeed = telemetry.wind_speed_kmh ?? (telemetry.wind && telemetry.wind.speed_kmh) ?? null;
  const windDir = telemetry.wind_direction_degrees ?? (telemetry.wind && telemetry.wind.direction_degrees) ?? null;

  let riskLevel = String(raw.risk_level || '').toUpperCase();
  let missionScore = Number(raw.mission_criticality_score);
  if (!riskLevel) {
    if ((heatIndex ?? -Infinity) >= 40 || (vpd ?? -Infinity) >= 2.8 || (gridSurge ?? -Infinity) >= 15 || (thermalOverhead ?? -Infinity) >= 10) riskLevel = 'HIGH';
    else if ((heatIndex ?? -Infinity) >= 35 || (vpd ?? -Infinity) >= 2 || (gridSurge ?? -Infinity) >= 8 || (thermalOverhead ?? -Infinity) >= 5) riskLevel = 'MEDIUM';
    else if (Object.keys(telemetry).length || Object.keys(climate).length || Object.keys(ledger).length) riskLevel = 'LOW';
    else riskLevel = 'DATA_PENDING';
  }
  if (!Number.isFinite(missionScore)) missionScore = riskLevel === 'HIGH' ? 85 : (riskLevel === 'MEDIUM' ? 55 : (riskLevel === 'LOW' ? 25 : null));

  const gp = raw.grid_predictions || {};
  const summary = gp.analytics_summary || {};
  const trigger = summary.m2m_trigger || {};
  const state = {
    metadata: {
      region,
      city: raw.city || context.city || '',
      province: raw.province || context.province || '',
      country,
      country_code: raw.country_code || context.country_code || '',
      asian_subregion: raw.asian_subregion || context.asian_subregion || 'Asia',
      latitude: raw.latitude ?? context.latitude ?? null,
      longitude: raw.longitude ?? context.longitude ?? null,
      timezone: raw.timezone || context.timezone || '',
      data_source: Object.keys(telemetry).length ? 'WIaaS live regional telemetry' : 'WIaaS selected-region context',
      backend_status: Object.keys(telemetry).length ? 'ONLINE' : 'DATA_PENDING',
      system_status: raw.system_status || 'CONTEXT_READY',
      request_kind: raw.request_kind || 'standard_query',
      execution_mode: raw.execution_mode || 'efficient',
      response_style: raw.response_style || 'brief',
      max_response_words: raw.max_response_words || 140,
      token_strategy: raw.token_strategy || 'deterministic_and_cached_first',
      session_id: raw.session_id || '',
      turn_index: Number(raw.turn_index) || 1,
      repeated_question_count: Number(raw.repeated_question_count) || 0,
      response_variant: Number(raw.response_variant) || 0,
      recent_user_messages: Array.isArray(raw.recent_user_messages) ? raw.recent_user_messages.slice(-5) : [],
      user_query: String(raw.user_query || raw.chatInput || raw.message || ''),
    },
    physics_metrics: {
      vapor_pressure_deficit_kpa: vpd,
      evaporation_loss_percent: evaporationLoss,
      heat_index_celsius: heatIndex,
      wet_bulb_celsius: climate.wet_bulb_celsius ?? null,
      grid_demand_surge_percent: gridSurge,
      thermal_overhead_percent: thermalOverhead,
    },
    calculated_risk_state: { initial_risk_level: riskLevel, mission_criticality_score: missionScore },
    grid_outlook: {
      max_blackout_risk_pct: summary.max_blackout_risk_pct ?? null,
      peak_surge_hour: summary.peak_surge_hour ?? null,
      grid_status: summary.grid_status ?? null,
      action_required: trigger.action_required ?? false,
      recommended_mitigation: trigger.recommended_mitigation ?? 'NONE',
    },
    telemetry: {
      temperature_celsius: telemetry.temperature_celsius ?? null,
      humidity_percentage: telemetry.humidity_percentage ?? null,
      wind_speed_kmh: windSpeed,
      wind_direction_degrees: windDir,
    },
    ledger: { ...ledger, water_irrigation_efficiency_pct: irrigationEfficiency, grid_available_capacity_mw: ledger.grid_available_capacity_mw ?? null },
  };

  return {
    ...raw,
    ...state,
    region,
    data_source: state.metadata.data_source,
    backend_status: state.metadata.backend_status,
    risk_level: riskLevel,
    mission_criticality_score: missionScore,
    temperature_celsius: state.telemetry.temperature_celsius,
    humidity_percentage: state.telemetry.humidity_percentage,
    heat_index_celsius: heatIndex,
    vapor_pressure_deficit_kpa: vpd,
    grid_demand_surge_percent: gridSurge,
    thermal_overhead_percent: thermalOverhead,
    state_vector: JSON.stringify(state),
  };
})() }}`;

const fallbackStateExpression = String.raw`={{ (() => {
  const j = $json || {};
  const body = j.body && typeof j.body === 'object' ? j.body : {};
  const c = j.region_context || body.region_context || {};
  const region = j.matched_region_name || j.region_name || body.region_name || c.name || c.city || c.country || 'Selected Asian region';
  const state = {
    metadata: {
      region,
      city: j.city || body.city || c.city || '',
      province: j.province || body.province || c.province || '',
      country: j.country || body.country || c.country || '',
      country_code: j.country_code || body.country_code || c.country_code || '',
      asian_subregion: j.asian_subregion || body.asian_subregion || c.asian_subregion || 'Asia',
      latitude: j.latitude ?? body.latitude ?? c.latitude ?? null,
      longitude: j.longitude ?? body.longitude ?? c.longitude ?? null,
      timezone: j.timezone || body.timezone || c.timezone || '',
      data_source: 'WIaaS selected-region context',
      backend_status: 'DATA_PENDING',
    },
    physics_metrics: { vapor_pressure_deficit_kpa: null, evaporation_loss_percent: null, heat_index_celsius: null, grid_demand_surge_percent: null, thermal_overhead_percent: null },
    calculated_risk_state: { initial_risk_level: 'DATA_PENDING', mission_criticality_score: null },
    telemetry: { temperature_celsius: null, humidity_percentage: null, wind_speed_kmh: null },
    ledger: {},
  };
  return { ...j, region, data_source: state.metadata.data_source, backend_status: state.metadata.backend_status, risk_level: 'DATA_PENDING', mission_criticality_score: null, state_vector: JSON.stringify(state) };
})() }}`;

const formatRegionListCode = String.raw`let router = {};
try { router = $('Intent Router2').first().json || {}; } catch (e) {}
const input = $input.first().json || {};
const available = Array.isArray(router.available_regions) ? router.available_regions : (Array.isArray(input.available_regions) ? input.available_regions : []);
const regionNames = [...new Set(available.map((item) => typeof item === 'string' ? item : (item && (item.name || item.region_name || item.city || item.country))).filter(Boolean))];
const countries = Array.isArray(router.supported_countries) ? router.supported_countries : (Array.isArray(input.supported_countries) ? input.supported_countries : []);
const names = countries.map((item) => typeof item === 'string' ? item : (item && (item.name || item.country))).filter(Boolean);
const detail = regionNames.length
  ? 'WIaaS currently has access to ' + regionNames.length + ' Asian regions:\n\n' + regionNames.map((name) => '- ' + name).join('\n')
  : names.length
    ? 'The Region panel currently covers ' + names.length + ' Asian countries: ' + names.join(', ') + '.'
  : 'WIaaS Asia uses the country and city selected in the Region panel and supports Asian locations supplied by the map search.';
const message = detail + '\n\nSelect a country or city, then ask for weather, risk level, agriculture, grid, logistics, research, or a full multi-agent report.';
const urduMessage = regionNames.length
  ? 'WIaaS کو اس وقت ' + regionNames.length + ' ایشیائی علاقوں تک رسائی حاصل ہے:\n\n' + regionNames.map((name) => '- ' + name).join('\n') + '\n\nکسی ملک یا شہر کو منتخب کریں، پھر موسم، خطرے، زراعت، بجلی، لاجسٹکس، تحقیق یا مکمل رپورٹ کے بارے میں پوچھیں۔'
  : 'ریجن پینل میں دستیاب کوئی بھی ایشیائی ملک یا شہر منتخب کریں، پھر اپنی مطلوبہ معلومات پوچھیں۔';
const responseLanguage = String(router.response_language || input.response_language || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en';
const output = responseLanguage === 'ur' ? urduMessage : message;
return [{ json: { output, direct_response: output, chat_response: output, final_response: output, speech_en: message, speech_ur: urduMessage, response_language: responseLanguage, channel: router.channel || 'webhook' } }];`;

const passthroughExpression = `={{ { ...$json, chatInput: $json.original_message || $json.chatInput || $json.user_message || '', body: { ...($json.body || {}), chatInput: $json.original_message || $json.chatInput || $json.user_message || '' } } }}`;

function updateWiaas(workflow) {
  workflow.nodes = workflow.nodes.filter((item) => item.name !== 'When chat message received');
  delete workflow.connections['When chat message received'];
  node(workflow, 'Webhook Trigger').parameters.path = 'wiaas-asia-agents';
  node(workflow, 'Webhook Trigger').parameters.options = {
    ...(node(workflow, 'Webhook Trigger').parameters.options || {}),
    allowedOrigins: '*',
  };

  for (const name of ['To WIaaS Pipeline', 'FAQ To Pipeline', 'Fallback To Pipeline']) {
    const target = node(workflow, name);
    target.parameters.mode = 'raw';
    target.parameters.jsonOutput = passthroughExpression;
  }

  const intent = node(workflow, 'Intent Router2');
  let code = intent.parameters.jsCode;
  code = replaceOnce(code,
    'const body = input.body ?? {};',
    "const body = input.body && typeof input.body === 'object' ? input.body : {};\nconst payload = { ...input, ...body };\nconst suppliedContext = payload.region_context && typeof payload.region_context === 'object' ? payload.region_context : {};",
    'WIaaS payload merge');
  code = replaceOnce(code,
    '      ...input,',
    '      ...payload,',
    'WIaaS return payload');
  code = replaceOnce(code,
    '      region_key: null,',
    "      region_key: String(payload.region_key || suppliedContext.key || ''),\n      region_name: String(payload.region_name || suppliedContext.name || suppliedContext.city || suppliedContext.country || ''),\n      region_context: suppliedContext,",
    'WIaaS selected region');
  code = replaceOnce(code,
    '      requested_region: userMessage,',
    "      requested_region: String(payload.region_name || suppliedContext.name || suppliedContext.city || userMessage),",
    'WIaaS requested region');
  code = replaceOnce(code,
    'const text = userMessage.toLowerCase();',
    "const text = String(payload.routing_query || userMessage).toLowerCase();",
    'WIaaS bilingual routing text');
  code = replaceOnce(code,
    '  text.includes("what area");',
    '  text.includes("what area") || /(?:کن علاقوں|کون سے علاقوں|علاقوں تک رسائی|دستیاب علاقے|علاقوں کی فہرست)/.test(userMessage);',
    'WIaaS Urdu region-access intent');
  code = replaceOnce(code,
    'const singleMetric =',
    "const personalWeather = /\\b(i feel|i am|i'm|im feeling|feeling)\\b[\\s\\S]{0,24}\\b(cold|freezing|chilly|hot|overheated|too warm)\\b/i.test(userMessage);\n\nconst singleMetric =",
    'WIaaS personal weather intent');
  code = replaceOnce(code,
    'else if (weatherSummary) intentType = "weather_summary_query";',
    'else if (weatherSummary || personalWeather) intentType = "weather_summary_query";',
    'WIaaS personal weather routing');
  code = replaceOnce(code,
    'const explicitFullReport = hasAny([',
    'const requestedComprehensive = String(payload.request_kind || "").toLowerCase() === "comprehensive_report" || /\\b(?:detailed|complete|full|comprehensive)\\b[\\s\\S]{0,24}\\b(?:all|everything|it)\\b/.test(text);\n\nconst explicitFullReport = requestedComprehensive || hasAny([',
    'WIaaS conversational comprehensive report routing');
  intent.parameters.jsCode = code;

  makeCodeNode(node(workflow, 'Fetch Regions Registry'), registryCode);
  makeCodeNode(node(workflow, 'Fetch Regions For List'), registryCode);
  makeCodeNode(node(workflow, 'Match Region'), matchRegionCode);
  makeCodeNode(node(workflow, 'HTTP Request'), contextPayloadCode);

  const prepare = node(workflow, 'Prepare State Vector');
  prepare.parameters = { mode: 'raw', jsonOutput: prepareStateExpression, options: {} };

  // Detailed reports must bypass the zero-token fast formatter even when the
  // intent router also detects a sector keyword such as agriculture or grid.
  const fastAnswer = node(workflow, 'Fast Answer?');
  fastAnswer.parameters.conditions = {
    options: {
      caseSensitive: true,
      leftValue: '',
      typeValidation: 'loose',
      version: 3,
    },
    conditions: [{
      id: 'fast-only-for-standard-queries',
      leftValue: "={{ $('Prepare State Vector').item.json.metadata.request_kind !== 'comprehensive_report' && ['single_metric_query', 'weather_summary_query', 'section_query'].includes($('Match Region').item.json.intent_type) }}",
      rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    }],
    combinator: 'and',
  };

  const fallback = node(workflow, 'Set Fallback State Vector');
  fallback.parameters = { mode: 'raw', jsonOutput: fallbackStateExpression, options: {} };

  makeCodeNode(node(workflow, 'Fast Answer Formatter'), String.raw`const j = $input.first().json || {};
function parse(value) { try { return typeof value === 'object' ? value : JSON.parse(value); } catch (e) { return {}; } }
let router = {};
try { router = $('Match Region').first().json || {}; } catch (e) {}
const state = parse(j.state_vector);
const m = state.metadata || {};
const p = state.physics_metrics || {};
const t = state.telemetry || {};
const l = state.ledger || {};
const riskState = state.calculated_risk_state || {};
const region = m.region || j.region || router.matched_region_name || 'the selected region';
const intent = router.intent_type || j.intent_type || 'weather_summary_query';
const field = router.requested_field || j.requested_field || '';
const query = String(m.user_query || j.user_query || j.chatInput || j.original_message || '').toLowerCase();
const responseLanguage = String(j.response_language || m.response_language || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en';
const repeated = Number(m.repeated_question_count || j.repeated_question_count) || 0;
const variant = (Number(m.response_variant || j.response_variant) || 0) % 4;
const channel = router.channel || j.channel || 'chat';
function fmt(value, unit) {
  if (value === null || value === undefined || value === '') return 'Not available';
  const clean = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
  return String(clean) + (unit || '');
}
const temperature = t.temperature_celsius ?? j.temperature_celsius;
const humidity = t.humidity_percentage ?? j.humidity_percentage;
const heatIndex = p.heat_index_celsius ?? j.heat_index_celsius;
const vpd = p.vapor_pressure_deficit_kpa ?? j.vapor_pressure_deficit_kpa;
const wind = t.wind_speed_kmh ?? j.wind_speed_kmh;
const gridSurge = p.grid_demand_surge_percent ?? j.grid_demand_surge_percent;
const thermal = p.thermal_overhead_percent ?? j.thermal_overhead_percent;
const evaporation = p.evaporation_loss_percent ?? j.evaporation_loss_percent;
const irrigation = l.water_irrigation_efficiency_pct ?? j.water_irrigation_efficiency_pct;
const capacity = l.grid_available_capacity_mw ?? j.grid_available_capacity_mw;
const risk = riskState.initial_risk_level ?? j.risk_level ?? 'Not available';
const score = riskState.mission_criticality_score ?? j.mission_criticality_score;
const openings = [
  'Here’s a clear read of the latest data for ' + region + '.',
  'I’ve checked the current regional signals for ' + region + '.',
  'Let’s break down what the latest readings mean for ' + region + '.',
  'Here’s the practical picture for ' + region + ' right now.'
];
let opening = repeated > 0
  ? ['I’ve refreshed that check, and I’ll explain it from a different angle.', 'I checked the same question again against the current regional data.', 'Absolutely — here’s an updated, more practical breakdown.', 'Let’s revisit it with clearer context and next steps.'][variant]
  : openings[variant];
if (/\b(i feel|i am|i'm|im feeling|feeling)\b.*\b(cold|freezing|chilly)\b/.test(query)) opening = 'I’m sorry you’re feeling cold. I’ve checked the current readings for ' + region + ' so we can make sense of it together.';
if (/\b(i feel|i am|i'm|im feeling|feeling)\b.*\b(hot|overheated|too warm)\b/.test(query)) opening = 'That sounds uncomfortable. I’ve checked the current readings for ' + region + ' so we can look at the heat conditions together.';
const lowRisk = String(risk).toUpperCase() === 'LOW';
let title = 'Current conditions';
let readings = [];
let meaning = '';
let actions = [];
if (intent === 'single_metric_query') {
  const metrics = { temperature: ['Temperature', temperature, '°C'], humidity: ['Humidity', humidity, '%'], heat_index: ['Heat index', heatIndex, '°C'], vpd: ['Vapor-pressure deficit', vpd, ' kPa'], wind_speed: ['Wind speed', wind, ' km/h'] };
  const metric = metrics[field] || metrics.temperature;
  title = metric[0] + ' check';
  readings = [metric[0] + ': ' + fmt(metric[1], metric[2]), 'Regional risk: ' + risk, 'Mission criticality: ' + fmt(score, '/100')];
  meaning = metric[1] === null || metric[1] === undefined ? 'The selected-region feed does not currently contain this measurement, so I will not guess it.' : 'This is the latest value supplied by the WIaaS regional telemetry. Read it together with humidity, heat index, wind, and your immediate surroundings.';
  actions = ['Compare the reading with how conditions feel at your exact location.', 'Ask me for the complete weather picture if you want the related measurements.', 'For urgent health symptoms, use local medical guidance rather than relying on a dashboard reading.'];
} else if (intent === 'section_query' && field === 'agriculture') {
  title = 'Agriculture outlook';
  readings = ['VPD: ' + fmt(vpd, ' kPa'), 'Evaporation loss: ' + fmt(evaporation, '%'), 'Irrigation efficiency: ' + fmt(irrigation, '%'), 'Regional risk: ' + risk];
  meaning = lowRisk ? 'The indicators point to manageable crop and irrigation stress, although field conditions can vary locally.' : 'The indicators justify closer crop, soil-moisture, and irrigation monitoring.';
  actions = ['Check soil moisture before changing irrigation timing.', 'Protect exposed workers and livestock during stressful weather.', 'Ask for a detailed agriculture report before making a major operational change.'];
} else if (intent === 'section_query' && field === 'grid') {
  title = 'Grid outlook';
  readings = ['Available capacity: ' + fmt(capacity, ' MW'), 'Demand surge: ' + fmt(gridSurge, '%'), 'Thermal overhead: ' + fmt(thermal, '%'), 'Regional risk: ' + risk];
  meaning = lowRisk ? 'The supplied signals do not indicate major environmental grid pressure right now.' : 'Environmental stress may increase cooling demand or reduce operating margin, so trend monitoring matters.';
  actions = ['Watch peak-demand periods and reserve margin.', 'Inspect heat-sensitive equipment if local conditions worsen.', 'Request the full grid report for specialist detail.'];
} else if (intent === 'section_query' && field === 'logistics') {
  title = 'Logistics outlook';
  readings = ['Wind speed: ' + fmt(wind, ' km/h'), 'Heat index: ' + fmt(heatIndex, '°C'), 'Regional risk: ' + risk, 'Mission criticality: ' + fmt(score, '/100')];
  meaning = lowRisk ? 'The available regional signals suggest generally manageable movement conditions.' : 'Conditions may affect timing, worker exposure, vehicle stress, or route reliability.';
  actions = ['Check local road and authority updates before dispatch.', 'Adjust timing for heat, wind, or visibility where needed.', 'Ask for a route-focused logistics assessment if you have an origin and destination.'];
} else if (intent === 'section_query') {
  title = 'Research summary';
  readings = ['Backend status: ' + (m.backend_status || j.backend_status || 'Not available'), 'Temperature: ' + fmt(temperature, '°C'), 'Humidity: ' + fmt(humidity, '%'), 'Regional risk: ' + risk];
  meaning = 'These are selected-region observations and deterministic WIaaS calculations. Missing measurements are left unavailable rather than estimated.';
  actions = ['Ask about one metric for a focused explanation.', 'Ask for a full multi-agent report for sector-by-sector analysis.', 'Keep the selected location current before comparing regions.'];
} else {
  readings = ['Temperature: ' + fmt(temperature, '°C'), 'Humidity: ' + fmt(humidity, '%'), 'Heat index: ' + fmt(heatIndex, '°C'), 'Wind speed: ' + fmt(wind, ' km/h'), 'VPD: ' + fmt(vpd, ' kPa'), 'Regional risk: ' + risk];
  meaning = lowRisk ? 'The available signals look broadly stable, with no major regional stress indicated by the current risk state.' : 'The current indicators are elevated enough to keep monitoring, especially where local conditions differ from the regional reading.';
  actions = ['Use the exact city selection for the most relevant context.', 'Tell me whether you care most about comfort, farming, grid, or travel.', 'Ask for a detailed report when you need all specialist sectors together.'];
}
const followups = [
  'Would you like me to explain the comfort impact, forecast context, or operational impact next?',
  'Which part should we explore next: weather, agriculture, grid, logistics, or research?',
  'Do you want a quick explanation of one reading or the full specialist report?',
  'What matters most to you here—personal comfort, safety, farming, power, or travel?'
];
const englishOutput = [opening, '', '**' + title + '**', ...readings.map((item) => '- ' + item), '', '**What it means**', meaning, '', '**Useful next steps**', ...actions.map((item, index) => (index + 1) + '. ' + item), '', followups[variant]].join('\n');
function urduValue(value, unit) {
  const formatted = fmt(value, unit);
  return formatted === 'Not available' ? 'دستیاب نہیں' : formatted;
}
let urduTitle = 'موجودہ موسمی حالات';
let urduReadings = ['درجہ حرارت: ' + urduValue(temperature, '°C'), 'نمی: ' + urduValue(humidity, '%'), 'ہیٹ انڈیکس: ' + urduValue(heatIndex, '°C'), 'ہوا کی رفتار: ' + urduValue(wind, ' km/h'), 'وی پی ڈی: ' + urduValue(vpd, ' kPa'), 'علاقائی خطرہ: ' + risk];
let urduMeaning = lowRisk ? 'دستیاب اشارے مجموعی طور پر مستحکم ہیں اور اس وقت کسی بڑے علاقائی دباؤ کی نشاندہی نہیں کرتے۔' : 'موجودہ اشارے بلند ہیں، اس لیے مقامی حالات اور اگلی تازہ کاری پر نظر رکھنا ضروری ہے۔';
let urduActions = ['درست معلومات کے لیے منتخب شہر کی تصدیق رکھیں۔', 'بتائیں کہ آپ کو ذاتی آرام، زراعت، بجلی یا سفر میں سے کس پہلو کی زیادہ فکر ہے۔', 'تمام شعبوں کی تفصیل کے لیے مکمل رپورٹ مانگیں۔'];
if (intent === 'single_metric_query') {
  const metricMap = { temperature: ['درجہ حرارت', temperature, '°C'], humidity: ['نمی', humidity, '%'], heat_index: ['ہیٹ انڈیکس', heatIndex, '°C'], vpd: ['وی پی ڈی', vpd, ' kPa'], wind_speed: ['ہوا کی رفتار', wind, ' km/h'] };
  const metric = metricMap[field] || metricMap.temperature;
  urduTitle = metric[0] + ' کی جانچ';
  urduReadings = [metric[0] + ': ' + urduValue(metric[1], metric[2]), 'علاقائی خطرہ: ' + risk, 'مشن اسکور: ' + urduValue(score, '/100')];
  urduMeaning = metric[1] === null || metric[1] === undefined ? 'یہ پیمائش ابھی دستیاب نہیں، اس لیے میں کوئی اندازہ شامل نہیں کر رہا۔' : 'یہ منتخب علاقے کی تازہ ترین WIaaS ریڈنگ ہے۔ اسے نمی، ہیٹ انڈیکس، ہوا اور اپنے فوری ماحول کے ساتھ سمجھیں۔';
  urduActions = ['ریڈنگ کا اپنے مقام کے حقیقی احساس سے موازنہ کریں۔', 'متعلقہ پیمائشوں کے لیے مکمل موسمی خلاصہ پوچھیں۔', 'شدید طبی علامات کی صورت میں مقامی طبی رہنمائی حاصل کریں۔'];
} else if (intent === 'section_query' && field === 'agriculture') {
  urduTitle = 'زرعی صورتحال';
  urduReadings = ['وی پی ڈی: ' + urduValue(vpd, ' kPa'), 'بخاراتی نقصان: ' + urduValue(evaporation, '%'), 'آبپاشی کی کارکردگی: ' + urduValue(irrigation, '%'), 'علاقائی خطرہ: ' + risk];
  urduMeaning = lowRisk ? 'فصل اور آبپاشی کا دباؤ قابلِ انتظام دکھائی دیتا ہے، تاہم کھیت کی مقامی حالت مختلف ہو سکتی ہے۔' : 'فصل، مٹی کی نمی اور آبپاشی کی زیادہ قریب سے نگرانی ضروری ہے۔';
  urduActions = ['آبپاشی بدلنے سے پہلے مٹی کی نمی چیک کریں۔', 'سخت موسم میں کارکنوں اور مویشیوں کو محفوظ رکھیں۔', 'بڑے فیصلے سے پہلے تفصیلی زرعی رپورٹ مانگیں۔'];
} else if (intent === 'section_query' && field === 'grid') {
  urduTitle = 'بجلی کے گرڈ کی صورتحال';
  urduReadings = ['دستیاب گنجائش: ' + urduValue(capacity, ' MW'), 'طلب میں اضافہ: ' + urduValue(gridSurge, '%'), 'حرارتی اوورہیڈ: ' + urduValue(thermal, '%'), 'علاقائی خطرہ: ' + risk];
  urduMeaning = lowRisk ? 'موجودہ اشارے اس وقت بڑے گرڈ دباؤ کی نشاندہی نہیں کرتے۔' : 'ماحولیاتی دباؤ کولنگ کی طلب بڑھا سکتا ہے، اس لیے رجحان کی نگرانی ضروری ہے۔';
  urduActions = ['زیادہ طلب کے اوقات اور ریزرو مارجن دیکھیں۔', 'حالات خراب ہوں تو حرارت سے متاثرہ آلات چیک کریں۔', 'مزید تفصیل کے لیے مکمل گرڈ رپورٹ مانگیں۔'];
} else if (intent === 'section_query' && field === 'logistics') {
  urduTitle = 'لاجسٹکس کی صورتحال';
  urduReadings = ['ہوا کی رفتار: ' + urduValue(wind, ' km/h'), 'ہیٹ انڈیکس: ' + urduValue(heatIndex, '°C'), 'علاقائی خطرہ: ' + risk, 'مشن اسکور: ' + urduValue(score, '/100')];
  urduMeaning = lowRisk ? 'علاقائی اشاروں کے مطابق نقل و حرکت عمومی طور پر قابلِ انتظام ہے۔' : 'حالات وقت، کارکنوں، گاڑیوں یا راستے کی قابلِ اعتماد حالت کو متاثر کر سکتے ہیں۔';
  urduActions = ['روانگی سے پہلے مقامی سڑک اور سرکاری اپ ڈیٹس چیک کریں۔', 'گرمی، ہوا یا کم نظر آنے کی صورت میں وقت تبدیل کریں۔', 'آغاز اور منزل کے ساتھ روٹ پر مبنی جائزہ مانگیں۔'];
}
const urduOpenings = repeated > 0 ? ['میں نے اسی سوال کو دوبارہ تازہ معلومات کے ساتھ دیکھا ہے۔', 'یہ اسی صورتحال کی نئی اور زیادہ واضح وضاحت ہے۔', 'ضرور، آئیے اسے عملی ترجیحات کے ساتھ دوبارہ سمجھتے ہیں۔', 'میں نے تازہ ریڈنگ دوبارہ چیک کر لی ہے۔'] : ['میں نے ' + region + ' کی تازہ معلومات دیکھ لی ہیں۔', 'آئیے ' + region + ' کی موجودہ صورتحال واضح انداز میں دیکھتے ہیں۔', 'یہ ' + region + ' کی تازہ عملی تصویر ہے۔', 'میں نے منتخب علاقے کے موجودہ اشاروں کا جائزہ لیا ہے۔'];
const urduOutput = [urduOpenings[variant], '', '**' + urduTitle + '**', ...urduReadings.map((item) => '- ' + item), '', '**اس کا مطلب**', urduMeaning, '', '**اگلے مفید اقدامات**', ...urduActions.map((item, index) => (index + 1) + '. ' + item), '', 'آپ اگلا جواب موسم، زراعت، بجلی، سفر یا ذاتی آرام میں سے کس بارے میں چاہتے ہیں؟'].join('\n');
const typoNote = router.typo_note || j.typo_note || '';
const selectedOutput = responseLanguage === 'ur' ? urduOutput : englishOutput;
const finalOutput = typoNote && responseLanguage === 'en' ? typoNote + '\n\n' + selectedOutput : selectedOutput;
return [{ json: { ...j, output: finalOutput, chat_response: finalOutput, final_response: finalOutput, speech_en: englishOutput, speech_ur: urduOutput, response_language: responseLanguage, channel } }];`);

  node(workflow, 'Format Region List').parameters.jsCode = formatRegionListCode;
  makeCodeNode(node(workflow, 'Respond Analysis'), String.raw`const j = $input.first().json || {};
const output = String(j.chat_response || j.final_response || j.output || 'No analysis generated.');
return [{ json: { output, speech_en: j.speech_en || '', speech_ur: j.speech_ur || '', response_language: j.response_language || 'en' } }];`);
  makeCodeNode(node(workflow, 'Respond FAQ'), String.raw`const j = $input.first().json || {};
const output = String(j.output || j.direct_response || 'I can help with WIaaS climate intelligence.');
return [{ json: { ...j, output, speech_en: j.speech_en || output, speech_ur: j.speech_ur || '', response_language: j.response_language || 'en' } }];`);

  const router = node(workflow, 'Regex Router');
  router.parameters.jsCode = replaceOnce(
    router.parameters.jsCode,
    'const cr = score(CRISIS), fq = score(FAQ_DEF), mV = score(MATH_VERBS);',
    "const selectedPayload = { ...input, ...body };\nconst hasSelectedRegion = Boolean(selectedPayload.region_key || selectedPayload.region_name || (selectedPayload.region_context && (selectedPayload.region_context.key || selectedPayload.region_context.name)));\nconst cr = score(CRISIS), fq = score(FAQ_DEF), mV = score(MATH_VERBS);",
    'WIaaS selected-region routing',
  );
  router.parameters.jsCode = replaceOnce(
    router.parameters.jsCode,
    'if (cr.length > 0) { route = "crisis_triage_agent";',
    'if (hasSelectedRegion && fq.length === 0 && mV.length === 0) { route = "wiaas_analysis_agent"; model = "existing-wiaas"; confidence = 0.98; reason = "Selected Asia region context"; }\nelse if (cr.length > 0) { route = "crisis_triage_agent";',
    'WIaaS crisis route',
  );
  router.parameters.jsCode = replaceOnce(
    router.parameters.jsCode,
    'const cr = score(CRISIS), fq = score(FAQ_DEF), mV = score(MATH_VERBS);',
    "const asksRegionAccess = /(?:what|which|show|list|tell).{0,28}(?:regions?|locations?|cities|countries).{0,24}(?:access|support|cover|available)|(?:regions?|locations?).{0,24}(?:do you have|can you access|are supported)/i.test(original) || /(?:کن علاقوں|کون سے علاقوں|علاقوں تک رسائی|دستیاب علاقے|علاقوں کی فہرست)/.test(original);\nconst cr = score(CRISIS), fq = score(FAQ_DEF), mV = score(MATH_VERBS);",
    'WIaaS region-access regex route',
  );
  router.parameters.jsCode = replaceOnce(
    router.parameters.jsCode,
    'if (hasSelectedRegion && fq.length === 0 && mV.length === 0) { route = "wiaas_analysis_agent";',
    'if (asksRegionAccess) { route = "wiaas_analysis_agent"; model = "existing-wiaas"; confidence = 0.99; reason = "Asian region access list"; }\nelse if (hasSelectedRegion && fq.length === 0 && mV.length === 0) { route = "wiaas_analysis_agent";',
    'WIaaS region-access route priority',
  );

  const scopeRule = '\nAsia scope: Always use the exact selected region metadata provided in the state vector. Never substitute a global demo region or infer a different country. Preserve city, province, country, timezone, and coordinates when present. If a value is missing, say it is unavailable rather than inventing it. Sound warm, calm, and human: acknowledge concern or discomfort without pretending to have emotions. If a selected location exists, never ask for it again. When response_language is ur, answer naturally in Urdu; otherwise answer in English. Use response_variant and repeated_question_count to vary the opening, explanation angle, and follow-up when a question repeats. For a standard query, use short paragraphs, clear headings, useful bullets, interpretation, and 2-3 practical next steps within 260 words. For an explicit full, comprehensive, detailed, technical, or multi-agent report, provide a detailed specialist section with exact available metrics, their operational meaning, one prioritized sector action, and no filler. The deterministic backend remains the source of calculations; do not recalculate or invent measurements.';
  for (const name of ['Research Agent', 'Agri  Agent', 'Grid Agent', 'Logistic Agent']) {
    const target = node(workflow, name);
    target.parameters.options.systemMessage = String(target.parameters.options.systemMessage || '') + scopeRule;
  }

  for (const [name, maxTokens] of [['FW Research Model', 450], ['FW Sector Model', 350], ['FW Logistics Model', 350]]) {
    const model = node(workflow, name);
    model.parameters.options = { ...(model.parameters.options || {}), maxTokens };
  }

  // Preserve the original 0-token regression guarantee: if a specialist model
  // is unavailable or returns an empty payload, build that section directly
  // from the shared physics state instead of returning an empty report.
  function setOutputField(nodeName, fieldName, stringValue) {
    const values = node(workflow, nodeName).parameters.fields.values;
    const field = values.find((item) => item.name === fieldName);
    if (!field) throw new Error(`Missing field ${fieldName} on ${nodeName}`);
    field.stringValue = stringValue;
  }

  setOutputField('Save Agri Output', 'agriculture_impact', String.raw`={{ (() => {
    const output = $json.output || $json.text || $json.response || $json.chatOutput || $json.message?.content;
    if (/[.!?][\"')\]]?$/.test(String(output || '').trim())) return output;
    let state = {};
    try { const raw = $('Save Research Output').first().json.state_vector; state = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
    const p = state.physics_metrics || {}, l = state.ledger || {};
    return 'Agriculture conditions show VPD ' + (p.vapor_pressure_deficit_kpa ?? 'n/a') + ' kPa, evaporation loss ' + (p.evaporation_loss_percent ?? 'n/a') + '%, and irrigation efficiency ' + (l.water_irrigation_efficiency_pct ?? 'n/a') + '%. Prioritize irrigation during cooler hours, protect soil moisture, and monitor crop stress against the live regional readings.';
  })() }}`);

  setOutputField('Save Grid Output', 'grid_impact', String.raw`={{ (() => {
    const output = $json.output || $json.text || $json.response || $json.chatOutput || $json.message?.content;
    if (/[.!?][\"')\]]?$/.test(String(output || '').trim())) return output;
    let state = {};
    try { const raw = $('Save Agri Output').first().json.state_vector; state = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
    const p = state.physics_metrics || {}, l = state.ledger || {}, r = state.calculated_risk_state || {};
    return 'Grid conditions show ' + (l.grid_available_capacity_mw ?? 'n/a') + ' MW available capacity, a ' + (p.grid_demand_surge_percent ?? 'n/a') + '% demand surge, and ' + (p.thermal_overhead_percent ?? 'n/a') + '% thermal overhead. Current risk is ' + (r.initial_risk_level || 'unavailable') + '; protect reserve margin and monitor peak cooling load.';
  })() }}`);

  const logisticsFallback = String.raw`(() => {
    let state = {};
    try { const raw = $('Save Grid Output').first().json.state_vector; state = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
    const p = state.physics_metrics || {}, t = state.telemetry || {}, r = state.calculated_risk_state || {};
    const wind = Number.isFinite(Number(t.wind_speed_kmh)) ? Math.round(Number(t.wind_speed_kmh) * 100) / 100 : (t.wind_speed_kmh ?? 'n/a');
    return {
      logistics_impact: 'Logistics readiness is operating under ' + (r.initial_risk_level || 'unavailable') + ' regional risk, with wind at ' + wind + ' km/h and thermal overhead at ' + (p.thermal_overhead_percent ?? 'n/a') + '%. Protect heat-sensitive cargo and keep essential routes under live monitoring.',
      next_actions: [
        { title: 'Protect field operations', description: 'Move heat-sensitive agriculture and outdoor activity to cooler operating windows.' },
        { title: 'Protect grid reserve', description: 'Monitor demand surge and thermal overhead before the regional peak.' },
        { title: 'Protect essential movement', description: 'Track weather and road conditions for priority logistics routes.' }
      ]
    };
  })()`;
  setOutputField('Save Logistics Output', 'logistics_impact', String.raw`={{ (() => {
    const output = $json.output || $json.text || $json.response || $json.chatOutput || $json.message?.content;
    let parsed = null;
    if (String(output || '').trim()) {
      try { parsed = JSON.parse(String(output).replace(/^\x60\x60\x60json/i, '').replace(/^\x60\x60\x60/i, '').replace(/\x60\x60\x60$/i, '').trim()); } catch (e) {}
    }
    const fallback = ${logisticsFallback};
    return parsed?.logistics_impact || parsed?.logisticsImpact || fallback.logistics_impact;
  })() }}`);
  setOutputField('Save Logistics Output', 'next_actions', String.raw`={{ (() => {
    const output = $json.output || $json.text || $json.response || $json.chatOutput || $json.message?.content;
    let parsed = null;
    if (String(output || '').trim()) {
      try { parsed = JSON.parse(String(output).replace(/^\x60\x60\x60json/i, '').replace(/^\x60\x60\x60/i, '').replace(/\x60\x60\x60$/i, '').trim()); } catch (e) {}
    }
    const fallback = ${logisticsFallback};
    return JSON.stringify(parsed?.next_actions || parsed?.nextActions || fallback.next_actions);
  })() }}`);

  const sanitizer = node(workflow, 'Sanitizer');
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'let s = String(t).replace(/```[a-z]*|```/gi, "");',
    'let s = String(t).replace(/```[a-z]*|```/gi, "").replace(/\\*\\*/g, "").replace(/^[-#]+\\s*/gm, "");',
    'WIaaS report markdown cleanup',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'function num(v){',
    `function capWords(value, maxWords){
  const original = String(value || '').trim();
  const matches = [...original.matchAll(/\\S+/g)];
  if(matches.length <= maxWords) return original;
  const last = matches[Math.max(0, maxWords - 1)];
  const candidate = original.slice(0, last.index + last[0].length).trim();
  const endings = [...candidate.matchAll(/[.!?](?=\\s|$)/g)];
  if(endings.length && endings[endings.length - 1].index > 20){
    return candidate.slice(0, endings[endings.length - 1].index + 1).trim();
  }
  return candidate.replace(/[,:;(\\[]+$/, '').trim() + '…';
}

function num(v){`,
    'WIaaS report word limiter helper',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'const research = trimIncomplete(clean(src.research_summary)) || "Live backend metrics are summarized above.";',
    'const rawResearch = clean(src.research_summary);\nconst researchUnavailable = /^(no research summary(?: generated)?|research summary unavailable|n\\/?a\\.?)$/i.test(rawResearch);\nconst research = (!researchUnavailable && capWords(rawResearch, 120)) || `The selected region is currently assessed at ${riskLevel} operational risk with a mission criticality score of ${fmt(missionScore)}. The research layer combines the live temperature (${fmt(t.temperature_celsius)}°C), humidity (${fmt(t.humidity_percentage)}%), heat index (${fmt(p.heat_index_celsius)}°C), VPD (${fmt(p.vapor_pressure_deficit_kpa)} kPa), grid-demand surge (${fmt(p.grid_demand_surge_percent)}%), and thermal-overhead (${fmt(p.thermal_overhead_percent)}%) signals. Use this evidence as a current situational baseline and refresh the analysis when conditions change.`;',
    'WIaaS research section cap',
  );
  sanitizer.parameters.jsCode = sanitizer.parameters.jsCode.replace(
    'const research = (!researchUnavailable && capWords(rawResearch, 120)) ||',
    'const researchLooksLikeMetadata = /(?:comprehensive specialist report|^\\s*region:|timezone:|coordinates:)/i.test(rawResearch) || /[([][^)\\]]*$/.test(rawResearch);\nconst researchIncomplete = rawResearch && !/[.!?]["”]?$/.test(rawResearch);\nconst research = (!researchUnavailable && !researchLooksLikeMetadata && !researchIncomplete && capWords(rawResearch, 120)) ||',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'const agri = trimIncomplete(clean(src.agriculture_impact)) || "See live metrics for current agricultural conditions.";',
    'const agri = capWords(clean(src.agriculture_impact), 110) || "See live metrics for current agricultural conditions.";',
    'WIaaS agriculture section cap',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'const grid = trimIncomplete(clean(src.grid_impact)) || "See live metrics for current grid conditions.";',
    'const grid = capWords(clean(src.grid_impact), 110) || "See live metrics for current grid conditions.";',
    'WIaaS grid section cap',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'const logistics = trimIncomplete(clean(logisticsText)) || "See live metrics for current logistics readiness.";',
    'const logistics = capWords(clean(logisticsText), 70) || "See live metrics for current logistics readiness.";',
    'WIaaS logistics section cap',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    'return [{ json: { output: report, chat_response: report, final_response: report, channel } }];',
    `const requestedLimit = Number(m.max_response_words || 650);
const boundedReport = capWords(report, Number.isFinite(requestedLimit) ? Math.max(200, Math.min(650, requestedLimit)) : 650);
return [{ json: { output: boundedReport, chat_response: boundedReport, final_response: boundedReport, channel } }];`,
    'WIaaS final report cap',
  );
  sanitizer.parameters.jsCode = replaceOnce(
    sanitizer.parameters.jsCode,
    `\nLive Metrics:\n\${metrics}\n\nResearch Summary:\n\${research}\n\nAgriculture Impact:`,
    `\nResearch Summary:\n\${research}\n\nLive Metrics:\n\${metrics}\n\nAgriculture Impact:`,
    'WIaaS research summary placement',
  );

  const conversation = node(workflow, 'Conversation Agent');
  conversation.parameters.options.systemMessage = String(conversation.parameters.options.systemMessage || '')
    .replace('Tell me your region and country', 'Use the selected Region-panel location when it is provided')
    .replace('If user provides city, country, state, region, or backend key, route to analysis.', 'If the request includes selected region context, use it directly. Otherwise ask for an Asian city, country, province, or region.')
    .replace('Never assume Boston, Togo, Pakistan, USA, or previous regions unless the user clearly provides it.', 'Never substitute a global demo region. This workflow is scoped to Asia; use only a supplied Asian location or ask for one.')
    .replace('Output: natural text only. No JSON. No markdown. No fake metrics. Under 60 words.', 'Output natural text only. No JSON and no fake metrics. Be concise for greetings, but for a real question use short paragraphs or bullets with what you understood, what is known, and one helpful follow-up. Never repeat the exact same wording when repeated_question_count is greater than zero. Stay under 220 words.');

  workflow.name = 'WIaaS - Asia Intelligence';
  return workflow;
}

function updateCrisisLens(workflow) {
  workflow.nodes = workflow.nodes.filter((item) => item.name !== 'When chat message received');
  delete workflow.connections['When chat message received'];
  node(workflow, 'CrisisLens Webhook').parameters.path = 'wiaas-asia-crisislens';

  const parser = node(workflow, 'Parse User Request');
  let code = parser.parameters.jsCode;
  code = replaceOnce(code,
    'const input = { ...raw, ...body };',
    "const input = { ...raw, ...body };\nconst suppliedContext = input.region_context && typeof input.region_context === 'object' ? input.region_context : {};\nconst suppliedLatitude = Number(input.latitude ?? suppliedContext.latitude);\nconst suppliedLongitude = Number(input.longitude ?? suppliedContext.longitude);\nconst hasSuppliedCoordinates = Number.isFinite(suppliedLatitude) && Number.isFinite(suppliedLongitude);",
    'CrisisLens selected context');
  code = replaceOnce(code,
    "const source_channel = chatInput || raw.action === 'sendMessage' || raw.sessionId ? 'chat' : 'webhook';",
    "const source_channel = (raw.headers !== undefined || raw.body !== undefined) ? 'webhook' : 'chat';",
    'CrisisLens webhook source detection');
  code = replaceOnce(code,
    "const explicitRegion = String(typeof input.region === 'string' ? input.region : '').trim();",
    "const explicitRegion = String((typeof input.region === 'string' && input.region) || input.region_name || suppliedContext.name || suppliedContext.city || suppliedContext.country || '').trim();",
    'CrisisLens explicit region');
  code = replaceOnce(code,
    'const lower = message.toLowerCase();',
    "const classificationMessage = [message, input.routing_query].filter(Boolean).join(' ');\nconst lower = classificationMessage.toLowerCase();\nconst asksRegionAccess = /(?:what|which|show|list|tell).{0,28}(?:regions?|locations?|cities|countries).{0,24}(?:access|support|cover|available)|(?:regions?|locations?).{0,24}(?:do you have|can you access|are supported)/i.test(classificationMessage) || /(?:کن علاقوں|کون سے علاقوں|علاقوں تک رسائی|دستیاب علاقے|علاقوں کی فہرست)/.test(classificationMessage);\nconst availableRegionSource = Array.isArray(input.available_regions) ? input.available_regions : [];\nconst accessibleRegionNames = [...new Set(availableRegionSource.map((item) => typeof item === 'string' ? item : (item && (item.name || item.region_name || item.city || item.country))).filter(Boolean))];",
    'CrisisLens bilingual classification text');
  code = replaceOnce(code,
    'const missingRegion = !region_query && !isGreeting;',
    'const missingRegion = !region_query && !isGreeting && !asksRegionAccess;',
    'CrisisLens region-list bypass');
  code = replaceOnce(code,
    "if (intent === 'greeting') {",
    `if (asksRegionAccess) {
  direct_response = {
    ok: true,
    response_kind: 'REGION_ACCESS',
    overall_threat_level: 'NONE',
    correlation_status: 'NOT_APPLICABLE',
    regional_summary: 'CrisisLens supports the Asian regions supplied by the WIaaS Region panel.',
  };
} else if (intent === 'greeting') {`,
    'CrisisLens region-list response');
  code = code.replace(/\.test\(message\)/g, '.test(classificationMessage)');
  code = code.replace(/  const known = \[[\s\S]*?  \];\n  for \(const \[region, pattern\] of known\)/,
    "  const known = [];\n  for (const [region, pattern] of known)");
  code = replaceOnce(code,
    '    needs_geocode: !direct_response && !canUseCachedAction && !canUseCachedEvidence && !canUseCachedSeverity,',
    '    needs_geocode: !hasSuppliedCoordinates && !direct_response && !canUseCachedAction && !canUseCachedEvidence && !canUseCachedSeverity,',
    'CrisisLens geocode bypass');
  code = replaceOnce(code,
    '    cached_assessment: canUseCachedAction || canUseCachedEvidence || canUseCachedSeverity ? memory.last_assessment : null,',
    "    cached_assessment: canUseCachedAction || canUseCachedEvidence || canUseCachedSeverity ? memory.last_assessment : null,\n    schema_version: input.schema_version || 'wiaas.asia.chat.v1',\n    request_kind: input.request_kind || 'standard_query',\n    execution_mode: input.execution_mode || 'efficient',\n    response_style: input.response_style || 'structured',\n    max_response_words: Number(input.max_response_words) || 300,\n    token_strategy: input.token_strategy || 'deterministic_and_cached_first',\n    turn_index: Number(input.turn_index) || 1,\n    repeated_question_count: Number(input.repeated_question_count) || 0,\n    response_variant: Number(input.response_variant) || 0,\n    recent_user_messages: Array.isArray(input.recent_user_messages) ? input.recent_user_messages.slice(-5) : [],\n    region_key: String(input.region_key || suppliedContext.key || ''),\n    region_name: String(input.region_name || suppliedContext.name || explicitRegion || ''),\n    region_context: { ...suppliedContext, key: input.region_key || suppliedContext.key || '', name: input.region_name || suppliedContext.name || explicitRegion || '', city: input.city || suppliedContext.city || '', province: input.province || suppliedContext.province || '', country: input.country || suppliedContext.country || '', country_code: input.country_code || suppliedContext.country_code || '', asian_subregion: input.asian_subregion || suppliedContext.asian_subregion || 'Asia', latitude: hasSuppliedCoordinates ? suppliedLatitude : null, longitude: hasSuppliedCoordinates ? suppliedLongitude : null, timezone: input.timezone || suppliedContext.timezone || '' },\n    supplied_telemetry: input.telemetry || null,\n    supplied_climate_matrix: input.climate_matrix || null,\n    supplied_ledger: input.ledger || input.synthetic_resource_ledger || null,",
    'CrisisLens output context');
  code = replaceOnce(code,
    '    turn_index: Number(input.turn_index) || 1,',
    "    response_language: String(input.response_language || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en',\n    routing_query: String(input.routing_query || ''),\n    accessible_region_names: accessibleRegionNames,\n    turn_index: Number(input.turn_index) || 1,",
    'CrisisLens response language');
  parser.parameters.jsCode = code;

  const prepare = node(workflow, 'Prepare API Context');
  code = prepare.parameters.jsCode;
  code = code.replace(/const adminFallbacks = \{[\s\S]*?adminFallbacks\['maritime region togo'\] = adminFallbacks\['maritime region, togo'\];/,
    'const adminFallbacks = {};');
  code = replaceOnce(code,
    "  const display = [region.name, region.admin1, region.country].filter(Boolean).join(', ');",
    "  const display = request.region_name || [...new Set([region.name, region.admin1, region.country].filter(Boolean))].join(', ');",
    'CrisisLens display name');
  code = replaceOnce(code,
    "    region_key: slug([region.country_code || region.country, region.admin1, region.name].filter(Boolean).join('_')) ,".replace(') ,', '),'),
    "    region_key: request.region_key || slug([region.country_code || region.country, region.admin1, region.name].filter(Boolean).join('_')) ,".replace(') ,', '),'),
    'CrisisLens region key');
  code = replaceOnce(code,
    "if (request.direct_response) {",
    `const supplied = request.region_context && typeof request.region_context === 'object' ? request.region_context : {};
const suppliedLat = Number(supplied.latitude ?? request.latitude);
const suppliedLon = Number(supplied.longitude ?? request.longitude);
const suppliedInsideAsia = Number.isFinite(suppliedLat) && Number.isFinite(suppliedLon) && suppliedLat >= -12 && suppliedLat <= 82 && suppliedLon >= 25 && suppliedLon <= 180;
if (!request.direct_response && suppliedInsideAsia) {
  return [{ json: outputForRegion({
    name: supplied.city || supplied.name || request.region_name || supplied.country || 'Selected Asian region',
    admin1: supplied.province || '',
    country: supplied.country || '',
    country_code: supplied.country_code || '',
    latitude: suppliedLat,
    longitude: suppliedLon,
    timezone: supplied.timezone || request.timezone || 'auto',
  }, 'wiaas_region_context') }];
}

if (request.direct_response) {`,
    'CrisisLens supplied coordinates');
  code = replaceOnce(code,
    "const hits = Array.isArray(geocode.results) ? geocode.results : [];",
    "const ASIA_CODES = new Set(['AF','AM','AZ','BH','BD','BT','BN','KH','CN','CY','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']);\nconst hits = (Array.isArray(geocode.results) ? geocode.results : []).filter((item) => ASIA_CODES.has(String(item.country_code || '').toUpperCase()));",
    'CrisisLens Asia geocode filter');
  prepare.parameters.jsCode = code;

  // External evidence providers are best-effort. A transient timeout from one
  // source must be recorded as unavailable, not abort the complete assessment.
  for (const name of [
    'Open-Meteo Weather API',
    'NASA FIRMS Fire API - ADD KEY',
    'GDACS Disaster Feed',
    'GDELT Regional News API',
  ]) {
    node(workflow, name).onError = 'continueRegularOutput';
  }

  makeCodeNode(node(workflow, 'Return to Frontend'), String.raw`let j = $input.first().json || {};
try { j = $('Save Conversation State').item.json || j; } catch (e) {}
let request = {};
try { request = $('Parse User Request').item.json || {}; } catch (e) {}
let stakeholder = request.requested_stakeholder || 'general_public';
const headings = { farmers: 'Farmer actions', grid_operators: 'Grid actions', emergency_authorities: 'Emergency actions', logistics_operators: 'Logistics actions', local_government: 'Local-government actions', general_public: 'Public actions' };
const actions = Array.isArray(j.recommended_actions && j.recommended_actions[stakeholder]) ? j.recommended_actions[stakeholder].slice(0, 3) : [];
const base = String(j.chat_message || j.regional_summary || j.output || j.message || 'No CrisisLens response was generated.');
const actionText = actions.length ? '\n\n' + (headings[stakeholder] || 'Recommended actions') + ':\n' + actions.map((item, index) => (index + 1) + '. ' + String(item)).join('\n') : '';
const successfulSources = Array.isArray(j.source_status && j.source_status.successful) ? j.source_status.successful.slice(0, 4) : [];
const sourceText = successfulSources.length && !/based on data from/i.test(base) ? '\n\nSources: ' + successfulSources.join(', ') + '.' : '';
const detailed = request.request_kind === 'comprehensive_report' || request.response_style === 'detailed';
function textOf(value) {
  if (value && typeof value === 'object') return String(value.short_finding || value.detail || value.description || value.title || value.message || JSON.stringify(value));
  return String(value || '');
}
function listLines(values, fallback) {
  const list = (Array.isArray(values) ? values : []).map(textOf).filter(Boolean).slice(0, 5);
  return list.length ? list.map((item, index) => (index + 1) + '. ' + item).join('\n') : fallback;
}
function capWords(value, maxWords) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? String(value || '').trim() : words.slice(0, maxWords).join(' ') + '…';
}
let reply = base + actionText + sourceText;
const accessNames = Array.isArray(request.accessible_region_names) ? request.accessible_region_names.filter(Boolean) : [];
if (!detailed) {
  const variant = (Number(request.response_variant) || 0) % 4;
  const repeated = Number(request.repeated_question_count) || 0;
  const kind = String(j.response_kind || '').toUpperCase();
  const userText = String(request.message || '').toLowerCase();
  if (kind === 'REGION_ACCESS') {
    const listed = accessNames.length ? accessNames.map((name) => '- ' + name).join('\n') : '- Select any Asian country or city available in the Region panel.';
    reply = ['CrisisLens currently has access to ' + accessNames.length + ' Asian regions:', '', listed, '', 'Select any listed region, then ask about weather threats, evidence, severity, public safety, agriculture, grid operations, logistics, or a full report.'].join('\n');
  } else if (kind === 'GREETING') {
    reply = [
      "Hi — I’m CrisisLens. What would you like to understand about your selected region?",
      "Hello! I’m ready to help you make sense of regional threats and practical next steps.",
      "Good to hear from you. Tell me what you’re noticing, and we’ll examine it together.",
      "Hi there. You can ask me naturally about weather, risk, evidence, or what to do next."
    ][variant];
  } else if (kind === 'REGION_REQUIRED') {
    const personal = /\b(i feel|i am|i'm|worried|scared|cold|hot|freezing|unwell)\b/.test(userText);
    const open = personal ? "I’m sorry you’re dealing with that. I can help you check it carefully." : "I can check that for you.";
    reply = open + '\n\n**Location needed**\nWhich Asian city, province, or country are you currently in? Once you tell me, I can check the relevant conditions and ask which detail matters most to you.';
  } else {
    const openings = repeated > 0
      ? ['I’ve checked that again and organized the answer a little differently.', 'Here’s a refreshed view of the same concern.', 'Absolutely — let’s revisit it with clearer priorities.', 'I rechecked the latest evidence and focused this answer on practical meaning.']
      : ['Here’s the clearest current assessment.', 'I’ve reviewed the available regional risk signals.', 'Let’s walk through what the evidence means.', 'Here’s the practical risk picture right now.'];
    const rawActions = actions.length ? actions.map(String) : ['Continue monitoring official local updates.', 'Recheck conditions if the situation changes.', 'Tell me which stakeholder or weather risk you want to focus on.'];
    const rotatedActions = rawActions.length > 1 ? rawActions.slice(variant % rawActions.length).concat(rawActions.slice(0, variant % rawActions.length)) : rawActions;
    const actionLines = rotatedActions.map((item, index) => (index + 1) + '. ' + item);
    const sourceLine = successfulSources.length ? successfulSources.join(', ') : 'No verified external source was returned for this response.';
    const perspectives = [
      'I’m keeping this centered on current weather and climate risk, with local official alerts taking priority over any regional model.',
      'From a planning angle, the useful question is what may change next and which low-regret action is worth taking now.',
      'From an evidence angle, the confidence comes from agreement between the listed sources; missing sources remain a limitation.',
      'From a personal-safety angle, use this regional assessment as context and follow local authorities if conditions change quickly.'
    ];
    const followups = [
      'Would you like current conditions, the near-term forecast, or one specific weather hazard next?',
      'Should I turn this into advice for residents, farmers, grid operators, or logistics teams?',
      'Do you want the supporting evidence, a severity explanation, or a city-to-city comparison?',
      'What matters most right now: rain, heat, wind, flooding, agriculture, power, or travel?'
    ];
    const assessmentTitles = ['Assessment', 'Updated weather-risk view', 'Evidence-led interpretation', 'Practical weather context'];
    reply = [openings[variant], '', '**' + assessmentTitles[variant] + '**', base, ...(repeated > 0 ? ['', perspectives[variant]] : []), '', '**Threat level**', '- Severity: ' + (j.overall_threat_level || 'UNKNOWN'), '- Correlation: ' + (j.correlation_status || 'UNKNOWN'), '', '**Practical next steps**', ...actionLines, '', '**Evidence sources**', sourceLine, '', followups[variant]].join('\n');
  }
}
if (detailed) {
  const threatLines = listLines(j.threats, 'No threshold-crossing active threat was detected from the available evidence.');
  const evidenceLines = listLines(j.evidence, 'No additional corroborating evidence was returned.');
  const sectorEntries = Object.entries(j.recommended_actions || {}).filter(([, value]) => Array.isArray(value) && value.length);
  const sectorLines = sectorEntries.length
    ? sectorEntries.slice(0, 5).map(([key, value]) => '- ' + (headings[key] || key.replace(/_/g, ' ')) + ': ' + value.slice(0, 2).map(String).join(' ')).join('\n')
    : '- No sector-specific impact is supported beyond general monitoring.';
  const monitoring = Array.isArray(j.monitoring_next) ? j.monitoring_next.map(textOf).join('; ') : textOf(j.monitoring_next || j.priority_message || 'Continue official local monitoring.');
  const gaps = Array.isArray(j.source_status && j.source_status.failed_or_unconfigured) ? j.source_status.failed_or_unconfigured.map(textOf).filter(Boolean) : [];
  const detailedReport = [
    'CrisisLens Comprehensive Assessment',
    '',
    'Region: ' + (j.region || j.resolved_location || j.active_region || request.region_name || 'Selected Asian region'),
    'Severity: ' + (j.overall_threat_level || 'UNKNOWN'),
    'Correlation: ' + (j.correlation_status || 'UNKNOWN'),
    '',
    'Executive Assessment:',
    base,
    '',
    'Detected Threats:',
    threatLines,
    '',
    'Evidence by Source:',
    evidenceLines,
    '',
    'Affected Sectors and Actions:',
    sectorLines,
    '',
    'Monitoring Triggers:',
    monitoring,
    '',
    'Limitations:',
    gaps.length ? gaps.join('; ') : 'No additional source limitations were reported; absence of an alert is not a guarantee that conditions cannot change.',
    '',
    'Sources:',
    successfulSources.length ? successfulSources.join(', ') : 'No verified source was returned.',
  ].join('\n');
  const limit = Math.max(220, Math.min(450, Number(request.max_response_words) || 450));
  reply = capWords(detailedReport, limit);
}
const englishReply = reply;
const responseLanguage = String(request.response_language || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en';
const responseKind = String(j.response_kind || '').toUpperCase();
const regionLabel = j.region || j.resolved_location || j.active_region || request.region_name || 'منتخب ایشیائی علاقہ';
const severity = j.overall_threat_level || 'UNKNOWN';
const correlation = j.correlation_status || 'UNKNOWN';
const sourceList = successfulSources.length ? successfulSources.join(', ') : 'کوئی تصدیق شدہ بیرونی ذریعہ دستیاب نہیں';
let urduReply = '';
if (responseKind === 'REGION_ACCESS') {
  const listed = accessNames.length ? accessNames.map((name) => '- ' + name).join('\n') : '- ریجن پینل میں دستیاب کوئی بھی ایشیائی ملک یا شہر منتخب کریں۔';
  urduReply = ['کرائسس لینز کو اس وقت ' + accessNames.length + ' ایشیائی علاقوں تک رسائی حاصل ہے:', '', listed, '', 'کسی علاقے کو منتخب کریں، پھر موسم، خطرات، شواہد، شدت، عوامی حفاظت، زراعت، بجلی، لاجسٹکس یا مکمل رپورٹ کے بارے میں پوچھیں۔'].join('\n');
} else if (responseKind === 'GREETING') {
  urduReply = 'السلام علیکم۔ میں کرائسس لینز ہوں۔ آپ اپنے منتخب علاقے کے موسم، سیلاب، آگ، آفات، شواہد یا عملی حفاظتی اقدامات کے بارے میں پوچھ سکتے ہیں۔';
} else if (responseKind === 'REGION_REQUIRED') {
  urduReply = 'میں آپ کے لیے یہ معلومات چیک کر سکتا ہوں۔\n\n**مقام درکار ہے**\nبراہ کرم اپنا ایشیائی شہر، صوبہ یا ملک بتائیں۔ اس کے بعد میں متعلقہ خطرات اور حالات کا جائزہ دوں گا۔';
} else {
  const riskMeaning = String(severity).toUpperCase() === 'LOW'
    ? 'دستیاب شواہد اس وقت کم خطرے کی نشاندہی کرتے ہیں، تاہم حالات بدل سکتے ہیں۔'
    : 'خطرے کی موجودہ سطح کی وجہ سے مقامی سرکاری ہدایات اور تازہ معلومات پر قریب سے نظر رکھیں۔';
  urduReply = [
    'میں نے ' + regionLabel + ' کے تازہ علاقائی خطرات کا جائزہ لیا ہے۔',
    '',
    '**موجودہ جائزہ**',
    riskMeaning,
    '',
    '**خطرے کی سطح**',
    '- شدت: ' + severity,
    '- شواہد کا باہمی تعلق: ' + correlation,
    '',
    '**عملی اگلے اقدامات**',
    '1. مقامی سرکاری انتباہات اور موسم کی تازہ معلومات دیکھتے رہیں۔',
    '2. غیر مصدقہ خبروں پر فوری عمل نہ کریں۔',
    '3. صورتحال بدلے تو دوبارہ خطرے کی جانچ کریں۔',
    '',
    '**شواہد کے ذرائع**',
    sourceList,
    '',
    'کیا آپ اگلا جائزہ عوامی حفاظت، کسانوں، بجلی، لاجسٹکس یا مکمل رپورٹ کے لیے چاہتے ہیں؟'
  ].join('\n');
}
reply = responseLanguage === 'ur' ? urduReply : englishReply;
return [{ json: {
  reply,
  chat_message: reply,
  speech_en: englishReply,
  speech_ur: urduReply,
  response_language: responseLanguage,
  response_kind: j.response_kind || '',
  region: j.region || j.resolved_location || j.active_region || '',
  region_key: j.region_key || '',
  overall_threat_level: j.overall_threat_level || 'UNKNOWN',
  correlation_status: j.correlation_status || 'UNKNOWN',
  recommended_actions: j.recommended_actions || {},
  source_status: j.source_status || {},
} }];`);

  const scopeRule = '\nAsia scope and grounding: Use the exact resolved Asian city/country and coordinates in the input. Treat API observations as evidence, distinguish observed data from inference, never substitute a global demo region, and never invent measurements, alerts, sources, or certainty. Sound calm, friendly, and human; acknowledge worry or discomfort without pretending to feel emotions. If the selected location exists, never ask for it again. When response_language is ur, answer naturally in Urdu; otherwise answer in English. Use response_variant and repeated_question_count so repeated questions get a fresh explanation angle and follow-up instead of copied wording. For a standard query, use short paragraphs, headings, the threat level, strongest evidence, and 3 practical actions within 300 words. For an explicit comprehensive or detailed threat report, expand to at most 450 words with severity, evidence by source, affected sectors, stakeholder actions, monitoring triggers, limitations, and a concise source list. Reuse cached assessment data for follow-ups and only call OSINT/action agents when the requested evidence or action is not already available.';
  for (const name of ['OSINT Correlation Agent', 'Action Recommendation Agent', 'Conversational Decision Agent', 'Cached Action Agent']) {
    const target = node(workflow, name);
    const options = target.parameters.options || (target.parameters.options = {});
    if (typeof options.systemMessage === 'string') options.systemMessage += scopeRule;
    else if (typeof target.parameters.text === 'string') target.parameters.text += scopeRule;
  }

  workflow.name = 'CrisisLens - Asia Threat Intelligence';
  return workflow;
}

fs.mkdirSync(outputRoot, { recursive: true });
const wiaas = updateWiaas(load(sourcePaths.wiaas));
const crisis = updateCrisisLens(load(sourcePaths.crisis));
fs.writeFileSync(outputPaths.wiaas, JSON.stringify(wiaas, null, 2) + '\n');
fs.writeFileSync(outputPaths.crisis, JSON.stringify(crisis, null, 2) + '\n');

console.log(JSON.stringify({
  outputs: outputPaths,
  webhookPaths: {
    wiaas: node(wiaas, 'Webhook Trigger').parameters.path,
    crisis: node(crisis, 'CrisisLens Webhook').parameters.path,
  },
  nodes: { wiaas: wiaas.nodes.length, crisis: crisis.nodes.length },
}, null, 2));
