// Statistiche dei cicli di visita (20/10/2026): le due sottopagine «🔁 Cicli di visita» e
// «📈 Miglioramento e serie» devono dare i numeri della risposta vera di dash_cicli del 20/10/2026
// (37 cicli, tutti alla prima visita), dire che prima del 1° ottobre 2026 non ci sono cicli, non mostrare
// mai zeri al posto di una lettura fallita, e disegnare la matrice prima→ultima su un caso finto.
// Il test gira anche su copie rotte apposta e pretende che falliscano.
// Uso: node test/statistiche-cicli.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const radice = path.join(__dirname, '..')
const jsFile = path.join(radice, 'statistiche-cicli.js')

// la risposta vera di dash_cicli('2026-10-01','2027-09-30'), letta il 20/10/2026 subito dopo la migrazione
const VERI = {"dal":"2026-10-01","ipc":{"prima":{"NR":12,"BASSO":15,"MEDIO":10},"uguali":0,"matrice":[],"migliorati":0,"peggiorati":0,"con_ritorno":0,"uguali_basso":0},"cicli":37,"lotti":37,"serie":{"n":0,"cicli":0,"fatte":0,"righe":[],"previste":0,"migliorate":0,"peggiorate":0},"classi":{"risolto":12,"cantiere_chiuso":1,"ritorno_in_attesa":24},"visite":37,"chieste":0,"percorsi":[],"divergenze":0,"visite_per_ciclo":{"dist":{"1":37},"media":1}}
// un caso finto con ritorni, percorsi e serie
const FINTI = {"dal":"2026-10-01","cicli":10,"lotti":8,"visite":21,"chieste":4,"divergenze":1,
  "classi":{"risolto":4,"risolto_dopo_3":1,"superato":1,"fermo":1,"in_percorso":1,"ritorno_non_fatto":2},
  "percorsi":[{"percorso":"visite_4_5","n":1,"risolti":1,"non_risolti":0},{"percorso":"commissione","n":1,"risolti":0,"non_risolti":0}],
  "visite_per_ciclo":{"media":2.1,"dist":{"1":3,"2":4,"3":2,"5":1}},
  "ipc":{"con_ritorno":7,"migliorati":5,"uguali":1,"uguali_basso":1,"peggiorati":1,"prima":{"NR":3,"BASSO":2,"MEDIO":4,"ALTO":1},
    "matrice":[{"da":"MEDIO","a":"BASSO","n":4},{"da":"ALTO","a":"NR","n":1},{"da":"BASSO","a":"BASSO","n":1},{"da":"BASSO","a":"ALTO","n":1}]},
  "serie":{"n":1,"previste":10,"fatte":4,"cicli":2,"migliorate":1,"peggiorate":0,"righe":[{"id":1080,"impresa":"Impresa Prova","stato":"aperto","previste":10,"fatte":4,"cicli":2,"lotti":1,"dal":"2026-10-02","al":"2026-10-16","ipc_inizio":"MEDIO","ipc_fine":"BASSO"}]}}

const testo = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const righe = (h) => (h.match(/<tr[^>]*>.*?<\/tr>/g) || []).map((r) => testo(r).trim())

