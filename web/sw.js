/* HY CORE — Service Worker: يحفظ واجهة التطبيق فقط، والبيانات دائماً من الخادم */
const CACHE = "hycore-shell-v1"; // ارفع الرقم في كل تحديث
const SHELL = ["app.html", "offline.html", "css/hy.css?v=1", "js/config.js?v=1", "js/core.js?v=1", "js/api-live.js?v=1", "js/api-demo.js?v=1", "js/app.js?v=1",
  "js/views-admin.js?v=1", "js/views-content.js?v=1", "js/views-learn.js?v=1", "img/logo-dark.png", "img/logo-light.png", "img/mark.png", "img/favicon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Supabase وBunny دائماً من الشبكة
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(url.pathname.endsWith("app.html") ? "app.html" : "offline.html").then((r) => r || caches.match("offline.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
    if (res.ok && /\.(css|js|png|svg|woff2)$/.test(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
