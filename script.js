// Braze WebSDK Demo Script
let brazeInstance = null;
let isInitialized = false;
let debugStartTime = Date.now();
const APP_STATE_STORAGE_KEY = 'braze-demo-app-state-v1';
let saveStateTimeout = null;
let lastPersistedStateSignature = '';
const BANNER_PLACEMENT_ID = 'bannerdemo';
let bannerSubscriptionId = null;

function updateBannerStatus(message, variant = '') {
    const statusElement = document.getElementById('bannerPlacementStatus');
    const section = document.getElementById('bannerPlacementSection');
    if (!statusElement || !section) {
        return;
    }

    statusElement.textContent = message;
    ['loading', 'error', 'success'].forEach(cls => section.classList.remove(cls));
    const allowedVariants = ['loading', 'error', 'success'];
    if (variant && allowedVariants.includes(variant)) {
        section.classList.add(variant);
    }
}

function resetBannerContainer(message = 'Initialize the SDK with <strong>Allow User Supplied JavaScript</strong> enabled to load banners.') {
    const section = document.getElementById('bannerPlacementSection');
    const container = document.getElementById('bannerPlacementContainer');
    const placeholder = document.getElementById('bannerPlacementPlaceholder');

    if (container) {
        container.innerHTML = '';
    }

    if (section) {
        section.classList.remove('has-banner');
    }

    if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = message;
    }
}

function renderBannerPlacement() {
    const container = document.getElementById('bannerPlacementContainer');
    const section = document.getElementById('bannerPlacementSection');
    const placeholder = document.getElementById('bannerPlacementPlaceholder');

    if (!container || !placeholder || !section) {
        return;
    }

    container.innerHTML = '';

    if (!brazeInstance || typeof brazeInstance.getBanner !== 'function' || typeof brazeInstance.insertBanner !== 'function') {
        updateBannerStatus('Current SDK does not support banner placements.', 'error');
        placeholder.textContent = 'Upgrade to Braze Web SDK 5.8.1 or later to display banners.';
        return;
    }

    const banner = brazeInstance.getBanner(BANNER_PLACEMENT_ID);

    if (!banner) {
        section.classList.remove('has-banner');
        placeholder.style.display = 'block';
        placeholder.textContent = 'No banner is currently available for this placement.';
        updateBannerStatus('No eligible banner.');
        return;
    }

    if (banner.isControl) {
        section.classList.remove('has-banner');
        placeholder.style.display = 'block';
        placeholder.textContent = 'User is in the control variant. No banner will be displayed.';
        updateBannerStatus('Control variant received.');
        return;
    }

    try {
        brazeInstance.insertBanner(banner, container);
        section.classList.add('has-banner');
        placeholder.style.display = 'none';
        updateBannerStatus('Banner loaded successfully.', 'success');
        debugLog('BANNER', `Inserted banner for placement ${BANNER_PLACEMENT_ID}`, 'success');
    } catch (error) {
        section.classList.remove('has-banner');
        placeholder.style.display = 'block';
        placeholder.textContent = `Failed to render banner: ${error.message}`;
        updateBannerStatus('Banner render error.', 'error');
        debugLog('BANNER', `Failed to insert banner: ${error.stack || error.message}`, 'error');
    }
}

function subscribeToBannerUpdates() {
    if (!brazeInstance || typeof brazeInstance.subscribeToBannersUpdates !== 'function') {
        updateBannerStatus('Banner subscriptions are not supported by this SDK version.', 'error');
        return;
    }

    if (bannerSubscriptionId && typeof brazeInstance.removeSubscription === 'function') {
        brazeInstance.removeSubscription(bannerSubscriptionId);
        bannerSubscriptionId = null;
    }

    bannerSubscriptionId = brazeInstance.subscribeToBannersUpdates(() => {
        debugLog('BANNER', 'Received banner update event.', 'info');
        renderBannerPlacement();
    });
}

function requestBannerRefresh(source = 'automatic') {
    const refreshButton = document.getElementById('refreshBannerButton');

    if (!brazeInstance || typeof brazeInstance.requestBannersRefresh !== 'function') {
        updateBannerStatus('Banner refresh is not supported by this SDK version.', 'error');
        return;
    }

    try {
        brazeInstance.requestBannersRefresh([BANNER_PLACEMENT_ID]);
        const message = source === 'manual' ? 'Refreshing banner…' : 'Loading banner…';
        updateBannerStatus(message, 'loading');
        if (source === 'manual') {
            logActivity('Info', `Manual banner refresh requested for placement: ${BANNER_PLACEMENT_ID}`, 'info');
        }
        if (refreshButton) {
            refreshButton.disabled = true;
            setTimeout(() => {
                refreshButton.disabled = false;
            }, 1500);
        }
    } catch (error) {
        updateBannerStatus('Failed to request banner refresh.', 'error');
        debugLog('BANNER', `Banner refresh failed: ${error.stack || error.message}`, 'error');
    }
}

function initializeBannerPlacement() {
    const allowUserCheckbox = document.getElementById('allowUserSuppliedJavascript');
    const allowUserJS = allowUserCheckbox ? allowUserCheckbox.checked : false;

    if (!brazeInstance) {
        return;
    }

    if (!allowUserJS) {
        resetBannerContainer('Enable <strong>Allow User Supplied JavaScript</strong> and refresh banners to display this placement.');
        updateBannerStatus('Enable "Allow User Supplied JavaScript" to display banners.', 'error');
        logActivity('Warning', 'Enable "Allow User Supplied JavaScript" in Advanced Settings to render banner placements.', 'warning');
        return;
    }

    updateBannerStatus('Loading banner…', 'loading');
    subscribeToBannerUpdates();
    renderBannerPlacement();
    requestBannerRefresh();
}

function prepareBannerPlacementUI() {
    resetBannerContainer();
    updateBannerStatus('Awaiting SDK initialization…');
}


function getLocalStorageSafe() {
    try {
        return window.localStorage;
    } catch (error) {
        debugLog('STATE', `LocalStorage unavailable: ${error.message}`, 'warning');
        return null;
    }
}

function encodeStateObject(obj) {
    try {
        const json = JSON.stringify(obj);
        return window.btoa(unescape(encodeURIComponent(json)));
    } catch (error) {
        debugLog('STATE', `Failed to encode state: ${error.message}`, 'warning');
        return null;
    }
}

function decodeStateObject(raw) {
    try {
        const json = decodeURIComponent(escape(window.atob(raw)));
        return JSON.parse(json);
    } catch (error) {
        debugLog('STATE', `Failed to decode state: ${error.message}`, 'warning');
        return null;
    }
}

function scheduleAppStateSave() {
    if (saveStateTimeout) {
        clearTimeout(saveStateTimeout);
    }
    saveStateTimeout = setTimeout(() => saveAppState(true), 200);
}

