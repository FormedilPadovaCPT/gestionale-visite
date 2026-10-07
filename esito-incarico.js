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

   Script classico: usa window.sb, window.toast, window.loadIncarichi.
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
      const b = $('esito-ok'); b.disabled = true;
      const { data: r, error } = await window.sb.rpc('incarico_esito_senza_visita', { p_id: Number(id), p_esito: tipo, p_data: data, p_nota: nota });
      b.disabled = false;
      if (error) { avviso('Esito non registrato: ' + error.message, 'err'); return; }
      chiudi();
      avviso(`Incarico n. ${id}: esito «${etichetta(r && r.esito)}» registrato. Ora lo chiude la segreteria.`, 'ok', 6000);
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

  window.EsitoIncarico = { apri, annulla, etichetta };
})();
