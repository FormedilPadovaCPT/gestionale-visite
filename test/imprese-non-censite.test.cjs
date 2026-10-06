// node test/imprese-non-censite.test.cjs
// (06/10/2026, chiesto dall'utente) Nei cantieri grandi non si riescono a raccogliere i dati di tutte le imprese:
// nel passo Imprese tre numeri — altre imprese, i loro lavoratori, lavoratori autonomi — che si sommano ai totali
// del cantiere (nr_imp, nr_lavoratori, nr_ind), cioè a verbale, statistiche e Osservatorio.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const dati = fs.readFileSync(path.join(dir, 'app-data.js'), 'utf8');
const pdf = fs.readFileSync(path.join(dir, 'verbale-pdf.js'), 'utf8');
const veste = fs.readFileSync(path.join(dir, 'veste-v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_06_visite_imprese_non_censite.sql'), 'utf8');
const pezzo = (re, cosa) => { const m = html.match(re); assert.ok(m, 'non trovo ' + cosa); return m[0]; };

/* ── il calcolo ── */
const codice = [
  pezzo(/function _ncNum\(x\)\{[^\n]*\n/, '_ncNum'),
  pezzo(/function altreNonCensite\(\)\{[^\n]*\n/, 'altreNonCensite'),
  pezzo(/function computeImpTotals\(righe,altre\)\{[\s\S]*?\n\}\n/, 'computeImpTotals'),
  pezzo(/function zeroLavoratori\(tot\)\{[^\n]*\n/, 'zeroLavoratori'),
].join('\n');
const campi = {};
const ctx = vm.createContext({ TIPO_IMP_AUTONOMO: 5, S: { imprese: [] }, vGet: (id) => campi[id] || '' });
vm.runInContext(codice + '\nthis.tot=computeImpTotals;this.nc=altreNonCensite;this.zero=zeroLavoratori', ctx);
ctx.S.imprese = [
  { impresa_id: 'A', tipo_imp: '1', nr_lav: 3 }, { impresa_id: 'B', tipo_imp: '4', nr_lav: 4 },
  { impresa_id: 'C', tipo_imp: '3', nr_lav: 5 }, { impresa_id: 'D', tipo_imp: '5', nr_lav: 1 },
];
let t = ctx.tot();
assert.deepStrictEqual([t.nr_imp, t.nr_ind, t.nr_lavoratori], [3, 1, 13], 'senza non censiti: com’era');
Object.assign(campi, { 'f-nc-imp': '4', 'f-nc-lav': '10', 'f-nc-aut': '2' });
t = ctx.tot();
assert.deepStrictEqual([t.nr_imp, t.nr_ind, t.nr_lavoratori], [7, 3, 23], '4 imprese elencate (una autonoma) + 4 non censite con 10 lavoratori + 2 autonomi');
t = ctx.tot(ctx.S.imprese);
assert.deepStrictEqual([t.nr_imp, t.nr_ind, t.nr_lavoratori], [3, 1, 13], 'righe lette dal database senza i loro non censiti: non si prendono quelli della maschera');
t = ctx.tot(ctx.S.imprese, { imp: 4, lav: 10, aut: 2 });
assert.strictEqual(t.nr_lavoratori, 23, 'righe dal database coi loro non censiti');
Object.assign(campi, { 'f-nc-imp': '-3', 'f-nc-lav': 'abc', 'f-nc-aut': '2.7' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.nc())), { imp: 0, lav: 0, aut: 2 }, 'negativi e testo valgono 0, i decimali si troncano');
ctx.S.imprese = [{ impresa_id: 'A', tipo_imp: '1', nr_lav: 0 }];
Object.assign(campi, { 'f-nc-imp': '2', 'f-nc-lav': '6', 'f-nc-aut': '' });
assert.strictEqual(ctx.zero(ctx.tot()), false, 'lavoratori solo fra i non censiti: non è «nessun lavoratore in cantiere»');

/* ── la maschera ── */
assert.ok(html.includes('id="f-nc-imp"') && html.includes('id="f-nc-lav"') && html.includes('id="f-nc-aut"'), 'i tre campi nel passo Imprese');
assert.ok(/nr_imp_non_censite:altreNonCensite\(\)\.imp,nr_lav_non_censite:altreNonCensite\(\)\.lav,nr_ind_non_censite:altreNonCensite\(\)\.aut,/.test(html), 'si salvano sulla visita');
assert.ok(/select\('visita_id,stato,elimina,nr_imp_non_censite,nr_lav_non_censite,nr_ind_non_censite'\)/.test(html)
  && /computeImpTotals\(_impDb\|\|\[\],\{imp:byId\.nr_imp_non_censite,lav:byId\.nr_lav_non_censite,aut:byId\.nr_ind_non_censite\}\)/.test(html),
  'un definitivo risalvato riscrive i totali solo se righe o non censiti sono cambiati davvero');
assert.ok(/nc_imp:altreNonCensite\(\)\.imp,nc_lav:altreNonCensite\(\)\.lav,nc_aut:altreNonCensite\(\)\.aut,/.test(html), 'nella copia della maschera');
assert.ok(/vSet\('f-nc-imp',_ncNum\(snap\.nc_imp\)\|\|''\)/.test(html), 'riaprendo, i campi tornano (vuoti se zero)');
assert.ok(/nc_imp:v\.nr_imp_non_censite\|\|0,nc_lav:v\.nr_lav_non_censite\|\|0,nc_aut:v\.nr_ind_non_censite\|\|0,/.test(html), 'dal database (visita di ritorno, riapertura)');
assert.ok(/window\.altreNonCensite=altreNonCensite/.test(html) && /window\.altreNonCensite\(\)/.test(veste), 'il riepilogo del passo nella veste li conta');

/* ── riaprire: vuoto e 0 sono la stessa cosa; il database vince ── */
const a = dati.indexOf('function snapAllineaAlDb(copia,db){'), b = dati.indexOf('// --- fine snapAllineaAlDb');
const c2 = vm.createContext({});
vm.runInContext(dati.slice(a, b) + '\nthis.f=snapAllineaAlDb', c2);
let r = c2.f({ visita_id: 'V' }, { visita_id: 'V', nc_imp: 0, nc_lav: 0, nc_aut: 0 });
assert.deepStrictEqual(Array.from(r.diversi), [], 'una bozza salvata prima del 06/10 (senza i campi) non segnala differenze');
r = c2.f({ visita_id: 'V', nc_imp: 2, nc_lav: 5, nc_aut: 0 }, { visita_id: 'V', nc_imp: 3, nc_lav: 5, nc_aut: 0 });
assert.strictEqual(r.snap.nc_imp, 3, 'vale il database');

/* ── il PDF ── */
assert.ok(/const ncImp = \+v\.nr_imp_non_censite \|\| 0, ncLav = \+v\.nr_lav_non_censite \|\| 0, ncAut = \+v\.nr_ind_non_censite \|\| 0/.test(pdf));
assert.ok(/imps\.filter\(\(im\) => im\.impresa_id\)\.length \+ ncImp \+ ncAut/.test(pdf) && /\+ ncLav\) \|\| v\.nr_lavoratori/.test(pdf), 'i totali del PDF comprendono i non censiti');
assert.ok(/cantiere\.push\(\['Non censiti'/.test(pdf), 'e una riga dice quanti sono');

/* ── il database ── */
for (const c of ['nr_imp_non_censite', 'nr_lav_non_censite', 'nr_ind_non_censite'])
  assert.ok(new RegExp('add column if not exists ' + c + ' smallint not null default 0').test(sql), c);
assert.ok(/check \(nr_imp_non_censite between 0 and 9999/.test(sql), 'niente numeri negativi');

console.log('ok — imprese, lavoratori e autonomi non censiti entrano nei totali del cantiere');
