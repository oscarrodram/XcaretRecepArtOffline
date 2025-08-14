const CACHE_NAME = "xcaret-recep-cache-v1";

// Rutas exactas (¡todas con "/" inicial!)
const OFFLINE_RESOURCES = [
  "/", // raíz
  "/index.html",
  "/manifest.json",
  "/Component.js",
  // Vistas
  "/view/ObjectPage.view.xml",
  "/view/Main.view.xml",
  "/view/App.view.xml",
  // Fragmentos
  "/fragments/AddToTable.fragment.xml",
  "/fragments/MaterialImage.fragment.xml",
  // Otros archivos JS/CSS/i18n/model/controlador
  "/controller/ObjectPage.controller.js",
  "/model/models.js",
  "/model/SettingsModel.js"
];

// Instala y cachea los recursos
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_RESOURCES);
    })
  );
  self.skipWaiting();
});

// Activa y limpia cachés antiguas
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Intercepta peticiones y sirve desde caché si existe, si no, va a red
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});