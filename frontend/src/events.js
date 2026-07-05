/**
 * events.js — All DOM event listeners and navigation tab logic.
 * Wires up sidebars, bottom panel, nav tabs, chat buttons.
 */

import {
    activeRegionKey,
    setActiveRegionKey,
    regionsTelemetryCache,
} from './state.js';
import { fetchRegionAnalytics, fetchAllRegions } from './api.js';
import { buildGlobePins } from './globe.js';
import { updateUIElements, showGeneralInfoPanel } from './ui.js';
import { handleUserMessage } from './chat.js';

// ── setupEventListeners() ────────────────────────────────────────────────────
export function setupEventListeners() {
    // Left Docker
    document.getElementById('toggle-left-dock').addEventListener('click', () => {
        const sidebar  = document.getElementById('left-sidebar');
        const iconEl   = document.getElementById('left-dock-icon');
        const isVisible = sidebar.classList.toggle('visible');
        iconEl.setAttribute('data-lucide', isVisible ? 'chevron-left' : 'chevron-right');
        lucide.createIcons();
    });

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
                if (isAlreadyActive) {
                    tab.classList.remove('active');
                    closeLeftSidebar();
                } else {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById('left-sidebar').classList.add('visible');
                    document.getElementById('left-dock-icon').setAttribute('data-lucide', 'chevron-left');

                    if (selectedTab === 'agriculture') {
                        document.getElementById('agriculture-panel').classList.remove('hidden');
                        document.getElementById('general-info-panel').classList.add('hidden');
                    } else {
                        showGeneralInfoPanel(selectedTab);
                    }
                    lucide.createIcons();
                }
            } else if (selectedTab === 'agents') {
                if (isAlreadyActive) {
                    tab.classList.remove('active');
                    document.getElementById('right-sidebar').classList.remove('visible');
                    document.getElementById('right-dock-icon').setAttribute('data-lucide', 'chevron-left');
                } else {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById('right-sidebar').classList.add('visible');
                    document.getElementById('right-dock-icon').setAttribute('data-lucide', 'chevron-right');
                    document.getElementById('bottom-panel').classList.remove('collapsed');
                    document.getElementById('bottom-toggle-icon').setAttribute('data-lucide', 'chevron-down');
                }
                lucide.createIcons();
            } else if (selectedTab === 'analytics') {
                const panel = document.getElementById('bottom-panel');
                const iconEl = document.getElementById('bottom-toggle-icon');
                const collapsed = panel.classList.toggle('collapsed');
                iconEl.setAttribute('data-lucide', collapsed ? 'chevron-up' : 'chevron-down');
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
    buildGlobePins();
    updateUIElements(data);
}

// ── loadAllRegionsForGlobe() ─────────────────────────────────────────────────
export async function loadAllRegionsForGlobe(regionsList) {
    const results = await fetchAllRegions(regionsList);
    results.forEach((data, key) => {
        regionsTelemetryCache[key] = data;
    });
    buildGlobePins();
}

// ── selectActiveRegion() — exposed globally via window.__wiaas ───────────────
export function selectActiveRegion(regionKey) {
    setActiveRegionKey(regionKey);
    loadRegionData(regionKey);
    showGeneralInfoPanel('region');
}

// ── closeLeftSidebar() ───────────────────────────────────────────────────────
function closeLeftSidebar() {
    document.getElementById('left-sidebar').classList.remove('visible');
    const iconEl = document.getElementById('left-dock-icon');
    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-right');
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    lucide.createIcons();
}
