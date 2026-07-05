/**
 * ui-cities.js — UI components and event handlers for city search and management.
 * Provides the interface for users to search, add, and remove cities dynamically.
 */

import citiesManager from './cities.js';
import { addDynamicRegion, syncDynamicCities, regionNames, setActiveRegionKey } from './state.js';
import { buildGlobePins } from './globe.js';

/**
 * Initialize the city search panel in the left sidebar
 * Call this during app initialization (e.g., in main.js)
 */
export async function initializeCitySearchUI() {
    // Load previously saved cities from localStorage
    citiesManager.loadFromDisk('wiaas_selected_cities');
    syncDynamicCities();
    
    // Create or update the city search panel HTML
    injectCitySearchPanel();
    wireupCitySearchEvents();
}

/**
 * Inject the city search HTML into a suitable location
 * This inserts it into the left sidebar or creates a floating panel
 */
function injectCitySearchPanel() {
    const leftSidebar = document.getElementById('left-sidebar');
    if (!leftSidebar) return;
    
    // Check if already exists
    if (document.getElementById('city-search-panel')) {
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'city-search-panel';
    panel.className = 'panel-card city-search-card';
    panel.innerHTML = `
        <div class="panel-header">
            <div class="header-title">
                <i data-lucide="search" class="accent-icon"></i>
                <h2>City Explorer</h2>
            </div>
            <div class="header-actions">
                <button class="action-btn" id="toggle-city-panel" title="Toggle"><i data-lucide="chevron-right"></i></button>
            </div>
        </div>
        <div class="panel-body city-search-body">
            <!-- Search Input -->
            <div class="city-search-input-wrapper">
                <input 
                    type="text" 
                    id="city-search-input" 
                    placeholder="Search city (e.g., Paris, Mumbai, Lagos)..."
                    autocomplete="off"
                    class="city-search-input"
                />
                <button id="city-search-btn" class="city-search-btn" title="Search">
                    <i data-lucide="search"></i>
                </button>
            </div>
            
            <!-- Search Results -->
            <div id="city-search-results" class="city-search-results hidden">
                <!-- Results dynamically inserted here -->
            </div>
            
            <!-- Selected Cities List -->
            <div class="city-selected-section">
                <h3 class="section-title">Your Selected Cities</h3>
                <div id="city-selected-list" class="city-list">
                    <!-- Selected cities dynamically inserted here -->
                </div>
            </div>
            
            <!-- Actions -->
            <div class="city-actions">
                <button id="city-refresh-globe-btn" class="action-btn-primary" title="Update Globe">
                    <i data-lucide="globe"></i> Refresh Globe
                </button>
                <button id="city-clear-all-btn" class="action-btn-secondary" title="Clear All">
                    <i data-lucide="trash-2"></i> Clear All
                </button>
            </div>
        </div>
    `;
    
    // Insert before the first panel-card or at the beginning of the left sidebar
    const firstCard = leftSidebar.querySelector('.panel-card');
    if (firstCard) {
        leftSidebar.insertBefore(panel, firstCard);
    } else {
        leftSidebar.appendChild(panel);
    }
    
    // Update Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Wire up event listeners for city search UI
 */
function wireupCitySearchEvents() {
    const searchInput = document.getElementById('city-search-input');
    const searchBtn = document.getElementById('city-search-btn');
    const clearAllBtn = document.getElementById('city-clear-all-btn');
    const refreshGlobeBtn = document.getElementById('city-refresh-globe-btn');
    const togglePanelBtn = document.getElementById('toggle-city-panel');

    // The collapse chevron in the header was never wired up before, which
    // meant the City Explorer card always stayed fully expanded and fought
    // the Agriculture / General Info cards for space. Now it just folds
    // the body away, leaving only the header visible.
    togglePanelBtn?.addEventListener('click', () => {
        const panel = document.getElementById('city-search-panel');
        const icon  = togglePanelBtn.querySelector('i');
        const collapsed = panel.classList.toggle('collapsed');
        if (icon) icon.setAttribute('data-lucide', collapsed ? 'chevron-down' : 'chevron-right');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    if (!searchInput) return;
    
    // Search on button click or Enter key
    searchBtn?.addEventListener('click', () => performCitySearch());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performCitySearch();
    });
    
    // Debounce search as user types (optional: can comment out to only search on Enter)
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (searchInput.value.length >= 2) {
                performCitySearch();
            }
        }, 300);
    });
    
    // Clear all cities
    clearAllBtn?.addEventListener('click', async () => {
        if (confirm('Clear all selected cities?')) {
            citiesManager.clearAllCities();
            citiesManager.saveToDisk('wiaas_selected_cities');
            refreshCityUI();
            await buildGlobePins(citiesManager.getAllCities());
        }
    });
    
    // Refresh globe with current cities
    refreshGlobeBtn?.addEventListener('click', async () => {
        const cities = citiesManager.getAllCities();
        if (cities.length === 0) {
            alert('No cities selected. Search and add cities first.');
            return;
        }
        await buildGlobePins(cities);
        // Optional: Show a toast/notification
        console.log('[ui-cities] Globe updated with', cities.length, 'cities');
    });
    
    // Initial render
    refreshCityUI();
}