function saveAppState(force = false) {
    if (!force) {
        scheduleAppStateSave();
        return;
    }

    const storage = getLocalStorageSafe();
    if (!storage) {
        return;
    }

    const apiKeyInput = document.getElementById('apiKey');
    const sdkEndpointSelect = document.getElementById('sdkEndpoint');
    const userIdInput = document.getElementById('userId');
    const environmentSelect = document.getElementById('environmentSelect');

    if (!apiKeyInput || !sdkEndpointSelect || !userIdInput || !environmentSelect) {
        return;
    }

    const state = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        apiKey: apiKeyInput.value || '',
        sdkEndpoint: sdkEndpointSelect.value || '',
        userId: userIdInput.value || '',
        environmentName: environmentSelect.value || ''
    };

    const signature = JSON.stringify([
        state.apiKey,
        state.sdkEndpoint,
        state.userId,
        state.environmentName
    ]);

    if (signature === lastPersistedStateSignature) {
        return;
    }

    const encoded = encodeStateObject(state);
    if (!encoded) {
        return;
    }

    try {
        storage.setItem(APP_STATE_STORAGE_KEY, encoded);
        lastPersistedStateSignature = signature;
        const keyPreview = state.apiKey ? `${state.apiKey.substring(0, 4)}...` : 'none';
        debugLog('STATE', `Persisted SDK state (API key: ${keyPreview})`, 'info');
    } catch (error) {
        debugLog('STATE', `Failed to save state: ${error.message}`, 'warning');
    }
}

function loadAppState() {
    const storage = getLocalStorageSafe();
    if (!storage) {
        return false;
    }

    const encoded = storage.getItem(APP_STATE_STORAGE_KEY);
    if (!encoded) {
        return false;
    }

    const state = decodeStateObject(encoded);
    if (!state) {
        return false;
    }

    const apiKeyInput = document.getElementById('apiKey');
    const sdkEndpointSelect = document.getElementById('sdkEndpoint');
    const userIdInput = document.getElementById('userId');
    const environmentSelect = document.getElementById('environmentSelect');

    if (!apiKeyInput || !sdkEndpointSelect || !userIdInput || !environmentSelect) {
        return false;
    }

    apiKeyInput.value = state.apiKey || '';
    userIdInput.value = state.userId || '';

    if (state.sdkEndpoint) {
        sdkEndpointSelect.value = state.sdkEndpoint;
    }

    if (state.environmentName) {
        environmentSelect.value = state.environmentName;
    }

    updateSelectedEndpoint();

    lastPersistedStateSignature = JSON.stringify([
        apiKeyInput.value || '',
        sdkEndpointSelect.value || '',
        userIdInput.value || '',
        environmentSelect.value || ''
    ]);

    if (state.apiKey || state.userId) {
        logActivity('Info', 'Restored previous SDK configuration from this browser.', 'info');
    }
    debugLog('STATE', 'Loaded persisted SDK state from local storage.', 'info');

    return true;
}

function clearAppState({ resetFields = true, suppressLog = false } = {}) {
    const storage = getLocalStorageSafe();
    if (storage) {
        try {
            storage.removeItem(APP_STATE_STORAGE_KEY);
            storage.removeItem('braze-last-environment');
        } catch (error) {
            debugLog('STATE', `Failed to clear state: ${error.message}`, 'warning');
        }
    }

    lastPersistedStateSignature = '';

    if (resetFields) {
        const apiKeyInput = document.getElementById('apiKey');
        const sdkEndpointSelect = document.getElementById('sdkEndpoint');
        const userIdInput = document.getElementById('userId');
        const environmentSelect = document.getElementById('environmentSelect');

        if (apiKeyInput) apiKeyInput.value = '';
        if (userIdInput) userIdInput.value = '';
        if (environmentSelect) environmentSelect.value = '';

        if (sdkEndpointSelect) {
            sdkEndpointSelect.selectedIndex = 0;
        }

        updateSelectedEndpoint();
    }

    if (!suppressLog) {
        logActivity('Info', 'Saved settings cleared from this browser.', 'info');
        debugLog('STATE', 'Cleared persisted SDK state.', 'info');
    }
}

function getServiceWorkerLocation() {
    try {
        const swUrl = new URL('sw.js', window.location.href);
        return swUrl.pathname;
    } catch (error) {
        debugLog('SW', `Failed to resolve service worker location: ${error.message}`, 'warning');
        return 'sw.js';
    }
}

function getServiceWorkerScope() {
    try {
        const swUrl = new URL(getServiceWorkerLocation(), window.location.origin);
        const scopeUrl = new URL('./', swUrl);
        return scopeUrl.pathname;
    } catch (error) {
        debugLog('SW', `Failed to resolve service worker scope: ${error.message}`, 'warning');
        return '/';
    }
}

// Debug Console Functions (define early so they're available immediately)
function debugLog(type, message, level = 'info') {
    const debugContent = document.getElementById('debugContent');
    if (!debugContent) {
        // Queue logs if debug console not ready yet
        if (!window._debugQueue) window._debugQueue = [];
        window._debugQueue.push({ type, message, level });
        return;
    }
    
    // Process any queued logs
    if (window._debugQueue && window._debugQueue.length > 0) {
        window._debugQueue.forEach(log => {
            addDebugEntry(log.type, log.message, log.level);
        });
        window._debugQueue = [];
    }
    
    addDebugEntry(type, message, level);
}

