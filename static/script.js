// API Base URL
const API_BASE = 'http://localhost:8000';

// Global state
let allConfigs = [];
let filteredConfigs = [];

// DOM Elements - will be set when DOM is ready
let createForm, editForm, editModal, configsList, statusMessage;

// Initialize DOM elements
function initializeDOMElements() {
    createForm = document.getElementById('createForm');
    editForm = document.getElementById('editForm');
    editModal = document.getElementById('editModal');
    configsList = document.getElementById('configsList');
    statusMessage = document.getElementById('statusMessage');
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing app...');
    initializeDOMElements();
    setupEventListeners();
    loadAllConfigs();
});

// Event Listeners
function setupEventListeners() {
    // Wait for DOM elements to be available
    const createFormEl = document.getElementById('createForm');
    const editFormEl = document.getElementById('editForm');
    const searchServiceEl = document.getElementById('searchService');
    const searchEnvEl = document.getElementById('searchEnv');

    if (createFormEl) {
        createFormEl.addEventListener('submit', handleCreateConfig);
    }

    if (editFormEl) {
        editFormEl.addEventListener('submit', handleEditConfig);
    }

    // Real-time search
    if (searchServiceEl) {
        searchServiceEl.addEventListener('input', debounce(performSearch, 300));
    }

    if (searchEnvEl) {
        searchEnvEl.addEventListener('change', performSearch);
    }

    // Close modal when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target === editModal) {
            closeEditModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && editModal.style.display === 'block') {
            closeEditModal();
        }
    });
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create Configuration
async function handleCreateConfig(e) {
    e.preventDefault();

    const serviceName = document.getElementById('serviceName').value.trim();
    const envName = document.getElementById('envName').value;
    const configData = getConfigDataFromPairs('configPairs');

    if (!serviceName || !envName) {
        showStatus('Please fill in service name and environment', 'error');
        return;
    }

    if (Object.keys(configData).length === 0) {
        showStatus('Please add at least one configuration variable', 'error');
        return;
    }

    try {
        const payload = {
            service_name: serviceName,
            env_name: envName,
            data: configData
        };

        const response = await fetch(`${API_BASE}/configs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const configId = await response.text();
            showStatus(`Configuration created successfully!`, 'success');

            // Reset form
            createForm.reset();
            document.getElementById('configPairs').innerHTML = '';
            addConfigPair(); // Add one empty pair

            loadAllConfigs(); // Refresh the list
        } else {
            const error = await response.json();
            showStatus(`Error: ${error.detail || 'Failed to create configuration'}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Load All Configurations
async function loadAllConfigs() {
    try {
        showLoading();

        const response = await fetch(`${API_BASE}/configs`);

        if (response.ok) {
            allConfigs = await response.json();
            filteredConfigs = [...allConfigs];
            displayConfigs(filteredConfigs);
            updateStats();
            updateQuickFilters(); // Update filter buttons based on actual data
        } else {
            const error = await response.json();
            showStatus(`Error loading configurations: ${error.detail}`, 'error');
            showEmptyState();
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        showEmptyState();
    }
}

// Search Configurations
async function searchConfigs() {
    const serviceName = document.getElementById('searchService').value.trim();
    const envName = document.getElementById('searchEnv').value;

    if (!serviceName || !envName) {
        showStatus('Please enter both service name and environment to search', 'error');
        return;
    }

    try {
        showLoading();

        const response = await fetch(`${API_BASE}/configs/search?service_name=${encodeURIComponent(serviceName)}&env_name=${encodeURIComponent(envName)}`);

        if (response.ok) {
            const configs = await response.json();
            // API returns single config or array, normalize to array
            const configArray = Array.isArray(configs) ? configs : [configs];
            filteredConfigs = configArray;
            displayConfigs(filteredConfigs);
            updateStats();
        } else {
            const error = await response.json();
            showStatus(`No configurations found: ${error.detail}`, 'error');
            showEmptyState();
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        showEmptyState();
    }
}

// Real-time search/filter
function performSearch() {
    const searchServiceInput = document.getElementById('searchService');
    const searchEnvSelect = document.getElementById('searchEnv');

    if (!searchServiceInput || !searchEnvSelect) {
        console.error('Search elements not found');
        return;
    }

    const searchTerm = searchServiceInput.value.toLowerCase().trim();
    const envFilter = searchEnvSelect.value;

    console.log('Performing search with:', { searchTerm, envFilter });
    console.log('All configs:', allConfigs.length);

    filteredConfigs = allConfigs.filter(config => {
        const matchesSearch = !searchTerm || config.service_name.toLowerCase().includes(searchTerm);
        const matchesEnv = !envFilter || config.env_name === envFilter;
        console.log(`Config ${config.service_name} (${config.env_name}): search=${matchesSearch}, env=${matchesEnv}`);
        return matchesSearch && matchesEnv;
    });

    console.log('Filtered results:', filteredConfigs.length);
    displayConfigs(filteredConfigs);
    updateStats();
}

// Filter by environment
function filterByEnv(env) {
    console.log('Filtering by environment:', env);
    console.log('Available environments in data:', [...new Set(allConfigs.map(c => c.env_name))]);
    console.log('Total configs before filter:', allConfigs.length);

    const searchEnvSelect = document.getElementById('searchEnv');
    const searchServiceInput = document.getElementById('searchService');

    if (searchEnvSelect) {
        searchEnvSelect.value = env;
    }
    if (searchServiceInput) {
        searchServiceInput.value = '';
    }

    performSearch();

    console.log('Filtered configs after filter:', filteredConfigs.length);
}

// Update quick filter buttons and search dropdown based on actual data
function updateQuickFilters() {
    if (allConfigs.length === 0) return;

    const uniqueEnvs = [...new Set(allConfigs.map(c => c.env_name))].sort();
    console.log('Updating filters for environments:', uniqueEnvs);

    // Update quick filter buttons
    const quickFiltersContainer = document.querySelector('.card .button-group[style*="flex-direction: column"]');

    if (quickFiltersContainer) {
        // Clear existing buttons
        quickFiltersContainer.innerHTML = '';

        // Add environment filter buttons
        uniqueEnvs.forEach(env => {
            const button = document.createElement('button');
            button.className = 'btn btn-secondary';
            button.onclick = () => filterByEnv(env);

            // Capitalize first letter for display
            const displayName = env.charAt(0).toUpperCase() + env.slice(1);
            button.textContent = `${displayName} Only`;

            quickFiltersContainer.appendChild(button);
        });

        // Add "Show All" button
        const showAllButton = document.createElement('button');
        showAllButton.className = 'btn btn-secondary';
        showAllButton.onclick = clearFilters;
        showAllButton.textContent = 'Show All';
        quickFiltersContainer.appendChild(showAllButton);
    }

    // Update search dropdown options
    const searchEnvSelect = document.getElementById('searchEnv');
    if (searchEnvSelect) {
        // Keep the "All Environments" option
        const currentValue = searchEnvSelect.value;
        searchEnvSelect.innerHTML = '<option value="">All Environments</option>';

        // Add options for each environment in the data
        uniqueEnvs.forEach(env => {
            const option = document.createElement('option');
            option.value = env;
            option.textContent = env.charAt(0).toUpperCase() + env.slice(1);
            searchEnvSelect.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && uniqueEnvs.includes(currentValue)) {
            searchEnvSelect.value = currentValue;
        }
    }
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchEnv').value = '';
    document.getElementById('searchService').value = '';
    filteredConfigs = [...allConfigs];
    displayConfigs(filteredConfigs);
    updateStats();
}

// Display Configurations
function displayConfigs(configs) {
    if (!configs || configs.length === 0) {
        showEmptyState();
        return;
    }

    const configsHtml = configs.map(config => `
        <div class="config-item">
            <div class="config-service">
                <div>${escapeHtml(config.service_name)}</div>
                <div class="config-service-id">${config.id}</div>
            </div>
            <div class="config-env">
                <span class="env-${config.env_name}">${config.env_name}</span>
            </div>
            <div class="config-data-preview">
                <pre>${JSON.stringify(config.data, null, 2)}</pre>
            </div>
            <div class="config-actions">
                <button onclick="editConfig('${config.id}')" class="btn btn-secondary btn-sm" title="Edit Configuration">
                    Edit
                </button>
                <button onclick="deleteConfig('${config.id}')" class="btn btn-danger btn-sm" title="Delete Configuration">
                    Delete
                </button>
            </div>
        </div>
    `).join('');

    configsList.innerHTML = configsHtml;
}

// Update statistics
function updateStats() {
    const totalConfigs = filteredConfigs.length;
    const uniqueServices = new Set(filteredConfigs.map(c => c.service_name)).size;

    document.getElementById('totalConfigs').textContent = totalConfigs;
    document.getElementById('totalServices').textContent = uniqueServices;
}

// Edit Configuration
async function editConfig(configId) {
    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`);

        if (response.ok) {
            const config = await response.json();

            // Populate edit form
            document.getElementById('editConfigId').value = config.id;
            document.getElementById('editServiceName').value = config.service_name;
            document.getElementById('editEnvName').value = config.env_name;

            // Populate key-value pairs
            populateConfigPairs('editConfigPairs', config.data);

            // Show modal
            editModal.style.display = 'block';

            // Focus on first input
            setTimeout(() => {
                document.getElementById('editServiceName').focus();
            }, 100);
        } else {
            const error = await response.json();
            showStatus(`Error loading configuration: ${error.detail}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Handle Edit Form Submission
async function handleEditConfig(e) {
    e.preventDefault();

    const configId = document.getElementById('editConfigId').value;
    const serviceName = document.getElementById('editServiceName').value.trim();
    const envName = document.getElementById('editEnvName').value;
    const configData = getConfigDataFromPairs('editConfigPairs');

    if (!serviceName || !envName) {
        showStatus('Please fill in service name and environment', 'error');
        return;
    }

    if (Object.keys(configData).length === 0) {
        showStatus('Please add at least one configuration variable', 'error');
        return;
    }

    try {
        const payload = {
            service_name: serviceName,
            env_name: envName,
            data: configData
        };

        const response = await fetch(`${API_BASE}/configs/${configId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showStatus('Configuration updated successfully!', 'success');
            closeEditModal();
            loadAllConfigs(); // Refresh the list
        } else {
            const error = await response.json();
            showStatus(`Error: ${error.detail || 'Failed to update configuration'}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Delete Configuration
async function deleteConfig(configId) {
    // Find the config to show in confirmation
    const config = allConfigs.find(c => c.id === configId);
    const serviceName = config ? config.service_name : 'this configuration';

    if (!confirm(`Are you sure you want to delete the configuration for "${serviceName}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showStatus('Configuration deleted successfully!', 'success');
            loadAllConfigs(); // Refresh the list
        } else {
            const error = await response.json();
            showStatus(`Error: ${error.detail || 'Failed to delete configuration'}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Modal Functions
function closeEditModal() {
    editModal.style.display = 'none';
    editForm.reset();
}

// UI Helper Functions
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;

    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 5000);
}

function showLoading() {
    configsList.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <span>Loading configurations...</span>
        </div>
    `;
}

function showEmptyState() {
    configsList.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚙️</div>
            <h3>No configurations found</h3>
            <p>No configurations match your current search criteria. Try adjusting your filters or create a new configuration.</p>
        </div>
    `;
    updateStats();
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

// Config Key-Value Pair Management
function addConfigPair(key = '', value = '') {
    const container = document.getElementById('configPairs');
    const pairDiv = document.createElement('div');
    pairDiv.className = 'config-pair';

    pairDiv.innerHTML = `
        <input type="text" placeholder="Key (e.g., DATABASE_URL)" value="${escapeHtml(key)}" class="config-key">
        <input type="text" placeholder="Value (e.g., postgresql://...)" value="${escapeHtml(value)}" class="config-value">
        <button type="button" class="remove-pair" onclick="removeConfigPair(this)" title="Remove this variable">×</button>
    `;

    container.appendChild(pairDiv);
    updateConfigPairsPlaceholder('configPairs');

    // Focus on the key input if it's empty
    if (!key) {
        pairDiv.querySelector('.config-key').focus();
    }
}

function addEditConfigPair(key = '', value = '') {
    const container = document.getElementById('editConfigPairs');
    const pairDiv = document.createElement('div');
    pairDiv.className = 'config-pair';

    pairDiv.innerHTML = `
        <input type="text" placeholder="Key (e.g., DATABASE_URL)" value="${escapeHtml(key)}" class="config-key">
        <input type="text" placeholder="Value (e.g., postgresql://...)" value="${escapeHtml(value)}" class="config-value">
        <button type="button" class="remove-pair" onclick="removeConfigPair(this)" title="Remove this variable">×</button>
    `;

    container.appendChild(pairDiv);
    updateConfigPairsPlaceholder('editConfigPairs');

    // Focus on the key input if it's empty
    if (!key) {
        pairDiv.querySelector('.config-key').focus();
    }
}

function removeConfigPair(button) {
    const pairDiv = button.parentElement;
    const container = pairDiv.parentElement;
    pairDiv.remove();
    updateConfigPairsPlaceholder(container.id);
}

function updateConfigPairsPlaceholder(containerId) {
    const container = document.getElementById(containerId);
    const pairs = container.querySelectorAll('.config-pair');

    // Remove existing placeholder
    const existingPlaceholder = container.querySelector('.config-pairs-empty');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }

    // Add placeholder if no pairs exist
    if (pairs.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'config-pairs-empty';
        placeholder.textContent = 'No configuration variables added yet. Click "+ Add Variable" to get started.';
        container.appendChild(placeholder);
    }
}

function getConfigDataFromPairs(containerId) {
    const container = document.getElementById(containerId);
    const pairs = container.querySelectorAll('.config-pair');
    const configData = {};

    pairs.forEach(pair => {
        const key = pair.querySelector('.config-key').value.trim();
        const value = pair.querySelector('.config-value').value.trim();

        if (key && value) {
            configData[key] = value;
        }
    });

    return configData;
}

function populateConfigPairs(containerId, data) {
    const container = document.getElementById(containerId);

    // Clear existing pairs
    container.innerHTML = '';

    // Add pairs for each key-value in data
    Object.entries(data).forEach(([key, value]) => {
        if (containerId === 'configPairs') {
            addConfigPair(key, value);
        } else {
            addEditConfigPair(key, value);
        }
    });

    // If no data, show placeholder
    if (Object.keys(data).length === 0) {
        updateConfigPairsPlaceholder(containerId);
    }
}

// Initialize config pairs on page load
document.addEventListener('DOMContentLoaded', function () {
    // Add initial empty pair for create form
    setTimeout(() => {
        addConfigPair();
    }, 100);
});