// node test/verbale-lotto.test.cjs
// (29/10/2026, deciso dall'utente) il lotto del cantiere si vede sul verbale: apre la riga sotto la banda grigia,
// ha la sua riga «Lotto | Complesso» nei Dati del cantiere e chiude il titolo della lettera. Dall'etichetta stampata
// si toglie la coda «– lotto N» che lo ripeterebbe; nel database l'etichetta non cambia.
const assert = require('assert');
const V = require('../verbale-pdf.js');
const S = V.etichettaSenzaLotto;

assert.strictEqual(S('Via Sturzo – lotto 2', '2'), 'Via Sturzo');
assert.strictEqual(S('via Venezia - Giotto 1 – lotto Giotto 1', 'Giotto 1'), 'via Venezia - Giotto 1');
assert.strictEqual(S('Via Milano 10 - Lotto eden 2', 'eden 2'), 'Via Milano 10');
// una coda che nomina un altro lotto, o scritta in un altro modo, resta com'è
assert.strictEqual(S('Via Sturzo – lotto 3', '2'), 'Via Sturzo – lotto 3');
assert.strictEqual(S('Via X (lotto 3)', '3'), 'Via X (lotto 3)');
assert.strictEqual(S('Lotto 2', '2'), 'Lotto 2');   // non resta un'etichetta vuota

const base = (cant, pos) => ({ v: { acc_cant: 4, data_visita: '2026-10-27', cantieri: cant, tecnici: {} }, imps: [], chk: [], lavs: [], voci: [], posizione: pos });
const conLotto = { lotto: '2', cantiere_etichetta: 'Via Sturzo – lotto 2', comune_nome: 'Padova', cantiere_cnce: '123' };

const d = V.prepara(base(conLotto, { ciclo: { numero: 2, visita: 1, di: 3 } }));
assert.deepStrictEqual(d.posizione.slice(0, 2), [['Lotto', '2'], ['Accesso al cantiere', '4']]);
assert.strictEqual(d.etichetta, 'Via Sturzo');
assert.strictEqual(d.cantDetail, 'Via Sturzo – Padova · Lotto 2');
assert.ok(d.cantiere.some((r) => r[0] === 'Lotto' && r[1] === '2' && r[2] === 'Complesso' && r[3] === 'Via Sturzo'));
assert.ok(!d.cantiere.some((r) => r[2] === 'Etichetta cantiere'));

// storico senza ciclo: con il lotto la riga c'è lo stesso, con l'accesso dentro
assert.deepStrictEqual(V.prepara(base(conLotto)).posizione, [['Lotto', '2'], ['Accesso al cantiere', '4']]);

// senza lotto tutto com'era
const senza = V.prepara(base({ cantiere_etichetta: 'Via Roma 1', comune_nome: 'Padova' }));
assert.strictEqual(senza.posizione, null);
assert.strictEqual(senza.etichetta, 'Via Roma 1');
assert.strictEqual(senza.cantDetail, 'Via Roma 1 – Padova');
assert.ok(senza.cantiere.some((r) => r[2] === 'Etichetta cantiere' && r[3] === 'Via Roma 1'));

console.log('verbale-lotto: ok');
