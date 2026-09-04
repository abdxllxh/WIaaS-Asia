import { activeRegionKey, chatMode, setChatMode, getActiveRegion } from './state.js';
import { sendChatSimulation, sendCrisisLensChat, detectMessageLanguage } from './api.js';

let speechRecognition = null;
let isVoiceListening = false;
let voiceStatusTimer = null;

function getCurrentAppLanguage() {
    return document.documentElement.getAttribute('lang') || (document.body.classList.contains('urdu-mode') ? 'ur' : 'en');
}

function updateVoiceState(listening, message = '', tone = '') {
    isVoiceListening = listening;
    const button = document.getElementById('voice-input-btn');
    const status = document.getElementById('voice-input-status');
    const isUrdu = getCurrentAppLanguage() === 'ur';

    if (button) {
        button.classList.toggle('is-listening', listening);
        button.setAttribute('aria-pressed', String(listening));
        const startLabel = isUrdu ? 'صوتی ان پٹ شروع کریں' : 'Start voice input';
        const stopLabel = isUrdu ? 'صوتی ان پٹ روکیں' : 'Stop voice input';
        button.setAttribute('aria-label', listening ? stopLabel : startLabel);
        button.title = listening ? stopLabel : startLabel;
    }
    if (status) {
        status.textContent = message;
        status.classList.toggle('is-listening', tone === 'listening');
        status.classList.toggle('is-error', tone === 'error');
    }
}

function scheduleVoiceStatusClear(delay = 4200) {
    window.clearTimeout(voiceStatusTimer);
    voiceStatusTimer = window.setTimeout(() => {
        if (!isVoiceListening) updateVoiceState(false, '');
    }, delay);
}

export function setupVoiceInput() {
    const button = document.getElementById('voice-input-btn');
    const input = document.getElementById('chat-input');
    if (!button || !input || button.dataset.voiceReady === 'true') return;
    button.dataset.voiceReady = 'true';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        button.disabled = true;
        button.title = 'Voice input is not supported in this browser';
        button.setAttribute('aria-label', 'Voice input unavailable');
        updateVoiceState(false, 'Voice input is unavailable in this browser.', 'error');
        return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.maxAlternatives = 1;

    let startingText = '';
    let capturedText = '';
    let recognitionFailed = false;

    speechRecognition.onstart = () => {
        recognitionFailed = false;
        capturedText = '';
        startingText = input.value.trim();
        const isUrdu = getCurrentAppLanguage() === 'ur';
        updateVoiceState(true, isUrdu ? 'سن رہا ہوں… بولیں اور پھر رکیں۔' : 'Listening… speak naturally, then pause.', 'listening');
    };

    speechRecognition.onresult = (event) => {
        let transcript = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            transcript += event.results[index][0]?.transcript || '';
        }
        capturedText = transcript.trim();
        input.value = [startingText, capturedText].filter(Boolean).join(' ').trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    speechRecognition.onerror = (event) => {
        recognitionFailed = true;
        const isUrdu = getCurrentAppLanguage() === 'ur';
        const messagesEn = {
            'not-allowed': 'Microphone permission is blocked. Allow it in Chrome and try again.',
            'service-not-allowed': 'Voice recognition is blocked by the browser.',
            'audio-capture': 'No microphone was detected.',
            'no-speech': 'No speech was detected. Tap the microphone and try again.',
            network: 'Voice recognition needs a network connection in this browser.',
        };
        const messagesUr = {
            'not-allowed': 'مائیکروفون کی اجازت بلاک ہے۔ براہ کرم براؤزر میں مائیک کی اجازت دیں۔',
            'service-not-allowed': 'براؤزر نے صوتی شناخت روک دی ہے۔',
            'audio-capture': 'کوئی مائیکروفون نہیں ملا۔',
            'no-speech': 'کوئی آواز نہیں سنی گئی۔ دوبارہ مائیک دبا کر بولیں۔',
            network: 'صوتی شناخت کے لیے انٹرنیٹ کنکشن درکار ہے۔',
        };
        const msg = (isUrdu ? messagesUr[event.error] : messagesEn[event.error]) || (isUrdu ? 'صوتی ان پٹ شروع نہیں ہو سکا۔ دوبارہ کوشش کریں۔' : 'Voice input could not start. Please try again.');
        updateVoiceState(false, msg, 'error');
        scheduleVoiceStatusClear(6500);
    };

    speechRecognition.onend = () => {
        if (recognitionFailed) return;
        const isUrdu = getCurrentAppLanguage() === 'ur';
        if (capturedText) {
            updateVoiceState(false, isUrdu ? 'آواز ریکارڈ ہو گئی۔ پیغام بھیجنے کے لیے Send دبائیں۔' : 'Voice captured. Review the text, then press Send.');
            input.focus();
            scheduleVoiceStatusClear();
        } else {
            updateVoiceState(false, isUrdu ? 'صوتی ان پٹ بند ہو گیا۔' : 'Voice input stopped.');
            scheduleVoiceStatusClear(2500);
        }
    };

    button.addEventListener('click', () => {
        if (isVoiceListening) {
            speechRecognition.stop();
            return;
        }
        speechRecognition.lang = getCurrentAppLanguage() === 'ur' ? 'ur-PK' : 'en-US';
        window.clearTimeout(voiceStatusTimer);
        try {
            speechRecognition.start();
        } catch (error) {
            console.warn('[chat] Voice input could not start:', error);
            const isUrdu = getCurrentAppLanguage() === 'ur';
            updateVoiceState(false, isUrdu ? 'صوتی ان پٹ پہلے سے فعال ہے۔' : 'Voice input is already active. Please try again.', 'error');
            scheduleVoiceStatusClear();
        }
    });
}

