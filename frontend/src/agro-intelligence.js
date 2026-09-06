/**
 * agro-intelligence.js
 * Smart Agriculture intelligence engine for Pakistan's agro-ecological zones.
 * Powers:
 * - Bilingual Urdu & English localization
 * - Interactive "What-If" scenario simulation physics
 * - 4-Agent collaborative swarm consensus stream
 * - Spoken Voice Advisory (Urdu & English)
 * - 2G GSM SMS Dispatch simulation
 */

export const AGRO_ZONES_PAKISTAN = {
    "pakistan_punjab": {
        zoneNameEn: "Zone III-A: Sandy Desert & Irrigated Plains (Punjab)",
        zoneNameUr: "زون III-A: نہری میدانی اور زرخیز علاقہ (پنجاب)",
        primaryCropsEn: "Basmati Rice, Cotton, Wheat, Sugarcane",
        primaryCropsUr: "باسمتی چاول، کپاس، گندم، کماد",
        soilTypeEn: "Alluvial Loam / Clay Loam",
        soilTypeUr: "زرخیز چکنی مٹی اور میرا مٹی",
        waterSourceEn: "Indus Basin Irrigation System + Tube-wells",
        waterSourceUr: "انڈس بیسن نہری نظام اور ٹیوب ویل",
    },
    "pakistan_multan": {
        zoneNameEn: "Zone III-B: Cotton & Mango Belt (Southern Punjab)",
        zoneNameUr: "زون III-B: کپاس اور آم کی پٹی (جنوبی پنجاب)",
        primaryCropsEn: "Cotton, Mango Orchards, Wheat, Maize",
        primaryCropsUr: "کپاس، آم کے باغات، گندم، مکئی",
        soilTypeEn: "Calcareous Silt Loam",
        soilTypeUr: "چونے دار گاد میرا مٹی",
        waterSourceEn: "Canal Network & Groundwater",
        waterSourceUr: "نہری نیٹ ورک اور زیرِ زمین پانی",
    },
    "pakistan_faisalabad": {
        zoneNameEn: "Zone IV-A: Mixed Cropping Central Indus Plain",
        zoneNameUr: "زون IV-A: مخلوط کاشتکاری وسطی پنجاب",
        primaryCropsEn: "Sugarcane, Wheat, Maize, Vegetables",
        primaryCropsUr: "کماد، گندم، مکئی، سبزیاں",
        soilTypeEn: "Fertile Silt Loam",
        soilTypeUr: "زرخیز گاد مٹی",
        waterSourceEn: "Chenab / Lower Jhelum Canals",
        waterSourceUr: "چناب اور لوئر جہلم نہریں",
    },
    "pakistan_sukkur": {
        zoneNameEn: "Zone II-A: Lower Indus Alluvial Plain (Upper Sindh)",
        zoneNameUr: "زون II-A: زیریں انڈس میدانی علاقہ (بالائی سندھ)",
        primaryCropsEn: "Rice, Dates, Cotton, Mustard",
        primaryCropsUr: "چاول، کھجور، کپاس، سرسوں",
        soilTypeEn: "Deep Stratified Silty Clay",
        soilTypeUr: "گہری گاد دار چکنی مٹی",
        waterSourceEn: "Sukkur Barrage Canal Network",
        waterSourceUr: "سکھر بیراج نہری نظام",
    },
    "pakistan_peshawar": {
        zoneNameEn: "Zone VI-A: Peshawar Valley Irrigated Basin",
        zoneNameUr: "زون VI-A: وادی پشاور زرخیز طاس",
        primaryCropsEn: "Sugarcane, Tobacco, Maize, Stone Fruits",
        primaryCropsUr: "کماد، تمباکو، مکئی، باغات",
        soilTypeEn: "Deep Loamy Alluvium",
        soilTypeUr: "گہری زرخیز مٹی",
        waterSourceEn: "Warsak & Kabul River Canals",
        waterSourceUr: "وارسک اور دریائے کابل کی نہریں",
    },
    "pakistan_quetta": {
        zoneNameEn: "Zone VII-A: High Altitude Arid Highland (Balochistan)",
        zoneNameUr: "زون VII-A: سطح مرتفع بلوچستان (خشک خطہ)",
        primaryCropsEn: "Apples, Almonds, Grapes, Pomegranates",
        primaryCropsUr: "سیب، بادام، انگور، انار",
        soilTypeEn: "Gravelly Loam / Sandy Silt",
        soilTypeUr: "پتھریلی اور ریتلی میرا مٹی",
        waterSourceEn: "Karez Systems, Tube-wells & Delay Action Dams",
        waterSourceUr: "کاریز، ٹیوب ویل اور تاخیری ڈیم",
    }
};

