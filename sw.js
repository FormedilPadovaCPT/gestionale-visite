/* ============================================================
   Service worker del Gestionale Visite — notifiche e copie dei file
   (17/09/2026 le notifiche; 17/11/2026 le copie, chieste dall'utente:
   «l'accensione delle app tramite cellulare è lentissima»)

   LA PAGINA PRINCIPALE NON SI SALVA MAI. index.html arriva sempre dalla
   rete, come prima: è lei a dire quale versione di ogni file serve
   (`x.js?v=12`), quindi una pubblicazione nuova arriva subito a tutti.
   Il timore scritto qui il 17/09 («i tecnici lavorerebbero con la
   versione di ieri») riguardava il salvataggio della pagina, che resta
   escluso.

   GLI ALTRI FILE DEL GESTIONALE (script, fogli di stile, immagini) si
   servono dalla copia sul telefono, così l'accensione non aspetta più
   una sessantina di richieste in rete (GitHub Pages li tiene in memoria
   solo 10 minuti, poi il telefono li ricontrollava uno per uno prima di
   aprire l'app). Una copia più vecchia di 10 minuti si ricontrolla in
   SOTTOFONDO: è lo stesso margine di prima, ma non blocca l'avvio.
   Un file cambiato col numero di versione nuovo nella pagina si scarica
   subito; uno cambiato senza toccare il `?v=` arriva all'apertura dopo.
   Di ogni file si tiene una copia sola (la versione vecchia si toglie).
   Non si toccano: le richieste ad altri siti (Supabase, CDN, mappe), le
   altre app sullo stesso dominio, questo file.

   Le notifiche: riceve la notifica (la decifra il browser) e la mostra;
   al tocco porta sull'app, alla pagina indicata.

   Per togliere le copie: cambiare COPIE (il vecchio nome si cancella da
   solo in «activate») o togliere il gestore «fetch». Per togliere tutto:
   una versione che in «activate» chiama self.registration.unregister().
   ============================================================ */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('gv-') && k !== COPIE) await caches.delete(k);
  await self.clients.claim();
})()));

// ── Copie dei file (17/11/2026) ──
const COPIE = 'gv-file-1';
const FRESCO_MS = 10 * 60 * 1000;   // come la cache di GitHub Pages
const DA_COPIARE = /\.(js|css|png|jpe?g|svg|webp|webmanifest)$/i;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode === 'navigate') return;   // la pagina: sempre dalla rete
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                // Supabase, CDN, mappe: non si toccano
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;   // altre app del dominio
  if (/\/sw\.js$/.test(url.pathname) || !DA_COPIARE.test(url.pathname)) return;
  e.respondWith(dallaCopia(req, e));
});

async function dallaCopia(req, e) {
  let cache;
  try { cache = await caches.open(COPIE); } catch (err) { return fetch(req); }   // spazio negato: come prima
  const salvata = await cache.match(req);
  if (salvata) {
    const eta = Date.now() - Date.parse(salvata.headers.get('date') || '');
    if (!(eta < FRESCO_MS)) e.waitUntil(aggiorna(cache, req).catch(() => {}));
    return salvata;
  }
  return aggiorna(cache, req);
}

async function aggiorna(cache, req) {
  const r = await fetch(req, { cache: 'no-cache' });   // chiede al server se è cambiato
  if (r.ok && r.type === 'basic') {
    await cache.put(req, r.clone());
    const u = new URL(req.url);
    for (const k of await cache.keys()) {           // di ogni file una copia sola
      const ku = new URL(k.url);
      if (ku.pathname === u.pathname && ku.search !== u.search) await cache.delete(k);
    }
  }
  return r;
}

// Il messaggio arriva cifrato: { titolo, testo, url, tag }. I testi li scrive il
// database e sono fissi, senza nomi di imprese o cantieri: una notifica si legge
// sulla schermata di blocco. Ogni notifica ricevuta va mostrata (iPhone toglie
// il permesso a chi non lo fa).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { testo: e.data ? e.data.text() : '' }; }
  const titolo = String(d.titolo || 'Gestionale Visite').slice(0, 120);
  e.waitUntil(self.registration.showNotification(titolo, {
    body: String(d.testo || '').slice(0, 240),
    icon: 'icona-192.png',
    badge: 'icona-notifica-96.png',
    tag: String(d.tag || 'gestionale'),
    renotify: true,
    lang: 'it',
    data: { url: typeof d.url === 'string' ? d.url : './' },
  }).then(() => ricevuta('mostrata'), (err) => ricevuta('errore', err)));
});

// Ricevuta di ritorno: il «201» del servizio di notifica dice solo che Google o Apple
// hanno preso in carico il messaggio. Che sia arrivato QUI e sia stato mostrato lo può
// dire solo questo telefono. Non deve mai far fallire la notifica: se non parte, pazienza.
const FUNZIONE = 'https://utdantrfugnmqsuujxbe.supabase.co/functions/v1/push-visite';
async function ricevuta(esito, err) {
  try {
    const iscr = await self.registration.pushManager.getSubscription();
    if (!iscr) return;
    await fetch(FUNZIONE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ azione: 'ricevuta', endpoint: iscr.endpoint, esito, errore: err ? String(err.message || err) : undefined }),
    });
  } catch (e) { /* la ricevuta è un di più */ }
}

// 23/09/2026 — Quando è il BROWSER a cambiare la sottoscrizione (scadenza, rotazione
// del servizio di notifica, reinstallazione del service worker) manda questo evento,
// che finora nessuno ascoltava: la sottoscrizione nuova restava sconosciuta al server
// finché la pagina non veniva riaperta, e intanto le notifiche andavano a un indirizzo
// morto. Qui ci si riscrive con la stessa chiave e si dice al server «cambio», con
// l'indirizzo vecchio: la riga vecchia viene sostituita, non aggiunta.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const vecchia = e.oldSubscription;
    let chiave = vecchia && vecchia.options && vecchia.options.applicationServerKey;
    if (!chiave) {
      const j = await fetch(FUNZIONE).then((r) => r.json()).catch(() => ({}));
      if (!j.chiave) return;
      chiave = daB64u(j.chiave);
    }
    const nuova = e.newSubscription || await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiave });
    await fetch(FUNZIONE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        azione: 'cambio',
        vecchio_endpoint: vecchia ? vecchia.endpoint : '',
        iscrizione: nuova.toJSON(),
        dispositivo: /Android/.test(self.navigator.userAgent || '') ? 'android' : /iPhone|iPad/.test(self.navigator.userAgent || '') ? 'iphone' : 'computer',
        origine: self.registration.scope,
        user_agent: String(self.navigator.userAgent || '').slice(0, 300),
      }),
    }).catch(() => {});
  })());
});
function daB64u(t) {
  let s = String(t).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const scope = self.registration.scope;
  let dest;
  try { dest = new URL((e.notification.data && e.notification.data.url) || './', scope); }
  catch (err) { dest = new URL('./', scope); }
  if (!dest.href.startsWith(scope)) dest = new URL('./', scope);   // mai fuori dal gestionale
  const vista = dest.searchParams.get('vista') || '';
  e.waitUntil((async () => {
    const aperte = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of aperte) {
      if (c.url.startsWith(scope)) {
        if (vista) c.postMessage({ tipo: 'apri-vista', vista });
        return c.focus();
      }
    }
    return self.clients.openWindow(dest.href);
  })());
});
