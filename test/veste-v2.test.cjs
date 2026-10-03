// node test/veste-v2.test.cjs
// (03/10/2026) La veste v2 è un'ANTEPRIMA: la accende solo la segreteria, col suo pulsante.
// Quello che questi controlli tengono fermo:
//   · spenta — o per chiunque non sia la segreteria — non cambia niente dell'app di oggi;
//   · gli agganci in index.html sono due righe in navTo, e non rompono niente se il file manca;
//   · menu e pagina di apertura per ruolo sono quelli decisi dall'utente;
//   · niente salvataggio automatico e niente chiusura del verbale da qui (paletti dell'utente).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radice = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(radice, 'veste-v2.js'), 'utf8');
const wf = fs.readFileSync(path.join(radice, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');

/* ── agganci ── */
assert.ok(/function navTo\(view\)\{[\s\S]{0,500}if\(window\.vesteV2\)\{const _v2=window\.vesteV2\.prima\(view\);if\(_v2\)view=_v2\}/.test(html), 'navTo deve chiedere alla veste la pagina di destinazione, solo se la veste c’è');
assert.ok(/if\(window\.vesteV2\)\{for\(const _v of\(window\.vesteV2\.dopo\(view\)\|\|\[\]\)\)\{/.test(html), 'navTo deve mostrare le pagine in più che la veste chiede');
assert.ok(/<script src="veste-v2\.js\?v=\d+"><\/script>/.test(html), 'manca lo script della veste');
assert.ok(/ veste-v2\.js /.test(wf) && /- 'veste-v2\.js'/.test(wf), 'veste-v2.js deve stare nell’elenco dei file pubblicati e in quello che fa partire la pubblicazione');

/* ── un finto browser, quanto basta per chiamare prima() e dopo() ── */
function ambiente({ email, viewer, veste }) {
  const archivio = (iniziale) => { const m = new Map(Object.entries(iniziale || {})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const classi = new Set();
  const finto = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, appendChild() {}, insertBefore() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, firstChild: null, childNodes: [] });
  const document = { body: { classList: { add: (c) => classi.add(c), remove: (c) => classi.delete(c), contains: (c) => classi.has(c) }, dataset: {} },
    head: finto(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: finto, addEventListener() {} };
  const window = { S: { user: email ? { email } : null, viewer: !!viewer } };
  new Function('window', 'document', 'localStorage', 'sessionStorage', 'location', 'MutationObserver', js)(window, document, archivio(veste ? { 'gv-veste': 'v2' } : {}), archivio(), { reload() {} }, undefined);
  return { v2: window.vesteV2, classi };
}

/* ── spenta, o per chi non è la segreteria: niente ── */
for (const caso of [
  { email: 'cptpd@did.formedilpadova.it', veste: false, che: 'segreteria con la veste spenta' },
  { email: 'franco.caon@did.formedilpadova.it', veste: true, che: 'un tecnico, anche se sul dispositivo la veste è rimasta accesa' },
  { email: 'cptpd@did.formedilpadova.it', veste: true, viewer: true, che: 'un accesso di sola lettura' },
  { email: null, veste: true, che: 'nessuno collegato' },
]) {
  const a = ambiente(caso);
  assert.strictEqual(a.v2.accesa(), false, caso.che + ': la veste non deve risultare accesa');
  assert.strictEqual(a.v2.prima('dashboard'), null, caso.che + ': la pagina di destinazione non deve cambiare');
  assert.deepStrictEqual(a.v2.dopo('dashboard'), [], caso.che + ': nessuna pagina in più');
  assert.ok(!a.classi.has('v2'), caso.che + ': la pagina non deve prendere la veste');
}

/* ── accesa dalla segreteria ── */
const s = ambiente({ email: 'CPTPD@did.formedilpadova.it', veste: true });
assert.strictEqual(s.v2.accesa(), true);
assert.strictEqual(s.v2.prima('dashboard'), 'segreteria', 'la segreteria apre su Ufficio');
assert.ok(s.classi.has('v2'));
assert.strictEqual(s.v2.prima('dashboard'), null, 'la pagina di apertura si sceglie una volta sola: poi «Oggi» è «Oggi»');
assert.deepStrictEqual(s.v2.dopo('dashboard'), ['dati:scadenze', 'dati:incarichi'], '«Oggi» chiede i dati di rientri e incarichi (le pagine restano a sé: non si mostrano sotto)');
s.v2.pronto('scadenze', { urgenti: [], prossime: [], tecMap: {} });
assert.deepStrictEqual(s.v2.dopo('dashboard'), ['dati:incarichi'], 'lo scadenzario, che legge tutte le visite, non si rifà a ogni clic');
assert.deepStrictEqual(s.v2.dopo('lista'), []);

/* ── menu e apertura per ruolo, come decisi dall'utente ── */
const R = s.v2.RUOLI;
assert.deepStrictEqual(Object.keys(R), ['segreteria', 'tecnico', 'coordinatore', 'direttore', 'presidenza', 'consigliere']);
assert.strictEqual(R.segreteria.apre, 'segreteria');
assert.strictEqual(R.tecnico.apre, 'dashboard'); assert.strictEqual(R.coordinatore.apre, 'dashboard');
assert.strictEqual(R.direttore.apre, 'direzione', 'il Direttore apre su Direzione');
assert.strictEqual(R.presidenza.apre, 'direzione', 'la Presidenza apre sulla sua pagina');
assert.strictEqual(R.consigliere.apre, 'dashboard', 'i consiglieri aprono sulla Mappa (corretto dall’utente il 03/10/2026)');
assert.deepStrictEqual(R.consigliere.menu, ['dashboard', 'statistiche', '|', 'az-segnala', 'az-qr', 'az-servizi'], 'il consigliere vede Mappa e Statistiche, più Segnala, QR e Servizi: niente calendario');
// Segnala cantiere, QR e Servizi CPT nel menu di chi è di sola lettura, sempre a portata (chiesto dall'utente il 03/10/2026)
for (const k of ['direttore', 'presidenza', 'consigliere']) for (const a of ['az-segnala', 'az-qr', 'az-servizi']) assert.ok(R[k].menu.includes(a), k + ' deve avere «' + a + '» nel menu');
for (const k of ['tecnico', 'coordinatore', 'segreteria']) assert.ok(!R[k].menu.some((v) => v.startsWith('az-')), k + ' ha quei pulsanti in «Oggi», non nel menu');
for (const id of ['btn-segnala-dash', 'btn-qr-servizi', 'btn-servizi-cpt']) assert.ok(html.includes('id="' + id + '"') && js.includes("preme: '" + id + "'"), 'la voce di menu deve premere il pulsante di sempre: ' + id);
// il calendario «Prossimi appuntamenti» è del solo Direttore (deciso dall'utente il 03/10/2026)
assert.ok(R.direttore.menu.includes('appuntamenti'), 'il Direttore vede il calendario');
for (const k of ['presidenza', 'consigliere', 'tecnico', 'coordinatore', 'segreteria']) assert.ok(!R[k].menu.includes('appuntamenti'), k + ' non deve vedere il calendario');
assert.ok(html.includes("(v==='appuntamenti'&&S.direttore)"), 'nell’app di oggi la voce «Prossimi appuntamenti» si mostra al solo Direttore');
assert.ok(html.includes("if(view==='appuntamenti'&&S.viewer&&!S.direttore)view='dashboard'"), 'chi è di sola lettura e non è il Direttore non arriva al calendario');
for (const k of ['direttore', 'presidenza', 'consigliere']) {
  assert.ok(R[k].lettura, k + ' è di sola lettura');
  for (const no of ['form', 'lista', 'cantieri', 'rubrica', 'segreteria', 'admin', 'incarichi', 'scadenze']) assert.ok(!R[k].menu.includes(no), k + ' non deve avere «' + no + '» nel menu');
}
assert.ok(!R.tecnico.menu.includes('segreteria') && !R.tecnico.menu.includes('admin'), 'il tecnico non vede Ufficio né Coordinamento');
assert.ok(R.coordinatore.menu.includes('admin') && !R.coordinatore.menu.includes('segreteria'));
assert.ok(R.segreteria.menu.includes('segreteria'));
for (const k of ['segreteria', 'tecnico', 'coordinatore']) assert.deepStrictEqual(R[k].menu.slice(0, 3), ['dashboard', 'form', 'lista'], '«Nuova visita» sta subito dopo «Oggi», prima di «Visite» (corretto dall’utente il 03/10/2026)');

/* ── Ufficio: i gruppi coprono tutti gli strumenti della pagina Segreteria; ciò che non rientra va in «Altro» ── */
const sezione = html.slice(html.indexOf('<section id="view-segreteria"'), html.indexOf('</section>', html.indexOf('<section id="view-segreteria"')));
const titoli = [...sezione.matchAll(/adm-section-title">([^<]+)</g)].map((m) => m[1].replace(/&[a-z0-9#]+;/gi, ' '));
assert.ok(titoli.length >= 13, 'mi aspetto almeno 13 strumenti nella pagina Segreteria, ne trovo ' + titoli.length);
const gruppo = (t) => (s.v2.GRUPPI.find((g) => g.titoli.some((c) => t.includes(c))) || { k: 'altro' }).k;
const fuori = titoli.filter((t) => gruppo(t) === 'altro');
assert.deepStrictEqual(fuori, [], 'strumenti senza gruppo (finirebbero in «Altro»): ' + fuori.join(' | '));
assert.ok(/data-g="altro"/.test(js) && /ciò che non rientra in un gruppo non sparisce/.test(js), 'uno strumento nuovo senza gruppo deve restare raggiungibile da «Altro»');

/* ── paletti dell'utente: da qui non si salva e non si chiude niente ── */
for (const [re, che] of [[/saveVisita/, 'salvare il verbale'], [/chiudi_verbale/, 'chiudere il verbale'], [/\.(insert|update|upsert|delete)\(/, 'scrivere nel database'], [/setInterval/, 'fare qualcosa a tempo']]) {
  assert.ok(!re.test(js), 'la veste non deve ' + che);
}
assert.ok(/non letto/.test(js), 'un conteggio non riuscito si dice: mai uno zero al posto di un errore');
assert.strictEqual(s.v2.esercizi().length, 2);

/* ── «Oggi»: gli incarichi stanno in cima, subito dopo le bozze (chiesto dall'utente: sotto tutto il resto non li vedrebbe nessuno) ── */
// «Oggi» è il riepilogo del prototipo: bozze, rientri scaduti, incarichi; azioni, obiettivo, avvisi (chiesto dall'utente con la schermata del prototipo)
assert.ok(/id="v2-bozze"><\/div><div id="v2-rientri"><\/div><div id="v2-incarichi"><\/div>/.test(js), 'colonna principale di «Oggi»: bozze, rientri, incarichi');
assert.ok(/id="v2-azioni"><\/div><div id="v2-posto-obiettivo"><\/div><div id="v2-posto-avvisi"><\/div>/.test(js), 'colonna laterale di «Oggi»: azioni, obiettivo, avvisi');
// rientri e incarichi li calcolano le funzioni di sempre, e la veste riceve il risultato
assert.ok(html.includes("loadScadenze().then(()=>window.vesteV2.pronto('scadenze',_scadErrore?null:_scadData))") && html.includes("loadIncarichi().then(()=>window.vesteV2.pronto('incarichi',_incErrore?null:_incCache))"), 'i dati di «Oggi» devono venire da loadScadenze e loadIncarichi, e una lettura fallita deve arrivare come fallita');
assert.ok(js.includes('Non sono riuscito a leggere i rientri') && js.includes('Non sono riuscito a leggere gli incarichi'), 'una lettura fallita si dice: mai «nessun rientro» o «nessun incarico» al posto di un errore');
assert.ok(js.includes('window.chiediNuovaVisitaRitorno(') && js.includes('window.incNuovaVisita('), '«Avvia visita» deve usare le funzioni di sempre');
assert.ok(js.includes("data-v2-mio=\"${suo ? 1 : 0}\"") && js.includes("b.dataset.v2Mio === '1'"), 'l’incarico si accetta solo se è di chi preme');
assert.ok(!/#dash-map-card\{display:none\}/.test(js), 'la mappa dei cantieri in monitoraggio resta in «Oggi» (corretto dall’utente il 03/10/2026)');
// gli incarichi del tecnico: pagina a sé e voce nel menu, col numero che lampeggia (corretto dall'utente il 03/10/2026)
for (const k of ['tecnico', 'coordinatore']) assert.ok(R[k].menu.includes('incarichi') && R[k].menu.includes('scadenze') && R[k].menu.indexOf('scadenze') < R[k].menu.indexOf('incarichi'), k + ' deve avere «Scadenze» e «Incarichi» nel menu, in quest’ordine');
assert.ok(!js.includes('#view-incarichi{order') && !js.includes('#view-scadenze{order'), 'incarichi e scadenze non stanno più dentro «Oggi»');

/* ── «Vedi come: Presidenza»: solo ciò che è della Presidenza (nell'app vera lo fa il database) ── */
const dir = fs.readFileSync(path.join(radice, 'direzione.js'), 'utf8');
assert.ok(/if \(modo === 'direzione' && come\(\)\) \{\s+righe = righe\.filter\(\(r\) => r\.decisore === come\(\)\);\s+if \(come\(\) === 'presidenza'\) auto = \{ autorizzazioni: \[\], critici: \[\] \};/.test(dir), 'nell’anteprima il registro deve mostrare le sole questioni del ruolo guardato, e alla Presidenza niente autorizzazioni né conferme del Direttore');
assert.ok(/const anteprima = modo === 'direzione' && !!come\(\);/.test(dir) && /const gestisce = !anteprima && \(R\.coord \|\| R\.segr\);/.test(dir), 'nell’anteprima non si mostrano i pulsanti di un altro ruolo');
assert.ok(/if \(!v \|\| !v\.accesa \|\| !v\.accesa\(\)\) return null;/.test(dir), 'fuori dall’anteprima «come» deve essere vuoto: la pagina vera non cambia');
const fn = dir.match(/function criticiDemandati\(casi, eventi, chi\) \{[\s\S]*?\r?\n  \}/);
assert.ok(fn, 'non trovo criticiDemandati in direzione.js');
const criticiDemandati = Function(fn[0] + '; return criticiDemandati')();
const casi = [{ id: 1, stato: 'aperto', impresa_nome: 'A', cantiere_desc: 'via 1', data_evento: '2026-09-20' }, { id: 2, stato: 'aperto', impresa_nome: 'B', cantiere_desc: 'via 2', data_evento: '2026-09-25' },
  { id: 3, stato: 'chiuso', impresa_nome: 'C' }, { id: 4, stato: 'aperto', impresa_nome: 'D' }];
const eventi = [
  { critico_id: 1, tipo: 'demandata', dati: { chi: 'direttore' }, created_at: '2026-09-21T08:00:00Z' },                 // solo al Direttore
  { critico_id: 2, tipo: 'demandata', dati: { chi: 'direttore' }, created_at: '2026-09-26T08:00:00Z' },
  { critico_id: 2, tipo: 'autorizzazione_direttore', dati: {}, created_at: '2026-09-27T08:00:00Z' },                     // il Direttore ha risposto
  { critico_id: 2, tipo: 'demandata', dati: { chi: 'presidenza' }, created_at: '2026-09-28T08:00:00Z' },                 // poi alla Presidenza
  { critico_id: 3, tipo: 'demandata', dati: { chi: 'presidenza' }, created_at: '2026-09-10T08:00:00Z' },                 // caso chiuso
  { critico_id: 4, tipo: 'demandata', dati: { chi: 'presidenza' }, created_at: '2026-09-11T08:00:00Z' },
  { critico_id: 4, tipo: 'decisione_organo', dati: {}, created_at: '2026-09-12T08:00:00Z' },                             // la Presidenza ha già deciso
];
assert.deepStrictEqual(criticiDemandati(casi, eventi, 'presidenza').map((c) => c.id), [2], 'alla Presidenza: solo il caso demandato a lei e non ancora deciso');
assert.deepStrictEqual(criticiDemandati(casi, eventi, 'direttore').map((c) => c.id), [1], 'al Direttore: solo il caso che aspetta lui');
assert.strictEqual(criticiDemandati(casi, eventi, 'presidenza')[0].dal, '2026-09-28');
assert.deepStrictEqual(criticiDemandati(casi, [], 'presidenza'), [], 'senza richieste, niente');

console.log('veste-v2: ok');
