// node test/riapri-db-vince.test.cjs
// (03/10/2026, controllo prima del 05/10) Riaprire un verbale e risalvarlo senza toccare niente non
// deve cambiare niente. Non era così: il verbale si riapriva dalla copia della maschera
// (visite_snapshot) e la copia resta indietro quando il verbale viene corretto fuori dalla maschera.
// Caso vero: CPT/26_27/0001 e 0002, corretti il 03/10 — riaperti e salvati avrebbero perso l'ora di
// fine, il cantiere giusto e il codice fiscale del committente.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const dati = fs.readFileSync(path.join(dir, 'app-data.js'), 'utf8');

const a = dati.indexOf('function snapAllineaAlDb(copia,db){'), b = dati.indexOf('// --- fine snapAllineaAlDb');
assert.ok(a > 0 && b > a, 'non trovo snapAllineaAlDb in app-data.js');
const ctx = vm.createContext({});
vm.runInContext(dati.slice(a, b) + '\nthis.f=snapAllineaAlDb', ctx);
const allinea = ctx.f;
const piatto = (x) => JSON.parse(JSON.stringify(x));

const imp = (o) => Object.assign({ impresa_id: 'A1', impresa_nome: 'ALFA', att: '', capo_nome: 'Mario', capo_cog: 'Rossi', nom_prec: '', badge: '', pat: '', note_fasilav: '', nr_lav: 2, nr_lav_str: 0, tipo_imp: '1', certif: [1], ceiv: 'C.E.I.V.', email_verbale: 'alfa@example.it' }, o || {});
const impDb = (o) => Object.assign({ impresa_id: 'A1', impresa_nome: 'ALFA', piva: '', cf_imp: '', ind_imp: '', com_imp: '', att: '', capo_nome: '', capo_cog: '', nom_prec: 'Mario Rossi', nr_lav: 2, nr_lav_str: 0, badge: '', pat: '', note_fasilav: '', tipo_imp: 1, ruolo: 'affidataria', is_principale: true }, o || {});
const copia = () => ({
  visita_id: 'V1', nr_verbale_origine: 'CPT/26_27/0009', data_visita: '2026-10-05', ora_visita: '09:30', ora_fine: null, tipo_accesso: '5',
  rlst_sn: '0', stage_vis: null, ppre_nome: 'Luca', ppre_cog: 'Bianchi', nom_ppre: 'Luca Bianchi', qual_ppre: 'Preposto',
  tecnico_id: 'T1', tecnico_email: 't1@example.it', tec_display: 'Tecnico Uno', cantiere_id: 'C-VECCHIO', cantiere_label: 'Via Vecchia 1', cnce: 'X1', cod_uni: 'U1', committente_id: 'K1',
  comm_tipo_sogg: 'PF', comm_tipo: '2', comm_nome: 'Anna', comm_cog: 'Verdi', comm_cf: null, comm_cf_pg: null, comm_email_alt: 'altro@example.it',
  coord: true, rl_nome: 'Mario', rl_cog: 'Bortolomami', importo: '3', note_lav: 'scavo', oss_tec: 'niente da segnalare', note_for_sn: false, note_for_tipi: ['B', 'A'], segnalazione: false,
  imprese: [imp()], checklist: { IMP_ELE_001: 'OSS', DPI_001: 'VER' }, note_checklist: { IMP_ELE_001: 'quadro da sostituire' },
  lavorazioni: [{ genere: 'Edile', fase: 'Scavi', lavorazione: 'Sbancamento' }], exported_at: '2026-10-05T08:00:00Z'
});
const db = (o) => Object.assign({
  visita_id: 'V1', nr_verbale_origine: 'CPT/26_27/0009', data_visita: '2026-10-05', ora_visita: '09:30', ora_fine: null, tipo_accesso: 5,
  rlst_sn: false, stage_vis: false, nom_stage: null, ppre_titolo: null, ppre_nome: 'Luca', ppre_cog: 'Bianchi', nom_ppre: 'Luca Bianchi', qual_ppre: 'Preposto', tel_ppre: null,
  tecnico_id: 'T1', tecnico_email: 't1@example.it', tec_display: 'Tecnico Uno', tecnico2_id: null, cantiere_id: 'C-VECCHIO', cantiere_label: 'VIA VECCHIA 1', cnce: 'X1', cod_uni: 'U1', committente_id: 'K1', prot_int: null,
  comm_tipo_sogg: 'PF', comm_tipo: 2, comm_titolo: null, comm_nome: 'Anna', comm_cog: 'Verdi', comm_cf: null, comm_email: null, comm_tel: null, comm_rag_soc: null, comm_piva: null,
  coord: true, rl_titolo: null, rl_nome: 'Mario', rl_cog: 'Bortolomami', rl_email: null, rl_tel: null, importo: 3, costi: null, stato_lav: null, note_lav: 'scavo',
  oss_tec: 'niente da segnalare', oss_int: null, note_for_sn: false, note_for_m: null, note_for_tipi: ['A', 'B'], segnalazione: false, data_ritorno: null,
  imprese: [impDb()], checklist: { IMP_ELE_001: 'OSS', DPI_001: 'VER' }, note_checklist: { IMP_ELE_001: 'quadro da sostituire ' },
  lavorazioni: [{ genere: 'Edile', fase: 'Scavi', lavorazione: 'Sbancamento' }], _rebuilt_from_db: true
}, o || {});

