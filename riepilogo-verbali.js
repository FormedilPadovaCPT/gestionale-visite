/* ============================================================
   RIEPILOGO MENSILE DEI VERBALI DA SISTEMARE
   (20/09/2026, chiesto dall'utente)

   È la versione buona dell'idea di agosto, precisata dall'utente
   il 20/09/2026: serve a vedere **l'aderenza dei verbali alle
   procedure dell'ufficio**, non a valutare i tecnici.

   ⚠️ L'UNITÀ DI ANALISI È IL VERBALE, NON LA PERSONA. Il riquadro
   elenca i verbali che hanno qualcosa da sistemare, uno per riga;
   NON conta, non somma e non ordina per tecnico, e non produce
   punteggi né classifiche. Il nome del tecnico compare accanto al
   verbale solo perché è a lui che si chiede: toglierlo renderebbe
   l'elenco inutilizzabile, aggregarlo lo trasformerebbe in una
   valutazione delle prestazioni (Allegato III punto 4 del
   Reg. UE 2024/1689), che l'ente ha deciso di non fare.
   Chi aggiunge qui un totale per tecnico cambia la natura
   giuridica dello strumento: non si fa.

   ⚠️ NIENTE INTELLIGENZA ARTIFICIALE, e nessuna logica nuova:
   riusa la STESSA funzione `ControlloVerbale.analizza()` che
   avvisa il tecnico quando salva un verbale come definitivo
   (controllo-verbale.js, 17/09/2026). Una seconda copia dei
   controlli in SQL sarebbe divergere dalla prima al primo
   cambiamento — è la ragione per cui questo modulo gira nel
   browser e non nel database.

   Quindi il riepilogo dice esattamente le stesse cose che il
   tecnico ha visto al salvataggio, e che può aver scelto di
   salvare comunque: qui l'ufficio le ritrova insieme.

   Sta nella ZONA COORDINATORE, sotto i cantieri critici; lo
   vedono il coordinatore e la segreteria — lo dice il database
   con is_coordinatore()/is_segreteria(), non un elenco di
   indirizzi.

   ⚠️ MISURATO SUI VERBALI VERI PRIMA DI ATTIVARLO (20/09/2026),
   come si era fatto per il controllo al salvataggio: su giugno-
   agosto 2026 segnala **2 verbali su 69, 2 su 99 e 0 su 10**, cioè
   il 2-3%. Un elenco corto e azionabile: se segnalasse metà dei
   verbali nessuno lo guarderebbe.
   La prima stesura invece ne segnalava QUASI TUTTI (67 su 69), per
   un difetto di questo adattatore e non dei controlli: leggeva la
   persona presente solo da ppre_nome/ppre_cog, che sono valorizzati
   nei verbali compilati nell'app (8 su 178), mentre quelli importati
   dal modulo Google hanno il solo `nom_ppre` (178 su 178). Corretto
   qui sotto. Chi aggiunge un controllo nuovo rifà la misura.

   Script classico come cantieri-critici-coord.js: usa window.sb,
   window.S, window.toast. `riepiloga()` è pura e si prova con
   node (test/riepilogo-verbali).
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const $ = (id) => (haDom ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oggiIt = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const avviso = (m, t) => (radice.toast ? radice.toast(m, t) : (haDom ? alert(m) : console.log(m)));

  /* ---------- la parte pura, provabile senza browser ----------
     visite: righe di `visite` (già senza le eliminate)
     righeChk: righe di `visite_checklist` (visita_id, codice, valore, nota)
     descrizioni: codice → descrizione, da `checklist_voci`
     analizza: la funzione di controllo-verbale.js (iniettata, così il test la vede)
  */
  function riepiloga(visite, righeChk, descrizioni, analizza, oggi) {
    const perVisita = new Map();
    for (const r of righeChk || []) {
      if (!perVisita.has(r.visita_id)) perVisita.set(r.visita_id, { checklist: {}, noteChk: {} });
      const v = perVisita.get(r.visita_id);
      if (r.valore) v.checklist[r.codice] = r.valore;
      if (r.nota) v.noteChk[r.codice] = r.nota;
    }

    /* due verbali lo stesso giorno sullo stesso cantiere e dello stesso tecnico:
       si ricava dal lotto stesso, senza interrogare di nuovo il database */
    const vicini = (v) => (visite || [])
      .filter((x) => x.visita_id !== v.visita_id
        && x.cantiere_id && x.cantiere_id === v.cantiere_id
        && String(x.data_visita || '').slice(0, 10) === String(v.data_visita || '').slice(0, 10)
        && x.tecnico_id === v.tecnico_id)
      .map((x) => ({ nr_verbale: x.nr_verbale, stessaImpresa: !!(x.impresa_id && x.impresa_id === v.impresa_id) }));

    const esito = [];
    for (const v of visite || []) {
      const chk = perVisita.get(v.visita_id) || { checklist: {}, noteChk: {} };
      let avvisi = [];
      try {
        avvisi = analizza({
          checklist: chk.checklist,
          noteChk: chk.noteChk,
          descrizioni: descrizioni || {},
          ossTec: v.oss_tec,
          noteLav: v.note_lav,
          dataVisita: v.data_visita,
          oraDa: v.ora_visita,
          oraA: v.ora_fine,
          dataRitorno: v.data_ritorno,
          accCant: v.acc_cant,
          /* i verbali compilati nell'app hanno nome e cognome separati; quelli importati
             dal modulo Google hanno il solo `nom_ppre` (178 su 178 fra giugno e agosto 2026).
             Senza questo ripiego il riepilogo segnalerebbe quasi ogni verbale storico. */
          ppreNome: [v.ppre_nome, v.ppre_cog].map((x) => (x || '').trim()).filter(Boolean).join(' ')
            || String(v.nom_ppre || '').trim(),
          ppreQual: v.qual_ppre,
          oggi,
          stessoGiorno: vicini(v),
        }) || [];
      } catch (e) {
        avvisi = [{ chi: 'errore', testo: 'Non sono riuscito a controllare questo verbale: ' + (e && e.message ? e.message : e) }];
      }
      if (avvisi.length) esito.push({ visita: v, avvisi });
    }
    /* ordinati per verbale, non per tecnico */
    esito.sort((a, b) => String(a.visita.nr_verbale || '').localeCompare(String(b.visita.nr_verbale || ''), 'it', { numeric: true }));
    return { esaminati: (visite || []).length, daSistemare: esito };
  }

  /* ---------- da qui in giù serve il browser ---------- */

  let abilitato = null;
  async function possoVedere() {
    if (abilitato !== null) return abilitato;
    try {
      const [c, s] = await Promise.all([radice.sb.rpc('is_coordinatore'), radice.sb.rpc('is_segreteria')]);
      abilitato = !!(c.data || s.data);
    } catch (e) { abilitato = false; }
    return abilitato;
  }

  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  /* il mese che si guarda per primo è quello CHIUSO: il riepilogo si legge a mese finito */
  function mesePredefinito() {
    const o = new Date(oggiIt() + 'T12:00:00');
    o.setDate(1); o.setMonth(o.getMonth() - 1);
    return o.toISOString().slice(0, 7);
  }

  const primoGiorno = (ym) => ym + '-01';
  function ultimoGiorno(ym) {
    const [a, m] = ym.split('-').map(Number);
    return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  }

  async function leggi(ym) {
    const da = primoGiorno(ym), a = ultimoGiorno(ym);
    const { data: visite, error } = await radice.sb.from('visite')
      .select('visita_id, nr_verbale, data_visita, ora_visita, ora_fine, data_ritorno, acc_cant, ipc, oss_tec, note_lav, ppre_nome, ppre_cog, nom_ppre, qual_ppre, cantiere_id, impresa_id, tecnico_id, elimina, stato')
      .gte('data_visita', da).lte('data_visita', a).limit(2000);
    if (error) throw error;
    const vive = (visite || []).filter((v) => !v.elimina);
    if (!vive.length) return { visite: [], righeChk: [], descrizioni: {} };

    const ids = vive.map((v) => v.visita_id);
    const righeChk = [];
    /* Supabase dà al massimo 1.000 righe per lettura, e una visita ha fino a ~300 righe di checklist:
       spezzare le visite a gruppi non basta, ogni gruppo va letto a blocchi (23/09/2026). */
    for (let i = 0; i < ids.length; i += 50) {
      for (let da = 0; ; da += 1000) {
        const { data, error: e2 } = await radice.sb.from('visite_checklist')
          .select('visita_id, codice, valore, nota').in('visita_id', ids.slice(i, i + 50))
          .order('id').range(da, da + 999);
        if (e2) throw e2;
        righeChk.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
    }
    const { data: voci } = await radice.sb.from('checklist_voci').select('codice, descrizione').limit(2000);
    const descrizioni = Object.fromEntries((voci || []).map((v) => [v.codice, v.descrizione]));
    return { visite: vive, righeChk, descrizioni };
  }

  /* in `tecnici` le colonne sono tecnico_cognome / tecnico_nome, non cognome / nome.
     Se la lettura fallisce NON si tace: senza il nome l'elenco resta usabile, ma
     chi guarda deve sapere che manca (19/09/2026: un errore ingoiato faceva
     scrivere «nessuno» dove la ricerca era semplicemente fallita). */
  async function nomiTecnici(ids) {
    const unici = [...new Set(ids.filter(Boolean))];
    if (!unici.length) return { nomi: {}, errore: null };
    try {
      const { data, error } = await radice.sb.from('tecnici')
        .select('tecnico_id, tecnico_cognome, tecnico_nome').in('tecnico_id', unici);
      if (error) throw error;
      return { nomi: Object.fromEntries((data || []).map((t) => [t.tecnico_id, [t.tecnico_cognome, t.tecnico_nome].filter(Boolean).join(' ')])), errore: null };
    } catch (e) { return { nomi: {}, errore: e.message || String(e) }; }
  }

  async function mostra(ym) {
    const corpo = $('rv-corpo');
    if (!corpo) return;
    corpo.innerHTML = '<p style="font-size:12px;color:#666">Controllo i verbali del mese&hellip;</p>';
    let dati;
    try {
      dati = await leggi(ym);
    } catch (e) {
      corpo.innerHTML = `<p style="font-size:12px;color:#c0392b">Non sono riuscito a leggere i verbali: ${esc(e.message || e)}. Riprova.</p>`;
      return;
    }
    if (!dati.visite.length) {
      corpo.innerHTML = '<p style="font-size:12px;color:#666">Nessun verbale con data in questo mese.</p>';
      return;
    }
    const analizza = radice.ControlloVerbale && radice.ControlloVerbale.analizza;
    if (!analizza) {
      corpo.innerHTML = '<p style="font-size:12px;color:#c0392b">Manca il modulo dei controlli (controllo-verbale.js): senza quello il riepilogo direbbe che va tutto bene senza aver controllato niente.</p>';
      return;
    }
    const r = riepiloga(dati.visite, dati.righeChk, dati.descrizioni, analizza, oggiIt());
    const { nomi, errore: erroreNomi } = await nomiTecnici(r.daSistemare.map((x) => x.visita.tecnico_id));

    if (!r.daSistemare.length) {
      corpo.innerHTML = `<p style="font-size:13px;color:#27ae60">Tutti i <strong>${r.esaminati}</strong> verbali del mese sono a posto rispetto ai controlli.</p>`;
      return;
    }
    corpo.innerHTML = `
      <p style="font-size:13px;margin:0 0 8px"><strong>${r.daSistemare.length}</strong> verbali su <strong>${r.esaminati}</strong> hanno qualcosa da sistemare.</p>
      ${r.daSistemare.map(({ visita: v, avvisi }) => `
        <div style="padding:8px 0;border-top:1px solid #eee">
          <div style="font-size:13px"><strong>${esc(v.nr_verbale || '(senza numero)')}</strong>
            <span style="color:#888">&mdash; ${dIt(v.data_visita)}${v.ipc ? ' &middot; IPC ' + esc(v.ipc) : ''}${nomi[v.tecnico_id] ? ' &middot; ' + esc(nomi[v.tecnico_id]) : ''}</span></div>
          <ul style="margin:4px 0 0 18px;padding:0;font-size:12px;color:#555">
            ${avvisi.map((a) => `<li style="margin:2px 0">${esc(a.testo)}</li>`).join('')}
          </ul>
        </div>`).join('')}
      ${erroreNomi ? `<p style="font-size:11px;color:#c0392b;margin:8px 0 0">Non sono riuscito a leggere i nomi dei tecnici (${esc(erroreNomi)}): l'elenco dei verbali è completo lo stesso.</p>` : ''}
      <p style="font-size:11px;color:#888;margin:10px 0 0">Sono gli stessi avvisi che il tecnico ha visto salvando il verbale e che può aver scelto di salvare comunque. L'elenco è per verbale: non si contano né si confrontano i tecnici.</p>`;
  }

  async function monta() {
    const box = $('dash-riepilogo-verbali');
    if (!box || !radice.sb || !radice.S?.user) return;
    if (!(await possoVedere())) { box.style.display = 'none'; return; }

    const ym = mesePredefinito();
    const opzioni = [];
    const o = new Date(oggiIt() + 'T12:00:00'); o.setDate(1);
    for (let i = 0; i < 14; i++) {
      const v = o.toISOString().slice(0, 7);
      opzioni.push(`<option value="${v}"${v === ym ? ' selected' : ''}>${MESI[o.getMonth()]} ${o.getFullYear()}</option>`);
      o.setMonth(o.getMonth() - 1);
    }
    box.innerHTML = `<div class="card" style="border-left:4px solid #2980b9">
      <h3>&#128203; Verbali da sistemare <span style="font-weight:400;color:#888;font-size:13px">&mdash; riepilogo del mese</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 8px">Aderenza dei verbali alle procedure dell'ufficio: completezza, coerenza della check-list, rientri nei termini Formedil. <strong>Un elenco di verbali, non di persone.</strong></p>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <select id="rv-mese" style="font-size:13px;padding:4px 6px">${opzioni.join('')}</select>
        <button type="button" id="rv-vai" class="btn-secondary" style="font-size:13px">Controlla</button>
      </div>
      <div id="rv-corpo"></div>
    </div>`;
    box.style.display = '';
    $('rv-vai').onclick = () => mostra($('rv-mese').value);
    $('rv-mese').onchange = () => mostra($('rv-mese').value);
    mostra(ym);
  }

  /* la Zona Coordinatore ha fondo scuro e testo chiaro: dentro il riquadro bianco
     il testo deve tornare scuro, come per dash-fatture e dash-critici */
  if (haDom) {
    const st = document.createElement('style');
    st.textContent = '#view-admin #dash-riepilogo-verbali .card{color:#222;text-align:left}';
    document.head.appendChild(st);
  }

  /* si aggancia al giro che riempie la Zona Coordinatore, senza toccare
     l'altro modulo: questo script è caricato dopo, quindi la funzione c'è già */
  if (haDom) {
    const prima = radice.aggiornaZonaCoord;
    radice.aggiornaZonaCoord = async function () {
      const r = await Promise.allSettled([
        typeof prima === 'function' ? prima.apply(this, arguments) : Promise.resolve(),
        monta(),
      ]);
      const ko = r.find((x) => x.status === 'rejected');
      if (ko) console.warn('zona coordinatore:', ko.reason);
    };
  }

  const api = { riepiloga, monta, mesePredefinito, ultimoGiorno };
  radice.RiepilogoVerbali = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
