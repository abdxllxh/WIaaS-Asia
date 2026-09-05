/**
 * events.js — All DOM event listeners and navigation tab logic.
 * Wires up sidebars, bottom panel, nav tabs, chat buttons.
 */

import {
    activeRegionKey,
    setActiveRegionKey,
    getActiveRegion,
    regionsTelemetryCache,
    activeLeftTab,
    regionsRegistry,
    registerLocationContext,
    setActiveLeftTab,
} from './state.js';
import { fetchRegionAnalytics, fetchAllRegions, clearConversationContext } from './api.js';
import { navigateToLocation } from './geo-navigation.js';
import { updateUIElements, showGeneralInfoPanel, toggleAgricultureReport, resetSectorContext, resetToDefaultOverview, refreshActiveTelemetry, getCurrentPanelTab, setRegionClockLocation } from './ui.js';
import { handleUserMessage, setupVoiceInput, updateChatModeUI } from './chat.js';
import {
    toggleWindLayer,
    toggleRainLayer,
    openClimatePerceptionModal,
    closeClimatePerceptionModal,
    fetchClimatePerception,
    onLocationChangeStart,
    onLocationChangeComplete
} from './map-layers.js';
import {
    setLanguage,
    getLanguage,
    setAgricultureSubView,
    toggleVoiceAdvisory,
    openSmsModal,
    closeSmsModal,
    openAdvisoryModal,
    closeAdvisoryModal
} from './ui-agriculture.js';
import { destroyDynamicVisualizer } from './dynamic-visualizer.js';
import { showToast } from './toast.js';

