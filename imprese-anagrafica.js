/* ============================================================
   ANAGRAFICA IMPRESE DELLA SEGRETERIA — elenco, doppioni, unione,
   eliminazione (06/10/2026, chiesto dall'utente: «un sacco di
   anagrafiche sporche… un sistema per cercare duplicati imprese ed
   eventualmente poter unire… e poi dovrei anche poter eliminare»).

   Dove: pagina Ufficio › Anagrafiche, riquadri «Gestione imprese» e
   «Imprese doppie». Tutto passa dal database (supabase/sql/
   2026_10_06_imprese_anagrafica.sql), riservato alla segreteria:
   - imprese_elenco: l'elenco a pagine, ordinabile e filtrabile;
   - imprese_doppioni: i gruppi dal più sicuro al meno sicuro;
   - imprese_unisci: l'unione di sempre (fondi_imprese, sposta tutto
     sulla principale e archivia le altre) più i valori scelti qui;
   - impresa_elimina: solo una scheda senza niente collegato e fuori
     dalla lista della Cassa Edile, con copia in archivio;
   - imprese_doppioni_diverse: «non sono doppioni», il gruppo non torna.
   In più, sui campi P.IVA del gestionale, l'avviso quando il numero
   non può esistere: è così che nascono i doppioni.

   Script classico: usa window.sb, window.toast, window.admEditImpresa,
   window.apriImpresaInSegreteria, window._riepUnione.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo, tipo === 'err' ? 9000 : 4500) : alert(msg));
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const n = (x) => +x || 0;

  /* ── la P.IVA: stessa regola di piva_valida nel database ──
     null = non ha 11 cifre (vuota, estera, codice fiscale): non si giudica */
  function pivaValida(p) {
    const s = String(p == null ? '' : p).toUpperCase().replace(/\s+/g, '').replace(/^IT/, '');
    if (!/^\d{11}$/.test(s)) return null;
    if (s === '00000000000') return false;
    const uff = s.slice(7, 10);
    if (uff !== '888' && uff !== '999' && !(+uff >= 1 && +uff <= 121)) return false;
    let somma = 0;
    for (let k = 0; k < 10; k++) {
      const c = +s[k];
      somma += k % 2 === 0 ? c : (c * 2 > 9 ? c * 2 - 9 : c * 2);
    }
    return (somma + +s[10]) % 10 === 0;
  }
  // che cosa dire di una P.IVA scritta in un campo; '' = niente da dire
  function avvisoPiva(p) {
    const s = String(p == null ? '' : p).toUpperCase().replace(/\s+/g, '').replace(/^IT/, '');
    if (!s) return '';
    if (/^\d{9,10}$/.test(s)) return 'Ha ' + s.length + ' cifre: una P.IVA ne ha 11 (mancano gli zeri iniziali?).';
    if (pivaValida(s) === false) return 'Questa P.IVA non può esistere: il codice di controllo non torna. Controllala sul documento o con «Dati ufficiali».';
    return '';
  }

  /* ── la scheda da tenere, proposta: P.IVA valida, più collegamenti, nella lista della Cassa, codice = P.IVA ── */
  const peso = (m) => (pivaValida(m.piva) === true ? 1e6 : 0) + (m.cod_ceiv ? 1e5 : 0)
    + (n(m.verbali) + n(m.persone) + n(m.altro)) * 10 + (m.piva && String(m.impresa_id) === String(m.piva) ? 1 : 0);
  function principaleProposta(membri) {
    return [...(membri || [])].sort((a, b) => peso(b) - peso(a) || String(a.impresa_id).localeCompare(String(b.impresa_id)))[0] || null;
  }

  /* ── i campi che nell'unione si possono scegliere (gli stessi ammessi da imprese_unisci) ── */
  const CAMPI = [['impresa_nome', 'Ragione sociale'], ['piva', 'P.IVA'], ['impresa_cf', 'Codice fiscale'], ['indirizzo', 'Indirizzo'],
    ['comune', 'Comune'], ['cap', 'CAP'], ['prov', 'Provincia'], ['cod_ceiv', 'Codice C.E.I.V.']];
  const pulito = (v) => (v == null ? '' : String(v).trim());
  // dove le schede sono diverse: {campo: [valori]} (i vuoti non contano: l'unione riempie da sola i campi vuoti)
  function campiDiversi(membri) {
    const out = {};
    CAMPI.forEach(([k]) => {
      const vals = [...new Set((membri || []).map((m) => pulito(m[k])).filter(Boolean))];
      if (vals.length > 1) out[k] = vals;
    });
    return out;
  }
  // il valore proposto per ogni campo diverso: quello della principale; per la P.IVA quella valida se la principale non l'ha
  function sceltePredefinite(membri, principaleId) {
    const pr = (membri || []).find((m) => m.impresa_id === principaleId) || {};
    const out = {};
    Object.entries(campiDiversi(membri)).forEach(([k, vals]) => {
      let v = pulito(pr[k]);
      if (k === 'piva' && pivaValida(v) !== true) v = vals.find((x) => pivaValida(x) === true) || v;
      out[k] = v || vals[0];
    });
    return out;
  }

  const eliminabile = (r) => !pulito(r.cod_ceiv) && n(r.verbali) + n(r.persone) + n(r.altro) === 0;
  const collegamenti = (r) => {
    const p = [];
    if (n(r.verbali)) p.push(r.verbali + (n(r.verbali) === 1 ? ' verbale' : ' verbali'));
    if (n(r.persone)) p.push(r.persone + (n(r.persone) === 1 ? ' persona' : ' persone'));
    if (n(r.altro)) p.push(r.altro + (n(r.altro) === 1 ? ' altro collegamento' : ' altri collegamenti'));
    return p.join(' · ') || 'niente';
  };
  const dettaglio = (r) => Object.entries(r.dettaglio || {}).map(([k, v]) => v + ' in ' + k).join(', ');
  const cellaPiva = (p) => {
    const a = avvisoPiva(p);
    return esc(p || '') + (a ? ` <span title="${esc(a)}" style="color:#C0392B;font-weight:700">⚠</span>` : '');
  };

  /* ═════════════ ELENCO ═════════════ */
  const st = { testo: '', ordina: 'nome', desc: false, segnale: '', da: 0, limite: 100, righe: [], totale: 0 };
  const sel = new Map();   // impresa_id -> riga, per l'unione a mano
  const COLONNE = [['nome', 'Ragione sociale'], ['cf', 'Codice fiscale'], ['piva', 'P.IVA'], ['comune', 'Comune'], ['indirizzo', 'Indirizzo'], ['ceiv', 'Cod. C.E.I.V.'], ['verbali', 'Collegamenti']];

  function scheletroElenco(sez) {
    sez.innerHTML = `
      <div class="adm-section-title">🏢 Gestione imprese</div>
      <p style="font-size:12px;color:#888;margin-bottom:10px">Tutte le imprese dell'anagrafica. Clic sul titolo di una colonna per ordinare; doppio clic sulla riga apre la scheda nell'app segreteria. Per unire due schede che sono la stessa impresa spuntale; per i casi che il gestionale trova da solo c'è il riquadro «Imprese doppie».</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input type="text" id="ia-testo" placeholder="Ragione sociale, P.IVA, codice fiscale, comune, via, codice C.E.I.V.…" style="flex:1;min-width:220px">
        <select id="ia-segnale" style="width:auto">
          <option value="">Tutte</option>
          <option value="piva_non_valida">P.IVA che non può esistere</option>
          <option value="senza_piva">Senza P.IVA</option>
          <option value="cessate">Cessate</option>
        </select>
        <button class="btn-primary btn-sm" id="ia-cerca">🔍 Cerca</button>
      </div>
      <div id="ia-unisci-bar" style="display:none;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(231,80,15,.10);border:1px solid rgba(231,80,15,.5);border-radius:8px;padding:8px 12px;margin-bottom:10px">
        <span id="ia-unisci-n" style="font-size:13px;font-weight:600"></span>
        <button class="btn-primary btn-sm" id="ia-unisci">🔗 Unisci le selezionate…</button>
        <button class="btn-outline btn-sm" id="ia-deseleziona">Deseleziona</button>
      </div>
      <div id="ia-stato" style="font-size:12px;color:#888;margin-bottom:6px"></div>
      <div class="tbl-wrap" style="border-radius:8px"><table id="ia-tabella" style="font-size:12px;width:100%">
        <thead><tr>
          <th style="width:26px" title="Spunta per unire">🔗</th>
          ${COLONNE.map(([k, t]) => `<th data-ia-ord="${k}" style="cursor:pointer;text-align:left;white-space:nowrap;padding:8px 8px">${t} <span data-ia-freccia="${k}"></span></th>`).join('')}
          <th></th>
        </tr></thead>
        <tbody id="ia-righe"><tr><td colspan="9" style="padding:16px;text-align:center;color:#888">Caricamento…</td></tr></tbody>
      </table></div>
      <div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:8px">
        <button class="btn-outline btn-sm" id="ia-prec">‹ Precedenti</button>
        <span id="ia-pagina" style="font-size:12px;color:#888"></span>
        <button class="btn-outline btn-sm" id="ia-succ">Successive ›</button>
      </div>`;
    $('ia-cerca').onclick = () => { st.testo = $('ia-testo').value.trim(); st.segnale = $('ia-segnale').value; st.da = 0; carica(); };
    $('ia-testo').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('ia-cerca').click(); });
    $('ia-segnale').onchange = () => $('ia-cerca').click();
    $('ia-prec').onclick = () => { st.da = Math.max(0, st.da - st.limite); carica(); };
    $('ia-succ').onclick = () => { if (st.da + st.limite < st.totale) { st.da += st.limite; carica(); } };
    $('ia-deseleziona').onclick = () => { sel.clear(); disegna(); };
    $('ia-unisci').onclick = () => apriUnione([...sel.values()]);
    sez.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('[data-ia-ord]'); if (!th) return;
      const k = th.dataset.iaOrd;
      if (st.ordina === k) st.desc = !st.desc; else { st.ordina = k; st.desc = k === 'verbali'; }
      st.da = 0; carica();
    });
    $('ia-righe').addEventListener('change', (e) => {
      const cb = e.target.closest('[data-ia-sel]'); if (!cb) return;
      const r = st.righe.find((x) => x.impresa_id === cb.dataset.iaSel); if (!r) return;
      if (cb.checked) sel.set(r.impresa_id, r); else sel.delete(r.impresa_id);
      barra();
    });
    $('ia-righe').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-ia-az]'); if (!b) return;
      const r = st.righe.find((x) => x.impresa_id === b.dataset.id); if (!r) return;
      if (b.dataset.iaAz === 'modifica' && typeof window.admEditImpresa === 'function') window.admEditImpresa(r.impresa_id);
      if (b.dataset.iaAz === 'elimina') elimina(r);
    });
    $('ia-righe').addEventListener('dblclick', (e) => {
      const tr = e.target.closest('tr[data-imp]');
      if (tr && typeof window.apriImpresaInSegreteria === 'function') window.apriImpresaInSegreteria(tr.dataset.imp, e);
    });
  }

  function barra() {
    const b = $('ia-unisci-bar'); if (!b) return;
    b.style.display = sel.size >= 2 ? 'flex' : 'none';
    $('ia-unisci-n').textContent = sel.size + ' imprese selezionate';
  }

  async function carica() {
    const corpo = $('ia-righe'); if (!corpo || !window.sb) return;
    corpo.innerHTML = '<tr><td colspan="9" style="padding:16px;text-align:center;color:#888">Caricamento…</td></tr>';
    const { data, error } = await window.sb.rpc('imprese_elenco', {
      p_testo: st.testo || null, p_ordina: st.ordina, p_desc: st.desc, p_segnale: st.segnale || null, p_limite: st.limite, p_da: st.da });
    if (error || !data) {
      corpo.innerHTML = `<tr><td colspan="9" style="padding:16px;text-align:center;color:#C0392B">Non sono riuscito a leggere l'elenco delle imprese (${esc(error ? error.message : 'risposta vuota')}). Non vuol dire che non ce ne siano: riprova.</td></tr>`;
      $('ia-stato').textContent = '';
      return;
    }
    st.righe = data.righe || []; st.totale = n(data.totale);
    disegna();
  }

  function disegna() {
    const corpo = $('ia-righe'); if (!corpo) return;
    document.querySelectorAll('[data-ia-freccia]').forEach((s) => { s.textContent = s.dataset.iaFreccia === st.ordina ? (st.desc ? '▼' : '▲') : ''; });
    $('ia-stato').textContent = st.totale ? (st.totale.toLocaleString('it-IT') + (st.totale === 1 ? ' impresa' : ' imprese') + (st.testo || st.segnale ? ' trovate' : ' in anagrafica')) : '';
    $('ia-pagina').textContent = st.totale ? (st.da + 1) + '-' + Math.min(st.da + st.limite, st.totale) + ' di ' + st.totale.toLocaleString('it-IT') : '';
    $('ia-prec').disabled = st.da === 0; $('ia-succ').disabled = st.da + st.limite >= st.totale;
    if (!st.righe.length) { corpo.innerHTML = '<tr><td colspan="9" style="padding:16px;text-align:center;color:#888">Nessuna impresa con questi criteri</td></tr>'; barra(); return; }
    corpo.innerHTML = st.righe.map((r) => `
      <tr data-imp="${esc(r.impresa_id)}" title="Doppio clic: apre la scheda nell'app segreteria" style="border-top:1px solid rgba(128,128,128,.2)">
        <td style="text-align:center"><input type="checkbox" data-ia-sel="${esc(r.impresa_id)}" ${sel.has(r.impresa_id) ? 'checked' : ''} style="width:16px;height:16px"></td>
        <td style="padding:6px 8px;font-weight:600">${esc(r.impresa_nome)}${r.cessata_il ? ` <span style="color:#C0392B;font-size:11px;font-weight:600">cessata ${esc(dIt(r.cessata_il))}</span>` : ''}</td>
        <td style="padding:6px 8px;font-family:monospace;font-size:11px">${esc(r.impresa_cf || '')}</td>
        <td style="padding:6px 8px;font-family:monospace;font-size:11px;white-space:nowrap">${cellaPiva(r.piva)}</td>
        <td style="padding:6px 8px">${esc(r.comune || '')}${r.prov ? ' (' + esc(r.prov) + ')' : ''}</td>
        <td style="padding:6px 8px">${esc(r.indirizzo || '')}</td>
        <td style="padding:6px 8px;font-family:monospace;font-size:11px">${esc(r.cod_ceiv || '')}</td>
        <td style="padding:6px 8px;font-size:11px;white-space:nowrap" title="${esc(dettaglio(r))}">${esc(collegamenti(r))}</td>
        <td style="padding:6px 4px;text-align:right;white-space:nowrap">
          <button class="btn-primary btn-sm" data-ia-az="modifica" data-id="${esc(r.impresa_id)}">✏️ Modifica</button>
          ${eliminabile(r)
            ? `<button class="btn-outline btn-sm" data-ia-az="elimina" data-id="${esc(r.impresa_id)}" data-aiuto="Elimina la scheda: non ha niente collegato. Resta una copia in archivio.">🗑</button>`
            : `<button class="btn-outline btn-sm" disabled data-aiuto="${esc(pulito(r.cod_ceiv) ? 'È nella lista della Cassa Edile: non si elimina.' : 'Ha ' + collegamenti(r) + ' collegati: non si elimina. Se è un doppione, spuntala insieme a quella giusta e uniscile.')}">🗑</button>`}
        </td>
      </tr>`).join('');
    barra();
  }

  /* ═════════════ DOPPIONI ═════════════ */
  const LIVELLI = { 1: 'Stessa P.IVA o codice fiscale', 2: 'P.IVA che differiscono di una cifra', 3: 'Stesso nome, stesso comune', 4: 'Stesso nome, comune diverso o mancante' };
  const SPIEGA = {
    1: 'quasi certamente la stessa impresa, scritta due volte',
    2: 'due P.IVA valide non possono differire di una cifra sola: una delle due è scritta male',
    3: 'probabile doppione: controlla P.IVA e indirizzo',
    4: 'da guardare con calma: possono essere imprese diverse con lo stesso nome',
  };
  const dp = { livello: null, da: 0, limite: 20, gruppi: [], totale: 0, conteggi: {} };

  function scheletroDoppioni(sez) {
    sez.innerHTML = `
      <div class="adm-section-title">🧩 Imprese doppie</div>
      <p style="font-size:12px;color:#888;margin-bottom:10px">Gruppi di schede che potrebbero essere la stessa impresa, dal caso più sicuro al meno sicuro. Per ogni gruppo: <b>Unisci</b> (sposta verbali, persone e tutto il resto sulla scheda che tieni; le altre vengono archiviate, non cancellate) oppure <b>Non sono doppioni</b> (il gruppo non ricompare). Una scheda senza niente collegato si può anche eliminare.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <button class="btn-primary btn-sm" id="dp-cerca">🔎 Cerca i doppioni</button>
        <span id="dp-livelli" style="display:flex;gap:6px;flex-wrap:wrap"></span>
      </div>
      <div id="dp-gruppi" style="font-size:12px;color:#888">Premi «Cerca i doppioni»: il controllo guarda tutta l'anagrafica e richiede qualche secondo.</div>
      <div id="dp-pag" style="display:none;gap:8px;align-items:center;justify-content:flex-end;margin-top:8px">
        <button class="btn-outline btn-sm" id="dp-prec">‹ Precedenti</button>
        <span id="dp-pagina" style="font-size:12px;color:#888"></span>
        <button class="btn-outline btn-sm" id="dp-succ">Successivi ›</button>
      </div>`;
    $('dp-cerca').onclick = () => { dp.da = 0; caricaDoppioni(); };
    $('dp-prec').onclick = () => { dp.da = Math.max(0, dp.da - dp.limite); caricaDoppioni(); };
    $('dp-succ').onclick = () => { if (dp.da + dp.limite < dp.totale) { dp.da += dp.limite; caricaDoppioni(); } };
    $('dp-livelli').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dp-liv]'); if (!b) return;
      dp.livello = b.dataset.dpLiv === '' ? null : +b.dataset.dpLiv; dp.da = 0; caricaDoppioni();
    });
    $('dp-gruppi').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-dp-az]'); if (!b) return;
      const g = dp.gruppi[+b.dataset.g]; if (!g) return;
      const box = b.closest('[data-dp-gruppo]');
      const dentro = [...box.querySelectorAll('[data-dp-dentro]')].filter((c) => c.checked).map((c) => c.dataset.dpDentro);
      const pr = (box.querySelector('[data-dp-pr]:checked') || {}).value;
      if (b.dataset.dpAz === 'unisci') {
        const membri = g.membri.filter((m) => dentro.includes(m.impresa_id));
        if (membri.length < 2) { avviso('Spunta almeno due schede da unire', 'warn'); return; }
        if (!dentro.includes(pr)) { avviso('La scheda da tenere deve essere fra quelle spuntate', 'warn'); return; }
        apriUnione(membri, pr);
      }
      if (b.dataset.dpAz === 'diverse') diverse(g);
      if (b.dataset.dpAz === 'elimina') { const m = g.membri.find((x) => x.impresa_id === b.dataset.id); if (m) elimina(m); }
      if (b.dataset.dpAz === 'modifica' && typeof window.admEditImpresa === 'function') window.admEditImpresa(b.dataset.id);
    });
  }

  async function caricaDoppioni() {
    const box = $('dp-gruppi'); if (!box || !window.sb) return;
    box.innerHTML = '<div style="color:#888">⏳ Cerco i doppioni in tutta l\'anagrafica…</div>';
    const { data, error } = await window.sb.rpc('imprese_doppioni', { p_livello: dp.livello, p_limite: dp.limite, p_da: dp.da });
    if (error || !data) {
      box.innerHTML = `<div style="color:#C0392B">Non sono riuscito a cercare i doppioni (${esc(error ? error.message : 'risposta vuota')}). Non vuol dire che non ce ne siano: riprova.</div>`;
      return;
    }
    dp.gruppi = data.gruppi || []; dp.totale = n(data.totale); dp.conteggi = data.conteggi || {};
    disegnaDoppioni();
  }

  function disegnaDoppioni() {
    const tutti = Object.values(dp.conteggi).reduce((a, b) => a + n(b), 0);
    $('dp-livelli').innerHTML = `<button class="${dp.livello == null ? 'btn-primary' : 'btn-outline'} btn-sm" data-dp-liv="">Tutti (${tutti})</button>`
      + Object.keys(LIVELLI).map((k) => `<button class="${dp.livello === +k ? 'btn-primary' : 'btn-outline'} btn-sm" data-dp-liv="${k}" data-aiuto="${esc(SPIEGA[k])}">${esc(LIVELLI[k])} (${n(dp.conteggi[k])})</button>`).join('');
    const pag = $('dp-pag'); pag.style.display = dp.totale > dp.limite ? 'flex' : 'none';
    $('dp-pagina').textContent = dp.totale ? (dp.da + 1) + '-' + Math.min(dp.da + dp.limite, dp.totale) + ' di ' + dp.totale : '';
    $('dp-prec').disabled = dp.da === 0; $('dp-succ').disabled = dp.da + dp.limite >= dp.totale;
    const box = $('dp-gruppi');
    if (!dp.gruppi.length) { box.innerHTML = '<div style="color:#1E8449">✓ Nessun gruppo da guardare' + (dp.livello ? ' in questo livello' : '') + '.</div>'; return; }
    box.innerHTML = dp.gruppi.map((g, gi) => {
      const pr = principaleProposta(g.membri);
      return `<div data-dp-gruppo="${gi}" style="border:1px solid rgba(128,128,128,.3);border-radius:8px;padding:10px 12px;margin-bottom:10px">
        <div style="font-size:12px;margin-bottom:6px"><b>${esc(LIVELLI[g.livello] || '')}</b> <span style="color:#888">— ${esc(SPIEGA[g.livello] || '')}</span></div>
        <div class="tbl-wrap"><table style="font-size:12px;width:100%">
          <thead><tr style="color:#888;font-size:11px"><th title="Fa parte del gruppo">✓</th><th title="La scheda da tenere">Tieni</th><th style="text-align:left">Ragione sociale</th><th style="text-align:left">P.IVA</th><th style="text-align:left">Codice fiscale</th><th style="text-align:left">Indirizzo</th><th style="text-align:left">Cassa Edile</th><th style="text-align:left">Collegamenti</th><th></th></tr></thead>
          <tbody>${g.membri.map((m) => `<tr style="border-top:1px solid rgba(128,128,128,.2)">
            <td style="text-align:center"><input type="checkbox" data-dp-dentro="${esc(m.impresa_id)}" checked></td>
            <td style="text-align:center"><input type="radio" name="dp-pr-${gi}" data-dp-pr value="${esc(m.impresa_id)}" ${pr && pr.impresa_id === m.impresa_id ? 'checked' : ''}></td>
            <td style="padding:5px 8px"><b>${esc(m.impresa_nome)}</b>${m.cessata_il ? ` <span style="color:#C0392B;font-size:11px">cessata ${esc(dIt(m.cessata_il))}</span>` : ''}<br><span style="color:#888;font-size:10px">codice ${esc(m.impresa_id)}${m.creata_il ? ' · in anagrafica dal ' + esc(dIt(m.creata_il)) : ''}</span></td>
            <td style="padding:5px 8px;font-family:monospace;font-size:11px;white-space:nowrap">${cellaPiva(m.piva)}</td>
            <td style="padding:5px 8px;font-family:monospace;font-size:11px">${esc(m.impresa_cf || '')}</td>
            <td style="padding:5px 8px">${esc([m.indirizzo, [m.cap, m.comune].filter(Boolean).join(' '), m.prov ? '(' + m.prov + ')' : ''].filter(Boolean).join(', '))}</td>
            <td style="padding:5px 8px;font-size:11px">${m.cod_ceiv ? esc(m.cod_ceiv) + (m.stato_cassa ? ' · ' + esc(m.stato_cassa) : '') : ''}</td>
            <td style="padding:5px 8px;font-size:11px;white-space:nowrap" title="${esc(dettaglio(m))}">${esc(collegamenti(m))}</td>
            <td style="padding:5px 4px;text-align:right;white-space:nowrap">
              <button class="btn-outline btn-sm" data-dp-az="modifica" data-g="${gi}" data-id="${esc(m.impresa_id)}">✏️</button>
              ${eliminabile(m) ? `<button class="btn-outline btn-sm" data-dp-az="elimina" data-g="${gi}" data-id="${esc(m.impresa_id)}" data-aiuto="Elimina questa scheda: non ha niente collegato. Resta una copia in archivio.">🗑</button>` : ''}
            </td></tr>`).join('')}</tbody>
        </table></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn-outline btn-sm" data-dp-az="diverse" data-g="${gi}" data-aiuto="Le schede restano tutte com'erano e questo gruppo non ricompare.">✋ Non sono doppioni</button>
          <button class="btn-primary btn-sm" data-dp-az="unisci" data-g="${gi}" data-aiuto="Apre il riepilogo: scegli i valori da tenere, poi confermi.">🔗 Unisci…</button>
        </div>
      </div>`;
    }).join('');
  }

  async function diverse(g) {
    const nomi = g.membri.map((m) => '• ' + m.impresa_nome + ' (' + m.impresa_id + ')').join('\n');
    if (!confirm('Confermi che queste schede sono imprese DIVERSE?\n\n' + nomi + '\n\nNon cambia niente nelle schede; il gruppo non ricomparirà fra i doppioni.')) return;
    const { data, error } = await window.sb.rpc('imprese_doppioni_diverse', { p_ids: g.membri.map((m) => m.impresa_id) });
    if (error || !data || !data.ok) { avviso('Non fatto: ' + (error ? error.message : 'risposta inattesa'), 'err'); return; }
    avviso('Segnate come imprese diverse', 'ok');
    caricaDoppioni();
  }

  /* ═════════════ UNIONE ═════════════ */
  function finestra() {
    let ov = $('ia-unione');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'ia-unione'; ov.className = 'modal-overlay hidden';
    ov.innerHTML = '<div class="modal-box" style="max-width:860px;width:96vw"><div id="ia-unione-corpo"></div></div>';
    document.body.appendChild(ov);
    return ov;
  }

  function apriUnione(membri, principaleId) {
    if (!membri || membri.length < 2) { avviso('Servono almeno due schede', 'warn'); return; }
    const ov = finestra();
    let pr = principaleId || principaleProposta(membri).impresa_id;
    const corpo = $('ia-unione-corpo');
    const disegnaU = () => {
      const diversi = campiDiversi(membri);
      const scelte = sceltePredefinite(membri, pr);
      const altre = membri.filter((m) => m.impresa_id !== pr);
      const somma = (k) => altre.reduce((a, m) => a + n(m[k]), 0);
      corpo.innerHTML = `
        <h3 style="margin:0 0 6px">🔗 Unione di ${membri.length} schede</h3>
        <p style="font-size:12px;color:#666;margin:0 0 10px">Quale scheda tieni? Le altre vengono <b>archiviate</b> (non cancellate) e tutto quello che hanno collegato passa sulla scheda che tieni.</p>
        ${membri.map((m) => `<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border:1px solid ${m.impresa_id === pr ? 'var(--orange,#e7500f)' : 'rgba(128,128,128,.3)'};border-radius:6px;margin-bottom:6px;cursor:pointer;font-size:12px">
          <input type="radio" name="ia-u-pr" value="${esc(m.impresa_id)}" ${m.impresa_id === pr ? 'checked' : ''} style="margin-top:2px">
          <span><b>${esc(m.impresa_nome)}</b> · codice ${esc(m.impresa_id)} · P.IVA ${cellaPiva(m.piva) || '—'}${m.cod_ceiv ? ' · C.E.I.V. ' + esc(m.cod_ceiv) : ''}<br><span style="color:#888">${esc(collegamenti(m))}</span></span>
        </label>`).join('')}
        ${Object.keys(diversi).length ? `<div style="margin:12px 0 4px;font-size:13px;font-weight:600">Dove le schede sono diverse, quale valore tieni?</div>
          <p style="font-size:11px;color:#888;margin:0 0 6px">Il valore che non tieni resta scritto nelle note della scheda: non si perde. I campi vuoti la principale li prende da sola dalle altre, e così e-mail e telefoni.</p>
          ${Object.entries(diversi).map(([k, vals]) => `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:4px 0;border-top:1px solid rgba(128,128,128,.15);font-size:12px">
            <span style="min-width:120px;color:#666">${esc((CAMPI.find((c) => c[0] === k) || [k, k])[1])}</span>
            ${vals.map((v) => `<label style="display:flex;gap:4px;align-items:center;cursor:pointer"><input type="radio" name="ia-u-${k}" data-ia-campo="${k}" value="${esc(v)}" ${scelte[k] === v ? 'checked' : ''}>${k === 'piva' ? cellaPiva(v) : esc(v)}</label>`).join('')}
          </div>`).join('')}` : '<p style="font-size:12px;color:#888">Le schede non hanno valori in contrasto: la principale prende dalle altre solo i campi che le mancano.</p>'}
        <div style="margin-top:12px;padding:8px 10px;background:rgba(231,80,15,.08);border-radius:6px;font-size:12px">Passano sulla scheda che tieni: <b>${esc(collegamenti({ verbali: somma('verbali'), persone: somma('persone'), altro: somma('altro') }))}</b> (gli altri collegamenti sono protocolli, corsi, nomine, pratiche…). Non si torna indietro con un clic: le schede archiviate restano nel database e nel registro delle unioni.</div>
        <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn-outline" id="ia-u-annulla">Annulla</button>
          <button class="btn-primary" id="ia-u-ok">🔗 Unisci</button>
        </div>`;
      corpo.querySelectorAll('input[name="ia-u-pr"]').forEach((r) => { r.onchange = () => { pr = r.value; disegnaU(); }; });
      $('ia-u-annulla').onclick = () => ov.classList.add('hidden');
      $('ia-u-ok').onclick = async () => {
        const sc = {};
        corpo.querySelectorAll('input[data-ia-campo]:checked').forEach((r) => { sc[r.dataset.iaCampo] = r.value; });
        const b = $('ia-u-ok'); b.disabled = true; b.textContent = '⏳ Unisco…';
        const { data, error } = await window.sb.rpc('imprese_unisci', { p_master: pr, p_dupes: altre.map((m) => m.impresa_id), p_scelte: sc });
        if (error || !data || !data.ok) {
          b.disabled = false; b.textContent = '🔗 Unisci';
          avviso('Unione non fatta: ' + (error ? error.message : 'risposta inattesa') + '. Non è cambiato niente.', 'err');
          return;
        }
        ov.classList.add('hidden');
        avviso('Unione fatta: ' + n(data.imprese_archiviate) + ' schede archiviate (' + (typeof window._riepUnione === 'function' ? window._riepUnione(data) : n(data.righe_spostate) + ' righe spostate') + ')', 'ok');
        membri.forEach((m) => sel.delete(m.impresa_id));
        carica();
        if (dp.gruppi.length) caricaDoppioni();
      };
    };
    disegnaU();
    ov.classList.remove('hidden');
  }

  /* ═════════════ ELIMINAZIONE ═════════════ */
  async function elimina(r) {
    if (!eliminabile(r)) { avviso('Questa scheda ha qualcosa collegato: non si elimina, si unisce a quella giusta', 'warn'); return; }
    const motivo = prompt('Elimini la scheda «' + r.impresa_nome + '» (codice ' + r.impresa_id + ')?\n\nNon ha niente collegato. Resta una copia in archivio da cui si può rimettere.\n\nScrivi perché la elimini (es. «scheda sbagliata, mai usata»):', 'scheda sbagliata, mai usata');
    if (motivo == null) return;
    if (motivo.trim().length < 3) { avviso('Serve una parola sul perché: resta nella copia in archivio', 'warn'); return; }
    const { data, error } = await window.sb.rpc('impresa_elimina', { p_impresa_id: r.impresa_id, p_motivo: motivo.trim() });
    if (error || !data || !data.ok) { avviso('Non eliminata: ' + (error ? error.message : 'risposta inattesa'), 'err'); return; }
    avviso('Scheda «' + (data.nome || r.impresa_nome) + '» eliminata (copia in archivio)', 'ok');
    sel.delete(r.impresa_id);
    carica();
    if (dp.gruppi.length) caricaDoppioni();
  }

  /* ═════════════ AVVISO SULLA P.IVA NEI CAMPI ═════════════
     Nuova impresa, modifica impresa e i committenti: chi scrive una P.IVA che non può esistere lo sa
     subito. Non blocca (può essere un caso da verificare), ma è così che nascono i doppioni. */
  const CAMPI_PIVA = ['mi-piva', 'ei-piva2', 'f-comm-piva', 'mc-comm-piva', 'ec-piva'];
  function controllaCampo(el) {
    if (!el || !CAMPI_PIVA.includes(el.id)) return;
    const msg = avvisoPiva(el.value);
    let a = document.querySelector('[data-piva-avviso="' + el.id + '"]');
    if (!msg) { if (a) a.remove(); return; }
    if (!a) {
      a = document.createElement('div');
      a.dataset.pivaAvviso = el.id;
      a.style.cssText = 'font-size:11px;color:#C0392B;margin-top:3px';
      el.insertAdjacentElement('afterend', a);
    }
    a.textContent = '⚠ ' + msg;
  }
  document.addEventListener('focusout', (e) => controllaCampo(e.target), true);
  document.addEventListener('input', (e) => { const a = e.target && e.target.id && document.querySelector('[data-piva-avviso="' + e.target.id + '"]'); if (a && !avvisoPiva(e.target.value)) a.remove(); }, true);

  /* ═════════════ MONTAGGIO ═════════════ */
  let montato = false;
  function monta() {
    if (montato) return true;
    const sez = $('ia-sezione'), sezD = $('dp-sezione');
    if (!sez || !sezD) return false;
    scheletroElenco(sez);
    scheletroDoppioni(sezD);
    montato = true;
    // l'elenco si legge la prima volta che il riquadro compare (Ufficio › Anagrafiche), non a ogni apertura del gestionale
    if (typeof IntersectionObserver === 'function') {
      const oss = new IntersectionObserver((voci) => { if (voci.some((x) => x.isIntersecting)) { oss.disconnect(); carica(); } });
      oss.observe(sez);
    }
    return true;
  }
  async function caricaElenco() { if (monta()) await carica(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();

  window.ImpreseAnag = { carica: caricaElenco, caricaDoppioni, apriUnione, elimina,
    // per le prove in Node
    pivaValida, avvisoPiva, principaleProposta, campiDiversi, sceltePredefinite, eliminabile };
})();
