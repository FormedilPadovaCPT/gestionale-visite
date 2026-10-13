/* ============================================================
   ELENCO CANTIERI SUL TELEFONO — schede ordinate
   (13/10/2026, proposta B scelta dall'utente fra tre:
   proposte_grafiche/2026_10_13_elenco-cantieri/)

   Sotto i 720 px la tabella dei cantieri non diventa più una scheda
   con una riga etichettata per ogni colonna (veste-v2.js, .v2-schede),
   ma una scheda che si legge dall'alto: comune e quartiere, indirizzo
   grande, committente, i codici in piccole etichette, due pulsanti
   larghi in fondo. I campi vuoti non si mostrano. Sul PC resta la
   tabella di sempre.

   _clRender (index.html) prepara righe, lotti e filtri come per la
   tabella e chiama disegna(): qui si scrive solo l'HTML. I pulsanti
   portano gli stessi attributi della tabella (data-act="detail-cantiere",
   data-cant-id, .giro-chk con onchange=_giroToggle) e index.html li
   collega con lo stesso codice, così «+ Visita», scheda e giro a tappe
   restano una cosa sola. La proposta di chiusura per i tecnici sta
   nella scheda del cantiere (proposte-chiusura.js); qui si vede solo
   se è già stata fatta.
   ============================================================ */
