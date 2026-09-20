// node test/riepilogo-verbali.test.cjs
const assert = require('assert');
const { analizza } = require('../controllo-verbale.js');
const { riepiloga, mesePredefinito, ultimoGiorno } = require('../riepilogo-verbali.js');

const OGGI = '2026-09-20';
const v = (o) => ({ visita_id: 1, nr_verbale: 'CPT/25_26/0001', data_visita: '2026-09-10', acc_cant: '1', tecnico_id: 'T1', cantiere_id: 'C1', impresa_id: 'I1', ...o });

/* un verbale pulito non compare */
{
  const r = riepiloga([v({ oss_tec: 'Cantiere in fase di getto.' })], [], {}, analizza, OGGI);
  assert.strictEqual(r.esaminati, 1);
  assert.deepStrictEqual(r.daSistemare, []);
}

/* una NC senza nota compare, con il testo dell'avviso */
{
  const visite = [v({ visita_id: 2, nr_verbale: 'CPT/25_26/0002', data_ritorno: '2026-09-13' })];
  const chk = [{ visita_id: 2, codice: '3.1', valore: 'NC+', nota: null }];
  const r = riepiloga(visite, chk, { '3.1': 'Parapetti' }, analizza, OGGI);
  assert.strictEqual(r.daSistemare.length, 1);
  assert.ok(r.daSistemare[0].avvisi.some((a) => a.chi === 'nc-senza-nota'));
  assert.ok(r.daSistemare[0].avvisi.some((a) => /Parapetti/.test(a.testo)), 'usa la descrizione della voce, non il codice');
}

/* la nota di gruppo (…_N) conta come nota: niente avviso */
{
  const chk = [{ visita_id: 1, codice: 'DOC_GEN_004', valore: 'NC-', nota: null },
    { visita_id: 1, codice: 'DOC_GEN_N', valore: null, nota: 'Non presente il POS' }];
  const r = riepiloga([v({ data_ritorno: '2026-09-13' })], chk, {}, analizza, OGGI);
  assert.deepStrictEqual(r.daSistemare, []);
}

/* due verbali lo stesso giorno, stesso cantiere e stesso tecnico: si vede dal lotto,
   senza interrogare di nuovo il database */
{
  const visite = [v({ visita_id: 1, nr_verbale: 'A' }), v({ visita_id: 2, nr_verbale: 'B' })];
  const r = riepiloga(visite, [], {}, analizza, OGGI);
  assert.strictEqual(r.daSistemare.length, 2, 'entrambi segnalati');
  assert.ok(JSON.stringify(r.daSistemare).includes('doppione') || JSON.stringify(r.daSistemare).includes('lotto'));
}
/* tecnici diversi nello stesso giorno sono normali: nessun avviso */
{
  const visite = [v({ visita_id: 1, nr_verbale: 'A' }), v({ visita_id: 2, nr_verbale: 'B', tecnico_id: 'T2' })];
  assert.deepStrictEqual(riepiloga(visite, [], {}, analizza, OGGI).daSistemare, []);
}

/* l'ordine è per numero di verbale, non per tecnico */
{
  const visite = [
    v({ visita_id: 1, nr_verbale: 'CPT/25_26/0010', tecnico_id: 'T2', qual_ppre: 'Titolare' }),
    v({ visita_id: 2, nr_verbale: 'CPT/25_26/0002', tecnico_id: 'T1', qual_ppre: 'Titolare' }),
  ];
  const r = riepiloga(visite, [], {}, analizza, OGGI);
  assert.deepStrictEqual(r.daSistemare.map((x) => x.visita.nr_verbale), ['CPT/25_26/0002', 'CPT/25_26/0010']);
}

/* REGRESSIONE, la regola che tiene lo strumento dalla parte giusta:
   l'esito è per verbale e non contiene nessuna aggregazione per persona */
{
  const visite = [v({ visita_id: 1, qual_ppre: 'Titolare' }), v({ visita_id: 2, nr_verbale: 'X', cantiere_id: 'C2', qual_ppre: 'Titolare' })];
  const r = riepiloga(visite, [], {}, analizza, OGGI);
  assert.deepStrictEqual(Object.keys(r).sort(), ['daSistemare', 'esaminati']);
  for (const x of r.daSistemare) assert.deepStrictEqual(Object.keys(x).sort(), ['avvisi', 'visita']);
  const testo = JSON.stringify(r);
  assert.ok(!/punteggio|classifica|per_tecnico|totaleTecnico/i.test(testo), 'nessun punteggio o totale per tecnico');
}

/* un errore su un verbale non fa saltare il riepilogo degli altri */
{
  const rotto = () => { throw new Error('boom'); };
  const r = riepiloga([v({})], [], {}, rotto, OGGI);
  assert.strictEqual(r.daSistemare.length, 1);
  assert.ok(/Non sono riuscito a controllare/.test(r.daSistemare[0].avvisi[0].testo));
}

/* il mese predefinito è quello chiuso, e l'ultimo giorno è giusto anche a febbraio */
{
  assert.ok(/^\d{4}-\d{2}$/.test(mesePredefinito()));
  assert.strictEqual(ultimoGiorno('2026-02'), '2026-02-28');
  assert.strictEqual(ultimoGiorno('2024-02'), '2024-02-29');
  assert.strictEqual(ultimoGiorno('2026-09'), '2026-09-30');
}

console.log('riepilogo-verbali: tutti i controlli passati');
