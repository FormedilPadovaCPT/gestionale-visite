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
assert.deepStrictEqual(R.consigliere.menu, ['dashboard', 'statistiche'], 'il consigliere vede Mappa e Statistiche: niente calendario');
// NEL MENU STANNO SOLO LE PAGINE (deciso dall'utente la sera del 03/10/2026, dopo aver provato la tendina e le voci-azione)
for (const k of Object.keys(R)) assert.ok(R[k].menu.every((v) => v === '|' || html.includes('data-view="' + v + '"')), k + ': nel menu solo voci che sono pagine');
assert.ok(!js.includes('Altre app ▾') && !js.includes('function altreApp') && !js.includes('function vociAzione'), 'né tendina «Altre app» né voci-azione nel menu');
// Asseverazione (blu, solo per chi l'aveva) e Servizi CPT (verde) sono riquadri di «Oggi»
assert.ok(js.includes("['btn-servizi-cpt', '↗', 'Servizi CPT', 'v2-verde'], ['nav-assev', '✅', 'Asseverazione', 'v2-blu']"), 'Servizi CPT verde e Asseverazione blu fra i riquadri di «Oggi»');
assert.ok(js.includes("#v2-azioni button.v2-verde{background:#95C22F") && js.includes("#v2-azioni button.v2-blu{background:#2563eb"), 'i colori sono quelli dei pulsanti di sempre');
assert.ok(js.includes("id === 'nav-assev' && o.dataset.v2Mostra !== undefined ? o.dataset.v2Mostra : o.style.display"), 'l’Asseverazione compare solo a chi è asseveratore: si guarda com’era il pulsante prima della veste');
assert.ok(html.includes('id="nav-assev"'), 'il riquadro preme il pulsante di sempre');
// per chi è di sola lettura i tre pulsanti stanno sulla pagina: sulla Mappa quelli di sempre, in Direzione/Presidenza tre uguali
assert.ok(js.includes('body.v2:not(.viewer-mode) #dash-segnala-wrap,') && !js.includes('body.v2 #dash-segnala-wrap'), 'sulla Mappa di chi è di sola lettura la riga di pulsanti di sempre resta');
for (const id of ['btn-segnala-dash', 'btn-qr-servizi', 'btn-servizi-cpt']) assert.ok(html.includes('id="' + id + '"') && js.includes("preme: '" + id + "'"), 'il pulsante della pagina Direzione deve premere quello di sempre: ' + id);
assert.ok(js.includes("if (!RUOLI[ruolo()].lettura) { if (el) el.remove(); return; }") && js.includes("if (view === 'direzione') { pulsantiDirezione(); }"), 'i tre pulsanti compaiono sulla pagina Direzione/Presidenza, solo per chi è di sola lettura');
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

