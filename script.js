// Braze WebSDK Demo Script
let brazeInstance = null;
let isInitialized = false;
let debugStartTime = Date.now();
const APP_STATE_STORAGE_KEY = 'braze-demo-app-state-v1';
let saveStateTimeout = null;
let lastPersistedStateSignature = '';
const BANNER_PLACEMENT_ID = 'bannerdemo';
let bannerSubscriptionId = null;
let bannerHeightAdjustmentTimers = [];
let bannerManualHeight = null;
let autoInitAttempted = false;

const BANNER_HEIGHT_STORAGE_KEY = 'braze-banner-height';
const BANNER_HEIGHT_MIN = 120;
const BANNER_HEIGHT_MAX = 800;
const APP_VERSION = '2025.02.07.1';
const DEFAULT_COLOR_THEME = 'sunrise';
const DEFAULT_THEME_MODE = 'auto';
const VALID_COLOR_THEMES = new Set(['sunrise', 'lakeside', 'evergreen', 'midnight']);
const VALID_THEME_MODES = new Set(['auto', 'light', 'dark']);
const defaultSettings = {
    enableLogging: true,
    sessionTimeout: 30,
    triggerInterval: 30,
    enableSdkAuth: false,
    allowUserSuppliedJavascript: false,
    disablePushTokenMaintenance: false,
    userDisplayName: '',
    colorTheme: DEFAULT_COLOR_THEME,
    themeMode: DEFAULT_THEME_MODE
};
const systemThemeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let contentCardsData = [];
let contentCardsMap = new Map();
let contentCardsSubscriptionId = null;
let contentCardsObserver = null;
let contentCardsImpressionsLogged = new Set();

applyColorTheme(DEFAULT_COLOR_THEME);
applyThemeMode(DEFAULT_THEME_MODE);

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

function clearBannerHeightAdjustments() {
    if (bannerHeightAdjustmentTimers.length > 0) {
        bannerHeightAdjustmentTimers.forEach(timerId => clearTimeout(timerId));
        bannerHeightAdjustmentTimers = [];
    }
}

function adjustBannerContainerHeight() {
    const container = document.getElementById('bannerPlacementContainer');
    if (!container || bannerManualHeight !== null) return;

    const bannerElement = container.firstElementChild;
    if (!bannerElement) return;

    const rect = bannerElement.getBoundingClientRect();
    const computedHeight = Math.ceil(rect.height);

    if (Number.isFinite(computedHeight) && computedHeight > 0) {
        applyBannerHeightStyles(computedHeight);
    }
}

function scheduleBannerHeightAdjustments() {
    if (bannerManualHeight !== null) {
        return;
    }
    clearBannerHeightAdjustments();
    const delays = [0, 100, 350, 750, 1500];
    delays.forEach(delay => {
        const timerId = setTimeout(adjustBannerContainerHeight, delay);
        bannerHeightAdjustmentTimers.push(timerId);
    });
}

function applyBannerHeightStyles(height) {
    const container = document.getElementById('bannerPlacementContainer');
    if (!container) return;
    const sanitized = clampBannerHeight(height);
    if (!Number.isFinite(sanitized)) return;

    container.style.minHeight = `${sanitized}px`;
    container.style.height = `${sanitized}px`;
}

function applyUserDisplayName(rawName = '') {
    const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
    const titleElement = document.getElementById('appTitle');
    const inboxTitle = document.getElementById('contentCardsTitle');
    const suffix = trimmed && /s$/i.test(trimmed) ? '\'' : '\'s';
    const displayTitle = trimmed ? `${trimmed}${suffix} Braze WebSDK Demo` : 'Braze WebSDK Demo';
    if (titleElement) {
        titleElement.textContent = displayTitle;
    }
    document.title = displayTitle;
    if (inboxTitle) {
        inboxTitle.textContent = trimmed ? `${trimmed}${suffix} Message Inbox` : 'Message Inbox';
    }
}

function applyColorTheme(theme) {
    const selectedTheme = VALID_COLOR_THEMES.has(theme) ? theme : DEFAULT_COLOR_THEME;
    document.body.dataset.colorTheme = selectedTheme;
}

function updateThemeToneFromMode() {
    const currentMode = document.body.dataset.themeMode || DEFAULT_THEME_MODE;
    if (currentMode === 'auto') {
        const prefersDark = systemThemeMediaQuery ? systemThemeMediaQuery.matches : false;
        document.body.dataset.themeTone = prefersDark ? 'dark' : 'light';
    } else {
        document.body.dataset.themeTone = currentMode;
    }
}