function addDebugEntry(type, message, level) {
    const debugContent = document.getElementById('debugContent');
    if (!debugContent) return;
    
    const now = Date.now();
    const elapsed = now - debugStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const milliseconds = elapsed % 1000;
    const timeStr = `${String(seconds).padStart(2, '0')}:${String(Math.floor(milliseconds / 10)).padStart(2, '0')}.${String(milliseconds % 10).padStart(3, '0')}`;
    
    const entry = document.createElement('div');
    entry.className = `debug-entry debug-${level}`;
    entry.innerHTML = `
        <span class="debug-time">[${timeStr}]</span>
        <span class="debug-type">[${type}]</span>
        <span class="debug-message">${escapeHtml(message)}</span>
    `;
    
    debugContent.appendChild(entry);
    debugContent.scrollTop = debugContent.scrollHeight;
    
    // Keep only last 200 debug entries
    const entries = debugContent.querySelectorAll('.debug-entry');
    if (entries.length > 200) {
        entries[0].remove();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Capture console logs for debugging
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

// Override console methods to capture in debug console
console.log = function(...args) {
    originalConsole.log.apply(console, args);
    debugLog('LOG', args.join(' '), 'info');
};

console.warn = function(...args) {
    originalConsole.warn.apply(console, args);
    debugLog('WARN', args.join(' '), 'warning');
};

console.error = function(...args) {
    originalConsole.error.apply(console, args);
    debugLog('ERROR', args.join(' '), 'error');
};

console.info = function(...args) {
    originalConsole.info.apply(console, args);
    debugLog('INFO', args.join(' '), 'info');
};

// Wait for SDK to load before initializing
function waitForBrazeSDK(callback, maxAttempts = 50) {
    let attempts = 0;
    
    const checkInterval = setInterval(() => {
        attempts++;
        debugLog('SDK-LOAD', `Checking for Braze SDK... Attempt ${attempts}/${maxAttempts}`, 'info');
        
        if (typeof window.braze !== 'undefined' && window.braze) {
            clearInterval(checkInterval);
            debugLog('SDK-LOAD', '✅ Braze SDK detected!', 'success');
            callback();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            debugLog('SDK-LOAD', '❌ Braze SDK failed to load after max attempts', 'error');
            debugLog('SDK-LOAD', `window.braze = ${typeof window.braze}`, 'error');
            debugLog('SDK-LOAD', `window.appboy = ${typeof window.appboy}`, 'info');
            callback();
        }
    }, 100);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    debugLog('APP', 'DOM Content Loaded - Starting initialization', 'info');
    prepareBannerPlacementUI();
    
    // Wait for Braze SDK to be available
    waitForBrazeSDK(() => {
        setupEventListeners();
        updatePushStatus();
        checkSDKLoaded();
        updateSelectedEndpoint();
        logActivity('Ready', 'Braze WebSDK Demo initialized. Configure your API key to get started.', 'info');
    });
});

// Event Listeners Setup
function setupEventListeners() {
    // SDK Initialization
    document.getElementById('initializeBtn').addEventListener('click', initializeBrazeSDK);
    
    // Settings toggle
    document.getElementById('settingsToggle').addEventListener('click', toggleSettings);
    
    // Tab switching for user data logging
    setupTabSwitching();
    
    // Check if service worker is supported for push notifications
    if ('serviceWorker' in navigator) {
        registerServiceWorker().catch(() => {
            // Error already logged in registerServiceWorker
        });
    }

    setupStatePersistence();

    const refreshBannerButton = document.getElementById('refreshBannerButton');
    if (refreshBannerButton) {
        refreshBannerButton.addEventListener('click', () => {
            if (!isInitialized) {
                updateBannerStatus('Initialize the SDK before refreshing banners.');
                logActivity('Warning', 'Initialize the SDK before refreshing banners.', 'warning');
                return;
            }

            const allowUserCheckbox = document.getElementById('allowUserSuppliedJavascript');
            if (!allowUserCheckbox || !allowUserCheckbox.checked) {
                resetBannerContainer('Enable <strong>Allow User Supplied JavaScript</strong> to display banners.');
                updateBannerStatus('Enable "Allow User Supplied JavaScript" to display banners.', 'error');
                logActivity('Warning', 'Enable "Allow User Supplied JavaScript" before refreshing banners.', 'warning');
                return;
            }

            requestBannerRefresh('manual');
        });
    }
}

// Tab Switching Functionality
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.textContent.toLowerCase().split(' ')[1] || this.textContent.toLowerCase().split(' ')[0];
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    const activeButton = Array.from(document.querySelectorAll('.tab-btn')).find(btn => 
        btn.textContent.toLowerCase().includes(tabName)
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
}

function setupStatePersistence() {
    const apiKeyInput = document.getElementById('apiKey');
    const sdkEndpointSelect = document.getElementById('sdkEndpoint');
    const userIdInput = document.getElementById('userId');
    const environmentSelect = document.getElementById('environmentSelect');
    const clearSavedSettingsButton = document.getElementById('clearSavedSettings');

    const inputs = [
        { element: apiKeyInput, events: ['input', 'blur'] },
        { element: sdkEndpointSelect, events: ['change', 'blur'] },
        { element: userIdInput, events: ['input', 'blur'] },
        { element: environmentSelect, events: ['change', 'blur'] }
    ];

    inputs.forEach(({ element, events }) => {
        if (!element) return;
        events.forEach(eventName => {
            element.addEventListener(eventName, scheduleAppStateSave);
        });
    });

    window.addEventListener('beforeunload', () => saveAppState(true));

    if (clearSavedSettingsButton) {
        clearSavedSettingsButton.addEventListener('click', () => {
            clearAppState({ resetFields: true });
        });
    }
}

// Check if Braze SDK is loaded
function checkSDKLoaded() {
    const sdkVersionElement = document.getElementById('sdkVersion');
    
    debugLog('SDK-CHECK', 'Checking if Braze SDK is loaded...', 'info');
    debugLog('SDK-CHECK', `window.braze type: ${typeof window.braze}`, 'info');
    debugLog('SDK-CHECK', `window.braze exists: ${!!window.braze}`, 'info');
    debugLog('SDK-CHECK', `window.appboy type: ${typeof window.appboy}`, 'info');
    
    // Check for both new (braze) and legacy (appboy) SDK names
    if (typeof window.braze !== 'undefined' && window.braze) {
        // SDK is loaded (new naming)
        sdkVersionElement.textContent = '5.8.0 ✅';
        sdkVersionElement.style.color = '#198754';
        logActivity('Success', 'Braze SDK loaded successfully from CDN.', 'success');
        debugLog('SDK-CHECK', '✅ Braze SDK loaded successfully', 'success');
        
        // Check available methods
        const methods = Object.keys(window.braze).filter(key => typeof window.braze[key] === 'function');
        debugLog('SDK-CHECK', `Available methods (${methods.length}): ${methods.slice(0, 20).join(', ')}...`, 'info');
        
        if (window.braze.initialize) {
            debugLog('SDK-CHECK', '✅ braze.initialize method available', 'success');
        } else {
            debugLog('SDK-CHECK', '⚠️ braze.initialize method NOT FOUND', 'warning');
        }
        if (window.braze.openSession) {
            debugLog('SDK-CHECK', '✅ braze.openSession method available', 'success');
        }
    } else if (typeof window.appboy !== 'undefined' && window.appboy) {
        // Legacy SDK loaded (appboy)
        sdkVersionElement.textContent = 'Legacy ⚠️';
        sdkVersionElement.style.color = '#ffc107';
        logActivity('Warning', 'Legacy Braze SDK (appboy) detected. Using compatibility mode.', 'warning');
        debugLog('SDK-CHECK', '⚠️ Legacy SDK (appboy) detected', 'warning');
        
        // Map appboy to braze for compatibility
        window.braze = window.appboy;
        debugLog('SDK-CHECK', '✅ Mapped window.appboy to window.braze', 'success');
    } else {
        // SDK not loaded - try to detect why
        sdkVersionElement.textContent = 'Not Loaded ❌';
        sdkVersionElement.style.color = '#dc3545';
        logActivity('Error', 'Braze SDK failed to load. Check network connection and CDN availability.', 'error');
        debugLog('SDK-CHECK', '❌ Braze SDK not loaded from CDN', 'error');
        debugLog('SDK-CHECK', `All window properties: ${Object.keys(window).filter(k => k.toLowerCase().includes('braz') || k.toLowerCase().includes('appboy')).join(', ')}`, 'info');
        
        // Check if it might be an ad blocker
        debugLog('SDK-CHECK', '🛡️ TROUBLESHOOTING: SDK failed to load', 'warning');
        debugLog('SDK-CHECK', '💡 Common cause: Ad blocker or privacy extension', 'warning');
        debugLog('SDK-CHECK', '✅ Solution: Disable ad blocker for this site', 'warning');
        debugLog('SDK-CHECK', '📋 Extensions that may block: uBlock Origin, AdBlock Plus, Privacy Badger, Ghostery', 'warning');
        
        logActivity('Warning', '⚠️ AD BLOCKER DETECTED: The Braze SDK may be blocked by your ad blocker. Please disable it for this site and refresh.', 'warning');
        
        // Try to reload SDK after a delay
        setTimeout(retrySDKLoad, 2000);
    }
}

// Retry SDK loading
function retrySDKLoad() {
    if (typeof window.braze === 'undefined' && typeof window.appboy === 'undefined') {
        debugLog('SDK-RELOAD', 'Attempting to reload Braze SDK...', 'info');
        logActivity('Info', 'Attempting to reload Braze SDK...', 'info');
        
        // First check if CDN is reachable
        fetch('https://js.appboycdn.com/web-sdk/5.8/braze.min.js', { method: 'HEAD' })
            .then(response => {
                debugLog('SDK-RELOAD', `CDN response status: ${response.status}`, response.ok ? 'success' : 'error');
                if (response.ok) {
                    loadSDKScript();
                } else {
                    debugLog('SDK-RELOAD', '❌ CDN returned error status', 'error');
                }
            })
            .catch(error => {
                debugLog('SDK-RELOAD', `❌ CDN not reachable: ${error.message}`, 'error');
                debugLog('SDK-RELOAD', 'Trying to load script anyway...', 'info');
                loadSDKScript();
            });
    }
}

function loadSDKScript() {
    const script = document.createElement('script');
    script.src = 'https://js.appboycdn.com/web-sdk/5.8/braze.min.js';
    script.async = true;
    
    script.onload = function() {
        debugLog('SDK-RELOAD', '✅ Script loaded successfully', 'success');
        setTimeout(() => checkSDKLoaded(), 500);
    };
    
    script.onerror = function(error) {
        debugLog('SDK-RELOAD', '❌ Script failed to load', 'error');
        debugLog('SDK-RELOAD', `Error details: ${JSON.stringify(error)}`, 'error');
        logActivity('Error', 'Failed to reload Braze SDK from CDN.', 'error');
    };
    
    debugLog('SDK-RELOAD', 'Adding script tag to document head...', 'info');
    document.head.appendChild(script);
}

// Update selected endpoint display
function updateSelectedEndpoint() {
    const select = document.getElementById('sdkEndpoint');
    const display = document.getElementById('selectedEndpoint');
    if (select && display) {
        display.textContent = select.value;
    }
}

// Braze SDK Initialization
async function initializeBrazeSDK() {
    debugLog('INIT', '=== STARTING BRAZE SDK INITIALIZATION ===', 'api');
    
    const apiKey = document.getElementById('apiKey').value.trim();
    const sdkEndpoint = document.getElementById('sdkEndpoint').value;
    const userId = document.getElementById('userId').value.trim();
    
    debugLog('INIT', `API Key provided: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`, 'info');
    debugLog('INIT', `API Key preview: ${apiKey ? apiKey.substring(0, 8) + '...' : 'N/A'}`, 'info');
    debugLog('INIT', `SDK Endpoint: ${sdkEndpoint}`, 'info');
    debugLog('INIT', `User ID: ${userId || 'Not provided'}`, 'info');
    
    if (!apiKey) {
        debugLog('INIT', '❌ API Key validation failed - no key provided', 'error');
        logActivity('Error', 'API Key is required to initialize the SDK.', 'error');
        return;
    }
    
    // Check if SDK is loaded
    debugLog('INIT', `Checking SDK availability...`, 'info');
    debugLog('INIT', `typeof window.braze: ${typeof window.braze}`, 'info');
    debugLog('INIT', `window.braze truthy: ${!!window.braze}`, 'info');
    
    if (typeof window.braze === 'undefined' || !window.braze) {
        debugLog('INIT', '❌ Braze SDK not available in window object', 'error');
        logActivity('Error', 'Braze SDK is not loaded. Please refresh the page and try again.', 'error');
        updateSDKStatus('SDK Not Loaded');
        return;
    }
    
    debugLog('INIT', '✅ Braze SDK object found', 'success');
    debugLog('INIT', `Braze SDK methods available: ${Object.keys(window.braze).slice(0, 10).join(', ')}...`, 'info');
    
    showLoading(true);
    logActivity('Info', `Initializing with API Key: ${apiKey.substring(0, 8)}... and endpoint: ${sdkEndpoint}`, 'info');
    updateBannerStatus('Initializing SDK…', 'loading');
    
    try {
        // Get advanced settings
        const enableLogging = document.getElementById('enableLogging').checked;
        const sessionTimeout = parseInt(document.getElementById('sessionTimeout').value) || 30;
        const triggerInterval = parseInt(document.getElementById('triggerInterval').value) || 30;
        const enableSdkAuth = document.getElementById('enableSdkAuth').checked;
        const allowUserSuppliedJavascript = document.getElementById('allowUserSuppliedJavascript').checked;
        const disablePushTokenMaintenance = document.getElementById('disablePushTokenMaintenance').checked;
        const serviceWorkerLocation = getServiceWorkerLocation();
        const serviceWorkerScope = getServiceWorkerScope();
        
        debugLog('INIT', '--- Advanced Settings ---', 'info');
        debugLog('INIT', `Enable Logging: ${enableLogging}`, 'info');
        debugLog('INIT', `Session Timeout: ${sessionTimeout}s`, 'info');
        debugLog('INIT', `Trigger Interval: ${triggerInterval}s`, 'info');
        debugLog('INIT', `SDK Authentication: ${enableSdkAuth}`, 'info');
        debugLog('INIT', `User Supplied JS: ${allowUserSuppliedJavascript}`, 'info');
        debugLog('INIT', `Disable Push Maintenance: ${disablePushTokenMaintenance}`, 'info');
        debugLog('INIT', `Service Worker path: ${serviceWorkerLocation} (scope: ${serviceWorkerScope})`, 'info');
        
        // Initialize Braze
        brazeInstance = window.braze;
        
        const initOptions = {
            baseUrl: sdkEndpoint,
            enableLogging: enableLogging,
            sessionTimeoutInSeconds: sessionTimeout,
            minimumIntervalBetweenTriggerActionsInSeconds: triggerInterval,
            enableSdkAuthentication: enableSdkAuth,
            allowUserSuppliedJavascript: allowUserSuppliedJavascript,
            disablePushTokenMaintenance: disablePushTokenMaintenance,
            automaticallyShowInAppMessages: true,
            serviceWorkerLocation: serviceWorkerLocation,
            serviceWorkerScope: serviceWorkerScope,
            manageServiceWorkerExternally: false  // Let Braze manage the service worker
        };
        
        debugLog('INIT', '--- Full Init Options ---', 'api');
        debugLog('INIT', JSON.stringify(initOptions, null, 2), 'api');
        
        logActivity('Info', `SDK Options: ${JSON.stringify(initOptions, null, 2)}`, 'info');
        
        debugLog('INIT', 'Calling braze.initialize()...', 'api');
        brazeInstance.initialize(apiKey, initOptions);
        debugLog('INIT', '✅ braze.initialize() completed without throwing', 'success');
        
        // Change user if provided
        if (userId) {
            debugLog('INIT', `Calling braze.changeUser("${userId}")...`, 'api');
            brazeInstance.changeUser(userId);
            logActivity('Success', `User changed to: ${userId}`, 'success');
            debugLog('INIT', '✅ User changed successfully', 'success');
        }
        
        // Open session
        debugLog('INIT', 'Calling braze.openSession()...', 'api');
        brazeInstance.openSession();
        debugLog('INIT', '✅ Session opened successfully', 'success');
        initializeBannerPlacement();
        
        isInitialized = true;
        updateSDKStatus('Initialized');
        logActivity('Success', `Braze SDK initialized successfully with endpoint: ${sdkEndpoint}`, 'success');
        
        // Enable automatic in-app message display
        if (typeof brazeInstance.automaticallyShowInAppMessages === 'function') {
            debugLog('INIT', 'Calling braze.automaticallyShowInAppMessages()...', 'api');
            brazeInstance.automaticallyShowInAppMessages();
            debugLog('INIT', '✅ Automatic in-app messages enabled', 'success');
        }
        
        // Log all available methods for reference
        const allMethods = Object.keys(brazeInstance).filter(key => typeof brazeInstance[key] === 'function');
        debugLog('INIT', `Total methods available: ${allMethods.length}`, 'info');
        debugLog('INIT', `All methods: ${allMethods.join(', ')}`, 'info');
        
        // Log specific method categories
        const iamMethods = allMethods.filter(m => m.toLowerCase().includes('message') || m.toLowerCase().includes('iam'));
        const pushMethods = allMethods.filter(m => m.toLowerCase().includes('push'));
        const sessionMethods = allMethods.filter(m => m.toLowerCase().includes('session'));
        
        debugLog('INIT', `In-App Message methods: ${iamMethods.join(', ') || 'None found'}`, 'info');
        debugLog('INIT', `Push methods: ${pushMethods.join(', ') || 'None found'}`, 'info');
        debugLog('INIT', `Session methods: ${sessionMethods.join(', ') || 'None found'}`, 'info');
        
        debugLog('INIT', '=== INITIALIZATION COMPLETE ===', 'success');
        
    } catch (error) {
        debugLog('INIT', '❌ === INITIALIZATION FAILED ===', 'error');
        debugLog('INIT', `Error Type: ${error.constructor.name}`, 'error');
        debugLog('INIT', `Error Message: ${error.message}`, 'error');
        debugLog('INIT', `Error Stack:\n${error.stack}`, 'error');
        
        logActivity('Error', `Failed to initialize Braze SDK: ${error.message}`, 'error');
        logActivity('Error', `Error stack: ${error.stack}`, 'error');
        updateSDKStatus('Error');
        updateBannerStatus('Failed to initialize SDK. See logs for details.', 'error');
        
        // Additional debugging
        debugLog('INIT', '--- Debug Info ---', 'error');
        debugLog('INIT', `API Key format check: ${/^[a-f0-9-]{36}$/i.test(apiKey) ? 'Valid UUID format' : 'Invalid format'}`, 'warning');
        debugLog('INIT', `Endpoint reachable: Testing connection...`, 'info');
        
        // Test endpoint connectivity
        fetch(sdkEndpoint + '/ping', { mode: 'no-cors' })
            .then(() => debugLog('INIT', `✅ Endpoint ${sdkEndpoint} appears reachable`, 'info'))
            .catch(e => debugLog('INIT', `⚠️ Could not verify endpoint: ${e.message}`, 'warning'));
    } finally {
        showLoading(false);
    }
}

// Custom Attribute Logging
function logCustomAttribute() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    const key = document.getElementById('attrKey').value.trim();
    const value = document.getElementById('attrValue').value.trim();
    const type = document.getElementById('attrType').value;
    
    if (!key || !value) {
        logActivity('Warning', 'Both attribute key and value are required.', 'warning');
        return;
    }
    
    try {
        let processedValue = value;
        
        // Process value based on type
        switch (type) {
            case 'number':
                processedValue = parseFloat(value);
                if (isNaN(processedValue)) {
                    logActivity('Error', 'Invalid number format.', 'error');
                    return;
                }
                break;
            case 'boolean':
                processedValue = value.toLowerCase() === 'true';
                break;
            case 'date':
                processedValue = new Date(value);
                if (isNaN(processedValue.getTime())) {
                    logActivity('Error', 'Invalid date format.', 'error');
                    return;
                }
                break;
            default:
                processedValue = String(value);
        }
        
        brazeInstance.getUser().setCustomUserAttribute(key, processedValue);
        logActivity('Success', `Custom attribute logged: ${key} = ${processedValue} (${type})`, 'success');
        
        // Clear inputs
        document.getElementById('attrKey').value = '';
        document.getElementById('attrValue').value = '';
        
    } catch (error) {
        logActivity('Error', `Failed to log custom attribute: ${error.message}`, 'error');
    }
}

