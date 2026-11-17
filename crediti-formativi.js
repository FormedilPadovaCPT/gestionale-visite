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
      return {
        t,
        voci: reqOre.map((r) => {
          const suoi = suoiDi(r.id);
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
  function elencoInvii(invii, req) {
    if (!invii.length) return '';
    const nomeReq = (id) => (req.find((r) => r.id === id) || {}).descrizione || '';
    return `<div class="doc-q"><strong>Attestati che hai caricato</strong>${invii.map((i) => {
      const [cl, tx] = STATO_INVIO[i.stato] || ['ap', i.stato];
      return `<div class="doc-riga"><span>${esc(dataIt(i.data_inizio))}</span><span>${esc(i.descrizione)} <span class="doc-piccolo">(${esc(nomeReq(i.requisito_id))}${i.ore ? `, ${ore(i.ore)} ore` : ''})</span></span>
        <span class="doc-pill ${cl}">${esc(tx)}</span>${i.stato === 'rifiutato' && i.motivo ? `<span class="doc-piccolo">Motivo: ${esc(i.motivo)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }

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
      if (ev.target.closest && ev.target.closest('#cr-invia')) invia();
    });
  }

  function cartaMia(x, dati, messaggio) {
    const blocchi = x.voci.map((v) => {
      const corsi = v.suoi.filter((d) => d.tipo === 'aggiornamento' || d.tipo === 'docenza')
        .sort((a, b) => String(b.data_inizio || '').localeCompare(String(a.data_inizio || '')))
        .map((d) => `<div class="doc-riga"><span>${esc(dataIt(d.data_inizio))}</span><span>${esc(d.descrizione || (d.tipo === 'docenza' ? 'Docenza' : 'Aggiornamento'))}</span><span class="doc-piccolo">${ore(d.ore)} ore${d.tipo === 'docenza' ? ' di docenza' : ''}</span>${/^https:\/\//.test(d.drive_url || '') ? `<a class="doc-btn" href="${esc(d.drive_url)}" target="_blank" rel="noopener">📄 Apri</a>` : ''}</div>`).join('');
      return `<div class="doc-q">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><strong>${esc(v.r.descrizione)}</strong> ${riga(v)}</div>
        ${v.s.dettaglio ? `<div class="doc-piccolo">${esc(v.s.dettaglio)}</div>` : v.s.testo ? `<div class="doc-piccolo">${esc(v.s.testo)}</div>` : ''}
        ${corsi ? `<details class="doc-prec"><summary>Corsi e docenze che contano</summary>${corsi}</details>` : ''}
      </div>`;
    }).join('');
    const req = dati.requisiti || [];
    const invii = (dati.invii || []).filter((i) => i.tecnico_id === x.t.tecnico_id);
    return `<div class="doc-card doc-pannello"><h3>🎓 I tuoi aggiornamenti obbligatori</h3>
      <p class="doc-piccolo">Coordinatore: 40 ore di aggiornamento negli ultimi cinque anni (dopo i primi cinque dal corso da 120 ore). Formatore: 24 ore ogni tre anni, di cui almeno 8 in corsi, oppure 24 ore di docenza. La segreteria tiene il conto e ti avvisa prima che le ore non bastino più. Se manca un corso che hai fatto, carica l’attestato qui sotto.</p>
      ${messaggio ? `<p class="doc-piccolo" style="color:#2e7d32"><b>${esc(messaggio)}</b></p>` : ''}
      ${blocchi || '<p class="doc-piccolo">Nessun requisito da seguire.</p>'}
      ${elencoInvii(invii, req)}
      <div id="cr-modulo">${formCarica(req)}</div></div>`;
  }

  function tabella(lista) {
    const reqOre = lista.length ? lista[0].voci.map((v) => v.r) : [];
    const testata = reqOre.map((r) => `<th>${esc(r.breve || r.descrizione)}</th>`).join('');
    const corpo = lista.map((x) => `<tr><td>${esc(`${x.t.tecnico_cognome || ''} ${x.t.tecnico_nome || ''}`.trim())}</td>${x.voci.map((v) => `<td>${riga(v)}<div class="doc-piccolo">${esc(v.s.dettaglio || v.s.testo || '')}</div></td>`).join('')}</tr>`).join('');
    return `<div class="doc-card doc-pannello"><h3>🎓 Aggiornamenti obbligatori dei tecnici</h3>
      <p class="doc-piccolo">Sola lettura. «Da programmare» vuol dire che entro sei mesi le ore non bastano più: la segreteria avvisa il tecnico. Gli attestati li carica ogni tecnico dalla sua pagina e li conferma la segreteria.</p>
      <div class="doc-tab"><table><thead><tr><th>Tecnico</th>${testata}</tr></thead><tbody>${corpo}</tbody></table></div></div>`;
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
    const lista = calcola(dati);
    if (dati.ruolo === 'tecnico') { host.innerHTML = cartaMia(lista[0], dati, messaggio); aggancia(host); adatta(); }
    else host.innerHTML = tabella(lista);
  }

  const api = { box, calcola, stato, controlla, tipiPer };
  radice.creditiFormativi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
