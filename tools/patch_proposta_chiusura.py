# -*- coding: utf-8 -*-
"""23/09/2026 - Il tecnico propone alla segreteria la chiusura di un cantiere.

Aggancia proposte-chiusura.js: pulsante nella riga dell'elenco cantieri e
nella scheda del cantiere, riquadro in Dashboard per la segreteria.
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

# 1. contenitore in Dashboard
sost("""      <div id="dash-respinte" style="display:none;margin-bottom:14px"></div>
""", """      <div id="dash-respinte" style="display:none;margin-bottom:14px"></div>
      <!-- cantieri che un tecnico propone di chiudere: lo vede la segreteria (proposte-chiusura.js, 23/09/2026) -->
      <div id="dash-prop-chiusura" style="display:none;margin-bottom:14px"></div>
""", 'dashboard div')

# 2. navTo dashboard
sost("""if(window.respinteBox)window.respinteBox().catch(e=>console.warn('mail respinte:',e));""",
     """if(window.respinteBox)window.respinteBox().catch(e=>console.warn('mail respinte:',e));if(window.propChius)window.propChius.box().catch(e=>console.warn('proposte chiusura:',e));""", 'navTo')

# 3. loadCantieri: proposte aperte sulle righe
sost("""  _cmRows=rows.filter(r=>!r._segn&&r.lat!=null&&r.lng!=null)  // per «Aggancia a cantiere» delle segnalazioni
""", """  _cmRows=rows.filter(r=>!r._segn&&r.lat!=null&&r.lng!=null)  // per «Aggancia a cantiere» delle segnalazioni
  // proposte di chiusura aperte (23/09/2026)
  try{if(window.propChius){const _pm=await window.propChius.aperte();rows.forEach(r=>{r._prop=_pm.get(r.cantiere_id)||null})}}
  catch(e){console.warn('proposte chiusura:',e);toast('Non sono riuscito a leggere le proposte di chiusura','warn')}
""", 'loadCantieri')

# 4. riga dell'elenco: dopo «+ Visita»
sost("""        <button class="btn-primary btn-sm" data-cant-id="${c.cantiere_id}" data-cant-label="${label}" data-cant-detail="${c.cantiere_indirizzo||''} ${c.cantiere_civico||''}${c.comune_nome?' – '+c.comune_nome:''}">+ Visita</button>
      </div></td>""", """        <button class="btn-primary btn-sm" data-cant-id="${c.cantiere_id}" data-cant-label="${label}" data-cant-detail="${c.cantiere_indirizzo||''} ${c.cantiere_civico||''}${c.comune_nome?' – '+c.comune_nome:''}">+ Visita</button>
        ${window.propChius?window.propChius.cellaRiga(c):''}
      </div></td>""", 'riga')

# 5. scheda del cantiere
sost("""        const _bc=document.createElement('button');_bc.className='btn-warn btn-sm';_bc.style.marginLeft='8px';_bc.textContent='🔒 Chiudi cantiere (fine lavori)';_bc.onclick=()=>chiudiCantiere(cantId,label);$('qd-actions').appendChild(_bc)
      }
    }
""", """        const _bc=document.createElement('button');_bc.className='btn-warn btn-sm';_bc.style.marginLeft='8px';_bc.textContent='🔒 Chiudi cantiere (fine lavori)';_bc.onclick=()=>chiudiCantiere(cantId,label);$('qd-actions').appendChild(_bc)
      }
    }
    // proposta di chiusura: il tecnico la fa, la segreteria la vede e la respinge (23/09/2026)
    if(window.propChius)window.propChius.scheda(cantId,label,!!c.cantiere_chiuso).catch(e=>console.warn('proposta chiusura:',e))
""", 'scheda')

# 6. funzioni esposte per il modulo
sost("""async function riapriCantiere(cantId,label){""",
     """window.chiudiCantiere=chiudiCantiere
async function riapriCantiere(cantId,label){""", 'expose chiudi')
sost("""function _clPass(d){""", """window.loadCantieri=loadCantieri
function _clPass(d){""", 'expose loadCantieri')

# 7. script
sost("""<script src="mail-respinte-tec.js?v=1"></script>
""", """<script src="mail-respinte-tec.js?v=1"></script>
<!-- il tecnico propone la chiusura di un cantiere, la segreteria decide (23/09/2026) -->
<script src="proposte-chiusura.js?v=1"></script>
""", 'script')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))

# workflow di deploy: il file nuovo va pubblicato
W = '.github/workflows/deploy-pages.yml'
w = io.open(W, encoding='utf-8', newline='').read()
WNL = CRLF if CRLF in w else LF
a = "      - 'mail-respinte-tec.js'" + WNL
assert w.count(a) == 1
w = w.replace(a, a + "      - 'proposte-chiusura.js'" + WNL)
b = 'mail-respinte-tec.js sw.js'
assert w.count(b) == 1
w = w.replace(b, 'mail-respinte-tec.js proposte-chiusura.js sw.js')
io.open(W, 'w', encoding='utf-8', newline='').write(w)
print('deploy-pages.yml aggiornato')
