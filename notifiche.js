/* ============================================================
   NOTIFICHE SUL TELEFONO E APP INSTALLABILE
   (17/09/2026, chiesto dall'utente)

   Il gestionale si può aggiungere alla schermata Home (manifest +
   sw.js) e chi vuole attiva le notifiche SU QUEL DISPOSITIVO: nuovo
   incarico, avviso del coordinatore, risposta dell'ufficio a una
   segnalazione, fattura pagata; al coordinatore anche fattura da
   approvare e nuovo cantiere critico.

   Regole tenute ferme:
   · si AFFIANCANO alle mail, non le sostituiscono: ognuno le attiva
     sul proprio telefono e può non farlo;
   · il testo è fisso e senza nomi (lo scrive il database): una
     notifica si legge sulla schermata di blocco;
   · il service worker NON mette niente in cache (vedi sw.js);
   · l'iscrizione è legata all'account con cui si è entrati: la salva
     la funzione push-visite dopo aver verificato l'accesso. Se sullo
     stesso telefono entra un'altra persona, l'iscrizione passa a lei.

   Su iPhone le notifiche arrivano SOLO se l'app è stata aggiunta alla
   Home (è una regola di Apple): il riquadro lo spiega.

   Script classico: usa window.sb, window.S e window.toast.
   ============================================================ */

