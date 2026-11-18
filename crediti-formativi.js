/* ============================================================
   CREDITI FORMATIVI DEI TECNICI nella pagina «📄 Documenti» (17/11/2026)

   Deciso dall'utente: la segreteria tiene la contabilita' degli
   aggiornamenti obbligatori dei tecnici (coordinatore: 40 ore negli
   ultimi cinque anni; formatore: 24 ore per triennio) e li avvisa per
   tempo. Qui:
   - il TECNICO vede i propri: ore, fino a quando e' in regola, i corsi
     che contano;
   - il COORDINATORE vede tutti i tecnici, in sola lettura;
   - la segreteria registra i documenti nell'app segreteria («Documenti
     tecnici»), non qui;
   - il TECNICO carica i suoi attestati (17/11/2026, deciso dall'utente:
     ognuno per sé, non il Coordinatore, senza protocollo). Il file va nel
     suo fascicolo su Drive (edge function crediti-attestato) e la riga
     resta «in attesa della segreteria» in s_doc_tecnico_invii: NON conta
     nelle ore finché la segreteria non la conferma.
   I dati li da' la funzione crediti_formativi() del database, che fa
   rispettare chi vede cosa. Il conteggio e' crediti-ore.js, copia
   generata dal modulo della segreteria (tools/genera-crediti-ore.cjs).
   Regole e fonti: 3_RISORSE/Normativa/2026_11_17_REL_Area-Sicurezza_
   aggiornamento-coordinatori-e-formatori-regole-e-fonti.md
   Script classico: usa window.sb, window.creditiOre.
   ============================================================ */

