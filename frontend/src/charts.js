/**
 * charts.js — Chart.js initialization and update helpers for WIaaS.
 * Exports initCharts() and updateRadarChart().
 */

import { setRadarChart, setVramChart, setTempPowerChart } from './state.js';

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
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid:       { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#9090a0', font: { family: 'Outfit', size: 9 } },
                    ticks:      { display: false },
                    suggestedMin: 0,
                    suggestedMax: 1,
                },
            },
            plugins: { legend: { display: false } },
        },
    });
    setRadarChart(_radarChart);

    // 2. VRAM Allocation Bar Chart
    const ctxBar = document.getElementById('vramChart').getContext('2d');
    _vramChart = new Chart(ctxBar, {
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
                    'rgba(56, 189, 248, 0.7)',
                ],
                borderColor:  '#38bdf8',
                borderWidth:  1,
                borderRadius: 4,
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
                    grid:         { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks:        { color: '#9090a0', font: { family: 'JetBrains Mono', size: 9 } },
                    suggestedMax: 50,
                },
            },
        },
    });
    setVramChart(_vramChart);

    // 3. Core Temp & Power Level Line Chart
    const ctxLine = document.getElementById('tempPowerChart').getContext('2d');
    _tempPowerChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: ['10s ago', '8s ago', '6s ago', '4s ago', '2s ago', 'Now'],
            datasets: [
                {
                    label: 'Power Draw (W)',
                    data: [610, 620, 605, 630, 642, 656],
                    borderColor:     '#38bdf8',
                    backgroundColor: 'transparent',
                    borderWidth:     2,
                    tension:         0.3,
                    yAxisID:         'yPower',
                },
                {
                    label: 'Core Temp (°C)',
                    data: [72, 73, 72, 74, 75, 75],
                    borderColor:     '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth:     2,
                    tension:         0.3,
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
                    grid:     { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks:    { color: '#38bdf8', font: { family: 'JetBrains Mono', size: 9 } },
                },
                yTemp: {
                    type:     'linear',
                    position: 'right',
                    grid:     { display: false },
                    ticks:    { color: '#ef4444', font: { family: 'JetBrains Mono', size: 9 } },
                },
            },
        },
    });
    setTempPowerChart(_tempPowerChart);
}

// ── updateRadarChart() ───────────────────────────────────────────────────────
/**
 * @param {number[]} radarData - 5-element array of values [0..1]
 * @param {number}   healthIndex - scalar health score used to pick color
 */
export function updateRadarChart(radarData, healthIndex) {
    if (!_radarChart) return;
    _radarChart.data.datasets[0].data = radarData;

    if (healthIndex > 0.7) {
        _radarChart.data.datasets[0].borderColor     = '#10b981';
        _radarChart.data.datasets[0].backgroundColor = 'rgba(16, 185, 129, 0.2)';
    } else if (healthIndex > 0.5) {
        _radarChart.data.datasets[0].borderColor     = '#f59e0b';
        _radarChart.data.datasets[0].backgroundColor = 'rgba(245, 158, 11, 0.2)';
    } else {
        _radarChart.data.datasets[0].borderColor     = '#ef4444';
        _radarChart.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.2)';
    }
    _radarChart.update();
}

// ── pushTempPowerReading() ───────────────────────────────────────────────────
/**
 * Append a new data point to the live power/temp line chart.
 * @param {number} powerVal
 * @param {number} tempVal
 */
export function pushTempPowerReading(powerVal, tempVal) {
    if (!_tempPowerChart) return;
    _tempPowerChart.data.datasets[0].data.shift();
    _tempPowerChart.data.datasets[0].data.push(powerVal);
    _tempPowerChart.data.datasets[1].data.shift();
    _tempPowerChart.data.datasets[1].data.push(tempVal);
    _tempPowerChart.update('none');
}
