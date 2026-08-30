// Минимальный service worker — нужен, чтобы браузер разрешил
// "Установить приложение" / "Добавить на экран Домой".
// Кэш умышленно не делаем агрессивным, чтобы не мешать обновлениям чата.

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  self.clients.claim();
});

self.addEventListener("fetch", () => {
  // проксируем всё как есть, без офлайн-кэша сообщений
});
