/* ============================================================
   Verbale di sopralluogo in PDF — stile «ciclo con rilievi» (13/09/2026)

   genPDF in index.html carica i dati della visita e recupera foto, firme,
   logo, QR e campagna; poi chiama VerbalePDF.prepara() per i calcoli e
   VerbalePDF.crea() per il disegno. Qui dentro non c'è né rete né database:
   tutto arriva già pronto, così lo stesso file gira nel browser e in Node
   (per le prove).

   Stile scelto dall'utente il 13/09/2026 fra le proposte in
   proposte_grafiche/2026_09_11_verbale-sopralluogo/ (banco_di_prova/stili.mjs):
   veste «ciclo» con la check-list divisa in «Rilievi da sanare» e «Voci
   verificate conformi»; barre grigie, quadratini delle voci conformi verdi
   come le pastiglie VER.

   ⚠️ I calcoli di prepara() (IPC, messaggi, articoli, note di sottoarea,
   sanzioni) sono gli stessi del verbale di prima e di calcIPC nell'app:
   chi cambia una regola la cambia anche lì.
   ============================================================ */
(function (root) {
  'use strict'

  const PH = 297

  // ── tabelle di decodifica ──
  // ZONE_LBL e TIPO_IMP_OPT vengono da app-data.js quando c'è (browser); le copie servono alle prove in Node
  const ZONE = typeof ZONE_LBL !== 'undefined' ? ZONE_LBL : { 1: 'Impianti di cantiere', 2: 'Protezione luoghi di lavoro', 3: 'Apparecchi di sollevamento', 4: 'Attrezzature, scale, utensili', 5: 'Macchine di cantiere', 6: 'Opere provvisionali', 7: 'DPI', 8: 'Documentazione', 9: 'Soggetti', 10: 'Formazione' }
  const RUOLI_IMP = typeof TIPO_IMP_OPT !== 'undefined' ? TIPO_IMP_OPT : { 1: 'Affidataria', 2: 'Affidataria ed esecutrice', 3: 'Esecutrice' }
  const TIPO_ACC = { 1: 'Su segnalazione', 2: 'Su richiesta', 3: 'Per protocolli di intesa', 4: 'Indicata da RLS/RLST', 5: 'Programmata', 6: 'Cantiere qualità', 7: 'Indicata dal CPT' }
  const TIP_INT = { 1: 'Costruzione', 2: 'Ristrutturazione', 3: 'Demolizione', 4: 'Ampliamento', 5: 'Altro' }
  const TIP_OPE = { 1: 'Industriale', 2: 'Civile', 3: 'Commerciale', 5: 'Stradale', 8: 'Scolastica', 16: 'Altro' }
  const IMP_LBL = { 1: 'fino a 250.000', 2: 'da 250.001 a 500.000', 3: 'da 500.001 a 1.000.000', 4: 'da 1.000.001 a 1.500.000', 5: 'da 1.500.001 a 2.500.000', 6: 'da 2.500.001 a 3.500.000', 7: 'da 3.500.001 a 5.000.000', 8: 'da 5.000.001 a 10.000.000', 9: 'da 10.000.001 a 15.000.000', 10: 'oltre 15.000.000', 11: 'non disponibile' }
  const DUR_LBL = { 1: '< 30 giorni', 2: 'da 30 a 90 giorni', 3: 'da 3 a 6 mesi', 4: 'da 6 a 12 mesi', 5: '> 12 mesi' }
  const PREF_LBL = { IMP_LOG: 'Logistica', IMP_IGS: 'Apprestamenti igienico-sanitari e di sicurezza', IMP_ELE: 'Impianti elettrici', IMP_AGI: 'Agibilità del cantiere', IMP_ORG: 'Organizzazione del lavoro', IMP_SEG: 'Segnaletica', IMP_CON: 'Condizioni al contorno', PLL_SCA: 'Aree di scavo', PLL_DEM: 'Aree di demolizione', PLL_OCA: 'Altre aree di pericolo', PLL_PER: 'Opere in c.a.', SOL_GRU: 'Gru', SOL_AUT: 'Autogru / Gru su autocarro', SOL_ARG: 'Argano', SOL_PIA: 'Piattaforme di lavoro elevabili', SOL_ASO: 'Altri apparecchi di sollevamento', ASU_ATT: 'Attrezzature', ASU_SCA: 'Scale', ASU_UTE: 'Utensili', MAC_MAS: 'Macchine movimento terra', MAC_MMM: 'Macchine movimentazione materiale', MAC_MMT: 'Macchine stradali', OPE_POF: 'Ponteggi fissi', OPE_POS: 'Ponteggi sospesi', OPE_POC: 'Ponti su cavalletti', OPE_POT: 'Ponti su ruote – trabattelli', OPE_DPC: 'Altri DPC', PIN_IND: 'Indumenti di protezione', PIN_TES: 'Protezione della testa', PIN_PIE: 'Protezione dei piedi', PIN_MAN: 'Protezione delle mani', PIN_UDI: "Protezione dell'udito", PIN_CAD: "Protezione controllo caduta dall'alto", PIN_OCC: 'Protezione degli occhi', PIN_RES: 'Protezione delle vie respiratorie', DOC_GEN: 'Generale', DOC_GEN_SOL: 'Apparecchi di sollevamento', DOC_MA4: 'Macchine e attrezzature', DOC_ELE: 'Impianto elettrico e di terra', DOC_PON: 'Ponteggi', SOG_FIG: 'Nomine di figura di sistema', FOR_BAS: 'Formazione di base', FOR_FIG: 'Figura di sistema', FOR_RIS: 'Form./addes. rischi specifici', FOR_ATM: 'Form./addes. attrezzature/macchine' }

  const GDPR = 'Ai sensi del Regolamento (UE) 2016/679 (GDPR) relativo alla protezione delle persone fisiche con riguardo al trattamento dei dati personali, la presente comunicazione è destinata unicamente alle persone sopra indicate e le informazioni in essa contenute sono da considerarsi strettamente riservate. Se avete ricevuto questo messaggio per errore, siete pregati di rispedirlo al mittente, distruggendo qualunque copia in Vostro possesso, grazie.'
  const METODO = [
    "METODOLOGIA DI VALUTAZIONE INTERNA – CNCPT. CRITERI DI GIUDIZIO CHE IL TECNICO USA NELL'EFFETTUAZIONE DELLA VISITA DI CONSULENZA TECNICA IN CANTIERE",
    'NC+  inadempienze che espongono i lavoratori ad un rischio grave ed imminente (mancanza totale di parapetti su un ponteggio esteso);',
    'NC-  inadempienze che espongono i lavoratori ad un rischio generico (mancanza totale recinzione di cantiere);',
    'OSS  inadempienze la cui presenza non espone ad alcun rischio diretto (mancanza ricovero per attrezzi);'
  ]

  const C = {
    arancio: [231, 80, 15], grigio: [86, 92, 102], tenue: [139, 145, 153], linea: [213, 216, 220], bordo: [196, 200, 206],
    zebra: [247, 247, 249], scuro: [40, 40, 40], bianco: [255, 255, 255], pietra: [240, 238, 233], etichetta: [195, 200, 206],
    fondo: [240, 241, 243]
  }
  const COL_VAL = { 'NC+': [200, 30, 30], 'NC-': [231, 80, 15], OSS: [176, 130, 0], VER: [39, 150, 85] }

  // impaginazione
  const S = {
    L: 22, R: 196, top: 16,
    margini: { left: 22, right: 14, top: 16, bottom: 20 },
    tabella: {
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: { top: 1.7, bottom: 1.7, left: 1.6, right: 1.6 }, textColor: C.scuro, lineColor: C.linea, lineWidth: { bottom: 0.2 } },
      headStyles: { fontSize: 5.8, textColor: C.tenue, fontStyle: 'normal', lineColor: C.grigio, lineWidth: { bottom: 0.45 } },
      alternateRowStyles: { fillColor: C.zebra }
    },
    etichettaCella: { fontSize: 6, textColor: C.tenue },
    tabellaCheck: {
      theme: 'plain',
      styles: { fontSize: 7.2, cellPadding: { top: 1.5, bottom: 1.5, left: 1.6, right: 1.6 }, textColor: C.scuro, lineColor: C.linea, lineWidth: { bottom: 0.2 } },
      headStyles: { fontSize: 6.4, textColor: C.tenue, fontStyle: 'bold', cellPadding: { top: 2.2, bottom: 1, left: 1.6, right: 1.6 } }
    }
  }

  // ════════════════════════════════════════════════════════════
  // DATI: i calcoli del verbale
  // D = { v, imps, chk, lavs, voci, tec2, rettBanner }
  // ════════════════════════════════════════════════════════════
  function prepara(D) {
    const v = D.v, cant = v.cantieri || {}
    const imps = D.imps || [], chk = D.chk || [], lavs = D.lavs || []
    const voci = (D.voci || []).slice()
    const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('it-IT') : '')
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    const gg = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
    const leggibile = (s) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : `${gg[d.getDay()]} ${d.getDate()} ${mesi[d.getMonth()]} ${d.getFullYear()}` }
    const oggi = new Date()
    const dataOggi = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`

    const impPrinc = imps[0] || null
    const tecNome = v.tecnici ? `${v.tecnici.tecnico_nome || ''} ${v.tecnici.tecnico_cognome || ''}`.trim() : ''
    const tec2 = D.tec2 || null
    const cantLabel = cant.cantiere_etichetta || `${cant.cantiere_indirizzo || ''} ${cant.cantiere_civico || ''}`.trim()
    const comune = cant.comune_nome || ''
    const chkMap = {}
    chk.forEach((r) => { chkMap[r.codice] = { valore: r.valore, nota: r.nota } })

    const imprese = imps.map((im, i) => ({
      n: i + 1,
      nome: (im.imprese && im.imprese.impresa_nome) || '–',
      ruolo: RUOLI_IMP[im.tipo_imp] || im.ruolo || '–',
      piva: (im.imprese && im.imprese.piva) || (im.impresa_id && !/^\d{1,6}$/.test(im.impresa_id) ? im.impresa_id : '') || '–',
      cf: (im.imprese && im.imprese.impresa_cf) || '–',
      nrLav: +im.nr_lav || 0,
      email: (im.imprese && im.imprese.impresa_email_ref) || '–',
      note: (im.note_fasilav || '').trim()
    }))
    const figure = []
    const fig = (ruolo, nome, email, tel) => { if (!nome && !email && !tel) return; figure.push([ruolo, nome || '–', email || '–', tel || '–']) }
    if (v.nom_ppre) fig('Persona presente', v.nom_ppre + (v.qual_ppre ? ` (${v.qual_ppre})` : ''), '', v.tel_ppre || '')
    fig('Resp. dei lavori', v.resp_lav, v.rl_email, v.rl_tel)
    fig('CSP', v.csp, v.csp_email, v.csp_tel)
    fig('CSE', v.cse, v.cse_email, v.cse_tel)

    const cantiere = [
      ['Indirizzo', cant.cantiere_indirizzo || '–', 'N° civico', cant.cantiere_civico || '–'],
      ['Comune', cant.comune_nome || '–', 'CAP', cant.cantiere_cap || '–'],
      ['Tipo intervento', TIP_INT[cant.cantiere_tip_int] || '–', 'Tipo opera', TIP_OPE[cant.cantiere_tip_ope] || '–'],
      ['Importo lavori (€)', IMP_LBL[cant.cantiere_importo] || '–', 'Durata cantiere', DUR_LBL[cant.cantiere_durata] || '–'],
      ['Codice CNCE', cant.cantiere_cnce || '–', 'Codice univoco', cant.nodo_id || '–'],
      ['N° imprese in cantiere', String(imps.filter((im) => im.impresa_id).length || v.nr_imp || 1), 'Totale lavoratori', String(imps.reduce((s, im) => s + (+im.nr_lav || 0), 0) || v.nr_lavoratori || 0)]
    ]
    const lavorazioni = lavs.length ? lavs.map((l) => [l.genere, l.fase, l.lavorazione].filter(Boolean).join(' - ')).filter(Boolean).join('; ') : '–'

    // IPC — logica ufficiale Formedil (identica a calcIPC dell'app)
    const conta = (x) => chk.filter((r) => r.valore === x).length
    const ncp = conta('NC+'), ncn = conta('NC-'), oss = conta('OSS'), ver = conta('VER')
    let label, bg
    if (ncp >= 1 || ncn > 3) { label = 'ALTO'; bg = [200, 30, 30] }
    else if (oss > 6 || (ncn >= 1 && ncn <= 3)) { label = 'MEDIO'; bg = [231, 80, 15] }
    else if (oss >= 1 && oss <= 6) { label = 'BASSO'; bg = [210, 170, 0] }
    else { label = 'NESSUN RILIEVO'; bg = [39, 174, 96] }
    const grave = label === 'ALTO' || label === 'MEDIO'
    const msg = grave
      ? "Per quanto osservato in cantiere, si invita l'impresa ad attivare immediatamente le procedure atte ad eliminare i rischi riscontrati. Si precisa che l'attività di consulenza tecnica erogata non solleva l'Impresa dalle proprie responsabilità per il mancato adempimento delle prescrizioni di legge."
      : label === 'BASSO'
        ? "Vogliate tener conto delle osservazioni sopra riportate. Si invita l'impresa ad attivare le procedure atte ad eliminare i rischi riscontrati. Si precisa che l'attività di consulenza tecnica erogata non solleva l'Impresa dalle proprie responsabilità per il mancato adempimento delle prescrizioni di legge."
        : 'Il cantiere risulta in buone condizioni di sicurezza.'
    const tinta = label === 'ALTO' ? [252, 235, 235] : label === 'MEDIO' ? [255, 241, 230] : label === 'BASSO' ? [255, 250, 225] : [233, 246, 236]

    // check-list: zona → sottoarea → voci valorizzate (niente NA) + nota di sottoarea
    // (nei verbali importati la nota sta in coda alla sottoarea, sulle voci is_nota *_N / *_M)
    const notePref = {}
    voci.filter((x) => x.is_nota).forEach((x) => {
      const t = ((chkMap[x.codice] && chkMap[x.codice].nota) || '').trim()
      if (!t) return
      const z = x.zona_osserv, p = x.prefisso || '_'
      notePref[z] = notePref[z] || {}
      notePref[z][p] = (notePref[z][p] ? notePref[z][p] + ' ' : '') + t
    })
    const perZona = {}
    voci.filter((x) => !x.is_nota).forEach((x) => {
      const z = x.zona_osserv, p = x.prefisso || '_'
      perZona[z] = perZona[z] || {}
      ;(perZona[z][p] = perZona[z][p] || []).push(x)
    })
    let sanzione = 0
    const zone = []
    for (const z of Object.keys(perZona).map(Number).sort((a, b) => a - b)) {
      const gruppi = []
      for (const [p, lista] of Object.entries(perZona[z])) {
        const voce = []
        for (const x of lista) {
          const r = chkMap[x.codice] || {}
          const val = r.valore && r.valore !== 'NA' ? r.valore : null
          if (!val) continue
          const viol = ['OSS', 'NC+', 'NC-'].includes(val)
          if (viol && x.importo_sanzione) sanzione += Number(x.importo_sanzione)
          voce.push({ desc: x.descrizione || '', val, nota: r.nota || '', articolo: viol && x.articolo ? x.articolo : '' })
        }
        const nota = (notePref[z] || {})[p] || ''
        if (voce.length || nota) gruppi.push({ label: PREF_LBL[p] || p, voci: voce, nota })
      }
      if (gruppi.length) zone.push({ label: ZONE[z] || String(z), gruppi })
    }
    const eur = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    return {
      dataOggi, rettBanner: D.rettBanner || null,
      bozza: (v.stato || 'bozza') === 'bozza',   // 23/09/2026: il PDF della bozza lo dice su ogni pagina
      impNome: (impPrinc && impPrinc.imprese && impPrinc.imprese.impresa_nome) || (v.imprese && v.imprese.impresa_nome) || '',
      cantDetail: [cantLabel, comune].filter(Boolean).join(' – '),
      dataVisita: fmtDate(v.data_visita) || '–',
      tecNome, tecEmail: (v.tecnici && v.tecnici.email) || '',
      tec2Nome: tec2 ? `${tec2.tecnico_nome || ''} ${tec2.tecnico_cognome || ''}`.trim() : '', tec2Email: (tec2 && tec2.email) || '',
      stagista: v.stage_vis && v.nom_stage ? v.nom_stage : '',
      tipoAcc: TIPO_ACC[v.tipo_accesso] || '–', accesso: v.acc_cant ? String(v.acc_cant) : '–',
      etichetta: cant.cantiere_etichetta || '–', nrVerbale: v.nr_verbale || '–',
      imprese, figure, cantiere, lavorazioni, noteLav: (v.note_lav || '').trim() || '–',
      ipc: { label, bg, ncp, ncn, oss, ver, msg, tinta },
      ossTec: (v.oss_tec || '').replace(/\r/g, '').trim(),
      zone,
      sanzione: sanzione > 0 ? { max: '€ ' + eur(sanzione), ridotta: '€ ' + eur(sanzione / 4) } : null,
      corpo: [
        `Il giorno ${leggibile(v.data_visita) || fmtDate(v.data_visita) || '–'} è passato nel vostro cantiere in oggetto, per fornirvi utili consigli in materia di prevenzione infortuni, uno dei nostri tecnici${tecNome ? ', ' + tecNome : ''}.`,
        'Egli si è soffermato ad illustrare al VS personale in cantiere le più importanti norme che devono essere tenute presenti per garantire la sicurezza durante le varie fasi lavorative, con particolare riferimento a quelle in corso.',
        'In base a quanto previsto dalle norme che regolano il funzionamento dello scrivente Comitato Paritetico Territoriale potrà essere effettuata, entro breve termine, una successiva visita per constatare che i consigli forniti siano stati correttamente attuati.'
      ]
    }
  }

  // ════════════════════════════════════════════════════════════
  // PRIMITIVE
  // ════════════════════════════════════════════════════════════
  function f(doc, stile, size, colore) { doc.setCharSpace(0); doc.setFont('helvetica', stile || 'normal'); doc.setFontSize(size || 9); doc.setTextColor(...(colore || C.grigio)) }
  function spaziato(doc, testo, x, y, size, colore, cs, stile) { f(doc, stile, size, colore); doc.setCharSpace(cs == null ? 0.5 : cs); doc.text(testo, x, y); doc.setCharSpace(0) }
  const righe = (doc, s, w) => doc.splitTextToSize(String(s == null ? '' : s), w)
  const hRiga = (size, fattore) => size * 0.3528 * (fattore || 1.25)
  /* larghezza e altezza dall'intestazione JPEG, senza caricare l'immagine.
     Si legge tutto il file: nel logo i metadati spingono l'intestazione oltre i primi
     kB, e col solo inizio si ripiegava sul 4:3 schiacciando il logo (prova del 13/09) */
  function jpegSize(uri) {
    try {
      const b64 = uri.includes(',') ? uri.split(',')[1] : uri
      const b = Uint8Array.from(atob(b64.slice(0, 400000)), (c) => c.charCodeAt(0))
      let j = 2
      while (j < b.length - 9) {
        if (b[j] !== 0xff) break
        const m = b[j + 1], len = (b[j + 2] << 8) | b[j + 3]
        if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { w: (b[j + 7] << 8) | b[j + 8], h: (b[j + 5] << 8) | b[j + 6] }
        j += 2 + len
      }
    } catch (e) { /* 4:3 */ }
    return { w: 4, h: 3 }
  }
  function formato(uri) { return String(uri).slice(0, 30).includes('png') ? 'PNG' : 'JPEG' }

  /* logo a destra; senza immagine resta il nome dell'ente */
  function logo(doc, uri, xDestra, y, w) {
    if (uri) {
      try {
        const fmt = formato(uri)
        const dim = fmt === 'JPEG' ? jpegSize(uri) : { w: 600, h: 193 }
        doc.addImage(uri, fmt, xDestra - w, y, w, w * dim.h / dim.w)
        return
      } catch (e) { /* sotto, il nome */ }
    }
    f(doc, 'bold', 11, C.arancio); doc.text('FORMEDIL PADOVA', xDestra, y + 6, { align: 'right' })
  }
  function firmaUfficio(doc, x, y, w) {
    f(doc, 'bold', 8.5, C.scuro); doc.text('Renato Squizzato', x, y + 4)
    f(doc, 'bold', 7.5, C.arancio); doc.text('Area Sicurezza e Salute | FORMEDIL PADOVA', x, y + 9)
    f(doc, 'normal', 7.2, C.grigio)
    doc.text('Via Basilicata 10 – 35127 Padova (PD)', x, y + 14, { maxWidth: w })
    doc.text('email: cpt@formedilpadova.it · cptpd@did.formedilpadova.it', x, y + 18.5, { maxWidth: w })
    doc.text('www.formedilpadova.it   Tel. 049 - 761168 (int.4)', x, y + 23, { maxWidth: w })
    f(doc, 'normal', 6, C.tenue)
    doc.text(righe(doc, 'Organismo Accreditato Regione Veneto per la formazione – L.R. n. 19/02 cod. AO119 – per i servizi al lavoro cod. L236', w), x, y + 28)
  }
  function qrServizi(doc, uri, x, y, lato) {
    if (!uri) return
    try { doc.addImage(uri, 'PNG', x, y, lato, lato) } catch (e) { return }
    f(doc, 'bold', 5, C.arancio); doc.text('FORMEDIL PADOVA · CPT', x + lato / 2, y + lato + 3, { align: 'center' })
    f(doc, 'normal', 4.5, C.grigio); doc.text('I NOSTRI SERVIZI', x + lato / 2, y + lato + 6.5, { align: 'center' })
    f(doc, 'normal', 3.8, [150, 150, 150]); doc.text('formedilpadovacpt.github.io/servizi/#', x + lato / 2, y + lato + 9.5, { align: 'center' })
  }
  function rettifica(doc, x, y, w, testo) {
    doc.setDrawColor(...C.arancio); doc.setLineWidth(0.5); doc.setFillColor(253, 236, 228)
    doc.roundedRect(x, y, w, 13, 1.5, 1.5, 'FD')
    f(doc, 'bold', 10, C.arancio); doc.text('VERBALE RETTIFICATO', x + 4, y + 5.5)
    f(doc, 'normal', 8.5, [120, 60, 30]); doc.text(testo, x + 4, y + 10)
  }
  /* riquadro di testo che si spezza fra le pagine, con barra laterale colorata */
  function riquadro(doc, st, testo, o) {
    o = o || {}
    doc.autoTable({
      startY: st.y, margin: S.margini, theme: 'plain',
      head: o.titolo ? [[{ content: o.titolo }]] : [],
      body: [[{ content: testo }]],
      styles: { fontSize: o.size || 8, cellPadding: { top: 2, bottom: 2.4, left: 5, right: 3 }, textColor: C.scuro, fillColor: o.bg || C.fondo, fontStyle: o.italic ? 'italic' : 'normal', lineWidth: 0 },
      headStyles: { fontSize: 7.5, fontStyle: 'bold', textColor: o.titoloColore || C.scuro, fillColor: o.bg || C.fondo, cellPadding: { top: 2.6, bottom: 0.4, left: 5, right: 3 } },
      didDrawCell: (c) => { if (o.barra) { doc.setFillColor(...o.barra); doc.rect(c.cell.x, c.cell.y, 1.4, c.cell.height, 'F') } }
    })
    st.y = doc.lastAutoTable.finalY + 3
  }
  /* valore del rilievo come pastiglia colorata */
  function pastiglia(doc, c) {
    const val = c.cell.raw
    if (c.section !== 'body' || typeof val !== 'string' || !COL_VAL[val]) return
    const w = 12, h = 4.4, x = c.cell.x + (c.cell.width - w) / 2, y = c.cell.y + (c.cell.height - h) / 2
    doc.setFillColor(...COL_VAL[val]); doc.roundedRect(x, y, w, h, 1.1, 1.1, 'F')
    f(doc, 'bold', 6.8, C.bianco); doc.text(val, x + w / 2, y + 3.1, { align: 'center' })
  }
  function nuovaPaginaSe(doc, st, limite) { if (st.y > limite) { doc.addPage(); st.y = S.top } }

  // ════════════════════════════════════════════════════════════
  // PAGINA 1 — LETTERA DI ACCOMPAGNAMENTO
  // ════════════════════════════════════════════════════════════
  function lettera(doc, d, img) {
    const L = S.L, R = S.R, W = R - L
    logo(doc, img.logo, R, 13, 50)
    spaziato(doc, 'AREA SICUREZZA E SALUTE', L, 19, 7.5, C.arancio, 0.6)
    f(doc, 'normal', 9.5, C.tenue); doc.text(`Padova, ${d.dataOggi}`, L, 25)
    let y = 42
    if (d.rettBanner) { rettifica(doc, L, y, W, d.rettBanner); y += 19 }
    spaziato(doc, 'SPETT.LE IMPRESA', 116, y, 7, C.tenue, 0.5)
    f(doc, 'bold', 11, C.scuro)
    const dn = righe(doc, d.impNome || '–', R - 116)
    doc.text(dn, 116, y + 6)
    y += 6 + dn.length * 4.9 + 16
    spaziato(doc, 'PREVENZIONE INFORTUNI', L, y, 7.5, C.arancio, 0.6)
    y += 8
    f(doc, 'bold', 17, C.grigio)
    const ct = righe(doc, d.cantDetail ? 'Cantiere di ' + d.cantDetail : 'Cantiere', W)
    doc.text(ct, L, y)
    y += ct.length * 7 + 4
    doc.setDrawColor(...C.linea); doc.setLineWidth(0.3); doc.line(L, y, R, y)
    y += 10
    f(doc, 'normal', 10.5, C.scuro)
    for (const p of d.corpo) { const r = righe(doc, p, W); doc.text(r, L, y, { lineHeightFactor: 1.4 }); y += r.length * hRiga(10.5, 1.4) + 4.5 }
    y += 3; doc.text('Distinti saluti.', L, y); y += 16
    firmaUfficio(doc, L, y, W - 48)
    qrServizi(doc, img.qr, R - 32, y - 2, 32)
    f(doc, 'italic', 5.8, C.tenue); doc.text(righe(doc, GDPR, W), L, 262)
  }

  // ════════════════════════════════════════════════════════════
  // DALLA PAGINA 2 — IL VERBALE
  // ════════════════════════════════════════════════════════════
  function sezioniDati(doc, st, d, titolo) {
    titolo('Imprese presenti in cantiere')
    const imp = []
    d.imprese.forEach((im) => {
      imp.push([String(im.n), im.nome, im.ruolo, im.piva, im.cf, String(im.nrLav), im.email])
      if (im.note) imp.push([{ content: 'Note fasi/lavorazione (questa impresa): ' + im.note, colSpan: 7, styles: { fontSize: 7, fontStyle: 'italic', textColor: [90, 90, 90] } }])
    })
    if (!imp.length) imp.push([{ content: 'Nessuna impresa registrata', colSpan: 7, styles: { halign: 'center', textColor: C.tenue } }])
    doc.autoTable({
      startY: st.y, margin: S.margini, ...S.tabella,
      head: [['N°', 'RAGIONE SOCIALE', 'RUOLO', 'P.IVA', 'CODICE FISCALE', 'N° LAV.', 'EMAIL VERBALE']],
      body: imp,
      columnStyles: { 0: { cellWidth: 7, halign: 'center', textColor: C.tenue }, 1: { fontStyle: 'bold' }, 2: { cellWidth: 25 }, 3: { cellWidth: 22 }, 4: { cellWidth: 23 }, 5: { cellWidth: 11, halign: 'center' }, 6: { cellWidth: 38, fontSize: 6.8 } }
    })
    st.y = doc.lastAutoTable.finalY + 5
    if (d.figure.length) {
      titolo('Figure di sistema')
      doc.autoTable({
        startY: st.y, margin: S.margini, ...S.tabella,
        head: [['RUOLO', 'NOMINATIVO', 'EMAIL', 'TEL.']],
        body: d.figure,
        columnStyles: { 0: { cellWidth: 32, textColor: C.tenue }, 1: { cellWidth: 58, fontStyle: 'bold' }, 3: { cellWidth: 28 } }
      })
      st.y = doc.lastAutoTable.finalY + 5
    }
    titolo('Dati del cantiere')
    const et = (t) => ({ content: t.toUpperCase(), styles: S.etichettaCella })
    const val = (t) => ({ content: t, styles: { fontStyle: 'bold' } })
    doc.autoTable({
      startY: st.y, margin: S.margini, ...S.tabella, head: [],
      body: [
        ...d.cantiere.map(([a, b, c2, e]) => [et(a), val(b), et(c2), val(e)]),
        [et('Lavorazioni in corso'), { content: d.lavorazioni, colSpan: 3 }],
        [et('Note lavorazioni'), { content: d.noteLav, colSpan: 3 }]
      ],
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 52 }, 2: { cellWidth: 36 } }
    })
    st.y = doc.lastAutoTable.finalY + 5
  }

  function sezioneChecklist(doc, st, d, testataZona, soloValori) {
    for (const zona of d.zone) {
      const gruppi = zona.gruppi.map((g) => ({ ...g, voci: g.voci.filter((x) => !soloValori || soloValori.includes(x.val)) }))
        .filter((g) => g.voci.length || (g.nota && !soloValori) || (g.nota && soloValori && g.mostraNota))
      if (!gruppi.length) continue
      nuovaPaginaSe(doc, st, PH - 40)
      testataZona(zona.label)
      for (const g of gruppi) {
        const rows = []
        for (const x of g.voci) {
          rows.push([x.desc, x.val, x.nota])
          if (x.articolo) rows.push([{ content: x.articolo, colSpan: 3, styles: { fontSize: 6.5, fontStyle: 'italic', textColor: [160, 90, 20], fillColor: [255, 248, 240], cellPadding: { top: 0.3, bottom: 1.8, left: 4, right: 2 } } }])
        }
        if (g.nota) rows.push([{ content: 'Nota: ' + g.nota, colSpan: 3, styles: { fontSize: 6.8, fontStyle: 'italic', textColor: [70, 70, 70], fillColor: [247, 247, 247], cellPadding: { top: 1.5, bottom: 1.5, left: 4, right: 2 } } }])
        doc.autoTable({
          startY: st.y, margin: S.margini, ...S.tabellaCheck,
          head: [[{ content: g.label.toUpperCase(), colSpan: 3 }]],
          body: rows,
          columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 17, halign: 'center' }, 2: {} },
          didParseCell: (c) => { if (c.section === 'body' && c.column.index === 1 && COL_VAL[c.cell.raw]) c.cell.text = [''] },
          didDrawCell: (c) => { if (c.column.index === 1) pastiglia(doc, c) }
        })
        st.y = doc.lastAutoTable.finalY + 1.5
      }
      st.y += 2.5
    }
  }

  function metodologia(doc, st) {
    if (st.y + 30 > PH - 20) { doc.addPage(); st.y = S.top }
    const W = S.R - S.L
    doc.setFillColor(...C.pietra); doc.rect(S.L, st.y, W, 27, 'F')
    doc.setFillColor(...C.arancio); doc.rect(S.L, st.y, 1.4, 27, 'F')
    f(doc, 'bold', 6.8, C.arancio); doc.text(righe(doc, METODO[0], W - 8), S.L + 5, st.y + 4.5)
    f(doc, 'normal', 7, C.grigio)
    ;[1, 2, 3].forEach((i) => doc.text(METODO[i], S.L + 5, st.y + 10.5 + (i - 1) * 5.2, { maxWidth: W - 8 }))
    st.y += 32
  }

  function sanzioni(doc, st, d) {
    if (!d.sanzione) return
    if (st.y + 24 > PH - 20) { doc.addPage(); st.y = S.top }
    const W = S.R - S.L
    doc.setFillColor(...C.grigio); doc.rect(S.L, st.y, W, 19, 'F')
    spaziato(doc, 'STIMA DELLE SANZIONI APPLICABILI', S.L + 4, st.y + 5.5, 6.8, C.etichetta, 0.5)
    f(doc, 'normal', 7.5, C.etichetta); doc.text('Sanzione massima potenziale pari a:', S.L + 4, st.y + 12.5); doc.text('Sanzione ridotta di 1/4 pari a:', S.L + W / 2 + 4, st.y + 12.5)
    f(doc, 'bold', 12, C.bianco); doc.text(d.sanzione.max, S.L + W / 2 - 4, st.y + 13, { align: 'right' })
    f(doc, 'bold', 12, [250, 184, 148]); doc.text(d.sanzione.ridotta, S.R - 4, st.y + 13, { align: 'right' })
    st.y += 24
  }

  /* griglia foto 2 per riga: contain, centrate; etichetta sotto la foto privacy */
  function fotoGriglia(doc, st, foto, titolo) {
    if (!foto || !foto.length) return
    const FW = 72, FH = 72, GAP = 10, W = S.R - S.L
    nuovaPaginaSe(doc, st, 115)
    titolo('Documentazione fotografica')
    const fx = S.L + (W - 2 * FW - GAP) / 2
    let col = 0, riga = st.y
    for (const ft of foto) {
      if (col === 0 && riga + FH + GAP > PH - 22) { doc.addPage(); st.y = S.top; riga = st.y }
      const px = fx + col * (FW + GAP)
      doc.setDrawColor(...C.linea); doc.setLineWidth(0.25); doc.rect(px, riga, FW, FH)
      try {
        const { w, h } = jpegSize(ft.uri), r = w / h
        const iw = r >= 1 ? FW - 2 : (FH - 2) * r, ih = r >= 1 ? (FW - 2) / r : FH - 2
        doc.addImage(ft.uri, 'JPEG', px + (FW - iw) / 2, riga + (FH - ih) / 2, iw, ih, undefined, 'FAST')
      } catch (e) { /* formato non supportato: resta la cornice */ }
      if (ft.tipo === 'privacy') { f(doc, 'normal', 7, C.grigio); doc.text('Informativa privacy / firma', px + FW / 2, riga + FH + 4, { align: 'center' }) }
      col++
      if (col === 2) { col = 0; riga += FH + GAP }
    }
    st.y = riga + (col === 1 ? FH + GAP : 0) + 4
  }

  /* firme dei tecnici in fondo alla pagina: una o due affiancate; senza immagine resta la riga per firmare a mano */
  function firmeTecnici(doc, st, d, firme, titolo) {
    nuovaPaginaSe(doc, st, PH - 60)
    st.y = Math.max(st.y, PH - 58)
    titolo('Firma del tecnico')
    const W = S.R - S.L
    const lista = [d.tecNome, ...(d.tec2Nome ? [d.tec2Nome] : [])]
    const half = lista.length > 1 ? (W - 8) / 2 : W / 2
    lista.forEach((nome, i) => {
      const x = S.L + i * (half + 8)
      f(doc, 'normal', 7, C.tenue); doc.text('Tecnico', x, st.y + 1)
      f(doc, 'bold', 9.5, C.grigio); doc.text(nome || '–', x, st.y + 6)
      const fi = firme && firme[i]
      if (fi) { try { doc.addImage(fi, formato(fi), x, st.y + 7.5, 42, 14, undefined, 'FAST') } catch (e) { /* resta la riga */ } }
      doc.setDrawColor(...C.grigio); doc.setLineWidth(0.3); doc.line(x, st.y + 22, x + half - 10, st.y + 22)
      f(doc, 'normal', 6.5, C.tenue); doc.text('firma', x, st.y + 25.5)
    })
    st.y += 30
  }

  /* campagna informativa accodata al verbale: cmp = { titolo, testo, immagini: [{uri, w, h}], link: [[etichetta, url]] } */
  function campagna(doc, st, cmp) {
    if (!cmp) return
    const L = S.L, W = S.R - S.L
    if (st.y > PH - 70) { doc.addPage(); st.y = S.top } else st.y += 8
    spaziato(doc, 'CAMPAGNA INFORMATIVA', L, st.y + 3, 7.5, C.arancio, 0.6)
    st.y += 8
    if (cmp.titolo) {
      f(doc, 'bold', 13, C.grigio)
      const t = righe(doc, cmp.titolo, W)
      doc.text(t, L, st.y + 2)
      st.y += t.length * 5.6 + 3
    }
    if (cmp.testo) riquadro(doc, st, cmp.testo, { bg: C.pietra, barra: C.arancio, size: 9 })
    for (const im of cmp.immagini || []) {
      try {
        let w = W, h = w * im.h / im.w
        const maxH = PH - 36
        if (h > maxH) { h = maxH; w = h * im.w / im.h }
        if (st.y + h > PH - 18) { doc.addPage(); st.y = S.top }
        doc.addImage(im.uri, formato(im.uri), L + (W - w) / 2, st.y, w, h)
        st.y += h + 5
      } catch (e) { /* immagine non leggibile: si salta */ }
    }
    const link = (cmp.link || []).filter((x) => x[1])
    if (link.length) {
      nuovaPaginaSe(doc, st, PH - 16)
      f(doc, 'normal', 9, [37, 99, 235])
      let x = L
      link.forEach(([etichetta, url]) => {
        const t = etichetta || url
        doc.textWithLink(t, x, st.y + 4, { url })
        const tw = doc.getTextWidth(t)
        doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.2); doc.line(x, st.y + 5, x + tw, st.y + 5)
        x += tw + 16
      })
      st.y += 10
    }
  }

  function verbale(doc, d, img) {
    doc.addPage()
    const L = S.L, R = S.R, W = R - L
    const st = { y: 0 }
    const titolo = (t) => { nuovaPaginaSe(doc, st, PH - 40); spaziato(doc, t.toUpperCase(), L, st.y + 3, 7.5, C.arancio, 0.6); st.y += 5.5 }
    logo(doc, img.logo, R, 11, 42)
    spaziato(doc, 'VERBALE DI SOPRALLUOGO IN CANTIERE', L, 16, 7.5, C.arancio, 0.6)
    f(doc, 'bold', 21, C.grigio); doc.text(d.nrVerbale, L, 25.5)
    f(doc, 'normal', 8, C.tenue); doc.text('Formedil Padova · Ente unico formazione e sicurezza · Area Sicurezza e Salute', L, 31)
    st.y = 37
    if (d.rettBanner) { rettifica(doc, L, st.y, W, d.rettBanner); st.y += 17 }

    // banda grigia coi dati della visita (va a capo invece di tagliare)
    const celle = [['Tecnico', d.tecNome || '–', 42], ['Data visita', d.dataVisita, 24], ['Tipologia visita', d.tipoAcc, 40], ['N° accesso', d.accesso, 20], ['Etichetta cantiere', d.etichetta, 48]]
    f(doc, 'bold', 9.5, C.bianco)
    const testi = celle.map(([, val, w]) => righe(doc, val, w - 5))
    const extra = [d.tec2Nome ? '2° tecnico: ' + d.tec2Nome : '', d.stagista ? 'Stagista: ' + d.stagista : ''].filter(Boolean).join('   ·   ')
    const bh = 9 + Math.max(...testi.map((t) => t.length)) * 4.2 + (extra ? 5 : 0)
    doc.setFillColor(...C.grigio); doc.rect(L, st.y, W, bh, 'F')
    let x = L + 4
    celle.forEach(([l, , w], i) => { spaziato(doc, l.toUpperCase(), x, st.y + 5, 5.8, C.etichetta, 0.4); f(doc, 'bold', 9.5, C.bianco); doc.text(testi[i], x, st.y + 10.5); x += w })
    if (extra) { f(doc, 'normal', 7.5, C.etichetta); doc.text(extra, L + 4, st.y + bh - 3) }
    st.y += bh + 8

    sezioniDati(doc, st, d, titolo)

    // esito: IPC, contatori, messaggio, osservazioni del tecnico
    titolo('Dati della visita')
    if (st.y + 28 > PH - 20) { doc.addPage(); st.y = S.top }
    const ipc = d.ipc
    doc.setFillColor(...ipc.bg); doc.rect(L, st.y, 50, 16, 'F')
    spaziato(doc, 'IPC · INDICE DI PERICOLOSITÀ', L + 3, st.y + 4.4, 5.6, C.bianco, 0.3)
    f(doc, 'bold', ipc.label.length > 6 ? 11 : 15, C.bianco); doc.text(ipc.label, L + 3, st.y + 12.6)
    ;[['NC+', ipc.ncp], ['NC-', ipc.ncn], ['OSS', ipc.oss], ['VER', ipc.ver]].forEach(([l, n], i) => {
      const xx = L + 57 + i * 29.5, col = COL_VAL[l]
      doc.setDrawColor(...col); doc.setLineWidth(0.9); doc.line(xx, st.y + 0.5, xx + 24, st.y + 0.5)
      f(doc, 'bold', 15, col); doc.text(String(n), xx, st.y + 9.6)
      spaziato(doc, l, xx, st.y + 14.6, 6.2, C.tenue, 0.4)
    })
    st.y += 20
    riquadro(doc, st, ipc.msg, { bg: ipc.tinta, barra: ipc.bg, italic: true })
    if (d.ossTec) riquadro(doc, st, d.ossTec, { titolo: `Osservazioni del tecnico  ·  IPC ${ipc.label}`, bg: ipc.tinta, barra: ipc.bg, titoloColore: ipc.bg })
    st.y += 2
    metodologia(doc, st)

    // check-list: prima i rilievi (NC+, NC-, OSS) con articolo e note, poi le voci conformi;
    // la nota di una sottoarea sta coi rilievi se la sottoarea ne ha, altrimenti con le voci conformi
    const banda = (t) => {
      nuovaPaginaSe(doc, st, PH - 50)
      doc.setFillColor(...C.grigio); doc.rect(L, st.y, W, 8, 'F')
      spaziato(doc, t, L + 4, st.y + 5.4, 7.5, C.bianco, 0.8, 'bold')
      st.y += 12
    }
    const zonaCiclo = (lbl, quadrato) => {
      doc.setFillColor(...(quadrato || C.arancio)); doc.rect(L, st.y - 2.9, 2.4, 2.4, 'F')
      f(doc, 'bold', 9.5, C.grigio); doc.text(lbl.toUpperCase(), L + 4.5, st.y)
      st.y += 1.5
    }
    for (const z of d.zone) for (const g of z.gruppi) g.mostraNota = g.voci.some((v) => v.val !== 'VER')
    banda('RILIEVI DA SANARE')
    if (ipc.ncp + ipc.ncn + ipc.oss === 0) {
      f(doc, 'italic', 8.5, C.grigio); doc.text('Nessun rilievo: tutte le voci verificate risultano conformi.', L, st.y + 1); st.y += 8
    }
    const rilievi = { ...d, zone: d.zone.map((z) => ({ ...z, gruppi: z.gruppi.map((g) => ({ ...g, nota: g.mostraNota ? g.nota : '' })) })) }
    sezioneChecklist(doc, st, rilievi, zonaCiclo, ['NC+', 'NC-', 'OSS'])
    sanzioni(doc, st, d)

    const conformi = d.zone.map((z) => ({ label: z.label, gruppi: z.gruppi.filter((g) => g.voci.some((v) => v.val === 'VER') || (g.nota && !g.mostraNota)) })).filter((z) => z.gruppi.length)
    if (conformi.length) {
      banda('VOCI VERIFICATE CONFORMI')
      for (const z of conformi) {
        nuovaPaginaSe(doc, st, PH - 34)
        zonaCiclo(z.label, COL_VAL.VER) // 13/09/2026: quadratini verdi come le pastiglie VER
        doc.autoTable({
          startY: st.y, margin: S.margini, ...S.tabellaCheck, head: [],
          body: z.gruppi.map((g) => {
            const ok = g.voci.filter((v) => v.val === 'VER').map((v) => v.desc + (v.nota ? ` (${v.nota})` : ''))
            const nota = g.nota && !g.mostraNota ? 'Nota: ' + g.nota : ''
            return [{ content: g.label.toUpperCase(), styles: { fontSize: 6.4, fontStyle: 'bold', textColor: C.tenue } }, ok.length ? 'VER' : '', [ok.join('  ·  '), nota].filter(Boolean).join('\n')]
          }),
          columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 17, halign: 'center' }, 2: {} },
          didParseCell: (c) => { if (c.section === 'body' && c.column.index === 1) c.cell.text = [''] },
          didDrawCell: (c) => { if (c.section === 'body' && c.column.index === 1) pastiglia(doc, c) }
        })
        st.y = doc.lastAutoTable.finalY + 4
      }
    }
    fotoGriglia(doc, st, img.foto, titolo)
    firmeTecnici(doc, st, d, img.firme, titolo)
    campagna(doc, st, img.campagna)
  }

  /* banda arancione a sinistra e piè di pagina su tutte le pagine, a documento finito */
  function piè(doc, d) {
    const n = doc.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      doc.setPage(i)
      doc.setFillColor(...C.arancio); doc.rect(0, 0, 9, PH, 'F')
      f(doc, 'normal', 6.5, C.tenue)
      doc.text(i === 1 ? 'Formedil Padova · Area Sicurezza e Salute' : `Verbale ${d.nrVerbale} · ${d.dataVisita}`, S.L, PH - 9)
      doc.text(`Pagina ${i} di ${n}`, S.R, PH - 9, { align: 'right' })
      if (i === n) { f(doc, 'normal', 6.5, [180, 180, 180]); doc.text(`Generato il ${new Date().toLocaleString('it-IT')} – Formedil Padova CPT`, 105, PH - 9, { align: 'center' }) }
      if (d.bozza) filigranaBozza(doc)
    }
    doc.setPage(n)
  }

  /* BOZZA in diagonale, trasparente, e una riga in testa (23/09/2026): una bozza
     stampata non deve poter passare per un verbale definitivo */
  function filigranaBozza(doc) {
    const trasparente = typeof doc.GState === 'function' && typeof doc.setGState === 'function'
    if (trasparente) doc.setGState(new doc.GState({ opacity: 0.13 }))
    doc.setFont('helvetica', 'bold'); doc.setFontSize(96); doc.setTextColor(...(trasparente ? [192, 57, 43] : [245, 215, 205]))
    doc.text('BOZZA', 105, PH / 2 + 20, { align: 'center', angle: 40 })
    if (trasparente) doc.setGState(new doc.GState({ opacity: 1 }))
    f(doc, 'bold', 8, [192, 57, 43])
    doc.text('BOZZA — non valido come verbale: il documento definitivo è quello salvato come «Definitivo»', 105, 6, { align: 'center' })
  }

  /* img = { logo, qr, foto: [{tipo, uri}], firme: [uri|null, uri|null], campagna } — tutti facoltativi */
  function crea(jsPDF, d, img) {
    img = img || {}
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    lettera(doc, d, img)
    verbale(doc, d, img)
    piè(doc, d)
    return doc
  }

  root.VerbalePDF = { prepara, crea }
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VerbalePDF
})(typeof window !== 'undefined' ? window : globalThis)
