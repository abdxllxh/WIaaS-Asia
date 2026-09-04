import { getRegionMetadata, regionsRegistry } from './state.js';
import { flyAsiaMapToLocation, resetAsiaMap } from './asia-map.js';
import { ASIA_COUNTRIES } from './asia-map-data.js';

const REQUIRED_COUNTRY_CENTERS = Object.freeze({
    Pakistan: [69.3451, 30.3753],
    Japan: [138.2529, 36.2048],
    Bangladesh: [90.3563, 23.6850],
    Kazakhstan: [66.9237, 48.0196],
});

let _navigationGeneration = 0;
let _lastNavigatedLocation = null;

const NAVIGATION_TIMING = Object.freeze({
    continent: 2200,
    country: 2400,
    region: 2700,
    city: 3200,
    reset: 2200,
});

function averageCoordinates(items) {
    const valid = items.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    if (!valid.length) return { latitude: 34, longitude: 100 };
    return {
        latitude: valid.reduce((sum, item) => sum + item.latitude, 0) / valid.length,
        longitude: valid.reduce((sum, item) => sum + item.longitude, 0) / valid.length,
    };
}

export function inferLocationType(location = {}) {
    if (location.locationType) return location.locationType;
    const key = location.key || '';
    const city = String(location.city || '').toLowerCase();
    if (key === 'pakistan_punjab' || city.includes('region')) return 'province';
    return location.city ? 'city' : 'region';
}

export function makeCountryLocation(countryName) {
    const zones = Object.values(regionsRegistry).filter((item) => item.country === countryName);
    const countryMeta = ASIA_COUNTRIES[countryName];
    const explicit = countryMeta?.center || REQUIRED_COUNTRY_CENTERS[countryName];
    const average = averageCoordinates(zones);
    return {
        key: `country:${countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: countryName,
        country: countryName,
        continent: 'Asia',
        asian_subregion: countryMeta?.subregion || zones[0]?.asian_subregion || 'Asia',
        locationType: 'country',
        longitude: explicit?.[0] ?? average.longitude,
        latitude: explicit?.[1] ?? average.latitude,
        timeZone: countryMeta?.timeZone,
        timezone: countryMeta?.timeZone,
        timezone_offset: countryMeta?.utcOffset ?? zones[0]?.timezone_offset ?? 0,
    };
}

export function makeProvinceLocation(countryName, provinceName) {
    const zones = Object.values(regionsRegistry).filter(
        (item) => item.country === countryName && item.province === provinceName,
    );
    const countryMeta = ASIA_COUNTRIES[countryName];
    const average = averageCoordinates(zones);
    return {
        key: `province:${countryName}:${provinceName}`,
        name: provinceName,
        province: provinceName,
        country: countryName,
        continent: 'Asia',
        asian_subregion: zones[0]?.asian_subregion || 'Asia',
        locationType: 'province',
        latitude: average.latitude,
        longitude: average.longitude,
        timeZone: countryMeta?.timeZone,
        timezone: countryMeta?.timeZone,
        timezone_offset: zones[0]?.timezone_offset ?? countryMeta?.utcOffset ?? 0,
    };
}

export function normalizeLocation(location) {
    if (!location) return null;
    const normalized = {
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        locationType: inferLocationType(location),
    };
    if (!Number.isFinite(normalized.latitude) || !Number.isFinite(normalized.longitude)) return null;
    normalized.continent ||= 'Asia';
    if (normalized.country) normalized.countryLocation = makeCountryLocation(normalized.country);
    if (normalized.country && normalized.province) {
        normalized.provinceLocation = makeProvinceLocation(normalized.country, normalized.province);
    }
    return normalized;
}

export function getLocationForRegionKey(regionKey) {
    const meta = getRegionMetadata(regionKey);
    return meta ? normalizeLocation({ ...meta, key: regionKey }) : null;
}

export async function navigateToLocation(rawLocation) {
    const generation = ++_navigationGeneration;

    if (rawLocation?.locationType === 'global') {
        await resetGeographicNavigation();
        return;
    }

    const location = normalizeLocation(rawLocation);
    if (!location) throw new Error('Location requires valid latitude and longitude.');

    if (location.locationType === 'continent') {
        await flyAsiaMapToLocation(location, { duration: NAVIGATION_TIMING.continent });
        _lastNavigatedLocation = location;
        return;
    }

    if (location.locationType === 'country') {
        await flyAsiaMapToLocation(location, { duration: NAVIGATION_TIMING.country });
        _lastNavigatedLocation = location;
        return;
    }

    if (location.locationType === 'region' || location.locationType === 'province') {
        await flyAsiaMapToLocation(location, { duration: NAVIGATION_TIMING.region });
        _lastNavigatedLocation = location;
        return;
    }

    if (location.locationType === 'city' || location.locationType === 'landmark') {
        await flyAsiaMapToLocation(location, { duration: NAVIGATION_TIMING.city });
        if (generation !== _navigationGeneration) return;
        _lastNavigatedLocation = location;
    }
}

export async function navigateToRegionKey(regionKey) {
    const location = getLocationForRegionKey(regionKey);
    if (location) await navigateToLocation(location);
}

export async function navigateToCountry(countryName) {
    await navigateToLocation(makeCountryLocation(countryName));
}

export async function navigateToProvince(countryName, provinceName) {
    await navigateToLocation(makeProvinceLocation(countryName, provinceName));
}

export async function resetGeographicNavigation() {
    ++_navigationGeneration;
    _lastNavigatedLocation = null;
    await resetAsiaMap({ duration: NAVIGATION_TIMING.reset });
}

export function getGeographicNavigationState() {
    return {
        mode: _lastNavigatedLocation ? 'asia-map-focus' : 'asia-overview',
        location: _lastNavigatedLocation,
    };
}
