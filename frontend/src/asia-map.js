import 'maplibre-gl/dist/maplibre-gl.css';
import * as maplibregl from 'maplibre-gl';
if (typeof window !== 'undefined') {
    window.maplibregl = maplibregl;
}


import { getActiveRegion, regionsRegistry } from './state.js';
import { ASIA_COUNTRIES, ASIA_LANDMARKS, getAsianCities } from './asia-map-data.js';
import { initMapLayers, fetchClimatePerception } from './map-layers.js';
import {
    buildCityTerritoryFeature,
    getCityTerritoryCoordinates,
    generateOrganicCityPolygon
} from './city-boundaries-data.js';

// The application catalogue covers South, East, Central and Southeast Asia.
const ASIA_BOUNDS = [[35, -15], [165, 75]];
const DEFAULT_CENTER = [96, 28];
const DEFAULT_ZOOM = 2.45;
const ASIA_OVERVIEW_PADDING = Object.freeze({ top: 10, right: 24, bottom: 24, left: 24 });
const SATELLITE_TILE_TEMPLATE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_TILE_ENDPOINTS = [
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];
const SATELLITE_MAX_NATIVE_ZOOM = 18;
const HD_SATELLITE_ZOOM = 15.35;
const COUNTRY_BOUNDARIES_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson';
const COUNTRY_BOUNDARY_NAMES = Object.freeze({ 'Timor-Leste': 'East Timor' });

let _map = null;
let _readyPromise = null;
let _labelMarkers = [];
let _selectedMarker = null;
let _labelFrame = 0;
let _currentLocation = null;
let _countryBoundaryFeatures = [];
let _selectedBoundaryName = null;
let _hoveredBoundaryName = null;
let _countryHoverFrame = 0;
let _pendingHoverCoordinate = null;
const _warmedTiles = new Set();

function createStyle() {
    return {
        version: 8,
        sources: {
            satellite: {
                type: 'raster',
                tiles: SATELLITE_TILE_ENDPOINTS,
                tileSize: 256,
                minzoom: 0,
                maxzoom: SATELLITE_MAX_NATIVE_ZOOM,
                attribution: '',
            },
        },
        layers: [
            {
                id: 'satellite-base',
                type: 'raster',
                source: 'satellite',
                paint: {
                    'raster-saturation': 0.18,
                    'raster-contrast': 0.16,
                    'raster-brightness-min': 0.02,
                    'raster-brightness-max': 0.95,
                    'raster-fade-duration': 0,
                },
            },
        ],
    };
}

function normalizeCountryName(rawName) {
    if (!rawName) return null;
    return COUNTRY_BOUNDARY_NAMES[rawName] || rawName;
}

async function installCountryBoundaryLayers() {
    if (!_map) return;
    try {
        const response = await fetch(COUNTRY_BOUNDARIES_URL);
        if (!response.ok) return;
        const data = await response.json();
        const validCountries = new Set(Object.keys(ASIA_COUNTRIES));
        // Include Russia and transcontinental nations
        validCountries.add('Russia');
        validCountries.add('Russian Federation');
        validCountries.add('Turkey');
        validCountries.add('Georgia');
        validCountries.add('Azerbaijan');
        validCountries.add('Armenia');
        validCountries.add('Iran');
        validCountries.add('Iraq');

        _countryBoundaryFeatures = (data.features || []).filter((f) => {
            const name = normalizeCountryName(f.properties?.NAME || f.properties?.ADMIN || f.properties?.name);
            if (!name) return false;
            f.name = name;
            return validCountries.has(name);
        });

        renderBoundaryOverlay();
    } catch (e) {
        console.warn('[asia-map] installCountryBoundaryLayers error:', e);
    }
}