function applyThemeMode(mode) {
    const selectedMode = VALID_THEME_MODES.has(mode) ? mode : DEFAULT_THEME_MODE;
    document.body.dataset.themeMode = selectedMode;
    updateThemeToneFromMode();
}

function applyPersonalizationSettings(settings = defaultSettings) {
    applyUserDisplayName(settings.userDisplayName || '');
    applyColorTheme(settings.colorTheme || DEFAULT_COLOR_THEME);
    applyThemeMode(settings.themeMode || DEFAULT_THEME_MODE);
}

if (systemThemeMediaQuery && typeof systemThemeMediaQuery.addEventListener === 'function') {
    systemThemeMediaQuery.addEventListener('change', () => {
        if ((document.body.dataset.themeMode || DEFAULT_THEME_MODE) === 'auto') {
            updateThemeToneFromMode();
        }
    });
} else if (systemThemeMediaQuery && typeof systemThemeMediaQuery.addListener === 'function') {
    systemThemeMediaQuery.addListener(() => {
        if ((document.body.dataset.themeMode || DEFAULT_THEME_MODE) === 'auto') {
            updateThemeToneFromMode();
        }
    });
}

function clearBannerHeightStyles() {
    const container = document.getElementById('bannerPlacementContainer');
    if (!container) return;
    container.style.minHeight = '80px';
    container.style.height = 'auto';
}

