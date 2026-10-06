// node test/maschera-visita-snella.test.cjs
// (06/10/2026, piano dell'utente) La maschera della visita perde i campi che il tecnico guarda e non tocca: codice
// univoco (resta nel database, nella ricerca e come storico nella scheda del cantiere; al suo posto l'ETICHETTA, che è
// quello che Formedil chiede), accesso n° (si calcola da solo e si legge nel riepilogo), data di ultimazione (sta nella
// scheda del cantiere), P.IVA e CF dell'impresa (in una riga nell'intestazione). «Nuova impresa» riconosce la P.IVA già
// in anagrafica; nel nuovo cantiere il CAP compare solo se il comune non lo dà. «Proponi» propone l'etichetta, senza le
// iniziali del tecnico.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const pdf = fs.readFileSync(path.join(dir, 'verbale-pdf.js'), 'utf8');
const cu = fs.readFileSync(path.join(dir, 'codice-univoco.js'), 'utf8');
const aiuto = fs.readFileSync(path.join(dir, 'aiuto.js'), 'utf8');

/* ── maschera visita ── */
assert.ok(/<input type="hidden" id="f-cod-uni">/.test(html), 'il codice univoco non si vede più nel verbale (ma il campo resta per il codice)');
assert.ok(!/id="btn-cod-uni-proponi"/.test(html), 'via il «Proponi» del codice univoco');
assert.ok(/<input type="text" id="f-etich" placeholder="–" readonly/.test(html) && /id="btn-etich-proponi"/.test(html), 'al suo posto l’etichetta, con «Proponi»');
assert.strictEqual((html.match(/vSet\('f-etich',[\w.]+\.cantiere_etichetta\|\|''\)/g) || []).length, 7, 'ovunque si copia il cantiere nel verbale si copia anche l’etichetta');
assert.ok(/<div class="field hidden" style="flex:0 0 150px">\n\s*<label>Accesso n°/.test(html), 'accesso n°: nascosto, si calcola da solo');
assert.ok(/<input type="hidden" id="f-acc-cant2">/.test(html) && !/Accesso cantiere n° \(dal DB cantiere\)/.test(html), 'il campo «dal DB cantiere» era morto');
assert.ok(/<div class="field hidden" style="flex:0 1 380px"><label style="white-space:nowrap">Data ultimazione lavori/.test(html), 'data ultimazione: sta nella scheda del cantiere');
assert.ok(/\['Accesso n° \(calcolato\)',accCant\+/.test(html), 'l’accesso n° si legge nel riepilogo');

/* ── scheda impresa nel verbale ── */
assert.ok(!/id="im-piva-\$\{idx\}"/.test(html) && !/id="im-cf_imp-\$\{idx\}"/.test(html), 'P.IVA e CF non sono più due campi');
const testata = html.match(/<span class="imp-name">[^\n]*<\/span>/);
assert.ok(testata && /class="imp-ids"/.test(testata[0]) && /P\.IVA '\+esc\(im\.piva\)/.test(testata[0]) && /'CF '\+esc\(im\.cf_imp\)/.test(testata[0]), 'ma una riga nell’intestazione, scritta in sicurezza');

/* ── «Nuova impresa» ── */
assert.ok(/<div id="mi-esiste" class="hidden"/.test(html) && /id="mi-ceiv-wrap"/.test(html) && /id="mi-ceiv-avviso"/.test(html));
const ctrl = html.match(/async function miControllaEsistente\(\)\{[\s\S]*?\n\}\n/);
assert.ok(ctrl, 'non trovo miControllaEsistente');
assert.ok(/from\('imprese'\)\.select\('[^']*cod_ceiv[^']*'\)\.eq\('elimina',0\)\.or\(filtri\.join\(','\)\)/.test(ctrl[0]), 'cerca in anagrafica per P.IVA e CF');
assert.ok(/piva\.length===11/.test(ctrl[0]) && /cf\.length>=11/.test(ctrl[0]), 'solo con un codice completo');
assert.ok(/if\(error\)\{box\.classList\.remove\('hidden'\);box\.innerHTML='⚠ Non sono riuscito a controllare/.test(ctrl[0]), 'un errore di lettura si dice, non vale «nessuna»');
assert.ok(/wrap\.classList\.add\('hidden'\)/.test(ctrl[0]) && /_useImpresaEsistente\(x,_modalImpIdx\)/.test(ctrl[0]), 'trovata: la cassa non si chiede e «Usa questa» la mette nel verbale');
assert.ok(/\['mi-piva','mi-cf'\]\.forEach\(id=>\{const el=\$\(id\);if\(el\)el\.addEventListener\('change',\(\)=>miControllaEsistente\(\)/.test(html), 'scatta uscendo da P.IVA o CF');
assert.ok(/this\.value!=='C\.E\.I\.V\.'/.test(html), 'C.E.I.V. a mano: avviso di verificare con la Cassa');
assert.ok(/miEsisteAzzera\(\)\n\s*\/\/ datalist comuni imprese/.test(html), 'la finestra riparte pulita');

/* ── finestra del cantiere ── */
assert.ok(/<div class="field hidden" id="mc-cod-uni-wrap">/.test(html) && /id="mc-cod-uni" readonly/.test(html) && !/btn-mc-cod-uni-proponi/.test(html), 'codice univoco: solo storico, in sola lettura');
assert.ok(/_w\.classList\.toggle\('hidden',!String\(c\.nodo_id\|\|''\)\.trim\(\)\)/.test(html), 'si vede solo sui cantieri che ce l’hanno');
assert.ok(/<div class="field hidden" id="mc-cap-wrap">/.test(html), 'CAP nascosto di partenza');
const cap = html.match(/function mcCapAggiorna\(\)\{[\s\S]*?\n\}\n/);
assert.ok(cap, 'non trovo mcCapAggiorna');
const vis = (com, tab) => { let hid = null; const w = { classList: { toggle: (_, on) => { hid = on; } } }; const sel = { value: com }; new Function('$', 'CAP_PD', cap[0] + 'mcCapAggiorna()')((id) => (id === 'mc-cap-wrap' ? w : sel), tab); return !hid; };
assert.strictEqual(vis('Padova', { Padova: '35100' }), false, 'comune in tabella: il CAP lo dà il comune');
assert.strictEqual(vis('Castelfranco Veneto', { Padova: '35100' }), true, 'comune che la tabella non conosce: si scrive');
assert.strictEqual(vis('__altro__', { Padova: '35100' }), true, 'fuori provincia: si scrive');
assert.strictEqual(vis('', { Padova: '35100' }), false, 'comune non ancora scelto: aspetta');
assert.ok((html.match(/mcCapAggiorna\(\)/g) || []).length >= 4, 'si aggiorna scegliendo il comune, su nuovo e in modifica');
assert.ok(/id="mc-etich" placeholder="es\. Via Roma 12 – ROSSI"/.test(html) && /id="btn-mc-etich-proponi"/.test(html), '«Proponi» anche sull’etichetta della scheda');

/* ── la proposta: etichetta leggibile, senza le iniziali del tecnico ── */
const ctx = { window: {}, document: { getElementById: () => null, addEventListener() {} } };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(cu, ctx);
const E = ctx.EtichettaCantiere;
assert.ok(E && !ctx.CodiceUnivoco, 'il file propone l’etichetta, non più il codice');
assert.strictEqual(E.componi({ indirizzo: 'Via della Zuanna', civ: '5', impresa: 'Vettorazzo Costruzioni S.r.l.' }), 'Via della Zuanna 5 – VETTORAZZO');
assert.strictEqual(E.componi({ indirizzo: 'Via Roma', civ: 'snc', impresa: 'Impresa Edile F.lli Rossi' }), 'Via Roma – ROSSI', 'senza civico, senza parole generiche');
assert.strictEqual(E.componi({ indirizzo: 'Via Roma', civ: '12', impresa: '' }), 'Via Roma 12', 'senza impresa resta il luogo');
assert.ok(E.componi({ indirizzo: 'Via Lunghissima Dei Santi Martiri Della Resistenza Padovana', civ: '123', impresa: 'Costruzioni Bellunesi' }).length <= 50, 'mai oltre i 50 caratteri dell’Osservatorio');
assert.ok(!/iniziali\(/.test(cu.replace(/\/\*[\s\S]*?\*\//g, '')), 'niente iniziali del tecnico');
assert.ok(/update\(\{ cantiere_etichetta: finale \}\)[\s\S]*\.or\('cantiere_etichetta\.is\.null,cantiere_etichetta\.eq\.'\)/.test(cu), 'si scrive solo se il cantiere non ha ancora un’etichetta');
assert.ok(!/nodo_id/.test(cu), 'il codice univoco non si tocca più');

/* ── PDF e nuvolette ── */
assert.ok(/'Etichetta cantiere', cant\.cantiere_etichetta \|\| '–'\]/.test(pdf) && !/'Codice univoco', cant\.nodo_id/.test(pdf), 'nel PDF l’etichetta al posto del codice univoco');
assert.ok(/'btn-etich-proponi':/.test(aiuto) && /'btn-mc-etich-proponi':/.test(aiuto) && !/'btn-cod-uni-proponi':/.test(aiuto), 'le nuvolette seguono i pulsanti');

/* ── le etichette della Cassa senza «CANTIERE DI» ── */
const sql = fs.readFileSync(path.join(dir, 'supabase', 'sql', '2026_10_06_etichette_senza_cantiere.sql'), 'utf8');
assert.ok(/create table archivio\.bk_2026_10_06_cantieri_etichette as/.test(sql) && /insert into public\.cantieri_correzioni/.test(sql), 'copia e registro prima di toccare');
assert.ok(/'\^\\s\*cantiere\\s\+di\\s\+'/.test(sql), 'solo il prefisso iniziale');

console.log('ok — maschera della visita più snella: etichetta al posto del codice univoco, impresa già in anagrafica riconosciuta');
