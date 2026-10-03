// node test/ora-fine-alla-chiusura.test.cjs
// Se il tecnico non indica l'ora di fine, ci va quella in cui il verbale viene chiuso come
// definitivo (02/10/2026, deciso dall'utente).
// Quello che questi controlli tengono fermo:
//   · un'ora indicata dal tecnico non si tocca mai;
//   · una bozza non riceve nessuna ora;
//   · risalvare un verbale già definitivo non gli inventa un'ora;
//   · chiudendo in un giorno diverso dalla visita l'ora NON si mette (non sarebbe quella della visita).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/function oraFineAllaChiusura\(d\)\{[\s\S]*?\r?\n\}/);
assert.ok(m, 'oraFineAllaChiusura non trovata in index.html');
const oraFine = Function(m[0] + '; return oraFineAllaChiusura')();

const base = { stato: 'definitivo', giaDefinitivo: false, importo: '1', oraA: '', oraDa: '09:30', dataVisita: '2026-10-02', oggi: '2026-10-02', adesso: '11:47' };

assert.deepStrictEqual(oraFine(base), { ora: '11:47', motivo: 'messa' });
assert.deepStrictEqual(oraFine({ ...base, oraDa: '' }), { ora: '11:47', motivo: 'messa' }, 'senza ora di inizio si mette lo stesso');
assert.deepStrictEqual(oraFine({ ...base, oraDa: '09:30:00', adesso: '11:47:59' }), { ora: '11:47', motivo: 'messa' }, 'i secondi non contano');
// il tecnico l'ha indicata: non si tocca
assert.strictEqual(oraFine({ ...base, oraA: '10:15' }).ora, null);
assert.strictEqual(oraFine({ ...base, oraA: '10:15' }).motivo, 'gia-indicata');
// bozza
assert.strictEqual(oraFine({ ...base, stato: 'bozza' }).ora, null);
// già definitivo: risalvare un vecchio verbale non gli inventa un'ora
assert.strictEqual(oraFine({ ...base, giaDefinitivo: true }).ora, null);
// chiuso il giorno dopo
assert.deepStrictEqual(oraFine({ ...base, oggi: '2026-10-03' }), { ora: null, motivo: 'altro-giorno' });
assert.deepStrictEqual(oraFine({ ...base, dataVisita: '' }), { ora: null, motivo: 'altro-giorno' });
// ora di adesso prima dell'inizio dichiarato
assert.deepStrictEqual(oraFine({ ...base, adesso: '08:10' }), { ora: null, motivo: 'prima-dell-inizio' });
// un'ora illeggibile non si scrive
assert.strictEqual(oraFine({ ...base, adesso: '' }).ora, null);
assert.strictEqual(oraFine(null).ora, null);

