// node test/invio-verbale-solo-definitivo.test.cjs
// (06/11/2026, chiesto dall'utente) Una bozza non si manda all'impresa. Il pulsante «📧 Invia verbale» compariva
// dopo qualunque salvataggio, anche «Salva bozza» o un «Definitivo» rifiutato per mancanze, e nessun passaggio
// guardava lo stato: il 06/11 quattro bozze (0075, 0077, 0078, 0079) sono partite all'impresa e in archivio.
// Ora lo fermano quattro punti: pulsante della maschera, busta dell'elenco, apertura dall'elenco, «Invia ora»
// (stato letto dal database), e la funzione upload-pdf, che rifiuta una bozza.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radice = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const up = fs.readFileSync(path.join(radice, 'supabase', 'functions', 'upload-pdf', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');

/* 1. maschera: il pulsante si mostra solo col definitivo */
assert.ok(!/show\('btn-pdf'\)\n\s*show\('btn-email-verbale'\)/.test(html), 'il pulsante non si mostra più dopo ogni salvataggio');
assert.ok(/if\(stato==='definitivo'\)show\('btn-email-verbale'\);else hide\('btn-email-verbale'\)/.test(html), 'pulsante solo col definitivo');
const mostra = html.match(/show\('btn-email-verbale'\)/g) || [];
assert.strictEqual(mostra.length, 1, 'un solo punto mostra il pulsante, quello condizionato');

/* 2. elenco: niente busta sulle bozze */
assert.ok(/\(isBozza\?'':`<button class="btn-outline btn-sm" data-act="email"/.test(html), 'busta solo sui definitivi');

/* 3. apertura dall'elenco: lo stato si legge e la bozza si ferma */
const iL = html.indexOf('async function inviEmailVerbaleFromList(vid,opz){');
assert.ok(iL > 0, 'la funzione di invio dall\'elenco');
const corpoL = html.slice(iL, html.indexOf('window._evSerie=', iL));
assert.ok(/visita_id,nr_verbale,stato,/.test(corpoL), 'dall\'elenco si legge lo stato');
assert.ok(/if\(v\.stato!=='definitivo'\)\{toast\(/.test(corpoL) && /return\}/.test(corpoL), 'dall\'elenco la bozza non apre l\'invio');

/* 4. «Invia ora»: stato letto adesso dal database, prima di generare il PDF */
const iI = html.indexOf("$('btn-ev-invia').onclick=async()=>{");
const corpoI = html.slice(iI, html.indexOf('const pdfDataUri=await genPDF(vid', iI));
assert.ok(/select\('visita_id,nr_verbale,stato'\)/.test(corpoI), '«Invia ora» legge lo stato');
assert.ok(/if\(_vChk\.stato!=='definitivo'\)\{toast\('Invio FERMATO:/.test(corpoI), '«Invia ora» ferma la bozza');

/* 5. upload-pdf: la bozza (o lo stato non letto) è rifiutata, la verifica dell'archivio no */
assert.ok(/select\('nr_verbale,data_visita,stato,/.test(up), 'la funzione legge lo stato');
assert.ok(/if \(!verifica && \(error \|\| !v \|\| \(v as any\)\.stato !== 'definitivo'\)\)/.test(up), 'la funzione rifiuta bozza e stato non letto');
assert.ok(/status: 409/.test(up), 'risposta di rifiuto');
assert.ok(up.indexOf("stato !== 'definitivo'") < up.indexOf("if (!pdf_base64) throw"), 'il rifiuto viene prima di scrivere su Drive');

console.log('ok invio-verbale-solo-definitivo');
