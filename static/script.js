// API Base URL - automatically detect if running locally or on production
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : window.location.origin;

// Global state
let allConfigs = [];
let filteredConfigs = [];
let availableEnvironments = [];
let currentUser = null;
let authToken = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function () {
    setupEventListeners();
    checkExistingAuth();
    handleOAuthCallback();

    // Add initial empty pair for create form
    setTimeout(() => addConfigPair(), 100);
});

function setupEventListeners() {
    const createFormEl = document.getElementById('createForm');
    const editFormEl = document.getElementById('editForm');
    const loginFormEl = document.getElementById('loginForm');
    const registerFormEl = document.getElementById('registerForm');
    const searchServiceEl = document.getElementById('searchService');
    const searchEnvEl = document.getElementById('searchEnv');

    if (createFormEl) createFormEl.addEventListener('submit', handleCreateConfig);
    if (editFormEl) editFormEl.addEventListener('submit', handleEditConfig);
    if (loginFormEl) loginFormEl.addEventListener('submit', handleLogin);
    if (registerFormEl) registerFormEl.addEventListener('submit', handleRegister);
    if (searchServiceEl) searchServiceEl.addEventListener('input', debounce(performSearch, 300));
    if (searchEnvEl) searchEnvEl.addEventListener('change', performSearch);

    // Close modals when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target.id === 'editModal') closeEditModal();
        if (event.target.id === 'loginModal') closeLoginModal();
        if (event.target.id === 'registerModal') closeRegisterModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeEditModal();
            closeLoginModal();
            closeRegisterModal();
        }
    });
}

