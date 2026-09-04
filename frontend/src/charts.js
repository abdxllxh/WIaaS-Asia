/**
 * charts.js — Chart.js initialization and update helpers for WIaaS.
 * Exports initCharts(), updateRadarChart(), pushTempPowerReading(), fluctuateVram().
 */

let _radarChart     = null;
let _vramChart      = null;
let _tempPowerChart = null;

// ── initCharts() ─────────────────────────────────────────────────────────────
export function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('[charts] Chart.js is not loaded.');
        return;
    }

    // 1. Crop Health Radar Chart (if element is present)
    const elRadar = document.getElementById('radarChart');
    if (elRadar) {
        updateRadarChart([0.72, 0.82, 0.65, 0.55, 0.70], 0.82);
    }

    // 2. VRAM Allocation Bar Chart (with vertical gradients)
    const elBar = document.getElementById('vramChart');
    if (elBar) {
        const ctxBar = elBar.getContext('2d');
        if (ctxBar) {
            const vramGradient = ctxBar.createLinearGradient(0, 0, 0, 180);
            vramGradient.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
            vramGradient.addColorStop(1, 'rgba(56, 189, 248, 0.1)');

            const vramGradientBase = ctxBar.createLinearGradient(0, 0, 0, 180);
            vramGradientBase.addColorStop(0, 'rgba(0, 229, 255, 0.95)');
            vramGradientBase.addColorStop(1, 'rgba(0, 229, 255, 0.15)');

            _vramChart = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: ['Agri-Agent', 'Grid-Agent', 'Logistics', 'Regulator', 'Base Swarm'],
                    datasets: [{
                        data: [32, 28, 42, 18, 40.5],
                        backgroundColor: [
                            vramGradient,
                            vramGradient,
                            vramGradientBase,
                            vramGradient,
                            vramGradientBase,
                        ],
                        borderColor:  '#38bdf8',
                        borderWidth:  1.5,
                        borderRadius: 6,
                        borderSkipped: false,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid:  { display: false },
                            ticks: { color: '#9090a0', font: { family: 'Outfit', size: 9 } },
                        },
                        y: {
                            grid:         { color: 'rgba(255, 255, 255, 0.04)' },
                            ticks:        { color: '#9090a0', font: { family: 'JetBrains Mono', size: 9 } },
                            suggestedMax: 50,
                        },
                    },
                    animation: {
                        duration: 800,
                        easing: 'easeOutQuart',
                    }
                },
            });
        }
    }

    // 3. Core Temp & Power Level Line Chart (with filled area gradients)
    const elLine = document.getElementById('tempPowerChart');
    if (elLine) {
        const ctxLine = elLine.getContext('2d');
        if (ctxLine) {
            const powerGradient = ctxLine.createLinearGradient(0, 0, 0, 200);
            powerGradient.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            powerGradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

            const tempGradient = ctxLine.createLinearGradient(0, 0, 0, 200);
            tempGradient.addColorStop(0, 'rgba(239, 68, 68, 0.18)');
            tempGradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

            _tempPowerChart = new Chart(ctxLine, {
                type: 'line',
                data: {
                    labels: ['10s ago', '8s ago', '6s ago', '4s ago', '2s ago', 'Now'],
                    datasets: [
                        {
                            label: 'Power Draw (W)',
                            data: [610, 620, 605, 630, 642, 656],
                            borderColor:     '#38bdf8',
                            backgroundColor: powerGradient,
                            fill:            true,
                            borderWidth:     2,
                            tension:         0.35,
                            pointBackgroundColor: '#38bdf8',
                            pointBorderColor: 'rgba(255,255,255,0.7)',
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            yAxisID:         'yPower',
                        },
                        {
                            label: 'Core Temp (°C)',
                            data: [72, 73, 72, 74, 75, 75],
                            borderColor:     '#ef4444',
                            backgroundColor: tempGradient,
                            fill:            true,
                            borderWidth:     2,
                            tension:         0.35,
                            pointBackgroundColor: '#ef4444',
                            pointBorderColor: 'rgba(255,255,255,0.7)',
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            yAxisID:         'yTemp',
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid:  { display: false },
                            ticks: { color: '#9090a0', font: { family: 'Outfit', size: 9 } },
                        },
                        yPower: {
                            type:     'linear',
                            position: 'left',
                            grid:     { color: 'rgba(255, 255, 255, 0.04)' },
                            ticks:    { color: '#38bdf8', font: { family: 'JetBrains Mono', size: 9 } },
                        },
                        yTemp: {
                            type:     'linear',
                            position: 'right',
                            grid:     { display: false },
                            ticks:    { color: '#ef4444', font: { family: 'JetBrains Mono', size: 9 } },
                        },
                    },
                    animation: {
                        duration: 800,
                        easing: 'easeOutQuart',
                    }
                },
            });
        }
    }
}

