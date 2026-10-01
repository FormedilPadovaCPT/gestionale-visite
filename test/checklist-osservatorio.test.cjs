// Checklist → Osservatorio: la voce «Ponteggi fissi – partenze ristrette» (01/10/2026).
// Il modulo l'aveva, la checklist del gestionale no: 121 risposte non erano mai entrate, e con loro
// una NC+ (verbale 23_24/0434, rimasto «nessun rilievo») e due osservazioni. Aggiunta come OPE_POF_022;
// all'Osservatorio va col codice 231, quello che mancava fra «raddoppio dei montanti» (230) e
// «verifica consistenza muraria» (232), nell'ordine delle voci del modulo.
// Uso: node test/checklist-osservatorio.test.cjs
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const js = fs.readFileSync(path.join(__dirname, '..', 'osservatorio.js'), 'utf8')
const m = js.match(/const CHK2OSS=(\{[^}]*\})/)
assert.ok(m, 'non trovo la tabella CHK2OSS in osservatorio.js')
const T = JSON.parse(m[1])

assert.strictEqual(T.OPE_POF_022, 231, 'la voce «partenze ristrette» non arriva all\'Osservatorio')
assert.strictEqual(T.OPE_POF_016, 230)
assert.strictEqual(T.OPE_POF_017, 232)
const stessi = Object.entries(T).filter(([, id]) => id === 231).map(([c]) => c)
assert.deepStrictEqual(stessi, ['OPE_POF_022'], 'il codice 231 è usato da più voci: ' + stessi.join(', '))

console.log('ok — la voce «partenze ristrette» (OPE_POF_022) va all\'Osservatorio col codice 231')
