// ════════════════════════════════════════════════════════════════════
//  globe.js — Three.js Globe Module for WIaaS
//  All globe rendering, shaders, animation, and overlay toggles live here.
//  Shared state (activeRegionKey, regionsList, regionsTelemetryCache)
//  is declared in app.js and accessed via the global scope.
// ════════════════════════════════════════════════════════════════════

// ── Region Geographic Coordinates ───────────────────────────────────
const REGION_COORDS = {
    pakistan_punjab:               { lat: 31.17, lon:  72.70 },
    togo_maritime:                 { lat:  6.13, lon:   1.22 },
    france_paris:                  { lat: 48.85, lon:   2.35 },
    spain_andalusia:               { lat: 37.38, lon:  -5.98 },
    germany_bavaria:               { lat: 48.79, lon:  11.49 },
    uk_london:                     { lat: 51.50, lon:  -0.12 },
    italy_sicily:                  { lat: 37.60, lon:  14.01 },
    usa_california_central_valley: { lat: 36.77, lon: -119.41 },
    usa_texas_houston:             { lat: 29.76, lon:  -95.36 },
    brazil_cerrado:                { lat: -14.23, lon: -51.92 },
    canada_alberta:                { lat: 53.93, lon: -116.57 },
    argentina_pampas:              { lat: -34.60, lon: -58.38 },
};

// ── Globe-Specific Globals ───────────────────────────────────────────
let heatmapActive       = true;
let windActive          = false;
let precipitationActive = false;
let standardMaterial    = null;
let heatmapMaterial     = null;
let windHelpers         = [];
let rainHelpers         = [];

// Three.js scene objects
let scene, camera, renderer, globe, pinsGroup;

// ── GLSL: Vertex Shader ──────────────────────────────────────────────
const GLOBE_VERTEX_SHADER = `
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    void main() {
        vUv = uv;
        vLocalPosition = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// ── GLSL: Thermal Heatmap Fragment Shader ────────────────────────────
const GLOBE_FRAGMENT_SHADER = `
    uniform sampler2D specularMap;
    uniform vec3  regionPos[12];
    uniform float regionTemp[12];
    varying vec2  vUv;
    varying vec3  vLocalPosition;

    void main() {
        float spec = texture2D(specularMap, vUv).r;

        if (spec > 0.05) {
            gl_FragColor = vec4(0.04, 0.04, 0.06, 1.0);
        } else {
            vec3  baseLandColor = vec3(0.12, 0.12, 0.15);
            float maxInfluence  = 0.0;
            float targetTemp    = 0.5;

            for (int i = 0; i < 12; i++) {
                vec3  rp   = normalize(regionPos[i]);
                float dist = distance(vLocalPosition, rp);
                if (dist < 0.35) {
                    float influence = (0.35 - dist) / 0.35;
                    influence = influence * influence;
                    if (influence > maxInfluence) {
                        maxInfluence = influence;
                        targetTemp   = regionTemp[i];
                    }
                }
            }

            if (maxInfluence > 0.0) {
                vec3 thermalColor;
                if      (targetTemp < 0.22) thermalColor = mix(vec3(0.00,0.15,0.75), vec3(0.00,0.80,0.75), targetTemp / 0.22);
                else if (targetTemp < 0.45) thermalColor = mix(vec3(0.00,0.80,0.75), vec3(0.00,0.80,0.15), (targetTemp-0.22)/0.23);
                else if (targetTemp < 0.68) thermalColor = mix(vec3(0.00,0.80,0.15), vec3(0.95,0.85,0.00), (targetTemp-0.45)/0.23);
                else if (targetTemp < 0.85) thermalColor = mix(vec3(0.95,0.85,0.00), vec3(0.95,0.42,0.00), (targetTemp-0.68)/0.17);
                else                        thermalColor = mix(vec3(0.95,0.42,0.00), vec3(0.85,0.02,0.02), (targetTemp-0.85)/0.15);
                gl_FragColor = vec4(mix(baseLandColor, thermalColor, maxInfluence), 1.0);
            } else {
                gl_FragColor = vec4(baseLandColor, 1.0);
            }
        }
    }
`;

// ── Atmosphere Glow Shaders ──────────────────────────────────────────
const ATMOS_VERTEX_SHADER = `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const ATMOS_FRAGMENT_SHADER = `
    varying vec3 vNormal;
    void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
        gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * intensity;
    }
`;

