/* ============================================================
   STATISTICHE «PER LA COMMISSIONE» — Gestionale Visite
   (20/10/2026, chiesto dall'utente dopo la seduta della Commissione
   Salute e Sicurezza del 20/10)

   Una sottopagina delle 📊 Statistiche: si apre col pulsante
   «🏛️ Per la Commissione» nella fila dei gruppi di grafici (veste-v2.js,
   pilloleStatistiche). Riprende, sul periodo scelto, le sei sezioni del
   documento 2_AREE/Commissione_Sicurezza/materiale_riunioni/
   2026_10_20_REL_Commissione-Sicurezza_statistiche-richieste.

   - I numeri li calcola il database: dash_commissione(p_da, p_a), solo
     totali. Qui si disegnano e basta.
   - Conta SOLO il filtro Esercizio (data della visita): tecnico, tipo di
     visita e IPC non si applicano. Nessun dato per tecnico: la scheda la
     vedono anche Direttore e consiglieri.
   - Imprese sospese: solo i conteggi, mai l'elenco.
   - Se la lettura non riesce si scrive «non sono riuscito a leggere»,
     mai zero.
   - Gruppi piccoli: sotto SOGLIA_PICCOLO visite la percentuale non
     compare («pochi dati»); sotto SOGLIA_POCHE compare con ⚠.
   - Le aree del territorio stanno nel database (aree_territorio,
     aree_territorio_comuni), non qui.
   - (sera del 20/10/2026, chiesto dall'utente: «le sezioni possono
     prendere meno spazio ed essere più leggibili») sezioni in riquadri
     su due colonne, tabelle strette con barrette per le percentuali,
     legenda in una riga; le sospese passano a sezione 5, il territorio,
     che è la tabella più larga, chiude a tutta larghezza.
   ============================================================ */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const SOGLIA_PICCOLO = 10;
  const SOGLIA_POCHE = 30;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => String(+n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  /* percentuale con una cifra decimale e la virgola; null se il denominatore è zero */
  function quota(n, d) {
    if (!d) return null;
    return String(Math.round((+n || 0) / d * 1000) / 10).replace('.', ',').replace(/^(\d+)$/, '$1,0') + '%';
  }
  /* la cella di una percentuale: regola dei gruppi piccoli e una barretta che si legge a colpo d'occhio
     (tipo '' = non conformità, arancio; 'r' = rischio, grigio scuro; 'q' = quota, grigio chiaro) */
  function perc(n, d, tipo) {
    if (!d) return '<span class="com-vuoto">—</span>';
    if (d < SOGLIA_PICCOLO) return '<span class="com-piccolo" title="Meno di ' + SOGLIA_PICCOLO + ' visite: la percentuale non si calcola">pochi dati</span>';
    const w = Math.max(0, Math.min(100, Math.round((+n || 0) / d * 100)));
    return '<span class="com-p' + (tipo ? ' com-p-' + tipo : '') + '"><i><b style="width:' + w + '%"></b></i>' + quota(n, d) + '</span>'
      + (d < SOGLIA_POCHE ? ' <span class="com-poche" title="Meno di ' + SOGLIA_POCHE + ' visite: leggere con prudenza">⚠</span>' : '');
  }
  /* il periodo dall'esercizio della pagina: «2025/2026» → 01/10/2025-30/09/2026; vuoto = tutto lo storico */
  function periodo(fE) {
    const y = +String(fE || '').slice(0, 4);
    if (!y) return { da: null, a: null, nome: 'tutto lo storico' };
    return { da: y + '-10-01', a: (y + 1) + '-09-30', nome: "l'esercizio " + y + '/' + (y + 1) + ' (1 ottobre ' + y + ' – 30 settembre ' + (y + 1) + ')' };
  }

  const CLASSI = { '1-4': 'da 1 a 4', '5-9': 'da 5 a 9', '10-49': 'da 10 a 49', '50+': '50 e oltre', nn: 'addetti non noti' };
  const RUOLI = { 'affidataria ed esecutrice': 'Affidataria ed esecutrice', esecutrice: 'Esecutrice', subappaltatrice: 'Subappaltatrice', affidataria: 'Affidataria (non esegue)', 'lavoratore autonomo': 'Lavoratore autonomo', 'non indicato': 'Ruolo non indicato' };
  const maiusc = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const somma = (righe, campo) => righe.reduce((t, r) => t + (+r[campo] || 0), 0);

  function tabella(intest, righe) {
    return '<div class="com-tab-box"><table class="com-tab"><thead><tr>' + intest.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>'
      + righe.map((r) => '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + r.celle.map((c, i) => '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  /* una sezione: riquadro con numero, titolo, contenuto e una nota breve in fondo; «largo» = a tutta larghezza */
  const sezione = (n, titolo, corpo, nota, largo) => '<section class="com-sez' + (largo ? ' com-largo' : '') + '"><h4><span>' + n + '</span>' + titolo + '</h4>'
    + corpo + (nota ? '<p class="com-nota">' + nota + '</p>' : '') + '</section>';

  /* ── Tutto il contenuto, dai dati di dash_commissione ── */
  function costruisci(d, per, comuni) {
    per = per || periodo('');
    if (!d || typeof d !== 'object' || !(+d.visite >= 0)) return '<p class="com-errore">⚠ Non sono riuscito a leggere le statistiche per la Commissione: i dati arrivati non sono completi. Riprova.</p>';
    const T = +d.visite || 0;
    let h = '<p class="com-periodo">' + esc(maiusc(per.nome)) + ', per data della visita · <b>vale solo il filtro Esercizio</b> · nessun numero è per singolo tecnico.</p>';
    if (!T) return h + '<p class="com-nota">Nessuna visita nel periodo scelto.</p>';

    const dim = Array.isArray(d.dimensione) ? d.dimensione : [];
    const com = Array.isArray(d.committente) ? d.committente : [];
    const ruo = Array.isArray(d.ruolo) ? d.ruolo : [];
    const sub = Array.isArray(d.subappalto) ? d.subappalto : [];
    const cei = Array.isArray(d.ceiv) ? d.ceiv : [];
    const aree = Array.isArray(d.aree) ? d.aree : [];
    const so = d.sospese || {};
    const ct = (c, s) => com.filter((r) => r.ct === c && (s == null || !!r.serv === s));
    const priv = ct('privato'), pub = ct('pubblico');
    const rSub = ruo.find((r) => r.ruolo === 'subappaltatrice') || { visite: 0, nc: 0 };
    const sotto = dim.filter((r) => r.classe === '1-4' || r.classe === '5-9'), sopra = dim.filter((r) => r.classe === '10-49' || r.classe === '50+');

    // in testa: i quattro numeri della pagina e la legenda in una riga
    const kpi = [
      [quota(d.con_nc, T), 'visite con almeno una non conformità (' + num(d.con_nc) + ' su ' + num(T) + ')'],
      [quota(somma(priv, 'nc'), somma(priv, 'visite')) || '—', 'nei cantieri privati, contro ' + (quota(somma(pub, 'nc'), somma(pub, 'visite')) || '—') + ' dei pubblici'],
      [quota(somma(sotto, 'priv_nc'), somma(sotto, 'priv_visite')) || '—', 'privati, imprese sotto i 10 addetti; ' + (quota(somma(sopra, 'priv_nc'), somma(sopra, 'priv_visite')) || '—') + ' le altre'],
      [+rSub.visite >= SOGLIA_PICCOLO ? quota(rSub.nc, rSub.visite) : '—', "quando l'impresa visitata è una subappaltatrice (" + num(rSub.visite) + ' visite)'],
    ];
    h += '<div class="com-kpi">' + kpi.map((k) => '<div><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>').join('') + '</div>';
    h += '<p class="com-leggi"><b>Come si leggono.</b> <b>% NC</b> = visite con almeno una NC− o NC+ nella check-list (ogni visita conta una volta) · <b>NC gravi</b> = visite con almeno una NC+ · <b>% rischio</b> = IPC medio o alto · impresa di riferimento = la principale della visita · escluse le eliminate · <span class="com-piccolo">pochi dati</span> = meno di ' + SOGLIA_PICCOLO + ' visite · ⚠ = meno di ' + SOGLIA_POCHE + ', da leggere con prudenza.</p>';
    h += '<div class="com-griglia">';

    // 1. dimensione: le due tabelle una accanto all'altra
    const conAdd = T - +(dim.find((r) => r.classe === 'nn') || {}).visite || 0;
    const rDim = dim.map((r) => ({ cls: r.classe === 'nn' ? 'com-grigia' : '', celle: [esc(CLASSI[r.classe] || r.classe), num(r.visite), num(r.nc), perc(r.nc, r.visite), num(r.ncg), perc(r.rischio, r.visite, 'r')] }));
    rDim.push({ cls: 'com-tot', celle: ['Totale', num(T), num(d.con_nc), perc(d.con_nc, T), num(d.con_ncg), perc(d.rischio, T, 'r')] });
    const t1 = '<div><p class="com-sottot">Tutte le visite</p>' + tabella(['Addetti', 'Visite', 'Con NC', '% NC', 'NC gravi', '% rischio'], rDim) + '</div>';
    const t2 = '<div><p class="com-sottot">Privato e pubblico separati</p>' + tabella(['Addetti', 'Privato', '% NC', 'Pubblico', '% NC'],
      dim.map((r) => ({ cls: r.classe === 'nn' ? 'com-grigia' : '', celle: [esc(CLASSI[r.classe] || r.classe), num(r.priv_visite), perc(r.priv_nc, r.priv_visite), num(r.pub_visite), perc(r.pub_nc, r.pub_visite)] }))) + '</div>';
    h += sezione(1, "Dimensione dell'impresa", '<div class="com-due">' + t1 + t2 + '</div>',
      "Addetti dell'impresa principale in anagrafica (oggi, non alla data della visita): noti per " + num(conAdd) + ' visite su ' + num(T) + '; 0 addetti contano in «da 1 a 4». Le grandi lavorano soprattutto nel pubblico, dove le NC sono meno: fra i soli privati, '
      + (quota(somma(sotto, 'priv_nc'), somma(sotto, 'priv_visite')) || '—') + ' sotto i 10 addetti (' + num(somma(sotto, 'priv_visite')) + ' visite) e ' + (quota(somma(sopra, 'priv_nc'), somma(sopra, 'priv_visite')) || '—') + ' da 10 in su (' + num(somma(sopra, 'priv_visite')) + ').', true);

    // 2. committente
    const rCom = [];
    [['privato', 'Privato'], ['pubblico', 'Pubblico'], ['non_indicato', 'Committente non indicato']].forEach(([k, nome]) => {
      const tutte = ct(k); const v = somma(tutte, 'visite'); if (!v) return;
      rCom.push({ cls: 'com-capo', celle: [nome, num(v), num(somma(tutte, 'nc')), perc(somma(tutte, 'nc'), v), perc(somma(tutte, 'rischio'), v, 'r')] });
      [[false, 'altre visite'], [true, 'su richiesta o in serie']].forEach(([s, sn]) => {
        const g = ct(k, s); const n = somma(g, 'visite');
        rCom.push({ cls: 'com-sotto', celle: [sn, num(n), num(somma(g, 'nc')), perc(somma(g, 'nc'), n), perc(somma(g, 'rischio'), n, 'r')] });
      });
    });
    h += sezione(2, 'Committente pubblico o privato', tabella(['Committente e tipo di visita', 'Visite', 'Con NC', '% NC', '% rischio'], rCom),
      'Committente dalla sua scheda. «Su richiesta o in serie» = visite su richiesta, in serie e consulenze con attestazione; «altre» = programmate, del CPT, stage, segnalazioni.');

    // 3. ruolo e subappalto
    const sSi = sub.find((r) => r.con_sub) || { visite: 0, nc: 0 }, sNo = sub.find((r) => !r.con_sub) || { visite: 0, nc: 0 };
    h += sezione(3, 'Affidataria o subappaltatrice', tabella(["Ruolo dell'impresa visitata", 'Visite', 'Con NC', '% NC', 'NC gravi', '% rischio'],
      ruo.map((r) => ({ celle: [esc(RUOLI[r.ruolo] || maiusc(r.ruolo)), num(r.visite), num(r.nc), perc(r.nc, r.visite), num(r.ncg), perc(r.rischio, r.visite, 'r')] }))),
      "Ruolo dell'impresa principale. Con subappaltatrici fra le presenti: " + (quota(sSi.nc, sSi.visite) || '—') + ' di visite con NC (' + num(sSi.visite) + ' visite); senza: ' + (quota(sNo.nc, sNo.visite) || '—') + ' (' + num(sNo.visite) + ').');

    // 4. imprese C.E.I.V. e servizi
    const c = (g, ce) => cei.find((r) => r.g === g && !!r.ceiv === ce) || { imprese: 0, visite: 0 };
    const rCei = [['servizi', 'Servizi su richiesta', 'com-capo'], ['serie', 'visite in serie', 'com-sotto'], ['richiesta', 'su richiesta', 'com-sotto'], ['consulenze', 'consulenze con attestazione', 'com-sotto'], ['altre', 'Tutte le altre visite', 'com-capo']]
      .map(([g, nome, cls]) => ({ cls, celle: [nome, num(c(g, true).imprese), num(c(g, true).visite), num(c(g, false).imprese), num(c(g, false).visite)] }));
    const fo = d.cassa_foto || {};
    const tutteCeiv = c('tutte', true).imprese, servCeiv = c('servizi', true).imprese;
    h += sezione(4, 'Imprese C.E.I.V. e servizi', tabella(['', 'Imprese C.E.I.V.', 'Visite', 'Non iscritte', 'Visite'], rCei),
      'Imprese C.E.I.V. visitate: <b>' + num(tutteCeiv) + '</b>, di cui ' + num(servCeiv) + (tutteCeiv && servCeiv ? ' (' + quota(servCeiv, tutteCeiv) + ')' : '') + ' con un servizio. C.E.I.V. = attiva o sospesa nella foto del verbale (alla data della visita per ' + num(fo.alla_data_visita) + ' visite, stato attuale fotografato per ' + num(fo.stato_attuale) + (+fo.senza_foto ? ', stato di oggi per ' + num(fo.senza_foto) + ' senza foto' : '') + "). Un'impresa può stare in più righe.");

    // 5. sospese: solo conteggi
    h += sezione(5, 'Imprese sospese in Cassa Edile',
      "<div class=\"com-mini\"><div><b>" + num(so.principali_visite) + "</b><span>visite rivolte a un'impresa sospesa, a <em>" + num(so.principali_imprese) + '</em> imprese</span></div>'
      + "<div><b>" + num(so.tutte_visite) + "</b><span>visite con almeno un'impresa sospesa fra tutte le presenti: <em>" + num(so.tutte_imprese) + '</em> imprese</span></div></div>',
      "«Sospesa»: iscrizione alla Cassa sospesa, di solito per un'irregolarità nei versamenti; l'impresa però lavora. Solo conteggi: l'elenco qui non si mostra. Stato dalla foto del verbale.");

    // 6. territorio, a tutta larghezza
    const aPd = aree.filter((r) => r.area_id !== 'fuori' && r.area_id !== 'non_assegnato');
    const rAree = aree.map((r) => {
      const spec = r.area_id === 'fuori' || r.area_id === 'non_assegnato';
      const nomi = Array.isArray(r.comuni_nomi) ? r.comuni_nomi.map(esc).join(', ') : '';
      return { cls: r.area_id === 'non_assegnato' ? 'com-allarme' : spec ? 'com-grigia' : '',
        celle: [esc(r.nome) + (r.descrizione ? ' <span class="com-desc">(' + esc(r.descrizione) + ')</span>' : '') + (nomi ? ' <span class="com-desc">' + nomi + '</span>' : ''),
          num(r.visite), '<span class="com-p com-p-q"><i><b style="width:' + Math.round((+r.visite || 0) / T * 100) + '%"></b></i>' + (quota(r.visite, T) || '—') + '</span>', num(r.cantieri),
          spec ? num(r.comuni_toccati) : num(r.comuni_toccati) + ' su ' + num(r.comuni_area), perc(r.nc, r.visite), perc(r.rischio, r.visite, 'r')] };
    });
    h += sezione(6, 'Le visite sul territorio', tabella(['Area', 'Visite', 'Quota', 'Cantieri', 'Comuni toccati', '% NC', '% rischio'], rAree)
      + (aree.some((r) => r.area_id === 'non_assegnato') ? '<p class="com-errore">⚠ Ci sono visite in comuni della provincia che nessuna area comprende: va aggiunto il comune in aree_territorio_comuni.</p>' : '')
      + '<details class="com-comuni"><summary>Quali comuni stanno in ogni area</summary>' + elencoComuni(aPd, comuni) + '</details>',
      'I ' + num(somma(aPd, 'comuni_area')) + ' comuni della provincia in ' + aPd.length + ' aree geografiche, indipendenti dalle zone dei tecnici; «comuni toccati» = con almeno una visita. Le aree le decide la segreteria (tabella aree_territorio).', true);
    return h + '</div>';
  }

  function elencoComuni(aree, comuni) {
    if (comuni === undefined) return '<p class="com-nota">Carico l\'elenco…</p>';
    if (!comuni) return '<p class="com-errore">⚠ Non sono riuscito a leggere l\'elenco dei comuni delle aree.</p>';
    return aree.map((a) => {
      const nomi = (comuni[a.area_id] || []).slice().sort((x, y) => x.localeCompare(y, 'it'));
      return '<p><b>' + esc(a.nome) + (a.descrizione ? ' (' + esc(a.descrizione) + ')' : '') + '</b>: ' + (nomi.length ? nomi.map(esc).join(', ') : '—') + '.</p>';
    }).join('');
  }

  /* ── In pagina ── */
  const CSS = '#card-commissione p{margin:0}'
    + '#card-commissione .com-periodo{font-size:12.5px;color:#565c66;margin:0 0 10px}'
    + '.com-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 8px}'
    + '.com-kpi div{border:1px solid var(--border,#e2e2e2);border-radius:8px;padding:7px 11px;display:flex;align-items:center;gap:10px}'
    + '.com-kpi b{font-size:20px;color:var(--orange,#e7500f);white-space:nowrap}.com-kpi span{font-size:11.5px;color:#565c66;line-height:1.3}'
    + '#card-commissione .com-leggi{font-size:11.5px;color:#666;line-height:1.5;background:#f6f6f7;border-radius:6px;padding:6px 10px;margin:0 0 12px}'
    + '.com-griglia{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}'
    + '.com-sez{border:1px solid var(--border,#e2e2e2);border-radius:10px;padding:10px 12px 9px;min-width:0}.com-sez.com-largo{grid-column:1/-1}'
    + '#card-commissione .com-sez h4{display:flex;align-items:center;gap:7px;margin:0 0 6px;font-size:14px;color:#333}'
    + '#card-commissione .com-sez h4 span{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--orange,#e7500f);color:#fff;font-size:11.5px;flex:none}'
    + '.com-due{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px}'
    + '#card-commissione .com-sottot{font-size:10.5px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:.3px;margin:0 0 2px}'
    + '#card-commissione .com-nota{font-size:11.5px;color:#777;margin:7px 0 0;line-height:1.45}'
    + '.com-errore{color:#c0392b;font-size:13px}'
    + '.com-tab-box{overflow-x:auto}.com-tab{width:100%;border-collapse:collapse;font-size:12.5px}'
    + '.com-tab th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.2px;color:#888;border-bottom:1.5px solid #ddd;padding:3px 6px;font-weight:600;white-space:nowrap}'
    + '.com-tab td{border-bottom:1px solid #f0f0f0;padding:3px 6px;line-height:1.3}.com-tab .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.com-tab th:first-child{width:34%}.com-tab tbody tr:hover td{background:#fafafa}'
    + '.com-tab tr.com-tot td{font-weight:700;border-top:1.5px solid #ddd;border-bottom:0}.com-tab tr.com-capo td{font-weight:700}'
    + '.com-tab tr.com-sotto td:first-child{padding-left:18px;color:#565c66}.com-tab tr.com-grigia td{color:#999}.com-tab tr.com-allarme td{color:#c0392b}'
    + '.com-p{display:inline-flex;align-items:center;gap:6px}.com-p i{display:inline-block;width:40px;height:6px;background:#eee;border-radius:3px;overflow:hidden}'
    + '.com-p i b{display:block;height:100%;background:var(--orange,#e7500f)}.com-p-r i b{background:#565c66}.com-p-q i b{background:#9aa0a8}'
    + '.com-piccolo{font-size:10.5px;color:#aaa;font-style:italic;cursor:help}.com-poche{color:#b07d00;cursor:help;font-size:11px}.com-vuoto{color:#bbb}.com-desc{font-size:11px;color:#999;font-weight:400}'
    + '.com-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px}.com-mini div{background:#f6f6f7;border-radius:8px;padding:8px 10px}'
    + '.com-mini b{display:block;font-size:22px;color:var(--orange,#e7500f)}.com-mini span{font-size:12px;color:#565c66}.com-mini em{font-style:normal;font-weight:700}'
    + '.com-comuni{margin:6px 0 0;font-size:12px;color:#565c66}.com-comuni summary{cursor:pointer;font-weight:600;color:#333;font-size:12px}#card-commissione .com-comuni p{margin:3px 0}'
    + '@media (max-width:1100px){.com-griglia,.com-due{grid-template-columns:minmax(0,1fr)}.com-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '@media (max-width:560px){.com-kpi,.com-mini{grid-template-columns:minmax(0,1fr)}.com-p i{display:none}.com-tab{font-size:11.5px}.com-tab th:first-child{width:auto}.com-tab td,.com-tab th{padding:3px 4px}.com-sez{padding:8px}}';

  let _giro = 0, _comuni;
  function scheda() {
    if (typeof document === 'undefined') return null;
    let c = document.getElementById('card-commissione');
    if (c) return c;
    const sez = document.getElementById('view-statistiche'); if (!sez) return null;
    if (!document.getElementById('com-stile')) { const st = document.createElement('style'); st.id = 'com-stile'; st.textContent = CSS; document.head.appendChild(st); }
    c = document.createElement('div');
    c.className = 'card'; c.id = 'card-commissione'; c.style.display = 'none';
    c.innerHTML = '<h3>🏛️ Per la Commissione Salute e Sicurezza</h3><div id="com-corpo"></div>';
    const kpi = document.getElementById('dash-kpi');
    if (kpi && kpi.parentNode === sez) sez.insertBefore(c, kpi.nextSibling); else sez.appendChild(c);
    const fE = document.getElementById('fd-eserc');
    if (fE) fE.addEventListener('change', () => { if (c.style.display !== 'none') carica(); });
    return c;
  }
  async function leggiComuni(sb) {
    try {
      const [a, ci] = await Promise.all([
        sb.from('aree_territorio_comuni').select('comune_cod,area_id'),
        sb.from('comuni_istat').select('cod,nome').eq('prov', 'PD').is('soppresso_il', null)]);
      if (a.error || ci.error || !a.data || !ci.data) return null;
      const nomi = {}; ci.data.forEach((r) => { nomi[r.cod] = r.nome; });
      const out = {}; a.data.forEach((r) => { (out[r.area_id] = out[r.area_id] || []).push(nomi[r.comune_cod] || r.comune_cod); });
      return out;
    } catch (e) { return null; }
  }
  async function carica() {
    const c = scheda(); if (!c) return;
    const corpo = c.querySelector('#com-corpo');
    const sb = W.sb;
    const fE = document.getElementById('fd-eserc');
    const per = periodo(fE ? fE.value : '');
    const giro = ++_giro;
    corpo.innerHTML = '<p class="com-nota">Calcolo le statistiche per ' + esc(per.nome) + '…</p>';
    let data = null, err = null;
    try {
      if (!sb) throw new Error('collegamento al database non pronto');
      const r = await sb.rpc('dash_commissione', { p_da: per.da, p_a: per.a }); data = r.data; err = r.error;
    } catch (e) { err = e; }
    if (giro !== _giro) return;   // nel frattempo è cambiato l'esercizio
    if (err || !data) {
      console.warn('dash_commissione:', err);
      corpo.innerHTML = '<p class="com-errore">⚠ Non sono riuscito a leggere le statistiche per la Commissione: riprova. Nessun numero è mostrato, perché non sarebbe vero.</p>';
      return;
    }
    corpo.innerHTML = costruisci(data, per, _comuni);
    if (_comuni === undefined) {
      const cm = await leggiComuni(sb);
      if (cm) _comuni = cm;
      if (giro !== _giro) return;
      const det = corpo.querySelector('.com-comuni');
      if (det) det.innerHTML = '<summary>Quali comuni stanno in ogni area</summary>' + elencoComuni((data.aree || []).filter((r) => r.area_id !== 'fuori' && r.area_id !== 'non_assegnato'), cm || null);
    }
  }
  function mostra() { const c = scheda(); if (!c) return; const prima = c.style.display === 'none'; c.style.display = ''; c.classList.remove('v2-nasc'); if (prima) carica(); }
  function nascondi() { const c = scheda(); if (c) c.style.display = 'none'; }

  if (typeof document !== 'undefined') scheda();
  W.statCommissione = { costruisci, periodo, quota, perc, elencoComuni, mostra, nascondi, carica, SOGLIA_PICCOLO, SOGLIA_POCHE };
})();
