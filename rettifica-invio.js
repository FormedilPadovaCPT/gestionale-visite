/* rettifica-invio.js — rettifica decisa al momento dell'invio, confrontando ciò che è stampato sul verbale
   (12/11/2026, deciso dall'utente dal verbale CPT/26_27/0093 di Caon).

   Prima la rettifica la proponeva solo la finestra che compare dopo il salvataggio: chiusa quella, un verbale
   già spedito e poi corretto ripartiva da «📧 Invia verbale» (maschera o elenco) come se fosse il primo invio,
   senza dire che sostituiva il precedente. Il 0093 è uscito così l'11/11 alle 17:07.

   Ora, da qualunque pulsante si parta, il verbale che sta per partire si confronta con l'ultimo spedito:
   - qualcosa di stampato è cambiato → RETTIFICA (sostituisce integralmente il precedente);
   - niente è cambiato → nuovo invio della stessa versione (per esempio a chi l'ha chiesto), senza dicitura.
   Si confrontano i DATI da cui nasce il PDF (VerbalePDF.prepara), non il file: un PDF rigenerato ha byte
   diversi anche a contenuto identico (data e ora di creazione).

   Fuori dal confronto: la data di stampa, la dicitura di rettifica, gli articoli e le ipotesi di sanzione
   (vengono dai dati di legge, non dal tecnico), i testi fissi ricavati da data e IPC. Dentro: tutto ciò che
   scrive il tecnico o che si legge in anagrafica (figure col titolo, indirizzo del cantiere, imprese,
   check-list con le note, osservazioni) e l'impronta delle foto.
   Funzioni pure: le prova test/rettifica-invio.test.cjs. */