/* ── il verbale in tre momenti: i passi di oggi raggruppati (scelta dell'utente), stessi campi e stessi pulsanti ── */
const F = s.v2.FASI;
assert.deepStrictEqual(F[1].tabs, [1, 0], 'primo momento: cantiere e parte alta del passo «Visita»');
assert.deepStrictEqual(F[2].tabs, [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'secondo momento: persona presente, imprese, le dieci aree');
assert.deepStrictEqual(F[3].tabs, [13, 14, 15], 'terzo momento: note, foto, riepilogo');
const tutti = new Set([...F[1].tabs, ...F[2].tabs, ...F[3].tabs]);
for (let n = 0; n <= 15; n++) assert.ok(tutti.has(n), 'il passo ' + n + ' non sta in nessun momento: sparirebbe');
assert.strictEqual(s.v2.faseDi(1), 1); assert.strictEqual(s.v2.faseDi(2), 2); assert.strictEqual(s.v2.faseDi(12), 2); assert.strictEqual(s.v2.faseDi(13), 3); assert.strictEqual(s.v2.faseDi(15), 3);
assert.strictEqual(s.v2.faseDi(0), null, 'il passo «Visita» sta in due momenti: la parte alta nel primo, la persona presente nel secondo');
assert.ok(html.includes('if(window.vesteV2&&window.vesteV2.verso)window.vesteV2.verso(m.campo)'), 'chi porta a un campo mancante deve dire alla veste dove sta il campo');
assert.ok(js.includes("body.v2.v2-fase1 #view-form .v2-persona{display:none}") && js.includes("body.v2.v2-fase2 #view-form .v2-visita{display:none}"), 'la persona presente si vede nel secondo momento, il resto del passo nel primo');
assert.ok(js.includes("if (inc && card && inc.parentNode !== card) card.insertBefore(inc, card.firstChild);"), 'spegnendo la veste «Parti da un tuo incarico» deve tornare al suo posto');
assert.ok(js.includes("p.textContent = '◀ Precedente'") && js.includes("n.textContent = 'Successivo ▶'"), 'spegnendo la veste i pulsanti avanti e indietro tornano quelli di oggi');
// i passi si cambiano premendo il pulsante del passo di sempre: è lui che salva la check-list e disegna la pagina
assert.ok(/function premiPasso\(n\) \{ const b = document\.querySelector\('#tab-bar \.tab-btn\[data-ti="' \+ n \+ '"\]'\);[^}]*b\.click\(\)/.test(js), 'il cambio di passo deve passare dal pulsante dell’app');
for (const id of ['btn-bozza', 'btn-final']) assert.ok(html.includes('id="' + id + '"') && !js.includes(id), 'Bozza e Definitivo restano quelli di oggi: la veste non li tocca (' + id + ')');

/* ── «Oggi» per il tecnico: i SUOI rientri e incarichi, non quelli di tutti (corretto dall'utente il 03/10/2026) ── */
assert.ok(js.includes("if (!eSegreteria()) return Object.assign(mio, { tutti: false });"), 'un tecnico vero vede solo le sue righe');
assert.ok(js.includes("if (ruolo() === 'segreteria') return Object.assign(mio, { tutti: true });"), 'solo la segreteria, nella sua vista, vede quelle di tutti');
assert.ok(js.includes("tutti || String(v.tecnico_id) === String(mio)") && js.includes("(tutti || String(x.tecnico_email || '').toLowerCase() === io)"), 'rientri e incarichi si filtrano sul tecnico');
assert.ok(js.includes("visita && !chi.anteprima && (suo || tutti)"), 'guardando la pagina di un altro tecnico non si avvia una visita a suo nome');

/* ── primo momento come nel prototipo: incarichi a schede, cantieri vicini, tipologia a pulsanti ── */
// la tipologia di accesso: le quattro più usate, e NESSUNA già scelta (la tipologia nasce vuota, o proposta dall'incarico)
assert.deepStrictEqual(s.v2.TIPI_FREQUENTI, ['5', '7', '8', '12'], 'pulsanti: Programmata, Indicata dal CPT, Visite in serie, Progetto SPISAL');
for (const v of s.v2.TIPI_FREQUENTI) assert.ok(new RegExp('<select id="f-tipo"[\\s\\S]*?<option value="' + v + '">').test(html), 'la tipologia ' + v + ' deve esistere nella tendina di sempre');
assert.ok(js.includes("class=\"${scelta === v ? 'on' : ''}\"") && !/data-tipo="5" class="on"/.test(js), 'un pulsante è acceso solo se la tendina ha quel valore: niente «Programmata» già scelta');
assert.ok(js.includes("sel.dispatchEvent(new Event('change', { bubbles: true }));"), 'schede e pulsanti devono riempire il campo di sempre e avvisare l’app');
// i cantieri più vicini: funzione pura
const vicini = s.v2.piuVicini([{ cantiere_id: 'A', lat: 45.40, lng: 11.88 }, { cantiere_id: 'B', lat: 45.50, lng: 11.90 }, { cantiere_id: 'C', lat: null, lng: null }, { cantiere_id: 'D', lat: 45.41, lng: 11.87 }, { cantiere_id: 'E', lat: 45.90, lng: 12.2 }], 45.407, 11.876, 3);
assert.deepStrictEqual(vicini.map((c) => c.cantiere_id), ['D', 'A', 'B'], 'i tre più vicini, dal più vicino; chi non ha la posizione resta fuori');
assert.ok(vicini[0].km < 1 && vicini[2].km > 9 && vicini[2].km < 12, 'le distanze sono in chilometri');
assert.deepStrictEqual(s.v2.piuVicini([], 45, 11, 3), []);
assert.ok(js.includes("if (!e.target.closest('#v2-vicini-btn')) return;") && js.includes('navigator.geolocation.getCurrentPosition('), 'la posizione si chiede solo se si preme «Cantieri vicini a me»');
assert.ok(html.includes('window.__app={vSet,vGet,initForm,autoAccCant,renderCantCard,_useCantiereEsistente,'), 'la scheda di un cantiere vicino deve sceglierlo con la funzione di sempre');
assert.ok(js.includes("['v2-inc-schede', 'v2-vicini', 'v2-tipo-chips'].forEach((id) => { const e = $(id); if (e) e.remove(); });"), 'spegnendo la veste i tre aiuti spariscono e restano i campi di sempre');

/* ── secondo momento: righe che si aprono, col riepilogo dell'area ── */
const ar = s.v2.areaRiepilogo;
assert.deepStrictEqual(ar({ voci: 3, fatte: 0, ncp: 0, ncm: 0, oss: 0 }), { testo: 'da compilare', classe: '', stato: '' });
assert.deepStrictEqual(ar({ voci: 3, fatte: 3, ncp: 0, ncm: 0, oss: 0 }), { testo: '3 di 3', classe: '', stato: 'completa' });
assert.deepStrictEqual(ar({ voci: 5, fatte: 2, ncp: 0, ncm: 1, oss: 1 }), { testo: '2 di 5 · 1 NC− · 1 OSS', classe: 'ncm', stato: 'parziale' });
assert.strictEqual(ar({ voci: 5, fatte: 5, ncp: 1, ncm: 2, oss: 0 }).classe, 'ncp', 'con una NC+ il riepilogo è rosso');
assert.strictEqual(ar({ voci: 0, fatte: 0, ncp: 0, ncm: 0, oss: 0 }).testo, '', 'un’area senza voci non dice «da compilare»');
assert.ok(js.includes('const RIGHE2 = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];'), 'le righe del secondo momento: persona presente, imprese, le dieci aree');
assert.ok(js.includes("vaiFase(2, n);") && js.includes("function vaiFase(f, tab) { _fase = f; document.body.classList.remove('v2-area-chiusa'); premiPasso("), 'la riga apre la pagina di sempre premendo il pulsante del passo, e andando avanti una riga chiusa si riapre');
assert.ok(js.includes("function areeComEra() { document.querySelectorAll('#view-form .v2-area').forEach((r) => r.remove());"), 'spegnendo la veste le righe spariscono');

/* ── terzo momento: una pagina sola, con «Prima di chiudere» ── */
assert.ok(js.includes('body.v2.v2-fase3 #view-form .tab-content[data-tab="13"]{display:block') && js.includes('body.v2.v2-fase3 #view-form .tab-content[data-tab="15"]{display:block'), 'note, foto e riepilogo stanno insieme sullo schermo');
assert.ok(js.includes("if (!_fase3) { _fase3 = true; [13, 14, 15].forEach((n) => premiPasso(n)); }"), 'entrando nel terzo momento si aprono i tre passi di sempre, così l’app li prepara');
// l'elenco aiuta, non decide: i suoi nomi sono quelli di verbale_mancanze, e il controllo vero resta al database
const sqlVc = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_03_verbale_completo.sql'), 'utf8');
const req = s.v2.requisiti();
assert.ok(req.length >= 12, 'mi aspetto almeno dodici voci in «Prima di chiudere»');
for (const r of req) if (r.cosa !== 'cantiere') assert.ok(sqlVc.includes("'cosa','" + r.cosa + "'"), 'la voce «' + r.cosa + '» non esiste in verbale_mancanze: le due liste devono parlare la stessa lingua');
assert.ok(req.every((r) => r.ok === false || r.ok === true) && req.filter((r) => r.ok).length <= 1, 'a maschera vuota non deve risultare a posto quasi niente');
assert.ok(js.includes('il controllo vero lo fa il gestionale quando premi «Definitivo»'), 'l’elenco deve dire che non è lui a decidere');

/* ── telefono: menu in basso e tabelle come schede; pillole che premono i filtri di sempre ── */
assert.ok(!/body\.v2 nav\{position:fixed/.test(js), 'sul telefono il menu resta in alto, per tutti (deciso dall’utente dopo averlo provato in basso)');
assert.ok(js.includes("body.v2 .v2-schede td::before{content:attr(data-l);"), 'sul telefono ogni cella porta il nome della sua colonna');
assert.strictEqual(s.v2.gruppoStat('IPC per n° accesso al cantiere'), 'rischio');
assert.strictEqual(s.v2.gruppoStat('Tipologia di visita'), 'attivita');
assert.strictEqual(s.v2.gruppoStat('Tipologia di opera'), 'territorio');
assert.strictEqual(s.v2.gruppoStat('Qualcosa di nuovo'), '', 'un grafico senza gruppo resta sempre visibile');
const stat = html.slice(html.indexOf('<section id="view-statistiche"'), html.indexOf('<section id="view-committenti"'));
const grafici = [...stat.matchAll(/<div class="card[^>]*>\s*<h3[^>]*>([^<]+)/g)].map((m) => m[1]);
assert.ok(grafici.length >= 16, 'mi aspetto almeno 16 grafici nelle Statistiche');
const senzaGruppo = grafici.filter((g) => !s.v2.gruppoStat(g));
assert.deepStrictEqual(senzaGruppo, [], 'grafici senza gruppo (resterebbero sempre in vista): ' + senzaGruppo.join(' | '));
assert.ok(js.includes("sel.value = v; const c = $('btn-cerca'); if (c) c.click();") && js.includes("sel.dispatchEvent(new Event('change')); pilloleRubrica();"), 'le pillole di Visite e Rubrica devono premere i filtri di sempre');

/* ── testi leggibili in Ufficio e Coordinamento, che nascevano su fondo scuro (chiesto dall'utente) ── */
const L = s.v2.luminanza, C = s.v2.contrasto;
assert.ok(Math.abs(L('rgb(255, 255, 255)').l - 1) < 1e-9 && L('rgb(0, 0, 0)').l === 0);
assert.strictEqual(L('rgba(255, 255, 255, 0.05)').a, 0.05, 'un fondo quasi trasparente non conta: si guarda quello sotto');
assert.strictEqual(L('transparent'), null);
assert.ok(C(L('rgb(255,255,255)').l, 1) < 3, 'bianco su bianco non si legge');
assert.ok(C(L('rgba(255, 255, 255, 0.7)').l, 1) < 3, 'un testo chiaro su fondo chiaro non si legge');
assert.ok(C(L('rgb(61, 66, 73)').l, 1) > 7, 'il colore con cui si scurisce si legge bene sul bianco');
assert.ok(C(L('rgb(255,255,255)').l, L('rgb(231, 80, 15)').l) >= 3, 'il bianco sui pulsanti arancioni si legge: non va toccato');
assert.ok(js.includes("if (fondo > 0.5 && contrasto(testo.l, fondo) < 3) { el.classList.add('v2-scuro'); n++; }"), 'si scurisce solo ciò che sta su fondo chiaro e non si legge');
assert.ok(js.includes("new MutationObserver(rifai).observe(zona, { childList: true, subtree: true"), 'gli elenchi che arrivano dopo aver premuto un pulsante vanno controllati anche loro');
assert.ok(js.includes("leggibileIn('view-segreteria')") && js.includes("leggibileIn('view-admin')"), 'il controllo vale per Ufficio e per Coordinamento');

console.log('veste-v2: ok');
