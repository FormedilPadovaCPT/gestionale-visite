# -*- coding: utf-8 -*-
"""23/09/2026 - PDF anche dalla bozza, riconoscibile come bozza.

Chiesto dall'utente: generare il verbale anche da una visita in bozza.
- Nel verbale riaperto il pulsante «🖨 PDF» e' subito visibile (prima solo
  dopo un nuovo salvataggio); dall'elenco Visite c'era gia'.
- Il PDF della bozza porta «BOZZA» in diagonale su ogni pagina e una riga in
  testa: la nuvoletta lo prometteva, il codice no, e una bozza stampata
  sembrava un verbale definitivo.
- Il file si chiama «BOZZA - …» e NON va nell'archivio dei verbali su Drive.
"""
import io

CRLF = chr(13) + chr(10)
LF = chr(10)

def patch(P, lista):
    src = io.open(P, encoding='utf-8', newline='').read()
    NL = CRLF if CRLF in src else LF
    for vecchio, nuovo, nome in lista:
        v = vecchio.replace(LF, NL); n = nuovo.replace(LF, NL)
        c = src.count(v)
        assert c == 1, '%s %s: trovate %d occorrenze' % (P, nome, c)
        src = src.replace(v, n)
    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    return src

patch('verbale-pdf.js', [
("""    return {
      dataOggi, rettBanner: D.rettBanner || null,""", """    return {
      dataOggi, rettBanner: D.rettBanner || null,
      bozza: (v.stato || 'bozza') === 'bozza',   // 23/09/2026: il PDF della bozza lo dice su ogni pagina""", 'dati'),
("""      if (i === n) { f(doc, 'normal', 6.5, [180, 180, 180]); doc.text(`Generato il ${new Date().toLocaleString('it-IT')} – Formedil Padova CPT`, 105, PH - 9, { align: 'center' }) }
    }
    doc.setPage(n)
  }""", """      if (i === n) { f(doc, 'normal', 6.5, [180, 180, 180]); doc.text(`Generato il ${new Date().toLocaleString('it-IT')} – Formedil Padova CPT`, 105, PH - 9, { align: 'center' }) }
      if (d.bozza) filigranaBozza(doc)
    }
    doc.setPage(n)
  }

  /* BOZZA in diagonale, trasparente, e una riga in testa (23/09/2026): una bozza
     stampata non deve poter passare per un verbale definitivo */
  function filigranaBozza(doc) {
    const trasparente = typeof doc.GState === 'function' && typeof doc.setGState === 'function'
    if (trasparente) doc.setGState(new doc.GState({ opacity: 0.13 }))
    doc.setFont('helvetica', 'bold'); doc.setFontSize(96); doc.setTextColor(...(trasparente ? [192, 57, 43] : [245, 215, 205]))
    doc.text('BOZZA', 105, PH / 2 + 20, { align: 'center', angle: 40 })
    if (trasparente) doc.setGState(new doc.GState({ opacity: 1 }))
    f(doc, 'bold', 8, [192, 57, 43])
    doc.text('BOZZA — non valido come verbale: il documento definitivo è quello salvato come «Definitivo»', 105, 6, { align: 'center' })
  }""", 'filigrana'),
])

src = patch('index.html', [
("""    const _pdfName=[`Verb_${_codePdf}`,_ragPdf,_comPdf,_tecPdf,_dataFPdf].filter(Boolean).join(' - ')+'.pdf'
    doc.save(_pdfName)
    toast('PDF generato','ok')
    _uploadPdfDrive(pdfB64)   // upload in background""", """    const _isBozzaPdf=(v.stato||'bozza')==='bozza'
    const _pdfName=(_isBozzaPdf?'BOZZA - ':'')+[`Verb_${_codePdf}`,_ragPdf,_comPdf,_tecPdf,_dataFPdf].filter(Boolean).join(' - ')+'.pdf'
    doc.save(_pdfName)
    toast(_isBozzaPdf?'PDF della bozza generato (con la scritta BOZZA, non archiviato su Drive)':'PDF generato','ok')
    if(!_isBozzaPdf)_uploadPdfDrive(pdfB64)   // upload in background; la bozza non va nell'archivio (23/09/2026)""", 'nome e drive'),
("""    await initForm(snap)
    navTo('form')
    toast(`Bozza ${snap.nr_verbale_origine||''} riaperta — completa e salva come Definitivo`,'ok')""", """    await initForm(snap)
    navTo('form')
    if(S.savedId)show('btn-pdf')   // il PDF della bozza si puo' fare subito (23/09/2026)
    toast(`Bozza ${snap.nr_verbale_origine||''} riaperta — completa e salva come Definitivo`,'ok')""", 'riapri'),
])
assert src.rstrip().endswith('</html>')
print('ok')