// 1) copia e database d'accordo: la maschera si apre ESATTAMENTE dalla copia, come prima
{
  const c = copia(), r = allinea(c, db());
  assert.deepStrictEqual(piatto(r.diversi), [], 'copia e database coincidono: nessun campo «corretto»');
  assert.deepStrictEqual(piatto(r.avvisi), []);
  assert.deepStrictEqual(piatto(r.snap), piatto(c), 'con copia e database allineati non deve cambiare niente rispetto a ieri');
}
// 2) il caso vero: verbale corretto in archivio dopo l'ultimo salvataggio
{
  const r = allinea(copia(), db({
    ora_fine: '15:27:00', cantiere_id: '10145', cantiere_label: 'Via Nuova 7', cnce: 'Y9', cod_uni: 'U9', committente_id: 'K2',
    rl_cog: 'Bortolami', rl_titolo: 'Dott.', comm_cf: 'MCCMKM82D63Z127G',
    imprese: [impDb({ nr_lav: 1, nom_prec: 'Eugen Hagiu' })]
  }));
  const s = r.snap;
  assert.strictEqual(String(s.ora_fine).slice(0, 5), '15:27', 'l’ora di fine corretta non si perde');
  assert.strictEqual(s.cantiere_id, '10145'); assert.strictEqual(s.cantiere_label, 'Via Nuova 7'); assert.strictEqual(s.cnce, 'Y9'); assert.strictEqual(s.committente_id, 'K2');
  assert.strictEqual(s.rl_cog, 'Bortolami'); assert.strictEqual(s.rl_titolo, 'Dott.');
  assert.strictEqual(s.comm_cf, 'MCCMKM82D63Z127G', 'persona fisica: il codice fiscale va nel campo della persona fisica');
  assert.strictEqual(s.imprese.length, 1); assert.strictEqual(s.imprese[0].nr_lav, 1); assert.strictEqual(s.imprese[0].nom_prec, 'Eugen Hagiu');
  assert.strictEqual(s.imprese[0].capo_nome, '', 'il preposto corretto non deve essere coperto dal nome vecchio');
  assert.strictEqual(s.imprese[0].email_verbale, 'alfa@example.it', 'quello che ha solo la copia resta');
  assert.deepStrictEqual(piatto(s.imprese[0].certif), [1]);
  assert.strictEqual(s.comm_email_alt, 'altro@example.it', 'i campi che il database non tiene restano quelli della copia');
  for (const n of ['ora di fine', 'cantiere', 'responsabile dei lavori', 'committente', 'imprese']) assert.ok(r.diversi.includes(n), 'manca «' + n + '» fra i campi corretti: ' + r.diversi.join(', '));
  assert.strictEqual(new Set(r.diversi).size, r.diversi.length, 'ogni nome una volta sola');
}
// 3) differenze che non sono differenze: maiuscole del codice fiscale, secondi dell'ora, 5 e «5», ordine dei tipi
{
  const c = copia(); c.comm_cf = 'mccmkm82d63z127g'; c.ora_fine = '15:27';
  const r = allinea(c, db({ comm_cf: 'MCCMKM82D63Z127G', ora_fine: '15:27:00' }));
  assert.deepStrictEqual(piatto(r.diversi), [], 'non devono risultare differenze: ' + r.diversi.join(', '));
}
// 4) persona giuridica: il codice fiscale va nel campo della persona giuridica
{
  const c = copia(); c.comm_tipo_sogg = 'PG';
  const r = allinea(c, db({ comm_tipo_sogg: 'PG', comm_cf: '01234567890' }));
  assert.strictEqual(r.snap.comm_cf_pg, '01234567890'); assert.strictEqual(r.snap.comm_cf, null);
}
// 5) coordinamento: «non scelto» resta «non scelto», non diventa «no»
{
  const c = copia(); c.coord = null;
  assert.deepStrictEqual(piatto(allinea(c, db({ coord: null })).diversi), []);
  const r = allinea(c, db({ coord: false }));
  assert.strictEqual(r.snap.coord, false); assert.ok(r.diversi.includes('coordinamento'));
}
// 6) check-list corretta in archivio: vale quella del database, note comprese
{
  const r = allinea(copia(), db({ checklist: { IMP_ELE_001: 'NC-', DPI_001: 'VER', X_N: 'nota' }, note_checklist: { IMP_ELE_001: 'quadro da sostituire', X_N: 'nota di gruppo' } }));
  assert.strictEqual(r.snap.checklist.IMP_ELE_001, 'NC-'); assert.strictEqual(r.snap.note_checklist.X_N, 'nota di gruppo'); assert.ok(r.diversi.includes('check-list'));
}
// 7) salvataggio rimasto a metà: nel database check-list, lavorazioni o imprese sono vuote e la copia le ha.
//    Si tengono quelle della copia e lo si dice: prendere il vuoto per buono le cancellerebbe.
{
  const c = copia(), r = allinea(c, db({ checklist: {}, note_checklist: {}, lavorazioni: [], imprese: [] }));
  assert.deepStrictEqual(piatto(r.snap.checklist), piatto(c.checklist)); assert.strictEqual(r.snap.lavorazioni.length, 1); assert.strictEqual(r.snap.imprese.length, 1);
  assert.deepStrictEqual(piatto(r.avvisi), ['la check-list', 'le lavorazioni', 'le imprese']);
}
// 8) senza copia si apre dal database; senza database si apre dalla copia
assert.strictEqual(allinea(null, db()).snap._rebuilt_from_db, true);
assert.strictEqual(allinea(copia(), null).snap.visita_id, 'V1');
// 9) un'impresa aggiunta in archivio che la copia non conosce entra com'è
{
  const r = allinea(copia(), db({ imprese: [impDb(), impDb({ impresa_id: 'B2', impresa_nome: 'BETA', nom_prec: '', nr_lav: 3, tipo_imp: 4, ruolo: 'subappaltatrice' })] }));
  assert.strictEqual(r.snap.imprese.length, 2); assert.strictEqual(r.snap.imprese[1].impresa_id, 'B2'); assert.strictEqual(r.snap.imprese[1].is_principale, false);
  assert.strictEqual(r.snap.imprese[0].capo_nome, 'Mario', 'l’impresa non toccata tiene nome e cognome separati del preposto');
}

