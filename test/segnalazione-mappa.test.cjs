// node test/segnalazione-mappa.test.cjs
// (12/10/2026, chiesto dall'utente) «Segnala un cantiere»: il cantiere si vede anche dalla strada, a
// qualche chilometro, e il GPS dava la posizione del tecnico. Nel modulo c'è una mappa col segnaposto
// trascinabile (o si tocca la mappa); senza GPS — dal PC — si segna lo stesso. Si salva la posizione del
// cantiere in lat/lng, da dove viene (posizione_da) e dov'era il tecnico (gps_lat/gps_lng).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(process.env.INDEX_HTML || path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<div id="segn-mappa" style="height:240px/.test(html), 'nel modulo c’è la mappa');
assert.ok(/id="segn-qui"/.test(html), 'c’è «Torna dove sono»');
assert.ok(/L\.marker\(\[lat,lng\],\{draggable:true/.test(html), 'il segnaposto si trascina');
assert.ok(/_segnPin\.on\('dragend',\(\)=>\{const q=_segnPin\.getLatLng\(\);_segnPos=\{lat:q\.lat,lng:q\.lng,acc:null,da:'mappa'\}/.test(html), 'trascinato = posizione scelta sulla mappa');
assert.ok(/_segnMap\.on\('click',e=>_segnMetti\(e\.latlng\.lat,e\.latlng\.lng,'mappa'\)\)/.test(html), 'si può anche toccare la mappa');
assert.ok(/invalidateSize\(\)/.test(html), 'la mappa nella finestra si ridimensiona dopo l’apertura');
assert.ok(/if\(!_segnPos\)_segnMetti\(_segnGps\.lat,_segnGps\.lng,'gps'\);else _segnScrivi\(\)/.test(html), 'se il tecnico ha già toccato la mappa, il GPS arrivato dopo non gli sposta il punto');
assert.ok(/_segnGps=false;_segnScrivi\(\)/.test(html) && /tocca la mappa<\/b> sul cantiere per segnalarlo/.test(html), 'senza GPS (dal PC) si segna toccando la mappa');
/* il salvataggio */
assert.ok(/accuracy_m:_segnPos\.da==='mappa'\?null:Math\.round\(_segnPos\.acc\|\|0\)/.test(html), 'un punto scelto a mano non porta la precisione del GPS');
assert.ok(/posizione_da:_segnPos\.da==='mappa'\?'mappa':'gps'/.test(html), 'si salva da dove viene la posizione');
assert.ok(/gps_lat:_segnGps\?_segnGps\.lat:null,gps_lng:_segnGps\?_segnGps\.lng:null/.test(html), 'si salva dov’era il tecnico');
/* nella mappa dei cantieri */
assert.ok(/s\.posizione_da==='mappa'\?'<span style="color:#999;font-size:11px">posizione scelta sulla mappa da chi ha segnalato'/.test(html), 'il fumetto dice che il punto è stato scelto a mano');

console.log('segnalazione-mappa: ok');
