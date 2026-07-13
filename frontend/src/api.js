/**
 * api.js — All HTTP requests to the WIaaS backend.
 * During development, Vite proxies /analytics/* → http://localhost:8000
 * In production, the HTML is served by FastAPI which also handles /analytics/*
 */

import { regionNames, regionsTelemetryCache } from './state.js';

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
        const cachedData = regionsTelemetryCache[regionKey] || {};
        
        // Assemble the full context payload exactly like backend does
        const payload = {
            ...cachedData,
            user_query: query,
            chatInput: query
        };
        
        const response = await fetch('https://abdxllxh2002.app.n8n.cloud/webhook/wias-crisis-simulation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const n8nData = await response.json();
        
        // Extract the reply using common n8n response patterns
        let extractedReply = "";
        if (Array.isArray(n8nData) && n8nData.length > 0) {
            const first = n8nData[0];
            if (first && typeof first === 'object') {
                extractedReply = first.output || first.message || first.text || first.chat_message || first.regional_summary || first.reply || JSON.stringify(first);
            } else {
                extractedReply = String(first);
            }
        } else if (n8nData && typeof n8nData === 'object') {
            extractedReply = n8nData.output || n8nData.message || n8nData.text || n8nData.chat_message || n8nData.regional_summary || n8nData.reply || JSON.stringify(n8nData);
        } else {
            extractedReply = String(n8nData);
        }
        
        return { reply: extractedReply, raw_data: n8nData };
    } catch (error) {
        console.error(`[api] sendChatSimulation(${regionKey}) direct n8n call failed, falling back to local proxy:`, error);
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
        } catch (backendError) {
            console.error(`[api] sendChatSimulation(${regionKey}) local proxy fallback failed:`, backendError);
            return null;
        }
    }
}

/**
 * Send a chat message to the CrisisLens webhook directly.
 * @param {string} message 
 * @returns {Promise<Object|null>} 
 */
export async function sendCrisisLensChat(message) {
    try {
        let sessionId = sessionStorage.getItem('crisislens_session_id');
        if (!sessionId) {
            sessionId = 'session-' + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('crisislens_session_id', sessionId);
        }
        const response = await fetch('/analytics/crisislens/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId,
                user_id: 'user-123',
            }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('[api] sendCrisisLensChat failed:', error);
        return null;
    }
}


