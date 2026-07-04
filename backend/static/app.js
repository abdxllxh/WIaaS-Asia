// Global State
let activeRegionKey = "pakistan_punjab";
const regionsList = [
    "pakistan_punjab", "togo_maritime", "france_paris", "spain_andalusia",
    "germany_bavaria", "uk_london", "italy_sicily", "usa_california_central_valley",
    "usa_texas_houston", "brazil_cerrado", "canada_alberta", "argentina_pampas"
];

const regionOffsets = {
    "pakistan_punjab": 5,
    "togo_maritime": 0,
    "france_paris": 2,
    "spain_andalusia": 2,
    "germany_bavaria": 2,
    "uk_london": 1,
    "italy_sicily": 2,
    "usa_california_central_valley": -7,
    "usa_texas_houston": -5,
    "brazil_cerrado": -3,
    "canada_alberta": -6,
    "argentina_pampas": -3
};

const regionNames = {
    "pakistan_punjab": "Punjab Region, Pakistan",
    "togo_maritime": "Maritime Region, Togo",
    "france_paris": "Paris, France",
    "spain_andalusia": "Andalusia, Spain",
    "germany_bavaria": "Bavaria, Germany",
    "uk_london": "Greater London, UK",
    "italy_sicily": "Sicily, Italy",
    "usa_california_central_valley": "Central Valley, California",
    "usa_texas_houston": "Houston, Texas",
    "brazil_cerrado": "Cerrado Savannah, Brazil",
    "canada_alberta": "Alberta Plains, Canada",
    "argentina_pampas": "The Pampas, Argentina"
};

// Globe Overlays & Shaders Toggles
let heatmapActive = true;
let windActive = false;
let precipitationActive = false;
let standardMaterial = null;
let heatmapMaterial = null;
let windHelpers = [];
let rainHelpers = [];
let regionsTelemetryCache = {};

// Zoom & Zoom Interaction state
let targetCameraZ = 4.5;
let targetGlobeRotation = { x: 0, y: 0 };
let isRotationPaused = false;
let activePopupRegionKey = null;

// Chart Instances
let radarChart = null;
let vramChart = null;
let tempPowerChart = null;

// Three.js Variables
let scene, camera, renderer, globe, pinsGroup;

// Initialize Lucide Icons
lucide.createIcons();

function updateRegionTime() {
    const offset = regionOffsets[activeRegionKey] !== undefined ? regionOffsets[activeRegionKey] : 0;
    const utc = new Date().getTime() + new Date().getTimezoneOffset() * 60000;
    const localTime = new Date(utc + 3600000 * offset);
    const timeStr = localTime.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const timeValEl = document.getElementById("current-region-time");
    if (timeValEl) timeValEl.innerText = timeStr;
}

// Tick clock every second
setInterval(updateRegionTime, 1000);

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    initThreeJS();
    initCharts();
    setupEventListeners();
    fetchRegionData(activeRegionKey);
    animateMetrics();
    updateRegionTime();
    loadRealTimeGlobeData();
});

async function loadRealTimeGlobeData() {
    const promises = regionsList.map(async (key) => {
        try {
            const res = await fetch(`/analytics/${key}`);
            if (res.ok) {
                const data = await res.json();
                regionsTelemetryCache[key] = data;
            }
        } catch (e) {
            console.error(e);
        }
    });

    await Promise.all(promises);

    // Re-render globe markers and shader inputs using real-time data
    addGlobePins();
}


