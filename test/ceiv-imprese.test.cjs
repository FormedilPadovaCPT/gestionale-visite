// Prova dell'estrazione CEIV «imprese presenti per cantiere»: che cosa esce per la Cassa Edile
// e, soprattutto, che un dato mancante esca VUOTO e segnalato, mai come zero.
const assert = require('assert')
const path = require('path')
const C = require(path.join(__dirname, '..', 'ceiv-imprese.js'))

const visite = [
  { visita_id: 'V1', nr_verbale: 'CPT/25_26/0801', data_visita: '2026-09-12', stato: 'definitivo', nr_imp: 2, nr_ind: 2, nr_lavoratori: 9,
    impresa_id: '01234560281', comm_rag_soc: 'Immobiliare Delta srl',
    tecnici: { tecnico_nome: 'Mario', tecnico_cognome: 'Verdi' },
    cantieri: { cantiere_cnce: 'CNCE0001', lotto: null, cantiere_indirizzo: 'Via Roma', cantiere_civico: '10', comune_nome: 'Padova' },
    imprese: { impresa_nome: 'Edil Alfa srl', piva: '01234560281' } },
  { visita_id: 'V2', nr_verbale: 'CPT/25_26/0807', data_visita: '2026-09-15', stato: 'bozza', nr_imp: 1, nr_ind: 1, nr_lavoratori: 6,
    impresa_id: '03456780283',
    tecnici: { tecnico_nome: 'Mario', tecnico_cognome: 'Verdi' },
    cantieri: { cantiere_cnce: 'CNCE0002', lotto: 'L2', cantiere_indirizzo: 'Via Verdi', cantiere_civico: '3', comune_nome: 'Abano' },
    imprese: { impresa_nome: 'Gamma Costruzioni spa', piva: '03456780283' } },
  { visita_id: 'V3', nr_verbale: 'CPT/25_26/0809', data_visita: '2026-09-16', stato: 'definitivo', nr_imp: 1, nr_ind: null, nr_lavoratori: 2,
    impresa_id: '09999990281',
    tecnici: {}, cantieri: { cantiere_cnce: 'CNCE0003', cantiere_indirizzo: 'Via Po', comune_nome: 'Este' },
    imprese: { impresa_nome: 'Solo Principale srl', piva: '09999990281' } },
]
const presenti = {
  V1: [
    { visita_id: 'V1', impresa_id: 'RSSMRA70A01G224X', ordine: 3, is_principale: false, ruolo: 'lavoratore autonomo', tipo_imp: 3, nr_lav: 1, imprese: { impresa_nome: 'Rossi Mario', impresa_cf: 'RSSMRA70A01G224X' } },
    { visita_id: 'V1', impresa_id: '02345670282', ordine: 2, is_principale: false, ruolo: 'subappaltatrice', tipo_imp: null, nr_lav: 3, imprese: { impresa_nome: 'Beta Impianti snc', piva: '02345670282', cassa_edile: 'C.E.I.V.', stato_cassa: 'Attiva', cod_ceiv: '012345' } },
    { visita_id: 'V1', impresa_id: '01234560281', ordine: 1, is_principale: true, ruolo: null, tipo_imp: 1, nr_lav: 4, imprese: { impresa_nome: 'Edil Alfa srl', piva: '01234560281' } },
    { visita_id: 'V1', impresa_id: 'BNCLCU80B02G224Y', ordine: 4, is_principale: false, ruolo: null, tipo_imp: 5, nr_lav: 1, imprese: { impresa_nome: 'Bianchi Luca' } },
  ],
  V2: [
    { visita_id: 'V2', impresa_id: '03456780283', ordine: 1, is_principale: true, ruolo: 'affidataria ed esecutrice', tipo_imp: 2, nr_lav: null, imprese: { impresa_nome: 'Gamma Costruzioni spa', piva: '03456780283' } },
  ],
}

const dati = C.normalizza(visite, presenti)
const v1 = dati.find((r) => r.visitaId === 'V1')

// la principale per prima, poi l'ordine del verbale
assert.deepStrictEqual(v1.imprese.map((x) => x.nome), ['Edil Alfa srl', 'Beta Impianti snc', 'Rossi Mario', 'Bianchi Luca'])
// il ruolo scritto vince sul codice (tipo_imp 3 + «lavoratore autonomo» = autonomo); senza ruolo vale il codice
assert.strictEqual(v1.imprese[2].autonomo, true, 'il ruolo scritto «lavoratore autonomo» deve fare un autonomo')
assert.strictEqual(v1.imprese[2].ruolo, 'Lavoratore autonomo')
assert.strictEqual(v1.imprese[3].autonomo, true, 'il codice 5 senza ruolo scritto è un autonomo')
assert.strictEqual(v1.imprese[0].ruolo, 'Affidataria')
assert.strictEqual(v1.imprese[1].autonomo, false)
// il codice fiscale dell'autonomo si ricava dalla chiave quando l'anagrafica non l'ha
assert.strictEqual(v1.imprese[3].cf, 'BNCLCU80B02G224Y')
assert.strictEqual(v1.imprese[3].piva, '')
assert.strictEqual(v1.imprese[1].codCeiv, '012345')
assert.strictEqual(v1.imprese[0].codCeiv, '', 'chi non è iscritto non ha codice')
assert.strictEqual(v1.imprese[1].cassa, 'C.E.I.V. – Attiva')
// conteggi: imprese e autonomi separati, totale quello dichiarato, nessuna nota se la somma torna
assert.strictEqual(v1.nImprese, 2); assert.strictEqual(v1.nAutonomi, 2)
assert.strictEqual(v1.lavTot, 9); assert.strictEqual(v1.somma, 9)
assert.deepStrictEqual(v1.note, [])

