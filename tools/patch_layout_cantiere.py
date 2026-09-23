# -*- coding: utf-8 -*-
"""23/09/2026 - Passo Cantiere del verbale: impaginazione chiesta dall'utente
(schermata annotata a mano).

- la frase «Ricerca per comune e/o indirizzo…» sale sotto il titolo CANTIERE;
- la casella dell'indirizzo si accorcia e «+ Nuovo cantiere» / «✏️ Modifica
  cantiere» vanno sulla stessa riga, in fondo a destra;
- le caselle del codice CNCE e del codice univoco si stringono.
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

sost("""          <div class="sect-title">Cantiere *</div>
          <div class="row">
          <div class="field" style="flex:0 1 300px">
            <label>Comune</label>""", """          <div class="sect-title">Cantiere *</div>
          <div style="font-size:12px;color:#888;margin:-4px 0 8px">Ricerca per comune e/o indirizzo. I cantieri terminati sono esclusi.</div>
          <div class="row">
          <div class="field" style="flex:0 1 300px">
            <label>Comune</label>""", 'frase in cima')

sost("""          <div class="field" style="flex:2 1 380px">
            <label>Indirizzo cantiere (anche parziale)</label>""", """          <div class="field" style="flex:1 1 300px">
            <label>Indirizzo cantiere (anche parziale)</label>""", 'indirizzo piu corto')

sost("""            <div style="font-size:11px;color:#aaa;margin-top:3px">Ricerca per comune e/o indirizzo. I cantieri terminati sono esclusi.</div>
            <input type="hidden" id="f-cant-id">""", """            <input type="hidden" id="f-cant-id">""", 'frase sotto tolta')

sost("""          </div>
          </div>
          <button class="btn-outline btn-sm" id="btn-new-cant">+ Nuovo cantiere</button><button class="btn-outline btn-sm" id="btn-edit-cant" type="button" onclick="editCantiereForm()" style="display:none;margin-left:6px" title="Modifica i dati del cantiere selezionato">✏️ Modifica cantiere</button>
""", """          </div>
          <div class="field" style="flex:0 0 auto;align-self:flex-start">
            <label>&nbsp;</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;min-height:42px;align-items:center">
              <button class="btn-outline btn-sm" id="btn-new-cant">+ Nuovo cantiere</button><button class="btn-outline btn-sm" id="btn-edit-cant" type="button" onclick="editCantiereForm()" style="display:none" title="Modifica i dati del cantiere selezionato">✏️ Modifica cantiere</button>
            </div>
          </div>
          </div>
""", 'pulsanti sulla riga')

sost("""            <div class="field"><label>Codice CNCE <span style="font-weight:400;font-size:11px;color:#aaa">(dal cantiere)</span></label>""",
     """            <div class="field" style="flex:0 1 260px"><label>Codice CNCE <span style="font-weight:400;font-size:11px;color:#aaa">(dal cantiere)</span></label>""", 'cnce')
sost("""            <div class="field"><label>Codice univoco <span style="font-weight:400;font-size:11px;color:#aaa">(dal cantiere)</span></label>""",
     """            <div class="field" style="flex:0 1 440px"><label>Codice univoco <span style="font-weight:400;font-size:11px;color:#aaa">(dal cantiere)</span></label>""", 'codice univoco')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