// ── setupEventListeners() ────────────────────────────────────────────────────
export function setupEventListeners() {
    const mobileBackdrop = document.getElementById('mobile-backdrop');
    if (mobileBackdrop) {
        mobileBackdrop.addEventListener('click', () => {
            closeAllSidebars();
        });
    }

    // Left Docker
    const leftDockBtn = document.getElementById('toggle-left-dock');
    if (leftDockBtn) {
        leftDockBtn.addEventListener('click', () => {
            const sidebar  = document.getElementById('left-sidebar');
            const iconEl   = document.getElementById('left-dock-icon');
            if (sidebar) {
                const isVisible = sidebar.classList.toggle('visible');
                // When open, show chevron-left (pointing left → close the left panel)
                // When closed, show chevron-right (pointing right → open the left panel)
                if (iconEl) iconEl.setAttribute('data-lucide', isVisible ? 'chevron-left' : 'chevron-right');

                // On tablet/mobile, update backdrop and close competing right sidebar
                if (window.innerWidth <= 1024) {
                    if (isVisible) {
                        const rightSidebar = document.getElementById('right-sidebar');
                        if (rightSidebar) rightSidebar.classList.remove('visible');
                        const rightIcon = document.getElementById('right-dock-icon');
                        if (rightIcon) rightIcon.setAttribute('data-lucide', 'chevron-left');
                        mobileBackdrop?.classList.add('visible');
                    } else {
                        mobileBackdrop?.classList.remove('visible');
                    }
                }
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            }
        });
    }

    // Right Docker
    const rightDockBtn = document.getElementById('toggle-right-dock');
    if (rightDockBtn) {
        rightDockBtn.addEventListener('click', () => {
            const sidebar  = document.getElementById('right-sidebar');
            const iconEl   = document.getElementById('right-dock-icon');
            if (sidebar) {
                const isVisible = sidebar.classList.toggle('visible');
                // When open, show chevron-right (pointing right → close the right panel)
                // When closed, show chevron-left (pointing left → open the right panel)
                if (iconEl) iconEl.setAttribute('data-lucide', isVisible ? 'chevron-right' : 'chevron-left');

                // On tablet/mobile, update backdrop and close competing left sidebar
                if (window.innerWidth <= 1024) {
                    if (isVisible) {
                        const leftSidebar = document.getElementById('left-sidebar');
                        if (leftSidebar) leftSidebar.classList.remove('visible');
                        const leftIcon = document.getElementById('left-dock-icon');
                        if (leftIcon) leftIcon.setAttribute('data-lucide', 'chevron-right');
                        mobileBackdrop?.classList.add('visible');
                    } else {
                        mobileBackdrop?.classList.remove('visible');
                    }
                }
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            }
        });
    }

    // Reload Agriculture Intelligence Data button — with spinner animation + toast
    const refreshBtn = document.getElementById('refresh-data-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const icon = refreshBtn.querySelector('i, svg');
            // Add spinning animation
            if (icon) {
                icon.style.transition = 'transform 0.6s linear';
                icon.style.transform = 'rotate(360deg)';
                setTimeout(() => {
                    icon.style.transition = 'none';
                    icon.style.transform = 'rotate(0deg)';
                    setTimeout(() => {
                        icon.style.transition = '';
                    }, 50);
                }, 700);
            }
            // Reload region data
            loadRegionData(activeRegionKey);
            // Show toast
            showToast('Reloading agriculture intelligence data...', 'info');
        });
    }

    // Close left agriculture panel
    const closeLeftBtn = document.getElementById('close-left-panel');
    if (closeLeftBtn) {
        closeLeftBtn.addEventListener('click', () => {
            closeLeftSidebar();
        });
    }

    // Document button — opens the Action Advisory Card modal
    const genAgriBtn = document.getElementById('generate-agri-report-btn');
    if (genAgriBtn) {
        genAgriBtn.addEventListener('click', () => {
            openAdvisoryModal();
        });
    }

    // Close Agriculture Report button
    const closeAgriBtn = document.getElementById('close-agri-report');
    if (closeAgriBtn) {
        closeAgriBtn.addEventListener('click', () => {
            const reportSec = document.getElementById('agriculture-report-section');
            if (reportSec) reportSec.classList.add('hidden');
        });
    }

    // Reset or refresh general sector panel:
    // When on Asia Monitoring Network ('region'): resets map back to full continental overview
    // When on Sector telemetry panels: refreshes verified live telemetry signals from backend
    const resetGenBtn = document.getElementById('reset-general-panel-btn');
    if (resetGenBtn) {
        resetGenBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentTab = getCurrentPanelTab();
            if (currentTab === 'region') {
                await resetToDefaultOverview();
            } else {
                await refreshActiveTelemetry();
            }
        });
    }

    // Close general info panel
    const closeGenBtn = document.getElementById('close-general-panel');
    if (closeGenBtn) {
        closeGenBtn.addEventListener('click', () => {
            closeLeftSidebar();
        });
    }

    // Close right chat panel
    const closeRightBtn = document.getElementById('close-right-panel');
    if (closeRightBtn) {
        closeRightBtn.addEventListener('click', () => {
            closeRightSidebar();
        });
    }

    // Bottom Panel Toggle
    const toggleBottomBtn = document.getElementById('toggle-bottom-panel');
    if (toggleBottomBtn) {
        toggleBottomBtn.addEventListener('click', () => {
            const panel   = document.getElementById('bottom-panel');
            const iconEl  = document.getElementById('bottom-toggle-icon');
            if (panel) {
                const collapsed = panel.classList.toggle('collapsed');
                if (iconEl) iconEl.setAttribute('data-lucide', collapsed ? 'chevron-up' : 'chevron-down');
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            }
        });
    }

    // Navigation Tabs
    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const selectedTab  = tab.getAttribute('data-tab');
            const isAlreadyActive = tab.classList.contains('active');
            const leftSidebar = document.getElementById('left-sidebar');
            const rightSidebar = document.getElementById('right-sidebar');
            const isLeftVisible = leftSidebar && leftSidebar.classList.contains('visible');
            const isRightVisible = rightSidebar && rightSidebar.classList.contains('visible');

            if (['region', 'physics', 'agriculture', 'grid', 'logistics', 'research', 'location-analysis'].includes(selectedTab)) {
                setActiveLeftTab(selectedTab);

                // Automatically hide and collapse bottom drawer when viewing standard sector panels/map
                const bPanel = document.getElementById('bottom-panel');
                if (bPanel) {
                    bPanel.classList.add('collapsed', 'hidden');
                }

                // If it was already active AND the sidebar was already open, toggle it closed
                if (isAlreadyActive && isLeftVisible) {
                    tab.classList.remove('active');
                    closeLeftSidebar();
                } else {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    if (leftSidebar) leftSidebar.classList.add('visible');
                    const leftDockIcon = document.getElementById('left-dock-icon');
                    if (leftDockIcon) leftDockIcon.setAttribute('data-lucide', 'chevron-left');

                    // On tablet and mobile, close right sidebar if open and show backdrop
                    if (window.innerWidth <= 1024) {
                        if (rightSidebar) rightSidebar.classList.remove('visible');
                        const rightDockIcon = document.getElementById('right-dock-icon');
                        if (rightDockIcon) rightDockIcon.setAttribute('data-lucide', 'chevron-left');
                        mobileBackdrop?.classList.add('visible');
                    }

                    // Update active module pill text
                    const activePill = document.getElementById('active-module-pill');
                    if (activePill) {
                        const labelMap = {
                            'region': 'Region',
                            'physics': 'Physics',
                            'agriculture': 'Agri',
                            'grid': 'Grid',
                            'logistics': 'Supply',
                            'research': 'Research',
                            'location-analysis': 'Location',
                            'analytics': 'Threat'
                        };
                        activePill.textContent = labelMap[selectedTab] || selectedTab;
                    }

                    const agriPanel = document.getElementById('agriculture-panel');
                    const genPanel  = document.getElementById('general-info-panel');

                    if (selectedTab === 'agriculture') {
                        if (agriPanel) agriPanel.classList.remove('hidden');
                        if (genPanel) genPanel.classList.add('hidden');
                    } else {
                        if (agriPanel) agriPanel.classList.add('hidden');
                        if (genPanel) {
                            genPanel.classList.remove('hidden');
                            showGeneralInfoPanel(selectedTab);
                        }

                        const reportSec = document.getElementById('agriculture-report-section');
                        if (reportSec) reportSec.classList.add('hidden');
                    }
                    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
                }

            } else if (selectedTab === 'agents' || selectedTab === 'crisislens') {
                const targetMode = selectedTab === 'crisislens' ? 'crisislens' : 'assistant';
                updateChatModeUI(targetMode);

                if (isAlreadyActive && isRightVisible) {
                    tab.classList.remove('active');
                    closeRightSidebar();
                    if (selectedTab === 'crisislens') {
                        closeLeftSidebar();
                    }
                } else {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    if (rightSidebar) rightSidebar.classList.add('visible');
                    const rightDockIcon = document.getElementById('right-dock-icon');
                    if (rightDockIcon) rightDockIcon.setAttribute('data-lucide', 'chevron-right');

                    if (window.innerWidth <= 1024) {
                        mobileBackdrop?.classList.add('visible');
                    }

                    if (selectedTab === 'crisislens') {
                        if (leftSidebar) leftSidebar.classList.add('visible');
                        const leftDockIcon = document.getElementById('left-dock-icon');
                        if (leftDockIcon) leftDockIcon.setAttribute('data-lucide', 'chevron-left');
                        showGeneralInfoPanel('crisislens');
                    } else if (window.innerWidth <= 1024) {
                        // On small screens & tablets, close left sidebar for regular chat
                        if (leftSidebar) leftSidebar.classList.remove('visible');
                        const leftDockIcon = document.getElementById('left-dock-icon');
                        if (leftDockIcon) leftDockIcon.setAttribute('data-lucide', 'chevron-right');
                    }

                }
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            } else if (selectedTab === 'analytics') {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                setActiveLeftTab('analytics');
                if (leftSidebar) leftSidebar.classList.add('visible');
                if (rightSidebar && window.innerWidth <= 1024) rightSidebar.classList.remove('visible');
                document.getElementById('agriculture-panel')?.classList.add('hidden');
                document.getElementById('general-info-panel')?.classList.remove('hidden');
                showGeneralInfoPanel('analytics');
                const activePill = document.getElementById('active-module-pill');
                if (activePill) activePill.textContent = 'Threat';
                if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            }
        });
    });

    // ── Mobile / Tablet Modules Sheet Controller ────────────────────────
    const modulesTrigger = document.getElementById('mobile-modules-trigger');
    const modulesSheet   = document.getElementById('mobile-modules-sheet');
    const closeSheetBtn  = document.getElementById('close-modules-sheet-btn');

    function openModulesSheet() {
        if (!modulesSheet) return;
        modulesSheet.classList.add('visible');
        modulesSheet.setAttribute('aria-hidden', 'false');
        modulesTrigger?.setAttribute('aria-expanded', 'true');
        mobileBackdrop?.classList.add('visible');
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    function closeModulesSheet() {
        if (!modulesSheet) return;
        modulesSheet.classList.remove('visible');
        modulesSheet.setAttribute('aria-hidden', 'true');
        modulesTrigger?.setAttribute('aria-expanded', 'false');
        const leftVis = document.getElementById('left-sidebar')?.classList.contains('visible');
        const rightVis = document.getElementById('right-sidebar')?.classList.contains('visible');
        if (!leftVis && !rightVis) {
            mobileBackdrop?.classList.remove('visible');
        }
    }

    if (modulesTrigger) {
        modulesTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (modulesSheet?.classList.contains('visible')) {
                closeModulesSheet();
            } else {
                openModulesSheet();
            }
        });
    }

    if (closeSheetBtn) {
        closeSheetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModulesSheet();
        });
    }

    // Connect Sheet Module Cards to Navigation
    const sheetCards = document.querySelectorAll('.sheet-module-card, .sheet-agent-btn');
    sheetCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabName = card.getAttribute('data-tab');
            if (!tabName) return;

            // Sync active visual on sheet cards
            document.querySelectorAll('.sheet-module-card').forEach(c => {
                const isActive = c.getAttribute('data-tab') === tabName;
                c.classList.toggle('active', isActive);
                const tag = c.querySelector('.sheet-card-tag');
                if (tag) {
                    if (isActive) {
                        tag.classList.add('active');
                        tag.textContent = 'ACTIVE';
                    } else {
                        tag.classList.remove('active');
                        const defaultTags = {
                            'region': 'NETWORK',
                            'location-analysis': 'RADAR',
                            'physics': 'PHYSICS',
                            'agriculture': 'AGRI',
                            'grid': 'GRID',
                            'logistics': 'SUPPLY',
                            'research': 'SYNTH',
                            'analytics': 'ALERT'
                        };
                        tag.textContent = defaultTags[c.getAttribute('data-tab')] || 'DOMAIN';
                    }
                }
            });

            closeModulesSheet();

            // Programmatically trigger the matching nav item
            const targetNavItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
            if (targetNavItem) {
                targetNavItem.click();
            }
        });
    });

    // ── Smart Agriculture Quick Controls & Modals ────────────────
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', (e) => {
            const targetTag = e.target?.closest?.('#lang-tag-en, #lang-tag-ur');
            if (targetTag && targetTag.id === 'lang-tag-en') {
                setLanguage('en');
            } else if (targetTag && targetTag.id === 'lang-tag-ur') {
                setLanguage('ur');
            } else {
                const nextLang = getLanguage() === 'en' ? 'ur' : 'en';
                setLanguage(nextLang);
            }
        });
    }

    const voiceAdvisoryBtn = document.getElementById('voice-advisory-btn');
    if (voiceAdvisoryBtn) {
        voiceAdvisoryBtn.addEventListener('click', () => {
            toggleVoiceAdvisory();
        });
    }

    const smsDispatchBtn = document.getElementById('sms-dispatch-btn');
    if (smsDispatchBtn) {
        smsDispatchBtn.addEventListener('click', () => {
            openSmsModal();
        });
    }
    const closeSmsBtn = document.getElementById('close-sms-modal-btn');
    const smsBackdrop = document.getElementById('sms-modal-backdrop');
    if (closeSmsBtn) closeSmsBtn.addEventListener('click', closeSmsModal);
    if (smsBackdrop) smsBackdrop.addEventListener('click', closeSmsModal);

    const copySmsBtn = document.getElementById('copy-sms-btn');
    if (copySmsBtn) {
        copySmsBtn.addEventListener('click', () => {
            const textUr = document.getElementById('sms-text-ur')?.innerText || '';
            const textEn = document.getElementById('sms-text-en')?.innerText || '';
            const combined = `${textUr}\n\n---\n${textEn}`;
            navigator.clipboard.writeText(combined);
            copySmsBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
            setTimeout(() => {
                copySmsBtn.innerHTML = '<i data-lucide="copy"></i> Copy SMS';
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        });
    }

    // Share button — directly copies advisory text to clipboard for social media (no modal)
    const shareAdvisoryBtn = document.getElementById('share-advisory-btn');
    if (shareAdvisoryBtn) {
        shareAdvisoryBtn.addEventListener('click', () => {
            const region = document.getElementById('adv-card-region')?.innerText || 'Selected Region';
            const temp = document.getElementById('adv-card-temp')?.innerText || '--';
            const soil = document.getElementById('adv-card-soil')?.innerText || '--';
            const ndvi = document.getElementById('adv-card-ndvi')?.innerText || '--';
            const spray = document.getElementById('adv-card-spray')?.innerText || '--';
            const directives = window._currentDirectives || [];
            const directivesText = directives.map((d, i) => `${i + 1}. *${d.title}*: ${d.text}`).join('\n');
            const msg = `*WIaaS Agricultural Resilience Advisory*\nRegion: ${region}\nTemp: ${temp} | Soil: ${soil} | NDVI: ${ndvi}\nSpray Status: ${spray}\n\n*Mandatory Action Directives (Next 24h):*\n${directivesText}\n\nWIaaS Autonomous Climate Intelligence Network.`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(msg).then(() => {
                    showToast('Advisory copied! Ready to share on WhatsApp & social media.', 'success');
                    const icon = shareAdvisoryBtn.querySelector('i');
                    if (icon) { icon.setAttribute('data-lucide', 'check'); if (window.lucide) window.lucide.createIcons(); }
                    setTimeout(() => {
                        if (icon) { icon.setAttribute('data-lucide', 'share-2'); if (window.lucide) window.lucide.createIcons(); }
                    }, 2000);
                }).catch(() => openAdvisoryModal());
            } else {
                openAdvisoryModal();
            }
        });
    }
    const closeAdvisoryBtn = document.getElementById('close-advisory-modal-btn');
    const advisoryBackdrop = document.getElementById('advisory-modal-backdrop');
    if (closeAdvisoryBtn) closeAdvisoryBtn.addEventListener('click', closeAdvisoryModal);
    if (advisoryBackdrop) advisoryBackdrop.addEventListener('click', closeAdvisoryModal);

    const copyAdvisoryBtn = document.getElementById('copy-advisory-btn');
    if (copyAdvisoryBtn) {
        copyAdvisoryBtn.addEventListener('click', () => {
            const region = document.getElementById('adv-card-region')?.innerText || '';
            const temp = document.getElementById('adv-card-temp')?.innerText || '';
            const soil = document.getElementById('adv-card-soil')?.innerText || '';
            const ndvi = document.getElementById('adv-card-ndvi')?.innerText || '';
            const spray = document.getElementById('adv-card-spray')?.innerText || '';
            const directives = window._currentDirectives || [
                { title: 'Irrigation Scheduling', text: 'Suspend daytime overhead irrigation to stop evaporative loss.' },
                { title: 'Pest Management', text: 'Scout field perimeter and apply targeted spray within safe window.' },
                { title: 'Energy Optimization', text: 'Run tube-wells during off-peak night tariff.' }
            ];
            const msg = `*WIaaS Agricultural & Resilience Action Advisory*\nRegion: ${region}\nTemp: ${temp} | Soil: ${soil} | NDVI: ${ndvi}\nSpray Status: ${spray}\n\n*Mandatory Action Directives (Next 24 Hours):*\n${directivesText}\n\nWIaaS Autonomous Climate Intelligence Network.`;
            navigator.clipboard.writeText(msg);
            copyAdvisoryBtn.innerHTML = '<i data-lucide="check"></i> Copied for WhatsApp!';
            setTimeout(() => {
                copyAdvisoryBtn.innerHTML = '<i data-lucide="clipboard-check"></i> Copy for WhatsApp Groups';
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        });
    }

    const printAdvisoryBtn = document.getElementById('print-advisory-btn');
    if (printAdvisoryBtn) {
        printAdvisoryBtn.addEventListener('click', () => {
            window.print();
        });
    }

    document.querySelectorAll('.agri-subtab').forEach(tab => {
        tab.addEventListener('click', () => {
            const subview = tab.getAttribute('data-subview');
            if (subview) {
                setAgricultureSubView(subview);
            }
        });
    });

    // ── Map Intelligence Dock & Climate Perception Layer ──────────
    const windBtn = document.getElementById('btn-toggle-wind');
    const closeWindHudBtn = document.getElementById('close-wind-hud-btn');
    if (windBtn) windBtn.addEventListener('click', toggleWindLayer);
    if (closeWindHudBtn) closeWindHudBtn.addEventListener('click', toggleWindLayer);

    const rainBtn = document.getElementById('btn-toggle-rain');
    const closeRainHudBtn = document.getElementById('close-rain-hud-btn');
    if (rainBtn) rainBtn.addEventListener('click', toggleRainLayer);
    if (closeRainHudBtn) closeRainHudBtn.addEventListener('click', toggleRainLayer);

    const climateBtn = document.getElementById('btn-toggle-climate');
    if (climateBtn) climateBtn.addEventListener('click', openClimatePerceptionModal);

    const closeClimateBtn = document.getElementById('close-climate-modal-btn');
    const closeClimateFooterBtn = document.getElementById('close-climate-modal-footer-btn');
    const climateBackdrop = document.getElementById('climate-modal-backdrop');
    if (closeClimateBtn) closeClimateBtn.addEventListener('click', closeClimatePerceptionModal);
    if (closeClimateFooterBtn) closeClimateFooterBtn.addEventListener('click', closeClimatePerceptionModal);
    if (climateBackdrop) climateBackdrop.addEventListener('click', closeClimatePerceptionModal);

    // Chat Actions
    const chatInput = document.getElementById('chat-input');
    const sendBtn   = document.getElementById('send-chat-btn');
    const chatForm  = document.getElementById('chat-form');
    const clearBtn  = document.getElementById('clear-chat');

    setupVoiceInput();

    if (chatForm) {
        chatForm.addEventListener('submit', handleUserMessage);
    } else if (sendBtn) {
        sendBtn.addEventListener('click', handleUserMessage);
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const container = document.getElementById('chat-history');
            if (container) container.innerHTML = '';
            clearConversationContext();
        });
    }
}

