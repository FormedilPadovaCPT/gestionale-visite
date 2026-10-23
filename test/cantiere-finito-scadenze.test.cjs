// node test/cantiere-finito-scadenze.test.cjs
// (23/10/2026, chiesto dall'utente) Dalla pagina Scadenze il tecnico segnala che un cantiere è finito:
// «🏁» sulla riga del PC, «🏁 Finito» nella barra del telefono, «🏁 Cantiere finito» nel dettaglio del verbale.
// È la proposta di chiusura del 23/09 con in più il giorno visto. Finché è aperta il rientro esce dalle
// scadenze e sta in fondo, «⏳ In attesa di chiusura» — e così il promemoria del lunedì e la lettera di
// incarico (le tre liste coincidono). Decidono segreteria o Coordinatore; respinta, il rientro torna col motivo.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n');
const html = leggi('index.html');
const pc = leggi('proposte-chiusura.js');
const rg = leggi('rientri-giorni.js');
const sql = leggi('supabase', 'sql', '2026_10_23_cantiere_finito_dalle_scadenze.sql');
const aiuto = leggi('aiuto.js');
const seg = path.join(dir, '..', 'segreteria-app', 'js');
const lettera = fs.existsSync(seg) ? fs.readFileSync(path.join(seg, 'fatture-tecnici.js'), 'utf8').replace(/\r\n/g, '\n') : null;

/* ── database ── */
assert.ok(/add column if not exists fine_constatata_il date/.test(sql), 'la proposta porta il giorno visto');
assert.ok(/proponi_chiusura_cantiere\(p_cantiere_id text, p_motivo text, p_fine_il date default null\)/.test(sql), 'terzo parametro facoltativo: le chiamate di prima restano valide');
assert.ok(/drop function if exists public\.proponi_chiusura_cantiere\(text, text\);/.test(sql), 'la firma vecchia si toglie: niente due funzioni con lo stesso nome');
assert.ok(/p_fine_il > v_oggi then raise exception/.test(sql) && /p_fine_il < v_ultima then/.test(sql), 'niente date nel futuro né prima dell’ultima visita');
assert.ok(/revoke all on function public\.proponi_chiusura_cantiere\(text, text, date\) from public, anon;/.test(sql), 'la funzione nuova non è aperta ad anon');
const ric = sql.slice(sql.indexOf('create or replace function public.ricontrolli_pendenti'));
assert.ok(/and not exists \(select 1 from public\.cantieri_proposte_chiusura pc\s+where pc\.cantiere_id = v\.cantiere_id and pc\.esito is null\)/.test(ric), 'il promemoria del lunedì salta i cantieri proposti');
assert.ok(/'\\D'/.test(ric), 'la pulizia del numero di accesso è quella di prima');

