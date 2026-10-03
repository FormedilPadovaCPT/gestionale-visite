/* ============================================================
   VESTE V2 — ANTEPRIMA (03/10/2026, decisa dall'utente)

   La proposta di design «Gestionale Visite v2» piace, ma è stata disegnata
   sulla pagina pubblica, senza conoscere ruoli e regole. Questa è la sua
   riprogettazione dentro l'app vera, come SECONDA VESTE dello stesso codice:
   stessa app, stesso database, stesse funzioni. Non è una seconda app.

   CHI LA VEDE. Solo la segreteria, e solo se la accende col pulsante
   «🎨 Veste nuova» in alto. Tutti gli altri, e la segreteria stessa quando è
   spenta, vedono l'app di oggi: se questo file non si carica, o qui dentro
   qualcosa va storto, l'app di oggi continua a funzionare (ogni ingresso è
   protetto da try/catch e non cambia niente finché la veste è spenta).

   CHE COSA FA, in questo primo pezzo (non tocca il verbale):
     · menu per ruolo: Oggi · Visite · Cantieri · Rubrica · Statistiche, a
       destra Ufficio (segreteria) o Coordinamento (coordinatore) e
       «Nuova visita»; Direzione, Presidenza e consiglieri hanno il menu corto;
     · pagina di apertura per ruolo (decise dall'utente): segreteria su
       Ufficio › Scrivania, tecnico e coordinatore su Oggi, Direttore su
       Direzione, Presidenza sulla sua pagina, consiglieri su Statistiche;
     · «Oggi»: bozze aperte, poi le scadenze e gli incarichi di oggi, che
       sono le pagine di sempre mostrate una sotto l'altra (nessuna regola
       riscritta: le disegnano le funzioni di sempre);
     · «Ufficio»: gli strumenti della pagina Segreteria raggruppati con un
       menu a lato, più una Scrivania con i numeri di ciò che aspetta;
     · «Vedi come…»: la segreteria vede menu e pagine degli altri ruoli.
       Cambia ciò che si vede, NON i permessi: i dati restano quelli che il
       database dà alla segreteria.

   CHE COSA NON FA: non salva niente da sola, non cambia Bozza e Definitivo,
   non sposta dati, non tocca le regole di chiusura. Sono paletti dell'utente.

   Agganci in index.html: due righe in navTo() — vesteV2.prima(view) può
   cambiare la pagina di destinazione, vesteV2.dopo(view) dice quali altre
   pagine mostrare sotto — e lo <script> che carica questo file.
   ============================================================ */
