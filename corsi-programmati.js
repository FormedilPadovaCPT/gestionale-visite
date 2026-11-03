/* ============================================================
   🎓 CORSI IN PROGRAMMA (03/11/2026, chiesto dall'utente: «così è sempre
   aggiornato il calendario dei corsi in programma alla scuola»)

   La programmazione dei corsi dell'Ufficio Corsi Sicurezza, in sola lettura,
   per tutti quelli che entrano nel gestionale: tecnici, Coordinatore,
   segreteria, Direttore, Presidenza e consiglieri. Non la vedono i docenti
   esterni.

   La fonte è UNA: le tabelle formazione_calendario (le edizioni) e
   formazione_catalogo (ore e quote), le stesse da cui il verbale prende le
   date dei corsi da proporre all'impresa. Le carica la segreteria con
   _SISTEMA/scripts/importa_programmazione_corsi.py quando arriva la
   programmazione nuova; qui non si scrive niente. Il calendario Google
   «Calendario corsi e attività - Scuola Edile CPT» è una copia degli stessi
   dati, allineata a ogni import.

   Le quote si dicono come nel verbale (send-verbale): mai «gratuito» a stima,
   sempre la cifra del listino.

   Script classico: usa window.sb e window.toast; espone window.corsiProgrammati.
   Le funzioni pure si provano con node test/corsi-programmati.test.cjs.
   ============================================================ */

