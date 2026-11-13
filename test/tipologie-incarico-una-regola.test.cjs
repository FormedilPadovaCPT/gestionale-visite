// (13/11/2026) LE TIPOLOGIE DI VISITA CHE CHIEDONO UN INCARICO sono scritte due volte:
// TIPI_CON_INCARICO in index.html (lo dice mentre si compila) e nella funzione
// verbale_mancanze del database (lo fa rispettare alla chiusura). Qui si controlla la copia
// del gestionale contro l'elenco del database, ricopiato da
// _SISTEMA/schema_db/gestionale_schema.sql il 13/11/2026; l'altra metà del confronto è
// segreteria-app/tests-db/51_regole_una_sola.sql, che legge la funzione viva.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DEL_DATABASE = [1, 6, 8, 9, 11, 12];

const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = index.match(/const TIPI_CON_INCARICO=(\{[^}]*\})/);
assert.ok(m, 'TIPI_CON_INCARICO non trovata in index.html');
const tipi = new Function('return ' + m[1])();
assert.deepStrictEqual(Object.keys(tipi).map(Number).sort((a, b) => a - b), DEL_DATABASE,
  'TIPI_CON_INCARICO non coincide con le tipologie che il database fa rispettare (verbale_mancanze)');

// e i file SQL del repo che ridefiniscono la funzione portano lo stesso elenco
const sql = path.join(__dirname, '..', 'supabase', 'sql');
let visti = 0;
for (const f of fs.readdirSync(sql).filter((n) => n.endsWith('.sql'))) {
  /* solo la condizione di verbale_mancanze («if v.tipo_accesso in (…)»): altri elenchi di tipologie,
     per altre regole (le visite fuori procedura), non c'entrano */
  for (const x of fs.readFileSync(path.join(sql, f), 'utf8').matchAll(/if\s+v\.tipo_accesso\s+in\s*\(([0-9,\s]+)\)/g)) {
    visti++;
    assert.deepStrictEqual(x[1].split(',').map((n) => Number(n.trim())), DEL_DATABASE, f + ': elenco diverso');
  }
}
assert.ok(visti >= 1, 'nessun file SQL con l\'elenco delle tipologie: la prova non sta guardando niente');
console.log('tipologie-incarico-una-regola: ' + Object.keys(tipi).length + ' tipologie, uguali nel gestionale e in ' + visti + ' definizioni SQL');
