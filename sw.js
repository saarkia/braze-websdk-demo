// Import Braze service worker for push notifications
// This must be the first thing in the file
importScripts('braze-service-worker.js');

// Braze WebSDK Demo Service Worker
const CACHE_NAME = 'braze-demo-v2';
const urlsToCache = [
    '/index.html',
    '/styles.css',
    '/script.js'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Caching resources...');
                return cache.addAll(urlsToCache).catch(err => {
                    console.error('Cache addAll failed:', err);
                });
            })
            .catch(function(error) {
                console.error('Failed to open cache:', error);
            })
    );
    // skipWaiting is called by Braze service worker
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache (better for development)
self.addEventListener('fetch', function(event) {
    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                // Clone the response
                const responseToCache = response.clone();
                
                // Only cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });
                }
                
                return response;
            })
            .catch(function() {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});

// Push event - handle push notifications
self.addEventListener('push', function(event) {
    console.log('Push event received:', event);
    
    let notificationData = {
        title: 'Braze WebSDK Demo',
        body: 'You have a new message!',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%239d4edd"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%239d4edd"/></svg>',
        tag: 'braze-demo',
        requireInteraction: false,
        actions: [
            {
                action: 'view',
                title: 'View',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239d4edd"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23dc3545"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
            }
        ]
    };
    
    // Try to parse push data if available
    if (event.data) {
        try {
            const pushData = event.data.json();
            notificationData = { ...notificationData, ...pushData };
        } catch (error) {
            console.warn('Failed to parse push data:', error);
            // Use text data if JSON parsing fails
            if (event.data.text()) {
                notificationData.body = event.data.text();
            }
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            actions: notificationData.actions,
            data: {
                url: notificationData.url || '/',
                timestamp: Date.now()
            }
        })
    );
});

// Notification click event
self.addEventListener('notificationclick', function(event) {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function(clientList) {
            // Check if there's already a window/tab open with the target URL
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // If no existing window/tab, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Background sync for offline data
self.addEventListener('sync', function(event) {
    if (event.tag === 'braze-data-sync') {
        event.waitUntil(
            // Handle background sync for Braze data
            syncBrazeData()
        );
    }
});

async function syncBrazeData() {
    try {
        // This would typically sync any pending Braze data
        // when the device comes back online
        console.log('Syncing Braze data in background...');
        
        // Send message to main thread if needed
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BRAZE_SYNC_COMPLETE',
                timestamp: Date.now()
            });
        });
    } catch (error) {
        console.error('Failed to sync Braze data:', error);
    }
}

// Message event - communication with main thread
self.addEventListener('message', function(event) {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Error handling
self.addEventListener('error', function(event) {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', function(event) {
    console.error('Service Worker unhandled rejection:', event.reason);
    event.preventDefault();
});

