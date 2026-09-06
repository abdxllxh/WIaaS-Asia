import { createMorph } from 'morphicons/dom';

// Comprehensive 24x24 Lucide / Heroicons SVG paths for dynamic spring morphing
export const ICON_PATHS = {
    // Voice Advisory
    volume: 'M11 5L6 9H2v6h4l5 4V5zm4.5 3c1.5 1.5 1.5 4.5 0 6m3-9c3 3 3 9 0 12',
    volumeHover: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm7 10a7 7 0 0 1-14 0M12 18v4M8 22h8',
    volumeActive: 'M11 5L6 9H2v6h4l5 4V5zm8-1v16M15 8v8M23 10v4',
    stop: 'M6 6h12v12H6z',
    mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm7 10a7 7 0 0 1-14 0M12 18v4M8 22h8',

    // Region: Map <-> Globe
    map: 'M1 6v15l7-4 8 4 7-4V2l-7 4-8-4-7 4zm7-4v15m8-11v15',
    globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c2.5 4 4 7.5 4 10s-1.5 6-4 10m0-20c-2.5 4-4 7.5-4 10s1.5 6 4 10M2 12h20',

    // Physics: Thermometer <-> Flame
    thermometer: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
    flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',

    // Agriculture: Sprout <-> Leaf
    sprout: 'M7 20h10M10 20c0-7 1-10 6-12 1 5-2 8-6 12zm-3-8c4 1 5 4 5 8-5 0-7-4-5-8z',
    leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',

    // Grid: Zap <-> Activity Pulse
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',

    // Logistics: Truck <-> Navigation Compass
    truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zm-10 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm11 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    navigation: 'M3 11l19-9-9 19-2-8-8-2z',

    // Research: Microscope <-> Sparkles
    microscope: 'M6 18h8M3 22h18M14 22a7 7 0 1 0-7-7M9 14h2M9 12a2 2 0 1 0 4 0V6a2 2 0 1 0-4 0v6z',
    sparkles: 'M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z',

    // Location Analysis: Crosshair <-> Target
    crosshair: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
    target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',

    // WIaaS: CPU <-> Bot AI Brain
    cpu: 'M4 4h16v16H4zm5 5h6v6H9zM9 1v3m6-3v3M9 20v3m6-3v3M1 9h3m-3 6h3M20 9h3m-3 6h3',
    bot: 'M12 8V4H8M16 4h-4M4 8h16v12H4zM9 13v2m6-2v2',

    // CrisisLens: ShieldAlert <-> ShieldCheck
    shieldAlert: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm0-14v4m0 4h.01',
    shieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm-3-11l2 2 4-4',

    // Analytics: BarChart <-> TrendingUp
    barChart: 'M18 20V10M12 20V4M6 20v-6',
    trendingUp: 'M23 6l-9.5 9.5-5-5L1 18m16-12h6v6',

    // Sliders / Simulator Controls
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    play: 'M5 3l14 9-14 9V3z',

    // Actions: Check <-> ShieldCheck
    check: 'M20 6L9 17l-5-5',
    checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',

    // Documents: FileText <-> BookOpen
    fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    bookOpen: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',

    // Sharing: Share2 <-> Send
    share2: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',

    // Refresh & Reset
    refreshCw: 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
    rotateCw: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
    rotateCcw: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5',

    // Close X <-> XCircle
    x: 'M18 6L6 18M6 6l12 12',
    xCircle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3 7l-6 6m0-6l6 6',

    // Modal / Communication
    messageCircle: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
    printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    fileDown: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3',

    // Directives
    droplets: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.82-2.29 3.76S3 11.09 3 12.25c0 2.22 1.8 4.05 4 4.05zM17 21c2.76 0 5-2.24 5-5 0-1.44-.72-2.8-2.14-3.95S17.36 9.17 17 7.37c-.36 1.8-1.43 3.53-2.86 4.68S12 14.56 12 16c0 2.76 2.24 5 5 5z',
    cloudRain: 'M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',

    // Docks
    chevronLeft: 'M15 18l-6-6 6-6',
    chevronRight: 'M9 18l6-6-6-6',
    panelOpen: 'M3 3h18v18H3zM9 3v18',
    panelClose: 'M3 3h18v18H3zM15 3v18'
};

const _activeMorphs = new Map();

/**
 * Creates an animated SVG morph on target element
 */
