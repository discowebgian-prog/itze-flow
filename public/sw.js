// Itzé Flow · service worker SOLO para avisos (notificaciones con la app cerrada).
// No guarda la app en caché: así siempre se ve la última versión publicada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data.json();
  } catch (_) {}
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Itzé Flow', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: d.url || '/' },
      tag: d.tag || 'itze-flow-' + Date.now(),
      // Buen día de las 8:00: reemplaza al de ayer y avisa igual (renotify); queda hasta que se cierra
      renotify: !!d.tag,
      requireInteraction: !!d.sticky,
      vibrate: d.badge ? [200, 100, 200, 100, 200] : [120, 60, 120],
    });
    // Avisos de Equipo: numerito en el ícono con los avisos sin ver (como Limpieza; se borra al abrir)
    if (d.badge) {
      try {
        const n = (await self.registration.getNotifications()).length;
        if (self.navigator.setAppBadge) await self.navigator.setAppBadge(n || undefined);
      } catch (_) {}
    }
  })());
});

// Tocar el aviso abre (o trae al frente) la app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || '/');
    })
  );
});
