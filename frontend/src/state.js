/**
 * state.js — Centralized application state for WIaaS frontend.
 * Single source of truth for the entire Asia Monitoring Network & Global Active Context.
 */

// ── Active Region Global Context ──────────────────────────────────────────────
// No region is selected until the user chooses a country or city.
export let activeRegionKey = null;
// The default telemetry view is Multan for a useful first load, but it is not
// a user selection. The header/chat should stay Asia-wide until a map or
// Region drawer choice is made.
window._hasExplicitRegionSelection = false;
export let activeLeftTab = null;
window._activeRegionKey = null;

// ── Complete Asian Region Registry Cache ──────────────────────────────────────
export let regionsRegistry = {
    "pakistan_multan": {
        "name": "Multan, Punjab, Pakistan",
        "city": "Multan",
        "province": "Punjab",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 30.1575,
        "longitude": 71.5249,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Hot Semi-Arid / BWh",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "AGRICULTURE",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 48.0,
        "resource_baselines": {
            "water_reservoir_m3": 2800000,
            "grid_capacity_mw": 650,
            "fuel_reserve_liters": 180000
        }
    },
    "pakistan_punjab": {
        "name": "Punjab Agri-Corridor, Pakistan",
        "city": "Punjab Region",
        "province": "Punjab",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 31.1704,
        "longitude": 72.7097,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Arid / Semi-Arid Agricultural Zone",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "AGRICULTURE",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 47.0,
        "resource_baselines": {
            "water_reservoir_m3": 3800000,
            "grid_capacity_mw": 850,
            "fuel_reserve_liters": 210000
        }
    },
    "pakistan_islamabad": {
        "name": "Islamabad Capital Territory, Pakistan",
        "city": "Islamabad",
        "province": "Federal Capital",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 33.6844,
        "longitude": 73.0479,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Humid Subtropical / Cwa",
        "risk_profile": [
            "HEAT",
            "AIR_QUALITY",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 42.0,
        "resource_baselines": {
            "water_reservoir_m3": 1900000,
            "grid_capacity_mw": 520,
            "fuel_reserve_liters": 130000
        }
    },
    "pakistan_lahore": {
        "name": "Lahore, Punjab, Pakistan",
        "city": "Lahore",
        "province": "Punjab",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 31.5204,
        "longitude": 74.3587,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Semi-Arid Megacity / BSh",
        "risk_profile": [
            "HEAT",
            "AIR_QUALITY",
            "GRID",
            "FLOOD"
        ],
        "is_featured": true,
        "expected_max_baseline": 46.0,
        "resource_baselines": {
            "water_reservoir_m3": 2400000,
            "grid_capacity_mw": 1100,
            "fuel_reserve_liters": 250000
        }
    },
    "pakistan_faisalabad": {
        "name": "Faisalabad Industrial Hub, Punjab, Pakistan",
        "city": "Faisalabad",
        "province": "Punjab",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 31.4504,
        "longitude": 73.135,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Arid Industrial / BWh",
        "risk_profile": [
            "HEAT",
            "GRID",
            "AGRICULTURE"
        ],
        "is_featured": true,
        "expected_max_baseline": 46.5,
        "resource_baselines": {
            "water_reservoir_m3": 2100000,
            "grid_capacity_mw": 720,
            "fuel_reserve_liters": 160000
        }
    },
    "pakistan_karachi": {
        "name": "Karachi Coastal Megacity, Sindh, Pakistan",
        "city": "Karachi",
        "province": "Sindh",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 24.8607,
        "longitude": 67.0011,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Hot Coastal Desert / BWh",
        "risk_profile": [
            "HEAT",
            "HUMIDITY",
            "GRID",
            "CYCLONE"
        ],
        "is_featured": true,
        "expected_max_baseline": 41.5,
        "resource_baselines": {
            "water_reservoir_m3": 3100000,
            "grid_capacity_mw": 1450,
            "fuel_reserve_liters": 350000
        }
    },
    "pakistan_hyderabad": {
        "name": "Hyderabad, Sindh, Pakistan",
        "city": "Hyderabad",
        "province": "Sindh",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 25.396,
        "longitude": 68.3578,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Hot Desert / BWh",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 47.5,
        "resource_baselines": {
            "water_reservoir_m3": 1700000,
            "grid_capacity_mw": 480,
            "fuel_reserve_liters": 120000
        }
    },
    "pakistan_sukkur": {
        "name": "Sukkur Barrage Basin, Sindh, Pakistan",
        "city": "Sukkur",
        "province": "Sindh",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 27.7052,
        "longitude": 68.8574,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Hyper-Arid River Basin / BWh",
        "risk_profile": [
            "HEAT",
            "FLOOD",
            "AGRICULTURE"
        ],
        "is_featured": true,
        "expected_max_baseline": 49.0,
        "resource_baselines": {
            "water_reservoir_m3": 4200000,
            "grid_capacity_mw": 410,
            "fuel_reserve_liters": 110000
        }
    },
    "pakistan_peshawar": {
        "name": "Peshawar Valley, Khyber Pakhtunkhwa, Pakistan",
        "city": "Peshawar",
        "province": "Khyber Pakhtunkhwa",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 34.0151,
        "longitude": 71.5249,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Hot Semi-Arid / BSh",
        "risk_profile": [
            "HEAT",
            "AIR_QUALITY",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 44.0,
        "resource_baselines": {
            "water_reservoir_m3": 1600000,
            "grid_capacity_mw": 560,
            "fuel_reserve_liters": 140000
        }
    },
    "pakistan_swat": {
        "name": "Swat Mountain Valley, Khyber Pakhtunkhwa, Pakistan",
        "city": "Swat",
        "province": "Khyber Pakhtunkhwa",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 35.2227,
        "longitude": 72.4258,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Alpine Temperate / Csb",
        "risk_profile": [
            "FLOOD",
            "GLACIAL_LAKE",
            "AGRICULTURE"
        ],
        "is_featured": true,
        "expected_max_baseline": 34.0,
        "resource_baselines": {
            "water_reservoir_m3": 2500000,
            "grid_capacity_mw": 290,
            "fuel_reserve_liters": 85000
        }
    },
    "pakistan_quetta": {
        "name": "Quetta Plateau, Balochistan, Pakistan",
        "city": "Quetta",
        "province": "Balochistan",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 30.1798,
        "longitude": 66.975,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Cold Semi-Arid Highland / BSk",
        "risk_profile": [
            "DROUGHT",
            "WATER_STRESS",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 950000,
            "grid_capacity_mw": 380,
            "fuel_reserve_liters": 115000
        }
    },
    "pakistan_gwadar": {
        "name": "Gwadar Coastal Port, Balochistan, Pakistan",
        "city": "Gwadar",
        "province": "Balochistan",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 25.1264,
        "longitude": 62.3226,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Hyper-Arid Marine / BWh",
        "risk_profile": [
            "HEAT",
            "CYCLONE",
            "WATER_STRESS",
            "GRID"
        ],
        "is_featured": true,
        "expected_max_baseline": 42.0,
        "resource_baselines": {
            "water_reservoir_m3": 780000,
            "grid_capacity_mw": 310,
            "fuel_reserve_liters": 95000
        }
    },
    "pakistan_gilgit": {
        "name": "Gilgit Northern Corridor, Gilgit-Baltistan, Pakistan",
        "city": "Gilgit",
        "province": "Gilgit-Baltistan",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 35.9221,
        "longitude": 74.3087,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "High-Altitude Arid / BWk",
        "risk_profile": [
            "GLACIAL_MELT",
            "LANDSLIDE",
            "FLOOD"
        ],
        "is_featured": true,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 3200000,
            "grid_capacity_mw": 240,
            "fuel_reserve_liters": 75000
        }
    },
    "pakistan_skardu": {
        "name": "Skardu Karakoram Zone, Gilgit-Baltistan, Pakistan",
        "city": "Skardu",
        "province": "Gilgit-Baltistan",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 35.2971,
        "longitude": 75.6333,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Alpine Glacial Basin / Dsb",
        "risk_profile": [
            "GLACIAL_LAKE",
            "FLOOD",
            "EXTREME_COLD"
        ],
        "is_featured": true,
        "expected_max_baseline": 32.0,
        "resource_baselines": {
            "water_reservoir_m3": 3900000,
            "grid_capacity_mw": 190,
            "fuel_reserve_liters": 65000
        }
    },
    "pakistan_muzaffarabad": {
        "name": "Muzaffarabad Valley, AJK, Pakistan",
        "city": "Muzaffarabad",
        "province": "Azad Jammu & Kashmir",
        "country": "Pakistan",
        "country_code": "PK",
        "asian_subregion": "South Asia",
        "latitude": 34.37,
        "longitude": 73.4711,
        "timezone": "GMT+5 (PKT - Pakistan Standard Time)",
        "timezone_offset": 5,
        "climate_zone": "Subtropical Montane / Cwa",
        "risk_profile": [
            "LANDSLIDE",
            "FLASH_FLOOD",
            "AGRICULTURE"
        ],
        "is_featured": true,
        "expected_max_baseline": 39.0,
        "resource_baselines": {
            "water_reservoir_m3": 2100000,
            "grid_capacity_mw": 280,
            "fuel_reserve_liters": 80000
        }
    },
    "india_delhi": {
        "name": "National Capital Region (Delhi), India",
        "city": "Delhi",
        "province": "Delhi NCR",
        "country": "India",
        "country_code": "IN",
        "asian_subregion": "South Asia",
        "latitude": 28.6139,
        "longitude": 77.209,
        "timezone": "GMT+5:30 (IST - India Standard Time)",
        "timezone_offset": 5.5,
        "climate_zone": "Hot Semi-Arid / BSh",
        "risk_profile": [
            "HEAT",
            "AIR_QUALITY",
            "GRID",
            "WATER_STRESS"
        ],
        "is_featured": false,
        "expected_max_baseline": 45.0,
        "resource_baselines": {
            "water_reservoir_m3": 3500000,
            "grid_capacity_mw": 1600,
            "fuel_reserve_liters": 320000
        }
    },
    "india_mumbai": {
        "name": "Mumbai Coastal Zone, Maharashtra, India",
        "city": "Mumbai",
        "province": "Maharashtra",
        "country": "India",
        "country_code": "IN",
        "asian_subregion": "South Asia",
        "latitude": 19.076,
        "longitude": 72.8777,
        "timezone": "GMT+5:30 (IST - India Standard Time)",
        "timezone_offset": 5.5,
        "climate_zone": "Tropical Wet and Dry / Aw",
        "risk_profile": [
            "FLOOD",
            "HUMIDITY",
            "CYCLONE",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 4100000,
            "grid_capacity_mw": 1900,
            "fuel_reserve_liters": 400000
        }
    },
    "india_bengaluru": {
        "name": "Bengaluru Tech Corridor, Karnataka, India",
        "city": "Bengaluru",
        "province": "Karnataka",
        "country": "India",
        "country_code": "IN",
        "asian_subregion": "South Asia",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "timezone": "GMT+5:30 (IST - India Standard Time)",
        "timezone_offset": 5.5,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "WATER_STRESS",
            "GRID",
            "HEAT"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 2200000,
            "grid_capacity_mw": 1200,
            "fuel_reserve_liters": 260000
        }
    },
    "india_kolkata": {
        "name": "Kolkata Delta Hub, West Bengal, India",
        "city": "Kolkata",
        "province": "West Bengal",
        "country": "India",
        "country_code": "IN",
        "asian_subregion": "South Asia",
        "latitude": 22.5726,
        "longitude": 88.3639,
        "timezone": "GMT+5:30 (IST - India Standard Time)",
        "timezone_offset": 5.5,
        "climate_zone": "Tropical Wet-and-Dry / Aw",
        "risk_profile": [
            "CYCLONE",
            "FLOOD",
            "HEAT",
            "HUMIDITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 41.0,
        "resource_baselines": {
            "water_reservoir_m3": 3100000,
            "grid_capacity_mw": 980,
            "fuel_reserve_liters": 210000
        }
    },
    "india_jaipur": {
        "name": "Jaipur Desert Gateway, Rajasthan, India",
        "city": "Jaipur",
        "province": "Rajasthan",
        "country": "India",
        "country_code": "IN",
        "asian_subregion": "South Asia",
        "latitude": 26.9124,
        "longitude": 75.7873,
        "timezone": "GMT+5:30 (IST - India Standard Time)",
        "timezone_offset": 5.5,
        "climate_zone": "Hot Semi-Arid / BSh",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "WATER_STRESS"
        ],
        "is_featured": false,
        "expected_max_baseline": 46.0,
        "resource_baselines": {
            "water_reservoir_m3": 1500000,
            "grid_capacity_mw": 640,
            "fuel_reserve_liters": 150000
        }
    },
    "bangladesh_dhaka": {
        "name": "Dhaka Megacity, Bangladesh",
        "city": "Dhaka",
        "province": "Dhaka Division",
        "country": "Bangladesh",
        "country_code": "BD",
        "asian_subregion": "South Asia",
        "latitude": 23.8103,
        "longitude": 90.4125,
        "timezone": "GMT+6 (BST - Bangladesh Standard Time)",
        "timezone_offset": 6,
        "climate_zone": "Tropical Monsoon / Am",
        "risk_profile": [
            "FLOOD",
            "HEAT",
            "AIR_QUALITY",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 39.0,
        "resource_baselines": {
            "water_reservoir_m3": 3600000,
            "grid_capacity_mw": 1150,
            "fuel_reserve_liters": 240000
        }
    },
    "bangladesh_chattogram": {
        "name": "Chattogram Port Coastal Zone, Bangladesh",
        "city": "Chattogram",
        "province": "Chattogram Division",
        "country": "Bangladesh",
        "country_code": "BD",
        "asian_subregion": "South Asia",
        "latitude": 22.3569,
        "longitude": 91.7832,
        "timezone": "GMT+6 (BST - Bangladesh Standard Time)",
        "timezone_offset": 6,
        "climate_zone": "Tropical Monsoon / Am",
        "risk_profile": [
            "CYCLONE",
            "STORM_SURGE",
            "FLOOD"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.5,
        "resource_baselines": {
            "water_reservoir_m3": 2800000,
            "grid_capacity_mw": 720,
            "fuel_reserve_liters": 190000
        }
    },
    "bangladesh_sylhet": {
        "name": "Sylhet Surma Basin, Bangladesh",
        "city": "Sylhet",
        "province": "Sylhet Division",
        "country": "Bangladesh",
        "country_code": "BD",
        "asian_subregion": "South Asia",
        "latitude": 24.8949,
        "longitude": 91.8687,
        "timezone": "GMT+6 (BST - Bangladesh Standard Time)",
        "timezone_offset": 6,
        "climate_zone": "Humid Subtropical / Cwa",
        "risk_profile": [
            "FLASH_FLOOD",
            "AGRICULTURE",
            "LANDSLIDE"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.0,
        "resource_baselines": {
            "water_reservoir_m3": 3100000,
            "grid_capacity_mw": 410,
            "fuel_reserve_liters": 110000
        }
    },
    "afghanistan_kabul": {
        "name": "Kabul Highland Basin, Afghanistan",
        "city": "Kabul",
        "province": "Kabul",
        "country": "Afghanistan",
        "country_code": "AF",
        "asian_subregion": "South Asia",
        "latitude": 34.5553,
        "longitude": 69.2075,
        "timezone": "GMT+4:30 (AFT - Afghanistan Time)",
        "timezone_offset": 4.5,
        "climate_zone": "Cold Semi-Arid / BSk",
        "risk_profile": [
            "DROUGHT",
            "WATER_STRESS",
            "AIR_QUALITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 1100000,
            "grid_capacity_mw": 340,
            "fuel_reserve_liters": 90000
        }
    },
    "afghanistan_kandahar": {
        "name": "Kandahar Arid Corridor, Afghanistan",
        "city": "Kandahar",
        "province": "Kandahar",
        "country": "Afghanistan",
        "country_code": "AF",
        "asian_subregion": "South Asia",
        "latitude": 31.6289,
        "longitude": 65.7372,
        "timezone": "GMT+4:30 (AFT - Afghanistan Time)",
        "timezone_offset": 4.5,
        "climate_zone": "Hot Desert / BWh",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "AGRICULTURE"
        ],
        "is_featured": false,
        "expected_max_baseline": 44.0,
        "resource_baselines": {
            "water_reservoir_m3": 850000,
            "grid_capacity_mw": 210,
            "fuel_reserve_liters": 70000
        }
    },
    "nepal_kathmandu": {
        "name": "Kathmandu Valley, Nepal",
        "city": "Kathmandu",
        "province": "Bagmati",
        "country": "Nepal",
        "country_code": "NP",
        "asian_subregion": "South Asia",
        "latitude": 27.7172,
        "longitude": 85.324,
        "timezone": "GMT+5:45 (NPT - Nepal Time)",
        "timezone_offset": 5.75,
        "climate_zone": "Subtropical Highland / Cwb",
        "risk_profile": [
            "LANDSLIDE",
            "AIR_QUALITY",
            "GLACIAL_LAKE"
        ],
        "is_featured": false,
        "expected_max_baseline": 32.0,
        "resource_baselines": {
            "water_reservoir_m3": 1800000,
            "grid_capacity_mw": 420,
            "fuel_reserve_liters": 85000
        }
    },
    "sri_lanka_colombo": {
        "name": "Colombo Maritime Zone, Sri Lanka",
        "city": "Colombo",
        "province": "Western Province",
        "country": "Sri Lanka",
        "country_code": "LK",
        "asian_subregion": "South Asia",
        "latitude": 6.9271,
        "longitude": 79.8612,
        "timezone": "GMT+5:30 (SLST - Sri Lanka Time)",
        "timezone_offset": 5.5,
        "climate_zone": "Tropical Rainforest / Af",
        "risk_profile": [
            "FLOOD",
            "HUMIDITY",
            "CYCLONE"
        ],
        "is_featured": false,
        "expected_max_baseline": 34.5,
        "resource_baselines": {
            "water_reservoir_m3": 2100000,
            "grid_capacity_mw": 580,
            "fuel_reserve_liters": 130000
        }
    },
    "bhutan_thimphu": {
        "name": "Thimphu Himalayan Sanctuary, Bhutan",
        "city": "Thimphu",
        "province": "Thimphu",
        "country": "Bhutan",
        "country_code": "BT",
        "asian_subregion": "South Asia",
        "latitude": 27.4728,
        "longitude": 89.6393,
        "timezone": "GMT+6 (BTT - Bhutan Time)",
        "timezone_offset": 6,
        "climate_zone": "Subtropical Highland / Cwb",
        "risk_profile": [
            "GLACIAL_LAKE",
            "LANDSLIDE",
            "COLD_WAVE"
        ],
        "is_featured": false,
        "expected_max_baseline": 27.0,
        "resource_baselines": {
            "water_reservoir_m3": 2900000,
            "grid_capacity_mw": 310,
            "fuel_reserve_liters": 45000
        }
    },
    "maldives_male": {
        "name": "Mal\u00e9 Atoll Ocean Node, Maldives",
        "city": "Mal\u00e9",
        "province": "Kaafu Atoll",
        "country": "Maldives",
        "country_code": "MV",
        "asian_subregion": "South Asia",
        "latitude": 4.1755,
        "longitude": 73.5093,
        "timezone": "GMT+5 (MVT - Maldives Time)",
        "timezone_offset": 5,
        "climate_zone": "Tropical Monsoon Atoll / Am",
        "risk_profile": [
            "SEA_LEVEL_RISE",
            "STORM_SURGE",
            "HUMIDITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 33.0,
        "resource_baselines": {
            "water_reservoir_m3": 650000,
            "grid_capacity_mw": 180,
            "fuel_reserve_liters": 60000
        }
    },
    "japan_tokyo": {
        "name": "Greater Tokyo Metropolitan Area, Japan",
        "city": "Tokyo",
        "province": "Kanto",
        "country": "Japan",
        "country_code": "JP",
        "asian_subregion": "East Asia",
        "latitude": 35.6762,
        "longitude": 139.6503,
        "timezone": "GMT+9 (JST - Japan Standard Time)",
        "timezone_offset": 9,
        "climate_zone": "Humid Subtropical / Cfa",
        "risk_profile": [
            "TYPHOON",
            "HEAT",
            "GRID",
            "EARTHQUAKE"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.0,
        "resource_baselines": {
            "water_reservoir_m3": 5500000,
            "grid_capacity_mw": 3200,
            "fuel_reserve_liters": 650000
        }
    },
    "japan_osaka": {
        "name": "Osaka-Kansai Industrial Basin, Japan",
        "city": "Osaka",
        "province": "Kansai",
        "country": "Japan",
        "country_code": "JP",
        "asian_subregion": "East Asia",
        "latitude": 34.6937,
        "longitude": 135.5023,
        "timezone": "GMT+9 (JST - Japan Standard Time)",
        "timezone_offset": 9,
        "climate_zone": "Humid Subtropical / Cfa",
        "risk_profile": [
            "TYPHOON",
            "HEAT",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 3800000,
            "grid_capacity_mw": 1800,
            "fuel_reserve_liters": 380000
        }
    },
    "china_beijing": {
        "name": "Beijing Capital Zone, China",
        "city": "Beijing",
        "province": "Beijing",
        "country": "China",
        "country_code": "CN",
        "asian_subregion": "East Asia",
        "latitude": 39.9042,
        "longitude": 116.4074,
        "timezone": "GMT+8 (CST - China Standard Time)",
        "timezone_offset": 8,
        "climate_zone": "Monsoon Continental / Dwa",
        "risk_profile": [
            "HEAT",
            "AIR_QUALITY",
            "GRID",
            "DROUGHT"
        ],
        "is_featured": false,
        "expected_max_baseline": 39.5,
        "resource_baselines": {
            "water_reservoir_m3": 4800000,
            "grid_capacity_mw": 2600,
            "fuel_reserve_liters": 520000
        }
    },
    "china_shanghai": {
        "name": "Shanghai Yangtze Delta Hub, China",
        "city": "Shanghai",
        "province": "Shanghai",
        "country": "China",
        "country_code": "CN",
        "asian_subregion": "East Asia",
        "latitude": 31.2304,
        "longitude": 121.4737,
        "timezone": "GMT+8 (CST - China Standard Time)",
        "timezone_offset": 8,
        "climate_zone": "Humid Subtropical / Cfa",
        "risk_profile": [
            "TYPHOON",
            "HEAT",
            "HUMIDITY",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 39.0,
        "resource_baselines": {
            "water_reservoir_m3": 5200000,
            "grid_capacity_mw": 3100,
            "fuel_reserve_liters": 600000
        }
    },
    "china_shenzhen": {
        "name": "Shenzhen Pearl River Delta, China",
        "city": "Shenzhen",
        "province": "Guangdong",
        "country": "China",
        "country_code": "CN",
        "asian_subregion": "East Asia",
        "latitude": 22.5431,
        "longitude": 114.0579,
        "timezone": "GMT+8 (CST - China Standard Time)",
        "timezone_offset": 8,
        "climate_zone": "Humid Subtropical / Cfa",
        "risk_profile": [
            "TYPHOON",
            "FLOOD",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.5,
        "resource_baselines": {
            "water_reservoir_m3": 4200000,
            "grid_capacity_mw": 2400,
            "fuel_reserve_liters": 450000
        }
    },
    "south_korea_seoul": {
        "name": "Seoul Capital Region, South Korea",
        "city": "Seoul",
        "province": "Gyeonggi",
        "country": "South Korea",
        "country_code": "KR",
        "asian_subregion": "East Asia",
        "latitude": 37.5665,
        "longitude": 126.978,
        "timezone": "GMT+9 (KST - Korea Standard Time)",
        "timezone_offset": 9,
        "climate_zone": "Humid Continental Monsoon / Dwa",
        "risk_profile": [
            "HEAT",
            "AIR_QUALITY",
            "GRID",
            "TYPHOON"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 4400000,
            "grid_capacity_mw": 2100,
            "fuel_reserve_liters": 420000
        }
    },
    "mongolia_ulaanbaatar": {
        "name": "Ulaanbaatar Steppe Basin, Mongolia",
        "city": "Ulaanbaatar",
        "province": "Ulaanbaatar",
        "country": "Mongolia",
        "country_code": "MN",
        "asian_subregion": "East Asia",
        "latitude": 47.9184,
        "longitude": 106.9177,
        "timezone": "GMT+8 (ULAT - Ulaanbaatar Time)",
        "timezone_offset": 8,
        "climate_zone": "Cold Semi-Arid / BSk",
        "risk_profile": [
            "EXTREME_COLD",
            "DROUGHT",
            "AIR_QUALITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 32.0,
        "resource_baselines": {
            "water_reservoir_m3": 1400000,
            "grid_capacity_mw": 520,
            "fuel_reserve_liters": 180000
        }
    },
    "north_korea_pyongyang": {
        "name": "Pyongyang Basin, North Korea",
        "city": "Pyongyang",
        "province": "Pyongyang",
        "country": "North Korea",
        "country_code": "KP",
        "asian_subregion": "East Asia",
        "latitude": 39.0392,
        "longitude": 125.7625,
        "timezone": "GMT+9 (KST - Pyongyang Time)",
        "timezone_offset": 9,
        "climate_zone": "Humid Continental / Dwa",
        "risk_profile": [
            "DROUGHT",
            "FLOOD",
            "AGRICULTURE"
        ],
        "is_featured": false,
        "expected_max_baseline": 35.0,
        "resource_baselines": {
            "water_reservoir_m3": 1900000,
            "grid_capacity_mw": 450,
            "fuel_reserve_liters": 100000
        }
    },
    "kazakhstan_almaty": {
        "name": "Almaty Foothills Node, Kazakhstan",
        "city": "Almaty",
        "province": "Almaty",
        "country": "Kazakhstan",
        "country_code": "KZ",
        "asian_subregion": "Central Asia",
        "latitude": 43.222,
        "longitude": 76.8512,
        "timezone": "GMT+5 (ALMT - Kazakhstan Time)",
        "timezone_offset": 5,
        "climate_zone": "Continental Montane / Dfb",
        "risk_profile": [
            "HEAT",
            "EARTHQUAKE",
            "GLACIAL_MELT"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.0,
        "resource_baselines": {
            "water_reservoir_m3": 2600000,
            "grid_capacity_mw": 680,
            "fuel_reserve_liters": 210000
        }
    },
    "kazakhstan_astana": {
        "name": "Astana Northern Steppe, Kazakhstan",
        "city": "Astana",
        "province": "Akmola",
        "country": "Kazakhstan",
        "country_code": "KZ",
        "asian_subregion": "Central Asia",
        "latitude": 51.1694,
        "longitude": 71.4491,
        "timezone": "GMT+5 (ALMT - Kazakhstan Time)",
        "timezone_offset": 5,
        "climate_zone": "Extreme Continental Steppe / Dfb",
        "risk_profile": [
            "WIND",
            "EXTREME_COLD",
            "DROUGHT"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 2100000,
            "grid_capacity_mw": 750,
            "fuel_reserve_liters": 240000
        }
    },
    "uzbekistan_tashkent": {
        "name": "Tashkent Oasis, Uzbekistan",
        "city": "Tashkent",
        "province": "Tashkent",
        "country": "Uzbekistan",
        "country_code": "UZ",
        "asian_subregion": "Central Asia",
        "latitude": 41.2995,
        "longitude": 69.2401,
        "timezone": "GMT+5 (UZT - Uzbekistan Time)",
        "timezone_offset": 5,
        "climate_zone": "Mediterranean Continental / Csa",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "WATER_STRESS",
            "AGRICULTURE"
        ],
        "is_featured": false,
        "expected_max_baseline": 42.0,
        "resource_baselines": {
            "water_reservoir_m3": 2300000,
            "grid_capacity_mw": 820,
            "fuel_reserve_liters": 190000
        }
    },
    "kyrgyzstan_bishkek": {
        "name": "Bishkek Chuy Basin, Kyrgyzstan",
        "city": "Bishkek",
        "province": "Chuy",
        "country": "Kyrgyzstan",
        "country_code": "KG",
        "asian_subregion": "Central Asia",
        "latitude": 42.8746,
        "longitude": 74.5698,
        "timezone": "GMT+6 (KGT - Kyrgyzstan Time)",
        "timezone_offset": 6,
        "climate_zone": "Continental Semi-Arid / Dsa",
        "risk_profile": [
            "AIR_QUALITY",
            "WATER_STRESS",
            "LANDSLIDE"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 1700000,
            "grid_capacity_mw": 460,
            "fuel_reserve_liters": 110000
        }
    },
    "tajikistan_dushanbe": {
        "name": "Dushanbe Pamir Valley, Tajikistan",
        "city": "Dushanbe",
        "province": "Dushanbe",
        "country": "Tajikistan",
        "country_code": "TJ",
        "asian_subregion": "Central Asia",
        "latitude": 38.5598,
        "longitude": 68.787,
        "timezone": "GMT+5 (TJT - Tajikistan Time)",
        "timezone_offset": 5,
        "climate_zone": "Mediterranean Continental / Csa",
        "risk_profile": [
            "HEAT",
            "GLACIAL_MELT",
            "HYDRO_POWER"
        ],
        "is_featured": false,
        "expected_max_baseline": 41.0,
        "resource_baselines": {
            "water_reservoir_m3": 3400000,
            "grid_capacity_mw": 510,
            "fuel_reserve_liters": 95000
        }
    },
    "turkmenistan_ashgabat": {
        "name": "Ashgabat Karakum Edge, Turkmenistan",
        "city": "Ashgabat",
        "province": "Ahal",
        "country": "Turkmenistan",
        "country_code": "TM",
        "asian_subregion": "Central Asia",
        "latitude": 37.9601,
        "longitude": 58.3261,
        "timezone": "GMT+5 (TMT - Turkmenistan Time)",
        "timezone_offset": 5,
        "climate_zone": "Cold Desert / BWk",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "WATER_STRESS",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 46.0,
        "resource_baselines": {
            "water_reservoir_m3": 1200000,
            "grid_capacity_mw": 580,
            "fuel_reserve_liters": 210000
        }
    },
    "singapore_singapore": {
        "name": "Singapore Island Megacity, Singapore",
        "city": "Singapore",
        "province": "Central Region",
        "country": "Singapore",
        "country_code": "SG",
        "asian_subregion": "Southeast Asia",
        "latitude": 1.3521,
        "longitude": 103.8198,
        "timezone": "GMT+8 (SGT - Singapore Time)",
        "timezone_offset": 8,
        "climate_zone": "Equatorial Rainforest / Af",
        "risk_profile": [
            "HUMIDITY",
            "URBAN_HEAT",
            "GRID",
            "SEA_LEVEL_RISE"
        ],
        "is_featured": false,
        "expected_max_baseline": 35.0,
        "resource_baselines": {
            "water_reservoir_m3": 2500000,
            "grid_capacity_mw": 2100,
            "fuel_reserve_liters": 450000
        }
    },
    "thailand_bangkok": {
        "name": "Bangkok Chao Phraya Delta, Thailand",
        "city": "Bangkok",
        "province": "Bangkok",
        "country": "Thailand",
        "country_code": "TH",
        "asian_subregion": "Southeast Asia",
        "latitude": 13.7563,
        "longitude": 100.5018,
        "timezone": "GMT+7 (ICT - Indochina Time)",
        "timezone_offset": 7,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "FLOOD",
            "HEAT",
            "AIR_QUALITY",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 39.0,
        "resource_baselines": {
            "water_reservoir_m3": 3900000,
            "grid_capacity_mw": 1850,
            "fuel_reserve_liters": 380000
        }
    },
    "vietnam_hanoi": {
        "name": "Hanoi Red River Delta, Vietnam",
        "city": "Hanoi",
        "province": "Hanoi",
        "country": "Vietnam",
        "country_code": "VN",
        "asian_subregion": "Southeast Asia",
        "latitude": 21.0285,
        "longitude": 105.8542,
        "timezone": "GMT+7 (ICT - Indochina Time)",
        "timezone_offset": 7,
        "climate_zone": "Humid Subtropical Monsoon / Cwa",
        "risk_profile": [
            "TYPHOON",
            "FLOOD",
            "HEAT",
            "AIR_QUALITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 39.5,
        "resource_baselines": {
            "water_reservoir_m3": 3100000,
            "grid_capacity_mw": 1200,
            "fuel_reserve_liters": 260000
        }
    },
    "vietnam_ho_chi_minh": {
        "name": "Ho Chi Minh Mekong Corridor, Vietnam",
        "city": "Ho Chi Minh City",
        "province": "Ho Chi Minh",
        "country": "Vietnam",
        "country_code": "VN",
        "asian_subregion": "Southeast Asia",
        "latitude": 10.8231,
        "longitude": 106.6297,
        "timezone": "GMT+7 (ICT - Indochina Time)",
        "timezone_offset": 7,
        "climate_zone": "Tropical Wet-and-Dry / Aw",
        "risk_profile": [
            "FLOOD",
            "HUMIDITY",
            "HEAT",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.5,
        "resource_baselines": {
            "water_reservoir_m3": 3600000,
            "grid_capacity_mw": 1600,
            "fuel_reserve_liters": 340000
        }
    },
    "indonesia_jakarta": {
        "name": "Jakarta Coastal Megacity, Indonesia",
        "city": "Jakarta",
        "province": "DKI Jakarta",
        "country": "Indonesia",
        "country_code": "ID",
        "asian_subregion": "Southeast Asia",
        "latitude": -6.2088,
        "longitude": 106.8456,
        "timezone": "GMT+7 (WIB - Western Indonesia Time)",
        "timezone_offset": 7,
        "climate_zone": "Tropical Monsoon / Am",
        "risk_profile": [
            "FLOOD",
            "SEA_LEVEL_RISE",
            "HUMIDITY",
            "AIR_QUALITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 4500000,
            "grid_capacity_mw": 2300,
            "fuel_reserve_liters": 490000
        }
    },
    "indonesia_surabaya": {
        "name": "Surabaya Industrial Port, East Java, Indonesia",
        "city": "Surabaya",
        "province": "East Java",
        "country": "Indonesia",
        "country_code": "ID",
        "asian_subregion": "Southeast Asia",
        "latitude": -7.2575,
        "longitude": 112.7521,
        "timezone": "GMT+7 (WIB - Western Indonesia Time)",
        "timezone_offset": 7,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "HEAT",
            "GRID",
            "COASTAL_SURGE"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.0,
        "resource_baselines": {
            "water_reservoir_m3": 2800000,
            "grid_capacity_mw": 1100,
            "fuel_reserve_liters": 250000
        }
    },
    "malaysia_kuala_lumpur": {
        "name": "Kuala Lumpur Klang Valley, Malaysia",
        "city": "Kuala Lumpur",
        "province": "Federal Territory",
        "country": "Malaysia",
        "country_code": "MY",
        "asian_subregion": "Southeast Asia",
        "latitude": 3.139,
        "longitude": 101.6869,
        "timezone": "GMT+8 (MYT - Malaysia Time)",
        "timezone_offset": 8,
        "climate_zone": "Tropical Rainforest / Af",
        "risk_profile": [
            "FLASH_FLOOD",
            "HUMIDITY",
            "URBAN_HEAT"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 3300000,
            "grid_capacity_mw": 1500,
            "fuel_reserve_liters": 310000
        }
    },
    "philippines_manila": {
        "name": "Metro Manila Bay Basin, Philippines",
        "city": "Manila",
        "province": "National Capital Region",
        "country": "Philippines",
        "country_code": "PH",
        "asian_subregion": "Southeast Asia",
        "latitude": 14.5995,
        "longitude": 120.9842,
        "timezone": "GMT+8 (PST - Philippine Time)",
        "timezone_offset": 8,
        "climate_zone": "Tropical Monsoon / Am",
        "risk_profile": [
            "TYPHOON",
            "STORM_SURGE",
            "FLOOD",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.0,
        "resource_baselines": {
            "water_reservoir_m3": 4100000,
            "grid_capacity_mw": 1900,
            "fuel_reserve_liters": 390000
        }
    },
    "myanmar_yangon": {
        "name": "Yangon Irrawaddy Delta, Myanmar",
        "city": "Yangon",
        "province": "Yangon Region",
        "country": "Myanmar",
        "country_code": "MM",
        "asian_subregion": "Southeast Asia",
        "latitude": 16.8661,
        "longitude": 96.1951,
        "timezone": "GMT+6:30 (MMT - Myanmar Time)",
        "timezone_offset": 6.5,
        "climate_zone": "Tropical Monsoon / Am",
        "risk_profile": [
            "CYCLONE",
            "FLOOD",
            "HEAT"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.5,
        "resource_baselines": {
            "water_reservoir_m3": 2400000,
            "grid_capacity_mw": 620,
            "fuel_reserve_liters": 140000
        }
    },
    "cambodia_phnom_penh": {
        "name": "Phnom Penh Tonle Sap Basin, Cambodia",
        "city": "Phnom Penh",
        "province": "Phnom Penh",
        "country": "Cambodia",
        "country_code": "KH",
        "asian_subregion": "Southeast Asia",
        "latitude": 11.5564,
        "longitude": 104.9282,
        "timezone": "GMT+7 (ICT - Indochina Time)",
        "timezone_offset": 7,
        "climate_zone": "Tropical Wet-and-Dry / Aw",
        "risk_profile": [
            "HEAT",
            "FLOOD",
            "AGRICULTURE"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.5,
        "resource_baselines": {
            "water_reservoir_m3": 2200000,
            "grid_capacity_mw": 480,
            "fuel_reserve_liters": 110000
        }
    },
    "laos_vientiane": {
        "name": "Vientiane Mekong Basin, Laos",
        "city": "Vientiane",
        "province": "Vientiane",
        "country": "Laos",
        "country_code": "LA",
        "asian_subregion": "Southeast Asia",
        "latitude": 17.9757,
        "longitude": 102.6331,
        "timezone": "GMT+7 (ICT - Indochina Time)",
        "timezone_offset": 7,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "HEAT",
            "FLOOD",
            "HYDRO_POWER"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 2800000,
            "grid_capacity_mw": 350,
            "fuel_reserve_liters": 80000
        }
    },
    "brunei_bandar_seri_begawan": {
        "name": "Bandar Seri Begawan Coastal Node, Brunei",
        "city": "Bandar Seri Begawan",
        "province": "Brunei-Muara",
        "country": "Brunei",
        "country_code": "BN",
        "asian_subregion": "Southeast Asia",
        "latitude": 4.9031,
        "longitude": 114.9398,
        "timezone": "GMT+8 (BNT - Brunei Time)",
        "timezone_offset": 8,
        "climate_zone": "Tropical Rainforest / Af",
        "risk_profile": [
            "HUMIDITY",
            "COASTAL_FLOOD",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 34.0,
        "resource_baselines": {
            "water_reservoir_m3": 1600000,
            "grid_capacity_mw": 420,
            "fuel_reserve_liters": 190000
        }
    },
    "timor_leste_dili": {
        "name": "Dili Coastal Foothills, Timor-Leste",
        "city": "Dili",
        "province": "Dili",
        "country": "Timor-Leste",
        "country_code": "TL",
        "asian_subregion": "Southeast Asia",
        "latitude": -8.5569,
        "longitude": 125.5603,
        "timezone": "GMT+9 (TLT - Timor-Leste Time)",
        "timezone_offset": 9,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "DROUGHT",
            "COASTAL_EROSION",
            "AGRICULTURE"
        ],
        "is_featured": false,
        "expected_max_baseline": 35.0,
        "resource_baselines": {
            "water_reservoir_m3": 890000,
            "grid_capacity_mw": 160,
            "fuel_reserve_liters": 55000
        }
    },
    "togo_maritime": {
        "name": "Maritime Region, Togo (West Africa Benchmark)",
        "city": "Lom\u00e9",
        "province": "Maritime",
        "country": "Togo",
        "country_code": "TG",
        "asian_subregion": "Global Benchmarks",
        "latitude": 6.1375,
        "longitude": 1.2223,
        "timezone": "GMT+0 (UTC)",
        "timezone_offset": 0,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "HEAT",
            "HUMIDITY",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 34.0,
        "resource_baselines": {
            "water_reservoir_m3": 1250000,
            "grid_capacity_mw": 320,
            "fuel_reserve_liters": 95000
        }
    },
    "france_paris": {
        "name": "Paris \u00cele-de-France, France",
        "city": "Paris",
        "province": "\u00cele-de-France",
        "country": "France",
        "country_code": "FR",
        "asian_subregion": "Global Benchmarks",
        "latitude": 48.8566,
        "longitude": 2.3522,
        "timezone": "GMT+2 (CEST)",
        "timezone_offset": 2,
        "climate_zone": "Temperate Oceanic / Cfb",
        "risk_profile": [
            "HEATWAVE",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 35.0,
        "resource_baselines": {
            "water_reservoir_m3": 2100000,
            "grid_capacity_mw": 600,
            "fuel_reserve_liters": 120000
        }
    },
    "spain_andalusia": {
        "name": "Andalusia, Spain",
        "city": "Seville",
        "province": "Andalusia",
        "country": "Spain",
        "country_code": "ES",
        "asian_subregion": "Global Benchmarks",
        "latitude": 37.3891,
        "longitude": -5.9845,
        "timezone": "GMT+2 (CEST)",
        "timezone_offset": 2,
        "climate_zone": "Mediterranean Hot-Summer / Csa",
        "risk_profile": [
            "DROUGHT",
            "HEAT",
            "AGRICULTURE"
        ],
        "is_featured": false,
        "expected_max_baseline": 42.0,
        "resource_baselines": {
            "water_reservoir_m3": 950000,
            "grid_capacity_mw": 450,
            "fuel_reserve_liters": 80000
        }
    },
    "germany_bavaria": {
        "name": "Bavaria, Germany",
        "city": "Munich",
        "province": "Bavaria",
        "country": "Germany",
        "country_code": "DE",
        "asian_subregion": "Global Benchmarks",
        "latitude": 48.1351,
        "longitude": 11.582,
        "timezone": "GMT+2 (CEST)",
        "timezone_offset": 2,
        "climate_zone": "Continental / Cfb",
        "risk_profile": [
            "FLOOD",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 33.0,
        "resource_baselines": {
            "water_reservoir_m3": 2800000,
            "grid_capacity_mw": 750,
            "fuel_reserve_liters": 150000
        }
    },
    "uk_london": {
        "name": "Greater London, United Kingdom",
        "city": "London",
        "province": "Greater London",
        "country": "United Kingdom",
        "country_code": "GB",
        "asian_subregion": "Global Benchmarks",
        "latitude": 51.5074,
        "longitude": -0.1278,
        "timezone": "GMT+1 (BST)",
        "timezone_offset": 1,
        "climate_zone": "Temperate Maritime / Cfb",
        "risk_profile": [
            "HEAT",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 31.0,
        "resource_baselines": {
            "water_reservoir_m3": 1500000,
            "grid_capacity_mw": 500,
            "fuel_reserve_liters": 90000
        }
    },
    "italy_sicily": {
        "name": "Sicily, Italy",
        "city": "Palermo",
        "province": "Sicily",
        "country": "Italy",
        "country_code": "IT",
        "asian_subregion": "Global Benchmarks",
        "latitude": 37.599,
        "longitude": 14.0154,
        "timezone": "GMT+2 (CEST)",
        "timezone_offset": 2,
        "climate_zone": "Mediterranean / Csa",
        "risk_profile": [
            "HEAT",
            "DROUGHT",
            "WILDFIRE"
        ],
        "is_featured": false,
        "expected_max_baseline": 44.0,
        "resource_baselines": {
            "water_reservoir_m3": 800000,
            "grid_capacity_mw": 400,
            "fuel_reserve_liters": 75000
        }
    },
    "usa_california_central_valley": {
        "name": "Central Valley, California, USA",
        "city": "Fresno",
        "province": "California",
        "country": "United States",
        "country_code": "US",
        "asian_subregion": "Global Benchmarks",
        "latitude": 36.7783,
        "longitude": -119.4179,
        "timezone": "GMT-7 (PDT)",
        "timezone_offset": -7,
        "climate_zone": "Semi-Arid Agri / BSh",
        "risk_profile": [
            "DROUGHT",
            "HEAT",
            "AGRICULTURE",
            "GRID"
        ],
        "is_featured": false,
        "expected_max_baseline": 41.0,
        "resource_baselines": {
            "water_reservoir_m3": 4500000,
            "grid_capacity_mw": 900,
            "fuel_reserve_liters": 250000
        }
    },
    "usa_texas_houston": {
        "name": "Houston, Texas, USA",
        "city": "Houston",
        "province": "Texas",
        "country": "United States",
        "country_code": "US",
        "asian_subregion": "Global Benchmarks",
        "latitude": 29.7604,
        "longitude": -95.3698,
        "timezone": "GMT-5 (CDT)",
        "timezone_offset": -5,
        "climate_zone": "Humid Subtropical / Cfa",
        "risk_profile": [
            "HURRICANE",
            "GRID",
            "HUMIDITY"
        ],
        "is_featured": false,
        "expected_max_baseline": 38.0,
        "resource_baselines": {
            "water_reservoir_m3": 3200000,
            "grid_capacity_mw": 1200,
            "fuel_reserve_liters": 300000
        }
    },
    "brazil_cerrado": {
        "name": "Cerrado Savannah, Brazil",
        "city": "Brasilia",
        "province": "Distrito Federal",
        "country": "Brazil",
        "country_code": "BR",
        "asian_subregion": "Global Benchmarks",
        "latitude": -14.235,
        "longitude": -51.9253,
        "timezone": "GMT-3 (BRT)",
        "timezone_offset": -3,
        "climate_zone": "Tropical Savanna / Aw",
        "risk_profile": [
            "DROUGHT",
            "AGRICULTURE",
            "WILDFIRE"
        ],
        "is_featured": false,
        "expected_max_baseline": 36.0,
        "resource_baselines": {
            "water_reservoir_m3": 5000000,
            "grid_capacity_mw": 800,
            "fuel_reserve_liters": 180000
        }
    },
    "canada_alberta": {
        "name": "Alberta Plains, Canada",
        "city": "Calgary",
        "province": "Alberta",
        "country": "Canada",
        "country_code": "CA",
        "asian_subregion": "Global Benchmarks",
        "latitude": 53.9333,
        "longitude": -116.5765,
        "timezone": "GMT-6 (MDT)",
        "timezone_offset": -6,
        "climate_zone": "Subarctic / Dfc",
        "risk_profile": [
            "WILDFIRE",
            "DROUGHT"
        ],
        "is_featured": false,
        "expected_max_baseline": 30.0,
        "resource_baselines": {
            "water_reservoir_m3": 2000000,
            "grid_capacity_mw": 550,
            "fuel_reserve_liters": 140000
        }
    },
    "argentina_pampas": {
        "name": "The Pampas, Argentina",
        "city": "Buenos Aires",
        "province": "Buenos Aires",
        "country": "Argentina",
        "country_code": "AR",
        "asian_subregion": "Global Benchmarks",
        "latitude": -34.6037,
        "longitude": -58.3816,
        "timezone": "GMT-3 (ART)",
        "timezone_offset": -3,
        "climate_zone": "Humid Subtropical / Cfa",
        "risk_profile": [
            "DROUGHT",
            "AGRICULTURE",
            "HEAT"
        ],
        "is_featured": false,
        "expected_max_baseline": 37.0,
        "resource_baselines": {
            "water_reservoir_m3": 2200000,
            "grid_capacity_mw": 480,
            "fuel_reserve_liters": 110000
        }
    }
};
regionsRegistry = Object.fromEntries(
    Object.entries(regionsRegistry)
        .filter(([, meta]) => meta.asian_subregion !== 'Global Benchmarks')
        .map(([key, meta]) => [key, withLocationType(key, meta)]),
);
export let regionsList = Object.keys(regionsRegistry);
export let regionNames = Object.fromEntries(Object.entries(regionsRegistry).map(([k, v]) => [k, v.name || k]));
export let regionOffsets = Object.fromEntries(Object.entries(regionsRegistry).map(([k, v]) => [k, v.timezone_offset ?? 0]));
export let activeRegion = regionsRegistry[activeRegionKey] ? { ...regionsRegistry[activeRegionKey], key: activeRegionKey } : null;

// ── Filter & Search State ─────────────────────────────────────────────────────
export let activeSubregionFilter = 'ALL'; // 'ALL', 'CENTRAL ASIA', 'EAST ASIA', 'SOUTH ASIA', 'SOUTHEAST ASIA'
export let regionSearchQuery = '';

function withLocationType(key, meta = {}) {
    const looksLikeProvince = key === 'pakistan_punjab'
        || /\b(region|corridor)\b/i.test(meta.city || '');
    return {
        ...meta,
        locationType: meta.locationType || (looksLikeProvince ? 'province' : 'city'),
    };
}

export function setRegionsRegistry(registry) {
    regionsRegistry = Object.fromEntries(
        Object.entries(registry || {})
            .filter(([, meta]) => meta.asian_subregion !== 'Global Benchmarks')
            .map(([key, meta]) => [key, withLocationType(key, meta)]),
    );
    regionsList = Object.keys(regionsRegistry);
    
    regionNames = {};
    regionOffsets = {};
    for (const [key, meta] of Object.entries(regionsRegistry)) {
        regionNames[key] = meta.name || key;
        regionOffsets[key] = meta.timezone_offset ?? 0;
    }
    
    // Refresh activeRegion object from new registry if exists
    if (regionsRegistry[activeRegionKey]) {
        activeRegion = { ...regionsRegistry[activeRegionKey], key: activeRegionKey };
    } else if (regionsList.length > 0) {
        activeRegion = { ...regionsRegistry[regionsList[0]], key: regionsList[0] };
    }
}

export function clearActiveRegion() {
    activeRegionKey = null;
    activeRegion = null;
    window._activeRegionKey = null;
    window._latestGridPredictions = null;
    window._latestGridAge = null;
}

export function setActiveRegionKey(key) {
    if (!key) {
        clearActiveRegion();
        return;
    }
    
    // Alias resolution (e.g. legacy pakistan_punjab -> pakistan_multan or vice versa)
    if (!regionsRegistry[key] && key === 'pakistan_punjab' && regionsRegistry['pakistan_multan']) {
        key = 'pakistan_multan';
    }
    
    activeRegionKey = key;
    window._activeRegionKey = key;
    window._latestGridPredictions = null;
    window._latestGridAge = null;
    
    if (regionsRegistry[key]) {
        activeRegion = { ...regionsRegistry[key], key };
    } else {
        // Fallback for dynamically added cities
        activeRegion = {
            key,
            name: regionNames[key] || key,
            city: regionNames[key] || key,
            country: 'Custom Location',
            locationType: 'city',
        };
    }
}

export function getActiveRegion() {
    if (!activeRegion && activeRegionKey) {
        setActiveRegionKey(activeRegionKey);
    }
    return activeRegion;
}

export function getRegionMetadata(key) {
    return regionsRegistry[key] || null;
}

function slugifyLocationPart(value) {
    return String(value || 'location')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatTimezoneOffset(offset) {
    const numericOffset = Number(offset);
    if (!Number.isFinite(numericOffset)) return 'GMT+0 (UTC)';
    const hours = Math.trunc(Math.abs(numericOffset));
    const minutes = Math.round((Math.abs(numericOffset) - hours) * 60);
    const sign = numericOffset >= 0 ? '+' : '-';
    return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

/**
 * Promote a map city, province, or country into the same global context used
 * by every analytics module. The backend receives this metadata on demand and
 * registers the location in its shared physics pipeline.
 */
export function registerLocationContext(location = {}) {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const locationType = location.locationType || (location.city ? 'city' : 'region');
    const baseName = location.name || location.city || location.province || location.country || 'Asian Location';
    const key = location.key || [
        locationType,
        slugifyLocationPart(location.country),
        slugifyLocationPart(baseName),
    ].join(':');

    // Preserve the backend's richer curated metadata for its original regions.
    if (regionsRegistry[key] && !regionsRegistry[key].is_dynamic) return key;

    const country = location.country || 'Asia';
    const displayName = locationType === 'city' && country && !String(baseName).includes(country)
        ? `${baseName}, ${country}`
        : baseName;
    const timezoneOffset = Number(location.timezone_offset ?? 0);
    const coordinateSeed = Math.floor(Math.abs(latitude * 37) + Math.abs(longitude * 19));
    const scale = locationType === 'country' ? 6 : (['province', 'region'].includes(locationType) ? 2.4 : 1);

    const meta = withLocationType(key, {
        ...location,
        key,
        name: displayName,
        city: locationType === 'city' ? (location.city || baseName) : undefined,
        province: location.province,
        country,
        asian_subregion: location.asian_subregion || 'Asia',
        latitude,
        longitude,
        timezone: location.timezone || location.timeZone || formatTimezoneOffset(timezoneOffset),
        timeZone: location.timeZone,
        timezone_offset: Number.isFinite(timezoneOffset) ? timezoneOffset : 0,
        locationType,
        climate_zone: location.climate_zone || 'Live Coordinate Microclimate',
        risk_profile: location.risk_profile || ['LIVE_WEATHER', 'AGRICULTURE', 'GRID', 'LOGISTICS'],
        is_featured: false,
        is_dynamic: true,
        mapOnly: Boolean(location.mapOnly),
        expected_max_baseline: location.expected_max_baseline
            ?? Number((40.5 - Math.min(Math.abs(latitude), 65) * 0.12).toFixed(1)),
        resource_baselines: location.resource_baselines || {
            water_reservoir_m3: Math.floor((1450000 + (coordinateSeed % 1350000)) * scale),
            grid_capacity_mw: Math.floor((420 + (coordinateSeed % 680)) * scale),
            fuel_reserve_liters: Math.floor((95000 + (coordinateSeed % 155000)) * scale),
        },
    });

    regionsRegistry[key] = meta;
    if (!regionsList.includes(key)) regionsList.push(key);
    regionNames[key] = meta.name;
    regionOffsets[key] = meta.timezone_offset;
    return key;
}

export function setActiveSubregionFilter(subregion) {
    activeSubregionFilter = subregion || 'ALL';
}

export function setRegionSearchQuery(query) {
    regionSearchQuery = (query || '').trim().toLowerCase();
}

export function setActiveLeftTab(tab) {
    activeLeftTab = tab;
}

// ── Telemetry Cache ───────────────────────────────────────────────────────────
export const regionsTelemetryCache = {};

// ── Map Layer Toggles ───────────────────────────────────────────────────────
export let heatmapActive       = false;
export let windActive          = false;
export let precipitationActive = false;

export function setHeatmapActive(val)       { heatmapActive = val; }
export function setWindActive(val)          { windActive = val; }
export function setPrecipitationActive(val) { precipitationActive = val; }

// ── Bottom Panel Content Mode ─────────────────────────────────────────────────
export let bottomPanelMode = 'analytics'; // 'analytics' or 'agents'
export function setBottomPanelMode(val) { bottomPanelMode = val; }

// ── Chat Panel Mode ───────────────────────────────────────────────────────────
export let chatMode = 'assistant'; // 'assistant' or 'crisislens'
export function setChatMode(val) { chatMode = val; }
