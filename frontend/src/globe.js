/**
 * globe.js — Three.js Globe module for WIaaS.
 * All globe rendering, satellite shaders, 3-state FSM animation, and layer toggles.
 *
 * States:
 *   - IDLE_ROTATION: Continuous slow rotation on initial startup or after Reset Globe.
 *   - FLY_TO_TARGET: Cinematic spherical interpolation to target coordinate.
 *   - FOCUSED: Globe is 100% stationary; selected region remains centered for study.
 */

import * as THREE from 'three';

import {
    regionsList,
    regionsRegistry,
    activeRegionKey,
    getActiveRegion,
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

import { REGION_COORDS } from './globe-coords.js';

// ── Geometry & Camera Distance Constants ─────────────────────────────────────
export const GLOBE_RADIUS = 1.35;
// Deep globe-only city navigation: the camera remains outside the atmosphere
// while getting close enough to frame the selected metropolitan area.
export const MIN_CAMERA_DISTANCE = 1.370;
export const MAX_CAMERA_DISTANCE = 7.50; // Hard ceiling: maximum zoomed out distance

export const ZOOM_LEVELS = {
    overview:  4.80,
    continent: 4.20,
    country:   3.65,
    region:    3.30,
    cityRegion: 2.24,
    cityApproach: 1.374,
};

export function clampCameraDistance(distance) {
    return THREE.MathUtils.clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
}

// ── 3-State FSM Definition ───────────────────────────────────────────────────
export const GLOBE_STATES = {
    GLOBAL_IDLE:   'GLOBAL_IDLE',
    IDLE_ROTATION: 'GLOBAL_IDLE',
    FLYING:        'FLYING',
    FLY_TO_TARGET: 'FLYING',
    FOCUSED:       'FOCUSED',
};

const IDLE_ROTATION_SPEED = 0.0005;

// ── lat/lon → Vector3 (Spherical UV Alignment) ──────────────────────────────
// In Three.js SphereGeometry:
// polar   = (90 - lat) * (pi / 180)
// azimuth = (lon + 180) * (pi / 180)
// x = -r * cos(azimuth) * sin(polar)
// y =  r * cos(polar)
// z =  r * sin(azimuth) * sin(polar)
export function latLonToVector3(lat, lon, radius = GLOBE_RADIUS) {
    const polar   = (90 - lat) * (Math.PI / 180);
    const azimuth = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.cos(azimuth) * Math.sin(polar),
         radius * Math.cos(polar),
         radius * Math.sin(azimuth) * Math.sin(polar)
    );
}

const CITY_DETAIL_ZOOM = 11;
const CITY_DETAIL_TILE_COUNT = 7;
const CITY_DETAIL_TILE_SIZE = 256;
const CITY_IMAGERY_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function longitudeToTileX(longitude, zoom) {
    return Math.floor(((longitude + 180) / 360) * (2 ** zoom));
}

function latitudeToTileY(latitude, zoom) {
    const latRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(latitude, -85.0511, 85.0511));
    return Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) * (2 ** (zoom - 1)));
}

function tileXToLongitude(tileX, zoom) {
    return (tileX / (2 ** zoom)) * 360 - 180;
}

function tileYToLatitude(tileY, zoom) {
    return THREE.MathUtils.radToDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / (2 ** zoom)))));
}

