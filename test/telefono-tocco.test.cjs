// node test/telefono-tocco.test.cjs
// (03/10/2026) Sul telefono la pagina si può ingrandire con due dita, e sugli schermi a tocco campi e
// pulsanti sono a misura di dito. Sul PC non cambia niente: tutte le regole stanno sotto (pointer:coarse).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const vp = html.match(/<meta name="viewport" content="([^"]*)">/);
assert.ok(vp, 'manca il meta viewport');
assert.ok(!/user-scalable\s*=\s*no/.test(vp[1]) && !/maximum-scale/.test(vp[1]), 'lo zoom con due dita non deve essere bloccato: ' + vp[1]);
assert.ok(/width=device-width/.test(vp[1]));

const tocco = html.match(/@media \(pointer:coarse\)\{[\s\S]*?\r?\n\}/);
assert.ok(tocco, 'mancano le regole per gli schermi a tocco');
// senza i 16px l'iPhone ingrandisce la pagina a ogni tocco su un campo, ora che lo zoom è libero
assert.ok(/input:not\(\[type=checkbox\]\):not\(\[type=radio\]\):not\(\[type=range\]\),select,textarea\{font-size:16px!important\}/.test(tocco[0]), 'i campi devono avere il testo a 16px sugli schermi a tocco');
assert.ok(/\.btn-primary,\.btn-secondary,\.btn-success,\.btn-outline,\.btn-warn,\.btn-danger\{min-height:44px\}/.test(tocco[0]), 'i pulsanti devono essere alti almeno 44px');
assert.ok(/\.check-radios \.radio-chip\{display:inline-block;padding:9px 11px;font-size:12px\}/.test(tocco[0]), 'gli esiti della check-list devono essere più grandi (e la regola più specifica di quella di base, che viene dopo)');
// le regole non devono uscire dal blocco: sul PC la check-list resta com'è
assert.ok(/\.radio-chip\{font-size:11px;font-weight:700;padding:3px 6px;/.test(html), 'la misura degli esiti sul PC non deve cambiare');

console.log('telefono-tocco: ok');
