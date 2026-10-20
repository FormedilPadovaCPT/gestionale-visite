/* ============================================================
   QUESTIONI SUI VERBALI — dal riepilogo al tecnico, fino alla
   risoluzione (20/10/2026, chiesto dall'utente).

   Il riepilogo «Verbali da sistemare» (riepilogo-verbali.js) elenca i
   verbali che il controllo al salvataggio segnala. Qui la parte che
   mancava: che cosa ne fa il Coordinatore.
     · «✔ Fai passare»      per le cose da poco: la riga si chiude subito.
     · «📨 Segnala al tecnico» apre il messaggio già scritto (verbale,
       data, che cosa dice il controllo), che il Coordinatore corregge e
       manda; se il verbale va corretto, con la spunta torna fra le
       bozze del tecnico. Il tecnico riceve la notifica e trova la
       segnalazione nella pagina Oggi (riquadro qui sotto).
     · il tecnico risponde «🛠 Sistemo» oppure «💬 Va bene così, perché…».
     · il Coordinatore chiude: «✅ Risolta» o «✔ Fai passare».
   Il messaggio lo scrive e lo manda una persona: non è una mail
   automatica (la mail resta facoltativa, dalla posta del Coordinatore).

   ⚠️ NIENTE PAGAMENTO CON UNA QUESTIONE APERTA: lo impedisce il
   database (trigger su s_fatture_tecnici, 2026_10_20_questioni_verbali.sql).
   In più, prima di approvare una fattura, la Zona Coordinatore
   controlla che su ogni verbale segnalato dal controllo ci sia una
   decisione (controllaFattura): quel controllo gira solo qui, perché
   i controlli dei verbali stanno nel browser (controllo-verbale.js).

   ⚠️ L'UNITÀ È IL VERBALE, NON LA PERSONA: niente conteggi, totali o
   confronti per tecnico (sigla VAL; AI Act, Allegato III punto 4).

   Script classico: usa window.sb, window.S, window.toast.
   Le funzioni pure (testoProposto, stato, nonDecisi) si provano con
   node (test/questioni-verbali.test.cjs).
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const $ = (id) => (haDom ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const avviso = (m, t, ms) => (radice.toast ? radice.toast(m, t, ms) : (haDom ? alert(m) : console.log(m)));
  const APERTE = ['segnalata', 'risposta'];
  const OGGETTO = 'FORMEDIL Padova -AREA SICUREZZA E SALUTE- ';

  /* ---------- la parte pura ---------- */

  /* il messaggio proposto al tecnico: il Coordinatore lo corregge prima di mandarlo */
  function testoProposto({ nome, nr, data, avvisi }) {
    const righe = (avvisi || []).map((a) => '- ' + (a.testo || a)).join('\n');
    return `Ciao${nome ? ' ' + nome : ''},\n`
      + `sul verbale ${nr || '(senza numero)'}${data ? ' del ' + dIt(data) : ''} il controllo dell'ufficio segnala:\n`
      + `${righe}\n\n`
      + 'Puoi sistemarlo? Se secondo te va bene così, rispondimi dall\'app spiegando il perché.';
  }

  /* lo stato di un verbale rispetto alle questioni: l'ultima riga decide */
  function stato(q) {
    if (!q) return { codice: 'nessuna', aperta: false, testo: '' };
    if (q.esito === 'segnalata') return { codice: 'segnalata', aperta: true, testo: `Segnalato al tecnico il ${dIt(q.aperta_il)}${q.riaperto ? ', verbale rimesso fra le sue bozze' : ''}: attende la risposta.` };
    if (q.esito === 'risposta') return { codice: 'risposta', aperta: true,
      testo: `Il tecnico ha risposto il ${dIt(q.risposta_il)}: ${q.risposta_tipo === 'sistemo' ? '«Sistemo»' : '«Va bene così»'}${q.risposta ? ' — ' + q.risposta : ''}. Manca la tua decisione.` };
    if (q.esito === 'risolta') return { codice: 'risolta', aperta: false, testo: `Risolto il ${dIt(q.chiusa_il)}${q.nota_chiusura && q.nota_chiusura !== 'Risolta' ? ' — ' + q.nota_chiusura : ''}.` };
    if (q.esito === 'passata') return { codice: 'passata', aperta: false, testo: `Fatto passare il ${dIt(q.chiusa_il)}${q.nota_chiusura && !/^Fatt[oa] passare dal Coordinatore$/.test(q.nota_chiusura) ? ' — ' + q.nota_chiusura : ''}.` };
    return { codice: q.esito || '?', aperta: false, testo: '' };
  }

  /* l'ultima questione di ogni verbale (le righe arrivano in ordine qualsiasi) */
  function ultimePerVisita(righe) {
    const m = {};
    for (const q of righe || []) {
      const p = m[q.visita_id];
      if (!p || Number(q.id) > Number(p.id)) m[q.visita_id] = q;
    }
    return m;
  }

  /* i verbali segnalati dal controllo su cui il Coordinatore non ha ancora deciso niente */
  function nonDecisi(daSistemare, perVisita) {
    return (daSistemare || []).filter((x) => !(perVisita || {})[x.visita.visita_id]);
  }

  /* ---------- da qui in giù serve il browser ---------- */

  let coord = null;
  async function sonoCoordinatore() {
    if (coord !== null) return coord;
    try { const { data } = await radice.sb.rpc('is_coordinatore'); coord = !!data; } catch (e) { coord = false; }
    return coord;
  }

  async function leggi(ids) {
    const unici = [...new Set((ids || []).filter(Boolean))];
    const tutte = [];
    for (let i = 0; i < unici.length; i += 100) {
      const { data, error } = await radice.sb.from('visite_questioni')
        .select('id, visita_id, nr_verbale, tecnico_id, esito, problemi, messaggio, riaperto, risposta_tipo, risposta, risposta_il, aperta_da, aperta_il, chiusa_da, chiusa_il, nota_chiusura')
        .in('visita_id', unici.slice(i, i + 100));
      if (error) throw error;
      tutte.push(...(data || []));
    }
    return tutte;
  }

  /* le questioni ancora aperte dei verbali di un mese, anche se il controllo non li segnala più
     (corretti dopo la segnalazione): senza, resterebbero aperte e invisibili, e la fattura bloccata */
  async function aperteDelMese(da, a) {
    const { data, error } = await radice.sb.from('visite_questioni')
      .select('id, visita_id, nr_verbale, tecnico_id, esito, problemi, messaggio, riaperto, risposta_tipo, risposta, risposta_il, aperta_da, aperta_il, chiusa_da, chiusa_il, nota_chiusura, visite!inner(data_visita)')
      .in('esito', APERTE).gte('visite.data_visita', da).lte('visite.data_visita', a);
    if (error) throw error;
    return data || [];
  }

  /* ── la finestra del messaggio ── */
  function finestra({ titolo, testo, definitivo, conRiapri }) {
    return new Promise((fatto) => {
      const fondo = document.createElement('div');
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
      fondo.innerHTML = `<div style="background:#fff;color:#222;border-radius:10px;max-width:560px;width:100%;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);text-align:left">
        <h3 style="margin:0 0 8px;font-size:16px">${esc(titolo)}</h3>
        <textarea id="vq-testo" rows="9" style="width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:8px;border:1px solid #ccc;border-radius:6px">${esc(testo)}</textarea>
        ${conRiapri ? `<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:8px 0 0;${definitivo ? '' : 'color:#999'}">
          <input type="checkbox" id="vq-riapri" ${definitivo ? '' : 'disabled'} style="margin-top:3px">
          <span>Il verbale va corretto: <strong>rimettilo fra le bozze del tecnico</strong>. Finché non lo richiude esce da statistiche e Osservatorio${definitivo ? '' : ' (è già in bozza)'}.</span></label>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
          <button type="button" class="btn-outline btn-sm" id="vq-annulla">Annulla</button>
          <button type="button" class="btn-primary btn-sm" id="vq-ok">${conRiapri ? '&#128232; Invia al tecnico' : 'Conferma'}</button>
        </div></div>`;
      document.body.appendChild(fondo);
      const chiudi = (v) => { fondo.remove(); fatto(v); };
      fondo.querySelector('#vq-annulla').onclick = () => chiudi(null);
      fondo.querySelector('#vq-ok').onclick = () => chiudi({ testo: fondo.querySelector('#vq-testo').value, riapri: !!(fondo.querySelector('#vq-riapri') || {}).checked });
      fondo.querySelector('#vq-testo').focus();
    });
  }

  /* ── il Coordinatore segnala ── */
  async function segnala(riga) {
    const { visita: v, avvisi, nome } = riga;
    const scelta = await finestra({
      titolo: `Segnala al tecnico il verbale ${v.nr_verbale || ''}`,
      testo: testoProposto({ nome, nr: v.nr_verbale, data: v.data_visita, avvisi }),
      definitivo: v.stato === 'definitivo', conRiapri: true,
    });
    if (!scelta) return false;
    if (scelta.testo.trim().length < 5) { avviso('Scrivi al tecnico che cosa va sistemato.', 'warn'); return false; }
    const { data, error } = await radice.sb.rpc('vq_segnala', {
      p_visita_id: v.visita_id, p_problemi: (avvisi || []).map((a) => a.testo).join('\n'),
      p_messaggio: scelta.testo.trim(), p_riapri: scelta.riapri,
    });
    if (error || !data || !data.ok) { avviso('Non segnalato: ' + (error ? error.message : 'risposta inattesa'), 'err', 8000); return false; }
    avviso(`Segnalato al tecnico${data.riaperto ? ', verbale rimesso fra le sue bozze' : ''}${data.notifica ? '' : ' (non ha un indirizzo: avvisalo tu)'}.`, 'ok', 6000);
    /* la mail resta facoltativa e parte dalla posta del Coordinatore: l'app la prepara soltanto */
    if (data.email_tecnico && confirm('Vuoi mandargli lo stesso messaggio anche per mail, dalla tua posta?\n(Lo trova comunque nell\'app, con la notifica sul telefono se l\'ha attivata.)')) {
      const ogg = `${OGGETTO}Verbale ${v.nr_verbale || ''} da sistemare`;
      location.href = `mailto:${encodeURIComponent(data.email_tecnico)}?subject=${encodeURIComponent(ogg)}&body=${encodeURIComponent(scelta.testo.trim())}`;
    }
    return true;
  }

  /* ── il Coordinatore fa passare (prima o dopo aver segnalato) ── */
  async function passa(riga) {
    const { visita: v, avvisi } = riga;
    const nota = prompt(`Fai passare il verbale ${v.nr_verbale || ''} così com'è?\n\nNon parte niente al tecnico e il verbale non blocca più il pagamento.\nSe vuoi, scrivi due parole sul perché (facoltativo):`, '');
    if (nota === null) return false;
    const { error } = await radice.sb.rpc('vq_passa', { p_visita_id: v.visita_id, p_problemi: (avvisi || []).map((a) => a.testo).join('\n'), p_nota: nota.trim() || null });
    if (error) { avviso('Non riuscito: ' + error.message, 'err', 8000); return false; }
    avviso('Fatto passare.', 'ok');
    return true;
  }

  async function risolta(q) {
    const nota = prompt(`Il verbale ${q.nr_verbale || ''} è sistemato?\n\nLa segnalazione si chiude come risolta. Una nota, se serve (facoltativa):`, '');
    if (nota === null) return false;
    const { error } = await radice.sb.rpc('vq_chiudi', { p_id: q.id, p_esito: 'risolta', p_nota: nota.trim() || null });
    if (error) { avviso('Non riuscito: ' + error.message, 'err', 8000); return false; }
    avviso('Segnalazione chiusa come risolta.', 'ok');
    return true;
  }

  /* i pulsanti e lo stato di una riga del riepilogo (li disegna riepilogo-verbali.js) */
  function htmlRiga(riga, q, puoDecidere) {
    const st = stato(q);
    const colore = st.aperta ? '#b35c00' : '#2d7a06';
    const k = esc(riga.visita.visita_id);
    const testo = st.testo ? `<div style="font-size:12px;color:${colore};margin:4px 0 0">${st.aperta ? '&#9203;' : '&#9989;'} ${esc(st.testo)}</div>` : '';
    if (!puoDecidere) return testo;
    let bottoni = '';
    if (st.codice === 'nessuna') {
      bottoni = `<button type="button" class="btn-primary btn-sm" data-vq-segnala="${k}">&#128232; Segnala al tecnico</button>
        <button type="button" class="btn-outline btn-sm" data-vq-passa="${k}">&#10004; Fai passare</button>`;
    } else if (st.aperta) {
      bottoni = `<button type="button" class="btn-primary btn-sm" data-vq-risolta="${k}">&#9989; Risolta</button>
        <button type="button" class="btn-outline btn-sm" data-vq-passa="${k}">&#10004; Fai passare</button>`;
    } else {
      bottoni = `<button type="button" class="btn-outline btn-sm" data-vq-segnala="${k}">&#128232; Segnala di nuovo</button>`;
    }
    return testo + `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${bottoni}</div>`;
  }

  /* ── prima di approvare una fattura ── */
  async function controllaFattura(fatturaId) {
    const { data: pp, error } = await radice.sb.from('s_prestazioni').select('visita_id').eq('fattura_id', fatturaId);
    if (error) throw error;
    const ids = (pp || []).map((p) => p.visita_id).filter(Boolean);
    if (!ids.length) return { nonDecisi: [], aperte: [] };
    if (!radice.RiepilogoVerbali || !radice.RiepilogoVerbali.analizzaVisite) throw new Error('manca il modulo del riepilogo dei verbali');
    const r = await radice.RiepilogoVerbali.analizzaVisite(ids);
    const tutte = await leggi(ids);
    const perVisita = ultimePerVisita(tutte);
    return {
      nonDecisi: nonDecisi(r.daSistemare, perVisita),
      aperte: tutte.filter((q) => APERTE.includes(q.esito)),
    };
  }

  /* ── il riquadro del tecnico, nella pagina Oggi ── */
  let mie = [];
  async function boxTecnico() {
    const box = $('dash-questioni');
    const tec = radice.S && radice.S.tecnico;
    if (!box || !radice.sb || !tec || !tec.tecnico_id) { if (box) box.style.display = 'none'; return; }
    const { data, error } = await radice.sb.from('visite_questioni')
      .select('id, visita_id, nr_verbale, esito, messaggio, riaperto, risposta_tipo, risposta, risposta_il, aperta_il')
      .eq('tecnico_id', tec.tecnico_id).in('esito', APERTE).order('aperta_il', { ascending: false }).limit(30);
    if (error) {
      box.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>&#128203; Verbali da sistemare</h3><p style="font-size:12px;color:#c0392b;margin:4px 0">Non sono riuscito a leggere le segnalazioni del Coordinatore: ${esc(error.message)}</p></div>`;
      box.style.display = ''; return;
    }
    mie = data || [];
    if (!mie.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = `<div class="card" style="border-left:4px solid #2980b9">
      <h3>&#128203; Verbali da sistemare <span style="color:#2980b9">&mdash; ${mie.length}</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">Il Coordinatore ti chiede di guardare questi verbali. Rispondi qui: <strong>Sistemo</strong>, oppure <strong>Va bene così</strong> con il perché. Finché la segnalazione è aperta il verbale non va in pagamento.</p>
      ${mie.map((q) => `<div style="padding:8px 0;border-top:1px solid #eee">
        <div style="font-size:13px"><strong>${esc(q.nr_verbale || '')}</strong> <span style="color:#888">&mdash; segnalato il ${dIt(q.aperta_il)}${q.riaperto ? ' &middot; <b style="color:#b35c00">è fra le tue bozze: correggilo e richiudilo</b>' : ''}</span></div>
        <div style="font-size:12px;color:#333;white-space:pre-wrap;background:#f6f8fb;border-radius:6px;padding:6px 8px;margin:4px 0">${esc(q.messaggio || '')}</div>
        ${q.esito === 'risposta'
          ? `<div style="font-size:12px;color:#2d7a06">Hai risposto il ${dIt(q.risposta_il)}: ${q.risposta_tipo === 'sistemo' ? '«Sistemo»' : '«Va bene così»'}${q.risposta ? ' — ' + esc(q.risposta) : ''}. Ora decide il Coordinatore.</div>`
          : `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn-primary btn-sm" data-vq-sistemo="${q.id}">&#128736; Sistemo</button>
             <button type="button" class="btn-outline btn-sm" data-vq-vabene="${q.id}">&#128172; Va bene così</button></div>`}
      </div>`).join('')}
    </div>`;
    box.style.display = '';
  }

  async function rispondi(id, tipo) {
    const q = mie.find((x) => x.id === id);
    let testo = null;
    if (tipo === 'va_bene') {
      testo = prompt(`Verbale ${q ? q.nr_verbale : ''}\n\nPerché va bene così? Il Coordinatore lo legge per decidere:`, '');
      if (testo === null) return;
      if (testo.trim().length < 5) { avviso('Scrivi il perché: è quello che legge il Coordinatore.', 'warn'); return; }
    } else {
      testo = prompt(`Verbale ${q ? q.nr_verbale : ''}\n\nSistemi tu. Vuoi aggiungere una nota per il Coordinatore? (facoltativa)${q && q.riaperto ? '\nRicordati di correggere il verbale fra le bozze e di richiuderlo con «Definitivo».' : ''}`, '');
      if (testo === null) return;
    }
    const { error } = await radice.sb.rpc('vq_rispondi', { p_id: id, p_tipo: tipo, p_testo: (testo || '').trim() || null });
    if (error) { avviso('Risposta non inviata: ' + error.message, 'err', 8000); return; }
    avviso('Risposta inviata al Coordinatore.', 'ok');
    boxTecnico().catch(() => {});
  }

  if (haDom) {
    document.addEventListener('click', (e) => {
      const s = e.target.closest('[data-vq-sistemo]');
      if (s) { rispondi(Number(s.dataset.vqSistemo), 'sistemo'); return; }
      const b = e.target.closest('[data-vq-vabene]');
      if (b) rispondi(Number(b.dataset.vqVabene), 'va_bene');
    });
  }

  const api = { testoProposto, stato, ultimePerVisita, nonDecisi, leggi, aperteDelMese, sonoCoordinatore, segnala, passa, risolta, htmlRiga, controllaFattura, boxTecnico, APERTE };
  radice.QuestioniVerbali = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
