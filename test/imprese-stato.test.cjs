// node test/imprese-stato.test.cjs
// (13/10/2026, chiesto dall'utente) rubrica e verbale dicono lo stato dell'impresa.
// La cessata in Cassa Edile può entrare in un verbale; la cessata nel Registro Imprese
// («a tutti gli effetti») sparisce dalla scelta per le visite fatte da quel giorno.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const a = html.indexOf('function impresaCessataPer('), b = html.indexOf('function statoImpresaBadge(');
const fine = html.indexOf('\n}\n', b) + 3;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = new Function('esc', html.slice(a, fine) + '\nreturn {impresaCessataPer, statoImpresaBadge, _dataItBreve}')(esc);

assert.strictEqual(F.impresaCessataPer({ cessata_il: '2026-05-01' }, '2026-10-09'), true, 'cessata prima della visita');
assert.strictEqual(F.impresaCessataPer({ cessata_il: '2026-10-09' }, '2026-10-09'), true, 'cessata il giorno della visita');
assert.strictEqual(F.impresaCessataPer({ cessata_il: '2026-12-01' }, '2026-10-09'), false, 'visita fatta prima della cessazione');
assert.strictEqual(F.impresaCessataPer({ stato_cassa: 'Cessata' }, '2026-10-09'), false, 'la cessata in Cassa resta sceglibile');
assert.strictEqual(F.impresaCessataPer({ cessata_il: '2020-01-01' }, ''), true, 'senza data della visita vale oggi');

assert.ok(/C\.E\.I\.V\. attiva/.test(F.statoImpresaBadge({ stato_cassa: 'Attiva', cod_ceiv: '1' })));
assert.ok(/C\.E\.I\.V\. sospesa/.test(F.statoImpresaBadge({ stato_cassa: 'Sospesa' })) && /conta comunque come iscritta/.test(F.statoImpresaBadge({ stato_cassa: 'Sospesa' })));
assert.ok(/C\.E\.I\.V\. cessata/.test(F.statoImpresaBadge({ stato_cassa: 'Cessata', cod_ceiv: '1' })), 'prima usciva «C.E.I.V.» anche per le cessate');
assert.ok(/Non iscritta C\.E\.I\.V\./.test(F.statoImpresaBadge({ stato_cassa: 'Non iscritta' })));
assert.ok(/CESSATA dal 01\/05\/2026/.test(F.statoImpresaBadge({ cessata_il: '2026-05-01' })));
assert.strictEqual(F.statoImpresaBadge({}), '');

assert.ok(/cards\.push\(rubCard\('🏢','impresa',r\.impresa_id,esc\(r\.impresa_nome\|\|'–'\),sub,extra,statoImpresaBadge\(r\)\)\)/.test(html), 'la rubrica usa il bollino nuovo');
assert.ok(/select\('impresa_id,impresa_nome,impresa_cf,piva,cessata_il'\)/.test(html) && /_vive=_tutte\.filter\(i=>!impresaCessataPer\(i,_dv\)\)/.test(html), 'la tendina del verbale toglie le cessate');
assert.ok(/function _useImpresaEsistente\(c,idx\)\{\n  \/\/ \(13\/10\/2026\)[^\n]*\n  if\(impresaCessataPer\(c,vGet\('f-data'\)\)\)/.test(html), '«Usa questa» e le altre strade si fermano sulla cessata');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/sql/2026_10_13_ricerca_imprese_stato.sql'), 'utf8');
assert.ok(/stato_cassa text, cessata_il date, cessata_fonte text\)/.test(sql) && /revoke execute on function public\.rubrica_imprese_cerca\(text, integer\) from public, anon/.test(sql));
console.log('imprese-stato: ok');
