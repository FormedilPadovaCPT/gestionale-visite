/* ============================================================
   📚 FORMAZIONE — la pagina del responsabile del progetto formativo e
   dei docenti (13/10/2026, lotti 1 e 2 del fascicolo corso digitale)

   Progetto: 2_AREE/Formazione/2026_10_13_REL_Area-Sicurezza_fascicolo-
   corso-digitale_progetto-tecnico.md. Qui crescono, lotto dopo lotto:
     1. ✍️ Le mie firme: i documenti che aspettano la firma di chi è
        collegato — RPF, tecnico docente, docente esterno — letti e
        firmati con lo stesso riquadro del Presidente (firme.js).
     2. 📋 Tipologie di corso e scheda formativa: il catalogo (titolo,
        riferimento normativo, ore, validità, soglie) e la scheda della
        tipologia, versionata, coi campi della scheda dell'Ufficio Corsi
        uno per uno. La scrive l'RPF, o il docente a cui la delega; si
        salvano SOLO i campi cambiati (RPC scheda_salva); «Pronta» la
        passa alla segreteria, che la manda in firma (catena: delegato,
        poi RPF); il PDF lo disegna la funzione documenti-corso, la
        stessa per tutte e due le app.
     3. il progetto formativo dell'edizione e il verbale di verifica
        finale (lotto 3);
     5. la pagina del docente per il corso (lotto 5).

   Chi la vede: i tecnici (fra cui Balladore, RPF), i docenti esterni col
   ruolo «docente» (che non vedono nient'altro) e la segreteria. Chi è di
   sola lettura (Direzione, Consiglio) no.

   Script classico come direzione.js: usa window.sb, window.S,
   window.toast e window.firmeApp; espone window.formazione.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const S = () => window.S || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const email = () => String((S().user && S().user.email) || '').toLowerCase();

  /* ── le voci della scheda dell'Ufficio Corsi, una per una (modelli del 13/10/2026) ── */
  const VOCI = {
    requisiti_precorso: [
      ['lingua', 'Verifica obbligatoria della comprensione della lingua italiana (orale e scritta)'],
      ['propedeutica', 'Verifica dei requisiti di accesso: accertamento del completamento della formazione già effettuata e propedeutica al corso'],
      ['ruolo', 'Analisi del ruolo ricoperto o destinazione al ruolo futuro all\'interno dell\'organizzazione aziendale'],
      ['attrezzature', 'Verifica attrezzatura e spazi idonei'],
      ['dpi', 'Verifica utilizzo dei DPI necessari all\'attività proposta'],
    ],
    nai_bes: [
      ['lettura', 'Lettura del test in italiano da parte del formatore per facilitare la comprensione'],
      ['schede', 'Schede didattiche fornite in formato digitale'],
      ['orali', 'Verifiche orali e prove di recupero in itinere'],
    ],
    modalita: [
      ['presenza', 'In presenza in aula'],
      ['videoconferenza', 'Videoconferenza sincrona'],
      ['pratica', 'Spazi dedicati alla pratica'],
      ['no_elearning', 'Non è ammesso l\'e-learning (FAD asincrona) per questa tipologia di corso'],
    ],
    metodologie: [
      ['brainstorming', 'Brainstorming: raccolta libera e veloce di idee su un tema specifico'],
      ['frontale', 'Lezione frontale partecipata: esposizione dei contenuti alternata a momenti di interazione attiva'],
      ['simulazioni', 'Simulazioni e role play: i discenti interpretano ruoli specifici (operai, preposti, tecnici)'],
      ['counseling', 'Counseling (approccio metodologico): ascolto attivo ed empatia'],
      ['gruppi', 'Lavori di gruppo e analisi di casi reali accaduti in cantiere'],
      ['flipped', 'Flipped classroom: studio individuale anticipato dei contenuti'],
      ['altro', 'Altro:'],
    ],
    strumenti: [
      ['lim', 'LIM e maxi schermi per proiezioni'],
      ['computer', 'Computer, tablet'],
      ['filmati', 'Filmati, schede predisposte dal docente'],
      ['uscite', 'Uscite sul territorio'],
      ['presentazioni', 'Presentazioni predisposte da FORMEDIL'],
      ['simulatori', 'Eventuali simulatori, mezzi, attrezzatura specifica inerenti al settore edile'],
      ['schede', 'Schede didattiche di supporto'],
      ['altro', 'Altro:'],
    ],
    verifica: [
      ['sommativa', 'Verifica sommativa finale: test obbligatorio a risposta chiusa; superamento con almeno il 70% di esiti positivi'],
      ['colloquio', 'Colloquio orale di recupero in caso di esito negativo della prova scritta'],
      ['itinere', 'Valutazione in itinere: domande-chiave e brevi test rapidi'],
      ['gradimento', 'Valutazione del gradimento: questionario anonimo sulla qualità didattica, i materiali e le strutture'],
      ['autovalutazione', 'Autovalutazione del formatore: check-list o questionari sull\'efficacia della lezione'],
      ['altro', 'Altro:'],
    ],
  };
  const SEZIONI = [
    ['requisiti_precorso', 'Requisiti pre-corso'], ['nai_bes', 'Discenti NAI (nuovi arrivati in Italia) / BES'],
    ['modalita', 'Durata e modalità di erogazione'], ['metodologie', 'Metodologia didattica - strategia formativa'],
    ['strumenti', 'Strumenti'], ['verifica', 'Verifica di apprendimento - valutazione di gradimento'],
  ];
  const STATI = { bozza: 'bozza', pronta: 'pronta per la firma', in_firma: 'in firma', firmata: 'firmata (vigente)', superata: 'superata' };
  const TIPI_ATT = { partecipazione: 'Partecipazione', frequenza: 'Regolare frequenza', frequenza_verifica: 'Frequenza + verifica finale' };
  const MODALITA = { presenza: 'In presenza', videoconferenza: 'Videoconferenza sincrona', pratica: 'Spazi dedicati alla pratica', mista: 'Mista', elearning: 'E-learning (solo dove l\'Accordo lo ammette)' };

  let _R = null;
  async function ruoli() {
    const sb = window.sb;
    const chiedi = async (f) => { try { const { data, error } = await sb.rpc(f); return !error && data === true; } catch (_e) { return false; } };
    const [rpf, docente, segr] = await Promise.all(['is_rpf', 'is_docente', 'is_segreteria'].map(chiedi));
    _R = { rpf, docente, segr, tecnico: !!S().tecnico, capo: rpf || segr };
    return _R;
  }
  window.addEventListener('gestionale-logout', () => { _R = null; });

  /* ── finestra sovrapposta (come direzione.js) ── */
  function finestra(titolo, html, larga) {
    chiudi();
    const f = document.createElement('div');
    f.id = 'form-finestra';
    f.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9500;display:flex;align-items:center;justify-content:center;padding:12px';
    f.innerHTML = `<div style="background:#fff;border-radius:10px;max-width:${larga ? 960 : 760}px;width:100%;max-height:94vh;overflow:auto;border-top:5px solid #e7500f;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#222">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 6px;gap:10px;position:sticky;top:0;background:#fff;z-index:1">
        <strong style="font-size:16px;color:#565c66">${titolo}</strong>
        <button type="button" data-chiudi style="background:none;border:0;font-size:20px;cursor:pointer;color:#888" data-aiuto="Chiude la finestra senza salvare quello che non hai già salvato.">✕</button></div>
      <div style="padding:6px 18px 16px">${html}</div></div>`;
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-chiudi]')) chiudi(); });
    document.body.appendChild(f);
    return f;
  }
  function chiudi() { const f = $('form-finestra'); if (f) f.remove(); }
  const campo = (etichetta, html, nota) => `<div class="field" style="margin-bottom:8px"><label style="font-size:11.5px;color:#666;display:block;margin-bottom:2px">${etichetta}</label>${html}${nota ? `<div style="font-size:11px;color:#999;margin-top:2px">${nota}</div>` : ''}</div>`;
  const inp = (id, v, tipo = 'text', extra = '') => `<input id="${id}" type="${tipo}" value="${esc(v ?? '')}" ${extra} style="width:100%;font-size:13.5px">`;
  const area = (id, v, righe = 4) => `<textarea id="${id}" rows="${righe}" style="width:100%;font-size:13.5px;line-height:1.4">${esc(v ?? '')}</textarea>`;

  /* ── carica ── */
  async function carica() {
    const R = await ruoli();
    const intro = $('form-intro');
    if (intro) {
      intro.textContent = R.rpf
        ? 'Sei il responsabile del progetto formativo: qui firmi i documenti dei corsi, scrivi le schede formative delle tipologie (o le deleghi a un docente), dichiari pronti progetto formativo e verbale di verifica, e vedi i corsi come li vede il docente.'
        : R.docente
          ? 'Qui trovi i documenti dei corsi che aspettano la tua firma, le schede formative che il responsabile del progetto formativo ti ha delegato e i tuoi corsi: incarico da accettare, presenze e firme degli allievi dal QR, registro della giornata.'
          : 'I documenti che aspettano la tua firma (anche le lettere di incarico dell\'asseverazione, da firmare per accettazione), le schede formative delegate a te e, se sei docente di un corso, la pagina del corso: incarico, presenze, firme dal QR, registro della giornata.';
    }
    if (window.firmeApp) {
      await window.firmeApp.box($('form-firme'), {
        mie: true, pulsanti: true, titolo: '✍️ Le mie firme',
        vuoto: 'Nessun documento aspetta la tua firma.',
        dopo: () => badge().catch(() => {}),
      });
    } else {
      const h = $('form-firme');
      if (h) h.innerHTML = '<div class="card" style="border-left:4px solid #c0392b"><p style="font-size:13px;color:#c0392b;margin:0">Il modulo delle firme non si è caricato: ricarica la pagina.</p></div>';
    }
    try { await schedeBox(R); } catch (e) { console.warn('schede:', e); }
    /* (lotto 3) progetto formativo dell'edizione e verbale di verifica, per l'RPF (formazione-corsi.js) */
    try {
      let hc = $('form-corsi');
      if (!hc) { hc = document.createElement('div'); hc.id = 'form-corsi'; hc.style.marginBottom = '14px'; const v = $('view-formazione'); if (v) v.appendChild(hc); }
      if (window.formazioneCorsi && hc) await window.formazioneCorsi.box(hc, R);
    } catch (e) { console.warn('corsi:', e); }
    /* (lotto 5) la pagina del docente per il corso (formazione-docente.js) */
    try {
      let hd = $('form-docente');
      if (!hd) { hd = document.createElement('div'); hd.id = 'form-docente'; hd.style.marginBottom = '14px'; const v = $('view-formazione'); if (v) v.appendChild(hd); }
      if (window.formazioneDocente && hd) await window.formazioneDocente.box(hd, R);
    } catch (e) { console.warn('docente:', e); }
    badge().catch(() => {});
  }

  /* ── 2. tipologie e schede formative ── */
  let _tip = [], _sch = [];
  async function leggiSchede() {
    const sb = window.sb;
    const [{ data: t, error: e1 }, { data: s, error: e2 }] = await Promise.all([
      sb.from('s_corsi_tipologie').select('*').order('titolo'),
      sb.from('s_corsi_schede_formative').select('*').order('tipologia_id').order('versione', { ascending: false }),
    ]);
    if (e1) throw new Error('tipologie: ' + e1.message);
    if (e2) throw new Error('schede: ' + e2.message);
    _tip = t || []; _sch = s || [];
  }
  async function schedeBox(R) {
    let host = $('form-schede');
    if (!host) { host = document.createElement('div'); host.id = 'form-schede'; host.style.marginBottom = '14px'; const v = $('view-formazione'); if (v) v.appendChild(host); else return; }
    try { await leggiSchede(); } catch (e) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>📋 Schede formative</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere le schede formative: ${esc(e.message)}</p></div>`;
      return;
    }
    const me = email();
    const mie = _sch.filter((s) => String(s.delegata_a || '').toLowerCase() === me && ['bozza', 'pronta'].includes(s.stato));
    const stato = (s) => `<span style="font-size:11px;padding:1px 7px;border-radius:10px;background:${s.stato === 'firmata' ? '#e8f3d6' : s.stato === 'in_firma' || s.stato === 'pronta' ? '#fde9dd' : '#eee'};color:#444">${esc(STATI[s.stato] || s.stato)}</span>`;
    const righeDelegate = mie.map((s) => {
      const t = _tip.find((x) => x.id === s.tipologia_id) || {};
      return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 0;border-top:1px solid #f0e6dd">
        <span style="flex:1;min-width:220px;font-size:13px"><strong>${esc(t.titolo || '?')}</strong> · versione ${s.versione} ${stato(s)}<br><span style="font-size:11.5px;color:#888">delegata a te dal responsabile del progetto formativo${s.updated_at ? ' · aggiornata il ' + dIt(s.updated_at) : ''}</span></span>
        <button class="btn-primary btn-sm" type="button" data-sch-apri="${s.id}" data-aiuto="Apre la scheda da compilare: traguardi, abilità, conoscenze, contenuti con le ore, metodologie, strumenti, verifica. Si salvano solo i campi che cambi.">✏️ Compila</button>
        <button class="btn-secondary btn-sm" type="button" data-sch-pdf="${s.id}" data-aiuto="Apre in una scheda nuova il PDF della scheda com'è adesso (bozza, senza firme).">📄 PDF</button>
        ${s.stato === 'bozza' ? `<button class="btn-secondary btn-sm" type="button" data-sch-pronta="${s.id}" data-aiuto="Dichiari finita la compilazione: la segreteria la manda in firma a te e al responsabile. Dopo non si modifica più, se non riaprendola.">✅ Pronta</button>` : ''}
      </div>`;
    }).join('');
    const righeTip = R.capo ? _tip.map((t) => {
      const vers = _sch.filter((s) => s.tipologia_id === t.id);
      const ultima = vers[0] || null;
      const vig = vers.find((s) => s.id === t.scheda_vigente_id) || null;
      const aperta = vers.find((s) => ['bozza', 'pronta'].includes(s.stato)) || null;
      return `<tr style="${t.stato === 'superata' ? 'opacity:.55' : ''}">
        <td style="padding:6px 6px;font-size:13px"><strong>${esc(t.titolo)}</strong><br><span style="font-size:11px;color:#888">${esc(t.codice)}${t.riferimento_normativo ? ' · ' + esc(t.riferimento_normativo) : ''}${t.ore_minime ? ' · ' + t.ore_minime + ' ore' : ''}${t.accordo_2025 ? '' : ' · fuori Accordo'}</span></td>
        <td style="padding:6px 6px;font-size:12.5px;white-space:nowrap">${vig ? `v${vig.versione} ${stato(vig)}` : '<span style="color:#b35c00">nessuna firmata</span>'}</td>
        <td style="padding:6px 6px;font-size:12.5px;white-space:nowrap">${aperta ? `v${aperta.versione} ${stato(aperta)}${aperta.delegata_a ? `<br><span style="font-size:11px;color:#888">delegata a ${esc(aperta.delegata_a)}</span>` : ''}` : ultima && ultima.stato === 'in_firma' ? `v${ultima.versione} ${stato(ultima)}` : '—'}</td>
        <td style="padding:6px 6px;white-space:nowrap;text-align:right">
          <button class="btn-secondary btn-sm" type="button" data-tip-mod="${t.id}" data-aiuto="Modifica i dati della tipologia: riferimento normativo, ore, validità, soglie, se ricade nell'Accordo. Si salvano solo i campi che cambi.">⚙️</button>
          ${aperta ? `<button class="btn-primary btn-sm" type="button" data-sch-apri="${aperta.id}" data-aiuto="Apre la versione in lavorazione della scheda formativa.">✏️ v${aperta.versione}</button>` : `<button class="btn-primary btn-sm" type="button" data-sch-nuova="${t.id}" data-aiuto="Apre una versione nuova della scheda formativa, partendo dall'ultima: la vigente resta valida finché la nuova non è firmata.">➕ Nuova versione</button>`}
          ${ultima ? `<button class="btn-secondary btn-sm" type="button" data-sch-pdf="${(vig || ultima).id}" data-aiuto="Apre il PDF della scheda vigente (o dell'ultima versione, se nessuna è firmata).">📄</button>` : ''}
        </td></tr>`;
    }).join('') : '';
    host.innerHTML = `<div class="card" style="border-left:4px solid var(--orange,#e7500f)">
      <h3>📋 Schede formative${R.capo ? ' e tipologie di corso' : ''}</h3>
      ${R.capo ? `<p style="font-size:12.5px;color:#555;margin:0 0 6px">Il catalogo dei corsi e, per ciascuno, la scheda formativa (progettazione didattica) versionata. La versione <strong>vigente</strong> è l'ultima firmata; una versione nuova si scrive qui o si delega a un docente, poi «Pronta» e la segreteria la manda in firma.</p>
        <div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:#888;text-align:left"><th style="padding:4px 6px">Tipologia</th><th style="padding:4px 6px">Vigente</th><th style="padding:4px 6px">In lavorazione</th><th></th></tr></thead>
        <tbody>${righeTip || '<tr><td colspan="4" style="padding:8px 6px;color:#777;font-size:13px">Nessuna tipologia ancora: comincia da «➕ Nuova tipologia».</td></tr>'}</tbody></table></div>
        <div style="margin-top:8px"><button class="btn-secondary btn-sm" type="button" id="form-tip-nuova" data-aiuto="Apre una tipologia di corso nuova nel catalogo (titolo, riferimento normativo, ore, validità, soglie).">➕ Nuova tipologia</button></div>`
        : ''}
      ${!R.capo ? (righeDelegate || '<p style="font-size:13px;color:#555;margin:0">Nessuna scheda formativa ti è stata delegata.</p>') : (righeDelegate ? `<h4 style="margin:14px 0 4px;font-size:13px;color:#565c66">Delegate a te</h4>${righeDelegate}` : '')}
    </div>`;
    host.querySelectorAll('[data-sch-apri]').forEach((b) => b.addEventListener('click', () => apriScheda(Number(b.dataset.schApri))));
    host.querySelectorAll('[data-sch-pdf]').forEach((b) => b.addEventListener('click', () => pdfScheda(Number(b.dataset.schPdf), b)));
    host.querySelectorAll('[data-sch-pronta]').forEach((b) => b.addEventListener('click', () => pronta(Number(b.dataset.schPronta))));
    host.querySelectorAll('[data-sch-nuova]').forEach((b) => b.addEventListener('click', () => nuovaVersione(Number(b.dataset.schNuova))));
    host.querySelectorAll('[data-tip-mod]').forEach((b) => b.addEventListener('click', () => apriTipologia(Number(b.dataset.tipMod))));
    const nt = host.querySelector('#form-tip-nuova'); if (nt) nt.addEventListener('click', () => apriTipologia(null));
  }

  /* ── la tipologia ── */
  function apriTipologia(id) {
    const t = id ? _tip.find((x) => x.id === id) : null;
    const v = t || { perc_freq_min: 90, max_discenti: 30, modalita_ammesse: ['presenza'], test_previsto: true, questionario_previsto: true, tipo_attestato: 'frequenza_verifica', accordo_2025: true, firme_qr: true, vale_anche_come: [], stato: 'attiva' };
    const chk = (id2, on, testo) => `<label style="display:flex;gap:6px;align-items:center;font-size:13px;text-transform:none;letter-spacing:0;font-weight:500;color:#333"><input type="checkbox" id="${id2}" ${on ? 'checked' : ''} style="width:16px;height:16px;accent-color:#e7500f">${testo}</label>`;
    finestra(t ? `⚙️ Tipologia «${esc(t.titolo)}»` : '➕ Nuova tipologia di corso', `
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">
        ${campo('Codice breve *', inp('tp-codice', v.codice), 'es. ANTINC-L2, PREP-AGG')}
        ${campo('Titolo *', inp('tp-titolo', v.titolo))}
      </div>
      ${campo('Riferimento normativo', inp('tp-rif', v.riferimento_normativo), 'es. D.Lgs. 81/2008 art. 46; D.M. 2 settembre 2021 art. 5; Accordo CSR 17/04/2025')}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${campo('Ore minime', inp('tp-ore', v.ore_minime, 'number', 'step="0.5"'))}
        ${campo('Validità (anni)', inp('tp-val', v.validita_anni, 'number'))}
        ${campo('Aggiornamento (ore)', inp('tp-aggore', v.aggiornamento_ore, 'number', 'step="0.5"'))}
        ${campo('Aggiornamento ogni (anni)', inp('tp-agganni', v.aggiornamento_anni, 'number'))}
      </div>
      ${campo('Modalità ammesse', Object.entries(MODALITA).map(([k, l]) => chk('tp-mod-' + k, (v.modalita_ammesse || []).includes(k), l)).join(''))}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${campo('Frequenza minima %', inp('tp-freq', v.perc_freq_min, 'number'))}
        ${campo('Massimo discenti', inp('tp-max', v.max_discenti, 'number'))}
        ${campo('Rapporto docente/discenti nella pratica', inp('tp-rapp', v.rapporto_pratica), 'es. 1 a 6')}
      </div>
      ${campo('Attestato', `<select id="tp-att" style="width:100%;font-size:13.5px">${Object.entries(TIPI_ATT).map(([k, l]) => `<option value="${k}" ${v.tipo_attestato === k ? 'selected' : ''}>${l}</option>`).join('')}${TIPI_ATT[v.tipo_attestato] ? '' : `<option value="${esc(v.tipo_attestato)}" selected>${esc(v.tipo_attestato)} (com'è scritto)</option>`}</select>`)}
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin:4px 0 8px">
        ${chk('tp-test', v.test_previsto, 'Verifica finale')}${chk('tp-quest', v.questionario_previsto, 'Questionario di gradimento')}
        ${chk('tp-accordo', v.accordo_2025, 'Corso dell\'Accordo CSR 59/2025 (fascicolo pieno)')}${chk('tp-qr', v.firme_qr, 'Firme di presenza dal QR')}
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
        ${campo('Vale anche come', inp('tp-vale', (v.vale_anche_come || []).join(', ')), 'equivalenze, separate da virgola: es. aggiornamento preposto')}
        ${campo('Crediti', inp('tp-crediti', v.crediti, 'number', 'step="0.5"'))}
      </div>
      ${campo('Note', area('tp-note', v.note, 2))}
      ${t ? campo('Stato', `<select id="tp-stato" style="font-size:13.5px"><option value="attiva" ${v.stato === 'attiva' ? 'selected' : ''}>attiva</option><option value="superata" ${v.stato === 'superata' ? 'selected' : ''}>superata (non si usa più)</option></select>`) : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button type="button" class="btn-outline btn-sm" data-chiudi>Annulla</button><button type="button" class="btn-primary btn-sm" id="tp-salva" data-aiuto="Salva la tipologia nel catalogo. Si scrivono solo i campi che hai cambiato.">💾 Salva</button></div>`);
    const letto = {
      codice: v.codice || '', titolo: v.titolo || '', riferimento_normativo: v.riferimento_normativo || '', ore_minime: v.ore_minime ?? '', validita_anni: v.validita_anni ?? '',
      aggiornamento_ore: v.aggiornamento_ore ?? '', aggiornamento_anni: v.aggiornamento_anni ?? '', modalita_ammesse: JSON.stringify(v.modalita_ammesse || []),
      perc_freq_min: v.perc_freq_min ?? '', max_discenti: v.max_discenti ?? '', rapporto_pratica: v.rapporto_pratica || '', tipo_attestato: v.tipo_attestato,
      test_previsto: !!v.test_previsto, questionario_previsto: !!v.questionario_previsto, accordo_2025: !!v.accordo_2025, firme_qr: !!v.firme_qr,
      vale_anche_come: JSON.stringify(v.vale_anche_come || []), crediti: v.crediti ?? '', note: v.note || '', stato: v.stato,
    };
    $('tp-salva').addEventListener('click', async (ev) => {
      const b = ev.currentTarget;
      const num = (id2) => { const x = $(id2).value.trim(); return x === '' ? '' : Number(x); };
      const ora = {
        codice: $('tp-codice').value.trim(), titolo: $('tp-titolo').value.trim(), riferimento_normativo: $('tp-rif').value.trim(),
        ore_minime: num('tp-ore'), validita_anni: num('tp-val'), aggiornamento_ore: num('tp-aggore'), aggiornamento_anni: num('tp-agganni'),
        modalita_ammesse: JSON.stringify(Object.keys(MODALITA).filter((k) => $('tp-mod-' + k).checked)),
        perc_freq_min: num('tp-freq'), max_discenti: num('tp-max'), rapporto_pratica: $('tp-rapp').value.trim(), tipo_attestato: $('tp-att').value,
        test_previsto: $('tp-test').checked, questionario_previsto: $('tp-quest').checked, accordo_2025: $('tp-accordo').checked, firme_qr: $('tp-qr').checked,
        vale_anche_come: JSON.stringify($('tp-vale').value.split(',').map((x) => x.trim()).filter(Boolean)), crediti: num('tp-crediti'), note: $('tp-note').value.trim(),
        stato: t ? $('tp-stato').value : 'attiva',
      };
      if (!ora.codice || !ora.titolo) { avviso('Servono codice e titolo.', 'err'); return; }
      /* solo i campi cambiati (regola del 04/10/2026) */
      const p = t ? { id: t.id } : {};
      for (const k of Object.keys(ora)) {
        if (!t || String(ora[k]) !== String(letto[k])) p[k] = (k === 'modalita_ammesse' || k === 'vale_anche_come') ? JSON.parse(ora[k]) : ora[k];
      }
      if (t && Object.keys(p).length === 1) { avviso('Niente da salvare: non hai cambiato nulla.', 'ok'); chiudi(); return; }
      b.disabled = true;
      const { error } = await window.sb.rpc('tipologia_salva', { p });
      b.disabled = false;
      if (error) { avviso('Non salvata: ' + error.message, 'err'); return; }
      avviso(t ? 'Tipologia aggiornata.' : 'Tipologia creata.', 'ok'); chiudi(); schedeBox(_R || await ruoli());
    });
  }

  /* ── la scheda formativa ── */
  async function nuovaVersione(tipId) {
    const t = _tip.find((x) => x.id === tipId);
    if (!t) return;
    if (!confirm(`Apro una versione nuova della scheda formativa di «${t.titolo}», partendo dall'ultima. La versione vigente resta valida finché la nuova non è firmata. Procedo?`)) return;
    const { data, error } = await window.sb.rpc('scheda_salva', { p: { tipologia_id: tipId } });
    if (error) { avviso('Non aperta: ' + error.message, 'err'); return; }
    await leggiSchede();
    apriScheda(data.id);
  }
  function apriScheda(id) {
    const s = _sch.find((x) => x.id === id);
    if (!s) { avviso('Scheda non trovata: ricarica la pagina.', 'err'); return; }
    const t = _tip.find((x) => x.id === s.tipologia_id) || {};
    const R = _R || {};
    const modificabile = ['bozza', 'pronta'].includes(s.stato) && (R.capo || String(s.delegata_a || '').toLowerCase() === email());
    const dis = modificabile ? '' : 'disabled';
    const voci = (k) => {
      const salvate = Array.isArray(s[k]) ? s[k] : [];
      /* le voci del modello, con lo stato salvato; più quelle salvate che non sono nel modello */
      const righe = VOCI[k].map(([key, testo]) => { const sv = salvate.find((x) => x.k === key); return { k: key, testo: sv && key === 'altro' ? (sv.testo || testo) : testo, on: !!(sv && sv.on), altro: key === 'altro' }; });
      for (const sv of salvate) if (!VOCI[k].some(([key]) => key === sv.k)) righe.push({ k: sv.k, testo: sv.testo || sv.k, on: !!sv.on });
      return righe.map((r, i) => `<label style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500;color:#333">
        <input type="checkbox" data-voce="${k}" data-k="${esc(r.k)}" data-i="${i}" ${r.on ? 'checked' : ''} ${dis} style="width:16px;height:16px;margin-top:2px;accent-color:#e7500f;flex:none">
        ${r.altro ? `<input type="text" data-voce-testo="${k}" data-k="${esc(r.k)}" value="${esc(r.testo === 'Altro:' ? '' : r.testo)}" placeholder="Altro…" ${dis} style="flex:1;font-size:13px">` : `<span>${esc(r.testo)}</span>`}</label>`).join('');
    };
    const unita = (Array.isArray(s.contenuti) ? s.contenuti : []);
    const rigaUnita = (u, i) => `<tr data-un="${i}"><td style="padding:2px"><input type="text" data-un-unita value="${esc(u.unita || '')}" ${dis} style="width:100%;font-size:13px"></td>
      <td style="padding:2px"><textarea data-un-arg rows="2" ${dis} style="width:100%;font-size:13px">${esc(u.argomenti || '')}</textarea></td>
      <td style="padding:2px;width:70px"><input type="number" step="0.5" data-un-ore value="${esc(u.ore ?? '')}" ${dis} style="width:100%;font-size:13px"></td>
      <td style="padding:2px;width:30px">${modificabile ? '<button type="button" data-un-togli style="background:none;border:0;color:#c0392b;cursor:pointer;font-size:16px" title="Togli questa unità">✕</button>' : ''}</td></tr>`;
    finestra(`📋 Scheda formativa «${esc(t.titolo || '?')}» — versione ${s.versione} (${esc(STATI[s.stato] || s.stato)})`, `
      <p style="font-size:12px;color:#777;margin:0 0 8px">${esc(t.riferimento_normativo || '')}${t.ore_minime ? ` · durata minima ${t.ore_minime} ore` : ''}${s.delegata_a ? ` · delegata a <strong>${esc(s.delegata_a)}</strong>` : ''}${s.compilata_da ? ` · compilata da ${esc(s.compilata_da)}` : ''}${!modificabile ? ' · <strong>in sola lettura</strong>' : ''}</p>
      <h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">Obiettivi del corso</h4>
      ${campo('Traguardi di competenza *', area('sc-traguardi', s.traguardi, 3))}
      ${campo('Abilità', area('sc-abilita', s.abilita, 4))}
      ${campo('Conoscenze', area('sc-conoscenze', s.conoscenze, 4))}
      ${SEZIONI.slice(0, 3).map(([k, l]) => `<h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">${l}</h4><div id="sc-${k}">${voci(k)}</div>`).join('')}
      <h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">Argomenti trattati (unità didattiche e ore) *</h4>
      <table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:#888;text-align:left"><th>Unità didattica</th><th>Contenuti e argomenti</th><th>Ore</th><th></th></tr></thead><tbody id="sc-unita">${unita.map(rigaUnita).join('')}</tbody></table>
      ${modificabile ? '<button type="button" class="btn-secondary btn-sm" id="sc-un-piu" style="margin-top:4px" data-aiuto="Aggiunge una riga: un\'unità didattica con i suoi contenuti e le ore.">➕ Unità</button>' : ''}
      <div id="sc-tot" style="font-size:12px;color:#666;margin-top:4px"></div>
      ${SEZIONI.slice(3).map(([k, l]) => `<h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">${l}</h4><div id="sc-${k}">${voci(k)}</div>`).join('')}
      ${campo('Note normative aggiuntive', area('sc-note', s.note_normative, 2))}
      ${R.capo ? campo('Delegata al docente (indirizzo con cui entra nell\'app)', `<input id="sc-delega" list="sc-tecnici" value="${esc(s.delegata_a || '')}" ${s.stato === 'in_firma' || s.stato === 'firmata' ? 'disabled' : ''} style="width:100%;font-size:13.5px"><datalist id="sc-tecnici"></datalist>`, 'Vuoto = la compila il responsabile del progetto formativo. Il delegato firma per primo, poi il responsabile.') : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
        <button type="button" class="btn-outline btn-sm" data-chiudi>Chiudi</button>
        <button type="button" class="btn-secondary btn-sm" id="sc-pdf" data-aiuto="Apre in una scheda nuova il PDF della scheda com'è salvata adesso.">📄 Anteprima PDF</button>
        ${modificabile ? '<button type="button" class="btn-primary btn-sm" id="sc-salva" data-aiuto="Salva la scheda. Si scrivono solo i campi che hai cambiato.">💾 Salva</button>' : ''}
        ${modificabile && s.stato === 'bozza' ? '<button type="button" class="btn-primary btn-sm" id="sc-pronta" data-aiuto="Salva e dichiari finita la compilazione: la segreteria la manda in firma. Dopo non si modifica più, se non riaprendola.">✅ Salva e dichiara pronta</button>' : ''}
        ${R.capo && s.stato === 'pronta' ? '<button type="button" class="btn-secondary btn-sm" id="sc-riapri" data-aiuto="Riporta la scheda in bozza per correggerla.">↩ Riapri in bozza</button>' : ''}
      </div>`, true);
    /* i tecnici, per la delega */
    if (R.capo) window.sb.from('tecnici').select('email, tecnico_nome, tecnico_cognome').eq('attivo', true).order('tecnico_cognome').then(({ data }) => {
      const dl = $('sc-tecnici'); if (!dl) return;
      dl.innerHTML = (data || []).filter((x) => x.email).map((x) => `<option value="${esc(x.email)}">${esc(x.tecnico_nome + ' ' + x.tecnico_cognome)}</option>`).join('');
    });
    const tot = () => { const h = $('sc-tot'); if (!h) return; const n = [...document.querySelectorAll('#sc-unita [data-un-ore]')].reduce((a, i) => a + (Number(i.value) || 0), 0); h.textContent = `Totale ore: ${n}${t.ore_minime ? ` (minimo della tipologia: ${t.ore_minime})` : ''}`; h.style.color = t.ore_minime && n < t.ore_minime ? '#b35c00' : '#666'; };
    tot();
    document.getElementById('sc-unita').addEventListener('input', tot);
    document.getElementById('sc-unita').addEventListener('click', (e) => { const b = e.target.closest('[data-un-togli]'); if (b) { b.closest('tr').remove(); tot(); } });
    const piu = $('sc-un-piu'); if (piu) piu.addEventListener('click', () => { const tb = $('sc-unita'); tb.insertAdjacentHTML('beforeend', rigaUnita({}, tb.children.length)); });
    /* lettura di partenza, per salvare solo i campi cambiati */
    const raccogli = () => {
      const voc = (k) => [...document.querySelectorAll(`#sc-${k} [data-voce]`)].map((c) => {
        const testo = c.parentElement.querySelector('[data-voce-testo]');
        const base = VOCI[k].find(([key]) => key === c.dataset.k);
        return { k: c.dataset.k, testo: testo ? (testo.value.trim() || 'Altro:') : (base ? base[1] : c.dataset.k), on: c.checked };
      });
      return {
        traguardi: $('sc-traguardi').value.trim(), abilita: $('sc-abilita').value.trim(), conoscenze: $('sc-conoscenze').value.trim(),
        requisiti_precorso: voc('requisiti_precorso'), nai_bes: voc('nai_bes'), modalita: voc('modalita'), metodologie: voc('metodologie'), strumenti: voc('strumenti'), verifica: voc('verifica'),
        contenuti: [...document.querySelectorAll('#sc-unita tr')].map((tr) => ({ unita: tr.querySelector('[data-un-unita]').value.trim(), argomenti: tr.querySelector('[data-un-arg]').value.trim(), ore: tr.querySelector('[data-un-ore]').value === '' ? '' : Number(tr.querySelector('[data-un-ore]').value) })).filter((u) => u.unita || u.argomenti || u.ore !== ''),
        note_normative: $('sc-note').value.trim(),
        ...(R.capo && $('sc-delega') && !$('sc-delega').disabled ? { delegata_a: $('sc-delega').value.trim().toLowerCase() } : {}),
      };
    };
    const letto = JSON.parse(JSON.stringify(raccogli()));
    const salva = async () => {
      const ora = raccogli();
      const p = { id: s.id };
      for (const k of Object.keys(ora)) if (JSON.stringify(ora[k]) !== JSON.stringify(letto[k])) p[k] = ora[k];
      if (Object.keys(p).length === 1) return { data: s, cambiato: false };
      const { data, error } = await window.sb.rpc('scheda_salva', { p });
      if (error) throw new Error(error.message);
      Object.assign(letto, JSON.parse(JSON.stringify(ora)));
      return { data, cambiato: true };
    };
    const bs = $('sc-salva');
    if (bs) bs.addEventListener('click', async () => {
      bs.disabled = true;
      try { const r = await salva(); avviso(r.cambiato ? 'Scheda salvata.' : 'Niente da salvare: non hai cambiato nulla.', 'ok'); await leggiSchede(); }
      catch (e) { avviso('Non salvata: ' + e.message, 'err'); }
      bs.disabled = false;
    });
    const bp = $('sc-pronta');
    if (bp) bp.addEventListener('click', async () => {
      if (!confirm('Dichiaro pronta la scheda? La segreteria la manderà in firma; dopo non si modifica più, se non riaprendola in bozza.')) return;
      bp.disabled = true;
      try { await salva(); await pronta(s.id, true); chiudi(); }
      catch (e) { avviso('Non riuscito: ' + e.message, 'err'); bp.disabled = false; }
    });
    const br = $('sc-riapri');
    if (br) br.addEventListener('click', async () => {
      const { error } = await window.sb.rpc('scheda_stato', { p_id: s.id, p_stato: 'bozza' });
      if (error) { avviso('Non riaperta: ' + error.message, 'err'); return; }
      avviso('Scheda riaperta in bozza.', 'ok'); chiudi(); await leggiSchede(); schedeBox(_R);
    });
    $('sc-pdf').addEventListener('click', (ev) => pdfScheda(s.id, ev.currentTarget));
  }
  async function pronta(id, giaConfermato) {
    if (!giaConfermato && !confirm('Dichiaro pronta la scheda? La segreteria la manderà in firma; dopo non si modifica più, se non riaprendola in bozza.')) return;
    const { error } = await window.sb.rpc('scheda_stato', { p_id: id, p_stato: 'pronta' });
    if (error) { avviso('Non riuscito: ' + error.message, 'err'); if (giaConfermato) throw new Error(error.message); return; }
    avviso('Scheda pronta: la segreteria la manda in firma.', 'ok');
    await leggiSchede(); schedeBox(_R || await ruoli());
  }
  /* il PDF lo disegna la funzione documenti-corso (la stessa della segreteria) */
  async function pdfScheda(id, btn) {
    const w = window.open('', '_blank');
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await window.sb.functions.invoke('documenti-corso', { body: { azione: 'scheda_formativa', id } });
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

  /* il numero sul pulsante del menu: le firme in attesa di chi è collegato */
  async function badge() {
    const b = $('nav-form-badge'); if (!b) return;
    const n = window.firmeApp ? await window.firmeApp.conta() : 0;
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  window.formazione = { carica, badge, VOCI };
})();
