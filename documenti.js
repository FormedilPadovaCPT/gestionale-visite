/* ============================================================
   DOCUMENTI CON PRESA VISIONE (chiesto dall'utente il 21/10/2026:
   «metterei l'informativa direttamente in gestionale come documento a
   ogni tecnico, che se la può vedere e scaricare e ne prende visione»).

   Che cosa fa:
   - ciascuno vede i documenti che lo riguardano (tecnici, Coordinatore,
     segreteria, chi è nella chat del team), li apre o li scarica e poi
     preme «Ho letto e preso visione». La presa visione si può dare solo
     dopo aver aperto il file: l'apertura la registra la funzione
     documenti-personale, non il telefono;
   - resta scritto chi, quando e quale versione (impronta SHA-256 del PDF).
     Se il documento cambia, la segreteria pubblica la versione nuova e la
     presa visione si chiede di nuovo; quella vecchia resta, con il file;
   - la segreteria pubblica e ritira; segreteria e Coordinatore vedono chi
     ha preso visione e chi no.

   I permessi li fa rispettare il DATABASE (2026_10_21_documenti_presa_visione.sql)
   e la funzione documenti-personale: qui si disegna soltanto.
   Script classico: usa window.sb, window.S, window.toast.
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const $ = (id) => (haDom ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const avviso = (m, t, ms) => (radice.toast ? radice.toast(m, t, ms) : console.log(m));

  const GRUPPI = [
    ['tecnici', 'Tecnici in servizio'],
    ['coordinatore', 'Coordinatore'],
    ['segreteria', 'Segreteria'],
    ['chat', 'Chi è nella chat del team'],
  ];
  const MAX_PDF = 10 * 1024 * 1024;

  /* ════════ funzioni pure (le prova test/documenti.test.cjs) ════════ */
  // a che punto è un documento per chi lo riceve
  function statoDoc(d) {
    if (!d) return 'da-leggere';
    // (21/10/2026) i documenti da firmare: la firma prende il posto della presa visione
    if (d.richiede_firma) {
      const st = d.firma && d.firma.stato;
      return st === 'firmata' ? 'letto' : st === 'rimandata' ? 'rimandato' : d.firma ? 'da-firmare' : 'firma-non-chiesta';
    }
    if (d.presa_il) return 'letto';
    if (d.aperto_il) return 'aperto';
    return 'da-leggere';
  }
  // da leggere o da firmare: un documento rimandato con un motivo è nelle mani della segreteria, non conta più
  function quantiDaLeggere(lista) { return (lista || []).filter((d) => !['letto', 'rimandato'].includes(statoDoc(d))).length; }
  // il codice che lega le versioni dello stesso documento, dal titolo
  function codiceDa(titolo) {
    return String(titolo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  }
  function codiceValido(c) { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(c || '')) && c.length >= 3 && c.length <= 60; }
  function dataOra(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' alle ' + d.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
  }
  // nel quadro: quante persone hanno preso visione, fra quelle a cui il documento va adesso
  // per un documento da firmare «presa» vuol dire firmato
  const fatto = (p) => !!(p.presa_il || (p.firma && p.firma.stato === 'firmata'));
  function conta(persone) {
    const dest = (persone || []).filter((p) => p.destinatario);
    return { tot: dest.length, prese: dest.filter(fatto).length, aperte: dest.filter((p) => p.aperto_il && !fatto(p)).length };
  }
  function nomeGruppi(arr) { return (arr || []).map((g) => (GRUPPI.find((x) => x[0] === g) || [g, g])[1]).join(', '); }
  // il file scelto va bene?
  function valutaPdf(f) {
    if (!f) return { ok: false, msg: 'Scegli il PDF da pubblicare.' };
    if (!/\.pdf$/i.test(f.name || '') && f.type !== 'application/pdf') return { ok: false, msg: 'Si pubblicano solo PDF.' };
    if ((f.size || 0) > MAX_PDF) return { ok: false, msg: 'Il PDF supera i 10 MB.' };
    return { ok: true };
  }

  /* ════════ stato ════════ */
  let _miei = null;            // risposta di doc_miei
  let _quadro = null;          // risposta di doc_quadro (segreteria e Coordinatore)
  let _biglietti = {};         // id → url, validi 2 ore
  let _bigliettiIl = 0;
  let _conferma = null;        // { azione: 'pubblica'|'ritira', … } chiesta nella pagina, mai con la finestra del browser
  let _avviata = false;
  const aperta = () => { const v = $('view-documenti'); return !!(v && !v.classList.contains('hidden')); };

  /* ════════ avvio: dopo l'accesso, una volta ════════ */
  async function avvia() {
    if (_avviata || !radice.sb) return;
    _avviata = true;
    const ok = await leggi();
    if (!ok) { _avviata = false; return; }
    const b = $('nav-documenti');
    if (!b) return;
    if (!_miei.puo) { b.dataset.docVisibile = '0'; b.style.display = 'none'; return; }
    b.dataset.docVisibile = '1'; b.style.display = '';
    numero();
    if (radice.vesteV2 && typeof radice.vesteV2.rimenu === 'function') radice.vesteV2.rimenu();
    if (radice.vesteV2 && typeof radice.vesteV2.azioni === 'function') radice.vesteV2.azioni();
  }
  async function leggi() {
    const r = await radice.sb.rpc('doc_miei');
    if (r.error) { console.warn('documenti: non letti:', r.error.message); return false; }
    _miei = r.data || { documenti: [], precedenti: [] };
    return true;
  }
  /* il numero: documenti da leggere, più TUTTO quello che aspetta la mia firma (anche le lettere che non
     vengono da questa pagina, come quella di affiancamento: 21/10/2026, «devono firmare il documento dentro l'app») */
  async function numero() {
    const b = $('nav-documenti-badge'); if (!b) return;
    const daLeggere = (_miei && _miei.documenti || []).filter((d) => !d.richiede_firma);
    let firme = 0;
    try { if (radice.firmeApp && typeof radice.firmeApp.conta === 'function') firme = await radice.firmeApp.conta(); } catch (_e) { /* il numero resta quello dei documenti */ }
    const n = quantiDaLeggere(daLeggere) + firme;
    b.textContent = String(n); b.style.display = n ? '' : 'none';
    b.classList.toggle('inc-lampeggia', n > 0);
    if (radice.vesteV2 && typeof radice.vesteV2.azioni === 'function') radice.vesteV2.azioni();
  }

  async function biglietti(ids) {
    const mancano = ids.filter((id) => !_biglietti[id]);
    if (!mancano.length && Date.now() - _bigliettiIl < 90 * 60 * 1000) return;
    const r = await radice.sb.functions.invoke('documenti-personale', { body: { azione: 'biglietti', ids } });
    if (r.error || !r.data || !r.data.ok) throw new Error((r.data && r.data.error) || (r.error && r.error.message) || 'collegamenti ai documenti non preparati');
    _biglietti = r.data.biglietti || {};
    _bigliettiIl = Date.now();
  }

  /* ════════ la pagina ════════ */
  async function apri() {
    stile();
    const v = $('view-documenti'); if (!v) return;
    v.innerHTML = '<div class="doc-wrap"><p class="doc-desc">Carico i documenti…</p></div>';
    if (!(await leggi())) { v.innerHTML = '<div class="doc-wrap"><p class="doc-ko">Non sono riuscito a leggere i documenti: riprova fra poco.</p></div>'; return; }
    _quadro = null;
    if (_miei.quadro) {
      const q = await radice.sb.rpc('doc_quadro');
      if (q.error) console.warn('documenti, quadro:', q.error.message); else _quadro = q.data || [];
    }
    const ids = [...(_miei.documenti || []), ...(_miei.precedenti || []), ...(_quadro || [])].map((d) => d.id);
    try { if (ids.length) await biglietti([...new Set(ids)]); } catch (e) { console.warn('documenti, collegamenti:', e); }
    disegna();
    numero();
  }

  function disegna() {
    const v = $('view-documenti'); if (!v || !_miei) return;
    const docs = _miei.documenti || [];
    let h = '<div class="doc-wrap"><h2 class="doc-titolo">📄 Documenti</h2>'
      + '<p class="doc-desc">Qui trovi i documenti che l\'ufficio ti chiede di leggere, come le informative sui tuoi dati. Aprili o scaricali, leggili e poi premi «Ho letto e preso visione». '
      + 'Resta scritto quando l\'hai fatto e quale versione hai letto; se un documento cambia, te lo chiediamo di nuovo. '
      + 'Quelli che vanno <b>firmati</b> (per esempio la lettera di affiancamento) si firmano qui sotto, in «Documenti da firmare»: non per mail, non su carta.</p>';
    // tutto quello che aspetta la mia firma, col riquadro di sempre (firme.js): i documenti di questa pagina e le lettere
    h += '<div id="doc-firme"></div>';
    if (!docs.length) h += '<div class="doc-card doc-vuoto">Per ora non ci sono documenti per te.</div>';
    h += docs.map(cartaDoc).join('');
    const prec = _miei.precedenti || [];
    if (prec.length) {
      h += '<details class="doc-prec"><summary>Versioni precedenti che hai letto (' + prec.length + ')</summary>'
        + prec.map((p) => `<div class="doc-riga"><span>${esc(p.titolo)} · versione ${p.versione}</span><span class="doc-piccolo">${p.presa_il ? 'presa visione il ' + esc(dataOra(p.presa_il)) : 'aperta il ' + esc(dataOra(p.aperto_il))}, sostituita il ${esc(dataOra(p.ritirato_il))}</span>${link(p.id, '📄 Apri')}</div>`).join('')
        + '</details>';
    }
    if (_miei.pubblica) h += formPubblica();
    if (_quadro) h += quadro();
    h += '</div>';
    v.innerHTML = h;
    const host = $('doc-firme');
    if (host) {
      if (radice.firmeApp && typeof radice.firmeApp.box === 'function') {
        radice.firmeApp.box(host, { titolo: '✍️ Documenti da firmare', vuoto: 'Niente da firmare.', dopo: () => { apri().catch((e) => console.warn('documenti:', e)); } })
          .catch((e) => { host.innerHTML = '<div class="doc-card doc-ko">Non sono riuscito a leggere i documenti da firmare: ' + esc(e.message) + '</div>'; });
      } else host.innerHTML = '<div class="doc-card doc-ko">Il riquadro delle firme non si è caricato: ricarica la pagina.</div>';
    }
  }
  function link(id, testo, scarica) {
    const u = _biglietti[id];
    if (!u) return '<span class="doc-piccolo">(collegamento non pronto: ricarica la pagina)</span>';
    return `<a class="doc-btn" href="${esc(u + (scarica ? '&scarica=1' : ''))}" target="_blank" rel="noopener" data-doc-apri="${id}"${scarica ? ' download' : ''} title="${scarica ? 'Scarica il PDF sul dispositivo: anche questo conta come apertura, e dopo puoi prendere visione.' : 'Apre il PDF in un’altra scheda: l’apertura resta registrata, e dopo puoi prendere visione.'}">${testo}</a>`;
  }
  function cartaDoc(d) {
    const st = statoDoc(d);
    if (d.richiede_firma) {
      const f = d.firma || {};
      const pill = st === 'letto' ? `<span class="doc-pill ok">✓ Firmato il ${esc(dataOra(f.firmata_il))}</span>`
        : st === 'rimandato' ? `<span class="doc-pill ap">Rimandato alla segreteria: «${esc(f.rimandata_motivo || '')}»</span>`
          : st === 'da-firmare' ? '<span class="doc-pill da">Da firmare</span>' : '<span class="doc-pill da">Da firmare</span>';
      const nota = st === 'da-firmare' ? '<span class="doc-piccolo">Si firma qui sopra, in «Documenti da firmare»: «Leggi», poi «Firmo».</span>'
        : st === 'firma-non-chiesta' ? '<span class="doc-piccolo">La richiesta di firma non è ancora arrivata: avvisa la segreteria.</span>' : '';
      return `<div class="doc-card${st === 'letto' ? '' : ' doc-nuovo'}">
      <div class="doc-testa"><b>${esc(d.titolo)}</b>${pill}</div>
      ${d.descrizione ? `<p class="doc-desc">${esc(d.descrizione)}</p>` : ''}
      <div class="doc-piccolo">Da firmare · versione ${d.versione} · pubblicata il ${esc(dataOra(d.pubblicato_il))} · ${esc(d.nome_file)}</div>
      <div class="doc-azioni">${link(d.id, '📄 Apri')}${link(d.id, '⬇ Scarica', true)}${nota}</div>
    </div>`;
    }
    const etichetta = st === 'letto' ? `<span class="doc-pill ok">✓ Presa visione il ${esc(dataOra(d.presa_il))}</span>`
      : st === 'aperto' ? '<span class="doc-pill ap">Aperto: manca la presa visione</span>' : '<span class="doc-pill da">Da leggere</span>';
    const presa = st === 'letto' ? ''
      : st === 'aperto' ? `<button type="button" class="doc-btn pieno" data-doc-presa="${d.id}">✓ Ho letto e preso visione</button>`
        : '<button type="button" class="doc-btn pieno" disabled title="Apri prima il documento">✓ Ho letto e preso visione</button><span class="doc-piccolo">Si attiva dopo che hai aperto il documento.</span>';
    return `<div class="doc-card${st === 'letto' ? '' : ' doc-nuovo'}">
      <div class="doc-testa"><b>${esc(d.titolo)}</b>${etichetta}</div>
      ${d.descrizione ? `<p class="doc-desc">${esc(d.descrizione)}</p>` : ''}
      <div class="doc-piccolo">Versione ${d.versione} · pubblicata il ${esc(dataOra(d.pubblicato_il))} · ${esc(d.nome_file)}</div>
      <div class="doc-azioni">${link(d.id, '📄 Apri')}${link(d.id, '⬇ Scarica', true)}${presa}</div>
    </div>`;
  }

  /* ── segreteria: pubblicare ── */
  function formPubblica() {
    const codici = [...new Map((_quadro || []).filter((q) => q.in_vigore).map((q) => [q.codice, q])).values()];
    const c = _conferma && _conferma.azione === 'pubblica' ? _conferma : null;
    return `<div class="doc-card doc-pannello"><h3>Pubblica un documento</h3>
      <p class="doc-desc">Il PDF va su Drive in «Documenti al personale» e non si condivide con nessuno: lo apre solo chi lo riceve, dall'app. Chi lo riceve ha una notifica.
      Per sostituire un documento già pubblicato scegli «Nuova versione di…»: la versione precedente si ritira e la presa visione si chiede di nuovo.</p>
      <div class="doc-form">
        <label>Che cosa<select id="doc-f-cosa"><option value="">Documento nuovo</option>${codici.map((q) => `<option value="${esc(q.codice)}" data-titolo="${esc(q.titolo)}" data-dest="${esc((q.destinatari || []).join(','))}">Nuova versione di: ${esc(q.titolo)} (ora v${q.versione})</option>`).join('')}</select></label>
        <label>Titolo<input id="doc-f-titolo" maxlength="200" placeholder="Es. La chat del team e i tuoi dati"></label>
        <label>Due righe per chi lo riceve (facoltative)<textarea id="doc-f-desc" maxlength="1000" rows="2"></textarea></label>
        <fieldset><legend>A chi va</legend>${GRUPPI.map(([k, t]) => `<label class="doc-check"><input type="checkbox" value="${k}" class="doc-f-dest"> ${t}</label>`).join('')}</fieldset>
        <label class="doc-check"><input type="checkbox" id="doc-f-firma"> Chiede la firma di chi lo riceve: ognuno firma la sua copia nell'app, al posto della sola presa visione</label>
        <label>PDF<input type="file" id="doc-f-pdf" accept="application/pdf,.pdf"></label>
        <div><button type="button" class="doc-btn pieno" data-doc-azione="pubblica-chiedi">Pubblica…</button></div>
      </div>
      ${c ? `<div class="doc-conferma"><div>Pubblico <b>${esc(c.titolo)}</b>${c.sostituisce ? ' come <b>nuova versione</b>: quella in vigore si ritira e la presa visione si chiede di nuovo a tutti' : ''}, per: ${esc(nomeGruppi(c.destinatari))}.${c.firma ? ' <b>Va firmato</b>: a ciascuno parte la richiesta di firma, con una mail e una notifica.' : ' Riceveranno una notifica.'}</div>
        <div class="doc-azioni"><button type="button" class="doc-btn pieno" data-doc-azione="pubblica-si">Sì, pubblica</button><button type="button" class="doc-btn" data-doc-azione="annulla">Annulla</button></div></div>` : ''}
    </div>`;
  }
  function leggiForm() {
    const cosa = $('doc-f-cosa') ? $('doc-f-cosa').value : '';
    const titolo = ($('doc-f-titolo') ? $('doc-f-titolo').value : '').trim();
    const descrizione = ($('doc-f-desc') ? $('doc-f-desc').value : '').trim();
    const destinatari = haDom ? [...document.querySelectorAll('.doc-f-dest:checked')].map((x) => x.value) : [];
    const file = $('doc-f-pdf') && $('doc-f-pdf').files ? $('doc-f-pdf').files[0] : null;
    const firma = !!($('doc-f-firma') && $('doc-f-firma').checked);
    return { cosa, titolo, descrizione, destinatari, file, firma, codice: cosa || codiceDa(titolo), sostituisce: !!cosa };
  }
  function controllaForm(f) {
    if (f.titolo.length < 3) return 'Scrivi il titolo.';
    if (!codiceValido(f.codice)) return 'Il titolo deve contenere almeno tre lettere o numeri.';
    if (!f.destinatari.length) return 'Scegli a chi va.';
    if (!f.sostituisce && (_quadro || []).some((q) => q.in_vigore && q.codice === f.codice)) return 'C\'è già un documento in vigore con questo titolo: scegli «Nuova versione di…» oppure cambia titolo.';
    const p = valutaPdf(f.file); if (!p.ok) return p.msg;
    return '';
  }
  const base64 = (file) => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => ko(new Error('PDF non letto'));
    r.readAsDataURL(file);
  });
  async function pubblica() {
    const c = _conferma; if (!c || !c.file) return;
    avviso('Pubblico il documento…', '', 3000);
    const pdf = await base64(c.file);
    const r = await radice.sb.functions.invoke('documenti-personale', { body: { azione: 'pubblica', pdf_base64: pdf, titolo: c.titolo, codice: c.codice, descrizione: c.descrizione, destinatari: c.destinatari, richiede_firma: c.firma } });
    if (r.error || !r.data || !r.data.ok) throw new Error((r.data && r.data.error) || (r.error && r.error.message) || 'documento non pubblicato');
    _conferma = null;
    if (r.data.avviso) avviso(r.data.avviso, 'err', 10000);
    else avviso(`Pubblicato: ${r.data.nome_file}${c.firma ? ` — richieste di firma: ${r.data.firme_chieste || 0}` : ''}`, 'ok', 6000);
    _biglietti = {}; _bigliettiIl = 0;
    await apri();
  }

  /* ── segreteria e Coordinatore: chi ha preso visione ── */
  function quadro() {
    if (!_quadro.length) return '<div class="doc-card doc-pannello"><h3>Prese visione</h3><p class="doc-desc">Nessun documento pubblicato.</p></div>';
    const c = _conferma && _conferma.azione === 'ritira' ? _conferma : null;
    return '<div class="doc-card doc-pannello"><h3>Prese visione</h3><p class="doc-desc">Per ogni versione: a chi va adesso, chi l\'ha aperta e chi ha preso visione. Le versioni sostituite restano, con chi le aveva lette.</p>'
      + _quadro.map((q) => {
        const n = conta(q.persone);
        const f = q.richiede_firma;
        const statoP = (p) => {
          if (f) {
            const s = p.firma && p.firma.stato;
            return s === 'firmata' ? '<span class="doc-pill ok">firmato</span>' : s === 'rimandata' ? `<span class="doc-pill ap">rimandato: «${esc(p.firma.rimandata_motivo || '')}»</span>`
              : s ? '<span class="doc-pill da">da firmare</span>' : (p.destinatario ? '<span class="doc-pill da">firma non chiesta</span>' : '<span class="doc-piccolo">non più destinatario</span>');
          }
          return p.presa_il ? '<span class="doc-pill ok">presa visione</span>' : p.aperto_il ? '<span class="doc-pill ap">aperto</span>' : (p.destinatario ? '<span class="doc-pill da">da leggere</span>' : '<span class="doc-piccolo">non più destinatario</span>');
        };
        const quando = (p) => (f ? (p.firma && p.firma.firmata_il ? esc(dataOra(p.firma.firmata_il)) : '—') : (p.presa_il ? esc(dataOra(p.presa_il)) : '—'));
        const righe = (q.persone || []).map((p) => `<tr><td>${esc(p.nome)}</td><td class="n">${p.aperto_il ? esc(dataOra(p.aperto_il)) : '—'}</td><td class="n">${quando(p)}</td><td>${statoP(p)}</td></tr>`).join('');
        return `<details class="doc-q"${q.in_vigore ? ' open' : ''}><summary><b>${esc(q.titolo)}</b> · v${q.versione} · ${q.in_vigore ? `<span class="doc-pill ${n.prese === n.tot && n.tot ? 'ok' : 'da'}">${n.prese} su ${n.tot}</span>` : `<span class="doc-piccolo">sostituita il ${esc(dataOra(q.ritirato_il))}</span>`}</summary>
          <div class="doc-piccolo">Per: ${esc(nomeGruppi(q.destinatari))} · pubblicata il ${esc(dataOra(q.pubblicato_il))} da ${esc(q.pubblicato_da)} · ${esc(q.nome_file)} · impronta ${esc(String(q.sha256 || '').slice(0, 12))}…</div>
          <div class="doc-azioni">${link(q.id, '📄 Apri')}${_miei.pubblica && q.in_vigore && f && q.firme_mancanti > 0 ? `<button type="button" class="doc-btn pieno" data-doc-azione="chiedi-firme" data-doc-id="${q.id}">✍ Chiedi la firma a chi manca (${q.firme_mancanti})</button>` : ''}${_miei.pubblica && q.in_vigore ? `<button type="button" class="doc-btn rosso" data-doc-ritira="${q.id}">Ritira…</button>` : ''}</div>
          ${c && c.id === q.id ? `<div class="doc-conferma"><div>Ritiro <b>${esc(q.titolo)}</b> v${q.versione} senza sostituirla? Sparisce dall'elenco di chi la riceve; le prese visione già date restano.</div>
            <div class="doc-azioni"><button type="button" class="doc-btn rosso" data-doc-azione="ritira-si">Sì, ritira</button><button type="button" class="doc-btn" data-doc-azione="annulla">Annulla</button></div></div>` : ''}
          <div class="doc-tab"><table><thead><tr><th>Persona</th><th>Aperto il</th><th>${f ? 'Firmato il' : 'Presa visione il'}</th><th></th></tr></thead><tbody>${righe || '<tr><td colspan="4">Nessuno.</td></tr>'}</tbody></table></div></details>`;
      }).join('') + '</div>';
  }

  /* ════════ clic ════════ */
  async function clic(e) {
    const t = e.target;
    const ap = t.closest('[data-doc-apri]');
    if (ap) {
      // la funzione registra l'apertura quando serve il file: poco dopo si rilegge, e il pulsante si attiva
      const ricontrolla = () => leggi().then((ok) => { if (ok && aperta()) { disegna(); numero(); } }).catch(() => {});
      setTimeout(ricontrolla, 2500); setTimeout(ricontrolla, 8000);
      return;
    }
    const pr = t.closest('[data-doc-presa]');
    if (pr) {
      pr.disabled = true;
      const r = await radice.sb.rpc('doc_prendi_visione', { p_doc: Number(pr.dataset.docPresa) });
      if (r.error) { pr.disabled = false; avviso(r.error.message, 'err', 6000); return; }
      avviso('Presa visione registrata il ' + dataOra(r.data), 'ok', 4000);
      await apri();
      return;
    }
    const ri = t.closest('[data-doc-ritira]');
    if (ri) { _conferma = { azione: 'ritira', id: Number(ri.dataset.docRitira) }; disegna(); return; }
    const a = t.closest('[data-doc-azione]'); if (!a) return;
    const az = a.dataset.docAzione;
    if (az === 'annulla') { _conferma = null; disegna(); return; }
    if (az === 'pubblica-chiedi') {
      const f = leggiForm();
      const errore = controllaForm(f);
      if (errore) { avviso(errore, 'err', 5000); return; }
      _conferma = Object.assign({ azione: 'pubblica' }, f);
      const tit = f.titolo, des = f.descrizione, dest = f.destinatari, cosa = f.cosa;
      disegna();
      // la pagina si ridisegna: si rimettono i valori scritti (il file resta in _conferma)
      if ($('doc-f-cosa')) $('doc-f-cosa').value = cosa;
      if ($('doc-f-titolo')) $('doc-f-titolo').value = tit;
      if ($('doc-f-desc')) $('doc-f-desc').value = des;
      document.querySelectorAll('.doc-f-dest').forEach((x) => { x.checked = dest.includes(x.value); });
      if ($('doc-f-firma')) $('doc-f-firma').checked = !!f.firma;
      return;
    }
    if (az === 'chiedi-firme') {
      a.disabled = true;
      const r = await radice.sb.functions.invoke('documenti-personale', { body: { azione: 'chiedi_firme', id: Number(a.dataset.docId) } });
      if (r.error || !r.data || !r.data.ok) { a.disabled = false; avviso('Richieste di firma non partite: ' + ((r.data && r.data.error) || (r.error && r.error.message) || 'errore'), 'err', 8000); return; }
      avviso('Richieste di firma partite: ' + (r.data.chieste || 0), 'ok', 4000);
      await apri();
      return;
    }
    if (az === 'pubblica-si') {
      a.disabled = true;
      try { await pubblica(); } catch (err) { a.disabled = false; avviso('Non pubblicato: ' + err.message, 'err', 8000); }
      return;
    }
    if (az === 'ritira-si') {
      a.disabled = true;
      const r = await radice.sb.rpc('doc_ritira', { p_doc: _conferma.id });
      if (r.error) { a.disabled = false; avviso(r.error.message, 'err', 6000); return; }
      _conferma = null;
      avviso('Documento ritirato', 'ok', 3000);
      await apri();
    }
  }
  function cambio(e) {
    // «Nuova versione di…»: titolo e destinatari si propongono uguali alla versione in vigore
    if (e.target.id !== 'doc-f-cosa') return;
    const o = e.target.selectedOptions[0];
    if (!o || !o.value) return;
    if ($('doc-f-titolo')) $('doc-f-titolo').value = o.dataset.titolo || '';
    const dest = String(o.dataset.dest || '').split(',');
    document.querySelectorAll('.doc-f-dest').forEach((x) => { x.checked = dest.includes(x.value); });
  }

  /* ════════ stile ════════ */
  function stile() {
    if (!haDom || $('doc-stile')) return;
    const st = document.createElement('style'); st.id = 'doc-stile';
    st.textContent = `
.doc-wrap{max-width:820px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;text-align:left}
.doc-card{min-width:0;grid-template-columns:minmax(0,1fr)}.doc-card>*,.doc-q>*{min-width:0}.doc-piccolo,.doc-desc,.doc-testa b{overflow-wrap:anywhere}
.doc-titolo{margin:0;color:#565c66}
.doc-desc{font-size:13px;color:#555;margin:0}
.doc-ko{color:#c0392b}
.doc-card{background:#fff;border:1px solid #e3e4e6;border-radius:10px;padding:12px 14px;display:grid;gap:8px}
.doc-card.doc-nuovo{border-left:4px solid #e7500f}
.doc-vuoto{color:#6b7078;font-size:14px}
.doc-testa{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
.doc-testa b{font-size:15px;color:#2b2f35}
.doc-piccolo{font-size:12px;color:#6b7078}
.doc-azioni{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.doc-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid #e3e4e6;background:#fff;color:#2b2f35;border-radius:8px;padding:7px 12px;font:600 13px Barlow,sans-serif;cursor:pointer;text-decoration:none}
.doc-btn.pieno{background:#e7500f;border-color:#e7500f;color:#fff}.doc-btn:disabled{opacity:.5;cursor:not-allowed}
.doc-btn.rosso{border-color:#c0392b;color:#c0392b}
.doc-btn:focus-visible{outline:3px solid #e7500f;outline-offset:2px}
.doc-pill{display:inline-block;font:600 12px/1 Barlow,sans-serif;border-radius:50px;padding:5px 10px}
.doc-pill.ok{background:#eef6dc;color:#4f6d10}.doc-pill.da{background:#fff1ea;color:#b33b05}.doc-pill.ap{background:#fff7d6;color:#7a5b00}
.doc-prec{font-size:13px}.doc-prec summary{cursor:pointer;color:#565c66}
.doc-riga{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:6px 0;border-bottom:1px solid #eee}
.doc-pannello{border-left:4px solid #95c22f}.doc-pannello h3{margin:0;color:#565c66}
.doc-form{display:grid;gap:8px}.doc-form label{display:grid;gap:3px;font-size:13px;color:#565c66}
.doc-form input,.doc-form select,.doc-form textarea{font:14px Barlow,sans-serif;border:1px solid #e3e4e6;border-radius:6px;padding:6px 8px}
.doc-form fieldset{border:1px solid #e3e4e6;border-radius:6px;padding:6px 10px;display:flex;flex-wrap:wrap;gap:4px 14px}
.doc-form legend{font-size:13px;color:#565c66}
.doc-form .doc-check{display:flex;gap:5px;align-items:center}
.doc-conferma{border:1px solid #e7500f;background:#fff1ea;border-radius:8px;padding:9px 11px;font-size:13px;display:grid;gap:8px}
.doc-q{border-top:1px solid #eee;padding-top:8px}.doc-q summary{cursor:pointer;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.doc-q>*:not(summary){margin-top:6px}
.doc-tab{overflow-x:auto}.doc-tab table{width:100%;border-collapse:collapse;font-size:13px;min-width:480px}
.doc-tab th{text-align:left;font:600 11px/1 'Barlow Condensed',Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#6b7078;padding:7px 6px;border-bottom:1px solid #e3e4e6}
.doc-tab td{padding:6px;border-bottom:1px solid #eee}.doc-tab td.n{color:#6b7078;font-variant-numeric:tabular-nums}
`;
    document.head.appendChild(st);
  }

  /* ════════ aggancio ════════ */
  if (haDom) {
    let tentativi = 0;
    const prova = () => {
      if (radice.S && radice.S.user && radice.sb) { avvia().catch((e) => console.warn('documenti:', e)); return; }
      if (++tentativi < 240) setTimeout(prova, 500);
    };
    setTimeout(prova, 300);
    document.addEventListener('click', (e) => { if (aperta() && e.target.closest('#view-documenti')) clic(e).catch((err) => avviso('Errore: ' + err.message, 'err', 6000)); });
    document.addEventListener('change', (e) => { if (aperta()) cambio(e); });
    // tornando sull'app dopo aver letto il PDF in un'altra scheda, si rilegge
    document.addEventListener('visibilitychange', () => { if (!document.hidden && aperta() && _miei) leggi().then((ok) => { if (ok) { disegna(); numero(); } }).catch(() => {}); });
  }

  const api = { avvia, apri, statoDoc, quantiDaLeggere, codiceDa, codiceValido, conta, valutaPdf, nomeGruppi, visibile: () => !!(_miei && _miei.puo) };
  radice.documenti = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
