// node test/verbale-tipo-accesso.test.cjs
// Che cosa legge l'impresa alla voce «Tipologia visita» del verbale.
const assert = require('assert');
const VerbalePDF = require('../verbale-pdf.js');

const visita = (tipo) => ({
  visita_id: 'x', nr_verbale: 'CPT/26_27/0001', data_visita: '2026-10-02', acc_cant: '1', tipo_accesso: tipo,
  tecnici: { tecnico_nome: 'Mario', tecnico_cognome: 'Rossi', email: 'm.rossi@esempio.example' },
  cantieri: { cantiere_indirizzo: 'via di Prova 1', comune_nome: 'PADOVA' },
  imprese: { impresa_nome: 'EDILPROVA' },
});
const tipoSulVerbale = (tipo) => VerbalePDF.prepara({ v: visita(tipo), imps: [], chk: [], lavs: [], voci: [], tec2: null, rettBanner: null }).tipoAcc;

/* la segnalazione è un dato dell'ufficio: all'impresa non si dice */
assert.strictEqual(tipoSulVerbale(1), 'Indicata dal CPT');
assert.strictEqual(tipoSulVerbale(7), 'Indicata dal CPT');

/* gli altri tipi escono col loro nome */
assert.strictEqual(tipoSulVerbale(2), 'Su richiesta');
assert.strictEqual(tipoSulVerbale(5), 'Programmata');
assert.strictEqual(tipoSulVerbale(8), 'Adesione servizio visite in serie');
assert.strictEqual(tipoSulVerbale(null), '–');
assert.strictEqual(tipoSulVerbale(11), 'Attestazione / consulenza e monitoraggio');
assert.strictEqual(tipoSulVerbale(12), 'Progetto SPISAL');

/* in nessun caso la parola «segnalazione» finisce sul foglio */
for (let t = 1; t <= 12; t++) assert.ok(!/segnalazion/i.test(tipoSulVerbale(t)), `tipo ${t}`);

console.log('verbale-tipo-accesso: ok');
