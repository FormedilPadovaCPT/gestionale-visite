/* ============================================================
   Service worker del Gestionale Visite — SOLO NOTIFICHE
   (17/09/2026, chiesto dall'utente)

   ⚠️ QUI NON SI METTE NIENTE IN CACHE, E NON È UNA DIMENTICANZA.
   Il gestionale è un file unico che cambia quasi ogni giorno: un
   service worker che salvasse le pagine farebbe lavorare i tecnici
   con la versione di ieri senza che nessuno se ne accorga. Per questo
   NON c'è un gestore «fetch»: il gestionale si carica dalla rete
   esattamente come prima, e ogni pubblicazione arriva subito a tutti.
   Chi un domani volesse l'uso senza linea deve prima risolvere
   l'aggiornamento delle versioni, non aggiungere una cache qui.

   Che cosa fa: riceve la notifica (la decifra il browser) e la mostra;
   al tocco porta sull'app, alla pagina indicata. Basta.

   Per toglierlo del tutto: pubblicare una versione che in «activate»
   chiama self.registration.unregister(). Il gestionale torna com'era.
   ============================================================ */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
