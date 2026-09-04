/* ============================================================
   RELAZIONE DI VISITA ALLO STAGISTA (fuori provincia)

   Chiesta dall'utente il 04/09/2026. Il tecnico trova questi
   incarichi nella pagina Incarichi e finora chiudeva la pratica
   scrivendo una mail a mano con il resoconto del sopralluogo:
   il testo restava nella posta di qualcuno e non nell'archivio.

   Qui invece compila una maschera che:
   - riprende dall'incarico i dati dello stagista, dell'azienda e
     il periodo di stage — non si riscrivono a mano;
   - raccoglie la relazione e tre pareri (azienda, tutor, ragazzo);
   - salva in s_visite_stage, cosi' la visita entra da sola nel
     riepilogo del mese da fatturare (tipo visita_stage);
   - CHIUDE l'incarico;
   - produce il PDF e una bozza di mail per chi ha chiesto la
     visita (i referenti della didattica, da s_config).

   ⚠️ Il parere sul TUTOR non esce nel PDF che va alla didattica:
   e' un giudizio su una persona che lavora nell'impresa, e
   l'impresa quel documento potrebbe leggerlo. Resta nel database
   per l'ufficio (stessa cautela della sigla VAL del vault).

   L'invio della mail resta a una persona, come ovunque qui: si
   scarica un .eml con l'allegato e si preme Invia da Outlook.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc_ = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');

  let corrente = null;      // l'incarico da cui si e' partiti
  let referenti = [];       // i referenti della didattica, da s_config
  let logoImg = null;       // il logo per la carta del PDF, precaricato

  /* Nell'incarico lo stagista sta in «testo_richiesta» (e' cosi' che
     arrivano dall'import Access: il campo porta il solo nominativo) e il
     periodo dentro «note_comunicazione» («stage dal 27 aprile al 27
     maggio ...»). Qui si prova a ricavarli, ma restano correggibili:
     e' una proposta, non un dato certo. */
  function stagistaDa(inc) {
    const t = String(inc.testo_richiesta || '').trim();
    if (!t || t.length > 60 || /\n/.test(t)) return '';
    return t;
  }
  function periodoDa(inc) {
    const n = String(inc.note_comunicazione || '');
    const m = n.match(/stage\s+(dal\s+[^,;\n]+?)(?=\s{2,}|[,;\n]|$)/i);
    return m ? m[1].trim() : '';
  }

  async function caricaReferenti() {
    if (referenti.length) return referenti;
    try {
      const { data } = await sb.from('s_config').select('valore').eq('chiave', 'didattica_referenti').maybeSingle();
      referenti = data?.valore ? JSON.parse(data.valore) : [];
    } catch (e) { console.warn('referenti didattica:', e); referenti = []; }
    return referenti;
  }

  /* ── apertura della maschera dall'incarico ── */
  async function apri(incaricoId) {
    const { data: inc, error } = await sb.from('incarichi').select('*').eq('id', incaricoId).maybeSingle();
    if (error || !inc) { toast('Incarico non trovato', 'err'); return; }
    corrente = inc;

    /* se la relazione era gia' stata compilata si riapre quella */
    const { data: gia } = await sb.from('s_visite_stage').select('*')
      .eq('incarico_id', incaricoId).order('id', { ascending: false }).limit(1);
    const v = (gia && gia[0]) || null;

    $('srel-info').innerHTML = '<strong>Incarico n. ' + inc.id + '</strong> — ' + esc_(inc.tipo_richiesta || '')
      + (inc.data_richiesta ? ' del ' + dIt(inc.data_richiesta) : '')
      + (inc.note_comunicazione ? '<div style="margin-top:4px;white-space:pre-wrap">' + esc_(inc.note_comunicazione) + '</div>' : '')
      + (v ? '<div style="margin-top:4px;color:#7aa527">Relazione gi&#224; salvata il ' + dIt(v.relazione_il || v.created_at) + ': la stai rivedendo.</div>' : '');

    $('srel-data').value = v?.data || new Date().toISOString().slice(0, 10);
    $('srel-azienda').value = v?.azienda || inc.impresa || '';
    $('srel-comune').value = v?.comune || inc.comune || '';
    $('srel-prov').value = v?.provincia || '';
    $('srel-stagista').value = v?.stagista || stagistaDa(inc);
    $('srel-tutor').value = v?.tutor || inc.referente || '';
    $('srel-periodo').value = v?.periodo_stage || periodoDa(inc);
    $('srel-rel').value = v?.relazione || '';
    $('srel-p-az').value = v?.parere_azienda || '';
    $('srel-p-tu').value = v?.parere_tutor || '';
    $('srel-p-st').value = v?.parere_stagista || '';

    const rr = await caricaReferenti();
    $('srel-dest').innerHTML = '<option value="">— scegli chi ha chiesto la visita —</option>'
      + rr.map((r) => '<option value="' + esc_(r.email) + '" data-nome="' + esc_(r.nome) + '"'
        + (v?.richiedente_email === r.email ? ' selected' : '') + '>' + esc_(r.nome) + ' — ' + esc_(r.email) + '</option>').join('');

    $('srel-salva').dataset.vid = v?.id || '';
    $('modal-stage-rel').classList.remove('hidden');
  }

  function chiudi() { $('modal-stage-rel').classList.add('hidden'); corrente = null; }

  function leggi() {
    const val = (id) => ($(id)?.value || '').trim();
    const sel = $('srel-dest');
    const opt = sel?.selectedOptions?.[0];
    return {
      data: val('srel-data'), azienda: val('srel-azienda'), comune: val('srel-comune') || null,
      provincia: (val('srel-prov') || '').toUpperCase() || null, stagista: val('srel-stagista') || null,
      tutor: val('srel-tutor') || null, periodo_stage: val('srel-periodo') || null,
      relazione: val('srel-rel') || null, parere_azienda: val('srel-p-az') || null,
      parere_tutor: val('srel-p-tu') || null, parere_stagista: val('srel-p-st') || null,
      richiedente: opt?.dataset?.nome || null, richiedente_email: sel?.value || null,
    };
  }

  /* ── il PDF ──
     Stessa carta dei rapporti del gestionale: banda arancio, logo,
     dati in riquadro, poi i testi. Il parere sul tutor NON entra. */
  function pdfRelazione(d, inc) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, L = 14, W = PW - 28;
    const ORANGE = [231, 80, 15], GREY = [86, 92, 102], NERO = [40, 40, 40];
    let y = 16;

    const font = (st, sz, col) => { doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(...(col || GREY)); };
    const salto = (h) => { if (y + h > 280) { doc.addPage(); y = 18; } };

    /* il logo si precarica all'avvio (vedi in fondo): se non e' ancora
       pronto o non c'e', la carta regge lo stesso e resta la sola
       intestazione a testo */
    try {
      if (logoImg && logoImg.complete && logoImg.naturalWidth) {
        const h = 13, w = h * logoImg.naturalWidth / logoImg.naturalHeight;
        doc.addImage(logoImg, 'PNG', L, y - 5, w, h);
      }
    } catch (_e) { /* la carta regge anche senza logo */ }

    font('bold', 13, ORANGE);
    doc.text('FORMEDIL PADOVA', L + 40, y + 2);
    font('normal', 8.5, GREY);
    doc.text('Area Sicurezza e Salute — Scuola Costruzioni Giuseppe Jappelli', L + 40, y + 7);
    doc.text('Via Basilicata 10 — 35127 Padova (PD) — tel. 049 761168', L + 40, y + 11);
    y += 20;
    doc.setDrawColor(...ORANGE); doc.setLineWidth(0.6); doc.line(L, y, PW - L, y);
    y += 9;

    font('bold', 14, NERO);
    doc.text('Relazione di visita allo stagista', L, y); y += 7;
    font('normal', 9, GREY);
    doc.text('Visita in azienda fuori provincia — incarico n. ' + inc.id
      + (inc.data_richiesta ? ' del ' + dIt(inc.data_richiesta) : ''), L, y);
    y += 9;

    /* riquadro dei dati */
    const righe = [
      ['Data della visita', dIt(d.data)],
      ['Azienda ospitante', d.azienda],
      ['Sede', [d.comune, d.provincia ? '(' + d.provincia + ')' : ''].filter(Boolean).join(' ')],
      ['Stagista', d.stagista],
      ['Tutor aziendale', d.tutor],
      ['Periodo di stage', d.periodo_stage],
      ['Tecnico', (window.S?.tecnico ? ((S.tecnico.tecnico_cognome || '') + ' ' + (S.tecnico.tecnico_nome || '')).trim() : '') || S?.user?.email || ''],
    ].filter((r) => r[1]);
    const hBox = righe.length * 6 + 6;
    salto(hBox);
    doc.setFillColor(247, 247, 247); doc.rect(L, y, W, hBox, 'F');
    let yy = y + 6;
    for (const [k, v] of righe) {
      font('normal', 8, GREY); doc.text(String(k), L + 4, yy);
      font('bold', 9, NERO); doc.text(doc.splitTextToSize(String(v), W - 54), L + 48, yy);
      yy += 6;
    }
    y += hBox + 8;

    const blocco = (titolo, testo) => {
      if (!testo) return;
      salto(18);
      doc.setFillColor(...ORANGE); doc.rect(L, y - 4, 2.6, 6, 'F');
      font('bold', 9.5, NERO); doc.text(String(titolo).toUpperCase(), L + 6, y);
      y += 6;
      font('normal', 9.5, NERO);
      const linee = doc.splitTextToSize(String(testo), W);
      for (const r of linee) { salto(6); doc.text(r, L, y); y += 4.8; }
      y += 5;
    };

    blocco('Relazione della visita', d.relazione);
    blocco('Parere sull\'azienda', d.parere_azienda);
    blocco('Parere sullo stagista', d.parere_stagista);
    /* il parere sul tutor resta fuori: vedi la nota in testa al file */

    salto(20);
    y += 4;
    font('normal', 8, GREY);
    doc.text('Documento prodotto dal gestionale visite del CPT — Area Sicurezza e Salute.', L, y);
    y += 4;
    doc.text('Padova, ' + dIt(new Date().toISOString().slice(0, 10)), L, y);

    return doc;
  }

  function nomeFile(d) {
    const pulito = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return String(d.data || '').replace(/-/g, '_') + '_REL_' + (pulito(d.stagista) || 'stagista')
      + '_visita-stage-' + (pulito(d.azienda) || 'azienda') + '.pdf';
  }

  /* ── la bozza di mail, con il PDF allegato ──
     X-Unsent: 1 fa aprire il file nella finestra di composizione di
     Outlook invece che come messaggio ricevuto: si rilegge e si
     preme Invia a mano. Stesso confine dell'app segreteria. */
  function scaricaEml(d, byteB64, nome) {
    const conf = 'FORMEDIL PADOVA - Area Sicurezza e Salute';
    const oggetto = conf + ' - Relazione visita allo stagista '
      + (d.stagista || '') + ' presso ' + (d.azienda || '')
      + (d.richiedente ? ' - alla c.a. ' + d.richiedente : '');
    const tec = (window.S?.tecnico ? ((S.tecnico.tecnico_cognome || '') + ' ' + (S.tecnico.tecnico_nome || '')).trim() : '') || '';
    const corpo = 'Gent.ma ' + (d.richiedente || '') + ',\r\n\r\n'
      + 'in allegato la relazione della visita effettuata il ' + dIt(d.data)
      + ' allo stagista ' + (d.stagista || '') + ' presso ' + (d.azienda || '')
      + (d.comune ? ' di ' + d.comune : '') + '.\r\n\r\n'
      + (d.periodo_stage ? 'Periodo di stage: ' + d.periodo_stage + '.\r\n\r\n' : '')
      + 'Cordiali saluti,\r\n' + (tec || 'Area Sicurezza e Salute') + '\r\n'
      + 'CPT — Area Sicurezza e Salute, Formedil Padova\r\n';

    const b = '----=_Parte_' + Date.now();
    const eml = [
      'X-Unsent: 1',
      'To: ' + (d.richiedente_email || ''),
      'Subject: ' + oggetto,
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="' + b + '"',
      '',
      '--' + b,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      corpo,
      '--' + b,
      'Content-Type: application/pdf; name="' + nome + '"',
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: attachment; filename="' + nome + '"',
      '',
      byteB64.replace(/(.{76})/g, '$1\r\n'),
      '--' + b + '--',
      '',
    ].join('\r\n');

    const url = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome.replace(/\.pdf$/, '') + '.eml';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function scaricaPdf(doc, nome) { doc.save(nome); }

  async function solopdf() {
    const d = leggi();
    if (!d.azienda) { toast('Serve almeno l\'azienda', 'warn'); return; }
    if (!window.jspdf?.jsPDF) { toast('Libreria PDF non caricata — ricarica la pagina', 'err'); return; }
    scaricaPdf(pdfRelazione(d, corrente), nomeFile(d));
  }

  async function salva(btn) {
    const d = leggi();
    if (!d.data || !d.azienda) { toast('Servono la data e l\'azienda', 'warn'); return; }
    if (!d.relazione) { toast('La relazione non puo\' restare vuota', 'warn'); return; }
    if (!d.richiedente_email) { toast('Scegli a chi va la relazione', 'warn'); return; }
    if (!window.jspdf?.jsPDF) { toast('Libreria PDF non caricata — ricarica la pagina', 'err'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Salvo…'; }
    try {
      const vid = $('srel-salva').dataset.vid;
      const riga = {
        ...d, tecnico_id: S.tecnico.tecnico_id, incarico_id: corrente.id,
        relazione_il: new Date().toISOString(),
        aggiornato_da: S.user?.email || null,
      };
      let salvata = null;
      if (vid) {
        const { data, error } = await sb.from('s_visite_stage').update(riga).eq('id', +vid).select('*').maybeSingle();
        if (error) throw new Error(error.message);
        salvata = data;
      } else {
        const { data, error } = await sb.from('s_visite_stage')
          .insert({ ...riga, creato_da: S.user?.email || null }).select('*').maybeSingle();
        if (error) throw new Error(error.message);
        salvata = data;
      }

      /* l'incarico si chiude: e' la relazione a evaderlo, non una visita */
      const { error: eInc } = await sb.rpc('incarichi_set_stato', { p_id: corrente.id, p_stato: 'chiuso' });
      if (eInc) console.warn('chiusura incarico:', eInc);

      const doc = pdfRelazione(d, corrente);
      const nome = nomeFile(d);
      scaricaPdf(doc, nome);
      scaricaEml(d, doc.output('datauristring').split(',')[1], nome);

      toast('Relazione salvata' + (eInc ? ' (incarico da chiudere a mano)' : ', incarico chiuso') + ': PDF e bozza mail scaricati', 'ok');
      chiudi();
      if (typeof loadIncarichi === 'function') loadIncarichi().catch(() => {});
      if (typeof loadStageSr === 'function') loadStageSr().catch(() => {});
      return salvata;
    } catch (e) {
      toast('Salvataggio non riuscito: ' + e.message, 'err');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salva, chiudi l\'incarico e prepara la mail'; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    /* jsPDF vuole un'immagine gia' caricata: la si prende adesso, non
       nel momento in cui si stampa */
    logoImg = new Image();
    logoImg.onerror = () => { logoImg = null; };
    logoImg.src = 'logo_formedil.png';
    $('srel-annulla')?.addEventListener('click', chiudi);
    $('srel-solopdf')?.addEventListener('click', solopdf);
    $('srel-salva')?.addEventListener('click', (e) => salva(e.currentTarget));
  });

  /* Quali incarichi hanno la relazione al posto del rapporto: quelli di
     tipo stage/audit in azienda. Il tipo e' testo libero, quindi si
     riconosce dalla parola, non da un codice. */
  window.stageRelPertinente = (r) => /stage/i.test(String(r?.tipo_richiesta || ''));
  window.stageRelApri = apri;
  /* esposta anche per provare il foglio senza passare dal database */
  window.stageRelPdf = pdfRelazione;
})();
