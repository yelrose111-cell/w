self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/assets/images/yr-icon-192.png',
            badge: '/assets/images/yr-badge.png',
            vibrate: [500, 200, 500, 200, 500],
            data: {
                url: data.url,
                orderId: data.orderId
            },
            requireInteraction: true,
            tag: `order-ready-${data.orderId}`,
            renotify: true
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

self.addEventListener('pushsubscriptionchange', function(event) {
    event.waitUntil(
        fetch('/api/push/refresh-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
                newSubscription: event.newSubscription ? event.newSubscription.toJSON() : null,
                // pagerToken is needed here, which is a bit tricky for standard pushsubscriptionchange
                // but usually handled by the client if it's open, or stored in IndexedDB.
                // We'll leave it simple for now, the UI will re-register on load anyway.
            })
        })
    );
});
