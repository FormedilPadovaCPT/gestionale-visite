// node test/codifica-nazionale.test.cjs
// Le tabelle del gestionale devono essere quelle NAZIONALI dell'Osservatorio FORMEDIL Italia (ex CNCPT):
// manuale Cresme tabelle 1, 2, 3 e 4 e scheda nazionale del rapporto di sopralluogo rev. 04.
// L'esportazione manda il codice così com'è: una tabella diversa vuol dire dati sbagliati a Roma.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const NAZ = {
  TIP_OPE_LABELS: { 1: 'Industriale', 2: 'Civile', 3: 'Commerciale', 4: 'Ospedaliera', 5: 'Stradale', 6: 'Rurale', 7: 'Funeraria', 8: 'Scolastica', 9: 'Ferroviaria', 10: 'Marittima', 11: 'Fluviale', 12: 'Sportiva', 13: 'Carceraria', 14: 'Campi eolici', 15: 'Fotovoltaica', 16: 'Altro' },
  DURATA_LABELS: { 1: 'Fino a 3 mesi', 2: 'Da 3 a 12 mesi', 3: 'Da 12 a 24 mesi', 4: 'Da 24 a 36 mesi', 5: 'Da 36 a 48 mesi', 6: 'Oltre 48 mesi', 7: 'Non disponibile' },
};
/* intervento: 1-4 nazionali; il 5 «Altro» è del modulo e non ha un codice nazionale */
const TIP_INT_NAZ = { 1: 'Costruzione', 2: 'Ristrutturazione', 3: 'Demolizione', 4: 'Ampliamento' };

const src = fs.readFileSync(path.join(__dirname, '..', 'app-data.js'), 'utf8');
const tabella = (nome) => Function('return ' + src.match(new RegExp('const ' + nome + '=(\\{[^}]*\\})'))[1])();

for (const [nome, attesa] of Object.entries(NAZ)) assert.deepStrictEqual(tabella(nome), attesa, nome);
const ti = tabella('TIP_INT_LABELS');
for (const [k, v] of Object.entries(TIP_INT_NAZ)) assert.strictEqual(ti[k], v, 'tipo intervento ' + k);
assert.deepStrictEqual(Object.keys(ti).map(Number), [1, 2, 3, 4, 5], 'tipo intervento: solo 1-4 nazionali più 5 «Altro»');

/* i menu della scheda cantiere offrono solo codici nazionali, con le parole della tabella */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const menu = (id) => {
  const m = html.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>'));
  assert.ok(m, 'menu ' + id + ' non trovato');
  return [...m[1].matchAll(/<option value="(\d+)">([^<]+)<\/option>/g)].map((x) => [+x[1], x[2]]);
};
for (const [k, v] of menu('mc-durata')) assert.strictEqual(NAZ.DURATA_LABELS[k], v, 'menu durata ' + k);
for (const [k, v] of menu('mc-tip-ope')) assert.strictEqual(NAZ.TIP_OPE_LABELS[k], v, 'menu tipo opera ' + k);
assert.strictEqual(menu('mc-tip-ope').length, 16, 'il menu del tipo opera ha tutte le 16 voci nazionali');

/* l'esportazione controlla gli stessi intervalli */
const oss = fs.readFileSync(path.join(__dirname, '..', 'osservatorio.js'), 'utf8');
assert.ok(/to<1\|\|to>16/.test(oss), 'esportazione: tipo opera 1-16');
assert.ok(/du<1\|\|du>7/.test(oss), 'esportazione: durata 1-7');

console.log('codifica-nazionale: ok');
