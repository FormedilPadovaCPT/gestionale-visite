// (13/11/2026) L'IPC È UNA REGOLA SOLA, SCRITTA IN CINQUE POSTI.
// La maschera (calcIPC in index.html), il controllo del verbale (ipcDa in controllo-verbale.js),
// il PDF (verbale-pdf.js), il report attività (rptIpcLivello in index.html) e il database
// (funzione calcola_ipc) la riscrivono ciascuno per conto suo. Oggi coincidono; niente lo
// garantiva. Questa prova esegue le quattro copie del gestionale su tutte le combinazioni
// di NC+, NC− e OSS e le confronta con la regola del database, ricopiata qui sotto da
// _SISTEMA/schema_db/gestionale_schema.sql il 13/11/2026.
// Chi cambia la regola la cambia nei cinque posti E qui: se ne dimentica uno, questa prova fallisce.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const leggi = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* la regola del database (public.calcola_ipc), parola per parola */
function delDatabase(np, nm, os) {
  if (np >= 1 || nm > 3) return 'ALTO';
  if (os > 6 || (nm >= 1 && nm <= 3)) return 'MEDIO';
  if (os >= 1 && os <= 6) return 'BASSO';
  return 'NR';
}

const index = leggi('index.html');
const estrai = (testo, inizio, cosa) => {
  const i = testo.indexOf(inizio);
  assert.ok(i >= 0, cosa + ': non trovata (è stata rinominata o spostata?)');
  const f = testo.indexOf('\n}', i);
  return testo.slice(i, f + 2);
};
const calcIPC = new Function(estrai(index, 'function calcIPC(chk){', 'calcIPC in index.html') + '\nreturn calcIPC;')();
const rptIpcLivello = new Function(estrai(index, 'function rptIpcLivello(d){', 'rptIpcLivello in index.html') + '\nreturn rptIpcLivello;')();

const cv = leggi('controllo-verbale.js');
const iDa = cv.indexOf('function ipcDa(checklist) {');
assert.ok(iDa >= 0, 'ipcDa in controllo-verbale.js: non trovata');
const ipcDa = new Function(cv.slice(iDa, cv.indexOf('\n  }', iDa) + 4) + '\nreturn ipcDa;')();

const pdf = leggi('verbale-pdf.js');
const iPdf = pdf.indexOf("const ncp = conta('NC+')");
const fPdf = pdf.indexOf('const grave', iPdf);
assert.ok(iPdf >= 0 && fPdf > iPdf, 'la regola dell\'IPC in verbale-pdf.js: non trovata');
const delPdf = new Function('conta', pdf.slice(iPdf, fPdf) + '\nreturn label;');

const lista = (np, nm, os) => {
  const o = {}; let k = 0;
  for (let i = 0; i < np; i++) o['a' + (k++)] = 'NC+';
  for (let i = 0; i < nm; i++) o['a' + (k++)] = 'NC-';
  for (let i = 0; i < os; i++) o['a' + (k++)] = 'OSS';
  o['a' + (k++)] = 'VER';
  return o;
};

let provate = 0;
for (let np = 0; np <= 2; np++) for (let nm = 0; nm <= 5; nm++) for (let os = 0; os <= 8; os++) {
  const atteso = delDatabase(np, nm, os);
  const dove = `NC+ ${np}, NC− ${nm}, OSS ${os}`;
  const chk = lista(np, nm, os);
  assert.strictEqual(calcIPC(chk).ipc, atteso, 'calcIPC (maschera) — ' + dove);
  assert.strictEqual(ipcDa(chk).ipc, atteso, 'ipcDa (controllo del verbale) — ' + dove);
  assert.strictEqual(rptIpcLivello({ ncp: np, ncm: nm, oss: os, ver: 1 }), atteso, 'rptIpcLivello (report attività) — ' + dove);
  const etichetta = delPdf((x) => ({ 'NC+': np, 'NC-': nm, OSS: os, VER: 1 })[x] || 0);
  assert.strictEqual(etichetta === 'NESSUN RILIEVO' ? 'NR' : etichetta, atteso, 'PDF del verbale — ' + dove);
  provate++;
}
// la prova sa fallire: una soglia spostata di uno deve essere vista
const sbagliata = (np, nm, os) => (np >= 1 || nm > 4) ? 'ALTO' : (os > 6 || (nm >= 1 && nm <= 4)) ? 'MEDIO' : os >= 1 ? 'BASSO' : 'NR';
assert.notStrictEqual(sbagliata(0, 4, 0), delDatabase(0, 4, 0), 'il confronto non distingue una soglia sbagliata');
console.log('ipc-una-regola: ' + provate + ' combinazioni, quattro copie del gestionale uguali alla regola del database');