function resetBannerContainer(message = 'Initialize the SDK with <strong>Allow User Supplied JavaScript</strong> enabled to load banners.') {
    const section = document.getElementById('bannerPlacementSection');
    const container = document.getElementById('bannerPlacementContainer');
    const placeholder = document.getElementById('bannerPlacementPlaceholder');

    clearBannerHeightAdjustments();

    if (container) {
        container.innerHTML = '';
        if (bannerManualHeight !== null) {
            applyBannerHeightStyles(bannerManualHeight);
        } else {
            clearBannerHeightStyles();
        }
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
        clearBannerHeightAdjustments();
        if (bannerManualHeight !== null) {
            applyBannerHeightStyles(bannerManualHeight);
        } else {
            clearBannerHeightStyles();
        }
        return;
    }

    if (banner.isControl) {
        section.classList.remove('has-banner');
        placeholder.style.display = 'block';
        placeholder.textContent = 'User is in the control variant. No banner will be displayed.';
        updateBannerStatus('Control variant received.');
        clearBannerHeightAdjustments();
        if (bannerManualHeight !== null) {
            applyBannerHeightStyles(bannerManualHeight);
        } else {
            clearBannerHeightStyles();
        }
        return;
    }

    try {
        brazeInstance.insertBanner(banner, container);
        section.classList.add('has-banner');
        placeholder.style.display = 'none';
        updateBannerStatus('Banner loaded successfully.', 'success');
        debugLog('BANNER', `Inserted banner for placement ${BANNER_PLACEMENT_ID}`, 'success');
        if (bannerManualHeight !== null) {
            applyBannerHeightStyles(bannerManualHeight);
        } else {
            scheduleBannerHeightAdjustments();
        }
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

function displayAppVersion() {
    const versionElement = document.getElementById('appVersionTag');
    if (versionElement) {
        versionElement.textContent = APP_VERSION;
        versionElement.title = `Application version ${APP_VERSION}`;
    }
}

function attemptAutoInitialize() {
    if (autoInitAttempted || isInitialized) {
        return;
    }

    const apiKeyInput = document.getElementById('apiKey');
    const sdkEndpointSelect = document.getElementById('sdkEndpoint');

    if (!apiKeyInput || !sdkEndpointSelect) {
        return;
    }

    const apiKey = apiKeyInput.value.trim();
    const sdkEndpoint = sdkEndpointSelect.value;

    if (!apiKey || !sdkEndpoint) {
        return;
    }

    autoInitAttempted = true;
    debugLog('INIT', 'Attempting automatic SDK initialization with stored credentials.', 'info');
    updateBannerStatus('Attempting automatic initialization…', 'loading');

    setTimeout(() => {
        initializeBrazeSDK();
    }, 200);
}

function clampBannerHeight(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.min(Math.max(Math.round(numeric), BANNER_HEIGHT_MIN), BANNER_HEIGHT_MAX);
}

function updateBannerHeightControls(height) {
    const range = document.getElementById('bannerHeightRange');
    const number = document.getElementById('bannerHeightNumber');
    const hasManual = Number.isFinite(height);

    if (range) {
        range.value = hasManual ? String(height) : String(range.min || BANNER_HEIGHT_MIN);
        range.dataset.manual = hasManual ? 'true' : 'false';
    }

    if (number) {
        number.value = hasManual ? String(height) : '';
        number.placeholder = hasManual ? '' : 'Auto';
    }
}

function storeBannerManualHeight(height) {
    const storage = getLocalStorageSafe();
    if (!storage) return;
    if (Number.isFinite(height)) {
        storage.setItem(BANNER_HEIGHT_STORAGE_KEY, String(height));
    } else {
        storage.removeItem(BANNER_HEIGHT_STORAGE_KEY);
    }
}

function setManualBannerHeight(height, { persist = true, showStatus = true } = {}) {
    const clamped = clampBannerHeight(height);
    if (!Number.isFinite(clamped)) {
        return;
    }

    bannerManualHeight = clamped;
    if (persist) {
        storeBannerManualHeight(clamped);
    }

    clearBannerHeightAdjustments();
    applyBannerHeightStyles(clamped);
    updateBannerHeightControls(clamped);

    if (showStatus) {
        updateBannerStatus(`Manual banner height set to ${clamped}px.`);
    }

    debugLog('BANNER', `Manual banner height applied: ${clamped}px`, 'info');
}

function clearManualBannerHeight({ showStatus = true } = {}) {
    if (bannerManualHeight === null) {
        return;
    }

    bannerManualHeight = null;
    storeBannerManualHeight(null);
    updateBannerHeightControls(null);
    clearBannerHeightAdjustments();
    clearBannerHeightStyles();

    if (document.getElementById('bannerPlacementContainer')?.firstElementChild) {
        scheduleBannerHeightAdjustments();
    }

    if (showStatus) {
        updateBannerStatus('Banner height reset to auto sizing.', 'success');
    }

    debugLog('BANNER', 'Manual banner height cleared. Returning to automatic sizing.', 'info');
}

function loadBannerHeightPreference() {
    const storage = getLocalStorageSafe();
    if (!storage) {
        updateBannerHeightControls(null);
        return;
    }

    const stored = storage.getItem(BANNER_HEIGHT_STORAGE_KEY);
    if (!stored) {
        updateBannerHeightControls(null);
        return;
    }

    const parsed = clampBannerHeight(stored);
    if (Number.isFinite(parsed)) {
        setManualBannerHeight(parsed, { persist: false, showStatus: false });
    } else {
        updateBannerHeightControls(null);
    }
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
    displayAppVersion();
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
    setupBannerHeightControls();

    const openContentCardsButton = document.getElementById('openContentCardsButton');
    if (openContentCardsButton) {
        openContentCardsButton.addEventListener('click', () => toggleContentCards());
    }

    const closeContentCardsButton = document.getElementById('closeContentCardsButton');
    if (closeContentCardsButton) {
        closeContentCardsButton.addEventListener('click', () => closeContentCardsInbox());
    }

    const refreshContentCardsButton = document.getElementById('refreshContentCardsButton');
    if (refreshContentCardsButton) {
        refreshContentCardsButton.addEventListener('click', () => refreshContentCards());
    }

    const markAllCardsReadButton = document.getElementById('markAllCardsReadButton');
    if (markAllCardsReadButton) {
        markAllCardsReadButton.addEventListener('click', () => markAllContentCardsAsRead());
    }

    const contentCardsOverlay = document.getElementById('contentCardsOverlay');
    if (contentCardsOverlay) {
        contentCardsOverlay.addEventListener('click', (event) => {
            if (event.target === contentCardsOverlay || event.target.hasAttribute('data-close-inbox')) {
                closeContentCardsInbox();
            }
        });
    }

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

    const displayNameInput = document.getElementById('displayNameInput');
    if (displayNameInput) {
        displayNameInput.addEventListener('input', () => {
            applyUserDisplayName(displayNameInput.value);
            saveSettings();
        });
    }

    const colorThemeSelect = document.getElementById('colorThemeSelect');
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener('change', () => {
            applyColorTheme(colorThemeSelect.value);
            saveSettings();
        });
    }

    const themeModeSelect = document.getElementById('themeModeSelect');
    if (themeModeSelect) {
        themeModeSelect.addEventListener('change', () => {
            applyThemeMode(themeModeSelect.value);
            saveSettings();
        });
    }
}

function setupBannerHeightControls() {
    const range = document.getElementById('bannerHeightRange');
    const number = document.getElementById('bannerHeightNumber');
    const resetButton = document.getElementById('resetBannerHeightButton');

    if (range) {
        range.addEventListener('change', () => {
            const clamped = clampBannerHeight(range.value);
            if (Number.isFinite(clamped)) {
                setManualBannerHeight(clamped, { persist: true, showStatus: false });
                updateBannerStatus(`Manual banner height set to ${clamped}px.`);
                range.value = String(clamped);
                if (number) {
                    number.value = String(clamped);
                }
            }
        });
    }

    if (number) {
        number.addEventListener('change', () => {
            const clamped = clampBannerHeight(number.value);
            if (Number.isFinite(clamped)) {
                setManualBannerHeight(clamped, { persist: true, showStatus: false });
                updateBannerStatus(`Manual banner height set to ${clamped}px.`);
                if (range) {
                    range.value = String(clamped);
                }
                number.value = String(clamped);
            } else {
                number.value = bannerManualHeight !== null ? String(bannerManualHeight) : '';
            }
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            clearManualBannerHeight({ showStatus: true });
            updateBannerHeightControls(null);
        });
    }

    updateBannerHeightControls(bannerManualHeight);
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
        subscribeToContentCards();
        
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
        
        if (isContentCardsInboxOpen()) {
            closeContentCardsInbox();
        }
    }
});

