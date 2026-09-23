/* ============================================================
   CODICE UNIVOCO DEL CANTIERE — proposto dall'app
   (23/09/2026, chiesto dall'utente: «di solito si compone iniziali
   del tecnico, nome della strada del cantiere, civico se esiste e
   3 o 4 lettere della ragione sociale dell'impresa»).

   Lo schema è quello che i tecnici scrivono già a mano, per esempio
   NDM-viadellazuanna5-VET  (Nicola De Marco, via della Zuanna 5,
   Vettorazzo) o NDM-viaroma123125-SAR (Costruzioni edili Sartorato).

   ⚠️ È una PROPOSTA: si mostra in una finestra dove si corregge, e si
   scrive solo se il cantiere non ha già un codice. Altri tecnici usano
   altri schemi (Visentini spesso il numero del titolo edilizio,
   «PdC n. …»): quelli restano validi e l'app non li tocca.

   Se il codice proposto c'è già su un altro cantiere, si aggiunge
   -2, -3…: «univoco» deve esserlo davvero.

   Script classico: usa window.sb, window.S, window.toast.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const avviso = (m, t) => (window.toast ? window.toast(m, t) : alert(m));
  const senzaAccenti = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* parole che non identificano l'impresa */
  const GENERICHE = new Set(['COSTRUZIONI', 'COSTRUZIONE', 'COSTRUZ', 'EDILI', 'EDILE', 'EDILIZIA', 'EDIL', 'IMPRESA', 'DITTA',
    'SOCIETA', 'SOC', 'COOP', 'COOPERATIVA', 'GRUPPO', 'IL', 'LA', 'LE', 'LO', 'I', 'GLI', 'DI', 'DE', 'DEL', 'DELLA', 'DEI',
    'E', 'ED', 'F', 'FLLI', 'FRATELLI', 'SRL', 'SRLS', 'SPA', 'SNC', 'SAS', 'SS', 'UNIPERSONALE', 'CONSORZIO', 'GENERALI']);

  function iniziali(tecnico) {
    return senzaAccenti(tecnico).split(/\s+/).filter((w) => w && !/\.$/.test(w) && /^[A-Za-z]/.test(w))
      .map((w) => w[0].toUpperCase()).join('');
  }
  function strada(ind) {
    return senzaAccenti(ind).toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function civico(civ) {
    const c = senzaAccenti(civ).trim();
    if (!c || /^s\.?\s*n\.?\s*c?\.?$/i.test(c)) return '';
    return c.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }
  function sigla(impresa) {
    const parole = senzaAccenti(impresa).toUpperCase().replace(/\./g, '').split(/[^A-Z0-9]+/).filter(Boolean);
    const buona = parole.find((w) => !GENERICHE.has(w) && w.length >= 2) || parole.find((w) => !GENERICHE.has(w)) || '';
    return buona.slice(0, 3);
  }

  /* il codice, dalle parti che si conoscono; le mancanti si saltano */
  function componi({ tecnico, indirizzo, civ, impresa }) {
    const a = iniziali(tecnico), s = sigla(impresa);
    let b = strada(indirizzo) + civico(civ);
    const fisso = [a, s].filter(Boolean).join('--').length + 2;
    if (b.length + fisso > 50) b = b.slice(0, Math.max(8, 50 - fisso));
    return [a, b, s].filter(Boolean).join('-');
  }

  /* se c'è già su un altro cantiere: -2, -3… */
  async function libero(codice, cantiereId) {
    for (let n = 1; n < 50; n++) {
      const prova = n === 1 ? codice : `${codice}-${n}`;
      const { data, error } = await window.sb.from('cantieri').select('cantiere_id').ilike('nodo_id', prova.replace(/[%_]/g, '\\$&'))
        .neq('cantiere_id', cantiereId || '').limit(1);
      if (error) throw error;
      if (!data || !data.length) return prova;
    }
    return codice;
  }

  function tecnicoDelVerbale() {
    const v = ($('f-tec-display') && $('f-tec-display').value) || '';
    if (v.trim()) return v;
    const t = window.S && window.S.tecnico;
    return t ? `${t.tecnico_nome || ''} ${t.tecnico_cognome || ''}` : '';
  }
  function impresaPrincipale() {
    const im = window.S && window.S.imprese && window.S.imprese[0];
    return (im && im.impresa_nome) || '';
  }

  /* Nel verbale: propone e salva sul cantiere scelto */
  async function daVerbale() {
    const cid = $('f-cant-id') && $('f-cant-id').value;
    if (!cid) { avviso('Scegli prima il cantiere.', 'warn'); return; }
    try {
      const { data: c, error } = await window.sb.from('cantieri').select('cantiere_indirizzo, cantiere_civico, nodo_id').eq('cantiere_id', cid).maybeSingle();
      if (error) throw error;
      if (!c) { avviso('Cantiere non trovato.', 'err'); return; }
      if (String(c.nodo_id || '').trim()) {
        $('f-cod-uni').value = c.nodo_id;
        avviso('Il cantiere ha già il suo codice univoco: ' + c.nodo_id, 'warn');
        return;
      }
      const imp = impresaPrincipale();
      const base = componi({ tecnico: tecnicoDelVerbale(), indirizzo: c.cantiere_indirizzo, civ: c.cantiere_civico, impresa: imp });
      const proposto = await libero(base, cid);
      const scelto = prompt('Codice univoco proposto per questo cantiere' + (imp ? '' : ' (manca l\'impresa principale: sceglila prima per avere anche la sigla)')
        + ':\niniziali del tecnico - strada e civico - sigla dell\'impresa.\n\nCorreggilo se serve, poi OK per salvarlo sul cantiere.', proposto);
      if (scelto === null || !scelto.trim()) return;
      await salvaSulCantiere(cid, scelto);
    } catch (e) { avviso('Codice non salvato: ' + (e.message || e), 'err'); }
  }

  /* salva sul cantiere, solo se è ancora vuoto: non si scrive sopra al codice di un collega */
  async function salvaSulCantiere(cid, codice) {
    const finale = String(codice || '').trim().slice(0, 50);
    if (!finale) return false;
    const { data: agg, error } = await window.sb.from('cantieri').update({ nodo_id: finale })
      .eq('cantiere_id', cid).or('nodo_id.is.null,nodo_id.eq.').select('nodo_id');
    if (error) throw error;
    if (!agg || !agg.length) { avviso('Nel frattempo il cantiere ha ricevuto un codice: ricaricalo.', 'warn'); return false; }
    $('f-cod-uni').value = finale;
    if (window.S && window.S.fd) window.S.fd.cod_uni = finale;
    avviso('Codice univoco salvato sul cantiere: ' + finale, 'ok');
    return true;
  }

  /* Scritto a mano nel verbale (23/09/2026, chiesto dall'utente: «oltre a
     proponi posso anche inserire direttamente»): uscendo dalla casella si
     salva sul cantiere, con le stesse cautele di «Proponi». */
  async function scrittoAMano() {
    const campo = $('f-cod-uni');
    const cid = $('f-cant-id') && $('f-cant-id').value;
    const val = campo.value.trim();
    if (!cid) { if (val) { campo.value = ''; avviso('Scegli prima il cantiere: il codice univoco è del cantiere.', 'warn'); } return; }
    try {
      const { data: c, error } = await window.sb.from('cantieri').select('nodo_id').eq('cantiere_id', cid).maybeSingle();
      if (error) throw error;
      const attuale = String((c && c.nodo_id) || '').trim();
      if (attuale) {
        if (val !== attuale) { campo.value = attuale; avviso('Il cantiere ha già il codice ' + attuale + ': si cambia da «✏️ Modifica cantiere».', 'warn'); }
        return;
      }
      if (!val) return;
      const usato = await libero(val, cid);
      if (usato !== val && !confirm(`Il codice «${val}» c'è già su un altro cantiere.\n\nSalvarlo lo stesso? (Annulla per correggerlo)`)) { campo.focus(); return; }
      await salvaSulCantiere(cid, val);
    } catch (e) { avviso('Codice non salvato: ' + (e.message || e), 'err'); }
  }
  document.addEventListener('change', (e) => { if (e.target && e.target.id === 'f-cod-uni') scrittoAMano(); });

  /* Nella scheda del cantiere: propone nel campo, si salva col cantiere */
  async function daScheda() {
    const campo = $('mc-cod-uni');
    if (!campo) return;
    if (campo.value.trim() && !confirm('Il campo ha già un codice. Sostituirlo con quello proposto?')) return;
    const ind = ($('mc-ind') && $('mc-ind').value) || '';
    if (!ind.trim()) { avviso('Scrivi prima l\'indirizzo del cantiere.', 'warn'); return; }
    try {
      const base = componi({ tecnico: tecnicoDelVerbale(), indirizzo: ind, civ: ($('mc-civ') && $('mc-civ').value) || '', impresa: impresaPrincipale() });
      campo.value = await libero(base, window._editCantId || '');
      campo.focus();
      avviso('Codice proposto: correggilo se serve, si salva col cantiere.', 'ok');
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-cod-uni-proponi')) { e.preventDefault(); daVerbale(); return; }
    if (e.target.closest('#btn-mc-cod-uni-proponi')) { e.preventDefault(); daScheda(); }
  });

  window.CodiceUnivoco = { componi, iniziali, strada, civico, sigla };
})();
