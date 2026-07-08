/**
 * charts.js — Chart.js initialization and update helpers for WIaaS.
 * Exports initCharts(), updateRadarChart(), pushTempPowerReading(), fluctuateVram().
 */

let _radarChart     = null;
let _vramChart      = null;
let _tempPowerChart = null;

// ── initCharts() ─────────────────────────────────────────────────────────────
export function initCharts() {
    // 1. Crop Health Radar Chart
    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    _radarChart = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Transpiration', 'NDVI Index', 'Soil Moisture', 'Canopy Cover', 'Nitrogen Level'],
            datasets: [{
                label: 'Index Value',
                data: [0.72, 0.82, 0.65, 0.55, 0.70],
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: '#10b981',
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#10b981',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    grid:       { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: { color: '#9090a0', font: { family: 'Outfit', size: 9 } },
                    ticks:      { display: false },
                    suggestedMin: 0,
                    suggestedMax: 1,
                },
            },
            plugins: { legend: { display: false } },
        },
    });

    // 2. VRAM Allocation Bar Chart (with vertical gradients)
    const ctxBar = document.getElementById('vramChart').getContext('2d');
    
    // Create gradient
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

    // 3. Core Temp & Power Level Line Chart (with filled area gradients)
    const ctxLine = document.getElementById('tempPowerChart').getContext('2d');
    
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

// ── updateRadarChart() ───────────────────────────────────────────────────────
export function updateRadarChart(radarData, healthIndex) {
    if (!_radarChart) return;
    _radarChart.data.datasets[0].data = radarData;

    if (healthIndex > 0.7) {
        _radarChart.data.datasets[0].borderColor     = '#10b981';
        _radarChart.data.datasets[0].backgroundColor = 'rgba(16, 185, 129, 0.15)';
    } else if (healthIndex > 0.5) {
        _radarChart.data.datasets[0].borderColor     = '#f59e0b';
        _radarChart.data.datasets[0].backgroundColor = 'rgba(245, 158, 11, 0.15)';
    } else {
        _radarChart.data.datasets[0].borderColor     = '#ef4444';
        _radarChart.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.15)';
    }
    _radarChart.update();
}

// ── pushTempPowerReading() ───────────────────────────────────────────────────
export function pushTempPowerReading(powerVal, tempVal) {
    if (!_tempPowerChart) return;
    _tempPowerChart.data.datasets[0].data.shift();
    _tempPowerChart.data.datasets[0].data.push(powerVal);
    _tempPowerChart.data.datasets[1].data.shift();
    _tempPowerChart.data.datasets[1].data.push(tempVal);
    _tempPowerChart.update('active'); // Use active transition animation
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
    _vramChart.update('active');
}
