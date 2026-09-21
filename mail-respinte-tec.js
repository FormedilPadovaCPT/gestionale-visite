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

   ⚠️ QUI NON SI CORREGGE L'INDIRIZZO. Un rimbalzo dice che quella
   casella non ha accettato la mail, non quale sia l'indirizzo
   giusto: lo sa il tecnico, che in cantiere ci è stato. Si corregge
   in anagrafica e si ritrasmette il verbale; qui si dichiara che è
   stato fatto, scrivendo che cosa.

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
        .select('id, ricevuta_il, destinatario, codice, permanente, motivo, nr_verbale, ruolo, impresa_nome, stato, oggetto_originale')
        .in('stato', ['nuova', 'avvisato'])
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
      <button class="btn-primary btn-sm" data-resp-ok="${r.id}">&#9989; Sistemato</button>
      <button class="btn-outline btn-sm" data-resp-no="${r.id}">Non serviva</button>
    </div>`;

    box.innerHTML = `<div class="card" style="border-left:4px solid #c0392b">
      <h3>&#128237; Verbali non consegnati <span style="color:#c0392b">&mdash; ${righe.length}</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">La mail con cui è stato trasmesso il verbale è tornata indietro: l'indirizzo l'ha rifiutata,
        quindi è probabile che sia <strong>sbagliato</strong>. Correggilo nell'anagrafica e ritrasmetti il verbale; poi segna qui che è sistemato.</p>
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

  document.addEventListener('click', (e) => {
    const ok = e.target.closest('[data-resp-ok]');
    if (ok) { chiudi(Number(ok.dataset.respOk), 'risolta'); return; }
    const no = e.target.closest('[data-resp-no]');
    if (no) chiudi(Number(no.dataset.respNo), 'ignorata');
  });

  window.respinteBox = disegna;
})();
