// Cicli di visita (20/10/2026): la regola sulla visita del ciclo in cicli-visita.js deve essere la stessa
// tabella di ciclo_regola nel database (supabase/sql/2026_10_20d_cicli_visita.sql); la data di ritorno
// di una visita col ciclo prende i giorni scritti dal database; senza risposta alla domanda del programma
// il verbale non si chiude; il ciclo non va mai sul PDF né nella mail all'impresa; gli agganci in
// index.html, nella lettera mensile della segreteria e nel workflow di pubblicazione ci sono.
// Il test gira anche su due copie rotte apposta (soglia della 5ª visita spostata; domanda senza risposta
// che non ferma la chiusura) e pretende che falliscano.
// Uso: node test/cicli-visita.test.cjs
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const radice = path.join(__dirname, '..')
const jsFile = path.join(radice, 'cicli-visita.js')
const sqlFile = path.join(radice, 'supabase', 'sql', '2026_10_20d_cicli_visita.sql')

// la tabella della proposta (pagina «Cicli di visita al cantiere», sezione «Dentro il ciclo»)
const TABELLA = [
  // n, ipc, autorizzata, giorni, esito
  [1, 'NR', false, null, 'archivia'], [1, 'BASSO', false, 22, 'ritorno'], [1, 'MEDIO', false, 22, 'ritorno'], [1, 'ALTO', false, 3, 'ritorno'],
  [2, 'NR', false, null, 'archivia'], [2, 'BASSO', false, null, 'archivia'], [2, 'MEDIO', false, 22, 'ritorno'], [2, 'ALTO', false, 3, 'ritorno'],
  [3, 'NR', false, null, 'archivia'], [3, 'BASSO', false, null, 'archivia'], [3, 'MEDIO', false, null, 'fermo'], [3, 'ALTO', false, 3, 'critico'],
  [3, 'MEDIO', true, 22, 'ritorno'],   // autorizzata dal Coordinatore o dentro una serie
  [4, 'MEDIO', false, null, 'fermo'], [4, 'MEDIO', true, 22, 'ritorno'], [4, 'ALTO', true, 3, 'critico'], [4, 'BASSO', true, null, 'archivia'],
  [5, 'MEDIO', true, null, 'critico'], [5, 'MEDIO', false, null, 'critico'], [5, 'ALTO', false, 3, 'critico'], [6, 'MEDIO', true, null, 'critico'],
]

function carica(src) {
  const ctx = { console, setTimeout, clearTimeout, prompt: () => null, alert: () => {} }
  ctx.window = ctx
  ctx.document = { getElementById: () => null }   // niente pagina: il riquadro non si disegna, la logica sì
  ctx.S = { fd: {}, imprese: [], lavorazioni: [], checklist: {} }
  ctx.vGet = (id) => ctx._campi[id] || ''
  ctx._campi = {}
  ctx.calcIPC = () => ({ ipc: ctx._ipc || 'NR' })
  ctx.TIPO_IMP_RUOLO = { 1: 'affidataria ed esecutrice', 2: 'subappaltatrice', 3: 'affidataria' }
  ctx.toast = (m) => { ctx._toast = m }
  ctx.activateTab = () => {}
  vm.createContext(ctx)
  vm.runInContext(src, ctx)
  return ctx
}