// Auto-save settings to localStorage
function saveSettings() {
    const settings = {
        enableLogging: document.getElementById('enableLogging').checked,
        sessionTimeout: parseInt(document.getElementById('sessionTimeout').value, 10) || defaultSettings.sessionTimeout,
        triggerInterval: parseInt(document.getElementById('triggerInterval').value, 10) || defaultSettings.triggerInterval,
        enableSdkAuth: document.getElementById('enableSdkAuth').checked,
        allowUserSuppliedJavascript: document.getElementById('allowUserSuppliedJavascript').checked,
        disablePushTokenMaintenance: document.getElementById('disablePushTokenMaintenance').checked,
        userDisplayName: (document.getElementById('displayNameInput')?.value || '').trim(),
        colorTheme: document.getElementById('colorThemeSelect')?.value || DEFAULT_COLOR_THEME,
        themeMode: document.getElementById('themeModeSelect')?.value || DEFAULT_THEME_MODE
    };
    
    localStorage.setItem('braze-demo-settings', JSON.stringify(settings));
    applyPersonalizationSettings(settings);
}

function loadSettings() {
    const savedSettings = localStorage.getItem('braze-demo-settings');
    const settings = { ...defaultSettings };
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            Object.assign(settings, parsed);
        } catch (error) {
            console.warn('Failed to load saved settings:', error);
        }
    }
    
    document.getElementById('enableLogging').checked = settings.enableLogging;
    document.getElementById('sessionTimeout').value = settings.sessionTimeout;
    document.getElementById('triggerInterval').value = settings.triggerInterval;
    document.getElementById('enableSdkAuth').checked = settings.enableSdkAuth;
    document.getElementById('allowUserSuppliedJavascript').checked = settings.allowUserSuppliedJavascript;
    document.getElementById('disablePushTokenMaintenance').checked = settings.disablePushTokenMaintenance;
    
    const displayNameInput = document.getElementById('displayNameInput');
    if (displayNameInput) {
        displayNameInput.value = settings.userDisplayName || '';
    }
    const colorThemeSelect = document.getElementById('colorThemeSelect');
    if (colorThemeSelect) {
        colorThemeSelect.value = VALID_COLOR_THEMES.has(settings.colorTheme) ? settings.colorTheme : DEFAULT_COLOR_THEME;
    }
    const themeModeSelect = document.getElementById('themeModeSelect');
    if (themeModeSelect) {
        themeModeSelect.value = VALID_THEME_MODES.has(settings.themeMode) ? settings.themeMode : DEFAULT_THEME_MODE;
    }
    
    applyPersonalizationSettings(settings);
    return settings;
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

    loadBannerHeightPreference();
    attemptAutoInitialize();
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

// Content Cards Functions - Custom Inbox
function isContentCardsInboxOpen() {
    const overlay = document.getElementById('contentCardsOverlay');
    return overlay ? overlay.classList.contains('open') : false;
}

