/* © 2026 Ανδρέας Μ. Γλεντζάκης — «Κοντά μου». Με επιφύλαξη παντός δικαιώματος. Απαγορεύεται η αντιγραφή χωρίς γραπτή άδεια. */
/* Κοντά μου — βοηθός λειτουργίας (όπως στο Δρομολόγιο)
   Ρόλος: να εγκαθίσταται η εφαρμογή στο κινητό και να ανοίγει γρήγορα.
   ΣΗΜΑΝΤΙΚΟ: σε κάθε νέα έκδοση αλλάζει ο αριθμός στη γραμμή CACHE,
   ώστε το κινητό να παίρνει αμέσως την καινούργια. */
const CACHE = "kontamou-1.34";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png", "./apple-touch-icon.png"];
// Βιβλιοθήκες με σταθερή έκδοση: φυλάγονται μία φορά
const LIBS = ["cdnjs.cloudflare.com", "www.gstatic.com"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Η ίδια η εφαρμογή: πρώτα από το διαδίκτυο (για να έρχονται οι ενημερώσεις), αλλιώς από τη μνήμη
  if (url.origin === self.location.origin){
    e.respondWith(fetch(req, {cache:"no-cache"}).then(r => { const cp = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
    return;
  }
  // Βιβλιοθήκες χάρτη και βάσης: από τη μνήμη αν υπάρχουν
  if (LIBS.includes(url.hostname)){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { const cp = n.clone(); if (n.ok) caches.open(CACHE).then(c => c.put(req, cp)); return n; })));
  }
  // Όλα τα άλλα (βάση δεδομένων, πλακίδια χάρτη, σύνδεση): κανονικά, χωρίς παρέμβαση
});
