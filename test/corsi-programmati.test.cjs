// node test/corsi-programmati.test.cjs
// (03/11/2026, chiesto dall'utente) CORSI IN PROGRAMMA: la programmazione dell'Ufficio Corsi (formazione_calendario +
// formazione_catalogo), in sola lettura, per tecnici, Coordinatore, segreteria, Direttore, Presidenza e consiglieri;
// non per i docenti esterni. Le quote si dicono come nel verbale: la cifra del listino sempre, mai «gratuito» a stima.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n');
const html = leggi('index.html');
const veste = leggi('veste-v2.js');
const yml = leggi('.github', 'workflows', 'deploy-pages.yml');
const aiuto = leggi('aiuto.js');
const C = require(path.join(dir, 'corsi-programmati.js'));

/* ── le giornate e come si dicono ── */
assert.deepStrictEqual(C.giornate({ data_inizio: '2026-11-04', data_fine: '2026-11-05' }), ['2026-11-04', '2026-11-05'], 'senza elenco: i giorni fra inizio e fine');
assert.deepStrictEqual(C.giornate({ giornate: ['2026-11-26', '2026-11-19', '2026-11-19'] }), ['2026-11-19', '2026-11-26'], 'elenco ordinato e senza doppioni');
assert.strictEqual(C.quando({ giornate: ['2026-11-04', '2026-11-05'] }), 'mer 4 e gio 5 novembre');
assert.strictEqual(C.quando({ giornate: ['2026-11-19', '2026-11-20', '2026-11-26', '2026-11-27'] }), '19, 20, 26 e 27 novembre', 'giornate non consecutive: tutte, non «dal 19 al 27»');
assert.strictEqual(C.quando({ giornate: ['2026-11-30', '2026-12-01'] }), 'lun 30 novembre e mar 1 dicembre', 'a cavallo di due mesi');
assert.strictEqual(C.quando({ giornate: ['2026-12-03'] }), 'gio 3 dicembre');

/* ── le quote: mai «gratuito» a stima, il listino sempre ── */
assert.strictEqual(C.quota({ ceiv_gratuito: true, quota_listino: 120, diritti_segreteria: 30 }), 'imprese C.E.I.V.: gratuito + € 30 di diritti di segreteria · listino € 120 + IVA');
assert.strictEqual(C.quota({ ceiv_gratuito: false, quota_ceiv: 90, quota_listino: 180 }), 'imprese C.E.I.V.: € 90 + IVA · listino € 180 + IVA');
assert.strictEqual(C.quota({ ceiv_gratuito: false, quota_ceiv: null, quota_listino: 250.5 }), 'listino € 250,50 + IVA');
assert.strictEqual(C.quota({ ceiv_gratuito: false, quota_ceiv: 0 }), 'imprese C.E.I.V.: € 0 + IVA', 'una quota a zero si dice come cifra: «gratuito» lo dice solo il listino');
assert.strictEqual(C.quota(null), '');

/* ── i gruppi: solo le edizioni non finite, per mese di inizio, con la ricerca ── */
const ed = [
  { codice: '100', titolo_programmazione: 'Preassunzione', data_inizio: '2026-10-14', data_fine: '2026-10-15', sede: 'PADOVA' },
  { codice: '127', titolo_programmazione: 'PONTEGGI', data_inizio: '2026-11-19', data_fine: '2026-11-27', sede: 'PADOVA' },
  { codice: '108', titolo_programmazione: 'FORMAZIONE PREPOSTI', data_inizio: '2026-10-30', data_fine: '2026-11-03', sede: 'PADOVA' },
  { codice: '145', titolo_programmazione: 'GRU A TORRE', data_inizio: '2026-12-01', data_fine: '2026-12-02', sede: 'ESTERNA' },
];
const g = C.raggruppa(ed, [{ codice: '127', titolo: 'PONTEGGI MONTAGGIO' }], '2026-11-03', '');
assert.deepStrictEqual(g.map((x) => x.titolo), ['Novembre 2026', 'Dicembre 2026'], 'l\'edizione iniziata il 30/10 e non finita resta, nel mese della giornata che resta');
assert.strictEqual(g.reduce((s, x) => s + x.righe.length, 0), 3, 'quella finita il 15/10 non c\'è');
assert.ok(g[0].righe[0].a.iniziato && /oggi è la giornata 5 di 5/.test(g[0].righe[0].avviso), 'ed è segnata come già iniziata');
assert.strictEqual(g[0].righe[1].c.titolo, 'PONTEGGI MONTAGGIO', 'il catalogo accanto all\'edizione');
assert.deepStrictEqual(C.raggruppa(ed, [], '2026-11-03', 'gru').map((x) => x.righe.length), [1], 'la ricerca filtra');
assert.deepStrictEqual(C.raggruppa(ed, [], '2026-11-03', 'esterna').map((x) => x.titolo), ['Dicembre 2026'], 'la ricerca guarda anche la sede');