// dato mancante: vuoto e segnalato, mai zero
const v2 = dati.find((r) => r.visitaId === 'V2')
assert.strictEqual(v2.imprese[0].lav, null, 'lavoratori non indicati non devono diventare 0')
assert.ok(v2.note.includes('Verbale non definitivo'))
assert.ok(v2.note.some((n) => n.startsWith('Lavoratori non indicati')))
assert.ok(v2.note.some((n) => n.startsWith('1 autonomo dichiarato senza nominativo')), 'un autonomo contato ma non elencato va detto')

// nessuna riga di imprese presenti: resta la principale, e si dice
const v3 = dati.find((r) => r.visitaId === 'V3')
assert.strictEqual(v3.imprese.length, 1)
assert.ok(v3.note.some((n) => n.startsWith('Elenco delle imprese presenti non compilato')))

// somma diversa dal totale: si segnala, non si corregge
// il testo libero del tecnico sulle altre imprese esce per intero e viene segnalato
const conAltre = C.normalizza([Object.assign({}, visite[0], { altre_imp_text: 'DEA SRL - P.IVA 04953250265 -\n 2 presenti' })], presenti)[0]
assert.strictEqual(conAltre.altre, 'DEA SRL - P.IVA 04953250265 - 2 presenti')
assert.ok(conAltre.note.some((n) => n.startsWith('Altre imprese o autonomi segnalati')))
assert.ok(C.righeExcel([conAltre])[1].includes('DEA SRL - P.IVA 04953250265 - 2 presenti'))

const storto = C.normalizza([Object.assign({}, visite[0], { nr_lavoratori: 12 })], presenti)[0]
assert.ok(storto.note.includes('Somma per impresa 9, totale dichiarato 12'))
assert.strictEqual(storto.lavTot, 12)

// Excel: intestazione + una riga per impresa, il cantiere ripetuto su ogni riga
const aoa = C.righeExcel(dati)
assert.strictEqual(aoa.length, 1 + 4 + 1 + 1)
assert.strictEqual(aoa[0].length, C.LARGHEZZE.length)
aoa.forEach((r) => assert.strictEqual(r.length, C.INTESTAZIONE.length, 'tutte le righe hanno le stesse colonne'))
const H = (n) => C.INTESTAZIONE.indexOf(n)
assert.deepStrictEqual(aoa.slice(1, 5).map((r) => r[H('Codice CNCE')]), ['CNCE0001', 'CNCE0001', 'CNCE0001', 'CNCE0001'])
assert.strictEqual(aoa[1][H('Data sopralluogo')], '12/09/2026')
assert.strictEqual(aoa[3][H('Codice fiscale')], 'RSSMRA70A01G224X')
assert.strictEqual(aoa[3][H('Autonomo')], 'Sì')
assert.strictEqual(aoa[2][H('Lavoratori dell\'impresa presenti')], 3)
assert.strictEqual(aoa[2][H('Lavoratori totali del sopralluogo')], 9)
assert.strictEqual(aoa[5][H('Lotto')], 'L2')
assert.strictEqual(aoa[5][H('Lavoratori dell\'impresa presenti')], '', 'il dato mancante esce vuoto')

assert.deepStrictEqual(C.conta(dati), { sopralluoghi: 3, cantieri: 3, righe: 6, daGuardare: 2 })

// PDF: si disegna senza errori su un documento finto e va a capo pagina quando serve
function finto() {
  const d = { pagine: 1, testi: [] }
  const nulla = () => d
  ;['setFillColor', 'rect', 'setTextColor', 'setFontSize', 'setFont', 'setDrawColor', 'setLineWidth', 'line', 'roundedRect'].forEach((k) => { d[k] = nulla })
  d.text = (t) => { d.testi.push(String(t)); return d }
  d.addPage = () => { d.pagine++; return d }
  d.getTextWidth = (t) => String(t).length * 1.6
  d.splitTextToSize = (t, w) => { const n = Math.max(1, Math.floor(w / 1.6)); const out = []; for (let i = 0; i < String(t).length; i += n) out.push(String(t).slice(i, i + n)); return out.length ? out : [''] }
  return d
}
const doc = C.disegnaPdf(finto(), dati, '01/09/2026', '30/09/2026')
assert.ok(doc.testi.some((t) => t.includes('Cantiere CNCE0001')))
assert.ok(doc.testi.some((t) => t.includes('Rossi Mario') && t.includes('(autonomo)')))
assert.ok(doc.testi.some((t) => t.includes('2 imprese, 2 autonomi')))
const tanti = []
for (let i = 0; i < 60; i++) tanti.push(Object.assign({}, visite[0], { visita_id: 'V1', nr_verbale: 'CPT/25_26/' + (1000 + i), cantieri: Object.assign({}, visite[0].cantieri, { cantiere_cnce: 'CNCE' + (1000 + i) }) }))
assert.ok(C.disegnaPdf(finto(), C.normalizza(tanti, presenti), 'inizio', '30/09/2026').pagine > 5, 'con molti sopralluoghi servono più pagine')

console.log('ceiv-imprese: tutte le prove passate')
