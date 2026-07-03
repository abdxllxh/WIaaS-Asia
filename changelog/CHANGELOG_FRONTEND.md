# WIaaS Frontend & UI Architecture Document

This document details the newly created frontend interface files, their functions, user interface styling, and key variables in the **Weather Intelligence as a Service (WIaaS)** workspace under `backend/static/`.

---

## 📁 `backend/static/`

### 🆕 [NEW] [index.html](file:///d:/-Weather-Intelligence-as-a-Service-WIaaS-/backend/static/index.html)
The structure of the Climate Intelligence Dashboard.
*   **App Container**: Responsive page wrapping the navigation, 3D Canvas, sidebar widgets, control panels, and graphs.
*   **Top Left Info Widget**: Displays the active monitoring zone and live timezone clock using region metadata.
*   **Navigation Header**: Tab-based navigation (`Region`, `Physics`, `Agriculture`, `Grid`, `Logistics`, `Research`, `Globe Analysis`, `AI Agents`, `Analytics`, `Alerts`).
*   **3D Globe Container**: Holds the canvas where Three.js renders the interactive earth globe, including popup overlay info boxes and svg connector lines.
*   **Grid System Sidebars**: Glassmorphic panels containing charts, logs, and telemetry variables.

---

### 🆕 [NEW] [style.css](file:///d:/-Weather-Intelligence-as-a-Service-WIaaS-/backend/static/style.css)
The core design system and styling for the WIaaS dashboard.
*   **Design Aesthetics**: Customized HSL variables for color tones, dark theme layout, neon highlights, and high-tech typography (Google Fonts Outfit and JetBrains Mono).
*   **Layout & Responsiveness**: Flexible CSS grid and flexbox wrappers for panels.
*   **Glassmorphism**: Sleek card styles utilizing backdrop-blur (`backdrop-filter: blur(12px)`) and semi-transparent borders.
*   **Transitions**: Smooth interactive scaling, hover micro-animations, and glow effects.

---

### 🆕 [NEW] [app.js](file:///d:/-Weather-Intelligence-as-a-Service-WIaaS-/backend/static/app.js)
Frontend logic coordinating DOM binding, regional clock updates, API telemetry fetch, and Chart.js graphics.

#### 🔑 Key Variables
*   `activeRegionKey` *(string)*: Stores the key of the active monitored zone (default: `"pakistan_punjab"`).
*   `regionsList` *(array)*: Contains keys of the 12 supported regions worldwide.
*   `regionOffsets` *(object)*: Map of timezone offsets relative to UTC.
*   `regionNames` *(object)*: Mapping dictionary of region keys to descriptive strings.
*   `regionsTelemetryCache` *(object)*: Dictionary caching fetched API responses to avoid redundant network requests.
*   `radarChart`, `vramChart`, `tempPowerChart` *(objects)*: Live instances of Chart.js dashboard charts.

#### 🔧 Key Functions
*   `updateRegionTime()`: Computes local time using timezone offsets and updates the `#current-region-time` display. Runs every 1 second.
*   `loadRealTimeGlobeData()`: Asynchronously pre-fetches and caches telemetry endpoints `/analytics/{regionKey}` for all target regions.
*   `fetchRegionData(regionKey)`: Fetches data for the selected region and triggers UI panels and chart redraws.
*   `initCharts()`: Configures and constructs the initial Chart.js instances.
*   `updateCharts(data)`: Dynamically redraws charts with new telemetry variables (precipitation, wind load, power usage, etc.).

---

### 🆕 [NEW] [globe.js](file:///d:/-Weather-Intelligence-as-a-Service-WIaaS-/backend/static/globe.js)
WebGL client implementing the interactive 3D Globe with custom shaders and particle layer toggles.

#### 🔑 Key Variables
*   `REGION_COORDS` *(object)*: Coordinates mapping each region to latitude and longitude.
*   `GLOBE_VERTEX_SHADER` & `GLOBE_FRAGMENT_SHADER` *(GLSL strings)*: Custom vertex and fragment shaders implementing dynamic thermal heatmaps.
*   `scene`, `camera`, `renderer`, `globe`, `pinsGroup` *(Three.js classes)*: Underlying components of the WebGL renderer.
*   `heatmapActive`, `windActive`, `precipitationActive` *(booleans)*: Toggle parameters for rendering layer overlays.

#### 🔧 Key Functions
*   `initThreeJS()`: Builds the renderer, perspective camera, ambient/directional lights, and mouse controllers.
*   `createGlobe()`: Generates the sphere geometry, specular mappings, shader parameters, and builds the atmosphere glow layer.
*   `createPins()`: Converts latitudes and longitudes of the 12 target regions to 3D coordinate space and places markers.
*   `convertLatLngToVector3(lat, lon, radius)`: Utility function for mapping coordinates to a spherical surface.
*   `animate()`: Main animation loop coordinating self-rotation, particle velocity maps, and rendering.
