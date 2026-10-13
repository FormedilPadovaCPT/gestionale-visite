// node test/verbale-numero-arancio.test.cjs
// (13/10/2026, chiesto dall'utente) nel PDF del verbale il numero si legge meglio con le
// ultime quattro cifre in arancione: «CPT/26_27/» grigio, «0031» arancione.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const VerbalePDF = require('../verbale-pdf.js');

assert.deepStrictEqual(VerbalePDF.partiNumero('CPT/26_27/0031'), ['CPT/26_27/', '0031']);
assert.deepStrictEqual(VerbalePDF.partiNumero('0031'), ['', '0031'], 'solo cifre: tutto arancione');
assert.deepStrictEqual(VerbalePDF.partiNumero('–'), ['–', ''], 'senza numero resta grigio');
assert.deepStrictEqual(VerbalePDF.partiNumero(null), ['', '']);
const src = fs.readFileSync(path.join(__dirname, '..', 'verbale-pdf.js'), 'utf8');
assert.ok(/numeroVerbale\(doc, d\.nrVerbale, L, 25\.5\)/.test(src), 'l’intestazione usa il numero colorato');
assert.ok(/f\(doc, 'bold', 21, C\.arancio\); doc\.text\(coda/.test(src), 'le cifre in arancione istituzionale');
console.log('verbale-numero-arancio: ok');
