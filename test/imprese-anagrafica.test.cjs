// node test/imprese-anagrafica.test.cjs
// (06/10/2026) Ufficio › Anagrafiche: elenco ordinabile delle imprese, possibili doppioni, unione con la scelta dei
// valori, eliminazione delle schede inutilizzate, avviso sulle P.IVA che non possono esistere. Le scritture le fa
// il database (supabase/sql/2026_10_06_imprese_anagrafica.sql), riservato alla segreteria.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(dir, 'imprese-anagrafica.js'), 'utf8');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const veste = fs.readFileSync(path.join(dir, 'veste-v2.js'), 'utf8');
const deploy = fs.readFileSync(path.join(dir, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_06_imprese_anagrafica.sql'), 'utf8');

// il file gira senza pagina: le funzioni pure si provano qui
const nulla = () => null;
const ctx = vm.createContext({ document: { readyState: 'complete', getElementById: nulla, querySelector: nulla, querySelectorAll: () => [], addEventListener() {} } });
ctx.window = ctx;
vm.runInContext(js, ctx);
const IA = ctx.window.ImpreseAnag;
assert.ok(IA, 'imprese-anagrafica.js deve esporre window.ImpreseAnag');

/* la P.IVA: cifra di controllo e ufficio delle Entrate (cifre 8-10: 001-121, 888, 999) */
assert.strictEqual(IA.pivaValida('02524300239'), true, 'Edil Tognetto, quella giusta');
assert.strictEqual(IA.pivaValida('IT 02524300239'), true, 'con IT davanti e spazi');
assert.strictEqual(IA.pivaValida('50005111716'), false, 'la cifra di controllo torna ma l’ufficio 171 non esiste');
assert.strictEqual(IA.pivaValida('02524000239'), false, 'una cifra sbagliata');
assert.strictEqual(IA.pivaValida('00000000000'), false);
assert.strictEqual(IA.pivaValida('1234'), null, 'non 11 cifre: non si giudica');
assert.strictEqual(IA.pivaValida('RSSMRA80A01G224K'), null, 'un codice fiscale non è una P.IVA da giudicare');
assert.ok(/11/.test(IA.avvisoPiva('417330289')), 'a una P.IVA a 9-10 cifre si dice che ne mancano');
assert.ok(/non può esistere/.test(IA.avvisoPiva('50005111716')));
assert.strictEqual(IA.avvisoPiva('02524300239'), '');
assert.strictEqual(IA.avvisoPiva(''), '');

/* la scheda da tenere: prima la P.IVA valida, poi i collegamenti */
const sbagliata = { impresa_id: '02524000239', piva: '50005111716', verbali: 9, persone: 3, altro: 4 };
const giusta = { impresa_id: '02524300239', piva: '02524300239', verbali: 1, persone: 0, altro: 0, cod_ceiv: '' };
assert.strictEqual(IA.principaleProposta([sbagliata, giusta]).impresa_id, '02524300239', 'vince la P.IVA valida, anche con meno collegamenti');
assert.strictEqual(IA.principaleProposta([{ impresa_id: 'a', verbali: 1 }, { impresa_id: 'b', verbali: 5 }]).impresa_id, 'b', 'a parità, più collegamenti');

/* i valori da scegliere: solo dove le schede sono diverse; la P.IVA valida anche se la principale non l'ha */
const a = { impresa_id: 'A', impresa_nome: 'Edil Tognetto srl', piva: '50005111716', comune: 'Castagnaro VR', indirizzo: '', cap: '' };
const b = { impresa_id: 'B', impresa_nome: 'Edil Tognetto srl', piva: '02524300239', comune: 'Castagnaro', indirizzo: 'Via Polesine 189/2', cap: '' };
const div = IA.campiDiversi([a, b]);
assert.deepStrictEqual(Object.keys(div).sort(), ['comune', 'piva'], 'nome uguale e campi vuoti non si chiedono');
const sc = IA.sceltePredefinite([a, b], 'A');
assert.strictEqual(sc.piva, '02524300239', 'la P.IVA proposta è quella valida');
assert.strictEqual(sc.comune, 'Castagnaro VR', 'gli altri campi: quello della principale');

/* si elimina solo ciò che non ha niente collegato e non è nella lista della Cassa */
assert.strictEqual(IA.eliminabile({ verbali: 0, persone: 0, altro: 0 }), true);
assert.strictEqual(IA.eliminabile({ verbali: 1, persone: 0, altro: 0 }), false);
assert.strictEqual(IA.eliminabile({ verbali: 0, persone: 0, altro: 2 }), false);
assert.strictEqual(IA.eliminabile({ verbali: 0, persone: 0, altro: 0, cod_ceiv: '20000652' }), false);

/* la pagina: tutto passa dal database, e una lettura fallita si dice */
for (const f of ['imprese_elenco', 'imprese_doppioni', 'imprese_unisci', 'impresa_elimina', 'imprese_doppioni_diverse'])
  assert.ok(js.includes("rpc('" + f + "'"), 'la pagina deve usare ' + f);
assert.ok(!/from\('imprese'\)\.(update|delete|insert)/.test(js), 'la pagina non scrive la tabella imprese da sola');
assert.ok(/Non sono riuscito a leggere l'elenco delle imprese/.test(js) && /Non sono riuscito a cercare i doppioni/.test(js), 'una lettura fallita non diventa «nessuna impresa»');
assert.ok(/Unione non fatta: [\s\S]{0,80}Non è cambiato niente/.test(js), 'un’unione rifiutata lo dice');
assert.ok(/prompt\('Elimini la scheda/.test(js) && /motivo\.trim\(\)\.length < 3/.test(js), 'l’eliminazione chiede il perché');
assert.ok(!/prompt\('UNIONE IMPRESE/.test(html) && !html.includes('admFondiImprese'), 'la vecchia unione a numeri è tolta');
assert.ok(/CAMPI_PIVA = \['mi-piva', 'ei-piva2', 'f-comm-piva', 'mc-comm-piva', 'ec-piva'\]/.test(js), 'l’avviso sulla P.IVA sta sui campi dove la si scrive');
// innerHTML: ogni dato passa da esc (nomi, codici, indirizzi arrivano dall'anagrafica)
assert.ok(!/\$\{m\.impresa_nome\}|\$\{r\.impresa_nome\}|\$\{m\.indirizzo\}|\$\{r\.indirizzo\}/.test(js), 'i dati dell’anagrafica si scrivono sempre con esc()');

/* aggancio: riquadri, script, veste, pubblicazione */
assert.ok(html.includes('id="ia-sezione"') && html.includes('id="dp-sezione"'));
assert.ok(/<script src="imprese-anagrafica\.js\?v=\d+"><\/script>/.test(html));
assert.ok(/async function admLoadImprese\(\) \{\s+if \(window\.ImpreseAnag && window\.__isSegreteria\) return window\.ImpreseAnag\.carica\(\)/.test(html), 'dopo «Modifica impresa» l’elenco si ricarica (solo per la segreteria: le funzioni sono sue)');
assert.ok(/k: 'anagrafiche'[^\n]*'Imprese doppie'/.test(veste), 'il riquadro dei doppioni sta in «Anagrafiche», non in «Altro»');
assert.ok(deploy.includes("- 'imprese-anagrafica.js'") && /for f in [^\n]*imprese-anagrafica\.js/.test(deploy), 'il file va pubblicato (altrimenti 404 sul sito)');

/* il database */
for (const f of ['imprese_collegamenti', 'imprese_elenco', 'imprese_doppioni', 'imprese_doppioni_diverse', 'imprese_unisci', 'impresa_elimina']) {
  const corpo = sql.slice(sql.indexOf('create or replace function public.' + f + '('));
  assert.ok(/if not public\.s_unioni_autorizzato\(\) then\s+raise exception 'Operazione consentita solo alla segreteria'/.test(corpo.slice(0, 2500)), f + ': solo segreteria');
  assert.ok(sql.includes('revoke execute on function public.' + f + '('), f + ': niente anon');
}
const el = sql.slice(sql.indexOf('create or replace function public.impresa_elimina('));
assert.ok(el.indexOf('insert into archivio.imprese_eliminate') < el.indexOf('delete from public.imprese where'), 'la copia in archivio prima della cancellazione');
assert.ok(/È nella lista della Cassa Edile/.test(el) && /Non si elimina: ha collegati/.test(el), 'con collegamenti o nella lista C.E.I.V. non si elimina');
const un = sql.slice(sql.indexOf('create or replace function public.imprese_unisci('));
assert.ok(un.indexOf('non è di nessuna delle schede') < un.indexOf('public.fondi_imprese(p_master, p_dupes)'), 'i valori scelti si controllano prima di unire');
assert.ok(/prima dell''unione/.test(un), 'il valore sostituito resta nelle note');
assert.ok(/revoke all on archivio\.imprese_eliminate from public, anon, authenticated/.test(sql));
assert.ok(/substr\(regexp_replace\(upper\(btrim\(p\)\), '\^IT', ''\), 8, 3\)::int not between 1 and 121/.test(sql), 'nel database lo stesso controllo dell’ufficio');

console.log('ok — imprese: elenco, doppioni, unione con scelta, eliminazione protetta, avviso P.IVA');