export const URDU_TRANSLATIONS = {
    "Region": "علاقہ",
    "Physics": "طبیعیات",
    "Agriculture": "زراعت",
    "Grid": "بجلی گرڈ",
    "Logistics": "لاجسٹکس",
    "Research": "تحقیق",
    "WIaaS": "ڈبلیو-آئی-اے-ایس",
    "CrisisLens": "کرائسس لینس",
    "Analytics": "تجزیات",
    "Agriculture Intelligence": "اسمارٹ زرعی ذہانت",
    "Selected region": "منتخب علاقہ",
    "AI RECOMMENDATION": "مصنوعی ذہانت کی سفارش",
    "Mean Crop Health Index": "اوسط فصل صحت انڈیکس",
    "Highly Productive": "انتہائی زرخیز / صحت مند",
    "Moderate Stress": "معتدل تناؤ",
    "Severe Stress": "شدید تناؤ",
    "Diagnostics": "فصل معائنہ",
    "What-If Simulator": "فیصلہ سازی سمیلیٹر",
    "Plant Scanner": "پودے کی جانچ",
    "Soil Moisture (0-30cm)": "زمین کی نمی (0-30 سینٹی میٹر)",
    "Topsoil (0-10cm)": "اوپری مٹی (0-10 سینٹی میٹر)",
    "Root Zone (10-40cm)": "جڑ کا احاطہ (10-40 سینٹی میٹر)",
    "Irrigation Demand": "پانی کی ضرورت",
    "Disease Risk Index": "بیماری و کیڑوں کا خطرہ",
    "Water Stress Index": "پانی کی قلت کا تناؤ",
    "Gross Reservoir Storage": "کل ذخیرہ آب",
    "Deliverable Water Volume": "فراہمی کے قابل پانی",
    "Reservoir Evaporative Loss": "بخاراتی اخراج کا نقصان",
    "Overhead Irrigation Viability": "اسپرے آبپاشی کی موزونیت",
    "Evaporative Waste Penalty": "پانی ضیاع کا جرمانہ",
    "Spray Safety Window": "زرعی اسپرے کی حفاظت",
    "Safe to Spray": "اسپرے کے لیے محفوظ",
    "High Evap Risk": "تیز بخارات کا خطرہ",
    "Dangerous Drift": "تیز ہوا / بہاؤ کا خطرہ",
    "Viable": "موزوں",
    "Not Recommended": "غیر موزوں",
    "Active": "فعال",
    "Inactive": "غیر فعال",
    "Optimal": "بہترین",
    "Low": "کم",
    "Moderate": "درمیانہ",
    "Critical": "خطرناک",
    "Nominal": "معمول",
    "Voice Advisory": "صوتی پیغام سنیں",
    "SMS Dispatch": "موبائل SMS دیکھیں",
    "Share Advisory": "واٹس ایپ ایڈوائزری",
    "Run Simulation": "تجزیہ چلائیں",
    "Reset Scenario": "ری سیٹ کریں"
};

