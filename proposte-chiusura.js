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

   (23/10/2026, chiesto dall'utente: «la proposta di chiusura … si
   potrebbe fare proprio dalla pagina scadenze prendendo una visita»)
   - «🏁 Cantiere finito» anche dalla pagina Scadenze (pulsante sulla
     riga del PC, barra in basso del telefono quando si spunta una
     riga) e dal dettaglio del verbale;
   - una finestra al posto della domanda: il GIORNO in cui il tecnico
     ha visto il cantiere finito (non nel futuro, non prima
     dell'ultima visita: lo controlla anche il database) e il motivo;
   - finché la proposta è aperta il rientro esce dalle scadenze e va
     nel gruppo «⏳ In attesa di chiusura» in fondo alla pagina; lo
     stesso fanno il promemoria del lunedì e la lettera di incarico.
     Respinta, il rientro torna e la riga dice perché.

   Nel database (migrazioni cantieri_proposte_chiusura e
   2026_10_23_cantiere_finito_dalle_scadenze):
   - tabella cantieri_proposte_chiusura, una proposta aperta per
     cantiere, storico conservato (la riga non si cancella: si chiude
     con esito accolta/respinta); fine_constatata_il = il giorno visto;
   - proponi_chiusura_cantiere(p_cantiere_id, p_motivo, p_fine_il) per il personale;
   - respingi_proposta_chiusura(p_id, p_note) solo segreteria/coordinatore;
   - trigger: quando il cantiere si chiude, la proposta aperta è accolta.

   Script classico come mail-respinte-tec.js: usa window.sb, window.S,
   window.toast, window.showCantiereDetail, window.chiudiCantiere.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const avviso = (msg, tipo, ms) => (window.toast ? window.toast(msg, tipo, ms) : alert(msg));
  // (08/10/2026) anche il coordinatore chiude i cantieri e risponde alle proposte (chiudi_cantiere e
  // respingi_proposta_chiusura lo permettono già): non gli si chiede di proporre alla segreteria
  const ufficio = () => !!(window.__isCoord || window.__isSegreteria || window.__isCoordinatoreVero);
  /* chi può proporre: il personale che non chiude da sé, e non chi guarda in sola lettura (consiglieri) */
  const puoProporre = () => !ufficio() && !document.body.classList.contains('viewer-mode');
  const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const MOTIVI = {
    finiti: 'Lavori finiti',
    sparito: 'All\'indirizzo non c\'è più nessun cantiere',
    altro: 'Altro',
  };

  /* proposte aperte, per cantiere */
  async function aperte() {
    const { data, error } = await window.sb.from('cantieri_proposte_chiusura')
      .select('id, cantiere_id, proposta_da, proposta_nome, proposta_il, motivo, fine_constatata_il')
      .is('esito', null).order('proposta_il', { ascending: false }).limit(1000);
    if (error) throw error;
    return new Map((data || []).map((p) => [p.cantiere_id, p]));
  }

  /* per la pagina Scadenze: le aperte e, per cantiere, l'ultima respinta (la riga dice perché è tornata).
     Un errore NON è «nessuna proposta»: chi chiama lo dice (regola del 19/09). */
  async function perScadenze() {
    const da = new Date(); da.setDate(da.getDate() - 120);
    const [a, r] = await Promise.all([
      aperte(),
      window.sb.from('cantieri_proposte_chiusura')
        .select('id, cantiere_id, proposta_nome, proposta_il, esito_il, esito_note')
        .eq('esito', 'respinta').gte('esito_il', da.toISOString()).order('esito_il', { ascending: false }).limit(1000),
    ]);
    if (r.error) throw r.error;
    const respinte = new Map();
    (r.data || []).forEach((p) => { if (!respinte.has(p.cantiere_id)) respinte.set(p.cantiere_id, p); });
    return { aperte: a, respinte };
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

  /* La finestra della proposta (23/10/2026): uno o più cantieri, il giorno visto, il motivo.
     righe = [{ cantId, label, dataVisita }] — dataVisita = l'ultima visita, se si sa (limite basso della data).
     Risolve true se almeno una proposta è partita. */
  function finestra(righe) {
    righe = (righe || []).filter((r) => r && r.cantId);
    if (!righe.length) return Promise.resolve(false);
    return new Promise((fine) => {
      const vecchia = $('prop-chius-ov'); if (vecchia) vecchia.remove();
      const ov = document.createElement('div');
      ov.id = 'prop-chius-ov'; ov.className = 'modal-overlay'; ov.style.zIndex = '9999';
      const minimo = righe.map((r) => String(r.dataVisita || '').slice(0, 10)).filter(Boolean).sort().pop() || '';
      const elenco = righe.length === 1
        ? `<b>${esc(righe[0].label || righe[0].cantId)}</b>`
        : `<b>${righe.length} cantieri</b><div style="font-size:12px;color:#555;margin-top:3px">${righe.slice(0, 6).map((r) => '· ' + esc(r.label || r.cantId)).join('<br>')}${righe.length > 6 ? '<br>· … e altri ' + (righe.length - 6) : ''}</div>`;
      ov.innerHTML = `<div class="modal-box" style="max-width:520px">
        <h3 style="margin-bottom:8px">🏁 Cantiere finito: proponi la chiusura</h3>
        <div style="font-size:13px;color:#444;margin:0 0 10px;line-height:1.5">${elenco}</div>
        <p style="font-size:12px;color:#666;margin:0 0 12px;line-height:1.5">Il rientro esce dalle tue scadenze e va fra quelli «in attesa di chiusura».
          Decide la segreteria o il Coordinatore: se chiudono, si chiudono anche le visite del cantiere; se respingono, il rientro torna fra le scadenze con il motivo.</p>
        <div style="font-weight:600;margin-bottom:6px">Che cosa hai visto?</div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:5px;cursor:pointer;min-height:32px"><input type="radio" name="prop-chius-tipo" value="finiti" checked> I lavori sono finiti</label>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:5px;cursor:pointer;min-height:32px"><input type="radio" name="prop-chius-tipo" value="sparito"> All'indirizzo non c'è più nessun cantiere</label>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:10px;cursor:pointer;min-height:32px"><input type="radio" name="prop-chius-tipo" value="altro"> Altro (scrivilo sotto)</label>
        <div class="field" style="margin-bottom:10px"><label>Quando l'hai visto</label>
          <input type="date" id="prop-chius-data" value="${oggi()}" max="${oggi()}"${minimo ? ` min="${minimo}"` : ''} style="max-width:180px">
          ${minimo ? `<div style="font-size:11px;color:#888;margin-top:3px">Non prima dell'ultima visita (${dIt(minimo)}).</div>` : ''}</div>
        <div class="field"><label>Nota per la segreteria <span id="prop-chius-obbl" style="font-weight:400;color:#888">(facoltativa)</span></label>
          <textarea id="prop-chius-nota" rows="3" placeholder="Es. ponteggio smontato, area sgomberata, l'impresa è andata via"></textarea></div>
        <div class="modal-actions" style="margin-top:14px">
          <button type="button" class="btn-outline" id="prop-chius-annulla">Annulla</button>
          <button type="button" class="btn-primary" id="prop-chius-ok">Proponi la chiusura</button>
        </div></div>`;
      document.body.appendChild(ov);
      const chiudi = (esito) => { ov.remove(); fine(esito); };
      const tipo = () => (ov.querySelector('input[name="prop-chius-tipo"]:checked') || {}).value || 'finiti';
      ov.querySelectorAll('input[name="prop-chius-tipo"]').forEach((i) => { i.onchange = () => { $('prop-chius-obbl').textContent = tipo() === 'altro' ? '(obbligatoria)' : '(facoltativa)'; }; });
      $('prop-chius-annulla').onclick = () => chiudi(false);
      $('prop-chius-ok').onclick = async () => {
        const data = $('prop-chius-data').value;
        const nota = ($('prop-chius-nota').value || '').trim();
        const t = tipo();
        if (!data) { avviso('Scrivi il giorno in cui hai visto il cantiere finito.', 'warn'); return; }
        if (data > oggi()) { avviso('La data non può essere nel futuro.', 'warn'); return; }
        if (minimo && data < minimo) { avviso('La data non può essere prima dell\'ultima visita (' + dIt(minimo) + ').', 'warn'); return; }
        if (t === 'altro' && nota.length < 5) { avviso('Scrivi che cosa hai visto: è quello che legge la segreteria per decidere.', 'warn'); $('prop-chius-nota').focus(); return; }
        const motivo = MOTIVI[t] + (nota ? ': ' + nota : '');
        const b = $('prop-chius-ok'); b.disabled = true; b.textContent = 'Invio…';
        let fatte = 0; const gia = []; const ko = [];
        for (const r of righe) {
          const { data: ris, error } = await window.sb.rpc('proponi_chiusura_cantiere', { p_cantiere_id: r.cantId, p_motivo: motivo, p_fine_il: data });
          if (error) ko.push((r.label || r.cantId) + ': ' + error.message);
          else if (ris && ris.gia_proposta) gia.push((r.label || r.cantId) + ' (da ' + (ris.proposta_da || 'un collega') + ' il ' + dIt(ris.proposta_il) + ')');
          else fatte++;
        }
        if (ko.length && !fatte && !gia.length) { b.disabled = false; b.textContent = 'Proponi la chiusura'; avviso('Proposta non inviata — ' + ko.join('; '), 'err', 9000); return; }
        const pezzi = [];
        if (fatte) pezzi.push(fatte === 1 ? 'Proposta inviata: decide la segreteria o il Coordinatore.' : fatte + ' proposte inviate: decide la segreteria o il Coordinatore.');
        if (gia.length) pezzi.push('Già proposta: ' + gia.join('; ') + '.');
        if (ko.length) pezzi.push('Non riuscite — ' + ko.join('; '));
        avviso(pezzi.join(' '), ko.length ? 'warn' : (fatte ? 'ok' : 'warn'), 8000);
        chiudi(true);
      };
    });
  }

  /* dall'elenco cantieri e dalla scheda: la stessa finestra, un cantiere */
  async function proponi(cantId, label, dataVisita) {
    return finestra([{ cantId, label, dataVisita }]);
  }

  async function respingi(id, label) {
    const note = prompt(`Respingere la proposta di chiusura\n«${label || ''}»?\n\nPerché il cantiere resta aperto? (lo legge chi l'ha proposta)`);
    if (note === null) return false;
    if (!note.trim()) { avviso('Scrivi il motivo: è la risposta per chi ha proposto.', 'warn'); return false; }
    try {
      const { error } = await window.sb.rpc('respingi_proposta_chiusura', { p_id: id, p_note: note.trim() });
      if (error) throw error;
      avviso('Proposta respinta: il cantiere resta aperto e il rientro torna fra le scadenze.', 'ok');
      return true;
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); return false; }
  }

  function ricarica() {
    if (typeof window.loadCantieri === 'function' && !$('view-cantieri')?.classList.contains('hidden')) window.loadCantieri();
    if (typeof window.ricaricaScadenze === 'function' && !$('view-scadenze')?.classList.contains('hidden')) window.ricaricaScadenze();
    disegna().catch(() => {});
  }

  /* la riga della proposta, come si legge nelle Scadenze e nel riquadro */
  function testoProposta(p) {
    return `${chi(p)} il ${dIt(p.proposta_il)}${p.fine_constatata_il ? ' · finito il ' + dIt(p.fine_constatata_il) : ''}`;
  }

  /* Nella scheda del cantiere: chiamata da showCantiereDetail */
  async function scheda(cantId, label, chiuso) {
    const body = $('qd-body'), acts = $('qd-actions');
    if (!body || !acts || !window.sb) return;
    let p = null;
    try {
      const { data, error } = await window.sb.from('cantieri_proposte_chiusura')
        .select('id, proposta_da, proposta_nome, proposta_il, motivo, fine_constatata_il').eq('cantiere_id', cantId).is('esito', null).maybeSingle();
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
        <b>📨 Chiusura proposta</b> da ${esc(testoProposta(p))}<div style="white-space:pre-wrap;margin-top:3px">${esc(p.motivo)}</div>
        ${ufficio() ? '' : '<div style="font-size:11px;color:#888;margin-top:4px">Decide la segreteria: finché non lo chiude, il cantiere resta attivo.</div>'}</div>`);
      if (ufficio()) {
        const b = document.createElement('button');
        b.className = 'btn-outline btn-sm'; b.style.marginLeft = '8px'; b.textContent = '✖ Respingi la proposta';
        b.onclick = async () => { if (await respingi(p.id, label)) { window.hide && window.hide('modal-qd'); ricarica(); } };
        acts.appendChild(b);
      }
      return;
    }
    if (puoProporre()) {
      const b = document.createElement('button');
      b.className = 'btn-outline btn-sm'; b.style.marginLeft = '8px'; b.textContent = '📨 Proponi chiusura alla segreteria';
      b.onclick = async () => { if (await proponi(cantId, label)) { window.hide && window.hide('modal-qd'); ricarica(); } };
      acts.appendChild(b);
    }
  }

  /* Nel dettaglio del verbale (23/10/2026): «🏁 Cantiere finito» per il tecnico, se il cantiere è aperto
     e non c'è già una proposta; se c'è, lo si dice. Chiamata da showVisitaDetail dopo i pulsanti. */
  async function dettaglioVisita(cantId, dataVisita) {
    const acts = $('qd-actions');
    if (!acts || !cantId || !window.sb || !puoProporre()) return;
    const [c, p] = await Promise.all([
      window.sb.from('cantieri').select('cantiere_chiuso, cantiere_etichetta, cantiere_indirizzo, cantiere_civico').eq('cantiere_id', cantId).maybeSingle(),
      window.sb.from('cantieri_proposte_chiusura').select('id, proposta_nome, proposta_da, proposta_il, fine_constatata_il').eq('cantiere_id', cantId).is('esito', null).maybeSingle(),
    ]);
    if (c.error || p.error) return;   // senza saperlo non si propone: il pulsante resta nella pagina Cantieri
    if (!c.data || c.data.cantiere_chiuso) return;
    if (p.data) {
      const s = document.createElement('span');
      s.style.cssText = 'font-size:12px;color:#b35c00;font-weight:600;margin-left:8px;align-self:center';
      s.textContent = '⏳ Chiusura proposta da ' + testoProposta(p.data);
      acts.appendChild(s);
      return;
    }
    const label = c.data.cantiere_etichetta || ((c.data.cantiere_indirizzo || '') + ' ' + (c.data.cantiere_civico || '')).trim() || cantId;
    const b = document.createElement('button');
    b.className = 'btn-outline btn-sm'; b.textContent = '🏁 Cantiere finito';
    b.setAttribute('data-aiuto', 'Proponi alla segreteria di chiudere il cantiere di questo verbale perché è finito: scrivi quando l\'hai visto. Il rientro esce dalle tue scadenze finché non decidono.');
    b.onclick = async () => { if (await proponi(cantId, label, dataVisita)) { window.hide && window.hide('modal-qd'); ricarica(); } };
    acts.appendChild(b);
  }

  /* Riquadro in Dashboard, solo per la segreteria */
  async function disegna() {
    const box = $('dash-prop-chiusura');
    if (!box || !window.sb || !(window.S && window.S.user)) return;
    if (!ufficio()) { box.style.display = 'none'; box.innerHTML = ''; return; }
    let righe = [];
    try {
      const { data, error } = await window.sb.from('cantieri_proposte_chiusura')
        .select('id, cantiere_id, proposta_da, proposta_nome, proposta_il, motivo, fine_constatata_il, cantieri(cantiere_etichetta, cantiere_indirizzo, cantiere_civico, comune_nome)')
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
          <br><span style="color:#888">${esc(testoProposta(p))} &middot; </span>${esc(p.motivo)}</span>
        <button class="btn-outline btn-sm" data-prop-apri="${esc(p.cantiere_id)}">👁 Apri scheda</button>
        <button class="btn-warn btn-sm" data-prop-chiudi="${esc(p.cantiere_id)}" data-lbl="${esc(lbl)}" data-fine="${esc(p.fine_constatata_il || '')}" data-chi="${esc(chi(p))}">🔒 Chiudi cantiere (fine lavori)</button>
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

  /* chiusura dall'ufficio: la data vista dal tecnico va nella nota della chiusura */
  async function chiudiDaProposta(cantId, label, fineIl, daChi) {
    if (typeof window.chiudiCantiere !== 'function') { avviso('Funzione di chiusura non disponibile: ricarica la pagina.', 'err'); return; }
    await window.chiudiCantiere(cantId, label, fineIl ? 'Finito il ' + dIt(fineIl) + (daChi ? ' (visto da ' + daChi + ')' : '') : '');
  }

  document.addEventListener('click', async (e) => {
    const pr = e.target.closest('[data-prop-chius]');
    if (pr) { e.stopPropagation(); if (await proponi(pr.dataset.propChius, pr.dataset.lbl)) ricarica(); return; }
    const ap = e.target.closest('[data-prop-apri]');
    if (ap) { if (window.showCantiereDetail) window.showCantiereDetail(ap.dataset.propApri); return; }
    const ch = e.target.closest('[data-prop-chiudi]');
    if (ch) {
      e.stopPropagation();
      await chiudiDaProposta(ch.dataset.propChiudi, ch.dataset.lbl, ch.dataset.fine, ch.dataset.chi);
      ricarica();
      return;
    }
    const rs = e.target.closest('[data-prop-resp]');
    if (rs) { e.stopPropagation(); if (await respingi(Number(rs.dataset.propResp), rs.dataset.lbl)) ricarica(); return; }
    const fi = e.target.closest('[data-prop-finito]');
    if (fi) { e.stopPropagation(); if (await proponi(fi.dataset.propFinito, fi.dataset.lbl, fi.dataset.dv)) ricarica(); }
  });

  window.propChius = { aperte, perScadenze, cellaRiga, scheda, box: disegna, finestra, proponi, respingi, chiudiDaProposta, dettaglioVisita, testoProposta, puoProporre, ufficio };
})();
