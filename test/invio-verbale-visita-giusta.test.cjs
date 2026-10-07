// node test/invio-verbale-visita-giusta.test.cjs
// (07/10/2026, ERRORE GRAVE) Caon ha salvato e inviato il verbale 0012 (Arianna) e poi, dall'elenco, ha inviato lo 0011
// (Baraldo): la mail aveva oggetto e destinatari di Baraldo ma il PDF di Arianna, perché il pulsante «Invia» prendeva la
// visita rimasta aperta nella maschera (S.savedId) invece di quella per cui si era aperta la finestra (_evContext.vid).
// Ora: la visita è solo _evContext.vid, e prima di generare il PDF il suo numero deve coincidere con quello della mail.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

const i = html.indexOf("$('btn-ev-invia').onclick=async()=>{");
assert.ok(i > 0, 'il gestore del pulsante Invia');
const corpo = html.slice(i, html.indexOf('const pdfDataUri=await genPDF(vid', i));
assert.ok(/const vid=window\._evContext\?\.vid\|\|null/.test(corpo), 'la visita è quella della finestra aperta');
assert.ok(!/S\.savedId\|\|S\.fd\?\.visita_id\|\|window\._evContext\?\.vid/.test(corpo), 'mai più la visita rimasta aperta nella maschera');
assert.ok(/from\('visite'\)\.select\('visita_id,nr_verbale'\)\.eq\('visita_id',vid\)/.test(corpo), 'si legge il numero del verbale da allegare');
assert.ok(/String\(_vChk\.nr_verbale\|\|''\)\.trim\(\)!==_nrMail/.test(corpo) && /Invio FERMATO/.test(corpo), 'se non coincide con la mail, non parte');
assert.ok(/if\(_eChk\|\|!_vChk\)\{toast\('Non sono riuscito a controllare/.test(corpo), 'se il controllo non riesce, non parte');
/* le due finestre d'invio mettono nel contesto visita e numero dello stesso verbale */
assert.ok(/window\._evContext=\{vid,nr_verbale:_eNr,/.test(html) && /const _eNr=v\.nr_verbale\|\|''/.test(html), 'dall\'elenco: visita e numero dalla stessa riga');
console.log('ok invio-verbale-visita-giusta');
