/* ============================================================
   📋 TASK DELL'UFFICIO (16/11/2026, chiesto dall'utente dopo aver visto la
   prova della pagina: «sì mi piace, costruiscila»)

   Le task del second brain (le checkbox di Obsidian: scadenze_ufficio,
   pratiche_aperte, i tasks.md di pratiche, progetti ed eventi) in SOLA
   LETTURA, per chi lavora dal gestionale: segreteria, Coordinatore, Direttore.
   La fonte resta il vault: una task si cambia in Obsidian. Le legge da Drive
   la funzione server task-ufficio, che le scrive in s_task_vault; la pagina
   la chiama da sola quando il caricamento ha più di 10 minuti, e col tasto
   «Aggiorna adesso».

   CHI VEDE CHE COSA lo decide il database (policy di s_task_vault):
     - segreteria: tutto;
     - Coordinatore: sopralluoghi e servizi, asseverazione, formazione, enti,
       eventi, progetti dell'Area, e le task legate a una questione che vede;
     - Direttore: le sole task legate a una sua questione (🆔 decNN).
   vedeRuolo qui sotto rifà la stessa regola SOLO per l'anteprima «Vedi come…»
   della segreteria, che coi suoi permessi vedrebbe tutto: chi cambia la policy
   cambia anche lei (e leggi-task.js, che calcola vede_coordinatore).

   Le date: «scaduta» solo se passata da meno di 30 giorni; più vecchia è
   «data da aggiornare», perché molte task restano vive con la 📅 rimasta
   indietro (al 16/11/2026: 135 aperte su 220 con la data passata).

   Script classico: usa window.sb, window.SB_URL, window.SB_KEY, window.toast;
   espone window.taskUfficio. Le funzioni pure si provano con
   node test/task-ufficio.test.cjs.
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const giorni = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  const it = (d) => String(d || '').slice(0, 10).split('-').reverse().join('/');

  /* ── funzioni pure ── */

  /* la questione del registro si vede dal Direttore e dal Coordinatore se non è una proposta
     e non è ritirata come «non è materia per il Direttore» o doppione (s_task_dec_visibile) */
  function decVisibile(d) { return !!d && d.stato !== 'proposta' && !['non_mostrare', 'doppione'].includes(d.ritiro_tipo || ''); }

  function vedeRuolo(t, ruolo, dec) {
    const d = t.dec_id != null && dec ? dec[t.dec_id] : null;
    if (ruolo === 'direttore') return t.dec_id != null && decVisibile(d);
    if (ruolo === 'coordinatore') return !!t.vede_coordinatore || (t.dec_id != null && decVisibile(d));
    return true;
  }

  /* l'etichetta della data: { testo, tipo } con tipo fatta | scaduta | vicina | futura | vecchia | nessuna */
  function etichettaData(t, oggi) {
    if (t.stato === 'fatta') return { testo: 'fatta il ' + it(t.fatta_il), tipo: 'fatta' };
    if (!t.scadenza) return { testo: 'senza data', tipo: 'nessuna' };
    const n = giorni(oggi, t.scadenza);
    if (n < -30) return { testo: 'data da aggiornare (' + it(t.scadenza) + ')', tipo: 'vecchia' };
    if (n < 0) return { testo: 'scaduta il ' + it(t.scadenza), tipo: 'scaduta' };
    if (n === 0) return { testo: 'oggi', tipo: 'vicina' };
    if (n <= 7) return { testo: 'entro il ' + it(t.scadenza), tipo: 'vicina' };
    return { testo: 'entro il ' + it(t.scadenza), tipo: 'futura' };
  }

  const PESO_PRIO = { altissima: 0, alta: 1, media: 2, bassa: 4 };
  /* aperte: prima le scadute da poco e quelle vicine, poi per data, poi le altre; fatte: le più recenti prima */
  function ordina(lista, oggi) {
    const rango = (t) => { const e = etichettaData(t, oggi).tipo; return { scaduta: 0, vicina: 1, futura: 2, nessuna: 3, vecchia: 3, fatta: 5 }[e]; };
    return lista.slice().sort((a, b) =>
      rango(a) - rango(b)
      || (a.stato === 'fatta' ? String(b.fatta_il).localeCompare(String(a.fatta_il)) : 0)
      || String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999'))
      || ((PESO_PRIO[a.priorita] ?? 3) - (PESO_PRIO[b.priorita] ?? 3))
      || String(a.titolo).localeCompare(String(b.titolo)));
  }

  const FILTRI = { aperte: 'Aperte', vicine: 'Entro 30 giorni', fatte: 'Fatte di recente', direttore: 'Legate al Direttore', tutte: 'Tutte' };
  function passa(t, filtro, oggi) {
    if (filtro === 'aperte') return t.stato === 'aperta';
    if (filtro === 'vicine') { if (t.stato !== 'aperta' || !t.scadenza) return false; const n = giorni(oggi, t.scadenza); return n >= -30 && n <= 30; }
    if (filtro === 'fatte') return t.stato === 'fatta';
    if (filtro === 'direttore') return t.dec_id != null;
    return true;
  }
  function filtra(lista, { filtro = 'aperte', gruppo = '', cerca = '' } = {}, oggi) {
    const q = String(cerca || '').trim().toLowerCase();
    return ordina(lista.filter((t) => passa(t, filtro, oggi)
      && (!gruppo || t.gruppo === gruppo)
      && (!q || [t.titolo, t.dettaglio, t.ambito].join(' ').toLowerCase().includes(q))), oggi);
  }

  function conta(lista, oggi) {
    const ap = lista.filter((t) => t.stato === 'aperta');
    const n = (t) => (t.scadenza ? giorni(oggi, t.scadenza) : null);
    return {
      aperte: ap.length,
      settimana: ap.filter((t) => { const x = n(t); return x != null && x >= 0 && x <= 7; }).length,
      scaduteDaPoco: ap.filter((t) => { const x = n(t); return x != null && x < 0 && x >= -30; }).length,
      fatte7: lista.filter((t) => t.stato === 'fatta' && t.fatta_il && giorni(t.fatta_il, oggi) <= 7).length,
    };
  }

  /* il testo della task, già pulito dalla funzione server: **grassetto**, `codice`, ¶ = a capo */
  function formatta(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code style="font-size:12px;background:#f3f3f3;padding:0 3px;border-radius:3px">$1</code>')
      .replace(/ ¶ /g, '<br>');
  }

  function testoQuestione(d) {
    if (!d) return '';
    if (d.stato === 'ritirata') return 'ritirata' + (d.ritiro_tipo === 'non_mostrare' ? ': non è materia per il Direttore' : d.ritiro_tipo === 'doppione' ? ': doppione' : d.ritirata_motivo ? ': ' + d.ritirata_motivo : '');
    if (d.stato === 'chiusa' || d.stato === 'decisa') return 'decisa' + (d.decisione ? ': «' + String(d.decisione).slice(0, 140) + '»' : '');
    if (d.stato === 'rinviata') return 'rinviata' + (d.rinviata_al ? ' al ' + it(d.rinviata_al) : '');
    if (d.stato === 'proposta') return 'proposta, non ancora mostrata al Direttore';
    if (d.stato === 'incontro') return 'da parlarne a voce';
    return 'in attesa di decisione';
  }

  /* ── la pagina ── */
  let _t = [], _dec = {}, _giro = null, _filtro = 'aperte', _gruppo = '', _cerca = '', _aperte = new Set(), _inCorso = false, _errore = '';

  function chiVede() {
    try { const v = radice.vesteV2; if (v && v.simula && v.simula()) { const r = v.ruolo(); if (r === 'coordinatore' || r === 'direttore') return r; } } catch (_e) { /* niente */ }
    try { const v = radice.vesteV2; const r = v && v.ruolo ? v.ruolo() : ''; if (r === 'direttore' || r === 'coordinatore') return r; } catch (_e) { /* niente */ }
    return 'segreteria';
  }
  const anteprima = () => { try { return !!(radice.vesteV2 && radice.vesteV2.simula && radice.vesteV2.simula()); } catch (_e) { return false; } };

  async function leggi() {
    const sb = radice.sb;
    const [t, g] = await Promise.all([
      sb.from('s_task_vault').select('chiave,file,riga,gruppo,ambito,titolo,dettaglio,stato,scadenza,fatta_il,priorita,dec_id,vede_coordinatore'),
      sb.from('s_task_vault_giri').select('eseguito_il,esito,n_aperte,n_fatte').order('eseguito_il', { ascending: false }).limit(5),
    ]);
    if (t.error) throw new Error('task: ' + t.error.message);
    if (g.error) throw new Error('aggiornamenti: ' + g.error.message);
    _t = t.data || [];
    _giro = { ultimoOk: (g.data || []).find((x) => x.esito === 'ok' || x.esito === 'invariato') || null, ultimo: (g.data || [])[0] || null };
    const ids = Array.from(new Set(_t.map((x) => x.dec_id).filter((x) => x != null)));
    _dec = {};
    if (ids.length) {
      const d = await sb.from('s_decisioni').select('id,stato,ritiro_tipo,ritirata_motivo,decisione,rinviata_al').in('id', ids);
      if (d.error) throw new Error('questioni: ' + d.error.message);
      (d.data || []).forEach((x) => { _dec[x.id] = x; });
    }
  }

  async function aggiorna(forza) {
    if (_inCorso) return null;
    _inCorso = true;
    try {
      const sess = (await radice.sb.auth.getSession()).data.session;
      if (!sess) throw new Error("accesso scaduto: rientra nell'app");
      const r = await fetch(radice.SB_URL + '/functions/v1/task-ufficio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: radice.SB_KEY, Authorization: 'Bearer ' + sess.access_token },
        body: JSON.stringify({ azione: 'aggiorna', forza: !!forza }),
      });
      let d = null; try { d = await r.json(); } catch (_e) { /* non JSON */ }
      if (!r.ok || !d || d.ok === false) throw new Error((d && d.errore) || 'errore ' + r.status);
      return d;
    } finally { _inCorso = false; }
  }

  const COLORI = {
    fatta: 'background:#eaf3de;color:#3b6d11', scaduta: 'background:#fcebeb;color:#a32d2d', vicina: 'background:#faeeda;color:#854f0b',
    futura: 'background:#f1efe8;color:#5f5e5a', vecchia: 'background:#f1efe8;color:#888780', nessuna: 'background:#f1efe8;color:#888780',
  };

  function disegna(host) {
    if (!host) return;
    const oggi = oggiRoma();
    const chi = chiVede();
    const mie = anteprima() ? _t.filter((t) => vedeRuolo(t, chi, _dec)) : _t;
    const filtri = chi === 'direttore' ? ['aperte', 'fatte', 'tutte'] : Object.keys(FILTRI);
    if (!filtri.includes(_filtro)) _filtro = 'aperte';
    const c = conta(mie, oggi);
    const lista = filtra(mie, { filtro: _filtro, gruppo: _gruppo, cerca: _cerca }, oggi);
    const ok = _giro && _giro.ultimoOk;
    const fallito = _giro && _giro.ultimo && _giro.ultimo !== ok && /^errore/.test(_giro.ultimo.esito || '') ? _giro.ultimo : null;
    const quando = ok ? new Date(ok.eseguito_il).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const nota = chi === 'direttore' ? 'Qui ci sono le task legate a una tua questione: le altre restano della segreteria.'
      : chi === 'coordinatore' ? "Qui ci sono le task di sopralluoghi, asseverazione, formazione, enti, eventi e progetti dell'Area, e quelle legate a una questione del registro."
      : 'La segreteria vede tutte le task del second brain; Coordinatore e Direttore ne vedono una parte (prova con «Vedi come…»).';
    const kpi = [['Aperte', c.aperte], ['Entro 7 giorni', c.settimana], ['Scadute da poco', c.scaduteDaPoco], ['Fatte negli ultimi 7 giorni', c.fatte7]];
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
        <div style="font-size:12.5px;color:#555">${ok ? 'Aggiornate dal second brain il ' + esc(quando) : 'Non ancora caricate dal second brain'}${_inCorso ? ' · <b>sto rileggendo il vault…</b>' : ''}</div>
        <button type="button" class="btn-outline btn-sm" id="tu-aggiorna" data-aiuto="Rilegge adesso le task dal vault su Drive: ci mette qualche secondo. Non cambia niente in Obsidian.">↻ Aggiorna adesso</button>
      </div>
      ${fallito ? `<div class="card" style="border-left:4px solid #c0392b;font-size:13px;color:#a32d2d;margin-bottom:10px">L'ultimo aggiornamento non è riuscito (${esc(it(fallito.eseguito_il))} ${esc(new Date(fallito.eseguito_il).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }))}): ${esc(String(fallito.esito).replace(/^errore:\s*/, ''))}. Le task qui sotto sono quelle del caricamento precedente.</div>` : ''}
      ${_errore ? `<div class="card" style="border-left:4px solid #c0392b;font-size:13px;color:#a32d2d;margin-bottom:10px">${esc(_errore)}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px">${kpi.map(([l, n]) => `<div style="background:#f6f6f4;border-radius:8px;padding:8px 12px"><div style="font-size:12px;color:#666">${l}</div><div style="font-size:22px;font-weight:700;color:#565c66">${n}</div></div>`).join('')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${filtri.map((f) => `<button type="button" data-tu-filtro="${f}" style="font-size:13px;padding:5px 12px;border-radius:999px;cursor:pointer;min-height:0;${f === _filtro ? 'background:#e7500f;color:#fff;border:1px solid #e7500f' : 'background:#fff;color:#565c66;border:1px solid #ccc'}">${FILTRI[f]}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <input id="tu-cerca" type="search" placeholder="Cerca (es. Vilnai, DURC, Commissione)" value="${esc(_cerca)}" style="flex:1;min-width:200px;max-width:380px">
        ${chi === 'direttore' ? '' : `<select id="tu-gruppo" style="width:auto">${[['', 'Tutti gli ambiti'], ['ufficio', 'Ufficio'], ['asseverazione', 'Asseverazione'], ['progetto', 'Progetti'], ['eventi', 'Eventi']].map(([v, l]) => `<option value="${v}"${v === _gruppo ? ' selected' : ''}>${l}</option>`).join('')}</select>`}
      </div>
      <div style="font-size:12px;color:#888;margin:4px 0 8px">${esc(nota)} Si guardano soltanto: una task si cambia in Obsidian.</div>
      <div class="card" style="padding:4px 12px">${lista.length ? lista.map((t) => riga(t, oggi)).join('') : `<div style="font-size:13px;color:#777;padding:12px 0">${_t.length ? 'Niente con questo filtro.' : 'Ancora nessuna task caricata.'}</div>`}</div>
      <div style="font-size:12px;color:#888;margin-top:6px">${lista.length} task${_filtro === 'fatte' ? ' fatte negli ultimi 60 giorni' : ''}.</div>`;
  }

  function riga(t, oggi) {
    const e = etichettaData(t, oggi);
    const d = t.dec_id != null ? _dec[t.dec_id] : null;
    const aperta = _aperte.has(t.chiave);
    const prio = t.priorita === 'altissima' || t.priorita === 'alta' ? ` <span style="font-size:11px;padding:1px 7px;border-radius:6px;background:#fcebeb;color:#a32d2d">${t.priorita}</span>` : '';
    return `<div data-tu-riga="${esc(t.chiave)}" style="border-top:1px solid #f0f0f0;padding:9px 2px;cursor:pointer">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <span aria-hidden="true" style="font-size:15px;line-height:1.3;color:${t.stato === 'fatta' ? '#3b6d11' : '#bbb'}">${t.stato === 'fatta' ? '✔' : '○'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;${t.stato === 'fatta' ? 'color:#666' : 'color:#222'};line-height:1.35">${formatta(t.titolo)}${prio}</div>
          <div style="font-size:12px;color:#888;margin-top:2px">${esc(t.ambito)}${t.dec_id != null ? ` · <span style="color:#185fa5">questione n° ${t.dec_id}${d ? ': ' + esc(testoQuestione(d)) : ''}</span>` : ''}</div>
        </div>
        <span style="font-size:11.5px;padding:2px 8px;border-radius:6px;white-space:nowrap;${COLORI[e.tipo]}">${esc(e.testo)}</span>
      </div>
      ${aperta ? `<div style="font-size:13px;color:#444;margin:8px 0 2px 25px;line-height:1.55">${t.dettaglio ? formatta(t.dettaglio) : '<i style="color:#999">nessun dettaglio oltre al titolo</i>'}<div style="font-size:11.5px;color:#999;margin-top:6px">Nel second brain: ${esc(t.file)}, riga ${esc(t.riga)}</div></div>` : ''}
    </div>`;
  }

  async function mostra(host) {
    if (!host) return;
    _errore = '';
    if (!_t.length) host.innerHTML = '<div style="color:#999;font-size:13px">Carico le task…</div>';
    try { await leggi(); }
    catch (err) {
      host.innerHTML = `<div class="card" style="color:#b3261e;font-size:13px">Non sono riuscito a leggere le task (${esc(err.message)}). Non vuol dire che non ce ne siano: riprova tra poco.</div>`;
      return;
    }
    disegna(host);
    /* se l'ultimo caricamento è vecchio, si rilegge il vault in silenzio e si ridisegna */
    const ok = _giro && _giro.ultimoOk;
    if (!ok || Date.now() - Date.parse(ok.eseguito_il) > 10 * 60000) {
      disegna(host);
      try { const d = await aggiorna(false); if (d && !d.saltato) await leggi(); }
      catch (err) { _errore = 'Non sono riuscito a rileggere il vault adesso (' + err.message + '): le task sono quelle del caricamento precedente.'; }
      disegna(host);
    }
  }

  if (haDom) {
    const host = () => document.getElementById('task-ufficio');
    document.addEventListener('click', async (e) => {
      const el = e.target;
      if (!el || !el.closest || !el.closest('#task-ufficio')) return;
      const f = el.closest('[data-tu-filtro]');
      if (f) { _filtro = f.dataset.tuFiltro; disegna(host()); return; }
      if (el.closest('#tu-aggiorna')) {
        _errore = ''; disegna(host());
        try {
          const d = await aggiorna(true);
          await leggi();
          if (radice.toast) radice.toast(d && d.cambiato === false ? 'Le task erano già aggiornate.' : 'Task aggiornate dal vault.', 'ok');
        } catch (err) { _errore = 'Aggiornamento non riuscito: ' + err.message; }
        disegna(host());
        return;
      }
      const r = el.closest('[data-tu-riga]');
      if (r) { const k = r.dataset.tuRiga; if (_aperte.has(k)) _aperte.delete(k); else _aperte.add(k); disegna(host()); }
    });
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'tu-cerca') {
        _cerca = e.target.value; const pos = e.target.selectionStart;
        disegna(host());
        const n = document.getElementById('tu-cerca'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_e) { /* niente */ } }
      }
    });
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'tu-gruppo') { _gruppo = e.target.value; disegna(host()); } });
    radice.addEventListener && radice.addEventListener('gestionale-logout', () => { _t = []; _dec = {}; _giro = null; _aperte = new Set(); });
  }

  const api = { mostra, vedeRuolo, decVisibile, etichettaData, ordina, filtra, conta, formatta, testoQuestione, FILTRI };
  radice.taskUfficio = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
