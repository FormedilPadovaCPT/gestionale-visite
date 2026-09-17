/* ============================================================
   CANTIERI CRITICI — il riquadro del coordinatore
   (17/09/2026, deciso dall'utente)

   Il coordinatore lavora dal gestionale visite, non entra nell'app
   Segreteria: senza questo riquadro un accesso negato o una proposta
   di segnalazione a SPISAL / ITL li vedrebbe solo se qualcuno glieli
   gira per mail. Sta nella ZONA COORDINATORE, sotto le fatture da
   approvare (tutte e due spostate lì dalla Dashboard il 17/09/2026:
   la Dashboard resta del lavoro da tecnico); lo vedono il coordinatore
   e la segreteria. Perché non restino lì senza che nessuno le guardi,
   in Dashboard compare una riga d'avviso e il pulsante «Coordinatore»
   del menu porta il numero delle cose in attesa.

   Che cosa fa da qui:
   · legge il caso: note del tecnico, persona presente, verbali del
     cantiere con l'IPC, cronologia;
   · scrive la RISPOSTA AL TECNICO (la stessa «risposta dell'ufficio»
     dell'app Segreteria: il tecnico la legge nel suo elenco);
   · registra una DECISIONE — ulteriore visita, proporre una conferenza
     di cantiere, demandare a Presidenza / Commissione Sicurezza;
   · scrive il TESTO DI MERITO della segnalazione agli organi di
     vigilanza: la segreteria lo ritrova già nella maschera «Segnala a
     SPISAL / ITL». Se segnalare lo decidono Presidenza e Commissione,
     il Direttore conferma: qui si prepara il merito, non si decide.
   Lettere, protocolli e invii restano alla segreteria.

   Tabelle s_cantieri_critici e s_cantieri_critici_eventi (SQL in
   segreteria-app/supabase/sql/2026_09_17_cantieri_critici.sql).
   Script classico come diniego-accesso.js: usa window.sb, window.S e
   window.toast del modulo principale.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oraIt = (ts) => (ts ? new Date(ts).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));

  const STATI = { nuovo: ['#e7500f', 'nuovo'], in_gestione: ['#D9A400', 'in gestione'], attesa_impresa: ['#2980b9', "in attesa dell'impresa"],
    attesa_decisione: ['#8e44ad', 'in attesa di decisione'], chiuso: ['#27ae60', 'chiuso'] };
  const ORIGINI = { accesso_negato: ['&#128683;', 'Accesso negato'], proposta_segnalazione: ['&#9888;&#65039;', 'Proposta di segnalazione SPISAL / ITL'], manuale: ['&#128221;', "Aperto dall'ufficio"] };
  const MOTIVI = { rifiutato: "una persona ha negato l'accesso", nessuno_presente: 'cantiere chiuso o nessuno presente', altro: 'altro' };
  const DECISIONI = {
    visita: 'Ulteriore visita',
    conferenza: "Proporre all'impresa una conferenza di cantiere",
    demanda: 'Demandare a Presidenza / Commissione Sicurezza',
    altro: 'Altro',
  };
  const EVENTI = { apertura: 'Apertura', stato: 'Stato', nota: 'Nota', lettera_impresa: "Comunicazione all'impresa", sollecito: 'Sollecito',
    pec_richiesta: 'PEC chiesta all\'Amministrazione', contatto_impresa: "L'impresa ha ricontattato", visita_riprogrammata: 'Visita riprogrammata',
    visita_successiva: 'Verbale successivo', decisione: 'Decisione', risposta_tecnico: 'Risposta al tecnico', conferenza_proposta: 'Proposta di conferenza',
    demandata: 'Demandata', decisione_organo: 'Decisione di Presidenza / Commissione', autorizzazione_direttore: 'Conferma del Direttore',
    segnalazione_organi: 'Segnalazione a SPISAL / ITL', riscontro_organo: "Riscontro dell'organo di vigilanza" };

  let abilitato = null;   /* coordinatore o segreteria: lo dice il database, non un elenco di indirizzi */
  async function possoVedere() {
    if (abilitato !== null) return abilitato;
    try {
      const [c, s] = await Promise.all([window.sb.rpc('is_coordinatore'), window.sb.rpc('is_segreteria')]);
      abilitato = !!(c.data || s.data);
    } catch (e) { abilitato = false; }
    return abilitato;
  }

  const pill = (stato) => { const [col, l] = STATI[stato] || ['#888', stato]; return `<span style="background:${col};color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">${esc(l)}</span>`; };

  async function carica() {
    const box = $('dash-critici');
    if (!box || !window.sb || !window.S?.user) return;
    if (!(await possoVedere())) { box.style.display = 'none'; return; }
    let righe = [];
    try {
      const { data, error } = await window.sb.from('s_cantieri_critici')
        .select('id, origine, data_evento, tecnico_nome, impresa_nome, cantiere_desc, stato, termine_il, priorita, testo_merito')
        .not('stato', 'in', '(chiuso,annullato)').order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      righe = data || [];
    } catch (e) { box.style.display = 'none'; return; }
    if (!righe.length) { box.style.display = 'none'; return; }
    box.innerHTML = `<div class="card" style="border-left:4px solid #8e44ad">
      <h3>&#128679; Cantieri critici <span style="color:#8e44ad">&mdash; ${righe.length}</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">Accessi negati segnalati dai tecnici e proposte di segnalazione a SPISAL / ITL dai verbali. Da qui rispondi al tecnico, registri la decisione e scrivi il merito di una segnalazione; lettere e invii li fa la segreteria.</p>
      ${righe.map((r) => `<div data-cc="${r.id}" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid #eee6f3;cursor:pointer">
        <span title="${esc((ORIGINI[r.origine] || [])[1] || '')}">${(ORIGINI[r.origine] || ['&#128679;'])[0]}</span>
        <span style="font-size:12px;flex:1;min-width:220px"><strong>${esc(r.impresa_nome)}</strong> &mdash; ${esc(r.cantiere_desc)}
          <span style="color:#888">(${esc(r.tecnico_nome || '')}, ${dIt(r.data_evento)})</span></span>
        ${r.priorita === 'alta' ? '<span style="font-size:11px;color:#c0392b;font-weight:600">priorit&agrave; alta</span>' : ''}
        ${r.origine === 'proposta_segnalazione' && !r.testo_merito ? '<span style="font-size:11px;color:#8e44ad">merito da scrivere</span>' : ''}
        ${pill(r.stato)}
      </div>`).join('')}
    </div>`;
    box.style.display = '';
    box.querySelectorAll('[data-cc]').forEach((el) => el.addEventListener('click', () => apri(Number(el.dataset.cc))));
  }

  function stile() {
    if ($('cc-coord-stile')) return;
    const st = document.createElement('style');
    st.id = 'cc-coord-stile';
    st.textContent = `
      #modal-critico .cc-riga{font-size:13px;margin:3px 0}
      #modal-critico .cc-sez{font-size:12px;font-weight:600;color:#565c66;margin:14px 0 4px;text-transform:none}
      #modal-critico .cc-ev{font-size:12px;padding:4px 0;border-top:1px solid #f0f0f0;white-space:pre-wrap}
      #modal-critico .cc-ev small{color:#888}
      #modal-critico .field label{text-transform:none;letter-spacing:normal}
      #modal-critico textarea{width:100%}`;
    document.head.appendChild(st);
  }

  async function apri(id) {
    stile();
    $('modal-critico')?.remove();
    const [{ data: d, error }, { data: eventi }] = await Promise.all([
      window.sb.from('s_cantieri_critici').select('*').eq('id', id).maybeSingle(),
      window.sb.from('s_cantieri_critici_eventi').select('*').eq('critico_id', id).order('created_at'),
    ]);
    if (error || !d) return avviso('Caso non trovato' + (error ? ': ' + error.message : '.'), 'err');
    let verbali = [];
    if (d.cantiere_id) {
      try {
        const r = await window.sb.from('visite').select('nr_verbale, data_visita, ipc, segnalazione, elimina').eq('cantiere_id', d.cantiere_id).order('data_visita');
        verbali = (r.data || []).filter((v) => !v.elimina);
      } catch (e) { /* senza verbali il caso si legge lo stesso */ }
    }
    const presente = [d.presente_titolo, d.presente_nome, d.presente_cognome].filter(Boolean).join(' ');
    const [ico, orig] = ORIGINI[d.origine] || ['', d.origine];

    const div = document.createElement('div');
    div.className = 'modal-overlay';
    div.id = 'modal-critico';
    div.innerHTML = `<div class="modal-box" style="max-width:760px">
      <h3>${ico} Cantiere critico n&deg; ${d.id} &mdash; ${esc(orig)}</h3>
      <div class="cc-riga">${pill(d.stato)} ${d.stato === 'attesa_impresa' && d.termine_il ? `<span style="color:#888;font-size:12px">termine per l'impresa ${dIt(d.termine_il)}${d.termine_il < oggi() ? ' &mdash; scaduto, nessun contatto registrato' : ''}</span>` : ''}</div>
      <div class="cc-riga"><b>Impresa:</b> ${esc(d.impresa_nome)}</div>
      <div class="cc-riga"><b>Cantiere:</b> ${esc(d.cantiere_desc)}</div>
      <div class="cc-riga"><b>${d.origine === 'proposta_segnalazione' ? 'Visita del' : 'Data'}:</b> ${dIt(d.data_evento)} &middot; <b>tecnico:</b> ${esc(d.tecnico_nome || d.segnalato_da || '—')}</div>
      ${d.motivo ? `<div class="cc-riga"><b>Che cosa &egrave; successo:</b> ${esc(MOTIVI[d.motivo] || d.motivo)}</div>` : ''}
      ${presente || d.presente_qualifica || d.presente_tel ? `<div class="cc-riga"><b>Persona presente:</b> ${esc(presente || '(nome non indicato)')}${d.presente_qualifica ? ' &mdash; ' + esc(d.presente_qualifica) : ''}${d.presente_tel ? ' &middot; tel. ' + esc(d.presente_tel) : ''}</div>` : ''}
      <div class="cc-riga" style="white-space:pre-wrap"><b>Note del tecnico:</b>\n${esc(d.note)}</div>

      ${verbali.length ? `<div class="cc-sez">Verbali sul cantiere</div>${verbali.map((v) => `<div class="cc-riga">${esc(v.nr_verbale)} del ${dIt(v.data_visita)}${v.ipc ? ' &mdash; IPC ' + esc(v.ipc) : ''}${v.segnalazione ? ' &mdash; <b>propone la segnalazione</b>' : ''}</div>`).join('')}` : ''}

      <div class="cc-sez">Risposta al tecnico <span style="font-weight:400;color:#888">— la legge nel suo elenco delle segnalazioni</span></div>
      <div class="field"><textarea id="ccc-risposta" rows="3" maxlength="2000" placeholder="Che cosa si fa: torniamo in cantiere, proponiamo una conferenza, la questione passa alla Presidenza…">${esc(d.gestione_note || '')}</textarea></div>
      <div style="text-align:right"><button class="btn-primary btn-sm" id="ccc-salva-risposta">Salva la risposta</button></div>

      <div class="cc-sez">Decisione <span style="font-weight:400;color:#888">— resta in cronologia; lettere e mail le prepara la segreteria</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:0 0 300px"><select id="ccc-dec-tipo">${Object.entries(DECISIONI).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1 1 240px"><input type="text" id="ccc-dec-testo" maxlength="600" placeholder="Indicazioni: quando, con chi parlare, perché…"></div>
        <button class="btn-outline btn-sm" id="ccc-salva-dec" style="margin-bottom:10px">Registra</button>
      </div>

      <div class="cc-sez">Testo di merito della segnalazione a SPISAL / ITL
        <span style="font-weight:400;color:#888">— le criticit&agrave; riscontrate, che cosa &egrave; stato segnalato all'impresa e non sanato. La segreteria lo ritrova nella maschera della segnalazione.${d.merito_il ? ` Ultima modifica ${oraIt(d.merito_il)} (${esc(d.merito_da || '')}).` : ''}</span></div>
      <div class="field"><textarea id="ccc-merito" rows="8" maxlength="6000" placeholder="Nel corso delle visite sono state riscontrate…">${esc(d.testo_merito || '')}</textarea></div>
      <p style="font-size:11px;color:#888;margin:-4px 0 6px">Scrivere il merito non &egrave; decidere di segnalare: lo decidono la Presidenza e la Commissione Sicurezza, il Direttore conferma. Fatti e verbali, non giudizi sulle persone.</p>
      <div style="text-align:right"><button class="btn-primary btn-sm" id="ccc-salva-merito">Salva il testo di merito</button></div>

      <div class="cc-sez">Cronologia</div>
      ${(eventi || []).map((e) => `<div class="cc-ev"><small>${oraIt(e.created_at)}</small> <b>${esc(EVENTI[e.tipo] || e.tipo)}</b>${e.testo ? ' — ' + esc(e.testo) : ''} <small>${esc(e.autore || '')}</small></div>`).join('') || '<div class="cc-ev">Ancora niente.</div>'}

      <div style="text-align:right;margin-top:14px"><button class="btn-secondary btn-sm" id="ccc-chiudi">Chiudi</button></div>
    </div>`;
    document.body.appendChild(div);
    $('ccc-chiudi').onclick = () => div.remove();

    const dopo = () => { aggiorna().catch(() => {}); apri(id); };
    const con = async (btn, lavoro) => {
      btn.disabled = true;
      try { await lavoro(); } catch (e) { avviso('Non salvato: ' + (e.message || e), 'err'); } finally { btn.disabled = false; }
    };

    $('ccc-salva-risposta').onclick = (ev) => con(ev.currentTarget, async () => {
      const testo = $('ccc-risposta').value.trim();
      if (!testo) return avviso('Scrivi la risposta.', 'err');
      const { error: e } = await window.sb.from('s_cantieri_critici')
        .update({ gestione_note: testo, stato: d.stato === 'nuovo' ? 'in_gestione' : d.stato }).eq('id', d.id);
      if (e) throw e;
      avviso('Risposta salvata: il tecnico la vede nel suo elenco.', 'ok');
      dopo();
    });

    $('ccc-salva-dec').onclick = (ev) => con(ev.currentTarget, async () => {
      const tipo = $('ccc-dec-tipo').value;
      const testo = $('ccc-dec-testo').value.trim();
      if (tipo === 'altro' && !testo) return avviso('Scrivi che cosa si è deciso.', 'err');
      const { error: e } = await window.sb.from('s_cantieri_critici_eventi').insert({
        critico_id: d.id, tipo: 'decisione', visibile_tecnico: true,
        testo: `Coordinatore: ${tipo === 'altro' ? testo : DECISIONI[tipo] + (testo ? '. ' + testo : '.')}`, dati: { decisione: tipo, da: 'gestionale' },
      });
      if (e) throw e;
      if (d.stato === 'nuovo') await window.sb.from('s_cantieri_critici').update({ stato: 'in_gestione', gestione_note: d.gestione_note || null }).eq('id', d.id);
      avviso('Decisione registrata: la segreteria la trova nel caso.', 'ok');
      dopo();
    });

    $('ccc-salva-merito').onclick = (ev) => con(ev.currentTarget, async () => {
      const { error: e } = await window.sb.from('s_cantieri_critici')
        .update({ testo_merito: $('ccc-merito').value.trim() || null, gestione_note: d.gestione_note || null }).eq('id', d.id);
      if (e) throw e;
      avviso('Testo di merito salvato: la segreteria lo ritrova nella segnalazione.', 'ok');
      dopo();
    });
  }

  /* quante cose aspettano: le fatture si contano dai pulsanti «Approva» del
     riquadro (lo riempie loadFattureCoord di index.html), i casi dalle righe */
  function conta() {
    const vis = (id) => { const b = $(id); return b && b.style.display !== 'none' ? b : null; };
    const f = vis('dash-fatture'), c = vis('dash-critici');
    return { fatture: f ? f.querySelectorAll('button[onclick*="approvata"]').length : 0, critici: c ? c.querySelectorAll('[data-cc]').length : 0 };
  }

  function avvisa() {
    const { fatture, critici } = conta();
    const tot = fatture + critici;
    const nav = $('nav-admin');
    if (nav) {
      nav.innerHTML = '&#128272; Coordinatore' + (tot ? ` <span style="background:#e7500f;color:#fff;border-radius:10px;padding:0 7px;font-size:11px;font-weight:700">${tot}</span>` : '');
    }
    const box = $('dash-coord-avviso');
    if (!box) return;
    if (!tot || !nav || nav.style.display === 'none') { box.style.display = 'none'; return; }
    const pezzi = [];
    if (fatture) pezzi.push(`<strong>${fatture}</strong> ${fatture === 1 ? 'fattura da approvare' : 'fatture da approvare'}`);
    if (critici) pezzi.push(`<strong>${critici}</strong> ${critici === 1 ? 'cantiere critico' : 'cantieri critici'}`);
    box.innerHTML = `<div class="card" style="border-left:4px solid #e7500f;padding:10px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;cursor:pointer" id="dash-coord-vai">
      <span style="font-size:13px;flex:1;min-width:220px">&#128272; Nella <strong>Zona Coordinatore</strong> ti aspettano: ${pezzi.join(' &middot; ')}</span>
      <button class="btn-primary btn-sm">Apri</button></div>`;
    box.style.display = '';
    $('dash-coord-vai').onclick = () => nav.click();
  }

  /* un giro solo: riempie i due riquadri (che stanno nella Zona Coordinatore)
     e aggiorna avviso e numero. Lo chiamano la Dashboard e la Zona. */
  async function aggiorna() {
    await Promise.allSettled([
      typeof window.loadFattureCoord === 'function' ? window.loadFattureCoord() : Promise.resolve(),
      carica(),
    ]);
    avvisa();
  }

  /* la Zona Coordinatore ha fondo scuro e testo chiaro: dentro i riquadri bianchi
     il testo deve tornare scuro, altrimenti le righe non si leggono */
  (function coloriZona() {
    const st = document.createElement('style');
    st.textContent = '#view-admin #dash-fatture .card,#view-admin #dash-critici .card{color:#222;text-align:left}'
      + '#view-admin #dash-fatture .card h3,#view-admin #dash-critici .card h3{color:#565c66}';
    document.head.appendChild(st);
  })();

  window.loadCriticiCoord = carica;
  window.aggiornaZonaCoord = aggiorna;
})();
