// Statistiche: gradimento delle visite dai questionari del portale (19/10/2026, chiesto dall'utente).
// Solo totali (dash_questionari): niente commenti, niente nomi. Voci e ordine come nel modulo.
// Uso: node test/statistiche-gradimento.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const radice = path.join(__dirname, '..')
const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8')
function estrai(inizio, fine) {
  const a = html.indexOf(inizio)
  assert.ok(a >= 0, 'non trovo: ' + inizio)
  const b = html.indexOf(fine, a)
  assert.ok(b > a, 'non trovo la fine di: ' + inizio)
  return html.slice(a, b)
}
const J = (x) => JSON.parse(JSON.stringify(x))
const ctx = {}
vm.createContext(ctx)
vm.runInContext(estrai('const GRAD_UTILITA=', 'async function _dashRenderGradimento('), ctx)

// i numeri veri del 19/10/2026
const g = J(ctx.gradimentoDati({ ricevuti: 4, agganciati: 4, visite_con_questionario: 2, visite_periodo: 37, media: 4.25,
  utilita: { 4: 3, 5: 1 }, motivi: { 'Consigli pratici': 4, 'Ci ha mostrato un rischio': 1, 'Il confronto con il tecnico': 1 },
  azione: { 'Lo abbiamo messo in programma': 4 } }))
assert.deepStrictEqual(g.utilita, [0, 0, 0, 3, 1], 'utilità da 1 a 5, nell’ordine del modulo')
assert.deepStrictEqual(g.motivi.map((x) => [x.label, x.n, x.positivo]),
  [['Ci ha mostrato un rischio', 1, true], ['Consigli pratici', 4, true], ['Il confronto con il tecnico', 1, true]], 'motivi nell’ordine del modulo, solo quelli scelti')
assert.deepStrictEqual(g.azione, [{ label: 'Lo abbiamo messo in programma', n: 4 }])
assert.strictEqual(g.testo, '4 questionari ricevuti · 2 visite con almeno un questionario su 37 (5,4%) · utilità media 4,3 su 5')
assert.strictEqual(g.pochi, true, 'meno di dieci: lo si dice')

// i motivi «non ha funzionato» si distinguono, una voce sconosciuta si conta lo stesso
const h = J(ctx.gradimentoDati({ ricevuti: 12, motivi: { 'Troppo poco tempo': 2, 'Voce di un modulo vecchio': 1 } }))
assert.deepStrictEqual(h.motivi.map((x) => [x.label, x.positivo]), [['Troppo poco tempo', false], ['Voce di un modulo vecchio', null]])
assert.strictEqual(h.pochi, false)
assert.strictEqual(J(ctx.gradimentoDati(null)).testo, 'Nessun questionario di gradimento nel filtro corrente.')

// la pagina e il report li usano; la lettura fallita si dice; i dati personali non passano
assert.ok(estrai('  _dashRenderKpi(F)\n', '  _dashLoadVer(').includes('_dashRenderGradimento(fE,fT,fTy,fI)'))
assert.ok(estrai('async function _dashRenderGradimento(', '/* le voci con più NC+').includes('Non sono riuscito a leggere i questionari'))
const p6 = estrai('// ════ PAGINA 6', '// ── Salva ──')
assert.ok(p6.includes("sb.rpc('dash_questionari'") && p6.includes('if(eGrad)throw'), 'il report legge i questionari e si ferma se non ci riesce')
const sql = fs.readFileSync(path.join(radice, 'supabase', 'sql', '2026_10_19_dash_questionari.sql'), 'utf8')
const corpo = sql.slice(sql.indexOf("select jsonb_build_object("))
for (const campo of ['commento', 'recapito_contatto', 'note_ufficio', 'tecnico']) {
  assert.ok(!new RegExp('\b' + campo + '\b').test(corpo.replace(/tecnico_id|p_tecnico/g, '')), 'la funzione non deve restituire ' + campo)
}
assert.ok(sql.includes("<> 'scartato'"), 'i questionari scartati non contano')

console.log('OK gradimento delle visite')