(function (radice) {
  const haDom = typeof document !== 'undefined';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

  /* ── funzioni pure ── */
  const oggiRoma = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const dataDa = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const eur = (n) => (n == null || n === '' ? '' : '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }));

  /* le giornate dell'edizione, in ordine; se mancano, quelle fra inizio e fine */
  function giornate(e) {
    let g = Array.isArray(e && e.giornate) ? e.giornate.filter(Boolean).map((x) => String(x).slice(0, 10)) : [];
    if (!g.length && e && e.data_inizio) {
      const a = dataDa(e.data_inizio), b = dataDa(e.data_fine || e.data_inizio);
      for (let d = a; d && b && d <= b; d = new Date(d.getTime() + 86400000)) g.push(d.toISOString().slice(0, 10));
    }
    return Array.from(new Set(g)).sort();
  }

  /* «mer 4 e gio 5 novembre», «19, 20, 26 e 27 novembre», «30 novembre e 1 dicembre» */
  function quando(e) {
    const g = giornate(e).map(dataDa).filter(Boolean);
    if (!g.length) return '';
    const parti = g.map((d, i) => {
      const stessoMeseDopo = g[i + 1] && g[i + 1].getUTCMonth() === d.getUTCMonth();
      return (g.length <= 2 ? GIORNI[d.getUTCDay()] + ' ' : '') + d.getUTCDate() + (stessoMeseDopo ? '' : ' ' + MESI[d.getUTCMonth()]);
    });
    return parti.length === 1 ? parti[0] : parti.slice(0, -1).join(', ') + ' e ' + parti[parti.length - 1];
  }

  /* le quote, come le scrive il verbale all'impresa: la cifra del listino sempre */
  function quota(c) {
    if (!c) return '';
    const dir = c.diritti_segreteria ? ' + ' + eur(c.diritti_segreteria) + ' di diritti di segreteria' : '';
    const listino = c.quota_listino != null ? 'listino ' + eur(c.quota_listino) + ' + IVA' : '';
    let ceiv = '';
    if (c.ceiv_gratuito) ceiv = 'imprese C.E.I.V.: gratuito' + dir;
    else if (c.quota_ceiv != null) ceiv = 'imprese C.E.I.V.: ' + eur(c.quota_ceiv) + ' + IVA';
    return [ceiv, listino].filter(Boolean).join(' · ');
  }

  /* (03/11/2026, osservazione dell'utente) un corso su più giornate già cominciato non è un corso da proporre: si dice
     che è iniziato e quale giornata è la prossima («giornata 3 di 4»), così nessuno lo scambia per un'edizione nuova */
  function avanzamento(e, oggi) {
    const g = giornate(e);
    const i = g.findIndex((d) => d >= oggi);
    const fatte = i < 0 ? g.length : i;
    return { tot: g.length, iniziato: fatte > 0 && i >= 0, finito: i < 0, n: i < 0 ? null : i + 1, prossima: i < 0 ? null : g[i], prima: g[0] || null, rimanenti: i < 0 ? [] : g.slice(i) };
  }
  function avviso(a, oggi) {
    if (!a.iniziato) return '';
    const d = dataDa(a.prima), p = dataDa(a.prossima);
    const quandoP = a.prossima === oggi ? 'oggi' : 'il ' + p.getUTCDate() + ' ' + MESI[p.getUTCMonth()];
    return 'Corso già iniziato il ' + d.getUTCDate() + ' ' + MESI[d.getUTCMonth()] + ': ' + quandoP + ' è la giornata ' + a.n + ' di ' + a.tot + '.';
  }

  /* le edizioni non ancora finite, con il catalogo accanto, raggruppate per mese della prossima giornata */
  function raggruppa(edizioni, catalogo, oggi, filtro) {
    const cat = {}; (catalogo || []).forEach((c) => { cat[c.codice] = c; });
    const f = String(filtro || '').trim().toLowerCase();
    const gruppi = [];
    (edizioni || [])
      .map((e) => ({ e, a: avanzamento(e, oggi) }))
      .filter(({ a }) => !a.finito)
      .filter(({ e }) => !f || [e.codice, e.titolo_programmazione, cat[e.codice] && cat[e.codice].titolo, e.sede].join(' ').toLowerCase().includes(f))
      .sort((x, y) => String(x.a.prossima).localeCompare(String(y.a.prossima)) || String(x.e.titolo_programmazione).localeCompare(String(y.e.titolo_programmazione)))
      .forEach(({ e, a }) => {
        const d = dataDa(a.prossima); if (!d) return;
        const chiave = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
        let gr = gruppi.find((x) => x.chiave === chiave);
        if (!gr) { gr = { chiave, titolo: MESI[d.getUTCMonth()].replace(/^./, (x) => x.toUpperCase()) + ' ' + d.getUTCFullYear(), righe: [] }; gruppi.push(gr); }
        gr.righe.push({ e, c: cat[e.codice] || null, a, avviso: avviso(a, oggi), quando: a.iniziato ? quando({ giornate: a.rimanenti }) : quando(e) });
      });
    return gruppi;
  }

  /* ── la pagina ── */
  let _dati = null, _filtro = '';

  async function leggi() {
    const sb = radice.sb;
    const [ed, ca] = await Promise.all([
      sb.from('formazione_calendario').select('id,codice,titolo_programmazione,data_inizio,data_fine,giornate,sede,fonte,importato_il').gte('data_fine', oggiRoma()).order('data_inizio'),
      sb.from('formazione_catalogo').select('codice,titolo,ore,validita,ceiv_gratuito,quota_ceiv,quota_listino,diritti_segreteria'),
    ]);
    if (ed.error) throw new Error('programmazione: ' + ed.error.message);
    if (ca.error) throw new Error('catalogo: ' + ca.error.message);
    _dati = { edizioni: ed.data || [], catalogo: ca.data || [] };
  }

  function disegna(host) {
    if (!host || !_dati) return;
    const gruppi = raggruppa(_dati.edizioni, _dati.catalogo, oggiRoma(), _filtro);
    const ult = _dati.edizioni.reduce((m, e) => (String(e.data_fine) > m ? String(e.data_fine) : m), '');
    const fonte = _dati.edizioni.length ? _dati.edizioni[_dati.edizioni.length - 1].fonte : '';
    const n = gruppi.reduce((s, g) => s + g.righe.length, 0);
    const testa = `<p style="font-size:12.5px;color:#555;margin:0 0 10px;line-height:1.45">La programmazione dei corsi dell'Ufficio Corsi Sicurezza della Scuola${fonte ? ' (<b>' + esc(fonte) + '</b>)' : ''}${ult ? ', fino al ' + esc(ult.split('-').reverse().join('/')) : ''}. Per date, posti e iscrizioni: <a href="mailto:corsi@formedilpadova.it">corsi@formedilpadova.it</a>.</p>`
      + `<input id="corsi-cerca" type="search" placeholder="Cerca un corso (es. ponteggi, PLE, primo soccorso)" value="${esc(_filtro)}" style="width:100%;max-width:420px;margin:0 0 12px">`;
    if (!n) {
      host.innerHTML = testa + `<div class="card" style="color:#777;font-size:13px">${_filtro ? 'Nessun corso in programma che corrisponda alla ricerca.' : 'Nessun corso in programma nella programmazione caricata: la prossima la carica la segreteria quando arriva dall\'Ufficio Corsi.'}</div>`;
      return;
    }
    host.innerHTML = testa + gruppi.map((g) => `<div class="card" style="margin-bottom:12px;padding:10px 12px">
      <div style="font-weight:700;color:#e7500f;margin-bottom:6px">${esc(g.titolo)}</div>
      ${g.righe.map(({ e, c, a, avviso: av, quando: q }) => `<div style="display:flex;gap:10px;padding:7px 0;border-top:1px solid #f0f0f0;flex-wrap:wrap${a.iniziato ? ';opacity:.85' : ''}">
        <div style="min-width:150px;font-weight:600;font-size:13px">${esc(q)}${a.tot > 1 && !a.iniziato ? `<div style="font-weight:400;color:#888;font-size:11.5px">${a.tot} giornate</div>` : ''}</div>
        <div style="flex:1;min-width:220px;font-size:13px">
          ${av ? `<div style="display:inline-block;background:#fff4e5;color:#8a4b00;border:1px solid #f3c58a;border-radius:6px;padding:1px 7px;font-size:11.5px;margin-bottom:3px">⏩ ${esc(av)}</div>` : ''}
          <div>${esc(e.titolo_programmazione || (c && c.titolo) || '')} <span style="color:#999;font-size:11.5px">cod. ${esc(e.codice)}</span></div>
          <div style="color:#666;font-size:12px">${[c && c.ore ? c.ore + ' ore' : '', e.sede ? (String(e.sede).toUpperCase() === 'ESTERNA' ? 'sede esterna' : 'sede ' + String(e.sede).toLowerCase().replace(/^./, (x) => x.toUpperCase())) : '', quota(c)].filter(Boolean).map(esc).join(' · ')}</div>
        </div></div>`).join('')}
    </div>`).join('');
  }

  async function mostra(host) {
    if (!host) return;
    if (!_dati) host.innerHTML = '<div style="color:#999;font-size:13px">Carico la programmazione…</div>';
    try { await leggi(); }
    catch (err) {
      host.innerHTML = `<div class="card" style="color:#b3261e;font-size:13px">Non sono riuscito a leggere la programmazione dei corsi (${esc(err.message)}). Non vuol dire che non ci siano corsi: riprova tra poco.</div>`;
      return;
    }
    disegna(host);
  }

  if (haDom) {
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'corsi-cerca') {
        _filtro = e.target.value;
        const host = document.getElementById('corsi-prog'); const pos = e.target.selectionStart;
        disegna(host);
        const nuovo = document.getElementById('corsi-cerca'); if (nuovo) { nuovo.focus(); try { nuovo.setSelectionRange(pos, pos); } catch (_e) { /* niente */ } }
      }
    });
  }

  const api = { mostra, giornate, quando, quota, raggruppa, avanzamento, avviso, eur };
  radice.corsiProgrammati = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