function installAllAsianCityBoundaryLayers() {
    if (!_map || _map.getSource('all-asian-city-territories')) return;
    const features = getAsianCities(regionsRegistry).map((location) => {
        const feature = buildCityTerritoryFeature(location) || generateOrganicCityPolygon(
            Number(location.latitude),
            Number(location.longitude),
            location.city || location.name
        );
        if (!feature) return null;
        return {
            ...feature,
            properties: {
                ...(feature.properties || {}),
                key: location.key,
                city: location.city || location.name,
                country: location.country || '',
            },
        };
    }).filter(Boolean);

    _map.addSource('all-asian-city-territories', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
    });
    _map.addLayer({
        id: 'all-asian-cities-border-glow',
        type: 'line',
        source: 'all-asian-city-territories',
        minzoom: 4.6,
        paint: {
            'line-color': 'rgba(16, 185, 255, 0.34)',
            'line-width': ['interpolate', ['linear'], ['zoom'], 4.6, 1.2, 10, 4, 15, 7],
            'line-blur': ['interpolate', ['linear'], ['zoom'], 4.6, 1, 10, 2.5, 15, 4],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 0.22, 8, 0.45, 15, 0.62],
        },
    });
    _map.addLayer({
        id: 'all-asian-cities-border-line',
        type: 'line',
        source: 'all-asian-city-territories',
        minzoom: 4.6,
        paint: {
            'line-color': '#9eefff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 4.6, 0.55, 9, 1.15, 15, 2],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 4.6, 0.34, 8, 0.72, 15, 0.9],
            'line-dasharray': [2, 1.4],
        },
    });
}

function geometryPaths(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') {
        return geometry.coordinates;
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.flat();
    }
    return [];
}

function getFeatureBounds(feature) {
    const paths = geometryPaths(feature?.geometry);
    const bounds = new maplibregl.LngLatBounds();
    let found = false;
    paths.forEach((ring) => ring.forEach(([longitude, latitude]) => {
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            bounds.extend([longitude, latitude]);
            found = true;
        }
    }));
    return found ? bounds : null;
}

function getCountryFeature(countryName) {
    const normalized = normalizeCountryName(countryName);
    return _countryBoundaryFeatures.find((feature) => feature.name === normalized) || null;
}

function animateFitBounds(bounds, options = {}) {
    if (!_map || !bounds) return Promise.resolve();
    const duration = options.duration ?? 0;
    if (!duration) {
        _map.fitBounds(bounds, { ...options, duration: 0 });
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve();
        };
        const timeout = window.setTimeout(finish, duration + 500);
        _map.once('moveend', finish);
        _map.fitBounds(bounds, { ...options, duration });
    });
}

function pointInRing(longitude, latitude, ring) {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
        const [currentLongitude, currentLatitude] = ring[index];
        const [previousLongitude, previousLatitude] = ring[previous];
        const crossesLatitude = (currentLatitude > latitude) !== (previousLatitude > latitude);
        const crossingLongitude = ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
            / ((previousLatitude - currentLatitude) || Number.EPSILON) + currentLongitude;
        if (crossesLatitude && longitude < crossingLongitude) inside = !inside;
    }
    return inside;
}

function pointInPolygon(longitude, latitude, polygon) {
    if (!polygon?.length || !pointInRing(longitude, latitude, polygon[0])) return false;
    return !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole));
}

function featureContainsCoordinate(feature, longitude, latitude) {
    const geometry = feature?.geometry;
    if (!geometry) return false;
    if (geometry.type === 'Polygon') return pointInPolygon(longitude, latitude, geometry.coordinates);
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some((polygon) => pointInPolygon(longitude, latitude, polygon));
    }
    return false;
}

function updateHoveredCountry(countryName) {
    if (_hoveredBoundaryName === countryName) return;
    _hoveredBoundaryName = countryName;
    const overlay = document.getElementById('asia-country-border-overlay');
    overlay?.querySelectorAll('.asia-country-boundary').forEach((path) => {
        path.classList.toggle('is-hovered', path.dataset.country === countryName);
    });
}

function scheduleCountryHover(event) {
    if (!_map || _map.getZoom() >= 9 || !_countryBoundaryFeatures.length) {
        updateHoveredCountry(null);
        return;
    }
    _pendingHoverCoordinate = [event.lngLat.lng, event.lngLat.lat];
    if (_countryHoverFrame) return;
    _countryHoverFrame = requestAnimationFrame(() => {
        _countryHoverFrame = 0;
        const coordinate = _pendingHoverCoordinate;
        _pendingHoverCoordinate = null;
        if (!coordinate) return;
        const hoveredFeature = _countryBoundaryFeatures.find((feature) => (
            featureContainsCoordinate(feature, coordinate[0], coordinate[1])
        ));
        updateHoveredCountry(hoveredFeature?.name || null);
    });
}