(function () {
  const FUNZIONE = 'https://utdantrfugnmqsuujxbe.supabase.co/functions/v1/push-visite';
  const $ = (id) => document.getElementById(id);
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));

  const ua = navigator.userAgent || '';
  const iPhone = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installata = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const dispositivo = iPhone ? 'iphone' : /Android/.test(ua) ? 'android' : /Mobi/.test(ua) ? 'altro' : 'computer';
  const supportate = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  let registrazione = null;
  let installaEvento = null;   /* Android/Chrome: l'invito a installare, da mostrare su un nostro pulsante */
  let riallineata = false;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=2').then((r) => { registrazione = r; }).catch((e) => console.warn('[notifiche] service worker:', e));
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data && ev.data.tipo === 'apri-vista') apriVista(ev.data.vista);
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installaEvento = e; disegna().catch(() => {}); });
  window.addEventListener('appinstalled', () => { installaEvento = null; disegna().catch(() => {}); });

  /* dalla notifica alla pagina giusta: ?vista=incarichi all'apertura, o il messaggio del service worker */
  function apriVista(vista) {
    if (!/^[a-z]+$/.test(String(vista || ''))) return;
    let tentativi = 0;
    const prova = () => {
      const b = document.querySelector(`nav button[data-view="${vista}"]`);
      if (window.S && window.S.user && b && b.style.display !== 'none') { b.click(); return; }
      if (++tentativi < 120) setTimeout(prova, 500);   /* aspetta l'accesso, fino a un minuto */
    };
    prova();
  }
  try {
    const v = new URLSearchParams(location.search).get('vista');
    if (v) { apriVista(v); history.replaceState(null, '', location.pathname + location.hash); }
  } catch (e) { /* un indirizzo strano non ferma l'app */ }

  const daB64u = (t) => {
    let s = String(t).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  };

  async function chiama(corpo) {
    const { data } = await window.sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) throw new Error('accedi prima al gestionale');
    const r = await fetch(FUNZIONE, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ('errore ' + r.status));
    return j;
  }

  async function iscrizioneAttuale() {
    if (!supportate) return null;
    const reg = registrazione || await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  /* Si iscrive e lo dice al server. Se il server non la salva, il browser non
     deve credersi iscritto: si disiscrive e si segnala. */
  async function sottoscrivi() {
    const reg = registrazione || await navigator.serviceWorker.ready;
    let iscr = await reg.pushManager.getSubscription();
    if (!iscr) {
      const j = await (await fetch(FUNZIONE)).json();
      if (!j.chiave) throw new Error('chiave delle notifiche non disponibile');
      iscr = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: daB64u(j.chiave) });
    }
    try {
      await chiama({ azione: 'iscrivi', iscrizione: iscr.toJSON(), dispositivo });
    } catch (e) {
      await iscr.unsubscribe().catch(() => {});
      throw e;
    }
    try { localStorage.setItem('visite.notifiche.attivateUnaVolta', '1'); } catch (e) {}
    return iscr;
  }

  /* ⚠️ 18/09/2026 - La sottoscrizione sparisce, il permesso no.
     Sul telefono dell'utente il riquadro tornava a chiedere «Attiva» a ogni
     apertura: il browser perde la sottoscrizione (dati del sito ripuliti,
     service worker reinstallato) mentre il permesso resta concesso. Se il
     permesso c'è, non si chiede niente: ci si riscrive in silenzio. */
  async function riprendiInSilenzio() {
    if (!supportate || Notification.permission !== 'granted') return null;
    try { return await sottoscrivi(); }
    catch (e) { console.warn('[notifiche] riscrizione in silenzio:', e.message || e); return null; }
  }

  async function attiva(btn) {
    btn.disabled = true;
    try {
      const permesso = await Notification.requestPermission();
      if (permesso !== 'granted') { avviso('Permesso non concesso: le notifiche restano spente su questo dispositivo.', 'err'); return; }
      await sottoscrivi();
      avviso('Notifiche attive su questo dispositivo. Prova con «Mandami una prova».', 'ok');
    } catch (e) {
      avviso('Notifiche non attivate: ' + (e.message || e), 'err');
    } finally {
      btn.disabled = false;
      disegna().catch(() => {});
    }
  }

  async function disattiva(btn) {
    btn.disabled = true;
    try {
      const iscr = await iscrizioneAttuale();
      if (iscr) {
        await chiama({ azione: 'cancella', endpoint: iscr.endpoint }).catch(() => {});
        await iscr.unsubscribe();
      }
      try { localStorage.removeItem('visite.notifiche.attivateUnaVolta'); } catch (e) {}
      avviso('Notifiche spente su questo dispositivo.', 'ok');
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); } finally { btn.disabled = false; disegna().catch(() => {}); }
  }

  /* La prova non si ferma a «spedita»: aspetta la ricevuta di ritorno di QUESTO dispositivo
     (la manda il service worker quando la notifica arriva) e scrive nel riquadro che cosa è
     successo davvero. «Spedita» e «arrivata» sono due fatti diversi. */
  let esitoProva = '';
  async function prova(btn) {
    btn.disabled = true;
    try {
      const iscr = await iscrizioneAttuale();
      const endpoint = iscr && iscr.endpoint;
      const prima = endpoint ? ((await chiama({ azione: 'stato', endpoint }).catch(() => ({}))).questo || {}).ultima_ricezione_il : null;
      const j = await chiama({ azione: 'prova' });
      if (!j.consegnate) {
        esitoProva = '&#9888; La prova non è stata presa in carico dal servizio di notifica: spegni e riattiva le notifiche su questo dispositivo.';
        return;
      }
      esitoProva = '&#8987; Prova spedita: aspetto la conferma da questo dispositivo…';
      if ($('ntf-esito')) { $('ntf-esito').innerHTML = esitoProva; $('ntf-esito').style.display = ''; }
      let q = null;
      for (let i = 0; i < 8 && endpoint; i++) {
        await new Promise((ok) => setTimeout(ok, 2500));
        q = (await chiama({ azione: 'stato', endpoint }).catch(() => ({}))).questo || null;
        if (q && q.ultima_ricezione_il && q.ultima_ricezione_il !== prima) break;
        q = null;
      }
      if (q && q.ultima_ricezione_esito === 'mostrata') {
        esitoProva = '&#9989; <b>Questo dispositivo ha ricevuto la notifica e l\'ha mostrata.</b> Se non la vedi, è il dispositivo che la nasconde: abbassa la tendina delle notifiche; poi controlla in Impostazioni &rarr; Notifiche che quelle di <b>Chrome</b> (o dell\'app <b>Visite</b>) siano attive e non «silenziose», e che non sia acceso «Non disturbare».';
      } else if (q) {
        esitoProva = '&#9888; La notifica è arrivata a questo dispositivo ma <b>non è stata mostrata</b>: ' + String(q.ultima_ricezione_esito || '').replace(/[<>&]/g, ' ') + '. Segnalalo alla segreteria.';
      } else {
        esitoProva = '&#9888; La prova è partita, ma <b>questo dispositivo non ha ancora confermato di averla ricevuta</b>. Quasi sempre è una modalità del telefono che ferma le notifiche: <b>modalità relax, Non disturbare, modalità riposo o risparmio energetico</b>. Toglila e riprova. Se non basta, togli le restrizioni di batteria a Chrome (Impostazioni &rarr; App &rarr; Chrome &rarr; Batteria &rarr; «Senza restrizioni»).';
      }
    } catch (e) { esitoProva = '&#9888; Prova non spedita: ' + String(e.message || e).replace(/[<>&]/g, ' '); } finally { btn.disabled = false; disegna().catch(() => {}); }
  }

  /* lo stesso telefono, un'altra persona: l'iscrizione segue chi è entrato adesso. Una volta per sessione. */
  async function riallinea(iscr) {
    if (riallineata || !iscr) return;
    riallineata = true;
    try { await chiama({ azione: 'iscrivi', iscrizione: iscr.toJSON(), dispositivo }); } catch (e) { console.warn('[notifiche] riallineamento:', e.message || e); }
  }

  async function disegna() {
    const box = $('dash-notifiche');
    if (!box || !window.sb || !(window.S && window.S.user)) return;
    const stile = 'font-size:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-radius:10px;background:#fff;border:1px solid #eee';
    const installa = installaEvento && !installata ? '<button class="btn-outline btn-sm" id="ntf-installa">&#128242; Installa l\'app</button>' : '';
    let html = '';
    if (iPhone && !installata) {
      html = `<div style="${stile}"><span style="flex:1;min-width:220px">&#128242; <b>Metti il gestionale sulla Home dell'iPhone</b>: tocca <b>Condividi</b> (il quadrato con la freccia) e poi <b>«Aggiungi alla schermata Home»</b>. Aprendolo da lì potrai attivare anche le <b>notifiche</b>.</span></div>`;
    } else if (!supportate) {
      html = installa ? `<div style="${stile}"><span style="flex:1">Puoi installare il gestionale come app su questo dispositivo.</span>${installa}</div>` : '';
    } else if (Notification.permission === 'denied') {
      html = `<div style="${stile}"><span style="flex:1;min-width:220px">&#128277; Le notifiche sono <b>bloccate</b> per questo sito: si riattivano dalle impostazioni del browser (il lucchetto accanto all'indirizzo).</span>${installa}</div>`;
    } else {
      let iscr = await iscrizioneAttuale().catch(() => null);
      if (!iscr) iscr = await riprendiInSilenzio();
      if (iscr && Notification.permission === 'granted') {
        riallinea(iscr);
        html = `<div style="${stile};color:#2d7a06"><span style="flex:1;min-width:200px">&#128276; Notifiche <b>attive</b> su questo dispositivo.</span>
          <button class="btn-outline btn-sm" id="ntf-prova">Mandami una prova</button>
          <button class="btn-outline btn-sm" id="ntf-spegni">Spegni</button>${installa}
          <div id="ntf-esito" style="flex-basis:100%;color:#333;line-height:1.45;${esitoProva ? '' : 'display:none'}">${esitoProva}</div></div>`;
      } else {
        /* Il permesso e' tornato daccapo, ma su questo telefono le notifiche erano
           state attivate: non le abbiamo spente noi, le ha cancellate il telefono
           insieme ai dati del sito. Dirlo, invece di far finta che sia la prima volta. */
        let riattiva = false;
        try { riattiva = Notification.permission === 'default' && localStorage.getItem('visite.notifiche.attivateUnaVolta') === '1'; } catch (e) {}
        html = riattiva
          ? `<div style="${stile}"><span style="flex:1;min-width:220px">&#128276; Le notifiche su questo dispositivo <b>si sono spente</b>: il telefono ha cancellato i dati del sito, e con loro il permesso. Succede quando il browser è impostato per cancellare i dati alla chiusura${installata ? '' : ", oppure quando il gestionale si apre dal browser invece che dall'app installata"}.</span>
          <button class="btn-primary btn-sm" id="ntf-attiva">Riattiva le notifiche</button>${installa}</div>`
          : `<div style="${stile}"><span style="flex:1;min-width:220px">&#128276; Vuoi sapere subito quando ti arriva un <b>incarico</b>, un <b>avviso</b> o una <b>risposta dell'ufficio</b>? Le mail restano: questo è in più, e vale per questo dispositivo.</span>
          <button class="btn-primary btn-sm" id="ntf-attiva">Attiva le notifiche</button>${installa}</div>`;
      }
    }
    box.innerHTML = html;
    box.style.display = html ? '' : 'none';
    const su = (id, fn) => { const b = $(id); if (b) b.onclick = (ev) => fn(ev.currentTarget); };
    su('ntf-attiva', attiva); su('ntf-spegni', disattiva); su('ntf-prova', prova);
    su('ntf-installa', async () => { if (installaEvento) { installaEvento.prompt(); await installaEvento.userChoice.catch(() => {}); installaEvento = null; disegna().catch(() => {}); } });
  }

  window.notificheBox = disegna;
})();
