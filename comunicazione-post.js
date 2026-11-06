/* ============================================================
   «📣 Comunicazione» — i post per i social da vedere (06/11/2026)

   Deciso dall'utente (segreteria d'area): i post della redazione social
   li scrive e li pubblica la segreteria (app segreteria, pagina
   Comunicazione), ma prima di uscire passano di qui.
     · AL COORDINATORE, quando c'è un contenuto tecnico: dà il visto — e
       il post passa comunque al Direttore — oppure scrive che cosa
       cambiare, e il post torna alla segreteria (il testo lo corregge lei,
       una persona sola).
     · AL DIRETTORE, sempre: approva, approva con indicazioni (la segreteria
       le applica e pubblica senza ripassare da lui) o non approva con una
       nota.
   Gli avvisi sono notifiche del gestionale (push_accoda), niente mail.

   Qui si legge solo la FOTOGRAFIA del post (s_post_passaggi.testi): il
   testo è fermo finché il post aspetta, quindi ciò che si vede è ciò che
   uscirà. Ognuno legge i suoi passaggi (RLS) e decide con s_post_decidi,
   che controlla chi è. Nell'anteprima «Vedi come…» la segreteria vede
   l'elenco senza i pulsanti, che il server le rifiuterebbe.
   ============================================================ */
