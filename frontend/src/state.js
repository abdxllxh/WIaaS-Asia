/**
 * state.js — Centralized application state for WIaaS frontend.
 * All shared mutable state is declared here and imported by other modules.
 * Supports both legacy hardcoded regions and dynamic user-selected cities.
 */

import citiesManager from './cities.js';

// ── Active Region ─────────────────────────────────────────────────────────────
export let activeRegionKey = 'pakistan_punjab';
export let activeLeftTab   = 'region';
window._activeRegionKey    = activeRegionKey; // Initialize for polling helpers

export function setActiveRegionKey(key) {
    activeRegionKey = key;
    window._activeRegionKey = key;  // mirror for polling helpers
    window._latestGridPredictions = null;
    window._latestGridAge = null;
}


export function setActiveLeftTab(tab) {
    activeLeftTab = tab;
}

// ── Legacy Hardcoded Regions ──────────────────────────────────────────────────
const LEGACY_REGIONS = {
    'pakistan_punjab':               'Punjab Region, Pakistan',
    'togo_maritime':                 'Maritime Region, Togo',
    'france_paris':                  'Paris, France',
    'spain_andalusia':               'Andalusia, Spain',
    'germany_bavaria':               'Bavaria, Germany',
    'uk_london':                     'Greater London, UK',
    'italy_sicily':                  'Sicily, Italy',
    'usa_california_central_valley': 'Central Valley, California',
    'usa_texas_houston':             'Houston, Texas',
    'brazil_cerrado':                'Cerrado Savannah, Brazil',
    'canada_alberta':                'Alberta Plains, Canada',
    'argentina_pampas':              'The Pampas, Argentina',
};

const LEGACY_REGION_OFFSETS = {
    'pakistan_punjab':               5,
    'togo_maritime':                 0,
    'france_paris':                  2,
    'spain_andalusia':               2,
    'germany_bavaria':               2,
    'uk_london':                     1,
    'italy_sicily':                  2,
    'usa_california_central_valley': -7,
    'usa_texas_houston':             -5,
    'brazil_cerrado':                -3,
    'canada_alberta':                -6,
    'argentina_pampas':              -3,
};

// ── Region Metadata (merged: legacy + dynamic) ────────────────────────────────
export let regionsList = [
    'pakistan_punjab', 'togo_maritime', 'france_paris', 'spain_andalusia',
    'germany_bavaria', 'uk_london', 'italy_sicily', 'usa_california_central_valley',
    'usa_texas_houston', 'brazil_cerrado', 'canada_alberta', 'argentina_pampas',
];

export let regionNames   = { ...LEGACY_REGIONS };
export let regionOffsets = { ...LEGACY_REGION_OFFSETS };

/**
 * Add a dynamic city to the region list.
 * @param {Object} cityData - City data from citiesManager
 */
export function addDynamicRegion(cityData) {
    if (!cityData.id) {
        cityData.id = `city_${cityData.latitude}_${cityData.longitude}`;
    }
    if (!regionsList.includes(cityData.id)) {
        regionsList.push(cityData.id);
        regionNames[cityData.id]   = cityData.displayName || cityData.name;
        regionOffsets[cityData.id] = 0; // UTC by default
    }
}

/**
 * Sync dynamic cities from citiesManager into region state.
 */
export function syncDynamicCities() {
    citiesManager.getAllCities().forEach(city => addDynamicRegion(city));
}

// ── Telemetry Cache ───────────────────────────────────────────────────────────
export const regionsTelemetryCache = {};

// ── Globe Layer Toggles ───────────────────────────────────────────────────────
export let heatmapActive       = true;
export let windActive          = false;
export let precipitationActive = false;

export function setHeatmapActive(val)       { heatmapActive = val; }
export function setWindActive(val)          { windActive = val; }
export function setPrecipitationActive(val) { precipitationActive = val; }

// ── Bottom Panel Content Mode ─────────────────────────────────────────────────
export let bottomPanelMode = 'analytics'; // 'analytics' or 'agents'
export function setBottomPanelMode(val) { bottomPanelMode = val; }

// ── Globe Object References (set by globe.js) ─────────────────────────────────
export let globeScene            = null;
export let globeCamera           = null;
export let globeRenderer         = null;
export let globeMesh             = null;
export let globePinsGroup        = null;
export let globeStandardMaterial = null;
export let globeHeatmapMaterial  = null;
export let globeWindHelpers      = [];
export let globeRainHelpers      = [];
export let isRotationPaused      = false;
export let activePopupRegionKey  = null;

export function setGlobeRefs({ scene, camera, renderer, globe, pinsGroup, standardMaterial, heatmapMaterial }) {
    globeScene            = scene;
    globeCamera           = camera;
    globeRenderer         = renderer;
    globeMesh             = globe;
    globePinsGroup        = pinsGroup;
    globeStandardMaterial = standardMaterial;
    globeHeatmapMaterial  = heatmapMaterial;
}

export function setWindHelpers(arr)          { globeWindHelpers = arr; }
export function setRainHelpers(arr)          { globeRainHelpers = arr; }
export function setRotationPaused(val)       { isRotationPaused = val; }
export function setActivePopupRegionKey(val) { activePopupRegionKey = val; }
