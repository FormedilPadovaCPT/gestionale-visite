/* SCENARIO «UN VERBALE A SECCO» (13/11/2026) — gira DENTRO la pagina del gestionale, dopo l'accesso
   e dopo tools/prova_a_secco.js. Lo usa e2e/prove/verbale-a-secco.spec.mjs; si può anche incollare
   in console per provarlo a mano.

   Che cosa prova: che il percorso che conta regge — si entra, le pagine si aprono, la maschera del
   verbale si compila e «Salva bozza» arriva a scrivere il verbale. La scrittura viene fermata dalla
   prova a secco e qui si controlla che cosa sarebbe partito.

   Tre regole:
   1. Non si tocca la maschera se la prova a secco non è attiva E non ferma davvero le scritture
      (lo si verifica con una scrittura innocua, non lo si dà per buono).
   2. Con `salva: false` ci si ferma prima del pulsante: serve a provarlo con un accesso vero, che
      non ha la protezione del database dell'account di prova.
   3. Niente dati nel risultato: solo passi, conteggi e indirizzi delle richieste fermate. */
window.__scenarioVerbale = async function (opzioni) {
  const opz = Object.assign({ salva: true }, opzioni || {});
  const out = { ok: false, passi: [], errore: null, ultimoMessaggio: null, scritture: [] };
  const passo = (t) => out.passi.push(t);
  const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
  const finche = async (cosa, f, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 15000)) {
      try { const v = await f(); if (v) return v; } catch (e) { /* si riprova */ }
      await attendi(250);
    }
    throw new Error('non è successo in tempo: ' + cosa);
  };
  const messaggi = () => Array.from(document.querySelectorAll('#toast-area .toast')).map((t) => t.textContent.trim());
  try {
    const sb = window.sb, S = window.S, app = window.__app, secco = window.__secco;
    if (!sb || !S || !app || typeof window.navTo !== 'function') throw new Error('l\'app non espone sb, S, __app o navTo: è cambiato qualcosa in fondo a index.html');
    if (!S.user) throw new Error('nessun accesso');

    // 1. la prova a secco c'è e ferma davvero
    if (!secco || !secco.attivo) throw new Error('prova a secco non installata: mi fermo prima di toccare la maschera');
    const n0 = secco.scritture.length;
    await sb.from('avvisi_letture').delete().eq('avviso_id', -1);
    if (secco.scritture.length !== n0 + 1) throw new Error('la prova a secco NON ferma le scritture: mi fermo');
    passo('prova a secco attiva e verificata');

    // 2. le pagine si aprono
    for (const v of ['dashboard', 'lista', 'cantieri', 'rubrica', 'scadenze', 'incarichi', 'statistiche']) {
      window.navTo(v); await attendi(600);
      const el = document.getElementById('view-' + v);
      if (el && el.classList.contains('hidden')) throw new Error('la pagina «' + v + '» non si è aperta');
      passo('pagina ' + v);
    }

    // 3. la maschera del verbale
    window.navTo('form');
    await finche('maschera del verbale', () => document.getElementById('btn-bozza') && document.getElementById('f-data') && Array.isArray(S.imprese));
    await attendi(1500);
    passo('maschera aperta');

    const { data: cc, error: ec } = await sb.from('cantieri').select('*').not('cantiere_indirizzo', 'is', null).or('elimina.is.null,elimina.eq.0').order('created_at', { ascending: false }).limit(1);
    if (ec) throw new Error('cantieri non letti: ' + ec.message);
    if (!cc || !cc.length) throw new Error('nessun cantiere leggibile con questo accesso');
    await app._useCantiereEsistente(cc[0]);
    if (app.vGet('f-cant-id') !== String(cc[0].cantiere_id)) throw new Error('il cantiere non è entrato nella maschera');
    passo('cantiere scelto');

    const { data: ii, error: ei } = await sb.from('imprese').select('*').or('elimina.is.null,elimina.eq.0').limit(1);
    if (ei) throw new Error('imprese non lette: ' + ei.message);
    if (!ii || !ii.length) throw new Error('nessuna impresa leggibile con questo accesso');
    if (!S.imprese.length) throw new Error('la maschera non ha la riga dell\'impresa principale');
    Object.assign(S.imprese[0], { impresa_id: ii[0].impresa_id, impresa_nome: ii[0].impresa_nome || ii[0].ragione_sociale || 'impresa di prova' });
    passo('impresa principale impostata');

    if (!app.vGet('f-data')) app.vSet('f-data', new Date().toISOString().slice(0, 10));
    if (!app.vGet('f-tec-id') && S.tecnico && S.tecnico.tecnico_id) app.vSet('f-tec-id', S.tecnico.tecnico_id);
    if (!app.vGet('f-tec-id')) throw new Error('la maschera non ha il tecnico: l\'accesso non è quello di un tecnico');
    passo('data e tecnico presenti');

    if (!opz.salva) { out.ok = true; passo('fermato prima di «Salva bozza» (salva: false)'); return out; }

    // 4. «Salva bozza»: deve arrivare a scrivere il verbale
    const prima = secco.scritture.length;
    document.getElementById('btn-bozza').click();
    try {
      await finche('la scrittura del verbale', () => secco.scritture.slice(prima).some((s) => /\/rest\/v1\/visite(\?|$)/.test(s.url)), 25000);
    } catch (e) {
      out.ultimoMessaggio = messaggi().slice(-2).join(' | ') || null;
      throw new Error('«Salva bozza» non è arrivato a scrivere il verbale' + (out.ultimoMessaggio ? ' — a video: ' + out.ultimoMessaggio : ''));
    }
    await attendi(2500);
    const nuove = secco.scritture.slice(prima);
    const verbale = nuove.find((s) => /\/rest\/v1\/visite(\?|$)/.test(s.url));
    const riga = Array.isArray(verbale.body) ? verbale.body[0] : verbale.body;
    if (!riga || String(riga.cantiere_id) !== String(cc[0].cantiere_id)) throw new Error('il verbale scritto non porta il cantiere scelto');
    if (String(riga.impresa_id) !== String(ii[0].impresa_id)) throw new Error('il verbale scritto non porta l\'impresa scelta');
    if (!riga.tecnico_id || !riga.data_visita) throw new Error('il verbale scritto non porta tecnico o data');
    if (riga.stato && riga.stato !== 'bozza') throw new Error('«Salva bozza» ha scritto lo stato «' + riga.stato + '»');
    out.scritture = nuove.map((s) => s.method + ' ' + s.url.replace(/\?.*$/, ''));
    out.ultimoMessaggio = messaggi().slice(-1)[0] || null;
    passo('verbale scritto a secco: ' + nuove.length + ' richieste fermate');
    out.ok = true;
  } catch (e) {
    out.errore = (e && e.message) || String(e);
  }
  return out;
};