async function verifica(src) {
  const errori = []
  const prova = (cond, msg) => { if (!cond) errori.push(msg) }
  let ctx
  try { ctx = carica(src) } catch (e) { return ['il file non si carica: ' + e.message] }
  const C = ctx.CicliVisita
  if (!C) return ['window.CicliVisita non c’è']

  // 1. la regola
  for (const [n, ipc, aut, giorni, esito] of TABELLA) {
    const r = C.regola(n, ipc, aut)
    prova(r.giorni === giorni && r.esito === esito, `regola(${n}, ${ipc}, ${aut}) = ${giorni}/${esito}, invece ${r.giorni}/${r.esito}`)
  }
  prova(C.regola(1, 'ALTO').tipo === 'urgente' && C.regola(2, 'ALTO').tipo === 'immediata', 'IPC alto: urgente alla 1ª, immediata dalla 2ª')
  prova(C.regola(2, 'ALTO').nota.includes('segnalazione'), 'IPC alto alla 2ª visita: segnalazione alla Segreteria')
  prova(C.regola(3, 'MEDIO').nota.includes('Coordinatore'), 'IPC medio alla 3ª: il caso va al Coordinatore')
  prova(C.regola(0, 'medio ').esito === 'ritorno' && C.regola(null, '').esito === 'archivia', 'n e ipc sporchi si normalizzano')

  // 2. la stessa tabella nel database
  const sql = fs.readFileSync(sqlFile, 'utf8')
  const chiavi = [
    "'esito', case when n >= 3 then 'critico' else 'ritorno' end",
    "when n <= 2 then jsonb_build_object('giorni', 22, 'esito', 'ritorno'",
    "when n >= 5 then jsonb_build_object('giorni', null, 'esito', 'critico'",
    "when coalesce(p_autorizzata, false) then jsonb_build_object('giorni', 22, 'esito', 'ritorno'",
    "else jsonb_build_object('giorni', null, 'esito', 'fermo'",
    "when n = 1 then jsonb_build_object('giorni', 22, 'esito', 'ritorno', 'tipo', 'ordinaria', 'nota', 'IPC basso",
    "ciclo_rientro_giorni = (r ->> 'giorni')::int",
    "x.tipo_accesso is distinct from 10",
    "x.data_visita >= date '2026-10-01'",
    "not in ('affidataria', 'fornitrice')",
  ]
  chiavi.forEach((k) => prova(sql.includes(k), 'nel SQL manca: ' + k))
  const sqlSenzaCommenti = sql.split('\n').map((r) => r.replace(/--.*$/, '')).join('\n')
  prova(!/fattur|compens|importo_voce/i.test(sqlSenzaCommenti), 'il SQL dei cicli non tocca i compensi dei tecnici (decisione del Direttore ancora aperta)')

  // 3. il rientro di una visita: col ciclo i giorni del database, senza la regola per accesso
  const r1 = C.rientro({ data_visita: '2026-10-05', ciclo_visita: 2, ciclo_rientro_giorni: 22, ciclo_esito: 'ritorno', ipc: 'MEDIO', acc_cant: '7' })
  prova(r1.ciclo && r1.date && r1.date.getDate() === 27 && r1.date.getMonth() === 9 && r1.tipo === 'ordinaria', 'visita 2 del ciclo con IPC medio: ritorno il 27/10 (accesso 7 ignorato)')
  const r2 = C.rientro({ data_visita: '2026-10-05', ciclo_visita: 3, ciclo_rientro_giorni: null, ciclo_esito: 'fermo', ipc: 'MEDIO', acc_cant: '3' })
  prova(r2.ciclo && !r2.date && r2.esito === 'fermo', 'ciclo fermo: nessuna data di ritorno')
  prova(C.rientro({ data_visita: '2026-10-05', ciclo_visita: 1, ciclo_rientro_giorni: 3 }).tipo === 'urgente' && C.rientro({ data_visita: '2026-10-05', ciclo_visita: 2, ciclo_rientro_giorni: 3 }).tipo === 'immediata', 'tipo del ritorno a 3 giorni')
  ctx.calcRientroFormedil = (d, acc, ipc) => ({ date: new Date('2025-05-05'), tipo: 'ordinaria' })
  const r3 = C.rientro({ data_visita: '2025-05-01', ciclo_visita: null, acc_cant: '2', ipc: 'MEDIO' })
  prova(!r3.ciclo && r3.date && r3.date.getFullYear() === 2025, 'senza ciclo (storico) vale calcRientroFormedil')

  // 4. la domanda del programma: senza risposta il verbale non si chiude
  ctx._campi = { 'f-cant-id': 'C1', 'f-data': '2026-10-20', 'f-tipo': '5' }
  ctx.S.imprese = [{ impresa_id: 'A', tipo_imp: 1 }, { impresa_id: 'B', tipo_imp: 2 }, { impresa_id: 'F', tipo_imp: 3 }]
  ctx.S.lavorazioni = [{ genere: 'g', fase: 'Coperture', lavorazione: 'x' }]
  let rpcArgs = null
  ctx.sb = { rpc: async (nome, args) => { rpcArgs = { nome, args }; return { data: { proposta: 'nuovo', chiede: true, motivo: 'imprese esecutrici tutte diverse e fasi di lavoro nuove', ciclo: { ciclo_id: 9, numero: 1, n_visite: 2, stato: 'aperto' }, visita_se_continua: 3, autorizzata: false, regola: {} }, error: null } } }
  await C.proponi()
  prova(rpcArgs && rpcArgs.nome === 'ciclo_proposta', 'la proposta la chiede al database (ciclo_proposta)')
  prova(rpcArgs && rpcArgs.args.p_imprese.length === 2 && !rpcArgs.args.p_imprese.includes('F'), 'al database vanno le imprese che eseguono: l’affidataria che non esegue resta fuori')
  prova(rpcArgs && rpcArgs.args.p_fasi[0] === 'coperture', 'le fasi vanno al database in minuscolo')
  prova(C.attivo() && C.numeroVisita() === 1 && C.numeroCiclo() === 2, 'proposta «nuovo»: visita 1 del ciclo 2')
  prova(C.pronto('bozza') === true, 'una bozza si salva anche senza risposta')
  prova(C.pronto('definitivo') === false, 'senza risposta alla domanda il definitivo si ferma')
  prova(/Rispondi nel Riepilogo/.test(ctx._toast || ''), 'e lo dice al tecnico')
  ctx.S.fd.ciclo = { scelta: 'continua' }   // contro la proposta, senza motivo
  prova(C.pronto('definitivo') === false, 'contro la proposta serve il motivo')
  prova(C.numeroVisita() === 3 && C.numeroCiclo() === 1, 'scelta «continua»: visita 3 del ciclo 1')
  ctx.S.fd.ciclo = { scelta: 'continua', motivo_tipo: 'stessa_fase', motivo: '' }
  prova(C.pronto('definitivo') === true, 'con il motivo si chiude')
  const campi = C.campi()
  prova(campi.ciclo_scelta === 'continua' && campi.ciclo_motivo_tipo === 'stessa_fase' && campi.ciclo_motivo === null, 'nel verbale vanno scelta e motivo, niente altro')
  prova(!('ciclo_visita' in campi) && !('ciclo_id' in campi), 'ciclo e visita del ciclo li scrive il database, non la maschera')
  ctx._ipc = 'MEDIO'
  const rit = C.calcRitorno('2026-10-20', 'MEDIO')
  prova(rit && rit.esito === 'fermo' && !rit.date, 'visita 3 del ciclo con IPC medio: il ciclo si ferma, nessuna data')
  ctx.S.fd.ciclo = { scelta: 'nuovo' }
  const rit2 = C.calcRitorno('2026-10-20', 'MEDIO')
  prova(rit2 && rit2.esito === 'ritorno' && rit2.giorni !== null && rit2.date && rit2.date.getDate() === 11 && rit2.date.getMonth() === 10, 'ciclo nuovo con IPC medio: ritorno a 22 giorni (11/11)')
  C.daSnap({ ciclo_scelta: 'nuovo', ciclo_motivo_tipo: 'fase_nuova', ciclo_motivo: 'coperture' })
  prova(C.campi().ciclo_motivo === 'coperture' && !C.attivo(), 'alla riapertura la risposta torna dal database e la proposta si richiede')
  C.azzera()
  prova(C.campi().ciclo_scelta === null, 'la visita nuova riparte senza risposta')

  // 5. il badge e il dettaglio
  prova(C.badge({ ciclo_visita: 2, ciclo_divergente: true, visite_cicli: { numero: 1, stato: 'aperto' } }).includes('1·v2') && C.badge({ ciclo_visita: null }) === '', 'badge: ciclo·visita, niente sullo storico')
  prova(C.dettaglio({ ciclo_visita: 3, ciclo_esito: 'fermo', visite_cicli: { numero: 2, n_visite: 3, stato: 'fermo' }, ciclo_proposta: { proposta: 'continua', motivo: 'stesse imprese' } }).some((r) => /Coordinatore/.test(r[1])), 'dettaglio: il ciclo fermo lo dice')

  // 6. gli agganci
  const index = fs.readFileSync(path.join(radice, 'index.html'), 'utf8')
  ;['cicli-visita.js?v=', 'statistiche-cicli.js?v=', 'CicliVisita.pronto(stato)', 'CicliVisita.campi()', 'CicliVisita.daSnap(snap)', 'CicliVisita.rientro(v)', 'CicliVisita.badge(v)', 'CicliVisita.dettaglio(v)', 'CicliVisita.proponi()', 'CicliVisita.render()', 'CicliVisita.azzera()', 'id="ciclo-box"', 'id="adm-cicli"', 'ciclo_visita,ciclo_esito,ciclo_rientro_giorni,tecnico_id']
    .forEach((k) => prova(index.includes(k), 'in index.html manca: ' + k))
  const pdf = fs.readFileSync(path.join(radice, 'verbale-pdf.js'), 'utf8')
  prova(!/ciclo_(scelta|visita|motivo|proposta)/.test(pdf), 'il ciclo non va sul PDF del verbale')
  const sendVerbale = path.join(radice, 'supabase', 'functions', 'send-verbale', 'index.ts')
  if (fs.existsSync(sendVerbale)) prova(!/ciclo_(scelta|visita|motivo|proposta)/.test(fs.readFileSync(sendVerbale, 'utf8')), 'il ciclo non va nella mail all’impresa')
  const coord = fs.readFileSync(path.join(radice, 'cantieri-critici-coord.js'), 'utf8')
  prova(coord.includes('CicliVisita.boxCoord()'), 'la Zona Coordinatore carica il riquadro dei cicli')
  const veste = fs.readFileSync(path.join(radice, 'veste-v2.js'), 'utf8')
  prova(veste.includes("['cicli', '🔁 Cicli di visita'") && veste.includes("['miglioramento', '📈 Miglioramento e serie'"), 'le due sottopagine nelle pillole delle Statistiche')
  const yml = fs.readFileSync(path.join(radice, '.github', 'workflows', 'deploy-pages.yml'), 'utf8')
  prova((yml.match(/cicli-visita\.js/g) || []).length >= 2 && (yml.match(/statistiche-cicli\.js/g) || []).length >= 2, 'i due file nel workflow di pubblicazione (paths e _site)')
  const seg = path.join(radice, '..', 'segreteria-app', 'js', 'fatture-tecnici.js')
  if (fs.existsSync(seg)) { const s = fs.readFileSync(seg, 'utf8'); prova(s.includes('rientroVisita(v)') && s.includes('ciclo_visita, ciclo_rientro_giorni'), 'la lettera mensile della segreteria legge la visita del ciclo') }
  return errori
}

