// sw.js - Secure Service Worker with IndexedDB for pagerToken

const DB_NAME = 'YellowRoseDB';
const STORE_NAME = 'pager';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME);
        };
    });
}

async function getPagerToken() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('currentToken');
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function savePagerToken(token) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(token, 'currentToken');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

// ✅ XSS Protection: Only allow relative URLs
function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('/') && !url.includes('..') && !url.includes('//');
}

self.addEventListener('push', function(event) {
    if (!event.data) return;
    
    let data;
    try {
        data = event.data.json();
    } catch {
        return;
    }
    
    const safeUrl = isSafeUrl(data.url) ? data.url : '/';
    
    const options = {
        body: data.body || 'لديك إشعار جديد',
        icon: '/assets/images/yr-icon-192.png',
        badge: '/assets/images/yr-badge.png',
        vibrate: [500, 200, 500, 200, 500],
        data: {
            url: safeUrl,
            orderId: data.orderId || 'unknown'
        },
        requireInteraction: true,
        tag: `order-ready-${data.orderId || 'unknown'}`,
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Yellow Rose 🌹', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = event.notification.data?.url;
    
    // ✅ XSS Protection
    if (!isSafeUrl(targetUrl)) return;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

self.addEventListener('pushsubscriptionchange', function(event) {
    event.waitUntil(
        (async () => {
            try {
                const pagerToken = await getPagerToken();
                if (!pagerToken) {
                    console.warn('[SW] No pagerToken in IndexedDB');
                    return;
                }
                
                const response = await fetch('/api/push/refresh-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oldEndpoint: event.oldSubscription?.endpoint || null,
                        newSubscription: event.newSubscription?.toJSON() || null,
                        pagerToken: pagerToken
                    })
                });
                
                if (!response.ok) {
                    console.error('[SW] Refresh failed:', response.status);
                }
            } catch (err) {
                console.error('[SW] pushsubscriptionchange error:', err);
            }
        })()
    );
});

self.addEventListener('message', function(event) {
    if (event.data?.type === 'SAVE_PAGER_TOKEN' && event.data?.token) {
        savePagerToken(event.data.token);
    }
});
