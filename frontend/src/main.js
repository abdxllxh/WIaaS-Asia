import './toast.js';
/**
 * main.js — WIaaS Frontend Entry Point.
 * Bootstraps Asia Monitoring Network with reliable loader dismissal and global active context.
 */

import { regionsList, regionsRegistry, activeRegionKey, getActiveRegion } from './state.js';
import { initAsiaMap, getAsiaMapState } from './asia-map.js';
import { getAsianCities } from './asia-map-data.js';
import { initCharts } from './charts.js';
import {
    updateRegionTime,
    animateMetrics,
    setSubregionFilter,
    onRegionSearch,
    setRegionClockLocation,
    clearRegionClockLocation,
    toggleCountryAccordion,
    setUserLocalhostTimeline,
} from './ui.js';
import {
    setupEventListeners,
    loadRegionData,
    loadAllRegionsForGlobe,
    selectActiveRegion,
    selectLocationContext,
} from './events.js';
import { fetchRegionCatalogue } from './api.js';
import {
    getGeographicNavigationState,
    navigateToLocation,
    makeCountryLocation,
    makeProvinceLocation,
    resetGeographicNavigation,
} from './geo-navigation.js';
import { toggleThermalLayer, toggleWindLayer, toggleRainLayer } from './map-layers.js';
import { initAppMorphIcons } from './morph-icons.js';

// Expose callback functions used by dynamically injected HTML (onclick attributes)
window.__wiaas = window.__wiaas || {};
Object.assign(window.__wiaas, {
    selectActiveRegion,
    selectLocationContext,
    setSubregionFilter,
    onRegionSearch,
    navigateToLocation,
    toggleCountryAccordion,
    toggleThermal: (val) => toggleThermalLayer(val),
    toggleWind: (val) => toggleWindLayer(val),
    toggleRain: (val) => toggleRainLayer(val),
    selectCountry: async (countryName) => selectLocationContext(makeCountryLocation(countryName)),
    selectCountryAndExpand: async (countryName, btnEl) => {
        if (btnEl) toggleCountryAccordion(btnEl);
        await selectLocationContext(makeCountryLocation(countryName));
    },
    selectProvince: async (countryName, provinceName) => (
        selectLocationContext(makeProvinceLocation(countryName, provinceName))
    ),
    resetMap: resetGeographicNavigation,
    resetGlobe: resetGeographicNavigation,
    getAsiaMapState,
    getGeographicNavigationState,
    selectMapCity: async (cityKey) => {
        const location = getAsianCities(regionsRegistry).find((item) => item.key === cityKey);
        if (location) await selectLocationContext(location);
    },
});

// Keep dynamic Location controls independent from inline event handlers. The
// sidebar is re-rendered for every region, so one delegated listener is both
// cheaper and more reliable than rebinding three switches on every render.
document.addEventListener('change', (event) => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement)) return;
    if (control.id === 'switch-panel-thermal') toggleThermalLayer(control.checked);
    if (control.id === 'switch-panel-rain') toggleRainLayer(control.checked);
    if (control.id === 'switch-panel-wind') toggleWindLayer(control.checked);
});

document.documentElement.dataset.wiaasReady = 'true';

window.addEventListener('asiaMapLocationSelected', (event) => {
    setRegionClockLocation(event.detail);
});
window.addEventListener('asiaMapReset', clearRegionClockLocation);

export function dismissLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    if (!loader || loader.dataset.dismissed === 'true') return;
    loader.dataset.dismissed = 'true';
    loader.classList.add('zoom-out');
    setTimeout(() => {
        loader.classList.add('fade-out');
        setTimeout(() => {
            if (loader.parentNode) loader.remove();
        }, 1200);
    }, 100);
}