function createCurvedCityPatch(west, east, south, north, texture) {
    const segments = 56;
    const positions = [];
    const uvs = [];
    const indices = [];
    const patchRadius = GLOBE_RADIUS * 1.011;

    for (let row = 0; row <= segments; row += 1) {
        const v = row / segments;
        const latitude = THREE.MathUtils.lerp(south, north, v);
        for (let column = 0; column <= segments; column += 1) {
            const u = column / segments;
            const longitude = THREE.MathUtils.lerp(west, east, u);
            const point = latLonToVector3(latitude, longitude, patchRadius);
            positions.push(point.x, point.y, point.z);
            uvs.push(u, v);
        }
    }

    for (let row = 0; row < segments; row += 1) {
        for (let column = 0; column < segments; column += 1) {
            const a = row * (segments + 1) + column;
            const b = a + segments + 1;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.ShaderMaterial({
        uniforms: { cityTexture: { value: texture } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D cityTexture;
            varying vec2 vUv;
            void main() {
                vec4 detail = texture2D(cityTexture, vUv);
                float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
                detail.a *= smoothstep(0.0, 0.045, edge);
                gl_FragColor = detail;
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 4;
    mesh.userData.cityDetailSurface = true;
    return mesh;
}

function loadCrossOriginImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

function removeCityDetailAttribution() {
    _cityDetailAttribution?.remove();
    _cityDetailAttribution = null;
}

export function clearCityDetailSurface() {
    _cityDetailLoadId += 1;
    if (_cityDetailMesh && _globe) {
        _globe.remove(_cityDetailMesh);
        _cityDetailMesh.geometry?.dispose();
        _cityDetailMesh.material?.uniforms?.cityTexture?.value?.dispose();
        _cityDetailMesh.material?.dispose();
    }
    _cityDetailMesh = null;
    removeCityDetailAttribution();
    if (_globe?.userData?.cloudSphere?.material) {
        _globe.userData.cloudSphere.material.opacity = 0.22;
        _globe.userData.cloudSphere.visible = true;
    }
    syncCanvasGeographicState({ cityDetail: 'inactive' });
}

export async function prepareCityDetailSurface(latitude, longitude, options = {}) {
    if (!_globe || !_renderer) return { loaded: false };

    clearCityDetailSurface();
    const loadId = _cityDetailLoadId;
    syncCanvasGeographicState({ cityDetail: 'loading' });

    const zoom = CITY_DETAIL_ZOOM;
    const tileCount = CITY_DETAIL_TILE_COUNT;
    const half = Math.floor(tileCount / 2);
    const centerX = longitudeToTileX(longitude, zoom);
    const centerY = latitudeToTileY(latitude, zoom);
    const startX = centerX - half;
    const startY = centerY - half;
    const tileLimit = 2 ** zoom;
    const canvas = document.createElement('canvas');
    canvas.width = tileCount * CITY_DETAIL_TILE_SIZE;
    canvas.height = tileCount * CITY_DETAIL_TILE_SIZE;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#132033';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const requests = [];
    for (let row = 0; row < tileCount; row += 1) {
        for (let column = 0; column < tileCount; column += 1) {
            const tileX = (startX + column + tileLimit) % tileLimit;
            const tileY = THREE.MathUtils.clamp(startY + row, 0, tileLimit - 1);
            const url = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`;
            requests.push(
                loadCrossOriginImage(url).then((image) => {
                    context.drawImage(
                        image,
                        column * CITY_DETAIL_TILE_SIZE,
                        row * CITY_DETAIL_TILE_SIZE,
                        CITY_DETAIL_TILE_SIZE,
                        CITY_DETAIL_TILE_SIZE,
                    );
                    return true;
                }).catch(() => false),
            );
        }
    }

    const results = await Promise.all(requests);
    if (loadId !== _cityDetailLoadId || !_globe) return { loaded: false, cancelled: true };
    const loadedTiles = results.filter(Boolean).length;
    if (loadedTiles < Math.ceil(requests.length * 0.6)) {
        syncCanvasGeographicState({ cityDetail: 'fallback' });
        return { loaded: false, loadedTiles };
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = _renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    const west = tileXToLongitude(startX, zoom);
    const east = tileXToLongitude(startX + tileCount, zoom);
    const north = tileYToLatitude(startY, zoom);
    const south = tileYToLatitude(startY + tileCount, zoom);
    _cityDetailMesh = createCurvedCityPatch(west, east, south, north, texture);
    _globe.add(_cityDetailMesh);
    if (_globe.userData?.cloudSphere?.material) {
        _globe.userData.cloudSphere.visible = false;
    }

    const container = document.getElementById('globe-container');
    if (container) {
        _cityDetailAttribution = document.createElement('div');
        _cityDetailAttribution.className = 'city-imagery-attribution';
        _cityDetailAttribution.textContent = `${options.name || 'City'} detail · ${CITY_IMAGERY_ATTRIBUTION}`;
        container.appendChild(_cityDetailAttribution);
    }
    syncCanvasGeographicState({ cityDetail: 'ready', cityDetailTiles: loadedTiles });
    return { loaded: true, loadedTiles };
}

// ── GLSL Shaders ─────────────────────────────────────────────────────────────

// Heatmap shader overlay (for thermal stress / heatwave analysis)
const GLOBE_VERTEX_SHADER = `
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    varying vec3 vNormalW;
    void main() {
        vUv = uv;
        vLocalPosition = normalize(position);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const GLOBE_FRAGMENT_SHADER = `
    uniform sampler2D dayTexture;
    uniform sampler2D specularMap;
    uniform vec3      regionPos[12];
    uniform float     regionTemp[12];
    uniform float     uZoom;
    varying vec2      vUv;
    varying vec3      vLocalPosition;
    varying vec3      vNormalW;

    void main() {
        vec3  dayColor  = texture2D(dayTexture, vUv).rgb;
        float waterMask = texture2D(specularMap, vUv).r;

        vec3  baseColor = mix(dayColor * 0.85, vec3(0.03, 0.07, 0.16), waterMask * 0.4);
        float maxInfluence = 0.0;
        float targetTemp   = 0.5;

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
            if      (targetTemp < 0.22) thermalColor = mix(vec3(0.00,0.25,0.95), vec3(0.00,0.85,0.85), targetTemp / 0.22);
            else if (targetTemp < 0.45) thermalColor = mix(vec3(0.00,0.85,0.85), vec3(0.00,0.90,0.20), (targetTemp-0.22)/0.23);
            else if (targetTemp < 0.68) thermalColor = mix(vec3(0.00,0.90,0.20), vec3(0.98,0.88,0.00), (targetTemp-0.45)/0.23);
            else if (targetTemp < 0.85) thermalColor = mix(vec3(0.98,0.88,0.00), vec3(0.98,0.40,0.00), (targetTemp-0.68)/0.17);
            else                        thermalColor = mix(vec3(0.98,0.40,0.00), vec3(0.95,0.05,0.05), (targetTemp-0.85)/0.15);
            gl_FragColor = vec4(mix(baseColor, thermalColor, maxInfluence * 0.65), 1.0);
        } else {
            gl_FragColor = vec4(baseColor, 1.0);
        }
    }
`;

// Realistic Day/Night Satellite Shader with High Ambient Geographic Readability
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
    uniform sampler2D normalMap;
    uniform vec3      sunDirection;
    varying vec2      vUv;
    varying vec3      vNormalW;

    void main() {
        vec3  normal  = normalize(vNormalW);
        vec3  sunDir  = normalize(sunDirection);
        float sunDot  = dot(normal, sunDir);

        // Smooth transition over twilight zone
        float dayMix  = smoothstep(-0.25, 0.25, sunDot);

        vec3  dayColor    = texture2D(dayTexture, vUv).rgb;
        vec3  nightLights = texture2D(nightTexture, vUv).rgb;
        float waterMask   = texture2D(specularMap, vUv).r;

        // Preserve coastlines and terrain on the night side without flattening the terminator.
        vec3  nightBase   = dayColor * 0.20 + nightLights * 1.18;

        // Specular glint on ocean surfaces on the lit side
        float glint   = pow(max(sunDot, 0.0), 32.0) * waterMask * 0.6;
        vec3  litSide = dayColor + vec3(glint);

        vec3  color = mix(nightBase, litSide, dayMix);

        // Subtle atmospheric cyan horizon rim glow
        float rim = 1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
        color += vec3(0.025, 0.10, 0.20) * pow(rim, 4.2);

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
        float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.3);
        gl_FragColor = vec4(0.16, 0.52, 0.92, 0.48) * intensity;
    }
`;

// ── Module Variables ────────────────────────────────────────────────────────
let _scene, _camera, _renderer, _globe, _pinsGroup;
let _standardMaterial, _heatmapMaterial;
let _windHelpers  = [];
let _rainHelpers  = [];
let _cityMarkers  = [];
let _cityDetailMesh = null;
let _cityDetailLoadId = 0;
let _cityDetailAttribution = null;
let _starfield1, _starfield2;
let _zoomDistance = ZOOM_LEVELS.overview; // Initial startup overview distance (4.80)

let _globeState = GLOBE_STATES.IDLE_ROTATION;
let _hasUserSelectedRegion = false;
let _flyToGeneration = 0;
let _flyToAnimation  = null;
let _activeFlyResolve = null;
let _idleResumeTimer = null;
let _currentTargetName = 'Overview';
let _currentTargetLat  = null;
let _currentTargetLon  = null;
let _prefersReducedMotion = false;
const _markerTextureCache = new Map();

export function getGlobeState() {
    return _globeState;
}

export function hasUserSelectedRegion() {
    return _hasUserSelectedRegion;
}

function cancelFlyAnimation() {
    if (_flyToAnimation) {
        cancelAnimationFrame(_flyToAnimation);
        _flyToAnimation = null;
    }
    if (_activeFlyResolve) {
        _activeFlyResolve({ cancelled: true });
        _activeFlyResolve = null;
    }
}

// ── Point Marker Texture Generators (Crisp Precise Dots) ────────────────────
function createCrispDotTexture(rgb) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    // Solid inner core
    ctx.beginPath();
    ctx.arc(c, c, 18, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fill();

    // Soft outer halo ring
    const gradient = ctx.createRadialGradient(c, c, 14, c, c, 46);
    gradient.addColorStop(0.0, `rgba(${rgb}, 0.85)`);
    gradient.addColorStop(0.35, `rgba(${rgb}, 0.30)`);
    gradient.addColorStop(1.0, `rgba(${rgb}, 0)`);
    ctx.beginPath();
    ctx.arc(c, c, 46, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

function getMarkerTexture(rgb) {
    if (!_markerTextureCache.has(rgb)) {
        _markerTextureCache.set(rgb, createCrispDotTexture(rgb));
    }
    return _markerTextureCache.get(rgb);
}

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
    const texture = createCrispDotTexture('255, 255, 255');
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
    if (!container) return;
    const width  = container.clientWidth;
    const height = container.clientHeight;

    _scene  = new THREE.Scene();
    _scene.background = null;

    // Near 0.1, far 100 for maximum depth buffer precision
    _camera = new THREE.PerspectiveCamera(45, width / height, 0.0025, 100);
    _zoomDistance = clampCameraDistance(ZOOM_LEVELS.overview);
    _camera.position.set(0, 0, _zoomDistance);

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    _renderer.setSize(width, height);
    const maxDpr = window.innerWidth < 900 || (navigator.deviceMemory || 4) <= 4 ? 1.15 : 1.5;
    _renderer.setPixelRatio(Math.min(maxDpr, window.devicePixelRatio));
    _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.05;
    container.appendChild(_renderer.domElement);
    _renderer.domElement.setAttribute('role', 'img');
    _renderer.domElement.setAttribute(
        'aria-label',
        'Interactive high-definition 3D Earth. Drag to rotate, scroll to zoom, or choose a region to navigate.',
    );
    syncCanvasGeographicState({ targetCentered: false });
    container.style.cursor = 'grab';

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    _prefersReducedMotion = motionQuery.matches;
    motionQuery.addEventListener('change', (event) => {
        _prefersReducedMotion = event.matches;
    });

    // Lighting
    const sunPosition = new THREE.Vector3(5, 3, 5);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
    sunLight.position.copy(sunPosition);
    _scene.add(sunLight);
    _scene.add(new THREE.HemisphereLight(0xb9dcff, 0x080b12, 0.42));
    _scene.add(new THREE.AmbientLight(0x26384f, 0.34));

    const maxAnisotropy = _renderer.capabilities ? _renderer.capabilities.getMaxAnisotropy() : 16;

    function configureTexture(tex, { srgb = false } = {}) {
        if (!tex) return;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = maxAnisotropy;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
    }

    // Prefer the locally bundled 8K day map only on capable desktop GPUs.
    const loader = new THREE.TextureLoader();
    const deviceMemory = navigator.deviceMemory || 4;
    const use8kDay = maxAnisotropy >= 8
        && _renderer.capabilities.maxTextureSize >= 8192
        && deviceMemory >= 4
        && window.innerWidth >= 1024;
    const dayTexturePath = use8kDay ? '/textures/earth_day_8k.jpg' : '/textures/earth_day_4k.jpg';
    const dayTex = loader.load(dayTexturePath, (t) => {
        configureTexture(t, { srgb: true });
        console.log(`[WIaaS Globe] ${dayTexturePath} loaded successfully`);
    }, undefined, (err) => {
        console.error(`[WIaaS Globe] ${dayTexturePath} failed to load:`, err);
    });

    const nightTex = loader.load('/textures/earth_night_4k_hq.jpg', (t) => {
        configureTexture(t, { srgb: true });
        console.log('[WIaaS Globe] earth_night_4k_hq loaded successfully');
    });

    const waterMaskTex = loader.load('/textures/earth_specular_4k.jpg', (t) => configureTexture(t));
    const normalTex    = loader.load('/textures/earth_normal_4k.jpg', (t) => configureTexture(t));
    const cloudTex     = loader.load('/textures/earth_clouds_4k.jpg', (t) => configureTexture(t));

    // Heatmap shader material
    const earthUniforms = {
        dayTexture:  { value: dayTex },
        specularMap: { value: waterMaskTex },
        regionPos:   { value: new Float32Array(36) },
        regionTemp:  { value: new Float32Array(12) },
    };
    _heatmapMaterial = new THREE.ShaderMaterial({
        uniforms:       earthUniforms,
        vertexShader:   GLOBE_VERTEX_SHADER,
        fragmentShader: GLOBE_FRAGMENT_SHADER,
        transparent:    false,
    });

    // Realistic day/night satellite material
    _standardMaterial = new THREE.ShaderMaterial({
        uniforms: {
            dayTexture:   { value: dayTex },
            nightTexture: { value: nightTex },
            specularMap:  { value: waterMaskTex },
            normalMap:    { value: normalTex },
            sunDirection: { value: sunPosition.clone().normalize() },
        },
        vertexShader:   EARTH_VERTEX_SHADER,
        fragmentShader: EARTH_FRAGMENT_SHADER,
        transparent:    false,
    });

    // Globe Mesh with YXZ Euler Rotation Order
    const globeSegments = window.innerWidth < 900 ? 64 : 96;
    _globe = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, globeSegments, globeSegments),
        heatmapActive ? _heatmapMaterial : _standardMaterial
    );
    _globe.rotation.order = 'YXZ';
    _globe.rotation.x = (15 * Math.PI) / 180; // 15° polar inclination for overview
    _scene.add(_globe);

    // Cloud Layer attached directly as child of _globe so it stays in exact rotation sync
    const cloudSphere = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 1.010, 64, 64),
        new THREE.MeshPhongMaterial({
            map: cloudTex,
            alphaMap: cloudTex,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            side: THREE.FrontSide,
        })
    );
    _globe.add(cloudSphere);
    _globe.userData.cloudSphere = cloudSphere;

    // Atmosphere rim glow
    const atmosMesh = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 48, 48),
        new THREE.ShaderMaterial({
            vertexShader:   ATMOS_VERTEX_SHADER,
            fragmentShader: ATMOS_FRAGMENT_SHADER,
            blending:       THREE.AdditiveBlending,
            side:           THREE.BackSide,
            transparent:    true,
            depthWrite:     false,
        })
    );
    _scene.add(atmosMesh);

    // Pins group attached to globe
    _pinsGroup = new THREE.Group();
    _globe.add(_pinsGroup);
    buildGlobePins();

    // Starfield parallax
    _starfield1 = createStarfield(350, 15, 30, 0x7dd3fc, 0.14);
    _starfield2 = createStarfield(700, 35, 60, 0xffffff, 0.08);
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

    if (new URLSearchParams(window.location.search).has('globeDebug')) {
        injectDebugOverlay(container);
    }

    // ── Mouse & Touch Manual Interaction ─────────────────────────────────────
    let isDragging = false;
    let pointerMoved = false;
    let previousPointerPos = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function markerAt(clientX, clientY) {
        const rect = _renderer.domElement.getBoundingClientRect();
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, _camera);
        return raycaster.intersectObjects(_cityMarkers, false)[0]?.object || null;
    }

    function selectMarkerAt(clientX, clientY) {
        const marker = markerAt(clientX, clientY);
        const key = marker?.userData?.key || marker?.userData?.city?.id;
        if (!key) return;
        document.dispatchEvent(new CustomEvent('globeLocationSelected', {
            detail: { regionKey: key, location: marker.userData.city },
        }));
    }

    function onPointerDown(clientX, clientY) {
        if (_flyToAnimation) {
            cancelFlyAnimation();
            // Manual interaction during fly-to gives immediate control to user in FOCUSED state
            _globeState = GLOBE_STATES.FOCUSED;
        }
        if (_idleResumeTimer) {
            clearTimeout(_idleResumeTimer);
            _idleResumeTimer = null;
        }
        isDragging = true;
        pointerMoved = false;
        previousPointerPos = { x: clientX, y: clientY };
        container.style.cursor = 'grabbing';
    }

    function onPointerMove(clientX, clientY) {
        if (!isDragging) return;
        const deltaX = (clientX - previousPointerPos.x) * 0.005;
        const deltaY = (clientY - previousPointerPos.y) * 0.005;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 0.002) pointerMoved = true;

        _globe.rotation.y += deltaX;
        _globe.rotation.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, _globe.rotation.x + deltaY));

        previousPointerPos = { x: clientX, y: clientY };
    }

    function onPointerUp(clientX, clientY) {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'grab';
        if (!pointerMoved && Number.isFinite(clientX) && Number.isFinite(clientY)) {
            selectMarkerAt(clientX, clientY);
        }

        // In IDLE_ROTATION: resume slow rotation after 1.5s
        // In FOCUSED: globe stays 100% stationary
        if (_globeState === GLOBE_STATES.IDLE_ROTATION && !_hasUserSelectedRegion) {
            _idleResumeTimer = setTimeout(() => {
                _idleResumeTimer = null;
            }, 1500);
        }
    }

    container.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => {
        onPointerMove(e.clientX, e.clientY);
        if (!isDragging) container.style.cursor = markerAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
    });
    window.addEventListener('mouseup', (e) => onPointerUp(e.clientX, e.clientY));

    // Safe Scroll to zoom with hard clamp
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (_flyToAnimation) {
            cancelFlyAnimation();
            _globeState = GLOBE_STATES.FOCUSED;
        }
        const distAboveSurface = Math.max(0.2, _zoomDistance - GLOBE_RADIUS);
        const zoomDelta = e.deltaY * 0.0006 * Math.min(1.0, distAboveSurface);
        _zoomDistance = clampCameraDistance(_zoomDistance + zoomDelta);
        _camera.position.z = _zoomDistance;
    }, { passive: false });

    // Touch events with hard clamp
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
            onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStartDist) {
            const newDist = touchDistance(e.touches);
            const scale   = pinchStartDist / newDist;
            _zoomDistance = clampCameraDistance(pinchStartZoom * scale);
            _camera.position.z = _zoomDistance;
        } else if (e.touches.length === 1 && isDragging) {
            onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        const touch = e.changedTouches?.[0];
        onPointerUp(touch?.clientX, touch?.clientY);
        pinchStartDist = null;
    });

    // ── Animation Loop ────────────────────────────────────────────────────────
    let pulseTime = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();
    let fpsWindowFrames = 0;
    const cameraDirection = new THREE.Vector3();
    const markerWorldPosition = new THREE.Vector3();

    function animate(now = performance.now()) {
        requestAnimationFrame(animate);
        if (document.hidden) return;
        pulseTime += 0.05;
        frameCount++;
        fpsWindowFrames++;
        if (now - fpsWindowStart >= 1000) {
            _renderer.domElement.dataset.fps = (fpsWindowFrames * 1000 / (now - fpsWindowStart)).toFixed(1);
            fpsWindowStart = now;
            fpsWindowFrames = 0;
        }

        // 1. STATE 1: IDLE_ROTATION — continuous slow automatic rotation
        if (_globeState === GLOBE_STATES.IDLE_ROTATION) {
            if (!isDragging && !_idleResumeTimer && !_prefersReducedMotion) {
                _globe.rotation.y += IDLE_ROTATION_SPEED;
                const cloudSphere = _globe.userData.cloudSphere;
                if (cloudSphere) cloudSphere.rotation.y += IDLE_ROTATION_SPEED * 0.035;

                if (_starfield1) _starfield1.rotation.y += IDLE_ROTATION_SPEED * 0.08;
                if (_starfield2) _starfield2.rotation.y += IDLE_ROTATION_SPEED * 0.02;
            }
        }
        // 2. STATE 2: FLY_TO_TARGET is interpolated explicitly in focusGlobeOnRegion
        // 3. STATE 3: FOCUSED — NO ROTATION! Globe remains completely stationary on target.

        // Precipitation & Wind helper animations
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

        // Marker Screen-Space Scale & Hemisphere Visibility Occlusion
        if (_cityMarkers.length > 0 && frameCount % 2 === 0) {
            const globeWorldMat = _globe.matrixWorld;
            cameraDirection.copy(_camera.position).normalize();
            const cameraAltitude = Math.max(0.01, _zoomDistance - GLOBE_RADIUS);
            const overviewAltitude = ZOOM_LEVELS.overview - GLOBE_RADIUS;
            const screenComp = Math.max(0.12, Math.min(1.1, cameraAltitude / overviewAltitude));
            _cityMarkers.forEach((marker) => {
                const isCurrentActive = _hasUserSelectedRegion
                    && (marker.userData?.key === activeRegionKey || marker.userData?.city?.id === activeRegionKey);

                // At neighborhood scale the detail surface itself is the target;
                // hide pins so they do not cover several kilometres of imagery.
                if (_zoomDistance < 1.48) {
                    marker.visible = false;
                    return;
                }

                // At metropolitan scale only the selected city marker remains.
                if (_zoomDistance < ZOOM_LEVELS.cityRegion && !isCurrentActive) {
                    marker.visible = false;
                    return;
                }

                // Check hemisphere facing
                markerWorldPosition.copy(marker.position).applyMatrix4(globeWorldMat).normalize();
                const facingDot = markerWorldPosition.dot(cameraDirection);

                // If marker is on the far side of the Earth, hide it completely!
                if (facingDot < 0.05) {
                    marker.visible = false;
                } else {
                    marker.visible = true;
                    // Smooth horizon fade
                    const edgeFade = Math.min(1.0, (facingDot - 0.05) / 0.22);
                    marker.material.opacity = edgeFade;

                    // Size control (crisp 4-6px inactive, 8-10px active)
                    const baseScale = isCurrentActive ? 0.048 : (marker.userData?.is_featured ? 0.032 : 0.024);
                    const pulse = isCurrentActive ? (1.0 + Math.sin(pulseTime * 3.5) * 0.15) : 1.0;
                    const scale = baseScale * screenComp * pulse;
                    marker.scale.set(scale, scale, 1);
                }
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

        // Update the optional diagnostic overlay every 10 frames.
        if (frameCount % 10 === 0 && document.getElementById('globe-debug-overlay')) {
            updateDebugOverlay();
        }

        _renderer.render(_scene, _camera);
    }
    animate();

    // Container-aware resize avoids redundant full-window resize work.
    const resizeObserver = new ResizeObserver(([entry]) => {
        const w = Math.max(1, Math.round(entry.contentRect.width));
        const h = Math.max(1, Math.round(entry.contentRect.height));
        _camera.aspect = w / h;
        _camera.updateProjectionMatrix();
        _renderer.setSize(w, h, false);
        _renderer.setPixelRatio(Math.min(maxDpr, window.devicePixelRatio));
    });
    resizeObserver.observe(container);
}

function cinematicEase(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

function targetQuaternionForCoordinates(latitude, longitude) {
    const latRad = THREE.MathUtils.degToRad(latitude);
    const lonRad = THREE.MathUtils.degToRad(longitude);
    const localTarget = latLonToVector3(latitude, longitude, 1).normalize();
    const cameraFacingDirection = new THREE.Vector3(0, 0, 1);
    const alignTarget = new THREE.Quaternion().setFromUnitVectors(localTarget, cameraFacingDirection);

    // Keep local north upright after aligning the geographic target to the camera.
    const localNorth = new THREE.Vector3(
        -Math.cos(lonRad) * Math.sin(latRad),
        Math.cos(latRad),
        Math.sin(lonRad) * Math.sin(latRad),
    ).normalize().applyQuaternion(alignTarget);
    const rollAngle = Math.atan2(localNorth.x, localNorth.y);
    const removeRoll = new THREE.Quaternion().setFromAxisAngle(cameraFacingDirection, rollAngle);
    return removeRoll.multiply(alignTarget).normalize();
}

export function verifyGlobeTarget(latitude, longitude) {
    if (!_globe || !_camera) return { facingDot: -1, centered: false };
    _globe.updateMatrixWorld(true);
    const local = latLonToVector3(latitude, longitude, 1);
    const world = local.applyQuaternion(_globe.quaternion).normalize();
    const cameraDirection = _camera.position.clone().normalize();
    const facingDot = world.dot(cameraDirection);
    return { facingDot, centered: facingDot > 0.995 };
}

function syncCanvasGeographicState(extra = {}) {
    const canvas = _renderer?.domElement;
    if (!canvas) return;
    canvas.dataset.globeState = _globeState;
    canvas.dataset.targetName = _currentTargetName;
    canvas.dataset.targetLatitude = _currentTargetLat ?? '';
    canvas.dataset.targetLongitude = _currentTargetLon ?? '';
    Object.entries(extra).forEach(([key, value]) => { canvas.dataset[key] = String(value); });
}

// ── focusGlobeOnRegion() — Quaternion-based cinematic geographic targeting ───
export function focusGlobeOnRegion(latitude, longitude, options = {}) {
    if (!_globe || !_camera) return Promise.resolve({ cancelled: true });

    cancelFlyAnimation();
    _hasUserSelectedRegion = true;
    _globeState = GLOBE_STATES.FLY_TO_TARGET;
    const currentGen = ++_flyToGeneration;

    _currentTargetName = options.name || options.city || 'Region';
    _currentTargetLat  = Number(latitude);
    _currentTargetLon  = Number(longitude);
    syncCanvasGeographicState();

    if (_idleResumeTimer) {
        clearTimeout(_idleResumeTimer);
        _idleResumeTimer = null;
    }

    let targetZoom = options.zoom || ZOOM_LEVELS[options.type] || ZOOM_LEVELS.cityApproach;
    targetZoom = clampCameraDistance(targetZoom);
    const shouldReduceMotion = _prefersReducedMotion && options.forceCinematic !== true;
    const duration = shouldReduceMotion ? Math.min(180, options.duration || 950) : (options.duration || 950);
    const startQuaternion = _globe.quaternion.clone();
    const targetQuaternion = targetQuaternionForCoordinates(_currentTargetLat, _currentTargetLon);
    if (startQuaternion.dot(targetQuaternion) < 0) {
        targetQuaternion.set(
            -targetQuaternion.x,
            -targetQuaternion.y,
            -targetQuaternion.z,
            -targetQuaternion.w,
        );
    }
    const startZoom = _zoomDistance;
    const startTime = performance.now();

    return new Promise((resolve) => {
        _activeFlyResolve = resolve;

        function step(now) {
            if (_flyToGeneration !== currentGen) return;
            const progress = Math.min(1, (now - startTime) / duration);
            const rotationEased = cinematicEase(progress);
            const zoomProgress = THREE.MathUtils.clamp((progress - 0.08) / 0.92, 0, 1);
            const zoomEased = cinematicEase(zoomProgress);

            _globe.quaternion.copy(startQuaternion).slerp(targetQuaternion, rotationEased);
            _zoomDistance = clampCameraDistance(THREE.MathUtils.lerp(startZoom, targetZoom, zoomEased));
            _camera.position.z = _zoomDistance;

            if (progress < 1) {
                _flyToAnimation = requestAnimationFrame(step);
                return;
            }

            _globe.quaternion.copy(targetQuaternion);
            _zoomDistance = targetZoom;
            _camera.position.z = _zoomDistance;
            _globeState = GLOBE_STATES.FOCUSED;
            _flyToAnimation = null;
            const verification = verifyGlobeTarget(_currentTargetLat, _currentTargetLon);
            syncCanvasGeographicState({ facingDot: verification.facingDot, targetCentered: verification.centered });
            console.assert(verification.centered, '[WIaaS Globe] Geographic target failed front-hemisphere verification.', verification);
            const done = _activeFlyResolve;
            _activeFlyResolve = null;
            done?.({ cancelled: false, ...verification });
        }

        _flyToAnimation = requestAnimationFrame(step);
    });
}

// ── resetGlobeToIdle() — Smooth Reset to Full Earth & Resume Idle Rotation ───
export function resetGlobeToIdle(options = {}) {
    if (!_globe || !_camera) return Promise.resolve({ cancelled: true });

    cancelFlyAnimation();
    _hasUserSelectedRegion = false;
    _globeState = GLOBE_STATES.FLY_TO_TARGET;
    const currentGen = ++_flyToGeneration;

    _currentTargetName = 'Overview';
    _currentTargetLat  = null;
    _currentTargetLon  = null;
    syncCanvasGeographicState();

    const currentEuler = new THREE.Euler().setFromQuaternion(_globe.quaternion, 'YXZ');
    const startQuaternion = _globe.quaternion.clone();
    const targetQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(THREE.MathUtils.degToRad(15), currentEuler.y, 0, 'YXZ'),
    );
    const startZoom = _zoomDistance;
    const targetZoom = ZOOM_LEVELS.overview;
    const duration = _prefersReducedMotion && options.forceCinematic !== true
        ? 180
        : (options.duration || 1000);
    const startTime = performance.now();

    return new Promise((resolve) => {
        _activeFlyResolve = resolve;
        function step(now) {
            if (_flyToGeneration !== currentGen) return;
            const progress = Math.min(1, (now - startTime) / duration);
            const rotationEased = cinematicEase(progress);
            const zoomProgress = THREE.MathUtils.clamp((progress - 0.08) / 0.92, 0, 1);
            const zoomEased = cinematicEase(zoomProgress);
            _globe.quaternion.copy(startQuaternion).slerp(targetQuaternion, rotationEased);
            _zoomDistance = clampCameraDistance(THREE.MathUtils.lerp(startZoom, targetZoom, zoomEased));
            _camera.position.z = _zoomDistance;

            if (progress < 1) {
                _flyToAnimation = requestAnimationFrame(step);
                return;
            }
            _globe.quaternion.copy(targetQuaternion);
            _zoomDistance = targetZoom;
            _camera.position.z = _zoomDistance;
            _globeState = GLOBE_STATES.IDLE_ROTATION;
            syncCanvasGeographicState({ targetCentered: false });
            _flyToAnimation = null;
            buildGlobePins();
            const done = _activeFlyResolve;
            _activeFlyResolve = null;
            done?.({ cancelled: false });
        }
        _flyToAnimation = requestAnimationFrame(step);
    });
}

// ── buildGlobePins() ─────────────────────────────────────────────────────────
export async function buildGlobePins(cities = []) {
    if (!_pinsGroup) return;

    // Polling refreshes pins frequently; release GPU objects before rebuilding.
    _pinsGroup.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
            material.dispose?.();
        });
    });
    _pinsGroup.clear();
    _windHelpers = [];
    _rainHelpers = [];
    _cityMarkers = [];

    const positionsArray = new Float32Array(36);
    const tempsArray     = new Float32Array(12);
    let heatmapSlot      = 0;

    // Build pins for all monitored regions
    Object.entries(regionsRegistry).forEach(([key, meta], idx) => {
        const pos = latLonToVector3(meta.latitude, meta.longitude, GLOBE_RADIUS * 1.008);
        const cached = regionsTelemetryCache[key];
        const tempCelsius = cached?.telemetry?.temperature_celsius ?? 32.0;
        const windSpeed   = cached?.telemetry?.wind_speed_kmh ?? 12.0;
        const windDir     = cached?.telemetry?.wind_direction_degrees ?? 240.0;
        const humidity    = cached?.telemetry?.humidity_percentage ?? 45.0;

        if (heatmapSlot < 12 && (key === activeRegionKey || meta.is_featured || idx % 5 === 0)) {
            positionsArray[heatmapSlot * 3]     = pos.x;
            positionsArray[heatmapSlot * 3 + 1] = pos.y;
            positionsArray[heatmapSlot * 3 + 2] = pos.z;
            tempsArray[heatmapSlot] = Math.max(0, Math.min(1, (tempCelsius + 5) / 50));
            heatmapSlot++;
        }

        const isActive = _hasUserSelectedRegion && key === activeRegionKey;
        if (isActive || meta.is_featured || windActive) {
            const normal     = pos.clone().normalize();
            const localNorth = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
            const localEast  = normal.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
            const windRad    = (windDir * Math.PI) / 180;
            const windDir3   = localNorth.clone()
                .multiplyScalar(Math.cos(windRad))
                .add(localEast.clone().multiplyScalar(Math.sin(windRad)))
                .normalize();
            const arrow = new THREE.ArrowHelper(windDir3, pos,
                0.15 + (windSpeed / 60) * 0.35, isActive ? 0x00e5ff : 0x38bdf8, 0.08, 0.04);
            arrow.visible = windActive;
            _pinsGroup.add(arrow);
            _windHelpers.push(arrow);
        }

        if (humidity > 60 || isActive) {
            const rainRing = new THREE.Mesh(
                new THREE.RingGeometry(0.06, 0.09, 16),
                new THREE.MeshBasicMaterial({
                    color: isActive ? 0x00e5ff : 0x38bdf8,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: (humidity / 100) * 0.8,
                })
            );
            rainRing.position.copy(pos);
            rainRing.lookAt(0, 0, 0);
            rainRing.visible = precipitationActive && humidity > 60;
            _pinsGroup.add(rainRing);
            _rainHelpers.push(rainRing);
        }

        if (isActive || meta.is_featured || idx % 7 === 0) {
            const marker = createCityPointMarker({ ...meta, id: key }, idx, isActive);
            _pinsGroup.add(marker);
            _cityMarkers.push(marker);
        }
    });

    // Custom dynamic cities
    if (cities && cities.length > 0) {
        cities.forEach((city, idx) => {
            if (!regionsRegistry[city.id]) {
                const marker = createCityPointMarker(city, idx + 100, city.id === activeRegionKey);
                _pinsGroup.add(marker);
                _cityMarkers.push(marker);
            }
        });
    }

    if (_heatmapMaterial && _heatmapMaterial.uniforms) {
        _heatmapMaterial.uniforms.regionPos.value  = positionsArray;
        _heatmapMaterial.uniforms.regionTemp.value = tempsArray;
    }

    setWindHelpers(_windHelpers);
    setRainHelpers(_rainHelpers);
}

/**
 * Creates a subtle, screen-compensated point marker sprite.
 */
function createCityPointMarker(city, idx, isActive = false) {
    let rgb = '56, 189, 248'; // cyan default
    if (isActive) {
        rgb = '0, 229, 255'; // neon cyan active
    } else if (city.is_featured) {
        rgb = '16, 185, 129'; // emerald green featured
    } else if (city.country === 'Pakistan') {
        rgb = '52, 211, 153'; // mint green
    } else {
        rgb = '56, 189, 248'; // cohesive WIaaS soft cyan
    }

    const material = new THREE.SpriteMaterial({
        map: getMarkerTexture(rgb),
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
    });
    const marker = new THREE.Sprite(material);

    const baseScale = isActive ? 0.048 : (city.is_featured ? 0.032 : 0.024);
    marker.scale.set(baseScale, baseScale, 1);
    marker.position.copy(latLonToVector3(city.latitude, city.longitude, GLOBE_RADIUS * 1.008));
    marker.userData = { key: city.id || city.key, city, is_featured: city.is_featured, createdAt: Date.now() };

    return marker;
}

// ── Layer Toggle Exports ─────────────────────────────────────────────────────
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

// ── Floating Debug Overlay ───────────────────────────────────────────────────
function injectDebugOverlay(container) {
    if (document.getElementById('globe-debug-overlay')) return;
    const dbg = document.createElement('div');
    dbg.id = 'globe-debug-overlay';
    dbg.style.cssText = `
        position: absolute;
        bottom: 16px;
        right: 16px;
        background: rgba(4, 10, 20, 0.85);
        border: 1px solid rgba(56, 189, 248, 0.35);
        border-radius: 8px;
        padding: 8px 12px;
        font-family: 'JetBrains Mono', monospace, sans-serif;
        font-size: 10px;
        color: #7dd3fc;
        z-index: 90;
        pointer-events: none;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;
    dbg.innerHTML = `
        <div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <span>🌐 GLOBE TELEMETRY</span>
        </div>
        <div>Mode: <span id="dbg-globe-mode" style="color: #fff; font-weight: 600;">IDLE_ROTATION</span></div>
        <div>Target: <span id="dbg-globe-target" style="color: #fff;">Overview</span></div>
        <div>Coords: <span id="dbg-globe-coords" style="color: #fff;">—</span></div>
        <div>Cam Distance: <span id="dbg-globe-dist" style="color: #34d399; font-weight: 600;">4.80</span></div>
        <div>Facing Cam: <span id="dbg-globe-facing" style="color: #34d399;">YES (+1.000)</span></div>
        <div>Material: <span id="dbg-globe-mat" style="color: #fff;">SATELLITE 4K</span></div>
    `;
    container.appendChild(dbg);
}

function updateDebugOverlay() {
    const elMode    = document.getElementById('dbg-globe-mode');
    const elTarget  = document.getElementById('dbg-globe-target');
    const elCoords  = document.getElementById('dbg-globe-coords');
    const elDist    = document.getElementById('dbg-globe-dist');
    const elFacing  = document.getElementById('dbg-globe-facing');
    const elMat     = document.getElementById('dbg-globe-mat');

    if (!elMode) return;

    elMode.textContent = _globeState;
    if (_globeState === GLOBE_STATES.IDLE_ROTATION) {
        elMode.style.color = '#38bdf8';
    } else if (_globeState === GLOBE_STATES.FLY_TO_TARGET) {
        elMode.style.color = '#f59e0b';
    } else {
        elMode.style.color = '#10b981';
    }

    elTarget.textContent = _currentTargetName;
    if (_currentTargetLat !== null && _currentTargetLon !== null) {
        elCoords.textContent = `${_currentTargetLat.toFixed(2)}°N, ${_currentTargetLon.toFixed(2)}°E`;
    } else {
        elCoords.textContent = 'Global View';
    }

    elDist.textContent = _zoomDistance.toFixed(2);

    if (_currentTargetLat !== null && _currentTargetLon !== null && _globe) {
        const local = latLonToVector3(_currentTargetLat, _currentTargetLon, GLOBE_RADIUS);
        const world = local.clone().applyMatrix4(_globe.matrixWorld).normalize();
        const camDir = _camera.position.clone().normalize();
        const dot = world.dot(camDir);
        elFacing.textContent = `${dot >= 0.5 ? 'YES' : 'NO'} (${dot >= 0 ? '+' : ''}${dot.toFixed(3)})`;
        elFacing.style.color = dot >= 0.5 ? '#34d399' : '#ef4444';
    } else {
        elFacing.textContent = 'N/A';
        elFacing.style.color = '#7dd3fc';
    }

    elMat.textContent = heatmapActive ? 'THERMAL HEATMAP' : 'SATELLITE 4K';
}