// ── Three.js Globe Setup ─────────────────────────────────────────
function initThreeJS() {
    const container = document.getElementById("globe-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();

    // Add space-like atmospheric gradient
    scene.background = null;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 3, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00e5ff, 0.4);
    dirLight2.position.set(-5, -3, -5);
    // ── Lighting for photorealistic satellite look ──────────────────
    // Remove existing dim lights and replace with a single sun-like directional
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    const ambientFill = new THREE.AmbientLight(0x112233, 0.35); // deep blue ambient for night side
    scene.add(ambientFill);

    // Globe sphere
    const geometry = new THREE.SphereGeometry(1.6, 64, 64);

    const textureLoader = new THREE.TextureLoader();

    // ── NASA Blue Marble day satellite texture (photorealistic) ──────
    const dayTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const nightTexture = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
    const normalMap = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg');
    const specularMap = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');

    // Uniforms for thermal heatmap shader (keeps existing overlay capability)
    const earthUniforms = {
        specularMap: { value: specularMap },
        regionPos: { value: new Float32Array(36) },
        regionTemp: { value: new Float32Array(12) }
    };

    const vertexShader = `
        varying vec2 vUv;
        varying vec3 vLocalPosition;
        void main() {
            vUv = uv;
            // Normalize to unit sphere so distances are scale-independent
            vLocalPosition = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform sampler2D specularMap;
        uniform vec3 regionPos[12];
        uniform float regionTemp[12];
        varying vec2 vUv;
        varying vec3 vLocalPosition;

        void main() {
            float spec = texture2D(specularMap, vUv).r;
            
            if (spec > 0.05) {
                // Ocean - solid dark carbon grey
                gl_FragColor = vec4(0.04, 0.04, 0.06, 1.0);
            } else {
                // Land - Sleek neutral carbon base
                vec3 baseLandColor = vec3(0.12, 0.12, 0.15);
                
                // Find local region thermal influence
                float maxInfluence = 0.0;
                float targetTemp = 0.5;
                
                for (int i = 0; i < 12; i++) {
                    // Normalize regionPos to unit sphere to match vLocalPosition
                    vec3 rp = normalize(regionPos[i]);
                    float dist = distance(vLocalPosition, rp);
                    // Bloom radius 0.35 on unit sphere (~20 degrees of arc)
                    if (dist < 0.35) {
                        float influence = (0.35 - dist) / 0.35;
                        influence = influence * influence; // quadratic falloff for sharper edges
                        if (influence > maxInfluence) {
                            maxInfluence = influence;
                            targetTemp = regionTemp[i];
                        }
                    }
                }
                
                if (maxInfluence > 0.0) {
                    // Map temperature to thermal color ramp
                    vec3 thermalColor;
                    if (targetTemp < 0.22) {
                        thermalColor = mix(vec3(0.0, 0.15, 0.75), vec3(0.0, 0.8, 0.75), targetTemp / 0.22);
                    } else if (targetTemp < 0.45) {
                        thermalColor = mix(vec3(0.0, 0.8, 0.75), vec3(0.0, 0.8, 0.15), (targetTemp - 0.22) / 0.23);
                    } else if (targetTemp < 0.68) {
                        thermalColor = mix(vec3(0.0, 0.8, 0.15), vec3(0.95, 0.85, 0.0), (targetTemp - 0.45) / 0.23);
                    } else if (targetTemp < 0.85) {
                        thermalColor = mix(vec3(0.95, 0.85, 0.0), vec3(0.95, 0.42, 0.0), (targetTemp - 0.68) / 0.17);
                    } else {
                        thermalColor = mix(vec3(0.95, 0.42, 0.0), vec3(0.85, 0.02, 0.02), (targetTemp - 0.85) / 0.15);
                    }
                    
                    // Smoothly blend the thermal color with the base land color based on proximity
                    vec3 finalColor = mix(baseLandColor, thermalColor, maxInfluence);
                    gl_FragColor = vec4(finalColor, 1.0);
                } else {
                    gl_FragColor = vec4(baseLandColor, 1.0);
                }
            }
        }
    `;

    heatmapMaterial = new THREE.ShaderMaterial({
        uniforms: earthUniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        opacity: 0.95
    });

    // ── Photorealistic satellite material (Google Earth style) ───────
    standardMaterial = new THREE.MeshPhongMaterial({
        map: dayTexture,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        specularMap: specularMap,
        shininess: 18,
        specular: new THREE.Color(0x224466),
        transparent: false,
    });

    globe = new THREE.Mesh(geometry, heatmapActive ? heatmapMaterial : standardMaterial);
    scene.add(globe);

    // ── Cloud Layer ─────────────────────────────────────────────────
    // Slightly larger sphere with alpha cloud texture, slowly counter-rotates
    const cloudTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_2048.png');
    const cloudGeo = new THREE.SphereGeometry(1.625, 48, 48);
    const cloudMat = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        alphaMap: cloudTexture,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
    });
    const cloudSphere = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(cloudSphere);

    // Animate clouds to slowly drift — stored on globe userData for access in animate()
    globe.userData.cloudSphere = cloudSphere;

    // ── Atmospheric Limb Glow ───────────────────────────────────────
    const atmosGeo = new THREE.SphereGeometry(1.68, 48, 48);
    const atmosMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
                gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * intensity;
            }`,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    pinsGroup = new THREE.Group();
    globe.add(pinsGroup);

    // Add dummy coordinates (glowing pins)
    addGlobePins();

    // Mouse Interaction for Globe Drag Rotation
    let isDragging = false;
    let dragStartTime = 0;
    let previousMousePosition = { x: 0, y: 0 };
    let userRotationOffset = { x: 0, y: 0 };

    container.addEventListener("mousedown", (e) => {
        isDragging = true;
        dragStartTime = Date.now();
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    container.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        userRotationOffset.y += deltaX * 0.005;
        userRotationOffset.x += deltaY * 0.005;

        // Clamp vertical rotation to avoid flipping upside down
        userRotationOffset.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, userRotationOffset.x));

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
    });

    // 3D Raycasting Pin Clicks — disabled for now
    // TODO: re-enable once popup interaction is stable

    // Animation Loop
    let autoSpinAngle = 0;
    let pulseTime = 0;

    function animate() {
        requestAnimationFrame(animate);

        pulseTime += 0.05;

        // Slow, visible auto-spin to keep the UI active (1 rotation every ~1.5 minutes)
        autoSpinAngle += 0.0012;
        globe.rotation.y = autoSpinAngle + userRotationOffset.y;
        globe.rotation.x = userRotationOffset.x;

        // Clouds drift slightly faster than the globe for a realistic atmospheric parallax
        const cs = globe.userData.cloudSphere;
        if (cs) {
            cs.rotation.y = autoSpinAngle * 1.08 + userRotationOffset.y;
            cs.rotation.x = userRotationOffset.x;
        }

        // Animate dynamic rain rings (pulsing scale)
        if (precipitationActive && rainHelpers.length > 0) {
            rainHelpers.forEach((ring, idx) => {
                const pulse = 1.0 + Math.abs(Math.sin(pulseTime + idx)) * 0.8;
                ring.scale.set(pulse, pulse, 1);
            });
        }

        // Animate wind vectors (gusting lengths)
        if (windActive && windHelpers.length > 0) {
            windHelpers.forEach((arrow, idx) => {
                const scale = 0.8 + Math.sin(pulseTime * 1.5 + idx) * 0.2;
                arrow.setLength(0.35 * scale, 0.08 * scale, 0.04 * scale);
            });
        }

        // Position details card and draw leader connector line
        const overlay = document.getElementById("globe-popup-overlay");
        if (isRotationPaused && activePopupRegionKey && overlay && !overlay.classList.contains("hidden")) {
            const defaults = {
                pakistan_punjab: { lat: 31.17, lon: 72.70 },
                togo_maritime: { lat: 6.13, lon: 1.22 },
                france_paris: { lat: 48.85, lon: 2.35 },
                spain_andalusia: { lat: 37.38, lon: -5.98 },
                germany_bavaria: { lat: 48.79, lon: 11.49 },
                uk_london: { lat: 51.50, lon: -0.12 },
                italy_sicily: { lat: 37.60, lon: 14.01 },
                usa_california_central_valley: { lat: 36.77, lon: -119.41 },
                usa_texas_houston: { lat: 29.76, lon: -95.36 },
                brazil_cerrado: { lat: -14.23, lon: -51.92 },
                canada_alberta: { lat: 53.93, lon: -116.57 },
                argentina_pampas: { lat: -34.60, lon: -58.38 }
            };

            const coords = defaults[activePopupRegionKey];
            if (coords) {
                const phi = (90 - coords.lat) * (Math.PI / 180);
                const theta = (coords.lon + 180) * (Math.PI / 180);

                const localPos = new THREE.Vector3(
                    -(1.6 * Math.sin(phi) * Math.sin(theta)),
                    1.6 * Math.cos(phi),
                    1.6 * Math.sin(phi) * Math.cos(theta)
                );

                const worldPos = localPos.clone().applyMatrix4(globe.matrixWorld);
                worldPos.project(camera);

                const rect = container.getBoundingClientRect();
                const screenX = (worldPos.x * 0.5 + 0.5) * rect.width;
                const screenY = (-(worldPos.y * 0.5) + 0.5) * rect.height;

                const popupBox = document.getElementById("globe-popup-box");

                // Position popup box offset from the pin
                const boxX = screenX + 90;
                const boxY = screenY - 80;
                popupBox.style.left = `${boxX}px`;
                popupBox.style.top = `${boxY}px`;

                // Draw Connector leader-line path
                const path = document.getElementById("connector-path");
                const midX = screenX + 35;
                const midY = screenY - 25;
                path.setAttribute("d", `M ${screenX} ${screenY} L ${midX} ${midY} L ${boxX} ${boxY + 35}`);
            }
        }

        renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    window.addEventListener("resize", () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}

function addGlobePins() {
    const pinGeom = new THREE.SphereGeometry(0.04, 16, 16);

    // Clear old elements from scene
    windHelpers.forEach(h => pinsGroup.remove(h));
    rainHelpers.forEach(h => pinsGroup.remove(h));
    pinsGroup.clear();

    windHelpers = [];
    rainHelpers = [];

    const positionsArray = new Float32Array(36); // 12 * 3 floats
    const tempsArray = new Float32Array(12);     // 12 floats

    // Loop through the 12 regions
    regionsList.forEach((key, idx) => {
        const cache = regionsTelemetryCache[key];

        const defaults = {
            pakistan_punjab: { lat: 31.17, lon: 72.70 },
            togo_maritime: { lat: 6.13, lon: 1.22 },
            france_paris: { lat: 48.85, lon: 2.35 },
            spain_andalusia: { lat: 37.38, lon: -5.98 },
            germany_bavaria: { lat: 48.79, lon: 11.49 },
            uk_london: { lat: 51.50, lon: -0.12 },
            italy_sicily: { lat: 37.60, lon: 14.01 },
            usa_california_central_valley: { lat: 36.77, lon: -119.41 },
            usa_texas_houston: { lat: 29.76, lon: -95.36 },
            brazil_cerrado: { lat: -14.23, lon: -51.92 },
            canada_alberta: { lat: 53.93, lon: -116.57 },
            argentina_pampas: { lat: -34.60, lon: -58.38 }
        };

        const lat = defaults[key].lat;
        const lon = defaults[key].lon;

        let tempCelsius = 20.0;
        let windSpeed = 10.0;
        let windDir = 0.0;
        let humidity = 50.0;

        if (cache) {
            tempCelsius = cache.telemetry.temperature_celsius;
            windSpeed = cache.telemetry.wind_speed_kmh;
            windDir = cache.telemetry.wind_direction_degrees;
            humidity = cache.telemetry.humidity_percentage;
        }

        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        // No negation on x — must match Three.js sphere geometry convention
        const x = 1.6 * Math.sin(phi) * Math.sin(theta);
        const y = 1.6 * Math.cos(phi);
        const z = 1.6 * Math.sin(phi) * Math.cos(theta);

        // Store flat coordinate values for GLSL shader array uniform
        positionsArray[idx * 3] = x;
        positionsArray[idx * 3 + 1] = y;
        positionsArray[idx * 3 + 2] = z;

        // Normalize temperature to [0, 1] based on standard climate scale [-5C to 45C]
        const normTemp = Math.max(0.0, Math.min(1.0, (tempCelsius + 5) / 50));
        tempsArray[idx] = normTemp;

        const isCurrentActive = (key === activeRegionKey);
        const pinMat = new THREE.MeshBasicMaterial({
            color: isCurrentActive ? 0x38bdf8 : 0x0ea5e9,
            transparent: true,
            opacity: isCurrentActive ? 1.0 : 0.7
        });

        // Create invisible marker objects for region (no visual blue dots)
        const pin = new THREE.Mesh(pinGeom, pinMat);
        pin.position.set(x, y, z);
        pin.userData = { regionKey: key };
        pin.visible = false; // hide pin
        // pinsGroup.add(pin); // do not add visible pin
        const ringGeo = new THREE.RingGeometry(0.05, 0.07, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: isCurrentActive ? 0x38bdf8 : 0x0ea5e9,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: isCurrentActive ? 0.8 : 0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y, z);
        ring.lookAt(0, 0, 0);
        ring.visible = false; // hide ring
        // pinsGroup.add(ring); // do not add visible ring

        // Wind Tangent Vector
        const origin = new THREE.Vector3(x, y, z);
        const normal = origin.clone().normalize();
        const localNorth = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
        const localEast = normal.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();

        const windRad = (windDir * Math.PI) / 180;
        const windTangent = localNorth.clone().multiplyScalar(Math.cos(windRad))
            .add(localEast.clone().multiplyScalar(Math.sin(windRad))).normalize();

        const arrowLength = 0.15 + (windSpeed / 60) * 0.35;
        const arrow = new THREE.ArrowHelper(windTangent, origin, arrowLength, 0x38bdf8, 0.08, 0.04);
        arrow.visible = windActive;
        pinsGroup.add(arrow);
        windHelpers.push(arrow);

        // Precipitation Ring
        const rainGeo = new THREE.RingGeometry(0.08, 0.11, 16);
        const rainMat = new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: (humidity / 100) * 0.8
        });
        const rainRing = new THREE.Mesh(rainGeo, rainMat);
        rainRing.position.set(x, y, z);
        rainRing.lookAt(0, 0, 0);
        rainRing.visible = (precipitationActive && humidity > 60);
        pinsGroup.add(rainRing);
        rainHelpers.push(rainRing);
    });

    // Update custom shader uniforms
    if (heatmapMaterial && heatmapMaterial.uniforms) {
        heatmapMaterial.uniforms.regionPos.value = positionsArray;
        heatmapMaterial.uniforms.regionTemp.value = tempsArray;
    }
}

// ── Chart JS Setup ───────────────────────────────────────────────
function initCharts() {
    // 1. Crop Health Radar Chart
    const ctxRadar = document.getElementById("radarChart").getContext("2d");
    radarChart = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Transpiration', 'NDVI Index', 'Soil Moisture', 'Canopy Cover', 'Nitrogen Level'],
            datasets: [{
                label: 'Index Value',
                data: [0.72, 0.82, 0.65, 0.55, 0.70],
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: '#10b981',
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: {
                        color: '#9090a0',
                        font: { family: 'Outfit', size: 9 }
                    },
                    ticks: { display: false },
                    suggestedMin: 0,
                    suggestedMax: 1
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // 2. VRAM Allocation Bar Chart (ROCm Details Panel)
    const ctxBar = document.getElementById("vramChart").getContext("2d");
    vramChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: ['Agri-Agent', 'Grid-Agent', 'Logistics', 'Regulator', 'Base Swarm'],
            datasets: [{
                data: [32, 28, 42, 18, 40.5],
                backgroundColor: [
                    'rgba(56, 189, 248, 0.4)',
                    'rgba(56, 189, 248, 0.4)',
                    'rgba(56, 189, 248, 0.6)',
                    'rgba(56, 189, 248, 0.4)',
                    'rgba(56, 189, 248, 0.7)'
                ],
                borderColor: '#38bdf8',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#9090a0', font: { family: 'Outfit', size: 9 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9090a0', font: { family: 'JetBrains Mono', size: 9 } },
                    suggestedMax: 50
                }
            }
        }
    });

    // 3. Core Temp & Power Level Line Chart (ROCm Details Panel)
    const ctxLine = document.getElementById("tempPowerChart").getContext("2d");
    tempPowerChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: ['10s ago', '8s ago', '6s ago', '4s ago', '2s ago', 'Now'],
            datasets: [
                {
                    label: 'Power Draw (W)',
                    data: [610, 620, 605, 630, 642, 656],
                    borderColor: '#38bdf8',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'yPower'
                },
                {
                    label: 'Core Temp (°C)',
                    data: [72, 73, 72, 74, 75, 75],
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'yTemp'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#9090a0', font: { family: 'Outfit', size: 9 } }
                },
                yPower: {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#38bdf8', font: { family: 'JetBrains Mono', size: 9 } }
                },
                yTemp: {
                    type: 'linear',
                    position: 'right',
                    grid: { display: false },
                    ticks: { color: '#ef4444', font: { family: 'JetBrains Mono', size: 9 } }
                }
            }
        }
    });
}

// ── Fetch & Map Regional Data ──────────────────────────────────
async function fetchRegionData(regionKey) {
    try {
        const response = await fetch(`/analytics/${regionKey}`);
        if (!response.ok) throw new Error("Failed to fetch analytics");

        const data = await response.json();

        // Cache this region's telemetry
        regionsTelemetryCache[regionKey] = data;

        // Rebuild globe pins & uniforms with cached data
        addGlobePins();

        updateUIElements(data, regionKey);
    } catch (error) {
        console.error("Error fetching region data:", error);
    }
}

function updateUIElements(apiData, regionKey) {
    const regionNameEl = document.getElementById("current-region-name");
    if (regionNameEl) regionNameEl.innerText = apiData.region_name;

    const climate = apiData.climate_matrix;
    const telemetry = apiData.telemetry;
    const ledger = apiData.ledger;

    // Update system status classes and texts
    const systemStatusEl = document.getElementById("crop-health-status");
    systemStatusEl.innerText = apiData.system_status.replace("_", " ");

    // Clear status colors
    systemStatusEl.className = "kpi-status";
    if (apiData.system_status === "HEALTHY") {
        systemStatusEl.classList.add("green");
    } else if (apiData.system_status === "ADVISORY") {
        systemStatusEl.classList.add("yellow");
    } else {
        systemStatusEl.classList.add("red");
    }

    // Set crop health KPI score based on real weather data
    // Higher deviation or higher wet bulb degrades health index
    const baseHealth = 0.85;
    const penalty = Math.max(0, climate.deviation_from_baseline_celsius * 0.05) + Math.max(0, (climate.wet_bulb_celsius - 25) * 0.02);
    const healthIndex = Math.max(0.12, baseHealth - penalty).toFixed(2);
    document.getElementById("crop-health-value").innerText = healthIndex;

    // Update Radar Chart Metrics dynamically
    const radarData = [
        Math.max(0.1, 0.85 - (climate.vapor_pressure_deficit_kpa * 0.15)), // Transpiration
        parseFloat(healthIndex),                                           // NDVI Index
        Math.max(0.1, 0.75 - (climate.vapor_pressure_deficit_kpa * 0.12)), // Soil Moisture
        Math.max(0.2, 0.80 - (penalty * 0.5)),                             // Canopy Cover
        Math.max(0.3, 0.90 - (climate.deviation_from_baseline_celsius * 0.03)) // Nitrogen Level
    ];

    if (radarChart) {
        radarChart.data.datasets[0].data = radarData;

        // Update radar stroke/fill colors depending on health index severity
        if (healthIndex > 0.7) {
            radarChart.data.datasets[0].borderColor = '#10b981';
            radarChart.data.datasets[0].backgroundColor = 'rgba(16, 185, 129, 0.2)';
        } else if (healthIndex > 0.5) {
            radarChart.data.datasets[0].borderColor = '#f59e0b';
            radarChart.data.datasets[0].backgroundColor = 'rgba(245, 158, 11, 0.2)';
        } else {
            radarChart.data.datasets[0].borderColor = '#ef4444';
            radarChart.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.2)';
        }

        radarChart.update();
    }

    // Update list details
    const soilMoisturePct = (radarData[2] * 50).toFixed(1);
    const soilStatus = soilMoisturePct > 35 ? "Optimal" : (soilMoisturePct > 20 ? "Adequate" : "Critical Low");
    document.getElementById("soil-moisture-val").innerText = `${soilMoisturePct}% (${soilStatus})`;
    document.getElementById("soil-moisture-val").className = `data-value ${soilMoisturePct < 20 ? 'red' : (soilMoisturePct < 35 ? 'yellow' : 'green')}`;

    // Irrigation demand calculations
    const demandVolume = Math.round(ledger.water_deliverable_m3 / 10000);
    document.getElementById("irrigation-demand-val").innerText = `${demandVolume} m³/hectare`;

    // Disease risk index
    const diseaseRisk = Math.round(telemetry.humidity_percentage * 0.4);
    const riskStatus = diseaseRisk > 30 ? "High" : (diseaseRisk > 15 ? "Medium" : "Low");
    document.getElementById("disease-risk-val").innerText = `${riskStatus} (${diseaseRisk}%)`;
    document.getElementById("disease-risk-val").className = `data-value ${diseaseRisk > 30 ? 'red' : (diseaseRisk > 15 ? 'yellow' : 'green')}`;

    // Water Stress Index
    const waterStressVal = (1.0 - ledger.water_irrigation_efficiency_pct / 100).toFixed(2);
    const stressStatus = waterStressVal > 0.6 ? "Severe" : (waterStressVal > 0.3 ? "Moderate" : "Nominal");
    document.getElementById("water-stress-val").innerText = `${waterStressVal} (${stressStatus})`;
    document.getElementById("water-stress-val").className = `data-value ${waterStressVal > 0.6 ? 'red' : (waterStressVal > 0.3 ? 'yellow' : 'green')}`;

    // AI recommendation text update
    let recommendation = "";
    if (apiData.system_status === "CRITICAL_ANOMALY") {
        recommendation = `CRITICAL WARNING: Temperature exceeded baseline by ${climate.deviation_from_baseline_celsius}°C. High vapor pressure deficit of ${climate.vapor_pressure_deficit_kpa} kPa detected. Immediately switch to sub-surface drip irrigation to prevent evaporative loss.`;
    } else if (apiData.system_status === "WARNING_ANOMALY") {
        recommendation = `ADVISORY: Moderate thermal stress. Soil moisture levels are declining. Shift irrigation schedules to early morning hours to optimize absorption and protect canopy transpiration.`;
    } else {
        recommendation = `SYSTEM NORMAL: Atmospheric conditions match the regional baseline. Maintain standard automated irrigation scheduling and track crop indices.`;
    }
    document.getElementById("ai-recommendation-text").innerText = recommendation;

    // Injected AI assistant recommendation update
    document.getElementById("system-notification-text").innerText = `Weather models processed for ${apiData.region_name}. System status matches ${apiData.system_status} with current temperature at ${telemetry.temperature_celsius}°C. Adjusting domain policies accordingly.`;
}

// ── Interactive UI Event Handlers ──────────────────────────────
// ── Interactive UI Event Handlers ──────────────────────────────
function setupEventListeners() {
    // Left Docker (Toggle left sidebar)
    document.getElementById("toggle-left-dock").addEventListener("click", () => {
        const leftSidebar = document.getElementById("left-sidebar");
        const leftIcon = document.getElementById("left-dock-icon");
        if (leftSidebar.classList.contains("visible")) {
            leftSidebar.classList.remove("visible");
            leftIcon.setAttribute("data-lucide", "chevron-right");
        } else {
            leftSidebar.classList.add("visible");
            leftIcon.setAttribute("data-lucide", "chevron-left");
        }
        lucide.createIcons();
    });

    // Right Docker (Toggle chat sidebar)
    document.getElementById("toggle-right-dock").addEventListener("click", () => {
        const rightSidebar = document.getElementById("right-sidebar");
        const rightIcon = document.getElementById("right-dock-icon");
        if (rightSidebar.classList.contains("visible")) {
            rightSidebar.classList.remove("visible");
            rightIcon.setAttribute("data-lucide", "chevron-left");
        } else {
            rightSidebar.classList.add("visible");
            rightIcon.setAttribute("data-lucide", "chevron-right");
        }
        lucide.createIcons();
    });

    // Refresh Data button
    document.getElementById("refresh-data-btn").addEventListener("click", () => {
        fetchRegionData(activeRegionKey);
    });

    // Panel Closers
    document.getElementById("close-left-panel").addEventListener("click", () => {
        document.getElementById("left-sidebar").classList.remove("visible");
        const leftIcon = document.getElementById("left-dock-icon");
        if (leftIcon) leftIcon.setAttribute("data-lucide", "chevron-right");
        document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
        lucide.createIcons();
    });

    document.getElementById("close-general-panel").addEventListener("click", () => {
        document.getElementById("left-sidebar").classList.remove("visible");
        const leftIcon = document.getElementById("left-dock-icon");
        if (leftIcon) leftIcon.setAttribute("data-lucide", "chevron-right");
        document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
        lucide.createIcons();
    });

    document.getElementById("close-right-panel").addEventListener("click", () => {
        document.getElementById("right-sidebar").classList.remove("visible");
        const rightIcon = document.getElementById("right-dock-icon");
        if (rightIcon) rightIcon.setAttribute("data-lucide", "chevron-left");
        document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
        lucide.createIcons();
    });

    // Bottom Panel Toggle
    document.getElementById("toggle-bottom-panel").addEventListener("click", () => {
        const bottomPanel = document.getElementById("bottom-panel");
        const toggleIcon = document.getElementById("bottom-toggle-icon");
        if (bottomPanel.classList.contains("collapsed")) {
            bottomPanel.classList.remove("collapsed");
            toggleIcon.setAttribute("data-lucide", "chevron-down");
        } else {
            bottomPanel.classList.add("collapsed");
            toggleIcon.setAttribute("data-lucide", "chevron-up");
        }
        lucide.createIcons();
    });

    // Navigation Tab Selection
    const tabs = document.querySelectorAll(".nav-item");
    tabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            const selectedTab = tab.getAttribute("data-tab");
            const isAlreadyActive = tab.classList.contains("active");

            // Toggle specific panels
            if (selectedTab === "agriculture") {
                if (isAlreadyActive) {
                    // Dock: close left sidebar
                    tab.classList.remove("active");
                    document.getElementById("left-sidebar").classList.remove("visible");
                    document.getElementById("left-dock-icon").setAttribute("data-lucide", "chevron-right");
                    lucide.createIcons();
                } else {
                    tabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    document.getElementById("left-sidebar").classList.add("visible");
                    document.getElementById("left-dock-icon").setAttribute("data-lucide", "chevron-left");
                    document.getElementById("agriculture-panel").classList.remove("hidden");
                    document.getElementById("general-info-panel").classList.add("hidden");
                    lucide.createIcons();
                }
            } else if (["region", "physics", "grid", "logistics", "research", "globe-analysis"].includes(selectedTab)) {
                if (isAlreadyActive) {
                    // Dock: close left sidebar
                    tab.classList.remove("active");
                    document.getElementById("left-sidebar").classList.remove("visible");
                    document.getElementById("left-dock-icon").setAttribute("data-lucide", "chevron-right");
                    lucide.createIcons();
                } else {
                    tabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    document.getElementById("left-sidebar").classList.add("visible");
                    document.getElementById("left-dock-icon").setAttribute("data-lucide", "chevron-left");
                    showGeneralInfoPanel(selectedTab);
                    lucide.createIcons();
                }
            } else if (selectedTab === "agents") {
                if (isAlreadyActive) {
                    // Dock: close right sidebar
                    tab.classList.remove("active");
                    document.getElementById("right-sidebar").classList.remove("visible");
                    document.getElementById("right-dock-icon").setAttribute("data-lucide", "chevron-left");
                    lucide.createIcons();
                } else {
                    // Open bottom ROCm panel & chat panel
                    tabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    document.getElementById("right-sidebar").classList.add("visible");
                    document.getElementById("right-dock-icon").setAttribute("data-lucide", "chevron-right");
                    document.getElementById("bottom-panel").classList.remove("collapsed");
                    document.getElementById("bottom-toggle-icon").setAttribute("data-lucide", "chevron-down");
                    lucide.createIcons();
                }
            } else if (selectedTab === "analytics") {
                const bottomPanel = document.getElementById("bottom-panel");
                if (bottomPanel.classList.contains("collapsed")) {
                    bottomPanel.classList.remove("collapsed");
                    document.getElementById("bottom-toggle-icon").setAttribute("data-lucide", "chevron-down");
                    lucide.createIcons();
                } else {
                    bottomPanel.classList.add("collapsed");
                    document.getElementById("bottom-toggle-icon").setAttribute("data-lucide", "chevron-up");
                    lucide.createIcons();
                }
            }
        });
    });

    // Chat Actions
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-chat-btn");
    const clearBtn = document.getElementById("clear-chat");

    sendBtn.addEventListener("click", handleUserMessage);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleUserMessage();
    });

    clearBtn.addEventListener("click", () => {
        const container = document.getElementById("chat-messages-container");
        container.innerHTML = "";
    });
}

// ── General Panel Injector ──────────────────────────────────────
async function showGeneralInfoPanel(tabName) {
    try {
        const response = await fetch(`/analytics/${activeRegionKey}`);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();

        const titleEl = document.getElementById("general-panel-title");
        const contentEl = document.getElementById("general-panel-content");
        const iconEl = document.getElementById("general-panel-icon");

        document.getElementById("agriculture-panel").classList.add("hidden");
        document.getElementById("general-info-panel").classList.remove("hidden");
        document.getElementById("left-sidebar").classList.add("visible");

        let content = "";
        if (tabName === "globe-analysis") {
            titleEl.innerText = "Globe Analysis Layers";
            iconEl.setAttribute("data-lucide", "layers");
            content = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <!-- Heatmap Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Thermographic Heatmap</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Continental surface anomalies</p>
                        </div>
                        <input type="checkbox" id="heatmap-toggle" ${heatmapActive ? 'checked' : ''} onchange="toggleHeatmapLayer()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>

                    <!-- Wind Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Real-time Wind Flow</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Wind direction and speed vectors</p>
                        </div>
                        <input type="checkbox" id="wind-toggle" ${windActive ? 'checked' : ''} onchange="toggleWindLayer()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>

                    <!-- Precipitation Toggle -->
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Precipitation & Rain</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Relative humidity pulse indicators</p>
                        </div>
                        <input type="checkbox" id="rain-toggle" ${precipitationActive ? 'checked' : ''} onchange="togglePrecipitationLayer()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>

                    <!-- Selected Region Active Telemetry -->
                    <div style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Zone Signals</h4>
                        <ul class="data-grid">
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Current Temperature</span>
                                <span class="data-value" style="font-size: 0.8rem;">${data.telemetry.temperature_celsius}°C</span>
                            </li>
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Wind Velocity</span>
                                <span class="data-value" style="font-size: 0.8rem;">${data.telemetry.wind_speed_kmh} km/h @ ${data.telemetry.wind_direction_degrees}°</span>
                            </li>
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Relative Humidity</span>
                                <span class="data-value" style="font-size: 0.8rem;">${data.telemetry.humidity_percentage}%</span>
                            </li>
                        </ul>
                    </div>
                </div>
            `;
        } else if (tabName === "region") {
            titleEl.innerText = "Select Monitoring Region";
            iconEl.setAttribute("data-lucide", "globe");
            content = `
                <div class="region-select-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    ${Object.entries(regionNames).map(([key, name]) => `
                        <button class="region-select-btn ${key === activeRegionKey ? 'active' : ''}" 
                                onclick="selectActiveRegion('${key}')" 
                                style="background: ${key === activeRegionKey ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)'}; 
                                       border: 1px solid ${key === activeRegionKey ? '#38bdf8' : 'var(--border-color)'}; 
                                       color: ${key === activeRegionKey ? 'var(--text-primary)' : 'var(--text-secondary)'}; 
                                       text-align: left; 
                                       padding: 12px 16px; 
                                       border-radius: 8px; 
                                       cursor: pointer; 
                                       font-family: var(--font-ui); 
                                       font-size: 0.85rem; 
                                       font-weight: 500; 
                                       transition: all 0.2s;">
                            ${name}
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (tabName === "physics") {
            titleEl.innerText = "Physics Intelligence";
            iconEl.setAttribute("data-lucide", "thermometer");
            content = `
                <div class="kpi-section">
                    <div class="kpi-header">Vapor Pressure Deficit</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${data.climate_matrix.vapor_pressure_deficit_kpa}</span>
                        <span class="kpi-unit">kPa</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Heat Index</span>
                        <span class="data-value">${data.climate_matrix.heat_index_celsius}°C</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Wet-Bulb Temperature</span>
                        <span class="data-value">${data.climate_matrix.wet_bulb_celsius}°C</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Deviation from Baseline</span>
                        <span class="data-value ${data.climate_matrix.deviation_from_baseline_celsius > 0 ? 'red' : 'green'}">
                            +${data.climate_matrix.deviation_from_baseline_celsius}°C
                        </span>
                    </li>
                </ul>
            `;
        } else if (tabName === "grid") {
            titleEl.innerText = "Power Grid Status";
            iconEl.setAttribute("data-lucide", "zap");
            content = `
                <div class="kpi-section">
                    <div class="kpi-header">Available Capacity</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${data.ledger.grid_available_capacity_mw}</span>
                        <span class="kpi-unit">MW</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Grid Demand Surge</span>
                        <span class="data-value red">+${data.ledger.grid_demand_surge_pct}%</span>
                    </li>
                </ul>
            `;
        } else if (tabName === "logistics") {
            titleEl.innerText = "Logistics Reserves";
            iconEl.setAttribute("data-lucide", "truck");
            content = `
                <div class="kpi-section">
                    <div class="kpi-header">Available Fuel Reserves</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${data.ledger.fuel_available_liters.toLocaleString()}</span>
                        <span class="kpi-unit">Liters</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Thermal Fuel Overhead</span>
                        <span class="data-value red">+${data.ledger.fuel_thermal_overhead_pct}%</span>
                    </li>
                </ul>
            `;
        } else if (tabName === "research") {
            titleEl.innerText = "State Vector & Research";
            iconEl.setAttribute("data-lucide", "microscope");
            content = `
                <div style="font-family: 'JetBrains Mono'; font-size: 0.7rem; white-space: pre-wrap; background: rgba(0,0,0,0.4); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; max-height: 250px; overflow-y: auto; color: #a5f3fc;">
${data.llm_state_vector}
                </div>
            `;
        }

        contentEl.innerHTML = content;
        lucide.createIcons();
    } catch (e) {
        console.error(e);
    }
}