(function () {
  'use strict';
  const MQ = '(max-width:720px)';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dIt = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

  function attivo() { return !!(window.matchMedia && window.matchMedia(MQ).matches); }

  const indirizzo = (c) => `${c.cantiere_indirizzo || ''} ${c.cantiere_civico || ''}`.trim();
  const nome = (c) => c.cantiere_etichetta || indirizzo(c) || '(senza indirizzo)';

  /* «3 visite · ultima 07/10/2026»; «mai visitato» solo se la data delle visite è stata letta
     (ult_visita === null): se la lettura non è riuscita (undefined) si dice il numero e basta */
  function testoVisite(n, ult) {
    n = n || 0;
    if (!n) return ult === null ? 'mai visitato' : '0 visite';
    return n + (n === 1 ? ' visita' : ' visite') + (ult ? ' · ultima ' + dIt(ult) : '');
  }

  function quartiere(c) {
    return typeof window.quartiereBadge === 'function' ? window.quartiereBadge(c.cantiere_indirizzo || '', c.comune_nome || '') : '';
  }

  /* la casella del giro a tappe: stessi dati della tabella, così _giroToggle non vede differenze */
  function giro(c, giroSel, addr, label) {
    const id = 'ct-g-' + String(c.cantiere_id).replace(/[^\w-]/g, '_');
    return `<label class="ct-giro" for="${esc(id)}"><input type="checkbox" id="${esc(id)}" class="giro-chk" data-id="${esc(c.cantiere_id)}" data-lat="${esc(c.lat == null ? '' : c.lat)}" data-lng="${esc(c.lng == null ? '' : c.lng)}" data-addr="${esc(addr)}" data-label="${esc(label)}"${giroSel && giroSel.has(c.cantiere_id) ? ' checked' : ''} onchange="_giroToggle(this)">Giro a tappe</label>`;
  }

  const pillLotto = (c) => String(c.lotto || '').trim() ? `<span class="ct-lot">🧩 lotto ${esc(c.lotto)}</span>` : '';
  const chiuso = (c) => c.cantiere_chiuso ? '<span class="ct-chiuso">🔒 chiuso</span>' : '';
  const proposta = (c) => (c._prop && window.propChius && typeof window.propChius.cellaRiga === 'function') ? window.propChius.cellaRiga(c) : '';

  function schedaCantiere(c, o, inLotto) {
    const label = nome(c);
    const addr = indirizzo(c) + (c.comune_nome ? ', ' + c.comune_nome : '');
    const det = indirizzo(c) + (c.comune_nome ? ' – ' + c.comune_nome : '');
    const n = c.n_visite || 0;
    const chips = [
      c.cantiere_cnce ? `<span class="ct-chip ct-mono">${esc(c.cantiere_cnce)}</span>` : '',
      `<span class="ct-chip ct-vis${n ? '' : ' ct-zero'}">${esc(testoVisite(n, c.ult_visita))}</span>`,
      c.nodo_id ? `<span class="ct-chip ct-mono">cod. ${esc(c.nodo_id)}</span>` : '',
      proposta(c),
    ].join('');
    return `<article class="ct-card${inLotto ? ' ct-lotto' : ''}">
      <div class="ct-head">${inLotto ? pillLotto(c) : `<span class="ct-com">${esc(c.comune_nome || 'Comune non indicato')}</span>${quartiere(c)}`}${giro(c, o.giroSel, addr, label)}</div>
      <h3 class="ct-tit">${esc(label)}${inLotto ? '' : pillLotto(c)}${chiuso(c)}</h3>
      ${c.cantiere_etichetta && indirizzo(c) ? `<div class="ct-comm"><span class="ct-lab">Indirizzo</span>${esc(indirizzo(c))}</div>` : ''}
      ${c.committente_nome ? `<div class="ct-comm"><span class="ct-lab">Committente</span>${esc(c.committente_nome)}</div>` : ''}
      <div class="ct-chips">${chips}</div>
      <div class="ct-act"><button type="button" class="btn-outline" data-act="detail-cantiere" data-id="${esc(c.cantiere_id)}">Apri scheda</button><button type="button" class="btn-primary" data-cant-id="${esc(c.cantiere_id)}" data-cant-label="${esc(label)}" data-cant-detail="${esc(det)}">+ Visita</button></div>
    </article>`;
  }

  function schedaSegnalato(c, o) {
    const quando = c.seg_data ? new Date(c.seg_data).toLocaleDateString('it-IT') : '';
    const nav = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(c.lat + ',' + c.lng) + '&travelmode=driving';
    return `<article class="ct-card ct-segn">
      <div class="ct-head"><span class="ct-com">Segnalato</span>${giro(c, o.giroSel, c.lat + ',' + c.lng, c.label)}</div>
      <h3 class="ct-tit">📍 ${esc(c.label)}</h3>
      ${c.seg_tec || quando ? `<div class="ct-comm">${esc([c.seg_tec, quando].filter(Boolean).join(' · '))}</div>` : ''}
      <div class="ct-act ct-uno"><a class="btn-outline" href="${esc(nav)}" target="_blank" rel="noopener">🧭 Naviga</a></div>
    </article>`;
  }

  function schedaComplesso(u, o) {
    const righe = u.righe.slice().sort((a, b) => o.ordLotto(a.lotto).localeCompare(o.ordLotto(b.lotto)));
    const c0 = righe[0];
    const tot = righe.reduce((s, c) => s + (c.n_visite || 0), 0);
    const ult = righe.map((c) => c.ult_visita).filter(Boolean).sort().pop() || (righe.every((c) => c.ult_visita === null) ? null : undefined);
    const titolo = (o.base ? o.base(c0.cantiere_etichetta) : c0.cantiere_etichetta) || indirizzo(c0) || '(senza indirizzo)';
    const cnce = righe.map((c) => c.cantiere_cnce).find((x) => /^cnce/i.test(x || ''));
    const comm = righe.map((c) => c.committente_nome).find(Boolean);
    const aperto = o.apertiTutti || (o.aperti && o.aperti.has(u.k));
    return `<article class="ct-card ct-compl">
      <div class="ct-head"><span class="ct-com">${esc(c0.comune_nome || 'Comune non indicato')}</span>${quartiere(c0)}</div>
      <h3 class="ct-tit">${esc(titolo)} <span class="ct-nl">complesso, ${righe.length} lotti</span></h3>
      ${comm ? `<div class="ct-comm"><span class="ct-lab">Committente</span>${esc(comm)}</div>` : ''}
      <div class="ct-chips">${cnce ? `<span class="ct-chip ct-mono">${esc(cnce)}</span>` : ''}<span class="ct-chip ct-vis${tot ? '' : ' ct-zero'}">${esc(testoVisite(tot, ult))}</span></div>
      <div class="ct-act"><button type="button" class="btn-outline" data-act="detail-cantiere" data-id="${esc(c0.cantiere_id)}">Apri scheda</button><button type="button" class="btn-outline ct-lotti-btn" data-ct-lotti="${esc(u.k)}" aria-expanded="${aperto ? 'true' : 'false'}">Lotti (${righe.length}) ${aperto ? '▴' : '▾'}</button></div>
    </article>
    <div class="ct-lotti" data-ct-of="${esc(u.k)}"${aperto ? '' : ' hidden'}>${righe.map((c) => schedaCantiere(c, o, true)).join('')}</div>`;
  }

  /* l'HTML dell'elenco: stesse unità e stesso taglio dei primi «shown» cantieri della tabella */
  function html(o) {
    let resi = 0;
    const parti = o.unita.map((u) => {
      if (resi >= o.shown) return '';
      if (u.righe.length < 2) { resi += 1; const c = u.righe[0]; return c._segn ? schedaSegnalato(c, o) : schedaCantiere(c, o, false); }
      resi += u.righe.length;
      return schedaComplesso(u, o);
    }).join('');
    const altri = o.all.length - o.shown;
    return parti + (altri > 0 ? `<button class="btn-outline ct-altri" id="btn-cant-more" type="button">Mostra tutti i ${o.all.length} cantieri (altri ${altri})</button>` : '');
  }

  function stile() {
    if (document.getElementById('ct-stile')) return;
    const st = document.createElement('style'); st.id = 'ct-stile';
    st.textContent = `
#cant-tel{display:flex;flex-direction:column;gap:12px;margin-top:6px}
#cant-tel .ct-card{background:#fff;border:1px solid #e3e4e7;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;min-width:0}
#cant-tel .ct-card:has(> .ct-head .giro-chk:checked){border:2px solid var(--orange,#e7500f);padding:11px 13px}
#cant-tel .ct-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:26px}
#cant-tel .ct-com{font-size:12px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:#565C66}
#cant-tel .ct-giro{margin-left:auto;position:relative;display:inline-flex;align-items:center;gap:4px;border:1.5px solid #c7c9ce;border-radius:16px;font-size:12px;font-weight:600;padding:3px 10px;color:#565C66;cursor:pointer;white-space:nowrap;text-transform:none;letter-spacing:0;margin-bottom:0}
#cant-tel .ct-giro::before{content:"🧭"}
#cant-tel .ct-giro input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
#cant-tel .ct-giro:has(input:checked){background:var(--orange,#e7500f);border-color:var(--orange,#e7500f);color:#fff}
#cant-tel .ct-giro:has(input:checked)::before{content:"✓"}
#cant-tel .ct-giro:focus-within{outline:2px solid var(--orange,#e7500f);outline-offset:2px}
#cant-tel .ct-tit{font-size:19px;font-weight:700;line-height:1.2;margin:0;color:#2f343b;overflow-wrap:anywhere}
#cant-tel .ct-nl{font-size:12px;font-weight:500;color:#888;white-space:nowrap}
#cant-tel .ct-lot{display:inline-block;font-size:11px;font-weight:700;color:var(--orange,#e7500f);border:1px solid var(--orange,#e7500f);padding:0 6px;border-radius:4px;margin-left:6px;vertical-align:middle;white-space:nowrap}
#cant-tel .ct-head .ct-lot{margin-left:0}
#cant-tel .ct-chiuso{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#c0392b;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;white-space:nowrap}
#cant-tel .ct-comm{font-size:14px;color:#2f343b;overflow-wrap:anywhere}
#cant-tel .ct-lab{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#888;margin-right:6px}
#cant-tel .ct-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#cant-tel .ct-chip{font-size:12px;border-radius:6px;padding:2px 8px;background:#f1f2f4;color:#565C66;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
#cant-tel .ct-mono{font-family:ui-monospace,Consolas,monospace;font-size:11px}
#cant-tel .ct-vis{background:#eef0fb;color:#3a4290;font-weight:600}
#cant-tel .ct-vis.ct-zero{background:#fff3e0;color:#9a5b00}
#cant-tel .ct-act{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:3px}
#cant-tel .ct-act.ct-uno{grid-template-columns:1fr}
#cant-tel .ct-act>*{width:100%;min-height:42px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;text-decoration:none;margin:0}
#cant-tel .ct-segn .ct-tit{color:#d5008f}
#cant-tel .ct-compl{background:#fbfbfb}
#cant-tel .ct-lotti{display:flex;flex-direction:column;gap:10px;margin:-4px 0 0 14px;padding-left:10px;border-left:2px solid #e3e4e7}
#cant-tel .ct-lotti[hidden]{display:none}
#cant-tel .ct-lotto{background:#fafafa}
#cant-tel .ct-altri{width:100%;min-height:42px}
`;
    document.head.appendChild(st);
  }

  function contenitore(tbody) {
    const wrap = tbody.closest('.tbl-wrap') || tbody.closest('table');
    let box = document.getElementById('cant-tel');
    if (!box) {
      box = document.createElement('div'); box.id = 'cant-tel';
      wrap.parentNode.insertBefore(box, wrap.nextSibling);
      // il bottone «Lotti» apre e chiude i lotti del complesso, come la riga del complesso nella tabella
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ct-lotti]'); if (!b) return;
        const k = b.dataset.ctLotti;
        const l = [...box.querySelectorAll('.ct-lotti')].find((x) => x.dataset.ctOf === k); if (!l) return;
        const apri = l.hidden;
        l.hidden = !apri;
        window._clAperti = window._clAperti || new Set();
        if (apri) window._clAperti.add(k); else window._clAperti.delete(k);
        b.setAttribute('aria-expanded', apri ? 'true' : 'false');
        b.textContent = b.textContent.replace(/[▾▴]\s*$/, apri ? '▴' : '▾');
      });
    }
    return { wrap, box };
  }

  /* chiamata da _clRender sul telefono: nasconde la tabella e scrive le schede; restituisce il contenitore */
  function disegna(o) {
    stile();
    const { wrap, box } = contenitore(o.tbody);
    o.tbody.innerHTML = '';
    if (wrap) wrap.style.display = 'none';
    box.hidden = false;
    box.innerHTML = html(o);
    return box;
  }

  /* sul PC: torna la tabella */
  function spegni(tbody) {
    const box = document.getElementById('cant-tel');
    if (box) { box.innerHTML = ''; box.hidden = true; }
    const wrap = tbody && (tbody.closest('.tbl-wrap') || tbody.closest('table'));
    if (wrap) wrap.style.display = '';
  }

  /* nessun cantiere: niente schede rimaste dalla ricerca di prima */
  function svuota() { const box = document.getElementById('cant-tel'); if (box) box.innerHTML = ''; }

  // se il telefono gira o la finestra cambia misura, si ridisegna nella forma giusta
  if (window.matchMedia) {
    const mq = window.matchMedia(MQ);
    const ridisegna = () => { if (typeof window._clRender === 'function') window._clRender(); };
    if (mq.addEventListener) mq.addEventListener('change', ridisegna); else if (mq.addListener) mq.addListener(ridisegna);
  }

  window.ElencoCantieriTel = { attivo, disegna, spegni, svuota, html, testoVisite };
})();
