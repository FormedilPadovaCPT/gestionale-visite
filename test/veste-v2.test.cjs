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
assert.deepStrictEqual(s.v2.dopo('dashboard'), ['scadenze', 'incarichi'], '«Oggi» mostra sotto scadenze e incarichi');
assert.deepStrictEqual(s.v2.dopo('lista'), []);

/* ── menu e apertura per ruolo, come decisi dall'utente ── */
const R = s.v2.RUOLI;
assert.deepStrictEqual(Object.keys(R), ['segreteria', 'tecnico', 'coordinatore', 'direttore', 'presidenza', 'consigliere']);
assert.strictEqual(R.segreteria.apre, 'segreteria');
assert.strictEqual(R.tecnico.apre, 'dashboard'); assert.strictEqual(R.coordinatore.apre, 'dashboard');
assert.strictEqual(R.direttore.apre, 'direzione', 'il Direttore apre su Direzione');
assert.strictEqual(R.presidenza.apre, 'direzione', 'la Presidenza apre sulla sua pagina');
assert.strictEqual(R.consigliere.apre, 'statistiche', 'i consiglieri aprono sulle Statistiche');
assert.deepStrictEqual(R.consigliere.menu, ['statistiche', 'dashboard', 'appuntamenti']);
for (const k of ['direttore', 'presidenza', 'consigliere']) {
  assert.ok(R[k].lettura, k + ' è di sola lettura');
  for (const no of ['form', 'lista', 'cantieri', 'rubrica', 'segreteria', 'admin', 'incarichi', 'scadenze']) assert.ok(!R[k].menu.includes(no), k + ' non deve avere «' + no + '» nel menu');
}
assert.ok(!R.tecnico.menu.includes('segreteria') && !R.tecnico.menu.includes('admin'), 'il tecnico non vede Ufficio né Coordinamento');
assert.ok(R.coordinatore.menu.includes('admin') && !R.coordinatore.menu.includes('segreteria'));
assert.ok(R.segreteria.menu.includes('segreteria'));
for (const k of ['segreteria', 'tecnico', 'coordinatore']) assert.strictEqual(R[k].menu[R[k].menu.length - 1], 'form', '«Nuova visita» è l’ultima voce, a destra');

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

console.log('veste-v2: ok');
