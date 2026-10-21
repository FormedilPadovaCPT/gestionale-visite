/* ============================================================
   UN GIRO ALLA VOLTA (21/10/2026)

   Il 21/10/2026 fra le 14:51 e le 14:53 il database è andato in coda: lo
   stesso Chrome della segreteria ha riaperto Oggi una decina di volte, e
   ogni apertura faceva partire 40-85 letture, molte DOPPIE (incarichi,
   Zona Coordinatore, ruoli della direzione) a due secondi di distanza. Le
   funzioni da sole rispondono in 0,02-2 s; dentro la raffica arrivavano a
   7-29 s e poi «Timed out acquiring connection from connection pool».

   Questo è il fermo per i caricamenti che partono dalle PAGINE:
     UnGiro.fai(nome, fn, { fresco: ms })
   · se lo stesso giro è già in corso, si aspetta quello: non ne parte un altro;
   · se è finito bene da meno di `fresco` millisecondi, si riusa il risultato;
   · un giro fallito non si ricorda: il prossimo riparte.
   Dopo un cambio (approvo una fattura, completo un incarico) si chiama la
   funzione vera, non questa: lì serve il dato di adesso, non quello di un
   giro partito prima del cambio. UnGiro.scorda(nome) fa dimenticare il
   risultato ricordato, senza fermare un giro in corso.

   Script classico: window.UnGiro nel browser, module.exports nei test.
   ============================================================ */
(function (radice) {
  const giri = new Map();   // nome → { corso: Promise | null, finito: ms, ok: bool, esito }

  function fai(nome, fn, opz) {
    const fresco = (opz && opz.fresco) || 0;
    const g = giri.get(nome);
    if (g && g.corso) return g.corso;
    if (fresco && g && g.ok && Date.now() - g.finito < fresco) return Promise.resolve(g.esito);
    const corso = Promise.resolve().then(fn).then(
      (esito) => { giri.set(nome, { corso: null, finito: Date.now(), ok: true, esito }); return esito; },
      (e) => { giri.set(nome, { corso: null, finito: 0, ok: false }); throw e; });
    giri.set(nome, { corso, finito: 0, ok: false });
    return corso;
  }

  function scorda(nome) { const g = giri.get(nome); if (g) { g.ok = false; g.finito = 0; } }
  const inCorso = (nome) => !!(giri.get(nome) || {}).corso;

  const api = { fai, scorda, inCorso };
  radice.UnGiro = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
