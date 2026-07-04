/**
 * state.js — Centralized application state for WIaaS frontend.
 * All shared mutable state is declared here and imported by other modules.
 */

// ── Active Region ────────────────────────────────────────────────────────────
export let activeRegionKey = 'pakistan_punjab';

export function setActiveRegionKey(key) {
    activeRegionKey = key;
}

// ── Region Metadata ──────────────────────────────────────────────────────────
export const regionsList = [
    'pakistan_punjab', 'togo_maritime', 'france_paris', 'spain_andalusia',
    'germany_bavaria', 'uk_london', 'italy_sicily', 'usa_california_central_valley',
    'usa_texas_houston', 'brazil_cerrado', 'canada_alberta', 'argentina_pampas',
];

export const regionOffsets = {
    pakistan_punjab:               5,
    togo_maritime:                 0,
    france_paris:                  2,
    spain_andalusia:               2,
    germany_bavaria:               2,
    uk_london:                     1,
    italy_sicily:                  2,
    usa_california_central_valley: -7,
    usa_texas_houston:             -5,
    brazil_cerrado:                -3,
    canada_alberta:                -6,
    argentina_pampas:              -3,
};

export const regionNames = {
    pakistan_punjab:               'Punjab Region, Pakistan',
    togo_maritime:                 'Maritime Region, Togo',
    france_paris:                  'Paris, France',
    spain_andalusia:               'Andalusia, Spain',
    germany_bavaria:               'Bavaria, Germany',
    uk_london:                     'Greater London, UK',
    italy_sicily:                  'Sicily, Italy',
    usa_california_central_valley: 'Central Valley, California',
    usa_texas_houston:             'Houston, Texas',
    brazil_cerrado:                'Cerrado Savannah, Brazil',
    canada_alberta:                'Alberta Plains, Canada',
    argentina_pampas:              'The Pampas, Argentina',
};

// ── Telemetry Cache ──────────────────────────────────────────────────────────
export const regionsTelemetryCache = {};

// ── Globe Layer Toggles ──────────────────────────────────────────────────────
export let heatmapActive       = true;
export let windActive          = false;
export let precipitationActive = false;

export function setHeatmapActive(val)       { heatmapActive = val; }
export function setWindActive(val)          { windActive = val; }
export function setPrecipitationActive(val) { precipitationActive = val; }

// ── Globe Object References (set by globe.js) ────────────────────────────────
export let globeScene    = null;
export let globeCamera   = null;
export let globeRenderer = null;
export let globeMesh     = null;
export let globePinsGroup = null;
export let globeStandardMaterial = null;
export let globeHeatmapMaterial  = null;
export let globeWindHelpers      = [];
export let globeRainHelpers      = [];
export let isRotationPaused      = false;
export let activePopupRegionKey  = null;

export function setGlobeRefs({ scene, camera, renderer, globe, pinsGroup, standardMaterial, heatmapMaterial }) {
    globeScene    = scene;
    globeCamera   = camera;
    globeRenderer = renderer;
    globeMesh     = globe;
    globePinsGroup = pinsGroup;
    globeStandardMaterial = standardMaterial;
    globeHeatmapMaterial  = heatmapMaterial;
}

export function setWindHelpers(arr)         { globeWindHelpers = arr; }
export function setRainHelpers(arr)         { globeRainHelpers = arr; }
export function setRotationPaused(val)      { isRotationPaused = val; }
export function setActivePopupRegionKey(val){ activePopupRegionKey = val; }

// ── Chart Instances (set by charts.js) ──────────────────────────────────────
export let radarChartInstance     = null;
export let vramChartInstance      = null;
export let tempPowerChartInstance = null;

export function setRadarChart(c)     { radarChartInstance = c; }
export function setVramChart(c)      { vramChartInstance = c; }
export function setTempPowerChart(c) { tempPowerChartInstance = c; }
