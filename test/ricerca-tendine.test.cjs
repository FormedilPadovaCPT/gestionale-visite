// node test/ricerca-tendine.test.cjs
// (03/10/2026) Le tendine di ricerca del verbale (imprese, committenti) non devono tagliare la lista in silenzio.
// Caso vero: con «basso» le imprese sono 37, la tendina ne mostrava 20 in ordine alfabetico e
// «Impresa di costruzioni geom. Giovanni Carlo Basso», la 32ª, non compariva mai.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// la funzione che taglia, provata davvero
const m = html.match(/const AC_MAX=(\d+)\s+function _acTaglia\(items\)\{[^\n]+\}/);
assert.ok(m, 'non trovo AC_MAX e _acTaglia');
const { AC_MAX, _acTaglia } = new Function(m[0] + '; return { AC_MAX, _acTaglia };')();
assert.ok(AC_MAX >= 50, 'la tendina deve mostrare almeno 50 righe');
const pochi = _acTaglia(Array.from({ length: 37 }, (_, i) => i));
assert.strictEqual(pochi.length, 37); assert.ok(!pochi.troppi, '37 righe ci stanno tutte: nessun avviso');
const tanti = _acTaglia(Array.from({ length: AC_MAX + 1 }, (_, i) => i));
assert.strictEqual(tanti.length, AC_MAX); assert.strictEqual(tanti.troppi, true, 'oltre il tetto la lista si taglia e lo dice');

// le tre tendine chiedono una riga in più del tetto (serve a sapere che ce ne sono altre) e passano da _acTaglia
assert.strictEqual((html.match(/\.limit\(AC_MAX\+1\)/g) || []).length, 3, 'imprese e i due campi del committente devono usare AC_MAX+1');
assert.strictEqual((html.match(/return _acTaglia\(/g) || []).length, 3);
assert.ok(!/from\('imprese'\)[^\n]*\.limit\(20\)/.test(html) && !/from\('committenti'\)[^\n]*order\('committente_nome'\)\.limit\(20\)/.test(html), 'il tetto di 20 non deve tornare');
// le imprese si cercano parola per parola, come i committenti
assert.ok(html.includes("if(q)qb=_perParole(qb,q,['impresa_nome','impresa_cf','piva'])"), '«basso giovanni» deve trovare «…GIOVANNI CARLO BASSO»');
// la tendina dice quando ce ne sono altre, e una ricerca fallita non è «nessun risultato»
assert.ok(html.includes("items.troppi?'<div class=\"ac-nota\">Ce ne sono altre"), 'la lista tagliata deve dirlo');
assert.ok(html.includes("try{items=await fetchFn(q)}catch(e){") && html.includes('Non sono riuscito a cercare ('), 'una ricerca fallita si dice');
assert.strictEqual((html.match(/const\{data,error\}=await qb\s+if\(error\)throw new Error\(error\.message\)\s+return _acTaglia/g) || []).length, 3, 'le tre ricerche devono leggere l’errore');
console.log('ricerca-tendine: ok');
