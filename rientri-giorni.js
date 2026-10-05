/* ============================================================
   RIENTRI RAGGRUPPATI PER GIORNO (04/10/2026, design scelto dall'utente:
   variante «B · Raggruppata per giorno» del canvas «Rientri – card compatte»).

   DOVE SI USA: nella pagina «Oggi» (riquadro dei rientri, veste-v2.js) e
   nella pagina Scadenze SUL TELEFONO. Sul PC la pagina Scadenze resta la
   tabella con le colonne ordinabili (deciso dall'utente: prima vuole vedere
   come verrebbe).

   CHE COSA MOSTRA. Gli stessi dati che la lista mostrava già — li calcola
   loadScadenze (index.html) — in gruppi: «SCADUTI» in arancione, poi un
   gruppo per giorno di rientro, arancione chiaro entro 7 giorni e grigio
   chiaro oltre. Ogni riga: casella · verbale (ultime 4 cifre) e cantiere ·
   tecnico, IPC a tre barre, accesso e tipo di rientro · bussola · un
   pulsante. Il tocco sulla riga apre il dettaglio del verbale.

   IL PULSANTE DELLA RIGA dipende da chi guarda: la segreteria ha il
   lucchetto (chiude il cantiere per fine lavori, come prima); tecnico e
   coordinatore hanno ➕, la visita di ritorno; chi è di sola lettura nessuno.

   LA BARRA IN BASSO compare con almeno una riga spuntata: «🧭 Giro» per
   tutti (il giro a tappe di sempre, _giroVai), «Riassegna» e «Chiudi» per la
   sola segreteria (pendenza_assegna e chiudi_cantiere: il database li rifiuta
   a chiunque altro, quindi non si disegnano).

   Solo colori istituzionali: arancione #e7500f, grigio #565c66, bianco, e le
   loro tinte chiare. Pulsanti di almeno 44 px.
   ============================================================ */
