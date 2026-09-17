/* ============================================================
   CONTROLLO DI COERENZA DEL VERBALE (17/09/2026, approvato
   dall'utente)

   Prima di salvare un verbale come DEFINITIVO, l'app guarda se
   i dati si contraddicono e, se sì, lo dice al tecnico, che può
   tornare a correggere o salvare comunque. Non blocca e non
   giudica il lavoro: segnala dati che non tornano, così la parte
   meccanica del controllo non resta al coordinatore.

   Controlli:
   1. Testo del tipo «va tutto bene / nessun problema» nelle
      osservazioni quando la check-list ha osservazioni o non
      conformità (regola aggiunta dall'utente: se c'è un rilievo
      non si scrive che va tutto bene).
   2. Non conformità (NC+ / NC-) senza una nota che la descriva: né
      sulla voce, né nella nota del suo gruppo (codice …_N, come le
      scrive l'import dal modulo Google).
   3. Visita di ritorno: data anteriore alla visita, data oltre il
      termine Formedil, oppure data scritta quando la regola
      Formedil non prevede rientro (lo scadenzario la ignorerebbe).
   4. Due verbali lo stesso giorno sullo stesso cantiere e dello
      stesso tecnico: con la stessa impresa principale è un possibile
      doppione; con imprese principali diverse è un possibile lotto
      nascosto (regola del 08/09/2026: lì si chiede, non si aggancia).
      Due tecnici diversi nello stesso giorno sono normali e non
      avvisano (misurato sui verbali 2025-26).
   5. Persona presente senza qualifica, o qualifica senza nome.
   6. Data della visita nel futuro; ora di fine prima dell'inizio.

   Lo stesso CNCE su due cantieri senza lotto non si controlla
   qui: lo rifiuta già il database (indice ux_cantieri_cnce_attivi).

   Script classico, come diniego-accesso.js: usa window.sb.
   analizza() è pura e si prova con node (test/controllo-verbale).
   ============================================================ */

