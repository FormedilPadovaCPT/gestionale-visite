// node test/verbale-cantiere-importo-mail.test.cjs
// (03/10/2026) Dai verbali CPT/26_27/0001-0002: cantiere che resta agganciato, importo del cantiere
// di prima, codici fiscali in minuscolo, verbale partito senza nessuna impresa fra i destinatari.
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const fn = (re, cosa) => { const m = html.match(re); assert.ok(m, cosa + ' non trovata in index.html'); return m[0] }

/* ── importo lavori: quando si sceglie un cantiere vale SEMPRE la sua scheda ── */
const pic = fn(/function proponiImportoCantiere\(imp\)\{[\s\S]*?\r?\n\}/, 'proponiImportoCantiere')
const el = { value: '3', style: {}, title: '', querySelector(s) { return ['1', '2', '3', '10', '11'].includes(s.match(/value="([^"]*)"/)[1]) ? {} : null } }
const proponi = Function('$', pic + '; return proponiImportoCantiere')(() => el)
proponi(1); assert.strictEqual(el.value, '1', 'l’importo della scheda sostituisce quello che c’era (era 3)')
proponi('10'); assert.strictEqual(el.value, '10')
proponi(null); assert.strictEqual(el.value, '', 'scheda senza importo: la tendina si svuota, non tiene quello del cantiere di prima')
el.value = '2'; proponi(''); assert.strictEqual(el.value, '')
el.value = '2'; proponi(99); assert.strictEqual(el.value, '', 'un valore che la tendina non ha non resta attaccato')
// anche «Nuova visita sullo stesso cantiere» lo propone, con la fine lavori
const nv = fn(/async function nuovaVisitaDaVerbale\(vid, mode\)\{[\s\S]*?\r?\n\}/, 'nuovaVisitaDaVerbale')
assert.ok(/proponiImportoCantiere\(r\.data\.cantiere_importo\)/.test(nv) && /vSet\('f-data-ult',r\.data\.data_ult/.test(nv))

/* ── scrivere nel campo del cantiere stacca quello scelto prima ── */
assert.ok(/inA\.oninput=\(\)=>\{staccaCantiere\(\);trig\(\)\}/.test(html), 'la digitazione nel campo deve staccare il cantiere')
const sc = fn(/function staccaCantiere\(\)\{[\s\S]*?\r?\n\}/, 'staccaCantiere')
const campi = { 'f-cant-id': 'V2526C-x', 'f-cnce': 'CNCE1', 'f-cod-uni': 'Fc-zacco-pd-2', 'f-data-ult': '2026-10-30' }
const S = { fd: { cantiere_id: 'V2526C-x' } }
let carta = 0, avviso = 0
const stacca = Function('vGet', 'vSet', 'S', 'hideCantCard', '$', 'toast', sc + '; return staccaCantiere')(
  (k) => campi[k] || '', (k, v) => { campi[k] = v }, S, () => { carta++ }, () => ({ textContent: '' }), () => { avviso++ })
stacca()
assert.deepStrictEqual([campi['f-cant-id'], campi['f-cod-uni'], campi['f-data-ult'], S.fd.cantiere_id, carta, avviso], ['', '', '', null, 1, 1])
stacca(); assert.strictEqual(avviso, 1, 'l’avviso compare una volta, non a ogni tasto')
// e senza cantiere il salvataggio si ferma (controllo già presente)
assert.ok(/if\(!cant_id\)\{toast\('Seleziona un cantiere/.test(html))

/* ── codici fiscali e partite IVA in maiuscolo, senza spazi ── */
const ncf = fn(/function normCf\(s\)\{[^\n]*\}/, 'normCf')
const norm = Function(ncf + '; return normCf')()
assert.strictEqual(norm(' mccmkm82 d63z127g '), 'MCCMKM82D63Z127G')
assert.strictEqual(norm(null), '')
const re = Function('return ' + fn(/\/\^\(\?:\(\?:f\|mc[^\n]*\$\//, 'CAMPO_CF'))()
for (const id of ['f-comm-cf', 'f-comm-cf-pg', 'f-comm-piva', 'mc-comm-cf', 'mc-comm-cf-pg', 'mc-comm-piva', 'ec-cfpiva', 'ec-piva', 'ei-cf', 'ei-piva', 'mi-cf', 'mi-piva', 'mp-cf', 'im-cf_imp-0', 'im-piva-12'])
  assert.ok(re.test(id), id + ' deve essere normalizzato')
for (const id of ['mp-cf-note', 'f-comm-email', 'im-email_verbale-0', 'f-cant-search'])
  assert.ok(!re.test(id), id + ' non è un campo CF')

/* ── invio dalla maschera: se «Email invio verbale» è vuoto vale l'anagrafica ── */
const inv = fn(/async function inviEmailVerbale\(\)\{[\s\S]*?\r?\n\}/, 'inviEmailVerbale')
assert.ok(/from\('imprese'\)\.select\('impresa_id,impresa_email_ref,impresa_email2,impresa_email3'\)/.test(inv), 'deve leggere l’anagrafica delle imprese')
assert.ok(/\|\|_anag\[String\(im\.impresa_id\|\|''\)\.trim\(\)\]/.test(inv), 'campo vuoto = indirizzo dell’anagrafica')
assert.ok(/if\(_eIa\)_anagErr=_eIa\.message/.test(inv), 'l’errore di lettura si legge')
// nessuna impresa fra i destinatari: avviso nella finestra e invio fermo
// (06/10/2026) conta fra i destinatari SPUNTATI: il tecnico può togliere la spunta a qualcuno
assert.ok(/const _evImpresa=e=>e\.ruolo==='Impresa'\|\|!!e\.extra/.test(html))
assert.ok(/const _senzaImpresa=!scelti\.some\(_evImpresa\)/.test(html))
assert.ok(/if\(!emails\.some\(_evImpresa\)\)\{toast\('Nessuna impresa fra i destinatari/.test(html), 'senza impresa l’invio non parte')
// l'indirizzo scritto nel verbale entra in anagrafica solo se lì è vuoto
assert.ok(/update\(\{impresa_email_ref:_ev\}\)\.eq\('impresa_id',_id\)\.or\('impresa_email_ref\.is\.null,impresa_email_ref\.eq\.'\)/.test(html))

console.log('ok — cantiere, importo, codici fiscali e e-mail delle imprese')