export function calculateSpraySafety(tempC, windSpeedKmh, vpdKpa) {
    let score = 100;
    let reasonEn = [];
    let reasonUr = [];

    if (windSpeedKmh > 20) {
        score -= 45;
        reasonEn.push(`High wind (${windSpeedKmh.toFixed(1)} km/h) risks droplet drift.`);
        reasonUr.push(`تیز ہوا (${windSpeedKmh.toFixed(1)} کلومیٹر) اسپرے کو اڑا سکتی ہے۔`);
    } else if (windSpeedKmh < 3) {
        score -= 15;
        reasonEn.push("Stagnant air may cause thermal inversion.");
        reasonUr.push("ہوا کا ٹھہراؤ درجہ حرارت کے الٹ پھیر کا سبب بن سکتا ہے۔");
    }

    if (vpdKpa > 2.5 || tempC > 38) {
        score -= 40;
        reasonEn.push(`High atmospheric dryness (VPD ${vpdKpa.toFixed(2)} kPa, ${tempC.toFixed(1)}°C) causes rapid droplet evaporation.`);
        reasonUr.push(`شدید گرمی اور خشکی (${tempC.toFixed(1)}°C) کی وجہ سے دوا پودے پر پہنچنے سے پہلے اڑ جائے گی۔`);
    }

    score = Math.max(5, Math.min(100, score));
    const status = score >= 70 ? 'safe' : score >= 45 ? 'moderate' : 'unsafe';

    return {
        score,
        status,
        badgeEn: score >= 70 ? 'Optimal Spray Window' : score >= 45 ? 'Marginal Window' : 'Unsafe to Spray',
        badgeUr: score >= 70 ? 'اسپرے کے لیے بہترین وقت' : score >= 45 ? 'احتیاط سے اسپرے کریں' : 'اسپرے ہرگز نہ کریں',
        reasonEn: reasonEn.join(' ') || 'Atmospheric conditions ideal for absorption.',
        reasonUr: reasonUr.join(' ') || 'موسمی حالات دوا کے اثر کے لیے بالکل سازگار ہیں۔'
    };
}

export function runWhatIfScenario({ tempDeltaC = 0, irrigationDelayHours = 0, canalCutoffPct = 0, baseAnalytics }) {
    const baseTemp = baseAnalytics?.telemetry?.temperature_celsius ?? 34.0;
    const baseHumidity = baseAnalytics?.telemetry?.humidity_percentage ?? 45.0;
    const baseVpd = baseAnalytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 1.8;
    const baseSoil = baseAnalytics?.soil_moisture_pct ?? 34.0;
    const baseNdvi = baseAnalytics?.crop_health_ndvi ?? 0.78;

    const simTemp = baseTemp + tempDeltaC;
    const es = 0.61078 * Math.exp((17.27 * simTemp) / (simTemp + 237.3));
    const ea = es * (Math.max(10, baseHumidity - tempDeltaC * 2.5) / 100);
    const simVpd = Math.max(0.2, es - ea);

    const evapLossPct = Math.min(95, simVpd * 14.5 + (tempDeltaC * 3.2));
    const delayPenalty = (irrigationDelayHours / 24) * (4.5 + simVpd * 1.8);
    const canalPenalty = (canalCutoffPct / 100) * 8.0;
    const simSoilMoisture = Math.max(8.0, baseSoil - delayPenalty - canalPenalty);

    let yieldRisk = 12.0;
    if (simSoilMoisture < 20) yieldRisk += (20 - simSoilMoisture) * 2.8;
    if (simVpd > 3.0) yieldRisk += (simVpd - 3.0) * 15.0;
    if (tempDeltaC >= 3.0) yieldRisk += tempDeltaC * 6.5;
    yieldRisk = Math.min(95, Math.round(yieldRisk));

    const ndviLoss = (yieldRisk / 100) * 0.35;
    const simNdvi = Math.max(0.15, baseNdvi - ndviLoss);

    let mitigationEn = "";
    let mitigationUr = "";

    if (tempDeltaC >= 3 || irrigationDelayHours >= 24) {
        mitigationEn = `🚨 Heatwave +${tempDeltaC}°C triggers critical transpiration stress. Shift tube-well pumping to 04:00–08:00 AM. Apply light foliar potassium spray to maintain stomatal conductance.`;
        mitigationUr = `🚨 درجہ حرارت میں +${tempDeltaC}°C اضافے سے فصل میں پانی کا دباؤ ہے۔ ٹیوب ویل صبح 4 سے 8 بجے چلائیں اور پوٹاش اسپرے کریں تاکہ پودا سوکھنے سے بچے۔`;
    } else if (canalCutoffPct > 40) {
        mitigationEn = `⚠️ Canal shortage (${canalCutoffPct}%): Prioritize tail-end fields. Apply mulching or furrow irrigation to conserve 35% soil moisture.`;
        mitigationUr = `⚠️ نہری پانی کی کمی (${canalCutoffPct}%): کھلیوں میں پانی لگائیں اور ملچنگ کا استعمال کریں تاکہ زمین کی نمی 35 فیصد تک برقرار رہے۔`;
    } else {
        mitigationEn = `✅ Farm conditions resilient. Current irrigation schedule satisfies baseline Basmati/Wheat evapotranspiration.`;
        mitigationUr = `✅ فصل کے حالات تسلی بخش ہیں۔ موجودہ شیڈول پانی کی ضرورت پوری کر رہا ہے۔`;
    }

    return {
        simTemp: simTemp.toFixed(1),
        simVpd: simVpd.toFixed(2),
        simSoilMoisture: simSoilMoisture.toFixed(1),
        simNdvi: simNdvi.toFixed(2),
        evapLossPct: evapLossPct.toFixed(1),
        yieldRisk,
        mitigationEn,
        mitigationUr
    };
}

