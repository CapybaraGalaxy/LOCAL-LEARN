const CACHE_NAME = 'locallearn-v2';
const ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './js/app.js',
    './js/db.js',
    './js/format.js',
    './js/editor.js',
    './js/engine.js',
    './js/views.js',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});