(function () {
  'use strict';
  const ARANCIO = '#e7500f', GRIGIO = '#565c66', SCURO = '#3d4249', ARANCIO_CHIARO = '#fdebe2', GRIGIO_CHIARO = '#f3f4f5', BORDO = '#e3e5e8';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avviso = (m, t) => (window.toast ? window.toast(m, t) : alert(m));
  const GIORNI = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
  const MESI = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
  const IPC_ORD = { ALTO: 0, MEDIO: 1, BASSO: 2, NR: 3 };
  const IPC_LIV = { ALTO: 3, MEDIO: 2, BASSO: 1 };
  const IPC_NOME = { ALTO: 'Alto', MEDIO: 'Medio', BASSO: 'Basso' };

  /* stato per contenitore: ricerca, filtri, righe spuntate (sopravvivono al ridisegno) */
  const _stato = new Map();
  const statoDi = (id) => { if (!_stato.has(id)) _stato.set(id, { q: '', ipc: '', gg: '', pannello: false, sel: new Map(), ultimo: null }); return _stato.get(id); };

  function stile() {
    if (document.getElementById('rg-stile')) return;
    const st = document.createElement('style');
    st.id = 'rg-stile';
    st.textContent = `
.rg{color:${SCURO};font-size:14px}
.rg-cerca{display:flex;gap:8px;align-items:center;padding:0 0 10px}
.rg-cerca label{flex:1;display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;border-radius:10px;background:${GRIGIO_CHIARO};color:${GRIGIO};margin:0;text-transform:none;letter-spacing:0;font-weight:400}
.rg-cerca input{border:0!important;background:transparent!important;outline:none;font-size:14px;color:${SCURO};width:100%;padding:0!important;min-width:0;box-shadow:none!important;height:auto}
.rg-btn{min-width:44px;height:44px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;flex:0 0 auto;font-size:15px;line-height:1}
.rg-btn-grigio{border:0;background:${GRIGIO_CHIARO};color:${GRIGIO}}
.rg-btn-bordo{border:1px solid #c9cdd2;background:#fff;color:${GRIGIO}}
.rg-btn-bordo.on{border-color:${ARANCIO};color:${ARANCIO};background:${ARANCIO_CHIARO}}
.rg-btn-arancio{border:1.5px solid ${ARANCIO};background:#fff;color:${ARANCIO}}
.rg-pannello{display:flex;flex-direction:column;gap:8px;padding:10px 12px;margin:0 0 10px;border:1px solid ${BORDO};border-radius:10px;background:#fff}
.rg-pannello div{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.rg-pannello small{font-size:12px;color:${GRIGIO};min-width:62px}
.rg-chip{height:36px;min-height:0;padding:0 12px;border-radius:50px;border:1.5px solid #c9cdd2;background:#fff;color:${GRIGIO};font-size:13px;font-weight:600;cursor:pointer}
.rg-chip.on{background:${GRIGIO};border-color:${GRIGIO};color:#fff}
.rg-testa{display:flex;align-items:center;justify-content:space-between;gap:8px;height:36px;padding:0 14px;box-sizing:border-box}
.rg-testa b{font-size:13px;font-weight:700;letter-spacing:.02em}
.rg-testa span{font-size:12px;font-weight:500}
.rg-testa.scaduti{background:${ARANCIO};color:#fff}
.rg-testa.vicino{background:${ARANCIO_CHIARO};color:${SCURO}}
.rg-testa.lontano{background:${GRIGIO_CHIARO};color:${GRIGIO}}
.rg-riga{display:grid;grid-template-columns:28px minmax(0,1fr) 44px 44px;column-gap:8px;align-items:center;padding:6px 8px 6px 10px;border-bottom:1px solid #eceef0;min-height:56px;box-sizing:border-box}
.rg-riga.senza-az{grid-template-columns:28px minmax(0,1fr) 44px}
.rg-riga.sel{background:#fff8f4}
.rg-chk{display:flex;align-items:center;justify-content:center;width:28px;height:44px;margin:0;cursor:pointer}
.rg-chk input{width:20px!important;height:20px;min-width:0!important;margin:0!important;accent-color:${ARANCIO};cursor:pointer}
.rg-apri{display:flex;flex-direction:column;gap:3px;min-width:0;background:none;border:0;padding:4px 0;text-align:left;cursor:pointer;color:inherit;font:inherit;min-height:44px;justify-content:center;white-space:normal}
.rg-apri:hover .rg-cant{color:${ARANCIO}}
.rg-r1{display:flex;align-items:baseline;gap:7px;min-width:0}
.rg-nr{font-size:15px;font-weight:700;flex:0 0 auto;color:${SCURO}}
.rg-cant{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rg-r2{display:flex;align-items:center;gap:6px;font-size:12px;color:${GRIGIO};white-space:nowrap;overflow:hidden;min-width:0}
.rg-barre{display:inline-flex;align-items:flex-end;gap:1.5px;height:10px;flex:0 0 auto}
.rg-barre i{display:block;width:3px;border-radius:1px;background:#d5d8dc}
.rg-barre i.on{background:${ARANCIO}}
.rg-ipc{font-weight:600;color:${SCURO}}
.rg-coda{min-width:0;overflow:hidden;text-overflow:ellipsis}
.rg.con-barra{padding-bottom:84px}
.rg-vuoto{padding:12px 4px;color:${GRIGIO};font-size:13px}
.rg-altri{display:block;padding:8px 14px;font-size:12.5px;color:${GRIGIO};border-bottom:1px solid #eceef0}
.rg-barra{position:fixed;left:12px;right:12px;bottom:16px;max-width:620px;margin:0 auto;min-height:56px;border-radius:14px;background:${GRIGIO};color:#fff;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 16px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:900;flex-wrap:wrap}
.rg-barra span{flex:1 1 auto;font-size:14px;font-weight:500;min-width:0;white-space:nowrap}
.rg-barra em{font-style:normal}
.rg-barra button{height:44px;min-height:0;padding:0 14px;border-radius:10px;font-size:14px;cursor:pointer}
.rg-barra .rg-b-chiaro{border:1px solid rgba(255,255,255,.55);background:transparent;color:#fff;font-weight:500}
.rg-barra .rg-b-pieno{border:0;background:${ARANCIO};color:#fff;font-weight:600}
.rg-barra .rg-b-x{border:0;background:transparent;color:#fff;min-width:44px;padding:0;font-size:18px}
@media(max-width:420px){.rg-barra{gap:6px;padding:6px 4px 6px 14px;flex-wrap:nowrap}.rg-barra em{display:none}.rg-barra button{padding:0 10px;font-size:13px}.rg-barra span b{font-size:16px}}
`;
    document.head.appendChild(st);
  }

  const ultime4 = (nr) => { const m = String(nr || '').match(/(\d+)\s*$/); return m ? m[1].padStart(4, '0').slice(-4) : (nr || '—'); };
  const indirizzo = (c) => [c.cantiere_indirizzo, /^\s*snc\s*$/i.test(c.cantiere_civico || '') ? '' : c.cantiere_civico].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();   // «SNC» = senza numero civico: nella riga è solo rumore
  function nomeCantiere(v) {
    const c = v.cantieri || {}, ind = indirizzo(c);
    if (ind) return ind + (c.comune_nome ? ' – ' + c.comune_nome : '');
    const et = c.cantiere_etichetta || '—';   // senza indirizzo: l'etichetta, e il comune se l'etichetta non lo dice già
    return et + (c.comune_nome && !et.toLowerCase().includes(String(c.comune_nome).toLowerCase()) ? ' – ' + c.comune_nome : '');
  }
  const dataGruppo = (d) => GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
  const traGiorni = (n) => (n === 0 ? 'oggi' : n === 1 ? 'domani' : 'tra ' + n + ' gg');
  const chiaveGiorno = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function barre(ipc) {
    const n = IPC_LIV[ipc] || 0;
    return `<span class="rg-barre" aria-hidden="true"><i class="${n >= 1 ? 'on' : ''}" style="height:4px"></i><i class="${n >= 2 ? 'on' : ''}" style="height:7px"></i><i class="${n >= 3 ? 'on' : ''}" style="height:10px"></i></span>`;
  }

  function cerca(v, q, tecNome) {
    if (!q) return true;
    const c = v.cantieri || {};
    return [v.nr_verbale, c.cantiere_indirizzo, c.cantiere_civico, c.comune_nome, c.cantiere_etichetta, tecNome(v.tecnico_id), tecNome(v.tecnico_verbale)]
      .some((x) => String(x || '').toLowerCase().includes(q));
  }

  function riga(v, o, st) {
    const ipc = String(v.ipc || 'NR').toUpperCase();
    const cant = nomeCantiere(v);
    const tec = o.mostraTecnico ? o.tecBreve(v.tecnico_id) : '';
    const tipo = v.tipoCalc || '';
    const pezzi = [];
    if (tec) pezzi.push(`<span title="${esc(v.tecnico_verbale ? 'La pratica è passata a questo tecnico; il verbale è di ' + o.tecNome(v.tecnico_verbale) : '')}">${esc(tec)}${v.tecnico_verbale ? ' ↩' : ''}</span>`);
    const dopoIpc = [v.acc_cant ? 'acc. ' + esc(v.acc_cant) : '', esc(tipo)].filter(Boolean).join(' · ');
    const nav = o.mappa(v);
    let az = '';
    if (o.segreteria) az = `<button type="button" class="rg-btn rg-btn-arancio" data-rg="chiudi" data-cid="${esc(v.cantiere_id)}" aria-label="Chiudi il cantiere del verbale ${esc(ultime4(v.nr_verbale))}" data-aiuto="Chiude il cantiere per fine lavori: tutte le sue visite si chiudono e il rientro esce dalle scadenze. Si riapre dalla scheda del cantiere."><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg></button>`;
    else if (o.puoVisitare) az = `<button type="button" class="rg-btn rg-btn-arancio" data-rg="ritorno" data-vid="${esc(v.visita_id)}" data-nr="${esc(v.nr_verbale || '')}" aria-label="Avvia la visita di ritorno" data-aiuto="Apre una nuova visita di ritorno su questo cantiere, con cantiere, imprese e non conformità da rivedere già compilati."><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></button>`;
    return `<div class="rg-riga${az ? '' : ' senza-az'}${st.sel.has(v.cantiere_id) ? ' sel' : ''}">
      <label class="rg-chk"><input type="checkbox" data-rg="sel" data-cid="${esc(v.cantiere_id)}"${st.sel.has(v.cantiere_id) ? ' checked' : ''} aria-label="Seleziona il verbale ${esc(ultime4(v.nr_verbale))}"></label>
      <button type="button" class="rg-apri" data-rg="apri" data-vid="${esc(v.visita_id)}" data-aiuto="Apre il dettaglio dell'ultimo verbale di questo cantiere. Non cambia niente.">
        <span class="rg-r1"><span class="rg-nr" title="${esc(v.nr_verbale || '')}">${esc(ultime4(v.nr_verbale))}</span><span class="rg-cant">${esc(cant)}</span></span>
        <span class="rg-r2">${pezzi.join('')}${pezzi.length ? '<span>·</span>' : ''}${barre(ipc)}<span class="rg-ipc">${IPC_NOME[ipc] || 'Nessun rilievo'}</span>${dopoIpc ? '<span class="rg-coda">· ' + dopoIpc + '</span>' : ''}</span>
      </button>
      <a class="rg-btn rg-btn-grigio" href="${esc(nav)}" target="_blank" rel="noopener" aria-label="Naviga al cantiere" data-aiuto="Apre il navigatore verso il cantiere."><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"></path></svg></a>
      ${az}
    </div>`;
  }

  /* RientriGiorni.render(contenitore, opzioni)
       urgenti, prossime   — gli elenchi di loadScadenze (già filtrati per tecnico, comune, IPC…)
       tecMap              — tecnico_id → «Cognome Nome»
       maxScaduti          — quanti scaduti mostrare (Oggi: 5), il resto è contato
       entroGiorni         — fin dove arrivano i prossimi (Oggi: 7)
       onFiltri            — se c'è, il pulsante filtri chiama questo (Scadenze: apre i filtri di sempre),
                             e filtriAperti() dice se sono aperti (il pulsante resta evidenziato);
                             altrimenti apre un pannellino con IPC e finestra
       segreteria, puoVisitare — che cosa può fare chi guarda (lo decide chi chiama, per «Vedi come…»)
       dopo                — da chiamare dopo una riassegnazione o una chiusura (rilegge le scadenze) */
  function render(box, o) {
    if (!box) return;
    stile();
    const id = box.id || 'rg';
    const st = statoDi(id);
    st.ultimo = o;
    const tecNome = (tid) => (o.tecMap && o.tecMap[tid]) || '';
    o.tecNome = tecNome;
    o.tecBreve = (tid) => { const n = tecNome(tid); if (!n) return '–'; const p = n.split(/\s+/); return p.length > 1 ? p.slice(0, -1).join(' ') + ' ' + p[p.length - 1][0] + '.' : n; };
    o.mappa = (v) => { const c = v.cantieri || {}; const geo = c.lat != null && c.lng != null && c.lat !== '' && c.lng !== ''; return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(geo ? c.lat + ',' + c.lng : indirizzo(c) + ' ' + (c.comune_nome || '')); };
    const q = st.q.trim().toLowerCase();
    const passa = (v) => cerca(v, q, tecNome) && (!st.ipc || String(v.ipc || 'NR').toUpperCase() === st.ipc);
    const urg = (o.urgenti || []).filter(passa);
    const entro = st.gg ? +st.gg : (o.entroGiorni || null);
    const pros = (o.prossime || []).filter((v) => passa(v) && (!entro || v.diffDays <= entro));
    o.mostraTecnico = new Set([...(o.urgenti || []), ...(o.prossime || [])].map((v) => v.tecnico_id)).size > 1;
    o.righe = new Map([...(o.urgenti || []), ...(o.prossime || [])].map((v) => [v.cantiere_id, v]));

    let h = '<div class="rg">';
    h += `<div class="rg-cerca"><label><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg><input type="search" data-rg="q" value="${esc(st.q)}" placeholder="Verbale, via, tecnico…" aria-label="Cerca fra i rientri"></label>`
      + `<button type="button" class="rg-btn rg-btn-bordo${(o.onFiltri ? (o.filtriAperti && o.filtriAperti()) : (st.pannello || st.ipc || st.gg)) ? ' on' : ''}" data-rg="filtri" aria-label="Filtri" data-aiuto="${o.onFiltri ? 'Mostra o nasconde i filtri della pagina: tecnico, comuni, IPC, finestra di rientro.' : 'Filtra i rientri per IPC e per quanti giorni guardare avanti.'}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"></path></svg></button></div>`;
    if (!o.onFiltri && st.pannello) {
      const chip = (k, v, t) => `<button type="button" class="rg-chip${st[k] === v ? ' on' : ''}" data-rg="chip" data-k="${k}" data-v="${v}">${t}</button>`;
      h += '<div class="rg-pannello"><div><small>IPC</small>' + chip('ipc', '', 'Tutti') + chip('ipc', 'ALTO', 'Alto') + chip('ipc', 'MEDIO', 'Medio') + chip('ipc', 'BASSO', 'Basso') + '</div>'
        + '<div><small>Prossimi</small>' + chip('gg', '', o.entroGiorni ? o.entroGiorni + ' gg' : 'tutti') + ['15', '30', '60'].filter((g) => +g !== o.entroGiorni).map((g) => chip('gg', g, g + ' gg')).join('') + '</div></div>';
    }

    if (urg.length) {
      const max = o.maxScaduti || urg.length;
      h += `<section><div class="rg-testa scaduti"><b>SCADUTI</b><span>${urg.length} ${urg.length === 1 ? 'rientro' : 'rientri'}</span></div>`
        + urg.slice(0, max).map((v) => riga(v, o, st)).join('')
        + (urg.length > max ? `<span class="rg-altri">… e altri ${urg.length - max} scaduti: sono tutti nella pagina Scadenze.</span>` : '')
        + '</section>';
    }
    const gruppi = new Map();
    pros.forEach((v) => { const d = v.dr instanceof Date ? v.dr : new Date(v.dr); const k = chiaveGiorno(d); if (!gruppi.has(k)) gruppi.set(k, { d, n: v.diffDays, righe: [] }); gruppi.get(k).righe.push(v); });
    [...gruppi.values()].sort((a, b) => a.d - b.d).forEach((g) => {
      g.righe.sort((a, b) => (IPC_ORD[String(a.ipc || 'NR').toUpperCase()] ?? 3) - (IPC_ORD[String(b.ipc || 'NR').toUpperCase()] ?? 3));
      h += `<section><div class="rg-testa ${g.n <= 7 ? 'vicino' : 'lontano'}"><b>${dataGruppo(g.d)}</b><span>${traGiorni(g.n)} · ${g.righe.length}</span></div>`
        + g.righe.map((v) => riga(v, o, st)).join('') + '</section>';
    });
    if (!urg.length && !gruppi.size) h += `<div class="rg-vuoto">${q || st.ipc || st.gg ? 'Nessun rientro con questa ricerca.' : 'Nessun rientro scaduto' + (entro ? ' né nei prossimi ' + entro + ' giorni' : '') + '.'}</div>`;
    h += '</div>';

    // la ricerca non perde il cursore a ogni lettera
    const attivo = document.activeElement && box.contains(document.activeElement) && document.activeElement.dataset.rg === 'q';
    const pos = attivo ? document.activeElement.selectionStart : null;
    box.innerHTML = h;
    if (attivo) { const i = box.querySelector('[data-rg="q"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_e) { /* campo search */ } } }
    barra(box, st);
    aggancia(box, st);
  }

  function barra(box, st) {
    let b = box.querySelector(':scope > .rg-barra');
    const o = st.ultimo;
    // chi non è più nell'elenco (chiuso, riassegnato altrove) esce dalla selezione
    [...st.sel.keys()].forEach((k) => { if (!o.righe.has(k)) st.sel.delete(k); });
    const n = st.sel.size;
    const lista = box.querySelector(':scope > .rg'); if (lista) lista.classList.toggle('con-barra', !!n);   // le ultime righe non finiscono sotto la barra
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'rg-barra'; box.appendChild(b); }
    b.innerHTML = `<span><b>${n}</b><em> ${n === 1 ? 'selezionato' : 'selezionati'}</em></span>`
      + `<button type="button" class="rg-b-chiaro" data-rg="giro" data-aiuto="Apre il navigatore con i cantieri spuntati come tappe, in ordine dalla tua posizione (al massimo 10)."><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><path d="M3 11l19-9-9 19-2-8-8-2z"></path></svg>Giro</button>`
      + (o.segreteria ? `<button type="button" class="rg-b-chiaro" data-rg="riassegna" data-aiuto="Passa il rientro dei cantieri spuntati a un altro tecnico. Il verbale resta di chi l'ha fatto.">Riassegna</button>`
        + `<button type="button" class="rg-b-pieno" data-rg="chiudi-sel" data-aiuto="Chiude per fine lavori i cantieri spuntati: le loro visite e i loro incarichi si chiudono, e i rientri escono dalle scadenze.">Chiudi</button>` : '')
      + '<button type="button" class="rg-b-x" data-rg="desel" aria-label="Togli la selezione">✕</button>';
  }

  function aggancia(box, st) {
    if (box.dataset.rgAgganciato) return;
    box.dataset.rgAgganciato = '1';
    const ridisegna = () => render(box, st.ultimo);
    box.addEventListener('input', (e) => { if (e.target.dataset.rg === 'q') { st.q = e.target.value; ridisegna(); } });
    box.addEventListener('change', (e) => {
      const t = e.target; if (t.dataset.rg !== 'sel') return;
      const v = st.ultimo.righe.get(t.dataset.cid);
      if (t.checked && v) st.sel.set(t.dataset.cid, v); else st.sel.delete(t.dataset.cid);
      const r = t.closest('.rg-riga'); if (r) r.classList.toggle('sel', t.checked);
      barra(box, st);
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rg]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'A') return;
      const o = st.ultimo, az = b.dataset.rg;
      if (az === 'apri') { if (typeof window.showVisitaDetail === 'function') window.showVisitaDetail(b.dataset.vid); return; }
      if (az === 'ritorno') { if (typeof window.chiediNuovaVisitaRitorno === 'function') window.chiediNuovaVisitaRitorno(b.dataset.vid, b.dataset.nr || ''); return; }
      if (az === 'filtri') { if (o.onFiltri) o.onFiltri(); else st.pannello = !st.pannello; ridisegna(); return; }
      if (az === 'chip') { st[b.dataset.k] = b.dataset.v; ridisegna(); return; }
      if (az === 'desel') { st.sel.clear(); ridisegna(); return; }
      if (az === 'giro') { giro([...st.sel.values()]); return; }
      if (az === 'riassegna') { riassegna(box, st).catch((er) => avviso('Riassegnazione non riuscita: ' + (er.message || er), 'err')); return; }
      if (az === 'chiudi-sel') { chiudi(box, st, [...st.sel.values()]).catch((er) => avviso('Chiusura non riuscita: ' + (er.message || er), 'err')); return; }
      if (az === 'chiudi') { const v = o.righe.get(b.dataset.cid); if (v) chiudi(box, st, [v]).catch((er) => avviso('Chiusura non riuscita: ' + (er.message || er), 'err')); }
    });
  }

  /* il giro a tappe è quello di sempre (index.html): gli si passano le righe come se fossero state spuntate lì */
  function giro(righe) {
    if (typeof window._giroVai !== 'function' || typeof window._giroToggle !== 'function') { avviso('Il giro a tappe non è disponibile in questa pagina.', 'err'); return; }
    if (typeof window._giroClear === 'function') window._giroClear();
    righe.forEach((v) => {
      const c = v.cantieri || {};
      window._giroToggle({ checked: true, dataset: { id: v.cantiere_id, lat: c.lat != null ? String(c.lat) : '', lng: c.lng != null ? String(c.lng) : '', addr: indirizzo(c) + (c.comune_nome ? ', ' + c.comune_nome : ''), label: nomeCantiere(v) } });
    });
    window._giroVai();
    if (typeof window._giroClear === 'function') window._giroClear();
  }

  let _tecnici = null;
  async function riassegna(box, st) {
    const righe = [...st.sel.values()];
    if (!righe.length) return;
    if (!_tecnici) {
      const { data, error } = await window.sb.from('tecnici').select('tecnico_id,tecnico_nome,tecnico_cognome,email').eq('attivo', true).order('tecnico_cognome');
      if (error) throw new Error('non sono riuscito a leggere l\'elenco dei tecnici (' + error.message + ')');
      _tecnici = (data || []).filter((t) => String(t.email || '').toLowerCase() !== 'cptpd@did.formedilpadova.it');
    }
    if (!_tecnici.length) { avviso('Nessun tecnico attivo a cui riassegnare.', 'warn'); return; }
    const nome = (t) => [t.tecnico_nome, t.tecnico_cognome].filter(Boolean).join(' ');
    const sc = prompt('A chi passo il rientro di ' + righe.length + (righe.length === 1 ? ' cantiere' : ' cantieri') + '?\n\n' + _tecnici.map((t, i) => (i + 1) + ') ' + nome(t)).join('\n') + '\n\nScrivi il numero:');
    if (sc === null) return;
    const t = _tecnici[parseInt(sc, 10) - 1];
    if (!t) { avviso('Numero non valido: nessuna riassegnazione.', 'warn'); return; }
    const motivo = prompt('Perché? (facoltativo: resta scritto nella pratica)', '');
    if (motivo === null) return;
    let ok = 0; const ko = [];
    for (const v of righe) {
      const { error } = await window.sb.rpc('pendenza_assegna', { p_cantiere: v.cantiere_id, p_tecnico: t.tecnico_id, p_motivo: motivo.trim() || null });
      if (error) ko.push(ultime4(v.nr_verbale) + ': ' + error.message); else ok++;   // data.gia = era già suo: conta come fatto
    }
    st.sel.clear();
    if (ko.length) avviso('Riassegnati ' + ok + ' su ' + righe.length + ' a ' + nome(t) + '. Non riusciti — ' + ko.join('; '), 'err');
    else avviso((righe.length === 1 ? 'Rientro passato' : righe.length + ' rientri passati') + ' a ' + nome(t) + '.', 'ok');
    render(box, st.ultimo);   // la selezione sparisce subito, poi si rilegge dal database
    if (st.ultimo.dopo) await st.ultimo.dopo();
  }

  async function chiudi(box, st, righe) {
    if (!righe.length) return;
    const elenco = righe.slice(0, 8).map((v) => '· ' + ultime4(v.nr_verbale) + ' ' + nomeCantiere(v)).join('\n') + (righe.length > 8 ? '\n· … e altri ' + (righe.length - 8) : '');
    /* 05/10/2026: con il cantiere si chiudono i suoi incarichi (chiudi_cantiere); la conferma dice quali.
       Un incarico che ha più cantieri si chiude con l'ultimo: chiudendone diversi insieme può chiudersi anche se qui risulta «resta aperto». */
    let incarichi = '';
    if (typeof window.righeIncarichiCantiere === 'function') {
      for (const v of righe.slice(0, 8)) { const t = await window.righeIncarichiCantiere(v.cantiere_id); if (t) incarichi += '\n\n' + ultime4(v.nr_verbale) + ' ' + nomeCantiere(v) + ':' + t.replace(/^\n\n/, '\n'); }
    }
    if (!confirm((righe.length === 1 ? 'Chiudere questo cantiere' : 'Chiudere questi ' + righe.length + ' cantieri') + ' per fine lavori?\n\n' + elenco + '\n\nTutte le visite collegate si chiudono e il rientro esce dalle scadenze.' + incarichi)) return;
    const note = prompt('Note sulla chiusura (facoltative — lascia vuoto se non servono).\nPremi Annulla per interrompere.', '');
    if (note === null) return;
    let ok = 0, visite = 0; const ko = [], incChiusi = [];
    for (const v of righe) {
      const { data, error } = await window.sb.rpc('chiudi_cantiere', { p_cantiere_id: v.cantiere_id, p_motivo: 'termini_lavori', p_note: note.trim() || null });
      if (error) ko.push(ultime4(v.nr_verbale) + ': ' + error.message); else { ok++; visite += (data && data.visite_chiuse) || 0; st.sel.delete(v.cantiere_id); incChiusi.push(...((data && data.incarichi_chiusi) || [])); }
    }
    const inc = typeof window.esitoIncarichiCantiere === 'function' ? window.esitoIncarichiCantiere({ incarichi_chiusi: incChiusi }) : '';
    if (ko.length) avviso('Chiusi ' + ok + ' su ' + righe.length + inc + '. Non riusciti — ' + ko.join('; '), 'err');
    else avviso((ok === 1 ? 'Cantiere chiuso' : ok + ' cantieri chiusi') + ' · ' + visite + ' visite chiuse' + inc, 'ok');
    render(box, st.ultimo);   // la selezione sparisce subito, poi si rilegge dal database
    if (st.ultimo.dopo) await st.ultimo.dopo();
  }

  /* dall'esterno (la mappa dei rientri, mappa.js): spunta o toglie un cantiere nella lista, così finisce nella barra «Giro» */
  function seleziona(idBox, cantiereId, on) {
    const st = _stato.get(idBox); if (!st || !st.ultimo) return false;
    const v = st.ultimo.righe.get(cantiereId); if (!v) return false;
    if (on) st.sel.set(cantiereId, v); else st.sel.delete(cantiereId);
    const box = document.getElementById(idBox); if (box) render(box, st.ultimo);
    return true;
  }

  /* ── ELENCO VISITE SUL TELEFONO (04/10/2026, chiesto dall'utente: «più comoda anche per la pagina con lista») ──
     Stesse righe compatte dei rientri, senza casella (nell'elenco visite non ci sono azioni su più righe).
     Riga: verbale (ultime 4 cifre) e cantiere · data, impresa, IPC a tre barre, bozza/definitivo, invio · PDF ·
     Riapri (bozza) o Email (definitivo) o Ripristina (eliminata, solo segreteria). Il tocco apre la scheda del
     verbale, che ha anche visita di ritorno, Modifica ed Elimina. Raggruppate per giorno quando l'ordine è per data.
     I dati e le azioni li passa loadLista (index.html): qui non si legge e non si scrive niente. */
  const ICONA_PDF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><path d="M9 13h6M9 17h4"></path></svg>';
  const ICONA_MAIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg>';
  const ICONA_MATITA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
  const ICONA_RIPRISTINA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path></svg>';
  const dataBreve = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] : ''; };

  function rigaVisita(v, o) {
    const ipc = String(v.ipc || 'NR').toUpperCase();
    const elim = +v.elimina === 1, bozza = (v.stato || 'bozza') === 'bozza';
    const c = v.cantieri || {};
    const cant = c.cantiere_etichetta || c.cantiere_indirizzo || '—';
    const inv = o.invio ? o.invio(v) : { st: '' };
    const invTxt = bozza ? '' : inv.st === 'app' ? '<span style="color:' + GRIGIO + '">✓ ' + esc(dataBreve(inv.quando)) + '</span>'
      : inv.st === 'vecchia' ? '<span style="color:' + GRIGIO + '">✓</span>'
      : inv.st === '?' ? '<span style="color:' + GRIGIO + '">invio ?</span>'
      : inv.st === 'da' ? '<b style="color:' + ARANCIO + '">da inviare</b>' : '';
    const stato = elim ? '<b style="color:' + ARANCIO + '">eliminata</b>' : bozza ? '<b style="color:' + ARANCIO + '">bozza</b>' : '<span>definitivo</span>';
    // l'impresa va in coda e si taglia: IPC, stato e «da inviare» devono restare sempre visibili
    const impresa = v.imprese && v.imprese.impresa_nome ? esc(v.imprese.impresa_nome) : '';
    const b1 = elim ? '' : `<button type="button" class="rg-btn rg-btn-grigio" data-rv="pdf" data-vid="${esc(v.visita_id)}" aria-label="PDF del verbale" data-aiuto="Apre il PDF del verbale.">${ICONA_PDF}</button>`;
    let b2 = '';
    if (elim) { if (o.segreteria) b2 = `<button type="button" class="rg-btn rg-btn-arancio" data-rv="ripristina" data-vid="${esc(v.visita_id)}" data-nr="${esc(v.nr_verbale || '')}" aria-label="Ripristina la visita" data-aiuto="Toglie la visita dalle eliminate: torna nelle statistiche e nei conteggi.">${ICONA_RIPRISTINA}</button>`; }
    else if (bozza) b2 = `<button type="button" class="rg-btn rg-btn-arancio" data-rv="riapri" data-vid="${esc(v.visita_id)}" aria-label="Riapri la bozza" data-aiuto="Riapre la bozza nel verbale, per completarla e chiuderla.">${ICONA_MATITA}</button>`;
    else b2 = `<button type="button" class="rg-btn rg-btn-arancio" data-rv="email" data-vid="${esc(v.visita_id)}" aria-label="Invia il verbale per mail" data-aiuto="Prepara l'invio del verbale all'impresa e agli altri destinatari.">${ICONA_MAIL}</button>`;
    const col = (b1 ? ' 44px' : '') + (b2 ? ' 44px' : '');
    return `<div class="rg-riga" style="grid-template-columns:minmax(0,1fr)${col};padding-left:14px${elim ? ';opacity:.55' : ''}">
      <button type="button" class="rg-apri" data-rv="apri" data-vid="${esc(v.visita_id)}" data-aiuto="Apre la scheda del verbale: rilievi, imprese, note, e i pulsanti PDF, Email, visita di ritorno.">
        <span class="rg-r1"><span class="rg-nr" title="${esc(v.nr_verbale || '')}">${esc(ultime4(v.nr_verbale))}</span><span class="rg-cant">${esc(cant)}</span></span>
        <span class="rg-r2"><span>${esc(dataBreve(v.data_visita))}</span><span>·</span>${barre(ipc)}<span class="rg-ipc">${IPC_NOME[ipc] || 'Nessun rilievo'}</span><span style="flex:0 0 auto">· ${stato}${invTxt ? ' · ' + invTxt : ''}</span>${impresa ? '<span class="rg-coda">· ' + impresa + '</span>' : ''}</span>
      </button>${b1}${b2}
    </div>`;
  }

  /* renderVisite(contenitore, visite, opzioni)
       perData    — l'elenco è in ordine di data: si raggruppa per giorno
       segreteria — mostra Ripristina sulle eliminate
       invio(v)   — {st:'' | 'app' | 'vecchia' | '?' | 'da', quando} (lo stato d'invio che la tabella mostra già)
       azioni     — { apri, pdf, email, riapri, ripristina } (le funzioni di sempre dell'elenco) */
  function renderVisite(box, visite, o) {
    if (!box) return;
    stile();
    const righe = visite || [];
    let h = '<div class="rg">';
    if (o.perData) {
      let k = null;
      const gruppi = [];
      righe.forEach((v) => { const g = String(v.data_visita || '').slice(0, 10); if (g !== k) { gruppi.push({ g, r: [] }); k = g; } gruppi[gruppi.length - 1].r.push(v); });
      gruppi.forEach((x) => {
        const d = x.g ? new Date(x.g + 'T00:00:00') : null;
        h += `<section><div class="rg-testa lontano"><b>${d ? dataGruppo(d) + ' ' + d.getFullYear() : 'SENZA DATA'}</b><span>${x.r.length} ${x.r.length === 1 ? 'visita' : 'visite'}</span></div>`
          + x.r.map((v) => rigaVisita(v, o)).join('') + '</section>';
      });
    } else h += righe.map((v) => rigaVisita(v, o)).join('');
    h += '</div>';
    box.innerHTML = h;
    box._rvAzioni = o.azioni || {};
    box._rvRighe = new Map(righe.map((v) => [String(v.visita_id), v]));
    if (box.dataset.rvAgganciato) return;
    box.dataset.rvAgganciato = '1';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rv]'); if (!b) return;
      const f = box._rvAzioni[b.dataset.rv];
      if (typeof f === 'function') f(b.dataset.vid, b.dataset.nr || '');
    });
  }

  window.RientriGiorni = { render, seleziona, renderVisite };
})();
