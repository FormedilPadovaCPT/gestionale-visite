// Statistiche «Per la Commissione» (20/10/2026, chiesto dall'utente dopo la seduta della Commissione
// Salute e Sicurezza): sull'esercizio 2025-26 la sottopagina deve dare gli stessi numeri del documento
// 2026_10_20_REL_Commissione-Sicurezza_statistiche-richieste (918 visite, 125 con NC, ...), con una
// sola differenza voluta: le sospese fra tutte le presenti sono 47 imprese in 87 visite, perché lo stato
// si prende dalla foto del verbale (il documento aveva contato sullo stato di oggi: 48 in 88).
// Il test gira anche su una copia rotta apposta (soglia dei gruppi piccoli tolta, lettura fallita
// mostrata come zero) e pretende che fallisca.
// Uso: node test/statistiche-commissione.test.cjs
// (COMMISSIONE_JS e COMMISSIONE_SQL permettono di farlo girare su altri file.)
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const assert = require('assert')

const radice = path.join(__dirname, '..')
const jsFile = process.env.COMMISSIONE_JS || path.join(radice, 'statistiche-commissione.js')
const sqlFile = process.env.COMMISSIONE_SQL || path.join(radice, 'supabase', 'sql', '2026_10_20c_dash_commissione.sql')

// la risposta vera di dash_commissione('2025-10-01','2026-09-30'), letta il 20/10/2026
const VERI = {"aree":[{"nc":38,"nome":"Padova città","ordine":1,"visite":271,"area_id":"padova","rischio":51,"cantieri":134,"comuni_area":1,"comuni_nomi":null,"descrizione":null,"comuni_toccati":1},{"nc":17,"nome":"Cintura urbana","ordine":2,"visite":203,"area_id":"cintura","rischio":33,"cantieri":92,"comuni_area":16,"comuni_nomi":null,"descrizione":null,"comuni_toccati":14},{"nc":24,"nome":"Alta Padovana","ordine":3,"visite":207,"area_id":"alta","rischio":33,"cantieri":135,"comuni_area":25,"comuni_nomi":null,"descrizione":"Cittadellese e Camposampierese","comuni_toccati":16},{"nc":18,"nome":"Bassa Padovana","ordine":4,"visite":112,"area_id":"bassa","rischio":23,"cantieri":61,"comuni_area":26,"comuni_nomi":null,"descrizione":"Estense, Montagnanese, Monselicense","comuni_toccati":9},{"nc":17,"nome":"Saccisica e Conselvano","ordine":5,"visite":77,"area_id":"saccisica","rischio":28,"cantieri":57,"comuni_area":19,"comuni_nomi":null,"descrizione":null,"comuni_toccati":10},{"nc":11,"nome":"Colli Euganei e Terme","ordine":6,"visite":44,"area_id":"colli","rischio":11,"cantieri":22,"comuni_area":14,"comuni_nomi":null,"descrizione":null,"comuni_toccati":6},{"nc":0,"nome":"Fuori provincia","ordine":90,"visite":4,"area_id":"fuori","rischio":1,"cantieri":3,"comuni_area":null,"comuni_nomi":["Bassano del Grappa","Dolo","Pianiga"],"descrizione":null,"comuni_toccati":3}],"ceiv":[{"g":"altre","ceiv":false,"visite":305,"imprese":179},{"g":"altre","ceiv":true,"visite":343,"imprese":139},{"g":"consulenze","ceiv":false,"visite":1,"imprese":1},{"g":"consulenze","ceiv":true,"visite":4,"imprese":1},{"g":"richiesta","ceiv":false,"visite":1,"imprese":1},{"g":"richiesta","ceiv":true,"visite":9,"imprese":6},{"g":"serie","ceiv":false,"visite":5,"imprese":2},{"g":"serie","ceiv":true,"visite":250,"imprese":16},{"g":"servizi","ceiv":false,"visite":7,"imprese":4},{"g":"servizi","ceiv":true,"visite":263,"imprese":21},{"g":"tutte","ceiv":false,"visite":312,"imprese":180},{"g":"tutte","ceiv":true,"visite":606,"imprese":149}],"ruolo":[{"nc":93,"ncg":12,"ruolo":"affidataria ed esecutrice","visite":696,"rischio":116},{"nc":6,"ncg":0,"ruolo":"esecutrice","visite":129,"rischio":31},{"nc":22,"ncg":5,"ruolo":"subappaltatrice","visite":73,"rischio":28},{"nc":0,"ncg":0,"ruolo":"affidataria","visite":13,"rischio":1},{"nc":4,"ncg":0,"ruolo":"lavoratore autonomo","visite":7,"rischio":4}],"con_nc":125,"visite":918,"con_ncg":17,"rischio":180,"sospese":{"tutte_visite":87,"tutte_imprese":47,"principali_visite":41,"principali_imprese":27},"cassa_foto":{"senza_foto":0,"stato_attuale":853,"alla_data_visita":65,"senza_principale":0},"dimensione":[{"nc":34,"ncg":5,"classe":"1-4","ordine":1,"pub_nc":3,"visite":212,"priv_nc":31,"rischio":43,"pub_visite":53,"priv_visite":159},{"nc":23,"ncg":2,"classe":"5-9","ordine":2,"pub_nc":1,"visite":116,"priv_nc":22,"rischio":36,"pub_visite":18,"priv_visite":98},{"nc":18,"ncg":3,"classe":"10-49","ordine":3,"pub_nc":3,"visite":170,"priv_nc":15,"rischio":27,"pub_visite":44,"priv_visite":126},{"nc":7,"ncg":1,"classe":"50+","ordine":4,"pub_nc":2,"visite":176,"priv_nc":5,"rischio":7,"pub_visite":136,"priv_visite":40},{"nc":43,"ncg":6,"classe":"nn","ordine":5,"pub_nc":5,"visite":244,"priv_nc":38,"rischio":67,"pub_visite":31,"priv_visite":213}],"subappalto":[{"nc":71,"visite":475,"con_sub":false},{"nc":54,"visite":443,"con_sub":true}],"committente":[{"ct":"privato","nc":10,"serv":true,"visite":80,"rischio":11},{"ct":"privato","nc":101,"serv":false,"visite":556,"rischio":152},{"ct":"pubblico","nc":5,"serv":true,"visite":190,"rischio":6},{"ct":"pubblico","nc":9,"serv":false,"visite":92,"rischio":11}]}

