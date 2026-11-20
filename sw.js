// Service worker for RMY Pro: lets notifications show even when the app is closed or the phone is locked.
// No caching here on purpose, so the app always loads the latest index.html.

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

// Chrome only offers "install" (and shows the install prompt / launch screen) for apps whose
// service worker handles fetch events. This pass-through keeps everything network-only, so nothing is cached.
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request));
});

// Tapping a notification focuses the app and opens the section it belongs to.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var view = (e.notification.data && e.notification.data.view) || 'home';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          c.postMessage({ type: 'open-view', view: view });
          return c.focus();
        }
      }
      return self.clients.openWindow('./#' + view);
    })
  );
});
