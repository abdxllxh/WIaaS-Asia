/**
 * events.js — All DOM event listeners and navigation tab logic.
 * Wires up sidebars, bottom panel, nav tabs, chat buttons.
 */

import {
    activeRegionKey,
    setActiveRegionKey,
    regionsTelemetryCache,
    activeLeftTab,
    setActiveLeftTab,
    bottomPanelMode,
    setBottomPanelMode,
} from './state.js';
import { fetchRegionAnalytics, fetchAllRegions } from './api.js';
import { buildGlobePins } from './globe.js';
import { updateUIElements, showGeneralInfoPanel, updateBottomPanelVisibility, toggleAgricultureReport } from './ui.js';
import { handleUserMessage, updateChatModeUI } from './chat.js';
import citiesManager from './cities.js';
import { refreshCityUI } from './ui-cities.js';

// ── setupEventListeners() ────────────────────────────────────────────────────
export function setupEventListeners() {
    // Left Docker
    const leftDockBtn = document.getElementById('toggle-left-dock');
    if (leftDockBtn) {
        leftDockBtn.addEventListener('click', () => {
            const sidebar  = document.getElementById('left-sidebar');
            const iconEl   = document.getElementById('left-dock-icon');
            const isVisible = sidebar.classList.toggle('visible');
            iconEl.setAttribute('data-lucide', isVisible ? 'chevron-left' : 'chevron-right');
            lucide.createIcons();
        });
    }

    // Right Docker
    document.getElementById('toggle-right-dock').addEventListener('click', () => {
        const sidebar  = document.getElementById('right-sidebar');
        const iconEl   = document.getElementById('right-dock-icon');
        const isVisible = sidebar.classList.toggle('visible');
        iconEl.setAttribute('data-lucide', isVisible ? 'chevron-right' : 'chevron-left');
        lucide.createIcons();
    });

    // Refresh Data button
    document.getElementById('refresh-data-btn').addEventListener('click', () => {
        loadRegionData(activeRegionKey);
    });

    // Close left agriculture panel
    document.getElementById('close-left-panel').addEventListener('click', () => {
        closeLeftSidebar();
    });

    // Generate Agriculture Report button
    const genAgriBtn = document.getElementById('generate-agri-report-btn');
    if (genAgriBtn) {
        genAgriBtn.addEventListener('click', () => {
            toggleAgricultureReport();
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

    // Close general info panel
    document.getElementById('close-general-panel').addEventListener('click', () => {
        closeLeftSidebar();
    });

    // Close right chat panel
    document.getElementById('close-right-panel').addEventListener('click', () => {
        const sidebar = document.getElementById('right-sidebar');
        const iconEl  = document.getElementById('right-dock-icon');
        sidebar.classList.remove('visible');
        iconEl.setAttribute('data-lucide', 'chevron-left');
        document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
        lucide.createIcons();
    });

    // Bottom Panel Toggle
    document.getElementById('toggle-bottom-panel').addEventListener('click', () => {
        const panel   = document.getElementById('bottom-panel');
        const iconEl  = document.getElementById('bottom-toggle-icon');
        const collapsed = panel.classList.toggle('collapsed');
        iconEl.setAttribute('data-lucide', collapsed ? 'chevron-up' : 'chevron-down');
        lucide.createIcons();
    });

    // Navigation Tabs
    const tabs = document.querySelectorAll('.nav-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const selectedTab  = tab.getAttribute('data-tab');
            const isAlreadyActive = tab.classList.contains('active');

            if (['region', 'physics', 'agriculture', 'grid', 'logistics', 'research', 'globe-analysis'].includes(selectedTab)) {
                setActiveLeftTab(selectedTab);
                if (isAlreadyActive) {
                    tab.classList.remove('active');
                    closeLeftSidebar();
                } else {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById('left-sidebar').classList.add('visible');
                    document.getElementById('left-dock-icon').setAttribute('data-lucide', 'chevron-left');

                    // City Explorer only shown on the Region tab
                    const cityPanel = document.getElementById('city-search-panel');
                    if (cityPanel) {
                        if (selectedTab === 'region') {
                            cityPanel.classList.remove('hidden');
                        } else {
                            cityPanel.classList.add('hidden');
                        }
                    }

                    if (selectedTab === 'agriculture') {
                        document.getElementById('agriculture-panel').classList.remove('hidden');
                        document.getElementById('general-info-panel').classList.add('hidden');
                    } else {
                        document.getElementById('agriculture-panel').classList.add('hidden');
                        document.getElementById('general-info-panel').classList.remove('hidden');
                        showGeneralInfoPanel(selectedTab);
                        
                        const reportSec = document.getElementById('agriculture-report-section');
                        if (reportSec) reportSec.classList.add('hidden');
                    }
                    lucide.createIcons();
                }

                // If currently showing AI Agents in the bottom panel, refresh it for the new active left tab!
                if (bottomPanelMode === 'agents') {
                    updateBottomPanelVisibility();
                }
            } else if (selectedTab === 'agents' || selectedTab === 'crisislens') {
                const targetMode = selectedTab === 'crisislens' ? 'crisislens' : 'assistant';
                updateChatModeUI(targetMode);

                if (isAlreadyActive) {
                    tab.classList.remove('active');
                    document.getElementById('right-sidebar').classList.remove('visible');
                    document.getElementById('right-dock-icon').setAttribute('data-lucide', 'chevron-left');
                    if (selectedTab === 'crisislens') {
                        document.getElementById('left-sidebar').classList.remove('visible');
                        document.getElementById('left-dock-icon').setAttribute('data-lucide', 'chevron-right');
                    }
                } else {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById('right-sidebar').classList.add('visible');
                    document.getElementById('right-dock-icon').setAttribute('data-lucide', 'chevron-right');
                    
                    if (selectedTab === 'crisislens') {
                        document.getElementById('left-sidebar').classList.add('visible');
                        document.getElementById('left-dock-icon').setAttribute('data-lucide', 'chevron-left');
                        showGeneralInfoPanel('crisislens');
                    }
                    
                    // Switch bottom panel mode to 'agents' and expand
                    setBottomPanelMode('agents');
                    updateBottomPanelVisibility();
                    document.getElementById('bottom-panel').classList.remove('collapsed');
                    document.getElementById('bottom-toggle-icon').setAttribute('data-lucide', 'chevron-down');
                }
                lucide.createIcons();
            } else if (selectedTab === 'analytics') {
                // Switch bottom panel mode to 'analytics' and expand
                setBottomPanelMode('analytics');
                updateBottomPanelVisibility();
                
                const panel = document.getElementById('bottom-panel');
                const iconEl = document.getElementById('bottom-toggle-icon');
                panel.classList.remove('collapsed');
                iconEl.setAttribute('data-lucide', 'chevron-down');
                lucide.createIcons();
            }
        });
    });

    // Chat Actions
    const chatInput = document.getElementById('chat-input');
    const sendBtn   = document.getElementById('send-chat-btn');
    const clearBtn  = document.getElementById('clear-chat');

    sendBtn.addEventListener('click', handleUserMessage);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleUserMessage(); });
    clearBtn.addEventListener('click', () => {
        document.getElementById('chat-messages-container').innerHTML = '';
    });
}