/* nel salvataggio: prima del controllo di coerenza, e senza inventare se la lettura fallisce */
const save = html.match(/async function saveVisita\(stato\)\{[\s\S]*?controllo di coerenza prima del definitivo/);
assert.ok(save && /oraFineAllaChiusura\(\{stato,giaDefinitivo:_giaDef/.test(save[0]), 'il salvataggio deve usare oraFineAllaChiusura prima del controllo');
assert.ok(/_giaDef=!!_eOra\|\|/.test(save[0]), 'se la lettura della visita fallisce non si mette nessuna ora');
assert.ok(/if\(_of\.ora\)\{vSet\('f-a',_of\.ora\)/.test(save[0]), 'l’ora va scritta nel campo, così entra nel verbale e nella copia del modulo');

/* ── ora di fine e ruolo dell'impresa OBBLIGATORI alla chiusura (02/10/2026, deciso dall'utente) ── */
const m2 = html.match(/function mancaAllaChiusura\(d\)\{[\s\S]*?\r?\n\}/);
assert.ok(m2, 'mancaAllaChiusura non trovata in index.html');
const m3 = html.match(/function impresaDoppia\(imprese,id,esclusa\)\{[\s\S]*?\r?\n\}/);
assert.ok(m3, 'impresaDoppia non trovata in index.html');
const manca = Function(m3[0] + ';' + m2[0] + '; return mancaAllaChiusura')();
const doppia = Function(m3[0] + '; return impresaDoppia')();

/* ── la stessa impresa non entra due volte (dal verbale CPT/26_27/0002) ── */
const G = { impresa_id: '00251920286', impresa_nome: 'Galiazzo' }, B = { impresa_id: '03236900274', impresa_nome: 'Boscolo' };
assert.strictEqual(doppia([G, B]), null);
assert.deepStrictEqual(doppia([G, B, { ...G }]), { prima: 0, riga: 2, nome: 'Galiazzo' });
assert.strictEqual(doppia([G, { impresa_id: '', impresa_nome: '' }, { impresa_id: '' }]), null, 'le righe ancora vuote non sono doppioni');
assert.strictEqual(doppia([{ impresa_id: 'abc123' }, { impresa_id: ' ABC123 ' }]).riga, 1, 'maiuscole e spazi non distinguono');
// mentre si sceglie: c'è già in un'altra riga? (la riga che si sta compilando non conta)
assert.deepStrictEqual(doppia([G, B, {}], '00251920286', 2), { prima: 0, riga: 2, nome: 'Galiazzo' });
assert.strictEqual(doppia([G, B], '00251920286', 0), null, 'riscegliere la stessa impresa nella sua riga non è un doppione');
assert.strictEqual(doppia([G, B], '09999999999', 1), null);
// al salvataggio ferma sempre, anche un verbale già definitivo
assert.strictEqual(manca({ giaDefinitivo: true, oraA: '10:00', lavorazioni: 1, imprese: [G, { ...G }] })[0].cosa, 'impresa-doppia');
assert.ok(/due volte/.test(manca({ giaDefinitivo: false, importo: '1', oraA: '10:00', lavorazioni: 1, imprese: [{ ...G, tipo_imp: 1 }, { ...G, tipo_imp: 1 }] })[0].testo));
assert.ok(/impresaDoppia\(S\.imprese,item\.id,idx\)/.test(html), 'la ricerca nella riga deve rifiutare un’impresa già presente');
assert.ok(/function _useImpresaEsistente\(c,idx\)\{\r?\n  const _gia=impresaDoppia\(S\.imprese,c\.impresa_id,idx\)/.test(html), '«usa l’impresa esistente» deve rifiutare un doppione');
const IMP = [{ impresa_id: '01234567890', impresa_nome: 'Rossi Costruzioni', tipo_imp: '2' }, { impresa_id: '09999999999', impresa_nome: 'Bianchi', tipo_imp: '' }];

// tutto a posto: niente da completare
assert.deepStrictEqual(manca({ giaDefinitivo: false, importo: '1', oraA: '11:47', lavorazioni: 1, imprese: [IMP[0]] }), []);
// manca il ruolo della seconda impresa: si dice quale, e dove andare
const r1 = manca({ giaDefinitivo: false, importo: '1', oraA: '11:47', lavorazioni: 2, imprese: IMP });
assert.strictEqual(r1.length, 1);
assert.deepStrictEqual([r1[0].cosa, r1[0].tab, r1[0].campo], ['ruolo', 2, 'im-tipo-1']);
assert.ok(/Bianchi/.test(r1[0].testo) && /obbligatorio/.test(r1[0].testo));
// manca l'ora di fine
const r2 = manca({ giaDefinitivo: false, importo: '1', oraA: '  ', lavorazioni: 1, imprese: [IMP[0]] });
assert.deepStrictEqual([r2.length, r2[0].cosa, r2[0].tab, r2[0].campo], [1, 'ora-fine', 15, 'f-a']);
// mancano tutti e tre: nell'ordine dei passi del verbale (Visita, Cantiere, Imprese)
assert.deepStrictEqual(manca({ giaDefinitivo: false, importo: '1', oraA: '', lavorazioni: 0, imprese: IMP }).map((x) => x.cosa), ['ora-fine', 'lavorazioni', 'ruolo']);
// nessuna lavorazione in corso: ne serve almeno una, e si va al passo Cantiere
const r3 = manca({ giaDefinitivo: false, importo: '1', oraA: '11:47', lavorazioni: 0, imprese: [IMP[0]] });
assert.deepStrictEqual([r3.length, r3[0].cosa, r3[0].tab, r3[0].campo], [1, 'lavorazioni', 1, 'lav-sel-genere']);
assert.strictEqual(manca({ giaDefinitivo: false, importo: '1', oraA: '11:47', imprese: [IMP[0]] }).length, 1, 'lavorazioni non indicate = nessuna');
// una riga impresa ancora vuota non conta; uno zero non è un ruolo
assert.deepStrictEqual(manca({ giaDefinitivo: false, importo: '1', oraA: '10:00', lavorazioni: 1, imprese: [IMP[0], { impresa_id: '', impresa_nome: '', tipo_imp: '' }] }), []);
assert.strictEqual(manca({ giaDefinitivo: false, importo: '1', oraA: '10:00', lavorazioni: 1, imprese: [{ impresa_nome: 'Verdi', tipo_imp: 0 }] }).length, 1);
/* ── importo dei lavori obbligatorio (03/10/2026): lo chiede l'Osservatorio nazionale, se non si sa si stima ── */
const r4 = manca({ giaDefinitivo: false, oraA: '11:47', lavorazioni: 1, imprese: [IMP[0]] });
assert.deepStrictEqual([r4.length, r4[0].cosa, r4[0].tab, r4[0].campo], [1, 'importo', 1, 'f-importo']);
assert.ok(/stim/.test(r4[0].testo) && /nazionale/.test(r4[0].testo));
const r5 = manca({ giaDefinitivo: false, importo: '11', oraA: '11:47', lavorazioni: 1, imprese: [IMP[0]] });
assert.ok(r5.length === 1 && r5[0].cosa === 'importo' && /Non disponibile/.test(r5[0].testo), '«Non disponibile» non basta');
assert.deepStrictEqual(manca({ giaDefinitivo: false, importo: '10', oraA: '11:47', lavorazioni: 1, imprese: [IMP[0]] }), []);
assert.deepStrictEqual(manca({ giaDefinitivo: false, oraA: '', lavorazioni: 0, imprese: IMP }).map((x) => x.cosa), ['ora-fine', 'importo', 'lavorazioni', 'ruolo'], 'nell’ordine dei passi');

/* ── almeno un'impresa con l'e-mail (03/10/2026, regola dell'utente) ── */
const IM1 = { impresa_id: '00251920286', impresa_nome: 'Galiazzo', tipo_imp: '1' }, IM2 = { impresa_id: '04741550281', impresa_nome: 'Fortuna', tipo_imp: '4' };
const ok = { giaDefinitivo: false, importo: '1', oraA: '15:27', lavorazioni: 1 };
const r6 = manca({ ...ok, imprese: [IM1, IM2], mailAnagrafica: { '00251920286': false, '04741550281': false } });
assert.deepStrictEqual([r6.length, r6[0].cosa, r6[0].tab, r6[0].campo], [1, 'email-impresa', 2, 'im-email_verbale-0']);
assert.deepStrictEqual(manca({ ...ok, imprese: [IM1, IM2], mailAnagrafica: { '00251920286': false, '04741550281': true } }), [], 'basta un’impresa con l’e-mail in anagrafica');
assert.deepStrictEqual(manca({ ...ok, imprese: [IM1, { ...IM2, email_verbale: 'info@fortuna.it' }], mailAnagrafica: {} }), [], 'vale anche l’indirizzo scritto nel verbale');
assert.deepStrictEqual(manca({ ...ok, imprese: [IM1], mailAnagrafica: null }), [], 'lettura non riuscita: non si blocca (lo dice il salvataggio)');
assert.deepStrictEqual(manca({ ...ok, imprese: [{ impresa_id: 'abc', impresa_nome: 'x', tipo_imp: 1 }], mailAnagrafica: { ABC: true } }), [], 'le chiavi sono in maiuscolo');

// un verbale che era già definitivo non viene fermato (i vecchi importati possono non avere questi dati)
assert.deepStrictEqual(manca({ giaDefinitivo: true, oraA: '', imprese: IMP }), []);

/* nel salvataggio: dopo il tentativo di mettere l'ora, e fermandosi */
assert.ok(/mancaAllaChiusura\(\{giaDefinitivo:_giaDef,oraA:vGet\('f-a'\),importo:vGet\('f-importo'\),lavorazioni:\(S\.lavorazioni\|\|\[\]\)\.length,imprese:S\.imprese,mailAnagrafica:_mailAnag\}\)[\s\S]{0,700}return/.test(save[0]), 'se manca qualcosa il salvataggio si ferma');
assert.ok(save[0].indexOf('oraFineAllaChiusura({') < save[0].indexOf('mancaAllaChiusura({'), 'prima si prova a mettere l’ora, poi si controlla');
assert.ok(/<label>Ora di fine della visita \*<\/label>/.test(html) && /<label>Tipologia \(ruolo in cantiere\) \*<\/label>/.test(html) && /<label>Lavorazioni in corso \* /.test(html) && /<label>Importo lavori \*<\/label>/.test(html), 'i campi obbligatori portano l’asterisco');

/* checklist, lavorazioni e imprese si riscrivono con delete + insert: l'esito va letto,
   o un insert rifiutato lascia il verbale senza quelle righe in silenzio (02/10/2026) */
for (const tab of ['visite_checklist', 'visite_lavorazioni', 'visite_imprese_presenti']) {
  const nudi = html.match(new RegExp("(^|[^(])await sb\\.from\\('" + tab + "'\\)\\.(delete|insert)\\(", 'gm')) || [];
  const letti = html.match(new RegExp("_scritto\\(await sb\\.from\\('" + tab + "'\\)\\.(delete|insert)\\(", 'g')) || [];
  assert.strictEqual(letti.length, 2, tab + ': delete e insert devono passare da _scritto');
  assert.strictEqual(nudi.filter((x) => !/_scritto\($/.test(x.slice(0, x.indexOf('await')))).length, 0, tab + ': una scrittura non legge l’esito');
}

console.log('ok — ora di fine alla chiusura');