/**
 * Perform city search via Nominatim
 */
async function performCitySearch() {
    const searchInput = document.getElementById('city-search-input');
    const query = searchInput?.value?.trim();
    
    if (!query || query.length < 2) {
        return;
    }
    
    const resultsDiv = document.getElementById('city-search-results');
    if (!resultsDiv) return;
    
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '<p class="search-loading">Searching...</p>';
    
    try {
        const results = await citiesManager.searchCities(query, 10);
        
        if (results.length === 0) {
            resultsDiv.innerHTML = '<p class="search-no-results">No cities found. Try a different search.</p>';
            return;
        }
        
        resultsDiv.innerHTML = results.map((city, idx) => `
            <div class="city-result-item" data-index="${idx}">
                <div class="city-result-info">
                    <div class="city-result-name">${escapeHtml(city.name)}</div>
                    <div class="city-result-details">${escapeHtml(city.displayName)}</div>
                </div>
                <button class="city-result-add-btn" data-city-index="${idx}" title="Add this city">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        `).join('');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Wire up "add" buttons
        resultsDiv.querySelectorAll('.city-result-add-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.dataset.cityIndex);
                const selectedCity = results[idx];
                
                if (citiesManager.addCity(selectedCity)) {
                    citiesManager.saveToDisk('wiaas_selected_cities');
                    addDynamicRegion(selectedCity);
                    refreshCityUI();
                    searchInput.value = '';
                    resultsDiv.classList.add('hidden');
                    // Drop the pin on the globe immediately instead of waiting
                    // for the user to press "Refresh Globe".
                    await buildGlobePins(citiesManager.getAllCities());
                    console.log('[ui-cities] Added city:', selectedCity.name);
                } else {
                    alert('City already added or limit reached.');
                }
            });
        });
    } catch (error) {
        console.error('[ui-cities] Search error:', error);
        resultsDiv.innerHTML = '<p class="search-error">Search failed. Please try again.</p>';
    }
}

/**
 * Refresh the UI to display current selected cities
 */
function refreshCityUI() {
    const selectedList = document.getElementById('city-selected-list');
    if (!selectedList) return;
    
    const cities = citiesManager.getAllCities();
    
    if (cities.length === 0) {
        selectedList.innerHTML = '<p class="city-list-empty">No cities selected. Search above to add.</p>';
        return;
    }
    
    selectedList.innerHTML = cities.map((city, idx) => `
        <div class="city-item" data-city-id="${city.id}">
            <div class="city-item-info">
                <div class="city-item-name">${escapeHtml(city.name)}</div>
                <div class="city-item-coords">${city.latitude.toFixed(2)}°, ${city.longitude.toFixed(2)}°</div>
            </div>
            <div class="city-item-actions">
                <button class="city-item-select-btn" data-city-id="${city.id}" title="Select as active">
                    <i data-lucide="target"></i>
                </button>
                <button class="city-item-remove-btn" data-city-id="${city.id}" title="Remove">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Wire up city item actions
    selectedList.querySelectorAll('.city-item-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cityId = btn.dataset.cityId;
            citiesManager.removeCity(cityId);
            citiesManager.saveToDisk('wiaas_selected_cities');
            refreshCityUI();
            // Keep the globe pins in sync with the removed city.
            await buildGlobePins(citiesManager.getAllCities());
        });
    });
    
    selectedList.querySelectorAll('.city-item-select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cityId = btn.dataset.cityId;
            const city = cities.find(c => c.id === cityId);
            if (city) {
                setActiveRegionKey(city.id);
                // Trigger region change event or directly load data
                const event = new CustomEvent('citySelected', { detail: { cityId, city } });
                document.dispatchEvent(event);
                console.log('[ui-cities] Selected city:', city.name);
            }
        });
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

export { wireupCitySearchEvents, refreshCityUI };