// Custom Event Logging
function logCustomEvent() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    const eventName = document.getElementById('eventName').value.trim();
    const eventPropertiesText = document.getElementById('eventProperties').value.trim();
    
    if (!eventName) {
        logActivity('Warning', 'Event name is required.', 'warning');
        return;
    }
    
    try {
        let eventProperties = {};
        
        // Parse event properties if provided
        if (eventPropertiesText) {
            try {
                eventProperties = JSON.parse(eventPropertiesText);
            } catch (parseError) {
                logActivity('Error', 'Invalid JSON format for event properties.', 'error');
                return;
            }
        }
        
        if (Object.keys(eventProperties).length > 0) {
            brazeInstance.logCustomEvent(eventName, eventProperties);
            logActivity('Success', `Custom event logged: ${eventName} with properties: ${JSON.stringify(eventProperties)}`, 'success');
        } else {
            brazeInstance.logCustomEvent(eventName);
            logActivity('Success', `Custom event logged: ${eventName}`, 'success');
        }
        
        // Clear inputs
        document.getElementById('eventName').value = '';
        document.getElementById('eventProperties').value = '';
        
    } catch (error) {
        logActivity('Error', `Failed to log custom event: ${error.message}`, 'error');
    }
}

// Session Management
function startSession() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        brazeInstance.openSession();
        logActivity('Success', 'Session started successfully.', 'success');
    } catch (error) {
        logActivity('Error', `Failed to start session: ${error.message}`, 'error');
    }
}

