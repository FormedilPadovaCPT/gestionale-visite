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

const base = { stato: 'definitivo', giaDefinitivo: false, oraA: '', oraDa: '09:30', dataVisita: '2026-10-02', oggi: '2026-10-02', adesso: '11:47' };

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
const manca = Function(m2[0] + '; return mancaAllaChiusura')();
const IMP = [{ impresa_id: '01234567890', impresa_nome: 'Rossi Costruzioni', tipo_imp: '2' }, { impresa_id: '09999999999', impresa_nome: 'Bianchi', tipo_imp: '' }];

// tutto a posto: niente da completare
assert.deepStrictEqual(manca({ giaDefinitivo: false, oraA: '11:47', imprese: [IMP[0]] }), []);
// manca il ruolo della seconda impresa: si dice quale, e dove andare
const r1 = manca({ giaDefinitivo: false, oraA: '11:47', imprese: IMP });
assert.strictEqual(r1.length, 1);
assert.deepStrictEqual([r1[0].cosa, r1[0].tab, r1[0].campo], ['ruolo', 2, 'im-tipo-1']);
assert.ok(/Bianchi/.test(r1[0].testo) && /obbligatorio/.test(r1[0].testo));
// manca l'ora di fine
const r2 = manca({ giaDefinitivo: false, oraA: '  ', imprese: [IMP[0]] });
assert.deepStrictEqual([r2.length, r2[0].cosa, r2[0].tab, r2[0].campo], [1, 'ora-fine', 0, 'f-a']);
// mancano tutti e due: prima il ruolo, poi l'ora
assert.deepStrictEqual(manca({ giaDefinitivo: false, oraA: '', imprese: IMP }).map((x) => x.cosa), ['ruolo', 'ora-fine']);
// una riga impresa ancora vuota non conta; uno zero non è un ruolo
assert.deepStrictEqual(manca({ giaDefinitivo: false, oraA: '10:00', imprese: [IMP[0], { impresa_id: '', impresa_nome: '', tipo_imp: '' }] }), []);
assert.strictEqual(manca({ giaDefinitivo: false, oraA: '10:00', imprese: [{ impresa_nome: 'Verdi', tipo_imp: 0 }] }).length, 1);
// un verbale che era già definitivo non viene fermato (i vecchi importati possono non avere questi dati)
assert.deepStrictEqual(manca({ giaDefinitivo: true, oraA: '', imprese: IMP }), []);

/* nel salvataggio: dopo il tentativo di mettere l'ora, e fermandosi */
assert.ok(/mancaAllaChiusura\(\{giaDefinitivo:_giaDef,oraA:vGet\('f-a'\),imprese:S\.imprese\}\)[\s\S]{0,700}return/.test(save[0]), 'se manca qualcosa il salvataggio si ferma');
assert.ok(save[0].indexOf('oraFineAllaChiusura({') < save[0].indexOf('mancaAllaChiusura({'), 'prima si prova a mettere l’ora, poi si controlla');
assert.ok(/<label>Ora fine \*<\/label>/.test(html) && /<label>Tipologia \(ruolo in cantiere\) \*<\/label>/.test(html), 'i due campi obbligatori portano l’asterisco');

console.log('ok — ora di fine alla chiusura');