(function (radice) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const dataIt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
  const oggiIso = () => new Date().toLocaleDateString('sv-SE');
  const ore = (x) => (x == null ? '0' : String(Number(x)).replace('.', ','));
  const giorniA = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(oggiIso() + 'T00:00:00Z')) / 86400000);

  /* lo stato di un tecnico su un requisito: il conteggio a ore se le righe
     hanno il tipo, altrimenti la regola di sempre (l'ultima riga, la sua
     data di fine), come nella pagina «Documenti tecnici» della segreteria */
  function stato(req, suoi, origine, oggi) {
    const C = radice.creditiOre;
    if (!suoi.length) return { classe: 'mancante', testo: 'nessun documento registrato' };
    const s = C && C.statoConOre(req, suoi, oggi, origine);
    if (s) return { ...s, dettaglio: C.dettaglioOre(s, dataIt) };
    const doc = [...suoi].sort((a, b) => String(b.data_inizio || b.data_fine || '').localeCompare(String(a.data_inizio || a.data_fine || '')))[0];
    if (doc.senza_scadenza) return { classe: 'ok', testo: 'senza scadenza', doc };
    if (!doc.data_fine) return { classe: 'senzadata', testo: 'senza data di scadenza', doc };
    const g = giorniA(doc.data_fine);
    return { classe: g < 0 ? 'scaduto' : g <= (req.preavviso_giorni || 60) ? 'scade' : 'ok', scadenza: doc.data_fine, doc };
  }

  const ETICHETTA = { ok: 'In regola', scade: 'Da programmare', scaduto: 'Non in regola', senzadata: 'Da completare', mancante: 'Mancante' };
  const PILL = { ok: 'ok', scade: 'ap', scaduto: 'da', senzadata: 'ap', mancante: 'da' };

  function calcola(dati) {
    const oggi = oggiIso();
    const reqOre = (dati.requisiti || []).filter((r) => radice.creditiOre && radice.creditiOre.requisitoAOre(r));
    return (dati.tecnici || []).map((t) => {
      const suoiDi = (id) => (dati.documenti || []).filter((d) => d.tecnico_id === t.tecnico_id && d.requisito_id === id);
      const origini = {};
      reqOre.forEach((r) => { if (r.origine_requisito_id) origini[r.origine_requisito_id] = suoiDi(r.origine_requisito_id); });
      return {
        t,
        origini,
        /* UNI 11751-2 solo per gli asseveratori; le loro verifiche (app
           asseverazione) entrano come righe «verifica» (18/11/2026) */
        voci: reqOre.filter((r) => r.per_chi !== 'asseveratori' || t.asseveratore).map((r) => {
          const suoi = suoiDi(r.id);
          if ((r.verifiche_soglia || r.affiancamento_giorni_soglia) && suoi.length) {
            suoi.push(...(dati.verifiche || []).filter((v) => v.tecnico_id === t.tecnico_id && v.data)
              .map((v) => ({ tipo: 'verifica', tecnico_id: v.tecnico_id, requisito_id: r.id, data_inizio: v.data, gu: v.gu, giornate: v.giornate, ruolo: v.ruolo, rgv: v.rgv, pratica: v.pratica, tipo_pratica: v.tipo })));
          }
          return { r, suoi, s: stato(r, suoi, r.origine_requisito_id ? suoiDi(r.origine_requisito_id) : [], oggi) };
        }),
      };
    });
  }

  function riga(v) {
    const s = v.s;
    const fino = s.classe === 'scaduto' && s.scadenza ? `dal ${dataIt(s.scadenza)}` : s.scadenza ? `fino al ${dataIt(s.scadenza)}` : '';
    return `<span class="doc-pill ${PILL[s.classe] || 'ap'}">${esc(ETICHETTA[s.classe] || s.classe)}${fino ? ' ' + esc(fino) : ''}</span>`;
  }

  const STATO_INVIO = {
    da_verificare: ['ap', 'In attesa della segreteria: non conta ancora nelle ore'],
    confermato: ['ok', 'Confermato dalla segreteria'],
    rifiutato: ['da', 'Non accettato'],
  };

  /* ── il modulo con cui il tecnico carica un attestato ── */
  let _dati = null, _host = null, _scelto = null, _inviando = false;
  const TIPO_TESTO = {
    attestato: 'Attestato di qualifica (il corso iniziale)',
    aggiornamento: 'Aggiornamento (corso, seminario, convegno)',
    docenza: 'Docenza (ore che hai insegnato)',
  };
  const ORE_TESTO = {
    attestato: 'Ore del corso (facoltative)',
    aggiornamento: 'Ore che valgono (i crediti scritti sull’attestato, se ci sono; altrimenti le ore frequentate)',
    docenza: 'Ore di docenza',
  };
  function tipiPer(r) {
    if (!(Number(r.ore_soglia) > 0)) return ['attestato'];
    return r.docenza_alternativa ? ['aggiornamento', 'docenza', 'attestato'] : ['aggiornamento', 'attestato'];
  }
  function formCarica(req) {
    const r = req.find((x) => x.id === _scelto) || req.find((x) => Number(x.ore_soglia) > 0) || req[0];
    if (!r) return '';
    const tipi = tipiPer(r);
    return `<div class="doc-q"><strong>📤 Carica un attestato che manca</strong>
      <p class="doc-piccolo">Il file va nel tuo fascicolo e la segreteria lo controlla sul documento: conta nelle ore quando lo conferma. Un attestato alla volta.</p>
      <div class="doc-form">
        <label>Per quale requisito<select id="cr-req">${req.map((x) => `<option value="${x.id}"${x.id === r.id ? ' selected' : ''}>${esc(x.descrizione)}</option>`).join('')}</select></label>
        <label>Che cos’è<select id="cr-tipo">${tipi.map((t) => `<option value="${t}">${esc(TIPO_TESTO[t])}</option>`).join('')}</select></label>
        <label>Data del corso (l’ultimo giorno, se erano più giornate)<input type="date" id="cr-data" max="${oggiIso()}"></label>
        <label>Titolo del corso<input id="cr-titolo" maxlength="200" placeholder="Es. Aggiornamento coordinatori, rischio elettrico"></label>
        <label>Ente che l’ha organizzato<input id="cr-ente" maxlength="200" placeholder="Es. Ordine degli Ingegneri di Padova"></label>
        <label><span id="cr-ore-t">${esc(ORE_TESTO[tipi[0]])}</span><input type="number" id="cr-ore" min="0.5" max="400" step="0.5"></label>
        ${Number(r.ore_soglia_corsi) > 0 ? '<label id="cr-corso-l">Di queste, ore in corsi di aggiornamento (non seminari o convegni)<input type="number" id="cr-corso" min="0" step="0.5"></label>' : ''}
        <label>Nota per la segreteria (facoltativa)<textarea id="cr-nota" rows="2" maxlength="1000"></textarea></label>
        <label>Attestato (PDF, JPG o PNG, al massimo 10 MB)<input type="file" id="cr-file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"></label>
        <div><button type="button" class="doc-btn pieno" id="cr-invia" data-aiuto="Il file va nel tuo fascicolo su Drive e la segreteria lo controlla: finché non lo conferma, le ore non contano.">📤 Invia alla segreteria</button> <span id="cr-esito" class="doc-piccolo"></span></div>
      </div></div>`;
  }
  function adatta() {
    const tipo = document.getElementById('cr-tipo');
    if (!tipo) return;
    const corsoL = document.getElementById('cr-corso-l'), oreT = document.getElementById('cr-ore-t');
    if (corsoL) corsoL.style.display = tipo.value === 'aggiornamento' ? '' : 'none';
    if (oreT) oreT.textContent = ORE_TESTO[tipo.value] || '';
  }
  const leggiFile = (file) => new Promise((ok, ko) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1] || '');
    fr.onerror = () => ko(new Error('file non letto'));
    fr.readAsDataURL(file);
  });
  /* i controlli prima dell'invio: '' = va bene, altrimenti il motivo */
  function controlla(v, oggi) {
    if (!v.requisito_id) return 'Scegli il requisito.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data_inizio || '')) return 'Scrivi la data del corso.';
    if (v.data_inizio > (oggi || oggiIso())) return 'La data è nel futuro.';
    if ((v.descrizione || '').length < 3) return 'Scrivi il titolo del corso.';
    if (v.tipo !== 'attestato' && !(v.ore > 0)) return 'Scrivi le ore che valgono.';
    if (v.ore_di_corso != null && v.ore != null && v.ore_di_corso > v.ore) return 'Le ore in corsi non possono superare le ore.';
    if (!v.file) return 'Scegli il file dell’attestato.';
    if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(v.file.type || '')) return 'Si caricano PDF, JPG o PNG.';
    if (v.file.size > 10 * 1024 * 1024) return 'Il file supera 10 MB.';
    return '';
  }
  async function invia() {
    if (_inviando) return;
    const val = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
    const num = (id) => (val(id) === '' ? null : Number(val(id)));
    const fileEl = document.getElementById('cr-file');
    const v = {
      requisito_id: Number(val('cr-req')), tipo: val('cr-tipo'), data_inizio: val('cr-data'),
      descrizione: val('cr-titolo').trim(), ente: val('cr-ente').trim(), nota: val('cr-nota').trim(),
      ore: num('cr-ore'), ore_di_corso: val('cr-tipo') === 'aggiornamento' ? num('cr-corso') : null,
      file: fileEl && fileEl.files ? fileEl.files[0] : null,
    };
    const esito = document.getElementById('cr-esito');
    const dici = (t, ko) => { if (esito) { esito.textContent = t; esito.style.color = ko ? '#c0392b' : ''; } };
    const errore = controlla(v);
    if (errore) { dici(errore, true); return; }
    _inviando = true;
    const btn = document.getElementById('cr-invia');
    if (btn) btn.disabled = true;
    dici('Invio in corso…');
    try {
      const body = {
        requisito_id: v.requisito_id, tipo: v.tipo, data_inizio: v.data_inizio, descrizione: v.descrizione,
        ente: v.ente, nota: v.nota, ore: v.ore, ore_di_corso: v.ore_di_corso,
        nome_file: v.file.name, mime_type: v.file.type, base64: await leggiFile(v.file),
      };
      const { data, error } = await radice.sb.functions.invoke('crediti-attestato', { body });
      let msg = '';
      if (error) {
        msg = error.message || 'errore';
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_e) { /* niente */ }
      } else if (!data || !data.ok) msg = (data && data.error) || 'nessuna risposta dal server';
      /* «inviato» solo se il server ha detto ok: altrimenti si dice che non è partito */
      if (msg) { dici('Non inviato: ' + msg, true); return; }
      _scelto = null;
      await box(_host, 'Inviato alla segreteria: ' + data.nome_file + '. Conta nelle ore quando la segreteria lo conferma.');
    } catch (e) {
      dici('Non inviato: ' + (e.message || e), true);
    } finally {
      _inviando = false;
      if (btn) btn.disabled = false;
    }
  }
  /* ⬇️ Scarica: la funzione controlla di chi è la riga e consegna il file;
     qui diventa un download col suo nome. Un errore si dice, non si tace. */
  async function scaricaDoc(btn) {
    const [tipo, id] = String(btn.dataset.crScarica || '').split(':');
    if (!id || btn.disabled) return;
    const testo = btn.textContent;
    btn.disabled = true; btn.textContent = 'Scarico…';
    try {
      const body = tipo === 'invio' ? { azione: 'scarica', invio_id: Number(id) }
        : tipo === 'iscr' ? { azione: 'scarica', iscrizione_id: Number(id) } : { azione: 'scarica', doc_id: Number(id) };
      const { data, error } = await radice.sb.functions.invoke('crediti-attestato', { body });
      let msg = '';
      if (error) {
        msg = error.message || 'errore';
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_e) { /* niente */ }
      } else if (!data || !data.ok || !data.base64) msg = (data && data.error) || 'nessuna risposta dal server';
      if (msg) { btn.textContent = 'Non scaricato'; btn.title = msg; alertoFallito(btn, msg); return; }
      const bin = atob(data.base64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([u8], { type: data.mime || 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = data.nome || 'documento'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      btn.textContent = testo;
    } catch (e) {
      btn.textContent = 'Non scaricato'; alertoFallito(btn, e.message || String(e));
    } finally {
      btn.disabled = false;
    }
  }
  function alertoFallito(btn, msg) {
    let n = btn.parentElement && btn.parentElement.querySelector('.cr-errore');
    if (!n && btn.parentElement) { n = document.createElement('div'); n.className = 'doc-piccolo cr-errore'; n.style.color = '#c0392b'; btn.parentElement.appendChild(n); }
    if (n) n.textContent = msg;
  }

  function aggancia(host) {
    if (host.dataset.crAgganciato) return;
    host.dataset.crAgganciato = '1';
    host.addEventListener('change', (ev) => {
      if (ev.target.id === 'cr-req') {
        _scelto = Number(ev.target.value);
        const modulo = host.querySelector('#cr-modulo');
        if (modulo && _dati) { modulo.innerHTML = formCarica(_dati.requisiti || []); adatta(); }
      } else if (ev.target.id === 'cr-tipo') adatta();
    });
    host.addEventListener('click', (ev) => {
      if (!ev.target.closest) return;
      if (ev.target.closest('#cr-invia')) invia();
      const s = ev.target.closest('[data-cr-scarica]');
      if (s) scaricaDoc(s);
    });
  }

  /* ── veste «Tessere» (scelta dall'utente il 18/11/2026, proposta A in
     proposte_grafiche/2026_11_18_crediti-formativi/) ── */
  const STILE = `
.cr-griglia{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-top:10px}
.cr-due{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-top:10px}
.cr-tessera{background:#fff;border:1px solid #e3e4e6;border-left:4px solid #e3e4e6;border-radius:8px;padding:12px 14px;min-width:0}
.cr-tessera.s-ok{border-left-color:#2e7d32}.cr-tessera.s-ap{border-left-color:#c79a00}.cr-tessera.s-da{border-left-color:#c0392b}
.cr-tessera h4{margin:0 0 6px;font-size:16px}
.cr-voce{display:grid;gap:4px;margin-top:10px}
.cr-etich{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b717b}
.cr-riga{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cr-barra{flex:1;min-width:110px;height:8px;border-radius:4px;background:#eceef0;position:relative;overflow:hidden}
.cr-barra>i{position:absolute;inset:0 auto 0 0;border-radius:4px;background:#6b717b}
.cr-barra.ok>i{background:#2e7d32}.cr-barra.ap>i{background:#c79a00}.cr-barra.da>i{background:#c0392b}
.cr-num{font-variant-numeric:tabular-nums}
.cr-manca{border-top:1px dashed #e3e4e6;margin-top:8px;padding-top:8px}
.cr-tab{overflow-x:auto;margin-top:6px}
.cr-tab table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:14px}
.cr-tab th{text-align:left;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6b717b;padding:6px 8px;border-bottom:1px solid #e3e4e6}
.cr-tab td{padding:7px 8px;border-bottom:1px solid #eee;vertical-align:top}
.cr-tab tr.cr-chiuso td{color:#8a9099}
.cr-tit{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between;margin-top:16px}
#cr-modulo .doc-form label{min-width:0}
#cr-modulo .doc-form input,#cr-modulo .doc-form select,#cr-modulo .doc-form textarea{width:100%;max-width:100%;min-width:0;box-sizing:border-box}`;
  function stile() {
    if (typeof document === 'undefined' || document.getElementById('cr-stile')) return;
    const s = document.createElement('style'); s.id = 'cr-stile'; s.textContent = STILE; document.head.appendChild(s);
  }
  const GRAVITA = { scaduto: 0, mancante: 1, scade: 2, senzadata: 3, ok: 4 };
  const BORDO = { ok: 'ok', scade: 'ap', senzadata: 'ap', scaduto: 'da', mancante: 'da' };
  const peggiore = (voci) => voci.reduce((m, v) => (GRAVITA[v.s.classe] ?? 9) < (GRAVITA[m] ?? 9) ? v.s.classe : m, 'ok');
  const nomeBreve = (r) => (/coord/i.test(r.codice || r.descrizione) ? 'Coordinatore' : /formator/i.test(r.codice || r.descrizione) ? 'Formatore'
    : /11751/.test(r.codice || r.descrizione || '') ? 'Tecnico verificatore' : (r.breve || r.descrizione));
  const giorniTesto = (iso) => { const g = giorniA(iso); return g >= 0 ? ` (fra ${g} ${g === 1 ? 'giorno' : 'giorni'})` : ''; };
  function barra(s) {
    if (!(Number(s.soglia) > 0)) return '';
    const p = Math.min(100, Math.round((Number(s.ore) || 0) / Number(s.soglia) * 100));
    return `<div class="cr-riga"><div class="cr-barra ${PILL[s.classe] || ''}" role="img" aria-label="${ore(s.ore)} ore su ${ore(s.soglia)}"><i style="width:${p}%"></i></div><span class="cr-num doc-piccolo">${ore(s.ore)}/${ore(s.soglia)} ore</span></div>`;
  }
  /* che cosa manca, detto in una frase (solo quando c'è una data davanti) */
  function manca(s) {
    if (s.classe === 'senzadata' && s.affiancamento_soglia) {
      return `<div class="cr-manca"><b>Ti mancano ${ore(Math.max(0, s.affiancamento_soglia - s.affiancamento))} giorni di affiancamento</b> per diventare operativo come tecnico verificatore (UNI 11751-2): contano le giornate da osservatore nei gruppi di verifica.</div>`;
    }
    if (s.classe !== 'scade' || !s.scadenza) return '';
    const pezzi = [];
    if (s.manca > 0) pezzi.push(`${ore(s.manca)} ore${s.docenza_alternativa ? ' (oppure ' + ore(s.soglia) + ' ore di docenza)' : ''}`);
    if (s.manca_verifiche > 0) pezzi.push(`${s.manca_verifiche} ${s.manca_verifiche === 1 ? 'verifica' : 'verifiche'} di asseverazione`);
    if (s.manca_gu > 0) pezzi.push(`${ore(s.manca_gu)} g/u di verifica`);
    if (!pezzi.length) return '';
    return `<div class="cr-manca"><b>Mancano ${esc(pezzi.join(' e '))} entro il ${esc(dataIt(s.scadenza))}</b>${esc(giorniTesto(s.scadenza))}.</div>`;
  }
  function voce(v, grande) {
    return `<div class="cr-voce"><div class="cr-riga"><span class="cr-etich">${esc(nomeBreve(v.r))}</span> ${riga(v)}</div>
      ${barra(v.s)}<div class="doc-piccolo">${esc(v.s.dettaglio || v.s.testo || '')}</div>${grande ? manca(v.s) : ''}</div>`;
  }

  /* fino a quando conta un documento: per il coordinatore cinque anni dalla
     data (i corsi prima dell'abilitazione non contano), per il formatore la
     fine del triennio in cui cade. Il recupero di un triennio chiuso non si
     mostra riga per riga: lo dice la frase del requisito. */
  function contaFino(r, s, d) {
    const C = radice.creditiOre, D = Number(r.durata_mesi) || 0, B = s && s.doc && s.doc.data_inizio;
    if (!C || !D || !B || !d.data_inizio || d.tipo === 'attestato') return { testo: '—' };
    if (d.data_inizio < B) return { testo: 'prima dell’abilitazione: non conta', chiuso: true };
    if (r.periodo_mobile) {
      const f = C.aggiungiMesiIso(d.data_inizio, D);
      return f < oggiIso() ? { testo: `contava fino al ${dataIt(f)}`, chiuso: true } : { testo: `fino al ${dataIt(f)}` };
    }
    let fine = C.aggiungiMesiIso(B, D), giri = 0;
    while (fine <= d.data_inizio && giri++ < 60) fine = C.aggiungiMesiIso(fine, D);
    return fine < oggiIso() ? { testo: `triennio chiuso il ${dataIt(fine)}`, chiuso: true } : { testo: `fino al ${dataIt(fine)}` };
  }
  function elencoDocumenti(x, invii, req) {
    /* (18/11/2026) il file sta sul Drive dell'ufficio, che il tecnico non apre:
       lo consegna la funzione crediti-attestato dopo aver controllato di chi è */
    const scarica = (chiave) => `<button type="button" class="doc-btn" data-cr-scarica="${esc(chiave)}" data-aiuto="Scarica il file sul tuo dispositivo: lo prende dal fascicolo in ufficio.">⬇️ Scarica</button>`;
    const apri = (d) => (d && d.ha_file && d.id ? scarica('doc:' + d.id) : '');
    const basi = [];
    /* lo stesso corso registrato per due requisiti è UNA riga, con una
       colonna «conta» per requisito */
    const corsi = new Map();
    for (const v of x.voci) {
      const orig = v.r.origine_requisito_id ? (x.origini[v.r.origine_requisito_id] || []) : [];
      for (const d of [...v.suoi, ...orig]) {
        if (d.tipo === 'verifica') continue;   // le verifiche hanno la loro tabella
        if (d.tipo === 'aggiornamento' || d.tipo === 'docenza') {
          const k = `${d.data_inizio}|${d.tipo}|${d.descrizione || ''}`;
          if (!corsi.has(k)) corsi.set(k, { d, per: {} });
          const c = corsi.get(k);
          c.per[v.r.id] = contaFino(v.r, v.s, d);
          if (!c.d.ha_file && d.ha_file) c.d = d;   // si scarica dalla riga che ha il file
        } else if (!basi.some((b) => b.d === d)) basi.push({ d, v });
      }
    }
    const righe = [...corsi.values()].sort((a, b) => String(b.d.data_inizio || '').localeCompare(String(a.d.data_inizio || '')));
    righe.forEach((r) => { r.chiuso = x.voci.every((v) => !r.per[v.r.id] || r.per[v.r.id].chiuso); });
    basi.sort((a, b) => String(b.d.data_inizio || '').localeCompare(String(a.d.data_inizio || '')));
    const attesa = invii.filter((i) => i.stato !== 'confermato');
    const nomeReq = (id) => nomeBreve(req.find((r) => r.id === id) || {});
    const colonne = x.voci.map((v) => `<th>${esc(nomeBreve(v.r))}: conta</th>`).join('');
    const riga1 = (r) => `<tr${r.chiuso ? ' class="cr-chiuso"' : ''}><td>${esc(dataIt(r.d.data_inizio))}</td><td>${esc(r.d.descrizione || (r.d.tipo === 'docenza' ? 'Docenza' : 'Aggiornamento'))}${r.d.tipo === 'docenza' ? ' <span class="doc-pill ap">docenza</span>' : ''}</td><td>${ore(r.d.ore)}</td>${x.voci.map((v) => `<td>${r.per[v.r.id] ? esc(r.per[v.r.id].testo) : '—'}</td>`).join('')}<td>${apri(r.d)}</td></tr>`;
    const testa = `<thead><tr><th>Data</th><th>Corso o docenza</th><th>Ore</th>${colonne}<th></th></tr></thead>`;
    const tBasi = basi.length ? `<div class="cr-tab"><table><thead><tr><th>Data</th><th>Attestato di base</th><th>Per</th><th></th></tr></thead><tbody>
      ${basi.map(({ d, v }) => `<tr><td>${esc(dataIt(d.data_inizio))}</td><td>${esc(d.descrizione || 'Attestato')}</td><td>${esc(nomeBreve(v.r))}</td><td>${apri(d)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const vivi = righe.filter((r) => !r.chiuso), chiusi = righe.filter((r) => r.chiuso);
    const tRighe = (vivi.length || attesa.length) ? `<div class="cr-tab"><table>${testa}<tbody>
      ${attesa.map((i) => { const [cl, tx] = STATO_INVIO[i.stato] || ['ap', i.stato]; return `<tr><td>${esc(dataIt(i.data_inizio))}</td><td>${esc(i.descrizione)} <span class="doc-piccolo">(${esc(nomeReq(i.requisito_id))})</span></td><td>${i.ore ? ore(i.ore) : '—'}</td><td colspan="${x.voci.length}"><span class="doc-pill ${cl}">${esc(tx)}</span>${i.stato === 'rifiutato' && i.motivo ? `<div class="doc-piccolo">Motivo: ${esc(i.motivo)}</div>` : ''}</td><td>${scarica('invio:' + i.id)}</td></tr>`; }).join('')}
      ${vivi.map(riga1).join('')}</tbody></table></div>` : '<p class="doc-piccolo">Nessun corso che conta adesso.</p>';
    const tChiusi = chiusi.length ? `<details class="doc-prec"><summary>Documenti che non contano più (${chiusi.length})</summary><div class="cr-tab"><table>${testa}<tbody>${chiusi.map(riga1).join('')}</tbody></table></div></details>` : '';
    /* verifiche di asseverazione (tecnico verificatore UNI 11751-2), dall'app asseverazione */
    const verifiche = [...new Map(x.voci.flatMap((v) => v.suoi.filter((d) => d.tipo === 'verifica')).map((d) => [d.pratica + '|' + d.data_inizio, d])).values()]
      .sort((a, b) => String(b.data_inizio).localeCompare(String(a.data_inizio)));
    const oggi = oggiIso();
    const tVer = verifiche.length ? `<div class="cr-tit"><strong>Verifiche di asseverazione</strong> <span class="doc-piccolo">dall'app asseverazione</span></div>
      <div class="cr-tab"><table><thead><tr><th>Data</th><th>Pratica</th><th>Tipo</th><th>Ruolo</th><th>Tue giornate</th><th>g/u della pratica</th></tr></thead><tbody>
      ${verifiche.map((d) => `<tr${d.data_inizio > oggi ? ' class="cr-chiuso"' : ''}><td>${esc(dataIt(d.data_inizio))}${d.data_inizio > oggi ? ' (in programma)' : ''}</td><td>${esc(d.pratica || '')}</td><td>${esc(d.tipo_pratica || '')}</td><td>${esc(d.ruolo || '')}${d.rgv ? ' (RGV)' : ''}</td><td>${d.giornate != null ? ore(d.giornate) : '—'}</td><td>${d.gu != null ? ore(d.gu) : '—'}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="doc-piccolo">Tecnico verificatore: per diventare operativo servono 10 giorni da osservatore (contano anche quelli prima dell’attestato); poi, in ogni triennio, almeno 3 verifiche (anche mantenimenti, anche da osservatore) per 6 g/u in tutto e 16 ore di aggiornamento su MOG, SGSL e audit.</p>` : '';
    if (!tBasi && !righe.length && !attesa.length && !tVer) return '<p class="doc-piccolo">Nessun documento registrato.</p>';
    return `${tBasi}${tRighe}${tChiusi}${tVer}<p class="doc-piccolo">Coordinatore: ogni corso conta cinque anni dalla sua data, e quelli prima dell’abilitazione non contano. Formatore: un corso conta fino alla fine del triennio in cui cade.</p>`;
  }

  function cartaMia(x, dati, messaggio) {
    const req = dati.requisiti || [];
    const invii = (dati.invii || []).filter((i) => i.tecnico_id === x.t.tecnico_id);
    const tessere = x.voci.map((v) => `<div class="cr-tessera s-${BORDO[v.s.classe] || ''}">${voce(v, true)}</div>`).join('');
    return `<div class="doc-card doc-pannello"><h3>🎓 I tuoi aggiornamenti obbligatori</h3>
      <p class="doc-piccolo">Coordinatore: 40 ore di aggiornamento negli ultimi cinque anni, dopo i primi cinque dal corso da 120 ore. Formatore: 24 ore ogni tre anni, di cui almeno 8 in corsi, oppure 24 ore di docenza. La segreteria tiene il conto e ti avvisa prima che le ore non bastino più.</p>
      ${messaggio ? `<p class="doc-piccolo" style="color:#2e7d32"><b>${esc(messaggio)}</b></p>` : ''}
      ${tessere ? `<div class="cr-due">${tessere}</div>` : '<p class="doc-piccolo">Nessun requisito da seguire.</p>'}
      <div class="cr-tit"><strong>I tuoi documenti</strong></div>
      ${elencoDocumenti(x, invii, req)}
      <div id="cr-modulo">${formCarica(req)}</div></div>
      ${contrattoPolizze(dati)}
      ${attestatiEmessi(dati)}`;
  }

  /* ── contratto e polizze (18/11/2026, chiesto dall'utente) ──
     Solo al tecnico per sé: i requisiti a scadenza del catalogo con lo stato
     calcolato come nella pagina «Documenti tecnici» della segreteria
     (statoScadenza, regola condivisa) e l'elenco delle sue righe, la più
     recente in vista e le precedenti chiuse. */
  const NOME_SCAD = { ok: 'In regola', scade: 'In scadenza', scaduto: 'Scaduto', senzadata: 'Senza data', mancante: 'Mancante' };
  function contrattoPolizze(dati) {
    const C = radice.creditiOre;
    const req = dati.altri_requisiti || [];
    if (!req.length || !C || !C.statoScadenza) return '';
    const oggi = oggiIso();
    const tessere = req.map((r) => {
      const suoi = (dati.altri_documenti || []).filter((d) => d.requisito_id === r.id);
      const s = C.statoScadenza(r, suoi, oggi);
      const quando = s.senza_scadenza ? 'senza scadenza'
        : s.una_tantum ? (s.doc && s.doc.data_inizio ? `dal ${dataIt(s.doc.data_inizio)}` : '')
          : s.scadenza ? `${s.classe === 'scaduto' ? 'il' : 'fino al'} ${dataIt(s.scadenza)}` : '';
      const pill = `<span class="doc-pill ${PILL[s.classe] || 'ap'}">${esc(NOME_SCAD[s.classe] || s.classe)}${quando ? ' ' + esc(quando) : ''}</span>`;
      const nota = s.tacito ? 'Rinnovo tacito: si rinnova da solo ogni anno finché nessuno lo disdice.'
        : s.classe === 'scade' ? `Scade${giorniTesto(s.scadenza)}: manda alla segreteria la polizza o la quietanza nuova.`
          : s.classe === 'scaduto' ? 'Manda alla segreteria il documento in corso di validità.'
            : s.classe === 'senzadata' ? 'Sul documento registrato manca la data di scadenza: la segreteria la verifica.'
              : s.classe === 'mancante' ? 'Nessun documento registrato.' : '';
      const riga = (d) => `<tr><td>${esc(d.data_inizio ? dataIt(d.data_inizio) : '—')}</td><td>${esc(d.data_fine ? dataIt(d.data_fine) : (d.senza_scadenza ? 'senza scadenza' : '—'))}</td><td>${esc(d.descrizione || '')}${d.disdetto_il ? ` <span class="doc-pill da">disdetto il ${esc(dataIt(d.disdetto_il))}</span>` : ''}${d.protocollo_txt ? ` <span class="doc-piccolo">Prot. ${esc(d.protocollo_txt)}</span>` : ''}</td><td>${d.ha_file && d.id ? `<button type="button" class="doc-btn" data-cr-scarica="doc:${d.id}" data-aiuto="Scarica il file sul tuo dispositivo: lo prende dal fascicolo in ufficio.">⬇️ Scarica</button>` : ''}</td></tr>`;
      const testa = '<thead><tr><th>Dal</th><th>Al</th><th>Documento</th><th></th></tr></thead>';
      const [primo, ...prima] = suoi;
      return `<div class="cr-tessera s-${BORDO[s.classe] || ''}">
        <div class="cr-riga"><span class="cr-etich">${esc(r.breve || r.descrizione)}</span> ${pill}</div>
        ${nota ? `<div class="doc-piccolo" style="margin-top:4px">${esc(nota)}</div>` : ''}
        ${primo ? `<div class="cr-tab"><table>${testa}<tbody>${riga(primo)}</tbody></table></div>` : ''}
        ${prima.length ? `<details class="doc-prec"><summary>Precedenti (${prima.length})</summary><div class="cr-tab"><table>${testa}<tbody>${prima.map(riga).join('')}</tbody></table></div></details>` : ''}
      </div>`;
    }).join('');
    return `<div class="doc-card doc-pannello"><h3>📑 Il tuo contratto e le tue polizze</h3>
      <p class="doc-piccolo">Quello che risulta in segreteria, con le scadenze. Le polizze si consegnano in ufficio (contratto, art. 5): quando ne rinnovi una, manda alla segreteria la polizza o la quietanza nuova. Se qualcosa non torna, scrivi alla segreteria.</p>
      <div class="cr-due">${tessere}</div></div>`;
  }

  /* ── attestati rilasciati da FORMEDIL PADOVA (18/11/2026, chiesto dall'utente) ──
     Convegni, seminari, corsi a cui il tecnico ha partecipato (iscrizioni con
     esito «presente» in s_corsi_iscritti). Il PDF si scarica dove è collegato;
     il collegamento lo cerca crediti-attestato (collega_attestati) in
     attestati_emessi/<anno>/, al più una volta a settimana da questo browser. */
  const TIPO_EVENTO = { corso: 'Corso', convegno: 'Convegno', seminario: 'Seminario', conferenza: 'Conferenza' };
  function attestatiEmessi(dati) {
    const a = dati.attestati_emessi || [];
    if (!a.length) return '';
    const data = (x) => x.attestato_data || x.data_fine || x.data_inizio;
    const riga = (x) => `<tr><td>${esc(dataIt(data(x)))}</td><td>${esc(x.titolo || '')} <span class="doc-piccolo">${esc(TIPO_EVENTO[x.tipo] || x.tipo || '')}</span></td><td>${x.ore_frequentate != null ? ore(x.ore_frequentate) : x.durata_ore != null ? ore(x.durata_ore) : '—'}</td><td>${esc(x.attestato_numero && /\//.test(x.attestato_numero) ? 'n. ' + x.attestato_numero : x.attestato_numero ? 'Prot. ' + x.attestato_numero : '')}</td><td>${x.ha_file ? `<button type="button" class="doc-btn" data-cr-scarica="iscr:${x.id}" data-aiuto="Scarica il PDF dell’attestato che ti abbiamo rilasciato.">⬇️ Scarica</button>` : '<span class="doc-piccolo">PDF non in archivio</span>'}</td></tr>`;
    const testa = '<thead><tr><th>Data</th><th>Evento</th><th>Ore</th><th>Numero</th><th></th></tr></thead>';
    const primi = a.slice(0, 8), altri = a.slice(8);
    return `<div class="doc-card doc-pannello"><h3>🏅 Attestati che ti abbiamo rilasciato</h3>
      <p class="doc-piccolo">Corsi, convegni e seminari di FORMEDIL PADOVA a cui risulti presente. Quelli che valgono come aggiornamento sono anche nel conto qui sopra; se ne manca uno, scrivi alla segreteria.</p>
      <div class="cr-tab"><table>${testa}<tbody>${primi.map(riga).join('')}</tbody></table></div>
      ${altri.length ? `<details class="doc-prec"><summary>Precedenti (${altri.length})</summary><div class="cr-tab"><table>${testa}<tbody>${altri.map(riga).join('')}</tbody></table></div></details>` : ''}</div>`;
  }
  /* una volta a settimana per browser: si cercano i PDF degli attestati non
     ancora collegati; se ne trova, si ridisegna il riquadro */
  async function collegaAttestati(host, dati) {
    const manca = (dati.attestati_emessi || []).some((x) => !x.ha_file);
    if (!manca) return;
    const chiave = 'cr-collega-' + ((dati.tecnici || [])[0] || {}).tecnico_id;
    try { const v = Number(localStorage.getItem(chiave) || 0); if (Date.now() - v < 7 * 86400000) return; } catch (_e) { /* niente */ }
    const { data, error } = await radice.sb.functions.invoke('crediti-attestato', { body: { azione: 'collega_attestati' } });
    if (error || !data || !data.ok) return;   // riprova la prossima volta
    try { localStorage.setItem(chiave, String(Date.now())); } catch (_e) { /* niente */ }
    if (data.collegati > 0) await box(host);
  }

  function tabella(lista) {
    const ordinati = [...lista].sort((a, b) => (GRAVITA[peggiore(a.voci)] ?? 9) - (GRAVITA[peggiore(b.voci)] ?? 9)
      || String(a.t.tecnico_cognome || '').localeCompare(String(b.t.tecnico_cognome || '')));
    const tessere = ordinati.map((x) => `<div class="cr-tessera s-${BORDO[peggiore(x.voci)] || ''}">
      <h4>${esc(`${x.t.tecnico_cognome || ''} ${x.t.tecnico_nome || ''}`.trim())}</h4>
      ${x.voci.map((v) => voce(v, false)).join('')}</div>`).join('');
    return `<div class="doc-card doc-pannello"><h3>🎓 Aggiornamenti obbligatori dei tecnici</h3>
      <p class="doc-piccolo">Sola lettura, prima chi ha bisogno. «Da programmare» vuol dire che entro sei mesi le ore non bastano più: la segreteria avvisa il tecnico. Gli attestati li carica ogni tecnico dalla sua pagina e li conferma la segreteria.</p>
      <div class="cr-griglia">${tessere}</div></div>`;
  }

  async function box(host, messaggio) {
    if (!host || !radice.sb) return;
    _host = host;
    host.innerHTML = '<div class="doc-card doc-piccolo">Carico gli aggiornamenti…</div>';
    const { data, error } = await radice.sb.rpc('crediti_formativi');
    if (error) { host.innerHTML = '<div class="doc-card doc-ko">Non sono riuscito a leggere gli aggiornamenti obbligatori: ' + esc(error.message) + '</div>'; return; }
    if (!radice.creditiOre) { host.innerHTML = '<div class="doc-card doc-ko">Il conteggio degli aggiornamenti non si è caricato: ricarica la pagina.</div>'; return; }
    const dati = data || {};
    if (dati.ruolo === 'nessuno' || !(dati.tecnici || []).length) { host.innerHTML = ''; return; }
    _dati = dati;
    stile();
    const lista = calcola(dati);
    if (dati.ruolo === 'tecnico') { host.innerHTML = cartaMia(lista[0], dati, messaggio); aggancia(host); adatta(); collegaAttestati(host, dati).catch(() => {}); }
    else host.innerHTML = tabella(lista);
  }

  const api = { box, calcola, stato, controlla, tipiPer, contaFino, cartaMia, tabella, contrattoPolizze, attestatiEmessi };
  radice.creditiFormativi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
