// ============================================
// sw.js — Service Worker for Yellow Rose
// ============================================
// المهام:
// 1. استقبال إشعارات الـ Push وعرضها
// 2. معالجة النقر على الإشعارات (مع حماية XSS)
// 3. تخزين الـ pagerToken في IndexedDB (للتطبيق الذكي)
// 4. معالجة تحديث الاشتراكات تلقائياً
// ============================================

// ثوابت التطبيق
const WEBSITE_URL = 'https://yelrose2026.vercel.app';
const DB_NAME = 'YellowRoseDB';
const STORE_NAME = 'pager';

// ============================================
// 1. IndexedDB Helpers (لتخزين الـ token)
// ============================================
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

// ============================================
// 2. حماية XSS للروابط
// ============================================
function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // اسمح فقط بالروابط النسبية أو روابط الموقع الرسمي
    return url.startsWith('/') || url.startsWith(WEBSITE_URL);
}

// ============================================
// 3. استقبال الإشعارات
// ============================================
self.addEventListener('push', function(event) {
    if (!event.data) return;
    
    let data;
    try {
        data = event.data.json();
    } catch {
        return;
    }
    
    // حماية XSS: تحقق من أن الرابط آمن
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
        tag: `order-${data.orderId || 'unknown'}`,
        renotify: true,
        // أزرار الإجراءات (للمتصفحات المدعومة)
        actions: [
            {
                action: 'open',
                title: 'فتح'
            },
            {
                action: 'website',
                title: 'زيارة الموقع 🌸'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Yellow Rose ✨', options)
    );
});

// ============================================
// 4. معالجة النقر على الإشعارات
// ============================================
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    let targetUrl = event.notification.data?.url;
    
    // زر "زيارة الموقع"
    if (event.action === 'website') {
        targetUrl = WEBSITE_URL;
    }
    
    // حماية XSS: تحقق من الرابط
    if (!isSafeUrl(targetUrl)) {
        targetUrl = '/';
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // البحث عن نافذة مفتوحة بنفس الرابط
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // إذا لا توجد، افتح نافذة جديدة
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ============================================
// 5. معالجة تحديث الاشتراكات تلقائياً
// ============================================
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

// ============================================
// 6. استقبال الرسائل من الصفحة والتحديث التلقائي
// ============================================
self.addEventListener('message', function(event) {
    if (event.data?.type === 'SAVE_PAGER_TOKEN' && event.data?.token) {
        savePagerToken(event.data.token);
    }
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// تفعيل النسخة الجديدة فوراً للعملاء النشطين
self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});