export function attachMorphIcon(targetEl, initialPathKey = 'volume', options = {}) {
    if (!targetEl) return null;

    let svgEl = targetEl.querySelector('svg.morph-icon-svg');
    let pathEl;

    if (!svgEl) {
        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('viewBox', '0 0 24 24');
        svgEl.setAttribute('fill', 'none');
        svgEl.setAttribute('stroke', 'currentColor');
        svgEl.setAttribute('stroke-width', options.strokeWidth || '2');
        svgEl.setAttribute('stroke-linecap', 'round');
        svgEl.setAttribute('stroke-linejoin', 'round');
        svgEl.classList.add('morph-icon-svg');
        if (options.size) {
            svgEl.style.width = typeof options.size === 'number' ? `${options.size}px` : options.size;
            svgEl.style.height = typeof options.size === 'number' ? `${options.size}px` : options.size;
        }

        pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = ICON_PATHS[initialPathKey] || initialPathKey;
        pathEl.setAttribute('d', d);
        svgEl.appendChild(pathEl);

        const existingIcon = targetEl.querySelector('i[data-lucide], svg');
        if (existingIcon) {
            existingIcon.replaceWith(svgEl);
        } else {
            targetEl.prepend(svgEl);
        }
    } else {
        pathEl = svgEl.querySelector('path');
    }

    try {
        const morph = createMorph(pathEl, ICON_PATHS[initialPathKey] || initialPathKey);
        _activeMorphs.set(targetEl, { morph, current: initialPathKey, base: initialPathKey });
        return morph;
    } catch (e) {
        console.warn('[morphicons] init warning:', e);
        return null;
    }
}

/**
 * Smoothly morph target element to a new icon with spring physics
 */
export function morphIconTo(targetEl, targetPathKey, preset = 'snappy') {
    if (!targetEl) return;
    const entry = _activeMorphs.get(targetEl);
    if (!entry) {
        attachMorphIcon(targetEl, targetPathKey);
        return;
    }

    const nextD = ICON_PATHS[targetPathKey] || targetPathKey;
    try {
        entry.morph.morphTo(nextD, preset);
        entry.current = targetPathKey;
    } catch (e) {
        console.warn('[morphicons] morphTo warning:', e);
    }
}

/**
 * Reusable helper to attach spring-physics logo-changing hover morph
 */
export function attachHoverMorph(targetEl, baseKey, hoverKey, options = {}) {
    if (!targetEl || targetEl._hasHoverMorph) return;
    targetEl._hasHoverMorph = true;

    attachMorphIcon(targetEl, baseKey, options);

    targetEl.addEventListener('mouseenter', () => {
        morphIconTo(targetEl, hoverKey, 'bouncy');
    });

    targetEl.addEventListener('mouseleave', () => {
        morphIconTo(targetEl, baseKey, 'snappy');
    });
}

/**
 * Dynamic hydrator for elements rendered after startup (e.g. subtabs, modals, dynamically injected buttons)
 */
export function hydrateDynamicMorphIcons(root = document) {
    // 1. Agriculture subtabs
    const subtabs = [
        { id: 'subtab-diagnostics', base: 'activity', hover: 'zap' },
        { id: 'subtab-simulator', base: 'sliders', hover: 'play' },
        { id: 'subtab-plant-scanner', base: 'crosshair', hover: 'leaf' }
    ];
    subtabs.forEach(({ id, base, hover }) => {
        const el = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
        if (el) attachHoverMorph(el, base, hover, { size: 15, strokeWidth: 2 });
    });

    // 2. Simulation action buttons
    const applyBtn = root.querySelector('#apply-sim-plan-btn') || root.querySelector('.sim-btn.primary');
    if (applyBtn) attachHoverMorph(applyBtn, 'check', 'shieldCheck', { size: 16, strokeWidth: 2.2 });

    const resetSimBtn = root.querySelector('#reset-sim-btn');
    if (resetSimBtn) attachHoverMorph(resetSimBtn, 'rotateCcw', 'refreshCw', { size: 15, strokeWidth: 2 });

    // 3. AI Recommendation Export button
    const quickShareBtn = root.querySelector('#quick-share-advisory-btn') || root.querySelector('.rec-share-btn');
    if (quickShareBtn) attachHoverMorph(quickShareBtn, 'share2', 'send', { size: 14, strokeWidth: 2 });

    // 4. Panel header buttons
    const headerBtns = [
        { sel: '#generate-agri-report-btn', base: 'fileText', hover: 'bookOpen' },
        { sel: '#share-advisory-btn', base: 'share2', hover: 'send' },
        { sel: '#refresh-data-btn', base: 'refreshCw', hover: 'rotateCw' },
        { sel: '#reset-general-panel-btn', base: 'rotateCcw', hover: 'refreshCw' }
    ];
    headerBtns.forEach(({ sel, base, hover }) => {
        const el = root.querySelector(sel);
        if (el) attachHoverMorph(el, base, hover, { size: 14, strokeWidth: 2 });
    });

    // 5. Close buttons
    const closeBtns = root.querySelectorAll('#close-left-panel, #close-general-panel, #close-right-panel, #close-advisory-modal-btn, .panel-header .close-btn');
    closeBtns.forEach(btn => {
        attachHoverMorph(btn, 'x', 'xCircle', { size: 14, strokeWidth: 2.2 });
    });

    // 6. Advisory Modal Action Buttons
    const copyAdvBtn = root.querySelector('#copy-advisory-btn');
    if (copyAdvBtn) attachHoverMorph(copyAdvBtn, 'messageCircle', 'send', { size: 16, strokeWidth: 2 });

    const printAdvBtn = root.querySelector('#print-advisory-btn');
    if (printAdvBtn) attachHoverMorph(printAdvBtn, 'printer', 'fileDown', { size: 16, strokeWidth: 2 });

    // 7. Directive list items (in Action Advisory Card)
    const directiveItems = root.querySelectorAll('.adv-directive-item');
    directiveItems.forEach(item => {
        const iconWrap = item.querySelector('.adv-directive-icon');
        if (!iconWrap) return;
        const rawIcon = iconWrap.querySelector('i[data-lucide]');
        const iconName = rawIcon ? rawIcon.getAttribute('data-lucide') : '';

        let baseKey = 'sprout';
        let hoverKey = 'leaf';
        if (iconName === 'droplets' || iconName === 'cloud-rain') {
            baseKey = 'droplets';
            hoverKey = 'cloudRain';
        } else if (iconName === 'shield-alert' || iconName === 'shield-check') {
            baseKey = 'shieldAlert';
            hoverKey = 'shieldCheck';
        } else if (iconName === 'truck' || iconName === 'navigation') {
            baseKey = 'truck';
            hoverKey = 'navigation';
        } else if (iconName === 'zap' || iconName === 'activity') {
            baseKey = 'activity';
            hoverKey = 'zap';
        }

        attachHoverMorph(item, baseKey, hoverKey, { size: 16, strokeWidth: 2 });
    });
}

