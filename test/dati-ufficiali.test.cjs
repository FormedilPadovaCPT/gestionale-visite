// Dati ufficiali dell'impresa da P.IVA / CF (03/10/2026): lettura delle
// risposte di VIES e InfoCamere (edge function) e confronto con la scheda
// (dati-ufficiali.js). Le risposte sono quelle vere: VIES sulla P.IVA della
// Romanato Scavi (provata il 03/10), InfoCamere l'esempio della documentazione.
const fs = require('fs')
const path = require('path')
const assert = require('assert')

;(async () => {
  const parse = await import(path.join(__dirname, '..', 'supabase', 'functions', 'dati-impresa-ufficiali', 'parse.js').replace(/\\/g, '/').replace(/^([A-Z]):/, 'file:///$1:'))

  // ── codici ──
  assert.strictEqual(parse.normalizzaCodice(' it 045 412 80287 '), '04541280287')
  assert.ok(parse.isCf('RMNDRN70A01B213B') && parse.isCf('04541280287'))
  assert.ok(!parse.isCf('0454128028') && !parse.isCf('ABC'))

  // ── VIES ──
  const vies = parse.parseVies({
    countryCode: 'IT', vatNumber: '04541280287', valid: true,
    name: 'ROMANATO SCAVI DI ROMANATO ADRIANO',
    address: 'VIA PORTO INFERIORE N 15 INT 2 \n35020 BRUGINE PD\n',
    traderName: '---',
  })
  assert.deepStrictEqual(vies, {
    valida: true, ragione_sociale: 'ROMANATO SCAVI DI ROMANATO ADRIANO',
    indirizzo: 'VIA PORTO INFERIORE N 15 INT 2', cap: '35020', comune: 'BRUGINE', prov: 'PD',
  })
  assert.deepStrictEqual(parse.parseVies({ valid: false, name: '---', address: '---' }), { valida: false })
  // comune su più parole
  assert.strictEqual(parse.parseVies({ valid: true, name: 'X', address: 'VIA ROMA 1\n35031 ABANO TERME PD' }).comune, 'ABANO TERME')

  // ── InfoCamere ──
  const xml = `<imprese>
<data-erogazione data="06/06/2024"/>
<dati-impresa denominazione="EDIL ROSSI &amp; FIGLI S.R.L." c-fiscale="11111111111" c-statoimpresa="Registrata" dt-registrazione="20/05/2010" c-nace="41.2">
<forma-giuridica codice="SR">SOCIETA' A RESPONSABILITA' LIMITATA</forma-giuridica>
<indirizzo comune="ROMA" provincia="RM" toponimo="VIA" via="ROMA" n-civico="3" cap="22333"/>
<data-aggiornamento data="01/06/2024"/>
</dati-impresa>
</imprese>`
  const ic = parse.parseInfocamere(xml)
  assert.strictEqual(ic.erogazione, '06/06/2024')
  assert.strictEqual(ic.imprese.length, 1)
  const i0 = ic.imprese[0]
  assert.strictEqual(i0.ragione_sociale, 'EDIL ROSSI & FIGLI S.R.L.')
  assert.strictEqual(i0.cf, '11111111111')
  assert.strictEqual(i0.indirizzo, 'VIA ROMA, 3')
  assert.strictEqual(i0.comune, 'ROMA'); assert.strictEqual(i0.prov, 'RM'); assert.strictEqual(i0.cap, '22333')
  assert.strictEqual(i0.forma_app, 'S.r.l.')
  assert.strictEqual(i0.nace, '41.2')
  // nessuna impresa: la risposta ha solo la data di erogazione
  assert.strictEqual(parse.parseInfocamere('<imprese><data-erogazione data="06/06/2024"/></imprese>').imprese.length, 0)

  // risposta VERA del 03/10/2026 (ICM S.p.A.): lo stato sta in c-stato-impresa, non c-statoimpresa
  const vera = parse.parseInfocamere(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<imprese>
    <data-erogazione data="03/10/2026"/>
    <dati-impresa denominazione="ICM S.P.A." c-fiscale="00184540276" c-stato-impresa="Registrata" dt-registrazione="20/09/1994" c-nace="42.11">
        <forma-giuridica codice="SP">SOCIETA' PER AZIONI</forma-giuridica>
        <indirizzo comune="VICENZA" provincia="VI" toponimo="VIALE" via="DELL'INDUSTRIA" n-civico="42" cap="36100"/>
        <data-aggiornamento data="21/07/2026"/>
    </dati-impresa>
</imprese>`).imprese[0]
  assert.strictEqual(vera.stato, 'Registrata', "lo stato dell'impresa va letto da c-stato-impresa")
  assert.strictEqual(vera.indirizzo, "VIALE DELL'INDUSTRIA, 42")
  assert.strictEqual(vera.forma_app, 'S.p.A.')
  assert.strictEqual(vera.aggiornato_al, '21/07/2026')

  // scadenza della chiave (JWT): exp 1791073863 = 04/10/2026 00:31 UTC
  const finto = 'x.' + Buffer.from(JSON.stringify({ sub: 'prova', exp: 1791073863 })).toString('base64').replace(/=+$/, '') + '.y'
  assert.strictEqual(parse.scadenzaToken(finto).toISOString(), '2026-10-04T00:31:03.000Z')
  assert.strictEqual(parse.scadenzaToken('non-una-chiave'), null)

  // la chiave nella mail di InfoCamere (testo vero del 03/10, chiave finta)
  const jwt = exp => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: 'prova', exp })).toString('base64url') + '.firma_finta-1'
  const mail = `Gentile Utente,

Si prega di tenere presente che questo token ha una validità di 6 ore dall'invio di questa email.

Authorization Token: ${jwt(1791073863)}

Cordiali saluti.`
  assert.strictEqual(parse.chiaveDaMail(mail), jwt(1791073863))
  assert.strictEqual(parse.chiaveDaMail('Gentile Utente, nessuna chiave qui'), '')
  assert.strictEqual(parse.chiavePiuNuova([jwt(1791073863), jwt(1791095000), 'rotta']), jwt(1791095000), 'vale la chiave che scade più tardi')
  assert.strictEqual(parse.chiavePiuNuova([]), '')

  // ── forme giuridiche: solo voci della tendina, mai a stima ──
  assert.strictEqual(parse.formaApp("SOCIETA' A RESPONSABILITA' LIMITATA SEMPLIFICATA"), 'S.r.l.s')
  assert.strictEqual(parse.formaApp("SOCIETA' A RESPONSABILITA' LIMITATA CON UNICO SOCIO"), 'S.r.l. Unipersonale')
  assert.strictEqual(parse.formaApp("SOCIETA' IN NOME COLLETTIVO"), 'S.n.c.')
  assert.strictEqual(parse.formaApp("SOCIETA' IN ACCOMANDITA SEMPLICE"), 'S.A.S.')
  assert.strictEqual(parse.formaApp("SOCIETA' PER AZIONI"), 'S.p.A.')
  assert.strictEqual(parse.formaApp("SOCIETA' IN ACCOMANDITA PER AZIONI"), '')
  assert.strictEqual(parse.formaApp("SOCIETA' COOPERATIVA"), 'S.coop.')
  assert.strictEqual(parse.formaApp("SOCIETA' CONSORTILE A RESPONSABILITA' LIMITATA"), 'Consorzio')
  assert.strictEqual(parse.formaApp("SOCIETA' SEMPLICE"), '')

  // ── confronto con la scheda (dati-ufficiali.js) ──
  const sorgente = fs.readFileSync(path.join(__dirname, '..', 'dati-ufficiali.js'), 'utf8')
  const window = {}
  const document = { readyState: 'complete', getElementById: () => null, head: { appendChild() {} }, createElement: () => ({}) }
  new Function('window', 'document', 'console', sorgente)(window, document, console)
  const D = window.DatiUfficiali

  // il campo «P.IVA» della modifica contiene la chiave, cioè spesso un CF di 16
  assert.deepStrictEqual(D.richiesta('RMNDRN70A01B213B', ''), { piva: '', cf: 'RMNDRN70A01B213B' })
  assert.deepStrictEqual(D.richiesta('IT04541280287', ''), { piva: '04541280287', cf: '' })
  assert.deepStrictEqual(D.richiesta('', '04541280287'), { piva: '04541280287', cf: '04541280287' })
  assert.strictEqual(D.richiesta('123', 'boh'), null)

  // Romanato: ditta individuale, InfoCamere non la conosce, VIES sì.
  // In anagrafica c'era «ROMANATO SCAVI DI ADRIANO ROMANATO» (nome girato).
  const respDitta = {
    infocamere: { esito: 'non_trovata', messaggio: 'non è nell\'elenco InfoCamere' },
    vies: { esito: 'ok', chiave: '04541280287', dati: vies },
  }
  const scheda = { nome: 'ROMANATO SCAVI DI ADRIANO ROMANATO', piva: '04541280287', cf: '', ind: 'Via Porto Inferiore 15', com: 'Campagnola di Brugine (PD)', forma: '' }
  const r1 = D.proposte(respDitta, scheda, false)
  const nome = r1.find(r => r.campo === 'nome')
  assert.ok(nome && nome.spunta && nome.fonte === 'VIES' && nome.ufficiale === 'ROMANATO SCAVI DI ROMANATO ADRIANO')
  assert.ok(!r1.find(r => r.campo === 'cf'), 'senza InfoCamere il CF non si propone')
  assert.ok(!r1.find(r => r.campo === 'forma'), 'la forma giuridica si propone solo da InfoCamere')
  const com = r1.find(r => r.campo === 'com')
  assert.ok(com && com.cap === '35020' && com.prov === 'PD')

  // uguali a meno di maiuscole e punteggiatura: nessuna spunta
  assert.ok(D.uguali('Via Roma, 3', 'VIA ROMA 3'))
  const r2 = D.proposte(respDitta, { ...scheda, nome: 'Romanato Scavi di Romanato Adriano' }, false)
  assert.ok(r2.find(r => r.campo === 'nome').uguale)

  // società da InfoCamere: nella modifica il CF diverso NON si propone di cambiarlo
  const respSoc = { infocamere: { esito: 'ok', dati: i0 }, vies: { esito: 'ok', chiave: '11111111111', dati: { ragione_sociale: 'EDIL ROSSI E FIGLI SRL', indirizzo: 'VIA ROMA 3', cap: '22333', comune: 'ROMA', prov: 'RM' } } }
  const r3 = D.proposte(respSoc, { nome: 'Edil Rossi', piva: '11111111111', cf: '22222222222', ind: '', com: '', forma: '' }, false)
  const cf3 = r3.find(r => r.campo === 'cf')
  assert.ok(cf3 && !cf3.spunta && cf3.bloccato, 'il CF di un\'impresa esistente non si cambia da qui')
  assert.strictEqual(r3.find(r => r.campo === 'nome').fonte, 'InfoCamere', 'InfoCamere vince su VIES')
  assert.strictEqual(r3.find(r => r.campo === 'forma').ufficiale, 'S.r.l.')
  // nella nuova impresa il CF si riporta
  const r4 = D.proposte(respSoc, { nome: '', piva: '', cf: '', ind: '', com: '', forma: '' }, true)
  assert.ok(r4.find(r => r.campo === 'cf').spunta)
  assert.ok(r4.find(r => r.campo === 'piva').spunta)

  // l'HTML non lascia passare codice nei dati
  const h = D.tabella([{ campo: 'nome', etichetta: 'Ragione sociale', attuale: '<b>x', ufficiale: '<script>alert(1)</script>', fonte: 'VIES', spunta: true }])
  assert.ok(!h.includes('<script>') && h.includes('&lt;script&gt;'))
  // un'impresa cessata si vede subito
  assert.ok(D.intestazione({ infocamere: { esito: 'ok', dati: { ...i0, stato: 'Cessata' } }, vies: {} }).includes('Cessata'))

  // extra(): CAP e provincia solo se il comune è ancora quello riportato
  D._stato.ei = { righe: [], riportati: { comune: 'BRUGINE', cap: '35020', prov: 'PD', tipo_impresa: 'S.r.l.' } }
  assert.deepStrictEqual(D.extra('ei', 'Brugine'), { cap: '35020', prov: 'PD', tipo_impresa: 'S.r.l.' })
  assert.deepStrictEqual(D.extra('ei', 'PADOVA'), { tipo_impresa: 'S.r.l.' })
  D._stato.mi = { righe: [], riportati: { comune: 'BRUGINE', cap: '35020', prov: 'PD', tipo_impresa: 'S.r.l.' } }
  assert.deepStrictEqual(D.extra('mi', 'BRUGINE'), { cap: '35020', prov: 'PD' }, 'nella nuova la forma la porta già la tendina')
  D._stato.mi = null
  assert.deepStrictEqual(D.extra('mi', 'BRUGINE'), {})

  console.log('dati-ufficiali: tutte le prove passate')
})().catch(e => { console.error(e); process.exit(1) })
