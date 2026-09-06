import { showToast } from './toast.js';

const MODEL_ID = 'onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const scannerState = {
    file: null,
    previewUrl: '',
    crop: 'auto',
    result: null,
    phase: 'idle',
    progress: 0,
    statusText: '',
};

let classifierPromise = null;

const CROP_OPTIONS = [
    ['auto', 'Auto-detect crop', 'فصل خود شناخت کریں'],
    ['apple', 'Apple', 'سیب'],
    ['blueberry', 'Blueberry', 'بلیو بیری'],
    ['cherry', 'Cherry', 'چیری'],
    ['corn', 'Corn / Maize', 'مکئی'],
    ['grape', 'Grape', 'انگور'],
    ['orange', 'Orange', 'سنترہ'],
    ['peach', 'Peach', 'آڑو'],
    ['pepper', 'Bell pepper', 'شملہ مرچ'],
    ['potato', 'Potato', 'آلو'],
    ['raspberry', 'Raspberry', 'راسبیری'],
    ['soybean', 'Soybean', 'سویا بین'],
    ['squash', 'Squash', 'کدو'],
    ['strawberry', 'Strawberry', 'اسٹرابیری'],
    ['tomato', 'Tomato', 'ٹماٹر'],
];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getLocationName(location) {
    const city = location?.city || location?.name || 'Active region';
    const country = location?.country || '';
    return country && !String(city).includes(country) ? `${city}, ${country}` : city;
}

function getCropFromLabel(label) {
    const lower = String(label || '').toLowerCase();
    if (lower.includes('bell pepper')) return 'pepper';
    if (lower.includes('corn') || lower.includes('maize')) return 'corn';
    return CROP_OPTIONS.find(([value]) => value !== 'auto' && lower.includes(value))?.[0] || '';
}

function getConditionKind(label) {
    const lower = String(label || '').toLowerCase();
    if (lower.includes('healthy')) return 'healthy';
    if (lower.includes('virus')) return 'viral';
    if (lower.includes('mite')) return 'mite';
    if (lower.includes('bacterial')) return 'bacterial';
    if (lower.includes('greening')) return 'greening';
    if (/(blight|mildew|mold|rust|scab|rot|esca|leaf spot)/.test(lower)) return 'fungal';
    return 'uncertain';
}

function getDiseaseProfile(label) {
    const lower = String(label || '').toLowerCase();
    if (lower.includes('late blight')) return {
        name: 'Late blight pattern',
        where: 'cool, humid lower canopy and shaded foliage that stays wet after irrigation or rain',
        whereUr: 'نچلے گھنے اور سایہ دار پتے جہاں آبپاشی یا بارش کے بعد نمی دیر تک رہے',
        trigger: 'extended leaf wetness and dense canopy humidity',
        triggerUr: 'پتوں کا دیر تک گیلا رہنا اور گھنی چھتری کی نمی',
    };
    if (lower.includes('early blight')) return {
        name: 'Early blight pattern',
        where: 'older lower leaves on moisture-stressed plants, especially where crop residue remains',
        whereUr: 'پرانے نچلے پتے، خاص طور پر پانی کے تناؤ اور فصل کی باقیات والے حصے',
        trigger: 'heat stress, leaf wetness, and infected residue near the plant base',
        triggerUr: 'گرمی کا تناؤ، پتوں کی نمی اور پودے کے پاس متاثرہ باقیات',
    };
    if (lower.includes('leaf mold') || lower.includes('powdery mildew') || lower.includes('rust') || lower.includes('scab') || lower.includes('black rot')) return {
        name: 'Fungal pressure pattern',
        where: 'shaded inner canopy and blocks with poor airflow',
        whereUr: 'چھتری کے اندر سایہ دار حصے اور کم ہوا گزرنے والے کھیت',
        trigger: 'high humidity and a long leaf-wetness period',
        triggerUr: 'زیادہ نمی اور پتوں کے گیلے رہنے کا طویل وقت',
    };
    if (lower.includes('bacterial')) return {
        name: 'Bacterial spot pattern',
        where: 'lower canopy and splash-exposed foliage near irrigation lines or bare soil',
        whereUr: 'نچلی چھتری اور آبپاشی لائن یا کھلی مٹی کے قریب چھینٹوں سے متاثر پتے',
        trigger: 'water splash, wet handling, and contaminated tools or residue',
        triggerUr: 'پانی کے چھینٹے، گیلے پودے کو چھونا، اور آلودہ اوزار یا باقیات',
    };
    if (lower.includes('virus') || lower.includes('greening')) return {
        name: 'Vector-borne pattern',
        where: 'new growth and field edges where insect vectors enter first',
        whereUr: 'نئی بڑھوتری اور کھیت کے کنارے جہاں کیڑے پہلے داخل ہوتے ہیں',
        trigger: 'vector activity and movement of infected plant material',
        triggerUr: 'کیڑوں کی سرگرمی اور متاثرہ پودے کے مواد کی منتقلی',
    };
    if (lower.includes('mite')) return {
        name: 'Mite pressure pattern',
        where: 'undersides of leaves in hot, dry, dust-exposed crop edges',
        whereUr: 'گرم، خشک اور گرد سے متاثرہ کناروں پر پتوں کی نچلی سطح',
        trigger: 'heat, low humidity, dust, and plant water stress',
        triggerUr: 'گرمی، کم نمی، گرد اور پودے کا آبی تناؤ',
    };
    return {
        name: 'Screening pattern',
        where: 'no disease-specific city pattern is available for this label',
        whereUr: 'اس لیبل کے لیے بیماری کا مخصوص شہری نمونہ دستیاب نہیں',
        trigger: 'the image needs field confirmation before a regional conclusion',
        triggerUr: 'علاقائی نتیجے سے پہلے تصویر کی کھیت میں تصدیق ضروری ہے',
    };
}

