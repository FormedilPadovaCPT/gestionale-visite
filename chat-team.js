/* ============================================================
   CHAT DEL TEAM — al posto del gruppo WhatsApp dei tecnici
   (scelte dell'utente del 20/10/2026, costruita il 21/10/2026;
   grafica scelta: variante B «Conversazione», disegno in
   proposte_grafiche/2026_10_20_chat-team/).

   Che cosa è:
   - un gruppo unico; chi c'è legge e scrive. Il Coordinatore e la
     segreteria ci sono sempre, i tecnici li ammette e li toglie il
     Coordinatore dal riquadro «Chi è nella chat» della Zona
     Coordinatore; il Direttore no (né Presidenza e consiglieri);
   - messaggi, link (si aprono con un tocco), foto e video fino a 100 MB;
     i file vanno su Drive col nome a convenzione e NON si condividono:
     si aprono passando dalla funzione chat-team, che ricontrolla ogni
     volta se si è ancora nella chat;
   - chi scrive può cancellare il proprio messaggio: per tutti resta
     «messaggio cancellato»;
   - arriva in tempo reale (Supabase Realtime, sulla sola «busta» dei
     messaggi) e con una notifica a testo fisso, senza nomi.

   Che cosa NON è: un canale verso le imprese; non sostituisce verbale
   né protocollo.

   I permessi li fa rispettare il DATABASE (2026_10_21_chat_team.sql):
   qui si disegna soltanto. Script classico: usa window.sb, window.S,
   window.toast.
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const $ = (id) => (haDom ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const avviso = (m, t, ms) => (radice.toast ? radice.toast(m, t, ms) : console.log(m));

  const MAX_VIDEO = 100 * 1024 * 1024;     // 100 MB (deciso il 20/10/2026)
  const PEZZO = 8 * 1024 * 1024;           // pezzi del caricamento: multipli di 256 KB, come vuole Google
  const LATO_FOTO = 1600;                  // la foto si riduce sul telefono prima di partire
  const RUOLI = { coordinatore: 'coordinatore', segreteria: 'segreteria', tecnico: '' };

  /* ════════ funzioni pure (le prova test/chat-team.test.cjs) ════════ */
  function iniziali(nome) {
    const p = String(nome || '').replace(/^(arch|ing|geom|dott|p\.?\s*i|per\.?\s*ind)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    // nome e prima parola del cognome, come nel disegno: «Nicola De Marco» → ND
    return ((p[0][0] || '') + (p.length > 1 ? p[1][0] : '')).toUpperCase();
  }
  function classeRuolo(r) { return r === 'coordinatore' ? 'coord' : r === 'segreteria' ? 'segr' : ''; }
  /* il testo diventa HTML sicuro, con i soli link http/https (e www.) cliccabili */
  function linkifica(testo) {
    const s = String(testo == null ? '' : testo);
    const re = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
    let out = '', ultimo = 0, m;
    while ((m = re.exec(s))) {
      let url = m[1];
      const coda = (url.match(/[.,;:!?)\]]+$/) || [''])[0];   // la punteggiatura in fondo non fa parte del link
      if (coda) url = url.slice(0, -coda.length);
      out += esc(s.slice(ultimo, m.index));
      const href = /^www\./i.test(url) ? 'https://' + url : url;
      out += `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
      ultimo = m.index + url.length;
    }
    out += esc(s.slice(ultimo));
    return out.replace(/\n/g, '<br>');
  }
  /* (21/10/2026, chiesto dall'utente) un link di YouTube mostra l'anteprima, come su WhatsApp: l'immagine la dà
     YouTube (i.ytimg.com), il video parte nella chat solo quando lo si tocca. Riconosce youtu.be/ID,
     youtube.com/watch?v=ID, /shorts/ID, /live/ID, /embed/ID; l'ID è di 11 caratteri, niente altro passa. */
  function youtubeId(testo) {
    const s = String(testo || '');
    const m = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i.exec(s);
    return m ? m[1] : null;
  }
  /* che cosa fare di un file scelto */
  function valutaFile(f) {
    const tipo = String(f && f.type || '');
    if (/^image\//.test(tipo)) return { ok: true, tipo: 'foto' };
    if (/^video\//.test(tipo)) {
      if ((f.size || 0) > MAX_VIDEO) return { ok: false, msg: `Il video pesa ${mb(f.size)}: oltre i 100 MB non parte. Caricalo su Drive e condividi il link nella chat.` };
      return { ok: true, tipo: 'video' };
    }
    return { ok: false, msg: 'Nella chat si mandano foto e video. Per un documento, condividi il link di Drive.' };
  }
  function mb(n) { return (Math.round((n || 0) / 1048576 * 10) / 10).toLocaleString('it-IT') + ' MB'; }
  /* il prossimo pezzo da mandare: [da, a] compresi */
  function pezzo(inviati, totale, dim) {
    const d = dim || PEZZO;
    if (inviati >= totale) return null;
    return [inviati, Math.min(inviati + d, totale) - 1];
  }
  /* «Range: bytes=0-8388607» di Google → quanti byte ha già */
  function giaRicevuti(intestazione) {
    const m = /bytes=0-(\d+)/.exec(String(intestazione || ''));
    return m ? Number(m[1]) + 1 : 0;
  }
  function giorno(d, ora) {
    const x = new Date(d), o = ora ? new Date(ora) : new Date();
    const chiave = (z) => z.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
    const ieri = new Date(o.getTime() - 86400000);
    if (chiave(x) === chiave(o)) return 'Oggi';
    if (chiave(x) === chiave(ieri)) return 'Ieri';
    return x.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: x.getFullYear() === o.getFullYear() ? undefined : 'numeric' });
  }
  const ora = (d) => new Date(d).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

  /* ════════ stato ════════ */
  let _stato = null;            // risposta di chat_stato
  let _msg = [];                // messaggi caricati, in ordine
  let _biglietti = {};          // id → { file, anteprima }, validi 2 ore
  let _bigliettiIl = 0;
  let _canale = null, _vivo = false, _giro = null;
  let _caricamenti = {};        // id → { perc, testo, errore } dei miei video in partenza
  let _confermaCancella = null; // id del messaggio di cui si chiede conferma
  let _tutti = false;           // arrivati all'inizio della storia
  let _avviata = false;
  const chiaveLetto = () => 'gv-chat-letto-' + ((_stato && _stato.io) || '');
  const leggiLetto = () => { try { return Number(localStorage.getItem(chiaveLetto())) || 0; } catch (_e) { return 0; } };
  const scriviLetto = (n) => { try { localStorage.setItem(chiaveLetto(), String(n)); } catch (_e) { /* archivio del browser non disponibile */ } };
  const aperta = () => { const v = $('view-chat'); return !!(v && !v.classList.contains('hidden')); };

  /* ════════ avvio: dopo l'accesso, una volta ════════ */
  async function avvia() {
    if (_avviata || !radice.sb) return;
    _avviata = true;
    const r = await radice.sb.rpc('chat_stato');
    if (r.error) { console.warn('chat: stato non letto:', r.error.message); _avviata = false; return; }
    _stato = r.data || {};
    const b = $('nav-chat');
    if (!b) return;
    if (!_stato.visibile) { b.dataset.chatVisibile = '0'; b.style.display = 'none'; return; }
    b.dataset.chatVisibile = '1'; b.style.display = '';
    ascolta();
    nonLetti().catch((e) => console.warn('chat, non letti:', e));
    if (radice.vesteV2 && typeof radice.vesteV2.rimenu === 'function') radice.vesteV2.rimenu();
  }

  /* ── tempo reale: arriva la busta, il contenuto lo si chiede a chat_elenco ── */
  async function ascolta() {
    const sb = radice.sb;
    if (!sb || typeof sb.channel !== 'function') { sorveglia(); return; }
    try {
      const s = await sb.auth.getSession();
      const tok = s && s.data && s.data.session && s.data.session.access_token;
      if (tok && sb.realtime && typeof sb.realtime.setAuth === 'function') sb.realtime.setAuth(tok);
    } catch (_e) { /* il client userà il suo */ }
    _canale = sb.channel('chat-team')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messaggi' }, (p) => {
        const id = p && p.new && p.new.id;
        if (id) arrivato(id, p.eventType).catch((e) => console.warn('chat, arrivo:', e));
      })
      .subscribe((st) => {
        _vivo = st === 'SUBSCRIBED';
        statoCanale();
        if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') sorveglia();
      });
    sorveglia();
  }
  /* rete di sicurezza: se il tempo reale non c'è, si guarda ogni 30 secondi (solo a pagina aperta) */
  function sorveglia() {
    if (_giro) return;
    _giro = setInterval(() => {
      if (_vivo || !aperta() || document.hidden) return;
      nuovi().catch((e) => console.warn('chat, giro:', e));
    }, 30000);
  }
  function statoCanale() {
    const el = $('ct-vivo'); if (!el) return;
    el.textContent = _vivo ? '● in tempo reale' : '○ aggiornamento ogni 30 secondi';
    el.className = 'ct-vivo' + (_vivo ? ' on' : '');
  }

  async function arrivato(id, tipo) {
    if (tipo === 'INSERT') {
      if (aperta()) { await nuovi(); return; }
      await nonLetti();
      return;
    }
    // UPDATE: cancellato, file pronto o fallito → si rilegge quel messaggio
    if (!_msg.some((m) => m.id === id)) return;
    const r = await radice.sb.rpc('chat_elenco', { p_prima_di: null, p_dopo_di: id - 1, p_limite: 1 });
    if (r.error) { if (/Non sei nella chat/.test(r.error.message)) fuori(); return; }
    const nuovo = (r.data || [])[0];
    if (!nuovo || nuovo.id !== id) return;
    _msg = _msg.map((m) => (m.id === id ? nuovo : m));
    if (nuovo.stato_file === 'pronto' || nuovo.cancellato) { delete _biglietti[id]; delete _caricamenti[id]; }
    await biglietti();
    disegna(false);
  }

  /* ── il numero sul menu ── */
  async function nonLetti() {
    const b = $('nav-chat-badge'); if (!b) return;
    const letto = leggiLetto();
    const r = await radice.sb.rpc('chat_elenco', { p_prima_di: null, p_dopo_di: letto, p_limite: 200 });
    if (r.error) { if (/Non sei nella chat/.test(r.error.message)) fuori(); return; }
    const n = (r.data || []).filter((m) => !m.mio).length;
    b.textContent = n > 99 ? '99+' : String(n);
    b.style.display = n ? '' : 'none';
  }
  function letti() {
    const ult = _msg.length ? _msg[_msg.length - 1].id : 0;
    if (ult > leggiLetto()) scriviLetto(ult);
    const b = $('nav-chat-badge'); if (b) b.style.display = 'none';
  }

  /* ════════ la pagina ════════ */
  async function apri() {
    const v = $('view-chat'); if (!v) return;
    if (!_avviata) await avvia();
    if (!_stato || !_stato.partecipa) { v.innerHTML = '<div class="card"><p>Non sei nella chat del team. Chi c\'è lo decide il Coordinatore.</p></div>'; return; }
    stile();
    if (!v.dataset.pronta) {
      v.dataset.pronta = '1';
      v.innerHTML = `<div class="ct-wrap">
        <div class="ct-testa"><div style="min-width:0;flex:1"><div class="ct-nome">💬 Team Area Sicurezza</div><div class="ct-sotto" id="ct-chi"></div></div>
          <span class="ct-vivo" id="ct-vivo"></span></div>
        <div class="ct-avviso" id="ct-spenta" style="display:none"></div>
        <div class="ct-corpo" id="ct-corpo" aria-live="polite"></div>
        <div class="ct-nota">Chat interna: non è un canale verso le imprese e non sostituisce verbale né protocollo. Le foto con persone riconoscibili restano interne.</div>
        <form class="ct-componi" id="ct-form" autocomplete="off">
          <label class="ct-tasto" id="ct-allega" title="Foto o video dalla galleria">＋<input type="file" id="ct-file" accept="image/*,video/*" multiple hidden></label>
          <textarea id="ct-testo" rows="1" maxlength="4000" placeholder="Messaggio"></textarea>
          <label class="ct-tasto" id="ct-scatta" title="Scatta una foto">📷<input type="file" id="ct-cam" accept="image/*" capture="environment" hidden></label>
          <button type="submit" class="ct-tasto pieno" id="ct-invia" title="Invia">➤</button>
        </form></div>`;
      $('ct-form').addEventListener('submit', (e) => { e.preventDefault(); invia().catch((er) => avviso('Messaggio non partito: ' + er.message, 'err')); });
      const ta = $('ct-testo');
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
      ta.addEventListener('keydown', (e) => {
        const tocco = radice.matchMedia && radice.matchMedia('(pointer: coarse)').matches;
        if (e.key === 'Enter' && !e.shiftKey && !tocco) { e.preventDefault(); $('ct-form').requestSubmit(); }
      });
      $('ct-file').addEventListener('change', (e) => { scelti(e.target.files).catch((er) => avviso(er.message, 'err')); e.target.value = ''; });
      $('ct-cam').addEventListener('change', (e) => { scelti(e.target.files).catch((er) => avviso(er.message, 'err')); e.target.value = ''; });
      $('ct-corpo').addEventListener('click', clic);
    }
    const r = await radice.sb.rpc('chat_stato');
    if (!r.error && r.data) _stato = r.data;
    if (!_stato.partecipa) { fuori(); return; }
    const altri = (_stato.partecipanti || []).filter((p) => p.email !== _stato.io).map((p) => p.nome.split(' ').slice(1).join(' ') || p.nome);   // il cognome intero: «De Marco», non «Marco»
    $('ct-chi').textContent = altri.length ? `${altri.join(', ')} e tu` : 'solo tu, per ora';
    const sp = $('ct-spenta');
    if (sp) {
      sp.style.display = _stato.accesa ? 'none' : '';
      sp.textContent = 'In prova: la chat non è ancora accesa per tutti. La vedono la segreteria e chi la sta provando; agli altri non arriva niente.';
    }
    statoCanale();
    await carica();
  }

  function fuori() {
    _msg = []; _biglietti = {};
    const v = $('view-chat');
    if (v) { v.dataset.pronta = ''; v.innerHTML = '<div class="card"><p>Non sei più nella chat del team: i messaggi e i file non sono più visibili. Chi c\'è lo decide il Coordinatore.</p></div>'; }
    const b = $('nav-chat'); if (b) { b.dataset.chatVisibile = '0'; b.style.display = 'none'; }
    if (_canale && radice.sb) { try { radice.sb.removeChannel(_canale); } catch (_e) { /* niente */ } _canale = null; }
  }

  async function carica() {
    const r = await radice.sb.rpc('chat_elenco', { p_prima_di: null, p_dopo_di: null, p_limite: 50 });
    if (r.error) {
      if (/Non sei nella chat/.test(r.error.message)) { fuori(); return; }
      $('ct-corpo').innerHTML = `<p class="ct-errore">Non sono riuscito a leggere i messaggi (${esc(r.error.message)}): ricarica prima di concludere che non c'è niente.</p>`;
      return;
    }
    _msg = r.data || [];
    _tutti = _msg.length < 50;
    await biglietti();
    disegna(true);
    letti();
  }
  async function precedenti() {
    if (!_msg.length) return;
    const corpo = $('ct-corpo'), primaAlt = corpo.scrollHeight;
    const r = await radice.sb.rpc('chat_elenco', { p_prima_di: _msg[0].id, p_dopo_di: null, p_limite: 50 });
    if (r.error) { avviso('Messaggi precedenti non letti: ' + r.error.message, 'err'); return; }
    const vecchi = r.data || [];
    _tutti = vecchi.length < 50;
    _msg = vecchi.concat(_msg);
    await biglietti();
    disegna(false);
    corpo.scrollTop = corpo.scrollHeight - primaAlt;
  }
  async function nuovi() {
    const ult = _msg.length ? _msg[_msg.length - 1].id : 0;
    const r = await radice.sb.rpc('chat_elenco', { p_prima_di: null, p_dopo_di: ult, p_limite: 200 });
    if (r.error) { if (/Non sei nella chat/.test(r.error.message)) fuori(); return; }
    const arr = (r.data || []).filter((m) => !_msg.some((x) => x.id === m.id));
    if (!arr.length) return;
    _msg = _msg.concat(arr);
    await biglietti();
    const corpo = $('ct-corpo');
    const inFondo = !corpo || corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 120;
    disegna(inFondo || arr.some((m) => m.mio));
    if (!document.hidden) letti();
  }

  /* i collegamenti ai file: firmati dalla funzione, validi 2 ore */
  async function biglietti() {
    if (Date.now() - _bigliettiIl > 90 * 60000) { _biglietti = {}; _bigliettiIl = Date.now(); }
    const servono = _msg.filter((m) => (m.tipo === 'foto' || m.tipo === 'video') && m.stato_file === 'pronto' && !m.cancellato && !_biglietti[m.id]).map((m) => m.id);
    if (!servono.length) return;
    const r = await radice.sb.functions.invoke('chat-team', { body: { azione: 'biglietti', ids: servono } });
    if (r.error || !r.data || !r.data.ok) { console.warn('chat, biglietti:', r.error || r.data); return; }
    Object.assign(_biglietti, r.data.biglietti || {});
    if (!_bigliettiIl) _bigliettiIl = Date.now();
  }

  /* ── disegno, come la variante B ── */
  function disegna(inFondo) {
    const corpo = $('ct-corpo'); if (!corpo) return;
    let html = _tutti ? '<div class="ct-giorno">Inizio della chat</div>' : '<button type="button" class="ct-prima" data-azione="precedenti">Messaggi precedenti</button>';
    let gPrima = '';
    for (const m of _msg) {
      const g = giorno(m.creato_il);
      if (g !== gPrima) { html += `<div class="ct-giorno">${esc(g)}</div>`; gPrima = g; }
      html += riga(m);
    }
    if (!_msg.length) html += '<p class="ct-vuota">Ancora nessun messaggio. Scrivi il primo.</p>';
    corpo.innerHTML = html;
    if (inFondo) corpo.scrollTop = corpo.scrollHeight;
  }
  function riga(m) {
    const cl = classeRuolo(m.autore_ruolo);
    const chi = m.mio ? '' : `<span class="ct-chi">${esc(m.autore_nome)}${RUOLI[m.autore_ruolo] ? ' · ' + RUOLI[m.autore_ruolo] : ''}</span>`;
    const av = m.mio ? '' : `<span class="ct-avatar ${cl}" aria-hidden="true">${esc(iniziali(m.autore_nome))}</span>`;
    let dentro;
    if (m.cancellato) dentro = '<p class="ct-cancellato">🚫 messaggio cancellato</p>';
    else {
      dentro = '';
      if (m.tipo === 'foto') dentro += media(m, 'foto');
      if (m.tipo === 'video') dentro += media(m, 'video');
      if (m.testo) dentro += `<p>${linkifica(m.testo)}</p>`;
      const yt = m.tipo === 'testo' && youtubeId(m.testo);
      if (yt) dentro += `<button type="button" class="ct-video ct-yt" data-azione="youtube" data-yt="${esc(yt)}" title="Guarda il video qui nella chat"><img src="https://i.ytimg.com/vi/${esc(yt)}/hqdefault.jpg" alt="Anteprima del video di YouTube" loading="lazy"><span class="ct-play">▶</span><span class="ct-durata">YouTube</span></button>`;
    }
    const conferma = _confermaCancella === m.id
      ? `<div class="ct-conferma">Cancellare per tutti? Resterà «messaggio cancellato». <button type="button" data-azione="cancella-si" data-id="${m.id}">Cancella</button> <button type="button" data-azione="cancella-no">No</button></div>` : '';
    const menu = m.mio && !m.cancellato && _confermaCancella !== m.id ? ` <button type="button" class="ct-x" data-azione="cancella" data-id="${m.id}" title="Cancella questo messaggio">cancella</button>` : '';
    return `<div class="ct-riga${m.mio ? ' mia' : ''}" data-id="${m.id}">${av}<div class="ct-bolla">${chi}${dentro}${conferma}<span class="ct-ora">${ora(m.creato_il)}${menu}</span></div></div>`;
  }
  function media(m, tipo) {
    if (m.stato_file === 'in_caricamento') {
      const c = _caricamenti[m.id];
      if (c && m.mio) {
        return `<div class="ct-carica"><div>⏳ ${c.preparo ? 'Preparo il video…' : `Sto caricando il video: ${c.perc}%`}${c.attesa ? ' — ' + esc(c.attesa) : ''}</div><div class="ct-barra"><span style="width:${c.perc}%"></span></div><div class="ct-piccolo">Non chiudere l'app finché non arriva al 100%.</div></div>`;
      }
      return `<div class="ct-carica">⏳ ${tipo === 'foto' ? 'Foto' : 'Video'} in caricamento…</div>`;
    }
    if (m.stato_file === 'fallito') return `<div class="ct-carica ko">⚠️ ${tipo === 'foto' ? 'La foto' : 'Il video'} non è arrivato${m.mio ? ': puoi cancellare questo messaggio e riprovare.' : '.'}</div>`;
    const b = _biglietti[m.id] || {};
    if (tipo === 'foto') {
      if (!b.file) return '<div class="ct-carica">📷 foto (non riesco ad aprirla adesso: ricarica la pagina)</div>';
      return `<a href="${esc(b.file)}" target="_blank" rel="noopener" class="ct-foto" title="Apri la foto intera"><img src="${esc(b.file)}" alt="Foto" loading="lazy"${m.larghezza && m.altezza ? ` width="${m.larghezza}" height="${m.altezza}"` : ''}></a>`;
    }
    const durata = m.durata_s ? `${Math.floor(m.durata_s / 60)}:${String(Math.round(m.durata_s % 60)).padStart(2, '0')}` : '';
    if (!b.file) return '<div class="ct-carica">🎬 video (non riesco ad aprirlo adesso: ricarica la pagina)</div>';
    return `<button type="button" class="ct-video" data-azione="guarda" data-id="${m.id}" title="Guarda il video">
      ${b.anteprima ? `<img src="${esc(b.anteprima)}" alt="" loading="lazy">` : '<span class="ct-video-vuoto">🎬</span>'}
      <span class="ct-play">▶</span>${durata || m.dimensione_byte ? `<span class="ct-durata">${esc([durata, m.dimensione_byte ? mb(m.dimensione_byte) : ''].filter(Boolean).join(' · '))}</span>` : ''}</button>
      <a class="ct-piccolo" href="${esc(b.file)}&scarica=1" rel="noopener">Scarica</a>`;
  }

  function clic(e) {
    const t = e.target.closest('[data-azione]'); if (!t) return;
    const id = Number(t.dataset.id);
    const az = t.dataset.azione;
    if (az === 'precedenti') precedenti().catch((er) => avviso(er.message, 'err'));
    if (az === 'cancella') { _confermaCancella = id; disegna(false); }
    if (az === 'cancella-no') { _confermaCancella = null; disegna(false); }
    if (az === 'cancella-si') cancella(id).catch((er) => avviso('Non cancellato: ' + er.message, 'err'));
    if (az === 'youtube') {
      const id = String(t.dataset.yt || '');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.className = 'ct-yt-vero'; f.title = 'Video di YouTube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      t.replaceWith(f);
      return;
    }
    if (az === 'guarda') {
      const b = _biglietti[id] || {};
      if (!b.file) return;
      const v = document.createElement('video');
      v.src = b.file; v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'metadata'; v.className = 'ct-video-vero';
      t.replaceWith(v);
    }
  }

  async function cancella(id) {
    const r = await radice.sb.rpc('chat_cancella', { p_id: id });
    _confermaCancella = null;
    if (r.error) throw new Error(r.error.message);
    _msg = _msg.map((m) => (m.id === id ? Object.assign({}, m, { cancellato: true, testo: null }) : m));
    disegna(false);
  }

  /* ════════ scrivere ════════ */
  async function invia() {
    const ta = $('ct-testo'); const t = ta.value.trim();
    if (!t) return;
    $('ct-invia').disabled = true;
    try {
      const r = await radice.sb.rpc('chat_scrivi', { p_testo: t });
      if (r.error) throw new Error(r.error.message);
      ta.value = ''; ta.style.height = 'auto';
      await nuovi();
    } finally { $('ct-invia').disabled = false; }
  }

  async function scelti(files) {
    const lista = Array.from(files || []);
    for (const f of lista) {
      const v = valutaFile(f);
      if (!v.ok) { avviso(v.msg, 'warn', 8000); continue; }
      const ta = $('ct-testo'); const didascalia = ta.value.trim();
      ta.value = ''; ta.style.height = 'auto';
      if (v.tipo === 'foto') await mandaFoto(f, didascalia);
      else mandaVideo(f, didascalia).catch((er) => avviso('Video non partito: ' + er.message, 'err', 8000));
    }
  }

  /* la foto si rimpicciolisce sul telefono (lato lungo 1600 px) e parte in un colpo solo */
  async function mandaFoto(file, testo) {
    const { b64, w, h } = await riduci(file, LATO_FOTO, 0.82);
    avviso('Invio la foto…', '', 2500);
    const r = await radice.sb.functions.invoke('chat-team', { body: { azione: 'foto', image_base64: b64, testo, larghezza: w, altezza: h } });
    if (r.error || !r.data || !r.data.ok) throw new Error((r.data && r.data.error) || (r.error && r.error.message) || 'foto non caricata');
    await nuovi();
  }
  async function riduci(file, lato, qualita) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, lato / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const url = c.toDataURL('image/jpeg', qualita);
    return { b64: url.split(',')[1], w, h };
  }

  /* il fotogramma del video e la durata, letti dal file sul telefono */
  function fotogramma(file) {
    return new Promise((ok) => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      let fatto = false;
      const fine = (dati) => { if (fatto) return; fatto = true; URL.revokeObjectURL(url); ok(dati); };
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
      v.onloadedmetadata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (_e) { fine({}); } };
      v.onseeked = () => {
        try {
          const k = Math.min(1, 480 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
          const c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          fine({ b64: c.toDataURL('image/jpeg', 0.7).split(',')[1], durata: v.duration, w: v.videoWidth, h: v.videoHeight });
        } catch (_e) { fine({ durata: v.duration, w: v.videoWidth, h: v.videoHeight }); }
      };
      v.onerror = () => fine({});
      setTimeout(() => fine({}), 8000);
    });
  }

  /* il video va a pezzi direttamente su Drive; se cade la linea si chiede a Google dove era arrivato e si riparte da lì */
  async function mandaVideo(file, testo) {
    const fg = await fotogramma(file);
    const r = await radice.sb.functions.invoke('chat-team', { body: {
      azione: 'video_inizia', nome_originale: file.name, mime: file.type, dimensione: file.size, testo,
      durata: fg.durata && isFinite(fg.durata) ? Math.round(fg.durata) : null, larghezza: fg.w || null, altezza: fg.h || null,
    } });
    if (r.error || !r.data || !r.data.ok) throw new Error((r.data && r.data.error) || (r.error && r.error.message) || 'caricamento non aperto');
    const id = r.data.id, url = r.data.upload_url;
    _caricamenti[id] = { perc: 0 };
    proteggi();
    await nuovi();
    if (fg.b64) radice.sb.functions.invoke('chat-team', { body: { azione: 'anteprima', id, image_base64: fg.b64 } }).catch(() => {});
    try {
      await aPezzi(file, url, (perc, attesa) => { _caricamenti[id] = { perc, attesa }; aggiornaBarra(id); });
      let ok = false;
      for (let i = 0; i < 5 && !ok; i++) {
        const f = await radice.sb.functions.invoke('chat-team', { body: { azione: 'video_fine', id } });
        ok = !!(f.data && f.data.ok);
        if (!ok) await attendi(2000 * (i + 1));
      }
      if (!ok) throw new Error('Drive non conferma il video completo');
      delete _caricamenti[id];
      avviso('Video inviato.', 'ok');
    } catch (e) {
      delete _caricamenti[id];
      await radice.sb.functions.invoke('chat-team', { body: { azione: 'fallito', id } }).catch(() => {});
      throw e;
    } finally { proteggi(); }
    await arrivato(id, 'UPDATE');
  }
  const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));
  function aggiornaBarra(id) {
    const r = document.querySelector(`#ct-corpo .ct-riga[data-id="${id}"] .ct-carica`);
    const m = _msg.find((x) => x.id === id);
    if (r && m) r.outerHTML = media(m, 'video');
  }
  /* chiudere l'app a metà caricamento lo interrompe: il browser chiede conferma (accanto all'avviso del verbale non salvato, senza toccarlo) */
  function proteggi() { /* il controllo è nel gestore qui sotto, che guarda _caricamenti */ }
  if (haDom) radice.addEventListener('beforeunload', (e) => { if (Object.keys(_caricamenti).length) { e.preventDefault(); e.returnValue = ''; } });

  function mandaPezzo(url, file, da, a) {
    return new Promise((ok) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('Content-Range', `bytes ${da}-${a}/${file.size}`);
      x.upload.onprogress = (e) => { if (mandaPezzo.progresso) mandaPezzo.progresso(da + (e.loaded || 0)); };
      x.onload = () => ok({ status: x.status, range: x.getResponseHeader('Range') });
      x.onerror = () => ok({ status: 0 });
      x.ontimeout = () => ok({ status: 0 });
      x.timeout = 120000;
      x.send(file.slice(da, a + 1));
    });
  }
  function chiediDove(url, totale) {
    return new Promise((ok) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('Content-Range', `bytes */${totale}`);
      x.onload = () => ok({ status: x.status, range: x.getResponseHeader('Range') });
      x.onerror = () => ok({ status: 0 });
      x.send();
    });
  }
  async function aPezzi(file, url, avanzamento) {
    let inviati = 0, errori = 0;
    mandaPezzo.progresso = (n) => avanzamento(Math.min(99, Math.floor(n / file.size * 100)));
    for (;;) {
      const p = pezzo(inviati, file.size);
      if (!p) return;
      const r = await mandaPezzo(url, file, p[0], p[1]);
      if (r.status === 200 || r.status === 201) { avanzamento(100); return; }
      if (r.status === 308) { inviati = r.range ? giaRicevuti(r.range) : p[1] + 1; errori = 0; continue; }
      if (r.status === 404 || r.status === 410) throw new Error('il caricamento è scaduto: rimanda il video');
      // linea caduta o Google occupato: si aspetta, si chiede dove era arrivato, si riprende da lì
      if (++errori > 12) throw new Error('la linea non regge: riprova da un posto con più campo, o condividi un link di Drive');
      const attesa = Math.min(30000, 2000 * 2 ** Math.min(errori, 4));
      avanzamento(Math.floor(inviati / file.size * 100), navigator.onLine === false ? 'senza rete, aspetto che torni' : 'linea debole, riprovo');
      await attendi(attesa);
      if (navigator.onLine === false) await new Promise((ok) => { const f = () => { radice.removeEventListener('online', f); ok(); }; radice.addEventListener('online', f); setTimeout(f, 60000); });
      const d = await chiediDove(url, file.size);
      if (d.status === 200 || d.status === 201) { avanzamento(100); return; }
      /* se Google non dice dove era arrivato si riparte dall'ultimo pezzo che aveva confermato */
      if (d.status === 308) inviati = d.range ? giaRicevuti(d.range) : inviati;
    }
  }

  /* ════════ Zona Coordinatore: «Chi è nella chat» ════════ */
  let _confermaMembro = null;
  async function box() {
    const el = $('adm-chat-membri'); if (!el) return;
    if (typeof radice.isCoordPageUser !== 'function' || !radice.isCoordPageUser()) { el.style.display = 'none'; return; }
    stile();
    const coord = !!radice.__isCoordinatoreVero;
    const r = await radice.sb.rpc('chat_membri_quadro');
    if (r.error) {
      el.innerHTML = `<div class="card ct-pannello"><h3>💬 Chat del team — partecipanti</h3><p class="ct-errore">Non sono riuscito a leggere chi è nella chat (${esc(r.error.message)}): ricarica prima di concludere che non c'è nessuno.</p></div>`;
      el.style.display = ''; return;
    }
    const q = r.data || {};
    const fissi = (q.fissi || []).map((f) => `<tr><td><b>${esc(f.nome)}</b></td><td>${f.ruolo === 'coordinatore' ? 'Coordinatore' : 'Segreteria'}</td><td><span class="ct-pill in">nella chat</span></td><td class="n">sempre</td><td></td><td><span class="ct-fisso">fisso</span></td></tr>`).join('');
    const mese = new Date().toLocaleDateString('it-IT', { month: 'long', timeZone: 'Europe/Rome' });
    const tec = (q.tecnici || []).map((t) => {
      const nome = [t.nome, t.cognome].filter(Boolean).join(' ');
      const p = !coord ? '<span class="ct-fisso">lo decide il Coordinatore</span>'
        : `<button type="button" class="ct-btn ${t.dentro ? 'togli' : 'ammetti'}" data-chat-membro="${esc(t.tecnico_id)}" data-chat-azione="${t.dentro ? 'togli' : 'ammetti'}" data-chat-nome="${esc(nome)}">${t.dentro ? 'Togli' : 'Ammetti'}</button>`;
      return `<tr><td><b>${esc(nome)}</b></td><td>Tecnico</td><td><span class="ct-pill ${t.dentro ? 'in' : 'out'}">${t.dentro ? 'nella chat' : 'non nella chat'}</span></td>
        <td class="n">${t.dal ? esc(new Date(t.dal).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })) : '—'}</td>
        <td class="n" title="Se ha la lettera di incarico di questo mese: è l'unica traccia, nel database, di chi è operativo">${t.incarico_mese ? '✓' : '—'}</td><td>${p}</td></tr>`;
    }).join('');
    const mov = (q.movimenti || []).slice(0, 12).map((m) => `<div>${esc(new Date(m.quando).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }))} · ${esc(m.chi)} ${m.cosa === 'ammesso' ? 'ammesso' : 'tolto'} da ${esc(m.da)}</div>`).join('');
    const conf = _confermaMembro;
    el.innerHTML = `<div class="card ct-pannello">
      <h3>💬 Chat del team — partecipanti</h3>
      <p class="ct-desc">${coord ? 'Ammetti i tecnici operativi e togli chi non lo è più.' : 'Chi è nella chat lo decide il Coordinatore.'} La segreteria c'è sempre, il Direttore no. Chi viene tolto non vede più la chat, né i messaggi vecchi né foto e video; quello che ha scritto resta, col suo nome. ${q.accesa ? '' : '<b>La chat non è ancora accesa per tutti:</b> la vede la segreteria, e chi è ammesso la vedrà quando si accende.'}</p>
      <div class="ct-tab"><table><thead><tr><th>Persona</th><th>Ruolo</th><th>Stato</th><th>Dal</th><th title="Ha la lettera di incarico di ${esc(mese)}">Incarico di ${esc(mese)}</th><th></th></tr></thead><tbody>${fissi}${tec}</tbody></table></div>
      ${conf ? `<div class="ct-conferma-box">${conf.azione === 'ammetti' ? `Ammettere <b>${esc(conf.nome)}</b> nella chat? Vedrà anche i messaggi e i file già scambiati.` : `Togliere <b>${esc(conf.nome)}</b> dalla chat? Non vedrà più niente, nemmeno quello che ha già letto; i suoi messaggi restano.`}
        <button type="button" class="ct-btn" id="ct-conf-si">Conferma</button><button type="button" class="ct-btn" id="ct-conf-no">Annulla</button></div>` : ''}
      <div class="ct-storia"><b>Movimenti</b>${mov || '<div>Nessuno ancora.</div>'}</div>
    </div>`;
    el.style.display = '';
    el.querySelectorAll('[data-chat-membro]').forEach((b) => { b.onclick = () => { _confermaMembro = { id: b.dataset.chatMembro, azione: b.dataset.chatAzione, nome: b.dataset.chatNome }; box().catch(() => {}); }; });
    const si = $('ct-conf-si'), no = $('ct-conf-no');
    if (no) no.onclick = () => { _confermaMembro = null; box().catch(() => {}); };
    if (si) si.onclick = async () => {
      const c = _confermaMembro; _confermaMembro = null; si.disabled = true;
      const x = await radice.sb.rpc(c.azione === 'ammetti' ? 'chat_ammetti' : 'chat_togli', { p_tecnico_id: c.id });
      if (x.error) avviso('Non fatto: ' + x.error.message, 'err', 7000);
      else avviso(c.azione === 'ammetti' ? `${c.nome} è nella chat.` : `${c.nome} non è più nella chat.`, 'ok');
      box().catch(() => {});
    };
  }

  /* ════════ aspetto: colori e carattere della veste v2 ════════ */
  function stile() {
    if (!haDom || $('ct-stile')) return;
    const st = document.createElement('style'); st.id = 'ct-stile';
    st.textContent = `
#view-chat{padding:0}
.ct-wrap{display:flex;flex-direction:column;height:calc(100dvh - 150px);min-height:420px;background:#fff;border:1px solid #e3e4e6;border-radius:12px;overflow:hidden;font-family:Barlow,'Segoe UI',system-ui,sans-serif;color:#2b2f35}
.ct-testa{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #e3e4e6}
.ct-nome{font:700 16px/1.15 Barlow,sans-serif}
.ct-sotto{font-size:12px;color:#6b7078;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ct-vivo{font-size:11px;color:#6b7078;white-space:nowrap}.ct-vivo.on{color:#4f6d10}
.ct-avviso{background:#fff1ea;color:#b33b05;font-size:12px;padding:6px 14px}
.ct-corpo{flex:1;overflow-y:auto;padding:12px 12px 16px;display:flex;flex-direction:column;gap:6px;background:#fff}
.ct-giorno{align-self:center;font:600 11px/1 'Barlow Condensed',Barlow,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b7078;background:#f7f7f7;border-radius:50px;padding:5px 10px;margin:6px 0}
.ct-prima{align-self:center;border:1px solid #e3e4e6;background:#fff;border-radius:50px;padding:5px 12px;font:600 12px Barlow,sans-serif;color:#565c66;cursor:pointer}
.ct-vuota,.ct-errore{text-align:center;color:#6b7078;font-size:13px}.ct-errore{color:#c0392b}
.ct-riga{display:flex;gap:8px;align-items:flex-end;max-width:86%}
.ct-riga.mia{align-self:flex-end;flex-direction:row-reverse}
.ct-avatar{width:28px;height:28px;border-radius:50%;flex:none;display:grid;place-items:center;font:700 11px 'Barlow Condensed',Barlow,sans-serif;color:#fff;background:#565c66}
.ct-avatar.coord{background:#e7500f}.ct-avatar.segr{background:#4f6d10}
.ct-bolla{background:#f7f7f7;border-radius:14px 14px 14px 4px;padding:7px 10px;display:grid;gap:6px;min-width:0}
.ct-riga.mia .ct-bolla{background:#fff1ea;border-radius:14px 14px 4px 14px}
.ct-chi{font:600 12px Barlow,sans-serif;color:#b33b05}
.ct-bolla p{margin:0;font-size:14px;line-height:1.4;overflow-wrap:anywhere}
.ct-bolla a{color:#b33b05;text-decoration:underline}
.ct-ora{font-size:11px;color:#6b7078;justify-self:end;font-variant-numeric:tabular-nums}
.ct-x{border:0;background:none;color:#6b7078;font-size:11px;text-decoration:underline;cursor:pointer;padding:0 0 0 6px}
.ct-cancellato{font-style:italic;color:#6b7078}
.ct-conferma{font-size:12px;background:#fff;border:1px solid #e7500f;border-radius:8px;padding:6px 8px}
.ct-conferma button{border:1px solid #e3e4e6;background:#fff;border-radius:6px;padding:3px 8px;font:600 12px Barlow,sans-serif;cursor:pointer}
.ct-conferma button[data-azione="cancella-si"]{border-color:#c0392b;color:#c0392b}
.ct-foto img{display:block;max-width:100%;max-height:320px;height:auto;width:auto;border-radius:8px}
.ct-video{position:relative;display:block;border:0;padding:0;background:#2b2f35;border-radius:8px;overflow:hidden;cursor:pointer;min-width:200px;min-height:120px}
.ct-video img{display:block;max-width:100%;max-height:320px}
.ct-video-vuoto{display:grid;place-items:center;height:140px;font-size:32px}
.ct-play{position:absolute;inset:0;margin:auto;width:46px;height:46px;border-radius:50%;background:rgba(20,20,20,.55);color:#fff;display:grid;place-items:center;font-size:18px}
.ct-durata{position:absolute;right:6px;bottom:6px;background:rgba(20,20,20,.6);color:#fff;font:500 11px ui-monospace,Consolas,monospace;border-radius:4px;padding:2px 5px}
.ct-video-vero{display:block;max-width:100%;max-height:360px;border-radius:8px;background:#000}
.ct-yt img{display:block;width:320px;max-width:100%;aspect-ratio:16/9;object-fit:cover}
.ct-yt-vero{display:block;width:320px;max-width:100%;aspect-ratio:16/9;border:0;border-radius:8px;background:#000}
.ct-carica{font-size:13px;color:#565c66;display:grid;gap:4px}.ct-carica.ko{color:#c0392b}
.ct-barra{height:6px;background:#e3e4e6;border-radius:3px;overflow:hidden;min-width:180px}.ct-barra span{display:block;height:100%;background:#e7500f}
.ct-piccolo{font-size:11px;color:#6b7078}
.ct-nota{font-size:11px;color:#6b7078;padding:4px 14px;border-top:1px solid #f0f0f0}
.ct-componi{border-top:1px solid #e3e4e6;padding:8px 10px 10px;display:flex;gap:8px;align-items:flex-end;margin:0}
.ct-componi textarea{flex:1;min-width:0;border:1px solid #e3e4e6;border-radius:20px;padding:9px 14px;font:14px Barlow,sans-serif;background:#f7f7f7;resize:none;max-height:140px}
.ct-tasto{flex:none;width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;font-size:18px;background:#f7f7f7;color:#565c66;cursor:pointer}
.ct-tasto.pieno{background:#e7500f;color:#fff}.ct-tasto:disabled{opacity:.5}
.ct-tasto:focus-visible,.ct-btn:focus-visible{outline:3px solid #e7500f;outline-offset:2px}
.ct-pannello{border-left:4px solid #95c22f;color:#222;text-align:left}
.ct-pannello h3{color:#565c66;margin:0 0 6px}
.ct-desc{font-size:12.5px;color:#555;margin:0 0 8px}
.ct-tab{overflow-x:auto}.ct-tab table{width:100%;border-collapse:collapse;font-size:13px;min-width:560px}
.ct-tab th{text-align:left;font:600 11px/1 'Barlow Condensed',Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#6b7078;padding:7px 6px;border-bottom:1px solid #e3e4e6}
.ct-tab td{padding:7px 6px;border-bottom:1px solid #eee;vertical-align:middle}.ct-tab td.n{color:#6b7078;font-variant-numeric:tabular-nums}
.ct-pill{display:inline-block;font:600 12px/1 Barlow,sans-serif;border-radius:50px;padding:5px 10px}
.ct-pill.in{background:#eef6dc;color:#4f6d10}.ct-pill.out{background:#f7f7f7;color:#6b7078}
.ct-btn{border:1px solid #e3e4e6;background:#fff;color:#2b2f35;border-radius:8px;padding:5px 11px;font:600 13px Barlow,sans-serif;cursor:pointer;margin-left:4px}
.ct-btn.ammetti{border-color:#4f6d10;color:#4f6d10}.ct-btn.togli{border-color:#c0392b;color:#c0392b}
.ct-fisso{font-size:12px;color:#6b7078}
.ct-conferma-box{border:1px solid #e7500f;background:#fff1ea;border-radius:8px;padding:9px 11px;font-size:13px;margin-top:10px}
.ct-storia{display:grid;gap:3px;font-size:12.5px;color:#6b7078;margin-top:10px}.ct-storia b{color:#565c66}
@media (max-width:600px){.ct-wrap{height:calc(100dvh - 120px);border-radius:0;border-left:0;border-right:0}.ct-riga{max-width:92%}}
`;
    document.head.appendChild(st);
  }

  /* ════════ aggancio ════════ */
  if (haDom) {
    /* si avvia appena c'è l'accesso (lo script principale è un modulo e arriva dopo) */
    let tentativi = 0;
    const prova = () => {
      if (radice.S && radice.S.user && radice.sb) { avvia().catch((e) => console.warn('chat:', e)); return; }
      if (++tentativi < 240) setTimeout(prova, 500);
    };
    setTimeout(prova, 300);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && aperta()) nuovi().then(letti).catch(() => {}); });
    /* il riquadro «Chi è nella chat» si aggancia al giro della Zona Coordinatore, come visite-mese.js */
    const prima = radice.aggiornaZonaCoord;
    radice.aggiornaZonaCoord = async function () {
      const r = await Promise.allSettled([
        typeof prima === 'function' ? prima.apply(this, arguments) : Promise.resolve(),
        box(),
      ]);
      const ko = r.find((x) => x.status === 'rejected');
      if (ko) console.warn('zona coordinatore:', ko.reason);
    };
  }

  const api = { avvia, apri, box, iniziali, classeRuolo, linkifica, youtubeId, valutaFile, pezzo, giaRicevuti, giorno, visibile: () => !!(_stato && _stato.visibile) };
  radice.chatTeam = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