// Auto-detect client country and city when running on localhost to update timeline only
async function autoFetchLocalhostUserTimeline() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '0.0.0.0' ||
                        window.location.hostname.startsWith('192.168.') ||
                        window.location.hostname.startsWith('10.');
    if (!isLocalhost) return;

    try {
        let locData = null;
        // Tier 1: Query local backend /api/v1/client-location
        try {
            const res = await fetch('/api/v1/client-location');
            if (res.ok) {
                const data = await res.json();
                if (data && data.city && data.country) {
                    locData = data;
                }
            }
        } catch (e) {
            console.warn('[localhost-timeline] backend client-location failed, falling back:', e);
        }

        // Tier 2: Query direct public IP service ipwho.is
        if (!locData) {
            try {
                const res = await fetch('https://ipwho.is/');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success) {
                        locData = {
                            city: data.city,
                            country: data.country,
                            timezone: data.timezone?.id || 'Asia/Karachi',
                            timezone_code: data.timezone?.abbr || 'PKT',
                            timezone_offset: data.timezone?.offset !== undefined ? data.timezone.offset / 3600 : 5,
                        };
                    }
                }
            } catch (e) {
                console.warn('[localhost-timeline] ipwho.is lookup failed:', e);
            }
        }

        // Tier 3: Browser system timezone and offset fallback
        if (!locData) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
            const city = tz.split('/')[1]?.replace(/_/g, ' ') || 'Karachi';
            locData = {
                city: city,
                country: 'Pakistan',
                timezone: tz,
                timezone_code: 'PKT',
                timezone_offset: -new Date().getTimezoneOffset() / 60,
            };
        }

        if (locData && locData.city && locData.country) {
            setUserLocalhostTimeline(locData);
            console.log(`[localhost-timeline] Auto-fetched user location: ${locData.city}, ${locData.country} (${locData.timezone_code || locData.timezone})`);
        }
    } catch (err) {
        console.warn('[localhost-timeline] Error auto-detecting user location:', err);
    }
}

async function startApp() {
    const startTime = Date.now();

    try {
        // 1. Initialize Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }

        // Navigation and chat must be interactive immediately, even if a map
        // style, tile provider, or regional API is still loading.
        try {
            setupEventListeners();
        } catch (e) {
            console.warn('[main] setupEventListeners warning:', e);
        }

        // 2. Fetch authoritative Asia Region Catalogue from backend
        try {
            await fetchRegionCatalogue();
        } catch (e) {
            console.warn('[main] fetchRegionCatalogue warning:', e);
        }

        // 3. Boot the full-Asia satellite map
        try {
            await initAsiaMap();
        } catch (e) {
            console.warn('[main] initAsiaMap warning:', e);
        }

        // 4. Initialize Chart.js charts
        try {
            initCharts();
        } catch (e) {
            console.warn('[main] initCharts warning:', e);
        }

        // 5. Do not select a city automatically. The user must choose a region.
        // The map and region drawer remain available while agents stay location-neutral.

        // Periodic telemetry polling
        setInterval(async () => {
            if (activeRegionKey) {
                try {
                    await loadRegionData(activeRegionKey);
                } catch (e) {}
            }
        }, 15000);


        // 7. Fetch a representative set of regional telemetry in the background
        try {
            loadAllRegionsForGlobe(regionsList);
        } catch (e) {}

        // 8. Start live metric animation (status bar)
        try {
            animateMetrics();
        } catch (e) {}

        // 9. Start region clock
        try {
            setInterval(updateRegionTime, 1000);
        } catch (e) {}

        // Re-trigger icon generation & initialize Morphicons spring-physics animated icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        try {
            initAppMorphIcons();
        } catch (e) {
            console.warn('[main] initAppMorphIcons warning:', e);
        }
    } catch (err) {
        console.error('[main] Bootstrap critical error:', err);
    } finally {
        const elapsed = Date.now() - startTime;
        const minLoadingTime = 900; // ms: crisp, elegant loading sequence
        const remaining = Math.max(0, minLoadingTime - elapsed);
        setTimeout(dismissLoadingScreen, remaining);
    }
}

// Ensure startup runs whether DOM is already loaded or still loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