// ── lat/lon to 3D Cartesian (r = 1.6 default) ───────────────────────
function latLonToXYZ(lat, lon, r = 1.6) {
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return {
        x:  r * Math.sin(phi) * Math.sin(theta),
        y:  r * Math.cos(phi),
        z:  r * Math.sin(phi) * Math.cos(theta),
    };
}

// ════════════════════════════════════════════════════════════════════
//  initThreeJS()
// ════════════════════════════════════════════════════════════════════
function initThreeJS() {
    const container = document.getElementById("globe-container");
    const width  = container.clientWidth;
    const height = container.clientHeight;

    scene  = new THREE.Scene();
    scene.background = null;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x112233, 0.35));

    // Textures
    const loader      = new THREE.TextureLoader();
    const dayTex      = loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const normalTex   = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg');
    const specularTex = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');
    const cloudTex    = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_2048.png');

    // Heatmap shader material
    const earthUniforms = {
        specularMap: { value: specularTex },
        regionPos:   { value: new Float32Array(36) },
        regionTemp:  { value: new Float32Array(12) },
    };
    heatmapMaterial = new THREE.ShaderMaterial({
        uniforms:       earthUniforms,
        vertexShader:   GLOBE_VERTEX_SHADER,
        fragmentShader: GLOBE_FRAGMENT_SHADER,
        transparent:    true,
        opacity:        0.95,
    });

    // Satellite material
    standardMaterial = new THREE.MeshPhongMaterial({
        map:         dayTex,
        normalMap:   normalTex,
        normalScale: new THREE.Vector2(0.6, 0.6),
        specularMap: specularTex,
        shininess:   18,
        specular:    new THREE.Color(0x224466),
    });

    // Globe mesh
    globe = new THREE.Mesh(new THREE.SphereGeometry(1.6, 64, 64),
                           heatmapActive ? heatmapMaterial : standardMaterial);
    scene.add(globe);

    // Cloud layer
    const cloudSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.625, 48, 48),
        new THREE.MeshPhongMaterial({
            map: cloudTex, alphaMap: cloudTex,
            transparent: true, opacity: 0.42, depthWrite: false,
        })
    );
    scene.add(cloudSphere);
    globe.userData.cloudSphere = cloudSphere;

    // Atmosphere glow
    scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(1.68, 48, 48),
        new THREE.ShaderMaterial({
            vertexShader:   ATMOS_VERTEX_SHADER,
            fragmentShader: ATMOS_FRAGMENT_SHADER,
            blending:       THREE.AdditiveBlending,
            side:           THREE.BackSide,
            transparent:    true,
        })
    ));

    // Pins group
    pinsGroup = new THREE.Group();
    globe.add(pinsGroup);
    addGlobePins();

    // Drag rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let userRotationOffset    = { x: 0, y: 0 };

    container.addEventListener("mousedown", (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        userRotationOffset.y += (e.clientX - previousMousePosition.x) * 0.005;
        userRotationOffset.x += (e.clientY - previousMousePosition.y) * 0.005;
        userRotationOffset.x  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, userRotationOffset.x));
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener("mouseup", () => { isDragging = false; });

    // Animation loop
    let autoSpinAngle = 0;
    let pulseTime     = 0;

    function animate() {
        requestAnimationFrame(animate);
        pulseTime += 0.05;

        autoSpinAngle    += 0.0012;
        globe.rotation.y  = autoSpinAngle + userRotationOffset.y;
        globe.rotation.x  = userRotationOffset.x;

        const cs = globe.userData.cloudSphere;
        if (cs) {
            cs.rotation.y = autoSpinAngle * 1.08 + userRotationOffset.y;
            cs.rotation.x = userRotationOffset.x;
        }

        if (precipitationActive && rainHelpers.length > 0) {
            rainHelpers.forEach((ring, idx) => {
                const pulse = 1.0 + Math.abs(Math.sin(pulseTime + idx)) * 0.8;
                ring.scale.set(pulse, pulse, 1);
            });
        }
        if (windActive && windHelpers.length > 0) {
            windHelpers.forEach((arrow, idx) => {
                const scale = 0.8 + Math.sin(pulseTime * 1.5 + idx) * 0.2;
                arrow.setLength(0.35 * scale, 0.08 * scale, 0.04 * scale);
            });
        }

        renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener("resize", () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}

// ════════════════════════════════════════════════════════════════════
//  addGlobePins()
// ════════════════════════════════════════════════════════════════════
function addGlobePins() {
    windHelpers.forEach(h => pinsGroup.remove(h));
    rainHelpers.forEach(h => pinsGroup.remove(h));
    pinsGroup.clear();
    windHelpers = [];
    rainHelpers = [];

    const positionsArray = new Float32Array(36);
    const tempsArray     = new Float32Array(12);

    regionsList.forEach((key, idx) => {
        const cache  = regionsTelemetryCache[key];
        const coords = REGION_COORDS[key];
        if (!coords) return;

        let tempCelsius = 20.0, windSpeed = 10.0, windDir = 0.0, humidity = 50.0;
        if (cache) {
            tempCelsius = cache.telemetry.temperature_celsius;
            windSpeed   = cache.telemetry.wind_speed_kmh;
            windDir     = cache.telemetry.wind_direction_degrees;
            humidity    = cache.telemetry.humidity_percentage;
        }

        const { x, y, z } = latLonToXYZ(coords.lat, coords.lon);
        positionsArray[idx * 3]     = x;
        positionsArray[idx * 3 + 1] = y;
        positionsArray[idx * 3 + 2] = z;
        tempsArray[idx] = Math.max(0, Math.min(1, (tempCelsius + 5) / 50));

        // Wind arrow
        const origin     = new THREE.Vector3(x, y, z);
        const normal     = origin.clone().normalize();
        const localNorth = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
        const localEast  = normal.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        const windRad    = (windDir * Math.PI) / 180;
        const windDir3   = localNorth.clone()
            .multiplyScalar(Math.cos(windRad))
            .add(localEast.clone().multiplyScalar(Math.sin(windRad)))
            .normalize();
        const arrow = new THREE.ArrowHelper(windDir3, origin,
            0.15 + (windSpeed / 60) * 0.35, 0x38bdf8, 0.08, 0.04);
        arrow.visible = windActive;
        pinsGroup.add(arrow);
        windHelpers.push(arrow);

        // Rain ring
        const rainRing = new THREE.Mesh(
            new THREE.RingGeometry(0.08, 0.11, 16),
            new THREE.MeshBasicMaterial({
                color: 0x00e5ff, side: THREE.DoubleSide,
                transparent: true, opacity: (humidity / 100) * 0.8,
            })
        );
        rainRing.position.set(x, y, z);
        rainRing.lookAt(0, 0, 0);
        rainRing.visible = precipitationActive && humidity > 60;
        pinsGroup.add(rainRing);
        rainHelpers.push(rainRing);
    });

    if (heatmapMaterial && heatmapMaterial.uniforms) {
        heatmapMaterial.uniforms.regionPos.value  = positionsArray;
        heatmapMaterial.uniforms.regionTemp.value = tempsArray;
    }
}

// ════════════════════════════════════════════════════════════════════
//  loadRealTimeGlobeData()
// ════════════════════════════════════════════════════════════════════
async function loadRealTimeGlobeData() {
    await Promise.all(regionsList.map(async (key) => {
        try {
            const res = await fetch(`/analytics/${key}`);
            if (res.ok) regionsTelemetryCache[key] = await res.json();
        } catch (e) {
            console.error(`Globe data fetch failed [${key}]:`, e);
        }
    }));
    addGlobePins();
}

// ════════════════════════════════════════════════════════════════════
//  Layer toggle callbacks (called from HTML onclick attributes)
// ════════════════════════════════════════════════════════════════════
window.toggleHeatmapLayer = () => {
    heatmapActive = !heatmapActive;
    if (globe) {
        globe.material = heatmapActive ? heatmapMaterial : standardMaterial;
        globe.material.needsUpdate = true;
    }
};

window.toggleWindLayer = () => {
    windActive = !windActive;
    windHelpers.forEach(a => { a.visible = windActive; });
};

window.togglePrecipitationLayer = () => {
    precipitationActive = !precipitationActive;
    rainHelpers.forEach(r => { r.visible = precipitationActive; });
};
