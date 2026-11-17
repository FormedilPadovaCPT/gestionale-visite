// Crediti formativi nel gestionale (17/11/2026): la copia del conteggio deve essere
// quella generata dalla fonte della segreteria, e il riquadro deve calcolare come lei.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { genera, FONTE, DEST } = require('../tools/genera-crediti-ore.cjs');
// La fonte sta nel repo della segreteria: su GitHub (pubblicazione) non c'è, e i due
// confronti si fanno solo sul PC, dove i due repo stanno uno accanto all'altro.
const SENZA_FONTE = fs.existsSync(FONTE) ? false : 'fonte della segreteria non presente (GitHub)';

test('crediti-ore.js è la copia generata da segreteria-app/js/doc-tecnici-ore.js', { skip: SENZA_FONTE }, () => {
  const attuale = fs.readFileSync(DEST, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(attuale, genera(), 'copia non allineata: lancia node tools/genera-crediti-ore.cjs');
});

test('il riquadro calcola come la segreteria (stessi dati, stesso esito)', { skip: SENZA_FONTE }, async () => {
  globalThis.creditiOre = require('../crediti-ore.js');
  const { calcola } = require('../crediti-formativi.js');
  const fonte = await import(require('url').pathToFileURL(path.join(__dirname, '..', '..', 'segreteria-app', 'js', 'doc-tecnici-ore.js')).href);
  const req = [
    { id: 5, codice: 'corso_120h', descrizione: 'Corso 120 ore' },
    { id: 6, codice: 'agg_coordinatore', descrizione: 'Agg. coord.', ore_soglia: 40, durata_mesi: 60, preavviso_giorni: 180, periodo_mobile: true, decadenza_mesi: 120, origine_requisito_id: 5 },
    { id: 8, codice: 'formatori', descrizione: 'Formatori', ore_soglia: 24, ore_soglia_corsi: 8, durata_mesi: 36, preavviso_giorni: 180, docenza_alternativa: true, recupero_ore: true },
  ];
  const doc = [
    { tecnico_id: 'T1', requisito_id: 5, data_inizio: '2015-01-31' },
    { tecnico_id: 'T1', requisito_id: 6, tipo: 'aggiornamento', data_inizio: '2023-05-01', ore: 24 },
    { tecnico_id: 'T1', requisito_id: 8, tipo: 'attestato', data_inizio: '2016-01-17' },
  ];
  const [x] = calcola({ requisiti: req, tecnici: [{ tecnico_id: 'T1' }], documenti: doc });
  const oggi = new Date().toLocaleDateString('sv-SE');
  const coord = fonte.statoConOre(req[1], doc.filter((d) => d.requisito_id === 6), oggi, doc.filter((d) => d.requisito_id === 5));
  const form = fonte.statoConOre(req[2], doc.filter((d) => d.requisito_id === 8), oggi);
  assert.equal(x.voci.length, 2, 'solo i requisiti a ore');
  assert.equal(x.voci[0].s.classe, coord.classe);
  assert.equal(x.voci[0].s.scadenza, coord.scadenza);
  assert.equal(x.voci[1].s.classe, form.classe);
  assert.equal(x.voci[1].s.scadenza, form.scadenza);
});

test('senza documenti il requisito è «mancante», non in regola', () => {
  globalThis.creditiOre = require('../crediti-ore.js');
  const { stato } = require('../crediti-formativi.js');
  assert.equal(stato({ ore_soglia: 24, durata_mesi: 36 }, [], [], '2026-11-17').classe, 'mancante');
});