const testo = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ')
// una riga di tabella, come testo: «da 1 a 4 212 34 16,0% 5 20,3%»
function righe(h) { return (h.match(/<tr[^>]*>.*?<\/tr>/g) || []).map((r) => testo(r).trim()) }

function verifica(src, sql) {
  const errori = []
  const prova = (cond, msg) => { if (!cond) errori.push(msg) }
  const ctx = { console }
  ctx.window = ctx
  vm.createContext(ctx)
  try { vm.runInContext(src, ctx) } catch (e) { return ['il file non si carica: ' + e.message] }
  const C = ctx.statCommissione
  if (!C) return ['window.statCommissione non c’è']
  const per = C.periodo('2025/2026')
  prova(per.da === '2025-10-01' && per.a === '2026-09-30', 'esercizio 2025/2026 = 01/10/2025-30/09/2026')
  const st = C.periodo('')
  prova(st.da === null && st.a === null, 'tutto lo storico = nessun limite')

  const h = C.costruisci(JSON.parse(JSON.stringify(VERI)), per, { padova: ['Padova'], cintura: ['Rubano', 'Albignasego'] })
  const t = testo(h), R = righe(h)
  const haRiga = (riga) => R.includes(riga) || prova(false, 'manca la riga: «' + riga + '»')
  // in testa: i numeri del documento
  prova(t.includes('13,6% visite con almeno una non conformità (125 su 918)'), '13,6%: 125 su 918')
  prova(t.includes('17,5% nei cantieri privati, contro 5,0% dei pubblici'), 'privato 17,5%, pubblico 5,0%')
  prova(t.includes('20,6% privati, imprese sotto i 10 addetti; 12,0% le altre'), 'privati sotto i 10 addetti 20,6%, le altre 12,0%')
  prova(t.includes("30,1% quando l'impresa visitata è una subappaltatrice (73 visite)"), 'subappaltatrice 30,1%')
  // 1. dimensione
  haRiga('da 1 a 4 212 34 16,0% 5 20,3%')
  haRiga('da 5 a 9 116 23 19,8% 2 31,0%')
  haRiga('da 10 a 49 170 18 10,6% 3 15,9%')
  haRiga('50 e oltre 176 7 4,0% 1 4,0%')
  haRiga('addetti non noti 244 43 17,6% 6 27,5%')
  haRiga('Totale 918 125 13,6% 17 19,6%')
  haRiga('da 1 a 4 159 19,5% 53 5,7%')
  haRiga('50 e oltre 40 12,5% 136 1,5%')
  haRiga('addetti non noti 213 17,8% 31 16,1%')
  prova(t.includes('noti per 674 visite su 918'), 'addetti noti per 674 visite su 918')
  // 2. committente
  haRiga('Privato 636 111 17,5% 25,6%')
  haRiga('altre visite 556 101 18,2% 27,3%')
  haRiga('su richiesta o in serie 80 10 12,5% 13,8%')
  haRiga('Pubblico 282 14 5,0% 6,0%')
  haRiga('altre visite 92 9 9,8% 12,0%')
  haRiga('su richiesta o in serie 190 5 2,6% 3,2%')
  // 3. ruolo e subappalto: i gruppi piccoli si dicono
  haRiga('Affidataria ed esecutrice 696 93 13,4% 12 16,7%')
  haRiga('Esecutrice 129 6 4,7% 0 24,0%')
  haRiga('Subappaltatrice 73 22 30,1% 5 38,4%')
  haRiga('Affidataria (non esegue) 13 0 0,0% ⚠ 0 7,7% ⚠')
  haRiga('Lavoratore autonomo 7 4 pochi dati 0 pochi dati')
  prova(t.includes('Con subappaltatrici fra le presenti: 12,2% di visite con NC (443 visite); senza: 14,9% (475)'), 'presenza di subappaltatrici 12,2% / 14,9%')
  // 4. C.E.I.V.
  haRiga('Servizi su richiesta 21 263 4 7')
  haRiga('visite in serie 16 250 2 5')
  haRiga('su richiesta 6 9 1 1')
  haRiga('consulenze con attestazione 1 4 1 1')
  haRiga('Tutte le altre visite 139 343 179 305')
  prova(t.includes('Imprese C.E.I.V. visitate: 149 , di cui 21 (14,1%) con un servizio'), '149 imprese C.E.I.V., 21 con servizi')
  // 5. territorio
  haRiga('Padova città 271 29,5% 134 1 su 1 14,0% 18,8%')
  haRiga('Cintura urbana 203 22,1% 92 14 su 16 8,4% 16,3%')
  haRiga('Alta Padovana (Cittadellese e Camposampierese) 207 22,5% 135 16 su 25 11,6% 15,9%')
  haRiga('Bassa Padovana (Estense, Montagnanese, Monselicense) 112 12,2% 61 9 su 26 16,1% 20,5%')
  haRiga('Saccisica e Conselvano 77 8,4% 57 10 su 19 22,1% 36,4%')
  haRiga('Colli Euganei e Terme 44 4,8% 22 6 su 14 25,0% 25,0%')
  haRiga('Fuori provincia Bassano del Grappa, Dolo, Pianiga 4 0,4% 3 3 pochi dati pochi dati')
  prova(t.includes('I 101 comuni della provincia in 6 aree'), '101 comuni in 6 aree')
  prova(t.includes('Cintura urbana : Albignasego, Rubano.'), 'elenco dei comuni per area, in ordine')
  // 6. sospese: solo conteggi
  prova(t.includes('41 visite rivolte a un\'impresa sospesa, a 27 imprese'), 'sospese principali 41 visite, 27 imprese')
  prova(t.includes('87 visite con almeno un\'impresa sospesa fra tutte le presenti: 47 imprese'), 'sospese fra tutte le presenti 47 in 87 (foto del verbale)')
  prova((h.match(/<section class="com-sez/g) || []).length === 6, 'sei sezioni in riquadri')
  prova(/<span>6<\/span>Le visite sul territorio/.test(h) && /<span>5<\/span>Imprese sospese/.test(h), 'sospese 5, territorio 6')
  // niente dati per tecnico, nessun nome di impresa
  prova(!/tecnic[oi] [A-Z]|Caon|De Marco|Bortolami/.test(t), 'nessun nome di tecnico')
  prova(t.includes('nessun numero è per singolo tecnico'), 'la scheda dice che non ci sono dati per tecnico')

  // la lettura fallita non diventa zero
  const rotta = testo(C.costruisci(null, per))
  prova(/Non sono riuscito a leggere/.test(rotta) && !/\b0\b/.test(rotta), 'lettura fallita: «non sono riuscito a leggere», nessuno zero')
  prova(/Non sono riuscito a leggere/.test(testo(C.costruisci({ errore: 'x' }, per))), 'dati incompleti: «non sono riuscito a leggere»')
  prova(/Non sono riuscito a leggere l'elenco dei comuni/.test(testo(C.elencoComuni([{ area_id: 'padova', nome: 'Padova città' }], null))), 'elenco dei comuni non letto: lo si dice')
  prova(src.includes("sb.rpc('dash_commissione'") && /if \(err \|\| !data\)/.test(src), 'la pagina legge dash_commissione e controlla l’errore')

  // il database: solo totali, foto della Cassa, chi non è personale riceve un errore
  const corpo = sql.slice(sql.indexOf('select jsonb_build_object('), sql.indexOf('revoke all on function public.dash_commissione_calcolo'))
  prova(corpo.length > 1000, 'corpo della funzione trovato')
  prova(!/ragione_sociale|denominazione|tecnico_id|tecnico2_id|nome_tecnico/.test(corpo), 'la funzione non restituisce nomi di imprese né tecnici')
  prova(/from v_visite_cassa/.test(sql) && !/stato_cassa/.test(sql.replace(/imprese\.stato_cassa/g, '')), 'lo stato in Cassa viene dalla foto del verbale (v_visite_cassa)')
  prova(/raise exception 'dash_commissione: non autorizzato'/.test(sql), 'chi non è personale riceve un errore, non zeri')
  prova(/revoke all on function public\.dash_commissione_calcolo\(date, date\) from public, anon, authenticated/.test(sql), 'il calcolo interno non si chiama da fuori')
  prova(/v\.data_visita >= p_da/.test(sql) && !/created_at/.test(corpo), 'periodo per data della visita')
  prova(/elimina is distinct from 1/.test(sql), 'escluse le eliminate')
  prova(/c\.valore in \('NC-','NC\+'\)/.test(sql), 'NC = almeno un NC- o NC+')
  prova(/tipo_accesso in \(2, 8, 11\)/.test(sql), 'servizi su richiesta = tipo di accesso 2, 8, 11')
  return errori
}

const src = fs.readFileSync(jsFile, 'utf8')
const sql = fs.readFileSync(sqlFile, 'utf8')
const errori = verifica(src, sql)
assert.deepStrictEqual(errori, [], 'statistiche per la Commissione:\n - ' + errori.join('\n - '))

// controprova: una copia rotta apposta deve far fallire il test
const rottaSoglia = src.replace('const SOGLIA_PICCOLO = 10;', 'const SOGLIA_PICCOLO = 0;')
assert.notStrictEqual(rottaSoglia, src, 'non trovo la soglia da rompere')
assert.ok(verifica(rottaSoglia, sql).some((e) => e.includes('Lavoratore autonomo')), 'senza soglia dei gruppi piccoli il test deve fallire')
const rottaZero = src.replace("if (!d || typeof d !== 'object' || !(+d.visite >= 0)) return", "if (!d) d = { visite: 0 }; if (false) return")
assert.notStrictEqual(rottaZero, src, 'non trovo il controllo della lettura da rompere')
assert.ok(verifica(rottaZero, sql).some((e) => e.includes('lettura fallita')), 'una lettura fallita mostrata come zero deve far fallire il test')
assert.ok(verifica(src, sql.replace('from v_visite_cassa x', 'from imprese x')).some((e) => e.includes('foto del verbale')), 'lo stato in Cassa preso fuori dalla foto deve far fallire il test')

console.log('OK statistiche per la Commissione')