/* ── corso su più giornate già cominciato (03/11/2026, osservazione dell'utente) ── */
const pont = { codice: '127', titolo_programmazione: 'PONTEGGI', data_inizio: '2026-11-19', data_fine: '2026-11-27', giornate: ['2026-11-19', '2026-11-20', '2026-11-26', '2026-11-27'], sede: 'PADOVA' };
let a = C.avanzamento(pont, '2026-11-18');
assert.ok(!a.iniziato && a.n === 1 && a.tot === 4, 'prima del primo giorno: non iniziato');
assert.strictEqual(C.avviso(a, '2026-11-18'), '', 'nessun avviso prima del primo giorno');
a = C.avanzamento(pont, '2026-11-21');
assert.ok(a.iniziato && a.n === 3 && a.prossima === '2026-11-26', 'dopo le prime due giornate la prossima è la 3 di 4');
assert.strictEqual(C.avviso(a, '2026-11-21'), 'Corso già iniziato il 19 novembre: il 26 novembre è la giornata 3 di 4.');
assert.strictEqual(C.avviso(C.avanzamento(pont, '2026-11-20'), '2026-11-20'), 'Corso già iniziato il 19 novembre: oggi è la giornata 2 di 4.', 'nel giorno stesso dice «oggi»');
assert.ok(C.avanzamento(pont, '2026-11-28').finito, 'dopo l\'ultima giornata è finito');
const gi = C.raggruppa([pont], [], '2026-11-21', '');
assert.strictEqual(gi[0].righe[0].quando, 'gio 26 e ven 27 novembre', 'si mostrano le giornate che restano, non quelle passate');
assert.ok(/giornata 3 di 4/.test(gi[0].righe[0].avviso), 'e l\'avviso con la giornata');
const ps = { codice: '108', titolo_programmazione: 'PREPOSTI', data_inizio: '2026-11-30', data_fine: '2026-12-01', giornate: ['2026-11-30', '2026-12-01'] };
assert.deepStrictEqual(C.raggruppa([ps], [], '2026-12-01', '').map((x) => x.titolo), ['Dicembre 2026'], 'un corso iniziato si mette nel mese della giornata che resta');
const js0 = leggi('corsi-programmati.js');
assert.ok(/⏩ \$\{esc\(av\)\}/.test(js0), 'l\'avviso è disegnato nella riga');

/* ── nell'app: menu, pagina, ruoli ── */
assert.ok(/<button data-view="corsi" id="nav-corsi" style="display:none">/.test(html), 'la voce di menu');
assert.ok(/<section id="view-corsi" class="hidden">[\s\S]{0,120}<div id="corsi-prog"><\/div>/.test(html), 'la pagina');
assert.ok(/'appuntamenti','corsi','direzione'/.test(html), 'la pagina è nell\'elenco di navTo');
assert.ok(/view==='corsi'&&window\.corsiProgrammati\)window\.corsiProgrammati\.mostra\(\$\('corsi-prog'\)\)/.test(html), 'aprendo la pagina si legge la programmazione');
assert.ok(/<script src="corsi-programmati\.js\?v=\d+"><\/script>/.test(html), 'lo script è caricato');
assert.ok(/\(v==='appuntamenti'&&S\.direttore\)\|\|v==='corsi'\|\|/.test(html), 'chi è di sola lettura la vede anche senza veste');
const ruoli = {};
for (const m of veste.matchAll(/^\s+(\w+):\s+\{ nome: '[^']+',\s+menu: \[([^\]]*)\]/gm)) ruoli[m[1]] = m[2];
for (const r of ['segreteria', 'tecnico', 'coordinatore', 'direttore', 'presidenza', 'consigliere']) assert.ok(/'corsi'/.test(ruoli[r] || ''), 'nel menu di: ' + r);
assert.ok(!/'corsi'/.test(ruoli.docente || 'x'), 'il docente esterno no');
assert.ok(!/'appuntamenti'/.test(ruoli.presidenza) && !/'appuntamenti'/.test(ruoli.consigliere), 'il calendario d\'ufficio resta del solo Direttore');
assert.ok(/corsi: '🎓 Corsi'/.test(veste), 'l\'etichetta nella veste');

/* ── la lettura: solo letture, errore detto come errore ── */
const js = leggi('corsi-programmati.js');
assert.ok(!/\.(insert|update|upsert|delete)\(/.test(js) && !/\.rpc\(/.test(js), 'nessuna scrittura: è sola lettura');
assert.ok(/if \(ed\.error\) throw/.test(js) && /if \(ca\.error\) throw/.test(js), 'si legge sempre error');
assert.ok(/Non sono riuscito a leggere la programmazione/.test(js) && /Non vuol dire che non ci siano corsi/.test(js), 'una lettura fallita non diventa «nessun corso»');

/* ── pubblicazione e aiuto ── */
assert.ok(/- 'corsi-programmati\.js'/.test(yml) && / corsi-programmati\.js /.test(yml), 'pubblicato da deploy-pages');
assert.ok(/'nav-corsi': '/.test(aiuto) && /'v:corsi': '/.test(aiuto), 'la nuvoletta di aiuto');

console.log('corsi-programmati: ok');
