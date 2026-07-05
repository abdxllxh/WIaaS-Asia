/**
 * cities.js — Dynamic city management and Nominatim geolocation API integration.
 * This replaces hardcoded city lists with a dynamic, searchable system.
 * Uses OpenStreetMap Nominatim API (FREE, no authentication required).
 */

export const citiesManager = {
    // User-selected cities (stored after search)
    userCities: [],
    
    // Cache for Nominatim results to avoid repeated API calls
    nominatimCache: {},
    
    /**
     * Search for cities using Nominatim API (free, no key needed)
     * @param {string} query - City name or location (e.g., "Paris", "Punjab")
     * @param {number} limit - Max results to return (default: 5)
     * @returns {Promise<Array>} Array of city objects with name, lat, lon, displayName
     */
    async searchCities(query, limit = 5) {
        if (!query || query.trim().length < 2) {
            return [];
        }
        
        const cacheKey = `${query.toLowerCase()}_${limit}`;
        if (this.nominatimCache[cacheKey]) {
            return this.nominatimCache[cacheKey];
        }
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const results = await response.json();
            const formatted = results.map(r => ({
                name: r.name || r.display_name.split(',')[0],
                displayName: r.display_name,
                latitude: parseFloat(r.lat),
                longitude: parseFloat(r.lon),
                osmType: r.osm_type,
                osmId: r.osm_id,
                boundingBox: r.boundingbox,
                type: r.type,
            }));
            
            // Cache the result
            this.nominatimCache[cacheKey] = formatted;
            return formatted;
        } catch (error) {
            console.error('[cities] Nominatim search failed:', error);
            return [];
        }
    },
    
    /**
     * Reverse geocode: get city name from coordinates
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Promise<Object|null>} City object or null if not found
     */
    async getCityFromCoordinates(lat, lon) {
        const cacheKey = `reverse_${lat}_${lon}`;
        if (this.nominatimCache[cacheKey]) {
            return this.nominatimCache[cacheKey];
        }
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            const city = {
                name: result.name || result.address?.city || result.address?.town || 'Unknown',
                displayName: result.display_name,
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                country: result.address?.country || '',
            };
            
            this.nominatimCache[cacheKey] = city;
            return city;
        } catch (error) {
            console.error('[cities] Reverse geocoding failed:', error);
            return null;
        }
    },
    
    /**
     * Add a city to user's selected cities
     * @param {Object} cityData - City object from search results
     */
    addCity(cityData) {
        // Avoid duplicates
        const exists = this.userCities.some(c => 
            c.latitude === cityData.latitude && 
            c.longitude === cityData.longitude
        );
        
        if (!exists && this.userCities.length < 50) {
            this.userCities.push({
                ...cityData,
                id: `${cityData.latitude}_${cityData.longitude}`,
                addedAt: new Date().toISOString(),
            });
            return true;
        }
        return false;
    },
    
    /**
     * Remove a city from user's selected cities
     * @param {string} cityId - City identifier
     */
    removeCity(cityId) {
        this.userCities = this.userCities.filter(c => c.id !== cityId);
    },
    
    /**
     * Get all user-selected cities
     * @returns {Array} User's cities
     */
    getAllCities() {
        return this.userCities;
    },
    
    /**
     * Clear all user-selected cities
     */
    clearAllCities() {
        this.userCities = [];
    },
    
    /**
     * Export cities as JSON (for saving to localStorage or backend)
     * @returns {string} JSON string of cities
     */
    exportToJSON() {
        return JSON.stringify(this.userCities);
    },
    
    /**
     * Import cities from JSON
     * @param {string} jsonStr - JSON string of cities
     */
    importFromJSON(jsonStr) {
        try {
            this.userCities = JSON.parse(jsonStr);
            return true;
        } catch (error) {
            console.error('[cities] Import failed:', error);
            return false;
        }
    },
    
    /**
     * Persist cities to localStorage
     * @param {string} key - localStorage key (default: 'wiaas_cities')
     */
    saveToDisk(key = 'wiaas_cities') {
        try {
            localStorage.setItem(key, this.exportToJSON());
            return true;
        } catch (error) {
            console.error('[cities] Save to disk failed:', error);
            return false;
        }
    },
    
    /**
     * Load cities from localStorage
     * @param {string} key - localStorage key (default: 'wiaas_cities')
     */
    loadFromDisk(key = 'wiaas_cities') {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                return this.importFromJSON(data);
            }
            return false;
        } catch (error) {
            console.error('[cities] Load from disk failed:', error);
            return false;
        }
    },
};

export default citiesManager;