(function (radice) {
  const TUTTO_BENE = new RegExp([
    'tutto (?:bene|ok|a posto|regolare|in regola)',
    'nessun (?:problema|rilievo|rilievi|criticit[aà]|irregolarit[aà]|pericolo)',
    'nessuna (?:criticit[aà]|irregolarit[aà]|anomalia|non conformit[aà]|problematica|osservazione)',
    'nulla da (?:segnalare|rilevare|evidenziare)',
    'niente da (?:segnalare|rilevare|evidenziare)',
    '(?:cantiere|situazione) (?:regolare|in regola|a norma|ben organizzat[oa])',
    '(?:completamente|pienamente|perfettamente) (?:a norma|in regola|regolare)',
  ].join('|'), 'i');

  const giorno = (s) => {
    if (!s) return null;
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? null : d;
  };
  const fmt = (d) => d ? d.toLocaleDateString('it-IT') : '';

  /* regola Formedil: stessa tabella di calcRientroFormedil in index.html
     (e della RPC ricontrolli_pendenti) — chi la cambia lì la cambia qui */
  function giorniFormedil(acc, ipc) {
    const n = +acc || 1;
    const i = ipc || 'NR';
    if (n === 1) return i === 'ALTO' ? 3 : (i === 'MEDIO' || i === 'BASSO') ? 22 : null;
    if (n === 2) return i === 'ALTO' ? 3 : i === 'MEDIO' ? 22 : null;
    return i === 'ALTO' ? 3 : null;
  }

  function ipcDa(checklist) {
    const v = Object.values(checklist || {});
    const np = v.filter((x) => x === 'NC+').length;
    const nm = v.filter((x) => x === 'NC-').length;
    const os = v.filter((x) => x === 'OSS').length;
    const ipc = (np >= 1 || nm > 3) ? 'ALTO' : (os > 6 || (nm >= 1 && nm <= 3)) ? 'MEDIO' : (os >= 1) ? 'BASSO' : 'NR';
    return { ipc, np, nm, os };
  }

  /* d = { checklist, noteChk, descrizioni (codice → testo della voce), ossTec, noteLav, dataVisita, oraDa, oraA,
           dataRitorno, accCant, ppreNome, ppreQual, oggi, stessoGiorno: [
             { nr_verbale, stessaImpresa } ] } */
  function analizza(d) {
    const avvisi = [];
    const { ipc, np, nm, os } = ipcDa(d.checklist);
    const rilievi = np + nm + os;

    /* 1. «va tutto bene» con rilievi */
    const testi = [['Osservazioni', d.ossTec], ['Note sui lavori', d.noteLav]];
    for (const [dove, t] of testi) {
      const m = String(t || '').match(TUTTO_BENE);
      if (m && rilievi > 0) {
        avvisi.push({
          chi: 'tutto-bene',
          testo: `In «${dove}» c'è scritto «${m[0]}», ma la check-list ha ${[np && `${np} NC+`, nm && `${nm} NC-`, os && `${os} OSS`].filter(Boolean).join(', ')}. Se c'è un rilievo non si scrive che va tutto bene.`,
        });
      }
    }

    /* 2. non conformità senza nota */
    const senzaNota = Object.entries(d.checklist || {})
      .filter(([cod, v]) => (v === 'NC+' || v === 'NC-')
        && !String((d.noteChk || {})[cod] || '').trim()
        && !String((d.noteChk || {})[String(cod).replace(/_[^_]+$/, '') + '_N'] || '').trim())
      .map(([cod]) => cod);
    if (senzaNota.length) {
      avvisi.push({
        chi: 'nc-senza-nota',
        testo: `${senzaNota.length === 1 ? 'Una non conformità è' : `${senzaNota.length} non conformità sono`} senza nota che la descriva: ${senzaNota.slice(0, 6).map((c) => `«${(d.descrizioni || {})[c] || c}»`).join('; ')}${senzaNota.length > 6 ? '…' : ''}.`,
      });
    }

    /* 3. visita di ritorno */
    const dv = giorno(d.dataVisita);
    const dr = giorno(d.dataRitorno);
    const gg = giorniFormedil(d.accCant, ipc);
    if (dv && dr) {
      if (dr < dv) {
        avvisi.push({ chi: 'ritorno-prima', testo: `La visita di ritorno (${fmt(dr)}) è prima della visita stessa (${fmt(dv)}): lo scadenzario la ignora.` });
      } else if (gg == null) {
        avvisi.push({ chi: 'ritorno-non-dovuto', testo: `È indicata una visita di ritorno (${fmt(dr)}), ma con IPC ${ipc === 'NR' ? 'Nessun Rilievo' : ipc} al ${+d.accCant || 1}° accesso la regola Formedil non prevede rientro: il cantiere non comparirà nello scadenzario.` });
      } else {
        const limite = new Date(dv); limite.setDate(limite.getDate() + gg);
        if (dr > limite) {
          avvisi.push({ chi: 'ritorno-tardi', testo: `La visita di ritorno (${fmt(dr)}) è oltre il termine Formedil: con IPC ${ipc} al ${+d.accCant || 1}° accesso il rientro va fatto entro ${gg} giorni, cioè entro il ${fmt(limite)}.` });
        }
      }
    }

    /* 4. stesso cantiere, stesso giorno */
    for (const a of (d.stessoGiorno || []).filter((x) => x.stessoTecnico !== false)) {
      avvisi.push(a.stessaImpresa
        ? { chi: 'doppione', testo: `Esiste già il verbale ${a.nr_verbale || '(senza numero)'} sullo stesso cantiere, nello stesso giorno e con la stessa impresa principale: è un doppione?` }
        : { chi: 'lotto', testo: `Esiste già il verbale ${a.nr_verbale || '(senza numero)'} sullo stesso cantiere nello stesso giorno, con un'altra impresa principale. Se sono lotti diversi, il cantiere va distinto per lotto; se è lo stesso cantiere, va bene così.` });
    }

    /* 5. persona presente */
    const nome = String(d.ppreNome || '').trim();
    const qual = String(d.ppreQual || '').trim();
    if (nome && !qual) avvisi.push({ chi: 'ppre-qualifica', testo: `Persona presente «${nome}» senza qualifica («In qualità di»).` });
    if (!nome && qual) avvisi.push({ chi: 'ppre-nome', testo: `Qualifica della persona presente («${qual}») senza nome.` });

    /* 6. date e orari */
    const oggi = giorno(d.oggi);
    if (dv && oggi && dv > oggi) avvisi.push({ chi: 'data-futura', testo: `La data della visita (${fmt(dv)}) è nel futuro.` });
    if (d.oraDa && d.oraA && String(d.oraA) < String(d.oraDa)) {
      avvisi.push({ chi: 'orari', testo: `L'ora di fine (${d.oraA}) è prima dell'ora di inizio (${d.oraDa}).` });
    }
    return avvisi;
  }

  /* verbali dello stesso cantiere nello stesso giorno (tranne questo) */
  async function stessoGiorno({ cantiereId, dataVisita, visitaId, impresaId, tecnicoId }) {
    if (!radice.sb || !cantiereId || !dataVisita) return [];
    let q = radice.sb.from('visite').select('visita_id, nr_verbale, impresa_id, tecnico_id, tecnico2_id')
      .eq('cantiere_id', cantiereId).eq('data_visita', dataVisita).eq('elimina', 0);
    if (visitaId) q = q.neq('visita_id', visitaId);
    const { data, error } = await q;
    if (error) { console.warn('controllo verbale, stesso giorno:', error.message); return []; }
    return (data || []).map((v) => ({
      nr_verbale: v.nr_verbale,
      stessaImpresa: !!impresaId && v.impresa_id === impresaId,
      stessoTecnico: !tecnicoId || v.tecnico_id === tecnicoId || v.tecnico2_id === tecnicoId,
    }));
  }

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* la finestra: «Torno a correggere» (false) / «Salva comunque» (true) */
  function chiedi(avvisi) {
    return new Promise((risolvi) => {
      const velo = document.createElement('div');
      velo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
      velo.innerHTML = `
        <div role="dialog" aria-modal="true" style="background:#fff;color:#222;max-width:560px;width:100%;max-height:85vh;overflow:auto;border-radius:10px;padding:18px 18px 14px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:14px">
          <h3 style="margin:0 0 6px;font-size:17px;color:#e7500f">Prima di salvare: qualcosa non torna</h3>
          <p style="margin:0 0 10px;color:#565c66">Il verbale non è bloccato. Controlla questi punti: se sono giusti così, salva comunque.</p>
          <ul style="margin:0 0 14px;padding-left:20px;line-height:1.45">
            ${avvisi.map((a) => `<li style="margin-bottom:6px">${esc(a.testo)}</li>`).join('')}
          </ul>
          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
            <button type="button" data-r="0" class="btn-outline">Torno a correggere</button>
            <button type="button" data-r="1" class="btn-primary">Salva comunque</button>
          </div>
        </div>`;
      const chiudi = (r) => { velo.remove(); risolvi(r); };
      velo.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-r]');
        if (b) chiudi(b.dataset.r === '1');
      });
      document.body.appendChild(velo);
      velo.querySelector('button[data-r="0"]').focus();
    });
  }

  /* chiamata da saveVisita: true = si salva, false = si torna al verbale */
  async function verifica(d) {
    const altri = await stessoGiorno(d);
    const avvisi = analizza({ ...d, stessoGiorno: altri });
    if (!avvisi.length) return true;
    return chiedi(avvisi);
  }

  const api = { analizza, verifica, giorniFormedil, ipcDa };
  radice.ControlloVerbale = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