export async function flyAsiaMapToLocation(location, options = {}) {
    if (!_map) return;
    _currentLocation = location;
    _selectedBoundaryName = location?.country || location?.name || null;

    updateSelectedMarker(location);
    renderBoundaryOverlay();

    if (!location) {
        await animateCamera('flyTo', {
            center: DEFAULT_CENTER,
            zoom: 2.7,
            pitch: 0,
            bearing: 0,
            duration: 1300,
            essential: true,
        });
        return;
    }

    if (location.locationType === 'country') {
        const countryBounds = getFeatureBounds(getCountryFeature(location.country || location.name));
        if (countryBounds) {
            await animateFitBounds(countryBounds, {
                padding: window.innerWidth <= 768 ? 34 : 72,
                duration: 1600,
                maxZoom: 7.25,
                pitch: 0,
                essential: true,
            });
            return;
        }
    }

    const lon = Number(location.longitude);
    const lat = Number(location.latitude);
    const requestedZoom = options.zoom || (location.locationType === 'country' ? 5.2 : 12.5);
    const zoom = Math.min(SATELLITE_MAX_NATIVE_ZOOM - 0.1, requestedZoom);

    await animateCamera('flyTo', {
        center: [lon, lat],
        zoom,
        essential: true,
        duration: 1600,
        pitch: options.pitch || (zoom > 10 ? 25 : 0),
    });
}

function renderBoundaryOverlay() {
    if (!_map) return;
    const overlay = document.getElementById('asia-country-border-overlay');
    if (!overlay) return;

    const container = _map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    overlay.replaceChildren();

    const zoom = _map.getZoom();

    // 1. Draw Country Boundaries (at overview zoom levels)
    if (_countryBoundaryFeatures.length && zoom < 9) {
        _countryBoundaryFeatures.forEach((feature) => {
            const segments = geometryPaths(feature.geometry).map((ring) => ring.map(([longitude, latitude], index) => {
                const point = _map.project([longitude, latitude]);
                return `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
            }).join(' ') + ' Z');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', segments.join(' '));
            path.setAttribute('fill', 'none');
            path.dataset.country = feature.name;
            path.setAttribute('class', feature.name === _selectedBoundaryName
                ? 'asia-country-boundary is-selected'
                : 'asia-country-boundary');
            if (feature.name === _hoveredBoundaryName) path.classList.add('is-hovered');
            overlay.appendChild(path);
        });
    }

    // 2. Draw 360° Territorial Boundary ONLY for the currently selected city
    if (_currentLocation && (_currentLocation.locationType === 'city' || _currentLocation.city)) {
        const selectedFeature = buildCityTerritoryFeature(_currentLocation) || generateOrganicCityPolygon(
            Number(_currentLocation.latitude),
            Number(_currentLocation.longitude),
            _currentLocation.city || _currentLocation.name
        );
        if (selectedFeature) {
            const segments = geometryPaths(selectedFeature.geometry).map((ring) => ring.map(([longitude, latitude], index) => {
                const point = _map.project([longitude, latitude]);
                return `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
            }).join(' ') + ' Z');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', segments.join(' '));
            path.setAttribute('fill', 'none');
            path.setAttribute('class', 'asia-city-boundary is-selected');
            overlay.appendChild(path);
        }
    }
}

function tileAt(longitude, latitude, zoom) {
    const size = 2 ** zoom;
    const normalizedLongitude = ((longitude + 180) % 360 + 360) % 360;
    const x = Math.floor((normalizedLongitude / 360) * size);
    const latitudeRadians = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
    const y = Math.floor((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * size);
    return { x, y: Math.max(0, Math.min(size - 1, y)), size };
}

function warmTile(url) {
    if (_warmedTiles.has(url)) return Promise.resolve();
    _warmedTiles.add(url);
    return new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = resolve;
        image.onerror = resolve;
        image.src = url;
    });
}