export function getAgentSwarmConsensus(location, baseAnalytics) {
    const locName = location?.city || location?.name || 'Punjab';
    const temp = baseAnalytics?.telemetry?.temperature_celsius ?? 36.2;
    const vpd = baseAnalytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 2.1;
    const soil = baseAnalytics?.soil_moisture_pct ?? 31.0;
    const ndvi = baseAnalytics?.crop_health_ndvi ?? 0.76;

    return [
        {
            id: 'agronomist',
            nameEn: 'Agronomist Agent (Crop Phenology)',
            nameUr: 'ماہرِ زراعت ایجنٹ (فصل مرحلہ)',
            icon: 'sprout',
            statusEn: 'Consensus 98%',
            statusUr: 'اتفاق رائے 98%',
            statusColor: 'green',
            findingEn: `NDVI index is at ${ndvi.toFixed(2)} in ${locName}. Basmati rice / cotton is entering critical flowering stage.`,
            findingUr: `${locName} میں فصل کا NDVI انڈیکس ${ndvi.toFixed(2)} ہے۔ فصل اہم پولینیشن مرحلے میں داخل ہو رہی ہے۔`,
            recommendationEn: 'Avoid daytime thermal shock; maintain at least 4cm standing water in paddy fields.',
            recommendationUr: 'دوپہر کی شدید گرمی سے بچائیں؛ چاول کے کھیتوں میں کم از کم 4 سینٹی میٹر پانی کھڑا رکھیں۔'
        },
        {
            id: 'hydrology',
            nameEn: 'Hydrology & Irrigation Agent',
            nameUr: 'ماہرِ آبپاشی و ہائیڈرولوجی ایجنٹ',
            icon: 'droplets',
            statusEn: 'Consensus 96%',
            statusUr: 'اتفاق رائے 96%',
            statusColor: 'green',
            findingEn: `Atmospheric Vapor Pressure Deficit is elevated at ${vpd.toFixed(2)} kPa. Midday sprinkler loss estimated at ${(vpd * 12.2).toFixed(1)}%.`,
            findingUr: `فضا میں نمی کا دباؤ (VPD) ${vpd.toFixed(2)} kPa ہے۔ دوپہر کے وقت اسپرے پانی کا ${(vpd * 12.2).toFixed(1)}% حصہ ضائع ہوگا۔`,
            recommendationEn: 'Authorize night-cycle tube well irrigation (10:00 PM – 06:00 AM) to save 24% pumping energy and prevent flash evaporation.',
            recommendationUr: 'رات 10 بجے سے صبح 6 بجے تک ٹیوب ویل چلائیں تاکہ 24% بجلی اور پانی کی بچت ہو سکے۔'
        },
        {
            id: 'pathology',
            nameEn: 'Pathology & Pest Risk Agent',
            nameUr: 'پیتھالوجی و کیڑوں کی روک تھام ایجنٹ',
            icon: 'shield-alert',
            statusEn: 'Consensus 94%',
            statusUr: 'اتفاق رائے 94%',
            statusColor: 'yellow',
            findingEn: `Relative humidity cycling with evening dew points elevates whitefly & fungal rust index to Moderate (38%).`,
            findingUr: `شام کے وقت شبنم اور نمی کے باعث سفید مکھی اور پھپھوندی کے حملے کا خطرہ 38 فیصد ہے۔`,
            recommendationEn: 'Deploy pheromone traps at field boundaries. Hold chemical systemic spray until wind speed drops below 12 km/h.',
            recommendationUr: 'کھیت کے کناروں پر فیرومون ٹریپس لگائیں۔ کیڑے مار دوا ہوا کی رفتار 12 کلومیٹر سے کم ہونے پر ہی چھڑکیں۔'
        },
        {
            id: 'supply_chain',
            nameEn: 'Logistics & Market Cold-Chain Agent',
            nameUr: 'سپلائی چین و مارکیٹ ٹرانسپورٹ ایجنٹ',
            icon: 'truck',
            statusEn: 'Consensus 97%',
            statusUr: 'اتفاق رائے 97%',
            statusColor: 'green',
            findingEn: `Surface asphalt temperatures along N-5 highway will exceed 48°C between 12:00–16:00. High perishable spoilage risk for vegetables/fruits.`,
            findingUr: `جی ٹی روڈ (N-5) پر دوپہر 12 سے 4 بجے تک درجہ حرارت 48°C سے زیادہ رہے گا۔ سبزیوں اور پھلوں کے خراب ہونے کا خطرہ ہے۔`,
            recommendationEn: 'Dispatch reefer vehicles before 09:00 AM or utilize thermal tarpaulin covers for open transport.',
            recommendationUr: 'سبزیوں کی گاڑیاں صبح 9 بجے سے پہلے روانہ کریں یا ترپال سے ڈھانپ کر لے جائیں۔'
        }
    ];
}

