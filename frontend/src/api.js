/**
 * api.js — All HTTP requests to the WIaaS backend.
 * During development, Vite proxies /analytics/* → http://localhost:8000
 * In production, the HTML is served by FastAPI which also handles /analytics/*
 */

import { regionNames } from './state.js';

/**
 * Fetch analytics payload for a given region key.
 * @param {string} regionKey
 * @returns {Promise<Object|null>} API response or null on failure
 */
export async function fetchRegionAnalytics(regionKey) {
    try {
        const name = regionNames[regionKey] || '';
        const url = name ? `/analytics/${regionKey}?name=${encodeURIComponent(name)}` : `/analytics/${regionKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`[api] fetchRegionAnalytics(${regionKey}) failed:`, error);
        return null;
    }
}

/**
 * Fetch analytics for all regions in parallel.
 * Returns a Map<regionKey, data>.
 * @param {string[]} regionsList
 * @returns {Promise<Map<string, Object>>}
 */
export async function fetchAllRegions(regionsList) {
    const results = new Map();
    await Promise.all(
        regionsList.map(async (key) => {
            const data = await fetchRegionAnalytics(key);
            if (data) results.set(key, data);
        })
    );
    return results;
}

/**
 * Send a chat message to the n8n simulation webhook via the backend.
 * @param {string} regionKey 
 * @param {string} query 
 * @returns {Promise<Object|null>} 
 */
export async function sendChatSimulation(regionKey, query) {
    try {
        const response = await fetch(`/analytics/${regionKey}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`[api] sendChatSimulation(${regionKey}) failed:`, error);
        return null;
    }
}