function verifica(src) {
  const errori = []
  const prova = (cond, msg) => { if (!cond) errori.push(msg) }
  const ctx = { console }
  ctx.window = ctx
  vm.createContext(ctx)
  try { vm.runInContext(src, ctx) } catch (e) { return ['il file non si carica: ' + e.message] }
  const C = ctx.statCicli
  if (!C) return ['window.statCicli non c’è']
  const p26 = C.periodo('2026/2027'), p25 = C.periodo('2025/2026')
  prova(p26.da === '2026-10-01' && p26.a === '2027-09-30' && !p26.primaDeiCicli, 'esercizio 2026/2027 = 01/10/2026-30/09/2027')
  prova(p25.primaDeiCicli, 'l’esercizio 2025/2026 è prima dei cicli')

  // 🔁 Cicli di visita, con i numeri veri
  const h = C.costruisciCicli(JSON.parse(JSON.stringify(VERI)), p26)
  const t = testo(h), R = righe(h)
  const haRiga = (riga) => R.some((r) => r.startsWith(riga)) || prova(false, 'manca la riga: «' + riga + '»')
  prova(t.includes('37 cicli su 37 lotti, 37 visite'), '37 cicli su 37 lotti')
  prova(t.includes('32,4% risolti (12 su 37)'), '12 risolti su 37 = 32,4%')
  prova(t.includes('32,4% cicli chiusi (12); 25 aperti'), '12 chiusi (32,4%), 25 aperti')
  haRiga('Risolto archiviato secondo la procedura, anche con IPC basso 12 32,4%')
  haRiga('Ritorno in attesa il rientro dovuto non è ancora scaduto 24 64,9%')
  haRiga('Cantiere chiuso prima del ritorno 1 2,7%')
  haRiga('Totale 37')
  haRiga('1 visita 37 100,0%')
  prova(t.includes('vale solo il filtro Esercizio') && t.includes('nessun numero è per singolo tecnico'), 'la pagina dice che conta solo l’esercizio e niente per tecnico')
  prova(!/tecnic[oi] [A-Z]/.test(t), 'nessun nome di tecnico')
  // 📈 Miglioramento, con i numeri veri: nessun ritorno ancora
  const m = testo(C.costruisciMiglioramento(JSON.parse(JSON.stringify(VERI)), p26))
  prova(m.includes('Nessun ciclo con più di una visita'), 'senza ritorni la matrice lo dice')
  prova(m.includes('Nessun rilievo 12 32,4%') && m.includes('Basso 15 40,5%') && m.includes('Medio 10 27,0%'), 'IPC alla prima visita: 12 / 15 / 10')
  // il caso finto
  const hf = C.costruisciCicli(JSON.parse(JSON.stringify(FINTI)), p26)
  const tf = testo(hf), Rf = righe(hf)
  prova(tf.includes('50,0% risolti (5 su 10)'), 'risolti = risolto + risolto dopo la 3ª')
  prova(Rf.some((r) => r.startsWith('Fermo alla 3ª visita')) && Rf.some((r) => r.startsWith('Visite 4ª e 5ª 1 1 0')) && Rf.some((r) => r.startsWith('Caso alla Commissione 1 0 0')), 'fermi e seguiti')
  prova(tf.includes('4 volte il programma ha chiesto') && tf.includes('1 scelte diverse dalla proposta del programma (25,0%)'), 'la conferma del tecnico: 4 domande, 1 diversa')
  prova(Rf.some((r) => r.startsWith('5 o più 1 10,0%')) && tf.includes('Media: 2,1 visite per ciclo'), 'visite per ciclo')
  const hm = C.costruisciMiglioramento(JSON.parse(JSON.stringify(FINTI)), p26)
  const tm = testo(hm)
  prova(tm.includes('71,4% hanno abbassato') && tm.includes('14,3% peggiorati'), 'migliorati 5 su 7 = 71,4%, peggiorati 1 = 14,3%')
  prova(/cic-meglio">4</.test(hm) && /cic-peggio">1</.test(hm), 'matrice: 4 da medio a basso in verde, 1 da basso ad alto in rosso')
  prova(tm.includes('Impresa Prova') && tm.includes('4 / 10') && tm.includes('Medio → Basso'), 'la riga della serie: impresa, fatte su previste, IPC inizio → fine')
  // prima dei cicli, e lettura fallita
  const vuoto = testo(C.costruisciCicli({ dal: '2026-10-01', cicli: 0, lotti: 0, visite: 0, classi: {} }, p25))
  prova(vuoto.includes('partono dalle visite dal 1° ottobre 2026') && !/\b0 cicli\b/.test(vuoto), 'sull’esercizio 2025/2026 niente numeri: lo dice')
  const err = testo(C.costruisciCicli(null, p26)) + testo(C.costruisciMiglioramento({}, p26))
  prova(/Non sono riuscito a leggere/.test(err) && !/\b0\b/.test(err.replace(/2026|2027/g, '')), 'lettura fallita: lo dice e non mostra zeri')
  prova(!/Non sono riuscito/.test(t), 'con i dati buoni nessun errore')
  return errori
}

const src = fs.readFileSync(jsFile, 'utf8')
const errori = verifica(src)
const rotte = [
  ['esercizio senza cicli mostrato come zeri', src.replace('if (!T) return h + vuoto(per, d);', '')],
  ['lettura fallita mostrata come zero', src.replace("if (!d || typeof d !== 'object' || !(+d.cicli >= 0)) return errore('i dati arrivati non sono completi');\n    const T = +d.cicli || 0;\n    let h = testa(per, d);\n    if (!T) return h + vuoto(per, d);\n    const cl = d.classi || {};", "d = d && typeof d === 'object' ? d : { cicli: 0, classi: {}, dal: '2026-10-01' };\n    const T = +d.cicli || 0;\n    let h = testa(per, d);\n    const cl = d.classi || {};")],
  ['risolti senza quelli dopo la 3ª', src.replace("const risolti = (+cl.risolto || 0) + (+cl.risolto_dopo_3 || 0);", 'const risolti = (+cl.risolto || 0);')],
]
for (const [nome, rotta] of rotte) {
  if (rotta === src) { errori.push('la copia rotta «' + nome + '» è uguale all’originale: il test non prova niente'); continue }
  if (!verifica(rotta).length) errori.push('la copia rotta «' + nome + '» passa il test: il test non vede quell’errore')
}
if (errori.length) { console.error('statistiche-cicli: ' + errori.length + ' problemi'); errori.forEach((e) => console.error(' - ' + e)); process.exit(1) }
console.log('statistiche-cicli: ok (numeri del 20/10/2026, caso finto con matrice e serie, prima dei cicli, lettura fallita; 3 copie rotte riconosciute)')
