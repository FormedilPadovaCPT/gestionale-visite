# -*- coding: utf-8 -*-
"""23/09/2026 - «Nuova impresa»: si sceglie la forma giuridica / tipologia.

Chiesto dall'utente: mancava il modo di dire se e' una societa', una ditta
individuale, un lavoratore autonomo... La colonna esiste gia' (imprese.tipo_impresa,
valori tipo «S.r.l.», «Ditta Individuale») e il trigger imprese_completa_anagrafica
la ricava dalla ragione sociale SOLO se e' vuota: lasciando la tendina su
«ricavala dalla ragione sociale» si comporta come prima, scegliendo vale la scelta.
I valori sono scritti come quelli gia' presenti, per non creare varianti.
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

sost("""    <div class="field"><label>Ragione sociale *</label><input type="text" id="mi-nome" placeholder="Ragione sociale…"></div>
""", """    <div class="field"><label>Ragione sociale *</label><input type="text" id="mi-nome" placeholder="Ragione sociale…"></div>
    <div class="field"><label>Forma giuridica / tipologia</label>
      <select id="mi-forma">
        <option value="">— ricavala dalla ragione sociale —</option>
        <option>S.r.l.</option>
        <option>S.r.l.s</option>
        <option>S.r.l. Unipersonale</option>
        <option>S.n.c.</option>
        <option>S.A.S.</option>
        <option>S.p.A.</option>
        <option>S.coop.</option>
        <option>Consorzio</option>
        <option>Ditta Individuale</option>
        <option>Lavoratore autonomo</option>
        <option>Altro</option>
      </select>
    </div>
""", 'html')

sost("""'mi-badge','mi-pat','mi-ceiv','mi-tipo-ccia','mi-ccnl','mi-ccnl-altro'].forEach(id=>""",
     """'mi-badge','mi-pat','mi-ceiv','mi-tipo-ccia','mi-ccnl','mi-ccnl-altro','mi-forma'].forEach(id=>""", 'reset')

sost("""    tipo_iscrizione_ccia:vGet('mi-tipo-ccia')||null,
    contratto_ccnl:ccnlVal==='13'?'13':ccnlVal,""", """    tipo_iscrizione_ccia:vGet('mi-tipo-ccia')||null,
    tipo_impresa:vGet('mi-forma')||null,   // vuoto = la ricava il trigger dalla ragione sociale
    contratto_ccnl:ccnlVal==='13'?'13':ccnlVal,""", 'salvataggio')

assert src.rstrip().endswith('</html>'), 'fine file persa'
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('index.html: %d -> %d caratteri' % (n0, len(src)))
