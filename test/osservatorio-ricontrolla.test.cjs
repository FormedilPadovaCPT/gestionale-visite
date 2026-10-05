// node test/osservatorio-ricontrolla.test.cjs
// (05/10/2026) Aprendo la scheda di un cantiere dal controllo per l'Osservatorio, al salvataggio il
// controllo si rifà da solo e il cantiere sistemato esce dall'elenco (prima bisognava ripremere
// «Controlla», e l'utente si aspettava che sparisse). Solo per QUEL cantiere: una scheda aperta da
// un'altra parte non fa ripartire il controllo.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const oss = fs.readFileSync(path.join(radice, 'osservatorio.js'), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

assert.ok(/if\(b\.dataset\.ossCant\)\{if\(typeof window\.admEditCantiere==='function'\)\{window\._ossRicontrolla=b\.dataset\.ossCant;window\._mcGeoFrom=null;window\.admEditCantiere\(b\.dataset\.ossCant\)\}return\}/.test(oss),
  'il pulsante «Scheda» dell\'elenco si segna quale cantiere ricontrollare');
assert.ok(!/premi di nuovo «🔎 Controlla»/.test(oss), 'il testo non chiede più di ripremere Controlla dopo una scheda');

/* il ramo di aggiornamento del cantiere, eseguito con un finto ambiente */
const ramo = html.match(/    const _salvato=window\._editCantId\n[\s\S]*?    else if\(typeof admLoadCantieri==='function'\)admLoadCantieri\(\)\n/);
assert.ok(ramo, 'manca il ramo di salvataggio con _salvato');
function esegui(ricontrolla, aperto) {
  const chiamate = [];
  const window = { _editCantId: aperto, _ossRicontrolla: ricontrolla, _mcGeoFrom: null, admOssControlla: () => chiamate.push('controlla') };
  const $ = () => ({ textContent: '' });
  new Function('window', '$', 'admLoadCantieri', 'loadDashMap', 'loadCantMap', ramo[0])(window, $, () => chiamate.push('lista'), () => {}, () => {});
  return { chiamate, window };
}
let r = esegui('C1', 'C1');
assert.deepStrictEqual(r.chiamate, ['controlla'], 'scheda aperta dall\'elenco: il controllo si rifà');
assert.strictEqual(r.window._ossRicontrolla, null, 'e il segno si toglie');
r = esegui('C1', 'C2');
assert.deepStrictEqual(r.chiamate, ['lista'], 'un altro cantiere: niente controllo, si fa quello di sempre');
r = esegui(null, 'C2');
assert.deepStrictEqual(r.chiamate, ['lista']);

console.log('osservatorio-ricontrolla: ok');