function endSession() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        brazeInstance.closeSession();
        logActivity('Success', 'Session ended successfully.', 'success');
    } catch (error) {
        logActivity('Error', `Failed to end session: ${error.message}`, 'error');
    }
}

// In-App Messages
function requestInAppMessages() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        // Try different possible method names for v5
        if (typeof brazeInstance.requestContentCardsRefresh === 'function') {
            brazeInstance.requestContentCardsRefresh();
            logActivity('Success', 'Content cards refresh requested.', 'success');
        } else if (typeof brazeInstance.requestImmediateDataFlush === 'function') {
            brazeInstance.requestImmediateDataFlush();
            logActivity('Success', 'Data flush requested - in-app messages should refresh.', 'success');
        } else {
            // Log available methods for debugging
            const methods = Object.keys(brazeInstance).filter(key => typeof brazeInstance[key] === 'function');
            debugLog('IAM', `Available methods: ${methods.join(', ')}`, 'info');
            logActivity('Info', 'Data flushed. Configure in-app messages in your Braze dashboard.', 'info');
        }
    } catch (error) {
        logActivity('Error', `Failed to request in-app messages: ${error.message}`, 'error');
        debugLog('IAM', `Error: ${error.stack}`, 'error');
    }
}

function flushData() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        brazeInstance.requestImmediateDataFlush();
        logActivity('Success', 'Data flush requested - all pending data sent to Braze.', 'success');
    } catch (error) {
        logActivity('Error', `Failed to flush data: ${error.message}`, 'error');
    }
}