function getRegionalContext(location, label, analytics) {
    const city = String(location?.city || location?.name || '').toLowerCase();
    const country = String(location?.country || '').toLowerCase();
    const province = location?.province || location?.region || '';
    const profile = getDiseaseProfile(label);
    let setting = '';
    let settingUr = '';
    let basis = '';
    if (city.includes('multan')) {
        setting = 'Southern Punjab irrigated plain: dense vegetable blocks, low-lying field edges, and shaded lower canopy are the first places to inspect.';
        settingUr = 'جنوبی پنجاب کا نہری میدان: گھنے سبزی والے بلاک، نشیبی کنارے اور نچلی سایہ دار چھتری پہلے دیکھیں۔';
        basis = 'Multan + Southern Punjab irrigated-belt context';
    } else if (city.includes('lahore') || city.includes('faisalabad')) {
        setting = 'Central Punjab irrigated and peri-urban vegetable belts; inspect dense blocks and fields with repeated overhead irrigation.';
        settingUr = 'وسطی پنجاب کے نہری اور شہری کناروں کے سبزی والے علاقے؛ گھنے بلاک اور بار بار اوپر سے آبپاشی والے کھیت دیکھیں۔';
        basis = 'Central Punjab irrigated-belt context';
    } else if (city.includes('karachi')) {
        setting = 'Coastal peri-urban horticulture and humid, sheltered plots; prioritize low-airflow crop pockets over open dry fields.';
        settingUr = 'ساحلی شہری کناروں کی باغبانی اور مرطوب، محفوظ قطعات؛ کھلے خشک کھیتوں سے پہلے کم ہوا والے حصے دیکھیں۔';
        basis = 'Karachi coastal-humidity context';
    } else if (city.includes('delhi')) {
        setting = 'Yamuna floodplain and peri-urban vegetable belts; inspect dense, poorly ventilated plots and low-lying edges.';
        settingUr = 'جمنا کے سیلابی میدان اور شہری کناروں کے سبزی والے علاقے؛ گھنے کم ہوا والے قطعات اور نشیبی کنارے دیکھیں۔';
        basis = 'Delhi floodplain/peri-urban context';
    } else if (city.includes('tokyo') || country.includes('japan')) {
        setting = 'Protected horticulture and dense greenhouse rows; inspect shaded leaves after typhoon or rain events.';
        settingUr = 'محفوظ باغبانی اور گھنی گرین ہاؤس قطاریں؛ طوفان یا بارش کے بعد سایہ دار پتے دیکھیں۔';
        basis = 'Japan protected-horticulture context';
    } else if (province || country) {
        setting = `No verified city-hotspot dataset is configured for ${province || country}. Use the disease pattern to prioritize field scouting rather than treating this as an incidence claim.`;
        settingUr = `${province || country} کے لیے تصدیق شدہ شہری ہاٹ اسپاٹ ڈیٹا موجود نہیں۔ اسے بیماری کی شرح کا دعویٰ نہ سمجھیں؛ صرف کھیت کی جانچ کی ترجیح بنائیں۔`;
        basis = 'No verified city-incidence layer';
    } else {
        setting = 'Select a city to generate a location-specific scouting context.';
        settingUr = 'شہری سطح کی جانچ کے لیے شہر منتخب کریں۔';
        basis = 'Location not resolved';
    }
    const humidity = Number(analytics?.telemetry?.humidity_percentage ?? analytics?.telemetry?.relative_humidity_pct ?? 0);
    return {
        profile,
        setting,
        settingUr,
        basis,
        humidity,
        confidence: basis === 'No verified city-incidence layer' ? 'Context only' : 'Rule-based context',
    };
}

