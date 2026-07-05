/**
 * main.js — WIaaS Frontend Entry Point.
 * Bootstraps all modules on DOMContentLoaded.
 */

import { regionsList } from './state.js';
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

document.addEventListener('DOMContentLoaded', async () => {
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

    // 7. Fetch all regions in background for globe heatmap
    loadAllRegionsForGlobe(regionsList);

    // 8. Start live metric animation (status bar)
    animateMetrics();

    // 9. Start region clock
    updateRegionTime();
    setInterval(updateRegionTime, 1000);

    // 10. Listen for city selection events
    document.addEventListener('citySelected', (event) => {
        const { cityId, city } = event.detail;
        console.log('[main] City selected:', city);
        // Optional: Load data for the selected city if it's in the analytics backend
        // For now, just update the active region display
    });
});
