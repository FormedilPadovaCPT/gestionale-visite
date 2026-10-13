/* ============================================================
   📚 FORMAZIONE — i corsi dell'RPF: progetto formativo dell'edizione e
   verbale di verifica finale (13/10/2026, lotto 3 del fascicolo corso
   digitale)

   Per ogni corso a catalogo (tipologia), il responsabile del progetto
   formativo:
     · dichiara PRONTO il progetto formativo dell'edizione (Allegato 3:
       dichiarazione, programma, analisi aula — generato dal database dalla
       funzione documenti-corso) → la segreteria lo manda in firma;
     · PREPARA il verbale di verifica finale (Allegato 4): lo scrutinio lo
       fotografa il database (presenze, soglia di frequenza, prove del
       test), lui completa data, luogo, esaminatori, esito della verifica
       per ciascun ammesso (positivo / negativo / colloquio), argomenti del
       colloquio, annotazioni; «Pronto» → la segreteria lo manda in firma
       (esaminatori, poi RPF). Il database rifiuta «pronto» se un ammesso è
       senza mansione o senza esito, o se c'è un colloquio senza argomenti.
   Scritture solo via RPC (corso_progetto_stato, corso_verbale_prepara,
   corso_verbale_salva, corso_verbale_stato): si salvano solo i campi
   cambiati.

   Script classico: usa window.sb, window.S, window.toast; espone
   window.formazioneCorsi.box(host, R). Lo chiama formazione.js.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const STATI_P = { da_fare: 'da fare', pronto: 'pronto per la firma', in_firma: 'in firma', firmato: 'firmato' };
  const STATI_V = { bozza: 'bozza', pronto: 'pronto per la firma', in_firma: 'in firma', firmato: 'firmato', superato: 'superato' };
  const VERIFICA = { positivo: 'positivo', negativo: 'negativo', colloquio: 'colloquio', non_sostenuta: 'non sostenuta' };
  const pill = (testo, ok) => `<span style="font-size:11px;padding:1px 7px;border-radius:10px;background:${ok ? '#e8f3d6' : '#fde9dd'};color:#444">${esc(testo)}</span>`;

  let _corsi = [], _verbali = [], _tip = [];
  async function leggi() {
    const sb = window.sb;
    const [{ data: c, error: e1 }, { data: v, error: e2 }, { data: t, error: e3 }] = await Promise.all([
      sb.from('s_corsi').select('id, titolo, stato, data_inizio, data_fine, sede, modalita, tipologia_id, scheda_formativa_id, progetto_stato, progetto_firmato_il, codice_socrate, perc_freq_min')
        .not('tipologia_id', 'is', null).in('stato', ['bozza', 'aperto', 'svolto']).order('data_inizio', { ascending: false }).limit(60),
      sb.from('s_corsi_verbali_verifica').select('*').order('corso_id').order('versione', { ascending: false }),
      sb.from('s_corsi_tipologie').select('id, titolo, accordo_2025'),
    ]);
    if (e1) throw new Error('corsi: ' + e1.message);
    if (e2) throw new Error('verbali: ' + e2.message);
    if (e3) throw new Error('tipologie: ' + e3.message);
    _corsi = c || []; _verbali = v || []; _tip = t || [];
  }
  const verbaleDi = (corsoId) => _verbali.find((v) => v.corso_id === corsoId) || null;   // la versione più recente

  /* ── finestra ── */
  function finestra(titolo, html) {
    chiudi();
    const f = document.createElement('div');
    f.id = 'fc-finestra';
    f.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9500;display:flex;align-items:center;justify-content:center;padding:12px';
    f.innerHTML = `<div style="background:#fff;border-radius:10px;max-width:960px;width:100%;max-height:94vh;overflow:auto;border-top:5px solid #e7500f;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#222">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 6px;gap:10px;position:sticky;top:0;background:#fff;z-index:1">
        <strong style="font-size:16px;color:#565c66">${titolo}</strong>
        <button type="button" data-chiudi style="background:none;border:0;font-size:20px;cursor:pointer;color:#888" data-aiuto="Chiude la finestra senza salvare quello che non hai già salvato.">✕</button></div>
      <div style="padding:6px 18px 16px">${html}</div></div>`;
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-chiudi]')) chiudi(); });
    document.body.appendChild(f);
    return f;
  }
  function chiudi() { const f = $('fc-finestra'); if (f) f.remove(); }

  /* il PDF lo disegna la funzione documenti-corso (la stessa della segreteria) */
  async function pdf(azione, id, btn) {
    const w = window.open('', '_blank');
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await window.sb.functions.invoke('documenti-corso', { body: { azione, id } });
      if (error || data?.error) {
        let msg = data?.error; try { msg = msg || (await error.context.json()).error; } catch (_x) { /* niente */ }
        throw new Error(msg || error?.message || 'PDF non generato');
      }
      const byte = Uint8Array.from(atob(data.pdf_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([byte], { type: 'application/pdf' }));
      if (w) w.location.href = url; else window.open(url, '_blank');
    } catch (e) { if (w) w.close(); avviso('PDF non generato: ' + e.message, 'err'); }
    if (btn) btn.disabled = false;
  }
  async function rpc(nome, args, okMsg) {
    const { data, error } = await window.sb.rpc(nome, args);
    if (error) { avviso('Non riuscito: ' + error.message, 'err'); throw error; }
    if (okMsg) avviso(okMsg, 'ok');
    return data;
  }

  /* ── il riquadro ── */
  async function box(host, R) {
    if (!host || !R || !R.capo) { if (host) host.innerHTML = ''; return; }
    try { await leggi(); } catch (e) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>🎓 Corsi: progetto formativo e verbale</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere i corsi: ${esc(e.message)}</p></div>`;
      return;
    }
    const righe = _corsi.map((c) => {
      const t = _tip.find((x) => x.id === c.tipologia_id) || {};
      const v = verbaleDi(c.id);
      return `<tr>
        <td style="padding:6px;font-size:13px"><strong>n. ${c.id}</strong> ${esc(c.titolo)}<br><span style="font-size:11px;color:#888">${esc(t.titolo || '')} · ${dIt(c.data_inizio)}${c.data_fine && c.data_fine !== c.data_inizio ? ' → ' + dIt(c.data_fine) : ''} · ${esc(c.stato)}${c.scheda_formativa_id ? '' : ' · <span style=\"color:#b35c00\">senza scheda congelata</span>'}</span></td>
        <td style="padding:6px;white-space:nowrap">${pill(STATI_P[c.progetto_stato] || c.progetto_stato, c.progetto_stato === 'firmato')}<br>
          <button class="btn-secondary btn-sm" type="button" data-p-pdf="${c.id}" data-aiuto="Apre il PDF del progetto formativo dell'edizione: dichiarazione, programma e analisi aula, letti dal corso com'è adesso.">📄</button>
          ${c.progetto_stato === 'da_fare' ? `<button class="btn-primary btn-sm" type="button" data-p-pronto="${c.id}" data-aiuto="Dichiari pronto il progetto formativo: la segreteria lo manda in firma a te. Serve la tipologia e almeno un iscritto (analisi aula).">✅ Pronto</button>` : ''}
          ${c.progetto_stato === 'pronto' ? `<button class="btn-secondary btn-sm" type="button" data-p-riapri="${c.id}" data-aiuto="Riporta il progetto a «da fare» (per esempio se cambiano gli iscritti).">↩</button>` : ''}</td>
        <td style="padding:6px;white-space:nowrap">${v ? pill(`v${v.versione} ${STATI_V[v.stato] || v.stato}`, v.stato === 'firmato') : '<span style="font-size:11px;color:#888">non preparato</span>'}<br>
          ${!v || ['bozza', 'pronto', 'firmato', 'superato'].includes(v.stato) ? `<button class="btn-primary btn-sm" type="button" data-v-prepara="${c.id}" data-aiuto="Prepara (o aggiorna) la bozza del verbale: lo scrutinio lo fotografa il database da presenze, soglia di frequenza e prove del test. Se l'ultimo verbale è firmato ne apre una versione nuova.">${v && ['bozza', 'pronto'].includes(v.stato) ? '🔄 Aggiorna' : '📋 Prepara'}</button>` : ''}
          ${v && ['bozza', 'pronto'].includes(v.stato) ? `<button class="btn-secondary btn-sm" type="button" data-v-apri="${v.id}" data-aiuto="Apre il verbale da completare: data, luogo, esaminatori, esito della verifica per ciascun ammesso, argomenti del colloquio, annotazioni.">✏️</button>` : ''}
          ${v ? `<button class="btn-secondary btn-sm" type="button" data-v-pdf="${v.id}" data-aiuto="Apre il PDF del verbale com'è salvato adesso.">📄</button>` : ''}</td>
      </tr>`;
    }).join('');
    host.innerHTML = `<div class="card" style="border-left:4px solid var(--orange,#e7500f)">
      <h3>🎓 Corsi: progetto formativo e verbale di verifica</h3>
      <p style="font-size:12.5px;color:#555;margin:0 0 6px">I corsi a catalogo aperti o svolti. Il <strong>progetto formativo</strong> dell'edizione (Allegato 3) lo genera il database: tu lo dichiari pronto e la segreteria lo manda in firma. Il <strong>verbale di verifica finale</strong> (Allegato 4) lo prepari da presenze e prove, lo completi e lo dichiari pronto; firmano gli esaminatori e poi tu. Per i corsi dell'Accordo gli attestati escono solo col verbale firmato.</p>
      <div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:#888;text-align:left"><th style="padding:4px 6px">Corso</th><th style="padding:4px 6px">Progetto formativo</th><th style="padding:4px 6px">Verbale di verifica</th></tr></thead>
      <tbody>${righe || '<tr><td colspan="3" style="padding:8px 6px;color:#777;font-size:13px">Nessun corso a catalogo aperto o svolto.</td></tr>'}</tbody></table></div>
    </div>`;
    host.querySelectorAll('[data-p-pdf]').forEach((b) => b.addEventListener('click', () => pdf('progetto_formativo', Number(b.dataset.pPdf), b)));
    host.querySelectorAll('[data-v-pdf]').forEach((b) => b.addEventListener('click', () => pdf('verbale_verifica', Number(b.dataset.vPdf), b)));
    host.querySelectorAll('[data-p-pronto]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Dichiaro pronto il progetto formativo di questo corso? La segreteria lo manderà in firma a te.')) return;
      try { await rpc('corso_progetto_stato', { p_corso: Number(b.dataset.pPronto), p_stato: 'pronto' }, 'Progetto pronto: la segreteria lo manda in firma.'); box(host, R); } catch (_e) { /* detto */ }
    }));
    host.querySelectorAll('[data-p-riapri]').forEach((b) => b.addEventListener('click', async () => {
      try { await rpc('corso_progetto_stato', { p_corso: Number(b.dataset.pRiapri), p_stato: 'da_fare' }, 'Progetto riaperto.'); box(host, R); } catch (_e) { /* detto */ }
    }));
    host.querySelectorAll('[data-v-prepara]').forEach((b) => b.addEventListener('click', async () => {
      const id = Number(b.dataset.vPrepara);
      const v = verbaleDi(id);
      if (v && ['bozza', 'pronto'].includes(v.stato) && !confirm('Aggiorno la bozza del verbale dalle presenze e dalle prove di adesso? Gli esiti della verifica che hai scritto a mano restano solo se li riscrivi: la fotografia si rifà.')) return;
      try { const nuovo = await rpc('corso_verbale_prepara', { p_corso: id }, 'Verbale preparato dalle presenze e dalle prove.'); await leggi(); apriVerbale(nuovo.id, host, R); } catch (_e) { /* detto */ }
    }));
    host.querySelectorAll('[data-v-apri]').forEach((b) => b.addEventListener('click', () => apriVerbale(Number(b.dataset.vApri), host, R)));
  }

  /* ── il verbale da completare ── */
  function apriVerbale(id, host, R) {
    const v = _verbali.find((x) => x.id === id);
    if (!v) { avviso('Verbale non trovato: ricarica.', 'err'); return; }
    const c = _corsi.find((x) => x.id === v.corso_id) || {};
    const modificabile = ['bozza', 'pronto'].includes(v.stato);
    const dis = modificabile ? '' : 'disabled';
    const scr = Array.isArray(v.scrutinio) ? v.scrutinio : [];
    const esam = Array.isArray(v.esaminatori) ? v.esaminatori : [];
    const rigaScr = (r, i) => `<tr data-r="${i}" style="${r.ammesso ? '' : 'opacity:.6'}">
      <td style="padding:3px;font-size:12.5px">${esc(r.nominativo)}<br><span style="font-size:11px;color:#888">${esc(r.cf || '')} · ${esc(r.impresa || '')} · ${r.mansione ? esc(r.mansione) : '<span style=\"color:#b35c00\">mansione mancante</span>'}</span></td>
      <td style="padding:3px;font-size:12.5px;white-space:nowrap">${r.ore ?? '—'}/${r.ore_totali ?? '—'} h · ${r.perc_frequenza != null ? r.perc_frequenza + '%' : '—'}</td>
      <td style="padding:3px"><label style="font-size:12.5px;text-transform:none;letter-spacing:0;font-weight:500"><input type="checkbox" data-r-amm ${r.ammesso ? 'checked' : ''} ${dis}> ammesso</label>${r.motivo ? `<br><span style="font-size:11px;color:#888">${esc(r.motivo)}</span>` : ''}</td>
      <td style="padding:3px"><select data-r-ver ${dis} style="font-size:12.5px">${Object.entries(VERIFICA).map(([k, l]) => `<option value="${k}" ${r.verifica === k ? 'selected' : ''}>${l}</option>`).join('')}${VERIFICA[r.verifica] || !r.verifica ? '' : `<option value="${esc(r.verifica)}" selected>${esc(r.verifica)} (com'è scritto)</option>`}</select>${r.verifica_percentuale != null ? `<br><span style="font-size:11px;color:#888">test ${r.verifica_percentuale}%</span>` : ''}</td>
    </tr>`;
    finestra(`📋 Verbale di verifica finale — corso n. ${c.id} «${esc(c.titolo || '')}» — versione ${v.versione} (${esc(STATI_V[v.stato] || v.stato)})`, `
      <div style="display:grid;grid-template-columns:1fr 2fr 1fr 1fr;gap:10px">
        <div class="field"><label style="font-size:11.5px;color:#666">Data della verifica *</label><input type="date" id="vb-data" value="${esc(v.data_verifica || '')}" ${dis} style="width:100%"></div>
        <div class="field"><label style="font-size:11.5px;color:#666">Luogo</label><input type="text" id="vb-luogo" value="${esc(v.luogo || '')}" ${dis} style="width:100%"></div>
        <div class="field"><label style="font-size:11.5px;color:#666">Modalità</label><input type="text" id="vb-mod" value="${esc(v.modalita_erogazione || '')}" ${dis} style="width:100%"></div>
        <div class="field"><label style="font-size:11.5px;color:#666">Lingua</label><input type="text" id="vb-lingua" value="${esc(v.lingua || 'italiano')}" ${dis} style="width:100%"></div>
      </div>
      <h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">Scrutinio di ammissione ed esito della verifica (soglia ${c.perc_freq_min || 90}%)</h4>
      <table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:#888;text-align:left"><th>Iscritto</th><th>Frequenza</th><th>Ammissione</th><th>Verifica</th></tr></thead><tbody id="vb-scr">${scr.map(rigaScr).join('') || '<tr><td colspan="4" style="padding:6px;color:#777">Nessun iscritto: prepara il verbale dopo le presenze.</td></tr>'}</tbody></table>
      <p style="font-size:11.5px;color:#777;margin:4px 0 0">La fotografia viene dalle presenze e dalle prove del test. Correggi qui l'ammissione e l'esito dove serve (per esempio un colloquio di recupero); «Aggiorna» la rifà dai dati.</p>
      <h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">Docenti esaminatori (firmano il verbale)</h4>
      <div id="vb-esam">${esam.map((e, i) => `<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500"><input type="checkbox" data-e="${i}" checked ${dis}> ${esc(e.nominativo)}${e.persona_id ? '' : ' <span style="font-size:11px;color:#b35c00">(senza persona in anagrafica: la firma nell\'app richiede l\'accesso)</span>'}</label>`).join('') || '<p style="font-size:12.5px;color:#777;margin:0">Nessun docente nel programma del corso: aggiungili nel corso, poi «Aggiorna».</p>'}</div>
      <div class="field" style="margin-top:8px"><label style="font-size:11.5px;color:#666">Argomenti trattati nel colloquio (obbligatori se la verifica è stata un colloquio)</label><textarea id="vb-arg" rows="2" ${dis} style="width:100%;font-size:13px">${esc(v.argomenti_colloquio || '')}</textarea></div>
      <div class="field"><label style="font-size:11.5px;color:#666">Annotazioni</label><textarea id="vb-note" rows="2" ${dis} style="width:100%;font-size:13px">${esc(v.annotazioni || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
        <button type="button" class="btn-outline btn-sm" data-chiudi>Chiudi</button>
        <button type="button" class="btn-secondary btn-sm" id="vb-pdf" data-aiuto="Apre il PDF del verbale com'è salvato adesso.">📄 Anteprima PDF</button>
        ${modificabile ? '<button type="button" class="btn-primary btn-sm" id="vb-salva" data-aiuto="Salva il verbale. Si scrivono solo i campi che hai cambiato.">💾 Salva</button>' : ''}
        ${modificabile && v.stato === 'bozza' ? '<button type="button" class="btn-primary btn-sm" id="vb-pronto" data-aiuto="Salva e dichiari pronto il verbale: la segreteria lo manda in firma agli esaminatori e a te. Serve data, almeno un esaminatore, mansione ed esito per ogni ammesso.">✅ Salva e dichiara pronto</button>' : ''}
        ${v.stato === 'pronto' ? '<button type="button" class="btn-secondary btn-sm" id="vb-riapri" data-aiuto="Riporta il verbale in bozza per correggerlo.">↩ Riapri in bozza</button>' : ''}
      </div>`);
    const raccogli = () => ({
      data_verifica: $('vb-data').value || '', luogo: $('vb-luogo').value.trim(), modalita_erogazione: $('vb-mod').value.trim(), lingua: $('vb-lingua').value.trim(),
      scrutinio: scr.map((r, i) => { const tr = document.querySelector(`#vb-scr tr[data-r="${i}"]`); return tr ? { ...r, ammesso: tr.querySelector('[data-r-amm]').checked, verifica: tr.querySelector('[data-r-ver]').value } : r; }),
      esaminatori: esam.filter((e, i) => { const cb = document.querySelector(`#vb-esam [data-e="${i}"]`); return cb ? cb.checked : true; }),
      argomenti_colloquio: $('vb-arg').value.trim(), annotazioni: $('vb-note').value.trim(),
    });
    const letto = JSON.parse(JSON.stringify(raccogli()));
    const salva = async () => {
      const ora = raccogli();
      const p = { id: v.id };
      for (const k of Object.keys(ora)) if (JSON.stringify(ora[k]) !== JSON.stringify(letto[k])) p[k] = ora[k];
      if (Object.keys(p).length === 1) return false;
      await rpc('corso_verbale_salva', { p });
      Object.assign(letto, JSON.parse(JSON.stringify(ora)));
      return true;
    };
    const bs = $('vb-salva');
    if (bs) bs.addEventListener('click', async () => { bs.disabled = true; try { avviso((await salva()) ? 'Verbale salvato.' : 'Niente da salvare: non hai cambiato nulla.', 'ok'); await leggi(); } catch (_e) { /* detto */ } bs.disabled = false; });
    const bp = $('vb-pronto');
    if (bp) bp.addEventListener('click', async () => {
      if (!confirm('Dichiaro pronto il verbale? La segreteria lo manderà in firma agli esaminatori e a te; dopo non si modifica più, se non riaprendolo.')) return;
      bp.disabled = true;
      try { await salva(); await rpc('corso_verbale_stato', { p_id: v.id, p_stato: 'pronto' }, 'Verbale pronto: la segreteria lo manda in firma.'); chiudi(); box(host, R); }
      catch (_e) { bp.disabled = false; }
    });
    const br = $('vb-riapri');
    if (br) br.addEventListener('click', async () => { try { await rpc('corso_verbale_stato', { p_id: v.id, p_stato: 'bozza' }, 'Verbale riaperto in bozza.'); chiudi(); box(host, R); } catch (_e) { /* detto */ } });
    $('vb-pdf').addEventListener('click', (ev) => pdf('verbale_verifica', v.id, ev.currentTarget));
  }

  window.formazioneCorsi = { box };
})();
