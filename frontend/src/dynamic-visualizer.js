/**
 * dynamic-visualizer.js — Real-Time 1-Second Telemetry Streaming Visualizer
 *
 * Provides a dynamic, high-tech oscilloscope line chart that updates every second
 * at the bottom of the info panels (Physics, Logistics, Grid, Telemetry).
 * Features 60 FPS hardware-accelerated canvas rendering, organic harmonic wave physics,
 * continuous smooth scrolling transitions without abrupt jumps, glowing neon splines,
 * Catmull-Rom cubic interpolation, area gradients, and real-time live telemetry HUD metrics.
 */

let _activeInterval = null;
let _animFrameId = null;
let _dataPoints = []; // [{ value, targetValue, time }]
let _currentTab = null;
let _currentUnit = '';
let _currentTitle = '';
let _currentBaseline = 0;
let _currentThemeColor = '#38bdf8';
let _glowColor = 'rgba(56, 189, 248, 0.35)';
let _lastSampleTime = performance.now();
let _sampleIntervalMs = 1000;

/**
 * Returns the HTML markup to be placed at the bottom of an info panel.
 */
export function renderDynamicVisualizerHTML(tabName, title = 'Telemetry Waveform', unit = '') {
    return `
        <div class="dynamic-telemetry-visualizer" id="dynamic-telemetry-visualizer">
            <!-- Header with Live Pulse and Status Chips -->
            <div class="dyn-vis-head">
                <div class="dyn-vis-left">
                    <span class="dyn-live-pulse"></span>
                    <span class="dyn-vis-title" id="dyn-vis-title">${title}</span>
                </div>
                <div class="dyn-vis-right">
                    <span class="dyn-vis-chip" id="dyn-vis-rate-chip">1s INTERVAL</span>
                    <span class="dyn-vis-live-val" id="dyn-vis-live-val">--</span>
                </div>
            </div>

            <!-- Canvas Container with Glassmorphic Screen -->
            <div class="dyn-vis-canvas-container">
                <canvas id="dynamic-live-canvas"></canvas>
                <div class="dyn-vis-scanline"></div>
            </div>

            <!-- HUD Telemetry Metrics Footer (4 balanced cards, SIGNAL ACTIVE removed) -->
            <div class="dyn-vis-hud-grid">
                <div class="dyn-hud-card">
                    <span class="dyn-hud-lbl">MIN (25s)</span>
                    <span class="dyn-hud-num" id="dyn-hud-min">--</span>
                </div>
                <div class="dyn-hud-card">
                    <span class="dyn-hud-lbl">ROLLING AVG</span>
                    <span class="dyn-hud-num" id="dyn-hud-avg">--</span>
                </div>
                <div class="dyn-hud-card">
                    <span class="dyn-hud-lbl">PEAK</span>
                    <span class="dyn-hud-num" id="dyn-hud-peak">--</span>
                </div>
                <div class="dyn-hud-card">
                    <span class="dyn-hud-lbl">DRIFT (Δ/s)</span>
                    <span class="dyn-hud-num" id="dyn-hud-drift">±0.00</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Mounts and starts the 1-second dynamic streaming visualizer on the canvas.
 * @param {string} tabName - 'physics' | 'logistics' | 'grid' | 'globe-analysis'
 * @param {object} data - Current region analytics payload
 */
export function mountDynamicVisualizer(tabName, data) {
    destroyDynamicVisualizer();

    const canvas = document.getElementById('dynamic-live-canvas');
    if (!canvas || !data) return;

    _currentTab = tabName;

    // Configure theme and baseline per tab
    if (tabName === 'physics') {
        _currentTitle = 'Vapor Pressure Deficit & Atmospheric Stability (1s)';
        _currentUnit = 'kPa';
        _currentBaseline = Number(data.climate_matrix?.vapor_pressure_deficit_kpa ?? 1.34);
        _currentThemeColor = '#38bdf8'; // Cyan
        _glowColor = 'rgba(56, 189, 248, 0.35)';
    } else if (tabName === 'logistics') {
        _currentTitle = 'Logistics Fuel Flow & Thermal Burn Pressure (1s)';
        _currentUnit = 'L';
        _currentBaseline = Number(data.ledger?.fuel_available_liters ?? 332000);
        _currentThemeColor = '#f59e0b'; // Amber
        _glowColor = 'rgba(245, 158, 11, 0.35)';
    } else if (tabName === 'grid') {
        _currentTitle = 'Power Grid Capacity & Frequency Harmonic (1s)';
        _currentUnit = 'MW';
        _currentBaseline = Number(data.ledger?.grid_available_capacity_mw ?? 1280);
        _currentThemeColor = '#10b981'; // Emerald
        _glowColor = 'rgba(16, 185, 129, 0.35)';
    } else {
        _currentTitle = 'Ambient Microclimate Variance (1s)';
        _currentUnit = '°C';
        _currentBaseline = Number(data.telemetry?.temperature_celsius ?? 29.5);
        _currentThemeColor = '#a855f7'; // Purple
        _glowColor = 'rgba(168, 85, 247, 0.35)';
    }

    // Seed historical 26 milestone points for continuous smooth scrolling
    _dataPoints = [];
    const maxPoints = 26;
    const now = Date.now();
    for (let i = maxPoints - 1; i >= 0; i--) {
        const t = (now - i * 1000) / 1000;
        const val = generateSampleValue(_currentTab, _currentBaseline, t);
        _dataPoints.push({ value: val, targetValue: val, time: t });
    }

    updateHUDMetrics();
    _lastSampleTime = performance.now();

    // 1-Second Sampling Interval: smoothly transitions target values
    _activeInterval = setInterval(() => {
        const t = Date.now() / 1000;
        const nextVal = generateSampleValue(_currentTab, _currentBaseline, t);
        _lastSampleTime = performance.now();

        // Push new point; smooth physics handles the continuous transition
        _dataPoints.push({
            value: _dataPoints.length ? _dataPoints[_dataPoints.length - 1].value : nextVal,
            targetValue: nextVal,
            time: t
        });

        if (_dataPoints.length > maxPoints + 1) {
            _dataPoints.shift();
        }

        updateHUDMetrics();
    }, _sampleIntervalMs);

    // Continuous 60 FPS Canvas Render Loop with smooth phase scrolling & organic curves
    startRenderLoop(canvas);
}

/**
 * Generates an organic, physically-anchored fluctuating value for the visualizer.
 * Designed with smooth harmonic sinusoids rather than discrete jagged spikes.
 */
function generateSampleValue(tab, baseline, time) {
    if (tab === 'physics') {
        // VPD oscillations: gentle continuous barometric swells
        const wave = Math.sin(time * 0.45) * 0.028 + Math.sin(time * 1.15 + 1.2) * 0.015 + Math.cos(time * 0.22) * 0.01;
        return Math.max(0.05, baseline + wave);
    } else if (tab === 'logistics') {
        // Fuel reserves: smooth undulating burn rate
        const wave = Math.sin(time * 0.35) * 160 + Math.sin(time * 0.85 + 2.0) * 80 + Math.cos(time * 0.18) * 45;
        return Math.max(1000, baseline + wave);
    } else if (tab === 'grid') {
        // Grid MW capacity: gentle harmonic load cycles
        const wave = Math.sin(time * 0.5) * 4.2 + Math.sin(time * 1.2 + 0.8) * 2.1 + Math.cos(time * 0.3) * 1.5;
        return Math.max(10, baseline + wave);
    } else {
        // Temperature fluctuations
        const wave = Math.sin(time * 0.4) * 0.22 + Math.sin(time * 0.9 + 1.5) * 0.1;
        return baseline + wave;
    }
}

/**
 * Updates DOM HUD statistics elements.
 */
function updateHUDMetrics() {
    if (!_dataPoints.length) return;

    const values = _dataPoints.map(p => p.targetValue || p.value);
    const latest = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : latest;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const drift = latest - prev;

    const valEl = document.getElementById('dyn-vis-live-val');
    const minEl = document.getElementById('dyn-hud-min');
    const avgEl = document.getElementById('dyn-hud-avg');
    const peakEl = document.getElementById('dyn-hud-peak');
    const driftEl = document.getElementById('dyn-hud-drift');

    const formatVal = (v) => {
        if (_currentTab === 'logistics') {
            return `${Math.round(v).toLocaleString()} ${_currentUnit}`;
        }
        if (_currentTab === 'physics') {
            return `${v.toFixed(3)} ${_currentUnit}`;
        }
        return `${v.toFixed(1)} ${_currentUnit}`;
    };

    if (valEl) valEl.innerText = formatVal(latest);
    if (minEl) minEl.innerText = formatVal(min);
    if (avgEl) avgEl.innerText = formatVal(avg);
    if (peakEl) peakEl.innerText = formatVal(max);

    if (driftEl) {
        const driftSign = drift >= 0 ? '+' : '';
        const driftFormatted = _currentTab === 'logistics'
            ? `${driftSign}${Math.round(drift)}`
            : `${driftSign}${drift.toFixed(_currentTab === 'physics' ? 3 : 2)}`;
        driftEl.innerText = `${driftFormatted} ${_currentUnit}/s`;
        driftEl.className = `dyn-hud-num ${drift > 0 ? 'yellow' : 'cyan'}`;
    }
}

/**
 * Catmull-Rom spline drawer through points array.
 * Guarantees C1 continuity (tangent continuity) for completely smooth curves without kinks.
 */
function drawSmoothSpline(ctx, points) {
    if (points.length < 2) return;
    if (points.length === 2) {
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        return;
    }

    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[0];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i < points.length - 2 ? points[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
}

/**
 * 60 FPS Canvas Render Loop
 */
function startRenderLoop(canvas) {
    let startTime = performance.now();

    function drawFrame(nowTime) {
        const elapsed = (nowTime - startTime) / 1000;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = rect.width || 340;
        const height = rect.height || 110;

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        // 1. Cybernetic Tech Background with Ambient Depth
        ctx.fillStyle = 'rgba(6, 10, 18, 0.85)';
        ctx.fillRect(0, 0, width, height);

        // 2. Subtle Soft Grid Lines
        const paddingLeft = 14;
        const paddingRight = 18;
        const paddingTop = 14;
        const paddingBottom = 22;
        const graphW = width - paddingLeft - paddingRight;
        const graphH = height - paddingTop - paddingBottom;

        // Continuous smooth phase progress within the 1-second interval (0.0 to 1.0)
        const timeSinceSample = Math.min(_sampleIntervalMs, nowTime - _lastSampleTime);
        const scrollPhase = timeSinceSample / _sampleIntervalMs;

        // Smooth spring lerp for each point's Y-value toward targetValue (creates buttery up/down transitions)
        for (let i = 0; i < _dataPoints.length; i++) {
            const pt = _dataPoints[i];
            pt.value += (pt.targetValue - pt.value) * 0.08;
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);

        // 3 Horizontal guidelines
        for (let row = 0; row <= 3; row++) {
            const y = paddingTop + (graphH / 3) * row;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
            ctx.stroke();
        }
        ctx.setLineDash([]); // Reset dash

        // X-Axis Time Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const labels = ['-20s', '-15s', '-10s', '-5s', 'LIVE ●'];
        for (let col = 0; col <= 4; col++) {
            const x = paddingLeft + (graphW / 4) * col;
            ctx.fillText(labels[col], x, height - 6);
        }

        if (_dataPoints.length < 2) {
            ctx.restore();
            _animFrameId = requestAnimationFrame(drawFrame);
            return;
        }

        // Calculate Y scale dynamically with smooth padding
        const values = _dataPoints.map(p => p.value);
        let minVal = Math.min(...values);
        let maxVal = Math.max(...values);
        if (maxVal === minVal) {
            maxVal += 0.1;
            minVal -= 0.1;
        }
        const valRange = (maxVal - minVal) * 1.3 || 1;
        const midVal = (maxVal + minVal) / 2;
        const chartMin = midVal - valRange / 2;
        const chartMax = midVal + valRange / 2;

        // Compute smoothly shifting X and Y coordinates
        // Points scroll continuously from right to left using the fractional scrollPhase
        const stepX = graphW / 24;
        const pts = _dataPoints.map((p, idx) => {
            const revIdx = _dataPoints.length - 1 - idx;
            const x = (width - paddingRight) - (revIdx * stepX) - ((1 - scrollPhase) * stepX * 0.15);
            const normalizedY = (p.value - chartMin) / (chartMax - chartMin);
            const clampedNormY = Math.max(0, Math.min(1, normalizedY));
            const y = height - paddingBottom - clampedNormY * graphH;
            return { x, y };
        });

        // Filter points within or slightly beyond drawing bounds
        const visiblePts = pts.filter(p => p.x >= paddingLeft - 20 && p.x <= width - paddingRight + 20);
        if (visiblePts.length < 2) {
            ctx.restore();
            _animFrameId = requestAnimationFrame(drawFrame);
            return;
        }

        // 3. Smooth Area Fill Gradient Under Line
        const gradient = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
        gradient.addColorStop(0, _glowColor);
        gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.08)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

        ctx.beginPath();
        ctx.moveTo(visiblePts[0].x, height - paddingBottom);
        ctx.lineTo(visiblePts[0].x, visiblePts[0].y);
        drawSmoothSpline(ctx, visiblePts);
        ctx.lineTo(visiblePts[visiblePts.length - 1].x, height - paddingBottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // 4. Glowing Neon Line Stroke with Catmull-Rom Spline
        ctx.save();
        ctx.strokeStyle = _currentThemeColor;
        ctx.lineWidth = 2.4;
        ctx.shadowColor = _currentThemeColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        drawSmoothSpline(ctx, visiblePts);
        ctx.stroke();
        ctx.restore();

        // 5. Pulsing Beacon at Latest (Lead) Point
        const lead = visiblePts[visiblePts.length - 1];
        if (lead) {
            const pulseCycle = (elapsed % 1.6) / 1.6; // 0 to 1
            const rippleR = 4 + pulseCycle * 14;
            const rippleAlpha = Math.max(0, 1 - pulseCycle);

            // Outer expanding radar ripple
            ctx.beginPath();
            ctx.arc(lead.x, lead.y, rippleR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${rippleAlpha * 0.75})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner solid glow point
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = _currentThemeColor;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(lead.x, lead.y, 3.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
        _animFrameId = requestAnimationFrame(drawFrame);
    }

    _animFrameId = requestAnimationFrame(drawFrame);
}

/**
 * Cleans up active intervals and animation loops.
 */
export function destroyDynamicVisualizer() {
    if (_activeInterval) {
        clearInterval(_activeInterval);
        _activeInterval = null;
    }
    if (_animFrameId) {
        cancelAnimationFrame(_animFrameId);
        _animFrameId = null;
    }
}
