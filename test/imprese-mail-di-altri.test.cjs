// node test/imprese-mail-di-altri.test.cjs
// (03/10/2026, sera) Pagina Segreteria: elenco delle imprese che hanno in scheda l'indirizzo e-mail di
// un'altra impresa. Nasce dal verbale CPT/26_27/0003. L'elenco e le decisioni stanno nel database
// (imprese_mail_di_altri, impresa_mail_decidi); la pagina mostra e chiede, non corregge da sola.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const veste = fs.readFileSync(path.join(dir, 'veste-v2.js'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_03_imprese_mail_di_altri.sql'), 'utf8');

// la funzione pura: riconoscere una PEC (alla PEC la posta ordinaria spesso non arriva)
const m = html.match(/function mailSembraPec\(m\)\{[\s\S]*?\r?\n\}/);
assert.ok(m, 'non trovo mailSembraPec');
const ctx = vm.createContext({});
vm.runInContext(m[0] + '\nthis.f=mailSembraPec', ctx);
for (const si of ['ceg.srl@arubapec.it', 'x@pec.it', 'x@gigapec.it', 'x@pec.libero.it', 'x@cgn.legalmail.it', 'f.sachs@consulentidellavoropec.it', 'x@mypec.eu', 'x@pecimprese.it', 'x@pec.cna.it', 'x@cert.cna.it', 'X@POSTECERT.IT'])
  assert.strictEqual(ctx.f(si), true, si + ' è una PEC');
for (const no of ['info@rusalen.it', 'x@gmail.com', 'x@libero.it', 'info@specialisti.it', 'info@pecorarocostruzioni.it', 'x@certosa.it', '', null, 'senza-chiocciola'])
  assert.strictEqual(ctx.f(no), false, String(no) + ' non è una PEC');

// la pagina
const carica = html.match(/async function admImpMailAltri\(\)\{[\s\S]*?\r?\n\}/);
assert.ok(carica && /sb\.rpc\('imprese_mail_di_altri'\)/.test(carica[0]) && /if\(error\)\{[\s\S]{0,220}Non sono riuscito a leggere/.test(carica[0]), 'una lettura fallita si dice, non diventa «nessuna impresa»');
const decidi = html.match(/async function admImpMailDecidi\(i,cosa\)\{[\s\S]*?\r?\n\}/);
assert.ok(decidi, 'non trovo admImpMailDecidi');
assert.ok(/if\(chiedi&&!confirm\(chiedi\)\)return/.test(decidi[0]) && /if\(cosa==='togli'\)chiedi=/.test(decidi[0]) && /if\(cosa==='cassa'\)chiedi=/.test(decidi[0]), 'togliere e sostituire chiedono conferma');
assert.ok(/sb\.rpc\('impresa_mail_decidi',\{p_impresa_id:r\.impresa_id,p_mail:r\.mail,p_decisione:cosa\}\)/.test(decidi[0]), 'la decisione la scrive il database');
assert.ok(/if\(error\|\|!data\|\|!data\.ok\)\{toast\('Non fatto: /.test(decidi[0]), 'se il database rifiuta lo si dice e la riga resta');
assert.ok(!/sb\.from\('imprese'\)\.update/.test(decidi[0]), 'la pagina non scrive direttamente la scheda dell’impresa');
assert.ok(decidi[0].indexOf('_impMail.splice(i,1)') > decidi[0].indexOf('if(error||!data||!data.ok)'), 'la riga sparisce solo dopo che il database ha detto sì');
assert.ok(html.includes('onclick="admImpMailAltri()"') && html.includes('id="tbody-imp-mail"') && html.includes('window.admImpMailDecidi=admImpMailDecidi'));
assert.ok(/mailSembraPec\(r\.mail_cassa\)\?'\\n\\n⚠ Ha l\\'aria di una PEC/.test(decidi[0]), 'prima di mettere una PEC al posto di un indirizzo ordinario lo si dice');
// nella veste la sezione sta in «Qualità dati» e la Scrivania la conta (solo le righe da guardare)
assert.ok(/k: 'qualita'[^\n]*Imprese con l\\'indirizzo di un\\'altra impresa/.test(veste), 'la sezione deve stare nel gruppo «Qualità dati», non finire in «Altro»');
assert.ok(veste.includes("((await rpc('imprese_mail_di_altri')) || []).filter((r) => !r.stessa_della_cassa).length"), 'la Scrivania conta solo le imprese da guardare');

// il database: riservato alla segreteria, decisioni scritte, niente correzioni automatiche
const pulito = sql.replace(/--[^\n]*/g, '');
assert.strictEqual((pulito.match(/if not public\.is_segreteria\(\) then\s+raise exception 'Riservato alla segreteria\.'/g) || []).length, 2, 'elenco e decisione sono della sola segreteria');
assert.ok(/revoke all on function public\.imprese_mail_di_altri\(\) from public, anon;/.test(pulito) && /revoke all on function public\.impresa_mail_decidi\(text, text, text\) from public, anon;/.test(pulito) && /revoke all on function public\._ceiv_mail\(text, text\) from public, anon, authenticated;/.test(pulito));
assert.ok(/alter table public\.imprese_mail_decisioni enable row level security;/.test(pulito) && /for select to authenticated using \(\(select public\.is_segreteria\(\)\)\)/.test(pulito), 'le decisioni le legge solo la segreteria');
assert.ok(!/grant (insert|update|delete|all)[^;]*imprese_mail_decisioni/i.test(pulito), 'le decisioni si scrivono solo dalla funzione');
assert.ok(/having count\(distinct mm\.sogg\) > 1/.test(pulito) && /where g\.n_som between 1 and g\.n - 1\s+and not x\.somiglia/.test(pulito), 'sospetta = indirizzo condiviso fra ditte diverse, che somiglia a una e non a questa');
assert.strictEqual((pulito.match(/insert into public\.imprese_mail_decisioni/g) || []).length, 2, 'ogni decisione resta scritta (conferma; tolto o sostituito)');
assert.ok(/d\.decisione = 'confermato'/.test(pulito), 'una riga confermata non torna nell’elenco');

console.log('imprese-mail-di-altri: ok');
