// node test/task-ufficio.test.cjs
// (16/11/2026, chiesto dall'utente) 📋 TASK DELL'UFFICIO: le task del second brain in sola lettura nel gestionale.
// La funzione server task-ufficio le legge dal vault su Drive (leggi-task.js) e le scrive in s_task_vault; la pagina
// (task-ufficio.js) le mostra. Chi vede che cosa lo decide la policy del database; vedeRuolo la rifà per l'anteprima.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const dir = path.join(__dirname, '..');
const leggi = (...p) => fs.readFileSync(path.join(dir, ...p), 'utf8').replace(/\r\n/g, '\n');
const html = leggi('index.html');
const veste = leggi('veste-v2.js');
const yml = leggi('.github', 'workflows', 'deploy-pages.yml');
const aiuto = leggi('aiuto.js');
const toml = leggi('supabase', 'config.toml');
const P = require(path.join(dir, 'task-ufficio.js'));

(async () => {
  const L = await import(pathToFileURL(path.join(dir, 'supabase', 'functions', 'task-ufficio', 'leggi-task.js')).href);

  /* ── quali file si leggono: mai archivio, copia di riordino, cartelle personali ── */
  assert.ok(L.fileAmmesso('_SISTEMA/scadenze_ufficio.md'));
  assert.ok(L.fileAmmesso('2_AREE/Asseverazione/imprese/14_VILNAI_02003860281/tasks.md'));
  assert.ok(L.fileAmmesso('1_PROGETTI/Progetti_finanziati/2023_09_Simulatore_VR/tasks.md'));
  assert.ok(!L.fileAmmesso('4_ARCHIVIO/Progetti_terminati/x/tasks.md'), 'archivio escluso');
  assert.ok(!L.fileAmmesso('BK20260626/2_AREE/x/tasks.md'), 'copia pre-riordino esclusa');
  assert.ok(!L.fileAmmesso('2_AREE/x/_PERSONALE/tasks.md'), 'cartelle personali escluse');
  assert.ok(!L.fileAmmesso('_SISTEMA/altro.md'), 'solo i due file fissi di _SISTEMA');

  /* ── una task: titolo dal grassetto, segni del plugin Tasks tolti, data, priorità, questione ── */
  const oggi = '2026-11-16';
  const testo = [
    '## Rapporti con enti e adempimenti *(aggiunte 2026-08-11)*',
    '- [ ] **Circolare 64/2026**: iscrizione entro il 30/11, vedi [[2026_11_09_CIRC_x|nota]] 📅 2026-11-30 ⏫ 🆔 dec175',
    '  - *(12/11/2026)* proposta al Direttore',
    '- [x] **Fatta da poco** ✅ 2026-11-13 — prova scritta',
    '- [x] **Fatta da tanto** ✅ 2026-08-01',
    '- [x] **Fatta senza data**',
    '## Applicativi e manuali',
    '- [ ] **Scope Google** per il calendario 📅 2026-10-17',
    '- [ ] **Riservata ma in sezione da Coordinatore** #solo-segreteria',
  ].join('\n');
  const r = L.leggiFile('_SISTEMA/scadenze_ufficio.md', testo, oggi);
  assert.strictEqual(r.length, 4, 'le fatte vecchie o senza ✅ non si portano');
  const [c, f, s, ris] = r;
  assert.strictEqual(c.titolo, 'Circolare 64/2026');
  assert.strictEqual(c.ambito, 'Ufficio · Rapporti con enti e adempimenti', 'la nota fra parentesi del titolo di sezione non entra');
  assert.strictEqual(c.scadenza, '2026-11-30'); assert.strictEqual(c.priorita, 'alta'); assert.strictEqual(c.dec_id, 175);
  assert.ok(!/📅|⏫|🆔|\[\[/u.test(c.dettaglio), 'nel dettaglio niente segni del plugin né wikilink: ' + c.dettaglio);
  assert.ok(c.dettaglio.includes('nota') && c.dettaglio.includes('¶ *(12/11/2026)* proposta al Direttore'), 'la riga rientrata sotto la task è il suo dettaglio');
  assert.strictEqual(c.vede_coordinatore, true, 'rapporti con enti: li vede il Coordinatore');
  assert.strictEqual(f.stato, 'fatta'); assert.strictEqual(f.fatta_il, '2026-11-13');
  assert.strictEqual(s.vede_coordinatore, false, 'applicativi e manuali: della sola segreteria');
  assert.strictEqual(ris.vede_coordinatore, false, '#solo-segreteria vince sulla sezione');
  assert.strictEqual(ris.titolo, 'Riservata ma in sezione da Coordinatore');

  /* ── ambito e visibilità dai percorsi ── */
  assert.deepStrictEqual(L.contesto('2_AREE/Asseverazione/imprese/10_PREARO_03668870284/tasks.md'), { gruppo: 'asseverazione', ambito: 'Asseverazione · Prearo', vede: true });
  assert.deepStrictEqual(L.contesto('2_AREE/Eventi_Campagne/2026_12_15_Convegno-ITL/tasks.md'), { gruppo: 'eventi', ambito: 'Eventi · Convegno ITL', vede: true });
  assert.strictEqual(L.contesto('1_PROGETTI/2023_05_Revisione-sito-web-Tagliani/tasks.md').vede, false, 'il sito: della sola segreteria');
  assert.strictEqual(L.contesto('1_PROGETTI/Progetti_finanziati/2023_09_Simulatore_VR/tasks.md').ambito, 'Progetto · Simulatore VR');

  /* ── chiavi distinte anche con due task dallo stesso titolo nello stesso file ── */
  const doppie = L.conChiavi(L.leggiFile('_SISTEMA/scadenze_ufficio.md', '- [ ] **Uguale**\n- [ ] **Uguale**', oggi));
  assert.notStrictEqual(doppie[0].baseChiave, doppie[1].baseChiave);

  /* ── chi vede che cosa (anteprima «Vedi come…»: la stessa regola della policy) ── */
  const dec = { 175: { id: 175, stato: 'aperta' }, 145: { id: 145, stato: 'ritirata', ritiro_tipo: 'non_mostrare' }, 22: { id: 22, stato: 'chiusa' }, 176: { id: 176, stato: 'proposta' }, 5: { id: 5, stato: 'ritirata', ritiro_tipo: 'risolta' } };
  const T = (o) => Object.assign({ stato: 'aperta', vede_coordinatore: false, dec_id: null }, o);
  assert.ok(P.vedeRuolo(T({ dec_id: 175 }), 'direttore', dec), 'il Direttore vede la sua questione aperta');
  assert.ok(P.vedeRuolo(T({ dec_id: 22 }), 'direttore', dec), 'e quelle decise');
  assert.ok(P.vedeRuolo(T({ dec_id: 5 }), 'direttore', dec), 'e quelle ritirate perché già risolte');
  assert.ok(!P.vedeRuolo(T({ dec_id: 145 }), 'direttore', dec), 'non quelle ritirate come «non è materia per il Direttore»');
  assert.ok(!P.vedeRuolo(T({ dec_id: 176 }), 'direttore', dec), 'non le proposte che la segreteria non ha ancora mostrato');
  assert.ok(!P.vedeRuolo(T({ vede_coordinatore: true }), 'direttore', dec), 'senza questione il Direttore non vede');
  assert.ok(P.vedeRuolo(T({ vede_coordinatore: true }), 'coordinatore', dec));
  assert.ok(P.vedeRuolo(T({ dec_id: 175 }), 'coordinatore', dec), 'il Coordinatore vede anche una task della segreteria legata a una questione visibile');
  assert.ok(!P.vedeRuolo(T({}), 'coordinatore', dec));
  assert.ok(P.vedeRuolo(T({}), 'segreteria', dec), 'la segreteria vede tutto');

  /* ── le date: «scaduta» solo da meno di 30 giorni ── */
  assert.strictEqual(P.etichettaData(T({ scadenza: '2026-11-11' }), oggi).tipo, 'scaduta');
  assert.strictEqual(P.etichettaData(T({ scadenza: '2026-08-31' }), oggi).tipo, 'vecchia', 'data passata da più di 30 giorni: da aggiornare, non rosso');
  assert.strictEqual(P.etichettaData(T({ scadenza: '2026-11-20' }), oggi).tipo, 'vicina');
  assert.strictEqual(P.etichettaData(T({ scadenza: '2026-12-20' }), oggi).tipo, 'futura');
  assert.strictEqual(P.etichettaData(T({ stato: 'fatta', fatta_il: '2026-11-13' }), oggi).testo, 'fatta il 13/11/2026');
  const ord = P.ordina([T({ titolo: 'futura', scadenza: '2026-12-20' }), T({ titolo: 'vecchia', scadenza: '2026-08-31' }), T({ titolo: 'scaduta', scadenza: '2026-11-11' }), T({ titolo: 'vicina', scadenza: '2026-11-18' })], oggi).map((x) => x.titolo);
  assert.deepStrictEqual(ord, ['scaduta', 'vicina', 'futura', 'vecchia']);
  assert.deepStrictEqual(P.filtra([T({ titolo: 'a', scadenza: '2026-08-31' }), T({ titolo: 'b', scadenza: '2026-11-20' })], { filtro: 'vicine' }, oggi).map((x) => x.titolo), ['b'], '«entro 30 giorni» lascia fuori le date vecchie');

  /* ── il testo si mostra sempre ripulito: niente HTML dalla task ── */
  assert.strictEqual(P.formatta('**ok** <script>x</script> ¶ `c`'), '<b>ok</b> &lt;script&gt;x&lt;/script&gt;<br><code style="font-size:12px;background:#f3f3f3;padding:0 3px;border-radius:3px">c</code>');

  /* ── l'aggancio nell'app: voce, pagina, script, pubblicazione, nuvoletta, verify_jwt ── */
  assert.ok(html.includes('id="nav-task"') && html.includes('<section id="view-task"') && html.includes('<script src="task-ufficio.js'), 'voce, pagina e script in index.html');
  assert.ok(html.includes("$('view-task')?.classList.toggle('hidden',view!=='task')"), 'la pagina si mostra e si nasconde');
  assert.ok(html.includes("window.taskUfficio.mostra($('task-ufficio'))"), 'aprendo la pagina si caricano le task');
  assert.ok(html.includes("(v==='task'&&S.direttore)"), 'nel menu di sola lettura la voce è del solo Direttore');
  const menuDi = (r) => (new RegExp(r + ":\\s*\\{[^}]*menu: \\[([^\\]]*)\\]").exec(veste) || [])[1] || '';
  assert.ok(menuDi('segreteria').includes("'task'") && menuDi('coordinatore').includes("'task'") && menuDi('direttore').includes("'task'"), 'nel menu di segreteria, Coordinatore e Direttore');
  for (const r of ['tecnico', 'docente', 'presidenza', 'consigliere']) assert.ok(!menuDi(r).includes("'task'"), 'non nel menu di ' + r);
  assert.ok((yml.match(/task-ufficio\.js/g) || []).length >= 2, 'pubblicato su Pages (elenco dei percorsi e copia)');
  assert.ok(aiuto.includes("'nav-task':"), 'la voce ha la sua nuvoletta');
  assert.ok(/\[functions\.task-ufficio\]\s*\nverify_jwt = true/.test(toml), 'la funzione server vuole un accesso valido');

  console.log('task-ufficio: ok');
})().catch((e) => { console.error(e); process.exit(1); });