// Push Notifications
async function requestPushPermission() {
    if (!('Notification' in window)) {
        logActivity('Error', 'This browser does not support notifications.', 'error');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        updatePushStatus();
        
        if (permission === 'granted') {
            logActivity('Success', 'Push notification permission granted.', 'success');
        } else if (permission === 'denied') {
            logActivity('Warning', 'Push notification permission denied.', 'warning');
        } else {
            logActivity('Info', 'Push notification permission dismissed.', 'info');
        }
    } catch (error) {
        logActivity('Error', `Failed to request push permission: ${error.message}`, 'error');
    }
}

async function registerPush() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    // Check if push is supported using Braze method
    if (typeof brazeInstance.isPushSupported === 'function' && !brazeInstance.isPushSupported()) {
        logActivity('Error', 'Push notifications are not supported in this browser.', 'error');
        debugLog('PUSH', 'braze.isPushSupported() returned false', 'error');
        return;
    }
    
    try {
        debugLog('PUSH', 'Calling braze.requestPushPermission()...', 'api');
        
        // Use Braze's requestPushPermission with callbacks
        brazeInstance.requestPushPermission(
            // Success callback
            () => {
                logActivity('Success', 'Successfully registered for push notifications.', 'success');
                debugLog('PUSH', '✅ Push permission granted', 'success');
                updatePushStatus();
            },
            // Error callback
            () => {
                logActivity('Warning', 'Push notification permission was denied or dismissed.', 'warning');
                debugLog('PUSH', '⚠️ Push permission denied', 'warning');
                updatePushStatus();
            }
        );
        
    } catch (error) {
        logActivity('Error', `Failed to register for push notifications: ${error.message}`, 'error');
        debugLog('PUSH', `Error: ${error.stack}`, 'error');
    }
}

function testPushNotification() {
    if (!('Notification' in window)) {
        logActivity('Error', 'This browser does not support notifications.', 'error');
        return;
    }
    
    if (Notification.permission !== 'granted') {
        logActivity('Warning', 'Push notification permission is required for testing.', 'warning');
        return;
    }
    
    try {
        new Notification('Braze WebSDK Demo', {
            body: 'This is a test push notification!',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%239d4edd"/></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%239d4edd"/></svg>',
            tag: 'braze-demo-test',
            requireInteraction: false
        });
        
        logActivity('Success', 'Test push notification sent successfully.', 'success');
    } catch (error) {
        logActivity('Error', `Failed to send test notification: ${error.message}`, 'error');
    }
}

// Service Worker Registration
async function registerServiceWorker() {
    try {
        const serviceWorkerLocation = getServiceWorkerLocation();
        const serviceWorkerScope = getServiceWorkerScope();
        debugLog('SW', `Attempting Service Worker registration at ${serviceWorkerLocation} with scope ${serviceWorkerScope}`, 'info');
        const registration = await navigator.serviceWorker.register(serviceWorkerLocation, { scope: serviceWorkerScope });
        logActivity('Info', 'Service Worker registered successfully.', 'info');
        debugLog('SW', 'Service Worker registration succeeded.', 'success');
        return registration;
    } catch (error) {
        logActivity('Warning', `Service Worker registration failed: ${error.message}`, 'warning');
        debugLog('SW', `Service Worker registration error: ${error.stack || error.message}`, 'error');
        throw error;
    }
}

// Utility Functions
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('open');
}

function updateSDKStatus(status) {
    document.getElementById('sdkStatus').textContent = status;
    
    // Update status color based on state
    const statusElement = document.getElementById('sdkStatus');
    statusElement.className = 'status-value';
    
    switch (status.toLowerCase()) {
        case 'initialized':
            statusElement.style.color = '#198754';
            break;
        case 'error':
            statusElement.style.color = '#dc3545';
            break;
        default:
            statusElement.style.color = '#e0e0e0';
    }
}

function updatePushStatus() {
    const statusElement = document.getElementById('pushStatus');
    const detailsElement = document.getElementById('pushStatusDetails');
    
    // Check if Braze SDK is initialized and has push methods
    if (isInitialized && brazeInstance && typeof brazeInstance.isPushSupported === 'function') {
        if (!brazeInstance.isPushSupported()) {
            statusElement.textContent = 'Not Supported';
            statusElement.style.color = '#dc3545';
            detailsElement.innerHTML = '<p>Push notifications are not supported in this browser.</p>';
            debugLog('PUSH-STATUS', 'Push not supported by browser', 'warning');
            return;
        }
        
        // Use Braze method to check permission
        if (typeof brazeInstance.isPushPermissionGranted === 'function') {
            const isGranted = brazeInstance.isPushPermissionGranted();
            debugLog('PUSH-STATUS', `braze.isPushPermissionGranted() = ${isGranted}`, 'info');
            
            if (isGranted) {
                statusElement.textContent = 'Enabled';
                statusElement.style.color = '#198754';
                detailsElement.innerHTML = '<p>✅ Push notifications are enabled and ready to use.</p>';
            } else {
                statusElement.textContent = 'Not Enabled';
                statusElement.style.color = '#ffc107';
                detailsElement.innerHTML = '<p>⏳ Push notification permission not granted. Click "Register for Push" to enable.</p>';
            }
            return;
        }
    }
    
    // Fallback to browser Notification API if Braze not initialized
    if (!('Notification' in window)) {
        statusElement.textContent = 'Not Supported';
        statusElement.style.color = '#dc3545';
        detailsElement.innerHTML = '<p>Push notifications are not supported in this browser.</p>';
        return;
    }
    
    const permission = Notification.permission;
    let statusText = 'Unknown';
    let statusColor = '#e0e0e0';
    let detailsText = '';
    
    switch (permission) {
        case 'granted':
            statusText = 'Permission Granted';
            statusColor = '#198754';
            detailsText = '<p>✅ Push permission granted. Initialize SDK and register for push.</p>';
            break;
        case 'denied':
            statusText = 'Blocked';
            statusColor = '#dc3545';
            detailsText = '<p>❌ Push notifications are blocked. Please enable them in your browser settings.</p>';
            break;
        case 'default':
            statusText = 'Not Requested';
            statusColor = '#ffc107';
            detailsText = '<p>⏳ Push notification permission has not been requested yet.</p>';
            break;
    }
    
    statusElement.textContent = statusText;
    statusElement.style.color = statusColor;
    detailsElement.innerHTML = detailsText;
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

function logActivity(type, message, level = 'info') {
    const logContent = document.getElementById('logContent');
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${level}`;
    logEntry.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="message"><strong>${type}:</strong> ${message}</span>
    `;
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
    
    // Keep only last 50 log entries
    const entries = logContent.querySelectorAll('.log-entry');
    if (entries.length > 50) {
        entries[0].remove();
    }
}

function clearLog() {
    const logContent = document.getElementById('logContent');
    logContent.innerHTML = '';
    logActivity('Info', 'Activity log cleared.', 'info');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to initialize SDK
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isInitialized) {
            initializeBrazeSDK();
        }
    }
    
    // Escape to close settings
    if (e.key === 'Escape') {
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel.classList.contains('open')) {
            toggleSettings();
        }
    }
});

