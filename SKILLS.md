# SKILLS.md — WIaaS Agent & Developer Operational Skills

This document defines the specialized skills, mathematical models, architectural competencies, and technical workflows required for agents and engineers developing the **WIaaS (Weather Intelligence as a Service)** platform.

---

## 1. Multi-Agent Decision Architecture

### A. WIaaS Agent (Operational Copilot)
- **Primary Domain**: Continuous resource resilience, agro-climatic forecasting, and logistics continuity.
- **Synthesis Workflows**:
  - Ingests real-time atmospheric readings and calculates Vapor Pressure Deficit (VPD), soil moisture stratification, and crop transpirational stress.
  - Generates actionable mitigation directives (e.g. night irrigation shifts, foliar heat shielding, standing water depths).
  - Forecasts electrical power grid demand surge ($+3.2\%\text{ per }^\circ\text{C}$ above regional baseline), transformer cooling headroom, and blackout risks.
  - Monitors multimodal logistics corridors and simulates temperature-dependent fuel burn acceleration ($+1.8\%\text{ per }^\circ\text{C}$ above $35^\circ\text{C}$).
  - Compiles comprehensive LLM **Research Summaries** incorporating regional climatological baselines.

### B. CrisisLens Agent (Emergency Multi-Hazard Intelligence)
- **Primary Domain**: Real-time disaster threat intelligence, early warning alerts, and rapid evacuation advisories.
- **Severity & Vector Indexing**:
  - Evaluates multi-hazard risk across Heatwaves (WBGT $\ge 35^\circ\text{C}$), Flash Floods (precipitation $> 40\text{ mm/h}$), and Typhoons/Cyclones (wind $\ge 85\text{ km/h}$).
  - Computes composite Crisis Severity Score ($0-100$).
  - Issues real-time emergency routing corridors bypassing compromised bridges, submerged highways, and failing substations.
  - Formats multi-channel actionable alerts (WhatsApp-formatted text and printable disaster directives).

---

## 2. Atmospheric & Thermodynamic Physics Modeling

### A. Saturation Vapor Pressure & VPD (Tetens Equation)
Saturation vapor pressure $e_s(T)$ is computed using the Tetens formula:
$$e_s(T) = 0.61078 \times \exp\left(\frac{17.27 \times T}{T + 237.3}\right) \quad (\text{in kPa})$$
Actual vapor pressure $e_a$:
$$e_a = e_s(T) \times \frac{RH}{100}$$
Vapor Pressure Deficit (VPD):
$$\text{VPD} = e_s(T) - e_a$$

### B. Wet-Bulb Globe Temperature (WBGT) & Survivability Limit
Approximated via Stull's empirical thermodynamic formulation:
$$T_{wb} = T \times \arctan(0.151977 \sqrt{RH + 8.313659}) + \arctan(T + RH) - \arctan(RH - 1.676331) + 0.00391838 \sqrt{RH^3} \arctan(0.023101 RH) - 4.686035$$
- **Threshold**: $T_{wb} \ge 35^\circ\text{C}$ marks the human metabolic cooling limit, triggering maximum emergency alert protocols.

### C. Resource Degradation Physics
- **Water Reservoir Evaporation**: Sensitive to high VPD and ambient temperature, depleting reserves at up to $1.4\times$ baseline.
- **Power Grid Load Surge**: Transformer efficiency degrades and air conditioning demand spikes non-linearly with dry-bulb temperature exceeding $38^\circ\text{C}$.
- **Logistics Fuel Volatility**: Thermal expansion and elevated engine cooling load accelerate burn rates.

---

## 3. High-Performance Cartographic & GIS Engineering

### A. 60 FPS Thermographic Asia Map (MapLibre GL)
- **Tile Architecture**: Multi-endpoint ArcGIS World Imagery satellite raster tiles with client-side tile warming.
- **Administrative GeoJSON Boundaries**:
  - Country borders loaded dynamically and styled with cyan glow borders.
  - Hover highlights (`scheduleCountryHover`) execute on `requestAnimationFrame` without mutating or resetting active selected region state.
  - Hierarchical Zoom: Continental Asia overview ($z \approx 2.5$) smoothly zooms into municipal districts and city territories ($z \approx 15.3$).
- **Map Layers & Precipitation Radars**:
  - Thermal perception heatmap layer.
  - RainViewer Doppler precipitation radar with 6-hour probability timelines.
  - Rotating 360-degree wind direction compass with ECMWF/GFS velocity vectors.

---

## 4. Real-Time Telemetry Oscilloscope (Dynamic Visualizer)

- **HTML5 2D Canvas Engine (`dynamic-visualizer.js`)**:
  - Updates continuously at 1-second (1000ms) intervals.
  - Smooth **Catmull-Rom cubic splines** with C1 continuity, eliminating choppy line jumps.
  - Spring lerp interpolation (`currentVal += (targetVal - currentVal) * 0.08`) for fluid vertical transitions.
  - Horizontal phase scrolling displaying rolling time slices (`-20s`, `-15s`, `-10s`, `-5s`, `LIVE ●`).
  - Rolling HUD telemetry metrics: `MIN (25s)`, `ROLLING AVG`, `PEAK`, `DRIFT (Δ/s)`.

---

## 5. Bilingual Voice & Speech Intelligence

- **Neural TTS Integration (`backend/app/main.py`)**:
  - Powers speech synthesis via `edge-tts` with high-clarity neural models:
    - English: `en-US-JennyNeural`
    - Urdu: `ur-PK-UzmaNeural`
  - Audio playback controls: Active speaker buttons toggle into a cancellable **Stop** button during streaming.
  - Native browser `speechSynthesis` used as resilient zero-latency fallback.
- **Dynamic Bilingual Synchronization (`chat.js`, `ui-agriculture.js`)**:
  - Language toggle (`EN | اردو`) dynamically translates all chat history, greetings, user tags, system notifications, placeholders, and tooltips in-place.
  - RTL Nastaliq typography support (`'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq'`).

---

## 6. Responsive UI/UX Design System

- **Multi-Device Breakpoints**:
  - **Desktop ($> 1100\text{px}$)**: Full symmetric top navigation bar showing all 8 sectors, agent buttons, Voice Advisory, and Language pills.
  - **Tablet ($768\text{px} - 1100\text{px}$)**: Compact adaptive top bar featuring the **Modules** button alongside **WIaaS** and **CrisisLens**.
  - **Mobile ($\le 768\text{px}$)**: Centered micro-pill top bar ($32\text{px}$ height) with compact labels (`Crisis`, `Modules`), slide-up bottom sheets, and sticky headers.
- **Zero-Overlap Architecture**:
  - Mutual drawer exclusivity on $\le 1024\text{px}$ (opening Left Sidebar closes Right Sidebar/Chat and vice versa).
  - Floating region widgets automatically hide when drawers open to avoid collision.
  - Touch-friendly action buttons with minimum $34\text{px} \times 34\text{px}$ hit areas.

---

## 7. Development & Verification Protocols

1. **Vite Bundle Compilation**:
   - Every frontend modification must be validated via `npm run build` in `frontend/`, ensuring zero syntax errors and valid asset generation.
2. **FastAPI Backend Server**:
   - Runs via `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.
   - All console outputs use UTF-8 encoding to prevent Windows cp1252 character crashes.
3. **Documentation Integrity**:
   - All architectural decisions and features must be permanently documented in `AGENTS.md`, `SECURITY.md`, and `SKILLS.md`.
