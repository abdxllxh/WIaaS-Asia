/**
 * toast.js — Sci-Fi Toast Notification System for WIaaS
 * Replaces native browser alert() with sleek, animated, non-blocking toast notifications.
 */

let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
        toastContainer = document.getElementById('wiaas-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'wiaas-toast-container';
            toastContainer.className = 'wiaas-toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

export function showToast(message, type = 'success', duration = 3800) {
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `wiaas-toast wiaas-toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'warning' || type === 'error') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    } else {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    // Strip leading emojis from text if already provided
    const cleanMsg = String(message || '').replace(/^[✅❌⚠️ℹ️]\s*/, '');

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon-wrapper">${iconSvg}</span>
            <span class="toast-text">${cleanMsg}</span>
        </div>
        <button class="toast-close-btn" aria-label="Close notification">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    let timer = null;

    const dismiss = () => {
        if (timer) clearTimeout(timer);
        if (toast.classList.contains('toast-exit')) return;
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 280);
    };

    closeBtn?.addEventListener('click', dismiss);

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    if (duration > 0) {
        timer = setTimeout(dismiss, duration);
    }

    return toast;
}

if (typeof window !== 'undefined') {
    window.showToast = showToast;
    // Also override window.alert so no third-party or residual alert can pop up
    window.alert = (msg) => {
        showToast(String(msg), 'info');
    };
}