function openContentCardsInbox() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    subscribeToContentCards();
    const overlay = document.getElementById('contentCardsOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('content-cards-inbox-open');
    renderContentCardsInbox();
    setupContentCardsObserver();
    logActivity('Info', 'Content Cards inbox opened.', 'info');
}

function closeContentCardsInbox() {
    const overlay = document.getElementById('contentCardsOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('content-cards-inbox-open');
    teardownContentCardsObserver();
    logActivity('Info', 'Content Cards inbox closed.', 'info');
}

function toggleContentCards() {
    if (isContentCardsInboxOpen()) {
        closeContentCardsInbox();
    } else {
        openContentCardsInbox();
    }
}

function showContentCards() {
    openContentCardsInbox();
}

function hideContentCards() {
    closeContentCardsInbox();
}

function refreshContentCards() {
    if (!isInitialized) {
        logActivity('Warning', 'Please initialize the SDK first.', 'warning');
        return;
    }
    
    if (typeof brazeInstance.requestContentCardsRefresh === 'function') {
        debugLog('CARDS', 'Requesting content cards refresh...', 'api');
        brazeInstance.requestContentCardsRefresh();
        logActivity('Success', 'Content Cards refresh requested.', 'success');
    } else {
        debugLog('CARDS', 'requestContentCardsRefresh not available on this SDK version.', 'warning');
    }
}

function markAllContentCardsAsRead() {
    if (!isInitialized || contentCardsData.length === 0) {
        return;
    }
    const unreadCards = contentCardsData.filter(card => !card.viewed);
    if (unreadCards.length > 0) {
        try {
            brazeInstance.logContentCardImpressions(unreadCards);
            unreadCards.forEach(card => {
                card.viewed = true;
                contentCardsImpressionsLogged.add(card.id);
            });
            logActivity('Info', `Marked ${unreadCards.length} content cards as read.`, 'info');
        } catch (error) {
            debugLog('CARDS', `Failed to mark cards as read: ${error.message}`, 'error');
        }
    }
    updateContentCardsBadge();
    renderContentCardsInbox();
}

function subscribeToContentCards() {
    if (!brazeInstance || typeof brazeInstance.subscribeToContentCardsUpdates !== 'function') {
        debugLog('CARDS', 'Content cards subscription not supported on this SDK version.', 'warning');
        return;
    }
    if (contentCardsSubscriptionId) {
        return;
    }
    debugLog('CARDS', 'Subscribing to Content Cards updates...', 'api');
    contentCardsSubscriptionId = brazeInstance.subscribeToContentCardsUpdates((payload) => {
        handleContentCardsUpdate(payload);
    });
    const cached = brazeInstance.getCachedContentCards?.();
    if (cached && Array.isArray(cached.cards)) {
        handleContentCardsUpdate(cached);
    }
    refreshContentCards();
}

function handleContentCardsUpdate(payload) {
    const cards = payload && Array.isArray(payload.cards) ? payload.cards : [];
    contentCardsData = cards.filter(card => !card.isControl);
    contentCardsMap = new Map();
    contentCardsData.forEach(card => {
        contentCardsMap.set(card.id, card);
        if (card.viewed) {
            contentCardsImpressionsLogged.add(card.id);
        }
    });
    logActivity('Info', `Content Cards updated: ${contentCardsData.length} cards available.`, 'info');
    updateContentCardsBadge();
    if (isContentCardsInboxOpen()) {
        renderContentCardsInbox();
        setupContentCardsObserver();
    } else {
        teardownContentCardsObserver();
    }
}

function updateContentCardsBadge() {
    const badge = document.getElementById('contentCardsBadge');
    if (!badge) return;
    const unreadCount = contentCardsData.filter(card => !card.viewed).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }
}

