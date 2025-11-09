// API Base URL - automatically detect if running locally or on production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : window.location.origin;

// Debug: Log when script loads
console.log('Config Manager script loaded successfully');

// Global state
let allConfigs = [];
let filteredConfigs = [];
let availableEnvironments = [];
let availableServices = [];
let currentUser = null;
let authToken = null;

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
    checkAuthStatus();

    // Add initial empty pair for create form
    setTimeout(() => {
        addConfigPair();
    }, 100);
});

// Event Listeners
function setupEventListeners() {
    // Wait for DOM elements to be available
    const createFormEl = document.getElementById('createForm');
    const editFormEl = document.getElementById('editForm');
    const loginFormEl = document.getElementById('loginForm');
    const registerFormEl = document.getElementById('registerForm');
    const searchServiceEl = document.getElementById('searchService');
    const searchEnvEl = document.getElementById('searchEnv');

    if (createFormEl) {
        createFormEl.addEventListener('submit', handleCreateConfig);
    }

    if (editFormEl) {
        editFormEl.addEventListener('submit', handleEditConfig);
    }

    if (loginFormEl) {
        loginFormEl.addEventListener('submit', handleLogin);
    }

    if (registerFormEl) {
        registerFormEl.addEventListener('submit', handleRegister);
    }

    // Real-time search
    if (searchServiceEl) {
        searchServiceEl.addEventListener('input', debounce(performSearch, 300));
    }

    if (searchEnvEl) {
        searchEnvEl.addEventListener('change', performSearch);
    }

    // Close modals when clicking outside
    window.addEventListener('click', function (event) {
        const editModal = document.getElementById('editModal');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');

        if (event.target === editModal) {
            closeEditModal();
        }
        if (event.target === loginModal) {
            closeLoginModal();
        }
        if (event.target === registerModal) {
            closeRegisterModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            const editModal = document.getElementById('editModal');
            const loginModal = document.getElementById('loginModal');
            const registerModal = document.getElementById('registerModal');

            if (editModal && editModal.style.display === 'block') {
                closeEditModal();
            }
            if (loginModal && loginModal.style.display === 'block') {
                closeLoginModal();
            }
            if (registerModal && registerModal.style.display === 'block') {
                closeRegisterModal();
            }
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

    if (!requireAuth()) return;

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
            headers: getAuthHeaders(),
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

// Handle refresh button click
function handleRefreshClick() {
    if (!isAuthenticated()) {
        showStatus('Please login to view configurations', 'error');
        showLoginModal();
        return;
    }
    loadAllConfigs();
}

// Load All Configurations
async function loadAllConfigs() {
    if (!isAuthenticated()) {
        showEmptyState();
        return;
    }

    try {
        showLoading();

        // Load configurations and metadata in parallel
        const [configsResponse, environmentsResponse] = await Promise.all([
            fetch(`${API_BASE}/configs`, {
                headers: getAuthHeaders()
            }),
            fetch(`${API_BASE}/configs/meta/environments`, {
                headers: getAuthHeaders()
            })
        ]);

        if (configsResponse.ok && environmentsResponse.ok) {
            allConfigs = await configsResponse.json();
            availableEnvironments = await environmentsResponse.json();

            filteredConfigs = [...allConfigs];
            displayConfigs(filteredConfigs);
            updateStats();
            updateQuickFilters();
            updateEnvironmentDropdowns();
        } else {
            const error = await configsResponse.json();
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
    if (!requireAuth()) return;

    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`, {
            headers: getAuthHeaders()
        });

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
            headers: getAuthHeaders(),
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
    if (!requireAuth()) return;

    // Find the config to show in confirmation
    const config = allConfigs.find(c => c.id === configId);
    const serviceName = config ? config.service_name : 'this configuration';

    if (!confirm(`Are you sure you want to delete the configuration for "${serviceName}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
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

// Removed - consolidated into main DOMContentLoaded listener
// Update quick filter buttons based on actual data
function updateQuickFilters() {
    if (availableEnvironments.length === 0) return;

    console.log('Updating filters for environments:', availableEnvironments);

    // Update quick filter buttons
    const quickFiltersContainer = document.querySelector('.card .button-group[style*="flex-direction: column"]');

    if (quickFiltersContainer) {
        // Clear existing buttons
        quickFiltersContainer.innerHTML = '';

        // Add environment filter buttons
        availableEnvironments.forEach(env => {
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
}

// Update all environment dropdowns with actual data
function updateEnvironmentDropdowns() {
    const dropdowns = [
        'envName',        // Create form
        'searchEnv',      // Search dropdown
        'editEnvName'     // Edit modal
    ];

    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const currentValue = dropdown.value;

        // Clear existing options
        dropdown.innerHTML = '';

        // Add default option
        if (dropdownId === 'searchEnv') {
            dropdown.innerHTML = '<option value="">All Environments</option>';
        } else {
            dropdown.innerHTML = '<option value="">Select Environment...</option>';
        }

        // Add options for each available environment
        availableEnvironments.forEach(env => {
            const option = document.createElement('option');
            option.value = env;
            option.textContent = env;
            dropdown.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && availableEnvironments.includes(currentValue)) {
            dropdown.value = currentValue;
        }
    });
}
// UI Helper Functions
function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type} show`;

        setTimeout(() => {
            statusMessage.classList.remove('show');
        }, 5000);
    }
}

function showLoading() {
    const configsList = document.getElementById('configsList');
    if (configsList) {
        configsList.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <span>Loading configurations...</span>
            </div>
        `;
    }
}

function showEmptyState() {
    const configsList = document.getElementById('configsList');
    if (configsList) {
        configsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚙️</div>
                <h3>No configurations found</h3>
                <p>No configurations match your current search criteria. Try adjusting your filters or create a new configuration.</p>
            </div>
        `;
    }
    updateStats();
}

function showUnauthenticatedState() {
    const configsList = document.getElementById('configsList');
    if (configsList) {
        configsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔐</div>
                <h3>Welcome to Config Manager</h3>
                <p>Please <strong>login</strong> or <strong>register</strong> to start managing your configurations securely.</p>
                <div style="margin-top: 20px;">
                    <button onclick="showLoginModal()" class="btn btn-primary" style="margin-right: 8px;">Login</button>
                    <button onclick="showRegisterModal()" class="btn btn-secondary">Register</button>
                </div>
            </div>
        `;
    }
}

// Display Configurations
function displayConfigs(configs) {
    const configsList = document.getElementById('configsList');
    if (!configsList) return;

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
    const totalConfigsEl = document.getElementById('totalConfigs');
    const totalServicesEl = document.getElementById('totalServices');

    if (totalConfigsEl) {
        totalConfigsEl.textContent = filteredConfigs.length;
    }

    if (totalServicesEl) {
        const uniqueServices = new Set(filteredConfigs.map(c => c.service_name)).size;
        totalServicesEl.textContent = uniqueServices;
    }
}

// Filter by environment
function filterByEnv(env) {
    console.log('Filtering by environment:', env);

    const searchEnvSelect = document.getElementById('searchEnv');
    const searchServiceInput = document.getElementById('searchService');

    if (searchEnvSelect) {
        searchEnvSelect.value = env;
    }
    if (searchServiceInput) {
        searchServiceInput.value = '';
    }

    performSearch();
}

// Clear all filters
function clearFilters() {
    const searchEnvSelect = document.getElementById('searchEnv');
    const searchServiceInput = document.getElementById('searchService');

    if (searchEnvSelect) {
        searchEnvSelect.value = '';
    }
    if (searchServiceInput) {
        searchServiceInput.value = '';
    }

    filteredConfigs = [...allConfigs];
    displayConfigs(filteredConfigs);
    updateStats();
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

    filteredConfigs = allConfigs.filter(config => {
        const matchesSearch = !searchTerm || config.service_name.toLowerCase().includes(searchTerm);
        const matchesEnv = !envFilter || config.env_name === envFilter;
        return matchesSearch && matchesEnv;
    });

    displayConfigs(filteredConfigs);
    updateStats();
}

// Utility function
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

// Placeholder functions for edit and delete (you can implement these later)
function editConfig(configId) {
    console.log('Edit config:', configId);
    showStatus('Edit functionality coming soon!', 'info');
}

function deleteConfig(configId) {
    if (confirm('Are you sure you want to delete this configuration?')) {
        console.log('Delete config:', configId);
        showStatus('Delete functionality coming soon!', 'info');
    }
}

// Form handling functions
function handleCreateConfig(e) {
    e.preventDefault();

    const serviceName = document.getElementById('serviceName').value.trim();
    const envName = getSelectedEnvironment(false);
    const configData = getConfigDataFromPairs('configPairs');

    if (!serviceName) {
        showStatus('Please enter a service name', 'error');
        return;
    }

    if (!envName) {
        showStatus('Please select or enter an environment name', 'error');
        return;
    }

    if (!isValidEnvironmentName(envName)) {
        showStatus('Environment name can only contain letters, numbers, hyphens, underscores, and dots', 'error');
        return;
    }

    if (Object.keys(configData).length === 0) {
        showStatus('Please add at least one configuration variable', 'error');
        return;
    }

    createConfig(serviceName, envName, configData);
}

function handleEditConfig(e) {
    e.preventDefault();
    showStatus('Edit functionality coming soon!', 'info');
}

async function createConfig(serviceName, envName, configData) {
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
            const createForm = document.getElementById('createForm');
            if (createForm) {
                createForm.reset();
            }

            const configPairs = document.getElementById('configPairs');
            if (configPairs) {
                configPairs.innerHTML = '';
                addConfigPair(); // Add one empty pair
            }

            loadAllConfigs(); // Refresh the list
        } else {
            const error = await response.json();
            showStatus(`Error: ${error.detail || 'Failed to create configuration'}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Key-value pair management functions
function getConfigDataFromPairs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return {};

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

function addConfigPair(key = '', value = '') {
    const container = document.getElementById('configPairs');
    if (!container) return;

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

function removeConfigPair(button) {
    const pairDiv = button.parentElement;
    const container = pairDiv.parentElement;
    pairDiv.remove();
    updateConfigPairsPlaceholder(container.id);
}

function updateConfigPairsPlaceholder(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

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

function closeEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.style.display = 'none';
    }
}

// Removed - consolidated into main DOMContentLoaded listener// Environment selection handling
function handleEnvSelection(selectElement) {
    const customInput = document.getElementById('customEnvName');

    if (selectElement.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
        customInput.required = true;
        selectElement.required = false;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        selectElement.required = true;
        customInput.value = '';
    }
}

function handleCustomEnvBlur() {
    const customInput = document.getElementById('customEnvName');
    const selectElement = document.getElementById('envName');

    if (customInput.value.trim()) {
        // Validate environment name
        const envName = customInput.value.trim();
        if (isValidEnvironmentName(envName)) {
            // Add the new environment to the select options
            addEnvironmentOption('envName', envName);
            selectElement.value = envName;
            customInput.style.display = 'none';
            customInput.required = false;
            selectElement.required = true;
        } else {
            showStatus('Environment name can only contain letters, numbers, hyphens, and underscores', 'error');
            customInput.focus();
        }
    } else {
        // If empty, revert to select
        selectElement.value = '';
        customInput.style.display = 'none';
        customInput.required = false;
        selectElement.required = true;
    }
}

function handleEditEnvSelection(selectElement) {
    const customInput = document.getElementById('editCustomEnvName');

    if (selectElement.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
        customInput.required = true;
        selectElement.required = false;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        selectElement.required = true;
        customInput.value = '';
    }
}

function handleEditCustomEnvBlur() {
    const customInput = document.getElementById('editCustomEnvName');
    const selectElement = document.getElementById('editEnvName');

    if (customInput.value.trim()) {
        const envName = customInput.value.trim();
        if (isValidEnvironmentName(envName)) {
            addEnvironmentOption('editEnvName', envName);
            selectElement.value = envName;
            customInput.style.display = 'none';
            customInput.required = false;
            selectElement.required = true;
        } else {
            showStatus('Environment name can only contain letters, numbers, hyphens, and underscores', 'error');
            customInput.focus();
        }
    } else {
        selectElement.value = '';
        customInput.style.display = 'none';
        customInput.required = false;
        selectElement.required = true;
    }
}

function selectEnvSuggestion(envName) {
    const selectElement = document.getElementById('envName');
    const customInput = document.getElementById('customEnvName');

    // Add to options if not exists
    addEnvironmentOption('envName', envName);

    // Select the environment
    selectElement.value = envName;
    customInput.style.display = 'none';
    customInput.required = false;
    selectElement.required = true;
}

function selectEditEnvSuggestion(envName) {
    const selectElement = document.getElementById('editEnvName');
    const customInput = document.getElementById('editCustomEnvName');

    // Add to options if not exists
    addEnvironmentOption('editEnvName', envName);

    // Select the environment
    selectElement.value = envName;
    customInput.style.display = 'none';
    customInput.required = false;
    selectElement.required = true;
}

function addEnvironmentOption(selectId, envName) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    // Check if option already exists
    const existingOption = Array.from(selectElement.options).find(option => option.value === envName);
    if (existingOption) return;

    // Add new option before the "Create New" option
    const newOption = document.createElement('option');
    newOption.value = envName;
    newOption.textContent = envName;

    // Insert before the last option (which is "Create New")
    const createNewOption = selectElement.querySelector('option[value="__custom__"]');
    selectElement.insertBefore(newOption, createNewOption);

    // Also add to available environments for consistency
    if (!availableEnvironments.includes(envName)) {
        availableEnvironments.push(envName);
        availableEnvironments.sort();
    }
}

function isValidEnvironmentName(name) {
    // Allow letters, numbers, hyphens, underscores, and dots
    return /^[a-zA-Z0-9-_.]+$/.test(name) && name.length <= 50;
}

function getSelectedEnvironment(isEdit = false) {
    const selectId = isEdit ? 'editEnvName' : 'envName';
    const customInputId = isEdit ? 'editCustomEnvName' : 'customEnvName';

    const selectElement = document.getElementById(selectId);
    const customInput = document.getElementById(customInputId);

    if (selectElement.value === '__custom__' && customInput.value.trim()) {
        return customInput.value.trim();
    } else if (selectElement.value && selectElement.value !== '__custom__') {
        return selectElement.value;
    }

    return '';
}// Update all environment dropdowns with actual data
function updateEnvironmentDropdowns() {
    const dropdowns = [
        { id: 'envName', hasCustom: true },        // Create form
        { id: 'searchEnv', hasCustom: false },     // Search dropdown
        { id: 'editEnvName', hasCustom: true }     // Edit modal
    ];

    dropdowns.forEach(({ id, hasCustom }) => {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;

        const currentValue = dropdown.value;

        // Clear existing options except custom option
        dropdown.innerHTML = '';

        // Add default option
        if (id === 'searchEnv') {
            dropdown.innerHTML = '<option value="">All Environments</option>';
        } else {
            dropdown.innerHTML = '<option value="">Select or create environment...</option>';
        }

        // Add custom option for create/edit forms
        if (hasCustom) {
            const customOption = document.createElement('option');
            customOption.value = '__custom__';
            customOption.textContent = '+ Create New Environment';
            dropdown.appendChild(customOption);
        }

        // Add options for each available environment
        availableEnvironments.forEach(env => {
            const option = document.createElement('option');
            option.value = env;
            option.textContent = env;
            dropdown.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && (availableEnvironments.includes(currentValue) || currentValue === '__custom__')) {
            dropdown.value = currentValue;
        }
    });
}

// ==================== AUTHENTICATION FUNCTIONS ====================

// Check authentication status on page load
async function checkAuthStatus() {
    authToken = localStorage.getItem('authToken');

    if (authToken) {
        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                currentUser = await response.json();
                updateUIForLoggedInUser();
                loadAllConfigs(); // Load configs after authentication
            } else {
                // Token is invalid, clear it
                logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            logout();
        }
    } else {
        updateUIForLoggedOutUser();
    }
}

// Update UI for logged in user
function updateUIForLoggedInUser() {
    const userInfo = document.getElementById('userInfo');
    const authButtons = document.getElementById('authButtons');
    const userName = document.getElementById('userName');

    if (currentUser && userInfo && authButtons && userName) {
        userName.textContent = currentUser.name;
        userInfo.style.display = 'flex';
        authButtons.style.display = 'none';
    }
}

// Update UI for logged out user
function updateUIForLoggedOutUser() {
    const userInfo = document.getElementById('userInfo');
    const authButtons = document.getElementById('authButtons');

    if (userInfo && authButtons) {
        userInfo.style.display = 'none';
        authButtons.style.display = 'flex';
    }

    // Clear configs display
    showUnauthenticatedState();
    document.getElementById('totalConfigs').textContent = '-';
    document.getElementById('totalServices').textContent = '-';
}

// Show login modal
function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'block';
        setTimeout(() => {
            document.getElementById('loginEmail').focus();
        }, 100);
    }
}

// Close login modal
function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    if (loginModal && loginForm) {
        loginModal.style.display = 'none';
        loginForm.reset();
    }
}

// Show register modal
function showRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'block';
        setTimeout(() => {
            document.getElementById('registerName').focus();
        }, 100);
    }
}

// Close register modal
function closeRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    const registerForm = document.getElementById('registerForm');
    if (registerModal && registerForm) {
        registerModal.style.display = 'none';
        registerForm.reset();
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);

            showStatus('Login successful!', 'success');
            closeLoginModal();

            // Get user info and update UI
            await checkAuthStatus();
        } else {
            const error = await response.json();
            showStatus(`Login failed: ${error.detail}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Handle register form submission
async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!name || !email || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 8) {
        showStatus('Password must be at least 8 characters long', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        if (response.ok) {
            showStatus('Account created successfully! Please login.', 'success');
            closeRegisterModal();
            showLoginModal();

            // Pre-fill login form with registered email
            document.getElementById('loginEmail').value = email;
        } else {
            const error = await response.json();
            showStatus(`Registration failed: ${error.detail}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// Logout function
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateUIForLoggedOutUser();
    showStatus('Logged out successfully', 'success');
}

// Get auth headers for API requests
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
}

// Check if user is authenticated
function isAuthenticated() {
    return authToken && currentUser;
}

// Require authentication for actions
function requireAuth(action) {
    if (!isAuthenticated()) {
        showStatus('Please login to perform this action', 'error');
        showLoginModal();
        return false;
    }
    return true;
}

// Toggle password visibility
function togglePasswordVisibility(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.nextElementSibling;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = '🙈';
        toggleButton.title = 'Hide Password';
    } else {
        passwordInput.type = 'password';
        toggleButton.textContent = '👁️';
        toggleButton.title = 'Show Password';
    }
}

// ============================================
// OAuth Functions
// ============================================

/**
 * Initiate Google OAuth login
 *
 * Flow:
 * 1. Call backend to get Google's authorization URL
 * 2. Redirect user to Google's login page
 * 3. User logs in and approves
 * 4. Google redirects back to /auth/google/callback
 * 5. Backend handles callback and returns JWT
 */
async function loginWithGoogle() {
    try {
        // Step 1: Get Google's authorization URL from backend
        const response = await fetch(`${API_BASE}/auth/google/login`);

        if (!response.ok) {
            throw new Error('Failed to initiate Google login');
        }

        const data = await response.json();

        // Step 2: Redirect user to Google's login page
        // Google will redirect back to /auth/google/callback after login
        window.location.href = data.auth_url;

    } catch (error) {
        console.error('Google login error:', error);
        showStatus('Failed to start Google login. Please try again.', 'error');
    }
}

/**
 * Handle OAuth callback
 *
 * Backend redirects back with token in URL:
 * http://localhost:8000/?token=eyJhbG...&user={...}
 *
 * We need to:
 * 1. Extract token and user from URL
 * 2. Store in localStorage
 * 3. Clean up URL
 * 4. Update UI
 */
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    const error = urlParams.get('error');

    // Check for error first
    if (error) {
        showStatus('OAuth login failed. Please try again.', 'error');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    // Check if we have token (OAuth callback)
    if (!token) {
        // Not a callback, normal page load
        return;
    }

    console.log('OAuth callback detected, processing token...');

    try {
        // Parse user data
        let user;
        try {
            // User data comes as URL-encoded JSON string
            user = JSON.parse(decodeURIComponent(userParam));
        } catch (e) {
            console.error('Error parsing user data:', e);
            throw new Error('Invalid user data');
        }

        // Store the JWT token and user info
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Clean up URL (remove ?token=... from address bar)
        window.history.replaceState({}, document.title, window.location.pathname);

        // Show success and update UI
        showStatus(`Welcome, ${user.name}!`, 'success');
        updateUIForLoggedInUser(user);

    } catch (error) {
        console.error('OAuth callback error:', error);
        showStatus('Failed to complete Google login. Please try again.', 'error');

        // Clean up URL even on error
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Update UI when user is logged in
 */
function updateUIForLoggedInUser(user) {
    // IMPORTANT: Set the global auth variables
    // These are used by isAuthenticated() and getAuthHeaders()
    authToken = localStorage.getItem('token');
    currentUser = user;

    // Hide login/register buttons
    const authButtons = document.getElementById('authButtons');
    if (authButtons) {
        authButtons.style.display = 'none';
    }

    // Show user info
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    if (userInfo && userName) {
        userName.textContent = user.name || user.email;
        userInfo.style.display = 'flex';
    }

    // Close any open modals
    closeLoginModal();
    closeRegisterModal();

    // Load configs now that user is authenticated
    loadAllConfigs();
}

/**
 * Check if user is already logged in on page load
 */
function checkExistingAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            updateUIForLoggedInUser(user);
        } catch (error) {
            console.error('Error parsing stored user:', error);
            // Clear invalid data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
}

/**
 * Logout function
 */
function logout() {
    // Clear stored data
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // IMPORTANT: Clear the global auth variables
    authToken = null;
    currentUser = null;

    // Show login/register buttons
    const authButtons = document.getElementById('authButtons');
    if (authButtons) {
        authButtons.style.display = 'flex';
    }

    // Hide user info
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.style.display = 'none';
    }

    // Clear configs display
    showEmptyState();

    showStatus('Logged out successfully', 'success');
}

// Initialize OAuth handling on page load
document.addEventListener('DOMContentLoaded', function () {
    // Check if user is already logged in
    checkExistingAuth();

    // Handle OAuth callback if present
    handleOAuthCallback();
});
