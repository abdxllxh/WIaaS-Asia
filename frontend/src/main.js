/**
 * main.js — WIaaS Frontend Entry Point.
 * Bootstraps all modules on DOMContentLoaded.
 */

import { regionsList } from './state.js';
import { initGlobe, toggleHeatmap, toggleWind, togglePrecipitation } from './globe.js';
import { initCharts } from './charts.js';
import { updateRegionTime, animateMetrics } from './ui.js';
import { setupEventListeners, loadRegionData, loadAllRegionsForGlobe, selectActiveRegion } from './events.js';

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

    // 2. Boot Three.js globe
    initGlobe();

    // 3. Initialize Chart.js charts
    initCharts();

    // 4. Wire up all UI event listeners
    setupEventListeners();

    // 5. Fetch initial region data and populate UI
    await loadRegionData('pakistan_punjab');

    // 6. Fetch all regions in background for globe heatmap
    loadAllRegionsForGlobe(regionsList);

    // 7. Start live metric animation (status bar)
    animateMetrics();

    // 8. Start region clock
    updateRegionTime();
    setInterval(updateRegionTime, 1000);
});