// ── updateRadarChart() ───────────────────────────────────────────────────────
export function updateRadarChart(radarData, healthIndex) {
    const elRadar = document.getElementById('radarChart');
    if (!elRadar) return;

    const data = (radarData && Array.isArray(radarData) && radarData.length === 5)
        ? radarData
        : [0.72, 0.82, 0.65, 0.55, 0.70];
    const h = (typeof healthIndex === 'number' && !isNaN(healthIndex)) ? healthIndex : data[1];

    if (typeof Chart !== 'undefined') {
        const needsNewChart = !_radarChart || !_radarChart.ctx || _radarChart.ctx.canvas !== elRadar;
        if (needsNewChart) {
            if (_radarChart) {
                try { _radarChart.destroy(); } catch (e) {}
                _radarChart = null;
            }
            const ctxRadar = elRadar.getContext('2d');
            if (ctxRadar) {
                const isUrdu = document.documentElement.getAttribute('lang') === 'ur';
                const labels = isUrdu 
                    ? ['بخاراتی اخراج', 'NDVI انڈیکس', 'زمین کی نمی', 'چھتری کا احاطہ', 'نائٹروجن کی سطح']
                    : ['Transpiration', 'NDVI Index', 'Soil Moisture', 'Canopy Cover', 'Nitrogen Level'];
                
                const color = h > 0.7 ? '#10b981' : (h > 0.4 ? '#f59e0b' : '#ef4444');
                const bgColor = h > 0.7 ? 'rgba(16, 185, 129, 0.22)' : (h > 0.4 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(239, 68, 68, 0.22)');

                _radarChart = new Chart(ctxRadar, {
                    type: 'radar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: isUrdu ? 'انڈیکس قدر' : 'Crop Index Value',
                            data: data,
                            backgroundColor: bgColor,
                            borderColor: color,
                            borderWidth: 2,
                            pointBackgroundColor: color,
                            pointBorderColor: '#ffffff',
                            pointHoverBackgroundColor: '#ffffff',
                            pointHoverBorderColor: color,
                            pointRadius: 3.5,
                            pointHoverRadius: 5,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 350 },
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(255, 255, 255, 0.12)' },
                                grid:       { color: 'rgba(255, 255, 255, 0.10)' },
                                pointLabels: { 
                                    color: '#bae6fd', 
                                    font: { family: 'Outfit, system-ui, sans-serif', size: 10, weight: '600' } 
                                },
                                ticks: { display: false },
                                suggestedMin: 0,
                                suggestedMax: 1,
                            },
                        },
                        plugins: { 
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(2, 8, 18, 0.94)',
                                titleColor: '#38bdf8',
                                bodyColor: '#f1f5f9',
                                borderColor: 'rgba(56, 189, 248, 0.3)',
                                borderWidth: 1,
                                padding: 8,
                                callbacks: {
                                    label: (ctx) => ` ${(ctx.raw * 100).toFixed(0)}%`
                                }
                            }
                        },
                    },
                });
            }
            return;
        }

        // Chart already exists on canvas, update data and styles
        _radarChart.data.datasets[0].data = data;
        const color = h > 0.7 ? '#10b981' : (h > 0.4 ? '#f59e0b' : '#ef4444');
        const bgColor = h > 0.7 ? 'rgba(16, 185, 129, 0.22)' : (h > 0.4 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(239, 68, 68, 0.22)');
        _radarChart.data.datasets[0].borderColor = color;
        _radarChart.data.datasets[0].backgroundColor = bgColor;
        _radarChart.data.datasets[0].pointBackgroundColor = color;
        _radarChart.data.datasets[0].pointHoverBorderColor = color;
        _radarChart.update('none');
    } else {
        // Fallback: draw directly on 2D canvas context if Chart.js is not loaded
        drawFallbackRadar(elRadar, data, h);
    }
}

function drawFallbackRadar(canvas, data, healthIndex) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 340;
    const h = rect.height || 180;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 26;

    const isUrdu = document.documentElement.getAttribute('lang') === 'ur';
    const labels = isUrdu 
        ? ['بخارات', 'NDVI', 'نمی', 'چھتری', 'نائٹروجن']
        : ['Transpiration', 'NDVI', 'Moisture', 'Canopy', 'Nitrogen'];
    const count = labels.length;

    // Draw concentric web rings
    for (let level = 1; level <= 4; level++) {
        const r = (radius / 4) * level;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw axis lines and labels
    ctx.font = '600 10px Outfit, system-ui, sans-serif';
    ctx.fillStyle = '#bae6fd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.stroke();

        const lx = cx + Math.cos(angle) * (radius + 14);
        const ly = cy + Math.sin(angle) * (radius + 14);
        ctx.fillText(labels[i], lx, ly);
    }

    // Draw data polygon
    const color = healthIndex > 0.7 ? '#10b981' : (healthIndex > 0.4 ? '#f59e0b' : '#ef4444');
    const fillColor = healthIndex > 0.7 ? 'rgba(16, 185, 129, 0.22)' : (healthIndex > 0.4 ? 'rgba(245, 158, 11, 0.22)' : 'rgba(239, 68, 68, 0.22)');

    ctx.beginPath();
    for (let i = 0; i < count; i++) {
        const val = Math.max(0.05, Math.min(1.0, data[i] || 0.5));
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * (radius * val);
        const y = cy + Math.sin(angle) * (radius * val);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw point markers
    for (let i = 0; i < count; i++) {
        const val = Math.max(0.05, Math.min(1.0, data[i] || 0.5));
        const angle = (Math.PI * 2 / count) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * (radius * val);
        const y = cy + Math.sin(angle) * (radius * val);

        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// ── pushTempPowerReading() ───────────────────────────────────────────────────
export function pushTempPowerReading(powerVal, tempVal) {
    if (!_tempPowerChart) return;
    _tempPowerChart.data.datasets[0].data.shift();
    _tempPowerChart.data.datasets[0].data.push(powerVal);
    _tempPowerChart.data.datasets[1].data.shift();
    _tempPowerChart.data.datasets[1].data.push(tempVal);
    _tempPowerChart.update('none');
}

// ── fluctuateVram() ──────────────────────────────────────────────────────────
export function fluctuateVram() {
    if (!_vramChart) return;
    const baseValues = [32, 28, 42, 18, 40.5];
    const fluctuated = baseValues.map(val => {
        const delta = (Math.random() - 0.5) * 4.0; // +/- 2 GB
        return Math.max(5, Math.min(80, parseFloat((val + delta).toFixed(1))));
    });
    _vramChart.data.datasets[0].data = fluctuated;
    _vramChart.update('none');
}
