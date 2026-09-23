# -*- coding: utf-8 -*-
"""23/09/2026 - Invio del verbale: la campagna attiva si vede e non si sceglie.

Chiesto dall'utente: «la campagna in corso non deve avere quella tendina per
escluderla: le decidono segreteria e coordinatore dove appaiono e se
appaiono; il tecnico vede solo quale e' attiva». La tendina diventa un campo
nascosto che porta la posizione decisa sulla campagna (campagne.posizione,
impostata nella Zona Coordinatore): il resto del codice (PDF e mail) la legge
come prima, ma il tecnico non la puo' piu' cambiare.
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

sost("""      📣 Campagna attiva: <b id="ev-campagna-nome"></b><br>
      Inserisci in: <select id="ev-campagna-pos" style="margin-top:4px;padding:3px 6px;border-radius:6px;border:1px solid #ddd;font-size:12px">
        <option value="entrambi">verbale PDF + mail</option>
        <option value="verbale">solo verbale PDF</option>
        <option value="email">solo mail</option>
        <option value="no">non inserire questa volta</option>
      </select>""", """      📣 Campagna attiva: <b id="ev-campagna-nome"></b><br>
      <span id="ev-campagna-dove" style="color:#666"></span>
      <input type="hidden" id="ev-campagna-pos">""", 'html')

sost("""  $('ev-campagna-nome').textContent=c.titolo||''
  $('ev-campagna-pos').value=c.posizione||'verbale'
  wrap.style.display='block'
}""", """  $('ev-campagna-nome').textContent=c.titolo||''
  $('ev-campagna-pos').value=c.posizione||'verbale'
  /* dove e se: lo decidono segreteria e coordinatore sulla campagna, il tecnico lo vede (23/09/2026) */
  const _dove={entrambi:'nel verbale PDF e nella mail',verbale:'solo nel verbale PDF',email:'solo nella mail',no:'non inserita in questo invio'}[c.posizione||'verbale']||'nel verbale PDF'
  $('ev-campagna-dove').textContent='Inserita '+_dove+' — lo decidono segreteria e coordinatore.'
  wrap.style.display='block'
  if(typeof _evAnteprima==='function')_evAnteprima()
}""", 'setup')

sost("""+' — dove va lo decide la tendina qui sopra]')""", """+' — '+($('ev-campagna-dove')?.textContent||'')+']')""", 'anteprima')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
