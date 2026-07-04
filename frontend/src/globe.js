/**
 * globe.js — Three.js Globe module for WIaaS.
 * All globe rendering, shaders, animation, and layer toggles.
 * Uses shared state from state.js, reads/writes via setters.
 */

import {
    regionsList,
    regionsTelemetryCache,
    heatmapActive,
    windActive,
    precipitationActive,
    isRotationPaused,
    activePopupRegionKey,
    globeWindHelpers,
    globeRainHelpers,
    globeHeatmapMaterial,
    globeStandardMaterial,
    globeMesh,
    globePinsGroup,
    setGlobeRefs,
    setWindHelpers,
    setRainHelpers,
    setHeatmapActive,
    setWindActive,
    setPrecipitationActive,
} from './state.js';

// ── Region Geographic Coordinates ────────────────────────────────────────────
const REGION_COORDS = {
    pakistan_punjab:               { lat:  31.17, lon:   72.70 },
    togo_maritime:                 { lat:   6.13, lon:    1.22 },
    france_paris:                  { lat:  48.85, lon:    2.35 },
    spain_andalusia:               { lat:  37.38, lon:   -5.98 },
    germany_bavaria:               { lat:  48.79, lon:   11.49 },
    uk_london:                     { lat:  51.50, lon:   -0.12 },
    italy_sicily:                  { lat:  37.60, lon:   14.01 },
    usa_california_central_valley: { lat:  36.77, lon: -119.41 },
    usa_texas_houston:             { lat:  29.76, lon:  -95.36 },
    brazil_cerrado:                { lat: -14.23, lon:  -51.92 },
    canada_alberta:                { lat:  53.93, lon: -116.57 },
    argentina_pampas:              { lat: -34.60, lon:  -58.38 },
};

