# -*- coding: utf-8 -*-
"""23/09/2026 - Codice univoco del cantiere proposto dall'app (codice-univoco.js).

Pulsante «💡 Proponi» accanto al codice univoco nel verbale (salva sul
cantiere se e' vuoto) e nella scheda del cantiere (propone nel campo).
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

sost("""<input type="text" id="f-cod-uni" placeholder="–" readonly style="background:#f8f8f8"></div>""",
     """<div style="display:flex;gap:6px;align-items:center"><input type="text" id="f-cod-uni" placeholder="–" readonly style="background:#f8f8f8;flex:1"><button type="button" class="btn-outline btn-sm" id="btn-cod-uni-proponi" style="white-space:nowrap">💡 Proponi</button></div></div>""",
     'verbale')
sost("""<input type="text" id="mc-cod-uni" placeholder="Codice univoco" maxlength="50"></div>""",
     """<div style="display:flex;gap:6px;align-items:center"><input type="text" id="mc-cod-uni" placeholder="Codice univoco" maxlength="50" style="flex:1"><button type="button" class="btn-outline btn-sm" id="btn-mc-cod-uni-proponi" style="white-space:nowrap">💡 Proponi</button></div></div>""",
     'scheda')
sost("""<script src="proposte-chiusura.js?v=1"></script>
""", """<script src="proposte-chiusura.js?v=1"></script>
<!-- codice univoco del cantiere proposto dall'app: iniziali tecnico-strada civico-sigla impresa (23/09/2026) -->
<script src="codice-univoco.js?v=1"></script>
""", 'script')
sost('<script src="aiuto.js?v=2"></script>', '<script src="aiuto.js?v=3"></script>', 'aiuto v')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))

W = '.github/workflows/deploy-pages.yml'
w = io.open(W, encoding='utf-8', newline='').read()
WNL = CRLF if CRLF in w else LF
a = "      - 'proposte-chiusura.js'" + WNL
assert w.count(a) == 1
w = w.replace(a, a + "      - 'codice-univoco.js'" + WNL)
b = 'proposte-chiusura.js sw.js'
assert w.count(b) == 1
w = w.replace(b, 'proposte-chiusura.js codice-univoco.js sw.js')
io.open(W, 'w', encoding='utf-8', newline='').write(w)
print('deploy-pages.yml aggiornato')

A = 'aiuto.js'
t = io.open(A, encoding='utf-8', newline='').read()
ANL = CRLF if CRLF in t else LF
o = "  /* proposta di chiusura (proposte-chiusura.js, 23/09/2026) */"
assert t.count(o) == 1
t = t.replace(o, "  /* codice univoco del cantiere (codice-univoco.js, 23/09/2026) */" + ANL +
  "  'btn-cod-uni-proponi': 'Propone il codice univoco del cantiere: iniziali del tecnico, strada e civico, sigla dell\\'impresa principale. Lo correggi prima di salvarlo; se il cantiere ha già un codice non lo tocca.'," + ANL +
  "  'btn-mc-cod-uni-proponi': 'Scrive nel campo il codice proposto: iniziali del tecnico, strada e civico, sigla dell\\'impresa principale. Correggilo se serve: si salva insieme al cantiere.'," + ANL + o)
io.open(A, 'w', encoding='utf-8', newline='').write(t)
print('aiuto.js aggiornato')
