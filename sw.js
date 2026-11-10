/* © 2026 Ανδρέας Μ. Γλεντζάκης — «Κοντά μου». Με επιφύλαξη παντός δικαιώματος. Απαγορεύεται η αντιγραφή χωρίς γραπτή άδεια. */
/* Κοντά μου — βοηθός λειτουργίας (όπως στο Δρομολόγιο)
   Ρόλος: να εγκαθίσταται η εφαρμογή στο κινητό και να ανοίγει γρήγορα.
   ΣΗΜΑΝΤΙΚΟ: σε κάθε νέα έκδοση αλλάζει ο αριθμός στη γραμμή CACHE,
   ώστε το κινητό να παίρνει αμέσως την καινούργια. */
/* ΚΑΝΟΝΑΣ GlenApps (10/11/2026): η εφαρμογή ανοίγει αμέσως από τη συσκευή· δίκτυο το πολύ 3″ — ΜΗΝ αφαιρεθεί.
   gaNet(δίκτυο, αποθήκη, συμβάν): αν το δίκτυο δεν απαντήσει σε 3″ και υπάρχει αποθηκευμένο αντίγραφο, δίνεται αυτό
   (το δίκτυο συνεχίζει στο παρασκήνιο και ενημερώνει την αποθήκη)· μετά από καθυστέρηση, για 30″ όλα κατευθείαν από τη συσκευή.
   Σφάλμα διακομιστή (5xx) δεν αντικαθιστά το αποθηκευμένο. Οι αναβαθμίσεις έρχονται όπως πριν (νέο όνομα αποθήκης σε κάθε έκδοση). */
var GA_MS=3000,gaSlow=0;
function gaNet(net,fromCache,ev){var p=Promise.resolve(net);try{ev&&ev.waitUntil&&ev.waitUntil(p.catch(function(){}))}catch(x){}
  function fc(){try{return Promise.resolve(fromCache()).catch(function(){})}catch(x){return Promise.resolve()}}
  if(Date.now()<gaSlow)return fc().then(function(c){return c||p});
  return new Promise(function(ok){var done=false,t;function fin(r){if(!done){done=true;clearTimeout(t);ok(r)}}
    t=setTimeout(function(){fc().then(function(c){if(c){gaSlow=Date.now()+30000;fin(c)}})},GA_MS);
    p.then(function(r){if(r&&r.status>=500)fc().then(function(c){fin(c||r)});else fin(r)},function(){fc().then(function(c){fin(c||Response.error())})});});}
const CACHE = "kontamou-1.81";
const SHELL = ["./", "./index.html","./plaisio.js", "./koino/glenread-apostoli.js", "./metafora-rythmisi.js", "./metafora-lipsi.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png", "./apple-touch-icon.png", "./othoni-enarxis.js", "./othoni-enarxis.webp", "./pineza-g.png", "./lang-en.js"];
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
    e.respondWith(gaNet(fetch(req, {cache:"no-cache"}).then(r => { const cp = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      ,() => caches.match(req).then(r => r || caches.match("./index.html")),e));
    return;
  }
  // Βιβλιοθήκες χάρτη και βάσης: από τη μνήμη αν υπάρχουν
  if (LIBS.includes(url.hostname)){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { const cp = n.clone(); if (n.ok) caches.open(CACHE).then(c => c.put(req, cp)); return n; })));
  }
  // Όλα τα άλλα (βάση δεδομένων, πλακίδια χάρτη, σύνδεση): κανονικά, χωρίς παρέμβαση
});