(function () {
  'use strict';
  const CHIAVE = 'gv-veste';              // localStorage: 'v2' = veste nuova accesa su questo dispositivo
  const CHIAVE_RUOLO = 'gv-v2-ruolo';     // sessionStorage: il ruolo di «Vedi come…»
  const SEGRETERIA = 'cptpd@did.formedilpadova.it';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leggi = (st, k) => { try { return st.getItem(k); } catch (_e) { return null; } };
  const scrivi = (st, k, v) => { try { v == null ? st.removeItem(k) : st.setItem(k, v); } catch (_e) { /* archivio del browser non disponibile */ } };

  const RUOLI = {
    segreteria:   { nome: 'Segreteria (tu)', menu: ['dashboard', 'lista', 'cantieri', 'rubrica', 'statistiche', '|', 'segreteria', 'form'], apre: 'segreteria' },
    tecnico:      { nome: 'Tecnico',         menu: ['dashboard', 'lista', 'cantieri', 'rubrica', 'statistiche', '|', 'form'],               apre: 'dashboard' },
    coordinatore: { nome: 'Coordinatore',    menu: ['dashboard', 'lista', 'cantieri', 'rubrica', 'statistiche', '|', 'admin', 'form'],      apre: 'dashboard' },
    direttore:    { nome: 'Direttore',       menu: ['direzione', 'statistiche', 'dashboard', 'appuntamenti'], apre: 'direzione',   lettura: true },
    presidenza:   { nome: 'Presidenza',      menu: ['direzione', 'statistiche', 'dashboard', 'appuntamenti'], apre: 'direzione',   lettura: true },
    consigliere:  { nome: 'Consigliere',     menu: ['statistiche', 'dashboard', 'appuntamenti'],              apre: 'statistiche', lettura: true },
  };
  const ETICHETTE = { dashboard: '🏠 Oggi', admin: '🧭 Coordinamento', segreteria: '🗂️ Ufficio', form: '➕ Nuova visita', direzione: '🏛️ Direzione', appuntamenti: '📅 Appuntamenti' };

  let _utente = null;      // l'e-mail per cui la veste è stata preparata: se cambia utente si ricomincia
  let _aperta = false;     // la pagina di apertura è già stata scelta per questo accesso
  let _letturaFinta = false;

  const S = () => window.S || {};
  const email = () => String((S().user && S().user.email) || '').toLowerCase();
  const eSegreteria = () => !!email() && email() === SEGRETERIA && !S().viewer;
  const accesa = () => eSegreteria() && leggi(localStorage, CHIAVE) === 'v2';
  const ruolo = () => { const r = leggi(sessionStorage, CHIAVE_RUOLO); return RUOLI[r] ? r : 'segreteria'; };

  /* ── il pulsante che accende e spegne (solo segreteria) ── */
  function pulsante() {
    let b = $('btn-veste-v2');
    if (!eSegreteria()) { if (b) b.remove(); return; }
    const area = document.querySelector('.user-area'); if (!area) return;
    if (!b) {
      b = document.createElement('button');
      b.id = 'btn-veste-v2'; b.type = 'button';
      b.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,.6);color:#fff;font-size:11px;padding:3px 8px;border-radius:4px;cursor:pointer';
      b.addEventListener('click', () => {
        scrivi(localStorage, CHIAVE, accesa() ? null : 'v2');
        scrivi(sessionStorage, CHIAVE_RUOLO, null);
        location.reload();
      });
      area.insertBefore(b, area.firstChild);
    }
    const on = accesa();
    b.textContent = on ? '↩ Veste di oggi' : '🎨 Veste nuova';
    b.setAttribute('data-aiuto', on
      ? 'Torna all\'app com\'è oggi. La veste nuova è un\'anteprima che vedi solo tu: gli altri non se ne accorgono.'
      : 'Accende l\'anteprima della veste nuova (menu per ruolo, Oggi, Ufficio). La vedi solo tu, su questo dispositivo; i dati e le funzioni sono gli stessi. Si spegne dallo stesso pulsante.');
  }

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
/* «Oggi»: la mappa sta in Cantieri; chi è di sola lettura la tiene (per lui la pagina si chiama Mappa) */
body.v2:not(.viewer-mode) #dash-map-card{display:none}
/* «Oggi»: prima le bozze aperte, poi GLI INCARICHI (chiesto dall'utente: sotto tutto il resto non li vedrebbe nessuno),
   poi il cruscotto e in fondo le scadenze. Le pagine sono quelle di sempre: cambia solo l'ordine in cui si vedono. */
body.v2[data-v2-vista="dashboard"]:not(.viewer-mode) main{display:flex;flex-direction:column}
body.v2[data-v2-vista="dashboard"] #v2-bozze{order:0}
body.v2[data-v2-vista="dashboard"] #view-incarichi{order:1}
body.v2[data-v2-vista="dashboard"] #view-dashboard{order:2}
body.v2[data-v2-vista="dashboard"] #view-scadenze{order:3}
body.v2:not([data-v2-vista="dashboard"]) #v2-bozze{display:none}
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
  function menuComEra() {
    document.querySelectorAll('nav button').forEach((b) => {
      if (b.dataset.v2Etichetta === undefined) return;
      if (b.firstChild && b.firstChild.nodeType === 3 && b.dataset.v2Etichetta) b.firstChild.textContent = b.dataset.v2Etichetta;
      b.style.display = b.dataset.v2Mostra || '';   // le voci nascoste dalla veste tornano com'erano
      b.style.order = ''; b.style.marginLeft = ''; b.classList.remove('v2-cta');
      delete b.dataset.v2Etichetta; delete b.dataset.v2Mostra;
    });
  }

  /* ── la barra «Vedi come…» ── */
  function barra() {
    let el = $('v2-barra');
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
    el.innerHTML = '<b>Anteprima della veste nuova · Vedi come:</b>'
      + Object.entries(RUOLI).map(([k, r]) => `<button type="button" data-ruolo="${k}" class="${k === att ? 'on' : ''}">${esc(r.nome)}</button>`).join('')
      + (att === 'segreteria' ? '' : '<span class="v2-nota">vedi il menu e le pagine di questo ruolo; i dati restano quelli che il database dà a te</span>');
  }

  /* ── «Altre app» nell'intestazione: Asseverazione e Servizi CPT escono dal menu ── */
  function altreApp() {
    const area = document.querySelector('.user-area'); if (!area || $('v2-altre')) return;
    const assev = $('nav-assev');
    const haAssev = !!assev && assev.dataset.v2Mostra !== 'none';
    const w = document.createElement('span'); w.id = 'v2-altre'; w.style.cssText = 'position:relative';
    w.innerHTML = '<button type="button" style="background:transparent;border:1px solid rgba(255,255,255,.6);color:#fff;font-size:11px;padding:3px 8px;border-radius:4px;cursor:pointer">Altre app ▾</button>'
      + '<div style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:#fff;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.2);padding:6px;z-index:400;min-width:190px">'
      + (haAssev ? '<button type="button" data-app="assev" style="display:block;width:100%;text-align:left;background:none;color:#565C66;font-size:14px;padding:9px 12px">✅ Asseverazione ↗</button>' : '')
      + '<button type="button" data-app="servizi" style="display:block;width:100%;text-align:left;background:none;color:#565C66;font-size:14px;padding:9px 12px">📱 Servizi CPT ↗</button></div>';
    const tenda = w.lastChild;
    w.firstChild.addEventListener('click', (e) => { e.stopPropagation(); tenda.style.display = tenda.style.display === 'none' ? 'block' : 'none'; });
    document.addEventListener('click', () => { tenda.style.display = 'none'; });
    tenda.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-app]'); if (!b) return;
      const dest = b.dataset.app === 'assev' ? assev : $('btn-servizi-cpt');
      if (dest) dest.click();
    });
    area.insertBefore(w, area.firstChild);
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
    stile(); menu(); barra(); altreApp(); tieniEtichette();
    const lettura = !!RUOLI[ruolo()].lettura;
    if (lettura && !document.body.classList.contains('viewer-mode')) { document.body.classList.add('viewer-mode'); _letturaFinta = true; }
    if (!lettura && _letturaFinta) { document.body.classList.remove('viewer-mode'); _letturaFinta = false; }
  }
  function spegni() {
    if (!document.body.classList.contains('v2')) return;
    document.body.classList.remove('v2');
    if (_letturaFinta) { document.body.classList.remove('viewer-mode'); _letturaFinta = false; }
    ['v2-barra', 'v2-altre', 'v2-uff-menu', 'v2-scrivania', 'v2-rimandi', 'v2-bozze', 'v2-sintesi', 'v2-torna', 'v2-tit-inc', 'v2-tit-scad'].forEach((id) => { const e = $(id); if (e) e.remove(); });
    const u = $('view-segreteria'); if (u) { u.classList.remove('v2-uff'); u.querySelectorAll('.adm-section').forEach((s) => { s.style.display = ''; }); }
    menuComEra();
  }

  /* ── numeri: una lettura fallita si dice, non diventa zero ── */
  async function conta(leggiFn) {
    try { const n = await leggiFn(); return { n: Number(n) || 0 }; } catch (e) { console.warn('veste v2, conteggio:', e); return { errore: e.message || String(e) }; }
  }
  const quadro = (c) => c.errore ? '<div class="v2-num v2-err" title="' + esc(c.errore) + '">non letto</div>' : '<div class="v2-num' + (c.n ? '' : ' v2-zero') + '">' + c.n + '</div>';
  const rigaScr = (c, titolo, sotto, azione, etichetta) => `<div class="v2-card" style="padding:10px 16px"><div class="v2-riga">${quadro(c)}<div class="v2-t"><b>${titolo}</b><small>${sotto}</small></div><button type="button" class="btn-outline btn-sm" data-v2-az="${azione}">${etichetta}</button></div></div>`;
  function esercizi() {
    const d = new Date(), a = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1;
    const es = (y) => ({ nome: y + '-' + String(y + 1).slice(2), dal: y + '-10-01', al: (y + 1) + '-09-30', etichetta: y + '/' + (y + 1) });
    return [es(a), es(a - 1)];
  }

  /* ── UFFICIO: gli strumenti della pagina Segreteria, raggruppati ── */
  const GRUPPI = [
    { k: 'scrivania', nome: 'Scrivania', titoli: [] },
    { k: 'comunicazioni', nome: 'Comunicazioni', titoli: ['Promemoria ricontrolli', 'Campagna informativa'], rimandi: [['admin', '📢 Bacheca avvisi ai tecnici', 'sta nella pagina del coordinamento']] },
    { k: 'incarichi', nome: 'Incarichi', titoli: ['Incarichi ai tecnici'], rimandi: [['incarichi', '📋 Incarichi aperti', 'l\'elenco di tutti gli incarichi, da assegnare e da chiudere']] },
    { k: 'anagrafiche', nome: 'Anagrafiche', titoli: ['Gestione imprese', 'Gestione cantieri'], rimandi: [['committenti', '👤 Committenti', 'ricerca, modifica e unione dei committenti'], ['rubrica', '📒 Persone e contatti', 'la rubrica, con la pulizia dei doppioni']] },
    { k: 'qualita', nome: 'Qualità dati', titoli: ['Imprese visitate senza codice fiscale', 'Riaggancio cantieri senza CNCE', 'Controllo duplicati CNCE'] },
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

  async function scrivania() {
    const el = $('v2-scrivania'); if (!el) return;
    const sb = window.sb; if (!sb) return;
    el.innerHTML = '<div class="v2-card" style="color:#888">⏳ Conto quello che aspetta…</div>';
    const [esOra, esPrima] = esercizi();
    const rpc = async (f, a) => { const { data, error } = await sb.rpc(f, a); if (error) throw new Error(error.message); return data; };
    const righe = async (q) => { const { count, error } = await q; if (error) throw new Error(error.message); return count || 0; };
    const [ossPrima, ossOra, senzaCf, proposte, incarichi, bozze, questioni] = await Promise.all([
      conta(async () => (await rpc('osservatorio_controllo', { p_dal: esPrima.dal, p_al: esPrima.al, p_dettaglio: false })).ferme),
      conta(async () => (await rpc('osservatorio_controllo', { p_dal: esOra.dal, p_al: esOra.al, p_dettaglio: false })).ferme),
      conta(async () => ((await rpc('imprese_senza_cf')) || []).length),
      conta(async () => { if (!window.propChius || !window.propChius.aperte) throw new Error('funzione non disponibile'); return (await window.propChius.aperte()).size; }),
      conta(() => righe(sb.from('incarichi').select('id', { count: 'exact', head: true }).eq('stato', 'aperto'))),
      conta(() => righe(sb.from('visite').select('visita_id', { count: 'exact', head: true }).eq('elimina', 0).eq('stato', 'bozza'))),
      conta(() => righe(sb.from('s_decisioni').select('id', { count: 'exact', head: true }).in('stato', ['aperta', 'rinviata']))),
    ]);
    el.innerHTML = '<div class="v2-titolo" style="margin:4px 2px 10px">Scrivania — quello che aspetta</div>'
      + rigaScr(ossPrima, 'Visite ferme per l\'Osservatorio · esercizio ' + esPrima.nome, 'non entrano nei file finché manca un dato obbligatorio: vanno sistemate prima dell\'invio annuale', 'gruppo:report', 'Apri')
      + rigaScr(ossOra, 'Visite ferme per l\'Osservatorio · esercizio ' + esOra.nome, 'l\'esercizio in corso', 'gruppo:report', 'Apri')
      + rigaScr(proposte, 'Cantieri proposti per la chiusura', 'mandati dai tecnici, in attesa della tua risposta (riquadro in «Oggi»)', 'vai:dashboard', 'Apri')
      + rigaScr(questioni, 'Questioni in attesa di decisione', 'aperte da coordinatore e segreteria per Direzione e Presidenza', 'vai:admin', 'Apri')
      + rigaScr(incarichi, 'Incarichi aperti', 'da assegnare, da evadere o con la visita fatta e da chiudere', 'vai:incarichi', 'Apri')
      + rigaScr(bozze, 'Verbali ancora in bozza', 'di tutti i tecnici: restano fuori da statistiche e Osservatorio finché non si chiudono', 'vai:lista', 'Apri')
      + rigaScr(senzaCf, 'Imprese visitate senza codice fiscale', 'per le società «= P.IVA» lo copia: resta da confermare', 'gruppo:qualita', 'Apri');
  }

  /* ── OGGI: le bozze aperte di chi è collegato ── */
  async function bozze() {
    const vista = $('view-dashboard'); const sb = window.sb; if (!vista || !vista.parentNode || !sb) return;
    let el = $('v2-bozze');
    if (!el) { el = document.createElement('div'); el.id = 'v2-bozze'; vista.parentNode.insertBefore(el, vista.parentNode.firstChild); }
    const tid = S().tecnico && S().tecnico.tecnico_id;
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

  /* in «Oggi» incarichi e scadenze portano un titolo; quando si aprono da sole, no */
  function titoliOggi(si) {
    [['view-incarichi', 'v2-tit-inc', '📥 I tuoi incarichi'], ['view-scadenze', 'v2-tit-scad', '⏰ Rientri in scadenza']].forEach(([vista, id, testo]) => {
      const v = $(vista); if (!v) return;
      let t = $(id);
      if (!si) { if (t) t.remove(); return; }
      if (!t) { t = document.createElement('div'); t.id = id; t.className = 'v2-sezione'; t.textContent = testo; v.insertBefore(t, v.firstChild); }
    });
  }

  /* ── DIREZIONE e PRESIDENZA: una sintesi, così la pagina non è mai vuota ── */
  async function sintesi() {
    const vista = $('view-direzione'); const sb = window.sb; if (!vista || !sb) return;
    let el = $('v2-sintesi');
    if (!el) { el = document.createElement('div'); el.id = 'v2-sintesi'; vista.appendChild(el); }
    const es = esercizi()[0];
    const [fatte, minime] = await Promise.all([
      conta(async () => { const { count, error } = await sb.from('visite').select('visita_id', { count: 'exact', head: true }).eq('elimina', 0).eq('stato', 'definitivo').gte('data_visita', es.dal).lte('data_visita', es.al); if (error) throw new Error(error.message); return count || 0; }),
      conta(async () => { const { data, error } = await sb.from('visite_obiettivo_esercizio').select('visite_minime,visite_minime_manuali').eq('esercizio', es.etichetta).maybeSingle(); if (error) throw new Error(error.message); return data ? (data.visite_minime_manuali != null ? data.visite_minime_manuali : data.visite_minime) : 0; }),
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
      if (_utente !== email()) { _utente = email(); _aperta = false; }
      pulsante();
      if (!accesa()) { spegni(); return null; }
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
      // la mappa era nascosta: quando torna in vista va rimisurata
      if (view === 'dashboard' && r.lettura) setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
      if (view === 'segreteria') ufficio();
      if (view === 'direzione') sintesi().catch((e) => console.warn('veste v2, sintesi:', e));
      titoliOggi(view === 'dashboard' && !r.lettura);
      if (view === 'dashboard' && !r.lettura) { bozze().catch((e) => console.warn('veste v2, bozze:', e)); return ['scadenze', 'incarichi']; }
      return [];
    } catch (e) { console.warn('veste v2 (dopo):', e); return []; }
  }

  window.vesteV2 = { prima, dopo, accesa, ruolo, RUOLI, GRUPPI, esercizi, gruppoDi };
})();