function tileUrl(template, zoom, x, y) {
    return template
        .replace('{z}', zoom)
        .replace('{x}', x)
        .replace('{y}', y);
}

function warmTileGrid(requests, template, longitude, latitude, zoom, radius = 0) {
    const { x, y, size } = tileAt(longitude, latitude, zoom);
    for (let xOffset = -radius; xOffset <= radius; xOffset += 1) {
        for (let yOffset = -radius; yOffset <= radius; yOffset += 1) {
            const tileX = (x + xOffset + size) % size;
            const tileY = Math.max(0, Math.min(size - 1, y + yOffset));
            requests.push(warmTile(tileUrl(template, zoom, tileX, tileY)));
        }
    }
}

async function warmDestinationImagery(longitude, latitude, targetZoom) {
    if (targetZoom < 9) return;
    const requests = [];
    [4, 5, 7].forEach((zoom) => {
        warmTileGrid(requests, SATELLITE_TILE_TEMPLATE, longitude, latitude, zoom, zoom === 5 ? 1 : 0);
    });

    const satelliteZoom = Math.min(SATELLITE_MAX_NATIVE_ZOOM, Math.floor(targetZoom));
    warmTileGrid(requests, SATELLITE_TILE_TEMPLATE, longitude, latitude, satelliteZoom, 1);
    await Promise.race([
        Promise.allSettled(requests),
        new Promise((resolve) => window.setTimeout(resolve, 1000)),
    ]);
}

function animateCamera(method, cameraOptions) {
    if (!cameraOptions.duration) {
        _map[method]({ ...cameraOptions, duration: 0 });
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve();
        };
        const timeout = window.setTimeout(finish, cameraOptions.duration + 500);
        _map.once('moveend', finish);
        _map[method](cameraOptions);
    });
}

function waitForVisibleTiles(timeoutMs = 900) {
    if (_map.areTilesLoaded()) return Promise.resolve();
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            resolve();
        };
        const timeout = window.setTimeout(finish, timeoutMs);
        _map.once('idle', finish);
    });
}

function createShell() {
    const container = document.getElementById('globe-container');
    if (!container) return null;
    container.classList.add('asia-map-container');

    let canvas = document.getElementById('asia-map-canvas');
    if (!canvas) {
        canvas = document.createElement('div');
        canvas.id = 'asia-map-canvas';
        canvas.className = 'asia-map-canvas';
        canvas.setAttribute('aria-label', 'Interactive high-definition satellite map of Asia');
        container.prepend(canvas);
    }

    let boundaryOverlay = document.getElementById('asia-country-border-overlay');
    if (!boundaryOverlay) {
        boundaryOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        boundaryOverlay.id = 'asia-country-border-overlay';
        boundaryOverlay.setAttribute('aria-hidden', 'true');
        boundaryOverlay.setAttribute('preserveAspectRatio', 'none');
        canvas.after(boundaryOverlay);
    }

    let status = document.getElementById('asia-map-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'asia-map-status';
        status.className = 'asia-map-status';
        status.setAttribute('aria-live', 'polite');
        status.innerHTML = '<i data-lucide="scan" aria-hidden="true"></i><span>ASIA OVERVIEW · COUNTRY LABELS</span>';
        boundaryOverlay.after(status);
    }

    return canvas;
}

function makeLabelElement(name, type) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `asia-map-label asia-map-label-${type}`;
    element.textContent = name;
    element.setAttribute('aria-label', `${type === 'landmark' ? 'Famous place' : type}: ${name}`);
    return element;
}

function addLabelMarker({ name, longitude, latitude, type, location }) {
    const element = makeLabelElement(name, type);
    element.addEventListener('click', (event) => {
        event.stopPropagation();
        if (window.__wiaas && window.__wiaas.selectLocationContext) {
            if (type === 'landmark') {
                window.__wiaas.selectLocationContext({ ...location, name, longitude, latitude, locationType: 'landmark' });
            } else {
                window.__wiaas.selectLocationContext(location);
            }
        } else {
            if (type === 'landmark') {
                flyAsiaMapToLocation({ ...location, name, longitude, latitude, locationType: 'landmark' }, { zoom: 17 });
            } else {
                flyAsiaMapToLocation(location);
            }
        }
    });
    const marker = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(_map);
    _labelMarkers.push({ marker, element, type });
}