function formatFileSize(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildScreeningResult(predictions, location, analytics, selectedCrop) {
    const top = predictions[0] || { label: 'No result', score: 0 };
    const predictedCrop = getCropFromLabel(top.label);
    const cropMismatch = selectedCrop !== 'auto' && predictedCrop && predictedCrop !== selectedCrop;
    const confidence = Number(top.score || 0);
    const kind = getConditionKind(top.label);
    const inconclusive = confidence < 0.55 || cropMismatch;
    const notPlantLike = confidence < 0.35;
    const regionalContext = getRegionalContext(location, top.label, analytics);
    const humidity = Number(analytics?.telemetry?.humidity_percentage ?? analytics?.telemetry?.relative_humidity_pct ?? 0);
    const temperature = Number(analytics?.telemetry?.temperature_celsius ?? 0);
    const wind = Number(analytics?.telemetry?.wind_speed_kmh ?? 0);
    const vpd = Number(analytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 0);

    const actionsByKind = {
        healthy: [
            'Keep this plant as a reference and continue routine scouting.',
            'Re-scan if new spots, curling, chlorosis, or rapid leaf loss appear.',
            'Maintain irrigation from soil-moisture readings rather than leaf appearance alone.',
        ],
        viral: [
            'Isolate the affected plant and inspect nearby plants for matching symptoms.',
            'Disinfect tools between plants and control likely insect vectors with locally approved measures.',
            'There is no curative virus spray; confirm with an agronomist before removing plants.',
        ],
        mite: [
            'Inspect the undersides of leaves for mites, eggs, and fine webbing.',
            'Reduce plant water stress and isolate heavily affected material.',
            'Use a locally registered selective miticide only after field-threshold confirmation.',
        ],
        bacterial: [
            'Avoid overhead irrigation and handling plants while foliage is wet.',
            'Remove heavily affected tissue and disinfect tools between plants.',
            'Confirm locally before any copper treatment; crop labels and resistance rules vary.',
        ],
        greening: [
            'Inspect surrounding citrus for psyllids and asymmetric leaf mottling.',
            'Do not move propagation material from the affected block.',
            'Contact the local plant-protection authority for confirmatory testing and containment.',
        ],
        fungal: [
            'Isolate affected foliage and remove severely infected debris from the field.',
            'Avoid overhead irrigation; improve canopy airflow and shorten leaf-wetness duration.',
            'Confirm the diagnosis before applying any locally registered fungicide.',
        ],
        uncertain: [
            'Capture another photo in daylight with one leaf filling most of the frame.',
            'Photograph both sides of the leaf and include the whole plant for field confirmation.',
            'Ask a local agronomist to check for nutrient, pest, and disease causes.',
        ],
    };

    const actionsByKindUr = {
        healthy: [
            'اس پودے کو صحت مند حوالہ سمجھ کر معمول کی نگرانی جاری رکھیں۔',
            'نئے دھبے، پتوں کا مڑنا، زردی یا تیزی سے پتے گرنے پر دوبارہ اسکین کریں۔',
            'آبپاشی کا فیصلہ صرف پتے کی شکل پر نہیں بلکہ مٹی کی نمی کے مطابق کریں۔',
        ],
        viral: [
            'متاثرہ پودے کو الگ کریں اور آس پاس کے پودوں میں ملتی علامات دیکھیں۔',
            'ہر پودے کے بعد اوزار صاف کریں اور مقامی طور پر منظور شدہ طریقے سے کیڑے کے ویکٹر کو قابو کریں۔',
            'وائرس کے لیے شفا بخش اسپرے نہیں؛ پودا نکالنے سے پہلے ماہر زراعت سے تصدیق کریں۔',
        ],
        mite: [
            'پتوں کی نچلی سطح پر مائٹس، انڈے اور باریک جالا تلاش کریں۔',
            'پودے کا آبی تناؤ کم کریں اور زیادہ متاثرہ مواد الگ رکھیں۔',
            'کھیت میں حد کی تصدیق کے بعد ہی مقامی طور پر رجسٹرڈ منتخب مائٹ کش استعمال کریں۔',
        ],
        bacterial: [
            'اوپر سے آبپاشی اور گیلے پتوں کو ہاتھ لگانے سے گریز کریں۔',
            'زیادہ متاثرہ حصہ ہٹائیں اور ہر پودے کے بعد اوزار جراثیم سے پاک کریں۔',
            'کاپر علاج سے پہلے مقامی تصدیق کریں؛ فصل کے لیبل اور مزاحمت کے اصول مختلف ہوتے ہیں۔',
        ],
        greening: [
            'آس پاس کے سٹرس پودوں میں سائلیڈ کیڑا اور غیر متوازن دھبے تلاش کریں۔',
            'متاثرہ بلاک سے افزائشی مواد دوسری جگہ منتقل نہ کریں۔',
            'تصدیقی ٹیسٹ اور روک تھام کے لیے مقامی محکمہ تحفظ نباتات سے رابطہ کریں۔',
        ],
        fungal: [
            'متاثرہ پتے الگ کریں اور شدید بیمار باقیات کھیت سے نکالیں۔',
            'اوپر سے آبپاشی نہ کریں؛ چھتری میں ہوا کا گزر بڑھائیں اور پتوں کے گیلے رہنے کا وقت کم کریں۔',
            'مقامی طور پر رجسٹرڈ فنگس کش لگانے سے پہلے تشخیص کی تصدیق کریں۔',
        ],
        uncertain: [
            'دن کی روشنی میں دوبارہ تصویر لیں اور ایک پتا زیادہ تر فریم میں رکھیں۔',
            'پتے کے دونوں رخ اور پورے پودے کی تصویر بھی لیں تاکہ کھیت میں تصدیق ہو سکے۔',
            'غذائی کمی، کیڑے اور بیماری کی جانچ کے لیے مقامی ماہر زراعت سے رابطہ کریں۔',
        ],
    };

    const weatherSignals = [];
    const weatherSignalsUr = [];
    if (humidity >= 75) {
        weatherSignals.push(`Humidity is ${humidity.toFixed(0)}%, increasing leaf-wetness and fungal spread pressure.`);
        weatherSignalsUr.push(`نمی ${humidity.toFixed(0)} فیصد ہے، جس سے پتے گیلے رہنے اور فنگس پھیلنے کا دباؤ بڑھتا ہے۔`);
    }
    if (temperature >= 32) {
        weatherSignals.push(`Temperature is ${temperature.toFixed(1)}°C; heat stress can intensify visible symptoms.`);
        weatherSignalsUr.push(`درجہ حرارت ${temperature.toFixed(1)}°C ہے؛ گرمی کا تناؤ ظاہری علامات بڑھا سکتا ہے۔`);
    }
    if (wind >= 18) {
        weatherSignals.push(`Wind is ${wind.toFixed(0)} km/h; postpone foliar treatment to reduce drift.`);
        weatherSignalsUr.push(`ہوا ${wind.toFixed(0)} کلومیٹر فی گھنٹہ ہے؛ اسپرے کے بہاؤ کو کم کرنے کے لیے پتوں کا علاج مؤخر کریں۔`);
    }
    if (vpd >= 2) {
        weatherSignals.push(`VPD is ${vpd.toFixed(2)} kPa; prioritize root-zone moisture and avoid midday spraying.`);
        weatherSignalsUr.push(`وی پی ڈی ${vpd.toFixed(2)} کلو پاسکل ہے؛ جڑوں کی نمی کو ترجیح دیں اور دوپہر میں اسپرے نہ کریں۔`);
    }
    if (!weatherSignals.length) {
        weatherSignals.push('Current regional telemetry does not add a strong weather escalation signal.');
        weatherSignalsUr.push('موجودہ علاقائی ٹیلی میٹری موسم سے خطرے میں واضح اضافے کی نشاندہی نہیں کرتی۔');
    }

    return {
        label: inconclusive ? 'Inconclusive screening' : top.label,
        candidateLabel: top.label,
        confidence,
        kind,
        inconclusive,
        notPlantLike,
        cropMismatch,
        predictedCrop,
        alternatives: predictions.slice(1, 3),
        actions: inconclusive ? actionsByKind.uncertain : actionsByKind[kind],
        actionsUr: inconclusive ? actionsByKindUr.uncertain : actionsByKindUr[kind],
        weatherSignals,
        weatherSignalsUr,
        locationName: getLocationName(location),
        regionalContext,
    };
}

function renderResults(result, isUrdu) {
    if (!result) return '';
    const confidence = Math.round(result.confidence * 100);
    const statusClass = result.kind === 'healthy' && !result.inconclusive ? 'healthy' : result.inconclusive ? 'uncertain' : 'attention';
    const statusLabel = result.inconclusive
        ? (isUrdu ? 'دوبارہ تصویر درکار' : 'Needs another image')
        : result.kind === 'healthy' ? (isUrdu ? 'صحت مند امکان' : 'Likely healthy') : (isUrdu ? 'توجہ درکار' : 'Attention indicated');
    const inconclusiveMessage = result.notPlantLike
        ? (isUrdu ? 'اس تصویر میں پتے یا پودے کی قابل اعتماد علامت نہیں ملی۔ کوئی بیماری رپورٹ تیار نہیں کی گئی۔' : 'No reliable plant or leaf signal was detected in this image. No disease report was generated.')
        : result.cropMismatch
            ? (isUrdu ? 'تصویر کا نتیجہ منتخب فصل سے مطابقت نہیں رکھتا۔ اسی فصل کے پتے کی واضح تصویر کے ساتھ دوبارہ کوشش کریں۔' : 'The image result does not match the selected crop. Upload a clear leaf from the selected crop.')
            : (isUrdu ? 'اعتماد کافی نہیں۔ دن کی روشنی میں ایک پتے کی واضح تصویر دوبارہ لیں۔' : 'Confidence is too low for a useful screen. Upload one clear leaf in daylight.');
    const contextBody = result.inconclusive ? `
            <div class="plant-rejection-panel">
                <i data-lucide="image-off"></i>
                <div><strong>${isUrdu ? 'بیماری رپورٹ روک دی گئی' : 'Disease report withheld'}</strong><p>${escapeHtml(inconclusiveMessage)}</p></div>
            </div>` : `
            <div class="plant-result-section plant-regional-context">
                <div class="plant-result-section-title"><i data-lucide="map-pinned"></i><span>${isUrdu ? 'علاقائی بیماری کا سیاق' : 'Regional disease context'}</span></div>
                <div class="plant-context-detail"><strong>${isUrdu ? 'کہاں پہلے دیکھیں' : 'Where to scout first'}</strong><p>${escapeHtml(isUrdu ? result.regionalContext.settingUr : result.regionalContext.setting)}</p></div>
                <div class="plant-context-detail"><strong>${isUrdu ? 'اس بیماری کا نمونہ' : 'Disease pattern'}</strong><p>${escapeHtml(isUrdu ? result.regionalContext.profile.whereUr : result.regionalContext.profile.where)}</p></div>
                <div class="plant-context-detail"><strong>${isUrdu ? 'اہم محرک' : 'Main trigger'}</strong><p>${escapeHtml(isUrdu ? result.regionalContext.profile.triggerUr : result.regionalContext.profile.trigger)}</p></div>
                <span class="plant-context-basis"><i data-lucide="badge-info"></i>${isUrdu ? 'بنیاد' : 'Basis'}: ${escapeHtml(result.regionalContext.basis)} · ${escapeHtml(result.regionalContext.confidence)}</span>
            </div>
            <div class="plant-result-section">
                <div class="plant-result-section-title"><i data-lucide="cloud-sun"></i><span>${isUrdu ? 'مقامی موسم کا اثر' : 'Local weather context'}</span></div>
                <p class="plant-result-location">${escapeHtml(result.locationName)}</p>
                <ul>${(isUrdu ? result.weatherSignalsUr : result.weatherSignals).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </div>
            <div class="plant-result-section">
                <div class="plant-result-section-title"><i data-lucide="clipboard-check"></i><span>${isUrdu ? 'اگلے اقدامات' : 'Recommended next steps'}</span></div>
                <ol>${(isUrdu ? result.actionsUr : result.actions).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
            </div>`;
    return `
        <section class="plant-scan-result" aria-labelledby="plant-scan-result-title">
            <div class="plant-result-heading"><div><span class="plant-result-kicker">${isUrdu ? 'بصری اسکریننگ نتیجہ' : 'Visual screening result'}</span><h3 id="plant-scan-result-title">${escapeHtml(result.inconclusive && result.notPlantLike ? (isUrdu ? 'پودا نہیں ملا' : 'No plant detected') : result.label)}</h3></div><span class="plant-result-status ${statusClass}">${statusLabel}</span></div>
            ${result.inconclusive ? `<p class="plant-result-explainer">${escapeHtml(inconclusiveMessage)}</p>` : ''}
            <div class="plant-confidence-row"><span>${isUrdu ? 'ماڈل اعتماد' : 'Model confidence'}</span><strong>${confidence}%</strong></div>
            <div class="plant-confidence-track" aria-hidden="true"><span style="width:${confidence}%"></span></div>
            ${contextBody}
            ${result.alternatives.length && !result.inconclusive ? `<div class="plant-alternatives"><span>${isUrdu ? 'دیگر ماڈل امکانات' : 'Other model candidates'}</span>${result.alternatives.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${Math.round(item.score * 100)}%</strong></div>`).join('')}</div>` : ''}
            <p class="plant-screening-note"><i data-lucide="info"></i><span>${result.inconclusive ? (isUrdu ? 'بیماری کی رپورٹ کے لیے واضح پتے کی تصویر درکار ہے۔' : 'A clear leaf photo is required before a disease report is generated.') : (isUrdu ? 'یہ ابتدائی اسکریننگ ہے، حتمی تشخیص نہیں۔ کیمیکل استعمال سے پہلے مقامی ماہر زراعت سے تصدیق کریں۔' : 'This is assistive screening, not a definitive diagnosis. Confirm with a local agronomist before chemical treatment.')}</span></p>
        </section>`;
}

function renderScannerMarkup(location, isUrdu) {
    const hasFile = Boolean(scannerState.file && scannerState.previewUrl);
    const isBusy = scannerState.phase === 'loading' || scannerState.phase === 'analyzing';
    const progress = Math.max(0, Math.min(100, Math.round(scannerState.progress || 0)));
    const locationName = getLocationName(location);

    return `
        <div class="plant-scanner" dir="${isUrdu ? 'rtl' : 'ltr'}">
            <div class="plant-scanner-intro">
                <div class="plant-scanner-intro-icon"><i data-lucide="scan-line"></i></div>
                <div>
                    <span>${isUrdu ? 'مقامی اے آئی اسکریننگ' : 'On-device AI screening'}</span>
                    <h3>${isUrdu ? 'فصل کے پتے کی جانچ' : 'Scan a crop leaf'}</h3>
                    <p>${isUrdu ? 'پتے کو دن کی روشنی میں، صاف پس منظر پر اور فریم کے قریب رکھیں۔' : 'Use one leaf in daylight, against a plain background, filling most of the frame.'}</p>
                </div>
            </div>

            <div class="plant-context-card">
                <div><i data-lucide="map-pin"></i><span><small>${isUrdu ? 'موسمی سیاق' : 'Weather context'}</small><strong>${escapeHtml(locationName)}</strong></span></div>
                <span class="plant-private-chip"><i data-lucide="shield-check"></i>${isUrdu ? 'تصویر ڈیوائس پر رہتی ہے' : 'Image stays on device'}</span>
            </div>

            <div class="plant-field">
                <label for="plant-crop-select">${isUrdu ? 'فصل' : 'Crop'} <span>${isUrdu ? '(اختیاری جانچ)' : '(optional cross-check)'}</span></label>
                <select id="plant-crop-select" ${isBusy ? 'disabled' : ''}>
                    ${CROP_OPTIONS.map(([value, en, ur]) => `<option value="${value}" ${scannerState.crop === value ? 'selected' : ''}>${isUrdu ? ur : en}</option>`).join('')}
                </select>
            </div>

            <div class="plant-upload-shell ${hasFile ? 'has-image' : ''}" id="plant-upload-shell">
                <input class="plant-file-input" id="plant-leaf-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" ${isBusy ? 'disabled' : ''}>
                ${hasFile ? `
                    <div class="plant-preview-wrap">
                        <img src="${scannerState.previewUrl}" alt="${isUrdu ? 'منتخب پتے کی تصویر' : 'Selected leaf preview'}">
                        <div class="plant-preview-shade"></div>
                        <button type="button" class="plant-remove-btn" id="plant-remove-image" aria-label="${isUrdu ? 'تصویر ہٹائیں' : 'Remove selected image'}" ${isBusy ? 'disabled' : ''}><i data-lucide="x"></i></button>
                        <div class="plant-preview-meta"><strong>${escapeHtml(scannerState.file.name)}</strong><span>${formatFileSize(scannerState.file.size)}</span></div>
                    </div>` : `
                    <label class="plant-drop-zone" id="plant-drop-zone" for="plant-leaf-input">
                        <span class="plant-drop-icon"><i data-lucide="image-plus"></i></span>
                        <strong>${isUrdu ? 'پتے کی تصویر شامل کریں' : 'Add a leaf photo'}</strong>
                        <span>${isUrdu ? 'کیمرہ کھولنے یا فائل منتخب کرنے کے لیے دبائیں' : 'Tap to open camera or choose a file'}</span>
                        <small>JPG, PNG, WEBP · ${isUrdu ? 'زیادہ سے زیادہ' : 'max'} 8 MB</small>
                    </label>`}
            </div>

            <div class="plant-scan-feedback ${isBusy ? 'visible' : ''}" role="status" aria-live="polite" aria-busy="${isBusy}">
                <div><span>${escapeHtml(scannerState.statusText || (isUrdu ? 'ماڈل تیار کیا جا رہا ہے…' : 'Preparing model…'))}</span><strong>${progress}%</strong></div>
                <div class="plant-scan-progress"><span style="width:${progress}%"></span></div>
            </div>

            <button type="button" class="plant-analyze-btn" id="plant-analyze-btn" ${!hasFile || isBusy ? 'disabled' : ''}>
                <i data-lucide="scan-line"></i>
                <span>${isBusy ? (isUrdu ? 'تجزیہ جاری ہے…' : 'Analyzing leaf…') : (isUrdu ? 'بیماری کی اسکریننگ کریں' : 'Run disease screening')}</span>
            </button>

            ${renderResults(scannerState.result, isUrdu)}

            <div class="plant-model-scope">
                <i data-lucide="database"></i>
                <p><strong>${isUrdu ? 'ماڈل دائرہ:' : 'Model scope:'}</strong> ${isUrdu
                    ? 'پلانٹ ولیج کی 38 کلاسیں اور 14 فصلیں۔ کھیت کی روشنی، پس منظر اور غیر معاون فصلیں درستگی کم کر سکتی ہیں۔'
                    : '38 PlantVillage classes across 14 crops. Field lighting, complex backgrounds, and unsupported crops can reduce accuracy.'}</p>
            </div>
        </div>`;
}

function updateScanner(container, location, analytics, isUrdu) {
    container.innerHTML = renderScannerMarkup(location, isUrdu);
    bindScannerEvents(container, location, analytics, isUrdu);
    if (window.lucide) window.lucide.createIcons({ root: container });
}

function setProgress(container, phase, text, progress) {
    scannerState.phase = phase;
    scannerState.statusText = text;
    scannerState.progress = progress;
    const feedback = container.querySelector('.plant-scan-feedback');
    if (!feedback) return;
    feedback.classList.add('visible');
    feedback.setAttribute('aria-busy', String(phase === 'loading' || phase === 'analyzing'));
    const label = feedback.querySelector('span');
    const value = feedback.querySelector('strong');
    const bar = feedback.querySelector('.plant-scan-progress span');
    if (label) label.textContent = text;
    if (value) value.textContent = `${Math.round(progress)}%`;
    if (bar) bar.style.width = `${Math.round(progress)}%`;
}

async function getClassifier(onProgress) {
    if (!classifierPromise) {
        classifierPromise = import('@huggingface/transformers').then(async ({ pipeline, env }) => {
            env.allowLocalModels = false;
            return pipeline('image-classification', MODEL_ID, {
                dtype: 'fp32',
                progress_callback: (event) => {
                    if (event?.status === 'progress' && Number.isFinite(event.progress)) onProgress(event.progress);
                    if (event?.status === 'ready') onProgress(100);
                },
            });
        }).catch((error) => {
            classifierPromise = null;
            throw error;
        });
    }
    return classifierPromise;
}

async function validateImage(file) {
    if (!ACCEPTED_TYPES.has(file.type)) throw new Error('Choose a JPG, PNG, or WEBP image.');
    if (file.size > MAX_FILE_BYTES) throw new Error('The image is larger than 8 MB.');
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    if (dimensions.width < 160 || dimensions.height < 160) throw new Error('Use an image at least 160 × 160 pixels.');
}

function acceptFile(file, container, location, analytics, isUrdu) {
    validateImage(file).then(() => {
        if (scannerState.previewUrl) URL.revokeObjectURL(scannerState.previewUrl);
        scannerState.file = file;
        scannerState.previewUrl = URL.createObjectURL(file);
        scannerState.result = null;
        scannerState.phase = 'idle';
        scannerState.progress = 0;
        scannerState.statusText = '';
        updateScanner(container, location, analytics, isUrdu);
    }).catch((error) => showToast(error.message, 'error'));
}

function bindScannerEvents(container, location, analytics, isUrdu) {
    const input = container.querySelector('#plant-leaf-input');
    const shell = container.querySelector('#plant-upload-shell');
    const cropSelect = container.querySelector('#plant-crop-select');

    input?.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) acceptFile(file, container, location, analytics, isUrdu);
    });

    cropSelect?.addEventListener('change', () => {
        scannerState.crop = cropSelect.value;
        scannerState.result = null;
    });

    ['dragenter', 'dragover'].forEach((eventName) => shell?.addEventListener(eventName, (event) => {
        event.preventDefault();
        shell.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((eventName) => shell?.addEventListener(eventName, (event) => {
        event.preventDefault();
        shell.classList.remove('is-dragging');
    }));
    shell?.addEventListener('drop', (event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file) acceptFile(file, container, location, analytics, isUrdu);
    });

    container.querySelector('#plant-remove-image')?.addEventListener('click', () => {
        if (scannerState.previewUrl) URL.revokeObjectURL(scannerState.previewUrl);
        scannerState.file = null;
        scannerState.previewUrl = '';
        scannerState.result = null;
        scannerState.phase = 'idle';
        updateScanner(container, location, analytics, isUrdu);
    });

    container.querySelector('#plant-analyze-btn')?.addEventListener('click', async () => {
        if (!scannerState.file || scannerState.phase === 'loading' || scannerState.phase === 'analyzing') return;
        const button = container.querySelector('#plant-analyze-btn');
        if (button) button.disabled = true;
        try {
            setProgress(container, 'loading', isUrdu ? 'مقامی وژن ماڈل لوڈ ہو رہا ہے…' : 'Loading on-device vision model…', 8);
            const classifier = await getClassifier((progress) => {
                const scaled = Math.max(8, Math.min(82, progress * 0.82));
                setProgress(container, 'loading', isUrdu ? 'مقامی وژن ماڈل لوڈ ہو رہا ہے…' : 'Loading on-device vision model…', scaled);
            });
            setProgress(container, 'analyzing', isUrdu ? 'پتے کی خصوصیات کا تجزیہ…' : 'Analyzing leaf features…', 88);
            const { RawImage } = await import('@huggingface/transformers');
            const image = await RawImage.fromBlob(scannerState.file);
            const predictions = await classifier(image, { top_k: 3 });
            scannerState.result = buildScreeningResult(predictions, location, analytics, scannerState.crop);
            scannerState.phase = 'complete';
            scannerState.progress = 100;
            scannerState.statusText = isUrdu ? 'اسکریننگ مکمل' : 'Screening complete';
            updateScanner(container, location, analytics, isUrdu);
            container.querySelector('.plant-scan-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error('[Plant Scanner] Inference failed:', error);
            scannerState.phase = 'error';
            scannerState.progress = 0;
            scannerState.statusText = isUrdu ? 'ماڈل لوڈ نہیں ہو سکا' : 'Model could not be loaded';
            updateScanner(container, location, analytics, isUrdu);
            showToast(isUrdu ? 'پلانٹ ماڈل لوڈ نہیں ہو سکا۔ انٹرنیٹ کنکشن چیک کریں۔' : 'The plant model could not load. Check the internet connection and try again.', 'error', 6000);
        }
    });
}

export function renderPlantScanner(container, location, analytics, isUrdu = false) {
    updateScanner(container, location, analytics, isUrdu);
}
