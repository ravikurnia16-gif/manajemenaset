/* Service Worker for Push Notifications — Sarpras */

self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();

        const options = {
            body: data.body || '',
            icon: data.icon || '/Sarpras.jpeg',
            badge: data.badge || '/Sarpras.jpeg',
            tag: data.tag || 'sarpras-notification',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            data: {
                url: data.data?.url || '/'
            },
            actions: [
                { action: 'open', title: 'Buka' },
                { action: 'close', title: 'Tutup' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Sarpras', options)
        );
    } catch (e) {
        console.error('[SW] Push parse error:', e);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If there's already a tab open, focus it and navigate
            for (const client of clientList) {
                if ('focus' in client) {
                    client.focus();
                    client.navigate(urlToOpen);
                    return;
                }
            }
            // Otherwise open a new tab
            return clients.openWindow(urlToOpen);
        })
    );
});

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});
