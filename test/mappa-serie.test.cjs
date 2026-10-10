// node test/mappa-serie.test.cjs
// (10/10/2026, chiesto dall'utente) Sulla mappa «Cantieri in monitoraggio» della pagina Oggi i cantieri con una serie
// di visite attiva hanno un anello arancione che pulsa; in legenda «cantiere con serie di visite attiva».
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.ok(html.includes('<span class="dm-serie-leg"></span> cantiere con serie di visite attiva</span>'), 'la voce in legenda, con le parole dell’utente');
assert.ok(/@keyframes dmSerie\{/.test(html) && /prefers-reduced-motion:reduce\)\{\.dm-serie span/.test(html), 'l’anello pulsa, e sta fermo per chi ha chiesto meno animazioni');
// la serie attiva: incarico con più visite previste, «aperto», non chiuso
assert.ok(/\.gt\('visite_previste',1\)\.eq\('stato','aperto'\)\.is\('chiuso_il',null\)/.test(html), 'quali serie sono attive');
// i cantieri della serie vengono dalle visite fatte per lei, non dall'impresa
assert.ok(/sb\.from\('visite'\)\.select\('cantiere_id,incarico_id,stato,elimina'\)\.in\('incarico_id',ids\)/.test(html), 'cantieri dalle visite della serie');
assert.ok(/v\.stato==='bozza'\|\|\+v\.elimina\)return/.test(html), 'bozze e visite eliminate non contano');
// lettura fallita: lo si dice, la spunta si spegne
assert.ok(/_dashMapSerieErr\?'non lette':_nSerie/.test(html) && /_dashMapSerieErr=true/.test(html), 'se le serie non si leggono, la mappa lo dice');
assert.ok(/if\(_dashMapSoloSerie&&!ser\)return/.test(html), 'la spunta «Solo serie attive» filtra');
assert.ok(/pane:'dmSerie',interactive:false/.test(html) && /createPane\('dmSerie'\);_ps\.style\.zIndex=390/.test(html), 'l’anello sta sotto il pallino e non ruba il tocco');
assert.ok(/Serie di visite:<\/b> '\+\(s\.visite_fatte\|\|0\)\+' di '\+s\.visite_previste/.test(html), 'nel riquadro «Serie di visite: 4 di 10 – impresa»');

// il raggruppamento: una visita in bozza o eliminata non accende il cantiere, due visite della stessa serie lo contano una volta
{
  const m = /_dashMapSerie=\{\};_dashMapSerieErr=false\r?\n  try\{([\s\S]*?)\r?\n  \}catch\(eSer\)/.exec(html);
  assert.ok(m, 'blocco di lettura delle serie trovato');
  const ser = [{ id: 7, impresa: 'ROSSI', visite_fatte: 2, visite_previste: 10 }, { id: 8, impresa: 'BIANCHI', visite_fatte: 1, visite_previste: 5 }];
  const vis = [{ cantiere_id: 1, incarico_id: 7, stato: 'definitivo', elimina: 0 }, { cantiere_id: 1, incarico_id: 7, stato: 'definitivo', elimina: null },
    { cantiere_id: 2, incarico_id: 7, stato: 'bozza', elimina: 0 }, { cantiere_id: 3, incarico_id: 8, stato: 'definitivo', elimina: true },
    { cantiere_id: 4, incarico_id: 8, stato: 'definitivo', elimina: false }];
  const q = (dati) => { const o = { select: () => o, gt: () => o, eq: () => o, is: () => o, in: () => o, then: (r) => r({ data: dati, error: null }) }; return o; };
  const sb = { from: (t) => q(t === 'incarichi' ? ser : vis) };
  const ctx = { _dashMapSerie: {} };
  const corpo = m[1].replace(/_dashMapSerie/g, 'ctx._dashMapSerie');
  return new Function('sb', 'ctx', '"use strict";return (async()=>{' + corpo + '})()')(sb, ctx).then(() => {
    assert.deepStrictEqual(Object.keys(ctx._dashMapSerie).sort(), ['1', '4'], 'si accendono solo i cantieri 1 e 4');
    assert.strictEqual(ctx._dashMapSerie[1].length, 1, 'due visite della stessa serie: una riga sola');
    assert.strictEqual(ctx._dashMapSerie[4][0].impresa, 'BIANCHI');
    console.log('ok — serie di visite sulla mappa dei cantieri in monitoraggio');
  });
}
