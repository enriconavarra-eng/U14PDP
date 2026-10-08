/* Service worker: cache locale per uso offline.
   Aumenta CACHE_NAME quando aggiorni i file per forzare il refresh
   sui tablet gia' installati. */
var CACHE_NAME = 'rugby-u14-pasian-v16';
var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/drive-backup.js',
  './assets/squadra-store.js',
  './assets/firebase-config.js',
  './assets/cloud-sync.js',
  './assets/eval-data.js',
  './assets/report-builder.js',
  './giocatore/index.html',
  './squadra/index.html',
  './riepilogo/index.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CORE_ASSETS);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Non mettiamo mai in cache le chiamate verso Google (auth/Drive) ne'
   verso Firebase (autenticazione/sincronizzazione dati in tempo
   reale): devono sempre andare in rete. Per tutto il resto:
   cache-first, con aggiornamento della cache in background quando
   possibile. */
self.addEventListener('fetch', function(event){
  var url = event.request.url;
  if(url.indexOf('googleapis.com') !== -1 || url.indexOf('accounts.google.com') !== -1 ||
     url.indexOf('gstatic.com') !== -1 || url.indexOf('firebaseio.com') !== -1 ||
     url.indexOf('firebaseapp.com') !== -1){
    return; // lascia passare alla rete normalmente
  }
  if(event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached){
      var networkFetch = fetch(event.request).then(function(response){
        if(response && response.ok){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){ return cached; });
      return cached || networkFetch;
    })
  );
});