// Auto-save settings to localStorage
function saveSettings() {
    const settings = {
        enableLogging: document.getElementById('enableLogging').checked,
        sessionTimeout: document.getElementById('sessionTimeout').value,
        triggerInterval: document.getElementById('triggerInterval').value,
        enableSdkAuth: document.getElementById('enableSdkAuth').checked,
        allowUserSuppliedJavascript: document.getElementById('allowUserSuppliedJavascript').checked,
        disablePushTokenMaintenance: document.getElementById('disablePushTokenMaintenance').checked
    };
    
    localStorage.setItem('braze-demo-settings', JSON.stringify(settings));
}

function loadSettings() {
    const savedSettings = localStorage.getItem('braze-demo-settings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            
            document.getElementById('enableLogging').checked = settings.enableLogging ?? true;
            document.getElementById('sessionTimeout').value = settings.sessionTimeout ?? 30;
            document.getElementById('triggerInterval').value = settings.triggerInterval ?? 30;
            document.getElementById('enableSdkAuth').checked = settings.enableSdkAuth ?? false;
            document.getElementById('allowUserSuppliedJavascript').checked = settings.allowUserSuppliedJavascript ?? false;
            document.getElementById('disablePushTokenMaintenance').checked = settings.disablePushTokenMaintenance ?? false;
        } catch (error) {
            console.warn('Failed to load saved settings:', error);
        }
    }
}

// Load settings and environments on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    loadEnvironmentList();
    
    const stateApplied = loadAppState();

    if (!stateApplied) {
        const storage = getLocalStorageSafe();
        if (storage) {
            const lastEnv = storage.getItem('braze-last-environment');
            if (lastEnv) {
                const select = document.getElementById('environmentSelect');
                if (select) {
                    select.value = lastEnv;
                    loadEnvironment(true); // Pass true to indicate auto-load
                }
            }
        }
    }
});

// Save settings when they change
document.addEventListener('change', function(e) {
    if (e.target.closest('.settings-content')) {
        saveSettings();

        if (e.target.id === 'allowUserSuppliedJavascript') {
            if (e.target.checked) {
                logActivity('Info', '"Allow User Supplied JavaScript" enabled.', 'info');
                if (isInitialized) {
                    initializeBannerPlacement();
                } else {
                    resetBannerContainer();
                    updateBannerStatus('Awaiting SDK initialization…');
                }
            } else {
                resetBannerContainer('Enable <strong>Allow User Supplied JavaScript</strong> to display banners.');
                updateBannerStatus('Enable "Allow User Supplied JavaScript" to display banners.', 'error');
                logActivity('Warning', '"Allow User Supplied JavaScript" disabled. Banners cannot be displayed.', 'warning');
            }
        }
    }
});

// Other Debug Console Functions
function clearDebugConsole() {
    const debugContent = document.getElementById('debugContent');
    if (debugContent) {
        debugContent.innerHTML = '<div class="debug-entry debug-info"><span class="debug-time">[00:00:00.000]</span><span class="debug-type">[CLEAR]</span><span class="debug-message">Debug console cleared.</span></div>';
        debugStartTime = Date.now();
    }
}

function toggleDebugExpand() {
    const debugContent = document.getElementById('debugContent');
    const expandIcon = document.getElementById('expandIcon');
    
    if (debugContent.classList.contains('expanded')) {
        debugContent.classList.remove('expanded');
        expandIcon.className = 'fas fa-expand';
    } else {
        debugContent.classList.add('expanded');
        expandIcon.className = 'fas fa-compress';
    }
}