/* ── pagina Scadenze ── */
const load = html.slice(html.indexOf('async function loadScadenze(){'), html.indexOf('// Dati scadenze calcolati'));
assert.ok(load.length > 1000, 'loadScadenze trovata');
assert.ok(/catch\(e\)\{toast\('Non sono riuscito a leggere le proposte di chiusura \('/.test(load), 'lettura fallita ≠ nessuna proposta: si dice');
const iCalc = load.indexOf('if(!calc.date)return'), iAtt = load.indexOf('if(_pa){inAttesa.push({...v,_prop:_pa});return}'), iPush = load.indexOf('prossime.push(');
assert.ok(iCalc > 0 && iAtt > iCalc && iPush > iAtt, 'il proposto esce PRIMA di finire fra prossime e urgenti, e solo se un rientro era dovuto');
assert.ok(/_scadData=\{prossime,urgenti,inAttesa,tecMap,scadRow,attesaRow\}/.test(load), 'i dati in attesa arrivano al disegno');
assert.ok(/window\.propChius\.puoProporre\(\)\)\?'<button class="btn-outline btn-sm" style="margin-left:4px" data-prop-finito=/.test(load), '🏁 sulla riga solo a chi può proporre');
assert.ok(/data-prop-chiudi="'\+esc\(v\.cantiere_id\)\+'"[^\n]*data-prop-resp=/.test(load), 'nel gruppo in attesa l’ufficio chiude o respinge');
const rend = html.slice(html.indexOf('function renderScadenze(){'), html.indexOf('window.ricaricaScadenze='));
assert.ok(/const fA=inAttesa\.filter\(v=>\(!filtroTec\|\|v\.tecnico_id===filtroTec\)&&_scadPass\(v\)\)/.test(rend), 'il gruppo segue i filtri della pagina');
assert.ok(/in attesa di chiusura`:''\)/.test(rend) && /\{urgenti:fU,prossime:fP,inAttesa:fA,/.test(rend), 'conteggio a parte e lista per giorno');
assert.ok(html.includes('id="scad-attesa-card"') && html.includes('id="tbody-scad-attesa"'), 'la carta in fondo alla pagina');
assert.ok(html.includes('cantiere_id,cantieri(cantiere_etichetta,cantiere_indirizzo,cantiere_civico,comune_nome,cantiere_cnce,prot_int)'), 'il dettaglio del verbale legge il cantiere');
assert.ok(/window\.propChius\.dettaglioVisita\(v\.cantiere_id,v\.data_visita\)/.test(html), 'il dettaglio del verbale offre «Cantiere finito»');
assert.ok(/async function chiudiCantiere\(cantId,label,notaPre\)/.test(html) && /Premi Annulla per interrompere l\\'operazione\.',notaPre\|\|''\)/.test(html), 'la data vista arriva nella nota della chiusura');
assert.ok(html.includes('proposte-chiusura.js?v=3') && html.includes('rientri-giorni.js?v=7'), 'versioni aggiornate: il telefono non tiene i file vecchi');

/* ── proposte-chiusura.js: la finestra e i controlli ── */
assert.ok(/max="\$\{oggi\(\)\}"\$\{minimo \? ` min="\$\{minimo\}"` : ''\}/.test(pc), 'la data ha i limiti anche nel campo');
assert.ok(/p_fine_il: data/.test(pc), 'il giorno visto va al database');
assert.ok(/const puoProporre = \(\) => !ufficio\(\) && !document\.body\.classList\.contains\('viewer-mode'\);/.test(pc), 'non propone chi chiude da sé né chi è di sola lettura');
assert.ok(/if \(c\.error \|\| p\.error\) return;/.test(pc), 'nel dettaglio, senza saperlo non si offre il pulsante');

/* perScadenze: aperte per cantiere, ultima respinta per cantiere; un errore si rilancia */
function caricaPc(risposte) {
  const q = (r) => { const o = { select: () => o, is: () => o, eq: () => o, gte: () => o, order: () => o, limit: () => Promise.resolve(r()), maybeSingle: () => Promise.resolve(r()) }; return o; };
  const win = { sb: { from: () => q(risposte.shift()) } };
  const ctx = { window: win, document: { addEventListener() {}, getElementById: () => null, body: { classList: { contains: () => false } } }, alert() {}, prompt() {}, Promise, Map, Set, Date, String, Number, console };
  vm.createContext(ctx);
  vm.runInContext(pc, ctx);
  return win.propChius;
}
(async () => {
  let p = caricaPc([
    () => ({ data: [{ id: 7, cantiere_id: 'A', motivo: 'Lavori finiti', fine_constatata_il: '2026-10-22' }], error: null }),
    () => ({ data: [{ id: 5, cantiere_id: 'B', esito_il: '2026-10-20T10:00:00Z', esito_note: 'ancora ponteggio' }, { id: 3, cantiere_id: 'B', esito_il: '2026-09-01T10:00:00Z', esito_note: 'vecchia' }], error: null }),
  ]);
  const r = await p.perScadenze();
  assert.strictEqual(r.aperte.get('A').id, 7, 'aperte per cantiere');
  assert.strictEqual(r.respinte.get('B').esito_note, 'ancora ponteggio', 'per cantiere vale la respinta più recente');
  p = caricaPc([() => ({ data: [], error: null }), () => ({ data: null, error: { message: 'rete' } })]);
  await assert.rejects(() => p.perScadenze(), (e) => /rete/.test(e.message),'una lettura fallita non diventa «nessuna respinta»');
  assert.strictEqual(p.testoProposta({ proposta_nome: 'Franco Caon', proposta_il: '2026-10-23T08:00:00Z', fine_constatata_il: '2026-10-22' }), 'Franco Caon il 23/10/2026 · finito il 22/10/2026');

  /* ── rientri-giorni.js: il gruppo in fondo e il pulsante della barra ── */
  const box = { id: 'scad-giorni', dataset: {}, innerHTML: '', querySelector: () => null, appendChild() {}, contains: () => false, addEventListener() {} };
  const doc = { getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} }, activeElement: null, body: { classList: { contains: () => false } } };
  const win2 = { propChius: { ufficio: () => false, puoProporre: () => true, testoProposta: () => 'Franco Caon il 23/10/2026 · finito il 22/10/2026' } };
  const ctx2 = { window: win2, document: doc, console, Map, Set, Date, String, Number };
  vm.createContext(ctx2);
  vm.runInContext(rg, ctx2);
  const v = (id, nr, extra) => Object.assign({ visita_id: 'V' + id, cantiere_id: id, nr_verbale: 'CPT/26_27/' + nr, ipc: 'MEDIO', acc_cant: 1, data_visita: '2026-10-01', cantieri: { cantiere_indirizzo: 'Via Roma', cantiere_civico: '1', comune_nome: 'PADOVA' } }, extra || {});
  const domani = new Date(); domani.setDate(domani.getDate() + 1);
  win2.RientriGiorni.render(box, {
    urgenti: [v('U1', '0001', { diffDays: -3, dr: new Date(), _resp: { esito_note: 'ancora ponteggio' } })],
    prossime: [v('P1', '0002', { diffDays: 1, dr: domani })],
    inAttesa: [v('A1', '0003', { _prop: { id: 7, motivo: 'Lavori finiti: area sgomberata', proposta_nome: 'Franco Caon' } })],
    tecMap: {}, segreteria: false, puoVisitare: true,
  });
  const h = box.innerHTML;
  assert.ok(h.includes('⏳ IN ATTESA DI CHIUSURA'), 'il gruppo in attesa si vede');
  assert.ok(h.indexOf('IN ATTESA DI CHIUSURA') > h.indexOf('0002'), 'ed è in fondo, dopo i rientri');
  const att = h.slice(h.indexOf('IN ATTESA DI CHIUSURA'));
  assert.ok(!/data-rg="sel"/.test(att), 'le righe in attesa non si spuntano (non entrano nel giro né nella barra)');
  assert.ok(att.includes('Lavori finiti: area sgomberata') && !/data-prop-chiudi/.test(att), 'il tecnico vede il motivo, non chiude');
  assert.ok(h.includes('✖ Chiusura respinta: ancora ponteggio'), 'la riga tornata dice perché');
  assert.ok(/data-rg="finito-sel"/.test(rg) && /window\.propChius\.finestra\(righe\.map/.test(rg), 'la barra del tecnico apre la finestra della proposta');
  win2.propChius.ufficio = () => true;
  win2.RientriGiorni.render(box, { urgenti: [], prossime: [], inAttesa: [v('A1', '0003', { _prop: { id: 7, motivo: 'x' } })], tecMap: {}, segreteria: true, puoVisitare: true });
  assert.ok(/data-prop-chiudi="A1"/.test(box.innerHTML) && /data-prop-resp="7"/.test(box.innerHTML), 'all’ufficio: chiudi o respingi dalla riga');

  /* ── nuvolette ── */
  ['prop-chius-ok', 'prop-chius-annulla', 'prop-chius-data'].forEach((k) => assert.ok(aiuto.includes(`'${k}':`), 'nuvoletta per ' + k));

  /* ── segreteria: la lettera di incarico non assegna i cantieri proposti ── */
  if (lettera) {
    assert.ok(/\.from\('cantieri_proposte_chiusura'\)\.select\('cantiere_id'\)\.is\('esito', null\)\.in\('cantiere_id', ids\)/.test(lettera), 'la lettera legge le proposte aperte');
    assert.ok(/if \(ePc\) throw new Error/.test(lettera), 'senza saperlo la lettera non si fa');
    assert.ok(/!cant\[v\.cantiere_id\]\?\.cantiere_chiuso && !proposti\.has\(v\.cantiere_id\)/.test(lettera), 'e li toglie dai rientri');
  }
  console.log('cantiere-finito-scadenze: ok');
})().catch((e) => { console.error(e); process.exit(1); });
