// (13/11/2026) IL CODICE DEL GESTIONALE, TUTTO INSIEME, PER LE PROVE CHE LEGGONO IL TESTO.
// Il file centrale index.html perde un blocco alla volta: ogni blocco estratto diventa un
// modulo che index.html importa (`import { crea… } from './x.js'`). Una prova che cerca una
// funzione «in index.html» smetterebbe di trovarla a ogni estrazione. Qui si restituisce
// index.html seguito dai moduli che importa: la prova continua a leggere lo stesso codice,
// dovunque sia finito. Il nome non finisce in .test.cjs: non è una prova e il giro non lo lancia.
const fs = require('fs');
const path = require('path');
const radice = path.join(__dirname, '..');

function moduliEstratti(index) {
  return [...index.matchAll(/^import\s*\{[^}]*\}\s*from\s*'\.\/([\w.-]+\.js)(?:\?v=\d+)?'/gm)].map((m) => m[1]);
}

/** index.html (o il file passato) + i moduli che importa, separati da un a capo. */
function sorgenteApp(fileIndex) {
  const index = fs.readFileSync(fileIndex || path.join(radice, 'index.html'), 'utf8');
  const moduli = moduliEstratti(index);
  if (moduli.length < 2) throw new Error('_sorgente: non trovo gli import dei moduli estratti in index.html');
  return index + '\n' + moduli.map((f) => fs.readFileSync(path.join(radice, f), 'utf8')).join('\n');
}

module.exports = { sorgenteApp, moduliEstratti };
