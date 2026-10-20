/* ============================================================
   STATISTICHE DEI CICLI DI VISITA — Gestionale Visite
   (20/10/2026, con l'avvio dei cicli di visita: proposta della
   Segreteria d'Area del 16/10/2026, Prot_26-27_0033)

   Due sottopagine delle 📊 Statistiche, dopo «Per la Commissione»
   (veste-v2.js, GRUPPI_STAT):
     🔁 Cicli di visita — gli esiti dei cicli (risolto, superato, in
        percorso, critico, non risolto, aperti), le visite per ciclo,
        i cicli fermi al Coordinatore e i percorsi scelti;
     📈 Miglioramento e serie — l'IPC alla prima e all'ultima visita
        del ciclo (migliorati, uguali, peggiorati, con la matrice) e il
        riquadro delle serie di visite (accessi fatti su previsti,
        cicli contenuti, IPC all'inizio e alla fine).

   - I numeri li calcola il database: dash_cicli(p_da, p_a), sui cicli
     APERTI nel periodo (data della prima visita del ciclo). Qui si
     disegnano e basta. I cicli partono dalle visite dal 1° ottobre 2026:
     sugli esercizi prima non c'è niente, e la pagina lo dice.
   - Conta SOLO il filtro Esercizio, come la Commissione: nessun dato per
     tecnico (le scelte contro la proposta sono un conteggio, i nomi
     stanno nella Zona Coordinatore). Le righe delle serie portano il
     nome dell'impresa solo a chi è personale dell'Area.
   - Se la lettura non riesce si scrive «non sono riuscito a leggere»,
     mai zero.
   - Le statistiche nello schema dell'Osservatorio non cambiano: il
     numero di accesso resta quello.
   ============================================================ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => String(+n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  function quota(n, d) {
    if (!d) return null;
    return String(Math.round((+n || 0) / d * 1000) / 10).replace('.', ',').replace(/^(\d+)$/, '$1,0') + '%';
  }
  const perc = (n, d, cls) => d ? '<span class="cic-p' + (cls ? ' cic-p-' + cls : '') + '"><i><b style="width:' + Math.max(0, Math.min(100, Math.round((+n || 0) / d * 100))) + '%"></b></i>' + quota(n, d) + '</span>' : '<span class="cic-vuoto">—</span>';
  /* il periodo dall'esercizio della pagina: «2025/2026» → 01/10/2025-30/09/2026; vuoto = tutto lo storico */
  function periodo(fE) {
    const y = +String(fE || '').slice(0, 4);
    if (!y) return { da: null, a: null, nome: 'tutto lo storico', primaDeiCicli: false };
    return { da: y + '-10-01', a: (y + 1) + '-09-30', nome: "l'esercizio " + y + '/' + (y + 1), primaDeiCicli: y < 2026 };
  }

  const CLASSI = [
    ['risolto', 'Risolto', 'archiviato secondo la procedura, anche con IPC basso'],
    ['risolto_dopo_3', 'Risolto dopo la 3ª visita', 'con le visite 4ª-5ª autorizzate'],
    ['superato', 'Superato', 'il cantiere è cambiato: si è aperto un ciclo nuovo'],
    ['in_percorso', 'In percorso, chiuso', 'visite 4ª-5ª, serie, conferenza o Commissione, con l\'esito scritto dal Coordinatore'],
    ['in_percorso_aperto', 'In percorso, aperto', 'il percorso scelto dal Coordinatore è in corso'],
    ['fermo', 'Fermo alla 3ª visita', 'IPC medio non risolto: decide il Coordinatore'],
    ['critico', 'Critico, chiuso', ''],
    ['critico_aperto', 'Critico', 'IPC alto che persiste o IPC medio dopo la 5ª visita: cantiere critico proposto'],
    ['non_risolto', 'Non risolto, nessun seguito', 'il Coordinatore ha scelto di non proseguire'],
    ['ritorno_in_attesa', 'Ritorno in attesa', 'il rientro dovuto non è ancora scaduto'],
    ['ritorno_non_fatto', 'Ritorno non fatto', 'il rientro dovuto è scaduto'],
    ['cantiere_chiuso', 'Cantiere chiuso prima del ritorno', ''],
    ['aperto_senza_rientro', 'Aperto senza rientro dovuto', ''],
  ];
  const PERCORSI = { visite_4_5: 'Visite 4ª e 5ª', serie: 'Serie di visite', conferenza: 'Conferenza di cantiere', commissione: 'Caso alla Commissione', nessuno: 'Nessun seguito' };
  const IPC_ORD = ['NR', 'BASSO', 'MEDIO', 'ALTO'];
  const IPC_NOME = { NR: 'Nessun rilievo', BASSO: 'Basso', MEDIO: 'Medio', ALTO: 'Alto' };

  function tabella(intest, righe, cls) {
    return '<div class="cic-tab-box"><table class="cic-tab' + (cls ? ' ' + cls : '') + '"><thead><tr>' + intest.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>'
      + righe.map((r) => '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + r.celle.map((c, i) => '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  const sezione = (titolo, corpo, nota, largo) => '<section class="cic-sez' + (largo ? ' cic-largo' : '') + '"><h4>' + titolo + '</h4>' + corpo + (nota ? '<p class="cic-nota">' + nota + '</p>' : '') + '</section>';
  const testa = (per, d) => '<p class="cic-periodo">' + esc(per.nome.charAt(0).toUpperCase() + per.nome.slice(1)) + ', cicli aperti nel periodo (data della prima visita) · <b>vale solo il filtro Esercizio</b> · dal ' + esc(dIt(d.dal)) + ' · nessun numero è per singolo tecnico.</p>';
  const vuoto = (per, d) => {
    if (per.primaDeiCicli) return '<p class="cic-nota">I cicli di visita partono dalle visite dal <b>1° ottobre 2026</b>: su questo esercizio non ce ne sono. Scegli l\'esercizio 2026/2027 o uno dopo.</p>';
    return '<p class="cic-nota">Nessun ciclo di visita nel periodo scelto.</p>';
  };
  const errore = (cosa) => '<p class="cic-errore">⚠ Non sono riuscito a leggere le statistiche dei cicli' + (cosa ? ' (' + esc(cosa) + ')' : '') + ': riprova. Nessun numero è mostrato, perché non sarebbe vero.</p>';

  /* ── 🔁 Cicli di visita ── */
  function costruisciCicli(d, per) {
    per = per || periodo('');
    if (!d || typeof d !== 'object' || !(+d.cicli >= 0)) return errore('i dati arrivati non sono completi');
    const T = +d.cicli || 0;
    let h = testa(per, d);
    if (!T) return h + vuoto(per, d);
    const cl = d.classi || {};
    const chiusi = ['risolto', 'risolto_dopo_3', 'superato', 'in_percorso', 'critico', 'non_risolto'].reduce((t, k) => t + (+cl[k] || 0), 0);
    const risolti = (+cl.risolto || 0) + (+cl.risolto_dopo_3 || 0);
    const vpc = d.visite_per_ciclo || {};
    const kpi = [
      [num(T), 'cicli su ' + num(d.lotti) + ' lotti, ' + num(d.visite) + ' visite'],
      [quota(risolti, T) || '—', 'risolti (' + num(risolti) + ' su ' + num(T) + ')'],
      [quota(chiusi, T) || '—', 'cicli chiusi (' + num(chiusi) + '); ' + num(T - chiusi) + ' aperti'],
      [vpc.media != null ? String(vpc.media).replace('.', ',') : '—', 'visite per ciclo, in media'],
    ];
    h += '<div class="cic-kpi">' + kpi.map((k) => '<div><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>').join('') + '</div>';
    h += '<p class="cic-leggi"><b>Come si legge.</b> Un <b>ciclo</b> è il percorso di una-tre visite su una fase del lotto (il «processo di consulenza» della procedura CNCPT): si chiude secondo la regola Formedil letta sulla visita del ciclo e riparte dopo una chiusura o quando il cantiere è cambiato in modo sostanziale. Il numero di accesso al cantiere non cambia. Asseverazioni escluse.</p>';
    h += '<div class="cic-griglia">';
    // 1. esiti
    const rEs = CLASSI.filter((c) => +cl[c[0]]).map((c) => ({ cls: ['ritorno_in_attesa', 'ritorno_non_fatto', 'cantiere_chiuso', 'aperto_senza_rientro', 'in_percorso_aperto', 'fermo', 'critico_aperto'].includes(c[0]) ? 'cic-aperto' : '', celle: [esc(c[1]) + (c[2] ? ' <span class="cic-desc">' + esc(c[2]) + '</span>' : ''), num(cl[c[0]]), perc(cl[c[0]], T, c[0].startsWith('risolto') ? '' : 'q')] }));
    rEs.push({ cls: 'cic-tot', celle: ['Totale', num(T), ''] });
    h += sezione('Esiti dei cicli', tabella(['Esito', 'Cicli', '%'], rEs), 'In grigio i cicli ancora aperti: ritorno in attesa o scaduto, percorso in corso, fermo al Coordinatore, cantiere critico proposto. «Ritorno non fatto» è un dato d\'insieme, da leggere con prudenza.', true);
    // 2. visite per ciclo
    const dist = vpc.dist || {};
    const rV = ['1', '2', '3', '4', '5'].filter((k) => +dist[k]).map((k) => ({ celle: [k === '5' ? '5 o più' : k + (k === '1' ? ' visita' : ' visite'), num(dist[k]), perc(dist[k], T, 'q')] }));
    h += sezione('Visite per ciclo', tabella(['Visite nel ciclo', 'Cicli', '%'], rV), 'Media: ' + (vpc.media != null ? String(vpc.media).replace('.', ',') : '—') + ' visite per ciclo. La procedura ne prevede da una a tre; la 4ª e la 5ª solo autorizzate dal Coordinatore o dentro una serie.');
    // 3. percorsi
    const pc = Array.isArray(d.percorsi) ? d.percorsi : [];
    const rP = pc.map((p) => ({ celle: [esc(PERCORSI[p.percorso] || p.percorso), num(p.n), num(p.risolti), num(p.non_risolti)] }));
    h += sezione('Cicli fermi alla 3ª visita: i seguiti', rP.length ? tabella(['Seguito scelto dal Coordinatore', 'Cicli', 'Risolti', 'Non risolti'], rP) : '<p class="cic-nota">Nessun seguito deciso nel periodo' + (+cl.fermo ? '; ' + num(cl.fermo) + ' cicli fermi in attesa del Coordinatore' : '') + '.</p>',
      'Con IPC medio ancora presente alla 3ª visita il ciclo si ferma e il Coordinatore sceglie: visite 4ª e 5ª, serie, conferenza di cantiere, caso alla Commissione o nessun seguito. Dopo la 5ª visita senza miglioramento, cantiere critico.');
    // 4. la conferma del tecnico
    h += sezione('La conferma del tecnico', '<div class="cic-mini"><div><b>' + num(d.chieste) + '</b><span>volte il programma ha chiesto al tecnico se il ciclo continua o ne apre uno nuovo</span></div><div><b>' + num(d.divergenze) + '</b><span>scelte diverse dalla proposta del programma' + (+d.chieste ? ' (' + quota(d.divergenze, d.chieste) + ')' : '') + '</span></div></div>',
      'Il programma propone il cambio di ciclo confrontando imprese esecutrici e fasi di lavoro; il tecnico, che era in cantiere, conferma o corregge con un motivo. Chi ha scelto che cosa lo vede solo il Coordinatore nella sua Zona.');
    h += '</div>';
    return h;
  }

  /* ── 📈 Miglioramento e serie ── */
  function costruisciMiglioramento(d, per) {
    per = per || periodo('');
    if (!d || typeof d !== 'object' || !(+d.cicli >= 0)) return errore('i dati arrivati non sono completi');
    const T = +d.cicli || 0;
    let h = testa(per, d);
    if (!T) return h + vuoto(per, d);
    const ipc = d.ipc || {};
    const cr = +ipc.con_ritorno || 0;
    const kpi = [
      [num(cr), 'cicli con almeno un ritorno, su ' + num(T)],
      [quota(ipc.migliorati, cr) || '—', 'hanno abbassato l\'IPC (' + num(ipc.migliorati) + ')'],
      [quota(ipc.uguali, cr) || '—', 'IPC uguale (' + num(ipc.uguali) + ', di cui ' + num(ipc.uguali_basso) + ' su basso o nessun rilievo)'],
      [quota(ipc.peggiorati, cr) || '—', 'peggiorati (' + num(ipc.peggiorati) + ')'],
    ];
    h += '<div class="cic-kpi">' + kpi.map((k) => '<div><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>').join('') + '</div>';
    h += '<p class="cic-leggi"><b>Come si legge.</b> Per ogni ciclo con più di una visita si confronta l\'IPC della <b>prima</b> visita con quello dell\'<b>ultima</b>. Un IPC uguale su basso o nessun rilievo è un ciclo risolto secondo la procedura, non un mancato miglioramento. Oggi questo dato non compare in nessuna statistica nazionale.</p>';
    h += '<div class="cic-griglia">';
    // 1. matrice prima → ultima
    const mat = Array.isArray(ipc.matrice) ? ipc.matrice : [];
    const cella = (da, a) => { const r = mat.find((m) => m.da === da && m.a === a); return r ? +r.n : 0; };
    const presenti = IPC_ORD.filter((k) => mat.some((m) => m.da === k || m.a === k));
    if (cr && presenti.length) {
      const righe = presenti.map((da) => ({ celle: [esc(IPC_NOME[da])].concat(presenti.map((a) => { const n = cella(da, a); const o = IPC_ORD.indexOf(a) - IPC_ORD.indexOf(da); return n ? '<span class="' + (o < 0 ? 'cic-meglio' : o > 0 ? 'cic-peggio' : '') + '">' + num(n) + '</span>' : '<span class="cic-vuoto">·</span>'; })) }));
      h += sezione('IPC alla prima e all\'ultima visita', tabella(['Prima ↓ · Ultima →'].concat(presenti.map((a) => esc(IPC_NOME[a]))), righe, 'cic-mat'), 'In verde i cicli migliorati, in rosso i peggiorati; sulla diagonale quelli rimasti uguali.');
    } else {
      h += sezione('IPC alla prima e all\'ultima visita', '<p class="cic-nota">Nessun ciclo con più di una visita nel periodo: il confronto si farà ai primi ritorni.</p>', '');
    }
    // 2. IPC alla prima visita
    const prima = ipc.prima || {};
    const rPr = IPC_ORD.filter((k) => +prima[k]).map((k) => ({ celle: [esc(IPC_NOME[k]), num(prima[k]), perc(prima[k], T, k === 'ALTO' || k === 'MEDIO' ? 'r' : 'q')] }));
    h += sezione('IPC alla prima visita del ciclo', tabella(['IPC', 'Cicli', '%'], rPr), 'Con nessun rilievo il ciclo si chiude alla prima visita; con IPC basso, medio o alto parte il percorso dei ritorni.');
    // 3. serie
    const s = d.serie || {};
    const rS = (Array.isArray(s.righe) ? s.righe : []).map((r) => ({ celle: [esc(r.impresa || '?') + ' <span class="cic-desc">n. ' + esc(r.id) + (r.stato ? ', ' + esc(r.stato) : '') + '</span>', num(r.fatte) + ' / ' + num(r.previste), num(r.cicli), num(r.lotti), esc(IPC_NOME[r.ipc_inizio] || r.ipc_inizio) + ' → ' + esc(IPC_NOME[r.ipc_fine] || r.ipc_fine), esc(dIt(r.dal)) + (r.al && r.al !== r.dal ? ' – ' + esc(dIt(r.al)) : '')] }));
    const corpoS = '<div class="cic-mini"><div><b>' + num(s.n) + '</b><span>serie di visite con cicli nel periodo</span></div><div><b>' + num(s.fatte) + ' / ' + num(s.previste) + '</b><span>accessi fatti sui previsti</span></div><div><b>' + num(s.cicli) + '</b><span>cicli dentro le serie</span></div><div><b>' + num(s.migliorate) + '</b><span>serie con IPC migliorato dall\'inizio alla fine' + (+s.peggiorate ? ', ' + num(s.peggiorate) + ' peggiorate' : '') + '</span></div></div>'
      + (rS.length ? tabella(['Serie', 'Fatte / previste', 'Cicli', 'Lotti', 'IPC inizio → fine', 'Periodo'], rS) : '');
    h += sezione('Serie di visite', corpoS, 'La serie è un contenitore e conta i suoi accessi; dentro si applicano gli stessi cicli, che ripartono quando il cantiere cambia. Le visite 4ª e 5ª dentro una serie non chiedono un\'altra autorizzazione. Spesso riguardano cantieri con IPC basso che seguono comunque il percorso di miglioramento.' + (rS.length ? '' : ' L\'elenco delle serie lo vede il personale dell\'Area.'), true);
    h += '</div>';
    return h;
  }

  /* ── In pagina ── */
  const CSS = '#card-cicli p,#card-miglioramento p{margin:0}'
    + '.cic-periodo{font-size:12.5px;color:#565c66;margin:0 0 10px}'
    + '.cic-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 8px}'
    + '.cic-kpi div{border:1px solid var(--border,#e2e2e2);border-radius:8px;padding:7px 11px;display:flex;align-items:center;gap:10px}'
    + '.cic-kpi b{font-size:22px;color:var(--orange,#e7500f);white-space:nowrap}.cic-kpi span{font-size:12px;color:#565c66;line-height:1.3}'
    + '.cic-errore{color:#c0392b;font-size:13px}.cic-nota{font-size:11.5px;color:#777;line-height:1.45;margin-top:6px!important}'
    + '.cic-leggi{font-size:11.5px;color:#666;line-height:1.5;background:#f6f6f7;border-radius:6px;padding:6px 10px;margin:0 0 12px!important}'
    + '.cic-griglia{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}'
    + '.cic-sez{border:1px solid var(--border,#e2e2e2);border-radius:10px;padding:10px 12px 9px;min-width:0}.cic-sez.cic-largo{grid-column:1/-1}'
    + '.cic-sez h4{margin:0 0 6px;font-size:14px;color:#333}'
    + '.cic-tab-box{overflow-x:auto}.cic-tab{width:100%;border-collapse:collapse;font-size:12.5px}'
    + '.cic-tab th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.2px;color:#888;border-bottom:1.5px solid #ddd;padding:3px 6px;font-weight:600;white-space:nowrap}'
    + '.cic-tab td{border-bottom:1px solid #f0f0f0;padding:3px 6px;line-height:1.3}.cic-tab .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.cic-tab tr.cic-tot td{font-weight:700;border-top:1.5px solid #ddd;border-bottom:0}.cic-tab tr.cic-aperto td{color:#777}'
    + '.cic-tab.cic-mat td,.cic-tab.cic-mat th{text-align:center}.cic-tab.cic-mat td:first-child,.cic-tab.cic-mat th:first-child{text-align:left}'
    + '.cic-meglio{color:#2d7a06;font-weight:700}.cic-peggio{color:#c0392b;font-weight:700}'
    + '.cic-p{display:inline-flex;align-items:center;gap:6px}.cic-p i{display:inline-block;width:40px;height:6px;background:#eee;border-radius:3px;overflow:hidden}'
    + '.cic-p i b{display:block;height:100%;background:var(--orange,#e7500f)}.cic-p-r i b{background:#565c66}.cic-p-q i b{background:#9aa0a8}'
    + '.cic-vuoto{color:#bbb}.cic-desc{font-size:11px;color:#999;font-weight:400}'
    + '.cic-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}.cic-mini div{background:#f6f6f7;border-radius:8px;padding:8px 10px}'
    + '.cic-mini b{display:block;font-size:22px;color:var(--orange,#e7500f)}.cic-mini span{font-size:12px;color:#565c66}'
    + '@media (max-width:1100px){.cic-griglia{grid-template-columns:minmax(0,1fr)}.cic-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '@media (max-width:560px){.cic-kpi,.cic-mini{grid-template-columns:minmax(0,1fr)}.cic-p i{display:none}.cic-tab{font-size:11.5px}.cic-tab td,.cic-tab th{padding:3px 4px}.cic-sez{padding:8px}}';

  const SCHEDE = { cicli: { id: 'card-cicli', titolo: '🔁 Cicli di visita', costruisci: costruisciCicli }, miglioramento: { id: 'card-miglioramento', titolo: '📈 Miglioramento e serie', costruisci: costruisciMiglioramento } };
  let _giro = 0, _dati = null, _datiPer = '';
  function scheda(gruppo) {
    if (typeof document === 'undefined') return null;
    const def = SCHEDE[gruppo]; if (!def) return null;
    let c = document.getElementById(def.id);
    if (c) return c;
    const sez = document.getElementById('view-statistiche'); if (!sez) return null;
    if (!document.getElementById('cic-stile')) { const st = document.createElement('style'); st.id = 'cic-stile'; st.textContent = CSS; document.head.appendChild(st); }
    c = document.createElement('div');
    c.className = 'card'; c.id = def.id; c.style.display = 'none';
    c.innerHTML = '<h3>' + def.titolo + '</h3><div class="cic-corpo"></div>';
    /* dopo la scheda della Commissione, se c'è; altrimenti dopo i contatori */
    const dopo = document.getElementById('card-miglioramento') && gruppo === 'cicli' ? null : (document.getElementById('card-cicli') || document.getElementById('card-commissione') || document.getElementById('dash-kpi'));
    if (dopo && dopo.parentNode === sez) sez.insertBefore(c, dopo.nextSibling); else sez.appendChild(c);
    if (!c._agganciato) { const fE = document.getElementById('fd-eserc'); if (fE) fE.addEventListener('change', () => { if (c.style.display !== 'none') carica(gruppo); }); c._agganciato = true; }
    return c;
  }
  async function carica(gruppo) {
    const c = scheda(gruppo); if (!c) return;
    const corpo = c.querySelector('.cic-corpo');
    const sb = W.sb;
    const fE = document.getElementById('fd-eserc');
    const per = periodo(fE ? fE.value : '');
    const giro = ++_giro;
    const chiave = (per.da || '') + '|' + (per.a || '');
    if (!_dati || _datiPer !== chiave) {
      corpo.innerHTML = '<p class="cic-nota">Calcolo le statistiche dei cicli per ' + esc(per.nome) + '…</p>';
      let data = null, err = null;
      try {
        if (!sb) throw new Error('collegamento al database non pronto');
        const r = await sb.rpc('dash_cicli', { p_da: per.da, p_a: per.a }); data = r.data; err = r.error;
      } catch (e) { err = e; }
      if (giro !== _giro) return;
      if (err || !data) { console.warn('dash_cicli:', err); corpo.innerHTML = errore(err && err.message); return; }
      _dati = data; _datiPer = chiave;
    }
    corpo.innerHTML = SCHEDE[gruppo].costruisci(_dati, per);
  }
  function mostra(gruppo) {
    gruppo = SCHEDE[gruppo] ? gruppo : 'cicli';
    Object.keys(SCHEDE).forEach((k) => { if (k !== gruppo) { const o = document.getElementById(SCHEDE[k].id); if (o) o.style.display = 'none'; } });
    const c = scheda(gruppo); if (!c) return;
    c.style.display = ''; c.classList.remove('v2-nasc');
    carica(gruppo);
  }
  function nascondi() { Object.keys(SCHEDE).forEach((k) => { const c = document.getElementById(SCHEDE[k].id); if (c) c.style.display = 'none'; }); }
  function azzera() { _dati = null; _datiPer = ''; }

  W.statCicli = { periodo, costruisciCicli, costruisciMiglioramento, mostra, nascondi, carica, azzera, CLASSI, PERCORSI };
  if (typeof document !== 'undefined') { scheda('cicli'); scheda('miglioramento'); }
})();