// ── loadRegionData() ─────────────────────────────────────────────────────────
export async function loadRegionData(regionKey) {
    const data = await fetchRegionAnalytics(regionKey);
    if (!data) return null;
    regionsTelemetryCache[regionKey] = data;
    // A slower request from the previously selected city must never overwrite
    // the module values for a newer map selection.
    if (regionKey === activeRegionKey) updateUIElements(data);
    return data;
}

// ── loadAllRegionsForGlobe() — retained API name for compatibility ───────────
export async function loadAllRegionsForGlobe(regionsList) {
    // A representative heatmap sample avoids 67 simultaneous analytics jobs at startup.
    const representativeKeys = regionsList
        .filter((key, index) => regionsRegistry[key]?.is_featured || index % 8 === 0)
        .slice(0, 12);
    const results = await fetchAllRegions(representativeKeys);
    results.forEach((data, key) => {
        regionsTelemetryCache[key] = data;
    });
}

// ── selectActiveRegion() — exposed globally via window.__wiaas ───────────────
export async function selectActiveRegion(regionKey) {
    const meta = regionsRegistry[regionKey];
    if (!meta) return null;
    return selectLocationContext({ ...meta, key: regionKey });
}

let _locationSelectionGeneration = 0;

function setLocationDataStatus(state, location) {
    const statusEl = document.getElementById('active-region-data-status');
    const domainTabs = document.querySelectorAll(
        '.nav-item[data-tab="physics"], .nav-item[data-tab="agriculture"], .nav-item[data-tab="grid"], .nav-item[data-tab="logistics"], .nav-item[data-tab="research"]',
    );
    const isLoading = state === 'loading';
    domainTabs.forEach((tab) => tab.setAttribute('aria-busy', String(isLoading)));
    if (!statusEl) return;

    const label = location?.city || location?.name || location?.country || 'selected location';
    statusEl.className = `region-data-status ${state}`;
    statusEl.textContent = state === 'loading'
        ? `Syncing ${label} analytics…`
        : state === 'error'
            ? `${label} analytics unavailable`
            : '';
}

