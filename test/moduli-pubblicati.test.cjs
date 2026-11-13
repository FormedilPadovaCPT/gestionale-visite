// (13/11/2026) OGNI MODULO IMPORTATO DAL FILE CENTRALE VIENE PUBBLICATO.
// Il modulo principale di index.html importa i suoi pezzi estratti con `import … from './x.js'`
// (osservatorio.js, esportazioni.js). Il workflow di pubblicazione controlla i tag
// <script src>, ma NON gli import: un modulo dimenticato nelle sue due liste non andrebbe
// online, e senza quel file il modulo principale non parte affatto (l'app resta sulla
// schermata d'accesso). Qui si controlla che ogni import locale:
//  1. esista come file;
//  2. sia nella lista `paths` (una sua modifica fa ripartire la pubblicazione);
//  3. sia nella lista dei file copiati in _site.
// E che ogni fabbrica importata sia davvero chiamata.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const radice = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(radice, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(radice, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');

const importati = [...index.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w.-]+\.js)(?:\?v=\d+)?'/gm)]
  .map((m) => ({ nomi: m[1].split(',').map((s) => s.trim()).filter(Boolean), file: m[2] }));
assert.ok(importati.length >= 2, 'gli import del modulo principale non sono stati trovati');

const riga = wf.split('\n').find((r) => /^\s*for f in app-data\.js /.test(r)) || '';
assert.ok(riga, 'la lista dei file copiati in _site non è stata trovata nel workflow');
const copiati = riga.replace(/^\s*for f in /, '').replace(/;\s*do\s*$/, '').trim().split(/\s+/);

for (const { nomi, file } of importati) {
  assert.ok(fs.existsSync(path.join(radice, file)), file + ': importato ma non esiste');
  assert.ok(new RegExp("^\\s*- '" + file.replace('.', '\\.') + "'\\s*$", 'm').test(wf), file + ': manca nella lista «paths» di deploy-pages.yml');
  assert.ok(copiati.includes(file), file + ': manca nella lista dei file copiati in _site (deploy-pages.yml)');
  for (const n of nomi) {
    assert.ok(new RegExp('(?<![\\w$])' + n + '\\(').test(index.replace(/^import .*$/gm, '')), n + ': importata ma mai chiamata');
    assert.ok(new RegExp('export function ' + n + '\\(').test(fs.readFileSync(path.join(radice, file), 'utf8')), n + ': non esportata da ' + file);
  }
}
console.log('moduli-pubblicati: ' + importati.map((i) => i.file).join(', ') + ' — importati, pubblicati e chiamati');
