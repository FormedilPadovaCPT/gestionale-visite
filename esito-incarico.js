/* ============================================================
   ESITO SENZA VISITA — «🏁 Cantiere finito / non trovato»
   (07/10/2026, piano approvato dall'utente).

   Il tecnico va sul posto per un incarico ma il cantiere è finito,
   o all'indirizzo non c'è: non c'è niente da verbalizzare. Prima
   l'incarico restava aperto per sempre (si chiude solo con un
   verbale) e l'unico gesto era «✋ Non posso», che vuol dire «non
   sono disponibile» e porta a riassegnarlo.

   Ora il tecnico dichiara l'esito con la data in cui è andato e una
   nota su che cosa ha trovato (obbligatoria). Lo registra il
   database (incarico_esito_senza_visita): l'incarico passa a
   «eseguito» senza verbale, la segreteria lo trova fra quelli da
   chiudere con la nota, la pratica dei servizi collegata riceve
   l'esito. L'uscita si paga come una visita (decisione dell'utente),
   nella chiusura del mese. Finché la segreteria non chiude, il
   tecnico può ritirare l'esito (incarico_esito_annulla).

   FOTO (07/10/2026, chiesto dall'utente: «va gestita su Drive come
   quelle dei verbali»): fino a 3 foto a prova dell'uscita. Vanno su
   Drive con la funzione upload-foto, come quelle dei verbali, nella
   cartella «Foto Verbali CPT», sottocartella «INC-<numero>»; nel
   database solo il riferimento (incarichi_foto). L'esito si registra
   PRIMA delle foto: se il caricamento non riesce l'esito non si perde,
   e la foto si aggiunge dopo con «📷 aggiungi foto».

   Script classico: usa window.sb, window.toast, window.loadIncarichi,
   window.SB_URL e window.SB_KEY.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const avviso = (m, t, ms) => (window.toast ? window.toast(m, t, ms) : alert(m));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ETICHETTE = {
    cantiere_finito: 'cantiere già finito',
    cantiere_non_trovato: 'nessun cantiere all\'indirizzo',
    altro: 'visita non possibile',
  };
  const etichetta = (c) => ETICHETTE[c] || 'esito senza visita';
  const chiudi = () => { const o = $('esito-ov'); if (o) o.remove(); };
  const MAX_FOTO = 3;

  /* come le foto delle segnalazioni: lato lungo 1600 px, JPEG 0,82 */
  function comprimi(file) {
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(img.src);
        ok(cv.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      img.onerror = ko;
      img.src = URL.createObjectURL(file);
    });
  }

  /* carica le foto su Drive e le registra; dice quante sono andate e quante no (una che non va non ferma le altre) */
  async function caricaFoto(id, files) {
    const lista = Array.from(files || []).slice(0, MAX_FOTO);
    let fatte = 0; const errori = [];
    if (!lista.length) return { fatte, errori };
    const { data: { session } } = await window.sb.auth.getSession();
    const token = session && session.access_token;
    if (!token) return { fatte, errori: ['sessione scaduta: rientra e aggiungi la foto'] };
    for (let k = 0; k < lista.length; k++) {
      try {
        const b64 = await comprimi(lista[k]);
        const nome = `incarico_${id}_esito_${k + 1}_${Date.now()}.jpg`;
        const res = await fetch(`${window.SB_URL}/functions/v1/upload-foto`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, apikey: window.SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ nr_verbale: `INC-${id}`, tipo: 'esito', nome_file: nome, mime_type: 'image/jpeg', image_base64: b64 }),
        });
        const up = await res.json();
        if (!res.ok || up.error || !up.drive_file_id) throw new Error(up.error || 'caricamento su Drive non riuscito');
        const { error } = await window.sb.from('incarichi_foto').insert({
          incarico_id: Number(id), drive_file_id: up.drive_file_id, drive_url: up.drive_url || null, thumb_url: up.thumb_url || null,
          nome_file: nome, dimensione_kb: Math.round((b64.length * 3) / 4 / 1024),
        });
        if (error) throw new Error('la foto è su Drive ma non è stata registrata (' + error.message + ')');
        fatte++;
      } catch (e) { errori.push(`foto ${k + 1}: ${e.message || e}`); }
    }
    return { fatte, errori };
  }
  const esitoFoto = (id, r) => {
    if (r.errori.length) avviso(`Incarico n. ${id}: ${r.fatte} foto caricate, ${r.errori.length} no (${r.errori.join('; ')}). Riprova con «📷 aggiungi foto».`, 'warn', 9000);
    else if (r.fatte) avviso(`${r.fatte} ${r.fatte === 1 ? 'foto caricata' : 'foto caricate'} su Drive.`, 'ok');
  };
  const campoFoto = () => `<div class="field" style="margin-top:10px"><label>Foto a prova dell'uscita (facoltative, fino a ${MAX_FOTO})</label>
      <input type="file" id="esito-foto" accept="image/*" capture="environment" multiple>
      <div style="font-size:11px;color:#888;margin-top:3px">Vanno su Drive come le foto dei verbali, nella cartella dell'incarico.</div></div>`;
  const ricarica = () => (typeof window.loadIncarichi === 'function' ? window.loadIncarichi().catch(() => {}) : null);

  function apri(id) {
    chiudi();
    const ov = document.createElement('div');
    ov.id = 'esito-ov'; ov.className = 'modal-overlay'; ov.style.zIndex = '9999';
    ov.innerHTML = `<div class="modal-box" style="max-width:520px">
      <h3 style="margin-bottom:8px">🏁 Incarico n. ${esc(id)}: niente da verbalizzare</h3>
      <p style="font-size:13px;color:#444;margin:0 0 12px;line-height:1.5">Sei andato sul posto ma la visita non si poteva fare.
        L'incarico passa alla segreteria, che lo chiude; l'uscita si paga come una visita. Non nasce nessun verbale.</p>
      <div style="font-weight:600;margin-bottom:6px">Che cosa hai trovato?</div>
      <label style="display:flex;gap:8px;align-items:center;margin-bottom:5px;cursor:pointer"><input type="radio" name="esito-tipo" value="cantiere_finito" checked> I lavori erano già finiti</label>
      <label style="display:flex;gap:8px;align-items:center;margin-bottom:5px;cursor:pointer"><input type="radio" name="esito-tipo" value="cantiere_non_trovato"> All'indirizzo non c'è nessun cantiere</label>
      <label style="display:flex;gap:8px;align-items:center;margin-bottom:10px;cursor:pointer"><input type="radio" name="esito-tipo" value="altro"> Altro motivo (scrivilo sotto)</label>
      <div class="field" style="margin-bottom:10px"><label>Quando sei andato</label><input type="date" id="esito-data" value="${oggi()}" max="${oggi()}" style="max-width:180px"></div>
      <div class="field"><label>Nota per la segreteria (obbligatoria)</label>
        <textarea id="esito-nota" rows="3" placeholder="Es. lavori ultimati, area sgomberata; nessuno sul posto"></textarea></div>
      ${campoFoto()}
      <div class="modal-actions" style="margin-top:14px">
        <button type="button" class="btn-outline" id="esito-annulla">Annulla</button>
        <button type="button" class="btn-primary" id="esito-ok">Registra l'esito</button>
      </div></div>`;
    document.body.appendChild(ov);
    $('esito-annulla').onclick = chiudi;
    $('esito-ok').onclick = async () => {
      const tipo = (ov.querySelector('input[name="esito-tipo"]:checked') || {}).value;
      const data = $('esito-data').value;
      const nota = ($('esito-nota').value || '').trim();
      if (!data) { avviso('Scrivi la data in cui sei andato', 'warn'); return; }
      if (nota.length < 10) { avviso('Scrivi che cosa hai trovato: è quello che legge la segreteria', 'warn'); $('esito-nota').focus(); return; }
      const files = $('esito-foto') ? $('esito-foto').files : null;
      if (files && files.length > MAX_FOTO) { avviso(`Al massimo ${MAX_FOTO} foto`, 'warn'); return; }
      const b = $('esito-ok'); b.disabled = true; b.textContent = 'Registro…';
      const { data: r, error } = await window.sb.rpc('incarico_esito_senza_visita', { p_id: Number(id), p_esito: tipo, p_data: data, p_nota: nota });
      if (error) { b.disabled = false; b.textContent = 'Registra l\'esito'; avviso('Esito non registrato: ' + error.message, 'err'); return; }
      avviso(`Incarico n. ${id}: esito «${etichetta(r && r.esito)}» registrato. Ora lo chiude la segreteria.`, 'ok', 6000);
      if (files && files.length) { b.textContent = 'Carico le foto…'; esitoFoto(id, await caricaFoto(id, files)); }
      chiudi();
      ricarica();
    };
  }

  async function annulla(id) {
    if (!confirm(`Ritirare l'esito senza visita dell'incarico n. ${id}? Torna fra quelli da evadere.`)) return;
    const { error } = await window.sb.rpc('incarico_esito_annulla', { p_id: Number(id) });
    if (error) { avviso('Non ritirato: ' + error.message, 'err'); return; }
    avviso(`Incarico n. ${id}: esito ritirato, l'incarico è di nuovo da evadere.`, 'ok');
    ricarica();
  }

  /* aggiungere foto dopo (o rifare quelle non riuscite), finché l'incarico non è chiuso */
  function foto(id) {
    chiudi();
    const ov = document.createElement('div');
    ov.id = 'esito-ov'; ov.className = 'modal-overlay'; ov.style.zIndex = '9999';
    ov.innerHTML = `<div class="modal-box" style="max-width:460px">
      <h3 style="margin-bottom:8px">📷 Foto dell'incarico n. ${esc(id)}</h3>${campoFoto()}
      <div class="modal-actions" style="margin-top:14px">
        <button type="button" class="btn-outline" id="esito-annulla">Annulla</button>
        <button type="button" class="btn-primary" id="esito-ok">Carica</button>
      </div></div>`;
    document.body.appendChild(ov);
    $('esito-annulla').onclick = chiudi;
    $('esito-ok').onclick = async () => {
      const files = $('esito-foto').files;
      if (!files || !files.length) { avviso('Scegli almeno una foto', 'warn'); return; }
      if (files.length > MAX_FOTO) { avviso(`Al massimo ${MAX_FOTO} foto`, 'warn'); return; }
      const b = $('esito-ok'); b.disabled = true; b.textContent = 'Carico…';
      esitoFoto(id, await caricaFoto(id, files));
      chiudi(); ricarica();
    };
  }

  /* le miniature, con il link al file su Drive */
  const fotoHtml = (lista) => (lista || []).map((f) => `<a href="${esc(f.drive_url || '#')}" target="_blank" rel="noopener" title="Apri la foto su Drive">`
    + (f.thumb_url ? `<img src="${esc(f.thumb_url)}" alt="foto" style="height:56px;border-radius:5px;margin:4px 4px 0 0;border:1px solid #e6c88f">` : '📷 foto') + '</a>').join('');

  window.EsitoIncarico = { apri, annulla, foto, fotoHtml, etichetta, caricaFoto };
})();