/**
 * Select any map context and hydrate all five intelligence modules through the
 * same backend pipeline used by the original curated cities.
 */
export async function selectLocationContext(rawLocation) {
    const regionKey = registerLocationContext(rawLocation);
    if (!regionKey) return null;

    const generation = ++_locationSelectionGeneration;
    window._hasExplicitRegionSelection = true;
    setActiveRegionKey(regionKey);
    const location = getActiveRegion();
    setLocationDataStatus('loading', location);
    setRegionClockLocation(location);

    // Suspend and clear wind animation while map flies and new region data loads
    onLocationChangeStart();

    const [, data, climateData] = await Promise.all([
        navigateToLocation(location),
        loadRegionData(regionKey),
        fetchClimatePerception(regionKey, location?.latitude, location?.longitude, location?.city || location?.name),
    ]);

    if (generation !== _locationSelectionGeneration) return data;
    setLocationDataStatus(data ? 'ready' : 'error', location);

    // Resume wind animation with new location's exact wind vector and update precipitation circle
    onLocationChangeComplete(climateData, location);

    // Agriculture is a dedicated DOM panel and updateUIElements has already
    // refreshed it. The remaining modules share the general information panel.
    if (activeLeftTab && activeLeftTab !== 'agriculture') {
        showGeneralInfoPanel(activeLeftTab);
    }
    return data;
}

