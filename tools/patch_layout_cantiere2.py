# -*- coding: utf-8 -*-
"""23/09/2026 - Passo Cantiere, secondo giro sulla schermata annotata dall'utente.

- indirizzo lungo quanto il riquadro disegnato, «+ Nuovo cantiere» subito dopo;
- «Accesso cantiere n°» accorciato, «Protocollo interno» si avvicina;
- «Data ultimazione lavori» piu' larga: l'etichetta non va piu' a capo e la
  casella si allinea alle altre.
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

sost("""          <div class="field" style="flex:1 1 300px">
            <label>Indirizzo cantiere (anche parziale)</label>""", """          <div class="field" style="flex:0 1 620px">
            <label>Indirizzo cantiere (anche parziale)</label>""", 'indirizzo')
sost("""<div class="field"><label>Accesso cantiere n° (dal DB cantiere)</label>""",
     """<div class="field" style="flex:0 1 420px"><label>Accesso cantiere n° (dal DB cantiere)</label>""", 'accesso')
sost("""<div class="field" style="flex:0 0 230px"><label>Data ultimazione lavori <span style="font-weight:400;font-size:11px;color:#aaa">(dal cantiere)</span></label>""",
     """<div class="field" style="flex:0 1 380px"><label style="white-space:nowrap">Data ultimazione lavori <span style="font-weight:400;font-size:11px;color:#aaa">(dal cantiere)</span></label>""", 'data')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
