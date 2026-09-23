# -*- coding: utf-8 -*-
"""23/09/2026 - «Includi chiusi» fra i filtri, subito dopo «Visite».

Chiesto dall'utente: la casella stava accanto alla ricerca, lontana dagli
altri filtri. Resta una casella di spunta, con la forma a pillola dei filtri.
La casella e' lo stesso elemento di prima (id chk-cant-chiusi): non la si
ricrea, la si sposta, cosi' restano valore e gestore del cambio. Siccome
_clBuildFilters svuota la barra a ogni caricamento, prima la si stacca e poi
la si riattacca in fondo.
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

# 1. HTML: la casella esce dalla barra di ricerca (la raccoglie _clBuildFilters)
sost("""<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--grey);cursor:pointer;white-space:nowrap"><input type="checkbox" id="chk-cant-chiusi"> Includi chiusi 🔒</label><button class="btn-outline btn-sm" id="btn-tutti-cant">Mostra tutti</button>""",
     """<button class="btn-outline btn-sm" id="btn-tutti-cant">Mostra tutti</button>
          <label id="lbl-cant-chiusi" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--border,#ddd);border-radius:20px;font-size:12px;cursor:pointer;background:#fff;white-space:nowrap;flex:0 0 auto;width:auto"><input type="checkbox" id="chk-cant-chiusi" style="width:auto;margin:0"> Includi chiusi 🔒</label>""",
     'html casella')

# 2. _clBuildFilters: stacca la casella prima di svuotare, riattaccala dopo «Visite»
sost("""  _clState.comSel=new Set([..._clState.comSel].filter(c=>comuni.includes(c)))
  fdiv.innerHTML=''
""", """  _clState.comSel=new Set([..._clState.comSel].filter(c=>comuni.includes(c)))
  const _lblChiusi=$('lbl-cant-chiusi');if(_lblChiusi&&_lblChiusi.parentNode)_lblChiusi.parentNode.removeChild(_lblChiusi)
  fdiv.innerHTML=''
""", 'stacca')
sost("""  mkSel('vis','<option value="">👷 Visite: tutti</option><option value="si">Con visite</option><option value="no">Senza visite</option>')
}""", """  mkSel('vis','<option value="">👷 Visite: tutti</option><option value="si">Con visite</option><option value="no">Senza visite</option>')
  if(_lblChiusi)fdiv.appendChild(_lblChiusi)  // «Includi chiusi» dopo Visite (23/09/2026)
}""", 'riattacca')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
