/* ============================================================
   CREDITI FORMATIVI DEI TECNICI nella pagina «📄 Documenti» (17/11/2026)

   Deciso dall'utente: la segreteria tiene la contabilita' degli
   aggiornamenti obbligatori dei tecnici (coordinatore: 40 ore negli
   ultimi cinque anni; formatore: 24 ore per triennio) e li avvisa per
   tempo. Qui:
   - il TECNICO vede i propri: ore, fino a quando e' in regola, i corsi
     che contano;
   - il COORDINATORE vede tutti i tecnici, in sola lettura;
   - la segreteria registra i documenti nell'app segreteria («Documenti
     tecnici»), non qui.
   I dati li da' la funzione crediti_formativi() del database, che fa
   rispettare chi vede cosa. Il conteggio e' crediti-ore.js, copia
   generata dal modulo della segreteria (tools/genera-crediti-ore.cjs).
   Regole e fonti: 3_RISORSE/Normativa/2026_11_17_REL_Area-Sicurezza_
   aggiornamento-coordinatori-e-formatori-regole-e-fonti.md
   Script classico: usa window.sb, window.creditiOre.
   ============================================================ */

(function (radice) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const dataIt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
  const oggiIso = () => new Date().toLocaleDateString('sv-SE');
  const ore = (x) => (x == null ? '0' : String(Number(x)).replace('.', ','));
  const giorniA = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(oggiIso() + 'T00:00:00Z')) / 86400000);

  /* lo stato di un tecnico su un requisito: il conteggio a ore se le righe
     hanno il tipo, altrimenti la regola di sempre (l'ultima riga, la sua
     data di fine), come nella pagina «Documenti tecnici» della segreteria */
  function stato(req, suoi, origine, oggi) {
    const C = radice.creditiOre;
    if (!suoi.length) return { classe: 'mancante', testo: 'nessun documento registrato' };
    const s = C && C.statoConOre(req, suoi, oggi, origine);
    if (s) return { ...s, dettaglio: C.dettaglioOre(s, dataIt) };
    const doc = [...suoi].sort((a, b) => String(b.data_inizio || b.data_fine || '').localeCompare(String(a.data_inizio || a.data_fine || '')))[0];
    if (doc.senza_scadenza) return { classe: 'ok', testo: 'senza scadenza', doc };
    if (!doc.data_fine) return { classe: 'senzadata', testo: 'senza data di scadenza', doc };
    const g = giorniA(doc.data_fine);
    return { classe: g < 0 ? 'scaduto' : g <= (req.preavviso_giorni || 60) ? 'scade' : 'ok', scadenza: doc.data_fine, doc };
  }

  const ETICHETTA = { ok: 'In regola', scade: 'Da programmare', scaduto: 'Non in regola', senzadata: 'Da completare', mancante: 'Mancante' };
  const PILL = { ok: 'ok', scade: 'ap', scaduto: 'da', senzadata: 'ap', mancante: 'da' };

  function calcola(dati) {
    const oggi = oggiIso();
    const reqOre = (dati.requisiti || []).filter((r) => radice.creditiOre && radice.creditiOre.requisitoAOre(r));
    return (dati.tecnici || []).map((t) => {
      const suoiDi = (id) => (dati.documenti || []).filter((d) => d.tecnico_id === t.tecnico_id && d.requisito_id === id);
      return {
        t,
        voci: reqOre.map((r) => {
          const suoi = suoiDi(r.id);
          return { r, suoi, s: stato(r, suoi, r.origine_requisito_id ? suoiDi(r.origine_requisito_id) : [], oggi) };
        }),
      };
    });
  }

  function riga(v) {
    const s = v.s;
    const fino = s.classe === 'scaduto' && s.scadenza ? `dal ${dataIt(s.scadenza)}` : s.scadenza ? `fino al ${dataIt(s.scadenza)}` : '';
    return `<span class="doc-pill ${PILL[s.classe] || 'ap'}">${esc(ETICHETTA[s.classe] || s.classe)}${fino ? ' ' + esc(fino) : ''}</span>`;
  }

  function cartaMia(x) {
    const blocchi = x.voci.map((v) => {
      const corsi = v.suoi.filter((d) => d.tipo === 'aggiornamento' || d.tipo === 'docenza')
        .sort((a, b) => String(b.data_inizio || '').localeCompare(String(a.data_inizio || '')))
        .map((d) => `<div class="doc-riga"><span>${esc(dataIt(d.data_inizio))}</span><span>${esc(d.descrizione || (d.tipo === 'docenza' ? 'Docenza' : 'Aggiornamento'))}</span><span class="doc-piccolo">${ore(d.ore)} ore${d.tipo === 'docenza' ? ' di docenza' : ''}</span>${/^https:\/\//.test(d.drive_url || '') ? `<a class="doc-btn" href="${esc(d.drive_url)}" target="_blank" rel="noopener">📄 Apri</a>` : ''}</div>`).join('');
      return `<div class="doc-q">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><strong>${esc(v.r.descrizione)}</strong> ${riga(v)}</div>
        ${v.s.dettaglio ? `<div class="doc-piccolo">${esc(v.s.dettaglio)}</div>` : v.s.testo ? `<div class="doc-piccolo">${esc(v.s.testo)}</div>` : ''}
        ${corsi ? `<details class="doc-prec"><summary>Corsi e docenze che contano</summary>${corsi}</details>` : ''}
      </div>`;
    }).join('');
    return `<div class="doc-card doc-pannello"><h3>🎓 I tuoi aggiornamenti obbligatori</h3>
      <p class="doc-piccolo">Coordinatore: 40 ore di aggiornamento negli ultimi cinque anni (dopo i primi cinque dal corso da 120 ore). Formatore: 24 ore ogni tre anni, di cui almeno 8 in corsi, oppure 24 ore di docenza. Se manca un corso che hai fatto, manda l'attestato alla segreteria (cpt@formedilpadova.it): lo registra lei.</p>
      ${blocchi || '<p class="doc-piccolo">Nessun requisito da seguire.</p>'}</div>`;
  }

  function tabella(lista) {
    const reqOre = lista.length ? lista[0].voci.map((v) => v.r) : [];
    const testata = reqOre.map((r) => `<th>${esc(r.breve || r.descrizione)}</th>`).join('');
    const corpo = lista.map((x) => `<tr><td>${esc(`${x.t.tecnico_cognome || ''} ${x.t.tecnico_nome || ''}`.trim())}</td>${x.voci.map((v) => `<td>${riga(v)}<div class="doc-piccolo">${esc(v.s.dettaglio || v.s.testo || '')}</div></td>`).join('')}</tr>`).join('');
    return `<div class="doc-card doc-pannello"><h3>🎓 Aggiornamenti obbligatori dei tecnici</h3>
      <p class="doc-piccolo">Sola lettura. «Da programmare» vuol dire che entro sei mesi le ore non bastano più: la segreteria avvisa il tecnico. I documenti si registrano nell'app segreteria.</p>
      <div class="doc-tab"><table><thead><tr><th>Tecnico</th>${testata}</tr></thead><tbody>${corpo}</tbody></table></div></div>`;
  }

  async function box(host) {
    if (!host || !radice.sb) return;
    host.innerHTML = '<div class="doc-card doc-piccolo">Carico gli aggiornamenti…</div>';
    const { data, error } = await radice.sb.rpc('crediti_formativi');
    if (error) { host.innerHTML = '<div class="doc-card doc-ko">Non sono riuscito a leggere gli aggiornamenti obbligatori: ' + esc(error.message) + '</div>'; return; }
    if (!radice.creditiOre) { host.innerHTML = '<div class="doc-card doc-ko">Il conteggio degli aggiornamenti non si è caricato: ricarica la pagina.</div>'; return; }
    const dati = data || {};
    if (dati.ruolo === 'nessuno' || !(dati.tecnici || []).length) { host.innerHTML = ''; return; }
    const lista = calcola(dati);
    if (dati.ruolo === 'tecnico') host.innerHTML = cartaMia(lista[0]);
    else host.innerHTML = tabella(lista);
  }

  const api = { box, calcola, stato };
  radice.creditiFormativi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
