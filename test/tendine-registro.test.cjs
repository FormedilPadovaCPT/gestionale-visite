// Ogni tendina che scrive dati è registrata, con le voci che ha nel codice, e due tendine
// sulla stessa colonna (anche di app diverse) hanno le stesse voci (04/10/2026: il CCNL a
// codici del gestionale contro il CCNL a parole della segreteria). Vedi tools/tendine.cjs.
const assert = require('assert');
const { controlla } = require('../tools/tendine.cjs');
const errori = controlla();
assert.deepStrictEqual(errori, [], '\n' + errori.join('\n'));
console.log('ok tendine-registro');
