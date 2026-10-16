/* ============================================================
   VISITE DEL MESE — il Coordinatore le aumenta (16/10/2026, chiesto
   dall'utente: «il coordinatore dovrebbe poter aumentare le visite
   mensili di un tecnico»).

   Il numero è uno solo: «cantieri assegnati» della lettera di incarico
   del mese (s_incarichi_mensili), che scrive la segreteria. Un trigger lo
   ricopia nella scheda «Obiettivo mensile» del tecnico
   (target_visite_mensili). Questo modulo NON scrive la scheda: chiama
   s_inc_mensile_aumenta, che
   - accetta solo il Coordinatore, solo in aumento, solo sulla lettera
     ancora aperta, e vuole il motivo;
   - aggiorna la lettera (e quindi la scheda), scrive la traccia in
     s_incarichi_mensili_aumenti e una riga nelle annotazioni interne;
   - manda la notifica al tecnico e alla segreteria.
   La lettera già protocollata non si rifà (scelta dell'utente).

   Che cosa mostra:
   1. Zona Coordinatore: per ogni lettera del mese, visite assegnate e
      fatte, col pulsante «Aumenta» (solo Coordinatore; la segreteria vede
      e basta), e gli aumenti del mese con il motivo;
   2. Dashboard del tecnico: sotto la barra dell'obiettivo, la riga
      «aumentate dal Coordinatore da X a Y il …» (rigaScheda, chiamata
      da index.html dopo loadTargetCard).
   Script classico: usa window.sb, window.S, window.toast.
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const $ = (id) => (haDom ? document.getElementById(id) : null);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const avviso = (m, t, ms) => (radice.toast ? radice.toast(m, t, ms) : alert(m));
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const STATI = { aperto: 'aperta', chiuso: 'chiusa', fatturato: 'fatturata', pagato: 'pagata' };
  const dIt = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return String(s).slice(0, 10).split('-').reverse().join('/');
    return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
  };

  /* ── il mese mostrato: { anno, mese } ── */
  let _cur = null;
  function oggi() { const d = new Date(); return { anno: d.getFullYear(), mese: d.getMonth() + 1 }; }
  function sposta(n) { const c = _cur || oggi(); const d = new Date(c.anno, c.mese - 1 + n, 1); _cur = { anno: d.getFullYear(), mese: d.getMonth() + 1 }; }
  function intervallo(c) {
    const u = new Date(c.anno, c.mese, 0).getDate();
    const mm = String(c.mese).padStart(2, '0');
    return { da: `${c.anno}-${mm}-01`, a: `${c.anno}-${mm}-${String(u).padStart(2, '0')}` };
  }

  /* ── controllo del numero chiesto, prima di disturbare il database ── */
  function valutaNuovo(attuale, scritto) {
    const n = Number(String(scritto == null ? '' : scritto).trim());
    if (!Number.isInteger(n)) return { ok: false, msg: 'Scrivi un numero intero.' };
    if (n <= attuale) return { ok: false, msg: `Il numero nuovo deve essere più alto di quello attuale (${attuale}).` };
    if (n > 200) return { ok: false, msg: `${n} visite in un mese non è credibile: controlla di averlo scritto giusto.` };
    return { ok: true, n };
  }

  /* ════════ Zona Coordinatore ════════ */
  async function box() {
    const el = $('adm-visite-mese'); if (!el) return;
    if (typeof radice.isCoordPageUser !== 'function' || !radice.isCoordPageUser()) { el.style.display = 'none'; return; }
    const coord = !!radice.__isCoordinatoreVero;
    if (!_cur) _cur = oggi();
    const c = _cur, r = intervallo(c);
    const sb = radice.sb;
    const [inc, aum] = await Promise.all([
      sb.from('s_incarichi_mensili').select('id,tecnico_id,tecnico_nome,cantieri_assegnati,seconde_visite,altro,stato,data_lettera,lettera_protocollo_id')
        .eq('anno', c.anno).eq('mese', c.mese).order('tecnico_nome'),
      sb.from('s_incarichi_mensili_aumenti').select('incarico_id,tecnico_id,da,a,motivo,fatto_da,fatto_il')
        .eq('anno', c.anno).eq('mese', c.mese).order('fatto_il', { ascending: false }),
    ]);
    const lettere = inc.data || [], aumenti = aum.data || [];
    const ids = lettere.map((x) => x.tecnico_id).filter(Boolean);
    let fatte = {}, errVis = null;
    if (ids.length) {
      const vs = await sb.from('visite').select('tecnico_id').eq('elimina', 0).in('tecnico_id', ids).gte('data_visita', r.da).lte('data_visita', r.a).limit(5000);
      if (vs.error) errVis = vs.error.message;
      (vs.data || []).forEach((v) => { fatte[v.tecnico_id] = (fatte[v.tecnico_id] || 0) + 1; });
    }
    const errori = [inc.error && inc.error.message, aum.error && aum.error.message, errVis].filter(Boolean);
    const nome = (x) => x.tecnico_nome || x.tecnico_id || '?';
    const nomeDi = {}; lettere.forEach((x) => { nomeDi[x.id] = nome(x); });

    const riga = (x) => {
      const ass = x.cantieri_assegnati ?? 0, f = fatte[x.tecnico_id] || 0;
      const extra = `${x.seconde_visite ? ` <span style="color:#888">+${x.seconde_visite} 2ª</span>` : ''}${x.altro ? ` <span style="color:#888">+${x.altro} altro</span>` : ''}`;
      const quanti = aumenti.filter((a) => a.incarico_id === x.id).length;
      const pulsante = x.stato !== 'aperto'
        ? '<span style="font-size:11px;color:#888">mese chiuso</span>'
        : (coord
          ? `<button type="button" class="btn-primary btn-sm" onclick="VisiteMese.aumenta(${x.id})">📈 Aumenta</button>`
          : '<span style="font-size:11px;color:#888">aumenta il Coordinatore</span>');
      return `<tr style="border-top:1px solid #f0e6dd">
        <td style="padding:5px 6px"><b>${esc(nome(x))}</b></td>
        <td style="padding:5px 6px">n° ${esc(x.id)}${x.lettera_protocollo_id ? ' · 📤' : ''} · ${esc(STATI[x.stato] || x.stato || '')}</td>
        <td style="padding:5px 6px;font-weight:700">${ass}${extra}${quanti ? ` <span title="Aumentate dal Coordinatore" style="color:#2d7a06;font-weight:400">↑ ${quanti === 1 ? 'aumentate' : quanti + ' aumenti'}</span>` : ''}</td>
        <td style="padding:5px 6px;color:${f > ass ? '#c0392b' : '#444'}">${errVis ? '—' : f}</td>
        <td style="padding:5px 6px;white-space:nowrap">${pulsante}</td>
      </tr>`;
    };
    const tab = lettere.length ? `<div class="table-wrap" style="overflow:auto"><table style="font-size:12.5px;width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;color:#565c66"><th style="padding:4px 6px">Tecnico</th><th style="padding:4px 6px">Lettera</th><th style="padding:4px 6px" title="«Cantieri assegnati» della lettera: è il massimo che il tecnico vede nella sua scheda">Visite assegnate</th><th style="padding:4px 6px" title="Verbali del mese con data della visita nel mese, bozze comprese, come nella scheda del tecnico">Fatte</th><th></th></tr></thead>
        <tbody>${lettere.map(riga).join('')}</tbody></table></div>`
      : (inc.error ? '' : '<p style="font-size:12px;color:#888;margin:4px 0">Nessuna lettera di incarico per questo mese: le crea la segreteria.</p>');
    const rigaAum = (a) => `<div style="font-size:12px;padding:5px 0;border-top:1px solid #f5f5f5;color:#444">${esc(dIt(a.fatto_il))} · <b>${esc(nomeDi[a.incarico_id] || a.tecnico_id)}</b> · da ${a.da} a <b>${a.a}</b> — ${esc(a.motivo)}</div>`;

    el.innerHTML = `<div class="card" style="border-left:4px solid #95C22F;color:#222;text-align:left">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <h3 style="color:#565c66;margin:0">📈 Visite del mese — ${esc(MESI[c.mese - 1])} ${c.anno}</h3>
        <button type="button" class="btn-outline btn-sm" id="vm-prec" title="Mese prima">‹</button><button type="button" class="btn-outline btn-sm" id="vm-succ" title="Mese dopo">›</button>
      </div>
      <p style="font-size:12px;color:#666;margin:6px 0">Il numero è quello della lettera di incarico del mese; il tecnico lo vede come massimo nella sua scheda. ${coord ? 'Puoi solo aumentarlo, scrivendo il motivo: cambiano la lettera nel database e la scheda, tecnico e segreteria ricevono l\'avviso. La lettera già spedita non si rifà.' : 'Lo aumenta il Coordinatore da qui; la segreteria lo cambia dalla sua app.'}</p>
      ${errori.length ? `<p style="font-size:12px;color:#c0392b;margin:4px 0 6px">Non sono riuscito a leggere tutto (${esc(errori.join('; '))}): ricarica prima di concludere che non c'è niente.</p>` : ''}
      ${tab}
      ${aumenti.length ? `<details style="margin-top:8px"${aumenti.length <= 3 ? ' open' : ''}><summary style="cursor:pointer;font-size:12px;color:#565c66">Aumenti del mese (${aumenti.length})</summary>${aumenti.map(rigaAum).join('')}</details>` : ''}
    </div>`;
    el.style.display = '';
    const p = $('vm-prec'), s = $('vm-succ');
    if (p) p.onclick = () => { sposta(-1); box().catch((e) => console.warn('visite del mese:', e)); };
    if (s) s.onclick = () => { sposta(1); box().catch((e) => console.warn('visite del mese:', e)); };
  }

  async function aumenta(id) {
    if (!radice.__isCoordinatoreVero) { avviso('Le visite del mese le aumenta solo il Coordinatore.', 'err'); return; }
    const { data: x, error } = await radice.sb.from('s_incarichi_mensili').select('id,tecnico_nome,anno,mese,cantieri_assegnati,stato').eq('id', id).maybeSingle();
    if (error || !x) { avviso('Non sono riuscito a rileggere la lettera' + (error ? ': ' + error.message : '') + '.', 'err'); return; }
    if (x.stato !== 'aperto') { avviso('Il mese è chiuso: le visite non si aumentano più.', 'warn'); box().catch(() => {}); return; }
    const attuale = x.cantieri_assegnati ?? 0;
    const scritto = prompt(`${x.tecnico_nome || 'Tecnico'} — ${MESI[x.mese - 1]} ${x.anno}\nVisite assegnate oggi: ${attuale}.\nNuovo numero di visite del mese:`, String(attuale + 1));
    if (scritto === null) return;
    const v = valutaNuovo(attuale, scritto);
    if (!v.ok) { avviso(v.msg, 'warn'); return; }
    let motivo = prompt(`Perché porti le visite da ${attuale} a ${v.n}? Resta scritto e lo legge la segreteria.`);
    if (motivo === null) return;
    motivo = motivo.trim();
    if (motivo.length < 5) { avviso('Scrivi il motivo: è la riga che resta scritta sulla lettera.', 'warn'); return; }
    const r = await radice.sb.rpc('s_inc_mensile_aumenta', { p_incarico_id: id, p_nuovo: v.n, p_motivo: motivo });
    if (r.error) { avviso('Aumento non registrato: ' + r.error.message, 'err'); return; }
    avviso(`Visite portate da ${attuale} a ${v.n}: lettera e scheda del tecnico aggiornate, tecnico e segreteria avvisati.`, 'ok', 7000);
    box().catch(() => {});
  }

  /* ════════ Dashboard del tecnico: la riga sotto l'obiettivo ════════ */
  async function rigaScheda() {
    const tec = radice.S && radice.S.tecnico;
    const note = $('tgt-vis-note');
    if (!tec || !tec.tecnico_id || !note) return;
    const c = oggi();
    const { data, error } = await radice.sb.from('s_incarichi_mensili_aumenti').select('da,a,fatto_il')
      .eq('tecnico_id', tec.tecnico_id).eq('anno', c.anno).eq('mese', c.mese).order('fatto_il', { ascending: false }).limit(1);
    if (error || !data || !data.length) return;
    const a = data[0];
    const vecchia = $('tgt-aumento'); if (vecchia) vecchia.remove();
    const d = document.createElement('div');
    d.id = 'tgt-aumento';
    d.style.cssText = 'font-size:12px;color:#2d7a06;margin-top:4px';
    d.textContent = `↑ Il Coordinatore ha aumentato le tue visite del mese da ${a.da} a ${a.a} il ${dIt(a.fatto_il)}.`;
    note.insertAdjacentElement('afterend', d);
  }

  if (haDom) {
    /* la Zona Coordinatore ha fondo scuro: dentro il riquadro bianco il testo torna scuro */
    const st = document.createElement('style');
    st.textContent = '#view-admin #adm-visite-mese .card{color:#222;text-align:left}#view-admin #adm-visite-mese .card h3{color:#565c66}';
    document.head.appendChild(st);

    /* si aggancia al giro che riempie la Zona Coordinatore, come riepilogo-verbali.js */
    const prima = radice.aggiornaZonaCoord;
    radice.aggiornaZonaCoord = async function () {
      const r = await Promise.allSettled([
        typeof prima === 'function' ? prima.apply(this, arguments) : Promise.resolve(),
        box(),
      ]);
      const ko = r.find((x) => x.status === 'rejected');
      if (ko) console.warn('zona coordinatore:', ko.reason);
    };
    /* la riga nella scheda del tecnico la chiama index.html dopo loadTargetCard:
       lo script principale è un modulo e parte dopo questo, non si può avvolgere da qui */
  }

  const api = { box, aumenta, rigaScheda, valutaNuovo };
  radice.VisiteMese = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