// ==================== CONFIG CRUD OPERATIONS ====================

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
        const response = await fetch(`${API_BASE}/configs`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ service_name: serviceName, env_name: envName, data: configData })
        });

        if (response.ok) {
            showStatus('Configuration created successfully!', 'success');
            document.getElementById('createForm').reset();
            document.getElementById('configPairs').innerHTML = '';
            addConfigPair();
            loadAllConfigs();
        } else {
            const error = await response.json();
            showStatus(`Error: ${error.detail || 'Failed to create configuration'}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

async function loadAllConfigs() {
    if (!isAuthenticated()) {
        showUnauthenticatedState();
        return;
    }

    try {
        showLoading();

        const [configsResponse, environmentsResponse] = await Promise.all([
            fetch(`${API_BASE}/configs`, { headers: getAuthHeaders() }),
            fetch(`${API_BASE}/configs/meta/environments`, { headers: getAuthHeaders() })
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
            showStatus('Error loading configurations', 'error');
            showEmptyState();
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
        showEmptyState();
    }
}

async function editConfig(configId) {
    if (!requireAuth()) return;

    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`, { headers: getAuthHeaders() });

        if (response.ok) {
            const config = await response.json();
            document.getElementById('editConfigId').value = config.id;
            document.getElementById('editServiceName').value = config.service_name;
            document.getElementById('editEnvName').value = config.env_name;
            populateConfigPairs('editConfigPairs', config.data);
            document.getElementById('editModal').style.display = 'block';
        } else {
            showStatus('Error loading configuration', 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

async function handleEditConfig(e) {
    e.preventDefault();

    const configId = document.getElementById('editConfigId').value;
    const serviceName = document.getElementById('editServiceName').value.trim();
    const envName = document.getElementById('editEnvName').value;
    const configData = getConfigDataFromPairs('editConfigPairs');

    if (!serviceName || !envName || Object.keys(configData).length === 0) {
        showStatus('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ service_name: serviceName, env_name: envName, data: configData })
        });

        if (response.ok) {
            showStatus('Configuration updated successfully!', 'success');
            closeEditModal();
            loadAllConfigs();
        } else {
            showStatus('Failed to update configuration', 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

async function deleteConfig(configId) {
    if (!requireAuth()) return;

    const config = allConfigs.find(c => c.id === configId);
    const serviceName = config ? config.service_name : 'this configuration';

    if (!confirm(`Are you sure you want to delete "${serviceName}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/configs/${configId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            showStatus('Configuration deleted successfully!', 'success');
            loadAllConfigs();
        } else {
            showStatus('Failed to delete configuration', 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

// ==================== SEARCH & FILTER ====================

function performSearch() {
    const searchServiceInput = document.getElementById('searchService');
    const searchEnvSelect = document.getElementById('searchEnv');

    if (!searchServiceInput || !searchEnvSelect) return;

    const searchTerm = searchServiceInput.value.toLowerCase().trim();
    const envFilter = searchEnvSelect.value;

    filteredConfigs = allConfigs.filter(config => {
        const matchesSearch = !searchTerm || config.service_name.toLowerCase().includes(searchTerm);
        const matchesEnv = !envFilter || config.env_name === envFilter;
        return matchesSearch && matchesEnv;
    });

    displayConfigs(filteredConfigs);
    updateStats();
}

function filterByEnv(env) {
    const searchEnvSelect = document.getElementById('searchEnv');
    const searchServiceInput = document.getElementById('searchService');

    if (searchEnvSelect) searchEnvSelect.value = env;
    if (searchServiceInput) searchServiceInput.value = '';

    performSearch();
}

function clearFilters() {
    document.getElementById('searchEnv').value = '';
    document.getElementById('searchService').value = '';
    filteredConfigs = [...allConfigs];
    displayConfigs(filteredConfigs);
    updateStats();
}

function updateQuickFilters() {
    if (allConfigs.length === 0) return;

    const uniqueEnvs = [...new Set(allConfigs.map(c => c.env_name))].sort();
    const quickFiltersContainer = document.querySelector('.card .button-group[style*="flex-direction: column"]');

    if (quickFiltersContainer) {
        quickFiltersContainer.innerHTML = '';

        uniqueEnvs.forEach(env => {
            const button = document.createElement('button');
            button.className = 'btn btn-secondary';
            button.onclick = () => filterByEnv(env);
            button.textContent = `${env.charAt(0).toUpperCase() + env.slice(1)} Only`;
            quickFiltersContainer.appendChild(button);
        });

        const showAllButton = document.createElement('button');
        showAllButton.className = 'btn btn-secondary';
        showAllButton.onclick = clearFilters;
        showAllButton.textContent = 'Show All';
        quickFiltersContainer.appendChild(showAllButton);
    }
}

// ==================== UI DISPLAY FUNCTIONS ====================

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
                <button onclick="editConfig('${config.id}')" class="btn btn-secondary btn-sm">Edit</button>
                <button onclick="deleteConfig('${config.id}')" class="btn btn-danger btn-sm">Delete</button>
            </div>
        </div>
    `).join('');

    configsList.innerHTML = configsHtml;
}

function updateStats() {
    const totalConfigsEl = document.getElementById('totalConfigs');
    const totalServicesEl = document.getElementById('totalServices');

    if (totalConfigsEl) totalConfigsEl.textContent = filteredConfigs.length;
    if (totalServicesEl) {
        const uniqueServices = new Set(filteredConfigs.map(c => c.service_name)).size;
        totalServicesEl.textContent = uniqueServices;
    }
}

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type} show`;
        setTimeout(() => statusMessage.classList.remove('show'), 5000);
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

// ==================== CONFIG PAIR MANAGEMENT ====================

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
    if (!key) pairDiv.querySelector('.config-key').focus();
}

function addEditConfigPair(key = '', value = '') {
    const container = document.getElementById('editConfigPairs');
    if (!container) return;

    const pairDiv = document.createElement('div');
    pairDiv.className = 'config-pair';
    pairDiv.innerHTML = `
        <input type="text" placeholder="Key (e.g., DATABASE_URL)" value="${escapeHtml(key)}" class="config-key">
        <input type="text" placeholder="Value (e.g., postgresql://...)" value="${escapeHtml(value)}" class="config-value">
        <button type="button" class="remove-pair" onclick="removeConfigPair(this)" title="Remove this variable">×</button>
    `;

    container.appendChild(pairDiv);
    if (!key) pairDiv.querySelector('.config-key').focus();
}

function removeConfigPair(button) {
    button.parentElement.remove();
}

function getConfigDataFromPairs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return {};

    const pairs = container.querySelectorAll('.config-pair');
    const configData = {};

    pairs.forEach(pair => {
        const key = pair.querySelector('.config-key').value.trim();
        const value = pair.querySelector('.config-value').value.trim();
        if (key && value) configData[key] = value;
    });

    return configData;
}

function populateConfigPairs(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    Object.entries(data).forEach(([key, value]) => {
        if (containerId === 'configPairs') {
            addConfigPair(key, value);
        } else {
            addEditConfigPair(key, value);
        }
    });
}

function updateEnvironmentDropdowns() {
    const dropdowns = ['envName', 'searchEnv', 'editEnvName'];

    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const currentValue = dropdown.value;
        dropdown.innerHTML = '';

        if (dropdownId === 'searchEnv') {
            dropdown.innerHTML = '<option value="">All Environments</option>';
        } else {
            dropdown.innerHTML = '<option value="">Select Environment...</option>';
        }

        availableEnvironments.forEach(env => {
            const option = document.createElement('option');
            option.value = env;
            option.textContent = env;
            dropdown.appendChild(option);
        });

        if (currentValue && availableEnvironments.includes(currentValue)) {
            dropdown.value = currentValue;
        }
    });
}

// ==================== MODAL FUNCTIONS ====================

function closeEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.style.display = 'none';
}

function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'block';
        setTimeout(() => document.getElementById('loginEmail')?.focus(), 100);
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    if (loginModal) loginModal.style.display = 'none';
    if (loginForm) loginForm.reset();
}

function showRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'block';
        setTimeout(() => document.getElementById('registerName')?.focus(), 100);
    }
}

function closeRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    const registerForm = document.getElementById('registerForm');
    if (registerModal) registerModal.style.display = 'none';
    if (registerForm) registerForm.reset();
}

// ==================== AUTHENTICATION ====================

async function checkAuthStatus() {
    authToken = localStorage.getItem('authToken');

    if (authToken) {
        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (response.ok) {
                currentUser = await response.json();
                updateUIForLoggedInUser(currentUser);
                loadAllConfigs();
            } else {
                logout();
            }
        } catch (error) {
            logout();
        }
    } else {
        updateUIForLoggedOutUser();
    }
}

function updateUIForLoggedInUser(user) {
    authToken = localStorage.getItem('authToken');
    currentUser = user;

    const userInfo = document.getElementById('userInfo');
    const authButtons = document.getElementById('authButtons');
    const userName = document.getElementById('userName');

    if (authButtons) authButtons.style.display = 'none';
    if (userInfo && userName) {
        userName.textContent = user.name || user.email;
        userInfo.style.display = 'flex';
    }

    closeLoginModal();
    closeRegisterModal();
    loadAllConfigs();
}

function updateUIForLoggedOutUser() {
    const userInfo = document.getElementById('userInfo');
    const authButtons = document.getElementById('authButtons');

    if (userInfo) userInfo.style.display = 'none';
    if (authButtons) authButtons.style.display = 'flex';

    showUnauthenticatedState();
    document.getElementById('totalConfigs').textContent = '-';
    document.getElementById('totalServices').textContent = '-';
}

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);
            showStatus('Login successful!', 'success');
            closeLoginModal();
            await checkAuthStatus();
        } else {
            const error = await response.json();
            showStatus(`Login failed: ${error.detail}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (response.ok) {
            showStatus('Account created successfully! Please login.', 'success');
            closeRegisterModal();
            showLoginModal();
            document.getElementById('loginEmail').value = email;
        } else {
            const error = await response.json();
            showStatus(`Registration failed: ${error.detail}`, 'error');
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    updateUIForLoggedOutUser();
    showStatus('Logged out successfully', 'success');
}

// ==================== OAUTH ====================

async function loginWithGoogle() {
    try {
        const response = await fetch(`${API_BASE}/auth/google/login`);
        if (!response.ok) throw new Error('Failed to initiate Google login');

        const data = await response.json();
        window.location.href = data.auth_url;
    } catch (error) {
        showStatus('Failed to start Google login. Please try again.', 'error');
    }
}

function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    const error = urlParams.get('error');

    if (error) {
        showStatus('OAuth login failed. Please try again.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    if (!token) return;

    try {
        const user = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        window.history.replaceState({}, document.title, window.location.pathname);
        showStatus(`Welcome, ${user.name}!`, 'success');
        updateUIForLoggedInUser(user);
    } catch (error) {
        showStatus('Failed to complete Google login. Please try again.', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function checkExistingAuth() {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            updateUIForLoggedInUser(user);
        } catch (error) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
        }
    }
}

// ==================== UTILITY FUNCTIONS ====================

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return headers;
}

function isAuthenticated() {
    return authToken && currentUser;
}

function requireAuth() {
    if (!isAuthenticated()) {
        showStatus('Please login to perform this action', 'error');
        showLoginModal();
        return false;
    }
    return true;
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
