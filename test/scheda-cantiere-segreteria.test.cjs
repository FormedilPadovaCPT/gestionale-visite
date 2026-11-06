// La segreteria apre il cantiere con quello che sa, il tecnico lo completa prima della visita
// (06/11/2026, deciso dall'utente sulla richiesta di visita Galiazzo: dalla richiesta si conoscono spesso
// solo indirizzo e comune). Uso: node test/scheda-cantiere-segreteria.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
function estrai(inizio, fine) {
  const a = html.indexOf(inizio)
  assert.ok(a >= 0, 'non trovo: ' + inizio)
  const b = html.indexOf(fine, a)
  assert.ok(b > a, 'non trovo la fine di: ' + inizio)
  return html.slice(a, b)
}
const ctx = {}
vm.createContext(ctx)
vm.runInContext(estrai('function cantiereMancanze(d){', '/* il verbale chiede la scheda') +
  '\nthis.scheda=cantiereMancanzeScheda;this.blocca=schedaCantiereBlocca', ctx)
const { scheda, blocca } = ctx

// ── la scheda nata dalla segreteria: solo indirizzo e comune ──
const galiazzo = { cantiere_id: 'daf47bd8', comune_nome: 'Abano Terme', cantiere_tip_int: null, cantiere_tip_ope: null, cantiere_durata: null, cantiere_importo: null }
const m = scheda(galiazzo)
assert.strictEqual(JSON.stringify(m.map((x) => x.campo)), JSON.stringify(['mc-tip-int', 'mc-tip-ope', 'mc-durata', 'mc-importo']), 'mancano i quattro dati dell\'Osservatorio, non il comune')
const completa = Object.assign({}, galiazzo, { cantiere_tip_int: 1, cantiere_tip_ope: 2, cantiere_durata: 3, cantiere_importo: 4 })
assert.strictEqual(scheda(completa).length, 0, 'scheda completa: niente da chiedere')
assert.strictEqual(scheda(Object.assign({}, completa, { cantiere_importo: 11 })).length, 1, '«Non disponibile» non vale come importo')
assert.ok(scheda(Object.assign({}, completa, { cantiere_tip_ope: 16 })).some((x) => x.campo === 'mc-tip-ope-altro'), 'opera «Altro» vuole la descrizione')

// ── il tecnico non passa oltre il passo «Cantiere» ──
const s = { cid: 'daf47bd8', cidForm: 'daf47bd8', mancanze: m, segreteria: false, definitivo: false }
assert.strictEqual(blocca(0, s), false, 'il primo passo si apre')
assert.strictEqual(blocca(1, s), false, 'il passo Cantiere si apre: è lì che si completa')
assert.strictEqual(blocca(2, s), true, 'Imprese no, finché la scheda è incompleta')
assert.strictEqual(blocca(15, s), true, 'nemmeno il riepilogo')
assert.strictEqual(blocca(2, Object.assign({}, s, { mancanze: [] })), false, 'scheda completa: si passa')
assert.strictEqual(blocca(2, Object.assign({}, s, { segreteria: true })), false, 'la segreteria non è bloccata')
assert.strictEqual(blocca(2, Object.assign({}, s, { definitivo: true })), false, 'un definitivo si consulta')
assert.strictEqual(blocca(2, Object.assign({}, s, { cidForm: 'altro' })), false, 'la scheda letta è di un altro cantiere: non vale')
assert.strictEqual(blocca(2, {}), false, 'nessun cantiere letto: non si blocca')

// ── la maschera: la segreteria salva incompleta, ma il comune serve sempre ──
const salva = estrai("$('btn-mc-save').onclick=async()=>{", 'const fields={')
assert.ok(/if\(window\.__isSegreteria\)\{[\s\S]*?campo==='mc-com'[\s\S]*?return\}/.test(salva), 'alla segreteria il comune resta obbligatorio')
assert.ok(/\}else if\(!window\._editCantId\|\|window\._mcGeoFrom==='visita'\)\{[\s\S]*?return/.test(salva), 'agli altri il blocco di prima resta')
// e il verbale chiede la scheda e la blocca
assert.ok(/function renderCantCard\(c\)\{[\s\S]*?chiediSchedaCantiere\(c\)\n\}/.test(html), 'la scheda del verbale chiede il completamento')
assert.ok(/function activateTab\(n\)\{\s*\/\*[^*]*\*\/\s*if\(schedaCantiereBlocca\(n,/.test(html), 'il cambio di passo passa dal blocco')

console.log('scheda-cantiere-segreteria: tutto ok')