// ── la pagina usa davvero la regola ─────────────────────────────────────────────────────────────
const riapri = html.slice(html.indexOf('async function riapriBozza(vid){'), html.indexOf('// ── PDF ──'));
assert.ok(/rebuildSnapFromDB\(vid,\{riapri:true\}\)/.test(riapri) && /snapAllineaAlDb\(snapRow&&snapRow\.snapshot,dalDb\)/.test(riapri), 'riapriBozza deve allineare la copia al database');
assert.ok(!/const\{data:chkRows\}=await sb\.from\('visite_checklist'\)/.test(html.slice(html.indexOf('async function riapriBozza'), html.indexOf('async function rebuildSnapFromDB') + 2500)), 'la check-list non si legge più ignorando l’errore');
const reb = html.slice(html.indexOf('async function rebuildSnapFromDB(vid,opt){'), html.indexOf('// Mostra nel modal-qd la scelta su come precompilare'));
assert.strictEqual((reb.match(/letto\(await sb\.from\(/g) || []).length, 4, 'verbale, check-list, lavorazioni e imprese: ogni lettura controlla l’errore');
for (const k of ['note_lav:v.note_lav', 'tecnico2_id:v.tecnico2_id', 'prot_int:v.prot_int', "coord:v.coord==null?null", 'importo:cant.cantiere_importo', 'committente_id:cant.cantiere_committente_id'])
  assert.ok(reb.includes(k), 'riaprendo dal database non si deve perdere: ' + k);

// ── le altre correzioni dello stesso giro ───────────────────────────────────────────────────────
// una nota su una voce senza valutazione: «valore» è obbligatorio nel database, null faceva fallire il salvataggio
assert.ok(html.includes("chkMerge[codice]={visita_id:vid,codice,valore:'nota',nota}") && !html.includes('codice,valore:null,nota}'), 'la nota senza valutazione si salva con valore «nota»');
// un salvataggio per volta
assert.ok(/let _salvando=false\s+async function saveVisita\(stato\)\{\s+if\(_salvando\)\{[^\n]+return\}\s+_salvando=true\s+try\{return await _saveVisitaCorpo\(stato\)\}finally\{_salvando=false\}/.test(html), 'due tocchi su Bozza/Definitivo non fanno due salvataggi');
// la foto non registrata non passa per «caricata»
assert.ok(!html.includes("console.warn('visite_foto upsert:'") && html.includes('la foto è arrivata su Drive ma non è stata registrata nel verbale'), 'una foto non registrata si dice');
// verbale non salvato: si chiede prima di buttarlo, e non si scrive niente
const g = html.slice(html.indexOf('function _formImpronta(){'), html.indexOf("window.addEventListener('beforeunload'") + 120);
assert.ok(g.includes('function formDaNonPerdere(){') && g.includes('if(formSporco()){e.preventDefault()'), 'manca la guardia sul verbale non salvato');
assert.ok(!/sb\.|localStorage|sessionStorage/.test(g), 'la guardia non salva niente da nessuna parte: non è un salvataggio automatico');
assert.strictEqual((html.match(/if\(formDaNonPerdere\(\)\)/g) || []).length, 6, 'i sei punti che aprono una maschera nuova chiedono prima di buttare quella non salvata');
assert.strictEqual((html.match(/S\._formBase=null/g) || []).length, 2, 'la maschera torna «pulita» all’apertura e dopo un salvataggio riuscito');

// una maschera nuova nasce vuota davvero: niente elenco di campi scritto a mano (restavano titolo di RL/CSP/CSE, importo, tipo del committente)
const az = html.slice(html.indexOf('function _formAzzera(){'), html.indexOf('async function initForm(snap=null){'));
assert.ok(az.includes('#view-form input[id^="f-"]') && az.includes('el.defaultValue') && az.includes('el.defaultChecked') && az.includes('defaultSelected') && az.includes('proponiImportoCantiere(null)') && az.includes('clearCommittente()'), 'la maschera si azzera per intero, non per elenco');
assert.ok(/S\._formBase=null\s+try\{_formAzzera\(\)\}/.test(html), 'initForm azzera la maschera per prima cosa, prima di aspettare il numero dal server');
// i dati pronti (cantiere, incarico) si scrivono DOPO che la maschera è pronta, non dopo un tempo fisso
assert.strictEqual((html.match(/const _pronta=initForm\(\)/g) || []).length, 3, '«+ Visita», «+ Nuova visita» e «Fai la visita» aspettano initForm');
assert.ok(!/initForm\(\);?\s*navTo\('form'\)\s*setTimeout\(/.test(html), 'niente più dati scritti a tempo dopo initForm: lo svuotamento ci passava sopra');

// check-list, lavorazioni e imprese si riscrivono in una sola transazione; i sei passi di prima restano solo se la funzione non c'è
const figli = html.slice(html.indexOf("await sb.rpc('salva_figli_verbale'"), html.indexOf('entra in anagrafica, se lì non ce n'));
assert.ok(html.includes("await sb.rpc('salva_figli_verbale',{p_visita_id:vid,p_checklist:chkRows,p_lavorazioni:lavRows,p_imprese:impRows})"), 'il salvataggio passa da salva_figli_verbale');
assert.ok(/if\(_eFg&&\(_eFg\.code==='PGRST202'\|\|_eFg\.code==='42883'\)\)\{/.test(figli), 'il ripiego vale solo quando la funzione non esiste, non per un errore qualunque');
assert.ok(/\}else\{\s+if\(_eFg\|\|!_fg\|\|!_fg\.ok\)throw new Error\(/.test(figli) && figli.includes('_fg.checklist!==chkRows.length'), 'un errore della funzione ferma il salvataggio e lo dice');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_03_salva_figli_verbale.sql'), 'utf8');
assert.ok(!/security definer/i.test(sql.replace(/--[^\n]*/g, '')) && /grant execute[^;]+to authenticated/i.test(sql) && /revoke all[^;]+from public, anon/i.test(sql), 'la funzione gira coi permessi di chi la chiama e non è aperta a tutti');
assert.ok(sql.includes("coalesce(nullif(x->>'valore', ''), 'nota')"), 'anche il database mette «nota» a una nota senza valutazione');

console.log('riapri-db-vince: ok');