function speechText(value) {
    return String(value || '')
        .replace(/[*#_`]/g, '')
        .replace(/^[-•]\s+/gm, '')
        .replace(/^\d+[.)]\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

let activeReplyAudio = null;
let activeReplyAudioUrl = '';
let activeReplyButton = null;
let speechRequestId = 0;

function setSpeechButtonState(button, speaking) {
    if (!button) return;
    const defaultLabel = button.dataset.defaultLabel || 'Listen';
    button.classList.toggle('is-speaking', speaking);
    button.setAttribute('aria-pressed', String(speaking));
    button.innerHTML = speaking
        ? `<i data-lucide="square" aria-hidden="true"></i><span>Stop</span>`
        : `<i data-lucide="volume-2" aria-hidden="true"></i><span>${defaultLabel}</span>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function stopActiveReplyAudio() {
    speechRequestId += 1;
    if (activeReplyAudio) {
        try {
            activeReplyAudio.pause();
            activeReplyAudio.currentTime = 0;
        } catch (e) {
            // ignore
        }
        activeReplyAudio = null;
    }
    if (activeReplyAudioUrl) {
        try {
            URL.revokeObjectURL(activeReplyAudioUrl);
        } catch (e) {
            // ignore
        }
        activeReplyAudioUrl = '';
    }
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    if (activeReplyButton) {
        setSpeechButtonState(activeReplyButton, false);
        activeReplyButton = null;
    }
}

async function speakReply(text, language = 'en-US', button = null) {
    const cleanText = speechText(text);
    if (!cleanText) return;

    if (activeReplyButton === button && button?.classList.contains('is-speaking')) {
        stopActiveReplyAudio();
        updateVoiceState(false, getCurrentAppLanguage() === 'ur' ? 'صوتی آڈیو روک دی گئی۔' : 'Audio stopped.');
        scheduleVoiceStatusClear(2000);
        return;
    }

    stopActiveReplyAudio();
    const requestId = ++speechRequestId;
    activeReplyButton = button;
    setSpeechButtonState(button, true);

    try {
        const response = await fetch('/api/v1/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: cleanText,
                language: language.startsWith('ur') ? 'ur' : 'en',
            }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (requestId !== speechRequestId) return;

        activeReplyAudioUrl = URL.createObjectURL(blob);
        activeReplyAudio = new Audio(activeReplyAudioUrl);

        const finish = () => {
            if (requestId !== speechRequestId) return;
            setSpeechButtonState(button, false);
            activeReplyButton = null;
            if (activeReplyAudioUrl) {
                try {
                    URL.revokeObjectURL(activeReplyAudioUrl);
                } catch (e) {
                    // ignore
                }
                activeReplyAudioUrl = '';
            }
        };

        activeReplyAudio.onended = finish;
        activeReplyAudio.onerror = () => {
            finish();
            updateVoiceState(false, 'Audio playback stopped. Please try again.', 'error');
            scheduleVoiceStatusClear();
        };
        await activeReplyAudio.play();
        return;
    } catch (error) {
        if (requestId !== speechRequestId) return;
        console.warn('[chat] Neural speech unavailable; using browser voice fallback:', error);
    }

    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        setSpeechButtonState(button, false);
        activeReplyButton = null;
        updateVoiceState(false, 'Audio playback is unavailable in this browser.', 'error');
        scheduleVoiceStatusClear();
        return;
    }
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language;
    utterance.rate = language.startsWith('ur') ? 0.92 : 0.96;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang?.toLowerCase().startsWith(language.slice(0, 2).toLowerCase())) || null;
    utterance.onend = () => {
        if (requestId !== speechRequestId) return;
        setSpeechButtonState(button, false);
        activeReplyButton = null;
    };
    utterance.onerror = () => {
        if (requestId !== speechRequestId) return;
        setSpeechButtonState(button, false);
        activeReplyButton = null;
        updateVoiceState(false, 'Audio playback stopped. Please try again.', 'error');
        scheduleVoiceStatusClear();
    };
    window.speechSynthesis.speak(utterance);
}

function appendSpeechControls(messageElement, translations = {}) {
    if (!messageElement || messageElement.querySelector('.message-speech-controls')) return;
    const controls = document.createElement('div');
    controls.className = 'message-speech-controls';
    controls.setAttribute('aria-label', 'Listen to this response');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'speech-action-btn';
    button.dataset.locale = 'en-US';
    button.dataset.defaultLabel = 'Listen';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Listen to this answer');
    button.title = 'Listen to this answer';
    button.innerHTML = `<i data-lucide="volume-2" aria-hidden="true"></i><span>Listen</span>`;

    const textToSpeak = translations.en || translations.text || '';
    if (!speechText(textToSpeak)) {
        button.disabled = true;
        button.title = 'Audio playback unavailable for this message';
    } else {
        button.addEventListener('click', () => speakReply(textToSpeak, 'en-US', button));
    }

    controls.appendChild(button);
    messageElement.appendChild(controls);
}

// ── Translation & Synchronization Engine ─────────────────────────────────────

export function translateWeatherToUrdu(text) {
    if (!text) return "";
    let res = String(text);

    // Standard English response openers
    res = res.replace(/I have reviewed the latest weather signals for ([^\.]+?)\./gi, 'میں نے $1 کے تازہ ترین موسمی سگنلز اور اشاریوں کا جائزہ لیا ہے۔');
    res = res.replace(/I have assessed current regional threats for ([^\.]+?)\./gi, 'میں نے $1 کے موجودہ علاقائی خطرات اور شدت کا تفصیلی تجزیہ کیا ہے۔');
    res = res.replace(/Hello — I’m CrisisLens\. I’m ready to help you understand risks around ([^\.]+?) without burying you in technical language\./gi, 'السلام علیکم — میں کرائسس لینز ہوں۔ میں $1 کے موسمی خطرات اور ان کے حل کو آسان زبان میں سمجھانے کے لیے تیار ہوں۔');
    res = res.replace(/Tell me what concerns you, or ask for threats, evidence, severity, or practical actions for people, farms, grids, and logistics\./gi, 'آپ مجھے اپنی تشویش بتا سکتے ہیں، یا ممکنہ خطرات، شواہد، شدت اور عملی اقدامات کے بارے میں پوچھ سکتے ہیں۔');
    res = res.replace(/Hi! I’m your WIaaS weather-intelligence partner for ([^\.]+?)\./gi, 'السلام علیکم! میں $1 کے لیے آپ کا ڈبلیو آئی اے اے ایس ویدر انٹیلیجنس ساتھی ہوں۔');
    res = res.replace(/You can speak naturally—tell me what you’re noticing or ask about weather, agriculture, grid pressure, logistics, or research\. I’ll explain the readings, what they mean, and what you can do next\./gi, 'آپ بلا جھجھک موسم، زراعت، بجلی کے گرڈ، لاجسٹکس یا تحقیق کے متعلق پوچھ سکتے ہیں۔ میں تمام حالات اور اگلے اقدامات آسان الفاظ میں واضح کروں گا۔');

    // Section Headers
    const headers = [
        [/\b(Current Conditions|Current Weather|Current Telemetry)\b/gi, 'موجودہ موسمی حالات'],
        [/\b(What This Means|Interpretation|Impact Analysis)\b/gi, 'اس کا تفصیلی مفہوم'],
        [/\b(Threat Level|Crisis Severity|Risk Level)\b/gi, 'خطرے اور بحران کی سطح'],
        [/\b(Recommended Actions|Actionable Steps|Actions|Practical Actions|Next Steps)\b/gi, 'تجویز کردہ عملی اقدامات'],
        [/\b(Agricultural Directives|Agriculture Directives|Crop Directives)\b/gi, 'زرعی و آبپاشی ہدایات'],
        [/\b(Power Grid Status|Grid Status|Energy Grid)\b/gi, 'بجلی اور پاور گرڈ کی صورتحال'],
        [/\b(Logistics & Fuel Reserves|Logistics Reserves|Fuel Status)\b/gi, 'لاجسٹکس اور ایندھن کا جائزہ'],
        [/\b(Evidence & Sources|Sources|Evidence)\b/gi, 'شواہد اور ڈیٹا کے ذرائع'],
        [/\b(Regional Threat Assessment|Threat Assessment)\b/gi, 'علاقائی خطرات کا جامع جائزہ'],
        [/\b(Regional Summary)\b/gi, 'علاقائی خلاصہ'],
        [/\b(Research Summary)\b/gi, 'تحقیقی خلاصہ'],
    ];
    headers.forEach(([p, r]) => { res = res.replace(p, r); });

    // Metrics & Variables
    const metrics = [
        [/\bVapor Pressure Deficit \(VPD\)\b/gi, 'ویپر پریشر ڈیفیسٹ (VPD)'],
        [/\bVapor Pressure Deficit\b/gi, 'ویپر پریشر ڈیفیسٹ'],
        [/\bRelative Humidity\b/gi, 'ہوا میں نمی کا تناسب'],
        [/\bHumidity\b/gi, 'ہوا میں نمی'],
        [/\bHeat Index\b/gi, 'ہیٹ انڈیکس'],
        [/\bWet-Bulb Temperature\b/gi, 'ویٹ بلب درجہ حرارت'],
        [/\bWet-Bulb\b/gi, 'ویٹ بلب'],
        [/\bBaseline Temp Deviation\b/gi, 'بنیادی درجہ حرارت سے انحراف'],
        [/\bDeviation from Baseline\b/gi, 'بنیادی حد سے انحراف'],
        [/\bTemperature\b/gi, 'درجہ حرارت'],
        [/\bWind Speed\b/gi, 'ہوا کی رفتار'],
        [/\bWind Direction\b/gi, 'ہوا کا رخ'],
        [/\bWind Velocity\b/gi, 'ہوا کی رفتار'],
        [/\bBlackout Risk\b/gi, 'بلیک آؤٹ کا خطرہ'],
        [/\bGrid Available Capacity\b/gi, 'گرڈ کی دستیاب گنجائش'],
        [/\bGrid Capacity\b/gi, 'گرڈ کی گنجائش'],
        [/\bDemand Surge\b/gi, 'طلب میں اضافہ'],
        [/\bFuel Reserves\b/gi, 'ایندھن کے ذخائر'],
        [/\bAvailable Fuel Reserves\b/gi, 'دستیاب ایندھن کے ذخائر'],
        [/\bThermal Fuel Overhead\b/gi, 'تھرمل برن اوور ہیڈ'],
        [/\bThermal Overhead\b/gi, 'تھرمل اوور ہیڈ'],
        [/\bEvaporative Rate Penalty\b/gi, 'بخاراتی شرح کا نقصان'],
        [/\bEvaporative Penalty\b/gi, 'بخاراتی نقصان'],
        [/\bEvaporation Loss\b/gi, 'بخاراتی نقصان'],
        [/\bIrrigation Efficiency\b/gi, 'آبپاشی کی کارکردگی'],
        [/\bRegional Risk\b/gi, 'علاقائی خطرہ'],
        [/\bPrimary Vector\b/gi, 'بنیادی اثر انداز عنصر'],
        [/\bSystem status\b/gi, 'سسٹم کی حالت'],
        [/\bCriticality\b/gi, 'حساسیت و شدت'],
        [/\bSeverity\b/gi, 'شدت'],
    ];
    metrics.forEach(([p, r]) => { res = res.replace(p, r); });

    // Status Values
    const values = [
        [/\bHealthy\b/g, 'معمول کے مطابق (Healthy)'],
        [/\bHEALTHY\b/g, 'معمول کے مطابق'],
        [/\bCritical\b/g, 'انتہائی نازک (Critical)'],
        [/\bCRITICAL\b/g, 'انتہائی نازک'],
        [/\bWarning\b/g, 'انتباہ (Warning)'],
        [/\bWARNING\b/g, 'انتباہ'],
        [/\bNominal\b/g, 'معمول پر (Nominal)'],
        [/\bNOMINAL\b/g, 'معمول پر'],
        [/\bLow\b/g, 'کم (Low)'],
        [/\bLOW\b/g, 'کم'],
        [/\bMedium\b/g, 'درمیانہ (Medium)'],
        [/\bMEDIUM\b/g, 'درمیانہ'],
        [/\bHigh\b/g, 'زیادہ (High)'],
        [/\bHIGH\b/g, 'زیادہ'],
    ];
    values.forEach(([p, r]) => { res = res.replace(p, r); });

    // Common descriptive sentences
    res = res.replace(/Vapor pressure deficit indicates mild plant and logistics stress\./gi, 'ویپر پریشر ڈیفیسٹ پودوں اور ٹرانسپورٹ پر ہلکے دباؤ کی نشاندہی کرتا ہے۔');
    res = res.replace(/Grid demand is elevated due to cooling requirements\./gi, 'ٹھنڈک کے آلات کے زیادہ استعمال کی وجہ سے گرڈ پر بجلی کی طلب میں اضافہ ہے۔');
    res = res.replace(/Maintain soil moisture levels with scheduled irrigation\./gi, 'مقررہ نظام الاوقات کے تحت آبپاشی کر کے مٹی کی نمی برقرار رکھیں۔');
    res = res.replace(/Monitor transformer temperatures across coastal zones\./gi, 'ساحلی پٹی میں بجلی کے ٹرانسفارمرز کے درجہ حرارت پر کڑی نظر رکھیں۔');
    res = res.replace(/Keep emergency fuel reserves on standby\./gi, 'ہنگامی ایندھن کے ذخائر کو الرٹ حالت میں رکھیں۔');
    res = res.replace(/Check local official meteorological updates\./gi, 'مقامی سرکاری موسمیاتی اعلانات اور ہدایات دیکھتے رہیں۔');
    res = res.replace(/Verify secondary feeder line stability\./gi, 'ثانوی فیڈر لائنوں کے وولٹیج اور استحکام کی تصدیق کریں۔');
    res = res.replace(/Re-evaluate if heat index climbs above 35°C\./gi, 'اگر ہیٹ انڈیکس 35 ڈگری سے تجاوز کرے تو ہنگامی حفاظتی تدابیر اختیار کریں۔');
    res = res.replace(/Official regional sensor network and satellite telemetry\./gi, 'سرکاری علاقائی سینسر نیٹ ورک اور سیٹلائٹ ٹیلی میٹری ڈیٹا۔');
    res = res.replace(/No verified external source available/gi, 'کوئی تصدیق شدہ بیرونی ذریعہ دستیاب نہیں');

    return res;
}

export function translateUserQueryToUrdu(query) {
    if (!query) return "";
    const q = String(query).trim().toLowerCase();
    if (/weather|forecast|climate|temperature/i.test(q)) {
        return 'موسم اور درجہ حرارت کی تازہ صورتحال کیا ہے؟';
    }
    if (/crop|agriculture|farm|irrigation|soil/i.test(q)) {
        return 'فصلوں کی صحت اور زرعی ٹیلی میٹری کی رپورٹ دیں۔';
    }
    if (/grid|power|blackout|electricity/i.test(q)) {
        return 'بجلی کے گرڈ اور لوڈ کی موجودہ صورتحال بتائیں۔';
    }
    if (/fuel|logistics|reserve/i.test(q)) {
        return 'ایندھن کے ذخائر اور لاجسٹکس کا جائزہ فراہم کریں۔';
    }
    if (/threat|danger|crisis|warning|risk/i.test(q)) {
        return 'علاقائی موسمی خطرات اور وارننگز کی تفصیلات بتائیں۔';
    }
    if (/action|step|advice|help/i.test(q)) {
        return 'ہمیں اس وقت کیا حفاظتی اقدامات کرنے چاہئیں؟';
    }
    if (/detail|all|everything|comprehensive/i.test(q)) {
        return 'مجھے اس خطے کی تمام تفصیلی معلومات اور رپورٹ درکار ہے۔';
    }
    return `سوال: ${query}`;
}

export function translateNotificationToUrdu(text) {
    if (!text) return "";
    if (text.includes("Asia agent network connected")) {
        return "ایشیائی ایجنٹ نیٹ ورک منسلک ہے۔ جوابات خطے میں منتخب کردہ ملک یا شہر کے مطابق دیے جاتے ہیں۔";
    }
    if (text.includes("Global weather models")) {
        return "عالمی موسمیاتی ماڈلز نے اگلے 72 گھنٹوں کی تازہ ترین پیشگوئی مرتب کر لی ہے۔ مغربی گرڈ سیکٹر پر خصوصی توجہ کی سفارش کی جاتی ہے۔";
    }
    return text;
}

function escapeAttr(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── updateChatModeUI() ────────────────────────────────────────────────────────
export function updateChatModeUI(mode) {
    setChatMode(mode);
    const headerTitle = document.querySelector('.chat-card .panel-header .header-title h2');
    const headerIcon = document.querySelector('.chat-card .panel-header .header-title i');
    const chatInput = document.getElementById('chat-input');
    const container = document.getElementById('chat-history');
    const region = getActiveRegion() || {};
    const hasExplicitSelection = window._hasExplicitRegionSelection === true;
    const selectedPlace = hasExplicitSelection
        ? (region.name || region.city || region.country || 'your selected Asian region')
        : 'Central, East, South, and West Asia';
    const selectedPlaceUr = hasExplicitSelection
        ? selectedPlace
        : 'وسطی، مشرقی، جنوبی اور مغربی ایشیا';
    const isUrdu = getCurrentAppLanguage() === 'ur';

    if (mode === 'crisislens') {
        if (headerTitle) headerTitle.textContent = isUrdu ? "ڈبلیو آئی اے اے ایس کرائسس لینز" : "WIaaS CrisisLens";
        if (headerIcon) {
            headerIcon.setAttribute('data-lucide', 'shield-alert');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        if (chatInput) {
            chatInput.placeholder = isUrdu ? "کرائسس لینز سے پوچھیں (موسمی خطرات، عملی اقدامات وغیرہ)..." : "Ask CrisisLens (weather threats, actions, etc.)...";
            chatInput.dir = isUrdu ? 'rtl' : 'ltr';
        }

        const greetingEn = `Hello — I’m CrisisLens. I’m ready to help you understand risks around **${selectedPlace}** without burying you in technical language.\n\nTell me what concerns you, or ask for threats, evidence, severity, or practical actions for people, farms, grids, and logistics.`;
        const greetingUr = `السلام علیکم — میں کرائسس لینز ہوں۔ میں **${selectedPlaceUr}** کے موسمی خطرات اور ان کے حل کو آسان زبان میں سمجھانے کے لیے تیار ہوں۔\n\nآپ مجھے اپنی تشویش بتا سکتے ہیں، یا ممکنہ خطرات، شواہد، شدت اور عملی اقدامات کے بارے میں پوچھ سکتے ہیں۔`;

        const notifTitleEn = "CrisisLens Active";
        const notifTitleUr = "کرائسس لینز فعال";
        const notifBodyEn = "Asia agent network connected. Responses use the country or city currently selected in Region.";
        const notifBodyUr = "ایشیائی ایجنٹ نیٹ ورک منسلک ہے۔ خطے میں منتخب کردہ ملک یا شہر کا ڈیٹا استعمال ہو رہا ہے۔";

        if (container) container.innerHTML = `
            <div class="chat-message agent-msg" data-text-en="${escapeAttr(greetingEn)}" data-text-ur="${escapeAttr(greetingUr)}" lang="${isUrdu ? 'ur' : 'en'}" dir="${isUrdu ? 'rtl' : 'ltr'}">
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="shield-alert"></i> ${isUrdu ? 'کرائسس لینز ایجنٹ' : 'CrisisLens Agent'}</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="msg-text">${formatReply(isUrdu ? greetingUr : greetingEn)}</div>
                <div class="system-notification" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05);">
                    <span class="notif-title" style="color: #ef4444;" data-title-en="${notifTitleEn}" data-title-ur="${notifTitleUr}">${isUrdu ? notifTitleUr : notifTitleEn}</span>
                    <p class="notif-body" data-body-en="${notifBodyEn}" data-body-ur="${notifBodyUr}">${isUrdu ? notifBodyUr : notifBodyEn}</p>
                </div>
            </div>
        `;
        appendSpeechControls(container?.querySelector('.agent-msg'), {
            en: `Hello. I’m CrisisLens. I’m ready to help you understand risks around ${selectedPlace}. Tell me what concerns you, or ask for threats, evidence, severity, or practical actions.`,
            ur: `السلام علیکم۔ میں کرائسس لینز ہوں۔ میں ${selectedPlaceUr} کے خطرات، شواہد، شدت اور عملی اقدامات سمجھنے میں آپ کی مدد کر سکتا ہوں۔`,
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        if (headerTitle) headerTitle.textContent = isUrdu ? "ڈبلیو آئی اے اے ایس اے آئی اسسٹنٹ" : "WIaaS Agent";
        if (headerIcon) {
            headerIcon.setAttribute('data-lucide', 'sparkles');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        if (chatInput) {
            chatInput.placeholder = isUrdu ? "موسم، فصلوں، گرڈ یا موسمیات کے بارے میں پوچھیں..." : "Ask WIaaS agent swarm anything...";
            chatInput.dir = isUrdu ? 'rtl' : 'ltr';
        }

        const greetingEn = `Hi! I’m your WIaaS weather-intelligence partner for **${selectedPlace}**.\n\nYou can speak naturally—tell me what you’re noticing or ask about weather, agriculture, grid pressure, logistics, or research. I’ll explain the readings, what they mean, and what you can do next.`;
        const greetingUr = `السلام علیکم! میں **${selectedPlaceUr}** کے لیے آپ کا ڈبلیو آئی اے اے ایس ویدر انٹیلیجنس ساتھی ہوں۔\n\nآپ بلا جھجھک موسم، زراعت، بجلی کے گرڈ، لاجسٹکس یا تحقیق کے متعلق پوچھ سکتے ہیں۔ میں تمام حالات اور اگلے اقدامات آسان الفاظ میں واضح کروں گا۔`;

        const notifTitleEn = "System Notification";
        const notifTitleUr = "نظامی اطلاع";
        const notifBodyEn = "Global weather models have just compiled a new ensemble forecast for the Next 72 Hours. Focus is recommended on Sector West Grid.";
        const notifBodyUr = "عالمی موسمیاتی ماڈلز نے اگلے 72 گھنٹوں کی تازہ ترین پیشگوئی مرتب کر لی ہے۔ مغربی گرڈ سیکٹر پر خصوصی توجہ کی سفارش کی جاتی ہے۔";

        if (container) container.innerHTML = `
            <div class="chat-message agent-msg" data-text-en="${escapeAttr(greetingEn)}" data-text-ur="${escapeAttr(greetingUr)}" lang="${isUrdu ? 'ur' : 'en'}" dir="${isUrdu ? 'rtl' : 'ltr'}">
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="cpu"></i> ${isUrdu ? 'ڈبلیو آئی اے اے ایس ایجنٹ' : 'WIaaS Agent'}</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="msg-text">${formatReply(isUrdu ? greetingUr : greetingEn)}</div>
                <div class="system-notification">
                    <span class="notif-title" data-title-en="${notifTitleEn}" data-title-ur="${notifTitleUr}">${isUrdu ? notifTitleUr : notifTitleEn}</span>
                    <p class="notif-body" id="system-notification-text" data-body-en="${notifBodyEn}" data-body-ur="${notifBodyUr}">${isUrdu ? notifBodyUr : notifBodyEn}</p>
                </div>
            </div>
        `;
        appendSpeechControls(container?.querySelector('.agent-msg'), {
            en: `Hi. I’m your WIaaS weather intelligence partner for ${selectedPlace}. Ask naturally about weather, agriculture, grid pressure, logistics, or research.`,
            ur: `السلام علیکم۔ میں ${selectedPlaceUr} کے لیے آپ کا ویدر انٹیلیجنس ساتھی ہوں۔ آپ موسم، زراعت، بجلی، لاجسٹکس یا تحقیق کے بارے میں پوچھ سکتے ہیں۔`,
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ── extractWebhookReply() ───────────────────────────────────────────────────
function extractWebhookReply(data) {
    if (!data) return "";
    if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (first && typeof first === 'object') {
            return first.output || first.message || first.text || JSON.stringify(first);
        }
        return String(first);
    }
    if (typeof data === 'object') {
        return data.output || data.message || data.text || data.reply || JSON.stringify(data);
    }
    return String(data);
}

// ── handleUserMessage() ──────────────────────────────────────────────────────
export async function handleUserMessage(event) {
    event?.preventDefault?.();
    const input     = document.getElementById('chat-input');
    const container = document.getElementById('chat-history');
    if (!input || !container) return;
    const query     = input.value.trim();
    if (!query) return;
    const form = document.getElementById('chat-form');
    const sendButton = document.getElementById('send-chat-btn');
    const voiceButton = document.getElementById('voice-input-btn');
    const queryLanguage = detectMessageLanguage(query);
    const isCurrentUrdu = getCurrentAppLanguage() === 'ur';

    if (isVoiceListening && speechRecognition) speechRecognition.stop();

    // Render user message with bilingual attributes
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user-msg';
    userMsg.lang = isCurrentUrdu ? 'ur' : (queryLanguage === 'ur' ? 'ur' : 'en');
    userMsg.dir = (isCurrentUrdu || queryLanguage === 'ur') ? 'rtl' : 'ltr';
    userMsg.dataset.queryOrig = query;
    userMsg.dataset.queryEn = queryLanguage === 'en' ? query : query;
    userMsg.dataset.queryUr = queryLanguage === 'ur' ? query : translateUserQueryToUrdu(query);

    const initialDisplayQuery = isCurrentUrdu ? userMsg.dataset.queryUr : userMsg.dataset.queryEn;
    const initialUserTag = isCurrentUrdu ? 'آپ (آپریٹر)' : 'Operator';

    userMsg.innerHTML = `
        <div class="msg-header">
            <span class="user-tag">${initialUserTag}</span>
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="msg-text">${escapeHtml(initialDisplayQuery)}</p>
    `;
    container.appendChild(userMsg);
    input.value = '';
    input.disabled = true;
    if (sendButton) sendButton.disabled = true;
    if (voiceButton) voiceButton.disabled = true;
    form?.setAttribute('aria-busy', 'true');
    container.scrollTop = container.scrollHeight;

    // Show loading indicator
    const loadingId = 'loading-' + Date.now();
    const loadingMsg = document.createElement('div');
    loadingMsg.id = loadingId;
    loadingMsg.className = 'chat-message agent-msg';
    loadingMsg.lang = isCurrentUrdu ? 'ur' : 'en';
    loadingMsg.dir = isCurrentUrdu ? 'rtl' : 'ltr';

    const loadingText = isCurrentUrdu
        ? (chatMode === 'crisislens' ? 'علاقائی خطرات اور ٹیلی میٹری کا جائزہ لیا جا رہا ہے…' : 'تازہ ترین علاقائی سگنلز کا مطالعہ کیا جا رہا ہے…')
        : (chatMode === 'crisislens' ? 'Reviewing regional risk signals…' : 'Reading the latest regional signals…');

    const loadingTag = chatMode === 'crisislens'
        ? (isCurrentUrdu ? 'کرائسس لینز ایجنٹ' : 'CrisisLens Agent')
        : (isCurrentUrdu ? 'ڈبلیو آئی اے اے ایس ایجنٹ' : 'WIaaS Agent');

    loadingMsg.innerHTML = `
        <div class="msg-header">
            <span class="agent-tag"><i data-lucide="${chatMode === 'crisislens' ? 'shield-alert' : 'cpu'}"></i> ${loadingTag}</span>
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="msg-text chat-thinking"><span></span><span></span><span></span><em>${loadingText}</em></div>
    `;
    container.appendChild(loadingMsg);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    container.scrollTop = container.scrollHeight;

    // Fetch region context then produce agent reply
    try {
        let replyText = "";
        let agentTagText = "";
        let agentIcon = "";
        let speechEnglish = '';
        let speechUrdu = '';
        let responseLanguage = queryLanguage;

        if (chatMode === 'crisislens') {
            agentTagText = isCurrentUrdu ? "کرائسس لینز ایجنٹ" : "CrisisLens Agent";
            agentIcon = "shield-alert";
            const data = await sendCrisisLensChat(query);
            if (!data) {
                throw new Error("No response from CrisisLens webhook");
            }
            replyText = extractWebhookReply(data);
            speechEnglish = data.speech_en || '';
            speechUrdu = data.speech_ur || '';
            responseLanguage = data.response_language || queryLanguage;
        } else {
            agentTagText = isCurrentUrdu ? "ڈبلیو آئی اے اے ایس ایجنٹ" : "WIaaS Agent";
            agentIcon = "cpu";
            const data = await sendChatSimulation(activeRegionKey, query);
            if (!data) {
                throw new Error("No response from backend");
            }
            replyText = data.reply;
            speechEnglish = data.speech_en || '';
            speechUrdu = data.speech_ur || '';
            responseLanguage = data.response_language || queryLanguage;
        }

        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        let textEn = speechEnglish || (responseLanguage === 'en' ? replyText : '');
        let textUr = speechUrdu || (responseLanguage === 'ur' ? replyText : '');

        if (!textUr && textEn) {
            textUr = translateWeatherToUrdu(textEn);
        }
        if (!textEn && textUr) {
            textEn = replyText;
        }

        const agentMsg = document.createElement('div');
        agentMsg.className = 'chat-message agent-msg';
        agentMsg.dataset.textEn = textEn;
        agentMsg.dataset.textUr = textUr;
        agentMsg.lang = isCurrentUrdu ? 'ur' : 'en';
        agentMsg.dir = isCurrentUrdu ? 'rtl' : 'ltr';

        const displayReply = isCurrentUrdu ? textUr : textEn;

        agentMsg.innerHTML = `
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="${agentIcon}"></i> ${agentTagText}</span>
                <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="msg-text">${formatReply(displayReply)}</div>
        `;
        appendSpeechControls(agentMsg, {
            en: textEn,
            ur: textUr,
        });
        container.appendChild(agentMsg);
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        container.scrollTop = container.scrollHeight;

    } catch (e) {
        console.error('[chat] handleUserMessage failed:', e);
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        const errorEn = 'I could not reach the intelligence service just now. Your question is still here—please try again in a moment.';
        const errorUr = 'میں ابھی انٹیلیجنس سروس سے رابطہ نہیں کر سکا۔ آپ کا سوال محفوظ ہے—براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔';

        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-message agent-msg';
        errorMsg.dataset.textEn = errorEn;
        errorMsg.dataset.textUr = errorUr;
        errorMsg.lang = isCurrentUrdu ? 'ur' : 'en';
        errorMsg.dir = isCurrentUrdu ? 'rtl' : 'ltr';
        errorMsg.innerHTML = `
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="alert-triangle"></i> ${isCurrentUrdu ? 'نظامی خرابی' : 'System Error'}</span>
                <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="msg-text chat-error">${isCurrentUrdu ? errorUr : errorEn}</p>
        `;
        appendSpeechControls(errorMsg, {
            en: errorEn,
            ur: errorUr,
        });
        container.appendChild(errorMsg);
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        container.scrollTop = container.scrollHeight;
    } finally {
        input.disabled = false;
        if (sendButton) sendButton.disabled = false;
        if (voiceButton) voiceButton.disabled = false;
        form?.removeAttribute('aria-busy');
        input.focus();
    }
}

// ── updateChatLanguage() ─────────────────────────────────────────────────────
/**
 * Instantly synchronizes all chat components and existing message history
 * when the user toggles between English and Urdu in the navigation bar.
 */
export function updateChatLanguage(lang) {
    const isUrdu = lang === 'ur';

    // 1. Synchronize Header Title, Placeholders, and Button Tooltips
    const headerTitle = document.querySelector('.chat-card .panel-header .header-title h2');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    const voiceBtn = document.getElementById('voice-input-btn');
    const clearBtn = document.getElementById('clear-chat');
    const closeBtn = document.getElementById('close-right-panel');

    if (headerTitle) {
        if (chatMode === 'crisislens') {
            headerTitle.textContent = isUrdu ? "ڈبلیو آئی اے اے ایس کرائسس لینز" : "WIaaS CrisisLens";
        } else {
            headerTitle.textContent = isUrdu ? "ڈبلیو آئی اے اے ایس اے آئی اسسٹنٹ" : "WIaaS AI Assistant";
        }
    }

    if (chatInput) {
        if (chatMode === 'crisislens') {
            chatInput.placeholder = isUrdu
                ? "کرائسس لینز سے پوچھیں (موسمی خطرات، عملی اقدامات وغیرہ)..."
                : "Ask CrisisLens (weather threats, actions, etc.)...";
        } else {
            chatInput.placeholder = isUrdu
                ? "موسم، فصلوں، گرڈ یا موسمیات کے بارے میں پوچھیں..."
                : "Ask about weather, crops, grid, or climate...";
        }
        chatInput.dir = isUrdu ? 'rtl' : 'ltr';
    }

    if (sendBtn) {
        const title = isUrdu ? "پیغام بھیجیں" : "Send Message";
        sendBtn.setAttribute('title', title);
        sendBtn.setAttribute('aria-label', title);
    }
    if (voiceBtn) {
        const title = isUrdu ? "صوتی ان پٹ شروع کریں" : "Start voice input";
        voiceBtn.setAttribute('title', title);
        voiceBtn.setAttribute('aria-label', title);
    }
    if (clearBtn) {
        clearBtn.setAttribute('title', isUrdu ? "چیٹ صاف کریں" : "Clear Chat");
    }
    if (closeBtn) {
        closeBtn.setAttribute('title', isUrdu ? "بند کریں" : "Close");
    }

    // 2. Synchronize Entire Chat Message History
    const container = document.getElementById('chat-history');
    if (!container) return;

    // Ensure no legacy Urdu translation buttons linger in chat
    container.querySelectorAll('.speech-action-btn[data-locale^="ur"]').forEach((btn) => btn.remove());

    const messages = container.querySelectorAll('.chat-message');
    messages.forEach((msg) => {
        const isAgent = msg.classList.contains('agent-msg');
        const isUser = msg.classList.contains('user-msg');

        if (isAgent) {
            msg.lang = isUrdu ? 'ur' : 'en';
            msg.dir = isUrdu ? 'rtl' : 'ltr';

            // Agent Tag
            const tagEl = msg.querySelector('.agent-tag');
            if (tagEl) {
                const tagText = tagEl.innerText.toLowerCase();
                const isCrisis = chatMode === 'crisislens' || tagText.includes('crisis') || tagText.includes('کرائسس');
                const isError = tagText.includes('error') || tagText.includes('خرابی');
                if (isError) {
                    tagEl.innerHTML = `<i data-lucide="alert-triangle"></i> ${isUrdu ? 'نظامی خرابی' : 'System Error'}`;
                } else if (isCrisis) {
                    tagEl.innerHTML = `<i data-lucide="shield-alert"></i> ${isUrdu ? 'کرائسس لینز ایجنٹ' : 'CrisisLens Agent'}`;
                } else {
                    tagEl.innerHTML = `<i data-lucide="cpu"></i> ${isUrdu ? 'ڈبلیو آئی اے اے ایس ایجنٹ' : 'WIaaS Agent'}`;
                }
            }

            // Message Body Text
            const textEl = msg.querySelector('.msg-text');
            if (textEl && !textEl.classList.contains('chat-thinking')) {
                let textUr = msg.dataset.textUr;
                let textEn = msg.dataset.textEn;

                if (!textEn && !textUr) {
                    // Fallback to text inside
                    textEn = textEl.innerText;
                    msg.dataset.textEn = textEn;
                }
                if (!textUr && textEn) {
                    textUr = translateWeatherToUrdu(textEn);
                    msg.dataset.textUr = textUr;
                }

                if (isUrdu) {
                    textEl.innerHTML = formatReply(textUr || translateWeatherToUrdu(textEn));
                } else {
                    textEl.innerHTML = formatReply(textEn);
                }
            }

            // System Notification (if present)
            const notifTitle = msg.querySelector('.notif-title');
            const notifBody = msg.querySelector('.notif-body');
            if (notifTitle) {
                const titleEn = notifTitle.dataset.titleEn || notifTitle.innerText;
                const titleUr = notifTitle.dataset.titleUr || (titleEn.includes('Crisis') ? 'کرائسس لینز فعال' : 'نظامی اطلاع');
                notifTitle.dataset.titleEn = titleEn;
                notifTitle.dataset.titleUr = titleUr;
                notifTitle.innerText = isUrdu ? titleUr : titleEn;
            }
            if (notifBody) {
                const bodyEn = notifBody.dataset.bodyEn || notifBody.innerText;
                const bodyUr = notifBody.dataset.bodyUr || translateNotificationToUrdu(bodyEn);
                notifBody.dataset.bodyEn = bodyEn;
                notifBody.dataset.bodyUr = bodyUr;
                notifBody.innerText = isUrdu ? bodyUr : bodyEn;
            }
        } else if (isUser) {
            msg.lang = isUrdu ? 'ur' : 'en';
            msg.dir = isUrdu ? 'rtl' : 'ltr';

            // User Tag
            const userTag = msg.querySelector('.user-tag');
            if (userTag) {
                userTag.innerText = isUrdu ? 'آپ (آپریٹر)' : 'Operator';
            }

            // User Message Text
            const textEl = msg.querySelector('.msg-text');
            if (textEl) {
                if (!msg.dataset.queryOrig) {
                    msg.dataset.queryOrig = textEl.innerText;
                }
                if (!msg.dataset.queryUr) {
                    msg.dataset.queryUr = translateUserQueryToUrdu(msg.dataset.queryOrig);
                }
                textEl.innerText = isUrdu ? msg.dataset.queryUr : (msg.dataset.queryEn || msg.dataset.queryOrig);
            }
        }
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// ── formatReply() ────────────────────────────────────────────────────────────
function formatReply(text) {
    if (!text) return "";
    const inline = (value) => escapeHtml(value)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    const lines = String(text).replace(/\\n/g, '\n').split(/\r?\n/);
    const output = [];
    let listType = '';
    const closeList = () => {
        if (listType) output.push(`</${listType}>`);
        listType = '';
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            closeList();
            continue;
        }
        const heading = line.match(/^(?:#{1,3}\s*)?\*\*(.+?)\*\*:?$/) || line.match(/^#{1,3}\s+(.+)$/);
        const bullet = line.match(/^[-•]\s+(.+)$/);
        const numbered = line.match(/^\d+[.)]\s+(.+)$/);
        if (heading) {
            closeList();
            output.push(`<h4>${inline(heading[1])}</h4>`);
        } else if (bullet || numbered) {
            const wanted = numbered ? 'ol' : 'ul';
            if (listType !== wanted) {
                closeList();
                output.push(`<${wanted}>`);
                listType = wanted;
            }
            output.push(`<li>${inline((bullet || numbered)[1])}</li>`);
        } else {
            closeList();
            output.push(`<p>${inline(line)}</p>`);
        }
    }
    closeList();
    return output.join('');
}

// ── escapeHtml() ─────────────────────────────────────────────────────────────
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Attach to window for global developer console or cross-module access
window.__wiaas = window.__wiaas || {};
window.__wiaas.updateChatLanguage = updateChatLanguage;