function copyDebugLog() {
    const debugContent = document.getElementById('debugContent');
    const entries = debugContent.querySelectorAll('.debug-entry');
    
    let text = 'BRAZE WEBSDK DEMO - DEBUG LOG\n';
    text += '================================\n\n';
    
    entries.forEach(entry => {
        const time = entry.querySelector('.debug-time').textContent;
        const type = entry.querySelector('.debug-type').textContent;
        const message = entry.querySelector('.debug-message').textContent;
        text += `${time} ${type} ${message}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        debugLog('SYSTEM', 'Debug log copied to clipboard', 'success');
    }).catch(err => {
        debugLog('SYSTEM', 'Failed to copy debug log: ' + err.message, 'error');
    });
}

// Capture window errors
window.addEventListener('error', function(event) {
    debugLog('WINDOW-ERROR', `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    debugLog('PROMISE-ERROR', `Unhandled promise rejection: ${event.reason}`, 'error');
});

// Environment Management Functions
function loadEnvironmentList() {
    const environments = JSON.parse(localStorage.getItem('braze-environments') || '{}');
    const select = document.getElementById('environmentSelect');
    
    // Clear existing options (except default)
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add saved environments
    Object.keys(environments).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
    
    debugLog('ENV', `Loaded ${Object.keys(environments).length} saved environments`, 'info');
}

function saveEnvironment() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const sdkEndpoint = document.getElementById('sdkEndpoint').value;
    const userId = document.getElementById('userId').value.trim();
    
    if (!apiKey) {
        alert('Please enter an API Key before saving the environment.');
        return;
    }
    
    const name = prompt('Enter a name for this environment:');
    if (!name) return;
    
    const environments = JSON.parse(localStorage.getItem('braze-environments') || '{}');
    
    environments[name] = {
        apiKey: apiKey,
        sdkEndpoint: sdkEndpoint,
        userId: userId,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('braze-environments', JSON.stringify(environments));
    loadEnvironmentList();
    
    // Set the dropdown to the newly saved environment
    document.getElementById('environmentSelect').value = name;

    saveAppState(true);
    
    logActivity('Success', `Environment "${name}" saved successfully.`, 'success');
    debugLog('ENV', `Saved environment: ${name}`, 'success');
}

function loadEnvironment(isAutoLoad = false) {
    const select = document.getElementById('environmentSelect');
    const name = select.value;
    
    if (!name) return;
    
    const environments = JSON.parse(localStorage.getItem('braze-environments') || '{}');
    const env = environments[name];
    
    if (!env) {
        alert('Environment not found.');
        return;
    }
    
    document.getElementById('apiKey').value = env.apiKey;
    document.getElementById('sdkEndpoint').value = env.sdkEndpoint;
    document.getElementById('userId').value = env.userId || '';
    
    updateSelectedEndpoint();
    
    saveAppState(true);

    // Save as last selected environment
    localStorage.setItem('braze-last-environment', name);
    
    if (isAutoLoad) {
        logActivity('Info', `Auto-loaded environment: ${name}`, 'info');
        debugLog('ENV', `Auto-loaded environment on page load: ${name}`, 'success');
    } else {
        logActivity('Info', `Loaded environment: ${name}`, 'info');
        debugLog('ENV', `Loaded environment: ${name} (API Key: ${env.apiKey.substring(0, 8)}..., Endpoint: ${env.sdkEndpoint})`, 'info');
    }
}

function deleteEnvironment() {
    const select = document.getElementById('environmentSelect');
    const name = select.value;
    
    if (!name) {
        alert('Please select an environment to delete.');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the environment "${name}"?`)) {
        return;
    }
    
    const environments = JSON.parse(localStorage.getItem('braze-environments') || '{}');
    delete environments[name];
    localStorage.setItem('braze-environments', JSON.stringify(environments));
    
    // Clear last environment if it was the deleted one
    const lastEnv = localStorage.getItem('braze-last-environment');
    if (lastEnv === name) {
        localStorage.removeItem('braze-last-environment');
    }
    
    loadEnvironmentList();
    select.value = '';
    
    // Clear the form fields
    document.getElementById('apiKey').value = '';
    document.getElementById('userId').value = '';
    updateSelectedEndpoint();

    saveAppState(true);
    
    logActivity('Info', `Environment "${name}" deleted.`, 'info');
    debugLog('ENV', `Deleted environment: ${name}`, 'warning');
}

// Sidebar Tab Switching
function switchSidebarTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.sidebar-tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
        if (tab.textContent.toLowerCase().includes(tabName)) {
            tab.classList.add('active');
        }
    });
    
    const content = document.getElementById(`${tabName}-sidebar`);
    if (content) {
        content.classList.add('active');
    }
    
    debugLog('UI', `Switched sidebar tab to: ${tabName}`, 'info');
}

// Content Cards Functions
function showContentCards() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        const feedElement = document.getElementById('content-cards-feed');
        const container = document.getElementById('content-cards-container');
        
        debugLog('CARDS', 'Calling braze.showContentCards()...', 'api');
        
        // Show the Braze Content Cards feed
        brazeInstance.showContentCards(feedElement);
        
        // Show the container
        container.style.display = 'block';
        
        logActivity('Success', 'Content Cards feed displayed.', 'success');
        debugLog('CARDS', '✅ Content Cards feed shown', 'success');
        
        // Subscribe to updates
        subscribeToContentCards();
        
    } catch (error) {
        logActivity('Error', `Failed to show Content Cards: ${error.message}`, 'error');
        debugLog('CARDS', `Error: ${error.stack}`, 'error');
    }
}

function hideContentCards() {
    if (!isInitialized) {
        return;
    }
    
    try {
        debugLog('CARDS', 'Calling braze.hideContentCards()...', 'api');
        brazeInstance.hideContentCards();
        
        // Hide the container
        const container = document.getElementById('content-cards-container');
        container.style.display = 'none';
        
        logActivity('Info', 'Content Cards feed hidden.', 'info');
        debugLog('CARDS', 'Content Cards feed hidden', 'info');
        
    } catch (error) {
        logActivity('Error', `Failed to hide Content Cards: ${error.message}`, 'error');
        debugLog('CARDS', `Error: ${error.stack}`, 'error');
    }
}

function toggleContentCards() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        const container = document.getElementById('content-cards-container');
        const feedElement = document.getElementById('content-cards-feed');
        
        if (container.style.display === 'none') {
            showContentCards();
        } else {
            hideContentCards();
        }
        
    } catch (error) {
        logActivity('Error', `Failed to toggle Content Cards: ${error.message}`, 'error');
        debugLog('CARDS', `Error: ${error.stack}`, 'error');
    }
}

function refreshContentCards() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    try {
        debugLog('CARDS', 'Calling braze.requestContentCardsRefresh()...', 'api');
        
        if (typeof brazeInstance.requestContentCardsRefresh === 'function') {
            brazeInstance.requestContentCardsRefresh();
            logActivity('Success', 'Content Cards refresh requested.', 'success');
            debugLog('CARDS', '✅ Content Cards refresh requested', 'success');
            
            // Also check cached cards to debug
            setTimeout(() => {
                const cachedCards = brazeInstance.getCachedContentCards();
                debugLog('CARDS-DEBUG', `Cached Content Cards object:`, 'info');
                debugLog('CARDS-DEBUG', `- cards array length: ${cachedCards.cards ? cachedCards.cards.length : 'N/A'}`, 'info');
                debugLog('CARDS-DEBUG', `- lastUpdated: ${cachedCards.lastUpdated ? new Date(cachedCards.lastUpdated).toISOString() : 'N/A'}`, 'info');
                
                if (cachedCards.cards && cachedCards.cards.length > 0) {
                    cachedCards.cards.forEach((card, i) => {
                        debugLog('CARDS-DEBUG', `Card ${i + 1} details: ${JSON.stringify({
                            id: card.id,
                            viewed: card.viewed,
                            title: card.title,
                            imageUrl: card.imageUrl,
                            created: card.created,
                            expiresAt: card.expiresAt,
                            pinned: card.pinned
                        })}`, 'info');
                    });
                } else {
                    debugLog('CARDS-DEBUG', '⚠️ No cards in cache. Possible reasons:', 'warning');
                    debugLog('CARDS-DEBUG', '1. Campaign not started or not live', 'warning');
                    debugLog('CARDS-DEBUG', '2. User not in target audience', 'warning');
                    debugLog('CARDS-DEBUG', '3. Card delivery criteria not met', 'warning');
                    debugLog('CARDS-DEBUG', `4. Current user ID: ${brazeInstance.getUser() ? 'Set' : 'Not set'}`, 'warning');
                }
            }, 1000);
        } else {
            // Fallback to getting cached cards
            debugLog('CARDS', 'requestContentCardsRefresh not available, trying getCachedContentCards', 'warning');
            const cards = brazeInstance.getCachedContentCards();
            logActivity('Info', `Retrieved ${cards.cards ? cards.cards.length : 0} cached Content Cards.`, 'info');
            debugLog('CARDS', `Cached cards: ${cards.cards ? cards.cards.length : 0}`, 'info');
        }
        
    } catch (error) {
        logActivity('Error', `Failed to refresh Content Cards: ${error.message}`, 'error');
        debugLog('CARDS', `Error: ${error.stack}`, 'error');
    }
}

function subscribeToContentCards() {
    if (!isInitialized) {
        return;
    }
    
    try {
        if (typeof brazeInstance.subscribeToContentCardsUpdates === 'function') {
            debugLog('CARDS', 'Subscribing to Content Cards updates...', 'api');
            
            brazeInstance.subscribeToContentCardsUpdates((cards) => {
                const cardCount = cards.cards ? cards.cards.length : 0;
                logActivity('Info', `Content Cards updated: ${cardCount} cards available.`, 'info');
                debugLog('CARDS', `Content Cards update: ${cardCount} cards`, 'info');
                
                // Log card details
                if (cards.cards && cards.cards.length > 0) {
                    cards.cards.forEach((card, index) => {
                        debugLog('CARDS', `Card ${index + 1}: ${card.title || 'Untitled'} (${card.constructor.name})`, 'info');
                    });
                }
            });
            
            debugLog('CARDS', '✅ Subscribed to Content Cards updates', 'success');
        }
    } catch (error) {
        debugLog('CARDS', `Failed to subscribe to Content Cards: ${error.message}`, 'error');
    }
}
