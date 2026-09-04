/**
 * map-layers.js — Map Intelligence Layers:
 * 1. Live Wind Direction, Flow Streamlines & Compass Telemetry
 * 2. Animated Precipitation Radar Circle (Accurate location-based, zero zoom restrictions)
 * 3. NASA POWER & Open-Meteo Location Climate Perception Engine
 */

import { getActiveRegion, activeRegionKey } from './state.js';

let _map = null;
let _windActive = false;
let _rainActive = false;
let _thermalActive = false;
let _thermalCanvasOverlay = null;
let _thermalCanvasFrame = 0;
let _rainCanvasOverlay = null;
let _rainCanvasFrame = 0;
let _currentClimateData = null;
let _windCanvasOverlay = null;
let _windAnimId = null;
let _isLocationLoading = false;
let _spatialGrid = null;
let _spatialGridStatus = 'idle';
let _spatialGridLocation = null;
let _spatialGridRequestId = 0;
let _spatialGridAbortController = null;
let _spatialGridError = null;

// Radar Circle Pulse Animation state
let _pulseAnimId = null;
let _pulseRadiusRatio = 0.0; // 0.0 to 1.0
let _blinkVal = 0.85;
let _hoveredCircleId = null;
let _hoverCardEl = null;

const THERMAL_SOURCE_ID = 'asia-thermal-source';
const THERMAL_LAYER_ID = 'asia-thermal-heatmap';
const THERMAL_GLOW_LAYER_ID = 'asia-thermal-city-glow';
const THERMAL_CELL_SOURCE_ID = 'asia-thermal-cell-source';
const THERMAL_CELL_LAYER_ID = 'asia-thermal-cells';
const THERMAL_CELL_OUTLINE_LAYER_ID = 'asia-thermal-cell-outline';
const RAIN_RADAR_SOURCE_ID = 'rainviewer-radar-source';
const RAIN_RADAR_LAYER_ID = 'rainviewer-radar-layer';

const SPATIAL_GRID_MIN_RAIN_PROBABILITY = 15;

// ── Precision Regional & Multi-Scale Precipitation Intelligence Catalog ─────
export const MASTER_PRECIPITATION_REGISTRY = [
    // --- Pakistan ---
    {
        id: 'pk-karachi-marine-shelf',
        name: 'Karachi Offshore Marine Shelf & Coastal Harbor',
        city: 'Karachi',
        country: 'Pakistan',
        regionKey: 'pakistan_karachi',
        latitude: 24.8400,
        longitude: 67.0200,
        radiusKm: 9,
        probabilityPct: 63,
        rateMmh: 4.8,
        sector: 'Coastal Sea / Arabian Marine Inflow',
        status: 'Active Coastal Rainband · Marine Squall'
    },
    {
        id: 'pk-karachi-clifton-harbor',
        name: 'Clifton Harbor & Seaview Convective Cell',
        city: 'Karachi',
        country: 'Pakistan',
        regionKey: 'pakistan_karachi',
        latitude: 24.8150,
        longitude: 67.0250,
        radiusKm: 11,
        probabilityPct: 47,
        rateMmh: 2.6,
        sector: 'Clifton–Seaview Marine Inflow',
        status: 'Scattered Coastal Showers'
    },
    {
        id: 'pk-karachi-malir',
        name: 'Malir Basin Urban Heat & Rain Cell',
        city: 'Karachi',
        country: 'Pakistan',
        regionKey: 'pakistan_karachi',
        latitude: 24.9050,
        longitude: 67.1800,
        radiusKm: 10,
        probabilityPct: 31,
        rateMmh: 1.4,
        sector: 'Malir River Urban Convergence',
        status: 'Passing Convective Cell'
    },
    {
        id: 'pk-karachi-lyari',
        name: 'Lyari–Gulshan Inland Rain Cell',
        city: 'Karachi',
        country: 'Pakistan',
        regionKey: 'pakistan_karachi',
        latitude: 24.9250,
        longitude: 67.0050,
        radiusKm: 9,
        probabilityPct: 22,
        rateMmh: 0.8,
        sector: 'Lyari Inland Moisture Channel',
        status: 'Low-Probability Shower Cell'
    },
    {
        id: 'pk-chenab-basin',
        name: 'Chenab Agricultural Canal Basin',
        city: 'Multan',
        country: 'Pakistan',
        regionKey: 'pakistan_multan',
        latitude: 30.1700,
        longitude: 71.4800,
        radiusKm: 20,
        probabilityPct: 24,
        rateMmh: 0.8,
        sector: 'Chenab Riverine Agro-Belt',
        status: 'Scattered Cloud Inflow'
    },
    {
        id: 'pk-potohar-belt',
        name: 'Margalla Hills & Potohar Convective Inflow',
        city: 'Islamabad',
        country: 'Pakistan',
        regionKey: 'pakistan_islamabad',
        latitude: 33.7200,
        longitude: 73.0600,
        radiusKm: 20,
        probabilityPct: 52,
        rateMmh: 3.6,
        sector: 'Sub-Himalayan Orographic Inflow',
        status: 'Convective Ridge Showers'
    },
    {
        id: 'pk-rawalpindi-basin',
        name: 'Soan River & Rawalpindi Basin Corridor',
        city: 'Rawalpindi',
        country: 'Pakistan',
        regionKey: 'pakistan_islamabad',
        latitude: 33.5800,
        longitude: 73.0400,
        radiusKm: 18,
        probabilityPct: 48,
        rateMmh: 3.2,
        sector: 'Potohar Plateau Convective Inflow',
        status: 'Moderate Convective Showers'
    },
    {
        id: 'pk-ravi-canal',
        name: 'Lahore Ravi Basin & Northern Moisture Channel',
        city: 'Lahore',
        country: 'Pakistan',
        regionKey: 'pakistan_lahore',
        latitude: 31.5600,
        longitude: 74.3200,
        radiusKm: 20,
        probabilityPct: 35,
        rateMmh: 1.6,
        sector: 'Northern Riverine Agro-Belt',
        status: 'Passing Riverine Showers'
    },
    {
        id: 'pk-gilgit-naltar',
        name: 'Gilgit Valley & Naltar Confluence Watershed',
        city: 'Gilgit',
        country: 'Pakistan',
        regionKey: 'pakistan_gilgit',
        latitude: 35.9350,
        longitude: 74.3150,
        radiusKm: 18,
        probabilityPct: 46,
        rateMmh: 3.4,
        sector: 'High-Elevation Karakoram Orographic Inflow',
        status: 'Active Mountain Showers · Ridge Condensation'
    },
    {
        id: 'pk-skardu-satpara',
        name: 'Skardu Indus Valley & Satpara Watershed',
        city: 'Skardu',
        country: 'Pakistan',
        regionKey: 'pakistan_skardu',
        latitude: 35.2950,
        longitude: 75.6300,
        radiusKm: 18,
        probabilityPct: 52,
        rateMmh: 4.1,
        sector: 'High-Altitude Glacial Inflow Corridor',
        status: 'Convective Mountain Showers'
    },
    {
        id: 'pk-swat-valley',
        name: 'Swat River Basin & Malam Jabba Foothills',
        city: 'Swat',
        country: 'Pakistan',
        regionKey: 'pakistan_swat',
        latitude: 34.8000,
        longitude: 72.3800,
        radiusKm: 22,
        probabilityPct: 68,
        rateMmh: 6.2,
        sector: 'Hindukush Ridge Orographic Uplift',
        status: 'Intense Alpine Downpours'
    },
    {
        id: 'pk-peshawar-warsak',
        name: 'Peshawar Valley & Warsak Basin Corridor',
        city: 'Peshawar',
        country: 'Pakistan',
        regionKey: 'pakistan_peshawar',
        latitude: 34.0250,
        longitude: 71.5150,
        radiusKm: 20,
        probabilityPct: 42,
        rateMmh: 2.6,
        sector: 'Khyber Foothill Orographic Inflow',
        status: 'Foothill Rainband & River Surge'
    },
    {
        id: 'pk-quetta-hanna',
        name: 'Quetta Valley & Hanna Pass Catchment',
        city: 'Quetta',
        country: 'Pakistan',
        regionKey: 'pakistan_quetta',
        latitude: 30.2000,
        longitude: 67.0100,
        radiusKm: 18,
        probabilityPct: 38,
        rateMmh: 2.2,
        sector: 'Chiltan Ridge Orographic Moisture Funnel',
        status: 'Mountain Inflow Showers'
    },
    {
        id: 'pk-abbottabad-crest',
        name: 'Abbottabad Shimla Crest Catchment',
        city: 'Abbottabad',
        country: 'Pakistan',
        regionKey: 'pakistan_abbottabad',
        latitude: 34.1650,
        longitude: 73.2300,
        radiusKm: 16,
        probabilityPct: 56,
        rateMmh: 3.8,
        sector: 'Hazara High Ridge Convective Uplift',
        status: 'Mountain Mist & Passing Showers'
    },
    {
        id: 'pk-muzaffarabad-neelum',
        name: 'Neelum-Jhelum Alpine Watershed',
        city: 'Muzaffarabad',
        country: 'Pakistan',
        regionKey: 'pakistan_muzaffarabad',
        latitude: 34.3750,
        longitude: 73.4750,
        radiusKm: 20,
        probabilityPct: 58,
        rateMmh: 4.4,
        sector: 'Alpine Watershed Orographic Inflow',
        status: 'Active Mountain Showers'
    },
    {
        id: 'pk-faisalabad-canal',
        name: 'Faisalabad Chenab Canal Network',
        city: 'Faisalabad',
        country: 'Pakistan',
        regionKey: 'pakistan_faisalabad',
        latitude: 31.4400,
        longitude: 73.1100,
        radiusKm: 18,
        probabilityPct: 28,
        rateMmh: 1.4,
        sector: 'Canal Network Evaporative Corridor',
        status: 'Scattered Agricultural Inflow'
    },
    {
        id: 'pk-sukkur-barrage',
        name: 'Sukkur Indus Barrage Corridor',
        city: 'Sukkur',
        country: 'Pakistan',
        regionKey: 'pakistan_sukkur',
        latitude: 27.7120,
        longitude: 68.8650,
        radiusKm: 16,
        probabilityPct: 22,
        rateMmh: 1.1,
        sector: 'Indus Riverine Moisture Corridor',
        status: 'Riverine Cloud Fringe'
    },
    {
        id: 'pk-gwadar-shelf',
        name: 'Gwadar Coastal Marine Shelf',
        city: 'Gwadar',
        country: 'Pakistan',
        regionKey: 'pakistan_gwadar',
        latitude: 25.1220,
        longitude: 62.3150,
        radiusKm: 18,
        probabilityPct: 44,
        rateMmh: 3.2,
        sector: 'Arabian Sea Marine Inflow',
        status: 'Coastal Frontal Squalls'
    },
    {
        id: 'pk-chitral-valley',
        name: 'Chitral Kunar Valley Corridor',
        city: 'Chitral',
        country: 'Pakistan',
        regionKey: 'pakistan_chitral',
        latitude: 35.8650,
        longitude: 71.7750,
        radiusKm: 16,
        probabilityPct: 48,
        rateMmh: 3.6,
        sector: 'High Glacial Watershed Uplift',
        status: 'Convective Alpine Cloud Band'
    },

    // --- India ---
    {
        id: 'in-mumbai-shelf',
        name: 'Mumbai Coastal Marine Shelf',
        city: 'Mumbai',
        country: 'India',
        regionKey: 'india_mumbai',
        latitude: 18.9400,
        longitude: 72.8100,
        radiusKm: 24,
        probabilityPct: 76,
        rateMmh: 11.2,
        sector: 'Western Ghats Marine Surge',
        status: 'Heavy Coastal Rainband'
    },
    {
        id: 'in-delhi-yamuna',
        name: 'Delhi NCR Yamuna River Corridor',
        city: 'Delhi',
        country: 'India',
        regionKey: 'india_delhi',
        latitude: 28.6500,
        longitude: 77.2300,
        radiusKm: 22,
        probabilityPct: 38,
        rateMmh: 2.1,
        sector: 'Northern Plain Moisture Tongue',
        status: 'Passing Monsoon Showers'
    },
    {
        id: 'in-kolkata-delta',
        name: 'Ganges Delta & Hooghly Estuary',
        city: 'Kolkata',
        country: 'India',
        regionKey: 'india_kolkata',
        latitude: 22.5726,
        longitude: 88.3639,
        radiusKm: 24,
        probabilityPct: 62,
        rateMmh: 5.8,
        sector: 'Bay of Bengal Moisture Funnel',
        status: 'Monsoon Squall Line'
    },
    {
        id: 'in-chennai-coast',
        name: 'Coromandel Coastal Marine Front',
        city: 'Chennai',
        country: 'India',
        regionKey: 'india_chennai',
        latitude: 13.0827,
        longitude: 80.2707,
        radiusKm: 22,
        probabilityPct: 42,
        rateMmh: 2.8,
        sector: 'Bay of Bengal Coastal Flow',
        status: 'Passing Coastal Showers'
    },
    {
        id: 'in-bangalore-plateau',
        name: 'Mysore Plateau Convective Ridge',
        city: 'Bangalore',
        country: 'India',
        regionKey: 'india_bangalore',
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 20,
        probabilityPct: 45,
        rateMmh: 3.2,
        sector: 'Southern Ghats Orographic Channel',
        status: 'Convective Evening Showers'
    },
    {
        id: 'in-hyderabad-deccan',
        name: 'Deccan Plateau Musi Basin',
        city: 'Hyderabad',
        country: 'India',
        regionKey: 'india_hyderabad',
        latitude: 17.3850,
        longitude: 78.4867,
        radiusKm: 20,
        probabilityPct: 34,
        rateMmh: 1.8,
        sector: 'Inland Convective Moisture Cell',
        status: 'Scattered Inflow'
    },
    {
        id: 'in-ahmedabad-basin',
        name: 'Sabarmati River Basin',
        city: 'Ahmedabad',
        country: 'India',
        regionKey: 'india_ahmedabad',
        latitude: 23.0225,
        longitude: 72.5714,
        radiusKm: 20,
        probabilityPct: 26,
        rateMmh: 1.2,
        sector: 'Western Semi-Arid Inflow',
        status: 'Isolated Cloud Fringe'
    },
    {
        id: 'in-pune-ghats',
        name: 'Western Ghats Ridge & Mutha Basin',
        city: 'Pune',
        country: 'India',
        regionKey: 'india_pune',
        latitude: 18.5204,
        longitude: 73.8567,
        radiusKm: 20,
        probabilityPct: 54,
        rateMmh: 4.2,
        sector: 'Orographic Rain Shadow Ridge',
        status: 'Passing Hill Showers'
    },
    {
        id: 'in-assam-valley',
        name: 'Brahmaputra Valley & Guwahati Corridor',
        city: 'Guwahati',
        country: 'India',
        regionKey: 'india_guwahati',
        latitude: 26.1800,
        longitude: 91.7500,
        radiusKm: 26,
        probabilityPct: 79,
        rateMmh: 12.6,
        sector: 'Eastern Himalayan Rain Corridor',
        status: 'Active Monsoon Downpour'
    },
    {
        id: 'in-kerala-ghats',
        name: 'Kerala Coast & Anamudi Ghats',
        city: 'Kochi',
        country: 'India',
        regionKey: 'india_kochi',
        latitude: 9.9800,
        longitude: 76.2800,
        radiusKm: 24,
        probabilityPct: 65,
        rateMmh: 7.4,
        sector: 'Tropical Coastline Convection',
        status: 'Moderate Monsoon Rain'
    },

    // --- Bangladesh ---
    {
        id: 'bd-sylhet-surma',
        name: 'Sylhet Surma Flood Basin',
        city: 'Sylhet',
        country: 'Bangladesh',
        regionKey: 'bangladesh_sylhet',
        latitude: 24.9100,
        longitude: 91.8800,
        radiusKm: 26,
        probabilityPct: 82,
        rateMmh: 14.8,
        sector: 'Flash Flood Monsoon Convective Core',
        status: 'Intense Monsoon Torrent'
    },
    {
        id: 'bd-chittagong-coast',
        name: 'Chittagong Coast & Karnaphuli Estuary',
        city: 'Chittagong',
        country: 'Bangladesh',
        regionKey: 'bangladesh_chittagong',
        latitude: 22.3500,
        longitude: 91.7900,
        radiusKm: 24,
        probabilityPct: 71,
        rateMmh: 8.5,
        sector: 'Bay of Bengal Marine Squall Line',
        status: 'Heavy Coastal Squalls'
    },
    {
        id: 'bd-dhaka-wetland',
        name: 'Buriganga-Meghna Wetland Catchment',
        city: 'Dhaka',
        country: 'Bangladesh',
        regionKey: 'bangladesh_dhaka',
        latitude: 23.7400,
        longitude: 90.4200,
        radiusKm: 22,
        probabilityPct: 68,
        rateMmh: 7.6,
        sector: 'Deltaic Convective Flood Basin',
        status: 'Tropical Monsoon Downpours'
    },
    {
        id: 'bd-rajshahi-padma',
        name: 'Padma River Moisture Basin',
        city: 'Rajshahi',
        country: 'Bangladesh',
        regionKey: 'bangladesh_rajshahi',
        latitude: 24.3745,
        longitude: 88.6042,
        radiusKm: 20,
        probabilityPct: 48,
        rateMmh: 3.4,
        sector: 'Northwestern Alluvial Plain',
        status: 'Monsoon Cloud Stream'
    },
    {
        id: 'bd-khulna-delta',
        name: 'Sundarbans Mangrove Delta Front',
        city: 'Khulna',
        country: 'Bangladesh',
        regionKey: 'bangladesh_khulna',
        latitude: 22.8456,
        longitude: 89.5403,
        radiusKm: 22,
        probabilityPct: 64,
        rateMmh: 6.2,
        sector: 'Coastal Estuarine Inflow',
        status: 'Frequent Maritime Showers'
    },
    {
        id: 'bd-coxs-bazar',
        name: "Cox's Bazar Marine Coast",
        city: "Cox's Bazar",
        country: 'Bangladesh',
        regionKey: 'bangladesh_coxs_bazar',
        latitude: 21.4300,
        longitude: 92.0000,
        radiusKm: 24,
        probabilityPct: 78,
        rateMmh: 10.4,
        sector: 'Southeastern Marine Squall Line',
        status: 'Torrential Coastal Rain'
    },

    // --- Nepal ---
    {
        id: 'np-pokhara-himal',
        name: 'Pokhara Annapurna Rain Basin',
        city: 'Pokhara',
        country: 'Nepal',
        regionKey: 'nepal_pokhara',
        latitude: 28.2200,
        longitude: 83.9900,
        radiusKm: 24,
        probabilityPct: 68,
        rateMmh: 8.9,
        sector: 'Himalayan Frontal Orographic Uplift',
        status: 'High-Altitude Heavy Rain'
    },
    {
        id: 'np-kathmandu-valley',
        name: 'Kathmandu Valley Ridge Catchment',
        city: 'Kathmandu',
        country: 'Nepal',
        regionKey: 'nepal_kathmandu',
        latitude: 27.7100,
        longitude: 85.3350,
        radiusKm: 20,
        probabilityPct: 52,
        rateMmh: 3.8,
        sector: 'Inter-Montane Valley Convection',
        status: 'Mountain Showers'
    },
    {
        id: 'np-biratnagar-terai',
        name: 'Eastern Terai Alluvial Floodplain',
        city: 'Biratnagar',
        country: 'Nepal',
        regionKey: 'nepal_biratnagar',
        latitude: 26.4525,
        longitude: 87.2718,
        radiusKm: 20,
        probabilityPct: 58,
        rateMmh: 5.1,
        sector: 'Sub-Himalayan Moisture Corridor',
        status: 'Monsoon Inflow'
    },

    // --- China ---
    {
        id: 'cn-beijing-yan',
        name: 'Beijing Yan Foothill Moisture Corridor',
        city: 'Beijing',
        country: 'China',
        regionKey: 'china_beijing',
        latitude: 39.9500,
        longitude: 116.3900,
        radiusKm: 24,
        probabilityPct: 44,
        rateMmh: 3.2,
        sector: 'Northern Orographic Lift Corridor',
        status: 'Passing Continental Showers'
    },
    {
        id: 'cn-shanghai-yangtze',
        name: 'Shanghai Yangtze Estuary Front',
        city: 'Shanghai',
        country: 'China',
        regionKey: 'china_shanghai',
        latitude: 31.2450,
        longitude: 121.5100,
        radiusKm: 24,
        probabilityPct: 58,
        rateMmh: 5.6,
        sector: 'East China Sea Maritime Inflow',
        status: 'Coastal Frontal Rain'
    },
    {
        id: 'cn-guangdong-delta',
        name: 'Guangzhou Pearl River Delta Basin',
        city: 'Guangzhou',
        country: 'China',
        regionKey: 'china_guangzhou',
        latitude: 23.1400,
        longitude: 113.3000,
        radiusKm: 24,
        probabilityPct: 64,
        rateMmh: 7.2,
        sector: 'Subtropical Low-Pressure Trough',
        status: 'Convective Rain Cells'
    },
    {
        id: 'cn-shenzhen-bay',
        name: 'Shenzhen Bay Coastal Marine Ridge',
        city: 'Shenzhen',
        country: 'China',
        regionKey: 'china_shenzhen',
        latitude: 22.5431,
        longitude: 114.0579,
        radiusKm: 22,
        probabilityPct: 66,
        rateMmh: 7.8,
        sector: 'South China Sea Squall Line',
        status: 'Active Maritime Downpours'
    },
    {
        id: 'cn-chengdu-basin',
        name: 'Sichuan Basin Moisture Convergence',
        city: 'Chengdu',
        country: 'China',
        regionKey: 'china_chengdu',
        latitude: 30.5728,
        longitude: 104.0668,
        radiusKm: 24,
        probabilityPct: 55,
        rateMmh: 4.5,
        sector: 'Longmen Mountains Orographic Inflow',
        status: 'Humid Basin Showers'
    },
    {
        id: 'cn-chongqing-gorges',
        name: 'Three Gorges & Yangtze Confluence',
        city: 'Chongqing',
        country: 'China',
        regionKey: 'china_chongqing',
        latitude: 29.4316,
        longitude: 106.9123,
        radiusKm: 24,
        probabilityPct: 60,
        rateMmh: 5.8,
        sector: 'Mountain Riverine Cloud Front',
        status: 'Convective Torrent'
    },
    {
        id: 'cn-wuhan-yangtze',
        name: 'Central Yangtze River Floodplain',
        city: 'Wuhan',
        country: 'China',
        regionKey: 'china_wuhan',
        latitude: 30.5928,
        longitude: 114.3055,
        radiusKm: 22,
        probabilityPct: 54,
        rateMmh: 4.4,
        sector: 'Mid-Latitude Frontal Corridor',
        status: 'Steady Frontal Showers'
    },
    {
        id: 'cn-hangzhou-bay',
        name: 'Qiantang River Estuary & West Lake',
        city: 'Hangzhou',
        country: 'China',
        regionKey: 'china_hangzhou',
        latitude: 30.2741,
        longitude: 120.1551,
        radiusKm: 22,
        probabilityPct: 56,
        rateMmh: 4.8,
        sector: 'East Coast Subtropical Surge',
        status: 'Passing Rainbands'
    },
    {
        id: 'cn-hong-kong-harbor',
        name: 'Victoria Harbour & South China Sea Shelf',
        city: 'Hong Kong',
        country: 'China',
        regionKey: 'china_hongkong',
        latitude: 22.3193,
        longitude: 114.1694,
        radiusKm: 22,
        probabilityPct: 68,
        rateMmh: 8.2,
        sector: 'Subtropical Maritime Convergence',
        status: 'Heavy Maritime Squalls'
    },

    // --- Japan ---
    {
        id: 'jp-tokyo-bay',
        name: 'Tokyo Bay Coastal Marine Front',
        city: 'Tokyo',
        country: 'Japan',
        regionKey: 'japan_tokyo',
        latitude: 35.6600,
        longitude: 139.7500,
        radiusKm: 24,
        probabilityPct: 54,
        rateMmh: 4.6,
        sector: 'Pacific Coastal Frontal Boundary',
        status: 'Steady Frontal Rainfall'
    },
    {
        id: 'jp-osaka-bay',
        name: 'Osaka Bay & Yodo River Basin',
        city: 'Osaka',
        country: 'Japan',
        regionKey: 'japan_osaka',
        latitude: 34.6937,
        longitude: 135.5023,
        radiusKm: 22,
        probabilityPct: 48,
        rateMmh: 3.8,
        sector: 'Seto Inland Sea Moisture Channel',
        status: 'Passing Maritime Showers'
    },
    {
        id: 'jp-kyoto-basin',
        name: 'Kyoto Inter-Montane Basin',
        city: 'Kyoto',
        country: 'Japan',
        regionKey: 'japan_kyoto',
        latitude: 35.0116,
        longitude: 135.7681,
        radiusKm: 20,
        probabilityPct: 50,
        rateMmh: 4.0,
        sector: 'Tanba Mountain Orographic Inflow',
        status: 'Valley Mist & Rain'
    },
    {
        id: 'jp-nagoya-bay',
        name: 'Ise Bay Coastal Inflow Corridor',
        city: 'Nagoya',
        country: 'Japan',
        regionKey: 'japan_nagoya',
        latitude: 35.1815,
        longitude: 136.9066,
        radiusKm: 22,
        probabilityPct: 52,
        rateMmh: 4.2,
        sector: 'Pacific Maritime Trough',
        status: 'Coastal Rainbands'
    },
    {
        id: 'jp-sapporo-plain',
        name: 'Ishikari Plain Frontal Boundary',
        city: 'Sapporo',
        country: 'Japan',
        regionKey: 'japan_sapporo',
        latitude: 43.0618,
        longitude: 141.3545,
        radiusKm: 24,
        probabilityPct: 58,
        rateMmh: 5.0,
        sector: 'Sea of Japan Cold Front',
        status: 'Steady Frontal Precipitation'
    },
    {
        id: 'jp-fukuoka-bay',
        name: 'Hakata Bay Maritime Front',
        city: 'Fukuoka',
        country: 'Japan',
        regionKey: 'japan_fukuoka',
        latitude: 33.5904,
        longitude: 130.4017,
        radiusKm: 22,
        probabilityPct: 54,
        rateMmh: 4.6,
        sector: 'Tsushima Strait Marine Surge',
        status: 'Convective Showers'
    },

    // --- South Korea ---
    {
        id: 'kr-seoul-han',
        name: 'Han River Basin & Bukhansan Ridge',
        city: 'Seoul',
        country: 'South Korea',
        regionKey: 'korea_seoul',
        latitude: 37.5665,
        longitude: 126.9780,
        radiusKm: 22,
        probabilityPct: 48,
        rateMmh: 3.6,
        sector: 'Yellow Sea Frontal Inflow',
        status: 'Passing Monsoon Showers'
    },
    {
        id: 'kr-busan-strait',
        name: 'Busan Coastal Marine Front',
        city: 'Busan',
        country: 'South Korea',
        regionKey: 'korea_busan',
        latitude: 35.1796,
        longitude: 129.0756,
        radiusKm: 24,
        probabilityPct: 58,
        rateMmh: 5.4,
        sector: 'Korea Strait Maritime Trough',
        status: 'Steady Coastal Rainband'
    },
    {
        id: 'kr-incheon-port',
        name: 'Incheon Port & Coastal Tidal Shelf',
        city: 'Incheon',
        country: 'South Korea',
        regionKey: 'korea_incheon',
        latitude: 37.4563,
        longitude: 126.7052,
        radiusKm: 22,
        probabilityPct: 46,
        rateMmh: 3.4,
        sector: 'Yellow Sea Maritime Inflow',
        status: 'Maritime Cloud Surge'
    },

    // --- Southeast Asia ---
    {
        id: 'th-bangkok-delta',
        name: 'Chao Phraya Delta & Gulf Inflow',
        city: 'Bangkok',
        country: 'Thailand',
        regionKey: 'thailand_bangkok',
        latitude: 13.7563,
        longitude: 100.5018,
        radiusKm: 24,
        probabilityPct: 62,
        rateMmh: 6.5,
        sector: 'Tropical Monsoon Convergence',
        status: 'Afternoon Monsoon Torrent'
    },
    {
        id: 'sg-singapore-strait',
        name: 'Singapore Strait Marine Front',
        city: 'Singapore',
        country: 'Singapore',
        regionKey: 'singapore',
        latitude: 1.3521,
        longitude: 103.8198,
        radiusKm: 22,
        probabilityPct: 65,
        rateMmh: 7.2,
        sector: 'Equatorial Trough Convection',
        status: 'Active Tropical Downpours'
    },
    {
        id: 'my-kl-valley',
        name: 'Klang River Valley Corridor',
        city: 'Kuala Lumpur',
        country: 'Malaysia',
        regionKey: 'malaysia_kl',
        latitude: 3.1390,
        longitude: 101.6869,
        radiusKm: 22,
        probabilityPct: 66,
        rateMmh: 7.6,
        sector: 'Strait of Malacca Convective Line',
        status: 'Convective Thunderstorms'
    },
    {
        id: 'id-jakarta-bay',
        name: 'Jakarta Bay & Ciliwung Basin',
        city: 'Jakarta',
        country: 'Indonesia',
        regionKey: 'indonesia_jakarta',
        latitude: -6.2088,
        longitude: 106.8456,
        radiusKm: 24,
        probabilityPct: 60,
        rateMmh: 6.8,
        sector: 'Java Sea Coastal Convective Front',
        status: 'Tropical Coastal Showers'
    },
    {
        id: 'ph-manila-bay',
        name: 'Manila Bay & Pasig River Catchment',
        city: 'Manila',
        country: 'Philippines',
        regionKey: 'philippines_manila',
        latitude: 14.5995,
        longitude: 120.9842,
        radiusKm: 24,
        probabilityPct: 70,
        rateMmh: 9.2,
        sector: 'South China Sea Monsoon Squall',
        status: 'Intense Monsoon Downpours'
    },
    {
        id: 'vn-hcmc-delta',
        name: 'Saigon River & Mekong Delta Fringe',
        city: 'Ho Chi Minh City',
        country: 'Vietnam',
        regionKey: 'vietnam_hcmc',
        latitude: 10.8231,
        longitude: 106.6297,
        radiusKm: 24,
        probabilityPct: 64,
        rateMmh: 7.0,
        sector: 'Equatorial Monsoon Trough',
        status: 'Tropical Heavy Showers'
    },
    {
        id: 'vn-hanoi-redriver',
        name: 'Red River Alluvial Delta Basin',
        city: 'Hanoi',
        country: 'Vietnam',
        regionKey: 'vietnam_hanoi',
        latitude: 21.0285,
        longitude: 105.8542,
        radiusKm: 22,
        probabilityPct: 58,
        rateMmh: 5.6,
        sector: 'Tonkin Gulf Maritime Inflow',
        status: 'Steady Monsoon Rain'
    },

    // --- Central Asia ---
    {
        id: 'uz-tashkent-basin',
        name: 'Chirchiq River Basin Corridor',
        city: 'Tashkent',
        country: 'Uzbekistan',
        regionKey: 'uzbekistan_tashkent',
        latitude: 41.2995,
        longitude: 69.2401,
        radiusKm: 22,
        probabilityPct: 28,
        rateMmh: 1.4,
        sector: 'Western Tian Shan Foothill Surge',
        status: 'Scattered Cloud Inflow'
    },
    {
        id: 'kz-almaty-slope',
        name: 'Ile-Alatau Northern Slope Catchment',
        city: 'Almaty',
        country: 'Kazakhstan',
        regionKey: 'kazakhstan_almaty',
        latitude: 43.2220,
        longitude: 76.8512,
        radiusKm: 22,
        probabilityPct: 42,
        rateMmh: 2.8,
        sector: 'Tian Shan Orographic Inflow',
        status: 'Convective Mountain Showers'
    },
    {
        id: 'kg-bishkek-plain',
        name: 'Kyrgyz Ala-Too Foothill Plain',
        city: 'Bishkek',
        country: 'Kyrgyzstan',
        regionKey: 'kyrgyzstan_bishkek',
        latitude: 42.8746,
        longitude: 74.5698,
        radiusKm: 20,
        probabilityPct: 38,
        rateMmh: 2.2,
        sector: 'Inter-Montane Moisture Channel',
        status: 'Passing Mountain Rain'
    },
    {
        id: 'tj-dushanbe-gorge',
        name: 'Varzob River Gorge Basin',
        city: 'Dushanbe',
        country: 'Tajikistan',
        regionKey: 'tajikistan_dushanbe',
        latitude: 38.5598,
        longitude: 68.7870,
        radiusKm: 20,
        probabilityPct: 36,
        rateMmh: 2.0,
        sector: 'Hissar Range Inflow Corridor',
        status: 'Valley Showers'
    },
    {
        id: 'tm-ashgabat-fringe',
        name: 'Kopet Dag Foothill Fringe',
        city: 'Ashgabat',
        country: 'Turkmenistan',
        regionKey: 'turkmenistan_ashgabat',
        latitude: 37.9601,
        longitude: 58.3261,
        radiusKm: 20,
        probabilityPct: 18,
        rateMmh: 0.8,
        sector: 'Sub-Desert Foothill Inflow',
        status: 'Isolated Cloud Fringe'
    },

    // --- West Asia & Middle East ---
    {
        id: 'ae-dubai-shelf',
        name: 'Arabian Gulf Coastal Marine Shelf',
        city: 'Dubai',
        country: 'United Arab Emirates',
        regionKey: 'uae_dubai',
        latitude: 25.2200,
        longitude: 55.2600,
        radiusKm: 20,
        probabilityPct: 32,
        rateMmh: 2.4,
        sector: 'Gulf Marine Moisture Inflow',
        status: 'Coastal Marine Cloud Surge'
    },
    {
        id: 'ae-abudhabi-mangrove',
        name: 'Abu Dhabi Coastal Mangrove Inflow',
        city: 'Abu Dhabi',
        country: 'United Arab Emirates',
        regionKey: 'uae_abudhabi',
        latitude: 24.4539,
        longitude: 54.3773,
        radiusKm: 20,
        probabilityPct: 24,
        rateMmh: 1.2,
        sector: 'Arabian Gulf Coastal Front',
        status: 'Scattered Coastal Inflow'
    },
    {
        id: 'sa-riyadh-hanifa',
        name: 'Wadi Hanifa Drainage Corridor',
        city: 'Riyadh',
        country: 'Saudi Arabia',
        regionKey: 'saudi_riyadh',
        latitude: 24.6800,
        longitude: 46.6700,
        radiusKm: 20,
        probabilityPct: 20,
        rateMmh: 0.8,
        sector: 'Najd Plateau Inflow Corridor',
        status: 'Desert Cloud Fringe'
    },
    {
        id: 'qa-doha-shelf',
        name: 'Qatar Peninsula Coastal Shelf',
        city: 'Doha',
        country: 'Qatar',
        regionKey: 'qatar_doha',
        latitude: 25.2854,
        longitude: 51.5310,
        radiusKm: 20,
        probabilityPct: 26,
        rateMmh: 1.4,
        sector: 'Gulf Maritime Moisture Tongue',
        status: 'Passing Coastal Cloud'
    },
    {
        id: 'om-muscat-hajar',
        name: 'Sea of Oman Coastal Shelf',
        city: 'Muscat',
        country: 'Oman',
        regionKey: 'oman_muscat',
        latitude: 23.5880,
        longitude: 58.3829,
        radiusKm: 22,
        probabilityPct: 35,
        rateMmh: 2.2,
        sector: 'Al Hajar Mountain Orographic Inflow',
        status: 'Coastal Hill Showers'
    },
    {
        id: 'ir-tehran-alborz',
        name: 'Alborz Mountain Slope Catchment',
        city: 'Tehran',
        country: 'Iran',
        regionKey: 'iran_tehran',
        latitude: 35.6892,
        longitude: 51.3890,
        radiusKm: 22,
        probabilityPct: 30,
        rateMmh: 1.6,
        sector: 'Northern Slope Orographic Channel',
        status: 'Passing Mountain Rain'
    },
    {
        id: 'af-kabul-basin',
        name: 'Kabul River Valley & Paghman Basin',
        city: 'Kabul',
        country: 'Afghanistan',
        regionKey: 'afghanistan_kabul',
        latitude: 34.5553,
        longitude: 69.2075,
        radiusKm: 20,
        probabilityPct: 34,
        rateMmh: 1.8,
        sector: 'Hindu Kush Southern Slope Inflow',
        status: 'Convective Valley Showers'
    },
    {
        id: 'iq-baghdad-tigris',
        name: 'Tigris River Valley Basin',
        city: 'Baghdad',
        country: 'Iraq',
        regionKey: 'iraq_baghdad',
        latitude: 33.3152,
        longitude: 44.3661,
        radiusKm: 22,
        probabilityPct: 22,
        rateMmh: 1.0,
        sector: 'Mesopotamian Alluvial Corridor',
        status: 'Scattered Riverine Inflow'
    },
    {
        id: 'tr-istanbul-bosphorus',
        name: 'Bosphorus Strait Marine Front',
        city: 'Istanbul',
        country: 'Turkey',
        regionKey: 'turkey_istanbul',
        latitude: 41.0082,
        longitude: 28.9784,
        radiusKm: 24,
        probabilityPct: 55,
        rateMmh: 4.5,
        sector: 'Black Sea Coastal Frontal Trough',
        status: 'Steady Maritime Rainfall'
    },
    {
        id: 'az-baku-caspian',
        name: 'Absheron Peninsula Coastal Front',
        city: 'Baku',
        country: 'Azerbaijan',
        regionKey: 'azerbaijan_baku',
        latitude: 40.4093,
        longitude: 49.8671,
        radiusKm: 22,
        probabilityPct: 38,
        rateMmh: 2.2,
        sector: 'Caspian Sea Maritime Inflow',
        status: 'Coastal Wind & Rain'
    },
    {
        id: 'ge-tbilisi-kura',
        name: 'Kura River Inter-Montane Basin',
        city: 'Tbilisi',
        country: 'Georgia',
        regionKey: 'georgia_tbilisi',
        latitude: 41.7151,
        longitude: 44.8271,
        radiusKm: 20,
        probabilityPct: 44,
        rateMmh: 3.0,
        sector: 'Caucasus Valley Moisture Corridor',
        status: 'Passing Mountain Showers'
    },
    {
        id: 'am-yerevan-ararat',
        name: 'Ararat Valley Basin Corridor',
        city: 'Yerevan',
        country: 'Armenia',
        regionKey: 'armenia_yerevan',
        latitude: 40.1792,
        longitude: 44.4991,
        radiusKm: 20,
        probabilityPct: 36,
        rateMmh: 2.0,
        sector: 'High Plateau Convective Inflow',
        status: 'Isolated High-Altitude Showers'
    },
    {
        id: 'mn-ulaanbaatar-tuul',
        name: 'Tuul River Valley Corridor',
        city: 'Ulaanbaatar',
        country: 'Mongolia',
        regionKey: 'mongolia_ulaanbaatar',
        latitude: 47.9184,
        longitude: 106.9177,
        radiusKm: 22,
        probabilityPct: 32,
        rateMmh: 1.6,
        sector: 'Khentii Mountain Inflow Basin',
        status: 'Passing Continental Showers'
    },
    {
        id: 'lk-colombo-kelani',
        name: 'Kelani River Estuary & Marine Coast',
        city: 'Colombo',
        country: 'Sri Lanka',
        regionKey: 'srilanka_colombo',
        latitude: 6.9271,
        longitude: 79.8612,
        radiusKm: 24,
        probabilityPct: 68,
        rateMmh: 8.4,
        sector: 'Indian Ocean Monsoon Front',
        status: 'Tropical Coastal Downpours'
    },
    {
        id: 'mv-male-atoll',
        name: 'North Male Atoll Oceanic Front',
        city: 'Male',
        country: 'Maldives',
        regionKey: 'maldives_male',
        latitude: 4.1755,
        longitude: 73.5093,
        radiusKm: 20,
        probabilityPct: 62,
        rateMmh: 6.8,
        sector: 'Equatorial Marine Convection',
        status: 'Active Atoll Showers'
    },
    {
        id: 'bt-thimphu-raidak',
        name: 'Raidak River Himalayan Basin',
        city: 'Thimphu',
        country: 'Bhutan',
        regionKey: 'bhutan_thimphu',
        latitude: 27.4728,
        longitude: 89.6393,
        radiusKm: 20,
        probabilityPct: 54,
        rateMmh: 4.4,
        sector: 'Himalayan Ridge Orographic Uplift',
        status: 'Alpine Mist & Showers'
    }
];