(function (root) {
  'use strict';
  const VERSIONE = 1;
  const ESCLUSI = ['dataOggi', 'rettBanner', 'bozza', 'sanzione', 'stima', 'corpo', 'tecEmail', 'tec2Email'];

  /* i dati da salvare con l'invio e da confrontare col prossimo */
  function normalizza(pd, fotoImpronta) {
    if (!pd) return null;
    const c = JSON.parse(JSON.stringify(pd));
    ESCLUSI.forEach((k) => { delete c[k]; });
    if (c.ipc) c.ipc = { label: c.ipc.label };
    (c.zone || []).forEach((z) => (z.gruppi || []).forEach((g) => (g.voci || []).forEach((v) => { delete v.articolo; })));
    return { versione: VERSIONE, pd: c, foto: fotoImpronta || '' };
  }

  const val = (x) => { const s = x == null ? '' : String(x).replace(/\s+/g, ' ').trim(); return s === '' || s === '–' ? '—' : s; };
  const corto = (s) => { const t = val(s); return t.length > 90 ? t.slice(0, 87) + '…' : t; };
  const eq = (x, y) => val(x) === val(y);

  const SCALARI = [
    ['nrVerbale', 'Numero del verbale'], ['dataVisita', 'Data della visita'], ['impNome', 'Impresa principale'],
    ['cantDetail', 'Cantiere'], ['etichetta', 'Etichetta del cantiere'], ['tecNome', 'Tecnico'], ['tec2Nome', 'Secondo tecnico'],
    ['stagista', 'Stagista'], ['tipoAcc', 'Tipo di accesso'], ['accesso', 'N° accesso al cantiere'],
    ['posizione', 'Ciclo e serie di visite'], ['lavorazioni', 'Lavorazioni in corso'], ['noteLav', 'Note sui lavori'],
    ['ossTec', 'Osservazioni del tecnico']
  ];
  const CAMPI_IMPRESA = [['nome', 'ragione sociale'], ['ruolo', 'ruolo'], ['piva', 'P.IVA'], ['cf', 'codice fiscale'],
    ['nrLav', 'lavoratori'], ['email', 'e-mail'], ['note', 'note']];

  /* che cosa è cambiato fra due invii, in parole: [] = stessa versione */
  function differenze(A, B) {
    const out = [];
    const a = (A && A.pd) || {}, b = (B && B.pd) || {};
    SCALARI.forEach(([k, l]) => { if (!eq(a[k], b[k])) out.push(`${l}: ${corto(a[k])} → ${corto(b[k])}`); });
    const ia = a.ipc && a.ipc.label, ib = b.ipc && b.ipc.label;
    if (!eq(ia, ib)) out.push(`IPC: ${val(ia)} → ${val(ib)}`);

    // figure di cantiere, per ruolo: [ruolo, nome col titolo, e-mail, telefono]
    const fig = (l) => { const m = {}; (l || []).forEach((r) => { if (r && r[0]) m[r[0]] = r; }); return m; };
    const fa = fig(a.figure), fb = fig(b.figure);
    new Set([...Object.keys(fa), ...Object.keys(fb)]).forEach((r) => {
      const x = fa[r] || [r, '', '', ''], y = fb[r] || [r, '', '', ''];
      [[1, ''], [2, ' – e-mail'], [3, ' – telefono']].forEach(([i, s]) => {
        if (!eq(x[i], y[i])) out.push(`${r}${s}: ${corto(x[i])} → ${corto(y[i])}`);
      });
    });

    // dati del cantiere: righe [etichetta, valore, etichetta, valore]
    const cm = (l) => { const m = {}; (l || []).forEach((r) => { if (r[0]) m[r[0]] = r[1]; if (r[2]) m[r[2]] = r[3]; }); return m; };
    const ca = cm(a.cantiere), cb = cm(b.cantiere);
    new Set([...Object.keys(ca), ...Object.keys(cb)]).forEach((k) => {
      if (!eq(ca[k], cb[k])) out.push(`Cantiere – ${k}: ${corto(ca[k])} → ${corto(cb[k])}`);
    });

    // imprese presenti, nell'ordine del verbale
    const im = (l) => { const m = {}; (l || []).forEach((x) => { m[x.n] = x; }); return m; };
    const pa = im(a.imprese), pb = im(b.imprese);
    new Set([...Object.keys(pa), ...Object.keys(pb)]).forEach((n) => {
      const x = pa[n], y = pb[n];
      if (!x) { out.push(`Impresa ${n} aggiunta: ${val(y.nome)}`); return; }
      if (!y) { out.push(`Impresa ${n} tolta: ${val(x.nome)}`); return; }
      CAMPI_IMPRESA.forEach(([k, l]) => {
        if (!eq(x[k], y[k])) out.push(`Impresa ${n} (${val(y.nome)}) – ${l}: ${corto(x[k])} → ${corto(y[k])}`);
      });
    });

    // check-list: voce per voce, con le note di voce e di sottoarea
    const ck = (p) => {
      const m = {};
      (p.zone || []).forEach((z) => (z.gruppi || []).forEach((g) => {
        if (val(g.nota) !== '—') m['N|' + z.label + '|' + g.label] = { nota: g.nota, label: g.label };
        (g.voci || []).forEach((v) => { m['V|' + z.label + '|' + g.label + '|' + v.desc] = { val: v.val, nota: v.nota, desc: v.desc }; });
      }));
      return m;
    };
    const ka = ck(a), kb = ck(b);
    new Set([...Object.keys(ka), ...Object.keys(kb)]).forEach((k) => {
      const x = ka[k] || {}, y = kb[k] || {};
      if (k[0] === 'N') { if (!eq(x.nota, y.nota)) out.push(`Nota di «${y.label || x.label}»: «${corto(x.nota)}» → «${corto(y.nota)}»`); return; }
      const d = y.desc || x.desc;
      if (!eq(x.val, y.val)) out.push(`Check-list «${corto(d)}»: ${val(x.val)} → ${val(y.val)}`);
      if (!eq(x.nota, y.nota)) out.push(`Nota a «${corto(d)}»: «${corto(x.nota)}» → «${corto(y.nota)}»`);
    });

    if ((A && A.foto || '') !== (B && B.foto || '') && ((A && A.foto) || (B && B.foto))) out.push('Foto del verbale cambiate');
    return out;
  }

  /* i destinatari della finestra d'invio, più chi ha ricevuto una versione precedente e oggi non c'è:
     in fondo, senza spunta, perché il tecnico decida se deve ricevere anche questo invio */
  function conPrecedenti(attuali, invii) {
    const lista = (attuali || []).slice();
    const gia = new Set(lista.map((e) => String(e.email || '').trim().toLowerCase()));
    (invii || []).forEach((iv) => {
      const dest = Array.isArray(iv.dest) && iv.dest.length ? iv.dest : (iv.email_dest || []).map((e) => ({ email: e }));
      dest.forEach((d) => {
        const em = String(d.email || '').trim();
        if (!em || d.ruolo === 'CPT' || gia.has(em.toLowerCase())) return;
        gia.add(em.toLowerCase());
        lista.push({ ruolo: d.ruolo || '', nome: d.nome || '', email: em, escluso: true, precedente: true });
      });
    });
    return lista;
  }

  const api = { VERSIONE, normalizza, differenze, conPrecedenti };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RettificaInvio = api;
})(typeof window !== 'undefined' ? window : globalThis);
