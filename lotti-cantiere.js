/* ============================================================
   LOTTI DEL CANTIERE — guidati dal verbale
   (07/10/2026, deciso dall'utente: «deve essere semplificata e più
   semplice per il tecnico»).

   Il tecnico parte dal cantiere CNCE caricato dalla lista della
   Cassa e scopre sul posto che il complesso ha più lotti. Dalla
   scheda del cantiere nel verbale preme «🧩 Ha più lotti»:
     · la scheda di partenza diventa uno dei lotti (nome proposto 1)
       e tiene le visite già fatte;
     · se oggi è in un altro lotto, nasce una COPIA IDENTICA della
       scheda col suo nome di lotto, e il verbale si aggancia lì.
   Le imprese stanno sulla visita, non sul cantiere: ogni lotto ha
   le sue. Lo fa il database (crea_lotto_cantiere), in un colpo solo.
   Sui lotti già creati il pulsante mostra l'elenco: si sceglie
   quello giusto, se ne aggiunge un altro, e una copia creata per
   sbaglio e senza visite si toglie (togli_lotto_cantiere).

   Script classico: usa window.sb, window.toast e
   window._verbaleUsaCantiere (index.html).
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const avviso = (m, t, ms) => (window.toast ? window.toast(m, t, ms) : alert(m));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const data = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

  /* il prossimo nome: se sono tutti numeri il successivo, altrimenti il conteggio + 1 */
  function prossimo(lotti) {
    const nomi = lotti.map((l) => String(l.lotto || '').trim()).filter(Boolean);
    if (!nomi.length) return '2';
    if (nomi.every((n) => /^\d+$/.test(n))) return String(Math.max(...nomi.map(Number)) + 1);
    return String(nomi.length + 1);
  }

  function chiudi() { const o = $('lotti-ov'); if (o) o.remove(); }

  async function usa(cid, msg) {
    chiudi();
    if (typeof window._verbaleUsaCantiere === 'function') await window._verbaleUsaCantiere(cid);
    if (msg) avviso(msg, 'ok', 6000);
  }

  async function chiama(fn, args) {
    const { data: r, error } = await window.sb.rpc(fn, args);
    if (error) { avviso('Non riuscito: ' + error.message, 'err', 8000); return null; }
    return r;
  }

  function riga(l, cid) {
    const qui = l.cantiere_id === cid;
    const info = [l.visite ? `${l.visite} visit${l.visite === 1 ? 'a' : 'e'}` : 'nessuna visita',
      l.ultima_visita ? 'ultima ' + data(l.ultima_visita) : '', l.ultima_impresa || ''].filter(Boolean).map(esc).join(' · ');
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #eee">
      <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--grey)">🧩 ${l.lotto ? 'Lotto ' + esc(l.lotto) : '<i>senza lotto</i>'}${qui ? ' <span style="font-weight:400;color:var(--orange)">← quello nel verbale</span>' : ''}</div>
        <div style="font-size:12px;color:#666">${esc(l.etichetta || [l.indirizzo, l.civico].filter(Boolean).join(' '))}</div>
        <div style="font-size:11px;color:#999">${info}</div></div>
      ${qui ? '' : `<button type="button" class="btn-primary btn-sm" data-lotto-usa="${esc(l.cantiere_id)}" style="white-space:nowrap">Sono qui</button>`}
      ${l.copia && !l.visite && !qui ? `<button type="button" class="btn-outline btn-sm" data-lotto-togli="${esc(l.cantiere_id)}" title="Creato per sbaglio: si toglie solo se non ha visite" style="white-space:nowrap">✕</button>` : ''}
    </div>`;
  }

  async function apri(cid) {
    if (!cid) { avviso('Scegli prima il cantiere.', 'warn'); return; }
    const { data: lotti, error } = await window.sb.rpc('lotti_del_cantiere', { p_cantiere_id: cid });
    if (error) { avviso('Non sono riuscito a leggere i lotti del cantiere: ' + error.message, 'err', 8000); return; }
    const io = (lotti || []).find((l) => l.cantiere_id === cid);
    if (!io) { avviso('Cantiere non trovato.', 'err'); return; }
    const primaVolta = !String(io.lotto || '').trim();
    const altri = (lotti || []).filter((l) => l.cantiere_id !== cid);
    const nuovoNome = prossimo(primaVolta ? [{ lotto: '1' }, ...altri] : lotti);
    chiudi();
    const ov = document.createElement('div');
    ov.id = 'lotti-ov'; ov.className = 'modal-overlay'; ov.dataset.scelta = '1'; ov.style.zIndex = '9999';
    const corpo = primaVolta
      ? `<p style="font-size:13px;color:#444;margin:0 0 12px;line-height:1.5">La scheda <b>${esc(io.etichetta || [io.indirizzo, io.civico].filter(Boolean).join(' '))}</b> diventa uno dei lotti del complesso.
           Le visite già fatte restano su questa scheda. Le imprese le scegli nel verbale, per ogni lotto.</p>
         <div class="field" style="margin-bottom:12px"><label>Nome del lotto di questa scheda</label><input type="text" id="lotti-qui" value="1" maxlength="30" style="max-width:200px"></div>
         ${altri.length ? `<p style="font-size:12px;color:#888;margin:0 0 6px">Allo stesso indirizzo ci sono già:</p>${altri.map((l) => riga(l, cid)).join('')}` : ''}
         <div style="font-weight:600;margin:12px 0 6px">Oggi in quale lotto sei?</div>
         <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;cursor:pointer"><input type="radio" name="lotti-dove" value="qui" checked> In questo lotto</label>
         <label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="radio" name="lotti-dove" value="nuovo"> In un altro lotto, che si chiama
           <input type="text" id="lotti-nuovo" value="${esc(nuovoNome)}" maxlength="30" style="max-width:140px"></label>
         <p style="font-size:11px;color:#999;margin:8px 0 0">L'altro lotto nasce come copia identica di questa scheda (indirizzo, committente, intervento, importo, durata): correggi dopo con «✏️ Modifica cantiere» quello che è diverso.</p>`
      : `<p style="font-size:13px;color:#444;margin:0 0 10px">I lotti di questo complesso. Scegli quello in cui sei oggi, oppure aggiungine uno.</p>
         ${(lotti || []).map((l) => riga(l, cid)).join('')}
         <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap"><span style="font-weight:600">➕ Un altro lotto:</span>
           <input type="text" id="lotti-nuovo" value="${esc(nuovoNome)}" maxlength="30" style="max-width:140px">
           <button type="button" class="btn-primary btn-sm" id="lotti-crea">Crea e usa</button></div>`;
    ov.innerHTML = `<div class="modal-box" style="max-width:560px">
      <h3 style="margin-bottom:10px">🧩 ${primaVolta ? 'Il cantiere ha più lotti' : 'Lotti del cantiere'}</h3>${corpo}
      <div class="modal-actions" style="margin-top:14px">
        <button type="button" class="btn-outline" id="lotti-annulla">${primaVolta ? 'Annulla' : 'Chiudi'}</button>
        ${primaVolta ? '<button type="button" class="btn-primary" id="lotti-ok">Conferma</button>' : ''}
      </div></div>`;
    document.body.appendChild(ov);
    $('lotti-annulla').onclick = chiudi;

    ov.querySelectorAll('[data-lotto-usa]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.lottoUsa, l = (lotti || []).find((x) => x.cantiere_id === id);
      if (primaVolta) {   // la scheda di partenza prende comunque il suo nome
        const qui = ($('lotti-qui').value || '').trim();
        if (!qui) { avviso('Scrivi il nome del lotto di questa scheda', 'warn'); return; }
        if (!(await chiama('crea_lotto_cantiere', { p_cantiere_id: cid, p_lotto_qui: qui, p_lotto_nuovo: null }))) return;
      }
      await usa(id, 'Verbale spostato sul ' + (l && l.lotto ? 'lotto ' + l.lotto : 'cantiere scelto'));
    }));
    ov.querySelectorAll('[data-lotto-togli]').forEach((b) => (b.onclick = async () => {
      const l = (lotti || []).find((x) => x.cantiere_id === b.dataset.lottoTogli);
      if (!confirm('Togliere il lotto ' + ((l && l.lotto) || '') + '? Non ha visite: era stato creato per sbaglio.')) return;
      const r = await chiama('togli_lotto_cantiere', { p_cantiere_id: b.dataset.lottoTogli });
      if (r && r.ok) { avviso('Lotto ' + (r.lotto || '') + ' tolto', 'ok'); apri(cid); }
    }));
    const crea = async (qui) => {
      const nuovo = ($('lotti-nuovo').value || '').trim();
      if (!nuovo) { avviso('Scrivi il nome del nuovo lotto', 'warn'); $('lotti-nuovo').focus(); return; }
      const r = await chiama('crea_lotto_cantiere', { p_cantiere_id: cid, p_lotto_qui: qui, p_lotto_nuovo: nuovo });
      if (r && r.ok) await usa(r.cantiere_id, `Creato il lotto ${r.lotto}${r.lotto_partenza ? ' (la scheda di partenza è il lotto ' + r.lotto_partenza + ')' : ''}: il verbale ora è su questo lotto. Scegli le sue imprese.`);
    };
    if (primaVolta) {
      $('lotti-ok').onclick = async () => {
        const qui = ($('lotti-qui').value || '').trim();
        if (!qui) { avviso('Scrivi il nome del lotto di questa scheda (per esempio 1)', 'warn'); $('lotti-qui').focus(); return; }
        const dove = (ov.querySelector('input[name="lotti-dove"]:checked') || {}).value;
        if (dove === 'nuovo') return crea(qui);
        const r = await chiama('crea_lotto_cantiere', { p_cantiere_id: cid, p_lotto_qui: qui, p_lotto_nuovo: null });
        if (r && r.ok) await usa(cid, 'Questa scheda ora è il lotto ' + r.lotto + '. Gli altri lotti li aggiungi dallo stesso pulsante.');
      };
      $('lotti-nuovo').addEventListener('focus', () => { const rn = ov.querySelector('input[name="lotti-dove"][value="nuovo"]'); if (rn) rn.checked = true; });
    } else {
      $('lotti-crea').onclick = () => crea(null);
    }
  }

  window.LottiCantiere = { apri, prossimo };
})();
