/**
 * chat.js — AI Assistant chat panel logic for WIaaS.
 * Handles message sending, simulated agent replies, and UI rendering.
 */

import { activeRegionKey } from './state.js';
import { sendChatSimulation } from './api.js';

// ── handleUserMessage() ──────────────────────────────────────────────────────
export async function handleUserMessage() {
    const input     = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages-container');
    const query     = input.value.trim();
    if (!query) return;

    // Render user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user-msg';
    userMsg.innerHTML = `
        <div class="msg-header">
            <span class="user-tag">Operator</span>
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="msg-text">${escapeHtml(query)}</p>
    `;
    container.appendChild(userMsg);
    input.value = '';
    container.scrollTop = container.scrollHeight;

    // Show loading indicator
    const loadingId = 'loading-' + Date.now();
    const loadingMsg = document.createElement('div');
    loadingMsg.id = loadingId;
    loadingMsg.className = 'chat-message agent-msg';
    loadingMsg.innerHTML = `
        <div class="msg-header">
            <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0</span>
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="msg-text" style="opacity: 0.7;"><em>Contacting n8n AI Swarm...</em></p>
    `;
    container.appendChild(loadingMsg);
    lucide.createIcons();
    container.scrollTop = container.scrollHeight;

    // Fetch region context then produce agent reply
    try {
        const data = await sendChatSimulation(activeRegionKey, query);
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        if (!data) {
            throw new Error("No response from backend");
        }

        const agentMsg = document.createElement('div');
        agentMsg.className = 'chat-message agent-msg';
        agentMsg.innerHTML = `
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0 (n8n)</span>
                <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="msg-text">${formatReply(data.reply)}</p>
        `;
        container.appendChild(agentMsg);
        lucide.createIcons();
        container.scrollTop = container.scrollHeight;

    } catch (e) {
        console.error('[chat] handleUserMessage failed:', e);
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-message agent-msg';
        errorMsg.innerHTML = `
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="alert-triangle"></i> System Error</span>
                <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="msg-text" style="color: #ef4444;">Connection to n8n webhook failed. Check backend logs.</p>
        `;
        container.appendChild(errorMsg);
        lucide.createIcons();
        container.scrollTop = container.scrollHeight;
    }
}

// ── formatReply() ────────────────────────────────────────────────────────────
function formatReply(text) {
    if (!text) return "";
    return escapeHtml(text).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}

// ── escapeHtml() ─────────────────────────────────────────────────────────────
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