export function getSpokenAdvisoryText(location, baseAnalytics, lang = 'ur') {
    const cityName = location?.city || location?.name || (lang === 'ur' ? 'منتخب علاقہ' : 'Selected Region');
    const temp = Math.round(baseAnalytics?.telemetry?.temperature_celsius ?? 34);
    const humidity = Math.round(baseAnalytics?.telemetry?.humidity_percentage ?? 45);
    const wind = Math.round(baseAnalytics?.telemetry?.wind_speed_kmh ?? 14);
    const conditions = baseAnalytics?.telemetry?.conditions || 'Partly Cloudy';
    const precipProb = Math.round((baseAnalytics?.telemetry?.precipitation_probability ?? 0.15) * 100);
    const soilMoisture = Math.round(baseAnalytics?.soil_moisture_pct ?? 32);
    const vpd = Number(baseAnalytics?.climate_matrix?.vapor_pressure_deficit_kpa ?? 1.85).toFixed(2);
    const gridStress = baseAnalytics?.telemetry?.grid_load_mw ? `${Math.round(baseAnalytics.telemetry.grid_load_mw)} میگاواٹ` : (lang === 'ur' ? 'معمول کے مطابق' : 'nominal');

    if (lang === 'ur') {
        const rainDetail = precipProb > 30 
            ? `بارش اور بادلوں کا امکان ${precipProb} فیصد ہے، لہٰذا کھلی فصلوں اور ترسیل میں پیشگی احتیاط برتیں۔` 
            : `موسمی حالات ${conditions} ہیں اور بارش کا امکان صرف ${precipProb} فیصد ہے۔`;

        const sprayGuidance = wind > 18 
            ? `تیز ہوا کی وجہ سے کیڑے مار ادویات کا اسپرے موخر کر دیں۔` 
            : `ہوا کا دباؤ اور رفتار اسپرے کے لیے مناسب ہے۔`;

        return `السلام علیکم! میں ڈبلیو آئی اے ایس یعنی ویدر انٹیلی جنس ایز اے سروس کا صوتی مشیر ہوں۔ ` +
               `${cityName} کے لیے تفصیلی لائیو موسمیاتی، زرعی، توانائی اور لاجسٹکس تجزیہ پیشِ خدمت ہے۔ ` +
               `اس وقت متوقع درجہ حرارت ${temp} ڈگری سینٹی گریڈ ہے، جبکہ فضا میں نمی کا تناسب ${humidity} فیصد اور ویپر پریشر ڈیفیسٹ ${vpd} کلو پاسکل ریکارڈ کیا گیا ہے۔ ` +
               `ہوا ${wind} کلومیٹر فی گھنٹہ کی رفتار سے چل رہی ہے۔ ` +
               `${rainDetail} ` +
               `زمین میں نمی کی سطح ${soilMoisture} فیصد ہے، اور پاور گرڈ کی صورتحال ${gridStress} ہے۔ ` +
               `${sprayGuidance} ` +
               `زرعی ٹیم دوپہر کی شدید دھوپ میں کھلے فیلڈ کی آبپاشی سے گریز کرے اور نسبتاً ٹھنڈے اوقات میں پانی دے تاکہ بخارات، توانائی کے خرچ اور فصل پر گرمی کے دباؤ کو کم کیا جا سکے۔ ` +
               `گرڈ آپریٹر درجہ حرارت بڑھنے کے اوقات میں طلب اور دستیاب گنجائش کی نگرانی کرے، جبکہ لاجسٹکس ٹیم خراب ہونے والی اجناس کو صبح کے ٹھنڈے اوقات میں روانہ کرے۔ ` +
               `ریسرچ، زراعت، گرڈ اور لاجسٹکس ایجنٹس اسی منتخب علاقے کے لائیو ڈیٹا کو ایک مشترکہ عملی مشورے میں تبدیل کرتے ہیں۔ ` +
               `اگر حالات تیزی سے بدلیں تو تازہ تجزیہ دوبارہ چلائیں۔ ڈبلیو آئی اے ایس کے تمام ملٹی ایجنٹ مانیٹرنگ ماڈیولز فعال اور ہم آہنگ ہیں۔ شکریہ۔`;
    } else {
        const rainDetail = precipProb > 30 
            ? `Precipitation probability is elevated at ${precipProb} percent. Secure open field assets.` 
            : `Sky conditions are ${conditions.toLowerCase()} with a ${precipProb} percent chance of rain.`;

        const sprayGuidance = wind > 18 
            ? `High wind speeds risk droplet drift. Hold chemical spray until wind subsides.` 
            : `Atmospheric conditions are optimal for chemical application.`;

        return `Hi, I am your Voice Advisory for WIaaS — Weather Intelligence as a Service. ` +
               `Here is the comprehensive real-time situational briefing for ${cityName}. ` +
               `Current temperature is ${temp} degrees Celsius, with relative humidity at ${humidity} percent and atmospheric vapor pressure deficit at ${vpd} kilopascals. ` +
               `Wind is blowing at ${wind} kilometers per hour. ` +
               `${rainDetail} ` +
               `Soil moisture index is at ${soilMoisture} percent, and grid demand is operating at ${gridStress}. ` +
               `${sprayGuidance} ` +
               `Suspend midday overhead irrigation to prevent evaporative water loss and heat shock. ` +
               `All WIaaS multi-agent telemetry nodes are fully synchronized. Thank you.`;
    }
}

export function getSmsPayload(location, baseAnalytics) {
    const locName = location?.city || location?.name || 'Multan, PK';
    const temp = Math.round(baseAnalytics?.telemetry?.temperature_celsius ?? 38);
    const humidity = Math.round(baseAnalytics?.telemetry?.humidity_percentage ?? 42);
    const soil = Math.round(baseAnalytics?.soil_moisture_pct ?? 31);
    
    return {
        sender: "Govt-WIaaS-Agri",
        recipient: "+92 300 1234567 (Farmer Hotline)",
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        textUr: `[زرعی الرٹ - ${locName}]\nگرمی: ${temp}°C | نمی: ${humidity}% | زمین کی نمی: ${soil}%\nمشورہ: دوپہر کو اسپرے نہ کریں۔ ٹیوب ویل رات 10 بجے چلائیں۔ سفید مکھی کا خطرہ معتدل ہے۔\n- ڈبلیو-آئی-اے-ایس پاکستان`,
        textEn: `[Agri-Alert: ${locName}]\nTemp: ${temp}C | Humid: ${humidity}% | Soil: ${soil}%\nAdvise: Suspend midday spray. Irrigate 10PM-6AM to save 22% water. Whitefly risk: Moderate.\n- WIaaS Pakistan`
    };
}
