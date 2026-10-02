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

console.log('ok — ora di fine alla chiusura');
