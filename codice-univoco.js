/* ============================================================
   ETICHETTA DEL CANTIERE — proposta dall'app
   (06/10/2026, deciso dall'utente: il «codice univoco» non ha più
   ragione di esistere nel verbale. Formedil chiede l'ETICHETTA
   (cantiereEtichetta, 50 caratteri), e il cantiere si riconosce da
   comune + indirizzo + civico + etichetta. Il codice univoco resta
   nel database e nella scheda del cantiere come storico, e si cerca.)

   Prima (23/09/2026) questo file proponeva il codice univoco con lo
   schema dei tecnici: NDM-viadellazuanna5-VET. L'etichetta la vede
   Formedil e identifica il cantiere, non chi l'ha visitato, quindi
   SENZA le iniziali del tecnico.

   ⚠️ Dal 13/10/2026 (schema dell'utente) la proposta è:
     VIA_COMUNE_Lnn_COMMITTENTE_OPERA
     es. GIUSEPPE_CAMSANMAR_L1_CAVESTRO_COMM
   - via: senza «Via/Piazza/Corso…» e senza «di/della…»; le parole
     attaccate fino a 12 lettere, oltre si tiene l'ultima (il cognome:
     «Via Giuseppe Garibaldi» → GARIBALDI);
   - comune: tre lettere per parola (Campo San Martino → CAMSANMAR,
     Piove di Sacco → PIOSAC); una parola sola resta intera fino a 8
     lettere, oltre le prime 6 (Padova → PADOVA, Albignasego → ALBIGN);
   - lotto: L più il lotto, solo se scritto;
   - committente: il cognome per una persona (verificato sul codice
     fiscale, perché in anagrafica l'ordine nome-cognome varia), la
     parola che distingue per una società; al massimo 12 lettere;
   - tipo di opera: quattro lettere (COMM, CIVI, INDU, STRA…).
   Il civico non c'è: l'Osservatorio lo ha nel suo campo.
   Prima (06/10) era «Via della Zuanna 5 – VETTORAZZO», con l'impresa
   principale.

   ⚠️ È una PROPOSTA, e si scrive SOLO se il cantiere non ha ancora
   un'etichetta: quelle già presenti (anche le 6.195 importate dalla
   Cassa) non si toccano. Se la stessa proposta c'è già su un altro
   cantiere si aggiunge -2, -3…: due lotti allo stesso indirizzo
   con la stessa impresa devono restare distinguibili.

   Script classico: usa window.sb, window.S, window.toast.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const avviso = (m, t) => (window.toast ? window.toast(m, t) : alert(m));
  const senzaAccenti = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const parole = (s) => senzaAccenti(s).toUpperCase().replace(/\./g, ' ').split(/[^A-Z0-9]+/).filter(Boolean);

  /* parole che non identificano l'impresa */
  const GENERICHE = new Set(['COSTRUZIONI', 'COSTRUZIONE', 'COSTRUZ', 'EDILI', 'EDILE', 'EDILIZIA', 'EDIL', 'IMPRESA', 'DITTA',
    'SOCIETA', 'SOC', 'COOP', 'COOPERATIVA', 'GRUPPO', 'IL', 'LA', 'LE', 'LO', 'I', 'GLI', 'DI', 'DE', 'DEL', 'DELLA', 'DEI',
    'E', 'ED', 'F', 'FLLI', 'FRATELLI', 'SRL', 'SRLS', 'SPA', 'SNC', 'SAS', 'SS', 'UNIPERSONALE', 'CONSORZIO', 'GENERALI']);
  /* preposizioni e articoli, che nei nomi di vie e comuni non contano */
  const PICCOLE = new Set(['DI', 'D', 'DA', 'DAL', 'DALLA', 'DEL', 'DELLA', 'DELLE', 'DELL', 'DEI', 'DEGLI', 'DELLO',
    'IL', 'LA', 'LE', 'LO', 'L', 'I', 'GLI', 'E', 'ED', 'AL', 'ALLA', 'ALLE', 'AI', 'AGLI', 'ALL', 'IN', 'SUL', 'SULLA']);
  /* denominazioni urbanistiche: «Via», «Piazza»… */
  const DUG = new Set(['VIA', 'V', 'VIALE', 'VLE', 'PIAZZA', 'PZA', 'PZZA', 'P', 'PIAZZALE', 'PLE', 'PIAZZETTA', 'CORSO', 'C', 'CSO',
    'STRADA', 'STR', 'STRADELLA', 'VICOLO', 'VIC', 'LARGO', 'CONTRA', 'CONTRADA', 'LOCALITA', 'LOC', 'FRAZIONE', 'FRAZ',
    'BORGO', 'RIVIERA', 'RIV', 'CALLE', 'CORTE', 'GALLERIA', 'PASSAGGIO', 'SALITA', 'ARGINE', 'LUNGARGINE', 'ROTONDA',
    'QUARTIERE', 'ZONA', 'ZI', 'TRAVERSA', 'VIOTTOLO', 'CAMPIELLO', 'PONTE']);
  /* titoli davanti al nome di una persona */
  const TITOLI = new Set(['SIG', 'SIGRA', 'SIGNOR', 'SIGNORA', 'GEOM', 'ING', 'ARCH', 'DOTT', 'DOTTSSA', 'DOTTORESSA', 'AVV', 'RAG',
    'PER', 'IND', 'PI', 'PROF', 'PROFSSA', 'DR', 'GEOMETRA', 'INGEGNERE', 'ARCHITETTO', 'DOTTORE', 'AVVOCATO']);
  /* tipo di opera (codici dell'Osservatorio, come nella tendina della scheda) */
  const OPERA = { 1: 'INDU', 2: 'CIVI', 3: 'COMM', 4: 'OSPE', 5: 'STRA', 6: 'RURA', 7: 'FUNE', 8: 'SCOL', 9: 'FERR', 10: 'MARI',
    11: 'FLUV', 12: 'SPOR', 13: 'CARC', 14: 'EOLI', 15: 'FOTO', 16: 'ALTRO' };

  /* la parola che distingue l'impresa: «VETTORAZZO» da «Vettorazzo Costruzioni S.r.l.» */
  function sigla(impresa) {
    const pp = senzaAccenti(impresa).toUpperCase().replace(/\./g, '').split(/[^A-Z0-9']+/).filter(Boolean);
    return pp.find((w) => !GENERICHE.has(w) && w.length >= 2) || pp.find((w) => !GENERICHE.has(w)) || '';
  }
  function civico(civ) {
    const c = String(civ || '').trim();
    if (!c || /^s\.?\s*n\.?\s*c?\.?$/i.test(c)) return '';
    return c;
  }

  /* via: «Via Giuseppe» → GIUSEPPE, «Via della Zuanna» → ZUANNA, «Via Giuseppe Garibaldi» → GARIBALDI */
  function viaBreve(indirizzo) {
    const pp = parole(indirizzo);
    let i = 0; while (i < pp.length - 1 && DUG.has(pp[i])) i++;
    const resto = pp.slice(i).filter((w) => !PICCOLE.has(w));
    if (!resto.length) return pp.join('').slice(0, 12);
    const tutto = resto.join('');
    return (tutto.length <= 12 ? tutto : resto[resto.length - 1]).slice(0, 12);
  }
  /* comune: tre lettere per parola; una parola sola intera fino a 8, altrimenti 6 */
  function comuneBreve(comune) {
    const pp = parole(comune).filter((w) => !PICCOLE.has(w));
    if (!pp.length) return '';
    if (pp.length === 1) return pp[0].length <= 8 ? pp[0] : pp[0].slice(0, 6);
    return pp.map((w) => w.slice(0, 3)).join('');
  }
  function lottoBreve(lotto) {
    const l = parole(lotto).join('').replace(/^(LOTTO|LOT|L)(?=[A-Z0-9])/, '');
    return l ? 'L' + l.slice(0, 6) : '';
  }
  /* le tre lettere del cognome nel codice fiscale */
  function codiceCognome(s) {
    const t = parole(s).join('');
    const cons = t.replace(/[^B-DF-HJ-NP-TV-Z]/g, ''), voc = t.replace(/[^AEIOU]/g, '');
    return (cons + voc + 'XXX').slice(0, 3);
  }
  /* committente: il cognome di una persona (si riconosce dal codice fiscale), la parola che distingue una società */
  function committenteBreve(nome, cf, persona) {
    const pp = parole(nome).filter((w) => !TITOLI.has(w));
    if (!pp.length) return '';
    const cod = String(cf || '').toUpperCase().trim();
    const pf = persona === true || (persona == null && /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cod));
    if (!pf) return sigla(nome).replace(/'/g, '').slice(0, 12);
    if (/^[A-Z]{3}/.test(cod)) {
      for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= pp.length; i++) {
        const pezzo = pp.slice(i, i + n);
        if (pezzo.length === pp.length && pp.length > 1) continue;   // il cognome non è tutto il nome
        if (codiceCognome(pezzo.join('')) === cod.slice(0, 3)) return pezzo.join('').slice(0, 12);
      }
    }
    return pp[0].slice(0, 12);
  }

  /* l'etichetta, dalle parti che si conoscono; le mancanti si saltano; al massimo 50 caratteri */
  function componi({ indirizzo, comune, lotto, committente, cfCommittente, personaCommittente, tipoOpera }) {
    const pezzi = [viaBreve(indirizzo), comuneBreve(comune), lottoBreve(lotto),
      committenteBreve(committente, cfCommittente, personaCommittente), OPERA[+tipoOpera] || ''].filter(Boolean);
    return pezzi.join('_').slice(0, 50);
  }

  /* se c'è già su un altro cantiere: -2, -3… */
  async function libera(etichetta, cantiereId) {
    for (let n = 1; n < 50; n++) {
      const suff = n === 1 ? '' : `-${n}`;
      const prova = etichetta.slice(0, 50 - suff.length) + suff;
      const { data, error } = await window.sb.from('cantieri').select('cantiere_id').ilike('cantiere_etichetta', prova.replace(/[\\%_]/g, '\\$&'))
        .eq('elimina', 0).neq('cantiere_id', cantiereId || '').limit(1);
      if (error) throw error;
      if (!data || !data.length) return prova;
    }
    return etichetta;
  }

  /* il committente dall'anagrafica: nome, codice fiscale e se è una persona */
  async function committente(id, nomeScritto) {
    const cid = String(id || '').trim();
    if (!cid) return { committente: nomeScritto || '' };
    const { data, error } = await window.sb.from('committenti').select('committente_nome, tipo_sogg, cf_piva').eq('committente_id', cid).maybeSingle();
    if (error) throw error;
    if (!data) return { committente: nomeScritto || '', cfCommittente: cid };
    return { committente: data.committente_nome || nomeScritto || '', cfCommittente: data.cf_piva || cid,
      personaCommittente: data.tipo_sogg ? data.tipo_sogg === 'PF' : null };
  }

  /* Nel verbale: propone e salva sul cantiere scelto */
  async function daVerbale() {
    const cid = $('f-cant-id') && $('f-cant-id').value;
    if (!cid) { avviso('Scegli prima il cantiere.', 'warn'); return; }
    try {
      const { data: c, error } = await window.sb.from('cantieri')
        .select('cantiere_indirizzo, comune_nome, lotto, cantiere_tip_ope, cantiere_committente_id, cantiere_etichetta').eq('cantiere_id', cid).maybeSingle();
      if (error) throw error;
      if (!c) { avviso('Cantiere non trovato.', 'err'); return; }
      if (String(c.cantiere_etichetta || '').trim()) {
        if ($('f-etich')) $('f-etich').value = c.cantiere_etichetta;
        avviso('Il cantiere ha già la sua etichetta: «' + c.cantiere_etichetta + '». Si cambia da «✏️ Modifica cantiere».', 'warn');
        return;
      }
      const co = await committente(c.cantiere_committente_id, '');
      const base = componi({ indirizzo: c.cantiere_indirizzo, comune: c.comune_nome, lotto: c.lotto, tipoOpera: c.cantiere_tip_ope, ...co });
      const proposta = await libera(base, cid);
      const scelta = prompt('Etichetta proposta per questo cantiere:\nvia_comune_lotto_committente_tipo di opera. È quella che va all\'Osservatorio e che si vede negli elenchi.\n\nCorreggila se serve, poi OK per salvarla sul cantiere.', proposta);
      if (scelta === null || !scelta.trim()) return;
      await salvaSulCantiere(cid, scelta);
    } catch (e) { avviso('Etichetta non salvata: ' + (e.message || e), 'err'); }
  }

  /* salva sul cantiere, solo se è ancora vuota: non si scrive sopra all'etichetta di un collega o della Cassa */
  async function salvaSulCantiere(cid, etichetta) {
    const finale = String(etichetta || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    if (!finale) return false;
    const { data: agg, error } = await window.sb.from('cantieri').update({ cantiere_etichetta: finale })
      .eq('cantiere_id', cid).or('cantiere_etichetta.is.null,cantiere_etichetta.eq.').select('cantiere_etichetta');
    if (error) throw error;
    if (!agg || !agg.length) { avviso('Nel frattempo il cantiere ha ricevuto un\'etichetta: ricaricalo.', 'warn'); return false; }
    if ($('f-etich')) $('f-etich').value = finale;
    avviso('Etichetta salvata sul cantiere: ' + finale, 'ok');
    return true;
  }

  /* Nella scheda del cantiere: propone nel campo, si salva col cantiere */
  async function daScheda() {
    const campo = $('mc-etich');
    if (!campo) return;
    const val = (id) => ($(id) && $(id).value) || '';
    if (!val('mc-ind').trim()) { avviso('Scrivi prima l\'indirizzo del cantiere.', 'warn'); return; }
    if (campo.value.trim() && !confirm('Il campo ha già un\'etichetta. Sostituirla con quella proposta?')) return;
    try {
      const co = await committente(val('mc-comm-id'), val('mc-comm-search').trim());
      const base = componi({ indirizzo: val('mc-ind'), comune: val('mc-com'), lotto: val('mc-lotto'), tipoOpera: val('mc-tip-ope'), ...co });
      campo.value = await libera(base, window._editCantId || '');
      campo.focus();
      const manca = [!val('mc-com') && 'comune', !co.committente && 'committente', !val('mc-tip-ope') && 'tipo di opera'].filter(Boolean);
      avviso('Etichetta proposta: correggila se serve, si salva col cantiere.' + (manca.length ? ' Manca ' + manca.join(', ') + ': riempilo e ripremi Proponi per averlo nell\'etichetta.' : ''), manca.length ? 'warn' : 'ok');
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-etich-proponi')) { e.preventDefault(); daVerbale(); return; }
    if (e.target.closest('#btn-mc-etich-proponi')) { e.preventDefault(); daScheda(); }
  });

  window.EtichettaCantiere = { componi, sigla, civico, viaBreve, comuneBreve, lottoBreve, committenteBreve, codiceCognome };
})();