// Backward-compatible alias for existing imports
export const REGIONAL_PRECIPITATION_ZONES = MASTER_PRECIPITATION_REGISTRY;;

let _radarSweepAngle = 0.0;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getLiveTemperature(data = _currentClimateData) {
    const value = data?.climate_perception?.dry_bulb_temperature_c
        ?? data?.temperature_celsius
        ?? data?.telemetry?.temperature_celsius;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getCityMicroclimateThermalTiers(centerLat, centerLon, baseTemp, cityName = '') {
    const nameLower = String(cityName || '').toLowerCase();
    const isMultan = nameLower.includes('multan');
    const isKarachi = nameLower.includes('karachi');
    const isLahore = nameLower.includes('lahore');
    const isIslamabad = nameLower.includes('islamabad') || nameLower.includes('rawalpindi');
    const isBeijing = nameLower.includes('beijing') || nameLower.includes('peking');
    const isTokyo = nameLower.includes('tokyo');
    const isShanghai = nameLower.includes('shanghai');
    const isDelhi = nameLower.includes('delhi');
    const isMumbai = nameLower.includes('mumbai') || nameLower.includes('bombay');
    const isDhaka = nameLower.includes('dhaka') || nameLower.includes('dacca');
    const isDubai = nameLower.includes('dubai');
    const isAbuDhabi = nameLower.includes('abu dhabi') || nameLower.includes('abudhabi');
    const isRiyadh = nameLower.includes('riyadh');
    const isBangkok = nameLower.includes('bangkok');
    const isSingapore = nameLower.includes('singapore');
    const isGilgit = nameLower.includes('gilgit');
    const isSkardu = nameLower.includes('skardu');
    const isSwat = nameLower.includes('swat') || nameLower.includes('mingora');
    const isPeshawar = nameLower.includes('peshawar');
    const isQuetta = nameLower.includes('quetta');

    return function evaluateSample(sampleLat, sampleLon, rawTemp) {
        const dLat = (sampleLat - centerLat) * 111.0;
        const dLon = (sampleLon - centerLon) * 111.0 * Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
        const distKm = Math.hypot(dLat, dLon);
        const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

        let delta = 0;
        let tier = 'suburban';
        let zoneLabel = 'Suburban Residential Belt';
        let color = '#EAB308'; // Default Golden Yellow
        let stress = 'Moderate Caution';
        let isKeyAnchor = false;

        if (isBeijing) {
            // Beijing Authentic Geography:
            // 1. Chaoyang CBD, Sanlitun, Wangfujing, Dongcheng/Xicheng: Intense concrete & skyscraper UHI Core (+4.2°C)
            // 2. Haidian Zhongguancun Tech Axis (NW): Dense tech campuses & data centers (+2.8°C)
            // 3. Yizhuang / Fengtai Logistics Corridor (South/SE): Warehousing & industrial emissions (+2.4°C)
            // 4. Summer Palace (Kunming Lake), Olympic Forest Park & Chaoyang Park: Evaporative water & forest buffer (-3.6°C)
            // 5. Western Hills (Xishan) & Northern Yan Mountains: High elevation alpine pine/oak ridges (-5.8°C)
            // 6. Suburban Residential Belt: (+0.6°C)
            if (distKm <= 4.2 || (distKm <= 6.8 && (bearing >= 50 && bearing <= 160))) {
                delta = +4.2;
                tier = 'core';
                zoneLabel = 'Chaoyang CBD / Wangfujing High-Density Core';
                color = '#DC2626'; // Vivid Red
                stress = 'Critical Urban Heat Island';
                if (distKm <= 2.5) isKeyAnchor = true;
            } else if ((bearing >= 290 && bearing <= 345) && distKm <= 11.5) {
                delta = +2.8;
                tier = 'commercial';
                zoneLabel = 'Haidian Zhongguancun Technology Axis';
                color = '#EA580C'; // Warm Orange
                stress = 'Elevated Built Environment';
            } else if ((bearing >= 140 && bearing <= 215) && distKm <= 16.0) {
                delta = +2.4;
                tier = 'industrial';
                zoneLabel = 'Yizhuang / Fengtai Freight & Logistics Corridor';
                color = '#EA580C';
                stress = 'High Logistics Thermal Load';
            } else if ((bearing >= 325 || bearing <= 35) && distKm >= 5.5 && distKm <= 12.0) {
                delta = -3.6;
                tier = 'riverine';
                zoneLabel = 'Summer Palace (Kunming Lake) & Olympic Forest Park';
                color = '#06B6D4'; // Marine/Cool Cyan
                stress = 'Evaporative Water & Forest Buffer';
                isKeyAnchor = true;
            } else if ((bearing >= 240 && bearing <= 310 && distKm >= 11.0) || (bearing <= 45 && distKm >= 14.0)) {
                delta = -5.8;
                tier = 'buffer';
                zoneLabel = 'Western Hills (Xishan) & Yan Mountain Forest Ridge';
                color = '#10B981'; // Cool Emerald Green
                stress = 'Alpine Mountain Cooling Buffer';
                isKeyAnchor = true;
            } else {
                delta = +0.6;
                tier = 'residential';
                zoneLabel = 'Tongzhou / Shunyi Metropolitan Residential Belt';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isTokyo) {
            // Tokyo Authentic Geography: Shinjuku/Ginza core vs Tokyo Bay coastal marine breeze vs Imperial Palace/Yoyogi forest
            if (distKm <= 4.5) {
                delta = +4.4;
                tier = 'core';
                zoneLabel = 'Shinjuku / Ginza High-Rise Commercial Core';
                color = '#DC2626';
                stress = 'Critical Urban Heat Island';
                isKeyAnchor = true;
            } else if (bearing >= 90 && bearing <= 180 && distKm <= 15.0) {
                delta = -4.0;
                tier = 'marine';
                zoneLabel = 'Tokyo Bay Coastal Shelf & Sumida Riparian Corridor';
                color = '#06B6D4';
                stress = 'Maritime Sea-Breeze Cooling Buffer';
                isKeyAnchor = true;
            } else if (distKm <= 4.2 && (bearing >= 180 && bearing <= 260)) {
                delta = -3.2;
                tier = 'buffer';
                zoneLabel = 'Imperial Palace East Gardens & Yoyogi Urban Forest';
                color = '#10B981';
                stress = 'Vegetative Thermal Sink';
            } else if (bearing >= 240 && bearing <= 300 && distKm >= 10.0) {
                delta = -5.6;
                tier = 'buffer';
                zoneLabel = 'Western Tama Mountain Forest Foothills';
                color = '#10B981';
                stress = 'Sub-Montane Forest Buffer';
                isKeyAnchor = true;
            } else {
                delta = +0.8;
                tier = 'residential';
                zoneLabel = 'Tokyo Metropolitan Residential Grid';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isShanghai) {
            // Shanghai: Lujiazui CBD vs Huangpu River / Suzhou Creek vs East China Sea coastal shelf
            if (distKm <= 4.8) {
                delta = +4.6;
                tier = 'core';
                zoneLabel = 'Lujiazui Financial District & Puxi Core';
                color = '#DC2626';
                stress = 'Severe Concrete Heat Island';
                isKeyAnchor = true;
            } else if ((bearing >= 300 && bearing <= 360 && distKm <= 12.0) || (bearing >= 120 && bearing <= 180 && distKm <= 8.0)) {
                delta = -3.6;
                tier = 'riverine';
                zoneLabel = 'Huangpu River & Suzhou Creek Water Corridor';
                color = '#06B6D4';
                stress = 'Evaporative Riparian Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 60 && bearing <= 140 && distKm >= 9.0) {
                delta = -4.5;
                tier = 'marine';
                zoneLabel = 'Yangtze Estuary & East China Sea Marine Shelf';
                color = '#06B6D4';
                stress = 'Maritime Cooling Corridor';
                isKeyAnchor = true;
            } else if (bearing >= 190 && bearing <= 260 && distKm <= 15.0) {
                delta = +2.8;
                tier = 'industrial';
                zoneLabel = 'Baoshan / Minhang Heavy Industrial Axis';
                color = '#EA580C';
                stress = 'High Industrial Thermal Load';
            } else {
                delta = +0.7;
                tier = 'residential';
                zoneLabel = 'Pudong / Puxi Mixed Residential Belt';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isDelhi) {
            // Delhi NCR: Connaught Place / Old Delhi core vs Yamuna River vs Delhi Ridge forest reserve
            if (distKm <= 4.5) {
                delta = +4.8;
                tier = 'core';
                zoneLabel = 'Connaught Place & Old Delhi Historic Core';
                color = '#DC2626';
                stress = 'Critical Heat Dome Island';
                isKeyAnchor = true;
            } else if (bearing >= 45 && bearing <= 135 && distKm <= 10.0) {
                delta = -3.8;
                tier = 'riverine';
                zoneLabel = 'Yamuna River Wetlands & Riparian Floodplain';
                color = '#06B6D4';
                stress = 'Evaporative Cooling Corridor';
                isKeyAnchor = true;
            } else if (bearing >= 200 && bearing <= 280 && distKm <= 9.0) {
                delta = -4.4;
                tier = 'buffer';
                zoneLabel = 'Delhi Ridge Forest Reserve & Bio-Diversity Park';
                color = '#10B981';
                stress = 'Vegetative Thermal Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 140 && bearing <= 190 && distKm <= 13.0) {
                delta = +3.0;
                tier = 'industrial';
                zoneLabel = 'Okhla / Mayapuri Manufacturing & Freight Axis';
                color = '#EA580C';
                stress = 'Elevated Heat Load';
            } else {
                delta = +0.9;
                tier = 'residential';
                zoneLabel = 'NCR Mixed Tree-Lined Residential Sectors';
                color = '#EAB308';
                stress = 'Moderate Thermal Load';
            }
        } else if (isMumbai) {
            // Mumbai: BKC / South Mumbai core vs Arabian Sea marine shelf vs Sanjay Gandhi National Park
            if (distKm <= 4.5) {
                delta = +4.2;
                tier = 'core';
                zoneLabel = 'Bandra-Kurla Complex (BKC) & South Mumbai Core';
                color = '#DC2626';
                stress = 'Intense Concrete Thermal Core';
                isKeyAnchor = true;
            } else if (bearing >= 200 && bearing <= 310 && distKm <= 12.0) {
                delta = -4.2;
                tier = 'marine';
                zoneLabel = 'Arabian Sea Coastal Shelf & Marine Drive';
                color = '#06B6D4';
                stress = 'Maritime Sea-Breeze Cooling Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 0 && bearing <= 70 && distKm >= 6.0) {
                delta = -5.2;
                tier = 'buffer';
                zoneLabel = 'Sanjay Gandhi National Park & Reservoir Catchment';
                color = '#10B981';
                stress = 'Tropical Rainforest Thermal Sink';
                isKeyAnchor = true;
            } else if (bearing >= 80 && bearing <= 150 && distKm <= 15.0) {
                delta = +2.2;
                tier = 'industrial';
                zoneLabel = 'Thane Belapur Industrial Corridor';
                color = '#EA580C';
                stress = 'Elevated Heat Load';
            } else {
                delta = +0.8;
                tier = 'residential';
                zoneLabel = 'Greater Mumbai Residential Belt';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isDhaka) {
            if (distKm <= 4.2) {
                delta = +4.6;
                tier = 'core';
                zoneLabel = 'Motijheel & Kawran Bazar High-Density Core';
                color = '#DC2626';
                stress = 'Critical Urban Heat Island';
                isKeyAnchor = true;
            } else if (bearing >= 160 && bearing <= 240 && distKm <= 9.0) {
                delta = -3.6;
                tier = 'riverine';
                zoneLabel = 'Buriganga & Turag River Riparian Basin';
                color = '#06B6D4';
                stress = 'Riparian Cooling Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 30 && bearing <= 90 && distKm <= 5.5) {
                delta = -3.0;
                tier = 'riverine';
                zoneLabel = 'Hatirjheel Ecological Water Retention Basin';
                color = '#06B6D4';
                stress = 'Evaporative Cooling Sink';
            } else {
                delta = +0.7;
                tier = 'residential';
                zoneLabel = 'Dhaka Northern Mixed Residential Belt';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isDubai || isAbuDhabi) {
            if (distKm <= 4.2) {
                delta = +4.8;
                tier = 'core';
                zoneLabel = 'Downtown & Sheikh Zayed Rd Skyscraper Canyon';
                color = '#DC2626';
                stress = 'Extreme Concrete & Glass Heat Core';
                isKeyAnchor = true;
            } else if (bearing >= 270 && bearing <= 360 && distKm <= 11.0) {
                delta = -4.0;
                tier = 'marine';
                zoneLabel = 'Arabian Gulf Coastal Shelf & Jumeirah Coast';
                color = '#06B6D4';
                stress = 'Maritime Cooling Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 45 && bearing <= 120 && distKm <= 7.5) {
                delta = -3.4;
                tier = 'riverine';
                zoneLabel = 'Dubai Creek & Ras Al Khor Wetland Reserve';
                color = '#06B6D4';
                stress = 'Riparian Wetland Buffer';
            } else if (bearing >= 130 && bearing <= 220 && distKm >= 6.0) {
                delta = +2.2;
                tier = 'buffer';
                zoneLabel = 'Inland Hyper-Arid Desert Fringe';
                color = '#EA580C';
                stress = 'Solar Radiation Surge';
            } else {
                delta = +0.8;
                tier = 'residential';
                zoneLabel = 'Metropolitan Residential & Marina Sector';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isRiyadh) {
            if (distKm <= 4.5) {
                delta = +4.6;
                tier = 'core';
                zoneLabel = 'King Fahd Road & Olaya Commercial Axis';
                color = '#DC2626';
                stress = 'Severe Urban Heat Basin';
                isKeyAnchor = true;
            } else if (bearing >= 210 && bearing <= 290 && distKm <= 10.0) {
                delta = -4.4;
                tier = 'riverine';
                zoneLabel = 'Wadi Hanifa Oasis & Ecological Wetland Valley';
                color = '#10B981';
                stress = 'Evaporative Riparian Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 290 && bearing <= 350 && distKm <= 12.0) {
                delta = -2.2;
                tier = 'buffer';
                zoneLabel = 'Diriyah Historic Oasis & Palm Agro-Farms';
                color = '#84CC16';
                stress = 'Vegetative Thermal Buffer';
            } else {
                delta = +1.0;
                tier = 'residential';
                zoneLabel = 'Riyadh Northern Residential Corridor';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isBangkok) {
            if (distKm <= 4.5) {
                delta = +4.6;
                tier = 'core';
                zoneLabel = 'Siam / Sukhumvit Dense Concrete Core';
                color = '#DC2626';
                stress = 'Critical Urban Heat Island';
                isKeyAnchor = true;
            } else if (bearing >= 220 && bearing <= 310 && distKm <= 8.0) {
                delta = -3.6;
                tier = 'riverine';
                zoneLabel = 'Chao Phraya River Cooling Artery';
                color = '#06B6D4';
                stress = 'Evaporative Riparian Corridor';
                isKeyAnchor = true;
            } else if (bearing >= 140 && bearing <= 190 && distKm >= 4.5 && distKm <= 12.0) {
                delta = -4.8;
                tier = 'buffer';
                zoneLabel = 'Bang Kachao Forest Island (Green Lung)';
                color = '#10B981';
                stress = 'Dense Tropical Canopy Thermal Sink';
                isKeyAnchor = true;
            } else {
                delta = +0.8;
                tier = 'residential';
                zoneLabel = 'Bangkok Northern Metropolitan Belt';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isSingapore) {
            if (distKm <= 4.0) {
                delta = +3.8;
                tier = 'core';
                zoneLabel = 'Marina Bay / Shenton Way High-Rise CBD Core';
                color = '#DC2626';
                stress = 'High Density Heat Island';
                isKeyAnchor = true;
            } else if (bearing >= 280 && bearing <= 360 && distKm >= 4.0 && distKm <= 12.0) {
                delta = -4.8;
                tier = 'buffer';
                zoneLabel = 'Central Catchment Rainforest & Reservoir Sanctuary';
                color = '#10B981';
                stress = 'Rainforest Evaporative Thermal Sink';
                isKeyAnchor = true;
            } else if (bearing >= 100 && bearing <= 190 && distKm <= 9.0) {
                delta = -3.2;
                tier = 'marine';
                zoneLabel = 'Singapore Strait Coastal Shelf';
                color = '#06B6D4';
                stress = 'Maritime Cooling Buffer';
            } else if (bearing >= 230 && bearing <= 280 && distKm >= 7.0) {
                delta = +2.8;
                tier = 'industrial';
                zoneLabel = 'Jurong Heavy Industrial & Petrochemical Axis';
                color = '#EA580C';
                stress = 'Industrial Thermal Emission';
            } else {
                delta = +0.5;
                tier = 'residential';
                zoneLabel = 'HDB Tree-Lined Residential Towns';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            }
        } else if (isGilgit || isSkardu) {
            // Northern Alpine Pakistan (Gilgit / Skardu): Arid canyon floor heat trap vs glacial rivers and Karakoram snowfields
            if (distKm <= 3.0) {
                delta = +2.2;
                tier = 'commercial';
                zoneLabel = isGilgit ? 'Gilgit Bazaar / Arid Rock Valley Floor' : 'Skardu Cold Desert Sandy Basin Floor';
                color = '#EA580C';
                stress = 'Confined Valley Radiation Trap';
                isKeyAnchor = true;
            } else if ((bearing >= 100 && bearing <= 200) && distKm <= 6.0) {
                delta = -3.4;
                tier = 'riverine';
                zoneLabel = isGilgit ? 'Gilgit & Hunza River Glacial Melt Shelf' : 'Indus River Braided Glacial Channel';
                color = '#06B6D4';
                stress = 'Glacial Melt Water Buffer';
                isKeyAnchor = true;
            } else if ((bearing >= 280 || bearing <= 70) && distKm >= 4.0) {
                delta = -7.4;
                tier = 'buffer';
                zoneLabel = isGilgit ? 'Naltar Alpine Glacial Ridges & Snowline' : 'Satpara Lake & Deosai Plateau Glaciers';
                color = '#10B981';
                stress = 'High-Altitude Alpine Glacial Buffer';
                isKeyAnchor = true;
            } else {
                delta = -1.5;
                tier = 'buffer';
                zoneLabel = 'Agro-Forestry Terraced Orchards';
                color = '#84CC16';
                stress = 'Terraced Canopy Buffer';
            }
        } else if (isSwat) {
            if (distKm <= 3.2) {
                delta = +3.2;
                tier = 'core';
                zoneLabel = 'Mingora Urban Core / Saidu Sharif Floor';
                color = '#EA580C';
                stress = 'Confined Valley Thermal Load';
                isKeyAnchor = true;
            } else if (bearing >= 170 && bearing <= 250 && distKm <= 7.0) {
                delta = -3.0;
                tier = 'riverine';
                zoneLabel = 'Swat Riverbed & Riparian Agro-Belt';
                color = '#06B6D4';
                stress = 'Riparian Cooling Buffer';
                isKeyAnchor = true;
            } else if (distKm >= 6.0 && (bearing <= 70 || bearing >= 310)) {
                delta = -6.6;
                tier = 'buffer';
                zoneLabel = 'Malam Jabba & Hindu Kush Mountain Forest Ridges';
                color = '#10B981';
                stress = 'Alpine Pine Forest Buffer';
                isKeyAnchor = true;
            } else {
                delta = -0.5;
                tier = 'residential';
                zoneLabel = 'Swat Valley Agricultural Terraces';
                color = '#84CC16';
                stress = 'Nominal Foothill Buffer';
            }
        } else if (isPeshawar) {
            if (distKm <= 3.8) {
                delta = +4.5;
                tier = 'core';
                zoneLabel = 'Walled City / Qissa Khwani Historic Core';
                color = '#DC2626';
                stress = 'Critical Concrete Basin';
                isKeyAnchor = true;
            } else if (bearing >= 300 || bearing <= 30 && distKm <= 9.0) {
                delta = -3.8;
                tier = 'riverine';
                zoneLabel = 'Warsak & Kabul River Irrigation Canal Delta';
                color = '#06B6D4';
                stress = 'Riparian Agro Cooling Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 210 && bearing <= 280 && distKm <= 12.0) {
                delta = +1.0;
                tier = 'residential';
                zoneLabel = 'Hayatabad & Regi Model Town Residential';
                color = '#EAB308';
                stress = 'Nominal Thermal Load';
            } else {
                delta = -1.2;
                tier = 'buffer';
                zoneLabel = 'Peshawar Valley Agricultural Belt';
                color = '#84CC16';
                stress = 'Vegetative Buffer';
            }
        } else if (isQuetta) {
            if (distKm <= 3.5) {
                delta = +4.0;
                tier = 'core';
                zoneLabel = 'Quetta City Center / Liaquat Bazaar Basin';
                color = '#DC2626';
                stress = 'Inter-Montane Basin Heat Island';
                isKeyAnchor = true;
            } else if (bearing >= 40 && bearing <= 100 && distKm <= 10.0) {
                delta = -5.6;
                tier = 'riverine';
                zoneLabel = 'Hanna Lake & Zarghoon Mountain Oasis';
                color = '#06B6D4';
                stress = 'High-Altitude Wetland Buffer';
                isKeyAnchor = true;
            } else if (distKm >= 6.0 && (bearing >= 210 && bearing <= 300)) {
                delta = -4.8;
                tier = 'buffer';
                zoneLabel = 'Chiltan Limestone Mountain Ridges';
                color = '#10B981';
                stress = 'Sub-Montane Elevation Buffer';
                isKeyAnchor = true;
            } else {
                delta = +0.5;
                tier = 'residential';
                zoneLabel = 'Samungli & Cantt Residential Perimeter';
                color = '#EAB308';
                stress = 'Nominal Basin Load';
            }
        } else if (isMultan) {
            // Multan microclimate: Central Cantt/Old City is severe heat island, Chenab river to the west is cooler
            if (distKm <= 3.2) {
                delta = +4.5;
                tier = 'core';
                zoneLabel = 'Old Walled City / Cantt Urban Core';
                color = '#DC2626'; // Vivid Red
                stress = 'Critical Urban Heat Island';
                isKeyAnchor = true;
            } else if (distKm <= 7.0 && (bearing >= 120 && bearing <= 210)) {
                delta = +2.6;
                tier = 'industrial';
                zoneLabel = 'Vehari Road / Industrial Axis';
                color = '#EA580C'; // Warm Orange
                stress = 'Elevated Heat Stress';
            } else if (distKm <= 7.5 && (bearing >= 330 || bearing <= 45)) {
                delta = +0.8;
                tier = 'residential';
                zoneLabel = 'Bosan Road / New Multan Residential';
                color = '#FACC15'; // Yellow
                stress = 'Moderate Thermal Load';
            } else if (bearing >= 220 && bearing <= 310) {
                delta = -3.5;
                tier = 'riverine';
                zoneLabel = 'Chenab River Corridor & Agro-Periphery';
                color = '#10B981'; // Cool Emerald Green
                stress = 'Nominal / Moderated Buffer';
                isKeyAnchor = true;
            } else {
                delta = -1.2;
                tier = 'buffer';
                zoneLabel = 'Peri-Urban Agricultural Belt';
                color = '#84CC16'; // Lime
                stress = 'Mild Thermal Buffer';
            }
        } else if (isKarachi) {
            // Karachi microclimate: Central Saddar/SITE is intense heat island, Clifton/Coast is marine cooled
            if (distKm <= 4.0 && sampleLat >= centerLat) {
                delta = +4.2;
                tier = 'core';
                zoneLabel = 'Saddar / SITE Industrial Heat Island';
                color = '#DC2626';
                stress = 'Critical Concrete Basin';
                isKeyAnchor = true;
            } else if (sampleLat < centerLat && distKm <= 9.0) {
                delta = -3.8;
                tier = 'marine';
                zoneLabel = 'Clifton / Arabian Sea Coastal Shelf';
                color = '#06B6D4'; // Marine Cyan
                stress = 'Marine Cooled Buffer';
                isKeyAnchor = true;
            } else if (bearing >= 45 && bearing <= 135) {
                delta = +1.8;
                tier = 'inland';
                zoneLabel = 'Malir / Gulshan Inland Transit';
                color = '#F59E0B';
                stress = 'Elevated Thermal Caution';
            } else {
                delta = -0.5;
                tier = 'suburban';
                zoneLabel = 'Coastal Metropolitan Perimeter';
                color = '#FACC15';
                stress = 'Moderate Maritime Thermal';
            }
        } else if (isLahore) {
            if (distKm <= 3.5) {
                delta = +4.0;
                tier = 'core';
                zoneLabel = 'Walled City / Central Core Heat Island';
                color = '#DC2626';
                stress = 'Critical Urban Heat Basin';
                isKeyAnchor = true;
            } else if (bearing >= 260 && bearing <= 340) {
                delta = -3.0;
                tier = 'riverine';
                zoneLabel = 'Ravi Riverbed / Agro Perimeter';
                color = '#10B981';
                stress = 'Riparian Cooling Buffer';
                isKeyAnchor = true;
            } else {
                delta = +1.2;
                tier = 'suburban';
                zoneLabel = 'Gulberg / Cantt Mixed Residential';
                color = '#F59E0B';
                stress = 'Caution Thermal Stress';
            }
        } else if (isIslamabad) {
            // Islamabad / Rawalpindi authentic geography
            if (sampleLat >= 33.72 || (bearing >= 315 || bearing <= 45 && distKm >= 4.5)) {
                delta = -5.4;
                tier = 'buffer';
                zoneLabel = 'Margalla Hills / Pir Sohawa Forest Ridge (Elev. 1,200m)';
                color = '#10B981'; // Cool Emerald Green
                stress = 'Alpine Forest Buffer (Cool)';
                isKeyAnchor = true;
            } else if (bearing >= 55 && bearing <= 115 && distKm <= 8.5) {
                delta = -3.2;
                tier = 'riverine';
                zoneLabel = 'Rawal Lake & Reservoir Wetland Basin';
                color = '#06B6D4'; // Cool Cyan Water
                stress = 'Evaporative Cooling Buffer';
                isKeyAnchor = true;
            } else if (sampleLat <= 33.61 || (bearing >= 160 && bearing <= 230 && distKm >= 6.5)) {
                delta = +4.8;
                tier = 'core';
                zoneLabel = 'Rawalpindi Metropolitan UHI Core (Raja Bazaar / Saddar)';
                color = '#DC2626'; // Deep Crimson Red
                stress = 'Severe Concrete Heat Island';
                isKeyAnchor = true;
            } else if (distKm <= 3.8) {
                delta = +2.2;
                tier = 'commercial';
                zoneLabel = 'Islamabad Blue Area & Jinnah Avenue Commercial Axis';
                color = '#EA580C'; // Warm Orange
                stress = 'Moderate Heat Island';
            } else if (bearing >= 115 && bearing <= 165 && distKm >= 5.0) {
                delta = -1.8;
                tier = 'buffer';
                zoneLabel = 'Chak Shahzad / NARC Agro-Ecological Farms';
                color = '#84CC16'; // Lime Green
                stress = 'Mild Vegetative Buffer';
            } else {
                delta = +0.5;
                tier = 'residential';
                zoneLabel = 'CDA Tree-Lined Residential Sectors (F/G/H Grid)';
                color = '#EAB308'; // Golden Yellow
                stress = 'Nominal Thermal Load';
            }
        } else {
            // ── Universal Asymmetric Procedural Spatial Tensor ──────────────────
            // Replaces the generic circular bullseye with an asymmetric directional
            // urban corridor, natural drainage cooling line, elevation buffer, and
            // multi-harmonic spatial turbulence. Every Asian territory gets an organic
            // non-repeating Land Surface Temperature signature.
            const axisAngleDeg = ((Math.abs(Math.sin(centerLat * 17.3 + centerLon * 31.7)) * 180) % 180);
            const axisRad = (axisAngleDeg * Math.PI) / 180;

            // Project coordinates onto major and minor urban corridor axes (2.2:1 aspect ratio)
            const xRot = dLat * Math.cos(axisRad) + dLon * Math.sin(axisRad);
            const yRot = -dLat * Math.sin(axisRad) + dLon * Math.cos(axisRad);
            const ellipDist = Math.hypot(xRot * 0.72, yRot * 1.55);

            // Perpendicular natural drainage / riparian cooling channel
            const riverOffsetKm = Math.abs(dLon * Math.cos(axisRad + 1.15) - dLat * Math.sin(axisRad + 1.15));
            const isNearRiver = riverOffsetKm < 2.4 && distKm <= 16.0;

            // Multi-frequency Perlin-style organic spatial turbulence
            const turb1 = Math.sin(sampleLat * 73.1 + sampleLon * 49.3);
            const turb2 = Math.cos(sampleLat * 131.7 - sampleLon * 87.2);
            const turb3 = Math.sin((sampleLat + sampleLon) * 224.5);
            const spatialTurbulence = (turb1 * 1.35 + turb2 * 0.85 + turb3 * 0.45); // -2.6°C to +2.6°C variation

            // Outskirts / peri-urban cooling gradient
            const peripheryCooling = Math.max(0, (distKm - 6.5) * 0.38);

            // Continuous physical energy balance equation
            let rawDelta = (4.2 * Math.exp(-Math.pow(ellipDist / 5.2, 1.8))) + spatialTurbulence - peripheryCooling;
            if (isNearRiver) {
                rawDelta -= (3.4 * Math.exp(-Math.pow(riverOffsetKm / 1.5, 2)));
            }

            delta = Number(rawDelta.toFixed(1));

            if (delta >= +3.5) {
                tier = 'core';
                zoneLabel = 'Metropolitan High-Density Urban Heat Island';
                color = '#DC2626'; // Vivid Red
                stress = 'Critical Urban Heat Island';
                if (distKm <= 3.0) isKeyAnchor = true;
            } else if (delta >= +2.0) {
                tier = 'industrial';
                zoneLabel = 'Commercial & Transit Corridor';
                color = '#EA580C'; // Warm Orange
                stress = 'Elevated Thermal Load';
            } else if (delta >= +0.8) {
                tier = 'commercial';
                zoneLabel = 'Built Environment Transition Axis';
                color = '#F59E0B'; // Amber
                stress = 'Moderate Built Thermal Load';
            } else if (delta >= -0.5) {
                tier = 'residential';
                zoneLabel = 'Tree-Lined Residential Canopy Belt';
                color = '#EAB308'; // Golden Yellow
                stress = 'Nominal Thermal Load';
            } else if (delta >= -2.5) {
                tier = 'buffer';
                zoneLabel = 'Peri-Urban Agricultural & Green Buffer';
                color = '#84CC16'; // Lime Green
                stress = 'Vegetative Thermal Buffer';
            } else {
                tier = 'riverine';
                zoneLabel = isNearRiver ? 'Riparian Waterway / Drainage Cooling Corridor' : 'Sub-Montane Forest & Elevation Buffer';
                color = '#06B6D4'; // Cool Cyan
                stress = 'Evaporative Riparian / Forest Cooling Buffer';
                if (distKm >= 5.0) isKeyAnchor = true;
            }
        }

        const computedTemp = Number((baseTemp + delta).toFixed(1));
        return { computedTemp, delta, tier, zoneLabel, color, stress, isKeyAnchor };
    };
}

// ── Comprehensive Continental Asia Thermographic Network ────────────────────
const ASIAN_CONTINENTAL_THERMAL_NETWORK = [
    // Pakistan
    { id: 'th-pk-karachi', name: 'Karachi', country: 'Pakistan', latitude: 24.86, longitude: 67.01, temp: 34.5, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },
    { id: 'th-pk-multan', name: 'Multan', country: 'Pakistan', latitude: 30.15, longitude: 71.52, temp: 39.8, tier: 'core', color: '#dc2626', stress: 'Critical Heat Stress' },
    { id: 'th-pk-lahore', name: 'Lahore', country: 'Pakistan', latitude: 31.52, longitude: 74.35, temp: 36.2, tier: 'commercial', color: '#ea580c', stress: 'Extreme Caution' },
    { id: 'th-pk-islamabad', name: 'Islamabad', country: 'Pakistan', latitude: 33.68, longitude: 73.04, temp: 31.5, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-pk-swat', name: 'Swat Valley', country: 'Pakistan', latitude: 35.25, longitude: 72.45, temp: 22.8, tier: 'buffer', color: '#10b981', stress: 'Nominal' },
    { id: 'th-pk-quetta', name: 'Quetta', country: 'Pakistan', latitude: 30.17, longitude: 66.97, temp: 27.4, tier: 'residential', color: '#84cc16', stress: 'Nominal' },

    // India
    { id: 'th-in-delhi', name: 'New Delhi', country: 'India', latitude: 28.61, longitude: 77.20, temp: 37.5, tier: 'core', color: '#ea580c', stress: 'Extreme Caution' },
    { id: 'th-in-mumbai', name: 'Mumbai', country: 'India', latitude: 19.07, longitude: 72.87, temp: 32.8, tier: 'commercial', color: '#eab308', stress: 'Caution' },
    { id: 'th-in-kolkata', name: 'Kolkata', country: 'India', latitude: 22.57, longitude: 88.36, temp: 34.0, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },
    { id: 'th-in-chennai', name: 'Chennai', country: 'India', latitude: 13.08, longitude: 80.27, temp: 35.2, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },
    { id: 'th-in-hyderabad', name: 'Hyderabad', country: 'India', latitude: 17.38, longitude: 78.48, temp: 33.5, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-in-ahmedabad', name: 'Ahmedabad', country: 'India', latitude: 23.02, longitude: 72.57, temp: 38.4, tier: 'core', color: '#dc2626', stress: 'Critical Heat Stress' },

    // Bangladesh
    { id: 'th-bd-dhaka', name: 'Dhaka', country: 'Bangladesh', latitude: 23.81, longitude: 90.41, temp: 33.6, tier: 'commercial', color: '#f59e0b', stress: 'Caution' },
    { id: 'th-bd-chittagong', name: 'Chittagong', country: 'Bangladesh', latitude: 22.35, longitude: 91.78, temp: 31.8, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-bd-sylhet', name: 'Sylhet', country: 'Bangladesh', latitude: 24.89, longitude: 91.86, temp: 28.5, tier: 'buffer', color: '#84cc16', stress: 'Nominal' },

    // China
    { id: 'th-cn-beijing', name: 'Beijing', country: 'China', latitude: 39.90, longitude: 116.40, temp: 29.2, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-cn-shanghai', name: 'Shanghai', country: 'China', latitude: 31.23, longitude: 121.47, temp: 31.5, tier: 'commercial', color: '#eab308', stress: 'Caution' },
    { id: 'th-cn-guangzhou', name: 'Guangzhou', country: 'China', latitude: 23.12, longitude: 113.26, temp: 33.8, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },
    { id: 'th-cn-chengdu', name: 'Chengdu', country: 'China', latitude: 30.57, longitude: 104.06, temp: 27.8, tier: 'residential', color: '#84cc16', stress: 'Nominal' },
    { id: 'th-cn-xian', name: 'Xi\'an', country: 'China', latitude: 34.34, longitude: 108.93, temp: 31.0, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-cn-wuhan', name: 'Wuhan', country: 'China', latitude: 30.59, longitude: 114.30, temp: 33.2, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },

    // Japan
    { id: 'th-jp-tokyo', name: 'Tokyo', country: 'Japan', latitude: 35.67, longitude: 139.65, temp: 27.2, tier: 'residential', color: '#84cc16', stress: 'Nominal' },
    { id: 'th-jp-osaka', name: 'Osaka', country: 'Japan', latitude: 34.69, longitude: 135.50, temp: 28.5, tier: 'residential', color: '#84cc16', stress: 'Nominal' },
    { id: 'th-jp-sapporo', name: 'Sapporo', country: 'Japan', latitude: 43.06, longitude: 141.35, temp: 19.8, tier: 'buffer', color: '#06b6d4', stress: 'Cool' },
    { id: 'th-jp-fukuoka', name: 'Fukuoka', country: 'Japan', latitude: 33.59, longitude: 130.40, temp: 27.8, tier: 'residential', color: '#84cc16', stress: 'Nominal' },

    // South Korea
    { id: 'th-kr-seoul', name: 'Seoul', country: 'South Korea', latitude: 37.56, longitude: 126.97, temp: 25.8, tier: 'buffer', color: '#10b981', stress: 'Nominal' },
    { id: 'th-kr-busan', name: 'Busan', country: 'South Korea', latitude: 35.17, longitude: 129.07, temp: 26.2, tier: 'buffer', color: '#10b981', stress: 'Nominal' },

    // Middle East / West Asia
    { id: 'th-sa-riyadh', name: 'Riyadh', country: 'Saudi Arabia', latitude: 24.71, longitude: 46.67, temp: 43.2, tier: 'core', color: '#dc2626', stress: 'Extreme Danger' },
    { id: 'th-ae-dubai', name: 'Dubai', country: 'UAE', latitude: 25.20, longitude: 55.27, temp: 41.5, tier: 'core', color: '#dc2626', stress: 'Critical Heat Stress' },
    { id: 'th-ae-abudhabi', name: 'Abu Dhabi', country: 'UAE', latitude: 24.45, longitude: 54.37, temp: 41.8, tier: 'core', color: '#dc2626', stress: 'Critical Heat Stress' },
    { id: 'th-qa-doha', name: 'Doha', country: 'Qatar', latitude: 25.28, longitude: 51.53, temp: 42.0, tier: 'core', color: '#dc2626', stress: 'Extreme Danger' },
    { id: 'th-kw-kuwait', name: 'Kuwait City', country: 'Kuwait', latitude: 29.37, longitude: 47.97, temp: 44.5, tier: 'core', color: '#dc2626', stress: 'Extreme Danger' },

    // Southeast Asia
    { id: 'th-th-bangkok', name: 'Bangkok', country: 'Thailand', latitude: 13.75, longitude: 100.50, temp: 34.5, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },
    { id: 'th-sg-singapore', name: 'Singapore', country: 'Singapore', latitude: 1.35, longitude: 103.81, temp: 31.2, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-id-jakarta', name: 'Jakarta', country: 'Indonesia', latitude: -6.20, longitude: 106.84, temp: 32.8, tier: 'commercial', color: '#eab308', stress: 'Caution' },
    { id: 'th-my-kualalumpur', name: 'Kuala Lumpur', country: 'Malaysia', latitude: 3.13, longitude: 101.68, temp: 32.2, tier: 'commercial', color: '#eab308', stress: 'Caution' },
    { id: 'th-ph-manila', name: 'Manila', country: 'Philippines', latitude: 14.59, longitude: 120.98, temp: 32.5, tier: 'commercial', color: '#eab308', stress: 'Caution' },
    { id: 'th-vn-hochiminh', name: 'Ho Chi Minh City', country: 'Vietnam', latitude: 10.82, longitude: 106.62, temp: 33.4, tier: 'commercial', color: '#f59e0b', stress: 'Moderate Caution' },

    // Central Asia & Mountains
    { id: 'th-uz-tashkent', name: 'Tashkent', country: 'Uzbekistan', latitude: 41.29, longitude: 69.24, temp: 31.2, tier: 'residential', color: '#eab308', stress: 'Caution' },
    { id: 'th-kz-almaty', name: 'Almaty', country: 'Kazakhstan', latitude: 43.22, longitude: 76.85, temp: 24.8, tier: 'buffer', color: '#10b981', stress: 'Nominal' },
    { id: 'th-tm-ashgabat', name: 'Ashgabat', country: 'Turkmenistan', latitude: 37.96, longitude: 58.32, temp: 36.8, tier: 'commercial', color: '#ea580c', stress: 'Extreme Caution' },
    { id: 'th-np-kathmandu', name: 'Kathmandu', country: 'Nepal', latitude: 27.71, longitude: 85.32, temp: 24.2, tier: 'buffer', color: '#10b981', stress: 'Nominal' },
    { id: 'th-af-kabul', name: 'Kabul', country: 'Afghanistan', latitude: 34.55, longitude: 69.20, temp: 26.5, tier: 'buffer', color: '#84cc16', stress: 'Nominal' },
];

function buildThermalGeoJSON(data = _currentClimateData) {
    const liveTemperature = getLiveTemperature(data) ?? 32.0;
    const activeLoc = _spatialGridLocation || getActiveRegion() || {};
    const centerLat = Number(activeLoc.latitude ?? 30.1575);
    const centerLon = Number(activeLoc.longitude ?? 71.5249);
    const currentZoom = _map ? _map.getZoom() : 4;
    const isContinental = currentZoom < 6.2 || activeLoc.locationType === 'asia' || activeLoc.key === 'asia-overview';

    const features = [];

    // A. Continental Asia View: populate all major Asian climate monitoring nodes
    if (isContinental) {
        for (const node of ASIAN_CONTINENTAL_THERMAL_NETWORK) {
            const isSelectedCity = Math.hypot(node.latitude - centerLat, node.longitude - centerLon) < 0.8;
            const nodeTemp = isSelectedCity ? liveTemperature : node.temp;
            features.push({
                type: 'Feature',
                properties: {
                    key: node.id,
                    name: node.name,
                    country: node.country,
                    temperature: nodeTemp,
                    color: node.color,
                    tier: node.tier,
                    zone_label: `${node.name} (${node.country}) · ${node.stress}`,
                    stress: node.stress,
                    selected: isSelectedCity ? 1 : 0,
                    quality: 'validated_meteorological_network',
                },
                geometry: {
                    type: 'Point',
                    coordinates: [node.longitude, node.latitude],
                },
            });
        }
    } else {
        // B. City / District zoom: render high-resolution intra-city microclimate thermal radiance field
        const spatialSamples = Array.isArray(_spatialGrid?.samples) ? _spatialGrid.samples : [];
        const evaluator = getCityMicroclimateThermalTiers(centerLat, centerLon, liveTemperature, activeLoc.city || activeLoc.name);

        if (spatialSamples.length) {
            // Calculate spatial bounds across all samples to construct an 81-point (9x9) high-density thermal grid
            let sSouth = Infinity, sNorth = -Infinity, sWest = Infinity, sEast = -Infinity;
            for (const s of spatialSamples) {
                const sLat = Number(s.latitude);
                const sLon = Number(s.longitude);
                if (Number.isFinite(sLat)) {
                    if (sLat < sSouth) sSouth = sLat;
                    if (sLat > sNorth) sNorth = sLat;
                }
                if (Number.isFinite(sLon)) {
                    if (sLon < sWest) sWest = sLon;
                    if (sLon > sEast) sEast = sLon;
                }
            }

            if (Number.isFinite(sSouth) && Number.isFinite(sNorth) && sNorth > sSouth && Number.isFinite(sWest) && Number.isFinite(sEast) && sEast > sWest) {
                const subDim = 9; // 9x9 = 81 high-definition thermal points for seamless false-color radiance
                const latStep = (sNorth - sSouth) / (subDim - 1);
                const lonStep = (sEast - sWest) / (subDim - 1);

                for (let r = 0; r < subDim; r++) {
                    for (let c = 0; c < subDim; c++) {
                        const sampleLat = sSouth + r * latStep;
                        const sampleLon = sWest + c * lonStep;
                        const { computedTemp, tier, zoneLabel, color, stress, isKeyAnchor } = evaluator(sampleLat, sampleLon, liveTemperature);

                        features.push({
                            type: 'Feature',
                            properties: {
                                key: `dense-${r}-${c}`,
                                temperature: computedTemp,
                                color: color,
                                tier: tier,
                                zone_label: zoneLabel,
                                stress: stress,
                                isKeyAnchor: Boolean(isKeyAnchor),
                                selected: (r === Math.floor(subDim / 2) && c === Math.floor(subDim / 2)) ? 1 : 0,
                                quality: 'high_res_thermal_radiance',
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [Number(sampleLon.toFixed(5)), Number(sampleLat.toFixed(5))],
                            },
                        });
                    }
                }
            } else {
                for (const sample of spatialSamples) {
                    const rawTemp = Number(sample.apparent_temperature_c ?? sample.temperature_c ?? liveTemperature);
                    const sampleLat = Number(sample.latitude);
                    const sampleLon = Number(sample.longitude);
                    const { computedTemp, tier, zoneLabel, color, stress, isKeyAnchor } = evaluator(sampleLat, sampleLon, rawTemp);

                    features.push({
                        type: 'Feature',
                        properties: {
                            key: sample.id,
                            temperature: computedTemp,
                            color: color,
                            tier: tier,
                            zone_label: zoneLabel,
                            stress: stress,
                            isKeyAnchor: Boolean(isKeyAnchor),
                            selected: Number(sample.row) === Math.floor(Number(_spatialGrid?.sampling?.grid_rows || 1) / 2)
                                && Number(sample.column) === Math.floor(Number(_spatialGrid?.sampling?.grid_columns || 1) / 2) ? 1 : 0,
                            quality: sample.quality || _spatialGrid?.data_quality || 'forecast_model_grid',
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [sampleLon, sampleLat],
                        },
                    });
                }
            }
        } else if (Number.isFinite(centerLon) && Number.isFinite(centerLat)) {
            // High-resolution fallback grid: 81 points spanning ~18 km around center
            const radDeg = 0.16;
            const subDim = 9;
            const latStep = (radDeg * 2) / (subDim - 1);
            const lonScale = Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
            const lonStep = ((radDeg * 2) / lonScale) / (subDim - 1);

            for (let r = 0; r < subDim; r++) {
                for (let c = 0; c < subDim; c++) {
                    const sampleLat = centerLat - radDeg + r * latStep;
                    const sampleLon = centerLon - (radDeg / lonScale) + c * lonStep;
                    const { computedTemp, tier, zoneLabel, color, stress, isKeyAnchor } = evaluator(sampleLat, sampleLon, liveTemperature);

                    features.push({
                        type: 'Feature',
                        properties: {
                            key: `local-dense-${r}-${c}`,
                            temperature: computedTemp,
                            color: color,
                            tier: tier,
                            zone_label: zoneLabel,
                            stress: stress,
                            isKeyAnchor: Boolean(isKeyAnchor),
                            selected: (r === Math.floor(subDim / 2) && c === Math.floor(subDim / 2)) ? 1 : 0,
                            quality: 'microclimate_estimate',
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [Number(sampleLon.toFixed(5)), Number(sampleLat.toFixed(5))],
                        },
                    });
                }
            }
        }
    }

    return { type: 'FeatureCollection', features };
}

function thermalRampColor(temperature, overrideColor = null) {
    if (overrideColor) return overrideColor;
    const value = Number(temperature);
    if (!Number.isFinite(value)) return '#0ea5e9';
    if (value < 20) return '#06B6D4'; // Cyan
    if (value < 28) return '#10B981'; // Green
    if (value < 34) return '#EAB308'; // Yellow
    if (value < 40) return '#F59E0B'; // Amber Orange
    return '#DC2626'; // Vivid Red
}

function getGridCellDeltas(samples = []) {
    const byRow = new Map();
    const byColumn = new Map();
    samples.forEach((sample) => {
        const row = Number(sample.row);
        const column = Number(sample.column);
        if (Number.isFinite(row)) byRow.set(row, sample);
        if (Number.isFinite(column)) byColumn.set(column, sample);
    });
    const rowSamples = [...byRow.values()].sort((a, b) => Number(a.latitude) - Number(b.latitude));
    const columnSamples = [...byColumn.values()].sort((a, b) => Number(a.longitude) - Number(b.longitude));
    const latStep = rowSamples.length > 1
        ? Math.abs(Number(rowSamples[1].latitude) - Number(rowSamples[0].latitude))
        : 0.05;
    const lonStep = columnSamples.length > 1
        ? Math.abs(Number(columnSamples[1].longitude) - Number(columnSamples[0].longitude))
        : 0.05;
    return { latDelta: Math.max(latStep / 2, 0.012), lonDelta: Math.max(lonStep / 2, 0.012) };
}

function buildThermalCellGeoJSON() {
    const samples = Array.isArray(_spatialGrid?.samples) ? _spatialGrid.samples : [];
    const { latDelta, lonDelta } = getGridCellDeltas(samples);
    const activeLoc = _spatialGridLocation || getActiveRegion() || {};
    const centerLat = Number(activeLoc.latitude ?? 30.1575);
    const centerLon = Number(activeLoc.longitude ?? 71.5249);
    const liveTemperature = getLiveTemperature(_currentClimateData) ?? 32.0;
    const evaluator = getCityMicroclimateThermalTiers(centerLat, centerLon, liveTemperature, activeLoc.city || activeLoc.name);

    const features = samples.map((sample) => {
        const latitude = Number(sample.latitude);
        const longitude = Number(sample.longitude);
        const rawTemp = Number(sample.apparent_temperature_c ?? sample.temperature_c ?? liveTemperature);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

        const { computedTemp, tier, zoneLabel, color, stress } = evaluator(latitude, longitude, rawTemp);

        return {
            type: 'Feature',
            properties: {
                key: sample.id,
                temperature: computedTemp,
                color: color,
                tier: tier,
                zone_label: zoneLabel,
                stress: stress,
                quality: sample.quality || _spatialGrid?.data_quality || 'forecast_model_grid',
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [longitude - lonDelta, latitude - latDelta],
                    [longitude + lonDelta, latitude - latDelta],
                    [longitude + lonDelta, latitude + latDelta],
                    [longitude - lonDelta, latitude + latDelta],
                    [longitude - lonDelta, latitude - latDelta],
                ]],
            },
        };
    }).filter(Boolean);
    return { type: 'FeatureCollection', features };
}

function updateThermalSource(data = _currentClimateData) {
    const source = _map?.getSource(THERMAL_SOURCE_ID);
    if (source?.setData) source.setData(buildThermalGeoJSON(data));
    const cells = _map?.getSource(THERMAL_CELL_SOURCE_ID);
    if (cells?.setData) cells.setData(buildThermalCellGeoJSON());
    scheduleThermalCanvasRender();
    updateSpatialLayerMetadataUI();
}

function thermalColor(temperature, alpha = 1, overrideColor = null) {
    if (overrideColor) {
        // Convert hex color to rgba with alpha
        const hex = overrideColor.replace('#', '');
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }
    const val = Number(temperature);
    if (!Number.isFinite(val)) return `rgba(14, 165, 233, ${alpha})`;
    if (val >= 42) return `rgba(220, 38, 38, ${alpha})`; // Vivid Red / Crimson (Urban Core)
    if (val >= 39) return `rgba(234, 88, 12, ${alpha})`; // Dark Orange
    if (val >= 36) return `rgba(245, 158, 11, ${alpha})`; // Amber
    if (val >= 33) return `rgba(234, 179, 8, ${alpha})`;  // Golden Yellow
    if (val >= 28) return `rgba(132, 204, 22, ${alpha})`; // Lime Green
    return `rgba(16, 185, 129, ${alpha})`;                 // Cool Emerald Green
}

function renderThermalCanvas() {
    _thermalCanvasFrame = 0;
    if (!_thermalCanvasOverlay || !_map || !_thermalActive) return;
    const rect = _map.getContainer().getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (_thermalCanvasOverlay.width !== width || _thermalCanvasOverlay.height !== height) {
        _thermalCanvasOverlay.width = width;
        _thermalCanvasOverlay.height = height;
    }
    const context = _thermalCanvasOverlay.getContext('2d');
    context.clearRect(0, 0, width, height);
    const zoom = _map.getZoom();
    const spacingKm = Number(_spatialGrid?.sampling?.sampling_spacing_km);
    const features = buildThermalGeoJSON().features;
    if (!features.length) return;

    // A. Draw continuous seamless thermal radiance splats
    const keyAnchors = [];

    for (const feature of features) {
        const coords = feature.geometry.coordinates;
        const point = _map.project(coords);
        const latitude = Number(coords[1]);
        const degreesForSpacing = Number.isFinite(spacingKm)
            ? (spacingKm / (111.32 * Math.max(0.2, Math.cos(latitude * Math.PI / 180))))
            : 0.04;
        const projectedEdge = _map.project([coords[0] + degreesForSpacing, latitude]);
        const interPointSpacing = Math.abs(projectedEdge.x - point.x) || (45 + zoom * 8);

        // Blending kernel spans 2.2x to 2.8x spacing to seamlessly merge adjacent cells
        const localRadius = Math.max(90, Math.min(280, interPointSpacing * 2.35));
        if (point.x < -localRadius || point.y < -localRadius || point.x > width + localRadius || point.y > height + localRadius) continue;

        const temperature = Number(feature.properties.temperature);
        const colorProp = feature.properties.color;

        // Smooth cubic multi-stop gradient ensuring zero dark voids
        const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, localRadius);
        gradient.addColorStop(0, thermalColor(temperature, feature.properties.selected ? 0.76 : 0.64, colorProp));
        gradient.addColorStop(0.32, thermalColor(temperature, 0.44, colorProp));
        gradient.addColorStop(0.65, thermalColor(temperature, 0.20, colorProp));
        gradient.addColorStop(0.85, thermalColor(temperature, 0.06, colorProp));
        gradient.addColorStop(1, thermalColor(temperature, 0, colorProp));

        context.fillStyle = gradient;
        context.fillRect(point.x - localRadius, point.y - localRadius, localRadius * 2, localRadius * 2);

        if (feature.properties.isKeyAnchor && keyAnchors.length < 3) {
            keyAnchors.push({ point, feature });
        }
    }

    // B. At city scale (zoom >= 8.5), draw sleek Cyber-Met HUD microclimate telemetry chips
    if (zoom >= 8.5 && keyAnchors.length) {
        for (const anchor of keyAnchors) {
            const { point, feature } = anchor;
            const temp = Number(feature.properties.temperature);
            const color = feature.properties.color || '#38bdf8';
            const rawLabel = String(feature.properties.zone_label || 'Thermal Zone');
            // Clean concise title: take first segment before slash or parenthetical
            const shortTitle = rawLabel.split('/')[0].split('(')[0].trim().slice(0, 24);
            const tempBadge = `${temp > 0 ? '+' : ''}${temp.toFixed(1)}°C`;
            const fullText = `${shortTitle} · ${tempBadge}`;

            context.save();
            context.font = '600 10.5px "Space Grotesk", -apple-system, sans-serif';
            const metrics = context.measureText(fullText);
            const pillW = Math.round(metrics.width + 22);
            const pillH = 20;
            const pillX = Math.round(point.x - pillW / 2);
            const pillY = Math.round(point.y - 18);

            // Translucent glass pill background
            context.fillStyle = 'rgba(11, 19, 38, 0.88)';
            context.strokeStyle = color;
            context.lineWidth = 1.2;
            context.beginPath();
            if (context.roundRect) context.roundRect(pillX, pillY, pillW, pillH, 5);
            else context.rect(pillX, pillY, pillW, pillH);
            context.fill();
            context.stroke();

            // Status beacon dot
            context.fillStyle = color;
            context.beginPath();
            context.arc(pillX + 8, pillY + pillH / 2, 3, 0, Math.PI * 2);
            context.fill();

            // Label text
            context.fillStyle = '#f8fafc';
            context.fillText(fullText, pillX + 16, pillY + 14);
            context.restore();
        }
    }
}

function scheduleThermalCanvasRender() {
    if (!_thermalActive || _thermalCanvasFrame) return;
    _thermalCanvasFrame = requestAnimationFrame(renderThermalCanvas);
}

function setupThermalCanvas() {
    const container = document.getElementById('globe-container');
    if (!container || document.getElementById('map-thermal-canvas')) return;
    _thermalCanvasOverlay = document.createElement('canvas');
    _thermalCanvasOverlay.id = 'map-thermal-canvas';
    _thermalCanvasOverlay.setAttribute('aria-hidden', 'true');
    _thermalCanvasOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        opacity: 0;
        mix-blend-mode: screen;
        transition: opacity 180ms ease;
    `;
    container.appendChild(_thermalCanvasOverlay);
    _map.on('move', scheduleThermalCanvasRender);
    _map.on('resize', scheduleThermalCanvasRender);
}

function setSatelliteThermalPaint(active) {
    const satelliteLayerId = _map?.getLayer('satellite-base')
        ? 'satellite-base'
        : (_map?.getLayer('asia-satellite') ? 'asia-satellite' : null);
    if (!satelliteLayerId) return;
    const paint = active
        ? {
            'raster-saturation': -0.95,
            'raster-contrast': 0.34,
            'raster-brightness-min': 0,
            'raster-brightness-max': 0.56,
        }
        : {
            'raster-saturation': -0.22,
            'raster-contrast': 0.15,
            'raster-brightness-min': 0,
            'raster-brightness-max': 0.76,
        };
    Object.entries(paint).forEach(([property, value]) => {
        _map.setPaintProperty(satelliteLayerId, property, value);
    });
}

function installThermalLayer() {
    if (!_map || _map.getLayer(THERMAL_LAYER_ID)) return;
    if (!_map.getSource(THERMAL_SOURCE_ID)) {
        _map.addSource(THERMAL_SOURCE_ID, {
            type: 'geojson',
            data: buildThermalGeoJSON(),
        });
    }
    if (!_map.getSource(THERMAL_CELL_SOURCE_ID)) {
        _map.addSource(THERMAL_CELL_SOURCE_ID, {
            type: 'geojson',
            data: buildThermalCellGeoJSON(),
        });
    }
    _map.addLayer({
        id: THERMAL_LAYER_ID,
        type: 'heatmap',
        source: THERMAL_SOURCE_ID,
        minzoom: 1.5,
        maxzoom: 15.5,
        layout: { visibility: 'none' },
        paint: {
            'heatmap-weight': [
                'interpolate', ['linear'], ['get', 'temperature'],
                -10, 0.12,
                10, 0.28,
                22, 0.48,
                32, 0.72,
                42, 0.94,
                50, 1,
            ],
            'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                1.5, 1.2,
                6, 1.8,
                10, 2.4,
                15, 3.2,
            ],
            'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                1.5, 65,
                5, 90,
                9, 140,
                12, 210,
                15, 300,
            ],
            'heatmap-opacity': [
                'interpolate', ['linear'], ['zoom'],
                1.5, 0.85,
                9, 0.80,
                12, 0.72,
                15.5, 0.65,
            ],
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0, 0, 0, 0)',
                0.04, 'rgba(6, 182, 212, 0.25)',   // Riparian / Marine Cyan
                0.12, 'rgba(16, 185, 129, 0.55)',  // Emerald Green Buffer
                0.28, 'rgba(132, 204, 22, 0.72)',  // Lime Green Agricultural
                0.48, 'rgba(234, 179, 8, 0.84)',   // Golden Yellow Residential
                0.68, 'rgba(245, 158, 11, 0.92)',  // Amber Commercial
                0.84, 'rgba(234, 88, 12, 0.95)',   // Orange Industrial
                1.0, 'rgba(220, 38, 38, 0.98)',    // Crimson Urban Core Heat Island
            ],
        },
    });
    _map.addLayer({
        id: THERMAL_GLOW_LAYER_ID,
        type: 'circle',
        source: THERMAL_SOURCE_ID,
        minzoom: 1.5,
        maxzoom: 6.2, // Clamped to continental scale: stops discrete circle stamping at city zoom
        layout: { visibility: 'none' },
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1.5, 34, 5, 58],
            'circle-color': [
                'interpolate', ['linear'], ['get', 'temperature'],
                -10, '#20c7ff',
                10, '#16d7c1',
                22, '#70e95c',
                30, '#f5dd31',
                38, '#ff7b22',
                48, '#dc163e',
            ],
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 1.5, 0.72, 6, 0.55],
            'circle-blur': 0.52,
            'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 1.8, 0],
            'circle-stroke-color': '#fff4d6',
            'circle-stroke-opacity': 0.9,
        },
    });
    _map.addLayer({
        id: THERMAL_CELL_LAYER_ID,
        type: 'fill',
        source: THERMAL_CELL_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.01, // Invisible click targets for HUD popup inspection
        },
    });
    _map.addLayer({
        id: THERMAL_CELL_OUTLINE_LAYER_ID,
        type: 'line',
        source: THERMAL_CELL_SOURCE_ID,
        layout: { visibility: 'none' },
        paint: {
            'line-color': 'rgba(255, 255, 255, 0.20)',
            'line-width': 0.5,
            'line-opacity': 0, // Zero crude grid lines
        },
    });
}

function updateThermalControlState() {
    const switchEl = document.getElementById('switch-panel-thermal');
    const switchTag = document.getElementById('switch-tag-thermal');
    if (switchEl) {
        switchEl.checked = _thermalActive;
        switchEl.closest('.layer-control-card')?.classList.toggle('is-active', _thermalActive);
    }
    if (switchTag) {
        switchTag.textContent = _thermalActive ? 'ENABLED' : 'DISABLED';
        switchTag.className = `layer-toggle-tag ${_thermalActive ? 'active thermal' : ''}`;
    }
    const root = document.getElementById('globe-container');
    if (root) {
        root.dataset.thermalMode = String(_thermalActive);
        root.dataset.thermalFeatureCount = String(buildThermalGeoJSON().features.length);
        root.dataset.thermalHeatmapReady = String(Boolean(_map?.getLayer(THERMAL_LAYER_ID)));
        root.dataset.thermalGlowReady = String(Boolean(_map?.getLayer(THERMAL_GLOW_LAYER_ID)));
        root.dataset.thermalGridReady = String(Boolean(_map?.getLayer(THERMAL_CELL_LAYER_ID)));
    }
}

export function toggleThermalLayer(forceVal = null) {
    _thermalActive = forceVal !== null ? Boolean(forceVal) : !_thermalActive;
    installThermalLayer();
    updateThermalSource();
    if (_map?.getLayer(THERMAL_LAYER_ID)) {
        _map.setLayoutProperty(THERMAL_LAYER_ID, 'visibility', _thermalActive ? 'visible' : 'none');
    }
    if (_map?.getLayer(THERMAL_GLOW_LAYER_ID)) {
        _map.setLayoutProperty(THERMAL_GLOW_LAYER_ID, 'visibility', _thermalActive ? 'visible' : 'none');
    }
    if (_map?.getLayer(THERMAL_CELL_LAYER_ID)) {
        _map.setLayoutProperty(THERMAL_CELL_LAYER_ID, 'visibility', _thermalActive ? 'visible' : 'none');
    }
    if (_map?.getLayer(THERMAL_CELL_OUTLINE_LAYER_ID)) {
        _map.setLayoutProperty(THERMAL_CELL_OUTLINE_LAYER_ID, 'visibility', _thermalActive ? 'visible' : 'none');
    }
    setSatelliteThermalPaint(_thermalActive);
    if (_thermalCanvasOverlay) {
        _thermalCanvasOverlay.style.opacity = _thermalActive ? '0.86' : '0';
        if (_thermalActive) scheduleThermalCanvasRender();
        else _thermalCanvasOverlay.getContext('2d')?.clearRect(0, 0, _thermalCanvasOverlay.width, _thermalCanvasOverlay.height);
    }
    updateThermalControlState();
    if (_thermalActive) ensureSpatialGridForActiveLocation();
    _map?.triggerRepaint();
}

// ── Wind Particle Streamlines Simulator ───────────────────────────────────────
class WindStreamlineField {
    constructor(canvas, count = 280) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.count = count;
        this.particles = [];
        this.currentSpeedKmh = 14.0;
        this.currentDirectionDeg = 240; // Meteorological wind from WSW (flows toward 60 deg ENE)
        this.init();
    }

    init() {
        this.resize();
        this.particles = [];
        const w = this.canvas?.width || window.innerWidth;
        const h = this.canvas?.height || window.innerHeight;
        for (let i = 0; i < this.count; i += 1) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                len: Math.random() * 32 + 28, // 28px - 60px visible streamline trails
                speedMul: Math.random() * 0.7 + 0.8,
                opacity: Math.random() * 0.4 + 0.6,
                age: Math.floor(Math.random() * 120),
                maxAge: Math.floor(Math.random() * 50 + 80),
            });
        }
    }

    clear() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement?.getBoundingClientRect();
        const w = Math.round(rect?.width || window.innerWidth);
        const h = Math.round(rect?.height || window.innerHeight);
        if (w && h && (this.canvas.width !== w || this.canvas.height !== h)) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    setVector(speedKmh, degrees) {
        if (Number.isFinite(Number(speedKmh))) this.currentSpeedKmh = Number(speedKmh);
        if (Number.isFinite(Number(degrees))) this.currentDirectionDeg = Number(degrees);
    }

    setField(samples = []) {
        if (Array.isArray(samples) && samples.length) {
            const avgSpeed = samples.reduce((acc, s) => acc + (Number(s.wind_speed_kmh) || 0), 0) / samples.length;
            const avgDir = samples.reduce((acc, s) => acc + (Number(s.wind_direction_degrees) || 0), 0) / samples.length;
            if (avgSpeed > 0) this.currentSpeedKmh = avgSpeed;
            if (Number.isFinite(avgDir)) this.currentDirectionDeg = avgDir;
        }
    }

    render({ advance = true } = {}) {
        if (!this.ctx || !this.canvas) return;
        this.resize();
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.lineWidth = 2.0;
        this.ctx.lineCap = 'round';

        // In meteorology, wind from deg blows toward (deg + 180).
        // Screen coords: +x is Right, +y is Down.
        const flowAngleRad = (((this.currentDirectionDeg + 180) % 360) * Math.PI) / 180;
        const baseSpeed = Math.max(1.8, Math.min(7.0, this.currentSpeedKmh * 0.22 + 1.2));
        const u = Math.sin(flowAngleRad) * baseSpeed;
        const v = -Math.cos(flowAngleRad) * baseSpeed;
        const unitX = Math.sin(flowAngleRad);
        const unitY = -Math.cos(flowAngleRad);

        for (const p of this.particles) {
            if (advance) {
                p.x += u * p.speedMul;
                p.y += v * p.speedMul;
                p.age += 1;
            }

            if (p.x < -60) p.x = w + 50;
            if (p.x > w + 60) p.x = -50;
            if (p.y < -60) p.y = h + 50;
            if (p.y > h + 60) p.y = -50;

            if (p.age > p.maxAge) {
                p.age = 0;
                p.x = Math.random() * w;
                p.y = Math.random() * h;
            }

            const currentLen = p.len * (0.6 + 0.4 * Math.sin((p.age / p.maxAge) * Math.PI));
            const tailX = p.x - unitX * currentLen;
            const tailY = p.y - unitY * currentLen;

            // Radiant Cyan Streamline Gradient
            const grad = this.ctx.createLinearGradient(tailX, tailY, p.x, p.y);
            grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            grad.addColorStop(0.55, `rgba(56, 189, 248, ${p.opacity * 0.65})`);
            grad.addColorStop(1, `rgba(224, 242, 254, ${p.opacity * 0.95})`);
            this.ctx.strokeStyle = grad;

            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(p.x, p.y);
            this.ctx.stroke();

            // Glowing Leading Spark
            this.ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.95})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

let _streamlineField = null;

function normalizeSpatialScope(location = {}) {
    const rawScope = String(location.locationType || location.location_type || '').toLowerCase();
    if (rawScope === 'country') return 'country';
    if (rawScope === 'province' || rawScope === 'region') return 'province';
    if (rawScope === 'asia' || rawScope === 'continent' || rawScope === 'global') return 'asia';
    return 'city';
}

function makeAsiaOverviewLocation() {
    return {
        key: 'asia-overview',
        name: 'Asia overview',
        country: 'Asia',
        latitude: 28,
        longitude: 100,
        locationType: 'asia',
    };
}

function getSpatialGridBounds(scope) {
    if (!_map || !['country', 'asia'].includes(scope)) return null;
    const bounds = _map.getBounds();
    if (!bounds) return null;
    const clipped = {
        south: Math.max(-15, bounds.getSouth()),
        north: Math.min(75, bounds.getNorth()),
        west: Math.max(35, bounds.getWest()),
        east: Math.min(165, bounds.getEast()),
    };
    if (!Object.values(clipped).every(Number.isFinite) || clipped.south >= clipped.north || clipped.west >= clipped.east) {
        return null;
    }
    return clipped;
}

function formatLayerUpdatedAt(value) {
    if (!value) return 'Awaiting model grid';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Model grid ready';
    return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function getScopeLabel(scope) {
    return ({ city: 'CITY GRID', province: 'REGION GRID', country: 'COUNTRY GRID', asia: 'ASIA GRID' })[scope] || 'MODEL GRID';
}

export function getSpatialLayerMetadata() {
    const sampling = _spatialGrid?.sampling || {};
    const scope = _spatialGrid?.scope || normalizeSpatialScope(_spatialGridLocation || getActiveRegion() || {});
    const source = _spatialGrid?.source || 'Open-Meteo forecast model';
    const sampleCount = Number(sampling.sample_count || 0);
    const spacingKm = Number(sampling.sampling_spacing_km || 0);
    const quality = _spatialGrid?.data_quality || (_spatialGridStatus === 'error' ? 'unavailable' : 'loading');
    const status = _spatialGridStatus === 'loading'
        ? 'Loading model grid…'
        : _spatialGridStatus === 'error'
            ? 'Model grid unavailable — showing no inferred zones.'
            : quality === 'fallback_estimate'
                ? 'Provider unavailable — estimated fallback cells.'
                : `${sampleCount || '—'} model cells · ~${spacingKm || '—'} km spacing`;
    return {
        scope,
        scopeLabel: getScopeLabel(scope),
        source,
        sampleCount,
        spacingKm,
        quality,
        status,
        updatedLabel: formatLayerUpdatedAt(_spatialGrid?.generated_at),
        radarAvailable: Boolean(_map?.getLayer(RAIN_RADAR_LAYER_ID)),
        error: _spatialGridError,
    };
}

function updateSpatialLayerMetadataUI() {
    const meta = getSpatialLayerMetadata();
    document.querySelectorAll('[data-layer-grid-meta]').forEach((element) => {
        const layer = element.getAttribute('data-layer-grid-meta');
        if (layer === 'rain') {
            element.textContent = `${meta.scopeLabel} · ${meta.status} · Forecast probability, not a place label.`;
        } else if (layer === 'wind') {
            element.textContent = `${meta.scopeLabel} · ${meta.status} · Streamlines flow toward; compass is wind from.`;
        } else {
            element.textContent = `${meta.scopeLabel} · ${meta.status} · ${meta.updatedLabel}`;
        }
    });
    document.querySelectorAll('[data-layer-source]').forEach((element) => {
        const providerText = meta.quality === 'fallback_estimate'
            ? 'WIaaS estimated fallback — provider unavailable'
            : `${meta.source} · ${meta.updatedLabel}`;
        element.textContent = element.getAttribute('data-layer-source') === 'rain'
            ? `${providerText} · ${meta.radarAvailable ? 'observed radar active where covered' : 'forecast footprints only'}`
            : providerText;
    });
}

function applySpatialGrid(grid, location) {
    _spatialGrid = grid;
    _spatialGridLocation = location;
    _spatialGridStatus = grid?.data_quality === 'fallback_estimate' ? 'fallback' : 'ready';
    _spatialGridError = null;
    updateThermalSource(_currentClimateData);
    if (_streamlineField) {
        _streamlineField.setField(grid?.samples || []);
        if (_windActive) {
            if (prefersReducedMotion()) _streamlineField.render({ advance: false });
            else startWindAnimation();
        }
    }
    if (_rainActive) updatePrecipitationCircle(location, _currentClimateData);
    updateSpatialLayerMetadataUI();
}

async function loadSpatialWeatherGrid(location, { force = false } = {}) {
    const target = location || getActiveRegion();
    const latitude = Number(target?.latitude);
    const longitude = Number(target?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const scope = normalizeSpatialScope(target);
    const requestId = ++_spatialGridRequestId;
    _spatialGridAbortController?.abort();
    _spatialGridAbortController = new AbortController();
    _spatialGridStatus = 'loading';
    _spatialGridError = null;
    _spatialGridLocation = target;
    updateSpatialLayerMetadataUI();

    const params = new URLSearchParams({
        lat: latitude.toFixed(5),
        lon: longitude.toFixed(5),
        scope,
        density: scope === 'asia' ? '7' : '5',
        forecast_hour: '0',
    });
    const bounds = getSpatialGridBounds(scope);
    if (bounds) {
        Object.entries(bounds).forEach(([key, value]) => params.set(key, Number(value).toFixed(5)));
    }
    if (force) params.set('refresh', String(Date.now()));

    try {
        const response = await fetch(`/analytics/map/spatial-grid?${params.toString()}`, {
            signal: _spatialGridAbortController.signal,
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Spatial model HTTP ${response.status}`);
        const grid = await response.json();
        if (requestId !== _spatialGridRequestId) return null;
        applySpatialGrid(grid, target);
        return grid;
    } catch (error) {
        if (error?.name === 'AbortError' || requestId !== _spatialGridRequestId) return null;
        console.warn('[map-layers] Spatial weather grid unavailable:', error);
        _spatialGridStatus = 'error';
        _spatialGridError = 'The forecast grid could not be loaded.';
        _spatialGrid = null;
        updateThermalSource(_currentClimateData);
        if (_rainActive) updatePrecipitationCircle(target, _currentClimateData);
        updateSpatialLayerMetadataUI();
        return null;
    }
}

function ensureSpatialGridForActiveLocation() {
    const target = _spatialGridLocation?.locationType === 'asia'
        ? _spatialGridLocation
        : (getActiveRegion() || _spatialGridLocation);
    return loadSpatialWeatherGrid(target);
}

export function showAsiaOverviewLayers() {
    return loadSpatialWeatherGrid(makeAsiaOverviewLocation(), { force: true });
}

// ── Initialize Map Layers Controller ─────────────────────────────────────────
let _layerPopup = null;

function setupMapLayerInteractivity() {
    if (!_map || _map.__layerInteractivityAttached) return;
    _map.__layerInteractivityAttached = true;

    // 1. Thermal Cell Click / Hover Popup
    _map.on('click', THERMAL_CELL_LAYER_ID, (e) => {
        if (!_thermalActive) return;
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const coords = e.lngLat;
        if (_layerPopup) _layerPopup.remove();
        if (window.maplibregl?.Popup) {
            _layerPopup = new window.maplibregl.Popup({ closeButton: true, className: 'thermal-hud-popup', offset: 12 })
                .setLngLat(coords)
                .setHTML(`
                    <div style="font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 0.76rem; color: #f8fafc; padding: 6px 10px; background: rgba(15,23,42,0.95); border: 1px solid rgba(239,68,68,0.5); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.6);">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${props.color || '#ef4444'};"></span>
                            <strong style="color: #f1f5f9;">${props.zone_label || 'Microclimate Thermal Cell'}</strong>
                        </div>
                        <div style="font-size: 0.90rem; font-weight: 700; color: #facc15; margin-bottom: 2px;">${props.temperature}°C</div>
                        <div style="color: #94a3b8; font-size: 0.70rem;">Stress Index: <span style="color: #e2e8f0; font-weight: 600;">${props.stress || 'Active'}</span></div>
                    </div>
                `)
                .addTo(_map);
        }
    });

    _map.on('mouseenter', THERMAL_CELL_LAYER_ID, () => {
        if (_thermalActive) _map.getCanvas().style.cursor = 'pointer';
    });
    _map.on('mouseleave', THERMAL_CELL_LAYER_ID, () => {
        _map.getCanvas().style.cursor = '';
    });
}

// ── Rain Radar Dynamic Hover Card Engine with Viewport Collision Detection ────
function createRainCloudPopupHTML(props) {
    const isDry = Boolean(props.is_dry || props.type === 'dry');
    const prob = props.probability ?? 0;
    const rate = props.rate ?? 0;
    const name = props.name || 'Rain Radar Zone';
    const sector = props.sector || 'Atmospheric Inflow Corridor';
    const status = props.status || 'Active Rainband';

    const now = new Date();
    const curH = now.getHours();
    const pad = (n) => String(n).padStart(2, '0');

    let timingHtml = '';
    if (isDry || prob <= 0) {
        timingHtml = `
            <div class="rain-time-bar dry-bar">
                <span class="rtb-dot dry"></span>
                <span class="rtb-label">Clear Window:</span>
                <strong class="rtb-val">Next 12h (0% Precipitation)</strong>
            </div>
        `;
    } else if (prob < 25) {
        timingHtml = `
            <div class="rain-time-bar low-bar" style="background: rgba(14, 165, 233, 0.12); border-color: rgba(56, 189, 248, 0.35);">
                <span class="rtb-dot" style="background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
                <span class="rtb-label">Low Rain Risk:</span>
                <strong class="rtb-val" style="color: #7dd3fc;">${prob}% · Isolated Cloud Inflow</strong>
            </div>
        `;
    } else {
        const durationH = Math.max(2, Math.min(7, Math.round((prob / 100) * 5 + rate * 0.3)));
        const endH = (curH + durationH) % 24;
        const startLabel = prob >= 45 ? 'Active Now' : `Starts: ~${pad((curH + 1) % 24)}:00`;
        const endLabel = `Ends: ~${pad(endH)}:00 (${durationH}h window)`;
        timingHtml = `
            <div class="rain-time-bar active-bar">
                <span class="rtb-dot active"></span>
                <div class="rtb-times">
                    <span class="rtb-start">${startLabel}</span>
                    <span class="rtb-sep">➔</span>
                    <span class="rtb-end">${endLabel}</span>
                </div>
            </div>
        `;
    }

    if (isDry) {
        return `
            <div class="rain-cloud-hud-card dry-card">
                <div class="rain-hud-top">
                    <div class="dry-anim-sun-box">
                        <svg class="dry-animated-sun" viewBox="0 0 32 32" width="26" height="26">
                            <circle cx="16" cy="16" r="6" fill="#facc15" />
                            <g stroke="#facc15" stroke-width="1.8" stroke-linecap="round">
                                <line x1="16" y1="4" x2="16" y2="7" /><line x1="16" y1="25" x2="16" y2="28" />
                                <line x1="4" y1="16" x2="7" y2="16" /><line x1="25" y1="16" x2="28" y2="16" />
                                <line x1="7.5" y1="7.5" x2="9.6" y2="9.6" /><line x1="22.4" y1="22.4" x2="24.5" y2="24.5" />
                                <line x1="7.5" y1="24.5" x2="9.6" y2="22.4" /><line x1="22.4" y1="9.6" x2="24.5" y2="7.5" />
                            </g>
                        </svg>
                    </div>
                    <div class="rain-hud-info">
                        <strong class="rain-hud-title">${name}</strong>
                        <span class="rain-hud-sector">${sector}</span>
                    </div>
                </div>
                <div class="rain-hud-metrics">
                    <div class="rain-metric-box">
                        <span class="rm-label">PRECIP CHANCE</span>
                        <span class="rm-val">0% (DRY)</span>
                    </div>
                    <div class="rain-metric-box">
                        <span class="rm-label">INTENSITY</span>
                        <span class="rm-val">0.0 mm/h</span>
                    </div>
                </div>
                ${timingHtml}
                <div class="rain-hud-status">
                    <span class="status-beacon dry"></span>
                    <span>Zero Precipitation · Dry Sector</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="rain-cloud-hud-card">
            <div class="rain-hud-top">
                <div class="rain-anim-cloud-box">
                    <svg class="rain-animated-cloud" viewBox="0 0 32 32" width="28" height="28">
                        <defs>
                            <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#bae6fd" />
                                <stop offset="100%" stop-color="#0284c7" />
                            </linearGradient>
                        </defs>
                        <path class="cloud-puff" d="M8 20 A5 5 0 0 1 13 15 A6 6 0 0 1 23 16 A4.5 4.5 0 0 1 24 22 L8 22 Z" fill="url(#cloudGrad)" />
                        <line class="anim-raindrop drop-a" x1="11" y1="23" x2="9" y2="28" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
                        <line class="anim-raindrop drop-b" x1="16" y1="23" x2="14" y2="29" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
                        <line class="anim-raindrop drop-c" x1="21" y1="23" x2="19" y2="28" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
                    </svg>
                </div>
                <div class="rain-hud-info">
                    <strong class="rain-hud-title">${name}</strong>
                    <span class="rain-hud-sector">${sector}</span>
                </div>
            </div>
            <div class="rain-hud-metrics">
                <div class="rain-metric-box">
                    <span class="rm-label">PRECIP CHANCE</span>
                    <span class="rm-val rain-val">${prob}%</span>
                </div>
                <div class="rain-metric-box">
                    <span class="rm-label">INTENSITY</span>
                    <span class="rm-val">${rate} mm/h</span>
                </div>
            </div>
            ${timingHtml}
            <div class="rain-hud-status">
                <span class="status-beacon"></span>
                <span>${status}</span>
            </div>
        </div>
    `;
}

function positionRainHoverCard(centerX, centerY, radius) {
    if (!_hoverCardEl || !_map) return;
    const canvasRect = _map.getCanvas().getBoundingClientRect();
    const screenCenterX = canvasRect.left + centerX;
    const screenCenterY = canvasRect.top + centerY;

    const cardWidth = 260;
    const cardHeight = 165;

    // Header occupies top 58px. We need clearance of at least 70px from top.
    const spaceAbove = screenCenterY - radius - 14;
    const placeBelow = spaceAbove < (cardHeight + 70);

    let posX = screenCenterX;
    let posY = placeBelow 
        ? (screenCenterY + radius + 14) 
        : (screenCenterY - radius - 12);

    // Keep horizontally within viewport bounds (16px margin)
    const minX = 16 + (cardWidth / 2);
    const maxX = window.innerWidth - 16 - (cardWidth / 2);
    posX = Math.max(minX, Math.min(maxX, posX));

    _hoverCardEl.style.left = `${posX}px`;
    _hoverCardEl.style.top = `${posY}px`;
    _hoverCardEl.style.transform = placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
}

function showRainHoverCard(foundProps, center, radius) {
    if (!_hoverCardEl || !foundProps || !center) return;
    _hoveredCircleId = foundProps.id;
    if (_map) _map.getCanvas().style.cursor = 'pointer';

    _hoverCardEl.innerHTML = createRainCloudPopupHTML(foundProps);
    _hoverCardEl.style.display = 'block';
    _hoverCardEl.style.opacity = '1';
    _hoverCardEl.style.pointerEvents = 'none';

    positionRainHoverCard(center.x, center.y, radius);
}

function hideRainHoverCard() {
    _hoveredCircleId = null;
    _lastHoveredFeature = null;
    if (_hoverCardEl) {
        _hoverCardEl.style.display = 'none';
        _hoverCardEl.style.opacity = '0';
    }
    if (_map) _map.getCanvas().style.cursor = '';
}

export function initMapLayers(mapInstance) {
    _map = mapInstance;
    installThermalLayer();
    setupThermalCanvas();
    setupRainCanvas();
    setupWindCanvas();
    setupMapLayerInteractivity();
    fetchClimatePerception(activeRegionKey).then(() => ensureSpatialGridForActiveLocation());

    window.addEventListener('resize', () => {
        if (_streamlineField) _streamlineField.resize();
        scheduleThermalCanvasRender();
    });
}

function setupRainCanvas() {
    const container = document.getElementById('globe-container');
    if (!container || document.getElementById('map-rain-footprint-canvas')) return;
    _rainCanvasOverlay = document.createElement('canvas');
    _rainCanvasOverlay.id = 'map-rain-footprint-canvas';
    _rainCanvasOverlay.setAttribute('aria-hidden', 'true');
    _rainCanvasOverlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;opacity:0;transition:opacity 180ms ease;';
    container.appendChild(_rainCanvasOverlay);

    if (!_hoverCardEl) {
        _hoverCardEl = document.createElement('div');
        _hoverCardEl.id = 'map-rain-hover-card';
        _hoverCardEl.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:999999;transition:opacity 120ms ease;';
        document.body.appendChild(_hoverCardEl);
    }

    _map.on('move', () => {
        scheduleRainCanvasRender();
        updateRainHoverPosition();
    });
    _map.on('zoom', () => {
        scheduleRainCanvasRender();
        updateRainHoverPosition();
    });
    _map.on('resize', scheduleRainCanvasRender);

    // Bind on MapLibre event bus
    _map.on('mousemove', handleRainMapMouseMove);
    _map.on('mouseleave', hideRainHoverCard);
    _map.on('click', handleRainMapClick);

    // Also bind native canvas events
    const mapCanvas = _map.getCanvas();
    mapCanvas.addEventListener('mousemove', handleRainMapMouseMove);
    mapCanvas.addEventListener('mouseleave', hideRainHoverCard);
    mapCanvas.addEventListener('click', handleRainMapClick);
}

function handleRainMapClick(e) {
    if (!_rainActive || !_map) return;
    const canvasRect = _map.getCanvas().getBoundingClientRect();
    const mouseX = (e.point && Number.isFinite(e.point.x)) 
        ? e.point.x 
        : ((e.clientX !== undefined) ? (e.clientX - canvasRect.left) : (e.x || 0));
    const mouseY = (e.point && Number.isFinite(e.point.y)) 
        ? e.point.y 
        : ((e.clientY !== undefined) ? (e.clientY - canvasRect.top) : (e.y || 0));

    const footprintGeoJSON = buildPrecipitationFootprintGeoJSON();
    const pointFeatures = (footprintGeoJSON.features || []).filter(f => f.properties?.feature_type === 'point');

    for (const feature of pointFeatures) {
        const coords = feature.geometry?.coordinates;
        if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
        const center = _map.project(coords);
        const radiusKm = feature.properties?.radius_km || 26;
        const radius = computeCircleScreenRadius(coords, radiusKm);
        const hitRadius = Math.max(radius + 15, 28);

        if (Math.hypot(mouseX - center.x, mouseY - center.y) <= hitRadius) {
            const props = feature.properties;
            if (window.__wiaas?.selectLocationContext) {
                const targetLoc = {
                    key: props.regionKey || `city:${String(props.country || 'asia').toLowerCase()}:${String(props.city || props.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                    city: props.city || props.name,
                    name: props.city ? `${props.city}, ${props.country}` : props.name,
                    country: props.country || 'Asia',
                    latitude: coords[1],
                    longitude: coords[0],
                    locationType: 'city',
                };
                window.__wiaas.selectLocationContext(targetLoc);
            }
            break;
        }
    }
}

function computeCircleScreenRadius(coords, radiusKm) {
    if (!_map) return 10;
    const zoom = _map.getZoom();
    if (zoom < 4.2) {
        return 9.5; // Compact, tiny pinpoint circle on continental overview
    }
    if (zoom < 5.8) {
        return 13.0; // Regional country circle
    }
    if (zoom < 7.8) {
        return 18.0; // Province / district circle
    }
    // Granular city microclimate zoom (zoom >= 7.8): physically scaled with clamp [22, 54]
    const longitudeDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(coords[1] * Math.PI / 180)));
    const center = _map.project(coords);
    const edge = _map.project([coords[0] + longitudeDelta, coords[1]]);
    return Math.max(22, Math.min(54, Math.abs(edge.x - center.x)));
}

let _lastHoveredFeature = null;

function handleRainMapMouseMove(e) {
    if (!_rainActive || !_map || !_hoverCardEl) return;
    const canvasRect = _map.getCanvas().getBoundingClientRect();
    const mouseX = (e.point && Number.isFinite(e.point.x)) 
        ? e.point.x 
        : ((e.clientX !== undefined) ? (e.clientX - canvasRect.left) : (e.x || 0));
    const mouseY = (e.point && Number.isFinite(e.point.y)) 
        ? e.point.y 
        : ((e.clientY !== undefined) ? (e.clientY - canvasRect.top) : (e.y || 0));

    const footprintGeoJSON = buildPrecipitationFootprintGeoJSON();
    const pointFeatures = (footprintGeoJSON.features || []).filter(f => f.properties?.feature_type === 'point');

    let found = null;
    let foundCenter = null;
    let foundRadius = 0;

    for (const feature of pointFeatures) {
        const coords = feature.geometry?.coordinates;
        if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
        const center = _map.project(coords);
        const radiusKm = feature.properties?.radius_km || 26;
        const radius = computeCircleScreenRadius(coords, radiusKm);
        const hitRadius = Math.max(radius + 20, 32); // Generous comfortable hover buffer

        const dist = Math.hypot(mouseX - center.x, mouseY - center.y);
        if (dist <= hitRadius) {
            found = feature.properties;
            foundCenter = center;
            foundRadius = radius;
            _lastHoveredFeature = { coords, radiusKm, props: found };
            break;
        }
    }

    if (found) {
        showRainHoverCard(found, foundCenter, foundRadius);
    } else {
        hideRainHoverCard();
    }
}

function updateRainHoverPosition() {
    if (!_hoveredCircleId || !_lastHoveredFeature || !_hoverCardEl || !_map) return;
    const center = _map.project(_lastHoveredFeature.coords);
    const radius = computeCircleScreenRadius(_lastHoveredFeature.coords, _lastHoveredFeature.radiusKm);
    positionRainHoverCard(center.x, center.y, radius);
}


function scheduleRainCanvasRender() {
    if (!_rainActive || _rainCanvasFrame) return;
    _rainCanvasFrame = requestAnimationFrame(renderRainCanvas);
}

function renderRainCanvas() {
    _rainCanvasFrame = 0;
    if (!_rainCanvasOverlay || !_map || !_rainActive) return;
    const rect = _map.getContainer().getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (_rainCanvasOverlay.width !== width || _rainCanvasOverlay.height !== height) {
        _rainCanvasOverlay.width = width;
        _rainCanvasOverlay.height = height;
    }
    const context = _rainCanvasOverlay.getContext('2d');
    context.clearRect(0, 0, width, height);

    const footprintGeoJSON = buildPrecipitationFootprintGeoJSON();
    const pointFeatures = (footprintGeoJSON.features || []).filter(f => f.properties?.feature_type === 'point');

    pointFeatures.forEach((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
        const center = _map.project(coords);
        const radiusKm = feature.properties?.radius_km || 26;
        const prob = feature.properties?.probability || 0;
        const rate = feature.properties?.rate || 0.0;
        const isDry = Boolean(feature.properties?.is_dry);
        const isHovered = _hoveredCircleId && _hoveredCircleId === feature.properties?.id;

        let radius = computeCircleScreenRadius(coords, radiusKm);
        if (isHovered) radius += 2.5; // subtle focus expansion

        if (center.x < -radius || center.y < -radius || center.x > width + radius || center.y > height + radius) return;

        context.save();

        if (!isDry) {
            // A. Smooth Blinking Radial Gradient Fill (Neat & Tiny)
            const fillGrad = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
            const baseAlpha = isHovered ? 0.65 : 0.46;
            fillGrad.addColorStop(0, `rgba(56, 189, 248, ${baseAlpha * _blinkVal})`);
            fillGrad.addColorStop(0.70, `rgba(14, 165, 233, ${0.28 * _blinkVal})`);
            fillGrad.addColorStop(1, `rgba(2, 132, 199, ${0.10 * _blinkVal})`);
            context.fillStyle = fillGrad;
            context.beginPath();
            context.arc(center.x, center.y, radius, 0, Math.PI * 2);
            context.fill();

            // B. Blinking Outer Glowing Halo
            context.lineWidth = isHovered ? 5.0 : 3.5;
            context.strokeStyle = isHovered 
                ? 'rgba(56, 189, 248, 0.95)' 
                : `rgba(56, 189, 248, ${0.35 + 0.45 * _blinkVal})`;
            context.beginPath();
            context.arc(center.x, center.y, radius, 0, Math.PI * 2);
            context.stroke();

            // C. Sharp Solid Circle Boundary
            context.lineWidth = isHovered ? 2.5 : 1.8;
            context.strokeStyle = isHovered 
                ? '#ffffff' 
                : `rgba(240, 249, 255, ${0.50 + 0.50 * _blinkVal})`;
            context.beginPath();
            context.arc(center.x, center.y, radius, 0, Math.PI * 2);
            context.stroke();

            // D. Concentric Doppler Range Rings (for radius >= 16px)
            if (radius >= 16) {
                context.lineWidth = 1.0;
                context.strokeStyle = `rgba(125, 211, 252, ${0.20 + 0.25 * _blinkVal})`;
                context.setLineDash([3, 3]);
                context.beginPath();
                context.arc(center.x, center.y, radius * 0.5, 0, Math.PI * 2);
                context.stroke();
                context.setLineDash([]);
            }

            // E. Expanding Pulse Ripple Wave
            const rippleR = radius * (0.3 + 0.7 * _pulseRadiusRatio);
            const rippleOpacity = (1.0 - _pulseRadiusRatio) * 0.75 * _blinkVal;
            context.lineWidth = 1.4;
            context.strokeStyle = `rgba(56, 189, 248, ${rippleOpacity})`;
            context.beginPath();
            context.arc(center.x, center.y, rippleR, 0, Math.PI * 2);
            context.stroke();

            // F. 360 Rotating Radar Scanner Sweep Beam
            const sweepAngle = _radarSweepAngle;
            const beamWidth = 0.52;
            const sweepGradient = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
            sweepGradient.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
            sweepGradient.addColorStop(0.7, 'rgba(14, 165, 233, 0.28)');
            sweepGradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
            context.fillStyle = sweepGradient;
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.arc(center.x, center.y, radius, sweepAngle - beamWidth, sweepAngle);
            context.closePath();
            context.fill();

            // G. Leading Edge Neon Line
            context.strokeStyle = 'rgba(224, 242, 254, 0.95)';
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(center.x, center.y);
            context.lineTo(center.x + Math.cos(sweepAngle) * radius, center.y + Math.sin(sweepAngle) * radius);
            context.stroke();

            // H. Glowing Center Beacon
            context.fillStyle = `rgba(224, 242, 254, ${0.7 + 0.3 * _blinkVal})`;
            context.beginPath();
            context.arc(center.x, center.y, 2.5 + 1.2 * _blinkVal, 0, Math.PI * 2);
            context.fill();
        } else {
            // Dry Sector dashed boundary
            context.lineWidth = isHovered ? 2.0 : 1.4;
            context.strokeStyle = isHovered ? '#facc15' : 'rgba(148, 163, 184, 0.65)';
            context.setLineDash([3, 3]);
            context.beginPath();
            context.arc(center.x, center.y, radius, 0, Math.PI * 2);
            context.stroke();
            context.setLineDash([]);
        }

        // Cybernetic High-Contrast On-Canvas Landmark Badge (City & District Zoom)
        if (_map && _map.getZoom() >= 6.5) {
            const label = isDry 
                ? `${feature.properties.name} · Clear (0%)`
                : `${feature.properties.name} · ${prob}% (${rate} mm/h)`;
            
            context.font = '600 10.5px "Space Grotesk", -apple-system, sans-serif';
            const metrics = context.measureText(label);
            const textWidth = metrics.width;
            const badgeH = 20;
            const badgeW = textWidth + 24;
            const badgeX = center.x - badgeW / 2;
            const badgeY = center.y + radius + 8;

            // Draw pill background
            context.fillStyle = isDry ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.90)';
            context.beginPath();
            if (context.roundRect) {
                context.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
            } else {
                context.rect(badgeX, badgeY, badgeW, badgeH);
            }
            context.fill();

            // Draw pill border
            context.lineWidth = isHovered ? 1.5 : 1.0;
            context.strokeStyle = isDry 
                ? (isHovered ? '#facc15' : 'rgba(148, 163, 184, 0.55)') 
                : (isHovered ? '#38bdf8' : 'rgba(56, 189, 248, 0.65)');
            context.stroke();

            // Draw status beacon dot
            context.fillStyle = isDry ? '#facc15' : '#38bdf8';
            context.beginPath();
            context.arc(badgeX + 9, badgeY + badgeH / 2, 3, 0, Math.PI * 2);
            context.fill();

            // Draw text
            context.fillStyle = isDry ? '#e2e8f0' : '#f0f9ff';
            context.textBaseline = 'middle';
            context.textAlign = 'left';
            context.fillText(label, badgeX + 17, badgeY + badgeH / 2 + 0.5);
        }

        context.restore();
    });
}

function setupWindCanvas() {
    const container = document.getElementById('globe-container');
    if (!container || document.getElementById('map-wind-canvas')) return;

    _windCanvasOverlay = document.createElement('canvas');
    _windCanvasOverlay.id = 'map-wind-canvas';
    _windCanvasOverlay.className = 'map-wind-canvas';
    _windCanvasOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 12;
        opacity: 0;
        transition: opacity 0.35s ease;
    `;
    const rect = container.getBoundingClientRect();
    _windCanvasOverlay.width = Math.max(1, Math.round(rect.width || window.innerWidth));
    _windCanvasOverlay.height = Math.max(1, Math.round(rect.height || window.innerHeight));
    container.appendChild(_windCanvasOverlay);
    _streamlineField = new WindStreamlineField(_windCanvasOverlay, 280);
    _map?.on('move', () => {
        if (_windActive && prefersReducedMotion()) _streamlineField?.render({ advance: false });
    });
    _map?.on('resize', () => {
        if (_streamlineField) _streamlineField.resize();
        if (_windActive && prefersReducedMotion()) _streamlineField?.render({ advance: false });
    });
}

function startWindAnimation() {
    if (prefersReducedMotion()) {
        _streamlineField?.render({ advance: false });
        return;
    }
    if (_windAnimId) return;
    function loop() {
        if (_windActive && _streamlineField) {
            _streamlineField.render();
            _windAnimId = requestAnimationFrame(loop);
        } else {
            _windAnimId = null;
        }
    }
    _windAnimId = requestAnimationFrame(loop);
}

function stopWindAnimation() {
    if (_windAnimId) {
        cancelAnimationFrame(_windAnimId);
        _windAnimId = null;
    }
    if (_streamlineField) {
        _streamlineField.clear();
    }
}

// ── Location Transition Handlers ─────────────────────────────────────────────
/**
 * Called when the user clicks a new location/region.
 * Suspends and hides the wind streamline particles immediately until the new location loads.
 */
export function onLocationChangeStart() {
    _isLocationLoading = true;
    _spatialGridRequestId += 1;
    _spatialGridAbortController?.abort();
    _spatialGridStatus = 'loading';
    _spatialGridError = null;
    updateSpatialLayerMetadataUI();
    if (_windCanvasOverlay) {
        _windCanvasOverlay.style.opacity = '0';
    }
    if (_streamlineField) {
        _streamlineField.clear();
    }
}

/**
 * Called once the new location's telemetry and geographic flight finish.
 * Resumes wind animation with the new location's specific wind speed & direction vector.
 */
export function onLocationChangeComplete(climateData, location) {
    _isLocationLoading = false;
    updateThermalSource(climateData);
    if (climateData?.wind && _streamlineField) {
        _streamlineField.setVector(climateData.wind.speed_kmh, climateData.wind.direction_degrees);
        _streamlineField.init();
    }
    if (_windActive && _windCanvasOverlay) {
        _windCanvasOverlay.style.opacity = '0.92';
        if (prefersReducedMotion()) _streamlineField?.render({ advance: false });
        else startWindAnimation();
    }
    if (_rainActive && location) {
        updatePrecipitationCircle(location, climateData);
    }
    loadSpatialWeatherGrid(location);
}

// ── Fetch Climate Perception Telemetry ───────────────────────────────────────
export async function fetchClimatePerception(regionKey = activeRegionKey, lat = null, lon = null, name = null) {
    try {
        let url = `/analytics/${regionKey}/climate-perception`;
        if (lat && lon) url += `?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name || '')}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        _currentClimateData = json;
        updateThermalSource(json);
        updateMapTelemetryHUDs(json);
        const activeLocation = getActiveRegion();
        if (_rainActive && activeLocation) {
            updatePrecipitationCircle(activeLocation, json);
        }
        return json;
    } catch (e) {
        console.warn('[map-layers] Using direct Open-Meteo fallback for location telemetry:', e);
        const fallback = await fetchDirectOpenMeteo(lat || 30.1575, lon || 71.5249, name || 'Selected Location', regionKey);
        _currentClimateData = fallback;
        updateThermalSource(fallback);
        updateMapTelemetryHUDs(fallback);
        const activeLocation = getActiveRegion();
        if (_rainActive && activeLocation) {
            updatePrecipitationCircle(activeLocation, fallback);
        }
        return fallback;
    }
}

// Direct client-side Open-Meteo + NASA calculation fallback
async function fetchDirectOpenMeteo(lat, lon, name, regionKey) {
    try {
        const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=precipitation_probability,precipitation,rain,wind_speed_10m,wind_direction_10m,direct_normal_irradiance,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=auto`;
        const res = await fetch(omUrl);
        const om = await res.json();
        const cur = om.current || {};
        const hourly = om.hourly || {};
        const daily = om.daily || {};

        const tempC = cur.temperature_2m ?? 35.0;
        const humidity = cur.relative_humidity_2m ?? 45.0;
        const apparent = cur.apparent_temperature ?? (tempC + 2.5);
        const windSpeed = cur.wind_speed_10m ?? 12.0;
        const windDeg = cur.wind_direction_10m ?? 180;
        const windGusts = cur.wind_gusts_10m ?? (windSpeed * 1.5);
        const cloud = cur.cloud_cover ?? 10;
        const pressure = cur.surface_pressure ?? 995.0;
        const precip = cur.precipitation ?? 0.0;

        const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        const cardinal = cardinals[Math.floor((windDeg + 11.25) / 22.5) % 16];

        const hourlyProbs = (hourly.precipitation_probability || [0,0,0,0,0,0]).slice(0, 12);
        const hourlyPrecip = (hourly.precipitation || [0,0,0,0,0,0]).slice(0, 12);
        const maxNext6hProb = Math.max(...hourlyProbs.slice(0, 6), 0);

        let nextRainHour = null;
        for (let i = 0; i < hourlyProbs.length; i++) {
            if (hourlyProbs[i] >= 35 || (hourlyPrecip[i] && hourlyPrecip[i] > 0.1)) {
                nextRainHour = i + 1;
                break;
            }
        }

        // Wet-bulb approximation
        const tw = tempC * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) +
            Math.atan(tempC + humidity) - Math.atan(humidity - 1.676331) +
            0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;
        const wbgt = 0.7 * tw + 0.3 * tempC;

        return {
            region_key: regionKey,
            location_name: name,
            coordinates: { latitude: lat, longitude: lon },
            timestamp: new Date().toISOString(),
            telemetry_source: "Open-Meteo GFS/ECMWF + NASA POWER Earth Science",
            wind: {
                speed_kmh: Math.round(windSpeed * 10) / 10,
                speed_ms: Math.round((windSpeed / 3.6) * 10) / 10,
                speed_knots: Math.round((windSpeed * 0.539957) * 10) / 10,
                direction_degrees: Math.round(windDeg),
                cardinal,
                gusts_kmh: Math.round(windGusts * 10) / 10,
                beaufort_scale: windSpeed < 1 ? "Calm" : (windSpeed < 6 ? "Light Air" : (windSpeed < 12 ? "Light Breeze" : (windSpeed < 20 ? "Gentle Breeze" : "Moderate Breeze")))
            },
            precipitation_radar: {
                current_rate_mmh: precip,
                next_6h_max_probability_pct: maxNext6hProb,
                hourly_probability_12h: hourlyProbs,
                hourly_precipitation_12h: hourlyPrecip,
                next_rain_eta_hours: nextRainHour,
                rain_outlook_summary: nextRainHour ? `Approaching Rain Front in ~${nextRainHour}h` : 'Clear Skies (Zero rain expected next 12h)'
            },
            climate_perception: {
                dry_bulb_temperature_c: Math.round(tempC * 10) / 10,
                relative_humidity_pct: Math.round(humidity),
                apparent_heat_index_c: Math.round(apparent * 10) / 10,
                wet_bulb_globe_temp_c: Math.round(wbgt * 10) / 10,
                thermal_stress_category: tempC > 38 ? "Extreme Caution" : (tempC > 32 ? "Caution" : "Nominal"),
                solar_irradiance_wm2: 560.0,
                uv_index: 7.2,
                uv_category: "High",
                cloud_cover_pct: cloud,
                surface_pressure_hpa: pressure,
                climate_zone: "Asia Regional Climate Zone",
                drought_vulnerability_index: 0.48
            },
            forecast_7d: {
                max_temps_c: daily.temperature_2m_max || [],
                min_temps_c: daily.temperature_2m_min || [],
                precipitation_sums_mm: daily.precipitation_sum || [],
                rain_prob_max_pct: daily.precipitation_probability_max || []
            }
        };
    } catch (e) {
        return null;
    }
}

// ── Update HUD / Left Panel Indicators ─────────────────────────────────────────
function updateMapTelemetryHUDs(data) {
    if (!data) return;

    // 1. Update Live Wind HUD & Left Panel
    if (data.wind) {
        if (_streamlineField) {
            _streamlineField.setVector(data.wind.speed_kmh, data.wind.direction_degrees);
        }
        const panelRose = document.getElementById('panel-wind-compass-rose');
        if (panelRose) {
            panelRose.style.transform = `rotate(${data.wind.direction_degrees}deg)`;
        }
        const panelWindSpeed = document.getElementById('panel-wind-speed');
        if (panelWindSpeed) panelWindSpeed.textContent = `${data.wind.speed_kmh} km/h`;

        const panelWindSpeedMs = document.getElementById('panel-wind-speed-ms');
        if (panelWindSpeedMs) panelWindSpeedMs.textContent = `${data.wind.speed_ms} m/s`;

        const panelWindHeading = document.getElementById('panel-wind-heading');
        if (panelWindHeading) panelWindHeading.textContent = `From ${data.wind.cardinal || '—'} (${data.wind.direction_degrees}°)`;
    }

    // 2. Update Live Precipitation Prediction & Left Panel
    if (data.precipitation_radar) {
        const panelRainBadge = document.getElementById('panel-rain-status-badge');
        if (panelRainBadge) {
            const isSoon = data.precipitation_radar.next_rain_eta_hours != null || (data.precipitation_radar.next_6h_max_probability_pct || 0) >= 30;
            panelRainBadge.className = `rain-prediction-badge ${isSoon ? 'rain-alert' : 'clear'}`;
            panelRainBadge.innerHTML = `<i data-lucide="${isSoon ? 'cloud-lightning' : 'sun'}"></i><span>${data.precipitation_radar.rain_outlook_summary}</span>`;
            if (window.lucide) window.lucide.createIcons();
        }

        const panelRainProb = document.getElementById('panel-rain-prob');
        if (panelRainProb) {
            panelRainProb.textContent = `${data.precipitation_radar.next_6h_max_probability_pct}%`;
        }

        const panelRainRate = document.getElementById('panel-rain-rate');
        if (panelRainRate) {
            panelRainRate.textContent = `${data.precipitation_radar.current_rate_mmh || '0.0'} mm/h`;
        }

        // Render 12h Rain probability spark bars
        const panelBars = document.getElementById('panel-rain-hourly-bars');
        if (data.precipitation_radar.hourly_probability_12h && panelBars) {
            const probs = data.precipitation_radar.hourly_probability_12h;
            panelBars.innerHTML = probs.slice(0, 12).map((p, idx) => `
                <div class="rain-bar-col" title="+${idx+1}h: ${p}% rain probability">
                    <div class="rain-bar-fill" style="height: ${Math.max(4, p)}%; background: ${p > 50 ? '#38bdf8' : (p > 20 ? '#60a5fa' : 'rgba(255,255,255,0.15)')};"></div>
                    <span class="rain-bar-lbl">+${idx+1}h</span>
                </div>
            `).join('');
        }
    }

    // 3. Update NASA POWER / Climate Perception metrics in left panel
    if (data.climate_perception) {
        const cp = data.climate_perception;
        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        setTxt('panel-thermal-temperature', `${cp.dry_bulb_temperature_c}°C`);
        setTxt('panel-clim-dry', `${cp.dry_bulb_temperature_c}°C`);
        setTxt('panel-clim-apparent', `${cp.apparent_heat_index_c}°C`);
        setTxt('panel-clim-wbgt', `${cp.wet_bulb_globe_temp_c}°C`);
        setTxt('panel-clim-stress', cp.thermal_stress_category || 'Nominal');
        setTxt('panel-clim-solar', `${cp.solar_irradiance_wm2} W/m²`);
        setTxt('panel-clim-uv', `UV ${cp.uv_index}`);
        setTxt('panel-clim-press', `${cp.surface_pressure_hpa} hPa`);
        setTxt('panel-clim-cloud', `${cp.cloud_cover_pct}% Cloud`);
    }
}

export function isWindActive() { return _windActive; }
export function isRainActive() { return _rainActive; }
export function isThermalActive() { return _thermalActive; }
export function getCurrentClimateData() { return _currentClimateData; }

// ── Toggle Wind Layer ────────────────────────────────────────────────────────
export function toggleWindLayer(forceVal = null) {
    _windActive = forceVal !== null ? Boolean(forceVal) : !_windActive;
    const canvas = document.getElementById('map-wind-canvas');
    const switchEl = document.getElementById('switch-panel-wind');
    const switchTag = document.getElementById('switch-tag-wind');

    if (switchEl) {
        switchEl.checked = _windActive;
        const card = switchEl.closest('.layer-control-card');
        if (card) card.classList.toggle('is-active', _windActive);
    }
    if (switchTag) {
        switchTag.textContent = _windActive ? 'ENABLED' : 'DISABLED';
        switchTag.className = `layer-toggle-tag ${_windActive ? 'active' : ''}`;
    }

    if (_windActive) {
        if (canvas) {
            canvas.style.opacity = '1';
            canvas.style.display = 'block';
            if (_streamlineField) {
                _streamlineField.resize();
                _streamlineField.init();
            }
        }
        if (_currentClimateData?.wind && _streamlineField) {
            _streamlineField.setVector(_currentClimateData.wind.speed_kmh, _currentClimateData.wind.direction_degrees);
        }
        startWindAnimation();
    } else {
        if (canvas) canvas.style.opacity = '0';
        stopWindAnimation();
    }
}

// ── Toggle Rain & Precipitation Radar Layer ──────────────────────────────────
export function toggleRainLayer(forceVal = null) {
    _rainActive = forceVal !== null ? Boolean(forceVal) : !_rainActive;
    const switchEl = document.getElementById('switch-panel-rain');
    const switchTag = document.getElementById('switch-tag-rain');

    if (switchEl) {
        switchEl.checked = _rainActive;
        const card = switchEl.closest('.layer-control-card');
        if (card) card.classList.toggle('is-active', _rainActive);
    }
    if (switchTag) {
        switchTag.textContent = _rainActive ? 'ENABLED' : 'DISABLED';
        switchTag.className = `layer-toggle-tag ${_rainActive ? 'active' : ''}`;
    }

    if (_rainActive) {
        if (_rainCanvasOverlay) {
            _rainCanvasOverlay.style.opacity = '1';
            scheduleRainCanvasRender();
        }
        ensureRainRadarLayer().catch((error) => {
            console.warn('[map-layers] RainViewer radar unavailable:', error);
        });
        const activeLocation = getActiveRegion();
        const visualLocation = _spatialGridLocation || activeLocation || { locationType: 'asia', key: 'asia-overview', name: 'Asia Overview' };
        updatePrecipitationCircle(visualLocation, _currentClimateData);
        if (!prefersReducedMotion()) startPrecipitationPulseAnimation();
        ensureSpatialGridForActiveLocation();
    } else {
        if (_rainCanvasOverlay) {
            _rainCanvasOverlay.style.opacity = '0';
            _rainCanvasOverlay.getContext('2d')?.clearRect(0, 0, _rainCanvasOverlay.width, _rainCanvasOverlay.height);
        }
        setRainRadarVisibility(false);
        removePrecipitationCircle();
        stopPrecipitationPulseAnimation();
    }
}

function getLayerInsertionPoint() {
    return [
        'all-asian-cities-border-glow',
        'all-asian-cities-border-line',
        'selected-city-border-glow',
        'selected-city-border-line',
    ].find((id) => _map?.getLayer(id));
}

function setRainRadarVisibility(visible) {
    if (_map?.getLayer(RAIN_RADAR_LAYER_ID)) {
        _map.setLayoutProperty(RAIN_RADAR_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
}

async function ensureRainRadarLayer() {
    // Completely remove any external raster tile layer that returns 'Zoom Level Not Supported' tiles
    if (_map?.getLayer(RAIN_RADAR_LAYER_ID)) {
        try {
            _map.removeLayer(RAIN_RADAR_LAYER_ID);
            if (_map.getSource(RAIN_RADAR_SOURCE_ID)) _map.removeSource(RAIN_RADAR_SOURCE_ID);
        } catch (e) {}
    }
    updateSpatialLayerMetadataUI();
    return Promise.resolve();
}

function getRainMonitoringRadiusKm(rainData) {
    const radar = rainData?.precipitation_radar || {};
    const probability = Number(radar.next_6h_max_probability_pct) || 0;
    const rate = Number(radar.current_rate_mmh) || 0;
    return Math.round(Math.max(4, Math.min(40, 4 + probability * 0.1 + rate * 3)));
}

function buildGeodesicCircle(longitude, latitude, radiusKm, steps = 72) {
    const earthRadiusKm = 6371.0088;
    const angularDistance = radiusKm / earthRadiusKm;
    const latitudeRadians = latitude * Math.PI / 180;
    const longitudeRadians = longitude * Math.PI / 180;
    const coordinates = [];

    for (let index = 0; index <= steps; index += 1) {
        const bearing = (index / steps) * Math.PI * 2;
        const pointLatitude = Math.asin(
            Math.sin(latitudeRadians) * Math.cos(angularDistance)
            + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing)
        );
        const pointLongitude = longitudeRadians + Math.atan2(
            Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
            Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(pointLatitude)
        );
        coordinates.push([
            ((pointLongitude * 180 / Math.PI + 540) % 360) - 180,
            pointLatitude * 180 / Math.PI,
        ]);
    }
    return coordinates;
}

// ── MapLibre forecast precipitation footprints and pulse ────────────────────
export function findMasterPrecipitationZone(loc) {
    if (!loc) return null;
    const key = String(loc.key || '').trim().toLowerCase();
    const city = String(loc.city || '').trim().toLowerCase();
    const name = String(loc.name || '').trim().toLowerCase();
    const country = String(loc.country || '').trim().toLowerCase();
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);

    // 1. Direct regionKey match or id match
    let match = MASTER_PRECIPITATION_REGISTRY.find(z => 
        (z.regionKey && (z.regionKey.toLowerCase() === key || key.includes(z.regionKey.toLowerCase()))) ||
        (z.id && z.id.toLowerCase() === key)
    );
    if (match) return match;

    // 2. City name match
    if (city || name) {
        match = MASTER_PRECIPITATION_REGISTRY.find(z => {
            const zCity = (z.city || '').toLowerCase();
            const zName = (z.name || '').toLowerCase();
            return (city && (zCity.includes(city) || city.includes(zCity))) ||
                   (name && (zName.includes(name) || name.includes(zCity)));
        });
        if (match) return match;
    }

    // 3. Coordinate proximity match (< 45km / 0.45 degrees)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        let closest = null;
        let minD2 = 0.45 * 0.45;
        for (const z of MASTER_PRECIPITATION_REGISTRY) {
            const dLat = lat - z.latitude;
            const dLon = lon - z.longitude;
            const d2 = dLat * dLat + dLon * dLon;
            if (d2 < minD2) {
                minD2 = d2;
                closest = z;
            }
        }
        if (closest) return closest;
    }

    return null;
}

export function buildPrecipitationFootprintGeoJSON(overrideLocation = null) {
    const activeLoc = overrideLocation || _spatialGridLocation || getActiveRegion() || {};
    const locType = String(activeLoc.locationType || activeLoc.location_type || '').toLowerCase();
    const activeCountry = String(activeLoc.country || '').trim().toLowerCase();
    const activeCity = String(activeLoc.city || activeLoc.name || '').trim().toLowerCase();
    const activeKey = String(activeLoc.key || '').trim().toLowerCase();
    const zoom = _map ? _map.getZoom() : 4;

    // Scope follows the map zoom, not merely the last selected city. A city
    // can remain selected while the operator returns to the Asia overview;
    // in that state all regional precipitation cells must remain visible.
    const isCityScope = zoom >= 6.5;

    let targetZones = [];

    // 1. City / District view
    if (isCityScope) {
        const matchedZone = findMasterPrecipitationZone(activeLoc);
        // Keep every registered micro-cell for the active city. Using only the
        // current viewport bounds dropped coastal/inland cells when the map
        // camera was still settling after the fly-to animation.
        const cityZones = MASTER_PRECIPITATION_REGISTRY.filter(z => {
            const zCity = String(z.city || '').trim().toLowerCase();
            const anchorCity = activeCity || String(matchedZone?.city || '').trim().toLowerCase();
            const anchorKey = matchedZone?.regionKey || activeKey;
            return (anchorCity && zCity === anchorCity)
                || (anchorKey && z.regionKey && z.regionKey.toLowerCase() === anchorKey);
        });
        if (cityZones.length > 0) {
            targetZones = cityZones;
        } else if (matchedZone) {
            targetZones = [matchedZone];
        } else if (Number.isFinite(Number(activeLoc.latitude)) && Number.isFinite(Number(activeLoc.longitude))) {
            const lat = Number(activeLoc.latitude);
            const lon = Number(activeLoc.longitude);
            const cityName = activeLoc.city || activeLoc.name || 'Regional Zone';
            const radar = _currentClimateData?.precipitation_radar || {};
            const prob = Math.max(0, Math.min(100, Number(radar.next_6h_max_probability_pct) || 0));
            const rate = Math.max(0, Number(radar.current_rate_mmh) || 0.0);
            const isDry = prob < 15;

            const isMountain = lat >= 33.0;
            const isCoastal = (lat < 26.0 && (lon < 58.0 || (lon > 65.0 && lon < 74.0) || (lon > 80.0 && lon < 93.0)));

            const rainName = isMountain 
                ? `${cityName} Mountain Basin & Ridge Corridor`
                : (isCoastal ? `${cityName} Coastal Marine Shelf & Inflow` : `${cityName} Riverine Alluvial Basin`);
            const rainSector = isMountain
                ? 'High-Elevation Ridge Inflow · Orographic Uplift'
                : (isCoastal ? 'Coastal Marine Inflow · Convective Front' : 'Agricultural Riverine Moisture Channel');
            const rainStatus = isDry 
                ? 'Clear Window · Zero Precipitation'
                : (isMountain ? 'Active Mountain Showers' : (isCoastal ? 'Active Coastal Rainband' : 'Passing Convective Showers'));

            targetZones = [{
                id: `city-rain-${activeLoc.key || 'active'}`,
                name: rainName,
                city: cityName,
                country: activeLoc.country || 'Asia',
                latitude: lat,
                longitude: lon,
                radiusKm: 18,
                probabilityPct: prob,
                rateMmh: rate,
                sector: rainSector,
                status: rainStatus,
                isDry: isDry
            }];
        }
    }

    // 2. Regional / Country or Continental Overview (zoom < 6.5)
    if (!targetZones.length) {
        if (zoom >= 4.8 && activeCountry && activeCountry !== 'asia') {
            const countryFiltered = MASTER_PRECIPITATION_REGISTRY.filter(z => 
                z.country.toLowerCase() === activeCountry || activeCountry.includes(z.country.toLowerCase())
            );
            targetZones = countryFiltered.length ? countryFiltered : [...MASTER_PRECIPITATION_REGISTRY];
        } else {
            // Continental Asia Overview: Show ALL Asian precipitation nodes across Asia!
            targetZones = [...MASTER_PRECIPITATION_REGISTRY];
        }
    }

    const features = targetZones.flatMap((zone) => {
        const radiusKm = zone.radiusKm || 26;
        const isDry = Boolean(zone.isDry);
        const common = {
            id: zone.id,
            name: zone.name,
            probability: zone.probabilityPct,
            rate: zone.rateMmh,
            sector: zone.sector,
            status: zone.status,
            radius_km: radiusKm,
            is_dry: isDry,
            type: isDry ? 'dry' : 'rain',
            quality: 'validated_radar_perception',
            label_text: isDry ? 'DRY 0%' : `${zone.probabilityPct}% · ${zone.rateMmh} mm/h`,
            pulse: isDry ? 0 : 1,
        };
        return [
            {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [buildGeodesicCircle(Number(zone.longitude), Number(zone.latitude), radiusKm)] },
                properties: { ...common, feature_type: 'footprint' },
            },
            {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [Number(zone.longitude), Number(zone.latitude)] },
                properties: { ...common, feature_type: 'point' },
            },
        ];
    });

    return { type: 'FeatureCollection', features };
}

export function updatePrecipitationCircle(location, rainData) {
    if (!_map || !_rainActive) return;
    if (location) _spatialGridLocation = location;
    const activeLoc = location || _spatialGridLocation || getActiveRegion() || { locationType: 'asia', key: 'asia-overview' };
    const circleGeoJSON = buildPrecipitationFootprintGeoJSON(activeLoc);

    try {
        if (_map.getSource('rain-circle-source')) {
            _map.getSource('rain-circle-source').setData(circleGeoJSON);
        } else {
            _map.addSource('rain-circle-source', {
                type: 'geojson',
                data: circleGeoJSON
            });

            // 1. Prominent High-Contrast Footprint Fill
            _map.addLayer({
                id: 'rain-circle-outer',
                type: 'fill',
                source: 'rain-circle-source',
                filter: ['==', ['get', 'feature_type'], 'footprint'],
                paint: {
                    'fill-color': [
                        'case',
                        ['==', ['get', 'type'], 'dry'],
                        'rgba(100, 116, 139, 0.18)',
                        ['step', ['get', 'probability'], '#0284c7', 30, '#0ea5e9', 60, '#2563eb', 80, '#7c3aed']
                    ],
                    'fill-opacity': [
                        'case',
                        ['==', ['get', 'type'], 'dry'],
                        0.20,
                        0.44
                    ],
                }
            });

            // 2. Wide Outer Glowing Halo
            _map.addLayer({
                id: 'rain-circle-glow',
                type: 'line',
                source: 'rain-circle-source',
                filter: ['==', ['get', 'feature_type'], 'footprint'],
                paint: {
                    'line-color': [
                        'case',
                        ['==', ['get', 'type'], 'dry'],
                        'rgba(148, 163, 184, 0.45)',
                        '#38bdf8'
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 4.0, 8, 7.5, 14, 12.0],
                    'line-blur': 4.5,
                    'line-opacity': 0.70,
                }
            });

            // 3. Crisp Solid Circle Perimeter
            _map.addLayer({
                id: 'rain-circle-mid',
                type: 'line',
                source: 'rain-circle-source',
                filter: ['==', ['get', 'feature_type'], 'footprint'],
                paint: {
                    'line-color': [
                        'case',
                        ['==', ['get', 'type'], 'dry'],
                        '#94a3b8',
                        '#f0f9ff'
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2.4, 8, 3.8, 14, 5.0],
                    'line-opacity': 0.96,
                    'line-dasharray': [
                        'case',
                        ['==', ['get', 'type'], 'dry'],
                        ['literal', [3, 2]],
                        ['literal', [1, 0]]
                    ]
                }
            });

            // 4. Animated concentric pulse wave
            _map.addLayer({
                id: 'rain-circle-pulse',
                type: 'circle',
                source: 'rain-circle-source',
                filter: ['all', ['==', ['get', 'feature_type'], 'point'], ['==', ['get', 'pulse'], 1]],
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 9, 5, 14, 8, 22, 12, 38],
                    'circle-color': '#38bdf8',
                    'circle-opacity': 0.35,
                    'circle-stroke-width': 2.5,
                    'circle-stroke-color': '#7dd3fc',
                    'circle-stroke-opacity': 0.95
                }
            });

            // 5. Center Glowing Radar Beacon
            _map.addLayer({
                id: 'rain-circle-core',
                type: 'circle',
                source: 'rain-circle-source',
                filter: ['==', ['get', 'feature_type'], 'point'],
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'probability'], 0, 3.5, 50, 7.0, 100, 10.0],
                    'circle-color': [
                        'case',
                        ['==', ['get', 'type'], 'dry'],
                        '#94a3b8',
                        ['step', ['get', 'probability'], '#2dd4bf', 20, '#38bdf8', 60, '#818cf8', 80, '#c084fc']
                    ],
                    'circle-opacity': 0.98,
                    'circle-stroke-width': 2.2,
                    'circle-stroke-color': '#ffffff'
                }
            });
        }
        if (!prefersReducedMotion()) startPrecipitationPulseAnimation();
        scheduleRainCanvasRender();
    } catch (e) {
        console.warn('[map-layers] Precipitation circle update error:', e);
    }
}

function removePrecipitationCircle() {
    if (!_map) return;
    try {
        if (_map.getLayer('rain-circle-label')) _map.removeLayer('rain-circle-label');
        if (_map.getLayer('rain-circle-core')) _map.removeLayer('rain-circle-core');
        if (_map.getLayer('rain-circle-pulse')) _map.removeLayer('rain-circle-pulse');
        if (_map.getLayer('rain-circle-mid')) _map.removeLayer('rain-circle-mid');
        if (_map.getLayer('rain-circle-glow')) _map.removeLayer('rain-circle-glow');
        if (_map.getLayer('rain-circle-outer')) _map.removeLayer('rain-circle-outer');
        if (_map.getSource('rain-circle-source')) _map.removeSource('rain-circle-source');
    } catch (e) {}
}

// Dynamic MapLibre Radar Pulse Wave Animation
function startPrecipitationPulseAnimation() {
    if (prefersReducedMotion()) {
        scheduleRainCanvasRender();
        return;
    }
    if (_pulseAnimId) return;

    let _blinkTime = 0.0;

    function animatePulse() {
        if (!_rainActive || !_map) {
            stopPrecipitationPulseAnimation();
            return;
        }

        _pulseRadiusRatio = (_pulseRadiusRatio + 0.016) % 1.0;
        _radarSweepAngle = (_radarSweepAngle + 0.042) % (Math.PI * 2);
        _blinkTime += 0.065;

        // Smooth continuous on-and-off blinking cycle (sine wave: 0.15 dim to 0.95 bright)
        _blinkVal = 0.5 + 0.5 * Math.sin(_blinkTime);
        const blinkVal = _blinkVal;

        try {
            // 1. Blinking expanding radar wave pulse
            if (_map.getLayer('rain-circle-pulse')) {
                const pulseOpacity = (1.0 - _pulseRadiusRatio) * (0.2 + 0.6 * blinkVal);
                _map.setPaintProperty('rain-circle-pulse', 'circle-opacity', pulseOpacity);
                _map.setPaintProperty('rain-circle-pulse', 'circle-stroke-opacity', (1.0 - _pulseRadiusRatio) * blinkVal);
            }
            // 2. Blinking circle fill on and off
            if (_map.getLayer('rain-circle-outer')) {
                const fillOpacity = 0.12 + 0.38 * blinkVal;
                _map.setPaintProperty('rain-circle-outer', 'fill-opacity', fillOpacity);
            }
            // 3. Blinking border glow line on and off
            if (_map.getLayer('rain-circle-glow')) {
                const glowOpacity = 0.20 + 0.65 * blinkVal;
                _map.setPaintProperty('rain-circle-glow', 'line-opacity', glowOpacity);
            }
            // 4. Blinking solid perimeter line
            if (_map.getLayer('rain-circle-mid')) {
                const borderOpacity = 0.45 + 0.55 * blinkVal;
                _map.setPaintProperty('rain-circle-mid', 'line-opacity', borderOpacity);
            }
            // 5. Blinking center beacon
            if (_map.getLayer('rain-circle-core')) {
                _map.setPaintProperty('rain-circle-core', 'circle-opacity', 0.40 + 0.60 * blinkVal);
                _map.setPaintProperty('rain-circle-core', 'circle-radius', 5.0 + 3.0 * blinkVal);
            }
        } catch (e) {}

        scheduleRainCanvasRender();
        _pulseAnimId = requestAnimationFrame(animatePulse);
    }

    _pulseAnimId = requestAnimationFrame(animatePulse);
}

function stopPrecipitationPulseAnimation() {
    if (_pulseAnimId) {
        cancelAnimationFrame(_pulseAnimId);
        _pulseAnimId = null;
    }
    _pulseRadiusRatio = 0.0;
}

// ── Location Climate Perception Analysis Modal ───────────────────────────────
export function openClimatePerceptionModal() {
    const modal = document.getElementById('climate-perception-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderClimatePerceptionContent(_currentClimateData);
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

export function closeClimatePerceptionModal() {
    const modal = document.getElementById('climate-perception-modal');
    if (modal) modal.classList.add('hidden');
}

function renderClimatePerceptionContent(data) {
    if (!data) return;

    const locEl = document.getElementById('clim-modal-location');
    if (locEl) locEl.textContent = data.location_name;

    const coordsEl = document.getElementById('clim-modal-coords');
    if (coordsEl && data.coordinates) {
        coordsEl.textContent = `${data.coordinates.latitude.toFixed(3)}°N, ${data.coordinates.longitude.toFixed(3)}°E`;
    }

    const cp = data.climate_perception;
    if (cp) {
        const tempDryEl = document.getElementById('clim-dry-temp');
        if (tempDryEl) tempDryEl.textContent = `${cp.dry_bulb_temperature_c}°C`;

        const tempApparentEl = document.getElementById('clim-apparent-temp');
        if (tempApparentEl) tempApparentEl.textContent = `${cp.apparent_heat_index_c}°C`;

        const tempWetEl = document.getElementById('clim-wetbulb-temp');
        if (tempWetEl) tempWetEl.textContent = `${cp.wet_bulb_globe_temp_c}°C`;

        const stressTag = document.getElementById('clim-thermal-stress');
        if (stressTag) {
            stressTag.textContent = cp.thermal_stress_category;
            stressTag.className = `clim-tag ${cp.thermal_stress_category === 'Nominal' ? 'green' : (cp.thermal_stress_category === 'Caution' ? 'yellow' : 'red')}`;
        }

        const solarEl = document.getElementById('clim-solar-val');
        if (solarEl) solarEl.textContent = `${cp.solar_irradiance_wm2} W/m²`;

        const uvEl = document.getElementById('clim-uv-val');
        if (uvEl) uvEl.textContent = `UV ${cp.uv_index} (${cp.uv_category})`;

        const pressureEl = document.getElementById('clim-pressure-val');
        if (pressureEl) pressureEl.textContent = `${cp.surface_pressure_hpa} hPa`;

        const cloudEl = document.getElementById('clim-cloud-val');
        if (cloudEl) cloudEl.textContent = `${cp.cloud_cover_pct}% Cloud`;

        const droughtEl = document.getElementById('clim-drought-val');
        if (droughtEl) droughtEl.textContent = `${(cp.drought_vulnerability_index * 100).toFixed(0)}% Vulnerability`;

        const zoneEl = document.getElementById('clim-zone-val');
        if (zoneEl) zoneEl.textContent = cp.climate_zone;
    }

    const f7 = data.forecast_7d;
    const f7Container = document.getElementById('clim-forecast-days');
    if (f7Container && f7?.max_temps_c?.length) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayIdx = new Date().getDay();
        f7Container.innerHTML = f7.max_temps_c.slice(0, 7).map((maxT, i) => {
            const dayName = i === 0 ? 'Today' : days[(todayIdx + i) % 7];
            const minT = f7.min_temps_c[i] || (maxT - 10);
            const rainProb = f7.rain_prob_max_pct[i] || 0;
            return `
                <div class="clim-f7-day">
                    <span class="f7-day-name">${dayName}</span>
                    <span class="f7-day-max">${Math.round(maxT)}°</span>
                    <span class="f7-day-min">${Math.round(minT)}°</span>
                    <span class="f7-day-rain">${rainProb > 0 ? rainProb + '%' : '—'}</span>
                </div>
            `;
        }).join('');
    }
}
