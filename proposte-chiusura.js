/* ============================================================
   PROPOSTA DI CHIUSURA DEL CANTIERE — dal tecnico alla segreteria
   (23/09/2026, chiesto dall'utente).

   Il tecnico sa che un cantiere è finito prima di chiunque altro:
   c'è stato. Ma chiudere un cantiere chiude anche le sue visite e
   lo toglie dalle scadenze, quindi la chiusura resta alla segreteria
   (funzione chiudi_cantiere). Il tecnico PROPONE, con due parole sul
   perché; la segreteria chiude o respinge.

   Dove si vede:
   - tecnico: pulsante «📨 Proponi chiusura» nella riga dell'elenco
     cantieri e nella scheda del cantiere; a proposta fatta, al suo
     posto «⏳ Chiusura proposta»;
   - segreteria: riquadro in Dashboard con le proposte aperte, e
     nella scheda del cantiere l'avviso con «Respingi la proposta»
     accanto a «Chiudi cantiere».

   Nel database (migrazione cantieri_proposte_chiusura):
   - tabella cantieri_proposte_chiusura, una proposta aperta per
     cantiere, storico conservato (la riga non si cancella: si chiude
     con esito accolta/respinta);
   - proponi_chiusura_cantiere(p_cantiere_id, p_motivo) per il personale;
   - respingi_proposta_chiusura(p_id, p_note) solo segreteria/coordinatore;
   - trigger: quando il cantiere si chiude, la proposta aperta è accolta.

   Script classico come mail-respinte-tec.js: usa window.sb, window.S,
   window.toast, window.showCantiereDetail, window.chiudiCantiere.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const ufficio = () => !!(window.__isCoord || window.__isSegreteria);

  /* proposte aperte, per cantiere */
  async function aperte() {
    const { data, error } = await window.sb.from('cantieri_proposte_chiusura')
      .select('id, cantiere_id, proposta_da, proposta_nome, proposta_il, motivo')
      .is('esito', null).order('proposta_il', { ascending: false }).limit(1000);
    if (error) throw error;
    return new Map((data || []).map((p) => [p.cantiere_id, p]));
  }

  function chi(p) { return p.proposta_nome || p.proposta_da || ''; }

  /* HTML per la riga dell'elenco cantieri (c = riga, c._prop = proposta aperta) */
  function cellaRiga(c) {
    if (!c || c._segn || c.cantiere_chiuso) return '';
    if (c._prop) {
      const t = 'Chiusura proposta da ' + chi(c._prop) + ' il ' + dIt(c._prop.proposta_il) + ': ' + (c._prop.motivo || '');
      return `<span data-aiuto="${esc(t)}" style="font-size:11px;font-weight:600;color:#b35c00;white-space:nowrap;align-self:center">⏳ Chiusura proposta</span>`;
    }
    if (ufficio()) return '';   // la segreteria chiude direttamente dalla scheda
    return `<button class="btn-outline btn-sm" data-prop-chius="${esc(c.cantiere_id)}" data-lbl="${esc(c.cantiere_etichetta || ((c.cantiere_indirizzo || '') + ' ' + (c.cantiere_civico || '')).trim())}">📨 Proponi chiusura</button>`;
  }

  async function proponi(cantId, label) {
    const motivo = prompt(`Proponi alla segreteria di chiudere il cantiere\n«${label || cantId}»\n\nPerché va chiuso? (per esempio: lavori finiti, ponteggio smontato, impresa andata via)`);
    if (motivo === null) return false;
    if (!motivo.trim()) { avviso('Scrivi due parole sul perché: è quello che legge la segreteria per decidere.', 'warn'); return false; }
    try {
      const { data, error } = await window.sb.rpc('proponi_chiusura_cantiere', { p_cantiere_id: cantId, p_motivo: motivo.trim() });
      if (error) throw error;
      if (data && data.gia_proposta) avviso('La chiusura era già stata proposta da ' + (data.proposta_da || 'un collega') + ' il ' + dIt(data.proposta_il) + '.', 'warn');
      else avviso('Proposta inviata alla segreteria: decide lei se chiudere il cantiere.', 'ok');
      return true;
    } catch (e) { avviso('Proposta non inviata: ' + (e.message || e), 'err'); return false; }
  }

  async function respingi(id, label) {
    const note = prompt(`Respingere la proposta di chiusura\n«${label || ''}»?\n\nPerché il cantiere resta aperto? (lo legge chi l'ha proposta)`);
    if (note === null) return false;
    if (!note.trim()) { avviso('Scrivi il motivo: è la risposta per chi ha proposto.', 'warn'); return false; }
    try {
      const { error } = await window.sb.rpc('respingi_proposta_chiusura', { p_id: id, p_note: note.trim() });
      if (error) throw error;
      avviso('Proposta respinta: il cantiere resta aperto.', 'ok');
      return true;
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); return false; }
  }

  function ricarica() {
    if (typeof window.loadCantieri === 'function' && !$('view-cantieri')?.classList.contains('hidden')) window.loadCantieri();
    disegna().catch(() => {});
  }

  /* Nella scheda del cantiere: chiamata da showCantiereDetail */
  async function scheda(cantId, label, chiuso) {
    const body = $('qd-body'), acts = $('qd-actions');
    if (!body || !acts || !window.sb) return;
    let p = null;
    try {
      const { data, error } = await window.sb.from('cantieri_proposte_chiusura')
        .select('id, proposta_da, proposta_nome, proposta_il, motivo').eq('cantiere_id', cantId).is('esito', null).maybeSingle();
      if (error) throw error;
      p = data;
    } catch (e) {
      /* un errore di lettura non è «nessuna proposta» (regola del 19/09) */
      body.insertAdjacentHTML('afterbegin', `<div style="font-size:12px;color:#c0392b;margin-bottom:8px">Non sono riuscito a leggere se c'è una proposta di chiusura: ${esc(e.message || e)}</div>`);
      return;
    }
    if (chiuso) return;
    if (p) {
      body.insertAdjacentHTML('afterbegin', `<div class="qd-note" style="border-color:#e67e22;background:#fff6ec;margin-bottom:10px">
        <b>📨 Chiusura proposta</b> da ${esc(chi(p))} il ${dIt(p.proposta_il)}<div style="white-space:pre-wrap;margin-top:3px">${esc(p.motivo)}</div>
        ${ufficio() ? '' : '<div style="font-size:11px;color:#888;margin-top:4px">Decide la segreteria: finché non lo chiude, il cantiere resta attivo.</div>'}</div>`);
      if (ufficio()) {
        const b = document.createElement('button');
        b.className = 'btn-outline btn-sm'; b.style.marginLeft = '8px'; b.textContent = '✖ Respingi la proposta';
        b.onclick = async () => { if (await respingi(p.id, label)) { window.hide && window.hide('modal-qd'); ricarica(); } };
        acts.appendChild(b);
      }
      return;
    }
    if (!ufficio()) {
      const b = document.createElement('button');
      b.className = 'btn-outline btn-sm'; b.style.marginLeft = '8px'; b.textContent = '📨 Proponi chiusura alla segreteria';
      b.onclick = async () => { if (await proponi(cantId, label)) { window.hide && window.hide('modal-qd'); ricarica(); } };
      acts.appendChild(b);
    }
  }

  /* Riquadro in Dashboard, solo per la segreteria */
  async function disegna() {
    const box = $('dash-prop-chiusura');
    if (!box || !window.sb || !(window.S && window.S.user)) return;
    if (!ufficio()) { box.style.display = 'none'; box.innerHTML = ''; return; }
    let righe = [];
    try {
      const { data, error } = await window.sb.from('cantieri_proposte_chiusura')
        .select('id, cantiere_id, proposta_da, proposta_nome, proposta_il, motivo, cantieri(cantiere_etichetta, cantiere_indirizzo, cantiere_civico, comune_nome)')
        .is('esito', null).order('proposta_il').limit(200);
      if (error) {
        box.innerHTML = '<div class="card" style="border-left:4px solid #e67e22"><h3>📨 Cantieri proposti per la chiusura</h3>'
          + '<p style="font-size:12px;color:#c0392b;margin:4px 0">Non sono riuscito a leggere l\'elenco: ' + esc(error.message) + '</p></div>';
        box.style.display = '';
        return;
      }
      righe = data || [];
    } catch (e) { box.style.display = 'none'; return; }
    if (!righe.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const riga = (p) => {
      const c = p.cantieri || {};
      const lbl = c.cantiere_etichetta || ((c.cantiere_indirizzo || '') + ' ' + (c.cantiere_civico || '')).trim() || p.cantiere_id;
      return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid #f0e6dd">
        <span style="font-size:12px;color:#444;flex:1;min-width:240px"><strong>${esc(lbl)}</strong>${c.comune_nome ? ' &middot; ' + esc(c.comune_nome) : ''}
          <br><span style="color:#888">${esc(chi(p))} &middot; ${dIt(p.proposta_il)} &middot; </span>${esc(p.motivo)}</span>
        <button class="btn-outline btn-sm" data-prop-apri="${esc(p.cantiere_id)}">👁 Apri scheda</button>
        <button class="btn-warn btn-sm" data-prop-chiudi="${esc(p.cantiere_id)}" data-lbl="${esc(lbl)}">🔒 Chiudi cantiere (fine lavori)</button>
        <button class="btn-outline btn-sm" data-prop-resp="${p.id}" data-lbl="${esc(lbl)}">✖ Respingi la proposta</button>
      </div>`;
    };
    box.innerHTML = `<div class="card" style="border-left:4px solid #e67e22">
      <h3>📨 Cantieri proposti per la chiusura <span style="color:#e67e22">&mdash; ${righe.length}</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">Un tecnico dice che il cantiere è finito. Se è così, chiudilo: si chiudono anche le sue visite ed esce dalle scadenze. Se non lo è, respingi scrivendo perché.</p>
      ${righe.map(riga).join('')}
    </div>`;
    box.style.display = '';
  }

  document.addEventListener('click', async (e) => {
    const pr = e.target.closest('[data-prop-chius]');
    if (pr) { e.stopPropagation(); if (await proponi(pr.dataset.propChius, pr.dataset.lbl)) ricarica(); return; }
    const ap = e.target.closest('[data-prop-apri]');
    if (ap) { if (window.showCantiereDetail) window.showCantiereDetail(ap.dataset.propApri); return; }
    const ch = e.target.closest('[data-prop-chiudi]');
    if (ch) {
      if (typeof window.chiudiCantiere !== 'function') { avviso('Funzione di chiusura non disponibile: ricarica la pagina.', 'err'); return; }
      await window.chiudiCantiere(ch.dataset.propChiudi, ch.dataset.lbl);
      disegna().catch(() => {});
      return;
    }
    const rs = e.target.closest('[data-prop-resp]');
    if (rs) { if (await respingi(Number(rs.dataset.propResp), rs.dataset.lbl)) ricarica(); }
  });

  window.propChius = { aperte, cellaRiga, scheda, box: disegna };
})();
