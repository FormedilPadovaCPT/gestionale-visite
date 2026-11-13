// (13/11/2026) ALL'INVIO, OGNI DATO È DEL VERBALE CHE PARTE.
// La finestra d'invio tiene il suo stato in variabili condivise (window._ev*). Reinvio,
// valutazione e «stessa versione» erano già confrontati col verbale in partenza; rettifica,
// formazione mancante e proposta di serie no: erano le uniche tre cose lette senza
// chiedersi di quale verbale fossero. Ora portano il verbale a cui appartengono e la
// spedizione le usa solo se coincide. Qui si controlla che:
//  1. nella spedizione non resti nessuna lettura diretta di quelle tre variabili;
//  2. le righe che le filtrano facciano davvero quello che dicono (eseguite con dati finti);
//  3. chi le scrive ci metta sempre il verbale.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

const ini = index.indexOf("$('btn-ev-invia').onclick=async()=>{");
const fin = index.indexOf('    window._evReinvio=null\n    window._evRettifica=null\n    window._evStessaVersione=null;window._evValutazione=null', ini);
assert.ok(ini > 0 && fin > ini, 'la spedizione del verbale non è stata trovata (è stata spostata o rinominata?)');
const spedizione = index.slice(ini, fin);

// 1. le tre variabili compaiono SOLO nelle righe che le filtrano per verbale
const righeFiltro = spedizione.split('\n').filter((r) => /^\s*const _(rettX|formX|serie)=/.test(r));
assert.strictEqual(righeFiltro.length, 3, 'mancano le tre righe che filtrano rettifica, formazione e serie per verbale');
const senzaFiltro = spedizione.split('\n').filter((r) => !/^\s*const _(rettX|formX|serie)=/.test(r)).join('\n');
for (const v of ['window._evRettifica', 'window._evFormazione', 'window._evSerie']) {
  assert.ok(!senzaFiltro.includes(v), 'nella spedizione c\'è una lettura diretta di ' + v + ': deve passare da _rett, _form o _serie');
}

// 2. le righe di filtro, eseguite: con il verbale giusto passano, con un altro no
const blocco = spedizione.split('\n').filter((r) => /^\s*const _(rettX|rett|formX|form|serie)=/.test(r)).join('\n');
const prova = (window, vid) => new Function('window', 'vid', blocco + '\nreturn { _rett, _form, _serie };')(window, vid);
const pieno = () => ({
  _evRettifica: { vid: 'A', modifiche: ['x'], note: 'n', dataPrimoInvio: '01/11/2026' },
  _evFormazione: { _vid: 'A', sn: true, tipi: ['ponteggi'] },
  _evSerie: true, _evSerieVid: 'A',
});
let r = prova(pieno(), 'A');
assert.deepStrictEqual(r._rett, { modifiche: ['x'], note: 'n', dataPrimoInvio: '01/11/2026' }, 'la rettifica del verbale giusto deve passare, senza il campo di servizio');
assert.deepStrictEqual(r._form, { sn: true, tipi: ['ponteggi'] }, 'la formazione del verbale giusto deve passare, senza il campo di servizio');
assert.strictEqual(r._serie, true);
r = prova(pieno(), 'B');
assert.strictEqual(r._rett, null, 'la rettifica di un ALTRO verbale non deve passare');
assert.strictEqual(r._form, null, 'la formazione di un ALTRO verbale non deve passare');
assert.strictEqual(r._serie, false, 'la proposta di serie di un ALTRO verbale non deve passare');
r = prova({ _evRettifica: null, _evFormazione: null, _evSerie: null }, 'A');
assert.deepStrictEqual(r, { _rett: null, _form: null, _serie: false });
// dati scritti senza proprietario (com'era prima): non passano
r = prova({ _evRettifica: { modifiche: [] }, _evFormazione: { sn: true }, _evSerie: true }, 'A');
assert.deepStrictEqual(r, { _rett: null, _form: null, _serie: false }, 'un dato senza il suo verbale non deve passare');

// 3. chi scrive, scrive anche il verbale
assert.ok(/window\._evRettifica=\{\n\s*vid:p\.vid,/.test(index), 'la rettifica deve nascere col suo verbale (vid:p.vid)');
const scrittureSerie = index.match(/window\._evSerie=!!/g) || [];
const proprietariSerie = index.match(/window\._evSerieVid=[^=]/g) || [];
assert.strictEqual(proprietariSerie.length, scrittureSerie.length, 'ogni scrittura di _evSerie deve essere seguita dal suo verbale (_evSerieVid)');
assert.ok(index.includes('if(window._evFormazione)window._evFormazione._vid=vid'), 'dall\'elenco, la formazione deve prendere il suo verbale');
assert.ok(index.includes('if(window._evFormazione)window._evFormazione._vid=_vidForm'), 'dal modulo, la formazione deve prendere il suo verbale');
assert.ok(index.includes('if(window._evContext&&window._evContext.vid!==_vidForm)return'), 'il calcolo in ritardo non deve scrivere sulla finestra di un altro verbale');

// l'archivio del PDF prende numero e data dal verbale in invio, prima che dalla maschera
assert.ok(spedizione.includes("nr_verbale: window._evContext?.nr_verbale||vGet('f-verbale')"), 'upload-pdf: prima il verbale in invio, poi la maschera');
console.log('invio-dati-del-verbale: rettifica, formazione e serie filtrate per verbale');
