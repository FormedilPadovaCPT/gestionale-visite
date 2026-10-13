/* ============================================================
   VISITE FUORI PROCEDURA — avviso al tecnico, motivo, decisione del
   Coordinatore (13/10/2026, scelte dell'utente dopo la proposta del 12/10
   e la mail al Coordinatore).

   La procedura Rev. 4 (§ 4.6) archivia il cantiere alla 2ª visita con IPC
   assente o basso, e dalla 3ª in poi se l'IPC non è alto: dopo si torna
   solo a una fase di lavoro nuova, dopo un tempo adeguato. Nel 2025-26
   75 visite ordinarie su 584 sono tornate entro 90 giorni su un cantiere
   già archiviato, mentre restavano indietro i rientri dovuti.

   Che cosa fa questo modulo:
   1. quando il tecnico sceglie un cantiere per una VISITA ORDINARIA
      («Programmata» o «Dal CPT», senza incarico) chiede al database
      (fp_controllo) se il cantiere è archiviato da meno del tempo
      adeguato — 30 giorni se l'impresa principale è C.E.I.V. attiva,
      90 negli altri casi — oppure se il rientro dovuto è più di una
      settimana più in là. Se sì apre l'avviso: ultima visita, i
      rientri dovuti nella sua zona (la parte che sposta l'attenzione
      dove serve), e chiede PERCHÉ torna: fase nuova, impresa nuova,
      richiesta dell'impresa o del committente, rischio notato passando,
      altro. Può anche proporre una serie di visite: la mail del verbale
      all'impresa la invita a chiederla dal portale.
   2. il motivo resta sul verbale (visite.fp_*), interno: non va sul PDF
      né nella mail. L'etichetta «fuori procedura» la mette il database
      al salvataggio (trigger), non questa pagina.
   3. con motivo «fase nuova», alla chiusura il database confronta le
      lavorazioni con la visita di riferimento e lo dice qui.
   4. nella Zona Coordinatore: le visite da approvare («Approvo» /
      «Non approvo», solo il Coordinatore: fp_decidi) e il quadro per
      tecnico del mese — fuori procedura accanto ai rientri dovuti e
      scaduti. Lo vede anche la segreteria, che nella sua app ha la
      colonna negli incarichi mensili.

   Serie, asseverazioni, stage, richieste e segnalazioni non danno
   l'avviso: tornano per definizione. L'accesso continua sempre.
   Script classico: usa window.sb, window.S, window.toast, vGet/vSet.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const avviso = (m, t, ms) => (window.toast ? window.toast(m, t, ms) : alert(m));
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oggiIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const S = () => window.S || {};
  const vg = (id) => (typeof window.vGet === 'function' ? window.vGet(id) : ($(id) ? $(id).value : '')) || '';

  const MOTIVI = [
    ['fase_nuova', 'È iniziata una fase di lavoro nuova', 'scrivi quale'],
    ['impresa_nuova', 'C\'è un\'impresa nuova in cantiere', ''],
    ['richiesta', 'Me l\'ha chiesto l\'impresa o il committente', ''],
    ['rischio', 'Ho notato una situazione a rischio passando', ''],
    ['altro', 'Altro', 'scrivi il motivo'],
  ];
  const TIPI = { archiviato: 'cantiere archiviato', anticipato: 'rientro anticipato' };
  const etichettaMotivo = (c) => { const m = MOTIVI.find((x) => x[0] === c); return m ? m[1] : (c || ''); };
  const etichettaTipo = (t) => TIPI[t] || (t || '');

  /* ── visita ordinaria? tipo 5 «Programmata» o 7 «Dal CPT», senza incarico ── */
  function ordinaria() {
    const t = +vg('f-tipo') || null;
    const inc = String(vg('f-prot-int') || '').trim();
    return (t === 5 || t === 7) && !inc;
  }

  /* ── la riga sotto la scheda del cantiere, nel modulo ── */
  function mostraStato() {
    const el = $('fp-stato'); if (!el) return;
    const fp = S().fd && S().fd.fp;
    if (!fp || !fp.tipo || !ordinaria()) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const mot = fp.motivo_tipo
      ? `<b>${esc(etichettaMotivo(fp.motivo_tipo))}</b>${fp.motivo ? ': ' + esc(fp.motivo) : ''}`
      : '<b style="color:#c0392b">motivo da scrivere</b>';
    el.innerHTML = `⚠️ <b>Visita fuori procedura</b> (${esc(etichettaTipo(fp.tipo))}) — ${mot}${fp.serie ? ' · <span style="color:#2d7a06">propongo una serie di visite</span>' : ''}
      ${fp.esito ? ` · <span style="color:${fp.esito === 'approvata' ? '#2d7a06' : '#c0392b'}">${fp.esito === 'approvata' ? 'approvata' : 'NON approvata'} dal Coordinatore</span>` : ''}
      <button type="button" class="btn-outline btn-sm" id="fp-cambia" style="margin-left:8px" data-aiuto="Riapre l'avviso per cambiare il motivo del rientro o la proposta di serie. Il motivo è interno: non va sul PDF né all'impresa.">✏️ Cambia motivo</button>`;
    el.style.display = '';
    const b = $('fp-cambia'); if (b) b.onclick = () => apriAvviso(fp.info || null).catch((e) => console.warn('fuori procedura:', e));
  }

  /* ── il controllo, chiamato quando si sceglie il cantiere (da autoAccCant) ── */
  let _ultimoChiesto = null;
  async function controlla(cantId) {
    const fd = S().fd || (window.S.fd = {});
    if (!cantId) { fd.fp = null; mostraStato(); return; }
    if (!ordinaria()) { mostraStato(); return; }
    /* la bozza riaperta ha già la sua risposta: non si richiede */
    if (fd.fp && fd.fp.cantiere === cantId) { mostraStato(); return; }
    const data = vg('f-data') || oggiIso();
    const vid = S().savedId || fd.visita_id || null;
    const chiave = cantId + '|' + data + '|' + (vid || '');
    if (_ultimoChiesto === chiave) return;
    _ultimoChiesto = chiave;
    const { data: j, error } = await window.sb.rpc('fp_controllo', { p_cantiere_id: cantId, p_data: data, p_visita_id: vid });
    if (error) {
      avviso('Non sono riuscito a controllare la procedura su questo cantiere (' + error.message + '). Il controllo lo rifà il database quando salvi.', 'warn', 8000);
      return;
    }
    if (!j || !j.fuori) { fd.fp = null; mostraStato(); return; }
    fd.fp = { cantiere: cantId, tipo: j.tipo, rif: j.ultima && j.ultima.visita_id, info: j, motivo_tipo: null, motivo: '', serie: false, esito: null };
    mostraStato();
    await apriAvviso(j);
  }

  /* ── i rientri dovuti nella zona del tecnico (per l'avviso) ── */
  async function rientriZona() {
    const email = S().user && S().user.email;
    if (!email) return { errore: 'nessun accesso' };
    const { data, error } = await window.sb.rpc('fp_rientri_dovuti', { p_email: email });
    if (error) return { errore: error.message };
    const righe = (data || []).filter((r) => r.giorni <= 60);
    const scaduti = righe.filter((r) => r.giorni < 0 && r.ipc !== 'NR');
    const prossimi = righe.filter((r) => r.giorni >= 0);
    return { tutti: [...scaduti, ...prossimi], scaduti: scaduti.length, prossimi: prossimi.length };
  }

  /* ── l'avviso ── */
  async function apriAvviso(j) {
    const fd = S().fd || {};
    const fp = fd.fp; if (!fp) return;
    j = j || fp.info || {};
    const u = j.ultima || {};
    const ov = document.createElement('div');
    ov.className = 'modal-overlay'; ov.id = 'fp-ov';
    const testa = fp.tipo === 'archiviato'
      ? `<h3 style="color:#b35c00">⚠️ Questo cantiere è archiviato dalla procedura</h3>
         <p style="font-size:13px;line-height:1.5;margin:0 0 8px">Ultima visita il <b>${esc(dIt(u.data_visita))}</b> (${esc(u.accesso || '?')}° accesso, IPC <b>${esc(u.ipc || 'NR')}</b>${u.tecnico ? ', ' + esc(u.tecnico) : ''}): per la procedura non è previsto un rientro, se non a una <b>nuova fase di lavoro</b> dopo un tempo adeguato — <b>${esc(j.finestra_gg || '?')} giorni</b> ${j.ceiv_attiva ? 'per le imprese iscritte C.E.I.V.' : 'per le imprese non iscritte C.E.I.V. (o sospese, cessate)'}. Ne sono passati <b>${esc(j.giorni_passati)}</b>. Questa sarebbe la visita n. ${esc(j.accesso_nuovo || '?')}.</p>`
      : `<h3 style="color:#b35c00">⚠️ Rientro anticipato</h3>
         <p style="font-size:13px;line-height:1.5;margin:0 0 8px">Ultima visita il <b>${esc(dIt(u.data_visita))}</b> (${esc(u.accesso || '?')}° accesso, IPC <b>${esc(u.ipc || 'NR')}</b>${u.tecnico ? ', ' + esc(u.tecnico) : ''}): il rientro è previsto per il <b>${esc(dIt(j.rientro_dovuto))}</b>${u.data_ritorno ? ' (data scritta nel verbale)' : ' (' + esc(j.rientro_giorni) + ' giorni dalla visita)'} e oggi mancano più di sette giorni. Questa sarebbe la visita n. ${esc(j.accesso_nuovo || '?')}.</p>`;
    ov.innerHTML = `<div class="modal-box" style="max-width:560px">
      ${testa}
      <div id="fp-rientri" style="font-size:12.5px;background:#f4f6f8;border-radius:8px;padding:8px 10px;margin:0 0 10px">⌛ Guardo i rientri dovuti nella tua zona…</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:6px">Perché torni qui?</div>
      <div id="fp-motivi" style="display:grid;gap:5px;margin-bottom:8px">
        ${MOTIVI.map(([c, l, h]) => `<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400;text-align:left;margin:0"><input type="radio" name="fp-motivo" value="${c}" ${fp.motivo_tipo === c ? 'checked' : ''} style="margin-top:3px">${esc(l)}${h ? ` <span style="color:#888">(${esc(h)})</span>` : ''}</label>`).join('')}
      </div>
      <div class="field" style="margin-bottom:8px"><textarea id="fp-testo" rows="2" placeholder="Il motivo in due righe: resta interno, lo legge il coordinatore" style="width:100%">${esc(fp.motivo || '')}</textarea></div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;margin:0 0 12px;text-transform:none;letter-spacing:0;font-weight:400;text-align:left"><input type="checkbox" id="fp-serie" ${fp.serie ? 'checked' : ''} style="margin-top:3px"><span><b>Questo cantiere va seguito nel tempo: propongo una serie di visite.</b> <span style="color:#666">Nella mail del verbale l'impresa trova l'invito a chiederla dal portale dei servizi.</span></span></label>
      <p style="font-size:11.5px;color:#666;margin:0 0 10px">Il motivo resta nel gestionale, non sul PDF e non nella mail all'impresa. Il verbale esce come sempre; nell'app è segnato «fuori procedura» e il Coordinatore lo approva o no. L'accesso continua a contare.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button type="button" class="btn-outline" id="fp-altro" data-aiuto="Toglie questo cantiere dal verbale: ne scegli un altro dall'elenco. Niente viene salvato.">↩ Scelgo un altro cantiere</button>
        <button type="button" class="btn-primary" id="fp-ok" data-aiuto="Tiene il cantiere e registra il motivo sul verbale (interno). Il verbale sarà segnato «fuori procedura» e andrà al coordinatore per l'approvazione.">Continuo con questo motivo</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    const rad = () => { const r = ov.querySelector('input[name="fp-motivo"]:checked'); return r ? r.value : null; };
    const q = (sel) => ov.querySelector(sel);
    q('#fp-ok').onclick = () => {
      const c = rad();
      if (!c) { avviso('Scegli il motivo del rientro.', 'warn'); return; }
      const t = (q('#fp-testo').value || '').trim();
      if ((c === 'fase_nuova' || c === 'altro') && t.length < 5) { avviso(c === 'fase_nuova' ? 'Scrivi quale fase di lavoro è iniziata.' : 'Scrivi il motivo in due righe.', 'warn'); q('#fp-testo').focus(); return; }
      fp.motivo_tipo = c; fp.motivo = t; fp.serie = !!q('#fp-serie').checked;
      ov.remove(); mostraStato();
      avviso('Motivo registrato: lo salvi insieme al verbale.', 'ok');
    };
    q('#fp-altro').onclick = () => {
      ov.remove();
      S().fd.fp = null; _ultimoChiesto = null;
      if (typeof window.staccaCantiere === 'function') window.staccaCantiere();
      const inA = $('f-cant-search'); if (inA) { inA.value = ''; inA.focus(); }
      mostraStato();
    };
    /* i rientri dovuti nella zona: la parte più utile dell'avviso */
    try {
      const r = await rientriZona();
      const box = q('#fp-rientri'); if (!box) return;
      if (r.errore) { box.innerHTML = `<span style="color:#c0392b">Non sono riuscito a leggere i rientri dovuti nella tua zona (${esc(r.errore)}): guardali in Scadenze.</span>`; return; }
      if (!r.tutti.length) { box.innerHTML = '✅ Nella tua zona non ci sono rientri dovuti nei prossimi 60 giorni.'; return; }
      const righe = r.tutti.slice(0, 5).map((x) => `<li>${esc(x.etichetta || x.cantiere_id)}${x.comune ? ' — ' + esc(x.comune) : ''}: <b style="color:${x.giorni < 0 ? '#c0392b' : '#2d7a06'}">${x.giorni < 0 ? 'scaduto da ' + Math.abs(x.giorni) + ' gg' : (x.giorni === 0 ? 'oggi' : 'tra ' + x.giorni + ' gg')}</b> <span style="color:#888">(IPC ${esc(x.ipc)}, ${esc(x.accesso)}° accesso)</span></li>`).join('');
      box.innerHTML = `📍 Nella tua zona ci sono <b>${r.tutti.length}</b> cantieri con un rientro dovuto${r.scaduti ? `, di cui <b style="color:#c0392b">${r.scaduti} scaduti</b>` : ''}.
        <ul style="margin:4px 0 4px 18px;padding:0">${righe}</ul>${r.tutti.length > 5 ? `<span style="color:#888">…e altri ${r.tutti.length - 5}.</span> ` : ''}
        <a href="#" id="fp-vedili" style="color:var(--orange,#e7500f);font-weight:600">Vedili in Scadenze ↗</a>`;
      const a = q('#fp-vedili'); if (a) a.onclick = (e) => { e.preventDefault(); const b = document.querySelector('nav button[data-view="scadenze"]'); if (b) b.click(); };
    } catch (e) { console.warn('rientri zona:', e); }
  }

  /* ── prima di salvare: con l'avviso aperto senza risposta, non si salva ── */
  function pronto() {
    const fp = S().fd && S().fd.fp;
    if (!fp || !fp.tipo || !ordinaria()) return true;
    if (fp.motivo_tipo) return true;
    avviso('Questa visita è fuori procedura: scrivi il motivo del rientro prima di salvare.', 'warn', 7000);
    apriAvviso(fp.info || null).catch((e) => console.warn('fuori procedura:', e));
    return false;
  }

  /* ── i campi che vanno nel verbale (fp_tipo e il riferimento li mette il database) ── */
  function campi() {
    const fp = S().fd && S().fd.fp;
    if (!fp || !ordinaria()) return { fp_motivo_tipo: null, fp_motivo: null, fp_serie_proposta: false };
    return { fp_motivo_tipo: fp.motivo_tipo || null, fp_motivo: (fp.motivo || '').trim() || null, fp_serie_proposta: !!fp.serie };
  }

  /* ── dallo snapshot (bozza riaperta, modifica) ── */
  function daSnap(snap) {
    if (!window.S) return;
    if (!snap || !snap.fp_tipo) { window.S.fd.fp = null; mostraStato(); return; }
    window.S.fd.fp = { cantiere: snap.cantiere_id || null, tipo: snap.fp_tipo, rif: snap.fp_rif_visita_id || null, info: null,
      motivo_tipo: snap.fp_motivo_tipo || null, motivo: snap.fp_motivo || '', serie: !!snap.fp_serie_proposta, esito: snap.fp_esito || null };
    mostraStato();
  }

  /* ── dopo la chiusura: che cosa ha deciso il database ── */
  async function dopoChiusura(vid) {
    if (!vid) return;
    const { data: v, error } = await window.sb.from('visite').select('fp_tipo,fp_motivo_tipo,fp_lavorazioni_uguali').eq('visita_id', vid).maybeSingle();
    if (error || !v || !v.fp_tipo) return;
    if (v.fp_motivo_tipo === 'fase_nuova' && v.fp_lavorazioni_uguali === true) {
      avviso('⚠️ Hai scritto «fase di lavoro nuova», ma le lavorazioni sono le stesse della visita precedente: il coordinatore lo vede.', 'warn', 10000);
    } else {
      avviso('Verbale chiuso e segnato «fuori procedura» (' + etichettaTipo(v.fp_tipo) + '): il Coordinatore lo approva o no.', 'warn', 7000);
    }
  }

  /* ── la mail all'impresa: la serie proposta ── */
  function serieProposta() { const fp = S().fd && S().fd.fp; return !!(fp && fp.serie && ordinaria()); }

  /* ════════ Zona Coordinatore ════════ */
  let _mese = null;   // 'aaaa-mm'
  function meseCorrente() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  function mesePrimoUltimo(m) {
    const [a, mm] = m.split('-').map(Number);
    const u = new Date(a, mm, 0).getDate();
    return { da: `${a}-${String(mm).padStart(2, '0')}-01`, a: `${a}-${String(mm).padStart(2, '0')}-${String(u).padStart(2, '0')}`, nome: ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'][mm - 1] + ' ' + a };
  }
  function meseSposta(n) { const [a, mm] = (_mese || meseCorrente()).split('-').map(Number); const d = new Date(a, mm - 1 + n, 1); _mese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

  async function boxCoord() {
    const box = $('adm-fuori-procedura'); if (!box) return;
    if (typeof window.isCoordPageUser !== 'function' || !window.isCoordPageUser()) { box.style.display = 'none'; return; }
    const coord = !!window.__isCoordinatoreVero;
    if (!_mese) _mese = meseCorrente();
    const m = mesePrimoUltimo(_mese);
    const [att, dec, rie] = await Promise.all([
      window.sb.from('visite').select('visita_id,nr_verbale,data_visita,fp_tipo,fp_motivo_tipo,fp_motivo,fp_serie_proposta,fp_lavorazioni_uguali,fp_esito,fp_esito_nota,fp_esito_il,tecnici!visite_tecnico_id_fkey(tecnico_cognome,tecnico_nome),cantieri(cantiere_etichetta,cantiere_indirizzo,cantiere_civico,comune_nome),imprese(impresa_nome)')
        .not('fp_tipo', 'is', null).is('fp_esito', null).eq('stato', 'definitivo').eq('elimina', 0).order('data_visita', { ascending: false }).limit(60),
      window.sb.from('visite').select('visita_id,nr_verbale,data_visita,fp_tipo,fp_motivo_tipo,fp_esito,fp_esito_nota,fp_esito_il,tecnici!visite_tecnico_id_fkey(tecnico_cognome),cantieri(cantiere_etichetta,comune_nome)')
        .not('fp_tipo', 'is', null).not('fp_esito', 'is', null).eq('elimina', 0).order('fp_esito_il', { ascending: false }).limit(10),
      window.sb.rpc('fp_riepilogo', { p_dal: m.da, p_al: m.a }),
    ]);
    const errori = [att.error, dec.error, rie.error].filter(Boolean).map((e) => e.message);
    const attese = att.data || [], decise = dec.data || [], riep = rie.data || [];
    const cantLbl = (c) => c ? (c.cantiere_etichetta || `${c.cantiere_indirizzo || ''} ${c.cantiere_civico || ''}`.trim() || '?') + (c.comune_nome ? ' — ' + c.comune_nome : '') : '?';
    const tecLbl = (t) => t ? `${t.tecnico_cognome || ''}${t.tecnico_nome ? ' ' + t.tecnico_nome : ''}`.trim() : '?';
    const badgeTipo = (t) => `<span style="background:${t === 'archiviato' ? '#fff3e0' : '#fdeaea'};color:${t === 'archiviato' ? '#b35c00' : '#c0392b'};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${esc(etichettaTipo(t))}</span>`;
    const rigaAttesa = (v) => `<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;padding:8px 0;border-top:1px solid #f0e6dd">
        <div style="flex:1;min-width:260px;font-size:12.5px;line-height:1.5">
          <b>${esc(dIt(v.data_visita))}</b> · verbale <b>${esc(v.nr_verbale || '?')}</b> · <b>${esc(tecLbl(v.tecnici))}</b> ${badgeTipo(v.fp_tipo)}<br>
          ${esc(cantLbl(v.cantieri))}${v.imprese && v.imprese.impresa_nome ? ' · ' + esc(v.imprese.impresa_nome) : ''}<br>
          <span style="color:#444">Motivo: <b>${esc(etichettaMotivo(v.fp_motivo_tipo) || 'non scritto')}</b>${v.fp_motivo ? ' — ' + esc(v.fp_motivo) : ''}</span>
          ${v.fp_motivo_tipo === 'fase_nuova' && v.fp_lavorazioni_uguali === true ? '<br><span style="color:#c0392b">⚠️ Le lavorazioni sono le stesse della visita precedente.</span>' : ''}
          ${v.fp_motivo_tipo === 'fase_nuova' && v.fp_lavorazioni_uguali === false ? '<br><span style="color:#2d7a06">Lavorazioni diverse dalla visita precedente.</span>' : ''}
          ${v.fp_serie_proposta ? '<br><span style="color:#2d7a06">Il tecnico propone una serie di visite (l\'impresa ha l\'invito nella mail del verbale).</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn-outline btn-sm" onclick="showVisitaDetail('${esc(v.visita_id)}')" title="Dettaglio del verbale">👁</button>
          ${coord ? `<button type="button" class="btn-primary btn-sm" onclick="FuoriProcedura.decidi('${esc(v.visita_id)}','approvata')" data-aiuto="Approvi il rientro: il verbale resta buono e il tecnico riceve l'esito. Resta scritto chi ha approvato e quando.">✅ Approvo</button>
          <button type="button" class="btn-outline btn-sm" style="color:#c0392b;border-color:#c0392b" onclick="FuoriProcedura.decidi('${esc(v.visita_id)}','non_approvata')" data-aiuto="Non approvi il rientro: scrivi il motivo, il tecnico lo riceve. Il verbale resta com'è; se ne tiene conto nel controllo dei verbali prima della liquidazione.">✋ Non approvo</button>` : '<span style="font-size:11px;color:#888">decide il Coordinatore</span>'}
        </div>
      </div>`;
    const rigaDecisa = (v) => `<div style="font-size:12px;padding:5px 0;border-top:1px solid #f5f5f5;color:#444">${esc(dIt(v.data_visita))} · ${esc(v.nr_verbale || '?')} · ${esc(tecLbl(v.tecnici))} · ${esc(cantLbl(v.cantieri))} · ${badgeTipo(v.fp_tipo)} → <b style="color:${v.fp_esito === 'approvata' ? '#2d7a06' : '#c0392b'}">${v.fp_esito === 'approvata' ? 'approvata' : 'NON approvata'}</b> il ${esc(dIt(v.fp_esito_il))}${v.fp_esito_nota ? ' — ' + esc(v.fp_esito_nota) : ''}</div>`;
    const tab = riep.length ? `<div class="table-wrap" style="overflow:auto"><table style="font-size:12px;width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;color:#565c66"><th style="padding:4px 6px">Tecnico</th><th style="padding:4px 6px" title="Visite «Programmata» e «Dal CPT» senza incarico, nel mese">Ordinarie</th><th style="padding:4px 6px">Fuori procedura</th><th style="padding:4px 6px">In attesa</th><th style="padding:4px 6px">Approvate</th><th style="padding:4px 6px">Non appr.</th><th style="padding:4px 6px" title="Cantieri con rientro dovuto nei prossimi 60 giorni, oggi">Rientri dovuti</th><th style="padding:4px 6px" title="Rientri scaduti con IPC diverso da nessun rilievo, oggi">Scaduti</th></tr></thead>
        <tbody>${riep.map((r) => `<tr style="border-top:1px solid #f0e6dd"><td style="padding:4px 6px"><b>${esc(r.tecnico)}</b></td><td style="padding:4px 6px">${r.n_ordinarie}</td><td style="padding:4px 6px;font-weight:700;color:${r.n_fuori ? '#b35c00' : '#444'}">${r.n_fuori}${r.n_ordinarie ? ` <span style="font-weight:400;color:#888">(${Math.round(r.n_fuori / r.n_ordinarie * 100)}%)</span>` : ''}</td><td style="padding:4px 6px">${r.n_attesa}</td><td style="padding:4px 6px;color:#2d7a06">${r.n_approvate}</td><td style="padding:4px 6px;color:#c0392b">${r.n_non_approvate}</td><td style="padding:4px 6px">${r.n_rientri_dovuti}</td><td style="padding:4px 6px;color:${r.n_rientri_scaduti ? '#c0392b' : '#444'};font-weight:${r.n_rientri_scaduti ? 700 : 400}">${r.n_rientri_scaduti}</td></tr>`).join('')}</tbody></table></div>`
      : (rie.error ? '' : '<p style="font-size:12px;color:#888;margin:4px 0">Nessun tecnico nel mese.</p>');
    box.innerHTML = `<div class="card" style="border-left:4px solid #b35c00;color:#222;text-align:left">
      <h3 style="color:#565c66">⚠️ Visite fuori procedura <span style="color:#b35c00">— ${attese.length} da decidere</span></h3>
      <p style="font-size:12px;color:#666;margin:4px 0 6px">Visite ordinarie tornate su un cantiere archiviato dalla procedura prima del tempo adeguato (30 giorni per le imprese C.E.I.V. attive, 90 per le altre) o più di una settimana prima del rientro dovuto. Il tecnico ha scritto il motivo; il verbale all'impresa è uscito come sempre. Approva solo il Coordinatore; il motivo resta interno. Il problema vero non è la visita in più, ma quella che manca dove serviva: per questo accanto ci sono i rientri dovuti e scaduti.</p>
      ${errori.length ? `<p style="font-size:12px;color:#c0392b;margin:4px 0 6px">Non sono riuscito a leggere tutto (${esc(errori.join('; '))}): ricarica prima di concludere che non c'è niente.</p>` : ''}
      ${attese.length ? attese.map(rigaAttesa).join('') : (att.error ? '' : '<p style="font-size:12px;color:#2d7a06;margin:4px 0">Nessuna visita in attesa di decisione.</p>')}
      ${decise.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:#565c66">Ultime decisioni (${decise.length})</summary>${decise.map(rigaDecisa).join('')}</details>` : ''}
      <div style="display:flex;gap:6px;align-items:center;margin:14px 0 6px;flex-wrap:wrap">
        <b style="font-size:13px;color:#565c66">Per tecnico — ${esc(m.nome)}</b>
        <button type="button" class="btn-outline btn-sm" id="fp-mese-prec" title="Mese prima">‹</button><button type="button" class="btn-outline btn-sm" id="fp-mese-succ" title="Mese dopo">›</button>
        <span style="font-size:11px;color:#888">Materiale riservato al Coordinatore: il rendimento del singolo non va nelle note pubbliche.</span>
      </div>
      ${tab}
    </div>`;
    box.style.display = '';
    const p = $('fp-mese-prec'), s = $('fp-mese-succ');
    if (p) p.onclick = () => { meseSposta(-1); boxCoord().catch(() => {}); };
    if (s) s.onclick = () => { meseSposta(1); boxCoord().catch(() => {}); };
  }

  async function decidi(vid, esito) {
    if (!window.__isCoordinatoreVero) { avviso('Le visite fuori procedura le approva solo il Coordinatore.', 'err'); return; }
    let nota = prompt(esito === 'approvata' ? 'Nota per il tecnico (facoltativa):' : 'Perché non approvi? La nota arriva al tecnico:');
    if (nota === null) return;
    nota = nota.trim();
    if (esito === 'non_approvata' && nota.length < 5) { avviso('Scrivi il motivo: è la riga che rilegge il tecnico.', 'warn'); return; }
    const { error } = await window.sb.rpc('fp_decidi', { p_visita_id: vid, p_esito: esito, p_nota: nota || null });
    if (error) { avviso('Decisione non registrata: ' + error.message, 'err'); return; }
    avviso(esito === 'approvata' ? 'Visita approvata: il tecnico riceve l\'esito.' : 'Visita non approvata: il tecnico riceve l\'esito con la tua nota.', 'ok');
    boxCoord().catch(() => {});
  }

  /* ── l'etichetta nell'elenco visite e nel dettaglio ── */
  function badge(v) {
    if (!v || !v.fp_tipo) return '';
    const col = v.fp_esito === 'approvata' ? '#2d7a06' : (v.fp_esito === 'non_approvata' ? '#c0392b' : '#b35c00');
    const tit = 'Fuori procedura (' + etichettaTipo(v.fp_tipo) + '): ' + (v.fp_esito === 'approvata' ? 'approvata dal Coordinatore' : v.fp_esito === 'non_approvata' ? 'NON approvata dal Coordinatore' : 'in attesa del Coordinatore');
    return ` <span class="badge" title="${esc(tit)}" style="background:${col};color:#fff;font-size:10px">⚠️ fuori proc.</span>`;
  }
  function dettaglio(v) {
    if (!v || !v.fp_tipo) return [];
    return [
      ['Fuori procedura', etichettaTipo(v.fp_tipo)],
      ['Motivo del rientro', (etichettaMotivo(v.fp_motivo_tipo) || 'non scritto') + (v.fp_motivo ? ' — ' + v.fp_motivo : '')],
      ['Lavorazioni', v.fp_motivo_tipo === 'fase_nuova' ? (v.fp_lavorazioni_uguali === true ? 'uguali alla visita precedente ⚠️' : v.fp_lavorazioni_uguali === false ? 'diverse dalla visita precedente' : 'non confrontate') : ''],
      ['Serie proposta', v.fp_serie_proposta ? 'sì, invito nella mail all\'impresa' : ''],
      ['Coordinatore', v.fp_esito ? (v.fp_esito === 'approvata' ? 'approvata' : 'NON approvata') + (v.fp_esito_il ? ' il ' + dIt(v.fp_esito_il) : '') + (v.fp_esito_nota ? ' — ' + v.fp_esito_nota : '') : 'in attesa'],
    ];
  }

  window.FuoriProcedura = { controlla, apriAvviso, pronto, campi, daSnap, dopoChiusura, serieProposta, mostraStato, boxCoord, decidi, badge, dettaglio, etichettaMotivo, etichettaTipo, ordinaria, MOTIVI };
})();