(function (radice) {
  const haDom = typeof document !== 'undefined';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oraIt = (ts) => (ts ? new Date(ts).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const avviso = (msg, tipo) => (radice.toast ? radice.toast(msg, tipo) : alert(msg));

  const PILASTRI = { cantiere: '🏗️ Dal cantiere', normativa: '📖 Normativa e scadenze', servizi: '🧰 Servizi dell\'Area', formazione: '🎓 Formazione ed eventi', rassegna: '📰 Rassegna', avviso: '📢 Avviso' };
  const ESITI = {
    visto: '👍 visto', modifiche: '✏️ modifiche chieste', approvato: '✅ approvato', approvato_indicazioni: '✅ approvato con indicazioni',
    non_approvato: '✋ non approvato', ritirato: '↩ ritirato dalla segreteria',
  };

  /* ════════ funzioni pure (le prova test/comunicazione-post.test.cjs) ════════ */
  /* le immagini della fotografia, in fila: prima la copertina, poi il carosello */
  function immaginiDi(t) {
    t = t || {};
    return (t.immagine_url ? [t.immagine_url] : [])
      .concat((Array.isArray(t.immagini) ? t.immagini : []).map((x) => (typeof x === 'string' ? x : x && x.url)).filter(Boolean))
      .filter((u) => /^https:\/\//.test(u));
  }
  /* chi decide quale passaggio: il Coordinatore i suoi, il Direttore i suoi; la segreteria guarda e basta */
  function verso(R) { return R.coord ? 'coordinatore' : R.direttore ? 'direttore' : null; }
  function daVedere(righe, R) {
    const v = verso(R);
    return (righe || []).filter((r) => r.stato === 'in_attesa' && (R.segr || r.verso === v))
      .sort((a, b) => String(a.richiesto_il).localeCompare(String(b.richiesto_il)));
  }
  function decisiDiRecente(righe, R, n) {
    const v = verso(R);
    return (righe || []).filter((r) => r.stato !== 'in_attesa' && r.stato !== 'ritirato' && (R.segr || r.verso === v))
      .sort((a, b) => String(b.deciso_il).localeCompare(String(a.deciso_il))).slice(0, n || 8);
  }
  /* il link al video: solo YouTube, e solo https */
  const videoOk = (u) => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(String(u || ''));

  /* ════════ chi sono ════════ */
  let _R = null;
  async function ruoli() {
    const email = (radice.S && radice.S.user && radice.S.user.email) || '';
    if (_R && _R.email === email) return _R;
    const sb = radice.sb;
    const chiedi = async (f) => { try { const { data, error } = await sb.rpc(f); return !error && data === true; } catch (_e) { return false; } };
    const [coord, direttore, segr] = await Promise.all(['is_coordinatore', 'is_direttore', 'is_segreteria'].map(chiedi));
    _R = { email, coord, direttore, segr };
    return _R;
  }
  /* «Vedi come…» della segreteria: chi si guarda */
  function come() {
    try { const v = radice.vesteV2; if (!v || !v.simula || !v.simula()) return null; const r = v.ruolo(); return r === 'coordinatore' || r === 'direttore' ? r : null; } catch (_e) { return null; }
  }

  let _F = null;   // la formattazione dei testi: la stessa dell'app segreteria (post-formato.js, copia allineata)
  async function formato() {
    if (_F) return _F;
    try { _F = await import('./post-formato.js?v=1'); } catch (e) { console.warn('post-formato:', e); _F = null; }
    return _F;
  }

  let _righe = [];
  async function leggi() {
    const { data, error } = await radice.sb.from('s_post_passaggi').select('*').order('richiesto_il', { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    _righe = data || [];
    return _righe;
  }

  /* ════════ la scheda di un post ════════ */
  function scheda(r, F, pulsanti, R) {
    const t = r.testi || {};
    const imm = immaginiDi(t);
    const tg = t.testo_telegram || '';
    const app = t.testo_app || '';
    const vc = t.visto_coordinatore;
    const tgHtml = F ? F.postInTelegramHtml(tg) : esc(tg);
    const appHtml = F ? F.postInHtmlNotizia(app) : esc(app);
    const semplice = (x) => esc(F ? F.postInTestoSemplice(x || '') : (x || ''));
    const mio = pulsanti && r.verso === verso(R);
    return `<div class="card cp-post" data-cp="${r.id}" style="border-left:4px solid var(--orange,#e7500f)">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;justify-content:space-between">
        <h3 style="margin:0">${esc(t.titolo || 'Post')}</h3>
        <span style="font-size:12px;color:#777">${esc(PILASTRI[t.pilastro] || t.pilastro || '')}${t.data_programmata ? ' · da pubblicare il ' + dIt(t.data_programmata) : ''}</span>
      </div>
      <p style="font-size:12px;color:#777;margin:4px 0 8px">Mandato dalla segreteria il ${oraIt(r.richiesto_il)}${R.segr ? ` · per il ${r.verso === 'coordinatore' ? 'Coordinatore' : 'Direttore'}` : ''}</p>
      ${r.nota_richiesta ? `<div class="cp-nota"><b>La segreteria:</b> ${esc(r.nota_richiesta)}</div>` : ''}
      ${vc ? `<div class="cp-nota cp-visto"><b>👍 Visto del Coordinatore</b> (${esc(vc.nome || '')}, ${oraIt(vc.il)})${vc.nota ? ': ' + esc(vc.nota) : ''}</div>` : ''}
      ${t.verifica ? `<div class="cp-nota"><b>Da verificare:</b> ${esc(t.verifica)}</div>` : ''}
      ${t.fonte || t.norma ? `<p style="font-size:12.5px;color:#555;margin:6px 0">${t.fonte ? '<b>Fonte:</b> ' + esc(t.fonte) : ''}${t.fonte_url && /^https?:\/\//.test(t.fonte_url) ? ` · <a href="${esc(t.fonte_url)}" target="_blank" rel="noopener">apri</a>` : ''}${t.norma ? `${t.fonte ? ' · ' : ''}<b>Norma citata:</b> ${esc(t.norma)}` : ''}</p>` : ''}
      ${imm.length ? `<div class="cp-imm">${imm.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="${i === 0 ? 'copertina' : 'immagine ' + (i + 1)}"><img src="${esc(u)}" alt=""></a>`).join('')}</div>` : ''}
      ${t.video_url && videoOk(t.video_url) ? `<p style="font-size:12.5px;margin:4px 0">▶ Video: <a href="${esc(t.video_url)}" target="_blank" rel="noopener">${esc(t.video_url)}</a></p>` : ''}
      ${tg ? `<div class="cp-canale">📋 Telegram — come uscirà</div><div class="cp-bolla">${tgHtml}</div>` : ''}
      ${app && app.trim() !== tg.trim() ? `<details class="cp-det"><summary>🔔 App servizi — notizia estesa</summary><div class="cp-app">${appHtml}</div></details>` : ''}
      ${t.testo_linkedin ? `<details class="cp-det"><summary>💼 LinkedIn</summary><div class="cp-semplice">${semplice(t.testo_linkedin)}</div></details>` : ''}
      ${t.testo_instagram ? `<details class="cp-det"><summary>📸 Instagram / Facebook</summary><div class="cp-semplice">${semplice(t.testo_instagram)}</div></details>` : ''}
      ${t.hashtag ? `<p style="font-size:12px;color:#555;margin:6px 0">${esc(t.hashtag)}</p>` : ''}
      ${mio ? (r.verso === 'coordinatore'
        ? `<div class="cp-azioni">
            <button class="btn-primary btn-sm" type="button" data-cp-esito="visto" data-cp-id="${r.id}" data-aiuto="Dai il visto: il post passa al Direttore per l'approvazione, con il tuo visto scritto accanto. Puoi aggiungere una nota.">👍 Visto</button>
            <button class="btn-secondary btn-sm" type="button" data-cp-esito="modifiche" data-cp-id="${r.id}" data-aiuto="Scrivi che cosa cambiare: il post torna alla segreteria, che corregge il testo e te lo rimanda.">✏️ Proponi modifiche</button>
          </div>`
        : `<div class="cp-azioni">
            <button class="btn-primary btn-sm" type="button" data-cp-esito="approvato" data-cp-id="${r.id}" data-aiuto="Approvi il post così com'è: la segreteria lo pubblica sui social.">✅ Approvo</button>
            <button class="btn-secondary btn-sm" type="button" data-cp-esito="approvato_indicazioni" data-cp-id="${r.id}" data-aiuto="Approvi, con indicazioni da applicare prima di pubblicare: la segreteria le applica e lo pubblica senza ripassare da te.">✅ Approvo con indicazioni</button>
            <button class="btn-secondary btn-sm" type="button" data-cp-esito="non_approvato" data-cp-id="${r.id}" data-aiuto="Non approvi: scrivi perché, e il post torna alla segreteria con la tua nota.">✋ Non approvo</button>
          </div>`) : ''}
    </div>`;
  }

  /* ════════ la pagina ════════ */
  async function apri() {
    const host = $('view-comunicazione'); if (!host) return;
    stile();
    host.innerHTML = '<h2>📣 Comunicazione</h2><p style="color:#777">Un istante…</p>';
    const Rv = await ruoli();
    const _come = come();
    const R = _come ? { coord: _come === 'coordinatore', direttore: _come === 'direttore', segr: false } : Rv;
    const pulsanti = !_come && (Rv.coord || Rv.direttore);
    const [F] = await Promise.all([formato()]);
    let righe;
    try { righe = await leggi(); } catch (e) {
      host.innerHTML = `<h2>📣 Comunicazione</h2><div class="card" style="border-left:4px solid #c0392b"><p style="color:#c0392b;margin:0">Non sono riuscito a leggere i post da vedere: ${esc(e.message)}</p></div>`;
      return;
    }
    /* nell'anteprima la segreteria legge tutto: si mostra solo ciò che vedrebbe il ruolo guardato */
    const attesa = daVedere(righe, R);
    const fatti = decisiDiRecente(righe, R, 8);
    const intro = R.coord
      ? 'I post per i social che la segreteria ti manda perché hanno un contenuto tecnico. Dai il visto — e il post passa al Direttore — oppure scrivi che cosa cambiare: torna alla segreteria, che corregge il testo.'
      : R.direttore
        ? 'I post per i social prima che escano. Approvi, approvi con indicazioni (la segreteria le applica e pubblica senza ripassare da te) o non approvi con una nota. Quelli col visto del Coordinatore lo dicono.'
        : 'I post che aspettano il visto del Coordinatore o l\'approvazione del Direttore. Si mandano e si pubblicano dall\'app segreteria, pagina Comunicazione.';
    host.innerHTML = `<h2>📣 Comunicazione</h2>
      <p style="font-size:12.5px;color:#555;margin:0 0 12px;line-height:1.45">${esc(intro)}${_come ? ' <em>(anteprima: i pulsanti li vede solo chi decide)</em>' : ''}</p>
      ${attesa.length ? attesa.map((r) => scheda(r, F, pulsanti, R)).join('') : `<div class="card" style="border-left:4px solid #95C22F"><p style="margin:0;font-size:13px;color:#555">Nessun post da ${R.coord ? 'vedere' : R.direttore ? 'approvare' : 'vedere o approvare'}.</p></div>`}
      ${fatti.length ? `<div class="card"><h3 style="margin:0 0 6px">Visti di recente</h3>${fatti.map((r) => `<div class="cp-fatto">${esc(ESITI[r.stato] || r.stato)} — <b>${esc((r.testi && r.testi.titolo) || 'Post')}</b>${R.segr ? ` (${r.verso === 'coordinatore' ? 'Coordinatore' : 'Direttore'})` : ''}, ${oraIt(r.deciso_il)}${r.nota ? ': «' + esc(r.nota) + '»' : ''}</div>`).join('')}</div>` : ''}`;
    numero().catch(() => {});
  }

  async function decidi(btn) {
    const id = Number(btn.dataset.cpId), esito = btn.dataset.cpEsito;
    const r = _righe.find((x) => x.id === id); if (!r) return;
    const titolo = (r.testi && r.testi.titolo) || 'il post';
    let nota = null;
    if (esito === 'visto') {
      nota = prompt(`Visto su «${titolo}».\n\nIl post passa al Direttore per l'approvazione. Vuoi aggiungere una nota per lui? (facoltativo)`, '');
      if (nota === null) return;
    } else if (esito === 'approvato') {
      if (!confirm(`Approvo «${titolo}»?\n\nLa segreteria lo pubblica sui social.`)) return;
    } else {
      const domanda = { modifiche: `Che cosa va cambiato in «${titolo}»?\n\nIl post torna alla segreteria, che corregge il testo e te lo rimanda.`,
        approvato_indicazioni: `Approvi «${titolo}» con indicazioni.\n\nScrivi che cosa cambiare: la segreteria lo applica e pubblica senza ripassare da te.`,
        non_approvato: `Non approvi «${titolo}».\n\nScrivi perché: torna alla segreteria con la tua nota.` }[esito];
      nota = prompt(domanda, '');
      if (nota === null) return;
      if (nota.trim().length < 3) { avviso('Scrivi due righe: le legge la segreteria.', 'err'); return; }
    }
    btn.disabled = true;
    const { error } = await radice.sb.rpc('s_post_decidi', { p_passaggio: id, p_esito: esito, p_nota: nota ? nota.trim() : null });
    if (error) { btn.disabled = false; avviso('Non riuscito: ' + error.message, 'err'); return; }
    avviso({ visto: 'Visto dato: il post è passato al Direttore.', modifiche: 'Rimandato alla segreteria con le tue modifiche.',
      approvato: 'Approvato: la segreteria lo pubblica.', approvato_indicazioni: 'Approvato con indicazioni: la segreteria le applica e lo pubblica.',
      non_approvato: 'Non approvato: torna alla segreteria con la tua nota.' }[esito], 'ok');
    apri().catch((e) => console.warn('comunicazione:', e));
  }

  /* il numero sul pulsante del menu: i post che aspettano chi è collegato */
  async function numero() {
    const b = $('nav-com-badge'); if (!b) return;
    const R = await ruoli();
    const v = verso(R);
    if (!v) { b.style.display = 'none'; return; }
    const { count, error } = await radice.sb.from('s_post_passaggi').select('id', { count: 'exact', head: true }).eq('stato', 'in_attesa').eq('verso', v);
    if (error) { console.warn('comunicazione, numero:', error.message); return; }
    b.textContent = count || 0; b.style.display = count ? '' : 'none';
  }

  function stile() {
    if ($('cp-stile')) return;
    const st = document.createElement('style'); st.id = 'cp-stile';
    st.textContent = '#view-comunicazione h2{margin:0 0 4px;font-size:18px;color:var(--orange,#e7500f)}'
      + '#view-comunicazione .card{margin-bottom:12px}'
      + '.cp-nota{font-size:13px;background:#fff8e6;border-left:3px solid #e7500f;padding:6px 9px;margin:6px 0;border-radius:4px;line-height:1.45}'
      + '.cp-visto{background:#f2f8ec;border-left-color:#95C22F}'
      + '.cp-imm{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.cp-imm img{height:84px;border-radius:8px;border:1px solid #e3e4e6;display:block}'
      + '.cp-canale{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#777;margin:8px 0 4px}'
      + '.cp-bolla{background:#eef3f8;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;max-width:620px;word-wrap:break-word}'
      + '.cp-bolla blockquote{border-left:3px solid #5b8bd0;margin:4px 0;padding-left:8px}'
      + '.cp-det{margin:6px 0;font-size:13.5px}.cp-det summary{cursor:pointer;color:#565c66;font-weight:600}'
      + '.cp-app{padding:6px 0;line-height:1.5}.cp-semplice{white-space:pre-wrap;padding:6px 0;line-height:1.5}'
      + '.cp-azioni{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}'
      + '.cp-fatto{font-size:12.5px;color:#555;padding:5px 0;border-top:1px solid #f2f2f2}';
    document.head.appendChild(st);
  }

  /* ════════ aggancio ════════ */
  if (haDom) {
    let tentativi = 0;
    const prova = () => {
      if (radice.S && radice.S.user && radice.sb) { numero().catch((e) => console.warn('comunicazione:', e)); return; }
      if (++tentativi < 240) setTimeout(prova, 500);
    };
    setTimeout(prova, 800);
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('#view-comunicazione [data-cp-esito]');
      if (b) decidi(b).catch((err) => avviso('Errore: ' + err.message, 'err'));
    });
    radice.addEventListener('gestionale-logout', () => { _R = null; _righe = []; });
  }

  const api = { apri, numero, immaginiDi, daVedere, decisiDiRecente, videoOk };
  radice.comunicazionePost = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
