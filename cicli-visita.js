/* ============================================================
   CICLI DI VISITA AL CANTIERE — Gestionale Visite
   (20/10/2026, proposta della Segreteria d'Area del 16/10/2026,
   Prot_26-27_0033, rivista il 17/10; pagina «Cicli di visita al cantiere»)

   Il numero di ACCESSO al cantiere non cambia: continua sempre, va sul
   PDF e all'Osservatorio. Accanto c'è il CICLO, il «processo di
   consulenza» della procedura CNCPT: da una a tre visite su una fase del
   lotto. La regola Formedil dei ritorni si legge sulla VISITA DEL CICLO.

   Che cosa fa questo modulo:
   1. nel verbale (scheda Note e Riepilogo) chiede al database la
      PROPOSTA (ciclo_proposta) confrontando le imprese che eseguono e
      le fasi delle lavorazioni della maschera con il ciclo aperto del
      lotto. Dopo un ciclo chiuso il ciclo nuovo è automatico; con le
      stesse imprese e fasi il ciclo continua. La DOMANDA compare solo
      quando il programma vede un cambio o non ha i dati: confermare
      costa un tocco, andare contro la proposta chiede il motivo.
      Senza risposta il verbale non si chiude (pronto()).
   2. la data di ritorno proposta segue la regola sulla visita del ciclo
      (regola(), copia di ciclo_regola in SQL): alla 3ª visita con IPC
      medio il ciclo si ferma e il caso va al Coordinatore.
   3. nel verbale vanno solo ciclo_scelta, ciclo_motivo_tipo e
      ciclo_motivo (campi()); il numero del ciclo, la visita del ciclo
      e i giorni di rientro li scrive il database alla chiusura
      (trigger → ciclo_ricalcola_lotto).
   4. elenco e dettaglio del verbale: badge e sezione «Ciclo di visita».
   5. Zona Coordinatore (boxCoord): i cicli FERMI alla 3ª visita con la
      scelta del seguito (visite 4ª-5ª, serie, conferenza, Commissione,
      nessun seguito) e il residuo del budget annuale delle visite; i
      cicli in percorso con l'esito; i cantieri critici proposti; le
      DIVERGENZE fra tecnico e programma del mese, da correggere.
      Materiale riservato al Coordinatore (la segreteria vede).

   I compensi dei tecnici NON dipendono dal ciclo (decisione rimandata
   al Direttore): qui non c'è niente sulle fatture.
   Script classico: usa window.sb, window.S, window.toast, vGet/vSet.
   ============================================================ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const avviso = (m, t, ms) => (window.toast ? window.toast(m, t, ms) : alert(m));
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const S = () => window.S || {};
  const vg = (id) => (typeof window.vGet === 'function' ? window.vGet(id) : ($(id) ? $(id).value : '')) || '';
  const ord = (n) => n + 'ª';

  /* i motivi per andare contro la proposta del programma */
  const MOTIVI = [
    ['fase_nuova', 'È iniziata una fase di lavoro nuova'],
    ['imprese_nuove', 'Le imprese che eseguono sono cambiate'],
    ['cantiere_cambiato', 'Il cantiere è cambiato radicalmente (altre imprese e altre lavorazioni)'],
    ['stessa_fase', 'È la stessa fase di lavoro, con lavorazioni diverse'],
    ['stesse_imprese', 'Sono le stesse imprese: sono cambiate solo le squadre'],
    ['altro', 'Altro'],
  ];
  const MOTIVI_NUOVO = ['fase_nuova', 'imprese_nuove', 'cantiere_cambiato', 'altro'];
  const MOTIVI_CONTINUA = ['stessa_fase', 'stesse_imprese', 'altro'];
  const etichettaMotivo = (c) => { const m = MOTIVI.find((x) => x[0] === c); return m ? m[1] : (c || ''); };
  const PERCORSI = { visite_4_5: 'visite 4ª e 5ª', serie: 'serie di visite', conferenza: 'conferenza di cantiere', commissione: 'caso alla Commissione', nessuno: 'nessun seguito' };
  const ESITI = { risolto: 'risolto', superato: 'superato (cantiere cambiato)', in_percorso: 'in percorso', critico: 'critico', non_risolto: 'non risolto' };

  /* ── la regola sulla visita del ciclo: stessa tabella di ciclo_regola (SQL) ──
     n = visita del ciclo; ipc = ALTO | MEDIO | BASSO | NR; autorizzata = 4ª-5ª coperte da un
     percorso del Coordinatore o da una serie. Chi la cambia lì la cambia qui (e il test lo pretende). */
  function regola(n, ipc, autorizzata) {
    n = Math.max(+n || 1, 1);
    const i = String(ipc || 'NR').toUpperCase().trim() || 'NR';
    const r = (giorni, esito, tipo, nota) => ({ giorni, esito, tipo, nota });
    if (i === 'ALTO') return r(3, n >= 3 ? 'critico' : 'ritorno', n === 1 ? 'urgente' : 'immediata',
      n === 1 ? 'IPC alto: ritorno urgente entro 3 giorni'
        : n === 2 ? 'IPC alto alla 2ª visita: ritorno entro 3 giorni e segnalazione immediata alla Segreteria'
          : 'IPC alto alla ' + ord(n) + ' visita: ritorno entro 3 giorni, si propone il cantiere critico');
    if (i === 'MEDIO') {
      if (n <= 2) return r(22, 'ritorno', 'ordinaria', 'IPC medio: ritorno a 22 giorni');
      if (n >= 5) return r(null, 'critico', null, 'IPC medio dopo la 5ª visita: si propone il cantiere critico');
      if (autorizzata) return r(22, 'ritorno', 'ordinaria', 'IPC medio alla ' + ord(n) + ' visita, autorizzata: ritorno a 22 giorni');
      return r(null, 'fermo', null, 'IPC medio alla ' + ord(n) + ' visita: il ciclo si ferma, il caso va al Coordinatore');
    }
    if (i === 'BASSO') return n === 1 ? r(22, 'ritorno', 'ordinaria', 'IPC basso alla 1ª visita: ritorno a 22 giorni') : r(null, 'archivia', null, 'IPC basso: archiviazione, ciclo risolto');
    return r(null, 'archivia', null, 'Nessun rilievo: archiviazione, ciclo risolto');
  }

  /* ── il rientro di UNA visita, per scadenze e liste: col ciclo valgono i giorni scritti dal database,
     senza (storico) la regola per accesso di calcRientroFormedil ── */
  function rientro(v) {
    if (!v) return { date: null, tipo: null, esito: null, ciclo: false };
    if (v.ciclo_visita != null) {
      const g = +v.ciclo_rientro_giorni || 0;
      if (!g || !v.data_visita) return { date: null, tipo: null, esito: v.ciclo_esito || 'archivia', ciclo: true };
      const d = new Date(v.data_visita); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + g);
      return { date: d, tipo: g === 3 ? (+v.ciclo_visita === 1 ? 'urgente' : 'immediata') : 'ordinaria', esito: v.ciclo_esito || 'ritorno', ciclo: true };
    }
    if (typeof window.calcRientroFormedil === 'function') { const c = window.calcRientroFormedil(v.data_visita, v.acc_cant, v.ipc); return { date: c.date, tipo: c.tipo, esito: c.date ? 'ritorno' : 'archivia', ciclo: false }; }
    return { date: null, tipo: null, esito: null, ciclo: false };
  }

  /* ── lo stato della maschera: la risposta del tecnico vive in S.fd.ciclo ── */
  function stato() { const fd = S().fd || (S().fd = {}); if (!fd.ciclo) fd.ciclo = {}; return fd.ciclo; }
  let _prop = null;      // l'ultima proposta del database
  let _chiave = '';      // di che cosa è la proposta (cantiere, data, imprese, fasi, motivo, tipo)
  let _inCorso = null;

  function impreseEsecutrici() {
    const map = (typeof window.TIPO_IMP_RUOLO !== 'undefined' && window.TIPO_IMP_RUOLO) || (typeof TIPO_IMP_RUOLO !== 'undefined' ? TIPO_IMP_RUOLO : {});
    return (S().imprese || []).filter((im) => im && im.impresa_id).map((im) => ({ id: String(im.impresa_id), ruolo: String((map[+im.tipo_imp] || im.ruolo || '')).toLowerCase().trim() }))
      .filter((x) => x.ruolo !== 'affidataria' && x.ruolo !== 'fornitrice').map((x) => x.id);
  }
  const fasi = () => [...new Set((S().lavorazioni || []).map((l) => String(l.fase || '').trim().toLowerCase()).filter(Boolean))];
  function ipcCorrente() { try { return (window.calcIPC ? window.calcIPC(S().checklist) : {}).ipc || 'NR'; } catch (e) { return 'NR'; } }
  function fpMotivo() { const fp = S().fd && S().fd.fp; return fp && fp.tipo ? (fp.motivo_tipo || null) : null; }
  function chiave() {
    return [vg('f-cant-id'), vg('f-data'), impreseEsecutrici().sort().join(','), fasi().sort().join('|'), fpMotivo() || '', vg('f-tipo') || '', ipcCorrente()].join('§');
  }

  /* chiede la proposta al database; torna true se è cambiata rispetto a prima */
  async function proponi() {
    const cant = vg('f-cant-id'), data = vg('f-data');
    if (!cant || !data || !window.sb) { _prop = null; _chiave = ''; render(); return false; }
    const k = chiave();
    if (k === _chiave && _prop) { render(); return false; }
    if (_inCorso && _inCorso.k === k) return _inCorso.p;
    const p = (async () => {
      const { data: d, error } = await window.sb.rpc('ciclo_proposta', {
        p_cantiere_id: cant, p_data: data, p_visita_id: (S().fd && S().fd.visita_id) || S().savedId || null,
        p_imprese: impreseEsecutrici(), p_fasi: fasi(), p_fp_motivo: fpMotivo(), p_tipo_accesso: +vg('f-tipo') || null, p_ipc: ipcCorrente(),
      });
      if (error) { console.warn('ciclo_proposta:', error.message); _prop = { errore: error.message }; _chiave = k; render(); return true; }
      _prop = d || null; _chiave = k;
      // una risposta data a una proposta diversa non vale più (per esempio cambiate le imprese dopo)
      const st = stato();
      if (st.scelta && st.per !== propostaFirma()) { st.scelta = null; st.motivo_tipo = null; st.motivo = null; st.per = null; }
      render();
      return true;
    })();
    _inCorso = { k, p };
    try { return await p; } finally { if (_inCorso && _inCorso.p === p) _inCorso = null; }
  }
  const propostaFirma = () => _prop && !_prop.escluso ? (_prop.proposta || '') + '@' + ((_prop.ciclo && _prop.ciclo.ciclo_id) || 0) : '';

  /* la scelta che vale: quella del tecnico, altrimenti la proposta */
  function sceltaEffettiva() { const st = stato(); if (st.scelta) return st.scelta; return _prop && !_prop.escluso ? _prop.proposta : null; }
  function numeroVisita() {
    if (!_prop || _prop.escluso || _prop.errore) return null;
    return sceltaEffettiva() === 'nuovo' ? 1 : (+_prop.visita_se_continua || 1);
  }
  function numeroCiclo() {
    if (!_prop || _prop.escluso || _prop.errore) return null;
    const c = _prop.ciclo;
    if (sceltaEffettiva() === 'nuovo') return c ? +c.numero + 1 : 1;
    return c ? +c.numero : 1;
  }
  /* visite 4ª-5ª coperte da un percorso del Coordinatore o da una serie (un ciclo nuovo non lo è mai) */
  function autorizzata() { return attivo() && sceltaEffettiva() !== 'nuovo' && !!_prop.autorizzata; }
  /* la regola per la visita che si sta chiudendo, con l'IPC della maschera */
  function regolaAttuale(ipc) {
    const n = numeroVisita();
    if (n == null) return null;
    return regola(n, ipc || ipcCorrente(), autorizzata());
  }
  /* la data di ritorno per il riepilogo: {date, tipo, nota, esito} oppure null se il ciclo non vale (storico, asseverazione) */
  function calcRitorno(dataVisita, ipc) {
    const r = regolaAttuale(ipc);
    if (!r) return null;
    if (!r.giorni || !dataVisita) return { date: null, tipo: null, esito: r.esito, nota: r.nota };
    const d = new Date(dataVisita); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + r.giorni);
    return { date: d, tipo: r.tipo, esito: r.esito, nota: r.nota };
  }
  const attivo = () => !!(_prop && !_prop.escluso && !_prop.errore);

  /* ── il riquadro nel Riepilogo ── */
  function render() {
    const box = $('ciclo-box'); if (!box) return;
    if (!_prop) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = '';
    if (_prop.errore) { box.innerHTML = `<b>Ciclo di visita</b>: non sono riuscito a leggere la proposta (${esc(_prop.errore)}). Il verbale si chiude lo stesso: il ciclo lo assegna il database.`; return; }
    if (_prop.escluso) { box.innerHTML = `<b>Ciclo di visita</b>: ${esc(_prop.motivo)}.`; return; }
    const st = stato();
    const c = _prop.ciclo;
    const sc = sceltaEffettiva();
    const n = numeroVisita();
    const testoScelta = (s) => s === 'nuovo' ? 'si apre un ciclo nuovo' : 'il ciclo continua';
    const riga = (sc === 'nuovo')
      ? `<b>ciclo ${numeroCiclo()} · visita 1</b>` + (c ? ` <span style="color:#666">(il ciclo ${c.numero} ${c.stato === 'chiuso' ? 'è chiuso: ' + esc(ESITI[c.esito] || c.esito || '') : 'si chiude come superato'})</span>` : '')
      : `<b>ciclo ${c ? c.numero : 1} · visita ${n}</b>` + (_prop.stessa_visita ? ' <span style="color:#666">(stesso giorno: stessa visita del ciclo)</span>' : '');
    const r = regolaAttuale();
    let h = `<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap"><span style="font-weight:700;color:#565c66">🔁 Ciclo di visita:</span> ${riga}</div>`;
    if (r) h += `<div style="margin-top:3px;color:${r.esito === 'fermo' ? '#b35c00' : r.esito === 'critico' ? '#c0392b' : '#444'}">${esc(r.nota)}.</div>`;
    if (_prop.chiede && !st.scelta) {
      h += `<div style="margin-top:8px;padding:8px 10px;background:#fff;border:1px solid #f39c12;border-radius:8px">
        <div><b>Il programma propone: ${testoScelta(_prop.proposta)}</b> — ${esc(_prop.motivo)}.</div>
        <div style="font-size:11.5px;color:#666;margin-top:2px">Eri tu in cantiere: conferma o correggi. Senza una risposta il verbale resta bozza.</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="btn-primary btn-sm" id="ciclo-ok" data-aiuto="Confermi la proposta del programma: ${esc(testoScelta(_prop.proposta))}. Non serve altro.">✅ Confermo: ${esc(testoScelta(_prop.proposta))}</button>
          <button type="button" class="btn-outline btn-sm" id="ciclo-no" data-aiuto="Vai contro la proposta: ${esc(testoScelta(_prop.proposta === 'nuovo' ? 'continua' : 'nuovo'))}. Ti chiedo il motivo, che resta scritto e lo vede il Coordinatore.">✋ No: ${esc(testoScelta(_prop.proposta === 'nuovo' ? 'continua' : 'nuovo'))}</button>
        </div>
        <div id="ciclo-motivo" style="display:none;margin-top:8px"></div>
      </div>`;
    } else if (st.scelta) {
      const div = _prop.chiede ? st.scelta !== _prop.proposta : st.scelta !== _prop.proposta;
      h += `<div style="margin-top:4px;font-size:12px;color:#444">Hai scelto: <b>${esc(testoScelta(st.scelta))}</b>${div ? ' (contro la proposta del programma: ' + esc(testoScelta(_prop.proposta)) + ')' : ''}${st.motivo_tipo ? ' — ' + esc(etichettaMotivo(st.motivo_tipo)) + (st.motivo ? ': ' + esc(st.motivo) : '') : ''}
        <button type="button" class="btn-outline btn-sm" id="ciclo-cambia" style="margin-left:6px" data-aiuto="Torna alla domanda per cambiare la risposta.">✏️ Cambia</button></div>`;
    } else {
      h += `<div style="margin-top:2px;font-size:11.5px;color:#777">${esc(_prop.motivo)}: nessuna domanda.</div>`;
    }
    box.innerHTML = h;
    const ok = $('ciclo-ok'), no = $('ciclo-no'), cambia = $('ciclo-cambia');
    if (ok) ok.onclick = () => { const s = stato(); s.scelta = _prop.proposta; s.motivo_tipo = null; s.motivo = null; s.per = propostaFirma(); render(); dopoScelta(); };
    if (no) no.onclick = () => chiediMotivo(_prop.proposta === 'nuovo' ? 'continua' : 'nuovo');
    if (cambia) cambia.onclick = () => { const s = stato(); s.scelta = null; s.motivo_tipo = null; s.motivo = null; s.per = null; render(); dopoScelta(); };
  }
  function chiediMotivo(scelta) {
    const slot = $('ciclo-motivo'); if (!slot) return;
    const lista = (scelta === 'nuovo' ? MOTIVI_NUOVO : MOTIVI_CONTINUA).map((k) => MOTIVI.find((m) => m[0] === k));
    slot.style.display = '';
    slot.innerHTML = `<div style="font-size:12px;margin-bottom:4px">Perché <b>${esc(scelta === 'nuovo' ? 'si apre un ciclo nuovo' : 'il ciclo continua')}</b>?</div>
      ${lista.map((m) => `<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;text-transform:none;font-weight:400;margin:3px 0"><input type="radio" name="ciclo-mt" value="${esc(m[0])}" style="width:auto;margin:0"> ${esc(m[1])}</label>`).join('')}
      <input id="ciclo-mtesto" placeholder="una riga, se serve (obbligatoria con «Altro»)" style="margin-top:4px;font-size:12.5px">
      <div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn-primary btn-sm" id="ciclo-salva-motivo">Salva</button><button type="button" class="btn-outline btn-sm" id="ciclo-annulla-motivo">Annulla</button></div>`;
    $('ciclo-salva-motivo').onclick = () => {
      const mt = (slot.querySelector('input[name=ciclo-mt]:checked') || {}).value;
      const testo = ($('ciclo-mtesto').value || '').trim();
      if (!mt) { avviso('Scegli il motivo.', 'warn'); return; }
      if (mt === 'altro' && testo.length < 5) { avviso('Con «Altro» scrivi il motivo: è la riga che rilegge il Coordinatore.', 'warn'); return; }
      const s = stato(); s.scelta = scelta; s.motivo_tipo = mt; s.motivo = testo || null; s.per = propostaFirma();
      render(); dopoScelta();
    };
    $('ciclo-annulla-motivo').onclick = () => { slot.style.display = 'none'; slot.innerHTML = ''; };
  }
  /* dopo una scelta cambia la visita del ciclo, quindi la data di ritorno proposta */
  function dopoScelta() {
    try { if (typeof window.buildRiepilogo === 'function' && $('rp-dati')) window.buildRiepilogo(); } catch (e) { console.warn('ciclo/riepilogo:', e); }
  }

  /* ── prima di salvare: con «Definitivo» serve la risposta, se il programma l'ha chiesta ── */
  function pronto(statoSalvataggio) {
    if (statoSalvataggio !== 'definitivo') return true;
    if (!_prop || _prop.escluso || _prop.errore) return true;
    const st = stato();
    if (_prop.chiede && !st.scelta) {
      avviso('Ciclo di visita: il programma ti chiede se il ciclo continua o se ne apre uno nuovo. Rispondi nel Riepilogo.', 'warn', 7000);
      if (typeof window.activateTab === 'function') window.activateTab(15);
      const b = $('ciclo-box'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (st.scelta && st.scelta !== _prop.proposta && !st.motivo_tipo) {
      avviso('Ciclo di visita: hai scelto contro la proposta del programma, scrivi il motivo.', 'warn', 7000);
      if (typeof window.activateTab === 'function') window.activateTab(15);
      return false;
    }
    return true;
  }
  /* i campi che vanno nel verbale (il resto lo scrive il database) */
  function campi() {
    const st = stato();
    return { ciclo_scelta: st.scelta || null, ciclo_motivo_tipo: st.scelta ? (st.motivo_tipo || null) : null, ciclo_motivo: st.scelta ? (st.motivo || null) : null };
  }
  /* dalla copia della maschera o dal database, alla riapertura */
  function daSnap(snap) {
    const st = stato();
    if (snap && snap.ciclo_scelta) { st.scelta = snap.ciclo_scelta; st.motivo_tipo = snap.ciclo_motivo_tipo || null; st.motivo = snap.ciclo_motivo || null; st.per = null; st.daDb = true; }
    else { st.scelta = null; st.motivo_tipo = null; st.motivo = null; st.per = null; }
    _prop = null; _chiave = '';
  }
  function azzera() { daSnap(null); render(); }

  /* ── elenco e dettaglio ── */
  function badge(v) {
    if (!v || v.ciclo_visita == null) return '';
    const c = v.visite_cicli || {};
    const col = v.ciclo_esito === 'fermo' ? '#b35c00' : v.ciclo_esito === 'critico' ? '#c0392b' : (c.stato === 'chiuso' ? '#565c66' : '#2d7a06');
    const tit = 'Ciclo ' + (c.numero || '?') + ', visita ' + v.ciclo_visita + (c.stato ? ' — ciclo ' + (c.stato === 'chiuso' ? 'chiuso: ' + (ESITI[c.esito] || c.esito || '') : c.stato) : '') + (v.ciclo_divergente ? ' — scelta del tecnico diversa dalla proposta' : '');
    return ` <span class="badge" title="${esc(tit)}" style="background:${col};color:#fff;font-size:10px">🔁 ${esc(c.numero || '?')}·v${esc(v.ciclo_visita)}${v.ciclo_divergente ? ' ✋' : ''}</span>`;
  }
  function dettaglio(v) {
    if (!v || v.ciclo_visita == null) return [];
    const c = v.visite_cicli || {};
    const p = v.ciclo_proposta || {};
    const r = v.ciclo_rientro_giorni ? 'ritorno a ' + v.ciclo_rientro_giorni + ' giorni' : (v.ciclo_esito === 'fermo' ? 'il ciclo si ferma: decide il Coordinatore' : v.ciclo_esito === 'critico' ? 'cantiere critico proposto' : 'archiviazione');
    return [
      ['Ciclo', 'n. ' + (c.numero || '?') + ', visita ' + v.ciclo_visita + (c.n_visite ? ' di ' + c.n_visite : '') + (c.stato ? ' — ' + (c.stato === 'chiuso' ? 'chiuso: ' + (ESITI[c.esito] || c.esito || '') + (c.chiuso_il ? ' il ' + dIt(c.chiuso_il) : '') : c.stato) : '')],
      ['Regola sulla visita del ciclo', r],
      ['Proposta del programma', (p.proposta === 'nuovo' ? 'ciclo nuovo' : p.proposta === 'continua' ? 'il ciclo continua' : '') + (p.motivo ? ' — ' + p.motivo : '') + (p.chiede ? ' (domanda al tecnico)' : '')],
      ['Scelta', v.ciclo_scelta ? (v.ciclo_scelta === 'nuovo' ? 'ciclo nuovo' : 'il ciclo continua') + (v.ciclo_divergente ? ' ✋ contro la proposta' : '') + (v.ciclo_fonte === 'coordinatore' ? ' (corretta dal Coordinatore)' : '') + (v.ciclo_motivo_tipo ? ' — ' + etichettaMotivo(v.ciclo_motivo_tipo) : '') + (v.ciclo_motivo ? ': ' + v.ciclo_motivo : '') : 'vale la proposta'],
      ['Percorso', c.percorso ? (PERCORSI[c.percorso] || c.percorso) + (c.percorso_esito ? ' → ' + c.percorso_esito.replace('_', ' ') : '') : ''],
    ];
  }

  /* ── Zona Coordinatore ── */
  let _mese = null;
  const meseCorrente = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  function mesePrimoUltimo(m) {
    const [y, mm] = m.split('-').map(Number);
    const ult = new Date(y, mm, 0).getDate();
    const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    return { da: m + '-01', a: m + '-' + String(ult).padStart(2, '0'), nome: MESI[mm - 1] + ' ' + y };
  }
  function meseSposta(d) { const [y, m] = _mese.split('-').map(Number); const n = new Date(y, m - 1 + d, 1); _mese = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0'); }
  const ipcSeq = (c) => (c.visite || []).map((x) => ord(x.n) + ' ' + x.ipc).join(' · ');

  async function boxCoord() {
    const box = $('adm-cicli'); if (!box) return;
    if (typeof window.isCoordPageUser !== 'function' || !window.isCoordPageUser()) { box.style.display = 'none'; return; }
    const coord = !!window.__isCoordinatoreVero;
    if (!_mese) _mese = meseCorrente();
    const m = mesePrimoUltimo(_mese);
    const { data: d, error } = await window.sb.rpc('cicli_coord', { p_dal: m.da, p_al: m.a });
    const fermi = (d && d.fermi) || [], inPerc = (d && d.in_percorso) || [], critici = (d && d.critici) || [], div = (d && d.divergenze) || [];
    const b = d && d.budget;
    const budget = b ? `<p style="font-size:12px;color:#444;margin:4px 0 8px">Budget annuale delle visite ${esc(b.esercizio)}: <b>${esc(b.fatte)}</b> fatte su <b>${esc(b.minime)}</b> minime C.E.I.V. → <b style="color:${b.minime && b.fatte > b.minime ? '#c0392b' : '#2d7a06'}">${b.minime ? (b.fatte > b.minime ? 'oltre il budget di ' + (b.fatte - b.minime) : 'restano ' + (b.minime - b.fatte)) : 'minimo non impostato'}</b>. Dentro il budget le visite 4ª-5ª e le serie sulle imprese C.E.I.V. le autorizzi tu; fuori budget, o impresa non C.E.I.V., il Direttore per la via ordinaria dei servizi.</p>` : '';
    const rigaCiclo = (c, azioni) => `<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd">
        <div style="flex:1;min-width:260px;font-size:12.5px;line-height:1.5">
          <b>${esc(c.etichetta)}</b>${c.impresa ? ' · ' + esc(c.impresa) : ''}<br>
          ciclo ${esc(c.numero)} aperto il ${esc(dIt(c.aperto_il))} · ${esc(c.n_visite)} visite${c.in_serie ? ' · in serie' : ''} · ultimo verbale <b>${esc(c.ultimo_verbale || '?')}</b> del ${esc(dIt(c.ultima_data))} (${esc(c.tecnico || '?')})<br>
          <span style="color:#444">IPC: ${esc(ipcSeq(c))}</span>
          ${c.percorso ? `<br><span style="color:#2d7a06">Percorso: <b>${esc(PERCORSI[c.percorso] || c.percorso)}</b> dal ${esc(dIt(c.percorso_il))}${c.percorso_nota ? ' — ' + esc(c.percorso_nota) : ''}${c.decisione_id ? ' · questione n. ' + esc(c.decisione_id) + ' alla Commissione' : ''}</span>` : ''}
          ${c.critico_il ? `<br><span style="color:#c0392b">Cantiere critico proposto il ${esc(dIt(c.critico_il))}: da valutare nel registro dei cantieri critici.</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${azioni}</div></div>`;
    const btnPerc = (c) => coord ? `<select id="ciclo-perc-${c.ciclo_id}" style="width:auto;font-size:12px;padding:4px 6px">
          <option value="">Scegli il seguito…</option>
          <option value="visite_4_5">Visite 4ª e 5ª (impresa disponibile)</option>
          <option value="serie">Serie di visite</option>
          <option value="conferenza">Conferenza di cantiere</option>
          <option value="commissione">Caso alla Commissione</option>
          <option value="nessuno">Nessun seguito (ciclo non risolto)</option></select>
        <button type="button" class="btn-primary btn-sm" onclick="CicliVisita.decidi(${+c.ciclo_id})" data-aiuto="Registra il seguito scelto: le visite 4ª e 5ª e le serie autorizzano i ritorni, la Commissione apre una questione nel registro delle decisioni, «nessun seguito» chiude il ciclo come non risolto. Il tecnico riceve l'esito.">✅ Decido</button>` : '<span style="font-size:11px;color:#888">decide il Coordinatore</span>';
    const btnEsito = (c) => coord ? `<button type="button" class="btn-primary btn-sm" onclick="CicliVisita.esito(${+c.ciclo_id},'risolto')" data-aiuto="Il percorso ha risolto il cantiere: il ciclo si chiude con esito «in percorso, risolto».">✅ Risolto</button>
        <button type="button" class="btn-outline btn-sm" style="color:#c0392b;border-color:#c0392b" onclick="CicliVisita.esito(${+c.ciclo_id},'non_risolto')" data-aiuto="Il percorso non ha risolto il cantiere: il ciclo si chiude con esito «in percorso, non risolto».">✋ Non risolto</button>` : '';
    const rigaDiv = (x) => `<div style="font-size:12px;padding:5px 0;border-top:1px solid #f5f5f5;color:#444">${esc(dIt(x.data_visita))} · verbale <b>${esc(x.nr_verbale || '?')}</b> · <b>${esc(x.tecnico)}</b> · ${esc(x.etichetta || '')} · ciclo ${esc(x.ciclo_numero)} visita ${esc(x.ciclo_visita)}<br>
        il programma: <i>${esc(x.proposta === 'nuovo' ? 'ciclo nuovo' : 'il ciclo continua')}</i> (${esc(x.motivo_programma || '')}) → ${x.fonte === 'coordinatore' ? 'il Coordinatore' : 'il tecnico'}: <b>${esc(x.scelta === 'nuovo' ? 'ciclo nuovo' : 'il ciclo continua')}</b>${x.motivo_tipo ? ' — ' + esc(etichettaMotivo(x.motivo_tipo)) : ''}${x.motivo ? ': ' + esc(x.motivo) : ''}
        ${coord && x.fonte !== 'coordinatore' ? ` <button type="button" class="btn-outline btn-sm" onclick="CicliVisita.correggi('${esc(x.visita_id)}','${esc(x.proposta)}')" data-aiuto="Riporta la visita sulla proposta del programma; il ciclo si ricalcola. Resta scritto che l'hai corretta tu.">↩ Torna alla proposta</button>` : ''}
        <button type="button" class="btn-outline btn-sm" onclick="showVisitaDetail('${esc(x.visita_id)}')" title="Dettaglio del verbale">👁</button></div>`;
    box.innerHTML = `<div class="card" style="border-left:4px solid #565c66;color:#222;text-align:left">
      <h3 style="color:#565c66">🔁 Cicli di visita <span style="color:#b35c00">— ${fermi.length} fermi alla 3ª visita</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">Il ciclo è il percorso di una-tre visite su una fase del lotto (regola Formedil sulla visita del ciclo, non sull'accesso). Con IPC medio ancora presente alla 3ª visita il ciclo si ferma e il seguito lo decidi tu: visite 4ª e 5ª, serie, conferenza di cantiere o caso alla Commissione. Dopo la 5ª senza miglioramento, cantiere critico. L'accesso al cantiere continua sempre.</p>
      ${error ? `<p style="font-size:12px;color:#c0392b;margin:4px 0 6px">Non sono riuscito a leggere i cicli (${esc(error.message)}): ricarica prima di concludere che non c'è niente.</p>` : ''}
      ${budget}
      ${fermi.length ? fermi.map((c) => rigaCiclo(c, btnPerc(c))).join('') : (error ? '' : '<p style="font-size:12px;color:#2d7a06;margin:4px 0">Nessun ciclo fermo in attesa di decisione.</p>')}
      ${inPerc.length ? `<b style="display:block;font-size:13px;color:#565c66;margin-top:12px">In percorso (${inPerc.length})</b>` + inPerc.map((c) => rigaCiclo(c, btnEsito(c))).join('') : ''}
      ${critici.length ? `<b style="display:block;font-size:13px;color:#c0392b;margin-top:12px">Cantieri critici proposti (${critici.length})</b>` + critici.map((c) => rigaCiclo(c, '')).join('') : ''}
      <div style="display:flex;gap:6px;align-items:center;margin:14px 0 6px;flex-wrap:wrap">
        <b style="font-size:13px;color:#565c66">Scelte dei tecnici contro la proposta — ${esc(m.nome)}</b>
        <button type="button" class="btn-outline btn-sm" id="ciclo-mese-prec" title="Mese prima">‹</button><button type="button" class="btn-outline btn-sm" id="ciclo-mese-succ" title="Mese dopo">›</button>
        <span style="font-size:11px;color:#888">${esc(d ? d.chieste : '?')} domande poste nel mese. Materiale riservato al Coordinatore.</span>
      </div>
      ${div.length ? div.map(rigaDiv).join('') : (error ? '' : '<p style="font-size:12px;color:#888;margin:4px 0">Nessuna scelta contro la proposta nel mese.</p>')}
    </div>`;
    box.style.display = '';
    const p = $('ciclo-mese-prec'), s = $('ciclo-mese-succ');
    if (p) p.onclick = () => { meseSposta(-1); boxCoord().catch(() => {}); };
    if (s) s.onclick = () => { meseSposta(1); boxCoord().catch(() => {}); };
  }
  async function decidi(cicloId) {
    if (!window.__isCoordinatoreVero) { avviso('Il seguito di un ciclo fermo lo decide solo il Coordinatore.', 'err'); return; }
    const sel = $('ciclo-perc-' + cicloId); const perc = sel ? sel.value : '';
    if (!perc) { avviso('Scegli il seguito dalla tendina.', 'warn'); return; }
    let nota = prompt(perc === 'nessuno' ? 'Perché nessun seguito? La nota arriva al tecnico:' : 'Nota per il tecnico (facoltativa):');
    if (nota === null) return;
    nota = nota.trim();
    if (perc === 'nessuno' && nota.length < 5) { avviso('Scrivi il motivo: è la riga che rilegge il tecnico.', 'warn'); return; }
    const { data, error } = await window.sb.rpc('ciclo_percorso', { p_ciclo_id: cicloId, p_percorso: perc, p_nota: nota || null });
    if (error) { avviso('Decisione non registrata: ' + error.message, 'err'); return; }
    avviso('Seguito registrato: ' + PERCORSI[perc] + (data && data.decisione_id ? ' (questione n. ' + data.decisione_id + ' aperta per la Commissione)' : '') + '. Il tecnico riceve l\'esito.', 'ok');
    boxCoord().catch(() => {});
  }
  async function esito(cicloId, e) {
    if (!window.__isCoordinatoreVero) { avviso('L\'esito del percorso lo scrive solo il Coordinatore.', 'err'); return; }
    let nota = prompt('Nota (facoltativa):'); if (nota === null) return;
    const { error } = await window.sb.rpc('ciclo_percorso_esito', { p_ciclo_id: cicloId, p_esito: e, p_nota: nota.trim() || null });
    if (error) { avviso('Esito non registrato: ' + error.message, 'err'); return; }
    avviso('Ciclo chiuso: in percorso, ' + e.replace('_', ' ') + '.', 'ok');
    boxCoord().catch(() => {});
  }
  async function correggi(vid, scelta) {
    if (!window.__isCoordinatoreVero) { avviso('La scelta del ciclo la corregge solo il Coordinatore.', 'err'); return; }
    let nota = prompt('Perché la correggi? (facoltativo)'); if (nota === null) return;
    const { error } = await window.sb.rpc('ciclo_correggi', { p_visita_id: vid, p_scelta: scelta, p_nota: nota.trim() || null });
    if (error) { avviso('Correzione non registrata: ' + error.message, 'err'); return; }
    avviso('Visita riportata sulla proposta del programma: il ciclo è stato ricalcolato.', 'ok');
    boxCoord().catch(() => {});
  }

  window.CicliVisita = { regola, rientro, proponi, render, pronto, campi, daSnap, azzera, calcRitorno, regolaAttuale, numeroVisita, numeroCiclo, attivo, autorizzata, badge, dettaglio, boxCoord, decidi, esito, correggi, etichettaMotivo, MOTIVI, PERCORSI, ESITI, proposta: () => _prop };
})();
