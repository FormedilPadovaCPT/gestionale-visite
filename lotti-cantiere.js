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

   (07/10/2026, sera) Il complesso si vede e si sistema:
     · base(testo) toglie « – lotto N» dall'etichetta: è il nome del
       complesso nell'elenco cantieri;
     · rilevaLotto(testo) legge il lotto scritto dentro un indirizzo
       importato («via De Gasperi - Lotto 14» → «14»): lo propone
       l'unione e la divisione delle visite, decide la segreteria;
     · dividi(cid) — segreteria e coordinatore — assegna le visite
       di una scheda ai lotti, con l'indirizzo com'era scritto nel
       modulo originale accanto a ogni visita (sposta_visite_in_lotti).

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

  /* il nome del complesso: l'etichetta senza « – lotto N» (la stessa regola di etichetta_con_lotto nel database) */
  function base(testo) {
    return String(testo || '').replace(/\s*[–-]?\s*\(?\s*lott[oi]\b.*$/i, '').trim();
  }

  /* il lotto scritto dentro un indirizzo o un'etichetta importati: «Lotto 14», «(lotto 4)», «Lotto 2-3»,
     «lotto B4», «Palazzina B». Restituisce il nome proposto, o null. Decide la persona, non questa regola. */
  function rilevaLotto(testo) {
    const s = String(testo || '');
    let m = s.match(/\blott[oi]\.?\s*(?:n[°.]?\s*)?[:]?\s*([A-Za-z]?\d+(?:\s*[-–\/]\s*\d+)?|[A-Za-z]\d*)\b/i);
    if (m) return m[1].replace(/\s*([-–\/])\s*/g, '$1').toUpperCase().replace(/^(\d)/, '$1');
    m = s.match(/\b(palazzin[ae]|stralcio|blocco|torre|edificio|corpo)\s+([A-Za-z]|\d+)\b/i);
    if (m) return (m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + ' ' + m[2].toUpperCase());
    return null;
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

  /* le regole generali del gestionale danno a ogni input larghezza 100% e a ogni label il maiuscolo:
     qui il pallino e il testo della scelta restano della loro misura */
  const S_SCELTA = 'display:flex;gap:8px;align-items:center;margin:0 0 8px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px;color:#333';
  const S_RADIO = 'width:auto;min-width:0;flex:0 0 auto;margin:0';
  const S_NOME = 'width:140px;flex:0 0 140px;padding:5px 8px';

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
         <div style="font-weight:600;margin:12px 0 8px;color:var(--grey)">Oggi in quale lotto sei?</div>
         <label style="${S_SCELTA}"><input type="radio" name="lotti-dove" value="qui" checked style="${S_RADIO}"><span>In questo lotto</span></label>
         <label style="${S_SCELTA}"><input type="radio" name="lotti-dove" value="nuovo" style="${S_RADIO}"><span>In un altro lotto, che si chiama</span>
           <input type="text" id="lotti-nuovo" value="${esc(nuovoNome)}" maxlength="30" style="${S_NOME}"></label>
         <p style="font-size:11px;color:#999;margin:8px 0 0;line-height:1.45">L'altro lotto nasce come copia identica di questa scheda (indirizzo, committente, intervento, importo, durata): correggi dopo con «✏️ Modifica cantiere» quello che è diverso.</p>`
      : `<p style="font-size:13px;color:#444;margin:0 0 10px">I lotti di questo complesso. Scegli quello in cui sei oggi, oppure aggiungine uno.</p>
         ${(lotti || []).map((l) => riga(l, cid)).join('')}
         <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap"><span style="font-weight:600">➕ Un altro lotto:</span>
           <input type="text" id="lotti-nuovo" value="${esc(nuovoNome)}" maxlength="30" style="${S_NOME}">
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

  /* ── DIVIDI LE VISITE IN LOTTI (segreteria) ──
     Le visite di questa scheda, una per riga, con l'indirizzo com'era scritto nel modulo originale: per ognuna si
     sceglie il lotto (quelli del complesso, o uno nuovo). Proposta: il lotto letto nell'indirizzo originale. */
  async function dividi(cid, onDone) {
    if (!cid) { avviso('Scegli prima il cantiere.', 'warn'); return; }
    /* (07/10/2026, chiesto dall'utente) anche il coordinatore divide: il flag lo mette la scheda del cantiere
       chiedendo al database (is_coordinatore), la regola vera sta in sposta_visite_in_lotti */
    if (!window.__isSegreteria && !window.__isCoordinatoreVero) { avviso('Dividere le visite in lotti spetta alla segreteria o al coordinatore', 'err'); return; }
    const [{ data: lotti, error: e1 }, { data: visite, error: e2 }] = await Promise.all([
      window.sb.rpc('lotti_del_cantiere', { p_cantiere_id: cid }),
      window.sb.rpc('visite_complesso', { p_cantiere_id: cid }),
    ]);
    if (e1 || e2) { avviso('Non sono riuscito a leggere lotti e visite: ' + ((e1 || e2).message || ''), 'err', 8000); return; }
    const io = (lotti || []).find((l) => l.cantiere_id === cid);
    if (!io) { avviso('Cantiere non trovato.', 'err'); return; }
    const mie = (visite || []).filter((v) => v.cantiere_id === cid);
    if (!mie.length) { avviso('Questa scheda non ha visite da dividere.', 'warn'); return; }
    const primaVolta = !String(io.lotto || '').trim();
    const nomiLotti = (lotti || []).map((l) => String(l.lotto || '').trim()).filter(Boolean);
    const quiNome = primaVolta ? '1' : io.lotto;
    const opzioni = (prop) => {
      const esistenti = nomiLotti.filter((n) => n.toLowerCase() !== String(quiNome).toLowerCase());
      const nuovo = prop && !nomiLotti.some((n) => n.toLowerCase() === prop.toLowerCase()) && prop.toLowerCase() !== String(quiNome).toLowerCase() ? prop : null;
      return `<option value="">resta qui (lotto ${esc(quiNome)})</option>`
        + esistenti.map((n) => `<option value="${esc(n)}"${prop && n.toLowerCase() === prop.toLowerCase() ? ' selected' : ''}>lotto ${esc(n)}</option>`).join('')
        + (nuovo ? `<option value="${esc(nuovo)}" selected>➕ nuovo lotto ${esc(nuovo)} (letto nell'indirizzo)</option>` : '')
        + `<option value="__nuovo">➕ un altro lotto…</option>`;
    };
    const righe = mie.map((v) => {
      const orig = v.indirizzo_originale || '';
      const prop = rilevaLotto(orig);
      return `<tr data-vid="${esc(v.visita_id)}" style="border-top:1px solid #eee">
        <td style="padding:6px 6px;white-space:nowrap">${esc(data(v.data_visita))}</td>
        <td style="padding:6px 6px;white-space:nowrap">${esc(v.nr_verbale || '–')}${v.stato === 'definitivo' ? '' : ' <span style="font-size:10px;color:#999">bozza</span>'}</td>
        <td style="padding:6px 6px">${esc(v.tecnico || '–')}</td>
        <td style="padding:6px 6px">${esc(v.impresa || '–')}</td>
        <td style="padding:6px 6px;font-size:12px;color:${prop ? 'var(--orange)' : '#666'}">${esc(orig || '(non c’è il modulo originale)')}</td>
        <td style="padding:6px 6px;white-space:nowrap"><select data-lotto-sel style="width:auto;min-width:150px;padding:4px 6px;font-size:12px">${opzioni(prop)}</select>
          <input type="text" data-lotto-nuovo maxlength="30" placeholder="nome del lotto" style="display:none;width:120px;margin-top:4px;padding:4px 6px;font-size:12px"></td>
      </tr>`;
    }).join('');
    chiudi();
    const ov = document.createElement('div');
    ov.id = 'lotti-ov'; ov.className = 'modal-overlay'; ov.dataset.scelta = '1'; ov.style.zIndex = '9999';
    ov.innerHTML = `<div class="modal-box" style="max-width:980px">
      <h3 style="margin-bottom:8px">🧩 Dividi le visite in lotti</h3>
      <p style="font-size:13px;color:#444;margin:0 0 10px;line-height:1.5">Le ${mie.length} visite di <b>${esc(io.etichetta || [io.indirizzo, io.civico].filter(Boolean).join(' '))}</b>.
        Accanto a ogni visita c'è l'indirizzo <b>com'era scritto nel modulo originale</b>: dove si legge un lotto, è già proposto in arancione. Scegli tu, riga per riga; quelle che restano qui non cambiano.</p>
      ${primaVolta ? `<div class="field" style="margin-bottom:10px"><label>Nome del lotto di questa scheda</label><input type="text" id="lotti-qui" value="1" maxlength="30" style="max-width:200px"></div>` : ''}
      <div style="max-height:52vh;overflow:auto;border:1px solid #eee;border-radius:8px">
      <table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr style="background:#f7f7f7">
        <th style="padding:6px;text-align:left;font-size:11px;color:#888">Data</th><th style="padding:6px;text-align:left;font-size:11px;color:#888">Verbale</th>
        <th style="padding:6px;text-align:left;font-size:11px;color:#888">Tecnico</th><th style="padding:6px;text-align:left;font-size:11px;color:#888">Impresa</th>
        <th style="padding:6px;text-align:left;font-size:11px;color:#888">Indirizzo nel modulo originale</th><th style="padding:6px;text-align:left;font-size:11px;color:#888">Va sul lotto</th></tr></thead>
        <tbody>${righe}</tbody></table></div>
      <p style="font-size:11px;color:#999;margin:8px 0 0;line-height:1.45">Un lotto nuovo nasce come copia identica di questa scheda, col suo nome. I verbali <b>definitivi</b> tengono il numero di accesso stampato; le bozze lo riprendono dal lotto in cui finiscono. Tutto resta scritto nel registro delle correzioni.</p>
      <div class="modal-actions" style="margin-top:14px">
        <button type="button" class="btn-outline" id="lotti-annulla">Annulla</button>
        <button type="button" class="btn-primary" id="lotti-dividi-ok">Sposta le visite</button>
      </div></div>`;
    document.body.appendChild(ov);
    $('lotti-annulla').onclick = chiudi;
    ov.querySelectorAll('[data-lotto-sel]').forEach((sel) => {
      sel.onchange = () => { const inp = sel.parentElement.querySelector('[data-lotto-nuovo]'); inp.style.display = sel.value === '__nuovo' ? 'block' : 'none'; if (sel.value === '__nuovo') inp.focus(); };
    });
    $('lotti-dividi-ok').onclick = async () => {
      const qui = primaVolta ? ($('lotti-qui').value || '').trim() : null;
      if (primaVolta && !qui) { avviso('Scrivi il nome del lotto di questa scheda (per esempio 1)', 'warn'); $('lotti-qui').focus(); return; }
      const ass = [];
      for (const tr of ov.querySelectorAll('tr[data-vid]')) {
        const sel = tr.querySelector('[data-lotto-sel]');
        let lotto = sel.value;
        if (lotto === '__nuovo') { lotto = (tr.querySelector('[data-lotto-nuovo]').value || '').trim(); if (!lotto) { avviso('Scrivi il nome del nuovo lotto, o scegli «resta qui»', 'warn'); tr.querySelector('[data-lotto-nuovo]').focus(); return; } }
        if (lotto) ass.push({ visita_id: tr.dataset.vid, lotto });
      }
      if (!ass.length) { avviso('Nessuna visita da spostare: sono tutte su «resta qui».', 'warn'); return; }
      const lottiNuovi = [...new Set(ass.map((a) => a.lotto.toLowerCase()))].filter((n) => !nomiLotti.some((x) => x.toLowerCase() === n));
      if (!confirm('Spostare ' + ass.length + ' visit' + (ass.length === 1 ? 'a' : 'e') + ' sui lotti indicati?' + (lottiNuovi.length ? '\nNascono ' + lottiNuovi.length + ' lott' + (lottiNuovi.length === 1 ? 'o nuovo' : 'i nuovi') + ' (' + lottiNuovi.join(', ') + ').' : '') + '\n\nNon si annulla dalla lista: si corregge rifacendo la divisione.')) return;
      const b = $('lotti-dividi-ok'); b.disabled = true; b.textContent = 'Sposto…';
      const r = await chiama('sposta_visite_in_lotti', { p_cantiere_id: cid, p_lotto_qui: qui, p_assegnazioni: ass });
      if (!r || !r.ok) { b.disabled = false; b.textContent = 'Sposta le visite'; return; }
      chiudi();
      avviso(`Spostate ${r.spostate} visite${(r.lotti_creati || []).length ? ', creati ' + r.lotti_creati.length + ' lotti' : ''}${r.accessi_ricalcolati ? ', ' + r.accessi_ricalcolati + ' numeri di accesso ricalcolati sulle bozze' : ''}.`, 'ok', 8000);
      if (typeof onDone === 'function') onDone(r);
    };
  }

  window.LottiCantiere = { apri, prossimo, base, rilevaLotto, dividi };
})();
