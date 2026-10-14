/* ============================================================
   📚 FORMAZIONE — la pagina del DOCENTE per il corso (14/10/2026, lotto 5
   del fascicolo corso digitale, progetto § 5.3)

   Per ogni corso in cui chi è collegato compare come docente (interventi
   o incarico), il riquadro «🧑‍🏫 I miei corsi» mostra:
     · l'INCARICO: la lettera firmata dal Presidente da leggere e
       «✅ Accetto l'incarico» (riga accettazione_incarico nel registro
       delle firme, firmata subito: la fa firma-documenti, che disegna il
       PDF con documenti-corso, lo carica e firma);
     · le GIORNATE: per ciascuna gli iscritti con le firme arrivate dal
       QR (entrata/uscita, ora del server, «fuori orario»), «✓ Confermo»
       PER ALLIEVO (deciso dall'utente), «✗» con una parola, le presenze
       segnate a mano (assente, firma su carta), gli argomenti svolti del
       proprio intervento, «➕ Aggiungi allievo» (PRIMA della firma:
       persona per CF, mansione obbligatoria, codice personale subito,
       ripubblicazione sul portale), il PDF del registro della giornata e
       «✍️ Firmo il registro di oggi» (rifiutato finché ci sono firme da
       guardare o iscritti senza presenza).
   Tutto passa dalle RPC corso_docente_* e da firma-documenti: nessuna
   lettura o scrittura diretta sulle tabelle dei corsi.
   Chi lo vede: i docenti (tecnici o esterni) per i propri corsi; la
   segreteria e l'RPF vedono tutti i corsi aperti, senza i pulsanti che il
   server rifiuterebbe loro (accettazione, firma del registro).

   Script classico: usa window.sb, window.S, window.toast, window.firmeApp;
   espone window.formazioneDocente.box(host, R). Lo chiama formazione.js.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dIt = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const oraIt = (ts) => (ts ? new Date(ts).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }) : '—');
  const quandoIt = (ts) => (ts ? new Date(ts).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const avviso = (msg, tipo) => (window.toast ? window.toast(msg, tipo) : alert(msg));
  const email = () => String((window.S && window.S.user && window.S.user.email) || '').toLowerCase();
  const BUCKET = 'firme-presidente';
  const pill = (testo, tono) => `<span style="font-size:11px;padding:1px 7px;border-radius:10px;background:${tono === 'ok' ? '#e8f3d6' : tono === 'no' ? '#fde0d8' : tono === 'att' ? '#fde9dd' : '#eee'};color:#444">${esc(testo)}</span>`;

  let _corsi = [];
  async function leggi() {
    const { data, error } = await window.sb.rpc('corso_docente_corsi');
    if (error) throw new Error(error.message);
    _corsi = Array.isArray(data) ? data : [];
  }
  async function rpc(nome, args, okMsg) {
    const { data, error } = await window.sb.rpc(nome, args);
    if (error) { avviso('Non riuscito: ' + error.message, 'err'); throw error; }
    if (okMsg) avviso(okMsg, 'ok');
    return data;
  }
  async function chiamaFirme(corpo) {
    const { data: out, error: e } = await window.sb.functions.invoke('firma-documenti', { body: corpo });
    if (e || out?.error) {
      let msg = out?.error; try { msg = msg || (await e.context.json()).error; } catch (_x) { /* niente */ }
      throw new Error(msg || e?.message || 'richiesta non riuscita');
    }
    return out;
  }
  /* un PDF del bucket (link a tempo) o generato da documenti-corso, in una scheda nuova */
  async function apriBucket(percorso) {
    const w = window.open('', '_blank');
    const { data: u, error: e } = await window.sb.storage.from(BUCKET).createSignedUrl(percorso, 600);
    if (e || !u?.signedUrl) { if (w) w.close(); avviso('Non riesco ad aprire il documento: ' + (e?.message || ''), 'err'); return false; }
    if (w) w.location.href = u.signedUrl; else window.location.href = u.signedUrl;
    return true;
  }
  async function pdf(azione, id, btn) {
    const w = window.open('', '_blank');
    if (btn) btn.disabled = true;
    try {
      const { data, error } = await window.sb.functions.invoke('documenti-corso', { body: { azione, id } });
      if (error || data?.error) {
        let msg = data?.error; try { msg = msg || (await error.context.json()).error; } catch (_x) { /* niente */ }
        throw new Error(msg || error?.message || 'PDF non generato');
      }
      const byte = Uint8Array.from(atob(data.pdf_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([byte], { type: 'application/pdf' }));
      if (w) w.location.href = url; else window.open(url, '_blank');
    } catch (e) { if (w) w.close(); avviso('PDF non generato: ' + e.message, 'err'); }
    if (btn) btn.disabled = false;
  }

  /* ── finestra ── */
  function finestra(titolo, html) {
    chiudi();
    const f = document.createElement('div');
    f.id = 'fd-finestra';
    f.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9500;display:flex;align-items:center;justify-content:center;padding:12px';
    f.innerHTML = `<div style="background:#fff;border-radius:10px;max-width:980px;width:100%;max-height:94vh;overflow:auto;border-top:5px solid #e7500f;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;color:#222">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 6px;gap:10px;position:sticky;top:0;background:#fff;z-index:1">
        <strong style="font-size:16px;color:#565c66">${titolo}</strong>
        <button type="button" data-chiudi style="background:none;border:0;font-size:20px;cursor:pointer;color:#888" data-aiuto="Chiude la finestra.">✕</button></div>
      <div id="fd-corpo" style="padding:6px 18px 16px">${html}</div></div>`;
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-chiudi]')) chiudi(); });
    document.body.appendChild(f);
    return f;
  }
  function chiudi() { const f = $('fd-finestra'); if (f) f.remove(); }

  /* ── il riquadro ── */
  async function box(host, R) {
    if (!host || !R) return;
    try { await leggi(); } catch (e) {
      host.innerHTML = `<div class="card" style="border-left:4px solid #c0392b"><h3>🧑‍🏫 I miei corsi</h3><p style="font-size:13px;color:#c0392b;margin:0">Non sono riuscito a leggere i corsi: ${esc(e.message)}</p></div>`;
      return;
    }
    const me = email();
    const miei = _corsi.filter((c) => c.mio);
    const altri = _corsi.filter((c) => !c.mio);
    const rigaCorso = (c) => {
      const k = c.incarico;
      let inc = '';
      if (k) {
        if (k.accettato_il) inc = `${pill('incarico accettato il ' + dIt(k.accettato_il), 'ok')} ${k.accettazione?.file ? `<a href="#" data-fd-apri="${esc(k.accettazione.file)}" style="font-size:12px;color:var(--orange,#e7500f);font-weight:600">apri l'accettazione</a>` : ''}`;
        else if (k.lettera && k.lettera.stato === 'firmata') inc = `${pill('incarico da accettare', 'att')}
          <button class="btn-secondary btn-sm" type="button" data-fd-lettera="${esc(k.lettera.file || '')}" data-aiuto="Apre la lettera di incarico firmata dal Presidente.">📄 Leggi la lettera</button>
          <button class="btn-primary btn-sm" type="button" data-fd-accetta="${k.id}" data-aiuto="Accetti l'incarico di docenza: il documento di accettazione viene generato e firmato con data e ora, e la segreteria lo trova nel fascicolo. Non si torna indietro.">✅ Accetto l'incarico</button>`;
        else inc = pill(k.lettera ? 'lettera di incarico in firma al Presidente' : 'lettera di incarico non ancora preparata', '');
      }
      const righeG = (c.giornate || []).map((g) => {
        const r = g.registro;
        const regTxt = !r ? 'registro da firmare'
          : r.stato === 'firmata' ? `registro firmato il ${dIt(r.firmata_il)}`
          : r.stato === 'rimandata' ? 'registro rimandato'
          : r.stato === 'in_attesa' ? (String(r.firmatario || '').toLowerCase() === me ? 'registro: tocca a te firmare' : `registro: in attesa di ${r.firmatario}`)
          : 'registro in firma';
        const posso = c.mio && !g.firmato_da_me && (!r || (r.stato === 'in_attesa' && String(r.firmatario || '').toLowerCase() === me) || r.stato === 'rimandata');
        const eOggi = String(g.data).slice(0, 10) === oggi();
        return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;border-top:1px solid #f0e6dd">
          <span style="flex:1;min-width:220px;font-size:13px"><strong>${dIt(g.data)}</strong>${eOggi ? ' <span style="color:#e7500f;font-weight:600">oggi</span>' : ''} <span style="color:#888;font-size:12px">${[g.dalle && g.alle ? g.dalle + '–' + g.alle : '', g.dalle2 && g.alle2 ? g.dalle2 + '–' + g.alle2 : '', g.aula].filter(Boolean).join(' · ')}</span><br>
            <span style="font-size:11.5px;color:#888">${(g.interventi || []).map((i) => (i.mio ? '<strong>' + esc(i.nominativo) + '</strong>' : esc(i.nominativo))).join(', ') || 'nessun docente nel programma'} · presenze ${g.con_presenza}/${c.iscritti_n}${g.da_guardare ? ` · <span style="color:#b35c00;font-weight:600">${g.da_guardare} firme dal QR da guardare</span>` : ''} · ${esc(regTxt)}</span></span>
          <button class="btn-primary btn-sm" type="button" data-fd-giornata="${g.id}" data-aiuto="Apre la giornata: gli iscritti con le firme arrivate dal QR, le presenze da confermare o segnare, gli argomenti svolti, l'aggiunta di un allievo.">📋 Apri</button>
          <button class="btn-secondary btn-sm" type="button" data-fd-reg="${g.id}" data-aiuto="Apre il PDF del registro della giornata com'è adesso: presenze confermate dal telefono, su carta, assenti.">📄</button>
          ${posso ? `<button class="btn-secondary btn-sm" type="button" data-fd-firma-reg="${g.id}" data-aiuto="Firmi il registro di questa giornata: il PDF viene generato e firmato con data e ora. Si può firmare solo quando tutte le firme dal QR sono confermate o respinte e ogni iscritto ha la presenza segnata.">✍️ Firmo il registro</button>` : ''}
          ${r && r.file && r.stato === 'firmata' ? `<a href="#" data-fd-apri="${esc(r.file)}" style="font-size:12px;color:var(--orange,#e7500f);font-weight:600">firmato</a>` : ''}
        </div>`;
      }).join('');
      return `<div style="padding:10px 0;border-top:2px solid #f0e6dd">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="flex:1;min-width:240px;font-size:13.5px"><strong>n. ${c.id}</strong> ${esc(c.titolo)}<br><span style="font-size:11.5px;color:#888">${dIt(c.data_inizio)}${c.data_fine && c.data_fine !== c.data_inizio ? ' → ' + dIt(c.data_fine) : ''} · ${esc(c.sede || '')} · ${esc(c.stato)} · ${c.iscritti_n} iscritti${c.pres_codice ? ` · firme dal QR ${c.pres_codice}${c.pres_pubblicato_il ? '' : ' <span style="color:#b35c00">(non sul portale)</span>'}` : ' · firme dal QR non aperte (le apre la segreteria)'}</span></span>
          <span>${inc}</span>
        </div>
        ${righeG || '<p style="font-size:12.5px;color:#777;margin:6px 0 0">Nessuna giornata in calendario.</p>'}
      </div>`;
    };
    host.innerHTML = `<div class="card" style="border-left:4px solid var(--orange,#e7500f)">
      <h3>🧑‍🏫 I miei corsi${R.capo && !miei.length ? ' <span style="font-size:12px;color:#888;font-weight:400">(vista della segreteria / del responsabile: tutti i corsi aperti)</span>' : ''}</h3>
      <p style="font-size:12.5px;color:#555;margin:0 0 6px">Per ogni corso: l'incarico da accettare, le giornate con le firme degli allievi arrivate dal QR da confermare <strong>per allievo</strong>, le presenze segnate a mano, gli argomenti svolti, l'aggiunta di un allievo in aula e la firma del registro della giornata.</p>
      ${miei.map(rigaCorso).join('')}
      ${R.capo && altri.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;color:#565c66">Gli altri corsi aperti (${altri.length})</summary>${altri.map(rigaCorso).join('')}</details>` : ''}
      ${!miei.length && !altri.length ? '<p style="font-size:13px;color:#555;margin:0">Nessun corso in cui compari come docente. Se ti aspettavi un corso, chiedi alla segreteria di metterti nel programma.</p>' : ''}
    </div>`;
    host.querySelectorAll('[data-fd-apri]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); apriBucket(a.dataset.fdApri); }));
    host.querySelectorAll('[data-fd-lettera]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.fdLettera) apriBucket(b.dataset.fdLettera); else avviso('La lettera firmata non è ancora disponibile.', 'err'); }));
    host.querySelectorAll('[data-fd-accetta]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Accetto l\'incarico di docenza?\n\nIl documento di accettazione viene generato e firmato adesso, con data e ora, e la segreteria lo trova nel fascicolo del corso. Non si torna indietro.')) return;
      b.disabled = true; b.textContent = 'Firmo…';
      try { await chiamaFirme({ azione: 'accetta_incarico', id: Number(b.dataset.fdAccetta) }); avviso('Incarico accettato e firmato.', 'ok'); }
      catch (e) { avviso('Non riuscito: ' + e.message, 'err'); b.disabled = false; b.textContent = '✅ Accetto l\'incarico'; return; }
      box(host, R);
    }));
    host.querySelectorAll('[data-fd-reg]').forEach((b) => b.addEventListener('click', () => pdf('registro_giornata', Number(b.dataset.fdReg), b)));
    host.querySelectorAll('[data-fd-firma-reg]').forEach((b) => b.addEventListener('click', () => firmaRegistro(Number(b.dataset.fdFirmaReg), host, R)));
    host.querySelectorAll('[data-fd-giornata]').forEach((b) => b.addEventListener('click', () => apriGiornata(Number(b.dataset.fdGiornata), host, R)));
  }

  async function firmaRegistro(gid, host, R) {
    let pronto;
    try { pronto = await rpc('corso_docente_registro_pronto', { p_giornata: gid }); } catch (_e) { return; }
    if (!pronto?.ok) { avviso('Il registro non si può ancora firmare: ' + (pronto?.motivo || 'controlla la giornata') + '.', 'err'); return; }
    if (!confirm('Firmo il registro di questa giornata?\n\nIl PDF viene generato con le presenze di adesso (dal telefono confermate, su carta, assenti) e firmato con data e ora. Non si torna indietro.')) return;
    try { const out = await chiamaFirme({ azione: 'firma_registro', id: gid }); avviso(out?.seguente ? 'Registro firmato: passa all\'altro docente della giornata.' : 'Registro della giornata firmato.', 'ok'); }
    catch (e) { avviso('Non riuscito: ' + e.message, 'err'); return; }
    box(host, R);
  }

  /* ── la giornata ── */
  async function apriGiornata(gid, host, R) {
    let d;
    try { d = await rpc('corso_docente_giornata', { p_giornata: gid }); } catch (_e) { return; }
    const g = d.giornata, c = d.corso;
    const corso = _corsi.find((x) => x.id === c.id) || {};
    const gInfo = (corso.giornate || []).find((x) => x.id === gid) || {};
    const miei = (gInfo.interventi || []).filter((i) => i.mio);
    const mio = !!corso.mio || !!R.segr;
    const dis = mio ? '' : 'disabled';
    const firmaTxt = (f) => `${f.tipo || 'senza momento'}${f.turno ? ' ' + f.turno : ''} ${oraIt(f.ora_server)}${f.fuori_orario ? ' <span style="color:#b35c00">fuori orario</span>' : ''}${f.anno_corrisponde === false ? ' <span style="color:#c0392b;font-weight:600" title="L’anno di nascita scritto alla firma non è quello della persona: guarda chi è prima di confermare">anno ≠</span>' : ''}${f.fonte && f.fonte !== 'qr' ? ' (' + esc(f.fonte) + ')' : ''}`;
    const rigaI = (i) => {
      const p = i.presenza;
      const firme = Array.isArray(i.firme) ? i.firme : [];
      const ricevute = firme.filter((f) => f.stato === 'ricevuta');
      /* la conferma di gruppo salta le fuori orario e quelle con l'anno di nascita che non torna (14/10/2026) */
      const inOrario = ricevute.filter((f) => !f.fuori_orario && f.anno_corrisponde !== false).length;
      const presTxt = !p ? '<span style="color:#b35c00">da segnare</span>' : p.presente === false ? pill('assente', 'no')
        : pill(['presente', p.ingresso1 ? 'in ' + String(p.ingresso1).slice(0, 5) : '', p.uscita1 ? 'out ' + String(p.uscita1).slice(0, 5) : '', p.ingresso2 ? 'in ' + String(p.ingresso2).slice(0, 5) : '', p.uscita2 ? 'out ' + String(p.uscita2).slice(0, 5) : '', p.ore != null ? p.ore + ' h' : ''].filter(Boolean).join(' · '), 'ok');
      return `<tr data-i="${i.id}" style="border-top:1px solid #f0e6dd">
        <td style="padding:6px 4px;font-size:13px;vertical-align:top"><strong>${esc(i.nominativo)}</strong>${i.test_codice ? ` <span style="font-size:11px;color:#e7500f;font-weight:700">${esc(i.test_codice)}</span>` : ''}<br><span style="font-size:11px;color:#888">${esc(i.impresa_txt || '—')} · ${i.mansione ? esc(i.mansione) : '<span style="color:#b35c00">mansione mancante</span>'}${i.aggiunto_in_aula_il ? ' · aggiunto in aula' : ''}</span></td>
        <td style="padding:6px 4px;font-size:12px;vertical-align:top">${firme.length ? firme.map((f) => `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${f.stato === 'confermata' ? '✅' : f.stato === 'respinta' ? '✗' : '⏳'} ${firmaTxt(f)}${f.note ? ` <span style="color:#888">· ${esc(f.note)}</span>` : ''}
            ${mio && f.stato === 'ricevuta' ? `<a href="#" data-fd-conf="${f.id}" style="color:#2d7d1f;font-weight:600">✓</a> <a href="#" data-fd-resp="${f.id}" style="color:#c0392b;font-weight:600">✗</a>` : ''}</div>`).join('') : '<span style="color:#aaa">nessuna firma dal QR</span>'}</td>
        <td style="padding:6px 4px;font-size:12px;vertical-align:top">${presTxt}</td>
        <td style="padding:6px 4px;white-space:nowrap;vertical-align:top">
          ${mio && inOrario ? `<button class="btn-primary btn-sm" type="button" data-fd-conf-all="${i.id}" data-aiuto="Conferma tutte le firme in orario di questo allievo per oggi: diventano presenze. Le fuori orario e quelle con l'anno di nascita sbagliato restano da guardare una per una.">✓ Confermo (${inOrario})</button>` : ''}
          <button class="btn-secondary btn-sm" type="button" data-fd-pres="${i.id}" data-modo="carta" ${dis} data-aiuto="L'allievo ha firmato sul registro di carta: la presenza prende gli orari della giornata dove manca una firma dal QR confermata.">su carta</button>
          <button class="btn-secondary btn-sm" type="button" data-fd-pres="${i.id}" data-modo="assente" ${dis} data-aiuto="Segna l'allievo assente per questa giornata.">assente</button>
          ${p ? `<button class="btn-outline btn-sm" type="button" data-fd-pres="${i.id}" data-modo="togli" ${dis} data-aiuto="Toglie la presenza segnata a mano (non si può se ci sono firme dal QR confermate).">↩</button>` : ''}
        </td></tr>`;
    };
    finestra(`📋 Giornata del ${dIt(g.data)} — corso n. ${c.id} «${esc(c.titolo)}»`, `
      <p style="font-size:12px;color:#777;margin:0 0 8px">${[g.dalle && g.alle ? g.dalle + '–' + g.alle : '', g.dalle2 && g.alle2 ? g.dalle2 + '–' + g.alle2 : '', g.aula].filter(Boolean).join(' · ')}${c.pres_codice ? ` · firme dal QR <strong>${esc(c.pres_codice)}</strong>` : ' · firme dal QR non aperte: le presenze si segnano a mano'}</p>
      ${miei.length ? `<h4 style="margin:6px 0 4px;font-size:13px;color:#e7500f">I tuoi argomenti svolti</h4>${miei.map((iv) => `<div style="margin-bottom:6px"><span style="font-size:12px;color:#666">${esc([iv.qualita, iv.dalle && iv.alle ? iv.dalle + '–' + iv.alle : '', iv.materia].filter(Boolean).join(' · '))}</span>
        <div style="display:flex;gap:6px"><textarea data-fd-arg="${iv.id}" rows="2" style="flex:1;font-size:13px">${esc(iv.argomenti || '')}</textarea><button class="btn-secondary btn-sm" type="button" data-fd-arg-salva="${iv.id}" data-aiuto="Salva gli argomenti svolti nel tuo intervento: finiscono sul registro della giornata.">💾</button></div></div>`).join('')}` : ''}
      <h4 style="margin:10px 0 4px;font-size:13px;color:#e7500f">Allievi (${(d.iscritti || []).length})</h4>
      <div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="font-size:11px;color:#888;text-align:left"><th style="padding:4px">Allievo · codice</th><th style="padding:4px">Firme dal QR</th><th style="padding:4px">Presenza</th><th></th></tr></thead>
      <tbody id="fd-isc">${(d.iscritti || []).map(rigaI).join('') || '<tr><td colspan="4" style="padding:8px;color:#777;font-size:13px">Nessun iscritto.</td></tr>'}</tbody></table></div>
      ${(d.non_riconosciute || []).length ? `<p style="font-size:12px;color:#b35c00;margin:6px 0 0">⚠ ${d.non_riconosciute.length} firme arrivate oggi con un codice non riconosciuto (${d.non_riconosciute.map((f) => oraIt(f.ora_server)).join(', ')}): chi le ha fatte riscriva il codice del suo biglietto (qui lo vedi accanto al nome, se l’ha perso diglielo tu), o va aggiunto prima.</p>` : ''}
      <div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px;flex-wrap:wrap">
        <div>${mio ? '<button type="button" class="btn-secondary btn-sm" id="fd-add" data-aiuto="Aggiunge un allievo che c\'è in aula ma non è in elenco: si cerca per codice fiscale o cognome, o si codifica nuovo. La mansione è obbligatoria; il codice personale per firmare gli viene dato subito.">➕ Aggiungi allievo</button>' : ''}</div>
        <div style="display:flex;gap:8px"><button type="button" class="btn-outline btn-sm" data-chiudi>Chiudi</button>
          <button type="button" class="btn-secondary btn-sm" id="fd-pdf" data-aiuto="Apre il PDF del registro della giornata com'è adesso.">📄 Registro</button>
          ${mio ? '<button type="button" class="btn-primary btn-sm" id="fd-firma" data-aiuto="Firmi il registro della giornata: tutte le firme dal QR devono essere confermate o respinte e ogni iscritto deve avere la presenza segnata.">✍️ Firmo il registro</button>' : ''}</div>
      </div>`);
    const corpo = $('fd-corpo');
    const ricarica = () => apriGiornata(gid, host, R);
    corpo.querySelectorAll('[data-fd-conf]').forEach((a) => a.addEventListener('click', async (e) => { e.preventDefault(); try { await rpc('pres_conferma', { p_id: Number(a.dataset.fdConf), p_stato: 'confermata', p_nota: null }); ricarica(); } catch (_x) { /* detto */ } }));
    corpo.querySelectorAll('[data-fd-resp]').forEach((a) => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const nota = prompt('Perché la respingi? (una parola basta: resta scritta sulla firma)');
      if (nota === null) return;
      try { await rpc('pres_conferma', { p_id: Number(a.dataset.fdResp), p_stato: 'respinta', p_nota: nota }); ricarica(); } catch (_x) { /* detto */ }
    }));
    corpo.querySelectorAll('[data-fd-conf-all]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { const n = await rpc('pres_conferma_allievo', { p_iscritto_id: Number(b.dataset.fdConfAll), p_giornata_id: gid }); avviso(`${n} firme confermate.`, 'ok'); ricarica(); } catch (_x) { b.disabled = false; }
    }));
    corpo.querySelectorAll('[data-fd-pres]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await rpc('corso_docente_presenza', { p_iscritto: Number(b.dataset.fdPres), p_giornata: gid, p_modo: b.dataset.modo }); ricarica(); } catch (_x) { b.disabled = false; }
    }));
    corpo.querySelectorAll('[data-fd-arg-salva]').forEach((b) => b.addEventListener('click', async () => {
      const ta = corpo.querySelector(`[data-fd-arg="${b.dataset.fdArgSalva}"]`);
      b.disabled = true;
      try { await rpc('corso_docente_argomenti', { p_intervento: Number(b.dataset.fdArgSalva), p_argomenti: ta ? ta.value : '' }, 'Argomenti salvati.'); await leggi(); } catch (_x) { /* detto */ }
      b.disabled = false;
    }));
    const bp = $('fd-pdf'); if (bp) bp.addEventListener('click', () => pdf('registro_giornata', gid, bp));
    const bf = $('fd-firma'); if (bf) bf.addEventListener('click', async () => { await firmaRegistro(gid, host, R); chiudi(); });
    const ba = $('fd-add'); if (ba) ba.addEventListener('click', () => aggiungiAllievo(c.id, gid, host, R));
  }

  /* ── aggiungere un allievo in aula (PRIMA della firma) ── */
  function aggiungiAllievo(corsoId, gid, host, R) {
    finestra(`➕ Aggiungi un allievo — corso n. ${corsoId}`, `
      <p style="font-size:12.5px;color:#555;margin:0 0 8px">Cerca per <strong>codice fiscale</strong> o cognome: se la persona è già in anagrafica si prende quella (con l'impresa del rapporto attivo). Se non c'è, «Codifica nuovo». La <strong>mansione</strong> è obbligatoria: va nell'analisi aula del progetto formativo. L'allievo va aggiunto <strong>prima</strong> che firmi dal telefono: il codice personale gli viene dato subito.</p>
      <div class="field"><label style="font-size:11.5px;color:#666">Cerca persona (CF o cognome)</label><input id="fd-q" type="text" autocomplete="off" style="width:100%;font-size:14px;text-transform:uppercase" placeholder="RSSMRA80A01… oppure ROSSI"></div>
      <div id="fd-ris" style="font-size:13px"></div>
      <div id="fd-nuovo" style="display:none;margin-top:8px;border-top:1px solid #f0e6dd;padding-top:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px">
          <div class="field"><label style="font-size:11.5px;color:#666">Cognome *</label><input id="fd-cogn" type="text" style="width:100%"></div>
          <div class="field"><label style="font-size:11.5px;color:#666">Nome *</label><input id="fd-nome" type="text" style="width:100%"></div>
          <div class="field"><label style="font-size:11.5px;color:#666">Codice fiscale *</label><input id="fd-cf" type="text" maxlength="16" style="width:100%;text-transform:uppercase"></div>
        </div>
      </div>
      <div id="fd-dati" style="display:none;margin-top:8px;border-top:1px solid #f0e6dd;padding-top:8px">
        <div id="fd-chi" style="font-size:13px;margin-bottom:6px"></div>
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px">
          <div class="field"><label style="font-size:11.5px;color:#666">Impresa (cerca per P.IVA o nome, oppure scrivila)</label><input id="fd-imp" type="text" autocomplete="off" style="width:100%" placeholder="P.IVA o ragione sociale"><div id="fd-imp-ris" style="font-size:12px"></div><input type="hidden" id="fd-imp-id"></div>
          <div class="field"><label style="font-size:11.5px;color:#666">Mansione *</label><input id="fd-mans" type="text" style="width:100%" placeholder="es. operaio, preposto, carpentiere"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button type="button" class="btn-outline btn-sm" data-chiudi>Annulla</button><button type="button" class="btn-primary btn-sm" id="fd-salva" data-aiuto="Iscrive l'allievo al corso, gli assegna il codice personale e rimanda il corso al portale: da quel momento può firmare dal telefono.">💾 Aggiungi e dai il codice</button></div>
      </div>`);
    const corpo = $('fd-corpo');
    let scelta = null;   // { persona_id, nome, cognome, cf, impresa_id, impresa, mansione } oppure null = nuovo
    let t = null;
    const mostraDati = () => {
      $('fd-dati').style.display = '';
      $('fd-chi').innerHTML = scelta
        ? `<strong>${esc(scelta.cognome)} ${esc(scelta.nome)}</strong> · ${esc(scelta.cf || '—')} <span style="font-size:11px;color:#888">(in anagrafica)</span>`
        : '<strong>Persona nuova</strong>: compila cognome, nome e codice fiscale qui sopra.';
      if (scelta) {
        $('fd-imp').value = scelta.impresa || ''; $('fd-imp-id').value = scelta.impresa_id || '';
        if (scelta.mansione && !$('fd-mans').value) $('fd-mans').value = scelta.mansione;
      }
      $('fd-mans').focus();
    };
    $('fd-q').addEventListener('input', () => {
      clearTimeout(t);
      const q = $('fd-q').value.trim();
      t = setTimeout(async () => {
        if (q.length < 3) { $('fd-ris').innerHTML = ''; return; }
        const { data, error } = await window.sb.rpc('corso_docente_cerca_persona', { p_corso: corsoId, p_q: q });
        if (error) { $('fd-ris').innerHTML = `<span style="color:#c0392b">Ricerca non riuscita: ${esc(error.message)}</span>`; return; }
        const lista = Array.isArray(data) ? data : [];
        $('fd-ris').innerHTML = `${lista.map((p, i) => `<div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-top:1px solid #f4f4f4"><span style="flex:1"><strong>${esc(p.cognome)} ${esc(p.nome)}</strong> · ${esc(p.cf || '—')}${p.impresa ? ' · ' + esc(p.impresa) : ''}${p.gia_iscritto ? ' <span style="color:#2d7d1f">già iscritto</span>' : ''}</span>${p.gia_iscritto ? '' : `<button class="btn-secondary btn-sm" type="button" data-fd-scegli="${i}">Scegli</button>`}</div>`).join('')}
          <div style="padding:6px 0"><button class="btn-outline btn-sm" type="button" id="fd-codifica">➕ Codifica nuovo${lista.length ? ' (non è fra questi)' : ''}</button></div>`;
        $('fd-ris').querySelectorAll('[data-fd-scegli]').forEach((b) => b.addEventListener('click', () => { scelta = lista[Number(b.dataset.fdScegli)]; $('fd-nuovo').style.display = 'none'; mostraDati(); }));
        const bc = $('fd-codifica'); if (bc) bc.addEventListener('click', () => { scelta = null; $('fd-nuovo').style.display = ''; if (/^[A-Z0-9]{16}$/i.test(q)) $('fd-cf').value = q.toUpperCase(); else $('fd-cogn').value = q; mostraDati(); });
      }, 300);
    });
    let ti = null;
    $('fd-imp').addEventListener('input', () => {
      clearTimeout(ti); $('fd-imp-id').value = '';
      const q = $('fd-imp').value.trim();
      ti = setTimeout(async () => {
        if (q.length < 3) { $('fd-imp-ris').innerHTML = ''; return; }
        const { data, error } = await window.sb.rpc('corso_docente_cerca_impresa', { p_q: q });
        if (error) { $('fd-imp-ris').innerHTML = `<span style="color:#c0392b">${esc(error.message)}</span>`; return; }
        const lista = Array.isArray(data) ? data : [];
        $('fd-imp-ris').innerHTML = lista.map((im, i) => `<div style="padding:3px 0;border-top:1px solid #f4f4f4"><a href="#" data-fd-imp-scegli="${i}">${esc(im.ragione_sociale)}</a> <span style="color:#888">${esc(im.piva || im.impresa_id || '')}${im.comune ? ' · ' + esc(im.comune) : ''}</span></div>`).join('') + (lista.length ? '' : '<span style="color:#888">Nessuna impresa trovata: resta scritta com\'è, la segreteria la sistema.</span>');
        $('fd-imp-ris').querySelectorAll('[data-fd-imp-scegli]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); const im = lista[Number(a.dataset.fdImpScegli)]; $('fd-imp').value = im.ragione_sociale; $('fd-imp-id').value = im.impresa_id; $('fd-imp-ris').innerHTML = ''; }));
      }, 300);
    });
    $('fd-salva').addEventListener('click', async (ev) => {
      const b = ev.currentTarget;
      const p = { mansione: $('fd-mans').value.trim(), impresa_id: $('fd-imp-id').value || null, impresa_txt: $('fd-imp-id').value ? null : ($('fd-imp').value.trim() || null) };
      if (scelta) p.persona_id = scelta.persona_id;
      else { p.cognome = $('fd-cogn').value.trim(); p.nome = $('fd-nome').value.trim(); p.cf = $('fd-cf').value.trim().toUpperCase(); }
      if (!p.mansione) { avviso('La mansione è obbligatoria.', 'err'); return; }
      b.disabled = true;
      let out;
      try { out = await rpc('corso_docente_aggiungi_allievo', { p_corso: corsoId, p }); }
      catch (_x) { b.disabled = false; return; }
      finestra('✅ Allievo aggiunto', `
        <p style="font-size:14px;margin:0 0 6px"><strong>${esc(out.nominativo)}</strong>${out.impresa_txt ? ' · ' + esc(out.impresa_txt) : ''}${out.persona_nuova ? ' <span style="font-size:11px;color:#888">(persona nuova in anagrafica: la segreteria la verifica)</span>' : ''}</p>
        ${out.firme_aperte ? `<p style="font-size:14px;margin:0 0 4px">Dagli questo codice per firmare dal telefono:</p><p style="font-size:34px;font-weight:700;color:#e7500f;letter-spacing:.15em;margin:0 0 8px">${esc(out.codice || '—')}</p>
          <p style="font-size:12px;color:${out.ripubblicato ? '#2d7d1f' : '#b35c00'};margin:0">${out.ripubblicato ? 'Il corso è stato rimandato al portale: fra un minuto il codice funziona.' : 'Il corso NON è stato rimandato al portale: finché la segreteria non lo ripubblica, il codice non apre la firma.'}</p>`
          : `<p style="font-size:13px;color:#555;margin:0">Codice personale: <strong>${esc(out.codice || '—')}</strong>. Le firme dal QR di questo corso non sono aperte: la presenza si segna a mano (su carta).</p>`}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn-primary btn-sm" id="fd-ok">Torna alla giornata</button></div>`);
      $('fd-ok').addEventListener('click', () => apriGiornata(gid, host, R));
    });
    $('fd-q').focus();
  }

  window.formazioneDocente = { box };
})();