/**
 * Initialize dynamic animated icons on interactive navigation tabs and buttons
 */
export function initAppMorphIcons() {
    // 1. Voice Advisory button with dynamic hover morph
    const voiceBtn = document.getElementById('voice-advisory-btn');
    if (voiceBtn) {
        attachMorphIcon(voiceBtn, 'volume', { size: 18, strokeWidth: 2 });
        voiceBtn.addEventListener('mouseenter', () => {
            if (!voiceBtn.classList.contains('playing')) {
                morphIconTo(voiceBtn, 'volumeHover', 'bouncy');
            }
        });
        voiceBtn.addEventListener('mouseleave', () => {
            if (!voiceBtn.classList.contains('playing')) {
                morphIconTo(voiceBtn, 'volume', 'snappy');
            }
        });
    }

    // 2. Navigation bar buttons: morph to active secondary icon on hover, and back on mouseleave
    const navButtons = document.querySelectorAll('.top-nav .nav-item');
    const tabMorphMap = {
        region: { base: 'map', hover: 'globe' },
        physics: { base: 'thermometer', hover: 'flame' },
        agriculture: { base: 'sprout', hover: 'leaf' },
        grid: { base: 'zap', hover: 'activity' },
        logistics: { base: 'truck', hover: 'navigation' },
        research: { base: 'microscope', hover: 'sparkles' },
        'location-analysis': { base: 'crosshair', hover: 'target' },
        agents: { base: 'cpu', hover: 'bot' },
        crisislens: { base: 'shieldAlert', hover: 'shieldCheck' },
        analytics: { base: 'barChart', hover: 'trendingUp' }
    };

    navButtons.forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        const config = tabMorphMap[tab];
        if (config) {
            attachMorphIcon(btn, config.base, { size: 18, strokeWidth: 2 });

            // Dynamic spring-physics morph on hover
            btn.addEventListener('mouseenter', () => {
                morphIconTo(btn, config.hover, 'bouncy');
            });

            // Fluidly morph back to base icon on mouseleave
            btn.addEventListener('mouseleave', () => {
                morphIconTo(btn, config.base, 'snappy');
            });
        }
    });

    // 3. Dock Toggles
    const leftDockBtn = document.getElementById('toggle-left-dock');
    if (leftDockBtn) {
        attachHoverMorph(leftDockBtn, 'chevronLeft', 'panelOpen', { size: 18, strokeWidth: 2.2 });
    }
    const rightDockBtn = document.getElementById('toggle-right-dock');
    if (rightDockBtn) {
        attachHoverMorph(rightDockBtn, 'chevronRight', 'panelClose', { size: 18, strokeWidth: 2.2 });
    }

    // 4. Hydrate all subtabs, header buttons, action buttons, export buttons, and modals
    hydrateDynamicMorphIcons(document);
}
