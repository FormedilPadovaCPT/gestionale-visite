// node test/visite-con-incarico.test.cjs
// (26/10/2026, deciso dall'utente) Le tipologie che nascono da un incarico — su segnalazione, cantiere qualità,
// visite in serie, stage/ASL, attestazione, progetto SPISAL — si chiudono solo con un incarico in essere.
// La serie è di 10 visite: finita, se l'impresa desidera continuare, va richiesta di nuovo.
// Il blocco sta in verbale_mancanze (database); la maschera lo dice mentre si compila.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_26_verbale_mancanze_incarico.sql'), 'utf8');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');
const aiuto = fs.readFileSync(path.join(radice, 'aiuto.js'), 'utf8');

/* il database: le sei tipologie, i quattro blocchi */
assert.ok(/if v\.tipo_accesso in \(1,6,8,9,11,12\) then/.test(sql), 'le tipologie con incarico sono 1, 6, 8, 9, 11, 12');
for (const cosa of ['incarico-mancante', 'incarico-chiuso', 'serie-senza-incarico', 'serie-completa'])
  assert.ok(sql.includes("'cosa','" + cosa + "'"), 'verbale_mancanze non controlla: ' + cosa);
assert.ok(/elsif inc\.stato = 'chiuso' then/.test(sql), 'un incarico chiuso non vale');
assert.ok(/if n >= inc\.previste then/.test(sql), 'la serie si ferma alle visite previste');
assert.ok(/public\.incarichi_previste\(i\.tipo_richiesta\)/.test(sql), 'le visite previste di una serie sono quelle di incarichi_previste (10)');
/* si contano le visite fatte PRIMA di questa: la decima chiude ancora, l'undicesima no */
assert.ok(/o\.data_visita < v\.data_visita or \(o\.data_visita = v\.data_visita and o\.created_at < v\.created_at\)/.test(sql));
assert.ok(/richiedere di nuovo il servizio/.test(sql), 'il testo dice che la serie finita va richiesta di nuovo');
/* la versione nuova non ha perso i controlli di prima */
for (const cosa of ['tipo-accesso', 'cantiere-comune', 'nc-senza-nota', 'doppione', 'email-impresa', 'osservazioni'])
  assert.ok(sql.includes("'cosa','" + cosa + "'"), 'la versione nuova ha perso il controllo: ' + cosa);

/* la maschera: stesso elenco del database */
const m = /const TIPI_CON_INCARICO=\{([^}]*)\}/.exec(html);
assert.ok(m, 'manca TIPI_CON_INCARICO');
const chiavi = [...m[1].matchAll(/(\d+):'/g)].map(x => +x[1]).sort((a, b) => a - b);
assert.deepStrictEqual(chiavi, [1, 6, 8, 9, 11, 12], 'la maschera e il database devono avere le stesse tipologie');
assert.ok(/if\(ev\.target&&ev\.target\.id==='f-tipo'\) incVerificaProt\(\)/.test(html), 'cambiare tipologia rifà il controllo');
assert.ok(/const _tInc=tipoChiedeIncarico\(\)/.test(html), 'il campo Protocollo interno avvisa');
assert.ok(/'f-tipo':/.test(aiuto), 'la nuvoletta della tipologia');

console.log('visite-con-incarico: ok');
