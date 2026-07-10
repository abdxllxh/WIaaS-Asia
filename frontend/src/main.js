/**
 * main.js — WIaaS Frontend Entry Point.
 * Bootstraps all modules on DOMContentLoaded.
 */

import { regionsList, activeRegionKey } from './state.js';
import { initGlobe, toggleHeatmap, toggleWind, togglePrecipitation } from './globe.js';
import { initCharts } from './charts.js';
import { updateRegionTime, animateMetrics } from './ui.js';
import { setupEventListeners, loadRegionData, loadAllRegionsForGlobe, selectActiveRegion } from './events.js';
import { initializeCitySearchUI } from './ui-cities.js';

// Expose callback functions used by dynamically injected HTML (onclick attributes)
// These must be on window since innerHTML-injected handlers can't reference module scope
window.__wiaas = {
    toggleHeatmap,
    toggleWind,
    togglePrecipitation,
    selectActiveRegion,
};

window.closeGlobePopup = function() {
    const overlay = document.getElementById('globe-popup-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Record start time to ensure loading screen is visible for a minimum duration
    const startTime = Date.now();

    // 1. Initialize Lucide icons
    lucide.createIcons();

    // 2. Initialize city search UI (loads from localStorage, integrates Nominatim API)
    await initializeCitySearchUI();

    // 3. Boot Three.js globe
    initGlobe();

    // 4. Initialize Chart.js charts
    initCharts();

    // 5. Wire up all UI event listeners
    setupEventListeners();

    // 6. Fetch initial region data and populate UI
    await loadRegionData('pakistan_punjab');

    // Polling active region data every 1 second for real-time updates
    setInterval(async () => {
        if (activeRegionKey) {
            await loadRegionData(activeRegionKey);
        }
    }, 1000);

    // 7. Fetch all regions in background for globe heatmap
    loadAllRegionsForGlobe(regionsList);

    // 8. Start live metric animation (status bar)
    animateMetrics();

    // 9. Start region clock
    updateRegionTime();
    setInterval(updateRegionTime, 1000);

    // Re-trigger icon generation for elements just rendered/updated
    lucide.createIcons();

    // Ensure the fade-in animation has at least played for 1.8 seconds before transition
    const elapsed = Date.now() - startTime;
    const minLoadingTime = 1800; // ms
    if (elapsed < minLoadingTime) {
        await new Promise(r => setTimeout(r, minLoadingTime - elapsed));
    }

    // Trigger the custom "coming out of screen" transition
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.classList.add('zoom-out');
        // Let zoom-out start, then fade out the background
        await new Promise(r => setTimeout(r, 100));
        loader.classList.add('fade-out');
        
        // Remove from DOM after transition completes to save resources
        setTimeout(() => loader.remove(), 1200);
    }

    // 10. Listen for city selection events
    document.addEventListener('citySelected', async (event) => {
        const { cityId, city } = event.detail;
        console.log('[main] City selected:', city);
        await selectActiveRegion(cityId);
    });
});
