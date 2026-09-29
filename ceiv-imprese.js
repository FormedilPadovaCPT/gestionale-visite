// Estrazione CEIV «imprese presenti per cantiere» (29/09/2026).
// Si affianca all'estrazione storica (una riga per visita, tracciato della Cassa): qui la Cassa Edile
// trova, per ogni sopralluogo su un cantiere con codice CNCE, CHI lavorava in cantiere — imprese e
// lavoratori autonomi, con partita IVA o codice fiscale — quanti lavoratori aveva ciascuno e il totale.
// Logica pura: niente database, niente pagina. La usano il gestionale (window.CeivImprese) e le prove in Node.
(function (root) {
  const RUOLI = { 1: 'Affidataria', 2: 'Affidataria ed esecutrice', 3: 'Esecutrice', 4: 'Subappaltatrice', 5: 'Lavoratore autonomo', 6: 'Fornitrice' };
  const _s = (x) => (x === null || x === undefined ? '' : String(x).trim());
  const _n = (x) => (x === null || x === undefined || x === '' || isNaN(Number(x)) ? null : Number(x));
  const fmtData = (d) => {
    const s = _s(d).slice(0, 10);
    const [y, m, g] = s.split('-');
    return g ? `${g}/${m}/${y}` : s;
  };
  const _maiusc = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

  // Il ruolo scritto per esteso vince sul codice: nei verbali importati il codice c'è solo per la principale.
  function ruoloDi(p) {
    const t = _s(p.ruolo).toLowerCase();
    if (t) return _maiusc(t);
    return RUOLI[Number(p.tipo_imp)] || '';
  }
  function eAutonomo(p) {
    return _s(p.ruolo).toLowerCase().indexOf('autonom') >= 0 || (!_s(p.ruolo) && Number(p.tipo_imp) === 5);
  }
  // Partita IVA e codice fiscale: dall'anagrafica; se mancano, dalla chiave dell'impresa quando ne ha la forma.
  function codici(imp, impresaId) {
    const id = _s(impresaId).toUpperCase();
    let piva = _s(imp.piva), cf = _s(imp.impresa_cf);
    if (!piva && /^[0-9]{11}$/.test(id)) piva = id;
    if (!cf && /^[A-Z0-9]{16}$/.test(id) && /[A-Z]/.test(id)) cf = id;
    return { piva, cf };
  }
  function cassaDi(imp) {
    const c = _s(imp.cassa_edile), st = _s(imp.stato_cassa);
    if (!c && !st) return '';
    return [c, st].filter(Boolean).join(' – ');
  }

  // visite: righe di `visite` con cantieri, tecnici e impresa principale; presentiPerVisita: { visita_id: [righe] }
  function normalizza(visite, presentiPerVisita) {
    return (visite || []).map((v) => {
      const c = v.cantieri || {}, t = v.tecnici || {};
      const pres = ((presentiPerVisita || {})[v.visita_id] || []).slice()
        .sort((a, b) => (b.is_principale ? 1 : 0) - (a.is_principale ? 1 : 0) || (a.ordine || 0) - (b.ordine || 0));
      let imprese = pres.map((p) => {
        const imp = p.imprese || {};
        const k = codici(imp, p.impresa_id);
        return { nome: _s(imp.impresa_nome), piva: k.piva, cf: k.cf, ruolo: ruoloDi(p), autonomo: eAutonomo(p), cassa: cassaDi(imp), lav: _n(p.nr_lav) };
      });
      let soloPrincipale = false;
      if (!imprese.length && v.imprese && (v.imprese.impresa_nome || v.imprese.piva)) {
        // nessuna riga delle imprese presenti: resta l'impresa principale del verbale, senza lavoratori suoi
        const k = codici(v.imprese, v.impresa_id);
        imprese = [{ nome: _s(v.imprese.impresa_nome), piva: k.piva, cf: k.cf, ruolo: '', autonomo: false, cassa: cassaDi(v.imprese), lav: null }];
        soloPrincipale = true;
      }
      const lavTot = _n(v.nr_lavoratori);
      const conLav = imprese.filter((x) => x.lav !== null);
      const somma = conLav.length ? conLav.reduce((s, x) => s + x.lav, 0) : null;
      const nAut = imprese.filter((x) => x.autonomo).length;
      const nrInd = _n(v.nr_ind);
      const note = [];
      if (_s(v.stato) && _s(v.stato).toLowerCase() !== 'definitivo') note.push('Verbale non definitivo');
      if (soloPrincipale) note.push('Elenco delle imprese presenti non compilato: resta la sola impresa principale');
      if (imprese.some((x) => x.lav === null) && !soloPrincipale) note.push('Lavoratori non indicati per una o più imprese');
      if (somma !== null && lavTot !== null && somma !== lavTot) note.push(`Somma per impresa ${somma}, totale dichiarato ${lavTot}`);
      if (nrInd !== null && nrInd > nAut) note.push(`${nrInd - nAut} ${nrInd - nAut === 1 ? 'autonomo dichiarato' : 'autonomi dichiarati'} senza nominativo`);
      const altre = _s(v.altre_imp_text).replace(/\s+/g, ' ');
      if (altre) note.push('Altre imprese o autonomi segnalati dal tecnico a testo libero');
      return {
        altre,
        visitaId: v.visita_id, cnce: _s(c.cantiere_cnce), lotto: _s(c.lotto),
        indirizzo: [c.cantiere_indirizzo, c.cantiere_civico].map(_s).filter(Boolean).join(' '), comune: _s(c.comune_nome),
        data: _s(v.data_visita), verbale: _s(v.nr_verbale),
        tecnico: [t.tecnico_nome, t.tecnico_cognome].map(_s).filter(Boolean).join(' '),
        committente: _s(v.comm_rag_soc) || [v.comm_nome, v.comm_cog].map(_s).filter(Boolean).join(' '),
        nImprese: imprese.filter((x) => !x.autonomo).length, nAutonomi: Math.max(nAut, nrInd || 0),
        lavTot, somma, imprese, note,
      };
    });
  }

  const ordina = (dati) => dati.slice().sort((a, b) =>
    a.cnce.localeCompare(b.cnce) || a.lotto.localeCompare(b.lotto) || b.data.localeCompare(a.data) || a.verbale.localeCompare(b.verbale));

  const INTESTAZIONE = ['Codice CNCE', 'Lotto', 'Indirizzo cantiere', 'Comune', 'Data sopralluogo', 'N. verbale', 'Tecnico',
    'Impresa o lavoratore autonomo', 'Partita IVA', 'Codice fiscale', 'Ruolo in cantiere', 'Autonomo', 'Cassa Edile',
    'Lavoratori dell\'impresa presenti', 'Imprese nel cantiere', 'Autonomi nel cantiere', 'Lavoratori totali del sopralluogo', 'Altre imprese o autonomi segnalati (testo del tecnico)', 'Note'];
  const LARGHEZZE = [18, 8, 30, 18, 12, 16, 20, 36, 14, 18, 22, 9, 20, 12, 10, 10, 12, 60, 50];

  // Una riga per impresa: i dati del cantiere e del sopralluogo si ripetono, così si filtra e si incrocia.
  function righeExcel(dati) {
    const aoa = [INTESTAZIONE.slice()];
    ordina(dati).forEach((r) => {
      const testa = [r.cnce, r.lotto, r.indirizzo, r.comune, fmtData(r.data), r.verbale, r.tecnico];
      const coda = [r.nImprese, r.nAutonomi, r.lavTot === null ? '' : r.lavTot, r.altre, r.note.join('; ')];
      const lista = r.imprese.length ? r.imprese : [{ nome: '', piva: '', cf: '', ruolo: '', autonomo: false, cassa: '', lav: null }];
      lista.forEach((x) => {
        aoa.push(testa.concat([x.nome, x.piva, x.cf, x.ruolo, x.autonomo ? 'Sì' : 'No', x.cassa, x.lav === null ? '' : x.lav], coda));
      });
    });
    return aoa;
  }

  function conta(dati) {
    const cant = {};
    dati.forEach((r) => { cant[r.cnce + '|' + r.lotto] = 1; });
    return { sopralluoghi: dati.length, cantieri: Object.keys(cant).length, righe: dati.reduce((s, r) => s + Math.max(1, r.imprese.length), 0),
      daGuardare: dati.filter((r) => r.note.length).length };
  }

  // PDF: una scheda per sopralluogo, raggruppate per cantiere. doc = new jsPDF (A4 verticale, mm).
  function disegnaPdf(doc, dati, dalFmt, alFmt) {
    const PW = 210, M = 12, BOT = 280, W = PW - M * 2;
    // colonne della tabella: impresa, P.IVA/CF, ruolo, Cassa Edile, lavoratori
    const X = [M + 2, M + 72, M + 106, M + 142, PW - M - 2];
    const LC = [68, 32, 34, 30];
    let pagina = 0, y = 0;
    const testata = () => {
      pagina++;
      doc.setFillColor(231, 80, 15); doc.rect(0, 0, PW, 15, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('FORMEDIL PADOVA – Area Sicurezza e Salute', 6, 9.5);
      doc.text(`Periodo: ${dalFmt} – ${alFmt}`, 204, 9.5, { align: 'right' });
      doc.setTextColor(40, 40, 40); doc.setFontSize(12);
      doc.text('IMPRESE E LAVORATORI PRESENTI NEI CANTIERI C.N.C.E. VISITATI', 105, 23, { align: 'center' });
      doc.setDrawColor(231, 80, 15); doc.setLineWidth(0.3); doc.line(M, 288, PW - M, 288);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
      doc.text('Formedil Padova – Estrazione per C.E.I.V.: imprese presenti per cantiere', 105, 292, { align: 'center' });
      doc.text(String(pagina), 204, 292, { align: 'right' });
      y = 30;
    };
    const nuova = () => { doc.addPage(); testata(); };
    const spezza = (txt, size, bold, maxW) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      return doc.splitTextToSize(_s(txt) || '–', maxW);
    };
    const gruppi = {};
    ordina(dati).forEach((r) => { const k = r.cnce + '|' + r.lotto; (gruppi[k] = gruppi[k] || []).push(r); });
    testata();
    Object.keys(gruppi).forEach((k) => {
      const righe = gruppi[k], r0 = righe[0];
      if (y + 40 > BOT) nuova();
      doc.setFillColor(86, 92, 102); doc.rect(M, y, W, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Cantiere ' + r0.cnce + (r0.lotto ? '  ·  lotto ' + r0.lotto : ''), M + 2.5, y + 5.4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const luogo = [r0.comune.toUpperCase(), r0.indirizzo].filter(Boolean).join(' – ');
      doc.text(luogo + '   ·   ' + righe.length + (righe.length === 1 ? ' sopralluogo' : ' sopralluoghi'), PW - M - 2.5, y + 5.4, { align: 'right', maxWidth: 110 });
      y += 11;
      righe.forEach((r) => {
        const corpo = r.imprese.map((x) => ({
          nome: spezza(x.nome + (x.autonomo ? '  (autonomo)' : ''), 8, false, LC[0]),
          cod: spezza([x.piva, x.cf && x.cf !== x.piva ? x.cf : ''].filter(Boolean).join(' / '), 7.5, false, LC[1]),
          ruolo: spezza(x.ruolo, 7.5, false, LC[2]),
          cassa: spezza(x.cassa, 7.5, false, LC[3]),
          lav: x.lav === null ? '–' : String(x.lav),
        }));
        const hRiga = (c) => Math.max(c.nome.length, c.cod.length, c.ruolo.length, c.cassa.length) * 3.6 + 1.6;
        const noteL = (r.note.length ? spezza('Nota: ' + r.note.join('; '), 7, false, W - 5) : [])
          .concat(r.altre ? spezza('Segnalate dal tecnico: ' + r.altre, 7, false, W - 5) : []);
        const alt = 6 + 5 + corpo.reduce((s, c) => s + hRiga(c), 0) + 6.5 + (noteL.length ? noteL.length * 3.2 + 1.5 : 0) + 3;
        if (y + alt > BOT) nuova();
        // riga del sopralluogo
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
        let x = M + 2;
        const d = 'Sopralluogo del ' + fmtData(r.data);
        doc.text(d, x, y + 4); x += doc.getTextWidth(d) + 4;
        doc.setTextColor(231, 80, 15); doc.text('Verbale ' + (r.verbale || '–'), x, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
        doc.text([r.tecnico, r.committente ? 'Committente: ' + r.committente : ''].filter(Boolean).join('   ·   '), PW - M - 2, y + 4, { align: 'right', maxWidth: 95 });
        y += 6;
        // intestazione della tabella
        doc.setFillColor(240, 240, 240); doc.rect(M, y, W, 5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(90, 90, 90);
        ['Impresa o lavoratore autonomo', 'P.IVA / codice fiscale', 'Ruolo', 'Cassa Edile'].forEach((t, i) => doc.text(t, X[i], y + 3.4));
        doc.text('Lavoratori', X[4], y + 3.4, { align: 'right' });
        y += 5;
        corpo.forEach((c) => {
          const h = hRiga(c);
          doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal');
          doc.setFontSize(8); c.nome.forEach((l, i) => doc.text(l, X[0], y + 3.4 + i * 3.6));
          doc.setFontSize(7.5);
          c.cod.forEach((l, i) => doc.text(l, X[1], y + 3.4 + i * 3.6));
          c.ruolo.forEach((l, i) => doc.text(l, X[2], y + 3.4 + i * 3.6));
          c.cassa.forEach((l, i) => doc.text(l, X[3], y + 3.4 + i * 3.6));
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text(c.lav, X[4], y + 3.4, { align: 'right' });
          doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.15); doc.line(M, y + h, PW - M, y + h);
          y += h;
        });
        // totale
        doc.setFillColor(250, 240, 234); doc.rect(M, y, W, 6, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30, 30, 30);
        const parti = r.nImprese + (r.nImprese === 1 ? ' impresa' : ' imprese') + (r.nAutonomi ? ', ' + r.nAutonomi + (r.nAutonomi === 1 ? ' autonomo' : ' autonomi') : '');
        doc.text('Totale lavoratori trovati in cantiere  ·  ' + parti, X[0], y + 4);
        doc.setFontSize(10); doc.text(r.lavTot === null ? '–' : String(r.lavTot), X[4], y + 4.2, { align: 'right' });
        y += 6.5;
        if (noteL.length) {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(150, 90, 20);
          noteL.forEach((l, i) => doc.text(l, X[0], y + 2.6 + i * 3.2));
          y += noteL.length * 3.2 + 1.5;
        }
        y += 3;
      });
      y += 4;
    });
    return doc;
  }

  const api = { normalizza, righeExcel, disegnaPdf, conta, fmtData, ruoloDi, eAutonomo, codici, INTESTAZIONE, LARGHEZZE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CeivImprese = api;
})(typeof window !== 'undefined' ? window : globalThis);
