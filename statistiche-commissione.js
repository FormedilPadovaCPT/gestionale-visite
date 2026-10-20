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
     compare; sotto SOGLIA_POCHE compare con ⚠.
   - Le aree del territorio stanno nel database (aree_territorio,
     aree_territorio_comuni), non qui.
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
  /* la cella di una percentuale, con la regola dei gruppi piccoli */
  function perc(n, d) {
    if (!d) return '<span class="com-vuoto">—</span>';
    if (d < SOGLIA_PICCOLO) return '<span class="com-piccolo">gruppo troppo piccolo</span>';
    const q = quota(n, d);
    return d < SOGLIA_POCHE ? q + ' <span class="com-poche" title="Meno di ' + SOGLIA_POCHE + ' visite: leggere con prudenza">⚠</span>' : q;
  }
  /* il periodo dall'esercizio della pagina: «2025/2026» → 01/10/2025-30/09/2026; vuoto = tutto lo storico */
  function periodo(fE) {
    const y = +String(fE || '').slice(0, 4);
    if (!y) return { da: null, a: null, nome: 'tutto lo storico' };
    return { da: y + '-10-01', a: (y + 1) + '-09-30', nome: "l'esercizio " + y + '/' + (y + 1) + ' (1 ottobre ' + y + ' – 30 settembre ' + (y + 1) + ')' };
  }

  const CLASSI = { '1-4': 'da 1 a 4', '5-9': 'da 5 a 9', '10-49': 'da 10 a 49', '50+': '50 e oltre', nn: 'numero di addetti non noto' };
  const RUOLI = { 'affidataria ed esecutrice': 'Affidataria ed esecutrice', esecutrice: 'Esecutrice', subappaltatrice: 'Subappaltatrice', affidataria: 'Affidataria (non esegue)', 'lavoratore autonomo': 'Lavoratore autonomo', 'non indicato': 'Ruolo non indicato' };
  const maiusc = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const somma = (righe, campo) => righe.reduce((t, r) => t + (+r[campo] || 0), 0);

  function tabella(intest, righe, cls) {
    return '<div class="com-tab-box"><table class="com-tab' + (cls ? ' ' + cls : '') + '"><thead><tr>' + intest.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>'
      + righe.map((r) => '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + r.celle.map((c, i) => '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  /* ── Tutto il contenuto, dai dati di dash_commissione ── */
  function costruisci(d, per, comuni) {
    per = per || periodo('');
    if (!d || typeof d !== 'object' || !(+d.visite >= 0)) return '<p class="com-errore">⚠ Non sono riuscito a leggere le statistiche per la Commissione: i dati arrivati non sono completi. Riprova.</p>';
    const T = +d.visite || 0;
    let h = '<p class="com-periodo">Periodo: ' + esc(per.nome) + ', per data della visita. <b>Qui vale solo il filtro Esercizio</b>: tecnico, tipo di visita e IPC non si applicano, e nessun numero è per singolo tecnico.</p>';
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

    // in testa: i quattro numeri della pagina
    const kpi = [
      [quota(d.con_nc, T), 'visite con almeno una non conformità (' + num(d.con_nc) + ' su ' + num(T) + ')'],
      [quota(somma(priv, 'nc'), somma(priv, 'visite')) || '—', 'nei cantieri privati, contro ' + (quota(somma(pub, 'nc'), somma(pub, 'visite')) || '—') + ' dei pubblici'],
      [quota(somma(sotto, 'priv_nc'), somma(sotto, 'priv_visite')) || '—', 'privati, imprese sotto i 10 addetti; ' + (quota(somma(sopra, 'priv_nc'), somma(sopra, 'priv_visite')) || '—') + ' le altre'],
      [+rSub.visite >= SOGLIA_PICCOLO ? quota(rSub.nc, rSub.visite) : '—', "quando l'impresa visitata è una subappaltatrice (" + num(rSub.visite) + ' visite)'],
    ];
    h += '<div class="com-kpi">' + kpi.map((k) => '<div><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>').join('') + '</div>';
    h += '<div class="com-leggi"><b>Come si leggono le tabelle.</b> Una visita «con non conformità» ha almeno una voce della check-list segnata NC− (lieve) o NC+ (grave): ogni visita conta una volta, anche se le non conformità sono più d\'una. «Rischio medio o alto» è l\'indice di pericolosità del cantiere (IPC) scritto nel verbale. L\'impresa di riferimento è l\'impresa principale della visita. Sono escluse le visite eliminate. Sotto ' + SOGLIA_PICCOLO + ' visite la percentuale non si mostra; sotto ' + SOGLIA_POCHE + ' compare con ⚠, da leggere con prudenza.</div>';

    // 1. dimensione
    const conAdd = T - +(dim.find((r) => r.classe === 'nn') || {}).visite || 0;
    h += '<h4><span>1</span>Dimensione dell\'impresa</h4><p class="com-nota">Numero di addetti scritto nell\'anagrafica dell\'impresa principale: c\'è per ' + num(conAdd) + ' visite su ' + num(T) + '.</p>';
    const rDim = dim.map((r) => ({ celle: [esc(CLASSI[r.classe] || r.classe), num(r.visite), num(r.nc), perc(r.nc, r.visite), num(r.ncg), perc(r.rischio, r.visite)], cls: r.classe === 'nn' ? 'com-grigia' : '' }));
    rDim.push({ cls: 'com-tot', celle: ['Totale', num(T), num(d.con_nc), perc(d.con_nc, T), num(d.con_ncg), perc(d.rischio, T)] });
    h += tabella(['Addetti dell\'impresa', 'Visite', 'Con NC', 'Visite con non conformità', 'Con NC grave', 'Rischio medio o alto'], rDim);
    h += '<p class="com-nota">La stessa tabella separando i cantieri privati dai pubblici, perché le imprese grandi lavorano soprattutto nel pubblico, dove le non conformità sono meno:</p>';
    h += tabella(['Addetti', 'Privato · visite', 'Privato · con NC', 'Pubblico · visite', 'Pubblico · con NC'],
      dim.map((r) => ({ celle: [esc(r.classe === 'nn' ? 'non noto' : CLASSI[r.classe] || r.classe), num(r.priv_visite), perc(r.priv_nc, r.priv_visite), num(r.pub_visite), perc(r.pub_nc, r.pub_visite)], cls: r.classe === 'nn' ? 'com-grigia' : '' })));
    h += '<p class="com-nota">Fra i cantieri privati: ' + (quota(somma(sotto, 'priv_nc'), somma(sotto, 'priv_visite')) || '—') + ' di visite con non conformità sotto i 10 addetti (' + num(somma(sotto, 'priv_visite')) + ' visite), '
      + (quota(somma(sopra, 'priv_nc'), somma(sopra, 'priv_visite')) || '—') + ' da 10 in su (' + num(somma(sopra, 'priv_visite')) + '). Il numero di addetti è quello di oggi, non quello alla data della visita; un\'impresa con 0 addetti in anagrafica conta in «da 1 a 4».</p>';

    // 2. committente
    const rCom = [];
    [['privato', 'Privato'], ['pubblico', 'Pubblico'], ['non_indicato', 'Committente non indicato']].forEach(([k, nome]) => {
      const tutte = ct(k); const v = somma(tutte, 'visite'); if (!v) return;
      rCom.push({ cls: 'com-capo', celle: [nome, num(v), num(somma(tutte, 'nc')), perc(somma(tutte, 'nc'), v), perc(somma(tutte, 'rischio'), v)] });
      [[false, 'altre visite (programmate, del CPT, stage, segnalazioni)'], [true, 'su richiesta o in serie']].forEach(([s, sn]) => {
        const g = ct(k, s); const n = somma(g, 'visite');
        rCom.push({ cls: 'com-sotto', celle: [sn, num(n), num(somma(g, 'nc')), perc(somma(g, 'nc'), n), perc(somma(g, 'rischio'), n)] });
      });
    });
    h += '<h4><span>2</span>Committente pubblico o privato</h4><p class="com-nota">Il tipo di committente è quello della scheda del committente del cantiere. Il confronto va fatto anche per tipo di visita: molte visite pubbliche sono servizi in serie su grandi cantieri. «Su richiesta o in serie» = visite su richiesta, in serie e consulenze con attestazione.</p>';
    h += tabella(['Committente e tipo di visita', 'Visite', 'Con NC', 'Visite con non conformità', 'Rischio medio o alto'], rCom);

    // 3. ruolo e subappalto
    h += '<h4><span>3</span>Affidataria o subappaltatrice</h4><p class="com-nota">Il ruolo è quello dell\'impresa principale della visita, cioè quella a cui il verbale è rivolto.</p>';
    h += tabella(['Ruolo dell\'impresa visitata', 'Visite', 'Con NC', 'Visite con non conformità', 'Con NC grave', 'Rischio medio o alto'],
      ruo.map((r) => ({ celle: [esc(RUOLI[r.ruolo] || maiusc(r.ruolo)), num(r.visite), num(r.nc), perc(r.nc, r.visite), num(r.ncg), perc(r.rischio, r.visite)] })));
    const sSi = sub.find((r) => r.con_sub) || { visite: 0, nc: 0 }, sNo = sub.find((r) => !r.con_sub) || { visite: 0, nc: 0 };
    h += '<p class="com-nota">Presenza di subappaltatrici fra le imprese in cantiere: ' + (quota(sSi.nc, sSi.visite) || '—') + ' di visite con non conformità dove ce ne sono (' + num(sSi.visite) + ' visite), ' + (quota(sNo.nc, sNo.visite) || '—') + ' dove non ce ne sono (' + num(sNo.visite) + ').</p>';

    // 4. imprese C.E.I.V. e servizi
    const c = (g, ce) => cei.find((r) => r.g === g && !!r.ceiv === ce) || { imprese: 0, visite: 0 };
    const rCei = [['servizi', 'Servizi su richiesta', ''], ['serie', 'di cui visite in serie', 'com-sotto'], ['richiesta', 'di cui su richiesta', 'com-sotto'], ['consulenze', 'di cui consulenze con attestazione', 'com-sotto'], ['altre', 'Tutte le altre visite', '']]
      .map(([g, nome, cls]) => ({ cls, celle: [nome, num(c(g, true).imprese), num(c(g, true).visite), num(c(g, false).imprese), num(c(g, false).visite)] }));
    const fo = d.cassa_foto || {};
    const tutteCeiv = c('tutte', true).imprese, servCeiv = c('servizi', true).imprese;
    h += '<h4><span>4</span>Le imprese C.E.I.V. che chiedono i servizi</h4><p class="com-nota">Sono C.E.I.V. le imprese attive o sospese nella lista della Cassa Edile, secondo la foto scritta nel verbale. Un\'impresa può comparire in più righe, se ha avuto sia servizi sia altre visite.</p>';
    h += tabella(['', 'Imprese C.E.I.V.', 'Visite', 'Imprese non iscritte', 'Visite'], rCei);
    h += '<p class="com-nota">Imprese C.E.I.V. visitate nel periodo: ' + num(tutteCeiv) + '; hanno chiesto un servizio ' + num(servCeiv) + (tutteCeiv && servCeiv ? ' (' + quota(servCeiv, tutteCeiv) + ')' : '') + '.'
      + ' Stato in Cassa dell\'impresa principale: alla data della visita per ' + num(fo.alla_data_visita) + ' visite, con lo stato attuale fotografato nel verbale per ' + num(fo.stato_attuale) + (+fo.senza_foto ? ', con lo stato di oggi dell\'anagrafica per ' + num(fo.senza_foto) + ' visite senza foto' : '') + '.</p>';

    // 5. territorio
    const aPd = aree.filter((r) => r.area_id !== 'fuori' && r.area_id !== 'non_assegnato');
    const rAree = aree.map((r) => {
      const spec = r.area_id === 'fuori' || r.area_id === 'non_assegnato';
      const nomi = Array.isArray(r.comuni_nomi) ? r.comuni_nomi.map(esc).join(', ') : '';
      return { cls: r.area_id === 'non_assegnato' ? 'com-allarme' : spec ? 'com-grigia' : '',
        celle: [esc(r.nome) + (r.descrizione ? ' <span class="com-desc">(' + esc(r.descrizione) + ')</span>' : '') + (nomi ? '<br><span class="com-desc">' + nomi + '</span>' : ''), num(r.visite), quota(r.visite, T) || '—', num(r.cantieri),
          spec ? num(r.comuni_toccati) : num(r.comuni_toccati) + ' su ' + num(r.comuni_area), perc(r.nc, r.visite), perc(r.rischio, r.visite)] };
    });
    h += '<h4><span>5</span>Le visite sul territorio</h4><p class="com-nota">I ' + num(somma(aPd, 'comuni_area')) + ' comuni della provincia divisi in ' + aPd.length + ' aree geografiche, che non dipendono dalle zone dei tecnici. «Comuni toccati» dice in quanti comuni dell\'area c\'è stata almeno una visita. Le aree sono una proposta della segreteria e si cambiano nel database (tabella aree_territorio), non nell\'app.</p>';
    h += tabella(['Area', 'Visite', 'Quota delle visite', 'Cantieri', 'Comuni toccati', 'Con NC', 'Rischio medio o alto'], rAree);
    if (aree.some((r) => r.area_id === 'non_assegnato')) h += '<p class="com-errore">⚠ Ci sono visite in comuni della provincia che nessuna area comprende: va aggiunto il comune in aree_territorio_comuni.</p>';
    h += '<details class="com-comuni"><summary>Quali comuni stanno in ogni area</summary>' + elencoComuni(aPd, comuni) + '</details>';

    // 6. sospese
    h += '<h4><span>6</span>Le imprese sospese in Cassa Edile</h4><p>«Sospesa» vuol dire che l\'iscrizione alla Cassa è sospesa, di solito per un\'irregolarità nei versamenti: l\'impresa però lavora. Nel periodo le visite rivolte a un\'impresa sospesa sono state <b>' + num(so.principali_visite) + '</b>, a <b>' + num(so.principali_imprese) + '</b> imprese. Contando tutte le imprese presenti in cantiere, non solo quella visitata, le imprese sospese incontrate sono <b>' + num(so.tutte_imprese) + '</b>, in <b>' + num(so.tutte_visite) + '</b> visite.</p><p class="com-nota">Solo i conteggi: l\'elenco delle imprese qui non si mostra. Lo stato è quello della foto scritta nel verbale.</p>';
    return h;
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
  const CSS = '#card-commissione p{font-size:13px;line-height:1.5}#card-commissione h4{display:flex;align-items:center;gap:8px;margin:20px 0 6px;font-size:15px;color:#333}'
    + '#card-commissione h4 span{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--orange,#e7500f);color:#fff;font-size:13px}'
    + '.com-periodo{font-size:13px;color:#565c66;margin:0 0 10px}.com-nota{font-size:12.5px;color:#666;margin:6px 0;line-height:1.45}'
    + '.com-errore{color:#c0392b;font-size:13px}.com-leggi{background:#f6f6f7;border-left:3px solid var(--orange,#e7500f);padding:8px 12px;font-size:12.5px;color:#565c66;line-height:1.45;border-radius:4px;margin:10px 0}'
    + '.com-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0}.com-kpi div{border:1px solid var(--border,#ddd);border-radius:8px;padding:10px 12px}'
    + '.com-kpi b{display:block;font-size:22px;color:var(--orange,#e7500f)}.com-kpi span{font-size:12px;color:#565c66}'
    + '.com-tab-box{overflow-x:auto}.com-tab{width:100%;border-collapse:collapse;font-size:13px;margin:4px 0}.com-tab th{text-align:left;font-size:11.5px;color:#666;border-bottom:2px solid #ddd;padding:5px 7px;font-weight:600}'
    + '.com-tab td{border-bottom:1px solid #eee;padding:5px 7px}.com-tab .n{text-align:right;white-space:nowrap}.com-tab tr.com-tot td{font-weight:700;border-top:2px solid #ddd}'
    + '.com-tab tr.com-capo td{font-weight:700}.com-tab tr.com-sotto td:first-child{padding-left:22px;color:#565c66}.com-tab tr.com-grigia td{color:#888}.com-tab tr.com-allarme td{color:#c0392b}'
    + '.com-piccolo{font-size:11px;color:#999;font-style:italic}.com-poche{color:#b07d00;cursor:help}.com-vuoto{color:#bbb}.com-desc{font-size:11.5px;color:#888}'
    + '.com-comuni{margin:8px 0;font-size:12.5px;color:#565c66}.com-comuni summary{cursor:pointer;font-weight:600;color:#333}';

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