// ── loadRegionData() ─────────────────────────────────────────────────────────
export async function loadRegionData(regionKey) {
    const data = await fetchRegionAnalytics(regionKey);
    if (!data) return;
    regionsTelemetryCache[regionKey] = data;
    buildGlobePins(citiesManager.getAllCities());
    updateUIElements(data);
    refreshCityUI();
}

// ── loadAllRegionsForGlobe() ─────────────────────────────────────────────────
export async function loadAllRegionsForGlobe(regionsList) {
    const results = await fetchAllRegions(regionsList);
    results.forEach((data, key) => {
        regionsTelemetryCache[key] = data;
    });
    buildGlobePins(citiesManager.getAllCities());
}

// ── selectActiveRegion() — exposed globally via window.__wiaas ───────────────
export function selectActiveRegion(regionKey) {
    setActiveRegionKey(regionKey);
    loadRegionData(regionKey);
    // Show City Explorer when switching region programmatically
    const cityPanel = document.getElementById('city-search-panel');
    if (cityPanel) cityPanel.classList.remove('hidden');
    showGeneralInfoPanel('region');
}

// ── closeLeftSidebar() ───────────────────────────────────────────────────────
function closeLeftSidebar() {
    document.getElementById('left-sidebar').classList.remove('visible');
    const iconEl = document.getElementById('left-dock-icon');
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-right');
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    const cityPanel = document.getElementById('city-search-panel');
    if (cityPanel) cityPanel.classList.add('hidden');
    
    const reportSec = document.getElementById('agriculture-report-section');
    if (reportSec) reportSec.classList.add('hidden');
    
    lucide.createIcons();
}