// ── Dynamic ROCm Metric Animations ──────────────────────────────
function animateMetrics() {
    setInterval(() => {
        // Slightly fluctuate parameters for realism
        const cpuVal = (80 + Math.random() * 5).toFixed(1);
        const vramVal = (158 + Math.random() * 4).toFixed(1);
        const speedVal = Math.round(4200 + Math.random() * 200).toLocaleString();
        const latencyVal = (8.0 + Math.random() * 0.8).toFixed(1);
        const powerVal = Math.round(640 + Math.random() * 25);

        document.getElementById("cpu-util-val").innerText = `${cpuVal}%`;
        document.getElementById("vram-usage-val").innerText = `${vramVal} / 192 GB`;
        document.getElementById("inf-speed-val").innerText = `${speedVal} T/s`;
        document.getElementById("latency-val").innerText = `${latencyVal} ms`;
        document.getElementById("power-draw-val").innerText = `${powerVal} W`;

        // Update charts in bottom panel
        if (tempPowerChart) {
            const dataLength = tempPowerChart.data.datasets[0].data.length;
            tempPowerChart.data.datasets[0].data.shift();
            tempPowerChart.data.datasets[0].data.push(powerVal);

            const tempVal = Math.round(73 + Math.random() * 3);
            tempPowerChart.data.datasets[1].data.shift();
            tempPowerChart.data.datasets[1].data.push(tempVal);
            tempPowerChart.update('none');
        }
    }, 2000);
}

