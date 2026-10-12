/* ============================================================
   «IL VERBALE NON È ARRIVATO» — il riquadro del tecnico
   (21/09/2026, chiesto dall'utente).

   Il verbale parte dalla casella dell'ufficio
   (cptpd@did.formedilpadova.it) e, se un indirizzo è sbagliato, il
   messaggio di mancata consegna torna LÌ: lo vedrebbe una persona
   sola, e il tecnico che ha fatto la visita non lo saprebbe mai.
   Un giro quotidiano (edge function `mail-respinte`) lo registra in
   `s_mail_respinte`, manda al tecnico una mail e — se le ha attivate
   — la notifica sul telefono. Questo riquadro è il terzo posto in
   cui lo vede: quello dove può chiuderlo.

   Un rimbalzo dice che quella casella non ha accettato la mail, non
   quale sia l'indirizzo giusto: lo sa il tecnico, che in cantiere ci
   è stato. (12/10/2026, chiesto dall'utente: «il più delle volte è
   una mail digitata in modo errato») Con «✏️ Correggi indirizzo» lo
   scrive lui: la funzione `mail_respinta_correggi` lo sostituisce
   dove sta — sulla visita del rimbalzo e in anagrafica (persone,
   imprese, committenti), registrando ogni sostituzione in
   `mail_correzioni` — e poi si propone di ritrasmettere il verbale
   SOLO all'indirizzo corretto (window.reinviaVerbaleA, in
   index.html). Il rimbalzo si chiude da solo quando la
   ritrasmissione parte, o qui con la nota se non si ritrasmette.

   La riga NON si cancella: è la prova che quel verbale non è
   arrivato. Si chiude come «risolta» o «ignorata», con una nota
   (stessa regola dei cantieri critici).

   Script classico come diniego-accesso.js: usa window.sb, window.S
   e window.toast esposti dal modulo principale di index.html.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));

  let righe = [];

  async function disegna() {
    const box = $('dash-respinte');
    if (!box || !window.sb || !(window.S && window.S.user)) return;
    try {
      /* la RLS fa già il filtro: un tecnico vede solo le sue. Qui non si
         aggiunge un filtro sull'email, o il coordinatore e la segreteria
         (che le vedono tutte) si troverebbero il riquadro vuoto senza
         capire perché. */
      const { data, error } = await window.sb.from('s_mail_respinte')
        .select('id, ricevuta_il, destinatario, codice, permanente, motivo, nr_verbale, visita_id, ruolo, impresa_nome, stato, oggetto_originale')
        .in('stato', ['nuova', 'avvisato'])
        /* (02/10/2026) solo i rimbalzi di un verbale: il giro registra ogni
           mail tornata alla casella dell'ufficio, anche quelle che con i
           verbali non c'entrano. Le altre le guarda la segreteria, nella
           scheda «Altre mail tornate indietro» del suo cruscotto. */
        .not('nr_verbale', 'is', null)
        .order('ricevuta_il', { ascending: false })
        .limit(20);
      /* ⚠️ un errore di lettura non è «nessun rimbalzo»: si dice, non si
         nasconde il riquadro (regola del 19/09) */
      if (error) {
        box.innerHTML = '<div class="card" style="border-left:4px solid #c0392b"><h3>&#128237; Verbali non consegnati</h3>'
          + '<p style="font-size:12px;color:#c0392b;margin:4px 0">Non sono riuscito a leggere l\'elenco: ' + esc(error.message) + '</p></div>';
        box.style.display = '';
        return;
      }
      righe = data || [];
    } catch (e) { box.style.display = 'none'; return; }

    if (!righe.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    const riga = (r) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid #f0e6dd">
      <span style="font-size:13px">${r.permanente === false ? '&#128336;' : '&#128237;'}</span>
      <span style="font-size:12px;color:#444;flex:1;min-width:240px">
        <strong>${esc(r.destinatario || '')}</strong>${r.ruolo ? ` <span style="color:#888">(${esc(r.ruolo)})</span>` : ''}
        ${r.nr_verbale ? ` &middot; verbale <strong>${esc(r.nr_verbale)}</strong>` : ''}${r.impresa_nome ? ` &middot; ${esc(r.impresa_nome)}` : ''}
        &middot; ${dIt(r.ricevuta_il)}
        ${r.motivo ? `<br><span style="color:#888">${esc(String(r.motivo).slice(0, 150))}</span>` : r.codice ? `<br><span style="color:#888">codice ${esc(r.codice)}</span>` : ''}
        ${r.permanente === false ? '<br><span style="color:#b35c00">Il server dice che ci sta ancora provando: può darsi che arrivi da sé.</span>' : ''}
      </span>
      ${r.visita_id ? `<button class="btn-primary btn-sm" data-resp-corr="${r.id}" data-aiuto="Scrivi l'indirizzo giusto: si corregge sulla visita e in anagrafica, poi ti propongo di ritrasmettere il verbale solo a quello.">&#9999;&#65039; Correggi indirizzo</button>` : ''}
      <button class="btn-outline btn-sm" data-resp-ok="${r.id}">&#9989; Sistemato</button>
      <button class="btn-outline btn-sm" data-resp-no="${r.id}">Non serviva</button>
    </div>`;

    box.innerHTML = `<div class="card" style="border-left:4px solid #c0392b">
      <h3>&#128237; Verbali non consegnati <span style="color:#c0392b">&mdash; ${righe.length}</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">La mail con cui è stato trasmesso il verbale è tornata indietro: l'indirizzo l'ha rifiutata,
        quindi è probabile che sia <strong>sbagliato</strong>. Con <strong>&#9999;&#65039; Correggi indirizzo</strong> scrivi quello giusto: si corregge sulla visita e in anagrafica, e poi puoi ritrasmettere il verbale solo a quell'indirizzo.</p>
      ${righe.map(riga).join('')}
    </div>`;
    box.style.display = '';
  }

  async function chiudi(id, stato) {
    const r = righe.find((x) => x.id === id);
    const domanda = stato === 'risolta'
      ? 'Che cosa hai sistemato? (per esempio: indirizzo corretto in anagrafica e verbale ritrasmesso)'
      : 'Perché non serviva? (per esempio: indirizzo giusto, il verbale è stato consegnato a mano)';
    const note = prompt(`${r ? r.destinatario : ''}\n\n${domanda}`);
    if (note === null) return;
    if (!note.trim()) { avviso('Scrivi due parole: è la riga che rileggerà la segreteria.', 'warn'); return; }
    try {
      const { error } = await window.sb.rpc('s_mail_respinta_chiudi', { p_id: id, p_stato: stato, p_note: note.trim() });
      if (error) throw error;
      avviso(stato === 'risolta' ? 'Segnato come sistemato.' : 'Chiuso.', 'ok');
      disegna().catch(() => {});
    } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); }
  }

  /* (12/10/2026) correggere l'indirizzo e ritrasmettere solo a quello */
  async function correggi(id) {
    const r = righe.find((x) => x.id === id);
    if (!r) return;
    const nuova = prompt(`Verbale ${r.nr_verbale || ''} — ${r.ruolo || 'destinatario'}${r.impresa_nome ? ' · ' + r.impresa_nome : ''}\n\n`
      + `Indirizzo respinto: ${r.destinatario}\n\nScrivi l'indirizzo corretto (lo correggo sulla visita e in anagrafica):`, r.destinatario || '');
    if (nuova === null) return;
    const pulita = nuova.trim().toLowerCase();
    if (!pulita || pulita === String(r.destinatario || '').trim().toLowerCase()) {
      avviso('È lo stesso indirizzo che è stato respinto: correggi la parte sbagliata.', 'warn'); return;
    }
    let esito;
    try {
      const { data, error } = await window.sb.rpc('mail_respinta_correggi', { p_id: id, p_nuova: pulita });
      if (error) throw error;
      esito = data || {};
    } catch (e) { avviso('Indirizzo non corretto: ' + (e.message || e), 'err', 9000); return; }

    const NOMI = { visite: 'il verbale', persone: 'la rubrica delle persone', imprese: 'l’anagrafica imprese', committenti: 'i committenti' };
    const dove = [...new Set((esito.dove || []).map((d) => NOMI[d.tabella] || d.tabella))];
    const fatto = dove.length ? `Corretto in: ${dove.join(', ')}.` : 'L’indirizzo non era né sul verbale né in anagrafica (era stato aggiunto a mano all’invio).';
    const nota = `Indirizzo corretto: ${r.destinatario} → ${esito.nuova}. ${fatto}`;
    if (confirm(`${fatto}\n\nVuoi ritrasmettere il verbale ${r.nr_verbale || ''} SOLO a ${esito.nuova}?\n(L'ufficio è sempre in copia.)`)) {
      if (typeof window.reinviaVerbaleA !== 'function') { avviso('Pagina non aggiornata: ricarica e ritrasmetti dall’elenco delle visite.', 'err', 9000); return; }
      /* la finestra d'invio è quella di sempre: il tecnico vede il testo e preme Invia.
         Partito l'invio, il rimbalzo si chiude da solo con questa nota. */
      window.reinviaVerbaleA(r.visita_id, { email: esito.nuova, ruolo: r.ruolo || '', nome: r.impresa_nome || '' },
        { respintaId: id, vecchia: r.destinatario, nota });
      return;
    }
    try {
      const { error } = await window.sb.rpc('s_mail_respinta_chiudi', { p_id: id, p_stato: 'risolta', p_note: nota + ' Verbale non ritrasmesso.' });
      if (error) throw error;
      avviso('Indirizzo corretto. Il verbale non è stato ritrasmesso.', 'ok');
    } catch (e) { avviso('Indirizzo corretto, ma il rimbalzo non si è chiuso: ' + (e.message || e), 'warn', 9000); }
    disegna().catch(() => {});
  }

  document.addEventListener('click', (e) => {
    const corr = e.target.closest('[data-resp-corr]');
    if (corr) { correggi(Number(corr.dataset.respCorr)); return; }
    const ok = e.target.closest('[data-resp-ok]');
    if (ok) { chiudi(Number(ok.dataset.respOk), 'risolta'); return; }
    const no = e.target.closest('[data-resp-no]');
    if (no) chiudi(Number(no.dataset.respNo), 'ignorata');
  });

  window.respinteBox = disegna;
})();
