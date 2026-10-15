// Il Direttore apre questioni nel registro delle decisioni (15/10/2026).
// Prove sulla forma del sorgente di direzione.js; il database è stato provato
// in una transazione annullata (inserimento, avvisi, risposta, presa in carico).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'direzione.js'), 'utf8').replace(/\r\n/g, '\n');
let n = 0;
const prova = (nome, f) => { f(); n += 1; console.log('ok -', nome); };

prova('i decisori nuovi hanno un nome', () => {
  assert.match(src, /segreteria: 'Segreteria', coordinatore: 'Coordinatore' \}/);
});
prova('segreteria e coordinatore rispondono alle questioni rivolte a loro', () => {
  assert.match(src, /\(dec === 'segreteria' && R\.segr\) \|\| \(dec === 'coordinatore' && R\.coord\)/);
});
prova('il Direttore apre questioni dalla pagina Direzione e gestisce solo le sue', () => {
  assert.match(src, /const apreQuestioni = !anteprima && \(\(R\.coord \|\| R\.segr\) \? modo === 'coord' : \(R\.direttore && modo === 'direzione'\)\);/);
  assert.match(src, /const gestisceR = \(r\) => gestisce \|\| \(!anteprima && R\.direttore && mia\(r\)\);/);
  assert.match(src, /const nuova = \(apreQuestioni \?/);
  assert.match(src, /\) \|\| nuovaAnteprima;/, 'in anteprima «come Direttore» il pulsante si vede, spento');
  assert.match(src, /righe = righe\.filter\(\(r\) => r\.decisore === come\(\) \|\| \(dirEmail && /, 'in anteprima anche le questioni aperte dal Direttore');
});
prova('al Direttore il modulo propone Presidenza, Commissione, segreteria e coordinatore', () => {
  assert.match(src, /\? \['presidenza', 'commissione', 'segreteria', 'coordinatore'\]/);
});
prova('una riservata non va alla segreteria', () => {
  assert.match(src, /\$\('dn-dec'\)\.value === 'segreteria'\) \{ avviso\('Una questione riservata non può andare alla segreteria/);
});
console.log(`${n} prove passate`);