// ── Multi-Agent Chat Assistant Interaction ──────────────────────
async function handleUserMessage() {
    const input = document.getElementById("chat-input");
    const container = document.getElementById("chat-messages-container");
    const query = input.value.trim();
    if (!query) return;

    // Add user message
    const userMsg = document.createElement("div");
    userMsg.className = "chat-message user-msg";
    userMsg.innerHTML = `
        <div class="msg-header">
            <span class="user-tag">Operator</span>
            <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="msg-text">${query}</p>
    `;
    container.appendChild(userMsg);
    input.value = "";
    container.scrollTop = container.scrollHeight;

    // Generate Agent swarm simulated reply based on region settings
    try {
        const response = await fetch(`/analytics/${activeRegionKey}`);
        const data = await response.json();

        setTimeout(() => {
            let responseText = "";
            const lowerQuery = query.toLowerCase();

            if (lowerQuery.includes("water") || lowerQuery.includes("irrigation") || lowerQuery.includes("crop")) {
                responseText = `[Agri-Agent]: Delivering priority reports. For ${data.region_name}, overhead irrigation efficiency is at ${data.synthetic_resource_ledger.water_irrigation_efficiency_pct}%. Since vapor pressure deficit is ${data.climate_matrix.vapor_pressure_deficit_kpa} kPa, I recommend deploying ${Math.round(data.synthetic_resource_ledger.water_deliverable_m3 / 10000)} m³/hectare via drip emitters to preserve physical reserves.`;
            } else if (lowerQuery.includes("power") || lowerQuery.includes("grid") || lowerQuery.includes("electricity")) {
                responseText = `[Grid-Agent]: Grid capacity is degraded to ${data.synthetic_resource_ledger.grid_available_capacity_mw} MW due to an thermal load demand surge of +${data.synthetic_resource_ledger.grid_demand_surge_pct}% from air conditioning systems. Directing supply-chain bypass actions.`;
            } else if (lowerQuery.includes("fuel") || lowerQuery.includes("logistics")) {
                responseText = `[Logistics-Agent]: Fuel reserve is holding at ${data.synthetic_resource_ledger.fuel_available_liters.toLocaleString()} Liters. We have recorded an extreme thermal engine cooling and reefer overhead of +${data.synthetic_resource_ledger.fuel_thermal_overhead_pct}%. Suggesting optimized routing paths.`;
            } else {
                responseText = `[Swarm Coordinator]: Analytical vector parsed. Region status is ${data.system_status} (${data.climate_matrix.intensity_level}). Bounded State Vector details loaded into ROCm memory stack. Operator commands can be directed to Agri, Grid, or Logistics.`;
            }

            const agentMsg = document.createElement("div");
            agentMsg.className = "chat-message agent-msg";
            agentMsg.innerHTML = `
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="msg-text">${responseText}</p>
            `;
            container.appendChild(agentMsg);
            lucide.createIcons();
            container.scrollTop = container.scrollHeight;
        }, 800);

    } catch (e) {
        console.error(e);
    }
}

window.selectActiveRegion = (regionKey) => {
    activeRegionKey = regionKey;
    fetchRegionData(regionKey);
    showGeneralInfoPanel('region');
};

window.toggleHeatmapLayer = () => {
    heatmapActive = !heatmapActive;
    if (globe) {
        globe.material = heatmapActive ? heatmapMaterial : standardMaterial;
        globe.material.needsUpdate = true;
    }
};

window.toggleWindLayer = () => {
    windActive = !windActive;
    if (windHelpers && windHelpers.length > 0) {
        windHelpers.forEach(arrow => {
            arrow.visible = windActive;
        });
    }
};

window.togglePrecipitationLayer = () => {
    precipitationActive = !precipitationActive;
    if (rainHelpers && rainHelpers.length > 0) {
        rainHelpers.forEach(ring => {
            ring.visible = precipitationActive;
        });
    }
};