function buildProgressiveLabels() {
    _labelMarkers.forEach(({ marker }) => marker.remove());
    _labelMarkers = [];

    Object.entries(ASIA_COUNTRIES).forEach(([name, meta]) => {
        addLabelMarker({
            name,
            longitude: meta.center[0],
            latitude: meta.center[1],
            type: 'country',
            location: { name, country: name, longitude: meta.center[0], latitude: meta.center[1], locationType: 'country' },
        });
    });

    getAsianCities(regionsRegistry).forEach((location) => {
        addLabelMarker({
            name: location.city || location.name,
            longitude: Number(location.longitude),
            latitude: Number(location.latitude),
            type: 'city',
            location,
        });
    });

    ASIA_LANDMARKS.forEach((place) => {
        addLabelMarker({
            ...place,
            type: 'landmark',
            location: { ...place, locationType: 'landmark' },
        });
    });
    updateProgressiveLabels();
}

function updateProgressiveLabels() {
    if (!_map) return;
    const zoom = _map.getZoom();
    let mode = 'COUNTRY LABELS';
    _labelMarkers.forEach(({ element, type }) => {
        let visible = false;
        if (type === 'country') visible = zoom < 5.6;
        if (type === 'city') visible = zoom >= 5.6 && zoom < 14;
        if (type === 'landmark') visible = zoom >= 14;
        element.hidden = !visible;
    });
    if (zoom >= 14) mode = 'FAMOUS PLACES';
    else if (zoom >= 5.6) mode = 'CITY LABELS';
    const surface = zoom >= HD_SATELLITE_ZOOM ? 'HD SATELLITE' : 'SATELLITE';
    const status = document.querySelector('#asia-map-status span');
    if (status) status.textContent = `ZOOM ${zoom.toFixed(1)} · ${surface} · ${mode}`;
    const root = document.getElementById('globe-container');
    if (root) {
        root.dataset.mapState = _map.isMoving() ? 'MOVING' : 'READY';
        root.dataset.zoom = zoom.toFixed(2);
        root.dataset.labelMode = mode.toLowerCase().replace(' ', '-');
        root.dataset.mapSurface = surface.toLowerCase().replace(' ', '-');
        root.dataset.targetName = _currentLocation?.city || _currentLocation?.name || 'Asia';
        if (!_map.isMoving()) {
            root.dataset.tilesLoaded = String(_map.areTilesLoaded());
        }
    }
}

function scheduleLabelUpdate() {
    if (_labelFrame) return;
    _labelFrame = requestAnimationFrame(() => {
        _labelFrame = 0;
        updateProgressiveLabels();
    });
}

function updateSelectedMarker(location) {
    _selectedMarker?.remove();
    _selectedMarker = null;
    if (!location || location.locationType === 'country' || location.locationType === 'continent') return;
    const element = document.createElement('div');
    element.className = 'asia-map-target-marker';
    element.setAttribute('aria-label', `Selected location: ${location.city || location.name}`);
    _selectedMarker = new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([Number(location.longitude), Number(location.latitude)])
        .addTo(_map);
}

function getOverviewPadding() {
    const isMobile = window.innerWidth <= 768;
    return isMobile
        ? Object.freeze({ top: 32, right: 16, bottom: 32, left: 16 })
        : ASIA_OVERVIEW_PADDING;
}

function warmBaseOverviewTiles() {
    // Pre-cache zoom 1 (4 tiles) and zoom 2 (16 tiles) immediately
    for (let z = 1; z <= 2; z++) {
        const count = 2 ** z;
        for (let x = 0; x < count; x++) {
            for (let y = 0; y < count; y++) {
                warmTile(tileUrl(SATELLITE_TILE_TEMPLATE, z, x, y));
            }
        }
    }
    // Pre-cache primary Asian continent tiles at zoom 3
    for (let x = 4; x <= 7; x++) {
        for (let y = 1; y <= 4; y++) {
            warmTile(tileUrl(SATELLITE_TILE_TEMPLATE, 3, x, y));
        }
    }
}

