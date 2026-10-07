/* ============================================================
   VESTE V2 (03/10/2026) — nata come anteprima della sola segreteria, dalla
   sera dello stesso giorno è LA VESTE DI TUTTI (deciso dall'utente dopo
   averla guardata ruolo per ruolo).

   La proposta di design «Gestionale Visite v2» è stata disegnata sulla
   pagina pubblica, senza conoscere ruoli e regole. Questa è la sua
   riprogettazione dentro l'app vera, come SECONDA VESTE dello stesso codice:
   stessa app, stesso database, stesse funzioni. Non è una seconda app.

   CHI LA VEDE. Chiunque sia collegato, col menu e le pagine del SUO ruolo
   (quello vero dell'accesso: tecnico, coordinatore, segreteria, Direttore,
   Presidenza, consigliere). Se questo file non si carica, o qui dentro qualcosa va
   storto, l'app di prima continua a funzionare (ogni ingresso è protetto da
   try/catch e non cambia niente finché la veste è spenta).

   CHE COSA FA:
     · menu per ruolo: Oggi · Nuova visita · Visite · Cantieri · Rubrica ·
       Statistiche, a destra Ufficio (segreteria) o Coordinamento (coordinatore); Direzione, Presidenza e consiglieri hanno il menu corto;
     · pagina di apertura per ruolo (decise dall'utente): segreteria su
       Ufficio › Scrivania, tecnico e coordinatore su Oggi, Direttore su
       Direzione, Presidenza sulla sua pagina, consiglieri sulla Mappa (senza calendario);
     · «Oggi»: il riepilogo del prototipo sui dati veri — bozze aperte,
       rientri scaduti e incarichi da evadere con «Avvia visita», azioni
       rapide, obiettivo del mese, avvisi — e sotto il cruscotto di sempre con
       la mappa. Scadenze e incarichi restano anche pagine a sé nel menu;
     · «Ufficio»: gli strumenti della pagina Segreteria raggruppati con un
       menu a lato, più una Scrivania con i numeri di ciò che aspetta;
     · «Vedi come…» (SOLO segreteria): vede menu e pagine degli altri ruoli.
       Cambia ciò che si vede, NON i permessi: i dati restano quelli che il
       database dà alla segreteria.

     · il verbale in TRE MOMENTI (prima di entrare, in cantiere, a fine
       visita): i passi di oggi raggruppati, stessi campi e stessi pulsanti.

   CHE COSA NON FA: non salva niente da sola, non cambia Bozza e Definitivo,
   non sposta dati, non tocca le regole di chiusura. Sono paletti dell'utente.

   Agganci in index.html: due righe in navTo() — vesteV2.prima(view) può
   cambiare la pagina di destinazione, vesteV2.dopo(view) dice quali altre
   pagine mostrare sotto — e lo <script> che carica questo file.
   ============================================================ */