;(async () => {
  const src = fs.readFileSync(jsFile, 'utf8')
  const errori = await verifica(src)
  // le copie rotte apposta devono fallire
  const rotte = [
    ['soglia della 5ª visita spostata', src.replace("if (n >= 5) return r(null, 'critico'", "if (n >= 6) return r(null, 'critico'")],
    ['domanda senza risposta che non ferma la chiusura', src.replace("if (_prop.chiede && !st.scelta) {\n      avviso('Ciclo di visita: il programma ti chiede", "if (false) {\n      avviso('Ciclo di visita: il programma ti chiede")],
    ['affidataria che non esegue contata fra le esecutrici', src.replace(".filter((x) => x.ruolo !== 'affidataria' && x.ruolo !== 'fornitrice')", '')],
  ]
  for (const [nome, rotta] of rotte) {
    if (rotta === src) { errori.push('la copia rotta «' + nome + '» è uguale all’originale: il test non prova niente'); continue }
    const e = await verifica(rotta)
    if (!e.length) errori.push('la copia rotta «' + nome + '» passa il test: il test non vede quell’errore')
  }
  if (errori.length) { console.error('cicli-visita: ' + errori.length + ' problemi'); errori.forEach((e) => console.error(' - ' + e)); process.exit(1) }
  console.log('cicli-visita: ok (regola come nel database, rientro col ciclo, domanda che ferma la chiusura, niente sul PDF, agganci; 3 copie rotte riconosciute)')
})().catch((e) => { console.error(e); process.exit(1) })