// ── GLSL Shaders ─────────────────────────────────────────────────────────────
const GLOBE_VERTEX_SHADER = `
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    void main() {
        vUv = uv;
        vLocalPosition = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

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

// ── Local mutable state (module-private) ─────────────────────────────────────
let _scene, _camera, _renderer, _globe, _pinsGroup;
let _standardMaterial, _heatmapMaterial;
let _windHelpers  = [];
let _rainHelpers  = [];

// ── initGlobe() ──────────────────────────────────────────────────────────────
export function initGlobe() {
    const container = document.getElementById('globe-container');
    const width  = container.clientWidth;
    const height = container.clientHeight;

    _scene  = new THREE.Scene();
    _scene.background = null;
    _camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    _camera.position.z = 4.5;

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _renderer.setSize(width, height);
    _renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(_renderer.domElement);

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(5, 3, 5);
    _scene.add(sunLight);
    _scene.add(new THREE.AmbientLight(0x112233, 0.35));

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
    _heatmapMaterial = new THREE.ShaderMaterial({
        uniforms:       earthUniforms,
        vertexShader:   GLOBE_VERTEX_SHADER,
        fragmentShader: GLOBE_FRAGMENT_SHADER,
        transparent:    true,
        opacity:        0.95,
    });

    // Satellite material
    _standardMaterial = new THREE.MeshPhongMaterial({
        map:         dayTex,
        normalMap:   normalTex,
        normalScale: new THREE.Vector2(0.6, 0.6),
        specularMap: specularTex,
        shininess:   18,
        specular:    new THREE.Color(0x224466),
    });

    // Globe mesh
    _globe = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 64, 64),
        heatmapActive ? _heatmapMaterial : _standardMaterial
    );
    _scene.add(_globe);

    // Cloud layer
    const cloudSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.625, 48, 48),
        new THREE.MeshPhongMaterial({
            map: cloudTex, alphaMap: cloudTex,
            transparent: true, opacity: 0.42, depthWrite: false,
        })
    );
    _scene.add(cloudSphere);
    _globe.userData.cloudSphere = cloudSphere;

    // Atmosphere glow
    _scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(1.68, 48, 48),
        new THREE.ShaderMaterial({
            vertexShader:   ATMOS_VERTEX_SHADER,
            fragmentShader: ATMOS_FRAGMENT_SHADER,
            blending:       THREE.AdditiveBlending,
            side:           THREE.BackSide,
            transparent:    true,
        })
    ));

    // Pins group (attached to globe so it rotates with it)
    _pinsGroup = new THREE.Group();
    _globe.add(_pinsGroup);
    buildGlobePins();

    // Export refs to state
    setGlobeRefs({
        scene:            _scene,
        camera:           _camera,
        renderer:         _renderer,
        globe:            _globe,
        pinsGroup:        _pinsGroup,
        standardMaterial: _standardMaterial,
        heatmapMaterial:  _heatmapMaterial,
    });

    // Drag rotation
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let userRotationOffset    = { x: 0, y: 0 };

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        userRotationOffset.y += (e.clientX - previousMousePosition.x) * 0.005;
        userRotationOffset.x += (e.clientY - previousMousePosition.y) * 0.005;
        userRotationOffset.x  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, userRotationOffset.x));
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Animation loop
    let autoSpinAngle = 0;
    let pulseTime     = 0;

    function animate() {
        requestAnimationFrame(animate);
        pulseTime      += 0.05;
        autoSpinAngle  += 0.0012;
        _globe.rotation.y = autoSpinAngle + userRotationOffset.y;
        _globe.rotation.x = userRotationOffset.x;

        const cs = _globe.userData.cloudSphere;
        if (cs) {
            cs.rotation.y = autoSpinAngle * 1.08 + userRotationOffset.y;
            cs.rotation.x = userRotationOffset.x;
        }

        if (precipitationActive && _rainHelpers.length > 0) {
            _rainHelpers.forEach((ring, idx) => {
                const pulse = 1.0 + Math.abs(Math.sin(pulseTime + idx)) * 0.8;
                ring.scale.set(pulse, pulse, 1);
            });
        }
        if (windActive && _windHelpers.length > 0) {
            _windHelpers.forEach((arrow, idx) => {
                const scale = 0.8 + Math.sin(pulseTime * 1.5 + idx) * 0.2;
                arrow.setLength(0.35 * scale, 0.08 * scale, 0.04 * scale);
            });
        }

        // Popup connector line
        const overlay = document.getElementById('globe-popup-overlay');
        if (isRotationPaused && activePopupRegionKey && overlay && !overlay.classList.contains('hidden')) {
            const coords = REGION_COORDS[activePopupRegionKey];
            if (coords) {
                const phi   = (90 - coords.lat) * (Math.PI / 180);
                const theta = (coords.lon + 180) * (Math.PI / 180);
                const localPos = new THREE.Vector3(
                    -(1.6 * Math.sin(phi) * Math.sin(theta)),
                    1.6 * Math.cos(phi),
                    1.6 * Math.sin(phi) * Math.cos(theta)
                );
                const worldPos = localPos.clone().applyMatrix4(_globe.matrixWorld);
                worldPos.project(_camera);
                const rect    = container.getBoundingClientRect();
                const screenX = (worldPos.x * 0.5 + 0.5) * rect.width;
                const screenY = (-(worldPos.y * 0.5) + 0.5) * rect.height;
                const popupBox = document.getElementById('globe-popup-box');
                const boxX = screenX + 90;
                const boxY = screenY - 80;
                popupBox.style.left = `${boxX}px`;
                popupBox.style.top  = `${boxY}px`;
                const path = document.getElementById('connector-path');
                path.setAttribute('d', `M ${screenX} ${screenY} L ${screenX + 35} ${screenY - 25} L ${boxX} ${boxY + 35}`);
            }
        }

        _renderer.render(_scene, _camera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        _camera.aspect = w / h;
        _camera.updateProjectionMatrix();
        _renderer.setSize(w, h);
    });
}

// ── buildGlobePins() ─────────────────────────────────────────────────────────
export function buildGlobePins() {
    // Clear existing helpers
    _windHelpers.forEach(h => _pinsGroup.remove(h));
    _rainHelpers.forEach(h => _pinsGroup.remove(h));
    _pinsGroup.clear();
    _windHelpers = [];
    _rainHelpers = [];

    const positionsArray = new Float32Array(36); // 12 × 3
    const tempsArray     = new Float32Array(12);

    regionsList.forEach((key, idx) => {
        const cache  = regionsTelemetryCache[key];
        const coords = REGION_COORDS[key];
        if (!coords) return;

        let tempCelsius = 20.0;
        let windSpeed   = 10.0;
        let windDir     = 0.0;
        let humidity    = 50.0;

        if (cache) {
            tempCelsius = cache.telemetry.temperature_celsius;
            windSpeed   = cache.telemetry.wind_speed_kmh;
            windDir     = cache.telemetry.wind_direction_degrees;
            humidity    = cache.telemetry.humidity_percentage;
        }

        const phi   = (90 - coords.lat) * (Math.PI / 180);
        const theta = (coords.lon + 180) * (Math.PI / 180);
        const x = 1.6 * Math.sin(phi) * Math.sin(theta);
        const y = 1.6 * Math.cos(phi);
        const z = 1.6 * Math.sin(phi) * Math.cos(theta);

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
        _pinsGroup.add(arrow);
        _windHelpers.push(arrow);

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
        _pinsGroup.add(rainRing);
        _rainHelpers.push(rainRing);
    });

    if (_heatmapMaterial && _heatmapMaterial.uniforms) {
        _heatmapMaterial.uniforms.regionPos.value  = positionsArray;
        _heatmapMaterial.uniforms.regionTemp.value = tempsArray;
    }

    // Sync back to shared state
    setWindHelpers(_windHelpers);
    setRainHelpers(_rainHelpers);
}

// ── Layer Toggle Exports (called from ui.js) ─────────────────────────────────
export function toggleHeatmap() {
    setHeatmapActive(!heatmapActive);
    if (_globe) {
        _globe.material = heatmapActive ? _heatmapMaterial : _standardMaterial;
        _globe.material.needsUpdate = true;
    }
}

export function toggleWind() {
    setWindActive(!windActive);
    _windHelpers.forEach(a => { a.visible = windActive; });
}

export function togglePrecipitation() {
    setPrecipitationActive(!precipitationActive);
    _rainHelpers.forEach(r => { r.visible = precipitationActive; });
}
