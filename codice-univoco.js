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
   SENZA le iniziali del tecnico e leggibile:
     Via della Zuanna 5 – VETTORAZZO
   (indirizzo e civico come sono scritti, poi la parola che
   distingue l'impresa principale, senza «Costruzioni», «S.r.l.»…).

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

  /* parole che non identificano l'impresa */
  const GENERICHE = new Set(['COSTRUZIONI', 'COSTRUZIONE', 'COSTRUZ', 'EDILI', 'EDILE', 'EDILIZIA', 'EDIL', 'IMPRESA', 'DITTA',
    'SOCIETA', 'SOC', 'COOP', 'COOPERATIVA', 'GRUPPO', 'IL', 'LA', 'LE', 'LO', 'I', 'GLI', 'DI', 'DE', 'DEL', 'DELLA', 'DEI',
    'E', 'ED', 'F', 'FLLI', 'FRATELLI', 'SRL', 'SRLS', 'SPA', 'SNC', 'SAS', 'SS', 'UNIPERSONALE', 'CONSORZIO', 'GENERALI']);

  /* la parola che distingue l'impresa: «VETTORAZZO» da «Vettorazzo Costruzioni S.r.l.» */
  function sigla(impresa) {
    const parole = senzaAccenti(impresa).toUpperCase().replace(/\./g, '').split(/[^A-Z0-9']+/).filter(Boolean);
    return parole.find((w) => !GENERICHE.has(w) && w.length >= 2) || parole.find((w) => !GENERICHE.has(w)) || '';
  }
  function civico(civ) {
    const c = String(civ || '').trim();
    if (!c || /^s\.?\s*n\.?\s*c?\.?$/i.test(c)) return '';
    return c;
  }

  /* l'etichetta, dalle parti che si conoscono; le mancanti si saltano; al massimo 50 caratteri */
  function componi({ indirizzo, civ, impresa }) {
    const via = String(indirizzo || '').replace(/\s+/g, ' ').trim();
    const s = sigla(impresa);
    let luogo = [via, civico(civ)].filter(Boolean).join(' ');
    const coda = s ? ' – ' + s : '';
    if (luogo.length + coda.length > 50) luogo = luogo.slice(0, Math.max(8, 50 - coda.length)).trim();
    return (luogo + coda).slice(0, 50);
  }

  /* se c'è già su un altro cantiere: -2, -3… */
  async function libera(etichetta, cantiereId) {
    for (let n = 1; n < 50; n++) {
      const prova = n === 1 ? etichetta : `${etichetta}-${n}`.slice(0, 50);
      const { data, error } = await window.sb.from('cantieri').select('cantiere_id').ilike('cantiere_etichetta', prova.replace(/[\\%_]/g, '\\$&'))
        .eq('elimina', 0).neq('cantiere_id', cantiereId || '').limit(1);
      if (error) throw error;
      if (!data || !data.length) return prova;
    }
    return etichetta;
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
      const { data: c, error } = await window.sb.from('cantieri').select('cantiere_indirizzo, cantiere_civico, cantiere_etichetta').eq('cantiere_id', cid).maybeSingle();
      if (error) throw error;
      if (!c) { avviso('Cantiere non trovato.', 'err'); return; }
      if (String(c.cantiere_etichetta || '').trim()) {
        if ($('f-etich')) $('f-etich').value = c.cantiere_etichetta;
        avviso('Il cantiere ha già la sua etichetta: «' + c.cantiere_etichetta + '». Si cambia da «✏️ Modifica cantiere».', 'warn');
        return;
      }
      const imp = impresaPrincipale();
      const base = componi({ indirizzo: c.cantiere_indirizzo, civ: c.cantiere_civico, impresa: imp });
      const proposta = await libera(base, cid);
      const scelta = prompt('Etichetta proposta per questo cantiere' + (imp ? '' : ' (manca l\'impresa principale: sceglila prima per avere anche il suo nome)')
        + ':\nindirizzo e civico – impresa principale. È quella che va all\'Osservatorio e che si vede negli elenchi.\n\nCorreggila se serve, poi OK per salvarla sul cantiere.', proposta);
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
    if (campo.value.trim() && !confirm('Il campo ha già un\'etichetta. Sostituirla con quella proposta?')) return;
    const ind = ($('mc-ind') && $('mc-ind').value) || '';
    if (!ind.trim()) { avviso('Scrivi prima l\'indirizzo del cantiere.', 'warn'); return; }
    try {
      const base = componi({ indirizzo: ind, civ: ($('mc-civ') && $('mc-civ').value) || '', impresa: impresaPrincipale() });
      campo.value = await libera(base, window._editCantId || '');
      campo.focus();
      avviso('Etichetta proposta: correggila se serve, si salva col cantiere.', 'ok');
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-etich-proponi')) { e.preventDefault(); daVerbale(); return; }
    if (e.target.closest('#btn-mc-etich-proponi')) { e.preventDefault(); daScheda(); }
  });

  window.EtichettaCantiere = { componi, sigla, civico };
})();
