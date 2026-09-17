// Prova della scheda impresa pre-visita: si controlla che cosa scrive, e soprattutto
// che cosa NON scrive (la formazione non c'entra, l'RLST dice solo che la richiesta è partita).
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const sorgente = fs.readFileSync(path.join(__dirname, '..', 'scheda-impresa.js'), 'utf8')
const window = {}
const document = { getElementById: () => null }
new Function('window', 'document', 'console', sorgente)(window, document, console)
const S = window.SchedaImpresa

const dati = {
  impresa: { id: '00184540276', nome: 'ICM S.P.A.', comune: 'Vicenza', prov: 'VI', stato_cassa: 'Attiva', lista_al: '2026-08-30', ccnl: 'Edilizia Industria' },
  visite: [{ verbale: 'CPT/25_26/0884', data: '2026-09-16', ipc: 'BASSO', nc_piu: 0, nc_meno: 1, oss: 2, cantiere: 'Via Chiesanuova', comune: 'PADOVA', tecnico: 'Nicola De Marco' }],
  rientri: [{ verbale: 'CPT/25_26/0870', data: '2026-08-01', ritorno: '2026-08-23', cantiere: 'Via Roma', comune: 'ABANO TERME' }],
  critici: [{ data: '2026-09-10', stato: 'nuovo', origine: 'accesso_negato', motivo: 'accesso_negato', cantiere: 'Via Verdi' }],
  asseverazione: { numero: 'P 2026/01', tipo: 'mantenimento', stato: 'asseverata', scadenza_attestato: '2027-02-07', protocollo_nazionale: 'CPT-PD-06/15' },
  rlst: { richiesta_il: '2026-03-04', progressivo: 12 },
}

const h = S.html(dati)

// c'è quello che serve al tecnico prima di entrare in cantiere
assert.ok(h.includes('C.E.I.V. Attiva'), 'manca lo stato Cassa Edile')
assert.ok(h.includes('lista al 30/08/2026'), 'lo stato Cassa Edile deve dire da quale lista viene')
assert.ok(h.includes('CPT/25_26/0884'), 'mancano le ultime visite')
assert.ok(h.includes('NC− 1') && h.includes('OSS 2'), 'mancano i rilievi della visita')
assert.ok(h.includes('scaduto da'), 'un rientro passato deve risultare scaduto')
assert.ok(h.includes('accesso negato'), 'manca il caso critico aperto')
assert.ok(h.includes('P 2026/01') && h.includes('07/02/2027'), 'manca l\'asseverazione con la scadenza')
assert.ok(h.includes('richiesta di affidamento inviata il 04/03/2026'), 'manca la richiesta RLST')

// l'RLST non deve dire nulla di più: l'ASC non comunica se la prende in carico
assert.ok(!/RLST[^<]*(attiv|in carico|affidat[oa])/i.test(h), 'dell\'RLST si dice solo che la richiesta è partita')

// la formazione dei lavoratori è dell'ufficio corsi: qui non compare
assert.ok(!/formazione/i.test(h), 'la formazione non va nella scheda')

// niente impresa, niente scheda
assert.strictEqual(S.html(null), '')
assert.strictEqual(S.html({}), '')

// impresa senza storia: lo dice, invece di lasciare il vuoto
const vuota = S.html({ impresa: { nome: 'NUOVA SRL' }, visite: [], rientri: [], critici: [] })
assert.ok(vuota.includes('Nessuna visita registrata'), 'con zero visite deve dirlo')
assert.ok(vuota.includes('non risulta in elenco'), 'senza stato cassa si dichiara che non risulta')

// i dati passano dall\'escape: un apice o un tag non devono rompere la scheda
const cattiva = S.html({ impresa: { nome: 'X', stato_cassa: 'Attiva' }, visite: [{ verbale: 'a', data: '2026-01-01', cantiere: '<script>alert(1)</script>', ipc: 'NR' }], rientri: [], critici: [] })
assert.ok(!cattiva.includes('<script>alert(1)</script>'), 'il testo dei dati va sempre messo in sicurezza')

console.log('scheda-impresa: tutte le prove passate')
