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


// ---------- Background Sync: upload the latest copy from the outbox even when the app is closed ----------
// The page writes the latest state (and the Drive token) into IndexedDB "rmy-outbox" on every save.
// The browser fires 'sync' when the network is back. Items that need the page (expired token, or Drive
// changed by another device) are left in the outbox; the page merges and uploads them when it opens.
var OB_DB = 'rmy-outbox';
function obOpen() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(OB_DB, 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('q', { keyPath: 'id' }); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}
function obAll() {
  return obOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var q = db.transaction('q').objectStore('q').getAll();
      q.onsuccess = function () { db.close(); res(q.result || []); };
      q.onerror = function () { db.close(); rej(q.error); };
    });
  });
}
function obDel(id) {
  return obOpen().then(function (db) {
    return new Promise(function (res, rej) {
      var tx = db.transaction('q', 'readwrite');
      tx.objectStore('q').delete(id);
      tx.oncomplete = function () { db.close(); res(); };
      tx.onerror = function () { rej(tx.error); };
    });
  });
}

// returns 'done' when uploaded, 'page' when the page must handle it, throws when we should retry later
function pushMain(it) {
  return fetch('https://www.googleapis.com/drive/v3/files/' + it.fileId + '?fields=version,trashed', {
    headers: { Authorization: 'Bearer ' + it.token }, cache: 'no-store'
  }).then(function (m) {
    if (m.status === 401 || m.status === 403 || m.status === 404) return 'page';
    if (!m.ok) throw new Error('retry');
    return m.json().then(function (j) {
      // another device changed the file since this copy was made: don't overwrite it, let the app merge
      if (j.trashed || String(j.version) !== String(it.baseVersion)) return 'page';
      return fetch('https://www.googleapis.com/upload/drive/v3/files/' + it.fileId + '?uploadType=media&fields=version', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + it.token, 'Content-Type': 'application/json' },
        body: it.body, cache: 'no-store'
      }).then(function (p) {
        if (p.status === 401 || p.status === 403) return 'page';
        if (!p.ok) throw new Error('retry');
        return 'done';
      });
    });
  });
}
function pushCards(it) {
  return fetch('https://www.googleapis.com/upload/drive/v3/files/' + it.fileId + '?uploadType=media&fields=id', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + it.token, 'Content-Type': 'application/json' },
    body: it.body, cache: 'no-store'
  }).then(function (p) {
    if (p.status === 401 || p.status === 403 || p.status === 404) return 'page';
    if (!p.ok) throw new Error('retry');
    return 'done';
  });
}
function flushOutbox() {
  return obAll().then(function (items) {
    var retry = false;
    return items.reduce(function (chain, it) {
      return chain.then(function () {
        var job = it.id === 'main' ? pushMain(it) : pushCards(it);
        return job.then(function (r) { return r === 'done' ? obDel(it.id) : null; })
          .catch(function () { retry = true; });
      });
    }, Promise.resolve()).then(function () {
      if (retry) throw new Error('retry later');
    });
  });
}
self.addEventListener('sync', function (e) {
  if (e.tag === 'rmy-sync') e.waitUntil(flushOutbox());
});
