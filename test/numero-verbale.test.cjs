// node test/numero-verbale.test.cjs
// Il numero del verbale: l'esercizio lo decide la DATA DELLA VISITA, e il salvataggio
// non deve mai aggiornare «per numero» un verbale proposto dall'app (19/09/2026).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// la funzione vive dentro index.html: la si estrae e la si prova da sola
const m = html.match(/function prefissoVerbale\(dataISO\)\{[\s\S]*?\n\}/);
assert.ok(m, 'prefissoVerbale non trovata in index.html');
const prefissoVerbale = new Function('today', m[0] + '; return prefissoVerbale;')(() => '2026-09-19');

assert.strictEqual(prefissoVerbale('2026-09-30'), 'CPT/25_26/');   // ultimo giorno dell'esercizio
assert.strictEqual(prefissoVerbale('2026-10-01'), 'CPT/26_27/');   // primo giorno del nuovo
assert.strictEqual(prefissoVerbale('2027-09-30'), 'CPT/26_27/');
assert.strictEqual(prefissoVerbale('2025-10-01'), 'CPT/25_26/');
assert.strictEqual(prefissoVerbale(''), 'CPT/25_26/');             // senza data vale oggi
assert.strictEqual(prefissoVerbale('30/09/2026'), 'CPT/25_26/');   // formato non ISO: vale oggi, non un numero a caso

// il numero si chiede sulla data della visita, mai senza argomento
assert.ok(!/nextVerbale\(\)/.test(html), 'nextVerbale() chiamata senza la data della visita');
assert.ok(/nextVerbale\(data_v\)/.test(html), 'al salvataggio il numero va preso sulla data della visita');

// l'aggiornamento «per numero» e' ammesso solo se il numero non l'ha proposto l'app
assert.ok(/\(nrv&&!S\.nrAuto\)\?await sb\.from\('visite'\)\.select\('visita_id'\)\.eq\('nr_verbale',nrv\)/.test(html),
  'il ramo che aggiorna per numero deve essere escluso quando S.nrAuto e\' vero');

// una visita «ripartita da tutti i dati» non deve ereditare il numero del verbale di partenza
assert.ok(/if\(snap\.nr_verbale_origine&&\(snap\.visita_id\|\|snap\._tieniNumero\)\)/.test(html),
  'applySnap deve tenere il numero d\'origine solo per la stessa visita o per un import voluto');

console.log('numero-verbale: ok');