(function () {
  'use strict';
  // (04/10/2026, deciso dall'utente) UNA VESTE SOLA: niente più «↩ Veste di prima» e niente codice per tornare indietro.
  // La vecchia scelta salvata nei browser ('gv-veste' = 'classica') si cancella al primo accesso.
  const CHIAVE_RUOLO = 'gv-v2-ruolo';     // sessionStorage: il ruolo di «Vedi come…» (vale solo per la segreteria)
  const SEGRETERIA = 'cptpd@did.formedilpadova.it';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leggi = (st, k) => { try { return st.getItem(k); } catch (_e) { return null; } };
  const scrivi = (st, k, v) => { try { v == null ? st.removeItem(k) : st.setItem(k, v); } catch (_e) { /* archivio del browser non disponibile */ } };

  /* (03/10/2026, corretto dall'utente) «Nuova visita» sta subito dopo «Oggi», prima di «Visite», come nell'app di oggi:
     resta arancione, ma non in fondo a destra. */
  /* (03/10/2026, corretto dall'utente) Anche le SCADENZE tornano una pagina a sé, e in «Oggi» resta la mappa dei
     cantieri in monitoraggio com'era: «Oggi» è il cruscotto di sempre, con in più le bozze aperte in cima. */
  /* (03/10/2026, corretto dall'utente) Per il tecnico gli INCARICHI tornano una pagina a sé, con la voce nel menu e il
     numero che lampeggia quando ce ne sono di nuovi, come nell'app di oggi: dentro «Oggi» si perdevano. */
  /* (03/10/2026 sera, deciso dall'utente dopo due prove) NEL MENU STANNO SOLO LE PAGINE. Asseverazione e Servizi CPT sono
     riquadri di «Oggi» (blu e verde, come i pulsanti di sempre); per chi è di sola lettura Segnala, QR e Servizi sono
     pulsanti sulla pagina che vede per prima. Né tendina «Altre app», né voci-azione nel menu: provate, scartate. */
  const RUOLI = {
    segreteria:   { nome: 'Segreteria (tu)', menu: ['dashboard', 'form', 'lista', 'cantieri', 'rubrica', 'statistiche', '|', 'segreteria'], apre: 'segreteria' },
    tecnico:      { nome: 'Tecnico',         menu: ['dashboard', 'form', 'lista', 'cantieri', 'rubrica', 'scadenze', 'incarichi', 'statistiche'], apre: 'dashboard' },
    coordinatore: { nome: 'Coordinatore',    menu: ['dashboard', 'form', 'lista', 'cantieri', 'rubrica', 'scadenze', 'incarichi', 'statistiche', '|', 'admin'], apre: 'dashboard' },
    direttore:    { nome: 'Direttore',       menu: ['direzione', 'statistiche', 'dashboard', 'appuntamenti'], apre: 'direzione', lettura: true },
    // il calendario è del solo Direttore (deciso dall'utente il 03/10/2026): la Presidenza vede quello che le compete
    presidenza:   { nome: 'Presidenza',      menu: ['direzione', 'statistiche', 'dashboard'], apre: 'direzione', lettura: true },
    // (03/10/2026, corretto dall'utente dopo aver guardato l'anteprima) il consigliere apre sulla Mappa e non vede il calendario
    consigliere:  { nome: 'Consigliere',     menu: ['dashboard', 'statistiche'], apre: 'dashboard', lettura: true },
  };
  /* Per chi è di sola lettura «Segnala un cantiere», il QR e i Servizi CPT sono PULSANTI SULLA PAGINA che vede per prima:
     sulla Mappa restano quelli di sempre, sopra i cantieri in monitoraggio; sulla pagina Direzione/Presidenza la veste ne
     mette tre uguali, che premono quelli di sempre. */
  const PULSANTI_LETTURA = [
    { preme: 'btn-segnala-dash', testo: '📍 Segnala un cantiere attivo', stile: 'flex:2;min-width:220px;background:#e7500f;border:1px solid #e7500f;color:#fff', aiuto: 'Apre il modulo per segnalare all’ufficio un cantiere attivo: indirizzo, comune e due righe. La segnalazione arriva alla segreteria.' },
    { preme: 'btn-qr-servizi', testo: '📱 QR servizi CPT', stile: 'flex:1;min-width:160px;background:#fff;border:2px solid #e7500f;color:#e7500f', aiuto: 'Mostra sullo schermo il codice QR del portale servizi, da far inquadrare a chi hai davanti.' },
    { preme: 'btn-servizi-cpt', testo: 'Vai ai servizi CPT ↗', stile: 'flex:1;min-width:180px;background:#95C22F;border:1px solid #7aa527;color:#fff', aiuto: 'Apre in un’altra scheda il portale servizi pubblico, quello che vedono le imprese.' },
  ];
  /* (04/10/2026, segnalato dall'utente) IL RIQUADRO 🔔 DELLE NOTIFICHE sta in cima alla pagina con cui ciascuno apre:
     «Oggi» sotto il saluto; per Direttore e Presidenza la pagina Direzione, sotto i pulsanti; per chi è di sola lettura
     sulla Mappa, sotto Segnala/QR/Servizi. È un elemento solo (#dash-notifiche): si sposta dove serve.
     Dal 25/09 era nascosto a chi è di sola lettura, e la Presidenza non poteva attivare l'unica notifica che la riguarda
     (cantiere critico che coinvolge la Presidenza, s_critico_coinvolgi_presidenza). */
  function postoNotifiche(view) {
    const nt = $('dash-notifiche'); if (!nt) return;
    let dove = null, dopoDi = null;
    if (view === 'direzione') { dove = $('view-direzione'); dopoDi = $('v2-dir-pulsanti') || $('dir-intro'); }
    else if (view === 'dashboard') {
      if (RUOLI[ruolo()].lettura) { dove = $('view-dashboard'); dopoDi = $('dash-segnala-wrap'); }
      else { const posto = $('v2-posto-notifiche'); if (posto) { if (nt.parentNode !== posto) posto.appendChild(nt); return; } }
    }
    if (!dove) return;
    const prima = dopoDi && dopoDi.parentNode === dove ? dopoDi.nextSibling : dove.firstChild;
    if (nt !== prima && nt.nextSibling !== prima) dove.insertBefore(nt, prima);
    if (view === 'direzione' && typeof window.notificheBox === 'function') window.notificheBox().catch((e) => console.warn('notifiche:', e));
  }
  function pulsantiDirezione() {
    const vista = $('view-direzione'); if (!vista) return;
    let el = $('v2-dir-pulsanti');
    if (!RUOLI[ruolo()].lettura) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = 'v2-dir-pulsanti';
    el.innerHTML = PULSANTI_LETTURA.map((p) => `<button type="button" data-v2-preme="${p.preme}" style="${p.stile}" data-aiuto="${esc(p.aiuto)}">${p.testo}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-v2-preme]'); const d = b && $(b.dataset.v2Preme); if (d) d.click(); });
    const intro = $('dir-intro');
    vista.insertBefore(el, intro && intro.parentNode === vista ? intro.nextSibling : vista.firstChild);
  }

  const ETICHETTE = { dashboard: '🏠 Oggi', admin: '🧭 Coordinamento', segreteria: '🗂️ Ufficio', form: '➕ Nuova visita', direzione: '🏛️ Direzione', appuntamenti: '📅 Appuntamenti' };

  const CHIAVE_TECNICO = 'gv-v2-tecnico';   // sessionStorage: di quale tecnico si guarda la pagina in «Vedi come: Tecnico»
  let _tecnici = null;       // l'elenco dei tecnici, letto una volta, per la tendina dell'anteprima
  /* DI CHI sono le righe di «Oggi» (rientri, incarichi, bozze):
       · un tecnico vero vede le sue;
       · la segreteria nella sua vista vede quelle di tutti;
       · la segreteria che guarda «come Tecnico» o «come Coordinatore» vede quelle del tecnico che sceglie nella barra
         (chiesto dall'utente: il tecnico deve vedere i suoi rientri, non quelli di tutti). */
  function diChi() {
    const mio = { id: (S().tecnico && S().tecnico.tecnico_id) || null, email: email(), nome: '' };
    if (!eSegreteria()) return Object.assign(mio, { tutti: false });
    if (ruolo() === 'segreteria') return Object.assign(mio, { tutti: true });
    const scelto = (_tecnici || []).find((x) => String(x.tecnico_id) === leggi(sessionStorage, CHIAVE_TECNICO)) || (_tecnici || [])[0];
    if (!scelto) return Object.assign(mio, { tutti: false });
    return { id: scelto.tecnico_id, email: String(scelto.email || '').toLowerCase(), nome: [scelto.tecnico_nome, scelto.tecnico_cognome].filter(Boolean).join(' '), tutti: false, anteprima: true };
  }
  async function tecniciLeggi() {
    if (_tecnici || !window.sb) return;
    const { data, error } = await window.sb.from('tecnici').select('tecnico_id,tecnico_nome,tecnico_cognome,email').order('tecnico_cognome');
    if (error) { console.warn('veste v2, tecnici:', error); return; }
    _tecnici = (data || []).filter((x) => x.email && String(x.email).toLowerCase() !== SEGRETERIA);
    barra(); oggiDisegna(); bozze().catch(() => {});
  }

  let _utente = null;      // l'e-mail per cui la veste è stata preparata: se cambia utente si ricomincia
  let _aperta = false;     // la pagina di apertura è già stata scelta per questo accesso
  let _letturaFinta = false;

  const S = () => window.S || {};
  const email = () => String((S().user && S().user.email) || '').toLowerCase();
  const eSegreteria = () => !!email() && email() === SEGRETERIA && !S().viewer;
  /* Accesa per chiunque sia collegato: è la sola veste (04/10/2026). */
  const accesa = () => !!email();
  /* IL RUOLO VERO, dall'accesso: chi è di sola lettura lo dice S.viewer (con S.direttore / S.presidenza), la segreteria
     la sua e-mail, il coordinatore il permesso sulla pagina Coordinamento (window.__isCoordPage, messo all'accesso). */
  const ruoloVero = () => {
    const s = S();
    if (s.viewer) return s.direttore ? 'direttore' : s.presidenza ? 'presidenza' : 'consigliere';
    if (email() === SEGRETERIA) return 'segreteria';
    return window.__isCoordPage ? 'coordinatore' : 'tecnico';
  };
  /* «Vedi come…»: solo la segreteria può GUARDARE la pagina di un altro ruolo. Per chiunque altro il ruolo scritto
     nel browser non conta niente: vale quello dell'accesso. */
  const simula = () => { if (!eSegreteria()) return false; const r = leggi(sessionStorage, CHIAVE_RUOLO); return !!RUOLI[r] && r !== 'segreteria'; };
  const ruolo = () => (simula() ? leggi(sessionStorage, CHIAVE_RUOLO) : ruoloVero());


  /* ── stile: solo quando la veste è accesa ── */
  function stile() {
    if ($('v2-stile')) return;
    const f = document.createElement('link');
    f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap';
    document.head.appendChild(f);
    const st = document.createElement('style');
    st.id = 'v2-stile';
    st.textContent = `
body.v2{font-family:Barlow,'Segoe UI',system-ui,sans-serif;color:#565C66}
body.v2 input,body.v2 select,body.v2 textarea,body.v2 button{font-family:inherit}
body.v2 nav{gap:6px;padding:0 20px}
body.v2 nav button{font-size:14px;border-width:1px;padding:7px 12px}
body.v2 nav button.v2-cta{background:var(--orange);color:#fff;font-weight:700;border-color:var(--orange)}
body.v2 nav button.v2-cta:hover{background:#B33B05;border-color:#B33B05}
body.v2 main h2{font-size:24px;font-weight:600;color:#565C66}
#v2-barra{background:#2b2f36;color:#fff;font-size:12.5px;padding:7px 20px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#v2-barra b{margin-right:4px}
#v2-barra button{font:600 12px Barlow,sans-serif;background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.35);border-radius:50px;padding:4px 12px;min-height:0}
#v2-barra button.on{background:var(--orange);border-color:var(--orange)}
#v2-barra .v2-nota{color:rgba(255,255,255,.6);margin-left:6px}
.v2-card{background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:14px 18px;margin-bottom:12px;color:#565C66}
.v2-card.v2-bordo{border-left:3px solid var(--orange)}
.v2-micro{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--orange)}
.v2-titolo{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
.v2-riga{display:flex;gap:12px;align-items:center;padding:9px 0;border-top:1px solid #F4F4F4}
.v2-riga:first-of-type{border-top:0}
.v2-riga .v2-t{flex:1;min-width:0}.v2-riga .v2-t b{font-size:15px;font-weight:600;display:block;color:#3d4249}.v2-riga .v2-t small{font-size:13px;color:#888}
.v2-num{flex:0 0 46px;height:46px;border-radius:8px;background:#FFF8F4;color:var(--orange);font-weight:700;font-size:19px;display:flex;align-items:center;justify-content:center}
.v2-num.v2-err{background:#FDE8E8;color:#C0392B;font-size:11px;text-align:center;line-height:1.1}
.v2-num.v2-zero{background:#EEF7E0;color:#5F8A12}
body.v2 #view-segreteria.v2-uff{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
body.v2 #view-segreteria.v2-uff.hidden{display:none}
#v2-uff-menu{flex:0 0 230px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:8px;position:sticky;top:calc(var(--header-h) + var(--nav-h) + 46px)}
#v2-uff-menu button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;background:none;color:#565C66;font-size:14px;padding:10px 12px;border-radius:8px;white-space:normal;min-height:0}
#v2-uff-menu button.on{background:#FFF8F4;color:var(--orange);font-weight:600}
#v2-uff-menu button small{color:#888;font-weight:700}
#v2-uff-menu hr{border:0;border-top:1px solid #F4F4F4;margin:6px 4px}
body.v2 #view-segreteria.v2-uff>.adm-wrap{flex:1 1 420px;min-width:0}
/* le zone riservate passano dal fondo scuro al chiaro: i testi chiari scritti nelle righe vanno scuriti */
body.v2 #view-admin .adm-wrap,body.v2 #view-segreteria .adm-wrap{background:transparent;color:#3d4249;padding:0}
body.v2 :is(#view-admin,#view-segreteria) .adm-header{border-bottom:0;margin-bottom:10px;padding-bottom:0}
body.v2 :is(#view-admin,#view-segreteria) .adm-header .adm-icon{display:none}
body.v2 :is(#view-admin,#view-segreteria) .adm-header h2{color:#565C66;font-size:24px;font-weight:600}
body.v2 :is(#view-admin,#view-segreteria) .adm-header p{color:#888}
body.v2 .adm-wrap .adm-section{background:#fff;border:0;box-shadow:0 2px 8px rgba(0,0,0,.12);color:#3d4249}
body.v2 .adm-wrap .adm-section-title{color:#565C66;font-size:14px;letter-spacing:.4px}
body.v2 .adm-wrap .adm-section-title::before{background:var(--orange)}
body.v2 .adm-wrap :not(button):not([style*="background"])[style*="color:rgba(255,255,255"],
body.v2 .adm-wrap :not(button):not([style*="background"])[style*="color: rgba(255, 255, 255"]{color:#6b7078!important}
body.v2 .adm-wrap :not(button):not([style*="background"])[style*="color:#fff"]{color:#3d4249!important}
body.v2 .adm-wrap [style*="background:rgba(255,255,255"]{background:#F7F7F7!important;color:#3d4249!important}
body.v2 .adm-wrap .drop-zone,body.v2 .adm-wrap .drop-zone *{color:#6b7078!important}
body.v2 .adm-wrap [style*="border-top:1px solid rgba(255,255,255"]{border-top-color:#E3E4E6!important}
body.v2 .adm-wrap .adm-date-row label,body.v2 .adm-wrap label{color:#6b7078!important}
body.v2 .adm-wrap .adm-date-row input,body.v2 .adm-wrap input,body.v2 .adm-wrap select,body.v2 .adm-wrap textarea{background:#fff!important;border-color:var(--border)!important;color:#222!important;color-scheme:light}
body.v2 .adm-wrap .adm-stat{background:#F7F7F7}
body.v2 .adm-wrap .adm-stat .l{color:#888}
body.v2 .adm-wrap th{color:#6b7078!important}
body.v2 .adm-wrap td{color:#3d4249}
body.v2 #view-admin tr:hover td,body.v2 #view-segreteria tr:hover td{background:#FEF9F7!important;color:#3d4249}
body.v2 .adm-wrap details summary{color:#6b7078!important}
/* «Oggi» è il cruscotto di sempre, mappa dei cantieri in monitoraggio compresa, con le bozze aperte in cima.
   Scadenze e incarichi NON stanno qui: hanno la loro pagina e la voce nel menu, come oggi (chiesto dall'utente). */
/* «Oggi»: il riepilogo a due colonne del prototipo. I pulsanti di sempre diventano tasselli (premono gli stessi
   pulsanti, che restano nascosti); chi è di sola lettura li ha nel menu. Sotto resta il cruscotto, con la mappa. */
body.v2:not(.viewer-mode) #dash-segnala-wrap,body.v2:not(.viewer-mode) #btn-dove-sono,body.v2:not(.viewer-mode) #btn-appunti{display:none!important}
body.v2.viewer-mode #v2-oggi{display:none}
#v2-oggi{margin-bottom:18px}
#v2-oggi .v2-data{font-size:13px;color:#888}
#v2-oggi h2{font-size:26px;font-weight:600;margin:2px 0 14px;color:#565C66}
#v2-oggi .v2-colonne{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}
#v2-oggi .v2-c1{flex:1 1 520px;min-width:0}
#v2-oggi .v2-c2{flex:1 1 280px;min-width:0}
#v2-oggi .v2-testa{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:4px}
#v2-oggi .v2-testa small{font-size:12.5px;color:#888}
#v2-oggi .v2-riga{padding:12px 0}
#v2-oggi .v2-sopra{font-size:12.5px;color:#888;margin-bottom:2px}
#v2-oggi .v2-rosso{color:#C62828;font-weight:600;font-size:13px}
#v2-oggi .v2-ipc{font-size:11px;font-weight:700;border-radius:4px;padding:2px 7px;text-transform:uppercase;letter-spacing:.3px;margin-right:6px}
#v2-oggi .v2-ipc.ALTO{color:#C0392B;background:#FDE8E8}#v2-oggi .v2-ipc.MEDIO{color:#E67E22;background:#FEF3E2}#v2-oggi .v2-ipc.BASSO{color:#8A6D00;background:#FFF8CC}
#v2-oggi .v2-bottoni{display:flex;gap:6px;flex:0 0 auto}
#v2-oggi .v2-piede{border-top:1px solid #F4F4F4;padding-top:10px;margin-top:2px;font-size:13px}
#v2-oggi .v2-piede a{color:var(--orange);font-weight:600;text-decoration:none;cursor:pointer}
#v2-azioni{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:12px}
#v2-azioni button{background:#fff;border:1px solid var(--border);border-radius:8px;min-height:72px;padding:8px;font-size:13px;color:#565C66;display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;white-space:normal;box-shadow:0 2px 8px rgba(0,0,0,.08)}
#v2-azioni button:hover{border-color:var(--orange)}
#v2-azioni button:active{transform:scale(.97)}
#v2-azioni button span{font-size:20px;line-height:1}
/* Segnala cantiere in arancione, Servizi CPT in verde e Asseverazione in blu, come i pulsanti di sempre (chiesto dall'utente) */
#v2-azioni button.v2-arancio{background:#e7500f;border-color:#e7500f;color:#fff;font-weight:600}
#v2-azioni button.v2-arancio:hover{border-color:#B33B05}
#v2-azioni button.v2-verde{background:#95C22F;border-color:#7aa527;color:#fff;font-weight:600}
#v2-azioni button.v2-blu{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600}
#v2-azioni button.v2-verde:hover{border-color:#5f8a1a}#v2-azioni button.v2-blu:hover{border-color:#1e40af}
#v2-dir-pulsanti{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}
/* i rientri per giorno nella scheda di «Oggi»: intestazioni da bordo a bordo, ricerca e filtri col margine della scheda */
#v2-rientri-lista .rg-cerca{padding:0 18px 10px}
#v2-rientri-lista .rg-pannello{margin:0 18px 10px}
#v2-rientri-lista .rg-vuoto{padding:12px 18px}
#v2-rientri-lista + .v2-piede{margin-top:0}
#v2-dir-pulsanti button{padding:12px;font-size:15px;border-radius:10px;font-weight:600;cursor:pointer;min-height:0}
/* IL VERBALE IN TRE MOMENTI: i passi di oggi, raggruppati. Nessun campo spostato fra i dati: cambia che cosa si vede insieme. */
#v2-fasi{display:flex;gap:10px;align-items:stretch;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:0 16px;margin-bottom:14px;flex-wrap:wrap}
#v2-fasi .v2-fasi-sx{padding:10px 14px 10px 0;min-width:150px}
#v2-fasi .v2-fasi-sx small{display:block;font-size:11px;font-weight:700;color:#888;letter-spacing:.8px}
#v2-fasi .v2-fasi-sx b{font-size:16px;font-weight:600;color:#565C66}
#v2-fasi button{flex:1 1 150px;text-align:left;background:none;border-radius:0;border-top:3px solid #E3E4E6;padding:8px 6px 10px;color:#565C66;font-size:14px;white-space:normal;min-height:0}
#v2-fasi button small{display:block;font-size:11px;font-weight:700;letter-spacing:.8px;color:#888}
#v2-fasi button.on,#v2-fasi button.fatta{border-top-color:var(--orange)}
#v2-fasi button.on{font-weight:600}
#v2-fasi button.on small{color:var(--orange)}
body.v2 #view-form .form-header h2{display:none}
body.v2 #view-form .form-header{justify-content:flex-end;margin-bottom:8px}
body.v2.v2-fase1 #view-form #tab-bar{display:none}
body.v2.v2-fase1 #view-form .tab-area{display:flex;flex-direction:column}
body.v2.v2-fase1 #view-form .tab-area>#inc-scelta-box{order:0}
body.v2.v2-fase1 #view-form .tab-content[data-tab="1"]{display:block;order:1}
body.v2.v2-fase1 #view-form .tab-content[data-tab="0"]{display:block;order:2}
body.v2.v2-fase1 #view-form .v2-persona{display:none}
body.v2.v2-fase2 #view-form .v2-visita{display:none}
body.v2:not(.v2-fase1) #view-form .tab-area>#inc-scelta-box{display:none!important}
body.v2.v2-fase2 #tab-bar .tab-btn[data-ti="1"],body.v2.v2-fase2 #tab-bar .tab-btn[data-ti="13"],body.v2.v2-fase2 #tab-bar .tab-btn[data-ti="14"],body.v2.v2-fase2 #tab-bar .tab-btn[data-ti="15"]{display:none}
body.v2.v2-fase3 #tab-bar .tab-btn:not([data-ti="13"]):not([data-ti="14"]):not([data-ti="15"]){display:none}
/* primo momento, come nel prototipo: incarichi a schede, cantieri vicini, tipologia a pulsanti */
body.v2 #view-form .tab-area>#inc-scelta-box{background:#fff!important;border-left:0!important;border-radius:8px!important;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:16px 20px!important;margin-bottom:14px!important}
body.v2 #view-form .tab-area>#inc-scelta-box>.field{display:none}
.v2-griglia{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.v2-scheda{text-align:left;background:#fff;border:2px solid var(--border);border-radius:8px;padding:12px 14px;color:#565C66;white-space:normal;min-height:0;display:block;font-size:13px;line-height:1.35}
.v2-scheda:hover{border-color:var(--orange)}
.v2-scheda:active{transform:scale(.97)}
.v2-scheda.on{border-color:var(--orange);background:#FFF8F4}
.v2-scheda.v2-tratt{border-style:dashed}
.v2-scheda small{display:block;font-size:12px;color:#888}
.v2-scheda b{display:block;font-size:15px;font-weight:600;color:#3d4249;margin:2px 0}
.v2-scheda .v2-km{color:var(--orange);font-weight:600;font-size:12px}
/* solo su telefono e tablet, come «Cantieri vicino a te» dell'app (mappa.js): sul PC la posizione non serve */
#v2-vicini{display:none;margin:0 0 12px}
@media (max-width:1024px),(pointer:coarse){#v2-vicini{display:block}}
#v2-vicini .v2-nota{font-size:12.5px;color:#888;margin-top:6px}
#v2-tipo-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
#v2-tipo-chips button{background:#fff;border:1.5px solid var(--border);border-radius:50px;padding:7px 14px;font-size:13px;font-weight:600;color:#565C66;min-height:0}
#v2-tipo-chips button.on{background:#565C66;border-color:#565C66;color:#fff}
#v2-tipo-chips button.v2-tratt{border-style:dashed;color:#888;font-weight:400}
body.v2 #view-form .v2-tipo-nascosta{display:none}
/* secondo momento: righe che si aprono, una alla volta (persona presente, imprese, le dieci aree) */
.v2-area{display:none}
body.v2.v2-fase2 #view-form #tab-bar{display:none}
body.v2.v2-fase2 #view-form .v2-area{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:12px 16px;margin-bottom:8px;color:#565C66;font-size:15px;white-space:normal;min-height:0;border-left:3px solid transparent}
.v2-area .v2-pallino{flex:0 0 26px;height:26px;border-radius:50%;background:#E3E4E6;color:#565C66;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.v2-area.parziale .v2-pallino{background:#FDE8DC;color:var(--orange)}
.v2-area.completa .v2-pallino{background:#95C22F;color:#fff}
.v2-area .v2-nome{flex:1;font-weight:600;min-width:0}
.v2-area .v2-riep{font-size:13px;color:#888;white-space:nowrap}
.v2-area .v2-riep.ncp{color:#C0392B;font-weight:600}
.v2-area .v2-riep.ncm{color:#E67E22;font-weight:600}
.v2-area .v2-freccia{color:#888;flex:0 0 14px;text-align:center}
.v2-area.aperta{border-left-color:var(--orange)!important}
body.v2.v2-fase2.v2-area-chiusa #view-form .tab-content.active{display:none}
body.v2.v2-fase2 #view-form .tab-content{margin-bottom:10px}
body.v2.v2-fase2 #view-form .tab-content>.card>h3:first-child{display:none}
@media(max-width:600px){.v2-area .v2-riep{white-space:normal;text-align:right;font-size:12px}}
/* terzo momento: una pagina sola — a sinistra note e foto, a destra il riepilogo con «Prima di chiudere», ora di fine, Bozza e Definitivo */
body.v2.v2-fase3 #view-form #tab-bar{display:none}
body.v2.v2-fase3 #view-form .tab-area{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);gap:14px;align-items:start}
body.v2.v2-fase3 #view-form .tab-content[data-tab="13"]{display:block;grid-column:1;grid-row:1}
body.v2.v2-fase3 #view-form .tab-content[data-tab="14"]{display:block;grid-column:1;grid-row:2}
body.v2.v2-fase3 #view-form .tab-content[data-tab="15"]{display:block;grid-column:2;grid-row:1 / span 2}
@media(max-width:900px){body.v2.v2-fase3 #view-form .tab-area{display:block}}
#v2-requisiti{margin:14px 0 4px;padding-top:12px;border-top:2px solid #F4F4F4}
#v2-requisiti .v2-req{display:flex;gap:8px;align-items:center;padding:5px 0;font-size:13.5px}
#v2-requisiti .v2-spunta{flex:0 0 20px;height:20px;border-radius:50%;background:#E3E4E6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
#v2-requisiti .v2-req.ok .v2-spunta{background:#95C22F}
#v2-requisiti .v2-req span.v2-rt{flex:1;color:#3d4249}
#v2-requisiti .v2-req.ok span.v2-rt{color:#888}
#v2-requisiti a{color:var(--orange);font-weight:600;cursor:pointer;white-space:nowrap}
#v2-requisiti small{display:block;color:#888;font-size:12px;margin-top:6px;line-height:1.4}
/* il cantiere scelto, in evidenza */
/* persona fisica / giuridica: due pulsanti come pubblico / privato, così si capisce che se ne sceglie uno */
body.v2 .sogg-toggle{gap:6px;border:0;border-radius:0;overflow:visible;flex-wrap:wrap}
body.v2 .sogg-toggle label{flex:0 0 auto;padding:0;background:none;text-transform:uppercase;letter-spacing:.4px}
body.v2 .sogg-toggle label span{display:block;padding:5px 13px;border-radius:20px;border:2px solid var(--border);background:#fff;color:var(--grey);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
body.v2 .sogg-toggle input[type=radio]:checked+span{border-color:var(--grey);background:var(--grey);color:#fff}
body.v2 #cant-info-card{border:2px solid var(--orange)!important;background:#FFF8F4!important;border-radius:8px!important}
/* pillole di Visite, Rubrica e Statistiche */
.v2-pillole{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.v2-pillole button{border-radius:50px;border:1.5px solid var(--border);background:#fff;padding:6px 14px;font-size:13px;font-weight:600;color:#565C66;min-height:0}
.v2-pillole button.on{background:var(--orange);border-color:var(--orange);color:#fff}
body.v2 .v2-nasc{display:none!important}
/* un testo chiaro su fondo chiaro (le zone riservate erano scure): lo trova e lo scurisce leggibile() */
body.v2 .v2-scuro{color:#3d4249!important}
body.v2 .v2-scuro::placeholder{color:#888!important}
/* TELEFONO: il menu resta IN ALTO, come oggi, per tutti (provato dall'utente sul telefono il 03/10/2026: in basso
   non gli è piaciuto, sopra è più funzionale). Le tabelle diventano schede. */
@media(max-width:720px){
  body.v2 nav button{margin-left:0!important}
  /* solo per il TECNICO: bozze, poi i riquadri delle azioni, poi rientri e incarichi (con molti rientri le azioni finivano troppo sotto) */
  body.v2[data-v2-ruolo="tecnico"] #v2-oggi .v2-colonne{flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:0}
  body.v2[data-v2-ruolo="tecnico"] #v2-oggi .v2-c1,body.v2[data-v2-ruolo="tecnico"] #v2-oggi .v2-c2{display:contents}
  body.v2[data-v2-ruolo="tecnico"] #v2-bozze{order:1}
  body.v2[data-v2-ruolo="tecnico"] #v2-azioni{order:2}
  body.v2[data-v2-ruolo="tecnico"] #v2-rientri{order:3}
  body.v2[data-v2-ruolo="tecnico"] #v2-incarichi{order:4}
  body.v2[data-v2-ruolo="tecnico"] #v2-posto-obiettivo{order:5}
  body.v2[data-v2-ruolo="tecnico"] #v2-posto-avvisi{order:6}
  #v2-barra{overflow-x:auto;flex-wrap:nowrap;white-space:nowrap}
  body.v2 .v2-schede .tbl-wrap{overflow:visible}
  body.v2 .v2-schede table,body.v2 .v2-schede tbody,body.v2 .v2-schede tr,body.v2 .v2-schede td{display:block;width:100%}
  body.v2 .v2-schede thead{display:none}
  body.v2 .v2-schede tbody tr{background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:10px 12px;margin-bottom:10px}
  body.v2 .v2-schede td{border:0!important;padding:3px 0!important;display:flex;gap:8px;justify-content:space-between;align-items:baseline;text-align:right;white-space:normal!important}
  body.v2 .v2-schede td::before{content:attr(data-l);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#888;text-align:left;flex:0 0 36%}
  body.v2 .v2-schede td[data-l=""]::before{content:none}
  body.v2 .v2-schede td:empty{display:none}
}
.v2-sezione{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#565C66;margin:6px 2px 10px}
#v2-torna{display:inline-flex;margin-bottom:10px;font-size:13px;font-weight:600;color:var(--orange);background:#fff;border:1.5px solid var(--orange);border-radius:50px;padding:5px 14px;min-height:0}
@media(max-width:720px){#v2-uff-menu{flex:1 1 100%;position:static;display:flex;flex-wrap:wrap;gap:4px}#v2-uff-menu button{width:auto;padding:7px 12px;border:1px solid var(--border)}#v2-uff-menu hr{display:none}body.v2 nav{padding:0 10px}}
`;
    document.head.appendChild(st);
  }

  /* ── il menu per ruolo ── */
  function menu() {
    const r = RUOLI[ruolo()];
    const nav = document.querySelector('nav'); if (!nav) return;
    let dopoSpazio = false, n = 0;
    const ordine = {};
    r.menu.forEach((v) => { if (v === '|') { dopoSpazio = true; return; } ordine[v] = { n: n++, primoADestra: dopoSpazio && !Object.values(ordine).some((o) => o.destra), destra: dopoSpazio }; });
    nav.querySelectorAll('button').forEach((b) => {
      const v = b.dataset.view;
      if (b.dataset.v2Etichetta === undefined) { b.dataset.v2Etichetta = b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent : ''; b.dataset.v2Mostra = b.style.display; }
      const o = v && ordine[v];
      if (!o) { b.style.display = 'none'; return; }
      b.style.display = ''; b.style.order = String(o.n); b.style.marginLeft = o.primoADestra ? 'auto' : '';
      b.classList.toggle('v2-cta', v === 'form');
      let et = ETICHETTE[v];
      if (v === 'dashboard' && r.lettura) et = '🗺️ Mappa';
      if (v === 'direzione' && ruolo() === 'presidenza') et = '🏛️ Presidenza';
      if (et && b.firstChild && b.firstChild.nodeType === 3) b.firstChild.textContent = et;
    });
  }

  /* ── la barra «Vedi come…» ── */
  function barra() {
    let el = $('v2-barra');
    if (!eSegreteria()) { if (el) el.remove(); return; }   // la barra è della sola segreteria
    if (!el) {
      const nav = document.querySelector('nav'); if (!nav || !nav.parentNode) return;
      el = document.createElement('div'); el.id = 'v2-barra';
      nav.parentNode.insertBefore(el, nav.nextSibling);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-ruolo]'); if (!b) return;
        scrivi(sessionStorage, CHIAVE_RUOLO, b.dataset.ruolo === 'segreteria' ? null : b.dataset.ruolo);
        prepara();
        _aperta = true;
        if (typeof window.navTo === 'function') window.navTo(RUOLI[ruolo()].apre);
      });
    }
    const att = ruolo();
    el.innerHTML = '<b>Vedi come:</b>'
      + Object.entries(RUOLI).map(([k, r]) => `<button type="button" data-ruolo="${k}" class="${k === att ? 'on' : ''}">${esc(r.nome)}</button>`).join('')
      + ((att === 'tecnico' || att === 'coordinatore') && _tecnici && _tecnici.length
        ? '<select id="v2-quale-tec" style="width:auto;font:600 12px Barlow,sans-serif;padding:3px 8px;border-radius:50px;margin-left:6px" data-aiuto="Di quale tecnico vedere la pagina: rientri, incarichi e bozze sono i suoi.">'
          + _tecnici.map((x) => `<option value="${esc(x.tecnico_id)}"${String(x.tecnico_id) === String(diChi().id) ? ' selected' : ''}>come ${esc([x.tecnico_nome, x.tecnico_cognome].filter(Boolean).join(' '))}</option>`).join('') + '</select>'
        : '')
      + (att === 'segreteria' ? '' : '<span class="v2-nota">vedi il menu e le pagine di questo ruolo; i dati restano quelli che il database dà a te</span>');
    const qt = $('v2-quale-tec');
    if (qt) qt.addEventListener('change', () => { scrivi(sessionStorage, CHIAVE_TECNICO, qt.value); oggiDisegna(); bozze().catch(() => {}); });
    if ((att === 'tecnico' || att === 'coordinatore') && !_tecnici) tecniciLeggi().catch((e) => console.warn('veste v2, tecnici:', e));
  }

  /* la voce del coordinatore viene riscritta dall'app ogni volta che cambia il numero accanto
     (cantieri-critici-coord.js): la si tiene sull'etichetta nuova, lasciando il numero */
  let _occhio = null;
  function tieniEtichette() {
    if (_occhio) return;
    const b = $('nav-admin'); if (!b || typeof MutationObserver !== 'function') return;
    _occhio = new MutationObserver(() => {
      if (!document.body.classList.contains('v2')) return;
      const t = b.firstChild;
      if (t && t.nodeType === 3 && t.textContent.trim() !== ETICHETTE.admin) t.textContent = ETICHETTE.admin + (b.childNodes.length > 1 ? ' ' : '');
    });
    _occhio.observe(b, { childList: true });
  }

  function prepara() {
    document.body.classList.add('v2');
    document.body.dataset.v2Ruolo = ruolo();
    stile(); menu(); barra(); tieniEtichette(); verbaleAggancia();
    const lettura = !!RUOLI[ruolo()].lettura;
    if (lettura && !document.body.classList.contains('viewer-mode')) { document.body.classList.add('viewer-mode'); _letturaFinta = true; }
    if (!lettura && _letturaFinta) { document.body.classList.remove('viewer-mode'); _letturaFinta = false; }
  }

  /* ── numeri: una lettura fallita si dice, non diventa zero ── */
  /* 04/10/2026: il nome del riquadro e il messaggio vanno nella console come testo — l'oggetto errore da solo
     si leggeva «{}», e non si capiva quale numero non era stato letto */
  /* 05/10/2026: un conteggio interrotto per «statement timeout» si ritenta UNA volta dopo qualche secondo. Le
     funzioni da sole rispondono in meno di un secondo (misurate quel giorno: 0,2-0,7 s contro un limite di 8): il
     timeout arriva quando cadono dentro la raffica di letture dell'apertura. Qualunque altro errore resta un errore
     subito, e anche il secondo tentativo, se fallisce, si dice — mai uno zero al posto di «non letto». */
  const ATTESA_RITENTO_MS = 4000;
  const eTimeout = (msg) => /statement timeout/i.test(msg || '');
  async function conta(leggiFn, nome, attesa = ATTESA_RITENTO_MS) {
    const leggi = async () => { const n = await leggiFn(); return { n: Number(n) || 0 }; };
    const avvisa = (msg) => { console.warn('veste v2, conteggio «' + (nome || '?') + '» non letto: ' + msg); return { errore: msg }; };
    try { return await leggi(); } catch (e) {
      const msg = (e && e.message) || String(e);
      if (!eTimeout(msg)) return avvisa(msg);
      await new Promise((ok) => setTimeout(ok, attesa));
      try { return await leggi(); } catch (e2) { return avvisa(((e2 && e2.message) || String(e2)) + ' (anche al secondo tentativo)'); }
    }
  }
  const quadro = (c) => c.errore ? '<div class="v2-num v2-err" title="' + esc(c.errore) + '">non letto</div>' : '<div class="v2-num' + (c.n ? '' : ' v2-zero') + '">' + c.n + '</div>';
  const rigaScr = (c, titolo, sotto, azione, etichetta) => `<div class="v2-card" style="padding:10px 16px"><div class="v2-riga">${quadro(c)}<div class="v2-t"><b>${titolo}</b><small>${sotto}</small></div><button type="button" class="btn-outline btn-sm" data-v2-az="${azione}">${etichetta}</button></div></div>`;
  function esercizi() {
    const d = new Date(), a = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1;
    const es = (y) => ({ nome: y + '-' + String(y + 1).slice(2), dal: y + '-10-01', al: (y + 1) + '-09-30', etichetta: y + '/' + (y + 1) });
    return [es(a), es(a - 1)];
  }

  /* ── TESTI LEGGIBILI nelle zone che erano scure (Ufficio, Coordinamento) ──
     Quelle pagine sono nate con fondo scuro e testi chiari, scritti riga per riga in cento punti diversi, anche negli
     elenchi che si disegnano dopo aver premuto un pulsante. Qui non si inseguono i casi: si MISURA. Per ogni elemento
     che ha del testo si calcola il contrasto fra il colore del testo e il fondo che ha davvero sotto; se il fondo è
     chiaro e il contrasto è troppo basso, il testo diventa scuro. Un testo bianco su un pulsante arancione o su un
     riquadro scuro resta com'è. Gli elenchi che arrivano dopo sono osservati. */
  function luminanza(colore) {
    const m = String(colore || '').match(/[\d.]+/g); if (!m || m.length < 3) return null;
    const [r, g, b] = m.map(Number), a = m.length > 3 ? Number(m[3]) : 1;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return { l: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a };
  }
  const contrasto = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  function fondoDi(el) {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;   // una sfumatura o un'immagine: non si sa, non si tocca
      const c = luminanza(cs.backgroundColor);
      if (c && c.a >= 0.5) return c.l;
    }
    return 1;   // nessun fondo dichiarato: la pagina è chiara
  }
  function leggibile(radice) {
    if (!radice || !document.body.classList.contains('v2')) return 0;
    let n = 0;
    radice.querySelectorAll('*').forEach((el) => {
      if (el.classList.contains('v2-scuro') || el.offsetParent === null) return;
      const campo = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';
      if (!campo && ![...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())) return;
      const testo = luminanza(getComputedStyle(el).color), fondo = fondoDi(el);
      if (!testo || fondo == null) return;
      if (fondo > 0.5 && contrasto(testo.l, fondo) < 3) { el.classList.add('v2-scuro'); n++; }
    });
    return n;
  }
  const _zoneScure = new Set();
  function leggibileIn(id) {
    const vista = $(id), zona = vista && vista.querySelector('.adm-wrap'); if (!zona) return;
    leggibile(zona);
    if (_zoneScure.has(id) || typeof MutationObserver !== 'function') return;
    _zoneScure.add(id);
    let inCoda = false;
    const rifai = () => { if (inCoda) return; inCoda = true; setTimeout(() => { inCoda = false; try { leggibile(zona); } catch (_e) { /* si rifà al prossimo cambio */ } }, 120); };
    new MutationObserver(rifai).observe(zona, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'open'] });
    zona.addEventListener('toggle', rifai, true);
  }

  /* ── UFFICIO: gli strumenti della pagina Segreteria, raggruppati ── */
  const GRUPPI = [
    { k: 'scrivania', nome: 'Scrivania', titoli: [] },
    { k: 'comunicazioni', nome: 'Comunicazioni', titoli: ['Promemoria ricontrolli', 'Campagna informativa'], rimandi: [['admin', '📢 Bacheca avvisi ai tecnici', 'sta nella pagina del coordinamento']] },
    { k: 'incarichi', nome: 'Incarichi', titoli: ['Incarichi ai tecnici'], rimandi: [['incarichi', '📋 Incarichi aperti', 'l\'elenco di tutti gli incarichi, da assegnare e da chiudere']] },
    { k: 'anagrafiche', nome: 'Anagrafiche', titoli: ['Gestione imprese', 'Imprese doppie', 'Gestione cantieri'], rimandi: [['committenti', '👤 Committenti', 'ricerca, modifica e unione dei committenti'], ['rubrica', '📒 Persone e contatti', 'la rubrica, con la pulizia dei doppioni']] },
    { k: 'qualita', nome: 'Qualità dati', titoli: ['Imprese visitate senza codice fiscale', 'Imprese con l\'indirizzo di un\'altra impresa', 'Riaggancio cantieri senza CNCE', 'Controllo duplicati CNCE'] },
    { k: 'report', nome: 'Report ed export', titoli: ['Estrazione XML', 'Schema XSD', 'Estrazione CEIV', 'Report statistico', 'Excel'] },
    { k: 'obiettivi', nome: 'Obiettivo dell\'esercizio', titoli: ['Obiettivo visite'] },
  ];
  let _gruppo = 'scrivania';
  const titoloDi = (sez) => { const t = sez.querySelector('.adm-section-title'); return t ? t.textContent : ''; };
  const gruppoDi = (sez) => { const t = titoloDi(sez); const g = GRUPPI.find((x) => x.titoli.some((c) => t.includes(c))); return g ? g.k : 'altro'; };

  function ufficioFiltra() {
    const vista = $('view-segreteria'); if (!vista) return;
    const sezioni = [...vista.querySelectorAll('.adm-wrap .adm-section')];
    let altro = 0;
    sezioni.forEach((s) => { const g = gruppoDi(s); if (g === 'altro' && titoloDi(s)) altro++; s.style.display = g === _gruppo ? '' : 'none'; });
    const m = $('v2-uff-menu');
    if (m) {
      m.querySelectorAll('button[data-g]').forEach((b) => b.classList.toggle('on', b.dataset.g === _gruppo));
      const ba = m.querySelector('button[data-g="altro"]'); if (ba) ba.style.display = altro ? '' : 'none';   // ciò che non rientra in un gruppo non sparisce: va in «Altro»
    }
    const scr = $('v2-scrivania'); if (scr) scr.style.display = _gruppo === 'scrivania' ? '' : 'none';
    try { leggibileIn('view-segreteria'); } catch (e) { console.warn('veste v2 (leggibile):', e); }
    const rim = $('v2-rimandi');
    if (rim) {
      const g = GRUPPI.find((x) => x.k === _gruppo);
      rim.innerHTML = (g && g.rimandi || []).map(([v, t, s]) => `<div class="v2-card" style="padding:10px 16px"><div class="v2-riga"><div class="v2-t"><b>${t}</b><small>${esc(s)}</small></div><button type="button" class="btn-outline btn-sm" data-v2-az="vai:${v}">Apri</button></div></div>`).join('');
    }
  }
  function ufficioApri(g) { _gruppo = g; ufficioFiltra(); if (g === 'scrivania') scrivania().catch((e) => console.warn('scrivania:', e)); window.scrollTo(0, 0); }

  function ufficio() {
    const vista = $('view-segreteria'); if (!vista) return;
    const wrap = vista.querySelector('.adm-wrap'); if (!wrap) return;
    vista.classList.add('v2-uff');
    if (!$('v2-uff-menu')) {
      const m = document.createElement('div'); m.id = 'v2-uff-menu';
      m.innerHTML = GRUPPI.map((g) => `<button type="button" data-g="${g.k}">${esc(g.nome)}</button>`).join('')
        + '<button type="button" data-g="altro" style="display:none">Altro</button><hr>'
        + '<button type="button" data-vai="admin">🧭 Coordinamento</button>';
      m.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.g) ufficioApri(b.dataset.g);
        else if (b.dataset.vai && typeof window.navTo === 'function') window.navTo(b.dataset.vai);
      });
      vista.insertBefore(m, wrap);
    }
    if (!$('v2-scrivania')) {
      const testa = wrap.querySelector('.adm-header');
      const s = document.createElement('div'); s.id = 'v2-scrivania';
      const r = document.createElement('div'); r.id = 'v2-rimandi';
      if (testa && testa.nextSibling) { wrap.insertBefore(r, testa.nextSibling); wrap.insertBefore(s, r); } else { wrap.prepend(r); wrap.prepend(s); }
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v2-az]'); if (!b) return;
        const az = b.dataset.v2Az;
        if (az.startsWith('vai:') && typeof window.navTo === 'function') window.navTo(az.slice(4));
        else if (az.startsWith('gruppo:')) ufficioApri(az.slice(7));
      });
    }
    const h = wrap.querySelector('.adm-header h2'); if (h) h.textContent = 'Ufficio';
    ufficioFiltra();
    // l'obiettivo dell'esercizio e altri riquadri si disegnano dopo: si rifà il filtro quando arrivano
    setTimeout(ufficioFiltra, 1500); setTimeout(ufficioFiltra, 4500);
    if (_gruppo === 'scrivania') scrivania().catch((e) => console.warn('scrivania:', e));
  }

  /* 04/10/2026: i conteggi partono due alla volta, non tutti insieme. Otto letture in parallelo, sommate a
     scadenzario, app asseverazione e funzioni automatiche, alle 20:40 hanno saturato il database: anche le
     letture da pochi millisecondi sono andate oltre gli 8 secondi e sono state interrotte. Ogni elemento è
     una funzione che parte solo quando c'è posto; l'ordine dei risultati resta quello dell'elenco. */
  async function aScaglioni(lavori, quanti) {
    const esiti = new Array(lavori.length); let prossimo = 0;
    const operaio = async () => { while (prossimo < lavori.length) { const i = prossimo++; esiti[i] = await lavori[i](); } };
    await Promise.all(Array.from({ length: Math.min(quanti, lavori.length) }, operaio));
    return esiti;
  }

  async function scrivania() {
    const el = $('v2-scrivania'); if (!el) return;
    const sb = window.sb; if (!sb) return;
    el.innerHTML = '<div class="v2-card" style="color:#888">⏳ Conto quello che aspetta…</div>';
    const [esOra, esPrima] = esercizi();
    const rpc = async (f, a) => { const { data, error } = await sb.rpc(f, a); if (error) throw new Error(error.message); return data; };
    const righe = async (q) => { const { count, error } = await q; if (error) throw new Error(error.message); return count || 0; };
    const [ossPrima, ossOra, senzaCf, mailAltri, proposte, incarichi, bozze, questioni] = await aScaglioni([
      () => conta(async () => (await rpc('osservatorio_controllo', { p_dal: esPrima.dal, p_al: esPrima.al, p_dettaglio: false })).ferme, 'Osservatorio esercizio precedente'),
      () => conta(async () => (await rpc('osservatorio_controllo', { p_dal: esOra.dal, p_al: esOra.al, p_dettaglio: false })).ferme, 'Osservatorio esercizio in corso'),
      () => conta(async () => ((await rpc('imprese_senza_cf')) || []).length, 'Imprese senza codice fiscale'),
      () => conta(async () => ((await rpc('imprese_mail_di_altri')) || []).filter((r) => !r.stessa_della_cassa).length, 'Imprese con l\'indirizzo di un\'altra impresa'),
      () => conta(async () => { if (!window.propChius || !window.propChius.aperte) throw new Error('funzione non disponibile'); return (await window.propChius.aperte()).size; }, 'Cantieri proposti per la chiusura'),
      () => conta(() => righe(sb.from('incarichi').select('id', { count: 'exact', head: true }).eq('stato', 'aperto')), 'Incarichi aperti'),
      () => conta(() => righe(sb.from('visite').select('visita_id', { count: 'exact', head: true }).eq('elimina', 0).eq('stato', 'bozza')), 'Verbali in bozza'),
      () => conta(() => righe(sb.from('s_decisioni').select('id', { count: 'exact', head: true }).in('stato', ['aperta', 'rinviata'])), 'Questioni in attesa'),
    ], 2);
    el.innerHTML = '<div class="v2-titolo" style="margin:4px 2px 10px">Scrivania — quello che aspetta</div>'
      + rigaScr(ossPrima, 'Visite ferme per l\'Osservatorio · esercizio ' + esPrima.nome, 'non entrano nei file finché manca un dato obbligatorio: vanno sistemate prima dell\'invio annuale', 'gruppo:report', 'Apri')
      + rigaScr(ossOra, 'Visite ferme per l\'Osservatorio · esercizio ' + esOra.nome, 'l\'esercizio in corso', 'gruppo:report', 'Apri')
      + rigaScr(proposte, 'Cantieri proposti per la chiusura', 'mandati dai tecnici, in attesa della tua risposta (riquadro in «Oggi»)', 'vai:dashboard', 'Apri')
      + rigaScr(questioni, 'Questioni in attesa di decisione', 'aperte da coordinatore e segreteria per Direzione e Presidenza', 'vai:admin', 'Apri')
      + rigaScr(incarichi, 'Incarichi aperti', 'da assegnare, da evadere o con la visita fatta e da chiudere', 'vai:incarichi', 'Apri')
      + rigaScr(bozze, 'Verbali ancora in bozza', 'di tutti i tecnici: restano fuori da statistiche e Osservatorio finché non si chiudono', 'vai:lista', 'Apri')
      + rigaScr(senzaCf, 'Imprese visitate senza codice fiscale', 'per le società «= P.IVA» lo copia: resta da confermare', 'gruppo:qualita', 'Apri')
      + rigaScr(mailAltri, 'Imprese con l\'indirizzo di un\'altra impresa', 'i loro verbali partono verso l\'indirizzo sbagliato: si decide riga per riga', 'gruppo:qualita', 'Apri');
  }

  /* ── OGGI: le bozze aperte di chi è collegato ── */
  async function bozze() {
    const sb = window.sb; const el = $('v2-bozze'); if (!el || !sb) return;
    const tid = diChi().id;
    if (!tid || RUOLI[ruolo()].lettura) { el.innerHTML = ''; return; }
    const { data, error } = await sb.from('visite')
      .select('visita_id,nr_verbale,data_visita,cantieri(cantiere_indirizzo,cantiere_civico,comune_nome)')
      .eq('elimina', 0).eq('stato', 'bozza').eq('tecnico_id', tid).order('data_visita', { ascending: false }).limit(5);
    if (error) { el.innerHTML = '<div class="v2-card" style="color:#C0392B">Non sono riuscito a leggere le tue bozze aperte (' + esc(error.message) + ').</div>'; return; }
    if (!data || !data.length) { el.innerHTML = ''; return; }
    const g = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
    el.innerHTML = '<div class="v2-card v2-bordo"><div class="v2-micro">' + (data.length === 1 ? 'Bozza aperta' : 'Bozze aperte') + '</div>'
      + data.map((v) => { const c = v.cantieri || {}; return `<div class="v2-riga"><div class="v2-t"><b>${esc(v.nr_verbale || 'senza numero')} · ${esc([c.cantiere_indirizzo, c.cantiere_civico].filter(Boolean).join(' '))}${c.comune_nome ? ', ' + esc(c.comune_nome) : ''}</b><small>visita del ${g(v.data_visita)} · da completare e chiudere</small></div><button type="button" class="btn-primary btn-sm" data-v2-bozza="${esc(v.visita_id)}">Riprendi ›</button></div>`; }).join('')
      + '</div>';
    if (!el._v2ascolta) {
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-v2-bozza]'); if (b && typeof window.riapriBozza === 'function') window.riapriBozza(b.dataset.v2Bozza); });
      el._v2ascolta = true;
    }
  }

  /* ── OGGI: il riepilogo del prototipo, sui dati veri ──
     Rientri e incarichi li calcolano loadScadenze e loadIncarichi (index.html), che poi chiamano pronto(): qui si
     disegnano soltanto. Le pagine Scadenze e Incarichi restano a sé, col loro numero nel menu. */
  /* quarto elemento: la classe del riquadro. L'Asseverazione preme il pulsante di sempre (nav-assev), che la veste tiene
     nascosto nel menu: compare solo a chi è asseveratore, cioè a chi quel pulsante l'aveva già (dataset.v2Mostra). */
  const AZIONI = [['btn-segnala-dash', '📍', 'Segnala cantiere', 'v2-arancio'], ['btn-diniego-dash', '🚫', 'Accesso negato'], ['btn-qr-servizi', '📱', 'QR servizi CPT'],
    ['btn-servizi-cpt', '↗', 'Servizi CPT', 'v2-verde'], ['nav-assev', '✅', 'Asseverazione', 'v2-blu'],
    ['btn-dove-sono', '📡', 'Dove sono?'], ['btn-appunti', '📝', 'Appunti cantiere']];
  const azioneVisibile = (id) => {
    const o = $(id); if (!o) return false;
    if (id === 'nav-assev') {
      // «Vedi come…»: conta il tecnico GUARDATO, non la segreteria che guarda (l'elenco degli asseveratori è quello dell'app)
      if (simula() && Array.isArray(window.__assevEmails)) return ruolo() !== 'tecnico' && ruolo() !== 'coordinatore' ? false : window.__assevEmails.includes(diChi().email);
      if (o.dataset.v2Mostra !== undefined) return o.dataset.v2Mostra !== 'none';
    }
    return o.style.display !== 'none';
  };
  function azioniDisegna() {
    const el = $('v2-azioni'); if (!el) return;
    el.innerHTML = AZIONI.filter(([id]) => azioneVisibile(id))
      .map(([id, icona, testo, classe]) => `<button type="button" data-v2-preme="${id}"${classe ? ' class="' + classe + '"' : ''}><span>${icona}</span>${esc(testo)}</button>`).join('');
  }
  const _dati = { scadenze: undefined, incarichi: undefined, quando: 0 };
  const gg = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] : ''; };
  const mappa = (lat, lng, testo) => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(lat != null && lng != null && lat !== '' && lng !== '' ? lat + ',' + lng : testo);

  function oggiPagina() {
    const vista = $('view-dashboard'); if (!vista) return;
    let box = $('v2-oggi');
    if (!box) {
      box = document.createElement('div'); box.id = 'v2-oggi';
      box.innerHTML = '<div class="v2-data" id="v2-oggi-data"></div><h2 id="v2-oggi-ciao"></h2><div id="v2-posto-notifiche"></div><div class="v2-colonne">'
        + '<div class="v2-c1"><div id="v2-bozze"></div><div id="v2-rientri"></div><div id="v2-incarichi"></div></div>'
        + '<div class="v2-c2"><div id="v2-azioni"></div><div id="v2-posto-obiettivo"></div><div id="v2-posto-avvisi"></div></div></div>';
      vista.insertBefore(box, vista.firstChild);
      // obiettivo del mese e bacheca avvisi sono quelli di sempre: si spostano nella colonna, non si rifanno
      const ob = $('card-target-mese'); if (ob) $('v2-posto-obiettivo').appendChild(ob);
      const av = $('avvisi-banner'); if (av) $('v2-posto-avvisi').appendChild(av);
      // (04/10/2026, chiesto dall'utente) le notifiche sul telefono in cima, sotto il saluto: in fondo alla pagina non si vedevano
      const nt = $('dash-notifiche'); if (nt) $('v2-posto-notifiche').appendChild(nt);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v2-preme],[data-v2-ritorno],[data-v2-incarico],[data-v2-vai]'); if (!b) return;
        if (b.dataset.v2Preme) { const d = $(b.dataset.v2Preme); if (d) d.click(); return; }
        if (b.dataset.v2Vai && typeof window.navTo === 'function') { window.navTo(b.dataset.v2Vai); return; }
        if (b.dataset.v2Ritorno) {
          if (typeof window.chiediNuovaVisitaRitorno === 'function') window.chiediNuovaVisitaRitorno(b.dataset.v2Ritorno, b.dataset.v2Verbale || '');
          else if (typeof window.navTo === 'function') window.navTo('scadenze');
          return;
        }
        if (b.dataset.v2Incarico && typeof window.incNuovaVisita === 'function') window.incNuovaVisita(Number(b.dataset.v2Incarico), b.dataset.v2Mio === '1');
      });
    }
    const ora = new Date(), h = ora.getHours();
    const data = ora.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    $('v2-oggi-data').textContent = data.charAt(0).toUpperCase() + data.slice(1);
    const nome = (S().tecnico && S().tecnico.tecnico_nome) || '';
    $('v2-oggi-ciao').textContent = (h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera') + (nome ? ', ' + nome : '');
    oggiDisegna();
  }

  function oggiDisegna() {
    azioniDisegna();   // anche quando in «Vedi come…» si cambia il tecnico guardato
    const chi = diChi(), tutti = chi.tutti, mio = chi.id;
    const dopoTitolo = tutti ? ' · tutti i tecnici' : chi.anteprima && chi.nome ? ' · ' + esc(chi.nome) : '';
    const r = $('v2-rientri');
    if (r) {
      const d = _dati.scadenze;
      if (d === undefined) r.innerHTML = '<div class="v2-card" style="color:#888">⏳ Leggo i rientri scaduti…</div>';
      else if (d === null) r.innerHTML = '<div class="v2-card" style="color:#C0392B">Non sono riuscito a leggere i rientri: apri la pagina Scadenze.</div>';
      else {
        const urg = (d.urgenti || []).filter((v) => tutti || String(v.tecnico_id) === String(mio));
        const pross = (d.prossime || []).filter((v) => tutti || String(v.tecnico_id) === String(mio));
        /* (04/10/2026, design scelto dall'utente) i rientri raggruppati per giorno: scaduti in arancione, poi i prossimi
           7 giorni, una riga compatta per cantiere; il tocco sulla riga apre il verbale (rientri-giorni.js) */
        r.innerHTML = `<div class="v2-card"><div class="v2-testa"><div class="v2-titolo">📅 Rientri${dopoTitolo}</div><small>scaduti e prossimi 7 giorni</small></div>`
          + '<div id="v2-rientri-lista" style="margin:0 -18px"></div>'
          + `<div class="v2-piede"><a data-v2-vai="scadenze">Tutte le scadenze › </a><span style="color:#888">${urg.length} ${urg.length === 1 ? 'scaduto' : 'scaduti'} · ${pross.length} nei prossimi 60 giorni</span></div></div>`;
        const lista = $('v2-rientri-lista');
        if (lista && window.RientriGiorni) {
          try {
            window.RientriGiorni.render(lista, { urgenti: urg, prossime: pross, tecMap: d.tecMap, maxScaduti: 5, entroGiorni: 7,
              segreteria: ruolo() === 'segreteria', puoVisitare: !RUOLI[ruolo()].lettura,
              dopo: () => (typeof window.ricaricaScadenze === 'function' ? window.ricaricaScadenze() : null) });
          } catch (e) { console.warn('veste v2 (rientri per giorno):', e); lista.innerHTML = '<div style="padding:8px 18px;color:#C0392B">Non sono riuscito a disegnare i rientri: apri la pagina Scadenze.</div>'; }
        }
      }
    }
    const i = $('v2-incarichi');
    if (i) {
      const d = _dati.incarichi;
      if (d === undefined) i.innerHTML = '<div class="v2-card" style="color:#888">⏳ Leggo gli incarichi…</div>';
      else if (d === null) i.innerHTML = '<div class="v2-card" style="color:#C0392B">Non sono riuscito a leggere gli incarichi: apri la pagina Incarichi.</div>';
      else {
        const io = chi.email;
        // la segreteria legge gli incarichi di tutti: per un tecnico (vero o guardato in anteprima) si tengono i suoi
        const aperti = d.filter((x) => x.stato === 'aperto' && (tutti || String(x.tecnico_email || '').toLowerCase() === io));
        /* (07/10/2026, chiesto dall'utente) prima quelli che aspettano da più tempo, le serie di visite in fondo:
           durano mesi e coprirebbero gli altri */
        const att = (x) => (typeof window.incAttesa === 'function' ? window.incAttesa(x) : { serie: false, giorni: null });
        const ordinati = aperti.slice().sort((a, b) => {
          const A = att(a), B = att(b);
          if (A.serie !== B.serie) return A.serie ? 1 : -1;
          return (B.giorni == null ? -1 : B.giorni) - (A.giorni == null ? -1 : A.giorni) || Number(a.id) - Number(b.id);
        });
        const righe = ordinati.slice(0, 5).map((x) => {
          const suo = !!x.tecnico_email && String(x.tecnico_email).toLowerCase() === io;
          const visita = typeof window.incTipoAccesso === 'function' && window.incTipoAccesso(x) != null;
          const dove = [x.indirizzo, x.comune].filter(Boolean).join(', ');
          const attesa = typeof window.incAttesaHtml === 'function' ? window.incAttesaHtml(x) : (x.data_richiesta ? 'dal ' + gg(x.data_richiesta) : '');
          const impresa = typeof window.incImpresaTesto === 'function' ? window.incImpresaTesto(x) : (x.impresa || x.richiedente);
          return `<div class="v2-riga"><div class="v2-t"><div class="v2-sopra">n. ${esc(x.id)} · ${esc(x.tipo_richiesta || 'richiesta')}${attesa ? ' · ' + attesa : ''}${!x.presa_visione_il ? ' · <b style="color:var(--orange)">nuovo</b>' : ''}</div>`
            + `<b>${impresa ? esc(impresa) : impresa === '' ? (window.INC_IMPRESA_DA_TROVARE || 'impresa da individuare in cantiere') : '—'}</b><small>${dove ? '› ' + esc(dove) : ''}${tutti && x.tecnico_nome ? (dove ? ' · ' : '') + esc(x.tecnico_nome) : ''}</small></div>`
            + `<div class="v2-bottoni">${dove ? `<a style="width:44px;height:44px;min-height:0;padding:0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;text-decoration:none;border:0;background:#f3f4f5;color:#565c66" target="_blank" rel="noopener" href="${esc(mappa(null, null, dove))}" aria-label="Naviga all'indirizzo dell'incarico" data-aiuto="Apre il navigatore verso l'indirizzo dell'incarico."><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"></path></svg></a>` : ''}`
            + (visita && !chi.anteprima && (suo || tutti)
              ? `<button type="button" style="width:44px;height:44px;min-height:0;padding:0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border:1.5px solid #e7500f;background:#fff;color:#e7500f;cursor:pointer" data-v2-incarico="${esc(x.id)}" data-v2-mio="${suo ? 1 : 0}" data-aiuto="Apre il verbale con impresa e cantiere dell'incarico già compilati. Se l'incarico è tuo, lo accetta." aria-label="Avvia visita"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></button>`
              : `<button type="button" class="btn-outline btn-sm" data-v2-vai="incarichi" data-aiuto="Apre la pagina Incarichi, dove accetti, rifiuti o chiudi l'incarico.">Apri</button>`)
            + '</div></div>';
        }).join('');
        i.innerHTML = `<div class="v2-card"><div class="v2-testa"><div class="v2-titolo">📥 Incarichi da evadere${dopoTitolo}</div><small>dalla segreteria</small></div>`
          + (aperti.length ? righe : '<div style="padding:8px 0;color:#5F8A12">Nessun incarico da evadere.</div>')
          + `<div class="v2-piede"><a data-v2-vai="incarichi">Tutti gli incarichi › </a><span style="color:#888">${aperti.length} ${aperti.length === 1 ? 'aperto' : 'aperti'}</span></div></div>`;
      }
    }
  }
  /* chiamata da navTo quando loadScadenze / loadIncarichi hanno finito: dati = null se la lettura è fallita */
  function pronto(tipo, dati) {
    try { _dati[tipo] = dati == null ? null : dati; if (tipo === 'scadenze') _dati.quando = Date.now(); oggiDisegna(); if (tipo === 'incarichi' && $('v2-inc-schede')) incarichiSchede(); } catch (e) { console.warn('veste v2 (pronto):', e); }
  }

  /* ── IL VERBALE IN TRE MOMENTI (scelta dell'utente: «tre momenti, passi di oggi») ──
     1 · Prima di entrare: incarico, cantiere, e la parte «Visita» (verbale, tecnici, data, ora, tipologia) in una pagina sola.
     2 · In cantiere: persona presente, imprese, le dieci aree della check-list.
     3 · A fine visita: note, foto, riepilogo con l'ora di fine e i pulsanti Bozza e Definitivo di sempre.
     I passi restano quelli dell'app: per cambiare passo si preme il pulsante del passo di sempre (che salva la
     check-list e disegna la pagina). Qui si decide solo che cosa si vede insieme. Il passo 0 «Visita» sta in due
     momenti: la parte alta nel primo, la persona presente nel secondo. */
  const FASI = [null,
    { sopra: '1 · PRIMA DI ENTRARE', sotto: 'Dove e perché', tabs: [1, 0] },
    { sopra: '2 · IN CANTIERE', sotto: 'Cosa trovo', tabs: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { sopra: '3 · A FINE VISITA', sotto: 'Chiudo e invio', tabs: [13, 14, 15] }];
  let _fase = 1, _mioPasso = false, _daBarra = false, _verso = null, _evAgganciati = false;
  const tabOra = () => Number(S().tab) || 0;
  const faseDi = (tab) => (tab === 1 ? 1 : tab >= 2 && tab <= 12 ? 2 : tab >= 13 ? 3 : null);   // il passo 0 sta in due momenti
  function premiPasso(n) { const b = document.querySelector('#tab-bar .tab-btn[data-ti="' + n + '"]'); if (!b) return; _mioPasso = true; try { b.click(); } finally { _mioPasso = false; } }
  function vaiFase(f, tab) { _fase = f; document.body.classList.remove('v2-area-chiusa'); premiPasso(tab != null ? tab : FASI[f].tabs[0]); verbaleApplica(); window.scrollTo(0, 0); }
  /* il campo da raggiungere sta nella persona presente? (lo chiede vaiAlCampoMancante prima di aprire il passo) */
  function verso(campo) { try { const el = campo && $(campo); _verso = el && el.closest && el.closest('.v2-persona') ? 'persona' : null; } catch (_e) { _verso = null; } }
  function passoCambiato(n) {
    if (!document.body.classList.contains('v2')) return;
    // se il passo l'ha cambiato l'app (un avviso che porta a un campo, una bozza riaperta) il momento si ricava dal passo
    if (!_mioPasso && !_daBarra) { _fase = faseDi(n) || (_verso === 'persona' ? 2 : 1); document.body.classList.remove('v2-area-chiusa'); }   // l'app porta a un passo: la sua riga si apre
    _verso = null;
    verbaleApplica();
  }
  function avantiIndietro(e, dir) {
    if (!document.body.classList.contains('v2')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (_fase === 3) { if (dir < 0) vaiFase(2, 12); return; }   // il terzo momento è una pagina sola
    const seq = FASI[_fase].tabs, i = seq.indexOf(tabOra());
    if (dir > 0) {
      if (_fase === 1) return vaiFase(2, 0);
      if (i >= 0 && i < seq.length - 1) return vaiFase(_fase, seq[i + 1]);
      if (_fase === 2) return vaiFase(3, 13);
    } else {
      if (_fase === 1) return;
      if (i > 0) return vaiFase(_fase, seq[i - 1]);
      if (_fase === 2) return vaiFase(1, 1);
      if (_fase === 3) return vaiFase(2, 12);
    }
  }
  function verbaleAggancia() {
    if (_evAgganciati) return; _evAgganciati = true;
    // activateTab avvisa già la mappa a ogni cambio di passo: si ascolta lo stesso avviso
    const prima = window.mappaEvento;
    window.mappaEvento = function (tipo, arg) {
      try { if (tipo === 'tab') passoCambiato(Number(arg)); else if (tipo === 'form') { _fase = 1; setTimeout(verbaleApplica, 0); } } catch (e) { console.warn('veste v2 (verbale):', e); }
      return typeof prima === 'function' ? prima.apply(this, arguments) : undefined;
    };
    const p = $('btn-prev'), n = $('btn-next'), bar = $('tab-bar');
    if (p) p.addEventListener('click', (e) => avantiIndietro(e, -1), true);
    if (n) n.addEventListener('click', (e) => avantiIndietro(e, +1), true);
    if (bar) bar.addEventListener('click', () => { _daBarra = true; setTimeout(() => { _daBarra = false; }, 0); }, true);
    const vf = $('view-form');
    if (vf) ['change', 'input'].forEach((ev) => vf.addEventListener(ev, () => {
      if (!document.body.classList.contains('v2')) return;
      if (_fase === 2) setTimeout(() => { try { areeRighe(); } catch (_e) { /* il riepilogo è un di più */ } }, 0);
      if (_fase === 3 && ev === 'change') terzoAggiorna();
    }));
  }
  function verbalePrepara() {
    const vista = $('view-form'); if (!vista) return false;
    const layout = vista.querySelector('.form-layout'), area = vista.querySelector('.tab-area'); if (!layout || !area) return false;
    if (!$('v2-fasi')) {
      const b = document.createElement('div'); b.id = 'v2-fasi';
      b.innerHTML = '<div class="v2-fasi-sx"><small>VERBALE</small><b id="v2-fasi-nr"></b></div>'
        + [1, 2, 3].map((f) => `<button type="button" data-fase="${f}"><small>${FASI[f].sopra}</small>${FASI[f].sotto}</button>`).join('');
      b.addEventListener('click', (e) => { const x = e.target.closest('button[data-fase]'); if (x) vaiFase(Number(x.dataset.fase)); });
      layout.parentNode.insertBefore(b, layout);
    }
    // la parte alta del passo «Visita» e la persona presente: si marcano, non si spostano
    const card = vista.querySelector('.tab-content[data-tab="0"] > .card');
    if (card && !card.dataset.v2Marcata) {
      let persona = false;
      [...card.children].forEach((el) => {
        if (el.classList.contains('sect-title') && /Persona presente/i.test(el.textContent)) persona = true;
        el.classList.add(persona ? 'v2-persona' : 'v2-visita');
      });
      card.dataset.v2Marcata = '1';
    }
    // «Parti da un tuo incarico» sale in cima al primo momento (torna al suo posto quando la veste si spegne)
    const inc = $('inc-scelta-box');
    if (inc && inc.parentNode !== area) { inc.classList.remove('v2-visita'); area.insertBefore(inc, area.firstChild); }
    return true;
  }
  function verbaleApplica() {
    if (!document.body.classList.contains('v2') || !verbalePrepara()) return;
    [1, 2, 3].forEach((f) => document.body.classList.toggle('v2-fase' + f, _fase === f));
    document.querySelectorAll('#v2-fasi button[data-fase]').forEach((b) => { const f = Number(b.dataset.fase); b.classList.toggle('on', f === _fase); b.classList.toggle('fatta', f < _fase); });
    const nr = $('v2-fasi-nr'); if (nr) nr.textContent = ($('f-verbale') && $('f-verbale').value) || 'nuovo';
    momentoUno();
    try { if (_fase !== 2) document.body.classList.remove('v2-area-chiusa'); areeRighe(); } catch (e) { console.warn('veste v2 (righe):', e); }
    try { terzoMomento(); } catch (e) { console.warn('veste v2 (terzo momento):', e); }
    const b0 = document.querySelector('#tab-bar .tab-btn[data-ti="0"]'); if (b0) b0.textContent = _fase === 2 ? '👤 Persona presente' : '📋 Visita';
    const p = $('btn-prev'), n = $('btn-next'), t = tabOra();
    if (p) { p.disabled = _fase === 1; p.textContent = '‹ Indietro'; }
    if (n) { n.disabled = _fase === 3 || t === 15; n.textContent = _fase === 1 ? 'In cantiere ›' : (_fase === 2 && t === 12) ? 'A fine visita ›' : 'Successivo ›'; }
  }

  /* ── PRIMO MOMENTO DEL VERBALE, come nel prototipo ──
     Tre aiuti sopra i campi di sempre. Nessuno scrive dati per conto suo: ognuno preme o riempie il campo che
     c'è già (la tendina dell'incarico, la scelta del cantiere, la tendina della tipologia). */

  /* 1 · «Parti da un tuo incarico» (nel prototipo «Perché sei qui»: l'utente ha chiesto se fosse la stessa cosa, e il
     titolo è tornato quello che i tecnici conoscono e che sta nel manuale): gli incarichi aperti come schede. La scheda preme la tendina «Parti da un tuo incarico»,
     che fa tutto quello che fa oggi (accetta l'incarico se è tuo, compila impresa e cantiere). */
  function incarichiSchede() {
    const box = $('inc-scelta-box'), sel = $('f-prot-inc'); if (!box || !sel) return;
    let el = $('v2-inc-schede');
    if (!el) {
      el = document.createElement('div'); el.id = 'v2-inc-schede'; box.appendChild(el);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-inc]'); if (!b) return;
        if (sel.value === b.dataset.inc) return;
        sel.value = b.dataset.inc;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        incarichiSchede(); setTimeout(tipoPulsanti, 500);
      });
      if (typeof MutationObserver === 'function') new MutationObserver(() => incarichiSchede()).observe(sel, { childList: true });
    }
    const noti = {}; (Array.isArray(_dati.incarichi) ? _dati.incarichi : []).forEach((x) => { noti[String(x.id)] = x; });
    const schede = [...sel.options].filter((o) => o.value).map((o) => {
      const x = noti[o.value], et = String(o.textContent || '');
      const nome = et.replace(/^\s*\d+\s*·\s*/, '');
      const dove = x ? [x.indirizzo, x.comune].filter(Boolean).join(', ') : '';
      return `<button type="button" class="v2-scheda${sel.value === o.value ? ' on' : ''}" data-inc="${esc(o.value)}"><small>n. ${esc(o.value)}${x && x.tipo_richiesta ? ' · ' + esc(x.tipo_richiesta) : ''}</small><b>${esc(x && x.impresa ? x.impresa : nome)}</b>${dove ? '<small>› ' + esc(dove) + '</small>' : ''}</button>`;
    });
    el.innerHTML = '<div class="v2-titolo" style="margin-bottom:10px">Parti da un tuo incarico</div><div class="v2-griglia">' + schede.join('')
      + `<button type="button" class="v2-scheda v2-tratt${sel.value ? '' : ' on'}" data-inc=""><b>Visita d'iniziativa</b><small>Nessun incarico collegato</small></button></div>`;
  }

  /* 2 · «Cantieri vicini a me»: su richiesta (la posizione si chiede solo se si preme), i tre cantieri aperti più
     vicini. La scheda sceglie il cantiere con la funzione di sempre. */
  const km = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  function piuVicini(cantieri, lat, lng, quanti) {
    return (cantieri || []).filter((c) => c.lat != null && c.lng != null).map((c) => Object.assign({}, c, { km: km(lat, lng, Number(c.lat), Number(c.lng)) })).sort((a, b) => a.km - b.km).slice(0, quanti || 3);
  }
  function cantieriVicini() {
    const campo = $('f-cant-comune'); const riga = campo && campo.closest('.row'); if (!riga || $('v2-vicini')) return;
    const el = document.createElement('div'); el.id = 'v2-vicini';
    el.innerHTML = '<button type="button" class="btn-outline btn-sm" id="v2-vicini-btn" data-aiuto="Chiede al telefono dove sei e mostra i tre cantieri aperti più vicini. Non salva la posizione.">📍 Cantieri vicini a me</button><div id="v2-vicini-esito"></div>';
    riga.parentNode.insertBefore(el, riga);
    const esito = $('v2-vicini-esito');
    el.addEventListener('click', async (e) => {
      const scheda = e.target.closest('button[data-cant]');
      if (scheda) {
        const usa = window.__app && window.__app._useCantiereEsistente;
        const { data, error } = await window.sb.from('cantieri').select('*').eq('cantiere_id', scheda.dataset.cant).maybeSingle();
        if (error || !data || typeof usa !== 'function') { esito.innerHTML = '<div class="v2-nota" style="color:#C0392B">Non sono riuscito ad aprire il cantiere: cercalo dal campo qui sotto.</div>'; return; }
        await usa(data);
        esito.querySelectorAll('button[data-cant]').forEach((b) => b.classList.toggle('on', b === scheda));
        return;
      }
      if (!e.target.closest('#v2-vicini-btn')) return;
      if (!navigator.geolocation) { esito.innerHTML = '<div class="v2-nota">Questo dispositivo non dà la posizione: cerca il cantiere dal campo qui sotto.</div>'; return; }
      esito.innerHTML = '<div class="v2-nota">⏳ Chiedo la posizione…</div>';
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude, d = 0.2;   // circa 20 km
        const { data, error } = await window.sb.from('cantieri').select('cantiere_id,cantiere_indirizzo,cantiere_civico,cantiere_etichetta,comune_nome,lat,lng')
          .eq('elimina', 0).or('cantiere_chiuso.is.null,cantiere_chiuso.eq.false')
          .gte('lat', lat - d).lte('lat', lat + d).gte('lng', lng - d * 1.4).lte('lng', lng + d * 1.4).limit(600);
        if (error) { esito.innerHTML = '<div class="v2-nota" style="color:#C0392B">Non sono riuscito a leggere i cantieri (' + esc(error.message) + '): cerca dal campo qui sotto.</div>'; return; }
        const v = piuVicini(data, lat, lng, 3);
        esito.innerHTML = v.length
          ? '<div class="v2-griglia" style="margin-top:10px">' + v.map((c) => `<button type="button" class="v2-scheda" data-cant="${esc(c.cantiere_id)}"><span class="v2-km">${c.km < 10 ? c.km.toFixed(1).replace('.', ',') : Math.round(c.km)} km</span><b>${esc([c.cantiere_indirizzo, c.cantiere_civico].filter(Boolean).join(' ') || c.cantiere_etichetta || '—')}</b><small>${esc(c.comune_nome || '')}</small></button>`).join('') + '</div><div class="v2-nota">Ordinati dalla tua posizione. Se il cantiere non è fra questi, cercalo qui sotto.</div>'
          : '<div class="v2-nota">Nessun cantiere aperto con la posizione nota entro 20 km: cercalo dal campo qui sotto.</div>';
      }, (err) => { esito.innerHTML = '<div class="v2-nota">Posizione non disponibile (' + esc(err && err.message || 'permesso negato') + '): cerca il cantiere dal campo qui sotto.</div>'; }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });
  }

  /* 3 · Tipologia di accesso a pulsanti: le quattro più usate (contate sulle visite dal 01/10/2024: Programmata 609,
     Indicata dal CPT 533, Visite in serie 324, Progetto SPISAL 174) e «Altre». Il campo vero resta la tendina di sempre:
     i pulsanti la riempiono. NESSUNA è già scelta: la tipologia nasce vuota, o proposta dall'incarico. */
  const TIPI_FREQUENTI = ['5', '7', '8', '12'];
  function tipoPulsanti() {
    const sel = $('f-tipo'); if (!sel) return;
    let el = $('v2-tipo-chips');
    if (!el) {
      el = document.createElement('div'); el.id = 'v2-tipo-chips';
      sel.parentNode.insertBefore(el, sel);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.altre) { el.dataset.altre = el.dataset.altre === '1' ? '' : '1'; tipoPulsanti(); if (el.dataset.altre === '1') sel.focus(); return; }
        sel.value = sel.value === b.dataset.tipo ? '' : b.dataset.tipo;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        tipoPulsanti();
      });
      sel.addEventListener('change', () => tipoPulsanti());
    }
    const scelta = sel.value, fuori = !!scelta && !TIPI_FREQUENTI.includes(scelta);
    const etichetta = (v) => { const o = [...sel.options].find((x) => x.value === v); return o ? o.textContent : v; };
    const altre = [...sel.options].filter((o) => o.value && !TIPI_FREQUENTI.includes(o.value)).length;
    el.innerHTML = TIPI_FREQUENTI.map((v) => `<button type="button" data-tipo="${v}" class="${scelta === v ? 'on' : ''}">${esc(etichetta(v))}</button>`).join('')
      + `<button type="button" data-altre="1" class="v2-tratt${fuori ? ' on' : ''}">${fuori ? esc(etichetta(scelta)) + ' ›' : 'Altre ' + altre + ' ›'}</button>`;
    // la tendina si vede solo se si è chiesto «Altre»
    sel.classList.toggle('v2-tipo-nascosta', el.dataset.altre !== '1');
  }
  /* ── SECONDO MOMENTO: righe che si aprono ──
     Una riga per la persona presente, una per le imprese, una per ognuna delle dieci aree. La riga sta sopra la
     pagina di sempre di quel passo e la apre premendo il pulsante del passo (che salva la check-list e disegna la
     pagina). Il riepilogo si calcola da ciò che l'app ha già in memoria, e dalle scelte sullo schermo per l'area aperta. */
  const RIGHE2 = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  function areaConta(z) {
    const voci = ((S().byZona || {})[z] || []).filter((v) => !v.is_nota);
    const con = $('zi-' + z), chk = S().checklist || {};
    let fatte = 0, ncp = 0, ncm = 0, oss = 0;
    const disegnata = !!(con && con.querySelector('input[type=radio][data-c]'));   // l'area è già stata aperta: vale ciò che è sullo schermo
    voci.forEach((v) => {
      let val = '';
      if (disegnata) { const r = [...con.querySelectorAll('input[type=radio][data-c]:checked')].find((x) => x.dataset.c === String(v.codice)); val = r ? r.value : ''; }
      else val = chk[v.codice] || '';
      if (val) fatte++;
      if (val === 'NC+') ncp++; else if (val === 'NC-') ncm++; else if (val === 'OSS') oss++;
    });
    return { voci: voci.length, fatte, ncp, ncm, oss };
  }
  function areaRiepilogo(c) {
    if (!c.voci) return { testo: '', classe: '', stato: '' };
    if (!c.fatte) return { testo: 'da compilare', classe: '', stato: '' };
    const p = [c.fatte + ' di ' + c.voci];
    if (c.ncp) p.push(c.ncp + ' NC+'); if (c.ncm) p.push(c.ncm + ' NC−'); if (c.oss) p.push(c.oss + ' OSS');
    return { testo: p.join(' · '), classe: c.ncp ? 'ncp' : c.ncm ? 'ncm' : '', stato: c.fatte >= c.voci ? 'completa' : 'parziale' };
  }
  function areeRighe() {
    const area = document.querySelector('#view-form .tab-area'); if (!area) return;
    RIGHE2.forEach((n) => {
      const pagina = area.querySelector('.tab-content[data-tab="' + n + '"]'); if (!pagina) return;
      let riga = area.querySelector('.v2-area[data-ti="' + n + '"]');
      if (!riga) {
        riga = document.createElement('button'); riga.type = 'button'; riga.className = 'v2-area'; riga.dataset.ti = String(n);
        riga.innerHTML = '<span class="v2-pallino"></span><span class="v2-nome"></span><span class="v2-riep"></span><span class="v2-freccia"></span>';
        riga.addEventListener('click', () => {
          if (_fase !== 2) return;
          if (tabOra() === n && !document.body.classList.contains('v2-area-chiusa')) { document.body.classList.add('v2-area-chiusa'); areeRighe(); return; }
          document.body.classList.remove('v2-area-chiusa');
          vaiFase(2, n);
          const r = area.querySelector('.v2-area[data-ti="' + n + '"]'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        area.insertBefore(riga, pagina);
      }
      const aperta = _fase === 2 && tabOra() === n && !document.body.classList.contains('v2-area-chiusa');
      let nome, pallino, riep = { testo: '', classe: '', stato: '' };
      if (n === 0) {
        nome = 'Persona presente'; pallino = '👤';
        const chi = [($('f-ppre-nome') || {}).value, ($('f-ppre-cog') || {}).value].filter(Boolean).join(' ');
        const q = $('f-qual-ppre'), qual = q && q.selectedOptions && q.selectedOptions[0] && q.value ? q.selectedOptions[0].textContent : '';
        riep = chi ? { testo: chi + (qual ? ' · ' + qual : ''), classe: '', stato: qual ? 'completa' : 'parziale' } : { testo: 'da compilare', classe: '', stato: '' };
      } else if (n === 2) {
        nome = 'Imprese in cantiere'; pallino = '🏢';
        const imp = (S().imprese || []).filter((x) => x.impresa_id || x.impresa_nome);
        // (06/10/2026) più le imprese, i lavoratori e gli autonomi non censiti del riquadro sotto l'elenco
        const nc = typeof window.altreNonCensite === 'function' ? window.altreNonCensite() : { imp: 0, lav: 0, aut: 0 };
        const lav = imp.reduce((a, x) => a + (Number(x.nr_lav) || 0), 0) + nc.lav;
        const piu = nc.imp + nc.aut ? ' (+' + (nc.imp + nc.aut) + ' non censite)' : '';
        riep = imp.length ? { testo: imp.length + (imp.length === 1 ? ' impresa' : ' imprese') + piu + ' · ' + lav + (lav === 1 ? ' lavoratore' : ' lavoratori'), classe: '', stato: 'completa' } : { testo: 'da compilare', classe: '', stato: '' };
      } else {
        const b = document.querySelector('#tab-bar .tab-btn[data-ti="' + n + '"]');
        nome = b ? b.textContent.replace(/^\s*\d+\.\s*/, '') : 'Area ' + (n - 2); pallino = String(n - 2);
        riep = areaRiepilogo(areaConta(n - 2));
      }
      riga.className = 'v2-area' + (riep.stato ? ' ' + riep.stato : '') + (aperta ? ' aperta' : '');
      riga.children[0].textContent = pallino; riga.children[1].textContent = nome;
      riga.children[2].textContent = riep.testo; riga.children[2].className = 'v2-riep' + (riep.classe ? ' ' + riep.classe : '');
      riga.children[3].textContent = aperta ? '▾' : '›';
    });
  }

  /* ── TERZO MOMENTO: «Prima di chiudere» ──
     Un elenco che aiuta, calcolato da ciò che c'è nella maschera: NON è il giudice. A decidere se il verbale si chiude
     resta il database, quando si preme «Definitivo»: se manca altro, lo elenca lui. I nomi delle voci
     sono gli stessi di verbale_mancanze, così le due liste parlano la stessa lingua. */
  function requisiti() {
    const v = (id) => String(($(id) || {}).value || '').trim();
    const imp = (S().imprese || []).filter((x) => x.impresa_id || x.impresa_nome);
    const chk = S().checklist || {}, note = S().noteChk || {};
    const valutate = Object.keys(chk).filter((c) => ['VER', 'OSS', 'NC-', 'NC+'].includes(chk[c]));
    const haNota = (c) => !!String(note[c] || '').trim() || !!String(note[String(c).replace(/_\d+$/, '') + '_N'] || '').trim();
    const ncSenza = valutate.filter((c) => (chk[c] === 'NC+' || chk[c] === 'NC-') && !haNota(c));
    return [
      { cosa: 'cantiere', ok: !!v('f-cant-id'), testo: 'Cantiere scelto', campo: 'f-cant-search' },
      { cosa: 'ora-inizio', ok: !!v('f-data') && !!v('f-da'), testo: 'Data e ora di inizio', campo: v('f-data') ? 'f-da' : 'f-data' },
      { cosa: 'tipo-accesso', ok: !!v('f-tipo'), testo: 'Tipologia di accesso', campo: 'f-tipo' },
      { cosa: 'committente', ok: !!v('f-comm-id'), testo: 'Committente', campo: 'f-comm-search', tab: 1 },
      { cosa: 'coordinamento', ok: v('f-coord') !== '', testo: 'Coordinamento della sicurezza: Sì o No', campo: 'f-coord', tab: 1 },
      { cosa: 'lavorazioni', ok: (S().lavorazioni || []).length > 0, testo: 'Almeno una lavorazione in corso', tab: 1 },
      { cosa: 'persona-presente', ok: !!(v('f-ppre-nome') || v('f-ppre-cog')), testo: 'Persona presente', campo: 'f-ppre-cog' },
      { cosa: 'persona-qualifica', ok: !!v('f-qual-ppre'), testo: 'Qualifica della persona presente', campo: 'f-qual-ppre' },
      { cosa: 'imprese', ok: imp.length > 0, testo: 'Almeno un\'impresa', tab: 2 },
      { cosa: 'ruolo', ok: imp.length > 0 && imp.every((x) => x.tipo_imp), testo: 'Ruolo di ogni impresa', tab: 2 },
      { cosa: 'checklist', ok: valutate.length > 0, testo: 'Almeno una voce valutata nella check-list', tab: 3 },
      { cosa: 'nc-senza-nota', ok: ncSenza.length === 0, testo: 'Ogni non conformità con la sua nota' + (ncSenza.length ? ' (' + ncSenza.length + ' senza)' : ''), tab: 3 },
      { cosa: 'ora-fine', ok: !!v('f-a'), testo: 'Ora di fine', campo: 'f-a', nota: 'se chiudi oggi e la lasci vuota, ci va l\'ora di chiusura' },
    ];
  }
  function vaiA(r) {
    const el = r.campo ? $(r.campo) : null, pag = el && el.closest ? el.closest('.tab-content') : null;
    const tab = pag && pag.dataset.tab != null ? Number(pag.dataset.tab) : (r.tab != null ? r.tab : 15);
    const persona = !!(el && el.closest && el.closest('.v2-persona'));
    vaiFase(tab === 0 ? (persona ? 2 : 1) : (faseDi(tab) || 1), tab);
    setTimeout(() => { try { if (el && el.offsetParent !== null) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (el.focus) el.focus(); } } catch (_e) { /* il campo c'è, ma non prende il cursore */ } }, 150);
  }
  function requisitiDisegna() {
    const fine = $('f-a'), campo = fine && fine.closest('.field'); if (!campo) return;
    let el = $('v2-requisiti');
    if (!el) {
      el = document.createElement('div'); el.id = 'v2-requisiti'; campo.parentNode.insertBefore(el, campo);
      el.addEventListener('click', (e) => { const a = e.target.closest('a[data-req]'); if (a) vaiA(requisiti()[Number(a.dataset.req)]); });
    }
    const r = requisiti(), mancano = r.filter((x) => !x.ok).length;
    el.innerHTML = '<div class="v2-titolo">Prima di chiudere' + (mancano ? ' · mancano ' + mancano : ' · tutto a posto') + '</div>'
      + r.map((x, i) => `<div class="v2-req${x.ok ? ' ok' : ''}"><span class="v2-spunta">${x.ok ? '✓' : ''}</span><span class="v2-rt">${esc(x.testo)}${!x.ok && x.nota ? ' <span style="color:#888">— ' + esc(x.nota) + '</span>' : ''}</span>${x.ok || x.cosa === 'ora-fine' ? '' : `<a data-req="${i}">Completa ›</a>`}</div>`).join('')
      + '<small>È un aiuto: il controllo vero lo fa il gestionale quando premi «Definitivo». Se manca altro (per esempio un dato della scheda del cantiere) te lo elenca lui, e il verbale resta bozza.</small>';
  }
  /* entrando nel terzo momento si aprono, in fila, i tre passi di sempre: così l'app prepara le note (la data di
     rientro suggerita), le foto e il riepilogo. Poi restano tutti e tre sullo schermo. */
  let _fase3 = false, _aggiorna3 = null;
  function terzoMomento() {
    if (_fase !== 3) { _fase3 = false; return; }
    if (!_fase3) { _fase3 = true; [13, 14, 15].forEach((n) => premiPasso(n)); }
    requisitiDisegna();
  }
  function terzoAggiorna() {
    if (_fase !== 3) return;
    clearTimeout(_aggiorna3);
    _aggiorna3 = setTimeout(() => { try { premiPasso(15); requisitiDisegna(); } catch (_e) { /* il riepilogo si rifà al prossimo cambio */ } }, 300);
  }

  /* ── TELEFONO: le tabelle diventano schede ──
     Ogni cella prende il nome della sua colonna, e il foglio di stile (sotto i 720 px) la mostra come riga di una scheda.
     La tabella resta quella dell'app: ordinamenti, pulsanti e filtri non cambiano. */
  const _osservate = new Set();
  function celleConNome(sez) {
    sez.querySelectorAll('table').forEach((tb) => {
      const nomi = [...tb.querySelectorAll('thead th')].map((x) => x.textContent.replace(/[▲▼↕⇅]/g, '').trim());
      if (!nomi.length) return;
      tb.querySelectorAll('tbody tr').forEach((tr) => { [...tr.children].forEach((td, i) => { if (td.dataset.l === undefined) td.dataset.l = td.colSpan > 1 ? '' : (nomi[i] || ''); }); });
    });
  }
  function schedeTelefono(view) {
    if (!['lista', 'scadenze', 'cantieri'].includes(view)) return;
    const sez = $('view-' + view); if (!sez) return;
    sez.classList.add('v2-schede'); celleConNome(sez);
    if (!_osservate.has(view) && typeof MutationObserver === 'function') {
      _osservate.add(view);
      let inCoda = false;
      new MutationObserver(() => { if (inCoda || !document.body.classList.contains('v2')) return; inCoda = true; setTimeout(() => { inCoda = false; celleConNome(sez); }, 60); }).observe(sez, { childList: true, subtree: true });
    }
  }

  /* ── PILLOLE: Visite (stato), Rubrica (tipo), Statistiche (gruppo di grafici) ──
     Premono i filtri che ci sono già, o mostrano e nascondono i riquadri: niente di nuovo da calcolare. */
  function pillole(id, dove, voci, attiva, alClic) {
    let el = $(id);
    if (!el) { if (!dove || !dove.parentNode) return; el = document.createElement('div'); el.id = id; el.className = 'v2-pillole'; dove.parentNode.insertBefore(el, dove); el.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) alClic(b.dataset.v); }); }
    el.innerHTML = voci.map(([v, nome]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(attiva) ? 'on' : ''}">${esc(nome)}</button>`).join('');
  }
  function pilloleVisite() {
    const sel = $('q-stato'), barra = document.querySelector('#view-lista .search-bar'); if (!sel || !barra) return;
    pillole('v2-pill-lista', barra, [['', 'Tutte'], ['bozza', 'Bozze'], ['definitivo', 'Definitive']], sel.value, (v) => { sel.value = v; const c = $('btn-cerca'); if (c) c.click(); pilloleVisite(); });
  }
  function pilloleRubrica() {
    const sel = $('rub-cat'); if (!sel) return;
    const riga = sel.closest('.search-bar') || sel.parentNode;
    pillole('v2-pill-rub', riga, [...sel.options].map((o) => [o.value, o.value ? o.textContent : 'Tutti']), sel.value, (v) => { sel.value = v; sel.dispatchEvent(new Event('change')); pilloleRubrica(); });
  }
  const GRUPPI_STAT = [
    ['attivita', 'Attività', ['Visite per esercizio', 'Attività mensile', 'Sopralluoghi per tecnico', 'Produttività', 'Affiancamento', 'Tipologia di visita']],
    ['rischio', 'Rischio', ['IPC', 'NC+', 'Imprese ricorrenti', 'Ruolo impresa', 'Iscrizione']],
    ['territorio', 'Territorio e cantieri', ['Top 20 comuni', 'Tipo di intervento', 'Tipologia di opera', 'Importo']],
  ];
  const gruppoStat = (titolo) => { const g = GRUPPI_STAT.find((x) => x[2].some((c) => String(titolo || '').includes(c))); return g ? g[0] : ''; };
  let _statGruppo = '';
  function pilloleStatistiche() {
    const sez = $('view-statistiche'); if (!sez) return;
    const carte = [...sez.querySelectorAll('.card')].filter((c) => c.querySelector(':scope > h3'));
    const prima = carte.find((c) => gruppoStat(c.querySelector(':scope > h3').textContent));
    if (!prima) return;
    carte.forEach((c) => { const g = gruppoStat(c.querySelector(':scope > h3').textContent); c.classList.toggle('v2-nasc', !!g && !!_statGruppo && g !== _statGruppo); });
    pillole('v2-pill-stat', prima.parentNode === sez ? prima : (prima.closest('#view-statistiche > *') || prima), [['', 'Tutti i grafici']].concat(GRUPPI_STAT.map((g) => [g[0], g[1]])), _statGruppo,
      (v) => { _statGruppo = v; pilloleStatistiche(); window.dispatchEvent(new Event('resize')); });
  }
  function pagine(view) {
    try {
      schedeTelefono(view);
      if (view === 'lista') pilloleVisite();
      if (view === 'rubrica') pilloleRubrica();
      if (view === 'statistiche') pilloleStatistiche();
    } catch (e) { console.warn('veste v2 (pagine):', e); }
  }

  function momentoUno() { try { incarichiSchede(); cantieriVicini(); tipoPulsanti(); } catch (e) { console.warn('veste v2 (primo momento):', e); } }

  /* ── DIREZIONE e PRESIDENZA: una sintesi, così la pagina non è mai vuota ── */
  async function sintesi() {
    const vista = $('view-direzione'); const sb = window.sb; if (!vista || !sb) return;
    let el = $('v2-sintesi');
    if (!el) { el = document.createElement('div'); el.id = 'v2-sintesi'; vista.appendChild(el); }
    const es = esercizi()[0];
    const [fatte, minime] = await Promise.all([
      conta(async () => { const { count, error } = await sb.from('visite').select('visita_id', { count: 'exact', head: true }).eq('elimina', 0).eq('stato', 'definitivo').gte('data_visita', es.dal).lte('data_visita', es.al); if (error) throw new Error(error.message); return count || 0; }, 'Visite definitive dell\'esercizio'),
      conta(async () => { const { data, error } = await sb.from('visite_obiettivo_esercizio').select('visite_minime,visite_minime_manuali').eq('esercizio', es.etichetta).maybeSingle(); if (error) throw new Error(error.message); return data ? (data.visite_minime_manuali != null ? data.visite_minime_manuali : data.visite_minime) : 0; }, 'Obiettivo visite'),
    ]);
    let corpo;
    if (fatte.errore || minime.errore) corpo = '<div style="color:#C0392B">Non sono riuscito a leggere l\'obiettivo dell\'esercizio (' + esc(fatte.errore || minime.errore) + ').</div>';
    else if (!minime.n) corpo = 'Visite definitive dell\'esercizio: <b>' + fatte.n + '</b>. Il minimo dell\'esercizio non è ancora impostato.';
    else {
      const p = Math.round(fatte.n / minime.n * 100);
      corpo = 'Visite fatte / minime C.E.I.V. <b style="float:right">' + fatte.n + ' / ' + minime.n + ' · ' + p + '%</b>'
        + '<div style="height:10px;border-radius:50px;background:#E3E4E6;overflow:hidden;margin:8px 0 4px"><i style="display:block;height:100%;width:' + Math.min(100, p) + '%;background:#95C22F"></i></div>'
        + '<small style="color:#888">100 visite ogni 50.000 € di contributi alla Cassa Edile</small>';
    }
    el.innerHTML = '<div class="v2-card"><div class="v2-titolo">🎯 Obiettivo dell\'esercizio ' + es.nome + '</div>' + corpo + '</div>';
  }

  /* ── «‹ Ufficio» nelle pagine che la segreteria apre dall'Ufficio ── */
  function torna(view) {
    const vecchio = $('v2-torna'); if (vecchio) vecchio.remove();
    if (ruolo() !== 'segreteria' || !['admin', 'committenti', 'incarichi'].includes(view)) return;
    const vista = $('view-' + view); if (!vista) return;
    const b = document.createElement('button'); b.id = 'v2-torna'; b.type = 'button'; b.textContent = '‹ Ufficio';
    b.addEventListener('click', () => { if (typeof window.navTo === 'function') window.navTo('segreteria'); });
    vista.insertBefore(b, vista.firstChild);
  }

  /* ════ i due ingressi chiamati da navTo() ════ */
  function prima(view) {
    try {
      if (!S().user) return null;
      if (_utente !== email()) {
        _utente = email(); _aperta = false;
        // nello stesso browser è entrato un altro: il riquadro dell'Asseverazione segue il nuovo accesso
        const a = $('nav-assev'); if (a && a.dataset.v2Mostra !== undefined) a.dataset.v2Mostra = a.style.display;
      }
      try { localStorage.removeItem('gv-veste'); } catch (_e) { /* archivio del browser non disponibile */ }
      { const vecchio = $('btn-veste-v2'); if (vecchio) vecchio.remove(); }
      prepara();
      if (!_aperta) { _aperta = true; if (view === 'dashboard') return RUOLI[ruolo()].apre; }
      return null;
    } catch (e) { console.warn('veste v2 (prima):', e); return null; }
  }
  function dopo(view) {
    try {
      if (!document.body.classList.contains('v2') || !accesa()) return [];
      document.body.dataset.v2Vista = view;
      menu();   // l'accesso può aver rimesso in vista voci che qui non servono
      // le pagine aperte dall'Ufficio tengono acceso «Ufficio» nel menu
      if (ruolo() === 'segreteria' && ['admin', 'committenti', 'incarichi'].includes(view)) { const u = document.querySelector('nav button[data-view="segreteria"]'); if (u) u.classList.add('active'); }
      torna(view);
      const r = RUOLI[ruolo()];
      if (view === 'form') verbaleApplica();
      pagine(view);
      if (view === 'segreteria') ufficio();
      if (view === 'admin') { try { const ha = document.querySelector('#view-admin .adm-header h2'); if (ha) ha.textContent = 'Coordinamento'; leggibileIn('view-admin'); setTimeout(() => leggibileIn('view-admin'), 800); } catch (e) { console.warn('veste v2 (leggibile):', e); } }
      if (view === 'direzione') { pulsantiDirezione(); postoNotifiche(view); } if (view === 'direzione') sintesi().catch((e) => console.warn('veste v2, sintesi:', e));
      if (view === 'dashboard' && r.lettura) postoNotifiche(view);
      if (view === 'dashboard' && !r.lettura) {
        oggiPagina();
        postoNotifiche(view);
        bozze().catch((e) => console.warn('veste v2, bozze:', e));
        // lo scadenzario legge tutte le visite: si rifà al più ogni due minuti
        return Date.now() - _dati.quando > 120000 ? ['dati:scadenze', 'dati:incarichi'] : ['dati:incarichi'];
      }
      return [];
    } catch (e) { console.warn('veste v2 (dopo):', e); return []; }
  }

  window.vesteV2 = { prima, dopo, pronto, verso, accesa, ruolo, ruoloVero, simula, RUOLI, GRUPPI, FASI, faseDi, esercizi, gruppoDi, piuVicini, TIPI_FREQUENTI, areaRiepilogo, requisiti, gruppoStat, luminanza, contrasto, leggibile };
})();