export async function initAsiaMap() {
    if (_readyPromise) return _readyPromise;
    _readyPromise = (async () => {
        warmBaseOverviewTiles();
        const canvas = createShell();
        if (!canvas) throw new Error('Asia map container is missing.');
        _map = new maplibregl.Map({
            container: canvas,
            style: createStyle(),
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            minZoom: 2.1,
            // ArcGIS World Imagery supplies native tiles through level 18. A
            // higher map zoom causes the provider to return error-image tiles.
            maxZoom: SATELLITE_MAX_NATIVE_ZOOM - 0.1,
            renderWorldCopies: true,
            maxParallelImageRequests: 64,
            attributionControl: false,
            antialias: false,
            fadeDuration: 0,
            cooperativeGestures: false,
        });
        _map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'bottom-right');
        _map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');
        _map.on('zoom', scheduleLabelUpdate);
        _map.on('move', scheduleLabelUpdate);
        _map.on('mousemove', scheduleCountryHover);
        _map.getCanvas().addEventListener('mouseleave', () => updateHoveredCountry(null));
        _map.on('movestart', () => {
            updateHoveredCountry(null);
            document.getElementById('asia-country-border-overlay')?.classList.add('is-moving');
        });
        _map.on('moveend', () => {
            updateProgressiveLabels();
            renderBoundaryOverlay();
            document.getElementById('asia-country-border-overlay')?.classList.remove('is-moving');
        });
        _map.on('error', (event) => {
            const root = document.getElementById('globe-container');
            if (root) root.dataset.mapError = event?.error?.message || 'Tile request failed';
        });
        _map.on('click', (event) => {
            const { lng, lat } = event.lngLat;
            const cities = getAsianCities(regionsRegistry);
            // Search if a recognized registered city is within click proximity (~50km / 0.45 degrees)
            let closestCity = null;
            let minDistanceSq = 0.45 * 0.45;

            for (const city of cities) {
                const cLat = Number(city.latitude);
                const cLon = Number(city.longitude);
                const dLat = lat - cLat;
                const dLon = lng - cLon;
                const distSq = dLat * dLat + dLon * dLon;
                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestCity = city;
                }
            }

            // Only trigger location context and borders if a real catalog city was clicked
            if (closestCity && window.__wiaas?.selectLocationContext) {
                window.__wiaas.selectLocationContext(closestCity);
            }
        });
        await new Promise((resolve) => _map.once('load', resolve));
        installCountryBoundaryLayers();
        try { initMapLayers(_map); } catch(e) { console.warn('[map-layers] init error:', e); }
        installAllAsianCityBoundaryLayers();
        buildProgressiveLabels();
        _map.fitBounds(ASIA_BOUNDS, { padding: getOverviewPadding(), duration: 0, maxZoom: 3.05 });
        _map.resize();
        updateProgressiveLabels();

        window.addEventListener('resize', () => {
            if (_map) {
                _map.resize();
                updateProgressiveLabels();
                renderBoundaryOverlay();
            }
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (_map) {
                    _map.resize();
                    updateProgressiveLabels();
                    renderBoundaryOverlay();
                }
            }, 200);
        });

        return _map;
    })();
    return _readyPromise;
}

export function getAsiaMapState() {
    if (!_map) return { initialized: false };
    return {
        initialized: true,
        center: _map.getCenter().toArray(),
        zoom: _map.getZoom(),
        currentLocation: _currentLocation,
    };
}

export function getAsiaMapInstance() {
    return _map;
}

export async function resetAsiaMap() {
    await flyAsiaMapToLocation(null);
    // The reset view is a real Asia-wide forecast field, not a retained city
    // marker. This makes precipitation, wind and thermal layers coherent when
    // the operator returns to the continental map.
    try {
        const { showAsiaOverviewLayers } = await import('./map-layers.js');
        showAsiaOverviewLayers();
    } catch (error) {
        console.warn('[asia-map] overview layer refresh failed:', error);
    }
}

export function updateCityBorderData(geojson) {
    renderBoundaryOverlay();
}
