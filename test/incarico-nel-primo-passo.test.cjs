// node test/incarico-nel-primo-passo.test.cjs
// La tendina degli incarichi sta nel primo passo del verbale e, scegliendo un incarico,
// compila impresa e cantiere (02/10/2026, chiesto dall'utente).
// Quello che questi controlli tengono fermo:
//   · quello che il tecnico ha già scelto non si sostituisce senza chiederglielo;
//   · lo stesso cantiere o la stessa impresa non fanno comparire nessuna domanda;
//   · l'accettazione si scrive solo se l'incarico è di chi compila (segreteria e
//     coordinatore vedono nella tendina gli incarichi di tutti).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

/* la funzione vera, estratta da index.html */
const m = html.match(/function incDecidi\(r,att\)\{[\s\S]*?\r?\n\}/);
assert.ok(m, 'incDecidi non trovata in index.html');
const incDecidi = Function(m[0] + '; return incDecidi')();

const INC = { id: 7, impresa_id: '01234567890', impresa: 'Rossi Costruzioni', cantiere_id: 'C1' };

// visita vuota: si compila tutto
assert.deepStrictEqual(incDecidi(INC, {}), { impresa: 'compila', cantiere: 'compila' });
// la visita ha già le stesse cose: nessuna domanda
assert.deepStrictEqual(incDecidi(INC, { impresa_id: '01234567890', impresa_nome: 'Rossi Costruzioni', cantiere_id: 'C1' }),
  { impresa: 'niente', cantiere: 'niente' });
// il tecnico aveva scelto altro: si chiede
assert.deepStrictEqual(incDecidi(INC, { impresa_id: '09999999999', impresa_nome: 'Bianchi', cantiere_id: 'C2' }),
  { impresa: 'chiedi', cantiere: 'chiedi' });
// stesso nome scritto a mano, senza anagrafica: si aggancia l'anagrafica senza chiedere
assert.strictEqual(incDecidi(INC, { impresa_nome: '  rossi   costruzioni ' }).impresa, 'compila');
// incarico col solo nome dell'impresa
assert.strictEqual(incDecidi({ id: 8, impresa: 'Verdi' }, {}).impresa, 'compila');
assert.strictEqual(incDecidi({ id: 8, impresa: 'Verdi' }, { impresa_nome: 'verdi' }).impresa, 'niente');
assert.strictEqual(incDecidi({ id: 8, impresa: 'Verdi' }, { impresa_id: '0111', impresa_nome: 'Neri' }).impresa, 'chiedi');
// incarico che non indica niente: non si tocca niente
assert.deepStrictEqual(incDecidi({ id: 9 }, { impresa_nome: 'Neri', cantiere_id: 'C2' }), { impresa: 'niente', cantiere: 'niente' });
assert.deepStrictEqual(incDecidi({ id: 9 }, {}), { impresa: 'niente', cantiere: 'niente' });
// cantiere non in archivio (le visite stage): si propone la scheda nuova, ma solo se la visita non ne ha già uno
assert.strictEqual(incDecidi({ id: 10, indirizzo: 'via Roma 3', comune: 'Padova' }, {}).cantiere, 'proponi');
assert.strictEqual(incDecidi({ id: 10, indirizzo: 'via Roma 3', comune: 'Padova' }, { cantiere_id: 'C2' }).cantiere, 'niente');

/* dove sta la tendina: nel primo passo, una volta sola, e non più nel passo Cantiere */
const tab0 = html.indexOf('data-tab="0"'), tab1 = html.indexOf('data-tab="1"');
const sel = html.indexOf('<select id="f-prot-inc"');
assert.ok(tab0 > 0 && tab1 > tab0, 'passi del verbale non trovati');
assert.ok(sel > tab0 && sel < tab1, 'la tendina degli incarichi deve stare nel primo passo');
assert.strictEqual((html.match(/id="f-prot-inc"/g) || []).length, 1, 'la tendina è una sola');
const prot = html.indexOf('id="f-prot-int"');
assert.ok(prot > tab1, 'il Protocollo interno resta nel passo Cantiere');

/* scegliere dalla tendina passa da incDaTendina, e «Nuova visita» dalla stessa strada */
assert.ok(/ev\.target\.id==='f-prot-inc'\)\{[\s\S]{0,400}incDaTendina\(ev\.target\.value\)/.test(html), 'la scelta deve chiamare incDaTendina');
const nv = html.match(/async function incNuovaVisita\(id,accetta\)\{[\s\S]*?\r?\n\}/);
assert.ok(nv && /incApplicaAllaVisita\(r\)/.test(nv[0]), '«Nuova visita» deve usare incApplicaAllaVisita');

/* l'accettazione solo sugli incarichi propri */
const dt = html.match(/async function incDaTendina\(id\)\{[\s\S]*?\r?\n\}/);
assert.ok(dt, 'incDaTendina non trovata');
assert.ok(/const mio=/.test(dt[0]) && /if\(mio&&!r\.accettato_il\)/.test(dt[0]), 'si accetta solo l’incarico di chi compila');
/* un errore di lettura non è «incarico senza dati»: si dice */
assert.ok(/if\(error\|\|!r\)\{[\s\S]{0,300}non sono riuscito a leggere/.test(dt[0]), 'la lettura fallita va detta');

console.log('ok — incarico nel primo passo');
