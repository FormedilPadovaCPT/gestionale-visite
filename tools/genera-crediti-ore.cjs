/* ============================================================
   Copia per il gestionale del conteggio dei crediti formativi (17/11/2026)

   Il conteggio (attestato di base, aggiornamenti a ore, quinquennio
   mobile del coordinatore, trienni del formatore) vive in UN posto:
   segreteria-app/js/doc-tecnici-ore.js. Il gestionale non usa moduli
   ES, quindi qui se ne fa una copia come script classico, crediti-ore.js.
   La copia non si scrive a mano: la rigenera questo strumento, e il test
   test/crediti-ore.test.cjs fallisce se la copia non e' allineata.

   node tools/genera-crediti-ore.cjs          rigenera crediti-ore.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const FONTE = path.join(__dirname, '..', '..', 'segreteria-app', 'js', 'doc-tecnici-ore.js');
const DEST = path.join(__dirname, '..', 'crediti-ore.js');

function genera() {
  const src = fs.readFileSync(FONTE, 'utf8').replace(/\r\n/g, '\n');
  const corpo = src.replace(/^export (function|const) /gm, '$1 ');
  return [
    '/* COPIA GENERATA da segreteria-app/js/doc-tecnici-ore.js con tools/genera-crediti-ore.cjs:',
    '   non modificare qui, modificare la fonte e rigenerare. */',
    '(function (radice) {',
    corpo.trimEnd(),
    '',
    '  const api = { statoConOre, dettaglioOre, requisitoAOre, aggiungiMesiIso, statoScadenza, testoScadenza };',
    '  radice.creditiOre = api;',
    "  if (typeof module !== 'undefined' && module.exports) module.exports = api;",
    "})(typeof window !== 'undefined' ? window : globalThis);",
    '',
  ].join('\n');
}

if (require.main === module) {
  fs.writeFileSync(DEST, genera());
  console.log('crediti-ore.js rigenerato da', path.relative(process.cwd(), FONTE));
}
module.exports = { genera, FONTE, DEST };
