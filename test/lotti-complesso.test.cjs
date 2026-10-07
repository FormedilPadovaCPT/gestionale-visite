// node test/lotti-complesso.test.cjs
// (07/10/2026, deciso dall'utente: «apro il CNCE principale e vedo tutti i cantieri suddivisi per lotto»; «il conteggio
// che va sul verbale è quello del singolo lotto»; nei report alla Cassa «tutte le visite sotto il CNCE unico ma distinte
// per lotti».) Il complesso si vede nell'elenco e nella scheda, l'unione riconosce i lotti scritti nell'indirizzo, la
// segreteria divide le visite fra i lotti, l'estrazione CEIV porta il lotto.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'lotti-cantiere.js'), 'utf8');
const aiuto = fs.readFileSync(path.join(dir, 'aiuto.js'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_07_lotti_complesso.sql'), 'utf8');

/* ── la finestra «Ha più lotti»: pallino e testo della loro misura, non più 100% e maiuscolo ── */
assert.ok(/const S_RADIO = 'width:auto;min-width:0;flex:0 0 auto;margin:0'/.test(js), 'il pallino non prende tutta la riga');
assert.ok(/const S_SCELTA = '[^']*text-transform:none[^']*'/.test(js), 'il testo della scelta non è maiuscolo');
assert.ok(/<input type="radio" name="lotti-dove" value="qui" checked style="\$\{S_RADIO\}"><span>In questo lotto<\/span>/.test(js), 'prima scelta');
assert.ok(/<input type="radio" name="lotti-dove" value="nuovo" style="\$\{S_RADIO\}"><span>In un altro lotto, che si chiama<\/span>/.test(js), 'seconda scelta');
assert.ok(/id="lotti-nuovo" value="\$\{esc\(nuovoNome\)\}" maxlength="30" style="\$\{S_NOME\}"/.test(js), 'il nome del lotto ha la sua larghezza');

/* ── le funzioni pure ── */
const ctx = { document: { getElementById: () => null } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const L = ctx.LottiCantiere;
assert.strictEqual(L.base('Via XXVIII Aprile snc – lotto 2'), 'Via XXVIII Aprile snc', 'il nome del complesso senza il lotto');
assert.strictEqual(L.base('Via Boccaccio PADOVA - lotto 2 (Furlan)'), 'Via Boccaccio PADOVA');
assert.strictEqual(L.base('Via Rosmini 4'), 'Via Rosmini 4', 'senza lotto non cambia');
assert.strictEqual(L.rilevaLotto('via Alcide de Gasperi - Lotto 14'), '14');
assert.strictEqual(L.rilevaLotto('via Alcide De Gasperi (lotto 4)'), '4');
assert.strictEqual(L.rilevaLotto('Via Morricone Lotto 2-3'), '2-3');
assert.strictEqual(L.rilevaLotto('via Marzolla - Lotto B4'), 'B4');
assert.strictEqual(L.rilevaLotto('VIA MARCONI LOTTO 1 -2'), '1-2');
assert.strictEqual(L.rilevaLotto('Palazzina B via Roma'), 'Palazzina B');
assert.strictEqual(L.rilevaLotto('Via Rosmini 4'), null, 'senza lotto non inventa niente');
assert.ok(typeof L.dividi === 'function', 'la divisione delle visite c’è');
assert.ok(/window\.__isSegreteria/.test(js) && /sb\.rpc\('visite_complesso', \{ p_cantiere_id: cid \}\)/.test(js) && /chiama\('sposta_visite_in_lotti'/.test(js), 'dividi: solo segreteria, legge le visite del complesso, sposta col database');
assert.ok(/Non sono riuscito a leggere lotti e visite/.test(js), 'dividi dice se non riesce a leggere');
assert.ok(!/\$\{(?![^}]*esc\()[^}]*\b(?:l|io|v)\.(?:etichetta|lotto|ultima_impresa|indirizzo|nr_verbale|tecnico|impresa|indirizzo_originale)/.test(js), 'i dati dal database si scrivono in sicurezza');

/* ── l'elenco cantieri: una riga per il complesso, i lotti sotto ── */
assert.ok(/cantiere_cap,cantiere_comune_cod,lotto,lotto_di'/.test(html), 'l’elenco legge lotto e radice');
assert.ok(/const _chiave=c=>c\._segn\?null:\(\(String\(c\.lotto\|\|''\)\.trim\(\)&&\/\^cnce\/i\.test\(c\.cantiere_cnce\|\|''\)\)\?'cnce:'/.test(html), 'fratelli: stessa radice, oppure stesso CNCE col lotto');
assert.ok(/class="row-detail-hover cl-complesso" data-cl-grp=/.test(html) && /complesso, \$\{righe\.length\} lotti/.test(html), 'la riga del complesso');
assert.ok(/visita su un lotto ↓/.test(html) && !/cl-complesso[\s\S]{0,1500}data-cant-id=/.test(html.slice(html.indexOf('const _rigaComplesso'), html.indexOf('const _rigaCant'))), 'il + Visita non sta sul complesso');
assert.ok(/data-cl-of="\$\{esc\(inLotto\.k\)\}" style="background:#fafafa\$\{inLotto\.aperto\?'':';display:none'\}"/.test(html), 'i lotti stanno sotto, chiusi finché non si apre');
assert.ok(/const _apertiTutti=!!window\._cantRicerca/.test(html), 'con una ricerca i complessi sono aperti');
assert.ok(/tbody\.querySelectorAll\('tr\.cl-complesso'\)\.forEach\(tr=>\{[\s\S]*?tr\.onclick=/.test(html), 'la riga del complesso si apre e si chiude');

/* ── la scheda 👁: sezione Lotti e visite per lotto ── */
assert.ok(/lat,lng,geocode_status,lotto,lotto_di'\s*\)\.eq\('cantiere_id',cantId\)\.single\(\)/.test(html), 'la scheda legge il lotto');
assert.ok(/sb\.rpc\('lotti_del_cantiere',\{p_cantiere_id:cantId\}\)/.test(html) && /Non sono riuscito a leggere i lotti del complesso/.test(html), 'legge i lotti e dice se non riesce');
assert.ok(/qdSec\('Lotti del complesso \('\+ls\.length\+'\) · '\+tot\+' visite in tutto'\)/.test(html), 'sezione Lotti col totale del complesso');
assert.ok(/sb\.rpc\('visite_complesso',\{p_cantiere_id:cantId\}\)/.test(html) && /° sul lotto'/.test(html) && /° sul complesso'/.test(html), 'visite per lotto con i due numeri');
assert.ok(/id="qd-dividi-lotti"/.test(html) && /window\.__isSegreteria&&visite&&visite\.length/.test(html), 'Dividi solo per la segreteria e solo con visite');

/* ── il riepilogo del verbale: lotto e complesso ── */
assert.ok(/async function rpAccessoComplesso\(accCant\)/.test(html) && /sb\.rpc\('lotti_acc_complesso',\{p_cantiere_id:cid\}\)/.test(html), 'il complesso nel riepilogo');
assert.ok(/ª visita su questo lotto'/.test(html) && /ª sul complesso, '\+lotti\.length\+' lotti/.test(html), 'lotto e complesso scritti insieme');
assert.ok(/rpAccessoComplesso\(accCant\)\.catch/.test(html), 'parte dal riepilogo senza fermarlo');

/* ── l'unione riconosce i lotti ── */
assert.ok(/data-fsel-lotto="/.test(html) && /<option value="__lotto"/.test(html), 'per ogni scheda: unisci, oppure è il lotto…');
assert.ok(/sb\.rpc\('adotta_lotto_cantiere',\{p_master_id:keeper,p_cantiere_id:l\.id,p_lotto:l\.nome,p_lotto_master:masterNome\}\)/.test(html), 'i lotti riconosciuti passano da adotta_lotto_cantiere');
assert.ok(/if\(losers\.length\)\{[\s\S]{0,400}sb\.rpc\('fondi_cantieri'/.test(html), 'la fusione parte solo se resta qualcosa da fondere');
assert.ok(!/alert\('Questi cantieri sono LOTTI DIVERSI/.test(html), 'il blocco secco dei lotti diversi non ferma più la finestra');
assert.ok(/if\(String\(c\?\.lotto\|\|''\)\.trim\(\)&&String\(c\.lotto\)\.trim\(\)\.toLowerCase\(\)!==String\(_kr\?\.lotto\|\|''\)\.trim\(\)\.toLowerCase\(\)\)continue/.test(html), 'le schede che hanno già un altro lotto restano com’erano');
assert.ok(/nell\\'indirizzo c\\'è scritto «lotto '\+esc\(_pl\)\+'»: forse è un lotto a sé/.test(html), 'il controllo duplicati CNCE avvisa quando legge un lotto nell’indirizzo');

/* ── l'estrazione CEIV: tutte le visite sotto il CNCE, distinte per lotto ── */
assert.ok(/cantieri!inner\(cantiere_cnce,cantiere_indirizzo,cantiere_civico,comune_nome,lotto\)/.test(html), 'l’estrazione legge il lotto');
assert.ok(/lotto: String\(c\.lotto \|\| ''\)\.trim\(\)/.test(html), 'normalizeRows porta il lotto');
assert.ok(/const indirizzoConLotto = \(r\) => \(r\.indirizzo \|\| ''\) \+ \(r\.lotto \? ' – lotto ' \+ r\.lotto : ''\)/.test(html) && /r\.cnce, _fmtDate\(r\.data\), r\.tecnico, r\.acc, indirizzoConLotto\(r\), r\.comune,/.test(html), 'Excel: il lotto accanto all’indirizzo, tracciato invariato');
assert.ok(/\(a\.cnce \|\| ''\)\.localeCompare\(b\.cnce \|\| ''\) \|\| _ordLotto\(a\.lotto\)\.localeCompare\(_ordLotto\(b\.lotto\)\) \|\| \(b\.data \|\| ''\)\.localeCompare\(a\.data \|\| ''\)/.test(html), 'ordine CNCE, lotto, data');
assert.ok(/doc\.text\(r\.lotto \? 'Lotto ' \+ r\.lotto : 'Senza lotto', M \+ 2\.5, y \+ 4\)/.test(html) && /accesso n° contato sul lotto/.test(html), 'PDF: la fascia del lotto dentro il cantiere');
assert.ok(/const api = \{[^}]*indirizzoConLotto \}/.test(html), 'la regola dell’indirizzo col lotto è esposta');
/* il core CEIV gira anche fuori dal browser: lo si esegue davvero */
{
  const h2 = html.replace(/\r/g, '');
  const ini = h2.indexOf('(function (root) {\n  const CEIV_IPC_LBL'), fine = h2.indexOf('})(typeof window !== ');
  assert.ok(ini > 0 && fine > ini, 'il core CEIV si isola');
  const core = h2.slice(ini, fine + '})(typeof window !== \'undefined\' ? window : globalThis);'.length);
  const c2 = { module: { exports: {} } }; c2.window = undefined; vm.createContext(c2); vm.runInContext(core, c2);
  const C = c2.module.exports;
  const rows = C.normalizeRows([
    { visita_id: 'a', data_visita: '2026-10-01', cantieri: { cantiere_cnce: 'CNCEX', cantiere_indirizzo: 'Via Roma', cantiere_civico: '1', comune_nome: 'Padova', lotto: '2' }, imprese: { impresa_nome: 'A' } },
    { visita_id: 'b', data_visita: '2026-10-03', cantieri: { cantiere_cnce: 'CNCEX', cantiere_indirizzo: 'Via Roma', cantiere_civico: '1', comune_nome: 'Padova', lotto: '1' }, imprese: { impresa_nome: 'B' } },
    { visita_id: 'c', data_visita: '2026-09-01', cantieri: { cantiere_cnce: 'CNCEX', cantiere_indirizzo: 'Via Roma', cantiere_civico: '1', comune_nome: 'Padova', lotto: '1' }, imprese: { impresa_nome: 'C' } },
  ], {});
  const aoa = C.buildExcelAoa(rows);
  assert.strictEqual(aoa.length, 4);
  const conLotto = (n) => C.indirizzoConLotto({ indirizzo: 'Via Roma 1', lotto: n });
  assert.ok(/ lotto 1$/.test(conLotto('1')) && conLotto('1').length > 'Via Roma 1'.length + 7, 'l’indirizzo porta il lotto in coda');
  /* Array.from: gli array nati dentro il vm hanno un altro prototipo e deepStrictEqual li rifiuterebbe */
  assert.deepStrictEqual(Array.from(aoa.slice(1), (r) => r[4]), [conLotto('1'), conLotto('1'), conLotto('2')], 'stesso CNCE, prima il lotto 1 poi il 2, dentro il lotto per data');
  assert.strictEqual(aoa[1][1], '03/10/2026', 'dentro il lotto la più recente prima');
  assert.strictEqual(aoa[0].length, aoa[1].length, 'il tracciato non ha colonne in più');
}

/* ── il database ── */
assert.ok(/create or replace function public\.adotta_lotto_cantiere\(p_master_id text, p_cantiere_id text, p_lotto text, p_lotto_master text default '1'\)/.test(sql));
assert.ok(/if not public\.s_unioni_autorizzato\(\) then raise exception 'Operazione consentita solo alla segreteria'/.test(sql), 'adottare e dividere spetta alla segreteria');
assert.ok(/codici CNCE diversi/.test(sql), 'CNCE diversi non diventano lotti');
assert.ok(/regexp_replace\(coalesce\(c\.cantiere_indirizzo, ''\), '\\s\*\[-–—\(\]\*\\s\*lott\[oi\]\\M\.\*\$', '', 'i'\)/.test(sql), 'il lotto esce dall’indirizzo');
assert.ok(/create or replace function public\.lotti_acc_complesso\(p_cantiere_id text\)/.test(sql) && /row_number\(\) over \(partition by v\.cantiere_id order by v\.data_visita, v\.visita_id\)/.test(sql) && /row_number\(\) over \(order by v\.data_visita, v\.visita_id\)/.test(sql), 'accesso sul lotto e sul complesso');
assert.ok(/create or replace function public\.visite_complesso\(p_cantiere_id text\)/.test(sql) && /t\.nome ~\* 'indirizzo\.\*cantiere'/.test(sql), 'le visite del complesso con l’indirizzo del modulo originale');
{
  const i0 = sql.indexOf('create or replace function public.visite_complesso');
  const testa = sql.slice(i0, sql.indexOf('as $$', i0));
  assert.ok(i0 > 0 && !/security definer/.test(testa), 'visite_complesso passa dalle policy di chi legge');
}
assert.ok(/create or replace function public\.sposta_visite_in_lotti\(p_cantiere_id text, p_lotto_qui text, p_assegnazioni jsonb\)/.test(sql));
assert.ok(/coalesce\(v\.stato, ''\) <> 'definitivo' and v\.acc_cant is distinct from n\.acc::text/.test(sql), 'i definitivi tengono il numero stampato, le bozze lo riprendono dal lotto');
assert.ok(/raise exception 'La visita % non è su questa scheda'/.test(sql), 'una visita di un’altra scheda si rifiuta');
assert.ok(/'visita spostata sul lotto ' \|\| a\.lotto \|\| ' dalla divisione in lotti'/.test(sql), 'ogni spostamento resta scritto');

/* ── aiuto e versioni ── */
assert.ok(/'t:dividi le visite in lotti':/.test(aiuto) && /'t:unisci e riconosci i lotti':/.test(aiuto) && /'t:sposta le visite':/.test(aiuto), 'le nuvolette dei pulsanti nuovi');
assert.ok(/<script src="lotti-cantiere\.js\?v=2"><\/script>/.test(html) && /<script src="aiuto\.js\?v=23"><\/script>/.test(html), 'versioni alzate');

console.log('ok — il complesso a lotti: elenco, scheda, unione, divisione, CEIV');
