import { activeRegionKey, chatMode, setChatMode } from './state.js';
import { sendChatSimulation, sendCrisisLensChat } from './api.js';

// ── updateChatModeUI() ────────────────────────────────────────────────────────
export function updateChatModeUI(mode) {
    setChatMode(mode);
    const headerTitle = document.querySelector('.chat-card .panel-header .header-title h2');
    const headerIcon = document.querySelector('.chat-card .panel-header .header-title i');
    const chatInput = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages-container');

    if (mode === 'crisislens') {
        if (headerTitle) headerTitle.textContent = "WIaaS CrisisLens";
        if (headerIcon) {
            headerIcon.setAttribute('data-lucide', 'shield-alert');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        if (chatInput) chatInput.placeholder = "Ask CrisisLens (weather threats, actions, etc.)...";
        
        container.innerHTML = `
            <div class="chat-message agent-msg">
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="shield-alert"></i> CrisisLens Agent</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="msg-text">Greetings, Operator. The CrisisLens threat monitoring system is active. I can process live regional weather and disaster feeds, evaluate risk severity, explain indicators, and map actions for Farmers, the Public, Grid Teams, and Logistics. What region or threat would you like to evaluate?</p>
                <div class="system-notification" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05);">
                    <span class="notif-title" style="color: #ef4444;">CrisisLens Active</span>
                    <p class="notif-body">Webhook connected. Direct response routing enabled for Sylhet, Punjab, Paris, and all active zones.</p>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        if (headerTitle) headerTitle.textContent = "WIaaS AI Assistant";
        if (headerIcon) {
            headerIcon.setAttribute('data-lucide', 'sparkles');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        if (chatInput) chatInput.placeholder = "Ask WIaaS agent swarm anything...";
        
        container.innerHTML = `
            <div class="chat-message agent-msg">
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="msg-text">Greetings, Operator. I am analyzing the telemetry feed across five specialized models. What sector requires focus?</p>
                <div class="system-notification">
                    <span class="notif-title">System Notification</span>
                    <p class="notif-body" id="system-notification-text">Global weather models have just compiled a new ensemble forecast for the Next 72 Hours. Focus is recommended on Sector West Grid.</p>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ── extractWebhookReply() ───────────────────────────────────────────────────
function extractWebhookReply(data) {
    if (!data) return "";
    if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (first && typeof first === 'object') {
            return first.output || first.message || first.text || JSON.stringify(first);
        }
        return String(first);
    }
    if (typeof data === 'object') {
        return data.output || data.message || data.text || data.reply || JSON.stringify(data);
    }
    return String(data);
}

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
            <span class="agent-tag"><i data-lucide="${chatMode === 'crisislens' ? 'shield-alert' : 'cpu'}"></i> ${chatMode === 'crisislens' ? 'CrisisLens Agent' : 'WIaaS-SWARM-V1.0'}</span>
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="msg-text" style="opacity: 0.7;"><em>${chatMode === 'crisislens' ? 'Contacting CrisisLens Webhook...' : 'Contacting n8n AI Swarm...'}</em></p>
    `;
    container.appendChild(loadingMsg);
    lucide.createIcons();
    container.scrollTop = container.scrollHeight;

    // Fetch region context then produce agent reply
    try {
        let replyText = "";
        let agentTagText = "";
        let agentIcon = "";

        if (chatMode === 'crisislens') {
            agentTagText = "CrisisLens Agent";
            agentIcon = "shield-alert";
            const data = await sendCrisisLensChat(query);
            if (!data) {
                throw new Error("No response from CrisisLens webhook");
            }
            replyText = extractWebhookReply(data);
        } else {
            agentTagText = "WIaaS-SWARM-V1.0 (n8n)";
            agentIcon = "cpu";
            const data = await sendChatSimulation(activeRegionKey, query);
            if (!data) {
                throw new Error("No response from backend");
            }
            replyText = data.reply;
        }
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        const agentMsg = document.createElement('div');
        agentMsg.className = 'chat-message agent-msg';
        agentMsg.innerHTML = `
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="${agentIcon}"></i> ${agentTagText}</span>
                <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="msg-text">${formatReply(replyText)}</p>
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
            <p class="msg-text" style="color: #ef4444;">Connection failed. Check network or webhook configuration.</p>
        `;
        container.appendChild(errorMsg);
        lucide.createIcons();
        container.scrollTop = container.scrollHeight;
    }
}

// ── formatReply() ────────────────────────────────────────────────────────────
function formatReply(text) {
    if (!text) return "";
    let formatted = escapeHtml(text)
        .replace(/\\n/g, '<br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    return formatted;
}

// ── escapeHtml() ─────────────────────────────────────────────────────────────
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

