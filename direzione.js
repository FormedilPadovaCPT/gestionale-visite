/* ============================================================
   DIREZIONE E CONSIGLIO — la pagina del Direttore e il registro delle
   questioni in attesa di decisione (25/09/2026, deciso dall'utente)

   Un ingresso solo per il Direttore, nel gestionale (stessa scelta fatta
   per il coordinatore il 17/09: chi non è segreteria lavora da qui).
   La pagina «🏛️ Direzione» ha tre riquadri:
     · le AUTORIZZAZIONI dei servizi CPT in attesa del suo visto (le
       riempie loadAutorizzazioni di index.html; il collegamento apre la
       maschera dell'app Segreteria già collegata, perché le due app
       stanno sulla stessa origine e condividono l'accesso);
     · le CONFERME richieste sui cantieri critici: qui il Direttore legge
       il caso, i verbali e la cronologia, e preme «Confermo» o «Non
       confermo» (funzione s_critico_conferma_direttore, che accetta solo
       lui — la stessa maschera dell'app Segreteria, portata qui);
     · il REGISTRO delle questioni in attesa: le righe automatiche (ciò che
       il database sa già: autorizzazioni e conferme) e quelle scritte a
       mano da coordinatore e segreteria. Si ordina per giorni di attesa.
       Il Direttore risponde qui (s_decisione_rispondi) con tre esiti:
       decide, rinvia a una data (il promemoria tace fino a quel giorno),
       oppure PROPONE UN INCONTRO a coordinatore e segreteria — data
       facoltativa, loro ricevono un avviso e chiudono con «Incontro
       fatto» (25/09/2026, stesso giorno della prima versione). La
       PRIORITÀ (normale | alta) la impostano ufficio e coordinatore,
       mai chi decide — stessa scelta a due valori dei cantieri critici.
   La Presidenza (presidente e vicepresidente) vede lo stesso registro per
   le sole questioni che spettano a lei. Coordinatore e segreteria hanno
   il registro nella Zona Coordinatore: aprono, ritirano, prendono in
   carico le decisioni.

   Nella Zona Segreteria c'è l'obiettivo di visite dell'esercizio (regola
   CEIV: 100 visite ogni 50.000 euro di contributi), che le Statistiche
   mostrano a tutti, Consiglio compreso.

   Script classico come cantieri-critici-coord.js: usa window.sb, window.S
   e window.toast del modulo principale. Tabelle s_decisioni,
   s_decisioni_eventi, visite_obiettivo_esercizio (SQL in
   segreteria-app/supabase/sql/2026_09_25_direzione_decisioni.sql).
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oraIt = (ts) => (ts ? new Date(ts).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const giorni = (d) => (d ? Math.max(0, Math.floor((new Date(oggi()) - new Date(String(d).slice(0, 10))) / 864e5)) : null);
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const S = () => window.S || {};
  const SEGRETERIA_URL = 'https://formedilpadovacpt.github.io/segreteria/';

  const DECISORI = { direttore: 'Direttore', presidenza: 'Presidenza', commissione: 'Commissione Sicurezza' };
  const EVENTI = { apertura: 'Aperta', modifica: 'Modificata', decisione: 'Decisione', rinvio: 'Rinvio', incontro_proposto: 'Incontro proposto', presa_in_carico: 'Presa in carico', ritiro: 'Ritirata', riapertura: 'Riaperta', proposta: 'Proposta dal second brain', pubblicazione: 'Resa visibile' };
  const EV_CRIT = { apertura: 'Apertura', nota: 'Nota', lettera_impresa: "Comunicazione all'impresa", sollecito: 'Sollecito', pec_richiesta: 'PEC chiesta all\'Amministrazione',
    contatto_impresa: "L'impresa ha ricontattato", visita_riprogrammata: 'Visita riprogrammata', visita_successiva: 'Verbale successivo', decisione: 'Decisione',
    risposta_tecnico: 'Risposta al tecnico', conferenza_proposta: 'Proposta di conferenza', demandata: 'Demandata', decisione_organo: 'Decisione di Presidenza / Commissione',
    autorizzazione_direttore: 'Conferma del Direttore', segnalazione_organi: 'Segnalazione a SPISAL / ITL', riscontro_organo: "Riscontro dell'organo di vigilanza" };

  /* ── chi sono: lo dice il database, non un elenco di indirizzi ── */
  let _ruoli = null;
  const _aperteQ = new Set();   // le questioni aperte col tocco (26/09/2026): restano aperte quando l'elenco si ridisegna
  /* 26/09/2026 — sul PC (da 1100 pixel) il registro è ELENCO A SINISTRA E DETTAGLIO
     A DESTRA (proposta B, scelta dall'utente dopo aver provato la tabella A lo stesso
     giorno: «era meglio la B»). Sul telefono resta l'elenco che si apre. In cima le
     questioni ad alta priorità, poi per giorni di attesa; i contatori filtrano. */
  let _ordQ = 'prio';
  let _selQ = null;              // la questione mostrata a destra, sul PC
  let _ultimoQ = null;           // host e modo dell'ultimo disegno: per ridisegnare se la finestra cambia larghezza
  const _pc = () => !!(window.matchMedia && window.matchMedia('(min-width:1100px)').matches);
  /* se la finestra passa da stretta a larga (o viceversa) si ridisegna: col «resize»,
     perché non tutti i browser avvisano del cambio di una media query */
  let _pcPrima = null, _tRes = null;
  window.addEventListener('resize', () => { clearTimeout(_tRes); _tRes = setTimeout(() => { const ora = _pc(); if (_pcPrima !== null && ora !== _pcPrima && _ultimoQ && document.body.contains(_ultimoQ.host)) decisioniBox(_ultimoQ.host, _ultimoQ.modo); _pcPrima = ora; }, 250); });
  let _filtroQ = 'tutte';        // tutte | alta | scadute
  async function ruoli() {
    /* la memoria vale per UN utente: se sullo stesso telefono entra un altro
       account (26/09/2026: il Direttore vedeva «Ritira» e la priorità della
       segreteria, e non «Rispondi») si rilegge */
    const email = (window.S && window.S.user && window.S.user.email) || '';
    if (_ruoli && _ruoli.email === email) return _ruoli;
    const sb = window.sb;
    const chiedi = async (f) => { try { const { data, error } = await sb.rpc(f); return !error && data === true; } catch (_e) { return false; } };
    const [direttore, presidenza, coord, segr] = await Promise.all(['is_direttore', 'is_presidenza', 'is_coordinatore', 'is_segreteria'].map(chiedi));
    _ruoli = { email, direttore, presidenza, coord, segr };
    return _ruoli;
  }
  window.addEventListener('gestionale-logout', () => { _ruoli = null; });

  /* ── piccola finestra sovrapposta (per il caso critico e la cronologia) ── */
  function finestra(titolo, html) {
    chiudi();
    const f = document.createElement('div');
    f.id = 'dir-finestra';
    f.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9500;display:flex;align-items:center;justify-content:center;padding:16px';
    f.innerHTML = `<div style="background:#fff;border-radius:10px;max-width:760px;width:100%;max-height:92vh;overflow:auto;border-top:5px solid #e7500f;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#222">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 6px;gap:10px">
        <strong style="font-size:16px;color:#565c66">${titolo}</strong>
        <button type="button" data-chiudi style="background:none;border:0;font-size:20px;cursor:pointer;color:#888">✕</button></div>
      <div style="padding:6px 18px 16px">${html}</div></div>`;
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-chiudi]')) chiudi(); });
    document.body.appendChild(f);
    return f;
  }
  function chiudi() { const f = $('dir-finestra'); if (f) f.remove(); }

  /* PERCHÉ esce dal registro (26/09/2026). Il second brain legge ritiro_tipo per
     sapere che cosa fare della task: «risolta» la chiude, «non da mostrare» e
     «doppione» la lasciano aperta. Prima c'era solo un motivo libero, e «già
     risolto» e «non opportuna» finivano nello stesso campo. */
  function chiediRitiro(titolo, predefinito) {
    return new Promise((fine) => {
      let esito = null;
      const opz = [
        ['risolta', 'Già risolta o già decisa', 'la task nel second brain si chiude'],
        ['non_mostrare', 'Non è materia per il Direttore', 'la task resta aperta, solo non la vede lui'],
        ['doppione', 'Doppione di un\'altra questione', 'la task resta legata all\'altra'],
      ];
      const f = finestra(titolo, `<div style="font-size:13px;color:#555;margin-bottom:8px">Perché esce dal registro? Serve al second brain per sapere che cosa fare della task.</div>
        ${opz.map(([v, t, s]) => `<label style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;text-transform:none;letter-spacing:0;font-size:13.5px;font-weight:600;color:#333;cursor:pointer"><input type="radio" name="dir-rit" value="${v}"${v === predefinito ? ' checked' : ''} style="width:18px;height:18px;margin:1px 0 0;accent-color:#e7500f"><span>${t}<br><span style="font-weight:400;color:#777;font-size:12px">${s}</span></span></label>`).join('')}
        <textarea id="dir-rit-motivo" rows="2" placeholder="Due parole su come è andata (facoltativo)" style="width:100%;margin-top:6px;font-size:13px"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button type="button" class="btn-outline btn-sm" data-chiudi>Annulla</button><button type="button" class="btn-primary btn-sm" id="dir-rit-ok">Togli dal registro</button></div>`);
      const oss = new MutationObserver(() => { if (!document.body.contains(f)) { oss.disconnect(); fine(esito); } });
      oss.observe(document.body, { childList: true });
      f.querySelector('#dir-rit-ok').addEventListener('click', () => {
        const scelto = f.querySelector('input[name="dir-rit"]:checked');
        if (!scelto) { avviso('Scegli perché esce dal registro.', 'err'); return; }
        const motivo = f.querySelector('#dir-rit-motivo').value.trim();
        const etichetta = opz.find((o) => o[0] === scelto.value)[1].toLowerCase();
        esito = { ritiro_tipo: scelto.value, ritirata_motivo: motivo || etichetta };
        chiudi();
      });
    });
  }

  function con(btn, fn) {
    return (async () => {
      const t = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Un attimo…'; }
      try { await fn(); } catch (e) { avviso('Non riuscito: ' + (e.message || e), 'err'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = t; } }
    })();
  }

  /* ════════════════════════════════════════════════════════════
     1. CANTIERI CRITICI — le conferme che aspettano il Direttore
     ════════════════════════════════════════════════════════════ */
  async function inAttesa() {
    const { data, error } = await window.sb.rpc('s_direzione_in_attesa');
    if (error) throw new Error(error.message);
    return data || { autorizzazioni: [], critici: [] };
  }

  function boxCritici(host, critici, errore) {
    if (!host) return;
    if (errore) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>⚠️ Cantieri critici — conferme richieste</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere le conferme richieste: ${esc(errore)}</p></div>`;
      return;
    }
    if (!critici.length) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #95C22F"><h3>⚠️ Cantieri critici — conferme richieste</h3><p style="font-size:13px;color:#555;margin:0">Nessuna conferma in attesa.</p></div>`;
      return;
    }
    host.innerHTML = `<div class="card" style="border-left:4px solid #8e44ad"><h3>⚠️ Cantieri critici — <span style="color:#8e44ad">${critici.length} ${critici.length === 1 ? 'conferma richiesta' : 'conferme richieste'}</span></h3>
      <p style="font-size:12.5px;color:#555;margin:0 0 6px">Segnalazioni agli organi di vigilanza su cui la segreteria ha chiesto la tua conferma. Tocca la riga: vedi caso, verbali e cronologia, e rispondi.</p>
      ${critici.map((c) => { const g = giorni(c.dal); return `<div data-crit="${c.id}" data-aiuto="Apre il caso con i verbali del cantiere e la cronologia: da lì rispondi. La risposta resta in cronologia col tuo nome, data e ora." style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd;cursor:pointer">
        <strong style="font-size:12px">n° ${c.id}</strong>
        <span style="font-size:13px;flex:1;min-width:220px"><strong>${esc(c.impresa || '—')}</strong> — ${esc(c.cantiere || '')}</span>
        <span style="font-size:11.5px;color:#888">evento del ${dIt(c.data_evento)}</span>
        <span style="background:#f3e8f8;color:#8e44ad;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${g == null ? 'in attesa' : 'in attesa da ' + g + ' g'}</span>
        <button class="btn-primary btn-sm" type="button">Apri</button></div>`; }).join('')}</div>`;
    host.querySelectorAll('[data-crit]').forEach((r) => r.addEventListener('click', () => apriCritico(Number(r.dataset.crit))));
  }

  async function apriCritico(id) {
    const sb = window.sb;
    const R = await ruoli();
    const [{ data: d, error }, { data: eventi }] = await Promise.all([
      sb.from('s_cantieri_critici').select('*').eq('id', id).maybeSingle(),
      sb.from('s_cantieri_critici_eventi').select('*').eq('critico_id', id).order('created_at'),
    ]);
    if (error || !d) { avviso('Caso non trovato' + (error ? ': ' + error.message : '.'), 'err'); return; }
    let verbali = [];
    if (d.cantiere_id) {
      const r = await sb.from('visite').select('nr_verbale,data_visita,ipc,segnalazione,elimina').eq('cantiere_id', d.cantiere_id).order('data_visita');
      verbali = (r.data || []).filter((v) => !v.elimina);
    }
    const fermo = ['chiuso', 'annullato'].includes(d.stato);
    /* 25/09/2026: la conferma vera è del Direttore (autorizzazione_direttore) o della
       Presidenza (decisione_organo, con «chi» = Presidente/Vicepresidente); chi non è
       né l'uno né l'altra (coordinatore/segreteria, quando apre il caso dalla lista
       automatica delle questioni) vede solo la cronologia: risponde da dove gestisce
       davvero il caso — Zona Coordinatore o l'app segreteria. */
    const perDirettore = R.direttore, perPresidenza = R.presidenza && !R.direttore;
    const miaCarica = S().carica === 'presidente' ? 'Presidente' : S().carica === 'vicepresidente' ? 'Vicepresidente' : null;
    const gia = perDirettore
      ? [...(eventi || [])].reverse().find((e) => e.tipo === 'autorizzazione_direttore')
      : perPresidenza
        ? [...(eventi || [])].reverse().find((e) => e.tipo === 'decisione_organo')
        : null;
    const riga = (k, v) => `<div style="padding:4px 0;border-bottom:1px solid #f2f2f2;font-size:13px"><strong>${k}:</strong> ${v}</div>`;
    const azioni = fermo ? `<p style="font-size:13px;color:#555">Il caso è ${esc(d.stato)}: non c'è niente da confermare.</p>`
      : perDirettore ? `
        ${gia ? `<p style="font-size:12.5px;color:#555">Hai già risposto: ${esc(gia.testo || '')} Puoi rispondere di nuovo: vale l'ultima.</p>` : ''}
        <p style="font-size:12.5px;color:#555">Se segnalare lo decidono la Presidenza e la Commissione Sicurezza; qui dai la tua conferma. Resta in cronologia col tuo nome, data e ora. La segnalazione la prepara poi la segreteria.</p>
        <label style="font-size:12px">Una nota (facoltativa)</label><textarea id="dir-cd-nota" rows="3" style="width:100%;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="btn-outline btn-sm" id="dir-cd-no" data-aiuto="Registra in cronologia che NON confermi la segnalazione agli organi di vigilanza. La segreteria lo vede nel caso.">⛔ Non confermo</button>
          <button type="button" class="btn-primary btn-sm" id="dir-cd-si" data-aiuto="Registra in cronologia che CONFERMI la segnalazione a SPISAL / ITL. Da qui la segreteria prepara e protocolla la lettera.">✅ Confermo la segnalazione</button>
          <button type="button" class="btn-outline btn-sm" id="dir-cd-pres" data-aiuto="Coinvolge anche Presidente e Vicepresidente: ricevono un avviso e rispondono dall'app come te. Utile se non riesci a risolvere da solo, o se preferisci decidano loro.">🏛 Coinvolgo la Presidenza</button></div>`
      : perPresidenza ? `
        ${gia ? `<p style="font-size:12.5px;color:#555">Hai già risposto (${esc(miaCarica || 'Presidenza')}): ${esc(gia.testo || '')} Puoi rispondere di nuovo: vale l'ultima.</p>` : ''}
        <p style="font-size:12.5px;color:#555">Decidi tu se segnalare agli organi di vigilanza: resta in cronologia col tuo nome (${esc(miaCarica || 'Presidenza')}), data e ora. Il Direttore vede la tua decisione e conferma.</p>
        <label style="font-size:12px">Una nota (facoltativa)</label><textarea id="dir-cd-nota" rows="3" style="width:100%;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">
          <button type="button" class="btn-outline btn-sm" id="dir-cd-no" data-aiuto="Registra in cronologia che decidi di NON segnalare agli organi di vigilanza.">⛔ Decido di non segnalare</button>
          <button type="button" class="btn-primary btn-sm" id="dir-cd-si" data-aiuto="Registra in cronologia che decidi di SEGNALARE agli organi di vigilanza. Il Direttore la vede e conferma.">✅ Decido di segnalare</button></div>`
      : '<p style="font-size:12.5px;color:#555">Si risponde da dove si gestisce il caso (Zona Coordinatore o app segreteria): qui solo la cronologia.</p>';
    finestra(`⚠️ Cantiere critico n° ${d.id} — conferma della segnalazione`, `
      ${riga('Cantiere', esc(d.cantiere_desc))}
      ${riga('Impresa', esc(d.impresa_nome))}
      ${riga('Evento', dIt(d.data_evento) + ' · tecnico: ' + esc(d.tecnico_nome || '—'))}
      <div style="padding:4px 0;border-bottom:1px solid #f2f2f2;font-size:13px;white-space:pre-wrap"><strong>Note del tecnico:</strong>\n${esc(d.note)}</div>
      ${verbali.length ? riga('Verbali sul cantiere', '<br>' + verbali.map((v) => `${esc(v.nr_verbale)} del ${dIt(v.data_visita)}${v.ipc ? ` — IPC ${esc(v.ipc)}` : ''}${v.segnalazione ? ' — <strong>il tecnico propone la segnalazione</strong>' : ''}`).join('<br>')) : ''}
      <div style="font-weight:600;margin:10px 0 4px">Cronologia</div>
      ${(eventi || []).filter((e) => e.tipo !== 'stato').map((e) => `<div style="font-size:12.5px;padding:3px 0;white-space:pre-wrap"><span style="color:#888">${oraIt(e.created_at)}</span> <strong>${esc(EV_CRIT[e.tipo] || e.tipo)}</strong>${e.testo ? ' — ' + esc(e.testo) : ''}</div>`).join('') || '<p style="color:#888;font-size:12.5px">Ancora niente.</p>'}
      <hr style="margin:10px 0;border:0;border-top:1px solid #eee">
      ${azioni}`);
    const rispondi = (btn, cosa) => con(btn, async () => {
      const domanda = perDirettore
        ? (cosa === 'segnalare' ? 'CONFERMI la segnalazione agli organi di vigilanza per questo cantiere?' : 'NON confermi la segnalazione?')
        : (cosa === 'segnalare' ? 'DECIDI di segnalare agli organi di vigilanza per questo cantiere?' : 'DECIDI di non segnalare?');
      if (!confirm(domanda)) return;
      const { error: e } = perDirettore
        ? await sb.rpc('s_critico_conferma_direttore', { p_id: d.id, p_cosa: cosa, p_nota: ($('dir-cd-nota').value || '').trim() || null })
        : await sb.rpc('s_critico_decide_presidenza', { p_id: d.id, p_cosa: cosa, p_nota: ($('dir-cd-nota').value || '').trim() || null });
      if (e) throw new Error(e.message);
      avviso('Registrato in cronologia.' + (perDirettore ? ' La segreteria lo vede nel caso.' : ' Il Direttore lo vede e conferma.'), 'ok');
      chiudi();
      carica();
    });
    const si = $('dir-cd-si'), no = $('dir-cd-no');
    if (si) si.addEventListener('click', (ev) => rispondi(ev.currentTarget, 'segnalare'));
    if (no) no.addEventListener('click', (ev) => rispondi(ev.currentTarget, 'non_segnalare'));
    const coinvolgi = $('dir-cd-pres');
    if (coinvolgi) coinvolgi.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      if (!confirm('Coinvolgo la Presidenza: Presidente e Vicepresidente ricevono un avviso e trovano il caso nella loro pagina. Procedo?')) return;
      const { error: e } = await sb.rpc('s_critico_coinvolgi_presidenza', { p_id: d.id, p_nota: null });
      if (e) throw new Error(e.message);
      avviso('Presidenza coinvolta: hanno ricevuto un avviso nell\'app.', 'ok');
      chiudi();
      carica();
    }));
  }

  /* ════════════════════════════════════════════════════════════
     2. IL REGISTRO DELLE QUESTIONI IN ATTESA DI DECISIONE
     modo: 'direzione' (chi decide risponde) | 'coord' (chi apre gestisce)
     ════════════════════════════════════════════════════════════ */
  async function decisioniBox(host, modo) {
    if (!host) return { attesa: 0, daPrendere: 0 };
    const sb = window.sb;
    const R = await ruoli();
    let righe = [], auto = { autorizzazioni: [], critici: [] }, errore = null;
    try {
      const { data, error } = await sb.from('s_decisioni').select('*').in('stato', ['proposta', 'aperta', 'rinviata', 'decisa', 'incontro']).order('aperta_il');
      if (error) throw new Error(error.message);
      righe = data || [];
      if (R.direttore || R.coord || R.segr) { try { auto = await inAttesa(); } catch (e) { console.warn('in attesa:', e); } }
    } catch (e) { errore = e.message || String(e); }
    if (errore) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>📋 Questioni in attesa di decisione</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere il registro: ${esc(errore)}</p></div>`;
      return { attesa: 0, daPrendere: 0 };
    }
    const T = oggi();
    // una lista sola: automatiche + manuali, ordinate per giorni di attesa
    const lista = [];
    (auto.autorizzazioni || []).forEach((a) => lista.push({ k: 'auto', gg: giorni(a.dal), testo: `Autorizzazione: ${a.tipo} n° ${a.progressivo != null ? a.progressivo : 'm' + a.id} · ${a.chi}`, chi: 'segreteria', decisore: 'direttore', link: a.link, dal: a.dal }));
    (auto.critici || []).forEach((c) => lista.push({ k: 'auto', gg: giorni(c.dal), testo: `Conferma della segnalazione agli organi di vigilanza: ${c.impresa || '—'} — ${c.cantiere || ''}`, chi: 'segreteria', decisore: 'direttore', critico: c.id, dal: c.dal }));
    const aperte = righe.filter((r) => r.stato === 'aperta' || (r.stato === 'rinviata' && r.rinviata_al && r.rinviata_al <= T));
    const rinviate = righe.filter((r) => r.stato === 'rinviata' && r.rinviata_al && r.rinviata_al > T);
    const decise = righe.filter((r) => r.stato === 'decisa');
    const incontri = righe.filter((r) => r.stato === 'incontro');
    aperte.forEach((r) => lista.push({ k: 'man', gg: giorni(r.aperta_il), r, testo: r.questione, chi: r.aperta_da_nome || r.aperta_da, decisore: r.decisore, link: r.link, dal: r.aperta_il }));
    const altaDi = (x) => (x.r && x.r.priorita === 'alta' ? 0 : 1);
    const entroDi = (x) => (x.r && x.r.entro_il) || '9999-12-31';
    const ORD = {
      prio: (a, b) => altaDi(a) - altaDi(b) || (b.gg || 0) - (a.gg || 0),
      n: (a, b) => ((a.r && a.r.id) || 0) - ((b.r && b.r.id) || 0),
      t: (a, b) => String(a.testo || '').localeCompare(String(b.testo || ''), 'it'),
      e: (a, b) => entroDi(a).localeCompare(entroDi(b)) || (b.gg || 0) - (a.gg || 0),
      g: (a, b) => (b.gg || 0) - (a.gg || 0),
    };
    lista.sort(ORD[_ordQ] || ORD.prio);
    const scadutaDi = (x) => !!(x.r && x.r.entro_il && x.r.entro_il < T);
    const nAlta = lista.filter((x) => altaDi(x) === 0).length, nScad = lista.filter(scadutaDi).length;
    if ((_filtroQ === 'alta' && !nAlta) || (_filtroQ === 'scadute' && !nScad)) _filtroQ = 'tutte';
    const pc = _pc();
    _ultimoQ = { host, modo }; _pcPrima = pc;
    const vista = lista.filter((x) => _filtroQ === 'alta' ? altaDi(x) === 0 : _filtroQ === 'scadute' ? scadutaDi(x) : true);

    const puoRispondere = (dec) => (dec === 'direttore' && R.direttore) || (dec === 'presidenza' && R.presidenza) || (dec === 'commissione' && (R.coord || R.segr));
    const gestisce = R.coord || R.segr;
    const eta = (gg) => `<span style="display:inline-block;min-width:74px;text-align:center;border-radius:6px;padding:2px 8px;font-size:11.5px;font-weight:700;background:${gg == null ? '#f0f0f3' : gg >= 30 ? '#fdeaea' : gg >= 10 ? '#fff3e0' : '#eef7e6'};color:${gg == null ? '#666' : gg >= 30 ? '#c0392b' : gg >= 10 ? '#b35c00' : '#2d7a06'}" title="giorni di attesa">${gg == null ? '—' : gg + ' g'}</span>`;
    const chiCorto = (c) => String(c || '—').replace(/\s*\(dal vault\)/, '').replace(/^Segreteria Area Sicurezza$/, 'Segreteria');
    const decBadge = (d) => `<span style="font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;color:#888">${esc(DECISORI[d] || d)}</span>`;

    /* LA RIGA (26/09/2026, proposta B scelta dall'utente: «elenco che si apre»).
       Chiusa: titolo su due righe al massimo, una riga di dati (priorità alta,
       scadenza, giorni di attesa in grigio), barra rossa a sinistra se la priorità
       è alta. Un tocco la apre: riassunto, chi l'ha aperta, cronologia e i
       pulsanti. I giorni sono un dato, non un allarme: niente pillole colorate. */
    const rigaHtml = (x, i) => {
      const r = x.r;
      const id = r ? String(r.id) : 'a' + i;
      const apertaQ = _aperteQ.has(id);
      const alta = !!(r && r.priorita === 'alta');
      const apri = x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener" class="btn-outline btn-sm" style="text-decoration:none" data-aiuto="Apre la pratica nell'app che la gestisce, con lo stesso accesso.">Apri la pratica ↗</a>` : '';
      const critico = x.critico ? `<button type="button" class="btn-primary btn-sm" data-crit-apri="${x.critico}" data-aiuto="Apre il caso critico: verbali, cronologia e i pulsanti «Confermo» / «Non confermo».">Apri il caso</button>` : '';
      const azioni = [];
      if (r && puoRispondere(r.decisore)) {
        azioni.push(`<button type="button" class="btn-primary btn-sm" data-rispondi="${r.id}" data-aiuto="Apre due righe per scrivere la decisione: resta col tuo nome, data e ora, e chi ha aperto la questione riceve un avviso.">✅ Decidi</button>`);
        azioni.push(`<button type="button" class="btn-outline btn-sm" data-rispondi="${r.id}" data-rinvia="1" data-aiuto="Rinvia la questione a una data: fino a quel giorno non compare fra quelle in attesa, poi torna con i giorni contati da quando è stata aperta.">⏳ Rinvia</button>`);
      }
      if (r && gestisce) azioni.push(`<button type="button" class="btn-outline btn-sm" data-gestisci="${r.id}" data-aiuto="Apre le tre cose che spettano a ufficio e coordinatore: la priorità, il titolo, il ritiro dal registro.">Gestisci ▾</button>`);
      const scad = r && r.entro_il ? (r.entro_il < T ? `<span style="color:#b35c00;font-weight:600">scaduta il ${dIt(r.entro_il)}</span>` : `entro il ${dIt(r.entro_il)}`) : '';
      const rinv = r && r.stato === 'rinviata' ? `<span style="color:#8e44ad">rinviata al ${dIt(r.rinviata_al)}</span>` : '';
      const meta = [alta ? '<span class="dq-chip dq-alta" title="priorità alta, impostata da ufficio o coordinatore">alta</span>' : '', x.k === 'auto' ? '<span class="dq-chip dq-auto" title="riga che il database ricava da sola dalle pratiche">automatica</span>' : '', scad, rinv, x.gg != null ? `${x.gg} g di attesa` : ''].filter(Boolean).join(' · ');
      const riservata = r && r.riservata ? ' <span title="riservata: la vedono Direttore e coordinatore" style="font-size:11px">🔒</span>' : '';
      /* il riassunto: il dettaglio, tolta la parte che ripete il titolo (le
         questioni importate dal second brain hanno il titolo in testa al dettaglio) */
      let riass = r && r.dettaglio ? String(r.dettaglio).trim() : '';
      const tit = r ? String(r.questione || '').trim() : '';
      if (riass && tit && riass.startsWith(tit)) riass = riass.slice(tit.length).replace(/^[\s—–-]+/, '');
      if (riass && tit && riass === tit) riass = '';
      const dentro = `${riass ? `<div class="dq-riass">${esc(riass)}</div>` : ''}
          <div class="dq-meta2">${decBadge(x.decisore)} · aperta ${x.dal ? 'il ' + dIt(x.dal) : ''} da ${esc(x.chi || '—')}${r && r.riguarda ? ' · riguarda: ' + esc(r.riguarda) : ''}${r ? ` · <a href="#" data-cron="${r.id}" style="color:#888">cronologia</a>` : ''}</div>
          <div class="dq-azioni">${apri}${critico}${azioni.join('')}</div>
          <div id="dir-menu-${id}"></div>
          <div id="dir-risp-${id}"></div>`;
      if (pc) {
        const sel = id === _selQ;
        return {
          voce: `<div class="dq-voce dq-voce-pc${alta ? ' dq-alta-b' : ''}${sel ? ' dq-on' : ''}" data-sel-q="${id}" data-aiuto="Un clic mostra a destra la questione per intero, con i pulsanti.">
        <div class="dq-titolo dq-clamp">${esc(x.testo)}${riservata}</div>
        <div class="dq-meta">${meta}</div></div>`,
          pannello: `<div class="dq-pannello" data-pannello-q="${id}"${sel ? '' : ' hidden'}>
        <div class="dq-pan-n">${r ? 'Questione n° ' + r.id : 'Riga automatica, dalle pratiche'}</div>
        <h4 class="dq-pan-t">${esc(x.testo)}${riservata}</h4>
        <div class="dq-meta">${meta}</div>
        ${dentro}</div>`,
        };
      }
      return `<div class="dq-voce${alta ? ' dq-alta-b' : ''}${apertaQ ? ' dq-aperta' : ''}" data-apri-q="${id}" data-aiuto="Un tocco apre la questione: riassunto, chi l'ha aperta e i pulsanti. Un altro la chiude.">
        <div class="dq-riga1"><div class="dq-titolo${apertaQ ? '' : ' dq-clamp'}">${esc(x.testo)}${riservata}</div><span class="dq-freccia">▾</span></div>
        <div class="dq-meta">${meta}</div>
        <div class="dq-dett"${apertaQ ? '' : ' hidden'}>
          ${dentro}
        </div></div>`;
    };
    const idDi = (x, i) => (x.r ? String(x.r.id) : 'a' + i);
    if (pc && !vista.some((x, i) => idDi(x, i) === _selQ)) _selQ = vista.length ? idDi(vista[0], 0) : null;
    const pezzi = vista.map(rigaHtml);
    const rigaDecisa = (r) => `<div data-dec-decisa="1" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd">
        <span style="background:#e8f5e0;color:#2d7a06;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">DECISA</span>
        <div style="flex:1;min-width:240px;font-size:13px;line-height:1.4"><div>${esc(r.questione)}${r.riservata ? ' 🔒' : ''}</div>
          <div style="white-space:pre-wrap;color:#333;margin-top:2px"><strong>${esc(r.decisa_da || '')}</strong> il ${oraIt(r.decisa_il)}: ${esc(r.decisione || '')}</div>
          <div style="font-size:11.5px;color:#888">${decBadge(r.decisore)} · aperta il ${dIt(r.aperta_il)} da ${esc(r.aperta_da_nome || r.aperta_da)} · <a href="#" data-cron="${r.id}" style="color:#888">cronologia</a></div></div>
        ${gestisce ? `<button type="button" class="btn-primary btn-sm" data-presa="${r.id}" data-aiuto="Dichiara che la decisione è stata letta e messa in pratica: la riga esce dal registro e resta in cronologia con chi l'ha presa in carico e quando.">✓ Presa in carico</button>` : ''}</div>`;
    const rigaIncontro = (r) => `<div data-dec-incontro="1" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd">
        <span style="background:#f3e8f8;color:#8e44ad;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">📅 INCONTRO PROPOSTO</span>
        <div style="flex:1;min-width:240px;font-size:13px;line-height:1.4"><div>${esc(r.questione)}${r.riservata ? ' 🔒' : ''}${r.priorita === 'alta' ? ' <span style="background:#fdeaea;color:#c0392b;border-radius:6px;padding:1px 7px;font-size:10.5px;font-weight:700">⚠️ ALTA</span>' : ''}</div>
          <div style="white-space:pre-wrap;color:#333;margin-top:2px"><strong>${esc(r.decisa_da || '')}</strong> il ${oraIt(r.decisa_il)}${r.incontro_data ? `: propone il <strong>${dIt(r.incontro_data)}</strong>` : ''}${r.decisione ? (r.incontro_data ? ' — ' : ': ') + esc(r.decisione) : ''}</div>
          <div style="font-size:11.5px;color:#888">${decBadge(r.decisore)} · aperta il ${dIt(r.aperta_il)} da ${esc(r.aperta_da_nome || r.aperta_da)} · <a href="#" data-cron="${r.id}" style="color:#888">cronologia</a></div></div>
        ${gestisce ? `<button type="button" class="btn-primary btn-sm" data-presa="${r.id}" data-aiuto="Segna che l'incontro si è tenuto (o che la questione è comunque chiusa): la riga esce dal registro e resta in cronologia.">✓ Incontro fatto</button>` : ''}</div>`;

    const nuova = gestisce && modo === 'coord' ? `<div style="margin:6px 0 10px"><button type="button" class="btn-primary btn-sm" id="dir-nuova" data-aiuto="Apre il modulo per scrivere una questione che aspetta una decisione del Direttore, della Presidenza o della Commissione. Da quel momento conta i giorni di attesa.">➕ Nuova questione</button><div id="dir-nuova-form"></div></div>` : '';

    /* LE PROPOSTE (25/09/2026, chiesto dall'utente): le task del second brain che
       aspettano il Direttore entrano qui come proposte, che vede SOLO la segreteria.
       Una casella per riga: spuntata = la questione diventa visibile a Direttore e
       coordinatore; «✕» la scarta scrivendo perché. Così nel registro va solo ciò
       che la segreteria ritiene opportuno, anche se la task l'ha scritta altri. */
    const proposte = R.segr && modo === 'coord' ? righe.filter((r) => r.stato === 'proposta') : [];
    const rigaProposta = (r) => `<div data-prop="${r.id}" style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #e9eef3">
        <label style="display:inline-flex;align-items:center;gap:6px;margin:2px 0 0;text-transform:none;letter-spacing:0;font-size:12px;font-weight:600;color:#456;cursor:pointer"><input type="checkbox" data-pub="${r.id}" style="width:18px;height:18px;margin:0;accent-color:#e7500f" data-aiuto="Spuntando, la questione diventa visibile a Direttore e coordinatore e conta i giorni dalla data indicata. Fino ad allora la vedi solo tu."> rendi visibile</label>
        <div style="flex:1;min-width:240px;font-size:13px;line-height:1.4">
          <div data-testo>${esc(r.questione)}</div>
          <div style="font-size:11.5px;color:#888">${esc(r.riguarda || '')}${r.entro_il ? ' · entro il ' + dIt(r.entro_il) : ''} · in attesa dal <input type="date" data-dal="${r.id}" value="${esc(r.aperta_il || '')}" style="width:auto;font-size:11.5px;padding:1px 4px" data-aiuto="La data da cui la questione aspetta: da qui si contano i giorni. Correggila se quella letta dalla task è sbagliata."> (${giorni(r.aperta_il) != null ? giorni(r.aperta_il) + ' g' : '—'})</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn-outline btn-sm" data-modifica="${r.id}" data-aiuto="Riscrive il testo della questione prima di renderla visibile: la task del second brain resta com'è.">✏️</button>
          <button type="button" class="btn-outline btn-sm" data-scarta="${r.id}" data-aiuto="Scarta la proposta scegliendo perché: se è già risolta il second brain chiude la task; se non è materia per il Direttore o è un doppione, la task resta aperta. Non viene riproposta.">✕ Scarta</button></div></div>`;
    const boxProposte = proposte.length ? `<details open style="margin:8px 0 12px;padding:8px 12px;border:1px solid #d6e0ea;border-radius:8px;background:#f5f8fb">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:#345">📥 Proposte da spuntare — ${proposte.length} task del second brain che aspettano il Direttore <span style="font-weight:400;color:#678">(le vedi solo tu: spunta quelle da rendere visibili, scarta le altre)</span></summary>
        ${proposte.map(rigaProposta).join('')}</details>` : (R.segr && modo === 'coord' ? '<p style="font-size:12px;color:#888;margin:4px 0 10px">📥 Nessuna proposta da spuntare: le task del second brain che aspettano il Direttore arrivano qui tre volte al giorno.</p>' : '');
    const intro = modo === 'coord'
      ? 'Quello che aspetta una decisione di Direttore, Presidenza o Commissione Sicurezza. Le righe <em>automatiche</em> vengono dalle pratiche (autorizzazioni, conferme sui cantieri critici); le altre le scrivete voi. Si ordina per giorni di attesa.'
      : 'Quello che aspetta una tua decisione, ordinato per giorni di attesa. Le righe <em>automatiche</em> vengono dalle pratiche; le altre le hanno scritte coordinatore e segreteria. Rispondi qui: decidi, oppure rinvia a una data.';
    host.innerHTML = `<div class="card" style="border-left:4px solid #e7500f">
      <h3>📋 Questioni in attesa di decisione ${lista.length ? `<span style="color:#b35c00">— ${lista.length} in attesa</span>` : '<span style="color:#2d7a06">— niente in attesa</span>'}</h3>
      <p style="font-size:12.5px;color:#555;margin:0 0 6px">${intro}</p>
      ${nuova}
      ${boxProposte}
      ${lista.length ? `<div class="dq-filtri">${[['tutte', 'Tutte', lista.length], ['alta', 'Alta priorità', nAlta], ['scadute', 'Scadute', nScad]].filter((f) => f[0] === 'tutte' || f[2]).map(([v, t, n]) => `<button type="button" class="dq-filtro${_filtroQ === v ? ' on' : ''}" data-filtroq="${v}" data-aiuto="Mostra solo queste questioni; «Tutte» le rimette tutte.">${t} <b>${n}</b></button>`).join('')}</div>
` : ''}
      ${!vista.length ? '<p style="font-size:13px;color:#555;margin:6px 0 0">Nessuna questione aperta.</p>'
        : pc ? `<div class="dq-split"><div class="dq-lista">${pezzi.map((p) => p.voce).join('')}</div><div class="dq-destra">${pezzi.map((p) => p.pannello).join('')}</div></div>`
        : pezzi.join('')}
      ${decise.length ? `<div style="font-size:12px;font-weight:600;color:#565c66;margin-top:12px">Decise, ${gestisce ? 'da prendere in carico' : 'in attesa che l\'ufficio le prenda in carico'} (${decise.length})</div>${decise.map(rigaDecisa).join('')}` : ''}
      ${incontri.length ? `<div style="font-size:12px;font-weight:600;color:#565c66;margin-top:12px">Incontro proposto (${incontri.length})</div>${incontri.map(rigaIncontro).join('')}` : ''}
      ${rinviate.length ? `<div style="font-size:12px;font-weight:600;color:#565c66;margin-top:12px">Rinviate (${rinviate.length})</div>${rinviate.map((r) => `<div style="font-size:12.5px;color:#666;padding:5px 0;border-top:1px solid #f0e6dd">⏳ <strong>al ${dIt(r.rinviata_al)}</strong> — ${esc(r.questione)}${r.decisione ? ` <span style="color:#888">(${esc(r.decisione)})</span>` : ''} · ${decBadge(r.decisore)}</div>`).join('')}` : ''}
    </div>`;

    /* sul PC: il clic su una voce la mostra a destra, senza ricaricare */
    host.querySelectorAll('[data-sel-q]').forEach((v) => v.addEventListener('click', () => {
      _selQ = v.dataset.selQ;
      host.querySelectorAll('[data-sel-q]').forEach((w) => w.classList.toggle('dq-on', w === v));
      host.querySelectorAll('[data-pannello-q]').forEach((p) => { p.hidden = p.dataset.pannelloQ !== _selQ; });
    }));
    host.querySelectorAll('[data-filtroq]').forEach((b) => b.addEventListener('click', () => { _filtroQ = b.dataset.filtroq; decisioniBox(host, modo); }));
    host.querySelectorAll('[data-crit-apri]').forEach((b) => b.addEventListener('click', () => apriCritico(Number(b.dataset.critApri))));
    host.querySelectorAll('[data-cron]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); cronologia(Number(a.dataset.cron)); }));
    /* il tocco sulla riga la apre o la chiude; i pulsanti e i link dentro non la chiudono */
    host.querySelectorAll('[data-apri-q]').forEach((v) => v.addEventListener('click', (e) => {
      if (e.target.closest('.dq-dett, button, a, select, input, textarea, label')) return;
      const id = v.dataset.apriQ; const aperta = v.classList.toggle('dq-aperta');
      if (aperta) _aperteQ.add(id); else _aperteQ.delete(id);
      const d = v.querySelector('.dq-dett'); if (d) d.hidden = !aperta;
      const t = v.querySelector('.dq-titolo'); if (t) t.classList.toggle('dq-clamp', !aperta);
    }));
    host.querySelectorAll('[data-rispondi]').forEach((b) => b.addEventListener('click', () => formRisposta(Number(b.dataset.rispondi), host, modo, b.dataset.rinvia ? 'rinvio' : 'decido')));
    /* «Gestisci» (26/09/2026, al posto di «Ritira»): priorità, titolo, ritiro */
    host.querySelectorAll('[data-gestisci]').forEach((b) => b.addEventListener('click', () => {
      const id = Number(b.dataset.gestisci); const r = righe.find((q) => q.id === id); const slot = $('dir-menu-' + id);
      if (!slot || !r) return;
      if (slot.innerHTML) { slot.innerHTML = ''; return; }
      slot.innerHTML = `<div class="dq-menu">
        <button type="button" data-m="prio" data-aiuto="Cambia il grado di priorità: la «alta» mette la barra rossa e l'etichetta. Lo imposta l'ufficio o il coordinatore, mai chi decide.">${r.priorita === 'alta' ? '⬇️ Priorità: da alta a normale' : '⬆️ Priorità: da normale ad alta'}</button>
        <button type="button" data-m="titolo" data-aiuto="Riscrive il titolo della questione, in una riga. Il riassunto sotto resta com'è.">✏️ Modifica il titolo</button>
        <button type="button" data-m="ritira" data-aiuto="Toglie la questione dal registro scegliendo perché: «già risolta» chiude anche la task nel second brain, le altre la lasciano aperta. Resta in cronologia come ritirata.">🗑 Ritira dal registro</button></div>`;
      slot.querySelector('[data-m="prio"]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
        const { error } = await sb.from('s_decisioni').update({ priorita: r.priorita === 'alta' ? 'normale' : 'alta' }).eq('id', id);
        if (error) throw new Error(error.message);
        avviso('Priorità aggiornata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
      }));
      slot.querySelector('[data-m="titolo"]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
        const nuovo = prompt('Il titolo della questione (una riga, breve):', r.questione || '');
        if (nuovo == null || !nuovo.trim()) return;
        const { error } = await sb.from('s_decisioni').update({ questione: nuovo.trim().slice(0, 240) }).eq('id', id);
        if (error) throw new Error(error.message);
        avviso('Titolo aggiornato.', 'ok'); await decisioniBox(host, modo);
      }));
      slot.querySelector('[data-m="ritira"]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
        const rit = await chiediRitiro('Togli dal registro la questione n° ' + id, 'risolta');
        if (!rit) return;
        const { error } = await sb.from('s_decisioni').update({ stato: 'ritirata', ...rit }).eq('id', id);
        if (error) throw new Error(error.message);
        avviso('Questione ritirata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
      }));
    }));
    host.querySelectorAll('[data-ritira]').forEach((b) => b.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const rit = await chiediRitiro('Togli dal registro la questione n° ' + b.dataset.ritira, 'risolta');
      if (!rit) return;
      const { error } = await sb.from('s_decisioni').update({ stato: 'ritirata', ...rit }).eq('id', Number(b.dataset.ritira));
      if (error) throw new Error(error.message);
      avviso('Questione ritirata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    })));
    host.querySelectorAll('[data-prio]').forEach((sel) => sel.addEventListener('change', async () => {
      const id = Number(sel.dataset.prio);
      const { error } = await sb.from('s_decisioni').update({ priorita: sel.value }).eq('id', id);
      if (error) { avviso('Non riuscito: ' + error.message, 'err'); return; }
      avviso('Priorità aggiornata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
    host.querySelectorAll('[data-presa]').forEach((b) => b.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const { error } = await sb.from('s_decisioni').update({ stato: 'chiusa' }).eq('id', Number(b.dataset.presa));
      if (error) throw new Error(error.message);
      avviso('Presa in carico: la decisione resta in cronologia.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    })));
    const bn = $('dir-nuova'); if (bn) bn.addEventListener('click', () => formNuova(host, modo, R));
    /* le proposte: spunta, correggi, scarta */
    host.querySelectorAll('[data-pub]').forEach((cb) => cb.addEventListener('change', async () => {
      if (!cb.checked) return;
      const id = Number(cb.dataset.pub);
      const dal = host.querySelector(`[data-dal="${id}"]`);
      cb.disabled = true;
      const { error } = await sb.from('s_decisioni').update({ stato: 'aperta', aperta_il: (dal && dal.value) || undefined }).eq('id', id);
      if (error) { cb.checked = false; cb.disabled = false; avviso('Non riuscito: ' + error.message, 'err'); return; }
      avviso('Ora la vedono Direttore e coordinatore.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
    host.querySelectorAll('[data-dal]').forEach((inp) => inp.addEventListener('change', async () => {
      const { error } = await sb.from('s_decisioni').update({ aperta_il: inp.value || null }).eq('id', Number(inp.dataset.dal));
      if (error) avviso('Data non salvata: ' + error.message, 'err'); else avviso('Data aggiornata.', 'ok');
    }));
    host.querySelectorAll('[data-modifica]').forEach((b) => b.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const riga = b.closest('[data-prop]'); const attuale = riga ? riga.querySelector('[data-testo]').textContent : '';
      const nuovo = prompt('Il testo della questione (una riga):', attuale);
      if (nuovo == null || !nuovo.trim()) return;
      const { error } = await sb.from('s_decisioni').update({ questione: nuovo.trim().slice(0, 240) }).eq('id', Number(b.dataset.modifica));
      if (error) throw new Error(error.message);
      await decisioniBox(host, modo);
    })));
    host.querySelectorAll('[data-scarta]').forEach((b) => b.addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const rit = await chiediRitiro('Scarta la proposta', null);
      if (!rit) return;
      const { error } = await sb.from('s_decisioni').update({ stato: 'ritirata', ...rit }).eq('id', Number(b.dataset.scarta));
      if (error) throw new Error(error.message);
      avviso('Proposta scartata.', 'ok'); await decisioniBox(host, modo);
    })));
    return { attesa: lista.length, daPrendere: decise.length + incontri.length };
  }

  function formRisposta(id, host, modo, cosa) {
    const slot = $('dir-risp-' + id); if (!slot) return;
    if (slot.innerHTML && !cosa) { slot.innerHTML = ''; return; }
    if (slot.innerHTML && slot.dataset.cosa === cosa) { slot.innerHTML = ''; slot.dataset.cosa = ''; return; }
    slot.dataset.cosa = cosa || '';
    const domani = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const oggiV = oggi();
    slot.innerHTML = `<div style="margin-top:6px;padding:8px;border:1px solid #f0e6dd;border-radius:8px;background:#fffaf6">
      <label style="font-size:12px">La decisione, oppure una nota sul rinvio o sull'incontro</label><textarea id="dir-rt-${id}" rows="3" style="width:100%;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
        <button type="button" class="btn-primary btn-sm" data-decido="${id}" data-aiuto="Registra la decisione col tuo nome, data e ora. Chi ha aperto la questione riceve un avviso e la prende in carico.">✅ Decido</button>
        <span style="font-size:12px;color:#666">oppure, scegliendo una data qui sotto</span>
        <input type="date" id="dir-rd-${id}" min="${domani}" style="width:auto;font-size:12px">
        <button type="button" class="btn-outline btn-sm" data-rinvio="${id}" data-aiuto="Rinvia la questione alla data scelta (deve essere futura): fino a quel giorno non compare fra quelle in attesa, poi torna con i giorni contati da quando è stata aperta.">⏳ Rinvio a questa data</button>
        <input type="date" id="dir-ri-${id}" min="${oggiV}" style="width:auto;font-size:12px">
        <button type="button" class="btn-outline btn-sm" data-incontro="${id}" data-aiuto="Propone un incontro a coordinatore e segreteria per discuterne insieme, invece di decidere subito. La data è facoltativa: puoi anche solo segnalare che serve un incontro. Loro ricevono un avviso.">📅 Propongo un incontro</button>
        <button type="button" class="btn-outline btn-sm" data-annulla="${id}">Annulla</button></div></div>`;
    slot.querySelector('[data-annulla]').addEventListener('click', () => { slot.innerHTML = ''; slot.dataset.cosa = ''; });
    if (cosa === 'rinvio') { const d = $('dir-rd-' + id); if (d) d.focus(); } else { const t = $('dir-rt-' + id); if (t) t.focus(); }
    slot.querySelector('[data-decido]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const testo = ($('dir-rt-' + id).value || '').trim();
      if (!testo) { avviso('Scrivi la decisione.', 'warn'); return; }
      if (!confirm('Registro la decisione col tuo nome, data e ora?')) return;
      const { error } = await window.sb.rpc('s_decisione_rispondi', { p_id: id, p_esito: 'decisa', p_testo: testo });
      if (error) throw new Error(error.message);
      avviso('Decisione registrata.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
    slot.querySelector('[data-rinvio]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const al = $('dir-rd-' + id).value;
      if (!al) { avviso('Scegli la data a cui rinviare.', 'warn'); return; }
      const { error } = await window.sb.rpc('s_decisione_rispondi', { p_id: id, p_esito: 'rinviata', p_testo: ($('dir-rt-' + id).value || '').trim() || null, p_rinvio_al: al });
      if (error) throw new Error(error.message);
      avviso('Rinviata al ' + dIt(al) + '.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
    slot.querySelector('[data-incontro]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const al = $('dir-ri-' + id).value || null;
      if (!confirm('Propongo un incontro a coordinatore e segreteria' + (al ? ' per il ' + dIt(al) : '') + '?')) return;
      const { error } = await window.sb.rpc('s_decisione_rispondi', { p_id: id, p_esito: 'incontro', p_testo: ($('dir-rt-' + id).value || '').trim() || null, p_rinvio_al: al });
      if (error) throw new Error(error.message);
      avviso('Incontro proposto: coordinatore e segreteria hanno ricevuto un avviso.', 'ok'); await decisioniBox(host, modo); dopoCambio();
    }));
  }

  function formNuova(host, modo, R) {
    const slot = $('dir-nuova-form'); if (!slot) return;
    if (slot.innerHTML) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div style="margin-top:8px;padding:10px;border:1px solid #f0e6dd;border-radius:8px;background:#fffaf6;color:#222">
      <label style="font-size:12px">La questione, in una riga *</label><input id="dn-q" maxlength="240" style="width:100%;box-sizing:border-box" placeholder="Es. Si rinnova il contratto del tecnico X per il 2027?">
      <label style="font-size:12px;margin-top:6px">Contesto (facoltativo)</label><textarea id="dn-d" rows="3" style="width:100%;box-sizing:border-box" placeholder="Quello che serve sapere per decidere: fatti, numeri, alternative."></textarea>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:6px">
        <div><label style="font-size:12px">Riguarda</label><input id="dn-r" maxlength="120" style="width:100%;box-sizing:border-box" placeholder="impresa, tecnico, pratica…"></div>
        <div><label style="font-size:12px">Decide</label><select id="dn-dec" style="width:100%"><option value="direttore">Direttore</option><option value="presidenza">Presidenza</option><option value="commissione">Commissione Sicurezza</option></select></div>
        <div><label style="font-size:12px">Priorità</label><select id="dn-p" style="width:100%" data-aiuto="Il grado di priorità della questione: lo decide chi la apre o la gestisce, mai chi deve decidere."><option value="normale">normale</option><option value="alta">alta</option></select></div>
        <div><label style="font-size:12px">Entro il (solo se c'è un termine vero)</label><input type="date" id="dn-e" style="width:100%;box-sizing:border-box"></div>
        <div><label style="font-size:12px">Collegamento (facoltativo)</label><input id="dn-l" style="width:100%;box-sizing:border-box" placeholder="link alla pratica"></div>
      </div>
      ${R.coord ? '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-top:8px;text-transform:none"><input type="checkbox" id="dn-ris" style="width:auto"> 🔒 Riservata (questione sul personale: la vedono solo Direttore e coordinatore)</label>' : ''}
      <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn-primary btn-sm" id="dn-salva" data-aiuto="Mette la questione nel registro: da oggi conta i giorni di attesa e chi decide la vede nella sua pagina.">Apri la questione</button><button type="button" class="btn-outline btn-sm" id="dn-annulla">Annulla</button></div></div>`;
    $('dn-annulla').addEventListener('click', () => { slot.innerHTML = ''; });
    $('dn-salva').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
      const q = ($('dn-q').value || '').trim();
      if (!q) { avviso('Scrivi la questione.', 'warn'); return; }
      const riga = { questione: q, dettaglio: ($('dn-d').value || '').trim() || null, riguarda: ($('dn-r').value || '').trim() || null,
        decisore: $('dn-dec').value, priorita: $('dn-p').value, entro_il: $('dn-e').value || null, link: ($('dn-l').value || '').trim() || null,
        riservata: !!($('dn-ris') && $('dn-ris').checked) };
      const { error } = await window.sb.from('s_decisioni').insert(riga);
      if (error) throw new Error(error.message);
      avviso('Questione aperta: da oggi conta i giorni.', 'ok');
      await decisioniBox(host, modo); dopoCambio();
    }));
  }

  async function cronologia(id) {
    const { data, error } = await window.sb.from('s_decisioni_eventi').select('*').eq('decisione_id', id).order('created_at');
    if (error) { avviso('Non sono riuscito a leggere la cronologia: ' + error.message, 'err'); return; }
    finestra('Cronologia della questione n° ' + id, (data || []).map((e) => `<div style="font-size:13px;padding:5px 0;border-bottom:1px solid #f2f2f2;white-space:pre-wrap"><span style="color:#888">${oraIt(e.created_at)}</span> <strong>${esc(EVENTI[e.tipo] || e.tipo)}</strong>${e.autore ? ` <span style="color:#888">(${esc(e.autore)})</span>` : ''}${e.testo ? ' — ' + esc(e.testo) : ''}</div>`).join('') || '<p style="color:#888">Ancora niente.</p>');
  }

  /* dopo una modifica al registro: numeri nel menu e nella Zona Coordinatore */
  function dopoCambio() {
    badge().catch(() => {});
    if (typeof window.aggiornaZonaCoord === 'function' && !S().viewer) window.aggiornaZonaCoord().catch(() => {});
  }

  /* ════════════════════════════════════════════════════════════
     3. LA PAGINA «DIREZIONE» (Direttore) / «PRESIDENZA»
     ════════════════════════════════════════════════════════════ */
  async function carica() {
    const R = await ruoli();
    const nome = $('dir-nome'); if (nome) nome.textContent = S().viewerNome || '';
    const intro = $('dir-intro');
    if (intro) intro.textContent = R.direttore
      ? 'Quello che aspetta te: autorizzazioni dei servizi CPT, conferme sui cantieri critici e le questioni aperte da coordinatore e segreteria. La mappa e le statistiche sono nelle altre due schede.'
      : R.presidenza
        ? 'Quello che aspetta te: cantieri critici demandati alla Presidenza e le questioni aperte da coordinatore e segreteria. La mappa e le statistiche sono nelle altre due schede.'
        : 'Le questioni che coordinatore e segreteria hanno aperto per la Presidenza. La mappa e le statistiche sono nelle altre due schede.';
    const aut = $('dir-autorizzazioni'), cri = $('dir-critici');
    if (R.direttore && typeof window.loadAutorizzazioni === 'function') window.loadAutorizzazioni().catch((e) => console.warn('autorizzazioni:', e));
    else if (aut) aut.innerHTML = '';
    if (R.direttore || R.presidenza) {
      try { const a = await inAttesa(); boxCritici(cri, a.critici || []); } catch (e) { boxCritici(cri, [], e.message || String(e)); }
    } else if (cri) cri.innerHTML = '';
    await decisioniBox($('dir-decisioni'), 'direzione');
    badge().catch(() => {});
  }

  /* il numero sul pulsante «Direzione»: tutto ciò che aspetta chi è collegato */
  async function badge() {
    const b = $('nav-dir-badge'); if (!b) return;
    const R = await ruoli();
    if (!(R.direttore || R.presidenza)) { b.style.display = 'none'; return; }
    let n = 0;
    try {
      const T = oggi();
      const { data } = await window.sb.from('s_decisioni').select('id,stato,rinviata_al,decisore').in('stato', ['aperta', 'rinviata']);
      n += (data || []).filter((r) => (r.stato === 'aperta' || (r.rinviata_al && r.rinviata_al <= T)) && ((r.decisore === 'direttore' && R.direttore) || (r.decisore === 'presidenza' && R.presidenza))).length;
      if (R.direttore) { const a = await inAttesa(); n += (a.autorizzazioni || []).length + (a.critici || []).length; }
      else if (R.presidenza) { const a = await inAttesa(); n += (a.critici || []).length; }
    } catch (e) { console.warn('badge direzione:', e); }
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  /* il registro nella Zona Coordinatore (coordinatore e segreteria) */
  async function zonaCoord() {
    const host = $('adm-decisioni'); if (!host) return { attesa: 0, daPrendere: 0 };
    const R = await ruoli();
    if (!(R.coord || R.segr)) { host.innerHTML = ''; return { attesa: 0, daPrendere: 0 }; }
    return decisioniBox(host, 'coord');
  }

  /* ════════════════════════════════════════════════════════════
     4. L'OBIETTIVO DI VISITE DELL'ESERCIZIO (regola CEIV)
     ════════════════════════════════════════════════════════════ */
  let _voe = null;
  async function obiettiviLeggi() {
    const { data, error } = await window.sb.from('visite_obiettivo_esercizio').select('*').order('esercizio');
    if (error) throw new Error(error.message);
    _voe = {}; (data || []).forEach((r) => { _voe[r.esercizio] = r; });
    return _voe;
  }

  /* nella scheda Statistiche: fatte / minimo dell'esercizio scelto */
  async function kpiCeiv(esercizio, fatte) {
    const num = $('k-ceivmin'), pct = $('k-ceivmin-pct'); if (!num) return;
    if (!esercizio) { num.textContent = '–'; pct.textContent = 'scegli un esercizio'; return; }
    try {
      if (!_voe) await obiettiviLeggi();
      const r = _voe[esercizio];
      const min = r ? (r.visite_minime_manuali != null ? r.visite_minime_manuali : r.visite_minime) : null;
      if (min == null) { num.textContent = fatte != null ? String(fatte) : '–'; pct.textContent = 'minimo da impostare (segreteria)'; num.style.color = '#888'; return; }
      const p = fatte != null ? Math.round(fatte / min * 100) : null;
      num.textContent = (fatte != null ? fatte : '–') + ' / ' + min;
      num.style.color = p == null ? '#888' : p >= 100 ? '#2d7a06' : p >= 75 ? '#95C22F' : '#b35c00';
      pct.textContent = (p != null ? p + '% del minimo' : '') + (r.contributi_ceiv != null ? ' · ' + Number(r.contributi_ceiv).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) + ' di contributi' : '');
    } catch (e) { num.textContent = '–'; pct.textContent = 'non sono riuscito a leggere il minimo'; console.warn('kpi ceiv:', e); }
  }

  /* nella Zona Segreteria: i contributi per esercizio */
  async function obiettivi() {
    const host = $('sgr-obiettivi'); if (!host) return;
    const ae = typeof window.annoEdile === 'function' ? window.annoEdile().label : null;
    const [a1, a2] = ae ? ae.split('-').map(Number) : [null, null];
    const eserc = ae ? [`${a1 - 1}-${a2 - 1}`, ae, `${a1 + 1}-${a2 + 1}`] : [];
    let dati = {};
    try { dati = await obiettiviLeggi(); } catch (e) {
      host.innerHTML = `<div class="adm-section"><div class="adm-section-title">🎯 Obiettivo visite dell'esercizio (regola CEIV)</div><p style="font-size:12px;color:#f88">Non sono riuscito a leggere gli obiettivi: ${esc(e.message)}</p></div>`;
      return;
    }
    Object.keys(dati).forEach((k) => { if (!eserc.includes(k)) eserc.push(k); });
    eserc.sort();
    host.innerHTML = `<div class="adm-section">
      <div class="adm-section-title">🎯 Obiettivo visite dell'esercizio (regola CEIV)</div>
      <p style="font-size:12px;color:rgba(255,255,255,.6);margin-bottom:10px">Il numero minimo di visite dell'esercizio (1/10 – 30/9) si calcola sui contributi Cassa Edile: <b>100 visite ogni 50.000 €</b> (quota CPT). Scrivi i contributi e il minimo si calcola da solo; se il CdA fissa un numero diverso, mettilo nella colonna «minimo deciso». Il dato compare nelle Statistiche, anche a Direzione e Consiglio.</p>
      <div style="overflow-x:auto"><table style="font-size:12.5px;border-collapse:collapse;min-width:520px;color:#fff">
        <tr style="text-align:left;color:rgba(255,255,255,.6)"><th style="padding:4px 8px">Esercizio</th><th style="padding:4px 8px">Contributi CEIV (€)</th><th style="padding:4px 8px">Minimo calcolato</th><th style="padding:4px 8px">Minimo deciso dal CdA</th><th style="padding:4px 8px">Note</th><th></th></tr>
        ${eserc.map((e) => { const r = dati[e] || {}; return `<tr data-voe="${esc(e)}">
          <td style="padding:4px 8px;font-weight:600">${esc(e)}${e === ae ? ' <span style="font-size:10px;color:#95C22F">in corso</span>' : ''}</td>
          <td style="padding:4px 8px"><input type="number" step="0.01" min="0" data-c value="${r.contributi_ceiv != null ? r.contributi_ceiv : ''}" style="width:130px;color:#222"></td>
          <td style="padding:4px 8px" data-min>${r.visite_minime != null ? r.visite_minime : '—'}</td>
          <td style="padding:4px 8px"><input type="number" step="1" min="0" data-m value="${r.visite_minime_manuali != null ? r.visite_minime_manuali : ''}" style="width:90px;color:#222"></td>
          <td style="padding:4px 8px"><input data-n value="${esc(r.note || '')}" style="width:180px;color:#222"></td>
          <td style="padding:4px 8px"><button type="button" class="btn-primary btn-sm" data-salva data-aiuto="Salva i contributi dell'esercizio: il minimo di visite si ricalcola da solo e compare nelle Statistiche di tutti.">Salva</button></td></tr>`; }).join('')}
      </table></div></div>`;
    host.querySelectorAll('tr[data-voe]').forEach((tr) => {
      const c = tr.querySelector('[data-c]');
      c.addEventListener('input', () => { const v = parseFloat(c.value); tr.querySelector('[data-min]').textContent = isFinite(v) ? Math.floor(v / 50000 * 100) : '—'; });
      tr.querySelector('[data-salva]').addEventListener('click', (ev) => con(ev.currentTarget, async () => {
        const v = c.value === '' ? null : parseFloat(c.value);
        const m = tr.querySelector('[data-m]').value; const n = tr.querySelector('[data-n]').value.trim();
        const { error } = await window.sb.from('visite_obiettivo_esercizio').upsert({ esercizio: tr.dataset.voe, contributi_ceiv: v, visite_minime_manuali: m === '' ? null : parseInt(m, 10), note: n || null }, { onConflict: 'esercizio' });
        if (error) throw new Error(error.message);
        _voe = null; avviso('Obiettivo salvato per ' + tr.dataset.voe + '.', 'ok'); obiettivi();
      }));
    });
  }

  /* sul telefono la pagina si allargava (25/09/2026, visto dal Direttore): i testi
     delle questioni portano nomi di file lunghi senza spazi, che non vanno a capo e
     spingono la riga oltre lo schermo. Qui si spezzano, e i riquadri non escono. */
  (function stileDirezione() {
    const st = document.createElement('style');
    st.textContent = '#view-direzione,#adm-decisioni{max-width:100%;overflow-x:hidden}'
      + '#dir-autorizzazioni,#dir-critici,#dir-decisioni,#adm-decisioni,#dir-finestra{overflow-wrap:anywhere;word-break:break-word}'
      + '#dir-decisioni .card>div,#adm-decisioni .card>div,#dir-critici .card>div{max-width:100%}'
      + '#dir-decisioni [style*="flex:1"],#adm-decisioni [style*="flex:1"],#dir-critici [style*="flex:1"]{min-width:0!important}'
      + '#dir-decisioni details,#adm-decisioni details{max-width:100%;overflow:hidden}'
      /* l'elenco che si apre (26/09/2026) */
      + '.dq-voce{border-top:1px solid #f0e6dd;padding:9px 6px 9px 10px;border-left:4px solid transparent;cursor:pointer}'
      + '.dq-voce.dq-alta-b{border-left-color:#c0392b}.dq-voce.dq-aperta{background:#fffaf6}'
      + '.dq-riga1{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}'
      + '.dq-titolo{font-size:14.5px;font-weight:600;line-height:1.3;color:#222;flex:1;min-width:0}'
      + '.dq-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
      + '.dq-freccia{color:#999;font-size:12px;flex-shrink:0;margin-top:2px;transition:transform .15s}.dq-aperta .dq-freccia{transform:rotate(180deg)}'
      + '.dq-meta{font-size:12px;color:#888;margin-top:3px}.dq-meta2{font-size:11.5px;color:#888;margin-top:6px}'
      + '.dq-chip{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:5px}'
      + '.dq-alta{background:#fdeaea;color:#c0392b}.dq-auto{background:#fdf0e7;color:#b35c00}'
      + '.dq-dett{margin-top:8px;cursor:default}.dq-riass{font-size:13px;color:#555;line-height:1.45;white-space:pre-wrap}'
      + '.dq-azioni{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}'
      + '.dq-menu{display:flex;flex-direction:column;gap:2px;margin-top:6px;padding:6px;border:1px solid #f0e6dd;border-radius:8px;background:#fff}'
      + '.dq-menu button{text-align:left;background:none;border:0;padding:7px 8px;font-size:13.5px;color:#222;border-radius:6px;cursor:pointer}.dq-menu button:hover{background:#fff3ec}'
      + '.dq-filtri{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 6px}'
      + '.dq-filtro{border:1px solid #d6dade;background:#fff;border-radius:16px;padding:3px 11px;font-size:12.5px;color:#444;cursor:pointer}'
      + '.dq-filtro b{margin-left:3px}.dq-filtro.on{background:#565c66;border-color:#565c66;color:#fff}'
      + '.dq-split{display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);gap:16px;align-items:start;margin-top:6px}'
      + '.dq-lista{max-height:74vh;overflow:auto;border:1px solid #f0e6dd;border-radius:8px;background:#fff}'
      + '.dq-voce-pc{border-top:0;border-bottom:1px solid #f3ece6;padding:9px 10px 9px 12px}'
      + '.dq-voce-pc:hover{background:#fff7f2}.dq-voce-pc.dq-on{background:#fff3ec;border-left-color:#e7500f}'
      + '.dq-voce-pc .dq-titolo{font-size:13.5px}'
      + '.dq-destra{position:sticky;top:10px}'
      + '.dq-pannello{border:1px solid #f0e6dd;border-radius:8px;padding:16px 20px 18px;background:#fff}'
      + '.dq-pan-n{font-size:12px;color:#888}'
      + '.dq-pan-t{font-size:19px;line-height:1.25;margin:4px 0 6px;color:#1d2127;font-weight:600}'
      + '.dq-pannello .dq-riass{font-size:14px;color:#333;background:#fafbfc;border-left:3px solid #e2e5e9;padding:10px 12px;border-radius:4px;margin-top:12px;max-width:820px}'
      + '.dq-pannello .dq-meta2{margin-top:10px}.dq-pannello .dq-azioni{margin-top:14px}'
      + '@media (prefers-reduced-motion:reduce){.dq-freccia{transition:none}}';
    document.head.appendChild(st);
  })();

  window.direzione = { carica, badge, zonaCoord, decisioniBox, obiettivi, kpiCeiv, apriCritico };
})();
