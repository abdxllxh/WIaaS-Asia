# SECURITY.md: WIaaS Security Policy & Threat Mitigation Architecture

This document defines the security architecture, threat model, data protection policies, and operational vulnerability guidelines for the **WIaaS (Weather Intelligence as a Service)** platform.

---

## 1. Scope & Architecture Overview

WIaaS processes live atmospheric telemetry, satellite imagery, hydrological sensor feeds, and power grid status across Asian regional territories. It exposes:
- **FastAPI Endpoints** (`/api/v1/*`) serving telemetry, dynamic region resolution, grid predictions, and neural text-to-speech.
- **Client-Side SPA** (Vite + Vanilla JS + MapLibre GL) visualizing thermographic overlays, dynamic oscilloscopes, and bilingual chat interfaces.
- **n8n Orchestration Workflows** (`WIAAS-Asia.json`, `WIaaS-CrisisLens-Asia.json`) generating multi-agent decision intelligence.

---

## 2. API Security & Transport Layer

### A. Endpoint Access & Rate Limiting
1. **Local & Public Endpoints**:
   - `/api/v1/analytics`: Telemetry ingest and synthesis. Rate-limited to prevent Denial-of-Service (DoS) and excessive satellite API quota burn.
   - `/api/v1/grid-predictions`: Physics-based grid risk computation with strict parameter validation.
   - `/api/v1/tts`: Neural speech synthesis proxy powered by `edge-tts`.
2. **CORS Policy**:
   - During local development, CORS is configured for fast iteration. In production staging, `allow_origins` must be restricted to verified domain whitelists.
3. **No-Cache Policy for Telemetry Streams**:
   - Dynamic asset responses include `Cache-Control: no-cache, no-store, must-revalidate` to ensure real-time climate and grid readings are never stale.

---

## 3. Input Validation & Injection Mitigation

### A. Text-to-Speech (TTS) Endpoint (`/api/v1/tts`)
- **Sanitization**:
  - Voice requests must enforce strict length limits (maximum 1,500 characters per utterance).
  - Special characters that could alter SSML interpretation are escaped.
  - The voice selector is restricted to a strict whitelist:
    - `en-US-JennyNeural` (English)
    - `ur-PK-UzmaNeural` (Urdu)
  - Arbitrary system command execution or shell escaping via audio pipeline arguments is strictly prohibited.

### B. Client-Side XSS (Cross-Site Scripting) Defense
- **Dynamic DOM Rendering**:
  - In `frontend/src/chat.js` and `frontend/src/ui.js`, user queries and external model outputs must pass through `escapeHtml()` and `escapeAttr()` before insertion into `innerHTML`.
  - Raw strings from n8n webhook responses or browser speech recognition are treated as untrusted and escaped.

### C. Dynamic Region Key Normalization
- Region parameters passed to `/api/v1/grid-predictions` and dynamic registry resolvers are validated against regular expressions (`^[a-zA-Z0-9_\-:]+$`) to prevent path traversal or injection into file-based mock databases.

---

## 4. Environment & Secrets Management

1. **Zero Secret Leakage in Client Bundles**:
   - API keys (Open-Meteo commercial tokens, external LLM keys, Mapbox/ESRI tokens) must NEVER be baked into client-side code (`frontend/src`).
   - All external intelligence calls must route through the FastAPI proxy or n8n credential vault.
2. **Environment Isolation**:
   - Environment variables must be loaded via `.env` and kept strictly out of git history via `.gitignore`.
   - The `.gitignore` must exclude:
     ```
     .env
     .env.*
     *.log
     __pycache__/
     node_modules/
     ```

---

## 5. Physical Simulation & Ledger Integrity

1. **Thermodynamic Bounds Checking**:
   - Vapor Pressure Deficit (VPD) must remain bounded between $0.0\text{ kPa}$ and $12.0\text{ kPa}$.
   - Wet-Bulb Globe Temperature (WBGT) must remain bounded between $-20.0^\circ\text{C}$ and $50.0^\circ\text{C}$.
   - Prevents `NaN` or `Infinity` propagation into physics degradation curves (water evaporation, transformer load, fuel burn).
2. **Resource Ledger Integrity**:
   - Depletion calculations (water reservoir, power grid reserve, logistics fuel) are clamped to non-negative floats to avoid underflow anomalies.

---

## 6. Vulnerability Reporting

If you identify a potential security vulnerability in WIaaS:
1. Do NOT open a public GitHub issue.
2. Report the vulnerability details privately to the project maintainers with a proof-of-concept and affected endpoint list.
3. Patching turnaround SLA: Critical vulnerabilities within 24 hours; non-critical within 72 hours.