// ── closeLeftSidebar() ───────────────────────────────────────────────────────
export function closeLeftSidebar() {
    const leftSidebar = document.getElementById('left-sidebar');
    if (leftSidebar) leftSidebar.classList.remove('visible');
    const iconEl = document.getElementById('left-dock-icon');
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-right');

    // Only deselect domain tabs that correspond to left sidebar
    document.querySelectorAll('.nav-item').forEach(t => {
        const tab = t.getAttribute('data-tab');
        if (['region', 'physics', 'agriculture', 'grid', 'logistics', 'research', 'location-analysis'].includes(tab)) {
            t.classList.remove('active');
        }
    });

    const reportSec = document.getElementById('agriculture-report-section');
    if (reportSec) reportSec.classList.add('hidden');

    destroyDynamicVisualizer();

    const rightSidebar = document.getElementById('right-sidebar');
    const isRightVisible = rightSidebar && rightSidebar.classList.contains('visible');
    if (!isRightVisible) {
        document.getElementById('mobile-backdrop')?.classList.remove('visible');
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// ── closeRightSidebar() ──────────────────────────────────────────────────────
export function closeRightSidebar() {
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) rightSidebar.classList.remove('visible');
    const iconEl = document.getElementById('right-dock-icon');
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-left');

    document.querySelectorAll('.nav-item').forEach(t => {
        const tab = t.getAttribute('data-tab');
        if (['agents', 'crisislens'].includes(tab)) {
            t.classList.remove('active');
        }
    });

    const leftSidebar = document.getElementById('left-sidebar');
    const isLeftVisible = leftSidebar && leftSidebar.classList.contains('visible');
    if (!isLeftVisible) {
        document.getElementById('mobile-backdrop')?.classList.remove('visible');
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// ── closeAllSidebars() ───────────────────────────────────────────────────────
export function closeAllSidebars() {
    closeLeftSidebar();
    closeRightSidebar();
    const modulesSheet = document.getElementById('mobile-modules-sheet');
    if (modulesSheet) {
        modulesSheet.classList.remove('visible');
        modulesSheet.setAttribute('aria-hidden', 'true');
        document.getElementById('mobile-modules-trigger')?.setAttribute('aria-expanded', 'false');
    }
    document.getElementById('mobile-backdrop')?.classList.remove('visible');
}
