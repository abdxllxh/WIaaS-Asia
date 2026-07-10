/**
 * globe.js — Three.js Globe module for WIaaS.
 * All globe rendering, shaders, animation, and layer toggles.
 * Uses shared state from state.js, reads/writes via setters.
 *
 * v2 — design pass:
 *   - Fixed lat/lon → 3D projection (was mismatched with the sphere's own
 *     UV parameterization, which is why cities landed in the wrong place).
 *   - Realistic day/night shader material with a moving terminator line,
 *     ocean specular glint, and city lights on the dark side.
 *   - Scroll-to-zoom (desktop) + pinch-to-zoom (touch), clamped.
 *   - City markers are now small glowing points instead of 3D pin/halo blobs.
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

// Single source of truth for region coordinates — previously this exact
// object was duplicated here AND in globe-coords.js, which is how the two
// copies drift apart when someone edits only one of them.
import { REGION_COORDS } from './globe-coords.js';

// ── Geometry constants ───────────────────────────────────────────────────────
const GLOBE_RADIUS = 1.6;

// ── lat/lon → Vector3 (single source of truth) ──────────────────────────────
// This MUST match THREE.SphereGeometry's own vertex parameterization
// (x = -r·cos(φ)·sin(θ), y = r·cos(θ), z = r·sin(φ)·sin(θ), with
// φ = azimuth = (lon+180)·π/180 and θ = polar = (90-lat)·π/180), otherwise
// anything placed with this helper drifts away from where the day texture
// actually shows that location. The previous version had sin/cos swapped
// between the two horizontal terms, which is exactly why cities were
// showing up rotated ~90° away from their real coordinates.
function latLonToVector3(lat, lon, radius = GLOBE_RADIUS) {
    const polar   = (90 - lat) * (Math.PI / 180);
    const azimuth = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.cos(azimuth) * Math.sin(polar),
         radius * Math.cos(polar),
         radius * Math.sin(azimuth) * Math.sin(polar)
    );
}

// ── GLSL Shaders ─────────────────────────────────────────────────────────────

// Heatmap overlay (unchanged logic, still fed by the corrected regionPos array)
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

// Realistic satellite material: blends a lit "day" texture with a "night
// lights" texture across a soft terminator line driven by a world-space sun
// direction, plus a cheap specular glint over oceans near the sub-solar point.
const EARTH_VERTEX_SHADER = `
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const EARTH_FRAGMENT_SHADER = `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D specularMap;
    uniform vec3      sunDirection;
    varying vec2      vUv;
    varying vec3      vNormalW;

    void main() {
        vec3  normal  = normalize(vNormalW);
        float sunDot  = dot(normal, normalize(sunDirection));
        float dayMix  = smoothstep(-0.18, 0.15, sunDot);

        vec3  dayColor   = texture2D(dayTexture, vUv).rgb;
        vec3  nightColor = texture2D(nightTexture, vUv).rgb * 1.6;
        float waterMask  = texture2D(specularMap, vUv).r;

        // Soft ocean glint near the sub-solar point, lit side only.
        float glint = pow(max(sunDot, 0.0), 24.0) * waterMask * 0.85;

        vec3 litSide  = dayColor + vec3(glint);
        vec3 color    = mix(nightColor, litSide, dayMix);

        gl_FragColor = vec4(color, 1.0);
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
let _cityMarkers  = [];
let _starfield1, _starfield2;
let _zoomDistance = 4.5;

const MIN_ZOOM = 2.3;
const MAX_ZOOM = 8.5;

// ── Small helper: canvas-generated radial glow texture for point markers ────
function createDotTexture(rgb) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = canvas.width / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0.0,  `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.22, `rgba(${rgb}, 0.95)`);
    gradient.addColorStop(0.55, `rgba(${rgb}, 0.28)`);
    gradient.addColorStop(1.0,  `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// ── Helper: generate a starfield points mesh ─────────────────────────────────
function createStarfield(count, minRadius, maxRadius, color, size) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = minRadius + Math.random() * (maxRadius - minRadius);
        
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const texture = createDotTexture('255, 255, 255');
    const material = new THREE.PointsMaterial({
        color: color,
        size: size,
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    
    return new THREE.Points(geometry, material);
}

// ── initGlobe() ──────────────────────────────────────────────────────────────
export function initGlobe() {
    const container = document.getElementById('globe-container');
    const width  = container.clientWidth;
    const height = container.clientHeight;

    _scene  = new THREE.Scene();
    _scene.background = null;
    _camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    _camera.position.z = _zoomDistance;

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _renderer.setSize(width, height);
    _renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(_renderer.domElement);
    container.style.cursor = 'grab';

    // Lighting — position doubles as our shader's sun direction, so the
    // day/night terminator on the custom material and the highlight from
    // this light always agree with each other.
    const sunPosition = new THREE.Vector3(5, 3, 5);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.copy(sunPosition);
    _scene.add(sunLight);
    _scene.add(new THREE.AmbientLight(0x112233, 0.35));

    // Textures — day/night/specular from three-globe's asset set (reliable,
    // production-used imagery), clouds + normal detail from three.js's own
    // example textures.
    const loader        = new THREE.TextureLoader();
    const dayTex        = loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
    const nightTex      = loader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg');
    const waterMaskTex  = loader.load('https://unpkg.com/three-globe/example/img/earth-water.png');
    const cloudTex      = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');

    // Heatmap shader material
    const earthUniforms = {
        specularMap: { value: waterMaskTex },
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

    // Realistic day/night satellite material
    _standardMaterial = new THREE.ShaderMaterial({
        uniforms: {
            dayTexture:   { value: dayTex },
            nightTexture: { value: nightTex },
            specularMap:  { value: waterMaskTex },
            sunDirection: { value: sunPosition.clone().normalize() },
        },
        vertexShader:   EARTH_VERTEX_SHADER,
        fragmentShader: EARTH_FRAGMENT_SHADER,
    });

    // Globe mesh — bumped segment count so the silhouette stays smooth at
    // the new closer zoom levels.
    _globe = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96),
        heatmapActive ? _heatmapMaterial : _standardMaterial
    );
    _scene.add(_globe);

    // Cloud layer
    const cloudSphere = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 1.016, 64, 64),
        new THREE.MeshPhongMaterial({
            map: cloudTex, alphaMap: cloudTex,
            transparent: true, opacity: 0.38, depthWrite: false,
        })
    );
    _scene.add(cloudSphere);
    _globe.userData.cloudSphere = cloudSphere;

    // Atmosphere glow
    _scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 1.05, 64, 64),
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

    // Starfield background layers for parallax depth
    _starfield1 = createStarfield(400, 15, 30, 0x7dd3fc, 0.16); // Closer, cyan stars
    _starfield2 = createStarfield(800, 35, 60, 0xffffff, 0.08); // Farther, white stars
    _scene.add(_starfield1);
    _scene.add(_starfield2);

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

    // ── Drag rotation (mouse) ────────────────────────────────────────────
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let userRotationOffset    = { x: 0, y: 0 };

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        userRotationOffset.y += (e.clientX - previousMousePosition.x) * 0.005;
        userRotationOffset.x += (e.clientY - previousMousePosition.y) * 0.005;
        userRotationOffset.x  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, userRotationOffset.x));
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'grab';
    });

    // ── Scroll-to-zoom (desktop) ─────────────────────────────────────────
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        // Scale the zoom step by current distance so it feels consistent
        // whether you're far out or already close in.
        _zoomDistance += e.deltaY * 0.0022 * _zoomDistance;
        _zoomDistance  = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, _zoomDistance));
        _camera.position.z = _zoomDistance;
    }, { passive: false });

    // ── Touch: one-finger drag to rotate, two-finger pinch to zoom ───────
    let pinchStartDist = null;
    let pinchStartZoom = _zoomDistance;

    function touchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            pinchStartDist = touchDistance(e.touches);
            pinchStartZoom = _zoomDistance;
        } else if (e.touches.length === 1) {
            isDragging = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStartDist) {
            const newDist = touchDistance(e.touches);
            const scale   = pinchStartDist / newDist;
            _zoomDistance = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom * scale));
            _camera.position.z = _zoomDistance;
        } else if (e.touches.length === 1 && isDragging) {
            const t = e.touches[0];
            userRotationOffset.y += (t.clientX - previousMousePosition.x) * 0.005;
            userRotationOffset.x += (t.clientY - previousMousePosition.y) * 0.005;
            userRotationOffset.x  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, userRotationOffset.x));
            previousMousePosition = { x: t.clientX, y: t.clientY };
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        isDragging = false;
        pinchStartDist = null;
    });

    // ── Animation loop ───────────────────────────────────────────────────
    let autoSpinAngle = 0;
    let pulseTime     = 0;

    function animate() {
        requestAnimationFrame(animate);
        if (document.hidden) return; // Skip rendering and updates when the tab is backgrounded
        pulseTime      += 0.05;
        autoSpinAngle  += 0.0012;
        _globe.rotation.y = autoSpinAngle + userRotationOffset.y;
        _globe.rotation.x = userRotationOffset.x;

        const cs = _globe.userData.cloudSphere;
        if (cs) {
            cs.rotation.y = autoSpinAngle * 1.08 + userRotationOffset.y;
            cs.rotation.x = userRotationOffset.x;
        }

        // Parallax starfield rotations
        if (_starfield1) {
            _starfield1.rotation.y = autoSpinAngle * 0.08 + userRotationOffset.y * 0.12;
            _starfield1.rotation.x = userRotationOffset.x * 0.12;
        }
        if (_starfield2) {
            _starfield2.rotation.y = autoSpinAngle * 0.02 + userRotationOffset.y * 0.04;
            _starfield2.rotation.x = userRotationOffset.x * 0.04;
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

        // Gentle pulse on the city point markers so they read as "live" data.
        if (_cityMarkers.length > 0) {
            _cityMarkers.forEach((marker, idx) => {
                const pulse = 1.0 + Math.sin(pulseTime * 2 + idx * 1.3) * 0.18;
                marker.scale.set(marker.userData.baseScale * pulse, marker.userData.baseScale * pulse, 1);
            });
        }

        // Popup connector line
        const overlay = document.getElementById('globe-popup-overlay');
        if (isRotationPaused && activePopupRegionKey && overlay && !overlay.classList.contains('hidden')) {
            const coords = REGION_COORDS[activePopupRegionKey];
            if (coords) {
                const localPos = latLonToVector3(coords.lat, coords.lon, GLOBE_RADIUS);
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
export async function buildGlobePins(cities = []) {
    // Clear existing helpers
    _windHelpers.forEach(h => _pinsGroup.remove(h));
    _rainHelpers.forEach(h => _pinsGroup.remove(h));
    _pinsGroup.clear();
    _windHelpers = [];
    _rainHelpers = [];
    _cityMarkers = [];

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

        const pos = latLonToVector3(coords.lat, coords.lon, GLOBE_RADIUS);
        positionsArray[idx * 3]     = pos.x;
        positionsArray[idx * 3 + 1] = pos.y;
        positionsArray[idx * 3 + 2] = pos.z;
        tempsArray[idx] = Math.max(0, Math.min(1, (tempCelsius + 5) / 50));

        // Wind arrow
        const normal     = pos.clone().normalize();
        const localNorth = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
        const localEast  = normal.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        const windRad    = (windDir * Math.PI) / 180;
        const windDir3   = localNorth.clone()
            .multiplyScalar(Math.cos(windRad))
            .add(localEast.clone().multiplyScalar(Math.sin(windRad)))
            .normalize();
        const arrow = new THREE.ArrowHelper(windDir3, pos,
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
        rainRing.position.copy(pos);
        rainRing.lookAt(0, 0, 0);
        rainRing.visible = precipitationActive && humidity > 60;
        _pinsGroup.add(rainRing);
        _rainHelpers.push(rainRing);
    });

    // Add dynamic city pins if provided — rendered as small glowing points
    // rather than 3D pin/halo shapes, sitting just above the surface.
    if (cities && cities.length > 0) {
        cities.forEach((city, idx) => {
            const marker = createCityPointMarker(city, idx);
            _pinsGroup.add(marker);
            _cityMarkers.push(marker);
        });
    }

    if (_heatmapMaterial && _heatmapMaterial.uniforms) {
        _heatmapMaterial.uniforms.regionPos.value  = positionsArray;
        _heatmapMaterial.uniforms.regionTemp.value = tempsArray;
    }

    // Sync back to shared state
    setWindHelpers(_windHelpers);
    setRainHelpers(_rainHelpers);
}

/**
 * Create a small glowing point marker for a city, billboarded to always
 * face the camera (a Sprite), instead of the old 3D flattened-sphere pin.
 * @param {Object} city - City object with latitude, longitude, name
 * @param {number} idx - Index for color cycling
 * @returns {THREE.Sprite}
 */
function createCityPointMarker(city, idx) {
    const colors = [
        '255, 107, 107', // red
        '78, 205, 196',  // teal
        '255, 230, 109', // yellow
        '149, 225, 211', // mint
        '255, 138, 163', // pink
        '133, 220, 176', // green
    ];
    const rgb = colors[idx % colors.length];

    const material = new THREE.SpriteMaterial({
        map: createDotTexture(rgb),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const marker = new THREE.Sprite(material);

    const baseScale = 0.11;
    marker.scale.set(baseScale, baseScale, 1);
    marker.position.copy(latLonToVector3(city.latitude, city.longitude, GLOBE_RADIUS * 1.008));
    marker.userData = { city, baseScale, createdAt: Date.now() };

    return marker;
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