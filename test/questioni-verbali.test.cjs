// node test/questioni-verbali.test.cjs
// (20/10/2026, chiesto dall'utente) QUESTIONI SUI VERBALI. Dal riepilogo «Verbali da sistemare» il Coordinatore fa
// passare le cose da poco o le segnala al tecnico, che risponde dalla pagina Oggi; finché una questione è aperta la
// fattura che copre quel verbale non va in pagamento (lo impedisce il database). Prima di approvare, la Zona
// Coordinatore controlla che ogni verbale segnalato dal controllo abbia una decisione.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const leggi = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
const html = leggi('index.html');
const js = leggi('questioni-verbali.js');
const rv = leggi('riepilogo-verbali.js');
const yml = leggi(path.join('.github', 'workflows', 'deploy-pages.yml'));
const sql = leggi(path.join('supabase', 'sql', '2026_10_20_questioni_verbali.sql'));
const aiuto = leggi('aiuto.js');

const Q = require(path.join(dir, 'questioni-verbali.js'));

/* ── il messaggio proposto ── */
const t = Q.testoProposto({ nome: 'Franco', nr: 'CPT/25_26/0861', data: '2026-09-09',
  avvisi: [{ testo: 'È indicata una visita di ritorno (22/10/2026), ma con IPC BASSO all\'8° accesso la regola Formedil non prevede rientro.' }] });
assert.ok(t.startsWith('Ciao Franco,\n'), 'saluta il tecnico per nome');
assert.ok(t.includes('sul verbale CPT/25_26/0861 del 09/09/2026'), 'verbale e data');
assert.ok(t.includes('- È indicata una visita di ritorno'), 'che cosa dice il controllo, riga per riga');
assert.ok(/rispondimi dall'app spiegando il perché/.test(t), 'dice come rispondere');
assert.ok(Q.testoProposto({ nr: 'X', avvisi: [] }).startsWith('Ciao,\n'), 'senza nome non scrive «Ciao undefined»');

/* ── lo stato di un verbale ── */
assert.strictEqual(Q.stato(null).codice, 'nessuna');
assert.strictEqual(Q.stato({ esito: 'segnalata', aperta_il: '2026-10-21T08:00:00Z' }).aperta, true);
assert.ok(Q.stato({ esito: 'segnalata', aperta_il: '2026-10-21', riaperto: true }).testo.includes('bozze'), 'dice se il verbale è tornato in bozza');
const risp = Q.stato({ esito: 'risposta', risposta_il: '2026-10-22', risposta_tipo: 'va_bene', risposta: 'Il committente ha chiesto la visita' });
assert.ok(risp.aperta && risp.testo.includes('«Va bene così»') && risp.testo.includes('Il committente'), 'la risposta del tecnico si legge, ed è ancora aperta');
assert.strictEqual(Q.stato({ esito: 'risolta', chiusa_il: '2026-10-23' }).aperta, false);
assert.ok(Q.stato({ esito: 'passata', chiusa_il: '2026-10-23', nota_chiusura: 'Fatto passare dal Coordinatore' }).testo === 'Fatto passare il 23/10/2026.', 'la nota predefinita non si ripete');

/* ── l'ultima questione per verbale, e i verbali senza decisione ── */
const per = Q.ultimePerVisita([{ id: 3, visita_id: 'a', esito: 'passata' }, { id: 7, visita_id: 'a', esito: 'segnalata' }, { id: 5, visita_id: 'b', esito: 'risolta' }]);
assert.strictEqual(per.a.id, 7, 'vale la più recente');
const ds = [{ visita: { visita_id: 'a' } }, { visita: { visita_id: 'b' } }, { visita: { visita_id: 'c' } }];
assert.deepStrictEqual(Q.nonDecisi(ds, per).map((x) => x.visita.visita_id), ['c'], 'senza decisione resta solo quello mai guardato');

/* ── i pulsanti: chi decide li vede, gli altri leggono lo stato ── */
const riga = { visita: { visita_id: 'v1' }, avvisi: [] };
assert.ok(/data-vq-segnala="v1"/.test(Q.htmlRiga(riga, null, true)) && /data-vq-passa="v1"/.test(Q.htmlRiga(riga, null, true)), 'mai guardato: segnala o fai passare');
assert.ok(/data-vq-risolta="v1"/.test(Q.htmlRiga(riga, { esito: 'risposta', risposta_il: '2026-10-22' }, true)), 'aperta: risolta o fai passare');
assert.ok(!/data-vq-/.test(Q.htmlRiga(riga, { esito: 'segnalata', aperta_il: '2026-10-21' }, false)), 'la segreteria vede lo stato, non i pulsanti');
assert.ok(/&lt;b&gt;/.test(Q.htmlRiga(riga, { esito: 'risposta', risposta_il: '2026-10-22', risposta: '<b>x</b>' }, false)), 'la risposta del tecnico è testo, non HTML');

/* ── la pagina ── */
assert.ok(html.includes('<div id="dash-questioni"'), 'il riquadro del tecnico sta nella pagina Oggi');
assert.ok(/QuestioniVerbali\.boxTecnico\(\)/.test(html), 'e si riempie quando si apre Oggi');
assert.ok(/<script src="questioni-verbali\.js\?v=\d+"><\/script>/.test(html), 'lo script è caricato');
assert.ok(html.indexOf('riepilogo-verbali.js?v=') < html.indexOf('questioni-verbali.js?v='), 'dopo il riepilogo');
assert.ok(yml.includes("- 'questioni-verbali.js'") && / questioni-verbali\.js /.test(yml), 'il file va su Pages (tutti e due gli elenchi)');
assert.ok(/controllaFattura\(id\)/.test(html) && /k\.nonDecisi\.length/.test(html) && /k\.aperte\.length/.test(html), 'prima di approvare si controllano i verbali della fattura');
assert.ok(/fattura_questioni_aperte/.test(html) && /' disabled':''/.test(html), 'la fattura bloccata ha «Approva» spento e dice perché');
assert.ok(/analizzaVisite/.test(rv) && /QV\.htmlRiga/.test(rv) && /aperteDelMese/.test(rv), 'il riepilogo mostra le decisioni e le questioni aperte del mese');

/* ── il database ── */
assert.ok(/create trigger trg_fatture_blocco_questioni before update of stato on public\.s_fatture_tecnici/.test(sql), 'il blocco sta nel database');
assert.ok(/new\.stato in \('approvata', 'mandato'\)/.test(sql), 'ferma approvazione e mandato');
assert.ok(/richiuso_il is null/.test(sql), 'ferma anche i verbali riaperti e non richiusi');
assert.ok(/is_coordinatore\(\)/.test(sql) && /mio_tecnico_id\(\)/.test(sql), 'decide il Coordinatore, risponde il tecnico del verbale');
assert.ok(/revoke all on public\.visite_questioni from anon, authenticated/.test(sql), 'la tabella la scrivono solo le funzioni');
/* L'unità è il verbale: nessun conteggio raggruppato per tecnico, né nel database né nel modulo */
assert.ok(!/group by[^;]*tecnico/i.test(sql), 'nessun totale per tecnico nel database');
assert.ok(!/tecnico_id\]\s*=\s*\(?[^;]*\+\s*1/.test(js) && !/perTecnico|totali?Tecnic/i.test(js), 'nessun totale per tecnico nel modulo');

/* ── le nuvolette ── */
for (const k of ['t:segnala al tecnico', 't:fai passare', 't:risolta', 't:sistemo', 't:va bene così']) {
  assert.ok(aiuto.includes(`'${k}':`), 'nuvoletta per ' + k);
}

console.log('ok — questioni sui verbali');
