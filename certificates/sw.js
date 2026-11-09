/* Akhnaton Certificates – offline shell. Bump VERSION with every upload. Shares the origin with Akhnaton Devices, so only its own caches are touched. */
var VERSION = 'akh-certs-v51';
var SHELL = ['./', './index.html', './app.css', './certs.css', './app.js', './config.js', './manifest.webmanifest', './logo-en-light.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('akh-certs-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; /* server, Microsoft and CDN calls go straight to the network */
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(VERSION).then(function (cc) { cc.put(e.request, c); }); return r; }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('./index.html'); }); }));
});
