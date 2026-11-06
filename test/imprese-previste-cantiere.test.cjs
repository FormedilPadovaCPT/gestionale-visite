// Imprese previste anche sui cantieri senza CNCE (06/11/2026, chiesto dall'utente): nel verbale il tecnico trova
// quelle della Cassa (per CNCE) e quelle indicate dalla segreteria (per cantiere). Le regole sono le stesse di
// segreteria-app/js/imprese-previste-regole.js. Uso: node test/imprese-previste-cantiere.test.cjs
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const a = html.indexOf('function filtroPreviste('), b = html.indexOf('async function caricaProposteImprese(')
assert.ok(a > 0 && b > a, 'non trovo filtroPreviste / previsteUniche')
const ctx = {}; vm.createContext(ctx)
vm.runInContext(html.slice(a, b) + ';this.f=filtroPreviste;this.u=previsteUniche', ctx)
assert.strictEqual(ctx.f('C1', 'daf47bd8'), 'cnce.eq."C1",cantiere_id.eq."daf47bd8"')
assert.strictEqual(ctx.f('', 'daf47bd8'), 'cantiere_id.eq."daf47bd8"', 'senza CNCE si leggono le righe del cantiere')
const u = ctx.u([{ impresa_cf: 'X', fonte: 'segreteria', impresa_nome: 'B' }, { impresa_cf: 'x', fonte: 'cassa', impresa_nome: 'B' }, { impresa_cf: 'Y', fonte: 'segreteria', impresa_nome: 'A' }])
assert.strictEqual(u.length, 2); assert.strictEqual(u[1].fonte, 'cassa', 'la stessa impresa una volta, vince la Cassa')
// le tre letture usano il filtro, e nessuna resta solo sul CNCE
const letture = html.match(/from\('cantiere_imprese_previste'\)[^\n]*/g) || []
assert.strictEqual(letture.length, 3, 'tre letture delle imprese previste')
letture.forEach(l => assert.ok(/\.or\(filtroPreviste\(/.test(l), 'lettura solo per CNCE: ' + l.slice(0, 120)))
// la proposta nel verbale parte anche senza CNCE, e se la lettura fallisce lo dice
const prop = html.slice(b, html.indexOf('async function aggiungiImpresaProposta('))
assert.ok(/if\(!cnce&&!cid\)/.test(prop), 'senza CNCE ma col cantiere le proposte si cercano')
assert.ok(/Non sono riuscito a leggere le imprese previste/.test(prop), 'lettura fallita: si dice, non si tace')
console.log('imprese-previste-cantiere: tutto ok')