function renderContentCardsInbox() {
    const list = document.getElementById('contentCardsList');
    const emptyState = document.getElementById('contentCardsEmptyState');
    if (!list || !emptyState) return;
    list.innerHTML = '';
    if (contentCardsData.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';
    contentCardsData.forEach(card => {
        const item = document.createElement('article');
        item.className = `content-card-item ${card.viewed ? 'viewed' : 'unread'}`;
        item.dataset.cardId = card.id;
        
        const header = document.createElement('div');
        header.className = 'content-card-item-header';
        
        const titleWrapper = document.createElement('div');
        const title = document.createElement('h4');
        title.className = 'content-card-item-title';
        title.textContent = card.title || 'Untitled message';
        titleWrapper.appendChild(title);
        
        const meta = document.createElement('div');
        meta.className = 'content-card-item-meta';
        if (!card.viewed) {
            const unreadIndicator = document.createElement('span');
            unreadIndicator.className = 'unread-indicator';
            header.appendChild(unreadIndicator);
        }
        if (card.created) {
            const createdDate = new Date(card.created);
            if (!isNaN(createdDate.getTime())) {
                const dateSpan = document.createElement('span');
                dateSpan.textContent = createdDate.toLocaleString();
                meta.appendChild(dateSpan);
            }
        }
        if (card.pinned) {
            const pinned = document.createElement('span');
            pinned.textContent = 'Pinned';
            meta.appendChild(pinned);
        }
        if (meta.childNodes.length > 0) {
            titleWrapper.appendChild(meta);
        }
        
        header.appendChild(titleWrapper);
        
        const body = document.createElement('div');
        body.className = 'content-card-item-body';
        body.textContent = card.description || card.excerpt || '';
        
        item.appendChild(header);
        item.appendChild(body);
        
        if (card.imageUrl) {
            const image = document.createElement('img');
            image.src = card.imageUrl;
            image.alt = card.title || 'Content Card image';
            item.appendChild(image);
        }
        
        if (card.extras && Object.keys(card.extras).length > 0) {
            const extras = document.createElement('div');
            extras.className = 'content-card-item-extras';
            Object.entries(card.extras).forEach(([key, value]) => {
                const chip = document.createElement('span');
                chip.textContent = `${key}: ${value}`;
                extras.appendChild(chip);
            });
            item.appendChild(extras);
        }
        
        const footer = document.createElement('div');
        footer.className = 'content-card-item-footer';
        if (card.url) {
            const link = document.createElement('a');
            link.href = card.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'content-card-link';
            link.innerHTML = `<i class="fas fa-external-link-alt"></i> Open`;
            link.addEventListener('click', (event) => {
                event.preventDefault();
                logContentCardClick(card, card.url);
            });
            footer.appendChild(link);
        }
        if (footer.childNodes.length > 0) {
            item.appendChild(footer);
        }
        
        item.addEventListener('click', (event) => {
            // avoid duplicate click handling when link clicked
            if (event.target.closest('a')) {
                return;
            }
            if (card.url) {
                logContentCardClick(card, card.url);
            }
        });
        
        list.appendChild(item);
    });
}

function setupContentCardsObserver() {
    teardownContentCardsObserver();
    const list = document.getElementById('contentCardsList');
    if (!list || contentCardsData.length === 0) return;
    const items = list.querySelectorAll('.content-card-item');
    if (items.length === 0) return;
    contentCardsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const cardId = entry.target.dataset.cardId;
            const card = contentCardsMap.get(cardId);
            if (!card || card.viewed) {
                if (contentCardsObserver) {
                    contentCardsObserver.unobserve(entry.target);
                }
                return;
            }
            logContentCardImpression(card);
            if (contentCardsObserver) {
                contentCardsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.6 });
    items.forEach(item => {
        const card = contentCardsMap.get(item.dataset.cardId);
        if (card && !card.viewed) {
            contentCardsObserver.observe(item);
        }
    });
}

function teardownContentCardsObserver() {
    if (contentCardsObserver) {
        contentCardsObserver.disconnect();
        contentCardsObserver = null;
    }
}

function logContentCardImpression(card) {
    if (!card || card.viewed) return;
    try {
        brazeInstance.logContentCardImpressions([card]);
    } catch (error) {
        debugLog('CARDS', `Failed to log impression: ${error.message}`, 'error');
    }
    card.viewed = true;
    contentCardsImpressionsLogged.add(card.id);
    const item = document.querySelector(`.content-card-item[data-card-id="${card.id}"]`);
    if (item) {
        item.classList.remove('unread');
        item.classList.add('viewed');
    }
    updateContentCardsBadge();
}

function logContentCardClick(card, url) {
    if (!card) return;
    try {
        brazeInstance.logContentCardClick(card);
    } catch (error) {
        debugLog('CARDS', `Failed to log click: ${error.message}`, 'error');
    }
    card.viewed = true;
    contentCardsImpressionsLogged.add(card.id);
    updateContentCardsBadge();
    const item = document.querySelector(`.content-card-item[data-card-id="${card.id}"]`);
    if (item) {
        item.classList.remove('unread');
        item.classList.add('viewed');
    }
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}
