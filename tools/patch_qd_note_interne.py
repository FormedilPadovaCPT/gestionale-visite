# -*- coding: utf-8 -*-
"""23/09/2026 - Riquadro della visita: anche le note che non vanno nel report.

Chiesto dall'utente: aprendo una visita fatta, il riquadro mostrava solo cio'
che finisce nel verbale PDF. Al tecnico servono anche le cose scritte per
l'ufficio: osservazioni interne, formazione mancante (spunta e note),
proposta di segnalazione SPISAL/ITL e data della visita di ritorno. Stanno in
una sezione a parte, col colore del campo interno del modulo.
"""
import io

CRLF = chr(13) + chr(10)
LF = chr(10)
P = 'index.html'
src = io.open(P, encoding='utf-8', newline='').read()
n0 = len(src)
NL = CRLF if CRLF in src else LF

def sost(vecchio, nuovo, nome):
    global src
    vecchio = vecchio.replace(LF, NL); nuovo = nuovo.replace(LF, NL)
    c = src.count(vecchio)
    assert c == 1, '%s: trovate %d occorrenze' % (nome, c)
    src = src.replace(vecchio, nuovo)

sost("""        tipo_accesso,acc_cant,nr_lavoratori,nr_lavoratori_stranieri,prescrizioni,oss_tec,
        comm_tipo_sogg,""", """        tipo_accesso,acc_cant,nr_lavoratori,nr_lavoratori_stranieri,prescrizioni,oss_tec,
        oss_tec_int,note_for_sn,note_for_m,segnalazione,data_ritorno,
        comm_tipo_sogg,""", 'select')

sost("""    if(v.oss_tec?.trim()) html+=qdSec('Note tecnico')+`<div class="qd-note" style="border-color:#3498db;background:#f4f8ff">${esc(v.oss_tec)}</div>`
    $('qd-body').innerHTML=html
""", """    if(v.oss_tec?.trim()) html+=qdSec('Note tecnico')+`<div class="qd-note" style="border-color:#3498db;background:#f4f8ff">${esc(v.oss_tec)}</div>`
    // ── NON NEL REPORT (23/09/2026): cio' che il tecnico ha scritto per l'ufficio ──
    {
      const _int=[]
      if(v.oss_tec_int?.trim())_int.push(`<div style="margin-bottom:6px"><b>Osservazioni interne</b><div style="white-space:pre-wrap">${esc(v.oss_tec_int)}</div></div>`)
      if(v.note_for_sn===true||v.note_for_m?.trim())_int.push(`<div style="margin-bottom:6px"><b>Formazione mancante</b>${v.note_for_sn===true?' — da segnalare all\\'ufficio corsi':''}${v.note_for_m?.trim()?`<div style="white-space:pre-wrap">${esc(v.note_for_m)}</div>`:''}</div>`)
      if(v.segnalazione===true)_int.push(`<div style="margin-bottom:6px"><b>Proposta di segnalazione a SPISAL / ITL</b></div>`)
      if(v.data_ritorno)_int.push(`<div><b>Visita di ritorno prevista:</b> ${fmtDate(String(v.data_ritorno).slice(0,10))}</div>`)
      if(_int.length)html+=qdSec('🔒 Solo per l\\'ufficio (non nel report)')+`<div class="qd-note" style="border-color:#f39c12;background:#fffef5">${_int.join('')}</div>`
    }
    $('qd-body').innerHTML=html
""", 'sezione')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
